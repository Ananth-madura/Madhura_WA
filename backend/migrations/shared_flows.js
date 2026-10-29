"use strict";
async function migrate(db){
  const q=async(sql,params=[])=>(await db.promise().query(sql,params))[0];
  await q(`CREATE TABLE IF NOT EXISTS wa_flow_connections (
    tenant_id INT NOT NULL, name VARCHAR(80) NOT NULL, url VARCHAR(2000) NOT NULL,
    token TEXT NOT NULL, operations TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (tenant_id,name))`);
  for(const [table,column,definition] of [["wa_flow_runs","conversation_id","INT DEFAULT NULL"],["wa_templates","sender_id","INT DEFAULT NULL"],["wa_templates","waba_id","VARCHAR(100) DEFAULT NULL"]]){
    const columns=db.isSqlite?await q(`PRAGMA table_info(${table})`):await q("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?",[table]);
    if(!columns.some(c=>c.name===column))await q(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  await q("UPDATE wa_templates SET meta_status='DRAFT' WHERE meta_template_id IS NULL AND meta_status='APPROVED'");
  if(!db.isSqlite)for(const [table,name,columns] of [["wa_flows","idx_flow_tenant_status","tenant_id,status,id"],["wa_flow_runs","idx_flow_conversation_status","conversation_id,status"],["wa_templates","idx_template_tenant_provider","tenant_id,waba_id,meta_template_id"]]){
    try{await q(`CREATE INDEX ${name} ON ${table} (${columns})`);}catch(error){if(!/Duplicate key name/.test(error.message))throw error;}
  }
}
module.exports={migrate};
