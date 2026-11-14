# Payment Gateway Integration: Razorpay & Stripe

This document specifies the checkout orchestration, cryptographic signature verification, webhook processing, and idempotency guarantees for payment gateways.

---

## 1. Checkout Orchestration Flow

```
[User clicks Top-Up / Plan]
             |
             v
[POST /api/v2/billing/checkout or /wallet/topup]
             |
             v
[Gateway Order Creation] (order_id, amount_minor, currency)
             |
             v
[Client Modal Checkout] (Razorpay Standard / Stripe Elements)
             |
             v
[Payment Success Handshake]
             |
             +-------------------------------+
             |                               |
 (Client Sync Confirmation)        (Server Webhook Ingress)
             |                               |
             v                               v
[Cryptographic HMAC Verification]  [HMAC-SHA256 Webhook Verification]
             |                               |
             +---------------+---------------+
                             |
                             v
               [Idempotent Credit to Ledger]
```

---

## 2. Cryptographic Signature Verification

### 2.1 Razorpay Signature Verification
To prevent tampered payment payloads, client-submitted proofs are verified using HMAC-SHA256:
```javascript
const crypto = require("crypto");

function verifyRazorpaySignature({ orderId, paymentId, signature, keySecret }) {
  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}
```

### 2.2 Stripe Webhook Signature Verification
Incoming Stripe webhook payloads are verified against the raw request buffer:
```javascript
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

function verifyStripeWebhook(rawBody, signatureHeader, endpointSecret) {
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret);
}
```

---

## 3. Idempotency & Concurrency Guards

1. **Unique Order Reference**: The `wallet_topup_orders` and `billing_orders` tables enforce unique constraints on `order_id` and `provider_order_id`.
2. **Double-Credit Protection**: If a webhook arrives after the client confirmation already credited the wallet, the status check detects `captured` and returns an HTTP 200 without executing a second credit.
3. **Fail-Closed Verification**: If secret keys are unconfigured or verification fails, the transaction is rejected and flagged for manual audit.
