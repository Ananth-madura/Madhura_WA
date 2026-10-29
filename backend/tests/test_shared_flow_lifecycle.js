"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {createRequire}=require("node:module");
const filename=path.resolve(__dirname,"../services/sharedFlowRuntime.js"),realRequire=createRequire(filename);
const {normalize}=require("../services/flowDefinition");
const flow=normalize({...require("../services/prebuiltFlows").find(f=>f.key==="sales"),id:1,tenant_id:1},{publish:true});
const booking=normalize({...require("../services/industryFlowBlueprints").find(f=>f.key==="appointments.booking_create"),id:2,tenant_id:1},{publish:true});
const flows=new Map([[1,{...flow,id:1,tenant_id:1}],[2,{...booking,id:2,tenant_id:1}]]);
const ai=normalize({name:"AI and media",trigger_type:"manual",nodes:[
  {node_key:"start",node_type:"collect_input",config:{prompt_text:"Ask a question",var_key:"question",validation_type:"none",next_node_key:"ai"}},
  {node_key:"ai",node_type:"ai_reply",config:{prompt:"{{question}}",output_variable:"ai_response",next_node_key:"reply",error_next:"human"}},
  {node_key:"reply",node_type:"send_message",config:{text:"{{ai_response}}",next_node_key:"media"}},
  {node_key:"media",node_type:"send_media",config:{media_type:"document",url:"https://example.test/catalog.pdf",caption:"Our catalog",next_node_key:"end"}},
  {node_key:"end",node_type:"end",config:{}},{node_key:"human",node_type:"handoff",config:{}},
]},{publish:true});
flows.set(3,{...ai,id:3,tenant_id:1});
const actionCalls=[];let actionFailure=false;
const conversation={id:7,tenant_id:1,sender_id:3,branch_id:2,contact_id:8,contact_name:"Customer",contact_phone:"919999999999",contact_email:"person@fixture.test",status:"open",automation_mode:"human",automation_version:0,service_window_expires_at:new Date(Date.now()+86400000)};
const runs=new Map(),queries=[],deliveries=[];let sequence=0;
const query=async(sql,params=[])=>{
  queries.push({sql,params});
  if(sql.startsWith("SELECT c.*"))return [[{...conversation}]];
  if(sql.startsWith("SELECT f.id")){const selected=flows.get(Number(params[1]));return [selected?[{...selected,nodes_snapshot:JSON.stringify(selected.nodes)}]:[]];}
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
  "./flowIntegrations":{createRunner:()=>async(node,vars,context)=>{actionCalls.push({node,vars,context});if(actionFailure)throw Error("Business system unavailable");return {result_message:"Verified booking B-100"};}},
  "../config/database":{promise:()=>({query})},
  "./sharedInboxAssistant":{schedule:(_tenant,_id,work)=>Promise.resolve().then(work),generate:async(tenant,id,input)=>{assert.equal(tenant,1);assert.equal(id,7);assert.equal(input,"Which services are available?");return "Verified configured assistant response";}},
  "./sharedInboxService":{createInboxService:()=>({emit:async()=>{}})},
  "../sockets/chatsockets":{getIO:()=>null},
  "./waConfigHelper":{cloudClientForTenantSender:async()=>({sendMedia:async(phone,type,url,caption)=>{assert.equal(type,"document");assert.equal(url,"https://example.test/catalog.pdf");deliveries.push(caption);return {messages:[{id:`wamid.lifecycle.${deliveries.length}`}]};},sendInteractiveButtons:async(_phone,text)=>{deliveries.push(text);return {messages:[{id:`wamid.lifecycle.${deliveries.length}`}]};},sendText:async(_phone,text)=>{deliveries.push(text);return {messages:[{id:`wamid.lifecycle.${deliveries.length}`}]};}})},
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
  for(const shouldFail of [false,true]){
    actionFailure=shouldFail;
    await runtime.start(1,7,2);
    for(const [index,answer] of ["Haircut","Central","2026-12-15","10:00"].entries())await runtime.handle(1,7,`booking-${shouldFail}-${index}`,answer);
    const before=actionCalls.length;
    assert.equal(deliveries.at(-1).includes("Continue with this request?"),true,JSON.stringify({last:deliveries.at(-1),run:runs.get(sequence)}));
    await runtime.handle(1,7,`booking-confirm-${shouldFail}`,"confirm");
    assert.equal(actionCalls.length,before+1);
    assert.equal(actionCalls.at(-1).context.tenantId,1);
    assert.equal(actionCalls.at(-1).context.conversationId,7);
    assert.equal(runs.get(sequence).status,shouldFail?"handed_off":"completed");
    assert(deliveries.at(-1).includes(shouldFail?"team member":"Verified booking B-100"));
    assert(queries.some(q=>q.sql.includes(shouldFail?"'action_failed'":"'action_succeeded'")));
    assert.equal(runtime.capacity().sessions,0);
  }
  await runtime.start(1,7,3);
  await runtime.handle(1,7,"ai-question","Which services are available?");
  assert.equal(runs.get(sequence).status,"completed");
  assert(deliveries.includes("Verified configured assistant response"));
  assert.equal(deliveries.at(-1),"Our catalog");
  console.log("PASS: runtime lifecycle, private answers, idle expiry, confirmed business actions, failure handoff, configured AI replies and Meta media dispatch.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
