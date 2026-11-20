import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Play, Pause, Square, RotateCcw, Edit, RefreshCw, AlertCircle, Zap, Send } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi, formatMinorCurrency } from "../../api/campaigns";

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [tab, setTab] = useState("recipients");
  const [campaign, setCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [execution, setExecution] = useState(null);
  const [experiment, setExperiment] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const [c, an, recs, excls, exec, exp] = await Promise.all([
        campaignApi.getCampaign(id),
        campaignApi.getCampaignAnalytics(id),
        campaignApi.getRecipients(id, { status: statusFilter }),
        campaignApi.getExclusions(id),
        campaignApi.getExecution(id),
        campaignApi.getExperiments(id).catch(() => null),
      ]);
      setCampaign(c);
      setAnalytics(an);
      setRecipients(Array.isArray(recs) ? recs : []);
      setExclusions(Array.isArray(excls) ? excls : []);
      setExecution(exec);
      setExperiment(exp);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load campaign detail");
    }
  }, [id, statusFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runAction = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const f = analytics?.funnel || {};
  const rates = analytics?.rates || {};
  const fin = analytics?.financial || {};

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      {error && (
        <div role="alert" className="p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: "#FEE4E2", border: "1px solid #FDA29B", color: "#B42318" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {campaign && (
        <>
          {/* Native /whatsapp Command Bar */}
          <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
                <Send size={22} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="hl-title m-0">{campaign.name}</h1>
                  <span className="hl-badge px-2.5 py-0.5 text-xs font-bold" style={{ background: "#D1FADF", color: "#16803C" }}>
                    {campaign.status}
                  </span>
                  <span className="hl-badge px-2.5 py-0.5 text-xs font-bold" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                    {campaign.provider_route}
                  </span>
                </div>
                <p className="hl-subtitle m-0 mt-1 text-xs">
                  {campaign.campaign_uid} | v{campaign.current_version} | {campaign.campaign_type} | {campaign.category} | Approval: {campaign.approval_status}
                </p>
              </div>
            </div>

            <div className="hl-actions flex flex-wrap gap-2">
              {["DRAFT", "PAUSED", "APPROVED"].includes(campaign.status) && (
                <Link to={`/whatsapp/campaigns/${campaign.id}/edit`} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
                  <Edit className="w-3.5 h-3.5" /> Edit
                </Link>
              )}
              {campaign.status === "RUNNING" && (
                <>
                  <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.dispatchBatch(campaign.id, 100))} className="hl-btn-primary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer disabled:opacity-50">
                    <Zap className="w-3.5 h-3.5" /> Process queued batch
                  </button>
                  <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.pauseCampaign(campaign.id, "Paused by operator"))} className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50" style={{ background: "#FCBD16", color: "#202C52" }}>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                </>
              )}
              {campaign.status === "PAUSED" && (
                <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.resumeCampaign(campaign.id))} className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg text-white text-xs font-semibold cursor-pointer disabled:opacity-50" style={{ background: "#16803C" }}>
                  <Play className="w-3.5 h-3.5" /> Resume
                </button>
              )}
              {["RUNNING", "PAUSED", "SCHEDULED"].includes(campaign.status) && (
                <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.cancelCampaign(campaign.id, "Cancelled by operator"))} className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg text-white text-xs font-semibold cursor-pointer disabled:opacity-50" style={{ background: "#B42318" }}>
                  <Square className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.retryFailed(campaign.id))} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" /> Retry transient failed
              </button>
              <button type="button" onClick={loadAll} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          {/* Connected Modules Strip */}
          <div className="hl-card p-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold uppercase text-[11px]" style={{ color: "#202C52" }}>Connected modules:</span>
            <Link to="/whatsapp/groups" className="px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
              {campaign.group_id ? `Contact Group #${campaign.group_id}` : `Segment #${campaign.segment_id || "Custom"}`}
            </Link>
            <Link to="/whatsapp/templates" className="px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
              Template: {campaign.template_name || `#${campaign.template_id || "None"}`}
            </Link>
            {campaign.whatsapp_flow_id && (
              <Link to={`/whatsapp/campaigns/flows/${campaign.whatsapp_flow_id}`} className="px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer" style={{ background: "#FFF4CC", color: "#202C52" }}>
                Meta Form #{campaign.whatsapp_flow_id}
              </Link>
            )}
            <Link to="/whatsapp/flows" className="px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
              Flowbots ({campaign.flowbot_bindings?.length || (campaign.flowbot_id ? 1 : 0)})
            </Link>
            <Link to="/whatsapp/automations" className="px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
              Automations ({campaign.automation_bindings?.length || (campaign.automation_id ? 1 : 0)})
            </Link>
            <Link to="/whatsapp" className="px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer" style={{ background: "#D1FADF", color: "#16803C" }}>
              Team Inbox replies
            </Link>
            <Link to="/whatsapp/enquiries" className="px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer" style={{ background: "#FFF4CC", color: "#202C52" }}>
              CRM Leads
            </Link>
            <Link to="/whatsapp/campaigns/analytics" className="px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
              Attribution &amp; ROI
            </Link>
          </div>

          {/* Funnel Metrics (.hl-kpis) */}
          <div className="hl-kpis">
            {[
              { label: "Eligible / Excluded", value: `${f.eligible_recipients || 0} / ${f.excluded_recipients || 0}`, sub: `Queued: ${f.queued || 0}` },
              { label: "Submitted / Delivered", value: `${f.submitted || 0} / ${f.delivered || 0}`, sub: `Delivered rate: ${rates.delivered_rate || 0}%` },
              { label: "Read / Replied", value: `${f.read || 0} / ${f.unique_replied || 0}`, sub: `Read ${rates.read_rate || 0}% | Reply ${rates.reply_rate || 0}%` },
              { label: "Forms / Conversions", value: `${f.unique_flow_completed || 0} / ${f.unique_converted || 0}`, sub: `Conv rate: ${rates.conversion_rate || 0}%` },
              { label: "Cost / Verified Revenue", value: formatMinorCurrency(fin.confirmed_cost_minor || fin.estimated_cost_minor || 0, fin.currency), sub: `Rev: ${formatMinorCurrency(fin.verified_revenue_minor || 0, fin.currency)} (${fin.roi_percent || 0}% ROI)` },
            ].map((m) => (
              <div key={m.label} className="hl-kpi">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#667085" }}>{m.label}</div>
                <div className="text-lg font-bold mt-1" style={{ color: "#202C52", fontFamily: "var(--font-display)" }}>{m.value}</div>
                <div className="text-[11px] mt-1" style={{ color: "#667085" }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Detail Tabs */}
          <div className="hl-card overflow-hidden">
            <div className="border-b px-4 flex flex-wrap gap-2" style={{ borderColor: "#E4E7ED" }}>
              {[
                ["recipients", `Recipients (${recipients.length})`],
                ["exclusions", `Exclusions (${exclusions.length})`],
                ["execution", "Execution & Attempts"],
                ["approvals", `Approvals (${campaign.approvals?.length || 0})`],
                ["experiments", "A/B Experiment"],
              ].map(([k, lbl]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setTab(k)}
                  className="px-3 py-3 text-xs font-bold border-b-2 cursor-pointer"
                  style={
                    tab === k
                      ? { borderColor: "#202C52", color: "#202C52" }
                      : { borderColor: "transparent", color: "#667085" }
                  }
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tab === "recipients" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Filter recipient status"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="hl-select px-3 py-1.5 text-xs bg-white cursor-pointer"
                    >
                      {["ALL", "QUEUED", "ACCEPTED_BY_META", "SENT", "DELIVERED", "READ", "FAILED", "BLOCKED_BY_CONSENT", "BLOCKED_BY_SUPPRESSION", "BLOCKED_BY_META_LIMIT", "UNKNOWN_REQUIRES_RECONCILIATION", "CANCELLED"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead style={{ background: "#F7F8FA", color: "#202C52" }} className="text-left uppercase font-bold">
                        <tr>
                          <th className="px-3 py-2">Contact / Phone</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Route</th>
                          <th className="px-3 py-2">WAMID</th>
                          <th className="px-3 py-2">Error / Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                        {recipients.length === 0 ? (
                          <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: "#667085" }}>No recipient execution records yet.</td></tr>
                        ) : recipients.map((r) => (
                          <tr key={r.id}>
                            <td className="px-3 py-2 font-semibold" style={{ color: "#202C52" }}>{r.contact_name || "Contact"} | {r.normalized_phone}</td>
                            <td className="px-3 py-2"><span className="px-2 py-0.5 rounded font-bold" style={{ background: "#F1F3F7", color: "#202C52" }}>{r.status}</span></td>
                            <td className="px-3 py-2" style={{ color: "#667085" }}>{r.provider_route}</td>
                            <td className="px-3 py-2 font-mono text-[11px]" style={{ color: "#667085" }}>{r.wamid || "None"}</td>
                            <td className="px-3 py-2" style={{ color: "#B42318" }}>{r.error_message || r.exclusion_reason || "None"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === "exclusions" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead style={{ background: "#F7F8FA", color: "#202C52" }} className="text-left uppercase font-bold">
                      <tr>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">Reason Code</th>
                        <th className="px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                      {exclusions.length === 0 ? (
                        <tr><td colSpan={3} className="px-3 py-6 text-center" style={{ color: "#667085" }}>No exclusions recorded.</td></tr>
                      ) : exclusions.map((e) => (
                        <tr key={e.id}>
                          <td className="px-3 py-2 font-mono" style={{ color: "#202C52" }}>{e.phone || "None"}</td>
                          <td className="px-3 py-2 font-bold" style={{ color: "#92400E" }}>{e.reason_code}</td>
                          <td className="px-3 py-2" style={{ color: "#667085" }}>{e.reason_detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "execution" && (
                <div className="space-y-4 text-xs">
                  <div className="font-bold" style={{ color: "#202C52" }}>Queue Jobs Summary</div>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(execution?.jobs_summary) ? execution.jobs_summary : []).map((j, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg" style={{ background: "#F1F3F7", color: "#202C52" }}>
                        {j.queue_name} | <strong>{j.status}</strong>: {j.count}
                      </span>
                    ))}
                  </div>
                  <div className="font-bold" style={{ color: "#202C52" }}>Recent Provider Attempts</div>
                  <table className="w-full">
                    <thead style={{ background: "#F7F8FA", color: "#202C52" }} className="text-left uppercase font-bold">
                      <tr><th className="px-3 py-2">Recipient</th><th className="px-3 py-2">Route</th><th className="px-3 py-2">Outcome</th><th className="px-3 py-2">Latency</th><th className="px-3 py-2">Error</th></tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                      {(Array.isArray(execution?.recent_attempts) ? execution.recent_attempts : []).map((a) => (
                        <tr key={a.id}>
                          <td className="px-3 py-2" style={{ color: "#202C52" }}>#{a.recipient_id} (try {a.attempt_number})</td>
                          <td className="px-3 py-2" style={{ color: "#667085" }}>{a.provider_route}</td>
                          <td className="px-3 py-2 font-bold" style={{ color: "#202C52" }}>{a.outcome}</td>
                          <td className="px-3 py-2" style={{ color: "#667085" }}>{a.latency_ms || 0} ms</td>
                          <td className="px-3 py-2" style={{ color: "#B42318" }}>{a.error_message || "None"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "approvals" && (
                <div className="space-y-2 text-xs">
                  {(campaign.approvals || []).length === 0 ? (
                    <div style={{ color: "#667085" }}>No approval stages recorded.</div>
                  ) : campaign.approvals.map((a) => (
                    <div key={a.id} className="p-3 rounded-lg border flex items-center justify-between" style={{ borderColor: "#E4E7ED" }}>
                      <div>
                        <div className="font-bold" style={{ color: "#202C52" }}>{a.stage_name} (v{a.campaign_version})</div>
                        <div style={{ color: "#667085" }}>Required role: {a.required_role} | Four-eyes: {a.require_four_eyes ? "Yes" : "No"}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#FFF4CC", color: "#202C52" }}>{a.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "experiments" && (
                <div className="space-y-3 text-xs">
                  {!experiment?.experiment ? (
                    <div style={{ color: "#667085" }}>No A/B experiment configured for this campaign.</div>
                  ) : (
                    <>
                      <div className="p-3 rounded-lg border" style={{ background: "#FAFAFA", borderColor: "#E4E7ED", color: "#202C52" }}>
                        <strong>{experiment.experiment.name}</strong>: {experiment.significance?.reason || "Collecting data"}
                      </div>
                      <table className="w-full">
                        <thead style={{ background: "#F7F8FA", color: "#202C52" }} className="text-left uppercase font-bold">
                          <tr><th className="px-3 py-2">Variant</th><th className="px-3 py-2">Assigned</th><th className="px-3 py-2">Delivered</th><th className="px-3 py-2">Read %</th><th className="px-3 py-2">Reply %</th><th className="px-3 py-2">Conv %</th></tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                          {(Array.isArray(experiment.variants) ? experiment.variants : []).map((v) => (
                            <tr key={v.variant_id}>
                              <td className="px-3 py-2 font-bold" style={{ color: "#202C52" }}>{v.variant_key} | {v.name} ({v.allocation_pct}%)</td>
                              <td className="px-3 py-2">{v.assigned_count}</td>
                              <td className="px-3 py-2">{v.delivered_count}</td>
                              <td className="px-3 py-2">{v.read_rate}%</td>
                              <td className="px-3 py-2">{v.reply_rate}%</td>
                              <td className="px-3 py-2">{v.conversion_rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
