import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Zap, Shield, Sparkles, Check, CheckCircle2, KeyRound } from "lucide-react";
import { useAuth } from "./AuthContext";
import { API } from "../config/api";
import { startDirectDemoSession } from "./demoSession";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setError("Please enter your email or employee ID");
    if (!password) return setError("Please enter your password");

    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await axios.post(`${API}/api/auth/login`, { email: cleanEmail, password }, { timeout: 15000 });

      const data = res.data;
      if (data?.requires2FA) {
        setError("This account has 2FA enabled — approve via email code or disable 2FA.");
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
        setError("The backend service is initializing. Please try again or use 1-Click Demo Login.");
      } else {
        setError(err.response?.data?.message || err.response?.data?.error || "Login failed. Check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError("");
    setNotice("Connecting to developer demo environment…");

    try {
      const session = await startDirectDemoSession(API);
      login(session);
      navigate("/whatsapp", { replace: true });
    } catch (err) {
      setError("Could not launch demo session. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  };

  const autofillPreset = (presetEmail, presetPass) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setError("");
  };

  return (
    <div className="lp-auth">
      <div className="lp-auth-panel" style={{ maxWidth: 440 }}>
        <Link to="/" className="lp-auth-back">
          <ArrowLeft size={15} />
          Back to home
        </Link>

        <div className="hl-wordmark" style={{ color: "var(--color-ink)", marginBottom: 8 }}>
          <span className="hl-wordmark-mark" aria-hidden="true"></span>
          Madhura&nbsp;<em>WhatsApp CRM</em>
        </div>

        <h1 className="hl-title" style={{ marginBottom: 4, fontSize: 24 }}>Sign in</h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 20 }}>
          Multi-tenant WhatsApp messaging platform &amp; automation workspace
        </p>

        {/* 1-Click Demo Direct Dev Access Card */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderRadius: "var(--radius-md, 8px)",
            padding: "14px 16px",
            marginBottom: 20,
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 text-sm">
              <Zap size={16} className="text-emerald-600 fill-emerald-600" />
              <span>Dev &amp; Test Direct Access</span>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "2px 6px",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#065f46",
                borderRadius: 4,
              }}
            >
              1-Click Instant
            </span>
          </div>

          <p style={{ fontSize: 12, color: "var(--color-ink-2)", lineHeight: 1.45, marginBottom: 12 }}>
            Instant direct access to evaluate all dashboard features, flows, campaigns &amp; multi-tenant plan management.
          </p>

          <button
            type="button"
            disabled={demoLoading || loading}
            onClick={handleDemoLogin}
            className="hl-btn-primary"
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
              borderColor: "#047857",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              padding: "9px 14px",
            }}
          >
            {demoLoading ? (
              <span>Launching Demo Session…</span>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Launch 1-Click Demo Dashboard</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 my-4" style={{ color: "var(--color-ink-3)", fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-line)" }}></div>
          <span>or sign in with credentials</span>
          <div style={{ flex: 1, height: 1, background: "var(--color-line)" }}></div>
        </div>

        {error && (
          <div role="alert" className="lp-auth-error" style={{ marginBottom: 16 }}>{error}</div>
        )}
        {notice && (
          <div role="status" className="lp-auth-note" style={{ marginBottom: 16 }}>{notice}</div>
        )}

        <form onSubmit={submit} noValidate>
          <label htmlFor="hl-email" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
            Work Email, Employee ID, or Access Code
          </label>
          <input
            id="hl-email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="hl-input"
            style={{ width: "100%", marginBottom: 14 }}
            placeholder="admin@madhuratech.com"
          />

          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="hl-password" className="hl-section-label" style={{ display: "block" }}>
              Password
            </label>
          </div>
          <input
            id="hl-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="hl-input"
            style={{ width: "100%", marginBottom: 18 }}
            placeholder="••••••••••••"
          />

          <button
            type="submit"
            disabled={loading || demoLoading}
            className="hl-btn-primary"
            style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
          >
            {loading ? "Signing in…" : "Sign in to Dashboard"}
          </button>

          {/* Employee Access Code First-Time Activation Banner */}
          <div
            className="mt-3 p-2.5 rounded-lg flex items-center justify-between gap-2"
            style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              fontSize: 12,
            }}
          >
            <div className="flex items-center gap-1.5 text-emerald-900 min-w-0">
              <KeyRound size={14} className="text-emerald-700 shrink-0" />
              <span className="truncate">First-time login with admin Access Code?</span>
            </div>
            <Link
              to="/signup?tab=access_code"
              className="font-bold text-emerald-700 hover:underline shrink-0"
              style={{ fontSize: 11 }}
            >
              Activate Code →
            </Link>
          </div>
        </form>

        {/* Quick autofill chips for dev test */}
        <div className="mt-3 pt-3" style={{ borderTop: "1px dashed var(--color-line)" }}>
          <p style={{ fontSize: 11, color: "var(--color-ink-3)", marginBottom: 6 }}>
            Quick fill dev credentials:
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => autofillPreset("admin@madhuratech.com", "admin123")}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 4,
                border: "1px solid var(--color-line)",
                background: "var(--color-paper-2, #f8fafc)",
                color: "var(--color-ink-2)",
                cursor: "pointer",
              }}
            >
              admin@madhuratech.com
            </button>
            <button
              type="button"
              onClick={() => autofillPreset("demo@madhuratech.com", "demo123")}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 4,
                border: "1px solid var(--color-line)",
                background: "var(--color-paper-2, #f8fafc)",
                color: "var(--color-ink-2)",
                cursor: "pointer",
              }}
            >
              demo@madhuratech.com
            </button>
          </div>
        </div>

        <div style={{ marginTop: 22, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 8 }}>
            Need a new workspace?{" "}
            <Link to="/signup" style={{ color: "var(--color-primary)", fontWeight: 700 }}>
              Self-Signup with Plan →
            </Link>
          </p>
        </div>

        <div
          className="flex items-center justify-center gap-1.5"
          style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 18 }}
        >
          <Shield size={12} />
          <span>Multi-Tenant Isolation · End-to-End Encrypted Session</span>
        </div>
      </div>
    </div>
  );
}
