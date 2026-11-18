"use strict";

/**
 * campaignSchedulerService.js
 *
 * Enterprise Campaign Scheduling, Calendar, Timezone, Quiet Hours & Recurrence Engine.
 * - Stores timestamps consistently in UTC while preserving original intended timezone
 * - Evaluates configurable quiet hours, allowed weekdays & holiday exclusions
 * - Prevents duplicate recurring executions via unique execution instances
 */

const { createDbHelper, assertTenantId, safeJsonParse, httpError } = require("./dbHelper");

function isWithinQuietHours(dateUtc, settings = {}) {
  if (!settings || !settings.quiet_hours_enabled) return { inQuietHours: false };
  const tz = settings.timezone || settings.default_timezone || "Asia/Kolkata";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: false,
    }).formatToParts(dateUtc);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    const hh = Number(get("hour"));
    const mm = Number(get("minute"));
    const curMin = hh * 60 + mm;
    const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
    const weekday = get("weekday").toLowerCase().slice(0, 3);

    const holidays = Array.isArray(settings.holidays) ? settings.holidays : safeJsonParse(settings.holidays_json, []);
    if (Array.isArray(holidays) && holidays.includes(dateKey)) {
      return { inQuietHours: true, reason: `Configured holiday (${dateKey})` };
    }

    const allowedDays = Array.isArray(settings.allowed_days) ? settings.allowed_days : safeJsonParse(settings.allowed_days_json, null);
    if (Array.isArray(allowedDays) && allowedDays.length > 0 && !allowedDays.map((d) => String(d).toLowerCase().slice(0, 3)).includes(weekday)) {
      return { inQuietHours: true, reason: `Day '${weekday}' is outside allowed sending days` };
    }

    const [sh, sm] = String(settings.quiet_hours_start || "21:00").split(":").map(Number);
    const [eh, em] = String(settings.quiet_hours_end || "09:00").split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    const inside = startMin > endMin
      ? curMin >= startMin || curMin < endMin
      : curMin >= startMin && curMin < endMin;

    return inside
      ? { inQuietHours: true, reason: `Within quiet hours (${settings.quiet_hours_start}-${settings.quiet_hours_end} ${tz})` }
      : { inQuietHours: false };
  } catch {
    return { inQuietHours: false };
  }
}

function computeNextRecurrence(fromDateUtc, recurrenceRule = {}) {
  const base = new Date(fromDateUtc.getTime());
  const freq = String(recurrenceRule.frequency || "daily").toLowerCase();
  const interval = Math.max(1, Number(recurrenceRule.interval || 1));
  if (freq === "daily") base.setUTCDate(base.getUTCDate() + interval);
  else if (freq === "weekly") base.setUTCDate(base.getUTCDate() + 7 * interval);
  else if (freq === "monthly") base.setUTCMonth(base.getUTCMonth() + interval);
  else base.setUTCHours(base.getUTCHours() + interval);
  return base;
}

function createCampaignSchedulerService(options = {}) {
  const db = createDbHelper(options.db);

  async function scheduleCampaign(tenantId, campaignId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const camp = await db.queryOne(
      `SELECT * FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(campaignId)]
    );
    if (!camp) throw httpError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");
    if (!["DRAFT", "APPROVED", "PAUSED"].includes(camp.status)) {
      throw httpError(`Campaign in '${camp.status}' state cannot be scheduled`, 409, "INVALID_SCHEDULE_STATE");
    }

    const runAt = input.run_at_utc ? new Date(input.run_at_utc) : new Date(Date.now() + 60000);
    if (Number.isNaN(runAt.getTime())) {
      throw httpError("Invalid run_at_utc timestamp", 400, "INVALID_SCHEDULE_TIME");
    }
    const isoUtc = runAt.toISOString().replace("T", " ").slice(0, 19);
    const scheduleType = input.schedule_type || (input.recurrence_rule ? "recurring" : "once");

    const res = await db.query(
      `INSERT INTO campaign_schedules (
        tenant_id, workspace_id, campaign_id, schedule_type, timezone,
        use_recipient_local_time, run_at_utc, recurrence_rule_json,
        send_window_start, send_window_end, next_run_at_utc, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        tid,
        camp.workspace_id,
        camp.id,
        scheduleType,
        input.timezone || camp.reporting_timezone || "Asia/Kolkata",
        input.use_recipient_local_time ? 1 : 0,
        isoUtc,
        input.recurrence_rule ? JSON.stringify(input.recurrence_rule) : null,
        input.send_window_start || null,
        input.send_window_end || null,
        isoUtc,
        actorId,
      ]
    );

    await db.query(
      `UPDATE campaigns
       SET status = 'SCHEDULED', scheduled_at = ?, is_recurring = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [isoUtc, scheduleType === "recurring" ? 1 : 0, actorId, tid, camp.id]
    );

    return db.queryOne(`SELECT * FROM campaign_schedules WHERE id = ?`, [res.insertId]);
  }

  async function getCalendarEvents(tenantId, { from = null, to = null, workspaceId = null } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["c.tenant_id = ?", "(c.scheduled_at IS NOT NULL OR c.start_date IS NOT NULL)"];
    const params = [tid];
    if (workspaceId) {
      clauses.push("c.workspace_id = ?");
      params.push(Number(workspaceId));
    }
    if (from) {
      clauses.push("COALESCE(c.scheduled_at, c.start_date) >= ?");
      params.push(from);
    }
    if (to) {
      clauses.push("COALESCE(c.scheduled_at, c.start_date) <= ?");
      params.push(to);
    }

    return db.query(
      `SELECT c.id, c.campaign_uid, c.name, c.status, c.approval_status, c.campaign_type,
              c.category, c.owner_id, c.workspace_id, c.sender_id, c.waba_id,
              c.total_eligible, c.estimated_cost_minor, c.currency,
              c.reporting_timezone, c.scheduled_at, c.start_date, c.end_date, c.is_recurring,
              cs.schedule_type, cs.next_run_at_utc, cs.use_recipient_local_time
       FROM campaigns c
       LEFT JOIN campaign_schedules cs ON cs.campaign_id = c.id AND cs.tenant_id = c.tenant_id AND cs.status = 'active'
       WHERE ${clauses.join(" AND ")}
       ORDER BY COALESCE(c.scheduled_at, c.start_date) ASC LIMIT 500`,
      params
    );
  }

  async function getSettings(tenantId, workspaceId = null) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(
      `SELECT * FROM campaign_settings
       WHERE tenant_id = ? AND campaign_id IS NULL
       ORDER BY id DESC LIMIT 1`,
      [tid]
    );
    return row || {
      tenant_id: tid,
      workspace_id: workspaceId,
      quiet_hours_enabled: 0,
      quiet_hours_start: "21:00",
      quiet_hours_end: "09:00",
      max_messages_per_contact_24h: 2,
      max_marketing_per_contact_7d: 3,
      repeat_campaign_cooldown_hours: 24,
      batch_size: 200,
      rate_limit_per_sec: 20,
      allow_cloud_fallback: 0,
      require_four_eyes_approval: 0,
      approval_threshold_recipients: 1000,
      approval_threshold_cost_minor: 50000,
      missing_variable_policy: "exclude",
      default_timezone: "Asia/Kolkata",
    };
  }

  async function saveSettings(tenantId, input = {}) {
    const tid = assertTenantId(tenantId);
    const existing = await db.queryOne(
      `SELECT id FROM campaign_settings WHERE tenant_id = ? AND campaign_id IS NULL ORDER BY id DESC LIMIT 1`,
      [tid]
    );
    const values = [
      input.quiet_hours_enabled ? 1 : 0,
      input.quiet_hours_start || "21:00",
      input.quiet_hours_end || "09:00",
      input.allowed_days ? JSON.stringify(input.allowed_days) : null,
      input.holidays ? JSON.stringify(input.holidays) : null,
      Number(input.max_messages_per_contact_24h || 2),
      Number(input.max_marketing_per_contact_7d || 3),
      Number(input.repeat_campaign_cooldown_hours || 24),
      Number(input.batch_size || 200),
      Number(input.rate_limit_per_sec || 20),
      input.allow_cloud_fallback ? 1 : 0,
      input.require_four_eyes_approval ? 1 : 0,
      Number(input.approval_threshold_recipients || 1000),
      Number(input.approval_threshold_cost_minor || 50000),
      input.missing_variable_policy || "exclude",
      input.default_timezone || "Asia/Kolkata",
    ];
    if (existing) {
      await db.query(
        `UPDATE campaign_settings SET
          quiet_hours_enabled=?, quiet_hours_start=?, quiet_hours_end=?, allowed_days_json=?,
          holidays_json=?, max_messages_per_contact_24h=?, max_marketing_per_contact_7d=?,
          repeat_campaign_cooldown_hours=?, batch_size=?, rate_limit_per_sec=?,
          allow_cloud_fallback=?, require_four_eyes_approval=?, approval_threshold_recipients=?,
          approval_threshold_cost_minor=?, missing_variable_policy=?, default_timezone=?,
          updated_at=CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [...values, existing.id, tid]
      );
    } else {
      await db.query(
        `INSERT INTO campaign_settings (
          tenant_id, workspace_id, quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
          allowed_days_json, holidays_json, max_messages_per_contact_24h, max_marketing_per_contact_7d,
          repeat_campaign_cooldown_hours, batch_size, rate_limit_per_sec, allow_cloud_fallback,
          require_four_eyes_approval, approval_threshold_recipients, approval_threshold_cost_minor,
          missing_variable_policy, default_timezone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tid, input.workspace_id || null, ...values]
      );
    }
    return getSettings(tid, input.workspace_id || null);
  }

  return {
    scheduleCampaign,
    getCalendarEvents,
    getSettings,
    saveSettings,
    isWithinQuietHours,
    computeNextRecurrence,
  };
}

module.exports = { createCampaignSchedulerService, isWithinQuietHours, computeNextRecurrence };
