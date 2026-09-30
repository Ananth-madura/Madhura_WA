import React from "react";
import WhatsAppNav from "../components/WhatsAppNav";
import WhatsAppInteractiveReminders from "../components/WhatsAppInteractiveReminders";
import { Bell, Sparkles, Bot, Zap, ShieldCheck, CheckCircle2, Clock } from "lucide-react";

export default function WhatsAppReminders() {
  return (
    <div className="w-full pb-12 min-h-screen" style={{ background: "var(--color-paper)", fontFamily: "var(--font-body)" }}>
      {/* WhatsApp Subsystem Navigation Bar */}
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="hl-card" style={{ padding: "var(--space-sm) var(--space-md)", marginBottom: "var(--space-sm)" }}>
        <div className="absolute right-0 top-0 w-96 h-96 pointer-events-none" style={{ background: "transparent" }} />
        <div className="hl-commandbar relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="hl-badge hl-badge-accent">
                <Sparkles size={12} />
                Multi-Dynamic & Personalized
              </span>
              <span className="hl-badge hl-badge-success">
                <Zap size={12} />
                Auto-Pilot Cadence Schedulers
              </span>
            </div>
            <h1 className="hl-title flex items-center gap-3">
              <Bell className="shrink-0" size={36} style={{ color: "var(--color-ink)" }} />
              <span>Interactive WhatsApp Reminders & Confirmations</span>
            </h1>
            <p className="hl-subtitle max-w-3xl leading-relaxed">
              Automate scheduled WhatsApp reminders with 5 dynamic tone personas, instant tag interpolation, 2-way interactive button gateways, and live 1-click CRM auto-updates across visits, invoices, proposals, and AMC renewals.
            </p>
          </div>

          {/* Quick Info Badges */}
          <div className="hl-kpis shrink-0" style={{ marginBottom: "0" }}>
            <div className="hl-kpi text-center">
              <span className="hl-kpi-label block">CRM Sync</span>
              <span className="hl-kpi-num flex items-center justify-center gap-1">
                <CheckCircle2 size={13} className="shrink-0" style={{ color: "var(--color-success)" }} />
                <span>Automated</span>
              </span>
            </div>
            <div className="hl-kpi text-center">
              <span className="hl-kpi-label block">Personas</span>
              <span className="hl-kpi-num flex items-center justify-center gap-1">
                <Bot size={13} className="shrink-0" style={{ color: "var(--color-focus)" }} />
                <span>5 Tones</span>
              </span>
            </div>
            <div className="hl-kpi text-center col-span-2 sm:col-span-1">
              <span className="hl-kpi-label block">Gateways</span>
              <span className="hl-kpi-num flex items-center justify-center gap-1">
                <ShieldCheck size={13} className="shrink-0" style={{ color: "var(--color-info)" }} />
                <span>Multi-Gated</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Reminders & Settings Workspace */}
      <div className="hl-card" style={{ padding: "var(--space-sm) var(--space-md)", overflowX: "auto" }}>
        <WhatsAppInteractiveReminders />
      </div>
    </div>
  );
}
