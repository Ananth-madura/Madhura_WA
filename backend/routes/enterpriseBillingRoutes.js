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
      res.status(400).json({ success: false, message: err.message });
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
      console.error("[confirm-payment] Error:", err);
      res.status(400).json({ success: false, message: err.message });
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
router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const razorpay = require("../services/razorpayClient");
  const secret = razorpay.webhookSecret();

  if (secret) {
    // Razorpay signs the exact bytes it sent. Re-serializing req.body can
    // reorder keys or change whitespace and will never match, so verify the
    // captured raw body whenever express.json captured it.
    const raw = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(
          typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}),
          "utf8"
        );
    if (!razorpay.verifyWebhookSignature(raw, signature)) {
      return res.status(400).json({ error: "Invalid signature" });
    }
  } else if (process.env.NODE_ENV === "production") {
    // A live deployment must not accept unauthenticated entitlement writes.
    console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured - rejecting");
    return res.status(503).json({ error: "Webhook secret not configured" });
  } else if (signature) {
    // A signature was presented but there is no secret to check it against.
    // Accepting it would mean an unsigned body claiming any tenant and any
    // plan upgrades itself; refusing it costs nothing outside production.
    return res.status(400).json({ error: "Invalid signature" });
  }

  const event = req.body?.event;
  const payload = req.body?.payload;

  if (event === "payment.captured" || event === "order.paid" || event === "subscription.activated") {
    const payment = payload?.payment?.entity || payload?.order?.entity;
    const notes = payment?.notes || {};
    const gatewayOrderId = payment?.order_id || payment?.id;
    const paymentId = event === "order.paid" ? null : payment?.id;

    try {
      // Prefer the stored order: it is the only record that ties this gateway
      // order to the organization and plan it was created for.
      const billingOrder = await billingService.findBillingOrder({
        tenantId: Number(notes.tenant_id) || undefined,
        orderId: gatewayOrderId,
      }).catch(() => null);

      const storedOrder = billingOrder ||
        (await billingService.findBillingOrder({ orderId: gatewayOrderId }).catch(() => null));

      if (storedOrder) {
        // Cross-check: whatever the payload claims, the row it was created
        // under is what gets credited.
        if (notes.tenant_id && Number(notes.tenant_id) !== Number(storedOrder.tenant_id)) {
          console.warn(
            `[Razorpay Webhook] Order ${gatewayOrderId} claims tenant ${notes.tenant_id} but was created for ${storedOrder.tenant_id} - using the stored record`
          );
        }
        if (notes.plan_id && String(notes.plan_id).toLowerCase() !== String(storedOrder.plan_id).toLowerCase()) {
          console.warn(
            `[Razorpay Webhook] Order ${gatewayOrderId} claims plan ${notes.plan_id} but was created for ${storedOrder.plan_id} - using the stored record`
          );
        }
        if (storedOrder.status === "paid") {
          return res.json({ status: "ok", duplicate: true });
        }

        await billingService.processVerifiedPayment({
          tenantId: Number(storedOrder.tenant_id),
          planId: storedOrder.plan_id,
          paymentId: paymentId || `order_${gatewayOrderId}`,
          orderId: gatewayOrderId,
          source: "gateway",
          billingOrder: storedOrder,
        });
        return res.json({ status: "ok" });
      }

      // No stored order (an order created outside this app, e.g. through a
      // payment link). Fall back to the notes - but only the ones that name an
      // organization we can actually resolve, and only for a payment Razorpay
      // says it captured.
      const tenantId = Number(notes.tenant_id);
      const planId = notes.plan_id;
      if (tenantId > 0 && planId && paymentId) {
        await billingService.processVerifiedPayment({
          tenantId,
          planId,
          paymentId,
          orderId: gatewayOrderId,
          source: "gateway",
        });
      } else {
        console.warn(`[Razorpay Webhook] Event ${event} had no matching billing order and no usable notes - ignored`);
      }
    } catch (err) {
      console.error("[Razorpay Webhook] Error processing payment:", err);
    }
  }

  res.json({ status: "ok" });
});

module.exports = router;
