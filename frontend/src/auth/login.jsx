import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Zap,
  Shield,
  Sparkles,
  CheckCircle2,
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Users,
  AlertCircle,
  HelpCircle,
  GitBranch,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { API } from "../config/api";
import { startDirectDemoSession } from "./demoSession";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: "credentials" | "access_code" | "demo"
  const [activeTab, setActiveTab] = useState("credentials");

  // Credentials State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Quick Access Code State
  const [quickCode, setQuickCode] = useState("");
  const [codeChecking, setCodeChecking] = useState(false);
  const [codePreview, setCodePreview] = useState(null);

  // UI States
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Pre-fill query parameters if any (e.g. ?code=AC-X9B2-4821 or ?tab=code)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeParam = params.get("code");
    const tabParam = params.get("tab");
    if (codeParam) {
      setQuickCode(codeParam.toUpperCase());
      setActiveTab("access_code");
    } else if (tabParam === "code" || tabParam === "access_code") {
      setActiveTab("access_code");
    } else if (tabParam === "demo") {
      setActiveTab("demo");
    }
  }, [location.search]);

  // Live Access Code Preview
  useEffect(() => {
    const clean = quickCode.trim().toUpperCase();
    if (clean.length >= 6) {
      let cancelled = false;
      setCodeChecking(true);
      axios
        .post(`${API}/api/auth/verify-access-code`, { access_code: clean }, { timeout: 6000 })
        .then((res) => {
          if (!cancelled && res.data?.valid) {
            setCodePreview(res.data);
          }
        })
        .catch(() => {
          if (!cancelled) setCodePreview(null);
        })
        .finally(() => {
          if (!cancelled) setCodeChecking(false);
        });
      return () => {
        cancelled = true;
      };
    } else {
      setCodePreview(null);
    }
  }, [quickCode]);

  const submitCredentials = async (e) => {
    e?.preventDefault?.();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setError("Please enter your Work Email or Employee ID");
    if (!password) return setError("Please enter your Password");

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const res = await axios.post(
        `${API}/api/auth/login`,
        { email: cleanEmail, password },
        { timeout: 15000 }
      );

      const data = res.data;
      if (data?.requires2FA) {
        setError("This account has 2FA enabled. Enter the verification code sent to your email.");
        return;
      }
      if (!data?.token) {
        setError("Login failed — no authentication token returned from server.");
        return;
      }

      // Establish session with organization and branch context
      login({
        ...data.user,
        token: data.token,
        active_tenant_id: data.user.tenant_id,
        active_branch_id: data.user.branch_id,
        demoMode: false,
      });

      const returnUrl = new URLSearchParams(location.search).get("returnUrl") || "/whatsapp";
      navigate(returnUrl, { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 503 || !err.response) {
        setError("The enterprise backend service is unreachable. Check your internet connection or use 1-Click Demo Login.");
      } else {
        setError(err.response?.data?.message || err.response?.data?.error || "Login failed. Please verify your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchDemo = async (role = "admin") => {
    setDemoLoadingRole(role);
    setError("");
    setNotice(`Initializing enterprise sandbox environment as ${role === "admin" ? "Organization Admin" : "Branch Staff"}…`);

    try {
      const session = await startDirectDemoSession(API, role);
      login(session);
      navigate("/whatsapp", { replace: true });
    } catch (err) {
      setError("Could not launch sandbox session. Please try regular login.");
    } finally {
      setDemoLoadingRole(null);
    }
  };

  const handleQuickCodeContinue = () => {
    if (!quickCode) return setError("Please enter your Access Code.");
    navigate(`/signup?tab=access_code&code=${encodeURIComponent(quickCode.trim().toUpperCase())}`);
  };

  const autofillPreset = (presetEmail, presetPass) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setError("");
  };

  return (
    <div className="lp-auth" style={{ minHeight: "100dvh", padding: "24px 16px" }}>
      <div className="lp-auth-panel" style={{ maxWidth: 460 }}>
        <Link to="/" className="lp-auth-back">
          <ArrowLeft size={15} />
          Back to Home
        </Link>

        {/* Brand & Platform Header */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <Link to="/" className="flex items-center gap-2">
            <img src="/Group.png" alt="Madhura WhatsApp CRM" className="h-8 w-auto object-contain" />
          </Link>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "3px 8px",
              background: "rgba(16, 185, 129, 0.12)",
              color: "#047857",
              borderRadius: 6,
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <GitBranch size={10} />
            Multi-Branch v2
          </span>
        </div>

        <h1 className="hl-title" style={{ marginBottom: 4, fontSize: 24 }}>Sign in to Workspace</h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 18 }}>
          Tenant-isolated messaging platform, branch routing &amp; live team inbox
        </p>

        {/* Tab Selector */}
        <div
          style={{
            display: "flex",
            background: "var(--color-paper-2, #f1f5f9)",
            borderRadius: "var(--radius-md, 8px)",
            padding: 3,
            marginBottom: 18,
            border: "1px solid var(--color-line)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab("credentials");
              setError("");
            }}
            style={{
              flex: 1,
              padding: "7px 10px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: activeTab === "credentials" ? "var(--color-paper, #ffffff)" : "transparent",
              color: activeTab === "credentials" ? "var(--color-ink)" : "var(--color-ink-2)",
              boxShadow: activeTab === "credentials" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <Mail size={13} />
            <span>Work Account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("access_code");
              setError("");
            }}
            style={{
              flex: 1,
              padding: "7px 10px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: activeTab === "access_code" ? "var(--color-paper, #ffffff)" : "transparent",
              color: activeTab === "access_code" ? "var(--color-ink)" : "var(--color-ink-2)",
              boxShadow: activeTab === "access_code" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <KeyRound size={13} />
            <span>Access Code</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("demo");
              setError("");
            }}
            style={{
              flex: 1,
              padding: "7px 10px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: activeTab === "demo" ? "var(--color-paper, #ffffff)" : "transparent",
              color: activeTab === "demo" ? "#047857" : "var(--color-ink-2)",
              boxShadow: activeTab === "demo" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <Zap size={13} className="text-emerald-600" />
            <span>1-Click Dev</span>
          </button>
        </div>

        {error && (
          <div role="alert" className="lp-auth-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className="lp-auth-note" style={{ marginBottom: 16 }}>
            <Sparkles size={16} className="shrink-0 text-emerald-600 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        {/* TAB 1: WORKSPACE ACCOUNT LOGIN */}
        {activeTab === "credentials" && (
          <form onSubmit={submitCredentials} noValidate>
            <div className="mb-4">
              <label htmlFor="hl-email" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                Work Email or Employee ID *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail size={16} />
                </div>
                <input
                  id="hl-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="admin@madhuratech.com"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="hl-password" className="hl-section-label block font-bold text-xs text-gray-700 m-0">
                  Password *
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-emerald-700 hover:underline font-semibold focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={16} />
                </div>
                <input
                  id="hl-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="hl-input w-full pl-9 pr-10 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="••••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Remember this workstation</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="hl-btn-primary w-full py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 rounded-xl shadow-sm transition hover:shadow cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                borderColor: "#047857",
              }}
            >
              {loading ? (
                <span>Authenticating Workspace…</span>
              ) : (
                <>
                  <Building2 size={16} />
                  <span>Sign In to Dashboard</span>
                </>
              )}
            </button>

            {/* Quick dev test autofill */}
            <div className="mt-4 pt-3.5 border-t border-dashed border-gray-200">
              <p className="text-[11px] text-gray-500 mb-1.5 font-medium">Quick dev autofill:</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => autofillPreset("admin@madhuratech.com", "admin123")}
                  className="text-xs py-1 px-2.5 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-700 font-medium transition cursor-pointer"
                >
                  admin@madhuratech.com
                </button>
                <button
                  type="button"
                  onClick={() => autofillPreset("demo@madhuratech.com", "demo123")}
                  className="text-xs py-1 px-2.5 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-700 font-medium transition cursor-pointer"
                >
                  demo@madhuratech.com
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: ACCESS CODE QUICK LOOKUP & ACTIVATION */}
        {activeTab === "access_code" && (
          <div>
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 mb-4 text-xs text-emerald-950">
              <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-900">
                <KeyRound size={15} className="text-emerald-700" />
                <span>Employee Invitation &amp; Activation Code</span>
              </div>
              <p className="text-[12px] text-emerald-800 leading-relaxed m-0">
                If your workspace administrator or branch manager invited you, enter your 10-character code below to verify your branch allocation and activate your account.
              </p>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="quick-code-input" className="hl-section-label block font-bold text-xs text-gray-700 m-0">
                  Workspace Access Code *
                </label>
                {codeChecking && (
                  <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Checking…
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <KeyRound size={16} />
                </div>
                <input
                  id="quick-code-input"
                  type="text"
                  value={quickCode}
                  onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                  className="hl-input w-full pl-9 pr-3 py-2.5 font-mono font-bold tracking-wider text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="e.g. AC-X9B2-4821"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Live Preview Card */}
            {codePreview && (
              <div className="p-3.5 mb-4 rounded-xl bg-slate-50 border border-emerald-300 text-xs shadow-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-bold mb-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Valid Invitation for {codePreview.tenant_name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-gray-700 text-[11px] pt-1 border-t border-gray-200">
                  <div>
                    <span className="text-gray-500 block">Assigned Branch:</span>
                    <strong className="text-gray-900">{codePreview.branch_name || "Head Office"}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Assigned Role:</span>
                    <strong className="text-gray-900">{codePreview.role || "Employee"}</strong>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleQuickCodeContinue}
              className="hl-btn-primary w-full py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 rounded-xl shadow-sm transition hover:shadow cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                borderColor: "#047857",
              }}
            >
              <KeyRound size={16} />
              <span>Continue to Account Activation →</span>
            </button>
          </div>
        )}

        {/* TAB 3: 1-CLICK DEV & DEMO SWITCHER */}
        {activeTab === "demo" && (
          <div>
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 mb-4 text-xs text-emerald-950">
              <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-900">
                <Zap size={15} className="text-emerald-700 fill-emerald-700" />
                <span>Instant Developer &amp; Evaluation Sandboxes</span>
              </div>
              <p className="text-[12px] text-emerald-800 leading-relaxed m-0">
                Pre-authenticated demo environments for multi-tenant isolation, branch switching, Meta Embedded Signup, and Razorpay wallet workflows.
              </p>
            </div>

            <div className="space-y-3 mb-4">
              <button
                type="button"
                disabled={Boolean(demoLoadingRole)}
                onClick={() => handleLaunchDemo("admin")}
                className="w-full p-3.5 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50/40 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 group-hover:text-emerald-800">
                      Primary Organization Admin
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Full control across all branches, WABA senders, billing &amp; RBAC
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700">
                  {demoLoadingRole === "admin" ? "Launching…" : "Launch →"}
                </span>
              </button>

              <button
                type="button"
                disabled={Boolean(demoLoadingRole)}
                onClick={() => handleLaunchDemo("employee")}
                className="w-full p-3.5 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Users size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 group-hover:text-slate-800">
                      Branch Support Agent
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Scoped to branch inbox, conversation transfers &amp; customer chat
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  {demoLoadingRole === "employee" ? "Launching…" : "Launch →"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Workspace Signup Link */}
        <div style={{ marginTop: 22, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 8 }}>
            Need a new workspace for your enterprise?{" "}
            <Link to="/signup" style={{ color: "var(--color-primary)", fontWeight: 700 }}>
              Create Organization (14-Day Free Trial) →
            </Link>
          </p>
        </div>

        {/* Security & Multi-Tenancy Trust Footer */}
        <div
          className="flex items-center justify-center gap-2 flex-wrap"
          style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 18, borderTop: "1px solid var(--color-line)", paddingTop: 12 }}
        >
          <div className="flex items-center gap-1">
            <Shield size={12} className="text-emerald-600" />
            <span>Multi-Tenant Quarantine</span>
          </div>
          <span>•</span>
          <span>Branch RBAC Enforced</span>
          <span>•</span>
          <span>Meta Graph v22.0</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100">
            <div className="flex items-center gap-2.5 text-gray-900 font-bold text-base mb-2">
              <HelpCircle size={20} className="text-emerald-600" />
              <span>Password Recovery</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              For security under tenant isolation, account password resets are managed by your Organization Administrator. Contact your workspace admin or email{" "}
              <a href="mailto:support@madhuratech.com" className="text-emerald-700 font-semibold underline">
                support@madhuratech.com
              </a>{" "}
              for verified identity clearance.
            </p>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="hl-btn-primary w-full py-2.5 text-xs font-bold rounded-xl"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
