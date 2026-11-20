import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Rocket,
  CheckCircle2,
  Circle,
  AlertCircle,
  RefreshCw,
  Clock,
  ArrowRight,
  Users,
  Sparkles,
  GitBranch,
  RotateCcw,
  HeartPulse,
  Target,
} from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function GuidedFirstCampaignPage() {
  const [status, setStatus] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [watchForm, setWatchForm] = useState({
    campaign_id: "",
    template_id: "",
    auto_launch_enabled: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [st, camps, tmpls] = await Promise.all([
        campaignApi.getGuidedSetupStatus(),
        campaignApi.listCampaigns({ limit: 50 }).catch(() => []),
        campaignApi.listTemplates().catch(() => []),
      ]);
      setStatus(st || null);
      setCampaigns(Array.isArray(camps?.items) ? camps.items : Array.isArray(camps) ? camps : []);
      setTemplates(Array.isArray(tmpls?.items) ? tmpls.items : Array.isArray(tmpls) ? tmpls : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load guided setup status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRegisterWatch = async (e) => {
    e.preventDefault();
    if (!watchForm.campaign_id || !watchForm.template_id) {
      setError("Select both a saved draft campaign and a pending template to monitor.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await campaignApi.watchPendingTemplateApproval(watchForm);
      setNotice("Pending Meta template approval watch saved. Auto-launch runs only if explicitly enabled and all launch validations pass.");
      setWatchForm({ campaign_id: "", template_id: "", auto_launch_enabled: false });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not save approval watch.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEvaluatePending = async () => {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.evaluatePendingAutoLaunches({});
      setNotice(`Checked ${res.evaluated || 0} pending template approval watch(es).`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not evaluate pending watches.");
    } finally {
      setSubmitting(false);
    }
  };

  const steps = status?.steps || [];
  const dupPhones = status?.duplicate_phone_groups || [];
  const watches = status?.pending_auto_launches || [];

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <Rocket size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">Guided First-Campaign Launch Assistant</h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                {status ? `${status.progress_pct}% Ready` : "Checking..."}
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Step-by-step Meta compliance checklist covering sender connection, duplicate phone detection, opt-in verification, template approval monitoring, and safe launch.
            </p>
          </div>
        </div>
        <div className="hl-actions flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="hl-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
          </button>
          <Link
            to="/whatsapp/campaigns/create"
            className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer"
          >
            Open Campaign Composer <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Quick Navigation Strip to Upgrade Modules */}
      <div className="hl-card p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide px-1" style={{ color: "#667085" }}>Upgrade Tools:</span>
        <Link to="/whatsapp/campaigns/retargeting" className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer">
          <Target className="w-3.5 h-3.5" /> Smart Retargeting
        </Link>
        <Link to="/whatsapp/campaigns/sequences" className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer">
          <GitBranch className="w-3.5 h-3.5" /> Drip Sequences
        </Link>
        <Link to="/whatsapp/campaigns/recovery" className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" /> Failure Recovery
        </Link>
        <Link to="/whatsapp/campaigns/template-health" className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer">
          <HeartPulse className="w-3.5 h-3.5" /> Template Health
        </Link>
        <Link to="/whatsapp/campaigns/ai-assistant" className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer">
          <Sparkles className="w-3.5 h-3.5" /> AI Assistant
        </Link>
      </div>

      {error && (
        <div className="hl-card p-3.5 flex items-center gap-2 text-xs font-medium" style={{ background: "#FEE4E2", color: "#B42318", borderColor: "#FECDCA" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="hl-card p-3.5 flex items-center gap-2 text-xs font-medium" style={{ background: "#D1FADF", color: "#16803C", borderColor: "#A6F4C5" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> <span>{notice}</span>
        </div>
      )}

      {/* Progress KPIs */}
      <div className="hl-kpis">
        <div className="hl-kpi">
          <div className="text-xs font-semibold" style={{ color: "#667085" }}>Setup Completion</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "#202C52" }}>
            {status ? `${status.completed_steps} / ${status.total_steps}` : "0 / 5"}
          </div>
          <div className="w-full h-2 rounded-full mt-2 overflow-hidden" style={{ background: "#E4E7ED" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${status?.progress_pct || 0}%`, background: "#FCBD16" }} />
          </div>
        </div>
        <div className="hl-kpi">
          <div className="text-xs font-semibold" style={{ color: "#667085" }}>Duplicate Phone Groups</div>
          <div className="text-2xl font-bold mt-1" style={{ color: dupPhones.length > 0 ? "#B42318" : "#16803C" }}>
            {dupPhones.length}
          </div>
          <div className="text-xs mt-1" style={{ color: "#667085" }}>Detected across CRM contacts</div>
        </div>
        <div className="hl-kpi">
          <div className="text-xs font-semibold" style={{ color: "#667085" }}>Pending Approval Watches</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "#202C52" }}>{watches.length}</div>
          <div className="text-xs mt-1" style={{ color: "#667085" }}>Monitored for Meta template review</div>
        </div>
      </div>

      {/* Checklist Steps */}
      <div className="hl-card p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold m-0" style={{ color: "#202C52" }}>First-Campaign Readiness Checklist</h2>
        {loading ? (
          <p className="text-xs" style={{ color: "#667085" }}>Inspecting workspace readiness...</p>
        ) : (
          <div className="space-y-2.5">
            {steps.map((step, idx) => (
              <div
                key={step.key}
                className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border"
                style={{
                  borderColor: step.completed ? "#A6F4C5" : "#E4E7ED",
                  background: step.completed ? "#F6FEF9" : "#FFFFFF",
                }}
              >
                <div className="flex items-start gap-3">
                  {step.completed ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#16803C" }} />
                  ) : (
                    <Circle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#667085" }} />
                  )}
                  <div>
                    <div className="text-sm font-bold" style={{ color: "#202C52" }}>
                      {idx + 1}. {step.title}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "#475467" }}>{step.detail}</div>
                  </div>
                </div>
                <Link
                  to={step.action_path}
                  className={step.completed ? "hl-btn-secondary px-3 py-1.5 text-xs font-semibold cursor-pointer" : "hl-btn-primary px-3 py-1.5 text-xs font-semibold cursor-pointer"}
                >
                  {step.completed ? "Review" : "Complete Step"}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Duplicate Phone Audit & Pending Meta Approval Watch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="hl-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
              <Clock className="w-4 h-4" /> Pending Meta Template Approval Watch
            </h2>
            <button
              type="button"
              disabled={submitting}
              onClick={handleEvaluatePending}
              className="hl-btn-secondary px-3 py-1.5 text-xs font-semibold cursor-pointer"
            >
              Evaluate Watches Now
            </button>
          </div>
          <p className="text-xs m-0" style={{ color: "#475467" }}>
            Keep a draft campaign saved while Meta reviews its template. Auto-launch executes only when explicitly checked and all consent, sender, and limit checks pass.
          </p>

          <form onSubmit={handleRegisterWatch} className="space-y-3 pt-1">
            <div>
              <label htmlFor="watch-campaign" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>
                Saved Campaign
              </label>
              <select
                id="watch-campaign"
                className="hl-select w-full"
                value={watchForm.campaign_id}
                onChange={(e) => setWatchForm({ ...watchForm, campaign_id: e.target.value })}
              >
                <option value="">Select campaign...</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="watch-template" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>
                Pending Meta Template
              </label>
              <select
                id="watch-template"
                className="hl-select w-full"
                value={watchForm.template_id}
                onChange={(e) => setWatchForm({ ...watchForm, template_id: e.target.value })}
              >
                <option value="">Select template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.meta_status || "DRAFT"})</option>
                ))}
              </select>
            </div>

            <label htmlFor="watch-autolaunch" className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: "#202C52" }}>
              <input
                id="watch-autolaunch"
                type="checkbox"
                checked={watchForm.auto_launch_enabled}
                onChange={(e) => setWatchForm({ ...watchForm, auto_launch_enabled: e.target.checked })}
                className="mt-0.5 cursor-pointer"
              />
              <span>Explicitly enable automatic launch once Meta approves this template and all launch-time checks pass.</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="hl-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              {submitting ? "Saving..." : "Save Template Approval Watch"}
            </button>
          </form>

          {watches.length > 0 && (
            <div className="pt-2 space-y-2">
              {watches.map((w) => (
                <div key={w.id} className="p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "#E4E7ED" }}>
                  <div>
                    <div className="font-bold" style={{ color: "#202C52" }}>{w.campaign_name || `Campaign #${w.campaign_id}`}</div>
                    <div style={{ color: "#667085" }}>
                      Template: {w.template_name || `#${w.template_id}`} ({w.template_status || "PENDING"}) | Auto-launch: {w.auto_launch_enabled ? "Enabled" : "Manual"}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#FFF4CC", color: "#202C52" }}>
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hl-card p-4 sm:p-5 space-y-3">
          <h2 className="text-base font-bold m-0 flex items-center gap-2" style={{ color: "#202C52" }}>
            <Users className="w-4 h-4" /> Duplicate Phone Detection Audit
          </h2>
          <p className="text-xs m-0" style={{ color: "#475467" }}>
            Madhura deduplicates phones before campaign dispatch. Review repeated numbers in CRM contacts below.
          </p>
          {dupPhones.length === 0 ? (
            <div className="p-4 rounded-xl text-xs font-medium" style={{ background: "#F6FEF9", color: "#16803C", border: "1px solid #A6F4C5" }}>
              No duplicate phone numbers detected in your CRM contacts table.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "#E4E7ED", color: "#667085" }}>
                    <th className="py-2 pr-3 font-semibold">Phone Number</th>
                    <th className="py-2 font-semibold">Duplicate Records</th>
                  </tr>
                </thead>
                <tbody>
                  {dupPhones.map((d) => (
                    <tr key={d.phone} className="border-b" style={{ borderColor: "#F2F4F7" }}>
                      <td className="py-2 pr-3 font-mono" style={{ color: "#202C52" }}>{d.phone}</td>
                      <td className="py-2 font-bold" style={{ color: "#B42318" }}>{d.cnt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
