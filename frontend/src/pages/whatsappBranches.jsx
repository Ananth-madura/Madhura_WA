import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import useWADialog from "../hooks/useWADialog";
/**
 * whatsappBranches.jsx
 *
 * Enterprise Multi-Branches Page.
 * Displays branches, operational hours, managers, staff assignments, and sender counts.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md §3, §16, §21
 */

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  GitBranch,
  Plus,
  Building2,
  Clock,
  Users,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  Star,
  Edit2,
  Archive,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { API } from "../config/api";
import { useEnterprise } from "../context/EnterpriseContext";

export default function WABranches() {
  const { activeTenant, isBranchManager, refreshEnterpriseContext } = useEnterprise();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState("");
  const visibleBranches = branches.filter(branch => `${branch.name || ""} ${branch.code || ""} ${branch.address || ""}`.toLowerCase().includes(search.toLowerCase()));

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [saving, setSaving] = useState(false);
  const branchDialog = useWADialog(showCreateModal || Boolean(editingBranch), () => { setShowCreateModal(false); setEditingBranch(null); }, saving);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    timezone: "Asia/Kolkata",
    phone: "",
    email: "",
    address: "",
  });

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (activeTenant?.id) headers["x-tenant-id"] = activeTenant.id;
    return headers;
  }, [activeTenant]);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const res = await axios.get(`${API}/api/v2/branches`, { headers }).catch(async () => {
        return axios.get(`/api/v2/branches`, { headers });
      });

      if (res?.data?.success) {
        setBranches(res.data.branches || []);
      }
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.message || "Failed to load branches" });
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      code: "",
      timezone: "Asia/Kolkata",
      phone: "",
      email: "",
      address: "",
    });
    setShowCreateModal(true);
  };

  const handleOpenEdit = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name || "",
      code: branch.code || "",
      timezone: branch.timezone || "Asia/Kolkata",
      phone: branch.phone || "",
      email: branch.email || "",
      address: branch.address || "",
    });
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!formData.name.trim() || !formData.code.trim()) { setNotice({ type: "error", text: "Enter a branch name and code." }); return; }
    setSaving(true);
    setNotice(null);

    try {
      const headers = getHeaders();
      if (editingBranch) {
        // Update
        await axios.patch(`${API}/api/v2/branches/${editingBranch.id}`, formData, { headers }).catch(async () => {
          return axios.patch(`/api/v2/branches/${editingBranch.id}`, formData, { headers });
        });
        setNotice({ type: "success", text: `Branch "${formData.name}" updated successfully.` });
        setEditingBranch(null);
      } else {
        // Create
        await axios.post(`${API}/api/v2/branches`, formData, { headers }).catch(async () => {
          return axios.post(`/api/v2/branches`, formData, { headers });
        });
        setNotice({ type: "success", text: `Branch "${formData.name}" created successfully.` });
        setShowCreateModal(false);
      }

      await fetchBranches();
      await refreshEnterpriseContext();
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || "Failed to save branch. Check your plan quota.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveBranch = async (branch) => {
    if (branch.is_head_office) {
      alert("The Head Office branch cannot be archived.");
      return;
    }

    if (!window.confirm(`Are you sure you want to archive "${branch.name}"?`)) return;

    try {
      const headers = getHeaders();
      await axios.delete(`${API}/api/v2/branches/${branch.id}`, { headers }).catch(async () => {
        return axios.delete(`/api/v2/branches/${branch.id}`, { headers });
      });
      setNotice({ type: "success", text: `Branch "${branch.name}" archived.` });
      await fetchBranches();
      await refreshEnterpriseContext();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.message || "Failed to archive branch" });
    }
  };

  const maxBranches = activeTenant?.max_branches || 1;
  const currentBranchCount = branches.length;
  const isQuotaReached = currentBranchCount >= maxBranches;

  return (
    <div className="wa-branches-page hl-page">
      <WAWorkspaceGuide section="branches" />
      {/* Top Banner Notice */}
      {notice && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between text-sm ${
            notice.type === "success"
              ? "bg-emerald-950/80 border border-emerald-700/80 text-emerald-200"
              : "bg-rose-950/80 border border-rose-700/80 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="text-emerald-400" size={24} />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Branches</h1>
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              {currentBranchCount} / {maxBranches} Branches
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Configure physical offices, branch routing queues, hours, staff allocation, and branch-dedicated WhatsApp lines.
          </p>
        </div>

        {isBranchManager && (
          <button
            onClick={handleOpenCreate}
            disabled={isQuotaReached}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
              isQuotaReached
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50"
            }`}
            title={isQuotaReached ? "Plan branch limit reached" : "Add new branch"}
          >
            <Plus size={16} />
            <span>Add Branch</span>
          </button>
        )}
      </div>

      {/* Plan Limit Callout if at max */}
      {isQuotaReached && (
        <div className="mt-4 p-3 bg-amber-950/30 border border-amber-600/40 rounded-lg text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-400 shrink-0" />
            <span>
              You have used all <strong>{maxBranches}</strong> branch slots included in your <strong>{activeTenant?.plan}</strong> plan. Upgrade your subscription to unlock additional branch queues.
            </span>
          </div>
        </div>
      )}

      <div className="wa-group-toolbar"><label><Building2 size={16} /><input aria-label="Find a branch" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a branch by name, code or location" /></label><span>{visibleBranches.length} of {branches.length} branches</span><button type="button" className="hl-btn-secondary" disabled={loading} onClick={fetchBranches}>Refresh</button></div>
      {/* Loading state */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 size={32} className="animate-spin mb-3 text-emerald-500" />
          <p className="text-sm">Loading branches?</p>
        </div>
      ) : visibleBranches.length === 0 ? <div className="hl-card hl-empty"><h2>{search ? "No matching branches" : "No branches available"}</h2><p>{search ? "Try a different name, branch code or location." : "Create your first branch to assign staff and route conversations."}</p>{search && <button type="button" className="hl-btn-secondary mt-4" onClick={() => setSearch("")}>Clear search</button>}</div> : (
        /* Branch Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
          {visibleBranches.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl border p-5 transition-all relative flex flex-col justify-between ${
                b.is_head_office === 1
                  ? "bg-slate-900/90 border-emerald-500/50 shadow-lg shadow-emerald-950/20"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-base text-white truncate">{b.name}</h2>
                      {b.is_head_office === 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          Head Office
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-emerald-400 uppercase tracking-wide">
                      Code: {b.code}
                    </span>
                  </div>

                  {isBranchManager && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                        title="Edit Branch"
                      >
                        <Edit2 size={14} />
                      </button>
                      {b.is_head_office !== 1 && (
                        <button
                          onClick={() => handleArchiveBranch(b)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                          title="Archive Branch"
                        >
                          <Archive size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  {b.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-slate-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{b.address}</span>
                    </div>
                  )}
                  {b.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-500 shrink-0" />
                      <span>{b.phone}</span>
                    </div>
                  )}
                  {b.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-500 shrink-0" />
                      <span>{b.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-slate-500 shrink-0" />
                    <span>Timezone: {b.timezone || "Asia/Kolkata"}</span>
                  </div>
                </div>
              </div>

              {/* Stats Footer */}
              <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-slate-800/80 text-center">
                <div className="bg-slate-950/60 rounded p-2">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Staff</span>
                  <span className="text-sm font-bold text-white flex items-center justify-center gap-1 mt-0.5">
                    <Users size={12} className="text-emerald-400" />
                    {b.staff_count || 0}
                  </span>
                </div>
                <div className="bg-slate-950/60 rounded p-2">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Senders</span>
                  <span className="text-sm font-bold text-white flex items-center justify-center gap-1 mt-0.5">
                    <Phone size={12} className="text-blue-400" />
                    {b.sender_count || 0}
                  </span>
                </div>
                <div className="bg-slate-950/60 rounded p-2">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Open Chats</span>
                  <span className="text-sm font-bold text-white flex items-center justify-center gap-1 mt-0.5">
                    <MessageSquare size={12} className="text-amber-400" />
                    {b.open_conversations_count || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreateModal || editingBranch) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div ref={branchDialog} role="dialog" aria-modal="true" aria-label={editingBranch ? "Edit branch" : "Create branch"} className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 max-h-[90dvh] overflow-y-auto">
            {notice?.type === "error" && <p role="alert" className="wa-form-error">{notice.text}</p>}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 size={18} className="text-emerald-400" />
                {editingBranch ? `Edit Branch: ${editingBranch.name}` : "Create New Branch"}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingBranch(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Branch Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chennai Office, Coimbatore Retail"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Branch Code (Unique) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CHN01, CBE_MAIN"
                  disabled={Boolean(editingBranch)}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 uppercase font-mono disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+91..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="branch@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Address / Location</label>
                <textarea
                  rows={2}
                  placeholder="Physical street address, city, state"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                  <option value="UTC">UTC (+0:00)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingBranch(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingBranch ? "Update Branch" : "Create Branch"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
