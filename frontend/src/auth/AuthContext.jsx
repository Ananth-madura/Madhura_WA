import { createContext, useContext, useState } from "react";

// Minimal auth shell for Whatsapp_CRM (duplicated from the CRM's AuthContext
// so WA pages keep working standalone — see README divergence note).
// Session shape is identical: localStorage "user" + "token".
const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch (_) { return null; }
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    if (userData.token) localStorage.setItem("token", userData.token);
  };

  const logout = () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }).catch(() => {});
      }
    } catch (_) {}

    try {
      if (window.__crmSocket && typeof window.__crmSocket.disconnect === "function") {
        window.__crmSocket.disconnect();
      }
    } catch (_) {}

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }

    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
