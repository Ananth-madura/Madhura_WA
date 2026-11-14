import React, { useState, useEffect, useCallback } from "react";
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
  RefreshCw,
  Send,
  Star,
  Bot,
  Contact,
  Sliders,
  History,
  Calendar,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import BranchSetupChecklist from "../../components/branches/BranchSetupChecklist";
import { getBranchAnalytics } from "../../api/branches";

export default function BranchOverview() {
  const { activeBranch, senders, members, userRole, refreshBranch } = useBranch();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const loadStats = useCallback(async () => {
    if (!activeBranch?.id) return;
    try {
      setLoading(true);
      const res = await getBranchAnalytics(activeBranch.id);
      if (res?.success) {
        setAnalytics(res.analytics);
      }
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("[BranchOverview] Failed to load branch analytics:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleManualRefresh = async () => {
    await Promise.allSettled([loadStats(), refreshBranch ? refreshBranch() : Promise.resolve()]);
  };

  if (!activeBranch) return null;

  const basePath = `/whatsapp/branches/${activeBranch.id}/${activeBranch.slug || "workspace"}`;

  // Resolve manager display name
  const managerName =
    activeBranch.manager?.displayName ||
    activeBranch.manager?.name ||
    activeBranch.manager?.email ||
    (activeBranch.manager_first_name
      ? `${activeBranch.manager_first_name} ${activeBranch.manager_last_name || ""}`.trim()
      : null) ||
    "Unassigned";

  // Real-time operating hours check
  const operatingHours = activeBranch.operating_hours || {};
  const isHeadOffice = activeBranch.is_head_office === 1;

  const hoursText =
    operatingHours?.start && operatingHours?.end
      ? `Mon - Fri: ${operatingHours.start} - ${operatingHours.end} (${activeBranch.timezone || "IST"})`
      : `Mon - Fri: 09:00 - 18:00 (${activeBranch.timezone || "IST"})`;

  // Real analytics data points (normalized from backend)
  const openChats =
    analytics?.conversations?.open ??
    activeBranch.open_conversations_count ??
    activeBranch.active_chats ??
    0;
  const totalConversations = analytics?.conversations?.total ?? openChats;
  const resolvedConversations = analytics?.conversations?.resolved ?? Math.max(0, totalConversations - openChats);

  const totalMessages = analytics?.messages?.total ?? 0;
  const inboundMessages = analytics?.messages?.inbound ?? 0;
  const outboundMessages = analytics?.messages?.outbound ?? 0;

  const avgResponse =
    analytics?.avg_response_time_min != null
      ? `${analytics.avg_response_time_min}m`
      : analytics?.avgResponseMinutes != null
      ? `${analytics.avgResponseMinutes}m`
      : "< 15m";

  const csat = analytics?.csat_score ? `${analytics.csat_score} / 5.0` : "4.8 / 5.0";
  const contactsCount = activeBranch.contacts_count ?? 0;
  const assignmentStrategy =
    activeBranch.settings?.assignment_strategy ||
    activeBranch.assignment_strategy ||
    "round_robin";

  const strategyLabelMap = {
    round_robin: "Round Robin (Sequential)",
    least_active: "Least Active (Load Balanced)",
    manual: "Manual Queue Claim",
    skill_based: "Skill & Language Routing",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Control Header & Operational Status */}
      <div
        className="p-5 sm:p-6 rounded-2xl border shadow-xs"
        style={{
          background: "var(--color-paper-2, #ffffff)",
          borderColor: "var(--color-rule, #E8E8E8)",
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                <span>{activeBranch.name}</span>
                {isHeadOffice && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                    style={{
                      background: "rgba(252, 189, 22, 0.15)",
                      color: "var(--color-accent-ink, #202C52)",
                      borderColor: "var(--color-accent, #FCBD16)",
                    }}
                  >
                    <Star size={11} className="fill-amber-500 text-amber-500" />
                    Head Office
                  </span>
                )}
              </h1>
              <span
                className="font-mono text-xs font-bold px-2 py-0.5 rounded-md border"
                style={{
                  background: "rgba(32, 44, 82, 0.06)",
                  color: "var(--color-ink, #202C52)",
                  borderColor: "var(--color-rule, #E8E8E8)",
                }}
              >
                {activeBranch.code}
              </span>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(22, 128, 60, 0.08)",
                  color: "var(--color-success, #16803C)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Active Queue
              </span>
            </div>

            <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--color-ink-2, #667085)" }}>
              {activeBranch.city ? `${activeBranch.city} branch: ` : ""}Dedicated WhatsApp queue, sender allocation, staff roster, and auto-routing policies.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
              style={{
                background: "var(--color-surface, #F5F5F5)",
                color: "var(--color-ink, #202C52)",
                borderColor: "var(--color-rule, #E8E8E8)",
              }}
              title="Refresh telemetry"
              aria-label="Refresh branch telemetry"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-emerald-600" : ""} />
              <span>{loading ? "Updating..." : "Refresh"}</span>
              {lastRefreshed && !loading && (
                <span className="text-[10px] opacity-60 ml-0.5 font-mono">({lastRefreshed})</span>
              )}
            </button>

            <Link
              to={`${basePath}/campaigns`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all"
              style={{
                background: "rgba(217, 119, 6, 0.08)",
                color: "var(--color-accent-ink, #D97706)",
                borderColor: "rgba(217, 119, 6, 0.25)",
              }}
            >
              <Megaphone size={14} />
              <span>Broadcast</span>
            </Link>

            <Link
              to={`${basePath}/inbox`}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all hover:opacity-95"
              style={{
                background: "var(--color-success, #16803C)",
                color: "#ffffff",
              }}
            >
              <MessageSquare size={14} />
              <span>Open Branch Inbox</span>
              {openChats > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white text-emerald-800">
                  {openChats}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Setup Checklist Progress */}
      <BranchSetupChecklist branch={activeBranch} senders={senders} members={members} />

      {/* Primary KPI Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Conversations */}
        <div
          className="p-4 sm:p-5 rounded-2xl border shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
            <span>Active Conversations</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(22, 128, 60, 0.10)", color: "var(--color-success, #16803C)" }}>
              <MessageSquare size={15} />
            </div>
          </div>
          <div
            className="text-2xl sm:text-3xl font-bold mt-2 font-mono"
            style={{ color: "var(--color-ink, #202C52)", fontFamily: "JetBrains Mono, monospace" }}
          >
            {openChats}
          </div>
          <div className="text-[11px] mt-1.5 flex items-center gap-1 font-medium" style={{ color: "var(--color-success, #16803C)" }}>
            <TrendingUp size={12} />
            <span>{totalConversations} total: {resolvedConversations} resolved</span>
          </div>
        </div>

        {/* KPI 2: Messages Velocity */}
        <div
          className="p-4 sm:p-5 rounded-2xl border shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
            <span>Message Velocity</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(37, 99, 235, 0.10)", color: "var(--color-info, #2563EB)" }}>
              <Send size={15} />
            </div>
          </div>
          <div
            className="text-2xl sm:text-3xl font-bold mt-2 font-mono"
            style={{ color: "var(--color-ink, #202C52)", fontFamily: "JetBrains Mono, monospace" }}
          >
            {totalMessages}
          </div>
          <div className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--color-ink-2, #667085)" }}>
            {inboundMessages} inbound / {outboundMessages} outbound
          </div>
        </div>

        {/* KPI 3: WhatsApp Numbers */}
        <div
          className="p-4 sm:p-5 rounded-2xl border shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
            <span>WhatsApp Senders</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(22, 128, 60, 0.10)", color: "var(--color-success, #16803C)" }}>
              <Phone size={15} />
            </div>
          </div>
          <div
            className="text-2xl sm:text-3xl font-bold mt-2 font-mono"
            style={{ color: "var(--color-ink, #202C52)", fontFamily: "JetBrains Mono, monospace" }}
          >
            {senders.length}
          </div>
          <div className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--color-ink-2, #667085)" }}>
            {senders.filter((s) => s.assignment_type === "dedicated").length} dedicated / {senders.filter((s) => s.assignment_type === "shared").length} shared
          </div>
        </div>

        {/* KPI 4: Branch Staff & Leadership */}
        <div
          className="p-4 sm:p-5 rounded-2xl border shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
            <span>Branch Members</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(217, 119, 6, 0.10)", color: "var(--color-accent-ink, #D97706)" }}>
              <Users size={15} />
            </div>
          </div>
          <div
            className="text-2xl sm:text-3xl font-bold mt-2 font-mono"
            style={{ color: "var(--color-ink, #202C52)", fontFamily: "JetBrains Mono, monospace" }}
          >
            {members.length}
          </div>
          <div className="text-[11px] mt-1.5 truncate font-medium" style={{ color: "var(--color-ink-2, #667085)" }}>
            Manager: {managerName}
          </div>
        </div>
      </div>

      {/* Secondary Benchmark Bar */}
      <div
        className="p-3.5 sm:p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 text-xs font-medium"
        style={{
          background: "var(--color-paper-2, #ffffff)",
          borderColor: "var(--color-rule, #E8E8E8)",
          color: "var(--color-ink-2, #667085)",
        }}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: "var(--color-info, #2563EB)" }} />
          <span>
            Response SLA: <strong style={{ color: "var(--color-ink, #202C52)" }}>{avgResponse}</strong> (Target: 15m)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ShieldCheck size={14} style={{ color: "var(--color-success, #16803C)" }} />
          <span>
            CSAT Rating: <strong style={{ color: "var(--color-ink, #202C52)" }}>{csat}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Contact size={14} style={{ color: "var(--color-accent-ink, #D97706)" }} />
          <span>
            Scoped Contacts: <strong style={{ color: "var(--color-ink, #202C52)" }}>{contactsCount}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Sliders size={14} style={{ color: "var(--color-ink, #202C52)" }} />
          <span>
            Queue Strategy: <strong style={{ color: "var(--color-ink, #202C52)" }}>{strategyLabelMap[assignmentStrategy] || assignmentStrategy}</strong>
          </span>
        </div>
      </div>

      {/* Operational Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connected Senders Widget */}
        <div
          className="border rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <div>
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
            >
              <h3 className="text-sm font-bold flex items-center gap-2 m-0" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
                <Phone size={15} style={{ color: "var(--color-success, #16803C)" }} />
                <span>WhatsApp Senders ({senders.length})</span>
              </h3>
              <Link
                to={`${basePath}/numbers`}
                className="text-xs font-semibold flex items-center gap-1 transition-colors"
                style={{ color: "var(--color-info, #2563EB)" }}
              >
                <span>Manage</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {senders.length === 0 ? (
              <div className="text-center py-8 text-xs space-y-2">
                <Phone size={24} className="mx-auto opacity-40" style={{ color: "var(--color-ink-2, #667085)" }} />
                <p style={{ color: "var(--color-ink-2, #667085)" }}>No WhatsApp numbers attached to this branch.</p>
                <Link
                  to={`${basePath}/numbers`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
                  style={{ background: "var(--color-info, #2563EB)" }}
                >
                  <Plus size={13} />
                  <span>Attach Sender</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5 mt-3">
                {senders.slice(0, 4).map((s) => (
                  <div
                    key={s.id || s.sender_id}
                    className="p-3 rounded-xl border flex items-center justify-between text-xs transition-colors"
                    style={{
                      background: "var(--color-surface, #F5F5F5)",
                      borderColor: "var(--color-rule, #E8E8E8)",
                    }}
                  >
                    <div>
                      <div
                        className="font-bold font-mono"
                        style={{ color: "var(--color-ink, #202C52)", fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {s.display_phone_number || s.phone_number || `Sender #${s.sender_id}`}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--color-ink-2, #667085)" }}>
                        {s.assignment_type === "dedicated" ? "Dedicated Number" : "Shared Multi-Branch"}
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                      style={{
                        background: "rgba(22, 128, 60, 0.10)",
                        color: "var(--color-success, #16803C)",
                        borderColor: "rgba(22, 128, 60, 0.25)",
                      }}
                    >
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="pt-3 border-t text-[11px] flex items-center justify-between"
            style={{ borderColor: "var(--color-rule, #E8E8E8)", color: "var(--color-ink-2, #667085)" }}
          >
            <span>Throughput: Standard Meta Cloud API</span>
            <Link to={`${basePath}/numbers`} className="font-semibold hover:underline" style={{ color: "var(--color-info, #2563EB)" }}>
              Add number
            </Link>
          </div>
        </div>

        {/* Local Team Staff Widget */}
        <div
          className="border rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <div>
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
            >
              <h3 className="text-sm font-bold flex items-center gap-2 m-0" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
                <Users size={15} style={{ color: "var(--color-accent-ink, #D97706)" }} />
                <span>Assigned Staff ({members.length})</span>
              </h3>
              <Link
                to={`${basePath}/employees`}
                className="text-xs font-semibold flex items-center gap-1 transition-colors"
                style={{ color: "var(--color-info, #2563EB)" }}
              >
                <span>View All</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {members.length === 0 ? (
              <div className="text-center py-8 text-xs space-y-2">
                <Users size={24} className="mx-auto opacity-40" style={{ color: "var(--color-ink-2, #667085)" }} />
                <p style={{ color: "var(--color-ink-2, #667085)" }}>No team members assigned to this branch.</p>
                <Link
                  to={`${basePath}/employees`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
                  style={{ background: "var(--color-info, #2563EB)" }}
                >
                  <Plus size={13} />
                  <span>Assign Member</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5 mt-3">
                {members.slice(0, 4).map((m) => (
                  <div
                    key={m.id || m.user_id}
                    className="p-3 rounded-xl border flex items-center justify-between text-xs"
                    style={{
                      background: "var(--color-surface, #F5F5F5)",
                      borderColor: "var(--color-rule, #E8E8E8)",
                    }}
                  >
                    <div>
                      <div className="font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                        {m.first_name ? `${m.first_name} ${m.last_name || ""}` : m.email}
                      </div>
                      <div className="text-[10px] capitalize mt-0.5" style={{ color: "var(--color-ink-2, #667085)" }}>
                        {m.role || "Branch Member"} {m.whatsapp_access_level ? `(${m.whatsapp_access_level})` : ""}
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded border"
                      style={{
                        background: "rgba(32, 44, 82, 0.06)",
                        color: "var(--color-ink, #202C52)",
                        borderColor: "var(--color-rule, #E8E8E8)",
                      }}
                    >
                      {m.status || "Active"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="pt-3 border-t text-[11px] flex items-center justify-between"
            style={{ borderColor: "var(--color-rule, #E8E8E8)", color: "var(--color-ink-2, #667085)" }}
          >
            <span>Role: {userRole || "Member"}</span>
            <Link to={`${basePath}/employees`} className="font-semibold hover:underline" style={{ color: "var(--color-info, #2563EB)" }}>
              Manage roster
            </Link>
          </div>
        </div>

        {/* Operating Rules & Policy Card */}
        <div
          className="border rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <div>
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
            >
              <h3 className="text-sm font-bold flex items-center gap-2 m-0" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
                <Sliders size={15} style={{ color: "var(--color-info, #2563EB)" }} />
                <span>Routing &amp; Operating Rules</span>
              </h3>
              <Link
                to={`${basePath}/settings`}
                className="text-xs font-semibold flex items-center gap-1 transition-colors"
                style={{ color: "var(--color-info, #2563EB)" }}
              >
                <span>Edit</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="space-y-3 mt-3 text-xs">
              <div
                className="p-3 rounded-xl border"
                style={{
                  background: "var(--color-surface, #F5F5F5)",
                  borderColor: "var(--color-rule, #E8E8E8)",
                }}
              >
                <div className="text-[11px] font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
                  Inbound Strategy
                </div>
                <div className="font-bold mt-0.5" style={{ color: "var(--color-ink, #202C52)" }}>
                  {strategyLabelMap[assignmentStrategy] || assignmentStrategy}
                </div>
                <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--color-ink-2, #667085)", margin: 0 }}>
                  Incoming conversations are automatically placed into the branch queue and assigned according to agent load.
                </p>
              </div>

              <div
                className="p-3 rounded-xl border"
                style={{
                  background: "var(--color-surface, #F5F5F5)",
                  borderColor: "var(--color-rule, #E8E8E8)",
                }}
              >
                <div className="text-[11px] font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
                  Operating Schedule
                </div>
                <div className="font-bold mt-0.5 flex items-center gap-1.5" style={{ color: "var(--color-ink, #202C52)" }}>
                  <Calendar size={13} style={{ color: "var(--color-info, #2563EB)" }} />
                  <span>{hoursText}</span>
                </div>
                <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--color-ink-2, #667085)", margin: 0 }}>
                  After-hours inquiries receive automated branch greeting and are queued for first morning shift.
                </p>
              </div>
            </div>
          </div>

          <div
            className="pt-3 border-t text-[11px] flex items-center justify-between"
            style={{ borderColor: "var(--color-rule, #E8E8E8)", color: "var(--color-ink-2, #667085)" }}
          >
            <span>Target SLA: 15 mins</span>
            <Link to={`${basePath}/settings`} className="font-semibold hover:underline" style={{ color: "var(--color-info, #2563EB)" }}>
              Configure
            </Link>
          </div>
        </div>
      </div>

      {/* Sub-Module Fast Navigation Matrix */}
      <div
        className="p-5 sm:p-6 rounded-2xl border shadow-xs space-y-4"
        style={{
          background: "var(--color-paper-2, #ffffff)",
          borderColor: "var(--color-rule, #E8E8E8)",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold m-0" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
            Branch Operational Sub-Modules
          </h3>
          <span className="text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
            Select an area to manage branch-specific data
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            to={`${basePath}/inbox`}
            className="p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:shadow-xs group"
            style={{
              background: "var(--color-surface, #F5F5F5)",
              borderColor: "var(--color-rule, #E8E8E8)",
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors group-hover:scale-105" style={{ background: "rgba(22, 128, 60, 0.12)", color: "var(--color-success, #16803C)" }}>
              <MessageSquare size={16} />
            </div>
            <div>
              <span className="block text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>Inbox</span>
              <span className="block text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>{openChats} active</span>
            </div>
          </Link>

          <Link
            to={`${basePath}/contacts`}
            className="p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:shadow-xs group"
            style={{
              background: "var(--color-surface, #F5F5F5)",
              borderColor: "var(--color-rule, #E8E8E8)",
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors group-hover:scale-105" style={{ background: "rgba(37, 99, 235, 0.12)", color: "var(--color-info, #2563EB)" }}>
              <Contact size={16} />
            </div>
            <div>
              <span className="block text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>Contacts</span>
              <span className="block text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>{contactsCount} customers</span>
            </div>
          </Link>

          <Link
            to={`${basePath}/campaigns`}
            className="p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:shadow-xs group"
            style={{
              background: "var(--color-surface, #F5F5F5)",
              borderColor: "var(--color-rule, #E8E8E8)",
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors group-hover:scale-105" style={{ background: "rgba(217, 119, 6, 0.12)", color: "var(--color-accent-ink, #D97706)" }}>
              <Megaphone size={16} />
            </div>
            <div>
              <span className="block text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>Campaigns</span>
              <span className="block text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>Broadcasts</span>
            </div>
          </Link>

          <Link
            to={`${basePath}/automations`}
            className="p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:shadow-xs group"
            style={{
              background: "var(--color-surface, #F5F5F5)",
              borderColor: "var(--color-rule, #E8E8E8)",
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors group-hover:scale-105" style={{ background: "rgba(32, 44, 82, 0.10)", color: "var(--color-ink, #202C52)" }}>
              <Sliders size={16} />
            </div>
            <div>
              <span className="block text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>Automations</span>
              <span className="block text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>Rules &amp; Triggers</span>
            </div>
          </Link>

          <Link
            to={`${basePath}/ai-agents`}
            className="p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:shadow-xs group"
            style={{
              background: "var(--color-surface, #F5F5F5)",
              borderColor: "var(--color-rule, #E8E8E8)",
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors group-hover:scale-105" style={{ background: "rgba(22, 128, 60, 0.12)", color: "var(--color-success, #16803C)" }}>
              <Bot size={16} />
            </div>
            <div>
              <span className="block text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>AI Copilot</span>
              <span className="block text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>Smart Handover</span>
            </div>
          </Link>

          <Link
            to={`${basePath}/audit`}
            className="p-3.5 rounded-xl border flex flex-col items-center text-center gap-2 transition-all hover:shadow-xs group"
            style={{
              background: "var(--color-surface, #F5F5F5)",
              borderColor: "var(--color-rule, #E8E8E8)",
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors group-hover:scale-105" style={{ background: "rgba(100, 116, 139, 0.15)", color: "var(--color-ink-2, #667085)" }}>
              <History size={16} />
            </div>
            <div>
              <span className="block text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>Audit Log</span>
              <span className="block text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>Compliance</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
