"use strict";
async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const columns = db.isSqlite ? await q("PRAGMA table_info(wa_automations)") : await q("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wa_automations'");
  if (!columns.some(column => column.name === "revision")) await q("ALTER TABLE wa_automations ADD COLUMN revision INT NOT NULL DEFAULT 1");
  if (!columns.some(column => column.name === "sender_id")) await q("ALTER TABLE wa_automations ADD COLUMN sender_id INT DEFAULT NULL");
  const groupColumns=db.isSqlite?await q("PRAGMA table_info(wa_contact_groups)"):await q("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wa_contact_groups'");
  if(groupColumns.length&&!groupColumns.some(column=>column.name==="tenant_id")){
    await q("ALTER TABLE wa_contact_groups ADD COLUMN tenant_id INT DEFAULT NULL");
    if(groupColumns.some(column=>column.name==="created_by")){
      if(db.isSqlite)await q("UPDATE wa_contact_groups SET tenant_id=(SELECT u.tenant_id FROM users u WHERE u.id=wa_contact_groups.created_by) WHERE tenant_id IS NULL");
      else await q("UPDATE wa_contact_groups g JOIN users u ON u.id=g.created_by SET g.tenant_id=u.tenant_id WHERE g.tenant_id IS NULL AND u.tenant_id IS NOT NULL");
    }
  }
  await q(`CREATE TABLE IF NOT EXISTS wa_automation_audit (
    id ${db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY"},
    tenant_id INT NOT NULL, automation_id INT NOT NULL, actor_id INT NOT NULL,
    action VARCHAR(30) NOT NULL, revision INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await q(`CREATE TABLE IF NOT EXISTS wa_automation_welcome (
    tenant_id INT PRIMARY KEY, enabled INT NOT NULL DEFAULT 0, welcome_type VARCHAR(20) DEFAULT 'text',
    welcome_text TEXT, welcome_buttons TEXT, welcome_footer VARCHAR(60), template_id INT,
    cooldown_hours INT DEFAULT 24, working_hours_only INT DEFAULT 0,
    start_time VARCHAR(10) DEFAULT '09:00', end_time VARCHAR(10) DEFAULT '21:00',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await q(`CREATE TABLE IF NOT EXISTS wa_automation_dispatches (
    tenant_id INT NOT NULL, request_id VARCHAR(100) NOT NULL, status VARCHAR(20) DEFAULT 'sending',
    provider_id VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (tenant_id,request_id))`);
  await q(`CREATE TABLE IF NOT EXISTS wa_automation_menus (
    tenant_id INT NOT NULL, sender_id INT NOT NULL, phone VARCHAR(20) NOT NULL, automation_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (tenant_id,sender_id,phone))`);
  await q(`CREATE TABLE IF NOT EXISTS wa_automation_welcome_claims (
    tenant_id INT NOT NULL,sender_id INT NOT NULL,phone VARCHAR(20) NOT NULL,request_id VARCHAR(100) NOT NULL,
    last_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (tenant_id,sender_id,phone))`);
  await q(`INSERT ${db.isSqlite ? "OR IGNORE" : "IGNORE"} INTO wa_automation_welcome
    (tenant_id,enabled,welcome_type,welcome_text,welcome_buttons,welcome_footer,template_id,cooldown_hours,working_hours_only,start_time,end_time)
    SELECT 1,enabled,welcome_type,welcome_text,welcome_buttons,welcome_footer,template_id,cooldown_hours,working_hours_only,start_time,end_time FROM wa_welcome_settings WHERE id=1`);
  for (const [table, name, keys] of [["wa_automations", "idx_automation_tenant_event", "tenant_id,trigger_type,is_active,id"], ["wa_automation_logs", "idx_automation_due", "status,scheduled_for,id"], ["wa_automation_audit", "idx_automation_audit_tenant", "tenant_id,automation_id,id"]]) {
    try { await q(`CREATE INDEX ${name} ON ${table} (${keys})`); }
    catch (error) { if (!/already exists|Duplicate key name/.test(error.message)) throw error; }
  }
}
module.exports = { migrate };
