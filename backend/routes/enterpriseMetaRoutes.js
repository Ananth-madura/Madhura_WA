"use strict";

const router = require("express").Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext, requirePermission } = require("../middleware/tenantMiddleware");
const service = require("../services/metaPartnerService");
const { createOnboardingService } = require("../services/metaCustomerOnboardingService");
const { createConcurrentEngine } = require("../services/concurrentSenderEngine");

const onboardingService = createOnboardingService(db);
const concurrentEngine = createConcurrentEngine(db);

const handle = work => async (req, res) => {
  try {
    if (["POST", "PATCH"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body))) {
      return res.status(400).json({ success: false, message: "A JSON object is required" });
    }
    await work(req, res);
  } catch (error) {
    if (!error.status) console.error("[Sender workspace]", error.code || "OPERATION_FAILED", error.message);
    res.status(error.status || 503).json({
      success: false,
      message: error.status ? error.message : "The sender operation failed. Retry or contact your administrator."
    });
  }
};

router.use(verifyToken, requireTenantContext);
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

// Setup & General Senders
router.get("/setup", requirePermission("sender.view"), handle(async (req, res) => res.json({ success: true, ...service.setup() })));
router.get("/senders", requirePermission("sender.view"), handle(async (req, res) => res.json({ success: true, senders: await service.getTenantSenders(req.tenantId) })));

// Onboarding & Embedded Signup Exchange
router.post("/onboarding/sessions", requirePermission("sender.connect"), handle(async (req, res) => res.status(201).json({ success: true, session: await service.createOnboardingSession(req.tenantId, req.user.id) })));
router.post("/onboarding/complete", requirePermission("sender.connect"), handle(async (req, res) => res.json({ success: true, data: await service.completeOnboarding(req.tenantId, req.user.id, req.body) })));

// Real Meta Customer Embedded Signup Code Exchange
router.post("/onboard/exchange", requirePermission("sender.connect"), handle(async (req, res) => {
  const result = await onboardingService.exchangeAndAuthorize(req.tenantId, req.user.id, req.body);
  res.json({ success: true, ...result });
}));

// Asset Discovery: Portfolios, WABAs, and Phone Numbers
router.post("/assets/discover", requirePermission("sender.view"), handle(async (req, res) => {
  const assets = await onboardingService.discoverAssets(req.tenantId, req.body);
  res.json({ success: true, ...assets });
}));

// Batch Connect Multiple Discovered Phone Numbers
router.post("/senders/connect-batch", requirePermission("sender.connect"), handle(async (req, res) => {
  const result = await onboardingService.connectDiscoveredNumbers(req.tenantId, req.user.id, req.body);
  res.json({ success: true, ...result });
}));

// Manual Single Sender Registration
router.post("/senders/manual", requirePermission("sender.connect"), handle(async (req, res) => res.status(201).json({ success: true, sender: await service.registerDirectSender(req.tenantId, req.user.id, req.body) })));

// Single Sender Details & Routing
router.get("/senders/:id", requirePermission("sender.view"), handle(async (req, res) => res.json({ success: true, sender: await service.getSender(req.tenantId, req.params.id) })));
router.patch("/senders/:id/branch-assignments", requirePermission("sender.manage"), handle(async (req, res) => res.json({ success: true, sender: await service.updateSenderBranchAssignments(req.tenantId, req.params.id, req.body, req.user.id) })));
router.patch("/senders/:id/settings", requirePermission("sender.manage"), handle(async (req, res) => {
  const tid = Number(req.tenantId);
  const sid = Number(req.params.id);
  const { isDefault, departmentName, isShared } = req.body;
  if (isDefault !== undefined) {
    if (isDefault) {
      await db.promise().query("UPDATE wa_senders SET is_default=0 WHERE tenant_id=?", [tid]);
      await db.promise().query("UPDATE wa_senders SET is_default=1, revision=revision+1, updated_at=NOW() WHERE tenant_id=? AND id=?", [tid, sid]);
    } else {
      await db.promise().query("UPDATE wa_senders SET is_default=0, revision=revision+1, updated_at=NOW() WHERE tenant_id=? AND id=?", [tid, sid]);
    }
  }
  if (departmentName !== undefined) {
    const cleanDept = typeof departmentName === "string" ? departmentName.slice(0, 100) : null;
    await db.promise().query("UPDATE wa_senders SET department_name=?, revision=revision+1, updated_at=NOW() WHERE tenant_id=? AND id=?", [cleanDept, tid, sid]);
  }
  if (isShared !== undefined) {
    await db.promise().query("UPDATE wa_senders SET is_shared=?, revision=revision+1, updated_at=NOW() WHERE tenant_id=? AND id=?", [Number(Boolean(isShared)), tid, sid]);
  }
  const updated = await service.getSender(tid, sid);
  res.json({ success: true, sender: updated });
}));

// Real-time Ping / Latency Health Check against Meta
router.post("/senders/:id/ping", requirePermission("sender.manage"), handle(async (req, res) => {
  const result = await onboardingService.pingSender(req.tenantId, req.params.id);
  res.json({ success: true, ...result });
}));

// Diagnostic Test WhatsApp Message Send
router.post("/senders/:id/test-send", requirePermission("sender.manage"), handle(async (req, res) => {
  const result = await onboardingService.sendTestMessage(req.tenantId, req.params.id, req.body);
  res.json({ success: true, ...result });
}));

// Sender Usage & Throughput Metrics
router.get("/senders/:id/metrics", requirePermission("sender.view"), handle(async (req, res) => {
  const [metrics] = await db.promise().query(
    `SELECT metric_date, metric_hour, messages_sent, messages_delivered, messages_read, messages_failed
     FROM wa_sender_metrics
     WHERE tenant_id=? AND sender_id=?
     ORDER BY metric_date DESC, metric_hour DESC LIMIT 168`,
    [req.tenantId, Number(req.params.id)]
  );
  res.json({ success: true, metrics: metrics || [] });
}));

// WABA Concurrency & Rate Limiting Engine Diagnostics
router.get("/engine/diagnostics", requirePermission("sender.view"), handle(async (req, res) => {
  res.json({ success: true, ...concurrentEngine.getDiagnostics() });
}));

// Existing Sender Operations
router.post("/senders/:id/sync", requirePermission("sender.manage"), handle(async (req, res) => {
  const sender = await service.syncSenderHealth(req.tenantId, req.params.id, req.user.id);
  res.json({ success: true, sender, health: sender });
}));
router.post("/senders/:id/register", requirePermission("sender.manage"), handle(async (req, res) => res.json({ success: true, sender: await service.registerSender(req.tenantId, req.params.id, req.user.id, req.body) })));
router.post("/senders/:id/credentials", requirePermission("sender.manage"), handle(async (req, res) => {
  const previous = await service.getSender(req.tenantId, req.params.id);
  const sender = await service.registerDirectSender(req.tenantId, req.user.id, {
    ...req.body,
    phoneNumberId: previous.phone_number_id,
    wabaId: previous.waba_id,
    isShared: previous.is_shared,
    branchIds: previous.assigned_branch_ids,
    defaultBranchIds: previous.default_branch_ids
  });
  res.json({ success: true, sender });
}));
router.get("/senders/:id/webhook", requirePermission("sender.manage"), handle(async (req, res) => res.json({ success: true, ...await service.webhookSettings(req.tenantId, req.params.id) })));
router.post("/senders/:id/webhook", requirePermission("sender.manage"), handle(async (req, res) => res.json({ success: true, sender: await service.subscribeWebhook(req.tenantId, req.params.id, req.user.id) })));
router.get("/senders/:id/activity", requirePermission("sender.view"), handle(async (req, res) => res.json({ success: true, events: await service.activity(req.tenantId, req.params.id) })));
router.delete("/senders/:id", requirePermission("sender.manage"), handle(async (req, res) => res.json(await service.deleteSender(req.tenantId, req.params.id, req.user.id))));

module.exports = router;
