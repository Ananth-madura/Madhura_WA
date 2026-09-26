"use strict";

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const qrcode = require("qrcode");
const mgr = require("../services/whatsappService");
const crmWebhookForwarder = require("../services/crmWebhookForwarder");
const db = require("../config/database");

const uploadDir = path.join(__dirname, "..", "uploads", "wa-media");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Helper to resolve session
const getSession = (req) => {
  const sessionKey = req.headers["x-session-key"] || req.query?.sessionKey || req.body?.sessionKey || req.user?.id || mgr.defaultKey;
  return mgr.get(sessionKey);
};

// ── GET /status: Universal WhatsApp status for any CRM ──────────────────────
router.get("/status", async (req, res) => {
  try {
    const session = getSession(req);
    const sessionStatus = await session.getStatus();
    const qrText = session.qrCode || null;
    let qrDataUrl = null;
    if (qrText) {
      try {
        qrDataUrl = await qrcode.toDataURL(qrText, { margin: 1, width: 260 });
      } catch (_) {}
    }

    res.json({
      success: true,
      service: "whatsapp-crm",
      version: "2.0.0",
      connected: Boolean(sessionStatus.connected),
      phone: sessionStatus.phone || null,
      initializing: Boolean(sessionStatus.initializing),
      hasQr: Boolean(session.qrCode),
      qr: qrText,
      qrDataUrl,
      activeEngine: sessionStatus.connected ? "WhatsApp Web Session" : "Disconnected",
      webhookUrl: crmWebhookForwarder.getWebhookUrl(),
      sessionKey: session.key,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /qr: Instant QR code endpoint (JSON, Image, or SVG) ─────────────────
router.get("/qr", async (req, res) => {
  try {
    const session = getSession(req);
    if (req.query.refresh === "true" || req.query.force === "true") {
      await session.refreshQr();
    }

    let qr = session.qrCode;
    if (!qr && !session.ready) {
      qr = await session.getQr(15000).catch(() => null);
    }

    if (session.ready) {
      return res.json({
        success: true,
        connected: true,
        phone: session.phone,
        message: "WhatsApp is already connected",
      });
    }

    if (!qr) {
      return res.json({
        success: true,
        connected: false,
        initializing: true,
        qr: null,
        message: "Initializing WhatsApp engine in background... please retry in a few seconds.",
      });
    }

    // Format options: ?format=png, ?format=svg, or json default
    const format = req.query.format || "json";
    if (format === "png") {
      const buffer = await qrcode.toBuffer(qr, { margin: 2, width: 300 });
      res.setHeader("Content-Type", "image/png");
      return res.send(buffer);
    } else if (format === "svg") {
      const svg = await qrcode.toString(qr, { type: "svg", margin: 2 });
      res.setHeader("Content-Type", "image/svg+xml");
      return res.send(svg);
    }

    const dataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 280 });
    res.json({
      success: true,
      connected: false,
      initializing: false,
      qr,
      qrDataUrl: dataUrl,
      message: "Scan this QR code with WhatsApp on your phone",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /messages/send: Universal send text message ────────────────────────
router.post(["/messages/send", "/send"], async (req, res) => {
  try {
    const { to, phone, message, text, body, quotedMessageId, replyToMessageId } = req.body || {};
    const targetPhone = to || phone;
    const msgText = message || text || body;

    if (!targetPhone) {
      return res.status(400).json({ success: false, error: "Recipient phone number ('to' or 'phone') is required" });
    }
    if (!msgText) {
      return res.status(400).json({ success: false, error: "Message text ('message' or 'text') is required" });
    }

    const session = getSession(req);
    const result = await session.sendMessage(targetPhone, msgText, {
      quotedMessageId: quotedMessageId || replyToMessageId,
    });

    // Notify outbound webhook
    crmWebhookForwarder.forwardOutgoingMessage({
      sessionKey: session.key,
      chatId: `${String(targetPhone).replace(/\D/g, "")}@c.us`,
      phone: targetPhone,
      message: {
        id: result?.id || `sent_${Date.now()}`,
        body: msgText,
        to: targetPhone,
        type: "text",
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    res.json({
      success: true,
      messageId: result?.id || null,
      to: targetPhone,
      status: "sent",
      result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /messages/send-media: Universal send media/file/document ───────────
router.post(["/messages/send-media", "/send-media"], upload.single("file"), async (req, res) => {
  try {
    const session = getSession(req);
    const { to, phone, caption, mediaUrl, filename } = req.body || {};
    const targetPhone = to || phone;

    if (!targetPhone) {
      return res.status(400).json({ success: false, error: "Recipient phone number is required" });
    }

    let filePath = null;
    let fileOriginalName = filename || null;

    if (req.file) {
      filePath = req.file.path;
      fileOriginalName = fileOriginalName || req.file.originalname;
    } else if (mediaUrl) {
      // Download mediaUrl to local uploads
      const axios = require("axios");
      const ext = path.extname(mediaUrl.split("?")[0]) || ".bin";
      const localName = `${Date.now()}_downloaded${ext}`;
      filePath = path.join(uploadDir, localName);
      const dlRes = await axios.get(mediaUrl, { responseType: "arraybuffer", timeout: 15000 });
      fs.writeFileSync(filePath, Buffer.from(dlRes.data));
      fileOriginalName = fileOriginalName || path.basename(mediaUrl.split("?")[0]);
    } else {
      return res.status(400).json({ success: false, error: "Either file upload or 'mediaUrl' is required" });
    }

    const result = await session.sendMedia(targetPhone, filePath, caption || "", fileOriginalName);

    crmWebhookForwarder.forwardOutgoingMessage({
      sessionKey: session.key,
      chatId: `${String(targetPhone).replace(/\D/g, "")}@c.us`,
      phone: targetPhone,
      message: {
        id: result?.id || `sent_${Date.now()}`,
        body: caption || fileOriginalName || "Media Attachment",
        to: targetPhone,
        type: "media",
        filename: fileOriginalName,
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    res.json({
      success: true,
      messageId: result?.id || null,
      to: targetPhone,
      status: "sent",
      filename: fileOriginalName,
      result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /chats: List recent conversations ───────────────────────────────────
router.get("/chats", async (req, res) => {
  try {
    const session = getSession(req);
    const chats = await session.getChats(req.query.refresh === "true");
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /chats/:chatId/messages: Fetch messages for a chat ──────────────────
router.get("/chats/:chatId/messages", async (req, res) => {
  try {
    const session = getSession(req);
    const limit = Number(req.query.limit) || 20;
    const messages = await session.getMessages(req.params.chatId, req.query.refresh === "true", limit);
    res.json({ success: true, chatId: req.params.chatId, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /webhook/configure: Runtime webhook URL setup ──────────────────────
router.post("/webhook/configure", (req, res) => {
  try {
    const { webhookUrl, secret } = req.body || {};
    crmWebhookForwarder.setWebhookUrl(webhookUrl);
    if (secret) crmWebhookForwarder.webhookSecret = secret;

    res.json({
      success: true,
      message: "CRM Webhook URL configured successfully",
      webhookUrl: crmWebhookForwarder.getWebhookUrl(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /webhook/deliveries: View webhook delivery log ──────────────────────
router.get("/webhook/deliveries", (req, res) => {
  res.json({
    success: true,
    webhookUrl: crmWebhookForwarder.getWebhookUrl(),
    deliveries: crmWebhookForwarder.getRecentDeliveries(),
  });
});

// ── POST /webhook/test: Ping the configured CRM webhook URL ─────────────────
router.post("/webhook/test", async (req, res) => {
  try {
    const url = req.body?.webhookUrl || crmWebhookForwarder.getWebhookUrl();
    if (!url) return res.status(400).json({ success: false, error: "No webhook URL configured to test" });

    const result = await crmWebhookForwarder.sendEvent("test.ping", {
      message: "Ping from Whatsapp_CRM module",
      timestamp: new Date().toISOString(),
    });
    res.json({ success: result?.success || false, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /session/restart: Clean restart of WhatsApp engine ─────────────────
router.post("/session/restart", async (req, res) => {
  try {
    const session = getSession(req);
    await session.init(false);
    res.json({ success: true, message: "WhatsApp session restart triggered" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /session/logout: Unlink / Log out WhatsApp session ─────────────────
router.post("/session/logout", async (req, res) => {
  try {
    const session = getSession(req);
    const result = await session.logout(true);
    res.json({ success: true, message: "Logged out and session cleared", result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
