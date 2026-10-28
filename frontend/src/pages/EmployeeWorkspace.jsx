import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../config/axios";
import { useEnterprise } from "../context/EnterpriseContext";
import { useAuth } from "../auth/AuthContext";
import useWorkspaceAccess from "../hooks/useWorkspaceAccess";
import socket from "../socket/socket";
import "./customer-operations.css";
import "./whatsapp-workspace.css";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Inbox,
  Layers,
  LayoutGrid,
  List,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  X,
  Zap
} from "lucide-react";

const root = "/api/v2/workspace";

const STAT_LABELS = {
  customers: "Total Customers",
  clients: "Active Clients",
  open_tasks: "Open Tasks",
  overdue_tasks: "Overdue Tasks",
  today_tasks: "Due Today",
  completed_tasks: "Completed Tasks",
  leads: "Total Leads",
  qualified_leads: "Qualified Leads",
  deals: "Total Deals",
  won_deals: "Won Deals",
  pipeline_value: "Pipeline Value",
  won_value: "Revenue Won",
  conversations: "Total Chats",
  active_conversations: "Active Chats",
  unread_messages: "Unread Messages",
  average_first_response_seconds: "Avg First Reply"
};

const VIEW_TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "my_day", label: "My Day", icon: Sun, badgeKey: "my_day_count" },
  { id: "customers", label: "Customers", icon: Users, badgeKey: "customers" },
  { id: "tasks", label: "Tasks & Follow-ups", icon: CheckSquare, badgeKey: "open_tasks" },
  { id: "leads", label: "Leads", icon: Flame, badgeKey: "leads" },
  { id: "deals", label: "Deals Pipeline", icon: Briefcase, badgeKey: "deals" },
  { id: "conversations", label: "Conversations", icon: MessageSquare, badgeKey: "unread_messages" },
  { id: "campaigns", label: "Campaigns", icon: Send },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "reports", label: "Reports", icon: BarChart3 }
];

const TASK_STAGES = ["open", "in_progress", "completed", "cancelled"];
const LEAD_TEMPS = ["new", "cold", "warm", "hot"];
const DEAL_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

const formatMoney = val => {
  const num = Number(val || 0);
  return Number.isFinite(num)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num)
    : "₹0";
};

const formatDuration = sec => {
  const s = Number(sec);
  if (!Number.isFinite(s) || s <= 0) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
};

const formatDate = dateStr => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const initials = name => {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

export default function EmployeeWorkspace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTenant, activeBranch, roleInActiveOrg } = useEnterprise();
  const { admin, canView } = useWorkspaceAccess();
  const [params, setParams] = useSearchParams();

  // Navigation & Scope
  const [activeView, setActiveView] = useState("overview");
  const [scope, setScope] = useState(() => (admin ? "organization" : roleInActiveOrg === "branch_manager" ? "branch" : "mine"));
  const [selectedBranchId, setSelectedBranchId] = useState("");

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [myDayData, setMyDayData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerCursor, setCustomerCursor] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [automations, setAutomations] = useState({ automations: [], flows: [] });
  const [userPreferences, setUserPreferences] = useState({ visibleWidgets: [], defaultView: "overview", density: "comfortable" });

  // Filters & Search
  const [taskFilter, setTaskFilter] = useState({ status: "", priority: "", due: "" });
  const [taskViewMode, setTaskViewMode] = useState("board"); // 'board' | 'list'
  const [leadFilter, setLeadFilter] = useState({ temperature: "" });
  const [dealFilter, setDealFilter] = useState({ stage: "" });
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerLifecycle, setCustomerLifecycle] = useState("");

  // Global Search
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalResults, setGlobalResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Modals & Drawers
  const [activeDrawer, setActiveDrawer] = useState(null); // { type: 'customer' | 'task' | 'deal' | 'lead', id, data }
  const [quickCreateModal, setQuickCreateModal] = useState({ open: false, type: "task" });
  const [preferencesModal, setPreferencesModal] = useState(false);
  const [transferModal, setTransferModal] = useState({ open: false, customer: null });
  const [employeesList, setEmployeesList] = useState([]);

  // Feedback Notifications
  const [errorNotice, setErrorNotice] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Sync / Timestamp tracking
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  const showToast = useCallback((msg, isError = false) => {
    if (isError) {
      setErrorNotice(msg);
      setTimeout(() => setErrorNotice(""), 6000);
    } else {
      setSuccessNotice(msg);
      setTimeout(() => setSuccessNotice(""), 4000);
    }
  }, []);

  // ── Load Analytics & Preferences ───────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    try {
      const qParams = { scope };
      if (selectedBranchId) qParams.branchId = selectedBranchId;
      const { data } = await api.get(`${root}/analytics`, { params: qParams });
      setAnalytics(data);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error("Failed to load analytics", err);
    }
  }, [scope, selectedBranchId]);

  const fetchPreferences = useCallback(async () => {
    try {
      const { data } = await api.get(`${root}/preferences`);
      if (data) {
        setUserPreferences(data);
        if (data.defaultView && activeView === "overview") {
          setActiveView(data.defaultView);
        }
      }
    } catch {
      // fallback to defaults
    }
  }, [activeView]);

  // ── Load View Specific Data ────────────────────────────────────────────────
  const fetchViewData = useCallback(async (viewToLoad = activeView) => {
    setRefreshing(true);
    const qParams = { scope };
    if (selectedBranchId) qParams.branchId = selectedBranchId;

    try {
      if (viewToLoad === "overview") {
        await fetchAnalytics();
      } else if (viewToLoad === "my_day") {
        const { data } = await api.get(`${root}/my-day`);
        setMyDayData(data);
      } else if (viewToLoad === "customers") {
        const { data } = await api.get(`${root}/customers`, {
          params: { ...qParams, search: customerSearch, lifecycle: customerLifecycle }
        });
        setCustomers(data.customers || []);
        setCustomerCursor(data.nextCursor);
      } else if (viewToLoad === "tasks") {
        const { data } = await api.get(`${root}/tasks`, {
          params: { ...qParams, ...taskFilter }
        });
        setTasks(data.tasks || []);
      } else if (viewToLoad === "leads") {
        const { data } = await api.get(`${root}/leads`, {
          params: { ...qParams, ...leadFilter }
        });
        setLeads(data.leads || []);
      } else if (viewToLoad === "deals") {
        const { data } = await api.get(`${root}/deals`, {
          params: { ...qParams, ...dealFilter }
        });
        setDeals(data.deals || []);
      } else if (viewToLoad === "conversations") {
        const { data } = await api.get(`${root}/conversations-summary`, { params: qParams });
        setConversations(data.conversations || []);
      } else if (viewToLoad === "campaigns") {
        const { data } = await api.get(`${root}/campaigns-summary`);
        setCampaigns(data.campaigns || []);
      } else if (viewToLoad === "automations") {
        const { data } = await api.get(`${root}/automations-summary`);
        setAutomations(data);
      } else if (viewToLoad === "reports") {
        await fetchAnalytics();
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load records for this view.", true);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [activeView, scope, selectedBranchId, customerSearch, customerLifecycle, taskFilter, leadFilter, dealFilter, fetchAnalytics, showToast]);

  // Initial mount & Socket listeners
  useEffect(() => {
    fetchPreferences();
    fetchAnalytics();
  }, [fetchPreferences, fetchAnalytics]);

  useEffect(() => {
    fetchViewData(activeView);
  }, [activeView, scope, selectedBranchId, fetchViewData]);

  // Socket & Focus auto-refresh
  useEffect(() => {
    const onAccessChanged = evt => {
      if (!evt || Number(evt.tenantId) === Number(activeTenant?.id)) {
        fetchAnalytics();
        fetchViewData(activeView);
      }
    };
    socket.on("customer_access_changed", onAccessChanged);
    socket.on("inbox_access_changed", onAccessChanged);
    socket.on("workspace_task_created", onAccessChanged);
    socket.on("workspace_task_updated", onAccessChanged);
    socket.on("workspace_deal_created", onAccessChanged);
    socket.on("workspace_deal_updated", onAccessChanged);

    const onVisible = () => {
      if (!document.hidden) {
        fetchAnalytics();
        fetchViewData(activeView);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      socket.off("customer_access_changed", onAccessChanged);
      socket.off("inbox_access_changed", onAccessChanged);
      socket.off("workspace_task_created", onAccessChanged);
      socket.off("workspace_task_updated", onAccessChanged);
      socket.off("workspace_deal_created", onAccessChanged);
      socket.off("workspace_deal_updated", onAccessChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeTenant?.id, activeView, fetchAnalytics, fetchViewData]);

  // Sync URL customer parameter to drawer
  useEffect(() => {
    const custId = params.get("customer");
    if (custId) {
      api.get(`${root}/customers/${custId}`).then(({ data }) => {
        setActiveDrawer({ type: "customer", id: custId, data });
      }).catch(() => {
        showToast("Requested customer could not be found or access is restricted.", true);
      });
    }
  }, [params, showToast]);

  // Global Search Debounced
  useEffect(() => {
    if (!globalQuery.trim()) {
      setGlobalResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await api.get(`${root}/search`, { params: { q: globalQuery } });
        setGlobalResults(data);
      } catch {
        setGlobalResults(null);
      } finally {
        setSearchLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [globalQuery]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleTaskCompleteToggle = async (task, e) => {
    if (e) e.stopPropagation();
    const newStatus = task.status === "completed" ? "open" : "completed";
    try {
      await api.patch(`${root}/tasks/${task.id}`, { status: newStatus });
      showToast(newStatus === "completed" ? "Task marked completed!" : "Task reopened.");
      fetchViewData(activeView);
      fetchAnalytics();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update task status.", true);
    }
  };

  const handleTaskPriorityChange = async (task, priority, e) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`${root}/tasks/${task.id}`, { priority });
      showToast(`Priority updated to ${priority}`);
      fetchViewData(activeView);
    } catch (err) {
      showToast("Failed to update priority.", true);
    }
  };

  const handleLeadTempChange = async (lead, temperature, e) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`${root}/leads/${lead.id}`, { temperature });
      showToast(`Lead temperature set to ${temperature}`);
      fetchViewData(activeView);
      fetchAnalytics();
    } catch (err) {
      showToast("Failed to update lead temperature.", true);
    }
  };

  const handleDealStageChange = async (deal, stage, e) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`${root}/deals/${deal.id}`, { stage });
      showToast(`Deal moved to ${stage}`);
      fetchViewData(activeView);
      fetchAnalytics();
    } catch (err) {
      showToast("Failed to update deal stage.", true);
    }
  };

  const openCustomerDetail = async custId => {
    setParams({ customer: custId });
    try {
      const { data } = await api.get(`${root}/customers/${custId}`);
      setActiveDrawer({ type: "customer", id: custId, data });
    } catch (err) {
      showToast("Customer details unavailable.", true);
    }
  };

  const closeDrawer = () => {
    setActiveDrawer(null);
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("customer");
      return next;
    });
  };

  const exportCustomers = async () => {
    try {
      const res = await api.get(`${root}/customers/export`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `authorized-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Authorized customers exported successfully.");
    } catch (err) {
      showToast(err.response?.data?.message || "Export failed.", true);
    }
  };

  // Open Transfer dialog
  const openTransferModal = async cust => {
    try {
      const { data } = await api.get("/api/v2/inbox/routing/employees");
      setEmployeesList(data.employees || []);
      setTransferModal({ open: true, customer: cust });
    } catch (err) {
      showToast("Could not load employee directory for transfer.", true);
    }
  };

  return (
    <div className="wa-unified-workspace emp-surface" aria-label="SaaS Operations Workspace">
      {/* ── Top Notifications ── */}
      {errorNotice && (
        <div className="wa-banner wa-banner-error" role="alert">
          <AlertCircle size={16} />
          <span>{errorNotice}</span>
          <button type="button" onClick={() => setErrorNotice("")}><X size={14} /></button>
        </div>
      )}
      {successNotice && (
        <div className="wa-banner wa-banner-success" role="status">
          <CheckCircle2 size={16} />
          <span>{successNotice}</span>
          <button type="button" onClick={() => setSuccessNotice("")}><X size={14} /></button>
        </div>
      )}

      {/* ── 1. Workspace Header ── */}
      <header className="wa-ws-header">
        <div className="wa-ws-header-left">
          <div className="wa-ws-brand-cluster">
            <h1 className="wa-ws-title">Operations Workspace</h1>
            <div className="wa-ws-badges">
              <span className="wa-badge wa-badge-org">{activeTenant?.name || "Organization"}</span>
              {activeBranch && <span className="wa-badge wa-badge-branch">{activeBranch.name}</span>}
              <span className="wa-badge wa-badge-role">
                <UserCheck size={11} className="inline mr-1" />
                {admin ? "Administrator" : roleInActiveOrg === "branch_manager" ? "Branch Manager" : "Agent"}
              </span>
            </div>
          </div>
          <p className="wa-ws-subtitle">Unified command center for customer operations, daily execution & revenue pipelines.</p>
        </div>

        <div className="wa-ws-header-actions">
          {/* Universal Scope Switcher */}
          <div className="wa-scope-control" title="Authorized Scope Boundary">
            <label htmlFor="wa-scope-select" className="sr-only">Scope</label>
            <SlidersHorizontal size={13} className="text-slate-400 ml-2" />
            <select
              id="wa-scope-select"
              value={scope}
              onChange={e => setScope(e.target.value)}
              className="wa-scope-dropdown"
            >
              <option value="mine">My Work</option>
              {(admin || roleInActiveOrg === "branch_manager") && <option value="branch">My Branch</option>}
              {admin && <option value="organization">All Branches / Organization</option>}
            </select>
          </div>

          {/* Global Search Button */}
          <button
            type="button"
            className="wa-btn wa-btn-secondary"
            onClick={() => setGlobalSearchOpen(true)}
            title="Search workspace (Ctrl+K)"
          >
            <Search size={14} />
            <span className="hidden sm:inline">Search...</span>
          </button>

          {/* Quick Create Dropdown */}
          <div className="wa-quick-create-wrap">
            <button
              type="button"
              className="wa-btn wa-btn-primary"
              onClick={() => setQuickCreateModal({ open: true, type: "task" })}
            >
              <Plus size={14} />
              <span>New Record</span>
            </button>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            className="wa-btn wa-btn-ghost"
            onClick={() => fetchViewData(activeView)}
            disabled={refreshing}
            title="Refresh current workspace"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>

          {/* Settings / Personalization */}
          <button
            type="button"
            className="wa-btn wa-btn-ghost"
            onClick={() => setPreferencesModal(true)}
            title="Workspace preferences"
          >
            <Settings size={14} />
          </button>
        </div>
      </header>

      {/* ── 2. Tab Navigation Rail ── */}
      <nav className="wa-ws-nav-tabs" aria-label="Workspace views">
        {VIEW_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          let badgeCount = null;
          if (analytics) {
            if (tab.id === "my_day") {
              badgeCount = (analytics.overdue_tasks || 0) + (analytics.today_tasks || 0);
            } else if (tab.badgeKey && analytics[tab.badgeKey]) {
              badgeCount = analytics[tab.badgeKey];
            }
          }
          return (
            <button
              key={tab.id}
              type="button"
              className={`wa-ws-tab-btn ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveView(tab.id)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {badgeCount > 0 && <span className="wa-tab-badge">{badgeCount}</span>}
            </button>
          );
        })}
      </nav>

      {/* ── 3. Active View Content ── */}
      <main className="wa-ws-content-body">
        {activeView === "overview" && (
          <OverviewView
            analytics={analytics}
            onSelectView={setActiveView}
            onOpenCustomer={openCustomerDetail}
            onQuickCreate={type => setQuickCreateModal({ open: true, type })}
          />
        )}

        {activeView === "my_day" && (
          <MyDayView
            data={myDayData}
            onToggleTask={handleTaskCompleteToggle}
            onOpenCustomer={openCustomerDetail}
            onQuickCreateTask={() => setQuickCreateModal({ open: true, type: "task" })}
            refresh={() => fetchViewData("my_day")}
          />
        )}

        {activeView === "customers" && (
          <CustomersView
            customers={customers}
            cursor={customerCursor}
            search={customerSearch}
            setSearch={setCustomerSearch}
            lifecycle={customerLifecycle}
            setLifecycle={setCustomerLifecycle}
            onSelectCustomer={openCustomerDetail}
            onExport={exportCustomers}
            onNewCustomer={() => setQuickCreateModal({ open: true, type: "customer" })}
          />
        )}

        {activeView === "tasks" && (
          <TasksView
            tasks={tasks}
            viewMode={taskViewMode}
            setViewMode={setTaskViewMode}
            filters={taskFilter}
            setFilters={setTaskFilter}
            onToggleComplete={handleTaskCompleteToggle}
            onPriorityChange={handleTaskPriorityChange}
            onSelectCustomer={openCustomerDetail}
            onNewTask={() => setQuickCreateModal({ open: true, type: "task" })}
          />
        )}

        {activeView === "leads" && (
          <LeadsView
            leads={leads}
            filters={leadFilter}
            setFilters={setLeadFilter}
            onTempChange={handleLeadTempChange}
            onSelectCustomer={openCustomerDetail}
            onNewLead={() => setQuickCreateModal({ open: true, type: "lead" })}
          />
        )}

        {activeView === "deals" && (
          <DealsView
            deals={deals}
            filters={dealFilter}
            setFilters={setDealFilter}
            onStageChange={handleDealStageChange}
            onSelectCustomer={openCustomerDetail}
            onNewDeal={() => setQuickCreateModal({ open: true, type: "deal" })}
          />
        )}

        {activeView === "conversations" && (
          <ConversationsView
            conversations={conversations}
            onSelectCustomer={openCustomerDetail}
          />
        )}

        {activeView === "campaigns" && (
          <CampaignsView
            campaigns={campaigns}
          />
        )}

        {activeView === "automations" && (
          <AutomationsView
            automations={automations.automations}
            flows={automations.flows}
          />
        )}

        {activeView === "reports" && (
          <ReportsView
            analytics={analytics}
          />
        )}
      </main>

      {/* ── 4. Contextual Working Drawer (Customer 360 & Inline Details) ── */}
      {activeDrawer && (
        <div className="wa-drawer-backdrop" onClick={closeDrawer}>
          <aside className="wa-drawer-panel" onClick={e => e.stopPropagation()}>
            <header className="wa-drawer-header">
              <div className="flex items-center gap-3">
                <span className="emp-avatar emp-avatar-md">{initials(activeDrawer.data?.customer?.name)}</span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{activeDrawer.data?.customer?.name}</h2>
                  <p className="text-xs text-slate-500">{activeDrawer.data?.customer?.phone} · Owner {activeDrawer.data?.customer?.assigned_agent_id || "Unassigned"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeDrawer.data?.canTransfer && (
                  <button
                    type="button"
                    className="wa-btn wa-btn-xs wa-btn-secondary"
                    onClick={() => openTransferModal(activeDrawer.data.customer)}
                  >
                    Transfer
                  </button>
                )}
                <button type="button" className="wa-btn-icon" onClick={closeDrawer}>
                  <X size={16} />
                </button>
              </div>
            </header>

            <Customer360Body
              customerId={activeDrawer.id}
              initialDetail={activeDrawer.data}
              onUpdated={() => {
                fetchAnalytics();
                fetchViewData(activeView);
              }}
              showToast={showToast}
            />
          </aside>
        </div>
      )}

      {/* ── 5. Quick Create Modal ── */}
      {quickCreateModal.open && (
        <QuickCreateModal
          type={quickCreateModal.type}
          onClose={() => setQuickCreateModal({ open: false, type: "task" })}
          onSuccess={() => {
            setQuickCreateModal({ open: false, type: "task" });
            fetchAnalytics();
            fetchViewData(activeView);
            showToast("Record created successfully!");
          }}
          showToast={showToast}
        />
      )}

      {/* ── 6. Global Search Overlay ── */}
      {globalSearchOpen && (
        <div className="wa-search-overlay-backdrop" onClick={() => setGlobalSearchOpen(false)}>
          <div className="wa-search-modal" onClick={e => e.stopPropagation()}>
            <div className="wa-search-input-box">
              <Search size={18} className="text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search customers, tasks, deals or leads..."
                value={globalQuery}
                onChange={e => setGlobalQuery(e.target.value)}
                className="wa-search-field"
              />
              <button type="button" onClick={() => setGlobalSearchOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="wa-search-results-pane">
              {searchLoading && <p className="p-4 text-xs text-slate-500">Searching records...</p>}
              {!searchLoading && globalResults && (
                <div className="wa-search-results-groups">
                  {globalResults.customers?.length > 0 && (
                    <div className="wa-search-group">
                      <h4>Customers</h4>
                      {globalResults.customers.map(c => (
                        <div
                          key={c.id}
                          className="wa-search-item"
                          onClick={() => {
                            setGlobalSearchOpen(false);
                            openCustomerDetail(c.id);
                          }}
                        >
                          <strong>{c.name}</strong>
                          <span className="text-xs text-slate-500">{c.phone}</span>
                          <span className="wa-pill ml-auto">{c.lifecycle_stage}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {globalResults.tasks?.length > 0 && (
                    <div className="wa-search-group">
                      <h4>Tasks</h4>
                      {globalResults.tasks.map(t => (
                        <div
                          key={t.id}
                          className="wa-search-item"
                          onClick={() => {
                            setGlobalSearchOpen(false);
                            openCustomerDetail(t.contact_id);
                          }}
                        >
                          <strong>{t.title}</strong>
                          <span className="text-xs text-slate-500">for {t.contact_name}</span>
                          <span className="wa-pill ml-auto">{t.status}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {globalResults.deals?.length > 0 && (
                    <div className="wa-search-group">
                      <h4>Deals</h4>
                      {globalResults.deals.map(d => (
                        <div
                          key={d.id}
                          className="wa-search-item"
                          onClick={() => {
                            setGlobalSearchOpen(false);
                            openCustomerDetail(d.contact_id);
                          }}
                        >
                          <strong>{d.title}</strong>
                          <span className="text-xs text-emerald-600 font-semibold">{formatMoney(d.amount)}</span>
                          <span className="wa-pill ml-auto">{d.stage}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {globalResults.leads?.length > 0 && (
                    <div className="wa-search-group">
                      <h4>Leads</h4>
                      {globalResults.leads.map(l => (
                        <div
                          key={l.id}
                          className="wa-search-item"
                          onClick={() => {
                            setGlobalSearchOpen(false);
                            openCustomerDetail(l.contact_id);
                          }}
                        >
                          <strong>{l.name}</strong>
                          <span className="text-xs text-slate-500">{l.message?.slice(0, 40)}...</span>
                          <span className={`wa-pill wa-pill-${l.temperature} ml-auto`}>{l.temperature}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!globalResults.customers?.length && !globalResults.tasks?.length && !globalResults.deals?.length && !globalResults.leads?.length && (
                    <p className="p-6 text-center text-sm text-slate-500">No records found matching "{globalQuery}".</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Preferences Modal ── */}
      {preferencesModal && (
        <PreferencesModal
          preferences={userPreferences}
          onClose={() => setPreferencesModal(false)}
          onSave={async newPrefs => {
            await api.put(`${root}/preferences`, newPrefs);
            setUserPreferences(newPrefs);
            setPreferencesModal(false);
            showToast("Preferences updated.");
          }}
        />
      )}

      {/* ── 8. Customer Transfer Modal ── */}
      {transferModal.open && (
        <CustomerTransferDialog
          customer={transferModal.customer}
          employees={employeesList}
          onClose={() => setTransferModal({ open: false, customer: null })}
          onTransferred={() => {
            setTransferModal({ open: false, customer: null });
            closeDrawer();
            fetchAnalytics();
            fetchViewData(activeView);
            showToast("Customer ownership transferred.");
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── SUBVIEW: Overview Dashboard ──────────────────────────────────────────────
function OverviewView({ analytics, onSelectView, onOpenCustomer, onQuickCreate }) {
  if (!analytics) return <div className="p-8 text-center text-slate-400">Loading operational overview...</div>;

  return (
    <div className="wa-overview-grid">
      {/* Dynamic Operational Alerts Banner */}
      {analytics.alerts?.length > 0 && (
        <section className="wa-alerts-strip" aria-label="Operational Action Alerts">
          {analytics.alerts.map(alert => (
            <div key={alert.id} className={`wa-alert-card wa-alert-${alert.severity}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} />
                <strong>{alert.title}</strong>
              </div>
              <p className="text-xs text-slate-600 mt-1">{alert.message}</p>
              {alert.actionView && (
                <button
                  type="button"
                  className="wa-alert-action-btn"
                  onClick={() => onSelectView(alert.actionView)}
                >
                  Resolve now <ArrowRight size={11} className="inline ml-1" />
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {/* High-Impact Interactive KPI Grid */}
      <section className="wa-kpi-deck" aria-label="Core Metrics">
        <div className="wa-kpi-card" onClick={() => onSelectView("customers")}>
          <span className="wa-kpi-label">Active Customers</span>
          <span className="wa-kpi-value">{analytics.customers || 0}</span>
          <span className="wa-kpi-meta text-emerald-600">{analytics.clients || 0} converted clients</span>
        </div>

        <div className="wa-kpi-card" onClick={() => onSelectView("tasks")}>
          <span className="wa-kpi-label">Open Tasks</span>
          <span className="wa-kpi-value">{analytics.open_tasks || 0}</span>
          <span className={`wa-kpi-meta ${(analytics.overdue_tasks || 0) > 0 ? "text-rose-600 font-bold" : "text-slate-500"}`}>
            {analytics.overdue_tasks || 0} overdue
          </span>
        </div>

        <div className="wa-kpi-card" onClick={() => onSelectView("deals")}>
          <span className="wa-kpi-label">Pipeline Value</span>
          <span className="wa-kpi-value text-emerald-700">{formatMoney(analytics.pipeline_value)}</span>
          <span className="wa-kpi-meta text-slate-500">{analytics.deals || 0} active deals ({analytics.won_deals || 0} won)</span>
        </div>

        <div className="wa-kpi-card" onClick={() => onSelectView("leads")}>
          <span className="wa-kpi-label">Leads Pool</span>
          <span className="wa-kpi-value">{analytics.leads || 0}</span>
          <span className="wa-kpi-meta text-amber-600 font-semibold">{analytics.temperature_counts?.hot || 0} hot leads</span>
        </div>

        <div className="wa-kpi-card" onClick={() => onSelectView("conversations")}>
          <span className="wa-kpi-label">Live Chats</span>
          <span className="wa-kpi-value">{analytics.conversations || 0}</span>
          <span className={`wa-kpi-meta ${(analytics.unread_messages || 0) > 0 ? "text-amber-600 font-bold" : "text-slate-500"}`}>
            {analytics.unread_messages || 0} unread messages
          </span>
        </div>

        <div className="wa-kpi-card">
          <span className="wa-kpi-label">Avg First Reply</span>
          <span className="wa-kpi-value text-slate-700">{formatDuration(analytics.average_first_response_seconds)}</span>
          <span className="wa-kpi-meta text-slate-400">7-day server window</span>
        </div>
      </section>

      {/* Two Column Layout: Workload & Recent Activity */}
      <div className="wa-overview-split">
        {/* Left Column: Stage Breakdown & Quick Actions */}
        <div className="wa-overview-left">
          <div className="wa-card">
            <h3 className="wa-card-heading">Deal Pipeline Distribution</h3>
            <div className="wa-stage-bars">
              {DEAL_STAGES.map(stage => {
                const count = analytics.stage_counts?.[stage] || 0;
                return (
                  <div key={stage} className="wa-stage-row">
                    <span className="wa-stage-name">{stage}</span>
                    <div className="wa-stage-bar-track">
                      <div
                        className={`wa-stage-bar-fill wa-stage-${stage}`}
                        style={{ width: `${Math.min(100, count * 15 + 4)}%` }}
                      />
                    </div>
                    <span className="wa-stage-count">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team Workload (for Managers/Admins) */}
          {analytics.workload?.length > 0 && (
            <div className="wa-card">
              <h3 className="wa-card-heading">Team Workload Distribution</h3>
              <div className="wa-table-compact">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Customers</th>
                      <th>Open Tasks</th>
                      <th>Active Deals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.workload.map(member => (
                      <tr key={member.user_id}>
                        <td><strong>{member.first_name || member.email}</strong></td>
                        <td>{member.assigned_customers}</td>
                        <td className={member.open_tasks > 10 ? "text-rose-600 font-bold" : ""}>{member.open_tasks}</td>
                        <td>{member.active_deals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Recent Operational Activity */}
        <div className="wa-overview-right">
          <div className="wa-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="wa-card-heading">Recent Operational Activity</h3>
              <span className="text-xs text-slate-400">Live feed</span>
            </div>
            <div className="wa-activity-feed">
              {(!analytics.recent_activities || !analytics.recent_activities.length) && (
                <p className="text-xs text-slate-400 py-4">No recent activity recorded yet.</p>
              )}
              {analytics.recent_activities?.map(act => (
                <div key={act.id} className="wa-activity-item">
                  <div className="wa-activity-dot" />
                  <div className="wa-activity-content">
                    <p className="wa-activity-text">
                      <span className="font-semibold text-slate-800">{act.contact_name}:</span> {act.body}
                    </p>
                    <span className="wa-activity-time">{formatDate(act.created_at)}</span>
                  </div>
                  {act.contact_id && (
                    <button
                      type="button"
                      className="wa-btn-icon-sm"
                      onClick={() => onOpenCustomer(act.contact_id)}
                      title="Open customer profile"
                    >
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SUBVIEW: My Day (Personal Work Center) ────────────────────────────────────
function MyDayView({ data, onToggleTask, onOpenCustomer, onQuickCreateTask, refresh }) {
  if (!data) return <div className="p-8 text-center text-slate-400">Loading your daily schedule...</div>;

  const totalActionItems = (data.overdueTasks?.length || 0) + (data.todayTasks?.length || 0) + (data.waitingConversations?.length || 0);

  return (
    <div className="wa-myday-container">
      <div className="wa-myday-header">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sun size={20} className="text-amber-500" /> My Day Focus
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {totalActionItems === 0
              ? "All clear! You have completed all scheduled tasks and follow-ups for today."
              : `You have ${totalActionItems} action item${totalActionItems === 1 ? "" : "s"} requiring attention today.`}
          </p>
        </div>
        <button type="button" className="wa-btn wa-btn-primary" onClick={onQuickCreateTask}>
          <Plus size={14} /> Add Daily Task
        </button>
      </div>

      <div className="wa-myday-queues">
        {/* 🚨 Overdue Follow-ups */}
        {data.overdueTasks?.length > 0 && (
          <section className="wa-queue-section wa-queue-overdue">
            <h3 className="wa-queue-title text-rose-700">
              <AlertTriangle size={15} /> Overdue Follow-ups ({data.overdueTasks.length})
            </h3>
            <div className="wa-task-cards-list">
              {data.overdueTasks.map(task => (
                <div key={task.id} className="wa-task-card wa-task-card-overdue">
                  <button
                    type="button"
                    className="wa-task-checkbox"
                    onClick={e => onToggleTask(task, e)}
                    title="Mark complete"
                  >
                    <CheckSquare size={16} />
                  </button>
                  <div className="wa-task-body">
                    <strong>{task.title}</strong>
                    <div className="wa-task-subline">
                      <span className="text-rose-600 font-semibold">Due {formatDate(task.due_at)}</span>
                      <span className="text-slate-400">·</span>
                      <button
                        type="button"
                        className="wa-link-inline"
                        onClick={() => onOpenCustomer(task.contact_id)}
                      >
                        {task.contact_name}
                      </button>
                    </div>
                  </div>
                  <span className={`wa-pill wa-pill-${task.priority}`}>{task.priority}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 📅 Tasks Due Today */}
        <section className="wa-queue-section">
          <h3 className="wa-queue-title text-slate-800">
            <Calendar size={15} /> Due Today ({data.todayTasks?.length || 0})
          </h3>
          {(!data.todayTasks || data.todayTasks.length === 0) && (
            <p className="text-xs text-slate-400 py-3">No other tasks scheduled for today.</p>
          )}
          <div className="wa-task-cards-list">
            {data.todayTasks?.map(task => (
              <div key={task.id} className="wa-task-card">
                <button
                  type="button"
                  className="wa-task-checkbox"
                  onClick={e => onToggleTask(task, e)}
                  title="Mark complete"
                >
                  <CheckSquare size={16} />
                </button>
                <div className="wa-task-body">
                  <strong>{task.title}</strong>
                  <div className="wa-task-subline">
                    <span>Due {formatDate(task.due_at)}</span>
                    <span className="text-slate-400">·</span>
                    <button
                      type="button"
                      className="wa-link-inline"
                      onClick={() => onOpenCustomer(task.contact_id)}
                    >
                      {task.contact_name}
                    </button>
                  </div>
                </div>
                <span className={`wa-pill wa-pill-${task.priority}`}>{task.priority}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 💬 Customer Chats Awaiting Action */}
        {data.waitingConversations?.length > 0 && (
          <section className="wa-queue-section">
            <h3 className="wa-queue-title text-indigo-700">
              <MessageSquare size={15} /> Chats Awaiting Reply ({data.waitingConversations.length})
            </h3>
            <div className="wa-task-cards-list">
              {data.waitingConversations.map(chat => (
                <div key={chat.id} className="wa-task-card">
                  <div className="wa-task-body">
                    <strong>{chat.contact_name} ({chat.contact_phone})</strong>
                    <div className="wa-task-subline">
                      <span>Last active {formatDate(chat.updated_at)}</span>
                    </div>
                  </div>
                  <Link to={`/whatsapp?conversationId=${chat.id}`} className="wa-btn wa-btn-xs wa-btn-secondary">
                    Open Chat <ExternalLink size={11} className="inline ml-1" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ✅ Today's Completed Work */}
        {data.completedToday?.length > 0 && (
          <section className="wa-queue-section wa-queue-completed">
            <h3 className="wa-queue-title text-emerald-700">
              <CheckCircle2 size={15} /> Completed Today ({data.completedToday.length})
            </h3>
            <div className="wa-task-cards-list">
              {data.completedToday.map(task => (
                <div key={task.id} className="wa-task-card opacity-70">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <div className="wa-task-body">
                    <span className="line-through text-slate-700">{task.title}</span>
                    <div className="wa-task-subline">
                      <span className="text-xs text-slate-400">for {task.contact_name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── SUBVIEW: Customers 360° Directory ────────────────────────────────────────
function CustomersView({ customers, cursor, search, setSearch, lifecycle, setLifecycle, onSelectCustomer, onExport, onNewCustomer }) {
  return (
    <div className="wa-customers-view">
      <div className="wa-view-toolbar">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search size={14} className="text-slate-400 ml-1" />
          <input
            type="text"
            placeholder="Search name, phone or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="emp-field w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={lifecycle}
            onChange={e => setLifecycle(e.target.value)}
            className="emp-field"
          >
            <option value="">All Lifecycle Stages</option>
            <option value="lead">Leads only</option>
            <option value="client">Clients only</option>
          </select>
          <button type="button" className="wa-btn wa-btn-secondary" onClick={onExport}>
            <Download size={13} /> Export
          </button>
          <button type="button" className="wa-btn wa-btn-primary" onClick={onNewCustomer}>
            <Plus size={13} /> Add Customer
          </button>
        </div>
      </div>

      <div className="wa-customers-table-wrap">
        <table className="wa-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Lifecycle</th>
              <th>Consent</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(!customers || customers.length === 0) && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-400">
                  No authorized customers match your filters.
                </td>
              </tr>
            )}
            {customers?.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onSelectCustomer(c.id)}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="emp-avatar">{initials(c.name)}</span>
                    <strong>{c.name}</strong>
                  </div>
                </td>
                <td>{c.phone}</td>
                <td>{c.email || "—"}</td>
                <td>
                  <span className={`wa-pill ${c.lifecycle_stage === "client" ? "wa-pill-ok" : "wa-pill-lead"}`}>
                    {c.lifecycle_stage || "lead"}
                  </span>
                </td>
                <td>
                  {c.opt_in_status ? (
                    <span className="wa-pill wa-pill-ok flex items-center gap-1 w-max">
                      <ShieldCheck size={11} /> Granted
                    </span>
                  ) : (
                    <span className="wa-pill wa-pill-warm w-max">Not recorded</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="wa-btn wa-btn-xs wa-btn-secondary"
                    onClick={e => {
                      e.stopPropagation();
                      onSelectCustomer(c.id);
                    }}
                  >
                    Open 360°
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SUBVIEW: Tasks Board & List ──────────────────────────────────────────────
function TasksView({ tasks, viewMode, setViewMode, filters, setFilters, onToggleComplete, onPriorityChange, onSelectCustomer, onNewTask }) {
  const columns = {
    open: tasks.filter(t => t.status === "open"),
    in_progress: tasks.filter(t => t.status === "in_progress"),
    completed: tasks.filter(t => t.status === "completed")
  };

  return (
    <div className="wa-tasks-view">
      <div className="wa-view-toolbar">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filters.priority}
            onChange={e => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            className="emp-field"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filters.due}
            onChange={e => setFilters(prev => ({ ...prev, due: e.target.value }))}
            className="emp-field"
          >
            <option value="">All Due Dates</option>
            <option value="overdue">Overdue only</option>
            <option value="today">Due Today</option>
            <option value="this_week">Due this week</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="wa-segmented-control">
            <button
              type="button"
              className={viewMode === "board" ? "is-active" : ""}
              onClick={() => setViewMode("board")}
              title="Kanban Board View"
            >
              <LayoutGrid size={13} /> Board
            </button>
            <button
              type="button"
              className={viewMode === "list" ? "is-active" : ""}
              onClick={() => setViewMode("list")}
              title="Table List View"
            >
              <List size={13} /> List
            </button>
          </div>
          <button type="button" className="wa-btn wa-btn-primary" onClick={onNewTask}>
            <Plus size={13} /> Add Task
          </button>
        </div>
      </div>

      {viewMode === "board" ? (
        <div className="wa-kanban-board">
          {["open", "in_progress", "completed"].map(colKey => {
            const colTasks = columns[colKey] || [];
            return (
              <div key={colKey} className="wa-kanban-col">
                <div className="wa-kanban-col-head">
                  <span className="capitalize font-bold text-slate-800">{colKey.replace("_", " ")}</span>
                  <span className="wa-count-badge">{colTasks.length}</span>
                </div>
                <div className="wa-kanban-cards-pane">
                  {colTasks.map(task => (
                    <div key={task.id} className="wa-kanban-card">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-sm text-slate-900">{task.title}</strong>
                        <span className={`wa-pill wa-pill-${task.priority}`}>{task.priority}</span>
                      </div>
                      {task.description && <p className="text-xs text-slate-600 mt-1">{task.description}</p>}
                      <div className="wa-kanban-card-foot">
                        <button
                          type="button"
                          className="wa-link-inline"
                          onClick={() => onSelectCustomer(task.contact_id)}
                        >
                          {task.contact_name}
                        </button>
                        {task.due_at && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={11} /> {formatDate(task.due_at)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          className="wa-btn-xs wa-btn-ghost text-xs"
                          onClick={e => onToggleComplete(task, e)}
                        >
                          {task.status === "completed" ? "Reopen" : "Mark done"}
                        </button>
                        <select
                          className="text-xs border border-slate-200 rounded px-1"
                          value={task.priority}
                          onChange={e => onPriorityChange(task, e.target.value, e)}
                        >
                          <option value="urgent">Urgent</option>
                          <option value="high">High</option>
                          <option value="normal">Normal</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="wa-table-wrap">
          <table className="wa-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Task Title</th>
                <th>Customer</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td>
                    <button
                      type="button"
                      className="wa-task-checkbox"
                      onClick={e => onToggleComplete(task, e)}
                    >
                      {task.status === "completed" ? (
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      ) : (
                        <CheckSquare size={16} className="text-slate-400" />
                      )}
                    </button>
                  </td>
                  <td>
                    <strong className={task.status === "completed" ? "line-through text-slate-400" : ""}>
                      {task.title}
                    </strong>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="wa-link-inline"
                      onClick={() => onSelectCustomer(task.contact_id)}
                    >
                      {task.contact_name}
                    </button>
                  </td>
                  <td><span className={`wa-pill wa-pill-${task.priority}`}>{task.priority}</span></td>
                  <td>{formatDate(task.due_at) || "No deadline"}</td>
                  <td>{formatDate(task.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SUBVIEW: Leads Pipeline ──────────────────────────────────────────────────
function LeadsView({ leads, filters, setFilters, onTempChange, onSelectCustomer, onNewLead }) {
  return (
    <div className="wa-leads-view">
      <div className="wa-view-toolbar">
        <div className="flex items-center gap-2">
          <select
            value={filters.temperature}
            onChange={e => setFilters(prev => ({ ...prev, temperature: e.target.value }))}
            className="emp-field"
          >
            <option value="">All Temperatures</option>
            {LEAD_TEMPS.map(t => (
              <option key={t} value={t}>{t.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <button type="button" className="wa-btn wa-btn-primary" onClick={onNewLead}>
          <Plus size={13} /> Add Lead
        </button>
      </div>

      <div className="wa-kanban-board">
        {LEAD_TEMPS.map(temp => {
          const tempLeads = leads.filter(l => (l.temperature || "new") === temp);
          return (
            <div key={temp} className="wa-kanban-col">
              <div className={`wa-kanban-col-head wa-lead-head-${temp}`}>
                <span className="font-bold uppercase tracking-wider text-xs">{temp}</span>
                <span className="wa-count-badge">{tempLeads.length}</span>
              </div>
              <div className="wa-kanban-cards-pane">
                {tempLeads.map(lead => (
                  <div key={lead.id} className="wa-kanban-card">
                    <strong className="text-sm text-slate-900">{lead.name || "Unnamed lead"}</strong>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{lead.message}</p>
                    <div className="wa-kanban-card-foot mt-2">
                      <button
                        type="button"
                        className="wa-link-inline"
                        onClick={() => onSelectCustomer(lead.contact_id)}
                      >
                        {lead.contact_name || lead.phone}
                      </button>
                      <span className="text-xs text-slate-400">{formatDate(lead.created_at)}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Update temp:</span>
                      <select
                        className="text-xs border border-slate-200 rounded px-1"
                        value={lead.temperature || "new"}
                        onChange={e => onTempChange(lead, e.target.value, e)}
                      >
                        {LEAD_TEMPS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SUBVIEW: Deals Pipeline ──────────────────────────────────────────────────
function DealsView({ deals, filters, setFilters, onStageChange, onSelectCustomer, onNewDeal }) {
  const totalPipeline = deals
    .filter(d => ["new", "qualified", "proposal", "negotiation"].includes(d.stage))
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const totalWon = deals
    .filter(d => d.stage === "won")
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  return (
    <div className="wa-deals-view">
      <div className="wa-view-toolbar">
        <div className="flex items-center gap-4">
          <div className="wa-stat-chip">
            <span className="text-xs text-slate-500">Open Pipeline:</span>
            <strong className="text-emerald-700 font-bold ml-1">{formatMoney(totalPipeline)}</strong>
          </div>
          <div className="wa-stat-chip">
            <span className="text-xs text-slate-500">Won Value:</span>
            <strong className="text-indigo-700 font-bold ml-1">{formatMoney(totalWon)}</strong>
          </div>
        </div>
        <button type="button" className="wa-btn wa-btn-primary" onClick={onNewDeal}>
          <Plus size={13} /> Add Deal
        </button>
      </div>

      <div className="wa-kanban-board">
        {DEAL_STAGES.map(stage => {
          const stageDeals = deals.filter(d => (d.stage || "new") === stage);
          const stageAmount = stageDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
          return (
            <div key={stage} className="wa-kanban-col">
              <div className="wa-kanban-col-head">
                <div>
                  <span className="font-bold capitalize text-xs text-slate-800">{stage}</span>
                  <div className="text-xs text-slate-400 font-semibold">{formatMoney(stageAmount)}</div>
                </div>
                <span className="wa-count-badge">{stageDeals.length}</span>
              </div>
              <div className="wa-kanban-cards-pane">
                {stageDeals.map(deal => (
                  <div key={deal.id} className="wa-kanban-card">
                    <div className="flex items-start justify-between">
                      <strong className="text-sm text-slate-900">{deal.title}</strong>
                      <span className="text-xs font-bold text-emerald-700">{formatMoney(deal.amount)}</span>
                    </div>
                    {deal.notes && <p className="text-xs text-slate-500 mt-1">{deal.notes}</p>}
                    <div className="wa-kanban-card-foot mt-2">
                      <button
                        type="button"
                        className="wa-link-inline"
                        onClick={() => onSelectCustomer(deal.contact_id)}
                      >
                        {deal.contact_name}
                      </button>
                      <span className="text-xs text-slate-400">{formatDate(deal.created_at)}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Move stage:</span>
                      <select
                        className="text-xs border border-slate-200 rounded px-1"
                        value={deal.stage || "new"}
                        onChange={e => onStageChange(deal, e.target.value, e)}
                      >
                        {DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SUBVIEW: Customer Conversations Summary ──────────────────────────────────
function ConversationsView({ conversations, onSelectCustomer }) {
  return (
    <div className="wa-conversations-view">
      <div className="wa-table-wrap">
        <table className="wa-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Last Message</th>
              <th>Unread</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(!conversations || conversations.length === 0) && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-400">
                  No active customer conversations found.
                </td>
              </tr>
            )}
            {conversations?.map(chat => (
              <tr key={chat.id}>
                <td>
                  <button
                    type="button"
                    className="font-bold text-slate-900 hover:underline"
                    onClick={() => onSelectCustomer(chat.contact_id)}
                  >
                    {chat.contact_name}
                  </button>
                </td>
                <td>{chat.contact_phone}</td>
                <td>
                  <span className={`wa-pill ${chat.status === "open" ? "wa-pill-ok" : "wa-pill-off"}`}>
                    {chat.status}
                  </span>
                </td>
                <td className="max-w-xs truncate text-xs text-slate-600">
                  {chat.last_message_body || "No message log"}
                </td>
                <td>
                  {chat.unread_count > 0 ? (
                    <span className="wa-badge bg-rose-600 text-white font-bold">{chat.unread_count}</span>
                  ) : (
                    <span className="text-xs text-slate-400">0</span>
                  )}
                </td>
                <td>
                  <Link
                    to={`/whatsapp?conversationId=${chat.id}`}
                    className="wa-btn wa-btn-xs wa-btn-secondary"
                  >
                    Open Chat
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SUBVIEW: Campaigns Summary ────────────────────────────────────────────────
function CampaignsView({ campaigns }) {
  return (
    <div className="wa-campaigns-view">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900">Broadcast Campaigns</h3>
        <Link to="/whatsapp/campaigns" className="wa-btn wa-btn-primary">
          <Send size={13} /> Manage All Campaigns
        </Link>
      </div>
      <div className="wa-table-wrap">
        <table className="wa-table">
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Status</th>
              <th>Audience Policy</th>
              <th>Recipients</th>
              <th>Sent</th>
              <th>Failed</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(!campaigns || campaigns.length === 0) && (
              <tr>
                <td colSpan="7" className="text-center py-8 text-slate-400">
                  No campaign broadcasts scheduled or executed yet.
                </td>
              </tr>
            )}
            {campaigns?.map(camp => (
              <tr key={camp.id}>
                <td><strong>{camp.name}</strong></td>
                <td><span className={`wa-pill wa-pill-${camp.status}`}>{camp.status}</span></td>
                <td>{camp.audience_policy}</td>
                <td>{camp.total_recipients || 0}</td>
                <td className="text-emerald-600 font-semibold">{camp.sent_count || 0}</td>
                <td className="text-rose-600">{camp.failed_count || 0}</td>
                <td>{formatDate(camp.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SUBVIEW: Automations & Flows ─────────────────────────────────────────────
function AutomationsView({ automations, flows }) {
  return (
    <div className="wa-automations-view">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900">Automation Rules & Chatbot Flows</h3>
        <div className="flex items-center gap-2">
          <Link to="/whatsapp/automations" className="wa-btn wa-btn-secondary">Automations</Link>
          <Link to="/whatsapp/flows" className="wa-btn wa-btn-primary">Flow Builder</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="wa-card">
          <h4 className="wa-card-heading">Active Automations</h4>
          <div className="wa-table-compact">
            <table>
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Trigger</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {automations?.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td>{a.trigger_event || a.trigger_type}</td>
                    <td><span className="wa-pill wa-pill-ok">{a.status ? "Active" : "Paused"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="wa-card">
          <h4 className="wa-card-heading">Chatbot Flows</h4>
          <div className="wa-table-compact">
            <table>
              <thead>
                <tr>
                  <th>Flow Name</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {flows?.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.name}</strong></td>
                    <td><span className="wa-pill">{f.status || "Draft"}</span></td>
                    <td>{formatDate(f.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SUBVIEW: Operational Reports ─────────────────────────────────────────────
function ReportsView({ analytics }) {
  if (!analytics) return <div className="p-8 text-center text-slate-400">Loading metrics...</div>;
  return (
    <div className="wa-reports-view">
      <h3 className="text-base font-bold text-slate-900 mb-4">Operational Analytics & SLAs</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="wa-kpi-card">
          <span className="wa-kpi-label">Conversion Rate</span>
          <span className="wa-kpi-value text-emerald-700">
            {analytics.customers > 0 ? `${((analytics.clients / analytics.customers) * 100).toFixed(1)}%` : "0%"}
          </span>
          <span className="wa-kpi-meta">Lead to Client</span>
        </div>

        <div className="wa-kpi-card">
          <span className="wa-kpi-label">Won Revenue</span>
          <span className="wa-kpi-value text-indigo-700">{formatMoney(analytics.won_value)}</span>
          <span className="wa-kpi-meta">{analytics.won_deals} closed deals</span>
        </div>

        <div className="wa-kpi-card">
          <span className="wa-kpi-label">Task Completion</span>
          <span className="wa-kpi-value">
            {((analytics.completed_tasks || 0) + (analytics.open_tasks || 0)) > 0
              ? `${Math.round(((analytics.completed_tasks || 0) / ((analytics.completed_tasks || 0) + (analytics.open_tasks || 0))) * 100)}%`
              : "100%"}
          </span>
          <span className="wa-kpi-meta">{analytics.completed_tasks || 0} completed</span>
        </div>

        <div className="wa-kpi-card">
          <span className="wa-kpi-label">Avg Response SLA</span>
          <span className="wa-kpi-value">{formatDuration(analytics.average_first_response_seconds)}</span>
          <span className="wa-kpi-meta">{analytics.first_response_samples || 0} measured</span>
        </div>
      </div>
    </div>
  );
}

// ── CUSTOMER 360° DRAWER BODY ────────────────────────────────────────────────
function Customer360Body({ customerId, initialDetail, onUpdated, showToast }) {
  const [subTab, setSubTab] = useState("profile");
  const [customer, setCustomer] = useState(initialDetail?.customer || {});
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [proofText, setProofText] = useState("");
  const [newDraft, setNewDraft] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDue, setNewDue] = useState("");

  const loadSubRecords = useCallback(async kind => {
    setLoadingRecords(true);
    try {
      const { data } = await api.get(`${root}/customers/${customerId}/${kind}`);
      setRecords(data.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (subTab !== "profile" && subTab !== "consent") {
      loadSubRecords(subTab);
    }
  }, [subTab, loadSubRecords]);

  const saveProfile = async e => {
    e.preventDefault();
    try {
      await api.patch(`${root}/customers/${customerId}`, customer);
      showToast("Profile saved.");
      onUpdated();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update profile.", true);
    }
  };

  const handleConsentToggle = async optIn => {
    try {
      await api.patch(`${root}/customers/${customerId}/consent`, { optIn, proof: proofText || "Direct customer agreement" });
      setCustomer(prev => ({ ...prev, opt_in_status: optIn ? 1 : 0 }));
      setProofText("");
      showToast(optIn ? "Marketing consent recorded with proof." : "Marketing consent revoked.");
      onUpdated();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to change consent status.", true);
    }
  };

  const addSubRecord = async e => {
    e.preventDefault();
    try {
      const payload = subTab === "activities"
        ? { kind: "note", body: newDraft }
        : subTab === "leads"
        ? { message: newDraft }
        : subTab === "deals"
        ? { title: newDraft, amount: newAmount }
        : { title: newDraft, due_at: newDue || null };
      await api.post(`${root}/customers/${customerId}/${subTab}`, payload);
      setNewDraft("");
      setNewAmount("");
      setNewDue("");
      loadSubRecords(subTab);
      showToast("Record added.");
      onUpdated();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to add record.", true);
    }
  };

  return (
    <div className="wa-drawer-body">
      <div className="wa-drawer-subnav">
        {["profile", "consent", "tasks", "leads", "deals", "activities", "transfers"].map(tab => (
          <button
            key={tab}
            type="button"
            className={`wa-drawer-tab-btn ${subTab === tab ? "is-active" : ""}`}
            onClick={() => setSubTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="wa-drawer-tab-content">
        {subTab === "profile" && (
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="emp-label">Full Name</label>
              <input
                type="text"
                required
                className="emp-field w-full"
                value={customer.name || ""}
                onChange={e => setCustomer({ ...customer, name: e.target.value })}
              />
            </div>
            <div>
              <label className="emp-label">Email Address</label>
              <input
                type="email"
                className="emp-field w-full"
                value={customer.email || ""}
                onChange={e => setCustomer({ ...customer, email: e.target.value })}
              />
            </div>
            <div>
              <label className="emp-label">Lifecycle Stage</label>
              <select
                className="emp-field w-full"
                value={customer.lifecycle_stage || "lead"}
                onChange={e => setCustomer({ ...customer, lifecycle_stage: e.target.value })}
              >
                <option value="lead">Lead</option>
                <option value="client">Client</option>
              </select>
            </div>
            <button type="submit" className="wa-btn wa-btn-primary">Save Profile Changes</button>
          </form>
        )}

        {subTab === "consent" && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="text-xs font-bold text-slate-700">Consent Status:</span>
              <span className={`wa-pill ml-2 ${customer.opt_in_status ? "wa-pill-ok" : "wa-pill-warm"}`}>
                {customer.opt_in_status ? "Granted & Verified" : "Not Recorded"}
              </span>
            </div>
            <div>
              <label className="emp-label">Verification Proof / Evidence</label>
              <textarea
                placeholder="e.g. Inbound message request or verified order agreement"
                value={proofText}
                onChange={e => setProofText(e.target.value)}
                className="emp-field w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="wa-btn wa-btn-primary"
                onClick={() => handleConsentToggle(true)}
              >
                Record Consent
              </button>
              {customer.opt_in_status ? (
                <button
                  type="button"
                  className="wa-btn wa-btn-danger"
                  onClick={() => handleConsentToggle(false)}
                >
                  Revoke Consent
                </button>
              ) : null}
            </div>
          </div>
        )}

        {subTab !== "profile" && subTab !== "consent" && (
          <div className="space-y-4">
            {subTab !== "transfers" && (
              <form onSubmit={addSubRecord} className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                <label className="emp-label">Add New {subTab.slice(0, -1).toUpperCase()}</label>
                <input
                  type="text"
                  required
                  placeholder="Title or note..."
                  value={newDraft}
                  onChange={e => setNewDraft(e.target.value)}
                  className="emp-field w-full"
                />
                {subTab === "tasks" && (
                  <input
                    type="datetime-local"
                    value={newDue}
                    onChange={e => setNewDue(e.target.value)}
                    className="emp-field w-full"
                  />
                )}
                {subTab === "deals" && (
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount in INR"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    className="emp-field w-full"
                  />
                )}
                <button type="submit" className="wa-btn wa-btn-xs wa-btn-primary">Add Record</button>
              </form>
            )}

            <div className="wa-drawer-records-list">
              {loadingRecords && <p className="text-xs text-slate-400">Loading {subTab}...</p>}
              {!loadingRecords && !records.length && <p className="text-xs text-slate-400">No {subTab} recorded yet.</p>}
              {records.map(rec => (
                <div key={rec.id} className="p-2 border-b border-slate-100 text-xs">
                  <p className="font-semibold text-slate-800">{rec.title || rec.message || rec.body || rec.reason}</p>
                  <span className="text-slate-400">{formatDate(rec.created_at)}</span>
                  {rec.amount && <span className="text-emerald-700 font-bold ml-2">{formatMoney(rec.amount)}</span>}
                  {rec.status && <span className="wa-pill ml-2">{rec.status}</span>}
                  {rec.temperature && <span className={`wa-pill wa-pill-${rec.temperature} ml-2`}>{rec.temperature}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── QUICK CREATE MODAL ───────────────────────────────────────────────────────
function QuickCreateModal({ type, onClose, onSuccess, showToast }) {
  const [activeTab, setActiveTab] = useState(type || "task");
  const [searchContact, setSearchContact] = useState("");
  const [matchedContacts, setMatchedContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("normal");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState("new");
  const [temp, setTemp] = useState("new");
  const [description, setDescription] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Contact search debounce
  useEffect(() => {
    if (!searchContact.trim()) {
      setMatchedContacts([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`${root}/customers`, { params: { search: searchContact, limit: 5 } });
        setMatchedContacts(data.customers || []);
      } catch {
        setMatchedContacts([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchContact]);

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      if (activeTab === "customer") {
        await api.post(`${root}/customers`, { name: newName, phone: newPhone });
      } else if (activeTab === "task") {
        if (!selectedContact) {
          showToast("Please choose an authorized customer first.", true);
          return;
        }
        await api.post(`${root}/tasks`, {
          contact_id: selectedContact.id,
          title,
          due_at: dueAt || null,
          priority,
          description
        });
      } else if (activeTab === "deal") {
        if (!selectedContact) {
          showToast("Please choose an authorized customer first.", true);
          return;
        }
        await api.post(`${root}/deals`, {
          contact_id: selectedContact.id,
          title,
          amount,
          stage,
          notes: description
        });
      } else if (activeTab === "lead") {
        if (!selectedContact) {
          showToast("Please choose an authorized customer first.", true);
          return;
        }
        await api.post(`${root}/customers/${selectedContact.id}/leads`, {
          message: description || title
        });
      }
      onSuccess();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to create record.", true);
    }
  };

  return (
    <div className="wa-modal-backdrop" onClick={onClose}>
      <div className="wa-modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <h3 className="font-bold text-base text-slate-900">Create New Record</h3>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="wa-modal-tabs">
          {["task", "deal", "lead", "customer"].map(tab => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "is-active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="wa-modal-form">
          {activeTab === "customer" ? (
            <>
              <div>
                <label className="emp-label">Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full business or personal name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="emp-field w-full"
                />
              </div>
              <div>
                <label className="emp-label">Phone with country code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 919876543210"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="emp-field w-full"
                />
              </div>
            </>
          ) : (
            <>
              {/* Customer Selector */}
              <div>
                <label className="emp-label">Related Customer</label>
                {selectedContact ? (
                  <div className="flex items-center justify-between p-2 bg-slate-100 rounded border border-slate-300">
                    <span className="text-xs font-semibold">{selectedContact.name} ({selectedContact.phone})</span>
                    <button type="button" onClick={() => setSelectedContact(null)} className="text-xs text-rose-600">Change</button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Type name or phone to search..."
                      value={searchContact}
                      onChange={e => setSearchContact(e.target.value)}
                      className="emp-field w-full"
                    />
                    {matchedContacts.length > 0 && (
                      <div className="wa-dropdown-list">
                        {matchedContacts.map(c => (
                          <div
                            key={c.id}
                            className="wa-dropdown-item"
                            onClick={() => {
                              setSelectedContact(c);
                              setSearchContact("");
                              setMatchedContacts([]);
                            }}
                          >
                            <strong>{c.name}</strong> <span className="text-slate-500 text-xs">({c.phone})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="emp-label">{activeTab === "task" ? "Task Title" : activeTab === "deal" ? "Deal Title" : "Lead Description"}</label>
                <input
                  type="text"
                  required
                  placeholder="Brief summary..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="emp-field w-full"
                />
              </div>

              {activeTab === "task" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="emp-label">Due Date & Time</label>
                    <input
                      type="datetime-local"
                      value={dueAt}
                      onChange={e => setDueAt(e.target.value)}
                      className="emp-field w-full"
                    />
                  </div>
                  <div>
                    <label className="emp-label">Priority</label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className="emp-field w-full"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === "deal" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="emp-label">Deal Amount (INR)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="10000"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="emp-field w-full"
                    />
                  </div>
                  <div>
                    <label className="emp-label">Stage</label>
                    <select
                      value={stage}
                      onChange={e => setStage(e.target.value)}
                      className="emp-field w-full"
                    >
                      {DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="emp-label">Notes / Description (Optional)</label>
                <textarea
                  rows="2"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="emp-field w-full"
                />
              </div>
            </>
          )}

          <div className="wa-modal-actions">
            <button type="button" className="wa-btn wa-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="wa-btn wa-btn-primary">Create Record</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CUSTOMER TRANSFER DIALOG ─────────────────────────────────────────────────
function CustomerTransferDialog({ customer, employees, onClose, onTransferred, showToast }) {
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleTransfer = async () => {
    if (!target || !reason.trim()) return;
    const [userId, branchId] = target.split(":").map(Number);
    setBusy(true);
    try {
      await api.post(`${root}/customers/${customer.id}/transfer`, {
        userId,
        branchId,
        expectedOwnerId: customer.assigned_agent_id,
        reason
      });
      onTransferred();
    } catch (err) {
      showToast(err.response?.data?.message || "Transfer failed.", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wa-modal-backdrop" onClick={onClose}>
      <div className="wa-modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <h3 className="font-bold text-base text-slate-900">Transfer {customer?.name}</h3>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          All linked customer records (conversations, leads, deals, tasks) will transfer together to the new employee.
        </p>

        <div className="space-y-3">
          <div>
            <label className="emp-label">Destination Employee & Branch</label>
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="emp-field w-full"
            >
              <option value="">Select Employee...</option>
              {employees.map(row => (
                <option key={`${row.user_id}:${row.branch_id}`} value={`${row.user_id}:${row.branch_id}`}>
                  {row.first_name} · {row.branch_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="emp-label">Transfer Reason</label>
            <textarea
              required
              rows="3"
              placeholder="e.g. Account re-allocation or territory coverage"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="emp-field w-full"
            />
          </div>
        </div>

        <div className="wa-modal-actions mt-4">
          <button type="button" className="wa-btn wa-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className="wa-btn wa-btn-danger"
            disabled={busy || !target || !reason.trim()}
            onClick={handleTransfer}
          >
            {busy ? "Transferring..." : "Confirm Full Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PREFERENCES MODAL ────────────────────────────────────────────────────────
function PreferencesModal({ preferences, onClose, onSave }) {
  const [defaultView, setDefaultView] = useState(preferences.defaultView || "overview");
  const [density, setDensity] = useState(preferences.density || "comfortable");

  return (
    <div className="wa-modal-backdrop" onClick={onClose}>
      <div className="wa-modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <h3 className="font-bold text-base text-slate-900">Workspace Preferences</h3>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="space-y-4 my-4">
          <div>
            <label className="emp-label">Default Landing View</label>
            <select
              value={defaultView}
              onChange={e => setDefaultView(e.target.value)}
              className="emp-field w-full"
            >
              <option value="overview">Overview Dashboard</option>
              <option value="my_day">My Day Work Center</option>
              <option value="tasks">Tasks & Follow-ups</option>
              <option value="customers">Customers Directory</option>
              <option value="deals">Deals Pipeline</option>
            </select>
          </div>
          <div>
            <label className="emp-label">Information Density</label>
            <select
              value={density}
              onChange={e => setDensity(e.target.value)}
              className="emp-field w-full"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact (Enterprise)</option>
            </select>
          </div>
        </div>
        <div className="wa-modal-actions">
          <button type="button" className="wa-btn wa-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="wa-btn wa-btn-primary"
            onClick={() => onSave({ ...preferences, defaultView, density })}
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
