"use strict";

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const { migrate } = require("../migrations/enterprise_workflow_hub");
const { normalize, step, execute } = require("../services/flowDefinition");
const integrations = require("../services/flowIntegrations");
const { createBuiltinExecutor } = require("../services/builtinWorkflowExecutor");
const { getHubCatalog, FLAGSHIP_TEMPLATES, applyConnectionMode } = require("../services/enterpriseWorkflowTemplates");

function createMemorySqlDb() {
  const sqlite = new DatabaseSync(":memory:");
  // Support auxiliary CRM tables used by builtinWorkflowExecutor tests
  sqlite.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, first_name TEXT, last_name TEXT, email TEXT, phone TEXT, role TEXT);
    CREATE TABLE wa_knowledge_base (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT, file_type TEXT, content TEXT, char_count INT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);

  const db = {
    isSqlite: true,
    promise: () => ({
      query: async (sql, params = []) => {
        const cleanSql = sql.replace(/`/g, "");
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

async function testMigrationAndCatalog(db) {
  await migrate(db);
  await migrate(db); // Idempotent repeat check

  const catalog = getHubCatalog();
  assert.equal(catalog.systems.length, 10, "All 10 industry systems must be present");
  assert.equal(catalog.totalTemplates, 75, "20 flagship workflows + 55 action blueprints");
  const aptSystem = catalog.systems.find((s) => s.id === "appointments");
  assert.equal(aptSystem.flagshipCount, 10, "All 10 deep Appointment workflows present");

  for (const tpl of FLAGSHIP_TEMPLATES) {
    const flow = normalize(tpl, { publish: true });
    const sim = step(flow);
    assert(sim.messages.length > 0 || sim.waiting || sim.isEnded, `Flagship preview runs cleanly: ${tpl.key}`);
  }
  console.log("  [PASS 1] Additive 8-table schema migration & 75-template 10-System validation passed");
}

async function testBuiltinCrmExecution(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  await q("INSERT INTO users (tenant_id, first_name, last_name, email, phone, role) VALUES (1, 'Asha', 'Rao', 'asha@example.test', '919888877777', 'agent')");
  await q("INSERT INTO wa_knowledge_base (filename, file_type, content) VALUES ('Refund_Policy.md', 'md', 'Customers receive full refunds within 7 business days after inspection.')");
  await q("INSERT INTO wa_crm_products (tenant_id, sku, name, category, price, currency, stock_qty, is_active) VALUES (1, 'SKU-AMC-1', 'Annual AMC Plan', 'services', 2500, 'INR', 5, 1)");

  const builtin = createBuiltinExecutor({
    db,
    billing: { getCustomerBillsAndReceipts: async () => ({ found: true, invoices: [{ invoice_no: "INV-900", amount_billed: 2500, amount_paid: 0, balance_due: 2500, status: "Payment Pending" }] }) },
    leadCapture: { captureLeadFromWhatsApp: async () => ({ captured: true }) },
    aiAssistant: {},
  });
  const runner = integrations.createRunner({ builtin });
  const ctx = { tenantId: 1, conversationId: 44, runId: 500, messageId: "msg-1", occurrence: 0, phone: "919999911111", customerName: "Ravi" };

  // 1. Appointments: Availability -> Create Booking -> Double-booking guard -> Idempotency -> Cancel -> Waitlist
  const bookingNode = {
    node_key: "book",
    node_type: "business_action",
    config: {
      connection: "builtin",
      operation: "appointments.booking_create",
      inputs: { customer_phone: "{{customer.phone}}", service: "{{service}}", branch: "{{branch}}", date: "{{date}}", time: "{{time}}" },
      outputs: { booking_msg: "message", booking_ref: "reference" },
      next_node_key: "done",
      error_next: "err",
    },
  };
  const vars = { "customer.phone": "919999911111", service: "Consultation", branch: "Main", date: "2026-12-20", time: "11:00" };
  const booked = await runner(bookingNode, vars, ctx);
  assert(booked.booking_ref.startsWith("APT-"));

  // Idempotent repeat of exact same run/message returns exact same reference without throwing conflict
  const repeated = await runner(bookingNode, vars, ctx);
  assert.equal(repeated.booking_ref, booked.booking_ref);

  // Different run trying the exact same booked slot MUST fail double-booking guard
  await assert.rejects(
    runner(bookingNode, vars, { ...ctx, runId: 501, phone: "919999922222" }),
    /already booked/
  );

  // Reschedule & Cancel & Waitlist
  const resched = await builtin.executeOperation("appointments.reschedule", { customer_phone: "919999911111", reference: booked.booking_ref, date: "2026-12-21", time: "14:30" }, ctx);
  assert.equal(resched.data.status, "rescheduled");
  const waitlistRes = await builtin.executeOperation("appointments.waitlist", { customer_phone: "919999922222", service: "Consultation", branch: "Main", date: "2026-12-21" }, { ...ctx, runId: 502 });
  assert.equal(waitlistRes.data.status, "waiting");
  const cancelled = await builtin.executeOperation("appointments.cancel", { customer_phone: "919999911111", reference: booked.booking_ref }, ctx);
  assert.equal(cancelled.data.status, "cancelled");
  assert(cancelled.data.message.includes("waitlisted customer"));

  // 2. Support KB + Tickets
  const kbRes = await builtin.executeOperation("support.knowledge_search", { question: "What is your refund policy?" }, ctx);
  assert(kbRes.data.found && kbRes.data.message.includes("Refund_Policy.md"));
  const tktRes = await builtin.executeOperation("support.ticket_create", { customer_phone: "919999911111", details: "Printer not syncing" }, ctx);
  assert(tktRes.data.reference.startsWith("TKT-"));
  const escRes = await builtin.executeOperation("support.complaint_escalate", { customer_phone: "919999911111", reference: tktRes.data.reference, details: "Urgent downtime" }, ctx);
  assert.equal(escRes.data.status, "escalated");

  // 3. Finance verification guardrail: unpaid invoice CANNOT issue paid receipt
  const payLink = await builtin.executeOperation("finance.payment_link", { customer_phone: "919999911111", reference: "INV-900" }, ctx);
  assert.equal(payLink.data.balance_due, 2500);
  await assert.rejects(
    builtin.executeOperation("finance.receipt", { customer_phone: "919999911111", reference: "INV-900" }, ctx),
    /gateway/
  );

  // 4. Commerce + Logistics: stock validation, order creation, tracking, POD
  const checkout = await builtin.executeOperation("commerce.checkout", { customer_phone: "919999911111", product: "SKU-AMC-1", quantity: "2" }, ctx);
  assert.equal(checkout.data.total_amount, 5000);
  await assert.rejects(
    builtin.executeOperation("commerce.checkout", { customer_phone: "919999911111", product: "SKU-AMC-1", quantity: "10" }, { ...ctx, runId: 505 }),
    /Insufficient stock/
  );
  const tracked = await builtin.executeOperation("logistics.tracking", { customer_phone: "919999911111", reference: checkout.data.reference }, ctx);
  assert.equal(tracked.data.status, "pending");
  const pod = await builtin.executeOperation("logistics.delivery_confirm", { customer_phone: "919999911111", reference: checkout.data.reference }, ctx);
  assert.equal(pod.data.status, "delivered");

  // 5. HR phone identity guard + Operations summary
  const verifiedHr = await builtin.executeOperation("hr.leave_balance", { customer_phone: "919888877777" }, { ...ctx, phone: "919888877777" });
  assert.equal(verifiedHr.data.status, "verified");
  const unverifiedHr = await builtin.executeOperation("hr.payslip", { customer_phone: "919999911111" }, ctx);
  assert.equal(unverifiedHr.data.status, "pending_verification");

  await builtin.executeOperation("hospitality.table", { customer_phone: "919999911111", guests: "4", date: "2026-12-25" }, { ...ctx, runId: 506 });
  await builtin.executeOperation("sales.quotation", { customer_phone: "919999911111", service: "Enterprise Suite", budget: "80000" }, { ...ctx, runId: 507 });
  const rpt = await builtin.executeOperation("operations.report", { date: "2026-12-20", branch: "All" }, ctx);
  assert(rpt.data.message.includes("Appointments:") && rpt.data.message.includes("Pending Approvals:"));

  // External connection still enforces strict error when unconfigured
  const extNode = applyConnectionMode({ nodes: [bookingNode] }, "business").nodes[0];
  await assert.rejects(
    integrations.createRunner({ resolve: integrations.connection })(extNode, vars, ctx),
    /not configured/
  );

  console.log("  [PASS 2] Hybrid Built-In CRM operations, idempotency, financial/stock/HR guards & External safety passed");
}

async function testRuntimeWindowAndErrorAlerts() {
  const filename = path.resolve(__dirname, "../services/sharedFlowRuntime.js");
  const realRequire = createRequire(filename);
  const alertsInserted = [];
  const emittedEvents = [];

  const templateFlow = normalize({
    name: "Reminder Template Bot",
    trigger_type: "manual",
    entry_node_key: "tpl",
    nodes: [
      { node_key: "tpl", node_type: "send_template", config: { template_id: 11, template_name: "apt_reminder", parameters: ["{{customer.name}}"], next_node_key: "end_n" } },
      { node_key: "end_n", node_type: "end", config: {} },
    ],
  }, { publish: true });

  const failingActionFlow = normalize({
    name: "Broken Webhook Test",
    trigger_type: "manual",
    entry_node_key: "act",
    nodes: [
      { node_key: "act", node_type: "business_action", config: { connection: "builtin", operation: "finance.receipt", inputs: { customer_phone: "{{customer.phone}}", reference: "NONE" }, outputs: { m: "message" }, next_node_key: "ok", error_next: "ok" } },
      { node_key: "ok", node_type: "end", config: {} },
    ],
  }, { publish: true });

  const expiredConv = {
    id: 91, tenant_id: 1, sender_id: 2, branch_id: 1, contact_id: 5,
    contact_name: "Neha", contact_phone: "919777766666", contact_email: "neha@test",
    is_unsubscribed: 0, is_blocked: 0, status: "open", automation_mode: "human", automation_version: 0,
    service_window_expires_at: new Date(Date.now() - 3600000), // Expired >24h ago
  };

  let seq = 0;
  const templateCalls = [];
  const query = async (sql, params = []) => {
    if (sql.startsWith("INSERT INTO wa_flow_error_alerts")) {
      alertsInserted.push(params);
      return [{ insertId: 1, affectedRows: 1 }];
    }
    if (sql.startsWith("SELECT c.*")) return [[{ ...expiredConv }]];
    if (sql.startsWith("SELECT f.id")) {
      const f = Number(params[1]) === 10 ? templateFlow : failingActionFlow;
      return [[{ ...f, id: Number(params[1]), tenant_id: 1, nodes_snapshot: JSON.stringify(f.nodes) }]];
    }
    if (sql.startsWith("SELECT * FROM wa_templates")) return [[{ id: 11, name: "apt_reminder", language: "en", body: "Hello {{1}}", header_type: "TEXT", header_value: "" }]];
    if (sql.startsWith("SELECT id FROM wa_flows")) return [[{ id: 1 }]];
    if (sql.startsWith("UPDATE conversations SET automation_mode='flow'")) { expiredConv.automation_mode = "flow"; expiredConv.automation_version++; return [{ affectedRows: 1 }]; }
    if (sql.startsWith("INSERT INTO wa_flow_runs")) return [{ insertId: ++seq, affectedRows: 1 }];
    return [{ affectedRows: 1 }];
  };

  const mocks = {
    "../config/database": { promise: () => ({ query }) },
    "./sharedInboxAssistant": { schedule: (_t, _id, w) => Promise.resolve().then(w) },
    "./sharedInboxService": { createInboxService: () => ({ emit: async () => {} }) },
    "../sockets/chatsockets": { getIO: () => ({ to: () => ({ emit: (ev, p) => emittedEvents.push({ ev, p }) }) }) },
    "./flowIntegrations": { createRunner: () => async () => { throw new Error("Simulated gateway error"); } },
    "./waConfigHelper": {
      cloudClientForTenantSender: async () => ({
        wabaId: "waba-1",
        sendTemplate: async (_p, name, _lang, params) => { templateCalls.push({ name, params }); return { messages: [{ id: "wamid.tpl.1" }] }; },
      }),
    },
  };

  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), { module: mod, exports: mod.exports, require: (n) => (Object.hasOwn(mocks, n) ? mocks[n] : realRequire(n)), Date, Buffer, console, setInterval: () => ({ unref() {} }) }, { filename });

  // Outside 24h window: template-entry workflow MUST succeed via sendTemplate
  await mod.exports.start(1, 91, 10);
  assert.equal(templateCalls.length, 1);
  assert.equal(templateCalls[0].name, "apt_reminder");

  // Non-template flow outside 24h window MUST be blocked
  await assert.rejects(mod.exports.start(1, 91, 20), /24h customer service window/);

  // Inside 24h window: action failure MUST persist wa_flow_error_alerts and emit wa_flow_alert
  expiredConv.service_window_expires_at = new Date(Date.now() + 3600000);
  await mod.exports.start(1, 91, 20);
  assert.equal(alertsInserted.length, 1);
  assert(emittedEvents.some((e) => e.ev === "wa_flow_alert"));

  console.log("  [PASS 3] 24h Meta Customer Service Window guard + template bypass & persistent error alerts passed");
}

async function main() {
  console.log("Running 10-System Enterprise Workflow Hub & Built-in CRM verification...");
  const { db } = createMemorySqlDb();
  await testMigrationAndCatalog(db);
  await testBuiltinCrmExecution(db);
  await testRuntimeWindowAndErrorAlerts();
  console.log("\nALL 10-SYSTEM WORKFLOW HUB & CRM EXECUTOR TESTS PASSED!");
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exitCode = 1;
});

