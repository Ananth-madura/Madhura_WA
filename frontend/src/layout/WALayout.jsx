import { waUiStorage } from "../utils/waUiStorage";
import { useEffect, useState, useCallback, useRef } from "react";
import { Outlet, useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import axios from "axios";
import {
  Loader2,
  LogOut,
  XCircle,
  CheckCircle2,
  X,
  ChevronLeft,
  CreditCard,
  RefreshCw,
  Settings,
  Users,
  GitBranch,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useEnterprise } from "../context/EnterpriseContext";
import useWALocalInbox from "../hooks/useWALocalInbox";
import useWorkspaceAccess from "../hooks/useWorkspaceAccess";
import { canOpenWorkspacePath, workspaceModuleForPath } from "../auth/workspaceAccess";
import { describeDemoReason } from "../auth/demoSession";
import { API } from "../config/api";
import { MARKETING } from "../config/index";
import socket from "../socket/socket";
import WAConfigPrompt from "../components/WAConfigPrompt";
import WAAccountBalanceModal from "../components/WAAccountBalanceModal";
import WhatsAppNav from "../components/WhatsAppNav";
import OrganizationSwitcher from "../components/OrganizationSwitcher";
import BranchSwitcher from "../components/BranchSwitcher";
import "../pages/whatsapp-workspace.css";
import "../pages/whatsapp-operations.css";
import "../pages/whatsapp-employee.css";

// One dashboard for every role. What differs is the rail and the routes a
// person may open — resolved from their organization role plus per-module
// grants the administrator sets. Route and logic stay in one place.
export default function WALayout() {
  const { loading } = useEnterprise();
  if (loading) return <p className="p-4">Loading workspace…</p>;
  return <WorkspaceShell />;
}

function WorkspaceShell() {
  const { user, logout, demoMode } = useAuth();
  const { activeTenant, activeBranch, roleInActiveOrg, actorRole } = useEnterprise();
  const { admin, canView, ready } = useWorkspaceAccess();
  const member = !admin;
  const subadmin = actorRole === "subadmin" || user?.role === "subadmin";
  const roleLabel = subadmin
    ? "Sub-admin"
    : ({
      organization_owner: "Owner",
      organization_admin: "Administrator",
      branch_manager: "Branch manager",
      agent: "Agent",
      employee: "Employee",
    }[roleInActiveOrg] || "Member");
  const orgLine = [activeTenant?.name, activeBranch?.name].filter(Boolean).join(" · ");
  const navigate = useNavigate();
  const location = useLocation();

  /* WhatsApp session teardown lives in the shell (not the chat page) so the
     control is reachable from every /whatsapp/* screen — including the
     disconnected one, where a wedged session previously left no way out. */
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "success" | "error", text }
  const [status, setStatus] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [balanceData, setBalanceData] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // The demo-mode banner is informational — let the operator dismiss it for
  // the rest of the session instead of pinning it above every page.
  const [demoBannerClosed, setDemoBannerClosed] = useState(false);

  // ── Auto-hiding top bar ───────────────────────────────────────────────────
  // The shell header retracts a moment after the pointer stops using it (the
  // page content fills the space) and slides back down as soon as the cursor
  // returns to the top edge or a control inside it receives focus. Pointer-less
  // devices (touch / no-hover) keep it pinned, and Escape brings it back too.
  const topbarRef = useRef(null);
  const topbarHideTimer = useRef(null);
  const topbarHiddenRef = useRef(false);
  const [topbarHidden, setTopbarHidden] = useState(false);
  const [topbarHeight, setTopbarHeight] = useState(56);
  const [autoHideTopbar, setAutoHideTopbar] = useState(false);

  useEffect(() => {
    setAutoHideTopbar(
      typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches
    );
  }, []);

  // Measure the bar while it is expanded — the collapse animates from the real
  // height, which grows when the right-hand controls wrap on narrow windows.
  // scrollHeight is used so a stale inline height can never feed itself back in.
  useEffect(() => {
    if (!autoHideTopbar) return undefined;
    const measure = () => {
      const el = topbarRef.current;
      if (!el) return;
      const h = Math.round(el.scrollHeight);
      if (h > 0) setTopbarHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [autoHideTopbar, topbarHidden]);

  useEffect(() => {
    if (!autoHideTopbar) return undefined;

    const REVEAL_ZONE = 16; // px from the top edge that brings the bar back
    const HIDE_AFTER = 1500; // ms of the pointer not using the bar

    const hideTopbar = () => {
      if (topbarHiddenRef.current) return;
      topbarHiddenRef.current = true;
      setTopbarHidden(true);
    };
    const showTopbar = () => {
      if (topbarHideTimer.current) {
        clearTimeout(topbarHideTimer.current);
        topbarHideTimer.current = null;
      }
      if (topbarHiddenRef.current) {
        topbarHiddenRef.current = false;
        setTopbarHidden(false);
      }
    };
    const scheduleHide = () => {
      if (topbarHiddenRef.current || topbarHideTimer.current) return;
      topbarHideTimer.current = setTimeout(() => {
        topbarHideTimer.current = null;
        hideTopbar();
      }, HIDE_AFTER);
    };

    const onPointerMove = (e) => {
      const overBar = !!topbarRef.current?.contains(e.target);
      if (overBar || e.clientY <= REVEAL_ZONE) showTopbar();
      else scheduleHide();
    };
    const onFocusIn = (e) => {
      if (topbarRef.current?.contains(e.target)) showTopbar();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") showTopbar();
    };

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (topbarHideTimer.current) {
        clearTimeout(topbarHideTimer.current);
        topbarHideTimer.current = null;
      }
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [autoHideTopbar]);

  // The Live Chats board is a full-height, internally-scrolling view for every
  // role. Members now use the same page (scoped to their assigned chats), so it
  // must get the chat layout rather than the padded page wrapper.
  const isChatView = location.pathname === "/whatsapp" || location.pathname === "/whatsapp/";
  const requiredModule = workspaceModuleForPath(location.pathname);
  const canOpen = canOpenWorkspacePath(location.pathname, admin) && (!requiredModule || canView(requiredModule));
  const localCacheWarning = useWALocalInbox();

  useEffect(() => {
    if (isChatView) {
      document.documentElement.classList.add("wa-chat-active");
      document.body.classList.add("wa-chat-active");
    } else {
      document.documentElement.classList.remove("wa-chat-active");
      document.body.classList.remove("wa-chat-active");
    }
    return () => {
      document.documentElement.classList.remove("wa-chat-active");
      document.body.classList.remove("wa-chat-active");
    };
  }, [isChatView]);

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/api/whatsapp/unified-status`, { headers, timeout: 6000 });
      if (res && res.data) {
        setStatus(res.data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Only administrators can read WhatsApp session state; asking as a member
    // would 403 on every tick and paint a false "Offline" badge.
    if (member) return undefined;
    fetchStatus();
    const interval = setInterval(()=>{if(!document.hidden)fetchStatus();},120000+Math.floor(Math.random()*15000));
    const handleRealtime = () => fetchStatus();
    socket.on("wa_ready", handleRealtime);
    socket.on("wa_disconnected", handleRealtime);
    socket.on("wa_authenticated", handleRealtime);
    window.addEventListener("wa_session_disconnected", handleRealtime);
    window.addEventListener("wa_sync_completed", handleRealtime);

    return () => {
      clearInterval(interval);
      socket.off("wa_ready", handleRealtime);
      socket.off("wa_disconnected", handleRealtime);
      socket.off("wa_authenticated", handleRealtime);
      window.removeEventListener("wa_session_disconnected", handleRealtime);
      window.removeEventListener("wa_sync_completed", handleRealtime);
    };
  }, [fetchStatus, member]);

  const onSyncWhatsApp = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/api/whatsapp/sync-contacts`, {}, { headers }).catch(() => {});
      await axios.post(`${API}/api/whatsapp/sync-chats`, {}, { headers }).catch(() => {});
      window.dispatchEvent(new CustomEvent("wa_sync_completed", { detail: { ts: Date.now() } }));
      setNotice({ type: "success", text: "Synced WhatsApp contacts & chat history." });
    } catch (err) {
      setNotice({ type: "error", text: `Sync failed: ${err?.response?.data?.error || err.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const fetchAccountBalance = async () => {
    setShowBalance(true);
    setBalanceLoading(true);
    setBalanceData(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API}/api/whatsapp/account-balance`, { headers, timeout: 8000 });
      setBalanceData(data);
    } catch (err) {
      setBalanceData({ error: err?.response?.data?.error || "Failed to fetch WhatsApp account stats" });
    } finally {
      setBalanceLoading(false);
    }
  };

  const onDisconnectWhatsApp = async () => {
    if (disconnecting) return;
    const confirmed = window.confirm(
      "Disconnect WhatsApp?\n\nThis logs out the linked WhatsApp account and transitions directly to the QR scan stage to reconnect."
    );
    if (!confirmed) return;

    setDisconnecting(true);
    setNotice(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        await axios.post(`${API}/api/whatsapp/logout`, { purge: true }, { headers, timeout: 8000 });
      } catch (err) {
        console.warn("Logout notice:", err?.message);
      }

      try {
        ["wa_cached_status", "wa_cached_chats", "wa_active_chat"].forEach((key) => {
          sessionStorage.removeItem(key);
          waUiStorage.removeItem(key);
        });
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith(`wa_user_${user?.id}:wa_chat_messages_`)) localStorage.removeItem(k);
        });
      } catch (_) {}

      // Dispatch custom event to transition into QR scan stage immediately
      window.dispatchEvent(new CustomEvent("wa_session_disconnected", { detail: { action: "disconnect", ts: Date.now() } }));

      try {
        if (socket?.connected) {
          socket.emit("wa_logout");
        }
      } catch (_) {}

      setNotice({
        type: "success",
        text: "WhatsApp session disconnected. Ready to scan new QR code.",
      });

      navigate("/whatsapp?mode=qr&disconnect=" + Date.now(), { replace: false });
    } catch (err) {
      setNotice({
        type: "error",
        text: `Failed to disconnect: ${err.response?.data?.error || err.response?.data?.message || err.message || "unknown error"}`,
      });
      window.dispatchEvent(new CustomEvent("wa_session_disconnected", { detail: { action: "disconnect", ts: Date.now() } }));
      navigate("/whatsapp?mode=qr&disconnect=" + Date.now(), { replace: false });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div
      className={
        isChatView
          ? "crm-layout-shell wa-chat-mode wa-dvh flex flex-col overflow-hidden"
          : "crm-layout-shell wa-page-mode wa-dvh flex flex-col overflow-hidden"
      }
    >
      {localCacheWarning && <div role="alert" className="px-4 py-2 text-sm bg-[var(--color-paper)] text-[var(--color-ink)]">{localCacheWarning}</div>}
      {demoMode && (user?.isStrictDemo || !demoBannerClosed) && (
        <div
          role="status"
          className="shrink-0 flex items-center justify-between gap-3 px-3 sm:px-6 py-2"
          style={{
            background: "linear-gradient(90deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))",
            borderBottom: "1px solid rgba(16, 185, 129, 0.25)",
            color: "var(--color-ink)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="truncate">
              <strong style={{ fontWeight: 700 }} className="text-emerald-700">Interactive Demo Mode:</strong>{" "}
              {describeDemoReason(user)}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-[var(--color-ink-2)]">
            <button type="button" className="hl-btn-secondary" onClick={()=>{logout();window.location.assign("/signup");}}>Create real workspace</button>
            <button type="button" className="hl-btn-secondary" onClick={onLogout}>Sign in</button>
            {!user?.isStrictDemo && <button
              type="button"
              onClick={() => setDemoBannerClosed(true)}
              aria-label="Dismiss demo mode notice"
              title="Close"
              className="ml-1 p-1 rounded-lg shrink-0 transition hover:bg-black/5 hover:text-[var(--color-ink)] focus-visible:outline-2"
            >
              <X size={14} />
            </button>}
          </div>
        </div>
      )}

      <header
        ref={topbarRef}
        className="hl-shell hl-safe-top flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 shrink-0"
        style={{
          minHeight: topbarHidden ? 0 : 56,
          height: topbarHidden ? 0 : topbarHeight,
          overflow: topbarHidden ? "hidden" : "visible",
          opacity: topbarHidden ? 0 : 1,
          pointerEvents: topbarHidden ? "none" : "auto",
          transition:
            "height .3s cubic-bezier(.4, 0, .2, 1), min-height .3s cubic-bezier(.4, 0, .2, 1), opacity .18s ease",
        }}
        aria-hidden={topbarHidden || undefined}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link to="/whatsapp" className="flex items-center gap-2 shrink-0 py-0.5" title="Madhura WhatsApp CRM">
            <img src="/Group.png" alt="Madhura WhatsApp CRM" className="h-7 w-auto object-contain" />
          </Link>
          {member ? (
            <>
              <span className="emp-role-chip hidden md:inline-flex shrink-0">
                <span className="hl-badge hl-badge-info" style={{ height: 32 }}>
                  <ShieldCheck size={13} aria-hidden="true" /> {roleLabel}
                </span>
              </span>
              {orgLine && <span className="emp-shell-org hidden lg:block" title={orgLine}>{orgLine}</span>}
            </>
          ) : (
            <>
              <OrganizationSwitcher />
              <BranchSwitcher />
            </>
          )}
        </div>

        {/* Global Action Controls: Dashboard, Status, Quota, Sync, Config, Disconnect, Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {!member && (
            <button
              onClick={() => window.location.assign(MARKETING)}
              className="hl-shell-link shrink-0"
              style={{ height: 38, padding: "0 0.75rem", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
              title="Open Madhura website"
            >
              <ChevronLeft size={14} />
              <span className="hidden xl:inline whitespace-nowrap">Website</span>
            </button>
          )}

          {/* Status Badge — session state is an administrator signal */}
          {!member && (status?.cloud?.configured || status?.isCloud ? (
            <span className="hl-badge hl-badge-info hidden md:inline-flex" style={{ height: 32 }}>
              <span>Meta API: {status?.phone ? `+${status.phone}` : "Active"}</span>
            </span>
          ) : status?.web?.connected || status?.isWeb || status?.phone ? (
            <span className="hl-badge hl-badge-success hidden md:inline-flex" style={{ height: 32 }}>
              <span>+{status?.phone}</span>
            </span>
          ) : (
            <span className="hl-badge hidden md:inline-flex" style={{ height: 32 }}>
              <span>Offline</span>
            </span>
          ))}

          {!member && (<>
          {/* Manage Branches */}
          <button
            onClick={() => navigate("/whatsapp/branches")}
            className={`hl-btn-secondary shrink-0 ${location.pathname === "/whatsapp/branches" ? "border-emerald-600 bg-emerald-950/60 text-emerald-300 font-semibold" : ""}`}
            style={{ height: 38, padding: "0 0.65rem", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Manage Branches & Queues"
          >
            <GitBranch size={14} className="text-emerald-400" />
            <span className="hidden md:inline whitespace-nowrap">Branches</span>
          </button>

          {/* Manage Employees */}
          <button
            onClick={() => navigate("/whatsapp/employees")}
            className={`hl-btn-secondary shrink-0 ${location.pathname === "/whatsapp/employees" ? "border-emerald-600 bg-emerald-950/60 text-emerald-300 font-semibold" : ""}`}
            style={{ height: 38, padding: "0 0.65rem", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Manage Employees, Access Codes & Staff Activity Analytics"
          >
            <Users size={14} className="text-emerald-400" />
            <span className="hidden sm:inline whitespace-nowrap">Employees</span>
          </button>

          {/* Billing & Subscriptions */}
          <button
            onClick={() => navigate("/whatsapp/billing")}
            className={`hl-btn-secondary shrink-0 ${location.pathname === "/whatsapp/billing" ? "border-amber-600 bg-amber-950/60 text-amber-300 font-semibold" : ""}`}
            style={{ height: 38, padding: "0 0.65rem", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Subscription, Plans & Resource Metering"
          >
            <CreditCard size={14} className="text-amber-400" />
            <span className="hidden lg:inline whitespace-nowrap">Billing & Plans</span>
          </button>

          {/* Quota & Balance */}
          <button
            onClick={fetchAccountBalance}
            className="hl-btn-secondary shrink-0"
            style={{ height: 38, padding: "0 0.65rem", fontSize: 12 }}
            title="View WhatsApp Engine & Messaging Quota Balance"
          >
            <CreditCard size={14} />
            <span className="hidden lg:inline whitespace-nowrap">Quota & Balance</span>
          </button>

          {/* Sync All */}
          <button
            onClick={onSyncWhatsApp}
            disabled={syncing}
            className="hl-btn-secondary shrink-0"
            style={{ height: 38, padding: "0 0.65rem", fontSize: 12 }}
            title="Sync Contacts & Chat History"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : undefined} />
            <span className="hidden sm:inline whitespace-nowrap">{syncing ? "Syncing..." : "Sync All"}</span>
          </button>

          {/* API Config */}
          <button
            onClick={() => setShowConfig(true)}
            className="hl-btn-secondary shrink-0"
            style={{ height: 38, padding: "0 0.65rem", fontSize: 12 }}
            title="Configure Meta Cloud API"
          >
            <Settings size={14} />
            <span className="hidden md:inline whitespace-nowrap">API Config</span>
          </button>

          {/* Disconnect WhatsApp */}
          <button
            onClick={onDisconnectWhatsApp}
            disabled={disconnecting}
            className="hl-btn-danger-ghost hl-shell-disconnect shrink-0"
            style={{ width: 130, height: 38, padding: "0 0.75rem", fontSize: 12 }}
            title="Disconnect WhatsApp Session — logs out the linked account and deletes its saved session"
            aria-busy={disconnecting || undefined}
          >
            {disconnecting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LogOut size={14} />
            )}
            <span className="whitespace-nowrap">
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </span>
          </button>
          </>)}

          {/* Sign out */}
          <button onClick={onLogout} className="hl-logout shrink-0" style={{ height: 38 }} title="Sign out of CRM">
            Logout
          </button>
        </div>
      </header>

      {/* Notice Toast */}
      {notice && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-3 pointer-events-none">
          <div
            className={`hl-badge pointer-events-auto shadow-lg ${notice.type === "error" ? "hl-badge-error" : "hl-badge-success"}`}
            style={{ fontSize: 12, maxWidth: "92vw" }}
            role="status"
          >
            {notice.type === "error" ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
            <span className="truncate">{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
              style={{ display: "inline-flex", color: "inherit" }}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Meta API Config Modal */}
      {showConfig && (
        <WAConfigPrompt
          onClose={() => {
            setShowConfig(false);
            fetchStatus();
          }}
        />
      )}

      {/* Quota & Balance Modal */}
      {showBalance && (
        <WAAccountBalanceModal
          isOpen={showBalance}
          onClose={() => setShowBalance(false)}
          balance={balanceData}
          loading={balanceLoading}
        />
      )}

      {/* Persistent workspace sidebar — mounted once by the shell so the same
          rail is fixed on every /whatsapp route instead of being re-created,
          re-fetched and re-laid-out inside each page. */}
      <div className="wa-shell-body">
        <WhatsAppNav />
        <main
          data-wa-route={isChatView ? undefined : location.pathname}
          className={
            isChatView
              ? "flex-1 min-h-0 w-full min-w-0 p-1.5 sm:p-2.5 overflow-hidden flex flex-col"
              : "wa-page-workspace flex-1 min-h-0 w-full min-w-0 p-3 sm:p-4 lg:p-5 overflow-y-auto overflow-x-hidden wa-scroll"
          }
        >
          {!ready
            ? <p className="p-4">Checking workspace access…</p>
            : canOpen ? <Outlet /> : <Navigate to="/whatsapp" replace />}
        </main>
      </div>
    </div>
  );
}
