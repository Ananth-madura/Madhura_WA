/**
 * waRateLimiter.js
 *
 * Enterprise Multi-Tenant Rate Limiting, Flood Protection & Webhook Security
 * Protects VPS resources against noisy neighbor tenants, burst attacks, and resource exhaustion.
 */

const crypto = require("crypto");

// Sliding window in-memory rate tracker
// Key: `${tenantId}:${identifier}:${category}` -> [timestamps]
const requestWindows = new Map();
const throttleMap = new Map();

// Periodic cleanup of expired window buckets every 3 minutes
setInterval(() => {
  const now = Date.now();
  const windowCutoff = now - 15 * 60 * 1000;
  for (const [key, timestamps] of requestWindows.entries()) {
    const valid = timestamps.filter((t) => t > windowCutoff);
    if (valid.length === 0) {
      requestWindows.delete(key);
    } else {
      requestWindows.set(key, valid);
    }
  }

  for (const [key, timestamp] of throttleMap.entries()) {
    if (timestamp < now - 60 * 1000) {
      throttleMap.delete(key);
    }
  }
}, 3 * 60 * 1000);

/**
 * Extracts a dependable unique client identifier accounting for reverse proxies (Render, Vercel, Cloudflare, nginx)
 */
function getClientIdentifier(req) {
  if (req.user?.id) return `u:${req.user.id}`;
  const cfIp = req.headers["cf-connecting-ip"];
  const xRealIp = req.headers["x-real-ip"];
  const xForwarded = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const rawIp = req.ip || req.connection?.remoteAddress;
  return `ip:${cfIp || xRealIp || xForwarded || rawIp || "anon"}`;
}

/**
 * Creates a sliding-window rate limiting middleware for a specific endpoint category.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default 60000 / 1 min)
 * @param {number} options.maxRequests - Max requests allowed per window (default 120)
 * @param {string} options.category - Category identifier (e.g., 'campaign_launch', 'message_send', 'qr_refresh')
 */
function createRateLimiter({ windowMs = 60000, maxRequests = 120, category = "default" } = {}) {
  return (req, res, next) => {
    const tenantId = req.user?.tenant_id || 1;
    const identifier = getClientIdentifier(req);
    const key = `${tenantId}:${identifier}:${category}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const existingTimestamps = requestWindows.get(key) || [];
    const recentRequests = existingTimestamps.filter((t) => t > windowStart);

    if (recentRequests.length >= maxRequests) {
      const oldestInWindow = recentRequests[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      res.setHeader("Retry-After", retryAfterSec);
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", Math.ceil((oldestInWindow + windowMs) / 1000));
      return res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit reached for ${category}. Maximum ${maxRequests} requests per ${windowMs / 1000}s. Please retry in ${retryAfterSec}s.`,
        retryAfter: retryAfterSec,
      });
    }

    recentRequests.push(now);
    requestWindows.set(key, recentRequests);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - recentRequests.length));
    res.setHeader("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000));
    next();
  };
}

/**
 * Creates a lightweight throttle middleware that ensures a cooldown period between requests.
 * @param {Object} options
 * @param {number} options.cooldownMs - Minimum milliseconds between calls
 * @param {string} options.category - Action category
 */
function createThrottle({ cooldownMs = 1500, category = "throttle" } = {}) {
  return (req, res, next) => {
    const identifier = getClientIdentifier(req);
    const key = `${identifier}:${category}`;
    const now = Date.now();
    const lastCalled = throttleMap.get(key) || 0;

    if (now - lastCalled < cooldownMs) {
      const waitMs = cooldownMs - (now - lastCalled);
      return res.status(429).json({
        error: "Action Throttled",
        message: `Please wait ${Math.ceil(waitMs / 1000)}s before repeating this action.`,
        retryAfter: Math.ceil(waitMs / 1000),
      });
    }

    throttleMap.set(key, now);
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
  createThrottle,
  campaignLaunchLimiter: createRateLimiter({ windowMs: 60000, maxRequests: 40, category: "campaign_launch" }),
  messageSendLimiter: createRateLimiter({ windowMs: 60000, maxRequests: 350, category: "message_send" }),
  qrRefreshLimiter: createRateLimiter({ windowMs: 15000, maxRequests: 6, category: "qr_refresh" }),
  loginLimiter: createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 35, category: "login" }),
  otpLimiter: createRateLimiter({ windowMs: 10 * 60 * 1000, maxRequests: 10, category: "email_otp" }),
  generalApiLimiter: createRateLimiter({ windowMs: 60000, maxRequests: 1000, category: "general_api" }),
  sessionResetThrottle: createThrottle({ cooldownMs: 4000, category: "session_reset" }),
  verifyMetaWebhookSignature,
};
