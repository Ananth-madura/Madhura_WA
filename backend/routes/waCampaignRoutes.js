const express = require("express");
const router = express.Router();
const db = require("../config/database");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { verifyToken: auth } = require("../middleware/authMiddleware");
const wa = require("../services/whatsappCloudApi");
const { configureForUser, resetToEnvConfig } = require("../services/waConfigHelper");

const mediaDir = path.join(__dirname, "..", "uploads", "wa-media");
fs.mkdirSync(mediaDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, mediaDir),
    filename: (req, file, cb) => cb(null, Date.now() + "_" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — Meta's own cap for images/video
});

// ── List campaigns ────────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT c.*, 
             t.name as template_name, 
             f.name as flow_name, 
             g.name as group_name 
      FROM wa_campaigns c
      LEFT JOIN wa_templates t ON c.template_id = t.id
      LEFT JOIN wa_flows f ON c.flow_id = f.id
      LEFT JOIN wa_contact_groups g ON c.group_id = g.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Test Spintax Variations ──────────────────────────────────────────────────
router.post("/test-spintax", auth, async (req, res) => {
  try {
    const { text, count = 5 } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    const { parseSpintax } = require("../services/waCampaignEngine");
    const samples = [];
    for (let i = 0; i < Math.min(10, Math.max(1, count)); i++) {
      samples.push(parseSpintax(text));
    }
    res.json({ success: true, original: text, samples });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Multi-Tenant Sender Pools ────────────────────────────────────────────────
router.get("/sender-pools", auth, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 1;
    const [pools] = await db.promise().query(
      `SELECT p.*, COUNT(m.id) as total_members,
              SUM(IF(m.is_active = 1, 1, 0)) as active_members,
              SUM(m.sent_today) as total_sent_today
       FROM wa_sender_pools p
       LEFT JOIN wa_sender_pool_members m ON p.id = m.pool_id
       WHERE p.tenant_id = ? OR p.tenant_id IS NULL
       GROUP BY p.id ORDER BY p.id DESC`,
      [tenantId]
    );
    res.json(pools);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sender-pools", auth, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 1;
    const { pool_name, routing_strategy = "round_robin", description = null } = req.body;
    if (!pool_name) return res.status(400).json({ error: "pool_name is required" });

    const [result] = await db.promise().query(
      `INSERT INTO wa_sender_pools (tenant_id, pool_name, routing_strategy, description, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, pool_name, routing_strategy, description, req.user?.id || null]
    );
    const [pool] = await db.promise().query("SELECT * FROM wa_sender_pools WHERE id = ?", [result.insertId]);
    res.status(201).json(pool[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sender-pools/:id", auth, async (req, res) => {
  try {
    const [pool] = await db.promise().query("SELECT * FROM wa_sender_pools WHERE id = ?", [req.params.id]);
    if (!pool.length) return res.status(404).json({ error: "Pool not found" });
    const [members] = await db.promise().query(
      "SELECT * FROM wa_sender_pool_members WHERE pool_id = ? ORDER BY id ASC",
      [req.params.id]
    );
    res.json({ ...pool[0], members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sender-pools/:id/members", auth, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 1;
    const { phone_number, sender_type = "web_session", account_id = null, session_key = null, weight = 1, daily_limit = 1000, hourly_limit = 150 } = req.body;
    if (!phone_number) return res.status(400).json({ error: "phone_number is required" });

    const [result] = await db.promise().query(
      `INSERT INTO wa_sender_pool_members (
        pool_id, tenant_id, account_id, session_key, phone_number, sender_type,
        weight, daily_limit, hourly_limit, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        req.params.id, tenantId, account_id, session_key || String(req.user?.id || 1),
        phone_number.replace(/\D/g, ""), sender_type, parseInt(weight) || 1,
        parseInt(daily_limit) || 1000, parseInt(hourly_limit) || 150
      ]
    );
    res.status(201).json({ success: true, memberId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/sender-pools/:id/members/:memberId", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_sender_pool_members WHERE id = ? AND pool_id = ?", [req.params.memberId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Anti-Ban & Warmup Settings ───────────────────────────────────────────────
router.get("/anti-ban/settings", auth, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 1;
    const userId = req.user?.id || 1;
    const [rows] = await db.promise().query(
      "SELECT * FROM wa_anti_ban_settings WHERE (tenant_id = ? AND user_id = ?) OR id = 1 LIMIT 1",
      [tenantId, userId]
    );
    res.json(rows[0] || {
      warmup_enabled: 1,
      min_delay_sec: 8,
      max_delay_sec: 20,
      pause_every_messages: 30,
      pause_duration_sec: 180,
      daily_limit: 1000,
      hourly_limit: 150,
      spintax_enabled: 1,
      opt_out_auto_detect: 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/anti-ban/settings", auth, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 1;
    const userId = req.user?.id || 1;
    const {
      warmup_enabled = 1, min_delay_sec = 8, max_delay_sec = 20,
      pause_every_messages = 30, pause_duration_sec = 180,
      daily_limit = 1000, hourly_limit = 150, spintax_enabled = 1,
      opt_out_auto_detect = 1, working_hours_enabled = 1,
      start_time = "09:00", end_time = "20:00"
    } = req.body;

    await db.promise().query(
      `INSERT INTO wa_anti_ban_settings (
        tenant_id, user_id, warmup_enabled, min_delay_sec, max_delay_sec,
        pause_every_messages, pause_duration_sec, daily_limit, hourly_limit,
        spintax_enabled, opt_out_auto_detect, working_hours_enabled, start_time, end_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        warmup_enabled = VALUES(warmup_enabled),
        min_delay_sec = VALUES(min_delay_sec),
        max_delay_sec = VALUES(max_delay_sec),
        pause_every_messages = VALUES(pause_every_messages),
        pause_duration_sec = VALUES(pause_duration_sec),
        daily_limit = VALUES(daily_limit),
        hourly_limit = VALUES(hourly_limit),
        spintax_enabled = VALUES(spintax_enabled),
        opt_out_auto_detect = VALUES(opt_out_auto_detect),
        working_hours_enabled = VALUES(working_hours_enabled),
        start_time = VALUES(start_time),
        end_time = VALUES(end_time)`,
      [
        tenantId, userId, warmup_enabled ? 1 : 0, parseInt(min_delay_sec) || 8, parseInt(max_delay_sec) || 20,
        parseInt(pause_every_messages) || 30, parseInt(pause_duration_sec) || 180,
        parseInt(daily_limit) || 1000, parseInt(hourly_limit) || 150,
        spintax_enabled ? 1 : 0, opt_out_auto_detect ? 1 : 0,
        working_hours_enabled ? 1 : 0, start_time, end_time
      ]
    );
    res.json({ success: true, message: "Anti-ban settings saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create campaign ───────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 1;
    const {
      name, description, type, template_id, flow_id, message_text, media_type, media_url, group_id, scheduled_at,
      whatsapp_number, daily_limit, start_time, end_time, timezone, random_delay_min, random_delay_max,
      pause_every, pause_duration_min, pause_duration_max, retry_failed, max_retries, retry_delay_min,
      retry_delay_max, exclude_prev_recipients, duplicate_filter, pool_id, routing_strategy = "round_robin",
      spintax_enabled = 1, warmup_mode = 0
    } = req.body;

    if (!name) return res.status(400).json({ error: "name required" });

    let totalContacts = 0;
    if (group_id) {
      const [rows] = await db.promise().query("SELECT COUNT(*) as count FROM wa_group_contacts WHERE group_id = ?", [group_id]);
      totalContacts = rows[0].count;
    }

    const [result] = await db.promise().query(
      `INSERT INTO wa_campaigns (
        name, description, type, template_id, flow_id, message_text, media_type, media_url, group_id, status,
        scheduled_at, total_contacts, whatsapp_number, daily_limit, start_time, end_time, timezone,
        random_delay_min, random_delay_max, pause_every, pause_duration_min, pause_duration_max,
        retry_failed, max_retries, retry_delay_min, retry_delay_max, exclude_prev_recipients,
        duplicate_filter, pool_id, routing_strategy, spintax_enabled, warmup_mode, tenant_id, created_by, session_key
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, description || null, type || "text", template_id || null, flow_id || null, message_text || null,
        media_type || null, media_url || null, group_id || null,
        scheduled_at ? "scheduled" : "draft", scheduled_at || null, totalContacts,
        whatsapp_number || null, parseInt(daily_limit) || 0,
        start_time || "09:00", end_time || "20:00", timezone || "Asia/Kolkata",
        parseInt(random_delay_min) || 8, parseInt(random_delay_max) || 16,
        parseInt(pause_every) || 30, parseInt(pause_duration_min) || 120, parseInt(pause_duration_max) || 240,
        retry_failed !== false ? 1 : 0, parseInt(max_retries) || 3,
        parseInt(retry_delay_min) || 15, parseInt(retry_delay_max) || 30,
        exclude_prev_recipients ? 1 : 0, duplicate_filter !== false ? 1 : 0,
        pool_id ? parseInt(pool_id) : null, routing_strategy || "round_robin",
        spintax_enabled !== false ? 1 : 0, warmup_mode ? 1 : 0,
        tenantId, req.user?.id || null,
        String(req.user?.id || "1")
      ]
    );
    const [row] = await db.promise().query(`
      SELECT c.*, t.name as template_name, f.name as flow_name, g.name as group_name
      FROM wa_campaigns c
      LEFT JOIN wa_templates t ON c.template_id = t.id
      LEFT JOIN wa_flows f ON c.flow_id = f.id
      LEFT JOIN wa_contact_groups g ON c.group_id = g.id
      WHERE c.id = ?
    `, [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stop every running/paused campaign at once (emergency kill switch) ──────
router.post("/stop-all", auth, async (req, res) => {
  try {
    const [result] = await db.promise().query(
      "UPDATE wa_campaigns SET status='cancelled', completed_at=NOW() WHERE status IN ('running','paused','scheduled')"
    );
    res.json({ success: true, stopped: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get campaign detail ───────────────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT c.*, t.name as template_name, f.name as flow_name, g.name as group_name
      FROM wa_campaigns c
      LEFT JOIN wa_templates t ON c.template_id = t.id
      LEFT JOIN wa_flows f ON c.flow_id = f.id
      LEFT JOIN wa_contact_groups g ON c.group_id = g.id
      WHERE c.id = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Campaign not found" });
    const [messages] = await db.promise().query(
      "SELECT * FROM wa_campaign_messages WHERE campaign_id = ? ORDER BY created_at ASC LIMIT 500",
      [req.params.id]
    );
    res.json({ ...rows[0], messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update campaign ───────────────────────────────────────────────────────────
router.put("/:id", auth, async (req, res) => {
  try {
    const {
      name, description, type, template_id, flow_id, message_text, group_id, scheduled_at, status,
      whatsapp_number, daily_limit, start_time, end_time, timezone, random_delay_min, random_delay_max,
      pause_every, pause_duration_min, pause_duration_max, retry_failed, max_retries, retry_delay_min,
      retry_delay_max, exclude_prev_recipients, duplicate_filter
    } = req.body;

    await db.promise().query(
      `UPDATE wa_campaigns SET
        name=?, description=?, type=?, template_id=?, flow_id=?, message_text=?, group_id=?, scheduled_at=?, status=?,
        whatsapp_number=?, daily_limit=?, start_time=?, end_time=?, timezone=?,
        random_delay_min=?, random_delay_max=?, pause_every=?, pause_duration_min=?, pause_duration_max=?,
        retry_failed=?, max_retries=?, retry_delay_min=?, retry_delay_max=?,
        exclude_prev_recipients=?, duplicate_filter=?, updated_at=NOW()
       WHERE id=?`,
      [
        name, description, type, template_id || null, flow_id || null, message_text, group_id, scheduled_at, status,
        whatsapp_number || null, parseInt(daily_limit) || 0,
        start_time || "09:00", end_time || "21:00", timezone || "Asia/Kolkata",
        parseInt(random_delay_min) || 8, parseInt(random_delay_max) || 15,
        parseInt(pause_every) || 25, parseInt(pause_duration_min) || 120, parseInt(pause_duration_max) || 300,
        retry_failed ? 1 : 0, parseInt(max_retries) || 3,
        parseInt(retry_delay_min) || 15, parseInt(retry_delay_max) || 30,
        exclude_prev_recipients ? 1 : 0, duplicate_filter !== false ? 1 : 0,
        req.params.id
      ]
    );

    if (group_id) {
      const [rows] = await db.promise().query("SELECT COUNT(*) as count FROM wa_group_contacts WHERE group_id = ?", [group_id]);
      await db.promise().query("UPDATE wa_campaigns SET total_contacts = ? WHERE id = ?", [rows[0].count, req.params.id]);
    }

    const [row] = await db.promise().query(`
      SELECT c.*, t.name as template_name, f.name as flow_name, g.name as group_name
      FROM wa_campaigns c
      LEFT JOIN wa_templates t ON c.template_id = t.id
      LEFT JOIN wa_flows f ON c.flow_id = f.id
      LEFT JOIN wa_contact_groups g ON c.group_id = g.id
      WHERE c.id = ?
    `, [req.params.id]);
    res.json(row[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete campaign ───────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_campaigns WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start campaign ────────────────────────────────────────────────────────────
router.post("/:id/start", auth, async (req, res) => {
  try {
    const [campaigns] = await db.promise().query("SELECT * FROM wa_campaigns WHERE id = ?", [req.params.id]);
    if (!campaigns.length) return res.status(404).json({ error: "Campaign not found" });
    const campaign = campaigns[0];

    const userConfigLoaded = await configureForUser(req.user.id);
    // A linked WhatsApp Web session is a perfectly good campaign engine — the
    // engine has always supported it. This gate demanded Meta Cloud API creds
    // and so blocked every Web-session user from launching a campaign at all.
    const webReady = require("../services/whatsappService").get(req.user.id).ready;
    if (!userConfigLoaded && !wa.isConfigured() && !webReady) {
      return res.status(400).json({ error: "WhatsApp not connected. Scan the QR on the WhatsApp Accounts page, or add Cloud API credentials in Settings > WhatsApp Config." });
    }
    if (!userConfigLoaded) resetToEnvConfig();

    // Get contacts from group
    let contacts = [];
    if (campaign.group_id) {
      const [rows] = await db.promise().query("SELECT * FROM wa_group_contacts WHERE group_id = ?", [campaign.group_id]);
      contacts = rows;
    }
    if (!contacts.length) return res.status(400).json({ error: "No contacts in selected group" });

    // Get template details if template campaign
    let templateName = null;
    let templateComponents = [];
    if (campaign.template_id) {
      const [tmpl] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ?", [campaign.template_id]);
      if (tmpl.length) {
        templateName = tmpl[0].name;
        if (tmpl[0].header_type && tmpl[0].header_value) {
          templateComponents.push({ type: "header", parameters: [{ type: "text", text: tmpl[0].header_value }] });
        }
      }
    }

    // Deduplicate phones if duplicate_filter is on
    let seenPhones = new Set();
    let uniqueContacts = contacts;
    if (campaign.duplicate_filter) {
      uniqueContacts = contacts.filter(c => {
        const clean = (c.phone || "").replace(/\D/g, "").slice(-10);
        if (seenPhones.has(clean)) return false;
        seenPhones.add(clean);
        return true;
      });
    }

    // Exclude previous recipients if requested
    let finalContacts = uniqueContacts;
    if (campaign.exclude_prev_recipients) {
      const [prevPhones] = await db.promise().query(
        "SELECT DISTINCT phone FROM wa_campaign_messages WHERE campaign_id != ? AND status IN ('sent','delivered','read')",
        [campaign.id]
      );
      const prevSet = new Set(prevPhones.map(r => r.phone));
      finalContacts = uniqueContacts.filter(c => {
        const phone = (c.country_code || "91") + c.phone.replace(/^0+/, "");
        return !prevSet.has(phone);
      });
    }

    if (!finalContacts.length) {
      return res.status(400).json({ error: "No eligible contacts after applying filters" });
    }

    // Insert queued messages
    const messageList = finalContacts.map(c => {
      const phone = (c.country_code || "91") + c.phone.replace(/^0+/, "");
      return [
        campaign.id, phone, c.name, campaign.message_text, templateName,
        templateComponents.length ? JSON.stringify(templateComponents) : null,
        campaign.media_type || null, campaign.media_url || null, "queued"
      ];
    });

    // Remove existing queued messages for this campaign before re-queuing
    await db.promise().query(
      "DELETE FROM wa_campaign_messages WHERE campaign_id=? AND status='queued'",
      [campaign.id]
    );

    await db.promise().query(
      `INSERT INTO wa_campaign_messages (campaign_id, phone, contact_name, message_text, template_name, template_components, media_type, media_url, status) VALUES ?`,
      [messageList]
    );

    // Update campaign totals. session_key binds the run to the launching user's
    // number — COALESCE keeps a key already chosen at creation time.
    await db.promise().query(
      "UPDATE wa_campaigns SET status='running', started_at=NOW(), total_contacts=?, sent_count=0, failed_count=0, delivered_count=0, read_count=0, session_key=COALESCE(session_key, ?) WHERE id=?",
      [finalContacts.length, String(req.user?.id || ""), campaign.id]
    );

    // Launch the safe campaign engine (non-blocking)
    const { startCampaignEngine } = require("../services/waCampaignEngine");
    startCampaignEngine(campaign.id);

    const [updated] = await db.promise().query("SELECT * FROM wa_campaigns WHERE id = ?", [campaign.id]);
    res.json({ success: true, campaign: updated[0], totalMessages: finalContacts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Pause campaign ────────────────────────────────────────────────────────────
router.post("/:id/pause", auth, async (req, res) => {
  try {
    await db.promise().query("UPDATE wa_campaigns SET status='paused' WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Resume campaign ───────────────────────────────────────────────────────────
router.post("/:id/resume", auth, async (req, res) => {
  try {
    await db.promise().query("UPDATE wa_campaigns SET status='running' WHERE id=?", [req.params.id]);
    const { startCampaignEngine } = require("../services/waCampaignEngine");
    startCampaignEngine(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stop/cancel campaign ──────────────────────────────────────────────────────
router.post("/:id/stop", auth, async (req, res) => {
  try {
    await db.promise().query(
      "UPDATE wa_campaigns SET status='cancelled', completed_at=NOW() WHERE id=?",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mark complete ─────────────────────────────────────────────────────────────
router.post("/:id/complete", auth, async (req, res) => {
  try {
    await db.promise().query(
      "UPDATE wa_campaigns SET status='completed', completed_at=NOW() WHERE id=?",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Retry failed messages in campaign ─────────────────────────────────────────
router.post("/:id/retry-failed", auth, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const [result] = await db.promise().query(
      "UPDATE wa_campaign_messages SET status='queued', attempts=0, error=NULL, next_retry_at=NULL WHERE campaign_id=? AND status='failed'",
      [campaignId]
    );
    if (result.affectedRows > 0) {
      await db.promise().query(
        "UPDATE wa_campaigns SET status='running', completed_at=NULL WHERE id=?",
        [campaignId]
      );
      const { startCampaignEngine } = require("../services/waCampaignEngine");
      startCampaignEngine(campaignId);
    }
    res.json({ success: true, retriedCount: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Clone / Duplicate campaign ────────────────────────────────────────────────
router.post("/:id/clone", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_campaigns WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Campaign not found" });
    const orig = rows[0];

    const [cloneRes] = await db.promise().query(
      `INSERT INTO wa_campaigns (
        name, description, type, template_id, message_text, media_type, media_url, group_id, status,
        total_contacts, daily_limit, start_time, end_time, timezone, random_delay_min, random_delay_max,
        pause_every, pause_duration_min, pause_duration_max, retry_failed, max_retries, retry_delay_min,
        retry_delay_max, exclude_prev_recipients, duplicate_filter, created_by, session_key
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        orig.name + " (Copy)", orig.description, orig.type, orig.template_id, orig.message_text,
        orig.media_type, orig.media_url, orig.group_id, "draft", orig.total_contacts,
        orig.daily_limit, orig.start_time, orig.end_time, orig.timezone, orig.random_delay_min,
        orig.random_delay_max, orig.pause_every, orig.pause_duration_min, orig.pause_duration_max,
        orig.retry_failed, orig.max_retries, orig.retry_delay_min, orig.retry_delay_max,
        orig.exclude_prev_recipients, orig.duplicate_filter, req.user?.id || null, String(req.user?.id || "")
      ]
    );

    res.json({ success: true, cloneId: cloneRes.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get queue table for a campaign ────────────────────────────────────────────
router.get("/:id/queue", auth, async (req, res) => {
  try {
    const status = req.query.status || null;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    let where = "campaign_id=?";
    const params = [req.params.id];
    if (status) { where += " AND status=?"; params.push(status); }

    const [rows] = await db.promise().query(
      `SELECT * FROM wa_campaign_messages WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await db.promise().query(
      `SELECT COUNT(*) as total FROM wa_campaign_messages WHERE ${where}`,
      params
    );
    res.json({ messages: rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Direct/quick broadcast (legacy) ───────────────────────────────────────────
router.post("/create-direct", auth, async (req, res) => {
  try {
    const { name, message_text, contacts, delay_seconds = 10 } = req.body;
    if (!name || !message_text) return res.status(400).json({ error: "name and message_text required" });
    if (!contacts || !Array.isArray(contacts) || !contacts.length) {
      return res.status(400).json({ error: "No contacts provided" });
    }

    const userConfigLoaded = await configureForUser(req.user.id);
    // A linked WhatsApp Web session is a perfectly good campaign engine — the
    // engine has always supported it. This gate demanded Meta Cloud API creds
    // and so blocked every Web-session user from launching a campaign at all.
    const webReady = require("../services/whatsappService").get(req.user.id).ready;
    if (!userConfigLoaded && !wa.isConfigured() && !webReady) {
      return res.status(400).json({ error: "WhatsApp not connected. Scan the QR on the WhatsApp Accounts page, or add Cloud API credentials in Settings > WhatsApp Config." });
    }
    if (!userConfigLoaded) resetToEnvConfig();

    const [grpRes] = await db.promise().query(
      "INSERT INTO wa_contact_groups (name, description, created_by) VALUES (?,?,?)",
      [name + " (Group)", `Direct campaign group for ${contacts.length} contacts`, req.user?.id || null]
    );
    const groupId = grpRes.insertId;

    const values = contacts.map(c => [
      groupId, c.name || null,
      c.phone.replace(/[^0-9]/g, "").slice(-10),
      c.country_code || "91", c.source || null
    ]);
    await db.promise().query(
      "INSERT IGNORE INTO wa_group_contacts (group_id, name, phone, country_code, notes) VALUES ?",
      [values]
    );

    const [campRes] = await db.promise().query(
      `INSERT INTO wa_campaigns (name, description, type, message_text, group_id, status, total_contacts,
        random_delay_min, random_delay_max, retry_failed, duplicate_filter, created_by, session_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, `Bulk direct campaign for ${contacts.length} contacts`, "text", message_text,
        groupId, "running", contacts.length,
        delay_seconds, delay_seconds + 3, 1, 1, req.user?.id || null, String(req.user?.id || "")]
    );
    const campaignId = campRes.insertId;

    const [groupContacts] = await db.promise().query("SELECT * FROM wa_group_contacts WHERE group_id=?", [groupId]);
    const messageList = groupContacts.map(c => [
      campaignId, (c.country_code || "91") + c.phone.replace(/^0+/, ""),
      c.name, message_text, null, null, "queued"
    ]);

    await db.promise().query(
      "INSERT INTO wa_campaign_messages (campaign_id, phone, contact_name, message_text, template_name, template_components, status) VALUES ?",
      [messageList]
    );

    await db.promise().query("UPDATE wa_campaigns SET started_at=NOW() WHERE id=?", [campaignId]);

    const { startCampaignEngine } = require("../services/waCampaignEngine");
    startCampaignEngine(campaignId);

    res.status(201).json({ success: true, campaignId, totalContacts: contacts.length, delaySeconds: delay_seconds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Upload campaign media (image/video/audio/document/excel/pdf) ───────────────
router.post("/upload-media", auth, upload.single("file"), async (req, res) => {
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

// ── Wizard broadcast: contacts + message (text/template/media) + optional location ─
router.post("/create-wizard", auth, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 1;
    const {
      name,
      contacts,
      message = {},
      location = null,
      delay_min = 35,
      delay_max = 55,
      pause_every = 25,
      pause_duration_min = 180,
      daily_limit = 800,
      start_time = "09:00",
      end_time = "20:00",
      pool_id = null,
      routing_strategy = "round_robin",
      spintax_enabled = 1,
      warmup_mode = 0,
    } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    if (!contacts || !Array.isArray(contacts) || !contacts.length) {
      return res.status(400).json({ error: "No contacts provided" });
    }
    const { text: message_text, template_id, media_type, media_url } = message;
    if (!message_text && !template_id && !media_url && !location) {
      return res.status(400).json({ error: "Provide a message text, template, media, or location" });
    }

    const userConfigLoaded = await configureForUser(req.user.id);
    const webReady = require("../services/whatsappService").get(req.user.id).ready;
    if (!userConfigLoaded && !wa.isConfigured() && !webReady && !pool_id) {
      return res.status(400).json({ error: "WhatsApp not connected. Scan the QR on the WhatsApp Accounts page, select a sender pool, or add Cloud API credentials." });
    }
    if (!userConfigLoaded) resetToEnvConfig();

    let templateName = null;
    let templateComponents = [];
    if (template_id) {
      const [tmpl] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ?", [template_id]);
      if (tmpl.length) {
        templateName = tmpl[0].name;
        if (tmpl[0].header_type && tmpl[0].header_value) {
          templateComponents.push({ type: "header", parameters: [{ type: "text", text: tmpl[0].header_value }] });
        }
      }
    }

    const [grpRes] = await db.promise().query(
      "INSERT INTO wa_contact_groups (name, description, tenant_id, created_by) VALUES (?,?,?,?)",
      [name + " (Group)", `Wizard campaign group for ${contacts.length} contacts`, tenantId, req.user?.id || null]
    );
    const groupId = grpRes.insertId;

    const groupValues = contacts.map(c => [
      groupId, c.name || null,
      String(c.phone).replace(/[^0-9]/g, "").slice(-10),
      c.country_code || "91", c.source || null, tenantId
    ]);
    await db.promise().query(
      "INSERT IGNORE INTO wa_group_contacts (group_id, name, phone, country_code, notes, tenant_id) VALUES ?",
      [groupValues]
    ).catch(async () => {
      // Fallback if tenant_id column doesn't exist on wa_group_contacts
      const legacyGroupValues = contacts.map(c => [
        groupId, c.name || null,
        String(c.phone).replace(/[^0-9]/g, "").slice(-10),
        c.country_code || "91", c.source || null
      ]);
      await db.promise().query(
        "INSERT IGNORE INTO wa_group_contacts (group_id, name, phone, country_code, notes) VALUES ?",
        [legacyGroupValues]
      );
    });

    const campaignType = templateName ? "template" : (media_url ? "media" : "text");
    const [campRes] = await db.promise().query(
      `INSERT INTO wa_campaigns (
        name, description, type, message_text, media_type, media_url, group_id, status, total_contacts,
        random_delay_min, random_delay_max, pause_every, pause_duration_min, daily_limit, start_time, end_time,
        retry_failed, duplicate_filter, pool_id, routing_strategy, spintax_enabled, warmup_mode, tenant_id, created_by, session_key
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, `Wizard campaign for ${contacts.length} contacts`, campaignType, message_text || null,
        media_type || null, media_url || null, groupId, "running", contacts.length,
        parseInt(delay_min) || 35, parseInt(delay_max) || 55, parseInt(pause_every) || 25, parseInt(pause_duration_min) || 180,
        parseInt(daily_limit) || 800, start_time || "09:00", end_time || "20:00", 1, 1,
        pool_id ? parseInt(pool_id) : null, routing_strategy || "round_robin",
        spintax_enabled !== false ? 1 : 0, warmup_mode ? 1 : 0,
        tenantId, req.user?.id || null, String(req.user?.id || "1")
      ]
    );
    const campaignId = campRes.insertId;

    const [groupContacts] = await db.promise().query("SELECT * FROM wa_group_contacts WHERE group_id=?", [groupId]);
    const messageList = groupContacts.map(c => [
      campaignId, (c.country_code || "91") + c.phone.replace(/^0+/, ""),
      c.name, message_text || null, templateName, templateComponents.length ? JSON.stringify(templateComponents) : null,
      media_type || null, media_url || null,
      location?.lat ?? null, location?.lng ?? null, location?.name || null, location?.address || null,
      "queued", pool_id ? parseInt(pool_id) : null, tenantId
    ]);

    await db.promise().query(
      `INSERT INTO wa_campaign_messages
        (campaign_id, phone, contact_name, message_text, template_name, template_components, media_type, media_url,
         location_lat, location_lng, location_name, location_address, status, pool_id, tenant_id)
       VALUES ?`,
      [messageList]
    ).catch(async () => {
      // Fallback without pool_id & tenant_id columns
      const legacyMessageList = groupContacts.map(c => [
        campaignId, (c.country_code || "91") + c.phone.replace(/^0+/, ""),
        c.name, message_text || null, templateName, templateComponents.length ? JSON.stringify(templateComponents) : null,
        media_type || null, media_url || null,
        location?.lat ?? null, location?.lng ?? null, location?.name || null, location?.address || null,
        "queued"
      ]);
      await db.promise().query(
        `INSERT INTO wa_campaign_messages
          (campaign_id, phone, contact_name, message_text, template_name, template_components, media_type, media_url,
           location_lat, location_lng, location_name, location_address, status)
         VALUES ?`,
        [legacyMessageList]
      );
    });

    await db.promise().query("UPDATE wa_campaigns SET started_at=NOW() WHERE id=?", [campaignId]);

    const { startCampaignEngine } = require("../services/waCampaignEngine");
    startCampaignEngine(campaignId);

    res.status(201).json({ success: true, campaignId, totalContacts: contacts.length, delayMin: delay_min, delayMax: delay_max, poolId: pool_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;