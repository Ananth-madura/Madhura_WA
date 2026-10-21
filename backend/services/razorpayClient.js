"use strict";

/**
 * razorpayClient.js
 *
 * A deliberately small Razorpay REST wrapper - order creation plus the two
 * signature checks this codebase needs - built on axios rather than the
 * `razorpay` SDK so the dependency surface stays what package.json already
 * declares.
 *
 * Two different secrets, two different signatures. They are not
 * interchangeable and conflating them silently rejects every legitimate
 * payment:
 *
 *   - RAZORPAY_KEY_SECRET   signs `order_id|payment_id` for a Checkout success
 *     response, and authenticates the Orders API over HTTP basic auth.
 *   - RAZORPAY_WEBHOOK_SECRET signs the exact raw bytes Razorpay POSTed to
 *     /webhooks/razorpay (x-razorpay-signature).
 *
 * `rzp_test_mock_key_2026` is the placeholder the billing service used to
 * fabricate when nothing was configured; it is treated as "not configured" so
 * a deployment can never believe it holds live credentials it does not have.
 */

const axios = require("axios");
const crypto = require("crypto");

const RAZORPAY_API_BASE = process.env.RAZORPAY_API_BASE || "https://api.razorpay.com/v1";
const MOCK_KEY_PLACEHOLDER = "rzp_test_mock_key_2026";

function keyId() {
  const id = process.env.RAZORPAY_KEY_ID;
  if (!id || id === MOCK_KEY_PLACEHOLDER) return null;
  return id;
}

function keySecret() {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || secret === MOCK_KEY_PLACEHOLDER) return null;
  return secret;
}

function webhookSecret() {
  return process.env.RAZORPAY_WEBHOOK_SECRET || null;
}

/** True when this deployment can actually talk to Razorpay. */
function isConfigured() {
  return Boolean(keyId() && keySecret());
}

function authHeader() {
  const token = Buffer.from(`${keyId()}:${keySecret()}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

/**
 * Create a server-side order. The order - not the client - is what fixes the
 * amount, the currency and the plan a payment is allowed to unlock, so nothing
 * about the purchase has to be trusted from the browser.
 *
 * @param {object} opts
 * @param {number} opts.amountMinor amount in the currency's minor unit (paise)
 * @param {string} [opts.currency]
 * @param {string} opts.receipt     our own id for this checkout attempt
 * @param {object} [opts.notes]     opaque key/value echoed back on webhooks
 * @returns {Promise<{id: string, amount: number, currency: string, status: string, raw: object}>}
 */
async function createOrder({ amountMinor, currency = "INR", receipt, notes = {} }) {
  if (!isConfigured()) {
    const err = new Error("Razorpay credentials are not configured");
    err.code = "GATEWAY_NOT_CONFIGURED";
    throw err;
  }
  if (!Number.isFinite(Number(amountMinor)) || Number(amountMinor) <= 0) {
    const err = new Error("Order amount must be a positive number of minor units");
    err.code = "INVALID_AMOUNT";
    throw err;
  }

  const { data } = await axios.post(
    `${RAZORPAY_API_BASE}/orders`,
    {
      amount: Math.round(Number(amountMinor)),
      currency,
      receipt,
      notes,
    },
    {
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      timeout: 15000,
    }
  );

  return { id: data.id, amount: data.amount, currency: data.currency, status: data.status, raw: data };
}

/**
 * Verify a Checkout success response: HMAC-SHA256 of `order_id|payment_id`
 * under the key secret. Constant-time, and length-checked before comparison.
 */
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  const secret = keySecret();
  if (!secret || !orderId || !paymentId || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return timingSafeEqualHex(String(signature), expected);
}

/**
 * Verify a webhook delivery: HMAC-SHA256 of the exact raw request body under
 * the webhook secret (x-razorpay-signature). Re-serializing req.body would
 * reorder keys and never match, which is why the raw buffer is passed in.
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = webhookSecret();
  if (!secret || !signature) return false;
  if (!Buffer.isBuffer(rawBody)) rawBody = Buffer.from(String(rawBody), "utf8");

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(String(signature), expected);
}

/** Length-checked constant-time hex comparison (never throws on mismatch). */
function timingSafeEqualHex(received, expected) {
  const a = Buffer.from(String(received), "utf8");
  const b = Buffer.from(String(expected), "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  createOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  timingSafeEqualHex,
  keyId,
  keySecret,
  webhookSecret,
};
