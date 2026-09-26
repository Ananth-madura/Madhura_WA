import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Corporate Shell for Whatsapp_CRM: Yellow × Navy SaaS Theme
export default function WALayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="crm-layout-shell">
      <header className="crm-header flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FCBD16] shadow-sm"></div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
            Madhura <span className="text-[#FCBD16]">WhatsApp CRM</span>
          </span>
          {user && (
            <span className="hidden sm:inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 font-medium">
              {user.name || user.email} <span className="mx-1 text-[#FCBD16]">·</span> {user.role}
            </span>
          )}
        </div>
        <button onClick={onLogout} className="crm-logout-btn" title="Sign out of CRM">
          Logout
        </button>
      </header>
      <main className="p-3 sm:p-5">
        <Outlet />
      </main>
    </div>
  );
}
