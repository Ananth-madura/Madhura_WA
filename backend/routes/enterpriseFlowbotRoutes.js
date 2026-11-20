"use strict";

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const { getOrchestrationEngines } = require("../services/orchestration");
const db = require("../config/database");
const { createDbHelper } = require("../services/campaign/dbHelper");

router.use(verifyToken, requireTenantContext);

const handle = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.json(data);
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({ error: err.message || "Flowbot engine error", code: err.code || "FLOWBOT_ERROR" });
  }
};

router.get("/dashboard", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.getDashboardOverview(req.tenantId);
}));

router.get("/sessions", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.listSessions(req.tenantId, {
    flowId: req.query.flow_id || null,
    status: req.query.status || "ALL",
    limit: req.query.limit || 50,
  });
}));

router.get("/sessions/:id/trace", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.getSessionTrace(req.tenantId, req.params.id);
}));

router.post("/sessions/:id/resume-handover", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.resumeBotFromHandover(req.tenantId, req.params.id, {
    resumeNodeKey: req.body?.resume_node_key || null,
    actorId: req.user?.id || null,
  });
}));

router.post("/flows/:flowId/validate", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.validateFlowGraph(req.body?.nodes || [], req.body?.entry_node_key || "start");
}));

router.post("/flows/:flowId/publish", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.publishFlowVersion(req.tenantId, req.params.flowId, req.body || {}, req.user?.id || null);
}));

router.get("/flows/:flowId/versions", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.listFlowVersions(req.tenantId, req.params.flowId);
}));

router.post("/flows/:flowId/rollback", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.rollbackFlowVersion(req.tenantId, req.params.flowId, req.body?.version_number, req.user?.id || null);
}));

router.post("/flows/:flowId/simulate", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.simulateSession(req.tenantId, {
    flowId: Number(req.params.flowId),
    messages: Array.isArray(req.body?.messages) ? req.body.messages : [],
    phone: req.body?.phone || "919999999999",
    initialVars: req.body?.initial_vars || {},
  });
}));

router.get("/triggers", handle(async (req) => {
  const dbh = createDbHelper(db);
  return dbh.query(
    `SELECT t.*, f.name AS flow_name, f.status AS flow_status
     FROM flowbot_triggers t
     LEFT JOIN wa_flows f ON f.id = t.flow_id AND f.tenant_id = t.tenant_id
     WHERE t.tenant_id = ? ORDER BY t.priority ASC, t.id DESC LIMIT 200`,
    [req.tenantId]
  );
}));

router.post("/triggers", handle(async (req) => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.registerTrigger(req.tenantId, req.body || {}, req.user?.id || null);
}));

router.get("/service-window/:phone", handle(async (req) => {
  const { serviceWindow } = getOrchestrationEngines();
  return serviceWindow.getWindowStatus(req.tenantId, {
    phone: req.params.phone,
    senderId: req.query.sender_id ? Number(req.query.sender_id) : null,
  });
}));

router.get("/knowledge-base", handle(async (req) => {
  const { aiService } = getOrchestrationEngines();
  return aiService.listKnowledgeArticles(req.tenantId, {
    category: req.query.category || null,
  });
}));

router.post("/knowledge-base", handle(async (req) => {
  const { aiService } = getOrchestrationEngines();
  return aiService.upsertKnowledgeArticle(req.tenantId, req.body || {}, req.user?.id || null);
}));

router.post("/worker/resume-due", handle(async () => {
  const { flowbotRuntime } = getOrchestrationEngines();
  return flowbotRuntime.resumeDueSessions();
}));

module.exports = router;
