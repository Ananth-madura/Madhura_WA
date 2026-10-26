import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Bell,
  Calendar,
  Clock,
  Loader2,
  MessageSquare,
  Repeat,
  Send,
  Users,
  X,
} from "lucide-react";
import { API } from "../config/api";
import { waUiStorage } from "../utils/waUiStorage";
import {
  formatReminderTime,
  parseReminderTime,
  quickReminderPresets,
  toDateTimeLocalValue,
  toReminderDate,
} from "../utils/reminderTime";
import {
  REMINDER_CATEGORIES,
  REMINDER_VARIABLES,
  REPEAT_OPTIONS,
  getReminderCategory,
} from "../utils/reminderPresets";

export function reminderPhoneForChat(chat) {
  if (!chat) return "";
  const raw =
    chat.phone ||
    chat.phoneNumber ||
    (chat.id && String(chat.id).includes("@") ? String(chat.id).split("@")[0] : chat.id) ||
    "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 8 ? digits : "";
}

function authHeaders() {
  const token = waUiStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function WAReminderSheet({
  open,
  onClose,
  chat,
  flows = [],
  teamMembers = [],
  reminder = null,
  initial = null,
  onSaved,
}) {
  const [audience, setAudience] = useState("customer");
  const [categoryId, setCategoryId] = useState("appointment_reminder");
  const [title, setTitle] = useState("Appointment reminder");
  const [message, setMessage] = useState("");
  const [optionsEnabled, setOptionsEnabled] = useState(true);
  const [options, setOptions] = useState([]);
  const [whenText, setWhenText] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => quickReminderPresets()[0].date);
  const [repeatRule, setRepeatRule] = useState("none");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [flowId, setFlowId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = Boolean(reminder?.id);
  const phone = reminderPhoneForChat(chat);

  useEffect(() => {
    if (!open) return;
    const preset = getReminderCategory(
      reminder?.reminder_type || initial?.category || "appointment_reminder"
    );
    setAudience(reminder?.audience || initial?.audience || "customer");
    setCategoryId(preset.id);
    setTitle(reminder?.title || preset.title);
    setMessage(reminder?.message_text || initial?.note || preset.text);
    const existingOptions = Array.isArray(reminder?.options) ? reminder.options : [];
    setOptionsEnabled(
      reminder ? existingOptions.length > 0 : preset.options.length > 0
    );
    setOptions(
      (existingOptions.length ? existingOptions : preset.options).map((option) => ({
        ...option,
      }))
    );
    setWhenText(initial?.timeText || "");
    setScheduledAt(
      toReminderDate(initial?.date) ||
        toReminderDate(reminder?.scheduled_for) ||
        quickReminderPresets()[0].date
    );
    setRepeatRule(reminder?.repeat_rule || "none");
    setRepeatUntil(
      reminder?.repeat_until ? toDateTimeLocalValue(reminder.repeat_until) : ""
    );
    setFlowId(reminder?.flow_id ? String(reminder.flow_id) : "");
    setAssignedUserId(
      reminder?.assigned_user_id ? String(reminder.assigned_user_id) : ""
    );
    setSaving(false);
    setError("");
  }, [open, reminder, initial]);

  const parsedFromText = useMemo(
    () => (whenText.trim() ? parseReminderTime(whenText) : null),
    [whenText]
  );

  useEffect(() => {
    if (parsedFromText) setScheduledAt(parsedFromText);
  }, [parsedFromText]);

  if (!open || !chat) return null;

  const chooseCategory = (categoryIdValue) => {
    const preset = getReminderCategory(categoryIdValue);
    setCategoryId(preset.id);
    setTitle(preset.title);
    setMessage(preset.text);
    setOptionsEnabled(preset.options.length > 0);
    setOptions(preset.options.map((option) => ({ ...option })));
  };

  const choosePreset = (preset) => {
    setScheduledAt(preset.date);
    setWhenText(preset.label);
    setError("");
  };

  const insertVariable = (token) => {
    setMessage((current) => `${current}${current.endsWith(" ") || !current ? "" : " "}${token}`);
  };

  const updateOptionLabel = (index, label) => {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, label } : option
      )
    );
  };

  const submit = async (sendNow = false) => {
    const finalDate = whenText.trim() ? parseReminderTime(whenText) : scheduledAt;
    if (!finalDate) {
      setError("I couldn't read that time. Try “tomorrow 10am” or pick a date below.");
      return;
    }
    if (finalDate.getTime() <= Date.now()) {
      setError("Pick a time in the future.");
      return;
    }
    if (!message.trim()) {
      setError(audience === "customer" ? "Write the message to send." : "Write the staff note.");
      return;
    }
    if (repeatRule !== "none" && repeatUntil) {
      const until = new Date(repeatUntil);
      if (Number.isNaN(until.getTime()) || until.getTime() <= finalDate.getTime()) {
        setError("The repeat end date must be after the first reminder.");
        return;
      }
    }
    if (!phone && audience === "customer") {
      setError("This chat has no phone number, so a WhatsApp reminder cannot be delivered.");
      return;
    }

    const payload = {
      phone: phone || reminder?.phone,
      contact_name: chat.name || null,
      reminder_type: categoryId,
      title: title.trim() || "Reminder",
      message_text: message.trim(),
      options: audience === "customer" && optionsEnabled ? options : [],
      scheduled_for: finalDate.toISOString(),
      audience,
      repeat_rule: repeatRule,
      repeat_until: repeatRule !== "none" && repeatUntil ? new Date(repeatUntil).toISOString() : null,
      flow_id: audience === "customer" && flowId ? Number(flowId) : null,
      assigned_user_id: audience === "staff" && assignedUserId ? Number(assignedUserId) : null,
      branch_id: chat.branch_id || null,
      source: "chat",
    };

    setSaving(true);
    setError("");
    try {
      if (isEditing) {
        await axios.patch(`${API}/api/wa/reminders/${reminder.id}`, payload, {
          headers: authHeaders(),
        });
        if (sendNow) {
          await axios.post(
            `${API}/api/wa/reminders/${reminder.id}/send-now`,
            {},
            { headers: authHeaders() }
          );
        }
        onSaved?.({ ...reminder, ...payload }, { sentNow: sendNow, edited: true });
      } else {
        const { data } = await axios.post(
          `${API}/api/wa/reminders`,
          { ...payload, send_now: sendNow },
          { headers: authHeaders() }
        );
        onSaved?.(data.reminder, { sentNow: sendNow, edited: false, result: data.result });
      }
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not save the reminder.");
    } finally {
      setSaving(false);
    }
  };

  const presets = quickReminderPresets();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Set a reminder"
    >
      <div className="hl-card w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto wa-custom-scrollbar rounded-t-2xl sm:rounded-2xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-rule)] pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)]">
              <Bell size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="hl-title text-base">
                {isEditing ? "Edit reminder" : "Set a reminder"}
              </h3>
              <p className="hl-subtitle text-xs truncate">
                {chat.name || "This chat"}
                {phone ? ` · +${phone}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 space-y-4">
          {/* Audience */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)]">
            <button
              type="button"
              onClick={() => setAudience("customer")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                audience === "customer"
                  ? "bg-[var(--color-ink)] text-[var(--color-paper-2)]"
                  : "text-[var(--color-ink-2)]"
              }`}
            >
              <MessageSquare size={14} /> WhatsApp the customer
            </button>
            <button
              type="button"
              onClick={() => setAudience("staff")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                audience === "staff"
                  ? "bg-[var(--color-ink)] text-[var(--color-paper-2)]"
                  : "text-[var(--color-ink-2)]"
              }`}
            >
              <Users size={14} /> Remind staff privately
            </button>
          </div>

          {/* When */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="hl-section-label text-[10px] uppercase font-bold text-[var(--color-ink-2)]">
                When
              </span>
              <span className="text-[11px] font-semibold text-[var(--color-ink)]">
                {formatReminderTime(scheduledAt)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => choosePreset(preset)}
                  className="px-2.5 py-1 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[11px] font-semibold hover:border-[var(--color-ink)] transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Clock size={14} className="absolute left-2.5 top-2.5 text-[var(--color-ink-2)]" />
                <input
                  type="text"
                  value={whenText}
                  onChange={(event) => {
                    setWhenText(event.target.value);
                    setError("");
                  }}
                  placeholder="e.g. tomorrow 10am, in 2 days, 25 Oct 5pm"
                  className="hl-input w-full pl-8 pr-2 py-2 text-xs"
                  aria-label="Natural language reminder time"
                />
              </div>
              <div className="relative">
                <Calendar size={14} className="absolute left-2.5 top-2.5 text-[var(--color-ink-2)]" />
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(scheduledAt)}
                  onChange={(event) => {
                    setWhenText("");
                    const next = event.target.value ? new Date(event.target.value) : null;
                    if (next && !Number.isNaN(next.getTime())) setScheduledAt(next);
                    setError("");
                  }}
                  className="hl-input w-full pl-8 pr-2 py-2 text-xs"
                  aria-label="Pick reminder date and time"
                />
              </div>
            </div>
            {whenText.trim() && !parsedFromText && (
              <p className="text-[11px] text-[var(--color-error)] mt-1">
                Time not recognised — the picker value will be used.
              </p>
            )}
          </div>

          {/* What */}
          {audience === "customer" && (
            <div>
              <span className="hl-section-label text-[10px] uppercase font-bold text-[var(--color-ink-2)]">
                Message type
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                {REMINDER_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => chooseCategory(category.id)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition ${
                      categoryId === category.id
                        ? "bg-[var(--color-ink)] text-[var(--color-paper-2)] border-[var(--color-ink)]"
                        : "bg-[var(--color-paper-2)] border-[var(--color-rule)]"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="hl-section-label text-[10px] uppercase font-bold text-[var(--color-ink-2)]">
                {audience === "customer" ? "Message" : "Staff note"}
              </span>
              <span className="text-[10px] text-[var(--color-ink-2)]">{message.length}/1024</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Reminder title"
              className="hl-input w-full px-2.5 py-1.5 text-xs mb-1.5"
              aria-label="Reminder title"
            />
            <textarea
              rows={3}
              value={message}
              maxLength={1024}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                audience === "customer"
                  ? "Write the WhatsApp message…"
                  : "What should the team remember?"
              }
              className="hl-input w-full px-2.5 py-2 text-xs leading-relaxed"
            />
            {audience === "customer" && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <span className="text-[10px] text-[var(--color-ink-2)] mr-0.5">Insert:</span>
                {REMINDER_VARIABLES.map((variable) => (
                  <button
                    key={variable.token}
                    type="button"
                    onClick={() => insertVariable(variable.token)}
                    className="px-1.5 py-0.5 rounded border border-[var(--color-rule)] text-[10px] font-mono hover:border-[var(--color-ink)]"
                  >
                    {variable.token}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply buttons */}
          {audience === "customer" && (
            <div>
              <label className="flex items-center justify-between gap-2 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={13} /> Reply buttons
                </span>
                <input
                  type="checkbox"
                  checked={optionsEnabled}
                  onChange={(event) => setOptionsEnabled(event.target.checked)}
                  className="h-4 w-4 accent-[var(--color-ink)]"
                />
              </label>
              {optionsEnabled && (
                <div className="grid gap-1.5 mt-2">
                  {options.slice(0, 3).map((option, index) => (
                    <input
                      key={option.id || index}
                      type="text"
                      value={option.label}
                      maxLength={20}
                      onChange={(event) => updateOptionLabel(index, event.target.value)}
                      className="hl-input w-full px-2.5 py-1 text-xs"
                      aria-label={`Reply button ${index + 1}`}
                      placeholder={`Button ${index + 1}`}
                    />
                  ))}
                  {options.length === 0 && (
                    <p className="text-[11px] text-[var(--color-ink-2)]">
                      No buttons for this category. The message will be sent as plain text.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Repeat */}
          <div>
            <span className="hl-section-label text-[10px] uppercase font-bold text-[var(--color-ink-2)] flex items-center gap-1.5">
              <Repeat size={12} /> Repeat
            </span>
            <div className="grid gap-2 sm:grid-cols-2 mt-1.5">
              <select
                value={repeatRule}
                onChange={(event) => setRepeatRule(event.target.value)}
                className="hl-input w-full px-2.5 py-2 text-xs"
                aria-label="Repeat rule"
              >
                {REPEAT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {repeatRule !== "none" && (
                <input
                  type="date"
                  value={repeatUntil}
                  onChange={(event) => setRepeatUntil(event.target.value)}
                  className="hl-input w-full px-2.5 py-2 text-xs"
                  aria-label="Repeat until"
                  title="Stop repeating after this date"
                />
              )}
            </div>
          </div>

          {/* Extras */}
          <div className="grid gap-2 sm:grid-cols-2">
            {audience === "customer" && flows.length > 0 && (
              <label className="text-[11px] font-semibold">
                Start flow on reply
                <select
                  value={flowId}
                  onChange={(event) => setFlowId(event.target.value)}
                  className="hl-input w-full px-2.5 py-2 text-xs mt-1"
                >
                  <option value="">No flow</option>
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                      {flow.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {audience === "staff" && teamMembers.length > 0 && (
              <label className="text-[11px] font-semibold">
                Assign to
                <select
                  value={assignedUserId}
                  onChange={(event) => setAssignedUserId(event.target.value)}
                  className="hl-input w-full px-2.5 py-2 text-xs mt-1"
                >
                  <option value="">Admins</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {`${member.first_name || ""} ${member.last_name || ""}`.trim() ||
                        member.email ||
                        `User ${member.id}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-3 py-2 text-[11px] font-semibold text-[var(--color-error)]">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-rule)] mt-4 pt-3">
          <button type="button" onClick={onClose} className="hl-btn-secondary px-3 py-2 text-xs font-bold">
            Cancel
          </button>
          {!isEditing && (
            <button
              type="button"
              disabled={saving}
              onClick={() => submit(true)}
              className="hl-btn-secondary px-3 py-2 text-xs font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send now
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(false)}
            className="hl-btn-primary px-3.5 py-2 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
            {isEditing ? "Save changes" : "Schedule reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}
