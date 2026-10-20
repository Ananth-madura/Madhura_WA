import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import React from "react";
import WhatsAppInteractiveReminders from "../components/WhatsAppInteractiveReminders";
import { Bell } from "lucide-react";

export default function WhatsAppReminders() {
  return (
    <div className="hl-page" style={{ background: "var(--color-paper)", fontFamily: "var(--font-body)" }}>
      <WAWorkspaceGuide section="reminders" />
      <div className="hl-commandbar hl-card wa-reminders-heading flex items-center gap-3" style={{ padding: "var(--space-sm) var(--space-md)" }}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center" style={{ background: "var(--color-ink)", color: "var(--color-paper-2)", borderRadius: "var(--radius-card)" }}>
          <Bell size={21} />
        </div>
        <div className="min-w-0">
          <h1 className="hl-title">Reminders &amp; confirmations</h1>
          <p className="hl-subtitle">Schedule WhatsApp messages, review reminder settings, and manage customer replies.</p>
        </div>
      </div>

      {/* Main Interactive Reminders & Settings Workspace */}
      <div className="hl-card w-full min-w-0 overflow-x-auto" style={{ padding: "var(--space-sm) var(--space-md)" }}>
        <WhatsAppInteractiveReminders workspace />
      </div>
    </div>
  );
}
