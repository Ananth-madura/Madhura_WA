import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import InboxRoutingSettings from "../components/InboxRoutingSettings";
import useWADialog from "../hooks/useWADialog";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Search,
  Trash2,
  Edit2,
  Send,
  MessageCircle,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  BarChart3,
  Clock,
  Mail,
  ExternalLink,
  User,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import { useAuth } from "../auth/AuthContext";
import { useEnterprise } from "../context/EnterpriseContext";

const ACCESS_LEVEL_META = {
  full: {
    label: "Full WhatsApp Access",
    shortLabel: "Full Access",
    badge: "hl-badge-success",
    color: "#202C52",
    bg: "rgba(32, 44, 82, 0.08)",
    icon: ShieldCheck,
    desc: "Complete access to live chat inbox, bulk campaigns, contact groups, and automated flows.",
  },
  chat_only: {
    label: "Live Chat Only",
    shortLabel: "Chat Only",
    badge: "hl-badge-info",
    color: "#2563EB",
    bg: "rgba(37, 99, 235, 0.08)",
    icon: MessageCircle,
    desc: "1-on-1 customer chat inbox access. Can respond to customer inquiries and send templates.",
  },
  read_only: {
    label: "Read Only",
    shortLabel: "Read Only",
    badge: "hl-badge",
    color: "#667085",
    bg: "rgba(100, 116, 139, 0.08)",
    icon: Eye,
    desc: "View-only access to customer chat history, logs, and analytics. Outbound messaging is disabled.",
  },
  campaign_only: {
    label: "Campaigns Only",
    shortLabel: "Campaigns",
    badge: "hl-badge-warn",
    color: "#D97706",
    bg: "rgba(217, 119, 6, 0.08)",
    icon: Send,
    desc: "Create and launch bulk broadcasts, templates, and contact segments. Chat inbox is hidden.",
  },
};

export default function WAEmployees() {
  const { user, demoMode } = useAuth();
  const { activeTenant, activeBranch, branches, enterpriseHeaders, isOwnerOrAdmin, actorRole, loading: orgLoading } = useEnterprise();
  const subadmin = actorRole === "subadmin" || user?.role === "subadmin";

  const [employees, setEmployees] = useState([]);
  const employeeRequest = useRef(0);
  const [analytics, setAnalytics] = useState({
    total_employees: 0,
    active_employees: 0,
    pending_activation: 0,
    access_levels: { full: 0, chat_only: 0, read_only: 0, campaign_only: 0 },
    total_messages_dispatched: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdEmployeeResult, setCreatedEmployeeResult] = useState(null);
  const [editEmployee, setEditEmployee] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "employee",
    whatsapp_access_level: "full",
    job_title: "WhatsApp Support Executive",
    mobile: "",
    branch_id: activeBranch?.id || 1,
  });

  useEffect(() => {
    if (activeBranch?.id) {
      setFormData((prev) => (prev.branch_id === activeBranch.id ? prev : { ...prev, branch_id: activeBranch.id }));
    }
  }, [activeBranch?.id]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const employeeDialog = useWADialog(showCreateModal, () => setShowCreateModal(false), formLoading);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const enterpriseHeadersKey = useMemo(() => JSON.stringify(enterpriseHeaders || {}), [enterpriseHeaders]);

  const fetchEmployees = useCallback(async () => {
    const version = ++employeeRequest.current;
    if (orgLoading || !isOwnerOrAdmin) return;
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(enterpriseHeaders || {}),
      };
      const params = branchFilter !== "all" ? { branchId: branchFilter } : {};
      const { data } = await axios.get(`${API}/api/auth/employees`, { headers, params });
      if (version !== employeeRequest.current) return;

      if (data?.employees) {
        setEmployees(data.employees);
      }
      if (data?.analytics) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      if (version !== employeeRequest.current) return;
      if (err.response?.status === 403) {
        setError("Access Denied: Only workspace administrators can manage employees.");
      } else {
        setError(err.response?.data?.message || "Failed to load employees list.");
      }
    } finally {
      if (version === employeeRequest.current) setLoading(false);
    }
    // enterpriseHeadersKey serializes enterpriseHeaders to avoid re-triggering across identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, enterpriseHeadersKey, branchFilter, isOwnerOrAdmin, orgLoading]);

  useEffect(() => {
    fetchEmployees();
    const invalidate = () => { employeeRequest.current++; };
    return invalidate;
  }, [fetchEmployees]);

  const handleCopy = async (code, id) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      showToast("Access code copied.");
      setTimeout(() => setCopiedCodeId(null), 2500);
    } catch { showToast("Clipboard access is unavailable. Select and copy the access code manually.", "error"); }
  };

  const handleCopyInvitation = async (emp) => {
    const signupUrl = `${window.location.origin}/signup`;
    const message = `Hi ${emp.first_name},\n\nYou have been invited to access our WhatsApp CRM workspace!\n\n1. Go to: ${signupUrl}\n2. Select "Join with Access Code"\n3. Enter your Access Code: ${emp.access_code}\n4. Email: ${emp.email}\n5. Set your password to activate your ${ACCESS_LEVEL_META[emp.whatsapp_access_level || "full"]?.shortLabel || "employee"} WhatsApp access.`;

    try {
      await navigator.clipboard.writeText(message);
      showToast(`Invitation instructions for ${emp.first_name} copied.`);
    } catch { showToast("The invitation could not be copied. Check browser clipboard permissions and retry.", "error"); }
  };

  const handleRegenerateCode = async (empId, empName) => {
    if (!window.confirm(`Generate a brand new Access Code for ${empName}?\n\nThe previous code will be invalidated immediately.`)) {
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(`${API}/api/auth/employees/${empId}/regenerate-code`, {}, { headers });
      showToast(`New Access Code generated: ${data?.access_code}`);
      fetchEmployees();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to regenerate code", "error");
    }
  };

  const handleDeleteEmployee = async (empId, empName) => {
    if (!window.confirm(`Are you sure you want to remove ${empName}?\n\nThis employee will lose all access to the workspace immediately.`)) {
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API}/api/auth/employees/${empId}`, { headers });
      showToast(`Employee ${empName} removed.`);
      fetchEmployees();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete employee", "error");
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      const token = localStorage.getItem("token");
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...enterpriseHeaders,
      };
      const { data } = await axios.post(`${API}/api/auth/employees`, formData, { headers });

      setShowCreateModal(false);
      setCreatedEmployeeResult(data.employee);
      fetchEmployees();
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        role: "employee",
        whatsapp_access_level: "full",
        job_title: "WhatsApp Support Executive",
        mobile: "",
      });
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to create employee.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateAccessLevel = async (e) => {
    e.preventDefault();
    if (!editEmployee) return;

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(
        `${API}/api/auth/employees/${editEmployee.id}`,
        {
          whatsapp_access_level: editEmployee.whatsapp_access_level,
          role: editEmployee.role,
          job_title: editEmployee.job_title,
          status: editEmployee.status,
          branch_id: editEmployee.branch_id ? Number(editEmployee.branch_id) : undefined,
        },
        { headers }
      );
      showToast("Employee access level updated successfully!");
      setEditEmployee(null);
      fetchEmployees();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update employee", "error");
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      emp.first_name?.toLowerCase().includes(q) ||
      emp.last_name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.emp_id?.toLowerCase().includes(q) ||
      emp.access_code?.toLowerCase().includes(q);

    const matchesLevel =
      levelFilter === "all" ||
      (emp.whatsapp_access_level || "full") === levelFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && emp.status === "active") ||
      (statusFilter === "pending" && emp.status !== "active");

    const matchesBranch =
      branchFilter === "all" ||
      Number(emp.branch_id) === Number(branchFilter);

    return matchesSearch && matchesLevel && matchesStatus && matchesBranch;
  });

  if (!orgLoading && !isOwnerOrAdmin) {
    return (
      <div className="hl-page wa-employees-page crm-layout-content p-4 sm:p-6 max-w-4xl mx-auto">
        <WAWorkspaceGuide section="employees" />
        <div
          className="hl-card text-center p-8 sm:p-12 mt-6"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            border: "1px solid var(--color-rule, #E8E8E8)",
            borderRadius: "var(--radius-lg, 14px)",
          }}
        >
          <div
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
            style={{ background: "rgba(32, 44, 82, 0.08)", color: "var(--color-ink, #202C52)" }}
          >
            <ShieldAlert size={32} />
          </div>
          <h2 className="hl-title text-xl mb-2" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
            Deep Staff Isolation Active
          </h2>
          <p
            className="text-sm max-w-md mx-auto mb-6"
            style={{ color: "var(--color-ink-2, #667085)", lineHeight: 1.6 }}
          >
            Your account is assigned employee-level WhatsApp access. To protect organization privacy,
            employee profiles and staff access codes are exclusively managed by your workspace administrator.
          </p>
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: "var(--color-surface, #F5F5F5)",
              color: "var(--color-ink, #202C52)",
              border: "1px solid var(--color-rule, #E8E8E8)",
            }}
          >
            <ShieldCheck size={14} style={{ color: "var(--color-success, #16803C)" }} />
            <span>Assigned Access Level: {ACCESS_LEVEL_META[user?.whatsapp_access_level || "full"]?.label || "Full WhatsApp Access"}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hl-page wa-employees-page crm-layout-content p-4 sm:p-6 w-full max-w-7xl mx-auto space-y-5">
      {toast && (
        <div className="fixed bottom-5 right-5 z-[9999]">
          <div
            className="hl-card flex items-center gap-3 px-4 py-3 shadow-xl"
            style={{
              borderRadius: "var(--radius-md, 10px)",
              background: toast.type === "error" ? "#FEF3F2" : "#ECFDF3",
              border: `1px solid ${toast.type === "error" ? "#FECACA" : "#ABEFC6"}`,
              color: toast.type === "error" ? "#B42318" : "#067647",
            }}
          >
            {toast.type === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span className="text-xs font-semibold">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 opacity-60 hover:opacity-100 transition"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {!demoMode && <InboxRoutingSettings key={activeTenant?.id || "none"} />}

      {/* Page Header - command bar */}
      <div
        className="hl-commandbar p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ borderRadius: "var(--radius-lg, 14px)" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(32, 44, 82, 0.10)", color: "var(--color-ink, #202C52)" }}
            >
              <Users size={18} />
            </div>
            <h1
              className="hl-title text-xl sm:text-2xl"
              style={{ margin: 0, fontFamily: "Poppins, sans-serif", letterSpacing: "-0.02em" }}
            >
              Employees &amp; access
            </h1>
          </div>
          <p className="text-xs sm:text-sm" style={{ color: "var(--color-ink-2, #667085)", margin: 0 }}>
            Assign branches, manage permissions and track employee activation.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchEmployees}
            disabled={loading}
            className="hl-btn-secondary"
            style={{ fontSize: 13, height: 38 }}
            title="Refresh staff data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => {
              setFormError("");
              setShowCreateModal(true);
            }}
            className="hl-btn-primary"
            style={{ fontSize: 13, height: 38 }}
          >
            <UserPlus size={15} />
            <span>Add employee</span>
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="hl-card p-4 flex flex-col justify-between" style={{ borderRadius: "var(--radius-md, 10px)" }}>
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
            <span>Total staff</span>
            <Users size={15} style={{ color: "var(--color-ink, #202C52)" }} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
              {analytics.total_employees}
            </span>
            <span className="text-[11px] block mt-0.5" style={{ color: "var(--color-ink-2, #667085)" }}>Workspace team members</span>
          </div>
        </div>

        <div className="hl-card p-4 flex flex-col justify-between" style={{ borderRadius: "var(--radius-md, 10px)" }}>
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
            <span>Active staff</span>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--color-success, #16803C)" }} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold" style={{ color: "var(--color-success, #16803C)", fontFamily: "Poppins, sans-serif" }}>
              {analytics.active_employees}
            </span>
            <span className="text-[11px] block mt-0.5" style={{ color: "var(--color-success, #16803C)", opacity: 0.8 }}>Activated &amp; operational</span>
          </div>
        </div>

        <div className="hl-card p-4 flex flex-col justify-between" style={{ borderRadius: "var(--radius-md, 10px)" }}>
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
            <span>Pending login</span>
            <Clock size={15} style={{ color: "var(--color-accent-hover, #E9AA00)" }} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold" style={{ color: "var(--color-accent-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
              {analytics.pending_activation}
            </span>
            <span className="text-[11px] block mt-0.5" style={{ color: "var(--color-ink-2, #667085)" }}>Awaiting access code login</span>
          </div>
        </div>

        <div className="hl-card p-4 flex flex-col justify-between" style={{ borderRadius: "var(--radius-md, 10px)" }}>
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
            <span>Access levels</span>
            <ShieldCheck size={15} style={{ color: "var(--color-info, #2563EB)" }} />
          </div>
          <div className="mt-2 text-xs space-y-1">
            <div className="flex justify-between items-center" style={{ color: "var(--color-ink, #202C52)" }}>
              <span>Full:</span>
              <span className="font-bold">{analytics.access_levels?.full || 0}</span>
            </div>
            <div className="flex justify-between items-center" style={{ color: "var(--color-info, #2563EB)" }}>
              <span>Chat only:</span>
              <span className="font-bold">{analytics.access_levels?.chat_only || 0}</span>
            </div>
            <div className="flex justify-between items-center" style={{ color: "#D97706" }}>
              <span>Campaigns:</span>
              <span className="font-bold">{analytics.access_levels?.campaign_only || 0}</span>
            </div>
          </div>
        </div>

        <div className="hl-card p-4 flex flex-col justify-between col-span-2 lg:col-span-1" style={{ borderRadius: "var(--radius-md, 10px)" }}>
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
            <span>Dispatched</span>
            <BarChart3 size={15} style={{ color: "var(--color-ink, #202C52)" }} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
              {Number(analytics.total_messages_dispatched || 0).toLocaleString()}
            </span>
            <span className="text-[11px] block mt-0.5" style={{ color: "var(--color-ink-2, #667085)" }}>Total outbound messages</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="hl-card p-3 flex flex-col sm:flex-row items-center gap-3" style={{ borderRadius: "var(--radius-md, 10px)" }}>
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-ink-2, #667085)" }} />
          <input
            type="text"
            aria-label="Search employees directory"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, employee ID or access code..."
            className="hl-input w-full pl-9"
            style={{ height: 38, fontSize: 13 }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition"
              style={{ color: "var(--color-ink-2, #667085)" }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {branches && branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="hl-input w-full sm:w-auto"
              style={{ height: 38, fontSize: 13, minWidth: 150 }}
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          )}

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="hl-input w-full sm:w-auto"
            style={{ height: 38, fontSize: 13, minWidth: 160 }}
          >
            <option value="all">All access levels</option>
            <option value="full">Full WhatsApp Access</option>
            <option value="chat_only">Live Chat Only</option>
            <option value="read_only">Read Only</option>
            <option value="campaign_only">Campaigns Only</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="hl-input w-full sm:w-auto"
            style={{ height: 38, fontSize: 13, minWidth: 140 }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="pending">Pending login</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="hl-card p-4 text-sm flex items-center gap-2" style={{ border: "1px solid #FECACA", background: "#FEF3F2", color: "#B42318", borderRadius: "var(--radius-md, 10px)" }}>
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Employees table */}
      <div className="hl-card overflow-hidden" style={{ borderRadius: "var(--radius-md, 10px)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--color-surface, #F5F5F5)",
                  borderBottom: "1px solid var(--color-rule, #E8E8E8)",
                  color: "var(--color-ink-2, #667085)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontSize: 11,
                }}
              >
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Branch</th>
                <th className="py-3 px-4 font-semibold">WhatsApp access level</th>
                <th className="py-3 px-4 font-semibold">Workspace access code</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center" style={{ color: "var(--color-ink-2, #667085)" }}>
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2" style={{ color: "var(--color-ink, #202C52)" }} />
                    <span>Loading employees directory…</span>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center" style={{ color: "var(--color-ink-2, #667085)" }}>
                    <Users size={32} className="mx-auto mb-2" style={{ color: "var(--color-text-muted, #98A2B3)" }} />
                    <p className="font-semibold text-sm" style={{ color: "var(--color-ink, #202C52)" }}>No employees found</p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-ink-2, #667085)" }}>
                      {searchQuery
                        ? "Try clearing your search query or filters."
                        : "Click \"Add employee\" to create your first team member and generate an access code."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const level = ACCESS_LEVEL_META[emp.whatsapp_access_level || "full"] || ACCESS_LEVEL_META.full;
                  const LevelIcon = level.icon;
                  const isCurrentAdmin = emp.id === user?.id;
                  const isPending = emp.status !== "active";
                  const targetIsAdministrator = ["admin", "subadmin"].includes(emp.role);
                  const subadminLocked = subadmin && !isCurrentAdmin && targetIsAdministrator;

                  const isExpanded = expandedId === emp.id;
                  return (
                    <React.Fragment key={emp.id}>
                    <tr
                      className="transition-colors"
                      style={{ borderBottom: "1px solid var(--color-rule, #E8E8E8)", cursor: "pointer" }}
                      onClick={(e) => {
                        // Don't toggle when interacting with buttons/inputs/selects
                        if (e.target.closest("button, a, input, select, textarea")) return;
                        setExpandedId(isExpanded ? null : emp.id);
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface, #F5F5F5)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isExpanded ? "var(--color-surface, #F5F5F5)" : "transparent")}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <ChevronDown size={14} className="shrink-0 transition-transform" style={{ color: "var(--color-ink-2, #667085)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }} />
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 text-white"
                            style={{
                              background: isCurrentAdmin ? "var(--color-ink, #202C52)" : "var(--color-primary-soft, #2B385F)",
                            }}
                          >
                            {(emp.first_name?.[0] || "E") + (emp.last_name?.[0] || "")}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap" style={{ color: "var(--color-ink, #202C52)" }}>
                              <span>{`${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Employee"}</span>
                              {isCurrentAdmin && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: "var(--color-accent-soft, #FFF4CC)", color: "var(--color-accent-ink, #202C52)" }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] flex items-center gap-2 mt-0.5 flex-wrap" style={{ color: "var(--color-ink-2, #667085)" }}>
                              <span className="flex items-center gap-1">
                                <Mail size={11} />
                                {emp.email}
                              </span>
                              {emp.emp_id && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono" style={{ background: "var(--color-surface, #F5F5F5)", color: "var(--color-ink-2, #667085)" }}>
                                  {emp.emp_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold capitalize"
                          style={{
                            background:
                              emp.role === "admin"
                                ? "rgba(32, 44, 82, 0.10)"
                                : emp.role === "subadmin"
                                  ? "rgba(217, 119, 6, 0.12)"
                                  : "rgba(37, 99, 235, 0.08)",
                            color:
                              emp.role === "admin"
                                ? "var(--color-primary, #202C52)"
                                : emp.role === "subadmin"
                                  ? "#B45309"
                                  : "var(--color-info, #2563EB)",
                          }}
                        >
                          {emp.role || "employee"}
                        </span>
                        {emp.job_title && (
                          <div className="text-[11px] mt-0.5 truncate max-w-[140px]" style={{ color: "var(--color-ink-2, #667085)" }}>
                            {emp.job_title}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {emp.branch_name ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: "var(--color-surface, #F5F5F5)", color: "var(--color-ink, #202C52)", border: "1px solid var(--color-rule, #E8E8E8)" }}>
                            {emp.branch_name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: "var(--color-accent-soft, #FFF4CC)", color: "var(--color-accent-ink, #202C52)", border: "1px solid var(--color-accent, #FCBD16)" }}>
                            Head office
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
                          style={{
                            background: level.bg,
                            color: level.color,
                            border: `1px solid ${level.color}25`,
                          }}
                          title={level.desc}
                        >
                          <LevelIcon size={13} />
                          <span>{level.shortLabel}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {emp.access_code ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-mono font-bold text-xs px-2 py-1 rounded tracking-wider"
                              style={{
                                background: "var(--color-surface, #F5F5F5)",
                                border: "1px solid var(--color-rule, #E8E8E8)",
                                color: "var(--color-ink, #202C52)",
                                letterSpacing: "0.06em",
                                fontFamily: "JetBrains Mono, monospace",
                              }}
                            >
                              {emp.access_code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(emp.access_code, emp.id)}
                              className="p-1 rounded transition-colors"
                              style={{ color: "var(--color-ink-2, #667085)" }}
                              title="Copy access code"
                            >
                              {copiedCodeId === emp.id ? (
                                <Check size={14} style={{ color: "var(--color-success, #16803C)" }} />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs italic" style={{ color: "var(--color-ink-2, #667085)" }}>None generated</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ color: "var(--color-accent-ink, #202C52)", background: "var(--color-accent-soft, #FFF4CC)", border: "1px solid var(--color-accent, #FCBD16)" }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-accent, #FCBD16)" }} />
                            <span>Pending login</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded" style={{ color: "var(--color-success, #16803C)", background: "#ECFDF3", border: "1px solid #ABEFC6" }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-success, #16803C)" }} />
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {emp.access_code && (
                            <button
                              onClick={() => handleCopyInvitation(emp)}
                              className="p-1.5 rounded transition-colors"
                              style={{ color: "var(--color-ink-2, #667085)" }}
                              title="Copy invitation instructions"
                            >
                              <ExternalLink size={14} />
                            </button>
                          )}

                          {!subadminLocked && (
                            <button
                              onClick={() => handleRegenerateCode(emp.id, emp.first_name)}
                              className="p-1.5 rounded transition-colors"
                              style={{ color: "var(--color-ink-2, #667085)" }}
                              title="Regenerate access code"
                            >
                              <KeyRound size={14} />
                            </button>
                          )}

                          {!subadminLocked && (
                            <button
                              onClick={() => setEditEmployee({ ...emp })}
                              className="p-1.5 rounded transition-colors"
                              style={{ color: "var(--color-ink-2, #667085)" }}
                              title="Edit access level & job title"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}

                          {!isCurrentAdmin && !subadminLocked && (
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.first_name)}
                              className="p-1.5 rounded transition-colors"
                              style={{ color: "var(--color-error, #D92D20)" }}
                              title="Remove employee"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "var(--color-surface, #F5F5F5)" }}>
                        <td colSpan={7} className="px-4 py-4">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-2, #667085)" }}>Employee details</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs" style={{ color: "var(--color-ink, #202C52)" }}>
                                <div><span style={{ color: "var(--color-ink-2, #667085)" }}>Name: </span>{`${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Employee"}</div>
                                <div><span style={{ color: "var(--color-ink-2, #667085)" }}>Email: </span>{emp.email}</div>
                                <div><span style={{ color: "var(--color-ink-2, #667085)" }}>Role: </span>{emp.role || "employee"}</div>
                                <div><span style={{ color: "var(--color-ink-2, #667085)" }}>Job title: </span>{emp.job_title || "-"}</div>
                                <div><span style={{ color: "var(--color-ink-2, #667085)" }}>Branch: </span>{emp.branch_name || "Head office"}</div>
                                <div><span style={{ color: "var(--color-ink-2, #667085)" }}>Access level: </span>{level.label}</div>
                                <div><span style={{ color: "var(--color-ink-2, #667085)" }}>Status: </span>{isPending ? "Pending login" : "Active"}</div>
                                {emp.access_code && (
                                  <div><span style={{ color: "var(--color-ink-2, #667085)" }}>Access code: </span><span className="font-mono font-bold">{emp.access_code}</span></div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                              {emp.access_code && (
                                <button onClick={() => handleCopyInvitation(emp)} className="hl-btn-secondary text-xs" style={{ height: 34 }}>
                                  <ExternalLink size={13} /> Copy invitation
                                </button>
                              )}
                              {!subadminLocked && (
                                <button onClick={() => handleRegenerateCode(emp.id, emp.first_name)} className="hl-btn-secondary text-xs" style={{ height: 34 }}>
                                  <KeyRound size={13} /> Regenerate code
                                </button>
                              )}
                              {!subadminLocked && (
                                <button onClick={() => setEditEmployee({ ...emp })} className="hl-btn-primary text-xs" style={{ height: 34 }}>
                                  <Edit2 size={13} /> Edit access
                                </button>
                              )}
                              {!isCurrentAdmin && !subadminLocked && (
                                <button onClick={() => handleDeleteEmployee(emp.id, emp.first_name)} className="hl-btn-secondary text-xs" style={{ height: 34, color: "var(--color-error, #D92D20)", borderColor: "#FECACA" }}>
                                  <Trash2 size={13} /> Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Employee */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ background: "rgba(5, 14, 47, 0.6)", backdropFilter: "blur(4px)" }}>
          <div
            ref={employeeDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Add employee"
            className="hl-card w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden animate-scale-up shadow-2xl"
            style={{ background: "var(--color-paper-2, #ffffff)", borderRadius: "var(--radius-lg, 14px)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--color-rule, #E8E8E8)", background: "var(--color-surface, #F5F5F5)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--color-ink, #202C52)", color: "#ffffff" }}>
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base m-0" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>Add new employee</h3>
                  <p className="text-[11px] m-0" style={{ color: "var(--color-ink-2, #667085)" }}>Generate a unique access code for isolated WhatsApp workspace login</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg transition"
                style={{ color: "var(--color-ink-2, #667085)" }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 flex-1 overflow-y-auto overscroll-contain">
                {formError && (
                  <div className="p-3 text-xs rounded-xl flex items-center gap-2" style={{ background: "#FEF3F2", border: "1px solid #FECACA", color: "#B42318" }}>
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1.5 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>First name *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: "var(--color-ink-2, #667085)" }}>
                        <User size={15} />
                      </div>
                      <input
                        type="text"
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="hl-input w-full pl-9 pr-3 h-10 text-sm"
                        placeholder="e.g. Ananya"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>Last name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: "var(--color-ink-2, #667085)" }}>
                        <User size={15} />
                      </div>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="hl-input w-full pl-9 pr-3 h-10 text-sm"
                        placeholder="e.g. Sharma"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>Work email address *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: "var(--color-ink-2, #667085)" }}>
                      <Mail size={15} />
                    </div>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="hl-input w-full pl-9 pr-3 h-10 text-sm"
                      placeholder="employee@company.com"
                    />
                  </div>
                  <span className="text-[11px] block mt-1.5 ml-1" style={{ color: "var(--color-ink-2, #667085)" }}>
                    Employee will verify this email along with their workspace access code upon first login.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1.5 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>Job title</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: "var(--color-ink-2, #667085)" }}>
                        <Briefcase size={15} />
                      </div>
                      <input
                        type="text"
                        value={formData.job_title}
                        onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                        className="hl-input w-full pl-9 pr-3 h-10 text-sm"
                        placeholder="e.g. Sales specialist"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>System role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="hl-input w-full h-10 text-sm font-medium"
                    >
                      <option value="employee">Employee</option>
                      <option value="agent">Support agent</option>
                      <option value="subadmin" disabled={subadmin && formData.role !== "subadmin"}>Sub-admin (manager)</option>
                      <option value="admin" disabled={subadmin && formData.role !== "admin"}>Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>
                    Assigned branch / location *
                  </label>
                  <select
                    value={formData.branch_id || (branches?.[0]?.id) || 1}
                    onChange={(e) => setFormData({ ...formData, branch_id: Number(e.target.value) })}
                    className="hl-input w-full h-10 text-sm font-medium"
                  >
                    {branches && branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}){b.is_head_office ? " : Head office" : ""}
                        </option>
                      ))
                    ) : (
                      <option value="1">Head office (Main) (HQ-01)</option>
                    )}
                  </select>
                  <span className="text-[11px] block mt-1.5 ml-1" style={{ color: "var(--color-ink-2, #667085)" }}>
                    Staff member will be scoped to handle conversations and campaigns for this branch.
                  </span>
                </div>

                <div>
                  <label className="block mb-2 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>
                    WhatsApp access level &amp; permissions
                  </label>
                  <div className="space-y-2">
                    {Object.entries(ACCESS_LEVEL_META).map(([key, meta]) => {
                      const Icon = meta.icon;
                      const isSelected = formData.whatsapp_access_level === key;
                      return (
                        <label
                          key={key}
                          onClick={() => setFormData({ ...formData, whatsapp_access_level: key })}
                          className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                          style={{
                            borderColor: isSelected ? "var(--color-ink, #202C52)" : "var(--color-rule, #E8E8E8)",
                            background: isSelected ? "var(--color-surface, #F5F5F5)" : "#ffffff",
                            boxShadow: isSelected ? "0 0 0 1px var(--color-ink, #202C52)" : "none",
                          }}
                        >
                          <input
                            type="radio"
                            name="whatsapp_access_level"
                            checked={isSelected}
                            onChange={() => setFormData({ ...formData, whatsapp_access_level: key })}
                            style={{ marginTop: 2, accentColor: "var(--color-ink, #202C52)" }}
                          />
                          <div className="flex-1 text-xs">
                            <div className="font-bold flex items-center gap-1.5" style={{ color: "var(--color-ink, #202C52)" }}>
                              <Icon size={14} style={{ color: meta.color }} />
                              <span>{meta.label}</span>
                            </div>
                            <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--color-ink-2, #667085)" }}>
                              {meta.desc}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t shrink-0" style={{ borderColor: "var(--color-rule, #E8E8E8)", background: "var(--color-surface, #F5F5F5)" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="hl-btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="hl-btn-primary px-4 py-2 text-xs font-bold"
                >
                  {formLoading ? "Generating code…" : "Create & generate code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Created Employee Code Success */}
      {createdEmployeeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ background: "rgba(5, 14, 47, 0.6)", backdropFilter: "blur(4px)" }}>
          <div
            className="hl-card w-full max-w-md p-6 text-center animate-scale-up shadow-2xl"
            style={{ background: "var(--color-paper-2, #ffffff)", borderRadius: "var(--radius-lg, 14px)" }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--color-accent-soft, #FFF4CC)", color: "var(--color-accent-ink, #202C52)" }}>
              <CheckCircle2 size={28} />
            </div>

            <h3 className="font-bold text-lg mb-1" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
              Employee created successfully
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--color-ink-2, #667085)" }}>
              Share the unique access code below with{" "}
              <strong style={{ color: "var(--color-ink, #202C52)" }}>{createdEmployeeResult.first_name}</strong> ({createdEmployeeResult.email}) so they can log in for the first time.
            </p>

            <div
              className="p-4 rounded-xl mb-4 flex flex-col items-center justify-center gap-1"
              style={{ border: "1px solid var(--color-accent, #FCBD16)", background: "var(--color-accent-soft, #FFF4CC)" }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent-ink, #202C52)" }}>
                Workspace access code
              </span>
              <span
                className="text-2xl font-mono font-extrabold tracking-widest my-1"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "JetBrains Mono, monospace" }}
              >
                {createdEmployeeResult.access_code}
              </span>
              <span className="text-[11px]" style={{ color: "var(--color-ink-2, #667085)" }}>
                Access level: {ACCESS_LEVEL_META[createdEmployeeResult.whatsapp_access_level]?.label}
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleCopyInvitation(createdEmployeeResult)}
                className="hl-btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm font-bold rounded-xl"
              >
                <Copy size={16} />
                <span>Copy invitation &amp; access code</span>
              </button>
              <button
                type="button"
                onClick={() => setCreatedEmployeeResult(null)}
                className="hl-btn-secondary w-full py-2 text-xs font-semibold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Employee Access Level */}
      {editEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ background: "rgba(5, 14, 47, 0.6)", backdropFilter: "blur(4px)" }}>
          <div
            className="hl-card w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden animate-scale-up shadow-2xl"
            style={{ background: "var(--color-paper-2, #ffffff)", borderRadius: "var(--radius-lg, 14px)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--color-rule, #E8E8E8)", background: "var(--color-surface, #F5F5F5)" }}>
              <div className="flex items-center gap-2">
                <Edit2 size={16} style={{ color: "var(--color-info, #2563EB)" }} />
                <h3 className="font-bold text-base m-0" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
                  Edit access level: {editEmployee.first_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditEmployee(null)}
                className="p-1.5 rounded-lg transition"
                style={{ color: "var(--color-ink-2, #667085)" }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateAccessLevel} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 flex-1 overflow-y-auto overscroll-contain">
                <div>
                  <label className="block mb-1.5 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>Job title</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: "var(--color-ink-2, #667085)" }}>
                      <Briefcase size={15} />
                    </div>
                    <input
                      type="text"
                      value={editEmployee.job_title || ""}
                      onChange={(e) => setEditEmployee({ ...editEmployee, job_title: e.target.value })}
                      className="hl-input w-full pl-9 pr-3 h-10 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>Account status</label>
                  <select
                    value={editEmployee.status || "active"}
                    onChange={(e) => setEditEmployee({ ...editEmployee, status: e.target.value })}
                    className="hl-input w-full h-10 text-sm font-medium"
                  >
                    <option value="active">Active (operational)</option>
                    <option value="pending">Pending activation (awaiting code login)</option>
                    <option value="banned">Suspended / deactivated</option>
                    <option value="inactive">Inactive / left organization</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1.5 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>Assigned branch / location</label>
                  <select
                    value={editEmployee.branch_id || ""}
                    onChange={(e) => setEditEmployee({ ...editEmployee, branch_id: e.target.value ? Number(e.target.value) : null })}
                    className="hl-input w-full h-10 text-sm font-medium"
                  >
                    <option value="">Head office / default</option>
                    {branches && branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code}){b.is_head_office ? " : Head office" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] block mt-1.5 ml-1" style={{ color: "var(--color-ink-2, #667085)" }}>
                    Reassigning updates the operational branch and customer chat scope for this employee.
                  </span>
                </div>

                <div>
                  <label className="block mb-2 font-bold text-xs" style={{ color: "var(--color-ink, #202C52)" }}>WhatsApp access level</label>
                  <div className="space-y-2">
                    {Object.entries(ACCESS_LEVEL_META).map(([key, meta]) => {
                      const Icon = meta.icon;
                      const isSelected = editEmployee.whatsapp_access_level === key;
                      return (
                        <label
                          key={key}
                          onClick={() => setEditEmployee({ ...editEmployee, whatsapp_access_level: key })}
                          className="flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition"
                          style={{
                            borderColor: isSelected ? "var(--color-info, #2563EB)" : "var(--color-rule, #E8E8E8)",
                            background: isSelected ? "rgba(37, 99, 235, 0.06)" : "#ffffff",
                            boxShadow: isSelected ? "0 0 0 1px var(--color-info, #2563EB)" : "none",
                          }}
                        >
                          <input
                            type="radio"
                            name="edit_level"
                            checked={isSelected}
                            onChange={() => setEditEmployee({ ...editEmployee, whatsapp_access_level: key })}
                            style={{ marginTop: 2, accentColor: "var(--color-info, #2563EB)" }}
                          />
                          <div className="text-xs">
                            <span className="font-bold flex items-center gap-1.5" style={{ color: "var(--color-ink, #202C52)" }}>
                              <Icon size={13} style={{ color: meta.color }} />
                              {meta.label}
                            </span>
                            <span className="text-[11px] block leading-tight mt-0.5" style={{ color: "var(--color-ink-2, #667085)" }}>
                              {meta.desc}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t shrink-0" style={{ borderColor: "var(--color-rule, #E8E8E8)", background: "var(--color-surface, #F5F5F5)" }}>
                <button
                  type="button"
                  onClick={() => setEditEmployee(null)}
                  className="hl-btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="hl-btn-primary px-4 py-2 text-xs font-bold">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}