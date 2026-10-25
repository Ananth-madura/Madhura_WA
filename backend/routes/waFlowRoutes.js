"use strict";
const router=require("express").Router();
const db=require("../config/database");
const store=require("../services/flowStore").createFlowStore(db);
const definition=require("../services/flowDefinition");
const {verifyToken}=require("../middleware/authMiddleware");
const {requireTenantContext}=require("../middleware/tenantMiddleware");
router.use(verifyToken,requireTenantContext,require("../middleware/organizationAdmin"));
router.use((req,res,next)=>{res.set("Cache-Control","private, no-store");next();});
const route=work=>async(req,res)=>{try{await work(req,res);}catch(error){res.status(error.status||503).json({error:error.status?error.message:"Flow operation failed; retry or contact your administrator"});}};
router.get("/",route(async(req,res)=>res.json(await store.query(`SELECT f.*,
  (SELECT COUNT(*) FROM wa_flow_nodes n WHERE n.flow_id=f.id) AS node_count,
  (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id=f.id AND r.status='active') AS active_runs,
  (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id=f.id AND r.status='completed') AS completed_runs,
  (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id=f.id AND r.status='handed_off') AS handoff_runs
  FROM wa_flows f WHERE f.tenant_id=? ORDER BY f.created_at DESC LIMIT 500`,[req.tenantId]))));
router.get("/library",route(async(req,res)=>res.json([...require("../services/prebuiltFlows"),...require("../services/serviceFlowBlueprints")])));
router.post("/seed",route(async(req,res)=>res.json(await store.seed(req.tenantId,req.user.id))));
function simulation(flow,req){const normalized=definition.normalize(flow);const result=definition.step(normalized,req.body.input,req.body.state,{name:"Preview customer","customer.name":"Preview customer","customer.phone":"919000000000","customer.email":"preview@example.test","contact.exists":true});const input=String(req.body.input||"").toLowerCase().trim();return {success:true,...result,triggerType:normalized.trigger_type,triggerKeywords:normalized.trigger_config.keywords||[],triggerMatched:normalized.trigger_type==="keyword"&&(normalized.trigger_config.keywords||[]).some(k=>String(k).toLowerCase()===input)};}
router.post("/draft-simulate",route(async(req,res)=>res.json(simulation(req.body.flow,req))));
const trigger=route(async(req,res)=>{
  const id=req.params.id||req.body.flow_id;
  await store.get(req.tenantId,id);
  const phone=String(req.body.phone||"").replace(/\D/g,"");
  const where=req.body.conversationId?"c.id=?":"ct.phone=?";
  const rows=await store.query(`SELECT c.id FROM conversations c JOIN wa_contacts ct ON ct.id=c.contact_id AND ct.tenant_id=c.tenant_id WHERE c.tenant_id=? AND ${where} LIMIT 2`,[req.tenantId,req.body.conversationId||phone]);
  if(rows.length!==1)return res.status(409).json({error:"Select one existing conversation using conversationId. A bot cannot send to an arbitrary number outside its service window."});
  const result=await require("../services/sharedFlowRuntime").start(req.tenantId,rows[0].id,id,req.user.id);
  res.json({success:true,result,message:"Published flow started in the shared conversation"});
});
router.post("/send-menu",trigger);
router.post("/:id/trigger-phone",trigger);
router.get("/:id",route(async(req,res)=>res.json(await store.get(req.tenantId,req.params.id))));
router.post("/",route(async(req,res)=>res.status(201).json(await store.save(req.tenantId,req.user.id,req.body))));
router.put("/:id",route(async(req,res)=>res.json(await store.save(req.tenantId,req.user.id,req.body,req.params.id))));
router.patch("/:id/status",route(async(req,res)=>{
  await store.get(req.tenantId,req.params.id);
  if(!["draft","active","archived"].includes(req.body.status))return res.status(400).json({error:"Invalid status"});
  if(req.body.status==="active"&&!(await store.query("SELECT id FROM wa_flow_versions WHERE flow_id=? AND status='published'",[req.params.id])).length)return res.status(409).json({error:"Test and publish a version before activating this flow"});
  await store.query("UPDATE wa_flows SET status=?,updated_at=NOW() WHERE tenant_id=? AND id=?",[req.body.status,req.tenantId,req.params.id]);require("../services/sharedFlowRuntime").invalidate(req.tenantId);res.json({success:true,status:req.body.status});
}));
router.delete("/:id",route(async(req,res)=>{await store.get(req.tenantId,req.params.id);await store.query("DELETE FROM wa_flows WHERE tenant_id=? AND id=?",[req.tenantId,req.params.id]);require("../services/sharedFlowRuntime").invalidate(req.tenantId);res.json({success:true});}));
router.post("/:id/test-simulate",route(async(req,res)=>res.json(simulation(await store.get(req.tenantId,req.params.id),req))));
router.get("/:id/runs",route(async(req,res)=>{
  await store.get(req.tenantId,req.params.id);
  res.json(await store.query("SELECT id,flow_id,phone,status,current_node_key,started_at,last_advanced_at,ended_at,end_reason FROM wa_flow_runs WHERE flow_id=? ORDER BY id DESC LIMIT 50",[req.params.id]));
}));
router.get("/:id/versions",route(async(req,res)=>{await store.get(req.tenantId,req.params.id);res.json(await store.query("SELECT id,flow_id,version_number,name,status,changelog,published_at,created_at,created_by FROM wa_flow_versions WHERE flow_id=? ORDER BY version_number DESC LIMIT 100",[req.params.id]));}));
router.post("/:id/versions/publish",route(async(req,res)=>res.json(await store.publish(req.tenantId,req.user.id,req.params.id,req.body.changelog))));
router.post("/:id/versions/:versionId/rollback",route(async(req,res)=>{
  await store.transaction(async q=>{
    await store.get(req.tenantId,req.params.id,q,true);
    const [version]=await q("SELECT * FROM wa_flow_versions WHERE id=? AND flow_id=?",[req.params.versionId,req.params.id]);
    if(!version)throw Object.assign(new Error("Version not found"),{status:404});
    const flow=definition.normalize({...version,nodes:typeof version.nodes_snapshot==="string"?JSON.parse(version.nodes_snapshot):version.nodes_snapshot});
    await q("UPDATE wa_flows SET name=?,description=?,trigger_type=?,trigger_config=?,entry_node_key=?,status='draft',updated_at=NOW() WHERE tenant_id=? AND id=?",[flow.name,flow.description,flow.trigger_type,JSON.stringify(flow.trigger_config),flow.entry_node_key,req.tenantId,req.params.id]);
    await store.replaceNodes(q,req.params.id,flow.nodes);
  });require("../services/sharedFlowRuntime").invalidate(req.tenantId);res.json({success:true,message:"Version restored to a draft. Test and publish to enable it."});
}));
router.get("/:id/analytics",route(async(req,res)=>{
  await store.get(req.tenantId,req.params.id);
  const [row]=await store.query("SELECT COUNT(*) AS totalRuns,SUM(status='completed') AS completedRuns,SUM(status='handed_off') AS handoffRuns,SUM(status='active') AS activeRuns FROM wa_flow_runs WHERE flow_id=?",[req.params.id]);
  const nodeDropoffs=await store.query("SELECT e.node_key,COUNT(*) AS hit_count FROM wa_flow_run_events e JOIN wa_flow_runs r ON r.id=e.run_id WHERE r.flow_id=? GROUP BY e.node_key ORDER BY hit_count DESC LIMIT 20",[req.params.id]);
  res.json({...row,nodeDropoffs});
}));
module.exports=router;
