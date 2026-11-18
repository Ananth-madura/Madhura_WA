import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  ShieldCheck,
  FileText,
  Layers,
  Bot,
  Workflow,
  Calendar,
  CheckSquare,
  BarChart3,
  Settings,
  Activity,
} from "lucide-react";
import { campaignApi } from "../../api/campaigns";

// Single-source navigation: reuses existing /whatsapp/groups, /whatsapp/templates,
// /whatsapp/flows (Flowbots), and /whatsapp/automations rather than duplicating them.
const PRIMARY_TABS = [
  { to: "/dashboard/campaigns", label: "Campaigns", icon: LayoutDashboard, exact: true, badgeKey: "running" },
  { to: "/dashboard/campaigns/create", label: "New campaign", icon: PlusCircle },
  { to: "/whatsapp/groups", label: "Groups & segments", icon: Users, badgeKey: "segments" },
  { to: "/dashboard/campaigns/consent", label: "Consent & DNC", icon: ShieldCheck, badgeKey: "consents" },
  { to: "/whatsapp/templates", label: "Templates", icon: FileText, badgeKey: "templates" },
  { to: "/dashboard/campaigns/flows", label: "Meta Flows (Forms)", icon: Layers, badgeKey: "flows" },
  { to: "/whatsapp/flows", label: "Chatbot Flowbots", icon: Bot, badgeKey: "flowbots" },
  { to: "/whatsapp/automations", label: "Automations", icon: Workflow, badgeKey: "automations" },
  { to: "/dashboard/campaigns/calendar", label: "Schedule", icon: Calendar },
  { to: "/dashboard/campaigns/approvals", label: "Approvals", icon: CheckSquare, badgeKey: "approvals", alert: true },
  { to: "/dashboard/campaigns/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/campaigns/settings", label: "Governance", icon: Settings },
  { to: "/admin/campaigns", label: "Ops control", icon: Activity },
];

export default function CampaignSubNav({ onSummaryLoaded = null }) {
  const { pathname } = useLocation();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let active = true;
    campaignApi.getEcosystemSummary()
      .then((data) => {
        if (!active || !data || typeof data !== "object" || Array.isArray(data)) return;
        setSummary(data);
        if (typeof onSummaryLoaded === "function") onSummaryLoaded(data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [pathname, onSummaryLoaded]);

  const badgeValue = (key) => {
    if (!summary || !key) return null;
    const map = {
      running: summary.campaigns?.running || 0,
      segments: (summary.audiences?.groups || 0) + (summary.audiences?.segments || 0),
      consents: summary.audiences?.granted_consents || 0,
      templates: summary.templates?.approved || 0,
      flows: summary.whatsapp_flows?.published || 0,
      flowbots: summary.flowbots?.total || 0,
      automations: summary.automations?.total || summary.automations?.bindings || 0,
      approvals: summary.campaigns?.pending_approvals || 0,
    };
    const val = map[key];
    return val > 0 ? val : null;
  };

  return (
    <div className="bg-white border-b border-slate-300">
      <nav aria-label="Campaign modules" className="px-4 py-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.exact
              ? pathname === tab.to
              : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            const count = badgeValue(tab.badgeKey);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                  active
                    ? "bg-emerald-700 text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
                {count !== null && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold leading-none ${
                      active
                        ? "bg-white/20 text-white"
                        : tab.alert
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
