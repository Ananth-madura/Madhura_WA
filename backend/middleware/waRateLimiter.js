/**
 * waRateLimiter.js
 *
 * Enterprise Multi-Tenant Rate Limiting, Flood Protection & Webhook Security
 * Protects VPS resources against noisy neighbor tenants and high-volume burst attacks.
 */

const crypto = require("crypto");

// Sliding window in-memory rate tracker
// Key: `${tenantId}:${userId}:${endpointCategory}` -> [timestamps]
const requestWindows = new Map();

// Periodic cleanup of expired window buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  const cutoff = now - 15 * 60 * 1000;
  for (const [key, timestamps] of requestWindows.entries()) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) {
      requestWindows.delete(key);
    } else {
      requestWindows.set(key, valid);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates a rate limiting middleware for a specific endpoint category.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default 60000 / 1 min)
 * @param {number} options.maxRequests - Max requests allowed per window (default 120)
 * @param {string} options.category - Category identifier (e.g., 'campaign_launch', 'api_send', 'qr_scan')
 */
function createRateLimiter({ windowMs = 60000, maxRequests = 120, category = "default" } = {}) {
  return (req, res, next) => {
    const tenantId = req.user?.tenant_id || 1;
    const userId = req.user?.id || req.ip || "anon";
    const key = `${tenantId}:${userId}:${category}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const existingTimestamps = requestWindows.get(key) || [];
    const recentRequests = existingTimestamps.filter((t) => t > windowStart);

    if (recentRequests.length >= maxRequests) {
      const retryAfterSec = Math.ceil((recentRequests[0] + windowMs - now) / 1000);
      res.setHeader("Retry-After", Math.max(1, retryAfterSec));
      return res.status(429).json({
        error: "Too Many Requests",
        message: `Tenant rate limit exceeded for ${category}. Maximum ${maxRequests} requests per ${windowMs / 1000}s. Please retry in ${retryAfterSec}s.`,
        retryAfter: retryAfterSec,
      });
    }

    recentRequests.push(now);
    requestWindows.set(key, recentRequests);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - recentRequests.length));
    next();
  };
}

/**
 * Validates Meta WhatsApp Cloud API Webhook HMAC-SHA256 signature
 */
function verifyMetaWebhookSignature(req, res, next) {
  const signature = req.headers["x-hub-signature-256"];
  const appSecret = process.env.META_APP_SECRET || process.env.WA_APP_SECRET;

  if (!signature || !appSecret) {
    return next(); // Skip signature check if app secret is not explicitly configured
  }

  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const expectedSignature = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return next();
    }
    console.warn("⚠️ Invalid Meta Webhook Signature rejected");
    return res.status(401).json({ error: "Invalid webhook signature" });
  } catch (err) {
    console.warn("⚠️ Webhook signature verification error:", err.message);
    return res.status(401).json({ error: "Webhook verification failed" });
  }
}

module.exports = {
  createRateLimiter,
  campaignLaunchLimiter: createRateLimiter({ windowMs: 60000, maxRequests: 20, category: "campaign_launch" }),
  messageSendLimiter: createRateLimiter({ windowMs: 60000, maxRequests: 200, category: "message_send" }),
  generalApiLimiter: createRateLimiter({ windowMs: 60000, maxRequests: 600, category: "general_api" }),
  verifyMetaWebhookSignature,
};
