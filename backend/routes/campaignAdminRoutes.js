"use strict";

/**
 * campaignAdminRoutes.js — Platform & Organization Admin Operational Control Center
 * Mounted at /api/admin/campaigns
 */

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const { createCampaignAnalyticsService } = require("../services/campaign/campaignAnalyticsService");
const { createCampaignExecutionEngine } = require("../services/campaign/campaignExecutionEngine");
const { createCampaignAuditService } = require("../services/campaign/campaignAuditService");

const analyticsService = createCampaignAnalyticsService({ db });
const executionEngine = createCampaignExecutionEngine({ db });
const auditService = createCampaignAuditService({ db });

router.use(verifyToken, requireTenantContext, (req, res, next) => {
  const allowedRoles = ["platform_admin", "organization_owner", "organization_admin", "admin", "super_admin"];
  if (!allowedRoles.includes(req.userRole) && !allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ error: "Administrator permission required for campaign operations control", code: "ADMIN_REQUIRED" });
  }
  next();
});

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (err) {
    res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.message, code: err.code || "ADMIN_ERROR" });
  }
};

router.get("/overview", handle(() => analyticsService.getPlatformOperationsOverview()));

router.post("/dispatch-controls", handle(async (req) => {
  const result = await analyticsService.setDispatchControl({
    scopeType: req.body?.scope_type,
    scopeId: req.body?.scope_id,
    isPaused: Boolean(req.body?.is_paused),
    reason: req.body?.reason || "Administrative control",
    actorId: req.user?.id,
  });
  await auditService.log(req.tenantId, {
    entityType: "dispatch_control",
    entityId: `${result.scope_type}:${result.scope_id}`,
    action: result.is_paused ? "ADMIN_PAUSE_DISPATCH" : "ADMIN_RESUME_DISPATCH",
    actorId: req.user?.id,
    actorRole: req.userRole,
    after: result,
  });
  return result;
}));

router.post("/:campaignId/pause", handle(async (req) => {
  const targetTenantId = req.user?.role === "platform_admin" && req.body?.tenant_id ? Number(req.body.tenant_id) : req.tenantId;
  return executionEngine.pauseCampaign(targetTenantId, req.params.campaignId, req.body?.reason || "Paused by platform administrator", req.user?.id);
}));

router.post("/:campaignId/retry-failed", handle(async (req) => {
  const targetTenantId = req.user?.role === "platform_admin" && req.body?.tenant_id ? Number(req.body.tenant_id) : req.tenantId;
  return executionEngine.retryFailedJobs(targetTenantId, req.params.campaignId, req.user?.id);
}));

module.exports = router;
