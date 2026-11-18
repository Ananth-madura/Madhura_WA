"use strict";

const express = require("express");
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const { createProviderGateway } = require("../services/campaign/providerGateway");
const { createTemplateManagementService } = require("../services/campaign/templateManagementService");
const { createWhatsAppFlowsService } = require("../services/campaign/whatsappFlowsService");
const { createWhatsAppFlowCryptoService } = require("../services/campaign/whatsappFlowCryptoService");
const { createCampaignJourneyService } = require("../services/campaign/campaignJourneyService");
const { createDbHelper } = require("../services/campaign/dbHelper");

const gateway = createProviderGateway({ db });
const templateService = createTemplateManagementService({ db, gateway });
const flowsService = createWhatsAppFlowsService({ db, gateway });
const cryptoService = createWhatsAppFlowCryptoService({ db });
const journeyService = createCampaignJourneyService({ db });
const dbh = createDbHelper(db);

const handle = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out);
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({ error: err.message || "Operation failed", code: err.code || "ERROR" });
  }
};

// ── /api/whatsapp/templates ─────────────────────────────────────────────────
const templateRouter = express.Router();
templateRouter.use(verifyToken, requireTenantContext);

templateRouter.get("/", handle((req) => templateService.listTemplates(req.tenantId, req.query)));
templateRouter.post("/", handle(async (req, res) => {
  const tmpl = await templateService.createLocalTemplate(req.tenantId, req.body, req.user?.id);
  res.status(201).json(tmpl);
}));
templateRouter.get("/:id", handle((req) => templateService.getTemplate(req.tenantId, req.params.id)));
templateRouter.get("/:id/status", handle(async (req) => {
  const tmpl = await templateService.getTemplate(req.tenantId, req.params.id);
  const events = await dbh.query(`SELECT * FROM whatsapp_template_status_events WHERE tenant_id = ? AND template_id = ? ORDER BY created_at DESC LIMIT 20`, [req.tenantId, tmpl.id]);
  return { template: tmpl, status_events: events };
}));
templateRouter.post("/sync", handle((req) => templateService.syncFromMeta(req.tenantId, { senderId: req.body?.sender_id || req.body?.senderId, wabaId: req.body?.waba_id }, req.user?.id)));
templateRouter.post("/:id/sync", handle((req) => templateService.syncFromMeta(req.tenantId, { senderId: req.body?.sender_id || req.body?.senderId, wabaId: req.body?.waba_id }, req.user?.id)));
templateRouter.post("/:id/submit", handle((req) => templateService.submitTemplateToMeta(req.tenantId, req.params.id, { senderId: req.body?.sender_id || req.body?.senderId, wabaId: req.body?.waba_id, examples: req.body?.examples || [] }, req.user?.id)));

// ── /api/whatsapp/flows (Meta in-app interactive experiences) ───────────────
const flowsRouter = express.Router();
flowsRouter.use(verifyToken, requireTenantContext);

flowsRouter.get("/", handle((req) => flowsService.listFlows(req.tenantId, req.query)));
flowsRouter.post("/", handle(async (req, res) => {
  const flow = await flowsService.createFlow(req.tenantId, req.body, req.user?.id);
  res.status(201).json(flow);
}));
flowsRouter.get("/endpoints", handle((req) =>
  dbh.query(`SELECT id, tenant_id, waba_id, phone_number_id, endpoint_uri, public_key_pem, key_fingerprint, meta_uploaded, health_status, last_health_check_at, created_at FROM whatsapp_flow_endpoints WHERE tenant_id = ? ORDER BY id DESC`, [req.tenantId])
));
flowsRouter.post("/endpoints/provision", handle((req) =>
  cryptoService.provisionEndpointKeys(req.tenantId, { wabaId: req.body?.waba_id, phoneNumberId: req.body?.phone_number_id, endpointUri: req.body?.endpoint_uri }, req.user?.id)
));
flowsRouter.get("/:id", handle((req) => flowsService.getFlow(req.tenantId, req.params.id)));
flowsRouter.patch("/:id", handle((req) => flowsService.updateFlow(req.tenantId, req.params.id, req.body, req.user?.id)));
flowsRouter.post("/:id/validate", handle((req) => flowsService.validateFlow(req.tenantId, req.params.id)));
flowsRouter.post("/:id/publish", handle((req) => flowsService.publishFlow(req.tenantId, req.params.id, { senderId: req.body?.sender_id, callMetaApi: req.body?.call_meta_api !== false }, req.user?.id)));
flowsRouter.post("/:id/deprecate", handle((req) => flowsService.deprecateFlow(req.tenantId, req.params.id, req.user?.id)));
flowsRouter.post("/:id/clone", handle((req) => flowsService.cloneFlow(req.tenantId, req.params.id, req.body || {}, req.user?.id)));
flowsRouter.get("/:id/submissions", handle((req) =>
  dbh.query(`SELECT * FROM whatsapp_flow_submissions WHERE tenant_id = ? AND flow_id = ? ORDER BY submitted_at DESC LIMIT 200`, [req.tenantId, Number(req.params.id)])
));

// ── /api/provider/whatsapp/* (Madhura Provider Gateway) ─────────────────────
const providerRouter = express.Router();
providerRouter.use(verifyToken, requireTenantContext);

providerRouter.get("/status", handle(async (req) => {
  const senders = await dbh.query(
    `SELECT s.id, s.phone_number_id, s.display_phone, s.verified_name, s.quality, s.messaging_tier, s.status, s.dispatch_paused,
            w.waba_id, w.status AS waba_status, w.marketing_messages_lite_api_status, w.marketing_messages_onboarding_status, w.marketing_messages_terms_accepted
     FROM wa_senders s
     JOIN waba_connections w ON w.id = s.waba_connection_id AND w.tenant_id = s.tenant_id
     WHERE s.tenant_id = ? ORDER BY s.id ASC`,
    [req.tenantId]
  );
  const limit = await gateway.getMessagingLimit(req.tenantId).catch(() => null);
  return { senders, shared_messaging_limit: limit };
}));
providerRouter.get("/marketing-status", handle((req) =>
  gateway.getMarketingMessageStatus(req.tenantId, { senderId: req.query.sender_id, wabaId: req.query.waba_id, sync: req.query.sync === "true" })
));
providerRouter.post("/send", handle((req) => gateway.sendMessage(req.tenantId, req.body)));
providerRouter.post("/send-template", handle((req) => gateway.sendTemplate(req.tenantId, req.body)));
providerRouter.post("/send-marketing", handle((req) => gateway.sendMarketingTemplate(req.tenantId, req.body)));
providerRouter.post("/send-flow", handle((req) => gateway.sendFlowMessage(req.tenantId, req.body)));

// ── /api/flowbots/* (Madhura Conversational Flowbot Campaign Integration) ───
const flowbotRouter = express.Router();
flowbotRouter.use(verifyToken, requireTenantContext);

flowbotRouter.get("/", handle((req) =>
  dbh.query(`SELECT id, name, description, trigger_type, is_active, created_at, updated_at FROM wa_flows WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 200`, [req.tenantId]).catch(() => [])
));
flowbotRouter.post("/:id/attach-to-campaign", handle((req) =>
  journeyService.bindFlowbot(req.tenantId, req.body?.campaign_id, { flowbotId: req.params.id, triggerOn: req.body?.trigger_on || "reply", handoverRules: req.body?.handover_rules || null })
));
flowbotRouter.get("/:id/states", handle((req) =>
  dbh.query(`SELECT * FROM flowbot_conversation_states WHERE tenant_id = ? AND flowbot_id = ? ORDER BY updated_at DESC LIMIT 200`, [req.tenantId, Number(req.params.id)])
));

module.exports = { templateRouter, flowsRouter, providerRouter, flowbotRouter };
