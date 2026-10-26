import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import useWADialog from "../hooks/useWADialog";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Inbox,
  Plus,
  Search,
  Trash2,
  Edit2,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Snowflake,
  Sun,
  Flame,
  CircleDot,
  Phone,
  Mail,
  Building,
  Users,
  ExternalLink,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import socket from "../socket/socket";
import {
  getEnquiries,
  getEnquirySummary,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry,
  convertEnquiry,
  ENQUIRY_TYPES,
  enquiryTypeLabel,
} from "../api/enquiries";
import { useAuth } from "../auth/AuthContext";

const TEMP_META = {
  new: {
    label: "New",
    badge: "hl-badge",
    color: "#64748b",
    bg: "rgba(100, 116, 139, 0.12)",
    icon: CircleDot,
    desc: "Not triaged yet",
  },
  cold: {
    label: "Cold",
    badge: "hl-badge-info",
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.12)",
    icon: Snowflake,
    desc: "Long nurture cycle",
  },
  warm: {
    label: "Warm",
    badge: "hl-badge-warn",
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.12)",
    icon: Sun,
    desc: "Showing real interest",
  },
  hot: {
    label: "Hot",
    badge: "hl-badge-error",
    color: "#dc2626",
    bg: "rgba(220, 38, 38, 0.12)",
    icon: Flame,
    desc: "Ready to close",
  },
};

const TEMP_ORDER = ["new", "cold", "warm", "hot"];

const STATUS_META = {
  open: { label: "Open", badge: "hl-badge" },
  converted: { label: "Converted", badge: "hl-badge-success" },
  lost: { label: "Lost", badge: "hl-badge-error" },
};

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  company: "",
  source: "manual",
  enquiry_type: "general",
  message: "",
  notes: "",
  temperature: "new",
};

export default function WAEnquiries() {
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "subadmin";

  const [enquiries, setEnquiries] = useState([]);
  const [summary, setSummary] = useState({ total: 0, new: 0, cold: 0, warm: 0, hot: 0, converted: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  // Deep-link support: /whatsapp/enquiries?temp=hot (used by the sidebar dropdown)
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedTemp = searchParams.get("temp");
  const [tempFilter, setTempFilter] = useState(
    TEMP_ORDER.includes(linkedTemp) ? linkedTemp : "all"
  );
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editEnquiry, setEditEnquiry] = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);
  const [convertResult, setConvertResult] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const formDialog = useWADialog(showCreateModal || Boolean(editEnquiry), () => {
    setShowCreateModal(false);
    setEditEnquiry(null);
  }, formLoading);
  const convertDialog = useWADialog(Boolean(convertTarget), () => setConvertTarget(null), false);
  const deleteDialog = useWADialog(Boolean(confirmDelete), () => setConfirmDelete(null), false);

  const [busyId, setBusyId] = useState(null);

  // A dialog that changes the list underneath it must not trigger a refetch —
  // refetch while the row is being edited/converted would swap it out mid-action.
  const modalOpen = showCreateModal || Boolean(editEnquiry) || Boolean(convertTarget) || Boolean(confirmDelete);
  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen;

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchEnquiries = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const params = { page, limit: 50 };
      if (tempFilter !== "all") params.temperature = tempFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const [data, sum] = await Promise.all([getEnquiries(params), getEnquirySummary()]);
      setEnquiries(data.enquiries || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setSummary(sum || {});
    } catch (err) {
      setError(err.response?.data?.message || err.friendlyMessage || "Failed to load enquiries.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, tempFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  // Any successful write anywhere in the app emits `data_changed`; refresh the
  // list so conversions done from a chat or another tab show up here too.
  useEffect(() => {
    let timer = null;
    const handleChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (modalOpenRef.current) return;
        fetchEnquiries(true);
      }, 400);
    };
    socket.on("data_changed", handleChange);
    return () => {
      clearTimeout(timer);
      socket.off("data_changed", handleChange);
    };
  }, [fetchEnquiries]);

  useEffect(() => {
    setPage(1);
    // Keep the URL in sync so a filtered view can be shared or bookmarked.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tempFilter === "all") next.delete("temp");
        else next.set("temp", tempFilter);
        return next;
      },
      { replace: true }
    );
  }, [tempFilter, statusFilter, searchQuery, setSearchParams]);

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setFormError("");
    setShowCreateModal(true);
  };

  const openEdit = (row) => {
    setFormData({
      name: row.name || "",
      phone: row.phone || "",
      email: row.email || "",
      company: row.company || "",
      source: row.source || "manual",
      enquiry_type: row.enquiry_type || "general",
      message: row.message || "",
      notes: row.notes || "",
      temperature: row.temperature || "new",
    });
    setFormError("");
    setEditEnquiry(row);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setFormLoading(true);
    setFormError("");
    try {
      if (editEnquiry) {
        await updateEnquiry(editEnquiry.id, formData);
        showToast("Enquiry updated.");
      } else {
        await createEnquiry(formData);
        showToast("Enquiry added to the pipeline.");
      }
      setShowCreateModal(false);
      setEditEnquiry(null);
      fetchEnquiries(true);
    } catch (err) {
      setFormError(err.response?.data?.message || "Could not save the enquiry.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleTempChange = async (row, temperature) => {
    if (row.temperature === temperature || busyId) return;
    setBusyId(row.id);
    try {
      await updateEnquiry(row.id, { temperature });
      setEnquiries((prev) => prev.map((r) => (r.id === row.id ? { ...r, temperature } : r)));
      showToast(`Marked ${row.name} as ${TEMP_META[temperature].label}.`);
      fetchEnquiries(true);
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update the temperature.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleConvert = async () => {
    const target = convertTarget;
    if (!target) return;
    setBusyId(target.id);
    try {
      const result = await convertEnquiry(target.id);
      setConvertTarget(null);
      setConvertResult(result);
      fetchEnquiries(true);
      showToast(
        result.deduped
          ? "Linked to the existing client — no duplicate created."
          : "Added to your CRM clients."
      );
    } catch (err) {
      showToast(err.response?.data?.message || "Conversion failed.", "error");
      setConvertTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    const target = confirmDelete;
    if (!target) return;
    setBusyId(target.id);
    try {
      await deleteEnquiry(target.id);
      setConfirmDelete(null);
      showToast("Enquiry deleted.");
      fetchEnquiries(true);
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete the enquiry.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const kpis = [
    { key: "total", label: "Total Enquiries", value: summary.total, icon: Inbox, color: "#059669" },
    { key: "new", label: "New / Unrated", value: summary.new, icon: CircleDot, color: "#64748b" },
    { key: "cold", label: "Cold", value: summary.cold, icon: Snowflake, color: "#2563eb" },
    { key: "warm", label: "Warm", value: summary.warm, icon: Sun, color: "#d97706" },
    { key: "hot", label: "Hot", value: summary.hot, icon: Flame, color: "#dc2626" },
    { key: "converted", label: "Converted", value: summary.converted, icon: UserCheck, color: "#059669" },
  ];

  return (
    <div className="hl-page wa-enquiries-page crm-layout-content p-3 sm:p-6 w-full max-w-7xl mx-auto space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[9999] animate-bounce-short">
          <div
            className={`hl-card flex items-center gap-3 px-4 py-3 shadow-xl ${
              toast.type === "error"
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800"
            }`}
            style={{ borderRadius: "var(--radius-md, 8px)" }}
          >
            {toast.type === "error" ? (
              <AlertCircle size={18} className="text-red-600" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-600" />
            )}
            <span className="text-xs font-semibold">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-gray-500 hover:text-gray-800">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <WAWorkspaceGuide section="enquiries" />

      {/* Page header */}
      <div className="hl-commandbar p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
              style={{ background: "rgba(217, 119, 6, 0.15)", color: "#d97706" }}
            >
              <Inbox size={18} />
            </div>
            <h1 className="hl-title text-xl sm:text-2xl" style={{ margin: 0 }}>
              Enquiries &amp; lead triage
            </h1>
          </div>
          <p className="text-xs sm:text-sm" style={{ color: "var(--color-ink-2)", margin: 0 }}>
            Rate every enquiry cold, warm or hot — then convert the ready ones straight into CRM clients.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchEnquiries()}
            disabled={loading}
            className="hl-btn-secondary"
            style={{ fontSize: 13, height: 38 }}
            title="Refresh enquiries"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={openCreate}
            className="hl-btn-primary"
            style={{
              fontSize: 13,
              height: 38,
              background: "linear-gradient(135deg, #d97706 0%, #ea580c 100%)",
              borderColor: "#b45309",
            }}
          >
            <Plus size={15} />
            <span>+ Add Enquiry</span>
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.key} className="hl-card p-4 flex flex-col justify-between">
              <div
                className="flex items-center justify-between text-xs font-semibold"
                style={{ color: "var(--color-ink-2)" }}
              >
                <span>{k.label}</span>
                <Icon size={15} style={{ color: k.color }} />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
                  {Number(k.value || 0)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search + temperature filter */}
      <div className="hl-card p-3 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, email or company..."
            className="hl-input w-full pl-9"
            style={{ height: 38, fontSize: 13 }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Temperature filter — the cold / warm / hot dropdown */}
          <select
            value={tempFilter}
            onChange={(e) => setTempFilter(e.target.value)}
            className="hl-input w-full sm:w-auto"
            style={{ height: 38, fontSize: 13, minWidth: 170 }}
            aria-label="Filter by lead temperature"
          >
            <option value="all">🌡️ All Temperatures</option>
            <option value="new">⬜ New / Unrated</option>
            <option value="cold">❄️ Cold</option>
            <option value="warm">☀️ Warm</option>
            <option value="hot">🔥 Hot</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="hl-input w-full sm:w-auto"
            style={{ height: 38, fontSize: 13, minWidth: 140 }}
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open Only</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="hl-card p-4 border-red-300 bg-red-50 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Enquiries table */}
      <div className="hl-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--color-paper-2, #f8fafc)",
                  borderBottom: "1px solid var(--color-line)",
                  color: "var(--color-ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontSize: 11,
                }}
              >
                <th style={{ padding: "12px 14px" }}>Enquiry</th>
                <th style={{ padding: "12px 14px" }}>Contact</th>
                <th style={{ padding: "12px 14px" }}>Company</th>
                <th style={{ padding: "12px 14px" }}>Temperature</th>
                <th style={{ padding: "12px 14px" }}>Status</th>
                <th style={{ padding: "12px 14px" }}>Added</th>
                <th style={{ padding: "12px 14px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && enquiries.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "36px 14px", textAlign: "center", color: "var(--color-ink-2)" }}>
                    Loading enquiries…
                  </td>
                </tr>
              )}

              {!loading && enquiries.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "44px 14px", textAlign: "center" }}>
                    <Inbox size={26} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-semibold text-gray-600 m-0">
                      {tempFilter !== "all"
                        ? `No ${TEMP_META[tempFilter]?.label.toLowerCase()} enquiries`
                        : "No enquiries yet"}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1 mb-0">
                      {tempFilter !== "all"
                        ? "Try another temperature, or add a new enquiry."
                        : "Add your first enquiry to start triaging leads."}
                    </p>
                  </td>
                </tr>
              )}

              {enquiries.map((row) => {
                const temp = TEMP_META[row.temperature] || TEMP_META.new;
                const TempIcon = temp.icon;
                const status = STATUS_META[row.status] || STATUS_META.open;
                return (
                  <tr
                    key={row.id}
                    style={{ borderBottom: "1px solid var(--color-rule, #eef2f7)" }}
                    className="hover:bg-slate-50/60 transition"
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <div className="font-semibold text-[13px] text-gray-900">{row.name}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-2,#64748b)] mt-0.5">
                        {enquiryTypeLabel(row.enquiry_type)}
                      </div>
                      {row.message && (
                        <div className="text-[11px] text-gray-500 mt-0.5 max-w-[260px] truncate" title={row.message}>
                          {row.message}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {row.phone && (
                        <div className="flex items-center gap-1.5 text-[12px] text-gray-700">
                          <Phone size={12} className="text-gray-400 shrink-0" />
                          <span>{row.phone}</span>
                        </div>
                      )}
                      {row.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                          <Mail size={12} className="text-gray-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{row.email}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {row.company ? (
                        <div className="flex items-center gap-1.5 text-[12px] text-gray-700">
                          <Building size={12} className="text-gray-400 shrink-0" />
                          <span>{row.company}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div className="flex items-center gap-1.5">
                        <TempIcon size={13} style={{ color: temp.color }} />
                        <select
                          value={row.temperature}
                          onChange={(e) => handleTempChange(row, e.target.value)}
                          disabled={busyId === row.id || row.status === "converted"}
                          className={`${temp.badge} cursor-pointer`}
                          style={{ height: 26, fontSize: 11, color: temp.color, background: temp.bg, border: "none" }}
                          aria-label={`Temperature for ${row.name}`}
                        >
                          {TEMP_ORDER.map((t) => (
                            <option key={t} value={t}>
                              {TEMP_META[t].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span className={status.badge} style={{ fontSize: 11 }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--color-ink-2)" }}>
                      {row.created_at ? String(row.created_at).slice(0, 10) : "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div className="flex items-center justify-end gap-1.5">
                        {row.status !== "converted" && (
                          <button
                            onClick={() => setConvertTarget(row)}
                            disabled={busyId === row.id}
                            className="hl-badge hl-badge-success cursor-pointer"
                            style={{ fontSize: 11 }}
                            title="Add this lead to the CRM clients list"
                          >
                            <UserCheck size={12} />
                            <span className="hidden md:inline">Convert to Client</span>
                          </button>
                        )}
                        {row.status === "converted" && row.converted_client_id && (
                          <Link
                            to="/whatsapp/client-portal"
                            className="hl-badge hl-badge-success"
                            style={{ fontSize: 11 }}
                            title="Open in the CRM clients list"
                          >
                            <CheckCircle2 size={12} />
                            <span className="hidden md:inline">In Clients</span>
                            <ExternalLink size={10} />
                          </Link>
                        )}
                        <button
                          onClick={() => openEdit(row)}
                          className="hl-badge cursor-pointer"
                          style={{ fontSize: 11 }}
                          title="Edit enquiry"
                        >
                          <Edit2 size={12} />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setConfirmDelete(row)}
                            className="hl-badge hl-badge-error cursor-pointer"
                            style={{ fontSize: 11 }}
                            title="Delete enquiry"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-[11px]" style={{ color: "var(--color-ink-2)" }}>
              {total} enquiry{total === 1 ? "" : "ies"} · page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="hl-btn-secondary"
                style={{ fontSize: 12, height: 30 }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="hl-btn-secondary"
                style={{ fontSize: 12, height: 30 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add / Edit enquiry */}
      {(showCreateModal || editEnquiry) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            ref={formDialog}
            role="dialog"
            aria-modal="true"
            aria-label={editEnquiry ? "Edit enquiry" : "Add enquiry"}
            className="hl-card w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden animate-scale-up rounded-2xl shadow-2xl"
            style={{ background: "var(--color-paper)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Inbox size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 m-0">
                    {editEnquiry ? "Edit Enquiry" : "Add New Enquiry"}
                  </h3>
                  <p className="text-[11px] text-gray-500 m-0">
                    {editEnquiry ? "Update the lead details or re-rate it" : "Capture a new lead into the pipeline"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditEnquiry(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 flex-1 overflow-y-auto wa-custom-scrollbar overscroll-contain">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-red-700" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Name *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Users size={15} />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="hl-input w-full pl-9 pr-3 h-10 text-sm"
                      placeholder="e.g. Ananya Deshpande"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Phone</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Phone size={15} />
                      </div>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="hl-input w-full pl-9 pr-3 h-10 text-sm"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Mail size={15} />
                      </div>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="hl-input w-full pl-9 pr-3 h-10 text-sm"
                        placeholder="lead@company.com"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                    Enquiry type
                  </label>
                  <select
                    value={formData.enquiry_type || "general"}
                    onChange={(e) => setFormData({ ...formData, enquiry_type: e.target.value })}
                    className="hl-select w-full"
                    style={{ height: 40, fontSize: 13 }}
                  >
                    {ENQUIRY_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Company</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Building size={15} />
                      </div>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="hl-input w-full pl-9 pr-3 h-10 text-sm"
                        placeholder="Acme Traders"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                      Lead Temperature
                    </label>
                    <select
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                      className="hl-select w-full"
                      style={{ height: 40, fontSize: 13 }}
                    >
                      {TEMP_ORDER.map((t) => (
                        <option key={t} value={t}>
                          {TEMP_META[t].label} — {TEMP_META[t].desc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                    What did they ask for?
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="hl-input w-full p-3 text-sm"
                    rows={3}
                    placeholder="Interested in an annual maintenance quote…"
                  />
                </div>

                <div>
                  <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="hl-input w-full p-3 text-sm"
                    rows={2}
                    placeholder="Follow-up timing, budget, decision maker…"
                  />
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditEnquiry(null);
                  }}
                  className="hl-btn-secondary"
                  style={{ fontSize: 13, height: 38 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="hl-btn-primary"
                  style={{ fontSize: 13, height: 38 }}
                >
                  {formLoading ? "Saving…" : editEnquiry ? "Save Changes" : "Add Enquiry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Convert confirmation */}
      {convertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            ref={convertDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Convert enquiry to client"
            className="hl-card w-full max-w-md overflow-hidden animate-scale-up rounded-2xl shadow-2xl"
            style={{ background: "var(--color-paper)" }}
          >
            <div className="px-5 py-4 border-b border-gray-100 bg-emerald-50/70 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <UserCheck size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900 m-0">Convert to Client</h3>
                <p className="text-[11px] text-gray-500 m-0">Adds {convertTarget.name} to your CRM clients</p>
              </div>
            </div>

            <div className="p-5 text-sm text-gray-700 space-y-2.5">
              <p className="m-0">
                <strong>{convertTarget.name}</strong>
                {convertTarget.company ? ` · ${convertTarget.company}` : ""} will be created as a CRM client, so it
                appears in your client list, campaign pickers and contact CRM details.
              </p>
              <p className="m-0 text-xs text-gray-500">
                If a client with the same phone or email already exists, that client is linked instead — no duplicate
                is created.
              </p>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-slate-50/60">
              <button onClick={() => setConvertTarget(null)} className="hl-btn-secondary" style={{ fontSize: 13, height: 38 }}>
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={busyId === convertTarget.id}
                className="hl-btn-primary"
                style={{ fontSize: 13, height: 38, background: "#059669", borderColor: "#047857" }}
              >
                {busyId === convertTarget.id ? "Converting…" : "Yes, convert it"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Convert result */}
      {convertResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Conversion result"
            className="hl-card w-full max-w-md overflow-hidden animate-scale-up rounded-2xl shadow-2xl"
            style={{ background: "var(--color-paper)" }}
          >
            <div className="px-5 py-4 border-b border-gray-100 bg-emerald-50/70 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900 m-0">
                  {convertResult.deduped ? "Linked to existing client" : "Client created"}
                </h3>
                <p className="text-[11px] text-gray-500 m-0">
                  {convertResult.deduped
                    ? "A matching client already existed, so no duplicate was added."
                    : "This lead is now in your CRM clients list."}
                </p>
              </div>
            </div>

            {convertResult.client && (
              <div className="p-5 text-sm text-gray-700 space-y-1">
                <div>
                  <strong>{convertResult.client.name}</strong>
                </div>
                {convertResult.client.phone && <div className="text-xs text-gray-500">{convertResult.client.phone}</div>}
                {convertResult.client.email && <div className="text-xs text-gray-500">{convertResult.client.email}</div>}
              </div>
            )}

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-slate-50/60">
              <button onClick={() => setConvertResult(null)} className="hl-btn-secondary" style={{ fontSize: 13, height: 38 }}>
                Close
              </button>
              <Link to="/whatsapp/client-portal" className="hl-btn-primary" style={{ fontSize: 13, height: 38 }}>
                Open Clients
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            ref={deleteDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Delete enquiry"
            className="hl-card w-full max-w-sm overflow-hidden animate-scale-up rounded-2xl shadow-2xl"
            style={{ background: "var(--color-paper)" }}
          >
            <div className="p-5">
              <h3 className="font-bold text-base text-gray-900 m-0 mb-1.5">Delete enquiry?</h3>
              <p className="text-sm text-gray-600 m-0">
                “{confirmDelete.name}” will be removed from the pipeline. Any client it was converted to is not
                affected.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-slate-50/60">
              <button onClick={() => setConfirmDelete(null)} className="hl-btn-secondary" style={{ fontSize: 13, height: 38 }}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={busyId === confirmDelete.id}
                className="hl-btn-primary"
                style={{ fontSize: 13, height: 38, background: "#dc2626", borderColor: "#b91c1c" }}
              >
                {busyId === confirmDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating mobile add button */}
      <button
        onClick={openCreate}
        className="md:hidden fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white"
        style={{ background: "linear-gradient(135deg, #d97706 0%, #ea580c 100%)" }}
        aria-label="Add enquiry"
      >
        <Plus size={22} />
      </button>
    </div>
  );
}
