"use strict";
const { verifyToken } = require("./authMiddleware");
const { requireTenantContext } = require("./tenantMiddleware");

function sharedWorkspaceGuard(req, res, next) {
  if ((req.method === "GET" && req.path === "/v2/billing/plans") || (req.method === "POST" && req.path === "/v2/billing/webhook")) return next();
  if (req.path === "/wa/webhook" || req.path.startsWith("/client-portal") ||
      (req.path.startsWith("/auth/") && !req.path.startsWith("/auth/employees"))) return next();
  if (!/^\/(whatsapp|wa(?:\/|-)|v2\/|v1\/|crm\/|teammember|storage|auth\/employees)/.test(req.path)) return next();
  verifyToken(req, res, () => requireTenantContext(req, res, () => {
    if (["organization_owner", "organization_admin"].includes(req.userRole) || req.user.role === "platform_admin") return next();
    if (req.path.startsWith("/v2/inbox/") || req.path.startsWith("/v2/workspace/") || req.path === "/v2/me" || req.path === "/v2/organizations") return next();
    return res.status(403).json({ code: "ASSIGNED_INBOX_REQUIRED", message: "Use your assigned inbox. This workspace action requires an organization administrator." });
  }));
}
module.exports = sharedWorkspaceGuard;
