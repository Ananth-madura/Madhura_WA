"use strict";
const router = require("express").Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext, requirePermission } = require("../middleware/tenantMiddleware");
const service = require("../services/metaPartnerService");
const handle = work => async (req, res) => {
  try {
    if (["POST", "PATCH"].includes(req.method) && (!req.body || typeof req.body !== "object" || Array.isArray(req.body))) return res.status(400).json({ success: false, message: "A JSON object is required" });
    await work(req, res);
  }
  catch (error) { if (!error.status) console.error("[Sender workspace]", error.code || "OPERATION_FAILED"); res.status(error.status || 503).json({ success: false, message: error.status ? error.message : "The sender operation failed. Retry or contact your administrator." }); }
};
router.use(verifyToken, requireTenantContext);
router.use((req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
router.get("/setup", requirePermission("sender.view"), handle(async (req, res) => res.json({ success: true, ...service.setup() })));
router.get("/senders", requirePermission("sender.view"), handle(async (req, res) => res.json({ success: true, senders: await service.getTenantSenders(req.tenantId) })));
router.post("/onboarding/sessions", requirePermission("sender.connect"), handle(async (req, res) => res.status(201).json({ success: true, session: await service.createOnboardingSession(req.tenantId, req.user.id) })));
router.post("/onboarding/complete", requirePermission("sender.connect"), handle(async (req, res) => res.json({ success: true, data: await service.completeOnboarding(req.tenantId, req.user.id, req.body) })));
router.post("/senders/manual", requirePermission("sender.connect"), handle(async (req, res) => res.status(201).json({ success: true, sender: await service.registerDirectSender(req.tenantId, req.user.id, req.body) })));
router.get("/senders/:id", requirePermission("sender.view"), handle(async (req, res) => res.json({ success: true, sender: await service.getSender(req.tenantId, req.params.id) })));
router.patch("/senders/:id/branch-assignments", requirePermission("sender.manage"), handle(async (req, res) => res.json({ success: true, sender: await service.updateSenderBranchAssignments(req.tenantId, req.params.id, req.body, req.user.id) })));
router.post("/senders/:id/sync", requirePermission("sender.manage"), handle(async (req, res) => { const sender = await service.syncSenderHealth(req.tenantId, req.params.id, req.user.id); res.json({ success: true, sender, health: sender }); }));
router.post("/senders/:id/register", requirePermission("sender.manage"), handle(async (req, res) => res.json({ success: true, sender: await service.registerSender(req.tenantId, req.params.id, req.user.id, req.body) })));
router.post("/senders/:id/credentials", requirePermission("sender.manage"), handle(async (req, res) => {
  const previous = await service.getSender(req.tenantId, req.params.id);
  const sender = await service.registerDirectSender(req.tenantId, req.user.id, { ...req.body, phoneNumberId: previous.phone_number_id, wabaId: previous.waba_id,
    isShared: previous.is_shared, branchIds: previous.assigned_branch_ids, defaultBranchIds: previous.default_branch_ids });
  res.json({ success: true, sender });
}));
router.get("/senders/:id/webhook", requirePermission("sender.manage"), handle(async (req, res) => res.json({ success: true, ...await service.webhookSettings(req.tenantId, req.params.id) })));
router.post("/senders/:id/webhook", requirePermission("sender.manage"), handle(async (req, res) => res.json({ success: true, sender: await service.subscribeWebhook(req.tenantId, req.params.id, req.user.id) })));
router.get("/senders/:id/activity", requirePermission("sender.view"), handle(async (req, res) => res.json({ success: true, events: await service.activity(req.tenantId, req.params.id) })));
router.delete("/senders/:id", requirePermission("sender.manage"), handle(async (req, res) => res.json(await service.deleteSender(req.tenantId, req.params.id, req.user.id))));
module.exports = router;
