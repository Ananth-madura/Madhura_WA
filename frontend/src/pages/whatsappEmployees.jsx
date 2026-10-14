import React, { useState, useEffect, useCallback } from "react";
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
  Building,
  GitBranch,
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import { useAuth } from "../auth/AuthContext";
import { useEnterprise } from "../context/EnterpriseContext";
import WhatsAppNav from "../components/WhatsAppNav";

const ACCESS_LEVEL_META = {
  full: {
    label: "Full WhatsApp Access",
    shortLabel: "Full Access",
    badge: "hl-badge-success",
    color: "#059669",
    bg: "rgba(16, 185, 129, 0.12)",
    icon: ShieldCheck,
    desc: "Complete access to live chat inbox, bulk campaigns, contact groups, and automated flows.",
  },
  chat_only: {
    label: "Live Chat Only",
    shortLabel: "Chat Only",
    badge: "hl-badge-info",
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.12)",
    icon: MessageCircle,
    desc: "1-on-1 customer chat inbox access. Can respond to customer inquiries and send templates.",
  },
  read_only: {
    label: "Read Only",
    shortLabel: "Read Only",
    badge: "hl-badge",
    color: "#64748b",
    bg: "rgba(100, 116, 139, 0.12)",
    icon: Eye,
    desc: "View-only access to customer chat history, logs, and analytics. Outbound messaging is disabled.",
  },
  campaign_only: {
    label: "Campaigns Only",
    shortLabel: "Campaigns",
    badge: "hl-badge-warn",
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.12)",
    icon: Send,
    desc: "Create and launch bulk broadcasts, templates, and contact segments. Chat inbox is hidden.",
  },
};

export default function WAEmployees() {
  const { user } = useAuth();
  const { activeTenant, activeBranch, branches, enterpriseHeaders } = useEnterprise();

  // Employee data & analytics
  const [employees, setEmployees] = useState([]);
  const [analytics, setAnalytics] = useState({
    total_employees: 0,
    active_employees: 0,
    pending_activation: 0,
    access_levels: { full: 0, chat_only: 0, read_only: 0, campaign_only: 0 },
    total_messages_dispatched: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdEmployeeResult, setCreatedEmployeeResult] = useState(null); // for showing generated code modal
  const [editEmployee, setEditEmployee] = useState(null); // for editing access level
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  // Form states for creating employee
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
      setFormData((prev) => ({ ...prev, branch_id: activeBranch.id }));
    }
  }, [activeBranch]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchEmployees = useCallback(async () => {
    if (user?.role === "employee") return;
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...enterpriseHeaders,
      };
      const params = branchFilter !== "all" ? { branchId: branchFilter } : {};
      const { data } = await axios.get(`${API}/api/auth/employees`, { headers, params });

      if (data?.employees) {
        setEmployees(data.employees);
      }
      if (data?.analytics) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError("Access Denied: Only workspace administrators can manage employees.");
      } else {
        setError(err.response?.data?.message || "Failed to load employees list.");
      }
    } finally {
      setLoading(false);
    }
  }, [user, enterpriseHeaders, branchFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleCopy = (code, id) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    showToast(`Access code "${code}" copied to clipboard!`);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleCopyInvitation = (emp) => {
    const signupUrl = `${window.location.origin}/signup`;
    const message = `Hi ${emp.first_name},\n\nYou have been invited to access our WhatsApp CRM workspace!\n\n1. Go to: ${signupUrl}\n2. Select "Join with Access Code"\n3. Enter your Access Code: ${emp.access_code}\n4. Email: ${emp.email}\n5. Set your password to activate your ${ACCESS_LEVEL_META[emp.whatsapp_access_level || "full"]?.shortLabel || "employee"} WhatsApp access.`;

    navigator.clipboard.writeText(message);
    showToast(`Invitation instructions for ${emp.first_name} copied!`);
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

  // Filtered employees list
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

  // Strict employee isolation guard: if regular employee, show isolated view
  if (user?.role === "employee") {
    return (
      <div className="crm-layout-content p-4 sm:p-6 max-w-4xl mx-auto">
        <WhatsAppNav />
        <div
          className="hl-card text-center p-8 sm:p-12 mt-6"
          style={{
            background: "var(--color-paper)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-lg, 12px)",
          }}
        >
          <div
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
            style={{ background: "rgba(245, 158, 11, 0.15)", color: "#d97706" }}
          >
            <ShieldAlert size={32} />
          </div>
          <h2 className="hl-title text-xl mb-2" style={{ color: "var(--color-ink)" }}>
            Deep Staff Isolation Active
          </h2>
          <p
            className="text-sm max-w-md mx-auto mb-6"
            style={{ color: "var(--color-ink-2)", lineHeight: 1.6 }}
          >
            Your account is assigned employee-level WhatsApp access. To protect organization privacy,
            employee profiles and staff access codes are exclusively managed by your workspace administrator.
          </p>
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: "var(--color-paper-2, #f1f5f9)",
              color: "var(--color-ink)",
              border: "1px solid var(--color-line)",
            }}
          >
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Assigned Access Level: {ACCESS_LEVEL_META[user?.whatsapp_access_level || "full"]?.label || "Full WhatsApp Access"}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-layout-content p-3 sm:p-6 w-full max-w-7xl mx-auto space-y-4">
      {/* Top Navigation Strip */}
      <WhatsAppNav />

      {/* Toast Notification */}
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
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-gray-500 hover:text-gray-800"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="hl-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
              style={{ background: "rgba(16, 185, 129, 0.15)", color: "#059669" }}
            >
              <Users size={18} />
            </div>
            <h1 className="hl-title text-xl sm:text-2xl" style={{ margin: 0 }}>
              Employee Management &amp; Access Codes
            </h1>
          </div>
          <p className="text-xs sm:text-sm" style={{ color: "var(--color-ink-2)", margin: 0 }}>
            Generate unique Access Codes for employee onboarding, configure granular WhatsApp access levels, and monitor staff productivity.
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
            style={{
              fontSize: 13,
              height: 38,
              background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
              borderColor: "#047857",
            }}
          >
            <UserPlus size={15} />
            <span>+ Add Employee</span>
          </button>
        </div>
      </div>

      {/* Multi-Dynamic Analytics Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Employees */}
        <div className="hl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            <span>Total Staff</span>
            <Users size={15} className="text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>
              {analytics.total_employees}
            </span>
            <span className="text-[11px] block text-gray-500 mt-0.5">Workspace team members</span>
          </div>
        </div>

        {/* Active Staff */}
        <div className="hl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            <span>Active Staff</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-700">
              {analytics.active_employees}
            </span>
            <span className="text-[11px] block text-emerald-600 mt-0.5">Activated &amp; operational</span>
          </div>
        </div>

        {/* Pending Activation */}
        <div className="hl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            <span>Pending Login</span>
            <Clock size={15} className="text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-700">
              {analytics.pending_activation}
            </span>
            <span className="text-[11px] block text-amber-600 mt-0.5">Awaiting Access Code login</span>
          </div>
        </div>

        {/* Access Levels Breakdown */}
        <div className="hl-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            <span>Access Levels</span>
            <ShieldCheck size={15} className="text-blue-600" />
          </div>
          <div className="mt-2 text-xs space-y-1">
            <div className="flex justify-between items-center text-emerald-700">
              <span>Full:</span>
              <span className="font-bold">{analytics.access_levels?.full || 0}</span>
            </div>
            <div className="flex justify-between items-center text-blue-700">
              <span>Chat Only:</span>
              <span className="font-bold">{analytics.access_levels?.chat_only || 0}</span>
            </div>
            <div className="flex justify-between items-center text-purple-700">
              <span>Campaigns:</span>
              <span className="font-bold">{analytics.access_levels?.campaign_only || 0}</span>
            </div>
          </div>
        </div>

        {/* Total Messages Dispatched */}
        <div className="hl-card p-4 flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2)" }}>
            <span>Dispatched</span>
            <BarChart3 size={15} className="text-teal-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-teal-800">
              {Number(analytics.total_messages_dispatched || 0).toLocaleString()}
            </span>
            <span className="text-[11px] block text-teal-600 mt-0.5">Total outbound messages</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="hl-card p-3 flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, employee ID or Access Code..."
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Branch Filter */}
          {branches && branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="hl-input w-full sm:w-auto"
              style={{ height: 38, fontSize: 13, minWidth: 150 }}
            >
              <option value="all">🏢 All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          )}

          {/* Access Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="hl-input w-full sm:w-auto"
            style={{ height: 38, fontSize: 13, minWidth: 160 }}
          >
            <option value="all">All Access Levels</option>
            <option value="full">Full WhatsApp Access</option>
            <option value="chat_only">Live Chat Only</option>
            <option value="read_only">Read Only</option>
            <option value="campaign_only">Campaigns Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="hl-input w-full sm:w-auto"
            style={{ height: 38, fontSize: 13, minWidth: 140 }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="pending">Pending Login</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="hl-card p-4 border-red-300 bg-red-50 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Employees Table */}
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
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Branch</th>
                <th className="py-3 px-4 font-semibold">WhatsApp Access Level</th>
                <th className="py-3 px-4 font-semibold">Workspace Access Code</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Loading employees directory…</span>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Users size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-sm text-gray-700">No employees found</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {searchQuery
                        ? "Try clearing your search query or filters."
                        : "Click '+ Add Employee' to create your first team member and generate an Access Code."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const level = ACCESS_LEVEL_META[emp.whatsapp_access_level || "full"] || ACCESS_LEVEL_META.full;
                  const LevelIcon = level.icon;
                  const isCurrentAdmin = emp.id === user?.id;
                  const isPending = emp.status !== "active";

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/70 transition-colors"
                      style={{ borderBottom: "1px solid var(--color-line)" }}
                    >
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 text-white shadow-sm"
                            style={{
                              background: isCurrentAdmin
                                ? "linear-gradient(135deg, #059669 0%, #0d9488 100%)"
                                : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                            }}
                          >
                            {(emp.first_name?.[0] || "E") + (emp.last_name?.[0] || "")}
                          </div>
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-1.5" style={{ color: "var(--color-ink)" }}>
                              <span>{`${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Employee"}</span>
                              {isCurrentAdmin && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Mail size={11} />
                                {emp.email}
                              </span>
                              {emp.emp_id && (
                                <span className="bg-gray-100 px-1.5 py-0.2 rounded text-[10px] text-gray-600 font-mono">
                                  {emp.emp_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* System Role */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                            emp.role === "admin"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-50 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {emp.role || "employee"}
                        </span>
                        {emp.job_title && (
                          <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[140px]">
                            {emp.job_title}
                          </div>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="py-3.5 px-4">
                        {emp.branch_name ? (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md font-medium border border-slate-200">
                            📍 {emp.branch_name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md font-medium border border-emerald-100">
                            🏢 Head Office
                          </span>
                        )}
                      </td>

                      {/* WhatsApp Access Level */}
                      <td className="py-3.5 px-4">
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
                          style={{
                            background: level.bg,
                            color: level.color,
                            border: `1px solid ${level.color}30`,
                          }}
                          title={level.desc}
                        >
                          <LevelIcon size={13} />
                          <span>{level.shortLabel}</span>
                        </div>
                      </td>

                      {/* Workspace Access Code */}
                      <td className="py-3.5 px-4">
                        {emp.access_code ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-mono font-bold text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-800 tracking-wider"
                              style={{ letterSpacing: "0.06em" }}
                            >
                              {emp.access_code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(emp.access_code, emp.id)}
                              className="p-1 rounded hover:bg-slate-200 text-gray-500 transition-colors"
                              title="Copy Access Code"
                            >
                              {copiedCodeId === emp.id ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">None generated</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>Pending Login</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Share Invitation */}
                          {emp.access_code && (
                            <button
                              onClick={() => handleCopyInvitation(emp)}
                              className="p-1.5 rounded text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="Copy Invitation Instructions"
                            >
                              <ExternalLink size={14} />
                            </button>
                          )}

                          {/* Regenerate Code */}
                          <button
                            onClick={() => handleRegenerateCode(emp.id, emp.first_name)}
                            className="p-1.5 rounded text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            title="Regenerate Access Code"
                          >
                            <KeyRound size={14} />
                          </button>

                          {/* Edit Access Level */}
                          <button
                            onClick={() => setEditEmployee({ ...emp })}
                            className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                            title="Edit Access Level & Job Title"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Delete */}
                          {!isCurrentAdmin && (
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.first_name)}
                              className="p-1.5 rounded text-gray-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                              title="Remove Employee"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      {/* Modal: Create Employee */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="hl-card w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden animate-scale-up rounded-2xl shadow-2xl"
            style={{ background: "var(--color-paper)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 m-0">Add New Employee</h3>
                  <p className="text-[11px] text-gray-500 m-0">Generate a unique Access Code for isolated WhatsApp workspace login</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 flex-1 overflow-y-auto wa-custom-scrollbar overscroll-contain">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">First Name *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <User size={15} />
                      </div>
                      <input
                        type="text"
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="hl-input w-full pl-9 pr-3 py-2 text-sm"
                        placeholder="e.g. Ananya"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Last Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <User size={15} />
                      </div>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="hl-input w-full pl-9 pr-3 py-2 text-sm"
                        placeholder="e.g. Sharma"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Work Email Address *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Mail size={15} />
                    </div>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="hl-input w-full pl-9 pr-3 py-2 text-sm"
                      placeholder="employee@company.com"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 block mt-1">
                    Employee will verify this email along with their workspace Access Code upon first login.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Job Title</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Briefcase size={15} />
                      </div>
                      <input
                        type="text"
                        value={formData.job_title}
                        onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                        className="hl-input w-full pl-9 pr-3 py-2 text-sm"
                        placeholder="e.g. Sales Specialist"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">System Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="hl-input w-full py-2 text-sm font-medium"
                    >
                      <option value="employee">Employee</option>
                      <option value="agent">Support Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {/* Assigned Branch Selection */}
                <div>
                  <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                    Assigned Branch / Location *
                  </label>
                  <select
                    value={formData.branch_id || (branches?.[0]?.id) || 1}
                    onChange={(e) => setFormData({ ...formData, branch_id: Number(e.target.value) })}
                    className="hl-input w-full py-2 text-sm font-medium"
                  >
                    {branches && branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}){b.is_head_office ? " — Head Office" : ""}
                        </option>
                      ))
                    ) : (
                      <option value="1">Head Office (Main) (HQ-01)</option>
                    )}
                  </select>
                  <span className="text-[11px] text-gray-500 block mt-1">
                    Staff member will be scoped to handle conversations and campaigns for this branch.
                  </span>
                </div>

                {/* Granular WhatsApp Access Level Selection */}
                <div>
                  <label className="hl-section-label block mb-2 font-bold text-xs text-gray-700">
                    WhatsApp Access Level &amp; Permissions
                  </label>
                  <div className="space-y-2">
                    {Object.entries(ACCESS_LEVEL_META).map(([key, meta]) => {
                      const Icon = meta.icon;
                      const isSelected = formData.whatsapp_access_level === key;
                      return (
                        <label
                          key={key}
                          onClick={() => setFormData({ ...formData, whatsapp_access_level: key })}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500/30"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="whatsapp_access_level"
                            checked={isSelected}
                            onChange={() => setFormData({ ...formData, whatsapp_access_level: key })}
                            className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex-1 text-xs">
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              <Icon size={14} style={{ color: meta.color }} />
                              <span>{meta.label}</span>
                            </div>
                            <p className="text-gray-500 text-[11px] mt-0.5 leading-relaxed">
                              {meta.desc}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-gray-100 bg-slate-50/90 shrink-0">
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
                  className="hl-btn-primary px-4 py-2 text-xs font-bold shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                    borderColor: "#047857",
                  }}
                >
                  {formLoading ? "Generating Code…" : "Create & Generate Access Code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Created Employee Code Success Dialog */}
      {createdEmployeeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="hl-card w-full max-w-md p-6 text-center animate-scale-up rounded-2xl shadow-2xl"
            style={{ background: "var(--color-paper)" }}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={28} />
            </div>

            <h3 className="font-bold text-lg text-gray-900 mb-1">
              Employee Created Successfully!
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Share the unique Access Code below with{" "}
              <strong>{createdEmployeeResult.first_name}</strong> ({createdEmployeeResult.email}) so they can log in for the first time.
            </p>

            {/* Access Code Highlight Box */}
            <div
              className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 mb-4 flex flex-col items-center justify-center gap-1"
            >
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Workspace Access Code
              </span>
              <span
                className="text-2xl font-mono font-extrabold text-emerald-900 tracking-widest my-1"
              >
                {createdEmployeeResult.access_code}
              </span>
              <span className="text-[11px] text-emerald-700">
                Access Level: {ACCESS_LEVEL_META[createdEmployeeResult.whatsapp_access_level]?.label}
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleCopyInvitation(createdEmployeeResult)}
                className="hl-btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm font-bold rounded-xl"
              >
                <Copy size={16} />
                <span>Copy Invitation &amp; Access Code</span>
              </button>
              <button
                type="button"
                onClick={() => setCreatedEmployeeResult(null)}
                className="hl-btn-secondary w-full py-2 text-xs font-semibold rounded-xl"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Employee Access Level */}
      {editEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="hl-card w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden animate-scale-up rounded-2xl shadow-2xl"
            style={{ background: "var(--color-paper)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-blue-600" />
                <h3 className="font-bold text-base text-gray-900 m-0">
                  Edit Access Level: {editEmployee.first_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditEmployee(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateAccessLevel} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 flex-1 overflow-y-auto wa-custom-scrollbar overscroll-contain">
                <div>
                  <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Job Title</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Briefcase size={15} />
                    </div>
                    <input
                      type="text"
                      value={editEmployee.job_title || ""}
                      onChange={(e) => setEditEmployee({ ...editEmployee, job_title: e.target.value })}
                      className="hl-input w-full pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Account Status</label>
                  <select
                    value={editEmployee.status || "active"}
                    onChange={(e) => setEditEmployee({ ...editEmployee, status: e.target.value })}
                    className="hl-input w-full py-2 text-sm font-medium"
                  >
                    <option value="active">Active (Operational)</option>
                    <option value="pending">Pending Activation (Awaiting Code Login)</option>
                    <option value="banned">Suspended / Deactivated</option>
                  </select>
                </div>

                {/* Branch Assignment */}
                <div>
                  <label className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">Assigned Branch / Location</label>
                  <select
                    value={editEmployee.branch_id || ""}
                    onChange={(e) => setEditEmployee({ ...editEmployee, branch_id: e.target.value ? Number(e.target.value) : null })}
                    className="hl-input w-full py-2 text-sm font-medium"
                  >
                    <option value="">🏢 Head Office / Default</option>
                    {branches && branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code}){b.is_head_office ? " — Head Office" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-gray-500 block mt-1">
                    Reassigning updates the operational branch and customer chat scope for this employee.
                  </span>
                </div>

                <div>
                  <label className="hl-section-label block mb-2 font-bold text-xs text-gray-700">WhatsApp Access Level</label>
                  <div className="space-y-2">
                    {Object.entries(ACCESS_LEVEL_META).map(([key, meta]) => {
                      const Icon = meta.icon;
                      const isSelected = editEmployee.whatsapp_access_level === key;
                      return (
                        <label
                          key={key}
                          onClick={() => setEditEmployee({ ...editEmployee, whatsapp_access_level: key })}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                            isSelected ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/30" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="edit_level"
                            checked={isSelected}
                            onChange={() => setEditEmployee({ ...editEmployee, whatsapp_access_level: key })}
                            className="mt-0.5 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-gray-900 flex items-center gap-1.5">
                              <Icon size={13} style={{ color: meta.color }} />
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                              {meta.desc}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-gray-100 bg-slate-50/90 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditEmployee(null)}
                  className="hl-btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="hl-btn-primary px-4 py-2 text-xs font-bold">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
