import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Play, Pause, Square, RotateCcw, Edit, RefreshCw, AlertCircle, Zap } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> <span>{error}</span>
          </div>
        )}

        {campaign && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">{campaign.status}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Route: {campaign.provider_route}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {campaign.campaign_uid} · v{campaign.current_version} · {campaign.campaign_type} · {campaign.category} · Approval: {campaign.approval_status}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["DRAFT", "PAUSED", "APPROVED"].includes(campaign.status) && (
                  <Link to={`/dashboard/campaigns/${campaign.id}/edit`} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer">
                    <Edit className="w-4 h-4" /> Edit
                  </Link>
                )}
                {campaign.status === "RUNNING" && (
                  <>
                    <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.dispatchBatch(campaign.id, 100))} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                      <Zap className="w-4 h-4" /> Process queued batch
                    </button>
                    <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.pauseCampaign(campaign.id, "Paused by operator"))} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                      <Pause className="w-4 h-4" /> Pause
                    </button>
                  </>
                )}
                {campaign.status === "PAUSED" && (
                  <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.resumeCampaign(campaign.id))} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                    <Play className="w-4 h-4" /> Resume
                  </button>
                )}
                {["RUNNING", "PAUSED", "SCHEDULED"].includes(campaign.status) && (
                  <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.cancelCampaign(campaign.id, "Cancelled by operator"))} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-sm font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                    <Square className="w-4 h-4" /> Cancel
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => runAction(() => campaignApi.retryFailed(campaign.id))} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                  <RotateCcw className="w-4 h-4" /> Retry transient failed
                </button>
                <button type="button" onClick={loadAll} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer">
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>
            </div>

            {/* Connected Ecosystem Assets Strip */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 uppercase text-[11px]">Connected modules:</span>
              <Link to="/whatsapp/groups" className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-800 font-medium cursor-pointer">
                {campaign.group_id
                  ? `Contact Group #${campaign.group_id}`
                  : `Segment #${campaign.segment_id || "Custom"}`}
              </Link>
              <Link to="/whatsapp/templates" className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-800 font-medium cursor-pointer">
                Template: {campaign.template_name || `#${campaign.template_id || "None"}`}
              </Link>
              {campaign.whatsapp_flow_id && (
                <Link to={`/dashboard/campaigns/flows/${campaign.whatsapp_flow_id}`} className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 font-medium cursor-pointer">
                  Meta Flow #{campaign.whatsapp_flow_id}
                </Link>
              )}
              <Link to="/whatsapp/flows" className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-medium cursor-pointer">
                Chatbot Flowbots ({campaign.flowbot_bindings?.length || (campaign.flowbot_id ? 1 : 0)})
              </Link>
              <Link to="/whatsapp/automations" className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-medium cursor-pointer">
                Automations ({campaign.automation_bindings?.length || (campaign.automation_id ? 1 : 0)})
              </Link>
              <Link to="/whatsapp" className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-medium cursor-pointer">
                Team Inbox replies
              </Link>
              <Link to="/whatsapp/enquiries" className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium cursor-pointer">
                CRM Leads
              </Link>
              <Link to="/dashboard/campaigns/analytics" className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium cursor-pointer">
                Attribution &amp; ROI
              </Link>
            </div>

            {/* Funnel Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Eligible / Excluded", value: `${f.eligible_recipients || 0} / ${f.excluded_recipients || 0}`, sub: `Queued: ${f.queued || 0}` },
                { label: "Submitted / Delivered", value: `${f.submitted || 0} / ${f.delivered || 0}`, sub: `Delivered rate: ${rates.delivered_rate || 0}%` },
                { label: "Read / Replied", value: `${f.read || 0} / ${f.unique_replied || 0}`, sub: `Read ${rates.read_rate || 0}% · Reply ${rates.reply_rate || 0}%` },
                { label: "Flows / Conversions", value: `${f.unique_flow_completed || 0} / ${f.unique_converted || 0}`, sub: `Conv rate: ${rates.conversion_rate || 0}%` },
                { label: "Cost / Verified Revenue", value: formatMinorCurrency(fin.confirmed_cost_minor || fin.estimated_cost_minor || 0, fin.currency), sub: `Rev: ${formatMinorCurrency(fin.verified_revenue_minor || 0, fin.currency)} (${fin.roi_percent || 0}% ROI)` },
              ].map((m) => (
                <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-medium text-slate-600">{m.label}</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{m.value}</div>
                  <div className="text-[11px] text-slate-600 mt-1">{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200 px-4 flex flex-wrap gap-2">
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
                    className={`px-3 py-3 text-xs font-semibold border-b-2 cursor-pointer ${
                      tab === k ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-700 hover:text-slate-900"
                    }`}
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
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white cursor-pointer"
                      >
                        {["ALL", "QUEUED", "ACCEPTED_BY_META", "SENT", "DELIVERED", "READ", "FAILED", "BLOCKED_BY_CONSENT", "BLOCKED_BY_SUPPRESSION", "BLOCKED_BY_META_LIMIT", "UNKNOWN_REQUIRES_RECONCILIATION", "CANCELLED"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-left text-slate-700 uppercase">
                          <tr>
                            <th className="px-3 py-2">Contact / Phone</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Route</th>
                            <th className="px-3 py-2">WAMID</th>
                            <th className="px-3 py-2">Error / Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recipients.length === 0 ? (
                            <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-600">No recipient execution records yet.</td></tr>
                          ) : recipients.map((r) => (
                            <tr key={r.id}>
                              <td className="px-3 py-2 font-medium text-slate-900">{r.contact_name || "Contact"} · {r.normalized_phone}</td>
                              <td className="px-3 py-2"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">{r.status}</span></td>
                              <td className="px-3 py-2 text-slate-700">{r.provider_route}</td>
                              <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{r.wamid || "None"}</td>
                              <td className="px-3 py-2 text-rose-700">{r.error_message || r.exclusion_reason || "None"}</td>
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
                      <thead className="bg-slate-50 text-left text-slate-700 uppercase">
                        <tr>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Reason Code</th>
                          <th className="px-3 py-2">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exclusions.length === 0 ? (
                          <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-600">No exclusions recorded.</td></tr>
                        ) : exclusions.map((e) => (
                          <tr key={e.id}>
                            <td className="px-3 py-2 font-mono text-slate-900">{e.phone || "None"}</td>
                            <td className="px-3 py-2 font-semibold text-amber-900">{e.reason_code}</td>
                            <td className="px-3 py-2 text-slate-700">{e.reason_detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {tab === "execution" && (
                  <div className="space-y-4 text-xs">
                    <div className="font-semibold text-slate-800">Queue Jobs Summary</div>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(execution?.jobs_summary) ? execution.jobs_summary : []).map((j, i) => (
                        <span key={i} className="px-3 py-1 rounded-lg bg-slate-100 text-slate-900">
                          {j.queue_name} · <strong>{j.status}</strong>: {j.count}
                        </span>
                      ))}
                    </div>
                    <div className="font-semibold text-slate-800">Recent Provider Attempts</div>
                    <table className="w-full">
                      <thead className="bg-slate-50 text-left text-slate-700 uppercase">
                        <tr><th className="px-3 py-2">Recipient</th><th className="px-3 py-2">Route</th><th className="px-3 py-2">Outcome</th><th className="px-3 py-2">Latency</th><th className="px-3 py-2">Error</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(Array.isArray(execution?.recent_attempts) ? execution.recent_attempts : []).map((a) => (
                          <tr key={a.id}>
                            <td className="px-3 py-2 text-slate-900">#{a.recipient_id} (try {a.attempt_number})</td>
                            <td className="px-3 py-2 text-slate-700">{a.provider_route}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{a.outcome}</td>
                            <td className="px-3 py-2 text-slate-700">{a.latency_ms || 0} ms</td>
                            <td className="px-3 py-2 text-rose-700">{a.error_message || "None"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {tab === "approvals" && (
                  <div className="space-y-2 text-xs">
                    {(campaign.approvals || []).length === 0 ? (
                      <div className="text-slate-600">No approval stages recorded.</div>
                    ) : campaign.approvals.map((a) => (
                      <div key={a.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{a.stage_name} (v{a.campaign_version})</div>
                          <div className="text-slate-600">Required role: {a.required_role} · Four-eyes: {a.require_four_eyes ? "Yes" : "No"}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-900 font-semibold">{a.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "experiments" && (
                  <div className="space-y-3 text-xs">
                    {!experiment?.experiment ? (
                      <div className="text-slate-600">No A/B experiment configured for this campaign.</div>
                    ) : (
                      <>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800">
                          <strong>{experiment.experiment.name}</strong>: {experiment.significance?.reason || "Collecting data"}
                        </div>
                        <table className="w-full">
                          <thead className="bg-slate-50 text-left text-slate-600 uppercase">
                            <tr><th className="px-3 py-2">Variant</th><th className="px-3 py-2">Assigned</th><th className="px-3 py-2">Delivered</th><th className="px-3 py-2">Read %</th><th className="px-3 py-2">Reply %</th><th className="px-3 py-2">Conv %</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(Array.isArray(experiment.variants) ? experiment.variants : []).map((v) => (
                              <tr key={v.variant_id}>
                                <td className="px-3 py-2 font-semibold">{v.variant_key} · {v.name} ({v.allocation_pct}%)</td>
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
    </div>
  );
}
