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

      const isProduction = process.env.NODE_ENV === "production";
      const webhookSecret =
        process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

      if (isProduction) {
        // Production upgrades must come from a gateway-verified event. A
        // client-supplied payment id is attacker-controlled and previously
        // minted `pay_mock_*` ids, i.e. free plan upgrades by editing a form.
        if (!paymentId || !orderId || !signature) {
          return res.status(400).json({
            success: false,
            code: "PAYMENT_VERIFICATION_REQUIRED",
            message: "Plan changes require a verified gateway payment",
          });
        }
        if (!webhookSecret) {
          return res.status(503).json({
            success: false,
            code: "GATEWAY_NOT_CONFIGURED",
            message: "Payment verification is not configured",
          });
        }
      }

      if (webhookSecret && signature && paymentId && orderId) {
        const expectedSig = crypto
          .createHmac("sha256", webhookSecret)
          .update(`${orderId}|${paymentId}`)
          .digest("hex");
        const a = Buffer.from(String(signature));
        const b = Buffer.from(expectedSig);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }
      } else if (isProduction) {
        return res.status(400).json({ success: false, message: "Invalid payment signature" });
      }

      const result = await billingService.processVerifiedPayment({
        tenantId: req.tenantId,
        planId,
        paymentId: paymentId || `dev_${req.tenantId}_${planId}`,
        orderId: orderId || null,
        source: isProduction ? "gateway" : "development",
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
    // Razorpay signs the exact bytes it sent. Re-serializing req.body can
    // reorder keys or change whitespace and will never match, so verify the
    // captured raw body whenever express.json captured it.
    const raw = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(
          typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}),
          "utf8"
        );
    const expected = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
    const received = Buffer.from(String(signature));
    const expectedBuf = Buffer.from(expected);
    const ok =
      received.length === expectedBuf.length &&
      crypto.timingSafeEqual(received, expectedBuf);
    if (!ok) {
      return res.status(400).json({ error: "Invalid signature" });
    }
  } else if (process.env.NODE_ENV === "production" && !secret) {
    // A live deployment must not accept unauthenticated entitlement writes.
    console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured - rejecting");
    return res.status(503).json({ error: "Webhook secret not configured" });
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
