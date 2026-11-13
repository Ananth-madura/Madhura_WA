"use strict";

/**
 * Additive schema migration for Meta Multi-Account & Concurrent Multi-Number SaaS.
 * Supports MySQL and SQLite in-memory test environments.
 */
async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const pk = db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY";

  const tables = [
    `CREATE TABLE IF NOT EXISTS meta_connections (
      id ${pk},
      tenant_id INT NOT NULL,
      meta_user_id VARCHAR(100) DEFAULT NULL,
      meta_user_name VARCHAR(255) DEFAULT NULL,
      meta_user_email VARCHAR(255) DEFAULT NULL,
      encrypted_access_token TEXT DEFAULT NULL,
      scopes TEXT DEFAULT NULL,
      token_type VARCHAR(50) DEFAULT 'bearer',
      token_expires_at DATETIME DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS meta_business_portfolios (
      id ${pk},
      tenant_id INT NOT NULL,
      meta_connection_id INT DEFAULT NULL,
      meta_business_id VARCHAR(100) NOT NULL,
      name VARCHAR(255) DEFAULT NULL,
      verification_status VARCHAR(50) DEFAULT 'not_verified',
      sharing_status VARCHAR(50) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, meta_business_id)
    )`,
    `CREATE TABLE IF NOT EXISTS waba_connections (
      id ${pk},
      tenant_id INT NOT NULL,
      meta_business_id VARCHAR(100) DEFAULT NULL,
      waba_id VARCHAR(100) NOT NULL,
      partner_type VARCHAR(50) DEFAULT 'tech_provider',
      encrypted_token TEXT DEFAULT NULL,
      system_user_id VARCHAR(100) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'connected',
      last_sync_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (waba_id)
    )`,
    `CREATE TABLE IF NOT EXISTS wa_senders (
      id ${pk},
      tenant_id INT NOT NULL,
      waba_connection_id INT DEFAULT NULL,
      phone_number_id VARCHAR(128) NOT NULL,
      display_phone VARCHAR(32) DEFAULT NULL,
      verified_name VARCHAR(255) DEFAULT NULL,
      quality VARCHAR(30) DEFAULT 'GREEN',
      messaging_tier VARCHAR(50) DEFAULT 'TIER_250',
      is_shared TINYINT DEFAULT 1,
      status VARCHAR(50) DEFAULT 'connected',
      app_secret TEXT DEFAULT NULL,
      verify_token VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (phone_number_id)
    )`,
    `CREATE TABLE IF NOT EXISTS wa_sender_metrics (
      id ${pk},
      tenant_id INT NOT NULL,
      sender_id INT NOT NULL,
      metric_date VARCHAR(10) NOT NULL,
      metric_hour INT NOT NULL DEFAULT 0,
      messages_sent INT NOT NULL DEFAULT 0,
      messages_delivered INT NOT NULL DEFAULT 0,
      messages_read INT NOT NULL DEFAULT 0,
      messages_failed INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, sender_id, metric_date, metric_hour)
    )`,
    `CREATE TABLE IF NOT EXISTS wa_sender_audit (
      id ${pk},
      tenant_id INT NOT NULL,
      sender_id INT NOT NULL,
      actor_id INT NOT NULL,
      action VARCHAR(60) NOT NULL,
      revision INT NOT NULL DEFAULT 1,
      details TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const ddl of tables) {
    let sql = ddl;
    if (db.isSqlite) {
      sql = sql.replace(/UNIQUE KEY\s+\w+\s*\(([^)]+)\)/gi, "UNIQUE ($1)");
    }
    await q(sql);
  }

  // Helper to ensure columns exist on existing tables
  async function ensureColumn(table, column, typeDef) {
    try {
      const columns = db.isSqlite
        ? await q(`PRAGMA table_info(${table})`)
        : await q(`SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?`, [table]);
      const exists = (columns || []).some(c => (c.name || c.COLUMN_NAME) === column);
      if (!exists) {
        await q(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
      }
    } catch (_) {}
  }

  // Extend waba_connections
  await ensureColumn("waba_connections", "meta_connection_id", "INT DEFAULT NULL");
  await ensureColumn("waba_connections", "business_portfolio_id", "INT DEFAULT NULL");
  await ensureColumn("waba_connections", "name", "VARCHAR(255) DEFAULT NULL");
  await ensureColumn("waba_connections", "currency", "VARCHAR(10) DEFAULT 'INR'");
  await ensureColumn("waba_connections", "timezone_id", "VARCHAR(100) DEFAULT 'Asia/Kolkata'");
  await ensureColumn("waba_connections", "message_template_namespace", "VARCHAR(255) DEFAULT NULL");
  await ensureColumn("waba_connections", "rate_limit_tier", "VARCHAR(50) DEFAULT 'TIER_80'");

  // Extend wa_senders
  await ensureColumn("wa_senders", "meta_connection_id", "INT DEFAULT NULL");
  await ensureColumn("wa_senders", "code_verification_status", "VARCHAR(50) DEFAULT 'NOT_VERIFIED'");
  await ensureColumn("wa_senders", "department_id", "INT DEFAULT NULL");
  await ensureColumn("wa_senders", "department_name", "VARCHAR(100) DEFAULT NULL");
  await ensureColumn("wa_senders", "is_default", "TINYINT DEFAULT 0");
  await ensureColumn("wa_senders", "daily_limit", "INT DEFAULT 1000");
  await ensureColumn("wa_senders", "current_day_sent", "INT DEFAULT 0");
  await ensureColumn("wa_senders", "last_ping_at", "DATETIME DEFAULT NULL");
  await ensureColumn("wa_senders", "last_ping_status", "VARCHAR(50) DEFAULT NULL");
  await ensureColumn("wa_senders", "revision", "INT NOT NULL DEFAULT 1");
  await ensureColumn("wa_senders", "last_verified_at", "DATETIME DEFAULT NULL");
  await ensureColumn("wa_senders", "health_error", "VARCHAR(255) DEFAULT NULL");
  await ensureColumn("wa_senders", "webhook_subscribed_at", "DATETIME DEFAULT NULL");

  // Create indexes safely
  const indexes = [
    ["meta_connections", "idx_meta_conn_tenant", "tenant_id, status"],
    ["meta_business_portfolios", "idx_meta_port_tenant", "tenant_id, meta_connection_id"],
    ["waba_connections", "idx_waba_tenant_status", "tenant_id, status"],
    ["wa_senders", "idx_senders_tenant_status", "tenant_id, status, is_default"],
    ["wa_sender_metrics", "idx_sender_metrics_lookup", "tenant_id, sender_id, metric_date"],
    ["wa_sender_audit", "idx_sender_audit_scope", "tenant_id, sender_id, id"]
  ];

  for (const [table, idxName, fields] of indexes) {
    try {
      if (db.isSqlite) {
        await q(`CREATE INDEX IF NOT EXISTS ${idxName} ON ${table} (${fields})`);
      } else {
        await q(`CREATE INDEX ${idxName} ON ${table} (${fields})`);
      }
    } catch (err) {
      if (!/already exists|Duplicate key name/i.test(err.message)) {
        // Safe to ignore duplicate index
      }
    }
  }

  return true;
}

module.exports = { migrate };

