import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { MARKETING } from "../config/index";
import {
  CheckCircle2,
  ArrowLeft,
  Building2,
  Check,
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  GitBranch,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { API } from "../config/api";
import { useAuth } from "./AuthContext";
import { loginDestination } from "./loginDestination";
import { confirmBrowserSession } from "./browserSession";

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

const DEFAULT_PLANS = [
  {
    id: "free",
    name: "Free",
    price_inr: 0,
    price: "₹0",
    billing: "Free plan",
    features: [
      "1 WhatsApp Connected Number",
      "1 Workspace Branch",
      "2 Team Member Seats",
      "Standard Template Synchronization",
      "Cloud API Direct Sending"
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price_inr: 3999,
    price: "₹3,999",
    billing: "/ 30 days",
    badge: "Most Popular",
    features: [
      "3 WhatsApp Connected Numbers",
      "3 Workspace Branches",
      "15 Team Member Seats",
      "Multi-Agent Shared Inbox",
      "Drip Sequences and Broadcasts",
      "Visual Chatbot Flow Engine"
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price_inr: 8999,
    price: "₹8,999",
    billing: "/ 30 days",
    badge: "Scale",
    features: [
      "10 WhatsApp Connected Numbers",
      "10 Workspace Branches",
      "50 Team Member Seats",
      "Priority Cloud Concurrency",
      "Custom Webhooks & REST API",
      "Dedicated Technical Account Support"
    ],
  },
];

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: "self_signup" | "access_code"
  const [mode, setMode] = useState("self_signup");

  // Step for self_signup: 1 = Org & Identity, 2 = Branch & Plan
  const [signupStep, setSignupStep] = useState(1);

  // Self-signup form fields
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

  // Branch & Plan fields
  const [branchName, setBranchName] = useState("Head Office (Main)");
  const [branchCode, setBranchCode] = useState("HQ-01");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [selectedPlan, setSelectedPlan] = useState("free");

  // Employee Access Code mode
  const [accessCode, setAccessCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifiedCodeData, setVerifiedCodeData] = useState(null);
  const [codeError, setCodeError] = useState("");

  // Plans catalog
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [signupBackendReady, setSignupBackendReady] = useState(true);
  const [signupBackendNotice, setSignupBackendNotice] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  // UI state
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Read query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeParam = params.get("code");
    const tabParam = params.get("tab");
    const planParam = params.get("plan");
    if (codeParam) {
      setAccessCode(codeParam.toUpperCase());
      setMode("access_code");
    } else if (tabParam === "code" || tabParam === "access_code") {
      setMode("access_code");
    }
    if (planParam) {
      setSelectedPlan(planParam);
    }
  }, [location.search]);

  // Load plans catalog and backend health check
  useEffect(() => {
    let cancelled = false;
    setPlansLoading(true);
    setPlansError("");
    Promise.all([
      axios.get(`${API}/api/v2/billing/plans`, { timeout: 10000 }),
      axios.get(`${API}/health`, { timeout: 8000 }).catch(() => ({ data: { ok: true, dbEngine: "mysql" } }))
    ])
      .then(([planRes, healthRes]) => {
        if (cancelled) return;
        const live = planRes.data?.plans;
        const health = healthRes?.data;
        const catalogList = Array.isArray(live) && live.length > 0 ? live : DEFAULT_PLANS;
        const mapped = catalogList.map((p) => ({
          ...p,
          price: p.price || `₹${Number(p.price_inr || 0).toLocaleString("en-IN")}`,
          billing: Number(p.price_inr) === 0 ? "Free plan" : "/ 30 days",
          features: Array.isArray(p.features) ? p.features : []
        }));
        setPlans(mapped);
        setSelectedPlan((current) => mapped.some((p) => p.id === current) ? current : (mapped.find((p) => Number(p.price_inr) === 0) || mapped[0]).id);

        if (health?.dbEngine?.startsWith("sqlite")) {
          setSignupBackendReady(false);
          setSignupBackendNotice("Plans are loaded. New workspace signup and Razorpay settlement require MySQL. Connect your MySQL server and restart the backend to continue.");
        } else {
          const ready = Boolean(health?.ok === true || health?.database === "ready" || health?.demo === true);
          setSignupBackendReady(ready);
          if (!ready) setSignupBackendNotice("Plans are loaded, but the backend database is not ready for new workspaces yet. Check readiness and retry.");
          else setSignupBackendNotice("");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPlans([]);
        setPlansError("Plans could not load. The configured API could not be reached.");
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [catalogAttempt]);

  // Live Access Code Verification
  useEffect(() => {
    const cleanCode = accessCode.trim().toUpperCase();
    setCodeError("");
    if (cleanCode.length >= 6) {
      let cancelled = false;
      setVerifyingCode(true);
      const timer = setTimeout(() => {
        axios.post(`${API}/api/auth/verify-access-code`, { access_code: cleanCode }, { timeout: 6000 })
          .then((res) => {
            if (!cancelled && res.data?.valid) {
              setVerifiedCodeData(res.data);
              if (res.data.email) setEmail(res.data.email);
              if (res.data.first_name) setFirstName(res.data.first_name);
            }
          })
          .catch((err) => {
            if (!cancelled) {
              setVerifiedCodeData(null);
              setCodeError(err.response?.data?.message || "Invalid access code.");
            }
          })
          .finally(() => {
            if (!cancelled) setVerifyingCode(false);
          });
      }, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } else {
      setVerifiedCodeData(null);
      setVerifyingCode(false);
    }
  }, [accessCode]);

  // Handle Step 1 Proceed
  const handleProceedToStep2 = (e) => {
    e?.preventDefault?.();
    setError("");

    const cleanCompany = (companyName || legalName).trim();
    const cleanFirst = firstName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanCompany) return setError("Please enter your company or organization name.");
    if (!cleanFirst) return setError("Please enter your first name.");
    if (!cleanEmail) return setError("Please enter your work email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return setError("Please enter a valid work email address.");
    }
    if (!password) return setError("Please create a password.");
    if (password.length < 6) return setError("Password must be at least 6 characters long.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    if (!branchName || branchName === "Head Office (Main)") {
      setBranchName(`${cleanCompany} Head Office`);
    }

    setSignupStep(2);
  };

  // Submit complete signup
  const handleSelfSignup = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (loading) return;
    if (!signupBackendReady) return setError(signupBackendNotice || "The backend is not ready for workspace signup yet.");
    if (!plans.some((p) => p.id === selectedPlan)) return setError("Wait for the current plan catalog or retry loading plans.");

    const cleanCompany = (companyName || legalName).trim();
    const cleanLegal = (legalName || companyName).trim();
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
          legal_name: cleanLegal,
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
      if ((data?.token || data?.cookieSession) && data?.user) {
        await confirmBrowserSession(data);
        login({
          ...data.user,
          cookieSession: Boolean(data.cookieSession || data.user?.cookieSession),
          token: data.token,
          active_tenant_id: data.user.tenant_id,
          active_branch_id: data.user.branch_id,
          demoMode: false,
        });
        const dest = loginDestination(data, location.search);
        navigate(dest, { replace: true });
        return;
      }

      setDoneMessage(data?.message || "Enterprise workspace created successfully!");
    } catch (err) {
      const msg = err.friendlyMessage || err.response?.data?.message || err.response?.data?.error;
      setError(msg || "Could not complete registration. Please review your details and retry.");
    } finally {
      setLoading(false);
    }
  };

  // Submit access code activation
  const handleJoinWithAccessCode = async (e) => {
    e?.preventDefault?.();
    if (loading) return;
    setError("");

    const cleanCode = accessCode.trim().toUpperCase();
    if (!cleanCode) return setError("Please enter your access code.");
    if (!password) return setError("Please enter your password.");
    if (verifiedCodeData?.requires_activation !== false) {
      if (password.length < 6) return setError("Password must be at least 6 characters.");
      if (password !== confirmPassword) return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/api/auth/join-with-access-code`,
        {
          access_code: cleanCode,
          email: verifiedCodeData?.email || email.trim().toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          password,
        },
        { timeout: 15000 }
      );

      const data = res.data;
      if ((data?.token || data?.cookieSession) && data?.user) {
        await confirmBrowserSession(data);
        login({
          ...data.user,
          cookieSession: Boolean(data.cookieSession || data.user?.cookieSession),
          token: data.token,
          active_tenant_id: data.user.tenant_id,
          active_branch_id: data.user.branch_id,
          demoMode: false,
        });
        const dest = loginDestination(data, location.search);
        navigate(dest, { replace: true });
        return;
      }

      setDoneMessage("Account activated! You can now sign in.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not activate account with this code.");
    } finally {
      setLoading(false);
    }
  };

  const isFreePlan = selectedPlan === "free" || Number(plans.find((p) => p.id === selectedPlan)?.price_inr || 0) === 0;

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto w-full max-w-5xl">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <a
            href={MARKETING}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#202C52] hover:text-[#050E2F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] rounded-md px-1 py-0.5"
          >
            <ArrowLeft className="w-4 h-4 text-[#202C52]" />
            <span>Back to Home</span>
          </a>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#16803C] bg-[#E8F5E9] border border-[#C8E6C9] px-3 py-1 rounded-full uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-[#16803C]" />
              <span>Official Meta Tech Provider</span>
            </span>
          </div>
        </div>

        {/* Main Grid: Info Hero + Signup Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Platform Value Highlights (Yellow x Navy Corporate SaaS Theme) */}
          <div className="hidden lg:flex lg:col-span-4 flex-col justify-between p-8 rounded-3xl bg-[#202C52] text-white shadow-[0_8px_30px_rgba(32,44,82,0.18)] border border-[#050E2F] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-[#FCBD16]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FCBD16] text-[#202C52] flex items-center justify-center font-extrabold text-lg shadow-sm">
                  M
                </div>
                <div>
                  <span className="text-base font-extrabold text-white tracking-tight">Madhura</span>
                  <span className="text-xs text-[#FCBD16] block font-semibold">Enterprise SaaS</span>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-white leading-tight">
                  Launch Your WhatsApp Operating System
                </h2>
                <p className="text-xs text-slate-200 mt-2 leading-relaxed">
                  Join hundreds of scaling businesses running high-concurrency WhatsApp messaging, sales routing, and automated lead capture.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="p-3.5 rounded-2xl bg-[#2B385F] border border-[#FCBD16]/20 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#FCBD16]">
                    <Check className="w-4 h-4 text-[#FCBD16]" />
                    <span>Meta Cloud API Integration</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Direct integration without third-party middleware markups or latency bottlenecks.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#2B385F] border border-[#FCBD16]/20 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#FCBD16]">
                    <Check className="w-4 h-4 text-[#FCBD16]" />
                    <span>Visual Interactive Flowbots</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Drag-and-drop conversation builders with buttons, lists, and CRM field synchronization.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#2B385F] border border-[#FCBD16]/20 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#FCBD16]">
                    <Check className="w-4 h-4 text-[#FCBD16]" />
                    <span>Multi-Branch Scopes</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Manage stores, cities, and regional offices from one unified administrative console.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#2B385F] text-[11px] text-slate-300 space-y-1 relative z-10">
              <span className="font-semibold text-white block">Enterprise Security Guarantee</span>
              <p>End-to-end data isolation, role-based controls, and SOC2 compliant audit logging.</p>
            </div>
          </div>

          {/* Right Column: Interactive Signup Card */}
          <div className="lg:col-span-8 bg-white p-6 sm:p-10 rounded-3xl border border-[#E8E8E8] shadow-[0_4px_24px_rgba(32,44,82,0.06)] flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <a href={MARKETING} className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] rounded-md">
                  <img src="/Group.png" alt="Madhura WhatsApp Automation" className="h-14 sm:h-[60px] w-auto object-contain" />
                </a>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#202C52] bg-[#FFF4CC] border border-[#FCBD16]/40 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  <GitBranch className="w-3 h-3 text-[#202C52]" />
                  <span>Multi-Tenant v2</span>
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-[#202C52] tracking-tight">
                Create Enterprise Workspace
              </h1>
              <p className="text-xs text-[#667085] mt-1 mb-6 leading-relaxed">
                Multi-tenant WhatsApp Cloud API, shared team inbox, broadcast campaigns, and visual flowbots.
              </p>

              {/* Mode Switcher */}
              <div className="flex bg-[#F5F5F5] p-1.5 rounded-2xl mb-6 border border-[#E8E8E8]" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "self_signup"}
                  onClick={() => {
                    setMode("self_signup");
                    setError("");
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] ${
                    mode === "self_signup"
                      ? "bg-white text-[#202C52] shadow-sm border border-[#E8E8E8]"
                      : "text-[#667085] hover:text-[#202C52]"
                  }`}
                >
                  <Building2 className="w-4 h-4 text-[#202C52]" />
                  <span>New Company Workspace</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "access_code"}
                  onClick={() => {
                    setMode("access_code");
                    setError("");
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] ${
                    mode === "access_code"
                      ? "bg-white text-[#202C52] shadow-sm border border-[#E8E8E8]"
                      : "text-[#667085] hover:text-[#202C52]"
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-[#202C52]" />
                  <span>Join with Access Code</span>
                </button>
              </div>

              {/* Feedback Alerts */}
              {error && (
                <div role="alert" className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </div>
              )}
              {doneMessage && (
                <div role="status" className="mb-5 p-3.5 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] text-[#16803C] text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16803C] mt-0.5" />
                  <div className="flex-1 leading-relaxed">{doneMessage}</div>
                </div>
              )}

              {/* MODE 1: SELF SIGNUP */}
              {mode === "self_signup" && (
                <div>
                  {/* Stepper Header */}
                  <div className="flex items-center justify-between mb-6 border-b border-[#E8E8E8] pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        signupStep === 1 ? "bg-[#202C52] text-white" : "bg-[#FFF4CC] text-[#202C52] border border-[#FCBD16]"
                      }`}>
                        1
                      </span>
                      <span className={`text-xs font-semibold ${signupStep === 1 ? "text-[#202C52]" : "text-[#667085]"}`}>
                        Company &amp; Owner Profile
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#98A2B3]" />
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        signupStep === 2 ? "bg-[#202C52] text-white" : "bg-[#F5F5F5] text-[#667085] border border-[#E8E8E8]"
                      }`}>
                        2
                      </span>
                      <span className={`text-xs font-semibold ${signupStep === 2 ? "text-[#202C52]" : "text-[#667085]"}`}>
                        Branch &amp; Subscription Plan
                      </span>
                    </div>
                  </div>

                  {/* STEP 1: ORGANIZATION & ADMINISTRATOR PROFILE */}
                  {signupStep === 1 && (
                    <form onSubmit={handleProceedToStep2} noValidate className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="company-name" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            Organization Legal Name *
                          </label>
                          <input
                            id="company-name"
                            type="text"
                            value={legalName || companyName}
                            onChange={(e) => {
                              setCompanyName(e.target.value);
                              setLegalName(e.target.value);
                            }}
                            placeholder="e.g. Acme Retail Private Limited"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none transition-colors"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="industry-select" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            Industry Sector *
                          </label>
                          <select
                            id="industry-select"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] bg-white focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none transition-colors"
                          >
                            {INDUSTRIES.map((ind) => (
                              <option key={ind} value={ind}>{ind}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="first-name" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            First Name *
                          </label>
                          <input
                            id="first-name"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="John"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none transition-colors"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="last-name" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            Last Name
                          </label>
                          <input
                            id="last-name"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Doe"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="work-email" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            Work Email Address *
                          </label>
                          <input
                            id="work-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none transition-colors"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="mobile-number" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            Mobile Phone Number
                          </label>
                          <input
                            id="mobile-number"
                            type="tel"
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="signup-password" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            Create Master Password *
                          </label>
                          <div className="relative">
                            <input
                              id="signup-password"
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="At least 6 characters"
                              className="w-full px-3.5 pr-10 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none transition-colors"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#98A2B3] hover:text-[#202C52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] rounded cursor-pointer"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="confirm-password" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            Confirm Password *
                          </label>
                          <div className="relative">
                            <input
                              id="confirm-password"
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Repeat password"
                              className="w-full px-3.5 pr-10 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none transition-colors"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#98A2B3] hover:text-[#202C52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] rounded cursor-pointer"
                              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          className="w-full py-2.5 px-4 rounded-xl bg-[#202C52] hover:bg-[#050E2F] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors min-h-[44px] cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16]"
                        >
                          <span>Proceed to Branch &amp; Subscription Plan</span>
                          <ChevronRight className="w-4 h-4 text-[#FCBD16]" />
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STEP 2: BRANCH & SUBSCRIPTION PLAN */}
                  {signupStep === 2 && (
                    <form onSubmit={handleSelfSignup} noValidate className="space-y-5">
                      <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-2xl p-4 space-y-3">
                        <h2 className="text-xs font-bold text-[#202C52] uppercase tracking-wider">
                          Initial Workspace Branch
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label htmlFor="branch-name" className="block text-[11px] font-bold text-[#202C52] mb-1">
                              Branch Name
                            </label>
                            <input
                              id="branch-name"
                              type="text"
                              value={branchName}
                              onChange={(e) => setBranchName(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none"
                            />
                          </div>
                          <div>
                            <label htmlFor="branch-code" className="block text-[11px] font-bold text-[#202C52] mb-1">
                              Branch Code
                            </label>
                            <input
                              id="branch-code"
                              type="text"
                              value={branchCode}
                              onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-[#D0D5DD] text-[#202C52] font-mono focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none"
                            />
                          </div>
                          <div>
                            <label htmlFor="timezone-select" className="block text-[11px] font-bold text-[#202C52] mb-1">
                              Timezone
                            </label>
                            <select
                              id="timezone-select"
                              value={timezone}
                              onChange={(e) => setTimezone(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-[#D0D5DD] text-[#202C52] bg-white focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none"
                            >
                              {TIMEZONES.map((tz) => (
                                <option key={tz.value} value={tz.value}>{tz.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Plan Cards */}
                      <div>
                        <label className="block text-xs font-bold text-[#202C52] mb-2.5">
                          Select Subscription Plan
                        </label>

                        {plansError && (
                          <div className="mb-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                            <span>{plansError}</span>
                            <button
                              type="button"
                              onClick={() => setCatalogAttempt((c) => c + 1)}
                              className="text-xs font-bold text-amber-800 underline hover:no-underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] rounded"
                            >
                              Retry plans
                            </button>
                          </div>
                        )}

                        {signupBackendNotice && (
                          <div className="mb-3 p-3.5 rounded-xl bg-[#FFF4CC] border border-[#FCBD16] text-[#202C52] text-xs font-medium">
                            {signupBackendNotice}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          {plans.map((p) => {
                            const isSelected = selectedPlan === p.id;
                            return (
                              <div
                                key={p.id}
                                onClick={() => setSelectedPlan(p.id)}
                                className={`p-4 rounded-2xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                                  isSelected
                                    ? "border-2 border-[#202C52] bg-[#FFF4CC]/30 shadow-md ring-2 ring-[#FCBD16]/50"
                                    : "border-[#E8E8E8] bg-white hover:border-[#202C52]/40"
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="font-bold text-[#202C52] flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        role="radio"
                                        aria-label={p.name}
                                        name="subscription_plan"
                                        checked={isSelected}
                                        onChange={() => setSelectedPlan(p.id)}
                                        className="text-[#202C52] focus:ring-[#FCBD16] w-3.5 h-3.5 cursor-pointer"
                                      />
                                      <span>{p.name}</span>
                                    </label>
                                    {p.badge && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FCBD16] text-[#202C52]">
                                        {p.badge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-base font-extrabold text-[#202C52] mt-1">
                                    {p.price}
                                    <span className="text-[11px] font-normal text-[#667085] ml-1">/{p.billing || "mo"}</span>
                                  </div>
                                  <ul className="mt-3 space-y-1.5 text-[11px] text-[#667085]">
                                    {p.features?.slice(0, 4).map((f, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <Check className="w-3.5 h-3.5 text-[#16803C] shrink-0 mt-0.5" />
                                        <span>{f}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="mt-4 pt-2.5 border-t border-[#E8E8E8] flex items-center justify-between">
                                  <span className={`text-[11px] font-bold ${isSelected ? "text-[#202C52]" : "text-[#667085]"}`}>
                                    {isSelected ? "Selected" : "Choose Plan"}
                                  </span>
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-[#16803C]" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-3">
                        <button
                          type="button"
                          onClick={() => setSignupStep(1)}
                          className="py-2.5 px-4 rounded-xl border border-[#D0D5DD] bg-white hover:bg-[#F5F5F5] text-[#202C52] text-xs font-bold transition-colors min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16]"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loading || !signupBackendReady || plans.length === 0}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-[#202C52] hover:bg-[#050E2F] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors min-h-[44px] cursor-pointer shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16]"
                        >
                          {loading ? (
                            <span>Initializing Workspace...</span>
                          ) : isFreePlan ? (
                            <span>Create free workspace</span>
                          ) : (
                            <span>Create account &amp; continue to payment</span>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* MODE 2: ACCESS CODE ACTIVATION */}
              {mode === "access_code" && (
                <form onSubmit={handleJoinWithAccessCode} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-[#FFF4CC] border border-[#FCBD16]/50 text-xs text-[#202C52] leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-[#202C52]">
                      <KeyRound className="w-4 h-4 text-[#202C52]" />
                      <span>Team Member Invitation</span>
                    </div>
                    Enter the code provided by your organization supervisor to link your account to your branch.
                  </div>

                  <div>
                    <label htmlFor="join-code" className="block text-xs font-bold text-[#202C52] mb-1.5">
                      Access Code *
                    </label>
                    <input
                      id="join-code"
                      type="text"
                      maxLength={14}
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      placeholder="e.g. AC-9B21-48"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] font-mono focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none"
                      required
                    />
                  </div>

                  {verifyingCode && (
                    <p className="text-xs text-[#667085] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#FCBD16] animate-spin" />
                      <span>Verifying code validity...</span>
                    </p>
                  )}

                  {codeError && (
                    <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                      {codeError}
                    </div>
                  )}

                  {verifiedCodeData && (
                    <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E8E8E8] text-xs text-[#202C52] space-y-1">
                      <div className="font-semibold text-[#202C52] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" />
                        <span>Valid Access Code for {verifiedCodeData.tenant_name || verifiedCodeData.company_name}</span>
                      </div>
                      <div className="text-[#667085] text-[11px]">
                        Role: <span className="font-medium text-[#202C52]">{verifiedCodeData.role_name || "Team Member"}</span> | Branch: <span className="font-medium text-[#202C52]">{verifiedCodeData.branch_name || "Main"}</span>
                      </div>
                    </div>
                  )}

                  {verifiedCodeData?.requires_activation !== false ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="join-password" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            Set Personal Password *
                          </label>
                          <input
                            id="join-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="join-confirm-password" className="block text-xs font-bold text-[#202C52] mb-1.5">
                            Confirm Password *
                          </label>
                          <input
                            id="join-confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none"
                            required
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading || Boolean(codeError) || !verifiedCodeData}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#202C52] hover:bg-[#050E2F] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors min-h-[44px] cursor-pointer shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16]"
                      >
                        {loading ? "Activating Account..." : "Activate account & open workspace"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="join-password" className="block text-xs font-bold text-[#202C52] mb-1.5">
                          Your Existing Password *
                        </label>
                        <input
                          id="join-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D0D5DD] text-[#202C52] focus-visible:ring-2 focus-visible:ring-[#FCBD16] focus-visible:border-[#202C52] focus-visible:outline-none"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading || Boolean(codeError) || !verifiedCodeData}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#202C52] hover:bg-[#050E2F] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors min-h-[44px] cursor-pointer shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16]"
                      >
                        {loading ? "Signing in..." : "Sign in to your organization"}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>

            {/* Bottom Login Link */}
            <div className="mt-8 pt-5 border-t border-[#E8E8E8] flex items-center justify-between flex-wrap gap-2 text-xs text-[#667085]">
              <p>
                Already have an enterprise workspace?{" "}
                <Link to="/login" className="text-[#202C52] font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] rounded px-1">
                  Sign In
                </Link>
              </p>

              <div className="flex items-center gap-3 text-[11px]">
                <Link to="/terms" className="text-[#667085] hover:text-[#202C52] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] rounded">Terms</Link>
                <Link to="/privacy" className="text-[#667085] hover:text-[#202C52] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCBD16] rounded">Privacy</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
