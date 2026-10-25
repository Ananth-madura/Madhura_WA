"use strict";
const assert=require("node:assert/strict"),{assertReady,required}=require("../services/schemaReadiness"),{applyDefaults}=require("../config/runtimeDefaults");
async function main(){
  const env={DISABLE_R2:"1",JWT_SECRET:"a".repeat(64),SMTP_ENCRYPTION_KEY:"b".repeat(64)};applyDefaults(env);
  assert.equal(env.DB_NAME,"madhura_wa");assert.equal(env.DB_ENGINE,"mysql");assert.equal(env.USE_SQLITE,"0");
  assert.equal(env.ALLOW_START_WITHOUT_DB,"0");
  const explicit={...env,DB_NAME:"chosen_database",DB_ENGINE:"r2",USE_SQLITE:"1"};applyDefaults(explicit);assert.equal(explicit.DB_NAME,"chosen_database");assert.equal(explicit.DB_ENGINE,"r2");
  const columns=Object.entries(required).flatMap(([TABLE_NAME,names])=>names.map(COLUMN_NAME=>({TABLE_NAME,COLUMN_NAME})));
  const db=rows=>({isSqlite:false,promise:()=>({query:async()=>[rows]})});
  await assertReady(db(columns));
  await assert.rejects(()=>assertReady(db(columns.filter(row=>row.TABLE_NAME!=="billing_orders"||row.COLUMN_NAME!=="provider_order_id"))),error=>error.code==="SCHEMA_INCOMPLETE"&&error.message.includes("billing_orders.provider_order_id"));
  console.log("PASS: MySQL/madhura_wa defaults preserve explicit settings; missing critical billing fields prevent schema readiness.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
