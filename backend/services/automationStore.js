"use strict";
const { normalizeConditions } = require("./waRuleConditions");

const TRIGGERS = [
  // Existing triggers
  "welcome_message",
  "new_lead",
  "invoice_created",
  "quotation_created",
  "amc_created",
  "payment_received",
  "payment_due",
  "service_visit_scheduled",
  "walkin_created",
  "ticket_closed",
  "birthday",
  "appointment_reminder",
  "lead_followup",
  "abandoned_cart",
  "custom",
  // Advanced CRM Leads & Sales Triggers
  "lead_status_changed",
  "lead_qualified",
  "deal_created",
  "deal_won",
  "deal_lost",
  "deal_stage_changed",
  // Billing & Payments Triggers
  "invoice_due",
  "invoice_overdue",
  "invoice_paid",
  "invoice_partially_paid",
  "payment_verified",
  "payment_failed",
  "refund_verified",
  // Quotations & Appointments
  "quotation_accepted",
  "quotation_rejected",
  "quotation_expired",
  "appointment_booked",
  "appointment_confirmed",
  "appointment_rescheduled",
  "appointment_cancelled",
  // Support Tickets & Employee Tasks
  "ticket_created",
  "ticket_assigned",
  "ticket_updated",
  "ticket_resolved",
  "task_assigned",
  "approval_requested",
  "approval_completed",
  // Inbound WhatsApp & Timing
  "incoming_message",
  "keyword_detected",
  "button_clicked",
  "no_reply_timeout",
  "scheduled_date",
  "inactivity_timeout",
];

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const idValue = (value) =>
  value == null || value === ""
    ? null
    : Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value)
    : (() => {
        throw fail("Linked records need valid IDs");
      })();

const FIELDS = [
  "name",
  "trigger_type",
  "sender_id",
  "template_id",
  "message_text",
  "media_type",
  "media_url",
  "sequence_delay_seconds",
  "followup_message_text",
  "followup_media_type",
  "followup_media_url",
  "followup_template_id",
  "flow_id",
  "group_id",
  "delay_minutes",
  "conditions",
  "is_active",
  "actions_json",
  "schedule_json",
  "category",
  "branch_id",
];

function normalizeActions(raw) {
  if (raw == null || raw === "") return null;
  let actions = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(actions)) throw fail("Actions pipeline must be an array of action steps");
  if (actions.length > 20) throw fail("A workflow can contain up to 20 actions");

  const validTypes = new Set([
    "send_message",
    "send_template",
    "send_document",
    "send_bill",
    "send_receipt",
    "send_payment_link",
    "start_flow",
    "ask_question",
    "wait_delay",
    "branch_condition",
    "update_crm",
    "assign_employee",
    "internal_notification",
    "call_webhook",
    "ai_process",
  ]);

  const sanitized = actions.map((act, index) => {
    if (!act || typeof act !== "object" || !validTypes.has(act.type)) {
      throw fail(`Action at step ${index + 1} has an unsupported action type`);
    }
    return {
      id: act.id || `act_${index + 1}`,
      type: act.type,
      title: typeof act.title === "string" ? act.title.slice(0, 100) : act.type,
      params: act.params && typeof act.params === "object" ? act.params : {},
    };
  });

  return JSON.stringify(sanitized);
}

function normalizeSchedule(raw) {
  if (raw == null || raw === "") return null;
  const schedule = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (typeof schedule !== "object") throw fail("Schedule must be an object");
  return JSON.stringify({
    reminder_type: schedule.reminder_type || "relative",
    delay_value: Number(schedule.delay_value || 0),
    delay_unit: schedule.delay_unit || "minutes",
    recurring: Boolean(schedule.recurring),
    recurring_interval: schedule.recurring_interval || null,
    cancel_on_event: schedule.cancel_on_event || null,
    business_hours_only: Boolean(schedule.business_hours_only),
    timezone: schedule.timezone || "Asia/Kolkata",
    max_attempts: Number(schedule.max_attempts || 3),
  });
}

function normalize(input) {
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 255 ||
    !TRIGGERS.includes(input.trigger_type)
  ) {
    throw fail("Provide a rule name up to 255 characters and a supported trigger");
  }

  const result = { ...input, name: input.name.trim() };
  for (const field of ["sender_id", "template_id", "followup_template_id", "flow_id", "group_id", "branch_id"]) {
    result[field] = idValue(input[field]);
  }

  for (const field of ["message_text", "followup_message_text"]) {
    if (input[field] != null && (typeof input[field] !== "string" || input[field].length > 4096)) {
      throw fail("Messages must be text up to 4096 characters");
    }
    result[field] = input[field]?.trim() || null;
  }

  for (const prefix of ["", "followup_"]) {
    const url = input[`${prefix}media_url`];
    const type = input[`${prefix}media_type`];
    result[`${prefix}media_type`] = url ? type : null;
    result[`${prefix}media_url`] = url || null;
    if (url) {
      if (
        typeof url !== "string" ||
        url.length > 2000 ||
        !["image", "video", "audio", "document", "excel"].includes(type)
      ) {
        throw fail("Choose a supported media type and URL");
      }
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
      } catch (_) {
        throw fail("Media must use an HTTPS URL without embedded credentials");
      }
    }
    if (result[`${prefix}template_id`] && result[`${prefix}media_url`]) {
      throw fail("Choose either a template or media for each message");
    }
  }

  // Multi-action pipeline normalization
  try {
    result.actions_json = normalizeActions(input.actions_json);
  } catch (err) {
    throw fail(err.message);
  }

  // Schedule normalization
  try {
    result.schedule_json = normalizeSchedule(input.schedule_json);
  } catch (err) {
    throw fail(err.message);
  }

  // Category normalization
  result.category = typeof input.category === "string" ? input.category.slice(0, 50) : "general";

  // If actions_json is present, top-level message can fallback to a descriptive indicator
  if (!result.message_text && !result.media_url && !result.template_id) {
    if (result.actions_json) {
      result.message_text = "Multi-step automation pipeline active.";
    } else {
      throw fail("Configure the main message, media, template, or workflow actions");
    }
  }

  result.delay_minutes = Number(input.delay_minutes ?? 0);
  result.sequence_delay_seconds = Number(input.sequence_delay_seconds ?? 7);
  if (!Number.isInteger(result.delay_minutes) || result.delay_minutes < 0 || result.delay_minutes > 43200) {
    throw fail("Delay must be 0 to 43200 whole minutes");
  }
  if (
    !Number.isInteger(result.sequence_delay_seconds) ||
    result.sequence_delay_seconds < 5 ||
    result.sequence_delay_seconds > 60
  ) {
    throw fail("Follow-up delay must be 5 to 60 whole seconds");
  }
  if (![undefined, true, false, 0, 1].includes(input.is_active)) {
    throw fail("Enable state must be a boolean");
  }
  result.is_active = input.is_active === undefined ? 0 : Number(Boolean(input.is_active));

  try {
    result.conditions = JSON.stringify(normalizeConditions(input.conditions));
  } catch (error) {
    throw fail(error.message);
  }

  return result;
}

function normalizeOptions(options) {
  if (!Array.isArray(options) || options.length > 3) throw fail("Provide up to three reply options");
  const normalized = options.map((option) => {
    if (
      !option ||
      typeof option.label !== "string" ||
      !option.label.trim() ||
      option.label.length > 20 ||
      typeof option.reply_text !== "string" ||
      !option.reply_text.trim() ||
      option.reply_text.length > 4096
    ) {
      throw fail("Reply options need a label up to 20 characters and a response up to 4096 characters");
    }
    return { label: option.label.trim(), reply_text: option.reply_text.trim() };
  });
  if (new Set(normalized.map((option) => option.label.toLowerCase())).size !== normalized.length) {
    throw fail("Reply option labels must be unique");
  }
  return normalized;
}

function createStore(db) {
  const query = async (sql, params = []) => (await db.promise().query(sql, params))[0];

  async function transaction(work) {
    if (db.isSqlite) throw fail("Automation editing requires the configured MySQL database", 503);
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();
      const value = await work(async (sql, params = []) => (await connection.query(sql, params))[0]);
      await connection.commit();
      return value;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function get(tenant, id, q = query, lock = false) {
    const [row] = await q(
      `SELECT * FROM wa_automations WHERE tenant_id=? AND id=?${lock ? " FOR UPDATE" : ""}`,
      [tenant, id]
    );
    if (!row) throw fail("Automation not found", 404);
    return row;
  }

  async function links(tenant, rule, q = query) {
    if (
      !rule.sender_id ||
      !(
        await q(
          "SELECT id FROM wa_senders WHERE tenant_id=? AND id=? AND status='connected'",
          [tenant, rule.sender_id]
        )
      ).length
    ) {
      throw fail("Choose a connected Meta sender from this organization");
    }

    for (const field of ["template_id", "followup_template_id"]) {
      if (rule[field]) {
        const [template] = await q(
          "SELECT id FROM wa_templates WHERE tenant_id=? AND id=? AND meta_status='APPROVED' AND meta_template_id IS NOT NULL",
          [tenant, rule[field]]
        );
        if (!template) throw fail("Select a Meta-approved template belonging to this organization");
      }
    }

    if (
      rule.flow_id &&
      !(
        await q(
          "SELECT f.id FROM wa_flows f JOIN wa_flow_versions v ON v.flow_id=f.id AND v.status='published' WHERE f.tenant_id=? AND f.id=? AND f.status='active'",
          [tenant, rule.flow_id]
        )
      ).length
    ) {
      throw fail("Select a published, active flow from this organization");
    }

    if (
      rule.group_id &&
      !(await q("SELECT id FROM wa_contact_groups WHERE tenant_id=? AND id=?", [tenant, rule.group_id])).length
    ) {
      throw fail("Select a contact group from this organization");
    }

    if (
      rule.branch_id &&
      !(await q("SELECT id FROM branches WHERE tenant_id=? AND id=? AND status!='archived'", [tenant, rule.branch_id])).length
    ) {
      throw fail("Select a valid active branch from this organization");
    }
  }

  async function snapshotVersion(q, tenant, user, automationId, ruleRow, changelog = "Published snapshot") {
    try {
      const [maxRow] = await q(
        "SELECT COALESCE(MAX(version_number), 0) AS ver FROM wa_automation_versions WHERE tenant_id=? AND automation_id=?",
        [tenant, automationId]
      );
      const nextVer = Number(maxRow?.ver || 0) + 1;
      await q(
        "UPDATE wa_automation_versions SET status='archived' WHERE tenant_id=? AND automation_id=? AND status='published'",
        [tenant, automationId]
      );
      const ins = await q(
        "INSERT INTO wa_automation_versions (tenant_id, automation_id, version_number, snapshot_json, status, changelog, published_by) VALUES (?, ?, ?, ?, 'published', ?, ?)",
        [tenant, automationId, nextVer, JSON.stringify(ruleRow), String(changelog || "Snapshot").slice(0, 250), user || null]
      );
      await q("UPDATE wa_automations SET published_version_id=? WHERE tenant_id=? AND id=?", [ins.insertId, tenant, automationId]);
      return ins.insertId;
    } catch (_) {
      return null;
    }
  }

  const audit = (q, tenant, user, id, action, revision) =>
    q(
      "INSERT INTO wa_automation_audit (tenant_id,automation_id,actor_id,action,revision) VALUES (?,?,?,?,?)",
      [tenant, id, user, action, revision]
    );

  async function options(q, id, values) {
    await q("DELETE FROM wa_automation_options WHERE automation_id=?", [id]);
    for (const [index, option] of values.entries()) {
      await q(
        "INSERT INTO wa_automation_options (automation_id,label,reply_text,sort_order) VALUES (?,?,?,?)",
        [id, option.label, option.reply_text, index]
      );
    }
  }

  async function save(tenant, user, input, id = null) {
    const rule = normalize(input);
    const replies = input.options === undefined ? undefined : normalizeOptions(input.options);
    return transaction(async (q) => {
      const previous = id ? await get(tenant, id, q, true) : null;
      if (
        previous &&
        input.revision !== undefined &&
        Number(input.revision) !== Number(previous.revision)
      ) {
        throw fail("This automation changed in another session. Reload before saving.", 409);
      }
      await links(tenant, rule, q);
      const values = FIELDS.map((field) => rule[field]);
      if (previous) {
        await q(
          `UPDATE wa_automations SET ${FIELDS.map(
            (field) => `${field}=?`
          ).join(",")},revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?`,
          [...values, tenant, id]
        );
      } else {
        id = (
          await q(
            `INSERT INTO wa_automations (tenant_id,created_by,${FIELDS.join(
              ","
            )}) VALUES (${[tenant, user, ...values].map(() => "?").join(",")})`,
            [tenant, user, ...values]
          )
        ).insertId;
      }
      if (replies !== undefined) await options(q, id, replies);
      const row = await get(tenant, id, q);
      if (Number(row.is_active) === 1 || previous) {
        await snapshotVersion(q, tenant, user, id, row, previous ? "Updated rule configuration" : "Created active rule");
      }
      await audit(q, tenant, user, id, previous ? "updated" : "created", row.revision);
      return get(tenant, id, q);
    });
  }

  async function setEnabled(tenant, user, id, enabled = null) {
    return transaction(async (q) => {
      const rule = await get(tenant, id, q, true);
      const active = enabled === null ? !rule.is_active : enabled;
      if (active) {
        normalize(rule);
        await links(tenant, rule, q);
      }
      await q(
        "UPDATE wa_automations SET is_active=?,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?",
        [Number(active), tenant, id]
      );
      if (active) {
        const fresh = await get(tenant, id, q);
        await snapshotVersion(q, tenant, user, id, fresh, "Activated automation version");
      }
      await audit(q, tenant, user, id, active ? "enabled" : "paused", Number(rule.revision) + 1);
      return { success: true, is_active: Number(active) };
    });
  }

  async function remove(tenant, user, id) {
    return transaction(async (q) => {
      const row = await get(tenant, id, q, true);
      await audit(q, tenant, user, id, "deleted", row.revision);
      await q("DELETE FROM wa_automations WHERE tenant_id=? AND id=?", [tenant, id]);
      return { success: true };
    });
  }

  async function replaceOptions(tenant, user, id, input) {
    const replies = normalizeOptions(input);
    return transaction(async (q) => {
      const row = await get(tenant, id, q, true);
      await options(q, id, replies);
      await q(
        "UPDATE wa_automations SET revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?",
        [tenant, id]
      );
      await audit(q, tenant, user, id, "options_updated", Number(row.revision) + 1);
      return replies;
    });
  }

  async function bulk(tenant, user, active) {
    return transaction(async (q) => {
      const rows = await q(
        "SELECT * FROM wa_automations WHERE tenant_id=? AND is_active=? ORDER BY id LIMIT 501 FOR UPDATE",
        [tenant, Number(!active)]
      );
      if (rows.length > 500) throw fail("Manage rules in batches of up to 500", 409);
      for (const row of rows) {
        if (active) {
          normalize(row);
          await links(tenant, row, q);
        }
        await q(
          "UPDATE wa_automations SET is_active=?,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?",
          [Number(active), tenant, row.id]
        );
        await audit(q, tenant, user, row.id, active ? "enabled" : "paused", Number(row.revision) + 1);
      }
      return { success: true, [active ? "resumed" : "stopped"]: rows.length };
    });
  }

  async function bulkAction(tenant, user, ids, action) {
    const cleanIds = [...new Set((Array.isArray(ids) ? ids : []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];
    if (!cleanIds.length || cleanIds.length > 200) throw fail("Select 1 to 200 automation rules");
    if (!["activate", "pause", "duplicate", "delete"].includes(action)) throw fail("Unsupported bulk action");

    return transaction(async (q) => {
      const placeholders = cleanIds.map(() => "?").join(",");
      const rows = await q(
        `SELECT * FROM wa_automations WHERE tenant_id=? AND id IN (${placeholders}) FOR UPDATE`,
        [tenant, ...cleanIds]
      );
      if (rows.length !== cleanIds.length) {
        throw fail("One or more selected rules were not found in this organization", 404);
      }

      const affected = [];
      for (const row of rows) {
        if (action === "activate" || action === "pause") {
          const nextActive = action === "activate" ? 1 : 0;
          if (nextActive) {
            normalize(row);
            await links(tenant, row, q);
          }
          await q(
            "UPDATE wa_automations SET is_active=?,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?",
            [nextActive, tenant, row.id]
          );
          if (nextActive) await snapshotVersion(q, tenant, user, row.id, { ...row, is_active: 1 }, "Bulk activated");
          await audit(q, tenant, user, row.id, nextActive ? "enabled" : "paused", Number(row.revision) + 1);
          affected.push(row.id);
        } else if (action === "duplicate") {
          const copyName = `${String(row.name).slice(0, 235)} (Copy)`;
          const ins = await q(
            `INSERT INTO wa_automations (tenant_id,created_by,branch_id,name,trigger_type,sender_id,template_id,message_text,media_type,media_url,sequence_delay_seconds,followup_message_text,followup_media_type,followup_media_url,followup_template_id,flow_id,group_id,delay_minutes,conditions,is_active,actions_json,schedule_json,category)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,
            [tenant, user, row.branch_id || null, copyName, row.trigger_type, row.sender_id, row.template_id, row.message_text, row.media_type, row.media_url, row.sequence_delay_seconds, row.followup_message_text, row.followup_media_type, row.followup_media_url, row.followup_template_id, row.flow_id, row.group_id, row.delay_minutes, row.conditions, row.actions_json, row.schedule_json, row.category]
          );
          await audit(q, tenant, user, ins.insertId, "created", 1);
          affected.push(ins.insertId);
        } else if (action === "delete") {
          await audit(q, tenant, user, row.id, "deleted", row.revision);
          await q("DELETE FROM wa_automations WHERE tenant_id=? AND id=?", [tenant, row.id]);
          affected.push(row.id);
        }
      }
      return { success: true, action, count: affected.length, affected };
    });
  }

  return { query, get, save, links, setEnabled, remove, replaceOptions, transaction, bulk, bulkAction };
}

module.exports = { createStore, normalize, normalizeOptions, normalizeActions, normalizeSchedule, TRIGGERS };
