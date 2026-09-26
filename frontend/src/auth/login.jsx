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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 20%, rgba(252, 189, 22, 0.08), transparent 45%), #202C52", padding: 16 }}>
      <form onSubmit={submit} className="card shadow-lg animate-reveal" style={{ width: "100%", maxWidth: 400, background: "#FFFFFF", borderRadius: 14, padding: "36px 32px", border: "1px solid #E8E8E8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FCBD16" }}></div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FCBD16" }}>MADHURA CRM</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#202C52", marginBottom: 4 }}>Achme Communication</h1>
        <p style={{ fontSize: 13, color: "#667085", marginBottom: 24 }}>Sign in to your WhatsApp Corporate CRM workspace</p>

        {error && (
          <div style={{ background: "#FEE4E2", color: "#D92D20", fontSize: 13, borderRadius: 8, padding: "10px 14px", marginBottom: 16, border: "1px solid #FECDCA" }}>{error}</div>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: "#202C52", display: "block", marginBottom: 6 }}>Email Address</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
          className="input"
          style={{ width: "100%", marginBottom: 16 }}
          placeholder="name@company.com"
        />

        <label style={{ fontSize: 12, fontWeight: 600, color: "#202C52", display: "block", marginBottom: 6 }}>Password</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          className="input"
          style={{ width: "100%", marginBottom: 22 }}
          placeholder="••••••••"
        />

        <button
          type="submit" disabled={loading}
          className="btn-primary"
          style={{ width: "100%", minHeight: 44, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Signing in…" : "Sign in to Dashboard"}
        </button>

        <button
          type="button" disabled={loading}
          onClick={demoLogin}
          className="btn-outline"
          style={{ width: "100%", minHeight: 42, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 10, border: "1px solid #202C52", color: "#202C52" }}
        >
          🔑 Demo Login (Admin)
        </button>

        <p style={{ fontSize: 12, color: "#98A2B3", marginTop: 20, textAlign: "center" }}>
          Protected by enterprise-grade security & encryption
        </p>
      </form>
    </div>
  );
}
