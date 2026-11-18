import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ShieldCheck,
  Radio,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Lock,
  Layers,
  ChevronRight,
  Sparkles,
  HelpCircle
} from "lucide-react";
import { API } from "../../config";
import { useAuth } from "../../auth/AuthContext";
import { useEnterprise } from "../../context/EnterpriseContext";

export default function WhatsAppConnectOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [setup, setSetup] = useState(null);
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [activeTab, setActiveTab] = useState("embedded"); // "embedded" | "direct" | "webhook"
  const [metaCode, setMetaCode] = useState("");
  const [directForm, setDirectForm] = useState({
    wabaId: "",
    phoneNumberId: "",
    accessToken: "",
    appSecret: "",
    displayName: ""
  });

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const webhookUrl = setup?.webhookUrl || setup?.webhook_url || "https://api.madhuratech.in/webhook";
  const verifyToken = setup?.verifyToken || setup?.verify_token || "madhura_wa_verify_2026";

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [setupRes, sendersRes] = await Promise.all([
        axios.get(`${API}/api/meta/setup`, { timeout: 10000 }).catch(() => ({ data: {} })),
        axios.get(`${API}/api/meta/senders`, { timeout: 10000 }).catch(() => ({ data: { senders: [] } }))
      ]);
      setSetup(setupRes.data || null);
      setSenders(sendersRes.data?.senders || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load Meta configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text, type) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  // Launch Meta Embedded Signup Popup
  const handleLaunchMetaPopup = () => {
    setError("");
    setSuccessMsg("");
    const appId = setup?.appId || setup?.meta_app_id || "780961714856006";
    const configId = setup?.configId || setup?.meta_config_id || "1189434863378370";

    if (window.FB) {
      setActionBusy("Authorizing with Meta...");
      window.FB.login(
        (response) => {
          if (response.authResponse?.code) {
            handleExchangeCode(response.authResponse.code);
          } else {
            setActionBusy("");
            setError("Meta authorization window closed or cancelled. You can also paste an authorization code below.");
          }
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "",
            sessionInfoVersion: "3"
          }
        }
      );
    } else {
      // Fallback: Open Meta OAuth URL in popup
      const redirectUri = encodeURIComponent(window.location.origin + "/whatsapp/accounts");
      const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&config_id=${configId}&response_type=code`;
      window.open(oauthUrl, "meta_signup", "width=600,height=750,left=200,top=100");
      setSuccessMsg("Meta authorization popup opened. Once completed, paste the authorization code below if not automatically captured.");
    }
  };

  // Server-side code exchange
  const handleExchangeCode = async (codeToExchange) => {
    const code = codeToExchange || metaCode.trim();
    if (!code) {
      setError("Please provide a valid Meta authorization code.");
      return;
    }
    setActionBusy("Exchanging Meta authorization token...");
    setError("");
    try {
      const res = await axios.post(`${API}/api/meta/onboard/exchange`, {
        code,
        version: "v4"
      });
      if (res.data?.success) {
        setSuccessMsg("Meta Business authorized successfully! Discovering your WhatsApp assets...");
        await loadData();
        setTimeout(() => {
          navigate("/onboarding/whatsapp/numbers");
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to exchange Meta authorization code");
    } finally {
      setActionBusy("");
    }
  };

  // Manual Direct API connection
  const handleDirectConnect = async (e) => {
    e.preventDefault();
    if (!directForm.phoneNumberId || !directForm.accessToken) {
      setError("Phone Number ID and Access Token are required.");
      return;
    }
    setActionBusy("Registering WhatsApp Sender...");
    setError("");
    try {
      const res = await axios.post(`${API}/api/meta/senders/manual`, {
        phoneNumberId: directForm.phoneNumberId.trim(),
        wabaId: directForm.wabaId.trim() || undefined,
        accessToken: directForm.accessToken.trim(),
        appSecret: directForm.appSecret.trim() || undefined,
        departmentName: directForm.displayName.trim() || "General",
        isShared: true
      });
      if (res.data?.success) {
        setSuccessMsg("WhatsApp sender registered successfully!");
        await loadData();
        setTimeout(() => {
          navigate("/onboarding/whatsapp/numbers");
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to register WhatsApp sender");
    } finally {
      setActionBusy("");
    }
  };

  const hasConnectedSenders = senders.some((s) => s.status === "connected" || s.status === "ready");

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            <span>Back to Command Center</span>
          </Link>
          <span className="text-xs font-semibold text-slate-400">Step 4 of 10</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-3">
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            <span>Meta WhatsApp Cloud API</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Connect Your WhatsApp Business Account
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Authorize Madhura to connect your Meta Business Portfolio and WhatsApp Business Account (WABA).
            You can use official Meta Embedded Signup or enter your custom Meta Cloud API credentials.
          </p>

          {/* Verification Protocol Explainer Banner */}
          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Security and Verification Architecture</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] leading-normal text-slate-600">
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">1. Meta OAuth Authorization</span>
                Authorizes Madhura via secure server-to-server token exchange without exposing your password.
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">2. Phone Ownership Verification</span>
                Verified directly inside Meta's popup interface via SMS or voice call. Madhura never stores phone OTPs.
              </div>
            </div>
          </div>
        </div>

        {/* Connected Status Card if already connected */}
        {hasConnectedSenders && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-emerald-950">WhatsApp Senders Connected</h2>
                <p className="text-xs text-emerald-700 mt-0.5">
                  You already have {senders.length} WhatsApp sender(s) associated with this workspace.
                </p>
              </div>
            </div>
            <Link
              to="/onboarding/whatsapp/numbers"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition shrink-0"
            >
              <span>Manage Numbers</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Main Connection Interface */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/70 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("embedded")}
              className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition text-center ${
                activeTab === "embedded"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Meta Embedded Signup (Recommended)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("direct")}
              className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition text-center ${
                activeTab === "direct"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Cloud API (BYO Token)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("webhook")}
              className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition text-center ${
                activeTab === "webhook"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Webhook Configuration
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {error && (
              <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {successMsg && (
              <div role="alert" className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="flex-1">{successMsg}</span>
              </div>
            )}

            {/* TAB 1: META EMBEDDED SIGNUP */}
            {activeTab === "embedded" && (
              <div className="space-y-6">
                <div className="text-center py-6 px-4 border border-dashed border-slate-300 rounded-2xl bg-slate-50/50">
                  <div className="w-14 h-14 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-700">
                    <Radio className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Official Meta Embedded Signup v4
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto mt-1 leading-relaxed">
                    Connect your Facebook Business Manager in under 2 minutes. Meta's guided popup will register your phone number and verify ownership.
                  </p>

                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleLaunchMetaPopup}
                      disabled={Boolean(actionBusy)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold rounded-xl shadow transition"
                    >
                      <Radio className="w-4 h-4" />
                      <span>{actionBusy || "Continue with Facebook / Meta"}</span>
                    </button>
                  </div>
                </div>

                {/* Manual Code Input fallback */}
                <div className="pt-4 border-t border-slate-200">
                  <label htmlFor="metaCodeInput" className="block text-xs font-bold text-slate-700 mb-1">
                    Or paste Meta Authorization Code
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    If you authorized in an external popup or browser tab, paste the code returned by Meta here.
                  </p>
                  <div className="flex gap-2">
                    <input
                      id="metaCodeInput"
                      type="text"
                      value={metaCode}
                      onChange={(e) => setMetaCode(e.target.value)}
                      placeholder="AQDx... or Meta Auth Code"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleExchangeCode(metaCode)}
                      disabled={Boolean(actionBusy) || !metaCode.trim()}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
                    >
                      Exchange Code
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DIRECT TOKEN / CUSTOM CLOUD API */}
            {activeTab === "direct" && (
              <form onSubmit={handleDirectConnect} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phone Number ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={directForm.phoneNumberId}
                      onChange={(e) => setDirectForm({ ...directForm, phoneNumberId: e.target.value })}
                      placeholder="e.g. 104829375829102"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WhatsApp Business Account ID (WABA ID)
                    </label>
                    <input
                      type="text"
                      value={directForm.wabaId}
                      onChange={(e) => setDirectForm({ ...directForm, wabaId: e.target.value })}
                      placeholder="e.g. 192837465019283"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    System User Permanent Access Token <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={directForm.accessToken}
                    onChange={(e) => setDirectForm({ ...directForm, accessToken: e.target.value })}
                    placeholder="EAAG..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Must have <code className="font-mono text-slate-700">whatsapp_business_messaging</code> and <code className="font-mono text-slate-700">whatsapp_business_management</code> scopes.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      App Secret (Optional, for HMAC validation)
                    </label>
                    <input
                      type="password"
                      value={directForm.appSecret}
                      onChange={(e) => setDirectForm({ ...directForm, appSecret: e.target.value })}
                      placeholder="Meta App Secret"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Department / Display Label
                    </label>
                    <input
                      type="text"
                      value={directForm.displayName}
                      onChange={(e) => setDirectForm({ ...directForm, displayName: e.target.value })}
                      placeholder="e.g. Primary Sales Support"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={Boolean(actionBusy)}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition"
                  >
                    {actionBusy || "Connect Custom Sender"}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: WEBHOOK SETUP GUIDANCE */}
            {activeTab === "webhook" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Configure this Webhook Callback URL and Verify Token in your Meta Developer App under <strong>WhatsApp → Configuration</strong>.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Callback URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl}
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(webhookUrl, "url")}
                        className="px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{copiedUrl ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Verify Token
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={verifyToken}
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(verifyToken, "token")}
                        className="px-3 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{copiedToken ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  <span className="font-bold block mb-0.5">Webhook Subscriptions to Enable:</span>
                  <span className="font-mono text-[11px] text-amber-900">messages, messaging_postbacks, message_template_status_update</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <Link
              to="/onboarding"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 transition"
            >
              Skip for now
            </Link>
            <div className="flex items-center gap-3">
              <Link
                to="/onboarding/whatsapp/numbers"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                <span>Proceed to Step 5: Numbers</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
