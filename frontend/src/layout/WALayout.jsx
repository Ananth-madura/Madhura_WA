import { useEffect, useState, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { describeDemoReason } from "../auth/demoSession";
import { API } from "../config/api";
import socket from "../socket/socket";
import WAConfigPrompt from "../components/WAConfigPrompt";
import WAAccountBalanceModal from "../components/WAAccountBalanceModal";

// Corporate Shell for Whatsapp_CRM — Hallmark Workbench shell (design.md).
// Deep-navy slab, yellow hairline, quiet type. Routes and logic untouched.
export default function WALayout() {
  const { user, logout, demoMode } = useAuth();
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

  const isChatView = location.pathname === "/whatsapp" || location.pathname === "/whatsapp/";

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
      let res;
      try {
        res = await axios.get(`${API}/api/whatsapp/unified-status`, { headers, timeout: 6000 });
      } catch (e1) {
        res = await axios.get(`/api/whatsapp/unified-status`, { headers, timeout: 6000 });
      }
      if (res && res.data) {
        setStatus(res.data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
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
  }, [fetchStatus]);

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
          localStorage.removeItem(key);
        });
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("wa_chat_messages_")) localStorage.removeItem(k);
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
      {demoMode && (
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
            <span className="hidden md:inline">API: https://madhura-wa-backend.onrender.com</span>
          </div>
        </div>
      )}

      <header
        className="hl-shell hl-safe-top flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 shrink-0"
        style={{ minHeight: 56 }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="hl-wordmark" title="Madhura WhatsApp CRM">
            <span className="hl-wordmark-mark" aria-hidden="true"></span>
            <span className="truncate">
              Madhura&nbsp;<em>WhatsApp CRM</em>
            </span>
          </span>
          {user && (
            <span className="hl-shell-meta hidden lg:inline-flex truncate">
              {user.name || user.email} · {user.role}
            </span>
          )}
        </div>

        {/* Global Action Controls: Dashboard, Status, Quota, Sync, Config, Disconnect, Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => window.location.assign("https://crm.madhuratech.com")}
            className="hl-shell-link shrink-0"
            style={{ height: 38, padding: "0 0.75rem", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Return to CRM Dashboard"
          >
            <ChevronLeft size={14} />
            <span className="hidden xl:inline whitespace-nowrap">CRM Dashboard</span>
          </button>

          {/* Status Badge */}
          {status?.cloud?.configured || status?.isCloud ? (
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
          )}

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

      <main
        className={
          isChatView
            ? "flex-1 min-h-0 w-full min-w-0 p-1.5 sm:p-2.5 overflow-hidden flex flex-col"
            : "flex-1 min-h-0 w-full min-w-0 p-3 sm:p-4 lg:p-5 overflow-y-auto overflow-x-hidden wa-scroll"
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
