import { useEffect, useState, useCallback } from "react";
import { Save, Pause, Play, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function CampaignSettingsAdminPage({ mode = "settings" }) {
  const [settings, setSettings] = useState(null);
  const [agencyClients, setAgencyClients] = useState([]);
  const [clientForm, setClientForm] = useState({ client_tenant_id: "", client_name: "", brand_primary_color: "#059669" });
  const [ops, setOps] = useState(null);
  const [pauseForm, setPauseForm] = useState({ scope_type: "sender", scope_id: "", is_paused: true, reason: "Ops hold" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      if (mode === "settings") {
        const [s, clients] = await Promise.all([
          campaignApi.getSettings(),
          campaignApi.listAgencyClients().catch(() => []),
        ]);
        setSettings(s);
        setAgencyClients(Array.isArray(clients) ? clients : []);
      } else {
        const data = await campaignApi.getAdminOverview();
        setOps(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [mode]);

  useEffect(() => { load(); }, [load]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const saved = await campaignApi.saveSettings(settings);
      setSettings(saved);
      setNotice("Campaign governance settings saved.");
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleLinkClient = async (e) => {
    e.preventDefault();
    try {
      await campaignApi.linkAgencyClient({ ...clientForm, client_tenant_id: Number(clientForm.client_tenant_id) });
      setNotice("Linked isolated agency client tenant.");
      setClientForm({ client_tenant_id: "", client_name: "", brand_primary_color: "#059669" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDispatchControl = async (e) => {
    e.preventDefault();
    try {
      await campaignApi.setDispatchControl(pauseForm);
      setNotice(`Updated dispatch control for ${pauseForm.scope_type}:${pauseForm.scope_id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {mode === "settings" ? "Campaign Governance, Quiet Hours & Agency Settings" : "Platform Operations & Campaign Control Center (/admin/campaigns)"}
            </h1>
            <p className="text-sm text-slate-600">
              {mode === "settings"
                ? "Configure frequency caps, quiet hours, four-eyes approval thresholds, and isolated agency client tenants."
                : "Monitor active campaigns, queue depth, failed/DLQ jobs, reconciliation alerts, and emergency dispatch circuit-breakers."}
            </p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-medium">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><ShieldAlert className="w-4 h-4" />{error}</div>}
        {notice && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

        {mode === "settings" && settings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleSaveSettings} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Governance, Quiet Hours &amp; Frequency Controls</h2>
              <label className="inline-flex items-center gap-2 font-medium">
                <input type="checkbox" checked={Boolean(settings.quiet_hours_enabled)} onChange={(e) => setSettings({ ...settings, quiet_hours_enabled: e.target.checked ? 1 : 0 })} />
                <span>Enable Configurable Quiet Hours</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Quiet Start</label>
                  <input type="time" value={settings.quiet_hours_start || "21:00"} onChange={(e) => setSettings({ ...settings, quiet_hours_start: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Quiet End</label>
                  <input type="time" value={settings.quiet_hours_end || "09:00"} onChange={(e) => setSettings({ ...settings, quiet_hours_end: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Max msgs / contact (24h)</label>
                  <input type="number" value={settings.max_messages_per_contact_24h || 2} onChange={(e) => setSettings({ ...settings, max_messages_per_contact_24h: Number(e.target.value) })} className="w-full px-3 py-1.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Approval Recipient Threshold</label>
                  <input type="number" value={settings.approval_threshold_recipients || 1000} onChange={(e) => setSettings({ ...settings, approval_threshold_recipients: Number(e.target.value) })} className="w-full px-3 py-1.5 border rounded-lg" />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 font-medium">
                <input type="checkbox" checked={Boolean(settings.require_four_eyes_approval)} onChange={(e) => setSettings({ ...settings, require_four_eyes_approval: e.target.checked ? 1 : 0 })} />
                <span>Require Four-Eyes Maker-Checker Approval</span>
              </label>
              <div>
                <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold">
                  <Save className="w-4 h-4" /> Save Settings
                </button>
              </div>
            </form>

            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Agency Multi-Client Isolation</h2>
              <form onSubmit={handleLinkClient} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input required type="number" value={clientForm.client_tenant_id} onChange={(e) => setClientForm({ ...clientForm, client_tenant_id: e.target.value })} placeholder="Client Tenant ID" className="px-3 py-2 border rounded-lg" />
                <input required value={clientForm.client_name} onChange={(e) => setClientForm({ ...clientForm, client_name: e.target.value })} placeholder="Client Name" className="px-3 py-2 border rounded-lg" />
                <button type="submit" className="px-3 py-2 rounded-lg bg-slate-900 text-white font-semibold">Link Client</button>
              </form>
              <div className="space-y-2">
                {agencyClients.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-slate-50 border flex justify-between">
                    <span className="font-semibold">{c.client_name} (Tenant #{c.client_tenant_id})</span>
                    <span className="text-emerald-700 font-semibold">{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === "admin" && ops && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">Active / Scheduled</div><div className="text-2xl font-bold">{ops.active_campaigns?.length || 0}</div></div>
              <div className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">Failed / DLQ Jobs</div><div className="text-2xl font-bold text-rose-700">{ops.failed_and_dlq_jobs?.length || 0}</div></div>
              <div className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">Reconciliation Required</div><div className="text-2xl font-bold text-amber-700">{ops.reconciliation_required_count || 0}</div></div>
              <div className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">Active Paused Scopes</div><div className="text-2xl font-bold">{ops.paused_controls?.length || 0}</div></div>
            </div>

            <form onSubmit={handleDispatchControl} className="bg-white rounded-xl border p-5 flex flex-wrap gap-3 items-center text-xs">
              <span className="font-semibold text-slate-800">Emergency Dispatch Circuit-Breaker:</span>
              <select value={pauseForm.scope_type} onChange={(e) => setPauseForm({ ...pauseForm, scope_type: e.target.value })} className="px-3 py-2 border rounded-lg bg-white">
                <option value="sender">Sender ID</option>
                <option value="waba">WABA ID</option>
                <option value="tenant">Tenant ID</option>
              </select>
              <input required value={pauseForm.scope_id} onChange={(e) => setPauseForm({ ...pauseForm, scope_id: e.target.value })} placeholder="Target Scope ID" className="px-3 py-2 border rounded-lg" />
              <input value={pauseForm.reason} onChange={(e) => setPauseForm({ ...pauseForm, reason: e.target.value })} placeholder="Audit Reason" className="flex-1 min-w-[180px] px-3 py-2 border rounded-lg" />
              <button type="submit" onClick={() => setPauseForm((f) => ({ ...f, is_paused: true }))} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-600 text-white font-semibold"><Pause className="w-3.5 h-3.5" /> Pause</button>
              <button type="submit" onClick={() => setPauseForm((f) => ({ ...f, is_paused: false }))} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold"><Play className="w-3.5 h-3.5" /> Resume</button>
            </form>

            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold">Active Campaigns Across Platform</div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-600 uppercase">
                  <tr><th className="px-4 py-2">Tenant / Campaign</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Route</th><th className="px-4 py-2">Sub / Del / Fail</th><th className="px-4 py-2 text-right">Admin Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(ops.active_campaigns || []).map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-medium">Tenant #{c.tenant_id} · {c.name}</td>
                      <td className="px-4 py-2.5 font-semibold">{c.status}</td>
                      <td className="px-4 py-2.5">{c.provider_route}</td>
                      <td className="px-4 py-2.5">{c.submitted_count} / {c.delivered_count} / {c.failed_count}</td>
                      <td className="px-4 py-2.5 text-right space-x-2">
                        <button onClick={() => campaignApi.adminPauseCampaign(c.id, { tenant_id: c.tenant_id }).then(load)} className="text-amber-700 font-semibold hover:underline">Pause</button>
                        <button onClick={() => campaignApi.adminRetryFailed(c.id, { tenant_id: c.tenant_id }).then(load)} className="text-emerald-700 font-semibold hover:underline">Retry Failed</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
