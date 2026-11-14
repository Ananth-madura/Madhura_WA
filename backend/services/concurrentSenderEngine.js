"use strict";

const crypto = require("crypto");
const axios = require("axios");
const { decrypt } = require("../backendutil/cryptoHelper");
const waCloud = require("./whatsappCloudApi");

const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const positiveId = (value, label = "Record ID") => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw failure(`A valid ${label} is required`);
  return id;
};

/**
 * Token Bucket implementation for rate limiting per WABA and per Sender.
 */
class TokenBucket {
  constructor({ capacity = 80, refillRatePerSec = 80 }) {
    this.capacity = capacity;
    this.refillRate = refillRatePerSec;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillRate);
      this.lastRefill = now;
    }
  }

  async acquire(tokensNeeded = 1, maxWaitMs = 10000) {
    const start = Date.now();
    while (true) {
      this.refill();
      if (this.tokens >= tokensNeeded) {
        this.tokens -= tokensNeeded;
        return true;
      }
      const neededWait = Math.ceil(((tokensNeeded - this.tokens) / this.refillRate) * 1000);
      const remainingBudget = maxWaitMs - (Date.now() - start);
      if (neededWait > remainingBudget) {
        throw failure("WABA rate limit capacity reached. Please try again shortly.", 429);
      }
      const sleepTime = Math.min(neededWait, 250);
      await new Promise(resolve => setTimeout(resolve, sleepTime));
    }
  }
}

function createConcurrentEngine(db, transport = axios) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];

  // In-memory rate limiters per WABA ID
  const wabaBuckets = new Map();
  // In-flight concurrency counters per Sender ID
  const inFlightPerSender = new Map();

  function getWabaBucket(wabaId) {
    const key = String(wabaId || "default");
    if (!wabaBuckets.has(key)) {
      wabaBuckets.set(key, new TokenBucket({ capacity: 80, refillRatePerSec: 80 }));
    }
    return wabaBuckets.get(key);
  }

  /**
   * Resolves the exact sender to use for outbound message.
   * Priority: explicit senderId > branch assigned sender > default tenant sender > first connected sender.
   */
  async function resolveOutboundSender(tenantId, senderId = null, branchId = null) {
    const tid = positiveId(tenantId, "organization ID");

    const select = `
      SELECT s.*, w.encrypted_token, w.waba_id, w.rate_limit_tier
      FROM wa_senders s
      JOIN waba_connections w ON w.id=s.waba_connection_id AND w.tenant_id=s.tenant_id
      WHERE s.tenant_id=? AND s.status='connected'
    `;

    let sender = null;
    if (senderId) {
      const [row] = await q(`${select} AND s.id=? LIMIT 1`, [tid, Number(senderId)]);
      if (row) sender = row;
    }

    if (!sender && branchId) {
      const [branchSender] = await q(
        `${select} JOIN sender_branch_assignments a ON a.sender_id=s.id AND a.tenant_id=s.tenant_id
         WHERE s.tenant_id=? AND a.branch_id=?
         ORDER BY a.is_default DESC, s.id ASC LIMIT 1`,
        [tid, Number(branchId)]
      );
      if (branchSender) sender = branchSender;
    }

    if (!sender) {
      const [defaultSender] = await q(
        `${select} AND s.is_default=1 LIMIT 1`,
        [tid]
      );
      if (defaultSender) sender = defaultSender;
    }

    if (!sender) {
      const [sharedSender] = await q(
        `${select} AND s.is_shared=1 ORDER BY s.id ASC LIMIT 1`,
        [tid]
      );
      if (sharedSender) sender = sharedSender;
    }

    if (!sender) {
      const [anySender] = await q(
        `${select} ORDER BY s.id ASC LIMIT 1`,
        [tid]
      );
      if (anySender) sender = anySender;
    }

    if (!sender) {
      // Fallback for single-tenant default dev environment
      if (tid === 1 && process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) {
        return {
          id: null,
          tenant_id: 1,
          phone_number_id: process.env.WA_PHONE_NUMBER_ID,
          encrypted_token: null,
          raw_token: process.env.WA_ACCESS_TOKEN,
          display_phone: process.env.WA_DISPLAY_PHONE_NUMBER || "",
          verified_name: process.env.WA_VERIFIED_NAME || "Default WhatsApp",
          waba_id: process.env.WA_WABA_ID || "env_waba",
          quality: "GREEN",
          messaging_tier: "TIER_1K",
        };
      }
      throw failure(`No active WhatsApp sender is connected for organization ${tid}`, 404);
    }

    return sender;
  }

  /**
   * Concurrently dispatches an outbound WhatsApp message via Meta Cloud API.
   * Enforces WABA token-bucket rate limits and sender concurrency.
   */
  async function dispatchMessage({
    tenantId,
    senderId = null,
    branchId = null,
    to,
    type = "text",
    text = "",
    template = null,
    interactive = null,
    media = null,
    context = {},
  }) {
    const tid = positiveId(tenantId, "organization ID");
    if (!to || typeof to !== "string") throw failure("Recipient phone number is required");

    let cleanTo = to.replace(/@c\.us$/i, "").replace(/\D/g, "");
    if (cleanTo.length === 10) cleanTo = `91${cleanTo}`;
    if (cleanTo.length < 10) throw failure("Invalid recipient phone number format");

    const sender = await resolveOutboundSender(tid, senderId, branchId);
    const sid = sender.id || "env";
    const token = sender.raw_token || (sender.encrypted_token ? decrypt(sender.encrypted_token) : "");
    if (!token) throw failure("Sender has no valid access token saved", 400);

    // 0. Pre-flight Meta Messaging Limit Check
    const limitEngine = require("./metaMessagingLimitEngine").createLimitEngine({ db });
    const pricingEngine = require("./metaMessagePricingEngine").createPricingEngine({ db });
    const billingModeService = require("./metaBillingModeService").createBillingModeService({ db });

    const limitPrecheck = await limitEngine.canDispatch({
      tenantId: tid,
      accountId: sender.waba_id,
      recipientPhone: cleanTo,
      isCustomerInitiated: Boolean(context.isCustomerInitiated)
    }).catch(() => ({ allowed: true }));

    if (!limitPrecheck.allowed) {
      throw failure(`Meta daily messaging limit reached for organization ${tid}: tier capacity of ${limitPrecheck.max_daily_recipients} unique contacts reached.`, 429);
    }

    // 0.1 Determine Category & Billing Profile
    const profile = await billingModeService.getBillingProfile(tid).catch(() => ({ billing_mode: "direct_meta" }));
    const category = context.category || (type === "template" ? "marketing" : "service");

    // 0.2 Reserve message cost in ledger
    const reservation = await pricingEngine.reserveMessageCost({
      tenantId: tid,
      accountId: sender.waba_id,
      phoneNumberId: sender.phone_number_id,
      recipientPhone: cleanTo,
      category,
      billingMode: profile.billing_mode,
      campaignId: context.campaignId || null
    }).catch(() => null);

    // 1. Acquire WABA Token Bucket permission
    const bucket = getWabaBucket(sender.waba_id);
    await bucket.acquire(1, 10000);

    // 2. Track in-flight sender concurrency
    const currentInFlight = inFlightPerSender.get(sid) || 0;
    inFlightPerSender.set(sid, currentInFlight + 1);

    const graphVersion = process.env.WA_GRAPH_API_VERSION || "v22.0";
    const endpoint = `https://graph.facebook.com/${graphVersion}/${sender.phone_number_id}/messages`;

    // Construct Meta Cloud API payload
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanTo,
    };

    if (type === "text" || (!template && !interactive && !media)) {
      body.type = "text";
      body.text = { preview_url: false, body: text || " " };
    } else if (type === "template" && template) {
      body.type = "template";
      body.template = template;
    } else if (type === "interactive" && interactive) {
      body.type = "interactive";
      body.interactive = interactive;
    } else if (["image", "video", "audio", "document", "sticker"].includes(type) && media) {
      body.type = type;
      body[type] = media;
    } else {
      body.type = "text";
      body.text = { preview_url: false, body: text || " " };
    }

    const start = Date.now();
    let metaRes;
    let errorOccurred = null;

    try {
      const res = await transport.post(endpoint, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
        maxRedirects: 0,
      });
      metaRes = res.data;
    } catch (err) {
      errorOccurred = err;
    } finally {
      const active = inFlightPerSender.get(sid) || 1;
      inFlightPerSender.set(sid, Math.max(0, active - 1));
    }

    const latencyMs = Date.now() - start;

    if (errorOccurred) {
      const metaErr = errorOccurred.response?.data?.error;
      const errorMsg = metaErr?.message || errorOccurred.message || "Meta API send failed";
      const errorCode = metaErr?.code || 500;

      // Record failed message log
      await q(
        `INSERT INTO wa_message_logs (
          tenant_id, sender_id, branch_id, phone, direction, message_type,
          message_text, status, created_at
        ) VALUES (?, ?, ?, ?, 'outbound', ?, ?, 'failed', NOW())`,
        [tid, sender.id, branchId || null, cleanTo, type, text || (template ? template.name : type)]
      ).catch(() => {});

      // Record failure metric
      await recordMetric(tid, sender.id, "failed");

      // Release reserved message cost if send failed
      if (reservation?.message_id) {
        await pricingEngine.releaseFailedMessage({
          tenantId: tid,
          messageId: reservation.message_id,
          failureReason: errorMsg
        }).catch(() => {});
      }

      const customErr = failure(`WhatsApp dispatch error [${errorCode}]: ${errorMsg}`, errorOccurred.response?.status || 502);
      customErr.metaError = metaErr;
      customErr.latencyMs = latencyMs;
      throw customErr;
    }

    const metaMessageId = metaRes?.messages?.[0]?.id || `wamid.synth_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Record initial status as 'sent' (never optimistic 'delivered'; real webhooks will transition it)
    await q(
      `INSERT INTO wa_message_logs (
        tenant_id, sender_id, branch_id, phone, direction, message_type,
        message_text, wa_message_id, status, created_at
      ) VALUES (?, ?, ?, ?, 'outbound', ?, ?, ?, 'sent', NOW())`,
      [tid, sender.id, branchId || null, cleanTo, type, text || (template ? template.name : type), metaMessageId]
    ).catch(() => {});

    // Record dispatch into rolling 24-hour limit window
    await limitEngine.recordDispatch({
      tenantId: tid,
      accountId: sender.waba_id,
      recipientPhone: cleanTo,
      isCustomerInitiated: Boolean(context.isCustomerInitiated)
    }).catch(() => {});

    // Update message_billing_records with metaMessageId
    if (reservation?.message_id) {
      await q(
        "UPDATE message_billing_records SET status='sent', meta_message_id=?, updated_at=NOW() WHERE message_id=?",
        [metaMessageId, reservation.message_id]
      ).catch(() => {});
    }

    // Update sender daily sent counter
    if (sender.id) {
      await q(
        "UPDATE wa_senders SET current_day_sent=current_day_sent+1, updated_at=NOW() WHERE id=?",
        [sender.id]
      ).catch(() => {});
    }

    // Record sent metric
    await recordMetric(tid, sender.id, "sent");

    return {
      success: true,
      metaMessageId,
      status: "sent",
      senderId: sender.id,
      displayPhone: sender.display_phone,
      verifiedName: sender.verified_name,
      wabaId: sender.waba_id,
      recipient: cleanTo,
      latencyMs,
    };
  }

  /**
   * Records hourly/daily message throughput per sender for capacity monitoring.
   */
  async function recordMetric(tenantId, senderId, status) {
    if (!tenantId || !senderId) return;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hour = now.getUTCHours();

    const columnMap = {
      sent: "messages_sent",
      delivered: "messages_delivered",
      read: "messages_read",
      failed: "messages_failed",
    };
    const col = columnMap[status];
    if (!col) return;

    await q(
      `INSERT INTO wa_sender_metrics (
        tenant_id, sender_id, metric_date, metric_hour, ${col}
      ) VALUES (?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE ${col}=${col}+1, updated_at=NOW()`,
      [tenantId, senderId, dateStr, hour]
    ).catch(() => {});
  }

  /**
   * Webhook status listener: updates real status from Meta (delivered, read, failed).
   */
  async function recordWebhookStatus({ waMessageId, status, timestamp, recipientId = null, errorCode = null, errorMessage = null }) {
    if (!waMessageId) return false;

    const normalizedStatus = ["delivered", "read", "failed"].includes(status) ? status : "delivered";

    const [msgRow] = await q(
      "SELECT id, tenant_id, sender_id, status FROM wa_message_logs WHERE wa_message_id=? LIMIT 1",
      [waMessageId]
    );

    if (msgRow) {
      // Never downgrade 'read' to 'delivered'
      if (msgRow.status === "read" && normalizedStatus === "delivered") {
        return true;
      }

      await q(
        "UPDATE wa_message_logs SET status=?, updated_at=NOW() WHERE id=?",
        [normalizedStatus, msgRow.id]
      ).catch(() => {});

      // Settle or release message billing cost upon real delivery confirmation
      const pricingEngine = require("./metaMessagePricingEngine").createPricingEngine({ db });
      if (normalizedStatus === "delivered") {
        await pricingEngine.settleDeliveredMessage({
          tenantId: msgRow.tenant_id,
          metaMessageId: waMessageId
        }).catch(() => {});
      } else if (normalizedStatus === "failed") {
        await pricingEngine.releaseFailedMessage({
          tenantId: msgRow.tenant_id,
          metaMessageId: waMessageId,
          failureReason: errorMessage || "WEBHOOK_DELIVERY_FAILED"
        }).catch(() => {});
      }

      if (msgRow.tenant_id && msgRow.sender_id) {
        await recordMetric(msgRow.tenant_id, msgRow.sender_id, normalizedStatus);
      }
      return true;
    }
    return false;
  }

  /**
   * Diagnostics: inspect active WABA rate limiting & sender concurrency status.
   */
  function getDiagnostics() {
    const wabas = [];
    for (const [wId, bucket] of wabaBuckets.entries()) {
      bucket.refill();
      wabas.push({
        wabaId: wId,
        availableTokens: Math.round(bucket.tokens),
        capacity: bucket.capacity,
        refillRate: bucket.refillRate,
      });
    }

    const senders = [];
    for (const [sId, inFlight] of inFlightPerSender.entries()) {
      senders.push({
        senderId: sId,
        inFlightRequests: inFlight,
      });
    }

    return {
      activeWabaBuckets: wabas,
      senderConcurrency: senders,
    };
  }

  return {
    dispatchMessage,
    resolveOutboundSender,
    recordWebhookStatus,
    recordMetric,
    getDiagnostics,
    getWabaBucket,
  };
}

module.exports = { createConcurrentEngine };

