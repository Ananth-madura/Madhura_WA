import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Minimal shell for Whatsapp_CRM: top bar + outlet. Route guards live in App.js.
// (Replaces the CRM DashboardLayout, which is not part of this project.)
export default function WALayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b141a" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#111b21", color: "#e9edef", borderBottom: "1px solid #222d34" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Whatsapp_CRM</span>
          {user && <span style={{ fontSize: 12, color: "#8696a0" }}>{user.name || user.email} · {user.role}</span>}
        </div>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid #2a3942", color: "#e9edef", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
          Logout
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
