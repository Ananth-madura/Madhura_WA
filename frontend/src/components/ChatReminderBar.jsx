import React, { useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Repeat,
  Send,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { formatReminderTime } from "../utils/reminderTime";

function repeatLabel(rule) {
  if (rule === "daily") return "Daily";
  if (rule === "weekly") return "Weekly";
  if (rule === "monthly") return "Monthly";
  return "";
}

export default function ChatReminderBar({
  reminders = [],
  loading = false,
  dueAlert = null,
  busyId = null,
  onSet,
  onManage,
  onSendNow,
  onCancel,
  onDismissDue,
  onSnoozeDue,
}) {
  const [expanded, setExpanded] = useState(false);

  const pending = (reminders || []).filter((reminder) => reminder.status === "pending");
  const next = pending[0];
  const hasContent = Boolean(dueAlert) || pending.length > 0;

  if (!hasContent && !loading) return null;

  return (
    <div className="shrink-0 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]">
      {dueAlert && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[var(--color-accent)]/15 border-b border-[var(--color-rule)]">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)]">
            <Bell size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[var(--color-ink)] truncate">
              {dueAlert.title || "Reminder due"}
            </p>
            <p className="text-[10px] text-[var(--color-ink-2)] truncate">
              {dueAlert.contactName || dueAlert.phone || "This conversation"}
              {dueAlert.message ? ` · ${dueAlert.message}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSnoozeDue?.(dueAlert)}
              className="hl-btn-secondary px-2 py-1 text-[10px] font-bold"
              title="Snooze this reminder for 15 minutes"
            >
              Snooze 15m
            </button>
            <button
              type="button"
              onClick={() => onDismissDue?.()}
              className="p-1 rounded text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
              aria-label="Dismiss reminder alert"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
          title="Scheduled reminders in this chat"
        >
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)]">
            <Bell size={13} />
            {pending.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] text-[9px] font-bold flex items-center justify-center">
                {pending.length > 9 ? "9+" : pending.length}
              </span>
            )}
          </span>
          {loading ? (
            <span className="text-[11px] text-[var(--color-ink-2)] flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> Checking reminders…
            </span>
          ) : pending.length > 0 ? (
            <span className="min-w-0 text-[11px] text-[var(--color-ink)]">
              <b className="font-bold">
                {pending.length} reminder{pending.length === 1 ? "" : "s"}
              </b>{" "}
              scheduled
              {next ? (
                <span className="text-[var(--color-ink-2)]"> · next {formatReminderTime(next.scheduled_for)}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--color-ink-2)]">No reminders scheduled</span>
          )}
          {expanded ? (
            <ChevronUp size={13} className="ml-auto shrink-0 text-[var(--color-ink-2)]" />
          ) : (
            <ChevronDown size={13} className="ml-auto shrink-0 text-[var(--color-ink-2)]" />
          )}
        </button>

        <button
          type="button"
          onClick={onSet}
          className="hl-btn-secondary flex items-center gap-1 px-2 py-1 text-[10px] font-bold shrink-0"
          title="Set a reminder for this chat"
        >
          <Plus size={11} /> New
        </button>
      </div>

      {expanded && pending.length > 0 && (
        <div className="max-h-56 overflow-y-auto wa-custom-scrollbar border-t border-[var(--color-rule)] px-2 sm:px-3 py-1.5 space-y-1.5">
          {reminders.map((reminder) => {
            const isPending = reminder.status === "pending";
            const busy = String(busyId) === String(reminder.id);
            return (
              <div
                key={reminder.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-2 py-1.5"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)]"
                  title={reminder.audience === "staff" ? "Private staff reminder" : "WhatsApp reminder"}
                >
                  {reminder.audience === "staff" ? <Users size={12} /> : <User size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[var(--color-ink)] truncate">
                    {reminder.title || "Reminder"}
                    {!isPending && (
                      <span className="ml-1.5 text-[9px] font-semibold uppercase text-[var(--color-ink-2)]">
                        {reminder.status}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-[var(--color-ink-2)] flex items-center gap-1.5 truncate">
                    <Clock size={10} className="shrink-0" />
                    {formatReminderTime(reminder.scheduled_for)}
                    {reminder.repeat_rule && reminder.repeat_rule !== "none" && (
                      <span className="inline-flex items-center gap-0.5 shrink-0">
                        <Repeat size={9} /> {repeatLabel(reminder.repeat_rule)}
                      </span>
                    )}
                    {reminder.audience === "staff" && (
                      <span className="shrink-0">· staff</span>
                    )}
                  </p>
                </div>
                {isPending && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSendNow?.(reminder)}
                      className="px-1.5 py-1 rounded text-[10px] font-bold text-[var(--color-ink)] hover:bg-[var(--color-paper)] disabled:opacity-50 inline-flex items-center gap-0.5"
                      title="Send this reminder now"
                    >
                      {busy ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Now
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onManage?.(reminder)}
                      className="p-1 rounded text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper)] disabled:opacity-50"
                      title="Edit or reschedule"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onCancel?.(reminder)}
                      className="p-1 rounded text-[var(--color-ink-2)] hover:text-[var(--color-error)] hover:bg-[var(--color-paper)] disabled:opacity-50"
                      title="Cancel reminder"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
