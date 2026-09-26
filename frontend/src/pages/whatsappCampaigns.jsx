import { useState, useEffect } from "react";
import {
  Send, Plus, Play, Pause, Square, X, Loader2, Clock, CheckCircle, XCircle,
  MessageCircle, Eye, FileText, Users, Settings2, RotateCcw, ChevronDown, ChevronUp,
  Shield, RefreshCw, OctagonMinus, Copy, Download, Search, Sparkles
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import WhatsAppCampaignWizard from "../components/WhatsAppCampaignWizard";
import WAVariablePicker, { evaluateMessagePlaceholders } from "../components/WAVariablePicker";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  scheduled: "bg-yellow-100 text-yellow-800 border-yellow-200",
  running: "bg-emerald-100 text-emerald-800 border-emerald-300",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
  paused: "bg-orange-100 text-orange-800 border-orange-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Karachi",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Australia/Sydney", "UTC",
];

const PLACEHOLDERS = [
  { tag: "{name}", label: "Name" },
  { tag: "{company}", label: "Company" },
  { tag: "{service}", label: "Service" },
  { tag: "{city}", label: "City" },
  { tag: "{date}", label: "Date" },
  { tag: "{start_time}", label: "Start Time" },
  { tag: "{end_time}", label: "End Time" },
  { tag: "{amount}", label: "Amount" },
  { tag: "{invoice_no}", label: "Invoice #" },
  { tag: "{due_date}", label: "Due Date" },
];

const DEFAULT_FORM = {
  name: "", description: "", type: "text", template_id: "", flow_id: "", message_text: "", media_type: "image", media_url: "", group_id: "",
  scheduled_at: "", whatsapp_number: "",
  daily_limit: 800, start_time: "09:00", end_time: "20:00", timezone: "Asia/Kolkata",
  random_delay_min: 7, random_delay_max: 17, pause_every: 25,
  pause_duration_min: 120, pause_duration_max: 240,
  retry_failed: true, max_retries: 3, retry_delay_min: 15, retry_delay_max: 30,
  exclude_prev_recipients: false, duplicate_filter: true,
};

function ProgressBar({ sent, total, color = "bg-[#25D366]" }) {
  const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function WACampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [detailQueueStatus, setDetailQueueStatus] = useState("all");
  const [detailSearch, setDetailSearch] = useState("");
  const [starting, setStarting] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [cloning, setCloning] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({ ...DEFAULT_FORM });

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [cRes, gRes, tRes, flRes] = await Promise.all([
        axios.get(`${API}/api/wa/campaigns`, { headers: headers() }),
        axios.get(`${API}/api/wa/groups`, { headers: headers() }),
        axios.get(`${API}/api/wa/templates`, { headers: headers() }),
        axios.get(`${API}/api/wa/flows`, { headers: headers() }).catch(() => ({ data: [] })),
      ]);
      setCampaigns(cRes.data || []);
      setGroups(gRes.data || []);
      setTemplates(tRes.data || []);
      setFlows(flRes.data || []);
    } catch (err) {
      console.error(err);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dynamic live auto-refresh every 3.5 seconds whenever a campaign is running
  useEffect(() => {
    const hasRunning = campaigns.some(c => c.status === "running");
    if (!hasRunning) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [campaigns]);

  const openCreate = () => {
    setForm({ ...DEFAULT_FORM });
    setShowAdvanced(false);
    setShowCreate(true);
  };

  const applySafePacingPreset = () => {
    setForm(prev => ({
      ...prev,
      random_delay_min: 35,
      random_delay_max: 55,
      pause_every: 25,
      pause_duration_min: 180,
      pause_duration_max: 300,
      daily_limit: 800,
      start_time: "09:00",
      end_time: "20:00",
    }));
  };

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      await axios.post(`${API}/api/wa/campaigns`, {
        ...form,
        template_id: form.template_id || null,
        flow_id: form.flow_id || null,
        scheduled_at: form.scheduled_at || null,
        daily_limit: parseInt(form.daily_limit) || 0,
        random_delay_min: parseInt(form.random_delay_min) || 35,
        random_delay_max: parseInt(form.random_delay_max) || 55,
        pause_every: parseInt(form.pause_every) || 25,
        max_retries: parseInt(form.max_retries) || 3,
      }, { headers: headers() });
      setShowCreate(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create campaign");
    }
  };

  const handleStart = async (id) => {
    setStarting(id);
    try {
      await axios.post(`${API}/api/wa/campaigns/${id}/start`, {}, { headers: headers() });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to start campaign");
    }
    setStarting(null);
  };

  const handlePause = async (id) => {
    try {
      await axios.post(`${API}/api/wa/campaigns/${id}/pause`, {}, { headers: headers() });
      fetchData();
    } catch {}
  };

  const handleResume = async (id) => {
    try {
      await axios.post(`${API}/api/wa/campaigns/${id}/resume`, {}, { headers: headers() });
      fetchData();
    } catch {}
  };

  const handleStop = async (id) => {
    if (!window.confirm("Cancel this campaign? Pending messages will be stopped.")) return;
    try {
      await axios.post(`${API}/api/wa/campaigns/${id}/stop`, {}, { headers: headers() });
      fetchData();
    } catch {}
  };

  const handleRetryFailed = async (id) => {
    setRetrying(id);
    try {
      const { data } = await axios.post(`${API}/api/wa/campaigns/${id}/retry-failed`, {}, { headers: headers() });
      alert(`Restarted ${data.retriedCount || 0} failed messages.`);
      fetchData();
      if (campaignDetail && campaignDetail.id === id) {
        viewDetail(id);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to retry");
    }
    setRetrying(null);
  };

  const handleClone = async (id) => {
    setCloning(id);
    try {
      await axios.post(`${API}/api/wa/campaigns/${id}/clone`, {}, { headers: headers() });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to clone campaign");
    }
    setCloning(null);
  };

  const runningCount = campaigns.filter(c => c.status === "running" || c.status === "paused" || c.status === "scheduled").length;

  const handleStopAllCampaigns = async () => {
    if (!window.confirm(`Stop all ${runningCount} active/scheduled campaign(s) right now?`)) return;
    try {
      await axios.post(`${API}/api/wa/campaigns/stop-all`, {}, { headers: headers() });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to stop campaigns");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this campaign?")) return;
    try {
      await axios.delete(`${API}/api/wa/campaigns/${id}`, { headers: headers() });
      setCampaignDetail(null);
      fetchData();
    } catch {}
  };

  const viewDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API}/api/wa/campaigns/${id}`, { headers: headers() });
      setCampaignDetail(data);
    } catch {}
  };

  const downloadQueueCSV = (campaign) => {
    if (!campaign?.messages?.length) return;
    const headersLine = "Phone,Name,Status,Attempts,Error,SentAt\n";
    const rows = campaign.messages.map(m =>
      `"${m.phone || ''}","${m.contact_name || ''}","${m.status || ''}","${m.attempts || 0}","${(m.error || '').replace(/"/g, '""')}","${m.sent_at || ''}"`
    ).join("\n");
    const blob = new Blob([headersLine + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Campaign_${campaign.name.replace(/[^a-z0-9]/gi, '_')}_Report.csv`;
    link.click();
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesFilter = filterStatus === "ALL" ||
      (filterStatus === "RUNNING" && (c.status === "running" || c.status === "paused")) ||
      (filterStatus === "COMPLETED" && c.status === "completed") ||
      (filterStatus === "DRAFT" && c.status === "draft") ||
      (filterStatus === "SCHEDULED" && c.status === "scheduled");
    const matchesSearch = (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.message_text || "").toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const f = form;

  return (
    <div className="w-full pb-10">
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shadow-sm">
            <Send size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800">Bulk WhatsApp Campaigns</h1>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                {campaigns.length} Total Campaigns
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Automated high-volume broadcasts with 600–800 daily anti-ban pacing, dynamic placeholders, and real-time tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {runningCount > 0 && (
            <button
              onClick={handleStopAllCampaigns}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition text-xs font-bold shadow-sm"
              title="Cancel all active campaigns"
            >
              <OctagonMinus size={15} />
              <span>Stop All ({runningCount})</span>
            </button>
          )}
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition text-xs font-bold shadow-md shadow-emerald-600/20"
          >
            <Users size={15} />
            <span>New Broadcast Wizard</span>
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#25D366] text-white rounded-xl hover:bg-[#1ebe5d] transition text-xs font-bold shadow-md shadow-[#25D366]/20"
          >
            <Plus size={16} />
            <span>Custom Campaign</span>
          </button>
        </div>
      </div>

      {/* Dynamic Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 w-full sm:w-auto overflow-x-auto">
          {[
            { key: "ALL", label: "All Campaigns" },
            { key: "RUNNING", label: "⚡ Running / Active" },
            { key: "COMPLETED", label: "✅ Completed" },
            { key: "DRAFT", label: "📝 Drafts" },
            { key: "SCHEDULED", label: "🕒 Scheduled" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterStatus === tab.key
                  ? "bg-[#25D366] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
          />
        </div>
      </div>

      {/* Campaign Cards List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={36} className="animate-spin text-[#25D366]" />
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <Send size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-base font-bold text-gray-700">No Campaigns Found</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Click "New Broadcast Wizard" to start sending automated WhatsApp broadcasts to your customer lists.
          </p>
          <button
            onClick={() => setShowBulkModal(true)}
            className="mt-4 px-4 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1ebe5d] transition inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Launch First Broadcast
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((c) => {
            const isLive = c.status === "running";
            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {c.type === "template" ? (
                      <FileText size={16} className="text-purple-600 shrink-0" />
                    ) : (
                      <MessageCircle size={16} className="text-[#25D366] shrink-0" />
                    )}
                    <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition">
                      {c.name}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${STATUS_COLORS[c.status] || "bg-gray-100"}`}>
                      {c.status}
                    </span>
                    {c.template_name && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border bg-purple-50 text-purple-700 border-purple-200">
                        📄 {c.template_name}
                      </span>
                    )}
                    {c.flow_name && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border bg-amber-50 text-amber-700 border-amber-200">
                        🤖 {c.flow_name}
                      </span>
                    )}
                    {isLive && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" /> Live Pacing Active
                      </span>
                    )}
                  </div>

                  {c.description && <p className="text-xs text-gray-500 mb-2 line-clamp-1">{c.description}</p>}

                  {/* Progress bar */}
                  {(c.status === "running" || c.status === "completed" || c.sent_count > 0) && (
                    <div className="mb-2.5 max-w-md">
                      <ProgressBar sent={c.sent_count} total={c.total_contacts} />
                    </div>
                  )}

                  {/* Metrics Badges */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1 font-semibold text-gray-700">
                      <Users size={13} className="text-gray-400" /> {c.total_contacts || 0} Contacts
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-600">
                      <Send size={13} /> {c.sent_count || 0} Sent
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-blue-600">
                      <CheckCircle size={13} /> {c.delivered_count || 0} Delivered
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-purple-600">
                      <Eye size={13} /> {c.read_count || 0} Read
                    </span>
                    {c.failed_count > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-red-600">
                        <XCircle size={13} /> {c.failed_count} Failed
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-mono text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      <Clock size={11} /> {c.random_delay_min || 35}–{c.random_delay_max || 55}s gap
                    </span>
                    {c.daily_limit > 0 && (
                      <span className="text-[11px] text-gray-500 font-medium">
                        Cap: {c.daily_limit}/day
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => viewDetail(c.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                    title="Inspect live message queue & delivery stats"
                  >
                    <Eye size={14} />
                    <span>Queue</span>
                  </button>

                  {c.status === "draft" && (
                    <button
                      onClick={() => handleStart(c.id)}
                      disabled={starting === c.id}
                      className="flex items-center gap-1 px-3.5 py-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl text-xs font-bold transition shadow-sm"
                      title="Start campaign"
                    >
                      {starting === c.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      <span>Launch</span>
                    </button>
                  )}

                  {c.status === "running" && (
                    <>
                      <button
                        onClick={() => handlePause(c.id)}
                        className="p-2 hover:bg-orange-50 text-orange-600 rounded-xl transition"
                        title="Pause campaign"
                      >
                        <Pause size={16} />
                      </button>
                      <button
                        onClick={() => handleStop(c.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition"
                        title="Stop / Cancel campaign"
                      >
                        <Square size={16} />
                      </button>
                    </>
                  )}

                  {c.status === "paused" && (
                    <>
                      <button
                        onClick={() => handleResume(c.id)}
                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition"
                        title="Resume campaign"
                      >
                        <Play size={16} />
                      </button>
                      <button
                        onClick={() => handleStop(c.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition"
                        title="Stop campaign"
                      >
                        <Square size={16} />
                      </button>
                    </>
                  )}

                  {c.failed_count > 0 && (
                    <button
                      onClick={() => handleRetryFailed(c.id)}
                      disabled={retrying === c.id}
                      className="p-2 hover:bg-amber-50 text-amber-600 rounded-xl transition"
                      title="Retry all failed messages"
                    >
                      {retrying === c.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                    </button>
                  )}

                  <button
                    onClick={() => handleClone(c.id)}
                    disabled={cloning === c.id}
                    className="p-2 hover:bg-purple-50 text-purple-600 rounded-xl transition"
                    title="Clone / Duplicate this campaign"
                  >
                    {cloning === c.id ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-xl transition"
                    title="Delete campaign"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Broadcast Wizard Component */}
      <WhatsAppCampaignWizard
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={() => {
          setShowBulkModal(false);
          fetchData();
        }}
      />

      {/* Custom Create Campaign Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Send size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-800">Create WhatsApp Campaign</h2>
                  <p className="text-xs text-gray-500">Configure broadcast recipients, message copy, and safe sending limits</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Campaign Name & Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Campaign Name *</label>
                <input
                  type="text"
                  value={f.name}
                  onChange={e => setForm({ ...f, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
                  placeholder="e.g. Festival Special Offer 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Contact Group</label>
                  <select
                    value={f.group_id}
                    onChange={e => setForm({ ...f, group_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white font-medium"
                  >
                    <option value="">Select a group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.contact_count || 0} contacts)</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Message Format</label>
                  <select
                    value={f.type}
                    onChange={e => setForm({ ...f, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white font-medium"
                  >
                    <option value="text">💬 Text Message</option>
                    <option value="media">📷 Rich Media (Image/Video/Doc)</option>
                    <option value="template">📄 Approved Template</option>
                  </select>
                </div>
              </div>

              {/* Attached Flow Bot Picker */}
              <div className="p-3.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-600" />
                    Attached Flow Bot / Auto-Responder (Optional)
                  </label>
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded-full">
                    2-Way Bot Auto-Pilot
                  </span>
                </div>
                <select
                  value={f.flow_id || ""}
                  onChange={e => setForm({ ...f, flow_id: e.target.value })}
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium text-slate-800"
                >
                  <option value="">None (Standard Outbound Broadcast)</option>
                  {flows.map(fl => (
                    <option key={fl.id} value={fl.id}>
                      🤖 {fl.name} ({fl.node_count || 1} bot steps)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                  When recipients reply to this campaign, the system will automatically engage them in this Flow Bot conversation!
                </p>
              </div>

              {/* Media Settings */}
              {f.type === "media" && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Media Type</label>
                      <select
                        value={f.media_type}
                        onChange={e => setForm({ ...f, media_type: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white font-medium"
                      >
                        <option value="image">📷 Image (PNG, JPG, WEBP)</option>
                        <option value="video">🎥 Video (MP4, MOV, 3GP)</option>
                        <option value="audio">🎵 Audio / Voice (MP3, WAV, OGG)</option>
                        <option value="document">📄 PDF / Word Document</option>
                        <option value="excel">📊 Excel / Spreadsheet (XLSX, CSV)</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Media URL or Hosted Link</label>
                      <input
                        type="text"
                        value={f.media_url}
                        onChange={e => setForm({ ...f, media_url: e.target.value })}
                        placeholder="https://example.com/brochure.pdf"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-600 uppercase">Media Caption</label>
                      <span className="text-[10px] text-gray-400 font-mono">Dynamic Placeholders Active</span>
                    </div>
                    <WAVariablePicker
                      onInsert={(tag) => setForm(prev => ({ ...prev, message_text: (prev.message_text || "") + " " + tag }))}
                      className="mb-2"
                    />
                    <textarea
                      value={f.message_text}
                      onChange={e => setForm({ ...f, message_text: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                      placeholder="Caption with {name} {company} {city} placeholders..."
                    />
                    {f.message_text && (
                      <div className="mt-2 p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs text-emerald-300 font-mono whitespace-pre-wrap">
                        <span className="text-[10px] text-amber-400 font-bold block mb-0.5">Evaluated Caption Preview:</span>
                        {evaluateMessagePlaceholders(f.message_text)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Template picker */}
              {f.type === "template" && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Template *</label>
                  <select
                    value={f.template_id}
                    onChange={e => setForm({ ...f, template_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
                  >
                    <option value="">Select an approved template</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
                  </select>

                  {f.template_id && (() => {
                    const tmpl = templates.find(t => String(t.id) === String(f.template_id));
                    if (!tmpl) return null;
                    return (
                      <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-1.5 text-xs mt-2">
                        <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1"><Sparkles size={12} /> Template Evaluated Preview:</span>
                          <span className="text-[9px] text-emerald-400 font-mono">Dynamic Placeholders Active</span>
                        </div>
                        <div className="p-2.5 bg-slate-800/90 rounded-lg text-emerald-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                          {evaluateMessagePlaceholders(tmpl.body || "")}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Text Message Field with Toolbar */}
              {f.type === "text" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 uppercase">Message Text *</label>
                    <span className="text-[10px] text-gray-400 font-mono">{(f.message_text || "").length} chars</span>
                  </div>

                  <WAVariablePicker
                    onInsert={(tag) => setForm(prev => ({ ...prev, message_text: (prev.message_text || "") + " " + tag }))}
                    className="mb-2"
                  />

                  <textarea
                    value={f.message_text}
                    onChange={e => setForm({ ...f, message_text: e.target.value })}
                    rows={4}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#25D366] resize-none font-sans"
                    placeholder="Hello {{name}}! {{greeting_time}}, thank you for reaching out to {{company}}. Your service {{service}} in {{city}} is scheduled for {{date}} at {{time}}..."
                  />

                  {/* Live Multi-Dynamic & Spintax Randomization Preview */}
                  {f.message_text && (
                    <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-1.5 text-xs mt-2">
                      <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Sparkles size={12} /> Live Multi-Dynamic Sample Preview:</span>
                        <span className="text-[9px] text-emerald-400 font-mono">100% Unique Per Contact</span>
                      </div>
                      <div className="p-2.5 bg-slate-800/90 rounded-lg text-emerald-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                        {evaluateMessagePlaceholders(f.message_text)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Anti-Ban Pacing Presets Selector */}
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Shield size={14} className="text-emerald-700" />
                    <span>Configurable Pacing & Anti-Ban Speed</span>
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                    Customizable Delay
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, random_delay_min: 7, random_delay_max: 17 }))}
                    className={`p-2 rounded-xl border text-left transition ${
                      Number(f.random_delay_min) === 7 && Number(f.random_delay_max) === 17
                        ? "bg-white border-[#25D366] shadow-sm ring-2 ring-[#25D366]/20 font-bold"
                        : "bg-white/60 border-emerald-200 hover:bg-white text-gray-700"
                    }`}
                  >
                    <span className="text-xs font-bold text-gray-900 block">⚡ 7s–17s Gap</span>
                    <span className="text-[10px] text-emerald-700 font-semibold">Recommended Safe</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, random_delay_min: 15, random_delay_max: 35 }))}
                    className={`p-2 rounded-xl border text-left transition ${
                      Number(f.random_delay_min) === 15 && Number(f.random_delay_max) === 35
                        ? "bg-white border-[#25D366] shadow-sm ring-2 ring-[#25D366]/20 font-bold"
                        : "bg-white/60 border-emerald-200 hover:bg-white text-gray-700"
                    }`}
                  >
                    <span className="text-xs font-bold text-gray-900 block">🛡️ 15s–35s Gap</span>
                    <span className="text-[10px] text-gray-500 font-medium">Ultra Anti-Ban</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, random_delay_min: 5, random_delay_max: 10 }))}
                    className={`p-2 rounded-xl border text-left transition ${
                      Number(f.random_delay_min) === 5 && Number(f.random_delay_max) === 10
                        ? "bg-white border-[#25D366] shadow-sm ring-2 ring-[#25D366]/20 font-bold"
                        : "bg-white/60 border-emerald-200 hover:bg-white text-gray-700"
                    }`}
                  >
                    <span className="text-xs font-bold text-gray-900 block">🚀 5s–10s Gap</span>
                    <span className="text-[10px] text-gray-500 font-medium">Fast Broadcast</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, random_delay_min: 35, random_delay_max: 55 }))}
                    className={`p-2 rounded-xl border text-left transition ${
                      Number(f.random_delay_min) === 35 && Number(f.random_delay_max) === 55
                        ? "bg-white border-[#25D366] shadow-sm ring-2 ring-[#25D366]/20 font-bold"
                        : "bg-white/60 border-emerald-200 hover:bg-white text-gray-700"
                    }`}
                  >
                    <span className="text-xs font-bold text-gray-900 block">🛌 35s–55s Gap</span>
                    <span className="text-[10px] text-gray-500 font-medium">Large 800+ Batches</span>
                  </button>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-bold uppercase text-gray-600 hover:text-gray-800 py-2 border-t border-gray-100 w-full"
              >
                <Settings2 size={14} className="text-gray-500" />
                <span>Custom Delay Inputs & Business Hours</span>
                {showAdvanced ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
              </button>

              {showAdvanced && (
                <div className="bg-gray-50 rounded-2xl p-4 space-y-4 border border-gray-100 text-xs">
                  {/* Working Hours */}
                  <div>
                    <p className="font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5"><Clock size={13} /> Active Business Hours</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-gray-500 mb-1">Start Time</label>
                        <input type="time" value={f.start_time} onChange={e => setForm({ ...f, start_time: e.target.value })}
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]" />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1">End Time</label>
                        <input type="time" value={f.end_time} onChange={e => setForm({ ...f, end_time: e.target.value })}
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]" />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1">Timezone</label>
                        <select value={f.timezone} onChange={e => setForm({ ...f, timezone: e.target.value })}
                          className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]">
                          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Delay Between Messages */}
                  <div>
                    <p className="font-bold text-gray-700 uppercase mb-2 flex items-center gap-1.5"><RefreshCw size={13} /> Custom Pacing Delay Range</p>
                    <div className="flex items-center gap-2">
                      <input type="number" value={f.random_delay_min} onChange={e => setForm({ ...f, random_delay_min: e.target.value })} min={1}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366] font-bold" />
                      <span className="text-gray-500 font-bold">to</span>
                      <input type="number" value={f.random_delay_max} onChange={e => setForm({ ...f, random_delay_max: e.target.value })} min={1}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366] font-bold" />
                      <span className="text-gray-500 font-semibold">seconds (e.g. 7s to 17s for natural human pace)</span>
                    </div>
                  </div>

                  {/* Pause every N */}
                  <div>
                    <p className="font-bold text-gray-700 uppercase mb-2">Micro-Batch Rest Pauses</p>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Every</span>
                      <input type="number" value={f.pause_every} onChange={e => setForm({ ...f, pause_every: e.target.value })} min={5}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]" />
                      <span className="text-gray-400">messages, pause for</span>
                      <input type="number" value={f.pause_duration_min} onChange={e => setForm({ ...f, pause_duration_min: e.target.value })} min={30}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]" />
                      <span className="text-gray-400">seconds</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-gray-50/80">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!f.name}
                className="flex-1 px-4 py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1ebe5d] disabled:opacity-50 transition shadow-md shadow-[#25D366]/20">
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Campaign Queue Inspector & Delivery Drawer */}
      {campaignDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setCampaignDetail(null)}>
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-800">{campaignDetail.name}</h2>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_COLORS[campaignDetail.status] || "bg-gray-100"}`}>
                    {campaignDetail.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{campaignDetail.description || "Live campaign dispatch & delivery queue"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadQueueCSV(campaignDetail)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                  title="Download Campaign Delivery Report CSV"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
                <button onClick={() => setCampaignDetail(null)} className="p-1 text-gray-400 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Delivery Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Contacts", value: campaignDetail.total_contacts, color: "text-gray-800", bg: "bg-gray-50" },
                  { label: "Sent", value: campaignDetail.sent_count, color: "text-[#25D366]", bg: "bg-emerald-50" },
                  { label: "Delivered", value: campaignDetail.delivered_count, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Read", value: campaignDetail.read_count, color: "text-purple-600", bg: "bg-purple-50" },
                  { label: "Failed", value: campaignDetail.failed_count, color: "text-red-600", bg: "bg-red-50" },
                  { label: "Queued", value: campaignDetail.messages?.filter(m => m.status === "queued").length, color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "Opted Out", value: campaignDetail.messages?.filter(m => m.status === "opted_out").length, color: "text-orange-600", bg: "bg-orange-50" },
                  { label: "Skipped", value: campaignDetail.messages?.filter(m => m.status === "skipped").length, color: "text-gray-500", bg: "bg-gray-50" },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-2xl p-3.5 text-center border border-gray-100`}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value || 0}</p>
                    <p className="text-[11px] font-semibold text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              {campaignDetail.total_contacts > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-gray-700">Dispatch Progress</span>
                    <span className="font-mono text-gray-500">{campaignDetail.sent_count} / {campaignDetail.total_contacts} sent</span>
                  </div>
                  <ProgressBar sent={campaignDetail.sent_count} total={campaignDetail.total_contacts} />
                </div>
              )}

              {/* Queue Messages Table */}
              {campaignDetail.messages?.length > 0 && (
                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-3.5 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs text-gray-800 uppercase">Message Queue</h3>
                      <span className="text-[11px] text-gray-400 font-mono">({campaignDetail.messages.length} rows)</span>
                      {campaignDetail.failed_count > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRetryFailed(campaignDetail.id)}
                          disabled={retrying === campaignDetail.id}
                          className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition shadow-2xs ml-2"
                          title="Retry all failed messages in this campaign"
                        >
                          {retrying === campaignDetail.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          <span>Retry Failed ({campaignDetail.failed_count})</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        value={detailSearch}
                        onChange={e => setDetailSearch(e.target.value)}
                        placeholder="Filter queue..."
                        className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#25D366] w-32"
                      />
                      <div className="flex items-center gap-1 overflow-x-auto">
                        {["all", "queued", "sent", "delivered", "read", "failed", "opted_out"].map(s => (
                          <button
                            key={s}
                            onClick={() => setDetailQueueStatus(s)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold capitalize transition whitespace-nowrap ${
                              detailQueueStatus === s ? "bg-[#25D366] text-white shadow-xs" : "text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100/70 border-b border-gray-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Recipient</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Phone</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Status</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Attempts</th>
                          <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {campaignDetail.messages
                          .filter(m => {
                            const matchStatus = detailQueueStatus === "all" || m.status === detailQueueStatus;
                            const matchSearch = !detailSearch ||
                              (m.contact_name || "").toLowerCase().includes(detailSearch.toLowerCase()) ||
                              (m.phone || "").includes(detailSearch);
                            return matchStatus && matchSearch;
                          })
                          .map((m) => (
                            <tr key={m.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-800">{m.contact_name || "Customer"}</td>
                              <td className="px-3 py-2 font-mono text-gray-600">{m.phone}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${STATUS_COLORS[m.status] || "bg-gray-100 text-gray-600"}`}>
                                  {m.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-500 font-mono">{m.attempts || 0}</td>
                              <td className="px-3 py-2 text-gray-400 font-mono text-[11px]">
                                {m.sent_at ? new Date(m.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
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
        </div>
      )}
    </div>
  );
}