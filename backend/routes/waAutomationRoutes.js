const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

const TRIGGER_LABELS = {
  welcome_message: "👋 First Inbound → Welcome Auto-Reply",
  new_lead: "🎯 New Lead Added → Instant Welcome & Brochure",
  invoice_created: "🧾 Invoice Created → Send Invoice PDF & Notice",
  quotation_created: "💼 Quotation Created → Send Proposal & Quote Details",
  amc_created: "🛡️ AMC Contract Created → Service Agreement Notice",
  payment_received: "✅ Payment Received → Instant Receipt Acknowledgement",
  payment_due: "💰 Payment Due → Automated Reminder Notice",
  service_visit_scheduled: "📅 Service Visit Scheduled → Technician Alert",
  walkin_created: "🚶 Walkin Lead Added → Shop Visit Thank You",
  ticket_closed: "🎫 Service Completed / Ticket Closed → Feedback Request",
  birthday: "🎂 Customer Birthday → Greeting & Special Discount",
  appointment_reminder: "🔔 Appointment Scheduled → Visit Reminder",
  lead_followup: "⏳ Lead Inactivity (7 Days) → Follow-Up Check-in",
  abandoned_cart: "🛒 Pending Quotation → Special Offer Recovery",
  custom: "⚡ Custom Background Trigger Rule",
};

// ── List automations ──────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT a.*, 
        t.name as template_name, t.body as template_body,
        ft.name as followup_template_name, ft.body as followup_template_body,
        f.name as flow_name,
        g.name as group_name,
        (SELECT COUNT(*) FROM wa_automation_options o WHERE o.automation_id = a.id) as option_count
      FROM wa_automations a
      LEFT JOIN wa_templates t ON a.template_id = t.id
      LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
      LEFT JOIN wa_flows f ON a.flow_id = f.id
      LEFT JOIN wa_contact_groups g ON a.group_id = g.id
      ORDER BY a.created_at DESC
    `);
    res.json(rows.map(r => ({ ...r, trigger_label: TRIGGER_LABELS[r.trigger_type] || r.trigger_type })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Automations Stats Summary ─────────────────────────────────────────────────
router.get("/stats", auth, async (req, res) => {
  try {
    const [[stats]] = await db.promise().query(`
      SELECT 
        COUNT(*) as total_rules,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_rules,
        SUM(run_count) as total_runs
      FROM wa_automations
    `);

    const [[logStats]] = await db.promise().query(`
      SELECT 
        COUNT(*) as total_logs,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM wa_automation_logs
    `);

    res.json({
      totalRules: stats?.total_rules || 0,
      activeRules: stats?.active_rules || 0,
      totalRuns: stats?.total_runs || 0,
      sentCount: logStats?.sent_count || 0,
      failedCount: logStats?.failed_count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stop / resume every automation at once (emergency kill switch) ──────────
router.post("/stop-all", auth, async (req, res) => {
  try {
    const [result] = await db.promise().query("UPDATE wa_automations SET is_active=0, updated_at=NOW() WHERE is_active=1");
    res.json({ success: true, stopped: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/resume-all", auth, async (req, res) => {
  try {
    const [result] = await db.promise().query("UPDATE wa_automations SET is_active=1, updated_at=NOW() WHERE is_active=0");
    res.json({ success: true, resumed: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Seed 10 Prebuilt Production CRM Automation Rules ─────────────────────────
router.post("/seed", auth, async (req, res) => {
  try {
    // Ensure all automation columns exist in the database
    await require("../services/waDatabase").ensureWATables();

    const seedAutomations = [
      {
        name: "Instant Welcome Notice for New Leads",
        trigger_type: "new_lead",
        message_text: "Hi {name}! 👋 Thank you for your interest in {service} with {company}. Our engineering specialist will connect with you shortly. Feel free to reply anytime!",
        delay_minutes: 0,
        is_active: 0,
        sequence_delay_seconds: 7,
        followup_message_text: "📄 In the meantime, here is our complete Service & AMC catalog: https://madhuratech.com/catalog.pdf",
      },
      {
        name: "Instant Invoice PDF Notice & Payment Link",
        trigger_type: "invoice_created",
        message_text: "Hello {name}, your invoice *{invoice_no}* for amount *{amount}* has been generated. Due Date: {due_date}. Thank you for choosing {company}!",
        delay_minutes: 0,
        is_active: 0,
        sequence_delay_seconds: 7,
        followup_message_text: "💳 You can securely view and pay your invoice online here:\nhttps://pay.madhuratech.in/{invoice_no}",
      },
      {
        name: "Quotation & Proposal Delivery Alert",
        trigger_type: "quotation_created",
        message_text: "Hello {name}, your quotation *{quotation_no}* for *{service}* (Total: {amount}) has been generated. Let us know if you would like to proceed or schedule a technical call!",
        delay_minutes: 0,
        is_active: 0,
      },
      {
        name: "AMC Maintenance Contract Confirmation",
        trigger_type: "amc_created",
        message_text: "🛡️ *AMC Contract Active:* Dear {name}, your maintenance contract *{amc_contract_no}* for {service} is active until {due_date}. Our team will manage your regular inspections!",
        delay_minutes: 0,
        is_active: 0,
      },
      {
        name: "Payment Receipt Acknowledgement",
        trigger_type: "payment_received",
        message_text: "Dear {name}, thank you! We have received your payment of *{amount}* for invoice *{invoice_no}* on {date}. Your official receipt has been recorded.",
        delay_minutes: 0,
        is_active: 0,
      },
      {
        name: "Payment Due 1-Day Automated Reminder",
        trigger_type: "payment_due",
        message_text: "Hi {name}, gentle reminder that payment for invoice *{invoice_no}* ({amount}) is due on *{due_date}*. Please reply if you need invoice copy or payment link.",
        delay_minutes: 0,
        is_active: 0,
      },
      {
        name: "Service Visit Scheduled Technician Alert",
        trigger_type: "service_visit_scheduled",
        message_text: "📅 *Service Visit Confirmed:* Hi {name}, our technician has been scheduled for your *{service}* on *{service_date}*. Thank you for choosing {company}!",
        delay_minutes: 0,
        is_active: 0,
      },
      {
        name: "Walkin Client Thank You & Welcome",
        trigger_type: "walkin_created",
        message_text: "Hi {name}! Thank you for visiting {company} today regarding {service}. It was a pleasure meeting you. Feel free to message us here anytime!",
        delay_minutes: 0,
        is_active: 0,
      },
      {
        name: "Lead Inactivity 7-Day Follow-Up Nudge",
        trigger_type: "lead_followup",
        message_text: "Hi {name}, following up on your inquiry for *{service}*. Let us know if you have any questions or would like a quick 5-minute demo/call!",
        delay_minutes: 0,
        is_active: 0,
      },
      {
        name: "Customer Birthday Greeting & 15% Gift",
        trigger_type: "birthday",
        message_text: "🎉 Happy Birthday {name}! 🎂 Team {company} wishes you a fantastic year ahead. As a special gift, enjoy *15% OFF* on your next service request!",
        delay_minutes: 0,
        is_active: 0,
      },
      {
        name: "Service Resolution & Feedback Request",
        trigger_type: "ticket_closed",
        message_text: "Hello {name}, your service request for *{service}* has been resolved. We would love to hear your feedback on your experience with {company}!",
        delay_minutes: 0,
        is_active: 0,
        sequence_delay_seconds: 7,
        followup_message_text: "⭐ If you loved our service, please take 30 seconds to rate us: https://g.page/r/madhuratech/review",
      },
      {
        name: "First Inbound Welcome & Onboarding Guide",
        trigger_type: "welcome_message",
        message_text: "Hello {name}! 👋 Welcome to {company}. Thank you for connecting with us on WhatsApp. How can we help you today?",
        delay_minutes: 0,
        is_active: 0,
        sequence_delay_seconds: 7,
        followup_message_text: "🛠️ Reply *MENU* anytime to view our services, book an appointment, or speak with an agent.",
      },
    ];

    for (const rule of seedAutomations) {
      const [existing] = await db.promise().query("SELECT id FROM wa_automations WHERE name = ?", [rule.name]);
      if (existing.length > 0) {
        await db.promise().query(
          `UPDATE wa_automations 
           SET trigger_type=?, message_text=?, delay_minutes=?, is_active=?, sequence_delay_seconds=?, followup_message_text=?, updated_at=NOW()
           WHERE id=?`,
          [
            rule.trigger_type, rule.message_text, rule.delay_minutes, rule.is_active,
            rule.sequence_delay_seconds || 7, rule.followup_message_text || null, existing[0].id
          ]
        );
      } else {
        await db.promise().query(
          `INSERT INTO wa_automations (name, trigger_type, message_text, delay_minutes, is_active, sequence_delay_seconds, followup_message_text, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rule.name, rule.trigger_type, rule.message_text, rule.delay_minutes, rule.is_active,
            rule.sequence_delay_seconds || 7, rule.followup_message_text || null, req.user?.id || null
          ]
        );
      }
    }

    const [all] = await db.promise().query("SELECT * FROM wa_automations ORDER BY created_at DESC");
    res.json({ success: true, count: all.length, automations: all });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Simulate / Test ANY CRM Trigger Event ─────────────────────────────────────
router.post("/simulate-trigger", auth, async (req, res) => {
  try {
    const { trigger_type, phone, contact_name, custom_data = {}, send_real_message = false } = req.body;
    if (!trigger_type) return res.status(400).json({ error: "trigger_type required" });

    const [rules] = await db.promise().query(
      `SELECT a.*, t.name as template_name, t.body as template_body,
              ft.name as followup_template_name, ft.body as followup_template_body
       FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
       WHERE a.is_active = 1 AND a.trigger_type = ?`,
      [trigger_type]
    );

    const { formatMessagePlaceholders, lookupCrmDataByPhone, executeAutomationSend } = require("../services/waAutomationService");
    const cleanPhone = phone ? phone.replace(/\D/g, "") : "919876543210";
    const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));

    const sampleDefaults = {
      name: contact_name || "Rahul Sharma",
      customer_name: contact_name || "Rahul Sharma",
      company: "Madhura Commercial Facilities",
      company_name: "Madhura Commercial Facilities",
      service: "Commercial HVAC Maintenance & AMC",
      invoice_no: "INV-2026-108",
      quotation_no: "QT-2026-554",
      amc_contract_no: "AMC-2026-904",
      amount: "18,500",
      due_date: "25 Aug 2026",
      date: new Date().toLocaleDateString("en-IN"),
      city: "Bangalore",
      location_city: "Bangalore",
      service_date: "Tomorrow (10:30 AM)",
      start_time: "09:00 AM",
      end_time: "06:00 PM",
      technician: "Senior Engineer Suresh",
      ...crmData,
      ...custom_data,
    };

    const evaluatedRules = [];
    for (const rule of rules) {
      const rawText = rule.message_text || rule.template_body || "Hello {name}!";
      const evaluatedText = formatMessagePlaceholders(rawText, sampleDefaults.name, sampleDefaults);
      let evaluatedFollowup = null;
      if (rule.followup_message_text || rule.followup_template_body) {
        const rawFollow = rule.followup_message_text || rule.followup_template_body;
        evaluatedFollowup = formatMessagePlaceholders(rawFollow, sampleDefaults.name, sampleDefaults);
      }

      evaluatedRules.push({
        id: rule.id,
        name: rule.name,
        trigger_type: rule.trigger_type,
        step1_text: evaluatedText,
        step2_followup_text: evaluatedFollowup,
        sequence_delay_seconds: rule.sequence_delay_seconds || 7,
        delay_minutes: rule.delay_minutes || 0,
        has_media: !!(rule.media_url),
        has_flow_linked: !!(rule.flow_id),
      });

      if (send_real_message && phone) {
        await executeAutomationSend(rule, cleanPhone, sampleDefaults.name, evaluatedText, sampleDefaults);
      }
    }

    res.json({
      success: true,
      trigger_type,
      matched_rules_count: rules.length,
      evaluated_rules: evaluatedRules,
      sample_data_used: sampleDefaults,
      real_message_dispatched: Boolean(send_real_message && phone && rules.length > 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single automation with logs ──────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT a.*, 
        t.name as template_name, t.body as template_body,
        ft.name as followup_template_name, ft.body as followup_template_body,
        f.name as flow_name,
        g.name as group_name
       FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
       LEFT JOIN wa_flows f ON a.flow_id = f.id
       LEFT JOIN wa_contact_groups g ON a.group_id = g.id
       WHERE a.id=?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Automation not found" });

    const [logs] = await db.promise().query(
      "SELECT * FROM wa_automation_logs WHERE automation_id=? ORDER BY sent_at DESC LIMIT 50",
      [req.params.id]
    );

    const { getOptions } = require("../services/waMenuHandler");
    const options = await getOptions(req.params.id);

    res.json({ ...rows[0], logs, options, trigger_label: TRIGGER_LABELS[rows[0].trigger_type] || rows[0].trigger_type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create automation ─────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  try {
    const {
      name, trigger_type, template_id, message_text, media_type, media_url,
      sequence_delay_seconds = 7, followup_message_text, followup_media_type, followup_media_url, followup_template_id,
      flow_id, group_id, delay_minutes = 0, conditions, is_active = 1
    } = req.body;
    if (!name || !trigger_type) return res.status(400).json({ error: "name and trigger_type required" });

    const [result] = await db.promise().query(
      `INSERT INTO wa_automations (
        name, trigger_type, template_id, message_text, media_type, media_url,
        sequence_delay_seconds, followup_message_text, followup_media_type, followup_media_url, followup_template_id,
        flow_id, group_id, delay_minutes, conditions, is_active, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, trigger_type, template_id || null, message_text || null, media_type || null, media_url || null,
        parseInt(sequence_delay_seconds, 10) || 7, followup_message_text || null, followup_media_type || null,
        followup_media_url || null, followup_template_id || null, flow_id || null, group_id || null,
        parseInt(delay_minutes, 10) || 0, conditions ? JSON.stringify(conditions) : null,
        is_active ? 1 : 0, req.user?.id || null
      ]
    );
    const [row] = await db.promise().query(
      `SELECT a.*, t.name as template_name FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id WHERE a.id=?`,
      [result.insertId]
    );
    res.status(201).json({ ...row[0], trigger_label: TRIGGER_LABELS[row[0].trigger_type] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update automation ─────────────────────────────────────────────────────────
router.put("/:id", auth, async (req, res) => {
  try {
    const {
      name, trigger_type, template_id, message_text, media_type, media_url,
      sequence_delay_seconds, followup_message_text, followup_media_type, followup_media_url, followup_template_id,
      flow_id, group_id, delay_minutes, conditions, is_active
    } = req.body;
    await db.promise().query(
      `UPDATE wa_automations SET
        name=?, trigger_type=?, template_id=?, message_text=?, media_type=?, media_url=?,
        sequence_delay_seconds=?, followup_message_text=?, followup_media_type=?, followup_media_url=?, followup_template_id=?,
        flow_id=?, group_id=?, delay_minutes=?, conditions=?, is_active=?, updated_at=NOW()
       WHERE id=?`,
      [
        name, trigger_type, template_id || null, message_text || null, media_type || null, media_url || null,
        parseInt(sequence_delay_seconds, 10) || 7, followup_message_text || null, followup_media_type || null,
        followup_media_url || null, followup_template_id || null, flow_id || null, group_id || null,
        parseInt(delay_minutes || 0, 10), conditions ? JSON.stringify(conditions) : null,
        is_active ? 1 : 0, req.params.id
      ]
    );
    const [row] = await db.promise().query(
      `SELECT a.*, t.name as template_name FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id WHERE a.id=?`,
      [req.params.id]
    );
    res.json({ ...row[0], trigger_label: TRIGGER_LABELS[row[0].trigger_type] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Toggle enable/disable ─────────────────────────────────────────────────────
router.post("/:id/toggle", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT is_active FROM wa_automations WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const newState = rows[0].is_active ? 0 : 1;
    await db.promise().query("UPDATE wa_automations SET is_active=?, updated_at=NOW() WHERE id=?", [newState, req.params.id]);
    res.json({ success: true, is_active: newState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete automation ─────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_automations WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Quick-reply options (clickable menu attached to this automation) ─────────
router.get("/:id/options", auth, async (req, res) => {
  try {
    const { getOptions } = require("../services/waMenuHandler");
    res.json(await getOptions(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id/options", auth, async (req, res) => {
  try {
    const { options } = req.body;
    if (!Array.isArray(options)) return res.status(400).json({ error: "options array required" });

    await db.promise().query("DELETE FROM wa_automation_options WHERE automation_id = ?", [req.params.id]);

    const clean = options
      .map((o) => ({ label: (o.label || "").trim(), reply_text: (o.reply_text || "").trim() }))
      .filter((o) => o.label && o.reply_text);

    if (clean.length) {
      const values = clean.map((o, i) => [req.params.id, o.label, o.reply_text, i]);
      await db.promise().query(
        "INSERT INTO wa_automation_options (automation_id, label, reply_text, sort_order) VALUES ?",
        [values]
      );
    }

    const { getOptions } = require("../services/waMenuHandler");
    res.json(await getOptions(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger automation manually (for testing) ─────────────────────────────────
router.post("/:id/trigger", auth, async (req, res) => {
  try {
    const { phone, contact_name, trigger_data } = req.body;
    if (!phone) return res.status(400).json({ error: "phone required" });

    const [rows] = await db.promise().query(
      `SELECT a.*, 
        t.name as template_name, t.body as template_body,
        ft.name as followup_template_name, ft.body as followup_template_body
       FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
       WHERE a.id=?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Automation not found" });

    const automation = rows[0];
    const { executeAutomationSend, formatMessagePlaceholders, lookupCrmDataByPhone } = require("../services/waAutomationService");
    const cleanPhone = phone.replace(/\D/g, "");

    const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));
    const mergedData = {
      invoice_no: "INV-2026-088",
      quotation_no: "QT-2026-104",
      amc_contract_no: "AMC-2026-904",
      amount: "14,500",
      service: "Comprehensive AMC Maintenance",
      due_date: "25 Aug 2026",
      date: new Date().toLocaleDateString("en-IN"),
      city: "Bangalore",
      company: "Madhura Tech",
      ...crmData,
      ...(trigger_data || {})
    };
    const resolvedName = contact_name || crmData.name || "Customer";

    const rawText = automation.message_text || automation.template_body || "Hello {name}!";
    const messageText = formatMessagePlaceholders(rawText, resolvedName, mergedData);

    // Run execution
    await executeAutomationSend(automation, cleanPhone, resolvedName, messageText, mergedData);

    const hasSeq = automation.followup_message_text || automation.followup_media_url || automation.followup_template_name;
    res.json({
      success: true,
      message: hasSeq
        ? `Step 1 sent! Step 2 follow-up will send in ${automation.sequence_delay_seconds || 7} seconds.`
        : "Automation message sent successfully!"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get automation logs ───────────────────────────────────────────────────────
router.get("/logs/recent", auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const [rows] = await db.promise().query(`
      SELECT l.*, a.name as automation_name, a.trigger_type
      FROM wa_automation_logs l
      LEFT JOIN wa_automations a ON l.automation_id = a.id
      ORDER BY l.sent_at DESC LIMIT ?
    `, [limit]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Welcome Auto-Reply Settings & Controls ─────────────────────────────────────
router.get("/welcome-settings", auth, async (req, res) => {
  try {
    const { getWelcomeSettings } = require("../services/waAutomationService");
    res.json(await getWelcomeSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/welcome-settings", auth, async (req, res) => {
  try {
    const { updateWelcomeSettings } = require("../services/waAutomationService");
    res.json(await updateWelcomeSettings(req.body));
  } catch (err) {
    // Config validation (e.g. type 'buttons' with no buttons) is a client error.
    const isValidation = /requires at least one button/i.test(err.message);
    res.status(isValidation ? 400 : 500).json({ error: err.message });
  }
});

router.post("/test-welcome", auth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "phone required for test send" });
    const { getWelcomeSettings, formatMessagePlaceholders, lookupCrmDataByPhone } = require("../services/waAutomationService");
    const settings = await getWelcomeSettings();
    const cleanPhone = phone.replace(/\D/g, "");
    const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));
    const text = formatMessagePlaceholders(settings.welcome_text || "Hello {name}! Welcome to Madhura Tech.", crmData.name || "Test User", crmData);

    const waLoadBalancer = require("../services/waLoadBalancer");

    // Send the test in the SAME shape as production, so the operator actually
    // verifies native buttons render before enabling the auto-reply.
    const result =
      settings.welcome_type === "buttons" && settings.welcome_buttons?.length
        ? await waLoadBalancer.sendInteractiveButtons({
            phone: cleanPhone,
            body: `[TEST WELCOME] ${text}`,
            footer: settings.welcome_footer || null,
            buttons: settings.welcome_buttons,
          })
        : await waLoadBalancer.sendTextMessage(cleanPhone, `[TEST WELCOME] ${text}`);

    res.json({
      success: true,
      engineUsed: result.engineUsed,
      // false means it degraded to numbered text — the Cloud API is not wired up.
      native: result.native ?? false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WhatsApp Load Balancer Stats ───────────────────────────────────────────────
router.get("/load-balancer-stats", auth, async (req, res) => {
  try {
    const waLoadBalancer = require("../services/waLoadBalancer");
    res.json(await waLoadBalancer.getLoadBalancerStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
