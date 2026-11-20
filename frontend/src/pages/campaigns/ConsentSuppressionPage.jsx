import { useEffect, useState, useCallback, useMemo } from "react";
import { ShieldCheck, Ban, CheckCircle2, AlertCircle, Trash2, Search, Download, RefreshCw } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function ConsentSuppressionPage({ defaultTab = "consent" }) {
  const [tab, setTab] = useState(defaultTab);
  const [consents, setConsents] = useState([]);
  const [suppressions, setSuppressions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [consentForm, setConsentForm] = useState({
    phone: "",
    purpose: "marketing",
    collection_method: "website_form",
    form_reference: "",
    captured_wording: "",
  });
  const [supForm, setSupForm] = useState({
    phone: "",
    scope: "company",
    category: "ALL",
    reason: "user_opt_out",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [c, s] = await Promise.all([
        campaignApi.listConsents(),
        campaignApi.listSuppressions(),
      ]);
      setConsents(Array.isArray(c) ? c : []);
      setSuppressions(Array.isArray(s) ? s : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load compliance records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRecordConsent = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.recordConsent(consentForm);
      setNotice(`Consent recorded with evidence reference ${res.evidence_ref}.`);
      setConsentForm({ ...consentForm, phone: "", captured_wording: "", form_reference: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleRevoke = async (phone, purpose) => {
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.revokeConsent({ phone, purpose, reason: "admin_revoked" });
      setNotice(`Revoked consent for ${phone}. Cancelled ${res.cancelled_recipients || 0} queued recipient sends.`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleAddSuppression = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.addSuppression(supForm);
      setNotice(`Suppressed ${res.normalized_phone}. Cancelled ${res.cancelledRecipients || 0} queued sends.`);
      setSupForm({ ...supForm, phone: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleExportCsv = () => {
    const isConsent = tab === "consent";
    const rows = isConsent ? filteredConsents : filteredSuppressions;
    const lines = isConsent
      ? [
          "phone,purpose,category,status,collection_method,evidence_ref",
          ...rows.map((r) => `${r.normalized_phone},${r.purpose},${r.category},${r.status},${r.collection_method},${r.evidence_ref || ""}`),
        ]
      : [
          "phone,scope,category,reason,source",
          ...rows.map((r) => `${r.normalized_phone},${r.scope},${r.category},"${String(r.reason || "").replace(/"/g, '""')}",${r.source || ""}`),
        ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isConsent ? "madhura_consent_ledger.csv" : "madhura_dnc_suppressions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredConsents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return consents;
    return consents.filter(
      (c) =>
        String(c.normalized_phone || "").toLowerCase().includes(q) ||
        String(c.purpose || "").toLowerCase().includes(q) ||
        String(c.evidence_ref || "").toLowerCase().includes(q)
    );
  }, [consents, search]);

  const filteredSuppressions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppressions;
    return suppressions.filter(
      (s) =>
        String(s.normalized_phone || "").toLowerCase().includes(q) ||
        String(s.reason || "").toLowerCase().includes(q) ||
        String(s.scope || "").toLowerCase().includes(q)
    );
  }, [suppressions, search]);

  const grantedCount = consents.filter((c) => c.status === "GRANTED").length;
  const marketingGranted = consents.filter((c) => c.status === "GRANTED" && String(c.category).toUpperCase() === "MARKETING").length;

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      {/* Native /whatsapp Command Bar */}
      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">Consent, Opt-In &amp; Suppression Center</h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#D1FADF", color: "#16803C" }}>
                {grantedCount} Active Opt-Ins
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Evidence-backed Meta compliance ledger. Suppression overrides positive segments and immediately cancels queued sends.
            </p>
          </div>
        </div>

        <div className="hl-actions flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("consent")}
            className={tab === "consent" ? "hl-btn-primary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer" : "hl-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer"}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Consent Records ({consents.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("suppression")}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={
              tab === "suppression"
                ? { background: "#B42318", color: "#FFFFFF", border: "1px solid #B42318" }
                : { background: "#FFFFFF", color: "#202C52", border: "1px solid #CBD2DE" }
            }
          >
            <Ban className="w-3.5 h-3.5" /> DNC Suppressions ({suppressions.length})
          </button>
          <button type="button" onClick={handleExportCsv} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button type="button" onClick={load} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Compliance KPIs */}
      <div className="hl-kpis">
        {[
          { label: "Total Consent Records", value: consents.length, sub: `${grantedCount} currently granted` },
          { label: "Marketing Opt-Ins", value: marketingGranted, sub: "Eligible for Meta marketing templates" },
          { label: "Active DNC Suppressions", value: suppressions.length, sub: "Blocked across all campaigns & bots" },
          { label: "Revocation Rule", value: "Instant", sub: "STOP / UNSUBSCRIBE cancels queued jobs" },
        ].map((k) => (
          <div key={k.label} className="hl-kpi">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#667085" }}>{k.label}</div>
            <div className="text-xl font-bold mt-1" style={{ color: "#202C52", fontFamily: "var(--font-display)" }}>{k.value}</div>
            <div className="text-[11px] mt-1" style={{ color: "#667085" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg text-xs font-medium flex items-center gap-2" style={{ background: "#FEE4E2", border: "1px solid #FDA29B", color: "#B42318" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-lg text-xs font-medium flex items-center gap-2" style={{ background: "#D1FADF", border: "1px solid #A6F4C5", color: "#16803C" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {tab === "consent" ? (
        <div className="space-y-4">
          <form onSubmit={handleRecordConsent} className="hl-card p-5 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#202C52" }}>
              Record Verifiable Opt-In Consent
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor="con-phone" className="block text-[11px] font-semibold mb-1" style={{ color: "#202C52" }}>Customer Phone *</label>
                <input id="con-phone" required value={consentForm.phone} onChange={(e) => setConsentForm({ ...consentForm, phone: e.target.value })} placeholder="+91 98765 43210" className="hl-input w-full px-3 py-2 text-xs" />
              </div>
              <div>
                <label htmlFor="con-purpose" className="block text-[11px] font-semibold mb-1" style={{ color: "#202C52" }}>Consent Purpose</label>
                <select id="con-purpose" value={consentForm.purpose} onChange={(e) => setConsentForm({ ...consentForm, purpose: e.target.value })} className="hl-select w-full px-3 py-2 text-xs bg-white cursor-pointer">
                  <option value="marketing">Marketing</option>
                  <option value="promotional_updates">Promotional Updates</option>
                  <option value="product_updates">Product Updates</option>
                  <option value="utility">Utility</option>
                  <option value="appointment_notifications">Appointment Notifications</option>
                </select>
              </div>
              <div>
                <label htmlFor="con-method" className="block text-[11px] font-semibold mb-1" style={{ color: "#202C52" }}>Collection Method</label>
                <select id="con-method" value={consentForm.collection_method} onChange={(e) => setConsentForm({ ...consentForm, collection_method: e.target.value })} className="hl-select w-full px-3 py-2 text-xs bg-white cursor-pointer">
                  <option value="website_form">Website Form</option>
                  <option value="checkout_form">Checkout Form</option>
                  <option value="whatsapp_inbound_optin">WhatsApp Inbound Opt-In</option>
                  <option value="crm_manual_with_evidence">CRM Manual (With Evidence)</option>
                  <option value="meta_optin_flow">Meta Opt-In Flow</option>
                </select>
              </div>
              <div>
                <label htmlFor="con-ref" className="block text-[11px] font-semibold mb-1" style={{ color: "#202C52" }}>Source URL / Form Reference</label>
                <input id="con-ref" value={consentForm.form_reference} onChange={(e) => setConsentForm({ ...consentForm, form_reference: e.target.value })} placeholder="https://company.com/signup" className="hl-input w-full px-3 py-2 text-xs" />
              </div>
              <div>
                <label htmlFor="con-wording" className="block text-[11px] font-semibold mb-1" style={{ color: "#202C52" }}>Captured Opt-In Wording *</label>
                <input id="con-wording" required value={consentForm.captured_wording} onChange={(e) => setConsentForm({ ...consentForm, captured_wording: e.target.value })} placeholder="Customer agreed to WhatsApp updates" className="hl-input w-full px-3 py-2 text-xs" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="hl-btn-primary w-full px-4 text-xs font-semibold cursor-pointer">
                  Record Consent With Evidence
                </button>
              </div>
            </div>
          </form>

          <div className="hl-card overflow-hidden">
            <div className="p-3.5 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "#E4E7ED" }}>
              <span className="text-xs font-bold uppercase" style={{ color: "#202C52" }}>Consent Evidence Ledger ({filteredConsents.length})</span>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: "#667085" }} />
                <input
                  type="text"
                  aria-label="Search consent records"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search phone or evidence ref..."
                  className="hl-input w-full pl-8 pr-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ background: "#F7F8FA", borderBottom: "1px solid #E4E7ED", color: "#202C52" }} className="text-left uppercase font-bold">
                  <tr>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Purpose / Category</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Method &amp; Evidence Ref</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                  {filteredConsents.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "#667085" }}>No consent records match this filter.</td></tr>
                  ) : filteredConsents.map((c) => (
                    <tr key={c.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "#202C52" }}>{c.normalized_phone}</td>
                      <td className="px-4 py-2.5" style={{ color: "#202C52" }}>{c.purpose} ({c.category})</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded font-bold" style={c.status === "GRANTED" ? { background: "#D1FADF", color: "#16803C" } : { background: "#FEE4E2", color: "#B42318" }}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "#667085" }}>{c.collection_method} | <code>{c.evidence_ref || "None"}</code></td>
                      <td className="px-4 py-2.5 text-right">
                        {c.status === "GRANTED" && (
                          <button type="button" onClick={() => handleRevoke(c.normalized_phone, c.purpose)} className="font-semibold hover:underline cursor-pointer" style={{ color: "#B42318" }}>
                            Revoke &amp; Suppress
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <form onSubmit={handleAddSuppression} className="hl-card p-5 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#202C52" }}>
              Add Phone to Do-Not-Contact Suppression List
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label htmlFor="sup-phone" className="block text-[11px] font-semibold mb-1" style={{ color: "#202C52" }}>Phone *</label>
                <input id="sup-phone" required value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} placeholder="+91..." className="hl-input w-full px-3 py-2 text-xs" />
              </div>
              <div>
                <label htmlFor="sup-scope" className="block text-[11px] font-semibold mb-1" style={{ color: "#202C52" }}>Scope</label>
                <select id="sup-scope" value={supForm.scope} onChange={(e) => setSupForm({ ...supForm, scope: e.target.value })} className="hl-select w-full px-3 py-2 text-xs bg-white cursor-pointer">
                  <option value="company">Company-wide</option>
                  <option value="workspace">Workspace</option>
                  <option value="agency_client">Agency Client</option>
                  <option value="compliance">Legal / Compliance</option>
                </select>
              </div>
              <div>
                <label htmlFor="sup-cat" className="block text-[11px] font-semibold mb-1" style={{ color: "#202C52" }}>Category</label>
                <select id="sup-cat" value={supForm.category} onChange={(e) => setSupForm({ ...supForm, category: e.target.value })} className="hl-select w-full px-3 py-2 text-xs bg-white cursor-pointer">
                  <option value="ALL">ALL Categories</option>
                  <option value="MARKETING">MARKETING Only</option>
                  <option value="UTILITY">UTILITY Only</option>
                </select>
              </div>
              <div>
                <label htmlFor="sup-reason" className="block text-[11px] font-semibold mb-1" style={{ color: "#202C52" }}>Reason</label>
                <input id="sup-reason" value={supForm.reason} onChange={(e) => setSupForm({ ...supForm, reason: e.target.value })} placeholder="Suppression reason" className="hl-input w-full px-3 py-2 text-xs" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full min-h-[40px] px-4 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ background: "#B42318" }}>
                  Add Suppression
                </button>
              </div>
            </div>
          </form>

          <div className="hl-card overflow-hidden">
            <div className="p-3.5 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "#E4E7ED" }}>
              <span className="text-xs font-bold uppercase" style={{ color: "#202C52" }}>Active Suppression Entries ({filteredSuppressions.length})</span>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: "#667085" }} />
                <input
                  type="text"
                  aria-label="Search suppressions"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search phone, scope or reason..."
                  className="hl-input w-full pl-8 pr-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ background: "#F7F8FA", borderBottom: "1px solid #E4E7ED", color: "#202C52" }} className="text-left uppercase font-bold">
                  <tr>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Scope / Category</th>
                    <th className="px-4 py-2.5">Reason &amp; Source</th>
                    <th className="px-4 py-2.5 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                  {filteredSuppressions.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: "#667085" }}>No active suppressions recorded.</td></tr>
                  ) : filteredSuppressions.map((s) => (
                    <tr key={s.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "#202C52" }}>{s.normalized_phone}</td>
                      <td className="px-4 py-2.5" style={{ color: "#202C52" }}>{s.scope} | {s.category}</td>
                      <td className="px-4 py-2.5" style={{ color: "#667085" }}>{s.reason} ({s.source})</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          aria-label={`Remove suppression for ${s.normalized_phone}`}
                          onClick={() => campaignApi.removeSuppression(s.id).then(load)}
                          className="p-1.5 rounded hover:bg-[#FEE4E2] cursor-pointer"
                          style={{ color: "#B42318" }}
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
