import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  Building2,
  Layers,
  Activity,
  Radio,
  FileText,
  HeartPulse,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  CreditCard,
  Lock
} from "lucide-react";

export default function PlatformAdminHub({ defaultTab = "tenants" }) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabs = [
    { id: "tenants", label: "Tenants & Organizations", icon: Building2 },
    { id: "subscriptions", label: "Plans & Subscriptions", icon: Layers },
    { id: "usage", label: "Platform Usage Ledger", icon: Activity },
    { id: "providers", label: "Meta Provider Health", icon: Radio },
    { id: "audit", label: "Security & Audit Trails", icon: ShieldCheck },
    { id: "health", label: "Infrastructure Health", icon: HeartPulse },
    { id: "support", label: "Support & Onboarding", icon: HelpCircle }
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Madhura Platform Administration</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Platform Administration Console
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Platform-wide governance across customer tenants, SaaS subscription tiers, immutable financial ledgers, and Meta provider health.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/platform/meta-tech-provider"
                className="px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-sm flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Meta Compliance Center</span>
              </Link>
              <Link
                to="/whatsapp"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
              >
                Open Workspace
              </Link>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto mt-6 pt-5 border-t border-slate-100 pb-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isSelected = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB CONTENT: TENANTS */}
        {activeTab === "tenants" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Active Tenant Organizations
              </h2>
              <span className="text-xs text-slate-500 font-medium">Tenant Data Isolation Enforced</span>
            </div>
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Apex Global Enterprises Ltd</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Tenant ID: 1 · Plan: Enterprise Scale · Branches: 3 · Active Numbers: 5
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  Active
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: SUBSCRIPTIONS */}
        {activeTab === "subscriptions" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                SaaS Subscription Tiers
              </h2>
              <Link to="/billing" className="text-xs text-emerald-700 font-bold hover:underline">
                Manage Plans
              </Link>
            </div>
            <p className="text-xs text-slate-600">
              Free Onboarding (₹0), Growth (₹3,999/mo), Enterprise Scale (₹8,999/mo), and Custom Agency tiers.
            </p>
          </div>
        )}

        {/* TAB CONTENT: USAGE */}
        {activeTab === "usage" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                System-Wide Usage Meter
              </h2>
              <span className="text-xs text-slate-500">Separated Meta vs Madhura Charges</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Messages Processed</span>
                <span className="text-base font-extrabold text-slate-900">1.48M</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Automation Steps</span>
                <span className="text-base font-extrabold text-slate-900">420K</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">AI Tokens</span>
                <span className="text-base font-extrabold text-slate-900">8.9M</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">API Calls</span>
                <span className="text-base font-extrabold text-slate-900">2.1M</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: PROVIDERS */}
        {activeTab === "providers" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
              Meta Graph API &amp; Webhook Gateways
            </h2>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900 block">Meta WhatsApp Cloud API Gateway (Graph v24.0)</span>
                <span className="text-slate-500">Latency: 112ms · Subscribed WABAs: Operational</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Healthy
              </span>
            </div>
          </div>
        )}

        {/* TAB CONTENT: AUDIT */}
        {activeTab === "audit" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
              Security Audit Trails
            </h2>
            <p className="text-xs text-slate-600">
              All credential modifications, PIN registrations, and WABA connections are recorded immutably in branch audit tables.
            </p>
          </div>
        )}

        {/* TAB CONTENT: HEALTH */}
        {activeTab === "health" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
              Infrastructure Clusters
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <span className="font-bold block">MySQL Database</span>
                <span className="text-[11px] text-emerald-700">Cluster Connected</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <span className="font-bold block">Redis / BullMQ Queue</span>
                <span className="text-[11px] text-emerald-700">Processing Active</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <span className="font-bold block">Cloudflare R2 Storage</span>
                <span className="text-[11px] text-emerald-700">Media Vault Active</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: SUPPORT */}
        {activeTab === "support" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
              Customer Onboarding &amp; Support Tickets
            </h2>
            <p className="text-xs text-slate-600">
              Direct engineering guidance for Meta Business Verification and official WhatsApp display name approvals.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
