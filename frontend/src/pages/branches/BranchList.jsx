import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Building,
  Plus,
  Search,
  Users,
  Phone,
  Star,
  MoreVertical,
  ExternalLink,
  Edit2,
  RefreshCw,
  Archive,
  AlertTriangle,
  RotateCcw,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getBranches, archiveBranch, restoreBranch } from "../../api/branches";
import { useEnterprise } from "../../context/EnterpriseContext";

const CARD_ACTION_STYLE = {
  background: "var(--color-ink)",
  borderColor: "var(--color-ink)",
  color: "white",
};

export default function BranchList() {
  const { activeTenant } = useEnterprise();

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
    <div className="hl-page wa-branch-list-page crm-layout-content p-3 sm:p-6 w-full max-w-7xl mx-auto space-y-4">
      {/* Top Navigation Strip — same bar as /whatsapp/employees */}
      {/* Page Header */}
      <div className="hl-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0"
              style={{ background: "rgba(16, 185, 129, 0.15)", color: "#059669" }}
            >
              <Building size={18} />
            </div>
            <h1 className="hl-title text-xl sm:text-2xl" style={{ margin: 0 }}>
              Branch Directory &amp; Operations
            </h1>
            <span className="hl-badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#047857", borderColor: "rgba(5, 150, 105, 0.3)" }}>
              {activeTenant?.name || "Company"} Workspace
            </span>
          </div>
          <p className="text-xs sm:text-sm" style={{ color: "var(--color-ink-2)", margin: 0 }}>
            Manage organization branch locations, WhatsApp phone allocations, team roles, and message routing.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchBranches}
            disabled={loading}
            className="hl-btn-secondary"
            style={{ fontSize: 13, height: 38 }}
            title="Refresh directory"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            to="/whatsapp/branches/new"
            className="hl-btn-primary"
            style={{ fontSize: 13, height: 38, ...CARD_ACTION_STYLE }}
            title="Create a new branch"
          >
            <Plus size={15} />
            <span>Create New Branch</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="hl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            <span>Total Branches</span>
            <Building size={15} className="text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              {stats.total}
            </span>
            <span className="text-[11px] block text-gray-500 mt-0.5">Provisioned in organization</span>
          </div>
        </div>

        <div className="hl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            <span>Active Operating</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-700">{stats.active}</span>
            <span className="text-[11px] block text-emerald-600 mt-0.5">Live routing active</span>
          </div>
        </div>

        <div className="hl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            <span>Assigned Senders</span>
            <Phone size={15} className="text-sky-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-sky-700">{stats.sendersTotal}</span>
            <span className="text-[11px] block text-sky-600 mt-0.5">Dedicated &amp; shared WABAs</span>
          </div>
        </div>

        <div className="hl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            <span>Team Memberships</span>
            <Users size={15} className="text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-700">{stats.staffTotal}</span>
            <span className="text-[11px] block text-amber-600 mt-0.5">Allocated staff seats</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar — same bar pattern as /whatsapp/employees */}
      <div className="hl-card p-3 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branches, code, city, manager..."
            className="hl-input w-full"
            style={{ height: 38, fontSize: 13, paddingLeft: 36, paddingRight: 34 }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="hl-input w-full sm:w-auto"
            style={{ height: 38, fontSize: 13, minWidth: 175 }}
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
        <div
          className="hl-card p-4 text-sm flex items-center justify-between gap-3"
          style={{ background: "#fef2f2", borderColor: "#fca5a5", color: "#991b1b" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            onClick={fetchBranches}
            className="underline hover:opacity-70 text-xs font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Branch Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="hl-card h-44 animate-pulse" />
          ))}
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="hl-card p-12 text-center">
          <Building className="mx-auto text-gray-300 mb-3" size={36} />
          <h3 className="text-base font-semibold" style={{ color: "var(--color-ink)" }}>
            No branches found
          </h3>
          <p className="text-xs max-w-md mx-auto mt-1" style={{ color: "var(--color-ink-2)" }}>
            {search || statusFilter !== "all"
              ? "No branches match your current search or filter criteria. Try clearing filters."
              : "Set up your first branch to organize multiple WhatsApp queues, dedicated phone numbers, and local staff."}
          </p>
          <div className="mt-5">
            <Link
              to="/whatsapp/branches/new"
              className="hl-btn-primary"
              style={{ fontSize: 13, ...CARD_ACTION_STYLE }}
            >
              <Plus size={14} />
              <span>Launch First Branch</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch, index) => {
            const canonicalUrl = `/whatsapp/branches/${branch.id}/${branch.slug || "workspace"}/dashboard`;
            const isArchived = branch.status === "archived";

            return (
              <div
                key={branch.id}
                className={`hl-card hl-reveal group relative flex flex-col justify-between overflow-hidden transition-shadow hover:shadow-lg ${
                  isArchived ? "opacity-70" : ""
                }`}
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                {/* Branch Card Header */}
                <div className="p-4 sm:p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2
                          className="text-base font-bold truncate"
                          style={{ color: "var(--color-ink)" }}
                        >
                          {branch.name}
                        </h2>
                        {branch.is_head_office === 1 && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Star size={10} className="fill-amber-500" />
                            Head Office
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-1" style={{ color: "var(--color-ink-2)" }}>
                        <span className="font-mono font-bold text-emerald-700">{branch.code}</span>
                        {branch.city && <span>· {branch.city}</span>}
                        <span>· {branch.timezone || "Asia/Kolkata"}</span>
                      </div>
                    </div>

                    <div className="relative shrink-0">
                      <button
                        onClick={() =>
                          setActionMenuOpen((prev) => (prev === branch.id ? null : branch.id))
                        }
                        aria-label="Branch actions"
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {actionMenuOpen === branch.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 py-1.5 text-xs">
                          <Link
                            to={canonicalUrl}
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100"
                          >
                            <ExternalLink size={13} className="text-emerald-600" />
                            <span>Open Workspace</span>
                          </Link>
                          <Link
                            to={`/whatsapp/branches/${branch.id}/${branch.slug || "workspace"}/settings`}
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100"
                          >
                            <Edit2 size={13} className="text-slate-400" />
                            <span>Edit Settings</span>
                          </Link>
                          <div className="border-t border-slate-200 my-1" />
                          {isArchived ? (
                            <button
                              onClick={() => handleRestore(branch)}
                              disabled={actionLoading}
                              className="w-full text-left flex items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50"
                            >
                              <RotateCcw size={13} />
                              <span>Restore Branch</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchive(branch)}
                              disabled={actionLoading}
                              className="w-full text-left flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50"
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
                  <div
                    className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs"
                    style={{ borderColor: "var(--color-line)" }}
                  >
                    <span style={{ color: "var(--color-ink-2)" }} className="truncate">
                      Manager:{" "}
                      <strong style={{ color: "var(--color-ink)" }} className="font-medium">
                        {branch.manager?.name || branch.manager?.email || "Unassigned"}
                      </strong>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        branch.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : branch.status === "archived"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {branch.status?.toUpperCase()}
                    </span>
                  </div>

                  {/* Metrics preview */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center" style={{ borderColor: "var(--color-line)" }}>
                    <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-200/70">
                      <div className="text-[10px] text-slate-500 font-medium">Senders</div>
                      <div className="text-xs font-bold text-sky-700 font-mono mt-0.5">
                        {branch.senders_count || 0}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-200/70">
                      <div className="text-[10px] text-slate-500 font-medium">Staff</div>
                      <div className="text-xs font-bold text-amber-700 font-mono mt-0.5">
                        {branch.staff_count || 0}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-200/70">
                      <div className="text-[10px] text-slate-500 font-medium">Chats</div>
                      <div className="text-xs font-bold text-emerald-700 font-mono mt-0.5">
                        {branch.active_chats || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Action */}
                <div className="p-3 border-t border-slate-100" style={{ background: "var(--color-paper)", borderColor: "var(--color-line)" }}>
                  <Link
                    to={canonicalUrl}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99]"
                    style={CARD_ACTION_STYLE}
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
