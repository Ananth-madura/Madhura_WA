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
    <div className="fixed inset-0 bg-[var(--color-shell)]/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-4">
      <div className="hl-card bg-[var(--color-paper-2)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[var(--color-rule)] max-h-[92dvh] flex flex-col">
        <div className="hl-commandbar bg-[var(--color-shell)] px-4 sm:px-6 py-4 sm:py-5 relative text-[var(--color-paper-2)] shrink-0">
          <button type="button" onClick={handleSnooze} className="absolute top-4 right-4 p-1 rounded-full bg-[var(--color-shell-2)] hover:bg-[var(--color-ink-2)] text-[var(--color-paper-2)] transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--color-accent)] rounded-xl">
              <MessageCircle size={24} className="text-[var(--color-accent-ink)]" />
            </div>
            <div>
              <h3 className="hl-title text-lg font-bold tracking-wide text-[var(--color-paper-2)]">WhatsApp API Configuration</h3>
              <p className="hl-subtitle text-xs mt-0.5 text-[var(--color-paper-2)]">Connect your Meta WhatsApp Cloud API account</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1 min-h-0 wa-custom-scrollbar overscroll-contain">
          {message.text && (
            <div className={`p-3 rounded-xl flex items-start gap-2.5 text-sm hl-badge ${
              message.type === "error" ? "hl-badge-error" : "hl-badge-success"
            }`}>
              {message.type === "success" ? <Check size={18} className="shrink-0 mt-0.5" /> : <ShieldAlert size={18} className="shrink-0 mt-0.5" />}
              <span className="font-medium leading-relaxed">{message.text}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-3.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl">
            <div>
              <span className="hl-section-label text-xs font-bold uppercase tracking-wider block text-[var(--color-ink)]">WhatsApp Service Status</span>
              <span className="text-[11px] text-[var(--color-ink-2)]">Enable or disable your WhatsApp configuration</span>
            </div>
            <button type="button" onClick={() => setIsEnabled(!isEnabled)} className="focus:outline-none transition-transform active:scale-95">
              {isEnabled ? <ToggleRight size={44} className="text-[var(--color-ink)] cursor-pointer" /> : <ToggleLeft size={44} className="text-[var(--color-ink-2)] cursor-pointer" />}
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="hl-section-label block text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-2)]">Phone Number ID *</label>
              <input type="text" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} className="hl-input w-full border border-[var(--color-rule)] rounded-xl px-3 py-2.5 text-sm focus:outline-none font-[var(--font-body)]" placeholder="e.g. 123456789012345" required />
              <p className="text-[10px] text-[var(--color-ink-2)]">From Meta Developer Portal → WhatsApp → Getting Started</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="hl-section-label block text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-2)]">Access Token *</label>
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[var(--color-ink)] hover:text-[var(--color-focus)] hover:underline font-bold flex items-center gap-0.5">
                  Get Token <ExternalLink size={10} />
                </a>
              </div>
              <div className="relative">
                <input type={showToken ? "text" : "password"} value={accessToken} onChange={e => setAccessToken(e.target.value)} onClick={() => { if (accessToken === "••••••••••••••••") setAccessToken(""); }} className="hl-input hl-id w-full border border-[var(--color-rule)] rounded-xl px-3 py-2.5 pr-9 text-sm focus:outline-none font-mono" placeholder="EAAB..." required />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"><EyeOff size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="hl-section-label block text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-2)]">WABA ID</label>
                <input type="text" value={wabaId} onChange={e => setWabaId(e.target.value)} className="hl-input w-full border border-[var(--color-rule)] rounded-xl px-3 py-2.5 text-sm focus:outline-none font-[var(--font-body)]" placeholder="WhatsApp Business Account ID" />
              </div>
              <div className="space-y-1">
                <label className="hl-section-label block text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-2)]">App Secret</label>
                <div className="relative">
                  <input type={showSecret ? "text" : "password"} value={appSecret} onChange={e => setAppSecret(e.target.value)} onClick={() => { if (appSecret === "••••••••••••••••") setAppSecret(""); }} className="hl-input hl-id w-full border border-[var(--color-rule)] rounded-xl px-3 py-2.5 pr-9 text-sm focus:outline-none font-mono" placeholder="App Secret" />
                  <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"><EyeOff size={16} /></button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="hl-section-label block text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-2)]">Verify Token</label>
                <input type="text" value={verifyToken} onChange={e => setVerifyToken(e.target.value)} className="hl-input w-full border border-[var(--color-rule)] rounded-xl px-3 py-2.5 text-sm focus:outline-none font-[var(--font-body)]" placeholder="crm_verify_123" />
              </div>
              <div className="space-y-1">
                <label className="hl-section-label block text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-2)]">Business Account ID</label>
                <input type="text" value={businessAccountId} onChange={e => setBusinessAccountId(e.target.value)} className="hl-input w-full border border-[var(--color-rule)] rounded-xl px-3 py-2.5 text-sm focus:outline-none font-[var(--font-body)]" placeholder="Optional" />
              </div>
            </div>

            <div className="border border-[var(--color-rule)] rounded-xl p-3.5 bg-[var(--color-paper)]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="hl-section-label text-[11px] font-bold uppercase block text-[var(--color-ink)]">Verify Connection</span>
                  <span className="text-[10px] text-[var(--color-ink-2)]">Test credentials before saving</span>
                </div>
                <button type="button" disabled={testLoading} onClick={handleTestConnection} className="hl-btn-secondary px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors disabled:opacity-50">
                  {testLoading ? <Loader2 size={12} className="animate-spin inline" /> : "Test Connection"}
                </button>
              </div>
            </div>

            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-3 text-[11px] text-[var(--color-ink-2)]">
              <p className="font-semibold flex items-center gap-1"><HelpCircle size={12} /> How to get these credentials:</p>
              <ol className="list-decimal pl-4 space-y-0.5 mt-1">
                <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-ink)] font-bold underline">Meta Developer Portal</a></li>
                <li>Create/select your app → Add "WhatsApp" product</li>
                <li>Copy <strong>Phone Number ID</strong> and <strong>WABA ID</strong></li>
                <li>Generate a <strong>Permanent Access Token</strong> (Settings → Advanced → System User)</li>
              </ol>
            </div>

            <div className="pt-3 border-t border-[var(--color-rule)] flex gap-3">
              <button type="button" onClick={handleSnooze} className="hl-btn-secondary flex-1 px-4 py-2.5 border border-[var(--color-rule)] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors">
                Skip for Now
              </button>
              <button type="submit" disabled={loading} className="hl-btn-primary flex-1 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : "Save Configuration"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}