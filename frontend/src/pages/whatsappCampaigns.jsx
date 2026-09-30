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
  draft: "hl-badge",
  scheduled: "hl-badge hl-badge-warn",
  running: "hl-badge hl-badge-success",
  completed: "hl-badge hl-badge-info",
  paused: "hl-badge hl-badge-warn",
  failed: "hl-badge hl-badge-error",
  cancelled: "hl-badge",
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

function ProgressBar({ sent, total, color = "" }) {
  const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "var(--color-rule)" }}>
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%`, background: "var(--color-ink)" }} />
      </div>
      <span className="text-xs font-bold w-10 text-right" style={{ color: "var(--color-ink)" }}>{pct}%</span>
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
      <div className="hl-commandbar">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--color-ink)", color: "var(--color-paper-2)" }}>
            <Send size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="hl-title">Bulk WhatsApp Campaigns</h1>
              <span className="hl-badge hl-badge-success">
                {campaigns.length} Total Campaigns
              </span>
            </div>
            <p className="hl-subtitle">
              Automated high-volume broadcasts with 600–800 daily anti-ban pacing, dynamic placeholders, and real-time tracking.
            </p>
          </div>
        </div>

        <div className="hl-actions">
          {runningCount > 0 && (
            <button
              onClick={handleStopAllCampaigns}
              className="hl-btn-danger-ghost"
              title="Cancel all active campaigns"
            >
              <OctagonMinus size={15} />
              <span>Stop All ({runningCount})</span>
            </button>
          )}
          <button
            onClick={() => setShowBulkModal(true)}
            className="hl-btn-primary"
          >
            <Users size={15} />
            <span>New Broadcast Wizard</span>
          </button>
          <button
            onClick={openCreate}
            className="hl-btn-secondary"
          >
            <Plus size={16} />
            <span>Custom Campaign</span>
          </button>
        </div>
      </div>

      {/* Dynamic Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="hl-tabs w-full sm:w-auto">
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
              className={`hl-tab whitespace-nowrap ${
                filterStatus === tab.key
                  ? "is-active"
                  : ""
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="hl-input w-full pl-9"
          />
        </div>
      </div>

      {/* Campaign Cards List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={36} className="animate-spin" />
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="hl-card hl-empty">
          <Send size={48} className="mx-auto mb-3" />
          <p className="hl-empty-title">No Campaigns Found</p>
          <p className="hl-subtitle max-w-sm mx-auto">
            Click "New Broadcast Wizard" to start sending automated WhatsApp broadcasts to your customer lists.
          </p>
          <button
            onClick={() => setShowBulkModal(true)}
            className="hl-btn-primary mt-4 inline-flex items-center gap-1.5"
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
                className="hl-card flex flex-col md:flex-row md:items-center justify-between gap-4 group p-5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {c.type === "template" ? (
                      <FileText size={16} className="shrink-0" />
                    ) : (
                      <MessageCircle size={16} className="shrink-0" />
                    )}
                    <span className="font-bold text-sm" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                      {c.name}
                    </span>
                    <span className={`${STATUS_COLORS[c.status] || "hl-badge"} uppercase`}>
                      {c.status}
                    </span>
                    {c.template_name && (
                      <span className="hl-badge hl-badge-info uppercase">
                        📄 {c.template_name}
                      </span>
                    )}
                    {c.flow_name && (
                      <span className="hl-badge hl-badge-warn uppercase">
                        🤖 {c.flow_name}
                      </span>
                    )}
                    {isLive && (
                      <span className="hl-badge hl-badge-success">
                        <span className="w-2 h-2 rounded-full animate-ping" style={{ background: "var(--color-success)" }} /> Live Pacing Active
                      </span>
                    )}
                  </div>

                  {c.description && <p className="hl-subtitle mb-2 line-clamp-1">{c.description}</p>}

                  {/* Progress bar */}
                  {(c.status === "running" || c.status === "completed" || c.sent_count > 0) && (
                    <div className="mb-2.5 max-w-md">
                      <ProgressBar sent={c.sent_count} total={c.total_contacts} />
                    </div>
                  )}

                  {/* Metrics Badges */}
                  <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--color-ink-2)" }}>
                    <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--color-ink)" }}>
                      <Users size={13} /> {c.total_contacts || 0} Contacts
                    </span>
                    <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--color-success)" }}>
                      <Send size={13} /> {c.sent_count || 0} Sent
                    </span>
                    <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--color-info)" }}>
                      <CheckCircle size={13} /> {c.delivered_count || 0} Delivered
                    </span>
                    <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--color-ink)" }}>
                      <Eye size={13} /> {c.read_count || 0} Read
                    </span>
                    {c.failed_count > 0 && (
                      <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--color-error)" }}>
                        <XCircle size={13} /> {c.failed_count} Failed
                      </span>
                    )}
                    <span className="hl-badge hl-badge-warn font-mono">
                      <Clock size={11} /> {c.random_delay_min || 35}–{c.random_delay_max || 55}s gap
                    </span>
                    {c.daily_limit > 0 && (
                      <span className="hl-id">
                        Cap: {c.daily_limit}/day
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => viewDetail(c.id)}
                    className="hl-btn-secondary"
                    title="Inspect live message queue & delivery stats"
                  >
                    <Eye size={14} />
                    <span>Queue</span>
                  </button>

                  {c.status === "draft" && (
                    <button
                      onClick={() => handleStart(c.id)}
                      disabled={starting === c.id}
                      className="hl-btn-primary"
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
                        className="hl-btn-secondary"
                        title="Pause campaign"
                      >
                        <Pause size={16} />
                      </button>
                      <button
                        onClick={() => handleStop(c.id)}
                        className="hl-btn-danger-ghost"
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
                        className="hl-btn-primary"
                        title="Resume campaign"
                      >
                        <Play size={16} />
                      </button>
                      <button
                        onClick={() => handleStop(c.id)}
                        className="hl-btn-danger-ghost"
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
                      className="hl-btn-secondary"
                      title="Retry all failed messages"
                    >
                      {retrying === c.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                    </button>
                  )}

                  <button
                    onClick={() => handleClone(c.id)}
                    disabled={cloning === c.id}
                    className="hl-btn-secondary"
                    title="Clone / Duplicate this campaign"
                  >
                    {cloning === c.id ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="hl-btn-danger-ghost"
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
          <div className="hl-card w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10" style={{ borderColor: "var(--color-rule)", background: "var(--color-paper-2)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold" style={{ background: "var(--color-ink)", color: "var(--color-paper-2)" }}>
                  <Send size={16} />
                </div>
                <div>
                  <h2 className="hl-empty-title">Create WhatsApp Campaign</h2>
                  <p className="hl-subtitle">Configure broadcast recipients, message copy, and safe sending limits</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ color: "var(--color-ink-2)" }}><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Campaign Name & Description */}
              <div>
                <label className="hl-section-label block mb-1">Campaign Name *</label>
                <input
                  type="text"
                  value={f.name}
                  onChange={e => setForm({ ...f, name: e.target.value })}
                  className="hl-input w-full"
                  placeholder="e.g. Festival Special Offer 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="hl-section-label block mb-1">Target Contact Group</label>
                  <select
                    value={f.group_id}
                    onChange={e => setForm({ ...f, group_id: e.target.value })}
                    className="hl-select w-full font-medium"
                  >
                    <option value="">Select a group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.contact_count || 0} contacts)</option>)}
                  </select>
                </div>
                <div>
                  <label className="hl-section-label block mb-1">Message Format</label>
                  <select
                    value={f.type}
                    onChange={e => setForm({ ...f, type: e.target.value })}
                    className="hl-select w-full font-medium"
                  >
                    <option value="text">💬 Text Message</option>
                    <option value="media">📷 Rich Media (Image/Video/Doc)</option>
                    <option value="template">📄 Approved Template</option>
                  </select>
                </div>
              </div>

              {/* Attached Flow Bot Picker */}
              <div className="hl-card p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="hl-section-label flex items-center gap-1.5">
                    <Sparkles size={14} />
                    Attached Flow Bot / Auto-Responder (Optional)
                  </label>
                  <span className="hl-badge hl-badge-warn">
                    2-Way Bot Auto-Pilot
                  </span>
                </div>
                <select
                  value={f.flow_id || ""}
                  onChange={e => setForm({ ...f, flow_id: e.target.value })}
                  className="hl-select w-full font-medium"
                >
                  <option value="">None (Standard Outbound Broadcast)</option>
                  {flows.map(fl => (
                    <option key={fl.id} value={fl.id}>
                      🤖 {fl.name} ({fl.node_count || 1} bot steps)
                    </option>
                  ))}
                </select>
                <p className="hl-subtitle mt-1 leading-relaxed">
                  When recipients reply to this campaign, the system will automatically engage them in this Flow Bot conversation!
                </p>
              </div>

              {/* Media Settings */}
              {f.type === "media" && (
                <div className="hl-card p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="hl-section-label block mb-1">Media Type</label>
                      <select
                        value={f.media_type}
                        onChange={e => setForm({ ...f, media_type: e.target.value })}
                        className="hl-select w-full font-medium"
                      >
                        <option value="image">📷 Image (PNG, JPG, WEBP)</option>
                        <option value="video">🎥 Video (MP4, MOV, 3GP)</option>
                        <option value="audio">🎵 Audio / Voice (MP3, WAV, OGG)</option>
                        <option value="document">📄 PDF / Word Document</option>
                        <option value="excel">📊 Excel / Spreadsheet (XLSX, CSV)</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="hl-section-label block mb-1">Media URL or Hosted Link</label>
                      <input
                        type="text"
                        value={f.media_url}
                        onChange={e => setForm({ ...f, media_url: e.target.value })}
                        placeholder="https://example.com/brochure.pdf"
                        className="hl-input w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="hl-section-label block">Media Caption</label>
                      <span className="hl-id">Dynamic Placeholders Active</span>
                    </div>
                    <WAVariablePicker
                      onInsert={(tag) => setForm(prev => ({ ...prev, message_text: (prev.message_text || "") + " " + tag }))}
                      className="mb-2"
                    />
                    <textarea
                      value={f.message_text}
                      onChange={e => setForm({ ...f, message_text: e.target.value })}
                      rows={2}
                      className="hl-input w-full resize-none"
                      placeholder="Caption with {name} {company} {city} placeholders..."
                    />
                    {f.message_text && (
                      <div className="mt-2 p-2.5 rounded-xl border text-xs font-mono whitespace-pre-wrap" style={{ background: "var(--color-shell)", borderColor: "var(--color-shell-2)", color: "var(--color-paper-2)" }}>
                        <span className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--color-accent)" }}>Evaluated Caption Preview:</span>
                        {evaluateMessagePlaceholders(f.message_text)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Template picker */}
              {f.type === "template" && (
                <div className="space-y-2">
                  <label className="hl-section-label block mb-1">Template *</label>
                  <select
                    value={f.template_id}
                    onChange={e => setForm({ ...f, template_id: e.target.value })}
                    className="hl-select w-full"
                  >
                    <option value="">Select an approved template</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
                  </select>

                  {f.template_id && (() => {
                    const tmpl = templates.find(t => String(t.id) === String(f.template_id));
                    if (!tmpl) return null;
                    return (
                      <div className="p-3 rounded-xl border space-y-1.5 text-xs mt-2" style={{ background: "var(--color-shell)", borderColor: "var(--color-shell-2)", color: "var(--color-paper-2)" }}>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
                          <span className="flex items-center gap-1"><Sparkles size={12} /> Template Evaluated Preview:</span>
                          <span className="text-[9px] font-mono">Dynamic Placeholders Active</span>
                        </div>
                        <div className="p-2.5 rounded-lg font-mono text-[11px] whitespace-pre-wrap leading-relaxed" style={{ background: "var(--color-shell-2)", color: "var(--color-paper-2)" }}>
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
                    <label className="hl-section-label">Message Text *</label>
                    <span className="hl-id">{(f.message_text || "").length} chars</span>
                  </div>

                  <WAVariablePicker
                    onInsert={(tag) => setForm(prev => ({ ...prev, message_text: (prev.message_text || "") + " " + tag }))}
                    className="mb-2"
                  />

                  <textarea
                    value={f.message_text}
                    onChange={e => setForm({ ...f, message_text: e.target.value })}
                    rows={4}
                    className="hl-input w-full resize-none"
                    placeholder="Hello {{name}}! {{greeting_time}}, thank you for reaching out to {{company}}. Your service {{service}} in {{city}} is scheduled for {{date}} at {{time}}..."
                  />

                  {/* Live Multi-Dynamic & Spintax Randomization Preview */}
                  {f.message_text && (
                    <div className="p-3 rounded-xl border space-y-1.5 text-xs mt-2" style={{ background: "var(--color-shell)", borderColor: "var(--color-shell-2)", color: "var(--color-paper-2)" }}>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
                        <span className="flex items-center gap-1"><Sparkles size={12} /> Live Multi-Dynamic Sample Preview:</span>
                        <span className="text-[9px] font-mono">100% Unique Per Contact</span>
                      </div>
                      <div className="p-2.5 rounded-lg font-mono text-[11px] whitespace-pre-wrap leading-relaxed" style={{ background: "var(--color-shell-2)", color: "var(--color-paper-2)" }}>
                        {evaluateMessagePlaceholders(f.message_text)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Anti-Ban Pacing Presets Selector */}
              <div className="hl-card p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="hl-section-label flex items-center gap-1.5">
                    <Shield size={14} />
                    <span>Configurable Pacing & Anti-Ban Speed</span>
                  </p>
                  <span className="hl-badge hl-badge-success">
                    Customizable Delay
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, random_delay_min: 7, random_delay_max: 17 }))}
                    className={`hl-card p-2 text-left ${
                      Number(f.random_delay_min) === 7 && Number(f.random_delay_max) === 17
                        ? "font-bold"
                        : ""
                    }`}
                    style={{ borderColor: Number(f.random_delay_min) === 7 && Number(f.random_delay_max) === 17 ? "var(--color-accent)" : "var(--color-rule)" }}
                  >
                    <span className="text-xs font-bold block" style={{ color: "var(--color-ink)" }}>⚡ 7s–17s Gap</span>
                    <span className="hl-badge hl-badge-success">Recommended Safe</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, random_delay_min: 15, random_delay_max: 35 }))}
                    className={`hl-card p-2 text-left ${
                      Number(f.random_delay_min) === 15 && Number(f.random_delay_max) === 35
                        ? "font-bold"
                        : ""
                    }`}
                    style={{ borderColor: Number(f.random_delay_min) === 15 && Number(f.random_delay_max) === 35 ? "var(--color-accent)" : "var(--color-rule)" }}
                  >
                    <span className="text-xs font-bold block" style={{ color: "var(--color-ink)" }}>🛡️ 15s–35s Gap</span>
                    <span className="hl-id">Ultra Anti-Ban</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, random_delay_min: 5, random_delay_max: 10 }))}
                    className={`hl-card p-2 text-left ${
                      Number(f.random_delay_min) === 5 && Number(f.random_delay_max) === 10
                        ? "font-bold"
                        : ""
                    }`}
                    style={{ borderColor: Number(f.random_delay_min) === 5 && Number(f.random_delay_max) === 10 ? "var(--color-accent)" : "var(--color-rule)" }}
                  >
                    <span className="text-xs font-bold block" style={{ color: "var(--color-ink)" }}>🚀 5s–10s Gap</span>
                    <span className="hl-id">Fast Broadcast</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, random_delay_min: 35, random_delay_max: 55 }))}
                    className={`hl-card p-2 text-left ${
                      Number(f.random_delay_min) === 35 && Number(f.random_delay_max) === 55
                        ? "font-bold"
                        : ""
                    }`}
                    style={{ borderColor: Number(f.random_delay_min) === 35 && Number(f.random_delay_max) === 55 ? "var(--color-accent)" : "var(--color-rule)" }}
                  >
                    <span className="text-xs font-bold block" style={{ color: "var(--color-ink)" }}>🛌 35s–55s Gap</span>
                    <span className="hl-id">Large 800+ Batches</span>
                  </button>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="hl-section-label flex items-center gap-2 py-2 border-t w-full"
                style={{ borderColor: "var(--color-rule)" }}
              >
                <Settings2 size={14} />
                <span>Custom Delay Inputs & Business Hours</span>
                {showAdvanced ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
              </button>

              {showAdvanced && (
                <div className="hl-card p-4 space-y-4 text-xs">
                  {/* Working Hours */}
                  <div>
                    <p className="hl-section-label mb-2 flex items-center gap-1.5"><Clock size={13} /> Active Business Hours</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="hl-section-label block mb-1">Start Time</label>
                        <input type="time" value={f.start_time} onChange={e => setForm({ ...f, start_time: e.target.value })}
                          className="hl-input w-full" />
                      </div>
                      <div>
                        <label className="hl-section-label block mb-1">End Time</label>
                        <input type="time" value={f.end_time} onChange={e => setForm({ ...f, end_time: e.target.value })}
                          className="hl-input w-full" />
                      </div>
                      <div>
                        <label className="hl-section-label block mb-1">Timezone</label>
                        <select value={f.timezone} onChange={e => setForm({ ...f, timezone: e.target.value })}
                          className="hl-select w-full">
                          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Delay Between Messages */}
                  <div>
                    <p className="hl-section-label mb-2 flex items-center gap-1.5"><RefreshCw size={13} /> Custom Pacing Delay Range</p>
                    <div className="flex items-center gap-2">
                      <input type="number" value={f.random_delay_min} onChange={e => setForm({ ...f, random_delay_min: e.target.value })} min={1}
                        className="hl-input w-20 font-bold" />
                      <span className="font-bold" style={{ color: "var(--color-ink-2)" }}>to</span>
                      <input type="number" value={f.random_delay_max} onChange={e => setForm({ ...f, random_delay_max: e.target.value })} min={1}
                        className="hl-input w-20 font-bold" />
                      <span className="hl-subtitle font-semibold">seconds (e.g. 7s to 17s for natural human pace)</span>
                    </div>
                  </div>

                  {/* Pause every N */}
                  <div>
                    <p className="hl-section-label mb-2">Micro-Batch Rest Pauses</p>
                    <div className="flex items-center gap-2">
                      <span className="hl-subtitle">Every</span>
                      <input type="number" value={f.pause_every} onChange={e => setForm({ ...f, pause_every: e.target.value })} min={5}
                        className="hl-input w-20" />
                      <span className="hl-subtitle">messages, pause for</span>
                      <input type="number" value={f.pause_duration_min} onChange={e => setForm({ ...f, pause_duration_min: e.target.value })} min={30}
                        className="hl-input w-20" />
                      <span className="hl-subtitle">seconds</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t sticky bottom-0" style={{ borderColor: "var(--color-rule)", background: "var(--color-paper)" }}>
              <button onClick={() => setShowCreate(false)} className="hl-btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!f.name}
                className="hl-btn-primary flex-1">
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Campaign Queue Inspector & Delivery Drawer */}
      {campaignDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setCampaignDetail(null)}>
          <div className="hl-card w-full max-w-4xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10" style={{ borderColor: "var(--color-rule)", background: "var(--color-paper-2)" }}>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="hl-empty-title">{campaignDetail.name}</h2>
                  <span className={`${STATUS_COLORS[campaignDetail.status] || "hl-badge"} uppercase`}>
                    {campaignDetail.status}
                  </span>
                </div>
                <p className="hl-subtitle">{campaignDetail.description || "Live campaign dispatch & delivery queue"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadQueueCSV(campaignDetail)}
                  className="hl-btn-secondary"
                  title="Download Campaign Delivery Report CSV"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
                <button onClick={() => setCampaignDetail(null)} className="p-1" style={{ color: "var(--color-ink-2)" }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Delivery Statistics Grid */}
              <div className="hl-kpis">
                {[
                  { label: "Total Contacts", value: campaignDetail.total_contacts, color: "", bg: "" },
                  { label: "Sent", value: campaignDetail.sent_count, color: "", bg: "" },
                  { label: "Delivered", value: campaignDetail.delivered_count, color: "", bg: "" },
                  { label: "Read", value: campaignDetail.read_count, color: "", bg: "" },
                  { label: "Failed", value: campaignDetail.failed_count, color: "", bg: "" },
                  { label: "Queued", value: campaignDetail.messages?.filter(m => m.status === "queued").length, color: "", bg: "" },
                  { label: "Opted Out", value: campaignDetail.messages?.filter(m => m.status === "opted_out").length, color: "", bg: "" },
                  { label: "Skipped", value: campaignDetail.messages?.filter(m => m.status === "skipped").length, color: "", bg: "" },
                ].map(s => (
                  <div key={s.label} className="hl-kpi">
                    <p className="hl-kpi-num">{s.value || 0}</p>
                    <p className="hl-kpi-label">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              {campaignDetail.total_contacts > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="hl-section-label">Dispatch Progress</span>
                    <span className="hl-id">{campaignDetail.sent_count} / {campaignDetail.total_contacts} sent</span>
                  </div>
                  <ProgressBar sent={campaignDetail.sent_count} total={campaignDetail.total_contacts} />
                </div>
              )}

              {/* Queue Messages Table */}
              {campaignDetail.messages?.length > 0 && (
                <div className="hl-card overflow-x-auto overflow-hidden">
                  <div className="p-3.5 border-b flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderColor: "var(--color-rule)" }}>
                    <div className="flex items-center gap-2">
                      <h3 className="hl-section-label">Message Queue</h3>
                      <span className="hl-id">({campaignDetail.messages.length} rows)</span>
                      {campaignDetail.failed_count > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRetryFailed(campaignDetail.id)}
                          disabled={retrying === campaignDetail.id}
                          className="hl-btn-secondary ml-2"
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
                        className="hl-input w-32"
                      />
                      <div className="hl-tabs">
                        {["all", "queued", "sent", "delivered", "read", "failed", "opted_out"].map(s => (
                          <button
                            key={s}
                            onClick={() => setDetailQueueStatus(s)}
                            className={`hl-tab capitalize whitespace-nowrap ${
                              detailQueueStatus === s ? "is-active" : ""
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto overflow-x-auto">
                    <table className="hl-table">
                      <thead className="sticky top-0">
                        <tr>
                          <th>Recipient</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Attempts</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignDetail.messages
                          .filter(m => {
                            const matchStatus = detailQueueStatus === "all" || m.status === detailQueueStatus;
                            const matchSearch = !detailSearch ||
                              (m.contact_name || "").toLowerCase().includes(detailSearch.toLowerCase()) ||
                              (m.phone || "").includes(detailSearch);
                            return matchStatus && matchSearch;
                          })
                          .map((m) => (
                            <tr key={m.id}>
                              <td>{m.contact_name || "Customer"}</td>
                              <td className="hl-id">{m.phone}</td>
                              <td>
                                <span className={`${STATUS_COLORS[m.status] || "hl-badge"} uppercase`}>
                                  {m.status}
                                </span>
                              </td>
                              <td className="hl-id">{m.attempts || 0}</td>
                              <td className="hl-id">
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