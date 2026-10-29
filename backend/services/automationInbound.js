"use strict";
const crypto=require("crypto");
const q=async(sql,params=[])=>(await require("../config/database").promise().query(sql,params))[0];
async function handle(tenant,sender,conversation,messageId,input,isNew=false){
  const [current]=await q("SELECT * FROM conversations WHERE tenant_id=? AND sender_id=? AND id=?",[tenant,sender,conversation.id]);
  if(!current||current.status!=="open"||current.automation_mode==="flow"||current.automation_mode==="human"&&Number(current.automation_version)>0||/^(stop|unsubscribe|human|agent|cancel bot)$/i.test(input))return false;
  const [contact]=await q("SELECT phone,name,is_unsubscribed,is_blocked FROM wa_contacts WHERE tenant_id=? AND id=?",[tenant,current.contact_id]);
  if(!contact||contact.is_unsubscribed||contact.is_blocked)return false;
  let phone=String(contact.phone).replace(/\D/g,"");if(phone.length===10)phone="91"+phone;
  const [pending]=await q("SELECT m.automation_id FROM wa_automation_menus m JOIN wa_automations a ON a.id=m.automation_id AND a.tenant_id=m.tenant_id AND a.sender_id=m.sender_id WHERE m.tenant_id=? AND m.sender_id=? AND m.phone=? AND m.created_at>=DATE_SUB(NOW(),INTERVAL 24 HOUR) AND a.is_active=1",[tenant,sender,phone]);
  if(pending){
    const options=await q("SELECT id,label,reply_text FROM wa_automation_options WHERE automation_id=? ORDER BY sort_order,id LIMIT 10",[pending.automation_id]);
    const choice=options.find(option=>input===`auto:${pending.automation_id}:${option.id}`||option.label.toLowerCase()===input.toLowerCase())||(/^\d+$/.test(input)?options[Number(input)-1]:null);
    if(choice){
      let providerId=null,status="sent",error=null;
      try{
        const data=await require("./waAutomationService").lookupCrmDataByPhone(phone,tenant);
        const text=require("./waAutomationService").formatMessagePlaceholders(choice.reply_text,contact.name,data);
        const result=await require("./automationCloudDelivery").send({tenant_id:tenant,sender_id:sender},phone,text,data,{requestId:`reply:${tenant}:${sender}:${messageId}`});providerId=result.messages?.[0]?.id;
      }catch(failure){status=failure.deliveryUnknown?"unknown":"failed";error="Reply delivery was not confirmed";if(failure.duplicateSuppressed)status="sent";}
      if(status==="sent"||status==="unknown")await q("DELETE FROM wa_automation_menus WHERE tenant_id=? AND sender_id=? AND phone=? AND automation_id=?",[tenant,sender,phone,pending.automation_id]);
      await q("INSERT INTO wa_automation_logs (automation_id,phone,contact_name,status,error,wa_message_id) VALUES (?,?,?,?,?,?)",[pending.automation_id,phone,contact.name,status,error,providerId]);
      return true;
    }
  }
  const engine=require("./waAutomationService");
  const result=isNew?await engine.triggerAutomation("welcome_message",{tenantId:tenant,phone,contactName:contact.name,eventId:messageId,data:{"customer.phone":phone,name:contact.name}},{senderId:sender}):{};
  if(result.triggeredCount||result.deliveryUnknown||result.reason==="duplicate_suppressed")return true;
  const settings=await engine.getWelcomeSettings(tenant);
  if(!settings.enabled)return false;
  if(settings.working_hours_only){const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());if(settings.start_time<settings.end_time?time<settings.start_time||time>=settings.end_time:time<settings.start_time&&time>=settings.end_time)return false;}
  const cooldown=Number(settings.cooldown_hours??24);
  const key=crypto.createHash("sha256").update(`welcome:${tenant}:${sender}:${messageId}`).digest("hex");
  const claim=await q("INSERT IGNORE INTO wa_automation_welcome_claims (tenant_id,sender_id,phone,request_id) VALUES (?,?,?,?)",[tenant,sender,phone,key]);
  if(!claim.affectedRows){
    if(!cooldown)return false;
    const updated=await q("UPDATE wa_automation_welcome_claims SET last_sent_at=NOW(),request_id=? WHERE tenant_id=? AND sender_id=? AND phone=? AND last_sent_at<=DATE_SUB(NOW(),INTERVAL ? HOUR)",[key,tenant,sender,phone,cooldown]);
    if(!updated.affectedRows)return false;
  }
  try{await require("./automationCloudDelivery").send({tenant_id:tenant,sender_id:sender},phone,engine.formatMessagePlaceholders(settings.welcome_text,contact.name,{name:contact.name}),{name:contact.name},{requestId:key,buttons:settings.welcome_type==="buttons"?settings.welcome_buttons:null});}
  catch(error){if(!error.duplicateSuppressed&&!error.deliveryUnknown){await q("DELETE FROM wa_automation_welcome_claims WHERE tenant_id=? AND sender_id=? AND phone=? AND request_id=?",[tenant,sender,phone,key]);throw error;}}
  return true;
}
module.exports={handle};
