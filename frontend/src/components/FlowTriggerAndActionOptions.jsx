import React, { useState } from "react";
import axios from "axios";
import { Upload, Loader2, ShieldAlert, Tag, Zap } from "lucide-react";
import { API } from "../config/api";
import FlowVariablePicker from "./FlowVariablePicker";

export function FlowMediaInspector({ config = {}, nodes = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("token");
      const { data } = await axios.post(`${API}/api/whatsapp/upload-media`, form, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      onChange({
        url: data.url,
        media_url: data.url,
        media_type: data.media_type || config.media_type || "document",
        filename: data.filename || file.name,
      });
    } catch (err) {
      setUploadError(err.response?.data?.error || "File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Media Type</label>
        <select
          value={config.media_type || "document"}
          onChange={(e) => onChange({ media_type: e.target.value })}
          className="w-full p-2 text-xs border rounded-lg bg-white"
        >
          <option value="document">Document / PDF Catalog</option>
          <option value="image">Product Image (JPEG / PNG / WebP)</option>
          <option value="video">Product Video (MP4)</option>
          <option value="audio">Audio / Voice Message</option>
          <option value="link">Rich Website Link Card</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-slate-700">Media URL or Upload File *</label>
          <label className="cursor-pointer px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold hover:bg-indigo-100 inline-flex items-center gap-1">
            {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
            <span>{uploading ? "Uploading…" : "Upload File"}</span>
            <input type="file" hidden onChange={handleFileUpload} />
          </label>
        </div>
        <input
          type="text"
          value={config.url || config.media_url || ""}
          onChange={(e) => onChange({ url: e.target.value, media_url: e.target.value })}
          placeholder="https://yourdomain.com/catalog.pdf"
          className="w-full p-2 text-xs border rounded-lg font-mono"
        />
        {uploadError && <p className="text-[10px] text-rose-600 mt-1">{uploadError}</p>}
      </div>

      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Filename (for Documents)</label>
        <input
          type="text"
          value={config.filename || ""}
          onChange={(e) => onChange({ filename: e.target.value })}
          placeholder="Brochure_2026.pdf"
          className="w-full p-2 text-xs border rounded-lg"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Caption Text</label>
        <textarea
          rows={2}
          value={config.caption || ""}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Hi {{customer.name}}, here is the document you requested."
          className="w-full p-2 text-xs border rounded-lg"
        />
        <FlowVariablePicker
          nodes={nodes}
          onInsert={(tag) => onChange({ caption: `${config.caption || ""}${config.caption ? " " : ""}${tag}` })}
        />
      </div>

      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
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

export function FlowTriggerInspector({
  node,
  nodes = [],
  flowTriggerType,
  flowKeywords,
  triggerMeta,
  onFlowSettingChange,
  onChange,
}) {
  const cfg = node.config || {};
  const triggerHint =
    node.node_type === "keyword_trigger"
      ? "keyword"
      : node.node_type === "all_inbound_trigger"
        ? "all_inbound"
        : node.node_type === "first_inbound_trigger"
          ? "first_inbound"
          : flowTriggerType;

  return (
    <div className="space-y-3">
      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
        <span className="font-bold flex items-center gap-1">
          <Zap size={13} />
          <span>Multi-Dynamic Flow Entry Trigger</span>
        </span>
        <p className="text-[10px] text-amber-800">
          Controls when this bot launches automatically in real incoming WhatsApp chats.
        </p>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Trigger Mode</label>
        <select
          value={flowTriggerType}
          onChange={(e) => onFlowSettingChange("trigger", e.target.value)}
          className="w-full p-2 text-xs border rounded-lg bg-white font-semibold"
        >
          <option value="keyword">Keyword Match (Separate / Dedicated Bot)</option>
          <option value="all_inbound">Global Catch-All (Every Incoming Chat)</option>
          <option value="first_inbound">First-Time Contact Welcome Bot</option>
          <option value="manual">Manual / API / Agent Trigger Only</option>
        </select>
        {flowTriggerType !== triggerHint && node.node_type !== "start" && (
          <button
            type="button"
            onClick={() => onFlowSettingChange("trigger", triggerHint)}
            className="mt-1 text-[10px] font-bold text-amber-700 hover:underline"
          >
            Sync Flow Trigger to "{triggerHint}"
          </button>
        )}
      </div>

      {flowTriggerType === "keyword" && (
        <>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Trigger Keywords (comma-separated)</label>
            <textarea
              rows={2}
              value={flowKeywords}
              onChange={(e) => {
                onFlowSettingChange("keywords", e.target.value);
                onChange({ keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) });
              }}
              placeholder="hi, hello, pricing, demo, menu"
              className="w-full p-2 text-xs font-mono border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Match Mode</label>
              <select
                value={triggerMeta?.match_mode || "smart"}
                onChange={(e) => onFlowSettingChange("match_mode", e.target.value)}
                className="w-full p-1.5 text-xs border rounded-lg bg-white"
              >
                <option value="smart">Smart Word & Prefix</option>
                <option value="exact">Exact Match Only</option>
                <option value="contains">Contains Phrase</option>
                <option value="starts_with">Starts With</option>
                <option value="regex">Regex Pattern</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Priority (1-100)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={triggerMeta?.priority ?? 50}
                onChange={(e) => onFlowSettingChange("priority", Math.min(100, Math.max(1, Number(e.target.value) || 50)))}
                className="w-full p-1.5 text-xs font-mono border rounded-lg"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 p-2 bg-slate-50 border rounded-lg">
            <input
              type="checkbox"
              checked={Boolean(triggerMeta?.allow_restart_after_human)}
              onChange={(e) => onFlowSettingChange("allow_restart_after_human", e.target.checked)}
            />
            <span>Allow explicit keyword to re-start bot after human agent reply</span>
          </label>
        </>
      )}

      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Trigger Label / Note</label>
        <input
          type="text"
          value={cfg.trigger_label || ""}
          onChange={(e) => onChange({ trigger_label: e.target.value })}
          placeholder="e.g. Main Support Bot Entry"
          className="w-full p-2 text-xs border rounded-lg"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node *</label>
        <select
          value={cfg.next_node_key || ""}
          onChange={(e) => onChange({ next_node_key: e.target.value })}
          className="w-full p-2 text-xs border rounded-lg bg-white font-mono font-semibold"
        >
          <option value="">-- Select Next Step --</option>
          {nodes.filter((n) => n.node_key !== node.node_key).map((n) => (
            <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function FlowActionMiscInspector({ node, nodes = [], flows = [], agents = [], onChange }) {
  const cfg = node.config || {};

  if (node.node_type === "set_tag") {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
            <Tag size={12} /> CRM Contact Tag *
          </label>
          <input
            type="text"
            value={cfg.tag || ""}
            onChange={(e) => onChange({ tag: e.target.value })}
            placeholder="e.g. Hot Lead / VIP / Requested Demo"
            className="w-full p-2 text-xs border rounded-lg"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {["Hot Lead", "Support", "VIP", "Demo Booked", "Follow Up"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange({ tag: preset })}
                className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 rounded text-[10px] font-semibold"
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
          <select
            value={cfg.next_node_key || ""}
            onChange={(e) => onChange({ next_node_key: e.target.value })}
            className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
          >
            <option value="">-- Select Next Step --</option>
            {nodes.map((n) => <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (node.node_type === "jump_to_flow") {
    return (
      <div className="space-y-3">
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
          <strong>n8n Sub-Workflow Jump</strong>
          <p className="text-[10px] text-amber-800 mt-0.5">Transfers active execution and all collected session variables cleanly to another published bot.</p>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Destination Bot Flow *</label>
          <select
            value={cfg.target_flow_id || ""}
            onChange={(e) => onChange({ target_flow_id: Number(e.target.value) || "" })}
            className="w-full p-2 text-xs border rounded-lg bg-white font-semibold"
          >
            <option value="">-- Select Target Flow --</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.status})
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (node.node_type === "delay") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Delay Duration</label>
            <input
              type="number"
              min={1}
              max={60}
              value={cfg.delay_seconds ?? 2}
              onChange={(e) => onChange({ delay_seconds: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="w-full p-2 text-xs border rounded-lg font-mono font-bold"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Unit</label>
            <select
              value={cfg.delay_unit || "seconds"}
              onChange={(e) => onChange({ delay_unit: e.target.value })}
              className="w-full p-2 text-xs border rounded-lg bg-white"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes (up to 15s turn cap)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
          <select
            value={cfg.next_node_key || ""}
            onChange={(e) => onChange({ next_node_key: e.target.value })}
            className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
          >
            <option value="">-- Select Next Step --</option>
            {nodes.map((n) => <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (node.node_type === "handoff") {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Customer Handoff Message</label>
          <textarea
            rows={2}
            value={cfg.note || ""}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="Connecting you to our specialist..."
            className="w-full p-2 text-xs border rounded-lg"
          />
          <FlowVariablePicker
            nodes={nodes}
            onInsert={(tag) => onChange({ note: `${cfg.note || ""}${cfg.note ? " " : ""}${tag}` })}
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Assign to Specific Team Member (Optional)</label>
          <select
            value={cfg.assign_user_id || ""}
            onChange={(e) => onChange({ assign_user_id: e.target.value ? Number(e.target.value) : "" })}
            className="w-full p-2 text-xs border rounded-lg bg-white"
          >
            <option value="">Keep current owner / Round-robin</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Handoff Priority</label>
          <select
            value={cfg.priority || "normal"}
            onChange={(e) => onChange({ priority: e.target.value })}
            className="w-full p-2 text-xs border rounded-lg bg-white"
          >
            <option value="normal">Normal</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent Escalation</option>
          </select>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
          <p className="font-bold flex items-center gap-1"><ShieldAlert size={14} /> Agent Transfer Protocol</p>
          <p className="text-[11px] text-amber-800">
            Stops automatic replies and alerts assigned staff so a human handles the conversation seamlessly.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

