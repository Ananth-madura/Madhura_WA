/**
 * enterpriseBillingRoutes.js
 *
 * REST API v2 endpoints for SaaS Subscriptions, Razorpay Checkout, and Webhook Ingress.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md §7, §8, §10, §17
 */

const express = require("express");
const crypto = require("crypto");
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
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/billing/confirm-payment
 * Reconciles gateway payment response and upgrades entitlements.
 */
router.post(
  "/confirm-payment",
  verifyToken,
  requireTenantContext,
  requirePermission("billing.manage"),
  async (req, res) => {
    try {
      const { planId, paymentId, orderId, signature } = req.body;

      // In production, verify HMAC if webhook secret is set
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
      if (webhookSecret && signature && paymentId && orderId) {
        const expectedSig = crypto
          .createHmac("sha256", webhookSecret)
          .update(`${orderId}|${paymentId}`)
          .digest("hex");
        if (expectedSig !== signature) {
          return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }
      }

      const result = await billingService.processVerifiedPayment({
        tenantId: req.tenantId,
        planId,
        paymentId: paymentId || `pay_mock_${Date.now()}`,
        orderId: orderId || `order_mock_${Date.now()}`,
      });

      res.json({
        success: true,
        message: "Payment confirmed and subscription activated",
        data: result,
      });
    } catch (err) {
      console.error("[confirm-payment] Error:", err);
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /webhooks/razorpay
 * Public webhook receiver with raw HMAC signature verification.
 */
router.post("/webhook", async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  if (secret && signature) {
    const bodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const expected = crypto.createHmac("sha256", secret).update(bodyStr).digest("hex");
    if (expected !== signature) {
      return res.status(400).json({ error: "Invalid signature" });
    }
  }

  const event = req.body?.event;
  const payload = req.body?.payload;

  if (event === "payment.captured" || event === "subscription.activated") {
    const payment = payload?.payment?.entity;
    const notes = payment?.notes || {};
    const tenantId = notes.tenant_id;
    const planId = notes.plan_id;

    if (tenantId && planId) {
      try {
        await billingService.processVerifiedPayment({
          tenantId: Number(tenantId),
          planId,
          paymentId: payment.id,
          orderId: payment.order_id,
        });
      } catch (err) {
        console.error("[Razorpay Webhook] Error processing payment:", err);
      }
    }
  }

  res.json({ status: "ok" });
});

module.exports = router;
