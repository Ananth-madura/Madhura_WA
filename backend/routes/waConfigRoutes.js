const express = require("express");
const router = express.Router();
const db = require("../config/database");
const wa = require("../services/whatsappCloudApi");
const { getQueueStats } = require("../services/waCampaignEngine");
const { configureForUser, resetToEnvConfig } = require("../services/waConfigHelper");
const { verifyToken } = require("../middleware/authMiddleware");
const { encrypt, decrypt } = require("../backendutil/cryptoHelper");

router.get("/status", async (req, res) => {
  if (req.user?.id) {
    await configureForUser(req.user.id);
  }
  res.json(wa.getConfig());
});

router.get("/user-config", verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await db.promise().query(
      "SELECT id, phone_number_id, waba_id, verify_token, business_account_id, is_enabled FROM user_wa_configs WHERE user_id = ?",
      [userId]
    );
    if (!rows.length) return res.json({ hasConfig: false });
    res.json({
      hasConfig: true,
      config: {
        ...rows[0],
        display_phone_number: wa.displayPhoneNumber || null,
        verified_name: wa.verifiedName || null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to check WA config: " + err.message });
  }
});

router.post("/save-config", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { phone_number_id, access_token, waba_id, app_secret, verify_token, business_account_id, is_enabled } = req.body;

  if (!phone_number_id) {
    return res.status(400).json({ message: "Phone Number ID is required" });
  }

  try {
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

    await configureForUser(userId);

    // Fetch and save phone details into wa_accounts for Multi-Account manager
    try {
      const phoneInfo = await wa.getPhoneNumberInfo();
      if (phoneInfo) {
        wa.displayPhoneNumber = phoneInfo.display_phone_number || wa.displayPhoneNumber;
        wa.verifiedName = phoneInfo.verified_name || wa.verifiedName;
        await db.promise().query(
          `INSERT INTO wa_accounts (account_name, phone_number, phone_number_id, access_token, waba_id, connection_type, is_active, is_default)
           VALUES (?, ?, ?, ?, ?, 'cloud_api', 1, 1)
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
  const userId = req.user.id;
  let { phone_number_id, access_token, waba_id } = req.body;

  if (!phone_number_id) {
    return res.status(400).json({ message: "Phone Number ID is required" });
  }

  if (!access_token || access_token === "••••••••••••••••") {
    const [existing] = await db.promise().query(
      "SELECT access_token FROM user_wa_configs WHERE user_id = ?",
      [userId]
    );
    if (existing.length && existing[0].access_token) {
      access_token = decrypt(existing[0].access_token);
    } else {
      return res.status(400).json({ message: "Access Token is required" });
    }
  }

  try {
    wa.phoneNumberId = phone_number_id.trim();
    wa.accessToken = access_token.trim();
    wa.wabaId = waba_id?.trim() || "";

    const phoneInfo = await wa.getPhoneNumberInfo();
    wa.displayPhoneNumber = phoneInfo?.display_phone_number || "";
    wa.verifiedName = phoneInfo?.verified_name || "";
    res.json({ success: true, message: "Connection verified!", phoneInfo });
  } catch (err) {
    await configureForUser(userId).catch(() => resetToEnvConfig());
    const errMsg = err.response?.data?.error?.message || err.message;
    res.status(400).json({ success: false, message: `Connection failed: ${errMsg}` });
  }
});

router.post("/test-template", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { phone_number_id, access_token, waba_id } = req.body;

  if (!waba_id) return res.status(400).json({ message: "WABA ID required for template fetch" });

  try {
    wa.phoneNumberId = phone_number_id;
    wa.accessToken = access_token;
    wa.wabaId = waba_id;

    const templates = await wa.getTemplates();
    resetToEnvConfig();
    res.json({ success: true, templateCount: templates.data?.length || 0 });
  } catch (err) {
    resetToEnvConfig();
    const errMsg = err.response?.data?.error?.message || err.message;
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
  const { phone, kind = "buttons" } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: "phone is required" });

  try {
    await configureForUser(req.user.id);
    const waLoadBalancer = require("../services/waLoadBalancer");
    const body = req.body.body || "This is a test interactive message from your CRM.";
    let result;

    if (kind === "cta") {
      const { url, button_text } = req.body;
      if (!url) return res.status(400).json({ success: false, message: "url is required for kind 'cta'" });
      result = await waLoadBalancer.sendCTAButtonMessage({
        phone,
        body,
        displayText: button_text || "Open Link",
        url,
        footer: req.body.footer || null,
        header: req.body.header || null,
      });
    } else if (kind === "list") {
      result = await waLoadBalancer.sendInteractiveList({
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
    resetToEnvConfig();
  }
});

router.get("/phone-info", async (req, res) => {
  try {
    const info = await wa.getPhoneNumberInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/business-profile", async (req, res) => {
  try {
    const profile = await wa.getBusinessProfile();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/queue-stats", async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (err) {
    res.json({ error: "Queue not available", detail: err.message });
  }
});

router.get("/meta-templates", async (req, res) => {
  try {
    const templates = await wa.getTemplates();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;