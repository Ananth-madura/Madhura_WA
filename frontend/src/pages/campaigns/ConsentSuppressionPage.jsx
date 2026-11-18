import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Ban, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function ConsentSuppressionPage({ defaultTab = "consent" }) {
  const [tab, setTab] = useState(defaultTab);
  const [consents, setConsents] = useState([]);
  const [suppressions, setSuppressions] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [consentForm, setConsentForm] = useState({
    phone: "",
    purpose: "marketing",
    collection_method: "website_form",
    form_reference: "",
    captured_wording: "",
  });
  const [supForm, setSupForm] = useState({ phone: "", scope: "company", category: "ALL", reason: "user_opt_out" });

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        campaignApi.listConsents(),
        campaignApi.listSuppressions(),
      ]);
      setConsents(Array.isArray(c) ? c : []);
      setSuppressions(Array.isArray(s) ? s : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRecordConsent = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.recordConsent(consentForm);
      setNotice(`Consent recorded with evidence ref ${res.evidence_ref}`);
      setConsentForm({ ...consentForm, phone: "", captured_wording: "", form_reference: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleRevoke = async (phone, purpose) => {
    setError("");
    try {
      const res = await campaignApi.revokeConsent({ phone, purpose, reason: "admin_revoked" });
      setNotice(`Revoked consent for ${phone}. Cancelled ${res.cancelled_recipients} queued recipients.`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleAddSuppression = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await campaignApi.addSuppression(supForm);
      setNotice(`Suppressed ${res.normalized_phone}. Cancelled ${res.cancelledRecipients || 0} queued sends.`);
      setSupForm({ ...supForm, phone: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Consent, Opt-In &amp; Suppression Center</h1>
            <p className="text-sm text-slate-600">Central compliance engine. Suppression always overrides positive segment rules and immediately cancels queued sends.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTab("consent")} className={`px-3 py-2 rounded-lg text-xs font-semibold ${tab === "consent" ? "bg-emerald-600 text-white" : "bg-white border border-slate-300 text-slate-700"}`}>
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1" /> Consent Records ({consents.length})
            </button>
            <button onClick={() => setTab("suppression")} className={`px-3 py-2 rounded-lg text-xs font-semibold ${tab === "suppression" ? "bg-rose-600 text-white" : "bg-white border border-slate-300 text-slate-700"}`}>
              <Ban className="w-3.5 h-3.5 inline mr-1" /> Suppression Lists ({suppressions.length})
            </button>
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        {notice && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

        {tab === "consent" ? (
          <div className="space-y-5">
            <form onSubmit={handleRecordConsent} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <input required value={consentForm.phone} onChange={(e) => setConsentForm({ ...consentForm, phone: e.target.value })} placeholder="Phone (+91...)" className="px-3 py-2 border border-slate-300 rounded-lg text-xs" />
              <select value={consentForm.purpose} onChange={(e) => setConsentForm({ ...consentForm, purpose: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                <option value="marketing">Marketing</option>
                <option value="promotional_updates">Promotional Updates</option>
                <option value="product_updates">Product Updates</option>
                <option value="utility">Utility</option>
                <option value="appointment_notifications">Appointment Notifications</option>
              </select>
              <select value={consentForm.collection_method} onChange={(e) => setConsentForm({ ...consentForm, collection_method: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                <option value="website_form">Website Form</option>
                <option value="checkout_form">Checkout Form</option>
                <option value="whatsapp_inbound_optin">WhatsApp Inbound Opt-In</option>
                <option value="crm_manual_with_evidence">CRM Manual (With Evidence)</option>
                <option value="meta_optin_flow">Meta Opt-In Flow</option>
              </select>
              <input value={consentForm.form_reference} onChange={(e) => setConsentForm({ ...consentForm, form_reference: e.target.value })} placeholder="Form / Webpage URL Reference" className="px-3 py-2 border border-slate-300 rounded-lg text-xs" />
              <input required value={consentForm.captured_wording} onChange={(e) => setConsentForm({ ...consentForm, captured_wording: e.target.value })} placeholder="Captured Opt-In Wording *" className="px-3 py-2 border border-slate-300 rounded-lg text-xs" />
              <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">Record Consent With Evidence</button>
            </form>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-600 uppercase">
                  <tr><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Purpose</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Method / Evidence Ref</th><th className="px-4 py-2 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consents.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-mono">{c.normalized_phone}</td>
                      <td className="px-4 py-2.5">{c.purpose} ({c.category})</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded font-semibold ${c.status === "GRANTED" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{c.collection_method} · <code>{c.evidence_ref || "—"}</code></td>
                      <td className="px-4 py-2.5 text-right">
                        {c.status === "GRANTED" && (
                          <button onClick={() => handleRevoke(c.normalized_phone, c.purpose)} className="text-rose-600 font-semibold hover:underline">Revoke &amp; Suppress</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <form onSubmit={handleAddSuppression} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-5 gap-3">
              <input required value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} placeholder="Phone (+91...)" className="px-3 py-2 border border-slate-300 rounded-lg text-xs" />
              <select value={supForm.scope} onChange={(e) => setSupForm({ ...supForm, scope: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                <option value="company">Company-wide</option>
                <option value="workspace">Workspace</option>
                <option value="agency_client">Agency Client</option>
                <option value="compliance">Legal / Compliance</option>
              </select>
              <select value={supForm.category} onChange={(e) => setSupForm({ ...supForm, category: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                <option value="ALL">ALL Categories</option>
                <option value="MARKETING">MARKETING Only</option>
                <option value="UTILITY">UTILITY Only</option>
              </select>
              <input value={supForm.reason} onChange={(e) => setSupForm({ ...supForm, reason: e.target.value })} placeholder="Suppression Reason" className="px-3 py-2 border border-slate-300 rounded-lg text-xs" />
              <button type="submit" className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700">Add Suppression</button>
            </form>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-600 uppercase">
                  <tr><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Scope / Category</th><th className="px-4 py-2">Reason</th><th className="px-4 py-2 text-right">Remove</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppressions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5 font-mono">{s.normalized_phone}</td>
                      <td className="px-4 py-2.5">{s.scope} · {s.category}</td>
                      <td className="px-4 py-2.5 text-slate-600">{s.reason} ({s.source})</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => campaignApi.removeSuppression(s.id).then(load)} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4 inline" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
