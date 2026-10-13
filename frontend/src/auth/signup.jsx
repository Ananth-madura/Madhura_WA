import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  CheckCircle2,
  ArrowLeft,
  Building2,
  Sparkles,
  Zap,
  Check,
  ShieldCheck,
  KeyRound,
  ChevronRight,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Briefcase,
} from "lucide-react";
import { API } from "../config/api";
import { useAuth } from "./AuthContext";
import { startDirectDemoSession } from "./demoSession";

const DEFAULT_PLANS = [
  {
    id: "free",
    name: "Free Tier",
    badge: "Free",
    price: "₹0",
    billing: "forever",
    maxSenders: 1,
    maxMonthlyMessages: 500,
    features: [
      "1 Connected WhatsApp Number",
      "500 Outbound Messages / mo",
      "Live Chat Inbox & History",
      "Standard Message Templates",
      "Basic Keyword Auto-Reply",
    ],
  },
  {
    id: "starter",
    name: "Starter Plan",
    badge: "Popular",
    price: "₹1,499",
    billing: "/ month",
    maxSenders: 3,
    maxMonthlyMessages: 5000,
    features: [
      "3 Connected WhatsApp Numbers",
      "5,000 Outbound Messages / mo",
      "Visual Chatbot Flow Builder",
      "Anti-Ban Humanized Pacing",
      "Automated Reminders & Invoices",
    ],
  },
  {
    id: "growth",
    name: "Growth Plan",
    badge: "Recommended",
    price: "₹3,999",
    billing: "/ month",
    maxSenders: 10,
    maxMonthlyMessages: 25000,
    features: [
      "10 Connected WhatsApp Numbers",
      "25,000 Outbound Messages / mo",
      "Smart AI Neural Replies (OpenAI)",
      "Multi-Sender Pool Load Balancing",
      "Automated Drip Followup Sequences",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    badge: "Scale",
    price: "₹9,999",
    billing: "/ month",
    maxSenders: 50,
    maxMonthlyMessages: 100000,
    features: [
      "50+ Connected WhatsApp Numbers",
      "100,000+ Outbound Messages / mo",
      "Dedicated Meta Cloud API Engine",
      "Unlimited Agents & Isolation",
      "24/7 SLA & Phone Support",
    ],
  },
];

const ACCESS_LEVEL_NAMES = {
  full: "Full WhatsApp Access",
  chat_only: "Live Chat Only",
  read_only: "Read-Only Archive",
  campaign_only: "Bulk Broadcasts Only",
};

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab mode: "self_signup" | "access_code"
  const [mode, setMode] = useState("self_signup");

  // Self-signup state
  const [workspaceName, setWorkspaceName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("starter");

  // Plans catalog
  const [plans, setPlans] = useState(DEFAULT_PLANS);

  // Access-code join state
  const [accessCode, setAccessCode] = useState("");
  const [verifiedCodeData, setVerifiedCodeData] = useState(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [showRequestAccessForm, setShowRequestAccessForm] = useState(false);
  const [empId, setEmpId] = useState("");

  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  // Pre-fill query parameters (e.g. /signup?code=AC-X9B2-4821 or ?tab=join)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeParam = params.get("code");
    const tabParam = params.get("tab");

    if (codeParam) {
      setAccessCode(codeParam.toUpperCase());
      setMode("access_code");
    } else if (tabParam === "join" || tabParam === "employee" || tabParam === "access_code") {
      setMode("access_code");
    }
  }, [location.search]);

  // Fetch plans from backend if available
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/api/auth/plans`, { timeout: 6000 })
      .then((res) => {
        if (!cancelled && res.data?.plans && Array.isArray(res.data.plans)) {
          setPlans(res.data.plans);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time verification of Access Code as employee types
  useEffect(() => {
    const cleanCode = accessCode.trim().toUpperCase();
    if (cleanCode.length >= 6) {
      let cancelled = false;
      setVerifyingCode(true);
      axios
        .post(`${API}/api/auth/verify-access-code`, { access_code: cleanCode }, { timeout: 5000 })
        .then((res) => {
          if (!cancelled && res.data?.valid) {
            setVerifiedCodeData(res.data);
            if (res.data.email && !email) setEmail(res.data.email);
            if (res.data.first_name && !fullName) setFullName(res.data.first_name);
          }
        })
        .catch(() => {
          if (!cancelled) setVerifiedCodeData(null);
        })
        .finally(() => {
          if (!cancelled) setVerifyingCode(false);
        });

      return () => {
        cancelled = true;
      };
    } else {
      setVerifiedCodeData(null);
    }
  }, [accessCode]);

  const handleSelfSignup = async (e) => {
    e?.preventDefault?.();
    setError("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCompany = workspaceName.trim() || `${cleanName}'s Workspace`;

    if (!cleanName) return setError("Please enter your full name");
    if (!cleanEmail) return setError("Please enter your work email");
    if (!password) return setError("Please set a password");
    if (password.length < 6) return setError("Password must be at least 6 characters long");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/api/auth/self-signup`,
        {
          first_name: cleanName,
          email: cleanEmail,
          password,
          company_name: cleanCompany,
          plan: selectedPlan,
        },
        { timeout: 15000 }
      );

      const data = res.data;
      if (data?.token && data?.user) {
        login({ ...data.user, token: data.token, demoMode: false });
        navigate("/whatsapp", { replace: true });
        return;
      }

      setDoneMessage(data?.message || "Workspace created successfully! You can now sign in.");
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      setError(msg || "Could not complete signup. Please verify your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWithAccessCode = async (e) => {
    e?.preventDefault?.();
    setError("");

    const cleanCode = accessCode.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanCode) return setError("Please enter your Workspace Access Code");
    if (!cleanEmail) return setError("Please enter your work email address");
    if (!password) return setError("Please create a password for your account");
    if (password.length < 6) return setError("Password must be at least 6 characters long");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/api/auth/join-with-access-code`,
        {
          access_code: cleanCode,
          email: cleanEmail,
          password,
          full_name: cleanName,
        },
        { timeout: 15000 }
      );

      const data = res.data;
      if (data?.token && data?.user) {
        login({ ...data.user, token: data.token, demoMode: false });
        navigate("/whatsapp", { replace: true });
        return;
      }

      setDoneMessage(data?.message || "Access verified! Your account is activated.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not activate with this Access Code. Please check the code with your admin."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (e) => {
    e?.preventDefault?.();
    setError("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanEmp = empId.trim();

    if (!cleanName) return setError("Please enter your full name");
    if (!cleanEmail) return setError("Please enter your work email");
    if (!cleanEmp) return setError("Please enter your employee ID or reason for access");

    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/auth/request-access`, {
        first_name: cleanName,
        email: cleanEmail,
        emp_id: cleanEmp,
      });
      setDoneMessage(data?.message || "Access request submitted. An admin will generate your Access Code.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit access request. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setDemoLoading(true);
    setError("");
    try {
      const session = await startDirectDemoSession(API);
      login(session);
      navigate("/whatsapp", { replace: true });
    } catch (_) {
      setError("Failed to start demo session. Try normal sign in.");
    } finally {
      setDemoLoading(false);
    }
  };

  const currentPlanMeta = plans.find((p) => p.id === selectedPlan) || plans[1] || DEFAULT_PLANS[1];

  return (
    <div className="lp-auth" style={{ minHeight: "100dvh", padding: "24px 16px" }}>
      <div
        className="lp-auth-panel"
        style={{
          maxWidth: mode === "self_signup" ? 720 : 480,
          transition: "max-width 0.2s ease-in-out",
        }}
      >
        <Link to="/" className="lp-auth-back">
          <ArrowLeft size={15} />
          Back to home
        </Link>

        <div className="hl-wordmark" style={{ color: "var(--color-ink)", marginBottom: 8 }}>
          <span className="hl-wordmark-mark" aria-hidden="true"></span>
          Madhura&nbsp;<em>WhatsApp CRM</em>
        </div>

        {doneMessage ? (
          <div>
            <h1 className="hl-title" style={{ marginBottom: 8 }}>Account ready</h1>
            <div
              role="status"
              className="lp-auth-note"
              style={{
                background: "#ECFDF3",
                borderColor: "#ABEFC6",
                color: "#067647",
                marginBottom: 20,
              }}
            >
              <CheckCircle2 size={18} style={{ flex: "none" }} />
              <span>{doneMessage}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.6, marginBottom: 24 }}>
              Your workspace setup is completed. Sign in using your email and password to access the WhatsApp CRM dashboard.
            </p>
            <Link to="/login" className="hl-btn-primary" style={{ width: "100%", textAlign: "center" }}>
              Sign in to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <h1 className="hl-title" style={{ fontSize: 24, margin: 0 }}>
                {mode === "self_signup" ? "Create Your Workspace" : "Join with Access Code"}
              </h1>
              <button
                type="button"
                onClick={handleDemoAccess}
                disabled={demoLoading}
                className="hl-btn-secondary"
                style={{
                  fontSize: 12,
                  padding: "5px 10px",
                  borderColor: "rgba(16, 185, 129, 0.4)",
                  color: "#047857",
                  background: "rgba(16, 185, 129, 0.08)",
                }}
              >
                <Zap size={13} className="text-emerald-600" />
                <span>{demoLoading ? "Launching…" : "1-Click Demo"}</span>
              </button>
            </div>

            <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 18 }}>
              {mode === "self_signup"
                ? "Self-service onboarding: provision your tenant workspace and choose your WhatsApp messaging plan."
                : "First time logging in as an employee? Enter the Access Code provided by your workspace admin to activate your WhatsApp access."}
            </p>

            {/* Mode Tabs */}
            <div
              style={{
                display: "flex",
                background: "var(--color-paper-2, #f1f5f9)",
                borderRadius: "var(--radius-md, 8px)",
                padding: 3,
                marginBottom: 20,
                border: "1px solid var(--color-line)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMode("self_signup");
                  setError("");
                }}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: mode === "self_signup" ? "var(--color-paper, #ffffff)" : "transparent",
                  color: mode === "self_signup" ? "var(--color-ink)" : "var(--color-ink-2)",
                  boxShadow: mode === "self_signup" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Building2 size={14} />
                <span>New Workspace (Admin)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("access_code");
                  setError("");
                }}
                style={{
                  flex: 1,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: mode === "access_code" ? "var(--color-paper, #ffffff)" : "transparent",
                  color: mode === "access_code" ? "var(--color-ink)" : "var(--color-ink-2)",
                  boxShadow: mode === "access_code" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <KeyRound size={14} />
                <span>Join with Access Code</span>
              </button>
            </div>

            {error && (
              <div role="alert" className="lp-auth-error" style={{ marginBottom: 18 }}>
                {error}
              </div>
            )}

            {mode === "self_signup" ? (
              <form onSubmit={handleSelfSignup} noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                  <div>
                    <label htmlFor="lp-ws-name" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                      Company or Workspace Name *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Building2 size={16} />
                      </div>
                      <input
                        id="lp-ws-name"
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="e.g. Apex Global Solutions"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="lp-name" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                      Full Name *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <User size={16} />
                      </div>
                      <input
                        id="lp-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="e.g. Rajesh Kumar"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="lp-email" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                    Work Email Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Mail size={16} />
                    </div>
                    <input
                      id="lp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                  <div>
                    <label htmlFor="lp-pass" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                      Create Password (min. 6 chars) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Lock size={16} />
                      </div>
                      <input
                        id="lp-pass"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
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

                  <div>
                    <label htmlFor="lp-pass-confirm" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Lock size={16} />
                      </div>
                      <input
                        id="lp-pass-confirm"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="hl-input w-full pl-9 pr-10 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="••••••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Plan Selection Section */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="hl-section-label block font-bold text-xs text-gray-700 m-0">
                      Select Workspace Plan
                    </label>
                    <span className="text-[11px] text-gray-500 font-medium">
                      Includes 14-day full feature trial
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-3">
                    {plans.map((p) => {
                      const isSelected = selectedPlan === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPlan(p.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-xs font-bold text-gray-900 truncate">
                                {p.name.replace(" Plan", "")}
                              </span>
                              {p.badge && (
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                    isSelected
                                      ? "bg-emerald-600 text-white"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {p.badge}
                                </span>
                              )}
                            </div>
                            <div className={`text-base font-extrabold ${isSelected ? "text-emerald-700" : "text-gray-900"}`}>
                              {p.price}
                            </div>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-1">
                            {p.maxSenders} {p.maxSenders === 1 ? "Number" : "Numbers"}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Highlighted plan feature card */}
                  <div className="bg-slate-50/80 border border-gray-200 rounded-xl p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-800 mb-2">
                      <Sparkles size={14} className="text-emerald-600 shrink-0" />
                      <span>{currentPlanMeta.name} Features Included:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {currentPlanMeta.features?.slice(0, 4).map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-gray-700">
                          <Check size={13} className="text-emerald-600 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="hl-btn-primary w-full py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 rounded-xl shadow-sm transition hover:shadow"
                >
                  {loading ? (
                    <span>Provisioning Workspace…</span>
                  ) : (
                    <>
                      <span>Create Workspace &amp; Launch Dashboard</span>
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* TAB 2: JOIN WITH ACCESS CODE (EMPLOYEE FIRST-TIME LOGIN) */
              <div>
                {!showRequestAccessForm ? (
                  <form onSubmit={handleJoinWithAccessCode} noValidate>
                    {/* Live Verification Card */}
                    {verifiedCodeData && (
                      <div
                        className="p-3 mb-4 rounded-xl flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800"
                      >
                        <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <div className="font-bold">
                            Valid Access Code for {verifiedCodeData.tenant_name || "Workspace"}
                          </div>
                          <div className="text-[11px] text-emerald-700 mt-0.5">
                            Assigned Level:{" "}
                            <strong>
                              {ACCESS_LEVEL_NAMES[verifiedCodeData.whatsapp_access_level] || "Full WhatsApp Access"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="join-access-code" className="hl-section-label block font-bold text-xs text-gray-700 m-0">
                          Workspace Access Code (from Admin) *
                        </label>
                        {verifyingCode && (
                          <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Checking code…
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          <KeyRound size={16} />
                        </div>
                        <input
                          id="join-access-code"
                          type="text"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                          className="hl-input w-full pl-9 pr-3 py-2.5 font-mono font-bold tracking-wider text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                          placeholder="e.g. AC-X9B2-4821"
                          required
                          autoFocus
                        />
                      </div>
                      <span className="text-[11px] text-gray-500 block mt-1">
                        Obtained from your administrator when they added your employee profile.
                      </span>
                    </div>

                    <div className="mb-4">
                      <label htmlFor="join-email" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                        Work Email Address *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          <Mail size={16} />
                        </div>
                        <input
                          id="join-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                          placeholder="name@company.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label htmlFor="join-name" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                        Your Full Name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          <User size={16} />
                        </div>
                        <input
                          id="join-name"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                          placeholder="Rajesh Kumar"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                      <div>
                        <label htmlFor="join-pass" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                          Set Password *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Lock size={16} />
                          </div>
                          <input
                            id="join-pass"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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

                      <div>
                        <label htmlFor="join-pass-confirm" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                          Confirm Password *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Lock size={16} />
                          </div>
                          <input
                            id="join-pass-confirm"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="hl-input w-full pl-9 pr-10 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="••••••••••••"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="hl-btn-primary w-full py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 rounded-xl shadow-sm transition hover:shadow"
                      style={{
                        background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                        borderColor: "#047857",
                      }}
                    >
                      {loading ? (
                        <span>Activating Employee Account…</span>
                      ) : (
                        <>
                          <KeyRound size={16} />
                          <span>Activate Account &amp; Launch WhatsApp</span>
                        </>
                      )}
                    </button>

                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={() => setShowRequestAccessForm(true)}
                        className="text-xs text-gray-500 hover:text-emerald-700 underline font-medium"
                      >
                        Don&apos;t have an Access Code yet? Request access from admin →
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Collapsible Request Access Form (if employee does not have code yet) */
                  <form onSubmit={handleRequestAccess} noValidate>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Request Access From Admin
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowRequestAccessForm(false)}
                        className="text-xs text-emerald-700 hover:underline font-semibold"
                      >
                        ← Back to Access Code
                      </button>
                    </div>

                    <div className="mb-4">
                      <label htmlFor="req-name" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                        Full Name *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          <User size={16} />
                        </div>
                        <input
                          id="req-name"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="hl-input w-full pl-9 pr-3 py-2.5 text-sm"
                          placeholder="Your full name"
                          required
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label htmlFor="req-email" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                        Work Email Address *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          <Mail size={16} />
                        </div>
                        <input
                          id="req-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="hl-input w-full pl-9 pr-3 py-2.5 text-sm"
                          placeholder="name@company.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="mb-5">
                      <label htmlFor="req-emp" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                        Employee ID / Department *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                          <Briefcase size={16} />
                        </div>
                        <input
                          id="req-emp"
                          type="text"
                          value={empId}
                          onChange={(e) => setEmpId(e.target.value)}
                          className="hl-input w-full pl-9 pr-3 py-2.5 text-sm"
                          placeholder="e.g. Sales / Support team"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="hl-btn-primary w-full py-2.5 px-4 text-sm font-bold rounded-xl"
                    >
                      {loading ? "Submitting Request…" : "Submit Access Request"}
                    </button>
                  </form>
                )}
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: "center", borderTop: "1px solid var(--color-line)", paddingTop: 14 }}>
              <p style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
                Already activated your account?{" "}
                <Link to="/login" style={{ color: "var(--color-primary)", fontWeight: 700 }}>
                  Sign in here →
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
