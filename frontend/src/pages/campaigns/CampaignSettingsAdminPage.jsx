import { useEffect, useState, useCallback } from "react";
import { Save, Pause, Play, RefreshCw, ShieldAlert, CheckCircle2, Settings, Activity } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function CampaignSettingsAdminPage({ mode = "settings" }) {
  const [settings, setSettings] = useState(null);
  const [agencyClients, setAgencyClients] = useState([]);
  const [clientForm, setClientForm] = useState({ client_tenant_id: "", client_name: "", brand_primary_color: "#202C52" });
  const [ops, setOps] = useState(null);
  const [pauseForm, setPauseForm] = useState({ scope_type: "sender", scope_id: "", is_paused: true, reason: "Ops hold" });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
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
      setError(err.response?.data?.error || err.message || "Could not load configuration.");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { load(); }, [load]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
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
    setError("");
    setNotice("");
    try {
      await campaignApi.linkAgencyClient({ ...clientForm, client_tenant_id: Number(clientForm.client_tenant_id) });
      setNotice("Linked isolated agency client tenant.");
      setClientForm({ client_tenant_id: "", client_name: "", brand_primary_color: "#202C52" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDispatchControl = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await campaignApi.setDispatchControl(pauseForm);
      setNotice(`Updated dispatch control for ${pauseForm.scope_type}:${pauseForm.scope_id}.`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      {/* Native /whatsapp Command Bar */}
      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            {mode === "settings" ? <Settings size={22} /> : <Activity size={22} />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">
                {mode === "settings" ? "Campaign Governance & Agency Settings" : "Platform Operations & Dispatch Control"}
              </h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                {mode === "settings" ? "Admin Policy" : "Ops Control"}
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              {mode === "settings"
                ? "Configure quiet hours, contact frequency caps, four-eyes approval thresholds, and isolated agency client tenants."
                : "Monitor active campaigns platform-wide, failed/DLQ jobs, reconciliation alerts, and emergency circuit-breakers."}
            </p>
          </div>
        </div>

        <button type="button" onClick={load} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg text-xs font-medium flex items-center gap-2" style={{ background: "#FEE4E2", border: "1px solid #FDA29B", color: "#B42318" }}>
          <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-lg text-xs font-medium flex items-center gap-2" style={{ background: "#D1FADF", border: "1px solid #A6F4C5", color: "#16803C" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {mode === "settings" && settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form onSubmit={handleSaveSettings} className="hl-card p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold m-0" style={{ color: "#202C52" }}>Quiet Hours, Frequency Caps &amp; Approval Policy</h2>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer" style={{ color: "#202C52" }}>
              <input
                type="checkbox"
                checked={Boolean(settings.quiet_hours_enabled)}
                onChange={(e) => setSettings({ ...settings, quiet_hours_enabled: e.target.checked ? 1 : 0 })}
              />
              <span>Enable Configurable Quiet Hours</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="qh-start" className="block font-semibold mb-1" style={{ color: "#202C52" }}>Quiet Start</label>
                <input id="qh-start" type="time" value={settings.quiet_hours_start || "21:00"} onChange={(e) => setSettings({ ...settings, quiet_hours_start: e.target.value })} className="hl-input w-full px-3 py-2" />
              </div>
              <div>
                <label htmlFor="qh-end" className="block font-semibold mb-1" style={{ color: "#202C52" }}>Quiet End</label>
                <input id="qh-end" type="time" value={settings.quiet_hours_end || "09:00"} onChange={(e) => setSettings({ ...settings, quiet_hours_end: e.target.value })} className="hl-input w-full px-3 py-2" />
              </div>
              <div>
                <label htmlFor="freq-cap" className="block font-semibold mb-1" style={{ color: "#202C52" }}>Max messages / contact (24h)</label>
                <input id="freq-cap" type="number" value={settings.max_messages_per_contact_24h || 2} onChange={(e) => setSettings({ ...settings, max_messages_per_contact_24h: Number(e.target.value) })} className="hl-input w-full px-3 py-2" />
              </div>
              <div>
                <label htmlFor="appr-thresh" className="block font-semibold mb-1" style={{ color: "#202C52" }}>Approval Recipient Threshold</label>
                <input id="appr-thresh" type="number" value={settings.approval_threshold_recipients || 1000} onChange={(e) => setSettings({ ...settings, approval_threshold_recipients: Number(e.target.value) })} className="hl-input w-full px-3 py-2" />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer" style={{ color: "#202C52" }}>
              <input
                type="checkbox"
                checked={Boolean(settings.require_four_eyes_approval)}
                onChange={(e) => setSettings({ ...settings, require_four_eyes_approval: e.target.checked ? 1 : 0 })}
              />
              <span>Require Four-Eyes Maker-Checker Approval</span>
            </label>
            <div>
              <button type="submit" className="hl-btn-primary inline-flex items-center gap-1.5 px-4 font-semibold cursor-pointer">
                <Save className="w-4 h-4" /> Save Governance Settings
              </button>
            </div>
          </form>

          <div className="hl-card p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold m-0" style={{ color: "#202C52" }}>Agency Multi-Client Isolation</h2>
            <p className="m-0" style={{ color: "#667085" }}>
              Link authorized client tenants to operate isolated client campaigns without mixing contacts, templates, senders, or billing.
            </p>
            <form onSubmit={handleLinkClient} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <input required type="number" value={clientForm.client_tenant_id} onChange={(e) => setClientForm({ ...clientForm, client_tenant_id: e.target.value })} placeholder="Client Tenant ID" className="hl-input px-3 py-2" />
              <input required value={clientForm.client_name} onChange={(e) => setClientForm({ ...clientForm, client_name: e.target.value })} placeholder="Client Name" className="hl-input px-3 py-2" />
              <button type="submit" className="hl-btn-primary px-3 font-semibold cursor-pointer">Link Client</button>
            </form>
            <div className="space-y-2">
              {agencyClients.length === 0 ? (
                <div style={{ color: "#667085" }}>No agency client tenants linked yet.</div>
              ) : agencyClients.map((c) => (
                <div key={c.id} className="p-2.5 rounded-lg border flex justify-between items-center" style={{ background: "#FAFAFA", borderColor: "#E4E7ED" }}>
                  <span className="font-bold" style={{ color: "#202C52" }}>{c.client_name} (Tenant #{c.client_tenant_id})</span>
                  <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#D1FADF", color: "#16803C" }}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === "admin" && ops && (
        <div className="space-y-4">
          <div className="hl-kpis">
            {[
              { label: "Active / Scheduled", value: ops.active_campaigns?.length || 0, color: "#202C52" },
              { label: "Failed / DLQ Jobs", value: ops.failed_and_dlq_jobs?.length || 0, color: "#B42318" },
              { label: "Reconciliation Required", value: ops.reconciliation_required_count || 0, color: "#92400E" },
              { label: "Active Paused Scopes", value: ops.paused_controls?.length || 0, color: "#202C52" },
            ].map((k) => (
              <div key={k.label} className="hl-kpi">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#667085" }}>{k.label}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: k.color, fontFamily: "var(--font-display)" }}>{k.value}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleDispatchControl} className="hl-card p-5 flex flex-wrap gap-3 items-center text-xs">
            <span className="font-bold" style={{ color: "#202C52" }}>Emergency Dispatch Circuit-Breaker:</span>
            <select value={pauseForm.scope_type} onChange={(e) => setPauseForm({ ...pauseForm, scope_type: e.target.value })} className="hl-select px-3 py-2 bg-white cursor-pointer">
              <option value="sender">Sender ID</option>
              <option value="waba">WABA ID</option>
              <option value="tenant">Tenant ID</option>
            </select>
            <input required value={pauseForm.scope_id} onChange={(e) => setPauseForm({ ...pauseForm, scope_id: e.target.value })} placeholder="Target Scope ID" className="hl-input px-3 py-2" />
            <input value={pauseForm.reason} onChange={(e) => setPauseForm({ ...pauseForm, reason: e.target.value })} placeholder="Audit Reason" className="hl-input flex-1 min-w-[180px] px-3 py-2" />
            <button type="submit" onClick={() => setPauseForm((f) => ({ ...f, is_paused: true }))} className="inline-flex items-center gap-1 min-h-[40px] px-3.5 rounded-lg text-white font-semibold cursor-pointer" style={{ background: "#B42318" }}>
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
            <button type="submit" onClick={() => setPauseForm((f) => ({ ...f, is_paused: false }))} className="inline-flex items-center gap-1 min-h-[40px] px-3.5 rounded-lg text-white font-semibold cursor-pointer" style={{ background: "#16803C" }}>
              <Play className="w-3.5 h-3.5" /> Resume
            </button>
          </form>

          {(ops.paused_controls || []).length > 0 && (
            <div className="hl-card p-4 space-y-2 text-xs">
              <div className="font-bold uppercase" style={{ color: "#B42318" }}>Active Paused Scopes</div>
              {ops.paused_controls.map((p) => (
                <div key={p.id} className="p-2.5 rounded-lg border flex items-center justify-between" style={{ background: "#FEE4E2", borderColor: "#FDA29B" }}>
                  <span className="font-bold" style={{ color: "#202C52" }}>{p.scope_type}:{p.scope_id} ({p.reason || "Ops hold"})</span>
                  <button
                    type="button"
                    onClick={() => campaignApi.setDispatchControl({ scope_type: p.scope_type, scope_id: p.scope_id, is_paused: false, reason: "Resumed from Ops Control" }).then(load)}
                    className="px-2.5 py-1 rounded text-white font-semibold cursor-pointer"
                    style={{ background: "#16803C" }}
                  >
                    Resume Now
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="hl-card overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase" style={{ borderColor: "#E4E7ED", color: "#202C52" }}>
              Active Campaigns Across Platform ({(ops.active_campaigns || []).length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ background: "#F7F8FA", borderBottom: "1px solid #E4E7ED", color: "#202C52" }} className="text-left uppercase font-bold">
                  <tr>
                    <th className="px-4 py-2.5">Tenant / Campaign</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Route</th>
                    <th className="px-4 py-2.5">Sub / Del / Fail</th>
                    <th className="px-4 py-2.5 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                  {(ops.active_campaigns || []).length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "#667085" }}>No active platform campaigns right now.</td></tr>
                  ) : ops.active_campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-2.5 font-bold" style={{ color: "#202C52" }}>Tenant #{c.tenant_id} | {c.name}</td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: "#202C52" }}>{c.status}</td>
                      <td className="px-4 py-2.5" style={{ color: "#667085" }}>{c.provider_route}</td>
                      <td className="px-4 py-2.5" style={{ color: "#202C52" }}>{c.submitted_count} / {c.delivered_count} / {c.failed_count}</td>
                      <td className="px-4 py-2.5 text-right space-x-3">
                        <button type="button" onClick={() => campaignApi.adminPauseCampaign(c.id, { tenant_id: c.tenant_id }).then(load)} className="font-bold hover:underline cursor-pointer" style={{ color: "#92400E" }}>Pause</button>
                        <button type="button" onClick={() => campaignApi.adminRetryFailed(c.id, { tenant_id: c.tenant_id }).then(load)} className="font-bold hover:underline cursor-pointer" style={{ color: "#16803C" }}>Retry Failed</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
