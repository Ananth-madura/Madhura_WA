"use strict";

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext, requireBranchScope } = require("../middleware/tenantMiddleware");

const { createProviderGateway } = require("../services/campaign/providerGateway");
const { createConsentSuppressionService } = require("../services/campaign/consentSuppressionService");
const { createAudienceBuilderService } = require("../services/campaign/audienceBuilderService");
const { createTemplateManagementService } = require("../services/campaign/templateManagementService");
const { createCampaignApprovalService } = require("../services/campaign/campaignApprovalService");
const { createCampaignManagementService } = require("../services/campaign/campaignManagementService");
const { createCampaignExperimentService } = require("../services/campaign/campaignExperimentService");
const { createCampaignSchedulerService } = require("../services/campaign/campaignSchedulerService");
const { createCampaignExecutionEngine } = require("../services/campaign/campaignExecutionEngine");
const { createCampaignJourneyService } = require("../services/campaign/campaignJourneyService");
const { createCampaignAnalyticsService } = require("../services/campaign/campaignAnalyticsService");
const { createCampaignAuditService } = require("../services/campaign/campaignAuditService");
const { createDbHelper } = require("../services/campaign/dbHelper");

const gateway = createProviderGateway({ db });
const consentService = createConsentSuppressionService({ db });
const audienceService = createAudienceBuilderService({ db, consentService });
const templateService = createTemplateManagementService({ db, gateway });
const approvalService = createCampaignApprovalService({ db });
const managementService = createCampaignManagementService({ db, gateway, audienceService, templateService, approvalService });
const experimentService = createCampaignExperimentService({ db });
const schedulerService = createCampaignSchedulerService({ db });
const executionEngine = createCampaignExecutionEngine({ db, gateway, consentService, audienceService, templateService, managementService, experimentService });
const journeyService = createCampaignJourneyService({ db, consentService });
const analyticsService = createCampaignAnalyticsService({ db });
const auditService = createCampaignAuditService({ db });
const dbh = createDbHelper(db);

// Public tracked redirect link (no JWT required for customer clicks)
router.get("/track/:shortCode", async (req, res) => {
  try {
    const link = await analyticsService.recordLinkClick(req.params.shortCode);
    return res.redirect(302, link.destination_url);
  } catch (err) {
    return res.status(err.status || 404).json({ error: err.message });
  }
});

// All remaining routes require authenticated, fail-closed tenant context
router.use(verifyToken, requireTenantContext, requireBranchScope);

const handle = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.json(data);
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({ error: err.message || "Campaign operation failed", code: err.code || "CAMPAIGN_ERROR" });
  }
};

// ── Dashboard, Ecosystem Connectivity & Overview Analytics ──────────────────
router.get("/ecosystem-summary", handle(async (req) => {
  const tid = req.tenantId;
  const safeCount = async (sql, params = [tid]) => {
    try {
      const row = await dbh.queryOne(sql, params);
      return Number(row?.cnt || 0);
    } catch {
      return 0;
    }
  };
  const [
    totalCampaigns, runningCampaigns, pendingApprovals,
    totalGroups, totalSegments, totalContacts, grantedConsents, activeSuppressions,
    connectedSenders, onboardedMarketingWabas,
    totalTemplates, approvedTemplates,
    totalFlows, publishedFlows,
    totalFlowbots, activeHandovers,
    totalAutomations, automationBindings, activeJourneys, campaignEnquiries,
  ] = await Promise.all([
    safeCount("SELECT COUNT(*) AS cnt FROM campaigns WHERE tenant_id = ?"),
    safeCount("SELECT COUNT(*) AS cnt FROM campaigns WHERE tenant_id = ? AND status = 'RUNNING'"),
    safeCount("SELECT COUNT(*) AS cnt FROM campaign_approvals WHERE tenant_id = ? AND status = 'PENDING'"),
    safeCount("SELECT COUNT(*) AS cnt FROM wa_contact_groups WHERE tenant_id = ?"),
    safeCount("SELECT COUNT(*) AS cnt FROM campaign_segments WHERE tenant_id = ?"),
    safeCount("SELECT COUNT(*) AS cnt FROM wa_contacts WHERE tenant_id = ?"),
    safeCount("SELECT COUNT(*) AS cnt FROM contact_consents WHERE tenant_id = ? AND status = 'GRANTED'"),
    safeCount("SELECT COUNT(*) AS cnt FROM contact_suppressions WHERE tenant_id = ? AND is_active = 1"),
    safeCount("SELECT COUNT(*) AS cnt FROM wa_senders WHERE tenant_id = ? AND status = 'connected'"),
    safeCount("SELECT COUNT(*) AS cnt FROM waba_connections WHERE tenant_id = ? AND marketing_messages_onboarding_status IN ('ONBOARDED','ACTIVE')"),
    safeCount("SELECT COUNT(*) AS cnt FROM wa_templates WHERE tenant_id = ? AND (archived IS NULL OR archived = 0)"),
    safeCount("SELECT COUNT(*) AS cnt FROM wa_templates WHERE tenant_id = ? AND meta_status = 'APPROVED' AND (archived IS NULL OR archived = 0)"),
    safeCount("SELECT COUNT(*) AS cnt FROM whatsapp_flows WHERE tenant_id = ?"),
    safeCount("SELECT COUNT(*) AS cnt FROM whatsapp_flows WHERE tenant_id = ? AND meta_status = 'PUBLISHED'"),
    safeCount("SELECT COUNT(*) AS cnt FROM wa_flows WHERE tenant_id = ?"),
    safeCount("SELECT COUNT(*) AS cnt FROM flowbot_conversation_states WHERE tenant_id = ? AND handover_active = 1"),
    safeCount("SELECT COUNT(*) AS cnt FROM wa_automations WHERE tenant_id = ?"),
    safeCount("SELECT COUNT(*) AS cnt FROM campaign_automation_bindings WHERE tenant_id = ? AND is_active = 1"),
    safeCount("SELECT COUNT(*) AS cnt FROM campaign_journey_enrollments WHERE tenant_id = ? AND status = 'ACTIVE'"),
    safeCount("SELECT COUNT(*) AS cnt FROM wa_enquiries WHERE tenant_id = ? AND source = 'campaign_response'"),
  ]);

  return {
    campaigns: { total: totalCampaigns, running: runningCampaigns, pending_approvals: pendingApprovals },
    audiences: { groups: totalGroups, segments: totalSegments, contacts: totalContacts, granted_consents: grantedConsents, active_suppressions: activeSuppressions },
    senders: { connected: connectedSenders, marketing_api_onboarded: onboardedMarketingWabas },
    templates: { total: totalTemplates, approved: approvedTemplates },
    whatsapp_flows: { total: totalFlows, published: publishedFlows },
    flowbots: { total: totalFlowbots, active_handovers: activeHandovers },
    automations: { total: totalAutomations, bindings: automationBindings, active_journeys: activeJourneys },
    crm: { campaign_enquiries: campaignEnquiries },
    connected: true,
  };
}));
router.get("/native-assets", handle(async (req) => {
  const tid = req.tenantId;
  const safeQuery = async (sql, params = [tid]) => {
    try {
      return await dbh.query(sql, params);
    } catch {
      return [];
    }
  };
  const [groups, segments, templates, flowbots, automations, whatsappFlows, senders, limit] = await Promise.all([
    safeQuery(
      `SELECT g.id, g.name, g.description, g.created_at,
              (SELECT COUNT(*) FROM wa_group_contacts gc WHERE gc.group_id = g.id) AS contact_count
       FROM wa_contact_groups g WHERE g.tenant_id = ? ORDER BY g.created_at DESC LIMIT 200`
    ),
    audienceService.listSegments(tid).catch(() => []),
    templateService.listTemplates(tid).catch(() => []),
    safeQuery(`SELECT id, name, description, trigger_type, is_active, updated_at FROM wa_flows WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 200`),
    safeQuery(`SELECT id, name, trigger_type, template_id, flow_id, group_id, is_active, run_count FROM wa_automations WHERE tenant_id = ? ORDER BY id DESC LIMIT 200`),
    safeQuery(`SELECT id, meta_flow_id, name, category, flow_mode, meta_status FROM whatsapp_flows WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 200`),
    safeQuery(
      `SELECT s.id, s.phone_number_id, s.display_phone, s.verified_name, s.quality, s.messaging_tier, s.status, s.dispatch_paused,
              w.waba_id, w.status AS waba_status, w.marketing_messages_lite_api_status, w.marketing_messages_onboarding_status
       FROM wa_senders s
       JOIN waba_connections w ON w.id = s.waba_connection_id AND w.tenant_id = s.tenant_id
       WHERE s.tenant_id = ? ORDER BY s.id ASC`
    ),
    gateway.getMessagingLimit(tid).catch(() => null),
  ]);

  return {
    groups,
    segments,
    templates,
    flowbots,
    automations,
    whatsapp_flows: whatsappFlows,
    senders,
    shared_messaging_limit: limit,
  };
}));

router.get("/analytics/overview", handle((req) => analyticsService.getDashboardOverview(req.tenantId, req.query)));
router.get("/calendar", handle((req) => schedulerService.getCalendarEvents(req.tenantId, req.query)));

// ── Settings & Governance ───────────────────────────────────────────────────
router.get("/settings", handle((req) => schedulerService.getSettings(req.tenantId, req.branchId || null)));
router.put("/settings", handle((req) => schedulerService.saveSettings(req.tenantId, { ...req.body, workspace_id: req.branchId || req.body?.workspace_id || null })));
router.get("/audit", handle((req) => auditService.listLogs(req.tenantId, { campaignId: req.query.campaign_id, entityType: req.query.entity_type, limit: req.query.limit })));

// ── Agency Clients ──────────────────────────────────────────────────────────
router.get("/agency/clients", handle((req) => managementService.listAgencyClients(req.tenantId)));
router.post("/agency/clients", handle((req) => managementService.linkAgencyClient(req.tenantId, req.body, req.user?.id)));

// ── Approval Queue & Rules ──────────────────────────────────────────────────
router.get("/approvals", handle((req) => approvalService.listApprovalQueue(req.tenantId, { status: req.query.status || "PENDING" })));
router.post("/approvals/rules", handle((req) => approvalService.createRule(req.tenantId, req.body, req.user?.id)));

// ── Custom Reports ──────────────────────────────────────────────────────────
router.get("/reports", handle((req) => analyticsService.listCustomReports(req.tenantId)));
router.post("/reports", handle((req) => analyticsService.createCustomReport(req.tenantId, req.body, req.user?.id)));

// ── Audiences, Segments & Imports ───────────────────────────────────────────
router.get("/audiences/presets", handle(async () => ({ presets: audienceService.SEGMENT_PRESETS })));
router.get("/audiences", handle((req) => audienceService.listSegments(req.tenantId, req.query)));
router.post("/audiences", handle(async (req, res) => {
  const seg = await audienceService.createSegment(req.tenantId, req.body, req.user?.id);
  res.status(201).json(seg);
}));
router.post("/audiences/estimate-live", handle((req) => audienceService.evaluateAudience(req.tenantId, req.body?.definition || {}, { category: req.body?.category || "MARKETING" })));
router.post("/audiences/import", handle(async (req, res) => {
  const result = await audienceService.processImport(req.tenantId, req.body, req.user?.id);
  res.status(201).json(result);
}));
router.get("/audiences/imports", handle((req) => audienceService.listImports(req.tenantId, req.query.limit)));
router.get("/audiences/import/:importId", handle((req) => audienceService.getImportReport(req.tenantId, req.params.importId)));
router.get("/audiences/:id", handle((req) => audienceService.getSegment(req.tenantId, req.params.id)));
router.patch("/audiences/:id", handle((req) => audienceService.updateSegment(req.tenantId, req.params.id, req.body, req.user?.id)));
router.post("/audiences/:id/estimate", handle((req) => audienceService.estimateSegment(req.tenantId, req.params.id, req.body || {})));
router.post("/audiences/:id/preview", handle((req) => audienceService.estimateSegment(req.tenantId, req.params.id, { ...(req.body || {}), sampleLimit: 50 })));

// ── Consent & Suppression Center ────────────────────────────────────────────
router.get("/consent", handle((req) => consentService.listConsents(req.tenantId, req.query)));
router.post("/consent", handle(async (req, res) => {
  const record = await consentService.recordConsent(req.tenantId, req.body, req.user?.id);
  res.status(201).json(record);
}));
router.post("/consent/revoke", handle((req) => consentService.revokeConsent(req.tenantId, req.body, req.user?.id)));
router.post("/consent/check", handle((req) => consentService.checkConsent(req.tenantId, req.body?.phone, req.body || {})));
router.post("/consent/preferences", handle((req) => consentService.upsertPreferences(req.tenantId, req.body?.phone, req.body, req.user?.id)));
router.get("/suppressions", handle((req) => consentService.listSuppressions(req.tenantId, { activeOnly: req.query.active !== "false", scope: req.query.scope, search: req.query.search })));
router.post("/suppressions", handle(async (req, res) => {
  const sup = await consentService.addSuppression(req.tenantId, req.body, req.user?.id);
  res.status(201).json(sup);
}));
router.delete("/suppressions/:id", handle((req) => consentService.removeSuppression(req.tenantId, req.params.id, req.user?.id)));

// ── E-Commerce Event Triggers & Verified Conversions ────────────────────────
router.post("/ecommerce/events", handle((req) => journeyService.ingestEcommerceEvent(req.tenantId, req.body)));
router.post("/conversions", handle((req) => analyticsService.recordVerifiedConversion(req.tenantId, req.body)));

// ── Campaigns CRUD & Full Lifecycle ─────────────────────────────────────────
router.get("/", handle((req) => managementService.listCampaigns(req.tenantId, req.query)));
router.post("/", handle(async (req, res) => {
  const camp = await managementService.createCampaign(req.tenantId, { ...req.body, branch_id: req.branchId || req.body?.branch_id || null }, req.user?.id);
  res.status(201).json(camp);
}));
router.get("/:id", handle((req) => managementService.getCampaign(req.tenantId, req.params.id)));
router.patch("/:id", handle((req) => managementService.updateCampaign(req.tenantId, req.params.id, req.body, req.user?.id)));
router.delete("/:id", handle((req) => managementService.deleteDraftCampaign(req.tenantId, req.params.id, req.user?.id)));
router.post("/:id/duplicate", handle(async (req, res) => {
  const copy = await managementService.duplicateCampaign(req.tenantId, req.params.id, req.user?.id);
  res.status(201).json(copy);
}));

router.post("/:id/validate", handle((req) => managementService.validateAndPreview(req.tenantId, req.params.id, req.user?.id)));
router.post("/:id/preview", handle((req) => managementService.validateAndPreview(req.tenantId, req.params.id, req.user?.id)));
router.post("/:id/audience/preview", handle((req) => managementService.validateAndPreview(req.tenantId, req.params.id, req.user?.id)));
router.post("/:id/test-send", handle((req) => executionEngine.sendTestMessage(req.tenantId, req.params.id, req.body, req.user?.id)));

// Approvals
router.post("/:id/submit-approval", handle((req) => approvalService.submitForApproval(req.tenantId, req.params.id, req.user?.id, req.body || {})));
router.post("/:id/approve", handle((req) => approvalService.decideApproval(req.tenantId, req.params.id, { action: "APPROVE", actorId: req.user?.id, actorRole: req.userRole, reason: req.body?.reason })));
router.post("/:id/reject", handle((req) => approvalService.decideApproval(req.tenantId, req.params.id, { action: "REJECT", actorId: req.user?.id, actorRole: req.userRole, reason: req.body?.reason })));
router.post("/:id/request-changes", handle((req) => approvalService.decideApproval(req.tenantId, req.params.id, { action: "REQUEST_CHANGES", actorId: req.user?.id, actorRole: req.userRole, reason: req.body?.reason })));
router.post("/:id/withdraw-approval", handle((req) => approvalService.decideApproval(req.tenantId, req.params.id, { action: "WITHDRAW", actorId: req.user?.id, actorRole: req.userRole, reason: req.body?.reason })));

// Scheduling & Execution Controls
router.post("/:id/schedule", handle((req) => schedulerService.scheduleCampaign(req.tenantId, req.params.id, req.body, req.user?.id)));
router.post("/:id/launch", handle((req) => executionEngine.launchCampaign(req.tenantId, req.params.id, req.user?.id, { syncDispatch: Boolean(req.body?.sync_dispatch) })));
router.post("/:id/dispatch-batch", handle((req) => executionEngine.processCampaignBatch(req.tenantId, req.params.id, { limit: req.body?.limit || 100 })));
router.post("/:id/pause", handle((req) => executionEngine.pauseCampaign(req.tenantId, req.params.id, req.body?.reason || "Paused by operator", req.user?.id)));
router.post("/:id/resume", handle((req) => executionEngine.resumeCampaign(req.tenantId, req.params.id, req.user?.id, { syncDispatch: Boolean(req.body?.sync_dispatch) })));
router.post("/:id/cancel", handle((req) => executionEngine.cancelCampaign(req.tenantId, req.params.id, req.body?.reason || "Cancelled by operator", req.user?.id)));
router.post("/:id/retry-failed", handle((req) => executionEngine.retryFailedJobs(req.tenantId, req.params.id, req.user?.id)));

// Recipients, Exclusions & Execution Trace
router.get("/:id/recipients", handle(async (req) => {
  const status = req.query.status ? String(req.query.status).toUpperCase() : null;
  const clauses = ["tenant_id = ?", "campaign_id = ?"];
  const params = [req.tenantId, Number(req.params.id)];
  if (status && status !== "ALL") { clauses.push("status = ?"); params.push(status); }
  params.push(Math.min(500, Number(req.query.limit) || 100), Math.max(0, Number(req.query.offset) || 0));
  return dbh.query(`SELECT * FROM campaign_recipients WHERE ${clauses.join(" AND ")} ORDER BY id DESC LIMIT ? OFFSET ?`, params);
}));

router.get("/:id/exclusions", handle((req) =>
  dbh.query(`SELECT * FROM campaign_recipient_exclusions WHERE tenant_id = ? AND campaign_id = ? ORDER BY id DESC LIMIT 500`, [req.tenantId, Number(req.params.id)])
));

router.get("/:id/execution", handle(async (req) => {
  const [executions, jobs, attempts] = await Promise.all([
    dbh.query(`SELECT * FROM campaign_executions WHERE tenant_id = ? AND campaign_id = ? ORDER BY id DESC LIMIT 20`, [req.tenantId, Number(req.params.id)]),
    dbh.query(`SELECT status, queue_name, COUNT(*) AS count FROM campaign_jobs WHERE tenant_id = ? AND campaign_id = ? GROUP BY status, queue_name`, [req.tenantId, Number(req.params.id)]),
    dbh.query(`SELECT id, recipient_id, attempt_number, provider_route, response_status, wamid, outcome, error_class, error_code, error_message, latency_ms, created_at FROM campaign_message_attempts WHERE tenant_id = ? AND campaign_id = ? ORDER BY id DESC LIMIT 100`, [req.tenantId, Number(req.params.id)]),
  ]);
  return { executions, jobs_summary: jobs, recent_attempts: attempts };
}));

// Campaign Automation, Flowbot, Experiments, Analytics & Attribution
router.get("/:id/automation", handle((req) => journeyService.listAutomationBindings(req.tenantId, req.params.id)));
router.post("/:id/automation", handle((req) => journeyService.createAutomationBinding(req.tenantId, req.params.id, req.body, req.user?.id)));
router.post("/:id/flowbot", handle((req) => journeyService.bindFlowbot(req.tenantId, req.params.id, req.body)));
router.get("/:id/analytics", handle((req) => analyticsService.getCampaignAnalytics(req.tenantId, req.params.id)));
router.get("/:id/attribution", handle((req) =>
  dbh.query(`SELECT a.*, c.conversion_type, c.revenue_minor, c.currency, c.verified FROM campaign_attributions a LEFT JOIN campaign_conversions c ON c.attribution_id = a.id WHERE a.tenant_id = ? AND a.campaign_id = ? ORDER BY a.attributed_at DESC LIMIT 200`, [req.tenantId, Number(req.params.id)])
));
router.post("/:id/tracked-links", handle((req) => analyticsService.createTrackedLink(req.tenantId, { campaignId: req.params.id, recipientId: req.body?.recipient_id, destinationUrl: req.body?.destination_url, utm: req.body?.utm })));
router.get("/:id/experiments", handle((req) => experimentService.getExperimentReport(req.tenantId, req.params.id)));
router.post("/:id/experiments", handle((req) => experimentService.createExperiment(req.tenantId, req.params.id, req.body)));

module.exports = router;
