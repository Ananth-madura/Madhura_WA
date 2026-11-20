"use strict";

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const { getOrchestrationEngines } = require("../services/orchestration");
const db = require("../config/database");
const { createDbHelper, httpError } = require("../services/campaign/dbHelper");

router.use(verifyToken, requireTenantContext);

const handle = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.json(data);
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({ error: err.message || "Automation engine error", code: err.code || "AUTOMATION_ERROR" });
  }
};

function assertAdminRole(req) {
  const role = String(req.user?.role || req.membership?.role || "").toLowerCase();
  const isAdmin =
    req.user?.is_super_admin ||
    ["admin", "super_admin", "platform_admin", "organization_owner", "organization_admin", "company_owner", "company_admin"].includes(role);
  if (!isAdmin) {
    throw httpError("Administrator privileges required to manage integration credentials", 403, "PERMISSION_DENIED");
  }
}

router.get("/dashboard", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.getDashboardOverview(req.tenantId);
}));

router.get("/workflows", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.listWorkflows(req.tenantId, {
    status: req.query.status || "ALL",
    triggerType: req.query.trigger_type || null,
  });
}));

router.post("/workflows", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.createWorkflow(req.tenantId, req.body || {}, req.user?.id || null);
}));

router.get("/workflows/:id", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.getWorkflow(req.tenantId, req.params.id);
}));

router.post("/workflows/:id/publish", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.publishWorkflow(req.tenantId, req.params.id, req.body || {}, req.user?.id || null);
}));

router.post("/workflows/:id/execute", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.startWorkflowRun(req.tenantId, req.params.id, {
    triggerEvent: req.body?.trigger_event || "manual",
    idempotencyKey: req.body?.idempotency_key || null,
    payload: req.body?.payload || {},
    isTestMode: Boolean(req.body?.is_test_mode),
  });
}));

router.post("/events", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.emitEvent(req.tenantId, req.body?.event_type, req.body?.payload || {}, {
    source: req.body?.source || "api",
    idempotencyKey: req.body?.idempotency_key || null,
    isTestMode: Boolean(req.body?.is_test_mode),
  });
}));

router.get("/runs", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.listRuns(req.tenantId, {
    workflowId: req.query.workflow_id || null,
    status: req.query.status || "ALL",
    limit: req.query.limit || 50,
  });
}));

router.get("/runs/:id/inspector", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.getRunInspector(req.tenantId, req.params.id);
}));

router.post("/runs/:id/cancel", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.cancelRun(req.tenantId, req.params.id, req.body?.reason || "Cancelled by user");
}));

router.get("/approvals", handle(async (req) => {
  const dbh = createDbHelper(db);
  return dbh.query(
    `SELECT a.*, w.name AS workflow_name
     FROM automation_workflow_approvals a
     LEFT JOIN automation_workflows w ON w.id = a.workflow_id AND w.tenant_id = a.tenant_id
     WHERE a.tenant_id = ? ORDER BY a.created_at DESC LIMIT 100`,
    [req.tenantId]
  );
}));

router.post("/approvals/:id/decide", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.decideApproval(req.tenantId, req.params.id, {
    decision: req.body?.decision,
    approverId: req.user?.id || null,
    reason: req.body?.reason || "",
  });
}));

router.get("/dead-letters", handle(async (req) => {
  const dbh = createDbHelper(db);
  return dbh.query(
    `SELECT d.*, w.name AS workflow_name
     FROM automation_dead_letters d
     LEFT JOIN automation_workflows w ON w.id = d.workflow_id AND w.tenant_id = d.tenant_id
     WHERE d.tenant_id = ? ORDER BY d.created_at DESC LIMIT 100`,
    [req.tenantId]
  );
}));

router.post("/dead-letters/:id/replay", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.replayDeadLetter(req.tenantId, req.params.id);
}));

router.get("/credentials", handle(async (req) => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.listIntegrationCredentials(req.tenantId);
}));

router.post("/credentials", handle(async (req) => {
  assertAdminRole(req);
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.saveIntegrationCredential(req.tenantId, req.body || {}, req.user?.id || null);
}));

router.post("/worker/process-due", handle(async () => {
  const { automationEngine } = getOrchestrationEngines();
  return automationEngine.processDueWorkflows();
}));

module.exports = router;
