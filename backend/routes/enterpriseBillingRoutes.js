/**
 * enterpriseBillingRoutes.js
 *
 * REST API v2 endpoints for SaaS Subscriptions, Razorpay Checkout, and Webhook Ingress.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md §7, §8, §10, §17
 */

const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  requireTenantContext,
  requirePermission,
} = require("../middleware/tenantMiddleware");
const billingService = require("../services/billingService");

const router = express.Router();

/**
 * GET /api/v2/billing/plans
 * Canonical public/tenant plan catalog.
 */
router.get("/plans", async (req, res) => {
  try {
    const plans = await billingService.getPlans();
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v2/billing/subscription
 * Returns active subscription, quotas, resource usage, and wallets.
 */
router.get(
  "/subscription",
  verifyToken,
  requireTenantContext,
  requirePermission("billing.read"),
  async (req, res) => {
    try {
      const summary = await billingService.getTenantBillingSummary(req.tenantId);
      res.json({ success: true, ...summary });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/billing/checkout
 * Generates verified Razorpay checkout session for plan upgrade or renewal.
 */
router.post(
  "/checkout",
  verifyToken,
  requireTenantContext,
  requirePermission("billing.manage"),
  async (req, res) => {
    try {
      const { planId, interval } = req.body;
      const session = await billingService.createCheckoutSession(req.tenantId, req.user.id, {
        planId,
        interval,
      });

      res.json(session);
    } catch (err) {
      res.status(err.status||400).json({ success: false, code:err.code, message: err.response ? "Payment provider is unavailable. Try again later." : err.message });
    }
  }
);

/**
 * POST /api/v2/billing/confirm-payment
 *
 * Confirms a Razorpay Checkout success response. The order this server created
 * decides the organization, the plan and the amount; the signature only proves
 * the gateway actually took that payment. Nothing about *what was bought* comes
 * off the request body.
 */
router.post(
  "/confirm-payment",
  verifyToken,
  requireTenantContext,
  requirePermission("billing.manage"),
  async (req, res) => {
    try {
      const { planId, paymentId, orderId, signature, receipt } = req.body;

      // `receipt` is what the current frontend sends as its orderId; accept
      // either name rather than making the caller care which the gateway used.
      const orderRef = orderId || receipt;
      if (!orderRef) {
        return res.status(400).json({
          success: false,
          code: "ORDER_REQUIRED",
          message: "A checkout order reference is required to confirm a payment",
        });
      }

      const result = await billingService.confirmCheckoutPayment({
        tenantId: req.tenantId,
        userId: req.user?.id,
        planId,
        paymentId,
        orderId: orderRef,
        signature,
      });

      res.json({
        success: true,
        message: result.idempotent ? "Payment already reconciled" : "Payment confirmed and subscription activated",
        data: result,
      });
    } catch (err) {
      if (err.code && err.status) {
        return res.status(err.status).json({ success: false, code: err.code, message: err.message });
      }
      console.error("[confirm-payment] Error:", err.code||"PAYMENT_CONFIRM_FAILED");
      res.status(err.status||400).json({ success: false, code:err.code, message: err.response ? "Payment provider is unavailable. Try again later." : err.message });
    }
  }
);

/**
 * POST /webhooks/razorpay
 * Public webhook receiver with raw HMAC signature verification.
 *
 * Notes are only a hint. The stored billing order - matched by the gateway's
 * own `payment.order_id` - is what decides the organization and the plan, so a
 * payload that names someone else's tenant or a dearer plan than the one that
 * was ordered cannot move entitlements.
 */
router.post(["/", "/webhook"], async (req,res)=>{
  const gateway=require("../services/razorpayClient");
  if(!gateway.webhookSecret())return res.status(503).json({error:"Webhook secret not configured"});
  if(!Buffer.isBuffer(req.rawBody)||!gateway.verifyWebhookSignature(req.rawBody,req.headers["x-razorpay-signature"]))return res.status(400).json({error:"Invalid signature"});
  const event=req.body?.event;
  if(!["payment.captured","order.paid"].includes(event))return res.json({status:"ignored"});
  const payment=req.body?.payload?.payment?.entity,order=req.body?.payload?.order?.entity;
  const orderId=payment?.order_id||order?.id;
  if(!orderId)return res.status(400).json({error:"Order reference missing"});
  try{
    const result=await billingService.reconcileGatewayOrder({orderId,paymentId:payment?.id,payment});
    return res.json({status:result.ignored?"ignored":"ok",duplicate:Boolean(result.idempotent)});
  }catch(error){
    console.error("[Razorpay webhook] Settlement failed",error.code||"SETTLEMENT_FAILED");
    // A non-2xx response lets Razorpay retry transient database/provider failures.
    return res.status(503).json({error:"Payment settlement will be retried"});
  }
});
router.get("/orders",verifyToken,requireTenantContext,requirePermission("billing.read"),async(req,res)=>{
  try{res.json({success:true,orders:await billingService.getBillingOrders(req.tenantId)});}catch(_){res.status(503).json({success:false,message:"Billing history is unavailable"});}
});
router.post("/onboarding/skip",verifyToken,requireTenantContext,requirePermission("billing.manage"),async(req,res)=>{
  try{await billingService.skipOnboardingPayment(req.tenantId);res.json({success:true});}catch(_){res.status(503).json({message:"Could not update onboarding. Please retry."});}
});
router.post("/orders/:orderId/reconcile",verifyToken,requireTenantContext,requirePermission("billing.manage"),async(req,res)=>{
  try{
    const order=await billingService.findBillingOrder({tenantId:req.tenantId,orderId:req.params.orderId});
    if(!order||order.source!=="gateway")return res.status(404).json({success:false,message:"Payment order not found"});
    const result=order.status==="paid"?{idempotent:true}:await billingService.reconcileGatewayOrder({orderId:order.provider_order_id});
    res.json({success:true,data:result});
  }catch(error){res.status(error.status||503).json({success:false,code:error.code,message:error.response?"Payment status could not be checked. Retry later.":error.message});}
});
router.get("/gateway",verifyToken,requireTenantContext,requirePermission("billing.read"),async(req,res)=>{
  try{res.json({success:true,...require("../services/razorpayClient").status(),canManage:await billingService.canManageBilling(req)});}catch(_){res.status(503).json({success:false,message:"Billing permissions are unavailable"});}
});
module.exports=router;
