import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  Send,
  Calendar,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Smartphone,
} from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi, formatMinorCurrency } from "../../api/campaigns";

const STEPS = [
  "1. Campaign info",
  "2. Audience",
  "3. Sender & route",
  "4. Template",
  "5. Personalization",
  "6. Flow & automation",
  "7. Schedule & limits",
  "8. Validate & cost",
  "9. Review & launch",
];

const CAMPAIGN_TYPES = [
  "broadcast", "promotional", "product_launch", "seasonal", "customer_retention",
  "lead_nurturing", "customer_lifecycle", "abandoned_cart", "order_updates",
  "payment_reminders", "event_campaign", "appointment_reminders", "win_back",
  "recurring", "triggered", "ab_testing", "journey_based", "flow_based", "chatbot_campaign",
];

const OBJECTIVES = [
  "lead_generation", "product_promotion", "customer_engagement", "customer_retention",
  "product_announcement", "revenue_generation", "event_registration",
  "order_communication", "customer_reactivation", "other",
];

const PERSONALIZATION_FIELDS = [
  { value: "first_name", label: "Contact first name", sample: "Ananya" },
  { value: "full_name", label: "Contact full name", sample: "Ananya Iyer" },
  { value: "email", label: "Email address", sample: "ananya@example.com" },
  { value: "custom_fields.city", label: "City (custom field)", sample: "Chennai" },
  { value: "custom_fields.company", label: "Company name", sample: "Madhura Enterprises" },
  { value: "custom_fields.product_name", label: "Product name", sample: "5kW Solar Kit" },
  { value: "custom_fields.order_id", label: "Order ID", sample: "ORD-2026-412" },
  { value: "", label: "Static value only", sample: "" },
];

export default function CampaignComposerPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState(id ? Number(id) : null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");

  // Native assets pulled from existing Madhura modules (/whatsapp/groups, /whatsapp/templates, /whatsapp/flows, /whatsapp/automations, /whatsapp/accounts)
  const [groups, setGroups] = useState([]);
  const [segments, setSegments] = useState([]);
  const [senders, setSenders] = useState([]);
  const [sharedLimit, setSharedLimit] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [whatsappFlows, setWhatsappFlows] = useState([]);
  const [flowbots, setFlowbots] = useState([]);
  const [automations, setAutomations] = useState([]);

  const [validation, setValidation] = useState(null);
  const [testPhone, setTestPhone] = useState("");
  const [testOutcome, setTestOutcome] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    objective: "product_promotion",
    campaign_type: "broadcast",
    category: "MARKETING",
    priority: 5,
    reporting_timezone: "Asia/Kolkata",
    audience_mode: "group", // group | segment
    group_id: "",
    segment_id: "",
    sender_id: "",
    waba_id: "",
    sender_mode: "single",
    template_id: "",
    template_name: "",
    template_language: "en",
    whatsapp_flow_id: "",
    flowbot_id: "",
    automation_id: "",
    scheduled_at: "",
    max_recipients: "",
    budget_limit_minor: "",
    prefer_marketing_api: true,
    allow_cloud_fallback: true,
    missing_variable_policy: "exclude",
    header_media_url: "",
    variable_mapping: {},
    sending: { mode: "immediate", batch_size: 200, rate_limit_per_sec: 20 },
  });

  const queryString = searchParams.toString();

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const assets = await campaignApi.getNativeAssets().catch(() => null);
      const safeGroups = Array.isArray(assets?.groups) ? assets.groups : [];
      const safeSegments = Array.isArray(assets?.segments) ? assets.segments : [];
      const safeSenders = Array.isArray(assets?.senders) ? assets.senders : [];
      const safeTemplates = Array.isArray(assets?.templates) ? assets.templates : [];
      const safeFlows = Array.isArray(assets?.whatsapp_flows) ? assets.whatsapp_flows : [];
      const safeBots = Array.isArray(assets?.flowbots) ? assets.flowbots : [];
      const safeAutos = Array.isArray(assets?.automations) ? assets.automations : [];

      setGroups(safeGroups);
      setSegments(safeSegments);
      setSenders(safeSenders);
      setSharedLimit(assets?.shared_messaging_limit || null);
      setTemplates(safeTemplates);
      setWhatsappFlows(safeFlows);
      setFlowbots(safeBots);
      setAutomations(safeAutos);

      if (!id) {
        const sp = new URLSearchParams(queryString);
        const qGroup = sp.get("group_id");
        const qSeg = sp.get("segment_id");
        const qTmpl = sp.get("template_id");
        const qFlow = sp.get("flow_id");
        const qBot = sp.get("flowbot_id");
        const qAuto = sp.get("automation_id");
        const qType = sp.get("type");
        const qWs = sp.get("workspace_id");
        const matchedTmpl = qTmpl ? safeTemplates.find((t) => String(t.id) === String(qTmpl)) : null;
        const defaultSender = safeSenders[0];

        setForm((prev) => ({
          ...prev,
          audience_mode: qSeg ? "segment" : qGroup ? "group" : safeGroups.length ? "group" : "segment",
          ...(qGroup ? { group_id: qGroup, segment_id: "" } : {}),
          ...(qSeg ? { segment_id: qSeg, group_id: "" } : {}),
          ...(qTmpl
            ? {
                template_id: qTmpl,
                template_name: matchedTmpl?.name || prev.template_name,
                template_language: matchedTmpl?.language || prev.template_language,
                category: matchedTmpl?.category || prev.category,
              }
            : {}),
          ...(qFlow ? { whatsapp_flow_id: qFlow } : {}),
          ...(qBot ? { flowbot_id: qBot } : {}),
          ...(qAuto ? { automation_id: qAuto } : {}),
          ...(qType ? { campaign_type: qType } : {}),
          ...(qWs ? { workspace_id: Number(qWs) } : {}),
          ...(!prev.sender_id && defaultSender ? { sender_id: defaultSender.id, waba_id: defaultSender.waba_id } : {}),
        }));
      }
    } finally {
      setAssetsLoading(false);
    }
  }, [id, queryString]);

  useEffect(() => {
    loadAssets();
    if (id) {
      campaignApi.getCampaign(id)
        .then((c) => {
          if (!c || typeof c !== "object") return;
          setCampaignId(c.id);
          const cfgGroupId = c.config?.group_id ? String(c.config.group_id) : "";
          setForm((prev) => ({
            ...prev,
            ...c,
            audience_mode: c.segment_id ? "segment" : cfgGroupId ? "group" : prev.audience_mode,
            group_id: cfgGroupId,
            segment_id: c.segment_id ? String(c.segment_id) : "",
            sender_id: c.sender_id ? String(c.sender_id) : "",
            template_id: c.template_id ? String(c.template_id) : "",
            whatsapp_flow_id: c.whatsapp_flow_id ? String(c.whatsapp_flow_id) : "",
            flowbot_id: c.flowbot_id ? String(c.flowbot_id) : "",
            automation_id: c.config?.automation_id ? String(c.config.automation_id) : "",
            max_recipients: c.max_recipients || "",
            budget_limit_minor: c.budget_limit_minor || "",
            variable_mapping: c.config?.variable_mapping || {},
            prefer_marketing_api: c.config?.prefer_marketing_api !== false,
            allow_cloud_fallback: c.config?.allow_cloud_fallback !== false,
            missing_variable_policy: c.config?.missing_variable_policy || "exclude",
            header_media_url: c.config?.header_media_url || "",
            sending: c.config?.sending || prev.sending,
          }));
        })
        .catch((err) => setError(err.response?.data?.error || err.message));
    }
  }, [id, loadAssets]);

  const approvedTemplates = useMemo(
    () => templates.filter((t) => String(t.meta_status || "").toUpperCase() === "APPROVED"),
    [templates]
  );
  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t.id) === String(form.template_id)) || null,
    [templates, form.template_id]
  );
  const templateVars = Array.isArray(selectedTemplate?.variables) ? selectedTemplate.variables : [];
  const sendingConfig = form.sending || { mode: "immediate", batch_size: 200, rate_limit_per_sec: 20 };

  // Live personalized preview text for the WhatsApp phone preview
  const livePreviewBody = useMemo(() => {
    if (!selectedTemplate?.body) return "Select an approved template in Step 4 to preview the rendered WhatsApp message.";
    let text = String(selectedTemplate.body);
    for (const vIdx of templateVars) {
      const key = String(vIdx);
      const rule = form.variable_mapping?.[key] || { field: "first_name", fallback: "" };
      const fieldMeta = PERSONALIZATION_FIELDS.find((f) => f.value === rule.field);
      const val = rule.fallback || fieldMeta?.sample || `[Variable ${key}]`;
      text = text.replaceAll(`{{${key}}}`, val);
    }
    return text;
  }, [selectedTemplate, templateVars, form.variable_mapping]);

  const saveDraft = async () => {
    if (!form.name.trim()) {
      setError("Enter a campaign name in Step 1 before saving.");
      return null;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        group_id: form.audience_mode === "group" && form.group_id ? Number(form.group_id) : null,
        segment_id: form.audience_mode === "segment" && form.segment_id ? Number(form.segment_id) : null,
        sender_id: form.sender_id ? Number(form.sender_id) : null,
        template_id: form.template_id ? Number(form.template_id) : null,
        whatsapp_flow_id: form.whatsapp_flow_id ? Number(form.whatsapp_flow_id) : null,
        flowbot_id: form.flowbot_id ? Number(form.flowbot_id) : null,
        automation_id: form.automation_id ? Number(form.automation_id) : null,
        max_recipients: form.max_recipients ? Number(form.max_recipients) : null,
        budget_limit_minor: form.budget_limit_minor ? Number(form.budget_limit_minor) : null,
      };
      const saved = campaignId
        ? await campaignApi.updateCampaign(campaignId, payload)
        : await campaignApi.createCampaign(payload);
      setCampaignId(saved.id);
      setStatusMsg(`Saved draft #${saved.id} (v${saved.current_version})`);
      return saved;
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not save campaign draft.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const goStep = async (nextIdx) => {
    if (nextIdx > step) {
      const saved = await saveDraft();
      if (!saved) return;
      if (nextIdx === 7) {
        try {
          const val = await campaignApi.validateCampaign(saved.id);
          setValidation(val);
        } catch (err) {
          setError(err.response?.data?.error || err.message);
        }
      }
    }
    setStep(nextIdx);
  };

  const handleTestSend = async () => {
    if (!campaignId || !testPhone.trim()) {
      setError("Save the draft and enter an opted-in test phone number first.");
      return;
    }
    setError("");
    try {
      const res = await campaignApi.testSendCampaign(campaignId, { testPhone: testPhone.trim() });
      setTestOutcome(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleLaunchAction = async (mode) => {
    const saved = await saveDraft();
    if (!saved) return;
    setSaving(true);
    setError("");
    try {
      if (mode === "approval") {
        await campaignApi.submitApproval(saved.id);
      } else if (mode === "schedule") {
        await campaignApi.scheduleCampaign(saved.id, {
          run_at_utc: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : new Date(Date.now() + 300000).toISOString(),
          timezone: form.reporting_timezone,
        });
      } else if (mode === "launch") {
        await campaignApi.launchCampaign(saved.id, { sync_dispatch: false });
      }
      navigate(`/whatsapp/campaigns/${saved.id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeAudienceLabel =
    form.audience_mode === "group"
      ? groups.find((g) => String(g.id) === String(form.group_id))?.name || "No group selected"
      : segments.find((s) => String(s.id) === String(form.segment_id))?.name || "No segment selected";

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      {/* Native /whatsapp Command Bar */}
      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <Send size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">
                {campaignId ? `Edit Campaign #${campaignId}` : "Create WhatsApp Campaign"}
              </h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Connected directly to your Groups, Templates, Chatbot Flowbots, Automations, and authorized Meta senders.
            </p>
          </div>
        </div>
        <div className="hl-actions flex flex-wrap items-center gap-2">
          {statusMsg && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "#D1FADF", color: "#16803C", border: "1px solid #A6F4C5" }}>
              {statusMsg}
            </span>
          )}
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving}
            className="hl-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
            <span>Save draft</span>
          </button>
        </div>
      </div>

      {/* Step Navigation */}
      <nav aria-label="Campaign composer steps" className="hl-card p-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {STEPS.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => goStep(idx)}
              aria-current={idx === step ? "step" : undefined}
              className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              style={
                idx === step
                  ? { background: "#202C52", color: "#FFFFFF" }
                  : idx < step
                  ? { background: "#FFF4CC", color: "#202C52" }
                  : { background: "transparent", color: "#667085" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Connected Pipeline Summary Bar */}
      <div className="hl-card px-4 py-2.5 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold uppercase text-[11px]" style={{ color: "#202C52" }}>Linked assets:</span>
        <button type="button" onClick={() => setStep(1)} className="px-2.5 py-1 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
          Audience: {activeAudienceLabel}
        </button>
        <button type="button" onClick={() => setStep(2)} className="px-2.5 py-1 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
          Sender: {senders.find((s) => String(s.id) === String(form.sender_id))?.display_phone || "Not selected"}
        </button>
        <button type="button" onClick={() => setStep(3)} className="px-2.5 py-1 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
          Template: {selectedTemplate?.name || "Not selected"}
        </button>
        <button type="button" onClick={() => setStep(5)} className="px-2.5 py-1 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
          Flowbot: {flowbots.find((b) => String(b.id) === String(form.flowbot_id))?.name || "None"}
        </button>
        <button type="button" onClick={() => setStep(5)} className="px-2.5 py-1 rounded-lg font-semibold cursor-pointer" style={{ background: "#F1F3F7", color: "#202C52" }}>
          Automation: {automations.find((a) => String(a.id) === String(form.automation_id))?.name || "None"}
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg text-sm flex items-center gap-2 font-medium" style={{ background: "#FEE4E2", border: "1px solid #FDA29B", color: "#B42318" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Step Card */}
      <section className="hl-card p-6 space-y-5">
          {assetsLoading && (
            <div className="text-xs text-slate-700 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Loading your groups, templates, senders, flowbots, and automations...</span>
            </div>
          )}

          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="camp-name" className="block text-xs font-semibold text-slate-800 mb-1">Campaign name *</label>
                <input
                  id="camp-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter campaign name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="camp-desc" className="block text-xs font-semibold text-slate-800 mb-1">Description</label>
                <textarea
                  id="camp-desc"
                  rows={2}
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional internal campaign summary"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label htmlFor="camp-type" className="block text-xs font-semibold text-slate-800 mb-1">Campaign type</label>
                <select id="camp-type" value={form.campaign_type} onChange={(e) => setForm({ ...form, campaign_type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer">
                  {CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="camp-obj" className="block text-xs font-semibold text-slate-800 mb-1">Objective</label>
                <select id="camp-obj" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer">
                  {OBJECTIVES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="camp-cat" className="block text-xs font-semibold text-slate-800 mb-1">Meta message category</label>
                <select id="camp-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer">
                  <option value="MARKETING">MARKETING (offers, launches, promotions)</option>
                  <option value="UTILITY">UTILITY (verified order or account updates only)</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </div>
              <div>
                <label htmlFor="camp-tz" className="block text-xs font-semibold text-slate-800 mb-1">Reporting timezone</label>
                <input id="camp-tz" value={form.reporting_timezone} onChange={(e) => setForm({ ...form, reporting_timezone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Choose audience source</h2>
                  <p className="text-xs text-slate-700">Target a Contact Group from /whatsapp/groups or a dynamic CRM Segment.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link to="/whatsapp/groups" className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 font-semibold hover:bg-emerald-50">
                    Manage groups &amp; segments
                  </Link>
                  <Link to="/whatsapp/campaigns/consent" className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 font-semibold hover:bg-slate-200">
                    Consent &amp; DNC
                  </Link>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, audience_mode: "group", segment_id: "" })}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                    form.audience_mode === "group"
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-white text-slate-800 border-slate-300"
                  }`}
                >
                  Contact group ({groups.length})
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, audience_mode: "segment", group_id: "" })}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                    form.audience_mode === "segment"
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-white text-slate-800 border-slate-300"
                  }`}
                >
                  Dynamic CRM segment ({segments.length})
                </button>
              </div>

              {form.audience_mode === "group" ? (
                <div>
                  <label htmlFor="camp-group" className="block text-xs font-semibold text-slate-800 mb-1">Contact group</label>
                  <select
                    id="camp-group"
                    value={form.group_id}
                    onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer"
                  >
                    <option value="">Select a contact group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.contact_count || 0} contacts)</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="camp-segment" className="block text-xs font-semibold text-slate-800 mb-1">Dynamic segment</label>
                  <select
                    id="camp-segment"
                    value={form.segment_id}
                    onChange={(e) => setForm({ ...form, segment_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer"
                  >
                    <option value="">Select a saved segment</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} (est. {s.estimated_count || 0} eligible)</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor="camp-max-rec" className="block text-xs font-semibold text-slate-800 mb-1">Max eligible recipients (optional)</label>
                  <input id="camp-max-rec" type="number" value={form.max_recipients} onChange={(e) => setForm({ ...form, max_recipients: e.target.value })} placeholder="No cap" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label htmlFor="camp-budget" className="block text-xs font-semibold text-slate-800 mb-1">Budget limit in minor units (paise/cents)</label>
                  <input id="camp-budget" type="number" value={form.budget_limit_minor} onChange={(e) => setForm({ ...form, budget_limit_minor: e.target.value })} placeholder="Example: 50000 for 500.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Authorized WhatsApp sender &amp; Meta API route</h2>
                  <p className="text-xs text-slate-700">24-hour recipient limits are shared across all phone numbers under the same Meta business.</p>
                </div>
                {sharedLimit && (
                  <div className="text-xs bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg text-slate-900">
                    Shared 24h limit: <strong>{sharedLimit.used_daily_recipients}</strong> / {sharedLimit.max_daily_recipients} ({sharedLimit.tier})
                  </div>
                )}
              </div>

              {senders.length === 0 ? (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-sm flex flex-wrap items-center justify-between gap-3">
                  <span>No connected Meta WhatsApp senders found for this organization.</span>
                  <Link to="/whatsapp/accounts" className="px-3.5 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold">
                    Open WABA &amp; Senders
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {senders.map((s) => {
                    const selected = String(form.sender_id) === String(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setForm({ ...form, sender_id: String(s.id), waba_id: s.waba_id || "" })}
                        className={`text-left p-4 rounded-xl border cursor-pointer transition-colors ${
                          selected ? "border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700" : "border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-bold text-slate-900">{s.verified_name || s.display_phone}</div>
                        <div className="text-xs text-slate-700 mt-0.5 font-mono">{s.display_phone} (WABA {s.waba_id})</div>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-300">Status: {s.status}</span>
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-300">Quality: {s.quality || "Unknown"}</span>
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-300">Marketing API: {s.marketing_messages_onboarding_status || "UNKNOWN"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-6 pt-2 text-xs text-slate-800">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.prefer_marketing_api} onChange={(e) => setForm({ ...form, prefer_marketing_api: e.target.checked })} />
                  <span>Route MARKETING templates through Meta Marketing Messages API when onboarded</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.allow_cloud_fallback} onChange={(e) => setForm({ ...form, allow_cloud_fallback: e.target.checked })} />
                  <span>Allow auditable fallback to standard Cloud API if WABA is not onboarded</span>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Select template from /whatsapp/templates</h2>
                  <p className="text-xs text-slate-700">Showing Meta-approved templates synchronized to your organization.</p>
                </div>
                <Link to="/whatsapp/templates" className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 text-xs font-semibold hover:bg-emerald-50">
                  Open Templates library
                </Link>
              </div>
              <div>
                <label htmlFor="camp-template" className="block text-xs font-semibold text-slate-800 mb-1">Approved WhatsApp template</label>
                <select
                  id="camp-template"
                  value={form.template_id}
                  onChange={(e) => {
                    const chosen = templates.find((t) => String(t.id) === e.target.value);
                    setForm({
                      ...form,
                      template_id: e.target.value,
                      template_name: chosen?.name || "",
                      template_language: chosen?.language || "en",
                      category: chosen?.category || form.category,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer"
                >
                  <option value="">Select an approved template</option>
                  {approvedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category}, {t.language}, APPROVED)
                    </option>
                  ))}
                </select>
              </div>
              {approvedTemplates.length === 0 && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs">
                  No Meta-approved templates found yet. Open <Link to="/whatsapp/templates" className="underline font-semibold">/whatsapp/templates</Link> to sync approved templates from Meta.
                </div>
              )}
              {selectedTemplate && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-1.5">
                  <div className="text-xs font-bold text-slate-700">Template body</div>
                  <div className="text-sm text-slate-900 whitespace-pre-wrap">{selectedTemplate.body}</div>
                  {selectedTemplate.footer && <div className="text-xs text-slate-600">{selectedTemplate.footer}</div>}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Personalize variables with CRM data</h2>
                {templateVars.length === 0 ? (
                  <p className="text-sm text-slate-700">The selected template has no numbered variables to map.</p>
                ) : (
                  <div className="space-y-3">
                    {templateVars.map((vIdx) => {
                      const key = String(vIdx);
                      const cur = form.variable_mapping?.[key] || { field: "first_name", fallback: "" };
                      return (
                        <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-300">
                          <div className="flex items-center font-mono text-sm font-bold text-emerald-800">{`{{${key}}}`}</div>
                          <select
                            aria-label={`Field for variable ${key}`}
                            value={cur.field || ""}
                            onChange={(e) => setForm({
                              ...form,
                              variable_mapping: { ...form.variable_mapping, [key]: { ...cur, field: e.target.value } },
                            })}
                            className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer"
                          >
                            {PERSONALIZATION_FIELDS.map((pf) => (
                              <option key={pf.value || "static"} value={pf.value}>{pf.label}</option>
                            ))}
                          </select>
                          <input
                            aria-label={`Fallback for variable ${key}`}
                            placeholder="Fallback or static value"
                            value={cur.fallback || cur.static_value || ""}
                            onChange={(e) => setForm({
                              ...form,
                              variable_mapping: { ...form.variable_mapping, [key]: { ...cur, fallback: e.target.value } },
                            })}
                            className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <label htmlFor="camp-missing-policy" className="block text-xs font-semibold text-slate-800 mb-1">Missing variable handling</label>
                  <select
                    id="camp-missing-policy"
                    value={form.missing_variable_policy}
                    onChange={(e) => setForm({ ...form, missing_variable_policy: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer"
                  >
                    <option value="exclude">Exclude recipient when a required variable is missing (recommended)</option>
                    <option value="allow_blank">Use fallback value when configured</option>
                  </select>
                </div>
              </div>

              {/* Live WhatsApp Phone Preview */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-slate-300 bg-slate-100 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Smartphone className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                    <span>Live WhatsApp message preview</span>
                  </div>
                  <div className="rounded-xl bg-[#e5ddd5] p-4 min-h-[180px] flex flex-col justify-end">
                    <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-200 max-w-[92%] space-y-1.5">
                      {selectedTemplate?.header_value && (
                        <div className="text-xs font-bold text-slate-900">{selectedTemplate.header_value}</div>
                      )}
                      <div className="text-xs text-slate-900 whitespace-pre-wrap leading-relaxed">{livePreviewBody}</div>
                      {selectedTemplate?.footer && (
                        <div className="text-[11px] text-slate-600 pt-1">{selectedTemplate.footer}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Connect Flowbot, Automation &amp; Meta WhatsApp Flow</h2>
                  <p className="text-xs text-slate-700">Attach existing workflows from /whatsapp/flows and /whatsapp/automations to handle replies and conversions.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link to="/whatsapp/flows" className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 font-semibold">Open Flowbots</Link>
                  <Link to="/whatsapp/automations" className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 font-semibold">Open Automations</Link>
                  <Link to="/whatsapp/campaigns/flows" className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 font-semibold">Meta Flows Studio</Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="camp-flowbot" className="block text-xs font-semibold text-slate-800 mb-1">Chatbot Flowbot (/whatsapp/flows)</label>
                  <select id="camp-flowbot" value={form.flowbot_id} onChange={(e) => setForm({ ...form, flowbot_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer">
                    <option value="">None</option>
                    {flowbots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="camp-automation" className="block text-xs font-semibold text-slate-800 mb-1">Automation rule (/whatsapp/automations)</label>
                  <select id="camp-automation" value={form.automation_id} onChange={(e) => setForm({ ...form, automation_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer">
                    <option value="">None</option>
                    {automations.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.trigger_type})</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="camp-meta-flow" className="block text-xs font-semibold text-slate-800 mb-1">Meta WhatsApp Flow (in-app form)</label>
                  <select id="camp-meta-flow" value={form.whatsapp_flow_id} onChange={(e) => setForm({ ...form, whatsapp_flow_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer">
                    <option value="">None</option>
                    {whatsappFlows.filter((f) => f.meta_status === "PUBLISHED").map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.category})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="camp-sched" className="block text-xs font-semibold text-slate-800 mb-1">Scheduled date &amp; time (optional)</label>
                <input id="camp-sched" type="datetime-local" value={form.scheduled_at ? String(form.scheduled_at).slice(0, 16) : ""} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label htmlFor="camp-batch" className="block text-xs font-semibold text-slate-800 mb-1">Batch size</label>
                <input id="camp-batch" type="number" value={sendingConfig.batch_size} onChange={(e) => setForm({ ...form, sending: { ...sendingConfig, batch_size: Number(e.target.value) } })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label htmlFor="camp-rate" className="block text-xs font-semibold text-slate-800 mb-1">Rate limit (messages per second)</label>
                <input id="camp-rate" type="number" value={sendingConfig.rate_limit_per_sec} onChange={(e) => setForm({ ...form, sending: { ...sendingConfig, rate_limit_per_sec: Number(e.target.value) } })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Pre-flight validation &amp; cost estimate</h2>
                <button
                  type="button"
                  onClick={() => campaignId && campaignApi.validateCampaign(campaignId).then(setValidation).catch((e) => setError(e.message))}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-900 cursor-pointer"
                >
                  Re-run validation
                </button>
              </div>
              {!validation ? (
                <p className="text-sm text-slate-700">Save your draft and run validation to compute audience eligibility, route, and Meta charges.</p>
              ) : (
                <div className="space-y-4">
                  {Array.isArray(validation.blockers) && validation.blockers.length > 0 ? (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-1">
                      <div className="text-sm font-bold text-rose-900">Launch blockers ({validation.blockers.length})</div>
                      {validation.blockers.map((b, i) => (
                        <div key={i} className="text-xs text-rose-900">[{b.code}] {b.message}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>All compliance, sender, template, and billing checks passed.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-700">Eligible / matched</div>
                      <div className="font-bold text-slate-900">{validation.effective_eligible_count || 0} / {validation.audience?.total_matched || 0}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-700">Provider route</div>
                      <div className="font-bold text-slate-900">{validation.provider_route?.route || "pending"}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-700">Estimated cost ({validation.billing?.billing_mode})</div>
                      <div className="font-bold text-slate-900">{formatMinorCurrency(validation.billing?.estimated_cost_minor, validation.billing?.currency)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-700">Approval required</div>
                      <div className="font-bold text-slate-900">{validation.approval?.required ? "Yes" : "No"}</div>
                    </div>
                  </div>
                  {validation.billing?.disclaimer && <p className="text-xs text-slate-700">{validation.billing.disclaimer}</p>}
                </div>
              )}
            </div>
          )}

          {step === 8 && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-slate-900">Test send &amp; launch</h2>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[240px]">
                  <label htmlFor="camp-test-phone" className="block text-xs font-semibold text-slate-800 mb-1">Authorized test phone (must have recorded consent)</label>
                  <input
                    id="camp-test-phone"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTestSend}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  Send test message
                </button>
              </div>
              {testOutcome && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-950">
                  Test submitted via {testOutcome.provider_route}. WAMID: <code className="font-mono">{testOutcome.wamid}</code>
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="button" disabled={saving} onClick={() => handleLaunchAction("approval")} className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-lg text-xs font-bold cursor-pointer disabled:cursor-not-allowed" style={{ background: "#FCBD16", color: "#202C52" }}>
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Submit for approval
                </button>
                <button type="button" disabled={saving} onClick={() => handleLaunchAction("schedule")} className="hl-btn-secondary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed">
                  <Calendar className="w-4 h-4" aria-hidden="true" /> Schedule campaign
                </button>
                <button type="button" disabled={saving || (validation && !validation.valid)} onClick={() => handleLaunchAction("launch")} className="hl-btn-primary inline-flex items-center gap-1.5 px-5 text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send className="w-4 h-4" aria-hidden="true" /> Launch campaign
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Step Navigation Footer */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="hl-btn-secondary inline-flex items-center gap-1 px-4 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Previous
          </button>
          {step < STEPS.length - 1 && (
            <button
              type="button"
              onClick={() => goStep(step + 1)}
              className="hl-btn-primary inline-flex items-center gap-1 px-4 text-xs font-semibold cursor-pointer"
            >
              Save and continue <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
    </div>
  );
}
