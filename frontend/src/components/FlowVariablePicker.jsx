import React, { useMemo, useState } from "react";
import { Braces, ChevronDown, Plus } from "lucide-react";

const BUILTIN_VARS = [
  { group: "Customer", key: "customer.name", label: "Customer Name" },
  { group: "Customer", key: "customer.phone", label: "Customer Phone" },
  { group: "Customer", key: "customer.email", label: "Customer Email" },
  { group: "Customer", key: "contact.exists", label: "Contact Exists (true/false)" },
  { group: "Conversation", key: "last_input", label: "Last Customer Message" },
  { group: "Conversation", key: "trigger_message", label: "Initial Trigger Message" },
  { group: "Conversation", key: "selected_option", label: "Selected Button / List Option" },
  { group: "Conversation", key: "selected_option_id", label: "Selected Option ID" },
  { group: "Integrations", key: "webhook_status", label: "Webhook Status (success/error)" },
  { group: "Integrations", key: "webhook_response", label: "Webhook Raw Response JSON" },
  { group: "AI", key: "ai_detected_intent", label: "AI Detected Intent" },
  { group: "AI", key: "ai_last_reply", label: "Last AI Generated Reply" },
  { group: "CRM", key: "invoice_no", label: "Latest Invoice #" },
  { group: "CRM", key: "amount", label: "Invoice / Order Amount" },
  { group: "CRM", key: "due_date", label: "Due Date" },
  { group: "CRM", key: "amc_contract_no", label: "AMC Contract #" },
  { group: "System", key: "business.is_open", label: "Is Open Hours (true/false)" },
  { group: "System", key: "date", label: "Today's Date" },
];

export function collectFlowVariables(nodes = []) {
  const discovered = new Map();
  BUILTIN_VARS.forEach((v) => discovered.set(v.key, v));

  for (const node of nodes || []) {
    const c = node?.config || {};
    if (node.node_type?.startsWith("collect_") && (c.var_key || c.variable)) {
      const k = String(c.var_key || c.variable).trim();
      if (k) discovered.set(k, { group: "Flow Inputs", key: k, label: `${node.node_key} answer` });
    }
    if (node.node_type === "set_variable") {
      if (Array.isArray(c.assignments)) {
        for (const a of c.assignments) {
          if (a?.key) discovered.set(a.key, { group: "Flow Variables", key: a.key, label: `${node.node_key}` });
        }
      } else if (c.var_key || c.variable || c.variable_name) {
        const k = String(c.var_key || c.variable || c.variable_name).trim();
        if (k) discovered.set(k, { group: "Flow Variables", key: k, label: `${node.node_key}` });
      }
    }
    if ((node.node_type === "ai_reply" || node.node_type === "ai_generate") && c.output_variable) {
      discovered.set(c.output_variable, { group: "AI Outputs", key: c.output_variable, label: `${node.node_key}` });
    }
    if (node.node_type === "business_action" && c.outputs && typeof c.outputs === "object") {
      Object.keys(c.outputs).forEach((k) => discovered.set(k, { group: "Actions", key: k, label: `${node.node_key}` }));
    }
    if (node.node_type === "api_webhook" && c.response_mapping && typeof c.response_mapping === "object") {
      Object.keys(c.response_mapping).forEach((k) => discovered.set(k, { group: "Webhook Outputs", key: k, label: `${node.node_key}` }));
    }
  }
  return [...discovered.values()];
}

export default function FlowVariablePicker({ nodes = [], onInsert, label = "Insert variable" }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const variables = useMemo(() => collectFlowVariables(nodes), [nodes]);
  const visible = useMemo(
    () =>
      variables.filter((v) =>
        `${v.group} ${v.key} ${v.label}`.toLowerCase().includes(filter.toLowerCase())
      ),
    [variables, filter]
  );

  return (
    <div className="relative inline-block w-full mt-1">
      <div className="flex flex-wrap items-center gap-1">
        {variables.slice(0, 4).map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onInsert(`{{${v.key}}}`)}
            className="px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 rounded text-[10px] font-mono transition"
            title={`${v.group}: ${v.label}`}
          >
            + {`{{${v.key}}}`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-2 py-0.5 bg-slate-800 text-white rounded text-[10px] font-semibold flex items-center gap-1 hover:bg-slate-700"
        >
          <Braces size={10} />
          <span>{label}</span>
          <ChevronDown size={10} />
        </button>
      </div>

      {open && (
        <div className="mt-1.5 p-2 bg-white border border-slate-200 rounded-xl shadow-lg space-y-2 max-h-56 overflow-y-auto z-30 relative">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter variables (e.g. customer, webhook, input)..."
            className="w-full px-2 py-1 text-[11px] border rounded-lg outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="space-y-1">
            {visible.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => {
                  onInsert(`{{${v.key}}}`);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-emerald-50 rounded-lg flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="font-mono font-semibold text-emerald-800">{`{{${v.key}}}`}</span>
                <span className="text-[10px] text-slate-400 truncate">{v.group} · {v.label}</span>
                <Plus size={11} className="text-emerald-600 shrink-0" />
              </button>
            ))}
            {!visible.length && <p className="text-[10px] text-slate-400 p-1">No matching variables.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

