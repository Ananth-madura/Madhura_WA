"use strict";
const axios=require("axios");
const crypto=require("crypto");
const {encrypt,decrypt}=require("../backendutil/cryptoHelper");
const PROVIDERS={openai:"https://api.openai.com/v1/chat/completions",openrouter:"https://openrouter.ai/api/v1/chat/completions",groq:"https://api.groq.com/openai/v1/chat/completions",gemini:"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",deepseek:"https://api.deepseek.com/chat/completions"};
const queues=new Map();
const capacity=require("../config/capacity").limits();
const providerSlots=require("./boundedExecutor").createExecutor(capacity.ai,capacity.aiQueue);
let pending=0;
const settingsCache=new Map(),settingsReads=new Map();
const query=async(sql,params=[]) => (await require("../config/database").promise().query(sql,params))[0];
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
const key=(tenant,id)=>`${tenant}:${id}`;
async function settings(tenant){
  const cached=settingsCache.get(tenant);
  if(cached?.expires>Date.now())return cached.row;
  if(settingsReads.has(tenant))return settingsReads.get(tenant);
  const read=query("SELECT * FROM wa_inbox_ai_settings WHERE tenant_id=?",[tenant]).then(rows=>{
    const row=rows[0]||{tenant_id:tenant,enabled:0,auto_start:0,provider:"openai",model:"",system_prompt:"",api_key:null};
    if(settingsReads.get(tenant)===read){
      if(settingsCache.size>=2048)settingsCache.delete(settingsCache.keys().next().value);
      settingsCache.set(tenant,{row,expires:Date.now()+30000});
    }
    return row;
  }).finally(()=>{if(settingsReads.get(tenant)===read)settingsReads.delete(tenant);});
  settingsReads.set(tenant,read);return read;
}
async function publicSettings(tenant){const {api_key,...row}=await settings(tenant);return {...row,hasApiKey:Boolean(api_key)};}
async function saveSettings(tenant,input){
  const previous=await settings(tenant);
  const {enabled,autoStart,provider,model,systemPrompt,apiKey,clearKey=false}=input;
  if(typeof enabled!=="boolean"||typeof autoStart!=="boolean"||!PROVIDERS[provider]||typeof model!=="string"||model.length>150||typeof systemPrompt!=="string"||systemPrompt.length>10000||apiKey!==undefined&&(typeof apiKey!=="string"||apiKey.length>2000))throw failure("Valid AI settings are required");
  const storedKey=apiKey?.trim()?encrypt(apiKey.trim()):clearKey||previous.provider!==provider?null:previous.api_key;
  if(enabled&&(!model.trim()||!storedKey))throw failure("Set a model and API key before enabling this assistant");
  await query(`INSERT INTO wa_inbox_ai_settings (tenant_id,enabled,auto_start,provider,model,system_prompt,api_key) VALUES (?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),auto_start=VALUES(auto_start),provider=VALUES(provider),model=VALUES(model),system_prompt=VALUES(system_prompt),api_key=VALUES(api_key)`,[tenant,enabled?1:0,autoStart?1:0,provider,model.trim(),systemPrompt,storedKey]);
  settingsCache.delete(tenant);settingsReads.delete(tenant);
  return publicSettings(tenant);
}
async function conversation(tenant,id){
  const [row]=await query(`SELECT c.*,ct.name AS contact_name,ct.phone AS contact_phone,ct.is_unsubscribed,ct.is_blocked
    FROM conversations c JOIN wa_contacts ct ON ct.id=c.contact_id AND ct.tenant_id=c.tenant_id WHERE c.tenant_id=? AND c.id=?`,[tenant,id]);
  if(!row)throw failure("Conversation not found",404);
  return row;
}
async function generate(tenant,id,input){
  if(typeof input!=="string"||!input.trim()||input.length>4000)throw failure("Provide the current customer message, up to 4000 characters");
  const config=await settings(tenant),row=await conversation(tenant,id);
  if(!config.enabled||!config.api_key||!config.model)throw failure("The assistant is disabled or not configured",409);
  const system=[config.system_prompt||"Help the customer with the business's services. Keep replies concise.",
    "You only have the current customer message and their name. Do not invent previous chat history, account records, prices, completed actions, or internal notes. Ask for clarification when information is missing. You cannot execute tools or perform CRM changes.",
    `Customer name: ${String(row.contact_name||"Customer").slice(0,255)}`].join("\n\n");
  try{
    const {data}=await providerSlots.run(()=>axios.post(PROVIDERS[config.provider],{model:config.model,messages:[{role:"system",content:system},{role:"user",content:input}],temperature:0.2,max_tokens:350},
      {headers:{Authorization:`Bearer ${decrypt(config.api_key)}`,"Content-Type":"application/json"},timeout:15000,maxContentLength:512*1024,maxRedirects:0}));
    const text=data?.choices?.[0]?.message?.content;
    if(typeof text!=="string"||!text.trim())throw new Error("Empty provider reply");
    return text.trim().slice(0,4096);
  }catch(_){throw failure("The AI provider could not generate a reply. Your employee can continue manually.",502);}
}
function schedule(tenant,id,work){
  const entry=key(tenant,id),previous=queues.get(entry)||Promise.resolve();
  const task=previous.catch(()=>{}).then(work);
  queues.set(entry,task);
  task.finally(()=>{if(queues.get(entry)===task)queues.delete(entry);}).catch(()=>{});
  return task;
}
async function pause(tenant,id){
  require("./sharedFlowRuntime").cancel(tenant,id);
  await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1,automation_error=NULL WHERE tenant_id=? AND id=?",[tenant,id]);
  await queues.get(key(tenant,id))?.catch(()=>{});
}
async function humanSend(tenant,id,send){
  require("./sharedFlowRuntime").cancel(tenant,id);
  await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1,automation_error=NULL WHERE tenant_id=? AND id=?",[tenant,id]);
  return schedule(tenant,id,send);
}
async function resume(tenant,id){
  const config=await settings(tenant);
  if(!config.enabled||!config.api_key)throw failure("Enable the business assistant before resuming this chat",409);
  require("./sharedFlowRuntime").cancel(tenant,id);
  await query("UPDATE conversations SET automation_mode='assistant',automation_version=automation_version+1,automation_error=NULL WHERE tenant_id=? AND id=?",[tenant,id]);
}
async function notify(tenant,id,event,payload){
  const row=await conversation(tenant,id);
  await require("./sharedInboxService").createInboxService(require("../config/database")).emit(require("../sockets/chatsockets").getIO(),row,event,payload);
}
function canSend(row){return row.automation_mode==="assistant"&&row.status==="open"&&!row.is_unsubscribed&&!row.is_blocked&&row.service_window_expires_at&&new Date(row.service_window_expires_at).getTime()>Date.now();}
async function processMessage(tenant,id,messageId,input,isNew){
  const config=await settings(tenant);
  if(!config.enabled)return;
  if(isNew&&config.auto_start)await query("UPDATE conversations SET automation_mode='assistant' WHERE tenant_id=? AND id=? AND automation_mode='human' AND automation_version=0",[tenant,id]);
  let row=await conversation(tenant,id);
  if(!canSend(row))return;
  if(/\b(human|agent|speak to someone|speak to a person)\b/i.test(input)){
    await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1 WHERE tenant_id=? AND id=?",[tenant,id]);
    await notify(tenant,id,"inbox_changed",{handoff:true});return;
  }
  const version=Number(row.automation_version);
  const text=await generate(tenant,id,input);
  row=await conversation(tenant,id);
  if(!canSend(row)||Number(row.automation_version)!==version||!(await settings(tenant)).enabled)return;
  const client=await require("./waConfigHelper").cloudClientForTenantSender(tenant,row.sender_id,row.branch_id);
  if(!client.isConfigured())throw failure("Sender unavailable",503);
  const requestId=`ai-${crypto.createHash("sha256").update(`${tenant}:${id}:${messageId}`).digest("hex")}`;
  const claim=await query("INSERT IGNORE INTO wa_inbox_send_requests (tenant_id,conversation_id,request_id) VALUES (?,?,?)",[tenant,id,requestId]);
  if(!claim.affectedRows)return;
  let providerId;
  try{
    const result=await client.sendText(row.contact_phone,text,false,15000);
    providerId=result?.messages?.[0]?.id||result?.id;
    if(!providerId)throw Object.assign(new Error("No provider confirmation"),{deliveryUnknown:true});
  }catch(error){
    const unknown=Boolean(error.deliveryUnknown)||/ETIMEDOUT|ECONNRESET|ECONNABORTED/.test(error.code||"");
    await query("UPDATE wa_inbox_send_requests SET status=? WHERE tenant_id=? AND request_id=?",[unknown?"unknown":"failed",tenant,requestId]);
    throw failure(unknown?"delivery_unknown":"send_failed",502);
  }
  try{
    await query("UPDATE wa_inbox_send_requests SET status='sent',provider_id=? WHERE tenant_id=? AND request_id=?",[providerId,tenant,requestId]);
    await query("INSERT INTO wa_message_logs (tenant_id,conversation_id,sender_id,phone,direction,message_type,message_text,wa_message_id,status,sent_by) VALUES (?,?,?,?,'outbound','text',?,?,'sent','assistant')",[tenant,id,row.sender_id,row.contact_phone,text,providerId]);
  }catch(_){/* Provider confirmation must never become an automatic resend. */}
  await notify(tenant,id,"inbox_message",{message:{id:providerId,body:text,isMe:true,status:"sent",sentBy:"assistant",timestamp:Math.floor(Date.now()/1000)}});
}
function enqueue(tenant,id,messageId,input,isNew=false){
  if(typeof input!=="string"||!input.trim())return;
  if(pending>=200){query("UPDATE conversations SET automation_mode='human',automation_error='queue_full' WHERE tenant_id=? AND id=?",[tenant,id]).catch(()=>{});return;}
  pending++;
  schedule(tenant,id,async()=>{
    try{await processMessage(tenant,id,messageId,input.slice(0,4000),isNew);}
    catch(error){
      await query("UPDATE conversations SET automation_mode='human',automation_version=automation_version+1,automation_error=? WHERE tenant_id=? AND id=?",[error.message==="delivery_unknown"?"delivery_unknown":"assistant_failed",tenant,id]).catch(()=>{});
      await notify(tenant,id,"inbox_changed",{assistantFailed:true}).catch(()=>{});
    }finally{pending--;}
  }).catch(()=>{});
}
async function idle(){await Promise.allSettled([...queues.values()]);}
module.exports={publicSettings,saveSettings,generate,pause,resume,humanSend,enqueue,idle,schedule,capacity:()=>({pending,provider:providerSlots.stats()})};
