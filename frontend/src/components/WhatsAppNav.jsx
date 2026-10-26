import { useNavigate, useLocation } from "react-router-dom";
import useWorkspaceAccess from "../hooks/useWorkspaceAccess";
import { useAuth } from "../auth/AuthContext";
import {
  MessageCircle,
  FileText,
  Users,
  Send,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Zap,
  Zap as AutomationIcon,
  Smartphone,
  UserCheck,
  GitBranch,
  Inbox,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API } from "../config/api";
import socket from "../socket/socket";

export default function WhatsAppNav() {
  // The rail is shared by every role. Which tabs appear is resolved from the
  // administrator's per-module grants, so a member only ever sees routes the
  // backend will actually serve them.
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, canView } = useWorkspaceAccess();
  const { user } = useAuth();
  // A campaigns-only employee has no inbox at all — the backend refuses their
  // chat requests, so do not offer a tab that can only fail.
  const inboxBlocked = !admin && (user?.whatsapp_access_level || "full") === "campaign_only";
  const [showTestModal, setShowTestModal] = useState(false);
  const [status, setStatus] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hello! This is a test message from Madhura Tech WhatsApp CRM.");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [stopping, setStopping] = useState(false);
  const [stopResult, setStopResult] = useState(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API}/api/whatsapp/unread-count`, { headers });
      const val = Number(data?.totalUnread || 0);
      setTotalUnread((prev) => (prev === val ? prev : val));
    } catch {}
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.get(`${API}/api/whatsapp/unified-status`, { headers });
      } catch (e1) {
        res = await axios.get(`/api/whatsapp/unified-status`, { headers });
      }
      if (res && res.data) {
        setStatus((prev) => {
          if (
            prev &&
            prev.connected === res.data.connected &&
            prev.phone === res.data.phone &&
            prev.isCloud === res.data.isCloud &&
            prev.isWeb === res.data.isWeb
          ) {
            return prev;
          }
          return res.data;
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Session status and organization-wide unread totals are administrator
    // signals: the backend refuses them for members, and their unread lives on
    // the shared inbox rather than on the session engine.
    if (!admin) return undefined;
    fetchStatus();
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchStatus();
      fetchUnreadCount();
    }, 10000);

    const handleRealtime = () => {
      fetchUnreadCount();
      fetchStatus();
    };

    socket.on("wa_message_received", handleRealtime);
    socket.on("wa_message", handleRealtime);
    socket.on("wa_chat_read", handleRealtime);
    socket.on("wa_ready", handleRealtime);
    socket.on("wa_disconnected", handleRealtime);

    return () => {
      clearInterval(interval);
      socket.off("wa_message_received", handleRealtime);
      socket.off("wa_message", handleRealtime);
      socket.off("wa_chat_read", handleRealtime);
      socket.off("wa_ready", handleRealtime);
      socket.off("wa_disconnected", handleRealtime);
    };
  }, [admin, fetchStatus, fetchUnreadCount]);

  const handleTestSend = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.post(`${API}/api/whatsapp/test-send`, { phone: testPhone.trim(), message: testMessage.trim() }, { headers });
      } catch (e1) {
        res = await axios.post(`/api/whatsapp/test-send`, { phone: testPhone.trim(), message: testMessage.trim() }, { headers });
      }
      setTestResult({ success: true, message: `🎉 Sent successfully via ${res.data.engineUsed || 'WhatsApp Engine'}!` });
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || err.message || "Failed to send test message" });
    }
    setTestLoading(false);
  };

  const handleStopAll = async () => {
    if (!window.confirm("Stop ALL running campaigns and disable ALL automations right now?\n\nThis cancels every active bulk send and turns off every automation rule. You can restart them individually afterwards.")) {
      return;
    }
    setStopping(true);
    setStopResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [campRes, autoRes] = await Promise.all([
        axios.post(`${API}/api/wa/campaigns/stop-all`, {}, { headers }).catch(() => ({ data: { stopped: 0 } })),
        axios.post(`${API}/api/wa/automations/stop-all`, {}, { headers }).catch(() => ({ data: { stopped: 0 } })),
      ]);
      setStopResult({
        success: true,
        message: `Stopped ${campRes.data.stopped || 0} campaign(s) and disabled ${autoRes.data.stopped || 0} automation(s).`,
      });
    } catch (err) {
      setStopResult({ success: false, message: "Failed to stop everything — try again." });
    }
    setStopping(false);
    setTimeout(() => setStopResult(null), 6000);
  };

  const tabs = [
    { id: "team-inbox", label: "Team Inbox", title: "Assigned conversations and shared notes", path: "/whatsapp/team-inbox", icon: Inbox },
    { id: "workspace", label: "My workspace", title: "Customers, leads, pipeline and follow-ups", path: "/whatsapp/workspace", icon: Users, exact: true, module: "customers" },
    {
      id: "chats",
      // Administrators get the organization-wide board and session controls;
      // members get the same page restricted to the chats assigned to them.
      label: "Live Chats",
      title: "Live chats, assigned conversations and QR scan",
      path: "/whatsapp",
      icon: MessageCircle,
      exact: true,
      inbox: true,
    },
    {
      id: "contacts",
      label: "Contacts",
      title: "WhatsApp Contacts Directory",
      path: "/whatsapp/contacts",
      icon: UserCheck,
      module: "contacts",
    },
    {
      id: "enquiries",
      label: "Enquiries",
      title: "Enquiry Pipeline: cold, warm & hot leads",
      path: "/whatsapp/enquiries",
      icon: Inbox,
      module: "enquiries",
    },
    {
      id: "templates",
      label: "Templates",
      title: "Message & Media Templates",
      path: "/whatsapp/templates",
      icon: FileText,
      module: "templates",
    },
    {
      id: "groups",
      label: "Groups",
      fullPrefix: "Contact ",
      title: "Contact Groups & Segments",
      path: "/whatsapp/groups",
      icon: Users,
      module: "groups",
    },
    {
      id: "campaigns",
      label: "Campaigns",
      fullPrefix: "Bulk ",
      title: "Bulk Broadcast Campaigns",
      path: "/whatsapp/campaigns",
      icon: Send,
      module: "campaigns",
    },
    {
      id: "automations",
      label: "Automations",
      title: "Automation Rules & Auto-Replies",
      path: "/whatsapp/automations",
      icon: Zap,
      module: "automations",
    },
    {
      id: "flows",
      label: "Flows",
      fullPrefix: "Chatbot ",
      title: "Visual Chatbot Conversation Flows",
      path: "/whatsapp/flows",
      icon: AutomationIcon,
      module: "flows",
    },
    {
      id: "analytics",
      label: "Analytics",
      title: "Campaign & Message Analytics",
      path: "/whatsapp/analytics",
      icon: BarChart3,
      module: "analytics",
    },
    {
      id: "client-portal",
      label: "Client portal",
      title: "Client access, documents and service requests",
      path: "/whatsapp/client-portal",
      icon: UserCheck,
      module: "client_portal",
    },
    {
      id: "branches",
      label: "Branches",
      title: "Multi-Branch Operating System & Workspaces",
      path: "/whatsapp/branches",
      icon: GitBranch,
      adminOnly: true,
    },
    {
      id: "accounts",
      label: "Accounts",
      title: "WhatsApp Accounts & Cloud Setup",
      path: "/whatsapp/accounts",
      icon: Smartphone,
      adminOnly: true,
    },
    {
      id: "employees",
      label: "Employees",
      title: "Manage Employees, Access Codes & Staff Activity Analytics",
      path: "/whatsapp/employees",
      icon: Users,
      adminOnly: true,
    },
  ];

  const isTabActive = (tab) => {
    if (tab.exact) {
      return location.pathname === tab.path;
    }
    return location.pathname.startsWith(tab.path);
  };

  // The rail holds more tabs than a short viewport shows, so keep the current
  // route's tab in view instead of stranding it below the fold. "nearest"
  // scrolls only the rail/strip, never the page itself.
  const activeTabRef = useRef(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [location.pathname]);

  // Administrators see every tab. Members see their inbox plus each module an
  // administrator has granted them view access to.
  const visibleTabs = tabs.filter(tab => {
    if (tab.inbox) return !inboxBlocked;
    if (tab.adminOnly) return admin;
    if (!tab.module) return true;
    return canView(tab.module);
  });

  return (
    <div className="hl-card hl-reveal w-full min-w-0 wa-workspace-nav">
      <div className="flex items-center min-w-0 w-full overflow-hidden">
        {/* Top Tabs — responsive full-width strip with zero horizontal scroll on desktop */}
        <div className="wa-nav-tabs-bar">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isTabActive(tab);
            return (
              <button
                key={tab.id}
                ref={active ? activeTabRef : undefined}
                onClick={() => navigate(tab.path)}
                className={`wa-nav-tab-btn${active ? " is-active" : ""}`}
                title={tab.title}
                type="button"
                aria-current={active ? "page" : undefined}
              >
                <span className="inline-flex items-center justify-center gap-1.5 min-w-0">
                  <Icon size={15} className="shrink-0" />
                  <span className="truncate">
                    {tab.fullPrefix && (
                      <span className="hidden 2xl:inline">{tab.fullPrefix}</span>
                    )}
                    {tab.label}
                  </span>
                </span>
                {tab.id === (admin ? "chats" : "team-inbox") && totalUnread > 0 && (
                  <span
                    className="hl-badge shrink-0"
                    style={
                      active
                        ? {
                            marginLeft: 4,
                            padding: "1px 5px",
                            fontSize: 10,
                            lineHeight: "12px",
                            background: "var(--color-accent)",
                            borderColor: "var(--color-focus)",
                            color: "var(--color-accent-ink)",
                          }
                        : {
                            marginLeft: 4,
                            padding: "1px 5px",
                            fontSize: 10,
                            lineHeight: "12px",
                            color: "var(--color-error)",
                            borderColor: "var(--color-error)",
                          }
                    }
                  >
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {stopResult && (
        <div className={`hl-badge ${stopResult.success ? "hl-badge-success" : "hl-badge-error"}`} style={{ marginTop: 8, fontSize: 12 }}>
          {stopResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {stopResult.message}
        </div>
      )}

      {/* Test Send Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="hl-card p-4 sm:p-6 max-w-md w-full relative max-h-[92dvh] overflow-y-auto wa-custom-scrollbar overscroll-contain">
            <button onClick={() => setShowTestModal(false)} className="absolute top-4 right-4" style={{ color: "var(--color-ink-2)" }}>
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div style={{ color: "var(--color-success)" }}>
                <Zap size={24} />
              </div>
              <div>
                <h3 className="hl-title" style={{ fontSize: "var(--text-lg)" }}>Test WhatsApp Connection</h3>
                <p className="hl-subtitle">Send instant test message to verify active engine</p>
              </div>
            </div>

            {testResult && (
              <div className={`hl-badge ${testResult.success ? "hl-badge-success" : "hl-badge-error"}`} style={{ marginBottom: 16, fontSize: 12 }}>
                {testResult.message}
              </div>
            )}

            <form onSubmit={handleTestSend} className="space-y-4">
              <div>
                <label className="hl-section-label" style={{ display: "block", marginBottom: 4 }}>Mobile Number (with country code)</label>
                <input
                  type="text"
                  placeholder="e.g. 919876543210"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="hl-input w-full"
                  required
                />
              </div>
              <div>
                <label className="hl-section-label" style={{ display: "block", marginBottom: 4 }}>Test Message Text</label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="hl-input w-full"
                  style={{ resize: "vertical" }}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTestModal(false)} className="hl-btn-secondary">Cancel</button>
                <button type="submit" disabled={testLoading || !testPhone} className="hl-btn-primary">
                  {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Send Test Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
