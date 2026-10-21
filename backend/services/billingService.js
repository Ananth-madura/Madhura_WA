/**
 * billingService.js
 *
 * Enterprise SaaS subscriptions, Razorpay checkout, webhook reconciliation,
 * append-only wallet ledger, and entitlement evaluation.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md §7, §8, §9, §10, §11
 */

const crypto = require("crypto");
const db = require("../config/database");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

/**
 * Get all available plans from the canonical catalog.
 */
async function getPlans() {
  const plans = await q("SELECT * FROM plans WHERE is_active = 1 ORDER BY price_inr ASC");
  return plans.map((p) => ({
    ...p,
    features: typeof p.features_json === "string" ? JSON.parse(p.features_json) : p.features_json || [],
  }));
}

/**
 * Get subscription, entitlement usage, and wallet balances for an organization.
 */
async function getTenantBillingSummary(tenantId) {
  const tid = Number(tenantId);

  // 1. Fetch tenant & plan details
  const [tenant] = await q(
    `SELECT t.id, t.name, t.plan, t.plan_status, t.max_branches, t.max_seats, t.max_senders, t.max_monthly_messages,
            p.name as plan_name, p.badge as plan_badge, p.price_inr, p.max_contacts, p.features_json
     FROM tenants t
     LEFT JOIN plans p ON t.plan = p.id
     WHERE t.id = ? LIMIT 1`,
    [tid]
  );

  if (!tenant) throw new Error("Organization not found");

  // 2. Fetch current active subscription
  const [subscription] = await q(
    `SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY id DESC LIMIT 1`,
    [tid]
  );

  // 3. Current Resource Usage
  const [branches] = await q("SELECT COUNT(*) as count FROM branches WHERE tenant_id = ? AND status != 'archived'", [tid]);
  const [members] = await q("SELECT COUNT(*) as count FROM organization_memberships WHERE tenant_id = ? AND membership_status = 'active'", [tid]);
  const [senders] = await q("SELECT COUNT(*) as count FROM wa_senders WHERE tenant_id = ? AND status = 'connected'", [tid]);
  const [contacts] = await q("SELECT COUNT(*) as count FROM wa_contacts WHERE tenant_id = ?", [tid]);

  // Usage is per billing period, not lifetime: the plan quota is
  // `max_monthly_messages`, so counting every row the tenant has ever sent
  // would show every long-lived tenant as permanently over quota.
  const periodStart = `${new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    .toISOString()
    .slice(0, 19)
    .replace("T", " ")}`;
  const messagesThisMonth = await q(
    "SELECT COUNT(*) as count FROM wa_message_logs WHERE tenant_id = ? AND created_at >= ?",
    [tid, periodStart]
  ).catch(() => null);

  // 4. Wallet Accounts
  const wallets = await q("SELECT * FROM wallet_accounts WHERE tenant_id = ?", [tid]);

  return {
    organization: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      plan_name: tenant.plan_name || tenant.plan,
      plan_badge: tenant.plan_badge || "Active",
      plan_status: tenant.plan_status,
      price_inr: tenant.price_inr || 0,
      features: typeof tenant.features_json === "string" ? JSON.parse(tenant.features_json) : tenant.features_json || [],
    },
    subscription: subscription || {
      plan_id: tenant.plan,
      status: tenant.plan_status || "active",
      provider: "none",
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    usage: {
      branches: { used: Number(branches?.count || 0), max: tenant.max_branches },
      seats: { used: Number(members?.count || 0), max: tenant.max_seats },
      senders: { used: Number(senders?.count || 0), max: tenant.max_senders },
      contacts: { used: Number(contacts?.count || 0), max: Number(tenant.max_contacts || 50000) },
      monthly_messages: { used: Number(messagesThisMonth?.count || 0), max: tenant.max_monthly_messages },
    },
    wallets: wallets.reduce((acc, w) => {
      acc[w.credit_type] = { balance: w.balance, reserved: w.reserved_balance, currency: w.currency };
      return acc;
    }, {}),
  };
}

/**
 * Initiates checkout for plan upgrade or subscription.
 *
 * The order is created HERE, server-side, and recorded in `billing_orders`
 * with the plan, the amount and the organization already fixed. Checkout's
 * signature only ever covers `order_id|payment_id`, so anything the browser
 * claims about *what it paid for* has to be re-read from this row at confirm
 * time rather than trusted from the request body.
 *
 * With live credentials this is a real Razorpay order (the gateway, not the
 * client, decides the amount). Without them - local/dev - a deterministic
 * `order_dev_...` id is recorded instead so the confirm path still has a row
 * to validate against; it is never acceptable in production.
 *
 * @returns {{success, provider, live, keyId, orderId, receipt, amount, currency, planId, planName, prefill, notes}}
 */
async function createCheckoutSession(tenantId, userId, { planId, interval = "month" }) {
  const tid = Number(tenantId);
  const cleanPlanId = String(planId || "").toLowerCase();
  const isProduction = process.env.NODE_ENV === "production";

  const [plan] = await q("SELECT * FROM plans WHERE id = ? AND is_active = 1 LIMIT 1", [cleanPlanId]);
  if (!plan) throw new Error("Selected plan does not exist");

  const [tenant] = await q("SELECT * FROM tenants WHERE id = ? LIMIT 1", [tid]);
  if (!tenant) throw new Error("Organization not found");

  const [user] = await q("SELECT email, first_name FROM users WHERE id = ? LIMIT 1", [userId]);

  const razorpay = require("./razorpayClient");
  const amountMinor = Math.round(Number(plan.price_inr) * 100); // paise
  const receiptId = `sub_${tid}_${Date.now()}`;

  const notes = { tenant_id: String(tid), plan_id: plan.id, interval: String(interval || "month") };

  let live = false;
  let providerOrderId = null;
  let source = "gateway";

  if (amountMinor <= 0) {
    // A zero-price plan (the free tier, or a downgrade) has nothing for the
    // gateway to charge, so no order is created with Razorpay. The row still
    // exists so the confirm path validates organization and plan the same way -
    // it just can never carry a paid plan, because it can only ever be created
    // for a plan whose catalog price is zero.
    providerOrderId = `order_free_${tid}_${Date.now()}`;
    source = "self_serve";
  } else if (razorpay.isConfigured()) {
    const order = await razorpay.createOrder({ amountMinor, currency: "INR", receipt: receiptId, notes });
    providerOrderId = order.id;
    live = true;
  } else if (isProduction) {
    // Never let a live deployment issue an order the gateway has never heard
    // of: it would confirm without any way to verify it.
    const err = new Error("Payment gateway is not configured");
    err.code = "GATEWAY_NOT_CONFIGURED";
    throw err;
  } else {
    providerOrderId = `order_dev_${tid}_${Date.now()}`;
    source = "development";
  }

  const insert = await q(
    `INSERT INTO billing_orders
       (tenant_id, user_id, plan_id, interval, amount_minor, currency, provider,
        provider_order_id, receipt, status, source)
     VALUES (?, ?, ?, ?, ?, 'INR', 'razorpay', ?, ?, 'created', ?)`,
    [tid, userId || null, plan.id, String(interval || "month"), amountMinor, providerOrderId, receiptId, source]
  );
  const billingOrderId = insert && insert.insertId;

  return {
    success: true,
    provider: "razorpay",
    live,
    billingOrderId,
    keyId: razorpay.keyId() || process.env.RAZORPAY_KEY_ID || "rzp_test_mock_key_2026",
    // Both names: the gateway calls it order_id, and the existing frontend
    // sends `receipt` as its orderId, so neither side has to guess.
    orderId: providerOrderId,
    order_id: providerOrderId,
    receipt: receiptId,
    amount: amountMinor,
    currency: "INR",
    planId: plan.id,
    planName: plan.name,
    prefill: {
      name: user ? user.first_name : tenant.name,
      email: user ? user.email : "",
    },
    notes,
  };
}

/**
 * Look up the checkout record the browser says it paid for.
 *
 * The row - not the request - decides which organization, which plan and which
 * amount a payment was allowed to unlock. Returns null when there is no such
 * record, when it belongs to another organization, or when the plan named in
 * the request is not the plan that was ordered.
 */
async function findBillingOrder({ tenantId, orderId, receipt, planId }) {
  const wanted = [orderId, receipt].filter(Boolean).map(String);
  if (!wanted.length) return null;

  const placeholders = wanted.map(() => "?").join(",");
  const rows = await q(
    `SELECT * FROM billing_orders
     WHERE provider_order_id IN (${placeholders}) OR receipt IN (${placeholders})
     ORDER BY id DESC LIMIT 1`,
    [...wanted, ...wanted]
  );
  const order = rows && rows[0];
  if (!order) return null;

  // Organization and plan are constraints only when the caller supplied them:
  // the webhook resolves the row first (to learn the organization) and the
  // confirm path names the plan separately, so both can still read the record
  // back - but neither can read back one that contradicts what it already knows.
  const tid = Number(tenantId);
  if (Number.isFinite(tid) && tid > 0 && Number(order.tenant_id) !== tid) return null;
  if (planId && String(order.plan_id).toLowerCase() !== String(planId).toLowerCase()) return null;
  return order;
}

/**
 * Reconcile a payment that has been verified against the gateway.
 *
 * @param {object} args
 * @param {number} args.tenantId
 * @param {string} args.planId    plan the payment was FOR - normally read back
 *                                from the billing_orders row, never from a
 *                                request body the client controls
 * @param {string} args.paymentId gateway payment id (the idempotency key)
 * @param {string} [args.orderId]
 * @param {string} [args.source]  'gateway' | 'development'
 * @param {object} [args.billingOrder] the row this payment belongs to
 */
async function processVerifiedPayment({ tenantId, planId, paymentId, orderId, source = "gateway", billingOrder = null }) {
  const tid = Number(tenantId);

  // When we know the ordered plan, it wins over whatever the caller passed:
  // a signature that only binds `order_id|payment_id` cannot prove the plan.
  const cleanPlanId = String((billingOrder && billingOrder.plan_id) || planId || "").toLowerCase();

  const [plan] = await q("SELECT * FROM plans WHERE id = ? LIMIT 1", [cleanPlanId]);
  if (!plan) throw new Error("Plan does not exist");

  // The gateway payment id is the idempotency key. Falling back to Date.now()
  // meant a replayed (or duplicated) webhook created a *new* event every time,
  // so entitlements and wallet credits could be granted repeatedly.
  const eventKey = paymentId ? `pay_${paymentId}` : orderId ? `order_${orderId}` : null;
  if (!eventKey) {
    throw new Error("A gateway payment reference is required to reconcile a subscription");
  }

  // 1. Idempotency Check via usage_events / ledger
  const existingEvent = await q("SELECT id FROM usage_events WHERE meter_key = 'subscription_payment' AND external_event_id = ? LIMIT 1", [eventKey]);
  if (existingEvent && existingEvent.length > 0) {
    return { success: true, message: "Payment already reconciled" };
  }

  // 2. Log usage / payment event
  try {
    await q(
      `INSERT INTO usage_events (tenant_id, meter_key, quantity, external_event_id)
       VALUES (?, 'subscription_payment', ?, ?)`,
      [tid, plan.price_inr, eventKey]
    );
  } catch (err) {
    // Unique constraint is the race-free idempotency guarantee: a concurrent
    // webhook that lost the race must not continue to the credit steps.
    if (/duplicate|unique/i.test(err.message || "")) {
      return { success: true, message: "Payment already reconciled" };
    }
    throw err;
  }

  // 3. Upsert Subscription
  // Serialized the same way `periodStart` is above: the SQLite engine binds
  // primitives, so handing it a Date object throws and the subscription row
  // was never written (the plan still changed, leaving the two out of step).
  const periodEnd = `${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ")}`;
  await q(
    `INSERT INTO subscriptions (tenant_id, plan_id, provider, provider_sub_id, status, current_period_end)
     VALUES (?, ?, 'razorpay', ?, 'active', ?)`,
    [tid, cleanPlanId, paymentId || orderId, periodEnd]
  );

  // 4. Update Tenant Entitlements to match the new plan
  await q(
    `UPDATE tenants SET 
      plan = ?, 
      plan_status = 'active',
      max_branches = ?,
      max_seats = ?,
      max_senders = ?,
      max_monthly_messages = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      cleanPlanId,
      plan.max_branches,
      plan.max_seats,
      plan.max_senders,
      plan.max_monthly_messages,
      tid,
    ]
  );

  // 5. Credit initial wallet bonus for the new plan
  const aiCreditGrant = cleanPlanId === "growth" ? 500 : cleanPlanId === "business" ? 2500 : cleanPlanId === "enterprise" ? 10000 : 100;
  await grantWalletCredits(tid, "ai_credits", aiCreditGrant, `Plan upgrade to ${plan.name}`, eventKey);

  // 6. Close out the checkout record, so a second confirmation for the same
  //    order cannot walk the same entitlement path a second time.
  if (billingOrder && billingOrder.id) {
    await q(
      `UPDATE billing_orders SET status = 'paid', payment_id = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'created'`,
      [paymentId || null, billingOrder.id]
    ).catch(() => {});
  }

  return {
    success: true,
    plan: cleanPlanId,
    status: "active",
    expires_at: periodEnd,
  };
}

/**
 * Confirm a checkout from the browser's Razorpay Checkout success response.
 *
 * Order first, signature second, plan third:
 *   1. the billing_orders row decides the organization and the plan (the
 *      signature cannot - it only covers `order_id|payment_id`),
 *   2. the signature proves Razorpay actually issued that payment for that
 *      order, using the key secret (never the webhook secret, which signs a
 *      different thing),
 *   3. only then are entitlements written.
 *
 * Non-production deployments without credentials still confirm - but only for
 * an order this server created, for this same organization, at the price that
 * order recorded. Production never takes that path.
 */
async function confirmCheckoutPayment({ tenantId, userId, planId, paymentId, orderId, signature }) {
  const isProduction = process.env.NODE_ENV === "production";
  const razorpay = require("./razorpayClient");
  const tid = Number(tenantId);

  const billingOrder = await findBillingOrder({ tenantId: tid, orderId, receipt: orderId, planId: null });
  if (!billingOrder) {
    const err = new Error("No checkout session found for this payment");
    err.code = "ORDER_NOT_FOUND";
    err.status = 404;
    throw err;
  }

  // The order already names its plan; a request naming a different one is
  // either stale or an attempt to buy one plan and activate another.
  if (planId && String(billingOrder.plan_id).toLowerCase() !== String(planId).toLowerCase()) {
    const err = new Error("The requested plan does not match the plan that was ordered");
    err.code = "PLAN_MISMATCH";
    err.status = 409;
    throw err;
  }

  if (billingOrder.status === "paid") {
    return { success: true, message: "Payment already reconciled", plan: billingOrder.plan_id, idempotent: true };
  }

  let source = "gateway";

  if (Number(billingOrder.amount_minor) <= 0 || billingOrder.source === "self_serve") {
    // Zero-price order: there is no gateway payment behind it, so there is no
    // signature to verify and none is accepted. Only a row this server created
    // for a catalog plan priced at zero can reach here, and the plan credited
    // is read from that row.
    source = "self_serve";
    if (!paymentId) paymentId = `free_${tid}_${billingOrder.plan_id}_${billingOrder.id}`;
  } else if (razorpay.isConfigured()) {
    if (!paymentId || !signature) {
      const err = new Error("Plan changes require a verified gateway payment");
      err.code = "PAYMENT_VERIFICATION_REQUIRED";
      err.status = 400;
      throw err;
    }
    if (!razorpay.verifyCheckoutSignature({ orderId: billingOrder.provider_order_id, paymentId, signature })) {
      const err = new Error("Invalid payment signature");
      err.code = "INVALID_SIGNATURE";
      err.status = 400;
      throw err;
    }
  } else if (isProduction) {
    const err = new Error("Payment verification is not configured");
    err.code = "GATEWAY_NOT_CONFIGURED";
    err.status = 503;
    throw err;
  } else {
    // Development: no gateway credentials, so there is no signature to check.
    // Still bounded by the stored order - organization, plan and amount are the
    // ones this server recorded - and only ever recorded as `development`.
    source = "development";
    if (!paymentId) paymentId = `dev_${tid}_${billingOrder.plan_id}_${billingOrder.id}`;
  }

  return processVerifiedPayment({
    tenantId: tid,
    planId: billingOrder.plan_id,
    paymentId,
    orderId: billingOrder.provider_order_id,
    source,
    billingOrder,
  });
}

/**
 * Grant wallet credits in an append-only ledger transaction.
 */
async function grantWalletCredits(tenantId, creditType, amount, reason, referenceId = null) {
  const tid = Number(tenantId);
  const amt = Number(amount);

  // 1. Ensure account exists
  await q(
    `INSERT OR IGNORE INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance)
     VALUES (?, 'INR', ?, 0, 0)`,
    [tid, creditType]
  );

  // 2. Update balance
  await q(
    `UPDATE wallet_accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP 
     WHERE tenant_id = ? AND credit_type = ?`,
    [amt, tid, creditType]
  );

  const [account] = await q(
    "SELECT id, balance FROM wallet_accounts WHERE tenant_id = ? AND credit_type = ? LIMIT 1",
    [tid, creditType]
  );

  // 3. Record append-only entry
  if (account) {
    await q(
      `INSERT INTO wallet_entries (tenant_id, account_id, entry_type, amount, balance_after, reason, reference_id)
       VALUES (?, ?, 'credit', ?, ?, ?, ?)`,
      [tid, account.id, amt, account.balance, reason, referenceId]
    );
  }

  return { success: true, accountId: account?.id, balance: account?.balance || 0 };
}

/**
 * Evaluate entitlement against tenant's active plan.
 */
async function evaluateEntitlement(tenantId, featureName) {
  const tid = Number(tenantId);
  const [tenant] = await q("SELECT * FROM tenants WHERE id = ? LIMIT 1", [tid]);
  if (!tenant) return false;
  if (tenant.plan_status !== "active") return false;

  const plan = tenant.plan;
  switch (featureName) {
    case "multi_branch":
      return tenant.max_branches > 1;
    case "ai_replies":
      return Boolean(tenant.ai_replies_enabled || ["growth", "business", "enterprise"].includes(plan));
    case "custom_roles":
      return ["growth", "business", "enterprise"].includes(plan);
    case "flows":
      return Boolean(tenant.flows_enabled || ["starter", "growth", "business", "enterprise"].includes(plan));
    case "api_access":
      return ["growth", "business", "enterprise"].includes(plan);
    default:
      return true;
  }
}

module.exports = {
  getPlans,
  getPlanCatalog: getPlans,
  getTenantBillingSummary,
  createCheckoutSession,
  confirmCheckoutPayment,
  findBillingOrder,
  processVerifiedPayment,
  grantWalletCredits,
  evaluateEntitlement,
};
