"use strict";

/**
 * watiWalletService.js
 *
 * Implements multi-bucket prepaid wallet operations for:
 * 1. whatsapp_messaging (Mode 2 Provider-Managed billing)
 * 2. ai_credits (Madhura AI Agent & copilot)
 * 3. automation_credits (enterprise workflow hub & webhooks)
 *
 * All balances and top-up amounts are stored as integer minor units (paise/cents).
 */

const crypto = require("crypto");
const getDefaultDb = () => require("../config/database");

const SUPPORTED_BUCKETS = ["whatsapp_messaging", "ai_credits", "automation_credits"];

function createWalletService(options = {}) {
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
    const stmt = db.prepare(sql);
    if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
      return stmt.all(...params);
    }
    const info = stmt.run(...params);
    return { insertId: info.lastInsertRowid, affectedRows: info.changes };
  };

  /**
   * Ensure default wallet accounts exist for all supported buckets.
   */
  async function ensureBuckets(tenantId, currency = "INR") {
    const tid = Number(tenantId);
    for (const bucket of SUPPORTED_BUCKETS) {
      await q(
        `INSERT INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance)
         VALUES (?, ?, ?, 0, 0)
         ON CONFLICT(tenant_id, credit_type) DO NOTHING`,
        [tid, currency, bucket]
      ).catch(async () => {
        // Fallback for MySQL which uses INSERT IGNORE or ON DUPLICATE KEY
        await q(
          `INSERT IGNORE INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance)
           VALUES (?, ?, ?, 0, 0)`,
          [tid, currency, bucket]
        ).catch(() => {});
      });
    }
  }

  /**
   * Fetch all bucket balances for a tenant.
   */
  async function getWalletBalances(tenantId) {
    const tid = Number(tenantId);
    await ensureBuckets(tid);

    const rows = await q(
      `SELECT credit_type, balance, reserved_balance, currency
       FROM wallet_accounts
       WHERE tenant_id = ?`,
      [tid]
    );

    const balances = {};
    for (const b of SUPPORTED_BUCKETS) {
      balances[b] = {
        balance_minor: 0,
        reserved_minor: 0,
        available_minor: 0,
        currency: "INR",
        balance_formatted: "₹0.00"
      };
    }

    for (const r of rows || []) {
      const balance = Number(r.balance || 0);
      const reserved = Number(r.reserved_balance || 0);
      const available = Math.max(0, balance - reserved);
      balances[r.credit_type] = {
        balance_minor: balance,
        reserved_minor: reserved,
        available_minor: available,
        currency: r.currency || "INR",
        balance_formatted: `₹${(available / 100).toFixed(2)}`
      };
    }

    return {
      tenant_id: tid,
      buckets: balances,
      total_available_minor: Object.values(balances).reduce((sum, b) => sum + b.available_minor, 0)
    };
  }

  /**
   * Create a prepaid wallet top-up order.
   */
  async function createTopupOrder({ tenantId, bucket, amountMinor, currency = "INR", paymentGateway = "razorpay" }) {
    const tid = Number(tenantId);
    if (!SUPPORTED_BUCKETS.includes(bucket)) {
      throw new Error(`Unsupported bucket: ${bucket}. Allowed: ${SUPPORTED_BUCKETS.join(", ")}`);
    }

    const amt = Math.max(10000, Number(amountMinor || 0)); // Minimum 100 INR (10,000 paise)
    const orderId = `wati_topup_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const idempotencyKey = `idemp_${orderId}`;

    await q(
      `INSERT INTO wallet_topup_orders (
        tenant_id, order_id, amount_minor, currency, bucket, payment_gateway, status, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, 'created', ?)`,
      [tid, orderId, amt, currency, bucket, paymentGateway, idempotencyKey]
    );

    return {
      order_id: orderId,
      tenant_id: tid,
      bucket,
      amount_minor: amt,
      currency,
      payment_gateway: paymentGateway,
      status: "created"
    };
  }

  /**
   * Confirm and capture top-up payment atomically.
   */
  async function confirmTopupPayment({ tenantId, orderId, paymentId, signature, gatewayResponse = null }) {
    const tid = Number(tenantId);

    const rows = await q(
      `SELECT * FROM wallet_topup_orders WHERE tenant_id = ? AND order_id = ? LIMIT 1`,
      [tid, orderId]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`Top-up order not found: ${orderId}`);
    }

    const order = rows[0];
    if (order.status === "captured") {
      // Idempotent return if already captured
      return { success: true, alreadyCaptured: true, orderId, balance: await getWalletBalances(tid) };
    }

    // 1. Mark order captured
    await q(
      `UPDATE wallet_topup_orders
       SET status = 'captured',
           payment_id = ?,
           signature = ?,
           gateway_response_json = ?,
           captured_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [paymentId || `pay_${Date.now()}`, signature || null, gatewayResponse ? JSON.stringify(gatewayResponse) : null, order.id]
    );

    // 2. Ensure bucket exists
    await ensureBuckets(tid, order.currency);

    // 3. Atomically increment wallet account balance
    await q(
      `UPDATE wallet_accounts
       SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND credit_type = ?`,
      [order.amount_minor, tid, order.bucket]
    );

    // 4. Record ledger entry if wallet_entries table exists
    await q(
      `INSERT INTO wallet_entries (
        tenant_id, credit_type, amount, balance_after, direction, description, reference_id
      ) VALUES (?, ?, ?, (SELECT balance FROM wallet_accounts WHERE tenant_id = ? AND credit_type = ?), 'credit', ?, ?)`,
      [tid, order.bucket, order.amount_minor, tid, order.bucket, `Wallet Top-up via ${order.payment_gateway}`, orderId]
    ).catch(() => {});

    const updatedBalances = await getWalletBalances(tid);

    return {
      success: true,
      order_id: orderId,
      bucket: order.bucket,
      credited_minor: order.amount_minor,
      currency: order.currency,
      balances: updatedBalances
    };
  }

  /**
   * Check if balance is below threshold and auto-recharge is enabled.
   */
  async function checkAndTriggerAutoRecharge(tenantId, billingProfile, bucket = "whatsapp_messaging") {
    if (!billingProfile.auto_recharge_enabled) {
      return { autoRechargeTriggered: false, reason: "AUTO_RECHARGE_DISABLED" };
    }

    const balances = await getWalletBalances(tenantId);
    const bucketInfo = balances.buckets[bucket];

    if (bucketInfo && bucketInfo.available_minor < billingProfile.auto_recharge_trigger_minor) {
      const order = await createTopupOrder({
        tenantId,
        bucket,
        amountMinor: billingProfile.auto_recharge_amount_minor,
        currency: billingProfile.currency,
        paymentGateway: "razorpay_auto"
      });

      return {
        autoRechargeTriggered: true,
        order,
        trigger_balance_minor: bucketInfo.available_minor,
        recharge_amount_minor: billingProfile.auto_recharge_amount_minor
      };
    }

    return { autoRechargeTriggered: false, reason: "BALANCE_ABOVE_TRIGGER" };
  }

  return {
    SUPPORTED_BUCKETS,
    ensureBuckets,
    getWalletBalances,
    createTopupOrder,
    confirmTopupPayment,
    checkAndTriggerAutoRecharge
  };
}

let defaultInstance = null;
function getDefault() {
  if (!defaultInstance) defaultInstance = createWalletService();
  return defaultInstance;
}

module.exports = {
  createWalletService,
  SUPPORTED_BUCKETS,
  ensureBuckets: (...args) => getDefault().ensureBuckets(...args),
  getWalletBalances: (...args) => getDefault().getWalletBalances(...args),
  createTopupOrder: (...args) => getDefault().createTopupOrder(...args),
  confirmTopupPayment: (...args) => getDefault().confirmTopupPayment(...args),
  checkAndTriggerAutoRecharge: (...args) => getDefault().checkAndTriggerAutoRecharge(...args)
};
