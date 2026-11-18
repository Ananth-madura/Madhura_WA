import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Calendar as CalIcon, CheckCircle2, XCircle, RotateCcw, ShieldCheck } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi, formatMinorCurrency } from "../../api/campaigns";

export default function CalendarApprovalsPage({ mode = "calendar" }) {
  const [events, setEvents] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      if (mode === "calendar") {
        const data = await campaignApi.getCalendar();
        setEvents(Array.isArray(data) ? data : []);
      } else {
        const data = await campaignApi.listApprovals(statusFilter);
        setApprovals(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [mode, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async (campaignId, action) => {
    setError("");
    setNotice("");
    try {
      if (action === "approve") await campaignApi.approveCampaign(campaignId, reason || "Approved");
      else if (action === "reject") await campaignApi.rejectCampaign(campaignId, reason || "Rejected");
      else await campaignApi.requestChanges(campaignId, reason || "Please revise");
      setNotice(`Decision '${action}' recorded for campaign #${campaignId}`);
      setReason("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav />
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "calendar" ? "Campaign Schedule & Calendar" : "Enterprise Campaign Approvals"}
          </h1>
          <p className="text-sm text-slate-600">
            {mode === "calendar"
              ? "UTC-stored campaign schedules with timezone awareness, recurrence, and quiet-hour governance."
              : "Multi-stage compliance, marketing, and finance review queue with four-eyes maker-checker enforcement."}
          </p>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}
        {notice && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">{notice}</div>}

        {mode === "calendar" ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold flex items-center gap-2">
              <CalIcon className="w-4 h-4 text-emerald-600" /> Scheduled Campaigns ({events.length})
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-600 uppercase">
                <tr><th className="px-4 py-2.5">Scheduled (UTC)</th><th className="px-4 py-2.5">Campaign</th><th className="px-4 py-2.5">Timezone / Mode</th><th className="px-4 py-2.5">Recipients</th><th className="px-4 py-2.5">Est. Cost</th><th className="px-4 py-2.5">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No scheduled campaigns found.</td></tr>
                ) : events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="px-4 py-3 font-mono">{ev.scheduled_at || ev.start_date}</td>
                    <td className="px-4 py-3 font-semibold"><Link to={`/dashboard/campaigns/${ev.id}`} className="text-emerald-700 hover:underline">{ev.name}</Link></td>
                    <td className="px-4 py-3">{ev.reporting_timezone} {ev.is_recurring ? "· Recurring" : ""}</td>
                    <td className="px-4 py-3">{ev.total_eligible || 0}</td>
                    <td className="px-4 py-3">{formatMinorCurrency(ev.estimated_cost_minor, ev.currency)}</td>
                    <td className="px-4 py-3 font-semibold">{ev.status} ({ev.approval_status})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ALL">All History</option>
              </select>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional review decision note / reason" className="flex-1 min-w-[240px] px-3 py-2 border border-slate-300 rounded-lg text-xs" />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-600 uppercase">
                  <tr><th className="px-4 py-2.5">Campaign</th><th className="px-4 py-2.5">Stage / Role</th><th className="px-4 py-2.5">Audience / Cost</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Decision</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {approvals.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No approval requests in this view.</td></tr>
                  ) : approvals.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <Link to={`/dashboard/campaigns/${a.campaign_id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{a.campaign_name}</Link>
                        <div className="text-slate-500">v{a.campaign_version} · {a.category}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{a.stage_name}</div>
                        <div className="text-slate-500">Role: {a.required_role} {a.require_four_eyes ? "· Four-eyes" : ""}</div>
                      </td>
                      <td className="px-4 py-3">{a.total_eligible || 0} recipients · {formatMinorCurrency(a.estimated_cost_minor, a.currency)}</td>
                      <td className="px-4 py-3 font-semibold">{a.status}</td>
                      <td className="px-4 py-3 text-right">
                        {a.status === "PENDING" ? (
                          <div className="inline-flex gap-1.5">
                            <button onClick={() => handleDecision(a.campaign_id, "approve")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
                            <button onClick={() => handleDecision(a.campaign_id, "changes")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 text-white font-semibold"><RotateCcw className="w-3.5 h-3.5" /> Changes</button>
                            <button onClick={() => handleDecision(a.campaign_id, "reject")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 text-white font-semibold"><XCircle className="w-3.5 h-3.5" /> Reject</button>
                          </div>
                        ) : (
                          <span className="text-slate-400 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Decided</span>
                        )}
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
