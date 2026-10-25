"use strict";
const router=require("express").Router();
const sessions=require("../services/browserSessions");
const {verifyToken}=require("../middleware/authMiddleware");
const {refreshLimiter}=require("../middleware/waRateLimiter");
const route=work=>async(req,res)=>{try{await work(req,res);}catch(error){res.status(error.status||503).json({message:error.status?error.message:"Browser session is unavailable"});}};
router.post("/refresh",refreshLimiter,route(async(req,res)=>{const user=await sessions.refresh(req,res);res.json({success:true,cookieSession:true,user:{id:user.id,name:user.first_name,email:user.email,role:user.role,tenant_id:user.tenant_id,cookieSession:true}});}));
router.get("/session",verifyToken,(req,res)=>{const {iat,exp,sid,...user}=req.user;res.set("Cache-Control","no-store").json({success:true,user:{...user,cookieSession:Boolean(sid)}});});
router.post("/logout",route(async(req,res)=>{
  const stored=sessions.cookies(req.headers.cookie);
  if(!stored[sessions.REFRESH_COOKIE]&&!stored[sessions.ACCESS_COOKIE])return res.json({success:true});
  await sessions.revoke(req,res);res.json({success:true});
}));
router.post("/logout-all",verifyToken,route(async(req,res)=>{sessions.requireOrigin(req);await sessions.query("UPDATE browser_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=?",[req.user.id]);sessions.disconnectSessions({userId:req.user.id});sessions.clearCookies(res);res.json({success:true});}));
module.exports=router;
