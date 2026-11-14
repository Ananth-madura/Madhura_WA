"use strict";

/**
 * metaMessagePricingEngine.js
 *
 * Implements country-aware, category-based rate cards and the full
 * message billing lifecycle (reservation, delivery settlement, and failure release).
 *
 * Features:
 * - Real-time country detection from E.164 phone numbers.
 * - Dynamic category pricing: marketing, utility, authentication, service.
 * - October 1, 2026 Meta policy: first 1,000 service messages per business phone number
 *   per calendar month are free, billable from 1,001st onward.
 * - Integer minor units (paise/cents) prevent floating-point inaccuracies.
 */

const getDefaultDb = () => require("../config/database");

function createPricingEngine(options = {}) {
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
   * Resolve ISO 3166-1 alpha-2 country code from recipient phone number.
   */
  function resolveCountryFromPhone(phone) {
    if (!phone) return "ROW";
    const cleaned = String(phone).replace(/[^0-9]/g, "");

    // India (+91)
    if (cleaned.startsWith("91") && cleaned.length >= 12) return "IN";
    // United States / Canada (+1)
    if (cleaned.startsWith("1") && cleaned.length === 11) return "US";
    // United Arab Emirates (+971)
    if (cleaned.startsWith("971")) return "AE";
    // United Kingdom (+44)
    if (cleaned.startsWith("44")) return "GB";
    // Brazil (+55)
    if (cleaned.startsWith("55")) return "BR";
    // Indonesia (+62)
    if (cleaned.startsWith("62")) return "ID";

    return "ROW";
  }

  /**
   * Get active rate card for country and message category.
   */
  async function getRateCard(countryCode, category) {
    const validCategories = ["marketing", "utility", "authentication", "service"];
    const cat = validCategories.includes(category) ? category : "service";
    const code = countryCode ? countryCode.toUpperCase() : "ROW";

    // 1. Try specific country
    let rows = await q(
      `SELECT country_code, country_name, category, rate_minor, currency, version
       FROM pricing_rate_cards
       WHERE country_code = ? AND category = ? AND is_active = 1
       ORDER BY version DESC LIMIT 1`,
      [code, cat]
    );

    // 2. Fallback to ROW (Rest of World)
    if (!rows || rows.length === 0) {
      rows = await q(
        `SELECT country_code, country_name, category, rate_minor, currency, version
         FROM pricing_rate_cards
         WHERE country_code = 'ROW' AND category = ? AND is_active = 1
         ORDER BY version DESC LIMIT 1`,
        [cat]
      );
    }

    if (rows && rows.length > 0) {
      return rows[0];
    }

    // Default emergency fallback if table is empty
    const fallbackRates = {
      marketing: 350,
      utility: 200,
      authentication: 150,
      service: 120
    };
    return {
      country_code: code,
      country_name: code === "IN" ? "India" : "International",
      category: cat,
      rate_minor: fallbackRates[cat] || 150,
      currency: "INR",
      version: 1
    };
  }

  /**
   * List all active rate cards grouped by country and category.
   */
  async function listRateCards() {
    const rows = await q(
      `SELECT id, country_code, country_name, category, rate_minor, currency, version, effective_from
       FROM pricing_rate_cards
       WHERE is_active = 1
       ORDER BY country_code ASC, category ASC`
    );
    return rows;
  }

  /**
   * Current calendar month format: YYYY-MM
   */
  function getCurrentBillingMonth() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  /**
   * Get service message free allowance tracking for a phone number.
   * Under October 1, 2026 Meta policy: first 1,000 service messages are free.
   */
  async function getServiceAllowance(tenantId, phoneNumberId, month = null) {
    const tid = Number(tenantId);
    const billingMonth = month || getCurrentBillingMonth();
    const phoneId = String(phoneNumberId || "default");

    let rows = await q(
      `SELECT * FROM service_message_allowances
       WHERE tenant_id = ? AND phone_number_id = ? AND billing_month = ? LIMIT 1`,
      [tid, phoneId, billingMonth]
    );

    if (!rows || rows.length === 0) {
      await q(
        `INSERT INTO service_message_allowances
         (tenant_id, phone_number_id, billing_month, used_service_messages, free_allowance_limit)
         VALUES (?, ?, ?, 0, 1000)`,
        [tid, phoneId, billingMonth]
      ).catch(() => {});

      rows = await q(
        `SELECT * FROM service_message_allowances
         WHERE tenant_id = ? AND phone_number_id = ? AND billing_month = ? LIMIT 1`,
        [tid, phoneId, billingMonth]
      );
    }

    const record = rows && rows.length > 0 ? rows[0] : { used_service_messages: 0, free_allowance_limit: 1000 };
    const used = Number(record.used_service_messages || 0);
    const limit = Number(record.free_allowance_limit || 1000);
    const remaining = Math.max(0, limit - used);

    return {
      tenant_id: tid,
      phone_number_id: phoneId,
      billing_month: billingMonth,
      used_service_messages: used,
      free_allowance_limit: limit,
      remaining_free_allowance: remaining,
      has_free_allowance: remaining > 0
    };
  }

  /**
   * Calculate exact message cost based on country, category, and free allowances.
   */
  async function calculateMessageCost({ tenantId, phoneNumberId, recipientPhone, category }) {
    const countryCode = resolveCountryFromPhone(recipientPhone);
    const cat = category || "service";
    const rateCard = await getRateCard(countryCode, cat);

    let finalRateMinor = rateCard.rate_minor;
    let isFreeAllowance = 0;
    let allowanceRemaining = 0;

    // Apply Meta October 1, 2026 policy: 1,000 monthly free service messages per phone number
    if (cat === "service") {
      const allowance = await getServiceAllowance(tenantId, phoneNumberId);
      allowanceRemaining = allowance.remaining_free_allowance;
      if (allowance.has_free_allowance) {
        finalRateMinor = 0;
        isFreeAllowance = 1;
      }
    }

    return {
      country_code: countryCode,
      country_name: rateCard.country_name,
      category: cat,
      base_rate_minor: rateCard.rate_minor,
      rate_minor: finalRateMinor,
      currency: rateCard.currency,
      is_free_allowance: isFreeAllowance,
      free_allowance_remaining: allowanceRemaining,
      rate_card_version: rateCard.version
    };
  }

  /**
   * Reserve message cost prior to sending (creates message_billing_records with status 'reserved').
   */
  async function reserveMessageCost({
    tenantId,
    accountId,
    phoneNumberId,
    recipientPhone,
    category,
    messageId,
    campaignId,
    billingMode = "direct_meta"
  }) {
    const tid = Number(tenantId);
    const calculation = await calculateMessageCost({
      tenantId: tid,
      phoneNumberId,
      recipientPhone,
      category
    });

    const msgId = String(messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

    // Record the message billing transaction
    await q(
      `INSERT INTO message_billing_records (
        tenant_id, account_id, phone_number_id, message_id, campaign_id,
        category, country_code, base_rate_minor, cost_minor, currency,
        is_free_allowance, status, billed_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reserved', ?)`,
      [
        tid,
        accountId || null,
        phoneNumberId || null,
        msgId,
        campaignId || null,
        calculation.category,
        calculation.country_code,
        calculation.base_rate_minor,
        calculation.rate_minor,
        calculation.currency,
        calculation.is_free_allowance,
        billingMode === "provider_managed" ? "provider_wallet" : "direct_meta"
      ]
    );

    return {
      message_id: msgId,
      status: "reserved",
      cost_minor: calculation.rate_minor,
      currency: calculation.currency,
      is_free_allowance: calculation.is_free_allowance,
      country_code: calculation.country_code,
      category: calculation.category
    };
  }

  /**
   * Settle message cost upon successful delivery receipt.
   */
  async function settleDeliveredMessage({ tenantId, messageId, metaMessageId }) {
    const tid = Number(tenantId);
    const rows = await q(
      `SELECT * FROM message_billing_records
       WHERE tenant_id = ? AND (message_id = ? OR meta_message_id = ?) LIMIT 1`,
      [tid, messageId, metaMessageId || messageId]
    );

    if (!rows || rows.length === 0) {
      return { settled: false, reason: "RECORD_NOT_FOUND" };
    }

    const record = rows[0];
    if (record.status === "delivered") {
      return { settled: true, alreadySettled: true, record };
    }

    // Update status to delivered
    await q(
      `UPDATE message_billing_records
       SET status = 'delivered',
           meta_message_id = COALESCE(?, meta_message_id),
           settled_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [metaMessageId || null, record.id]
    );

    // If this was a free service message, increment the usage count
    if (record.category === "service" && record.is_free_allowance === 1) {
      const billingMonth = getCurrentBillingMonth();
      await q(
        `UPDATE service_message_allowances
         SET used_service_messages = used_service_messages + 1, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND phone_number_id = ? AND billing_month = ?`,
        [tid, record.phone_number_id || "default", billingMonth]
      );
    }

    return {
      settled: true,
      message_id: record.message_id,
      cost_minor: record.cost_minor,
      currency: record.currency,
      is_free_allowance: record.is_free_allowance
    };
  }

  /**
   * Release reserved funds if message delivery fails or is cancelled.
   */
  async function releaseFailedMessage({ tenantId, messageId, metaMessageId, failureReason }) {
    const tid = Number(tenantId);
    const rows = await q(
      `SELECT * FROM message_billing_records
       WHERE tenant_id = ? AND (message_id = ? OR meta_message_id = ?) LIMIT 1`,
      [tid, messageId, metaMessageId || messageId]
    );

    if (!rows || rows.length === 0) {
      return { released: false, reason: "RECORD_NOT_FOUND" };
    }

    const record = rows[0];
    if (["failed", "undelivered", "cancelled"].includes(record.status)) {
      return { released: true, alreadyReleased: true };
    }

    await q(
      `UPDATE message_billing_records
       SET status = 'failed',
           failure_reason = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [failureReason || "DELIVERY_FAILED", record.id]
    );

    return {
      released: true,
      message_id: record.message_id,
      cost_minor: record.cost_minor,
      refunded: record.billed_to === "provider_wallet" && record.cost_minor > 0
    };
  }

  return {
    resolveCountryFromPhone,
    getRateCard,
    listRateCards,
    getServiceAllowance,
    calculateMessageCost,
    reserveMessageCost,
    settleDeliveredMessage,
    releaseFailedMessage
  };
}

let defaultInstance = null;
function getDefault() {
  if (!defaultInstance) defaultInstance = createPricingEngine();
  return defaultInstance;
}

module.exports = {
  createPricingEngine,
  resolveCountryFromPhone: (...args) => getDefault().resolveCountryFromPhone(...args),
  getRateCard: (...args) => getDefault().getRateCard(...args),
  listRateCards: (...args) => getDefault().listRateCards(...args),
  getServiceAllowance: (...args) => getDefault().getServiceAllowance(...args),
  calculateMessageCost: (...args) => getDefault().calculateMessageCost(...args),
  reserveMessageCost: (...args) => getDefault().reserveMessageCost(...args),
  settleDeliveredMessage: (...args) => getDefault().settleDeliveredMessage(...args),
  releaseFailedMessage: (...args) => getDefault().releaseFailedMessage(...args)
};
