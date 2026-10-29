"use strict";
const crypto=require("crypto");
const definition=require("./flowDefinition");
const states=new Map(),slots=require("./boundedExecutor").createExecutor(4,60);
const definitions=new Map(),definitionReads=new Map();let definitionBytes=0;
const query=async(sql,params=[])=>(await require("../config/database").promise().query(sql,params))[0];
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const cacheKey=(tenant,id)=>`${tenant}:${id}`;
let pending=0;
async function row(tenant,id){const [result]=await query("SELECT c.*,ct.phone AS contact_phone,ct.name AS contact_name,ct.email AS contact_email,ct.is_unsubscribed,ct.is_blocked FROM conversations c JOIN wa_contacts ct ON ct.id=c.contact_id AND ct.tenant_id=c.tenant_id WHERE c.tenant_id=? AND c.id=?",[tenant,id]);if(!result)throw fail("Conversation not found",404);return result;}
function eligible(c){return c.status==="open"&&!c.is_unsubscribed&&!c.is_blocked&&new Date(c.service_window_expires_at).getTime()>Date.now();}
async function notify(c,event,payload){await require("./sharedInboxService").createInboxService(require("../config/database")).emit(require("../sockets/chatsockets").getIO(),c,event,payload);}
async function finish(state,status,reason){if(states.get(state.key)===state)states.delete(state.key);await query("UPDATE wa_flow_runs SET status=?,end_reason=?,ended_at=NOW(),vars=NULL WHERE id=?",[status,reason,state.runId]);}
function cancel(tenant,id){const state=states.get(cacheKey(tenant,id));if(state){states.delete(state.key);query("UPDATE wa_flow_runs SET status='paused_by_agent',end_reason='agent_takeover',ended_at=NOW(),vars=NULL WHERE id=?",[state.runId]).catch(()=>{});}}
function invalidate(tenant){const cached=definitions.get(tenant);if(cached)definitionBytes-=cached.bytes;definitions.delete(tenant);definitionReads.delete(tenant);}
async function published(tenant,id=null){
  if(id){
    const rows=await query("SELECT f.id,f.tenant_id,v.id AS version_id,v.name,v.trigger_type,v.trigger_config,v.entry_node_key,v.nodes_snapshot FROM wa_flows f JOIN wa_flow_versions v ON v.flow_id=f.id AND v.status='published' WHERE f.tenant_id=? AND f.id=? AND f.status='active' LIMIT 1",[tenant,id]);
    return rows.map(f=>({...f,trigger_config:typeof f.trigger_config==="string"?JSON.parse(f.trigger_config):f.trigger_config,nodes:typeof f.nodes_snapshot==="string"?JSON.parse(f.nodes_snapshot):f.nodes_snapshot}));
  }
  let cached=definitions.get(tenant);
  if(!cached||cached.expires<Date.now()){
    if(!definitionReads.has(tenant)){
      const read=query("SELECT f.id,f.tenant_id,v.id AS version_id,v.name,v.trigger_type,v.trigger_config,v.entry_node_key,v.nodes_snapshot FROM wa_flows f JOIN wa_flow_versions v ON v.flow_id=f.id AND v.status='published' WHERE f.tenant_id=? AND f.status='active' ORDER BY f.id DESC LIMIT 100",[tenant]).then(rows=>{
        const flows=rows.map(f=>({...f,trigger_config:typeof f.trigger_config==="string"?JSON.parse(f.trigger_config):f.trigger_config,nodes:typeof f.nodes_snapshot==="string"?JSON.parse(f.nodes_snapshot):f.nodes_snapshot}));
        const bytes=Buffer.byteLength(JSON.stringify(flows));
        if(definitionReads.get(tenant)===read&&bytes<=16*1048576){
          invalidate(tenant);
          while(definitions.size&&(definitions.size>=64||definitionBytes+bytes>16*1048576))invalidate(definitions.keys().next().value);
          definitions.set(tenant,{flows,bytes,expires:Date.now()+15000});definitionBytes+=bytes;
        }
        return flows;
      }).finally(()=>{if(definitionReads.get(tenant)===read)definitionReads.delete(tenant);});definitionReads.set(tenant,read);
    }
    const flows=await definitionReads.get(tenant);return id?flows.filter(f=>Number(f.id)===Number(id)):flows;
  }
  return id?cached.flows.filter(f=>Number(f.id)===Number(id)):cached.flows;
}
async function deliver(c,state,message,messageId,index,vars){
  const fresh=await row(c.tenant_id,c.id);
  if(!eligible(fresh)||fresh.automation_mode!=="flow"||Number(fresh.automation_version)!==state.version||states.get(state.key)!==state)throw fail("Flow interrupted by an employee or conversation change");
  if(!(await query("SELECT id FROM wa_flows WHERE tenant_id=? AND id=? AND status='active'",[c.tenant_id,state.flow.id])).length)throw fail("Flow is no longer active");
  const requestId=`flow-${crypto.createHash("sha256").update(`${c.tenant_id}:${c.id}:${state.runId}:${messageId}:${index}`).digest("hex")}`;
  const claim=await query("INSERT IGNORE INTO wa_inbox_send_requests (tenant_id,conversation_id,request_id) VALUES (?,?,?)",[c.tenant_id,c.id,requestId]);
  if(!claim.affectedRows)throw fail("This flow delivery was already attempted");
  let result,providerId;
  try{
    const client=await require("./waConfigHelper").cloudClientForTenantSender(c.tenant_id,c.sender_id,c.branch_id);
    if(message.type==="template"){
      const [template]=await query("SELECT * FROM wa_templates WHERE tenant_id=? AND (id=? OR name=?) AND waba_id=? AND meta_status='APPROVED' AND meta_template_id IS NOT NULL LIMIT 1",[c.tenant_id,Number(message.template_id)||0,message.template_name||"",client.wabaId]);
      if(!template)throw fail("Template approval does not belong to this sender's WhatsApp Business Account");
      const required=Math.max(0,...[...template.body.matchAll(/\{\{(\d+)\}\}/g)].map(match=>Number(match[1])));
      if(required!==message.parameters.length||template.header_type&&template.header_type!=="TEXT"||/[{}]/.test(template.header_value||""))throw fail("Configure all body parameters; media or variable headers require the advanced sender workflow");
      const parameters=message.parameters.map(value=>({type:"text",text:definition.interpolate(value,vars)}));
      result=await client.sendTemplate(c.contact_phone,template.name,template.language,parameters.length?[{type:"body",parameters}]:[],15000);
    }else if(message.type==="media"){
      result=await client.sendMedia(c.contact_phone,message.media_type,message.url,message.text,message.filename);
    }else if(message.type==="cta_url"){
      result=await client.sendCTAUrl(c.contact_phone,message.text,message.button_text,message.url,null,null,15000);
    }else if(message.options){
      result=message.type==="send_buttons"?await client.sendInteractiveButtons(c.contact_phone,message.text,message.options,null,null,15000):await client.sendInteractiveList(c.contact_phone,message.text,"View options",message.options,null,null,15000);
    }else result=await client.sendText(c.contact_phone,message.text,false,15000);
    providerId=result?.messages?.[0]?.id||result?.id;if(!providerId)throw Object.assign(new Error("No provider confirmation"),{deliveryUnknown:true});
  }catch(error){
    const unknown=error.deliveryUnknown||/ETIMEDOUT|ECONNRESET|ECONNABORTED/.test(error.code||"");
    await query("UPDATE wa_inbox_send_requests SET status=? WHERE tenant_id=? AND request_id=?",[unknown?"unknown":"failed",c.tenant_id,requestId]);throw fail(unknown?"delivery_unknown":"flow_delivery_failed",502);
  }
  await query("UPDATE wa_inbox_send_requests SET status='sent',provider_id=? WHERE tenant_id=? AND request_id=?",[providerId,c.tenant_id,requestId]);
  await query("INSERT INTO wa_message_logs (tenant_id,conversation_id,sender_id,phone,direction,message_type,message_text,wa_message_id,status,sent_by) VALUES (?,?,?,?,'outbound',?,NULL,?,'sent','flow')",[c.tenant_id,c.id,c.sender_id,c.contact_phone,message.options?"interactive":message.type==="media"?message.media_type:message.type==="template"?"template":"text",providerId]);
  const body=message.options?`${message.text}\n${message.options.map((o,i)=>`${i+1}. ${o.title}`).join("\n")}`:message.type==="cta_url"?`${message.text}\n${message.url}`:message.text;
  await notify(c,"inbox_message",{message:{id:providerId,body,isMe:true,status:"sent",sentBy:"flow",...(message.type==="media"?{hasMedia:true,type:message.media_type,mediaUrl:message.url,filename:message.filename}:{}),timestamp:Math.floor(Date.now()/1000)}});
}
async function processMessage(tenant,id,messageId,input,isNew=false,flowId=null){
  let c=await row(tenant,id),state=states.get(cacheKey(tenant,id));
  if(!eligible(c)){if(state)await finish(state,"timed_out","conversation_unavailable");if(flowId)throw fail("Open this conversation inside its customer service window before starting a bot");return false;}
  let requested;
  if(flowId){
    [requested]=await published(tenant,flowId);
    if(!requested)throw fail("Publish and activate this flow before sending");
    definition.normalize(requested,{publish:true});
    if(state){await finish(state,"paused_by_agent","replaced_by_flow");state=null;}
  }
  if(/^(stop|unsubscribe|cancel bot|human|agent)$/i.test(input)){
    if(state)await finish(state,"handed_off","customer_handoff");
    await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1 WHERE tenant_id=? AND id=?",[tenant,id]);return true;
  }
  if(state&&(state.expires<Date.now()||c.automation_mode!=="flow"||Number(c.automation_version)!==state.version)){await finish(state,"timed_out","interrupted_or_expired");state=null;}
  if(state)state.expires=Date.now()+4*3600000;
  if(!state&&!flowId&&c.automation_mode==="flow"){
    await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1 WHERE tenant_id=? AND id=?",[tenant,id]);return true;
  }
  if(state&&!(await query("SELECT id FROM wa_flows WHERE tenant_id=? AND id=? AND status='active'",[tenant,state.flow.id])).length){await finish(state,"paused_by_agent","flow_disabled");await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1 WHERE tenant_id=? AND id=?",[tenant,id]);return true;}
  if(!state){
    if(!flowId&&c.automation_mode==="human"&&Number(c.automation_version)>0)return false;
    const flows=requested?[requested]:await published(tenant);
    const flow=requested||flows.find(f=>f.trigger_type==="keyword"&&(f.trigger_config?.keywords||[]).some(k=>String(k).toLowerCase()===input.trim().toLowerCase()))||flows.find(f=>f.trigger_type==="first_inbound"&&isNew)||flows.find(f=>f.trigger_type==="all_inbound");
    if(!flow){if(flowId)throw fail("Publish and activate this flow before sending");return false;}
    definition.normalize(flow,{publish:true});
    if(states.size>=256)throw fail("Bot session capacity reached; continue with an employee",503);
    if(flowId&&states.has(cacheKey(tenant,id)))cancel(tenant,id);
    const acquired=await query("UPDATE conversations SET automation_mode='flow',automation_version=automation_version+1,automation_error=NULL WHERE tenant_id=? AND id=? AND automation_version=?",[tenant,id,c.automation_version]);
    if(!acquired.affectedRows){if(flowId)throw fail("An employee changed this conversation while the bot was starting");return true;}
    c=await row(tenant,id);
    const result=await query("INSERT INTO wa_flow_runs (flow_id,conversation_id,phone,status,current_node_key,vars,last_advanced_at) VALUES (?,?,?,'active',?,NULL,NOW())",[flow.id,id,c.contact_phone,flow.entry_node_key]);
    state={key:cacheKey(tenant,id),tenantId:tenant,conversationId:id,flow,runId:result.insertId,version:Number(c.automation_version),expires:Date.now()+4*3600000,state:null};states.set(state.key,state);
    await query("UPDATE wa_flows SET execution_count=execution_count+1 WHERE id=? AND tenant_id=?",[flow.id,tenant]);
  }
  try{
    let deliveryIndex=0,actionIndex=0;
    const runAction=require("./flowIntegrations").createRunner();
    const assertCurrent=async()=>{
      const fresh=await row(tenant,id);
      if(!eligible(fresh)||fresh.automation_mode!=="flow"||Number(fresh.automation_version)!==state.version||states.get(state.key)!==state||!(await query("SELECT id FROM wa_flows WHERE tenant_id=? AND id=? AND status='active'",[tenant,state.flow.id])).length)throw Object.assign(fail("Flow interrupted by an employee or conversation change"),{flowInterrupted:true});
    };
    const result=await definition.execute(state.flow,input,state.state,{name:c.contact_name||"Customer","customer.name":c.contact_name||"Customer","customer.phone":c.contact_phone,"customer.email":c.contact_email||"","contact.exists":true},{
      onMessages:async(messages,vars)=>{for(const message of messages)await deliver(c,state,message,messageId,deliveryIndex++,vars);},
      onVisit:async logs=>{for(const nodeKey of logs)await query("INSERT INTO wa_flow_run_events (run_id,node_key,event_type,payload) VALUES (?,?,'step',NULL)",[state.runId,nodeKey]);},
      onAction:async(node,vars)=>{
        await assertCurrent();
        await query("INSERT INTO wa_flow_run_events (run_id,node_key,event_type,payload) VALUES (?,?,'action_started',NULL)",[state.runId,node.node_key]);
        try{
          const outputs=node.node_type==="ai_reply"?{[node.config.output_variable]:await require("./sharedInboxAssistant").generate(tenant,id,definition.interpolate(node.config.prompt,vars))}:await runAction(node,vars,{tenantId:tenant,conversationId:id,runId:state.runId,messageId,occurrence:actionIndex++});
          await assertCurrent();
          await query("INSERT INTO wa_flow_run_events (run_id,node_key,event_type,payload) VALUES (?,?,'action_succeeded',NULL)",[state.runId,node.node_key]);
          return outputs;
        }catch(error){
          await query("INSERT INTO wa_flow_run_events (run_id,node_key,event_type,payload) VALUES (?,?,'action_failed',NULL)",[state.runId,node.node_key]);
          throw error;
        }
      },
    });
    if(Buffer.byteLength(JSON.stringify(result.vars))>16384)throw fail("Collected answers exceed this bot's transient memory limit");
    const inputStep=state.flow.nodes.find(node=>node.node_key===state.state?.currentNodeKey);
    if(inputStep?.node_type==="collect_input"&&["name","email"].includes(inputStep.config.contact_field)&&result.currentNodeKey!==state.state?.currentNodeKey&&!result.vars._invalid_count){
      const field=inputStep.config.contact_field,value=result.vars[inputStep.config.variable];
      if(typeof value==="string")await query(`UPDATE wa_contacts ct JOIN conversations c ON c.contact_id=ct.id AND c.tenant_id=ct.tenant_id SET ct.${field}=? WHERE c.tenant_id=? AND c.id=? AND c.automation_mode='flow' AND c.automation_version=?`,[value,tenant,id,state.version]);
    }
    if(result.isEnded){await finish(state,result.isHandedOff?"handed_off":"completed",result.isHandedOff?"handoff":"end");await query("UPDATE conversations SET automation_mode=?,automation_version=automation_version+1 WHERE tenant_id=? AND id=? AND automation_version=?",[result.isHandedOff?"human":"idle",tenant,id,state.version]);await notify(c,"inbox_changed",{handoff:Boolean(result.isHandedOff)});}
    else{state.state={vars:result.vars,currentNodeKey:result.currentNodeKey};state.expires=Date.now()+4*3600000;await query("UPDATE wa_flow_runs SET current_node_key=?,last_advanced_at=NOW(),vars=NULL WHERE id=?",[result.currentNodeKey,state.runId]);}
    return true;
  }catch(error){
    await finish(state,"failed",error.message==="delivery_unknown"?"delivery_unknown":"flow_failed");
    await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1,automation_error=? WHERE tenant_id=? AND id=? AND automation_version=?",[error.message==="delivery_unknown"?"delivery_unknown":"flow_failed",tenant,id,state.version]);
    await notify(c,"inbox_changed",{flowFailed:true}).catch(()=>{});
    if(flowId)throw fail(error.message==="delivery_unknown"?"Delivery is uncertain. Check the provider before attempting another bot send.":"Bot delivery failed. The assigned employee can continue manually.",502);
    return true;
  }
}
async function run(tenant,id,messageId,input,isNew,flowId){
  if(pending>=64)throw fail("Bot queue is busy; retry shortly",503);pending++;
  try{return await require("./sharedInboxAssistant").schedule(tenant,id,()=>slots.run(()=>processMessage(tenant,id,messageId,String(input||"").slice(0,2000),isNew,flowId)));}catch(error){if(!error.status)error.status=503;throw error;}finally{pending--;}
}
async function start(tenant,id,flowId){return run(tenant,id,crypto.randomUUID(),"",false,flowId);}
async function recover(){await query("UPDATE wa_flow_runs SET status='timed_out',end_reason='runtime_restart',ended_at=NOW() WHERE conversation_id IS NOT NULL AND status='active'");await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1 WHERE automation_mode='flow'");}
let expiring=false;
async function expireIdle(now=Date.now()){
  if(expiring)return;expiring=true;
  try{for(const state of [...states.values()])if(state.expires<now&&states.get(state.key)===state){
    await finish(state,"timed_out","idle_timeout");
    await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1 WHERE tenant_id=? AND id=? AND automation_mode='flow' AND automation_version=?",[state.tenantId,state.conversationId,state.version]);
    await notify(await row(state.tenantId,state.conversationId),"inbox_changed",{flowExpired:true});
  }}finally{expiring=false;}
}
const timer=setInterval(()=>expireIdle().catch(error=>console.error("[FlowRuntime] Idle cleanup failed:",error.code||"FLOW_CLEANUP_FAILED")),60000);timer.unref();
module.exports={handle:run,start,cancel,recover,invalidate,expireIdle,capacity:()=>({sessions:states.size,pending,definitionBytes,executor:slots.stats()})};
