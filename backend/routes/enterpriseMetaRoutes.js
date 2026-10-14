/**
 * enterpriseMetaRoutes.js
 *
 * REST API v2 endpoints for Meta Partner Embedded Signup and Multi-Sender Management.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md §6 & §17
 */

const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  requireTenantContext,
  requirePermission,
} = require("../middleware/tenantMiddleware");
const metaPartner = require("../services/metaPartnerService");

const router = express.Router();

/**
 * POST /api/v2/meta/onboarding/sessions
 * Start an Embedded Signup session with a short-lived nonce and state token.
 */
router.post(
  "/onboarding/sessions",
  verifyToken,
  requireTenantContext,
  requirePermission("sender.connect"),
  async (req, res) => {
    try {
      const session = await metaPartner.createOnboardingSession(req.tenantId, req.user.id);
      res.status(201).json({ success: true, session });
    } catch (err) {
      console.error("[POST /api/v2/meta/onboarding/sessions] Error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/meta/onboarding/complete
 * Accepts popup finish data, validates state, exchanges code for permanent token, registers sender.
 */
router.post(
  "/onboarding/complete",
  verifyToken,
  requireTenantContext,
  requirePermission("sender.connect"),
  async (req, res) => {
    try {
      const result = await metaPartner.completeOnboarding(req.tenantId, req.user.id, req.body);
      res.json({
        success: true,
        message: "WhatsApp Business Account and Phone Number connected successfully",
        data: result,
      });
    } catch (err) {
      console.error("[POST /api/v2/meta/onboarding/complete] Error:", err);
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/v2/meta/senders
 * Lists all connected senders with their branch assignments.
 */
router.get(
  "/senders",
  verifyToken,
  requireTenantContext,
  requirePermission("sender.view"),
  async (req, res) => {
    try {
      const senders = await metaPartner.getTenantSenders(req.tenantId);
      res.json({ success: true, senders });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /api/v2/meta/senders/:id/branch-assignments
 * Configure branch assignments and shared status for a sender (Hybrid Model).
 */
router.patch(
  "/senders/:id/branch-assignments",
  verifyToken,
  requireTenantContext,
  requirePermission("sender.manage"),
  async (req, res) => {
    try {
      const senderId = Number(req.params.id);
      const { branchIds, isShared } = req.body;
      await metaPartner.updateSenderBranchAssignments(req.tenantId, senderId, {
        branchIds,
        isShared: isShared !== undefined ? isShared : 1,
      });

      res.json({
        success: true,
        message: "Sender branch assignments updated successfully",
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/meta/senders/manual
 * Register a direct Meta Cloud API sender manually with provided credentials.
 */
router.post(
  "/senders/manual",
  verifyToken,
  requireTenantContext,
  requirePermission("sender.connect"),
  async (req, res) => {
    try {
      const result = await metaPartner.registerDirectSender(req.tenantId, req.user.id, req.body);
      res.status(201).json({
        success: true,
        message: "Direct Meta Cloud sender registered successfully",
        sender: result,
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/meta/senders/:id/sync
 * Sync sender health, quality rating, and messaging limit tier with Meta Graph API.
 */
router.post(
  "/senders/:id/sync",
  verifyToken,
  requireTenantContext,
  requirePermission("sender.view"),
  async (req, res) => {
    try {
      const senderId = Number(req.params.id);
      const health = await metaPartner.syncSenderHealth(req.tenantId, senderId);
      res.json({
        success: true,
        message: "Sender health synchronized",
        health,
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /api/v2/meta/senders/:id
 * Disconnect and remove a WhatsApp sender asset.
 */
router.delete(
  "/senders/:id",
  verifyToken,
  requireTenantContext,
  requirePermission("sender.manage"),
  async (req, res) => {
    try {
      const senderId = Number(req.params.id);
      await metaPartner.deleteSender(req.tenantId, senderId);
      res.json({
        success: true,
        message: "Sender disconnected successfully",
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
