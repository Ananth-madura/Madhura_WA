"use strict";
const router=require("express").Router();
const {verifyToken}=require("../middleware/authMiddleware");
const {requireTenantContext}=require("../middleware/tenantMiddleware");
const {campaignLaunchLimiter}=require("../middleware/waRateLimiter");
const service=require("../services/employeeCampaigns").createEmployeeCampaigns(require("../config/database"));
const handle=work=>async(req,res)=>{try{await work(req,res);}catch(error){res.status(error.status||500).json({message:error.status?error.message:"Campaign operation failed. Try again."});}};
router.use(verifyToken,requireTenantContext,(req,res,next)=>{res.set("Cache-Control","no-store");next();});
router.get("/",handle(async(req,res)=>res.json(await service.list(req,req.query.before))));
router.get("/recipients",handle(async(req,res)=>res.json(await service.recipients(req,req.query))));
router.get("/senders",handle(async(req,res)=>{
  await service.authorize(req);
  const q=require("../config/database").promise();
  const [rows]=await q.query("SELECT id,display_phone FROM wa_senders WHERE tenant_id=? AND status='connected' ORDER BY id LIMIT 100",[req.tenantId]);
  const permitted=[];
  for(const row of rows){try{await service.sender(req,row.id);permitted.push(row);}catch(error){if(error.status!==404)throw error;}}
  res.json({senders:permitted});
}));
router.get("/templates",handle(async(req,res)=>res.json({templates:await service.templates(req,req.query.senderId)})));
router.post("/",campaignLaunchLimiter,handle(async(req,res)=>res.status(201).json(await service.create(req,req.body))));
router.get("/:id",handle(async(req,res)=>{
  const row=await service.campaign(req,req.params.id);
  const [templates]=await require("../config/database").promise().query("SELECT name,body,language FROM wa_templates WHERE tenant_id=? AND id=?",[req.tenantId,row.template_id]);
  res.json({campaign:{id:row.id,name:row.name,status:row.status,total_contacts:await service.visibleCount(req,row.id),created_by:row.created_by,sender_id:row.sender_id,template:templates[0]||null,parameters:JSON.parse(row.template_parameters||"[]")},...await service.results(req,row.id,req.query.before)});
}));
router.post("/:id/:action",campaignLaunchLimiter,handle(async(req,res)=>res.json(await service.control(req,req.params.id,req.params.action,req.body.confirmCount))));
module.exports=router;
