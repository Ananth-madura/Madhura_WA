import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Users, FileText, Calendar, CheckSquare, BarChart3, Bot, Zap,
  RefreshCw, Play, Pause, Square, Copy, Eye, Search, AlertCircle, Loader2
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi, formatMinorCurrency } from "../../api/campaigns";

const STATUS_STYLES = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  SCHEDULED: "bg-indigo-100 text-indigo-800",
  RUNNING: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-teal-100 text-teal-800",
  CANCELLED: "bg-slate-200 text-slate-600",
  FAILED: "bg-rose-100 text-rose-800",
  REJECTED: "bg-rose-100 text-rose-800",
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
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav onSummaryLoaded={setEcosystem} />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Live Interconnected Campaign Pipeline Readiness Strip */}
        {ecosystem && (
          <section aria-label="Connected campaign pipeline" className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2.5">
              Connected Campaign Modules
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              {[
                { to: "/whatsapp/groups", label: "Contact Groups", val: `${ecosystem.audiences?.groups || 0} groups, ${ecosystem.audiences?.segments || 0} segments` },
                { to: "/dashboard/campaigns/consent", label: "Consent & DNC", val: `${ecosystem.audiences?.granted_consents || 0} opt-in, ${ecosystem.audiences?.active_suppressions || 0} DNC` },
                { to: "/whatsapp/accounts", label: "WABA Senders", val: `${ecosystem.senders?.connected || 0} live, ${ecosystem.senders?.marketing_api_onboarded || 0} MM API` },
                { to: "/whatsapp/templates", label: "Templates", val: `${ecosystem.templates?.approved || 0} / ${ecosystem.templates?.total || 0} approved` },
                { to: "/dashboard/campaigns/flows", label: "Meta Flows", val: `${ecosystem.whatsapp_flows?.published || 0} / ${ecosystem.whatsapp_flows?.total || 0} live` },
                { to: "/whatsapp/flows", label: "Flowbots", val: `${ecosystem.flowbots?.total || 0} bots` },
                { to: "/whatsapp/automations", label: "Automations", val: `${ecosystem.automations?.total || 0} rules, ${ecosystem.automations?.bindings || 0} bound` },
                { to: "/whatsapp/enquiries", label: "CRM Leads", val: `${ecosystem.crm?.campaign_enquiries || 0} campaign leads` },
              ].map((node) => (
                <Link
                  key={node.label}
                  to={node.to}
                  className="p-2.5 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
                >
                  <div className="font-semibold text-slate-900">{node.label}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{node.val}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {/* Header + Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Campaign Command Center</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Run WhatsApp broadcasts directly from your Contact Groups, Meta Templates, Chatbot Flowbots, and Automation rules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/dashboard/campaigns/create" className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 cursor-pointer">
              <Plus className="w-4 h-4" /> Create campaign
            </Link>
            <Link to="/whatsapp/groups" className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer">
              <Users className="w-4 h-4" /> Contact groups
            </Link>
            <Link to="/whatsapp/templates" className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer">
              <FileText className="w-4 h-4" /> Templates
            </Link>
            <Link to="/whatsapp/flows" className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer">
              <Bot className="w-4 h-4" /> Flowbots
            </Link>
            <Link to="/whatsapp/automations" className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer">
              <Zap className="w-4 h-4" /> Automations
            </Link>
            <Link to="/dashboard/campaigns/approvals" className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer">
              <CheckSquare className="w-4 h-4" /> Approvals ({ov.awaiting_approval || 0})
            </Link>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Campaigns", value: ov.total_campaigns || 0, sub: `${ov.running_campaigns || 0} running · ${ov.scheduled_campaigns || 0} scheduled` },
            { label: "Eligible Recipients", value: ov.total_eligible_recipients || 0, sub: `${ov.draft_campaigns || 0} drafts · ${ov.paused_campaigns || 0} paused` },
            { label: "Submitted / Delivered", value: `${ov.messages_submitted || 0} / ${ov.messages_delivered || 0}`, sub: `Delivered rate: ${ov.delivered_rate || 0}%` },
            { label: "Read / Replies", value: `${ov.messages_read || 0} / ${ov.replies || 0}`, sub: `Read ${ov.read_rate || 0}% · Reply ${ov.reply_rate || 0}%` },
            { label: "Flows / Conversions", value: `${ov.flow_completions || 0} / ${ov.conversions || 0}`, sub: `Conv rate: ${ov.conversion_rate || 0}%` },
            { label: "Est. Cost / Revenue", value: formatMinorCurrency(ov.estimated_cost_minor || 0), sub: `Rev: ${formatMinorCurrency(ov.attributed_revenue_minor || 0)} (${ov.roi_percent || 0}% ROI)` },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-medium text-slate-600">{card.label}</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{card.value}</div>
              <div className="text-[11px] text-slate-600 mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Performance Charts (Real Backend Data Only) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Performance by Campaign Category</h2>
              <span className="text-[11px] text-slate-600">Source: campaigns table</span>
            </div>
            {byCategory.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-slate-600">
                No campaign metrics recorded yet for selected filters.
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="submitted" name="Submitted" fill="#3b82f6" />
                    <Bar dataKey="delivered" name="Delivered" fill="#10b981" />
                    <Bar dataKey="replies" name="Replies" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Delivery &amp; Engagement by Country</h2>
              <span className="text-[11px] text-slate-600">Source: campaign_recipients</span>
            </div>
            {byCountry.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-slate-600">
                No recipient country telemetry recorded yet.
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCountry}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="country_code" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="recipients" name="Recipients" fill="#64748b" />
                    <Bar dataKey="delivered" name="Delivered" fill="#10b981" />
                    <Bar dataKey="converted" name="Converted" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              aria-label="Search campaigns"
              placeholder="Search campaign name, ID or description..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 border border-slate-300 rounded-lg"
            />
          </div>
          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="min-h-[40px] px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white cursor-pointer"
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
            className="min-h-[40px] px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white cursor-pointer"
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
            className="min-h-[40px] px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg cursor-pointer"
          />
          <input
            type="date"
            aria-label="End date"
            value={filters.date_to}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            className="min-h-[40px] px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg cursor-pointer"
          />
        </div>

        {/* Campaigns Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-600 uppercase">
                <tr>
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
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading campaigns...
                    </td>
                  </tr>
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      No campaigns found. Click <Link to="/dashboard/campaigns/create" className="text-emerald-600 font-medium underline">Create Campaign</Link> to launch your first enterprise campaign.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link to={`/dashboard/campaigns/${c.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                          {c.name}
                        </Link>
                        <div className="text-xs text-slate-500">{c.campaign_uid} · v{c.current_version}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-800">{c.campaign_type} · {c.category}</div>
                        <div className="text-[11px] text-slate-500">{c.provider_route}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[c.status] || "bg-slate-100 text-slate-700"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.total_eligible || 0}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {c.submitted_count || 0} / {c.delivered_count || 0} / {c.read_count || 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {c.reply_count || 0} / {c.conversion_count || 0}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-800">
                        {formatMinorCurrency(c.estimated_cost_minor || 0, c.currency || "INR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`View ${c.name}`}
                            onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}
                            title="View detail"
                            className="p-2 rounded-lg hover:bg-slate-200 text-slate-700 cursor-pointer"
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
                              className="p-2 rounded-lg hover:bg-amber-100 text-amber-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
                              className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
                              className="p-2 rounded-lg hover:bg-rose-100 text-rose-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
                            className="p-2 rounded-lg hover:bg-slate-200 text-slate-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Quick Links */}
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          <Link to="/dashboard/campaigns/calendar" className="inline-flex items-center gap-1 hover:text-emerald-700"><Calendar className="w-3.5 h-3.5" /> Campaign Calendar</Link>
          <Link to="/dashboard/campaigns/reports" className="inline-flex items-center gap-1 hover:text-emerald-700"><BarChart3 className="w-3.5 h-3.5" /> Custom Reports</Link>
        </div>
      </div>
    </div>
  );
}
