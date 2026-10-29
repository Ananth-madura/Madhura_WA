"use strict";
async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const columns = db.isSqlite ? await q("PRAGMA table_info(wa_senders)") : await q("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wa_senders'");
  for (const [name, type] of [["revision", "INT NOT NULL DEFAULT 1"], ["last_verified_at", "DATETIME DEFAULT NULL"], ["health_error", "VARCHAR(255) DEFAULT NULL"], ["webhook_subscribed_at", "DATETIME DEFAULT NULL"]]) {
    if (!columns.some(column => column.name === name)) await q(`ALTER TABLE wa_senders ADD COLUMN ${name} ${type}`);
  }
  await q(`CREATE TABLE IF NOT EXISTS wa_sender_audit (
    id ${db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY"},
    tenant_id INT NOT NULL,sender_id INT NOT NULL,actor_id INT NOT NULL,action VARCHAR(40) NOT NULL,
    revision INT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  for (const [table, name, fields] of [["wa_sender_audit", "idx_sender_audit_scope", "tenant_id,sender_id,id"], ["sender_branch_assignments", "idx_sender_branch_default", "tenant_id,branch_id,is_default"], ["meta_onboarding_sessions", "idx_meta_session_expiry", "tenant_id,user_id,status,expires_at"]]) {
    try { await q(`CREATE INDEX ${name} ON ${table} (${fields})`); }
    catch (error) { if (!/already exists|Duplicate key name/.test(error.message)) throw error; }
  }
  const { encrypt } = require("../backendutil/cryptoHelper");
  for (const [table, column] of [["waba_connections", "encrypted_token"], ["wa_senders", "app_secret"]]) {
    const rows = await q(`SELECT id,${column} AS credential FROM ${table} WHERE ${column} IS NOT NULL AND ${column}<>''`);
    for (const row of rows) {
      if (!/^[a-f0-9]{32}:[a-f0-9]+$/i.test(row.credential)) await q(`UPDATE ${table} SET ${column}=? WHERE id=? AND ${column}=?`, [encrypt(row.credential), row.id, row.credential]);
    }
  }
}
module.exports = { migrate };
