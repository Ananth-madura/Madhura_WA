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
    price:new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(p.price_inr)),
    billing:Number(p.price_inr)===0?"Free plan":"/ 30 days",
    maxSenders:p.max_senders,maxBranches:p.max_branches,maxSeats:p.max_seats,maxMonthlyMessages:p.max_monthly_messages,maxContacts:p.max_contacts,
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
    `SELECT t.id, t.name, t.plan, t.plan_status, t.pending_plan_id, t.max_branches, t.max_seats, t.max_senders, t.max_monthly_messages,
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
      pending_plan_id: tenant.pending_plan_id,
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
      monthly_messages: { used: Number(messagesThisMonth?.[0]?.count || 0), max: tenant.max_monthly_messages },
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
 * Simulated paid orders require an explicit development-only opt-in.
 *
 * @returns {{success, provider, live, keyId, orderId, receipt, amount, currency, planId, planName, prefill, notes}}
 */
async function createCheckoutSession(tenantId, userId, { planId, interval = "month" }) {
  const tid = Number(tenantId);
  const cleanPlanId = String(planId || "").toLowerCase();
  if(interval!=="month")throw Object.assign(new Error("Only monthly, one-time checkout is supported"),{status:400,code:"INVALID_INTERVAL"});
  const isProduction = process.env.NODE_ENV === "production";

  const [plan] = await q("SELECT * FROM plans WHERE id = ? AND is_active = 1 LIMIT 1", [cleanPlanId]);
  if (!plan) throw new Error("Selected plan does not exist");

  const [tenant] = await q("SELECT * FROM tenants WHERE id = ? LIMIT 1", [tid]);
  if (!tenant) throw new Error("Organization not found");

  const [user] = await q("SELECT email, first_name FROM users WHERE id = ? LIMIT 1", [userId]);

  const razorpay = require("./razorpayClient");
  const amountMinor = Math.round(Number(plan.price_inr) * 100); // paise
  if(!Number.isSafeInteger(amountMinor)||amountMinor<0)throw new Error("Plan price is invalid");
  if(amountMinor>0&&process.env.RAZORPAY_CHECKOUT_ENABLED==="0")throw Object.assign(new Error("New paid checkouts are temporarily paused"),{code:"CHECKOUT_PAUSED",status:503});
  const receiptId = `sub_${tid}_${crypto.randomBytes(8).toString("hex")}`;

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
  } else if (razorpay.checkoutEnabled()) {
    const order = await razorpay.createOrder({ amountMinor, currency: "INR", receipt: receiptId, notes });
    providerOrderId = order.id;
    live = true;
  } else if (isProduction || process.env.BILLING_ALLOW_DEV_PAYMENTS !== "1" || razorpay.isConfigured()) {
    // Never let a live deployment issue an order the gateway has never heard
    // of: it would confirm without any way to verify it.
    const err = new Error("Payment gateway is not configured");
    err.code = "GATEWAY_NOT_CONFIGURED";
    err.status = 503;
    throw err;
  } else {
    providerOrderId = `order_dev_${tid}_${Date.now()}`;
    source = "development";
  }

  const insert = await q(
    `INSERT INTO billing_orders
       (tenant_id, user_id, plan_id, \`interval\`, amount_minor, currency, provider,
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
    keyId: razorpay.keyId(),
    // Keep the snake-case alias for existing API consumers.
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
async function processVerifiedPayment(args) {
  return require("./billingReconciliation").createReconciler(db)(args);
}
async function reconcileGatewayOrder({orderId,paymentId,payment}) {
  const order=await findBillingOrder({orderId});
  if(!order||order.provider_order_id!==orderId||order.source!=="gateway")return {ignored:true};
  const gateway=require("./razorpayClient");
  if(!payment)payment=paymentId?await gateway.fetchPayment(paymentId):(await gateway.fetchOrderPayments(orderId)).find(row=>row.status==="captured");
  require("./billingReconciliation").validateCapturedPayment(order,payment);
  return processVerifiedPayment({tenantId:order.tenant_id,planId:order.plan_id,paymentId:payment.id,orderId,source:"gateway",billingOrder:order});
}
async function getBillingOrders(tenantId) {
  return q("SELECT id, plan_id, amount_minor, currency, provider_order_id, payment_id, status, source, created_at, paid_at FROM billing_orders WHERE tenant_id = ? ORDER BY id DESC LIMIT 50",[Number(tenantId)]);
}
async function skipOnboardingPayment(tenantId){
  await q("UPDATE tenants SET pending_plan_id = NULL WHERE id = ?",[Number(tenantId)]);
}
async function canManageBilling(req){
  if(req.userRole==="organization_owner"||req.user?.role==="platform_admin")return true;
  const [role]=await q("SELECT id FROM roles WHERE code = ? AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1",[req.userRole,req.tenantId]);
  if(!role)return false;
  return (await q("SELECT id FROM role_permissions WHERE role_id = ? AND permission_code = 'billing.manage' LIMIT 1",[role.id])).length>0;
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
 * Simulated confirmations require an explicit development-only opt-in and a
 * stored development order. Production always requires gateway verification.
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

  if (Number(billingOrder.amount_minor) === 0 && billingOrder.source === "self_serve") {
    // Zero-price order: there is no gateway payment behind it, so there is no
    // signature to verify and none is accepted. Only a row this server created
    // for a catalog plan priced at zero can reach here, and the plan credited
    // is read from that row.
    source = "self_serve";
    paymentId = `free_${tid}_${billingOrder.plan_id}_${billingOrder.id}`;
  } else if (razorpay.isConfigured()) {
    if (!paymentId || !signature) {
      const err = new Error("Plan changes require a verified gateway payment");
      err.code = "PAYMENT_VERIFICATION_REQUIRED";
      err.status = 400;
      throw err;
    }
    if(billingOrder.source!=="gateway")throw Object.assign(new Error("Checkout order is not a gateway order"),{code:"INVALID_ORDER_SOURCE",status:409});
    if (!razorpay.verifyCheckoutSignature({ orderId: billingOrder.provider_order_id, paymentId, signature })) {
      const err = new Error("Invalid payment signature");
      err.code = "INVALID_SIGNATURE";
      err.status = 400;
      throw err;
    }
  } else if (isProduction || process.env.BILLING_ALLOW_DEV_PAYMENTS !== "1" || billingOrder.source !== "development") {
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

  if(source==="gateway"){
    const payment=await razorpay.fetchPayment(paymentId);
    require("./billingReconciliation").validateCapturedPayment(billingOrder,payment);
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
    `INSERT IGNORE INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance)
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
  getBillingOrders,
  skipOnboardingPayment,
  canManageBilling,
  reconcileGatewayOrder,
  getPlanCatalog: getPlans,
  getTenantBillingSummary,
  createCheckoutSession,
  confirmCheckoutPayment,
  findBillingOrder,
  processVerifiedPayment,
  grantWalletCredits,
  evaluateEntitlement,
};
