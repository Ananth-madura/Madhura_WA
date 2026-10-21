/**
 * waConfigHelper.js
 *
 * Enterprise tenant-scoped WhatsApp Cloud API configuration resolver.
 * Bridges legacy user-based calls to canonical (tenantId, senderId, branchId) assets.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md
 */

const db = require("../config/database");
const wa = require("./whatsappCloudApi");
const metaPartner = require("./metaPartnerService");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

/**
 * Resolves Cloud API client for a specific tenant and sender/branch.
 *
 * Fail-closed: an unresolved tenancy is an error, never a silent downgrade to
 * the process-wide (tenant 1) sender. Borrowing another organization's sender
 * would let tenant N send as, and read the webhook secrets of, tenant 1.
 */
async function cloudClientForTenantSender(tenantId, senderId = null, branchId = null) {
  const tid = Number(tenantId);
  if (!tid || isNaN(tid)) {
    const err = new Error(
      "Cannot resolve WhatsApp sender: no organization context was provided"
    );
    err.code = "TENANT_REQUIRED";
    throw err;
  }

  const credentials = await metaPartner.resolveSenderCredentials(tid, senderId, branchId);
  if (!credentials || !credentials.phone_number_id) {
    const err = new Error(
      `No connected WhatsApp sender is registered for organization ${tid}`
    );
    err.code = "SENDER_NOT_FOUND";
    throw err;
  }

  return wa.withAccount({
    phone_number_id: credentials.phone_number_id,
    access_token: credentials.access_token,
    phone_number: credentials.display_phone,
    verified_name: credentials.verified_name,
    waba_id: credentials.waba_id || process.env.WA_WABA_ID || "",
    app_secret: credentials.app_secret || process.env.WA_APP_SECRET || "",
    verify_token: credentials.verify_token || process.env.WA_VERIFY_TOKEN || "crm_verify_123",
  });
}

/**
 * Legacy compatibility resolver for user_id.
 * Determines user's active tenant and assigned branch to select the appropriate sender.
 *
 * Fail-closed by design: database errors, unknown users and users with no
 * organization all reject. The old behaviour swallowed the error and returned
 * the system sender, which meant any DB outage silently routed one tenant's
 * traffic through another tenant's credentials.
 */
async function cloudClientForUser(userId) {
  const uid = Number(userId);
  if (!uid || isNaN(uid)) {
    const err = new Error(
      "Cannot resolve WhatsApp sender: caller has no authenticated user context"
    );
    err.code = "AUTH_REQUIRED";
    throw err;
  }

  // 1. Look up the user's active organization and primary branch.
  const memberships = await q(
    `SELECT om.tenant_id, sbm.branch_id 
     FROM organization_memberships om
     LEFT JOIN staff_branch_memberships sbm ON om.tenant_id = sbm.tenant_id AND om.user_id = sbm.user_id AND sbm.is_primary = 1
     WHERE om.user_id = ? AND om.membership_status = 'active'
     LIMIT 1`,
    [uid]
  );

  if (memberships && memberships.length > 0 && Number(memberships[0].tenant_id)) {
    const { tenant_id, branch_id } = memberships[0];
    return cloudClientForTenantSender(tenant_id, null, branch_id || null);
  }

  // 2. No active membership: fall back to the user row's own organization.
  //    A NULL tenant_id means the account predates organizations and has not
  //    been backfilled yet - that is an error, not an invitation to use tenant 1.
  const users = await q("SELECT tenant_id FROM users WHERE id = ? LIMIT 1", [uid]);
  const tenantId = users && users.length > 0 ? Number(users[0].tenant_id) : NaN;
  if (!tenantId || isNaN(tenantId)) {
    const err = new Error(
      `User ${uid} has no organization membership; run the tenant backfill migration before sending`
    );
    err.code = "TENANT_REQUIRED";
    throw err;
  }
  return cloudClientForTenantSender(tenantId);
}

/**
 * Boolean probe: does this user's organization have a usable Cloud sender?
 *
 * Deliberately does NOT throw - legacy call sites treat `false` as "no Cloud
 * credentials, fall back to the paired Web session or report not connected".
 * Crucially it also never falls back to another tenant's credentials, so a
 * resolution failure reports "not configured" rather than borrowing the
 * process-wide sender.
 */
async function configureForUser(userId) {
  try {
    return (await cloudClientForUser(userId)).isConfigured();
  } catch (err) {
    if (err?.code === "AUTH_REQUIRED" || err?.code === "SENDER_NOT_FOUND" || err?.code === "TENANT_REQUIRED") {
      return false;
    }
    // Infrastructure failures stay visible but still must not open a backdoor.
    console.warn("[configureForUser] sender resolution failed:", err?.message);
    return false;
  }
}

/**
 * Resolve the organization a user belongs to, or throw. Used by call sites
 * that must decide "which tenant am I operating as" before any write.
 */
async function resolveTenantForUser(userId) {
  const uid = Number(userId);
  if (!uid || isNaN(uid)) {
    const err = new Error("Caller has no authenticated user context");
    err.code = "AUTH_REQUIRED";
    throw err;
  }
  const memberships = await q(
    `SELECT tenant_id FROM organization_memberships
     WHERE user_id = ? AND membership_status = 'active' LIMIT 1`,
    [uid]
  );
  if (memberships && memberships.length && Number(memberships[0].tenant_id)) {
    return Number(memberships[0].tenant_id);
  }
  const users = await q("SELECT tenant_id FROM users WHERE id = ? LIMIT 1", [uid]);
  const tenantId = users && users.length ? Number(users[0].tenant_id) : NaN;
  if (!tenantId || isNaN(tenantId)) {
    const err = new Error(`User ${uid} has no organization; run the tenant backfill migration`);
    err.code = "TENANT_REQUIRED";
    throw err;
  }
  return tenantId;
}

function hasSystemEnvConfig() {
  return Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN);
}

/**
 * Compatibility shim: return tenant sender configuration.
 * Throws (fail-closed) when the organization cannot be resolved.
 */
/**
 * Non-throwing sibling of {@link cloudClientForUser} for send/status paths.
 *
 * A WhatsApp Web session can exist for a key that maps to no organization
 * (legacy keys, seed rows, sessions created before the backfill). Those
 * sessions must keep delivering over the paired Web session, so resolution
 * failure degrades to "no Cloud sender" instead of aborting the send.
 *
 * It degrades to an *unconfigured* client - never to the process-wide sender,
 * which would route one organization's traffic through another's identity.
 * API routes that must not pretend should use cloudClientForUser directly.
 */
async function safeCloudClientForUser(userId) {
  try {
    return await cloudClientForUser(userId);
  } catch (err) {
    console.warn(
      `[waConfigHelper] No Cloud sender for session ${userId} (${err?.code || "ERROR"}): ${err?.message}`
    );
    return wa.withAccount({});
  }
}

async function loadUserConfig(userId) {
  const client = await cloudClientForUser(userId);
  return {
    phone_number_id: client.phoneNumberId,
    access_token: client.accessToken,
    display_phone_number: client.phoneNumber,
    is_enabled: client.isConfigured(),
  };
}

function resetToEnvConfig() {
  wa.phoneNumberId = process.env.WA_PHONE_NUMBER_ID || "";
  wa.accessToken = process.env.WA_ACCESS_TOKEN || "";
  wa.wabaId = process.env.WA_WABA_ID || "";
  wa.appSecret = process.env.WA_APP_SECRET || "";
  wa.verifyToken = process.env.WA_VERIFY_TOKEN || "crm_verify_123";
  wa.businessAccountId = process.env.WA_BUSINESS_ACCOUNT_ID || "";
  wa.displayPhoneNumber = process.env.WA_DISPLAY_PHONE_NUMBER || "";
  wa.verifiedName = process.env.WA_VERIFIED_NAME || "";
}

module.exports = {
  cloudClientForTenantSender,
  cloudClientForUser,
  safeCloudClientForUser,
  loadUserConfig,
  configureForUser,
  resolveTenantForUser,
  resetToEnvConfig,
  hasSystemEnvConfig,
};
