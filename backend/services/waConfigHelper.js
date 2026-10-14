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
 */
async function cloudClientForTenantSender(tenantId, senderId = null, branchId = null) {
  const credentials = await metaPartner.resolveSenderCredentials(tenantId, senderId, branchId);
  return wa.withAccount({
    phone_number_id: credentials.phone_number_id,
    access_token: credentials.access_token,
    phone_number: credentials.display_phone,
    verified_name: credentials.verified_name,
    waba_id: process.env.WA_WABA_ID || "",
    app_secret: process.env.WA_APP_SECRET || "",
    verify_token: process.env.WA_VERIFY_TOKEN || "crm_verify_123",
  });
}

/**
 * Legacy compatibility resolver for user_id.
 * Determines user's active tenant and assigned branch to select the appropriate sender.
 */
async function cloudClientForUser(userId) {
  if (!userId) {
    return cloudClientForTenantSender(1);
  }

  try {
    // 1. Look up user's primary organization & branch
    const memberships = await q(
      `SELECT om.tenant_id, sbm.branch_id 
       FROM organization_memberships om
       LEFT JOIN staff_branch_memberships sbm ON om.tenant_id = sbm.tenant_id AND om.user_id = sbm.user_id AND sbm.is_primary = 1
       WHERE om.user_id = ? AND om.membership_status = 'active'
       LIMIT 1`,
      [Number(userId)]
    );

    if (memberships && memberships.length > 0) {
      const { tenant_id, branch_id } = memberships[0];
      return cloudClientForTenantSender(tenant_id, null, branch_id);
    }

    // 2. Fallback to user row tenant_id
    const users = await q("SELECT tenant_id FROM users WHERE id = ? LIMIT 1", [Number(userId)]);
    const tenantId = users && users.length > 0 ? users[0].tenant_id || 1 : 1;
    return cloudClientForTenantSender(tenantId);
  } catch (err) {
    console.warn("[cloudClientForUser] Error resolving user tenancy, using fallback:", err.message);
    return cloudClientForTenantSender(1);
  }
}

async function loadUserConfig(userId) {
  // Compatibility shim: return tenant sender configuration
  const client = await cloudClientForUser(userId);
  return {
    phone_number_id: client.phoneNumberId,
    access_token: client.accessToken,
    display_phone_number: client.phoneNumber,
    is_enabled: client.isConfigured(),
  };
}

function hasSystemEnvConfig() {
  return Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN);
}

async function configureForUser(userId) {
  return (await cloudClientForUser(userId)).isConfigured();
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
  loadUserConfig,
  configureForUser,
  resetToEnvConfig,
  hasSystemEnvConfig,
};
