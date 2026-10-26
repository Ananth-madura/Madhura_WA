"use strict";
const assert=require("node:assert/strict");
let inTransaction=false,released=0,transactionQueries=0;
const contact={id:1,tenant_id:1,name:"Scoped customer",phone:"919123456789",assigned_agent_id:7,branch_id:1,lifecycle_stage:"lead"};
async function execute(sql){
  if(sql.includes("wa_employee_workspace_permissions"))return [{can_view:1,can_edit:1}];
  if(sql.includes("SELECT branch_id FROM staff_branch_memberships"))return [{branch_id:1}];
  if(sql.includes("FROM wa_senders s"))return [{id:1}];
  if(sql.includes("FROM wa_templates"))return [{id:1,body:"Hello {{1}}",header_type:null,buttons:null,waba_id:"fixture-waba"}];
  if(sql.includes("SELECT ct.id,"))return [contact];
  if(sql.includes("SELECT opt_in_status"))return [{opt_in_status:1,is_blocked:0,is_unsubscribed:0}];
  if(sql.startsWith("INSERT"))return {insertId:1,affectedRows:1};
  return [];
}
const client={query:async sql=>{transactionQueries++;return [await execute(sql)];},beginTransaction:async()=>{inTransaction=true;},commit:async()=>{inTransaction=false;},rollback:async()=>{inTransaction=false;}};
const db={isSqlite:false,promise:()=>({query:async sql=>{assert.equal(inTransaction,false,"A held transaction must not acquire a second pool connection");return [await execute(sql)];}}),getConnection:callback=>callback(null,{promise:()=>client,release:()=>released++})};
require.cache[require.resolve("../services/waConfigHelper")]={loaded:true,exports:{cloudClientForTenantSender:async()=>({wabaId:"fixture-waba"})}};
async function main(){
  const service=require("../services/employeeCampaigns").createEmployeeCampaigns(db);
  const result=await service.create({tenantId:1,user:{id:7},userRole:"branch_manager",waAccessLevel:"full"},{name:"Scoped campaign",senderId:1,templateId:1,parameters:["Customer"],contactIds:[1],requestKey:"pool-isolation-fixture"});
  assert.equal(result.id,1);assert.equal(released,1);assert(transactionQueries>5);
  console.log("PASS: delegated campaign creation, supervisor branch checks, module permissions and customer locks all reuse one transaction connection; no nested pool acquisition.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
