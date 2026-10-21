"use strict";

/**
 * waContactTenancy.js
 *
 * Which organization owns a `wa_contacts` / `wa_opt_outs` row that is about to
 * be written?
 *
 * Contact rows used to be inserted with no `tenant_id` at all, which meant
 * every row the webhook, flow engine, lead capture and automation service
 * created was invisible to a scoped read (`WHERE tenant_id = ?`) and only ever
 * surfaced through the `OR tenant_id IS NULL` fallbacks - i.e. through a query
 * that also handed the row to every other organization. Both halves are wrong,
 * so writers stamp the column instead and readers stop special-casing NULL.
 *
 * Resolution order:
 *   1. an explicit tenant id supplied by the caller (a route that already
 *      resolved `x-tenant-id` against membership),
 *   2. the request's verified tenant (`resolveTenantId`, never the raw JWT
 *      claim),
 *   3. the principal the write is attributed to. Session keys in this codebase
 *      are user ids - `whatsappService.defaultKey` is `users.id`, the webhook
 *      resolves `sessionKey` from `user_wa_configs.user_id` /
 *      `wa_accounts.created_by` - so one lookup answers every inbound path,
 *   4. the system organization.
 *
 * Step 4 exists because the env-configured sender belongs to tenant 1 (the same
 * rule `resolveSenderCredentials` enforces) and because an inbound message must
 * never be dropped for want of an owner: a missing row in the inbox is silent
 * data loss, while an unreadable row is caught by every scoped query. It logs,
 * so an unresolved principal shows up in the console instead of hiding.
 */

const db = require("../config/database");

const CACHE_TTL_MS = 60 * 1000;
const tenantByUser = new Map();

/** The organization that owns the process-wide/env sender. */
function systemTenantId() {
  const configured = Number(process.env.WA_SYSTEM_TENANT_ID);
  return Number.isFinite(configured) && configured > 0 ? configured : 1;
}

/**
 * Organization for a user id (or a session key, which is a user id), or null
 * when the principal does not resolve. Never throws: a failed lookup is a
 * signal to log, not a reason to fail an inbound webhook.
 */
async function tenantForUser(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  const cached = tenantByUser.get(uid);
  if (cached && cached.expires > Date.now()) return cached.tenant;

  try {
    const [rows] = await db.promise().query(
      "SELECT tenant_id FROM users WHERE id = ? LIMIT 1",
      [uid]
    );
    const tenant = rows && rows.length ? Number(rows[0].tenant_id) || null : null;
    if (tenant) tenantByUser.set(uid, { tenant, expires: Date.now() + CACHE_TTL_MS });
    return tenant;
  } catch (err) {
    console.warn(
      `[waContactTenancy] Could not resolve organization for user ${uid}: ${err.message}`
    );
    return null;
  }
}

/** Organization for a session key (`x-session-key`, `req.user.id`, defaultKey). */
async function tenantForSessionKey(sessionKey) {
  if (sessionKey === null || sessionKey === undefined) return null;
  return tenantForUser(sessionKey);
}

/**
 * Tenant a contact write belongs to. Always returns an organization so a
 * caller can stamp the column unconditionally - see the resolution order above
 * for why the last step does not fail closed.
 *
 * @param {object} [opts]
 * @param {object} [opts.req]         request, when one is in scope
 * @param {*}      [opts.sessionKey]  session key / user id the write is attributed to
 * @param {number} [opts.tenantId]    explicit tenant, when already resolved
 * @returns {Promise<number>}
 */
async function tenantForContactWrite(opts = {}) {
  const explicit = Number(opts.tenantId);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  if (opts.req) {
    // Resolved against membership by the middleware; null when the caller
    // carries no verified organization.
    try {
      const { resolveTenantId } = require("../middleware/tenantMiddleware");
      const fromRequest = Number(resolveTenantId(opts.req));
      if (Number.isFinite(fromRequest) && fromRequest > 0) return fromRequest;
    } catch (_) {
      /* middleware not loadable in this context - fall through to the principal */
    }
  }

  const principal = opts.sessionKey ?? opts.userId ?? opts.req?.user?.id;
  const resolved = await tenantForSessionKey(principal);
  if (resolved) return resolved;

  const fallback = systemTenantId();
  console.warn(
    `[waContactTenancy] Write had no resolvable organization (principal=${JSON.stringify(
      principal ?? null
    )}) - stamping the system organization ${fallback}. ` +
      `Set WA_SYSTEM_TENANT_ID if the env-configured sender belongs elsewhere.`
  );
  return fallback;
}

/** Test/ops hook: drop the per-user lookup cache. */
function resetTenancyCache() {
  tenantByUser.clear();
}

module.exports = {
  tenantForUser,
  tenantForSessionKey,
  tenantForContactWrite,
  systemTenantId,
  resetTenancyCache,
};
