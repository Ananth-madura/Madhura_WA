"use strict";

const router = require("express").Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext, requirePermission } = require("../middleware/tenantMiddleware");
const { createMetaTechProviderService } = require("../services/metaTechProviderService");

const providerService = createMetaTechProviderService(db);

const handle = work => async (req, res) => {
  try {
    await work(req, res);
  } catch (error) {
    if (!error.status) console.error("[Meta Tech Provider]", error.code || "OPERATION_FAILED", error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Meta Tech Provider operation failed. Please check credentials or retry."
    });
  }
};

router.use(verifyToken, requireTenantContext);
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

/**
 * GET /api/platform/meta-tech-provider/status
 * Returns authoritative 6-stage compliance tracking data and readiness score.
 */
router.get("/status", handle(async (req, res) => {
  const result = await providerService.getComplianceStatus(req.tenantId);
  res.json(result);
}));

/**
 * POST /api/platform/meta-tech-provider/stages/:stageId
 * Updates stage checklist, notes, and documentation URLs.
 */
router.post("/stages/:stageId", requirePermission("sender.manage"), handle(async (req, res) => {
  const stageId = Number(req.params.stageId);
  const result = await providerService.updateComplianceStage(req.tenantId, stageId, req.body);
  res.json({ success: true, message: `Stage ${stageId} updated successfully`, ...result });
}));

/**
 * POST /api/platform/meta-tech-provider/verify-live
 * Live ping against Meta Graph API verifying App credentials, WABAs, and Webhook readiness.
 */
router.post("/verify-live", requirePermission("sender.manage"), handle(async (req, res) => {
  const result = await providerService.verifyLiveReadiness(req.tenantId);
  res.json({ success: true, audit: result });
}));

/**
 * GET /api/platform/meta-tech-provider/webhooks/logs
 * Returns live incoming webhook events with JSON payloads for debugging & inspection.
 */
router.get("/webhooks/logs", handle(async (req, res) => {
  const limit = req.query.limit || 50;
  const result = await providerService.getWebhookLogs(req.tenantId, limit);
  res.json(result);
}));

/**
 * POST /api/platform/meta-tech-provider/phone/register
 * Registers a WhatsApp Phone Number with 6-digit PIN (Meta sample app parity).
 */
router.post("/phone/register", requirePermission("sender.manage"), handle(async (req, res) => {
  const { phoneId, pin } = req.body;
  const result = await providerService.registerPhone(req.tenantId, phoneId, pin);
  res.json(result);
}));

/**
 * POST /api/platform/meta-tech-provider/phone/deregister
 * Deregisters a WhatsApp Phone Number (Meta sample app parity).
 */
router.post("/phone/deregister", requirePermission("sender.manage"), handle(async (req, res) => {
  const { phoneId } = req.body;
  const result = await providerService.deregisterPhone(req.tenantId, phoneId);
  res.json(result);
}));

/**
 * POST /api/platform/meta-tech-provider/phone/request-code
 * Requests a 2-step verification code via SMS or VOICE.
 */
router.post("/phone/request-code", requirePermission("sender.manage"), handle(async (req, res) => {
  const { phoneId, codeMethod, language } = req.body;
  const result = await providerService.requestCode(req.tenantId, phoneId, codeMethod, language);
  res.json(result);
}));

/**
 * POST /api/platform/meta-tech-provider/phone/verify-code
 * Submits 6-digit verification code to Meta.
 */
router.post("/phone/verify-code", requirePermission("sender.manage"), handle(async (req, res) => {
  const { phoneId, code } = req.body;
  const result = await providerService.verifyCode(req.tenantId, phoneId, code);
  res.json(result);
}));

/**
 * POST /api/platform/meta-tech-provider/phone/ack-bot
 * Configures AckBot auto-responder per connected phone number.
 */
router.post("/phone/ack-bot", requirePermission("sender.manage"), handle(async (req, res) => {
  const { senderId, isEnabled, customMessage } = req.body;
  const result = await providerService.updateAckBot(req.tenantId, senderId, isEnabled, customMessage);
  res.json(result);
}));

/**
 * POST /api/platform/meta-tech-provider/assets/discover
 * Discovers Pages, Catalogs, Ad Accounts, Datasets, and Instagram Accounts.
 */
router.post("/assets/discover", requirePermission("sender.view"), handle(async (req, res) => {
  const result = await providerService.discoverExtendedAssets(req.tenantId);
  res.json(result);
}));

/**
 * POST /api/platform/meta-tech-provider/token/exchange
 * Exchanges Meta OAuth code, encrypts token, connects WABAs & assets (Meta sample app parity).
 */
router.post("/token/exchange", requirePermission("sender.manage"), handle(async (req, res) => {
  const result = await providerService.exchangeAndConnectEmbeddedSignup({
    tenantId: req.tenantId,
    ...req.body
  });
  res.json(result);
}));

/**
 * GET /api/platform/meta-tech-provider/assets
 * Lists discovered shared assets grouped by type.
 */
router.get("/assets", requirePermission("sender.view"), handle(async (req, res) => {
  const result = await providerService.getExtendedAssets(req.tenantId);
  res.json(result);
}));

module.exports = router;
