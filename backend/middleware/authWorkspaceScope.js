"use strict";
const {verifyToken}=require("./authMiddleware");
const {requireTenantContext}=require("./tenantMiddleware");
const PUBLIC=new Set(["/login","/admin-login","/demo-login","/register","/request-access","/self-signup","/plans","/send-email-otp","/verify-access-code","/join-with-access-code","/verify-2fa","/resend-2fa"]);
const SELF=new Set(["/tenant-info","/my-employee-profile","/profile","/my-change-requests","/request-profile-change","/change-password-direct","/toggle-2fa","/logout"]);
module.exports=(req,res,next)=>{
  if(PUBLIC.has(req.path))return next();
  verifyToken(req,res,()=>requireTenantContext(req,res,async()=>{
    req.user={...req.user,tenant_id:req.tenantId};
    if(SELF.has(req.path))return next();
    if(!["organization_owner","organization_admin"].includes(req.userRole)&&req.user.role!=="platform_admin")return res.status(403).json({message:"Organization administrator required"});
    req.user={...req.user,tenant_id:req.tenantId,role:req.user.role==="platform_admin"?"platform_admin":"admin"};
    try {
      const target=req.path.match(/^\/(?:update-user|change-role|ban-user|delete-user|reset-password|approve)\/(\d+)$/);
      if(target) {
        const [rows]=await require("../config/database").promise().query("SELECT id FROM users WHERE id=? AND tenant_id=?",[Number(target[1]),req.tenantId]);
        if(!rows.length)return res.status(404).json({message:"User not found in this organization"});
      }
      next();
    }catch(_){res.status(503).json({message:"Account scope could not be verified"});}
  }));
};
