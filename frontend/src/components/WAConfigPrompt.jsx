import { useState, useEffect } from "react";
import { MessageCircle, X, Check, ShieldAlert, Loader2, Eye, EyeOff, ToggleLeft, ToggleRight, HelpCircle, ExternalLink } from "lucide-react";
import axios from "axios";
import { API } from "../config/api";

export default function WAConfigPrompt({ onClose }) {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("crm_verify_123");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get(`${API}/api/wa/config/user-config`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (data.hasConfig && data.config) {
          const c = data.config;
          setPhoneNumberId(c.phone_number_id || "");
          setAccessToken("••••••••••••••••");
          setWabaId(c.waba_id || "");
          setAppSecret(c.app_secret ? "••••••••••••••••" : "");
          setVerifyToken(c.verify_token || "crm_verify_123");
          setBusinessAccountId(c.business_account_id || "");
          setIsEnabled(c.is_enabled !== 0);
        }
      } catch (err) {
        console.error("Failed to load WA config", err);
      }
    };
    fetchConfig();
  }, []);

  const handleTestConnection = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      setMessage({ type: "error", text: "Phone Number ID and Access Token are required" });
      return;
    }
    setTestLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API}/api/wa/config/test-connection`,
        { phone_number_id: phoneNumberId.trim(), access_token: accessToken.trim(), waba_id: wabaId.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: "success", text: "WhatsApp connection verified! Phone: " + (data.phoneInfo?.display_phone_number || "Connected") });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Connection failed" });
    }
    setTestLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      setMessage({ type: "error", text: "Phone Number ID and Access Token are required" });
      return;
    }
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API}/api/wa/config/save-config`,
        {
          phone_number_id: phoneNumberId.trim(),
          access_token: accessToken.trim(),
          waba_id: wabaId.trim() || null,
          app_secret: appSecret.trim() || null,
          verify_token: verifyToken.trim() || "crm_verify_123",
          business_account_id: businessAccountId.trim() || null,
          is_enabled: isEnabled
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: "success", text: data.message || "Configuration saved!" });
      setTimeout(() => { if (onClose) onClose(); }, 1500);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Save failed" });
    }
    setLoading(false);
  };

  const handleSnooze = () => {
    localStorage.setItem("wa_config_last_closed", Date.now().toString());
    sessionStorage.setItem("wa_config_snoozed", "true");
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 max-h-[92vh] flex flex-col">
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-700 px-6 py-5 relative text-white shrink-0">
          <button type="button" onClick={handleSnooze} className="absolute top-4 right-4 p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <MessageCircle size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-wide">WhatsApp API Configuration</h3>
              <p className="text-green-100 text-xs mt-0.5">Connect your Meta WhatsApp Cloud API account</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {message.text && (
            <div className={`p-3 rounded-xl flex items-start gap-2.5 text-sm ${
              message.type === "error" ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
            }`}>
              {message.type === "success" ? <Check size={18} className="shrink-0 mt-0.5" /> : <ShieldAlert size={18} className="shrink-0 mt-0.5" />}
              <span className="font-medium leading-relaxed">{message.text}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">WhatsApp Service Status</span>
              <span className="text-[11px] text-slate-400">Enable or disable your WhatsApp configuration</span>
            </div>
            <button type="button" onClick={() => setIsEnabled(!isEnabled)} className="focus:outline-none transition-transform active:scale-95">
              {isEnabled ? <ToggleRight size={44} className="text-emerald-600 cursor-pointer" /> : <ToggleLeft size={44} className="text-slate-300 cursor-pointer" />}
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Number ID *</label>
              <input type="text" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring focus:ring-emerald-100" placeholder="e.g. 123456789012345" required />
              <p className="text-[10px] text-slate-400">From Meta Developer Portal → WhatsApp → Getting Started</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Access Token *</label>
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-600 hover:text-emerald-700 hover:underline font-bold flex items-center gap-0.5">
                  Get Token <ExternalLink size={10} />
                </a>
              </div>
              <div className="relative">
                <input type={showToken ? "text" : "password"} value={accessToken} onChange={e => setAccessToken(e.target.value)} onClick={() => { if (accessToken === "••••••••••••••••") setAccessToken(""); }} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 pr-9 text-sm focus:outline-none focus:border-emerald-500 focus:ring focus:ring-emerald-100 font-mono" placeholder="EAAB..." required />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><EyeOff size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">WABA ID</label>
                <input type="text" value={wabaId} onChange={e => setWabaId(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring focus:ring-emerald-100" placeholder="WhatsApp Business Account ID" />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">App Secret</label>
                <div className="relative">
                  <input type={showSecret ? "text" : "password"} value={appSecret} onChange={e => setAppSecret(e.target.value)} onClick={() => { if (appSecret === "••••••••••••••••") setAppSecret(""); }} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 pr-9 text-sm focus:outline-none focus:border-emerald-500 focus:ring focus:ring-emerald-100 font-mono" placeholder="App Secret" />
                  <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><EyeOff size={16} /></button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Verify Token</label>
                <input type="text" value={verifyToken} onChange={e => setVerifyToken(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring focus:ring-emerald-100" placeholder="crm_verify_123" />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Business Account ID</label>
                <input type="text" value={businessAccountId} onChange={e => setBusinessAccountId(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring focus:ring-emerald-100" placeholder="Optional" />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-700 uppercase block">Verify Connection</span>
                  <span className="text-[10px] text-slate-400">Test credentials before saving</span>
                </div>
                <button type="button" disabled={testLoading} onClick={handleTestConnection} className="px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50 text-[11px] font-bold uppercase rounded-lg transition-colors">
                  {testLoading ? <Loader2 size={12} className="animate-spin inline" /> : "Test Connection"}
                </button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-700">
              <p className="font-semibold flex items-center gap-1"><HelpCircle size={12} /> How to get these credentials:</p>
              <ol className="list-decimal pl-4 space-y-0.5 mt-1">
                <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline">Meta Developer Portal</a></li>
                <li>Create/select your app → Add "WhatsApp" product</li>
                <li>Copy <strong>Phone Number ID</strong> and <strong>WABA ID</strong></li>
                <li>Generate a <strong>Permanent Access Token</strong> (Settings → Advanced → System User)</li>
              </ol>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button type="button" onClick={handleSnooze} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 font-bold text-xs uppercase tracking-wider transition-colors">
                Skip for Now
              </button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:bg-emerald-400 font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-100 transition-all flex items-center justify-center gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : "Save Configuration"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}