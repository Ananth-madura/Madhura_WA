const express = require("express");
const router = express.Router();
const db = require("../config/database");
const wa = require("../services/whatsappCloudApi");
const waAiReply = require("../services/waAiReply");

// Opt-out keywords (case-insensitive)
const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "opt out", "optout", "cancel", "quit", "end", "remove me", "no more"];

/**
 * Meta's subscription handshake (`GET /wa/webhook?hub.mode=subscribe`) carries
 * only the token the operator typed into the App Dashboard - no phone_number_id
 * - so a token can only be checked against the set of tokens this deployment
 * has configured. Each source is tried independently and a source that fails
 * (a table this deployment has never created, say) is skipped rather than
 * aborting the handshake: one broken lookup used to make every non-env token
 * answer 503.
 *
 * The message POST is the authenticated path - it resolves the sender by
 * phone_number_id and verifies the signature against THAT account's own
 * app_secret (services/waWebhookAuth.js). Completing this handshake only makes
 * Meta echo the challenge back; it cannot inject a message.
 */
const verifyTokenSources = [
  {
    label: "env",
    // The env-configured sender belongs to tenant 1, the same rule
    // resolveSenderCredentials enforces.
    match: (token) => Boolean(process.env.WA_VERIFY_TOKEN) && token === process.env.WA_VERIFY_TOKEN,
  },
  {
    label: "user_wa_configs",
    sql: "SELECT 1 FROM user_wa_configs WHERE verify_token = ? AND is_enabled = 1 LIMIT 1",
  },
  {
    label: "wa_accounts",
    sql: "SELECT 1 FROM wa_accounts WHERE verify_token = ? AND is_active = 1 LIMIT 1",
  },
  {
    label: "wa_senders",
    sql: "SELECT 1 FROM wa_senders WHERE verify_token = ? LIMIT 1",
  },
];

router.get("/", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // If Meta Cloud API verification request
  if (mode || token || challenge) {
    if (mode !== "subscribe" || !token) {
      return res.status(403).send("Forbidden: Invalid verification request");
    }

    let matched = false;
    let lookupFailed = false;
    for (const source of verifyTokenSources) {
      if (source.match) {
        if (source.match(token)) matched = true;
      } else {
        try {
          const [rows] = await db.promise().query(source.sql, [token]);
          if (rows && rows.length) matched = true;
        } catch (err) {
          lookupFailed = true;
          console.warn(`[WA Webhook] verify-token source '${source.label}' unavailable: ${err.message}`);
        }
      }
      if (matched) break;
    }

    if (matched) return res.status(200).send(challenge);
    // Only surface a 503 when a lookup itself broke: a DB outage must not be
    // reported as "wrong token" (that would send operators hunting for a
    // credentials problem they do not have).
    if (lookupFailed) return res.sendStatus(503);
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

/**
 * Resolve the sender behind a phone_number_id: which session owns its inbound
 * traffic, and which app_secret Meta signed it with.
 *
 * The app_secret is per WhatsApp Business App, so a sender that has its own
 * stored secret must never be verified against the process-wide one - that is
 * how one organization's credential ends up deciding whether another
 * organization's events are trusted. Env is the last resort and only for the
 * env-configured sender (tenant 1, the rule resolveSenderCredentials follows);
 * falling back to it for a sender that has a real-but-different secret would
 * simply reject every one of that sender's events, so the fallback is logged
 * rather than silent.
 *
 * Returns null for an unknown sender, a disabled config, or a secret that
 * cannot be read - all fail closed.
 */
async function resolveWebhookAccount(phoneId) {
  const decrypt = require("../backendutil/cryptoHelper").decrypt;

  // A stored secret that cannot be read must not be swapped for the env one:
  // that would trust a different Meta app's key. Log and reject instead.
  const appSecretFor = (stored, label) => {
    const raw = stored || process.env.WA_APP_SECRET || "";
    if (!raw) {
      console.warn(`[WA Webhook] No app_secret for ${label} (phone_number_id=${phoneId}) and WA_APP_SECRET is unset - events for this sender cannot be verified`);
      return "";
    }
    try {
      const secret = decrypt(raw);
      if (!stored) {
        console.warn(`[WA Webhook] ${label} has no stored app_secret - falling back to WA_APP_SECRET (single-app deployment). Store this account's own secret to scope verification per sender.`);
      }
      return secret;
    } catch (err) {
      console.warn(`[WA Webhook] Could not read app_secret for ${label}: ${err.message}`);
      return null; // fail closed
    }
  };

  try {
    const [owners] = await db.promise().query("SELECT * FROM user_wa_configs WHERE phone_number_id = ? LIMIT 1", [phoneId]);
    if (owners.length) {
      if (!owners[0].is_enabled) return null;
      const appSecret = appSecretFor(owners[0].app_secret, "user_wa_configs id=" + owners[0].id);
      if (appSecret === null) return null;
      return { sessionKey: String(owners[0].user_id), appSecret, client: wa.withAccount(owners[0]) };
    }

    const [accounts] = await db.promise().query("SELECT * FROM wa_accounts WHERE phone_number_id = ? AND is_active = 1 AND created_by IS NOT NULL LIMIT 1", [phoneId]);
    if (accounts.length) {
      const appSecret = appSecretFor(accounts[0].app_secret, "wa_accounts id=" + accounts[0].id);
      if (appSecret === null) return null;
      return { sessionKey: String(accounts[0].created_by), appSecret, client: wa.withAccount(accounts[0]) };
    }

    // Senders created through the Meta partner flow land in wa_senders, which
    // carries its own secret but no creating user. Inbound traffic for one
    // belongs to its organization, so the owning organization's first user is
    // the session it is attributed to.
    const [senders] = await db.promise().query(
      "SELECT s.*, (SELECT u.id FROM users u WHERE u.tenant_id = s.tenant_id ORDER BY u.id ASC LIMIT 1) AS owner_user_id FROM wa_senders s WHERE s.phone_number_id = ? LIMIT 1",
      [phoneId]
    );
    if (senders.length) {
      const appSecret = appSecretFor(senders[0].app_secret, "wa_senders id=" + senders[0].id);
      if (appSecret === null) return null;
      if (!senders[0].owner_user_id) {
        console.warn(`[WA Webhook] wa_senders id=${senders[0].id} (tenant ${senders[0].tenant_id}) has no user to own its inbound traffic`);
        return null;
      }
      return { sessionKey: String(senders[0].owner_user_id), tenantId: Number(senders[0].tenant_id) || null, appSecret, client: wa.withAccount(senders[0]) };
    }

    if (phoneId === process.env.WA_PHONE_NUMBER_ID) {
      return {
        sessionKey: String(require("../services/whatsappService").defaultKey),
        tenantId: Number(process.env.WA_SYSTEM_TENANT_ID) || 1,
        appSecret: process.env.WA_APP_SECRET || "",
      };
    }
    return null;
  } catch (err) {
    // A lookup failure must not be reported as a valid sender - otherwise a
    // transient DB error would let an unverified body through.
    console.warn(`[WA Webhook] Could not resolve sender ${phoneId}: ${err.message}`);
    return null;
  }
}

router.post("/", async (req, res) => {
  try {
    const authorization = await require("../services/waWebhookAuth").authorizeWebhook(req, resolveWebhookAccount);
    if (!authorization.valid) return res.sendStatus(403);
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
                  await handleIncomingMessage(msg, value.metadata, value.contacts, authorization.accounts.get(value.metadata?.phone_number_id));
                }
              }
              if (value.statuses) {
                for (const status of value.statuses) {
                  await handleStatusUpdate(status, authorization.accounts.get(value.metadata?.phone_number_id));
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
    res.sendStatus(503);
  }
});

/** Atomic claim in a dedicated table; legacy event rows are left intact. */
async function claimEvent(eventType, msgId, phone, status, payload) {
  if (!msgId) return false;
  try {
    const [res] = await db.promise().query(
      "INSERT IGNORE INTO wa_webhook_claims (event_type, wa_message_id, status) VALUES (?, ?, ?)",
      [eventType, msgId, status]
    );
    if (res.affectedRows > 0) await db.promise().query(
      "INSERT INTO wa_webhook_events (event_type, wa_message_id, phone, status, payload) VALUES (?, ?, ?, ?, ?)",
      [eventType, msgId, phone, status, JSON.stringify(payload)]
    ).catch(() => {});
    return res.affectedRows > 0;
  } catch (err) {
    console.warn(`[WA Webhook] Idempotency claim failed for ${msgId}: ${err.message}`);
    throw err; // Return 503 so the provider retries after persistence recovers.
  }
}

async function handleIncomingMessage(msg, metadata, contacts = [], account = null) {
  const phone = msg.from;
  account = account || await resolveWebhookAccount(metadata?.phone_number_id);
  if (!account) throw new Error("Webhook sender has no configured owner");
  const sessionKey = account?.sessionKey;
  const wa = account.client || await require("../services/waConfigHelper").cloudClientForUser(sessionKey);
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

  const isMediaMsg = ["image", "video", "audio", "document", "sticker", "voice"].includes(msg.type);
  const mediaObj = isMediaMsg ? msg[msg.type] : null;
  const cloudMediaId = mediaObj?.id || null;
  const mediaFilename = mediaObj?.filename || (isMediaMsg ? `${msg.type}_${msgId}` : null);
  const mediaMimeType = mediaObj?.mime_type || null;
  const mediaCaption = mediaObj?.caption || "";

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
  } else if (isMediaMsg) {
    messageType = msg.type;
    messageText = mediaCaption || mediaFilename || `📎 Attachment (${msg.type})`;
  } else {
    messageType = msg.type;
    messageText = msg[msg.type]?.caption || msg[msg.type]?.id || "";
  }

  await db.promise().query(
    `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, wa_message_id, status, metadata, interactive_payload, has_media, media_mime_type, media_filename, created_at)
     VALUES (?, 'inbound', ?, ?, ?, 'delivered', ?, ?, ?, ?, ?, ?)`,
    [
      phone,
      messageType,
      messageText,
      msgId,
      JSON.stringify(msg),
      interaction ? JSON.stringify(interaction) : null,
      isMediaMsg ? 1 : 0,
      mediaMimeType,
      mediaFilename,
      timestamp,
    ]
  ).catch(async () => {
    await db.promise().query(
      `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, wa_message_id, status, metadata, interactive_payload, created_at)
       VALUES (?, 'inbound', ?, ?, ?, 'delivered', ?, ?, ?)`,
      [phone, messageType, messageText, msgId, JSON.stringify(msg), interaction ? JSON.stringify(interaction) : null, timestamp]
    ).catch(() => {});
  });

  // (the wa_webhook_events row was already written by claimEvent above)
  await db.promise().query("UPDATE wa_message_logs SET session_key = ?, media_id = ? WHERE wa_message_id = ?", [sessionKey, cloudMediaId || null, msgId]).catch(() => {});

  require("../services/waTransientHistory").remember(phone, sessionKey, { id: msgId, body: messageText, isMe: false });

  // Emit socket event for real-time live chat update
  const chatId = `${phone}@c.us`;
  try {
    const waService = require("../services/whatsappService").default();
    delete waService.messagesFetchCache[chatId];
  } catch (_) {}
  try {
    const app = require("../server");
    const io = app.get && app.get("io");
    if (io) {
      io.to(`user:${sessionKey}`).emit("wa_message_received", {
        phone,
        chatId,
        sessionKey,
        message: {
          id: msgId,
          from: phone,
          body: messageText,
          timestamp: Math.floor(timestamp.getTime() / 1000),
          isMe: false,
          type: messageType,
          hasMedia: isMediaMsg,
          filename: mediaFilename || "",
          mimetype: mediaMimeType || "",
          cloudMediaId,
        },
      });
    }
  } catch (_) {}

  // Eager background media download for Meta Cloud attachments
  if (cloudMediaId && require("../services/waChatPrivacy").serverChatStorageEnabled()) {
    (async () => {
      try {
        const downloaded = await wa.downloadMedia(cloudMediaId);
        if (downloaded?.url) {
          await db.promise().query(
            "UPDATE wa_message_logs SET media_url = ?, media_filename = COALESCE(?, media_filename), media_mime_type = COALESCE(?, media_mime_type) WHERE wa_message_id = ?",
            [downloaded.url, downloaded.filename || mediaFilename, downloaded.mimetype || mediaMimeType, msgId]
          ).catch(() => {});

          const app = require("../server");
          const io = app.get && app.get("io");
          if (io) {
            io.to(`user:${sessionKey}`).emit("wa_message_updated", {
              id: msgId,
              serializedId: msgId,
              mediaUrl: downloaded.url,
              filename: downloaded.filename || mediaFilename,
              mimetype: downloaded.mimetype || mediaMimeType,
            });
          }
        }
      } catch (dlErr) {
        console.warn(`[WA Cloud Media] Background download failed for media ${cloudMediaId}:`, dlErr.message);
      }
    })();
  }

  // Update contact last message in CRM. The row carries the organization the
  // sender belongs to: `sessionKey` is the owner resolved from this
  // phone_number_id in resolveWebhookAccount, so two organizations messaging
  // the same person each get their own contact instead of one NULL row that
  // every scoped query has to make a special case for.
  const contactTenantId = await require("../services/waContactTenancy").tenantForContactWrite({
    tenantId: account?.tenantId,
    sessionKey,
  });
  await db.promise().query(
    `INSERT INTO wa_contacts (tenant_id, name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
     VALUES (?, ?, ?, '91', 'WhatsApp Cloud API', 1, ?, NOW(), 1)
     ON DUPLICATE KEY UPDATE
       name = COALESCE(VALUES(name), name),
       last_message_text = VALUES(last_message_text),
       last_message_at = NOW()`,
    [contactTenantId, contactProfileName || `+${phone}`, phone.slice(-10), messageText]
  ).catch(() => {});

  // ── 🔗 AUTO-CAPTURE: Create CRM lead for first-time inbound WhatsApp Cloud API contacts ──
  try {
    const waLeadCapture = require("../services/waLeadCapture");
    waLeadCapture.captureLeadFromWhatsApp({
      phone: phone,
      sessionKey,
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
      // Insert into opt-outs table, scoped to the organization the sender
      // belongs to: opting out of one business must not silence the same
      // person for a different business sharing this platform.
      await db.promise().query(
        `INSERT IGNORE INTO wa_opt_outs (tenant_id, phone, reason, opt_out_keyword) VALUES (?, ?, 'user_request', ?)`,
        [contactTenantId, phone, matchedKeyword]
      );

      // Mark contact as unsubscribed in wa_contacts
      await db.promise().query(
        `UPDATE wa_contacts SET is_unsubscribed=1, opt_in_status=0, updated_at=NOW() WHERE tenant_id = ? AND phone LIKE ?`,
        [contactTenantId, `%${phone.slice(-10)}`]
      );

      // Mark pending campaign messages as opted_out
      await db.promise().query(
        `UPDATE wa_campaign_messages SET status='opted_out', opt_out=1, error='User opted out' WHERE tenant_id = ? AND phone=? AND status='queued'`,
        [contactTenantId, phone]
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
    const confirmationHandled = await waConfirmation.handleInboundConfirmation(phone, messageText, interactiveId, sessionKey).catch(() => false);
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
          await waFlowEngine.startFlowRun(flowRows[0], phone, sessionKey, messageText, `${phone}@c.us`);
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
          resolve: () => wa.downloadMedia(mediaId),
        }
      : null;

    waFlowEngine.dispatchInbound(phone, messageText, interactiveId, sessionKey, inboundMedia, { isCampaignReply, isHistoric: false }).then(async (flowHandled) => {
      if (flowHandled) return;

      const waMenuHandler = require("../services/waMenuHandler");
      const menuMsg = {
        text: messageText,
        buttonReplyId,
        listReplyId,
      };
      const menuHandled = await waMenuHandler.handleMenuReply(phone, menuMsg, sessionKey).catch(() => false);
      if (!menuHandled && messageText) {
        // Welcome Auto-Reply (Guarded: only user-initiated, never on campaign replies)
        const welcomeSent = await require("../services/waAutomationService").maybeSendWelcomeReply(
          phone,
          contactProfileName,
          sessionKey,
          { isCampaignReply }
        ).catch(() => false);

        if (!welcomeSent && !isCampaignReply) {
          return waAiReply.maybeAutoReply(phone, messageText, contactProfileName, sessionKey);
        }
      }
    }).catch(() => {});
  }
}

async function handleStatusUpdate(status, account) {
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

  await require("../services/waDeliveryReceipts").applyDeliveryReceipt(msgId, statusName, timestamp, errorMsg);

  // Real-time UI live tick update via Socket.io
  const ackMap = { sent: 1, delivered: 2, read: 3, failed: -1 };
  try {
    const app = require("../server");
    const io = app.get && app.get("io");
    if (io) {
      io.to(`user:${account.sessionKey}`).emit("wa_message_ack", {
        phone,
        message: {
          id: msgId,
          serializedId: msgId,
          status: statusName,
          ack: ackMap[statusName] || 1,
        },
      });
      if (statusName === "read") {
        io.to(`user:${account.sessionKey}`).emit("wa_chat_read", { phone, chatId: `${phone}@c.us` });
      }
    }
  } catch (_) {}

  // (the wa_webhook_events row was already written by claimEvent above)
}

module.exports = router;
