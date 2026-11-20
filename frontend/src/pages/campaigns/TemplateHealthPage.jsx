import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  HeartPulse,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Copy,
  Sparkles,
  Repeat,
} from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function TemplateHealthPage() {
  const [data, setData] = useState({ summary: { total: 0, approved: 0, pending: 0, rejected: 0, paused: 0, disabled: 0, alerts: [] }, templates: [] });
  const [suggestion, setSuggestion] = useState(null);
  const [replaceForm, setReplaceForm] = useState({ old_template_id: "", new_template_id: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await campaignApi.getTemplateHealthOverview();
      setData(res || { summary: { total: 0, approved: 0, pending: 0, rejected: 0, paused: 0, disabled: 0, alerts: [] }, templates: [] });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load template health overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDuplicate = async (id) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const copy = await campaignApi.duplicateHealthTemplate(id);
      setNotice(`Duplicated template as "${copy.name}" (DRAFT).`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSuggest = async (tmpl) => {
    setBusy(true);
    setError("");
    try {
      const res = await campaignApi.suggestTemplateImprovements({
        name: tmpl.name,
        category: tmpl.category,
        body: tmpl.body,
      });
      setSuggestion({ templateName: tmpl.name, ...res });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReplaceInDrafts = async (e) => {
    e.preventDefault();
    if (!replaceForm.old_template_id || !replaceForm.new_template_id) {
      setError("Select both the paused/rejected template and an APPROVED replacement template.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.replaceTemplateInDrafts({
        old_template_id: Number(replaceForm.old_template_id),
        new_template_id: Number(replaceForm.new_template_id),
      });
      setNotice(`Replaced template in ${res.updated_draft_campaigns} eligible DRAFT campaign(s) with "${res.replacement_template?.name}".`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const summary = data.summary || {};
  const templates = data.templates || [];
  const approvedTemplates = templates.filter((t) => t.meta_status_normalized === "APPROVED");

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <HeartPulse size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">Template Health Center</h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#D1FADF", color: "#16803C" }}>
                {summary.approved || 0} Approved
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Track Meta approval status, campaign usage, pacing incidents, variable integrity, AI copy checks, and safe draft-campaign template swaps.
            </p>
          </div>
        </div>
        <div className="hl-actions flex items-center gap-2">
          <Link to="/whatsapp/templates" className="hl-btn-secondary px-3.5 py-2 text-xs font-semibold cursor-pointer">
            Open Template Library
          </Link>
          <button type="button" onClick={load} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="hl-card p-3.5 flex items-center gap-2 text-xs font-medium" style={{ background: "#FEE4E2", color: "#B42318" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="hl-card p-3.5 flex items-center gap-2 text-xs font-medium" style={{ background: "#D1FADF", color: "#16803C" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> <span>{notice}</span>
        </div>
      )}

      <div className="hl-kpis">
        <div className="hl-kpi">
          <div className="text-xs font-semibold" style={{ color: "#667085" }}>Approved</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "#16803C" }}>{summary.approved || 0}</div>
        </div>
        <div className="hl-kpi">
          <div className="text-xs font-semibold" style={{ color: "#667085" }}>Pending Meta Review</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "#202C52" }}>{summary.pending || 0}</div>
        </div>
        <div className="hl-kpi">
          <div className="text-xs font-semibold" style={{ color: "#667085" }}>Paused / Disabled</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "#B42318" }}>{(summary.paused || 0) + (summary.disabled || 0)}</div>
        </div>
        <div className="hl-kpi">
          <div className="text-xs font-semibold" style={{ color: "#667085" }}>Rejected</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "#B42318" }}>{summary.rejected || 0}</div>
        </div>
      </div>

      {/* Safe Replacement in Draft Campaigns */}
      <div className="hl-card p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
          <Repeat className="w-4 h-4" /> Replace Unhealthy Template Across Draft Campaigns
        </h2>
        <form onSubmit={handleReplaceInDrafts} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="th-old" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Current Template</label>
            <select id="th-old" className="hl-select w-full" value={replaceForm.old_template_id} onChange={(e) => setReplaceForm({ ...replaceForm, old_template_id: e.target.value })}>
              <option value="">Select template to replace...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.meta_status_normalized})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="th-new" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Approved Replacement Template</label>
            <select id="th-new" className="hl-select w-full" value={replaceForm.new_template_id} onChange={(e) => setReplaceForm({ ...replaceForm, new_template_id: e.target.value })}>
              <option value="">Select APPROVED template...</option>
              {approvedTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy} className="hl-btn-primary px-4 py-2.5 text-xs font-semibold cursor-pointer">
            Replace in Draft Campaigns
          </button>
        </form>
      </div>

      {/* AI Suggestion Drawer */}
      {suggestion && (
        <div className="hl-card p-4 sm:p-5 space-y-2.5" style={{ borderColor: "#FCBD16", background: "#FFFDF5" }}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold m-0 flex items-center gap-1.5" style={{ color: "#202C52" }}>
              <Sparkles className="w-4 h-4" /> AI Template Review: {suggestion.templateName} (Category Preserved: {suggestion.preserved_category})
            </h3>
            <button type="button" onClick={() => setSuggestion(null)} className="hl-btn-secondary px-2.5 py-1 text-xs font-semibold cursor-pointer">Close</button>
          </div>
          {suggestion.risk_warnings?.length > 0 && (
            <div className="p-2.5 rounded-lg text-xs space-y-1" style={{ background: "#FEE4E2", color: "#B42318" }}>
              {suggestion.risk_warnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}
          {suggestion.suggestions?.length > 0 && (
            <ul className="m-0 pl-4 text-xs space-y-1" style={{ color: "#202C52" }}>
              {suggestion.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
          <div className="p-3 rounded-lg border text-xs" style={{ background: "#FFFFFF", borderColor: "#E4E7ED", color: "#202C52" }}>
            <div className="font-bold mb-1">Suggested Draft Copy:</div>
            <div>{suggestion.improved_draft}</div>
          </div>
          <div className="text-[11px]" style={{ color: "#667085" }}>{suggestion.meta_approval_disclaimer}</div>
        </div>
      )}

      {/* Templates Table */}
      <div className="hl-card p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold m-0" style={{ color: "#202C52" }}>All Workspace Templates ({templates.length})</h2>
        {loading ? (
          <p className="text-xs" style={{ color: "#667085" }}>Loading template health records...</p>
        ) : templates.length === 0 ? (
          <p className="text-xs" style={{ color: "#667085" }}>No templates synced yet. Create or sync templates in /whatsapp/templates.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: "#E4E7ED", color: "#667085" }}>
                  <th className="py-2 pr-3">Template</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Meta Status</th>
                  <th className="py-2 pr-3">Campaign Usage</th>
                  <th className="py-2 pr-3">Health Alerts</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b" style={{ borderColor: "#F2F4F7" }}>
                    <td className="py-2.5 pr-3 font-bold" style={{ color: "#202C52" }}>
                      {t.name}
                      <div className="text-[11px] font-normal" style={{ color: "#667085" }}>Lang: {t.language || "en"} | Vars: {t.variables?.length || 0}</div>
                    </td>
                    <td className="py-2.5 pr-3">{t.category || "MARKETING"}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="px-2 py-0.5 rounded font-bold"
                        style={
                          t.meta_status_normalized === "APPROVED"
                            ? { background: "#D1FADF", color: "#16803C" }
                            : ["REJECTED", "PAUSED", "DISABLED"].includes(t.meta_status_normalized)
                            ? { background: "#FEE4E2", color: "#B42318" }
                            : { background: "#FFF4CC", color: "#202C52" }
                        }
                      >
                        {t.meta_status_normalized}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">{t.campaign_usage_count || 0} ({t.draft_usage_count || 0} draft)</td>
                    <td className="py-2.5 pr-3" style={{ color: t.issues?.length ? "#B42318" : "#16803C" }}>
                      {t.issues?.length ? t.issues.join("; ") : "Healthy"}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button type="button" disabled={busy} onClick={() => handleSuggest(t)} className="hl-btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold cursor-pointer">
                          <Sparkles className="w-3 h-3" /> Improve
                        </button>
                        <button type="button" disabled={busy} onClick={() => handleDuplicate(t.id)} className="hl-btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold cursor-pointer">
                          <Copy className="w-3 h-3" /> Duplicate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
