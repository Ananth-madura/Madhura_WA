"use strict";
/**
 * waQuickReminderRules.js
 *
 * Pure validation helpers for chat-native reminders. Kept free of database and
 * transport imports so the rules can be unit-tested in isolation.
 */

const AUDIENCES = new Set(["customer", "staff"]);
const REPEAT_RULES = new Set(["none", "daily", "weekly", "monthly"]);
const REPEAT_UNITS = { daily: "DAY", weekly: "WEEK", monthly: "MONTH" };

const MAX_MESSAGE_LENGTH = 1024;
const MAX_TITLE_LENGTH = 255;
const MAX_OPTIONS = 3;
const MAX_OPTION_LABEL = 20;
const MAX_REMINDER_DAYS_AHEAD = 366;

function normalizePhone(phone) {
  if (phone === null || phone === undefined) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits;
}

function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  return normalized.length >= 8 && normalized.length <= 15;
}

/** Formats a Date (or parseable value) as MySQL/SQLite DATETIME in server-local time. */
function toSqlDateTime(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function sanitizeOptions(options) {
  if (!Array.isArray(options)) return [];
  const seen = new Set();
  const cleaned = [];
  for (const option of options) {
    if (!option) continue;
    const label = String(option.label || option.title || "").trim().slice(0, MAX_OPTION_LABEL);
    if (!label) continue;
    let id = String(option.id || "").trim();
    if (!id) id = `btn_${cleaned.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const action = String(option.action || option.value || id).trim().slice(0, 50);
    cleaned.push({ id, label, action });
    if (cleaned.length >= MAX_OPTIONS) break;
  }
  return cleaned;
}

function clampInt(value, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.trunc(n);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

/**
 * Validates a create payload.
 * @returns {{ok: boolean, errors: string[], value: object|null}}
 */
function validateReminderInput(input = {}, { now = new Date(), requireFuture = true } = {}) {
  const errors = [];
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) errors.push("A valid WhatsApp phone number is required.");

  const audience = AUDIENCES.has(input.audience) ? input.audience : "customer";

  const repeatRule = REPEAT_RULES.has(input.repeat_rule) ? input.repeat_rule : "none";
  const repeatUntilRaw = input.repeat_until || null;

  const scheduledRaw = input.scheduled_for || input.scheduledFor || null;
  const scheduledDate = scheduledRaw ? new Date(scheduledRaw) : null;
  if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
    errors.push("A valid reminder time is required.");
  } else {
    const skewMs = 60 * 1000;
    if (requireFuture && scheduledDate.getTime() < now.getTime() - skewMs) {
      errors.push("Reminder time must be in the future.");
    }
    const maxAhead = now.getTime() + MAX_REMINDER_DAYS_AHEAD * 24 * 60 * 60 * 1000;
    if (scheduledDate.getTime() > maxAhead) {
      errors.push("Reminder time cannot be more than a year ahead.");
    }
  }

  let repeatUntilDate = null;
  if (repeatRule !== "none" && repeatUntilRaw) {
    repeatUntilDate = new Date(repeatUntilRaw);
    if (Number.isNaN(repeatUntilDate.getTime())) {
      errors.push("Repeat end date is invalid.");
      repeatUntilDate = null;
    } else if (scheduledDate && repeatUntilDate.getTime() <= scheduledDate.getTime()) {
      errors.push("Repeat end date must be after the first reminder.");
    }
  }

  const rawMessage = String(input.message_text || input.messageText || "").trim();
  if (!rawMessage) errors.push("Reminder message cannot be empty.");
  if (rawMessage.length > MAX_MESSAGE_LENGTH) {
    errors.push(`Reminder message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`);
  }

  const title = String(input.title || "").trim().slice(0, MAX_TITLE_LENGTH) || "Reminder";

  const options = audience === "customer" ? sanitizeOptions(input.options) : [];

  const assignedUserId =
    input.assigned_user_id !== undefined && input.assigned_user_id !== null
      ? clampInt(input.assigned_user_id)
      : null;

  const branchId =
    input.branch_id !== undefined && input.branch_id !== null ? clampInt(input.branch_id) : null;

  if (errors.length) return { ok: false, errors, value: null };

  return {
    ok: true,
    errors: [],
    value: {
      phone,
      contactName: input.contact_name || input.contactName || null,
      reminderType: String(input.reminder_type || "custom_reminder").slice(0, 50),
      title,
      messageText: rawMessage,
      options,
      referenceTable: input.reference_table || null,
      referenceId: clampInt(input.reference_id),
      staffName: input.assigned_staff_name || input.staffName || null,
      flowId: clampInt(input.flow_id),
      templateId: clampInt(input.template_id),
      scheduledFor: toSqlDateTime(scheduledDate),
      scheduledAt: scheduledDate,
      repeatRule,
      repeatUntil: repeatUntilDate ? toSqlDateTime(repeatUntilDate) : null,
      audience,
      assignedUserId,
      branchId,
      source: String(input.source || "chat").slice(0, 32),
    },
  };
}

/**
 * Validates an edit payload. Only the fields present are returned.
 */
function validateReminderPatch(input = {}, { now = new Date() } = {}) {
  const errors = [];
  const patch = {};

  if (input.scheduled_for !== undefined || input.scheduledFor !== undefined) {
    const raw = input.scheduled_for ?? input.scheduledFor;
    const date = raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) {
      errors.push("A valid reminder time is required.");
    } else if (date.getTime() < now.getTime() - 60 * 1000) {
      errors.push("Reminder time must be in the future.");
    } else {
      patch.scheduled_for = toSqlDateTime(date);
      patch._scheduledDate = date;
    }
  }

  if (input.message_text !== undefined || input.messageText !== undefined) {
    const text = String(input.message_text ?? input.messageText).trim();
    if (!text) errors.push("Reminder message cannot be empty.");
    else if (text.length > MAX_MESSAGE_LENGTH) {
      errors.push(`Reminder message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`);
    } else {
      patch.message_text = text;
    }
  }

  if (input.title !== undefined) {
    const title = String(input.title).trim();
    if (!title) errors.push("Reminder title cannot be empty.");
    else patch.title = title.slice(0, MAX_TITLE_LENGTH);
  }

  if (input.audience !== undefined) {
    if (!AUDIENCES.has(input.audience)) errors.push("Reminder audience is invalid.");
    else patch.audience = input.audience;
  }

  // Category, flow and label are editable from the same sheet that creates the
  // reminder. Ignoring them here would make an edit look saved while the stored
  // row kept the old values.
  if (input.reminder_type !== undefined) {
    const type = String(input.reminder_type).trim();
    if (!type) errors.push("Reminder type cannot be empty.");
    else patch.reminder_type = type.slice(0, 50);
  }

  if (input.flow_id !== undefined) {
    patch.flow_id =
      input.flow_id === null || input.flow_id === "" ? null : clampInt(input.flow_id);
  }

  if (input.contact_name !== undefined) {
    patch.contact_name = input.contact_name ? String(input.contact_name).slice(0, 255) : null;
  }

  if (input.repeat_rule !== undefined) {
    if (!REPEAT_RULES.has(input.repeat_rule)) errors.push("Repeat rule is invalid.");
    else patch.repeat_rule = input.repeat_rule;
  }

  if (input.repeat_until !== undefined) {
    if (!input.repeat_until) patch.repeat_until = null;
    else {
      const date = new Date(input.repeat_until);
      if (Number.isNaN(date.getTime())) errors.push("Repeat end date is invalid.");
      else patch.repeat_until = toSqlDateTime(date);
    }
  }

  if (input.options !== undefined) {
    patch.options_payload = JSON.stringify(sanitizeOptions(input.options));
  }

  if (input.assigned_user_id !== undefined) {
    patch.assigned_user_id =
      input.assigned_user_id === null ? null : clampInt(input.assigned_user_id);
  }

  if (errors.length) return { ok: false, errors, value: null };
  return { ok: true, errors: [], value: patch };
}

/**
 * Next occurrence in server-local time. Month-end dates clamp to the last day
 * of the following month (31 Jan -> 28/29 Feb) instead of overflowing.
 */
function nextOccurrence(date, rule) {
  const current = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (Number.isNaN(current.getTime())) return null;
  if (rule === "daily") {
    current.setDate(current.getDate() + 1);
    return current;
  }
  if (rule === "weekly") {
    current.setDate(current.getDate() + 7);
    return current;
  }
  if (rule === "monthly") {
    const day = current.getDate();
    current.setDate(1);
    current.setMonth(current.getMonth() + 1);
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    current.setDate(Math.min(day, lastDay));
    return current;
  }
  return null;
}

module.exports = {
  AUDIENCES,
  REPEAT_RULES,
  REPEAT_UNITS,
  nextOccurrence,
  MAX_MESSAGE_LENGTH,
  MAX_OPTIONS,
  MAX_OPTION_LABEL,
  normalizePhone,
  isValidPhone,
  toSqlDateTime,
  sanitizeOptions,
  validateReminderInput,
  validateReminderPatch,
};
