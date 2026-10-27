import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { hasCookieSession, refreshBrowserSession } from "./browserSession";
import { isDemoSession } from "./demoSession";
import { isDemoPreview } from "./demoApi";
import { connectSocket, disconnectSocket } from "../socket/socket";
import { clearLocalCache } from "../utils/waLocalCache";
import { API } from "../config/api";

// Minimal auth shell for Whatsapp_CRM (duplicated from the CRM's AuthContext
// so WA pages keep working standalone — see README divergence note).
// Session shape is identical: localStorage "user" + "token".
const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      const profile = saved ? JSON.parse(saved) : null;
      return profile;
    } catch (_) { return null; }
  });
  const [initializing,setInitializing]=useState(hasCookieSession);
  useEffect(()=>{
    if(!hasCookieSession())return;
    let current=true;
    const restore=async()=>{
      try {
        let response;
        try{response=await axios.get(`${API}/api/auth/session`);}catch(error){if(error.response?.status!==401)throw error;await refreshBrowserSession();response=await axios.get(`${API}/api/auth/session`);}
        if(!current)return;
        const profile={...response.data.user,cookieSession:true};
        localStorage.removeItem("token");localStorage.setItem("user",JSON.stringify(profile));setUser(profile);connectSocket();
      }catch(error){if(current&&[401,403].includes(error.response?.status||error.status)){clearLocalCache().catch(()=>{});localStorage.removeItem("token");localStorage.removeItem("user");setUser(null);disconnectSocket();}}
      finally{if(current)setInitializing(false);}
    };
    restore();return()=>{current=false;};
  },[]);
  useEffect(()=>{
    const expired=()=>{if(isDemoPreview())return;clearLocalCache().catch(()=>{});localStorage.removeItem("user");localStorage.removeItem("token");setUser(null);disconnectSocket();};
    window.addEventListener("wa_auth_expired",expired);
    return()=>window.removeEventListener("wa_auth_expired",expired);
  },[]);

  const login = (userData) => {
    clearLocalCache().catch(() => {});
    setUser(userData);
    const {token,...profile}=userData;
    if(userData.isStrictDemo)disconnectSocket();
    localStorage.setItem("user", JSON.stringify(userData.cookieSession?profile:userData));
    if (userData.token && !userData.cookieSession) {
      localStorage.setItem("token", userData.token);
      connectSocket();
    } else {
      localStorage.removeItem("token");
    }

    const tid = userData.tenant_id || userData.active_tenant_id;
    localStorage.removeItem("active_branch_id");
    if (tid) {
      localStorage.setItem("active_tenant_id", String(tid));
    } else localStorage.removeItem("active_tenant_id");
    const bid = userData.branch_id || userData.active_branch_id;
    if (bid) {
      localStorage.setItem("active_branch_id", String(bid));
    }
    if(userData.cookieSession)connectSocket();
  };

  const logout = () => {
    try {
      const token = localStorage.getItem("token");
      if (token || hasCookieSession()) {
        fetch(`${API}/api/auth/logout`, {
          method: "POST",
          credentials:"include",
          headers: { ...(token?{Authorization:`Bearer ${token}`}:{}) , "Content-Type": "application/json" },
        }).catch(() => {});
      }
    } catch (_) {}

    clearLocalCache().catch(() => {});
    disconnectSocket();

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("active_tenant_id");
      localStorage.removeItem("active_branch_id");
    }

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, initializing, demoMode: isDemoSession(user) }}
    >
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
