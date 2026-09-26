import { useNavigate, useLocation } from "react-router-dom";
import {
  MessageCircle,
  FileText,
  Users,
  Send,
  BarChart3,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Zap,
  Zap as AutomationIcon,
  Smartphone,
  UserCheck,
  OctagonMinus,
  ChevronLeft,
  CreditCard,
  RefreshCw,
  LogOut,
  Bell,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../config/api";
import socket from "../socket/socket";
import WAConfigPrompt from "./WAConfigPrompt";

export default function WhatsAppNav({ onAccountBalance, onSyncWhatsApp, onLogout, isSyncing, statusPhone }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showConfig, setShowConfig] = useState(false);
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
  }, [fetchStatus, fetchUnreadCount]);

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
    {
      id: "chats",
      label: "Live Chats & QR",
      path: "/whatsapp",
      icon: MessageCircle,
      exact: true,
    },
    {
      id: "contacts",
      label: "Contacts",
      path: "/whatsapp/contacts",
      icon: UserCheck,
    },
    {
      id: "templates",
      label: "Templates",
      path: "/whatsapp/templates",
      icon: FileText,
    },
    {
      id: "groups",
      label: "Contact Groups",
      path: "/whatsapp/groups",
      icon: Users,
    },
    {
      id: "campaigns",
      label: "Bulk Campaigns",
      path: "/whatsapp/campaigns",
      icon: Send,
    },
    {
      id: "automations",
      label: "Automations",
      path: "/whatsapp/automations",
      icon: Zap,
    },
    {
      id: "reminders",
      label: "Reminders",
      path: "/whatsapp/reminders",
      icon: Bell,
    },
    {
      id: "flows",
      label: "Chatbot Flows",
      path: "/whatsapp/flows",
      icon: AutomationIcon,
    },
    {
      id: "analytics",
      label: "Analytics",
      path: "/whatsapp/analytics",
      icon: BarChart3,
    },
    {
      id: "accounts",
      label: "Accounts",
      path: "/whatsapp/accounts",
      icon: Smartphone,
    },
  ];

  const isTabActive = (tab) => {
    if (tab.exact) {
      return location.pathname === tab.path;
    }
    return location.pathname.startsWith(tab.path);
  };

  return (
    <div className="mb-3 bg-white rounded-xl border border-gray-200 p-2 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Top Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 px-1 scrollbar-none w-full sm:w-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 rounded-lg font-bold text-xs transition mr-1 shrink-0"
            title="Return to CRM Dashboard"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">CRM Dashboard</span>
          </button>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isTabActive(tab);
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                  active
                    ? "bg-[#25D366] text-white shadow-md shadow-[#25D366]/20 font-semibold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Icon size={18} className={active ? "text-white" : "text-gray-500"} />
                <span>{tab.label}</span>
                {tab.id === "chats" && totalUnread > 0 && (
                  <span className={`ml-1.5 px-2 py-0.5 text-xs font-extrabold rounded-full animate-pulse shadow-sm ${
                    active ? "bg-white text-[#25D366]" : "bg-rose-500 text-white"
                  }`}>
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action & Config Buttons */}
        <div className="flex items-center gap-2 ml-auto pr-1">
          {status?.cloud?.configured || status?.isCloud ? (
            <span className="hidden sm:flex text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span>☁️ Meta API: {status?.phone ? `+${status.phone}` : "Active"}</span>
            </span>
          ) : status?.web?.connected || status?.isWeb || statusPhone ? (
            <span className="hidden sm:flex text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
              <span>📱 +{status?.phone || statusPhone}</span>
            </span>
          ) : (
            <span className="hidden sm:flex text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              <span>Offline</span>
            </span>
          )}

          {onAccountBalance && (
            <button
              onClick={onAccountBalance}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition text-xs font-semibold shadow-sm"
              title="View WhatsApp Engine & Messaging Quota Balance"
            >
              <CreditCard size={14} className="text-gray-600" />
              <span className="hidden lg:inline">Quota & Balance</span>
            </button>
          )}

          {onSyncWhatsApp && (
            <button
              onClick={onSyncWhatsApp}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition text-xs font-semibold disabled:opacity-50 shadow-sm"
              title="Sync Contacts & Chat History"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-emerald-600" : "text-emerald-600"} />
              <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync All"}</span>
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg transition text-xs font-semibold shadow-sm"
              title="Disconnect WhatsApp Session"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          )}

          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition text-xs font-semibold shadow-sm"
            title="Configure Meta Cloud API"
          >
            <Settings size={14} className="text-gray-600" />
            <span className="hidden md:inline">API Config</span>
          </button>
        </div>
      </div>

      {stopResult && (
        <div className={`mt-2 mx-1 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${stopResult.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {stopResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {stopResult.message}
        </div>
      )}

      {showConfig && <WAConfigPrompt onClose={() => setShowConfig(false)} />}

      {/* Test Send Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-100 shadow-2xl relative">
            <button onClick={() => setShowTestModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 text-[#25D366] rounded-xl">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Test WhatsApp Connection</h3>
                <p className="text-xs text-gray-500">Send instant test message to verify active engine</p>
              </div>
            </div>

            {testResult && (
              <div className={`mb-4 p-3 rounded-lg text-xs font-semibold ${testResult.success ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {testResult.message}
              </div>
            )}

            <form onSubmit={handleTestSend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Mobile Number (with country code)</label>
                <input
                  type="text"
                  placeholder="e.g. 919876543210"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Test Message Text</label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTestModal(false)} className="px-4 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={testLoading || !testPhone} className="px-5 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1ebe5d] flex items-center gap-2 shadow-md disabled:opacity-50">
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
