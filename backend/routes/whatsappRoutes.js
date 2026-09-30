const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../config/database");
const mgr = require("../services/whatsappService");
const qrcode = require("qrcode");

const toDataUrl = async (qr) => {
  if (!qr) return null;
  try {
    return await qrcode.toDataURL(qr, { margin: 1, width: 280 });
  } catch (_) {
    return null;
  }
};

const mediaDir = path.join(__dirname, "..", "uploads", "wa-media");
fs.mkdirSync(mediaDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, mediaDir),
    filename: (req, file, cb) => cb(null, Date.now() + "_" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Resolves the caller's specific session, isolated per authenticated user/sessionKey.
// Only falls back to system default session if no user context exists or explicit fallback is requested.
const s = (req) => {
  const reqKey = req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id;
  if (reqKey) {
    const target = mgr.get(reqKey);
    // Explicit fallback allowed only when requested (e.g. system broadcast or shared fallback)
    if (!target.ready && (req.query?.fallback === "true" || req.headers["x-allow-fallback"] === "true")) {
      const readySession = mgr.all().find((ses) => ses.ready);
      if (readySession) return readySession;
    }
    return target;
  }
  return mgr.default();
};

// Specifically for auth/lifecycle routes (QR, pairing, logout, reset) - isolated per user
const userSession = (req) => {
  const reqKey = req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id || mgr.defaultKey;
  return mgr.get(reqKey);
};

const { configureForUser } = require("../services/waConfigHelper");
const waCloud = require("../services/whatsappCloudApi");

router.get("/status", async (req, res) => {
  if (req.user?.id) {
    await configureForUser(req.user.id).catch(() => {});
  }
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
  });
});

router.get("/unified-status", async (req, res) => {
  if (req.user?.id) {
    await configureForUser(req.user.id).catch(() => {});
  }
  res.json(await s(req).getUnifiedStatus());
});

router.get("/account", async (req, res) => {
  try {
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
        qualityRating: phoneInfo?.quality_rating || "GREEN",
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
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sync-chats", async (req, res) => {
  try {
    const result = await s(req).syncWhatsAppChatsAndMessages();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

router.get("/qr", async (req, res) => {
  try {
    const session = userSession(req);
    if (req.query.force === "true" || req.query.refresh === "true") {
      if (req.query.force === "true" && !session.ready) {
        await session.init(true).catch(() => {});
      }
      const refreshed = await session.refreshQr();
      const qrVal = refreshed.qr || session.qrCode || null;
      const qrDataUrl = await toDataUrl(qrVal);
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
      const qrDataUrl = await toDataUrl(session.qrCode);
      return res.json({ qr: session.qrCode, qrDataUrl, initializing: false, connected: false });
    }
    if (session.ready) {
      return res.json({ qr: null, qrDataUrl: null, initializing: false, connected: true });
    }

    // Wait for up to 15s for the initial QR event to emit (getQr will initiate init(false) cleanly if needed)
    const qr = await session.getQr(15000);
    const finalQr = qr || session.qrCode || null;
    const qrDataUrl = await toDataUrl(finalQr);
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
    const qrDataUrl = await toDataUrl(finalQr);
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
    const session = userSession(req);
    const result = await session.refreshQr();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to refresh QR code" });
  }
});

router.get("/pairing-code", async (req, res) => {
  try {
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

    // 2. Mark in database tables
    await db.promise().query(
      "UPDATE wa_contacts SET unread_count = 0 WHERE phone LIKE ? OR phone LIKE ?",
      [`%${clean10}`, `%${digitsOnly}`]
    ).catch(() => {});

    await db.promise().query(
      "UPDATE wa_message_logs SET is_read = 1 WHERE (phone LIKE ? OR phone LIKE ?) AND direction = 'inbound'",
      [`%${clean10}`, `%${digitsOnly}`]
    ).catch(() => {});

    // 3. Emit real-time socket event
    try {
      const io = req.app.get("io");
      if (io) {
        io.emit("wa_chat_read", { chatId: rawChatId, phone: clean10 });
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

    await db.promise().query(
      "UPDATE wa_contacts SET profile_pic_url = ?, avatar_url = ? WHERE phone LIKE ?",
      [profile_pic_url, profile_pic_url, `%${cleanPhone}`]
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
    await db.promise().query(
      `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, ai_enabled)
       VALUES ('Customer', ?, '91', 'Chat', 1, ?)
       ON DUPLICATE KEY UPDATE ai_enabled = VALUES(ai_enabled), ai_paused_until = NULL`,
      [last10, enabled]
    );
    res.json({ success: true, aiEnabled: !!enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/send", async (req, res) => {
  try {
    const { chatId, message, quotedMessageId, replyToMessageId } = req.body;
    if (!chatId || !message) {
      return res.status(400).json({ error: "chatId and message required" });
    }
    const result = await s(req).sendMessage(chatId, message, { quotedMessageId, replyToMessageId });

    // A human just replied in this chat, so mute the WHOLE bot here for a
    // while — flow engine, menus and welcome included, not just the AI.
    await require("../services/waBotGate").pauseBot(chatId, undefined, "manual reply").catch(() => {});

    res.json(result);
  } catch (err) {
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
      // Link wa_contacts to this client
      await db.promise().query(
        `UPDATE wa_contacts SET crm_ref_type = 'clients', crm_ref_id = ? WHERE phone LIKE ?`,
        [existing[0].id, `%${clean10}`]
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
    await db.promise().query(
      `INSERT INTO wa_contacts (name, phone, country_code, source, crm_ref_type, crm_ref_id, opt_in_status, last_contacted)
       VALUES (?, ?, '91', 'WhatsApp', 'clients', ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         name = COALESCE(NULLIF(VALUES(name), 'WhatsApp Contact'), name),
         source = 'WhatsApp',
         crm_ref_type = 'clients',
         crm_ref_id = VALUES(crm_ref_id),
         last_contacted = NOW()`,
      [customerName, clean10, newClientId]
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
    await db.promise().query(
      "UPDATE wa_contacts SET assigned_agent_id = ? WHERE phone LIKE ?",
      [agentId || null, `%${clean10}`]
    );

    // Handing a chat to a human pauses the bot; unassigning gives it back.
    const waBotGate = require("../services/waBotGate");
    if (agentId) await waBotGate.pauseBot(clean10, 24 * 60, "assigned to agent").catch(() => {});
    else await waBotGate.resumeBot(clean10).catch(() => {});

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
      req.query.serializedId
    );
    res.json(media);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/upload-media", upload.single("file"), async (req, res) => {
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

  const url = `${req.protocol}://${req.get("host")}/uploads/wa-media/${req.file.filename}`;
  res.json({
    url,
    media_type,
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

router.post("/send-media", async (req, res) => {
  try {
    const { chatId, mediaUrl, mediaType, filename, caption } = req.body;
    if (!chatId || !mediaUrl) return res.status(400).json({ error: "chatId and mediaUrl required" });
    const result = await s(req).sendMediaMessage(chatId, mediaUrl, mediaType || "document", caption || "", filename || "");
    await require("../services/waBotGate").pauseBot(chatId, undefined, "manual media reply").catch(() => {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/send-location", async (req, res) => {
  try {
    const { chatId, lat, lng, name } = req.body;
    if (!chatId || lat == null || lng == null) return res.status(400).json({ error: "chatId, lat and lng required" });
    const result = await s(req).sendLocationMessage(chatId, lat, lng, name || "");
    await require("../services/waBotGate").pauseBot(chatId, undefined, "manual location reply").catch(() => {});
    res.json(result);
  } catch (err) {
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

router.post("/reset-session", async (req, res) => {
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
    await db.promise().query(
      "UPDATE wa_contacts SET assigned_agent_id = ?, assigned_agent_name = ? WHERE phone = ?",
      [agentId || null, agentName || null, phone]
    );

    const waBotGate = require("../services/waBotGate");
    if (agentId) await waBotGate.pauseBot(phone, 24 * 60, "assigned to agent").catch(() => {});
    else await waBotGate.resumeBot(phone).catch(() => {});

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
    await db.promise().query(
      "UPDATE wa_contacts SET ticket_status = ? WHERE phone = ?",
      [status || "open", phone]
    );

    // Resolving the ticket hands the conversation back to the bot; marking it
    // spam keeps the bot out of it for good.
    const waBotGate = require("../services/waBotGate");
    if (status === "resolved") await waBotGate.resumeBot(phone).catch(() => {});
    else if (status === "spam") await waBotGate.pauseBot(phone, 365 * 24 * 60, "marked spam").catch(() => {});

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
    const [accounts] = await db.promise().query("SELECT * FROM wa_accounts ORDER BY is_default DESC, created_at ASC");
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/accounts/switch-default", async (req, res) => {
  try {
    const { accountId } = req.body;
    await db.promise().query("UPDATE wa_accounts SET is_default = 0");
    await db.promise().query("UPDATE wa_accounts SET is_default = 1 WHERE id = ?", [accountId]);
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
