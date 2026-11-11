"use strict";

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const { migrate } = require("../migrations/enterprise_metering_and_automations");
const { createMeter } = require("../services/usageMeteringService");

function createMeteringSqliteDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE tenants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT, plan TEXT, plan_status TEXT, max_monthly_messages INT DEFAULT 2);
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, role TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE organization_memberships (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, user_id INT, role TEXT, membership_status TEXT DEFAULT 'active');
    CREATE TABLE wallet_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, currency TEXT DEFAULT 'INR', credit_type TEXT, balance INT DEFAULT 0, reserved_balance INT DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE (tenant_id, credit_type));
    CREATE TABLE wallet_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, account_id INT, entry_type TEXT, amount INT, balance_after INT, reason TEXT, reference_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE usage_events (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, meter_key TEXT, quantity INT, external_event_id TEXT, occurred_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE (meter_key, external_event_id));
    CREATE TABLE wa_automations (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, name TEXT, trigger_type TEXT, run_count INT DEFAULT 0);
    CREATE TABLE wa_automation_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, automation_id INT, phone TEXT, status TEXT);
  `);

  const db = {
    isSqlite: true,
    promise: () => ({
      query: async (sql, params = []) => {
        const cleanSql = sql.replace(/`/g, "").replace(/\s+FOR\s+UPDATE\b/gi, "");
        const trimmed = cleanSql.trim().toUpperCase();
        const stmt = sqlite.prepare(cleanSql);
        if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA")) {
          return [stmt.all(...params)];
        }
        const info = stmt.run(...params);
        return [{ affectedRows: info.changes, insertId: Number(info.lastInsertRowid || 0) }];
      },
    }),
  };
  return { db, sqlite };
}

async function testAtomicCreditLifecycle() {
  const { db } = createMeteringSqliteDb();
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  await migrate(db);
  await migrate(db); // Idempotent check

  await q("INSERT INTO tenants (id, name, slug, plan, plan_status, max_monthly_messages) VALUES (1, 'Acme Corp', 'acme-corp', 'starter', 'active', 2)");
  await q("INSERT INTO users (id, first_name, last_name, email, role) VALUES (5, 'Arun', 'Kumar', 'arun@acme.test', 'agent')");
  await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (1, 5, 'employee', 'active')");

  const meter = createMeter({ db });

  // 1. Grant 100 AI credits atomically
  const granted = await meter.grantCreditsTransactional({ tenantId: 1, creditType: "ai_credits", amount: 100, reason: "Starter top-up", referenceId: "topup_1" });
  assert.equal(granted.balance, 100);

  // 2. Reserve 3 units -> consume 1 actual unit -> releases 2 unused credits!
  const res1 = await meter.reserveCredits({ tenantId: 1, userId: 5, operation: "ai_reply", units: 3, referenceId: "op_partial_1" });
  assert.equal(res1.estimatedAmount, 3);
  const [acctHold] = await q("SELECT balance, reserved_balance FROM wallet_accounts WHERE tenant_id = 1 AND credit_type = 'ai_credits'");
  assert.equal(acctHold.balance, 100);
  assert.equal(acctHold.reserved_balance, 3);

  const cons1 = await meter.consumeReservation({ reservationId: res1.reservationId, tenantId: 1, actualUnits: 1 });
  assert.equal(cons1.consumedAmount, 1);
  assert.equal(cons1.releasedAmount, 2);
  assert.equal(cons1.balanceAfter, 99);

  // Idempotent duplicate consume does not double-charge
  const consDup = await meter.consumeReservation({ reservationId: res1.reservationId, tenantId: 1, actualUnits: 1 });
  assert.equal(consDup.idempotent, true);

  // 3. Reserve 5 credits & release cleanly without debit
  const res2 = await meter.reserveCredits({ tenantId: 1, userId: 5, operation: "ai_generate", units: 5, referenceId: "op_abort_1" });
  await meter.releaseReservation({ reservationId: res2.reservationId, tenantId: 1 });
  const [acctReleased] = await q("SELECT balance, reserved_balance FROM wallet_accounts WHERE tenant_id = 1 AND credit_type = 'ai_credits'");
  assert.equal(acctReleased.balance, 99);
  assert.equal(acctReleased.reserved_balance, 0);

  // 4. Prepaid zero/insufficient balance protection
  await assert.rejects(
    meter.reserveCredits({ tenantId: 1, userId: 5, operation: "ai_reply", units: 150, referenceId: "op_over" }),
    (e) => e.code === "INSUFFICIENT_CREDITS" && e.status === 402
  );

  // 5. Included Monthly Quota First -> Wallet Overage
  for (let idx = 1; idx <= 2; idx++) {
    const qRes = await meter.reserveCredits({ tenantId: 1, userId: 5, operation: "outbound_message", units: 1, referenceId: `msg_quota_${idx}` });
    assert.equal(qRes.coveredByQuota, true);
    assert.equal(qRes.estimatedAmount, 0);
    await meter.consumeReservation({ reservationId: qRes.reservationId, tenantId: 1, actualUnits: 1 });
  }
  // 3rd message exceeds quota (max=2) -> requires message_credits in wallet -> blocked when empty
  await assert.rejects(
    meter.reserveCredits({ tenantId: 1, userId: 5, operation: "outbound_message", units: 1, referenceId: "msg_over_quota" }),
    (e) => e.code === "INSUFFICIENT_CREDITS"
  );
  await meter.grantCreditsTransactional({ tenantId: 1, creditType: "message_credits", amount: 10, reason: "Overage pack", referenceId: "msg_pack_1" });
  const overRes = await meter.reserveCredits({ tenantId: 1, userId: 5, operation: "outbound_message", units: 1, referenceId: "msg_over_quota_paid" });
  assert.equal(overRes.estimatedAmount, 1);
  await meter.consumeReservation({ reservationId: overRes.reservationId, tenantId: 1, actualUnits: 1 });

  // 6. Employee Controls & Limits
  await meter.updateEmployeeUsageLimit(1, 5, { daily_credit_limit: 2, allow_campaigns: false }, 1);
  // Employee 5 used 1 credit so far -> 1 more succeeds, 2 more exceeds daily limit (2)
  await meter.recordMeteredUsage(
    { tenantId: 1, userId: 5, operation: "ai_reply", units: 1, referenceId: "op_emp_ok" },
    async () => ({ actualUnits: 1 })
  );
  await assert.rejects(
    meter.reserveCredits({ tenantId: 1, userId: 5, operation: "ai_reply", units: 1, referenceId: "op_emp_block" }),
    (e) => e.code === "EMPLOYEE_LIMIT_EXCEEDED" && e.status === 403
  );
  await assert.rejects(
    meter.reserveCredits({ tenantId: 1, userId: 5, operation: "campaign_message", units: 1, referenceId: "op_emp_cmp" }),
    (e) => e.code === "EMPLOYEE_RESTRICTED" && e.status === 403
  );

  // 7. System Automation Attribution (user_id = 0) & Ledger Reconciliation
  await meter.recordMeteredUsage(
    { tenantId: 1, userId: null, operation: "ai_generate", units: 2, referenceId: "sys_auto_1", automationId: 11 },
    async () => ({ actualUnits: 2 })
  );
  const empReport = await meter.getEmployeeUsageReport(1);
  assert(empReport.employees.some((e) => e.user_id === 5 && e.ai_credits_used === 2));
  assert(empReport.employees.some((e) => e.user_id === 0 && e.name === "System Automation Agent" && e.ai_credits_used === 2));

  const recon = await meter.reconcileWalletLedger(1);
  assert(recon.length === 2 && recon.every((r) => r.balanced === true), `Reconciliation mismatch: ${JSON.stringify(recon)}`);

  console.log("  [PASS 1] Atomic reserve->consume->release, quota-first overage, employee limits & ledger reconciliation passed");
}

async function testAutomationPipelinePerStepTakeoverAndActions() {
  const filename = path.resolve(__dirname, "../services/waAutomationService.js");
  const realRequire = createRequire(filename);
  const sentTexts = [];
  const loggedRows = [];
  const socketAlerts = [];
  let takeoverActive = false;

  const query = async (sql, params = []) => {
    if (sql.startsWith("INSERT INTO wa_automation_logs")) {
      loggedRows.push({ sql, params });
      return [{ insertId: loggedRows.length, affectedRows: 1 }];
    }
    if (sql.startsWith("SELECT")) return [[]];
    return [{ affectedRows: 1 }];
  };

  const mocks = {
    "../config/database": { promise: () => ({ query }) },
    "./waLoadBalancer": {
      sendTextMessage: async (_phone, txt) => {
        sentTexts.push(txt);
        // Simulate human employee taking over immediately after Step 1 sends!
        takeoverActive = true;
        return { id: `wamid.step.${sentTexts.length}` };
      },
    },
    "./automationCloudDelivery": { send: async () => ({ messages: [{ id: "wamid.cloud.1" }] }) },
    "./waBotGate": {
      shouldBotEngage: async () => takeoverActive ? { allowed: false, reason: "agent_takeover" } : { allowed: true },
    },
    "./flowIntegrations": {
      createWebhookRunner: () => async () => {
        const err = new Error("Request timeout ETIMEDOUT");
        err.code = "ETIMEDOUT";
        throw err;
      },
    },
    "../sockets/chatsockets": {
      getIO: () => ({ to: () => ({ emit: (ev, payload) => socketAlerts.push({ ev, payload }) }) }),
    },
    "./whatsappService": { defaultKey: "sess-1" },
  };

  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), { module: mod, exports: mod.exports, require: (n) => (Object.hasOwn(mocks, n) ? mocks[n] : realRequire(n)), Date, Buffer, console, setInterval: () => ({ unref() {} }), setTimeout, clearTimeout }, { filename });

  const rule = { id: 9, tenant_id: 1, name: "Multi-step rule", created_by: 1, published_version_id: 3 };
  const actions = [
    { id: "s1", type: "send_message", params: { text: "Step 1 message" } },
    { id: "s2", type: "send_message", params: { text: "Step 2 must NOT send after takeover" } },
  ];

  // Test 1: Takeover stops pipeline BEFORE Step 2!
  const resTakeover = await mod.exports.executePipelineActions(rule, actions, 0, "919888877777", "Maya", {}, "sess-1", {});
  assert.equal(resTakeover.stoppedByTakeover, true);
  assert.equal(sentTexts.length, 1);
  assert(loggedRows.some((r) => r.params.includes("Paused before step 2: human agent takeover")));

  // Test 2: branch_condition false + internal_notification + uncertain call_webhook timeout
  takeoverActive = false;
  loggedRows.length = 0;
  const branchActions = [
    { id: "n1", type: "internal_notification", params: { message: "VIP customer alert" } },
    { id: "b1", type: "branch_condition", params: { rules: [{ field: "amount", operator: "gte", value: "5000" }], on_false: "stop" } },
    { id: "s2", type: "send_message", params: { text: "Should stop before here" } },
  ];
  const resCondStop = await mod.exports.executePipelineActions(rule, branchActions, 0, "919888877777", "Maya", { amount: 1000 }, "sess-1", {});
  assert.equal(resCondStop.stoppedByCondition, true);
  assert.equal(socketAlerts.length, 1);
  assert.equal(sentTexts.length, 1); // Still 1 from earlier

  // Test 3: call_webhook ETIMEDOUT marks deliveryUnknown without retrying blindly
  const webhookActions = [
    { id: "w1", type: "call_webhook", params: { method: "POST", url: "https://erp.example.test/hook", stop_on_error: true } },
  ];
  const resWh = await mod.exports.executePipelineActions(rule, webhookActions, 0, "919888877777", "Maya", {}, "sess-1", {});
  assert.equal(resWh.success, false);
  assert.equal(resWh.deliveryUnknown, true);
  assert(loggedRows.some((r) => r.params.includes("unknown")));

  console.log("  [PASS 2] Per-step human takeover stop, branch_condition gate, internal_notification & webhook unknown outcome passed");
}

async function main() {
  console.log("Running Atomic Credit Metering & Automation Hardening verification...");
  await testAtomicCreditLifecycle();
  await testAutomationPipelinePerStepTakeoverAndActions();
  console.log("\nALL ATOMIC METERING & AUTOMATION HARDENING TESTS PASSED!");
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exitCode = 1;
});
