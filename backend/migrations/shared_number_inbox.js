"use strict";

async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const identity = db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY";
  await q("CREATE TABLE IF NOT EXISTS browser_sessions (id VARCHAR(36) PRIMARY KEY,user_id INT NOT NULL,refresh_hash CHAR(64) NOT NULL,expires_at TIMESTAMP NOT NULL,revoked_at TIMESTAMP NULL DEFAULT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
  await q("CREATE TABLE IF NOT EXISTS wa_inbox_ai_settings (tenant_id INT PRIMARY KEY,enabled INT NOT NULL DEFAULT 0,auto_start INT NOT NULL DEFAULT 0,provider VARCHAR(20) NOT NULL DEFAULT 'openai',model VARCHAR(150) NOT NULL DEFAULT '',api_key TEXT DEFAULT NULL,system_prompt TEXT DEFAULT NULL)");
  const add = async (table, column, definition) => {
    const columns = db.isSqlite ? await q(`PRAGMA table_info(${table})`) : await q("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?", [table]);
    if (!columns.some(item => item.name === column)) await q(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  await q("CREATE TABLE IF NOT EXISTS wa_routing_cursors (tenant_id INT PRIMARY KEY, last_user_id INT NOT NULL DEFAULT 0)");
  await q("CREATE TABLE IF NOT EXISTS wa_routing_positions (tenant_id INT NOT NULL, sender_id INT NOT NULL, branch_id INT NOT NULL DEFAULT 0, last_user_id INT NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, sender_id, branch_id))");
  await q("CREATE TABLE IF NOT EXISTS staff_sender_assignments (tenant_id INT NOT NULL, user_id INT NOT NULL, sender_id INT NOT NULL, PRIMARY KEY (tenant_id, user_id, sender_id))");
  await q("CREATE TABLE IF NOT EXISTS wa_inbox_reads (tenant_id INT NOT NULL, conversation_id INT NOT NULL, user_id INT NOT NULL, last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (tenant_id, conversation_id, user_id))");
  await q(`CREATE TABLE IF NOT EXISTS wa_assignment_events (id ${identity}, tenant_id INT NOT NULL, conversation_id INT NOT NULL,
    actor_id INT DEFAULT NULL, owner_user_id INT DEFAULT NULL, branch_id INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await q(`CREATE TABLE IF NOT EXISTS wa_inbox_send_requests (id ${identity}, tenant_id INT NOT NULL, conversation_id INT NOT NULL,
    request_id VARCHAR(100) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', provider_id VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE (tenant_id, request_id))`);
  for (const [column, definition] of [["auto_assign_enabled", "INT NOT NULL DEFAULT 1"], ["is_available", "INT NOT NULL DEFAULT 1"], ["max_open_chats", "INT NOT NULL DEFAULT 50"]]) await add("staff_branch_memberships", column, definition);
  await add("wa_internal_notes", "conversation_id", "INT DEFAULT NULL");
  await add("wa_internal_notes", "tenant_id", "INT DEFAULT NULL");
  await add("wa_message_logs", "conversation_id", "INT DEFAULT NULL");
  await add("wa_message_logs", "sender_id", "INT DEFAULT NULL");
  await add("wa_message_logs", "branch_id", "INT DEFAULT NULL");
  await add("wa_message_logs", "sent_by", "VARCHAR(16) DEFAULT NULL");
  await add("conversations", "automation_mode", "VARCHAR(20) NOT NULL DEFAULT 'human'");
  await add("conversations", "automation_version", "INT NOT NULL DEFAULT 0");
  await add("conversations", "automation_error", "VARCHAR(50) DEFAULT NULL");
  if (!db.isSqlite) {
    const [column] = await q("SELECT DATA_TYPE AS type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'wa_message_logs' AND column_name = 'message_type'");
    if (column?.type === "enum") await q("ALTER TABLE wa_message_logs MODIFY COLUMN message_type VARCHAR(30) DEFAULT 'text'");
  }
  const indexes = [["conversations", "idx_inbox_owner", "tenant_id, owner_user_id, status, updated_at, id"], ["conversations", "idx_inbox_branch", "tenant_id, branch_id, status, updated_at, id"], ["wa_internal_notes", "idx_inbox_notes", "conversation_id, id"], ["wa_message_logs", "idx_inbox_messages", "tenant_id, conversation_id, id"],
    ["browser_sessions","idx_browser_expiry","expires_at"], ["wa_webhook_claims","idx_claim_expiry","claimed_at"], ["wa_webhook_events","idx_webhook_expiry","created_at"],
    ["conversations","idx_inbox_tenant_activity","tenant_id, status, updated_at, id"],
    ["wa_message_logs","idx_message_provider_id","wa_message_id"], ["wa_message_logs","idx_message_expiry","status, created_at, id"],
    ["wa_message_logs","idx_tenant_message_time","tenant_id, created_at, id"],
    ["wa_assignment_events","idx_assignment_expiry","created_at"], ["wa_inbox_send_requests","idx_send_expiry","status, created_at, id"]];
  for (const [table, name, columns] of indexes) {
    try { await q(`CREATE INDEX ${name} ON ${table} (${columns})`); }
    catch (error) { if (!/already exists|Duplicate key name/.test(error.message)) throw error; }
  }
}

module.exports = { migrate };
