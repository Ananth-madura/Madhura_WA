"use strict";

/**
 * failureRecoveryService.js
 *
 * Smart Failure Recovery, Meta Template Pacing Recovery, Configurable Auto-Retry,
 * and Optional Cross-Channel Fallback (SMS / RCS / Email) with separate consent
 * and separate financial ledgers.
 *
 * Safety invariants:
 *   - NEVER retries permanent failures (template rejected, invalid recipient,
 *     opted-out, billing restriction, missing permission).
 *   - NEVER resends `UNKNOWN_REQUIRES_RECONCILIATION` until reconciled.
 *   - Meta template pacing pauses affected dispatch, preserves accepted/delivered
 *     AND pending records, and recovers via an APPROVED replacement template for
 *     only eligible failed/unsent recipients after revalidation.
 *   - Cross-channel fallback (SMS/RCS/Email) requires separate channel-specific
 *     consent, never sends promotional fallback simply because WhatsApp failed
 *     unless explicitly enabled & consented, and maintains separate message IDs
 *     and separate cost ledgers.
 */

const {
  createDbHelper,
  assertTenantId,
  normalizePhone,
  safeJsonParse,
  httpError,
  generateUid,
} = require("../dbHelper");
const { createConsentSuppressionService } = require("../consentSuppressionService");
const { createAudienceBuilderService } = require("../audienceBuilderService");
const { createCampaignManagementService } = require("../campaignManagementService");

const FAILURE_CATEGORIES = {
  temporary_network: { retryable: true, label: "Temporary network failure" },
  rate_limit: { retryable: true, label: "Rate-limit response" },
  provider_outage: { retryable: true, label: "Provider outage" },
  template_rejected: { retryable: false, label: "Template rejected" },
  template_paused: { retryable: false, pacing: true, label: "Template paused / Meta pacing" },
  invalid_recipient: { retryable: false, label: "Invalid recipient" },
  invalid_variable: { retryable: false, label: "Invalid template variable" },
  sender_disconnected: { retryable: false, label: "Sender disconnected" },
  missing_permission: { retryable: false, label: "Missing permission" },
  policy_restriction: { retryable: false, label: "Policy restriction" },
  recipient_unavailable: { retryable: true, label: "Recipient unavailable" },
  unknown_submission_outcome: { retryable: false, reconciliationRequired: true, label: "Unknown submission outcome" },
  billing_restriction: { retryable: false, label: "Billing restriction" },
};

function classifyRecipientFailure(rec = {}) {
  const code = String(rec.error_code || "").toLowerCase();
  const msg = String(rec.error_message || rec.exclusion_reason || "").toLowerCase();
  const status = String(rec.status || "").toUpperCase();

  if (status === "UNKNOWN_REQUIRES_RECONCILIATION") return { category: "unknown_submission_outcome", ...FAILURE_CATEGORIES.unknown_submission_outcome };
  if (/132015|132016|pacing|template.*paused|paused/.test(`${code} ${msg}`)) return { category: "template_paused", ...FAILURE_CATEGORIES.template_paused };
  if (/132001|template.*rejected|rejected/.test(`${code} ${msg}`)) return { category: "template_rejected", ...FAILURE_CATEGORIES.template_rejected };
  if (/132000|132012|variable|parameter/.test(`${code} ${msg}`)) return { category: "invalid_variable", ...FAILURE_CATEGORIES.invalid_variable };
  if (/131048|131056|429|rate.?limit|throttl/.test(`${code} ${msg}`)) return { category: "rate_limit", ...FAILURE_CATEGORIES.rate_limit };
  if (/131042|billing|payment|balance|wallet/.test(`${code} ${msg}`)) return { category: "billing_restriction", ...FAILURE_CATEGORIES.billing_restriction };
  if (/131026|unavailable|not.*whatsapp/.test(`${code} ${msg}`)) return { category: "recipient_unavailable", ...FAILURE_CATEGORIES.recipient_unavailable };
  if (/invalid.*phone|invalid.*recipient|131021/.test(`${code} ${msg}`)) return { category: "invalid_recipient", ...FAILURE_CATEGORIES.invalid_recipient };
  if (/disconnect|sender/.test(`${code} ${msg}`)) return { category: "sender_disconnected", ...FAILURE_CATEGORIES.sender_disconnected };
  if (/401|403|permission|unauthor/.test(`${code} ${msg}`)) return { category: "missing_permission", ...FAILURE_CATEGORIES.missing_permission };
  if (/policy|spam|opt.?out|suppress/.test(`${code} ${msg}`)) return { category: "policy_restriction", ...FAILURE_CATEGORIES.policy_restriction };
  if (/500|502|503|504|outage|service unavailable/.test(`${code} ${msg}`)) return { category: "provider_outage", ...FAILURE_CATEGORIES.provider_outage };
  return { category: "temporary_network", ...FAILURE_CATEGORIES.temporary_network };
}

function createFailureRecoveryService(options = {}) {
  const db = createDbHelper(options.db);
  const consentService = options.consentService || createConsentSuppressionService({ db: options.db });
  const audienceService = options.audienceService || createAudienceBuilderService({ db: options.db, consentService });
  const managementService = options.managementService || createCampaignManagementService({ db: options.db, audienceService });
  const fallbackAdapters = options.fallbackAdapters || {};

  // ── 1. Configurable Retry Policies ─────────────────────────────────────────
  async function saveRetryPolicy(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const delays = Array.isArray(input.retry_delays_seconds) && input.retry_delays_seconds.length > 0
      ? input.retry_delays_seconds.map((n) => Math.max(10, Number(n) || 120))
      : [120, 600, 1800];
    const maxAttempts = Math.min(5, Math.max(1, Number(input.max_attempts || delays.length)));
    const res = await db.query(
      `INSERT INTO campaign_retry_policies
       (tenant_id, workspace_id, campaign_id, name, retry_delays_seconds_json, max_attempts, jitter_pct, deadline_hours, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        tid,
        input.workspace_id || null,
        input.campaign_id || null,
        input.name || "Standard Transient Retry Policy",
        JSON.stringify(delays),
        maxAttempts,
        Math.min(50, Math.max(0, Number(input.jitter_pct ?? 20))),
        Math.min(168, Math.max(1, Number(input.deadline_hours || 24))),
        actorId || null,
      ]
    );
    return db.queryOne(`SELECT * FROM campaign_retry_policies WHERE id = ?`, [res.insertId]);
  }

  async function listRetryPolicies(tenantId) {
    const tid = assertTenantId(tenantId);
    const rows = await db.query(`SELECT * FROM campaign_retry_policies WHERE tenant_id = ? ORDER BY id DESC LIMIT 50`, [tid]);
    return rows.map((r) => ({ ...r, retry_delays_seconds: safeJsonParse(r.retry_delays_seconds_json, [120, 600]) }));
  }

  async function retryEligibleTransientFailures(tenantId, campaignId, { policyId = null } = {}) {
    const tid = assertTenantId(tenantId);
    const camp = await db.queryOne(`SELECT * FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(campaignId)]);
    if (!camp) throw httpError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");

    const policy = policyId
      ? await db.queryOne(`SELECT * FROM campaign_retry_policies WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(policyId)])
      : await db.queryOne(`SELECT * FROM campaign_retry_policies WHERE tenant_id = ? AND (campaign_id = ? OR campaign_id IS NULL) AND is_active = 1 ORDER BY campaign_id DESC, id DESC LIMIT 1`, [tid, camp.id]);

    const maxAttempts = Number(policy?.max_attempts || 3);
    const delays = safeJsonParse(policy?.retry_delays_seconds_json, [120, 600, 1800]);
    const jitterPct = Number(policy?.jitter_pct ?? 20);

    const failedRecs = await db.query(
      `SELECT * FROM campaign_recipients
       WHERE tenant_id = ? AND campaign_id = ? AND status IN ('FAILED', 'UNKNOWN_REQUIRES_RECONCILIATION')`,
      [tid, camp.id]
    );

    let requeued = 0;
    let skippedPermanent = 0;
    let skippedReconciliation = 0;
    let skippedMaxAttempts = 0;

    for (const r of failedRecs) {
      const cls = classifyRecipientFailure(r);
      if (cls.reconciliationRequired) {
        skippedReconciliation++;
        continue;
      }
      if (!cls.retryable) {
        skippedPermanent++;
        continue;
      }
      const attempts = Number(r.attempts || 1);
      if (attempts >= maxAttempts) {
        skippedMaxAttempts++;
        continue;
      }
      const consent = await consentService.checkConsent(tid, r.normalized_phone, { category: camp.category || "MARKETING" });
      if (!consent.eligible) {
        skippedPermanent++;
        continue;
      }

      const baseSec = delays[Math.min(attempts - 1, delays.length - 1)] || 120;
      const jitter = Math.floor(baseSec * (jitterPct / 100) * Math.random());
      const nextRunAt = new Date(Date.now() + (baseSec + jitter) * 1000).toISOString();

      await db.query(
        `UPDATE campaign_recipients SET status = 'QUEUED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [r.id]
      );
      await db.query(
        `INSERT INTO campaign_jobs (job_uid, queue_name, tenant_id, campaign_id, recipient_id, status, available_at, payload_json)
         VALUES (?, 'campaign.retry', ?, ?, ?, 'PENDING', ?, ?)`,
        [generateUid("retry"), tid, camp.id, r.id, nextRunAt, JSON.stringify({ retry_attempt: attempts + 1, category: cls.category })]
      ).catch(() => {});
      requeued++;
    }

    return {
      campaign_id: camp.id,
      requeued_count: requeued,
      skipped_permanent: skippedPermanent,
      skipped_reconciliation_required: skippedReconciliation,
      skipped_max_attempts: skippedMaxAttempts,
    };
  }

  // ── 2. Meta Template Pacing Pause & Replacement-Template Recovery ──────────
  async function handleTemplatePacingDetected(tenantId, { campaignId, templateId = null, errorCode = "132015", errorMessage = "Meta template pacing or quality pause" } = {}) {
    const tid = assertTenantId(tenantId);
    const camp = await db.queryOne(`SELECT * FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(campaignId)]);
    if (!camp) throw httpError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");

    // 1. Pause active dispatch cleanly without touching accepted/delivered messages
    await db.query(
      `UPDATE campaigns SET status = 'PAUSED', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ? AND status IN ('RUNNING','SCHEDULED')`,
      [tid, camp.id]
    );

    const [acceptedRow, pendingRow] = await Promise.all([
      db.queryOne(
        `SELECT COUNT(*) AS cnt FROM campaign_recipients WHERE tenant_id = ? AND campaign_id = ? AND status IN ('ACCEPTED_BY_META','SENT','DELIVERED','READ')`,
        [tid, camp.id]
      ),
      db.queryOne(
        `SELECT COUNT(*) AS cnt FROM campaign_recipients WHERE tenant_id = ? AND campaign_id = ? AND status IN ('QUEUED','PENDING','FAILED')`,
        [tid, camp.id]
      ),
    ]);

    const res = await db.query(
      `INSERT INTO campaign_template_pacing_incidents
       (tenant_id, campaign_id, template_id, template_name, error_code, error_message,
        preserved_accepted_count, affected_pending_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [
        tid,
        camp.id,
        templateId || camp.template_id || null,
        camp.template_name || null,
        String(errorCode),
        String(errorMessage),
        Number(acceptedRow?.cnt || 0),
        Number(pendingRow?.cnt || 0),
      ]
    );

    return db.queryOne(`SELECT * FROM campaign_template_pacing_incidents WHERE id = ?`, [res.insertId]);
  }

  async function recoverWithReplacementTemplate(tenantId, incidentId, { replacementTemplateId } = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const inc = await db.queryOne(
      `SELECT * FROM campaign_template_pacing_incidents WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(incidentId)]
    );
    if (!inc) throw httpError("Template pacing incident not found", 404, "INCIDENT_NOT_FOUND");
    if (!replacementTemplateId) throw httpError("replacement_template_id is required", 400, "TEMPLATE_REQUIRED");

    const replacement = await db.queryOne(
      `SELECT * FROM wa_templates WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(replacementTemplateId)]
    );
    if (!replacement) throw httpError("Replacement template not found", 404, "TEMPLATE_NOT_FOUND");
    if (String(replacement.meta_status || "").toUpperCase() !== "APPROVED") {
      throw httpError(
        `Replacement template '${replacement.name}' is '${replacement.meta_status || "DRAFT"}'. Only APPROVED Meta templates can be used for recovery.`,
        409,
        "TEMPLATE_NOT_APPROVED"
      );
    }

    const origCamp = await db.queryOne(`SELECT * FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, inc.campaign_id]);
    // Collect ONLY unsent/failed recipients (never duplicate already accepted/delivered recipients!)
    const eligibleToRecover = await db.query(
      `SELECT contact_id, contact_name, normalized_phone FROM campaign_recipients
       WHERE tenant_id = ? AND campaign_id = ? AND status IN ('QUEUED','PENDING','FAILED')`,
      [tid, inc.campaign_id]
    );

    const verifiedContacts = [];
    for (const r of eligibleToRecover) {
      const check = await consentService.checkConsent(tid, r.normalized_phone, { category: replacement.category || "MARKETING" });
      if (check.eligible) {
        verifiedContacts.push({ contact_id: r.contact_id, name: r.contact_name || "", phone: r.normalized_phone });
      }
    }
    if (verifiedContacts.length === 0) {
      throw httpError("No eligible unsent or failed recipients remain after consent/suppression revalidation", 400, "NO_ELIGIBLE_RECOVERY_RECIPIENTS");
    }

    const recSeg = await audienceService.createSegment(tid, {
      name: `Recovery Audience - ${origCamp.name}`,
      description: `Unsent/failed recipients recovered from pacing incident #${inc.id}`,
      segment_type: "static",
      definition: { static_contacts: verifiedContacts },
    }, actorId);

    const recCamp = await managementService.createCampaign(tid, {
      name: `${origCamp.name} (Template Recovery)`,
      description: `Linked recovery campaign for pacing incident #${inc.id} using approved template ${replacement.name}`,
      campaign_type: origCamp.campaign_type,
      category: replacement.category || origCamp.category,
      segment_id: recSeg.id,
      sender_id: origCamp.sender_id,
      waba_id: origCamp.waba_id,
      template_id: replacement.id,
      template_name: replacement.name,
      template_language: replacement.language || "en",
    }, actorId);

    const validation = await managementService.validateAndPreview(tid, recCamp.id, actorId);

    await db.query(
      `UPDATE campaign_template_pacing_incidents
       SET replacement_template_id = ?, recovery_campaign_id = ?, status = 'RECOVERED', recovered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [replacement.id, recCamp.id, inc.id]
    );

    return {
      incident_id: inc.id,
      recovery_campaign: recCamp,
      recovered_recipient_count: verifiedContacts.length,
      preserved_already_sent_count: inc.preserved_accepted_count,
      revalidation: { valid: validation.valid, blockers: validation.blockers },
    };
  }

  // ── 3. Failed Recipient Report & CSV Export ────────────────────────────────
  async function getFailedRecipientsReport(tenantId, filters = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["r.tenant_id = ?", "r.status IN ('FAILED','UNKNOWN_REQUIRES_RECONCILIATION','BLOCKED_BY_CONSENT','BLOCKED_BY_SUPPRESSION','BLOCKED_BY_META_LIMIT')"];
    const params = [tid];

    if (filters.campaign_id) {
      clauses.push("r.campaign_id = ?");
      params.push(Number(filters.campaign_id));
    }
    if (filters.country_code) {
      clauses.push("r.country_code = ?");
      params.push(String(filters.country_code).toUpperCase());
    }
    if (filters.sender_id) {
      clauses.push("r.sender_id = ?");
      params.push(Number(filters.sender_id));
    }
    if (filters.error_code) {
      clauses.push("r.error_code = ?");
      params.push(String(filters.error_code));
    }
    if (filters.date_from) {
      clauses.push("r.created_at >= ?");
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      clauses.push("r.created_at <= ?");
      params.push(filters.date_to);
    }

    const rows = await db.query(
      `SELECT r.*, c.name AS campaign_name, c.template_name, c.category AS campaign_category
       FROM campaign_recipients r
       JOIN campaigns c ON c.id = r.campaign_id AND c.tenant_id = r.tenant_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY r.updated_at DESC LIMIT 500`,
      params
    );

    const breakdown = {};
    const enriched = rows.map((r) => {
      const cls = classifyRecipientFailure(r);
      breakdown[cls.category] = (breakdown[cls.category] || 0) + 1;
      return {
        ...r,
        failure_category: cls.category,
        failure_label: cls.label,
        retryable: Boolean(cls.retryable),
        reconciliation_required: Boolean(cls.reconciliationRequired),
      };
    });

    const incidents = await db.query(
      `SELECT i.*, c.name AS campaign_name
       FROM campaign_template_pacing_incidents i
       LEFT JOIN campaigns c ON c.id = i.campaign_id AND c.tenant_id = i.tenant_id
       WHERE i.tenant_id = ? ORDER BY i.id DESC LIMIT 50`,
      [tid]
    );

    return {
      total_failed: enriched.length,
      breakdown,
      recipients: enriched,
      pacing_incidents: incidents,
    };
  }

  // ── 4. Optional Cross-Channel Fallback (SMS / RCS / Email) ─────────────────
  async function configureFallbackChannel(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const channel = String(input.channel || "").toLowerCase();
    if (!["sms", "rcs", "email"].includes(channel)) {
      throw httpError("Supported fallback channels are sms, rcs, and email", 400, "INVALID_FALLBACK_CHANNEL");
    }
    if (!input.provider_name) throw httpError("provider_name is required", 400, "PROVIDER_REQUIRED");
    const res = await db.query(
      `INSERT INTO campaign_fallback_channels
       (tenant_id, workspace_id, channel, provider_name, sender_identity, config_json,
        allow_promotional_fallback, cost_per_message_minor, currency, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        tid,
        input.workspace_id || null,
        channel,
        String(input.provider_name).trim(),
        input.sender_identity || null,
        JSON.stringify(input.config || {}),
        input.allow_promotional_fallback ? 1 : 0,
        Number(input.cost_per_message_minor || 25),
        input.currency || "INR",
        actorId || null,
      ]
    );
    return db.queryOne(`SELECT * FROM campaign_fallback_channels WHERE id = ?`, [res.insertId]);
  }

  async function dispatchFallbackForRecipient(tenantId, { campaignId, recipientId, channel, messageText, destination = null } = {}) {
    const tid = assertTenantId(tenantId);
    const ch = String(channel || "").toLowerCase();
    const cfg = await db.queryOne(
      `SELECT * FROM campaign_fallback_channels WHERE tenant_id = ? AND channel = ? AND is_active = 1 ORDER BY id DESC LIMIT 1`,
      [tid, ch]
    );
    if (!cfg) throw httpError(`No active authorized ${ch.toUpperCase()} fallback provider configured`, 400, "FALLBACK_CHANNEL_NOT_CONFIGURED");

    const rec = await db.queryOne(
      `SELECT r.*, c.category AS campaign_category FROM campaign_recipients r
       JOIN campaigns c ON c.id = r.campaign_id AND c.tenant_id = r.tenant_id
       WHERE r.tenant_id = ? AND r.campaign_id = ? AND r.id = ? LIMIT 1`,
      [tid, Number(campaignId), Number(recipientId)]
    );
    if (!rec) throw httpError("Failed recipient not found", 404, "RECIPIENT_NOT_FOUND");
    if (rec.status !== "FAILED") {
      throw httpError(`Recipient status '${rec.status}' is not eligible for fallback (duplicate-send guard)`, 409, "FALLBACK_NOT_ELIGIBLE");
    }

    // Never send promotional content over another channel simply because WhatsApp failed unless explicitly configured & consented!
    if (String(rec.campaign_category || "").toUpperCase() === "MARKETING" && !cfg.allow_promotional_fallback) {
      throw httpError(
        "Promotional fallback over secondary channels is disabled by compliance policy",
        403,
        "PROMOTIONAL_FALLBACK_BLOCKED"
      );
    }

    // Separate channel-specific consent verification!
    const channelPurpose = `${ch}_fallback`;
    const channelConsent = await db.queryOne(
      `SELECT * FROM contact_consents
       WHERE tenant_id = ? AND normalized_phone = ? AND purpose = ? AND status = 'GRANTED'
       ORDER BY id DESC LIMIT 1`,
      [tid, rec.normalized_phone, channelPurpose]
    );
    if (!channelConsent) {
      throw httpError(
        `Recipient lacks separate '${channelPurpose}' consent required for ${ch.toUpperCase()} fallback`,
        403,
        "FALLBACK_CHANNEL_CONSENT_MISSING"
      );
    }

    // Check duplicate fallback dispatch
    const dup = await db.queryOne(
      `SELECT id FROM campaign_fallback_dispatches WHERE tenant_id = ? AND campaign_id = ? AND recipient_id = ? AND channel = ? LIMIT 1`,
      [tid, rec.campaign_id, rec.id, ch]
    );
    if (dup) throw httpError("Fallback already dispatched for this recipient", 409, "FALLBACK_DUPLICATE_BLOCKED");

    const dest = destination || rec.normalized_phone;
    let providerMsgId = `${ch}_${generateUid("fbk")}`;
    let status = "SUBMITTED";
    if (fallbackAdapters[ch] && typeof fallbackAdapters[ch].send === "function") {
      const adapterRes = await fallbackAdapters[ch].send({ to: dest, text: messageText, config: safeJsonParse(cfg.config_json, {}) });
      providerMsgId = adapterRes?.message_id || providerMsgId;
      status = adapterRes?.status || "SUBMITTED";
    }

    const ins = await db.query(
      `INSERT INTO campaign_fallback_dispatches
       (tenant_id, campaign_id, recipient_id, channel, provider_name, normalized_destination,
        channel_message_id, consent_evidence_ref, status, cost_minor, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tid, rec.campaign_id, rec.id, ch, cfg.provider_name, dest, providerMsgId, channelConsent.evidence_ref || null, status, cfg.cost_per_message_minor, cfg.currency]
    );

    return db.queryOne(`SELECT * FROM campaign_fallback_dispatches WHERE id = ?`, [ins.insertId]);
  }

  async function listFallbackOverview(tenantId) {
    const tid = assertTenantId(tenantId);
    const [channels, dispatches] = await Promise.all([
      db.query(`SELECT id, channel, provider_name, sender_identity, allow_promotional_fallback, cost_per_message_minor, currency, is_active FROM campaign_fallback_channels WHERE tenant_id = ? ORDER BY id DESC`, [tid]),
      db.query(`SELECT * FROM campaign_fallback_dispatches WHERE tenant_id = ? ORDER BY id DESC LIMIT 100`, [tid]),
    ]);
    return { channels, dispatches };
  }

  return {
    FAILURE_CATEGORIES,
    classifyRecipientFailure,
    saveRetryPolicy,
    listRetryPolicies,
    retryEligibleTransientFailures,
    handleTemplatePacingDetected,
    recoverWithReplacementTemplate,
    getFailedRecipientsReport,
    configureFallbackChannel,
    dispatchFallbackForRecipient,
    listFallbackOverview,
  };
}

module.exports = { createFailureRecoveryService, FAILURE_CATEGORIES, classifyRecipientFailure };
