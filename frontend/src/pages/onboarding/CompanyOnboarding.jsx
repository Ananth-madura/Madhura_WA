import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Building2,
  Globe,
  Clock,
  Briefcase,
  FileText,
  Phone,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import { API } from "../../config";
import { useEnterprise } from "../../context/EnterpriseContext";

const CATEGORIES = [
  "Retail & Wholesale",
  "E-commerce",
  "Healthcare & Clinics",
  "Education & Coaching",
  "Real Estate & Construction",
  "Financial Services & Insurance",
  "Hospitality & Restaurants",
  "Logistics & Supply Chain",
  "Software & Technology",
  "Agencies & Consultancies",
  "Manufacturing",
  "Professional Services",
  "Other"
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST +4:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +8:00)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" }
];

export default function CompanyOnboarding() {
  const navigate = useNavigate();
  const { activeTenant } = useEnterprise();

  const [companyName, setCompanyName] = useState(activeTenant?.name || "");
  const [legalName, setLegalName] = useState(activeTenant?.legal_name || "");
  const [brandName, setBrandName] = useState(activeTenant?.brand_name || "");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [country, setCountry] = useState("India");
  const [timezone, setTimezone] = useState(activeTenant?.timezone || "Asia/Kolkata");
  const [gstin, setGstin] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (activeTenant?.name && !companyName) {
      setCompanyName(activeTenant.name);
      setLegalName(activeTenant.legal_name || activeTenant.name);
      setBrandName(activeTenant.brand_name || activeTenant.name);
    }
  }, [activeTenant]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanCompany = companyName.trim();
    if (!cleanCompany) {
      return setError("Please enter your Company or Organization Name.");
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/onboarding/company`, {
        company_name: cleanCompany,
        legal_name: legalName.trim() || cleanCompany,
        brand_name: brandName.trim() || cleanCompany,
        category,
        industry: category,
        country,
        timezone,
        gstin: gstin.trim().toUpperCase(),
        website: website.trim(),
        phone: phone.trim()
      });

      if (res.data?.success) {
        setSavedSuccess(true);
        setTimeout(() => {
          navigate("/onboarding/plan");
        }, 800);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not save company profile. Please review fields and retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Command Center</span>
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="mb-6 pb-5 border-b border-slate-100">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Step 2 of 10 : Workspace Profile</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Company &amp; Workspace Setup
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Configure your registered company name, operating timezone, and business domain for multi-branch routing.
            </p>
          </div>

          {error && (
            <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 mb-5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 mb-5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Company profile verified and saved. Continuing to subscription plan…</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="company-name" className="block text-xs font-bold text-slate-700 mb-1">
                Company Legal Name *
              </label>
              <input
                id="company-name"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Apex Global Solutions Pvt Ltd"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="legal-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Registered Legal Name
                </label>
                <input
                  id="legal-name"
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Official entity name"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="brand-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Trading / Brand Name
                </label>
                <input
                  id="brand-name"
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Customer-facing brand"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="business-category" className="block text-xs font-bold text-slate-700 mb-1">
                  Business Industry Category *
                </label>
                <select
                  id="business-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none transition"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="timezone-select" className="block text-xs font-bold text-slate-700 mb-1">
                  Operational Timezone *
                </label>
                <select
                  id="timezone-select"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none transition"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="gstin-input" className="block text-xs font-bold text-slate-700 mb-1">
                  GSTIN / Tax Registration (Optional)
                </label>
                <input
                  id="gstin-input"
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="29AAAAA0000A1Z5"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="website-input" className="block text-xs font-bold text-slate-700 mb-1">
                  Company Website (Optional)
                </label>
                <input
                  id="website-input"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between gap-3">
              <Link
                to="/onboarding"
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow hover:shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <span>{loading ? "Saving Profile…" : "Save & Proceed to Subscription"}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
