import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Layers, Plus, CheckCircle2, Copy, KeyRound, ShieldAlert, UploadCloud, ArrowRight } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

const DEFAULT_FLOW_JSON = JSON.stringify(
  {
    version: "6.0",
    screens: [
      {
        id: "WELCOME",
        title: "Product Enquiry",
        terminal: true,
        layout: {
          type: "SingleColumnLayout",
          children: [
            { type: "TextHeading", text: "Solar Product Enquiry" },
            { type: "TextBody", text: "Complete this short form inside WhatsApp." },
            { type: "TextInput", name: "full_name", label: "Full Name", required: true },
            { type: "TextInput", name: "city", label: "City", required: true },
            { type: "Footer", label: "Submit", "on-click-action": { name: "complete", payload: { full_name: "${form.full_name}", city: "${form.city}" } } },
          ],
        },
      },
    ],
  },
  null,
  2
);

export default function WhatsAppFlowsPage() {
  const [flows, setFlows] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("LEAD_GENERATION");
  const [flowMode, setFlowMode] = useState("static");
  const [endpointUri, setEndpointUri] = useState("");
  const [flowJson, setFlowJson] = useState(DEFAULT_FLOW_JSON);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [fl, eps] = await Promise.all([
        campaignApi.listFlows(),
        campaignApi.listFlowEndpoints().catch(() => []),
      ]);
      setFlows(Array.isArray(fl) ? fl : []);
      setEndpoints(Array.isArray(eps) ? eps : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setError("");
    setNotice("");
    try {
      const parsed = JSON.parse(flowJson);
      if (selectedFlow) {
        const updated = await campaignApi.updateFlow(selectedFlow.id, { name, category, flow_mode: flowMode, endpoint_uri: endpointUri || null, flow_json: parsed });
        setSelectedFlow(updated);
        setNotice(`Updated Flow #${updated.id} (v${updated.local_version})`);
      } else {
        const created = await campaignApi.createFlow({ name: name || "New WhatsApp Flow", category, flow_mode: flowMode, endpoint_uri: endpointUri || null, flow_json: parsed });
        setSelectedFlow(created);
        setNotice(`Created Flow '${created.name}' (DRAFT)`);
      }
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleValidate = async (id) => {
    setError("");
    const res = await campaignApi.validateFlow(id);
    if (res.valid) setNotice("Flow JSON schema validation PASSED.");
    else setError(`Validation errors: ${(res.errors || []).join("; ")}`);
    load();
  };

  const handlePublish = async (id) => {
    setError("");
    try {
      await campaignApi.publishFlow(id, { call_meta_api: false });
      setNotice("Flow marked PUBLISHED (immutable — use Clone to edit future versions).");
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleClone = async (id) => {
    setError("");
    const cloned = await campaignApi.cloneFlow(id);
    setSelectedFlow(cloned);
    setName(cloned.name);
    setFlowJson(JSON.stringify(cloned.flow_json_parsed, null, 2));
    setNotice(`Cloned into editable draft #${cloned.id}`);
    load();
  };

  const handleProvisionEndpoint = async () => {
    setError("");
    try {
      const ep = await campaignApi.provisionFlowEndpoint({
        endpoint_uri: endpointUri || `${window.location.origin}/api/webhooks/meta/flows/1`,
      });
      setNotice(`Provisioned RSA-2048 endpoint keypair (fingerprint: ${ep.key_fingerprint})`);
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
            <h1 className="text-2xl font-bold text-slate-900">Meta WhatsApp Flows Studio</h1>
            <p className="text-sm text-slate-600">
              Design official interactive in-app WhatsApp Forms (strictly distinct from Madhura Flowbot). Published Flows are immutable; clone to create new versions.
            </p>
          </div>
          <button
            onClick={() => { setSelectedFlow(null); setName(""); setFlowJson(DEFAULT_FLOW_JSON); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> New WhatsApp Flow
          </button>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><ShieldAlert className="w-4 h-4" />{error}</div>}
        {notice && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Flow List */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"><Layers className="w-4 h-4 text-emerald-600" /> Flows ({flows.length})</h2>
            <div className="space-y-2">
              {flows.map((f) => (
                <div key={f.id} className={`p-3 rounded-lg border cursor-pointer ${selectedFlow?.id === f.id ? "border-emerald-600 bg-emerald-50/40" : "border-slate-200 hover:bg-slate-50"}`} onClick={() => { setSelectedFlow(f); setName(f.name); setCategory(f.category); setFlowMode(f.flow_mode); setEndpointUri(f.endpoint_uri || ""); setFlowJson(JSON.stringify(f.flow_json_parsed, null, 2)); }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">{f.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.meta_status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{f.meta_status}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{f.category} · {f.flow_mode} · v{f.local_version}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleValidate(f.id); }} className="text-[11px] text-blue-700 font-medium hover:underline">Validate</button>
                    {f.meta_status === "DRAFT" && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); handlePublish(f.id); }} className="text-[11px] text-emerald-700 font-medium hover:underline">Publish</button>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleClone(f.id); }} className="text-[11px] text-slate-700 font-medium hover:underline inline-flex items-center gap-0.5"><Copy className="w-3 h-3" /> Clone</button>
                    {f.meta_status === "PUBLISHED" && (
                      <>
                        <Link to={`/dashboard/campaigns/create?flow_id=${f.id}&type=flow_based`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5">
                          Launch Campaign <ArrowRight className="w-3 h-3" />
                        </Link>
                        <Link to={`/dashboard/campaigns/templates?flow_id=${f.meta_flow_id || f.id}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-indigo-700 font-medium hover:underline">
                          + Template Button
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual + JSON Flow Editor */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Flow Name" className="px-3 py-2 border border-slate-300 rounded-lg" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                {["LEAD_GENERATION", "APPOINTMENT_BOOKING", "CUSTOMER_SUPPORT", "CONTACT_US", "SURVEY", "SHOPPING", "SIGN_UP", "SIGN_IN", "OTHER"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={flowMode} onChange={(e) => setFlowMode(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="static">Static Flow (JSON-only)</option>
                <option value="dynamic">Dynamic Flow (Encrypted Data Exchange)</option>
              </select>
            </div>
            {flowMode === "dynamic" && (
              <div className="flex gap-2">
                <input value={endpointUri} onChange={(e) => setEndpointUri(e.target.value)} placeholder="HTTPS Data-Exchange Endpoint URI" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs" />
                <button type="button" onClick={handleProvisionEndpoint} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium">
                  <KeyRound className="w-3.5 h-3.5" /> Provision RSA-2048 Keys
                </button>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Meta WhatsApp Flow JSON (v6.0+)</label>
              <textarea rows={14} value={flowJson} onChange={(e) => setFlowJson(e.target.value)} className="w-full font-mono text-xs p-3 border border-slate-300 rounded-lg bg-slate-50" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500">Payment card inputs are automatically blocked by schema policy.</span>
              <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
                <UploadCloud className="w-4 h-4" /> {selectedFlow ? "Save Draft Version" : "Create Draft Flow"}
              </button>
            </div>

            {endpoints.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="text-xs font-semibold text-slate-700">Provisioned Encrypted Data-Exchange Endpoints</div>
                {endpoints.map((ep) => (
                  <div key={ep.id} className="p-2.5 rounded-lg bg-slate-50 border text-xs flex justify-between">
                    <span>#{ep.id} · {ep.endpoint_uri} · Key: <code>{ep.key_fingerprint}</code></span>
                    <span className="font-semibold text-emerald-700">{ep.health_status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
