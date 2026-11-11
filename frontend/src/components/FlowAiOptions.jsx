import React, { useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import FlowVariablePicker from "./FlowVariablePicker";

export default function FlowAiOptions({ nodeType, config = {}, nodes = [], onChange }) {
  const [newIntent, setNewIntent] = useState("");

  if (nodeType === "ai_intent") {
    const branches = config.branches || { sales: "", support: "", pricing: "" };
    const addBranch = () => {
      const key = newIntent.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "_");
      if (!key) return;
      onChange({ branches: { ...branches, [key]: "" } });
      setNewIntent("");
    };

    return (
      <div className="space-y-3">
        <div className="p-2.5 bg-fuchsia-50 border border-fuchsia-200 rounded-xl text-[11px] text-fuchsia-900 flex items-start gap-2">
          <Sparkles size={15} className="shrink-0 mt-0.5 text-fuchsia-700" />
          <div>
            <strong className="block">AI Intent Classifier</strong>
            <span className="text-[10px] text-fuchsia-800">Classifies incoming natural language replies into structured intent branches.</span>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 block mb-1">Input Variable to Classify</label>
          <input
            type="text"
            value={config.input_variable || "last_input"}
            onChange={(e) => onChange({ input_variable: e.target.value })}
            placeholder="last_input"
            className="w-full p-2 text-xs font-mono border rounded-lg"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 block mb-1">Classifier Guidance / Context</label>
          <textarea
            rows={2}
            value={config.prompt || ""}
            onChange={(e) => onChange({ prompt: e.target.value })}
            placeholder="Classify if customer wants sales quote, technical help, or pricing list."
            className="w-full p-2 text-xs border rounded-lg"
          />
        </div>

        <div className="space-y-2 border-t pt-2">
          <label className="text-xs font-bold text-slate-800 block">Intent Branches ({Object.keys(branches).length})</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newIntent}
              onChange={(e) => setNewIntent(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBranch(); } }}
              placeholder="New intent key (e.g. refund, booking)"
              className="flex-1 px-2.5 py-1.5 text-xs font-mono border rounded-lg"
            />
            <button
              type="button"
              onClick={addBranch}
              className="px-2.5 py-1.5 bg-fuchsia-600 text-white text-xs font-bold rounded-lg hover:bg-fuchsia-700 flex items-center gap-1"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          <div className="space-y-2">
            {Object.entries(branches).map(([intent, targetKey]) => (
              <div key={intent} className="p-2 bg-slate-50 border rounded-lg flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-fuchsia-800 uppercase min-w-[72px] truncate">{intent}</span>
                <select
                  value={targetKey || ""}
                  onChange={(e) => onChange({ branches: { ...branches, [intent]: e.target.value } })}
                  className="flex-1 p-1 text-[11px] border rounded bg-white font-mono"
                >
                  <option value="">-- Destination --</option>
                  {nodes.map((n) => (
                    <option key={n.node_key} value={n.node_key}>{n.node_key}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...branches };
                    delete next[intent];
                    onChange({ branches: next });
                  }}
                  className="text-slate-400 hover:text-rose-600 p-1"
                  title="Remove intent branch"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-amber-800 block mb-1">Fallback / Unrecognized Route</label>
          <select
            value={config.fallback_node || ""}
            onChange={(e) => onChange({ fallback_node: e.target.value })}
            className="w-full p-2 text-xs border rounded-lg bg-amber-50 font-mono"
          >
            <option value="">-- Fallback Step --</option>
            {nodes.map((n) => (
              <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-2.5 bg-fuchsia-50 border border-fuchsia-200 rounded-xl text-[11px] text-fuchsia-900 flex items-start gap-2">
        <Sparkles size={15} className="shrink-0 mt-0.5 text-fuchsia-700" />
        <div>
          <strong className="block">{nodeType === "ai_reply" ? "AI Variable Reply" : "AI Smart Reply"}</strong>
          <span className="text-[10px] text-fuchsia-800">Uses your organization's configured AI provider & knowledge base.</span>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-700 block mb-1">System Context / Persona (Optional)</label>
        <textarea
          rows={2}
          value={config.system_prompt || ""}
          onChange={(e) => onChange({ system_prompt: e.target.value })}
          placeholder="Answer politely in under 3 sentences as our support executive."
          className="w-full p-2 text-xs border rounded-lg"
        />
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-700 block mb-1">Prompt / Customer Question *</label>
        <textarea
          rows={3}
          value={config.prompt || ""}
          maxLength={4000}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="Answer this customer inquiry cleanly: {{last_input}}"
          className="w-full p-2 text-xs border rounded-lg"
        />
        <FlowVariablePicker
          nodes={nodes}
          label="Variables for Prompt"
          onInsert={(tag) => onChange({ prompt: `${config.prompt || ""}${config.prompt ? " " : ""}${tag}` })}
        />
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-700 block mb-1">Save Reply to Variable</label>
        <input
          type="text"
          value={config.output_variable || ""}
          onChange={(e) => onChange({ output_variable: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
          placeholder="ai_response"
          className="w-full p-2 text-xs font-mono border rounded-lg"
        />
      </div>

      {nodeType === "ai_generate" && (
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 p-2 bg-slate-50 rounded-lg border">
          <input
            type="checkbox"
            checked={config.send_immediately !== false}
            onChange={(e) => onChange({ send_immediately: e.target.checked })}
          />
          <span>Send AI reply directly to customer on WhatsApp</span>
        </label>
      )}

      <div>
        <label className="text-[11px] font-bold text-slate-700 block mb-1">Next Step Node</label>
        <select
          value={config.next_node_key || ""}
          onChange={(e) => onChange({ next_node_key: e.target.value })}
          className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
        >
          <option value="">-- Select Next Step --</option>
          {nodes.map((n) => (
            <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
          ))}
        </select>
      </div>
    </div>
  );
}

