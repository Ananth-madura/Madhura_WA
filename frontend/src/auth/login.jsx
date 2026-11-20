import { loginDestination } from "./loginDestination";
import { confirmBrowserSession } from "./browserSession";
import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Sparkles,
  GitBranch,
  ShieldCheck,
  Zap,
  HelpCircle,
  X,
  MessageSquare,
  Radio,
  Check,
  Clock
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { API, apiCandidates, saveApiOverride, readApiOverride } from "../config/api";
import { MARKETING } from "../config/index";
import { startDirectDemoSession } from "./demoSession";

const apiBase = () => readApiOverride() || API;

const MASTER_ADMIN_EMAIL = "admin@madhuratech.com";
const MASTER_ADMIN_PASSWORD = "Admin@123";
const isMasterCredentials = (email, password) =>
  String(email || "").trim().toLowerCase() === MASTER_ADMIN_EMAIL && String(password || "") === MASTER_ADMIN_PASSWORD;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode tabs: "credentials" | "access_code" | "demo"
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
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [resendingCode, setResendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Pre-fill query parameters if any
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

  // Countdown timer for 2FA resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Keyboard shortcut: close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && showForgotModal) {
        setShowForgotModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showForgotModal]);

  const submitCredentials = async (e) => {
    e?.preventDefault?.();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setError("Please enter your work email or employee ID");
    if (!password) return setError("Please enter your password");

    setLoading(true);
    setError("");
    setNotice("");

    const candidates = apiCandidates(typeof window !== "undefined" ? window.location : null);
    let data = null;
    let workingOrigin = "";
    let lastError = null;

    try {
      for (const origin of candidates) {
        try {
          const res = await axios.post(
            `${origin}/api/auth/login`,
            { email: cleanEmail, password },
            { timeout: 15000 }
          );
          data = res.data || {};
          workingOrigin = origin;
          break;
        } catch (err) {
          lastError = err;
          const status = err.response?.status;
          if (status && ![502, 503, 504].includes(status)) break;
        }
      }

      if (!data) {
        const master = isMasterCredentials(cleanEmail, password);
        const status = lastError?.response?.status;
        const transportFailure = !lastError?.response || [502, 503, 504].includes(status);

        if (master && transportFailure) {
          const session = await startDirectDemoSession(API, "admin");
          login({
            ...session,
            demoReason: "The server could not be reached, so this is the offline workspace.",
          });
          setNotice("Offline workspace access granted. Live data resumes when server connectivity returns.");
          navigate("/whatsapp", { replace: true });
          return;
        }

        if (lastError?.friendlyMessage) setError(lastError.friendlyMessage);
        else if (transportFailure) {
          setError("The enterprise backend service is unreachable. Check your connection or use 1-Click Demo Login.");
        } else {
          setError(lastError?.response?.data?.message || lastError?.response?.data?.error || "Login failed. Please verify your credentials.");
        }
        return;
      }

      if (data?.requires2FA) {
        if (workingOrigin && workingOrigin !== API) saveApiOverride(workingOrigin);
        setTwoFactorEmail(data.email || cleanEmail);
        setTwoFactorCode("");
        setCountdown(60);
        setNotice("A verification code was sent to your email. It expires after 5 minutes.");
        return;
      }
      if (!data?.token && !data?.cookieSession) {
        setError("Login failed: no authentication token returned from server.");
        return;
      }

      const pinned = workingOrigin && workingOrigin !== API ? saveApiOverride(workingOrigin) : "";

      await confirmBrowserSession(data);
      login({
        ...data.user,
        cookieSession: Boolean(data.cookieSession || data.user?.cookieSession),
        token: data.token,
        active_tenant_id: data.user.tenant_id,
        active_branch_id: data.user.branch_id,
        demoMode: false,
      });

      const returnUrl = loginDestination(data, location.search);
      if (pinned) {
        window.location.replace(returnUrl);
        return;
      }
      navigate(returnUrl, { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (err.friendlyMessage) {
        setError(err.friendlyMessage);
      } else if (status === 503 || !err.response) {
        setError("The enterprise backend service is unreachable. Check your network or use Demo Login.");
      } else {
        setError(err.response?.data?.message || err.response?.data?.error || "Login failed. Please verify your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const submitTwoFactor = async (e) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) return setError("Enter the verification code from your email.");
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${apiBase()}/api/auth/verify-2fa`, {
        email: twoFactorEmail,
        otp: twoFactorCode.trim(),
      }, { timeout: 15000 });
      if (!data?.token && !data?.cookieSession) throw new Error("Verification did not return a session.");
      await confirmBrowserSession(data);
      login({ ...data.user, cookieSession: Boolean(data.cookieSession || data.user?.cookieSession), token: data.token, demoMode: false });
      const returnUrl = loginDestination(data, location.search);
      navigate(returnUrl, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || "The verification code could not be confirmed.");
    } finally {
      setLoading(false);
    }
  };

  const resendTwoFactor = async () => {
    if (countdown > 0) return;
    setResendingCode(true);
    setError("");
    try {
      const { data } = await axios.post(`${apiBase()}/api/auth/resend-2fa`, { email: twoFactorEmail }, { timeout: 15000 });
      setNotice(data.message || "A new verification code has been sent.");
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "A new verification code could not be sent.");
    } finally {
      setResendingCode(false);
    }
  };

  const handleLaunchDemo = async (role = "admin") => {
    setDemoLoadingRole(role);
    setError("");
    setNotice(`Opening demo workspace as ${role === "admin" ? "Organization Admin" : "Branch Staff"}...`);

    try {
      const session = await startDirectDemoSession(API, role);
      login(session);
      navigate("/whatsapp", { replace: true });
    } catch (err) {
      setError("Could not open the demo workspace. Please retry.");
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto w-full max-w-5xl">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <a
            href={MARKETING}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </a>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Official Meta Tech Provider</span>
            </span>
          </div>
        </div>

        {/* Main Grid: Info Hero + Auth Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Platform Capabilities */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 rounded-3xl bg-slate-900 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
                  M
                </div>
                <div>
                  <span className="text-base font-extrabold text-white tracking-tight">Madhura</span>
                  <span className="text-xs text-emerald-400 block font-semibold">WhatsApp Cloud API Suite</span>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-white leading-tight">
                  Enterprise WhatsApp Business Infrastructure
                </h2>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Connect multiple WhatsApp numbers, orchestrate flowbots, manage team inboxes across branches, and synchronize campaigns.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Direct Meta Cloud API</h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      High throughput direct connection with official Embedded Signup onboarding.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <GitBranch className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Multi-Branch Workspaces</h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Isolate contacts, chats, and templates per regional store or franchise branch.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Shared Multi-Agent Inbox</h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Smart conversation assignments, canned replies, internal notes, and audit trails.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance Footer */}
            <div className="pt-6 border-t border-slate-800 text-[11px] text-slate-400 space-y-2 relative z-10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-300">Tenant-isolated encryption &amp; audit trails</span>
              </div>
              <p>Meta Tech Provider compliance verified with Cloud API PIN and webhook verification.</p>
            </div>
          </div>

          {/* Right Column: Authentication Form Card */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <a href={MARKETING} className="flex items-center gap-2">
                  <img src="/Group.png" alt="Madhura WhatsApp CRM" className="h-8 w-auto object-contain" />
                </a>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  <GitBranch className="w-3 h-3 text-emerald-600" />
                  <span>Workspace v2</span>
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Sign in to Workspace
              </h1>
              <p className="text-xs text-slate-600 mt-1 mb-6 leading-relaxed">
                Tenant-isolated messaging platform, branch routing, and live team inbox.
              </p>

              {/* Tab Selector */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 border border-slate-200">
                <button
                  type="button"
                  disabled={!!twoFactorEmail}
                  onClick={() => {
                    setActiveTab("credentials");
                    setError("");
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                    activeTab === "credentials"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Mail className="w-4 h-4 text-emerald-600" />
                  <span>Work Account</span>
                </button>
                <button
                  type="button"
                  disabled={!!twoFactorEmail}
                  onClick={() => {
                    setActiveTab("access_code");
                    setError("");
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                    activeTab === "access_code"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>Access Code</span>
                </button>
                <button
                  type="button"
                  disabled={!!twoFactorEmail}
                  onClick={() => {
                    setActiveTab("demo");
                    setError("");
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                    activeTab === "demo"
                      ? "bg-white text-emerald-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>Try Demo</span>
                </button>
              </div>

              {/* Feedback Alerts */}
              {error && (
                <div role="alert" className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </div>
              )}
              {notice && (
                <div role="status" className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{notice}</div>
                </div>
              )}

              {/* 2FA Form */}
              {twoFactorEmail && (
                <form onSubmit={submitTwoFactor} className="space-y-4" aria-label="Two-step verification">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <h2 className="text-xs font-bold text-slate-900">Two-Step Verification</h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Enter the 6-digit verification code sent to <span className="font-semibold text-slate-900">{twoFactorEmail}</span>.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="twoFactorInput" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Verification Code *
                    </label>
                    <input
                      id="twoFactorInput"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none tracking-widest text-center"
                      autoFocus
                      placeholder="123456"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !twoFactorCode.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors disabled:opacity-50 min-h-[44px] cursor-pointer shadow-sm"
                  >
                    {loading ? "Verifying Code..." : "Verify and sign in"}
                  </button>
                  <div className="flex items-center justify-between gap-3 text-xs pt-1">
                    <button
                      type="button"
                      onClick={resendTwoFactor}
                      disabled={resendingCode || countdown > 0}
                      className="text-emerald-700 hover:underline font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {resendingCode ? "Sending..." : countdown > 0 ? `Resend code in ${countdown}s` : "Send a new code"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFactorEmail("");
                        setTwoFactorCode("");
                        setNotice("");
                        setError("");
                      }}
                      className="text-slate-600 hover:underline cursor-pointer"
                    >
                      Back to sign in
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 1: WORKSPACE ACCOUNT LOGIN */}
              {!twoFactorEmail && activeTab === "credentials" && (
                <form onSubmit={submitCredentials} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="hl-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Work Email or Employee ID *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="hl-email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="username"
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none transition-colors"
                        placeholder="admin@madhuratech.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="hl-password" className="block text-xs font-bold text-slate-700 m-0">
                        Password *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[11px] text-emerald-700 hover:underline font-semibold focus-visible:outline-none cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="hl-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none transition-colors"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus-visible:outline-none cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Remember this workstation</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 min-h-[44px] shadow-sm cursor-pointer"
                  >
                    {loading ? (
                      <span>Authenticating Workspace...</span>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4" />
                        <span>Sign In to Dashboard</span>
                      </>
                    )}
                  </button>

                  {/* Dev Test Credentials */}
                  {process.env.NODE_ENV !== "production" && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-[11px] text-slate-500 mb-1.5 font-medium">Quick dev autofill credentials:</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => autofillPreset(MASTER_ADMIN_EMAIL, MASTER_ADMIN_PASSWORD)}
                          className="text-[11px] py-1 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium transition cursor-pointer"
                        >
                          {MASTER_ADMIN_EMAIL}
                        </button>
                        <button
                          type="button"
                          onClick={() => autofillPreset("demo@madhuratech.com", "demo123")}
                          className="text-[11px] py-1 px-2.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                        >
                          demo@madhuratech.com
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* TAB 2: ACCESS CODE */}
              {!twoFactorEmail && activeTab === "access_code" && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-900">
                      <KeyRound className="w-4 h-4 text-emerald-700" />
                      <span>Employee Invitation &amp; Activation Code</span>
                    </div>
                    Enter the access code provided by your organization supervisor to verify your branch allocation.
                  </div>

                  <div>
                    <label htmlFor="quick-code-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Access Code *
                    </label>
                    <input
                      id="quick-code-input"
                      type="text"
                      maxLength={14}
                      value={quickCode}
                      onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                      placeholder="e.g. AC-9B21-48"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 text-slate-900 font-mono focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none"
                    />
                  </div>

                  {codeChecking && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                      <span>Validating access code...</span>
                    </p>
                  )}

                  {codePreview && (
                    <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                      <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified: {codePreview.company_name || "Enterprise Workspace"}</span>
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        Role: <span className="font-medium">{codePreview.role_name || "Team Member"}</span> | Branch: <span className="font-medium">{codePreview.branch_name || "Head Office"}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleQuickCodeContinue}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors min-h-[44px] cursor-pointer shadow-sm"
                  >
                    <span>Continue Activation</span>
                  </button>
                </div>
              )}

              {/* TAB 3: DEMO WORKSPACE */}
              {!twoFactorEmail && activeTab === "demo" && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-900">
                      <Zap className="w-4 h-4 text-emerald-700" />
                      <span>Instant 1-Click Interactive Demo</span>
                    </div>
                    Explore full team inbox, multi-branch routing, campaign creation, and chatbot flows with preloaded sample data in an isolated session.
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => handleLaunchDemo("admin")}
                      disabled={demoLoadingRole !== null}
                      className="w-full py-3 px-4 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50/50 text-emerald-900 text-xs font-bold flex items-center justify-between transition-colors min-h-[44px] cursor-pointer shadow-sm"
                    >
                      <span className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>Launch as Primary Organization Admin</span>
                      </span>
                      <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded">Full Admin Access</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleLaunchDemo("employee")}
                      disabled={demoLoadingRole !== null}
                      className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-between transition-colors min-h-[44px] cursor-pointer shadow-sm"
                    >
                      <span className="flex items-center gap-2.5">
                        <Building2 className="w-4 h-4 text-slate-600" />
                        <span>Launch as Branch Agent</span>
                      </span>
                      <span className="text-[11px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded">Staff Inbox View</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
              <p>
                Do not have an enterprise workspace?{" "}
                <Link to="/signup" className="text-emerald-700 font-bold hover:underline">
                  Create Account
                </Link>
              </p>

              <div className="flex items-center gap-3 text-[11px]">
                <Link to="/terms" className="text-slate-500 hover:text-slate-700 underline">Terms</Link>
                <Link to="/privacy" className="text-slate-500 hover:text-slate-700 underline">Privacy</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgotPasswordTitle"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="forgotPasswordTitle" className="text-base font-bold text-slate-900">
                Password Recovery
              </h2>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Contact your workspace administrator or branch supervisor to issue a temporary password reset code.
              Master administrative credentials can be restored via platform administration.
            </p>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors min-h-[44px] cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
