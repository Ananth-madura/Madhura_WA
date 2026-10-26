"use strict";

const { verifyToken } = require("./authMiddleware");
const { requireTenantContext } = require("./tenantMiddleware");
const rolePolicy = require("../services/rolePolicy");

/**
 * Shared workspace authorization.
 *
 * One dashboard, one rule set:
 *
 *   • Anyone who is an organization administrator (or a platform/admin/
 *     subadmin account) may use every workspace area.
 *   • Any other active member may use the operational workspaces — inbox,
 *     contacts, enquiries, templates, groups, campaigns, automations, flows,
 *     analytics and the client portal — subject to the per-module grants
 *     enforced by `middleware/workspaceModule.js`.
 *   • A short list of administration surfaces stays administrator-only:
 *     employees, WhatsApp accounts, branches, billing, Meta/API configuration
 *     and WhatsApp session control.
 */
const ADMIN_ONLY = [
  "/auth/employees",
  "/teammember",
  // Account setup planes
  "/wa/config",
  "/wa/ai",
  "/v1",
  "/crm",
  "/v2/branches",
  "/v2/billing",
  "/v2/meta",
  // Administration-only workspace endpoints
  "/v2/workspace/audit",
  "/v2/workspace/permissions",
  "/v2/workspace/reassign-inactive",
];

function isAdmin(req) {
  // Membership is authoritative; see middleware/workspaceModule.js. A stale
  // JWT role must not keep administrator access after a demotion.
  return (
    ["organization_owner", "organization_admin"].includes(req.userRole) ||
    req.user?.role === "platform_admin"
  );
}

/**
 * `/whatsapp/*` is the WhatsApp session engine: QR pairing, the account-wide
 * chat list, direct sends and session teardown. Members get their conversations
 * through the assigned shared inbox (`/v2/inbox/*`) instead, so the engine is
 * closed to them — otherwise a member could read every organization
 * conversation and send as the business, bypassing assignment entirely.
 *
 * The contacts workspace legitimately needs these two sync actions, so they are
 * the only openings; everything else under the prefix fails closed.
 */
const MEMBER_ENGINE_PATHS = [
  "/whatsapp/sync-contacts",
  "/whatsapp/sync-profile-pics",
];

function isMemberAllowedEnginePath(path) {
  return MEMBER_ENGINE_PATHS.some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function isAdminOnly(path) {
  return ADMIN_ONLY.some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function deny(res, message) {
  return res.status(403).json({ code: "ADMIN_ONLY", message });
}

function sharedWorkspaceGuard(req, res, next) {
  // Public and separately-authenticated endpoints stay untouched.
  if ((req.method === "GET" && req.path === "/v2/billing/plans") || (req.method === "POST" && req.path === "/v2/billing/webhook")) return next();
  if (req.path === "/wa/webhook" || req.path.startsWith("/client-portal") ||
      (req.path.startsWith("/auth/") && !req.path.startsWith("/auth/employees"))) return next();
  if (!/^\/(whatsapp|wa(?:\/|-)|v2\/|v1\/|crm\/|teammember|storage|auth\/employees)/.test(req.path)) return next();

  verifyToken(req, res, () => requireTenantContext(req, res, () => {
    // Resolve the effective role for every workspace request, not only for
    // administrators. Routes behind this guard read `req.user.role` directly
    // (the enquiry delete middleware and reminder settings, for example), so a
    // stale administrator claim must be replaced before any handler sees it.
    // The membership is the authority; `platform_admin` is never downgraded.
    if (req.user.role !== "platform_admin") {
      const role = rolePolicy.effectiveRole({
        globalRole: req.user.role,
        userRole: req.user.role,
        membershipRole: req.userRole,
      });
      req.user = { ...req.user, role };
      req.actorRole = role;
    }

    if (isAdmin(req)) return next();
    if (isAdminOnly(req.path)) {
      return deny(res, "This workspace area requires an organization administrator.");
    }
    if (
      (req.path === "/whatsapp" || req.path.startsWith("/whatsapp/")) &&
      !isMemberAllowedEnginePath(req.path)
    ) {
      return deny(
        res,
        "Live chat and WhatsApp session controls require an organization administrator. Use your assigned inbox for conversations."
      );
    }
    return next();
  }));
}

module.exports = sharedWorkspaceGuard;
module.exports.isAdmin = isAdmin;
module.exports.isAdminOnly = isAdminOnly;
module.exports.isMemberAllowedEnginePath = isMemberAllowedEnginePath;
module.exports.ADMIN_ONLY = ADMIN_ONLY;
module.exports.MEMBER_ENGINE_PATHS = MEMBER_ENGINE_PATHS;

