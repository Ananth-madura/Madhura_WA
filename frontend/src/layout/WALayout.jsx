import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Corporate Shell for Whatsapp_CRM — Hallmark Workbench shell (design.md).
// Deep-navy slab, yellow hairline, quiet type. Routes and logic untouched.
export default function WALayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
        <button onClick={onLogout} className="hl-logout shrink-0" title="Sign out of CRM">
          Logout
        </button>
      </header>

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
