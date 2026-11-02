import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Users,
  X,
  Search,
  Clock,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Share2,
  Eye,
  MessageSquare,
  FileText,
  UserPlus
} from "lucide-react";
import { API } from "../config/api";
import { waUiStorage } from "../utils/waUiStorage";
import WAContactAvatar from "./WAContactAvatar";

const PERMISSION_OPTIONS = [
  {
    level: "viewer",
    label: "View only",
    description: "Read chat history, documents and permitted records. Cannot send messages.",
    icon: Eye,
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20"
  },
  {
    level: "responder",
    label: "View and reply",
    description: "Read history and send WhatsApp messages to the customer.",
    icon: MessageSquare,
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  },
  {
    level: "collaborator",
    label: "Collaborator",
    description: "Send messages, add internal notes, and update customer contact details.",
    icon: FileText,
    badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
  },
  {
    level: "manager",
    label: "Manager",
    description: "Full collaboration access plus invite or remove other collaborators.",
    icon: Shield,
    badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20"
  }
];

const EXPIRATION_PRESETS = [
  { label: "Permanent (No expiration)", hours: 0 },
  { label: "1 Hour", hours: 1 },
  { label: "4 Hours", hours: 4 },
  { label: "24 Hours (1 Day)", hours: 24 },
  { label: "3 Days", hours: 72 },
  { label: "7 Days (1 Week)", hours: 168 },
  { label: "Custom Date/Time", hours: -1 }
];

export default function WAConversationShareModal({
  isOpen,
  onClose,
  chat,
  currentUser,
  enterpriseHeaders = {},
  onShareUpdated
}) {
  const [activeTab, setActiveTab] = useState("share"); // 'share' | 'collaborators' | 'timeline'
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Share form state
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [permissionLevel, setPermissionLevel] = useState("responder");
  const [expirationPreset, setExpirationPreset] = useState(0);
  const [customExpiresAt, setCustomExpiresAt] = useState("");
  const [sharingReason, setSharingReason] = useState("");

  // Existing collaborators & timeline
  const [collaborators, setCollaborators] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [resolvedConvId, setResolvedConvId] = useState(null);

  const getAuthHeaders = useCallback(() => {
    const token = waUiStorage.getItem("token");
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...enterpriseHeaders
    };
  }, [enterpriseHeaders]);

  // Resolve conversation ID if missing
  const resolveConversationId = useCallback(async () => {
    if (chat?.conversationId) {
      setResolvedConvId(Number(chat.conversationId));
      return Number(chat.conversationId);
    }
    const phone = chat?.phoneNumber || (chat?.id ? chat.id.replace(/\D/g, "") : "");
    if (!phone) return null;
    try {
      const res = await axios.get(`${API}/api/v2/inbox/conversations?search=${phone.slice(-10)}&limit=1`, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      const conv = res.data?.conversations?.[0];
      if (conv?.id) {
        setResolvedConvId(Number(conv.id));
        return Number(conv.id);
      }
    } catch (_) {}
    return null;
  }, [chat, getAuthHeaders]);

  // Fetch candidates & active collaborators
  const fetchData = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const convId = await resolveConversationId();
      if (!convId) {
        setError("Could not resolve active conversation ID for this customer.");
        setLoading(false);
        return;
      }

      const headers = getAuthHeaders();
      const [candRes, sharesRes, timelineRes] = await Promise.all([
        axios.get(`${API}/api/v2/inbox/conversations/${convId}/share-candidates?search=${encodeURIComponent(searchQuery)}`, {
          headers,
          withCredentials: true
        }).catch(() => ({ data: { candidates: [] } })),
        axios.get(`${API}/api/v2/inbox/conversations/${convId}/shares`, {
          headers,
          withCredentials: true
        }).catch(() => ({ data: { shares: [] } })),
        axios.get(`${API}/api/v2/inbox/conversations/${convId}/timeline?limit=30`, {
          headers,
          withCredentials: true
        }).catch(() => ({ data: { timeline: [] } }))
      ]);

      setCandidates(Array.isArray(candRes.data?.candidates) ? candRes.data.candidates : []);
      setCollaborators(Array.isArray(sharesRes.data?.shares) ? sharesRes.data.shares : []);
      setTimelineEvents(Array.isArray(timelineRes.data?.timeline) ? timelineRes.data.timeline : []);
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Failed to load sharing details");
    } finally {
      setLoading(false);
    }
  }, [resolveConversationId, searchQuery, getAuthHeaders]);

  useEffect(() => {
    if (isOpen) {
      setSelectedUserIds([]);
      setError("");
      setSuccess("");
      fetchData();
    }
  }, [isOpen, fetchData]);

  if (!isOpen || !chat) return null;

  const toggleSelectUser = (id) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllCandidates = () => {
    const unshared = candidates.filter((c) => !c.alreadyShared).map((c) => c.id);
    setSelectedUserIds(unshared);
  };

  const calculateExpiresAt = () => {
    if (expirationPreset === 0) return null;
    if (expirationPreset === -1) {
      return customExpiresAt ? new Date(customExpiresAt).toISOString() : null;
    }
    const d = new Date(Date.now() + expirationPreset * 3600000);
    return d.toISOString();
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserIds.length) {
      setError("Please select at least one employee to share with.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const convId = resolvedConvId || (await resolveConversationId());
      const payload = {
        userIds: selectedUserIds,
        permissionLevel,
        reason: sharingReason.trim() || null,
        expiresAt: calculateExpiresAt()
      };

      const res = await axios.post(`${API}/api/v2/inbox/conversations/${convId}/shares`, payload, {
        headers: getAuthHeaders(),
        withCredentials: true
      });

      setSuccess(`Conversation successfully shared with ${res.data?.count || selectedUserIds.length} employee(s).`);
      setSelectedUserIds([]);
      setSharingReason("");
      setExpirationPreset(0);
      setCustomExpiresAt("");
      await fetchData();
      if (onShareUpdated) onShareUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to share conversation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePermission = async (shareId, newPerm) => {
    try {
      const convId = resolvedConvId;
      await axios.patch(
        `${API}/api/v2/inbox/conversations/${convId}/shares/${shareId}`,
        { permissionLevel: newPerm },
        { headers: getAuthHeaders(), withCredentials: true }
      );
      setSuccess("Collaborator permission updated.");
      fetchData();
      if (onShareUpdated) onShareUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to update permission");
    }
  };

  const handleRevokeShare = async (shareId) => {
    if (!window.confirm("Revoke this collaborator's access to this conversation?")) return;
    try {
      const convId = resolvedConvId;
      await axios.delete(`${API}/api/v2/inbox/conversations/${convId}/shares/${shareId}`, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      setSuccess("Collaborator access revoked.");
      fetchData();
      if (onShareUpdated) onShareUpdated();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to revoke collaborator");
    }
  };

  const activeCollaboratorsCount = collaborators.filter((c) => c.effective_status === "active").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="hl-card w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden animate-scale-up"
        style={{ background: "var(--color-paper)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-rule)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
              <Share2 size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
                Share Conversation
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--color-ink-2)] border border-[var(--color-rule)]">
                  Multi-User Collaboration
                </span>
              </h2>
              <p className="text-xs text-[var(--color-ink-2)]">
                Grant authorized colleagues shared access without changing conversation ownership.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)] p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Chat Target Banner */}
        <div className="px-5 py-2.5 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <WAContactAvatar
              url={chat.profilePicUrl}
              name={chat.name}
              isGroup={Boolean(chat.isGroup)}
              size="sm"
            />
            <div className="truncate">
              <div className="font-bold text-[var(--color-ink)] truncate">
                {chat.name || chat.formattedPhone || "Customer"}
              </div>
              <div className="text-[11px] text-[var(--color-ink-2)] font-mono">
                {chat.formattedPhone || chat.phoneNumber || chat.id}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-[var(--color-ink-2)]">Owner:</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {chat.ownerName || currentUser?.first_name || currentUser?.name || "Assigned Agent"}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-[var(--color-rule)] bg-[var(--color-paper)] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("share")}
            className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
              activeTab === "share"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
            }`}
          >
            <UserPlus size={14} />
            <span>Invite Team</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("collaborators")}
            className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
              activeTab === "collaborators"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
            }`}
          >
            <Users size={14} />
            <span>Active Collaborators</span>
            {activeCollaboratorsCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-500 font-extrabold">
                {activeCollaboratorsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
              activeTab === "timeline"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
            }`}
          >
            <Clock size={14} />
            <span>Activity Timeline</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === "share" && (
            <form onSubmit={handleShareSubmit} className="space-y-4">
              {/* Employee Candidate Search */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[var(--color-ink)]">
                    1. Select Colleagues ({selectedUserIds.length} selected)
                  </label>
                  {candidates.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={selectAllCandidates}
                        className="text-indigo-600 hover:underline font-semibold"
                      >
                        Select All
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds([])}
                        className="text-[var(--color-ink-2)] hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-2)]" />
                  <input
                    type="search"
                    placeholder="Search employees by name, department, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-xs text-[var(--color-ink)] focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto border border-[var(--color-rule)] rounded-xl divide-y divide-[var(--color-rule)] bg-[var(--color-paper-2)]">
                  {loading ? (
                    <div className="p-4 text-center text-xs text-[var(--color-ink-2)]">Loading employees…</div>
                  ) : candidates.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--color-ink-2)]">
                      No matching colleagues found in this branch/organization.
                    </div>
                  ) : (
                    candidates.map((cand) => {
                      const isSelected = selectedUserIds.includes(cand.id);
                      return (
                        <div
                          key={cand.id}
                          onClick={() => !cand.alreadyShared && toggleSelectUser(cand.id)}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                            cand.alreadyShared
                              ? "opacity-60 cursor-not-allowed bg-slate-500/5"
                              : isSelected
                              ? "bg-indigo-500/10"
                              : "hover:bg-[var(--color-paper)]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected || cand.alreadyShared}
                              disabled={cand.alreadyShared}
                              onChange={() => {}}
                              className="rounded border-[var(--color-rule)] text-indigo-600"
                            />
                            <div className="truncate">
                              <span className="font-bold text-[var(--color-ink)] mr-2">{cand.name}</span>
                              <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[var(--color-ink-2)] mr-1">
                                {cand.department}
                              </span>
                              <span className="text-[11px] text-[var(--color-ink-2)]">{cand.email}</span>
                            </div>
                          </div>
                          <div>
                            {cand.alreadyShared ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 font-semibold">
                                Already Shared ({cand.currentPermission})
                              </span>
                            ) : cand.isAvailable ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                                Active
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold">
                                Busy
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 2. Permission Level Selection */}
              <div>
                <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
                  2. Choose Collaboration Access Level
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERMISSION_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = permissionLevel === opt.level;
                    return (
                      <div
                        key={opt.level}
                        onClick={() => setPermissionLevel(opt.level)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-500/5 shadow-xs"
                            : "border-[var(--color-rule)] hover:border-indigo-300 bg-[var(--color-paper-2)]"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${opt.badgeColor}`}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                            {opt.label}
                            {isSelected && <CheckCircle2 size={12} className="text-indigo-600" />}
                          </div>
                          <div className="text-[11px] text-[var(--color-ink-2)] line-clamp-2 mt-0.5">
                            {opt.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Expiration Preset & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                    3. Access Duration / Expiry
                  </label>
                  <select
                    value={expirationPreset}
                    onChange={(e) => setExpirationPreset(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-xs text-[var(--color-ink)]"
                  >
                    {EXPIRATION_PRESETS.map((p) => (
                      <option key={p.hours} value={p.hours}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  {expirationPreset === -1 && (
                    <input
                      type="datetime-local"
                      required
                      value={customExpiresAt}
                      onChange={(e) => setCustomExpiresAt(e.target.value)}
                      className="w-full mt-2 px-3 py-1.5 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-xs text-[var(--color-ink)]"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">
                    4. Internal Note / Reason (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    placeholder="e.g. Please verify payment screenshot with accounts"
                    value={sharingReason}
                    onChange={(e) => setSharingReason(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-2)] text-xs text-[var(--color-ink)]"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-rule)]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-[var(--color-rule)] text-xs font-semibold text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedUserIds.length}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition"
                >
                  <Share2 size={14} />
                  <span>{submitting ? "Sharing…" : `Share with ${selectedUserIds.length || ""} Colleagues`}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === "collaborators" && (
            <div className="space-y-3">
              <div className="text-xs text-[var(--color-ink-2)]">
                Active collaborators who currently have access to this conversation. Ownership remains strictly with{" "}
                <strong className="text-[var(--color-ink)]">{chat.ownerName || "the assigned owner"}</strong>.
              </div>

              {collaborators.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--color-ink-2)] border border-[var(--color-rule)] rounded-xl bg-[var(--color-paper-2)]">
                  <Users size={28} className="mx-auto mb-2 text-slate-400" />
                  <p className="font-semibold text-[var(--color-ink)]">No collaborators yet</p>
                  <p className="mt-1">Use the "Invite Team" tab to share this conversation with teammates.</p>
                </div>
              ) : (
                <div className="border border-[var(--color-rule)] rounded-xl divide-y divide-[var(--color-rule)] bg-[var(--color-paper-2)]">
                  {collaborators.map((c) => {
                    const isActive = c.effective_status === "active";
                    return (
                      <div key={c.id} className="p-3 flex items-center justify-between text-xs gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--color-ink)] flex items-center gap-2">
                            <span>{c.user_name}</span>
                            <span className="text-[11px] font-normal text-[var(--color-ink-2)] font-mono">
                              ({c.user_email})
                            </span>
                            {c.user_department && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[var(--color-ink-2)]">
                                {c.user_department}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--color-ink-2)] flex items-center gap-2 mt-0.5">
                            <span>Shared by {c.shared_by_name || "Admin"}</span>
                            <span>·</span>
                            <span>{new Date(c.created_at).toLocaleDateString()}</span>
                            {c.expires_at && (
                              <>
                                <span>·</span>
                                <span className={isActive ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-rose-500"}>
                                  {isActive
                                    ? `Expires: ${new Date(c.expires_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                                    : "Expired"}
                                </span>
                              </>
                            )}
                          </div>
                          {c.sharing_reason && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                              "{c.sharing_reason}"
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isActive ? (
                            <>
                              <select
                                value={c.permission_level}
                                onChange={(e) => handleUpdatePermission(c.id, e.target.value)}
                                className="px-2 py-1 rounded border border-[var(--color-rule)] bg-[var(--color-paper)] text-xs text-[var(--color-ink)] font-semibold"
                              >
                                {PERMISSION_OPTIONS.map((p) => (
                                  <option key={p.level} value={p.level}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                title="Revoke access"
                                onClick={() => handleRevokeShare(c.id)}
                                className="p-1.5 rounded hover:bg-rose-500/10 text-rose-500 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 font-semibold">
                              {c.effective_status}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="space-y-3">
              <div className="text-xs text-[var(--color-ink-2)]">
                Immutable activity history for this conversation including assignments, shares, and collaborator events.
              </div>

              {timelineEvents.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--color-ink-2)] border border-[var(--color-rule)] rounded-xl bg-[var(--color-paper-2)]">
                  No recorded timeline events for this conversation yet.
                </div>
              ) : (
                <ol className="relative border-l border-[var(--color-rule)] ml-3 space-y-4">
                  {timelineEvents.map((evt) => {
                    const date = new Date(evt.createdAt);
                    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
                    return (
                      <li key={evt.id} className="ml-4">
                        <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border border-[var(--color-paper)] bg-indigo-500" />
                        <div className="text-xs font-bold text-[var(--color-ink)]">
                          {evt.action === "shared" && (
                            <span>
                              {evt.actor?.name || "Staff"} shared conversation with{" "}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {evt.sharedWith?.name || "Colleague"}
                              </strong>{" "}
                              ({evt.details?.permissionLevel || "Responder"})
                            </span>
                          )}
                          {evt.action === "share_revoked" && (
                            <span>
                              {evt.actor?.name || "Staff"} revoked shared access for{" "}
                              <strong className="text-rose-500">{evt.sharedWith?.name || "Colleague"}</strong>
                            </span>
                          )}
                          {evt.action === "share_expired" && (
                            <span className="text-amber-600">
                              Shared access for {evt.sharedWith?.name || "Colleague"} expired automatically
                            </span>
                          )}
                          {evt.action === "assigned" && (
                            <span>
                              Conversation assigned to {evt.owner?.name || "Agent"} by {evt.actor?.name || "System"}
                            </span>
                          )}
                          {evt.action === "transferred" && (
                            <span>
                              Conversation transferred to {evt.owner?.name || "Agent"} ({evt.branch?.name})
                            </span>
                          )}
                        </div>
                        <time className="text-[11px] text-[var(--color-ink-2)]">
                          {dateStr} at {timeStr}
                        </time>
                        {evt.details?.reason && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">
                            Reason: "{evt.details.reason}"
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
