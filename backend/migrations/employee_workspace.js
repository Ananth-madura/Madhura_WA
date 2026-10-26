"use strict";

async function migrate(db) {
  const q = async (sql, values = []) => (await db.promise().query(sql, values))[0];
  const identity = db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY";
  const suffix = db.isSqlite ? "" : " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
  const add = async (table, column, definition) => {
    const columns = db.isSqlite ? await q(`PRAGMA table_info(${table})`) : await q("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?", [table]);
    if (columns.length && !columns.some(row => row.name === column)) await q(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  if(!db.isSqlite){
    const [status]=await q("SELECT DATA_TYPE AS data_type,COLUMN_TYPE AS column_type,COLUMN_DEFAULT AS default_status,IS_NULLABLE AS is_nullable FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='status'");
    if(status?.data_type==="enum"){
      const missing=["banned","inactive"].filter(value=>!status.column_type.toLowerCase().includes(`'${value}'`));
      if(missing.length){
        const extended=status.column_type.slice(0,-1)+missing.map(value=>`, '${value}'`).join("")+")";
        await q(`ALTER TABLE users MODIFY COLUMN status ${extended} ${status.is_nullable==="NO"?"NOT NULL":"NULL"} DEFAULT ?`,[status.default_status]);
      }
    }
  }
  await add("wa_contacts", "assigned_agent_id", "INT DEFAULT NULL");
  await add("wa_contacts", "branch_id", "INT DEFAULT NULL");
  await add("wa_contacts", "opt_in_status", "INT NOT NULL DEFAULT 0");
  await add("wa_contacts", "lifecycle_stage", "VARCHAR(20) NOT NULL DEFAULT 'lead'");
  await add("wa_enquiries", "contact_id", "INT DEFAULT NULL");
  await add("telecalls", "tenant_id", "INT DEFAULT NULL");
  await add("clients", "tenant_id", "INT DEFAULT NULL");
  await add("clients", "owner_user_id", "INT DEFAULT NULL");
  await add("clientinvoices", "tenant_id", "INT DEFAULT NULL");
  await add("quotations", "tenant_id", "INT DEFAULT NULL");
  await add("admin_notifications", "tenant_id", "INT DEFAULT NULL");
  await add("wa_campaigns", "audience_policy", "VARCHAR(30) NOT NULL DEFAULT 'organization'");
  await add("wa_campaigns", "sender_id", "INT DEFAULT NULL");
  await add("wa_campaigns", "request_key", "VARCHAR(100) DEFAULT NULL");
  await add("wa_campaigns", "template_parameters", "TEXT DEFAULT NULL");
  await add("wa_campaign_messages", "contact_id", "INT DEFAULT NULL");
  await add("wa_campaign_messages", "claimed_at", "DATETIME DEFAULT NULL");
  await q(`CREATE TABLE IF NOT EXISTS wa_customer_tasks (id ${identity}, tenant_id INT NOT NULL, contact_id INT NOT NULL,
    title VARCHAR(255) NOT NULL, due_at DATETIME DEFAULT NULL, status VARCHAR(20) NOT NULL DEFAULT 'open',
    completed_by INT DEFAULT NULL, completed_at DATETIME DEFAULT NULL, created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)${suffix}`);
  await q(`CREATE TABLE IF NOT EXISTS wa_customer_deals (id ${identity}, tenant_id INT NOT NULL, contact_id INT NOT NULL,
    title VARCHAR(255) NOT NULL, stage VARCHAR(30) NOT NULL DEFAULT 'new', amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_by INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)${suffix}`);
  await q(`CREATE TABLE IF NOT EXISTS wa_customer_activities (id ${identity}, tenant_id INT NOT NULL, contact_id INT NOT NULL,
    actor_id INT NOT NULL, kind VARCHAR(30) NOT NULL, body TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)${suffix}`);
  await q(`CREATE TABLE IF NOT EXISTS wa_customer_transfers (id ${identity}, tenant_id INT NOT NULL, contact_id INT NOT NULL,
    previous_owner_user_id INT DEFAULT NULL, owner_user_id INT NOT NULL, actor_id INT NOT NULL, branch_id INT NOT NULL,
    reason VARCHAR(1000) NOT NULL, conversation_count INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)${suffix}`);
  await q("CREATE TABLE IF NOT EXISTS wa_assignment_settings (tenant_id INT PRIMARY KEY, strategy VARCHAR(20) NOT NULL DEFAULT 'round_robin', required_skill VARCHAR(80) DEFAULT NULL)");
  await add("wa_assignment_settings", "crm_strategy", "VARCHAR(20) NOT NULL DEFAULT 'round_robin'");
  await add("wa_assignment_settings", "crm_required_skill", "VARCHAR(80) DEFAULT NULL");
  await add("staff_branch_memberships", "max_open_leads", "INT NOT NULL DEFAULT 250");
  await q("CREATE TABLE IF NOT EXISTS wa_employee_skills (tenant_id INT NOT NULL, user_id INT NOT NULL, skill VARCHAR(80) NOT NULL, PRIMARY KEY(tenant_id,user_id,skill))");
  await q("CREATE TABLE IF NOT EXISTS wa_employee_workspace_permissions (tenant_id INT NOT NULL,user_id INT NOT NULL,module VARCHAR(30) NOT NULL,can_view INT NOT NULL DEFAULT 1,can_edit INT NOT NULL DEFAULT 1,PRIMARY KEY(tenant_id,user_id,module))");
  await q("CREATE TABLE IF NOT EXISTS wa_ownership_recovery_positions (tenant_id INT PRIMARY KEY,last_contact_id INT NOT NULL DEFAULT 0)");
  await q(`CREATE TABLE IF NOT EXISTS wa_workspace_audit (id ${identity},tenant_id INT NOT NULL,actor_id INT NOT NULL,action VARCHAR(60) NOT NULL,subject_user_id INT DEFAULT NULL,details TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)${suffix}`);
  const indexes = [["wa_contacts", "idx_customer_owner", "tenant_id, assigned_agent_id, id"], ["wa_enquiries", "idx_enquiry_customer", "tenant_id, contact_id, id"],
    ["telecalls", "idx_telecalls_tenant_phone", "tenant_id, mobile_number"],
    ["wa_workspace_audit", "idx_workspace_audit_tenant", "tenant_id, id"],
    ["wa_campaigns", "idx_employee_campaign_owner", "tenant_id, created_by, audience_policy, id"],
    ...["wa_customer_tasks", "wa_customer_deals", "wa_customer_activities", "wa_customer_transfers"].map(table => [table, `idx_${table}_customer`, "tenant_id, contact_id, id"])];
  for (const [table, name, columns] of indexes) {
    const exists = db.isSqlite ? await q("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]) : await q("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", [table]);
    if (!exists.length) continue;
    try { await q(`CREATE INDEX ${name} ON ${table} (${columns})`); }
    catch (error) { if (!/already exists|Duplicate key name/.test(error.message)) throw error; }
  }
  if(!db.isSqlite)for(const [table,name,columns] of [["wa_campaigns","uq_campaign_request","tenant_id,request_key"],["wa_campaign_messages","uq_campaign_customer","campaign_id,contact_id"]]){
    const exists=await q("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",[table]);
    if(!exists.length)continue;
    try{await q(`CREATE UNIQUE INDEX ${name} ON ${table} (${columns})`);}catch(error){if(!/Duplicate key name/.test(error.message))throw error;}
  }
}
module.exports = { migrate };
