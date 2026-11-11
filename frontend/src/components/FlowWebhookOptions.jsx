import React, { useState } from "react";
import { Plus, Trash2, Globe, ShieldCheck } from "lucide-react";
import FlowVariablePicker from "./FlowVariablePicker";

function KeyValueEditor({ title, pairs = {}, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value", hint }) {
  const entries = Array.isArray(pairs)
    ? pairs.map((p) => [p.key || "", p.value ?? ""])
    : Object.entries(pairs || {});

  const commit = (nextEntries) => {
    const obj = {};
    for (const [k, v] of nextEntries) {
      if (String(k || "").trim()) obj[k.trim()] = v;
    }
    onChange(obj);
  };

  return (
    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-slate-800 uppercase">{title}</span>
          {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            const idx = entries.length + 1;
            onChange({ ...(Array.isArray(pairs) ? {} : pairs), [`param_${idx}`]: "" });
          }}
          className="px-2 py-0.5 bg-violet-100 text-violet-800 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-violet-200"
        >
          <Plus size={11} /> Add
        </button>
      </div>
      {entries.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="text"
            value={k}
            onChange={(e) => {
              const next = entries.map((entry, idx) => (idx === i ? [e.target.value, entry[1]] : entry));
              commit(next);
            }}
            placeholder={keyPlaceholder}
            className="w-2/5 px-2 py-1 text-[11px] font-mono bg-white border rounded"
          />
          <input
            type="text"
            value={String(v ?? "")}
            onChange={(e) => {
              const next = entries.map((entry, idx) => (idx === i ? [entry[0], e.target.value] : entry));
              commit(next);
            }}
            placeholder={valuePlaceholder}
            className="flex-1 px-2 py-1 text-[11px] font-mono bg-white border rounded"
          />
          <button
            type="button"
            onClick={() => commit(entries.filter((_, idx) => idx !== i))}
            className="text-slate-400 hover:text-rose-600 p-1"
            title="Remove row"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function FlowWebhookOptions({ config = {}, nodes = [], onChange }) {
  const [section, setSection] = useState("request");
  const method = (config.method || "GET").toUpperCase();
  const bodyStr = typeof config.body === "string" ? config.body : config.body ? JSON.stringify(config.body, null, 2) : "";

  let jsonValid = true;
  if (method !== "GET" && bodyStr.trim() && (config.body_type || "json") === "json") {
    try {
      JSON.parse(bodyStr.replace(/\{\{?[\w.]+\}?\}/g, '"__var__"'));
    } catch (_) {
      jsonValid = false;
    }
  }

  return (
    <div className="space-y-3">
      <div className="p-2.5 bg-violet-50 border border-violet-200 rounded-xl text-[11px] text-violet-900 flex items-start gap-2">
        <Globe size={15} className="shrink-0 mt-0.5 text-violet-700" />
        <div>
          <strong className="block">n8n HTTP Request / API Webhook</strong>
          <span className="text-[10px] text-violet-800">SSRF-protected outbound REST call with dynamic variables, auth, retries & JSON response mapping.</span>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
        {[
          ["request", "Request"],
          ["auth", "Auth & Headers"],
          ["mapping", "Response Map"],
          ["options", "Retry & Routes"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`flex-1 py-1.5 px-2 rounded-lg transition ${section === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "request" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => onChange({ method: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono font-bold"
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Endpoint URL (HTTPS) *</label>
              <input
                type="text"
                value={config.url || ""}
                onChange={(e) => onChange({ url: e.target.value })}
                placeholder="https://api.example.com/v1/orders/{{order_id}}"
                className="w-full p-2 text-xs border rounded-lg font-mono"
              />
            </div>
          </div>

          <FlowVariablePicker
            nodes={nodes}
            label="Variables for URL"
            onInsert={(tag) => onChange({ url: `${config.url || ""}${tag}` })}
          />

          <KeyValueEditor
            title="Query Parameters"
            hint="Appended automatically & URL-encoded"
            pairs={config.query_params}
            keyPlaceholder="phone"
            valuePlaceholder="{{customer.phone}}"
            onChange={(query_params) => onChange({ query_params })}
          />

          {method !== "GET" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">Payload Format & Body</label>
                <select
                  value={config.body_type || "json"}
                  onChange={(e) => onChange({ body_type: e.target.value })}
                  className="text-[10px] border rounded px-1.5 py-0.5 bg-white font-semibold"
                >
                  <option value="json">JSON (application/json)</option>
                  <option value="form">Form URL Encoded</option>
                </select>
              </div>
              <textarea
                rows={5}
                spellCheck={false}
                value={bodyStr}
                onChange={(e) => onChange({ body: e.target.value })}
                placeholder={'{\n  "phone": "{{customer.phone}}",\n  "name": "{{customer.name}}",\n  "answer": "{{last_input}}"\n}'}
                className="w-full p-2 text-xs font-mono border rounded-lg bg-slate-950 text-emerald-300"
              />
              {!jsonValid && (
                <p className="text-[10px] text-amber-700 font-semibold">Check JSON quotes/commas before publishing.</p>
              )}
              <FlowVariablePicker
                nodes={nodes}
                label="Variables for Body"
                onInsert={(tag) => onChange({ body: `${bodyStr}${tag}` })}
              />
            </div>
          )}
        </div>
      )}

      {section === "auth" && (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Authentication Preset</label>
            <select
              value={config.auth_type || "none"}
              onChange={(e) => onChange({ auth_type: e.target.value })}
              className="w-full p-2 text-xs border rounded-lg bg-white"
            >
              <option value="none">None / Custom Header</option>
              <option value="bearer">Bearer Token</option>
              <option value="api_key">API Key Header</option>
              <option value="basic">Basic Auth</option>
            </select>
          </div>
          {config.auth_type === "api_key" && (
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Header Name</label>
              <input
                type="text"
                value={config.auth_header_name || ""}
                onChange={(e) => onChange({ auth_header_name: e.target.value })}
                placeholder="X-API-Key"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>
          )}
          {config.auth_type === "basic" && (
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Username</label>
              <input
                type="text"
                value={config.auth_username || ""}
                onChange={(e) => onChange({ auth_username: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg"
              />
            </div>
          )}
          {(config.auth_type && config.auth_type !== "none") && (
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                {config.auth_type === "basic" ? "Password / Secret" : "Token / API Key"}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={config.auth_token || ""}
                onChange={(e) => onChange({ auth_token: e.target.value })}
                placeholder="Enter secret token"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>
          )}

          <KeyValueEditor
            title="Custom HTTP Headers"
            pairs={config.headers}
            keyPlaceholder="X-Source"
            valuePlaceholder="MadhuraCRM"
            onChange={(headers) => onChange({ headers })}
          />
        </div>
      )}

      {section === "mapping" && (
        <div className="space-y-3">
          <KeyValueEditor
            title="Save Response Fields to Variables"
            hint="Left: Flow Variable Name (e.g. order_status) | Right: Response JSON path (e.g. data.order.status)"
            pairs={config.response_mapping}
            keyPlaceholder="flow_var_name"
            valuePlaceholder="data.items[0].status"
            onChange={(response_mapping) => onChange({ response_mapping })}
          />
          <div className="p-2.5 bg-slate-50 border rounded-xl text-[10px] text-slate-600 space-y-1">
            <strong className="flex items-center gap-1 text-slate-800"><ShieldCheck size={12} /> Automatic Built-in Outputs:</strong>
            <p><code>{"{{webhook_status}}"}</code> (success/error), <code>{"{{webhook_status_code}}"}</code> (e.g. 200), <code>{"{{webhook_response}}"}</code> (raw JSON).</p>
          </div>
        </div>
      )}

      {section === "options" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Timeout (ms)</label>
              <input
                type="number"
                min={500}
                max={30000}
                step={500}
                value={config.timeout_ms ?? 10000}
                onChange={(e) => onChange({ timeout_ms: Number(e.target.value) || 10000 })}
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Auto-Retries (0-3)</label>
              <input
                type="number"
                min={0}
                max={3}
                value={config.retry_count ?? 1}
                onChange={(e) => onChange({ retry_count: Math.min(3, Math.max(0, Number(e.target.value) || 0)) })}
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-emerald-800 block mb-1">Success Next Step *</label>
            <select
              value={config.next_node_key || config.success_next || ""}
              onChange={(e) => onChange({ next_node_key: e.target.value, success_next: e.target.value })}
              className="w-full p-2 text-xs border rounded-lg bg-emerald-50 font-mono"
            >
              <option value="">-- Connect Success Step --</option>
              {nodes.map((n) => (
                <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-rose-800 block mb-1">On Error Fallback Step</label>
            <select
              value={config.error_next || ""}
              onChange={(e) => onChange({ error_next: e.target.value })}
              className="w-full p-2 text-xs border rounded-lg bg-rose-50 font-mono"
            >
              <option value="">-- Stop Flow / Default --</option>
              {nodes.map((n) => (
                <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

