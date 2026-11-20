import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  Plus,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  GitBranch,
  Lock
} from "lucide-react";

export default function AgencyWorkspace() {
  const [clients, setClients] = useState([
    {
      id: "client_org_01",
      name: "Apex Healthcare Brands",
      wabasCount: 2,
      sendersCount: 4,
      monthlyMessages: "45,200",
      plan: "Agency Client Pro",
      status: "ACTIVE"
    },
    {
      id: "client_org_02",
      name: "BlueSky Real Estate Group",
      wabasCount: 1,
      sendersCount: 2,
      monthlyMessages: "18,400",
      plan: "Agency Client Growth",
      status: "ACTIVE"
    }
  ]);

  const [branding, setBranding] = useState({
    portalTitle: "Agency Client Portal",
    supportEmail: "support@agencypartner.com",
    whiteLabelActive: true
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
                <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                <span>Multi-Client Agency Command</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Agency &amp; White-Label Management
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Manage independent client workspaces, provision customer WABAs, share reusable campaign templates, and configure white-label branding.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/onboarding"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-sm"
              >
                Onboarding Center
              </Link>
              <button
                type="button"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                + Add Client Workspace
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Managed Clients</span>
              <span className="text-lg font-bold text-slate-900">{clients.length} Companies</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Active WABAs</span>
              <span className="text-lg font-bold text-slate-900">3 Portfolios</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Monthly Volume</span>
              <span className="text-lg font-bold text-emerald-700">63,600 Msgs</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">White-Label Branding</span>
              <span className="text-lg font-bold text-slate-900">Active</span>
            </div>
          </div>
        </div>

        {/* Client Workspaces List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 tracking-wider uppercase">
              Client Tenant Workspaces
            </h2>
            <span className="text-xs text-slate-500">Tenant-isolated credentials &amp; billing</span>
          </div>

          <div className="divide-y divide-slate-100">
            {clients.map((c) => (
              <div key={c.id} className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{c.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span>{c.wabasCount} WABA(s)</span>
                    <span>·</span>
                    <span>{c.sendersCount} Phone Number(s)</span>
                    <span>·</span>
                    <span>Volume: {c.monthlyMessages} msgs/mo</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:self-center shrink-0">
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                    {c.plan}
                  </span>
                  <Link
                    to="/whatsapp"
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                  >
                    Open Workspace
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
