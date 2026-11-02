"use strict";

async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];

  // 1. wa_automations columns
  const autoCols = db.isSqlite
    ? await q("PRAGMA table_info(wa_automations)")
    : await q("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wa_automations'");
  const autoColNames = new Set(autoCols.map(c => c.name || c.COLUMN_NAME));

  if (!autoColNames.has("actions_json")) {
    await q("ALTER TABLE wa_automations ADD COLUMN actions_json TEXT DEFAULT NULL");
  }
  if (!autoColNames.has("schedule_json")) {
    await q("ALTER TABLE wa_automations ADD COLUMN schedule_json TEXT DEFAULT NULL");
  }
  if (!autoColNames.has("category")) {
    await q("ALTER TABLE wa_automations ADD COLUMN category VARCHAR(50) DEFAULT 'general'");
  }

  // 2. wa_automation_logs columns
  const logCols = db.isSqlite
    ? await q("PRAGMA table_info(wa_automation_logs)")
    : await q("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wa_automation_logs'");
  const logColNames = new Set(logCols.map(c => c.name || c.COLUMN_NAME));

  if (!logColNames.has("diagnostics_json")) {
    await q("ALTER TABLE wa_automation_logs ADD COLUMN diagnostics_json TEXT DEFAULT NULL");
  }
  if (!logColNames.has("execution_type")) {
    await q("ALTER TABLE wa_automation_logs ADD COLUMN execution_type VARCHAR(30) DEFAULT 'single'");
  }

  // 3. wa_automation_checkpoints table
  await q(`CREATE TABLE IF NOT EXISTS wa_automation_checkpoints (
    id ${db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY"},
    tenant_id INT NOT NULL,
    automation_id INT NOT NULL,
    execution_id INT DEFAULT NULL,
    phone VARCHAR(20) NOT NULL,
    contact_id INT DEFAULT NULL,
    conversation_id INT DEFAULT NULL,
    sender_id INT DEFAULT NULL,
    session_key VARCHAR(100) DEFAULT NULL,
    current_step INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    checkpoint_type VARCHAR(30) NOT NULL DEFAULT 'ask_question',
    expected_type VARCHAR(30) DEFAULT 'text',
    question_context TEXT DEFAULT NULL,
    collected_answers TEXT DEFAULT NULL,
    expires_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  for (const [table, name, keys] of [
    ["wa_automation_checkpoints", "idx_wa_chk_tenant_phone_status", "tenant_id, phone, status"],
    ["wa_automation_checkpoints", "idx_wa_chk_expires", "tenant_id, expires_at, status"],
    ["wa_automations", "idx_wa_auto_category", "tenant_id, category"]
  ]) {
    try {
      await q(`CREATE INDEX ${name} ON ${table} (${keys})`);
    } catch (error) {
      if (!/already exists|Duplicate key name/i.test(error.message)) {
        // Safe skip if index exists or table structure handles it
      }
    }
  }
}

module.exports = { migrate };
