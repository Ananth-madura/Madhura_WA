"use strict";

const crypto = require("crypto");
const { isInternalTenant } = require("./platformAdminBootstrap");

const fail = (message, code, status = 400) => Object.assign(new Error(message), { code, status });
const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

const FALLBACK_RATES = {
  ai_reply: { credit_type: "ai_credits", credits_per_unit: 1, provider_cost_minor: 15 },
  ai_generate: { credit_type: "ai_credits", credits_per_unit: 1, provider_cost_minor: 15 },
  ai_intent: { credit_type: "ai_credits", credits_per_unit: 1, provider_cost_minor: 8 },
  ai_process: { credit_type: "ai_credits", credits_per_unit: 1, provider_cost_minor: 15 },
  kb_search: { credit_type: "ai_credits", credits_per_unit: 1, provider_cost_minor: 5 },
  outbound_message: { credit_type: "message_credits", credits_per_unit: 1, provider_cost_minor: 20 },
  campaign_message: { credit_type: "message_credits", credits_per_unit: 1, provider_cost_minor: 25 },
  flow_execution: { credit_type: "ai_credits", credits_per_unit: 0, provider_cost_minor: 2 },
  automation_execution: { credit_type: "message_credits", credits_per_unit: 1, provider_cost_minor: 20 },
  media_process: { credit_type: "ai_credits", credits_per_unit: 1, provider_cost_minor: 10 },
  external_webhook: { credit_type: "ai_credits", credits_per_unit: 0, provider_cost_minor: 5 },
};

function createMeter({ db = null } = {}) {
  const getDb = () => db || require("../config/database");
  const rawQ = async (sql, params = []) => (await getDb().promise().query(sql, params))[0];

  async function withTransaction(work) {
    const database = getDb();
    if (database.isSqlite) {
      const q = async (sql, params = []) => {
        const sanitized = sql.replace(/\s+FOR\s+UPDATE\b/gi, "");
        return (await database.promise().query(sanitized, params))[0];
      };
      await q("BEGIN IMMEDIATE");
      try {
        const res = await work(q);
        await q("COMMIT");
        return res;
      } catch (err) {
        await q("ROLLBACK").catch(() => {});
        throw err;
      }
    }

    const connection = await new Promise((resolve, reject) =>
      database.getConnection((err, conn) => (err ? reject(err) : resolve(conn)))
    );
    const client = connection.promise();
    const q = async (sql, params = []) => (await client.query(sql, params))[0];
    try {
      await client.beginTransaction();
      const res = await work(q);
      await client.commit();
      return res;
    } catch (err) {
      await client.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async function ensureWalletLocked(q, tenantId, creditType) {
    const existing = await q(
      "SELECT id, balance, reserved_balance, currency FROM wallet_accounts WHERE tenant_id = ? AND credit_type = ? FOR UPDATE",
      [tenantId, creditType]
    );
    if (existing.length) return existing[0];
    await q(
      "INSERT INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance) VALUES (?, 'INR', ?, 0, 0)",
      [tenantId, creditType]
    );
    const [created] = await q(
      "SELECT id, balance, reserved_balance, currency FROM wallet_accounts WHERE tenant_id = ? AND credit_type = ? FOR UPDATE",
      [tenantId, creditType]
    );
    return created;
  }

  async function grantCreditsTransactional({ tenantId, creditType = "ai_credits", amount, reason, referenceId = null }) {
    const tid = Number(tenantId);
    const amt = Math.round(Number(amount));
    if (!Number.isInteger(tid) || tid < 1) throw fail("Valid tenant ID is required", "TENANT_REQUIRED", 400);
    if (!Number.isInteger(amt) || amt <= 0) throw fail("Credit grant amount must be a positive integer", "INVALID_AMOUNT", 400);

    return withTransaction(async (q) => {
      const acct = await ensureWalletLocked(q, tid, creditType);
      const nextBalance = Number(acct.balance) + amt;
      await q(
        "UPDATE wallet_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [nextBalance, acct.id]
      );
      await q(
        `INSERT INTO wallet_entries (tenant_id, account_id, entry_type, amount, balance_after, reason, reference_id)
         VALUES (?, ?, 'credit', ?, ?, ?, ?)`,
        [tid, acct.id, amt, nextBalance, String(reason || "Wallet credit grant").slice(0, 255), referenceId]
      );
      return { success: true, accountId: acct.id, balance: nextBalance };
    });
  }

  async function loadRateCard(q, operation) {
    try {
      const rows = await q(
        "SELECT operation_key, credit_type, credits_per_unit, provider_cost_minor FROM usage_rate_cards WHERE operation_key = ? AND is_active = 1 ORDER BY version DESC LIMIT 1",
        [operation]
      );
      if (rows.length) return rows[0];
    } catch (_) {}
    return FALLBACK_RATES[operation] || { credit_type: "ai_credits", credits_per_unit: 1, provider_cost_minor: 10 };
  }

  async function ensureTenantPeriodLocked(q, tenantId, maxMonthlyMessages = 1000) {
    const period = monthKey();
    const rows = await q(
      "SELECT * FROM tenant_usage_periods WHERE tenant_id = ? AND period_key = ? FOR UPDATE",
      [tenantId, period]
    );
    if (rows.length) return rows[0];
    await q(
      "INSERT INTO tenant_usage_periods (tenant_id, period_key, messages_included, messages_used, ai_credits_included, ai_credits_used) VALUES (?, ?, ?, 0, 0, 0)",
      [tenantId, period, Number(maxMonthlyMessages) || 1000]
    );
    const [created] = await q(
      "SELECT * FROM tenant_usage_periods WHERE tenant_id = ? AND period_key = ? FOR UPDATE",
      [tenantId, period]
    );
    return created;
  }

  async function upsertEmployeePeriod(q, tenantId, userId, periodKeyStr, deltas) {
    const uid = Number(userId) || 0;
    const rows = await q(
      "SELECT * FROM employee_usage_summary WHERE tenant_id = ? AND user_id = ? AND period_key = ? FOR UPDATE",
      [tenantId, uid, periodKeyStr]
    );
    if (!rows.length) {
      await q(
        `INSERT INTO employee_usage_summary (tenant_id, user_id, period_key, actions_count, ai_credits_used, messages_sent, campaigns_sent, automations_run, flows_run, cost_minor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          uid,
          periodKeyStr,
          deltas.actions || 1,
          deltas.aiCredits || 0,
          deltas.messages || 0,
          deltas.campaigns || 0,
          deltas.automations || 0,
          deltas.flows || 0,
          deltas.costMinor || 0,
        ]
      );
      return;
    }
    const cur = rows[0];
    await q(
      `UPDATE employee_usage_summary
       SET actions_count = ?, ai_credits_used = ?, messages_sent = ?, campaigns_sent = ?, automations_run = ?, flows_run = ?, cost_minor = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        Number(cur.actions_count) + (deltas.actions || 1),
        Number(cur.ai_credits_used) + (deltas.aiCredits || 0),
        Number(cur.messages_sent) + (deltas.messages || 0),
        Number(cur.campaigns_sent) + (deltas.campaigns || 0),
        Number(cur.automations_run) + (deltas.automations || 0),
        Number(cur.flows_run) + (deltas.flows || 0),
        Number(cur.cost_minor) + (deltas.costMinor || 0),
        cur.id,
      ]
    );
  }

  async function checkEmployeeControlsLocked(q, tenantId, userId, operation, estimatedCredits, units) {
    const uid = Number(userId);
    if (!Number.isInteger(uid) || uid <= 0) return;
    const [lim] = await q(
      "SELECT * FROM employee_usage_limits WHERE tenant_id = ? AND user_id = ? LIMIT 1",
      [tenantId, uid]
    );
    if (!lim) return;
    if (Number(lim.is_suspended) === 1) {
      throw fail("Employee usage access has been suspended by an administrator", "EMPLOYEE_SUSPENDED", 403);
    }
    if (operation.startsWith("ai_") || operation === "kb_search") {
      if (Number(lim.allow_ai) === 0) throw fail("AI usage is disabled for this employee account", "EMPLOYEE_RESTRICTED", 403);
    }
    if (operation === "campaign_message" && Number(lim.allow_campaigns) === 0) {
      throw fail("Campaign sending is disabled for this employee account", "EMPLOYEE_RESTRICTED", 403);
    }
    if (operation === "automation_execution" && Number(lim.allow_automations) === 0) {
      throw fail("Automation execution is disabled for this employee account", "EMPLOYEE_RESTRICTED", 403);
    }

    const isMsg = ["outbound_message", "campaign_message", "automation_execution"].includes(operation);
    for (const [periodStr, creditLimit, msgLimit, label] of [
      [dayKey(), lim.daily_credit_limit, lim.daily_message_limit, "daily"],
      [monthKey(), lim.monthly_credit_limit, lim.monthly_message_limit, "monthly"],
    ]) {
      if (creditLimit == null && msgLimit == null) continue;
      const [sum] = await q(
        "SELECT ai_credits_used, messages_sent FROM employee_usage_summary WHERE tenant_id = ? AND user_id = ? AND period_key = ? LIMIT 1",
        [tenantId, uid, periodStr]
      );
      const usedCredits = Number(sum?.ai_credits_used || 0);
      const usedMsgs = Number(sum?.messages_sent || 0);
      if (creditLimit != null && usedCredits + estimatedCredits > Number(creditLimit)) {
        throw fail(`Employee ${label} credit limit reached (${usedCredits}/${creditLimit})`, "EMPLOYEE_LIMIT_EXCEEDED", 403);
      }
      if (isMsg && msgLimit != null && usedMsgs + units > Number(msgLimit)) {
        throw fail(`Employee ${label} message limit reached (${usedMsgs}/${msgLimit})`, "EMPLOYEE_LIMIT_EXCEEDED", 403);
      }
    }
  }

  /**
   * Atomically verify entitlement + employee limits and reserve estimated credits.
   */
  async function reserveCredits({
    tenantId,
    userId = null,
    operation = "ai_reply",
    units = 1,
    referenceId = null,
    automationId = null,
    flowId = null,
    flowRunId = null,
  }) {
    const tid = Number(tenantId);
    if (!Number.isInteger(tid) || tid < 1) throw fail("Valid tenant ID is required", "TENANT_REQUIRED", 400);
    const refId = referenceId || `res_${crypto.randomUUID()}`;
    const qty = Math.max(1, Math.round(Number(units) || 1));

    return withTransaction(async (q) => {
      const existing = await q(
        "SELECT * FROM usage_reservations WHERE tenant_id = ? AND reference_id = ? LIMIT 1",
        [tid, refId]
      );
      if (existing.length) {
        return {
          reservationId: existing[0].id,
          idempotent: true,
          status: existing[0].status,
          estimatedAmount: Number(existing[0].estimated_amount),
          creditType: existing[0].credit_type,
        };
      }

      const [tenant] = await q(
        "SELECT id, slug, plan, plan_status, max_monthly_messages FROM tenants WHERE id = ? LIMIT 1",
        [tid]
      );
      if (!tenant) throw fail("Organization not found", "TENANT_NOT_FOUND", 404);
      if (tenant.plan_status && tenant.plan_status !== "active") {
        throw fail("Subscription is not active", "PLAN_INACTIVE", 402);
      }
      const internal = await isInternalTenant(tenant, q).catch(() => false);

      const rate = await loadRateCard(q, operation);
      const creditType = rate.credit_type || "ai_credits";
      let estimatedAmount = Math.max(0, Number(rate.credits_per_unit || 0) * qty);

      // Included monthly message quota covers messaging until exhausted
      let coveredByQuota = false;
      if (creditType === "message_credits") {
        const periodRow = await ensureTenantPeriodLocked(q, tid, tenant.max_monthly_messages);
        if (Number(periodRow.messages_used) + qty <= Number(periodRow.messages_included || tenant.max_monthly_messages || 1000)) {
          estimatedAmount = 0;
          coveredByQuota = true;
        }
      }

      await checkEmployeeControlsLocked(q, tid, userId, operation, estimatedAmount, qty);

      const acct = await ensureWalletLocked(q, tid, creditType);
      const available = Number(acct.balance) - Number(acct.reserved_balance);

      if (estimatedAmount > 0 && !internal && available < estimatedAmount) {
        throw fail(
          `Insufficient ${creditType.replace("_", " ")}: ${Math.max(0, available)} available, ${estimatedAmount} required`,
          "INSUFFICIENT_CREDITS",
          402
        );
      }

      // If internal tenant has 0 balance, keep reservation amount bounded to available so ledger never goes negative
      const holdAmount = internal && available < estimatedAmount ? 0 : estimatedAmount;
      if (holdAmount > 0) {
        await q(
          "UPDATE wallet_accounts SET reserved_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [Number(acct.reserved_balance) + holdAmount, acct.id]
        );
      }

      const expiresAt = new Date(Date.now() + 15 * 60000).toISOString().slice(0, 19).replace("T", " ");
      const ins = await q(
        `INSERT INTO usage_reservations (tenant_id, account_id, user_id, credit_type, operation, estimated_amount, consumed_amount, released_amount, status, reference_id, automation_id, flow_id, flow_run_id, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'reserved', ?, ?, ?, ?, ?)`,
        [tid, acct.id, userId || null, creditType, operation, holdAmount, refId, automationId, flowId, flowRunId, expiresAt]
      );

      return {
        reservationId: ins.insertId,
        idempotent: false,
        coveredByQuota,
        internalBypass: internal && available < estimatedAmount,
        creditType,
        estimatedAmount: holdAmount,
        referenceId: refId,
      };
    });
  }

  /**
   * Consume actual usage from an active reservation, atomically releasing any unused hold.
   */
  async function consumeReservation({ reservationId, tenantId, actualUnits = 1, actualCostMinor = null, metadata = null }) {
    const tid = Number(tenantId);
    const rid = Number(reservationId);
    if (!Number.isInteger(tid) || tid < 1 || !Number.isInteger(rid) || rid < 1) {
      throw fail("Valid tenantId and reservationId required", "INVALID_RESERVATION", 400);
    }

    return withTransaction(async (q) => {
      const [res] = await q(
        "SELECT * FROM usage_reservations WHERE tenant_id = ? AND id = ? FOR UPDATE",
        [tid, rid]
      );
      if (!res) throw fail("Reservation not found", "RESERVATION_NOT_FOUND", 404);
      if (res.status === "consumed") {
        return { success: true, idempotent: true, consumedAmount: Number(res.consumed_amount), releasedAmount: Number(res.released_amount) };
      }
      if (res.status !== "reserved") {
        throw fail(`Reservation cannot be consumed from status '${res.status}'`, "INVALID_RESERVATION_STATE", 409);
      }

      const rate = await loadRateCard(q, res.operation);
      const qty = Math.max(0, Math.round(Number(actualUnits) || 0));
      const est = Number(res.estimated_amount || 0);
      const calculatedCredits = est > 0 ? Math.min(est, qty * Number(rate.credits_per_unit || 1)) : 0;
      const releasedAmount = Math.max(0, est - calculatedCredits);
      const costMinor = actualCostMinor != null ? Math.round(Number(actualCostMinor)) : qty * Number(rate.provider_cost_minor || 0);

      let nextBalance = 0;
      if (res.account_id) {
        const [acct] = await q("SELECT id, balance, reserved_balance FROM wallet_accounts WHERE id = ? FOR UPDATE", [res.account_id]);
        if (acct) {
          const actualDebit = Math.min(Number(acct.balance), calculatedCredits);
          nextBalance = Math.max(0, Number(acct.balance) - actualDebit);
          const nextReserved = Math.max(0, Number(acct.reserved_balance) - est);
          await q(
            "UPDATE wallet_accounts SET balance = ?, reserved_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [nextBalance, nextReserved, acct.id]
          );
          if (actualDebit > 0) {
            await q(
              `INSERT INTO wallet_entries (tenant_id, account_id, entry_type, amount, balance_after, reason, reference_id)
               VALUES (?, ?, 'debit', ?, ?, ?, ?)`,
              [tid, acct.id, actualDebit, nextBalance, `Usage: ${res.operation}`, res.reference_id]
            );
          }
        }
      }

      await q(
        "UPDATE usage_reservations SET status = 'consumed', consumed_amount = ?, released_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [calculatedCredits, releasedAmount, res.id]
      );

      // Canonical usage event
      const sourceType = res.automation_id ? "automation" : res.flow_id ? "flow" : "direct";
      const sourceId = res.automation_id || res.flow_id || null;
      await q(
        `INSERT INTO usage_events (tenant_id, meter_key, quantity, external_event_id, user_id, credit_type, cost_credits, provider_cost_minor, source_type, source_id, run_id, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tid,
          res.operation,
          qty,
          res.reference_id,
          res.user_id || null,
          res.credit_type,
          calculatedCredits,
          costMinor,
          sourceType,
          sourceId,
          res.flow_run_id || null,
          metadata ? JSON.stringify(metadata).slice(0, 2000) : null,
        ]
      );

      // Monthly tenant period counter
      const [tenantRow] = await q("SELECT max_monthly_messages FROM tenants WHERE id = ? LIMIT 1", [tid]);
      const tPeriod = await ensureTenantPeriodLocked(q, tid, tenantRow?.max_monthly_messages);
      const isMsg = ["outbound_message", "campaign_message", "automation_execution"].includes(res.operation);
      await q(
        "UPDATE tenant_usage_periods SET messages_used = ?, ai_credits_used = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [
          Number(tPeriod.messages_used) + (isMsg ? qty : 0),
          Number(tPeriod.ai_credits_used) + (res.credit_type === "ai_credits" ? calculatedCredits : 0),
          tPeriod.id,
        ]
      );

      // Employee daily + monthly attribution (0 = System Automation Agent)
      const deltas = {
        actions: 1,
        aiCredits: res.credit_type === "ai_credits" ? calculatedCredits : 0,
        messages: isMsg ? qty : 0,
        campaigns: res.operation === "campaign_message" ? qty : 0,
        automations: res.automation_id ? 1 : 0,
        flows: res.flow_id ? 1 : 0,
        costMinor,
      };
      await upsertEmployeePeriod(q, tid, res.user_id || 0, dayKey(), deltas);
      await upsertEmployeePeriod(q, tid, res.user_id || 0, monthKey(), deltas);

      if (sourceType !== "direct") {
        await q(
          "INSERT INTO workflow_run_costs (tenant_id, source_type, source_id, run_id, user_id, credits_used, messages_count, provider_cost_minor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [tid, sourceType, sourceId, res.flow_run_id || null, res.user_id || null, calculatedCredits, isMsg ? qty : 0, costMinor]
        );
      }

      if (res.automation_id) {
        await q(
          "UPDATE wa_automations SET credits_consumed = credits_consumed + ?, last_executed_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?",
          [calculatedCredits, tid, res.automation_id]
        ).catch(() => {});
      }

      return {
        success: true,
        idempotent: false,
        consumedAmount: calculatedCredits,
        releasedAmount,
        balanceAfter: nextBalance,
      };
    });
  }

  /**
   * Release reserved credits cleanly without charging when an operation is aborted or fails before execution.
   */
  async function releaseReservation({ reservationId, tenantId }) {
    const tid = Number(tenantId);
    const rid = Number(reservationId);
    if (!Number.isInteger(tid) || tid < 1 || !Number.isInteger(rid) || rid < 1) return { success: false };

    return withTransaction(async (q) => {
      const [res] = await q("SELECT * FROM usage_reservations WHERE tenant_id = ? AND id = ? FOR UPDATE", [tid, rid]);
      if (!res || res.status !== "reserved") return { success: true, idempotent: true };
      const est = Number(res.estimated_amount || 0);
      if (res.account_id && est > 0) {
        const [acct] = await q("SELECT id, reserved_balance FROM wallet_accounts WHERE id = ? FOR UPDATE", [res.account_id]);
        if (acct) {
          await q(
            "UPDATE wallet_accounts SET reserved_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [Math.max(0, Number(acct.reserved_balance) - est), acct.id]
          );
        }
      }
      await q(
        "UPDATE usage_reservations SET status = 'released', released_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [est, res.id]
      );
      return { success: true, releasedAmount: est };
    });
  }

  async function recordMeteredUsage(params, executeWork) {
    const reservation = await reserveCredits(params);
    try {
      const workResult = await executeWork(reservation);
      const actualUnits = typeof workResult?.actualUnits === "number" ? workResult.actualUnits : (params.units || 1);
      await consumeReservation({
        reservationId: reservation.reservationId,
        tenantId: params.tenantId,
        actualUnits,
        actualCostMinor: workResult?.actualCostMinor ?? null,
        metadata: workResult?.metadata ?? null,
      });
      return workResult;
    } catch (err) {
      await releaseReservation({ reservationId: reservation.reservationId, tenantId: params.tenantId }).catch(() => {});
      throw err;
    }
  }

  async function reconcileWalletLedger(tenantId) {
    const tid = Number(tenantId);
    const accounts = await rawQ("SELECT id, credit_type, balance, reserved_balance FROM wallet_accounts WHERE tenant_id = ?", [tid]).catch(() => []);
    const report = [];
    for (const acct of accounts) {
      const [agg] = await rawQ(
        "SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE 0 END), 0) AS credits, COALESCE(SUM(CASE WHEN entry_type='debit' THEN amount ELSE 0 END), 0) AS debits FROM wallet_entries WHERE tenant_id = ? AND account_id = ?",
        [tid, acct.id]
      ).catch(() => [{ credits: 0, debits: 0 }]);
      const net = Number(agg?.credits || 0) - Number(agg?.debits || 0);
      report.push({
        creditType: acct.credit_type,
        storedBalance: Number(acct.balance),
        reservedBalance: Number(acct.reserved_balance),
        ledgerNet: net,
        balanced: Number(acct.balance) === net,
      });
    }
    return report;
  }

  async function getUsageCommandCenterSummary(tenantId) {
    const tid = Number(tenantId);
    const period = monthKey();
    const [periodRow] = await rawQ("SELECT * FROM tenant_usage_periods WHERE tenant_id = ? AND period_key = ? LIMIT 1", [tid, period]).catch(() => []);
    const rateCards = await rawQ("SELECT operation_key, credit_type, credits_per_unit, provider_cost_minor, currency, version FROM usage_rate_cards WHERE is_active = 1 ORDER BY id").catch(() => []);
    const recentLedger = await rawQ(
      "SELECT e.id, e.entry_type, e.amount, e.balance_after, e.reason, e.reference_id, e.created_at, w.credit_type FROM wallet_entries e JOIN wallet_accounts w ON w.id = e.account_id WHERE e.tenant_id = ? ORDER BY e.id DESC LIMIT 50",
      [tid]
    ).catch(() => []);
    const byOperation = await rawQ(
      "SELECT meter_key, COALESCE(SUM(quantity),0) AS total_units, COALESCE(SUM(cost_credits),0) AS total_credits, COALESCE(SUM(provider_cost_minor),0) AS total_cost_minor FROM usage_events WHERE tenant_id = ? GROUP BY meter_key ORDER BY total_units DESC",
      [tid]
    ).catch(() => []);
    const workflowCosts = await rawQ(
      "SELECT source_type, source_id, COUNT(*) AS runs, COALESCE(SUM(credits_used),0) AS credits_used, COALESCE(SUM(messages_count),0) AS messages_count, COALESCE(SUM(provider_cost_minor),0) AS cost_minor FROM workflow_run_costs WHERE tenant_id = ? GROUP BY source_type, source_id ORDER BY credits_used DESC LIMIT 20",
      [tid]
    ).catch(() => []);
    const reconciliation = await reconcileWalletLedger(tid);

    return {
      periodKey: period,
      tenantPeriod: periodRow || { period_key: period, messages_included: 0, messages_used: 0, ai_credits_used: 0 },
      rateCards,
      recentLedger,
      byOperation,
      workflowCosts,
      reconciliation,
    };
  }

  async function getEmployeeUsageReport(tenantId, period = monthKey()) {
    const tid = Number(tenantId);
    const rows = await rawQ(
      `SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.role,
              l.daily_credit_limit, l.monthly_credit_limit, l.daily_message_limit, l.monthly_message_limit,
              COALESCE(l.allow_ai, 1) AS allow_ai, COALESCE(l.allow_campaigns, 1) AS allow_campaigns,
              COALESCE(l.allow_automations, 1) AS allow_automations, COALESCE(l.is_suspended, 0) AS is_suspended,
              COALESCE(s.actions_count, 0) AS actions_count, COALESCE(s.ai_credits_used, 0) AS ai_credits_used,
              COALESCE(s.messages_sent, 0) AS messages_sent, COALESCE(s.campaigns_sent, 0) AS campaigns_sent,
              COALESCE(s.automations_run, 0) AS automations_run, COALESCE(s.flows_run, 0) AS flows_run,
              COALESCE(s.cost_minor, 0) AS cost_minor
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN employee_usage_limits l ON l.tenant_id = m.tenant_id AND l.user_id = u.id
       LEFT JOIN employee_usage_summary s ON s.tenant_id = m.tenant_id AND s.user_id = u.id AND s.period_key = ?
       WHERE m.tenant_id = ? AND m.membership_status = 'active'
       ORDER BY ai_credits_used DESC, u.id ASC LIMIT 200`,
      [period, tid]
    ).catch(() => []);

    const [sysRow] = await rawQ(
      "SELECT actions_count, ai_credits_used, messages_sent, campaigns_sent, automations_run, flows_run, cost_minor FROM employee_usage_summary WHERE tenant_id = ? AND user_id = 0 AND period_key = ? LIMIT 1",
      [tid, period]
    ).catch(() => []);

    const employees = rows.map((r) => ({
      ...r,
      name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || `User #${r.user_id}`,
    }));
    if (sysRow) {
      employees.push({
        user_id: 0,
        name: "System Automation Agent",
        email: "automation@system",
        role: "system",
        allow_ai: 1,
        allow_campaigns: 1,
        allow_automations: 1,
        is_suspended: 0,
        ...sysRow,
      });
    }
    return { periodKey: period, employees };
  }

  async function updateEmployeeUsageLimit(tenantId, targetUserId, input = {}, actorId = null) {
    const tid = Number(tenantId);
    const uid = Number(targetUserId);
    if (!Number.isInteger(uid) || uid < 1) throw fail("Valid employee user ID required", "INVALID_USER", 400);
    const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Math.max(0, Number.parseInt(v, 10) || 0));

    const existing = await rawQ("SELECT id FROM employee_usage_limits WHERE tenant_id = ? AND user_id = ? LIMIT 1", [tid, uid]);
    const values = [
      numOrNull(input.daily_credit_limit),
      numOrNull(input.monthly_credit_limit),
      numOrNull(input.daily_message_limit),
      numOrNull(input.monthly_message_limit),
      input.allow_ai === false || input.allow_ai === 0 ? 0 : 1,
      input.allow_campaigns === false || input.allow_campaigns === 0 ? 0 : 1,
      input.allow_automations === false || input.allow_automations === 0 ? 0 : 1,
      input.is_suspended === true || input.is_suspended === 1 ? 1 : 0,
      actorId || null,
    ];
    if (existing.length) {
      await rawQ(
        "UPDATE employee_usage_limits SET daily_credit_limit=?,monthly_credit_limit=?,daily_message_limit=?,monthly_message_limit=?,allow_ai=?,allow_campaigns=?,allow_automations=?,is_suspended=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND user_id=?",
        [...values, tid, uid]
      );
    } else {
      await rawQ(
        "INSERT INTO employee_usage_limits (tenant_id,user_id,daily_credit_limit,monthly_credit_limit,daily_message_limit,monthly_message_limit,allow_ai,allow_campaigns,allow_automations,is_suspended,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [tid, uid, ...values]
      );
    }
    return { success: true };
  }

  return {
    grantCreditsTransactional,
    reserveCredits,
    consumeReservation,
    releaseReservation,
    recordMeteredUsage,
    reconcileWalletLedger,
    getUsageCommandCenterSummary,
    getEmployeeUsageReport,
    updateEmployeeUsageLimit,
  };
}

const defaultMeter = createMeter();
module.exports = {
  createMeter,
  FALLBACK_RATES,
  ...defaultMeter,
};
