import React, { useState, useEffect, useCallback } from "react";
import { Megaphone, Plus, Search, Calendar, CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import api from "../../config/axios";

export default function BranchCampaigns() {
  const { activeBranch } = useBranch();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    if (!activeBranch?.id) return;
    try {
      setLoading(true);
      const res = await api
        .get(`/api/wa/campaigns?branchId=${activeBranch.id}`)
        .catch(() => null);
      if (res?.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.campaigns || [];
        setCampaigns(list);
      }
    } catch (err) {
      console.warn("Notice loading branch campaigns:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Megaphone size={22} className="text-emerald-400" />
            Branch Marketing & Broadcast Campaigns
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Meta WhatsApp template campaigns targeted to {activeBranch?.name} customer segments.
          </p>
        </div>

        <Link
          to="/whatsapp/campaigns"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
        >
          <Plus size={14} />
          <span>Launch Campaign</span>
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3 pl-4">Campaign Name</th>
              <th className="p-3">Meta Template</th>
              <th className="p-3">Recipients</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right pr-4">Scheduled Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Loading branch campaigns...
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No campaigns launched for this branch yet.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 pl-4 font-semibold text-slate-200">{c.name || "Broadcast"}</td>
                  <td className="p-3 font-mono text-emerald-400">{c.template_name || "marketing_offer"}</td>
                  <td className="p-3 font-mono text-slate-300">{c.recipients_count || c.total || 0}</td>
                  <td className="p-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {c.status || "Completed"}
                    </span>
                  </td>
                  <td className="p-3 text-right pr-4 text-slate-500 font-mono text-[11px]">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : "Active"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
