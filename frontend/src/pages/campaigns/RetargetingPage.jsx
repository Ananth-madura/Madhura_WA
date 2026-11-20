import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Target,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Play,
  Users,
  ShieldCheck,
  Plus,
} from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

const SEGMENT_LABELS = {
  delivered_not_read: "Delivered but not read",
  read_not_replied: "Read but did not reply",
  replied: "Replied to campaign",
  cta_clicked: "Clicked tracked CTA link",
  flow_submitted: "Submitted WhatsApp Flow",
  flow_not_completed: "Opened campaign without Flow completion",
  converted: "Verified conversions",
  not_converted: "Delivered without conversion",
  failed_delivery: "Failed delivery",
  unresolved_delivery: "Unresolved submission (reconciliation)",
  opted_out: "Opted out (audit only)",
};

export default function RetargetingPage() {
  const [searchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [overview, setOverview] = useState({ rules: [], runs: [], supported_segments: Object.keys(SEGMENT_LABELS) });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    source_campaign_id: searchParams.get("campaign_id") || "",
    engagement_segment: "read_not_replied",
    campaign_name: "",
    template_id: "",
    category: "MARKETING",
  });

  const [ruleForm, setRuleForm] = useState({
    name: "",
    source_campaign_id: searchParams.get("campaign_id") || "",
    engagement_segment: "read_not_replied",
    delay_hours: 48,
    target_template_id: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ov, camps, tmpls] = await Promise.all([
        campaignApi.getRetargetingOverview(),
        campaignApi.listCampaigns({ limit: 100 }).catch(() => []),
        campaignApi.listTemplates().catch(() => []),
      ]);
      setOverview(ov || { rules: [], runs: [], supported_segments: Object.keys(SEGMENT_LABELS) });
      setCampaigns(Array.isArray(camps?.items) ? camps.items : Array.isArray(camps) ? camps : []);
      setTemplates(Array.isArray(tmpls?.items) ? tmpls.items : Array.isArray(tmpls) ? tmpls : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load retargeting data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePreview = async (e) => {
    e.preventDefault();
    if (!form.source_campaign_id) {
      setError("Select a source campaign first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.previewRetargetingAudience({
        source_campaign_id: Number(form.source_campaign_id),
        engagement_segment: form.engagement_segment,
        category: form.category,
      });
      setPreview(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not preview retargeting audience.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRetargetCampaign = async () => {
    if (!form.source_campaign_id) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.createRetargetingCampaign({
        source_campaign_id: Number(form.source_campaign_id),
        engagement_segment: form.engagement_segment,
        campaign_name: form.campaign_name || undefined,
        template_id: form.template_id ? Number(form.template_id) : undefined,
        category: form.category,
      });
      setNotice(`Created retargeting draft campaign "${res.campaign?.name}" with ${res.stats?.eligible_count || 0} verified eligible contacts.`);
      setPreview(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not create retargeting campaign.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.name || !ruleForm.source_campaign_id) {
      setError("Provide a rule name and source campaign.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await campaignApi.createRetargetingRule({
        ...ruleForm,
        source_campaign_id: Number(ruleForm.source_campaign_id),
        delay_hours: Number(ruleForm.delay_hours || 48),
        target_template_id: ruleForm.target_template_id ? Number(ruleForm.target_template_id) : null,
      });
      setNotice("Saved automated behavioral retargeting rule.");
      setRuleForm({ ...ruleForm, name: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not save retargeting rule.");
    } finally {
      setBusy(false);
    }
  };

  const approvedTemplates = templates.filter((t) => String(t.meta_status || "").toUpperCase() === "APPROVED");

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <Target size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">Smart Behavioral Retargeting Engine</h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                11 Real Engagement Segments
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Build follow-up audiences from verified Meta delivery, read, tracked CTA click, reply, and Flow completion events with live consent, DNC, frequency cap, and anti-repeat enforcement.
            </p>
          </div>
        </div>
        <div className="hl-actions flex items-center gap-2">
          <button type="button" onClick={load} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Link to="/whatsapp/campaigns/get-started" className="hl-btn-secondary px-3.5 py-2 text-xs font-semibold cursor-pointer">
            Launch Assistant
          </Link>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Interactive Retargeting Builder */}
        <div className="hl-card p-4 sm:p-5 space-y-3">
          <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
            <Users className="w-4 h-4" /> Build Retargeting Audience &amp; Follow-Up Draft
          </h2>
          <form onSubmit={handlePreview} className="space-y-3">
            <div>
              <label htmlFor="rt-campaign" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Source Campaign</label>
              <select
                id="rt-campaign"
                className="hl-select w-full"
                value={form.source_campaign_id}
                onChange={(e) => setForm({ ...form, source_campaign_id: e.target.value })}
              >
                <option value="">Choose a completed or active campaign...</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="rt-segment" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Engagement Segment</label>
                <select
                  id="rt-segment"
                  className="hl-select w-full"
                  value={form.engagement_segment}
                  onChange={(e) => setForm({ ...form, engagement_segment: e.target.value })}
                >
                  {Object.entries(SEGMENT_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rt-category" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Follow-Up Category</label>
                <select
                  id="rt-category"
                  className="hl-select w-full"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="MARKETING">MARKETING</option>
                  <option value="UTILITY">UTILITY</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="rt-name" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Follow-Up Campaign Name (optional)</label>
                <input
                  id="rt-name"
                  type="text"
                  className="hl-input w-full"
                  placeholder="e.g., 48h Follow-Up Offer"
                  value={form.campaign_name}
                  onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="rt-template" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Approved Follow-Up Template</label>
                <select
                  id="rt-template"
                  className="hl-select w-full"
                  value={form.template_id}
                  onChange={(e) => setForm({ ...form, template_id: e.target.value })}
                >
                  <option value="">Attach template later</option>
                  {approvedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="submit" disabled={busy} className="hl-btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer">
                {busy ? "Evaluating..." : "Preview Eligible Audience"}
              </button>
              <button
                type="button"
                disabled={busy || !preview || preview.eligible_count === 0}
                onClick={handleCreateRetargetCampaign}
                className="hl-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> Create Follow-Up Draft ({preview?.eligible_count || 0})
              </button>
            </div>
          </form>

          {preview && (
            <div className="p-3.5 rounded-xl border space-y-2" style={{ background: "#F8F9FB", borderColor: "#E4E7ED" }}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold" style={{ color: "#202C52" }}>
                  Matched: {preview.matched_count} | Eligible: {preview.eligible_count} | Excluded: {preview.excluded_count} | Anti-Repeat Blocked: {preview.repeat_blocked_count}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "#16803C" }}>
                  <ShieldCheck className="w-3.5 h-3.5" /> Consent &amp; DNC Reverified
                </span>
              </div>
              {preview.read_receipt_observability !== "confirmed" && form.engagement_segment === "delivered_not_read" && (
                <div className="text-xs p-2 rounded" style={{ background: "#FFF4CC", color: "#202C52" }}>
                  Note: No read receipts were observed on this campaign yet, so unread status is marked as unknown rather than confirmed unread.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Automated Retargeting Rules */}
        <div className="hl-card p-4 sm:p-5 space-y-3">
          <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
            <Plus className="w-4 h-4" /> Save Reusable Retargeting Rule
          </h2>
          <form onSubmit={handleCreateRule} className="space-y-3">
            <div>
              <label htmlFor="rule-name" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Rule Name</label>
              <input
                id="rule-name"
                type="text"
                className="hl-input w-full"
                placeholder="e.g., 48h Read-No-Reply Nudge"
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="rule-camp" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Source Campaign</label>
                <select
                  id="rule-camp"
                  className="hl-select w-full"
                  value={ruleForm.source_campaign_id}
                  onChange={(e) => setRuleForm({ ...ruleForm, source_campaign_id: e.target.value })}
                >
                  <option value="">Select campaign...</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="rule-delay" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Delay (Hours)</label>
                <input
                  id="rule-delay"
                  type="number"
                  min={1}
                  className="hl-input w-full"
                  value={ruleForm.delay_hours}
                  onChange={(e) => setRuleForm({ ...ruleForm, delay_hours: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="rule-seg" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Trigger Segment</label>
                <select
                  id="rule-seg"
                  className="hl-select w-full"
                  value={ruleForm.engagement_segment}
                  onChange={(e) => setRuleForm({ ...ruleForm, engagement_segment: e.target.value })}
                >
                  {Object.entries(SEGMENT_LABELS).filter(([k]) => k !== "opted_out").map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rule-tmpl" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Follow-Up Template</label>
                <select
                  id="rule-tmpl"
                  className="hl-select w-full"
                  value={ruleForm.target_template_id}
                  onChange={(e) => setRuleForm({ ...ruleForm, target_template_id: e.target.value })}
                >
                  <option value="">Select approved template...</option>
                  {approvedTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={busy} className="hl-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer">
              Save Retargeting Rule
            </button>
          </form>
        </div>
      </div>

      {/* History & Saved Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="hl-card p-4 sm:p-5 space-y-2.5">
          <h2 className="text-sm font-bold m-0" style={{ color: "#202C52" }}>Saved Retargeting Rules ({overview.rules?.length || 0})</h2>
          {loading ? (
            <p className="text-xs" style={{ color: "#667085" }}>Loading rules...</p>
          ) : (overview.rules || []).length === 0 ? (
            <p className="text-xs" style={{ color: "#667085" }}>No automated retargeting rules saved yet.</p>
          ) : (
            <div className="space-y-2">
              {overview.rules.map((r) => (
                <div key={r.id} className="p-3 rounded-lg border text-xs flex items-center justify-between gap-2" style={{ borderColor: "#E4E7ED" }}>
                  <div>
                    <div className="font-bold" style={{ color: "#202C52" }}>{r.name}</div>
                    <div style={{ color: "#667085" }}>
                      {r.source_campaign_name || `Campaign #${r.source_campaign_id}`} | {SEGMENT_LABELS[r.engagement_segment] || r.engagement_segment} | +{r.delay_hours}h
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#D1FADF", color: "#16803C" }}>ACTIVE</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hl-card p-4 sm:p-5 space-y-2.5">
          <h2 className="text-sm font-bold m-0" style={{ color: "#202C52" }}>Recent Retargeting Runs ({overview.runs?.length || 0})</h2>
          {(overview.runs || []).length === 0 ? (
            <p className="text-xs" style={{ color: "#667085" }}>No retargeting campaigns generated yet.</p>
          ) : (
            <div className="space-y-2">
              {overview.runs.map((run) => (
                <div key={run.id} className="p-3 rounded-lg border text-xs flex items-center justify-between gap-2" style={{ borderColor: "#E4E7ED" }}>
                  <div>
                    <div className="font-bold" style={{ color: "#202C52" }}>
                      {run.target_campaign_name || `Draft Campaign #${run.created_campaign_id}`}
                    </div>
                    <div style={{ color: "#667085" }}>
                      From {run.source_campaign_name || `#${run.source_campaign_id}`} ({run.engagement_segment}) | Eligible: {run.eligible_count} | Repeat Blocked: {run.repeat_blocked_count}
                    </div>
                  </div>
                  {run.created_campaign_id && (
                    <Link to={`/whatsapp/campaigns/${run.created_campaign_id}`} className="hl-btn-secondary px-2.5 py-1 text-xs font-semibold cursor-pointer">
                      Open Draft
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
