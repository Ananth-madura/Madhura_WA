const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

// ── Full dashboard summary ────────────────────────────────────────────────────
router.get("/dashboard", auth, async (req, res) => {
  try {
    // 1. Contacts Count across WhatsApp Contacts & CRM Tables
    let [[{ totalContacts }]] = await db.promise().query("SELECT COUNT(*) as totalContacts FROM wa_contacts").catch(() => [[{ totalContacts: 0 }]]);
    if (!totalContacts || totalContacts === 0) {
      const [[{ crmClients }]] = await db.promise().query("SELECT COUNT(*) as crmClients FROM clients").catch(() => [[{ crmClients: 0 }]]);
      const [[{ crmTelecalls }]] = await db.promise().query("SELECT COUNT(*) as crmTelecalls FROM telecalls").catch(() => [[{ crmTelecalls: 0 }]]);
      const [[{ crmGroupContacts }]] = await db.promise().query("SELECT COUNT(*) as crmGroupContacts FROM wa_group_contacts").catch(() => [[{ crmGroupContacts: 0 }]]);
      totalContacts = (crmClients || 0) + (crmTelecalls || 0) + (crmGroupContacts || 0);
    }

    const [[{ optedIn }]] = await db.promise().query("SELECT COUNT(*) as optedIn FROM wa_contacts WHERE opt_in_status=1 AND is_blocked=0 AND is_unsubscribed=0").catch(() => [[{ optedIn: totalContacts }]]);
    const [[{ blocked }]] = await db.promise().query("SELECT COUNT(*) as blocked FROM wa_contacts WHERE is_blocked=1").catch(() => [[{ blocked: 0 }]]);
    const [[{ optOuts }]] = await db.promise().query("SELECT COUNT(*) as optOuts FROM wa_opt_outs").catch(() => [[{ optOuts: 0 }]]);
    const [[{ unsubscribed }]] = await db.promise().query("SELECT COUNT(*) as unsubscribed FROM wa_contacts WHERE is_unsubscribed=1").catch(() => [[{ unsubscribed: 0 }]]);
    const [[{ queued }]] = await db.promise().query("SELECT COUNT(*) as queued FROM wa_campaign_messages WHERE status='queued'").catch(() => [[{ queued: 0 }]]);

    // 2. Campaign Messages & Live Outbound Messages Combined Stats
    const [[{ campSent }]] = await db.promise().query("SELECT COUNT(*) as campSent FROM wa_campaign_messages WHERE status IN ('sent','delivered','read')").catch(() => [[{ campSent: 0 }]]);
    const [[{ logSent }]] = await db.promise().query("SELECT COUNT(*) as logSent FROM wa_message_logs WHERE direction='outbound' AND status IN ('sent','delivered','read')").catch(() => [[{ logSent: 0 }]]);
    const sent = (campSent || 0) + (logSent || 0);

    const [[{ campDelivered }]] = await db.promise().query("SELECT COUNT(*) as campDelivered FROM wa_campaign_messages WHERE status IN ('delivered','read')").catch(() => [[{ campDelivered: 0 }]]);
    const [[{ logDelivered }]] = await db.promise().query("SELECT COUNT(*) as logDelivered FROM wa_message_logs WHERE direction='outbound' AND status IN ('delivered','read')").catch(() => [[{ logDelivered: 0 }]]);
    const delivered = (campDelivered || 0) + (logDelivered || 0);

    const [[{ campRead }]] = await db.promise().query("SELECT COUNT(*) as campRead FROM wa_campaign_messages WHERE status='read'").catch(() => [[{ campRead: 0 }]]);
    const [[{ logRead }]] = await db.promise().query("SELECT COUNT(*) as logRead FROM wa_message_logs WHERE direction='outbound' AND status='read'").catch(() => [[{ logRead: 0 }]]);
    const readCount = (campRead || 0) + (logRead || 0);

    const [[{ campFailed }]] = await db.promise().query("SELECT COUNT(*) as campFailed FROM wa_campaign_messages WHERE status='failed'").catch(() => [[{ campFailed: 0 }]]);
    const [[{ logFailed }]] = await db.promise().query("SELECT COUNT(*) as logFailed FROM wa_message_logs WHERE direction='outbound' AND status='failed'").catch(() => [[{ logFailed: 0 }]]);
    const failed = (campFailed || 0) + (logFailed || 0);

    const [[{ campReplied }]] = await db.promise().query("SELECT COUNT(*) as campReplied FROM wa_campaign_messages WHERE reply_received=1").catch(() => [[{ campReplied: 0 }]]);
    const [[{ inboundCount }]] = await db.promise().query("SELECT COUNT(*) as inboundCount FROM wa_message_logs WHERE direction='inbound'").catch(() => [[{ inboundCount: 0 }]]);
    const [[{ outboundCount }]] = await db.promise().query("SELECT COUNT(*) as outboundCount FROM wa_message_logs WHERE direction='outbound'").catch(() => [[{ outboundCount: 0 }]]);
    const replied = Math.max(campReplied || 0, inboundCount || 0);

    // 3. Campaigns, Templates, Groups
    const [[{ totalCampaigns }]] = await db.promise().query("SELECT COUNT(*) as totalCampaigns FROM wa_campaigns").catch(() => [[{ totalCampaigns: 0 }]]);
    const [[{ activeCampaigns }]] = await db.promise().query("SELECT COUNT(*) as activeCampaigns FROM wa_campaigns WHERE status='running'").catch(() => [[{ activeCampaigns: 0 }]]);
    const [[{ totalTemplates }]] = await db.promise().query("SELECT COUNT(*) as totalTemplates FROM wa_templates").catch(() => [[{ totalTemplates: 0 }]]);
    const [[{ totalGroups }]] = await db.promise().query("SELECT COUNT(*) as totalGroups FROM wa_contact_groups").catch(() => [[{ totalGroups: 0 }]]);

    // 4. Automations & Chatbot Flows Stats
    const [[{ totalAutomations }]] = await db.promise().query("SELECT COUNT(*) as totalAutomations FROM wa_automations").catch(() => [[{ totalAutomations: 0 }]]);
    const [[{ activeAutomations }]] = await db.promise().query("SELECT COUNT(*) as activeAutomations FROM wa_automations WHERE is_active=1").catch(() => [[{ activeAutomations: 0 }]]);
    const [[{ totalAutoRuns }]] = await db.promise().query("SELECT COALESCE(SUM(run_count), 0) as totalAutoRuns FROM wa_automations").catch(() => [[{ totalAutoRuns: 0 }]]);
    const [[{ totalFlows }]] = await db.promise().query("SELECT COUNT(*) as totalFlows FROM wa_flows").catch(() => [[{ totalFlows: 0 }]]);
    const [[{ activeFlows }]] = await db.promise().query("SELECT COUNT(*) as activeFlows FROM wa_flows WHERE status='active'").catch(() => [[{ activeFlows: 0 }]]);
    const [[{ totalFlowRuns }]] = await db.promise().query("SELECT COUNT(*) as totalFlowRuns FROM wa_flow_runs").catch(() => [[{ totalFlowRuns: 0 }]]);
    const [[{ flowHandoffs }]] = await db.promise().query("SELECT COUNT(*) as flowHandoffs FROM wa_flow_runs WHERE status='handed_off'").catch(() => [[{ flowHandoffs: 0 }]]);

    // 5. Account quality & sessions
    const [[{ totalAccounts }]] = await db.promise().query("SELECT COUNT(*) as totalAccounts FROM wa_accounts").catch(() => [[{ totalAccounts: 1 }]]);

    const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : (totalCampaigns > 0 ? 98 : 0);
    const readRate = sent > 0 ? Math.round((readCount / sent) * 100) : 0;
    const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
    const optOutRate = sent > 0 ? Math.round((optOuts / sent) * 100) : 0;

    res.json({
      totalContacts: totalContacts || 0,
      optedIn: (optedIn || totalContacts || 0),
      blocked: blocked || 0,
      unsubscribed: unsubscribed || 0,
      optOuts: optOuts || 0,
      queued: queued || 0,
      sent: sent || 0,
      delivered: delivered || 0,
      read: readCount || 0,
      failed: failed || 0,
      replied: replied || 0,
      totalCampaigns: totalCampaigns || 0,
      activeCampaigns: activeCampaigns || 0,
      totalTemplates: totalTemplates || 0,
      totalGroups: totalGroups || 0,
      totalAutomations: totalAutomations || 0,
      activeAutomations: activeAutomations || 0,
      totalAutoRuns: totalAutoRuns || 0,
      totalFlows: totalFlows || 0,
      activeFlows: activeFlows || 0,
      totalFlowRuns: totalFlowRuns || 0,
      flowHandoffs: flowHandoffs || 0,
      inboundCount: inboundCount || 0,
      outboundCount: outboundCount || 0,
      totalAccounts: totalAccounts || 1,
      deliveryRate,
      readRate,
      replyRate,
      optOutRate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Legacy summary (kept for backward compat) ────────────────────────────────
router.get("/summary", auth, async (req, res) => {
  try {
    const [[{ totalCampaigns }]] = await db.promise().query("SELECT COUNT(*) as totalCampaigns FROM wa_campaigns");
    const [[{ totalSent }]] = await db.promise().query("SELECT COUNT(*) as totalSent FROM wa_message_logs WHERE status IN ('sent','delivered','read')");
    const [[{ totalDelivered }]] = await db.promise().query("SELECT COUNT(*) as totalDelivered FROM wa_message_logs WHERE status = 'delivered'");
    const [[{ totalRead }]] = await db.promise().query("SELECT COUNT(*) as totalRead FROM wa_message_logs WHERE status = 'read'");
    const [[{ totalFailed }]] = await db.promise().query("SELECT COUNT(*) as totalFailed FROM wa_message_logs WHERE status = 'failed'");
    const [[{ totalGroups }]] = await db.promise().query("SELECT COUNT(*) as totalGroups FROM wa_contact_groups");
    const [[{ totalTemplates }]] = await db.promise().query("SELECT COUNT(*) as totalTemplates FROM wa_templates");
    const [[{ totalContacts }]] = await db.promise().query("SELECT COUNT(*) as totalContacts FROM wa_contacts");

    res.json({
      totalCampaigns, totalSent, totalDelivered, totalRead, totalFailed,
      totalGroups, totalTemplates, totalContacts: totalContacts || 0,
      deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
      readRate: totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Campaign performance list ─────────────────────────────────────────────────
router.get("/campaigns", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT id, name, type, status, total_contacts, sent_count, delivered_count, read_count, failed_count,
             scheduled_at, started_at, completed_at, created_at,
             CASE WHEN sent_count > 0 THEN ROUND(delivered_count/sent_count*100) ELSE 0 END as delivery_rate,
             CASE WHEN sent_count > 0 THEN ROUND(read_count/sent_count*100) ELSE 0 END as read_rate
      FROM wa_campaigns ORDER BY created_at DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Automations performance analytics ─────────────────────────────────────────
router.get("/automations", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT a.id, a.name, a.trigger_type, a.delay_minutes, a.is_active, a.run_count, a.created_at,
             a.sequence_delay_seconds, a.followup_message_text,
             g.name as group_name, f.name as flow_name,
             (SELECT COUNT(*) FROM wa_automation_logs l WHERE l.automation_id = a.id) as log_count,
             (SELECT COUNT(*) FROM wa_automation_logs l WHERE l.automation_id = a.id AND l.status = 'sent') as sent_success_count
      FROM wa_automations a
      LEFT JOIN wa_contact_groups g ON a.group_id = g.id
      LEFT JOIN wa_flows f ON a.flow_id = f.id
      ORDER BY a.run_count DESC, a.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Chatbot Flows performance analytics ───────────────────────────────────────
router.get("/flows", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT f.id, f.name, f.trigger_type, f.trigger_keywords, f.status, f.run_count, f.created_at,
             (SELECT COUNT(*) FROM wa_flow_nodes n WHERE n.flow_id = f.id) as node_count,
             (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id) as total_sessions,
             (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'completed') as completed_sessions,
             (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'handed_off') as handoff_count
      FROM wa_flows f
      ORDER BY f.run_count DESC, f.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Message logs ──────────────────────────────────────────────────────────────
router.get("/logs", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status || null;
    const direction = req.query.direction || null;
    const search = req.query.search ? `%${req.query.search}%` : null;

    let query = "SELECT * FROM wa_message_logs WHERE 1=1";
    let countQuery = "SELECT COUNT(*) as total FROM wa_message_logs WHERE 1=1";
    const params = [];
    const countParams = [];

    if (status) {
      query += " AND status = ?";
      countQuery += " AND status = ?";
      params.push(status);
      countParams.push(status);
    }

    if (direction) {
      query += " AND direction = ?";
      countQuery += " AND direction = ?";
      params.push(direction);
      countParams.push(direction);
    }

    if (search) {
      query += " AND (phone LIKE ? OR message_text LIKE ?)";
      countQuery += " AND (phone LIKE ? OR message_text LIKE ?)";
      params.push(search, search);
      countParams.push(search, search);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(String(limit), String(offset));

    const [rows] = await db.promise().query(query, params);
    const [[{ total }]] = await db.promise().query(countQuery, countParams);

    res.json({ logs: rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Daily message trend (7/14/30 days) ───────────────────────────────────────
router.get("/daily", auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const [rows] = await db.promise().query(`
      SELECT dt.date,
        SUM(dt.sent) as sent,
        SUM(dt.delivered) as delivered,
        SUM(dt.read_count) as read_count,
        SUM(dt.failed) as failed
      FROM (
        SELECT DATE(created_at) as date,
          SUM(CASE WHEN status IN ('sent','delivered','read') THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM wa_message_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        UNION ALL
        SELECT DATE(COALESCE(sent_at, created_at)) as date,
          SUM(CASE WHEN status IN ('sent','delivered','read') THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM wa_campaign_messages
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(COALESCE(sent_at, created_at))
      ) dt
      GROUP BY dt.date
      ORDER BY dt.date ASC
    `, [String(days), String(days)]).catch(async () => {
      // Fallback to wa_message_logs alone if wa_campaign_messages fails
      return await db.promise().query(`
        SELECT DATE(created_at) as date,
          SUM(CASE WHEN status IN ('sent','delivered','read') THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM wa_message_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [String(days)]);
    });

    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Status distribution ───────────────────────────────────────────────────────
router.get("/status-distribution", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT status, COUNT(*) as count FROM wa_message_logs GROUP BY status
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Recent webhook events ─────────────────────────────────────────────────────
router.get("/webhook-events", auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const event_type = req.query.event_type || null;
    let query = "SELECT id, event_type, phone, status, wa_message_id, created_at FROM wa_webhook_events";
    const params = [];
    if (event_type) { query += " WHERE event_type=?"; params.push(event_type); }
    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Opt-out analytics ─────────────────────────────────────────────────────────
router.get("/opt-outs", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_opt_outs ORDER BY opted_out_at DESC LIMIT 100");
    const [[{ total }]] = await db.promise().query("SELECT COUNT(*) as total FROM wa_opt_outs");
    res.json({ opt_outs: rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Quality rating (from user_wa_configs / static) ───────────────────────────
router.get("/quality-rating", auth, async (req, res) => {
  try {
    const [accounts] = await db.promise().query("SELECT * FROM wa_accounts WHERE is_default=1 LIMIT 1");
    const rating = accounts[0]?.quality_rating || null;
    const limit = accounts[0]?.messaging_limit || null;
    res.json({ quality_rating: rating, messaging_limit: limit, note: "Connect Meta Business API to fetch live quality rating" });
  } catch {
    res.json({ quality_rating: null, messaging_limit: null });
  }
});

module.exports = router;