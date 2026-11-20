import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bot, Workflow, CheckCircle2, Plus, ArrowRight } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function FlowbotsAutomationsPage({ mode = "flowbots" }) {
  const [searchParams] = useSearchParams();
  const initialCampId = searchParams.get("campaign_id") || "";
  const [campaigns, setCampaigns] = useState([]);
  const [flowbots, setFlowbots] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(initialCampId);
  const [selectedFlowbot, setSelectedFlowbot] = useState("");
  const [automations, setAutomations] = useState([]);
  const [autoForm, setAutoForm] = useState({
    name: "Post-Reply Lead Qualification",
    trigger_event: "customer_replied",
    action_type: "create_lead",
    reentry_policy: "one_time",
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      campaignApi.listCampaigns().catch(() => []),
      campaignApi.listFlowbots().catch(() => []),
    ]).then(([c, b]) => {
      setCampaigns(Array.isArray(c) ? c : []);
      setFlowbots(Array.isArray(b) ? b : []);
      if (!initialCampId && c?.length) setSelectedCampaign(String(c[0].id));
    });
  }, [initialCampId]);

  useEffect(() => {
    if (selectedCampaign) {
      campaignApi.listCampaignAutomations(selectedCampaign).then((a) => setAutomations(Array.isArray(a) ? a : [])).catch(() => { });
    }
  }, [selectedCampaign]);

  const handleAttachFlowbot = async () => {
    if (!selectedCampaign || !selectedFlowbot) { setError("Select both a campaign and a Madhura Flowbot."); return; }
    setError("");
    try {
      await campaignApi.attachFlowbot(selectedFlowbot, { campaign_id: Number(selectedCampaign), trigger_on: "reply" });
      setNotice("Attached Madhura Flowbot to campaign with persistent conversation state & human handover.");
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleAddAutomation = async (e) => {
    e.preventDefault();
    if (!selectedCampaign) { setError("Select a campaign first."); return; }
    setError("");
    try {
      await campaignApi.createCampaignAutomation(selectedCampaign, {
        name: autoForm.name,
        trigger_event: autoForm.trigger_event,
        actions: [{ type: autoForm.action_type }],
        stop_conditions: ["contact_opted_out", "order_completed", "human_handover"],
        reentry_policy: autoForm.reentry_policy,
      });
      setNotice("Campaign automation journey attached.");
      const updated = await campaignApi.listCampaignAutomations(selectedCampaign);
      setAutomations(Array.isArray(updated) ? updated : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {mode === "flowbots" ? "Madhura Flowbot Campaign Integration" : "Campaign Automation & Journey Studio"}
            </h1>
            <p className="text-sm text-slate-600">
              Bind conversational Flowbots and event-driven automation journeys to campaigns with shared campaign_id, recipient_id &amp; stop conditions.
            </p>
          </div>
          <Link to="/whatsapp/flows" className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700">
            Open Visual Node Builder
          </Link>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}
        {notice && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700">Target Campaign</label>
            {selectedCampaign && (
              <Link to={`/whatsapp/campaigns/${selectedCampaign}`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                Open Campaign Detail <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="">-- Select Campaign --</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>#{c.id} · {c.name} ({c.status})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"><Bot className="w-4 h-4 text-emerald-600" /> Attach Conversational Flowbot</h2>
            <select value={selectedFlowbot} onChange={(e) => setSelectedFlowbot(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
              <option value="">-- Select Madhura Flowbot --</option>
              {flowbots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button onClick={handleAttachFlowbot} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
              Bind Flowbot to Campaign
            </button>
          </div>

          <form onSubmit={handleAddAutomation} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"><Workflow className="w-4 h-4 text-indigo-600" /> Add Campaign Automation Binding</h2>
            <input required value={autoForm.name} onChange={(e) => setAutoForm({ ...autoForm, name: e.target.value })} placeholder="Automation Name" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <select value={autoForm.trigger_event} onChange={(e) => setAutoForm({ ...autoForm, trigger_event: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                {["customer_replied", "quick_reply_clicked", "whatsapp_flow_completed", "message_delivered", "message_read", "abandoned_cart", "paid_order", "contact_opted_out"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={autoForm.action_type} onChange={(e) => setAutoForm({ ...autoForm, action_type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                {["create_lead", "create_deal", "assign_agent", "add_tag", "send_template", "launch_flowbot", "handover_to_human"].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <select value={autoForm.reentry_policy} onChange={(e) => setAutoForm({ ...autoForm, reentry_policy: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="one_time">Re-entry: One-time journey</option>
              <option value="after_completion">Re-entry: After completion</option>
              <option value="after_cooldown">Re-entry: After cooldown</option>
              <option value="never">Re-entry: Never</option>
            </select>
            <button type="submit" className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold">
              <Plus className="w-3.5 h-3.5" /> Attach Automation
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Active Campaign Automation Bindings ({automations.length})</h3>
          {automations.length === 0 ? (
            <p className="text-xs text-slate-400">No automation bindings configured for the selected campaign.</p>
          ) : automations.map((a) => (
            <div key={a.id} className="p-3 rounded-lg border border-slate-200 text-xs flex justify-between">
              <div>
                <div className="font-semibold text-slate-900">{a.name}</div>
                <div className="text-slate-500">Trigger: {a.trigger_event} · Re-entry: {a.reentry_policy} · Stop on: {(a.stop_conditions || []).join(", ")}</div>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 h-fit font-semibold">ACTIVE</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
