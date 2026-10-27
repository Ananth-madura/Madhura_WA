"use strict";
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { provisionPlatformAdmin } = require("../../services/platformAdminBootstrap");

async function verify({base,connection}) {
  const database={isSqlite:false,getConnection:callback=>callback(null,{promise:()=>connection,release:()=>{}})};
  const email="operator-admin@fixture.test",password="isolated-platform-password";
  const result=await provisionPlatformAdmin(database,{email,password});
  const [[user]]=await connection.query("SELECT role,user_password,tenant_id FROM users WHERE id=?",[result.userId]);
  assert.equal(user.role,"platform_admin");assert.notEqual(user.user_password,password);assert(await bcrypt.compare(password,user.user_password));
  const repeat=await provisionPlatformAdmin(database,{email,password:"a-different-restart-password"});
  assert.deepEqual(repeat,result);
  await provisionPlatformAdmin(database,{email});
  const [[preserved]]=await connection.query("SELECT user_password FROM users WHERE id=?",[result.userId]);
  assert.equal(preserved.user_password,user.user_password,"Restarting must preserve a rotated administrator password");
  const [[ledger]]=await connection.query("SELECT COUNT(*) AS count FROM wallet_entries WHERE tenant_id=?",[result.tenantId]);assert.equal(ledger.count,2);
  const headers={"Content-Type":"application/json",Origin:base,"X-Browser-Session":"1"};
  const login=await fetch(base+"/api/auth/login",{method:"POST",headers,body:JSON.stringify({email,password})});
  const signedIn=await login.json();assert.equal(login.status,200,JSON.stringify(signedIn));assert.equal(signedIn.user.role,"platform_admin");assert.equal(signedIn.nextPath,"/whatsapp");assert.equal(signedIn.cookieSession,true);
  const auth={...headers,Cookie:login.headers.getSetCookie().map(value=>value.split(";")[0]).join("; "),"x-tenant-id":String(result.tenantId)};
  const billing=await fetch(base+"/api/v2/billing/subscription",{headers:auth}).then(response=>response.json());
  assert.equal(billing.organization.internal_access,true);assert.equal(billing.organization.price_inr,0);assert.equal(billing.organization.plan,"enterprise");assert.equal(billing.subscription.provider,"internal");assert.equal(billing.subscription.current_period_end,null);
  const checkout=await fetch(base+"/api/v2/billing/checkout",{method:"POST",headers:auth,body:JSON.stringify({planId:"growth"})});assert.equal(checkout.status,409);
  const employee=await fetch(base+"/api/auth/employees",{method:"POST",headers:auth,body:JSON.stringify({first_name:"Internal staff",email:"internal-staff@fixture.test",role:"employee",branch_id:result.branchId,whatsapp_access_level:"full"})});assert.equal(employee.status,201,await employee.text());
  const denied=await fetch(base+"/api/auth/self-signup",{method:"POST",headers,body:JSON.stringify({email:"ordinary@fixture.test",password,company_name:"Ordinary customer",first_name:"Ordinary",role:"platform_admin",plan:"free"})});
  if(denied.status===201){const ordinary=await denied.json();assert.notEqual(ordinary.user.role,"platform_admin");assert.equal(ordinary.user.plan,"free");}else assert([400,403].includes(denied.status));
  console.log("PASS: operator-provisioned platform admin, bcrypt password preservation, idempotent internal organization and credits, real cookie login, permanent enterprise access without checkout, employee administration and no public role escalation.");
}
module.exports={verify};
