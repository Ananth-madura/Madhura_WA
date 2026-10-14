import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  GitBranch,
  Plus,
  Search,
  Filter,
  Building,
  Users,
  Phone,
  MessageSquare,
  Star,
  MoreVertical,
  ExternalLink,
  Edit2,
  Trash2,
  RefreshCw,
  Archive,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getBranches, archiveBranch, restoreBranch } from "../../api/branches";
import { useEnterprise } from "../../context/EnterpriseContext";

export default function BranchList() {
  const navigate = useNavigate();
  const { activeTenant, isOrgAdmin } = useEnterprise();

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getBranches({ status: statusFilter === "all" ? undefined : statusFilter });
      if (res.success) {
        setBranches(res.branches || []);
      } else {
        setError(res.message || "Failed to load branches");
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleArchive = async (branch) => {
    if (!window.confirm(`Are you sure you want to archive "${branch.name}"? Active outbound and flows will be paused.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await archiveBranch(branch.id);
      if (res.success) {
        await fetchBranches();
      } else {
        alert(res.message || "Failed to archive branch");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
      setActionMenuOpen(null);
    }
  };

  const handleRestore = async (branch) => {
    setActionLoading(true);
    try {
      const res = await restoreBranch(branch.id);
      if (res.success) {
        await fetchBranches();
      } else {
        alert(res.message || "Failed to restore branch");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
      setActionMenuOpen(null);
    }
  };

  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        b.name?.toLowerCase().includes(term) ||
        b.code?.toLowerCase().includes(term) ||
        b.city?.toLowerCase().includes(term) ||
        b.manager?.name?.toLowerCase().includes(term)
      );
    });
  }, [branches, search]);

  const stats = useMemo(() => {
    const total = branches.length;
    const active = branches.filter((b) => b.status === "active").length;
    const sendersTotal = branches.reduce((sum, b) => sum + (b.senders_count || 0), 0);
    const staffTotal = branches.reduce((sum, b) => sum + (b.staff_count || 0), 0);
    return { total, active, sendersTotal, staffTotal };
  }, [branches]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
              {activeTenant?.name || "Company"} Workspace
            </span>
            <span className="text-xs text-slate-500">· Multi-Branch Operating System</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-1 flex items-center gap-2.5">
            <Building className="text-emerald-400" size={26} />
            Branch Directory & Operations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage organization branch locations, WhatsApp phone allocations, team roles, and message routing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBranches}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to="/whatsapp/branches/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={16} />
            <span>Create New Branch</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Building size={14} className="text-slate-400" /> Total Branches
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1">Provisioned in organization</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" /> Active Operating
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{stats.active}</div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Live routing active</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Phone size={14} className="text-sky-400" /> Assigned Senders
          </div>
          <div className="text-2xl font-bold text-sky-400 mt-1 font-mono">{stats.sendersTotal}</div>
          <div className="text-[11px] text-slate-500 mt-1">Dedicated & shared WABAs</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-sm">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Users size={14} className="text-amber-400" /> Team Memberships
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{stats.staffTotal}</div>
          <div className="text-[11px] text-slate-500 mt-1">Allocated staff seats</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branches, code, city, manager..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={14} className="text-slate-400 ml-1" />
          <span className="text-xs text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-600"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft / Onboarding</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchBranches} className="underline hover:text-rose-200">
            Retry
          </button>
        </div>
      )}

      {/* Branch Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="h-48 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse p-5" />
          ))}
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
          <Building className="mx-auto text-slate-600 mb-3" size={36} />
          <h3 className="text-base font-semibold text-slate-200">No branches found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            {search || statusFilter !== "all"
              ? "No branches match your current search or filter criteria. Try clearing filters."
              : "Set up your first branch to organize multiple WhatsApp queues, dedicated phone numbers, and local staff."}
          </p>
          <div className="mt-5">
            <Link
              to="/whatsapp/branches/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
            >
              <Plus size={14} />
              <span>Launch First Branch</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBranches.map((branch) => {
            const canonicalUrl = `/whatsapp/branches/${branch.id}/${branch.slug || "workspace"}/dashboard`;
            const isArchived = branch.status === "archived";

            return (
              <div
                key={branch.id}
                className={`group relative rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-lg ${
                  isArchived
                    ? "bg-slate-950/60 border-slate-850 opacity-75"
                    : "bg-slate-900 border-slate-800 hover:border-emerald-600/50 hover:shadow-emerald-950/20"
                }`}
              >
                {/* Branch Card Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-slate-100 truncate group-hover:text-emerald-300 transition-colors">
                          {branch.name}
                        </h2>
                        {branch.is_head_office === 1 && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80">
                            <Star size={10} className="fill-amber-300" />
                            Head Office
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span className="font-mono font-bold text-emerald-400">{branch.code}</span>
                        {branch.city && <span>· {branch.city}</span>}
                        <span>· {branch.timezone || "Asia/Kolkata"}</span>
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() =>
                          setActionMenuOpen((prev) => (prev === branch.id ? null : branch.id))
                        }
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {actionMenuOpen === branch.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-20 py-1.5 text-xs">
                          <Link
                            to={canonicalUrl}
                            className="flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800/80"
                          >
                            <ExternalLink size={13} className="text-emerald-400" />
                            <span>Open Workspace</span>
                          </Link>
                          <Link
                            to={`/whatsapp/branches/${branch.id}/${branch.slug || "workspace"}/settings`}
                            className="flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800/80"
                          >
                            <Edit2 size={13} className="text-slate-400" />
                            <span>Edit Settings</span>
                          </Link>
                          <div className="border-t border-slate-800/80 my-1" />
                          {isArchived ? (
                            <button
                              onClick={() => handleRestore(branch)}
                              disabled={actionLoading}
                              className="w-full text-left flex items-center gap-2 px-3 py-2 text-emerald-400 hover:bg-slate-800/80"
                            >
                              <RotateCcw size={13} />
                              <span>Restore Branch</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchive(branch)}
                              disabled={actionLoading}
                              className="w-full text-left flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-slate-800/80"
                            >
                              <Archive size={13} />
                              <span>Archive Branch</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Manager and Status line */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Manager:{" "}
                      <strong className="text-slate-200 font-medium">
                        {branch.manager?.name || branch.manager?.email || "Unassigned"}
                      </strong>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        branch.status === "active"
                          ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/80"
                          : branch.status === "archived"
                          ? "bg-rose-950/60 text-rose-400 border-rose-800/80"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {branch.status?.toUpperCase()}
                    </span>
                  </div>

                  {/* Metrics preview */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/60 text-center">
                    <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/50">
                      <div className="text-[10px] text-slate-500 font-medium">Senders</div>
                      <div className="text-xs font-bold text-sky-400 font-mono mt-0.5">
                        {branch.senders_count || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/50">
                      <div className="text-[10px] text-slate-500 font-medium">Staff</div>
                      <div className="text-xs font-bold text-amber-400 font-mono mt-0.5">
                        {branch.staff_count || 0}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/50">
                      <div className="text-[10px] text-slate-500 font-medium">Chats</div>
                      <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                        {branch.active_chats || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Action */}
                <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between">
                  <Link
                    to={canonicalUrl}
                    className="w-full text-center py-2 px-3 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Enter Workspace</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
