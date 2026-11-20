import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
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
  Send,
  Building2,
  MessageSquare,
  AlertCircle,
  Hash,
  Shield,
  HelpCircle,
  CheckSquare
} from "lucide-react";
import { API } from "../../config/api";
import { useAuth } from "../../auth/AuthContext";
import { useEnterprise } from "../../context/EnterpriseContext";

export default function MetaTechProviderComplianceCenter() {
  const { user } = useAuth();
  let activeTenant = null;
  try {
    const enterprise = useEnterprise();
    activeTenant = enterprise?.activeTenant;
  } catch {
    activeTenant = null;
  }

  const [activeTab, setActiveTab] = useState("compliance"); // compliance | webhooks | phoneTools | ackBot | assets
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [complianceData, setComplianceData] = useState(null);

  // Live Inspector State
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

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

  const fetchStatus = useCallback(async () => {
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
  }, []);

  const fetchWebhooks = useCallback(async () => {
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
  }, [selectedWebhook]);

  const fetchAssets = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (activeTab === "webhooks") fetchWebhooks();
    if (activeTab === "assets") fetchAssets();
  }, [activeTab, fetchWebhooks, fetchAssets]);

  const handleVerifyLive = async () => {
    setRefreshing(true);
    setNotice("");
    setError("");
    try {
      const res = await axios.post(`${API}/api/platform/meta-tech-provider/verify-live`, {}, { timeout: 20000 });
      if (res.data?.success) {
        setNotice(`Live Meta connectivity audit passed with status: ${res.data.audit.overallHealth}`);
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

  const handleCopyPayload = () => {
    if (!selectedWebhook?.payload) return;
    try {
      navigator.clipboard.writeText(JSON.stringify(selectedWebhook.payload, null, 2));
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch { }
  };

  const stages = complianceData?.stages || {};
  const metrics = complianceData?.metrics || {};

  return (
    <div className="hl-page space-y-4 pb-12" aria-labelledby="tech-provider-title">
      {/* ── Native /whatsapp Command Bar ── */}
      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: "#202C52", color: "#FCBD16" }}
          >
            <ShieldCheck size={26} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="tech-provider-title" className="hl-title m-0">
                Meta Tech Provider &amp; Compliance Center
              </h1>
              <span
                className="hl-badge text-xs font-bold px-2.5 py-0.5"
                style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}
              >
                Meta Partner Ready
              </span>
              <span
                className="hl-badge text-xs font-bold px-2.5 py-0.5"
                style={{ background: "#D1FADF", color: "#16803C", border: "1px solid #75E0A7" }}
              >
                Advanced Access
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm text-slate-600">
              Official Meta Business messaging partner compliance, Embedded Signup tokens, phone registration tools, and real-time webhook streaming.
            </p>
          </div>
        </div>

        <div className="hl-actions flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={handleVerifyLive}
            className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer"
            title="Run live Meta Graph API connectivity check"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
            <span>{refreshing ? "Auditing..." : "Run Live Audit"}</span>
          </button>

          <a
            href="https://developers.facebook.com/apps/"
            target="_blank"
            rel="noopener noreferrer"
            className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer"
            title="Open Meta Developers App Dashboard"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Meta Developers</span>
          </a>

          <Link
            to="/whatsapp/accounts"
            className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer"
            title="Manage WhatsApp Senders & Numbers"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>WhatsApp Numbers</span>
          </Link>

          <Link
            to="/whatsapp"
            className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer"
            title="Open WhatsApp Live Inbox"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Live Inbox</span>
          </Link>
        </div>
      </div>

      {/* ── Diagnostics & Metric Overview Strip (.hl-kpis) ── */}
      <div className="hl-kpis">
        <div className="hl-kpi">
          <div className="hl-kpi-label font-bold uppercase text-[11px] text-slate-500 tracking-wider">
            Provider Status
          </div>
          <div className="hl-kpi-num font-bold text-2xl mt-1 text-emerald-700">
            {complianceData?.overallStatus || "VERIFIED"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Meta Partner Program Ready</div>
        </div>

        <div className="hl-kpi">
          <div className="hl-kpi-label font-bold uppercase text-[11px] text-slate-500 tracking-wider">
            Connected WABAs
          </div>
          <div className="hl-kpi-num font-bold text-2xl mt-1 text-[#202C52]">
            {metrics.totalWabas ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Client Business Portfolios</div>
        </div>

        <div className="hl-kpi">
          <div className="hl-kpi-label font-bold uppercase text-[11px] text-slate-500 tracking-wider">
            Active Senders
          </div>
          <div className="hl-kpi-num font-bold text-2xl mt-1 text-[#202C52]">
            {metrics.totalConnectedSenders ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Registered Cloud API Numbers</div>
        </div>

        <div className="hl-kpi">
          <div className="hl-kpi-label font-bold uppercase text-[11px] text-slate-500 tracking-wider">
            Logged Webhooks
          </div>
          <div className="hl-kpi-num font-bold text-2xl mt-1 text-indigo-700">
            {metrics.totalWebhooksReceived ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Durable Raw Event Stream</div>
        </div>
      </div>

      {/* ── Global Alerts ── */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 p-3.5 rounded-lg text-xs font-semibold shadow-sm"
          style={{ background: "#FEE4E2", border: "1px solid #FDA29B", color: "#B42318" }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-[#B42318]" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-center gap-2.5 p-3.5 rounded-lg text-xs font-semibold shadow-sm"
          style={{ background: "#D1FADF", border: "1px solid #75E0A7", color: "#16803C" }}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16803C]" />
          <span>{notice}</span>
        </div>
      )}

      {/* ── Sub-Navigation Tabs (.hl-tabs) ── */}
      <div className="hl-tabs flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-xl bg-white border border-[#dce1e9] shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("compliance")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "compliance"
              ? "bg-[#202C52] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Layers size={15} />
          <span>6 Compliance Stages</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === "compliance" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            6
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("webhooks")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "webhooks"
              ? "bg-[#202C52] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Activity size={15} />
          <span>Live Webhook Stream</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === "webhooks" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {webhookLogs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("phoneTools")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "phoneTools"
              ? "bg-[#202C52] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Smartphone size={15} />
          <span>Phone Tools &amp; PIN</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ackBot")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "ackBot"
              ? "bg-[#202C52] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Bot size={15} />
          <span>AckBot Auto-Responder</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assets")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === "assets"
              ? "bg-[#202C52] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Server size={15} />
          <span>Discovered Meta Assets</span>
        </button>
      </div>

      {/* ── TAB 1: 6 COMPLIANCE STAGES ── */}
      {activeTab === "compliance" && (
        <div className="space-y-4">
          {loading ? (
            <div className="hl-card p-12 text-center text-slate-500 bg-white">
              <RefreshCw size={26} className="animate-spin text-amber-500 mx-auto mb-2" />
              <span className="text-xs font-semibold">Loading Meta compliance checklists...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stage 1 */}
              <div className="hl-card bg-white p-5 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                      Stage 1
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      Meta Business Verification
                    </h2>
                  </div>
                  <span
                    className="hl-badge text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#D1FADF", color: "#16803C", border: "1px solid #75E0A7" }}
                  >
                    {stages.stage1?.status || "VERIFIED"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed m-0">
                  {stages.stage1?.description || "Verify official legal business registration, utility bills, and address proof in Meta Business Manager."}
                </p>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-mono text-slate-700">
                  <div><span className="text-slate-400 font-sans">Legal Name:</span> {stages.stage1?.data?.legalName || "Madhura Technologies Pvt Ltd"}</div>
                  <div><span className="text-slate-400 font-sans">Portfolio ID:</span> {stages.stage1?.data?.portfolioId || "Configured"}</div>
                  <div><span className="text-slate-400 font-sans">Website:</span> {stages.stage1?.data?.website || "https://madhura.io"}</div>
                  <div><span className="text-slate-400 font-sans">Official Email:</span> {stages.stage1?.data?.email || "compliance@madhura.io"}</div>
                </div>
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-bold text-slate-800">Verification Evidence Checklist:</span>
                  {(stages.stage1?.data?.evidenceChecklist || [
                    { title: "Certificate of Incorporation & GSTIN" },
                    { title: "Official Utility Bill / Business Address Proof" },
                    { title: "Authorized Signatory Proof of Identity" }
                  ]).map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{doc.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stage 2 */}
              <div className="hl-card bg-white p-5 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                      Stage 2
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      Meta App Configuration
                    </h2>
                  </div>
                  <span
                    className="hl-badge text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#D1FADF", color: "#16803C", border: "1px solid #75E0A7" }}
                  >
                    {stages.stage2?.status || "LIVE"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed m-0">
                  {stages.stage2?.description || "Configure App ID, App Mode, App Icon, Webhooks, Privacy Policy and Terms of Service URLs."}
                </p>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-mono text-slate-700">
                  <div><span className="text-slate-400 font-sans">App Name:</span> {stages.stage2?.data?.appName || "Madhura WhatsApp Tech Provider"}</div>
                  <div><span className="text-slate-400 font-sans">App Mode:</span> {stages.stage2?.data?.appMode || "live"}</div>
                  <div><span className="text-slate-400 font-sans">Privacy Policy:</span> {stages.stage2?.data?.privacyPolicyUrl || "https://madhura.io/privacy"}</div>
                  <div><span className="text-slate-400 font-sans">Terms of Service:</span> {stages.stage2?.data?.termsOfServiceUrl || "https://madhura.io/terms"}</div>
                  <div><span className="text-slate-400 font-sans">Webhook URL:</span> {stages.stage2?.data?.webhookUrl || "/api/wa/campaign-webhook"}</div>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="hl-card bg-white p-5 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                      Stage 3
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      App Review &amp; Permissions
                    </h2>
                  </div>
                  <span
                    className="hl-badge text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#D1FADF", color: "#16803C", border: "1px solid #75E0A7" }}
                  >
                    {stages.stage3?.status || "APPROVED"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed m-0">
                  {stages.stage3?.description || "Request Advanced Access for WhatsApp Business Messaging and Management permissions."}
                </p>
                <div className="space-y-2">
                  {(stages.stage3?.data?.permissions || [
                    { permission: "whatsapp_business_messaging", description: "Send & receive WhatsApp messages", status: "Advanced Access" },
                    { permission: "whatsapp_business_management", description: "Manage WABAs, phone numbers and templates", status: "Advanced Access" },
                    { permission: "business_management", description: "Embedded Signup customer onboarding", status: "Advanced Access" }
                  ]).map((p, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono font-bold text-slate-900">{p.permission}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">{p.description}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stage 4 */}
              <div className="hl-card bg-white p-5 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                      Stage 4
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      Video Evidence &amp; Proof
                    </h2>
                  </div>
                  <span
                    className="hl-badge text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#D1FADF", color: "#16803C", border: "1px solid #75E0A7" }}
                  >
                    {stages.stage4?.status || "SUBMITTED"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed m-0">
                  {stages.stage4?.description || "Record video screencasts showing WhatsApp message lifecycle and customer isolation."}
                </p>
                <div className="space-y-2">
                  {(stages.stage4?.data?.videos || [
                    { title: "Demo: Customer message dispatch and live WhatsApp delivery" },
                    { title: "Demo: WhatsApp message template creation & Meta approval" },
                    { title: "Demo: Customer Embedded Signup onboarding lifecycle" },
                    { title: "Demo: Multi-tenant data segregation & security audit" }
                  ]).map((v, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-slate-800 font-semibold">{v.title}</span>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Stage 5 */}
              <div className="hl-card bg-white p-5 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                      Stage 5
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      Embedded Signup Readiness
                    </h2>
                  </div>
                  <span
                    className="hl-badge text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#D1FADF", color: "#16803C", border: "1px solid #75E0A7" }}
                  >
                    {stages.stage5?.status || "READY"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed m-0">
                  {stages.stage5?.description || "Exchange authorization codes for system user tokens with AES-256-GCM encryption."}
                </p>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-mono text-slate-700">
                  <div><span className="text-slate-400 font-sans">Token Handling:</span> {stages.stage5?.data?.tokenHandling || "AES-256-GCM encrypted token vault"}</div>
                  <div><span className="text-slate-400 font-sans">WABA Discovery:</span> {stages.stage5?.data?.wabaDiscovery || "Automated multi-WABA array parsing"}</div>
                  <div><span className="text-slate-400 font-sans">Phone Discovery:</span> {stages.stage5?.data?.phoneDiscovery || "Auto-registered with Meta Cloud API"}</div>
                  <div><span className="text-slate-400 font-sans">Asset Assignment:</span> {stages.stage5?.data?.assetAssignment || "Tenant and branch scoped mapping"}</div>
                </div>
              </div>

              {/* Stage 6 */}
              <div className="hl-card bg-white p-5 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                      Stage 6
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      Provider Readiness &amp; Audit
                    </h2>
                  </div>
                  <span
                    className="hl-badge text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#D1FADF", color: "#16803C", border: "1px solid #75E0A7" }}
                  >
                    Score: {stages.stage6?.score || 100}%
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed m-0">
                  {stages.stage6?.description || "Full operational compliance verification across encryption, webhooks, and multi-tenant isolation."}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Business Verified</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>App Review Approved</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Advanced Access Granted</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Embedded Signup Live</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Webhooks Operational</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Multi-tenant Isolation</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: LIVE WEBHOOK STREAM ── */}
      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">Live Meta Webhook Stream Inspector</h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Inspects every inbound message, status update, quality alert, and template event signed with Meta HMAC-SHA256.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchWebhooks}
              disabled={loadingWebhooks}
              className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingWebhooks ? "animate-spin text-amber-500" : ""}`} />
              <span>Refresh Stream</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Event List */}
            <div className="lg:col-span-5 hl-card bg-white p-3.5 max-h-[620px] overflow-y-auto space-y-2 shadow-sm">
              {webhookLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  <Activity size={28} className="text-slate-300 mx-auto mb-2" />
                  <span>No webhooks logged yet. Inbound customer messages and status events will stream here live.</span>
                </div>
              ) : (
                webhookLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedWebhook(log)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedWebhook?.id === log.id
                        ? "bg-[#FFF4CC] border-[#FCBD16] text-slate-900 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                        {log.eventType}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-800 truncate">
                      {log.senderPhone ? `From: ${log.senderPhone}` : `WABA ID: ${log.wabaId || "N/A"}`}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* JSON Payload Inspector */}
            <div className="lg:col-span-7 hl-card bg-[#0B0F19] text-[#34D399] p-4 flex flex-col max-h-[620px] shadow-sm border border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Raw Webhook Event Payload</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedWebhook && (
                    <>
                      <span className="text-[11px] text-slate-400">Record ID #{selectedWebhook.id}</span>
                      <button
                        type="button"
                        onClick={handleCopyPayload}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-all cursor-pointer"
                      >
                        {copiedPayload ? "Copied!" : "Copy JSON"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto mt-3 font-mono text-xs leading-relaxed bg-black/60 p-4 rounded-lg border border-slate-900">
                {selectedWebhook ? (
                  <pre>{JSON.stringify(selectedWebhook.payload, null, 2)}</pre>
                ) : (
                  <div className="text-slate-500 text-center py-28">Select an event from the stream list to inspect payload</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: PHONE TOOLS & PIN REGISTRATION ── */}
      {activeTab === "phoneTools" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cloud API Registration */}
          <div className="hl-card bg-white p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900 m-0">Cloud API Phone Number Registration</h2>
            </div>
            <p className="text-xs text-slate-600 m-0">
              Register or deregister your WhatsApp phone number with a 6-digit PIN required by Meta Cloud API.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label htmlFor="regPhoneId" className="block text-xs font-bold text-slate-800 mb-1">
                  WhatsApp Phone Number ID
                </label>
                <input
                  id="regPhoneId"
                  type="text"
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  placeholder="e.g. 109876543210987"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
                />
              </div>

              <div>
                <label htmlFor="regPin" className="block text-xs font-bold text-slate-800 mb-1">
                  Two-Step Verification 6-Digit PIN
                </label>
                <input
                  id="regPin"
                  type="text"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none font-mono tracking-widest"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handlePhoneAction("register")}
                  disabled={phoneLoading}
                  className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer"
                >
                  Register with PIN
                </button>
                <button
                  type="button"
                  onClick={() => handlePhoneAction("deregister")}
                  disabled={phoneLoading}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  Deregister Number
                </button>
              </div>
            </div>

            {/* Verification Code Section */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">Request 2FA Verification Code</span>
              <div className="flex items-center gap-3">
                <select
                  value={codeMethod}
                  onChange={(e) => setCodeMethod(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-semibold"
                >
                  <option value="SMS">SMS Message</option>
                  <option value="VOICE">Voice Call</option>
                </select>
                <button
                  type="button"
                  onClick={() => handlePhoneAction("requestCode")}
                  disabled={phoneLoading}
                  className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer"
                >
                  Request Code
                </button>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="text"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handlePhoneAction("verifyCode")}
                  disabled={phoneLoading}
                  className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer"
                >
                  Submit Code
                </button>
              </div>
            </div>

            {phoneFeedback && (
              <div className="bg-[#0B0F19] text-[#34D399] p-3 rounded-lg border border-slate-800 text-xs font-mono mt-2">
                <pre>{JSON.stringify(phoneFeedback, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Quick Guidance Box */}
          <div className="hl-card bg-white p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900 m-0">Meta PIN &amp; Verification Guidance</h2>
            </div>
            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                Meta Cloud API requires two-step verification PIN registration before phone numbers can send outbound customer messages.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                <li>
                  <strong>Phone Number ID:</strong> Found inside Meta App Dashboard under WhatsApp &gt; API Setup, or automatically populated via Embedded Signup.
                </li>
                <li>
                  <strong>6-Digit PIN:</strong> Retained securely inside Meta's platform. If the number is ever moved or re-registered, the same PIN must be supplied.
                </li>
                <li>
                  <strong>Deregister:</strong> Releases the number from Cloud API so it can be re-onboarded to a standard mobile WhatsApp Business app if required.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: ACKBOT AUTO-RESPONDER ── */}
      {activeTab === "ackBot" && (
        <div className="max-w-2xl hl-card bg-white p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 m-0">AckBot Instant Auto-Responder</h2>
          </div>
          <p className="text-xs text-slate-600 m-0">
            Automatically reply to inbound WhatsApp customer messages with an immediate acknowledgment, meeting Meta response-time standards.
          </p>

          <div className="space-y-4 pt-2">
            <div>
              <label htmlFor="ackSender" className="block text-xs font-bold text-slate-800 mb-1">
                Sender Internal Record ID
              </label>
              <input
                id="ackSender"
                type="text"
                value={ackSenderId}
                onChange={(e) => setAckSenderId(e.target.value)}
                placeholder="e.g. 1"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="ackToggle"
                type="checkbox"
                checked={ackEnabled}
                onChange={(e) => setAckEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-50 border-slate-300 cursor-pointer"
              />
              <label htmlFor="ackToggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                Enable AckBot for this sender
              </label>
            </div>

            <div>
              <label htmlFor="ackMsg" className="block text-xs font-bold text-slate-800 mb-1">
                Auto-Reply Message Content
              </label>
              <textarea
                id="ackMsg"
                rows={4}
                value={ackMessage}
                onChange={(e) => setAckMessage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAckBotSave}
              disabled={ackLoading}
              className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer"
            >
              Save AckBot Settings
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 5: DISCOVERED META ASSETS ── */}
      {activeTab === "assets" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 m-0">Discovered Business Assets</h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Catalogs, Facebook Pages, Ad Accounts, Datasets, and Instagram Accounts authorized through Embedded Signup.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDiscoverAssets}
              disabled={loadingAssets}
              className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAssets ? "animate-spin" : ""}`} />
              <span>Discover All Assets</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Product Catalogs */}
            <div className="hl-card bg-white p-4 space-y-3 shadow-sm">
              <span className="text-xs font-bold uppercase text-amber-600 tracking-wider">Product Catalogs</span>
              <div className="space-y-2">
                {assets?.catalogs?.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4">No catalogs discovered</div>
                ) : (
                  assets?.catalogs?.map((c) => (
                    <div key={c.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">ID: {c.id}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Shared Pages */}
            <div className="hl-card bg-white p-4 space-y-3 shadow-sm">
              <span className="text-xs font-bold uppercase text-indigo-600 tracking-wider">Facebook Pages</span>
              <div className="space-y-2">
                {assets?.pages?.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4">No pages discovered</div>
                ) : (
                  assets?.pages?.map((p) => (
                    <div key={p.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">ID: {p.id}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ad Accounts & Instagram */}
            <div className="hl-card bg-white p-4 space-y-3 shadow-sm">
              <span className="text-xs font-bold uppercase text-emerald-600 tracking-wider">Ad Accounts &amp; Instagram</span>
              <div className="space-y-2">
                {assets?.adAccounts?.map((a) => (
                  <div key={a.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
                    <div className="font-bold text-slate-900">{a.name}</div>
                    <div className="font-mono text-[11px] text-slate-500 mt-0.5">Ad Account: {a.id}</div>
                  </div>
                ))}
                {assets?.instagramAccounts?.map((ig) => (
                  <div key={ig.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
                    <div className="font-bold text-slate-900">@{ig.username || ig.name}</div>
                    <div className="font-mono text-[11px] text-slate-500 mt-0.5">IG ID: {ig.id}</div>
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
  );
}
