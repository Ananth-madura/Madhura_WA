import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  Layers,
  Calendar,
  CheckSquare,
  BarChart3,
  Settings,
  Activity,
} from "lucide-react";
import useWorkspaceAccess from "../../hooks/useWorkspaceAccess";
import { campaignApi } from "../../api/campaigns";

// Shows only campaign-specific sub-views. Shared modules (Groups, Templates,
// Flowbots, Automations) live in the main WhatsApp sidebar to avoid duplication.
const CAMPAIGN_TABS = [
  { to: "/whatsapp/campaigns", alias: "/dashboard/campaigns", label: "Campaigns", icon: LayoutDashboard, exact: true, badgeKey: "running" },
  { to: "/whatsapp/campaigns/create", alias: "/dashboard/campaigns/create", label: "New campaign", icon: PlusCircle },
  { to: "/whatsapp/campaigns/consent", alias: "/dashboard/campaigns/consent", label: "Consent & DNC", icon: ShieldCheck, badgeKey: "consents" },
  { to: "/whatsapp/campaigns/flows", alias: "/dashboard/campaigns/flows", label: "Meta Forms", icon: Layers, badgeKey: "flows" },
  { to: "/whatsapp/campaigns/calendar", alias: "/dashboard/campaigns/calendar", label: "Schedule", icon: Calendar },
  { to: "/whatsapp/campaigns/approvals", alias: "/dashboard/campaigns/approvals", label: "Approvals", icon: CheckSquare, badgeKey: "approvals", alert: true },
  { to: "/whatsapp/campaigns/analytics", alias: "/dashboard/campaigns/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/whatsapp/campaigns/settings", alias: "/dashboard/campaigns/settings", label: "Governance", icon: Settings, adminOnly: true },
  { to: "/admin/campaigns", label: "Ops control", icon: Activity, adminOnly: true },
];

export default function CampaignSubNav({ onSummaryLoaded = null }) {
  const { pathname } = useLocation();
  const { admin } = useWorkspaceAccess();
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
      consents: summary.audiences?.granted_consents || 0,
      flows: summary.whatsapp_flows?.published || 0,
      approvals: summary.campaigns?.pending_approvals || 0,
    };
    const val = map[key];
    return val > 0 ? val : null;
  };

  const visibleTabs = CAMPAIGN_TABS.filter((tab) => !tab.adminOnly || admin);

  const isTabActive = (tab) => {
    const paths = [tab.to, tab.alias].filter(Boolean);
    return paths.some((p) => (tab.exact ? pathname === p : pathname === p || pathname.startsWith(`${p}/`)));
  };

  return (
    <div
      className="hl-card overflow-x-auto"
      style={{
        padding: "8px 12px",
        borderRadius: "10px",
        border: "1px solid var(--color-border, #e4e7ed)",
        background: "#ffffff",
      }}
    >
      <nav aria-label="Campaign modules" className="flex items-center gap-1.5 min-w-max">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab);
          const count = badgeValue(tab.badgeKey);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? "page" : undefined}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              style={
                active
                  ? { background: "#202C52", color: "#FFFFFF" }
                  : { background: "transparent", color: "#202C52" }
              }
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
              {count !== null && (
                <span
                  className="px-1.5 py-0.5 rounded text-[11px] font-bold leading-none"
                  style={
                    active
                      ? { background: "#FCBD16", color: "#202C52" }
                      : tab.alert
                      ? { background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }
                      : { background: "#F1F3F7", color: "#202C52" }
                  }
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
