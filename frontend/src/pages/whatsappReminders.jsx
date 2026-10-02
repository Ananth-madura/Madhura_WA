import React from "react";
import WhatsAppNav from "../components/WhatsAppNav";
import WhatsAppInteractiveReminders from "../components/WhatsAppInteractiveReminders";
import { Bell, Sparkles, Bot, Zap, ShieldCheck, CheckCircle2, Clock } from "lucide-react";

export default function WhatsAppReminders() {
  return (
    <div className="hl-page" style={{ background: "var(--color-paper)", fontFamily: "var(--font-body)" }}>
      {/* WhatsApp Subsystem Navigation Bar */}
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="hl-card" style={{ padding: "var(--space-sm) var(--space-md)", marginBottom: "var(--space-sm)" }}>
        <div className="hl-commandbar relative z-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="hl-badge hl-badge-accent">
                <Sparkles size={12} />
                Multi-Dynamic &amp; Personalized
              </span>
              <span className="hl-badge hl-badge-success">
                <Zap size={12} />
                Auto-Pilot Cadence Schedulers
              </span>
            </div>
            <h1 className="hl-title flex items-center gap-2 sm:gap-3">
              <Bell className="shrink-0" size={28} style={{ color: "var(--color-ink)" }} />
              <span>Interactive WhatsApp Reminders &amp; Confirmations</span>
            </h1>
            <p className="hl-subtitle max-w-3xl leading-relaxed">
              Automate scheduled WhatsApp reminders with 5 dynamic tone personas, instant tag interpolation, 2-way interactive button gateways, and live 1-click CRM auto-updates across visits, invoices, proposals, and AMC renewals.
            </p>
          </div>

          {/* Quick Info Badges */}
          <div className="hl-kpis" style={{ marginBottom: "0", width: "100%" }}>
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
            <div className="hl-kpi text-center">
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
      <div className="hl-card w-full min-w-0 overflow-x-auto" style={{ padding: "var(--space-sm) var(--space-md)" }}>
        <WhatsAppInteractiveReminders />
      </div>
    </div>
  );
}
