"use strict";

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext, requireBranchScope } = require("../middleware/tenantMiddleware");

const { createRetargetingService } = require("../services/campaign/watiUpgrade/retargetingService");
const { createDripSequenceService } = require("../services/campaign/watiUpgrade/dripSequenceService");
const { createFailureRecoveryService } = require("../services/campaign/watiUpgrade/failureRecoveryService");
const { createTemplateHealthService } = require("../services/campaign/watiUpgrade/templateHealthService");
const { createAiCampaignAssistantService } = require("../services/campaign/watiUpgrade/aiCampaignAssistantService");
const { createGuidedSetupAndAnalyticsService } = require("../services/campaign/watiUpgrade/guidedSetupAndAnalyticsService");

const retargetingService = createRetargetingService({ db });
const dripSequenceService = createDripSequenceService({ db });
const failureRecoveryService = createFailureRecoveryService({ db });
const templateHealthService = createTemplateHealthService({ db });
const aiAssistantService = createAiCampaignAssistantService({ db, templateHealth: templateHealthService });
const guidedAndAnalyticsService = createGuidedSetupAndAnalyticsService({ db });

router.use(verifyToken, requireTenantContext, requireBranchScope);

const handle = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.json(data);
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({
      error: err.message || "Campaign upgrade operation failed",
      code: err.code || "CAMPAIGN_UPGRADE_ERROR",
    });
  }
};

// 1. Guided First-Campaign Readiness Assistant
router.get("/get-started/status", handle((req) =>
  guidedAndAnalyticsService.getGuidedOnboardingStatus(req.tenantId)
));

router.post("/get-started/watch-approval", handle((req) =>
  guidedAndAnalyticsService.registerPendingApprovalWatch(
    req.tenantId,
    {
      campaignId: req.body?.campaign_id ?? req.body?.campaignId,
      templateId: req.body?.template_id ?? req.body?.templateId,
      autoLaunchEnabled: Boolean(req.body?.auto_launch_enabled ?? req.body?.autoLaunchEnabled),
    },
    req.user?.id || null
  )
));

router.post("/get-started/evaluate-pending", handle((req) =>
  guidedAndAnalyticsService.evaluatePendingAutoLaunches(req.tenantId, {
    syncDispatch: Boolean(req.body?.sync_dispatch),
  })
));

// 2. Smart Behavioral Retargeting Engine
router.get("/retargeting/overview", handle((req) =>
  retargetingService.listRetargetingRules(req.tenantId)
));

router.post("/retargeting/preview", handle((req) =>
  retargetingService.computeEngagementAudience(
    req.tenantId,
    req.body?.source_campaign_id,
    req.body?.engagement_segment,
    {
      category: req.body?.category || "MARKETING",
      workspaceId: req.body?.workspace_id || null,
      enforceAntiRepeat: req.body?.enforce_anti_repeat !== false,
    }
  )
));

router.post("/retargeting/create-campaign", handle((req) =>
  retargetingService.createRetargetingCampaign(req.tenantId, req.body || {}, req.user?.id || null)
));

router.post("/retargeting/rules", handle((req) =>
  retargetingService.createRetargetingRule(req.tenantId, req.body || {}, req.user?.id || null)
));

// 3. Multi-Step Drip Sequences
router.get("/sequences", handle((req) =>
  dripSequenceService.listSequences(req.tenantId)
));

router.post("/sequences", handle((req) =>
  dripSequenceService.createSequence(req.tenantId, req.body || {}, req.user?.id || null)
));

router.get("/sequences/:id", handle((req) =>
  dripSequenceService.getSequence(req.tenantId, req.params.id)
));

router.patch("/sequences/:id/status", handle((req) =>
  dripSequenceService.setSequenceStatus(req.tenantId, req.params.id, req.body?.status)
));

router.post("/sequences/:id/duplicate", handle((req) =>
  dripSequenceService.duplicateSequence(req.tenantId, req.params.id, req.user?.id || null)
));

router.post("/sequences/:id/enroll", handle((req) =>
  dripSequenceService.enrollContacts(
    req.tenantId,
    req.params.id,
    Array.isArray(req.body?.contacts) ? req.body.contacts : [],
    { startImmediately: req.body?.start_immediately !== false }
  )
));

router.post("/sequences/stop-event", handle((req) =>
  dripSequenceService.handleStopEvent(req.tenantId, req.body?.phone, req.body?.event_type, {
    revenueMinor: Number(req.body?.revenue_minor || 0),
  })
));

router.post("/sequences/process-due", handle(() =>
  dripSequenceService.processDueEnrollments()
));

// 4. Advanced Campaign Analytics (7-stage funnel, hourly/daily/weekly/monthly trends, failure breakdown)
router.get("/analytics/advanced", handle((req) =>
  guidedAndAnalyticsService.getAdvancedAnalytics(req.tenantId, {
    granularity: req.query?.granularity || "daily",
    category: req.query?.category || null,
    senderId: req.query?.sender_id || null,
    countryCode: req.query?.country_code || null,
    dateFrom: req.query?.date_from || null,
    dateTo: req.query?.date_to || null,
  })
));

// 5. Smart Failure Recovery, Meta Template Pacing, Auto-Retry & Optional Fallback Channels
router.get("/recovery/failed-report", handle((req) =>
  failureRecoveryService.getFailedRecipientsReport(req.tenantId, req.query || {})
));

router.get("/recovery/retry-policies", handle((req) =>
  failureRecoveryService.listRetryPolicies(req.tenantId)
));

router.post("/recovery/retry-policies", handle((req) =>
  failureRecoveryService.saveRetryPolicy(req.tenantId, req.body || {}, req.user?.id || null)
));

router.post("/recovery/retry-transient/:campaignId", handle((req) =>
  failureRecoveryService.retryEligibleTransientFailures(req.tenantId, req.params.campaignId, {
    policyId: req.body?.policy_id || null,
  })
));

router.post("/recovery/pacing-incident", handle((req) =>
  failureRecoveryService.handleTemplatePacingDetected(req.tenantId, {
    campaignId: req.body?.campaign_id ?? req.body?.campaignId,
    templateId: req.body?.template_id ?? req.body?.templateId ?? null,
    errorCode: req.body?.error_code || "132015",
    errorMessage: req.body?.error_message || "Meta template pacing or quality pause",
  })
));

router.post("/recovery/pacing-incident/:id/recover", handle((req) =>
  failureRecoveryService.recoverWithReplacementTemplate(
    req.tenantId,
    req.params.id,
    { replacementTemplateId: req.body?.replacement_template_id ?? req.body?.replacementTemplateId },
    req.user?.id || null
  )
));

router.get("/recovery/fallback", handle((req) =>
  failureRecoveryService.listFallbackOverview(req.tenantId)
));

router.post("/recovery/fallback/channels", handle((req) =>
  failureRecoveryService.configureFallbackChannel(req.tenantId, req.body || {}, req.user?.id || null)
));

router.post("/recovery/fallback/dispatch", handle((req) =>
  failureRecoveryService.dispatchFallbackForRecipient(req.tenantId, {
    campaignId: req.body?.campaign_id ?? req.body?.campaignId,
    recipientId: req.body?.recipient_id ?? req.body?.recipientId,
    channel: req.body?.channel,
    messageText: req.body?.message_text ?? req.body?.messageText ?? "",
    destination: req.body?.destination || null,
  })
));

// 6. Template Health Center
router.get("/template-health", handle((req) =>
  templateHealthService.getTemplateHealthOverview(req.tenantId)
));

router.post("/template-health/:id/duplicate", handle((req) =>
  templateHealthService.duplicateTemplate(req.tenantId, req.params.id)
));

router.post("/template-health/replace-in-drafts", handle((req) =>
  templateHealthService.replaceTemplateInDraftCampaigns(
    req.tenantId,
    req.body?.old_template_id,
    req.body?.new_template_id
  )
));

router.post("/template-health/suggest-improvements", handle((req) =>
  templateHealthService.suggestTemplateImprovements(req.body || {})
));

// 7. AI Campaign Assistant
router.post("/ai-assistant/propose-campaign", handle((req) =>
  aiAssistantService.proposeCampaignBlueprint(req.tenantId, req.body?.prompt || "")
));

router.post("/ai-assistant/propose-audience", handle((req) =>
  aiAssistantService.proposeAudienceSegmentDraft(req.body?.prompt || "")
));

router.post("/ai-assistant/evaluate-template", handle((req) =>
  aiAssistantService.evaluateTemplateQuality(req.body || {})
));

router.post("/ai-assistant/ask", handle((req) =>
  aiAssistantService.answerPerformanceQuestion(req.tenantId, req.body?.question || "", {
    dateFrom: req.body?.date_from || null,
    dateTo: req.body?.date_to || null,
  })
));

router.get("/ai-assistant/recommendations", handle((req) =>
  aiAssistantService.getNextBestActions(req.tenantId)
));

module.exports = router;
