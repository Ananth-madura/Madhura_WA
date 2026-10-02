import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Smartphone, CheckCircle2, XCircle, Loader2, Settings, Wifi,
  Key, Globe, Zap, RefreshCw, AlertCircle, Shield, Bot, Send,
  BookOpen, Upload, Trash2, FileText, PhoneCall, ArrowRight,
  Copy, Check, ShieldCheck, Clock, Layers, Sparkles, Eye, EyeOff,
  Play, UserCheck, MessageSquare, Cpu, Sliders, HelpCircle, Server,
  Power, Activity, Terminal, Hash, MessageCircle, AlertTriangle,
  ChevronRight, ToggleLeft, ToggleRight, Phone, MessageSquarePlus,
  Compass, Radio, Flame, Link2, Code2, Webhook
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";
import { API } from "../config/api";
import socket from "../socket/socket";
import WhatsAppNav from "../components/WhatsAppNav";
import WAVariablePicker, { evaluateMessagePlaceholders } from "../components/WAVariablePicker";

const QUALITY_COLORS = {
  GREEN: { bg: "hl-card", text: "", badge: "hl-badge hl-badge-success", label: "Green — High Quality (Tier 1)" },
  YELLOW: { bg: "hl-card", text: "", badge: "hl-badge hl-badge-warn", label: "Yellow — Medium Quality (Tier 2)" },
  RED: { bg: "hl-card", text: "", badge: "hl-badge hl-badge-error", label: "Red — Low Quality Warning" },
};

const PROMPT_PRESETS = [
  {
    id: "sales_lead",
    title: "🎯 Sales & Lead Qualifier",
    badge: "High Conversion",
    prompt: "You are the energetic, expert sales advisor for our company. Welcome prospective clients, understand their project or product needs, highlight key advantages, and politely ask for their name, requirements, and preferred contact time so our sales engineer can share an official quotation. Keep answers engaging and concise (2-3 sentences).",
  },
  {
    id: "amc_service",
    title: "🛠️ AMC Maintenance & Service",
    badge: "Support",
    prompt: "You are our company's technical service & Annual Maintenance Contract (AMC) specialist. Help clients with equipment servicing schedules, contract renewals, preventive maintenance, and technician dispatch requests. If they report an issue, collect their site location and contact details for urgent dispatch.",
  },
  {
    id: "billing_invoice",
    title: "🧾 Billing & Invoices Helper",
    badge: "Finance",
    prompt: "You are our customer billing assistant. Assist clients with invoice payment inquiries, due date reminders, and payment receipts. Use CRM tools to verify invoice details when asked. Maintain a polite and professional tone.",
  },
  {
    id: "general_crm",
    title: "💼 General Corporate Assistant",
    badge: "All-Rounder",
    prompt: "You are the official intelligent WhatsApp assistant for our company. You are professional, polite, concise, and helpful. Answer customer queries conversationally (2-4 sentences max). Help them with product/service inquiries, pricing quotes, AMC maintenance, invoice questions, and support.",
  },
];

const MODEL_PRESETS = [
  { label: "Llama 3.3 70B (Free / Ultra-Fast)", value: "meta-llama/llama-3.3-70b-instruct:free", provider: "openrouter", badge: "Free" },
  { label: "DeepSeek R1 (Free / Reasoning)", value: "deepseek/deepseek-r1:free", provider: "openrouter", badge: "Free" },
  { label: "GPT-4o Mini (OpenAI Flagship Speed)", value: "gpt-4o-mini", provider: "openai", badge: "OpenAI" },
  { label: "GPT-4o (OpenAI Supreme Intelligence)", value: "gpt-4o", provider: "openai", badge: "OpenAI" },
  { label: "Gemini 2.0 Flash (Google Next-Gen)", value: "gemini-2.0-flash", provider: "gemini", badge: "Google" },
  { label: "Llama 3.3 70B Versatile (Groq Speed)", value: "llama-3.3-70b-versatile", provider: "groq", badge: "Groq" },
  { label: "DeepSeek V3 / Chat (DeepSeek Direct)", value: "deepseek-chat", provider: "deepseek", badge: "DeepSeek" },
];

export default function WhatsAppAccounts() {
  const [activeTab, setActiveTab] = useState("ai"); // "ai" | "web" | "meta" | "welcome" | "test"
  const [status, setStatus] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [config, setConfig] = useState(null);
  const [qualityRating, setQualityRating] = useState(null);
  const [aiStats, setAiStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── AI Service Configuration ──
  const [aiForm, setAiForm] = useState({
    enabled: false,
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    system_prompt: "",
    api_key: "",
    auto_lead_capture: true,
    human_handoff_keywords: "human, agent, executive, support, speak to person, call me",
    handoff_cooldown_min: 180,
    typing_delay_sec: 2,
    custom_api_url: "",
    temperature: 0.70,
    max_tokens: 350,
    working_hours_only: false,
    work_start_time: "09:00",
    work_end_time: "20:00",
    fallback_message: "",
    enable_crm_tools: true,
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiSaveLoading, setAiSaveLoading] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [keyTesting, setKeyTesting] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // ── AI Playground & Simulator ──
  const [aiTestMessage, setAiTestMessage] = useState("Hi, what services and AMC packages do you offer?");
  const [aiTestPhone, setAiTestPhone] = useState("919876543210");
  const [aiTestName, setAiTestName] = useState("Alex Johnson");
  const [aiTestReply, setAiTestReply] = useState("");
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestError, setAiTestError] = useState("");

  // ── Knowledge Base ──
  const [kbDocs, setKbDocs] = useState([]);
  const [kbUploading, setKbUploading] = useState(false);
  const [kbError, setKbError] = useState("");

  // ── WhatsApp Web Live QR & Session Control ──
  const [qrCode, setQrCode] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(25);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectMsg, setReconnectMsg] = useState("");
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // ── Universal External CRM Integration State ──
  const [crmWebhookUrl, setCrmWebhookUrl] = useState("");
  const [crmWebhookSecret, setCrmWebhookSecret] = useState("");
  const [crmWebhookSaving, setCrmWebhookSaving] = useState(false);
  const [crmWebhookSaved, setCrmWebhookSaved] = useState(false);
  const [crmWebhookTesting, setCrmWebhookTesting] = useState(false);
  const [crmWebhookTestResult, setCrmWebhookTestResult] = useState(null);
  const [crmDeliveries, setCrmDeliveries] = useState([]);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [codeTab, setCodeTab] = useState("curl");

  // ── Meta Cloud API Form ──
  const [metaForm, setMetaForm] = useState({
    phone_number_id: "",
    access_token: "",
    waba_id: "",
    app_secret: "",
    verify_token: "crm_verify_123",
    business_account_id: "",
  });
  const [metaSaveLoading, setMetaSaveLoading] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);
  const [metaTestLoading, setMetaTestLoading] = useState(false);
  const [metaTestResult, setMetaTestResult] = useState(null);

  // ── Welcome Auto-Reply Settings ──
  const [welcomeForm, setWelcomeForm] = useState({
    enabled: true,
    welcome_type: "text",
    welcome_text: "Hello {name}! 👋 Thank you for contacting our team. How can we assist you today?",
    cooldown_hours: 24,
    working_hours_only: false,
    start_time: "09:00",
    end_time: "20:00",
  });
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeSaved, setWelcomeSaved] = useState(false);

  // ── Live Test Dispatcher ──
  const [testPhone, setTestPhone] = useState("");
  const [testMsgText, setTestMsgText] = useState("Hello from MADHURA CRM WhatsApp System! 🚀");
  const [testEngine, setTestEngine] = useState("auto"); // "auto" | "web" | "cloud_api"
  const [sendingTestMsg, setSendingTestMsg] = useState(false);
  const [testSendResult, setTestSendResult] = useState(null);

  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const webConnected = Boolean(status?.web?.connected || status?.isWeb);
  const cloudConfigured = Boolean(status?.cloud?.configured || status?.isCloud || config?.phone_number_id);
  const activeEngine = status?.activeEngine || (cloudConfigured && webConnected ? "Dual (Cloud API + Web)" : cloudConfigured ? "Meta Cloud API" : webConnected ? "WhatsApp Web Session" : "Offline");
  const qualityInfo = qualityRating?.quality_rating
    ? (QUALITY_COLORS[qualityRating.quality_rating] || QUALITY_COLORS.GREEN)
    : QUALITY_COLORS.GREEN;
  const webhookUrl = `${window.location.origin}/api/wa/webhook`;

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  // ── Fetch All WhatsApp & AI Settings ──
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, qRes, aiRes, accRes, statsRes, wRes] = await Promise.all([
        axios.get(`${API}/api/whatsapp/unified-status`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/config/user-config`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/analytics/quality-rating`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/ai/settings`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/whatsapp/account`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/ai/stats`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/automations/welcome-settings`, { headers: headers() }).catch(() => null),
      ]);

      if (sRes?.data) setStatus(sRes.data);
      if (accRes?.data) setAccountDetails(accRes.data);
      if (qRes?.data) setQualityRating(qRes.data);
      if (statsRes?.data) setAiStats(statsRes.data);

      if (cRes?.data?.hasConfig && cRes.data.config) {
        setConfig(cRes.data.config);
        setMetaForm((prev) => ({
          ...prev,
          phone_number_id: cRes.data.config.phone_number_id || "",
          waba_id: cRes.data.config.waba_id || "",
          verify_token: cRes.data.config.verify_token || "crm_verify_123",
          business_account_id: cRes.data.config.business_account_id || "",
          access_token: "••••••••••••••••",
        }));
      }

      if (wRes?.data) {
        setWelcomeForm((prev) => ({
          ...prev,
          ...wRes.data,
        }));
      }

      if (aiRes?.data) {
        setHasApiKey(aiRes.data.has_api_key);
        setMaskedApiKey(aiRes.data.masked_api_key || "");
        setAiForm((prev) => ({
          ...prev,
          enabled: !!aiRes.data.enabled,
          provider: aiRes.data.provider || "openrouter",
          model: aiRes.data.model || "meta-llama/llama-3.3-70b-instruct:free",
          system_prompt: aiRes.data.system_prompt || "",
          auto_lead_capture: aiRes.data.auto_lead_capture !== false,
          human_handoff_keywords: aiRes.data.human_handoff_keywords || "human, agent, executive, support, speak to person, call me",
          handoff_cooldown_min: aiRes.data.handoff_cooldown_min || 180,
          typing_delay_sec: aiRes.data.typing_delay_sec >= 0 ? aiRes.data.typing_delay_sec : 2,
          custom_api_url: aiRes.data.custom_api_url || "",
          temperature: aiRes.data.temperature || 0.70,
          max_tokens: aiRes.data.max_tokens || 350,
          working_hours_only: !!aiRes.data.working_hours_only,
          work_start_time: aiRes.data.work_start_time || "09:00",
          work_end_time: aiRes.data.work_end_time || "20:00",
          fallback_message: aiRes.data.fallback_message || "",
          enable_crm_tools: aiRes.data.enable_crm_tools !== false,
          api_key: "",
        }));
      }

      try {
        const crmRes = await axios.get(`${API}/api/v1/webhook/deliveries`, { headers: headers() }).catch(() => null);
        if (crmRes?.data) {
          if (crmRes.data.webhookUrl) setCrmWebhookUrl(crmRes.data.webhookUrl);
          if (crmRes.data.deliveries) setCrmDeliveries(crmRes.data.deliveries);
        }
      } catch (_) {}
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
    setLoading(false);
  };

  const fetchKbDocs = async () => {
    try {
      const { data } = await axios.get(`${API}/api/wa/ai/knowledge`, { headers: headers() });
      setKbDocs(data || []);
    } catch {}
  };

  const fetchQr = useCallback(async (force = false) => {
    setQrLoading(true);
    try {
      const url = force ? `${API}/api/whatsapp/qr?refresh=true` : `${API}/api/whatsapp/qr`;
      const res = await axios.get(url, { headers: headers() });
      if (res.data?.qr) {
        setQrCode(res.data.qr);
        if (res.data.qrDataUrl) setQrDataUrl(res.data.qrDataUrl);
        setQrCountdown(25);
        setQrLoading(false);
      } else if (res.data?.connected) {
        setQrCode(null);
        setQrDataUrl(null);
        setQrLoading(false);
        fetchAll();
      } else if (res.data?.initializing) {
        // Polling fallback while backend Puppeteer browser spins up
        let attempts = 0;
        const timer = setInterval(async () => {
          attempts++;
          try {
            const pRes = await axios.get(`${API}/api/whatsapp/qr`, { headers: headers() });
            if (pRes.data?.qr) {
              setQrCode(pRes.data.qr);
              if (pRes.data.qrDataUrl) setQrDataUrl(pRes.data.qrDataUrl);
              setQrCountdown(25);
              setQrLoading(false);
              clearInterval(timer);
            } else if (pRes.data?.connected) {
              setQrCode(null);
              setQrDataUrl(null);
              setQrLoading(false);
              fetchAll();
              clearInterval(timer);
            } else if (attempts >= 12) {
              setQrLoading(false);
              clearInterval(timer);
            }
          } catch (_) {
            if (attempts >= 12) {
              setQrLoading(false);
              clearInterval(timer);
            }
          }
        }, 2500);
      } else {
        setQrLoading(false);
      }
    } catch (err) {
      console.error("QR Fetch error:", err);
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchKbDocs();
  }, []);

  // Socket.IO real-time QR and connection sync
  useEffect(() => {
    const handleWaQr = (data) => {
      const qrVal = data?.qr || data?.message?.qr || (typeof data === "string" ? data : null);
      if (qrVal) {
        setQrCode(qrVal);
        if (data?.qrDataUrl) setQrDataUrl(data.qrDataUrl);
        setQrCountdown(25);
        setQrLoading(false);
      }
    };

    const handleWaReady = () => {
      setQrCode(null);
      setQrDataUrl(null);
      setQrLoading(false);
      fetchAll();
    };

    const handleWaDisconnected = () => {
      fetchAll();
    };

    socket.on("wa_qr", handleWaQr);
    socket.on("wa_authenticated", handleWaReady);
    socket.on("wa_ready", handleWaReady);
    socket.on("wa_connected", handleWaReady);
    socket.on("wa_disconnected", handleWaDisconnected);

    return () => {
      socket.off("wa_qr", handleWaQr);
      socket.off("wa_authenticated", handleWaReady);
      socket.off("wa_ready", handleWaReady);
      socket.off("wa_connected", handleWaReady);
      socket.off("wa_disconnected", handleWaDisconnected);
    };
  }, [fetchAll]);

  // QR auto-countdown timer (visual indicator of WhatsApp Web's QR lifespan)
  useEffect(() => {
    let timer;
    if (activeTab === "web" && qrCode && !webConnected) {
      timer = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeTab, qrCode, webConnected]);

  // ── AI Master Toggle ──
  const handleToggleAiService = async () => {
    setToggleLoading(true);
    try {
      const targetState = !aiForm.enabled;
      await axios.post(`${API}/api/wa/ai/toggle`, { enabled: targetState }, { headers: headers() });
      setAiForm((prev) => ({ ...prev, enabled: targetState }));
      fetchAll();
    } catch (err) {
      alert("Failed to toggle AI service: " + (err.response?.data?.error || err.message));
    }
    setToggleLoading(false);
  };

  // ── Test API Key Live ──
  const handleTestApiKey = async () => {
    setKeyTesting(true);
    setKeyTestResult(null);
    try {
      const res = await axios.post(
        `${API}/api/wa/ai/validate-key`,
        {
          provider: aiForm.provider,
          api_key: aiForm.api_key || undefined,
          model: aiForm.model,
          custom_api_url: aiForm.custom_api_url || undefined,
        },
        { headers: headers() }
      );
      setKeyTestResult({
        success: true,
        latencyMs: res.data.latencyMs,
        model: res.data.modelUsed,
        message: res.data.message || "Key validated successfully!",
      });
    } catch (err) {
      setKeyTestResult({
        success: false,
        latencyMs: err.response?.data?.latencyMs,
        error: err.response?.data?.error || "Key validation failed",
      });
    }
    setKeyTesting(false);
  };

  // ── Save AI Settings ──
  const handleSaveAiSettings = async () => {
    setAiSaveLoading(true);
    setAiSaved(false);
    try {
      await axios.put(`${API}/api/wa/ai/settings`, aiForm, { headers: headers() });
      setAiSaved(true);
      setAiForm((prev) => ({ ...prev, api_key: "" }));
      fetchAll();
      setTimeout(() => setAiSaved(false), 3000);
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to save AI settings");
    }
    setAiSaveLoading(false);
  };

  // ── Test AI Interactive Reply ──
  const handleTestAiReply = async () => {
    if (!aiTestMessage.trim()) return;
    setAiTestLoading(true);
    setAiTestReply("");
    setAiTestError("");
    try {
      const { data } = await axios.post(
        `${API}/api/wa/ai/test`,
        {
          message: aiTestMessage.trim(),
          phone: aiTestPhone.trim() || "919876543210",
          contact_name: aiTestName.trim() || "Demo Client",
        },
        { headers: headers() }
      );
      setAiTestReply(data.reply || "");
    } catch (err) {
      setAiTestError(err.response?.data?.error || "Simulation failed. Please verify your AI API key is configured.");
    }
    setAiTestLoading(false);
  };

  // ── Upload Knowledge Document ──
  const handleUploadKbDoc = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKbUploading(true);
    setKbError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API}/api/wa/ai/knowledge`, formData, { headers: headers() });
      fetchKbDocs();
    } catch (err) {
      setKbError(err.response?.data?.error || "Upload failed. Please upload .txt, .md, .csv, or .docx");
    }
    setKbUploading(false);
    e.target.value = "";
  };

  const handleDeleteKbDoc = async (id) => {
    if (!window.confirm("Remove this document from the AI knowledge base?")) return;
    try {
      await axios.delete(`${API}/api/wa/ai/knowledge/${id}`, { headers: headers() });
      fetchKbDocs();
    } catch {}
  };

  // ── WhatsApp Web Actions (Reconnect, Disconnect, Reset, Pairing Code) ──
  const handleReconnectWeb = async () => {
    setReconnecting(true);
    setReconnectMsg("");
    try {
      const res = await axios.post(`${API}/api/whatsapp/reconnect`, {}, { headers: headers() });
      setReconnectMsg(res.data?.message || "Reconnection triggered in background.");
      setTimeout(() => {
        fetchAll();
        setReconnecting(false);
      }, 3000);
    } catch (err) {
      setReconnectMsg("Reconnect error: " + (err.response?.data?.error || err.message));
      setReconnecting(false);
    }
  };

  const handleLogoutWeb = async () => {
    if (!window.confirm("Disconnect WhatsApp Web session? You will need to scan QR code again.")) return;
    try {
      await axios.post(`${API}/api/whatsapp/logout`, { purge: true }, { headers: headers() });
      try {
        sessionStorage.removeItem("wa_cached_status");
        sessionStorage.removeItem("wa_cached_chats");
        sessionStorage.removeItem("wa_active_chat");
        localStorage.removeItem("wa_cached_status");
        localStorage.removeItem("wa_cached_chats");
        localStorage.removeItem("wa_active_chat");
      } catch (_) {}
      setQrCode(null);
      fetchAll();
    } catch (err) {
      alert("Logout failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleHardResetWeb = async () => {
    if (!window.confirm("Hard reset WhatsApp session? This cleans temporary cache files and triggers a fresh QR scan.")) return;
    setQrLoading(true);
    try {
      await axios.post(`${API}/api/whatsapp/reset-session`, {}, { headers: headers() });
      setTimeout(() => {
        fetchQr(true);
      }, 2000);
    } catch (err) {
      alert("Reset failed: " + (err.response?.data?.error || err.message));
      setQrLoading(false);
    }
  };

  const handleGeneratePairingCode = async (e) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;
    setPairingLoading(true);
    setPairingCode("");
    try {
      const cleanPhone = pairingPhone.replace(/\D/g, "");
      const res = await axios.get(`${API}/api/whatsapp/pairing-code?phone=${cleanPhone}`, { headers: headers() });
      setPairingCode(res.data.code);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to generate pairing code");
    }
    setPairingLoading(false);
  };

  const handleSyncContacts = async () => {
    setSyncingContacts(true);
    setSyncResult(null);
    try {
      const res = await axios.post(`${API}/api/whatsapp/sync-contacts`, {}, { headers: headers() });
      setSyncResult({ success: true, message: `Synced ${res.data?.totalCount || 0} contacts successfully!` });
      fetchAll();
    } catch (err) {
      setSyncResult({ success: false, message: err.response?.data?.error || "Sync failed" });
    }
    setSyncingContacts(false);
  };

  // ── Meta Cloud API Actions ──
  const handleSaveMetaConfig = async () => {
    if (!metaForm.phone_number_id) {
      alert("Phone Number ID is required");
      return;
    }
    setMetaSaveLoading(true);
    setMetaSaved(false);
    try {
      await axios.post(`${API}/api/wa/config/save-config`, metaForm, { headers: headers() });
      setMetaSaved(true);
      fetchAll();
      setTimeout(() => setMetaSaved(false), 3000);
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || "Failed to save Meta config");
    }
    setMetaSaveLoading(false);
  };

  const handleTestMetaConnection = async () => {
    if (!metaForm.phone_number_id) {
      alert("Please enter Phone Number ID to test");
      return;
    }
    setMetaTestLoading(true);
    setMetaTestResult(null);
    try {
      const res = await axios.post(`${API}/api/wa/config/test-connection`, metaForm, { headers: headers() });
      setMetaTestResult({ success: true, data: res.data });
    } catch (err) {
      setMetaTestResult({
        success: false,
        error: err.response?.data?.message || err.message,
      });
    }
    setMetaTestLoading(false);
  };

  // ── Welcome Settings Actions ──
  const handleSaveWelcomeSettings = async () => {
    setWelcomeSaving(true);
    setWelcomeSaved(false);
    try {
      await axios.put(`${API}/api/wa/automations/welcome-settings`, welcomeForm, { headers: headers() });
      setWelcomeSaved(true);
      setTimeout(() => setWelcomeSaved(false), 3000);
    } catch (err) {
      alert("Failed to save welcome settings: " + (err.response?.data?.error || err.message));
    }
    setWelcomeSaving(false);
  };

  // ── Send Test Message ──
  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setSendingTestMsg(true);
    setTestSendResult(null);
    try {
      const res = await axios.post(
        `${API}/api/whatsapp/test-send`,
        {
          phone: testPhone.trim(),
          message: testMsgText.trim(),
          engine: testEngine !== "auto" ? testEngine : undefined,
        },
        { headers: headers() }
      );
      setTestSendResult({
        success: true,
        message: `Message sent successfully to +${testPhone.trim()} via ${res.data?.engineUsed || "Active WhatsApp Engine"}!`,
      });
    } catch (err) {
      setTestSendResult({ success: false, error: err.response?.data?.error || err.message });
    }
    setSendingTestMsg(false);
  };

  // ── Universal External CRM Webhook Actions ──
  const handleSaveCrmWebhook = async () => {
    setCrmWebhookSaving(true);
    setCrmWebhookSaved(false);
    try {
      await axios.post(
        `${API}/api/v1/webhook/configure`,
        {
          webhookUrl: crmWebhookUrl,
          secret: crmWebhookSecret || undefined,
        },
        { headers: headers() }
      );
      setCrmWebhookSaved(true);
      setTimeout(() => setCrmWebhookSaved(false), 3000);
      fetchAll();
    } catch (err) {
      alert("Failed to save CRM Webhook: " + (err.response?.data?.error || err.message));
    }
    setCrmWebhookSaving(false);
  };

  const handleTestCrmWebhook = async () => {
    setCrmWebhookTesting(true);
    setCrmWebhookTestResult(null);
    try {
      const res = await axios.post(
        `${API}/api/v1/webhook/test`,
        {
          webhookUrl: crmWebhookUrl || undefined,
        },
        { headers: headers() }
      );
      setCrmWebhookTestResult(res.data?.result || res.data);
      fetchAll();
    } catch (err) {
      setCrmWebhookTestResult({ success: false, error: err.response?.data?.error || err.message });
    }
    setCrmWebhookTesting(false);
  };

  const applyPreset = (preset) => {
    setAiForm((prev) => ({ ...prev, system_prompt: preset.prompt }));
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === "webhook") {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="hl-page">
      <WhatsAppNav />

      {/* Hero Header & Real-Time Status Hub */}
      <div className="hl-card p-4 sm:p-5 border mb-4 sm:mb-6 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5 min-w-0">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0">
              <Bot size={26} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="hl-title">WhatsApp Settings & Control Hub</h1>
                <span className={`hl-badge flex items-center gap-1.5 ${
                  cloudConfigured || webConnected ? "hl-badge-success" : "bg-gray-100 text-gray-600 border-gray-200"
                }`}>
                  <span className={`w-2 h-2 rounded-full bg-current ${cloudConfigured || webConnected ? "animate-pulse" : ""}`} />
                  <span>{activeEngine}</span>
                </span>
                <span className={`hl-badge flex items-center gap-1.5 ${
                  aiForm.enabled ? "hl-badge-accent" : ""
                }`}>
                  <span className={`w-2 h-2 rounded-full bg-current ${aiForm.enabled ? "animate-pulse" : ""}`} />
                  <span>AI Assistant: {aiForm.enabled ? "ACTIVE" : "PAUSED"}</span>
                </span>
              </div>
              <p className="hl-subtitle mt-1">
                Full real-time control over AI Intelligence, API Keys, Multi-Device WhatsApp Web QR, Meta Cloud API, and Automated Workflows.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
            <button
              onClick={handleToggleAiService}
              disabled={toggleLoading}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 disabled:opacity-50 ${
                aiForm.enabled
                  ? "hl-btn-danger-ghost"
                  : "hl-btn-primary"
              }`}
            >
              {toggleLoading ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
              <span>{aiForm.enabled ? "Pause AI Service" : "Start AI Service"}</span>
            </button>

            <button
              onClick={fetchAll}
              className="hl-btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Strip */}
        <div className="hl-kpis mt-5 pt-4 border-t">
          <div className="hl-kpi p-3 flex items-center gap-3 border">
            <div className="p-2 rounded-lg">
              <MessageSquare size={16} />
            </div>
            <div>
              <p className="hl-kpi-label">AI Auto-Replies</p>
              <p className="hl-kpi-num">{aiStats?.totalReplies || 0}</p>
            </div>
          </div>

          <div className="hl-kpi p-3 flex items-center gap-3 border">
            <div className="p-2 rounded-lg">
              <UserCheck size={16} />
            </div>
            <div>
              <p className="hl-kpi-label">Leads Captured</p>
              <p className="hl-kpi-num">{aiStats?.leadsCaptured || 0}</p>
            </div>
          </div>

          <div className="hl-kpi p-3 flex items-center gap-3 border">
            <div className="p-2 rounded-lg">
              <BookOpen size={16} />
            </div>
            <div>
              <p className="hl-kpi-label">Knowledge Docs</p>
              <p className="hl-kpi-num">{kbDocs.length} Indexed</p>
            </div>
          </div>

          <div className="hl-kpi p-3 flex items-center gap-3 border">
            <div className="p-2 rounded-lg">
              <PhoneCall size={16} />
            </div>
            <div>
              <p className="hl-kpi-label">Active Handoffs</p>
              <p className="hl-kpi-num">{aiStats?.activeHandoffs || 0} Chats</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("ai")}
          className={`hl-tab flex items-center gap-2 px-4 py-2.5 shrink-0 ${
            activeTab === "ai"
              ? "is-active"
              : ""
          }`}
        >
          <Bot size={16} />
          <span>🤖 AI Intelligence & API Keys</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("web");
            if (!webConnected && !qrCode) fetchQr(false);
          }}
          className={`hl-tab flex items-center gap-2 px-4 py-2.5 shrink-0 ${
            activeTab === "web"
              ? "is-active"
              : ""
          }`}
        >
          <Smartphone size={16} />
          <span>📱 WhatsApp Web & Live QR</span>
        </button>

        <button
          onClick={() => setActiveTab("meta")}
          className={`hl-tab flex items-center gap-2 px-4 py-2.5 shrink-0 ${
            activeTab === "meta"
              ? "is-active"
              : ""
          }`}
        >
          <Key size={16} />
          <span>☁️ Meta Cloud API (Official)</span>
        </button>

        <button
          onClick={() => setActiveTab("welcome")}
          className={`hl-tab flex items-center gap-2 px-4 py-2.5 shrink-0 ${
            activeTab === "welcome"
              ? "is-active"
              : ""
          }`}
        >
          <Sparkles size={16} />
          <span>👋 Auto-Reply & Welcome</span>
        </button>

        <button
          onClick={() => setActiveTab("test")}
          className={`hl-tab flex items-center gap-2 px-4 py-2.5 shrink-0 ${
            activeTab === "test"
              ? "is-active"
              : ""
          }`}
        >
          <Send size={16} />
          <span>⚡ Live Test Dispatcher</span>
        </button>

        <button
          onClick={() => setActiveTab("connector")}
          className={`hl-tab flex items-center gap-2 px-4 py-2.5 shrink-0 ${
            activeTab === "connector"
              ? "is-active"
              : ""
          }`}
        >
          <Link2 size={16} />
          <span>🔗 Connect Any CRM (API & Webhooks)</span>
        </button>
      </div>

      {loading && !status ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 size={36} className="animate-spin" />
          <p className="hl-subtitle">Loading WhatsApp & AI Configuration...</p>
        </div>
      ) : (
        <div>
          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: AI INTELLIGENCE & API KEYS MASTER ENGINE
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "ai" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
              {/* Left Column (2 cols): AI Settings Form & Knowledge Base */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
                {/* 1. API Key & Provider Card */}
                <div className="hl-card border p-4 sm:p-6 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b">
                    <div>
                      <h2 className="font-black text-base flex items-center gap-2">
                        <Key size={18} className="" />
                        <span>AI Provider Credentials & Engine Model</span>
                      </h2>
                      <p className="hl-subtitle mt-0.5">
                        Supply your OpenAI, OpenRouter, Google Gemini, Groq, or DeepSeek API key to power 24/7 intelligent replies.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleAiService}
                        disabled={toggleLoading}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                          aiForm.enabled
                            ? "hl-badge hl-badge-accent"
                            : "hl-badge"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full bg-current ${aiForm.enabled ? "animate-pulse" : ""}`} />
                        <span>{aiForm.enabled ? "AI Service: RUNNING" : "AI Service: STOPPED"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs min-w-0">
                    {/* Provider & Model Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="hl-section-label block mb-1">AI Provider Platform</label>
                        <select
                          value={aiForm.provider}
                          onChange={(e) => setAiForm({ ...aiForm, provider: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 bg-white font-semibold text-gray-800 shadow-sm"
                        >
                          <option value="openrouter">⚡ OpenRouter (100+ Free & Paid Models)</option>
                          <option value="openai">🧠 OpenAI (GPT-4o / GPT-4o-mini / ChatGPT)</option>
                          <option value="gemini">✨ Google Gemini (Gemini 2.0 Flash / Pro)</option>
                          <option value="groq">🚀 Groq (Ultra-Speed Llama 3.3 70B)</option>
                          <option value="deepseek">🐋 DeepSeek (DeepSeek V3 / R1 Direct)</option>
                          <option value="custom">💻 Custom OpenAI-Compatible / Local Ollama</option>
                        </select>
                      </div>

                      <div>
                        <label className="hl-section-label block mb-1">Model Name / Identifier</label>
                        <input
                          type="text"
                          value={aiForm.model}
                          onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })}
                          placeholder="e.g. meta-llama/llama-3.3-70b-instruct:free"
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono text-gray-800 shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Quick Model Chips */}
                    <div>
                      <span className="hl-section-label mb-1.5 block">Recommended Fast Models:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {MODEL_PRESETS.map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setAiForm({ ...aiForm, model: m.value, provider: m.provider })}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition flex items-center gap-1.5 ${
                              aiForm.model === m.value
                                ? "hl-btn-primary"
                                : "hl-btn-secondary"
                            }`}
                          >
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Base URL (if custom provider) */}
                    {aiForm.provider === "custom" && (
                      <div>
                        <label className="hl-section-label block mb-1">Custom API Base URL</label>
                        <input
                          type="text"
                          value={aiForm.custom_api_url}
                          onChange={(e) => setAiForm({ ...aiForm, custom_api_url: e.target.value })}
                          placeholder="e.g. http://localhost:11434/v1"
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                        />
                      </div>
                    )}

                    {/* API Key Input & Real-Time Validator */}
                    <div className="hl-card p-4 border space-y-3 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="hl-section-label flex items-center gap-1.5 flex-wrap min-w-0">
                          <span>API Secret Key</span>
                          {hasApiKey && <span className="font-normal">({maskedApiKey} saved)</span>}
                        </label>
                        {hasApiKey && (
                          <span className="hl-badge hl-badge-success text-[11px] px-2.5 py-0.5 font-bold">
                            ✓ Key Active
                          </span>
                        )}
                      </div>

                      <div className="relative min-w-0">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={aiForm.api_key}
                          onChange={(e) => setAiForm({ ...aiForm, api_key: e.target.value })}
                          placeholder={hasApiKey ? "Enter new API key to replace existing, or leave blank to keep" : "e.g. sk-or-v1-..., sk-..., AIza..."}
                          className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      {/* Live API Key Validation Result */}
                      {keyTestResult && (
                        <div className={`hl-badge p-3 text-xs font-semibold flex items-center justify-between gap-2 ${
                          keyTestResult.success
                            ? "hl-badge-success"
                            : "hl-badge-error"
                        }`}>
                          <div className="flex items-center gap-2">
                            {keyTestResult.success ? <CheckCircle2 size={16} className="" /> : <AlertCircle size={16} className="" />}
                            <span>{keyTestResult.message || keyTestResult.error}</span>
                          </div>
                          {keyTestResult.latencyMs && (
                            <span className="hl-id px-2 py-0.5 rounded-md text-[10px] font-mono border">
                              {keyTestResult.latencyMs}ms
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p className="text-[11px] min-w-0 flex-1">
                          Keys are AES-256 encrypted at rest before storing in database.
                        </p>
                        <button
                          type="button"
                          onClick={handleTestApiKey}
                          disabled={keyTesting}
                          className="hl-btn-secondary px-3.5 py-1.5 border rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {keyTesting ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} className="" />}
                          <span>{keyTesting ? "Testing Key..." : "Test & Validate Key"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. System Persona & Role Presets */}
                <div className="hl-card border p-6 space-y-4 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b">
                    <div>
                      <h2 className="font-black text-base flex items-center gap-2">
                        <Sparkles size={18} className="" />
                        <span>AI Persona & Prompt Studio</span>
                      </h2>
                      <p className="hl-subtitle mt-0.5">Define your AI assistant's personality, company knowledge, and tone of voice.</p>
                    </div>
                    <span className="text-[11px] font-medium">Click a role preset to fill</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PROMPT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className="p-3 rounded-xl text-left border bg-slate-50 hover:bg-purple-50 border-gray-200 hover:border-purple-200 transition flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold">{p.title}</span>
                          <span className="hl-badge hl-badge-accent text-[10px] font-bold px-2 py-0.5">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] line-clamp-2">{p.prompt}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="hl-section-label block">Custom System Instruction Prompt</label>
                    <WAVariablePicker
                      onInsert={(tag) => setAiForm((prev) => ({ ...prev, system_prompt: (prev.system_prompt || "") + " " + tag }))}
                    />
                    <textarea
                      rows={4}
                      value={aiForm.system_prompt}
                      onChange={(e) => setAiForm({ ...aiForm, system_prompt: e.target.value })}
                      placeholder="You are an expert customer service assistant for {{company}}. Address the user as {{name}}, and assist with {{service}} inquiries in {{city}}."
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 resize-none font-sans text-gray-800"
                    />
                  </div>

                  {/* Fallback Message */}
                  <div>
                    <label className="hl-section-label block mb-1">Graceful Fallback Message (Out of Scope)</label>
                    <input
                      type="text"
                      value={aiForm.fallback_message}
                      onChange={(e) => setAiForm({ ...aiForm, fallback_message: e.target.value })}
                      placeholder="e.g. Thank you for reaching out! Our executive will get in touch with you shortly."
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* 3. Advanced Fine-Tuning & Scheduling Controls */}
                <div className="hl-card border p-6 space-y-4 text-xs">
                  <h2 className="font-black text-base flex items-center gap-2 pb-3 border-b">
                    <Sliders size={18} className="" />
                    <span>Fine-Tuning, Working Hours & Human Handoff</span>
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Temperature Slider */}
                    <div className="hl-card p-3 border">
                      <div className="flex justify-between font-bold mb-1">
                        <span>Creativity (Temp):</span>
                        <span className="hl-id font-mono">{aiForm.temperature}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={aiForm.temperature}
                        onChange={(e) => setAiForm({ ...aiForm, temperature: parseFloat(e.target.value) })}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] mt-1">
                        <span>Precise (0.0)</span>
                        <span>Creative (1.0)</span>
                      </div>
                    </div>

                    {/* Max Tokens Slider */}
                    <div className="hl-card p-3 border">
                      <div className="flex justify-between font-bold mb-1">
                        <span>Max Response Tokens:</span>
                        <span className="hl-id font-mono">{aiForm.max_tokens}</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="1000"
                        step="50"
                        value={aiForm.max_tokens}
                        onChange={(e) => setAiForm({ ...aiForm, max_tokens: parseInt(e.target.value, 10) })}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] mt-1">
                        <span>Concise (100)</span>
                        <span>Detailed (1000)</span>
                      </div>
                    </div>

                    {/* Typing Delay Simulation */}
                    <div className="hl-card p-3 border">
                      <div className="flex justify-between font-bold mb-1">
                        <span>Typing Delay:</span>
                        <span className="hl-id font-mono">{aiForm.typing_delay_sec}s</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="6"
                        step="1"
                        value={aiForm.typing_delay_sec}
                        onChange={(e) => setAiForm({ ...aiForm, typing_delay_sec: parseInt(e.target.value, 10) })}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] mt-1">
                        <span>Instant (0s)</span>
                        <span>Human (6s)</span>
                      </div>
                    </div>
                  </div>

                  {/* Working Hours Filter */}
                  <div className="hl-card p-4 border space-y-3 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs flex items-center gap-1.5">
                          <Clock size={16} className="" />
                          <span>Working Hours Schedule Filter</span>
                        </p>
                        <p className="text-[11px]">
                          When enabled, AI will only reply during configured business hours.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiForm.working_hours_only}
                        onChange={(e) => setAiForm({ ...aiForm, working_hours_only: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    {aiForm.working_hours_only && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                        <div>
                          <label className="hl-section-label block mb-1">Start Time</label>
                          <input
                            type="time"
                            value={aiForm.work_start_time}
                            onChange={(e) => setAiForm({ ...aiForm, work_start_time: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="hl-section-label block mb-1">End Time</label>
                          <input
                            type="time"
                            value={aiForm.work_end_time}
                            onChange={(e) => setAiForm({ ...aiForm, work_end_time: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CRM Tools & Lead Capture Toggles */}
                  <div className="hl-card p-4 border space-y-3 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs flex items-center gap-1.5">
                          <UserCheck size={16} className="" />
                          <span>Automated CRM Lead Capture</span>
                        </p>
                        <p className="text-[11px]">
                          Auto-extract customer names, inquiries, and requirements into CRM Telecalls & Contacts (Source = WhatsApp AI).
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiForm.auto_lead_capture}
                        onChange={(e) => setAiForm({ ...aiForm, auto_lead_capture: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="font-bold text-xs flex items-center gap-1.5">
                          <Cpu size={16} className="" />
                          <span>Enable CRM Action Tools (Invoices, Callback, Services)</span>
                        </p>
                        <p className="text-[11px]">
                          Allows AI to look up invoice statuses, schedule callbacks, and fetch company services dynamically.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiForm.enable_crm_tools}
                        onChange={(e) => setAiForm({ ...aiForm, enable_crm_tools: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="pt-2 border-t space-y-2">
                      <div>
                        <label className="hl-section-label block mb-1">Human Agent Handoff Keywords</label>
                        <input
                          type="text"
                          value={aiForm.human_handoff_keywords}
                          onChange={(e) => setAiForm({ ...aiForm, human_handoff_keywords: e.target.value })}
                          placeholder="human, agent, executive, support, speak to person, call me"
                          className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-bold">Handoff Cooldown (Pause AI):</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="15"
                            max="1440"
                            value={aiForm.handoff_cooldown_min}
                            onChange={(e) => setAiForm({ ...aiForm, handoff_cooldown_min: parseInt(e.target.value, 10) || 180 })}
                            className="w-20 px-2 py-1 bg-white border border-gray-200 rounded-lg font-mono text-center"
                          />
                          <span className="text-xs">minutes</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Knowledge Base Documents */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="hl-section-label flex items-center gap-1.5">
                        <BookOpen size={16} className="" />
                        <span>Knowledge Base Documents ({kbDocs.length})</span>
                      </label>
                      <label className="hl-btn-secondary flex items-center gap-1 text-xs font-bold cursor-pointer px-3 py-1.5 rounded-xl border transition">
                        <Upload size={13} />
                        <span>Upload Document (.pdf/.docx/.csv/.txt/.md/.json)</span>
                        <input type="file" accept=".pdf,.docx,.txt,.md,.csv,.json,.tsv" onChange={handleUploadKbDoc} className="hidden" />
                      </label>
                    </div>

                    {kbError && (
                      <div className="hl-badge hl-badge-error p-2.5 mb-2 border text-xs font-semibold">
                        {kbError}
                      </div>
                    )}

                    {kbUploading && (
                      <div className="hl-badge hl-badge-info p-3 border flex items-center gap-2 mb-2">
                        <Loader2 size={14} className="animate-spin" />
                        <span>Parsing and indexing document for AI...</span>
                      </div>
                    )}

                    {kbDocs.length === 0 ? (
                      <div className="hl-card p-4 border text-center">
                        No knowledge documents uploaded yet. Upload product catalogs, brochures, or pricing sheets.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {kbDocs.map((doc) => (
                          <div key={doc.id} className="hl-card p-2.5 border flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate">
                              <FileText size={14} className="shrink-0" />
                              <span className="font-bold truncate">{doc.filename}</span>
                              <span className="text-[10px]">({doc.char_count} chars)</span>
                            </div>
                            <button onClick={() => handleDeleteKbDoc(doc.id)} className="p-1 text-gray-400 hover:text-rose-600">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Save All AI Settings Button */}
                  <div className="flex items-center justify-end pt-4 border-t">
                    <button
                      type="button"
                      onClick={handleSaveAiSettings}
                      disabled={aiSaveLoading}
                      className="hl-btn-primary px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 disabled:opacity-50 text-xs"
                    >
                      {aiSaveLoading ? <Loader2 size={14} className="animate-spin" /> : aiSaved ? <Check size={14} /> : <Settings size={14} />}
                      <span>{aiSaved ? "AI Settings Saved Successfully!" : "Save All AI Settings"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column (1 col): Live Interactive AI Chat Simulation Playground */}
              <div className="space-y-6">
                <div className="hl-card border p-5">
                  <h2 className="font-black text-sm flex items-center gap-2 mb-1">
                    <Play size={16} className="" />
                    <span>AI Testing & Simulation Playground</span>
                  </h2>
                  <p className="hl-subtitle mb-4">
                    Test your system prompt, knowledge base, and CRM tool execution before going live.
                  </p>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="hl-section-label block mb-1">Simulated Customer Name</label>
                      <input
                        type="text"
                        value={aiTestName}
                        onChange={(e) => setAiTestName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="hl-section-label block mb-1">Customer Inbound Message</label>
                      <textarea
                        rows={2}
                        value={aiTestMessage}
                        onChange={(e) => setAiTestMessage(e.target.value)}
                        placeholder="e.g. Can you check my invoice status?"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 resize-none text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleTestAiReply}
                      disabled={aiTestLoading || !aiTestMessage.trim()}
                      className="hl-btn-primary w-full py-2.5 font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {aiTestLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>Generate AI Test Reply</span>
                    </button>

                    {aiTestError && (
                      <div className="hl-badge hl-badge-error p-3 border text-xs">
                        {aiTestError}
                      </div>
                    )}

                    {aiTestReply && (
                      <div className="hl-card p-4 border space-y-2">
                        <span className="hl-section-label block">AI Generated Response:</span>
                        <div className="p-3 border rounded-xl text-xs whitespace-pre-wrap leading-relaxed">
                          {aiTestReply}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* CRM Tools Summary Card */}
                <div className="hl-card border p-5 text-xs space-y-3">
                  <h3 className="font-bold flex items-center gap-2">
                    <Cpu size={16} className="" />
                    <span>Enabled CRM AI Tools</span>
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span><strong>create_lead:</strong> Records new leads in Telecalls</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span><strong>check_invoice_status:</strong> Checks invoice records</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span><strong>schedule_callback:</strong> Sets callback reminder</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span><strong>get_company_services:</strong> Fetches live services list</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span><strong>request_human_support:</strong> Instant team handoff</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: WHATSAPP WEB & LIVE QR CODE REAL SESSION CONTROLLER
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "web" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Live QR Code & Connection Status */}
              <div className="hl-card border p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h2 className="font-black text-base flex items-center gap-2">
                    <Wifi size={18} className="" />
                    <span>WhatsApp Web Multi-Device Session</span>
                  </h2>
                  <span className={`hl-badge ${
                    webConnected ? "hl-badge-success" : "bg-gray-100 text-gray-600 border-gray-200"
                  }`}>
                    {webConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>

                <div className={`hl-card flex items-center gap-4 p-4 ${
                  webConnected ? "" : ""
                }`}>
                  {webConnected ? (
                    <div className="p-3 rounded-xl">
                      <CheckCircle2 size={24} />
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl">
                      <XCircle size={24} />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm">
                      {webConnected ? `Linked: +${status?.web?.phone || accountDetails?.phone || "Active Session"}` : "No Web Session Connected"}
                    </p>
                    <p className="hl-subtitle mt-0.5">
                      {webConnected ? `Platform: ${accountDetails?.platform || "WhatsApp Multi-Device"} • Push Name: ${accountDetails?.pushname || "CRM"}` : "Scan QR code or use pairing code below to link your device."}
                    </p>
                  </div>
                </div>

                {/* Live QR Scanner Card */}
                {!webConnected && (
                  <div className="hl-card p-5 border flex flex-col items-center justify-center text-center space-y-4">
                    <h3 className="font-bold text-sm flex items-center gap-1.5">
                      <Smartphone size={16} className="" />
                      <span>Scan WhatsApp Web QR Code</span>
                    </h3>

                    {qrLoading ? (
                      <div className="hl-card w-64 h-64 flex flex-col items-center justify-center border gap-3 p-4">
                        <Loader2 size={36} className="animate-spin" />
                        <span className="text-xs font-bold">Starting WhatsApp Engine...</span>
                        <span className="text-[11px]">Launching headless browser & fetching secure QR</span>
                      </div>
                    ) : qrCode ? (
                      <div className="hl-card p-4 border flex flex-col items-center">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt="WhatsApp Web QR Code" className="w-[220px] h-[220px] object-contain" />
                        ) : (
                          <QRCodeSVG value={qrCode} size={220} level="M" />
                        )}
                      </div>
                    ) : (
                      <div className="hl-card w-64 h-64 flex flex-col items-center justify-center border p-4 gap-3 text-center">
                        <Smartphone size={36} className="" />
                        <p className="text-xs font-medium">Click below to generate a fresh QR Code</p>
                        <button
                          type="button"
                          onClick={() => fetchQr(true)}
                          className="px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold rounded-xl shadow-md shadow-[#25D366]/20 transition flex items-center gap-2"
                        >
                          <RefreshCw size={14} />
                          <span>Generate QR Code</span>
                        </button>
                      </div>
                    )}

                    {qrCode && (
                      <div className="flex items-center gap-3 text-xs">
                        {qrCountdown > 0 ? (
                          <span className="">QR Valid: <strong className="font-mono">{qrCountdown}s</strong></span>
                        ) : (
                          <span className="font-semibold">QR Expired</span>
                        )}
                        <button
                          type="button"
                          onClick={() => fetchQr(true)}
                          disabled={qrLoading}
                          className="text-[#25D366] font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={qrLoading ? "animate-spin" : ""} />
                          <span>{qrLoading ? "Refreshing..." : "Refresh Now"}</span>
                        </button>
                      </div>
                    )}

                    <p className="text-[11px] max-w-xs">
                      Open WhatsApp on your phone &gt; Settings / Menu &gt; Linked Devices &gt; Link a Device &gt; Scan this QR.
                    </p>
                  </div>
                )}

                {/* Session Control Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs font-bold">
                  <button
                    type="button"
                    onClick={handleReconnectWeb}
                    disabled={reconnecting}
                    className="hl-btn-secondary px-4 py-2 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {reconnecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    <span>Reconnect Session</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleHardResetWeb}
                    className="hl-btn-danger-ghost px-4 py-2 border rounded-xl transition flex items-center gap-1.5"
                  >
                    <Flame size={13} />
                    <span>Hard Reset QR</span>
                  </button>

                  {webConnected && (
                    <button
                      type="button"
                      onClick={handleLogoutWeb}
                      className="hl-btn-danger-ghost px-4 py-2 border rounded-xl transition flex items-center gap-1.5 ml-auto"
                    >
                      <Power size={13} />
                      <span>Disconnect Device</span>
                    </button>
                  )}
                </div>

                {reconnectMsg && (
                  <p className="text-xs font-semibold">{reconnectMsg}</p>
                )}
              </div>

              {/* Right Column: Pairing Code & Anti-Ban Safety */}
              <div className="space-y-6">
                {/* 8-Digit Pairing Code Form */}
                <div className="hl-card border p-6 space-y-4">
                  <h2 className="font-black text-base flex items-center gap-2">
                    <Smartphone size={18} className="" />
                    <span>Link with 8-Digit Phone Pairing Code</span>
                  </h2>
                  <p className="hl-subtitle">
                    If your camera is unable to scan QR codes, enter your WhatsApp phone number to receive an 8-character pairing code.
                  </p>

                  <form onSubmit={handleGeneratePairingCode} className="space-y-3 text-xs">
                    <div>
                      <label className="hl-section-label block mb-1">Phone Number (with country code)</label>
                      <input
                        type="text"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                        placeholder="e.g. 919876543210"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366] font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={pairingLoading || !pairingPhone.trim()}
                      className="hl-btn-primary w-full py-2.5 font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {pairingLoading ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
                      <span>Generate 8-Digit Pairing Code</span>
                    </button>
                  </form>

                  {pairingCode && (
                    <div className="hl-card p-4 border text-center space-y-2">
                      <span className="hl-section-label block">Your Pairing Code:</span>
                      <div className="text-2xl font-black font-mono tracking-widest select-all">
                        {pairingCode}
                      </div>
                      <p className="text-[11px]">Enter this code in WhatsApp &gt; Linked Devices &gt; Link with Phone Number.</p>
                    </div>
                  )}
                </div>

                {/* Anti-Ban & Broadcast Safeguards */}
                <div className="hl-card border p-6 space-y-3 text-xs">
                  <h2 className="font-black text-base flex items-center gap-2">
                    <ShieldCheck size={18} className="" />
                    <span>Anti-Ban Broadcast Safeguards</span>
                  </h2>
                  <p className="hl-subtitle">
                    Built-in humanized pacing dynamically protects your WhatsApp number from automated spam detection.
                  </p>

                  <div className="space-y-2">
                    <div className="hl-card p-3 border flex justify-between items-center">
                      <span className="font-semibold">Random Delay Between Messages:</span>
                      <span className="font-bold">35s – 55s</span>
                    </div>
                    <div className="hl-card p-3 border flex justify-between items-center">
                      <span className="font-semibold">Batch Pause Cooldown:</span>
                      <span className="font-bold">Pause 3m every 25 messages</span>
                    </div>
                    <div className="hl-card p-3 border flex justify-between items-center">
                      <span className="font-semibold">Opt-Out Filtering:</span>
                      <span className="font-bold">Automatic STOP filter active</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSyncContacts}
                      disabled={syncingContacts}
                      className="hl-btn-secondary px-4 py-2 border rounded-xl font-bold transition flex items-center gap-1.5"
                    >
                      <RefreshCw size={13} className={syncingContacts ? "animate-spin" : ""} />
                      <span>{syncingContacts ? "Syncing Contacts..." : "Sync WhatsApp Contacts"}</span>
                    </button>
                    {syncResult && (
                      <span className={`hl-badge text-[11px] font-bold ${syncResult.success ? "hl-badge-success" : "hl-badge-error"}`}>
                        {syncResult.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 3: META CLOUD API (OFFICIAL INTEGRATION)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "meta" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
              <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
                <div className="hl-card border p-4 sm:p-6 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b">
                    <div>
                      <h2 className="font-black text-base flex items-center gap-2">
                        <Key size={18} className="" />
                        <span>Meta Cloud API Credentials</span>
                      </h2>
                      <p className="hl-subtitle mt-0.5">
                        Connect your official Meta WhatsApp Business Account (WABA) for official cloud messaging.
                      </p>
                    </div>
                    <span className="hl-badge hl-badge-info text-xs font-bold px-3 py-1 border">
                      Official Meta API
                    </span>
                  </div>

                  {metaTestResult && (
                    <div
                      className={`hl-badge mb-4 p-3.5 text-xs font-semibold flex items-center gap-2.5 ${
                        metaTestResult.success
                          ? "hl-badge-success"
                          : "hl-badge-error"
                      }`}
                    >
                      {metaTestResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                      <div>
                        <p className="font-bold">{metaTestResult.success ? "Connection Verified Successfully!" : "Connection Failed"}</p>
                        <p className="text-[11px] mt-0.5">
                          {metaTestResult.error || `Connected Number: ${metaTestResult.data?.phoneInfo?.display_phone_number || "Active"}`}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="hl-section-label block mb-1">Phone Number ID *</label>
                      <input
                        type="text"
                        value={metaForm.phone_number_id}
                        onChange={(e) => setMetaForm({ ...metaForm, phone_number_id: e.target.value })}
                        placeholder="e.g. 104857392019485"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="hl-section-label block mb-1">Permanent Access Token *</label>
                      <input
                        type="password"
                        value={metaForm.access_token}
                        onChange={(e) => setMetaForm({ ...metaForm, access_token: e.target.value })}
                        placeholder="EAA..."
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="hl-section-label block mb-1">WABA Account ID</label>
                      <input
                        type="text"
                        value={metaForm.waba_id}
                        onChange={(e) => setMetaForm({ ...metaForm, waba_id: e.target.value })}
                        placeholder="e.g. 102938475610293"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="hl-section-label block mb-1">Webhook Verify Token</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={metaForm.verify_token}
                          onChange={(e) => setMetaForm({ ...metaForm, verify_token: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(metaForm.verify_token, "token")}
                          className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition text-xs font-bold shrink-0"
                        >
                          {copiedToken ? <Check size={14} className="" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Webhook URL Helper */}
                  <div className="hl-card mt-4 p-4 border text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Meta Webhook Callback URL:</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(webhookUrl, "webhook")}
                        className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        {copiedWebhook ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedWebhook ? "Copied!" : "Copy URL"}</span>
                      </button>
                    </div>
                    <code className="hl-id hl-card block p-2 border font-mono text-[11px] select-all overflow-x-auto">
                      {webhookUrl}
                    </code>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t">
                    <button
                      type="button"
                      onClick={handleTestMetaConnection}
                      disabled={metaTestLoading || !metaForm.phone_number_id}
                      className="hl-btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {metaTestLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      <span>Test Connection</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveMetaConfig}
                      disabled={metaSaveLoading || !metaForm.phone_number_id}
                      className="hl-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {metaSaveLoading ? <Loader2 size={14} className="animate-spin" /> : metaSaved ? <Check size={14} /> : <Settings size={14} />}
                      <span>{metaSaved ? "Saved!" : "Save Meta Config"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Meta Account Status Card */}
              <div className="space-y-6">
                <div className="hl-card border p-5 text-xs">
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <ShieldCheck size={18} className="" />
                    <span>Meta Account Quality Status</span>
                  </h3>
                  <div className={`hl-card p-4 ${qualityInfo.bg} mb-4`}>
                    <span className={`${qualityInfo.badge}`}>
                      {qualityInfo.label}
                    </span>
                    <p className="text-[11px] mt-2">
                      Messaging Tier 1: 1,000 business-initiated conversations / 24 hours.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 4: AUTO-REPLY & WELCOME GREETINGS
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "welcome" && (
            <div className="hl-card max-w-2xl mx-auto border p-6 space-y-5 text-xs">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <h2 className="font-black text-base flex items-center gap-2">
                    <Sparkles size={18} className="" />
                    <span>First-Inbound Welcome Auto-Greeting</span>
                  </h2>
                  <p className="hl-subtitle mt-0.5">
                    Automatically welcome new customers when they send their first message.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setWelcomeForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    welcomeForm.enabled
                      ? "hl-badge hl-badge-accent"
                      : "hl-badge"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full bg-current ${welcomeForm.enabled ? "animate-pulse" : ""}`} />
                  <span>{welcomeForm.enabled ? "Welcome: ACTIVE" : "Welcome: DISABLED"}</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="hl-section-label block">Welcome Message Text</label>
                  <WAVariablePicker
                    onInsert={(tag) => setWelcomeForm((prev) => ({ ...prev, welcome_text: (prev.welcome_text || "") + " " + tag }))}
                  />
                  <textarea
                    rows={4}
                    value={welcomeForm.welcome_text}
                    onChange={(e) => setWelcomeForm({ ...welcomeForm, welcome_text: e.target.value })}
                    placeholder="Hello {{name}}! 👋 {{greeting_time}}, thank you for contacting {{company}}. How can we assist you today?"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none font-sans text-gray-800"
                  />

                  {/* Live Evaluated Customer Welcome Preview */}
                  {welcomeForm.welcome_text && (
                    <div className="hl-card p-3.5 border space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1.5"><Sparkles size={13} /> Live Customer Welcome Preview:</span>
                        <span className="hl-id text-[10px] font-mono">Dynamic Multi-Keyword Active</span>
                      </div>
                      <div className="hl-card hl-id p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed border">
                        {evaluateMessagePlaceholders(welcomeForm.welcome_text, {
                          name: "Rahul Sharma",
                          first_name: "Rahul",
                          company: "Madhura Tech",
                          city: "Chennai"
                        })}
                      </div>
                      <p className="text-[10px]">
                        Evaluates all dynamic keywords like <code className="hl-id font-bold">{"{tomorrow}"}</code>, <code className="hl-id font-bold">{"{tomorrow_day}"}</code>, <code className="hl-id font-bold">{"{greeting_time}"}</code>, <code className="hl-id font-bold">{"{date}"}</code>, <code className="hl-id font-bold">{"{time}"}</code> live on every inbound chat.
                      </p>
                    </div>
                  )}
                </div>

                <div className="hl-card grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border">
                  <div>
                    <label className="hl-section-label block mb-1">Cooldown Duration</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="168"
                        value={welcomeForm.cooldown_hours}
                        onChange={(e) => setWelcomeForm({ ...welcomeForm, cooldown_hours: parseInt(e.target.value, 10) || 24 })}
                        className="w-24 px-3 py-2 bg-white border border-gray-200 rounded-xl font-mono text-center"
                      />
                      <span className="">hours</span>
                    </div>
                    <p className="text-[10px] mt-1">Don't repeat welcome to the same number within this period.</p>
                  </div>

                  <div>
                    <label className="hl-section-label block mb-1">Working Hours Only</label>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={welcomeForm.working_hours_only}
                        onChange={(e) => setWelcomeForm({ ...welcomeForm, working_hours_only: e.target.checked })}
                        className="w-4 h-4 text-amber-600 rounded"
                      />
                      <span className="font-semibold">Only send during business hours</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t">
                  <button
                    type="button"
                    onClick={handleSaveWelcomeSettings}
                    disabled={welcomeSaving}
                    className="hl-btn-primary px-6 py-2.5 font-bold rounded-xl transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {welcomeSaving ? <Loader2 size={14} className="animate-spin" /> : welcomeSaved ? <Check size={14} /> : <Settings size={14} />}
                    <span>{welcomeSaved ? "Welcome Settings Saved!" : "Save Welcome Settings"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 5: INSTANT LIVE TEST MESSAGE DISPATCHER
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "test" && (
            <div className="hl-card max-w-xl mx-auto border p-6">
              <h2 className="font-black text-base flex items-center gap-2 mb-2">
                <Send size={18} className="" />
                <span>Instant Test Dispatcher</span>
              </h2>
              <p className="hl-subtitle mb-5">
                Dispatch a live message to any WhatsApp number to verify outbound delivery on the active engine.
              </p>

              {testSendResult && (
                <div
                  className={`hl-badge mb-4 p-3.5 text-xs font-semibold flex items-center gap-2 ${
                    testSendResult.success ? "hl-badge-success" : "hl-badge-error"
                  }`}
                >
                  {testSendResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{testSendResult.message || testSendResult.error}</span>
                </div>
              )}

              <form onSubmit={handleSendTestMessage} className="space-y-4 text-xs">
                <div>
                  <label className="hl-section-label block mb-1">Sending Channel</label>
                  <select
                    value={testEngine}
                    onChange={(e) => setTestEngine(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366] bg-white font-semibold text-gray-800 shadow-sm"
                  >
                    <option value="auto">⚡ Smart Auto-Detect (Active WhatsApp Engine)</option>
                    <option value="web" disabled={!webConnected}>
                      📱 WhatsApp Web {webConnected ? `(+${status?.web?.phone || "Connected"})` : "— [Offline]"}
                    </option>
                    <option value="cloud_api" disabled={!cloudConfigured}>
                      ☁️ Meta Cloud API {cloudConfigured ? "— [Configured]" : "— [Not Setup]"}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="hl-section-label block mb-1">Recipient Mobile Number</label>
                  <div className="flex items-center gap-1.5">
                    <span className="hl-badge px-3 py-2.5 border font-bold">+91</span>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="9876543210"
                      className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="hl-section-label block">Message Body</label>
                    <span className="hl-id text-[10px] font-mono">Supports {"{tomorrow}"}, {"{day}"}, etc.</span>
                  </div>
                  <WAVariablePicker
                    onInsert={(tag) => setTestMsgText((prev) => (prev || "") + " " + tag)}
                    className="mb-2"
                  />
                  <textarea
                    rows={3}
                    value={testMsgText}
                    onChange={(e) => setTestMsgText(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                    placeholder="Type test message, e.g. Hi {name}, tomorrow is {tomorrow} ({tomorrow_day})!"
                    required
                  />
                  {testMsgText && (
                    <div className="hl-card hl-id mt-2 p-2.5 border text-xs font-mono whitespace-pre-wrap">
                      <span className="text-[10px] font-bold block mb-1">Evaluated Preview:</span>
                      {evaluateMessagePlaceholders(testMsgText, { phone: testPhone || "9876543210" })}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sendingTestMsg || !testPhone}
                  className="hl-btn-primary w-full py-3 font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sendingTestMsg ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>Send Test Message</span>
                </button>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 6: UNIVERSAL CRM CONNECTOR (STANDALONE MICROSERVICE API & WEBHOOKS)
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === "connector" && (
            <div className="space-y-6">
              {/* Header Hero Banner */}
              <div className="hl-card from-violet-900 p-6 sm:p-8 border relative overflow-hidden">
                <div className="relative z-10 max-w-3xl">
                  <div className="hl-badge hl-badge-info inline-flex items-center gap-2 px-3 py-1 border text-xs font-semibold mb-3">
                    <Sparkles size={14} className="" />
                    <span>Universal Microservice Mode</span>
                  </div>
                  <h2 className="hl-title mb-2">
                    Connect This WhatsApp Engine To Any CRM
                  </h2>
                  <p className="text-sm leading-relaxed mb-6">
                    This WhatsApp folder functions as an independent, high-performance microservice. Use our standard REST API endpoints to send messages, stream incoming customer chats via Webhooks, and embed live QR codes directly inside any CRM platform (HubSpot, Zoho, Salesforce, LeadSquared, Custom PHP/Python/Node).
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("wa_crm_secret_key_2026");
                        setCopiedApiKey(true);
                        setTimeout(() => setCopiedApiKey(false), 2000);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-white text-gray-900 font-bold text-xs hover:bg-slate-100 transition shadow flex items-center gap-2"
                    >
                      {copiedApiKey ? <Check size={14} className="" /> : <Copy size={14} />}
                      <span>{copiedApiKey ? "Copied API Key!" : "Copy Master API Key"}</span>
                    </button>
                    <a
                      href={`${API}/api/v1/status`}
                      target="_blank"
                      rel="noreferrer"
                      className="hl-btn-secondary px-4 py-2.5 rounded-xl font-bold text-xs border transition flex items-center gap-2"
                    >
                      <Activity size={14} />
                      <span>Test /api/v1/status Live</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Grid 1: REST API Credentials + Webhook Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. REST API Configuration Card */}
                <div className="hl-card border p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <h3 className="font-black text-sm flex items-center gap-2">
                      <Key size={16} className="" />
                      <span>REST API Connection Details</span>
                    </h3>
                    <span className="hl-badge hl-badge-success text-[11px] font-bold px-2.5 py-0.5 border">
                      v2.0 Standalone
                    </span>
                  </div>

                  <div className="space-y-4 text-xs min-w-0">
                    <div>
                      <label className="hl-section-label block mb-1">Base API URL</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${API}/api/v1`}
                          className="hl-input hl-id flex-1 px-3.5 py-2.5 border font-mono font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`${API}/api/v1`, "webhook")}
                          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl font-bold transition flex items-center gap-1.5"
                        >
                          <Copy size={13} />
                          <span>Copy</span>
                        </button>
                      </div>
                      <p className="text-[11px] mt-1">Available locally at port 5001 or via your public reverse proxy / domain.</p>
                    </div>

                    <div>
                      <label className="hl-section-label block mb-1">Master API Key (Authentication)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value="wa_crm_secret_key_2026"
                          className="hl-input hl-id flex-1 px-3.5 py-2.5 border font-mono font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText("wa_crm_secret_key_2026");
                            setCopiedApiKey(true);
                            setTimeout(() => setCopiedApiKey(false), 2000);
                          }}
                          className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold transition flex items-center gap-1.5"
                        >
                          {copiedApiKey ? <Check size={13} className="" /> : <Copy size={13} />}
                          <span>{copiedApiKey ? "Copied" : "Copy Key"}</span>
                        </button>
                      </div>
                      <p className="text-[11px] mt-1">
                        Pass this key in HTTP header: <code className="hl-id px-1 py-0.5 rounded font-mono">x-api-key: wa_crm_secret_key_2026</code> or <code className="hl-id px-1 py-0.5 rounded font-mono">Authorization: Bearer wa_crm_secret_key_2026</code>
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border space-y-2">
                      <p className="hl-section-label">Supported REST Endpoints</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="hl-card p-2">
                          <strong className="font-mono">POST</strong> <span className="hl-id font-mono">/api/v1/messages/send</span>
                          <p className="text-[10px]">Send WhatsApp text</p>
                        </div>
                        <div className="hl-card p-2">
                          <strong className="font-mono">POST</strong> <span className="hl-id font-mono">/api/v1/messages/send-media</span>
                          <p className="text-[10px]">Send PDF/Images</p>
                        </div>
                        <div className="hl-card p-2">
                          <strong className="font-mono">GET</strong> <span className="hl-id font-mono">/api/v1/qr</span>
                          <p className="text-[10px]">Get live QR (JSON, PNG, SVG)</p>
                        </div>
                        <div className="hl-card p-2">
                          <strong className="font-mono">GET</strong> <span className="hl-id font-mono">/api/v1/status</span>
                          <p className="text-[10px]">Live engine health</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Outbound Webhook Forwarding Card */}
                <div className="hl-card border p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <h3 className="font-black text-sm flex items-center gap-2">
                      <Webhook size={16} className="" />
                      <span>Outbound Webhook Dispatcher</span>
                    </h3>
                    <span className="hl-badge hl-badge-info text-[11px] font-bold px-2.5 py-0.5 border">
                      Real-Time Push
                    </span>
                  </div>

                  <p className="hl-subtitle">
                    Whenever a customer sends a message or a delivery tick updates, this WhatsApp engine posts a JSON payload to your CRM's webhook endpoint instantly.
                  </p>

                  <div className="space-y-4 text-xs min-w-0">
                    <div>
                      <label className="hl-section-label block mb-1">Your External CRM Webhook URL</label>
                      <input
                        type="url"
                        value={crmWebhookUrl}
                        onChange={(e) => setCrmWebhookUrl(e.target.value)}
                        placeholder="https://your-crm.com/api/webhooks/whatsapp"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                      />
                    </div>

                    <div>
                      <label className="hl-section-label block mb-1">Webhook Secret (HMAC SHA-256 Signature)</label>
                      <input
                        type="text"
                        value={crmWebhookSecret}
                        onChange={(e) => setCrmWebhookSecret(e.target.value)}
                        placeholder="crm_secret_signature_key"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                      />
                      <p className="text-[11px] mt-1">Used to verify the <code className="hl-id font-mono">x-hub-signature-256</code> header in your CRM.</p>
                    </div>

                    {crmWebhookTestResult && (
                      <div className={`hl-badge p-3 text-xs font-semibold flex items-center gap-2 ${
                        crmWebhookTestResult.success ? "hl-badge-success" : "hl-badge-error"
                      }`}>
                        {crmWebhookTestResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span>
                          {crmWebhookTestResult.success
                            ? `Webhook Ping Successful! HTTP ${crmWebhookTestResult.status || 200}`
                            : `Webhook Ping Failed: ${crmWebhookTestResult.error || "Connection timed out"}`}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSaveCrmWebhook}
                        disabled={crmWebhookSaving || !crmWebhookUrl}
                        className="hl-btn-primary px-4 py-2.5 font-bold rounded-xl transition shadow flex items-center gap-2 disabled:opacity-50"
                      >
                        {crmWebhookSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        <span>{crmWebhookSaved ? "Saved Successfully!" : "Save Webhook URL"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTestCrmWebhook}
                        disabled={crmWebhookTesting || !crmWebhookUrl}
                        className="hl-btn-secondary px-4 py-2.5 font-bold rounded-xl transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {crmWebhookTesting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} className="" />}
                        <span>⚡ Test Ping Webhook</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready-to-use Code Snippets (cURL, JavaScript, Python, PHP) */}
              <div className="hl-card border p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
                  <div>
                    <h3 className="font-black text-sm flex items-center gap-2">
                      <Code2 size={16} className="" />
                      <span>Ready-to-Use Code Snippets For Any CRM</span>
                    </h3>
                    <p className="hl-subtitle mt-0.5">Copy and paste directly into your CRM backend or automation scripts.</p>
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-xl">
                    {["curl", "javascript", "python", "php"].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setCodeTab(lang)}
                        className={`hl-tab px-3 py-1 uppercase ${
                          codeTab === lang ? "is-active" : ""
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hl-card hl-id p-4 overflow-x-auto text-xs font-mono border">
                  {codeTab === "curl" && (
                    <pre className="hl-id whitespace-pre">{`# 1. Send WhatsApp Message from any terminal or script:
curl -X POST "${API}/api/v1/messages/send" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: wa_crm_secret_key_2026" \\
  -d '{
    "phone": "919876543210",
    "message": "Hello from our CRM! Your account is active. 🚀"
  }'

# 2. Check Connection & Retrieve Live QR Code:
curl -X GET "${API}/api/v1/qr" \\
  -H "x-api-key: wa_crm_secret_key_2026"`}</pre>
                  )}

                  {codeTab === "javascript" && (
                    <pre className="hl-id whitespace-pre">{`// Node.js / Express or Frontend Fetch:
const sendWhatsAppMessage = async (phone, message) => {
  const response = await fetch("${API}/api/v1/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "wa_crm_secret_key_2026"
    },
    body: JSON.stringify({ phone, message })
  });
  return await response.json();
};

// Example usage:
sendWhatsAppMessage("919876543210", "Hi John, your invoice #1042 is ready!")
  .then(res => console.log("Sent successfully:", res))
  .catch(err => console.error("Failed to send:", err));`}</pre>
                  )}

                  {codeTab === "python" && (
                    <pre className="hl-id whitespace-pre">{`# Python 3 (requests)
import requests

def send_whatsapp(phone, message):
    url = "${API}/api/v1/messages/send"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": "wa_crm_secret_key_2026"
    }
    payload = {"phone": phone, "message": message}
    response = requests.post(url, json=payload, headers=headers)
    return response.json()

# Example usage:
result = send_whatsapp("919876543210", "Hello from Python CRM!")
print(result)`}</pre>
                  )}

                  {codeTab === "php" && (
                    <pre className="hl-id whitespace-pre">{`<?php
// PHP cURL WhatsApp Dispatcher
function sendWhatsApp($phone, $message) {
    $ch = curl_init("${API}/api/v1/messages/send");
    $payload = json_encode(["phone" => $phone, "message" => $message]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json",
        "x-api-key: wa_crm_secret_key_2026"
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

// Example usage:
$res = sendWhatsApp("919876543210", "Hello from PHP CRM!");
print_r($res);
?>`}</pre>
                  )}
                </div>
              </div>

              {/* Webhook Delivery History */}
              <div className="hl-card border p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="font-black text-sm flex items-center gap-2">
                    <Activity size={16} className="" />
                    <span>Recent Outbound Webhook Events Delivered</span>
                  </h3>
                  <button
                    type="button"
                    onClick={fetchAll}
                    className="text-xs font-bold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    <span>Refresh Deliveries</span>
                  </button>
                </div>

                {crmDeliveries.length === 0 ? (
                  <div className="hl-empty py-8 text-center text-xs">
                    No webhook events recorded yet. Configure a webhook URL above to start streaming live message events.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="hl-table w-full min-w-[560px]">
                      <thead>
                        <tr className="border-b uppercase text-[10px] font-bold">
                          <th className="py-2 px-3">Event Type</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Target URL</th>
                          <th className="py-2 px-3">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {crmDeliveries.map((d, idx) => (
                          <tr key={idx} className="font-mono text-[11px]">
                            <td className="py-2.5 px-3 font-bold">{d.event}</td>
                            <td className="py-2.5 px-3">
                              <span className={`hl-badge px-2 py-0.5 font-sans text-[10px] font-bold ${
                                d.success ? "hl-badge-success" : "hl-badge-error"
                              }`}>
                                {d.success ? `HTTP ${d.statusCode || 200}` : `Failed (${d.error || "error"})`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 max-w-xs truncate">{d.url}</td>
                            <td className="py-2.5 px-3 font-sans">{new Date(d.timestamp).toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
