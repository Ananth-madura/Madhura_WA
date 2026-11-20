import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Plus,
  Package,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Send,
  DollarSign
} from "lucide-react";

export default function WhatsAppCommerce() {
  const [activeTab, setActiveTab] = useState("catalogs"); // "catalogs" | "orders" | "payments"
  const [catalogs, setCatalogs] = useState([
    {
      id: "cat_001",
      name: "Main Retail Catalog 2026",
      metaCatalogId: "987654321012345",
      productCount: 148,
      currency: "INR",
      status: "SYNCED",
      lastSynced: "Today, 10:30 AM"
    },
    {
      id: "cat_002",
      name: "Diwali Special Collection",
      metaCatalogId: "987654321012346",
      productCount: 42,
      currency: "INR",
      status: "SYNCED",
      lastSynced: "Yesterday, 04:15 PM"
    }
  ]);

  const [orders, setOrders] = useState([
    {
      id: "ORD-9821",
      customer: "Aarav Sharma",
      phone: "+919876543210",
      amount: "₹2,499",
      items: "Premium Cotton Kurta (Size L)",
      status: "PAID",
      date: "Nov 19, 2026"
    },
    {
      id: "ORD-9822",
      customer: "Priya Nair",
      phone: "+919812345678",
      amount: "₹1,850",
      items: "Handmade Ceramic Vase",
      status: "PAYMENT_LINK_SENT",
      date: "Nov 19, 2026"
    }
  ]);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Conversational Commerce</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                WhatsApp Commerce &amp; Payments
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Synchronize Meta product catalogs, generate Razorpay payment links, and automate order notifications directly inside WhatsApp conversations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/billing"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-sm"
              >
                Billing &amp; Wallets
              </Link>
              <Link
                to="/whatsapp/flows"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
              >
                Commerce Flowbots
              </Link>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mt-6 border border-slate-200 max-w-md">
            <button
              type="button"
              onClick={() => setActiveTab("catalogs")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === "catalogs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Meta Catalogs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === "orders" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Recent Orders
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("payments")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === "payments" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Payment Gateway
            </button>
          </div>
        </div>

        {/* Tab 1: Meta Catalogs */}
        {activeTab === "catalogs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalogs.map((cat) => (
              <div key={cat.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{cat.name}</h2>
                      <span className="text-xs text-slate-500 font-mono">Catalog ID: {cat.metaCatalogId}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {cat.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block">Products</span>
                    <span className="font-bold text-slate-900 text-sm">{cat.productCount} items</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block">Currency</span>
                    <span className="font-bold text-slate-900 text-sm">{cat.currency}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Synced: {cat.lastSynced}</span>
                  <Link
                    to="/whatsapp/templates"
                    className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <span>Use in Template</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Orders */}
        {activeTab === "orders" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 tracking-wider uppercase">
                WhatsApp Orders &amp; Invoices
              </h2>
              <span className="text-xs text-slate-500">Real-time status updates</span>
            </div>

            <div className="divide-y divide-slate-100">
              {orders.map((ord) => (
                <div key={ord.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{ord.id}</span>
                      <span className="text-xs text-slate-600 font-medium">{ord.customer} ({ord.phone})</span>
                    </div>
                    <p className="text-xs text-slate-600">{ord.items}</p>
                    <span className="text-[11px] text-slate-400 font-mono">{ord.date}</span>
                  </div>

                  <div className="flex items-center gap-4 sm:self-center shrink-0">
                    <span className="text-sm font-bold text-slate-900">{ord.amount}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      ord.status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {ord.status}
                    </span>
                    <Link
                      to="/whatsapp"
                      className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                    >
                      Open Chat
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Payment Gateway */}
        {activeTab === "payments" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-6 h-6 text-emerald-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">Razorpay Payment Integration</h2>
                <p className="text-xs text-slate-600">Dispatches signed payment requests to customers inside WhatsApp chats.</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Payment Gateway Status:</span>
                <span className="font-bold text-emerald-700">Active &amp; Verified</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Webhook Signature Verification:</span>
                <span className="font-bold text-emerald-700">HMAC-SHA256 Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Auto Receipt Notice via WhatsApp:</span>
                <span className="font-bold text-emerald-700">Enabled</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
