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
 *     enforced by `middleware/workspaceModule.js`. Members also get the Live
 *     Chats page, scoped to the conversations assigned to them.
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
 * chat list, direct sends and session teardown.
 *
 * Members now get the full Live Chats page, so the conversation plane is open
 * to them while the session plane stays administrator-only. Ownership is not
 * decided here — `routes/whatsappRoutes.js` and `services/memberChat.js` refuse
 * any chat that is not assigned to the caller. This list only answers "may a
 * member reach this route at all", and it fails closed for everything else:
 *
 *   • session control — QR, pairing, logout, reconnect, reset, diagnostics,
 *     account list/switching, chat sync — stays administrator-only.
 *   • Account-wide analytics (`account-balance`, `unread-count`) and the test
 *     send tool stay administrator-only.
 *   • Assignment/transfer (`assign-agent`, `chat/:id/assign`, ticket status)
 *     stays administrator-only.
 */
const MEMBER_CHAT_READ_EXACT = new Set([
  "/whatsapp/status",
  "/whatsapp/unified-status",
  "/whatsapp/account",
  "/whatsapp/chats",
  "/whatsapp/contact-balance",
  "/whatsapp/quick-replies",
]);

const MEMBER_CHAT_WRITE_EXACT = new Set([
  "/whatsapp/send",
  "/whatsapp/send-media",
  "/whatsapp/send-media-upload",
  "/whatsapp/send-location",
  "/whatsapp/send-interactive",
  "/whatsapp/upload-media",
  "/whatsapp/seen",
  "/whatsapp/react",
  "/whatsapp/add-to-crm-client",
  "/whatsapp/sync-contacts",
  "/whatsapp/sync-profile-pics",
]);

/** Chat sub-resources a member may read (GET). */
const MEMBER_CHAT_READ_ACTIONS = new Set(["messages", "media", "profile-pic", "bot-status", "notes"]);
/** Chat sub-resources a member may act on (POST). */
const MEMBER_CHAT_WRITE_ACTIONS = new Set(["read", "seen", "typing", "react", "delete-message", "notes", "profile-pic"]);

const CHAT_PATH = /^\/whatsapp\/chat\/[^/]+\/(?:(media)\/[^/]+|([^/]+))$/;

function isReadMethod(method) {
  return ["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase());
}

function isMemberAllowedEnginePath(path, method = "GET") {
  const read = isReadMethod(method);
  if (MEMBER_CHAT_READ_EXACT.has(path)) return read;
  if (MEMBER_CHAT_WRITE_EXACT.has(path)) return !read;

  // Contact-scoped read models used by the chat sidebar.
  if (path.startsWith("/whatsapp/contact-crm-details/")) return read;
  if (/^\/whatsapp\/contact\/[^/]+\/profile-pic$/.test(path)) {
    return read || String(method).toUpperCase() === "POST";
  }

  const chat = CHAT_PATH.exec(path);
  if (!chat) return false;
  // `media/<messageId>` means "download this attachment" (read only).
  const action = chat[1] ? "media" : chat[2];
  if (read) return MEMBER_CHAT_READ_ACTIONS.has(action);
  return MEMBER_CHAT_WRITE_ACTIONS.has(action);
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
      !isMemberAllowedEnginePath(req.path, req.method)
    ) {
      return deny(
        res,
        "WhatsApp session controls require an organization administrator. Members can read and reply to their assigned conversations."
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
module.exports.MEMBER_CHAT_READ_EXACT = MEMBER_CHAT_READ_EXACT;
module.exports.MEMBER_CHAT_WRITE_EXACT = MEMBER_CHAT_WRITE_EXACT;

