import React from "react";
import WhatsAppNav from "../components/WhatsAppNav";
import WhatsAppInteractiveReminders from "../components/WhatsAppInteractiveReminders";
import { Bell, Sparkles, Bot, Zap, ShieldCheck, CheckCircle2, Clock } from "lucide-react";

export default function WhatsAppReminders() {
  return (
    <div className="w-full pb-12 bg-slate-50 min-h-screen">
      {/* WhatsApp Subsystem Navigation Bar */}
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="mb-6 bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm flex items-center gap-1.5">
                <Sparkles size={12} />
                Multi-Dynamic & Personalized
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/30 text-emerald-100 border border-emerald-400/40 backdrop-blur-sm flex items-center gap-1.5">
                <Zap size={12} />
                Auto-Pilot Cadence Schedulers
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <Bell className="p-1.5 bg-white/20 rounded-xl" size={36} />
              <span>Interactive WhatsApp Reminders & Confirmations</span>
            </h1>
            <p className="text-amber-100 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
              Automate scheduled WhatsApp reminders with 5 dynamic tone personas, instant tag interpolation, 2-way interactive button gateways, and live 1-click CRM auto-updates across visits, invoices, proposals, and AMC renewals.
            </p>
          </div>

          {/* Quick Info Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0">
            <div className="bg-black/20 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center">
              <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider block">CRM Sync</span>
              <span className="text-sm font-black text-white flex items-center justify-center gap-1 mt-0.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>Automated</span>
              </span>
            </div>
            <div className="bg-black/20 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center">
              <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider block">Personas</span>
              <span className="text-sm font-black text-white flex items-center justify-center gap-1 mt-0.5">
                <Bot size={13} className="text-amber-300" />
                <span>5 Tones</span>
              </span>
            </div>
            <div className="bg-black/20 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider block">Gateways</span>
              <span className="text-sm font-black text-white flex items-center justify-center gap-1 mt-0.5">
                <ShieldCheck size={13} className="text-sky-300" />
                <span>Multi-Gated</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Reminders & Settings Workspace */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <WhatsAppInteractiveReminders />
      </div>
    </div>
  );
}
