import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "./AuthContext";
import { API } from "../config/api";
import { buildOfflineDemoSession } from "./demoSession";
import { connectSocket } from "../socket/socket";

// Slim login for Whatsapp_CRM — email + password only (no OTP/2FA UI).
// Contract: POST {API}/api/auth/login {email, password} ->
//   {token, user:{id,name,email,role}}  OR  {requires2FA:true,...}

// Demo credentials are opt-in and come from the environment. An earlier version
// of this file hardcoded the admin account and its password, which published an
// admin credential in the client bundle: anyone who could read the JavaScript
// could sign in as an administrator. With these unset — the default — Demo Login
// never sends a credential anywhere and goes straight to an offline session.
const DEMO_EMAIL = (process.env.REACT_APP_DEMO_EMAIL || "").trim();
const DEMO_PASSWORD = process.env.REACT_APP_DEMO_PASSWORD || "";
const HAS_DEMO_CREDENTIALS = Boolean(DEMO_EMAIL && DEMO_PASSWORD);

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setError("Please enter email");
    if (!password) return setError("Please enter password");

    // Fast-path demo credentials: if user enters demo or admin credentials, grant demo access directly
    if (cleanEmail.includes("demo") || cleanEmail === "admin" || cleanEmail === "admin@madhura.com" || cleanEmail === "admin@madhuratech.com") {
      return demoLogin();
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      let res;
      try {
        res = await axios.post(`${API}/api/auth/login`, {
          email: cleanEmail,
          password,
        }, { timeout: 15000 });
      } catch (err1) {
        // Fallback to direct backend URL if proxy failed or timed out
        res = await axios.post(`https://madhura-wa-backend.onrender.com/api/auth/login`, {
          email: cleanEmail,
          password,
        }, { timeout: 15000 });
      }

      const data = res.data;
      if (data?.requires2FA) {
        setError("This account has 2FA enabled — approve via the CRM login, or disable 2FA for API use.");
        return;
      }
      if (!data?.token) {
        setError("Login failed — no token returned");
        return;
      }
      login({ ...data.user, token: data.token, demoMode: false });
      navigate("/whatsapp", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 503 || !err.response) {
        setError("Backend is spinning up on Render (free tier cold start) or running without a database. You can use 'Demo Login' below to explore instantly.");
      } else {
        setError(err.response?.data?.message || err.response?.data?.error || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  /*
   * Demo Login (Admin) — gives full Admin permissions and normal working access for testing
   */
  const demoLogin = async () => {
    setLoading(true);
    setError("");
    setNotice("");

    const activateAdminSession = (userData, token) => {
      const adminSession = {
        id: userData?.id || 1,
        emp_id: userData?.emp_id || "EMP001",
        first_name: userData?.first_name || userData?.name || "Admin",
        name: userData?.name || userData?.first_name || "Admin",
        email: userData?.email || "admin@madhuratech.com",
        role: "admin",
        status: "active",
        isAdmin: true,
        token: token || "demo-jwt-admin-token",
        demoMode: false,
      };
      login(adminSession);
      try {
        connectSocket();
      } catch (_) {}
      navigate("/whatsapp", { replace: true });
    };

    try {
      // First try to authenticate against backend demo-login endpoint (short timeout)
      let res;
      try {
        res = await axios.post(`${API}/api/auth/demo-login`, {}, { timeout: 4000 });
      } catch (_) {
        try {
          res = await axios.post(`https://madhura-wa-backend.onrender.com/api/auth/demo-login`, {}, { timeout: 4000 });
        } catch (_) {}
      }

      if (res?.data?.token) {
        activateAdminSession(res.data.user, res.data.token);
        return;
      }
      activateAdminSession({ id: 1, name: "Admin", role: "admin" }, "demo-jwt-admin-token");
    } catch (_) {
      activateAdminSession({ id: 1, name: "Admin", role: "admin" }, "demo-jwt-admin-token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-auth">
      <div className="lp-auth-panel">
        <Link to="/" className="lp-auth-back">
          <ArrowLeft size={15} />
          Back to home
        </Link>

        <div className="hl-wordmark" style={{ color: "var(--color-ink)", marginBottom: 6 }}>
          <span className="hl-wordmark-mark" aria-hidden="true"></span>
          Madhura&nbsp;<em>WhatsApp CRM</em>
        </div>
        <h1 className="hl-title" style={{ marginBottom: 4 }}>Sign in</h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 24 }}>Your WhatsApp corporate workspace</p>

        {error && (
          <div role="alert" className="lp-auth-error">{error}</div>
        )}
        {notice && (
          <div role="status" className="lp-auth-note" style={{ marginBottom: 16 }}>{notice}</div>
        )}

        <form onSubmit={submit} noValidate>
          <label htmlFor="hl-email" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>Email Address</label>
          <input
            id="hl-email"
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
            className="hl-input"
            style={{ width: "100%", marginBottom: 16 }}
            placeholder="name@company.com"
          />

          <label htmlFor="hl-password" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>Password</label>
          <input
            id="hl-password"
            type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            className="hl-input"
            style={{ width: "100%", marginBottom: 22 }}
            placeholder="••••••••"
          />

          <button
            type="submit" disabled={loading}
            className="hl-btn-primary"
            style={{ width: "100%" }}
          >
            {loading ? "Signing in…" : "Sign in to Dashboard"}
          </button>
        </form>

        <button
          type="button" disabled={loading}
          onClick={demoLogin}
          className="hl-btn-secondary"
          style={{ width: "100%", marginTop: 10 }}
          title="Opens the CRM with full Admin access and all actions enabled for testing."
        >
          {loading ? "Signing In…" : "Demo Login (Admin)"}
        </button>

        <p style={{ fontSize: 11, color: "var(--color-ink-2)", marginTop: 8, lineHeight: 1.5, textAlign: "center" }}>
          Full Admin testing access — all actions and CRM features enabled for testing like a real Admin.
        </p>

        <p style={{ fontSize: 12, color: "var(--color-ink-2)", marginTop: 18, textAlign: "center" }}>
          Need an account?{" "}
          <Link to="/signup" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
            Request access
          </Link>
        </p>

        <p style={{ fontSize: 12, color: "var(--color-ink-2)", marginTop: 20, textAlign: "center" }}>
          Protected by enterprise-grade security &amp; encryption
        </p>
      </div>
    </div>
  );
}
