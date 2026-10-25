"use strict";
function createAdmission(limit) {
  let active=0,rejected=0;
  function enter() {
    if(active>=limit){rejected++;return null;}
    active++;let released=false;
    return ()=>{if(!released){released=true;active--;}};
  }
  const middleware=(req,res,next)=>{
    const release=enter();
    if(!release)return res.set("Retry-After","2").status(503).json({code:"CAPACITY_BUSY",message:"The server is busy. Retry after a short delay."});
    res.once("finish",release);res.once("close",release);next();
  };
  return {enter,middleware,stats:()=>({active,rejected,limit})};
}
const {limits}=require("../config/capacity");
const config=limits();
const http=createAdmission(config.http),uploads=createAdmission(config.uploads),webhooks=createAdmission(config.webhooks);
function admitRequest(req,res,next) {
  if(req.method==="OPTIONS"||["/health","/api/health"].includes(req.path))return next();
  if(req.app?.get("draining"))return res.set("Retry-After","2").status(503).json({code:"SERVER_DRAINING"});
  http.middleware(req,res,()=>{
    if(String(req.headers["content-type"]||"").startsWith("multipart/form-data"))return uploads.middleware(req,res,next);
    next();
  });
}
module.exports={createAdmission,admitRequest,webhooks,stats:()=>({http:http.stats(),uploads:uploads.stats(),webhooks:webhooks.stats()})};
