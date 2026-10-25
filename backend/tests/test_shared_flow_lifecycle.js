"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {createRequire}=require("node:module");
const filename=path.resolve(__dirname,"../services/sharedFlowRuntime.js"),realRequire=createRequire(filename);
const {normalize}=require("../services/flowDefinition");
const flow=normalize({...require("../services/prebuiltFlows").find(f=>f.key==="sales"),id:1,tenant_id:1},{publish:true});
const conversation={id:7,tenant_id:1,sender_id:3,branch_id:2,contact_id:8,contact_name:"Customer",contact_phone:"919999999999",contact_email:"person@fixture.test",status:"open",automation_mode:"human",automation_version:0,service_window_expires_at:new Date(Date.now()+86400000)};
const runs=new Map(),queries=[],deliveries=[];let sequence=0;
const query=async(sql,params=[])=>{
  queries.push({sql,params});
  if(sql.startsWith("SELECT c.*"))return [[{...conversation}]];
  if(sql.startsWith("SELECT f.id"))return [Number(params[1])===1?[{...flow,nodes_snapshot:JSON.stringify(flow.nodes)}]:[]];
  if(sql.startsWith("SELECT id FROM wa_flows"))return [[{id:1}]];
  if(sql.startsWith("UPDATE conversations SET automation_mode='flow'")){
    if(Number(params[2])!==conversation.automation_version)return [{affectedRows:0}];conversation.automation_mode="flow";conversation.automation_version++;
  }else if(sql.startsWith("UPDATE conversations SET automation_mode='human'")){
    if(params.length<3||Number(params[2])===conversation.automation_version){conversation.automation_mode="human";conversation.automation_version++;}
  }else if(sql.startsWith("UPDATE conversations SET automation_mode=?")){conversation.automation_mode=params[0];conversation.automation_version++;}
  if(sql.startsWith("INSERT INTO wa_flow_runs")){const id=++sequence;runs.set(id,{status:"active"});return [{insertId:id,affectedRows:1}];}
  if(sql.startsWith("UPDATE wa_flow_runs SET status=?"))Object.assign(runs.get(params[2]),{status:params[0],reason:params[1]});
  return [{affectedRows:1}];
};
const mocks={
  "../config/database":{promise:()=>({query})},
  "./sharedInboxAssistant":{schedule:(_tenant,_id,work)=>Promise.resolve().then(work)},
  "./sharedInboxService":{createInboxService:()=>({emit:async()=>{}})},
  "../sockets/chatsockets":{getIO:()=>null},
  "./waConfigHelper":{cloudClientForTenantSender:async()=>({sendText:async(_phone,text)=>{deliveries.push(text);return {messages:[{id:`wamid.lifecycle.${deliveries.length}`}]};}})},
};
const moduleState={exports:{}};
vm.runInNewContext(fs.readFileSync(filename,"utf8"),{module:moduleState,exports:moduleState.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:realRequire(name),Date,Buffer,console,setInterval:()=>({unref(){}})},{filename});
const runtime=moduleState.exports;
async function main(){
  await runtime.start(1,7,1);assert.equal(runtime.capacity().sessions,1);const version=conversation.automation_version;
  await assert.rejects(runtime.start(1,7,999),/Publish and activate/);
  assert.equal(runtime.capacity().sessions,1);assert.equal(conversation.automation_version,version);assert.equal(runs.get(1).status,"active");
  await runtime.handle(1,7,"event-1","Sensitive answer one");assert(deliveries.at(-1).includes("budget"));
  await runtime.handle(1,7,"event-2","Sensitive answer two");assert.equal(runs.get(1).status,"handed_off");assert.equal(runtime.capacity().sessions,0);
  assert(!JSON.stringify(queries).includes("Sensitive answer"));
  await runtime.start(1,7,1);assert.equal(runtime.capacity().sessions,1);
  await runtime.expireIdle(Date.now()+5*3600000);
  assert.equal(runtime.capacity().sessions,0);assert.equal(runs.get(2).status,"timed_out");assert.equal(conversation.automation_mode,"human");
  assert(queries.filter(q=>q.sql.startsWith("SELECT f.id")).every(q=>q.sql.includes("f.id=?")));
  console.log("PASS: rejected bot starts preserve active runs; answers remain out of SQL; idle expiry clears transient state and hands the conversation to an employee.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
