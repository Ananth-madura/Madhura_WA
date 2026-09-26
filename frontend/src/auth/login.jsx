import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { API } from "../config/api";

// Slim login for Whatsapp_CRM — email + password only (no OTP/2FA UI).
// Contract: POST {API}/api/auth/login {email, password} ->
//   {token, user:{id,name,email,role}}  OR  {requires2FA:true,...}
const DEMO_ADMIN = { email: "kk@achmecommunication.com", password: "Test@12345" };

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b141a", padding: 16 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, background: "#111b21", borderRadius: 12, padding: 28, color: "#e9edef" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Whatsapp_CRM</h1>
        <p style={{ fontSize: 13, color: "#8696a0", marginBottom: 20 }}>Sign in with your CRM account</p>
        {error && (
          <div style={{ background: "#3b1414", color: "#f5a3a3", fontSize: 13, borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</div>
        )}
        <label style={{ fontSize: 12, color: "#8696a0" }}>Email</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
          style={{ width: "100%", margin: "4px 0 12px", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a3942", background: "#202c33", color: "#e9edef" }}
        />
        <label style={{ fontSize: 12, color: "#8696a0" }}>Password</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          style={{ width: "100%", margin: "4px 0 16px", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a3942", background: "#202c33", color: "#e9edef" }}
        />
        <button
          type="submit" disabled={loading}
          style={{ width: "100%", padding: 11, borderRadius: 8, border: 0, background: "#00a884", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <button
          type="button" disabled={loading}
          onClick={demoLogin}
          style={{ width: "100%", padding: 11, borderRadius: 8, border: "1px solid #53bdeb", background: "transparent", color: "#53bdeb", fontWeight: 700, cursor: "pointer", marginTop: 8 }}
        >
          🔑 Demo Login (Admin)
        </button>
        <p style={{ fontSize: 12, color: "#8696a0", marginTop: 14 }}>
          No account? <Link to="/register" style={{ color: "#53bdeb" }}>Register</Link>
        </p>
      </form>
    </div>
  );
}
