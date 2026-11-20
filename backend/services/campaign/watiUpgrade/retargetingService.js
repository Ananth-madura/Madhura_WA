"use strict";

/**
 * retargetingService.js
 *
 * Smart Behavioral Retargeting Engine:
 *   - Converts REAL campaign engagement events into reusable audience segments
 *     and follow-up campaigns.
 *   - Supports all 11 engagement segments:
 *       delivered_not_read | read_not_replied | replied | cta_clicked |
 *       flow_submitted | flow_not_completed | converted | not_converted |
 *       failed_delivery | unresolved_delivery | opted_out
 *   - Never infers CTA clicks from delivery (uses tracked link clicks only).
 *   - Explicitly distinguishes unknown read status from confirmed unread.
 *   - Rechecks live consent, suppression, frequency caps, and anti-repeat history
 *     so customers never receive the same follow-up twice.
 */

const {
  createDbHelper,
  assertTenantId,
  safeJsonParse,
  httpError,
} = require("../dbHelper");
const { createConsentSuppressionService } = require("../consentSuppressionService");
const { createAudienceBuilderService } = require("../audienceBuilderService");
const { createCampaignManagementService } = require("../campaignManagementService");

const ENGAGEMENT_SEGMENTS = [
  "delivered_not_read",
  "read_not_replied",
  "replied",
  "cta_clicked",
  "flow_submitted",
  "flow_not_completed",
  "converted",
  "not_converted",
  "failed_delivery",
  "unresolved_delivery",
  "opted_out",
];

function createRetargetingService(options = {}) {
  const db = createDbHelper(options.db);
  const consentService = options.consentService || createConsentSuppressionService({ db: options.db });
  const audienceService = options.audienceService || createAudienceBuilderService({ db: options.db, consentService });
  const managementService = options.managementService || createCampaignManagementService({ db: options.db, audienceService });

  async function computeEngagementAudience(tenantId, sourceCampaignId, engagementSegment, {
    category = "MARKETING",
    workspaceId = null,
    enforceAntiRepeat = true,
  } = {}) {
    const tid = assertTenantId(tenantId);
    const seg = String(engagementSegment || "").toLowerCase();
    if (!ENGAGEMENT_SEGMENTS.includes(seg)) {
      throw httpError(`Unsupported engagement segment '${engagementSegment}'`, 400, "INVALID_RETARGETING_SEGMENT");
    }

    const sourceCamp = await db.queryOne(
      `SELECT id, name, category, whatsapp_flow_id, waba_id, sender_id FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(sourceCampaignId)]
    );
    if (!sourceCamp) throw httpError("Source campaign not found", 404, "CAMPAIGN_NOT_FOUND");

    const recipients = await db.query(
      `SELECT id, contact_id, contact_name, phone, normalized_phone, status, delivered_at, read_at, replied_at,
              flow_completed_at, converted_at, error_code
       FROM campaign_recipients
       WHERE tenant_id = ? AND campaign_id = ?`,
      [tid, sourceCamp.id]
    );

    // Load real tracked CTA click counts/phones & opt-outs & conversions
    const [trackedLinks, flowSubs, conversions, alreadyRetargeted] = await Promise.all([
      db.query(
        `SELECT recipient_id, click_count FROM campaign_tracked_links WHERE tenant_id = ? AND campaign_id = ? AND click_count > 0`,
        [tid, sourceCamp.id]
      ).catch(() => []),
      db.query(
        `SELECT recipient_id, normalized_phone FROM whatsapp_flow_submissions WHERE tenant_id = ? AND campaign_id = ?`,
        [tid, sourceCamp.id]
      ).catch(() => []),
      db.query(
        `SELECT recipient_id, normalized_phone FROM campaign_conversions WHERE tenant_id = ? AND campaign_id = ?`,
        [tid, sourceCamp.id]
      ).catch(() => []),
      db.query(
        `SELECT normalized_phone FROM campaign_retargeting_history WHERE tenant_id = ? AND source_campaign_id = ? AND engagement_segment = ?`,
        [tid, sourceCamp.id, seg]
      ).catch(() => []),
    ]);

    const clickedRecipientIds = new Set(trackedLinks.map((l) => Number(l.recipient_id)).filter(Boolean));
    const flowSubmittedPhones = new Set(flowSubs.map((s) => s.normalized_phone).filter(Boolean));
    const convertedPhones = new Set(conversions.map((c) => c.normalized_phone).filter(Boolean));
    const repeatPhones = new Set(alreadyRetargeted.map((h) => h.normalized_phone).filter(Boolean));

    // Read-receipt observability check: if 0 recipients have read_at across delivered messages, read status may be unknown
    const deliveredRecs = recipients.filter((r) => Boolean(r.delivered_at) || ["DELIVERED", "READ"].includes(r.status));
    const anyReadReceiptsObserved = deliveredRecs.some((r) => Boolean(r.read_at) || r.status === "READ");

    const matched = [];
    for (const r of recipients) {
      const isDelivered = Boolean(r.delivered_at) || ["DELIVERED", "READ"].includes(r.status);
      const isRead = Boolean(r.read_at) || r.status === "READ";
      const isReplied = Boolean(r.replied_at);
      const isClicked = clickedRecipientIds.has(Number(r.id));
      const isFlowSub = Boolean(r.flow_completed_at) || flowSubmittedPhones.has(r.normalized_phone);
      const isConverted = Boolean(r.converted_at) || convertedPhones.has(r.normalized_phone);
      const isFailed = r.status === "FAILED";
      const isUnresolved = r.status === "UNKNOWN_REQUIRES_RECONCILIATION";
      const isOptedOut = r.status === "BLOCKED_BY_SUPPRESSION";

      let hit = false;
      switch (seg) {
        case "delivered_not_read":
          hit = isDelivered && !isRead;
          break;
        case "read_not_replied":
          hit = isRead && !isReplied;
          break;
        case "replied":
          hit = isReplied;
          break;
        case "cta_clicked":
          hit = isClicked;
          break;
        case "flow_submitted":
          hit = isFlowSub;
          break;
        case "flow_not_completed":
          hit = Boolean(sourceCamp.whatsapp_flow_id) && isDelivered && !isFlowSub;
          break;
        case "converted":
          hit = isConverted;
          break;
        case "not_converted":
          hit = isDelivered && !isConverted;
          break;
        case "failed_delivery":
          hit = isFailed;
          break;
        case "unresolved_delivery":
          hit = isUnresolved;
          break;
        case "opted_out":
          hit = isOptedOut;
          break;
        default:
          break;
      }

      if (hit) matched.push(r);
    }

    // Recheck live consent, suppression, frequency cap & anti-repeat guard
    const settings = await db.queryOne(
      `SELECT max_messages_per_contact_24h FROM campaign_settings WHERE tenant_id = ? LIMIT 1`,
      [tid]
    ).catch(() => null);
    const freqCap = Number(settings?.max_messages_per_contact_24h || 5);

    const eligible = [];
    const excluded = [];
    let repeatBlocked = 0;

    for (const r of matched) {
      if (enforceAntiRepeat && repeatPhones.has(r.normalized_phone)) {
        repeatBlocked++;
        excluded.push({ phone: r.normalized_phone, name: r.contact_name, reason: "ALREADY_RETARGETED" });
        continue;
      }
      if (seg === "opted_out") {
        // Opted-out segment is audit-only; never eligible for outbound marketing sends
        excluded.push({ phone: r.normalized_phone, name: r.contact_name, reason: "OPTED_OUT_AUDIT_ONLY" });
        continue;
      }

      const consentCheck = await consentService.checkConsent(tid, r.normalized_phone, {
        category: String(category || sourceCamp.category || "MARKETING").toUpperCase(),
        workspaceId,
      });
      if (!consentCheck.eligible) {
        excluded.push({ phone: r.normalized_phone, name: r.contact_name, reason: consentCheck.code });
        continue;
      }

      // Check 24h contact frequency cap
      const recentSends = await db.queryOne(
        `SELECT COUNT(*) AS cnt FROM campaign_recipients
         WHERE tenant_id = ? AND normalized_phone = ? AND status IN ('ACCEPTED_BY_META','SENT','DELIVERED','READ')
           AND created_at >= ?`,
        [tid, r.normalized_phone, new Date(Date.now() - 86400000).toISOString().replace("T", " ").slice(0, 19)]
      ).catch(() => ({ cnt: 0 }));

      if (Number(recentSends?.cnt || 0) >= freqCap) {
        excluded.push({ phone: r.normalized_phone, name: r.contact_name, reason: "FREQUENCY_CAP_REACHED" });
        continue;
      }

      eligible.push({
        contact_id: r.contact_id,
        name: r.contact_name || "",
        phone: r.normalized_phone,
        source_recipient_id: r.id,
        read_receipt_status:
          seg === "delivered_not_read" && !anyReadReceiptsObserved
            ? "unknown_read_status"
            : "observed",
      });
    }

    return {
      source_campaign: { id: sourceCamp.id, name: sourceCamp.name },
      engagement_segment: seg,
      read_receipt_observability: anyReadReceiptsObserved ? "confirmed" : "unknown_no_read_receipts_received",
      matched_count: matched.length,
      eligible_count: eligible.length,
      excluded_count: excluded.length,
      repeat_blocked_count: repeatBlocked,
      eligible,
      excluded,
    };
  }

  async function createRetargetingCampaign(tenantId, {
    source_campaign_id,
    engagement_segment,
    campaign_name = null,
    template_id = null,
    template_name = null,
    sender_id = null,
    waba_id = null,
    category = "MARKETING",
    flowbot_id = null,
    automation_id = null,
    scheduled_at = null,
  } = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const preview = await computeEngagementAudience(tid, source_campaign_id, engagement_segment, {
      category,
      enforceAntiRepeat: true,
    });
    if (preview.eligible_count === 0) {
      throw httpError(
        `No eligible contacts found for '${engagement_segment}' after consent, suppression, and anti-repeat checks.`,
        400,
        "RETARGETING_EMPTY_AUDIENCE"
      );
    }

    // Create a real static audience segment for traceability
    const seg = await audienceService.createSegment(tid, {
      name: `Retarget: ${preview.source_campaign.name} (${engagement_segment})`,
      description: `Auto-built from campaign #${source_campaign_id} engagement (${engagement_segment})`,
      segment_type: "static",
      definition: {
        static_contacts: preview.eligible.map((e) => ({
          contact_id: e.contact_id,
          name: e.name,
          phone: e.phone,
        })),
      },
    }, actorId);

    // Create linked follow-up campaign draft
    const sourceCamp = await db.queryOne(`SELECT sender_id, waba_id FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(source_campaign_id)]);
    const camp = await managementService.createCampaign(tid, {
      name: campaign_name || `Retarget (${engagement_segment}) - ${preview.source_campaign.name}`,
      description: `Behavioral retargeting from campaign #${source_campaign_id} (${engagement_segment})`,
      campaign_type: "customer_retention",
      category: String(category || "MARKETING").toUpperCase(),
      segment_id: seg.id,
      sender_id: sender_id || sourceCamp?.sender_id || null,
      waba_id: waba_id || sourceCamp?.waba_id || null,
      template_id: template_id || null,
      template_name: template_name || null,
      flowbot_id: flowbot_id || null,
      automation_id: automation_id || null,
      scheduled_at: scheduled_at || null,
    }, actorId);

    // Record anti-repeat history so same contact is never double-retargeted for the same engagement segment
    for (const e of preview.eligible) {
      try {
        await db.query(
          `INSERT INTO campaign_retargeting_history (tenant_id, source_campaign_id, engagement_segment, normalized_phone, target_campaign_id)
           VALUES (?, ?, ?, ?, ?)`,
          [tid, Number(source_campaign_id), engagement_segment, e.phone, camp.id]
        );
      } catch (_) {}
    }

    await db.query(
      `INSERT INTO campaign_retargeting_runs
       (tenant_id, source_campaign_id, engagement_segment, created_segment_id, created_campaign_id,
        matched_count, eligible_count, excluded_count, repeat_blocked_count, status, summary_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
      [
        tid,
        Number(source_campaign_id),
        engagement_segment,
        seg.id,
        camp.id,
        preview.matched_count,
        preview.eligible_count,
        preview.excluded_count,
        preview.repeat_blocked_count,
        JSON.stringify({ read_receipt_observability: preview.read_receipt_observability }),
        actorId || null,
      ]
    );

    return {
      segment: seg,
      campaign: camp,
      stats: {
        matched_count: preview.matched_count,
        eligible_count: preview.eligible_count,
        excluded_count: preview.excluded_count,
        repeat_blocked_count: preview.repeat_blocked_count,
      },
    };
  }

  async function createRetargetingRule(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    if (!input.name || !input.source_campaign_id || !input.engagement_segment) {
      throw httpError("name, source_campaign_id, and engagement_segment are required", 400, "RULE_INVALID");
    }
    if (!ENGAGEMENT_SEGMENTS.includes(String(input.engagement_segment).toLowerCase())) {
      throw httpError("Invalid engagement_segment", 400, "INVALID_RETARGETING_SEGMENT");
    }
    const res = await db.query(
      `INSERT INTO campaign_retargeting_rules
       (tenant_id, workspace_id, name, source_campaign_id, engagement_segment, delay_hours,
        target_template_id, target_flowbot_id, target_automation_id, stop_conditions_json, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        tid,
        input.workspace_id || null,
        String(input.name).trim(),
        Number(input.source_campaign_id),
        String(input.engagement_segment).toLowerCase(),
        Number(input.delay_hours ?? 48),
        input.target_template_id || null,
        input.target_flowbot_id || null,
        input.target_automation_id || null,
        JSON.stringify(Array.isArray(input.stop_conditions) ? input.stop_conditions : ["replied", "converted", "opted_out"]),
        actorId || null,
      ]
    );
    return db.queryOne(`SELECT * FROM campaign_retargeting_rules WHERE id = ?`, [res.insertId]);
  }

  async function listRetargetingRules(tenantId) {
    const tid = assertTenantId(tenantId);
    const [rules, runs] = await Promise.all([
      db.query(
        `SELECT r.*, c.name AS source_campaign_name
         FROM campaign_retargeting_rules r
         LEFT JOIN campaigns c ON c.id = r.source_campaign_id AND c.tenant_id = r.tenant_id
         WHERE r.tenant_id = ? ORDER BY r.id DESC LIMIT 100`,
        [tid]
      ),
      db.query(
        `SELECT run.*, c.name AS source_campaign_name, tc.name AS target_campaign_name
         FROM campaign_retargeting_runs run
         LEFT JOIN campaigns c ON c.id = run.source_campaign_id AND c.tenant_id = run.tenant_id
         LEFT JOIN campaigns tc ON tc.id = run.created_campaign_id AND tc.tenant_id = run.tenant_id
         WHERE run.tenant_id = ? ORDER BY run.id DESC LIMIT 50`,
        [tid]
      ),
    ]);
    return {
      rules: rules.map((r) => ({ ...r, stop_conditions: safeJsonParse(r.stop_conditions_json, []) })),
      runs,
      supported_segments: ENGAGEMENT_SEGMENTS,
    };
  }

  return {
    ENGAGEMENT_SEGMENTS,
    computeEngagementAudience,
    createRetargetingCampaign,
    createRetargetingRule,
    listRetargetingRules,
  };
}

module.exports = { createRetargetingService, ENGAGEMENT_SEGMENTS };
