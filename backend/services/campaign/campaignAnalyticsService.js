"use strict";

/**
 * campaignAnalyticsService.js
 *
 * Enterprise Campaign Analytics, Funnel, Verified Attribution, ROI,
 * Custom Report Builder & Platform Admin Operations Monitoring.
 *
 * Explicit metric formulas (never mixing message counts & unique recipients):
 * - Delivered Rate   = delivered_messages / resolved_submitted_messages
 * - Read Rate        = read_messages / delivered_messages
 * - Reply Rate       = unique_replied_recipients / delivered_recipients
 * - Conversion Rate  = unique_converted_recipients / delivered_recipients
 * - ROI (%)          = ((attributed_revenue - total_cost) / total_cost) * 100
 */

const {
  createDbHelper,
  assertTenantId,
  normalizePhone,
  safeJsonParse,
  generateUid,
  httpError,
} = require("./dbHelper");

function pct(num, den) {
  if (!den || den <= 0) return 0;
  return Number(((Number(num || 0) / Number(den)) * 100).toFixed(2));
}

function createCampaignAnalyticsService(options = {}) {
  const db = createDbHelper(options.db);

  async function getDashboardOverview(tenantId, filters = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?"];
    const params = [tid];

    if (filters.date_from) { clauses.push("created_at >= ?"); params.push(filters.date_from); }
    if (filters.date_to) { clauses.push("created_at <= ?"); params.push(filters.date_to); }
    if (filters.campaign_type) { clauses.push("campaign_type = ?"); params.push(filters.campaign_type); }
    if (filters.status) { clauses.push("status = ?"); params.push(String(filters.status).toUpperCase()); }
    if (filters.owner_id) { clauses.push("owner_id = ?"); params.push(Number(filters.owner_id)); }
    if (filters.workspace_id) { clauses.push("workspace_id = ?"); params.push(Number(filters.workspace_id)); }
    if (filters.agency_client_id) { clauses.push("agency_client_id = ?"); params.push(Number(filters.agency_client_id)); }
    if (filters.sender_id) { clauses.push("sender_id = ?"); params.push(Number(filters.sender_id)); }
    if (filters.waba_id) { clauses.push("waba_id = ?"); params.push(filters.waba_id); }

    const where = clauses.join(" AND ");

    const summary = await db.queryOne(
      `SELECT
         COUNT(*) AS total_campaigns,
         SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS draft_campaigns,
         SUM(CASE WHEN status = 'PENDING_APPROVAL' THEN 1 ELSE 0 END) AS awaiting_approval,
         SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) AS scheduled_campaigns,
         SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) AS running_campaigns,
         SUM(CASE WHEN status = 'PAUSED' THEN 1 ELSE 0 END) AS paused_campaigns,
         SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_campaigns,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_campaigns,
         COALESCE(SUM(total_eligible), 0) AS total_eligible_recipients,
         COALESCE(SUM(submitted_count), 0) AS messages_submitted,
         COALESCE(SUM(delivered_count), 0) AS messages_delivered,
         COALESCE(SUM(read_count), 0) AS messages_read,
         COALESCE(SUM(failed_count), 0) AS messages_failed,
         COALESCE(SUM(reply_count), 0) AS replies,
         COALESCE(SUM(flow_completed_count), 0) AS flow_completions,
         COALESCE(SUM(conversion_count), 0) AS conversions,
         COALESCE(SUM(estimated_cost_minor), 0) AS estimated_cost_minor,
         COALESCE(SUM(confirmed_cost_minor), 0) AS confirmed_cost_minor,
         COALESCE(SUM(attributed_revenue_minor), 0) AS attributed_revenue_minor
       FROM campaigns WHERE ${where}`,
      params
    );

    const byCategory = await db.query(
      `SELECT category, COUNT(*) AS campaigns,
              COALESCE(SUM(submitted_count), 0) AS submitted,
              COALESCE(SUM(delivered_count), 0) AS delivered,
              COALESCE(SUM(read_count), 0) AS read_count,
              COALESCE(SUM(reply_count), 0) AS replies,
              COALESCE(SUM(conversion_count), 0) AS conversions,
              COALESCE(SUM(attributed_revenue_minor), 0) AS revenue_minor,
              COALESCE(SUM(estimated_cost_minor), 0) AS estimated_cost_minor
       FROM campaigns WHERE ${where}
       GROUP BY category`,
      params
    );

    const bySender = await db.query(
      `SELECT sender_id, waba_id,
              COUNT(*) AS campaigns,
              COALESCE(SUM(submitted_count), 0) AS submitted,
              COALESCE(SUM(delivered_count), 0) AS delivered,
              COALESCE(SUM(failed_count), 0) AS failed
       FROM campaigns WHERE ${where} AND sender_id IS NOT NULL
       GROUP BY sender_id, waba_id`,
      params
    );

    const byCountry = await db.query(
      `SELECT country_code,
              COUNT(*) AS recipients,
              SUM(CASE WHEN status IN ('DELIVERED','READ') THEN 1 ELSE 0 END) AS delivered,
              SUM(CASE WHEN status = 'READ' THEN 1 ELSE 0 END) AS read_count,
              SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) AS replied,
              SUM(CASE WHEN converted_at IS NOT NULL THEN 1 ELSE 0 END) AS converted,
              COALESCE(SUM(estimated_cost_minor), 0) AS estimated_cost_minor
       FROM campaign_recipients
       WHERE tenant_id = ?
       GROUP BY country_code`,
      [tid]
    );

    const submitted = Number(summary?.messages_submitted || 0);
    const delivered = Number(summary?.messages_delivered || 0);
    const failed = Number(summary?.messages_failed || 0);
    const resolved = delivered + failed;
    const read = Number(summary?.messages_read || 0);
    const replies = Number(summary?.replies || 0);
    const conversions = Number(summary?.conversions || 0);
    const estCost = Number(summary?.estimated_cost_minor || 0);
    const revenue = Number(summary?.attributed_revenue_minor || 0);

    return {
      overview: {
        total_campaigns: Number(summary?.total_campaigns || 0),
        draft_campaigns: Number(summary?.draft_campaigns || 0),
        awaiting_approval: Number(summary?.awaiting_approval || 0),
        scheduled_campaigns: Number(summary?.scheduled_campaigns || 0),
        running_campaigns: Number(summary?.running_campaigns || 0),
        paused_campaigns: Number(summary?.paused_campaigns || 0),
        completed_campaigns: Number(summary?.completed_campaigns || 0),
        failed_campaigns: Number(summary?.failed_campaigns || 0),
        total_eligible_recipients: Number(summary?.total_eligible_recipients || 0),
        messages_submitted: submitted,
        messages_delivered: delivered,
        messages_read: read,
        messages_failed: failed,
        replies,
        flow_completions: Number(summary?.flow_completions || 0),
        conversions,
        estimated_cost_minor: estCost,
        confirmed_cost_minor: Number(summary?.confirmed_cost_minor || 0),
        attributed_revenue_minor: revenue,
        delivered_rate: pct(delivered, resolved || submitted),
        read_rate: pct(read, delivered),
        reply_rate: pct(replies, delivered),
        conversion_rate: pct(conversions, delivered),
        roi_percent: estCost > 0 ? Number((((revenue - estCost) / estCost) * 100).toFixed(2)) : 0,
      },
      breakdowns: {
        by_category: byCategory,
        by_sender: bySender,
        by_country: byCountry,
      },
      metric_definitions: {
        delivered_rate: "delivered_messages / resolved_submitted_messages",
        read_rate: "read_messages / delivered_messages",
        reply_rate: "unique_replied_recipients / delivered_recipients",
        conversion_rate: "unique_converted_recipients / delivered_recipients",
        data_freshness: new Date().toISOString(),
      },
    };
  }

  async function getCampaignAnalytics(tenantId, campaignId) {
    const tid = assertTenantId(tenantId);
    const camp = await db.queryOne(`SELECT * FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(campaignId)]);
    if (!camp) throw httpError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");

    const recStats = await db.queryOne(
      `SELECT
         COUNT(*) AS total_recipient_rows,
         COUNT(DISTINCT normalized_phone) AS unique_recipients,
         SUM(CASE WHEN status = 'QUEUED' THEN 1 ELSE 0 END) AS queued,
         SUM(CASE WHEN status IN ('ACCEPTED_BY_META','SENT','DELIVERED','READ') THEN 1 ELSE 0 END) AS submitted,
         SUM(CASE WHEN status IN ('DELIVERED','READ') THEN 1 ELSE 0 END) AS delivered,
         SUM(CASE WHEN status = 'READ' THEN 1 ELSE 0 END) AS read_count,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status LIKE 'BLOCKED_%' THEN 1 ELSE 0 END) AS blocked,
         SUM(CASE WHEN status = 'UNKNOWN_REQUIRES_RECONCILIATION' THEN 1 ELSE 0 END) AS reconciliation_required,
         COUNT(DISTINCT CASE WHEN status IN ('DELIVERED','READ') THEN normalized_phone END) AS unique_delivered,
         COUNT(DISTINCT CASE WHEN replied_at IS NOT NULL THEN normalized_phone END) AS unique_replied,
         COUNT(DISTINCT CASE WHEN flow_completed_at IS NOT NULL THEN normalized_phone END) AS unique_flow_completed,
         COUNT(DISTINCT CASE WHEN converted_at IS NOT NULL THEN normalized_phone END) AS unique_converted,
         COALESCE(SUM(estimated_cost_minor), 0) AS estimated_cost_minor,
         COALESCE(SUM(confirmed_cost_minor), 0) AS confirmed_cost_minor
       FROM campaign_recipients
       WHERE tenant_id = ? AND campaign_id = ?`,
      [tid, camp.id]
    );

    const convStats = await db.queryOne(
      `SELECT
         COUNT(*) AS verified_conversions,
         COALESCE(SUM(revenue_minor), 0) AS verified_revenue_minor
       FROM campaign_conversions
       WHERE tenant_id = ? AND campaign_id = ? AND verified = 1`,
      [tid, camp.id]
    );

    const clickStats = await db.queryOne(
      `SELECT COALESCE(SUM(click_count), 0) AS total_clicks FROM campaign_tracked_links WHERE tenant_id = ? AND campaign_id = ?`,
      [tid, camp.id]
    );

    const flowStats = await db.queryOne(
      `SELECT
         COUNT(*) AS flow_initiated,
         SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS flow_in_progress,
         SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS flow_completed
       FROM whatsapp_flow_executions
       WHERE tenant_id = ? AND campaign_id = ?`,
      [tid, camp.id]
    );

    const submitted = Number(recStats?.submitted || 0);
    const delivered = Number(recStats?.delivered || 0);
    const failed = Number(recStats?.failed || 0);
    const resolved = delivered + failed;
    const read = Number(recStats?.read_count || 0);
    const uniqueDelivered = Number(recStats?.unique_delivered || 0);
    const uniqueReplied = Number(recStats?.unique_replied || 0);
    const uniqueConverted = Number(recStats?.unique_converted || 0);
    const revenue = Number(convStats?.verified_revenue_minor || 0);
    const cost = Number(recStats?.confirmed_cost_minor || 0) || Number(recStats?.estimated_cost_minor || 0);

    return {
      campaign_id: camp.id,
      campaign_uid: camp.campaign_uid,
      name: camp.name,
      status: camp.status,
      provider_route: camp.provider_route,
      funnel: {
        audience_matched: Number(camp.total_matched || 0),
        eligible_recipients: Number(camp.total_eligible || 0),
        excluded_recipients: Number(camp.total_excluded || 0),
        queued: Number(recStats?.queued || 0),
        submitted,
        delivered,
        read,
        failed,
        blocked: Number(recStats?.blocked || 0),
        reconciliation_required: Number(recStats?.reconciliation_required || 0),
        unique_delivered: uniqueDelivered,
        unique_replied: uniqueReplied,
        unique_flow_completed: Number(recStats?.unique_flow_completed || 0),
        unique_converted: uniqueConverted,
        verified_revenue_minor: revenue,
      },
      rates: {
        delivered_rate: pct(delivered, resolved),
        read_rate: pct(read, delivered),
        reply_rate: pct(uniqueReplied, uniqueDelivered),
        conversion_rate: pct(uniqueConverted, uniqueDelivered),
      },
      engagement: {
        clicks: Number(clickStats?.total_clicks || 0),
        flow_initiated: Number(flowStats?.flow_initiated || 0),
        flow_completed: Number(flowStats?.flow_completed || 0),
      },
      financial: {
        billing_mode: camp.billing_mode,
        currency: camp.currency,
        estimated_cost_minor: Number(recStats?.estimated_cost_minor || 0),
        confirmed_cost_minor: Number(recStats?.confirmed_cost_minor || 0),
        verified_revenue_minor: revenue,
        cost_per_delivered_minor: delivered > 0 ? Math.round(cost / delivered) : 0,
        cost_per_reply_minor: uniqueReplied > 0 ? Math.round(cost / uniqueReplied) : 0,
        cost_per_conversion_minor: uniqueConverted > 0 ? Math.round(cost / uniqueConverted) : 0,
        roi_percent: cost > 0 ? Number((((revenue - cost) / cost) * 100).toFixed(2)) : 0,
      },
      metric_definitions: {
        delivered_rate: "delivered_messages / (delivered_messages + failed_messages)",
        read_rate: "read_messages / delivered_messages",
        reply_rate: "unique_replied_recipients / unique_delivered_recipients",
        conversion_rate: "unique_converted_recipients / unique_delivered_recipients",
        computed_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Verified Conversion Attribution:
   * Only attributes a conversion when a verified source event (order/payment/deal/lead/appointment)
   * matches a delivered campaign recipient within the configured attribution window.
   */
  async function recordVerifiedConversion(tenantId, input = {}) {
    const tid = assertTenantId(tenantId);
    const { entity_type, entity_id, conversion_type = "order", phone, revenue_minor = 0, currency = "INR", attribution_window_hours = 168, attribution_model = "last_touch", evidence = {} } = input;
    if (!entity_type || !entity_id) {
      throw httpError("Verified conversion requires entity_type and entity_id", 400, "CONVERSION_SOURCE_REQUIRED");
    }

    const existing = await db.queryOne(
      `SELECT id FROM campaign_conversions WHERE tenant_id = ? AND entity_type = ? AND entity_id = ? LIMIT 1`,
      [tid, String(entity_type), String(entity_id)]
    );
    if (existing) return { attributed: true, deduplicated: true, conversion_id: existing.id };

    const { valid, normalized } = normalizePhone(phone);
    if (!valid) return { attributed: false, reason: "invalid_phone" };

    const orderDir = attribution_model === "first_touch" ? "ASC" : "DESC";
    const candidates = await db.query(
      `SELECT * FROM campaign_recipients
       WHERE tenant_id = ? AND normalized_phone = ? AND status IN ('DELIVERED','READ')
       ORDER BY delivered_at ${orderDir}`,
      [tid, normalized]
    );

    const windowMs = Math.max(1, Number(attribution_window_hours)) * 3600000;
    const nowMs = Date.now();
    const matched = candidates.find((c) => {
      if (!c.delivered_at) return false;
      const dt = new Date(c.delivered_at).getTime();
      return !Number.isNaN(dt) && nowMs - dt <= windowMs;
    });

    if (!matched) {
      return {
        attributed: false,
        reason: `No delivered campaign message found within ${attribution_window_hours}h attribution window`,
      };
    }

    const attrRes = await db.query(
      `INSERT INTO campaign_attributions (
        tenant_id, campaign_id, recipient_id, contact_id, variant_id,
        attribution_model, attribution_window_hours, source_type, source_ref_id, evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        matched.campaign_id,
        matched.id,
        matched.contact_id,
        matched.variant_id || null,
        attribution_model,
        attribution_window_hours,
        String(entity_type),
        String(entity_id),
        JSON.stringify({ delivered_at: matched.delivered_at, wamid: matched.wamid, ...evidence }),
      ]
    );

    const revMinor = Math.max(0, Number(revenue_minor || 0));
    const convRes = await db.query(
      `INSERT INTO campaign_conversions (
        tenant_id, campaign_id, recipient_id, contact_id, attribution_id,
        conversion_type, entity_type, entity_id, revenue_minor, currency, verified, evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        tid,
        matched.campaign_id,
        matched.id,
        matched.contact_id,
        attrRes.insertId,
        conversion_type,
        String(entity_type),
        String(entity_id),
        revMinor,
        currency,
        JSON.stringify(evidence),
      ]
    );

    if (!matched.converted_at) {
      await db.query(
        `UPDATE campaign_recipients SET converted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`,
        [matched.id, tid]
      );
      await db.query(
        `UPDATE campaigns SET conversion_count = conversion_count + 1, attributed_revenue_minor = attributed_revenue_minor + ?, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND id = ?`,
        [revMinor, tid, matched.campaign_id]
      );
    } else if (revMinor > 0) {
      await db.query(
        `UPDATE campaigns SET attributed_revenue_minor = attributed_revenue_minor + ?, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND id = ?`,
        [revMinor, tid, matched.campaign_id]
      );
    }

    return {
      attributed: true,
      deduplicated: false,
      attribution_id: attrRes.insertId,
      conversion_id: convRes.insertId,
      campaign_id: matched.campaign_id,
      recipient_id: matched.id,
      revenue_minor: revMinor,
    };
  }

  async function createTrackedLink(tenantId, { campaignId, recipientId = null, destinationUrl, utm = {} }) {
    const tid = assertTenantId(tenantId);
    const shortCode = generateUid("lnk").slice(0, 14);
    const res = await db.query(
      `INSERT INTO campaign_tracked_links (tenant_id, campaign_id, recipient_id, short_code, destination_url, utm_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tid, Number(campaignId), recipientId, shortCode, String(destinationUrl), JSON.stringify(utm)]
    );
    return { id: res.insertId, short_code: shortCode, destination_url: destinationUrl };
  }

  async function recordLinkClick(shortCode) {
    const link = await db.queryOne(`SELECT * FROM campaign_tracked_links WHERE short_code = ? LIMIT 1`, [String(shortCode)]);
    if (!link) throw httpError("Tracked link not found", 404);
    await db.query(
      `UPDATE campaign_tracked_links SET click_count = click_count + 1, last_clicked_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [link.id]
    );
    await db.query(
      `INSERT INTO campaign_engagement_events (tenant_id, campaign_id, recipient_id, event_type, metadata_json)
       VALUES (?, ?, ?, 'link_clicked', ?)`,
      [link.tenant_id, link.campaign_id, link.recipient_id, JSON.stringify({ short_code: shortCode, destination_url: link.destination_url })]
    );
    return link;
  }

  async function createCustomReport(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const res = await db.query(
      `INSERT INTO campaign_custom_reports (
        tenant_id, workspace_id, name, description, metrics_json, dimensions_json,
        filters_json, schedule_cron, recipients_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        input.workspace_id || null,
        String(input.name || "Campaign Performance Report"),
        input.description || null,
        JSON.stringify(input.metrics || ["submitted", "delivered", "read", "replies", "conversions", "revenue"]),
        JSON.stringify(input.dimensions || ["campaign"]),
        JSON.stringify(input.filters || {}),
        input.schedule_cron || null,
        input.recipients ? JSON.stringify(input.recipients) : null,
        actorId,
      ]
    );
    return db.queryOne(`SELECT * FROM campaign_custom_reports WHERE id = ?`, [res.insertId]);
  }

  async function listCustomReports(tenantId) {
    const tid = assertTenantId(tenantId);
    const rows = await db.query(`SELECT * FROM campaign_custom_reports WHERE tenant_id = ? ORDER BY created_at DESC`, [tid]);
    return rows.map((r) => ({
      ...r,
      metrics: safeJsonParse(r.metrics_json, []),
      dimensions: safeJsonParse(r.dimensions_json, []),
      filters: safeJsonParse(r.filters_json, {}),
    }));
  }

  /**
   * Platform Admin Operational Monitoring & Dispatch Controls (`/admin/campaigns`)
   */
  async function getPlatformOperationsOverview() {
    const [activeCampaigns, queueDepth, jobsByTenant, failedJobs, reconciliationCount, pausedControls] = await Promise.all([
      db.query(`SELECT id, campaign_uid, tenant_id, name, status, provider_route, sender_id, waba_id, total_eligible, submitted_count, delivered_count, failed_count, updated_at FROM campaigns WHERE status IN ('RUNNING','PREPARING','SCHEDULED','PAUSED','PENDING_APPROVAL') ORDER BY updated_at DESC LIMIT 100`),
      db.query(`SELECT queue_name, status, COUNT(*) AS count FROM campaign_jobs GROUP BY queue_name, status`),
      db.query(`SELECT tenant_id, COUNT(*) AS total_jobs, SUM(CASE WHEN status='QUEUED' THEN 1 ELSE 0 END) AS queued, SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed FROM campaign_jobs GROUP BY tenant_id`),
      db.query(`SELECT id, job_uid, queue_name, tenant_id, campaign_id, recipient_id, error_class, last_error, attempts, updated_at FROM campaign_jobs WHERE status IN ('FAILED','RECONCILIATION_REQUIRED') ORDER BY updated_at DESC LIMIT 100`),
      db.queryOne(`SELECT COUNT(*) AS cnt FROM campaign_recipients WHERE status = 'UNKNOWN_REQUIRES_RECONCILIATION'`),
      db.query(`SELECT * FROM campaign_dispatch_controls WHERE is_paused = 1 ORDER BY updated_at DESC`),
    ]);

    return {
      active_campaigns: activeCampaigns,
      queue_depth: queueDepth,
      jobs_by_tenant: jobsByTenant,
      failed_and_dlq_jobs: failedJobs,
      reconciliation_required_count: Number(reconciliationCount?.cnt || 0),
      paused_controls: pausedControls,
      checked_at: new Date().toISOString(),
    };
  }

  async function setDispatchControl({ scopeType, scopeId, isPaused, reason = null, actorId = null }) {
    if (!["tenant", "waba", "sender"].includes(scopeType)) {
      throw httpError("scopeType must be tenant, waba, or sender", 400);
    }
    const existing = await db.queryOne(
      `SELECT id FROM campaign_dispatch_controls WHERE scope_type = ? AND scope_id = ? LIMIT 1`,
      [scopeType, String(scopeId)]
    );
    if (existing) {
      await db.query(
        `UPDATE campaign_dispatch_controls SET is_paused = ?, reason = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [isPaused ? 1 : 0, reason, actorId, existing.id]
      );
    } else {
      await db.query(
        `INSERT INTO campaign_dispatch_controls (scope_type, scope_id, is_paused, reason, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [scopeType, String(scopeId), isPaused ? 1 : 0, reason, actorId]
      );
    }
    if (scopeType === "sender") {
      await db.query(`UPDATE wa_senders SET dispatch_paused = ?, pause_reason = ? WHERE id = ?`, [isPaused ? 1 : 0, reason, Number(scopeId)]).catch(() => {});
    }
    return { scope_type: scopeType, scope_id: String(scopeId), is_paused: Boolean(isPaused), reason };
  }

  return {
    getDashboardOverview,
    getCampaignAnalytics,
    recordVerifiedConversion,
    createTrackedLink,
    recordLinkClick,
    createCustomReport,
    listCustomReports,
    getPlatformOperationsOverview,
    setDispatchControl,
  };
}

module.exports = { createCampaignAnalyticsService };
