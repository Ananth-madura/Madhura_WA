/**
 * enterpriseOrganizationRoutes.js
 *
 * REST API v2 endpoints for Organizations, Branches, and Staff RBAC.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md
 */

const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  requireTenantContext,
  requireBranchScope,
  requirePermission,
} = require("../middleware/tenantMiddleware");
const orgService = require("../services/organizationService");
const db = require("../config/database");

const router = express.Router();

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

/**
 * GET /api/v2/me
 * Comprehensive context: user identity, active tenant, active branch, memberships, and permissions.
 */
router.get("/me", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const userId = req.user.id;
    const [user] = await q(
      "SELECT id, first_name, last_name, email, role, status, emp_id FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const organizations = await orgService.getUserOrganizations(userId);

    // Determine active tenant (from header, param, or first available org)
    const activeTenantId = Number(req.tenantId);
    const activeOrg = organizations.find((o) => Number(o.id) === activeTenantId);
    if (!activeOrg) return res.status(403).json({ success: false, message: "Active organization membership required" });

    let branches = [];
    let permittedBranchIds = [];
    let activeBranch = null;

    if (activeTenantId) {
      branches = await orgService.getBranches(activeTenantId);
      const isOwnerOrAdmin =
        activeOrg?.role === "organization_owner" ||
        activeOrg?.role === "organization_admin" ||
        user.role === "platform_admin";

      if (isOwnerOrAdmin) {
        permittedBranchIds = branches.map((b) => b.id);
      } else {
        const staffBranches = await q(
          "SELECT branch_id FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = ?",
          [activeTenantId, userId]
        );
        permittedBranchIds = staffBranches.map((sb) => sb.branch_id);
        branches = branches.filter(branch => permittedBranchIds.includes(Number(branch.id)));
        permittedBranchIds = branches.map(branch => Number(branch.id));
      }

      const reqBranchId = Number(req.headers["x-branch-id"]);
      if (reqBranchId && permittedBranchIds.includes(reqBranchId)) {
        activeBranch = branches.find((b) => b.id === reqBranchId);
      } else {
        activeBranch = branches.find((b) => permittedBranchIds.includes(Number(b.id))) || null;
      }
    }

    res.json({
      success: true,
      user,
      activeTenantId,
      activeOrganization: activeOrg || null,
      organizations,
      activeBranchId: activeBranch ? activeBranch.id : null,
      activeBranch,
      branches,
      permittedBranchIds,
      roleInActiveOrg: activeOrg?.role || "agent",
    });
  } catch (err) {
    console.error("[GET /api/v2/me] Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v2/organizations
 * Returns all organizations the authenticated user belongs to.
 */
router.get("/organizations", verifyToken, async (req, res) => {
  try {
    const orgs = await orgService.getUserOrganizations(req.user.id);
    res.json({ success: true, organizations: orgs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v2/organizations
 * Creates a new organization workspace.
 */
router.post("/organizations", verifyToken, async (req, res) => {
  try {
    const { name, legal_name, brand_name, plan } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Organization name is required" });
    }

    const org = await orgService.createOrganization({
      name,
      legal_name,
      brand_name,
      ownerUserId: req.user.id,
      plan: plan || "starter",
    });

    res.status(201).json({ success: true, organization: org });
  } catch (err) {
    console.error("[POST /api/v2/organizations] Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v2/branches
 * Lists all branches of the active tenant.
 */
router.get("/branches", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branches = await orgService.getBranches(req.tenantId);
    res.json({
      success: true,
      tenantId: req.tenantId,
      branches,
      activeBranchId: req.branchId || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v2/branches
 * Creates a new branch (enforces quota).
 */
router.post(
  "/branches",
  verifyToken,
  requireTenantContext,
  requirePermission("branch.create"),
  async (req, res) => {
    try {
      const { name, code, timezone, manager_id, phone, email, address, operating_hours } = req.body;
      const branch = await orgService.createBranch(req.tenantId, {
        name,
        code,
        timezone,
        manager_id,
        phone,
        email,
        address,
        operating_hours,
      });

      res.status(201).json({ success: true, branch });
    } catch (err) {
      const status = err.code === "QUOTA_EXCEEDED" ? 403 : err.code === "DUPLICATE_BRANCH_CODE" ? 409 : 400;
      res.status(status).json({ success: false, code: err.code, message: err.message });
    }
  }
);

/**
 * PATCH /api/v2/branches/:id
 * Updates an existing branch.
 */
router.patch(
  "/branches/:id",
  verifyToken,
  requireTenantContext,
  requirePermission("branch.manage"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.id);
      const updated = await orgService.updateBranch(req.tenantId, branchId, req.body);
      res.json({ success: true, branch: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/v2/branches/:id
 * Archives a branch.
 */
router.delete(
  "/branches/:id",
  verifyToken,
  requireTenantContext,
  requirePermission("branch.manage"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.id);
      await orgService.archiveBranch(req.tenantId, branchId);
      res.json({ success: true, message: "Branch archived successfully" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/v2/organizations/:orgId/members
 * Lists members of an organization with branch allocations.
 */
router.get(
  "/organizations/:orgId/members",
  verifyToken,
  requireTenantContext,
  async (req, res) => {
    try {
      const members = await orgService.getOrganizationMembers(req.tenantId);
      res.json({ success: true, members });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/organizations/:orgId/invitations
 * Invites a new staff member to the organization with role & branch.
 */
router.post(
  "/organizations/:orgId/invitations",
  verifyToken,
  requireTenantContext,
  requirePermission("staff.invite"),
  async (req, res) => {
    try {
      const { email, role, branchId, teamId } = req.body;
      const invite = await orgService.inviteStaffMember(req.tenantId, req.user.id, {
        email,
        role,
        branchId,
        teamId,
      });

      res.status(201).json({ success: true, invitation: invite });
    } catch (err) {
      const status = err.code === "QUOTA_EXCEEDED" ? 403 : 400;
      res.status(status).json({ success: false, code: err.code, message: err.message });
    }
  }
);

/**
 * POST /api/v2/branches/:branchId/assign-staff
 * Assigns a staff member to a branch.
 */
router.post(
  "/branches/:branchId/assign-staff",
  verifyToken,
  requireTenantContext,
  requirePermission("staff.role.assign"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const { userId, teamId, isPrimary } = req.body;
      await orgService.assignStaffBranch(req.tenantId, userId, branchId, teamId, isPrimary);
      res.json({ success: true, message: "Staff member assigned to branch successfully" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
