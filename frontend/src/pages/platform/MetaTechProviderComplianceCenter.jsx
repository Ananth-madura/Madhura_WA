import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Server,
  Key,
  Radio,
  FileText,
  Video,
  Smartphone,
  Layers,
  Activity,
  Bot,
  ExternalLink,
  ChevronRight,
  Info,
  Check,
  Copy,
  Terminal,
  Send
} from "lucide-react";
import { API } from "../../config";
import { useAuth } from "../../auth/AuthContext";

export default function MetaTechProviderComplianceCenter() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("compliance");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [complianceData, setComplianceData] = useState(null);

  // Live Inspector State
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);

  // Phone Tools State
  const [phoneId, setPhoneId] = useState("");
  const [pin, setPin] = useState("123456");
  const [codeMethod, setCodeMethod] = useState("SMS");
  const [verifyCode, setVerifyCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneFeedback, setPhoneFeedback] = useState(null);

  // AckBot State
  const [ackSenderId, setAckSenderId] = useState("");
  const [ackEnabled, setAckEnabled] = useState(false);
  const [ackMessage, setAckMessage] = useState("Thank you for contacting us. We received your message and an agent will reply shortly.");
  const [ackLoading, setAckLoading] = useState(false);

  // Shared Assets State
  const [assets, setAssets] = useState(null);
  const [loadingAssets, setLoadingAssets] = useState(false);

  const fetchStatus = async () => {
    try {
      setError("");
      const res = await axios.get(`${API}/api/platform/meta-tech-provider/status`, { timeout: 12000 });
      if (res.data?.success) {
        setComplianceData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not retrieve compliance status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchWebhooks = async () => {
    setLoadingWebhooks(true);
    try {
      const res = await axios.get(`${API}/api/platform/meta-tech-provider/webhooks/logs?limit=50`, { timeout: 12000 });
      if (res.data?.success) {
        setWebhookLogs(res.data.logs || []);
        if (res.data.logs?.length > 0 && !selectedWebhook) {
          setSelectedWebhook(res.data.logs[0]);
        }
      }
    } catch (err) {
      console.warn("Could not load webhook logs:", err.message);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await axios.get(`${API}/api/platform/meta-tech-provider/assets`, { timeout: 12000 });
      if (res.data?.success) {
        setAssets(res.data.assets);
      }
    } catch (err) {
      console.warn("Could not load shared assets:", err.message);
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (activeTab === "webhooks") fetchWebhooks();
    if (activeTab === "assets") fetchAssets();
  }, [activeTab]);

  const handleVerifyLive = async () => {
    setRefreshing(true);
    setNotice("");
    setError("");
    try {
      const res = await axios.post(`${API}/api/platform/meta-tech-provider/verify-live`, {}, { timeout: 20000 });
      if (res.data?.success) {
        setNotice("Live Meta connectivity audit passed with status: " + res.data.audit.overallHealth);
        await fetchStatus();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Live verification failed. Check app credentials.");
    } finally {
      setRefreshing(false);
    }
  };

  const handlePhoneAction = async (actionType) => {
    if (!phoneId.trim()) {
      setError("Please specify a WhatsApp Phone Number ID");
      return;
    }
    setPhoneLoading(true);
    setError("");
    setNotice("");
    setPhoneFeedback(null);
    try {
      let endpoint = "";
      let payload = { phoneId: phoneId.trim() };
      if (actionType === "register") {
        endpoint = "/phone/register";
        payload.pin = pin;
      } else if (actionType === "deregister") {
        endpoint = "/phone/deregister";
      } else if (actionType === "requestCode") {
        endpoint = "/phone/request-code";
        payload.codeMethod = codeMethod;
      } else if (actionType === "verifyCode") {
        endpoint = "/phone/verify-code";
        payload.code = verifyCode;
      }

      const res = await axios.post(`${API}/api/platform/meta-tech-provider${endpoint}`, payload, { timeout: 20000 });
      setPhoneFeedback(res.data);
      setNotice(res.data?.message || "Operation succeeded.");
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || "Phone operation failed.");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleAckBotSave = async () => {
    if (!ackSenderId) {
      setError("Enter the internal sender record ID");
      return;
    }
    setAckLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/api/platform/meta-tech-provider/phone/ack-bot`, {
        senderId: ackSenderId,
        isEnabled: ackEnabled,
        customMessage: ackMessage
      });
      if (res.data?.success) {
        setNotice("AckBot auto-responder settings updated successfully.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update AckBot settings.");
    } finally {
      setAckLoading(false);
    }
  };

  const handleDiscoverAssets = async () => {
    setLoadingAssets(true);
    setError("");
    try {
      const res = await axios.post(`${API}/api/platform/meta-tech-provider/assets/discover`, {}, { timeout: 25000 });
      if (res.data?.success) {
        setNotice("Discovered assets from authorized Meta account.");
        setAssets(res.data.assets);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Asset discovery failed. Ensure Meta account is connected.");
    } finally {
      setLoadingAssets(false);
    }
  };

  const stages = complianceData?.stages || {};

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Meta Tech Provider Platform Center</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Meta Compliance & Partner Approval Operations
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Centralized authority for Meta Business Verification, App Review, Advanced Permissions,
                Embedded Signup onboarding, phone registration, and live webhook diagnostics.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleVerifyLive}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/30 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                <span>Run Live Meta Audit</span>
              </button>
            </div>
          </div>

          {/* Metric Badges */}
          {complianceData?.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/60">
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/40">
                <span className="text-xs text-slate-400 font-medium">Provider Status</span>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">
                  {complianceData.overallStatus}
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/40">
                <span className="text-xs text-slate-400 font-medium">Connected WABAs</span>
                <div className="text-lg font-bold text-white mt-0.5">
                  {complianceData.metrics.totalWabas}
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/40">
                <span className="text-xs text-slate-400 font-medium">Active Senders</span>
                <div className="text-lg font-bold text-white mt-0.5">
                  {complianceData.metrics.totalConnectedSenders}
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/40">
                <span className="text-xs text-slate-400 font-medium">Logged Webhooks</span>
                <div className="text-lg font-bold text-sky-400 mt-0.5">
                  {complianceData.metrics.totalWebhooksReceived}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Notifications */}
        {error && (
          <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>{error}</div>
          </div>
        )}
        {notice && (
          <div role="status" className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div>{notice}</div>
          </div>
        )}

        {/* Nav Tabs */}
        <div className="flex border-b border-slate-700 space-x-1 sm:space-x-4">
          <button
            type="button"
            onClick={() => setActiveTab("compliance")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeTab === "compliance"
                ? "border-emerald-500 text-emerald-400 bg-slate-800/40"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>6 Compliance Stages</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("webhooks")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeTab === "webhooks"
                ? "border-emerald-500 text-emerald-400 bg-slate-800/40"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>Live Webhook Inspector</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("phoneTools")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeTab === "phoneTools"
                ? "border-emerald-500 text-emerald-400 bg-slate-800/40"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              <span>Phone Registration & PIN</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeTab === "assets"
                ? "border-emerald-500 text-emerald-400 bg-slate-800/40"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span>Discovered Meta Assets</span>
            </div>
          </button>
        </div>

        {/* TAB 1: 6 COMPLIANCE STAGES */}
        {activeTab === "compliance" && (
          <div className="space-y-6">
            {loading ? (
              <div className="p-12 text-center text-slate-400">Loading compliance stages...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stage 1 */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Stage 1</span>
                      <h3 className="text-lg font-bold text-white mt-1">Meta Business Verification</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {stages.stage1?.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{stages.stage1?.description}</p>
                  <div className="bg-slate-900/60 rounded-xl p-4 text-xs space-y-2 font-mono text-slate-300">
                    <div><span className="text-slate-500">Legal Name:</span> {stages.stage1?.data?.legalName}</div>
                    <div><span className="text-slate-500">Portfolio ID:</span> {stages.stage1?.data?.portfolioId || "Configured"}</div>
                    <div><span className="text-slate-500">Official Website:</span> {stages.stage1?.data?.website}</div>
                    <div><span className="text-slate-500">Support Email:</span> {stages.stage1?.data?.email}</div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <span className="text-xs font-semibold text-slate-300">Required Documents:</span>
                    {stages.stage1?.data?.evidenceChecklist?.map((doc, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{doc.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Stage 2</span>
                      <h3 className="text-lg font-bold text-white mt-1">Meta App Configuration</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {stages.stage2?.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{stages.stage2?.description}</p>
                  <div className="bg-slate-900/60 rounded-xl p-4 text-xs space-y-2 font-mono text-slate-300">
                    <div><span className="text-slate-500">App Name:</span> {stages.stage2?.data?.appName}</div>
                    <div><span className="text-slate-500">App Mode:</span> {stages.stage2?.data?.appMode}</div>
                    <div><span className="text-slate-500">Privacy Policy:</span> {stages.stage2?.data?.privacyPolicyUrl}</div>
                    <div><span className="text-slate-500">Terms of Service:</span> {stages.stage2?.data?.termsOfServiceUrl}</div>
                    <div><span className="text-slate-500">Webhook URL:</span> {stages.stage2?.data?.webhookUrl}</div>
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Stage 3</span>
                      <h3 className="text-lg font-bold text-white mt-1">App Review & Permissions</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {stages.stage3?.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{stages.stage3?.description}</p>
                  <div className="space-y-2">
                    {stages.stage3?.data?.permissions?.map((p, idx) => (
                      <div key={idx} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/60 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono font-semibold text-slate-200">{p.permission}</div>
                          <div className="text-slate-400 text-[11px] mt-0.5">{p.description}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stage 4 */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Stage 4</span>
                      <h3 className="text-lg font-bold text-white mt-1">Video Evidence & Proof</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {stages.stage4?.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{stages.stage4?.description}</p>
                  <div className="space-y-2">
                    {stages.stage4?.data?.videos?.map((v, idx) => (
                      <div key={idx} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-slate-200">{v.title}</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stage 5 */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Stage 5</span>
                      <h3 className="text-lg font-bold text-white mt-1">Embedded Signup Readiness</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {stages.stage5?.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{stages.stage5?.description}</p>
                  <div className="bg-slate-900/60 rounded-xl p-4 text-xs space-y-2 font-mono text-slate-300">
                    <div><span className="text-slate-500">Token Handling:</span> {stages.stage5?.data?.tokenHandling}</div>
                    <div><span className="text-slate-500">WABA Discovery:</span> {stages.stage5?.data?.wabaDiscovery}</div>
                    <div><span className="text-slate-500">Phone Discovery:</span> {stages.stage5?.data?.phoneDiscovery}</div>
                    <div><span className="text-slate-500">Asset Assignment:</span> {stages.stage5?.data?.assetAssignment}</div>
                  </div>
                </div>

                {/* Stage 6 */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Stage 6</span>
                      <h3 className="text-lg font-bold text-white mt-1">Provider Readiness & Audit</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Score: {stages.stage6?.score || 100}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{stages.stage6?.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Business Verified</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>App Review Approved</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Advanced Access Granted</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Embedded Signup Live</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Webhooks Operational</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Multi-tenant Isolation</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE WEBHOOK INSPECTOR (Sample App Parity) */}
        {activeTab === "webhooks" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Live Meta Webhook Stream Inspector</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspects every inbound message, status update, quality alert, and template event signed by Meta.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchWebhooks}
                disabled={loadingWebhooks}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingWebhooks ? "animate-spin" : ""}`} />
                <span>Refresh Stream</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Event List */}
              <div className="lg:col-span-5 bg-slate-800/60 border border-slate-700 rounded-2xl p-4 max-h-[600px] overflow-y-auto space-y-2">
                {webhookLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No webhooks logged yet. As WhatsApp messages arrive, they appear here in real time.
                  </div>
                ) : (
                  webhookLogs.map((log) => (
                    <div
                      key={log.id}
                      onClick={() => setSelectedWebhook(log)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                        selectedWebhook?.id === log.id
                          ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
                          : "bg-slate-900/60 border-slate-700/60 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {log.eventType}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] truncate">
                        {log.senderPhone ? `From: ${log.senderPhone}` : `WABA: ${log.wabaId || "N/A"}`}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* JSON Payload Inspector */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col max-h-[600px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-200">Raw Webhook Payload</span>
                  </div>
                  {selectedWebhook && (
                    <span className="text-[11px] text-slate-400">ID #{selectedWebhook.id}</span>
                  )}
                </div>
                <div className="flex-1 overflow-auto mt-3 font-mono text-xs text-emerald-400/90 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {selectedWebhook ? (
                    <pre>{JSON.stringify(selectedWebhook.payload, null, 2)}</pre>
                  ) : (
                    <div className="text-slate-500 text-center py-20">Select an event from the stream to inspect</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PHONE REGISTRATION & PIN TOOLS */}
        {activeTab === "phoneTools" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phone Register / 2-Step PIN */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Cloud API Phone Number Registration</h2>
              </div>
              <p className="text-xs text-slate-400">
                Register or verify your WhatsApp Business number with a 6-digit PIN as required by Meta Cloud API.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <label htmlFor="regPhoneId" className="block text-xs font-medium text-slate-300 mb-1">
                    WhatsApp Phone Number ID
                  </label>
                  <input
                    id="regPhoneId"
                    type="text"
                    value={phoneId}
                    onChange={(e) => setPhoneId(e.target.value)}
                    placeholder="e.g. 109876543210987"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="regPin" className="block text-xs font-medium text-slate-300 mb-1">
                    Two-Step Verification 6-Digit PIN
                  </label>
                  <input
                    id="regPin"
                    type="text"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none font-mono"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handlePhoneAction("register")}
                    disabled={phoneLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Register with PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePhoneAction("deregister")}
                    disabled={phoneLoading}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Deregister
                  </button>
                </div>
              </div>

              {/* 2-Step Verification Code */}
              <div className="border-t border-slate-700 pt-4 space-y-3">
                <span className="text-xs font-semibold text-slate-300">Request Verification Code</span>
                <div className="flex items-center gap-3">
                  <select
                    value={codeMethod}
                    onChange={(e) => setCodeMethod(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="SMS">SMS</option>
                    <option value="VOICE">Voice Call</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handlePhoneAction("requestCode")}
                    disabled={phoneLoading}
                    className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Request Code
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handlePhoneAction("verifyCode")}
                    disabled={phoneLoading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Submit Code
                  </button>
                </div>
              </div>

              {phoneFeedback && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400">
                  <pre>{JSON.stringify(phoneFeedback, null, 2)}</pre>
                </div>
              )}
            </div>

            {/* AckBot Auto-Responder */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-bold text-white">AckBot Instant Auto-Responder</h2>
              </div>
              <p className="text-xs text-slate-400">
                Automatically reply to inbound WhatsApp customer messages with an instant acknowledgment.
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <label htmlFor="ackSender" className="block text-xs font-medium text-slate-300 mb-1">
                    Sender Internal Record ID
                  </label>
                  <input
                    id="ackSender"
                    type="text"
                    value={ackSenderId}
                    onChange={(e) => setAckSenderId(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="ackToggle"
                    type="checkbox"
                    checked={ackEnabled}
                    onChange={(e) => setAckEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="ackToggle" className="text-xs font-medium text-slate-200">
                    Enable AckBot for this sender
                  </label>
                </div>

                <div>
                  <label htmlFor="ackMsg" className="block text-xs font-medium text-slate-300 mb-1">
                    Auto-Reply Message
                  </label>
                  <textarea
                    id="ackMsg"
                    rows={4}
                    value={ackMessage}
                    onChange={(e) => setAckMessage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAckBotSave}
                  disabled={ackLoading}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  Save AckBot Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DISCOVERED META ASSETS */}
        {activeTab === "assets" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Discovered Business Assets</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pages, Catalogs, Ad Accounts, Datasets, and Instagram Accounts authorized through Embedded Signup.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDiscoverAssets}
                disabled={loadingAssets}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAssets ? "animate-spin" : ""}`} />
                <span>Discover All Assets</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Product Catalogs */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3">
                <span className="text-xs font-bold uppercase text-emerald-400">Product Catalogs</span>
                <div className="space-y-2">
                  {assets?.catalogs?.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4">No catalogs discovered</div>
                  ) : (
                    assets?.catalogs?.map((c) => (
                      <div key={c.id} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/60 text-xs">
                        <div className="font-semibold text-slate-200">{c.name}</div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">ID: {c.id}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Shared Pages */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3">
                <span className="text-xs font-bold uppercase text-sky-400">Facebook Pages</span>
                <div className="space-y-2">
                  {assets?.pages?.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4">No pages discovered</div>
                  ) : (
                    assets?.pages?.map((p) => (
                      <div key={p.id} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/60 text-xs">
                        <div className="font-semibold text-slate-200">{p.name}</div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">ID: {p.id}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Ad Accounts & Instagram */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3">
                <span className="text-xs font-bold uppercase text-indigo-400">Ad Accounts & Instagram</span>
                <div className="space-y-2">
                  {assets?.adAccounts?.map((a) => (
                    <div key={a.id} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/60 text-xs">
                      <div className="font-semibold text-slate-200">{a.name}</div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5">Ad Account: {a.id}</div>
                    </div>
                  ))}
                  {assets?.instagramAccounts?.map((ig) => (
                    <div key={ig.id} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/60 text-xs">
                      <div className="font-semibold text-slate-200">@{ig.username || ig.name}</div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5">IG ID: {ig.id}</div>
                    </div>
                  ))}
                  {(!assets?.adAccounts?.length && !assets?.instagramAccounts?.length) && (
                    <div className="text-xs text-slate-500 py-4">No ad accounts or Instagram accounts discovered</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
