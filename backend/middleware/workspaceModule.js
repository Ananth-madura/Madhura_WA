"use strict";

const db = require("../config/database");

/**
 * Module catalog for the shared WhatsApp workspace.
 *
 * This is the single source of truth behind both the administrator's grant
 * screen (`/api/v2/workspace/permissions/:userId`) and the per-route gate
 * below. It is exported so `services/employeeWorkspace.js` can validate
 * grants against exactly the same list the routes enforce.
 */
const MODULES = [
  // Customer workspace (owned by the employee workspace service)
  "customers",
  "tasks",
  "leads",
  "deals",
  "activities",
  "transfers",
  "exports",
  // Shared operational dashboard
  "contacts",
  "enquiries",
  "templates",
  "groups",
  "campaigns",
  "automations",
  "flows",
  "analytics",
  "client_portal",
];

/**
 * Modules whose edit right is granted by default when no row exists.
 *
 * These are the modules employees already had before the workspace was opened
 * up, so keeping their default preserves behaviour. Every other module — and
 * every module added later — starts read-only until an administrator grants
 * edit through the permission screen.
 */
const DEFAULT_EDIT = new Set([
  "customers",
  "tasks",
  "leads",
  "deals",
  "activities",
  "transfers",
  "exports",
]);

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Workspace administrators bypass module grants.
 *
 * The organization membership resolved by `requireTenantContext` is the
 * authority. A JWT's `role` claim can be up to 14 days stale — checking it
 * would let a demoted administrator keep every grant until the token expired,
 * and would make a delegated sub-admin depend on two different role sources.
 * Platform super-admins are already mapped to `organization_owner`; the role
 * check stays as a belt-and-braces fallback for connector-style requests.
 */
function isAdmin(req) {
  return (
    ["organization_owner", "organization_admin"].includes(req.userRole) ||
    req.user?.role === "platform_admin"
  );
}

async function resolveGrant(req, module) {
  const [rows] = await db
    .promise()
    .query(
      "SELECT can_view,can_edit FROM wa_employee_workspace_permissions WHERE tenant_id=? AND user_id=? AND module=?",
      [req.tenantId, req.user.id, module]
    );
  const row = rows[0];
  if (!row) return { view: true, edit: DEFAULT_EDIT.has(module) };
  return { view: Boolean(row.can_view), edit: Boolean(row.can_view && row.can_edit) };
}

/**
 * Gate a router (or a single route) behind a workspace module grant.
 *
 * Default level is derived from the HTTP method: reads need `view`, every
 * write needs `edit`. Pass `{ level: "view" }` for read-only surfaces such as
 * analytics, which never write.
 */
function workspaceModule(module, options = {}) {
  if (!MODULES.includes(module)) throw new Error(`Unknown workspace module: ${module}`);
  return async function workspaceModuleGate(req, res, next) {
    try {
      if (!req.user?.id || !req.tenantId) {
        return res.status(403).json({
          code: "TENANT_REQUIRED",
          error: "Organization membership is required for this workspace module",
        });
      }
      if (isAdmin(req)) return next();

      const level = options.level || (READ_METHODS.has(req.method) ? "view" : "edit");
      const grant = await resolveGrant(req, module);
      if (level === "edit" ? grant.edit : grant.view) return next();

      return res.status(403).json({
        code: "MODULE_FORBIDDEN",
        module,
        error:
          level === "edit"
            ? "Your organization administrator has not granted edit access to this module"
            : "Your organization administrator has not granted access to this module",
      });
    } catch (_) {
      return res.status(503).json({ error: "Workspace permissions could not be verified" });
    }
  };
}

module.exports = { workspaceModule, isAdmin, MODULES, DEFAULT_EDIT };
