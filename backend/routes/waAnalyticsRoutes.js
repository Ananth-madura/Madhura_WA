"use strict";
const router=require("express").Router();
const db=require("../config/database");
const {verifyToken:auth}=require("../middleware/authMiddleware");
const {requireTenantContext}=require("../middleware/tenantMiddleware");
const {serverChatStorageEnabled}=require("../services/waChatPrivacy");
const bounded=(value,fallback,max)=>Math.min(max,Math.max(1,Number.parseInt(value,10)||fallback));
const query=async(sql,params=[])=>(await db.promise().query(sql,params))[0];
const route=work=>async(req,res)=>{try{res.json(await work(req));}catch(_){res.status(503).json({error:"Organization analytics are temporarily unavailable"});}};
router.use(auth,requireTenantContext,(req,res,next)=>{
  if(["organization_owner","organization_admin"].includes(req.userRole)||req.user.role==="platform_admin")return next();
  res.status(403).json({error:"Organization administrator required"});
});
router.use((req,res,next)=>{res.set("Cache-Control","private, no-store");next();});

router.get("/dashboard",route(req=>require("../services/tenantAnalytics").dashboard(req.tenantId)));
router.get("/summary",route(async req=>{
  const data=await require("../services/tenantAnalytics").dashboard(req.tenantId);
  return {totalCampaigns:data.totalCampaigns,totalSent:data.sent,totalDelivered:data.delivered,totalRead:data.read,totalFailed:data.failed,totalGroups:data.totalGroups,totalTemplates:data.totalTemplates,totalContacts:data.totalContacts,deliveryRate:data.deliveryRate,readRate:data.readRate};
}));
router.get("/campaigns",route(req=>query(`SELECT id,name,type,status,total_contacts,sent_count,delivered_count,read_count,failed_count,scheduled_at,started_at,completed_at,created_at,
  CASE WHEN sent_count>0 THEN ROUND(delivered_count/sent_count*100) ELSE 0 END AS delivery_rate,
  CASE WHEN sent_count>0 THEN ROUND(read_count/sent_count*100) ELSE 0 END AS read_rate
  FROM wa_campaigns WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?`,[req.tenantId,bounded(req.query.limit,50,100)])));
router.get("/automations",route(req=>query(`SELECT a.id,a.name,a.trigger_type,a.delay_minutes,a.is_active,a.run_count,a.created_at,a.sequence_delay_seconds,a.followup_message_text,
  g.name AS group_name,f.name AS flow_name,
  (SELECT COUNT(*) FROM wa_automation_logs l WHERE l.automation_id=a.id) AS log_count,
  (SELECT COUNT(*) FROM wa_automation_logs l WHERE l.automation_id=a.id AND l.status='sent') AS sent_success_count
  FROM wa_automations a LEFT JOIN wa_contact_groups g ON g.id=a.group_id AND g.tenant_id=a.tenant_id
  LEFT JOIN wa_flows f ON f.id=a.flow_id AND f.tenant_id=a.tenant_id
  WHERE a.tenant_id=? ORDER BY a.run_count DESC,a.created_at DESC LIMIT ?`,[req.tenantId,bounded(req.query.limit,100,100)])));
router.get("/flows",route(req=>query(`SELECT f.id,f.name,f.trigger_type,f.status,f.execution_count AS run_count,f.created_at,
  (SELECT COUNT(*) FROM wa_flow_nodes n WHERE n.flow_id=f.id) AS node_count,
  (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id=f.id) AS total_sessions,
  (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id=f.id AND r.status='completed') AS completed_sessions,
  (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id=f.id AND r.status='handed_off') AS handoff_count
  FROM wa_flows f WHERE f.tenant_id=? ORDER BY f.execution_count DESC,f.created_at DESC LIMIT ?`,[req.tenantId,bounded(req.query.limit,100,100)])));
router.get("/logs",route(async req=>{
  const page=bounded(req.query.page,1,10000),limit=bounded(req.query.limit,50,100),params=[req.tenantId];
  let where="tenant_id=?";
  if(req.query.status){where+=" AND status=?";params.push(String(req.query.status));}
  if(req.query.direction){where+=" AND direction=?";params.push(String(req.query.direction));}
  if(req.query.search){where+=" AND phone LIKE ?";params.push("%"+String(req.query.search).slice(0,100)+"%");}
  const logs=await query(`SELECT id,phone,direction,message_type,${serverChatStorageEnabled()?"message_text":"NULL AS message_text"},wa_message_id,status,created_at
    FROM wa_message_logs WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]);
  const [count]=await query(`SELECT COUNT(*) AS total FROM wa_message_logs WHERE ${where}`,params);
  return {logs,total:Number(count.total),page,totalPages:Math.ceil(count.total/limit)};
}));
router.get("/daily",route(async req=>{
  const days=bounded(req.query.days,7,90),cutoff=new Date(Date.now()-days*86400000);
  return query(`SELECT daily.date,SUM(daily.sent) AS sent,SUM(daily.delivered) AS delivered,SUM(daily.read_count) AS read_count,SUM(daily.failed) AS failed FROM (
    SELECT DATE(created_at) AS date,SUM(status IN ('sent','delivered','read')) AS sent,SUM(status IN ('delivered','read')) AS delivered,
      SUM(status='read') AS read_count,SUM(status='failed') AS failed FROM wa_message_logs
      WHERE tenant_id=? AND direction='outbound' AND (campaign_id IS NULL OR campaign_id=0) AND created_at>=? GROUP BY DATE(created_at)
    UNION ALL
    SELECT DATE(COALESCE(sent_at,created_at)) AS date,SUM(status IN ('sent','delivered','read')) AS sent,SUM(status IN ('delivered','read')) AS delivered,
      SUM(status='read') AS read_count,SUM(status='failed') AS failed FROM wa_campaign_messages
      WHERE tenant_id=? AND COALESCE(sent_at,created_at)>=? GROUP BY DATE(COALESCE(sent_at,created_at))
    ) daily GROUP BY daily.date ORDER BY daily.date`,[req.tenantId,cutoff,req.tenantId,cutoff]);
}));
router.get("/status-distribution",route(req=>query("SELECT status,COUNT(*) AS count FROM wa_message_logs WHERE tenant_id=? GROUP BY status",[req.tenantId])));
router.get("/webhook-events",route(req=>{
  if(!serverChatStorageEnabled())return [];
  const params=[req.tenantId];let where="";
  if(req.query.event_type){where=" AND e.event_type=?";params.push(String(req.query.event_type));}
  params.push(bounded(req.query.limit,50,100));
  return query(`SELECT DISTINCT e.id,e.event_type,e.phone,e.status,e.wa_message_id,e.created_at FROM wa_webhook_events e
    JOIN wa_message_logs m ON m.wa_message_id=e.wa_message_id AND m.tenant_id=? WHERE 1=1 ${where} ORDER BY e.created_at DESC LIMIT ?`,params);
}));
router.get("/opt-outs",route(async req=>{
  const opt_outs=await query("SELECT * FROM wa_opt_outs WHERE tenant_id=? ORDER BY opted_out_at DESC LIMIT 100",[req.tenantId]);
  const [count]=await query("SELECT COUNT(*) AS total FROM wa_opt_outs WHERE tenant_id=?",[req.tenantId]);return {opt_outs,total:Number(count.total)};
}));
router.get("/quality-rating",route(async req=>{
  const [account]=await query("SELECT quality_rating,messaging_limit FROM wa_accounts WHERE tenant_id=? AND is_default=1 ORDER BY id LIMIT 1",[req.tenantId]);
  return {quality_rating:account?.quality_rating||null,messaging_limit:account?.messaging_limit||null,note:"Stored account metadata; this endpoint does not perform a live provider quality check"};
}));
module.exports=router;
