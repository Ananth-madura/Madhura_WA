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
    <div className={`crm-layout-shell ${isChatView ? "h-screen max-h-screen flex flex-col overflow-hidden wa-chat-mode" : "min-h-screen"}`}>
      <header className="hl-shell flex items-center justify-between px-4 sm:px-6 shrink-0" style={{ height: 56, minHeight: 56 }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="hl-wordmark">
            <span className="hl-wordmark-mark" aria-hidden="true"></span>
            Madhura&nbsp;<em>WhatsApp CRM</em>
          </span>
          {user && (
            <span className="hl-shell-meta hidden sm:inline-flex truncate">
              {user.name || user.email} · {user.role}
            </span>
          )}
        </div>
        <button onClick={onLogout} className="hl-logout" title="Sign out of CRM">
          Logout
        </button>
      </header>
      <main className={`flex-1 min-h-0 ${isChatView ? "p-1.5 sm:p-2.5 overflow-hidden flex flex-col" : "p-3 sm:p-5 overflow-y-auto"}`}>
        <Outlet />
      </main>
    </div>
  );
}
