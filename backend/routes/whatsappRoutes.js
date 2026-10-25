const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const db = require("../config/database");
const mgr = require("../services/whatsappService");
const qrcode = require("qrcode");
router.use(async (req, res, next) => {
  const requested = req.headers["x-session-key"] || req.query?.sessionKey;
  if (!requested || String(requested) === String(req.user?.id)) return next();
  try {
    const [rows] = await db.promise().query("SELECT id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1", [requested, req.tenantId]);
    if (!rows.length) return res.status(403).json({ error: "Session is outside this organization" });
    next();
  } catch (_) { res.status(503).json({ error: "Session access could not be verified" }); }
});
const { messageSendLimiter, qrRefreshLimiter, sessionResetThrottle } = require("../middleware/waRateLimiter");

const toDataUrl = async (qr) => {
  if (!qr) return null;
  try {
    return await qrcode.toDataURL(qr, { margin: 1, width: 280 });
  } catch (_) {
    return null;
  }
};

// Upload target comes from config/runtimePaths so that on the VPS it resolves
// to a directory OUTSIDE the deploy directory. See that file for why.
const { mediaDir } = require("../config/runtimePaths");
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, mediaDir),
    filename: (req, file, cb) => cb(null, Date.now() + "_" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Resolves the caller's specific session, isolated per authenticated user/sessionKey.
//
// It used to fall back to `mgr.all().find((ses) => ses.ready)` when the caller's
// own session was not ready. That is how a message typed by one user went out
// from another user's WhatsApp number with no warning. There is now no
// substitution: you send from your own number or the send fails.
const s = (req) => {
  const reqKey = req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id;
  if (reqKey) return mgr.get(reqKey);
  return mgr.default();
};

// Same rule for auth/lifecycle routes (QR, pairing, logout, reset): never hand
// back a different user's session. Being unable to act is recoverable; silently
// acting as someone else is not.
const userSession = (req) => {
  const reqKey = req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id || mgr.defaultKey;
  return mgr.get(reqKey);
};

// Guard for every route that actually sends: refuses to send from a session that
// is not connected instead of quietly using whichever number happens to be up.
const requireReadySession = (req, res) => {
  const session = s(req);
  if (!session.ready) {
    res.status(503).json({
      error:
        "Your WhatsApp session is not connected, so nothing was sent. Reconnect your number and try again — " +
        "messages are never sent from another user's number.",
      code: "WA_SESSION_NOT_READY",
      sessionKey: String(req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id || mgr.defaultKey),
    });
    return null;
  }
  return session;
};

const { configureForUser } = require("../services/waConfigHelper");

// Cloud sends must appear in the same conversation history as Web sends.
// Recording errors never turn a confirmed provider send into a retryable failure.
async function recordCloudSend(req, chatId, phone, messageId, body, type = "text", extra = {}) {
  const sessionKey = String(req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id || mgr.defaultKey);
  await db.promise().query(
    `INSERT IGNORE INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
     VALUES (?, ?, 'outbound', ?, ?, ?, 'sent', NOW())`,
    [sessionKey, phone, type, body, messageId]
  ).catch((err) => console.warn("[Cloud Send] History recording failed:", err.message));
  const contactTenantId = await require("../services/waContactTenancy").tenantForContactWrite({
    req,
    sessionKey,
  });
  await db.promise().query(
    `INSERT INTO wa_contacts (tenant_id, name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
     VALUES (?, 'Customer', ?, '91', 'WhatsApp Chat', 1, ?, NOW(), 0)
     ON DUPLICATE KEY UPDATE last_message_text = VALUES(last_message_text), last_message_at = NOW()`,
    [contactTenantId, phone.slice(-10), body]
  ).catch(() => {});
  await require("../services/waBotGate").pauseBot(chatId, undefined, "manual cloud reply", sessionKey).catch(() => {});
  const io = req.app?.get("io");
  if (io) io.to(`user:${sessionKey}`).emit("wa_message_sent", {
    chatId, phone, sessionKey,
    message: { id: messageId, from: "me", body, isMe: true, status: "sent", type, timestamp: Math.floor(Date.now() / 1000), ...extra },
  });
}

router.get("/status", async (req, res) => {
  const waCloud = await require("../services/waConfigHelper").cloudClientForUser(req.user.id);
  if (req.user?.id) {
    await configureForUser(req.user.id).catch(() => {});
  }
  const requestedKey = String(
    req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id || mgr.defaultKey
  );
  const sessionStatus = await s(req).getStatus();
  const cloudConfigured = waCloud.isConfigured();
  res.json({
    ...sessionStatus,
    connected: sessionStatus.connected || cloudConfigured,
    isCloud: cloudConfigured,
    isWeb: sessionStatus.connected,
    phone: sessionStatus.phone || waCloud.displayPhoneNumber || waCloud.phoneNumberId || null,
    activeEngine: cloudConfigured && sessionStatus.connected
      ? "Dual (Cloud API + Web)"
      : cloudConfigured
      ? "Meta Cloud API"
      : sessionStatus.connected
      ? "WhatsApp Web Session"
      : "Disconnected",
    // Which session will actually carry a send from this request, and whose
    // number that is. The UI surfaces a warning when `sendingAsAnotherUser` is
    // true — a send used to leave from another user's number silently.
    senderSessionKey: requestedKey,
    senderKeyMatchesSession: requestedKey === String(s(req).key),
    sendingAsAnotherUser: String(s(req).key) !== requestedKey,
  });
});

router.get("/unified-status", async (req, res) => {
  if (req.user?.id) {
    await configureForUser(req.user.id).catch(() => {});
  }
  const session = userSession(req);
  const unified = await session.getUnifiedStatus();
  const currentQr = session.qrCode || unified.qr || unified.web?.qr || null;
  if (currentQr) {
    unified.qr = currentQr;
    unified.hasQr = true;
    unified.qrDataUrl = await toDataUrl(currentQr);
    if (unified.web) {
      unified.web.qr = currentQr;
      unified.web.hasQr = true;
      unified.web.qrDataUrl = unified.qrDataUrl;
    }
  }
  res.json(unified);
});

router.get("/diagnostics", async (req, res) => {
  const session = userSession(req);
  let browserPid = null;
  let browserConnected = false;
  let pageUrl = null;
  let pageTitle = null;
  try {
    if (session.client?.pupBrowser) {
      browserConnected = session.client.pupBrowser.isConnected();
      browserPid = session.client.pupBrowser.process()?.pid || null;
    }
    if (session.client?.pupPage) {
      pageUrl = await session.client.pupPage.url().catch((e) => e.message);
      pageTitle = await session.client.pupPage.title().catch((e) => e.message);
    }
  } catch (_) {}

  const execPath = mgr.getExecutablePath ? mgr.getExecutablePath() : null;
  const fs = require("fs");
  res.json({
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    execPath,
    execExists: execPath ? fs.existsSync(execPath) : false,
    sessionKey: session.key,
    isInitializing: session.isInitializing,
    ready: session.ready,
    hasQr: Boolean(session.qrCode),
    qrLength: session.qrCode ? session.qrCode.length : 0,
    hasClient: Boolean(session.client),
    browserConnected,
    browserPid,
    pageUrl,
    pageTitle,
    lastInitError: session.lastInitError || null,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

router.get("/account", async (req, res) => {
  try {
    const waCloud = await require("../services/waConfigHelper").cloudClientForUser(req.user.id);
    if (req.user?.id) {
      await configureForUser(req.user.id).catch(() => {});
    }
    const details = await s(req).getAccountDetails();
    if (!details.connected && waCloud.isConfigured()) {
      let phoneInfo = null;
      try {
        phoneInfo = await waCloud.getPhoneNumberInfo();
        if (phoneInfo?.display_phone_number) waCloud.displayPhoneNumber = phoneInfo.display_phone_number;
        if (phoneInfo?.verified_name) waCloud.verifiedName = phoneInfo.verified_name;
      } catch (_) {}

      let contactsCount = 0;
      try {
        const [[{ total }]] = await db.promise().query(
          "SELECT COUNT(*) as total FROM wa_contacts WHERE is_blocked = 0"
        );
        contactsCount = total || 0;
      } catch (_) {}

      return res.json({
        connected: true,
        isCloud: true,
        isWeb: false,
        phone: waCloud.displayPhoneNumber || phoneInfo?.display_phone_number || waCloud.phoneNumberId,
        pushname: waCloud.verifiedName || phoneInfo?.verified_name || "Meta WhatsApp Business",
        profilePicUrl: null,
        platform: "Meta Cloud API (Official v22.0)",
        qualityRating: phoneInfo?.quality_rating || null,
        contactsCount,
        chatsCount: 0,
      });
    }
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sync-contacts", async (req, res) => {
  try {
    const result = await s(req).syncWhatsAppContacts();
    res.status(result.success ? 200 : 503).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sync-chats", async (req, res) => {
  try {
    const session = s(req);
    if (!session.ready) return res.status(409).json({ error: "Link your QR/Web session to import its chats and address book." });
    session.syncWhatsAppChatsAndMessages().catch(() => {});
    res.status(202).json({ accepted: true, status: "running" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sync-status", async (req, res) => res.json(s(req).syncState || { status: "idle" }));
router.get("/interactive-capabilities", async (req, res) => {
  try {
    const engines = await require("../services/waLoadBalancer").getActiveEngines(String(req.user?.id || mgr.defaultKey));
    res.json({ nativeButtons: engines.some((engine) => engine.supportsInteractive), webConnected: !!s(req).ready,
      chatStorage: "browser", serverChatStorage: require("../services/waChatPrivacy").serverChatStorageEnabled(),
      senders: engines.map((engine) => ({ id: engine.id, name: engine.name, phone: engine.phone, type: engine.type, nativeButtons: !!engine.supportsInteractive })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/test-send", async (req, res) => {
  try {
    const { phone, message, engine } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });
    const result = await s(req).sendTestMessage(phone, message, engine);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/qr", qrRefreshLimiter, async (req, res) => {
  try {
    if (req.query.mock === "true") {
      const demoQr = "2@madhura-demo-qr-token-" + Date.now();
      const demoDataUrl = await toDataUrl(demoQr);
      return res.json({
        qr: demoQr,
        qrDataUrl: demoDataUrl,
        initializing: false,
        connected: false,
        message: "QR Ready (Mock Test Mode)",
      });
    }

    const session = userSession(req);
    if (req.query.force === "true" || req.query.refresh === "true") {
      if (req.query.force === "true" && !session.ready) {
        await session.init(true).catch(() => {});
      }
      const refreshed = await session.refreshQr();
      const qrVal = refreshed.qr || session.qrCode || null;
      const qrDataUrl = session.qrDataUrl || await toDataUrl(qrVal);
      return res.json({
        qr: qrVal,
        qrDataUrl,
        initializing: session.isInitializing,
        connected: session.ready,
        message: session.ready ? "Connected" : qrVal ? "QR Ready" : "Refreshing QR code...",
      });
    }

    // Fast-path: return cached QR instantly if already in memory (<1ms)
    if (session.qrCode) {
      const qrDataUrl = session.qrDataUrl || await toDataUrl(session.qrCode);
      return res.json({ qr: session.qrCode, qrDataUrl, initializing: false, connected: false });
    }
    if (session.ready) {
      return res.json({ qr: null, qrDataUrl: null, initializing: false, connected: true });
    }

    // Ensure initialization is kicked off in the background immediately
    if (!session.client && !session.isInitializing) {
      session.init(false).catch((e) => console.warn("WhatsApp background init warning:", e.message));
    }

    // Quick wait (up to 3.5s) for instant response without hanging proxies or timing out
    const qr = await session.getQr(3500).catch(() => null);
    const finalQr = qr || session.qrCode || null;
    const qrDataUrl = session.qrDataUrl || await toDataUrl(finalQr);
    res.json({
      qr: finalQr,
      qrDataUrl,
      initializing: session.isInitializing || (!finalQr && !session.ready),
      connected: session.ready,
      message: session.ready
        ? "Connected"
        : finalQr
        ? "QR Ready"
        : "Initializing browser session in background...",
    });
  } catch (err) {
    const session = userSession(req);
    const finalQr = session?.qrCode || null;
    const qrDataUrl = session?.qrDataUrl || await toDataUrl(finalQr);
    res.json({
      qr: finalQr,
      qrDataUrl,
      initializing: session?.isInitializing || false,
      connected: session?.ready || false,
      message: "Initializing WhatsApp engine in background...",
    });
  }
});

router.post("/refresh-qr", async (req, res) => {
  try {
    if (req.query.mock === "true") {
      const demoQr = "2@madhura-demo-qr-token-" + Date.now();
      const demoDataUrl = await toDataUrl(demoQr);
      return res.json({
        connected: false,
        qr: demoQr,
        qrDataUrl: demoDataUrl,
        refreshed: true,
        message: "QR Refreshed (Mock Test Mode)",
      });
    }

    const session = userSession(req);
    const result = await session.refreshQr();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to refresh QR code" });
  }
});

router.get("/pairing-code", async (req, res) => {
  try {
    if (req.query.mock === "true") {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 8; i++) {
        if (i === 4) code += "-";
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return res.json({ code, message: "Mock pairing code generated for testing" });
    }

    const phone = req.query.phone;
    if (!phone) return res.status(400).json({ error: "phone query parameter is required (e.g. ?phone=919876543210)" });
    const code = await userSession(req).getPairingCode(phone);
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to generate pairing code" });
  }
});

router.get("/chats", async (req, res) => {
  try {
    const chats = await s(req).getChats(req.query.refresh === "true");
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/chat/:chatId/messages", async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const messages = await s(req).getMessages(req.params.chatId, req.query.refresh === "true", limit);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark chat / messages as read (send seen)
router.post("/chat/:chatId/read", async (req, res) => {
  try {
    const rawChatId = req.params.chatId;
    const clean10 = rawChatId.replace(/\D/g, "").slice(-10);
    const digitsOnly = rawChatId.replace(/\D/g, "");

    // 1. Mark on active session (WhatsApp Web / Baileys)
    await s(req).sendSeen(rawChatId).catch(() => {});

    // 2. Mark in database tables. Scoped to the caller's organization: the
    // phone LIKE match alone would clear another tenant's unread counter and
    // read receipts for the same number.
    const markTenantId = await require("../services/waContactTenancy").tenantForContactWrite({ req });
    await db.promise().query(
      "UPDATE wa_contacts SET unread_count = 0 WHERE tenant_id = ? AND (phone LIKE ? OR phone LIKE ?)",
      [markTenantId, `%${clean10}`, `%${digitsOnly}`]
    ).catch(() => {});

    await db.promise().query(
      "UPDATE wa_message_logs SET is_read = 1 WHERE tenant_id = ? AND (phone LIKE ? OR phone LIKE ?) AND direction = 'inbound'",
      [markTenantId, `%${clean10}`, `%${digitsOnly}`]
    ).catch(() => {});

    // 3. Emit real-time socket event
    try {
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${req.user.id}`).emit("wa_chat_read", { chatId: rawChatId, phone: clean10 });
      }
    } catch (_) {}

    res.json({ success: true, chatId: rawChatId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/contact-balance", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: "phone query parameter is required" });
    const balance = await s(req).getContactBalance(phone);
    // Bundled here rather than as its own request — the chat header needs the
    // AI pill state at exactly the moment it opens a chat.
    try {
      const last10 = phone.replace(/\D/g, "").slice(-10);
      const [rows] = await db.promise().query(
        "SELECT ai_enabled, ai_paused_until FROM wa_contacts WHERE phone LIKE ? LIMIT 1",
        [`%${last10}`]
      );
      const c = rows[0];
      balance.aiEnabled = c ? c.ai_enabled !== 0 : true;
      balance.aiPausedUntil = c && c.ai_paused_until && new Date(c.ai_paused_until) > new Date()
        ? c.ai_paused_until
        : null;
    } catch (_) {}
    res.json(balance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Profile Picture for a Chat / Phone Number
router.get("/chat/:chatId/profile-pic", async (req, res) => {
  try {
    const rawChatId = req.params.chatId;
    const picUrl = await s(req).getProfilePicUrl(rawChatId);
    res.json({ success: true, chatId: rawChatId, profilePicUrl: picUrl || null });
  } catch (err) {
    res.json({ success: false, profilePicUrl: null });
  }
});

router.get("/contact/:phone/profile-pic", async (req, res) => {
  try {
    const rawPhone = req.params.phone;
    const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
    const picUrl = await s(req).getProfilePicUrl(cleanPhone);
    res.json({ success: true, phone: cleanPhone, profilePicUrl: picUrl || null });
  } catch (err) {
    res.json({ success: false, profilePicUrl: null });
  }
});

// Manually update or save a contact's avatar URL
router.post("/contact/:phone/profile-pic", async (req, res) => {
  try {
    const { profile_pic_url } = req.body;
    const cleanPhone = req.params.phone.replace(/\D/g, "").slice(-10);
    if (!cleanPhone) return res.status(400).json({ error: "Invalid phone number" });

    const picTenantId = await require("../services/waContactTenancy").tenantForContactWrite({ req });
    await db.promise().query(
      "UPDATE wa_contacts SET profile_pic_url = ?, avatar_url = ? WHERE tenant_id = ? AND phone LIKE ?",
      [profile_pic_url, profile_pic_url, picTenantId, `%${cleanPhone}`]
    );
    res.json({ success: true, phone: cleanPhone, profilePicUrl: profile_pic_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch sync profile pictures for top active contacts
router.post("/sync-profile-pics", async (req, res) => {
  try {
    const [contacts] = await db.promise().query(
      "SELECT id, phone, name FROM wa_contacts WHERE profile_pic_url IS NULL OR profile_pic_url = '' ORDER BY last_message_at DESC LIMIT 50"
    );

    let syncedCount = 0;
    const session = s(req);

    for (const c of contacts) {
      if (!c.phone) continue;
      const clean = c.phone.replace(/\D/g, "").slice(-10);
      try {
        const url = await session.getProfilePicUrl(clean);
        if (url) syncedCount++;
      } catch (_) {}
    }

    res.json({ success: true, syncedCount, totalChecked: contacts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/account-balance", async (req, res) => {
  try {
    const balance = await s(req).getAccountBalance();
    res.json(balance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bot status for the open chat. DB-only on purpose: the inbox needs this pill
// even when no WhatsApp session is connected, so it must not depend on one.
router.get("/chat/:phone/bot-status", async (req, res) => {
  try {
    const last10 = req.params.phone.replace(/\D/g, "").slice(-10);
    const [rows] = await db.promise().query(
      `SELECT ai_enabled, ai_paused_until, assigned_agent_name, ticket_status
         FROM wa_contacts WHERE phone LIKE ? LIMIT 1`,
      [`%${last10}`]
    );
    const c = rows[0];
    const pausedUntil =
      c && c.ai_paused_until && new Date(c.ai_paused_until) > new Date() ? c.ai_paused_until : null;
    res.json({
      enabled: c ? c.ai_enabled !== 0 : true,
      pausedUntil,
      paused: Boolean(pausedUntil) || (c ? c.ai_enabled === 0 : false),
      assignedAgentName: c?.assigned_agent_name || null,
      ticketStatus: c?.ticket_status || "open",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Per-chat AI switch. The global toggle stays on the Accounts page; this lets a
// human take one conversation off the bot without disabling it everywhere.
router.patch("/chat/:phone/ai", async (req, res) => {
  try {
    const last10 = req.params.phone.replace(/\D/g, "").slice(-10);
    const enabled = req.body.enabled ? 1 : 0;
    // Scoped to the caller's organization: without it this upsert matched on
    // phone alone, so one tenant's per-chat AI switch flipped another
    // tenant's contact.
    const contactTenantId = await require("../services/waContactTenancy").tenantForContactWrite({ req });
    await db.promise().query(
      `INSERT INTO wa_contacts (tenant_id, name, phone, country_code, source, opt_in_status, ai_enabled)
       VALUES (?, 'Customer', ?, '91', 'Chat', 1, ?)
       ON DUPLICATE KEY UPDATE ai_enabled = VALUES(ai_enabled), ai_paused_until = NULL`,
      [contactTenantId, last10, enabled]
    );
    res.json({ success: true, aiEnabled: !!enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/send-interactive", messageSendLimiter, async (req, res) => {
  try {
    const { chatId, message, buttons = [] } = req.body;
    if (!chatId || typeof message !== "string" || !message.trim() || !Array.isArray(buttons) || !buttons.length || buttons.length > 10) {
      return res.status(400).json({ error: "A chat, message, and between 1 and 10 options are required." });
    }
    if (String(chatId).includes("@g.us")) return res.status(400).json({ error: "Interactive menus require an individual chat." });
    if (buttons.some((button) => !button || typeof button !== "object")) return res.status(400).json({ error: "Each menu option must have a label and action." });
    const items = buttons.map((button, index) => ({
      id: String(button.id || `option_${index + 1}`), title: String(button.title || button.text || "").trim(),
      type: button.type || "reply", url: button.url, phone: button.phone,
    }));
    if (items.some((item) => !item.title || !["reply", "url", "call"].includes(item.type)) || new Set(items.map((item) => item.id)).size !== items.length) {
      return res.status(400).json({ error: "Each option needs a label, unique ID, and a supported action." });
    }
    if (items.some((item) => item.type === "url" && !/^https?:\/\//i.test(item.url || "") || item.type === "call" && !/^\+?[\d\s()-]{7,20}$/.test(item.phone || ""))) {
      return res.status(400).json({ error: "Link and call options need a valid HTTP(S) URL or phone number." });
    }
    const sessionKey = String(req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id || mgr.defaultKey);
    let phone = String(chatId).replace(/\D/g, "");
    if (String(chatId).endsWith("@lid")) {
      phone = await s(req).resolveLidToPhone(chatId).catch(() => null);
      if (!phone) return res.status(400).json({ error: "This chat's phone number could not be resolved." });
    }
    if (phone.length === 10) phone = `91${phone}`;
    const balancer = require("../services/waLoadBalancer");
    const interactive = require("../services/waInteractive");
    let result, payload, historyText;
    if (items.every((item) => item.type === "reply")) {
      const asList = items.length > 3;
      const sections = interactive.normalizeSections(items);
      const normalized = asList ? interactive.flattenSections(sections) : interactive.normalizeButtons(items);
      historyText = interactive.buildNumberedText({ body: message, items: normalized });
      const options = { phone, body: message, sessionKey, requireNative: !!req.body.requireNative, preferredEngine: req.body.preferredEngine || null };
      result = asList
        ? await balancer.sendInteractiveList({ ...options, sections })
        : await balancer.sendInteractiveButtons({ ...options, buttons: normalized });
      payload = { type: asList ? "list" : "buttons", text: message, ...(asList ? { sections } : { buttons: normalized }) };
    } else if (items.length === 1 && items[0].type === "url") {
      result = await balancer.sendCTAButtonMessage({ phone, body: message, displayText: items[0].title, url: items[0].url, sessionKey });
      payload = { type: "cta_url", text: message, button_text: items[0].title, url: items[0].url };
      historyText = `${message}\n${items[0].url}`;
    } else {
      // Mixed URL/call/reply actions cannot be one free-form native menu.
      // Deliver their actual links and phone numbers, retaining the CRM actions.
      historyText = `${message}\n\n${items.map((item, index) => `${index + 1}. ${item.title}${item.url ? `: ${item.url}` : item.phone ? `: ${item.phone}` : ""}`).join("\n")}`;
      result = await balancer.sendTextMessage(phone, historyText, sessionKey);
      payload = { type: "buttons", text: message, buttons: items };
    }
    const id = await require("../services/waFlowEngine").recordAndEmitBotMessage(phone, historyText, "interactive", { ...payload, native: !!result.native }, sessionKey, chatId,
      { id: interactive.deliveryMessageId(result), status: "sent" });
    await require("../services/waBotGate").pauseBot(chatId, undefined, "manual menu reply", req.user?.id).catch(() => {});
    return res.json({ success: true, id, native: !!result.native, interactive: payload });
  } catch (err) {
    return res.status(err.deliveryUnknown ? 504 : 502).json({ error: err.message, deliveryUnknown: !!err.deliveryUnknown });
  }
});

router.post("/send", messageSendLimiter, async (req, res) => {
  try {
    const { chatId, message, quotedMessageId, replyToMessageId, idempotencyKey } = req.body;
    if (!chatId || !message) {
      return res.status(400).json({ error: "chatId and message required" });
    }

    const session = s(req);
    const cloudClient = await require("../services/waConfigHelper").cloudClientForUser(req.user?.id || mgr.defaultKey);
    const cloudConfigured = cloudClient.isConfigured();

    // 1. If physical WhatsApp Web session is ready, send through it
    if (session && session.ready) {
      try {
        const result = await session.sendMessage(chatId, message, {
          quotedMessageId,
          replyToMessageId,
          idempotencyKey: idempotencyKey || null,
        });
        await require("../services/waBotGate").pauseBot(chatId, undefined, "manual reply", req.user?.id).catch(() => {});
        return res.json(result);
      } catch (sendErr) {
        if (sendErr?.deliveryUnknown) {
          return res.status(504).json({ error: sendErr.message, deliveryUnknown: true, code: sendErr.code });
        }
        return res.status(502).json({ success: false, error: sendErr.message, code: "WA_SEND_FAILED" });
      }
    }

    // 2. If Meta Cloud API is configured, send through Cloud API
    if (cloudConfigured) {
      try {
        let cleanPhone = String(chatId).replace(/\D/g, "");
        if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
        const sent = await cloudClient.sendText(cleanPhone, message);
        const msgId = sent?.messages?.[0]?.id || ("cloud_" + Date.now());
        await recordCloudSend(req, chatId, cleanPhone, msgId, message).catch(() => {});
        return res.json({ success: true, id: msgId, activeEngine: "Meta Cloud API" });
      } catch (cloudErr) {
        return res.status(502).json({ success: false, error: cloudErr.message, code: "WA_CLOUD_SEND_FAILED" });
      }
    }

    return res.status(503).json({
      success: false,
      code: "WA_SEND_UNAVAILABLE",
      error: "Message was not sent. Connect your WhatsApp number or check your Cloud API configuration, then try again.",
    });
  } catch (err) {
    if (err?.deliveryUnknown) {
      return res.status(504).json({ error: err.message, deliveryUnknown: true, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

// Emoji reaction on a message
router.post("/react", async (req, res) => {
  try {
    const { chatId, messageId, emoji } = req.body;
    if (!chatId || !messageId || !emoji) {
      return res.status(400).json({ error: "chatId, messageId, and emoji required" });
    }
    const result = await s(req).sendReaction(chatId, messageId, emoji);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Saved Quick Replies (/shortcut)
router.get("/quick-replies", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM wa_quick_replies ORDER BY shortcut ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/quick-replies", async (req, res) => {
  try {
    const { title, shortcut, message_text } = req.body;
    if (!title || !shortcut || !message_text) {
      return res.status(400).json({ error: "title, shortcut, and message_text are required" });
    }
    const cleanShortcut = shortcut.replace(/^\//, "").toLowerCase().trim();
    const [result] = await db.promise().query(
      "INSERT INTO wa_quick_replies (title, shortcut, message_text, created_by) VALUES (?, ?, ?, ?)",
      [title, cleanShortcut, message_text, req.user?.id || null]
    );
    res.json({ id: result.insertId, title, shortcut: cleanShortcut, message_text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/quick-replies/:id", async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_quick_replies WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full CRM context for contact sidebar
router.get("/contact-crm-details/:phone", async (req, res) => {
  try {
    const rawPhone = req.params.phone || "";
    const clean10 = rawPhone.replace(/\D/g, "").slice(-10);
    const digitsOnly = rawPhone.replace(/\D/g, "");

    const [contacts] = await db.promise().query(
      "SELECT * FROM wa_contacts WHERE phone LIKE ? OR phone LIKE ? LIMIT 1",
      [`%${clean10}`, `%${digitsOnly}`]
    ).catch(() => [[]]);
    const contact = contacts[0] || null;

    // Fetch linked CRM records
    const [clients] = await db.promise().query(
      "SELECT id, name, company_name, email, phone, address, source FROM clients WHERE phone LIKE ? OR phone LIKE ? LIMIT 1",
      [`%${clean10}`, `%${digitsOnly}`]
    ).catch(() => [[]]);

    const [telecalls] = await db.promise().query(
      "SELECT id, customer_name, company_name, mobile_number, status, service, remarks, created_at FROM telecalls WHERE mobile_number LIKE ? ORDER BY id DESC LIMIT 5",
      [`%${clean10}`]
    ).catch(() => [[]]);

    const [walkins] = await db.promise().query(
      "SELECT id, customer_name, company_name, mobile_number, status, purpose, created_at FROM walkins WHERE mobile_number LIKE ? ORDER BY id DESC LIMIT 5",
      [`%${clean10}`]
    ).catch(() => [[]]);

    const clientComp = clients[0]?.company_name || clients[0]?.name || telecalls[0]?.company_name || "";

    let invoices = [];
    let quotations = [];
    let amcContracts = [];

    if (clientComp) {
      const [inv] = await db.promise().query(
        "SELECT id, invoice_no, client_company, total_amount, due_date, status, created_at FROM clientinvoices WHERE client_company = ? OR customer_name = ? ORDER BY id DESC LIMIT 5",
        [clientComp, clientComp]
      ).catch(() => [[]]);
      invoices = inv || [];

      const [quot] = await db.promise().query(
        "SELECT id, quotation_no, company_name, grand_total, status, created_at FROM quotations WHERE company_name = ? ORDER BY id DESC LIMIT 5",
        [clientComp]
      ).catch(() => [[]]);
      quotations = quot || [];

      const [amc] = await db.promise().query(
        "SELECT id, contract_title, client_company, total_amount, start_date, end_date, status FROM contracts WHERE client_company = ? ORDER BY id DESC LIMIT 5",
        [clientComp]
      ).catch(() => [[]]);
      amcContracts = amc || [];
    }

    res.json({
      contact,
      client: clients[0] || null,
      telecalls: telecalls || [],
      walkins: walkins || [],
      invoices,
      quotations,
      amcContracts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Add WhatsApp contact as a CRM Client ─────────────────────────────────────
router.post("/add-to-crm-client", async (req, res) => {
  try {
    const { phone, name, company_name, email, city, service, notes } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });

    const clean10 = phone.replace(/\D/g, "").slice(-10);
    if (clean10.length < 10) return res.status(400).json({ error: "Invalid phone number" });

    const customerName = (name || "").trim() || "WhatsApp Contact";

    // 1. Check if client already exists by phone
    const [existing] = await db.promise().query(
      "SELECT id, name, company_name, phone, email, source FROM clients WHERE phone LIKE ? OR phone LIKE ? LIMIT 1",
      [`%${clean10}`, clean10]
    );

    if (existing && existing.length > 0) {
      // Client already exists — update source to include WhatsApp if not already set
      if (!existing[0].source) {
        await db.promise().query(
          "UPDATE clients SET source = 'WhatsApp' WHERE id = ?",
          [existing[0].id]
        );
      }
      // Link wa_contacts to this client. Scoped to the caller's organization -
      // the phone LIKE match alone would relink every tenant's contact for
      // that number to one CRM client.
      const linkTenantId = await require("../services/waContactTenancy").tenantForContactWrite({ req });
      await db.promise().query(
        `UPDATE wa_contacts SET crm_ref_type = 'clients', crm_ref_id = ? WHERE tenant_id = ? AND phone LIKE ?`,
        [existing[0].id, linkTenantId, `%${clean10}`]
      ).catch(() => {});

      return res.json({
        success: true,
        isExisting: true,
        message: "Client already exists in CRM",
        client: { ...existing[0], source: existing[0].source || "WhatsApp" },
      });
    }

    // 2. Create new client with source = 'WhatsApp'
    const userId = req.user?.id || null;
    const [result] = await db.promise().query(
      `INSERT INTO clients (name, company_name, email, phone, city, service, notes, client_status, source, lead_reference, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'WhatsApp', 'WhatsApp', ?, NOW())`,
      [
        customerName,
        (company_name || "").trim() || null,
        (email || "").trim() || null,
        clean10,
        (city || "").trim() || null,
        (service || "").trim() || null,
        (notes || "").trim() || `Client added from WhatsApp chat`,
        userId,
      ]
    );
    const newClientId = result.insertId;

    // 3. Link wa_contacts to the new client
    const contactTenantId = await require("../services/waContactTenancy").tenantForContactWrite({ req });
    await db.promise().query(
      `INSERT INTO wa_contacts (tenant_id, name, phone, country_code, source, crm_ref_type, crm_ref_id, opt_in_status, last_contacted)
       VALUES (?, ?, ?, '91', 'WhatsApp', 'clients', ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         name = COALESCE(NULLIF(VALUES(name), 'WhatsApp Contact'), name),
         source = 'WhatsApp',
         crm_ref_type = 'clients',
         crm_ref_id = VALUES(crm_ref_id),
         last_contacted = NOW()`,
      [contactTenantId, customerName, clean10, newClientId]
    ).catch(() => {});

    // 4. Send admin notification
    try {
      const notifMsg = `New Client from WhatsApp: ${customerName} (+91${clean10})${service ? ` — ${service}` : ""}`;
      await db.promise().query(
        `INSERT INTO admin_notifications (type, message, related_type, related_id, priority)
         VALUES ('new_client', ?, 'clients', ?, 'high')`,
        [notifMsg, newClientId]
      );

      const { getNotificationIO } = require("../sockets/notifications");
      const helpers = getNotificationIO && getNotificationIO();
      if (helpers) {
        helpers.sendToAdmin("new_notification", {
          id: Date.now(),
          type: "new_client",
          title: "🎉 New Client from WhatsApp!",
          message: notifMsg,
          related_type: "clients",
          related_id: newClientId,
          timestamp: new Date().toISOString(),
          is_read: 0,
        });
      }
    } catch (_) {}

    // 5. Return the new client
    const [newClient] = await db.promise().query(
      "SELECT * FROM clients WHERE id = ?",
      [newClientId]
    );

    res.json({
      success: true,
      isExisting: false,
      message: "Client created successfully from WhatsApp",
      client: newClient[0] || { id: newClientId, name: customerName, phone: clean10, source: "WhatsApp" },
    });

    console.log(`🎉 [WA → CRM] New client created: ${customerName} (+91${clean10}) — ID ${newClientId}`);
  } catch (err) {
    console.error("[WA → CRM] Error creating client:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Assign conversation / contact to an agent
router.post("/assign-agent", async (req, res) => {
  try {
    const { phone, agentId } = req.body;
    if (!phone) return res.status(400).json({ error: "phone is required" });

    const clean10 = phone.replace(/\D/g, "").slice(-10);
    const assignTenantId = await require("../services/waContactTenancy").tenantForContactWrite({ req });
    await db.promise().query(
      "UPDATE wa_contacts SET assigned_agent_id = ? WHERE tenant_id = ? AND phone LIKE ?",
      [agentId || null, assignTenantId, `%${clean10}`]
    );

    // Handing a chat to a human pauses the bot; unassigning gives it back.
    const waBotGate = require("../services/waBotGate");
    if (agentId) await waBotGate.pauseBot(clean10, 24 * 60, "assigned to agent", req.user?.id).catch(() => {});
    else await waBotGate.resumeBot(clean10, req.user?.id).catch(() => {});

    res.json({ success: true, agentId: agentId || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/chat/:chatId/media/:messageId", async (req, res) => {
  try {
    const media = await s(req).getMediaForMessage(
      req.params.chatId,
      req.params.messageId,
      req.query.serializedId,
      req.query.cloudMediaId
    );
    res.json(media);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/upload-media", require("../middleware/r2CampaignUpload"), require("../middleware/legacyUploads").requireLegacyUploads, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const mime = (req.file.mimetype || "").toLowerCase();
  const ext = path.extname(req.file.originalname).toLowerCase();
  let media_type = "document";

  if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
    media_type = "image";
  } else if (mime.startsWith("video/") || [".mp4", ".3gp", ".mov", ".mkv"].includes(ext)) {
    media_type = "video";
  } else if (mime.startsWith("audio/") || [".mp3", ".ogg", ".wav", ".m4a", ".aac"].includes(ext)) {
    media_type = "audio";
  } else if ([".xlsx", ".xls", ".csv"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel")) {
    media_type = "document";
  } else if ([".docx", ".doc"].includes(ext) || mime.includes("word")) {
    media_type = "document";
  } else if (ext === ".pdf" || mime.includes("pdf")) {
    media_type = "document";
  }

  const baseUrl = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  const url = `${baseUrl}/uploads/wa-media/${req.file.filename}`;
  res.json({
    url,
    media_type,
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

const privateAttachmentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
router.post("/send-media-upload", messageSendLimiter, privateAttachmentUpload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.body.chatId) return res.status(400).json({ error: "A file and chat are required." });
    const { chatId, idempotencyKey } = req.body;
    const type = req.body.mediaType || (req.file.mimetype.startsWith("image/") ? "image" : req.file.mimetype.startsWith("video/") ? "video" : req.file.mimetype.startsWith("audio/") ? "audio" : "document");
    const session = s(req);
    let result;
    if (session?.ready) {
      result = await session.sendMediaMessage(chatId, `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`, type, "", req.file.originalname, { idempotencyKey });
    } else {
      const cloud = await require("../services/waConfigHelper").cloudClientForUser(req.user?.id || mgr.defaultKey);
      if (!cloud.isConfigured()) return res.status(503).json({ error: "Connect QR/Web or configure Cloud API before sending an attachment." });
      const uploaded = await cloud.uploadMedia(req.file.buffer, req.file.mimetype, req.file.originalname);
      if (!uploaded?.id) throw new Error("Cloud API did not accept the attachment upload.");
      const sent = await cloud.sendMedia(chatId, type, uploaded.id, "", req.file.originalname);
      const id = require("../services/waInteractive").deliveryMessageId(sent);
      if (!id) throw Object.assign(new Error("Attachment delivery could not be confirmed."), { deliveryUnknown: true });
      result = { success: true, id };
      await recordCloudSend(req, chatId, String(chatId).replace(/\D/g, ""), id, req.file.originalname, type, { hasMedia: true, filename: req.file.originalname, mimetype: req.file.mimetype }).catch(() => {});
    }
    await require("../services/waBotGate").pauseBot(chatId, undefined, "manual attachment reply", req.user?.id).catch(() => {});
    res.json({ success: true, id: result.id, filename: req.file.originalname, mimetype: req.file.mimetype });
  } catch (error) { res.status(error.deliveryUnknown ? 504 : 502).json({ error: error.message, deliveryUnknown: !!error.deliveryUnknown }); }
});

router.post("/send-media", messageSendLimiter, async (req, res) => {
  try {
    const { chatId, mediaUrl, mediaType, filename, caption, idempotencyKey } = req.body;
    if (!chatId || !mediaUrl) return res.status(400).json({ error: "chatId and mediaUrl required" });
    const session = s(req);
    const cloudClient = await require("../services/waConfigHelper").cloudClientForUser(req.user?.id || mgr.defaultKey);
    const cloudConfigured = cloudClient.isConfigured();

    let resolvedType = mediaType;
    if (!resolvedType || resolvedType === "media") {
      const ext = path.extname(filename || mediaUrl || "").toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)) resolvedType = "image";
      else if ([".mp4", ".mov", ".3gp", ".webm", ".mkv"].includes(ext)) resolvedType = "video";
      else if ([".mp3", ".ogg", ".wav", ".m4a", ".aac"].includes(ext)) resolvedType = "audio";
      else resolvedType = "document";
    }

    if (session && session.ready) {
      try {
        const result = await session.sendMediaMessage(
          chatId,
          mediaUrl,
          resolvedType,
          caption || "",
          filename || "",
          { idempotencyKey: idempotencyKey || null }
        );
        await require("../services/waBotGate").pauseBot(chatId, undefined, "manual media reply", req.user?.id).catch(() => {});
        return res.json(result);
      } catch (mediaErr) {
        if (mediaErr?.deliveryUnknown) {
          return res.status(504).json({ error: mediaErr.message, deliveryUnknown: true, code: mediaErr.code });
        }
        return res.status(502).json({ success: false, code: "WA_SEND_FAILED", error: mediaErr.message });
      }
    } else if (cloudConfigured) {
      try {
        let cleanPhone = String(chatId).replace(/\D/g, "");
        if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
        let cloudUrl = mediaUrl;
        if (typeof cloudUrl === "string" && cloudUrl.startsWith("/")) {
          const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
          cloudUrl = `${base}${cloudUrl}`;
        }
        const sent = await cloudClient.sendMedia(cleanPhone, resolvedType, cloudUrl, caption || "", filename || "");
        const msgId = sent?.messages?.[0]?.id || ("cloud_" + Date.now());
        await recordCloudSend(req, chatId, cleanPhone, msgId, caption || filename || "Attachment", resolvedType, { hasMedia: true, mediaUrl: cloudUrl, filename }).catch(() => {});
        return res.json({ success: true, id: msgId, activeEngine: "Meta Cloud API" });
      } catch (cloudErr) {
        return res.status(502).json({ success: false, code: "WA_SEND_FAILED", error: cloudErr.message });
      }
    }

    return res.status(503).json({ success: false, code: "WA_SEND_UNAVAILABLE", error: "Nothing was sent. Connect your WhatsApp number or check your Cloud API configuration, then try again." });
  } catch (err) {
    if (err?.deliveryUnknown) {
      return res.status(504).json({ error: err.message, deliveryUnknown: true, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post("/send-location", messageSendLimiter, async (req, res) => {
  try {
    const { chatId, lat, lng, name, idempotencyKey } = req.body;
    if (!chatId || lat == null || lng == null) return res.status(400).json({ error: "chatId, lat and lng required" });
    const session = s(req);
    const cloudClient = await require("../services/waConfigHelper").cloudClientForUser(req.user?.id || mgr.defaultKey);
    const cloudConfigured = cloudClient.isConfigured();

    if (session && session.ready) {
      try {
        const result = await session.sendLocationMessage(chatId, lat, lng, name || "", {
          idempotencyKey: idempotencyKey || null,
        });
        await require("../services/waBotGate").pauseBot(chatId, undefined, "manual location reply", req.user?.id).catch(() => {});
        return res.json(result);
      } catch (locErr) {
        if (locErr?.deliveryUnknown) {
          return res.status(504).json({ error: locErr.message, deliveryUnknown: true, code: locErr.code });
        }
        return res.status(502).json({ success: false, code: "WA_SEND_FAILED", error: locErr.message });
      }
    } else if (cloudConfigured) {
      try {
        let cleanPhone = String(chatId).replace(/\D/g, "");
        if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
        const sent = await cloudClient.sendLocation(cleanPhone, lat, lng, name || "");
        const msgId = sent?.messages?.[0]?.id || ("cloud_" + Date.now());
        await recordCloudSend(req, chatId, cleanPhone, msgId, name || `Location (${lat}, ${lng})`, "location", { location: { lat, lng, name } }).catch(() => {});
        return res.json({ success: true, id: msgId, activeEngine: "Meta Cloud API" });
      } catch (cloudErr) {
        return res.status(502).json({ success: false, code: "WA_SEND_FAILED", error: cloudErr.message });
      }
    }

    return res.status(503).json({ success: false, code: "WA_SEND_UNAVAILABLE", error: "Nothing was sent. Connect your WhatsApp number or check your Cloud API configuration, then try again." });
  } catch (err) {
    if (err?.deliveryUnknown) {
      return res.status(504).json({ error: err.message, deliveryUnknown: true, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const purge = req.query.purge !== "false" && req.body?.purge !== false;
    const session = userSession(req);
    const result = await session.logout(purge);
    res.json({
      success: true,
      purged: purge,
      message: purge
        ? "WhatsApp session and profile files permanently deleted."
        : "WhatsApp session disconnected. Inactive session files will automatically delete in 4 days.",
      sessionExpiry: result,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/cleanup-expired-sessions", async (req, res) => {
  try {
    const cleaned = await mgr.cleanExpiredSessions();
    res.json({ success: true, count: cleaned.length, cleaned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reconnect", async (req, res) => {
  try {
    const session = userSession(req);
    await session.init(false);
    res.json({ success: true, message: "Reconnection triggered in background", initializing: session.isInitializing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reset-session", sessionResetThrottle, async (req, res) => {
  try {
    const session = userSession(req);
    await session.logout(true).catch(() => {});
    await session.init(true).catch(() => {});
    res.json({ success: true, message: "Session reset and fresh QR initialization started", initializing: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Shared Team Inbox: Assign Chat to Agent ─────────────────────────────────
router.post("/chat/:chatId/assign", async (req, res) => {
  try {
    const { agentId, agentName } = req.body;
    const phone = req.params.chatId.replace(/\D/g, "");
    const inboxTenantId = await require("../services/waContactTenancy").tenantForContactWrite({ req });
    await db.promise().query(
      "UPDATE wa_contacts SET assigned_agent_id = ?, assigned_agent_name = ? WHERE tenant_id = ? AND phone = ?",
      [agentId || null, agentName || null, inboxTenantId, phone]
    );

    const waBotGate = require("../services/waBotGate");
    if (agentId) await waBotGate.pauseBot(phone, 24 * 60, "assigned to agent", req.user?.id).catch(() => {});
    else await waBotGate.resumeBot(phone, req.user?.id).catch(() => {});

    res.json({ success: true, message: `Chat assigned to ${agentName || "unassigned"}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Shared Team Inbox: Update Ticket Status ──────────────────────────────────
router.post("/chat/:chatId/ticket-status", async (req, res) => {
  try {
    const { status } = req.body;
    const phone = req.params.chatId.replace(/\D/g, "");
    const ticketTenantId = await require("../services/waContactTenancy").tenantForContactWrite({ req });
    await db.promise().query(
      "UPDATE wa_contacts SET ticket_status = ? WHERE tenant_id = ? AND phone = ?",
      [status || "open", ticketTenantId, phone]
    );

    // Resolving the ticket hands the conversation back to the bot; marking it
    // spam keeps the bot out of it for good.
    const waBotGate = require("../services/waBotGate");
    if (status === "resolved") await waBotGate.resumeBot(phone, req.user?.id).catch(() => {});
    else if (status === "spam") await waBotGate.pauseBot(phone, 365 * 24 * 60, "marked spam", req.user?.id).catch(() => {});

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Shared Team Inbox: Get & Post Internal Notes ─────────────────────────────
router.get("/chat/:chatId/notes", async (req, res) => {
  try {
    const phone = req.params.chatId.replace(/\D/g, "");
    const [notes] = await db.promise().query(
      "SELECT * FROM wa_internal_notes WHERE phone = ? ORDER BY created_at ASC",
      [phone]
    );
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/chat/:chatId/notes", async (req, res) => {
  try {
    const { note, authorName = "Agent" } = req.body;
    const phone = req.params.chatId.replace(/\D/g, "");
    if (!note) return res.status(400).json({ error: "Note text required" });

    const [result] = await db.promise().query(
      "INSERT INTO wa_internal_notes (phone, author_id, author_name, note_text) VALUES (?, ?, ?, ?)",
      [phone, req.user?.id || 1, authorName, note]
    );

    res.json({ success: true, noteId: result.insertId, message: "Internal note saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Multi-Account Manager: List & Switch ──────────────────────────────────────
router.get("/accounts/list", async (req, res) => {
  try {
    const cloud = await require("../services/waConfigHelper").cloudClientForUser(req.user.id);
    const [accounts] = await db.promise().query("SELECT id, account_name, phone_number, phone_number_id, waba_id, connection_type, is_active, is_default, quality_rating, messaging_limit, created_at FROM wa_accounts WHERE created_by = ? OR (created_by IS NULL AND phone_number_id = ?) ORDER BY is_default DESC, created_at ASC", [req.user.id, cloud.phoneNumberId || ""]);
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/accounts/switch-default", async (req, res) => {
  try {
    const accountId = Number(req.body.accountId);
    if (!Number.isSafeInteger(accountId) || accountId < 1) return res.status(400).json({ error: "Valid accountId required" });
    const cloud = await require("../services/waConfigHelper").cloudClientForUser(req.user.id);
    const [accounts] = await db.promise().query("SELECT * FROM wa_accounts WHERE id = ? AND is_active = 1 AND (created_by = ? OR (created_by IS NULL AND phone_number_id = ?))", [accountId, req.user.id, cloud.phoneNumberId || ""]);
    if (!accounts.length) return res.status(404).json({ error: "Account not found" });
    const account = accounts[0];
    if (account.connection_type === "cloud_api") {
      if (!account.phone_number_id || !account.access_token) return res.status(409).json({ error: "This account has no usable Cloud API credentials" });
      await db.promise().query(
        "INSERT INTO user_wa_configs (user_id, phone_number_id, access_token, waba_id, app_secret, verify_token, business_account_id, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE phone_number_id=VALUES(phone_number_id), access_token=VALUES(access_token), waba_id=VALUES(waba_id), app_secret=VALUES(app_secret), verify_token=VALUES(verify_token), business_account_id=VALUES(business_account_id), is_enabled=1",
        [req.user.id, account.phone_number_id, account.access_token, account.waba_id, account.app_secret, account.verify_token, account.business_account_id]
      );
    }
    await db.promise().query("UPDATE wa_accounts SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE created_by = ? OR (created_by IS NULL AND phone_number_id = ?)", [accountId, req.user.id, cloud.phoneNumberId || ""]);
    res.json({ success: true, message: "Default WhatsApp account switched" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Real-time Seen, React, Delete & Typing Indicators ──────────────────────
router.post("/seen", async (req, res) => {
  try {
    const chatId = req.body?.chatId || req.query?.chatId;
    if (!chatId) return res.json({ success: false });
    const result = await s(req).sendSeen(chatId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/chat/:chatId/seen", async (req, res) => {
  try {
    const result = await s(req).sendSeen(req.params.chatId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/chat/:chatId/react", async (req, res) => {
  try {
    const { messageId, reaction } = req.body;
    const result = await s(req).sendReaction(req.params.chatId, messageId, reaction);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/chat/:chatId/delete-message", async (req, res) => {
  try {
    const { messageId, everyone = true } = req.body;
    const result = await s(req).deleteMessage(req.params.chatId, messageId, everyone);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/chat/:chatId/typing", async (req, res) => {
  try {
    const { isTyping = true } = req.body;
    const result = await s(req).sendTypingState(req.params.chatId, isTyping);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT COALESCE(SUM(unread_count), 0) as totalUnread FROM wa_contacts WHERE is_blocked = 0"
    );
    res.json({ totalUnread: rows[0]?.totalUnread || 0 });
  } catch (err) {
    res.json({ totalUnread: 0 });
  }
});

module.exports = router;
