import React, { useState } from "react";
import axios from "axios";
import {
  Ticket,
  Calendar,
  ShoppingBag,
  ShieldCheck,
  Bot,
  PauseCircle,
  PlayCircle,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
} from "lucide-react";

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (["confirmed", "resolved", "closed", "approved", "delivered", "paid", "completed", "sent"].includes(s)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["cancelled", "rejected", "escalated", "failed"].includes(s)) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function ChatCrmInterconnectPanel({
  API = "",
  selectedChat,
  crmDetails,
  crmDetailsLoading = false,
  activeFlowRun = null,
  botPaused = false,
  onRefreshCrm,
  onToggleBotPause,
  onOpenFlowModal,
  getAuthHeaders,
}) {
  const [quickMode, setQuickMode] = useState(null); // "ticket" | "appointment" | "approval" | null
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({
    subject: "",
    priority: "normal",
    service: "Consultation",
    date: new Date().toISOString().slice(0, 10),
    time: "11:00",
    item_name: "",
    amount: "",
    notes: "",
  });

  if (!selectedChat || selectedChat.isGroup) return null;

  const phone = (selectedChat.phoneNumber || selectedChat.phone || selectedChat.id || "").replace(/\D/g, "");
  const headers = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
  const actionUrl = selectedChat.conversationId
    ? `${API}/api/v2/inbox/conversations/${selectedChat.conversationId}/crm-action`
    : `${API}/api/whatsapp/contact-crm-action`;

  const submitQuickAction = async (action, payload) => {
    setBusy(true);
    setFeedback(null);
    try {
      const { data } = await axios.post(
        actionUrl,
        {
          phone,
          conversationId: selectedChat.conversationId || undefined,
          customerName: selectedChat.name || undefined,
          action,
          payload,
        },
        { headers }
      );
      setFeedback({ ok: true, text: data?.suggestedMessage || "CRM record updated." });
      setQuickMode(null);
      if (typeof onRefreshCrm === "function") await onRefreshCrm(selectedChat.id);
    } catch (err) {
      setFeedback({ ok: false, text: err.response?.data?.error || err.response?.data?.message || err.message || "Action failed" });
    } finally {
      setBusy(false);
    }
  };

  const handleQuickCreate = (e) => {
    e.preventDefault();
    if (quickMode === "ticket") {
      return submitQuickAction("create_ticket", {
        subject: form.subject || "WhatsApp Support Request",
        priority: form.priority,
        description: form.notes,
      });
    }
    if (quickMode === "appointment") {
      return submitQuickAction("create_appointment", {
        service: form.service || "Consultation",
        date: form.date,
        time: form.time,
        notes: form.notes,
      });
    }
    if (quickMode === "approval") {
      return submitQuickAction("create_approval", {
        item_name: form.item_name || "Special Discount",
        amount: Number(form.amount || 0),
        details: form.notes,
      });
    }
    return null;
  };

  const tickets = crmDetails?.tickets || [];
  const appointments = crmDetails?.appointments || [];
  const orders = crmDetails?.orders || [];
  const approvals = crmDetails?.approvals || [];
  const enquiries = crmDetails?.enquiries || [];
  const activity = crmDetails?.recentActivity || [];

  return (
    <div className="py-2.5 border-b border-[var(--color-rule)] space-y-3 text-xs">
      {/* Automation & Human Takeover Sync Bar */}
      <div className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Bot size={14} className={botPaused ? "text-amber-600 shrink-0" : "text-emerald-600 shrink-0"} />
            <span className="font-bold text-[11px] truncate text-[var(--color-ink)]">
              {activeFlowRun
                ? `Flow: ${activeFlowRun.flowName || "Active"}`
                : botPaused
                  ? "Human Takeover Active"
                  : "Bot & AI Standby"}
            </span>
          </div>
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
              botPaused ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {botPaused ? "Paused" : "Auto"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {typeof onToggleBotPause === "function" && (
            <button
              type="button"
              onClick={() => onToggleBotPause(!botPaused)}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper)] px-2 py-1 text-[11px] font-semibold text-[var(--color-ink-2)] hover:opacity-90"
            >
              {botPaused ? <PlayCircle size={12} /> : <PauseCircle size={12} />}
              {botPaused ? "Resume Bot" : "Pause Bot"}
            </button>
          )}
          {typeof onOpenFlowModal === "function" && (
            <button
              type="button"
              onClick={onOpenFlowModal}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-ink)] hover:opacity-90"
            >
              <Plus size={12} /> Start Flow
            </button>
          )}
        </div>
      </div>

      {/* 1-Click CRM Record Creation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="hl-section-label text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-2)]">
            10-System CRM Hub
          </h4>
          <div className="flex items-center gap-1">
            {[
              { id: "ticket", label: "+ Ticket" },
              { id: "appointment", label: "+ Booking" },
              { id: "approval", label: "+ Approval" },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setQuickMode((cur) => (cur === btn.id ? null : btn.id))}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border transition ${
                  quickMode === btn.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-[var(--color-paper)] text-[var(--color-ink-2)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2 ${
              feedback.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span className="truncate">{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)} className="text-[10px] underline shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {quickMode && (
          <form onSubmit={handleQuickCreate} className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)] space-y-2">
            {quickMode === "ticket" && (
              <>
                <input
                  type="text"
                  required
                  placeholder="Ticket subject *"
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  className="hl-input w-full px-2 py-1.5 text-[11px]"
                />
                <select
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                  className="hl-input w-full px-2 py-1.5 text-[11px]"
                >
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </>
            )}
            {quickMode === "appointment" && (
              <>
                <input
                  type="text"
                  required
                  placeholder="Service / Consultation *"
                  value={form.service}
                  onChange={(e) => setForm((p) => ({ ...p, service: e.target.value }))}
                  className="hl-input w-full px-2 py-1.5 text-[11px]"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className="hl-input px-2 py-1 text-[11px]"
                  />
                  <input
                    type="text"
                    placeholder="11:00"
                    value={form.time}
                    onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                    className="hl-input px-2 py-1 text-[11px]"
                  />
                </div>
              </>
            )}
            {quickMode === "approval" && (
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  required
                  placeholder="Item / Request *"
                  value={form.item_name}
                  onChange={(e) => setForm((p) => ({ ...p, item_name: e.target.value }))}
                  className="hl-input px-2 py-1 text-[11px]"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  className="hl-input px-2 py-1 text-[11px]"
                />
              </div>
            )}
            <input
              type="text"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="hl-input w-full px-2 py-1.5 text-[11px]"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
              >
                {busy && <Loader2 size={11} className="animate-spin" />} Save Record
              </button>
              <button
                type="button"
                onClick={() => setQuickMode(null)}
                className="rounded-lg border border-[var(--color-rule)] px-2.5 py-1.5 text-[11px]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {crmDetailsLoading ? (
          <div className="py-2 text-center">
            <Loader2 size={14} className="animate-spin mx-auto text-[var(--color-ink-2)]" />
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.length > 0 && (
              <div className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-[var(--color-ink-2)]">
                  <Ticket size={12} /> Support Tickets ({tickets.length})
                </div>
                {tickets.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-[11px] border-t border-[var(--color-rule)] pt-1">
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-[var(--color-ink)]">{t.ticket_no || `#${t.id}`} · {t.subject}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badgeClass(t.status)}`}>{t.status}</span>
                      {!["resolved", "closed"].includes(String(t.status)) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submitQuickAction("update_status", { recordType: "ticket", recordId: t.id, status: "resolved" })}
                          title="Mark resolved"
                          className="text-emerald-700 hover:underline text-[10px] font-semibold"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {appointments.length > 0 && (
              <div className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-[var(--color-ink-2)]">
                  <Calendar size={12} /> Appointments ({appointments.length})
                </div>
                {appointments.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-[11px] border-t border-[var(--color-rule)] pt-1">
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-[var(--color-ink)]">{a.service_name} ({a.slot_date} {a.slot_time})</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badgeClass(a.status)}`}>{a.status}</span>
                      {a.status === "held" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submitQuickAction("update_status", { recordType: "appointment", recordId: a.id, status: "confirmed" })}
                          className="text-emerald-700 hover:underline text-[10px] font-semibold"
                        >
                          Confirm
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {orders.length > 0 && (
              <div className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-[var(--color-ink-2)]">
                  <ShoppingBag size={12} /> Orders ({orders.length})
                </div>
                {orders.slice(0, 3).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-[11px] border-t border-[var(--color-rule)] pt-1">
                    <span className="font-semibold truncate text-[var(--color-ink)]">{o.order_no} · ₹{Number(o.total_amount || 0).toLocaleString()}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badgeClass(o.fulfillment_status)}`}>
                      {o.fulfillment_status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {approvals.length > 0 && (
              <div className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-[var(--color-ink-2)]">
                  <ShieldCheck size={12} /> Approvals ({approvals.length})
                </div>
                {approvals.slice(0, 3).map((ap) => (
                  <div key={ap.id} className="flex items-center justify-between gap-2 text-[11px] border-t border-[var(--color-rule)] pt-1">
                    <span className="truncate font-semibold text-[var(--color-ink)]">{ap.item_name || ap.request_type}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badgeClass(ap.status)}`}>{ap.status}</span>
                      {ap.status === "pending" && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => submitQuickAction("update_status", { recordType: "approval", recordId: ap.id, status: "approved" })}
                            title="Approve"
                            className="text-emerald-700"
                          >
                            <CheckCircle2 size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => submitQuickAction("update_status", { recordType: "approval", recordId: ap.id, status: "rejected" })}
                            title="Reject"
                            className="text-rose-600"
                          >
                            <XCircle size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {enquiries.length > 0 && (
              <div className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)] space-y-1">
                <div className="font-bold text-[11px] text-[var(--color-ink-2)]">Enquiries ({enquiries.length})</div>
                {enquiries.slice(0, 2).map((enq) => (
                  <div key={enq.id} className="flex items-center justify-between text-[11px]">
                    <span className="truncate">{enq.subject || enq.enquiry_type}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badgeClass(enq.status)}`}>{enq.status}</span>
                  </div>
                ))}
              </div>
            )}

            {activity.length > 0 && (
              <div className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-[var(--color-ink-2)]">
                  <Activity size={12} /> Recent Automation Activity ({activity.length})
                </div>
                {activity.slice(0, 3).map((act) => (
                  <div key={act.id} className="flex items-center justify-between text-[10px]">
                    <span className="truncate text-[var(--color-ink-2)]">{act.rule_name || `Rule #${act.automation_id}`}</span>
                    <span className={`rounded border px-1 py-0.2 text-[9px] ${badgeClass(act.status)}`}>{act.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
