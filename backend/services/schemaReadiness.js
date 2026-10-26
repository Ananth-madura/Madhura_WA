"use strict";
const required={
  users:["id","email","user_password","tenant_id"],
  tenants:["id","plan","plan_status","pending_plan_id","max_branches","max_seats","max_senders","max_monthly_messages"],
  plans:["id","price_inr","is_active","features_json"],
  branches:["id","tenant_id","code","name"],
  organization_memberships:["tenant_id","user_id","role","membership_status"],
  billing_orders:["id","tenant_id","plan_id","interval","amount_minor","currency","provider_order_id","payment_id","status"],
  browser_sessions:["id","user_id","refresh_hash","expires_at","revoked_at"],
  conversations:["id","tenant_id","sender_id","owner_user_id","automation_mode"],
  wa_contacts:["id","tenant_id","assigned_agent_id","lifecycle_stage"],
  wa_enquiries:["id","tenant_id","contact_id"],
  wa_customer_tasks:["id","tenant_id","contact_id","completed_by"],
  wa_customer_deals:["id","tenant_id","contact_id","stage"],
  wa_customer_activities:["id","tenant_id","contact_id"],
  wa_customer_transfers:["id","tenant_id","contact_id","previous_owner_user_id","owner_user_id"],
};
async function assertReady(db){
  if(db.isSqlite)return;
  const [columns]=await db.promise().query("SELECT TABLE_NAME,COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ("+Object.keys(required).map(()=>"?").join(",")+")",Object.keys(required));
  const found=new Set(columns.map(row=>`${row.TABLE_NAME}.${row.COLUMN_NAME}`));
  const missing=Object.entries(required).flatMap(([table,names])=>names.filter(name=>!found.has(`${table}.${name}`)).map(name=>`${table}.${name}`));
  if(missing.length)throw Object.assign(new Error("Required database fields are missing: "+missing.join(", ")),{code:"SCHEMA_INCOMPLETE"});
}
module.exports={assertReady,required};
