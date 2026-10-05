import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Loader2, LogOut, XCircle, CheckCircle2, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config/api";

// Corporate Shell for Whatsapp_CRM — Hallmark Workbench shell (design.md).
// Deep-navy slab, yellow hairline, quiet type. Routes and logic untouched.
export default function WALayout() {
  const { user, logout } = useAuth();
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
      "Disconnect WhatsApp?\n\nThis logs out the linked WhatsApp account and deletes its saved session on this server. You will need to scan a new QR code to reconnect."
    );
    if (!confirmed) return;

    setDisconnecting(true);
    setNotice(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/api/whatsapp/logout`, { purge: true }, { headers });

      try {
        ["wa_cached_status", "wa_cached_chats", "wa_active_chat"].forEach((key) => {
          sessionStorage.removeItem(key);
          localStorage.removeItem(key);
        });
      } catch (_) {}

      setNotice({
        type: "success",
        text: "WhatsApp session disconnected. Scan a new QR code to reconnect.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: `Failed to disconnect: ${err.response?.data?.error || err.response?.data?.message || err.message || "unknown error"}`,
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div
      className={
        isChatView
          ? "crm-layout-shell wa-chat-mode wa-dvh flex flex-col overflow-hidden"
          : "crm-layout-shell wa-min-dvh flex flex-col"
      }
    >
      <header
        className="hl-shell hl-safe-top flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 shrink-0"
        style={{ minHeight: 56 }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="hl-wordmark">
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
