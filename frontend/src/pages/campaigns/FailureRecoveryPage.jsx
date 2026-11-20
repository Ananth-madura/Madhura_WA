import { useEffect, useState, useCallback } from "react";
import {
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download,
  ShieldAlert,
  Send,
} from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi, formatMinorCurrency } from "../../api/campaigns";

export default function FailureRecoveryPage() {
  const [report, setReport] = useState({ total_failed: 0, breakdown: {}, recipients: [], pacing_incidents: [] });
  const [policies, setPolicies] = useState([]);
  const [fallback, setFallback] = useState({ channels: [], dispatches: [] });
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [filterCampaign, setFilterCampaign] = useState("");
  const [recoveryTemplateMap, setRecoveryTemplateMap] = useState({});
  const [policyForm, setPolicyForm] = useState({
    name: "Transient Network & Rate-Limit Backoff",
    retry_delays_csv: "120,600,1800",
    max_attempts: 3,
    jitter_pct: 20,
    deadline_hours: 24,
  });
  const [channelForm, setChannelForm] = useState({
    channel: "sms",
    provider_name: "",
    sender_identity: "",
    allow_promotional_fallback: false,
    cost_per_message_minor: 25,
    currency: "INR",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rep, pols, fbk, tmpls, camps] = await Promise.all([
        campaignApi.getFailedRecipientsReport(filterCampaign ? { campaign_id: filterCampaign } : {}),
        campaignApi.listRetryPolicies(),
        campaignApi.getFallbackOverview(),
        campaignApi.listTemplates().catch(() => []),
        campaignApi.listCampaigns({ limit: 100 }).catch(() => []),
      ]);
      setReport(rep || { total_failed: 0, breakdown: {}, recipients: [], pacing_incidents: [] });
      setPolicies(Array.isArray(pols) ? pols : []);
      setFallback(fbk || { channels: [], dispatches: [] });
      setTemplates(Array.isArray(tmpls?.items) ? tmpls.items : Array.isArray(tmpls) ? tmpls : []);
      setCampaigns(Array.isArray(camps?.items) ? camps.items : Array.isArray(camps) ? camps : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load failure recovery console.");
    } finally {
      setLoading(false);
    }
  }, [filterCampaign]);

  useEffect(() => { load(); }, [load]);

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const delays = policyForm.retry_delays_csv
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n >= 10);
      await campaignApi.saveRetryPolicy({
        name: policyForm.name,
        retry_delays_seconds: delays.length ? delays : [120, 600, 1800],
        max_attempts: Number(policyForm.max_attempts || 3),
        jitter_pct: Number(policyForm.jitter_pct || 20),
        deadline_hours: Number(policyForm.deadline_hours || 24),
      });
      setNotice("Saved transient retry policy. Permanent failures and UNKNOWN_REQUIRES_RECONCILIATION are strictly excluded.");
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRetryTransient = async (campaignId) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.retryTransientFailures(campaignId, {});
      setNotice(
        `Requeued ${res.requeued_count} transient failure(s). Skipped ${res.skipped_permanent} permanent, ${res.skipped_reconciliation_required} reconciliation-required, ${res.skipped_max_attempts} max-attempts.`
      );
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRecoverIncident = async (incidentId) => {
    const replacementId = recoveryTemplateMap[incidentId];
    if (!replacementId) {
      setError("Choose an APPROVED replacement template first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.recoverPacingIncident(incidentId, { replacement_template_id: Number(replacementId) });
      setNotice(
        `Created recovery campaign "${res.recovery_campaign?.name}" for ${res.recovered_recipient_count} unsent/failed recipient(s) while preserving ${res.preserved_already_sent_count} already-sent contacts.`
      );
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveChannel = async (e) => {
    e.preventDefault();
    if (!channelForm.provider_name.trim()) {
      setError("Enter a fallback provider name (for example Twilio SMS or SendGrid Email).");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await campaignApi.configureFallbackChannel({
        ...channelForm,
        cost_per_message_minor: Number(channelForm.cost_per_message_minor || 25),
      });
      setNotice(`Configured optional ${channelForm.channel.toUpperCase()} fallback provider. Separate channel consent is enforced on every dispatch.`);
      setChannelForm({ ...channelForm, provider_name: "", sender_identity: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ["Campaign", "Phone", "Status", "ErrorCode", "FailureCategory", "Retryable", "ErrorMessage"];
    const lines = [headers.join(",")];
    for (const r of report.recipients || []) {
      lines.push(
        [
          `"${String(r.campaign_name || "").replace(/"/g, '""')}"`,
          `"${r.normalized_phone || ""}"`,
          r.status,
          `"${r.error_code || ""}"`,
          r.failure_category,
          r.retryable ? "YES" : "NO",
          `"${String(r.error_message || "").replace(/"/g, '""')}"`,
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campaign-failed-recipients.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const approvedTemplates = templates.filter((t) => String(t.meta_status || "").toUpperCase() === "APPROVED");

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <RotateCcw size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">Smart Failure Recovery &amp; Meta Pacing Center</h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FEE4E2", color: "#B42318" }}>
                {report.total_failed || 0} Failed / Blocked
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Diagnose 13 failure categories, recover Meta template pacing pauses using approved replacement templates, run transient auto-retries, and manage optional consented SMS/RCS/Email fallback.
            </p>
          </div>
        </div>
        <div className="hl-actions flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleExportCsv} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Export Failed CSV
          </button>
          <button type="button" onClick={load} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="hl-card p-3.5 flex items-center gap-2 text-xs font-medium" style={{ background: "#FEE4E2", color: "#B42318" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="hl-card p-3.5 flex items-center gap-2 text-xs font-medium" style={{ background: "#D1FADF", color: "#16803C" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> <span>{notice}</span>
        </div>
      )}

      {/* Meta Template Pacing Incidents */}
      <div className="hl-card p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
          <AlertTriangle className="w-4 h-4" style={{ color: "#B42318" }} /> Meta Template Pacing Incidents ({report.pacing_incidents?.length || 0})
        </h2>
        {(report.pacing_incidents || []).length === 0 ? (
          <p className="text-xs m-0" style={{ color: "#667085" }}>
            No Meta template pacing incidents detected. When Meta returns pacing code 132015 or 132016, affected dispatch pauses automatically and appears here for safe recovery.
          </p>
        ) : (
          <div className="space-y-2.5">
            {report.pacing_incidents.map((inc) => (
              <div key={inc.id} className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3" style={{ borderColor: "#FECDCA", background: "#FFFBFA" }}>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-sm" style={{ color: "#202C52" }}>
                    {inc.campaign_name || `Campaign #${inc.campaign_id}`} | Error {inc.error_code}
                  </div>
                  <div style={{ color: "#475467" }}>{inc.error_message}</div>
                  <div style={{ color: "#667085" }}>
                    Preserved Accepted/Delivered: <strong>{inc.preserved_accepted_count}</strong> | Eligible Unsent/Failed: <strong>{inc.affected_pending_count}</strong> | Status: <strong>{inc.status}</strong>
                  </div>
                </div>
                {inc.status === "OPEN" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Approved replacement template for incident ${inc.id}`}
                      className="hl-select text-xs"
                      value={recoveryTemplateMap[inc.id] || ""}
                      onChange={(e) => setRecoveryTemplateMap({ ...recoveryTemplateMap, [inc.id]: e.target.value })}
                    >
                      <option value="">Select APPROVED template...</option>
                      {approvedTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRecoverIncident(inc.id)}
                      className="hl-btn-primary px-3 py-2 text-xs font-semibold cursor-pointer"
                    >
                      Recover Unsent Recipients
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retry Policies & Optional Fallback Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="hl-card p-4 sm:p-5 space-y-3">
          <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
            <ShieldAlert className="w-4 h-4" /> Configurable Transient Auto-Retry Policy
          </h2>
          <p className="text-xs m-0" style={{ color: "#475467" }}>
            Permanent errors (rejected template, invalid phone, opted-out) and UNKNOWN_REQUIRES_RECONCILIATION records are never auto-retried.
          </p>
          <form onSubmit={handleSavePolicy} className="space-y-2.5">
            <div>
              <label htmlFor="pol-name" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Policy Name</label>
              <input id="pol-name" className="hl-input w-full" value={policyForm.name} onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="pol-delays" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Delays (seconds CSV)</label>
                <input id="pol-delays" className="hl-input w-full" value={policyForm.retry_delays_csv} onChange={(e) => setPolicyForm({ ...policyForm, retry_delays_csv: e.target.value })} />
              </div>
              <div>
                <label htmlFor="pol-attempts" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Max Attempts (1-5)</label>
                <input id="pol-attempts" type="number" min={1} max={5} className="hl-input w-full" value={policyForm.max_attempts} onChange={(e) => setPolicyForm({ ...policyForm, max_attempts: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={busy} className="hl-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer">
              Save Retry Policy ({policies.length} active)
            </button>
          </form>
        </div>

        <div className="hl-card p-4 sm:p-5 space-y-3">
          <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
            <Send className="w-4 h-4" /> Optional Cross-Channel Fallback (SMS / RCS / Email)
          </h2>
          <p className="text-xs m-0" style={{ color: "#475467" }}>
            Requires separate channel consent (for example sms_fallback) and maintains separate provider IDs and cost ledgers.
          </p>
          <form onSubmit={handleSaveChannel} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="fb-channel" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Channel</label>
                <select id="fb-channel" className="hl-select w-full" value={channelForm.channel} onChange={(e) => setChannelForm({ ...channelForm, channel: e.target.value })}>
                  <option value="sms">SMS</option>
                  <option value="rcs">RCS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label htmlFor="fb-provider" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Provider Name</label>
                <input id="fb-provider" className="hl-input w-full" placeholder="Twilio / MSG91 / SendGrid" value={channelForm.provider_name} onChange={(e) => setChannelForm({ ...channelForm, provider_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="fb-sender" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Sender Identity</label>
                <input id="fb-sender" className="hl-input w-full" placeholder="MADHRA / alerts@company.com" value={channelForm.sender_identity} onChange={(e) => setChannelForm({ ...channelForm, sender_identity: e.target.value })} />
              </div>
              <div>
                <label htmlFor="fb-cost" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Cost per Message (paise/cents)</label>
                <input id="fb-cost" type="number" min={0} className="hl-input w-full" value={channelForm.cost_per_message_minor} onChange={(e) => setChannelForm({ ...channelForm, cost_per_message_minor: e.target.value })} />
              </div>
            </div>
            <label htmlFor="fb-promo" className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#202C52" }}>
              <input id="fb-promo" type="checkbox" checked={channelForm.allow_promotional_fallback} onChange={(e) => setChannelForm({ ...channelForm, allow_promotional_fallback: e.target.checked })} className="cursor-pointer" />
              <span>Allow promotional fallback (off by default for compliance)</span>
            </label>
            <button type="submit" disabled={busy} className="hl-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer">
              Save Fallback Channel ({fallback.channels?.length || 0} configured)
            </button>
          </form>
          {(fallback.dispatches || []).length > 0 && (
            <div className="text-xs pt-1" style={{ color: "#667085" }}>
              Fallback dispatches logged: <strong>{fallback.dispatches.length}</strong> (Total separate cost:{" "}
              <strong>{formatMinorCurrency(fallback.dispatches.reduce((a, d) => a + Number(d.cost_minor || 0), 0), "INR")}</strong>)
            </div>
          )}
        </div>
      </div>

      {/* Failed Recipient Report Table */}
      <div className="hl-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold m-0" style={{ color: "#202C52" }}>Failed &amp; Blocked Recipients Diagnostics</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter failed recipients by campaign"
              className="hl-select text-xs"
              value={filterCampaign}
              onChange={(e) => setFilterCampaign(e.target.value)}
            >
              <option value="">All Campaigns</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {filterCampaign && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRetryTransient(filterCampaign)}
                className="hl-btn-primary px-3 py-2 text-xs font-semibold cursor-pointer"
              >
                Retry Eligible Transient Failures
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-xs" style={{ color: "#667085" }}>Loading failure diagnostics...</p>
        ) : (report.recipients || []).length === 0 ? (
          <p className="text-xs" style={{ color: "#667085" }}>No failed or blocked recipients match the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: "#E4E7ED", color: "#667085" }}>
                  <th className="py-2 pr-3">Campaign</th>
                  <th className="py-2 pr-3">Recipient</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Failure Category</th>
                  <th className="py-2 pr-3">Retryable</th>
                  <th className="py-2">Error Detail</th>
                </tr>
              </thead>
              <tbody>
                {report.recipients.slice(0, 100).map((r) => (
                  <tr key={r.id} className="border-b" style={{ borderColor: "#F2F4F7" }}>
                    <td className="py-2 pr-3 font-semibold" style={{ color: "#202C52" }}>{r.campaign_name}</td>
                    <td className="py-2 pr-3 font-mono">{r.normalized_phone}</td>
                    <td className="py-2 pr-3">{r.status}</td>
                    <td className="py-2 pr-3 font-semibold">{r.failure_label}</td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded font-bold" style={{ background: r.retryable ? "#FFF4CC" : "#FEE4E2", color: r.retryable ? "#202C52" : "#B42318" }}>
                        {r.retryable ? "Transient" : r.reconciliation_required ? "Reconcile" : "Permanent"}
                      </span>
                    </td>
                    <td className="py-2" style={{ color: "#475467" }}>{r.error_message || r.error_code || "Blocked by policy"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
