"use strict";
module.exports=function organizationAdmin(req,res,next){
  if(["organization_owner","organization_admin"].includes(req.userRole)||req.user?.role==="platform_admin")return next();
  res.status(403).json({error:"Organization administrator required"});
};
