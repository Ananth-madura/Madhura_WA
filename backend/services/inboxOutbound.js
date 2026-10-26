"use strict";
const { createInboxService } = require("./sharedInboxService");
const fail = (status,message) => Object.assign(new Error(message),{status});
const MAX_UPLOAD = 8*1024*1024;
const types = new Map([
  ["image/jpeg","image"],["image/png","image"],["image/webp","image"],
  ["video/mp4","video"],["audio/mpeg","audio"],["audio/ogg","audio"],["audio/mp4","audio"],
  ["application/pdf","document"],["text/plain","document"],["text/csv","document"],
  ["application/msword","document"],["application/vnd.ms-excel","document"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document","document"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","document"]
]);
function validateFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length || file.buffer.length>MAX_UPLOAD) throw fail(400,"Choose a nonempty file up to 8 MB");
  const kind=types.get(file.mimetype);
  if (!kind || kind==="image" && file.buffer.length>5*1024*1024) throw fail(400,"Choose a supported attachment; images must be at most 5 MB");
  const bytes=file.buffer;
  const signatures={"image/jpeg":()=>bytes[0]===255&&bytes[1]===216&&bytes[2]===255,"image/png":()=>bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),"image/webp":()=>bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP","application/pdf":()=>bytes.toString("ascii",0,5)==="%PDF-","video/mp4":()=>bytes.toString("ascii",4,8)==="ftyp","audio/ogg":()=>bytes.toString("ascii",0,4)==="OggS"};
  if(signatures[file.mimetype]&&!signatures[file.mimetype]())throw fail(400,"File contents do not match the selected file type");
  const filename=String(file.originalname||"attachment").replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,150)||"attachment";
  return {kind,filename,mimetype:file.mimetype};
}
function variableCount(value) {
  const matches=[...String(value||"").matchAll(/\{\{(\d+)\}\}/g)].map(match=>Number(match[1]));
  const maximum=Math.max(0,...matches);
  if(maximum>20||Array.from({length:maximum},(_,i)=>i+1).some(i=>!matches.includes(i))||/\{\{[^}]*[^\d}][^}]*\}\}/.test(String(value||"")))throw fail(400,"This template uses unsupported variables");
  return maximum;
}
function values(input, count, label) {
  if(!Array.isArray(input)||input.length!==count||input.some(value=>typeof value!=="string"||!value.trim()||value.length>1024))throw fail(400,`Provide ${count} ${label} values, each 1–1024 characters`);
  return input.map(value=>({type:"text",text:value}));
}
function createInboxOutbound(db) {
  const inbox=createInboxService(db),q=inbox.query;
  const clientFor=row=>require("./waConfigHelper").cloudClientForTenantSender(row.tenant_id,row.sender_id,row.branch_id);
  async function catalog(req,id) {
    const row=await inbox.conversation(req,id),client=await clientFor(row);
    const templates=await q("SELECT id,name,body,language,header_type,header_value,buttons FROM wa_templates WHERE tenant_id=? AND waba_id=? AND meta_status='APPROVED' AND meta_template_id IS NOT NULL AND (sender_id IS NULL OR sender_id=?) ORDER BY id DESC LIMIT 100",[req.tenantId,client.wabaId,row.sender_id]);
    return templates;
  }
  async function send(req,id,data,file=null) {
    if(["read_only","campaign_only"].includes(req.waAccessLevel))throw fail(403,"Outbound messaging is not permitted");
    const row=await inbox.conversation(req,id);
    if(row.status==="closed")throw fail(409,"Reopen this conversation before sending");
    const requestId=String(data.requestId||"");
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))throw fail(400,"A unique request ID is required");
    const isTemplate=data.kind==="template";
    if(!isTemplate&&data.kind!=="attachment")throw fail(400,"Choose attachment or template");
    if(!isTemplate&&new Date(row.service_window_expires_at||0).getTime()<=Date.now())throw fail(409,"The service window expired. Use an approved template");
    const [contact]=await q("SELECT is_blocked,is_unsubscribed,opt_in_status FROM wa_contacts WHERE tenant_id=? AND id=?",[req.tenantId,row.contact_id]);
    if(!contact||contact.is_blocked||contact.is_unsubscribed)throw fail(403,"The customer is blocked or has opted out");
    const client=await clientFor(row);
    if(!client.isConfigured())throw fail(503,"The WhatsApp number is not configured");
    let template,components=[],media=file?validateFile(file):null;
    const caption=String(data.caption||"").trim();
    if(caption.length>1024)throw fail(400,"Attachment captions may contain up to 1024 characters");
    if(isTemplate) {
      [template]=await q("SELECT * FROM wa_templates WHERE tenant_id=? AND id=? AND waba_id=? AND meta_status='APPROVED' AND meta_template_id IS NOT NULL AND (sender_id IS NULL OR sender_id=?)",[req.tenantId,Number(data.templateId)||0,client.wabaId,row.sender_id]);
      if(!template)throw fail(400,"Select an approved template from this number's WhatsApp Business Account");
      if(String(template.category).toUpperCase()==="MARKETING"&&!contact.opt_in_status)throw fail(403,"Marketing consent must be recorded before sending this template");
      const body=values(data.parameters||[],variableCount(template.body),"body variable");
      if(body.length)components.push({type:"body",parameters:body});
      const header=String(template.header_type||"").toLowerCase();
      if(["image","video","document"].includes(header)) {
        if(!media||media.kind!==header)throw fail(400,`This template requires a ${header} attachment`);
      } else {
        if(media)throw fail(400,"This template does not accept a media header");
        const headerValues=values(data.headerParameters||[],variableCount(template.header_value),"header variable");
        if(headerValues.length)components.push({type:"header",parameters:headerValues});
      }
      let buttons=typeof template.buttons==="string"?JSON.parse(template.buttons||"[]"):template.buttons||[];
      if(!Array.isArray(buttons))buttons=[];
      for(const [index,button] of buttons.entries())if(String(button.type).toLowerCase()==="url"&&variableCount(button.url)){
        if(variableCount(button.url)!==1)throw fail(400,"URL buttons must use one variable");
        const [parameter]=values([data.buttonParameters?.[String(index)]],1,"button URL variable");
        components.push({type:"button",sub_type:"url",index:String(index),parameters:[parameter]});
      }
    } else if(!media)throw fail(400,"Choose an attachment");
    const claim=await q("INSERT IGNORE INTO wa_inbox_send_requests (tenant_id,conversation_id,request_id) VALUES (?,?,?)",[req.tenantId,row.id,requestId]);
    if(!claim.affectedRows) {
      const [previous]=await q("SELECT conversation_id,status,provider_id FROM wa_inbox_send_requests WHERE tenant_id=? AND request_id=?",[req.tenantId,requestId]);
      if(Number(previous.conversation_id)!==Number(row.id))throw fail(409,"This request belongs to a different conversation");
      if(previous.status==="sent")return {success:true,providerId:previous.provider_id,alreadySent:true};
      throw fail(409,"This send was already attempted. Check its delivery before trying a new request");
    }
    let mediaId=null,providerId,deliveryAttempted=false;
    try {
      if(media){const uploaded=await client.uploadMedia(file.buffer,media.mimetype,media.filename);mediaId=uploaded?.id;if(!mediaId)throw new Error("Media upload was not confirmed");}
      if(isTemplate&&media)components.unshift({type:"header",parameters:[{type:media.kind,[media.kind]:{id:mediaId,...(media.kind==="document"?{filename:media.filename}:{})}}]});
      await inbox.conversation(req,row.id);
      const result=await require("./sharedInboxAssistant").humanSend(req.tenantId,row.id,async()=>{
        await inbox.conversation(req,row.id);
        deliveryAttempted=true;
        return isTemplate?client.sendTemplate(row.contact_phone,template.name,template.language,components,15000):client.sendMedia(row.contact_phone,media.kind,mediaId,caption,media.filename);
      });
      providerId=result?.messages?.[0]?.id||result?.id;
      if(!providerId)throw Object.assign(new Error("Delivery was not confirmed"),{deliveryUnknown:true});
    } catch(error) {
      const unknown=deliveryAttempted&&(error.deliveryUnknown||Number(error.status)>=500||/ETIMEDOUT|ECONNRESET|ECONNABORTED/.test(error.code||""));
      await q("UPDATE wa_inbox_send_requests SET status=? WHERE tenant_id=? AND request_id=?",[unknown?"unknown":"failed",req.tenantId,requestId]);
      if(error.status)throw error;
      throw fail(unknown?504:502,unknown?"Delivery is unknown. Do not resend automatically.":"WhatsApp could not complete this upload or send");
    }
    const body=isTemplate?String(template.body).replace(/\{\{(\d+)\}\}/g,(_,index)=>String(data.parameters?.[Number(index)-1]||"")):caption||media.filename;
    const message={id:providerId,body,isMe:true,sentBy:"employee",status:"sent",timestamp:Math.floor(Date.now()/1000),type:isTemplate?"template":media.kind,hasMedia:Boolean(mediaId),cloudMediaId:mediaId,filename:media?.filename,mimetype:media?.mimetype};
    try {
      await q("UPDATE wa_inbox_send_requests SET status='sent',provider_id=? WHERE tenant_id=? AND request_id=?",[providerId,req.tenantId,requestId]);
      await q("INSERT INTO wa_message_logs (tenant_id,conversation_id,sender_id,branch_id,phone,direction,message_type,message_text,wa_message_id,status,sent_by,media_id) VALUES (?,?,?,?,?,'outbound',?,NULL,?,'sent','employee',?)",[req.tenantId,row.id,row.sender_id,row.branch_id,row.contact_phone,message.type,providerId,mediaId]);
      await q("UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?",[req.tenantId,row.id]);
      await require("./waDeliveryReceipts").flushDeliveryReceipt(providerId);
    } catch(error){console.error("[InboxOutbound] Confirmed send metadata failed",error.code||"DB_ERROR");}
    await inbox.emit(req.app?.get("io"),row,"inbox_message",{message}).catch(()=>{});
    return {success:true,message};
  }
  return { catalog,send };
}
module.exports={createInboxOutbound,validateFile,variableCount,MAX_UPLOAD};
