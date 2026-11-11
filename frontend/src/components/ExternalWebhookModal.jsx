import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Webhook, X, CheckCircle2, AlertCircle, Send, RefreshCw } from "lucide-react";

const EVENT_OPTIONS = [
  "message.received",
  "message.sent",
  "message.status",
  "contact.opted_out",
  "crm.new_lead",
  "crm.ticket_created",
  "crm.ticket_closed",
  "crm.appointment_booked",
  "crm.appointment_cancelled",
  "crm.invoice_created",
  "crm.invoice_due",
  "crm.payment_received",
  "crm.approval_requested",
  "crm.record_updated",
];

export default function ExternalWebhookModal({ open, onClose, apiBase, authHeaders }) {
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const headers = typeof authHeaders === "function" ? authHeaders() : authHeaders || {};
      const [cfgRes, delRes] = await Promise.all([
        axios.get(`${apiBase}/api/crm/webhook`, { headers }),
        axios.get(`${apiBase}/api/crm/webhook/deliveries`, { headers }),
      ]);
      const wh = cfgRes.data?.webhook;
      if (wh) {
        setUrl(wh.webhook_url || "");
        setHasSecret(Boolean(wh.has_secret));
        setIsActive(wh.is_active !== false);
        setSelectedEvents(Array.isArray(wh.subscribed_events) ? wh.subscribed_events : []);
      }
      setDeliveries(Array.isArray(delRes.data?.deliveries) ? delRes.data.deliveries : []);
    } catch (err) {
      setNotice({ ok: false, text: err.response?.data?.error || "Could not load external webhook settings" });
    } finally {
      setLoading(false);
    }
  }, [open, apiBase, authHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!open) return null;

  const toggleEvent = (evt) => {
    setSelectedEvents((prev) => (prev.includes(evt) ? prev.filter((x) => x !== evt) : [...prev, evt]));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const headers = typeof authHeaders === "function" ? authHeaders() : authHeaders || {};
      const { data } = await axios.post(
        `${apiBase}/api/crm/webhook/configure`,
        {
          webhookUrl: url.trim(),
          secret: secret.trim() || undefined,
          events: selectedEvents,
          isActive,
        },
        { headers }
      );
      setHasSecret(Boolean(data?.webhook?.has_secret || secret.trim() || hasSecret));
      setSecret("");
      setNotice({ ok: true, text: "External CRM/ERP webhook saved." });
    } catch (err) {
      setNotice({ ok: false, text: err.response?.data?.error || err.message || "Failed to save webhook" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const headers = typeof authHeaders === "function" ? authHeaders() : authHeaders || {};
      const { data } = await axios.post(
        `${apiBase}/api/crm/webhook/test`,
        { webhookUrl: url.trim() || undefined, secret: secret.trim() || undefined },
        { headers }
      );
      setNotice({
        ok: Boolean(data?.success),
        text: data?.success ? "Test ping delivered successfully." : `Test ping failed (HTTP ${data?.result?.status || "error"})`,
      });
      await loadData();
    } catch (err) {
      setNotice({ ok: false, text: err.response?.data?.error || err.message || "Test ping failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="External CRM Webhook Bridge">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-slate-800" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Real-World App / ERP Webhook Bridge</h3>
              <p className="text-[11px] text-slate-500">
                Receive signed WhatsApp chat, CRM record & delivery events at your external endpoint.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {notice && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {notice.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{notice.text}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Webhook Endpoint URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-erp.example.com/webhooks/whatsapp-crm"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  HMAC-SHA256 Secret {hasSecret ? "(stored — leave blank to keep)" : ""}
                </label>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Enter signing secret"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Enable outbound delivery
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Subscribed Events (leave unchecked for all events)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_OPTIONS.map((evt) => {
                  const active = selectedEvents.includes(evt);
                  return (
                    <button
                      key={evt}
                      type="button"
                      onClick={() => toggleEvent(evt)}
                      className={`rounded-md border px-2 py-1 text-[10px] font-mono transition ${
                        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {evt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Webhook"}
              </button>
              <button
                type="button"
                disabled={testing || !url.trim()}
                onClick={handleTest}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> {testing ? "Sending..." : "Send Test Ping"}
              </button>
            </div>
          </form>

          <div className="border-t border-slate-200 pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900">Recent Delivery Logs</h4>
              <button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
            {deliveries.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                No external webhook deliveries recorded yet.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-1.5">
                {deliveries.map((d, i) => (
                  <div key={d.id || i} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px]">
                    <div className="min-w-0">
                      <span className="font-mono font-semibold text-slate-800">{d.event}</span>
                      <span className="ml-2 text-slate-500 truncate">{d.url}</span>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${d.status === "delivered" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
