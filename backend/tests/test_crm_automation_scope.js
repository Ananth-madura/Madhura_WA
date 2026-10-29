"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{createRequire}=require("node:module");
const filename=path.resolve(__dirname,"../services/crmEventBus.js"),realRequire=createRequire(filename),state={exports:{}};
const events=[],queries=[];let fallbackCalls=0;
const db={query:(sql,params,callback)=>{queries.push({sql,params});callback(null,[]);},promise:()=>({query:async(sql,params)=>{queries.push({sql,params});return [[]];}})};
const mocks={"../config/database":db,"./waAutomationService":{triggerAutomation:async(event,payload)=>{events.push({event,payload});return {reason:"no_active_rules"};}},"../sockets/chatsockets":{getIO:()=>null},"./whatsappService":{defaultKey:"1"},"./waConfirmationService":{sendInteractiveReminder:async()=>{fallbackCalls++;throw Error("No unconfigured notices may be sent");}},"./waLoadBalancer":{sendTextMessage:async()=>{fallbackCalls++;throw Error("No fallback sender may be used");}}};
vm.runInNewContext(fs.readFileSync(filename,"utf8"),{module:state,exports:state.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:realRequire(name),process:{env:{WA_LEGACY_UNCONFIGURED_NOTICES:"0"}},console,setInterval,setTimeout},{filename});
async function main(){
  for(const event of ["invoice_created","quotation_created","payment_received","new_lead","walkin_created","amc_created","service_visit_scheduled","ticket_closed","welcome_message"]){
    const handler=state.exports.listeners(event)[0];
    const payload={id:101,tenant_id:7,phone:"919123456789",client_phone:"919123456789",mobile_number:"919123456789",client_company:"Customer",name:"Priya",amount:100};
    await handler({...payload,tenant_id:undefined});assert.equal(events.filter(row=>row.event===event).length,0);
    await handler(payload);const emitted=events.find(row=>row.event===event);assert(emitted,event);assert.equal(emitted.payload.tenantId,7);assert.equal(emitted.payload.eventId,101);
  }
  assert.equal(queries.length,0,"Provided source contacts need no foreign/global lookups");
  assert.equal(fallbackCalls,0,"Unconfigured rules never invoke a fallback sender");
  console.log("PASS: all nine CRM events retain source organization and record identity; unowned events and unconfigured fallback notices are suppressed");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
