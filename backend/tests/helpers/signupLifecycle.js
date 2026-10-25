"use strict";
const assert=require("node:assert/strict"),http=require("node:http"),crypto=require("node:crypto");
async function start(){
  let sequence=0;const orders=new Map();
  const server=http.createServer(async(req,res)=>{
    let raw="";for await(const chunk of req)raw+=chunk;
    res.setHeader("Content-Type","application/json");
    if(req.method==="POST"&&req.url==="/orders"){const order={...JSON.parse(raw),id:`order_signup_${++sequence}`,status:"created"};orders.set(order.id,order);return res.end(JSON.stringify(order));}
    if(req.url.startsWith("/payments/")){
      const id=req.url.split("/").pop(),order=orders.get(id.replace("pay_","order_"));
      if(order)return res.end(JSON.stringify({id,order_id:order.id,amount:order.amount,currency:order.currency,status:"captured",captured:true}));
    }
    res.writeHead(404).end("{}");
  });await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
async function run({base,connection}){
  const details={first_name:"New owner",last_name:"Fixture",email:`signup-${Date.now()}@fixture.test`,password:"signup-password-123",company_name:"New paid workspace",branch_name:"Initial HQ",branch_code:"HQ",timezone:"Asia/Kolkata",plan:"growth"};
  const headers={"Content-Type":"application/json",Origin:base,"X-Browser-Session":"1"};
  const signup=payload=>fetch(`${base}/api/auth/self-signup`,{method:"POST",headers,body:JSON.stringify(payload)});
  const response=await signup(details),body=await response.json();assert.equal(response.status,201,JSON.stringify(body));
  assert.equal(body.cookieSession,true);assert.equal(body.user.plan,"free");assert(!body.token);assert.equal(body.requestedPlanId,"growth");assert.equal(body.checkoutRequired,true);assert.match(body.nextPath,/billing.*plan=growth/);
  const cookie=response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");assert(cookie.includes("wa_access="));
  const auth={...headers,Cookie:cookie,"x-tenant-id":String(body.user.tenant_id)};
  const [[tenant]]=await connection.query("SELECT plan,pending_plan_id,max_seats FROM tenants WHERE id=?",[body.user.tenant_id]);assert.equal(tenant.plan,"free");assert.equal(tenant.pending_plan_id,"growth");
  const [[free]]=await connection.query("SELECT max_seats FROM plans WHERE id='free'");assert.equal(tenant.max_seats,free.max_seats);
  assert.equal((await signup(details)).status,409);
  const login=await fetch(`${base}/api/auth/login`,{method:"POST",headers,body:JSON.stringify({email:details.email,password:details.password})});const signedIn=await login.json();assert.equal(login.status,200,JSON.stringify(signedIn));assert.equal(signedIn.cookieSession,true);assert.equal(signedIn.nextPath,body.nextPath);
  const catalog=await fetch(`${base}/api/auth/plans`).then(res=>res.json());assert(catalog.plans.some(plan=>plan.id==="growth"&&Number(plan.price_inr)>0));
  const invalid=await signup({...details,email:"invalid-plan@fixture.test",plan:"not-a-plan"});assert.equal(invalid.status,400);
  assert.equal((await connection.query("SELECT id FROM users WHERE email='invalid-plan@fixture.test'"))[0].length,0);
  await connection.query("CREATE TRIGGER signup_rollback BEFORE INSERT ON branches FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'signup fixture rollback'");
  const failed=await signup({...details,email:"signup-rollback@fixture.test"});assert.equal(failed.status,503);await connection.query("DROP TRIGGER signup_rollback");
  assert.equal((await connection.query("SELECT id FROM users WHERE email='signup-rollback@fixture.test'"))[0].length,0);
  const checkout=await fetch(`${base}/api/v2/billing/checkout`,{method:"POST",headers:auth,body:JSON.stringify({planId:"growth",interval:"month"})});const session=await checkout.json();assert.equal(checkout.status,200,JSON.stringify(session));
  const paymentId=session.orderId.replace("order_","pay_"),signature=crypto.createHmac("sha256","signup-fixture-key-secret").update(`${session.orderId}|${paymentId}`).digest("hex");
  const confirmation=await fetch(`${base}/api/v2/billing/confirm-payment`,{method:"POST",headers:auth,body:JSON.stringify({planId:"growth",orderId:session.orderId,paymentId,signature})});assert.equal(confirmation.status,200,await confirmation.text());
  const [[paid]]=await connection.query("SELECT plan,pending_plan_id FROM tenants WHERE id=?",[body.user.tenant_id]);assert.equal(paid.plan,"growth");assert.equal(paid.pending_plan_id,null);
  const loginPaid=await fetch(`${base}/api/auth/login`,{method:"POST",headers,body:JSON.stringify({email:details.email,password:details.password})}).then(res=>res.json());assert.equal(loginPaid.nextPath,"/whatsapp");assert.equal(loginPaid.user.plan,"growth");
  const freeResponse=await signup({...details,email:"free-signup@fixture.test",plan:"free"});const freeBody=await freeResponse.json();assert.equal(freeResponse.status,201);assert.equal(freeBody.nextPath,"/whatsapp");assert.equal(freeBody.checkoutRequired,false);
  const pendingResponse=await signup({...details,email:"skip-signup@fixture.test"}),pending=await pendingResponse.json();assert.equal(pendingResponse.status,201);
  const skip=await fetch(`${base}/api/v2/billing/onboarding/skip`,{method:"POST",headers:{...headers,Cookie:pendingResponse.headers.getSetCookie().map(value=>value.split(";")[0]).join("; "),"x-tenant-id":String(pending.user.tenant_id)},body:"{}"});assert.equal(skip.status,200);
  assert.equal((await connection.query("SELECT pending_plan_id FROM tenants WHERE id=?",[pending.user.tenant_id]))[0][0].pending_plan_id,null);
  console.log("PASS: actual paid signup starts free, secure cookie sign-in resumes pending payment, canonical plans, duplicate/invalid signup rejection, full rollback, verified Razorpay activation, later login and free/skip onboarding. Provider transport is a local fixture.");
}
module.exports={start,run};
