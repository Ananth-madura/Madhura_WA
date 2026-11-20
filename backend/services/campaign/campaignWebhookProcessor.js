"use strict";

/**
 * campaignWebhookProcessor.js
 *
 * Enterprise Meta Webhook Processor for Campaigns:
 * - Delivery receipts (sent / delivered / read / failed) with:
 *     - Deduplication via UNIQUE (tenant_id, wamid, event_status)
 *     - Monotonic out-of-order status guard (delivered never downgrades read!)
 *     - Provider wallet settlement on DELIVERED and release on FAILED (provider_managed only)
 * - Inbound replies:
 *     - Automatic opt-out keyword detection (STOP/UNSUBSCRIBE/CANCEL) cancelling queued jobs
 *     - Campaign reply correlation & metrics update
 *     - WhatsApp Flow completion (`nfm_reply`) correlation by `flow_token`
 *     - Triggers attached Madhura Flowbot & Campaign Automations
 * - Template status updates (`message_template_status_update`) pausing affected campaigns
 * - Account updates (`account_update`) syncing Marketing Messages API onboarding status
 */

const { createDbHelper, assertTenantId, normalizePhone, safeJsonParse } = require("./dbHelper");
const { createConsentSuppressionService } = require("./consentSuppressionService");
const { createTemplateManagementService } = require("./templateManagementService");
const { createWhatsAppFlowsService } = require("./whatsappFlowsService");
const { createCampaignJourneyService } = require("./campaignJourneyService");
const { createMarketingMessagesAdapter } = require("./marketingMessagesAdapter");
const { createBillingModeService } = require("../metaBillingModeService");
const { createWalletService } = require("../watiWalletService");

const STATUS_RANK = {
  PENDING: 0,
  QUEUED: 1,
  SUBMITTING: 2,
  ACCEPTED_BY_META: 3,
  UNKNOWN_REQUIRES_RECONCILIATION: 3,
  SENT: 4,
  DELIVERED: 5,
  READ: 6,
  FAILED: 4,
};

function createCampaignWebhookProcessor(options = {}) {
  const db = createDbHelper(options.db);
  const consentService = options.consentService || createConsentSuppressionService({ db: options.db });
  const templateService = options.templateService || createTemplateManagementService({ db: options.db });
  const flowsService = options.flowsService || createWhatsAppFlowsService({ db: options.db });
  const journeyService = options.journeyService || createCampaignJourneyService({ db: options.db, consentService });
  const marketingAdapter = options.marketingAdapter || createMarketingMessagesAdapter({ db: options.db });
  const billingModeService = options.billingModeService || createBillingModeService({ db: options.db });
  const walletService = options.walletService || createWalletService({ db: options.db });

  async function processStatusWebhook(tenantId, statusObj = {}) {
    const tid = assertTenantId(tenantId);
    const wamid = String(statusObj.id || "").trim();
    const rawStatus = String(statusObj.status || "").toUpperCase();
    if (!wamid || !["SENT", "DELIVERED", "READ", "FAILED"].includes(rawStatus)) {
      return { processed: false, reason: "ignored_status" };
    }

    // Deduplicate webhook event
    const existingEvent = await db.queryOne(
      `SELECT id FROM campaign_delivery_events WHERE tenant_id = ? AND wamid = ? AND event_status = ? LIMIT 1`,
      [tid, wamid, rawStatus]
    );
    if (existingEvent) {
      return { processed: false, deduplicated: true, wamid, status: rawStatus };
    }

    const rec = await db.queryOne(
      `SELECT * FROM campaign_recipients WHERE tenant_id = ? AND wamid = ? LIMIT 1`,
      [tid, wamid]
    );

    const errInfo = Array.isArray(statusObj.errors) && statusObj.errors.length ? statusObj.errors[0] : null;
    const providerTs = statusObj.timestamp
      ? new Date(Number(statusObj.timestamp) * 1000).toISOString().replace("T", " ").slice(0, 19)
      : null;

    await db.query(
      `INSERT INTO campaign_delivery_events (
        tenant_id, campaign_id, recipient_id, wamid, event_status,
        provider_timestamp, error_code, error_title, pricing_json, raw_payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        rec?.campaign_id || null,
        rec?.id || null,
        wamid,
        rawStatus,
        providerTs,
        errInfo?.code ? String(errInfo.code) : null,
        errInfo?.title || errInfo?.message || null,
        statusObj.pricing ? JSON.stringify(statusObj.pricing) : null,
        JSON.stringify(statusObj),
      ]
    );

    if (!rec) return { processed: true, matched_recipient: false, wamid, status: rawStatus };

    const currentRank = STATUS_RANK[rec.status] ?? 0;
    const incomingRank = STATUS_RANK[rawStatus] ?? 0;

    // Monotonic status update: e.g., an out-of-order SENT or DELIVERED arriving after READ
    // records timestamps without regressing status!
    const updates = ["updated_at = CURRENT_TIMESTAMP"];
    const params = [];

    if (rawStatus === "SENT" && !rec.sent_at) updates.push("sent_at = CURRENT_TIMESTAMP");
    if (rawStatus === "DELIVERED" && !rec.delivered_at) updates.push("delivered_at = CURRENT_TIMESTAMP");
    if (rawStatus === "READ" && !rec.read_at) {
      updates.push("read_at = CURRENT_TIMESTAMP");
      if (!rec.delivered_at) updates.push("delivered_at = CURRENT_TIMESTAMP");
    }
    if (rawStatus === "FAILED") {
      updates.push("error_code = ?", "error_message = ?");
      params.push(errInfo?.code ? String(errInfo.code) : "META_DELIVERY_FAILED", errInfo?.title || errInfo?.message || "Delivery failed");
    }

    if (incomingRank > currentRank || (rawStatus === "FAILED" && currentRank < STATUS_RANK.DELIVERED)) {
      updates.push("status = ?");
      params.push(rawStatus);
    }

    params.push(rec.id, tid);
    await db.query(`UPDATE campaign_recipients SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`, params);

    // Update campaign aggregate counters idempotently (first time each timestamp is set)
    if (rawStatus === "DELIVERED" && !rec.delivered_at) {
      await db.query(`UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE tenant_id = ? AND id = ?`, [tid, rec.campaign_id]);
      await settleProviderWallet(tid, rec, "delivered", statusObj.pricing);
    } else if (rawStatus === "READ" && !rec.read_at) {
      const alsoDelivered = !rec.delivered_at;
      await db.query(
        `UPDATE campaigns SET read_count = read_count + 1${alsoDelivered ? ", delivered_count = delivered_count + 1" : ""} WHERE tenant_id = ? AND id = ?`,
        [tid, rec.campaign_id]
      );
      if (alsoDelivered) await settleProviderWallet(tid, rec, "delivered", statusObj.pricing);
    } else if (rawStatus === "FAILED" && rec.status !== "FAILED") {
      await db.query(`UPDATE campaigns SET failed_count = failed_count + 1 WHERE tenant_id = ? AND id = ?`, [tid, rec.campaign_id]);
      await settleProviderWallet(tid, rec, "failed", statusObj.pricing);
      if (["132015", "132016"].includes(String(errInfo?.code || ""))) {
        try {
          const { createFailureRecoveryService } = require("./watiUpgrade/failureRecoveryService");
          const recoverySvc = createFailureRecoveryService({ db: options.db });
          await recoverySvc.handleTemplatePacingDetected(tid, {
            campaignId: rec.campaign_id,
            errorCode: String(errInfo.code),
            errorMessage: errInfo.title || errInfo.message || "Meta template pacing pause",
          }).catch(() => {});
        } catch (_) {}
      }
    }

    // Broadcast delivery status into Business Automation Engine (non-blocking / safe if tables not migrated in isolated tests)
    try {
      const { createOrchestrationEngines } = require("../orchestration");
      const { automationEngine } = createOrchestrationEngines({ db: options.db });
      const evtMap = { DELIVERED: "message_delivered", READ: "message_read", FAILED: "message_failed" };
      if (evtMap[rawStatus]) {
        await automationEngine.emitEvent(
          tid,
          evtMap[rawStatus],
          {
            campaign_id: rec.campaign_id,
            recipient_id: rec.id,
            contact_id: rec.contact_id,
            phone: rec.normalized_phone,
            wamid,
            status: rawStatus,
          },
          { source: "campaign_webhook", idempotencyKey: `cmp_st:${wamid}:${rawStatus}` }
        ).catch(() => {});
      }
    } catch (_) {}

    return { processed: true, matched_recipient: true, campaign_id: rec.campaign_id, recipient_id: rec.id, status: rawStatus };
  }

  async function settleProviderWallet(tenantId, rec, outcome, pricing = null) {
    const billingProfile = await billingModeService.getBillingProfile(tenantId).catch(() => ({ billing_mode: "direct_meta" }));
    if (billingProfile.billing_mode !== "provider_managed") return;

    const refId = `cmp:${rec.campaign_id}:rec:${rec.id}`;
    const alreadySettled = await db.queryOne(
      `SELECT id FROM campaign_spend_records WHERE tenant_id = ? AND recipient_id = ? AND record_type IN ('settled','released') LIMIT 1`,
      [tenantId, rec.id]
    );
    if (alreadySettled) return; // Prevent duplicate settlement!

    const amount = Number(rec.estimated_cost_minor || 0);
    if (outcome === "delivered") {
      const billable = pricing ? pricing.billable !== false : true;
      if (billable && amount > 0) {
        await walletService.settleReservation(tenantId, "whatsapp_messaging", amount, refId).catch(() => {});
        await db.query(`UPDATE campaign_recipients SET confirmed_cost_minor = ? WHERE id = ?`, [amount, rec.id]);
        await db.query(`UPDATE campaigns SET confirmed_cost_minor = confirmed_cost_minor + ? WHERE tenant_id = ? AND id = ?`, [amount, tenantId, rec.campaign_id]);
        await db.query(
          `INSERT INTO campaign_spend_records (tenant_id, campaign_id, recipient_id, billing_mode, record_type, amount_minor, reference_id)
           VALUES (?, ?, ?, 'provider_managed', 'settled', ?, ?)`,
          [tenantId, rec.campaign_id, rec.id, amount, refId]
        );
      } else if (amount > 0) {
        await walletService.releaseReservation(tenantId, "whatsapp_messaging", amount, refId).catch(() => {});
        await db.query(
          `INSERT INTO campaign_spend_records (tenant_id, campaign_id, recipient_id, billing_mode, record_type, amount_minor, reference_id)
           VALUES (?, ?, ?, 'provider_managed', 'released', 0, ?)`,
          [tenantId, rec.campaign_id, rec.id, refId]
        );
      }
    } else if (outcome === "failed" && amount > 0) {
      await walletService.releaseReservation(tenantId, "whatsapp_messaging", amount, refId).catch(() => {});
      await db.query(
        `INSERT INTO campaign_spend_records (tenant_id, campaign_id, recipient_id, billing_mode, record_type, amount_minor, reference_id)
         VALUES (?, ?, ?, 'provider_managed', 'released', 0, ?)`,
        [tenantId, rec.campaign_id, rec.id, refId]
      );
    }
  }

  /**
   * Process inbound customer message: opt-out detection, Flow completion (nfm_reply),
   * campaign reply correlation, Flowbot activation & automation triggers.
   */
  async function processInboundMessage(tenantId, messageObj = {}) {
    const tid = assertTenantId(tenantId);
    const fromPhone = messageObj.from;
    const { valid, normalized } = normalizePhone(fromPhone);
    if (!valid) return { processed: false, reason: "invalid_sender_phone" };

    const textBody =
      messageObj.text?.body ||
      messageObj.button?.text ||
      messageObj.interactive?.button_reply?.title ||
      messageObj.interactive?.list_reply?.title ||
      "";

    // 1. Check opt-out keywords first — immediately suppresses & cancels unsent jobs
    if (textBody) {
      const optOut = await consentService.processOptOutKeyword(tid, normalized, textBody);
      if (optOut.matched) {
        await journeyService.stopJourneysForPhone(tid, normalized, "contact_opted_out");
        try {
          const { createDripSequenceService } = require("./watiUpgrade/dripSequenceService");
          await createDripSequenceService({ db: options.db }).handleStopEvent(tid, normalized, "opt_out").catch(() => {});
        } catch (_) {}
        return { processed: true, opted_out: true, keyword: optOut.keyword, ...optOut };
      }
    }

    // 2. Check WhatsApp Flow completion webhook (`interactive.type === 'nfm_reply'`)
    if (messageObj.type === "interactive" && messageObj.interactive?.type === "nfm_reply") {
      const nfm = messageObj.interactive.nfm_reply;
      const responsePayload = safeJsonParse(nfm.response_json, {});
      const flowToken = responsePayload.flow_token || messageObj.context?.flow_token || null;

      const submission = await flowsService.recordFlowSubmission(tid, {
        flowToken,
        normalizedPhone: normalized,
        wamid: messageObj.id || null,
        responsePayload,
      });

      if (submission.campaign_id) {
        await journeyService.triggerCampaignEvent(tid, {
          campaignId: submission.campaign_id,
          triggerEvent: "whatsapp_flow_completed",
          recipientId: submission.recipient_id,
          contactId: submission.contact_id,
          phone: normalized,
          sourceEventKey: `flow_sub:${submission.submission_id}`,
          context: { submission_id: submission.submission_id, response: responsePayload },
        });
      }

      return { processed: true, type: "flow_submission", ...submission };
    }

    // 3. Correlate reply with most recent campaign sent to this recipient (or context.id wamid)
    let recipient = null;
    if (messageObj.context?.id) {
      recipient = await db.queryOne(
        `SELECT * FROM campaign_recipients WHERE tenant_id = ? AND wamid = ? LIMIT 1`,
        [tid, String(messageObj.context.id)]
      );
    }
    if (!recipient) {
      recipient = await db.queryOne(
        `SELECT * FROM campaign_recipients
         WHERE tenant_id = ? AND normalized_phone = ? AND status IN ('ACCEPTED_BY_META','SENT','DELIVERED','READ')
         ORDER BY submitted_at DESC LIMIT 1`,
        [tid, normalized]
      );
    }

    if (!recipient) {
      return { processed: true, matched_campaign: false };
    }

    const firstReply = !recipient.replied_at;
    if (firstReply) {
      await db.query(
        `UPDATE campaign_recipients SET replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`,
        [recipient.id, tid]
      );
      await db.query(
        `UPDATE campaigns SET reply_count = reply_count + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`,
        [tid, recipient.campaign_id]
      );
    }

    const eventType = messageObj.type === "button" || messageObj.interactive?.button_reply ? "quick_reply_clicked" : "customer_replied";
    await db.query(
      `INSERT INTO campaign_engagement_events (
        tenant_id, campaign_id, recipient_id, contact_id, normalized_phone, event_type, wamid, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        recipient.campaign_id,
        recipient.id,
        recipient.contact_id,
        normalized,
        eventType,
        messageObj.id || null,
        JSON.stringify({ text: textBody.slice(0, 500), type: messageObj.type }),
      ]
    );

    // Trigger attached Flowbot if bound
    const flowbotBinding = await db.queryOne(
      `SELECT * FROM campaign_flowbot_bindings WHERE tenant_id = ? AND campaign_id = ? AND is_active = 1 LIMIT 1`,
      [tid, recipient.campaign_id]
    );
    let flowbotState = null;
    if (flowbotBinding) {
      const wantsHuman = /\b(human|agent|representative|support|talk to someone)\b/i.test(textBody);
      flowbotState = await journeyService.advanceFlowbotState(tid, {
        flowbotId: flowbotBinding.flowbot_id,
        campaignId: recipient.campaign_id,
        recipientId: recipient.id,
        contactId: recipient.contact_id,
        phone: normalized,
        answer: { last_reply: textBody },
        requestHandover: wantsHuman,
      });
    }

    // Trigger campaign automation bindings
    const automation = await journeyService.triggerCampaignEvent(tid, {
      campaignId: recipient.campaign_id,
      triggerEvent: eventType,
      recipientId: recipient.id,
      contactId: recipient.contact_id,
      phone: normalized,
      sourceEventKey: `msg:${messageObj.id || Date.now()}`,
      context: { text: textBody, wamid: messageObj.id || null },
    });

    // Also emit into Enterprise Automation Engine for durable multi-step workflows
    try {
      const { createOrchestrationEngines } = require("../orchestration");
      const { automationEngine } = createOrchestrationEngines({ db: options.db });
      await automationEngine.emitEvent(
        tid,
        "campaign_replied",
        {
          campaign_id: recipient.campaign_id,
          recipient_id: recipient.id,
          contact_id: recipient.contact_id,
          phone: normalized,
          text: textBody,
          wamid: messageObj.id || null,
        },
        { source: "campaign_webhook", idempotencyKey: `cmp_rep:${messageObj.id || `${recipient.id}:${Date.now()}`}` }
      ).catch(() => {});
    } catch (_) {}

    // Notify drip sequence engine of customer reply (honoring stop vs route_flowbot config)
    try {
      const { createDripSequenceService } = require("./watiUpgrade/dripSequenceService");
      await createDripSequenceService({ db: options.db }).handleStopEvent(tid, normalized, "reply").catch(() => {});
    } catch (_) {}

    return {
      processed: true,
      matched_campaign: true,
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      first_reply: firstReply,
      flowbot_state: flowbotState,
      automation,
    };
  }

  /**
   * Process Meta webhook envelope (`entry[].changes[]`) for a resolved tenant.
   */
  async function processMetaWebhookPayload(tenantId, body = {}) {
    const tid = assertTenantId(tenantId);
    const results = { statuses: [], messages: [], template_updates: [], account_updates: [] };

    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        const field = change.field;
        const val = change.value || {};

        if (field === "messages") {
          for (const st of val.statuses || []) {
            results.statuses.push(await processStatusWebhook(tid, st));
          }
          for (const msg of val.messages || []) {
            results.messages.push(await processInboundMessage(tid, msg));
          }
        } else if (field === "message_template_status_update") {
          const tmpl = await db.queryOne(
            `SELECT id, meta_status FROM wa_templates WHERE tenant_id = ? AND (meta_template_id = ? OR name = ?) LIMIT 1`,
            [tid, String(val.message_template_id || ""), String(val.message_template_name || "")]
          );
          if (tmpl) {
            results.template_updates.push(
              await templateService.handleTemplateStatusTransition(
                tid,
                tmpl.id,
                tmpl.meta_status,
                val.event || val.status,
                val.reason || null,
                "webhook"
              )
            );
            if (String(val.event || val.status || "").toUpperCase() === "APPROVED") {
              try {
                const { createGuidedSetupAndAnalyticsService } = require("./watiUpgrade/guidedSetupAndAnalyticsService");
                await createGuidedSetupAndAnalyticsService({ db: options.db }).evaluatePendingAutoLaunches(tid).catch(() => {});
              } catch (_) {}
            }
          }
        } else if (field === "account_update") {
          const wabaId = val.waba_info?.waba_id || entry.id;
          if (wabaId) {
            results.account_updates.push(
              await marketingAdapter.updateFromAccountWebhook(tid, String(wabaId), val)
            );
          }
        }
      }
    }
    return results;
  }

  return {
    processStatusWebhook,
    processInboundMessage,
    processMetaWebhookPayload,
  };
}

module.exports = { createCampaignWebhookProcessor, STATUS_RANK };
