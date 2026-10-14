/**
 * tenantMiddleware.js
 *
 * Enterprise fail-closed multi-tenant & multi-branch isolation middleware.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md
 */

const db = require("../config/database");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

/**
 * Enforces strict fail-closed tenant context.
 * Resolves tenant from request header, JWT payload, or query parameter.
 * Verifies that the authenticated user holds an active membership in that tenant.
 */
async function requireTenantContext(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "Authentication is required to access organization resources",
    });
  }

  // Support super-admin API connector bypass if explicitly marked
  if (req.user.isApiKey && req.headers["x-tenant-id"]) {
    req.tenantId = Number(req.headers["x-tenant-id"]);
    return next();
  }

  // Header wins, then body/query, then JWT tenant_id
  const requestedTenantId =
    req.headers["x-tenant-id"] ||
    req.body?.tenant_id ||
    req.query?.tenant_id ||
    req.user.tenant_id;

  if (!requestedTenantId) {
    return res.status(403).json({
      success: false,
      code: "TENANT_REQUIRED",
      message: "No organization context specified. Please select an organization.",
    });
  }

  const tid = Number(requestedTenantId);
  if (!tid || isNaN(tid)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_TENANT_ID",
      message: "Invalid organization identifier provided",
    });
  }

  try {
    // 1. Verify tenant exists and is active
    const tenants = await q(
      "SELECT id, name, slug, plan, plan_status, max_branches, max_seats, max_senders, max_monthly_messages, status FROM tenants WHERE id = ? LIMIT 1",
      [tid]
    );

    if (!tenants || tenants.length === 0) {
      return res.status(404).json({
        success: false,
        code: "ORGANIZATION_NOT_FOUND",
        message: "The requested organization does not exist or has been archived",
      });
    }

    const tenant = tenants[0];
    if (tenant.status === "suspended") {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_SUSPENDED",
        message: "This organization workspace has been suspended. Please contact support.",
      });
    }

    // 2. Platform super admins can access any organization
    if (req.user.role === "platform_admin") {
      req.tenantId = tid;
      req.tenant = tenant;
      req.userRole = "organization_owner";
      return next();
    }

    // 3. Verify user membership in this organization
    const memberships = await q(
      "SELECT role, membership_status FROM organization_memberships WHERE tenant_id = ? AND user_id = ? LIMIT 1",
      [tid, req.user.id]
    );

    let effectiveRole = "agent";
    if (memberships && memberships.length > 0) {
      const m = memberships[0];
      if (m.membership_status !== "active") {
        return res.status(403).json({
          success: false,
          code: "MEMBERSHIP_INACTIVE",
          message: `Your membership in ${tenant.name} is ${m.membership_status}.`,
        });
      }
      effectiveRole = m.role || "agent";
    } else {
      // Check legacy admin on tenant 1 compatibility
      if (tid === 1 && (req.user.role === "admin" || req.user.tenant_id === 1)) {
        effectiveRole = "organization_owner";
      } else {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN_TENANT_ACCESS",
          message: "You are not an authorized member of this organization",
        });
      }
    }

    // 4. Attach scoped context to request
    req.tenantId = tid;
    req.tenant = tenant;
    req.userRole = effectiveRole;
    next();
  } catch (err) {
    console.error("[requireTenantContext] Error verifying tenant:", err);
    return res.status(500).json({
      success: false,
      code: "TENANT_VERIFICATION_ERROR",
      message: "Internal error verifying organization membership",
    });
  }
}

/**
 * Enforces branch boundary scope.
 * Determines active branch and checks if user is allowed to access it.
 */
async function requireBranchScope(req, res, next) {
  if (!req.tenantId) {
    return res.status(403).json({
      success: false,
      code: "TENANT_REQUIRED",
      message: "Tenant context must be established before checking branch scope",
    });
  }

  const requestedBranchId =
    req.headers["x-branch-id"] ||
    req.query?.branch_id ||
    req.body?.branch_id ||
    null;

  try {
    // 1. Fetch user's permitted branches for this tenant
    const isFullOrgAdmin =
      req.userRole === "organization_owner" ||
      req.userRole === "organization_admin" ||
      req.user.role === "platform_admin";

    const allBranches = await q(
      "SELECT id, code, name, is_head_office, status FROM branches WHERE tenant_id = ? AND status = 'active' ORDER BY is_head_office DESC, id ASC",
      [req.tenantId]
    );

    if (isFullOrgAdmin) {
      req.permittedBranchIds = allBranches.map((b) => b.id);
    } else {
      const userBranchRows = await q(
        "SELECT branch_id FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = ?",
        [req.tenantId, req.user.id]
      );
      req.permittedBranchIds = userBranchRows.map((r) => r.branch_id);
      // Fallback: If no explicit branch assigned, allow head office branch if active
      if (req.permittedBranchIds.length === 0 && allBranches.length > 0) {
        req.permittedBranchIds = [allBranches[0].id];
      }
    }

    // 2. Resolve active branch ID
    let activeBranchId = null;
    if (requestedBranchId) {
      const bid = Number(requestedBranchId);
      if (bid === 0 || requestedBranchId === "all") {
        // "all" requested
        if (!isFullOrgAdmin) {
          // Non-admin can only see their permitted branches
          req.branchId = null; // Filter query by IN (permittedBranchIds)
          return next();
        }
        req.branchId = null;
        return next();
      }

      if (!req.permittedBranchIds.includes(bid) && !isFullOrgAdmin) {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN_BRANCH_ACCESS",
          message: "You are not authorized to view or manage records in this branch",
        });
      }
      activeBranchId = bid;
    } else {
      // Default to first permitted branch or Head Office
      activeBranchId = req.permittedBranchIds[0] || (allBranches[0] && allBranches[0].id) || null;
    }

    req.branchId = activeBranchId;
    next();
  } catch (err) {
    console.error("[requireBranchScope] Error:", err);
    return res.status(500).json({
      success: false,
      code: "BRANCH_VERIFICATION_ERROR",
      message: "Internal error verifying branch scope",
    });
  }
}

/**
 * Checks fine-grained RBAC permissions.
 */
function requirePermission(permissionCode) {
  return async (req, res, next) => {
    if (!req.tenantId || !req.userRole) {
      return res.status(403).json({
        success: false,
        code: "ACCESS_DENIED",
        message: "Organization membership required",
      });
    }

    // Organization owner has full access
    if (req.userRole === "organization_owner" || req.user.role === "platform_admin") {
      return next();
    }

    try {
      // Look up role in roles table
      const roles = await q(
        "SELECT id FROM roles WHERE code = ? AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1",
        [req.userRole, req.tenantId]
      );

      if (!roles || roles.length === 0) {
        return res.status(403).json({
          success: false,
          code: "ROLE_NOT_FOUND",
          message: `Role ${req.userRole} is not defined`,
        });
      }

      const roleId = roles[0].id;
      const grants = await q(
        "SELECT id FROM role_permissions WHERE role_id = ? AND permission_code = ? LIMIT 1",
        [roleId, permissionCode]
      );

      if (grants && grants.length > 0) {
        return next();
      }

      return res.status(403).json({
        success: false,
        code: "PERMISSION_DENIED",
        message: `Missing required permission: ${permissionCode}`,
      });
    } catch (err) {
      console.error("[requirePermission] Error checking permission:", err);
      return res.status(500).json({
        success: false,
        code: "RBAC_CHECK_ERROR",
        message: "Error verifying access permissions",
      });
    }
  };
}

module.exports = {
  requireTenantContext,
  requireBranchScope,
  requirePermission,
};
