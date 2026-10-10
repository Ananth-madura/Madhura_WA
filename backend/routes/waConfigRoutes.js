const express = require("express");
const router = express.Router();
const db = require("../config/database");

const { getQueueStats } = require("../services/waCampaignEngine");
const { cloudClientForUser } = require("../services/waConfigHelper");
const { verifyToken } = require("../middleware/authMiddleware");
const { encrypt, decrypt } = require("../backendutil/cryptoHelper");

router.use(verifyToken, async (req, res, next) => {
  try { req.waCloud = await cloudClientForUser(req.user.id); next(); }
  catch (error) {
    // An operator must still be able to replace credentials encrypted with an old key.
    if (["/save-config", "/test-connection", "/test-template", "/user-config"].includes(req.path)) {
      req.waCloud = require("../services/whatsappCloudApi").withAccount({});
      return next();
    }
    res.status(503).json({ message: error.message });
  }
});

router.get("/status", async (req, res) => {
  let wa = req.waCloud;
  if (req.user?.id) {
    wa = await cloudClientForUser(req.user.id);
  }
  res.json(wa.getConfig());
});

router.get("/user-config", verifyToken, async (req, res) => {
  let wa = req.waCloud;
  const userId = req.user.id;
  try {
    const [rows] = await db.promise().query(
      "SELECT id, phone_number_id, waba_id, verify_token, business_account_id, is_enabled, app_secret, access_token FROM user_wa_configs WHERE user_id = ?",
      [userId]
    );
    if (!rows.length) return res.json({ hasConfig: false });
    const row = rows[0];
    res.json({
      hasConfig: true,
      config: {
        id: row.id,
        phone_number_id: row.phone_number_id,
        waba_id: row.waba_id,
        verify_token: row.verify_token,
        business_account_id: row.business_account_id,
        is_enabled: row.is_enabled,
        has_app_secret: Boolean(row.app_secret),
        has_access_token: Boolean(row.access_token),
        display_phone_number: wa.displayPhoneNumber || null,
        verified_name: wa.verifiedName || null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to check WA config: " + err.message });
  }
});

router.post("/save-config", verifyToken, async (req, res) => {
  let wa = req.waCloud;
  const userId = req.user.id;
  const { phone_number_id, access_token, waba_id, app_secret, verify_token, business_account_id, is_enabled } = req.body;

  if (!phone_number_id) {
    return res.status(400).json({ message: "Phone Number ID is required" });
  }

  try {
    const [owners] = await db.promise().query("SELECT created_by FROM wa_accounts WHERE phone_number_id = ? AND created_by IS NOT NULL AND created_by <> ? LIMIT 1", [phone_number_id.trim(), userId]);
    if (owners.length) return res.status(409).json({ message: "This sender is already assigned to another account" });
    const [existing] = await db.promise().query(
      "SELECT id, access_token, app_secret FROM user_wa_configs WHERE user_id = ?",
      [userId]
    );

    let encrypted_token;
    if (access_token && access_token !== "••••••••••••••••") {
      encrypted_token = encrypt(access_token.trim());
    } else if (existing.length && existing[0].access_token) {
      encrypted_token = existing[0].access_token;
    } else {
      return res.status(400).json({ message: "Access Token is required" });
    }

    let encrypted_secret = null;
    if (app_secret && app_secret !== "••••••••••••••••") {
      encrypted_secret = encrypt(app_secret.trim());
    } else if (existing.length && existing[0].app_secret) {
      encrypted_secret = existing[0].app_secret;
    }

    if (existing.length) {
      await db.promise().query(
        `UPDATE user_wa_configs SET phone_number_id=?, access_token=?, waba_id=?, app_secret=?, verify_token=?, business_account_id=?, is_enabled=? WHERE user_id=?`,
        [phone_number_id.trim(), encrypted_token, waba_id?.trim() || null, encrypted_secret, verify_token?.trim() || "crm_verify_123", business_account_id?.trim() || null, is_enabled !== false, userId]
      );
    } else {
      await db.promise().query(
        `INSERT INTO user_wa_configs (user_id, phone_number_id, access_token, waba_id, app_secret, verify_token, business_account_id, is_enabled) VALUES (?,?,?,?,?,?,?,?)`,
        [userId, phone_number_id.trim(), encrypted_token, waba_id?.trim() || null, encrypted_secret, verify_token?.trim() || "crm_verify_123", business_account_id?.trim() || null, is_enabled !== false]
      );
    }

    wa = await cloudClientForUser(req.user.id);

    // Fetch and save phone details into wa_accounts for Multi-Account manager
    try {
      const phoneInfo = await wa.getPhoneNumberInfo();
      if (phoneInfo) {
        wa.displayPhoneNumber = phoneInfo.display_phone_number || wa.displayPhoneNumber;
        wa.verifiedName = phoneInfo.verified_name || wa.verifiedName;
        await db.promise().query(
          `INSERT INTO wa_accounts (account_name, phone_number, phone_number_id, access_token, waba_id, connection_type, is_active, is_default, created_by)
           VALUES (?, ?, ?, ?, ?, 'cloud_api', 1, 1, ?)
           ON DUPLICATE KEY UPDATE
             account_name = VALUES(account_name),
             phone_number = VALUES(phone_number),
             access_token = VALUES(access_token),
             waba_id = VALUES(waba_id),
             is_active = 1,
             updated_at = NOW()`,
          [
            phoneInfo.verified_name || `Meta Cloud (${phoneInfo.display_phone_number || phone_number_id})`,
            phoneInfo.display_phone_number?.replace(/\D/g, "") || phone_number_id,
            phone_number_id.trim(),
            encrypted_token,
            waba_id?.trim() || null,
            userId,
          ]
        );
      }
    } catch (_) {}

    res.json({
      success: true,
      message: "WhatsApp configuration saved successfully!",
      phoneInfo: {
        display_phone_number: wa.displayPhoneNumber,
        verified_name: wa.verifiedName,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to save config: " + err.message });
  }
});

router.post("/test-connection", verifyToken, async (req, res) => {
  let wa = req.waCloud;
  const userId = req.user.id;
  let { phone_number_id, access_token, waba_id } = req.body;

  if (!phone_number_id) {
    return res.status(400).json({ success: false, message: "Phone Number ID is required" });
  }

  if (!access_token || access_token === "••••••••••••••••") {
    const [existing] = await db.promise().query(
      "SELECT access_token FROM user_wa_configs WHERE user_id = ?",
      [userId]
    );
    if (existing.length && existing[0].access_token) {
      access_token = decrypt(existing[0].access_token);
    } else {
      return res.status(400).json({ success: false, message: "Access Token is required" });
    }
  }

  try {
    const result = await wa.testCredentials(phone_number_id, access_token, waba_id);
    wa.phoneNumberId = phone_number_id.trim();
    wa.accessToken = access_token.trim();
    wa.wabaId = waba_id?.trim() || "";
    if (result.phoneInfo?.display_phone_number) wa.displayPhoneNumber = result.phoneInfo.display_phone_number;
    if (result.phoneInfo?.verified_name) wa.verifiedName = result.phoneInfo.verified_name;

    res.json({
      success: true,
      message: "Meta Cloud API connection verified successfully!",
      phoneInfo: result.phoneInfo,
      businessProfile: result.businessProfile,
      wabaInfo: result.wabaInfo,
      templateCount: result.templateCount,
    });
  } catch (err) {
    wa = await cloudClientForUser(req.user.id);
    const errMsg = err.message || "Meta API connection failed";
    res.status(400).json({ success: false, message: `Connection failed: ${errMsg}` });
  }
});

router.post("/subscribe-webhook", verifyToken, async (req, res) => {
  let wa = req.waCloud;
  const userId = req.user.id;
  let { waba_id } = req.body;
  try {
    wa = await cloudClientForUser(req.user.id);
    const targetWabaId = waba_id || wa.wabaId;
    if (!targetWabaId) {
      return res.status(400).json({ success: false, message: "WABA ID is required to auto-subscribe webhooks" });
    }
    const result = await wa.subscribeWabaApp(targetWabaId);
    res.json({
      success: true,
      message: "Successfully subscribed Meta WABA app to Webhooks!",
      result,
    });
  } catch (err) {
    const errMsg = err.message || "Failed to subscribe webhook";
    res.status(400).json({ success: false, message: `Webhook subscription failed: ${errMsg}` });
  }
});

router.post("/send-meta-test", verifyToken, async (req, res) => {
  let wa = req.waCloud;
  const userId = req.user.id;
  const { phone, message } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: "Recipient phone number is required" });
  }

  try {
    wa = await cloudClientForUser(req.user.id);
    if (!wa.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: "Meta WhatsApp Cloud API is not configured. Please save credentials first.",
      });
    }

    const testMsg = message || `Hello! 🚀 This is a live test message from Madhura CRM via Meta WhatsApp Cloud API. Sent at ${new Date().toLocaleTimeString()}.`;
    const sendRes = await wa.testSend(phone, testMsg);
    const metaMessageId = sendRes?.messages?.[0]?.id || "sent";

    // Log outbound message in database
    const cleanPhone = String(phone).replace(/\D/g, "");
    await db.promise().query(
      `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, wa_message_id, status, created_at)
       VALUES (?, 'outbound', 'text', ?, ?, 'sent', NOW())`,
      [cleanPhone, testMsg, metaMessageId]
    ).catch(() => {});

    res.json({
      success: true,
      message: "Test message sent successfully via Meta Cloud API!",
      metaMessageId,
      recipient: cleanPhone,
    });
  } catch (err) {
    const errMsg = err.message || "Failed to send test message";
    res.status(400).json({ success: false, message: `Send test failed: ${errMsg}` });
  }
});

router.post("/test-template", verifyToken, async (req, res) => {
  let wa = req.waCloud;
  const userId = req.user.id;
  const { phone_number_id, access_token, waba_id } = req.body;

  if (!waba_id) return res.status(400).json({ message: "WABA ID required for template fetch" });

  try {
    wa.phoneNumberId = phone_number_id;
    wa.accessToken = access_token;
    wa.wabaId = waba_id;

    const templates = await wa.getTemplates();
    wa = await cloudClientForUser(req.user.id);
    res.json({ success: true, templateCount: templates.data?.length || 0 });
  } catch (err) {
    wa = await cloudClientForUser(req.user.id);
    const errMsg = err.message || "Template fetch failed";
    res.status(400).json({ success: false, message: `Template fetch failed: ${errMsg}` });
  }
});

/**
 * Send one test interactive message so an operator can verify native UI
 * renders on a real handset before wiring it into a flow.
 *
 *   POST /api/wa/config/test-interactive
 *   { phone, kind: "buttons" | "list" | "cta", ...kind-specific fields }
 *
 * Goes through waLoadBalancer like production, so the response's `native` flag
 * tells you whether it was a real button or the text fallback.
 */
router.post("/test-interactive", verifyToken, async (req, res) => {
  let wa = req.waCloud;
  const { phone, kind = "buttons" } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: "phone is required" });

  try {
    wa = await cloudClientForUser(req.user.id);
    const waLoadBalancer = require("../services/waLoadBalancer");
    const body = req.body.body || "This is a test interactive message from your CRM.";
    let result;

    if (kind === "cta") {
      const { url, button_text } = req.body;
      if (!url) return res.status(400).json({ success: false, message: "url is required for kind 'cta'" });
      result = await waLoadBalancer.sendCTAButtonMessage({
        sessionKey: String(req.user.id),
        requireNative: req.body.allowTextFallback !== true,
        phone,
        body,
        displayText: button_text || "Open Link",
        url,
        footer: req.body.footer || null,
        header: req.body.header || null,
      });
    } else if (kind === "list") {
      result = await waLoadBalancer.sendInteractiveList({
        sessionKey: String(req.user.id),
        requireNative: req.body.allowTextFallback !== true,
        phone,
        body,
        header: req.body.header || null,
        footer: req.body.footer || null,
        buttonText: req.body.button_text || "View Options",
        sections: req.body.sections ||
          req.body.rows || [
            { id: "test_row_1", title: "First option", description: "Tap to reply test_row_1" },
            { id: "test_row_2", title: "Second option", description: "Tap to reply test_row_2" },
          ],
      });
    } else if (kind === "buttons") {
      result = await waLoadBalancer.sendInteractiveButtons({
        sessionKey: String(req.user.id),
        requireNative: req.body.allowTextFallback !== true,
        phone,
        body,
        header: req.body.header || null,
        footer: req.body.footer || null,
        buttons: req.body.buttons || [
          { id: "test_yes", title: "Yes" },
          { id: "test_no", title: "No" },
        ],
      });
    } else {
      return res.status(400).json({ success: false, message: `Unknown kind "${kind}" — use buttons, list or cta` });
    }

    res.json({
      success: true,
      kind: result.kind,
      // false => no Cloud API sender could deliver, so this went out as text
      native: result.native,
      engineUsed: result.engineUsed,
      senderPhone: result.senderPhone,
      failover: Boolean(result.failover),
    });
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    res.status(400).json({ success: false, message: errMsg });
  } finally {
    wa = await cloudClientForUser(req.user.id);
  }
});

router.get("/phone-info", async (req, res) => {
  let wa = req.waCloud;
  try {
    const info = await wa.getPhoneNumberInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/business-profile", async (req, res) => {
  let wa = req.waCloud;
  try {
    const profile = await wa.getBusinessProfile();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/queue-stats", async (req, res) => {
  let wa = req.waCloud;
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (err) {
    res.json({ error: "Queue not available", detail: err.message });
  }
});

router.get("/meta-templates", async (req, res) => {
  let wa = req.waCloud;
  try {
    const templates = await wa.getTemplates();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
