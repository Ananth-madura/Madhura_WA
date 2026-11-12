"use strict";

const DEFAULT_OPT_OUT_KEYWORDS = [
  "stop",
  "unsubscribe",
  "optout",
  "opt out",
  "stop promo",
  "cancel",
  "quit",
  "end",
  "remove me",
  "no more",
  "don't message",
  "dont message",
];

function cleanPhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

function isOptOutMessage(text) {
  const norm = String(text || "").trim().toLowerCase();
  if (!norm) return null;
  return (
    DEFAULT_OPT_OUT_KEYWORDS.find((kw) => norm === kw || norm.startsWith(`${kw} `)) ||
    null
  );
}

function createPipeline(deps = {}) {
  const getDb = () => deps.db || require("../config/database");
  const q = async (sql, params = []) => (await getDb().promise().query(sql, params))[0];
  const getWebhook = () => deps.webhookForwarder || require("./crmWebhookForwarder");
  const getLeadCapture = () => deps.leadCapture || require("./waLeadCapture");
  const getCampaigns = () => deps.campaignEngine || require("./waCampaignEngine");
  const getConfirmation = () => deps.confirmationService || require("./waConfirmationService");
  const getBilling = () => deps.billingService || require("./waCustomerBillingService");
  const getAutomation = () => deps.automationService || require("./waAutomationService");
  const getAutomationInbound = () => deps.automationInbound || require("./automationInbound");
  const getCheckpoints = () => deps.checkpointService || require("./waAutomationCheckpointService");
  const getSharedFlow = () => deps.sharedFlowRuntime || require("./sharedFlowRuntime");
  const getFlowEngine = () => deps.flowEngine || require("./waFlowEngine");
  const getMenuHandler = () => deps.menuHandler || require("./waMenuHandler");
  const getBotGate = () => deps.botGate || require("./waBotGate");
  const getInboxAssistant = () => deps.inboxAssistant || require("./sharedInboxAssistant");
  const getAiReply = () => deps.waAiReply || require("./waAiReply");

  async function processInbound(ctx = {}) {
    const cleanPhone = cleanPhoneNumber(ctx.phone);
    if (!cleanPhone || cleanPhone.length < 8) {
      return { handled: false, stage: "invalid_phone" };
    }

    const p10 = cleanPhone.slice(-10);
    const chatId = ctx.chatId || `${cleanPhone}@c.us`;
    const sessionKey = ctx.sessionKey != null ? String(ctx.sessionKey) : null;
    const messageText = String(ctx.messageText || "");
    const messageType = String(ctx.messageType || "text");
    const msgId = ctx.messageId || `in_${Date.now()}`;
    const contactName = ctx.contactName || null;
    const interactiveId = ctx.interactiveId || null;
    const timestampSec = Number(ctx.timestampSec || Math.floor(Date.now() / 1000));
    const sharedConv = ctx.sharedConversation || null;
    const senderId = ctx.senderId || sharedConv?.sender_id || null;
    const channel = ctx.channel || (sharedConv ? "cloud_shared" : "direct");
    const isNew = Boolean(sharedConv?.isNew || ctx.isNew);
    const maxAgeMs = Number(ctx.maxAgeMs || 120000);

    let tenantId = Number(ctx.tenantId || sharedConv?.tenant_id) || null;
    if (!tenantId && sessionKey) {
      try {
        tenantId = await require("./waContactTenancy").tenantForSessionKey(sessionKey);
      } catch (_) {}
    }

    // 1. Non-blocking Auto Lead Capture across ALL channels (including Shared Inbox)
    if (!ctx.skipLeadCapture) {
      Promise.resolve()
        .then(() =>
          getLeadCapture().captureLeadFromWhatsApp({
            tenantId: tenantId || undefined,
            phone: cleanPhone,
            sessionKey,
            name: contactName || undefined,
            notes: messageText.slice(0, 500) || `Customer messaged via ${channel}`,
            sourceDetail: sharedConv ? "WhatsApp Shared Inbox" : channel === "web_session" ? "WhatsApp Web Inbound" : "WhatsApp Cloud API Inbound",
          })
        )
        .catch(() => {});
    }

    // 2. Non-blocking External CRM Webhook Forward
    try {
      getWebhook().forwardIncomingMessage({
        tenantId,
        sessionKey,
        chatId,
        phone: cleanPhone,
        message: {
          id: msgId,
          from: cleanPhone,
          body: messageText,
          type: messageType,
          interactiveId,
          conversationId: sharedConv?.id || null,
          channel,
          timestamp: timestampSec,
        },
      });
    } catch (_) {}

    // 3. Opt-out / STOP Handling (strictly tenant-scoped, always runs even when paused)
    const matchedKeyword = isOptOutMessage(messageText);
    if (matchedKeyword) {
      const optTenant =
        tenantId ||
        (await require("./waContactTenancy")
          .tenantForContactWrite({ tenantId, sessionKey })
          .catch(() => 1));
      try {
        await q(
          "INSERT IGNORE INTO wa_opt_outs (tenant_id, phone, reason, opt_out_keyword) VALUES (?, ?, 'user_request', ?)",
          [optTenant, cleanPhone, matchedKeyword]
        );
        await q(
          "UPDATE wa_contacts SET is_unsubscribed = 1, opt_in_status = 0, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND phone LIKE ?",
          [optTenant, `%${p10}`]
        );
        await q(
          "UPDATE wa_campaign_messages SET status = 'opted_out', opt_out = 1, error = 'User opted out' WHERE tenant_id = ? AND phone = ? AND status = 'queued'",
          [optTenant, cleanPhone]
        );
        if (sharedConv) {
          await getInboxAssistant().pause(optTenant, sharedConv.id).catch(() => {});
        }
        getWebhook()
          .sendTenantEvent?.(optTenant, "contact.opted_out", { phone: cleanPhone, keyword: matchedKeyword })
          ?.catch?.(() => {});
        if (typeof ctx.onOptOutConfirm === "function") {
          await ctx.onOptOutConfirm(matchedKeyword).catch(() => {});
        }
      } catch (err) {
        console.warn("[UnifiedChatPipeline] Opt-out handling warning:", err.message);
      }
      return { handled: true, stage: "opt_out", keyword: matchedKeyword };
    }

    // 4. Stale Webhook Replay Guard
    if (!ctx.bypassStaleGuard && Math.abs(Date.now() - timestampSec * 1000) > maxAgeMs) {
      return { handled: false, stage: "stale" };
    }

    // 5. Campaign Reply Attribution (runs on ALL channels including Shared Inbox)
    let campaignReply = { isCampaignReply: false };
    try {
      campaignReply =
        (await getCampaigns().checkAndRecordCampaignReply(cleanPhone, messageText, tenantId)) || {
          isCampaignReply: false,
        };
    } catch (_) {}
    const isCampaignReply = Boolean(campaignReply?.isCampaignReply);

    if (isCampaignReply && typeof ctx.onCampaignReply === "function") {
      try {
        await ctx.onCampaignReply(campaignReply);
      } catch (_) {}
    }

    // 6. 2-Way Interactive Confirmation & Customer Bill Keyword Resolution
    try {
      const confirmationHandled = await getConfirmation().handleInboundConfirmation(
        cleanPhone,
        messageText,
        interactiveId,
        sessionKey,
        chatId
      );
      if (confirmationHandled) return { handled: true, stage: "confirmation" };
    } catch (_) {}

    try {
      const billHandled = await getBilling().handleInboundBillKeyword(cleanPhone, messageText, sessionKey);
      if (billHandled) return { handled: true, stage: "billing_keyword" };
    } catch (_) {}

    // 7. Strict Human Takeover Gate + Explicit Keyword Restart
    const gate = await getBotGate()
      .shouldBotEngage(cleanPhone, { isCampaignReply, tenantId, sessionKey })
      .catch(() => ({ allowed: true, reason: null }));

    if (!gate.allowed && ["contact_blocked", "contact_unsubscribed", "bot_disabled_for_contact"].includes(gate.reason)) {
      return { handled: false, stage: gate.reason };
    }

    const convHumanPaused =
      Boolean(sharedConv) &&
      sharedConv.automation_mode === "human" &&
      Number(sharedConv.automation_version) > 0;
    const humanPaused = (!gate.allowed && gate.reason === "agent_takeover") || convHumanPaused;

    const effectiveInput = interactiveId || messageText;
    const inboundMedia = ctx.inboundMedia || null;

    if (humanPaused) {
      // Explicit restart allowed ONLY for strict keyword-triggered flows configured to restart after human reply
      if (sharedConv && ["text", "interactive", "button"].includes(messageType)) {
        const flowHandled = await getSharedFlow()
          .handle(tenantId, sharedConv.id, msgId, effectiveInput, isNew)
          .catch(() => false);
        if (flowHandled) return { handled: true, stage: "shared_flow_keyword_restart" };
      }
      return { handled: false, stage: "human_paused" };
    }

    // 8. Campaign-Linked Flow Bot Auto-Launch
    if (campaignReply?.flowId) {
      try {
        if (sharedConv) {
          await getSharedFlow().start(tenantId, sharedConv.id, campaignReply.flowId, null);
          return { handled: true, stage: "campaign_shared_flow" };
        }
        const [flowRows] = await getDb().promise().query(
          `SELECT * FROM wa_flows WHERE ${tenantId ? "tenant_id = ? AND " : ""}id = ? AND status = 'active' LIMIT 1`,
          tenantId ? [tenantId, campaignReply.flowId] : [campaignReply.flowId]
        );
        if (flowRows?.length) {
          await getFlowEngine().startFlowRun(flowRows[0], cleanPhone, sessionKey, messageText, chatId, {
            _tenant_id: tenantId,
          });
          return { handled: true, stage: "campaign_direct_flow" };
        }
      } catch (cfErr) {
        console.warn("[UnifiedChatPipeline] Campaign flow launch warning:", cfErr.message);
      }
    }

    // 9. Shared Inbox Conversation Orchestration
    if (sharedConv) {
      if (!["text", "interactive", "button", "image", "document", "video", "audio"].includes(messageType)) {
        return { handled: false, stage: "ignored_type" };
      }

      if (["text", "interactive", "button"].includes(messageType)) {
        try {
          if (await getAutomationInbound().handle(tenantId, senderId, sharedConv, msgId, effectiveInput, isNew)) {
            return { handled: true, stage: "automation_inbound" };
          }
        } catch (_) {}

        // Trigger active Automation Rules matching inbound events / keywords / buttons
        if (tenantId) {
          const eventData = {
            message: messageText,
            message_text: messageText,
            keyword: messageText,
            interactiveId,
            button_id: interactiveId,
            channel,
            conversation_id: sharedConv.id,
          };
          const autoTrigger = interactiveId ? "button_clicked" : messageText ? "keyword_detected" : "incoming_message";
          const autoRes = await getAutomation()
            .triggerAutomation(autoTrigger, { tenantId, phone: cleanPhone, contactName, eventId: msgId, sessionKey, chatId, data: eventData }, { senderId })
            .catch(() => null);
          if (autoRes?.triggeredCount > 0) return { handled: true, stage: `automation_${autoTrigger}` };
          if (autoTrigger !== "incoming_message") {
            const msgRes = await getAutomation()
              .triggerAutomation("incoming_message", { tenantId, phone: cleanPhone, contactName, eventId: `${msgId}:in`, sessionKey, chatId, data: eventData }, { senderId })
              .catch(() => null);
            if (msgRes?.triggeredCount > 0) return { handled: true, stage: "automation_incoming_message" };
          }
        }
      }

      const flowHandled = await getSharedFlow()
        .handle(tenantId, sharedConv.id, msgId, effectiveInput, isNew)
        .catch(() => false);
      if (flowHandled) return { handled: true, stage: "shared_flow" };

      if (!isCampaignReply && messageType === "text") {
        try {
          getInboxAssistant().enqueue(tenantId, sharedConv.id, msgId, messageText, isNew);
          return { handled: true, stage: "shared_ai_enqueued" };
        } catch (_) {}
      }
      return { handled: false, stage: "shared_inbox_open" };
    }

    // 10. Direct Cloud / WhatsApp Web QR Orchestration
    try {
      const checkpoint = await getCheckpoints().findActiveCheckpoint(tenantId || sessionKey, cleanPhone);
      if (checkpoint) {
        const contactRow = gate.contact || { phone: cleanPhone, name: contactName || `+${cleanPhone}` };
        const resumed = await getCheckpoints().resumeCheckpoint(tenantId || sessionKey, null, checkpoint, effectiveInput, contactRow);
        if (resumed) return { handled: true, stage: "automation_checkpoint" };
      }
    } catch (_) {}

    if (tenantId) {
      const eventData = {
        message: messageText,
        message_text: messageText,
        keyword: messageText,
        interactiveId,
        button_id: interactiveId,
        channel,
      };
      const autoTrigger = interactiveId ? "button_clicked" : messageText ? "keyword_detected" : "incoming_message";
      const autoRes = await getAutomation()
        .triggerAutomation(autoTrigger, { tenantId, phone: cleanPhone, contactName, eventId: msgId, sessionKey, chatId, data: eventData }, {})
        .catch(() => null);
      if (autoRes?.triggeredCount > 0) return { handled: true, stage: `automation_${autoTrigger}` };
    }

    const flowHandled = await getFlowEngine()
      .dispatchInbound(cleanPhone, messageText, interactiveId, sessionKey, inboundMedia, {
        isCampaignReply,
        isHistoric: false,
        chatId,
        _tenant_id: tenantId,
      })
      .catch(() => false);
    if (flowHandled) return { handled: true, stage: "direct_flow" };

    const menuHandled = await getMenuHandler()
      .handleMenuReply(cleanPhone, { text: messageText, buttonReplyId: interactiveId, listReplyId: interactiveId }, sessionKey)
      .catch(() => false);
    if (menuHandled) return { handled: true, stage: "menu_handler" };

    if (messageText) {
      const welcomeSent = await getAutomation()
        .maybeSendWelcomeReply(chatId || cleanPhone, contactName, sessionKey, { isCampaignReply, tenantId })
        .catch(() => false);
      if (welcomeSent) return { handled: true, stage: "welcome_reply" };

      if (!isCampaignReply) {
        await getAiReply().maybeAutoReply(chatId || cleanPhone, messageText, contactName, sessionKey).catch(() => {});
        return { handled: true, stage: "direct_ai_checked" };
      }
    }

    return { handled: false, stage: "completed" };
  }

  return { processInbound, cleanPhoneNumber, isOptOutMessage };
}

const defaultPipeline = createPipeline();
defaultPipeline.createPipeline = createPipeline;
module.exports = defaultPipeline;
