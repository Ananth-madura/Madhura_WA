import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  CheckCircle2,
  ArrowLeft,
  Building2,
  Sparkles,
  Zap,
  Check,
  ShieldCheck,
  Users,
  ChevronRight,
  Layers,
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

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Tab mode: "self_signup" | "request_access"
  const [mode, setMode] = useState("self_signup");

  // Self-signup state
  const [workspaceName, setWorkspaceName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("starter");

  // Plans catalog
  const [plans, setPlans] = useState(DEFAULT_PLANS);

  // Request-access state
  const [empId, setEmpId] = useState("");

  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

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
        // Automatically log the new user in and navigate to the dashboard
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

  const handleRequestAccess = async (e) => {
    e?.preventDefault?.();
    setError("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanEmp = empId.trim();

    if (!cleanName) return setError("Please enter your full name");
    if (!cleanEmail) return setError("Please enter your work email");
    if (!cleanEmp) return setError("Please enter your employee ID");

    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/auth/request-access`, {
        first_name: cleanName,
        email: cleanEmail,
        emp_id: cleanEmp,
      });
      setDoneMessage(data?.message || "Access request submitted. An admin will review your account.");
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
          maxWidth: mode === "self_signup" ? 720 : 440,
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
                {mode === "self_signup" ? "Create Your Workspace" : "Request Access"}
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
                : "Submit your details to request an employee login from an organization administrator."}
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
                <span>New Workspace (Self-Signup)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("request_access");
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
                  background: mode === "request_access" ? "var(--color-paper, #ffffff)" : "transparent",
                  color: mode === "request_access" ? "var(--color-ink)" : "var(--color-ink-2)",
                  boxShadow: mode === "request_access" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Users size={14} />
                <span>Join Team / Request Access</span>
              </button>
            </div>

            {error && (
              <div role="alert" className="lp-auth-error" style={{ marginBottom: 18 }}>
                {error}
              </div>
            )}

            {mode === "self_signup" ? (
              <form onSubmit={handleSelfSignup} noValidate>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 16 }}>
                  <div>
                    <label htmlFor="lp-ws-name" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                      Company or Workspace Name
                    </label>
                    <input
                      id="lp-ws-name"
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="hl-input w-full"
                      placeholder="e.g. Apex Global Solutions"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="lp-name" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                      Full Name
                    </label>
                    <input
                      id="lp-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      className="hl-input w-full"
                      placeholder="e.g. Rajesh Kumar"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="lp-email" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                    Work Email Address
                  </label>
                  <input
                    id="lp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="hl-input w-full"
                    placeholder="name@company.com"
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
                  <div>
                    <label htmlFor="lp-pass" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                      Create Password (min. 6 chars)
                    </label>
                    <input
                      id="lp-pass"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="hl-input w-full"
                      placeholder="••••••••••••"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="lp-pass-confirm" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                      Confirm Password
                    </label>
                    <input
                      id="lp-pass-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="hl-input w-full"
                      placeholder="••••••••••••"
                      required
                    />
                  </div>
                </div>

                {/* Plan Selection Section */}
                <div style={{ marginBottom: 22 }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="hl-section-label" style={{ margin: 0 }}>
                      Select Workspace Plan
                    </label>
                    <span style={{ fontSize: 12, color: "var(--color-ink-2)" }}>
                      Selected: <strong>{currentPlanMeta.name}</strong> ({currentPlanMeta.price} {currentPlanMeta.billing})
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {plans.map((p) => {
                      const isSelected = selectedPlan === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPlan(p.id)}
                          style={{
                            border: isSelected ? "2px solid var(--color-primary, #0284c7)" : "1px solid var(--color-line)",
                            background: isSelected ? "rgba(2, 132, 199, 0.05)" : "var(--color-paper, #ffffff)",
                            borderRadius: "var(--radius-md, 8px)",
                            padding: "10px 12px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            position: "relative",
                          }}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink)" }}>
                              {p.name}
                            </span>
                            {p.badge && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  background: isSelected ? "#0284c7" : "var(--color-line)",
                                  color: isSelected ? "#ffffff" : "var(--color-ink-2)",
                                }}
                              >
                                {p.badge}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-ink)", marginBottom: 4 }}>
                            {p.price}
                            <span style={{ fontSize: 10, fontWeight: 500, color: "var(--color-ink-2)", marginLeft: 3 }}>
                              {p.billing}
                            </span>
                          </div>

                          <div style={{ fontSize: 11, color: "var(--color-ink-2)", lineHeight: 1.35 }}>
                            <div>• {p.maxSenders} WhatsApp Sender{p.maxSenders > 1 ? "s" : ""}</div>
                            <div>• {Number(p.maxMonthlyMessages).toLocaleString()} msgs / mo</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Highlights of selected plan */}
                  <div
                    style={{
                      background: "var(--color-paper-2, #f8fafc)",
                      border: "1px solid var(--color-line)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      marginTop: 10,
                      fontSize: 12,
                      color: "var(--color-ink-2)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)] mb-1">
                      <Sparkles size={13} className="text-amber-500" />
                      <span>{currentPlanMeta.name} Features Included:</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {currentPlanMeta.features?.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          <Check size={12} className="text-emerald-600" />
                          <span>{f}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="hl-btn-primary"
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
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
              <form onSubmit={handleRequestAccess} noValidate>
                <label htmlFor="req-name" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                  Full Name
                </label>
                <input
                  id="req-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="hl-input w-full"
                  style={{ marginBottom: 14 }}
                  placeholder="Your full name"
                  required
                />

                <label htmlFor="req-email" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                  Work Email Address
                </label>
                <input
                  id="req-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="hl-input w-full"
                  style={{ marginBottom: 14 }}
                  placeholder="name@company.com"
                  required
                />

                <label htmlFor="req-emp" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                  Employee ID / Code
                </label>
                <input
                  id="req-emp"
                  type="text"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  className="hl-input w-full"
                  style={{ marginBottom: 20 }}
                  placeholder="e.g. EMP-1042"
                  required
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="hl-btn-primary"
                  style={{ width: "100%", padding: "10px 14px" }}
                >
                  {loading ? "Submitting Request…" : "Submit Access Request"}
                </button>
              </form>
            )}

            <div style={{ marginTop: 20, textAlign: "center", borderTop: "1px solid var(--color-line)", paddingTop: 14 }}>
              <p style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
                Already have an account?{" "}
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
