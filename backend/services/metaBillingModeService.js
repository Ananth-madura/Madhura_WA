"use strict";

/**
 * metaBillingModeService.js
 *
 * Implements WATI-style Dual Billing Architecture:
 * - Mode 1: Direct Meta Billing (Customer pays Meta directly for message charges).
 * - Mode 2: Provider-Managed Billing (Shared credit line, Madhura wallet deduction).
 *
 * All financial amounts are stored as integer minor units (paise/cents).
 */

const getDefaultDb = () => require("../config/database");

function createBillingModeService(options = {}) {
  const db = options.db || getDefaultDb();

  const q = async (sql, params = []) => {
    if (db.promise) {
      const [rows] = await db.promise().query(sql, params);
      return rows;
    }
    if (typeof db.query === "function") {
      return new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    }
    // SQLite sync wrapper
    const stmt = db.prepare(sql);
    if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
      return stmt.all(...params);
    }
    const info = stmt.run(...params);
    return { insertId: info.lastInsertRowid, affectedRows: info.changes };
  };

  /**
   * Fetch or initialize tenant billing profile.
   */
  async function getBillingProfile(tenantId) {
    const tid = Number(tenantId);
    let rows = await q("SELECT * FROM tenant_billing_profiles WHERE tenant_id = ? LIMIT 1", [tid]);

    if (!rows || rows.length === 0) {
      const defaultThresholds = JSON.stringify([50, 25, 10]);
      await q(
        `INSERT INTO tenant_billing_profiles (
          tenant_id, billing_mode, currency, meta_payment_method_status,
          meta_account_status, credit_line_status, auto_recharge_enabled,
          auto_recharge_trigger_minor, auto_recharge_amount_minor,
          monthly_spending_limit_minor, low_balance_alert_thresholds_json
        ) VALUES (?, 'direct_meta', 'INR', 'not_configured', 'active', 'none', 0, 50000, 200000, 10000000, ?)`,
        [tid, defaultThresholds]
      );
      rows = await q("SELECT * FROM tenant_billing_profiles WHERE tenant_id = ? LIMIT 1", [tid]);
    }

    const profile = rows[0];
    let alertThresholds = [50, 25, 10];
    try {
      if (typeof profile.low_balance_alert_thresholds_json === "string") {
        alertThresholds = JSON.parse(profile.low_balance_alert_thresholds_json);
      }
    } catch {
      alertThresholds = [50, 25, 10];
    }

    return {
      ...profile,
      low_balance_alert_thresholds: alertThresholds,
      is_direct_meta: profile.billing_mode === "direct_meta",
      is_provider_managed: profile.billing_mode === "provider_managed"
    };
  }

  /**
   * Switch billing mode between direct_meta and provider_managed.
   */
  async function updateBillingMode(tenantId, newMode, options = {}) {
    const tid = Number(tenantId);
    if (!["direct_meta", "provider_managed"].includes(newMode)) {
      throw new Error("Invalid billing mode. Must be 'direct_meta' or 'provider_managed'.");
    }

    const current = await getBillingProfile(tid);

    // If switching to provider_managed, verify credit line eligibility or grant
    let creditLineStatus = current.credit_line_status;
    if (newMode === "provider_managed") {
      creditLineStatus = options.creditLineStatus || (creditLineStatus === "none" ? "partner_credit_line_active" : creditLineStatus);
    }

    await q(
      `UPDATE tenant_billing_profiles
       SET billing_mode = ?, credit_line_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ?`,
      [newMode, creditLineStatus, tid]
    );

    return getBillingProfile(tid);
  }

  /**
   * Update Meta payment method verification status for direct Meta billing.
   */
  async function updateMetaPaymentStatus(tenantId, status) {
    const tid = Number(tenantId);
    const validStatuses = ["not_configured", "valid", "missing", "expired", "pending"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid payment method status: ${status}`);
    }

    await getBillingProfile(tid); // Ensure profile exists
    await q(
      `UPDATE tenant_billing_profiles
       SET meta_payment_method_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ?`,
      [status, tid]
    );

    return getBillingProfile(tid);
  }

  /**
   * Update spending limits and auto-recharge settings.
   */
  async function updateSpendingLimits(tenantId, updates = {}) {
    const tid = Number(tenantId);
    await getBillingProfile(tid);

    const clauses = [];
    const params = [];

    if (updates.monthly_spending_limit_minor !== undefined) {
      clauses.push("monthly_spending_limit_minor = ?");
      params.push(Math.max(0, Number(updates.monthly_spending_limit_minor)));
    }
    if (updates.auto_recharge_enabled !== undefined) {
      clauses.push("auto_recharge_enabled = ?");
      params.push(updates.auto_recharge_enabled ? 1 : 0);
    }
    if (updates.auto_recharge_trigger_minor !== undefined) {
      clauses.push("auto_recharge_trigger_minor = ?");
      params.push(Math.max(0, Number(updates.auto_recharge_trigger_minor)));
    }
    if (updates.auto_recharge_amount_minor !== undefined) {
      clauses.push("auto_recharge_amount_minor = ?");
      params.push(Math.max(0, Number(updates.auto_recharge_amount_minor)));
    }
    if (updates.low_balance_alert_thresholds) {
      clauses.push("low_balance_alert_thresholds_json = ?");
      params.push(JSON.stringify(updates.low_balance_alert_thresholds));
    }

    if (clauses.length > 0) {
      clauses.push("updated_at = CURRENT_TIMESTAMP");
      params.push(tid);
      await q(`UPDATE tenant_billing_profiles SET ${clauses.join(", ")} WHERE tenant_id = ?`, params);
    }

    return getBillingProfile(tid);
  }

  /**
   * Calculate current month spend vs monthly spending cap.
   */
  async function getSpendingSummary(tenantId) {
    const tid = Number(tenantId);
    const profile = await getBillingProfile(tid);

    // Sum all delivered/sent messages in current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const rows = await q(
      `SELECT COALESCE(SUM(cost_minor), 0) as total_spent, COUNT(id) as total_messages
       FROM message_billing_records
       WHERE tenant_id = ?
         AND status IN ('delivered', 'sent', 'reserved', 'submitting')
         AND created_at >= ?`,
      [tid, startOfMonth.toISOString().replace("T", " ").substring(0, 19)]
    );

    const totalSpent = Number(rows[0]?.total_spent || 0);
    const messageCount = Number(rows[0]?.total_messages || 0);
    const limit = profile.monthly_spending_limit_minor;
    const remaining = Math.max(0, limit - totalSpent);
    const percentUsed = limit > 0 ? Math.min(100, (totalSpent / limit) * 100) : 0;

    let alertLevel = "ok";
    if (percentUsed >= 100) alertLevel = "exceeded";
    else if (percentUsed >= 90) alertLevel = "critical_10";
    else if (percentUsed >= 75) alertLevel = "warning_25";
    else if (percentUsed >= 50) alertLevel = "warning_50";

    return {
      tenant_id: tid,
      billing_mode: profile.billing_mode,
      currency: profile.currency,
      monthly_spending_limit_minor: limit,
      monthly_spent_minor: totalSpent,
      monthly_remaining_minor: remaining,
      percent_used: Math.round(percentUsed * 100) / 100,
      total_messages_this_month: messageCount,
      alert_level: alertLevel,
      spending_cap_reached: totalSpent >= limit,
      meta_payment_method_status: profile.meta_payment_method_status
    };
  }

  return {
    getBillingProfile,
    updateBillingMode,
    updateMetaPaymentStatus,
    updateSpendingLimits,
    getSpendingSummary
  };
}

let defaultInstance = null;
function getDefault() {
  if (!defaultInstance) defaultInstance = createBillingModeService();
  return defaultInstance;
}

module.exports = {
  createBillingModeService,
  getBillingProfile: (...args) => getDefault().getBillingProfile(...args),
  updateBillingMode: (...args) => getDefault().updateBillingMode(...args),
  updateMetaPaymentStatus: (...args) => getDefault().updateMetaPaymentStatus(...args),
  updateSpendingLimits: (...args) => getDefault().updateSpendingLimits(...args),
  getSpendingSummary: (...args) => getDefault().getSpendingSummary(...args)
};
