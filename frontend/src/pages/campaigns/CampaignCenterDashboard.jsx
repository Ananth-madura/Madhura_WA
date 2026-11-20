import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Users, FileText, Calendar, CheckSquare, BarChart3, Bot, Zap, Send,
  RefreshCw, Play, Pause, Square, Copy, Eye, Search, AlertCircle, Loader2
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi, formatMinorCurrency } from "../../api/campaigns";

const STATUS_STYLES = {
  DRAFT: { bg: "#F1F3F7", color: "#202C52" },
  PENDING_APPROVAL: { bg: "#FFF4CC", color: "#202C52" },
  APPROVED: { bg: "#E0EAFF", color: "#1E40AF" },
  SCHEDULED: { bg: "#E0F2FE", color: "#075985" },
  RUNNING: { bg: "#D1FADF", color: "#16803C" },
  PAUSED: { bg: "#FEF3C7", color: "#92400E" },
  COMPLETED: { bg: "#D1FADF", color: "#16803C" },
  CANCELLED: { bg: "#F2F4F7", color: "#475467" },
  FAILED: { bg: "#FEE4E2", color: "#B42318" },
  REJECTED: { bg: "#FEE4E2", color: "#B42318" },
};

export default function CampaignCenterDashboard() {
  const navigate = useNavigate();
  const [ecosystem, setEcosystem] = useState(null);
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [filters, setFilters] = useState({
    status: "ALL",
    campaign_type: "",
    category: "",
    search: "",
    date_from: "",
    date_to: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const cleanParams = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v && v !== "ALL")
      );
      const [ov, list] = await Promise.all([
        campaignApi.getOverview(cleanParams),
        campaignApi.listCampaigns(cleanParams),
      ]);
      setOverview(ov);
      setCampaigns(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load campaign command center");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (id, fn) => {
    setBusyId(id);
    setError("");
    try {
      await fn();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const ov = overview?.overview || {};
  const byCategory = Array.isArray(overview?.breakdowns?.by_category) ? overview.breakdowns.by_category : [];
  const byCountry = Array.isArray(overview?.breakdowns?.by_country) ? overview.breakdowns.by_country : [];

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav onSummaryLoaded={setEcosystem} />

      {/* Native /whatsapp Command Bar */}
      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#202C52", color: "#FFFFFF" }}
          >
            <Send size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">Campaign Command Center</h1>
              <span
                className="hl-badge text-xs font-bold px-2.5 py-0.5"
                style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}
              >
                {ov.total_campaigns || 0} Campaigns
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Run WhatsApp broadcasts connected directly to Contact Groups, Meta Templates, Flowbots, Automations, and CRM attribution.
            </p>
          </div>
        </div>

        <div className="hl-actions flex flex-wrap items-center gap-2">
          <Link to="/whatsapp/campaigns/create" className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer">
            <Plus className="w-4 h-4" /> Create campaign
          </Link>
          <Link to="/whatsapp/groups" className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
            <Users className="w-3.5 h-3.5" /> Groups
          </Link>
          <Link to="/whatsapp/templates" className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
            <FileText className="w-3.5 h-3.5" /> Templates
          </Link>
          <Link to="/whatsapp/flows" className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
            <Bot className="w-3.5 h-3.5" /> Flowbots
          </Link>
          <Link to="/whatsapp/automations" className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
            <Zap className="w-3.5 h-3.5" /> Automations
          </Link>
          <button
            type="button"
            onClick={loadData}
            className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 p-3 rounded-lg text-sm font-medium" style={{ background: "#FEE4E2", border: "1px solid #FDA29B", color: "#B42318" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Strip (.hl-kpis) */}
      <div className="hl-kpis">
        {[
          { label: "Total Campaigns", value: ov.total_campaigns || 0, sub: `${ov.running_campaigns || 0} running | ${ov.scheduled_campaigns || 0} scheduled` },
          { label: "Eligible Recipients", value: (ov.total_eligible_recipients || 0).toLocaleString("en-IN"), sub: `${ov.draft_campaigns || 0} drafts | ${ov.paused_campaigns || 0} paused` },
          { label: "Submitted / Delivered", value: `${ov.messages_submitted || 0} / ${ov.messages_delivered || 0}`, sub: `Delivered rate: ${ov.delivered_rate || 0}%` },
          { label: "Read / Replies", value: `${ov.messages_read || 0} / ${ov.replies || 0}`, sub: `Read ${ov.read_rate || 0}% | Reply ${ov.reply_rate || 0}%` },
          { label: "Meta Forms / Conversions", value: `${ov.flow_completions || 0} / ${ov.conversions || 0}`, sub: `Conv rate: ${ov.conversion_rate || 0}%` },
          { label: "Est. Cost / Revenue", value: formatMinorCurrency(ov.estimated_cost_minor || 0), sub: `Rev: ${formatMinorCurrency(ov.attributed_revenue_minor || 0)} (${ov.roi_percent || 0}% ROI)` },
        ].map((card) => (
          <div key={card.label} className="hl-kpi">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#667085" }}>{card.label}</div>
            <div className="text-xl font-bold mt-1" style={{ color: "#202C52", fontFamily: "var(--font-display)" }}>{card.value}</div>
            <div className="text-[11px] mt-1" style={{ color: "#667085" }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Connected Ecosystem Readiness Strip */}
      {ecosystem && (
        <section aria-label="Connected campaign modules" className="hl-card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "#202C52" }}>
            Connected WhatsApp CRM Pipeline
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
            {[
              { to: "/whatsapp/groups", label: "Contact Groups", val: `${ecosystem.audiences?.groups || 0} groups, ${ecosystem.audiences?.segments || 0} seg` },
              { to: "/whatsapp/campaigns/consent", label: "Consent & DNC", val: `${ecosystem.audiences?.granted_consents || 0} opt-in, ${ecosystem.audiences?.active_suppressions || 0} DNC` },
              { to: "/whatsapp/accounts", label: "WABA Senders", val: `${ecosystem.senders?.connected || 0} live, ${ecosystem.senders?.marketing_api_onboarded || 0} MM API` },
              { to: "/whatsapp/templates", label: "Templates", val: `${ecosystem.templates?.approved || 0} / ${ecosystem.templates?.total || 0} approved` },
              { to: "/whatsapp/campaigns/flows", label: "Meta Forms", val: `${ecosystem.whatsapp_flows?.published || 0} / ${ecosystem.whatsapp_flows?.total || 0} live` },
              { to: "/whatsapp/flows", label: "Flowbots", val: `${ecosystem.flowbots?.total || 0} bots` },
              { to: "/whatsapp/automations", label: "Automations", val: `${ecosystem.automations?.total || 0} rules, ${ecosystem.automations?.bindings || 0} bound` },
              { to: "/whatsapp/enquiries", label: "CRM Leads", val: `${ecosystem.crm?.campaign_enquiries || 0} campaign leads` },
            ].map((node) => (
              <Link
                key={node.label}
                to={node.to}
                className="p-2.5 rounded-lg transition-colors cursor-pointer"
                style={{ background: "#FAFAFA", border: "1px solid #E4E7ED" }}
              >
                <div className="font-semibold" style={{ color: "#202C52" }}>{node.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "#667085" }}>{node.val}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Performance Charts (Navy x Success x Yellow Brand Palette) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="hl-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold m-0" style={{ color: "#202C52" }}>Performance by Campaign Category</h2>
            <span className="text-[11px]" style={{ color: "#667085" }}>Source: campaigns</span>
          </div>
          {byCategory.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm" style={{ color: "#667085" }}>
              No campaign metrics recorded yet for selected filters.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ed" />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#202C52" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#667085" }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="submitted" name="Submitted" fill="#202C52" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#16803C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="replies" name="Replies" fill="#FCBD16" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="hl-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold m-0" style={{ color: "#202C52" }}>Delivery &amp; Engagement by Country</h2>
            <span className="text-[11px]" style={{ color: "#667085" }}>Source: campaign_recipients</span>
          </div>
          {byCountry.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm" style={{ color: "#667085" }}>
              No recipient country telemetry recorded yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCountry}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ed" />
                  <XAxis dataKey="country_code" tick={{ fontSize: 11, fill: "#202C52" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#667085" }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="recipients" name="Recipients" fill="#202C52" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#16803C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" name="Converted" fill="#FCBD16" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="hl-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-3" style={{ color: "#667085" }} />
          <input
            type="text"
            aria-label="Search campaigns"
            placeholder="Search campaign name, UID or description..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="hl-input w-full min-h-[40px] pl-9 pr-3 py-2 text-xs"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="hl-select min-h-[40px] px-3 py-2 text-xs bg-white cursor-pointer"
        >
          <option value="ALL">All Statuses</option>
          {["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED", "CANCELLED", "FAILED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter by category"
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          className="hl-select min-h-[40px] px-3 py-2 text-xs bg-white cursor-pointer"
        >
          <option value="">All Categories</option>
          <option value="MARKETING">MARKETING</option>
          <option value="UTILITY">UTILITY</option>
          <option value="AUTHENTICATION">AUTHENTICATION</option>
        </select>
        <input
          type="date"
          aria-label="Start date"
          value={filters.date_from}
          onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
          className="hl-input min-h-[40px] px-3 py-2 text-xs cursor-pointer"
        />
        <input
          type="date"
          aria-label="End date"
          value={filters.date_to}
          onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
          className="hl-input min-h-[40px] px-3 py-2 text-xs cursor-pointer"
        />
      </div>

      {/* Campaigns Table */}
      <div className="hl-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#F7F8FA", borderBottom: "1px solid #E4E7ED" }} className="text-left text-[11px] font-bold uppercase">
              <tr style={{ color: "#202C52" }}>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Type / Route</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Eligible</th>
                <th className="px-4 py-3">Sub / Del / Read</th>
                <th className="px-4 py-3">Replies / Conv</th>
                <th className="px-4 py-3">Est. Cost</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center" style={{ color: "#667085" }}>
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading campaigns...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center" style={{ color: "#667085" }}>
                    No campaigns found. Click{" "}
                    <Link to="/whatsapp/campaigns/create" className="font-bold underline" style={{ color: "#202C52" }}>
                      Create campaign
                    </Link>{" "}
                    to launch your first campaign.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => {
                  const st = STATUS_STYLES[c.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr key={c.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3">
                        <Link to={`/whatsapp/campaigns/${c.id}`} className="font-bold hover:underline" style={{ color: "#202C52" }}>
                          {c.name}
                        </Link>
                        <div className="text-[11px]" style={{ color: "#667085" }}>{c.campaign_uid} | v{c.current_version}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold" style={{ color: "#202C52" }}>{c.campaign_type} | {c.category}</div>
                        <div className="text-[11px]" style={{ color: "#667085" }}>{c.provider_route}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "#202C52" }}>{c.total_eligible || 0}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#202C52" }}>
                        {c.submitted_count || 0} / {c.delivered_count || 0} / {c.read_count || 0}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#202C52" }}>
                        {c.reply_count || 0} / {c.conversion_count || 0}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#202C52" }}>
                        {formatMinorCurrency(c.estimated_cost_minor || 0, c.currency || "INR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`View ${c.name}`}
                            onClick={() => navigate(`/whatsapp/campaigns/${c.id}`)}
                            title="View detail"
                            className="p-2 rounded-lg hover:bg-[#F1F3F7] cursor-pointer"
                            style={{ color: "#202C52" }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {c.status === "RUNNING" && (
                            <button
                              type="button"
                              aria-label={`Pause ${c.name}`}
                              disabled={busyId === c.id}
                              onClick={() => handleAction(c.id, () => campaignApi.pauseCampaign(c.id, "Paused from dashboard"))}
                              title="Pause"
                              className="p-2 rounded-lg hover:bg-[#FFF4CC] text-amber-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {c.status === "PAUSED" && (
                            <button
                              type="button"
                              aria-label={`Resume ${c.name}`}
                              disabled={busyId === c.id}
                              onClick={() => handleAction(c.id, () => campaignApi.resumeCampaign(c.id))}
                              title="Resume"
                              className="p-2 rounded-lg hover:bg-[#D1FADF] text-[#16803C] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {["RUNNING", "PAUSED", "SCHEDULED"].includes(c.status) && (
                            <button
                              type="button"
                              aria-label={`Cancel ${c.name}`}
                              disabled={busyId === c.id}
                              onClick={() => handleAction(c.id, () => campaignApi.cancelCampaign(c.id, "Cancelled from dashboard"))}
                              title="Cancel"
                              className="p-2 rounded-lg hover:bg-[#FEE4E2] text-[#B42318] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Duplicate ${c.name}`}
                            disabled={busyId === c.id}
                            onClick={() => handleAction(c.id, () => campaignApi.duplicateCampaign(c.id))}
                            title="Duplicate"
                            className="p-2 rounded-lg hover:bg-[#F1F3F7] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ color: "#202C52" }}
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Quick Links */}
      <div className="flex flex-wrap gap-4 text-xs font-semibold" style={{ color: "#202C52" }}>
        <Link to="/whatsapp/campaigns/calendar" className="inline-flex items-center gap-1.5 hover:underline cursor-pointer">
          <Calendar className="w-3.5 h-3.5" /> Schedule &amp; Calendar
        </Link>
        <Link to="/whatsapp/campaigns/approvals" className="inline-flex items-center gap-1.5 hover:underline cursor-pointer">
          <CheckSquare className="w-3.5 h-3.5" /> Approvals ({ov.awaiting_approval || 0})
        </Link>
        <Link to="/whatsapp/campaigns/analytics" className="inline-flex items-center gap-1.5 hover:underline cursor-pointer">
          <BarChart3 className="w-3.5 h-3.5" /> Analytics &amp; ROI
        </Link>
      </div>
    </div>
  );
}
