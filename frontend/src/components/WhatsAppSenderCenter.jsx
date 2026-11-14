import React, { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Send,
  Radio,
  Building2,
  Settings,
  Phone,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  GitFork,
  BarChart3,
  Filter,
  Search,
  Star,
  CheckSquare,
  Square,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Clock,
  ArrowUpDown,
  Edit2,
  X,
  Zap,
  Lock,
  Layers,
  Copy,
  ExternalLink
} from "lucide-react";

export default function WhatsAppSenderCenter({
  senders = [],
  branches = [],
  admin = false,
  busy = "",
  onPing,
  onTestSend,
  onRegister,
  onRoutingChange,
  onUpdateSettings,
  onDisconnect,
  onRefresh,
  request,
}) {
  // View mode: "cards" | "table" | "topology" | "analytics"
  const [viewMode, setViewMode] = useState("cards");

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [qualityFilter, setQualityFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default_first");

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchActionBusy, setBatchActionBusy] = useState(false);

  // Modals & Drawers
  const [activeSender, setActiveSender] = useState(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testMessage, setTestMessage] = useState("Madhura WhatsApp SaaS: Test ping message!");
  const [testResult, setTestResult] = useState(null);
  const [testSending, setTestSending] = useState(false);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinCode, setPinCode] = useState("");

  const [routingModalOpen, setRoutingModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState("");
  const [editingBranchIds, setEditingBranchIds] = useState([]);
  const [editingIsShared, setEditingIsShared] = useState(true);

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [senderActivity, setSenderActivity] = useState([]);
  const [senderWebhook, setSenderWebhook] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Batch Department Modal
  const [batchDeptModalOpen, setBatchDeptModalOpen] = useState(false);
  const [batchDeptName, setBatchDeptName] = useState("");

  // Live Ping Latency Cache
  const [pingResults, setPingResults] = useState({});

  // Engine Diagnostics (Token Bucket Rate Limiting)
  const [diagnostics, setDiagnostics] = useState(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  // Load diagnostics when analytics view is opened
  useEffect(() => {
    if (viewMode === "analytics" && request) {
      setLoadingDiagnostics(true);
      request("get", "/meta/engine/diagnostics")
        .then((res) => setDiagnostics(res))
        .catch(() => {})
        .finally(() => setLoadingDiagnostics(false));
    }
  }, [viewMode, request]);

  // Extract distinct departments
  const availableDepartments = useMemo(() => {
    const set = new Set();
    senders.forEach((s) => {
      if (s.department_name) set.add(s.department_name);
    });
    return Array.from(set);
  }, [senders]);

  // Filtered & Sorted Senders
  const filteredSenders = useMemo(() => {
    return senders
      .filter((s) => {
        // Status filter
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        // Quality filter
        if (qualityFilter !== "all" && s.quality !== qualityFilter) return false;
        // Department filter
        if (deptFilter !== "all" && (s.department_name || "General") !== deptFilter) return false;
        // Branch filter
        if (branchFilter !== "all") {
          const bId = Number(branchFilter);
          if (!s.assigned_branch_ids || !s.assigned_branch_ids.includes(bId)) return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchPhone = (s.display_phone || "").toLowerCase().includes(q);
          const matchName = (s.verified_name || "").toLowerCase().includes(q);
          const matchDept = (s.department_name || "").toLowerCase().includes(q);
          const matchBranches = (s.assigned_branches || "").toLowerCase().includes(q);
          const matchWaba = (s.waba_id || "").toLowerCase().includes(q);
          if (!matchPhone && !matchName && !matchDept && !matchBranches && !matchWaba) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "default_first") {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return (a.verified_name || "").localeCompare(b.verified_name || "");
        }
        if (sortBy === "quality_first") {
          const qOrder = { GREEN: 1, YELLOW: 2, RED: 3, UNKNOWN: 4 };
          const diff = (qOrder[a.quality] || 4) - (qOrder[b.quality] || 4);
          if (diff !== 0) return diff;
          return (a.verified_name || "").localeCompare(b.verified_name || "");
        }
        if (sortBy === "sent_desc") {
          return (b.current_day_sent || 0) - (a.current_day_sent || 0);
        }
        if (sortBy === "name_asc") {
          return (a.verified_name || "").localeCompare(b.verified_name || "");
        }
        if (sortBy === "phone_asc") {
          return (a.display_phone || "").localeCompare(b.display_phone || "");
        }
        return 0;
      });
  }, [senders, statusFilter, qualityFilter, deptFilter, branchFilter, searchQuery, sortBy]);

  // Quality badge helper
  const qualityBadge = (quality) => {
    switch (quality) {
      case "GREEN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> High Quality
          </span>
        );
      case "YELLOW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Medium (Yellow)
          </span>
        );
      case "RED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" /> Low Quality (Red)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Radio className="w-3 h-3 text-slate-500" /> {quality || "Verified"}
          </span>
        );
    }
  };

  // Tier badge helper
  const tierBadge = (tier) => {
    const clean = String(tier || "TIER_250").replace("TIER_", "");
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <Sparkles className="w-3 h-3 text-blue-500" />
        Tier {clean}
      </span>
    );
  };

  // Ping a single sender
  const handlePingClick = async (sender) => {
    try {
      const res = await onPing(sender.id);
      if (res) {
        setPingResults((prev) => ({
          ...prev,
          [sender.id]: { success: true, latencyMs: res.latencyMs, time: new Date().toLocaleTimeString() },
        }));
      }
    } catch (err) {
      setPingResults((prev) => ({
        ...prev,
        [sender.id]: { success: false, error: err.message || "Ping failed", time: new Date().toLocaleTimeString() },
      }));
    }
  };

  // Batch Ping selected senders concurrently
  const handleBatchPing = async () => {
    if (!selectedIds.length) return;
    setBatchActionBusy(true);
    try {
      await Promise.allSettled(
        selectedIds.map(async (id) => {
          try {
            const res = await onPing(id);
            setPingResults((prev) => ({
              ...prev,
              [id]: { success: true, latencyMs: res.latencyMs, time: new Date().toLocaleTimeString() },
            }));
          } catch (err) {
            setPingResults((prev) => ({
              ...prev,
              [id]: { success: false, error: err.message || "Ping failed", time: new Date().toLocaleTimeString() },
            }));
          }
        })
      );
    } finally {
      setBatchActionBusy(false);
    }
  };

  // Toggle Default status for a sender
  const handleToggleDefault = async (sender) => {
    if (!admin || !onUpdateSettings) return;
    try {
      await onUpdateSettings(sender.id, { isDefault: !sender.is_default });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Could not update default sender: " + (err.message || "Unknown error"));
    }
  };

  // Open Details Inspector Drawer
  const handleOpenInspector = async (sender) => {
    setActiveSender(sender);
    setInspectorOpen(true);
    setLoadingDetails(true);
    setSenderActivity([]);
    setSenderWebhook(null);
    try {
      if (request) {
        const [activityRes, webhookRes] = await Promise.all([
          request("get", `/meta/senders/${sender.id}/activity`).catch(() => ({ events: [] })),
          admin ? request("get", `/meta/senders/${sender.id}/webhook`).catch(() => null) : Promise.resolve(null),
        ]);
        setSenderActivity(activityRes?.events || []);
        setSenderWebhook(webhookRes);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Routing / Department Modal
  const handleOpenRoutingModal = (sender) => {
    setActiveSender(sender);
    setEditingDept(sender.department_name || "");
    setEditingBranchIds(sender.assigned_branch_ids || []);
    setEditingIsShared(Boolean(sender.is_shared));
    setRoutingModalOpen(true);
  };

  // Save Routing & Department changes
  const handleSaveRoutingModal = async (e) => {
    e.preventDefault();
    if (!activeSender) return;
    try {
      if (onUpdateSettings) {
        await onUpdateSettings(activeSender.id, {
          departmentName: editingDept || null,
          isShared: editingIsShared,
        });
      }
      if (onRoutingChange) {
        await onRoutingChange(activeSender.id, {
          branchIds: editingBranchIds,
          isShared: editingIsShared,
          revision: activeSender.revision,
        });
      }
      setRoutingModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Failed to save settings: " + (err.message || "Unknown error"));
    }
  };

  // Save Batch Department
  const handleSaveBatchDept = async (e) => {
    e.preventDefault();
    if (!selectedIds.length || !onUpdateSettings) return;
    setBatchActionBusy(true);
    try {
      await Promise.allSettled(
        selectedIds.map((id) => onUpdateSettings(id, { departmentName: batchDeptName || null }))
      );
      setBatchDeptModalOpen(false);
      setBatchDeptName("");
      setSelectedIds([]);
      if (onRefresh) onRefresh();
    } finally {
      setBatchActionBusy(false);
    }
  };

  // Execute Live Test WhatsApp Message
  const handleExecuteTestSend = async (e) => {
    e.preventDefault();
    if (!activeSender || !testRecipient) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await onTestSend(activeSender.id, {
        recipientPhone: testRecipient,
        messageText: testMessage,
      });
      setTestResult({ success: true, metaMessageId: res.metaMessageId });
    } catch (err) {
      setTestResult({ success: false, error: err.message || "Test dispatch failed" });
    } finally {
      setTestSending(false);
    }
  };

  // Execute PIN Registration
  const handleExecutePinRegister = async (e) => {
    e.preventDefault();
    if (!activeSender || !pinCode) return;
    try {
      await onRegister(activeSender.id, pinCode);
      setPinModalOpen(false);
      setPinCode("");
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Registration failed: " + (err.message || "Check PIN"));
    }
  };

  // Multi-selection toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSenders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSenders.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Summary counts
  const totalSenders = senders.length;
  const connectedSenders = senders.filter((s) => s.status === "connected").length;
  const totalDailySent = senders.reduce((acc, s) => acc + (s.current_day_sent || 0), 0);
  const totalPortfolios = new Set(senders.map((s) => s.waba_id).filter(Boolean)).size || 1;

  return (
    <div className="space-y-6">
      {/* Multi-Sender Delivery Operations Header Banner */}
      <div className="bg-[var(--ac-surface)] border border-[var(--ac-border)] rounded-2xl p-5 shadow-sm text-[var(--ac-ink)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base sm:text-lg font-bold text-[var(--ac-ink)] m-0">
                Multi-Sender Delivery Operations
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                {connectedSenders} of {totalSenders} Online
              </span>
            </div>
            <p className="text-xs text-[var(--ac-muted)] m-0 max-w-2xl">
              Concurrent WhatsApp sending with dedicated identities, WABA token-bucket throughput, and per-number health monitoring.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={Boolean(busy)}
              className="ac-btn text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin text-amber-500" : ""}`} />
              <span>Sync Status</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[var(--ac-border)]">
          <div className="bg-[var(--ac-paper)] rounded-xl p-3 border border-[var(--ac-border)]">
            <span className="text-xl font-bold tracking-tight text-[var(--ac-ink)] font-mono block">{totalSenders}</span>
            <span className="text-[11px] text-[var(--ac-muted)] uppercase tracking-wider font-semibold block mt-0.5">Total Numbers</span>
          </div>
          <div className="bg-[var(--ac-paper)] rounded-xl p-3 border border-[var(--ac-border)]">
            <span className="text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 font-mono block">{connectedSenders}</span>
            <span className="text-[11px] text-[var(--ac-muted)] uppercase tracking-wider font-semibold block mt-0.5">Connected & Active</span>
          </div>
          <div className="bg-[var(--ac-paper)] rounded-xl p-3 border border-[var(--ac-border)]">
            <span className="text-xl font-bold tracking-tight text-[var(--ac-ink)] font-mono block">{totalPortfolios}</span>
            <span className="text-[11px] text-[var(--ac-muted)] uppercase tracking-wider font-semibold block mt-0.5">WABAs / Portfolios</span>
          </div>
          <div className="bg-[var(--ac-paper)] rounded-xl p-3 border border-[var(--ac-border)]">
            <span className="text-xl font-bold tracking-tight text-[var(--ac-ink)] font-mono block">{totalDailySent.toLocaleString()}</span>
            <span className="text-[11px] text-[var(--ac-muted)] uppercase tracking-wider font-semibold block mt-0.5">Sent Today (24h)</span>
          </div>
        </div>
      </div>

      {/* Control Bar: View Mode Switcher, Search & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* View Mode Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
            <button
              onClick={() => setViewMode("cards")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "cards"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Dense Table
            </button>
            <button
              onClick={() => setViewMode("topology")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "topology"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              Asset Topology
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "analytics"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Rate Limits & Health
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone, name, department, branch, or WABA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="default_first">Default First</option>
              <option value="quality_first">Quality (Green First)</option>
              <option value="sent_desc">Most Sent Today</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="phone_asc">Phone Number</option>
            </select>
          </div>
        </div>

        {/* Filter Pills Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-bold mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-700"
          >
            <option value="all">Status: All</option>
            <option value="connected">Connected Only</option>
            <option value="pending">Pending PIN</option>
            <option value="disconnected">Disconnected</option>
          </select>

          {/* Quality Filter */}
          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-700"
          >
            <option value="all">Quality: All</option>
            <option value="GREEN">High (Green)</option>
            <option value="YELLOW">Medium (Yellow)</option>
            <option value="RED">Low (Red)</option>
          </select>

          {/* Department Filter */}
          {availableDepartments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-700"
            >
              <option value="all">Department: All</option>
              {availableDepartments.map((d) => (
                <option key={d} value={d}>
                  Dept: {d}
                </option>
              ))}
            </select>
          )}

          {/* Branch Filter */}
          {branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-700"
            >
              <option value="all">Branch: All</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {/* Clear Filters Button if any active */}
          {(statusFilter !== "all" || qualityFilter !== "all" || deptFilter !== "all" || branchFilter !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setQualityFilter("all");
                setDeptFilter("all");
                setBranchFilter("all");
                setSearchQuery("");
              }}
              className="text-emerald-700 hover:text-emerald-800 font-bold underline ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Batch Operations Bar (when 1 or more selected) */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <span>{selectedIds.length} number(s) selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchPing}
                disabled={batchActionBusy}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm transition flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-teal-600" />
                Batch Ping
              </button>

              <button
                onClick={() => setBatchDeptModalOpen(true)}
                disabled={batchActionBusy}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition flex items-center gap-1.5"
              >
                <Building2 className="w-3.5 h-3.5" />
                Set Department
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 font-semibold"
              >
                Deselect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* VIEW MODE 1: Operations Cards */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSenders.map((sender) => {
            const ping = pingResults[sender.id];
            const isDefault = Boolean(sender.is_default);
            const isSelected = selectedIds.includes(sender.id);
            const dailySent = sender.current_day_sent || 0;
            const dailyLimit = sender.daily_limit || 1000;
            const usagePercent = Math.min(100, Math.round((dailySent / dailyLimit) * 100));

            return (
              <div
                key={sender.id}
                className={`relative bg-white rounded-2xl border transition shadow-sm hover:shadow-md flex flex-col justify-between ${
                  isSelected ? "ring-2 ring-emerald-500 border-emerald-500" : "border-slate-200"
                } ${sender.status !== "connected" ? "bg-amber-50/20" : ""}`}
              >
                <div className="p-5 space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSelectOne(sender.id)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 flex-shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">
                            {sender.verified_name || "WhatsApp Business"}
                          </h3>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline flex-shrink-0" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 font-mono">{sender.display_phone}</p>
                      </div>
                    </div>

                    {/* Default star button */}
                    {admin && (
                      <button
                        onClick={() => handleToggleDefault(sender)}
                        title={isDefault ? "Organization Default Sender" : "Click to make Default"}
                        className={`p-1 rounded-lg transition ${
                          isDefault
                            ? "text-amber-500 bg-amber-50"
                            : "text-slate-300 hover:text-amber-500 hover:bg-slate-50"
                        }`}
                      >
                        <Star className={`w-4 h-4 ${isDefault ? "fill-amber-400 text-amber-500" : ""}`} />
                      </button>
                    )}
                  </div>

                  {/* Badges strip */}
                  <div className="flex flex-wrap items-center gap-2">
                    {qualityBadge(sender.quality)}
                    {tierBadge(sender.messaging_tier)}
                    
                    {/* Department Tag */}
                    <button
                      onClick={() => handleOpenRoutingModal(sender)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition"
                      title="Click to edit department"
                    >
                      <Building2 className="w-3 h-3 text-purple-600" />
                      {sender.department_name || "Set Department"}
                    </button>
                  </div>

                  {/* Daily Limit & Throughput Gauge */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                      <span>Daily Messages: {dailySent.toLocaleString()}</span>
                      <span>Limit: {dailyLimit.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          usagePercent > 85 ? "bg-rose-500" : usagePercent > 50 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(2, usagePercent)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata box */}
                  <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100 text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-500">WABA Account:</span>
                      <span className="font-mono text-slate-800 font-semibold">{sender.waba_id || "Direct"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Branch Routing:</span>
                      <span className="font-semibold text-slate-800 text-right truncate max-w-[170px]">
                        {sender.assigned_branches || (sender.is_shared ? "All Branches (Shared)" : "None")}
                      </span>
                    </div>
                    {ping && (
                      <div className="flex justify-between pt-1 border-t border-slate-200">
                        <span className="text-slate-500">Live Ping:</span>
                        <span className={ping.success ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                          {ping.success ? `Healthy (${ping.latencyMs}ms)` : ping.error}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePingClick(sender)}
                      disabled={Boolean(busy)}
                      title="Ping Meta Graph API to verify connection and round-trip latency"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm transition"
                    >
                      <Activity className="w-3.5 h-3.5 text-teal-600" />
                      Ping
                    </button>

                    <button
                      onClick={() => {
                        setActiveSender(sender);
                        setTestResult(null);
                        setTestModalOpen(true);
                      }}
                      disabled={Boolean(busy) || sender.status !== "connected"}
                      title="Send a live test message to verify WhatsApp delivery"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Test Send
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {sender.status === "pending" && (
                      <button
                        onClick={() => {
                          setActiveSender(sender);
                          setPinModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded bg-amber-500 text-white hover:bg-amber-600 transition"
                      >
                        PIN
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenInspector(sender)}
                      className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm transition"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: Dense Enterprise Table */}
      {viewMode === "table" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredSenders.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                  </th>
                  <th className="py-3 px-4">Sender & Phone</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Quality & Tier</th>
                  <th className="py-3 px-4">WABA ID</th>
                  <th className="py-3 px-4">Sent (24h)</th>
                  <th className="py-3 px-4">Routing</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSenders.map((sender) => {
                  const ping = pingResults[sender.id];
                  const isDefault = Boolean(sender.is_default);
                  const isSelected = selectedIds.includes(sender.id);

                  return (
                    <tr key={sender.id} className={isSelected ? "bg-emerald-50/40" : "hover:bg-slate-50/70"}>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(sender.id)}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isDefault && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 flex-shrink-0" title="Default" />
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block">{sender.verified_name || "WhatsApp Business"}</span>
                            <span className="font-mono text-slate-600 text-[11px]">{sender.display_phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleOpenRoutingModal(sender)}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                        >
                          {sender.department_name || "Set"}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {qualityBadge(sender.quality)}
                          <span className="block text-[11px] text-slate-500 font-mono">{sender.messaging_tier || "TIER_250"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{sender.waba_id || "Direct"}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {sender.current_day_sent || 0}
                      </td>
                      <td className="py-3 px-4 max-w-[140px] truncate text-slate-700">
                        {sender.assigned_branches || (sender.is_shared ? "Shared Fallback" : "None")}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            sender.status === "connected"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {sender.status}
                        </span>
                        {ping && (
                          <span className="block text-[10px] text-slate-500 mt-0.5 font-mono">
                            {ping.latencyMs ? `${ping.latencyMs}ms` : "failed"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handlePingClick(sender)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                            title="Ping"
                          >
                            <Activity className="w-3.5 h-3.5 text-teal-600" />
                          </button>
                          <button
                            onClick={() => {
                              setActiveSender(sender);
                              setTestResult(null);
                              setTestModalOpen(true);
                            }}
                            disabled={sender.status !== "connected"}
                            className="p-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                            title="Test Send"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenInspector(sender)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                            title="Inspect"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: Asset Topology Tree */}
      {viewMode === "topology" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
          <div>
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <GitFork className="w-5 h-5 text-emerald-600" />
              Meta Asset Topology & Hierarchy
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Visual structure of authorized Meta Business Accounts, connected WABAs, and operating phone numbers.
            </p>
          </div>

          <div className="space-y-6">
            {/* Group senders by WABA ID */}
            {Array.from(new Set(senders.map((s) => s.waba_id || "Direct-Token"))).map((wabaId) => {
              const wabaSenders = senders.filter((s) => (s.waba_id || "Direct-Token") === wabaId);

              return (
                <div key={wabaId} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  {/* WABA Node */}
                  <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                        WA
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-sm">
                          WhatsApp Business Account: {wabaId}
                        </span>
                        <span className="block text-[11px] text-slate-500 font-mono">
                          {wabaSenders.length} Active Phone Number(s) Attached
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Shared Rate Limit: 80 msgs/sec
                    </span>
                  </div>

                  {/* Connected Phone Numbers Tree Branches */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {wabaSenders.map((s) => (
                      <div
                        key={s.id}
                        className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-xs block truncate">
                              {s.verified_name || s.display_phone}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 block">
                              {s.display_phone}
                            </span>
                            <span className="text-[10px] text-purple-700 font-semibold">
                              {s.department_name || "General"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {s.is_default && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Default
                            </span>
                          )}
                          <button
                            onClick={() => handleOpenInspector(s)}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                          >
                            Inspect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 4: Rate Limiting & Health Engine Analytics */}
      {viewMode === "analytics" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                Live Rate Limiting Engine & Sender Throughput
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time diagnostics for WABA Token Buckets, active in-flight sender concurrency, and hourly message delivery.
              </p>
            </div>
            <button
              onClick={() => {
                if (request) {
                  setLoadingDiagnostics(true);
                  request("get", "/meta/engine/diagnostics")
                    .then((res) => setDiagnostics(res))
                    .finally(() => setLoadingDiagnostics(false));
                }
              }}
              disabled={loadingDiagnostics}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDiagnostics ? "animate-spin" : ""}`} />
              Refresh Engine
            </button>
          </div>

          {/* Token Bucket Diagnostics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                WABA Token Bucket Rate Limiter
              </span>
              <p className="text-xs text-slate-600">
                Meta permits ~80 msgs/sec per WABA across all linked senders. Our engine coordinates outbound dispatch through token buckets to prevent Meta 429 errors.
              </p>

              {diagnostics?.activeWabaBuckets?.length ? (
                <div className="space-y-2 pt-2">
                  {diagnostics.activeWabaBuckets.map((b) => (
                    <div key={b.wabaId} className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <span>WABA: {b.wabaId}</span>
                        <span className="text-emerald-700">{b.availableTokens} / {b.capacity} Tokens</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.round((b.availableTokens / b.capacity) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Refill rate: {b.refillRate} tokens/sec
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No active WABA traffic currently queued.</p>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-teal-600" />
                Sender Concurrency & Throughput Today
              </span>
              <p className="text-xs text-slate-600">
                Total messages dispatched across each active number for today:
              </p>
              <div className="space-y-2 pt-1">
                {senders.slice(0, 5).map((s) => (
                  <div key={s.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block">{s.verified_name || s.display_phone}</span>
                      <span className="text-[11px] font-mono text-slate-500">{s.display_phone}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{s.current_day_sent || 0}</span>
                      <span className="text-[10px] text-slate-500 block">/ {s.daily_limit || 1000} limit</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Send Live Test Message */}
      {testModalOpen && activeSender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Send Live WhatsApp Test Message</h3>
              </div>
              <button
                onClick={() => setTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteTestSend} className="p-5 space-y-4">
              <div className="text-xs text-slate-600 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                Sending from: <strong>{activeSender.verified_name}</strong> ({activeSender.display_phone})
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Recipient Phone Number (with Country Code):
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 919876543210"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Test Message Body:
                </label>
                <textarea
                  rows={3}
                  required
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium border ${
                    testResult.success
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-rose-50 border-rose-300 text-rose-800"
                  }`}
                >
                  {testResult.success ? (
                    <div>
                      <p className="font-bold text-emerald-900">Dispatched through Meta Cloud API!</p>
                      <p className="font-mono text-[11px] mt-1 break-all">Meta ID: {testResult.metaMessageId}</p>
                    </div>
                  ) : (
                    <p>Dispatch Error: {testResult.error}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testSending || !testRecipient}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1.5 shadow"
                >
                  {testSending ? "Dispatching via Meta..." : "Send Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Register 6-Digit PIN */}
      {pinModalOpen && activeSender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-2">Register 6-Digit PIN</h3>
            <p className="text-xs text-slate-600 mb-4">
              Enter the two-step verification PIN for {activeSender.display_phone} to register it with Meta Cloud API.
            </p>
            <form onSubmit={handleExecutePinRegister} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="6-digit PIN"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full text-center tracking-widest text-xl font-mono px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow"
                >
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Department & Branch Routing */}
      {routingModalOpen && activeSender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Edit Routing: {activeSender.display_phone}
              </h3>
              <button onClick={() => setRoutingModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRoutingModal} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Department Label:</label>
                <input
                  type="text"
                  placeholder="e.g. Customer Support, Sales, Billing"
                  value={editingDept}
                  onChange={(e) => setEditingDept(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingIsShared}
                    onChange={(e) => setEditingIsShared(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Allow as organization fallback (handles unassigned branches)</span>
                </label>
              </div>

              {branches.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assign to Branches:</label>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {branches.map((b) => {
                      const isAssigned = editingBranchIds.includes(Number(b.id));
                      return (
                        <label key={b.id} className="flex items-center gap-2 py-1 text-slate-700 hover:bg-slate-50 px-1 rounded">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={(e) => {
                              const bid = Number(b.id);
                              setEditingBranchIds((prev) =>
                                e.target.checked ? [...prev, bid] : prev.filter((x) => x !== bid)
                              );
                            }}
                            className="rounded text-emerald-600"
                          />
                          <span>{b.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoutingModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Batch Department Tagging */}
      {batchDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">
              Set Department for {selectedIds.length} Number(s)
            </h3>
            <form onSubmit={handleSaveBatchDept} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales, Support Desk, Operations"
                  value={batchDeptName}
                  onChange={(e) => setBatchDeptName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBatchDeptModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchActionBusy}
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow"
                >
                  Apply to Selected
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: Sender Details & Audit Inspector */}
      {inspectorOpen && activeSender && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200 border-l border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">Sender Inspector</h3>
              </div>
              <button
                onClick={() => setInspectorOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{activeSender.verified_name}</h4>
                  <p className="font-mono text-xs text-slate-600">{activeSender.display_phone}</p>
                </div>
                {qualityBadge(activeSender.quality)}
              </div>
              <div className="flex gap-2 pt-1 text-xs">
                {tierBadge(activeSender.messaging_tier)}
                {activeSender.is_default && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">Default Sender</span>
                )}
              </div>
            </div>

            {/* Facts Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-semibold block">Phone Number ID</span>
                <span className="font-mono text-slate-900 font-bold break-all">{activeSender.phone_number_id}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-semibold block">WABA ID</span>
                <span className="font-mono text-slate-900 font-bold break-all">{activeSender.waba_id || "Direct"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-semibold block">Department</span>
                <span className="text-slate-900 font-bold">{activeSender.department_name || "General"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-semibold block">Daily Sent / Limit</span>
                <span className="text-slate-900 font-bold">{activeSender.current_day_sent || 0} / {activeSender.daily_limit || 1000}</span>
              </div>
            </div>

            {/* Webhook Settings Section */}
            {admin && senderWebhook && (
              <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs bg-slate-50/50">
                <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-600" /> Webhook Integration
                </h5>
                <div>
                  <span className="text-slate-500 font-medium block">Callback URL:</span>
                  <input
                    readOnly
                    value={senderWebhook.callbackUrl || "Not configured"}
                    className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded font-mono text-slate-700"
                  />
                </div>
                {senderWebhook.verifyToken && (
                  <div>
                    <span className="text-slate-500 font-medium block">Verify Token:</span>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        type="password"
                        value={senderWebhook.verifyToken}
                        className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded font-mono text-slate-700"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(senderWebhook.verifyToken);
                          alert("Verify token copied to clipboard!");
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Subscription Status:{" "}
                  <strong>{activeSender.webhook_subscribed_at ? "Confirmed Subscribed" : "Not Confirmed"}</strong>
                </p>
              </div>
            )}

            {/* Activity History */}
            <div className="space-y-3">
              <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" /> Recent Audit Activity
              </h5>
              {loadingDetails ? (
                <p className="text-xs text-slate-400">Loading audit history...</p>
              ) : senderActivity.length > 0 ? (
                <ol className="divide-y divide-slate-100 text-xs border border-slate-100 rounded-xl overflow-hidden">
                  {senderActivity.slice(0, 8).map((evt) => (
                    <li key={evt.id} className="p-3 bg-white hover:bg-slate-50 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800 block capitalize">
                          {evt.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">Revision {evt.revision}</span>
                      </div>
                      <time className="text-[11px] text-slate-400">
                        {new Date(evt.created_at).toLocaleDateString()}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-slate-400 italic">No recent activity recorded.</p>
              )}
            </div>

            {/* Disconnect Action */}
            {admin && (
              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to disconnect ${activeSender.display_phone}?`)) {
                      onDisconnect(activeSender.id);
                      setInspectorOpen(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                >
                  Disconnect Number
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
