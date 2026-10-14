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
  GitBranch,
  Globe,
  Phone,
  Clock,
  AlertCircle,
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
    maxBranches: 1,
    maxSeats: 1,
    maxMonthlyMessages: 500,
    features: [
      "1 Connected WhatsApp Number",
      "1 Head Office Branch",
      "500 Outbound Messages / mo",
      "Live Chat Inbox & History",
      "Standard Message Templates",
    ],
  },
  {
    id: "starter",
    name: "Starter Plan",
    badge: "Popular",
    price: "₹1,499",
    billing: "/ month",
    maxSenders: 3,
    maxBranches: 1,
    maxSeats: 5,
    maxMonthlyMessages: 5000,
    features: [
      "3 Connected WhatsApp Numbers",
      "1 Head Office Branch",
      "5 Team Seats & Staff Roles",
      "5,000 Outbound Messages / mo",
      "Visual Chatbot Flow Builder",
      "Anti-Ban Humanized Pacing",
    ],
  },
  {
    id: "growth",
    name: "Growth Plan",
    badge: "Recommended",
    price: "₹3,999",
    billing: "/ month",
    maxSenders: 10,
    maxBranches: 3,
    maxSeats: 15,
    maxMonthlyMessages: 25000,
    features: [
      "10 Connected WhatsApp Numbers",
      "3 Regional Branches & Routing",
      "15 Multi-Branch Team Seats",
      "25,000 Outbound Messages / mo",
      "AI Neural Replies & Smart Bots",
      "Multi-Sender Pool Balancing",
    ],
  },
  {
    id: "business",
    name: "Business Plan",
    badge: "Scale",
    price: "₹6,999",
    billing: "/ month",
    maxSenders: 25,
    maxBranches: 10,
    maxSeats: 50,
    maxMonthlyMessages: 60000,
    features: [
      "25 Connected WhatsApp Numbers",
      "10 Operational Branches",
      "50 Team Seats & Branch RBAC",
      "60,000 Outbound Messages / mo",
      "Shared Multi-Branch Inbox",
      "Branch-to-Branch Transfers",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    badge: "Custom",
    price: "₹9,999",
    billing: "/ month",
    maxSenders: 50,
    maxBranches: "Unlimited",
    maxSeats: 100,
    maxMonthlyMessages: 100000,
    features: [
      "50+ Connected WhatsApp Numbers",
      "Unlimited Branches & Teams",
      "100+ Seats & Custom Permissions",
      "100,000+ Outbound Messages / mo",
      "Dedicated Meta WABA Cloud API",
      "24/7 SLA & Dedicated Engineer",
    ],
  },
];

const INDUSTRIES = [
  "Retail & E-Commerce",
  "Real Estate & Construction",
  "Healthcare & Clinics",
  "Financial Services & FinTech",
  "Education & EdTech",
  "Automotive & Dealerships",
  "Hospitality & Tourism",
  "Logistics & Supply Chain",
  "Technology & Professional Services",
  "Other Industry",
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST +4:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +8:00)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
];

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab mode: "self_signup" | "access_code" | "request_access"
  const [mode, setMode] = useState("self_signup");

  // Step for self_signup: 1 = Org & Identity, 2 = Branch & Plan
  const [signupStep, setSignupStep] = useState(1);

  // Self-signup state
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Branch initialization state
  const [branchName, setBranchName] = useState("Head Office (Main)");
  const [branchCode, setBranchCode] = useState("HQ-01");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  // Plan catalog
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [selectedPlan, setSelectedPlan] = useState("growth");

  // Access-code join state
  const [accessCode, setAccessCode] = useState("");
  const [verifiedCodeData, setVerifiedCodeData] = useState(null);
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Request Access state
  const [empId, setEmpId] = useState("");
  const [department, setDepartment] = useState("");

  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  // Pre-fill query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeParam = params.get("code");
    const tabParam = params.get("tab");

    if (codeParam) {
      setAccessCode(codeParam.toUpperCase());
      setMode("access_code");
    } else if (tabParam === "access_code" || tabParam === "join") {
      setMode("access_code");
    } else if (tabParam === "request") {
      setMode("request_access");
    }
  }, [location.search]);

  // Fetch plans from backend if available
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/api/auth/plans`, { timeout: 6000 })
      .then((res) => {
        if (!cancelled && res.data?.plans && Array.isArray(res.data.plans)) {
          // Merge with multi-branch schema attributes
          const mapped = res.data.plans.map((p) => {
            const fallback = DEFAULT_PLANS.find((dp) => dp.id === p.id) || {};
            return {
              ...fallback,
              ...p,
            };
          });
          setPlans(mapped);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time verification of Access Code
  useEffect(() => {
    const cleanCode = accessCode.trim().toUpperCase();
    if (cleanCode.length >= 6) {
      let cancelled = false;
      setVerifyingCode(true);
      axios
        .post(`${API}/api/auth/verify-access-code`, { access_code: cleanCode }, { timeout: 6000 })
        .then((res) => {
          if (!cancelled && res.data?.valid) {
            setVerifiedCodeData(res.data);
            if (res.data.email && !email) setEmail(res.data.email);
            if (res.data.first_name && !firstName) setFirstName(res.data.first_name);
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

  // Handle Step 1 Validation
  const handleProceedToBranchAndPlan = (e) => {
    e?.preventDefault?.();
    setError("");

    const cleanCompany = companyName.trim();
    const cleanFirst = firstName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanCompany) return setError("Please enter your Company or Organization Name.");
    if (!cleanFirst) return setError("Please enter your First Name.");
    if (!cleanEmail) return setError("Please enter your Work Email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return setError("Please enter a valid work email address.");
    }
    if (!password) return setError("Please create a password.");
    if (password.length < 6) return setError("Password must be at least 6 characters long.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    // Autofill initial branch name if default
    if (!branchName || branchName === "Head Office (Main)") {
      setBranchName(`${cleanCompany} Head Office`);
    }

    setSignupStep(2);
  };

  // Submit complete Organization & Multi-Branch Self-Signup
  const handleSelfSignup = async (e) => {
    e?.preventDefault?.();
    setError("");

    const cleanCompany = companyName.trim();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanBranch = branchName.trim() || `${cleanCompany} Head Office`;
    const cleanBranchCode = (branchCode.trim() || "HQ-01").toUpperCase();

    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/api/auth/self-signup`,
        {
          company_name: cleanCompany,
          legal_name: legalName.trim() || cleanCompany,
          brand_name: brandName.trim() || cleanCompany,
          industry,
          first_name: cleanFirst,
          last_name: cleanLast,
          email: cleanEmail,
          mobile_number: mobileNumber.trim(),
          password,
          branch_name: cleanBranch,
          branch_code: cleanBranchCode,
          timezone,
          plan: selectedPlan,
        },
        { timeout: 18000 }
      );

      const data = res.data;
      if (data?.token && data?.user) {
        login({
          ...data.user,
          token: data.token,
          active_tenant_id: data.user.tenant_id,
          active_branch_id: data.user.branch_id,
          demoMode: false,
        });
        navigate("/whatsapp", { replace: true });
        return;
      }

      setDoneMessage(data?.message || "Enterprise workspace created successfully!");
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      setError(msg || "Could not complete enterprise signup. Please review your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Submit Employee Activation with Access Code
  const handleJoinWithAccessCode = async (e) => {
    e?.preventDefault?.();
    setError("");

    const cleanCode = accessCode.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = `${firstName} ${lastName}`.trim() || firstName.trim();

    if (!cleanCode) return setError("Please enter your Workspace Access Code.");
    if (!cleanEmail) return setError("Please enter your Work Email.");
    if (!password) return setError("Please set a password for your employee account.");
    if (password.length < 6) return setError("Password must be at least 6 characters long.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

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
        login({
          ...data.user,
          token: data.token,
          active_tenant_id: data.user.tenant_id,
          active_branch_id: data.user.branch_id,
          demoMode: false,
        });
        navigate("/whatsapp", { replace: true });
        return;
      }

      setDoneMessage(data?.message || "Access verified! Your employee account is active.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not activate with this Access Code. Please check the code with your admin."
      );
    } finally {
      setLoading(false);
    }
  };

  // Submit Employee Request Access
  const handleRequestAccess = async (e) => {
    e?.preventDefault?.();
    setError("");

    const cleanName = `${firstName} ${lastName}`.trim() || firstName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanEmp = empId.trim() || department.trim();

    if (!cleanName) return setError("Please enter your Full Name.");
    if (!cleanEmail) return setError("Please enter your Work Email.");
    if (!cleanEmp) return setError("Please enter your Employee ID or Department.");

    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/auth/request-access`, {
        first_name: cleanName,
        email: cleanEmail,
        emp_id: cleanEmp,
      });
      setDoneMessage(data?.message || "Access request submitted. Your workspace admin has been notified.");
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
      const session = await startDirectDemoSession(API, "admin");
      login(session);
      navigate("/whatsapp", { replace: true });
    } catch (_) {
      setError("Failed to start sandbox session. Try normal sign in.");
    } finally {
      setDemoLoading(false);
    }
  };

  const currentPlanMeta = plans.find((p) => p.id === selectedPlan) || plans[2] || DEFAULT_PLANS[2];

  return (
    <div className="lp-auth" style={{ minHeight: "100dvh", padding: "24px 16px" }}>
      <div
        className="lp-auth-panel"
        style={{
          maxWidth: mode === "self_signup" ? (signupStep === 2 ? 800 : 680) : 480,
          transition: "max-width 0.25s ease-in-out",
        }}
      >
        <Link to="/" className="lp-auth-back">
          <ArrowLeft size={15} />
          Back to Home
        </Link>

        {/* Wordmark Header */}
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <Link to="/" className="flex items-center gap-2">
            <img src="/Group.png" alt="Madhura WhatsApp CRM" className="h-8 w-auto object-contain" />
          </Link>
          <button
            type="button"
            onClick={handleDemoAccess}
            disabled={demoLoading}
            className="hl-btn-secondary"
            style={{
              fontSize: 12,
              padding: "4px 9px",
              borderColor: "rgba(16, 185, 129, 0.4)",
              color: "#047857",
              background: "rgba(16, 185, 129, 0.08)",
            }}
          >
            <Zap size={13} className="text-emerald-600 fill-emerald-600" />
            <span>{demoLoading ? "Launching…" : "1-Click Demo"}</span>
          </button>
        </div>

        {doneMessage ? (
          <div>
            <h1 className="hl-title" style={{ marginBottom: 8 }}>Workspace Provisioned</h1>
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
              Your multi-tenant organization and initial branch are active. Sign in to launch the WhatsApp CRM dashboard.
            </p>
            <Link to="/login" className="hl-btn-primary" style={{ width: "100%", textAlign: "center" }}>
              Sign In to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <h1 className="hl-title" style={{ fontSize: 24, margin: "0 0 4px 0" }}>
              {mode === "self_signup"
                ? "Register Enterprise Workspace"
                : mode === "access_code"
                ? "Activate Employee Account"
                : "Request Workspace Access"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 18 }}>
              {mode === "self_signup"
                ? "Provision an isolated organization with multi-branch routing, Meta Embedded Signup & Razorpay wallets."
                : mode === "access_code"
                ? "Enter the Access Code issued by your workspace admin to activate your branch seat."
                : "Submit your employee details to request an invitation code from your organization administrators."}
            </p>

            {/* Mode Switcher Tabs */}
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
                  padding: "7px 10px",
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
                  gap: 5,
                }}
              >
                <Building2 size={13} />
                <span>New Organization</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("access_code");
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
                  background: mode === "access_code" ? "var(--color-paper, #ffffff)" : "transparent",
                  color: mode === "access_code" ? "var(--color-ink)" : "var(--color-ink-2)",
                  boxShadow: mode === "access_code" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <KeyRound size={13} />
                <span>Join with Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("request_access");
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
                  background: mode === "request_access" ? "var(--color-paper, #ffffff)" : "transparent",
                  color: mode === "request_access" ? "var(--color-ink)" : "var(--color-ink-2)",
                  boxShadow: mode === "request_access" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <Briefcase size={13} />
                <span>Request Access</span>
              </button>
            </div>

            {error && (
              <div role="alert" className="lp-auth-error" style={{ marginBottom: 18 }}>
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: NEW ENTERPRISE ORGANIZATION REGISTRATION */}
            {mode === "self_signup" && (
              <div>
                {/* Step Indicator */}
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                  <div
                    onClick={() => setSignupStep(1)}
                    className={`flex items-center gap-2 cursor-pointer text-xs font-bold ${
                      signupStep === 1 ? "text-emerald-700" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                        signupStep === 1
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      1
                    </span>
                    <span>Organization &amp; Admin</span>
                  </div>

                  <span className="text-gray-300">/</span>

                  <div
                    onClick={() => {
                      if (companyName && firstName && email && password) {
                        setSignupStep(2);
                      }
                    }}
                    className={`flex items-center gap-2 cursor-pointer text-xs font-bold ${
                      signupStep === 2 ? "text-emerald-700" : "text-gray-400"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                        signupStep === 2 ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      2
                    </span>
                    <span>Branch &amp; Plan Selection</span>
                  </div>
                </div>

                {signupStep === 1 ? (
                  /* STEP 1: ORGANIZATION DETAILS & ADMIN ACCOUNT */
                  <form onSubmit={handleProceedToBranchAndPlan} noValidate>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                      <div>
                        <label htmlFor="lp-company-name" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                          Organization Legal Name *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Building2 size={16} />
                          </div>
                          <input
                            id="lp-company-name"
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="e.g. Apex Global Solutions Pvt Ltd"
                            required
                            autoFocus
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="lp-industry" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                          Business Industry / Domain
                        </label>
                        <div className="relative">
                          <select
                            id="lp-industry"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                            className="hl-input w-full px-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20 bg-white"
                          >
                            {INDUSTRIES.map((ind) => (
                              <option key={ind} value={ind}>
                                {ind}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                      <div>
                        <label htmlFor="lp-first-name" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                          Admin First Name *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <User size={16} />
                          </div>
                          <input
                            id="lp-first-name"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            autoComplete="given-name"
                            className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="e.g. Rajesh"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="lp-last-name" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                          Last Name
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <User size={16} />
                          </div>
                          <input
                            id="lp-last-name"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            autoComplete="family-name"
                            className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="e.g. Kumar"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                      <div>
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

                      <div>
                        <label htmlFor="lp-mobile" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                          Official Contact Phone
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Phone size={16} />
                          </div>
                          <input
                            id="lp-mobile"
                            type="tel"
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                            className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="+91 98765 43210"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                      <div>
                        <label htmlFor="lp-pass" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                          Create Master Password *
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
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="hl-btn-primary w-full py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 rounded-xl shadow-sm transition hover:shadow cursor-pointer"
                      style={{
                        background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                        borderColor: "#047857",
                      }}
                    >
                      <span>Proceed to Branch &amp; Plan Configuration</span>
                      <ChevronRight size={16} />
                    </button>
                  </form>
                ) : (
                  /* STEP 2: MULTI-BRANCH SETUP & PLAN SELECTION */
                  <form onSubmit={handleSelfSignup} noValidate>
                    {/* Branch Configuration Card */}
                    <div className="bg-slate-50/80 border border-gray-200 rounded-xl p-3.5 mb-5">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-900 mb-1">
                        <GitBranch size={15} className="text-emerald-600" />
                        <span>Initialize Head Office Branch</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mb-3 leading-normal">
                        Your enterprise starts with an initial Head Office branch. You can add more regional branches (e.g. Bangalore, Delhi, Dubai) anytime.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1">
                          <label className="text-[11px] font-bold text-gray-700 block mb-1">Branch Code</label>
                          <input
                            type="text"
                            value={branchCode}
                            onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                            className="hl-input w-full px-2.5 py-1.5 text-xs font-mono font-bold"
                            placeholder="HQ-01"
                            required
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="text-[11px] font-bold text-gray-700 block mb-1">Branch Name</label>
                          <input
                            type="text"
                            value={branchName}
                            onChange={(e) => setBranchName(e.target.value)}
                            className="hl-input w-full px-2.5 py-1.5 text-xs font-medium"
                            placeholder="Head Office (Main)"
                            required
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="text-[11px] font-bold text-gray-700 block mb-1">Timezone</label>
                          <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="hl-input w-full px-2.5 py-1.5 text-xs bg-white"
                          >
                            {TIMEZONES.map((tz) => (
                              <option key={tz.value} value={tz.value}>
                                {tz.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Plan Selection */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <label className="hl-section-label block font-bold text-xs text-gray-700 m-0">
                          Select Messaging &amp; Branch Tier
                        </label>
                        <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          14-Day Full Access Trial
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                        {plans.map((p) => {
                          const isSelected = selectedPlan === p.id;
                          return (
                            <div
                              key={p.id}
                              onClick={() => setSelectedPlan(p.id)}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all relative flex flex-col justify-between ${
                                isSelected
                                  ? "border-emerald-600 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-500"
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
                                      className={`text-[8px] font-extrabold uppercase px-1 py-0.5 rounded ${
                                        isSelected
                                          ? "bg-emerald-600 text-white"
                                          : "bg-gray-100 text-gray-600"
                                      }`}
                                    >
                                      {p.badge}
                                    </span>
                                  )}
                                </div>
                                <div className={`text-sm font-extrabold ${isSelected ? "text-emerald-700" : "text-gray-900"}`}>
                                  {p.price}
                                </div>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-1">
                                {p.maxBranches} {p.maxBranches === 1 ? "Branch" : "Branches"} · {p.maxSenders} Nos
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Selected plan highlights */}
                      <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-2">
                          <Sparkles size={14} className="text-emerald-600 shrink-0" />
                          <span>{currentPlanMeta.name} Entitlements:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {currentPlanMeta.features?.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-700">
                              <Check size={13} className="text-emerald-600 shrink-0" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSignupStep(1)}
                        className="hl-btn-secondary px-4 py-2.5 text-xs font-bold rounded-xl"
                      >
                        ← Back
                      </button>

                      <button
                        type="submit"
                        disabled={loading}
                        className="hl-btn-primary flex-1 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 rounded-xl shadow-sm transition hover:shadow cursor-pointer"
                        style={{
                          background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                          borderColor: "#047857",
                        }}
                      >
                        {loading ? (
                          <span>Provisioning Multi-Tenant Architecture…</span>
                        ) : (
                          <>
                            <Building2 size={16} />
                            <span>Launch Enterprise Workspace Now</span>
                            <ChevronRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: JOIN WITH ACCESS CODE (EMPLOYEE ACTIVATION) */}
            {mode === "access_code" && (
              <form onSubmit={handleJoinWithAccessCode} noValidate>
                {/* Live verification card */}
                {verifiedCodeData && (
                  <div className="p-3 mb-4 rounded-xl flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold">
                        Valid Access Code for {verifiedCodeData.tenant_name || "Workspace"}
                      </div>
                      <div className="text-[11px] text-emerald-700 mt-0.5">
                        Assigned Branch:{" "}
                        <strong>{verifiedCodeData.branch_name || "Head Office"}</strong> · Role:{" "}
                        <strong>{verifiedCodeData.role || "Employee"}</strong>
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
                        Verifying code…
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
                    Format: 10-character code provided in your employee onboarding note.
                  </span>
                </div>

                <div className="mb-4">
                  <label htmlFor="join-email" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                    Your Assigned Work Email Address *
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
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="hl-input w-full pl-9 pr-3 py-2.5 text-sm transition focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="e.g. Rajesh Kumar"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                  <div>
                    <label htmlFor="join-pass" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                      Set Personal Password *
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
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
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
                    <span>Activating Employee Account…</span>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      <span>Activate Account &amp; Launch WhatsApp</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 3: REQUEST ACCESS (FOR EMPLOYEES WITHOUT CODE) */}
            {mode === "request_access" && (
              <form onSubmit={handleRequestAccess} noValidate>
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
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="hl-input w-full pl-9 pr-3 py-2.5 text-sm"
                      placeholder="e.g. Ramesh Patel"
                      required
                      autoFocus
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                  <div>
                    <label htmlFor="req-emp" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                      Employee ID *
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
                        placeholder="EMP-1029"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="req-dept" className="hl-section-label block mb-1.5 font-bold text-xs text-gray-700">
                      Target Branch / Department
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <GitBranch size={16} />
                      </div>
                      <input
                        id="req-dept"
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="hl-input w-full pl-9 pr-3 py-2.5 text-sm"
                        placeholder="e.g. Mumbai Sales Hub"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="hl-btn-primary w-full py-3 px-4 text-sm font-bold rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                    borderColor: "#047857",
                  }}
                >
                  {loading ? "Submitting Access Request…" : "Submit Access Request to Admin"}
                </button>
              </form>
            )}

            {/* Bottom Sign-In Link */}
            <div style={{ marginTop: 22, textAlign: "center", borderTop: "1px solid var(--color-line)", paddingTop: 14 }}>
              <p style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
                Already have an active account?{" "}
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
