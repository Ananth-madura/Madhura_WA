import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Users, Calculator, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

const FIELD_OPTIONS = [
  { value: "tags", label: "Contact Tags" },
  { value: "name", label: "Full Name" },
  { value: "email", label: "Email" },
  { value: "country_code", label: "Country Code" },
  { value: "source", label: "Acquisition Source" },
  { value: "crm_ref_type", label: "CRM Record Type (lead/customer)" },
  { value: "last_contacted", label: "Last Interaction Date" },
  { value: "custom_fields.city", label: "Custom: City" },
  { value: "custom_fields.product_interest", label: "Custom: Product Interest" },
  { value: "custom_fields.customer_tier", label: "Custom: Customer Tier" },
];

const OPERATORS = [
  "equals", "not_equals", "contains", "not_contains", "starts_with",
  "in", "gt", "gte", "lt", "lte", "within_days", "older_than_days", "is_empty", "is_not_empty",
];

export default function AudienceBuilderPage() {
  const [segments, setSegments] = useState([]);
  const [presets, setPresets] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logic, setLogic] = useState("AND");
  const [includeRules, setIncludeRules] = useState([{ field: "tags", operator: "contains", value: "VIP" }]);
  const [excludeRules, setExcludeRules] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [segs, pre] = await Promise.all([
        campaignApi.listSegments(),
        campaignApi.getPresets(),
      ]);
      setSegments(Array.isArray(segs) ? segs : []);
      setPresets(Array.isArray(pre?.presets) ? pre.presets : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const definition = { logic, include: includeRules, exclude: excludeRules };

  const runLiveEstimate = async () => {
    setError("");
    try {
      const res = await campaignApi.estimateLive({ definition, category: "MARKETING" });
      setEstimate(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleSaveSegment = async () => {
    if (!name.trim()) { setError("Segment name is required"); return; }
    setError("");
    try {
      const created = await campaignApi.createSegment({ name: name.trim(), description, definition });
      await campaignApi.estimateSegment(created.id, { category: "MARKETING" });
      setNotice(`Saved segment '${created.name}'`);
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const applyPreset = (preset) => {
    setName(preset.name);
    setDescription(preset.description);
    setLogic(preset.definition.logic || "AND");
    setIncludeRules(preset.definition.include || []);
    setExcludeRules(preset.definition.exclude || []);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Advanced Audience Builder</h1>
          <p className="text-sm text-slate-600">Build dynamic AND/OR CRM segments with backend consent &amp; suppression evaluation.</p>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}
        {notice && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

        {/* Presets */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Reusable Segment Presets
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p.key} onClick={() => applyPreset(p)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-xs font-medium">
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Condition Builder + Live Backend Estimate */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name (e.g. Chennai VIP Active)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase">Include Contacts Matching</span>
              <select value={logic} onChange={(e) => setLogic(e.target.value)} className="px-2.5 py-1 border border-slate-300 rounded text-xs bg-white">
                <option value="AND">ALL conditions (AND)</option>
                <option value="OR">ANY condition (OR)</option>
              </select>
            </div>

            <div className="space-y-2">
              {includeRules.map((rule, idx) => (
                <div key={idx} className="flex flex-wrap gap-2 items-center">
                  <select value={rule.field} onChange={(e) => setIncludeRules((r) => r.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x)))} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
                    {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select value={rule.operator} onChange={(e) => setIncludeRules((r) => r.map((x, i) => (i === idx ? { ...x, operator: e.target.value } : x)))} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
                    {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <input value={rule.value} onChange={(e) => setIncludeRules((r) => r.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))} placeholder="Value" className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs" />
                  <button onClick={() => setIncludeRules((r) => r.filter((_, i) => i !== idx))} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setIncludeRules((r) => [...r, { field: "tags", operator: "contains", value: "" }])} className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Include Condition
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-xs font-semibold text-slate-700 uppercase">Exclude Contacts Matching</div>
              {excludeRules.map((rule, idx) => (
                <div key={idx} className="flex flex-wrap gap-2 items-center">
                  <select value={rule.field} onChange={(e) => setExcludeRules((r) => r.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x)))} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
                    {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select value={rule.operator} onChange={(e) => setExcludeRules((r) => r.map((x, i) => (i === idx ? { ...x, operator: e.target.value } : x)))} className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
                    {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <input value={rule.value} onChange={(e) => setExcludeRules((r) => r.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))} placeholder="Value" className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs" />
                  <button onClick={() => setExcludeRules((r) => r.filter((_, i) => i !== idx))} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setExcludeRules((r) => [...r, { field: "tags", operator: "contains", value: "" }])} className="inline-flex items-center gap-1 text-xs text-rose-700 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Exclusion Condition
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-3">
              <button onClick={runLiveEstimate} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium">
                <Calculator className="w-4 h-4" /> Estimate Audience on Backend
              </button>
              <button onClick={handleSaveSegment} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium">
                <Users className="w-4 h-4" /> Save Dynamic Segment
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Backend Audience Estimation</h2>
            {!estimate ? (
              <p className="text-xs text-slate-500">Click &ldquo;Estimate Audience on Backend&rdquo; to compute matched records, consent coverage, opt-outs, and suppressions.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {[
                  ["Total Matched Records", estimate.stats.total_matched],
                  ["Unique Valid Phones", estimate.stats.unique_phones],
                  ["Duplicates Removed", estimate.stats.duplicate_count],
                  ["Invalid Numbers", estimate.stats.invalid_phone_count],
                  ["Missing Consent", estimate.stats.no_consent_count],
                  ["Opted Out", estimate.stats.opted_out_count],
                  ["Suppressed", estimate.stats.suppressed_count],
                  ["Final Eligible Recipients", estimate.stats.eligible_count],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">{k}</span>
                    <span className="font-bold text-slate-900">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Saved Segments Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">Saved Audience Segments ({segments.length})</div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600 uppercase">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Version</th><th className="px-4 py-2">Est. Eligible</th><th className="px-4 py-2">Updated</th><th className="px-4 py-2 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {segments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No saved segments yet.</td></tr>
              ) : segments.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{s.name}</td>
                  <td className="px-4 py-2.5">{s.segment_type}</td>
                  <td className="px-4 py-2.5">v{s.version}</td>
                  <td className="px-4 py-2.5 font-semibold text-emerald-700">{s.estimated_count || 0}</td>
                  <td className="px-4 py-2.5 text-slate-500">{s.updated_at}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link to={`/dashboard/campaigns/create?segment_id=${s.id}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold">
                      Create Campaign <ArrowRight className="w-3 h-3" />
                    </Link>
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
