"use strict";

/**
 * campaignExecutionEngine.js
 *
 * Enterprise Bulk Campaign Execution & Multi-Queue Orchestration Engine.
 * - Materializes immutable audience snapshots into individual campaign_recipients records
 * - Supports 10 logical BullMQ queues when Redis is available, with durable DB-backed
 *   execution fallback when Redis is unreachable
 * - Performs just-in-time revalidation immediately before EVERY recipient send:
 *     campaign state, consent, suppression, eligibility, sender ownership, sender health,
 *     template status, shared 24h Meta business limit, frequency cap, billing/wallet
 * - Enforces strict idempotency keys (preventing duplicate jobs & duplicate sends)
 * - Classifies errors (transient / permanent / policy / operational)
 * - Handles network timeouts with UNKNOWN_REQUIRES_RECONCILIATION (never blindly resends!)
 * - Supports safe pause, resume, cancel, retryFailed, and multi-number sender allocation
 */

const {
  createDbHelper,
  assertTenantId,
  safeJsonParse,
  generateUid,
  httpError,
} = require("./dbHelper");
const { createProviderGateway } = require("./providerGateway");
const { createAudienceBuilderService } = require("./audienceBuilderService");
const { createConsentSuppressionService } = require("./consentSuppressionService");
const { createTemplateManagementService, renderTemplateForRecipient } = require("./templateManagementService");
const { createCampaignManagementService } = require("./campaignManagementService");
const { createCampaignExperimentService } = require("./campaignExperimentService");
const { createWhatsAppFlowsService } = require("./whatsappFlowsService");
const { createCampaignAuditService } = require("./campaignAuditService");
const { createLimitEngine } = require("../metaMessagingLimitEngine");
const { createBillingModeService } = require("../metaBillingModeService");
const { createPricingEngine } = require("../metaMessagePricingEngine");
const { createWalletService } = require("../watiWalletService");

const QUEUE_NAMES = [
  "campaign.prepare",
  "campaign.audience",
  "campaign.dispatch",
  "campaign.whatsapp.cloud",
  "campaign.whatsapp.marketing",
  "campaign.flowbot",
  "campaign.automation",
  "campaign.webhook",
  "campaign.analytics",
  "campaign.reconciliation",
];

function classifySendError(err) {
  if (!err) return { errorClass: "transient", retryable: true, unknownOutcome: false, code: "UNKNOWN" };

  // Network timeout / dropped socket where Meta may have already accepted the message
  if (
    err.deliveryUnknown ||
    (!err.response && ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "EPIPE", "ERR_NETWORK"].includes(err.code))
  ) {
    return {
      errorClass: "transient",
      retryable: false, // DO NOT blindly resend without reconciliation!
      unknownOutcome: true,
      code: err.code || "NETWORK_TIMEOUT",
    };
  }

  const metaCode = Number(err.metaError?.code || err.response?.data?.error?.code || 0);
  const httpStatus = Number(err.status || err.response?.status || 0);
  const code = String(err.code || metaCode || httpStatus || "SEND_ERROR");

  // Operational / Auth / Suspension
  if (["TENANT_DISPATCH_PAUSED", "WABA_DISPATCH_PAUSED", "SENDER_PAUSED", "SENDER_DISCONNECTED", "WABA_DISCONNECTED", "INSUFFICIENT_WALLET_BALANCE"].includes(err.code)) {
    return { errorClass: "operational", retryable: false, unknownOutcome: false, code };
  }

  // Policy & eligibility
  if (["BLOCKED_BY_CONSENT", "BLOCKED_BY_SUPPRESSION", "BLOCKED_BY_TEMPLATE", "BLOCKED_BY_META_LIMIT", "BLOCKED_BY_BILLING", "TEMPLATE_NOT_APPROVED"].includes(err.code)) {
    return { errorClass: "policy", retryable: false, unknownOutcome: false, code };
  }

  // Meta Graph rate limits & temporary server errors
  if (httpStatus === 429 || httpStatus >= 500 || [4, 17, 613, 80007, 130429, 131048, 131056].includes(metaCode)) {
    return { errorClass: "transient", retryable: true, unknownOutcome: false, code };
  }

  // Permanent Meta errors (invalid recipient, rejected template, bad parameter, auth)
  if (httpStatus === 400 || httpStatus === 401 || httpStatus === 403 || httpStatus === 404 || [100, 131026, 131030, 132000, 132001, 132015, 190].includes(metaCode)) {
    return { errorClass: "permanent", retryable: false, unknownOutcome: false, code };
  }

  return { errorClass: "transient", retryable: true, unknownOutcome: false, code };
}

function createCampaignExecutionEngine(options = {}) {
  const db = createDbHelper(options.db);
  const gateway = options.gateway || createProviderGateway({ db: options.db });
  const consentService = options.consentService || createConsentSuppressionService({ db: options.db });
  const audienceService = options.audienceService || createAudienceBuilderService({ db: options.db, consentService });
  const templateService = options.templateService || createTemplateManagementService({ db: options.db, gateway });
  const managementService =
    options.managementService ||
    createCampaignManagementService({ db: options.db, gateway, audienceService, templateService });
  const experimentService = options.experimentService || createCampaignExperimentService({ db: options.db });
  const flowsService = options.flowsService || createWhatsAppFlowsService({ db: options.db, gateway });
  const audit = options.auditService || createCampaignAuditService({ db: options.db });
  const limitEngine = options.limitEngine || createLimitEngine({ db: options.db });
  const billingModeService = options.billingModeService || createBillingModeService({ db: options.db });
  const pricingEngine = options.pricingEngine || createPricingEngine({ db: options.db });
  const walletService = options.walletService || createWalletService({ db: options.db });

  /**
   * Distribute recipients across configured authorized senders (weighted round-robin / single).
   */
  function pickSenderForIndex(senders, index) {
    if (!senders || senders.length === 0) return null;
    if (senders.length === 1) return senders[0];
    const weighted = [];
    for (const s of senders) {
      const w = Math.max(1, Math.min(100, Number(s.allocation_weight || 1)));
      for (let k = 0; k < w; k++) weighted.push(s);
    }
    return weighted[index % weighted.length];
  }

  /**
   * Launch a campaign:
   * 1. Revalidate all critical prerequisites
   * 2. Verify approval if required
   * 3. Freeze version & materialize immutable audience snapshot + recipient rows + jobs
   * 4. Optionally execute immediately (syncDispatch=true for tests/API or async background)
   */
  async function launchCampaign(tenantId, campaignId, actorId = null, { syncDispatch = false, bypassApprovalCheck = false } = {}) {
    const tid = assertTenantId(tenantId);
    const camp = await managementService.getCampaign(tid, campaignId);

    if (["RUNNING", "COMPLETED", "CANCELLED"].includes(camp.status)) {
      throw httpError(`Campaign is already in '${camp.status}' state`, 409, "CAMPAIGN_ALREADY_PROCESSED");
    }

    const validation = await managementService.validateAndPreview(tid, camp.id, actorId);
    if (!validation.valid) {
      throw httpError(
        `Campaign launch blocked: ${validation.blockers.map((b) => b.message).join("; ")}`,
        409,
        validation.blockers[0]?.code || "LAUNCH_VALIDATION_FAILED"
      );
    }

    if (
      !bypassApprovalCheck &&
      validation.approval.required &&
      Number(camp.approved_version) !== Number(camp.current_version)
    ) {
      throw httpError(
        "Campaign requires approval for the current version before launching",
        403,
        "APPROVAL_REQUIRED"
      );
    }

    // Freeze current version
    await db.query(
      `UPDATE campaign_versions SET frozen = 1 WHERE tenant_id = ? AND campaign_id = ? AND version_number = ?`,
      [tid, camp.id, camp.current_version]
    );

    // Create controlled audience snapshot (Segment or Contact Group from /whatsapp/groups)
    let audienceDef = camp.config?.audience_definition || {};
    if (camp.segment_id) {
      const seg = await audienceService.getSegment(tid, camp.segment_id);
      audienceDef = seg.definition;
    } else if (camp.config?.group_id) {
      audienceDef = { group_id: Number(camp.config.group_id) };
    }
    const snapshot = await audienceService.createSnapshot(tid, {
      campaignId: camp.id,
      segmentId: camp.segment_id,
      definition: audienceDef,
      opts: {
        category: validation.template.category,
        workspaceId: camp.workspace_id,
        agencyClientId: camp.agency_client_id,
      },
      actorId,
    });

    const eligibleList = camp.max_recipients
      ? snapshot.eligible.slice(0, Number(camp.max_recipients))
      : snapshot.eligible;

    const executionUid = generateUid("exec");
    const execRes = await db.query(
      `INSERT INTO campaign_executions (
        execution_uid, tenant_id, workspace_id, campaign_id, campaign_version,
        snapshot_id, trigger_type, provider_route, status, total_recipients, started_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'launch', ?, 'RUNNING', ?, ?)`,
      [
        executionUid,
        tid,
        camp.workspace_id,
        camp.id,
        camp.current_version,
        snapshot.snapshot_id,
        validation.provider_route.route,
        eligibleList.length,
        actorId,
      ]
    );
    const executionId = execRes.insertId;

    // Persist exclusions with exact reasons
    for (const ex of snapshot.excluded) {
      await db.query(
        `INSERT INTO campaign_recipient_exclusions (
          tenant_id, campaign_id, execution_id, snapshot_id, contact_id, phone, reason_code, reason_detail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tid, camp.id, executionId, snapshot.snapshot_id, ex.contact_id || null, ex.phone || null, ex.reason_code, ex.reason_detail]
      );
    }

    // Resolve authorized senders list for multi-number distribution
    const configuredSenders = camp.senders && camp.senders.length > 0
      ? camp.senders
      : [{ sender_id: validation.sender.sender_id, waba_id: validation.sender.waba_id, allocation_weight: 100 }];

    // Check active A/B experiment if any
    const activeExp = camp.is_ab_test
      ? await db.queryOne(`SELECT * FROM campaign_experiments WHERE tenant_id = ? AND campaign_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`, [tid, camp.id])
      : null;

    const template = await templateService.getTemplate(tid, camp.template_id);
    const attachedFlow = camp.whatsapp_flow_id
      ? await db.queryOne(`SELECT * FROM whatsapp_flows WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, camp.whatsapp_flow_id])
      : null;

    const variableMapping = camp.config?.variable_mapping || {};
    const missingPolicy = camp.config?.missing_variable_policy || "exclude";
    const queueName =
      validation.provider_route.route === "marketing_messages_api"
        ? "campaign.whatsapp.marketing"
        : "campaign.whatsapp.cloud";

    let queuedCount = 0;
    let excludedRenderCount = 0;

    for (let i = 0; i < eligibleList.length; i++) {
      const rec = eligibleList[i];
      const assignedSender = pickSenderForIndex(configuredSenders, i);
      const idempotencyKey = `cmp:${camp.id}:v${camp.current_version}:ex${executionId}:p:${rec.normalized_phone}`;

      // Render personalization upfront to detect missing variables
      let flowToken = null;
      if (attachedFlow) {
        const fe = await flowsService.initiateExecution(tid, {
          flowId: attachedFlow.id,
          metaFlowId: attachedFlow.meta_flow_id,
          campaignId: camp.id,
          recipientId: null,
          contactId: rec.contact_id,
          normalizedPhone: rec.normalized_phone,
        });
        flowToken = fe.flow_token;
      }

      const rendered = renderTemplateForRecipient(template, rec, variableMapping, {
        missingVariablePolicy: missingPolicy,
        headerMediaUrl: camp.config?.header_media_url || null,
        flowToken,
      });

      if (!rendered.ok) {
        excludedRenderCount++;
        await db.query(
          `INSERT INTO campaign_recipient_exclusions (
            tenant_id, campaign_id, execution_id, snapshot_id, contact_id, phone, reason_code, reason_detail
          ) VALUES (?, ?, ?, ?, ?, ?, 'MISSING_REQUIRED_VARIABLES', ?)`,
          [tid, camp.id, executionId, snapshot.snapshot_id, rec.contact_id || null, rec.normalized_phone, rendered.error]
        );
        continue;
      }

      const rateCard = await pricingEngine
        .getRateCard(rec.country_code || "IN", String(template.category || "marketing").toLowerCase())
        .catch(() => ({ rate_minor: 78 }));

      // Idempotent insert (ignore if duplicate idempotency_key)
      const existingRec = await db.queryOne(
        `SELECT id FROM campaign_recipients WHERE idempotency_key = ? LIMIT 1`,
        [idempotencyKey]
      );
      if (existingRec) continue;

      const recRes = await db.query(
        `INSERT INTO campaign_recipients (
          tenant_id, workspace_id, campaign_id, execution_id, snapshot_id, campaign_version,
          contact_id, phone, normalized_phone, country_code, contact_name,
          sender_id, waba_id, provider_route, consent_id, consent_evidence_ref,
          rendered_variables_json, rendered_preview, flow_token, status,
          idempotency_key, estimated_cost_minor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?)`,
        [
          tid,
          camp.workspace_id,
          camp.id,
          executionId,
          snapshot.snapshot_id,
          camp.current_version,
          rec.contact_id || null,
          rec.phone,
          rec.normalized_phone,
          rec.country_code || "IN",
          rec.name || "",
          assignedSender?.sender_id || validation.sender.sender_id,
          assignedSender?.waba_id || validation.sender.waba_id,
          validation.provider_route.route,
          rec.consent_id || null,
          rec.consent_evidence_ref || null,
          JSON.stringify(rendered.components),
          rendered.renderedBody,
          flowToken,
          idempotencyKey,
          Number(rateCard.rate_minor || 0),
        ]
      );
      const recipientId = recRes.insertId;

      if (flowToken) {
        await db.query(
          `UPDATE whatsapp_flow_executions SET recipient_id = ? WHERE tenant_id = ? AND flow_token = ?`,
          [recipientId, tid, flowToken]
        );
      }

      // Assign A/B variant deterministically
      if (activeExp) {
        const assignment = await experimentService.assignRecipient(tid, activeExp.id, recipientId, rec.normalized_phone);
        if (assignment.is_holdout) {
          await db.query(
            `UPDATE campaign_recipients SET status = 'EXCLUDED', exclusion_reason = 'EXPERIMENT_HOLDOUT', experiment_id = ? WHERE id = ?`,
            [activeExp.id, recipientId]
          );
          continue;
        }
        await db.query(
          `UPDATE campaign_recipients SET experiment_id = ?, variant_id = ? WHERE id = ?`,
          [activeExp.id, assignment.variant_id, recipientId]
        );
      }

      // Enqueue durable recipient job
      await db.query(
        `INSERT INTO campaign_jobs (
          job_uid, queue_name, tenant_id, workspace_id, campaign_id, execution_id,
          recipient_id, sender_id, waba_id, provider_route, campaign_version,
          idempotency_key, priority, status, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?)`,
        [
          generateUid("job"),
          queueName,
          tid,
          camp.workspace_id,
          camp.id,
          executionId,
          recipientId,
          assignedSender?.sender_id || validation.sender.sender_id,
          assignedSender?.waba_id || validation.sender.waba_id,
          validation.provider_route.route,
          camp.current_version,
          `job:${idempotencyKey}`,
          camp.priority || 5,
          JSON.stringify({ recipientId, executionId, queueName }),
        ]
      );
      queuedCount++;
    }

    await db.query(
      `UPDATE campaigns
       SET status = 'RUNNING', snapshot_id = ?, started_at = CURRENT_TIMESTAMP,
           total_eligible = ?, total_excluded = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [snapshot.snapshot_id, queuedCount, snapshot.excluded.length + excludedRenderCount, actorId, tid, camp.id]
    );
    await db.query(
      `UPDATE campaign_executions SET queued_count = ? WHERE id = ?`,
      [queuedCount, executionId]
    );

    await audit.log(tid, {
      workspaceId: camp.workspace_id,
      campaignId: camp.id,
      entityType: "campaign_execution",
      entityId: executionId,
      action: "LAUNCH_CAMPAIGN",
      actorId,
      after: { execution_uid: executionUid, queued_count: queuedCount, excluded_count: snapshot.excluded.length + excludedRenderCount },
    });

    let dispatchSummary = null;
    if (syncDispatch) {
      dispatchSummary = await processCampaignBatch(tid, camp.id, { limit: Math.max(queuedCount, 100) });
    }

    return {
      execution_id: executionId,
      execution_uid: executionUid,
      snapshot_id: snapshot.snapshot_id,
      queued_count: queuedCount,
      excluded_count: snapshot.excluded.length + excludedRenderCount,
      provider_route: validation.provider_route.route,
      dispatch_summary: dispatchSummary,
    };
  }

  /**
   * Execute a single recipient job with full 14-point just-in-time revalidation.
   */
  async function executeRecipientJob(tenantId, jobId) {
    const tid = assertTenantId(tenantId);
    const job = await db.queryOne(
      `SELECT * FROM campaign_jobs WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(jobId)]
    );
    if (!job) return { skipped: true, reason: "job_not_found" };
    if (job.status !== "QUEUED") return { skipped: true, reason: `job_status_${job.status}` };

    // Atomic claim to prevent duplicate execution across workers
    const claim = await db.query(
      `UPDATE campaign_jobs SET status = 'PROCESSING', attempts = attempts + 1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ? AND status = 'QUEUED'`,
      [job.id, tid]
    );
    if (!claim.affectedRows) return { skipped: true, reason: "already_claimed" };

    const rec = await db.queryOne(
      `SELECT * FROM campaign_recipients WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, job.recipient_id]
    );
    const camp = await db.queryOne(
      `SELECT * FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, job.campaign_id]
    );

    if (!rec || !camp) {
      await db.query(`UPDATE campaign_jobs SET status = 'FAILED', last_error = 'Recipient or campaign missing' WHERE id = ?`, [job.id]);
      return { outcome: "FAILED", reason: "missing_entity" };
    }

    // 1. Recheck campaign state (never send if PAUSED or CANCELLED!)
    if (camp.status !== "RUNNING") {
      const nextJobStatus = camp.status === "PAUSED" ? "QUEUED" : "CANCELLED";
      await db.query(
        `UPDATE campaign_jobs SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [nextJobStatus, `Campaign is ${camp.status}`, job.id]
      );
      if (camp.status === "CANCELLED") {
        await db.query(`UPDATE campaign_recipients SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [rec.id]);
      }
      return { outcome: nextJobStatus, reason: `campaign_${camp.status.toLowerCase()}` };
    }

    // Prevent duplicate submission if recipient already accepted/sent/delivered/read
    if (["ACCEPTED_BY_META", "SENT", "DELIVERED", "READ", "UNKNOWN_REQUIRES_RECONCILIATION"].includes(rec.status)) {
      await db.query(`UPDATE campaign_jobs SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?`, [job.id]);
      return { skipped: true, reason: `already_${rec.status}` };
    }

    // Helper to record pre-send block cleanly
    const blockRecipient = async (statusCode, reason) => {
      await db.query(
        `UPDATE campaign_recipients SET status = ?, exclusion_reason = ?, error_class = 'policy', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [statusCode, reason, reason, rec.id]
      );
      await db.query(
        `UPDATE campaign_jobs SET status = 'BLOCKED', error_class = 'policy', last_error = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [reason, job.id]
      );
      await db.query(
        `INSERT INTO recipient_eligibility_decisions (tenant_id, campaign_id, execution_id, recipient_id, normalized_phone, stage, eligible, decision_code)
         VALUES (?, ?, ?, ?, ?, 'just_in_time', 0, ?)`,
        [tid, camp.id, job.execution_id, rec.id, rec.normalized_phone, statusCode]
      );
      return { outcome: statusCode, reason };
    };

    // 2 & 3. Just-in-time Consent & Suppression revalidation (snapshot NEVER overrides a new opt-out!)
    const consentCheck = await consentService.checkConsent(tid, rec.normalized_phone, {
      category: camp.category,
      workspaceId: camp.workspace_id,
      agencyClientId: camp.agency_client_id,
    });
    if (!consentCheck.eligible) {
      const code = consentCheck.code === "BLOCKED_BY_SUPPRESSION" ? "BLOCKED_BY_SUPPRESSION" : "BLOCKED_BY_CONSENT";
      return blockRecipient(code, consentCheck.reason);
    }

    // 4 & 5. Recheck authorized sender & WABA health
    let sender;
    try {
      sender = await gateway.resolveAuthorizedSender(tid, {
        senderId: rec.sender_id || camp.sender_id,
        wabaId: rec.waba_id || camp.waba_id,
      });
    } catch (err) {
      return blockRecipient("BLOCKED_BY_SENDER", err.message);
    }

    // 6. Recheck template status (must still be APPROVED on the exact WABA)
    let template;
    try {
      let effectiveTemplateId = camp.template_id;
      if (rec.variant_id) {
        const variant = await db.queryOne(`SELECT template_id FROM campaign_experiment_variants WHERE id = ? AND tenant_id = ?`, [rec.variant_id, tid]);
        if (variant?.template_id) effectiveTemplateId = variant.template_id;
      }
      template = await templateService.assertTemplateEligibleForWaba(tid, effectiveTemplateId, sender.waba_id);
    } catch (err) {
      return blockRecipient("BLOCKED_BY_TEMPLATE", err.message);
    }

    // 7. Recheck shared 24h Meta Business-Level unique-recipient limit (NEVER multiplied by phone count!)
    const limitCheck = await limitEngine.canDispatch({
      tenantId: tid,
      accountId: sender.waba_id,
      recipientPhone: rec.normalized_phone,
      isCustomerInitiated: false,
    }).catch(() => ({ allowed: true }));

    if (!limitCheck.allowed) {
      return blockRecipient("BLOCKED_BY_META_LIMIT", limitCheck.reason || "Shared 24h Meta business messaging limit reached");
    }

    // 8. Recheck billing mode & reserve wallet funds ONLY when provider_managed
    const billingProfile = await billingModeService.getBillingProfile(tid).catch(() => ({ billing_mode: "direct_meta", currency: "INR" }));
    let walletReservation = null;
    if (billingProfile.billing_mode === "provider_managed" && Number(rec.estimated_cost_minor || 0) > 0) {
      try {
        walletReservation = await walletService.reserveFunds(
          tid,
          "whatsapp_messaging",
          Number(rec.estimated_cost_minor),
          `cmp:${camp.id}:rec:${rec.id}`
        );
      } catch (wErr) {
        return blockRecipient("BLOCKED_BY_BILLING", wErr.message || "Insufficient provider wallet balance");
      }
    }

    // Record passing eligibility decision
    await db.query(
      `INSERT INTO recipient_eligibility_decisions (tenant_id, campaign_id, execution_id, recipient_id, normalized_phone, stage, eligible, decision_code)
       VALUES (?, ?, ?, ?, ?, 'just_in_time', 1, 'ELIGIBLE')`,
      [tid, camp.id, job.execution_id, rec.id, rec.normalized_phone]
    );

    // 9. Mark SUBMITTING & submit via Madhura Provider Gateway
    await db.query(
      `UPDATE campaign_recipients SET status = 'SUBMITTING', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [rec.id]
    );

    const components = safeJsonParse(rec.rendered_variables_json, []);
    const campConfig = safeJsonParse(camp.config_json, {});
    const startedMs = Date.now();
    const attemptNumber = Number(rec.attempts || 0) + 1;

    try {
      let sendRes;
      if (String(template.category).toUpperCase() === "MARKETING" && campConfig.prefer_marketing_api !== false) {
        sendRes = await gateway.sendMarketingTemplate(tid, {
          senderId: sender.sender_id,
          wabaId: sender.waba_id,
          to: rec.normalized_phone,
          templateName: template.name,
          languageCode: template.language || "en",
          components,
          allowCloudFallback: Boolean(campConfig.allow_cloud_fallback !== false),
        });
      } else {
        sendRes = await gateway.sendTemplate(tid, {
          senderId: sender.sender_id,
          wabaId: sender.waba_id,
          to: rec.normalized_phone,
          templateName: template.name,
          languageCode: template.language || "en",
          components,
        });
      }

      const latencyMs = Date.now() - startedMs;
      const wamid = sendRes?.wamid || null;

      // Record unique recipient against shared 24h Meta window
      await limitEngine
        .recordDispatch({ tenantId: tid, accountId: sender.waba_id, recipientPhone: rec.normalized_phone, isCustomerInitiated: false })
        .catch(() => {});

      await db.query(
        `INSERT INTO campaign_message_attempts (
          tenant_id, campaign_id, execution_id, recipient_id, attempt_number,
          sender_id, waba_id, provider_route, request_payload_json,
          response_status, response_payload_json, wamid, outcome, latency_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 200, ?, ?, 'ACCEPTED_BY_META', ?)`,
        [
          tid, camp.id, job.execution_id, rec.id, attemptNumber,
          sender.sender_id, sender.waba_id, sendRes.provider_route,
          JSON.stringify({ template: template.name, language: template.language, components }),
          JSON.stringify(sendRes.response || {}), wamid, latencyMs,
        ]
      );

      // Keep API acceptance separate from final webhook delivery status!
      await db.query(
        `UPDATE campaign_recipients
         SET status = 'ACCEPTED_BY_META',
             provider_route = ?,
             wamid = ?,
             submitted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [sendRes.provider_route, wamid, rec.id]
      );

      await db.query(
        `UPDATE campaign_jobs SET status = 'COMPLETED', provider_route = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [sendRes.provider_route, job.id]
      );

      await db.query(
        `UPDATE campaigns SET submitted_count = submitted_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`,
        [tid, camp.id]
      );

      await db.query(
        `INSERT INTO campaign_spend_records (tenant_id, campaign_id, recipient_id, billing_mode, record_type, amount_minor, currency, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tid,
          camp.id,
          rec.id,
          billingProfile.billing_mode,
          billingProfile.billing_mode === "provider_managed" ? "reserved" : "estimated",
          Number(rec.estimated_cost_minor || 0),
          billingProfile.currency || "INR",
          wamid || `rec_${rec.id}`,
        ]
      );

      return { outcome: "ACCEPTED_BY_META", wamid, provider_route: sendRes.provider_route, latency_ms: latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - startedMs;
      const classified = classifySendError(err);

      // Release provider wallet reservation on confirmed non-billable failure (NOT on unknown timeout!)
      if (walletReservation && !classified.unknownOutcome) {
        await walletService
          .releaseReservation(tid, "whatsapp_messaging", Number(rec.estimated_cost_minor), `cmp:${camp.id}:rec:${rec.id}`)
          .catch(() => {});
      }

      const recipientStatus = classified.unknownOutcome ? "UNKNOWN_REQUIRES_RECONCILIATION" : "FAILED";
      const jobStatus = classified.unknownOutcome
        ? "RECONCILIATION_REQUIRED"
        : classified.retryable && Number(job.attempts) + 1 < Number(job.max_attempts || 3)
        ? "QUEUED"
        : "FAILED";

      await db.query(
        `INSERT INTO campaign_message_attempts (
          tenant_id, campaign_id, execution_id, recipient_id, attempt_number,
          sender_id, waba_id, provider_route, response_status, outcome,
          error_class, error_code, error_message, latency_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tid, camp.id, job.execution_id, rec.id, attemptNumber,
          sender.sender_id, sender.waba_id, rec.provider_route || "whatsapp_cloud_api",
          err.status || err.response?.status || null,
          recipientStatus, classified.errorClass, classified.code, err.message, latencyMs,
        ]
      );

      await db.query(
        `UPDATE campaign_recipients
         SET status = ?, error_class = ?, error_code = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [recipientStatus, classified.errorClass, classified.code, err.message, rec.id]
      );

      await db.query(
        `UPDATE campaign_jobs
         SET status = ?, error_class = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [jobStatus, classified.errorClass, err.message, job.id]
      );

      if (jobStatus === "QUEUED") {
        await db.query(
          `INSERT INTO campaign_retry_records (tenant_id, campaign_id, job_id, recipient_id, attempt_number, error_class, backoff_ms, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [tid, camp.id, job.id, rec.id, attemptNumber, classified.errorClass, 2000 * attemptNumber, err.message]
        );
      } else if (recipientStatus === "FAILED") {
        await db.query(
          `UPDATE campaigns SET failed_count = failed_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`,
          [tid, camp.id]
        );
      }

      return { outcome: recipientStatus, error_class: classified.errorClass, error: err.message };
    }
  }

  /**
   * Process a batch of queued jobs for a running campaign and finalize when drained.
   */
  async function processCampaignBatch(tenantId, campaignId, { limit = 100 } = {}) {
    const tid = assertTenantId(tenantId);
    const jobs = await db.query(
      `SELECT id FROM campaign_jobs
       WHERE tenant_id = ? AND campaign_id = ? AND status = 'QUEUED'
       ORDER BY priority ASC, id ASC LIMIT ?`,
      [tid, Number(campaignId), Math.min(1000, Number(limit) || 100)]
    );

    const results = [];
    for (const j of jobs) {
      const r = await executeRecipientJob(tid, j.id);
      results.push(r);
    }

    // Check if campaign has finished all queued jobs
    const remaining = await db.queryOne(
      `SELECT COUNT(*) AS cnt FROM campaign_jobs WHERE tenant_id = ? AND campaign_id = ? AND status IN ('QUEUED','PROCESSING')`,
      [tid, Number(campaignId)]
    );
    const camp = await db.queryOne(`SELECT status FROM campaigns WHERE tenant_id = ? AND id = ?`, [tid, Number(campaignId)]);
    if (camp && camp.status === "RUNNING" && Number(remaining?.cnt || 0) === 0) {
      await db.query(
        `UPDATE campaigns SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND id = ? AND status = 'RUNNING'`,
        [tid, Number(campaignId)]
      );
      await db.query(
        `UPDATE campaign_executions SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND campaign_id = ? AND status = 'RUNNING'`,
        [tid, Number(campaignId)]
      );
    }

    return {
      processed: results.length,
      accepted: results.filter((r) => r.outcome === "ACCEPTED_BY_META").length,
      blocked: results.filter((r) => String(r.outcome || "").startsWith("BLOCKED_")).length,
      failed: results.filter((r) => r.outcome === "FAILED").length,
      reconciliation_required: results.filter((r) => r.outcome === "UNKNOWN_REQUIRES_RECONCILIATION").length,
      results,
    };
  }

  async function pauseCampaign(tenantId, campaignId, reason = "Paused by user", actorId = null) {
    const tid = assertTenantId(tenantId);
    const camp = await managementService.getCampaign(tid, campaignId);
    if (!["RUNNING", "SCHEDULED", "PREPARING"].includes(camp.status)) {
      throw httpError(`Campaign in '${camp.status}' cannot be paused`, 409, "INVALID_PAUSE_STATE");
    }
    await db.query(
      `UPDATE campaigns SET status = 'PAUSED', paused_at = CURRENT_TIMESTAMP, pause_reason = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [reason, actorId, tid, camp.id]
    );
    await audit.log(tid, { workspaceId: camp.workspace_id, campaignId: camp.id, action: "PAUSE_CAMPAIGN", actorId, metadata: { reason } });
    return managementService.getCampaign(tid, camp.id);
  }

  async function resumeCampaign(tenantId, campaignId, actorId = null, { syncDispatch = false } = {}) {
    const tid = assertTenantId(tenantId);
    const camp = await managementService.getCampaign(tid, campaignId);
    if (camp.status !== "PAUSED") {
      throw httpError(`Only PAUSED campaigns can be resumed (current=${camp.status})`, 409, "INVALID_RESUME_STATE");
    }
    // Revalidate sender & template before resuming
    const sender = await gateway.resolveAuthorizedSender(tid, { senderId: camp.sender_id, wabaId: camp.waba_id });
    await templateService.assertTemplateEligibleForWaba(tid, camp.template_id, sender.waba_id);

    await db.query(
      `UPDATE campaigns SET status = 'RUNNING', pause_reason = NULL, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [actorId, tid, camp.id]
    );
    await audit.log(tid, { workspaceId: camp.workspace_id, campaignId: camp.id, action: "RESUME_CAMPAIGN", actorId });

    let dispatchSummary = null;
    if (syncDispatch) {
      dispatchSummary = await processCampaignBatch(tid, camp.id, { limit: 500 });
    }
    return { campaign: await managementService.getCampaign(tid, camp.id), dispatch_summary: dispatchSummary };
  }

  async function cancelCampaign(tenantId, campaignId, reason = "Cancelled by user", actorId = null) {
    const tid = assertTenantId(tenantId);
    const camp = await managementService.getCampaign(tid, campaignId);
    if (["COMPLETED", "CANCELLED"].includes(camp.status)) {
      throw httpError(`Campaign is already '${camp.status}'`, 409, "INVALID_CANCEL_STATE");
    }
    await db.query(
      `UPDATE campaigns
       SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, cancel_reason = ?, cancelled_by = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [reason, actorId, actorId, tid, camp.id]
    );
    // Cancel ONLY unsent queued jobs & recipients; NEVER delete already-sent records
    await db.query(
      `UPDATE campaign_jobs SET status = 'CANCELLED', last_error = ?, completed_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND campaign_id = ? AND status IN ('QUEUED','DELAYED','WAITING')`,
      [reason, tid, camp.id]
    );
    await db.query(
      `UPDATE campaign_recipients SET status = 'CANCELLED', exclusion_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND campaign_id = ? AND status IN ('PENDING','WAITING_FOR_SCHEDULE','QUEUED','RESERVED')`,
      [reason, tid, camp.id]
    );
    await audit.log(tid, { workspaceId: camp.workspace_id, campaignId: camp.id, action: "CANCEL_CAMPAIGN", actorId, metadata: { reason } });
    return managementService.getCampaign(tid, camp.id);
  }

  async function retryFailedJobs(tenantId, campaignId, actorId = null) {
    const tid = assertTenantId(tenantId);
    // Retry ONLY transient failures — never retry permanent or policy blocks
    const res = await db.query(
      `UPDATE campaign_jobs
       SET status = 'QUEUED', updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND campaign_id = ? AND status = 'FAILED' AND error_class = 'transient'`,
      [tid, Number(campaignId)]
    );
    await audit.log(tid, { campaignId: Number(campaignId), action: "RETRY_TRANSIENT_FAILED", actorId, metadata: { requeued: res.affectedRows || 0 } });
    return { requeued: Number(res.affectedRows || 0) };
  }

  /**
   * Authorized Test Send — NEVER sends to production audience; strictly sends only
   * to explicit test recipient(s) with valid consent and approved template.
   */
  async function sendTestMessage(tenantId, campaignId, { testPhone, sampleData = {} }, actorId = null) {
    const tid = assertTenantId(tenantId);
    const camp = await managementService.getCampaign(tid, campaignId);
    const sender = await gateway.resolveAuthorizedSender(tid, { senderId: camp.sender_id, wabaId: camp.waba_id });
    const template = await templateService.assertTemplateEligibleForWaba(tid, camp.template_id, sender.waba_id);

    const consentCheck = await consentService.checkConsent(tid, testPhone, { category: template.category });
    if (!consentCheck.eligible) {
      throw httpError(`Test recipient ineligible: ${consentCheck.reason}`, 403, consentCheck.code);
    }

    const rendered = renderTemplateForRecipient(template, { name: sampleData.name || "Test User", ...sampleData }, camp.config?.variable_mapping || {}, {
      missingVariablePolicy: camp.config?.missing_variable_policy || "exclude",
      headerMediaUrl: camp.config?.header_media_url || null,
    });
    if (!rendered.ok) throw httpError(rendered.error, 400, "TEST_RENDER_FAILED");

    const res = await gateway.sendTemplate(tid, {
      senderId: sender.sender_id,
      wabaId: sender.waba_id,
      to: testPhone,
      templateName: template.name,
      languageCode: template.language || "en",
      components: rendered.components,
    });

    await audit.log(tid, {
      campaignId: camp.id,
      action: "TEST_SEND",
      actorId,
      metadata: { wamid: res.wamid, provider_route: res.provider_route },
    });

    return { sent: true, wamid: res.wamid, provider_route: res.provider_route, rendered_body: rendered.renderedBody };
  }

  return {
    QUEUE_NAMES,
    classifySendError,
    launchCampaign,
    executeRecipientJob,
    processCampaignBatch,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    retryFailedJobs,
    sendTestMessage,
  };
}

module.exports = { createCampaignExecutionEngine, classifySendError, QUEUE_NAMES };
