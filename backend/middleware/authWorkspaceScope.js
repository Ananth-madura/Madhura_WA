"use strict";
const { verifyToken } = require("./authMiddleware");
const { requireTenantContext } = require("./tenantMiddleware");
const db = require("../config/database");
const rolePolicy = require("../services/rolePolicy");
const PUBLIC = new Set(["/login", "/admin-login", "/demo-login", "/register", "/request-access", "/self-signup", "/plans", "/send-email-otp", "/verify-access-code", "/join-with-access-code", "/verify-2fa", "/resend-2fa"]);
const SELF = new Set(["/tenant-info", "/my-employee-profile", "/profile", "/my-change-requests", "/request-profile-change", "/change-password-direct", "/toggle-2fa", "/logout"]);

/**
 * Administrator plane for the account-management routes.
 *
 * Membership in the organization is the gate (a JWT role claim can be up to
 * 14 days stale), but the *kind* of administrator is read from `users.role` on
 * every request. That distinction is what stops a delegated sub-admin from
 * acting as a full administrator, and it stays correct immediately after a
 * promotion or demotion instead of after the next login.
 */
module.exports = (req, res, next) => {
  if (PUBLIC.has(req.path)) return next();
  verifyToken(req, res, () => requireTenantContext(req, res, async () => {
    req.user = { ...req.user, tenant_id: req.tenantId };
    if (SELF.has(req.path)) return next();
    if (!["organization_owner", "organization_admin"].includes(req.userRole) && req.user.role !== "platform_admin") {
      return res.status(403).json({ message: "Organization administrator required" });
    }
    try {
      const [[actor]] = await db.promise().query("SELECT role FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
      if (!actor) return res.status(403).json({ message: "Organization administrator required" });
      const actorRole = rolePolicy.effectiveRole({
        globalRole: req.user.role,
        userRole: actor.role,
        membershipRole: req.userRole,
      });
      req.user = { ...req.user, tenant_id: req.tenantId, role: actorRole, actorRole };

      const target = req.path.match(/^\/(?:update-user|change-role|ban-user|delete-user|reset-password|approve)\/(\d+)$/);
      if (target) {
        const [rows] = await db.promise().query("SELECT id FROM users WHERE id = ? AND tenant_id = ?", [Number(target[1]), req.tenantId]);
        if (!rows.length) return res.status(404).json({ message: "User not found in this organization" });
      }
      next();
    } catch (_) {
      res.status(503).json({ message: "Account scope could not be verified" });
    }
  }));
};
