import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Layers,
  Radio,
  Send,
  Users,
  Database,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { API, MARKETING } from "../../config";
import { useAuth } from "../../auth/AuthContext";
import { useEnterprise } from "../../context/EnterpriseContext";

export default function OnboardingCommandCenter() {
  const { user } = useAuth();
  const { activeTenant, activeBranch } = useEnterprise();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusData, setStatusData] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/api/onboarding/status`, { timeout: 12000 });
      if (res.data?.success) {
        setStatusData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not retrieve onboarding progress. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const steps = statusData?.steps || [];
  const completedCount = statusData?.completedSteps || 0;
  const totalSteps = statusData?.totalSteps || 10;
  const progressPercent = statusData?.progress || 0;

  const getStepIcon = (key) => {
    switch (key) {
      case "account_verified":
        return <ShieldCheck className="w-5 h-5 text-emerald-600" />;
      case "company_profile":
        return <Building2 className="w-5 h-5 text-emerald-600" />;
      case "subscription_selected":
        return <Layers className="w-5 h-5 text-emerald-600" />;
      case "whatsapp_connected":
      case "number_registered":
      case "webhook_connected":
        return <Radio className="w-5 h-5 text-emerald-600" />;
      case "first_message":
        return <Send className="w-5 h-5 text-emerald-600" />;
      case "team_configured":
        return <Users className="w-5 h-5 text-emerald-600" />;
      case "crm_configured":
        return <Database className="w-5 h-5 text-emerald-600" />;
      case "automation_published":
        return <Sparkles className="w-5 h-5 text-emerald-600" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Strip */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="mb-4">
                <Link to="/onboarding" className="inline-block focus:outline-none">
                  <img src="/Group.png" alt="Madhura WhatsApp Automation" className="h-14 sm:h-[54px] w-auto object-contain" />
                </Link>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Madhura Enterprise Onboarding</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Workspace Activation Command Center
              </h1>
              <p className="text-sm text-slate-600 mt-1.5 max-w-2xl leading-relaxed">
                Complete these verified milestones to activate your multi-tenant WhatsApp Cloud API connection, configure team branches, and launch CRM automations.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchStatus}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh Status</span>
              </button>

              <Link
                to="/platform/meta-tech-provider"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Meta Tech Provider</span>
              </Link>

              <Link
                to="/whatsapp"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow hover:shadow-md transition"
              >
                <span>Live Workspace</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Progress Bar Strip */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
              <span>Overall Activation Progress</span>
              <span className="text-emerald-700 font-extrabold">{progressPercent}% Completed ({completedCount}/{totalSteps} Milestones)</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="flex-1">{error}</div>
            <button
              type="button"
              onClick={fetchStatus}
              className="text-xs font-bold underline hover:no-underline text-rose-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Steps Checklist Grid */}
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
              Authoritative Setup Milestones
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Every step reflects verified backend state
            </span>
          </div>

          {steps.map((step) => {
            const isCompleted = step.completed;
            const isActionRequired = step.status === "action_required";

            return (
              <div
                key={step.id}
                className={`p-5 sm:p-6 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isCompleted ? "bg-white" : isActionRequired ? "bg-amber-50/20" : "bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isCompleted
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : isActionRequired
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-slate-100 border-slate-200 text-slate-500"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      getStepIcon(step.key)
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-400">Step {step.id}</span>
                      <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>

                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          Completed
                        </span>
                      ) : isActionRequired ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 text-amber-700" />
                          Action Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                          Optional Setup
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-normal max-w-xl">
                      {step.description}
                    </p>

                    {step.evidence && (
                      <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">Verified Evidence:</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                          {step.evidence}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:self-center shrink-0 w-full sm:w-auto flex justify-end">
                  <Link
                    to={step.route}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition w-full sm:w-auto ${
                      isCompleted
                        ? "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow"
                    }`}
                  >
                    <span>{isCompleted ? "Review Step" : "Complete Step"}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Guidance */}
        <div className="p-6 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div>
            <span className="font-bold text-slate-800 block text-sm mb-0.5">Need help connecting Meta WhatsApp?</span>
            <p>Our dedicated onboarding engineers assist with Meta Business verification and number porting.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/terms"
              className="font-semibold text-slate-700 hover:text-slate-900 underline"
            >
              Terms of Service
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              to="/privacy"
              className="font-semibold text-slate-700 hover:text-slate-900 underline"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
