import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RefreshCw, Plus, Send, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function TemplateStudioPage() {
  const [searchParams] = useSearchParams();
  const [templates, setTemplates] = useState([]);
  const [senders, setSenders] = useState([]);
  const [publishedFlows, setPublishedFlows] = useState([]);
  const [selectedSender, setSelectedSender] = useState("");
  const [showCreate, setShowCreate] = useState(Boolean(searchParams.get("flow_id")));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "MARKETING",
    language: "en",
    header_type: "NONE",
    header_value: "",
    body: "Hello {{1}}, thank you for connecting with us!",
    footer: "",
    examples: "Customer",
    flow_button_id: searchParams.get("flow_id") || "",
    flow_button_text: "Open Form",
  });

  const load = useCallback(async () => {
    try {
      const [tmpls, prov, flws] = await Promise.all([
        campaignApi.listTemplates(),
        campaignApi.getProviderStatus().catch(() => ({ senders: [] })),
        campaignApi.listFlows({ status: "PUBLISHED" }).catch(() => []),
      ]);
      setTemplates(Array.isArray(tmpls) ? tmpls : []);
      setPublishedFlows(Array.isArray(flws) ? flws : []);
      const sList = Array.isArray(prov?.senders) ? prov.senders : [];
      setSenders(sList);
      if (sList.length && !selectedSender) setSelectedSender(String(sList[0].id));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [selectedSender]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    if (!selectedSender) { setError("Select a connected WABA sender to sync from Meta."); return; }
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.syncTemplates({ sender_id: Number(selectedSender) });
      setNotice(`Synced ${res.synced_count} templates from WABA ${res.waba_id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const buttons = form.flow_button_id.trim()
        ? [{ type: "FLOW", text: form.flow_button_text || "Open Form", flow_id: form.flow_button_id.trim(), flow_action: "navigate" }]
        : [];
      const examples = form.examples ? form.examples.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const created = await campaignApi.createTemplate({
        name: form.name,
        category: form.category,
        language: form.language,
        header_type: form.header_type === "NONE" ? null : form.header_type,
        header_value: form.header_value || null,
        body: form.body,
        footer: form.footer || null,
        buttons,
        examples,
        sender_id: selectedSender ? Number(selectedSender) : null,
      });
      setNotice(`Saved draft template '${created.name}' (status: DRAFT — submit to Meta for approval).`);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleSubmitMeta = async (tmplId) => {
    if (!selectedSender) { setError("Select a connected sender before submitting to Meta."); return; }
    setError("");
    try {
      const res = await campaignApi.submitTemplate(tmplId, { sender_id: Number(selectedSender), examples: ["Sample"] });
      setNotice(`Submitted '${res.name}' to Meta (status: ${res.meta_status})`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav />
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">WhatsApp Template Library (WABA-Scoped)</h1>
            <p className="text-sm text-slate-600">Sync real Meta approval statuses, create templates with WhatsApp Flow buttons, and enforce category policies.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedSender} onChange={(e) => setSelectedSender(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
              <option value="">-- Select Sender / WABA --</option>
              {senders.map((s) => <option key={s.id} value={s.id}>{s.display_phone} (WABA {s.waba_id})</option>)}
            </select>
            <button onClick={handleSync} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700">
              <RefreshCw className="w-3.5 h-3.5" /> Sync From Meta
            </button>
            <button onClick={() => setShowCreate((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> New Template
            </button>
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        {notice && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="lowercase_template_name *" className="px-3 py-2 border border-slate-300 rounded-lg" />
            <div className="flex gap-2">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="MARKETING">MARKETING</option>
                <option value="UTILITY">UTILITY</option>
                <option value="AUTHENTICATION">AUTHENTICATION</option>
              </select>
              <input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="en" className="w-24 px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <textarea required rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Body text with {{1}}, {{2}} positional variables" className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg" />
            <input value={form.examples} onChange={(e) => setForm({ ...form, examples: e.target.value })} placeholder="Comma-separated examples for variables (e.g. Arun, ORD-101)" className="px-3 py-2 border border-slate-300 rounded-lg" />
            <input value={form.footer} onChange={(e) => setForm({ ...form, footer: e.target.value })} placeholder="Optional footer (e.g. Reply STOP to opt out)" className="px-3 py-2 border border-slate-300 rounded-lg" />
            <div className="flex gap-2">
              <select value={form.flow_button_id} onChange={(e) => setForm({ ...form, flow_button_id: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">-- Optional: Attach Published WhatsApp Flow Button --</option>
                {publishedFlows.map((fl) => (
                  <option key={fl.id} value={fl.meta_flow_id || fl.id}>{fl.name} ({fl.category})</option>
                ))}
              </select>
            </div>
            <input value={form.flow_button_text} onChange={(e) => setForm({ ...form, flow_button_text: e.target.value })} placeholder="Flow CTA button text" className="px-3 py-2 border border-slate-300 rounded-lg" />
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold">Save Local Draft</button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600 uppercase">
              <tr><th className="px-4 py-2.5">Template</th><th className="px-4 py-2.5">WABA / Lang</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">Meta Status / Quality</th><th className="px-4 py-2.5 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No templates yet. Sync from Meta or create a draft above.</td></tr>
              ) : templates.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{t.name}</div>
                    <div className="text-slate-500 line-clamp-1">{t.body}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.waba_id || "Local"} · {t.language}</td>
                  <td className="px-4 py-3">{t.category}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded font-semibold ${t.meta_status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : t.meta_status === "REJECTED" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                      {t.meta_status}
                    </span>
                    {t.quality_score && <span className="ml-2 text-slate-500">Quality: {t.quality_score}</span>}
                    {t.rejection_reason && <div className="text-rose-600 mt-0.5">{t.rejection_reason}</div>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {t.meta_status === "DRAFT" && (
                      <button onClick={() => handleSubmitMeta(t.id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 text-white font-medium">
                        <Send className="w-3 h-3" /> Submit to Meta
                      </button>
                    )}
                    {t.meta_status === "APPROVED" && (
                      <Link to={`/dashboard/campaigns/create?template_id=${t.id}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold">
                        Use in Campaign <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
