import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Users,
  Phone,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Megaphone,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import BranchSetupChecklist from "../../components/branches/BranchSetupChecklist";
import { getBranchAnalytics } from "../../api/branches";

export default function BranchOverview() {
  const { activeBranch, senders, members, userRole } = useBranch();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadStats() {
      if (!activeBranch?.id) return;
      try {
        setLoading(true);
        const res = await getBranchAnalytics(activeBranch.id);
        if (res.success) {
          setAnalytics(res.analytics);
        }
      } catch (err) {
        console.warn("Notice loading branch analytics:", err?.message);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [activeBranch?.id]);

  if (!activeBranch) return null;

  const basePath = `/whatsapp/branches/${activeBranch.id}/${activeBranch.slug || "workspace"}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>{activeBranch.name} Dashboard</span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              {activeBranch.code}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time branch queue health, WhatsApp sender throughput, and active agent assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`${basePath}/inbox`}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
          >
            <MessageSquare size={14} />
            <span>Open Branch Inbox</span>
          </Link>
        </div>
      </div>

      {/* Setup Checklist Progress */}
      <BranchSetupChecklist branch={activeBranch} senders={senders} members={members} />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Conversations</span>
            <MessageSquare size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2 font-mono">
            {analytics?.openChats ?? (activeBranch.active_chats || 0)}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <TrendingUp size={12} />
            <span>Dedicated Branch Queue</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>WhatsApp Numbers</span>
            <Phone size={16} className="text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2 font-mono">{senders.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {senders.filter((s) => s.assignment_type === "dedicated").length} dedicated ·{" "}
            {senders.filter((s) => s.assignment_type === "shared").length} shared
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Branch Members</span>
            <Users size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2 font-mono">{members.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Manager: {activeBranch.manager?.name || "Unassigned"}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Avg Response SLA</span>
            <Clock size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-2 font-mono">
            {analytics?.avgResponseMinutes ? `${analytics.avgResponseMinutes}m` : "< 15m"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Target: 15 mins</div>
        </div>
      </div>

      {/* Quick Launch & Status Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connected Senders Widget */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Phone size={15} className="text-emerald-400" />
              WhatsApp Senders
            </h3>
            <Link
              to={`${basePath}/numbers`}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              <span>Manage</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {senders.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              <Phone size={24} className="mx-auto text-slate-600 mb-2" />
              <span>No WhatsApp numbers attached yet.</span>
              <div className="mt-3">
                <Link
                  to={`${basePath}/numbers`}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg inline-flex items-center gap-1.5"
                >
                  <Plus size={13} />
                  <span>Attach Sender</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {senders.map((s) => (
                <div
                  key={s.id || s.sender_id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-200 font-mono">
                      {s.display_phone_number || s.phone_number || `Sender #${s.sender_id}`}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {s.assignment_type === "dedicated" ? "Dedicated Number" : "Shared Tenant Number"}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Local Team Staff Widget */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Users size={15} className="text-amber-400" />
              Assigned Team Members
            </h3>
            <Link
              to={`${basePath}/employees`}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              <span>View All</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {members.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              <Users size={24} className="mx-auto text-slate-600 mb-2" />
              <span>No team members assigned.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {members.slice(0, 4).map((m) => (
                <div
                  key={m.id || m.user_id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-200">
                      {m.first_name ? `${m.first_name} ${m.last_name || ""}` : m.email}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 capitalize">
                      {m.role || "Branch Member"}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {m.status || "Active"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Operating Quick Shortcuts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck size={15} className="text-sky-400" />
              Operational Shortcuts
            </h3>
          </div>

          <div className="space-y-2">
            <Link
              to={`${basePath}/inbox`}
              className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between text-xs text-slate-200 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare size={15} className="text-emerald-400" />
                <span>Open Branch WhatsApp Inbox</span>
              </div>
              <ArrowRight size={13} className="text-slate-500 group-hover:text-emerald-400" />
            </Link>

            <Link
              to={`${basePath}/campaigns`}
              className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between text-xs text-slate-200 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Megaphone size={15} className="text-amber-400" />
                <span>Schedule Branch Campaign</span>
              </div>
              <ArrowRight size={13} className="text-slate-500 group-hover:text-amber-400" />
            </Link>

            <Link
              to={`${basePath}/settings`}
              className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between text-xs text-slate-200 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Clock size={15} className="text-purple-400" />
                <span>Operating Hours & Routing Rules</span>
              </div>
              <ArrowRight size={13} className="text-slate-500 group-hover:text-purple-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
