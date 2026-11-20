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

      // Log webhook event for live inspector (matching Meta sample app)
      const field = entry?.changes?.[0]?.field || "messages";
      const changeVal = entry?.changes?.[0]?.value;
      const wabaId = entry.id;
      const senderPhone = changeVal?.messages?.[0]?.from || null;
      const eventType = changeVal?.messages ? "message" : changeVal?.statuses ? "status" : "meta_event";

      db.promise().query(
        `INSERT INTO meta_webhook_logs (tenant_id, object_type, field, waba_id, phone_number_id, sender_phone, event_type, payload, signature_verified)
         VALUES (?, 'whatsapp_business_account', ?, ?, ?, ?, ?, ?, 1)`,
        [tenantId, field, wabaId, phoneId || null, senderPhone, eventType, JSON.stringify(entry)]
      ).catch(() => {});

      // AckBot auto-responder if enabled for this sender
      if (phoneId && changeVal?.messages?.[0]?.type === "text" && senderPhone) {
        (async () => {
          try {
            const [sRow] = await dbh.queryAll(
              `SELECT s.id, s.is_ack_bot_enabled, s.ack_bot_message, s.encrypted_token, w.encrypted_token AS waba_token
               FROM wa_senders s
               LEFT JOIN waba_connections w ON w.id = s.waba_connection_id
               WHERE s.phone_number_id = ? AND s.tenant_id = ? LIMIT 1`,
              [String(phoneId), tenantId]
            );
            if (sRow && sRow.is_ack_bot_enabled) {
              const replyText = sRow.ack_bot_message || "Thank you for reaching out! We received your message and an agent will reply shortly.";
              const tok = sRow.encrypted_token || sRow.waba_token;
              if (tok) {
                const axios = require("axios");
                const graphVer = process.env.WA_GRAPH_API_VERSION || "v22.0";
                const cleanTok = cryptoHelper.decrypt(tok);
                await axios.post(
                  `https://graph.facebook.com/${graphVer}/${phoneId}/messages`,
                  {
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: senderPhone,
                    type: "text",
                    text: { preview_url: false, body: replyText }
                  },
                  { headers: { Authorization: `Bearer ${cleanTok}` }, timeout: 10000 }
                ).catch(() => {});
              }
            }
          } catch (_) {}
        })();
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
