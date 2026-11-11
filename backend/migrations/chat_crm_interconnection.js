"use strict";

/**
 * Additive schema migration for real-world external CRM webhook integration
 * and persistent webhook delivery tracking (MySQL + SQLite compatible).
 */
async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const pk = db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY";

  const tables = [
    `CREATE TABLE IF NOT EXISTS tenant_crm_webhooks (
      id ${pk},
      tenant_id INT NOT NULL,
      webhook_url VARCHAR(500) NOT NULL,
      webhook_secret VARCHAR(255) DEFAULT NULL,
      subscribed_events TEXT DEFAULT NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      updated_by INT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tenant_crm_webhook (tenant_id)
    )`,
    `CREATE TABLE IF NOT EXISTS tenant_crm_webhook_deliveries (
      id ${pk},
      tenant_id INT NOT NULL,
      event_type VARCHAR(80) NOT NULL,
      webhook_url VARCHAR(500) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      http_status INT DEFAULT NULL,
      error_message VARCHAR(500) DEFAULT NULL,
      payload_summary TEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const ddl of tables) {
    let sql = ddl;
    if (db.isSqlite) {
      sql = sql.replace(/UNIQUE KEY\s+\w+\s*\(([^)]+)\)/gi, "UNIQUE ($1)");
    }
    await q(sql);
  }

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_crm_wh_del_tenant_created ON tenant_crm_webhook_deliveries (tenant_id, id)",
  ];
  for (const idx of indexes) {
    try {
      await q(db.isSqlite ? idx : idx.replace(" IF NOT EXISTS ", " "));
    } catch (_) {}
  }

  return true;
}

module.exports = { migrate };
