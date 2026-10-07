import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Loader2, LogOut, XCircle, CheckCircle2, X, ChevronLeft, FlaskConical } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { describeDemoReason } from "../auth/demoSession";
import { API } from "../config/api";
import socket from "../socket/socket";

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
      {/*
        Offline demo session.
        An offline demo session has no token, so every API call below this point
        will fail. Without this banner the screen simply looks broken — empty
        tables, spinners that never resolve — which reads as a bug rather than as
        "there is no backend". Stated once, here, where it cannot be missed.
      */}
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
            <span className="hl-shell-meta hidden md:inline-flex truncate">
              {user.name || user.email} · {user.role}
            </span>
          )}
        </div>
        {/* Fixed 140x40 so it reads as a real action button and stays on the
            same row as Logout at every viewport. */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Back to the main CRM app. Lives in the shell, not the WhatsApp tab
              strip, so it stays reachable on every page without scrolling the
              tab row — the tab row is a horizontal scroller on narrow screens
              and this button used to scroll off with it. Icon-only below lg so
              it never squeezes the wordmark on a phone. */}
          <button
            onClick={() => window.location.assign("https://crm.madhuratech.com")}
            className="hl-shell-link shrink-0"
            style={{ height: 40, padding: "0 0.75rem", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Return to CRM Dashboard"
          >
            <ChevronLeft size={14} />
            <span className="hidden lg:inline whitespace-nowrap">CRM Dashboard</span>
          </button>
          <button
            onClick={onDisconnectWhatsApp}
            disabled={disconnecting}
            className="hl-btn-danger-ghost hl-shell-disconnect"
            style={{ width: 140, height: 40, padding: "0 0.75rem", fontSize: 12 }}
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
          <button onClick={onLogout} className="hl-logout shrink-0" title="Sign out of CRM">
            Logout
          </button>
        </div>
      </header>

      {/*
        Fixed rather than in-flow: the chat view is height-constrained, so an
        inserted strip would reflow the message pane. Auto-dismisses in 6s.
      */}
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

      {/*
        Chat view: main is a fixed-height flex column and every pane owns
        its own scroll axis (the page never scrolls).
        All other views: main is the single document scroller.
      */}
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
