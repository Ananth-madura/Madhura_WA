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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-100">Branch Readiness & Setup Checklist</h3>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete the 5 operating criteria to ensure full automated conversation routing and messaging.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/60">
            <div
              className={`h-full transition-all duration-500 ${
                isReady ? "bg-emerald-500" : completedCount >= 3 ? "bg-amber-500" : "bg-slate-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-300">
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
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                step.completed
                  ? "bg-emerald-950/20 border-emerald-800/40"
                  : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      step.completed ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                  {step.completed ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-400" />
                  )}
                </div>
                <h4 className="text-xs font-semibold text-slate-200">{step.title}</h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                {step.completed ? (
                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    Ready
                  </span>
                ) : (
                  <Link
                    to={step.link}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors group"
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
