import React from "react";
import { CheckCircle2, AlertCircle, ArrowRight, Phone, Users, Sliders, UserCheck, Building } from "lucide-react";
import { Link } from "react-router-dom";

export default function BranchSetupChecklist({ branch, senders = [], members = [], onAction }) {
  if (!branch) return null;

  const hasManager = Boolean(branch.manager_user_id || branch.manager_id || branch.manager?.id);
  const hasPhone = senders.length > 0;
  const hasTeam = members.length > 1; // More than just the manager or creator
  const hasProfile = Boolean(branch.name && branch.code && branch.city);
  const hasRouting = Boolean(
    branch.settings?.routing_configured ||
    branch.settings?.assignment_strategy ||
    branch.assignment_strategy
  );

  const steps = [
    {
      id: "profile",
      title: "Branch Profile",
      description: "Name, short code, city and business hours configured",
      completed: hasProfile,
      link: `/whatsapp/branches/${branch.id}/${branch.slug || "workspace"}/settings`,
      icon: Building,
      cta: "Review Settings",
    },
    {
      id: "manager",
      title: "Branch Manager",
      description: hasManager
        ? `Managed by ${branch.manager?.name || branch.manager?.email || "Branch Manager"}`
        : "Assign an authorized manager to lead branch operations",
      completed: hasManager,
      link: `/whatsapp/branches/${branch.id}/${branch.slug || "workspace"}/employees`,
      icon: UserCheck,
      cta: "Assign Manager",
    },
    {
      id: "phone",
      title: "WhatsApp Numbers",
      description: hasPhone
        ? `${senders.length} active Meta WhatsApp sender(s) attached`
        : "Attach a dedicated or shared WhatsApp number to this branch",
      completed: hasPhone,
      link: `/whatsapp/branches/${branch.id}/${branch.slug || "workspace"}/numbers`,
      icon: Phone,
      cta: "Connect Number",
    },
    {
      id: "team",
      title: "Team & Staff",
      description: hasTeam
        ? `${members.length} members with branch access privileges`
        : "Invite agents and team leads to handle customer conversations",
      completed: hasTeam,
      link: `/whatsapp/branches/${branch.id}/${branch.slug || "workspace"}/employees`,
      icon: Users,
      cta: "Add Members",
    },
    {
      id: "routing",
      title: "Inbound Routing & SLAs",
      description: hasRouting
        ? "Deterministic queue distribution & SLAs active"
        : "Set up auto-assignment, round-robin rules and business hours",
      completed: hasRouting,
      link: `/whatsapp/branches/${branch.id}/${branch.slug || "workspace"}/settings`,
      icon: Sliders,
      cta: "Configure Rules",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const percentage = Math.round((completedCount / steps.length) * 100);

  const isReady = completedCount === steps.length;
  const statusLabel = isReady
    ? "Connected & Operational"
    : completedCount >= 3
    ? "Action Needed"
    : "Setup Required";

  const statusColor = isReady
    ? "text-emerald-400 bg-emerald-950/60 border-emerald-700/60"
    : completedCount >= 3
    ? "text-amber-400 bg-amber-950/60 border-amber-700/60"
    : "text-rose-400 bg-rose-950/60 border-rose-700/60";

  return (
    <div
      className="p-5 shadow-sm transition-all"
      style={{
        background: "var(--color-paper-2, #ffffff)",
        border: "1px solid var(--color-rule, #E8E8E8)",
        borderRadius: "var(--radius-lg, 16px)",
      }}
    >
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b"
        style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
      >
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold m-0" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
              Branch Readiness &amp; Setup Checklist
            </h3>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-ink-2, #667085)", margin: 0 }}>
            Complete the 5 operating criteria to ensure full automated conversation routing and messaging.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 rounded-full h-2.5 overflow-hidden border" style={{ background: "var(--color-surface, #F5F5F5)", borderColor: "var(--color-rule, #E8E8E8)" }}>
            <div
              className={`h-full transition-all duration-500 ${
                isReady ? "bg-emerald-500" : completedCount >= 3 ? "bg-amber-500" : "bg-slate-400"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold" style={{ color: "var(--color-ink, #202C52)" }}>
            {completedCount}/{steps.length} ({percentage}%)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className="p-3.5 rounded-xl border transition-all flex flex-col justify-between"
              style={{
                background: step.completed ? "rgba(22, 128, 60, 0.05)" : "var(--color-surface, #F5F5F5)",
                borderColor: step.completed ? "rgba(22, 128, 60, 0.25)" : "var(--color-rule, #E8E8E8)",
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{
                      background: step.completed ? "rgba(22, 128, 60, 0.15)" : "rgba(100, 116, 139, 0.15)",
                      color: step.completed ? "var(--color-success, #16803C)" : "var(--color-ink-2, #667085)",
                    }}
                  >
                    <Icon size={14} />
                  </div>
                  {step.completed ? (
                    <CheckCircle2 size={16} style={{ color: "var(--color-success, #16803C)" }} />
                  ) : (
                    <AlertCircle size={16} style={{ color: "var(--color-accent-ink, #D97706)" }} />
                  )}
                </div>
                <h4 className="text-xs font-semibold m-0" style={{ color: "var(--color-ink, #202C52)" }}>
                  {step.title}
                </h4>
                <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--color-ink-2, #667085)" }}>
                  {step.description}
                </p>
              </div>

              <div
                className="mt-3 pt-2 border-t flex items-center justify-between"
                style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
              >
                {step.completed ? (
                  <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: "var(--color-success, #16803C)" }}>
                    Ready
                  </span>
                ) : (
                  <Link
                    to={step.link}
                    className="text-[11px] font-semibold flex items-center gap-1 transition-colors group"
                    style={{ color: "var(--color-info, #2563EB)" }}
                  >
                    <span>{step.cta}</span>
                    <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
