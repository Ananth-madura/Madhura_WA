import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Radio,
  Users,
  Database,
  ArrowRight,
  ShieldCheck,
  Building2,
  Layers,
  Send
} from "lucide-react";
import { API } from "../../config";
import { useAuth } from "../../auth/AuthContext";
import { useEnterprise } from "../../context/EnterpriseContext";

export default function OnboardingComplete() {
  const { user } = useAuth();
  const { activeTenant } = useEnterprise();
  const navigate = useNavigate();

  const [completing, setCompleting] = useState(true);

  useEffect(() => {
    const markComplete = async () => {
      try {
        await axios.post(`${API}/api/onboarding/complete`, {}, { timeout: 8000 });
      } catch (_) {
        // Non-blocking completion
      } finally {
        setCompleting(false);
      }
    };
    markComplete();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm text-center space-y-8">
        {/* Celebration Badge */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 border-2 border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
          <Sparkles className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Workspace Activation Complete</span>
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome to Madhura WhatsApp CRM
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Your enterprise workspace is fully configured and ready for live operations. Your Meta WhatsApp Cloud API connection, verified senders, and company workspace are active.
          </p>
        </div>

        {/* Milestone Verification Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <div className="text-xs font-bold text-slate-900">Account</div>
            <div className="text-[11px] text-slate-500 font-medium">Verified Admin</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <div className="text-xs font-bold text-slate-900">Organization</div>
            <div className="text-[11px] text-slate-500 font-medium">Workspace Active</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <Radio className="w-4 h-4 text-emerald-600" />
            <div className="text-xs font-bold text-slate-900">Meta API</div>
            <div className="text-[11px] text-slate-500 font-medium">Cloud Webhook Live</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <Send className="w-4 h-4 text-emerald-600" />
            <div className="text-xs font-bold text-slate-900">Messaging</div>
            <div className="text-[11px] text-slate-500 font-medium">Verified wamid</div>
          </div>
        </div>

        {/* Primary Launch Action */}
        <div className="pt-2">
          <Link
            to="/whatsapp"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl shadow-md hover:shadow-lg transition w-full sm:w-auto"
          >
            <span>Launch Live Chats Workspace</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Next Quick Tasks */}
        <div className="pt-6 border-t border-slate-100 space-y-3 text-left">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Suggested Next Actions
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              to="/whatsapp/employees"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition flex items-center justify-between text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-slate-600 group-hover:text-emerald-600 transition" />
                <span className="font-semibold text-slate-800">Invite Team</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
            </Link>

            <Link
              to="/whatsapp/automations"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition flex items-center justify-between text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-slate-600 group-hover:text-emerald-600 transition" />
                <span className="font-semibold text-slate-800">Create Chatbot</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
            </Link>

            <Link
              to="/whatsapp/contacts"
              className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition flex items-center justify-between text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-slate-600 group-hover:text-emerald-600 transition" />
                <span className="font-semibold text-slate-800">Import Contacts</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
