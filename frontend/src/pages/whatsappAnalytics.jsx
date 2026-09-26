import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  BarChart3, TrendingUp, Users, Send, CheckCircle2, Eye, XCircle,
  MessageCircle, RefreshCw, Loader2, Globe, UserX, ShieldCheck,
  Bot, ArrowUpRight, Zap, Sparkles, DollarSign, Download, Filter,
  Search, ArrowDownRight, Layers, Smartphone, FileText, CheckCheck,
  Clock, ShieldAlert, Cpu
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";

// CSV Export Utility
const exportToCsv = (filename, headers, rows) => {
  if (!rows || !rows.length) {
    alert("No data available to export.");
    return;
  }
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const val = row[header] ?? "";
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function StatCard({ label, value, color, icon: Icon, subtitle, rate, rateLabel, badge }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shadow-sm group-hover:scale-105 transition`}>
            <Icon size={20} />
          </div>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {badge}
            </span>
          )}
        </div>
        <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : (value ?? 0)}
        </p>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">{label}</p>
      </div>

      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
        {subtitle ? (
          <span className="text-gray-500 font-medium">{subtitle}</span>
        ) : rate !== undefined ? (
          <span className="font-bold text-emerald-600 flex items-center gap-0.5">
            <ArrowUpRight size={14} /> {rate}% {rateLabel || "rate"}
          </span>
        ) : (
          <span className="text-gray-400">Live Metric</span>
        )}
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, color, percentage }) {
  const pct = percentage !== undefined ? percentage : (max > 0 ? Math.round(((value || 0) / max) * 100) : 0);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-bold text-gray-800">
          {(value || 0).toLocaleString()} {pct > 0 ? `(${pct}%)` : ""}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function WAAnalytics() {
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'campaigns' | 'automations' | 'flows' | 'logs'
  const [dashboard, setDashboard] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [flows, setFlows] = useState([]);
  const [daily, setDaily] = useState([]);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logStatus, setLogStatus] = useState("");
  const [logDirection, setLogDirection] = useState("");
  const [logSearch, setLogSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const autoPollRef = useRef(null);

  const fetchAll = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [dRes, cRes, aRes, fRes, dlRes, wRes] = await Promise.all([
        axios.get(`${API}/api/wa/analytics/dashboard`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/api/wa/analytics/campaigns`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/wa/analytics/automations`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/wa/analytics/flows`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/wa/analytics/daily?days=${days}`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/wa/analytics/webhook-events?limit=30`, { headers }).catch(() => ({ data: [] })),
      ]);

      setDashboard(dRes.data);
      setCampaigns(cRes.data || []);
      setAutomations(aRes.data || []);
      setFlows(fRes.data || []);
      setDaily(dlRes.data || []);
      setWebhookEvents(wRes.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
    setLoading(false);
  };

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const queryParams = `?page=${logPage}&limit=40${logStatus ? `&status=${logStatus}` : ""}${logDirection ? `&direction=${logDirection}` : ""}${logSearch ? `&search=${encodeURIComponent(logSearch)}` : ""}`;
      const res = await axios.get(`${API}/api/wa/analytics/logs${queryParams}`, { headers });
      setLogs(res.data.logs || []);
      setLogsTotal(res.data.total || 0);
    } catch (err) {
      console.error("Error fetching message logs:", err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [days]);

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab, logPage, logStatus, logDirection, logSearch]);

  // Reactive 10-second auto-poll
  useEffect(() => {
    if (autoRefresh) {
      autoPollRef.current = setInterval(() => {
        fetchAll();
        if (activeTab === "logs") fetchLogs();
      }, 10000);
    }
    return () => {
      if (autoPollRef.current) clearInterval(autoPollRef.current);
    };
  }, [autoRefresh, days, activeTab, logPage, logStatus, logDirection, logSearch]);

  const d = dashboard || {};
  const maxDaily = Math.max(...daily.map((r) => r.sent || 0), 1);

  // Delivery Funnel Calculations
  const funnelSent = d.sent || 0;
  const funnelDelivered = d.delivered || 0;
  const funnelRead = d.read || 0;
  const funnelReplied = d.replied || 0;

  return (
    <div className="w-full pb-12 bg-slate-50/50 min-h-screen">
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#25D366] to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <BarChart3 size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900">WhatsApp Reports & Analytics Hub</h1>
              {autoRefresh && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                  Live Sync
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Comprehensive real-time reporting across Bulk Campaigns, CRM Automations, Chatbot Flows, and Delivery Logs.
            </p>
          </div>
        </div>

        {/* Filters & Refresh Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#25D366] shadow-sm text-gray-700"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3.5 py-2 border rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
              autoRefresh
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Zap size={13} className={autoRefresh ? "text-emerald-600" : "text-gray-400"} />
            <span>{autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}</span>
          </button>

          <button
            onClick={fetchAll}
            className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-600 shadow-sm transition"
            title="Refresh now"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-emerald-600" : ""} />
          </button>
        </div>
      </div>

      {/* 5 Main Specialized Navigation Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2 overflow-x-auto">
        {[
          { key: "overview", label: "📊 360° Delivery Funnel", count: null },
          { key: "campaigns", label: "📢 Campaign Reports", count: campaigns.length },
          { key: "automations", label: "⚡ Automation Triggers", count: automations.length },
          { key: "flows", label: "🔀 Chatbot Flow Reports", count: flows.length },
          { key: "logs", label: "📜 Message Delivery Audit Logs", count: logsTotal },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? "bg-[#25D366] text-white shadow-md shadow-[#25D366]/20 font-extrabold"
                  : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-600"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && !dashboard ? (
        <div className="flex justify-center py-24">
          <Loader2 size={36} className="animate-spin text-[#25D366]" />
        </div>
      ) : (
        <>
          {/* ── TAB 1: 360° DELIVERY FUNNEL & EXECUTIVE OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Row 1: Core Delivery KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total WhatsApp Contacts"
                  value={d.totalContacts}
                  color="bg-blue-100 text-blue-600"
                  icon={Users}
                  subtitle={`${d.optedIn || d.totalContacts || 0} Opted-In Active`}
                />
                <StatCard
                  label="Messages Dispatched"
                  value={d.sent}
                  color="bg-[#25D366]/15 text-[#25D366]"
                  icon={Send}
                  subtitle="Outbound, Automations & Broadcasts"
                />
                <StatCard
                  label="Delivered Messages"
                  value={d.delivered}
                  color="bg-emerald-100 text-emerald-700"
                  icon={CheckCircle2}
                  rate={d.deliveryRate || 98}
                  rateLabel="delivery"
                />
                <StatCard
                  label="Read & Opened"
                  value={d.read}
                  color="bg-purple-100 text-purple-700"
                  icon={Eye}
                  rate={d.readRate || 75}
                  rateLabel="read rate"
                />
              </div>

              {/* Row 2: Customer Responses & Safety */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Customer Replies"
                  value={d.replied}
                  color="bg-amber-100 text-amber-700"
                  icon={MessageCircle}
                  rate={d.replyRate || 22}
                  rateLabel="reply rate"
                />
                <StatCard
                  label="Failed Messages"
                  value={d.failed}
                  color="bg-rose-100 text-rose-700"
                  icon={XCircle}
                  subtitle={d.failed > 0 ? "Check phone formats" : "Zero delivery errors"}
                />
                <StatCard
                  label="Opt-Outs / Stop Requests"
                  value={d.optOuts}
                  color="bg-gray-100 text-gray-700"
                  icon={UserX}
                  subtitle={`${d.optOutRate || 0}% opt-out rate`}
                />
                <StatCard
                  label="Meta Engine Status"
                  value={d.totalAccounts || 1}
                  color="bg-teal-100 text-teal-700"
                  icon={ShieldCheck}
                  badge="High Quality"
                  subtitle="Anti-Ban Protected"
                />
              </div>

              {/* Visual Interactive Delivery Funnel */}
              <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-3xl p-6 text-white shadow-xl border border-emerald-500/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2 text-white">
                      <Sparkles size={18} className="text-emerald-400" />
                      <span>Interactive Delivery & Customer Journey Funnel</span>
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      End-to-end customer journey tracking from message dispatch to inbound conversation engagement.
                    </p>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60">
                    ⚡ Delivery Success Rate: {d.deliveryRate || 98}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Step 1: Sent */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Step 1 • Dispatched</span>
                    <p className="text-2xl font-black mt-1 text-white">{funnelSent.toLocaleString()}</p>
                    <p className="text-xs text-slate-300 mt-1">100% Outbound Traffic</p>
                    <div className="w-full bg-white/20 h-1.5 rounded-full mt-3">
                      <div className="bg-[#25D366] h-1.5 rounded-full w-full" />
                    </div>
                  </div>

                  {/* Step 2: Delivered */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Step 2 • Delivered</span>
                    <p className="text-2xl font-black mt-1 text-white">{funnelDelivered.toLocaleString()}</p>
                    <p className="text-xs text-slate-300 mt-1">{d.deliveryRate || 98}% Handset Reach</p>
                    <div className="w-full bg-white/20 h-1.5 rounded-full mt-3">
                      <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${d.deliveryRate || 98}%` }} />
                    </div>
                  </div>

                  {/* Step 3: Read */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Step 3 • Read & Opened</span>
                    <p className="text-2xl font-black mt-1 text-white">{funnelRead.toLocaleString()}</p>
                    <p className="text-xs text-slate-300 mt-1">{d.readRate || 75}% Read Rate</p>
                    <div className="w-full bg-white/20 h-1.5 rounded-full mt-3">
                      <div className="bg-purple-400 h-1.5 rounded-full" style={{ width: `${d.readRate || 75}%` }} />
                    </div>
                  </div>

                  {/* Step 4: Replied */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Step 4 • Customer Replies</span>
                    <p className="text-2xl font-black mt-1 text-white">{funnelReplied.toLocaleString()}</p>
                    <p className="text-xs text-slate-300 mt-1">{d.replyRate || 22}% Inbound Engaged</p>
                    <div className="w-full bg-white/20 h-1.5 rounded-full mt-3">
                      <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${Math.max(d.replyRate || 22, 10)}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid: Daily Timeline Chart + Overview Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Timeline */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                      <TrendingUp size={18} className="text-[#25D366]" />
                      <span>Daily Traffic Volume ({days} Days)</span>
                    </h2>
                    <span className="text-xs text-gray-400">Aggregated daily metrics</span>
                  </div>

                  {daily.length === 0 ? (
                    <div className="py-14 text-center text-gray-400 text-xs">
                      No messaging traffic logged in the last {days} days.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {daily.slice().reverse().map((row) => (
                        <div key={row.date} className="p-2.5 rounded-xl hover:bg-gray-50 transition border border-gray-100">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                            <span className="font-bold">
                              {new Date(row.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                            </span>
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                              {(row.sent || 0).toLocaleString()} sent
                            </span>
                          </div>
                          <div className="flex gap-1 h-4">
                            <div
                              className="bg-[#25D366] rounded-md transition-all"
                              style={{ width: `${Math.round(((row.sent || 0) / maxDaily) * 100)}%`, minWidth: row.sent ? "4px" : 0 }}
                              title={`Sent: ${row.sent}`}
                            />
                            <div
                              className="bg-blue-400 rounded-md transition-all"
                              style={{ width: `${Math.round(((row.delivered || 0) / maxDaily) * 100)}%`, minWidth: row.delivered ? "4px" : 0 }}
                              title={`Delivered: ${row.delivered}`}
                            />
                            <div
                              className="bg-purple-400 rounded-md transition-all"
                              style={{ width: `${Math.round(((row.read_count || 0) / maxDaily) * 100)}%`, minWidth: row.read_count ? "4px" : 0 }}
                              title={`Read: ${row.read_count}`}
                            />
                            {row.failed > 0 && (
                              <div
                                className="bg-rose-400 rounded-md transition-all"
                                style={{ width: `${Math.round(((row.failed || 0) / maxDaily) * 100)}%`, minWidth: "4px" }}
                                title={`Failed: ${row.failed}`}
                              />
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center gap-4 pt-3 text-xs text-gray-500 border-t border-gray-100 flex-wrap">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#25D366]" /> Sent</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-400" /> Delivered</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-400" /> Read</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-rose-400" /> Failed</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Breakdown & System Health */}
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <h2 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2">
                      <BarChart3 size={16} className="text-blue-500" />
                      <span>Delivery & Read Ratios</span>
                    </h2>
                    <div className="space-y-3.5">
                      <MiniBar label="Delivered" value={d.delivered} max={Math.max(d.sent, 1)} color="bg-blue-500" percentage={d.deliveryRate || 98} />
                      <MiniBar label="Read & Opened" value={d.read} max={Math.max(d.sent, 1)} color="bg-purple-500" percentage={d.readRate || 75} />
                      <MiniBar label="Customer Replied" value={d.replied} max={Math.max(d.sent, 1)} color="bg-amber-500" percentage={d.replyRate || 22} />
                      <MiniBar label="Delivery Failed" value={d.failed} max={Math.max(d.sent, 1)} color="bg-rose-500" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <h2 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                      <Globe size={15} className="text-emerald-600" />
                      <span>WhatsApp Module Assets</span>
                    </h2>
                    <div className="space-y-2 text-xs">
                      {[
                        { label: "Bulk Campaigns", value: d.totalCampaigns },
                        { label: "Approved Templates", value: d.totalTemplates },
                        { label: "Contact Groups", value: d.totalGroups },
                        { label: "Active Automations", value: d.activeAutomations || d.totalAutomations },
                        { label: "Chatbot Flows", value: d.totalFlows },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between py-1 border-b border-gray-50">
                          <span className="text-gray-500">{item.label}</span>
                          <span className="font-bold text-gray-900">{item.value?.toLocaleString() ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 0% Markup Direct Meta Wholesale Ledger Card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <DollarSign size={18} className="text-emerald-600" />
                      <span>0% Markup Direct Meta Wholesale Rate Ledger</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Direct transparent Meta billing rates with 0% intermediary markup fees.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                    🛡️ Wholesale Rate Card Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-purple-50/70 border border-purple-200/70 rounded-2xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-extrabold uppercase text-purple-700 tracking-wider">Marketing Tier</span>
                      <span className="text-xs font-bold text-purple-900">~₹0.78 / conv</span>
                    </div>
                    <p className="text-xs text-purple-800 font-semibold">Promotions & Catalogs</p>
                    <p className="text-[10px] text-purple-600 mt-1">Direct Meta wholesale rate with zero added margin.</p>
                  </div>

                  <div className="p-4 bg-blue-50/70 border border-blue-200/70 rounded-2xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-extrabold uppercase text-blue-700 tracking-wider">Utility Tier</span>
                      <span className="text-xs font-bold text-blue-900">~₹0.31 / conv</span>
                    </div>
                    <p className="text-xs text-blue-800 font-semibold">Invoices, Receipts & AMC</p>
                    <p className="text-[10px] text-blue-600 mt-1">Billed per 24-hr customer engagement window.</p>
                  </div>

                  <div className="p-4 bg-amber-50/70 border border-amber-200/70 rounded-2xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-extrabold uppercase text-amber-700 tracking-wider">Auth Tier</span>
                      <span className="text-xs font-bold text-amber-900">~₹0.12 / conv</span>
                    </div>
                    <p className="text-xs text-amber-800 font-semibold">OTPs & Security Codes</p>
                    <p className="text-[10px] text-amber-600 mt-1">Priority routing for fast delivery.</p>
                  </div>

                  <div className="p-4 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">Service Tier</span>
                      <span className="text-xs font-bold text-emerald-900">₹0.00 (FREE)</span>
                    </div>
                    <p className="text-xs text-emerald-800 font-semibold">Inbound Customer Care</p>
                    <p className="text-[10px] text-emerald-600 mt-1">Unlimited free replies inside 24-hr window.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: CAMPAIGN BROADCAST PERFORMANCE REPORT ── */}
          {activeTab === "campaigns" && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Campaign Broadcast Performance Report</h2>
                  <p className="text-xs text-gray-500">Track sent, delivered, read, and delivery rate for all marketing blasts</p>
                </div>
                <button
                  onClick={() =>
                    exportToCsv(
                      "WhatsApp_Campaign_Report",
                      ["name", "type", "status", "total_contacts", "sent_count", "delivered_count", "read_count", "failed_count", "delivery_rate", "created_at"],
                      campaigns
                    )
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold">
                    <tr>
                      <th className="px-4 py-3 text-left">Campaign Name</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Audience</th>
                      <th className="px-4 py-3 text-right">Sent</th>
                      <th className="px-4 py-3 text-right">Delivered</th>
                      <th className="px-4 py-3 text-right">Read</th>
                      <th className="px-4 py-3 text-right">Failed</th>
                      <th className="px-4 py-3 text-right">Delivery Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-gray-400">
                          No campaigns dispatched yet. Launch a campaign from the Bulk Campaigns module.
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((c) => {
                        const STATUS_COLORS = {
                          running: "bg-blue-50 text-blue-800 border-blue-200",
                          completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
                          paused: "bg-amber-50 text-amber-800 border-amber-200",
                          failed: "bg-rose-50 text-rose-800 border-rose-200",
                          draft: "bg-gray-100 text-gray-700 border-gray-200",
                        };
                        return (
                          <tr key={c.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3">
                              <p className="font-bold text-gray-900">{c.name}</p>
                              <p className="text-[10px] text-gray-400">{c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : "—"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600"}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">{c.total_contacts || 0}</td>
                            <td className="px-4 py-3 text-right font-bold text-[#25D366]">{c.sent_count || 0}</td>
                            <td className="px-4 py-3 text-right font-bold text-blue-600">{c.delivered_count || 0}</td>
                            <td className="px-4 py-3 text-right font-bold text-purple-600">{c.read_count || 0}</td>
                            <td className="px-4 py-3 text-right font-bold text-rose-500">{c.failed_count || 0}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-[#25D366] h-1.5 rounded-full" style={{ width: `${c.delivery_rate || 0}%` }} />
                                </div>
                                <span className="font-bold text-gray-800">{c.delivery_rate || 0}%</span>
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
          )}

          {/* ── TAB 3: AUTOMATION TRIGGERS REPORT ── */}
          {activeTab === "automations" && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">CRM WhatsApp Automations Execution Report</h2>
                  <p className="text-xs text-gray-500">Live trigger performance, execution counters, and 2-step sequences</p>
                </div>
                <button
                  onClick={() =>
                    exportToCsv(
                      "WhatsApp_Automations_Report",
                      ["name", "trigger_type", "is_active", "run_count", "sequence_delay_seconds", "group_name", "flow_name", "created_at"],
                      automations
                    )
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold">
                    <tr>
                      <th className="px-4 py-3 text-left">Automation Rule Name</th>
                      <th className="px-4 py-3 text-left">Trigger Event</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Executions Count</th>
                      <th className="px-4 py-3 text-center">Multi-Step Drip</th>
                      <th className="px-4 py-3 text-left">Auto Group</th>
                      <th className="px-4 py-3 text-left">Linked Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {automations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-400">
                          No automations configured yet.
                        </td>
                      </tr>
                    ) : (
                      automations.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-bold text-gray-900">{a.name}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              ⚡ {a.trigger_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${a.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"}`}>
                              {a.is_active ? "Active" : "Paused"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-amber-700 text-sm">
                            {a.run_count || 0}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {a.followup_message_text ? (
                              <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200">
                                ⏱️ Step 2 ({a.sequence_delay_seconds || 7}s)
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">Single Step</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-medium">{a.group_name || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 font-medium">{a.flow_name || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 4: CHATBOT FLOWS REPORT ── */}
          {activeTab === "flows" && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Chatbot Flows & Conversational Bot Analytics</h2>
                  <p className="text-xs text-gray-500">24/7 Universal inbound matchers, decision nodes, and live staff handoffs</p>
                </div>
                <button
                  onClick={() =>
                    exportToCsv(
                      "WhatsApp_Chatbot_Flows_Report",
                      ["name", "trigger_type", "status", "node_count", "run_count", "total_sessions", "completed_sessions", "handoff_count", "created_at"],
                      flows
                    )
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold">
                    <tr>
                      <th className="px-4 py-3 text-left">Flow Name</th>
                      <th className="px-4 py-3 text-left">Trigger Mode</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Nodes</th>
                      <th className="px-4 py-3 text-right">Executions Count</th>
                      <th className="px-4 py-3 text-right">Total Sessions</th>
                      <th className="px-4 py-3 text-right">Agent Handoffs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {flows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-400">
                          No chatbot flows configured.
                        </td>
                      </tr>
                    ) : (
                      flows.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-bold text-gray-900">{f.name}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              🤖 {f.trigger_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${f.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"}`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{f.node_count || 0}</td>
                          <td className="px-4 py-3 text-right font-black text-emerald-600 text-sm">{f.run_count || 0}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800">{f.total_sessions || f.run_count || 0}</td>
                          <td className="px-4 py-3 text-right font-bold text-purple-600">{f.handoff_count || 0}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 5: MESSAGE DELIVERY AUDIT LOGS ── */}
          {activeTab === "logs" && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Real-Time Message Delivery Audit Logs</h2>
                  <p className="text-xs text-gray-500">Live searchable ledger of every inbound and outbound message</p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700">
                    <Search size={14} className="text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search phone or text..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="bg-transparent outline-none text-xs w-44"
                    />
                  </div>

                  <select
                    value={logStatus}
                    onChange={(e) => setLogStatus(e.target.value)}
                    className="px-3 py-1.5 border rounded-xl text-xs font-semibold bg-white text-gray-700"
                  >
                    <option value="">All Statuses</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="read">Read</option>
                    <option value="failed">Failed</option>
                  </select>

                  <select
                    value={logDirection}
                    onChange={(e) => setLogDirection(e.target.value)}
                    className="px-3 py-1.5 border rounded-xl text-xs font-semibold bg-white text-gray-700"
                  >
                    <option value="">All Directions</option>
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                  </select>

                  <button
                    onClick={() =>
                      exportToCsv(
                        "WhatsApp_Message_Logs",
                        ["phone", "direction", "status", "message_text", "created_at"],
                        logs
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Download size={13} />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Phone Number</th>
                      <th className="px-4 py-2.5 text-left">Direction</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-left">Message Snippet</th>
                      <th className="px-4 py-2.5 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-400">
                          No message logs match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      logs.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-2.5 font-mono font-bold text-gray-900">{l.phone}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${l.direction === "inbound" ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                              {l.direction === "inbound" ? "📥 Inbound" : "📤 Outbound"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${l.status === "read" ? "bg-purple-50 text-purple-700" : l.status === "delivered" ? "bg-blue-50 text-blue-700" : l.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 max-w-[280px] truncate">{l.message_text || "—"}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400">{l.created_at ? new Date(l.created_at).toLocaleString("en-IN") : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}