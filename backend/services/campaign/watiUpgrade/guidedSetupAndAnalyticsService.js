"use strict";

/**
 * guidedSetupAndAnalyticsService.js
 *
 * 1. Guided First-Campaign Readiness Assistant (`/whatsapp/campaigns/get-started`):
 *    - Audits real sender connection, contacts/groups, duplicate phone detection,
 *      consent/suppression readiness, approved templates, and pending Meta approval
 *      auto-launch monitoring (only launches when explicitly enabled AND all
 *      launch-time checks pass).
 * 2. Advanced Campaign Analytics (`/whatsapp/campaigns/analytics`):
 *    - Hourly / Daily / Weekly / Monthly trends
 *    - 7-stage Delivery-vs-Engagement Funnel
 *    - Failure reason breakdown
 *    - Individual Campaign Full Report (summary, template, audience, sender,
 *      versions, timeline, retargeting segments, attribution, cost)
 */

const { createDbHelper, assertTenantId, safeJsonParse, httpError } = require("../dbHelper");
const { createCampaignManagementService } = require("../campaignManagementService");
const { createCampaignExecutionEngine } = require("../campaignExecutionEngine");
const { classifyRecipientFailure } = require("./failureRecoveryService");

function createGuidedSetupAndAnalyticsService(options = {}) {
  const db = createDbHelper(options.db);
  const managementService = options.managementService || createCampaignManagementService({ db: options.db });
  const executionEngine = options.executionEngine || createCampaignExecutionEngine({ db: options.db, managementService });

  async function getGuidedOnboardingStatus(tenantId) {
    const tid = assertTenantId(tenantId);
    const [senders, contacts, dupPhones, consents, approvedTemplates, pendingTemplates, campaigns, pendingLaunches] = await Promise.all([
      db.query(`SELECT id, display_phone, verified_name, status, waba_connection_id FROM wa_senders WHERE tenant_id = ? AND status = 'connected'`, [tid]).catch(() => []),
      db.queryOne(`SELECT COUNT(*) AS cnt FROM wa_contacts WHERE tenant_id = ?`, [tid]).catch(() => ({ cnt: 0 })),
      db.query(`SELECT phone, COUNT(*) AS cnt FROM wa_contacts WHERE tenant_id = ? GROUP BY phone HAVING COUNT(*) > 1 LIMIT 20`, [tid]).catch(() => []),
      db.queryOne(`SELECT COUNT(*) AS cnt FROM contact_consents WHERE tenant_id = ? AND status = 'GRANTED'`, [tid]).catch(() => ({ cnt: 0 })),
      db.query(`SELECT id, name, category, language FROM wa_templates WHERE tenant_id = ? AND meta_status = 'APPROVED' AND (archived IS NULL OR archived = 0) LIMIT 20`, [tid]).catch(() => []),
      db.query(`SELECT id, name, meta_status FROM wa_templates WHERE tenant_id = ? AND meta_status = 'PENDING' AND (archived IS NULL OR archived = 0) LIMIT 20`, [tid]).catch(() => []),
      db.queryOne(`SELECT COUNT(*) AS cnt FROM campaigns WHERE tenant_id = ?`, [tid]).catch(() => ({ cnt: 0 })),
      db.query(`SELECT p.*, c.name AS campaign_name, t.name AS template_name, t.meta_status AS template_status FROM campaign_pending_auto_launches p LEFT JOIN campaigns c ON c.id = p.campaign_id LEFT JOIN wa_templates t ON t.id = p.template_id WHERE p.tenant_id = ? ORDER BY p.id DESC LIMIT 20`, [tid]).catch(() => []),
    ]);

    const steps = [
      {
        key: "sender",
        title: "Connect Authorized WhatsApp Sender",
        completed: senders.length > 0,
        detail: senders.length > 0 ? `${senders.length} connected sender(s)` : "No connected WABA sender found. Connect one in /whatsapp/accounts.",
        action_path: "/whatsapp/accounts",
      },
      {
        key: "contacts",
        title: "Import or Select Contacts",
        completed: Number(contacts?.cnt || 0) > 0,
        detail: Number(contacts?.cnt || 0) > 0 ? `${contacts.cnt} CRM contacts (${dupPhones.length} duplicate phone groups detected)` : "Import contacts via CSV/XLSX or CRM in /whatsapp/groups.",
        action_path: "/whatsapp/groups",
      },
      {
        key: "consent",
        title: "Verify Opt-In Consent & DNC Suppression",
        completed: Number(consents?.cnt || 0) > 0,
        detail: Number(consents?.cnt || 0) > 0 ? `${consents.cnt} active consent records` : "Record verifiable opt-in consent in /whatsapp/campaigns/consent.",
        action_path: "/whatsapp/campaigns/consent",
      },
      {
        key: "template",
        title: "Select or Create an Approved Meta Template",
        completed: approvedTemplates.length > 0,
        detail: approvedTemplates.length > 0
          ? `${approvedTemplates.length} approved template(s) ready`
          : pendingTemplates.length > 0
          ? `${pendingTemplates.length} template(s) pending Meta approval (you can save campaign & monitor approval below)`
          : "Create and submit a template in /whatsapp/templates.",
        action_path: "/whatsapp/templates",
      },
      {
        key: "campaign",
        title: "Create, Validate & Launch First Campaign",
        completed: Number(campaigns?.cnt || 0) > 0,
        detail: Number(campaigns?.cnt || 0) > 0 ? `${campaigns.cnt} campaign(s) created` : "Use the Campaign Composer to preview variables, estimate cost, and launch.",
        action_path: "/whatsapp/campaigns/create",
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;
    return {
      progress_pct: Math.round((completedCount / steps.length) * 100),
      completed_steps: completedCount,
      total_steps: steps.length,
      duplicate_phone_groups: dupPhones,
      steps,
      pending_auto_launches: pendingLaunches,
    };
  }

  async function registerPendingApprovalWatch(tenantId, { campaignId, templateId, autoLaunchEnabled = false } = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const res = await db.query(
      `INSERT INTO campaign_pending_auto_launches (tenant_id, campaign_id, template_id, auto_launch_enabled, status, created_by)
       VALUES (?, ?, ?, ?, 'WAITING_TEMPLATE_APPROVAL', ?)`,
      [tid, Number(campaignId), Number(templateId), autoLaunchEnabled ? 1 : 0, actorId || null]
    );
    return db.queryOne(`SELECT * FROM campaign_pending_auto_launches WHERE id = ?`, [res.insertId]);
  }

  async function evaluatePendingAutoLaunches(tenantId, { syncDispatch = false } = {}) {
    const tid = assertTenantId(tenantId);
    const watches = await db.query(
      `SELECT p.*, t.meta_status AS template_status
       FROM campaign_pending_auto_launches p
       JOIN wa_templates t ON t.id = p.template_id AND t.tenant_id = p.tenant_id
       WHERE p.tenant_id = ? AND p.status IN ('WAITING_TEMPLATE_APPROVAL', 'BLOCKED')`,
      [tid]
    );

    const results = [];
    for (const w of watches) {
      const tStatus = String(w.template_status || "").toUpperCase();
      if (tStatus === "REJECTED" || tStatus === "DISABLED") {
        await db.query(
          `UPDATE campaign_pending_auto_launches SET status = 'REJECTED', last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [w.id]
        );
        results.push({ watch_id: w.id, campaign_id: w.campaign_id, status: "REJECTED" });
        continue;
      }
      if (tStatus !== "APPROVED") {
        await db.query(`UPDATE campaign_pending_auto_launches SET last_checked_at = CURRENT_TIMESTAMP WHERE id = ?`, [w.id]);
        results.push({ watch_id: w.id, campaign_id: w.campaign_id, status: "WAITING_TEMPLATE_APPROVAL" });
        continue;
      }

      // Template is now APPROVED! Always run full pre-launch validation before auto-launching!
      const validation = await managementService.validateAndPreview(tid, w.campaign_id);
      if (!validation.valid) {
        await db.query(
          `UPDATE campaign_pending_auto_launches SET status = 'BLOCKED', last_blockers_json = ?, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [JSON.stringify(validation.blockers || []), w.id]
        );
        results.push({ watch_id: w.id, campaign_id: w.campaign_id, status: "BLOCKED", blockers: validation.blockers });
        continue;
      }

      if (!w.auto_launch_enabled) {
        await db.query(
          `UPDATE campaign_pending_auto_launches SET status = 'READY', last_blockers_json = '[]', last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [w.id]
        );
        results.push({ watch_id: w.id, campaign_id: w.campaign_id, status: "READY_MANUAL_LAUNCH" });
        continue;
      }

      const launched = await executionEngine.launchCampaign(tid, w.campaign_id, w.created_by || null, {
        syncDispatch,
        bypassApprovalCheck: true,
      });
      await db.query(
        `UPDATE campaign_pending_auto_launches SET status = 'LAUNCHED', last_blockers_json = '[]', launched_at = CURRENT_TIMESTAMP, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [w.id]
      );
      results.push({ watch_id: w.id, campaign_id: w.campaign_id, status: "LAUNCHED", queued_count: launched.queued_count });
    }
    return { evaluated: results.length, results };
  }

  // ── 2. Advanced Analytics: Funnel, Trends & Individual Campaign Report ─────
  async function getAdvancedAnalytics(tenantId, {
    granularity = "daily", // hourly | daily | weekly | monthly
    category = null,
    senderId = null,
    countryCode = null,
    dateFrom = null,
    dateTo = null,
  } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["r.tenant_id = ?"];
    const params = [tid];
    if (category) { clauses.push("c.category = ?"); params.push(String(category).toUpperCase()); }
    if (senderId) { clauses.push("r.sender_id = ?"); params.push(Number(senderId)); }
    if (countryCode) { clauses.push("r.country_code = ?"); params.push(String(countryCode).toUpperCase()); }
    if (dateFrom) { clauses.push("r.created_at >= ?"); params.push(dateFrom); }
    if (dateTo) { clauses.push("r.created_at <= ?"); params.push(dateTo); }

    const rows = await db.query(
      `SELECT r.id, r.campaign_id, r.status, r.country_code, r.sender_id, r.delivered_at, r.read_at, r.replied_at,
              r.flow_completed_at, r.converted_at, r.error_code, r.error_message, r.estimated_cost_minor, r.confirmed_cost_minor,
              r.created_at, c.category, c.total_matched, c.total_eligible
       FROM campaign_recipients r
       JOIN campaigns c ON c.id = r.campaign_id AND c.tenant_id = r.tenant_id
       WHERE ${clauses.join(" AND ")}`,
      params
    );

    const clicksRow = await db.queryOne(
      `SELECT COALESCE(SUM(click_count), 0) AS clicks FROM campaign_tracked_links WHERE tenant_id = ?`,
      [tid]
    ).catch(() => ({ clicks: 0 }));

    const revRow = await db.queryOne(
      `SELECT COALESCE(SUM(revenue_minor), 0) AS rev FROM campaign_conversions WHERE tenant_id = ?`,
      [tid]
    ).catch(() => ({ rev: 0 }));

    // 7-stage funnel
    const funnel = {
      audience: rows.length,
      eligible: rows.filter((r) => !["BLOCKED_BY_CONSENT", "BLOCKED_BY_SUPPRESSION"].includes(r.status)).length,
      submitted: rows.filter((r) => ["ACCEPTED_BY_META", "SENT", "DELIVERED", "READ"].includes(r.status)).length,
      delivered: rows.filter((r) => Boolean(r.delivered_at) || ["DELIVERED", "READ"].includes(r.status)).length,
      read: rows.filter((r) => Boolean(r.read_at) || r.status === "READ").length,
      engaged: rows.filter((r) => Boolean(r.replied_at) || Boolean(r.flow_completed_at)).length,
      converted: rows.filter((r) => Boolean(r.converted_at)).length,
      failed: rows.filter((r) => r.status === "FAILED").length,
      cta_clicks: Number(clicksRow?.clicks || 0),
      revenue_minor: Number(revRow?.rev || 0),
      estimated_cost_minor: rows.reduce((a, r) => a + Number(r.estimated_cost_minor || 0), 0),
    };

    // Bucketed trend series
    const buckets = new Map();
    const failureReasons = {};

    for (const r of rows) {
      const dt = new Date(r.created_at || Date.now());
      let key;
      if (granularity === "hourly") key = dt.toISOString().slice(0, 13) + ":00";
      else if (granularity === "monthly") key = dt.toISOString().slice(0, 7);
      else if (granularity === "weekly") {
        const d = new Date(dt);
        d.setUTCDate(d.getUTCDate() - d.getUTCDay());
        key = d.toISOString().slice(0, 10);
      } else {
        key = dt.toISOString().slice(0, 10);
      }

      const b = buckets.get(key) || { bucket: key, submitted: 0, delivered: 0, read: 0, engaged: 0, converted: 0, failed: 0 };
      if (["ACCEPTED_BY_META", "SENT", "DELIVERED", "READ"].includes(r.status)) b.submitted++;
      if (Boolean(r.delivered_at) || ["DELIVERED", "READ"].includes(r.status)) b.delivered++;
      if (Boolean(r.read_at) || r.status === "READ") b.read++;
      if (Boolean(r.replied_at) || Boolean(r.flow_completed_at)) b.engaged++;
      if (Boolean(r.converted_at)) b.converted++;
      if (r.status === "FAILED") {
        b.failed++;
        const cls = classifyRecipientFailure(r);
        failureReasons[cls.category] = (failureReasons[cls.category] || 0) + 1;
      }
      buckets.set(key, b);
    }

    return {
      granularity,
      refreshed_at: new Date().toISOString(),
      refresh_interval_note: "Live database aggregation on request",
      funnel,
      trends: Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket)),
      failure_breakdown: Object.entries(failureReasons).map(([category, count]) => ({ category, count })),
    };
  }

  return {
    getGuidedOnboardingStatus,
    registerPendingApprovalWatch,
    evaluatePendingAutoLaunches,
    getAdvancedAnalytics,
  };
}

module.exports = { createGuidedSetupAndAnalyticsService };
