"use strict";
/**
 * waQuickReminderService.js
 *
 * Chat-native reminder lifecycle: create, list for a conversation, reschedule,
 * cancel, send-now and the minute-level due dispatcher.
 *
 * Every write is tenant-scoped with the tenant resolved from the verified
 * request (never from a client-supplied tenant_id).
 */

const db = require("../config/database");
const {
  normalizePhone,
  toSqlDateTime,
  validateReminderInput,
  validateReminderPatch,
  nextOccurrence,
} = require("./waQuickReminderRules");
const { createReminderRow, dispatchReminderRow } = require("./waConfirmationService");

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function emitReminderEvent(action, reminder) {
  try {
    const { getIO } = require("../sockets/chatsockets");
    const io = getIO();
    if (!io) return;
    io.emit("wa_reminder_updated", {
      reminderId: reminder?.id,
      id: reminder?.id,
      status: reminder?.status,
      action,
      phone: reminder?.phone,
      reminder,
      at: new Date().toISOString(),
    });
    io.emit("data_changed", { resource: "reminders", action, id: reminder?.id });
  } catch (_) {}
}

// Self-healing schema guard.
//
// `CREATE TABLE IF NOT EXISTS` never adds columns to a table that already
// exists, so a restored/older database can be missing `created_at`/`updated_at`
// (or a later column) even though the DDL declares it. That surfaced as
// "Unknown column 'updated_at' in 'field list'" on reminder updates. Reconcile
// the columns lazily on first use so every install heals itself.
let reminderSchemaReady = false;

async function ensureReminderSchema() {
  if (reminderSchemaReady) return;
  const sqlite = Boolean(db.isSqlite);
  const wanted = [
    ["tenant_id", sqlite ? "INTEGER DEFAULT 1" : "INT DEFAULT 1"],
    ["options_payload", "TEXT DEFAULT NULL"],
    ["response_action", "TEXT DEFAULT NULL"],
    ["assigned_staff_name", "VARCHAR(100) DEFAULT NULL"],
    ["notes", "TEXT DEFAULT NULL"],
    ["flow_id", "INT DEFAULT NULL"],
    ["template_id", "INT DEFAULT NULL"],
    ["audience", sqlite ? "TEXT DEFAULT 'customer'" : "VARCHAR(16) DEFAULT 'customer'"],
    ["repeat_rule", sqlite ? "TEXT DEFAULT 'none'" : "VARCHAR(16) DEFAULT 'none'"],
    ["repeat_until", "DATETIME DEFAULT NULL"],
    ["parent_id", "INT DEFAULT NULL"],
    ["created_by", "INT DEFAULT NULL"],
    ["branch_id", "INT DEFAULT NULL"],
    ["source", sqlite ? "TEXT DEFAULT 'automation'" : "VARCHAR(32) DEFAULT 'automation'"],
    ["assigned_user_id", "INT DEFAULT NULL"],
    // SQLite refuses a non-constant DEFAULT on ADD COLUMN, and the service
    // writes these explicitly anyway.
    ["created_at", sqlite ? "TEXT DEFAULT NULL" : "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"],
    [
      "updated_at",
      sqlite
        ? "TEXT DEFAULT NULL"
        : "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    ],
  ];

  try {
    let existing;
    if (sqlite) {
      const [rows] = await db.promise().query("PRAGMA table_info(wa_interactive_reminders)");
      existing = new Set((rows || []).map((r) => String(r.name).toLowerCase()));
    } else {
      const [rows] = await db.promise().query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
        ["wa_interactive_reminders"]
      );
      existing = new Set((rows || []).map((r) => String(r.column_name).toLowerCase()));
    }
    if (existing.size === 0) return; // table not created yet — leave it to the DDL

    for (const [col, def] of wanted) {
      if (existing.has(col)) continue;
      try {
        await db.promise().query(`ALTER TABLE wa_interactive_reminders ADD COLUMN ${col} ${def}`);
      } catch (_) {
        /* duplicate column / concurrent deploy — safe to ignore */
      }
    }
    reminderSchemaReady = true;
  } catch (err) {
    console.warn("[WA Reminder] Schema check skipped:", err.message);
  }
}

async function resolveScope(req) {  const { resolveTenantId } = require("../middleware/tenantMiddleware");
  let tenantId = Number(resolveTenantId(req)) || 0;
  if (!tenantId && req?.user?.id) {
    try {
      const { resolveTenantForUser } = require("./waConfigHelper");
      tenantId = await resolveTenantForUser(req.user.id);
    } catch (_) {
      tenantId = 0;
    }
  }
  if (!tenantId) {
    throw httpError(403, "No organization context for this reminder. Please select a workspace.");
  }

  const rawBranch = req?.body?.branch_id ?? req?.query?.branch_id ?? req?.headers?.["x-branch-id"];
  const branchId = Number(rawBranch);
  return {
    tenantId,
    branchId: Number.isFinite(branchId) && branchId > 0 ? branchId : null,
    userId: Number(req?.user?.id) || null,
  };
}

async function assertAssigneeInTenant(userId, tenantId) {
  const id = Number(userId);
  if (!id) return;
  const [rows] = await db.promise().query(
    `SELECT u.id FROM users u
     LEFT JOIN organization_memberships m ON m.user_id = u.id AND m.tenant_id = ?
     WHERE u.id = ? AND (u.tenant_id = ? OR m.tenant_id = ?) LIMIT 1`,
    [tenantId, id, tenantId, tenantId]
  );
  if (!rows || rows.length === 0) {
    throw httpError(400, "The selected assignee is not part of this workspace.");
  }
}

function parseOptions(payload) {
  if (!payload) return [];
  try {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function shapeReminder(row) {
  if (!row) return null;
  return {
    ...row,
    audience: row.audience === "staff" ? "staff" : "customer",
    repeat_rule: row.repeat_rule || "none",
    options: parseOptions(row.options_payload),
  };
}

async function getScopedReminder(id, tenantId) {
  await ensureReminderSchema();
  const [rows] = await db.promise().query(
    "SELECT * FROM wa_interactive_reminders WHERE id = ? AND tenant_id = ? LIMIT 1",
    [id, tenantId]
  );
  return rows && rows.length ? rows[0] : null;
}

async function createReminder(payload, scope, { sessionKey = null } = {}) {
  await ensureReminderSchema();
  const validation = validateReminderInput(payload);
  if (!validation.ok) throw httpError(400, validation.errors.join(" "));
  const value = validation.value;

  if (value.assignedUserId) await assertAssigneeInTenant(value.assignedUserId, scope.tenantId);

  const id = await createReminderRow({
    phone: value.phone,
    contactName: value.contactName,
    reminderType: value.reminderType,
    title: value.title,
    messageText: value.messageText,
    options: value.options,
    refTable: value.referenceTable,
    refId: value.referenceId,
    staffName: value.staffName,
    flowId: value.flowId,
    templateId: value.templateId,
    scheduledFor: value.scheduledFor,
    tenantId: scope.tenantId,
    branchId: value.branchId || scope.branchId,
    createdBy: scope.userId,
    source: value.source,
    audience: value.audience,
    repeatRule: value.repeatRule,
    repeatUntil: value.repeatUntil,
    assignedUserId: value.assignedUserId,
  });

  const row = await getScopedReminder(id, scope.tenantId);
  emitReminderEvent("create", row);
  return shapeReminder(row);
}

async function listForChat({ tenantId, phone, includePast = false, audience = null }) {
  await ensureReminderSchema();
  const normalized = normalizePhone(phone);
  if (!normalized) throw httpError(400, "A phone number is required.");

  const params = [tenantId, normalized, `%${normalized.slice(-10)}`];
  let sql = `SELECT id, phone, contact_name, reminder_type, title, message_text, options_payload,
                    status, scheduled_for, sent_at, audience, repeat_rule, repeat_until, parent_id,
                    source, assigned_user_id, assigned_staff_name, notes, created_at
             FROM wa_interactive_reminders
             WHERE tenant_id = ? AND (phone = ? OR phone LIKE ?) AND COALESCE(audience, 'customer') IN ('customer', 'staff')`;
  if (!includePast) {
    sql += " AND status = 'pending'";
  } else {
    sql += " AND (status = 'pending' OR (status IN ('sent', 'failed') AND COALESCE(sent_at, created_at) >= DATE_SUB(NOW(), INTERVAL 1 DAY)))";
  }
  if (audience === "customer" || audience === "staff") {
    sql += " AND COALESCE(audience, 'customer') = ?";
    params.push(audience);
  }
  sql += " ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, scheduled_for ASC LIMIT 100";

  const [rows] = await db.promise().query(sql, params);
  return (rows || []).map(shapeReminder);
}

async function updateReminder(id, patchInput, scope) {
  const existing = await getScopedReminder(id, scope.tenantId);
  if (!existing) throw httpError(404, "Reminder not found.");

  if (patchInput.status === "cancelled") {
    if (existing.status === "cancelled") return shapeReminder(existing);
    if (existing.status === "sent") throw httpError(409, "This reminder was already delivered.");
    await db.promise().query(
      "UPDATE wa_interactive_reminders SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND tenant_id = ?",
      [id, scope.tenantId]
    );
    const cancelled = await getScopedReminder(id, scope.tenantId);
    emitReminderEvent("cancel", cancelled);
    return shapeReminder(cancelled);
  }

  if (existing.status !== "pending") {
    throw httpError(409, "Only pending reminders can be edited. Cancel it and create a new one.");
  }

  const validation = validateReminderPatch(patchInput);
  if (!validation.ok) throw httpError(400, validation.errors.join(" "));
  const value = validation.value;

  if (value.assigned_user_id) await assertAssigneeInTenant(value.assigned_user_id, scope.tenantId);

  const nextRepeatRule = value.repeat_rule !== undefined ? value.repeat_rule : existing.repeat_rule || "none";
  const nextScheduled = value.scheduled_for || existing.scheduled_for;
  const nextUntil =
    value.repeat_until !== undefined ? value.repeat_until : existing.repeat_until || null;

  if (nextRepeatRule !== "none" && nextUntil) {
    const startMs = new Date(nextScheduled).getTime();
    const untilMs = new Date(nextUntil).getTime();
    if (Number.isFinite(untilMs) && Number.isFinite(startMs) && untilMs <= startMs) {
      throw httpError(400, "Repeat end date must be after the reminder time.");
    }
  }

  const sets = [];
  const params = [];
  const assignable = [
    "scheduled_for",
    "message_text",
    "title",
    "reminder_type",
    "contact_name",
    "flow_id",
    "audience",
    "repeat_rule",
    "repeat_until",
    "options_payload",
    "assigned_user_id",
  ];
  for (const field of assignable) {
    if (value[field] === undefined) continue;
    sets.push(`${field} = ?`);
    params.push(value[field]);
  }

  if (sets.length === 0) return shapeReminder(existing);

  sets.push("updated_at = NOW()");
  params.push(id, scope.tenantId);
  await db.promise().query(
    `UPDATE wa_interactive_reminders SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
    params
  );

  const updated = await getScopedReminder(id, scope.tenantId);
  emitReminderEvent("update", updated);
  return shapeReminder(updated);
}

async function cancelReminder(id, scope) {
  return updateReminder(id, { status: "cancelled" }, scope);
}

async function cloneNextOccurrence(row) {
  if (!row || !row.repeat_rule || row.repeat_rule === "none") return null;
  const now = new Date();
  let next = nextOccurrence(row.scheduled_for, row.repeat_rule);
  if (!next) return null;

  // Skip occurrences missed while the dispatcher was down instead of replaying
  // the whole backlog in one burst.
  let guard = 0;
  while (next.getTime() <= now.getTime() && guard < 400) {
    next = nextOccurrence(next, row.repeat_rule);
    guard += 1;
    if (!next) return null;
  }

  if (row.repeat_until) {
    const untilMs = new Date(row.repeat_until).getTime();
    if (Number.isFinite(untilMs) && next.getTime() > untilMs) return null;
  }

  const newId = await createReminderRow({
    phone: row.phone,
    contactName: row.contact_name,
    reminderType: row.reminder_type,
    title: row.title,
    messageText: row.message_text,
    options: parseOptions(row.options_payload),
    refTable: row.reference_table,
    refId: row.reference_id,
    staffName: row.assigned_staff_name,
    flowId: row.flow_id,
    templateId: row.template_id,
    scheduledFor: toSqlDateTime(next),
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    createdBy: row.created_by,
    source: row.source || "chat",
    audience: row.audience === "staff" ? "staff" : "customer",
    repeatRule: row.repeat_rule,
    repeatUntil: row.repeat_until,
    parentId: row.parent_id || row.id,
    assignedUserId: row.assigned_user_id,
  });

  const created = await getScopedReminder(newId, row.tenant_id);
  emitReminderEvent("repeat", created);
  return created;
}

async function sendNow(id, scope, { sessionKey = null } = {}) {
  const existing = await getScopedReminder(id, scope.tenantId);
  if (!existing) throw httpError(404, "Reminder not found.");
  if (existing.status === "sent") throw httpError(409, "This reminder was already delivered.");
  if (existing.status === "sending") throw httpError(409, "This reminder is being sent right now.");
  if (existing.status === "cancelled") throw httpError(409, "This reminder was cancelled.");

  const [claim] = await db.promise().query(
    "UPDATE wa_interactive_reminders SET status = 'sending' WHERE id = ? AND tenant_id = ? AND status = ?",
    [id, scope.tenantId, existing.status]
  );
  if (!claim || !claim.affectedRows) {
    throw httpError(409, "This reminder was already claimed by another worker.");
  }

  const result = await dispatchReminderRow(existing, { sessionKey });
  if (result.success) await cloneNextOccurrence(existing).catch(() => null);

  const updated = await getScopedReminder(id, scope.tenantId);
  emitReminderEvent("send-now", updated);
  return { result, reminder: shapeReminder(updated) };
}

let dueCheckRunning = false;

async function runDueReminderCheck({ limit = 50 } = {}) {
  if (dueCheckRunning) return { skipped: true, processed: 0 };
  dueCheckRunning = true;
  const summary = { skipped: false, scanned: 0, sent: 0, failed: 0, repeated: 0 };

  try {
    await ensureReminderSchema();
    // Recover rows a crashed worker left mid-send.
    await db.promise()
      .query(
        "UPDATE wa_interactive_reminders SET status = 'pending' WHERE status = 'sending' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)"
      )
      .catch(() => {});

    const [rows] = await db.promise().query(
      `SELECT * FROM wa_interactive_reminders
       WHERE status = 'pending' AND scheduled_for IS NOT NULL AND scheduled_for <= NOW()
       ORDER BY scheduled_for ASC LIMIT ?`,
      [limit]
    );

    summary.scanned = rows ? rows.length : 0;

    for (const row of rows || []) {
      const [claim] = await db.promise().query(
        "UPDATE wa_interactive_reminders SET status = 'sending' WHERE id = ? AND status = 'pending'",
        [row.id]
      );
      if (!claim || !claim.affectedRows) continue;

      const result = await dispatchReminderRow(row);
      if (result.success) {
        summary.sent += 1;
        try {
          const next = await cloneNextOccurrence(row);
          if (next) summary.repeated += 1;
        } catch (err) {
          console.warn(`[WA Reminder] Repeat clone failed for #${row.id}:`, err.message);
        }
      } else {
        summary.failed += 1;
      }
    }
  } catch (err) {
    console.error("[WA Reminder] Due dispatcher error:", err.message);
  } finally {
    dueCheckRunning = false;
  }

  return summary;
}

module.exports = {
  ensureReminderSchema,
  resolveScope,
  createReminder,
  listForChat,
  updateReminder,
  cancelReminder,
  sendNow,
  runDueReminderCheck,
  cloneNextOccurrence,
  parseOptions,
};
