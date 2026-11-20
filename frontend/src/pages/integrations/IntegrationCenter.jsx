import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Search,
  KeyRound,
  ShieldCheck,
  Zap,
  Globe,
  Sliders,
  Check
} from "lucide-react";

const INITIAL_INTEGRATIONS = [
  {
    id: "shopify",
    name: "Shopify",
    category: "E-Commerce",
    description: "Sync product catalogs, automate abandoned cart recovery, and dispatch shipping notifications.",
    status: "configured",
    version: "v2.4",
    icon: "🛍️"
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    category: "E-Commerce",
    description: "WordPress commerce connector for order creation, customer messaging, and catalog imports.",
    status: "available",
    version: "v1.8",
    icon: "🛒"
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "Payments",
    description: "Generate instant WhatsApp payment links, handle auto-settlement, and verify signed webhooks.",
    status: "configured",
    version: "v3.1",
    icon: "💳"
  },
  {
    id: "sheets",
    name: "Google Sheets",
    category: "Productivity",
    description: "Append inbound WhatsApp inquiries and campaign responses to spreadsheet rows in real time.",
    status: "available",
    version: "v2.0",
    icon: "📊"
  },
  {
    id: "hubspot",
    name: "HubSpot CRM",
    category: "CRM",
    description: "Synchronize WhatsApp conversation logs, lead stages, and contact profiles with HubSpot.",
    status: "available",
    version: "v1.5",
    icon: "🟠"
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "CRM",
    description: "Enterprise bi-directional sync for customer cases, lead routing, and WhatsApp campaign attribution.",
    status: "available",
    version: "v1.2",
    icon: "☁️"
  },
  {
    id: "zapier",
    name: "Zapier / Make",
    category: "Webhooks",
    description: "Trigger multi-app automated workflows via outbound webhooks with HMAC signature verification.",
    status: "configured",
    version: "v2.0",
    icon: "⚡"
  },
  {
    id: "rest_api",
    name: "Custom REST APIs",
    category: "Developer",
    description: "Direct REST API dispatches with scoped API keys, idempotency keys, and rate-limit headers.",
    status: "configured",
    version: "v2.0",
    icon: "🔌"
  }
];

const CATEGORIES = ["ALL", "E-Commerce", "Payments", "CRM", "Webhooks", "Developer"];

export default function IntegrationCenter() {
  const [integrations, setIntegrations] = useState(INITIAL_INTEGRATIONS);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState(null);
  const [notice, setNotice] = useState("");

  const filtered = integrations.filter((item) => {
    const matchesCat = selectedCategory === "ALL" || item.category === selectedCategory;
    const matchesQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const handleToggle = (id) => {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextStatus = item.status === "configured" ? "available" : "configured";
          return { ...item, status: nextStatus };
        }
        return item;
      })
    );
    setNotice("Integration settings updated successfully.");
    setTimeout(() => setNotice(""), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
                <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                <span>Madhura App Ecosystem</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Integration Center
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Connect external e-commerce systems, CRM databases, payment processors, and automated workflow triggers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/whatsapp/accounts"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-sm"
              >
                Meta Accounts
              </Link>
              <Link
                to="/platform/meta-tech-provider"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
              >
                Tech Provider
              </Link>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search integrations..."
                className="w-full px-3.5 py-2 pl-9 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {notice && (
          <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
        )}

        {/* Integration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isConfigured = item.status === "configured";
            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">{item.name}</h2>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isConfigured
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isConfigured ? "Connected" : "Available"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mt-2">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Version: {item.version}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggle(item.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer min-h-[36px] ${
                      isConfigured
                        ? "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    }`}
                  >
                    {isConfigured ? "Manage Settings" : "Connect"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
