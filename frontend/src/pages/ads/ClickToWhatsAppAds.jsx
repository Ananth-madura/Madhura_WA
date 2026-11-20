import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Megaphone,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Plus,
  BarChart3,
  Users,
  MessageSquare,
  TrendingUp,
  Tag,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { API } from "../../config/api";
import { useEnterprise } from "../../context/EnterpriseContext";

export default function ClickToWhatsAppAds() {
  const { activeTenant, getHeaders } = useEnterprise();
  const [adAccounts, setAdAccounts] = useState([]);
  const [campaigns, setCampaigns] = useState([
    {
      id: "ad_camp_1",
      name: "Q4 Festive Diwali Promotion",
      metaCampaignId: "act_1082937419_camp_01",
      spendInr: 12500,
      conversationsStarted: 482,
      leadsGenerated: 138,
      costPerLeadInr: 90.57,
      status: "ACTIVE",
      headline: "Chat on WhatsApp for instant 20% off",
      targetSender: "+919757563106"
    },
    {
      id: "ad_camp_2",
      name: "Bangalore Real Estate Inquiries",
      metaCampaignId: "act_1082937419_camp_02",
      spendInr: 28400,
      conversationsStarted: 310,
      leadsGenerated: 94,
      costPerLeadInr: 302.12,
      status: "ACTIVE",
      headline: "Download Luxury Villa Brochure",
      targetSender: "+919757563106"
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
                <Megaphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Meta Ads Attribution</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Click-to-WhatsApp Ads &amp; Lead Capture
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Attribute inbound WhatsApp chats to specific Meta Ad Accounts, ingest referral context, and track conversation ROI.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/platform/meta-tech-provider"
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-sm"
              >
                Discovered Assets
              </Link>
              <Link
                to="/whatsapp/campaigns"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
              >
                Campaigns Center
              </Link>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Total Ad Spend</span>
              <span className="text-lg font-bold text-slate-900">₹40,900</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Ad Conversations</span>
              <span className="text-lg font-bold text-slate-900">792</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">CRM Leads Generated</span>
              <span className="text-lg font-bold text-emerald-700">232</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Avg Cost Per Lead</span>
              <span className="text-lg font-bold text-slate-900">₹176.29</span>
            </div>
          </div>
        </div>

        {/* Ad Campaigns Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 tracking-wider uppercase">
              Connected Meta Ad Campaigns
            </h2>
            <span className="text-xs text-slate-500">Real-time attribution &amp; referral tags</span>
          </div>

          <div className="divide-y divide-slate-100">
            {campaigns.map((ad) => (
              <div key={ad.id} className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{ad.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {ad.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">Headline: &quot;{ad.headline}&quot;</p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                    <span>Ad Account: {ad.metaCampaignId}</span>
                    <span>Target Number: {ad.targetSender}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 sm:self-center shrink-0">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Leads</span>
                    <span className="text-sm font-bold text-slate-900">{ad.leadsGenerated}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">CPL</span>
                    <span className="text-sm font-bold text-emerald-700">₹{ad.costPerLeadInr}</span>
                  </div>
                  <Link
                    to="/whatsapp/contacts"
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                  >
                    View Leads
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
