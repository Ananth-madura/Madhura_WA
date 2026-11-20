import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Layers, Plus, CheckCircle2, Copy, KeyRound, ShieldAlert, UploadCloud, RefreshCw, Smartphone } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

const FLOW_STARTERS = {
  lead_gen: {
    name: "Product Enquiry Form",
    category: "LEAD_GENERATION",
    json: {
      version: "6.0",
      screens: [
        {
          id: "WELCOME",
          title: "Product Enquiry",
          terminal: true,
          layout: {
            type: "SingleColumnLayout",
            children: [
              { type: "TextHeading", text: "Product Enquiry" },
              { type: "TextBody", text: "Complete this short form inside WhatsApp." },
              { type: "TextInput", name: "full_name", label: "Full Name", required: true },
              { type: "TextInput", name: "city", label: "City", required: true },
              { type: "TextInput", name: "budget", label: "Estimated Budget", required: false },
              { type: "Footer", label: "Submit", "on-click-action": { name: "complete", payload: { full_name: "${form.full_name}", city: "${form.city}", budget: "${form.budget}" } } },
            ],
          },
        },
      ],
    },
  },
  appointment: {
    name: "Appointment Booking Form",
    category: "APPOINTMENT_BOOKING",
    json: {
      version: "6.0",
      screens: [
        {
          id: "BOOK_SLOT",
          title: "Book Appointment",
          terminal: true,
          layout: {
            type: "SingleColumnLayout",
            children: [
              { type: "TextHeading", text: "Schedule Your Visit" },
              { type: "TextBody", text: "Choose your preferred date and service." },
              { type: "TextInput", name: "customer_name", label: "Your Name", required: true },
              { type: "TextInput", name: "preferred_date", label: "Preferred Date (YYYY-MM-DD)", required: true },
              { type: "Footer", label: "Confirm Slot", "on-click-action": { name: "complete", payload: { customer_name: "${form.customer_name}", preferred_date: "${form.preferred_date}" } } },
            ],
          },
        },
      ],
    },
  },
  feedback: {
    name: "Customer Feedback Survey",
    category: "SURVEY",
    json: {
      version: "6.0",
      screens: [
        {
          id: "SURVEY",
          title: "Quick Feedback",
          terminal: true,
          layout: {
            type: "SingleColumnLayout",
            children: [
              { type: "TextHeading", text: "Rate Your Experience" },
              { type: "TextBody", text: "Tell us how we can serve you better." },
              { type: "TextInput", name: "rating", label: "Rating (1 to 5)", required: true },
              { type: "TextInput", name: "comments", label: "Suggestions", required: false },
              { type: "Footer", label: "Send Feedback", "on-click-action": { name: "complete", payload: { rating: "${form.rating}", comments: "${form.comments}" } } },
            ],
          },
        },
      ],
    },
  },
};

const DEFAULT_FLOW_JSON = JSON.stringify(FLOW_STARTERS.lead_gen.json, null, 2);

export default function WhatsAppFlowsPage() {
  const [flows, setFlows] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("LEAD_GENERATION");
  const [flowMode, setFlowMode] = useState("static");
  const [endpointUri, setEndpointUri] = useState("");
  const [flowJson, setFlowJson] = useState(DEFAULT_FLOW_JSON);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fl, eps] = await Promise.all([
        campaignApi.listFlows(),
        campaignApi.listFlowEndpoints().catch(() => []),
      ]);
      setFlows(Array.isArray(fl) ? fl : []);
      setEndpoints(Array.isArray(eps) ? eps : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const parsedPreview = useMemo(() => {
    try {
      const obj = JSON.parse(flowJson);
      return { ok: true, screen: obj?.screens?.[0] || null };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [flowJson]);

  const applyStarter = (key) => {
    const s = FLOW_STARTERS[key];
    if (!s) return;
    setSelectedFlow(null);
    setName(s.name);
    setCategory(s.category);
    setFlowMode("static");
    setFlowJson(JSON.stringify(s.json, null, 2));
    setNotice(`Loaded "${s.name}" starter template.`);
  };

  const handleSave = async () => {
    setError("");
    setNotice("");
    try {
      const parsed = JSON.parse(flowJson);
      if (selectedFlow) {
        const updated = await campaignApi.updateFlow(selectedFlow.id, { name, category, flow_mode: flowMode, endpoint_uri: endpointUri || null, flow_json: parsed });
        setSelectedFlow(updated);
        setNotice(`Updated Meta Form #${updated.id} (v${updated.local_version}).`);
      } else {
        const created = await campaignApi.createFlow({ name: name || "New Meta Form", category, flow_mode: flowMode, endpoint_uri: endpointUri || null, flow_json: parsed });
        setSelectedFlow(created);
        setNotice(`Created Meta Form '${created.name}' (DRAFT).`);
      }
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleValidate = async (id) => {
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.validateFlow(id);
      if (res.valid) setNotice("Meta Flow JSON schema validation passed.");
      else setError(`Validation errors: ${(res.errors || []).join("; ")}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handlePublish = async (id) => {
    setError("");
    setNotice("");
    try {
      await campaignApi.publishFlow(id, { call_meta_api: false });
      setNotice("Meta Form marked PUBLISHED (immutable). Use Clone to create new editable versions.");
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleClone = async (id) => {
    setError("");
    setNotice("");
    try {
      const cloned = await campaignApi.cloneFlow(id);
      setSelectedFlow(cloned);
      setName(cloned.name);
      setFlowJson(JSON.stringify(cloned.flow_json_parsed, null, 2));
      setNotice(`Cloned into editable draft #${cloned.id}.`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleProvisionEndpoint = async () => {
    setError("");
    setNotice("");
    try {
      const ep = await campaignApi.provisionFlowEndpoint({
        endpoint_uri: endpointUri || `${window.location.origin}/api/webhooks/meta/flows/1`,
      });
      setNotice(`Provisioned RSA-2048 endpoint keypair (fingerprint: ${ep.key_fingerprint}).`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const publishedCount = flows.filter((f) => f.meta_status === "PUBLISHED").length;

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      {/* Native /whatsapp Command Bar */}
      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <Layers size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">Meta WhatsApp Forms Studio</h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                {publishedCount} Published
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Build official interactive in-app WhatsApp Forms (JSON v6.0+) with RSA-2048 encryption. Attach directly to Campaigns, Templates, or Flowbots.
            </p>
          </div>
        </div>

        <div className="hl-actions flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setSelectedFlow(null); setName(""); setFlowJson(DEFAULT_FLOW_JSON); }}
            className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Meta Form
          </button>
          <button type="button" onClick={load} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="hl-kpis">
        {[
          { label: "Total Meta Forms", value: flows.length, sub: "Tenant-isolated interactive forms" },
          { label: "Published & Live", value: publishedCount, sub: "Immutable versions ready for Meta" },
          { label: "Draft Forms", value: flows.length - publishedCount, sub: "Editable before publish" },
          { label: "Encrypted Endpoints", value: endpoints.length, sub: "RSA-OAEP + AES-128-GCM keys" },
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
          <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-lg text-xs font-medium flex items-center gap-2" style={{ background: "#D1FADF", border: "1px solid #A6F4C5", color: "#16803C" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Saved Meta Forms */}
        <div className="lg:col-span-4 hl-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase m-0" style={{ color: "#202C52" }}>Meta Forms ({flows.length})</h2>
            <div className="flex gap-1">
              {[["lead_gen", "Lead"], ["appointment", "Booking"], ["feedback", "Survey"]].map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => applyStarter(k)}
                  className="px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                  style={{ background: "#FFF4CC", color: "#202C52" }}
                >
                  + {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {flows.length === 0 ? (
              <div className="p-6 text-center text-xs rounded-lg border" style={{ borderColor: "#E4E7ED", color: "#667085" }}>
                No Meta Forms yet. Pick a starter above or edit the JSON on the right and click Create Draft Form.
              </div>
            ) : flows.map((f) => (
              <div
                key={f.id}
                onClick={() => {
                  setSelectedFlow(f);
                  setName(f.name);
                  setCategory(f.category);
                  setFlowMode(f.flow_mode);
                  setEndpointUri(f.endpoint_uri || "");
                  setFlowJson(JSON.stringify(f.flow_json_parsed, null, 2));
                }}
                className="p-3 rounded-lg cursor-pointer transition-colors"
                style={{
                  border: selectedFlow?.id === f.id ? "2px solid #202C52" : "1px solid #E4E7ED",
                  background: selectedFlow?.id === f.id ? "#F7F8FA" : "#FFFFFF",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold" style={{ color: "#202C52" }}>{f.name}</span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={f.meta_status === "PUBLISHED" ? { background: "#D1FADF", color: "#16803C" } : { background: "#F1F3F7", color: "#202C52" }}
                  >
                    {f.meta_status}
                  </span>
                </div>
                <div className="text-[11px] mt-1" style={{ color: "#667085" }}>{f.category} | {f.flow_mode} | v{f.local_version}</div>
                <div className="flex flex-wrap gap-2.5 mt-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleValidate(f.id); }} className="text-[11px] font-semibold hover:underline cursor-pointer" style={{ color: "#2563EB" }}>Validate</button>
                  {f.meta_status === "DRAFT" && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handlePublish(f.id); }} className="text-[11px] font-semibold hover:underline cursor-pointer" style={{ color: "#16803C" }}>Publish</button>
                  )}
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleClone(f.id); }} className="text-[11px] font-semibold hover:underline inline-flex items-center gap-0.5 cursor-pointer" style={{ color: "#202C52" }}>
                    <Copy className="w-3 h-3" /> Clone
                  </button>
                  {f.meta_status === "PUBLISHED" && (
                    <>
                      <Link to={`/whatsapp/campaigns/create?flow_id=${f.id}&type=flow_based`} onClick={(e) => e.stopPropagation()} className="text-[11px] font-bold hover:underline cursor-pointer" style={{ color: "#16803C" }}>
                        Launch Campaign
                      </Link>
                      <Link to={`/whatsapp/templates?flow_id=${f.meta_flow_id || f.id}`} onClick={(e) => e.stopPropagation()} className="text-[11px] font-semibold hover:underline cursor-pointer" style={{ color: "#202C52" }}>
                        + Template
                      </Link>
                      <Link to="/whatsapp/flows/create" onClick={(e) => e.stopPropagation()} className="text-[11px] font-semibold hover:underline cursor-pointer" style={{ color: "#202C52" }}>
                        + Flowbot
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: JSON Editor */}
        <div className="lg:col-span-5 hl-card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meta Form Name" className="hl-input px-3 py-2" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="hl-select px-3 py-2 bg-white cursor-pointer">
              {["LEAD_GENERATION", "APPOINTMENT_BOOKING", "CUSTOMER_SUPPORT", "CONTACT_US", "SURVEY", "SHOPPING", "SIGN_UP", "SIGN_IN", "OTHER"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={flowMode} onChange={(e) => setFlowMode(e.target.value)} className="hl-select px-3 py-2 bg-white cursor-pointer">
              <option value="static">Static Form (JSON)</option>
              <option value="dynamic">Dynamic (Encrypted)</option>
            </select>
          </div>
          {flowMode === "dynamic" && (
            <div className="flex gap-2">
              <input value={endpointUri} onChange={(e) => setEndpointUri(e.target.value)} placeholder="HTTPS Data-Exchange Endpoint URI" className="hl-input flex-1 px-3 py-2 text-xs" />
              <button type="button" onClick={handleProvisionEndpoint} className="hl-btn-primary inline-flex items-center gap-1 px-3 text-xs font-semibold cursor-pointer">
                <KeyRound className="w-3.5 h-3.5" /> RSA-2048 Keys
              </button>
            </div>
          )}
          <div>
            <label htmlFor="meta-flow-json" className="block text-xs font-bold mb-1" style={{ color: "#202C52" }}>Meta WhatsApp Flow JSON (v6.0+)</label>
            <textarea id="meta-flow-json" rows={14} value={flowJson} onChange={(e) => setFlowJson(e.target.value)} className="hl-input w-full font-mono text-xs p-3" style={{ background: "#FAFAFA" }} />
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <span className="text-[11px]" style={{ color: "#667085" }}>Payment card inputs are blocked by schema policy.</span>
            <button type="button" onClick={handleSave} className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer">
              <UploadCloud className="w-4 h-4" /> {selectedFlow ? "Save Draft Version" : "Create Draft Form"}
            </button>
          </div>
          {endpoints.length > 0 && (
            <div className="pt-3 border-t space-y-1.5" style={{ borderColor: "#E4E7ED" }}>
              <div className="text-[11px] font-bold uppercase" style={{ color: "#202C52" }}>Encrypted Endpoints</div>
              {endpoints.map((ep) => (
                <div key={ep.id} className="p-2 rounded bg-[#FAFAFA] border text-[11px] flex justify-between" style={{ borderColor: "#E4E7ED" }}>
                  <span className="truncate">#{ep.id} | {ep.endpoint_uri}</span>
                  <span className="font-bold" style={{ color: "#16803C" }}>{ep.health_status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Live Mobile Form Preview */}
        <div className="lg:col-span-3 hl-card p-4 space-y-3">
          <div className="text-xs font-bold uppercase flex items-center gap-1.5" style={{ color: "#202C52" }}>
            <Smartphone className="w-4 h-4" /> Live Screen Preview
          </div>
          {!parsedPreview.ok ? (
            <div className="p-3 rounded-lg text-xs" style={{ background: "#FEE4E2", color: "#B42318" }}>
              JSON syntax error: {parsedPreview.error}
            </div>
          ) : !parsedPreview.screen ? (
            <div className="text-xs" style={{ color: "#667085" }}>Add at least one screen to preview.</div>
          ) : (
            <div className="rounded-2xl border-2 p-3.5 space-y-3" style={{ borderColor: "#202C52", background: "#FAFAFA" }}>
              <div className="pb-2 border-b text-xs font-bold" style={{ borderColor: "#E4E7ED", color: "#202C52" }}>
                {parsedPreview.screen.title || "WhatsApp Form"}
              </div>
              <div className="space-y-2.5">
                {(parsedPreview.screen.layout?.children || []).map((child, i) => {
                  if (child.type === "TextHeading") {
                    return <div key={i} className="text-sm font-bold" style={{ color: "#202C52" }}>{child.text}</div>;
                  }
                  if (child.type === "TextBody") {
                    return <div key={i} className="text-xs" style={{ color: "#667085" }}>{child.text}</div>;
                  }
                  if (child.type === "Footer") {
                    return (
                      <div key={i} className="w-full py-2 rounded-lg text-center text-xs font-bold" style={{ background: "#202C52", color: "#FFFFFF" }}>
                        {child.label || "Submit"}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="space-y-1">
                      <div className="text-[11px] font-semibold" style={{ color: "#202C52" }}>
                        {child.label || child.name}{child.required ? " *" : ""}
                      </div>
                      <div className="px-2.5 py-2 rounded border bg-white text-[11px]" style={{ borderColor: "#CBD2DE", color: "#98A2B3" }}>
                        {child.type}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
