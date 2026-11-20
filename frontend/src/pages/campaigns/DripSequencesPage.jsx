import { useEffect, useState, useCallback } from "react";
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Copy,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  Clock,
} from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

const DEFAULT_STEPS = [
  { type: "template", label: "Step 1: Welcome / Initial Offer", category: "MARKETING", template_id: "" },
  { type: "delay", label: "Wait 24 Hours", amount: 24, unit: "hours" },
  { type: "template", label: "Step 2: Reminder & Benefits", category: "MARKETING", template_id: "" },
  { type: "delay", label: "Wait 48 Hours", amount: 48, unit: "hours" },
  { type: "template", label: "Step 3: Final Follow-Up", category: "MARKETING", template_id: "" },
];

export default function DripSequencesPage() {
  const [sequences, setSequences] = useState([]);
  const [selected, setSelected] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    reply_behavior: "route_flowbot",
    stop_conditions: ["opt_out", "purchase", "deal_won", "payment_succeeded", "suppressed"],
    steps: DEFAULT_STEPS,
  });

  const [enrollPhones, setEnrollPhones] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [seqs, tmpls] = await Promise.all([
        campaignApi.listDripSequences(),
        campaignApi.listTemplates().catch(() => []),
      ]);
      setSequences(Array.isArray(seqs) ? seqs : []);
      setTemplates(Array.isArray(tmpls?.items) ? tmpls.items : Array.isArray(tmpls) ? tmpls : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load drip sequences.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetails = async (id) => {
    try {
      const detail = await campaignApi.getDripSequence(id);
      setSelected(detail);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Enter a drip sequence name.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const cleanSteps = form.steps.map((s) => ({
        ...s,
        template_id: s.template_id ? Number(s.template_id) : null,
        amount: s.amount ? Number(s.amount) : undefined,
      }));
      const created = await campaignApi.createDripSequence({ ...form, steps: cleanSteps });
      setNotice(`Created drip sequence "${created.name}".`);
      setForm({ ...form, name: "", description: "" });
      setSelected(created);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not create drip sequence.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (id, status) => {
    setBusy(true);
    setError("");
    try {
      const updated = await campaignApi.setDripSequenceStatus(id, status);
      setNotice(`Sequence status updated to ${updated.status}.`);
      setSelected(updated);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (id) => {
    setBusy(true);
    setError("");
    try {
      const copy = await campaignApi.duplicateDripSequence(id);
      setNotice(`Duplicated sequence as "${copy.name}".`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!selected?.id || !enrollPhones.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const contacts = enrollPhones
        .split(/[\n,;]+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((phone) => ({ phone }));
      const res = await campaignApi.enrollDripContacts(selected.id, { contacts, start_immediately: true });
      setNotice(`Enrolled ${res.enrolled_count} contact(s), skipped ${res.skipped_count} (consent/suppression/duplicate guards).`);
      setEnrollPhones("");
      openDetails(selected.id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleProcessDue = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await campaignApi.processDueDripEnrollments();
      setNotice(`Processed ${res.processed || 0} due delayed drip enrollment(s).`);
      if (selected?.id) openDetails(selected.id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateStep = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const addStep = (type) => {
    const newStep =
      type === "delay"
        ? { type: "delay", label: "Delay Step", amount: 24, unit: "hours" }
        : { type: "template", label: `Message Step`, category: "MARKETING", template_id: "" };
    setForm((prev) => ({ ...prev, steps: [...prev.steps, newStep] }));
  };

  const approvedTemplates = templates.filter((t) => String(t.meta_status || "").toUpperCase() === "APPROVED");

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <GitBranch size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">Drip Campaign Sequences</h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                Durable Delay &amp; Stop-Condition Engine
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Orchestrate multi-step WhatsApp nurturing journeys with persistent wait states, opt-out and purchase exits, Flowbot reply routing, and step-level funnels.
            </p>
          </div>
        </div>
        <div className="hl-actions flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={handleProcessDue} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold cursor-pointer">
            <Clock className="w-3.5 h-3.5" /> Process Due Delays
          </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sequence Builder */}
        <div className="hl-card p-4 sm:p-5 lg:col-span-5 space-y-3">
          <h2 className="text-base font-bold m-0" style={{ color: "#202C52" }}>Create New Drip Sequence</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label htmlFor="seq-name" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>Sequence Name</label>
              <input
                id="seq-name"
                type="text"
                className="hl-input w-full"
                placeholder="e.g., New Lead 7-Day Nurture"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="seq-reply" className="block text-xs font-semibold mb-1" style={{ color: "#202C52" }}>When Contact Replies</label>
              <select
                id="seq-reply"
                className="hl-select w-full"
                value={form.reply_behavior}
                onChange={(e) => setForm({ ...form, reply_behavior: e.target.value })}
              >
                <option value="route_flowbot">Route reply to Flowbot / Automation (continue tracking)</option>
                <option value="stop">Stop sequence immediately on reply</option>
                <option value="route_inbox">Route to Team Inbox</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: "#202C52" }}>Sequence Steps ({form.steps.length})</span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => addStep("template")} className="hl-btn-secondary px-2 py-1 text-[11px] font-semibold cursor-pointer">+ Template</button>
                  <button type="button" onClick={() => addStep("delay")} className="hl-btn-secondary px-2 py-1 text-[11px] font-semibold cursor-pointer">+ Delay</button>
                </div>
              </div>
              {form.steps.map((st, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border space-y-2 text-xs" style={{ borderColor: "#E4E7ED", background: "#F8F9FB" }}>
                  <div className="flex items-center justify-between font-bold" style={{ color: "#202C52" }}>
                    <span>{idx + 1}. {st.type.toUpperCase()}</span>
                    {form.steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== idx) }))}
                        className="text-[11px] font-semibold cursor-pointer"
                        style={{ color: "#B42318" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {st.type === "delay" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={1}
                        aria-label={`Delay amount step ${idx + 1}`}
                        className="hl-input w-full"
                        value={st.amount || 24}
                        onChange={(e) => updateStep(idx, { amount: Number(e.target.value) })}
                      />
                      <select
                        aria-label={`Delay unit step ${idx + 1}`}
                        className="hl-select w-full"
                        value={st.unit || "hours"}
                        onChange={(e) => updateStep(idx, { unit: e.target.value })}
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  ) : (
                    <select
                      aria-label={`Template for step ${idx + 1}`}
                      className="hl-select w-full"
                      value={st.template_id || ""}
                      onChange={(e) => updateStep(idx, { template_id: e.target.value })}
                    >
                      <option value="">Select approved template...</option>
                      {approvedTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            <button type="submit" disabled={busy} className="hl-btn-primary w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Create Drip Sequence
            </button>
          </form>
        </div>

        {/* Sequences List & Inspector */}
        <div className="lg:col-span-7 space-y-4">
          <div className="hl-card p-4 sm:p-5 space-y-3">
            <h2 className="text-base font-bold m-0" style={{ color: "#202C52" }}>Workspace Sequences ({sequences.length})</h2>
            {loading ? (
              <p className="text-xs" style={{ color: "#667085" }}>Loading drip sequences...</p>
            ) : sequences.length === 0 ? (
              <p className="text-xs" style={{ color: "#667085" }}>No drip sequences created yet. Build your first multi-step sequence on the left.</p>
            ) : (
              <div className="space-y-2">
                {sequences.map((seq) => (
                  <div
                    key={seq.id}
                    className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3"
                    style={{
                      borderColor: selected?.id === seq.id ? "#202C52" : "#E4E7ED",
                      background: selected?.id === seq.id ? "#F8FAFC" : "#FFFFFF",
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: "#202C52" }}>{seq.name}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: seq.status === "ACTIVE" ? "#D1FADF" : "#FFF4CC", color: seq.status === "ACTIVE" ? "#16803C" : "#202C52" }}>
                          {seq.status}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#667085" }}>
                        {seq.steps?.length || 0} steps | Enrolled: {seq.enrolled_count || 0} | Active: {seq.active_enrollments || 0} | Converted: {seq.converted_count || 0}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" onClick={() => openDetails(seq.id)} className="hl-btn-secondary px-2.5 py-1.5 text-xs font-semibold cursor-pointer">
                        Inspect &amp; Enroll
                      </button>
                      {seq.status === "ACTIVE" ? (
                        <button type="button" onClick={() => handleStatus(seq.id, "PAUSED")} className="hl-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold cursor-pointer">
                          <Pause className="w-3 h-3" /> Pause
                        </button>
                      ) : (
                        <button type="button" onClick={() => handleStatus(seq.id, "ACTIVE")} className="hl-btn-primary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold cursor-pointer">
                          <Play className="w-3 h-3" /> Activate
                        </button>
                      )}
                      <button type="button" onClick={() => handleDuplicate(seq.id)} aria-label="Duplicate sequence" className="hl-btn-secondary p-1.5 cursor-pointer">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="hl-card p-4 sm:p-5 space-y-3">
              <h3 className="text-sm font-bold m-0" style={{ color: "#202C52" }}>
                Enroll Contacts &amp; Step Funnel: {selected.name}
              </h3>
              <form onSubmit={handleEnroll} className="space-y-2">
                <label htmlFor="enroll-phones" className="block text-xs font-semibold" style={{ color: "#202C52" }}>
                  Phone Numbers to Enroll (comma or newline separated, E.164 or local)
                </label>
                <textarea
                  id="enroll-phones"
                  rows={2}
                  className="hl-input w-full"
                  placeholder="+919876543210, +919811112222"
                  value={enrollPhones}
                  onChange={(e) => setEnrollPhones(e.target.value)}
                />
                <button type="submit" disabled={busy} className="hl-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold cursor-pointer">
                  <UserPlus className="w-3.5 h-3.5" /> Enroll Eligible Contacts
                </button>
              </form>

              <div className="pt-2">
                <div className="text-xs font-bold mb-1.5" style={{ color: "#202C52" }}>Step-Level Funnel Metrics</div>
                {(selected.analytics?.steps || []).length === 0 ? (
                  <p className="text-xs" style={{ color: "#667085" }}>No step executions logged yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b" style={{ borderColor: "#E4E7ED", color: "#667085" }}>
                          <th className="py-1.5 pr-2">Step</th>
                          <th className="py-1.5 pr-2">Type</th>
                          <th className="py-1.5 pr-2">Reached</th>
                          <th className="py-1.5 pr-2">Submitted</th>
                          <th className="py-1.5 pr-2">Replied</th>
                          <th className="py-1.5 pr-2">Exited</th>
                          <th className="py-1.5">Converted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.analytics.steps.map((row, i) => (
                          <tr key={i} className="border-b" style={{ borderColor: "#F2F4F7" }}>
                            <td className="py-1.5 pr-2 font-bold">#{Number(row.step_index) + 1}</td>
                            <td className="py-1.5 pr-2">{row.step_type}</td>
                            <td className="py-1.5 pr-2">{row.reached}</td>
                            <td className="py-1.5 pr-2">{row.submitted}</td>
                            <td className="py-1.5 pr-2">{row.replied}</td>
                            <td className="py-1.5 pr-2">{row.exited}</td>
                            <td className="py-1.5 font-bold" style={{ color: "#16803C" }}>{row.converted}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
