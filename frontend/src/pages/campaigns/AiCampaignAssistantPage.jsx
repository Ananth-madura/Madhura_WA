import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  MessageSquare,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  FileText,
} from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function AiCampaignAssistantPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [campaignPrompt, setCampaignPrompt] = useState("");
  const [blueprint, setBlueprint] = useState(null);

  const [qaQuestion, setQaQuestion] = useState("");
  const [qaResult, setQaResult] = useState(null);

  const [templateBody, setTemplateBody] = useState("");
  const [templateCategory, setTemplateCategory] = useState("MARKETING");
  const [templateReview, setTemplateReview] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(async () => {
    try {
      const res = await campaignApi.getAiRecommendations();
      setRecommendations(Array.isArray(res?.recommendations) ? res.recommendations : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load recommendations.");
    }
  }, []);

  useEffect(() => { loadRecommendations(); }, [loadRecommendations]);

  const handleProposeCampaign = async (e) => {
    e.preventDefault();
    if (!campaignPrompt.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await campaignApi.proposeAiCampaign(campaignPrompt);
      setBlueprint(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAskPerformance = async (e) => {
    e.preventDefault();
    if (!qaQuestion.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await campaignApi.askAiPerformance({ question: qaQuestion });
      setQaResult(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReviewTemplate = async (e) => {
    e.preventDefault();
    if (!templateBody.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await campaignApi.evaluateAiTemplateQuality({ body: templateBody, category: templateCategory });
      setTemplateReview(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">AI Campaign Assistant</h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                Human-Reviewed Drafts Only
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Generate reviewable campaign blueprints, evaluate template quality against Meta rules, and query live campaign analytics with explicit formulas. AI never creates consent or launches campaigns automatically.
            </p>
          </div>
        </div>
        <button type="button" onClick={loadRecommendations} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Recommendations
        </button>
      </div>

      {error && (
        <div className="hl-card p-3.5 flex items-center gap-2 text-xs font-medium" style={{ background: "#FEE4E2", color: "#B42318" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* Next-Best-Action Recommendations */}
      <div className="hl-card p-4 sm:p-5 space-y-2.5">
        <h2 className="text-base font-bold m-0" style={{ color: "#202C52" }}>Next-Best-Action Recommendations ({recommendations.length})</h2>
        {recommendations.length === 0 ? (
          <p className="text-xs m-0" style={{ color: "#667085" }}>No urgent campaign optimization actions right now. Launch campaigns or inspect Template Health to generate live insights.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendations.map((rec, i) => (
              <div key={i} className="p-3.5 rounded-xl border flex items-start justify-between gap-3" style={{ borderColor: rec.priority === "high" ? "#FECDCA" : "#E4E7ED", background: "#FFFFFF" }}>
                <div className="text-xs space-y-1">
                  <div className="font-bold" style={{ color: "#202C52" }}>{rec.title}</div>
                  <div style={{ color: "#475467" }}>{rec.reason}</div>
                </div>
                <Link to={rec.action_path || "/whatsapp/campaigns"} className="hl-btn-secondary shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold cursor-pointer">
                  Open <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Campaign Blueprint Assistant */}
        <div className="hl-card p-4 sm:p-5 space-y-3">
          <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
            <Users className="w-4 h-4" /> Campaign &amp; Audience Blueprint Generator
          </h2>
          <form onSubmit={handleProposeCampaign} className="space-y-2.5">
            <label htmlFor="ai-goal" className="block text-xs font-semibold" style={{ color: "#202C52" }}>Describe your campaign goal</label>
            <textarea
              id="ai-goal"
              rows={3}
              className="hl-input w-full"
              placeholder="e.g., Launch our new commercial solar package to opted-in commercial leads in India"
              value={campaignPrompt}
              onChange={(e) => setCampaignPrompt(e.target.value)}
            />
            <button type="submit" disabled={busy} className="hl-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer">
              Generate Reviewable Draft Blueprint
            </button>
          </form>

          {blueprint?.proposed_campaign && (
            <div className="p-3.5 rounded-xl border space-y-2 text-xs" style={{ background: "#F8F9FB", borderColor: "#E4E7ED" }}>
              <div className="font-bold text-sm" style={{ color: "#202C52" }}>{blueprint.proposed_campaign.name}</div>
              <div>
                <strong>Type:</strong> {blueprint.proposed_campaign.campaign_type} | <strong>Category:</strong> {blueprint.proposed_campaign.category} | <strong>KPI:</strong> {blueprint.proposed_campaign.suggested_kpi}
              </div>
              <div>
                <strong>Matched Approved Template:</strong> {blueprint.proposed_campaign.suggested_template?.name || "None approved yet"} |{" "}
                <strong>Flowbot:</strong> {blueprint.proposed_campaign.suggested_flowbot?.name || "None active"}
              </div>
              <div className="flex items-center gap-1.5 font-semibold" style={{ color: "#16803C" }}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {blueprint.compliance_note}
              </div>
              <Link to="/whatsapp/campaigns/create" className="hl-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold cursor-pointer">
                Continue in Campaign Composer <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* 2. Live Performance Q&A */}
        <div className="hl-card p-4 sm:p-5 space-y-3">
          <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
            <MessageSquare className="w-4 h-4" /> Performance Analytics Q&amp;A
          </h2>
          <form onSubmit={handleAskPerformance} className="space-y-2.5">
            <label htmlFor="ai-qa" className="block text-xs font-semibold" style={{ color: "#202C52" }}>Ask about live workspace campaign performance</label>
            <input
              id="ai-qa"
              type="text"
              className="hl-input w-full"
              placeholder="e.g., Which campaign had the most replies? Which template has the highest read rate?"
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {["Which campaign had the most replies?", "Which template has the highest read rate?", "Which campaign should we retarget?"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQaQuestion(preset)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer border"
                  style={{ borderColor: "#E4E7ED", color: "#202C52", background: "#FFFFFF" }}
                >
                  {preset}
                </button>
              ))}
            </div>
            <button type="submit" disabled={busy} className="hl-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer">
              Run Live Analytics Query
            </button>
          </form>

          {qaResult && (
            <div className="p-3.5 rounded-xl border space-y-1.5 text-xs" style={{ background: "#F8F9FB", borderColor: "#E4E7ED" }}>
              <div className="font-bold" style={{ color: "#202C52" }}>{qaResult.answer}</div>
              <div style={{ color: "#667085" }}>
                <strong>Formula:</strong> {qaResult.calculation_method} | <strong>Date Range:</strong> {qaResult.date_range?.from} to {qaResult.date_range?.to}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Template Quality Assistant */}
      <div className="hl-card p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
          <FileText className="w-4 h-4" /> Template Quality &amp; Policy Reviewer
        </h2>
        <form onSubmit={handleReviewTemplate} className="space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-3">
              <label htmlFor="ai-tmpl-body" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Draft Template Body</label>
              <textarea
                id="ai-tmpl-body"
                rows={2}
                className="hl-input w-full"
                placeholder="Paste your WhatsApp template body here to inspect variables, clarity, and category compliance..."
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ai-tmpl-cat" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Category</label>
              <select id="ai-tmpl-cat" className="hl-select w-full" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)}>
                <option value="MARKETING">MARKETING</option>
                <option value="UTILITY">UTILITY</option>
                <option value="AUTHENTICATION">AUTHENTICATION</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={busy} className="hl-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer">
            Evaluate Template Draft
          </button>
        </form>

        {templateReview && (
          <div className="p-3.5 rounded-xl border space-y-2 text-xs" style={{ background: "#FFFDF5", borderColor: "#FCBD16" }}>
            {templateReview.risk_warnings?.length > 0 && (
              <div className="p-2.5 rounded font-semibold" style={{ background: "#FEE4E2", color: "#B42318" }}>
                {templateReview.risk_warnings.join(" | ")}
              </div>
            )}
            {templateReview.suggestions?.length > 0 && (
              <ul className="m-0 pl-4 space-y-1" style={{ color: "#202C52" }}>
                {templateReview.suggestions.map((s, idx) => <li key={idx}>{s}</li>)}
              </ul>
            )}
            <div className="p-2.5 rounded border bg-white" style={{ borderColor: "#E4E7ED", color: "#202C52" }}>
              <strong>Improved Draft:</strong> {templateReview.improved_draft}
            </div>
            <div style={{ color: "#667085" }}>{templateReview.meta_approval_disclaimer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
