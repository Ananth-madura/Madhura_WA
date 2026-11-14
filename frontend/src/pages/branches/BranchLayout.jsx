import React, { useEffect } from "react";
import {
  Outlet,
  NavLink,
  useParams,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Phone,
  Megaphone,
  Bot,
  Sliders,
  Sparkles,
  BarChart3,
  Settings,
  History,
  ShieldAlert,
  Building2,
  Clock,
  Star,
  ChevronRight,
  Contact,
} from "lucide-react";
import { useBranch } from "../../context/BranchContext";
import { useEnterprise } from "../../context/EnterpriseContext";
import BranchSwitcher from "../../components/branches/BranchSwitcher";

export default function BranchLayout() {
  const { branchId, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTenant } = useEnterprise();
  const { activeBranch, loading, error, userRole } = useBranch();

  // If slug is outdated or mismatched, optionally redirect to canonical slug
  useEffect(() => {
    if (activeBranch && activeBranch.slug && slug !== activeBranch.slug) {
      const currentSubPath = location.pathname.split("/").slice(5).join("/") || "dashboard";
      navigate(`/whatsapp/branches/${branchId}/${activeBranch.slug}/${currentSubPath}`, {
        replace: true,
      });
    }
  }, [activeBranch, branchId, slug, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-400">Loading branch workspace context...</p>
      </div>
    );
  }

  if (error) {
    const isForbidden = error.status === 403;
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-950/60 border border-amber-800/80 flex items-center justify-center text-amber-400">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-100">
          {isForbidden ? "Branch Access Restricted" : "Branch Not Found"}
        </h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          {error.message ||
            (isForbidden
              ? "Your account does not possess membership or administrative permissions for this branch workspace."
              : "The requested branch does not exist or has been removed from this organization.")}
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/whatsapp/branches"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Return to Branch Directory
          </Link>
        </div>
      </div>
    );
  }

  const baseBranchUrl = `/whatsapp/branches/${branchId}/${activeBranch?.slug || slug || "workspace"}`;

  const navItems = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard, path: `${baseBranchUrl}/dashboard` },
    { id: "inbox", label: "Inbox", icon: MessageSquare, path: `${baseBranchUrl}/inbox` },
    { id: "contacts", label: "Contacts", icon: Contact, path: `${baseBranchUrl}/contacts` },
    { id: "employees", label: "Team & Roles", icon: Users, path: `${baseBranchUrl}/employees` },
    { id: "numbers", label: "WhatsApp Senders", icon: Phone, path: `${baseBranchUrl}/numbers` },
    { id: "campaigns", label: "Campaigns", icon: Megaphone, path: `${baseBranchUrl}/campaigns` },
    { id: "automations", label: "Automations", icon: Sliders, path: `${baseBranchUrl}/automations` },
    { id: "flows", label: "Chatbot Flows", icon: Bot, path: `${baseBranchUrl}/flows` },
    { id: "ai-agents", label: "AI Copilot", icon: Sparkles, path: `${baseBranchUrl}/ai-agents` },
    { id: "analytics", label: "Reports", icon: BarChart3, path: `${baseBranchUrl}/analytics` },
    { id: "settings", label: "Settings", icon: Settings, path: `${baseBranchUrl}/settings` },
    { id: "audit", label: "Audit Log", icon: History, path: `${baseBranchUrl}/audit` },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface, #F5F5F5)", color: "var(--color-ink, #202C52)" }}>
      {/* Branch Top Navigation & Context Bar */}
      <div
        className="sticky top-0 z-40 backdrop-blur-md border-b shadow-xs"
        style={{ background: "var(--color-paper-2, #ffffff)", borderColor: "var(--color-rule, #E8E8E8)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Breadcrumb & Identity */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Link
              to="/whatsapp/branches"
              className="transition-colors flex items-center gap-1 font-medium"
              style={{ color: "var(--color-ink-2, #667085)" }}
            >
              <Building2 size={13} style={{ color: "var(--color-ink-2, #667085)" }} />
              <span>{activeTenant?.name || "Company"}</span>
            </Link>
            <ChevronRight size={12} style={{ color: "var(--color-ink-2, #667085)", opacity: 0.6 }} />
            <Link
              to="/whatsapp/branches"
              className="transition-colors font-medium"
              style={{ color: "var(--color-ink-2, #667085)" }}
            >
              Branches
            </Link>
            <ChevronRight size={12} style={{ color: "var(--color-ink-2, #667085)", opacity: 0.6 }} />
            <span className="font-bold flex items-center gap-1.5" style={{ color: "var(--color-ink, #202C52)" }}>
              {activeBranch?.name}
              {activeBranch?.is_head_office === 1 && (
                <Star size={13} className="text-amber-500 fill-amber-500" title="Head Office" />
              )}
            </span>
            <span
              className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border"
              style={{
                background: "rgba(22, 128, 60, 0.10)",
                color: "var(--color-success, #16803C)",
                borderColor: "rgba(22, 128, 60, 0.25)",
              }}
            >
              {activeBranch?.code}
            </span>
          </div>

          {/* Quick Context & Switcher */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
              <Clock size={13} style={{ color: "var(--color-ink-2, #667085)" }} />
              <span>{activeBranch?.timezone || "Asia/Kolkata"}</span>
              <span>-</span>
              <span>
                Role: <strong className="capitalize font-semibold" style={{ color: "var(--color-success, #16803C)" }}>{userRole}</strong>
              </span>
            </div>

            <BranchSwitcher />
          </div>
        </div>

        {/* 12 Sub-Module Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto scrollbar-none flex gap-1 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                    isActive
                      ? "border-emerald-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20"
                      : "border-transparent hover:border-slate-300 opacity-70 hover:opacity-100"
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? "var(--color-success, #16803C)" : "var(--color-ink, #202C52)",
                })}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
