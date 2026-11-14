"use strict";

/**
 * wati_billing_and_limits.js
 *
 * Additive schema migration for:
 * 1. Dual Billing Architecture (tenant_billing_profiles: direct_meta vs provider_managed).
 * 2. Meta Message Pricing Engine (pricing_rate_cards with effective dates, category rates, and free allowances).
 * 3. Meta Messaging Limit Engine (meta_messaging_limits & 24h rolling meta_recipient_window).
 * 4. Message Billing Records & Service Message Allowances (Oct 1, 2026 1,000 free service messages/number/month).
 * 5. Multi-Bucket Wallet Top-up Orders (wallet_topup_orders).
 *
 * Fully idempotent and compatible with both MySQL and SQLite.
 */

async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const pk = db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY";

  const tables = [
    `CREATE TABLE IF NOT EXISTS tenant_billing_profiles (
      id ${pk},
      tenant_id INT NOT NULL,
      billing_mode VARCHAR(40) NOT NULL DEFAULT 'direct_meta',
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      meta_payment_method_status VARCHAR(40) NOT NULL DEFAULT 'not_configured',
      meta_account_status VARCHAR(40) NOT NULL DEFAULT 'active',
      credit_line_status VARCHAR(40) NOT NULL DEFAULT 'none',
      auto_recharge_enabled TINYINT NOT NULL DEFAULT 0,
      auto_recharge_trigger_minor INT NOT NULL DEFAULT 50000,
      auto_recharge_amount_minor INT NOT NULL DEFAULT 200000,
      monthly_spending_limit_minor INT NOT NULL DEFAULT 10000000,
      low_balance_alert_thresholds_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id)
    )`,

    `CREATE TABLE IF NOT EXISTS pricing_rate_cards (
      id ${pk},
      country_code VARCHAR(10) NOT NULL,
      country_name VARCHAR(100) DEFAULT NULL,
      category VARCHAR(40) NOT NULL,
      rate_minor INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      effective_to DATETIME DEFAULT NULL,
      version INT NOT NULL DEFAULT 1,
      source VARCHAR(120) NOT NULL DEFAULT 'meta_published_rate_card_2026',
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS meta_messaging_limits (
      id ${pk},
      tenant_id INT NOT NULL,
      account_id VARCHAR(100) DEFAULT NULL,
      waba_id VARCHAR(100) DEFAULT NULL,
      meta_business_id VARCHAR(100) DEFAULT NULL,
      tier VARCHAR(50) NOT NULL DEFAULT 'TIER_250',
      max_daily_recipients INT NOT NULL DEFAULT 250,
      used_daily_recipients INT NOT NULL DEFAULT 0,
      rolling_window_hours INT NOT NULL DEFAULT 24,
      status VARCHAR(50) NOT NULL DEFAULT 'healthy',
      last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      source VARCHAR(60) NOT NULL DEFAULT 'meta_graph_api',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS meta_recipient_window (
      id ${pk},
      tenant_id INT NOT NULL,
      account_id VARCHAR(100) DEFAULT NULL,
      waba_id VARCHAR(100) DEFAULT NULL,
      phone_hash VARCHAR(64) DEFAULT NULL,
      recipient_phone_hash VARCHAR(64) DEFAULT NULL,
      first_contact_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      first_contacted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      window_expires_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      is_service_window TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS message_billing_records (
      id ${pk},
      tenant_id INT NOT NULL,
      account_id VARCHAR(100) DEFAULT NULL,
      sender_id INT DEFAULT NULL,
      phone_number_id VARCHAR(64) DEFAULT NULL,
      waba_id VARCHAR(100) DEFAULT NULL,
      message_id VARCHAR(128) DEFAULT NULL,
      wa_message_id VARCHAR(128) DEFAULT NULL,
      meta_message_id VARCHAR(128) DEFAULT NULL,
      campaign_id VARCHAR(100) DEFAULT NULL,
      recipient_phone VARCHAR(32) DEFAULT NULL,
      country_code VARCHAR(10) NOT NULL DEFAULT 'IN',
      category VARCHAR(40) NOT NULL DEFAULT 'utility',
      base_rate_minor INT NOT NULL DEFAULT 0,
      rate_minor INT NOT NULL DEFAULT 0,
      cost_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      is_free_allowance TINYINT NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      billing_mode VARCHAR(40) NOT NULL DEFAULT 'direct_meta',
      billed_to VARCHAR(50) NOT NULL DEFAULT 'direct_meta',
      reservation_id INT DEFAULT NULL,
      failure_reason VARCHAR(255) DEFAULT NULL,
      error_code VARCHAR(50) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      settled_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS service_message_allowances (
      id ${pk},
      tenant_id INT NOT NULL,
      phone_number_id VARCHAR(64) NOT NULL DEFAULT 'default',
      sender_id INT DEFAULT NULL,
      billing_month VARCHAR(10) NOT NULL,
      used_service_messages INT NOT NULL DEFAULT 0,
      free_allowance_limit INT NOT NULL DEFAULT 1000,
      billable_messages_used INT NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, phone_number_id, billing_month)
    )`,

    `CREATE TABLE IF NOT EXISTS wallet_topup_orders (
      id ${pk},
      tenant_id INT NOT NULL,
      user_id INT DEFAULT NULL,
      order_id VARCHAR(128) NOT NULL,
      provider_order_id VARCHAR(128) DEFAULT NULL,
      bucket VARCHAR(50) NOT NULL DEFAULT 'whatsapp_messaging',
      credit_type VARCHAR(50) NOT NULL DEFAULT 'whatsapp_messaging',
      amount_minor INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      payment_gateway VARCHAR(50) NOT NULL DEFAULT 'razorpay',
      provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
      receipt VARCHAR(128) DEFAULT NULL,
      payment_id VARCHAR(128) DEFAULT NULL,
      signature VARCHAR(255) DEFAULT NULL,
      gateway_response_json TEXT DEFAULT NULL,
      idempotency_key VARCHAR(128) DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'created',
      source VARCHAR(30) NOT NULL DEFAULT 'gateway',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      captured_at DATETIME DEFAULT NULL,
      paid_at DATETIME DEFAULT NULL,
      UNIQUE (order_id)
    )`
  ];

  for (const ddl of tables) {
    let sql = ddl;
    if (db.isSqlite) {
      sql = sql.replace(/UNIQUE KEY\s+\w+\s*\(([^)]+)\)/gi, "UNIQUE ($1)");
    }
    await q(sql).catch((err) => {
      // Ignore already exists in SQLite/MySQL
      if (!err.message?.includes("already exists") && !err.message?.includes("duplicate")) {
        console.warn("[Migration wati_billing_and_limits] Notice:", err.message);
      }
    });
  }

  // Seed standard Meta Rate Cards if not already populated
  const existingRates = await q("SELECT COUNT(*) as count FROM pricing_rate_cards");
  const count = Number(existingRates?.[0]?.count || 0);

  if (count === 0) {
    const defaultRates = [
      // India (IN)
      { country_code: "IN", country_name: "India", category: "marketing", rate_minor: 78, currency: "INR" },
      { country_code: "IN", country_name: "India", category: "utility", rate_minor: 31, currency: "INR" },
      { country_code: "IN", country_name: "India", category: "authentication", rate_minor: 15, currency: "INR" },
      { country_code: "IN", country_name: "India", category: "service", rate_minor: 29, currency: "INR" },

      // United States (US)
      { country_code: "US", country_name: "United States", category: "marketing", rate_minor: 250, currency: "INR" },
      { country_code: "US", country_name: "United States", category: "utility", rate_minor: 150, currency: "INR" },
      { country_code: "US", country_name: "United States", category: "authentication", rate_minor: 120, currency: "INR" },
      { country_code: "US", country_name: "United States", category: "service", rate_minor: 80, currency: "INR" },

      // United Arab Emirates (AE)
      { country_code: "AE", country_name: "United Arab Emirates", category: "marketing", rate_minor: 320, currency: "INR" },
      { country_code: "AE", country_name: "United Arab Emirates", category: "utility", rate_minor: 180, currency: "INR" },
      { country_code: "AE", country_name: "United Arab Emirates", category: "authentication", rate_minor: 140, currency: "INR" },
      { country_code: "AE", country_name: "United Arab Emirates", category: "service", rate_minor: 110, currency: "INR" },

      // United Kingdom (GB)
      { country_code: "GB", country_name: "United Kingdom", category: "marketing", rate_minor: 410, currency: "INR" },
      { country_code: "GB", country_name: "United Kingdom", category: "utility", rate_minor: 220, currency: "INR" },
      { country_code: "GB", country_name: "United Kingdom", category: "authentication", rate_minor: 180, currency: "INR" },
      { country_code: "GB", country_name: "United Kingdom", category: "service", rate_minor: 140, currency: "INR" },

      // Rest of World (ROW default)
      { country_code: "ROW", country_name: "Rest of World", category: "marketing", rate_minor: 350, currency: "INR" },
      { country_code: "ROW", country_name: "Rest of World", category: "utility", rate_minor: 200, currency: "INR" },
      { country_code: "ROW", country_name: "Rest of World", category: "authentication", rate_minor: 150, currency: "INR" },
      { country_code: "ROW", country_name: "Rest of World", category: "service", rate_minor: 120, currency: "INR" },
    ];

    for (const r of defaultRates) {
      await q(
        `INSERT INTO pricing_rate_cards (country_code, country_name, category, rate_minor, currency, version, source, is_active)
         VALUES (?, ?, ?, ?, ?, 1, 'meta_published_rate_card_2026', 1)`,
        [r.country_code, r.country_name, r.category, r.rate_minor, r.currency]
      ).catch(() => {});
    }
  }
}

module.exports = { migrate };
