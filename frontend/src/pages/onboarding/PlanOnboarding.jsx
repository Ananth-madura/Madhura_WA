import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Layers,
  Check,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { API } from "../../config";
import { useEnterprise } from "../../context/EnterpriseContext";

const FALLBACK_PLANS = [
  {
    id: "free",
    name: "Free Onboarding",
    price_inr: 0,
    price: "₹0",
    billing: "Free plan",
    max_senders: 1,
    max_branches: 1,
    max_seats: 2,
    features: [
      "1 WhatsApp Business Number",
      "1 Head Office Branch",
      "2 Active Staff Seats",
      "5,000 Free Monthly Messages",
      "Meta Cloud API Direct Connection",
      "Shared Team Inbox"
    ]
  },
  {
    id: "growth",
    name: "Growth",
    price_inr: 3999,
    price: "₹3,999",
    billing: "/ 30 days",
    badge: "Most Popular",
    max_senders: 3,
    max_branches: 3,
    max_seats: 15,
    features: [
      "3 Concurrent WhatsApp Numbers",
      "3 Independent Regional Branches",
      "15 Staff Member Seats",
      "Meta Embedded Signup v4 Integration",
      "Automated Welcome & Drip Campaigns",
      "Interactive Flow Chatbots"
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise Scale",
    price_inr: 8999,
    price: "₹8,999",
    billing: "/ 30 days",
    badge: "Maximum Concurrency",
    max_senders: 10,
    max_branches: 10,
    max_seats: 50,
    features: [
      "10 Concurrent WhatsApp Numbers",
      "10 Branch Workspaces with Isolated Scopes",
      "50 Staff Member Seats",
      "Custom Webhooks & REST Dispatches",
      "Priority Cloud Concurrency Engine",
      "24/7 Dedicated Technical SLA"
    ]
  }
];

export default function PlanOnboarding() {
  const navigate = useNavigate();
  const { activeTenant } = useEnterprise();

  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState(activeTenant?.plan || "free");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    axios
      .get(`${API}/api/v2/billing/plans`, { timeout: 10000 })
      .then((res) => {
        if (!active) return;
        const live = res.data?.plans;
        if (Array.isArray(live) && live.length > 0) {
          const mapped = live.map((p) => ({
            ...p,
            price: "₹" + Number(p.price_inr).toLocaleString("en-IN"),
            billing: Number(p.price_inr) === 0 ? "Free plan" : "/ 30 days",
            features: Array.isArray(p.features) ? p.features : []
          }));
          setPlans(mapped);
          if (!mapped.some((p) => p.id === selectedPlanId)) {
            setSelectedPlanId(mapped[0]?.id || "free");
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setFetching(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSelectPlan = (planId) => {
    setSelectedPlanId(planId);
  };

  const handleConfirmPlan = () => {
    const chosen = plans.find((p) => p.id === selectedPlanId) || plans[0];
    if (Number(chosen.price_inr) > 0) {
      // Redirect to billing checkout with onboarding query
      navigate(`/whatsapp/billing?onboarding=1&plan=${encodeURIComponent(chosen.id)}`);
    } else {
      // Free plan directly advances to WhatsApp connection
      navigate("/onboarding/whatsapp/connect");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Command Center</span>
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Step 3 of 10 : Subscription Tier</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Select Workspace Capacity &amp; Plan
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Choose the WhatsApp numbers, branch workspaces, and staff seats needed for your organization.
              </p>
            </div>

            <div className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              No long-term contracts · Upgrade or cancel anytime
            </div>
          </div>

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {plans.map((p) => {
              const isSelected = selectedPlanId === p.id;
              const isPaid = Number(p.price_inr) > 0;

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPlan(p.id)}
                  className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-md"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-2.5 right-4 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                      {p.badge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-emerald-600 bg-emerald-600" : "border-slate-300"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-2xl font-extrabold text-slate-900">{p.price}</span>
                      <span className="text-xs text-slate-500">{p.billing}</span>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-2.5">
                      <div className="text-xs font-semibold text-slate-700">Entitlements:</div>
                      {p.features?.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100/80">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPlan(p.id);
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition ${
                        isSelected
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {isSelected ? "Selected Tier" : "Select Tier"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <Link
              to="/onboarding/company"
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              ← Back to Company Setup
            </Link>

            <button
              type="button"
              onClick={handleConfirmPlan}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow hover:shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <span>Confirm &amp; Proceed to WhatsApp Connection</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
