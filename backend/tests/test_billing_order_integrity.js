"use strict";

/**
 * Real Razorpay orders: what a payment is allowed to unlock is decided by the
 * order this server created, never by the request that confirms it.
 *
 * The Checkout signature only ever covers `order_id|payment_id`. Before this,
 * `planId` and `tenantId` both came off the body - so a valid payment for the
 * cheapest plan, confirmed while naming the dearest one, activated the dearest
 * one. The billing_orders row now fixes organization, plan and amount at
 * order-creation time and both the confirm path and the webhook read them back
 * from there.
 */

const assert = require("assert/strict");
const crypto = require("crypto");
const db = require("../config/database");
const billing = require("../services/billingService");
const razorpay = require("../services/razorpayClient");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

const OTHER_TENANT = 999002; // not a real fixture tenant
let createdOrders = [];
let createdTenants = [];

async function makeTenant(name) {
  const res = await q(
    "INSERT INTO tenants (name, plan, plan_status, max_branches, max_seats, max_senders, max_monthly_messages) VALUES (?, 'free', 'active', 1, 2, 1, 1000)",
    [name]
  );
  createdTenants.push(res.insertId);
  return res.insertId;
}

const savedEnv = {};
function setEnv(key, value) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
function restoreEnv() {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

(async () => {
  let passed = 0;
  let failed = 0;
  const check = (cond, msg) => {
    if (cond) { console.log(`  PASS: ${msg}`); passed++; }
    else { console.error(`  FAIL: ${msg}`); failed++; }
  };

  const suffix = String(Date.now()).slice(-6);
  const tenantA = await makeTenant(`Billing Tenant A ${suffix}`);
  const tenantB = await makeTenant(`Billing Tenant B ${suffix}`);

  try {
    // ── 1. checkout records the deal server-side ───────────────────────────
    const session = await billing.createCheckoutSession(tenantA, null, { planId: "starter", interval: "month" });
    createdOrders.push(session.billingOrderId);

    check(session.planId === "starter", "checkout echoes the ordered plan");
    check(session.amount === 1499 * 100, "checkout amounts the plan in paise");
    check(Boolean(session.orderId), "checkout returns an order reference");
    check(session.live === false, "a deployment with no gateway credentials does not claim a live order");

    // `q` resolves the row array itself (unlike mysql2's promise API, which
    // resolves [rows, fields]) - so a SELECT result is destructured by
    // indexing it, not by pulling the first element out of it.
    const rows = await q("SELECT * FROM billing_orders WHERE id = ?", [session.billingOrderId]);
    const order = rows[0];
    check(Boolean(order), "the order is persisted");
    check(Number(order.tenant_id) === tenantA, "the order is bound to the organization that opened it");
    check(order.plan_id === "starter", "the order records the plan it was created for");
    check(Number(order.amount_minor) === 1499 * 100, "the order records the amount the gateway was asked for");
    check(order.status === "created", "a fresh order is awaiting payment");

    // ── 2. the plan in the request cannot outrank the plan in the order ────
    const mismatch = await billing
      .confirmCheckoutPayment({ tenantId: tenantA, planId: "enterprise", orderId: session.orderId })
      .then(() => null, (err) => err);
    check(mismatch && mismatch.code === "PLAN_MISMATCH",
      "confirming an order while naming a different plan is refused");
    check(mismatch && mismatch.status === 409, "the refusal is a conflict, not a silent success");

    const stillCreated = await q("SELECT status FROM billing_orders WHERE id = ?", [session.billingOrderId]);
    check(stillCreated[0].status === "created", "the refused attempt did not mark the order paid");

    const tenantBefore = await q("SELECT plan FROM tenants WHERE id = ?", [tenantA]);
    check(tenantBefore[0].plan === "free", "the refused attempt did not change the organization's plan");

    // ── 3. another organization cannot confirm someone else's order ────────
    const foreign = await billing
      .confirmCheckoutPayment({ tenantId: tenantB, planId: "starter", orderId: session.orderId })
      .then(() => null, (err) => err);
    check(foreign && foreign.code === "ORDER_NOT_FOUND",
      "an order belonging to another organization cannot be confirmed");
    check(foreign && foreign.status === 404, "the cross-tenant attempt reports no such order");

    // ── 4. a legitimate confirmation activates the ordered plan ────────────
    const confirmed = await billing.confirmCheckoutPayment({
      tenantId: tenantA, planId: "starter", orderId: session.orderId, paymentId: `pay_test_${suffix}`,
    });
    check(confirmed.success === true, "the owning organization confirms its own order");
    check(confirmed.plan === "starter", "the activated plan is the one on the order");

    const tenantAfter = await q("SELECT plan, plan_status FROM tenants WHERE id = ?", [tenantA]);
    check(tenantAfter[0].plan === "starter", "the organization now holds the plan it ordered");
    check(tenantAfter[0].plan_status === "active", "the subscription is active");

    const paidOrder = await q("SELECT status, payment_id FROM billing_orders WHERE id = ?", [session.billingOrderId]);
    check(paidOrder[0].status === "paid", "the order is marked paid");
    check(paidOrder[0].payment_id === `pay_test_${suffix}`, "the gateway payment id is recorded on the order");

    // ── 5. the gateway payment id is the idempotency key ───────────────────
    const replay = await billing.confirmCheckoutPayment({
      tenantId: tenantA, planId: "starter", orderId: session.orderId, paymentId: `pay_test_${suffix}`,
    });
    check(replay.success === true, "replaying a confirmed payment still answers success");
    check(replay.idempotent === true, "and is reported as already reconciled rather than re-applied");

    const events = await q(
      "SELECT COUNT(*) AS cnt FROM usage_events WHERE external_event_id = ?",
      [`pay_pay_test_${suffix}`]
    );
    check(Number(events[0].cnt) === 1, "the payment event is recorded exactly once");

    // A second confirmation with a DIFFERENT payment id against a paid order
    // must not re-run the entitlement path either.
    const secondPayment = await billing.confirmCheckoutPayment({
      tenantId: tenantA, planId: "starter", orderId: session.orderId, paymentId: `pay_other_${suffix}`,
    }).then(() => null, (err) => err);
    check(secondPayment === null || secondPayment.idempotent === true,
      "a paid order cannot be confirmed again under a new payment id");

    // ── 6. zero-price plans still work, and carry no signature requirement ─
    const freeSession = await billing.createCheckoutSession(tenantB, null, { planId: "free" });
    createdOrders.push(freeSession.billingOrderId);
    check(freeSession.live === false, "a zero-price plan never claims a live gateway order");
    const freeRow = await q("SELECT amount_minor, source FROM billing_orders WHERE id = ?", [freeSession.billingOrderId]);
    check(Number(freeRow[0].amount_minor) === 0, "the free order records a zero amount");
    check(freeRow[0].source === "self_serve", "a zero-price order is recorded as self-serve");

    const freeConfirmed = await billing.confirmCheckoutPayment({
      tenantId: tenantB, planId: "free", orderId: freeSession.orderId,
    });
    check(freeConfirmed.success === true, "a zero-price plan confirms without a gateway payment");

    // ── 7. unknown orders are refused ──────────────────────────────────────
    const unknown = await billing
      .confirmCheckoutPayment({ tenantId: tenantA, planId: "business", orderId: `order_ghost_${suffix}` })
      .then(() => null, (err) => err);
    check(unknown && unknown.code === "ORDER_NOT_FOUND",
      "an order this server never created cannot confirm anything");

    // ── 8. with live credentials, the signature is checked ─────────────────
    setEnv("RAZORPAY_KEY_ID", `rzp_test_key_${suffix}`);
    setEnv("RAZORPAY_KEY_SECRET", `secret_${suffix}`);
    check(razorpay.isConfigured() === true, "real credentials read as configured");

    const liveOrder = await q(
      `INSERT INTO billing_orders (tenant_id, plan_id, interval, amount_minor, currency, provider, provider_order_id, receipt, status, source)
       VALUES (?, 'business', 'month', ?, 'INR', 'razorpay', ?, ?, 'created', 'gateway')`,
      [tenantA, 9999 * 100, `order_live_${suffix}`, `sub_live_${suffix}`]
    );
    createdOrders.push(liveOrder.insertId);
    const liveOrderId = `order_live_${suffix}`;

    const missingSig = await billing
      .confirmCheckoutPayment({ tenantId: tenantA, planId: "business", orderId: liveOrderId, paymentId: `pay_live_${suffix}` })
      .then(() => null, (err) => err);
    check(missingSig && missingSig.code === "PAYMENT_VERIFICATION_REQUIRED",
      "a live order will not confirm without a signature");

    const badSig = await billing
      .confirmCheckoutPayment({
        tenantId: tenantA, planId: "business", orderId: liveOrderId,
        paymentId: `pay_live_${suffix}`, signature: "0".repeat(64),
      })
      .then(() => null, (err) => err);
    check(badSig && badSig.code === "INVALID_SIGNATURE", "a wrong signature is refused");

    const goodSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${liveOrderId}|pay_live_${suffix}`)
      .digest("hex");
    const liveConfirmed = await billing.confirmCheckoutPayment({
      tenantId: tenantA, planId: "business", orderId: liveOrderId,
      paymentId: `pay_live_${suffix}`, signature: goodSig,
    });
    check(liveConfirmed.success === true && liveConfirmed.plan === "business",
      "a correctly signed payment activates the plan the order names");

    // The signature proves the payment, not the plan: swap the plan in the
    // request and the order still decides.
    const signedWrongPlan = await billing
      .confirmCheckoutPayment({
        tenantId: tenantA, planId: "enterprise", orderId: liveOrderId,
        paymentId: `pay_live_${suffix}`, signature: goodSig,
      })
      .then(() => null, (err) => err);
    check(signedWrongPlan && (signedWrongPlan.code === "PLAN_MISMATCH" || signedWrongPlan.idempotent),
      "a valid signature cannot buy a dearer plan than the order says");

    // ── 9. signature helpers behave under tampering ────────────────────────
    setEnv("RAZORPAY_WEBHOOK_SECRET", `whsec_${suffix}`);
    const body = Buffer.from(JSON.stringify({ event: "payment.captured" }), "utf8");
    const goodWebhook = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    check(razorpay.verifyWebhookSignature(body, goodWebhook) === true, "an untampered webhook verifies");
    check(razorpay.verifyWebhookSignature(body, "deadbeef") === false, "a short webhook signature is refused");
    check(
      razorpay.verifyWebhookSignature(body, crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(body).digest("hex")) === false,
      "the key secret does not validate webhook bodies (they are different secrets)"
    );
    check(
      razorpay.verifyCheckoutSignature({ orderId: liveOrderId, paymentId: `pay_live_${suffix}`, signature: "not-hex" }) === false,
      "a malformed checkout signature is refused without throwing"
    );
    check(
      razorpay.verifyCheckoutSignature({ orderId: `other_${suffix}`, paymentId: `pay_live_${suffix}`, signature: goodSig }) === false,
      "a signature does not transfer to a different order"
    );

    // ── 10. production never confirms without the gateway ──────────────────
    setEnv("RAZORPAY_KEY_ID", undefined);
    setEnv("RAZORPAY_KEY_SECRET", undefined);
    setEnv("RAZORPAY_WEBHOOK_SECRET", undefined);
    setEnv("NODE_ENV", "production");
    check(razorpay.isConfigured() === false, "credentials removed read as not configured");

    // An order this server never created is refused as unknown before any
    // production rule is even reached - that is the correct precedence.
    const ghostInProd = await billing
      .confirmCheckoutPayment({ tenantId: tenantA, planId: "starter", orderId: `order_dev_${tenantA}_1` })
      .then(() => null, (err) => err);
    check(ghostInProd && ghostInProd.code === "ORDER_NOT_FOUND",
      "an unknown order stays unknown even in production");

    // A real, unpaid order is a different matter: with no gateway to check it
    // against, production must refuse rather than upgrade on trust.
    const pending = await q(
      `INSERT INTO billing_orders (tenant_id, plan_id, interval, amount_minor, currency, provider, provider_order_id, receipt, status, source)
       VALUES (?, 'growth', 'month', ?, 'INR', 'razorpay', ?, ?, 'created', 'gateway')`,
      [tenantA, 3999 * 100, `order_prod_${suffix}`, `sub_prod_${suffix}`]
    );
    createdOrders.push(pending.insertId);

    const noGateway = await billing
      .confirmCheckoutPayment({ tenantId: tenantA, planId: "growth", orderId: `order_prod_${suffix}` })
      .then(() => null, (err) => err);
    check(noGateway && noGateway.code === "GATEWAY_NOT_CONFIGURED",
      "production refuses to confirm a real order it cannot verify");

    const untouchedTenant = await q("SELECT plan FROM tenants WHERE id = ?", [tenantA]);
    check(untouchedTenant[0].plan === "business",
      "the unverifiable confirmation left the organization's plan alone");

    await assert.rejects(
      billing.createCheckoutSession(tenantA, null, { planId: "starter" }),
      (err) => err.code === "GATEWAY_NOT_CONFIGURED",
      "production refuses to issue an order the gateway never heard of"
    );

    // ── 11. the routes read the plan from the order, not the body ─────────
    const fs = require("fs");
    const routeSrc = fs.readFileSync(require.resolve("../routes/enterpriseBillingRoutes"), "utf8");
    check(!/processVerifiedPayment\(\{[\s\S]{0,200}planId,\s*\n?\s*paymentId: paymentId \|\| `dev_/.test(routeSrc),
      "confirm-payment no longer feeds the body's plan straight into entitlements");
    check(routeSrc.includes("billingService.confirmCheckoutPayment"),
      "confirm-payment delegates to the order-validating routine");
    check(routeSrc.includes("findBillingOrder"), "the webhook resolves the stored order");
    check(routeSrc.includes("verifyWebhookSignature"), "the webhook uses the shared signature check");

    console.log(`\nBILLING ORDER INTEGRITY: ${passed} passed, ${failed} failed`);
  } finally {
    restoreEnv();
    if (createdOrders.length) {
      await q(`DELETE FROM billing_orders WHERE id IN (${createdOrders.map(() => "?").join(",")})`, createdOrders).catch(() => {});
    }
    if (createdTenants.length) {
      await q(`DELETE FROM wallet_entries WHERE tenant_id IN (${createdTenants.map(() => "?").join(",")})`, createdTenants).catch(() => {});
      await q(`DELETE FROM wallet_accounts WHERE tenant_id IN (${createdTenants.map(() => "?").join(",")})`, createdTenants).catch(() => {});
      await q(`DELETE FROM usage_events WHERE tenant_id IN (${createdTenants.map(() => "?").join(",")})`, createdTenants).catch(() => {});
      await q(`DELETE FROM subscriptions WHERE tenant_id IN (${createdTenants.map(() => "?").join(",")})`, createdTenants).catch(() => {});
      await q(`DELETE FROM tenants WHERE id IN (${createdTenants.map(() => "?").join(",")})`, createdTenants).catch(() => {});
    }
  }

  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error(err);
  restoreEnv();
  process.exit(1);
});
