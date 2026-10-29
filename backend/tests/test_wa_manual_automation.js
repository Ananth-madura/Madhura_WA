"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),{createRequire}=require("node:module");
const filename=path.resolve(__dirname,"../routes/automationWorkspaceRoutes.js"),realRequire=createRequire(filename),moduleState={exports:{}};
let delivery={success:false,error:"Sender offline"},calls=0;
const row={id:71,tenant_id:7,sender_id:8,message_text:"Hello {name}",followup_message_text:"Follow-up"};
const mocks={"../config/database":{},"../services/automationStore":{createStore:()=>({get:async(tenant,id)=>{assert.equal(tenant,7);assert.equal(id,71);return row;},links:async()=>{}})},"../middleware/authMiddleware":{verifyToken:(_req,_res,next)=>next()},"../middleware/tenantMiddleware":{requireTenantContext:(_req,_res,next)=>next()},"../middleware/workspaceModule":{workspaceModule:()=>((_req,_res,next)=>next())},"../services/waAutomationService":{lookupCrmDataByPhone:async(phone,tenant)=>{assert.equal(tenant,7);return {city:"Actual city"};},executeAutomationSend:async(rule,phone,name,text,data,session)=>{calls++;assert.equal(session,"41");assert.equal(data.invoice_no,undefined);assert.equal(data.amount,undefined);return delivery;}}};
vm.runInNewContext(fs.readFileSync(filename,"utf8"),{module:moduleState,exports:moduleState.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:realRequire(name),Buffer,console},{filename});
const handler=moduleState.exports.stack.find(layer=>layer.route?.path==="/:id/trigger").route.stack.at(-1).handle;
async function invoke(body){let status=200,payload;await handler({tenantId:7,params:{id:71},user:{id:41},body},{status(code){status=code;return this;},json(data){payload=data;}});return {status,payload};}
(async()=>{
assert.equal((await invoke({phone:"919123456789",sessionKey:"42"})).status,403);assert.equal(calls,0);
assert.equal((await invoke({phone:"invalid"})).status,400);assert.equal(calls,0);
assert.equal((await invoke({phone:"919123456789"})).status,502);
delivery={success:false,deliveryUnknown:true,error:"Uncertain"};assert.equal((await invoke({phone:"919123456789"})).status,504);
delivery={success:true};const accepted=await invoke({phone:"919123456789"});assert.equal(accepted.status,200);assert(accepted.payload.message.includes("queued"));
console.log("PASS: manual automation uses verified organization, own actor, real event fields and honest failed/unknown/queued responses");
})().catch(error=>{console.error(error);process.exitCode=1;});
