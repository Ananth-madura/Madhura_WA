"use strict";
const {createEmployeeWorkspace,positiveId,text}=require("./employeeWorkspace");
const {variableCount}=require("./inboxOutbound");
const fail=(status,message)=>Object.assign(new Error(message),{status});
function createEmployeeCampaigns(db) {
  const workspace=createEmployeeWorkspace(db),inbox=workspace.inbox,q=inbox.query;
  async function authorize(req,edit=false,reader=q){
    await workspace.requireModule(req,"campaigns",edit,reader);
    await workspace.requireModule(req,"customers",false,reader);
    if(edit&&req.waAccessLevel==="read_only")throw fail(403,"This account cannot launch campaigns");
  }
  async function sender(req,id,branchId=null,reader=q,resolve=true) {
    const rows=await reader(`SELECT s.id,s.display_phone FROM wa_senders s WHERE s.tenant_id=? AND s.id=? AND s.status='connected'
      ${branchId?"AND EXISTS (SELECT 1 FROM sender_branch_assignments a WHERE a.tenant_id=s.tenant_id AND a.sender_id=s.id AND a.branch_id=?)":""}
      ${inbox.isAdmin(req)?"":"AND EXISTS (SELECT 1 FROM sender_branch_assignments a JOIN staff_branch_memberships m ON m.tenant_id=a.tenant_id AND m.branch_id=a.branch_id WHERE a.tenant_id=s.tenant_id AND a.sender_id=s.id AND m.user_id=?) AND (NOT EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=s.tenant_id AND a.user_id=?) OR EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=s.tenant_id AND a.user_id=? AND a.sender_id=s.id))"}`, [req.tenantId,positiveId(id),...(branchId?[branchId]:[]),...(inbox.isAdmin(req)?[]:[req.user.id,req.user.id,req.user.id])]);
    if(!rows.length)throw fail(404,"WhatsApp number not found in your permitted scope");
    if(!resolve)return rows[0];
    return require("./waConfigHelper").cloudClientForTenantSender(req.tenantId,Number(id),branchId);
  }
  async function templates(req,senderId) {
    await authorize(req);const client=await sender(req,senderId);
    const rows=await q("SELECT id,name,language,body,header_type,header_value,buttons FROM wa_templates WHERE tenant_id=? AND waba_id=? AND meta_status='APPROVED' AND meta_template_id IS NOT NULL AND (sender_id IS NULL OR sender_id=?) ORDER BY id DESC LIMIT 100",[req.tenantId,client.wabaId,Number(senderId)]);
    return rows.filter(row=>{try{const buttons=typeof row.buttons==="string"?JSON.parse(row.buttons||"[]"):row.buttons||[];variableCount(row.body);return (!row.header_type||['TEXT','NONE'].includes(String(row.header_type).toUpperCase()))&&!variableCount(row.header_value)&&(!Array.isArray(buttons)||!buttons.some(button=>/\{\{/.test(button.url||"")));}catch(_){return false;}});
  }
  async function recipients(req,filters={}) {
    await authorize(req);const access=await workspace.scope(req,"ct",{campaign:true});
    const before=filters.before?positiveId(filters.before):null,search=String(filters.search||"").slice(0,100);
    const rows=await q(`SELECT ct.id,ct.name,ct.phone,ct.opt_in_status FROM wa_contacts ct WHERE ${access.sql}
      ${before?"AND ct.id<?":""} ${search?"AND (ct.name LIKE ? OR ct.phone LIKE ?)":""} ORDER BY ct.id DESC LIMIT 51`,[...access.params,...(before?[before]:[]),...(search?[`%${search}%`,`%${search}%`]:[])]);
    return {records:rows.slice(0,50),nextCursor:rows.length>50?rows[49].id:null};
  }
  async function campaign(req,id,query=q,lock=false) {
    await authorize(req,false,query);
    const [row]=await query(`SELECT * FROM wa_campaigns WHERE tenant_id=? AND id=? AND audience_policy='assigned_customers' ${inbox.isAdmin(req)?"":"AND created_by=?"}${lock?" FOR UPDATE":""}`,[req.tenantId,positiveId(id),...(inbox.isAdmin(req)?[]:[req.user.id])]);
    if(!row)throw fail(404,"Campaign not found");return row;
  }
  async function list(req,before) {
    await authorize(req);const access=await workspace.scope(req,"ct",{campaign:true});
    const rows=await q(`SELECT c.id,c.name,c.status,c.created_at,c.created_by,c.sender_id,
      (SELECT COUNT(*) FROM wa_campaign_messages m JOIN wa_contacts ct ON ct.id=m.contact_id AND ct.tenant_id=m.tenant_id WHERE m.campaign_id=c.id AND m.tenant_id=c.tenant_id AND ${access.sql}) AS visible_recipients
      FROM wa_campaigns c WHERE c.tenant_id=? AND c.audience_policy='assigned_customers' ${inbox.isAdmin(req)?"":"AND c.created_by=?"} ${before?"AND c.id<?":""} ORDER BY c.id DESC LIMIT 26`,[...access.params,req.tenantId,...(inbox.isAdmin(req)?[]:[req.user.id]),...(before?[positiveId(before)]:[])]);
    return {records:rows.slice(0,25),nextCursor:rows.length>25?rows[24].id:null,canEdit:await workspace.permission(req,"campaigns",true)&&req.waAccessLevel!=="read_only"};
  }
  async function visibleCount(req,id,query=q){
    const access=await workspace.scope(req,"ct",{campaign:true},query);
    const [row]=await query(`SELECT COUNT(*) AS count FROM wa_campaign_messages m JOIN wa_contacts ct ON ct.tenant_id=m.tenant_id AND ct.id=m.contact_id WHERE m.tenant_id=? AND m.campaign_id=? AND ${access.sql}`,[req.tenantId,Number(id),...access.params]);
    return Number(row.count);
  }
  async function results(req,id,before) {
    await campaign(req,id);const access=await workspace.scope(req,"ct",{campaign:true});
    const rows=await q(`SELECT m.id,m.contact_id,ct.name,ct.phone,m.status,m.sent_at,m.delivered_at,m.read_at FROM wa_campaign_messages m
      JOIN wa_contacts ct ON ct.tenant_id=m.tenant_id AND ct.id=m.contact_id WHERE m.tenant_id=? AND m.campaign_id=? AND ${access.sql} ${before?"AND m.id<?":""} ORDER BY m.id DESC LIMIT 51`,[req.tenantId,Number(id),...access.params,...(before?[positiveId(before)]:[])]);
    const totals=await q(`SELECT m.status,COUNT(*) AS count FROM wa_campaign_messages m JOIN wa_contacts ct ON ct.tenant_id=m.tenant_id AND ct.id=m.contact_id WHERE m.tenant_id=? AND m.campaign_id=? AND ${access.sql} GROUP BY m.status`,[req.tenantId,Number(id),...access.params]);
    return {records:rows.slice(0,50),nextCursor:rows.length>50?rows[49].id:null,summary:Object.fromEntries(totals.map(row=>[row.status,Number(row.count)]))};
  }
  async function create(req,data) {
    await authorize(req,true);
    const name=text(data.name,255,true),senderId=positiveId(data.senderId),templateId=positiveId(data.templateId);
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(String(data.requestKey||"")))throw fail(400,"A unique campaign request key is required");
    if(!Array.isArray(data.contactIds)||!data.contactIds.length||data.contactIds.length>100||new Set(data.contactIds.map(Number)).size!==data.contactIds.length)throw fail(400,"Select 1–100 unique assigned customers");
    const client=await sender(req,senderId);
    const [template]=await q("SELECT * FROM wa_templates WHERE tenant_id=? AND id=? AND waba_id=? AND meta_status='APPROVED' AND meta_template_id IS NOT NULL AND (sender_id IS NULL OR sender_id=?)",[req.tenantId,templateId,client.wabaId,senderId]);
    if(!template)throw fail(400,"An approved template for this number is required");
    const params=data.parameters||[];
    if(!Array.isArray(params)||params.length!==variableCount(template.body)||params.some(value=>typeof value!=="string"||!value.trim()||value.length>1024))throw fail(400,"Fill all approved template body values");
    let buttons=typeof template.buttons==="string"?JSON.parse(template.buttons||"[]"):template.buttons||[];
    if(!Array.isArray(buttons))buttons=[];
    if(template.header_type&&!['TEXT','NONE'].includes(String(template.header_type).toUpperCase())||variableCount(template.header_value)||buttons.some(button=>/\{\{/.test(button.url||"")))throw fail(400,"Campaigns currently require a static header and static buttons. Use the inbox composer for media and variable headers");
    return inbox.transaction(async query=>{
      const [existing]=await query("SELECT id,created_by,name,sender_id,template_id,template_parameters FROM wa_campaigns WHERE tenant_id=? AND request_key=? FOR UPDATE",[req.tenantId,data.requestKey]);
      if(existing){
        if(Number(existing.created_by)!==Number(req.user.id))throw fail(409,"The request key is already in use");
        const saved=await query("SELECT contact_id FROM wa_campaign_messages WHERE tenant_id=? AND campaign_id=? ORDER BY contact_id",[req.tenantId,existing.id]);
        const ids=[...data.contactIds].map(Number).sort((a,b)=>a-b);
        if(existing.name!==name||Number(existing.sender_id)!==senderId||Number(existing.template_id)!==templateId||existing.template_parameters!==JSON.stringify(params)||JSON.stringify(saved.map(row=>Number(row.contact_id)))!==JSON.stringify(ids))throw fail(409,"This request already saved a different draft. Review that draft or reset the form to create a separate one");
        return {id:existing.id,alreadyCreated:true};
      }
      const contacts=[];
      for(const id of [...data.contactIds].map(positiveId).sort((a,b)=>a-b)) {
        const contact=await workspace.customer(req,id,query,true,{campaign:true});
        const [consent]=await query("SELECT opt_in_status,is_blocked,is_unsubscribed FROM wa_contacts WHERE tenant_id=? AND id=?",[req.tenantId,id]);
        if(!consent?.opt_in_status||consent.is_blocked||consent.is_unsubscribed)throw fail(400,"Every recipient must have current opt-in and be unblocked");
        await sender(req,senderId,contact.branch_id,query,false);
        contacts.push(contact);
      }
      const result=await query("INSERT INTO wa_campaigns (tenant_id,name,type,template_id,status,total_contacts,created_by,session_key,audience_policy,sender_id,request_key,template_parameters,retry_failed,random_delay_min,random_delay_max,start_time,end_time) VALUES (?,?,'template',?,'draft',?,?,?,'assigned_customers',?,?,?,0,2,4,'00:00','23:59')",[req.tenantId,name,templateId,contacts.length,req.user.id,String(req.user.id),senderId,data.requestKey,JSON.stringify(params)]);
      for(const contact of contacts)await query("INSERT INTO wa_campaign_messages (tenant_id,campaign_id,contact_id,phone,status) VALUES (?,?,?,?,'queued')",[req.tenantId,result.insertId,contact.id,contact.phone]);
      await query("INSERT INTO wa_workspace_audit (tenant_id,actor_id,action,subject_user_id,details) VALUES (?,?,'campaign.created',?,?)",[req.tenantId,req.user.id,req.user.id,JSON.stringify({campaignId:result.insertId,recipientCount:contacts.length,senderId})]);
      return {id:result.insertId};
    });
  }
  async function control(req,id,action,confirmCount) {
    await authorize(req,true);
    const allowed={start:["draft","scheduled"],resume:["paused"],pause:["running"],cancel:["draft","scheduled","paused","running"]};
    if(!allowed[action])throw fail(400,"Choose a valid campaign action");
    await inbox.transaction(async query=>{
      const row=await campaign(req,id,query,true);
      if(!allowed[action].includes(row.status))throw fail(409,"Campaign status changed. Refresh before continuing");
      if(["start","resume"].includes(action)){
        const count=await visibleCount(req,row.id,query);
        if(!count)throw fail(409,"No authorized campaign recipients remain");
        if(Number(confirmCount)!==count)throw fail(400,`Confirm the current authorized recipient count (${count}) before launch`);
      }
      const status={start:"running",resume:"running",pause:"paused",cancel:"cancelled"}[action];
      await query("UPDATE wa_campaigns SET status=?,started_at=COALESCE(started_at,CURRENT_TIMESTAMP) WHERE tenant_id=? AND id=?",[status,req.tenantId,row.id]);
      await query("INSERT INTO wa_workspace_audit (tenant_id,actor_id,action,details) VALUES (?,?,?,?)",[req.tenantId,req.user.id,`campaign.${action}`,JSON.stringify({campaignId:row.id})]);
    });
    if(["start","resume"].includes(action))await require("./waCampaignEngine").pollEmployeeCampaigns();
    return {success:true};
  }
  async function dispatch(message) {
    const [row]=await q("SELECT * FROM wa_campaigns WHERE id=? AND tenant_id=? AND audience_policy='assigned_customers'",[message.campaign_id,message.tenant_id]);
    if(!row||row.status!=="running")return {skipped:true,reason:"campaign_not_running"};
    const [claim]=await db.promise().query("UPDATE wa_campaign_messages SET status='sending',attempts=attempts+1,claimed_at=CURRENT_TIMESTAMP WHERE id=? AND campaign_id=? AND tenant_id=? AND status='queued'",[message.id,row.id,row.tenant_id]);
    if(!claim.affectedRows)return {skipped:true,reason:"already_claimed"};
    let deliveryAttempted=false,providerAccepted=false;
    try {
      const [actor]=await q("SELECT u.id,u.whatsapp_access_level,m.role FROM users u JOIN organization_memberships m ON m.user_id=u.id AND m.tenant_id=? AND m.membership_status='active' JOIN tenants t ON t.id=m.tenant_id AND t.status='active' WHERE u.id=? AND u.status='active'",[row.tenant_id,row.created_by]);
      if(!actor)throw fail(403,"Campaign principal is no longer active");
      const req={tenantId:row.tenant_id,user:{id:actor.id},userRole:actor.role,waAccessLevel:actor.whatsapp_access_level||"full"};
      await authorize(req,true);
      const contact=await workspace.customer(req,message.contact_id,q,false,{campaign:true});
      if(contact.phone!==message.phone)throw fail(403,"Recipient identity changed");
      const [consent]=await q("SELECT opt_in_status,is_blocked,is_unsubscribed FROM wa_contacts WHERE tenant_id=? AND id=?",[row.tenant_id,contact.id]);
      if(!consent?.opt_in_status||consent.is_blocked||consent.is_unsubscribed)throw fail(403,"Recipient is no longer opted in");
      const client=await sender(req,row.sender_id,contact.branch_id);
      const [template]=await q("SELECT name,body,language FROM wa_templates WHERE tenant_id=? AND id=? AND waba_id=? AND meta_status='APPROVED' AND meta_template_id IS NOT NULL AND (sender_id IS NULL OR sender_id=?)",[row.tenant_id,row.template_id,client.wabaId,row.sender_id]);
      if(!template)throw fail(403,"Template approval changed");
      const params=JSON.parse(row.template_parameters||"[]");
      if(params.length!==variableCount(template.body))throw fail(403,"Template variables changed");
      const parameters=params.map(value=>({type:"text",text:value.replace(/\{(name|phone|email)\}/g,(_,field)=>String(contact[field]||""))}));
      await authorize(req,true);
      await workspace.customer(req,contact.id,q,false,{campaign:true});
      const [current]=await q("SELECT status FROM wa_campaigns WHERE tenant_id=? AND id=?",[row.tenant_id,row.id]);
      if(current?.status!=="running"){
        await q("UPDATE wa_campaign_messages SET status=? WHERE tenant_id=? AND id=?",[current?.status==="paused"?"queued":"skipped",row.tenant_id,message.id]);
        return {skipped:true,reason:"campaign_stopped_before_send"};
      }
      deliveryAttempted=true;
      const response=await client.sendTemplate(contact.phone,template.name,template.language,parameters.length?[{type:"body",parameters}]:[],15000);
      const providerId=response?.messages?.[0]?.id||response?.id;
      if(!providerId)throw Object.assign(new Error("No provider confirmation"),{deliveryUnknown:true});
      providerAccepted=true;
      await q("UPDATE wa_campaign_messages SET status='sent',wa_message_id=?,sent_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?",[providerId,row.tenant_id,message.id]);
      await q("UPDATE wa_campaigns SET sent_count=sent_count+1 WHERE tenant_id=? AND id=?",[row.tenant_id,row.id]);
      try{
        const [conversation]=await q("SELECT * FROM conversations WHERE tenant_id=? AND contact_id=? AND sender_id=? LIMIT 1",[row.tenant_id,contact.id,row.sender_id]);
        await q("INSERT INTO wa_message_logs (tenant_id,campaign_id,campaign_message_id,sender_id,phone,conversation_id,branch_id,direction,message_type,message_text,wa_message_id,status,sent_by) VALUES (?,?,?,?,?,?,?,'outbound','template',NULL,?,'sent','campaign')",[row.tenant_id,row.id,message.id,row.sender_id,contact.phone,conversation?.id||null,conversation?.branch_id||contact.branch_id,providerId]);
        await require("./waDeliveryReceipts").flushDeliveryReceipt(providerId);
        if(conversation){
          await q("UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?",[row.tenant_id,conversation.id]);
          const body=String(template.body).replace(/\{\{(\d+)\}\}/g,(_,index)=>parameters[Number(index)-1]?.text||"");
          await inbox.emit(require("../sockets/chatsockets").getIO(),conversation,"inbox_message",{message:{id:providerId,body,isMe:true,sentBy:"campaign",status:"sent",type:"template",timestamp:Math.floor(Date.now()/1000)}});
        }
      }catch(error){console.error("[EmployeeCampaign] Confirmed send log failed",error.code||"DB_ERROR");}
      return {success:true,waMessageId:providerId};
    }catch(error){
      const unknown=deliveryAttempted&&(providerAccepted||error.deliveryUnknown||Number(error.status)>=500||/ETIMEDOUT|ECONNRESET|ECONNABORTED/.test(error.code||""));
      const denied=[400,403,404].includes(error.status);
      await q("UPDATE wa_campaign_messages SET status=?,error=? WHERE tenant_id=? AND id=?",[unknown?"unknown":denied?"skipped":"failed",unknown?"Delivery unknown; do not retry automatically":denied?"Recipient access, consent or approval changed":"WhatsApp send failed",row.tenant_id,message.id]);
      return {success:false,skipped:denied,deliveryUnknown:unknown};
    }
  }
  return {authorize,sender,templates,recipients,campaign,list,results,visibleCount,create,control,dispatch};
}
module.exports={createEmployeeCampaigns};
