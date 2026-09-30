import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { API } from "../config/api";

// Slim login for Whatsapp_CRM — email + password only (no OTP/2FA UI).
// Contract: POST {API}/api/auth/login {email, password} ->
//   {token, user:{id,name,email,role}}  OR  {requires2FA:true,...}
const DEMO_ADMIN = { email: "admin@madhuratech.com", password: "admin@123" };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!email.trim()) return setError("Please enter email");
    if (!password) return setError("Please enter password");
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/api/auth/login`, {
        email: email.trim().toLowerCase(),
        password,
      });
      if (data?.requires2FA) {
        setError("This account has 2FA enabled — approve via the CRM login, or disable 2FA for API use.");
        return;
      }
      if (!data?.token) {
        setError("Login failed — no token returned");
        return;
      }
      login({ ...data.user, token: data.token });
      navigate("/whatsapp", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/api/auth/login`, {
        email: DEMO_ADMIN.email,
        password: DEMO_ADMIN.password,
      });
      if (data?.requires2FA) {
        setError("This account has 2FA enabled — approve via the CRM login.");
        return;
      }
      if (!data?.token) {
        setError("Demo login failed — no token returned");
        return;
      }
      login({ ...data.user, token: data.token });
      navigate("/whatsapp", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hl-reveal" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(60% 45% at 50% 12%, rgba(252, 189, 22, 0.10), transparent 70%), var(--color-shell)", padding: 16 }}>
      <form onSubmit={submit} className="hl-card" style={{ width: "100%", maxWidth: 400, padding: "36px 32px" }}>
        <div className="hl-wordmark" style={{ color: "var(--color-ink)", marginBottom: 6 }}>
          <span className="hl-wordmark-mark" aria-hidden="true"></span>
          Madhura&nbsp;<em>WhatsApp CRM</em>
        </div>
        <h1 className="hl-title" style={{ marginBottom: 4 }}>Sign in</h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 24 }}>Your WhatsApp corporate workspace</p>

        {error && (
          <div role="alert" style={{ background: "#FEE4E2", color: "#D92D20", fontSize: 13, borderRadius: 8, padding: "10px 14px", marginBottom: 16, border: "1px solid #FECDCA" }}>{error}</div>
        )}

        <label htmlFor="hl-email" style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)", display: "block", marginBottom: 6 }}>Email Address</label>
        <input
          id="hl-email"
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
          className="hl-input"
          style={{ width: "100%", marginBottom: 16 }}
          placeholder="name@company.com"
        />

        <label htmlFor="hl-password" style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)", display: "block", marginBottom: 6 }}>Password</label>
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

        <button
          type="button" disabled={loading}
          onClick={demoLogin}
          className="hl-btn-secondary"
          style={{ width: "100%", marginTop: 10 }}
        >
          Demo Login (Admin)
        </button>

        <p style={{ fontSize: 12, color: "var(--color-ink-2)", marginTop: 20, textAlign: "center" }}>
          Protected by enterprise-grade security &amp; encryption
        </p>
      </form>
    </div>
  );
}
