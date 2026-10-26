/**
 * enterpriseBranchRoutes.js
 *
 * REST API v2 endpoints for Multi-Branch Operating System.
 * Reference: Section 6 of Multi-Branch Management Implementation Specification
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
 * GET /api/v2/me/branches
 * Accessible branches for the authenticated user (for global and in-workspace switchers).
 */
router.get("/me/branches", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branches = await orgService.getBranches(req.tenantId);
    const userId = req.user.id;

    // Check if user is organization owner or admin
    const [orgMem] = await q(
      "SELECT role FROM organization_memberships WHERE tenant_id = ? AND user_id = ? AND membership_status = 'active' LIMIT 1",
      [req.tenantId, userId]
    );

    const isOrgAdmin =
      orgMem?.role === "organization_owner" ||
      orgMem?.role === "organization_admin" ||
      req.user.role === "platform_admin";

    let accessibleBranches = branches;
    if (!isOrgAdmin) {
      const staffBranches = await q(
        "SELECT branch_id FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = ?",
        [req.tenantId, userId]
      );
      const allowedIds = staffBranches.map((sb) => sb.branch_id);
      accessibleBranches = branches.filter((b) => allowedIds.includes(b.id));
    }

    res.json({
      success: true,
      branches: accessibleBranches,
      isOrgAdmin,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v2/me/permissions?branchId=...
 * Returns effective branch capabilities for the current user.
 */
router.get("/me/permissions", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;
    const permissions = await orgService.getEffectiveBranchPermissions(req.tenantId, req.user.id, branchId);
    res.json({
      success: true,
      branchId,
      permissions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v2/branches
 * Paginated permitted branches under active tenant with search and status filtering.
 */
router.get("/branches", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const allBranches = await orgService.getBranches(req.tenantId);

    let filtered = allBranches;
    if (status && status !== "all") {
      filtered = filtered.filter((b) => b.status === status);
    }
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(s) ||
          b.code.toLowerCase().includes(s) ||
          (b.city && b.city.toLowerCase().includes(s)) ||
          (b.manager_email && b.manager_email.toLowerCase().includes(s))
      );
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const total = filtered.length;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Get tenant plan details for usage meter (e.g. 4 / 10 branches)
    const [tenant] = await q("SELECT name, plan, max_branches FROM tenants WHERE id = ? LIMIT 1", [req.tenantId]);

    res.json({
      success: true,
      branches: paginated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      quota: {
        current: total,
        maxAllowed: tenant ? tenant.max_branches : 1,
        plan: tenant?.plan || "starter",
      },
    });
  } catch (err) {
    console.error("[GET /api/v2/branches] Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v2/branches
 * Transactional branch creation with entitlements, manager assignment, and sender allocations.
 */
router.post(
  "/branches",
  verifyToken,
  requireTenantContext,
  requirePermission("branch.create"),
  async (req, res) => {
    try {
      const branch = await orgService.createBranch(req.tenantId, req.body, req.user.id);
      res.status(201).json({
        success: true,
        branch,
        message: "Branch created successfully",
      });
    } catch (err) {
      const status =
        err.code === "QUOTA_EXCEEDED" ? 403 : err.code === "DUPLICATE_BRANCH_CODE" ? 409 : 422;
      res.status(status).json({ success: false, code: err.code, message: err.message });
    }
  }
);

/**
 * GET /api/v2/branches/:branchId
 * Authorized branch details, manager object, setup state, and counters.
 */
router.get("/branches/:branchId", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branchId = Number(req.params.branchId);
    const branch = await orgService.getBranchDetails(req.tenantId, branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }
    res.json({ success: true, branch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/v2/branches/:branchId
 * Update general branch settings, operating hours, timezone, or profile.
 */
router.patch(
  "/branches/:branchId",
  verifyToken,
  requireTenantContext,
  requirePermission("branch.manage"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const updated = await orgService.updateBranch(req.tenantId, branchId, req.body);
      await orgService.recordBranchAudit(req.tenantId, branchId, req.user.id, "branch.updated", req.body);
      res.json({ success: true, branch: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/branches/:branchId/archive
 * Soft-delete / archive branch after preflight conflict checks.
 */
router.post(
  "/branches/:branchId/archive",
  verifyToken,
  requireTenantContext,
  requirePermission("branch.manage"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      await orgService.archiveBranch(req.tenantId, branchId);
      await orgService.recordBranchAudit(req.tenantId, branchId, req.user.id, "branch.archived", { branch_id: branchId });
      res.json({ success: true, message: "Branch archived successfully" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/branches/:branchId/restore
 * Restore archived branch within plan quota.
 */
router.post(
  "/branches/:branchId/restore",
  verifyToken,
  requireTenantContext,
  requirePermission("branch.manage"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      await orgService.restoreBranch(req.tenantId, branchId, req.user.id);
      res.json({ success: true, message: "Branch restored successfully" });
    } catch (err) {
      const status = err.code === "QUOTA_EXCEEDED" ? 403 : 400;
      res.status(status).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/v2/branches/:branchId/members
 * List team members and roles assigned to this branch.
 */
router.get("/branches/:branchId/members", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branchId = Number(req.params.branchId);
    const members = await orgService.getBranchMembers(req.tenantId, branchId);
    res.json({ success: true, members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v2/branches/:branchId/members
 * Assign / add employee to branch.
 */
router.post(
  "/branches/:branchId/members",
  verifyToken,
  requireTenantContext,
  requirePermission("staff.role.assign"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const { userId, teamId, isPrimary } = req.body;
      await orgService.assignStaffBranch(req.tenantId, userId, branchId, teamId, isPrimary);
      await orgService.recordBranchAudit(req.tenantId, branchId, req.user.id, "branch.member.added", { userId, teamId, isPrimary });
      res.status(201).json({ success: true, message: "Team member assigned to branch" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/v2/branches/:branchId/members/:userId
 * Remove a member from a branch.
 */
router.delete(
  "/branches/:branchId/members/:userId",
  verifyToken,
  requireTenantContext,
  requirePermission("staff.role.assign"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const userId = Number(req.params.userId);
      await orgService.removeBranchMember(req.tenantId, branchId, userId, req.user.id);
      res.json({ success: true, message: "Member unassigned from branch" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/branches/:branchId/manager
 * Transfer branch manager atomically with audit event.
 */
router.post(
  "/branches/:branchId/manager",
  verifyToken,
  requireTenantContext,
  requirePermission("branch.manage"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const targetUserId =
        req.body.newManagerUserId ||
        req.body.managerUserId ||
        req.body.manager_id ||
        req.body.newManagerId;
      if (!targetUserId) {
        return res.status(400).json({ success: false, message: "Target manager user ID is required" });
      }
      const result = await orgService.transferBranchManager(req.tenantId, branchId, targetUserId, req.user.id);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/v2/branches/:branchId/senders
 * Assigned phone numbers / Meta WABA senders for this branch.
 */
router.get("/branches/:branchId/senders", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branchId = Number(req.params.branchId);
    const senders = await orgService.getBranchSenders(req.tenantId, branchId);
    res.json({ success: true, senders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v2/branches/:branchId/senders
 * Attach authorized sender to branch (dedicated or shared).
 */
router.post(
  "/branches/:branchId/senders",
  verifyToken,
  requireTenantContext,
  requirePermission("sender.connect"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const { senderId, sender_id, isDefault, routingWeight } = req.body;
      const targetSenderId = senderId || sender_id;
      if (!targetSenderId) {
        return res.status(400).json({ success: false, message: "Sender ID is required" });
      }
      await orgService.attachSenderToBranch(
        req.tenantId,
        branchId,
        { senderId: targetSenderId, isDefault, routingWeight },
        req.user.id
      );
      res.status(201).json({ success: true, message: "Sender attached to branch successfully" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/v2/branches/:branchId/senders/:senderId
 * Unassign sender from branch.
 */
router.delete(
  "/branches/:branchId/senders/:senderId",
  verifyToken,
  requireTenantContext,
  requirePermission("sender.manage"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const senderId = Number(req.params.senderId);
      await orgService.unassignSenderFromBranch(req.tenantId, branchId, senderId, req.user.id);
      res.json({ success: true, message: "Sender unassigned from branch" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/v2/branches/:branchId/conversations
 * Branch inbox conversations (strict tenant and branch scoping).
 */
router.get("/branches/:branchId/conversations", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branchId = Number(req.params.branchId);
    const conversations = await orgService.getBranchConversations(req.tenantId, branchId, req.query);
    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v2/branches/:branchId/conversations/:id/transfer
 * Transfer conversation to another branch within tenant with audit history.
 */
router.post(
  "/branches/:branchId/conversations/:id/transfer",
  verifyToken,
  requireTenantContext,
  requirePermission("inbox.transfer"),
  async (req, res) => {
    try {
      const conversationId = Number(req.params.id);
      const { targetBranchId, reason } = req.body;
      if (!targetBranchId) {
        return res.status(400).json({ success: false, message: "Target branch ID is required" });
      }
      const result = await orgService.transferConversationBranch(
        req.tenantId,
        conversationId,
        targetBranchId,
        req.user.id,
        reason
      );
      res.json({ success: true, ...result, message: "Conversation transferred successfully" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/v2/branches/:branchId/analytics
 * Branch analytics and metrics.
 */
router.get("/branches/:branchId/analytics", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branchId = Number(req.params.branchId);
    const analytics = await orgService.getBranchAnalytics(req.tenantId, branchId);
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET & PATCH /api/v2/branches/:branchId/settings
 * Hours, policies, routing, and workflows.
 */
router.get("/branches/:branchId/settings", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branchId = Number(req.params.branchId);
    const branch = await orgService.getBranchDetails(req.tenantId, branchId);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
    res.json({
      success: true,
      operating_hours: branch.operating_hours,
      settings: branch.settings,
      status: branch.status,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch(
  "/branches/:branchId/settings",
  verifyToken,
  requireTenantContext,
  requirePermission("branch.manage"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const { operating_hours, settings, status } = req.body;
      const updated = await orgService.updateBranch(req.tenantId, branchId, {
        operating_hours,
        settings,
        status,
      });
      res.json({ success: true, branch: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/v2/branches/:branchId/contacts
 * Contacts/Customers strictly scoped to this branch and tenant.
 */
router.get("/branches/:branchId/contacts", verifyToken, requireTenantContext, async (req, res) => {
  try {
    const branchId = Number(req.params.branchId);
    const result = await orgService.getBranchContacts(req.tenantId, branchId, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v2/branches/:branchId/contacts
 * Create a new customer directly under this branch.
 */
router.post(
  "/branches/:branchId/contacts",
  verifyToken,
  requireTenantContext,
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const contact = await orgService.createBranchContact(req.tenantId, branchId, req.body, req.user.id);
      res.status(201).json({ success: true, contact, message: "Branch customer created successfully" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/branches/:branchId/contacts/:contactId/transfer
 * Transfer a contact from this branch to another branch within the tenant.
 */
router.post(
  "/branches/:branchId/contacts/:contactId/transfer",
  verifyToken,
  requireTenantContext,
  async (req, res) => {
    try {
      const contactId = Number(req.params.contactId);
      const { targetBranchId, reason } = req.body;
      if (!targetBranchId) {
        return res.status(400).json({ success: false, message: "Target branch ID is required" });
      }
      const result = await orgService.transferBranchContact(
        req.tenantId,
        contactId,
        targetBranchId,
        req.user.id,
        reason
      );
      res.json({ success: true, ...result, message: "Customer transferred to target branch" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/branches/:branchId/employees
 * Create a brand new employee directly assigned to this branch with access code generation.
 */
router.post(
  "/branches/:branchId/employees",
  verifyToken,
  requireTenantContext,
  requirePermission("staff.invite"),
  async (req, res) => {
    try {
      const branchId = Number(req.params.branchId);
      const employee = await orgService.createBranchEmployee(req.tenantId, branchId, req.body, req.user.id, { actorRole: req.user?.actorRole || req.user?.role });
      res.status(201).json({
        success: true,
        employee,
        message: `Employee "${employee.first_name}" created with Access Code: ${employee.access_code}`,
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
