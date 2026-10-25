"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {createRequire}=require("node:module");
const {validateCapturedPayment}=require("../services/billingReconciliation");
const gateway=require("../services/razorpayClient");
process.env.RAZORPAY_KEY_ID="rzp_test_fixture";process.env.RAZORPAY_KEY_SECRET="fixture-only-secret";process.env.RAZORPAY_WEBHOOK_SECRET="fixture-only-webhook-secret";
const order={provider_order_id:"order_fixture",amount_minor:149900,currency:"INR"};
const payment={id:"pay_fixture",order_id:order.provider_order_id,amount:149900,currency:"INR",captured:true,status:"captured"};
assert.equal(validateCapturedPayment(order,payment),payment);
for(const change of [{order_id:"foreign"},{amount:1},{currency:"USD"},{status:"authorized",captured:false},{captured:false},{amount_refunded:1}])assert.throws(()=>validateCapturedPayment(order,{...payment,...change}));
const signature=crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET).update("order_fixture|pay_fixture").digest("hex");
assert(gateway.verifyCheckoutSignature({orderId:"order_fixture",paymentId:"pay_fixture",signature}));
assert(!gateway.verifyCheckoutSignature({orderId:"another_order",paymentId:"pay_fixture",signature}));
assert(!gateway.verifyCheckoutSignature({orderId:"order_fixture",paymentId:"pay_fixture",signature:"mock_test_signature"}));
const raw=Buffer.from('{ "event": "payment.captured" }');
const signed=crypto.createHmac("sha256",process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
assert(gateway.verifyWebhookSignature(raw,signed));assert(!gateway.verifyWebhookSignature(Buffer.from(JSON.stringify(JSON.parse(raw))),signed));
process.env.RAZORPAY_CHECKOUT_ENABLED="0";assert(!gateway.checkoutEnabled());assert(gateway.isConfigured());delete process.env.RAZORPAY_CHECKOUT_ENABLED;
assert(!JSON.stringify(gateway.status()).includes(process.env.RAZORPAY_KEY_SECRET));

async function routes(){
  const express=require("express"),request=require("supertest"),file=path.resolve(__dirname,"../routes/enterpriseBillingRoutes.js"),real=createRequire(file);let settlements=0,fail=false;
  const fakeBilling={reconcileGatewayOrder:async()=>{settlements++;if(fail)throw new Error("DB unavailable");return {};},createCheckoutSession:async()=>({success:true}),getBillingOrders:async tenantId=>[{tenantId}]};
  const auth={verifyToken:(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={id:1};next();}};
  const tenant={requireTenantContext:(req,res,next)=>{req.tenantId=7;next();},requirePermission:permission=>(req,res,next)=>req.headers["x-test-permission"]===permission?next():res.sendStatus(403)};
  const state={exports:{}};vm.runInNewContext(fs.readFileSync(file,"utf8"),{require:id=>id==="../services/billingService"?fakeBilling:id==="../middleware/authMiddleware"?auth:id==="../middleware/tenantMiddleware"?tenant:real(id),module:state,exports:state.exports,Buffer,process,console:{error:()=>{}}},{filename:file});
  const app=express();app.use(express.json({verify:(req,_res,buf)=>{req.rawBody=buf;}}));app.use("/webhooks/razorpay",state.exports);app.use("/billing",state.exports);
  const body=JSON.stringify({event:"payment.captured",payload:{payment:{entity:payment}}}),sig=crypto.createHmac("sha256",process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
  assert.equal((await request(app).post("/webhooks/razorpay").set("Content-Type","application/json").send(body)).status,400);assert.equal(settlements,0);
  assert.equal((await request(app).post("/webhooks/razorpay").set("Content-Type","application/json").set("x-razorpay-signature",sig).send(body)).status,200);
  fail=true;assert.equal((await request(app).post("/webhooks/razorpay/webhook").set("Content-Type","application/json").set("x-razorpay-signature",sig).send(body)).status,503);
  assert.equal((await request(app).post("/billing/checkout").send({planId:"starter"})).status,401);
  assert.equal((await request(app).post("/billing/checkout").set("Authorization","fixture").send({planId:"starter"})).status,403);
  assert.equal((await request(app).post("/billing/checkout").set("Authorization","fixture").set("x-test-permission","billing.manage").send({planId:"starter"})).status,200);
  const history=await request(app).get("/billing/orders").set("Authorization","fixture").set("x-test-permission","billing.read");assert.equal(history.status,200);assert.equal(history.body.orders[0].tenantId,7);
  console.log("PASS: captured amount/currency/order checks, separate HMAC secrets, raw webhook validation, retryable settlement failures, canonical webhook paths, permissions and checkout pause. No database or live requests.");
}
routes().catch(error=>{console.error(error);process.exitCode=1;});
