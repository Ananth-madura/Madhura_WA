"use strict";
const router=require("express").Router();
const db=require("../config/database");
const store=require("../services/flowStore").createFlowStore(db);
const {verifyToken}=require("../middleware/authMiddleware");
const {requireTenantContext}=require("../middleware/tenantMiddleware");
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
router.use(verifyToken,requireTenantContext,require("../middleware/workspaceModule").workspaceModule("templates"));
router.use((req,res,next)=>{res.set("Cache-Control","private, no-store");next();});
const route=work=>async(req,res)=>{try{await work(req,res);}catch(error){res.status(error.status&&error.status<500?error.status:503).json({error:error.status&&error.status<500?error.message:"Template operation failed. Check the sender connection and retry."});}};
async function get(req){const [row]=await store.query("SELECT * FROM wa_templates WHERE tenant_id=? AND id=?",[req.tenantId,req.params.id]);if(!row)throw fail("Template not found",404);return row;}
function validate(input){
  const {name,body}=input;
  if(typeof name!=="string"||!name.trim()||name.length>255||typeof body!=="string"||!body.trim()||body.length>4096)throw fail("Provide a name and body up to 4096 characters");
  if(!["MARKETING","UTILITY","AUTHENTICATION"].includes(input.category||"MARKETING"))throw fail("Invalid template category");
  if(!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(input.language||"en"))throw fail("Invalid template language");
  let buttons=input.buttons||[];if(typeof buttons==="string"){try{buttons=JSON.parse(buttons);}catch(_){throw fail("Buttons must be valid JSON");}}
  if(!Array.isArray(buttons)||buttons.length>10)throw fail("Buttons must be an array with at most 10 items");
  return [name.trim(),input.category||"MARKETING",input.language||"en",input.header_type||null,input.header_value||null,body,input.footer||null,input.button_type||null,JSON.stringify(buttons)];
}
router.get("/",route(async(req,res)=>res.json(await store.query("SELECT * FROM wa_templates WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1000",[req.tenantId]))));
router.post("/",route(async(req,res)=>{
  const values=validate(req.body);
  const result=await store.query("INSERT INTO wa_templates (name,category,language,header_type,header_value,body,footer,button_type,buttons,tenant_id,created_by,meta_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,'DRAFT')",[...values,req.tenantId,req.user.id]);req.params.id=result.insertId;res.status(201).json(await get(req));
}));
router.get("/:id",route(async(req,res)=>res.json(await get(req))));
router.put("/:id",route(async(req,res)=>{
  await get(req);const values=validate(req.body);
  await store.query("UPDATE wa_templates SET name=?,category=?,language=?,header_type=?,header_value=?,body=?,footer=?,button_type=?,buttons=?,meta_status='DRAFT',meta_template_id=NULL,waba_id=NULL,sender_id=NULL WHERE tenant_id=? AND id=?",[...values,req.tenantId,req.params.id]);res.json(await get(req));
}));
router.delete("/:id",route(async(req,res)=>{await get(req);await store.query("DELETE FROM wa_templates WHERE tenant_id=? AND id=?",[req.tenantId,req.params.id]);res.json({success:true,message:"Local template removed. This does not delete the template from Meta."});}));
router.post("/seed",route(async(req,res)=>{
  await store.transaction(async q=>{
    await q("SELECT id FROM tenants WHERE id=? FOR UPDATE",[req.tenantId]);
    for(const flow of require("../services/prebuiltFlows")){
      const name=`${flow.key}_acknowledgement`;
      if((await q("SELECT id FROM wa_templates WHERE tenant_id=? AND name=?",[req.tenantId,name])).length)continue;
      await q("INSERT INTO wa_templates (tenant_id,name,category,language,body,meta_status,created_by) VALUES (?,?,'UTILITY','en',?,'DRAFT',?)",[req.tenantId,name,`Hello {{1}}, we received your ${flow.name.toLowerCase()} request. Our team will review it.`,req.user.id]);
    }
  });res.json({success:true,templates:await store.query("SELECT * FROM wa_templates WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1000",[req.tenantId])});
}));
async function sync(req,res){
  if(req.params.id)await get(req);
  const senderId=Number(req.body.senderId);if(!Number.isInteger(senderId)||senderId<1)throw fail("Select the connected sender to synchronize");
  const client=await require("../services/waConfigHelper").cloudClientForTenantSender(req.tenantId,senderId);
  const result=await client.getTemplates();
  await store.transaction(async q=>{
    // An approved row missing from a complete provider listing must not stay sendable.
    await q("UPDATE wa_templates SET meta_status='UNAVAILABLE' WHERE tenant_id=? AND waba_id=? AND meta_template_id IS NOT NULL",[req.tenantId,client.wabaId]);
    for(const item of result.data){
      if(!item.id||!item.name||!item.language||!Array.isArray(item.components))throw fail("Meta returned an incomplete template",502);
      const body=item.components.find(c=>c.type==="BODY")?.text||"";
      const header=item.components.find(c=>c.type==="HEADER"),footer=item.components.find(c=>c.type==="FOOTER"),buttons=item.components.find(c=>c.type==="BUTTONS");
      const [existing]=await q("SELECT id FROM wa_templates WHERE tenant_id=? AND waba_id=? AND meta_template_id=? FOR UPDATE",[req.tenantId,client.wabaId,item.id]);
      const values=[item.name,item.category,item.language,header?.format||null,header?.text||null,body,footer?.text||null,JSON.stringify(buttons?.buttons||[]),item.status||"PENDING",item.id,senderId,client.wabaId,req.tenantId];
      if(existing)await q("UPDATE wa_templates SET name=?,category=?,language=?,header_type=?,header_value=?,body=?,footer=?,buttons=?,meta_status=?,meta_template_id=?,sender_id=?,waba_id=? WHERE tenant_id=? AND id=?",[...values,existing.id]);
      else await q("INSERT INTO wa_templates (name,category,language,header_type,header_value,body,footer,buttons,meta_status,meta_template_id,sender_id,waba_id,tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",values);
    }
  });res.json({success:true,count:result.data.length,metaTemplates:result.data});
}
router.post("/sync",route(sync));
router.post("/:id/sync",route(sync));
router.post("/:id/submit",route(async(req,res)=>{
  const template=await get(req);
  if(template.meta_template_id)throw fail("This template already exists at Meta. Synchronize its status instead.",409);
  if(!/^[a-z0-9_]{1,512}$/.test(template.name))throw fail("Meta names must use lowercase letters, numbers and underscores");
  if(template.category==="AUTHENTICATION")throw fail("Create authentication templates in WhatsApp Manager, then synchronize them");
  const buttons=typeof template.buttons==="string"?JSON.parse(template.buttons):template.buttons;
  if(buttons?.length||template.header_type&&template.header_type!=="TEXT")throw fail("Submit media/button templates in WhatsApp Manager, then synchronize them. This form submits text templates.");
  if(/\{[a-zA-Z_]/.test(template.body))throw fail("Use Meta positional variables such as {{1}}, with example values");
  const tokens=[...template.body.matchAll(/\{\{(\d+)\}\}/g)].map(m=>Number(m[1]));
  const count=Math.max(0,...tokens),examples=req.body.examples||[];
  if(count>20||tokens.some(n=>n<1)||Array.from({length:count},(_,i)=>i+1).some(n=>!tokens.includes(n))||!Array.isArray(examples)||examples.length!==count||examples.some(v=>typeof v!=="string"||!v.trim()||v.length>1024))throw fail("Provide one example for every consecutively numbered body variable");
  const senderId=Number(req.body.senderId);if(!Number.isInteger(senderId)||senderId<1)throw fail("Select a connected sender");
  const client=await require("../services/waConfigHelper").cloudClientForTenantSender(req.tenantId,senderId);
  const components=[{type:"BODY",text:template.body,...(count?{example:{body_text:[examples]}}:{})}];
  if(template.header_type==="TEXT"){if(/[{}]/.test(template.header_value||""))throw fail("Use a static text header");components.unshift({type:"HEADER",format:"TEXT",text:template.header_value});}
  if(template.footer)components.push({type:"FOOTER",text:template.footer});
  const result=await client.createTemplate({name:template.name,language:template.language,category:template.category,components});
  if(!result.id)throw fail("Meta did not confirm submission. Synchronize before retrying.",502);
  await store.query("UPDATE wa_templates SET meta_template_id=?,meta_status=?,sender_id=?,waba_id=? WHERE tenant_id=? AND id=?",[result.id,result.status||"PENDING",senderId,client.wabaId,req.tenantId,template.id]);res.json({success:true,template:await get(req)});
}));
module.exports=router;
