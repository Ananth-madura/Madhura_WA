"use strict";

/**
 * metaCampaignWebhookRoutes.js
 *
 * Mounted at /api/webhooks/meta:
 * - GET/POST /api/webhooks/meta/whatsapp — Signature-verified Meta webhook processor
 * - POST /api/webhooks/meta/flows/:endpointId — Encrypted WhatsApp Flows Data-Exchange endpoint
 */

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifySignature } = require("../services/waWebhookAuth");
const cryptoHelper = require("../backendutil/cryptoHelper");
const { createCampaignWebhookProcessor } = require("../services/campaign/campaignWebhookProcessor");
const { createWhatsAppFlowCryptoService } = require("../services/campaign/whatsappFlowCryptoService");
const { createDbHelper } = require("../services/campaign/dbHelper");

const processor = createCampaignWebhookProcessor({ db });
const flowCrypto = createWhatsAppFlowCryptoService({ db });
const dbh = createDbHelper(db);

// Meta Webhook Verification Handshake
router.get("/whatsapp", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode !== "subscribe" || !token) return res.status(403).send("Forbidden");

  const sender = await dbh.queryOne(`SELECT id FROM wa_senders WHERE verify_token = ? LIMIT 1`, [token]).catch(() => null);
  if (sender || (process.env.WA_VERIFY_TOKEN && token === process.env.WA_VERIFY_TOKEN)) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send("Invalid verification token");
});

// Meta Webhook Event Ingestion (strictly verified per-sender app_secret!)
router.post("/whatsapp", async (req, res) => {
  try {
    const signature = req.headers["x-hub-signature-256"];
    const entries = req.body?.entry || [];
    const results = [];

    for (const entry of entries) {
      let tenantId = null;
      let appSecret = null;

      // Resolve tenant & app_secret via phone_number_id or WABA id
      const phoneId = entry?.changes?.[0]?.value?.metadata?.phone_number_id;
      if (phoneId) {
        const sender = await dbh.queryOne(`SELECT tenant_id, app_secret FROM wa_senders WHERE phone_number_id = ? LIMIT 1`, [String(phoneId)]);
        if (sender) {
          tenantId = sender.tenant_id;
          appSecret = sender.app_secret ? cryptoHelper.decrypt(sender.app_secret) : process.env.WA_APP_SECRET || "";
        }
      }
      if (!tenantId && entry.id) {
        const waba = await dbh.queryOne(`SELECT tenant_id FROM waba_connections WHERE waba_id = ? LIMIT 1`, [String(entry.id)]);
        if (waba) {
          tenantId = waba.tenant_id;
          appSecret = process.env.WA_APP_SECRET || "";
        }
      }

      if (!tenantId) {
        return res.status(403).json({ error: "Unrecognized WhatsApp Business Account or sender" });
      }

      const allowUnsigned = process.env.NODE_ENV !== "production" && process.env.WA_WEBHOOK_ALLOW_UNSIGNED === "1";
      if (!allowUnsigned && !verifySignature(req.rawBody, signature, appSecret)) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      results.push(await processor.processMetaWebhookPayload(tenantId, { entry: [entry] }));
    }

    return res.status(200).json({ ok: true, processed: results.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Encrypted WhatsApp Flows Data-Exchange Endpoint (returns raw base64 text/plain per Meta spec)
router.post("/flows/:endpointId", async (req, res) => {
  try {
    const out = await flowCrypto.handleEncryptedDataExchange(req.params.endpointId, req.body);
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(out.encryptedResponse);
  } catch (err) {
    const status = err.status === 421 ? 421 : err.status || 500;
    return res.status(status).json({ error: err.message, code: err.code || "FLOW_EXCHANGE_ERROR" });
  }
});

module.exports = router;
