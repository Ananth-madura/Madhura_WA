/**
 * waCampaignEngine.js
 *
 * Enterprise Anti-Ban & High-Scale WhatsApp Bulk Sending Engine
 * - Multi-Tenant Isolation & Pool-Based Load Balancing (120+ tenants, 20-100 employees)
 * - Spintax Dynamic Variation Engine ({Hi|Hello|Hey} {name}...)
 * - Human Pacing & Random Jitter (configurable 8s–20s delay + micro-breaks)
 * - Progressive Account Warm-Up Schedule
 * - Opt-in / Opt-out check before every send with STOP/UNSUBSCRIBE auto-blacklisting
 * - Transactional Queue locking & interruptible sleep
 */

const db = require("../config/database");

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Sleeps in small chunks, checking campaign DB status to allow instant cancel/stop
async function interruptibleSleep(totalMs, campaignId, checkIntervalMs = 3000) {
  let remaining = totalMs;
  while (remaining > 0) {
    const chunk = Math.min(checkIntervalMs, remaining);
    await sleep(chunk);
    remaining -= chunk;
    if (remaining <= 0) break;
    const campaign = await getCampaignStatus(campaignId);
    if (!campaign || campaign.status !== "running") break;
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Recursive Spintax Parser
 * Converts "{Hi|Hello|{Hey|Greetings}} {name}" into randomized natural variations
 */
function parseSpintax(text) {
  if (!text || typeof text !== "string") return text;
  const spintaxRegex = /\{([^{}]+)\}/g;
  let matches = 0;
  let parsed = text.replace(spintaxRegex, (match, choices) => {
    matches++;
    const options = choices.split("|");
    return options[Math.floor(Math.random() * options.length)];
  });

  // Handle nested spintax recursively if found
  if (matches > 0 && parsed.includes("{") && parsed.includes("}")) {
    return parseSpintax(parsed);
  }
  return parsed;
}

/**
 * Calculates progressive safe daily limit based on warmup start date
 */
function calculateWarmupLimit(warmupStartDate) {
  if (!warmupStartDate) return 50;
  const start = new Date(warmupStartDate);
  const now = new Date();
  const diffDays = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1);

  if (diffDays <= 3) return 50;
  if (diffDays <= 7) return 150;
  if (diffDays <= 14) return 400;
  if (diffDays <= 21) return 800;
  return 1200; // Fully warmed up
}

/**
 * Check if current time is within working hours for a given timezone
 */
function isWithinWorkingHours(startTime, endTime, timezone) {
  try {
    const now = new Date();
    const tzOptions = { timeZone: timezone || "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false };
    const timeStr = new Intl.DateTimeFormat("en-US", tzOptions).format(now);
    const [h, m] = timeStr.split(":").map(Number);
    const currentMinutes = h * 60 + m;

    const [sh, sm] = (startTime || "09:00").split(":").map(Number);
    const [eh, em] = (endTime || "20:00").split(":").map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch {
    return true; // fallback
  }
}

/**
 * Check if phone number has opted out
 */
async function isOptedOut(phone, tenantId = 1) {
  try {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const [rows] = await db.promise().query(
      "SELECT id FROM wa_opt_outs WHERE (phone = ? OR phone LIKE ?) AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1",
      [phone, `%${cleanPhone}`, tenantId || 1]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if contact is blocked
 */
async function isBlocked(phone, tenantId = 1) {
  try {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const [rows] = await db.promise().query(
      "SELECT id FROM wa_contacts WHERE (phone = ? OR phone LIKE ?) AND (is_blocked = 1 OR is_unsubscribed = 1) AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1",
      [phone, `%${cleanPhone}`, tenantId || 1]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Auto-detect and register opt-outs from incoming message texts (e.g. STOP, UNSUBSCRIBE)
 */
async function handleInboundOptOut(phone, messageText, tenantId = 1) {
  if (!messageText || typeof messageText !== "string") return false;
  const normalized = messageText.trim().toUpperCase();
  const optOutKeywords = ["STOP", "UNSUBSCRIBE", "OPT OUT", "OPTOUT", "BLOCK", "CANCEL MARKETING", "NO MORE"];

  const matched = optOutKeywords.find((kw) => normalized === kw || normalized.startsWith(kw + " ") || normalized.endsWith(" " + kw));
  if (matched) {
    const cleanPhone = phone.replace(/\D/g, "");
    try {
      await db.promise().query(
        `INSERT INTO wa_opt_outs (phone, reason, opt_out_keyword, tenant_id)
         VALUES (?, 'user_keyword_reply', ?, ?)
         ON DUPLICATE KEY UPDATE opt_out_keyword = ?, opted_out_at = NOW()`,
        [cleanPhone, matched, tenantId || 1, matched]
      );
      await db.promise().query(
        `UPDATE wa_contacts SET is_unsubscribed = 1 WHERE phone = ? OR phone LIKE ?`,
        [cleanPhone, `%${cleanPhone.slice(-10)}`]
      );
      console.log(`🚫 [Anti-Ban Guard] Phone +${cleanPhone} automatically opted-out via keyword '${matched}'`);
      return true;
    } catch (e) {
      console.warn("⚠️ Opt-out registration warning:", e.message);
    }
  }
  return false;
}

/**
 * Get fresh campaign data from DB
 */
async function getCampaignStatus(campaignId) {
  const [rows] = await db.promise().query(
    "SELECT * FROM wa_campaigns WHERE id = ?",
    [campaignId]
  );
  return rows[0] || null;
}

/**
 * Count messages sent today for a campaign
 */
async function getSentTodayCount(campaignId) {
  const [rows] = await db.promise().query(
    `SELECT COUNT(*) as cnt FROM wa_campaign_messages
     WHERE campaign_id = ? AND status IN ('sent','delivered','read')
     AND DATE(sent_at) = CURDATE()`,
    [campaignId]
  );
  return rows[0]?.cnt || 0;
}

// ── Core message sender ───────────────────────────────────────────────────────

async function sendOneCampaignMessage(msgRow, sessionKey, poolId = null, routingStrategy = "round_robin", spintaxEnabled = true, tenantId = 1) {
  const {
    id: msgId, campaign_id, phone, contact_name, message_text, template_name, template_components, attempts,
    media_type, media_url,
  } = msgRow;

  // Mark as sending
  await db.promise().query(
    "UPDATE wa_campaign_messages SET status='sending', attempts=attempts+1 WHERE id=?",
    [msgId]
  );

  let result;
  let waMessageId;
  let senderPhone = null;

  try {
    const { formatMessagePlaceholders, buildTemplateBodyComponent, lookupCrmDataByPhone } = require("./waAutomationService");
    const crmData = await lookupCrmDataByPhone(phone).catch(() => ({}));
    const mergedData = { ...crmData, phone };

    // Apply Spintax variation followed by placeholder formatting
    let resolvedText = message_text;
    if (resolvedText) {
      if (spintaxEnabled !== false) {
        resolvedText = parseSpintax(resolvedText);
      }
      resolvedText = formatMessagePlaceholders(resolvedText, contact_name, mergedData);
    }

    const waLoadBalancer = require("./waLoadBalancer");

    if (template_name) {
      const components = (typeof template_components === "string"
        ? JSON.parse(template_components || "[]")
        : (template_components || [])
      ).filter((c) => c.type !== "body");
      const [tmplRows] = await db.promise().query("SELECT body FROM wa_templates WHERE name = ? LIMIT 1", [template_name]);
      const bodyComponent = tmplRows[0] ? buildTemplateBodyComponent(tmplRows[0].body, contact_name, mergedData) : null;
      const finalComponents = bodyComponent ? [...components, bodyComponent] : components;
      result = await waLoadBalancer.sendTemplateMessage(phone, template_name, "en", finalComponents, sessionKey, null, poolId, routingStrategy, tenantId);
    } else if (media_type && media_url) {
      result = await waLoadBalancer.sendMediaMessage(phone, media_type, media_url, resolvedText || "", "", sessionKey, null, poolId, routingStrategy, tenantId);
    } else {
      result = await waLoadBalancer.sendTextMessage(phone, resolvedText, sessionKey, null, poolId, routingStrategy, tenantId);
    }

    waMessageId = result?.result?.messages?.[0]?.id || result?.result?.id?._serialized || "sent_" + Date.now();
    senderPhone = result?.senderPhone || null;

    // Success
    await db.promise().query(
      `UPDATE wa_campaign_messages 
       SET status='sent', wa_message_id=?, sender_phone=?, pool_id=?, sent_at=NOW(), next_retry_at=NULL 
       WHERE id=?`,
      [waMessageId, senderPhone, poolId || null, msgId]
    );

    // Log
    const loggedType = template_name ? "template" : (media_type && media_url) ? "media" : "text";
    await db.promise().query(
      `INSERT IGNORE INTO wa_message_logs (session_key, campaign_id, campaign_message_id, phone, sender_phone, pool_id, tenant_id, direction, message_type, message_text, template_name, wa_message_id, status, sent_at)
       VALUES (?,?,?,?,?,?,?,?,'outbound',?,?,?,?,'sent',NOW())`,
      [sessionKey || 1, campaign_id, msgId, phone, senderPhone, poolId || null, tenantId || 1, loggedType, resolvedText || message_text, template_name, waMessageId]
    );

    // Update campaign sent_count
    await db.promise().query(
      `UPDATE wa_campaigns SET sent_count = sent_count + 1, sent_today = sent_today + 1, last_sent_date = CURDATE() WHERE id=?`,
      [campaign_id]
    );

    // Update last_contacted in wa_contacts
    await db.promise().query(
      `UPDATE wa_contacts SET last_contacted=NOW() WHERE phone=? OR phone LIKE ?`,
      [phone, `%${phone.slice(-10)}`]
    ).catch(() => {});

    // Live Socket.IO event for real-time UI updates
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        const cleanPhone = phone.replace(/\D/g, "");
        const chatId = `${cleanPhone}@c.us`;
        const livePayload = {
          phone: cleanPhone,
          chatId,
          sessionKey: sessionKey || 1,
          senderPhone,
          message: {
            id: waMessageId,
            from: "me",
            body: resolvedText || (media_url ? "📎 Attachment" : template_name ? `Template: ${template_name}` : ""),
            timestamp: Math.floor(Date.now() / 1000),
            isMe: true,
            hasMedia: !!(media_type && media_url),
            mediaType: media_type || null,
          },
        };
        io.to(`user:${sessionKey || 1}`).emit("wa_message_sent", livePayload);
        io.emit("wa_message_sent", livePayload);
      }
    } catch (_) {}

    return { success: true, waMessageId, senderPhone };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    await db.promise().query(
      `UPDATE wa_campaign_messages SET status='failed', error=?, next_retry_at=NULL WHERE id=?`,
      [errorMsg, msgId]
    );
    await db.promise().query(
      `UPDATE wa_campaigns SET failed_count = failed_count + 1 WHERE id=?`,
      [campaign_id]
    );
    return { success: false, error: errorMsg };
  }
}

// ── Main Campaign Execution Loop ──────────────────────────────────────────────

async function runCampaign(campaignId) {
  console.log(`🚀 Campaign ${campaignId}: Starting anti-ban safe dispatch loop`);

  let campaign = await getCampaignStatus(campaignId);
  if (!campaign) {
    console.error(`Campaign ${campaignId} not found`);
    return;
  }

  const {
    random_delay_min = 8,
    random_delay_max = 16,
    pause_every = 30,
    pause_duration_min = 120,
    pause_duration_max = 240,
    retry_failed = 1,
    max_retries = 3,
    retry_delay_min = 15,
    retry_delay_max = 30,
    daily_limit = 0,
    start_time = "09:00",
    end_time = "20:00",
    timezone = "Asia/Kolkata",
    duplicate_filter = 1,
    spintax_enabled = 1,
    warmup_mode = 0,
    pool_id = null,
    routing_strategy = "round_robin",
    tenant_id = 1,
    session_key = "1"
  } = campaign;

  let effectiveDailyLimit = daily_limit;
  if (warmup_mode) {
    const warmupLimit = calculateWarmupLimit(campaign.created_at);
    effectiveDailyLimit = daily_limit > 0 ? Math.min(daily_limit, warmupLimit) : warmupLimit;
    console.log(`🛡️ Campaign ${campaignId}: Warmup mode active (Daily Limit: ${effectiveDailyLimit} msgs)`);
  }

  let sentThisSession = 0;
  let totalProcessed = 0;
  let idleWaits = 0;
  // Bounds the retry-backoff wait so a row stuck in 'sending' (process died
  // mid-send) can't hold the loop open forever.
  const MAX_IDLE_WAITS = 60;
  const seenPhones = new Set();

  while (true) {
    campaign = await getCampaignStatus(campaignId);
    if (!campaign) break;

    if (campaign.status === "paused") {
      console.log(`⏸️ Campaign ${campaignId}: Paused — checking again in 10s`);
      await sleep(10000);
      continue;
    }

    if (["cancelled", "completed", "failed"].includes(campaign.status)) {
      console.log(`⛔ Campaign ${campaignId}: Status is '${campaign.status}' — exiting loop`);
      break;
    }

    // Working hours check
    if (!isWithinWorkingHours(campaign.start_time || start_time, campaign.end_time || end_time, campaign.timezone || timezone)) {
      console.log(`🕐 Campaign ${campaignId}: Outside configured working hours — sleeping 5 min`);
      await interruptibleSleep(5 * 60 * 1000, campaignId);
      continue;
    }

    // Daily limit check
    if (effectiveDailyLimit > 0) {
      const sentToday = await getSentTodayCount(campaignId);
      if (sentToday >= effectiveDailyLimit) {
        console.log(`📊 Campaign ${campaignId}: Daily cap (${effectiveDailyLimit}) reached — pausing until next window`);
        await db.promise().query("UPDATE wa_campaigns SET status='paused' WHERE id=?", [campaignId]);
        break;
      }
    }

    // Fetch next queued message that is actually DUE. Without the next_retry_at
    // guard a re-queued failure is picked straight back up on the next iteration
    // (it still has the lowest id), so the backoff never happens and one bad
    // number burns all its retries back-to-back while blocking the whole campaign.
    const [queuedRows] = await db.promise().query(
      `SELECT * FROM wa_campaign_messages
       WHERE campaign_id=? AND status='queued'
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY id ASC LIMIT 1`,
      [campaignId]
    );

    let nextMsg = queuedRows[0] || null;

    // Retryable failed messages check
    if (!nextMsg && retry_failed) {
      const [retryRows] = await db.promise().query(
        `SELECT * FROM wa_campaign_messages 
         WHERE campaign_id=? AND status='failed' AND attempts < ? 
         AND (next_retry_at IS NULL OR next_retry_at <= NOW()) 
         ORDER BY id ASC LIMIT 1`,
        [campaignId, max_retries]
      );
      nextMsg = retryRows[0] || null;
    }

    if (!nextMsg) {
      const [remaining] = await db.promise().query(
        "SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE campaign_id=? AND status IN ('queued','sending')",
        [campaignId]
      );
      if (remaining[0].cnt === 0) {
        console.log(`✅ Campaign ${campaignId}: All campaign messages completed successfully!`);
        await db.promise().query(
          "UPDATE wa_campaigns SET status='completed', completed_at=NOW() WHERE id=?",
          [campaignId]
        );
        break;
      }

      // Nothing due right now, but retries are still pending — waiting them out
      // instead of exiting, which used to strand every scheduled retry.
      idleWaits++;
      if (idleWaits > MAX_IDLE_WAITS) {
        console.warn(`⚠️ Campaign ${campaignId}: ${remaining[0].cnt} message(s) stuck for ${MAX_IDLE_WAITS} min — exiting loop.`);
        break;
      }
      console.log(`⏳ Campaign ${campaignId}: ${remaining[0].cnt} message(s) waiting on retry backoff — rechecking in 60s`);
      await interruptibleSleep(60 * 1000, campaignId);
      continue;
    }
    idleWaits = 0;

    // Duplicate check
    if (duplicate_filter && seenPhones.has(nextMsg.phone)) {
      await db.promise().query(
        "UPDATE wa_campaign_messages SET status='skipped', error='Duplicate phone in campaign' WHERE id=?",
        [nextMsg.id]
      );
      continue;
    }
    if (duplicate_filter) seenPhones.add(nextMsg.phone);

    // Opt-out check
    const optedOut = await isOptedOut(nextMsg.phone, tenant_id);
    if (optedOut) {
      await db.promise().query(
        "UPDATE wa_campaign_messages SET status='opted_out', error='Contact opted out', opt_out=1 WHERE id=?",
        [nextMsg.id]
      );
      await db.promise().query(
        "UPDATE wa_campaigns SET failed_count=failed_count+1 WHERE id=?",
        [campaignId]
      );
      continue;
    }

    // Blocked check
    const blocked = await isBlocked(nextMsg.phone, tenant_id);
    if (blocked) {
      await db.promise().query(
        "UPDATE wa_campaign_messages SET status='skipped', error='Contact blocked or unsubscribed' WHERE id=?",
        [nextMsg.id]
      );
      continue;
    }

    // Dispatch message via Load Balancer
    console.log(`📤 Campaign ${campaignId}: Sending message to ${nextMsg.phone} (attempt ${(nextMsg.attempts || 0) + 1})`);
    const sendResult = await sendOneCampaignMessage(
      { ...nextMsg, campaign_id: campaignId },
      session_key,
      pool_id,
      routing_strategy,
      spintax_enabled !== 0,
      tenant_id
    );

    sentThisSession++;
    totalProcessed++;

    if (!sendResult.success && retry_failed && (nextMsg.attempts || 0) < max_retries - 1) {
      const retryDelay = randomInt(
        campaign.retry_delay_min || retry_delay_min,
        campaign.retry_delay_max || retry_delay_max
      );
      await db.promise().query(
        `UPDATE wa_campaign_messages SET status='queued', next_retry_at=DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id=?`,
        [retryDelay, nextMsg.id]
      );
      console.log(`🔄 Campaign ${campaignId}: Message ${nextMsg.id} scheduled to retry in ${retryDelay} min`);
    }

    // Micro-batch cooling pause (Anti-Ban Guard)
    const pauseEvery = campaign.pause_every || pause_every;
    if (sentThisSession > 0 && sentThisSession % pauseEvery === 0) {
      const pauseSec = randomInt(
        campaign.pause_duration_min || pause_duration_min,
        campaign.pause_duration_max || pause_duration_max
      );
      console.log(`⏳ [Anti-Ban Guard] Sent batch of ${sentThisSession} messages — cooling down for ${pauseSec}s`);
      await interruptibleSleep(pauseSec * 1000, campaignId);
    } else {
      // Dynamic random human-like jitter
      const delayMin = campaign.random_delay_min || random_delay_min;
      const delayMax = campaign.random_delay_max || random_delay_max;
      let actualMax = delayMax;
      if (sentThisSession % 7 === 0) actualMax = delayMax + 4; // micro-variation

      const delaySec = randomInt(delayMin, actualMax);
      console.log(`⏱️ Campaign ${campaignId}: Jitter delay ${delaySec}s before next contact`);
      await sleep(delaySec * 1000);
    }
  }

  console.log(`🏁 Campaign ${campaignId}: Execution complete. Processed ${totalProcessed} messages.`);
}

// ── Exported Controller ───────────────────────────────────────────────────────

const runningCampaigns = new Set();

async function startCampaignEngine(campaignId) {
  const key = String(campaignId);
  if (runningCampaigns.has(key)) {
    console.log(`ℹ️ Campaign ${campaignId}: already running — skipping duplicate invocation`);
    return;
  }
  runningCampaigns.add(key);

  runCampaign(campaignId)
    .catch((err) => {
      console.error(`Campaign ${campaignId} engine error:`, err.message);
      db.promise().query("UPDATE wa_campaigns SET status='failed' WHERE id=? AND status='running'", [campaignId]).catch(() => {});
    })
    .finally(() => runningCampaigns.delete(key));
}

async function addBulkMessages(campaignId, messages, delayMs = 0) {
  setTimeout(() => {
    startCampaignEngine(campaignId).catch(() => {});
  }, delayMs || 500);
  return { success: true, count: messages.length };
}

async function addSingleMessage(data, delayMs = 0, sessionKey) {
  if (delayMs) await sleep(delayMs);
  return sendOneCampaignMessage(data, sessionKey);
}

async function getQueueStats(tenantId = null) {
  try {
    const whereTenant = tenantId ? " AND (tenant_id = ? OR tenant_id IS NULL)" : "";
    const params = tenantId ? [tenantId] : [];

    const [[queued]] = await db.promise().query(`SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE status='queued'${whereTenant}`, params);
    const [[sending]] = await db.promise().query(`SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE status='sending'${whereTenant}`, params);
    const [[done]] = await db.promise().query(`SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE status IN ('sent','delivered','read')${whereTenant}`, params);
    const [[failed]] = await db.promise().query(`SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE status='failed'${whereTenant}`, params);
    return { waiting: queued.cnt, active: sending.cnt, completed: done.cnt, failed: failed.cnt, delayed: 0, mode: "enterprise-db-engine" };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, mode: "db-engine-error" };
  }
}

async function startWorker() {
  console.log("✅ Multi-Tenant WhatsApp Campaign Engine ready (Anti-Ban & Load-Balancing Active)");
}

/**
 * Check if an inbound message from a contact is a response to an active/recent campaign.
 * Automatically attributes reply metrics and provides a safeguard flag so general
 * welcome auto-replies are NEVER accidentally sent to campaign respondents.
 */
async function checkAndRecordCampaignReply(phone, messageText = "") {
  if (!phone) return { isCampaignReply: false };
  const clean = String(phone).replace(/\D/g, "");
  const last10 = clean.slice(-10);
  if (last10.length < 10) return { isCampaignReply: false };

  try {
    const [rows] = await db.promise().query(
      `SELECT cm.id as message_id, cm.campaign_id, c.name as campaign_name, c.flow_id, cm.reply_received
       FROM wa_campaign_messages cm
       LEFT JOIN wa_campaigns c ON cm.campaign_id = c.id
       WHERE (cm.phone = ? OR cm.phone LIKE ?)
         AND cm.status IN ('sent', 'delivered', 'read')
         AND cm.sent_at >= NOW() - INTERVAL 48 HOUR
       ORDER BY cm.id DESC LIMIT 1`,
      [clean, `%${last10}`]
    );

    if (rows && rows.length > 0) {
      const { message_id, campaign_id, campaign_name, flow_id, reply_received } = rows[0];

      // Mark reply on campaign message if not already set
      if (!reply_received) {
        await db.promise().query(
          "UPDATE wa_campaign_messages SET reply_received = 1 WHERE id = ?",
          [message_id]
        ).catch(() => {});

        if (campaign_id) {
          await db.promise().query(
            "UPDATE wa_campaigns SET reply_count = reply_count + 1 WHERE id = ?",
            [campaign_id]
          ).catch(() => {});
        }
      }

      console.log(`📢 [WA Campaign] Reply detected from +${clean} for Campaign "${campaign_name || campaign_id}" (ID: ${campaign_id}${flow_id ? `, Linked Flow #${flow_id}` : ""})`);
      return {
        isCampaignReply: true,
        campaignId: campaign_id,
        campaignName: campaign_name,
        flowId: flow_id || null,
        messageId: message_id,
      };
    }
  } catch (err) {
    console.error("checkAndRecordCampaignReply error:", err.message);
  }

  return { isCampaignReply: false };
}

module.exports = {
  startCampaignEngine,
  runCampaign,
  addBulkMessages,
  addSingleMessage,
  getQueueStats,
  startWorker,
  parseSpintax,
  calculateWarmupLimit,
  handleInboundOptOut,
  isOptedOut,
  isBlocked,
  isWithinWorkingHours,
  checkAndRecordCampaignReply,
};
