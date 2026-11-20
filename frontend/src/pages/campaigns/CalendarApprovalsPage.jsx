import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar as CalIcon, CheckCircle2, XCircle, RotateCcw, ShieldCheck, RefreshCw, Search, Plus } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi, formatMinorCurrency } from "../../api/campaigns";

export default function CalendarApprovalsPage({ mode = "calendar" }) {
  const [events, setEvents] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "calendar") {
        const data = await campaignApi.getCalendar();
        setEvents(Array.isArray(data) ? data : []);
      } else {
        const data = await campaignApi.listApprovals(statusFilter);
        setApprovals(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load records.");
    } finally {
      setLoading(false);
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
      setNotice(`Decision '${action}' recorded for campaign #${campaignId}.`);
      setReason("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) => String(ev.name || "").toLowerCase().includes(q) || String(ev.reporting_timezone || "").toLowerCase().includes(q));
  }, [events, search]);

  const filteredApprovals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return approvals;
    return approvals.filter((a) => String(a.campaign_name || "").toLowerCase().includes(q) || String(a.stage_name || "").toLowerCase().includes(q));
  }, [approvals, search]);

  const recurringCount = events.filter((e) => e.is_recurring).length;
  const totalScheduledRecipients = events.reduce((acc, e) => acc + Number(e.total_eligible || 0), 0);
  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      {/* Native /whatsapp Command Bar */}
      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            {mode === "calendar" ? <CalIcon size={22} /> : <ShieldCheck size={22} />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">
                {mode === "calendar" ? "Campaign Schedule & Calendar" : "Enterprise Campaign Approvals"}
              </h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                {mode === "calendar" ? `${events.length} Scheduled` : `${pendingCount} Pending`}
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              {mode === "calendar"
                ? "UTC-stored campaign schedules with timezone awareness, recurrence rules, and quiet-hour governance."
                : "Multi-stage marketing, compliance, and finance review queue with four-eyes maker-checker enforcement."}
            </p>
          </div>
        </div>

        <div className="hl-actions flex flex-wrap items-center gap-2">
          <Link to="/whatsapp/campaigns/create" className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer">
            <Plus className="w-4 h-4" /> Schedule Campaign
          </Link>
          <button type="button" onClick={load} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="hl-kpis">
        {mode === "calendar" ? (
          [
            { label: "Scheduled Campaigns", value: events.length, sub: "Upcoming and active runs" },
            { label: "Recurring Schedules", value: recurringCount, sub: "Automated cadence enabled" },
            { label: "Queued Recipients", value: totalScheduledRecipients.toLocaleString("en-IN"), sub: "Pre-validated eligible contacts" },
            { label: "Quiet-Hour Guard", value: "Enforced", sub: "Respects tenant quiet hours" },
          ].map((k) => (
            <div key={k.label} className="hl-kpi">
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#667085" }}>{k.label}</div>
              <div className="text-xl font-bold mt-1" style={{ color: "#202C52", fontFamily: "var(--font-display)" }}>{k.value}</div>
              <div className="text-[11px] mt-1" style={{ color: "#667085" }}>{k.sub}</div>
            </div>
          ))
        ) : (
          [
            { label: "Pending Review", value: pendingCount, sub: "Awaiting approver sign-off" },
            { label: "Total Shown", value: approvals.length, sub: `Filter: ${statusFilter}` },
            { label: "Maker-Checker", value: "Four-Eyes", sub: "Creator cannot self-approve" },
            { label: "Critical Edits", value: "Auto-Reset", sub: "Re-triggers approval on change" },
          ].map((k) => (
            <div key={k.label} className="hl-kpi">
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#667085" }}>{k.label}</div>
              <div className="text-xl font-bold mt-1" style={{ color: "#202C52", fontFamily: "var(--font-display)" }}>{k.value}</div>
              <div className="text-[11px] mt-1" style={{ color: "#667085" }}>{k.sub}</div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg text-xs font-medium" style={{ background: "#FEE4E2", border: "1px solid #FDA29B", color: "#B42318" }}>{error}</div>
      )}
      {notice && (
        <div className="p-3 rounded-lg text-xs font-medium" style={{ background: "#D1FADF", border: "1px solid #A6F4C5", color: "#16803C" }}>{notice}</div>
      )}

      {mode === "calendar" ? (
        <div className="hl-card overflow-hidden">
          <div className="p-3.5 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "#E4E7ED" }}>
            <span className="text-xs font-bold uppercase flex items-center gap-1.5" style={{ color: "#202C52" }}>
              <CalIcon className="w-4 h-4" /> Scheduled Campaigns ({filteredEvents.length})
            </span>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: "#667085" }} />
              <input
                type="text"
                aria-label="Search scheduled campaigns"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaign or timezone..."
                className="hl-input w-full pl-8 pr-2.5 py-1.5 text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ background: "#F7F8FA", borderBottom: "1px solid #E4E7ED", color: "#202C52" }} className="text-left uppercase font-bold">
                <tr>
                  <th className="px-4 py-2.5">Scheduled (UTC)</th>
                  <th className="px-4 py-2.5">Campaign</th>
                  <th className="px-4 py-2.5">Timezone / Cadence</th>
                  <th className="px-4 py-2.5">Recipients</th>
                  <th className="px-4 py-2.5">Est. Cost</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                {filteredEvents.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: "#667085" }}>No scheduled campaigns found.</td></tr>
                ) : filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: "#202C52" }}>{ev.scheduled_at || ev.start_date || "Immediate"}</td>
                    <td className="px-4 py-3 font-bold">
                      <Link to={`/whatsapp/campaigns/${ev.id}`} className="hover:underline" style={{ color: "#202C52" }}>{ev.name}</Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#667085" }}>{ev.reporting_timezone} {ev.is_recurring ? "| Recurring" : ""}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: "#202C52" }}>{ev.total_eligible || 0}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: "#202C52" }}>{formatMinorCurrency(ev.estimated_cost_minor, ev.currency)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#FFF4CC", color: "#202C52" }}>
                        {ev.status} ({ev.approval_status})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hl-card p-4 flex flex-wrap gap-3 items-center">
            <select
              aria-label="Filter approval status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="hl-select px-3 py-2 text-xs bg-white cursor-pointer"
            >
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All History</option>
            </select>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional review decision note / audit reason"
              className="hl-input flex-1 min-w-[220px] px-3 py-2 text-xs"
            />
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: "#667085" }} />
              <input
                type="text"
                aria-label="Search approval requests"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaign..."
                className="hl-input w-full pl-8 pr-2.5 py-2 text-xs"
              />
            </div>
          </div>

          <div className="hl-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ background: "#F7F8FA", borderBottom: "1px solid #E4E7ED", color: "#202C52" }} className="text-left uppercase font-bold">
                  <tr>
                    <th className="px-4 py-2.5">Campaign</th>
                    <th className="px-4 py-2.5">Stage / Role</th>
                    <th className="px-4 py-2.5">Audience / Est. Cost</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                  {filteredApprovals.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "#667085" }}>No approval requests in this view.</td></tr>
                  ) : filteredApprovals.map((a) => (
                    <tr key={a.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3">
                        <Link to={`/whatsapp/campaigns/${a.campaign_id}`} className="font-bold hover:underline" style={{ color: "#202C52" }}>
                          {a.campaign_name}
                        </Link>
                        <div style={{ color: "#667085" }}>v{a.campaign_version} | {a.category}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold" style={{ color: "#202C52" }}>{a.stage_name}</div>
                        <div style={{ color: "#667085" }}>Role: {a.required_role} {a.require_four_eyes ? "| Four-eyes" : ""}</div>
                      </td>
                      <td className="px-4 py-3" style={{ color: "#202C52" }}>
                        {a.total_eligible || 0} recipients | {formatMinorCurrency(a.estimated_cost_minor, a.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded font-bold"
                          style={
                            a.status === "APPROVED"
                              ? { background: "#D1FADF", color: "#16803C" }
                              : a.status === "REJECTED"
                              ? { background: "#FEE4E2", color: "#B42318" }
                              : { background: "#FFF4CC", color: "#202C52" }
                          }
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.status === "PENDING" ? (
                          <div className="inline-flex gap-1.5">
                            <button type="button" onClick={() => handleDecision(a.campaign_id, "approve")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-white font-semibold cursor-pointer" style={{ background: "#16803C" }}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button type="button" onClick={() => handleDecision(a.campaign_id, "changes")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-semibold cursor-pointer" style={{ background: "#FCBD16", color: "#202C52" }}>
                              <RotateCcw className="w-3.5 h-3.5" /> Changes
                            </button>
                            <button type="button" onClick={() => handleDecision(a.campaign_id, "reject")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-white font-semibold cursor-pointer" style={{ background: "#B42318" }}>
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium" style={{ color: "#667085" }}>
                            <ShieldCheck className="w-3.5 h-3.5" /> Decided
                          </span>
                        )}
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
