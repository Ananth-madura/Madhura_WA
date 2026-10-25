"use strict";
const db=require("../config/database");
const cached=new Map();
const one=async(sql,params)=>{
  try{return (await db.promise().query(sql,params))[0][0]||{};}
  catch(error){console.error("[TenantAnalytics]",sql.match(/FROM\s+(\w+)/i)?.[1]||"aggregate",error.code||"QUERY_FAILED");throw error;}
};
const number=value=>Number(value)||0;
const count=(table,tenant)=>one(`SELECT COUNT(*) AS count FROM ${table} WHERE tenant_id=?`,[tenant]).then(row=>number(row.count));
async function build(tenant){
  const contacts=await one(`SELECT COUNT(*) AS totalContacts,SUM(opt_in_status=1 AND is_blocked=0 AND is_unsubscribed=0) AS optedIn,
    SUM(is_blocked=1) AS blocked,SUM(is_unsubscribed=1) AS unsubscribed FROM wa_contacts WHERE tenant_id=?`,[tenant]);
  const campaigns=await one(`SELECT SUM(status='queued') AS queued,SUM(status IN ('sent','delivered','read') OR (status='failed' AND wa_message_id IS NOT NULL)) AS sent,
    SUM(status IN ('delivered','read')) AS delivered,SUM(status='read') AS readCount,SUM(status='failed') AS failed,SUM(reply_received=1) AS replied
    FROM wa_campaign_messages WHERE tenant_id=?`,[tenant]);
  const logs=await one(`SELECT SUM(direction='inbound') AS inboundCount,SUM(direction='outbound') AS outboundCount,
    SUM(direction='outbound' AND (campaign_id IS NULL OR campaign_id=0) AND (status IN ('sent','delivered','read') OR (status='failed' AND wa_message_id IS NOT NULL))) AS sent,
    SUM(direction='outbound' AND (campaign_id IS NULL OR campaign_id=0) AND status IN ('delivered','read')) AS delivered,
    SUM(direction='outbound' AND (campaign_id IS NULL OR campaign_id=0) AND status='read') AS readCount,
    SUM(direction='outbound' AND (campaign_id IS NULL OR campaign_id=0) AND status='failed') AS failed FROM wa_message_logs WHERE tenant_id=?`,[tenant]);
  const campaignCount=await one("SELECT COUNT(*) AS totalCampaigns,SUM(status='running') AS activeCampaigns FROM wa_campaigns WHERE tenant_id=?",[tenant]);
  const automations=await one("SELECT COUNT(*) AS totalAutomations,SUM(is_active=1) AS activeAutomations,COALESCE(SUM(run_count),0) AS totalAutoRuns FROM wa_automations WHERE tenant_id=?",[tenant]);
  const flows=await one("SELECT COUNT(*) AS totalFlows,SUM(status='active') AS activeFlows FROM wa_flows WHERE tenant_id=?",[tenant]);
  const runs=await one("SELECT COUNT(*) AS totalFlowRuns,SUM(r.status='handed_off') AS flowHandoffs FROM wa_flow_runs r JOIN wa_flows f ON f.id=r.flow_id WHERE f.tenant_id=?",[tenant]);
  const accounts=await one(`SELECT COUNT(*) AS totalAccounts FROM (SELECT phone_number_id COLLATE utf8mb4_unicode_ci AS phone FROM wa_accounts WHERE tenant_id=? AND phone_number_id IS NOT NULL AND phone_number_id<>''
    UNION SELECT phone_number_id COLLATE utf8mb4_unicode_ci FROM wa_senders WHERE tenant_id=?) accounts`,[tenant,tenant]);
  const result={...contacts,...campaignCount,...automations,...flows,...runs,...accounts,totalTemplates:await count("wa_templates",tenant),totalGroups:await count("wa_contact_groups",tenant),optOuts:await count("wa_opt_outs",tenant),
    queued:number(campaigns.queued),sent:number(campaigns.sent)+number(logs.sent),delivered:number(campaigns.delivered)+number(logs.delivered),read:number(campaigns.readCount)+number(logs.readCount),failed:number(campaigns.failed)+number(logs.failed),
    replied:Math.max(number(campaigns.replied),number(logs.inboundCount)),inboundCount:number(logs.inboundCount),outboundCount:number(logs.outboundCount)};
  for(const key of Object.keys(result))result[key]=number(result[key]);
  for(const [rate,key] of [["deliveryRate","delivered"],["readRate","read"],["replyRate","replied"],["optOutRate","optOuts"]])result[rate]=result.sent?Math.round(result[key]/result.sent*100):0;
  return {...result,generatedAt:new Date().toISOString(),chatStorage:require("./waChatPrivacy").serverChatStorageEnabled()?"server":"device",scope:"organization-retained-records"};
}
function dashboard(tenant){
  const previous=cached.get(tenant);
  if(previous&&(!previous.at||Date.now()-previous.at<30000))return previous.promise;
  if(cached.size>=1024)cached.delete(cached.keys().next().value);
  const entry={at:0};
  entry.promise=build(tenant).then(result=>{entry.at=Date.now();return result;}).catch(error=>{if(cached.get(tenant)===entry)cached.delete(tenant);throw error;});
  cached.set(tenant,entry);return entry.promise;
}
module.exports={dashboard};
