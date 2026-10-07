/**
 * CORS origin policy — single source of truth.
 *
 * Extracted from server.js so it can be unit-tested without booting the app.
 * That matters: server.js also starts the WhatsApp session engine, so the only
 * other way to test this policy was to restart a live server holding a paired
 * WhatsApp number. A policy that can only be verified by restarting production
 * is a policy nobody re-verifies after a change.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * A request is allowed when:
 *
 *   1. It carries NO Origin header. That is curl, a PM2 healthcheck, a
 *      server-to-server X-API-Key call from the Madhura CRM, or Meta's webhook.
 *      Browsers ALWAYS send Origin, so this cannot be used by a web page to
 *      bypass the allowlist.
 *
 *   2. Its Origin matches ALLOWED_ORIGINS exactly (trailing slash ignored).
 *
 *   3. It is localhost/127.0.0.1 AND NODE_ENV is not "production". Dev only.
 *
 *   4. NODE_ENV is not production AND ALLOWED_ORIGINS is empty. Dev convenience:
 *      reflect any origin, so `npm start` works without configuration.
 *
 * Everything else is refused.
 *
 * ── Why fail closed in production ───────────────────────────────────────────
 * The previous policy was `callback(null, true)` for every origin, combined with
 * `credentials: true`. That combination means any web page a logged-in user
 * visits can issue authenticated cross-origin requests with their cookies
 * attached. On a laptop on the LAN, meh. On a public hostname it is a token
 * exfiltration primitive, and it is silent: the server logs look healthy and
 * only the browser console shows the problem.
 *
 * Refusal is expressed as `callback(null, false)` rather than an Error, so the
 * response is simply sent without CORS headers and the browser blocks it.
 * Throwing would surface as an opaque 500 and would break legitimate non-browser
 * clients that happen to send an Origin header.
 *
 * ── ALLOWED_ORIGIN vs ALLOWED_ORIGINS ──────────────────────────────────────
 * The canonical name is the PLURAL `ALLOWED_ORIGINS`. Older .env files carried
 * the singular `ALLOWED_ORIGIN`, which this module ignored entirely — so a
 * production host that had the singular set looked configured while the
 * allowlist was actually empty and every browser request was blocked. The
 * singular is still accepted below as a fallback so an existing deployment is
 * not left silently broken, but config/envCheck.js reports which one it used.
 */

/** @returns {(origin: string|undefined, cb: (err: any, allow?: boolean) => void) => void} */
function createCorsOrigin(env = process.env) {
  const plural = String(env.ALLOWED_ORIGINS || "").trim();
  const singular = String(env.ALLOWED_ORIGIN || "").trim();

  // Plural wins when both are present, so fixing the name takes effect even if
  // the stale singular is still lying around in the environment.
  const raw = plural || singular;
  const sourceVar = plural ? "ALLOWED_ORIGINS" : singular ? "ALLOWED_ORIGIN" : null;

  const allowedOrigins = raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  const isProd = env.NODE_ENV === "production";
  const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  const corsOrigin = (origin, callback) => {
    if (!origin) return callback(null, true); // rule 1: non-browser / curl / server-to-server
    const clean = String(origin).replace(/\/+$/, "");
    if (allowedOrigins.includes(clean)) return callback(null, true); // rule 2: exact match

    // Wildcard pattern match (e.g. *.vercel.app or *-madhura.vercel.app)
    for (const pattern of allowedOrigins) {
      if (pattern.includes("*")) {
        const escaped = pattern
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, "[a-zA-Z0-9_-]+");
        const regex = new RegExp(`^${escaped}$`, "i");
        if (regex.test(clean)) return callback(null, true);
      }
    }

    if (!isProd && DEV_ORIGIN.test(clean)) return callback(null, true); // rule 3: localhost in dev
    if (!isProd && allowedOrigins.length === 0) return callback(null, true); // rule 4: dev fallback
    return callback(null, false);
  };

  // Exposed for logging and for the test suite.
  corsOrigin.allowedOrigins = allowedOrigins;
  corsOrigin.isProd = isProd;
  corsOrigin.sourceVar = sourceVar;
  corsOrigin.usedLegacyName = Boolean(singular && !plural);
  return corsOrigin;
}

/** Human-readable summary for the boot log and for support tickets. */
function describePolicy(env = process.env) {
  const o = createCorsOrigin(env);
  const name = o.sourceVar || "ALLOWED_ORIGINS";
  if (o.isProd && o.allowedOrigins.length === 0) {
    return `production, ${name} EMPTY - all cross-origin browser requests blocked`;
  }
  if (o.allowedOrigins.length) {
    const via = o.usedLegacyName ? " (via legacy singular ALLOWED_ORIGIN - rename it)" : "";
    return `${name}: ${o.allowedOrigins.join(", ")}${o.isProd ? "" : " (+localhost in dev)"}${via}`;
  }
  return "dev mode, reflecting any origin";
}

module.exports = { createCorsOrigin, describePolicy };
