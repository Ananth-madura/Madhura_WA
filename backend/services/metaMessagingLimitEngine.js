"use strict";

/**
 * metaMessagingLimitEngine.js
 *
 * Implements Meta Messaging Limit tracking, 24-hour rolling unique recipient
 * enforcement, and limit-aware dispatch protection.
 *
 * Key Meta Architecture Rules:
 * 1. Messaging limits apply to the WABA/Business Portfolio and are shared across
 *    all phone numbers owned by that portfolio.
 * 2. 24-hour rolling window counts unique recipients contacted outside the 24-hour
 *    customer service window.
 * 3. Re-messaging the same contact within 24 hours does not consume another limit slot.
 */

const crypto = require("crypto");
const getDefaultDb = () => require("../config/database");

const TIER_CAPACITIES = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: 10000000
};

function createLimitEngine(options = {}) {
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

  function hashPhone(phone) {
    const cleaned = String(phone || "").replace(/[^0-9]/g, "");
    return crypto.createHash("sha256").update(cleaned).digest("hex");
  }

  /**
   * Fetch or initialize messaging limit status for an account.
   */
  async function getMessagingLimit(tenantId, accountId = null) {
    const tid = Number(tenantId);
    let rows;

    if (accountId) {
      rows = await q(
        "SELECT * FROM meta_messaging_limits WHERE tenant_id = ? AND account_id = ? LIMIT 1",
        [tid, accountId]
      );
    } else {
      rows = await q(
        "SELECT * FROM meta_messaging_limits WHERE tenant_id = ? ORDER BY id ASC LIMIT 1",
        [tid]
      );
    }

    if (!rows || rows.length === 0) {
      // Default to TIER_250 for new onboarding
      const defaultTier = "TIER_250";
      const maxDaily = TIER_CAPACITIES[defaultTier];
      await q(
        `INSERT INTO meta_messaging_limits (
          tenant_id, account_id, tier, max_daily_recipients, used_daily_recipients,
          rolling_window_hours, status
        ) VALUES (?, ?, ?, ?, 0, 24, 'active')`,
        [tid, accountId || null, defaultTier, maxDaily]
      );

      rows = await q(
        "SELECT * FROM meta_messaging_limits WHERE tenant_id = ? ORDER BY id DESC LIMIT 1",
        [tid]
      );
    }

    const limitRecord = rows[0];

    // Compute live active unique recipients from rolling window
    const nowIso = new Date().toISOString().replace("T", " ").substring(0, 19);
    const countRows = await q(
      `SELECT COUNT(DISTINCT phone_hash) as active_recipients
       FROM meta_recipient_window
       WHERE tenant_id = ? AND window_expires_at > ? AND is_service_window = 0`,
      [tid, nowIso]
    );

    const activeRecipients = Number(countRows[0]?.active_recipients || 0);
    const maxRecipients = Number(limitRecord.max_daily_recipients || 250);
    const remaining = Math.max(0, maxRecipients - activeRecipients);
    const percentUsed = maxRecipients > 0 ? Math.min(100, (activeRecipients / maxRecipients) * 100) : 0;

    return {
      tenant_id: tid,
      account_id: limitRecord.account_id,
      tier: limitRecord.tier,
      max_daily_recipients: maxRecipients,
      used_daily_recipients: activeRecipients,
      remaining_daily_recipients: remaining,
      percent_used: Math.round(percentUsed * 100) / 100,
      rolling_window_hours: limitRecord.rolling_window_hours,
      status: limitRecord.status,
      limit_reached: remaining <= 0,
      is_shared_across_all_senders: true
    };
  }

  /**
   * Pre-flight dispatch verification: checks whether dispatching to recipient is permitted.
   */
  async function canDispatch({ tenantId, accountId, recipientPhone, isCustomerInitiated = false }) {
    if (isCustomerInitiated) {
      return { allowed: true, reason: "CUSTOMER_SERVICE_WINDOW" };
    }

    const tid = Number(tenantId);
    const phoneHash = hashPhone(recipientPhone);
    const nowIso = new Date().toISOString().replace("T", " ").substring(0, 19);

    // 1. Check if recipient is already inside an active 24-hour window
    const existing = await q(
      `SELECT * FROM meta_recipient_window
       WHERE tenant_id = ? AND phone_hash = ? AND window_expires_at > ? LIMIT 1`,
      [tid, phoneHash, nowIso]
    );

    if (existing && existing.length > 0) {
      // Already counted against the 24-hour window
      return {
        allowed: true,
        reason: "RECIPIENT_ALREADY_IN_ACTIVE_WINDOW",
        already_counted: true
      };
    }

    // 2. Not in active window, check daily limit capacity
    const limitInfo = await getMessagingLimit(tid, accountId);
    if (limitInfo.used_daily_recipients >= limitInfo.max_daily_recipients) {
      return {
        allowed: false,
        reason: "MESSAGING_LIMIT_REACHED",
        tier: limitInfo.tier,
        max_daily_recipients: limitInfo.max_daily_recipients,
        used_daily_recipients: limitInfo.used_daily_recipients,
        remaining_daily_recipients: 0
      };
    }

    return {
      allowed: true,
      reason: "WITHIN_LIMIT",
      used_daily_recipients: limitInfo.used_daily_recipients,
      max_daily_recipients: limitInfo.max_daily_recipients,
      remaining_daily_recipients: limitInfo.remaining_daily_recipients
    };
  }

  /**
   * Record dispatch: adds recipient to rolling 24-hour window.
   */
  async function recordDispatch({ tenantId, accountId, recipientPhone, isCustomerInitiated = false }) {
    const tid = Number(tenantId);
    const phoneHash = hashPhone(recipientPhone);

    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const expiresIso = expires.toISOString().replace("T", " ").substring(0, 19);

    // Insert or update rolling window
    await q(
      `INSERT INTO meta_recipient_window (
        tenant_id, account_id, phone_hash, first_contact_at, window_expires_at, is_service_window
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      [tid, accountId || null, phoneHash, expiresIso, isCustomerInitiated ? 1 : 0]
    ).catch(async () => {
      // In case of conflict, extend expiry
      await q(
        `UPDATE meta_recipient_window
         SET window_expires_at = ?, is_service_window = ?
         WHERE tenant_id = ? AND phone_hash = ?`,
        [expiresIso, isCustomerInitiated ? 1 : 0, tid, phoneHash]
      );
    });

    // Update cached limit record
    const limitInfo = await getMessagingLimit(tid, accountId);
    await q(
      `UPDATE meta_messaging_limits
       SET used_daily_recipients = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ?`,
      [limitInfo.used_daily_recipients, tid]
    );

    return limitInfo;
  }

  /**
   * Sync limit tier from Meta Graph API response or manual upgrade.
   */
  async function syncLimitsFromMeta(tenantId, accountId, tierName) {
    const tid = Number(tenantId);
    const normalizedTier = tierName && TIER_CAPACITIES[tierName] ? tierName : "TIER_1K";
    const maxCapacity = TIER_CAPACITIES[normalizedTier];

    await getMessagingLimit(tid, accountId); // Ensure record exists
    await q(
      `UPDATE meta_messaging_limits
       SET tier = ?, max_daily_recipients = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ?`,
      [normalizedTier, maxCapacity, tid]
    );

    return getMessagingLimit(tid, accountId);
  }

  /**
   * Purge expired rolling window entries.
   */
  async function cleanExpiredWindows() {
    const nowIso = new Date().toISOString().replace("T", " ").substring(0, 19);
    return q("DELETE FROM meta_recipient_window WHERE window_expires_at <= ?", [nowIso]);
  }

  return {
    TIER_CAPACITIES,
    getMessagingLimit,
    canDispatch,
    recordDispatch,
    syncLimitsFromMeta,
    cleanExpiredWindows
  };
}

let defaultInstance = null;
function getDefault() {
  if (!defaultInstance) defaultInstance = createLimitEngine();
  return defaultInstance;
}

module.exports = {
  createLimitEngine,
  TIER_CAPACITIES,
  getMessagingLimit: (...args) => getDefault().getMessagingLimit(...args),
  canDispatch: (...args) => getDefault().canDispatch(...args),
  recordDispatch: (...args) => getDefault().recordDispatch(...args),
  syncLimitsFromMeta: (...args) => getDefault().syncLimitsFromMeta(...args),
  cleanExpiredWindows: (...args) => getDefault().cleanExpiredWindows(...args)
};
