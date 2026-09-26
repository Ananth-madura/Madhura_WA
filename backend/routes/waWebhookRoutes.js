const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../config/database");
const wa = require("../services/whatsappCloudApi");
const waAiReply = require("../services/waAiReply");

// Opt-out keywords (case-insensitive)
const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "opt out", "optout", "cancel", "quit", "end", "remove me", "no more"];

router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // If Meta Cloud API verification request
  if (mode || token || challenge) {
    const result = wa.verifyWebhook(mode, token, challenge);
    if (result) {
      return res.status(200).send(result);
    }
    return res.status(403).send("Forbidden: Invalid verification token");
  }

  // Friendly status for browser/health probes
  res.status(200).json({
    ok: true,
    service: "Madhura Tech WhatsApp Cloud API Webhook",
    status: "active",
    timestamp: new Date().toISOString(),
  });
});

function isValidSignature(req) {
  const appSecret = process.env.WA_APP_SECRET;
  if (!appSecret) return true; // signature check only enforced when an app secret is configured
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !req.rawBody) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
}

router.post("/", async (req, res) => {
  try {
    if (!isValidSignature(req)) return res.sendStatus(403);
    const body = req.body;

    await db.promise().query(
      "INSERT INTO wa_webhook_events (event_type, payload) VALUES (?, ?)",
      ["webhook_received", JSON.stringify(body)]
    );

    if (body.entry) {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "messages") {
              const value = change.value;
              if (value.messages) {
                for (const msg of value.messages) {
                  await handleIncomingMessage(msg, value.metadata, value.contacts);
                }
              }
              if (value.statuses) {
                for (const status of value.statuses) {
                  await handleStatusUpdate(status);
                }
              }
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.sendStatus(200);
  }
});

/**
 * Atomically claim a webhook event so a retried delivery is processed once.
 *
 * Meta re-delivers on timeout or a non-200, and this handler has side effects
 * (lead capture, flow dispatch, auto-replies) that must not run twice. The
 * claim relies on UNIQUE(event_type, wa_message_id, status) on
 * wa_webhook_events — added by migrations/wa_webhook_idempotency.js. Until that
 * migration is run, INSERT IGNORE always inserts and this returns true, so
 * behaviour is exactly as before rather than silently wrong.
 *
 * @returns {Promise<boolean>} true if this process owns the event
 */
async function claimEvent(eventType, msgId, phone, status, payload) {
  if (!msgId) return true; // nothing to key on — let it through
  try {
    const [res] = await db.promise().query(
      "INSERT IGNORE INTO wa_webhook_events (event_type, wa_message_id, phone, status, payload) VALUES (?, ?, ?, ?, ?)",
      [eventType, msgId, phone, status, JSON.stringify(payload)]
    );
    return res.affectedRows > 0;
  } catch (err) {
    console.warn(`[WA Webhook] Idempotency claim failed for ${msgId}: ${err.message}`);
    return true; // never drop a real message because bookkeeping failed
  }
}

async function handleIncomingMessage(msg, metadata, contacts = []) {
  const phone = msg.from;
  const msgId = msg.id;
  const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();
  const contactProfileName = contacts?.[0]?.profile?.name || null;

  if (!(await claimEvent("incoming_message", msgId, phone, "received", msg))) {
    console.log(`🔁 [WA Webhook] Duplicate delivery of ${msgId} from +${phone} — already processed, skipping.`);
    return;
  }

  let messageText = "";
  let messageType = "text";
  // Normalized interactive response — the actionId is the operator-defined
  // reply id, which is what automations key on. Stored in its own column so a
  // tap is queryable ("who tapped quote_view?") without parsing raw payloads.
  let interaction = null;

  if (msg.type === "text") {
    messageText = msg.text.body;
  } else if (msg.type === "interactive") {
    messageType = "interactive";
    const buttonReply = msg.interactive?.button_reply;
    const listReply = msg.interactive?.list_reply;
    const reply = buttonReply || listReply;
    messageText = reply?.title || "";
    if (reply) {
      interaction = {
        type: buttonReply ? "button_reply" : "list_reply",
        actionId: reply.id || null,
        title: reply.title || null,
        description: listReply?.description || null,
        messageId: msgId,
        phone,
        timestamp: timestamp.toISOString(),
      };
      console.log(
        `👆 [WA Interactive] ${interaction.type} from +${phone}: actionId="${interaction.actionId}" title="${interaction.title}" msgId=${msgId}`
      );
    }
  } else {
    messageType = msg.type;
    messageText = msg[msg.type]?.caption || msg[msg.type]?.id || "";
  }

  await db.promise().query(
    `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, wa_message_id, status, metadata, interactive_payload, created_at)
     VALUES (?, 'inbound', ?, ?, ?, 'delivered', ?, ?, ?)`,
    [phone, messageType, messageText, msgId, JSON.stringify(msg), interaction ? JSON.stringify(interaction) : null, timestamp]
  );

  // (the wa_webhook_events row was already written by claimEvent above)

  // Emit socket event for real-time live chat update
  const chatId = `${phone}@c.us`;
  try {
    const wa = require("../services/whatsappService").default();
    delete wa.messagesFetchCache[chatId];
  } catch (_) {}
  try {
    const app = require("../server");
    const io = app.get && app.get("io");
    if (io) {
      io.emit("wa_message_received", {
        phone,
        chatId,
        message: {
          id: msgId,
          from: phone,
          body: messageText,
          timestamp: Math.floor(timestamp.getTime() / 1000),
          isMe: false,
          type: messageType,
          hasMedia: messageType !== "text" && messageType !== "interactive",
        },
      });
    }
  } catch (_) {}

  // Update contact last message in CRM
  await db.promise().query(
    `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
     VALUES (?, ?, '91', 'WhatsApp Cloud API', 1, ?, NOW(), 1)
     ON DUPLICATE KEY UPDATE
       name = COALESCE(VALUES(name), name),
       last_message_text = VALUES(last_message_text),
       last_message_at = NOW()`,
    [contactProfileName || `+${phone}`, phone.slice(-10), messageText]
  ).catch(() => {});

  // ── 🔗 AUTO-CAPTURE: Create CRM lead for first-time inbound WhatsApp Cloud API contacts ──
  try {
    const waLeadCapture = require("../services/waLeadCapture");
    waLeadCapture.captureLeadFromWhatsApp({
      phone: phone,
      name: contactProfileName || undefined,
      notes: (messageText || "").slice(0, 500) || "Customer messaged via WhatsApp Cloud API",
      sourceDetail: "WhatsApp Cloud API Inbound",
    }).catch(() => {});
  } catch (_) {}

  // ── 3. Check if contact is replying to a bulk campaign (Campaign Isolation) ──
  const waCampaignEngine = require("../services/waCampaignEngine");
  const campaignReply = await waCampaignEngine.checkAndRecordCampaignReply(phone, messageText).catch(() => ({ isCampaignReply: false }));
  const isCampaignReply = Boolean(campaignReply?.isCampaignReply);

  // ── Opt-out detection ─────────────────────────────────────────────────────
  const normalized = messageText.trim().toLowerCase();
  const matchedKeyword = OPT_OUT_KEYWORDS.find(kw => normalized === kw || normalized.startsWith(kw));

  if (matchedKeyword) {
    try {
      // Insert into opt-outs table
      await db.promise().query(
        `INSERT IGNORE INTO wa_opt_outs (phone, reason, opt_out_keyword) VALUES (?, 'user_request', ?)`,
        [phone, matchedKeyword]
      );

      // Mark contact as unsubscribed in wa_contacts
      await db.promise().query(
        `UPDATE wa_contacts SET is_unsubscribed=1, opt_in_status=0, updated_at=NOW() WHERE phone LIKE ?`,
        [`%${phone.slice(-10)}`]
      );

      // Mark pending campaign messages as opted_out
      await db.promise().query(
        `UPDATE wa_campaign_messages SET status='opted_out', opt_out=1, error='User opted out' WHERE phone=? AND status='queued'`,
        [phone]
      );

      await db.promise().query(
        "INSERT INTO wa_webhook_events (event_type, wa_message_id, phone, status, payload) VALUES (?, ?, ?, ?, ?)",
        ["opt_out", msgId, phone, "opted_out", JSON.stringify({ keyword: matchedKeyword, message: messageText })]
      );

      console.log(`✋ Opt-out recorded for ${phone} (keyword: "${matchedKeyword}")`);
    } catch (e) {
      console.error("Opt-out handling error:", e.message);
    }
  } else {
    // ── Stale Webhook Replay Guard ───────────────────────────────────────────
    const webhookTimestampSec = parseInt(msg.timestamp || Math.floor(Date.now() / 1000), 10);
    const isStaleWebhook = (Date.now() - (webhookTimestampSec * 1000)) > 120000;
    if (isStaleWebhook) {
      console.log(`🛡️ [WA Webhook Guard] Stale webhook message from +${phone} (sent ${new Date(webhookTimestampSec * 1000).toISOString()}) — bypassed automations.`);
      return;
    }

    const buttonReplyId = msg.interactive?.button_reply?.id;
    const listReplyId = msg.interactive?.list_reply?.id;
    const interactiveId = buttonReplyId || listReplyId || null;

    // 1. Check if inbound message resolves a pending 2-way interactive confirmation
    const waConfirmation = require("../services/waConfirmationService");
    const confirmationHandled = await waConfirmation.handleInboundConfirmation(phone, messageText, interactiveId).catch(() => false);
    if (confirmationHandled) return;

    // 2. Check if customer is requesting their bills / receipts (scoped strictly to their phone)
    const waBilling = require("../services/waCustomerBillingService");
    const billHandled = await waBilling.handleInboundBillKeyword(phone, messageText).catch(() => false);
    if (billHandled) return;

    const waFlowEngine = require("../services/waFlowEngine");

    // If the contact is replying to a bulk campaign with an attached Flow Bot, auto-start that flow
    if (campaignReply?.flowId) {
      try {
        const [flowRows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ? AND status = 'active' LIMIT 1", [campaignReply.flowId]);
        if (flowRows.length > 0) {
          console.log(`🤖 [WA Campaign -> Flow] Launching Flow "${flowRows[0].name}" for campaign reply from +${phone}`);
          await waFlowEngine.startFlowRun(flowRows[0], phone, null);
          return;
        }
      } catch (fErr) {
        console.warn(`[WA Campaign -> Flow] Failed to trigger linked flow:`, fErr.message);
      }
    }

    // Attachment descriptor — resolve() downloads lazily, only if a collect_input
    // step actually wants the file.
    const mediaId = ["image", "document", "video", "audio", "sticker"].includes(msg.type)
      ? msg[msg.type]?.id
      : null;
    const inboundMedia = mediaId
      ? {
          hasMedia: true,
          type: msg.type,
          filename: msg[msg.type]?.filename || "",
          caption: msg[msg.type]?.caption || "",
          resolve: () => require("../services/whatsappCloudApi").downloadMedia(mediaId),
        }
      : null;

    waFlowEngine.dispatchInbound(phone, messageText, interactiveId, null, inboundMedia, { isCampaignReply, isHistoric: false }).then(async (flowHandled) => {
      if (flowHandled) return;

      const waMenuHandler = require("../services/waMenuHandler");
      const menuMsg = {
        text: messageText,
        buttonReplyId,
        listReplyId,
      };
      const menuHandled = await waMenuHandler.handleMenuReply(phone, menuMsg).catch(() => false);
      if (!menuHandled && messageText) {
        // Welcome Auto-Reply (Guarded: only user-initiated, never on campaign replies)
        const welcomeSent = await require("../services/waAutomationService").maybeSendWelcomeReply(
          phone,
          contactProfileName,
          null,
          { isCampaignReply }
        ).catch(() => false);

        if (!welcomeSent && !isCampaignReply) {
          return waAiReply.maybeAutoReply(phone, messageText);
        }
      }
    }).catch(() => {});
  }
}

async function handleStatusUpdate(status) {
  const msgId = status.id;
  const statusName = status.status;
  const phone = status.recipient_id;
  const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();
  const errorMsg = statusName === "failed" ? (status.errors?.[0]?.message || "Unknown error") : null;

  // Claimed per (message, status) so sent/delivered/read each apply once —
  // otherwise a retry double-counts campaign delivered_count / read_count.
  if (!(await claimEvent("status_update", msgId, phone, statusName, status))) {
    return;
  }

  const statusColumnMap = { sent: "sent_at", delivered: "delivered_at", read: "read_at", failed: "sent_at" };
  const statusColumn = statusColumnMap[statusName];

  if (statusColumn) {
    const logFields = [`status = ?`, `${statusColumn} = ?`];
    const logParams = [statusName, timestamp];
    if (statusName === "failed") {
      logFields.push(`error = ?`);
      logParams.push(errorMsg);
    }
    logParams.push(msgId);

    await db.promise().query(
      `UPDATE wa_message_logs SET ${logFields.join(", ")} WHERE wa_message_id = ?`,
      logParams
    );

    const campFields = [`status = ?`, `${statusColumn} = ?`];
    const campParams = [statusName, timestamp];
    if (statusName === "failed") {
      campFields.push(`error = ?`);
      campParams.push(errorMsg);
    }
    campParams.push(msgId);

    await db.promise().query(
      `UPDATE wa_campaign_messages SET ${campFields.join(", ")} WHERE wa_message_id = ?`,
      campParams
    );

    if (statusName === "delivered" || statusName === "read") {
      const [rows] = await db.promise().query("SELECT campaign_id FROM wa_campaign_messages WHERE wa_message_id = ?", [msgId]);
      if (rows.length) {
        const col = statusName === "delivered" ? "delivered_count" : "read_count";
        await db.promise().query(`UPDATE wa_campaigns SET ${col} = ${col} + 1 WHERE id = ?`, [rows[0].campaign_id]);
      }
    }

    if (statusName === "failed") {
      const [rows] = await db.promise().query("SELECT campaign_id FROM wa_campaign_messages WHERE wa_message_id = ?", [msgId]);
      if (rows.length) {
        await db.promise().query("UPDATE wa_campaigns SET failed_count = failed_count + 1 WHERE id = ?", [rows[0].campaign_id]);
      }
    }
  }

  // (the wa_webhook_events row was already written by claimEvent above)
}

module.exports = router;