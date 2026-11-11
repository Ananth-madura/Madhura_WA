import React from "react";
import { Plus, Trash2, Braces } from "lucide-react";
import FlowVariablePicker from "./FlowVariablePicker";

const TRANSFORMS = [
  ["template", "Set Value / Interpolate {{...}}"],
  ["uppercase", "UPPERCASE text"],
  ["lowercase", "lowercase text"],
  ["trim", "Trim whitespace"],
  ["number_add", "Math: Add (+)"],
  ["number_subtract", "Math: Subtract (-)"],
  ["number_multiply", "Math: Multiply (×)"],
  ["number_divide", "Math: Divide (÷)"],
  ["date_offset_days", "Date: Add Days (+N)"],
  ["json_extract", "JSON Path Extract"],
  ["fallback_default", "Use Default if Empty"],
];

const NEEDS_ARG = new Set(["number_add", "number_subtract", "number_multiply", "number_divide", "date_offset_days", "json_extract", "fallback_default"]);

export default function FlowSetVariableOptions({ config = {}, nodes = [], onChange }) {
  const assignments = Array.isArray(config.assignments) && config.assignments.length
    ? config.assignments
    : [{
        key: config.var_key || config.variable || config.variable_name || "",
        value: config.var_value ?? config.variable_value ?? config.value ?? "",
        transform: config.transform || "template",
        arg: config.transform_arg || "",
      }];

  const updateList = (next) => {
    const first = next[0] || { key: "", value: "", transform: "template", arg: "" };
    onChange({
      assignments: next,
      var_key: first.key,
      variable: first.key,
      var_value: first.value,
      value: first.value,
      transform: first.transform,
      transform_arg: first.arg,
    });
  };

  const updateRow = (idx, patch) => {
    updateList(assignments.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-3">
      <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-800 flex items-start gap-2">
        <Braces size={15} className="shrink-0 mt-0.5 text-slate-700" />
        <div>
          <strong className="block">n8n Edit Fields / Multi-Variable Transform</strong>
          <span className="text-[10px] text-slate-600">Assign up to 20 session variables, run math/date calculations, or extract JSON fields.</span>
        </div>
      </div>

      {assignments.map((row, idx) => (
        <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Assignment #{idx + 1}</span>
            {assignments.length > 1 && (
              <button
                type="button"
                onClick={() => updateList(assignments.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-rose-600 p-0.5"
                title="Remove field"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Variable Key *</label>
              <input
                type="text"
                value={row.key || ""}
                onChange={(e) => updateRow(idx, { key: e.target.value.replace(/[^a-zA-Z0-9_.]/g, "") })}
                placeholder="total_amount"
                className="w-full p-1.5 text-xs font-mono border rounded bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Operation / Transform</label>
              <select
                value={row.transform || "template"}
                onChange={(e) => updateRow(idx, { transform: e.target.value })}
                className="w-full p-1.5 text-[11px] border rounded bg-white"
              >
                {TRANSFORMS.map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Value / Expression *</label>
            <input
              type="text"
              value={row.value ?? ""}
              onChange={(e) => updateRow(idx, { value: e.target.value })}
              placeholder="{{customer.name}} or {{amount}}"
              className="w-full p-1.5 text-xs font-mono border rounded bg-white"
            />
            <FlowVariablePicker
              nodes={nodes}
              onInsert={(tag) => updateRow(idx, { value: `${row.value ?? ""}${tag}` })}
            />
          </div>

          {NEEDS_ARG.has(row.transform) && (
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                {row.transform === "json_extract"
                  ? "JSON Sub-Path (e.g. data.id)"
                  : row.transform === "date_offset_days"
                    ? "Days Offset (e.g. 7 or -1)"
                    : row.transform === "fallback_default"
                      ? "Fallback Value if Empty"
                      : "Operand Value / Factor"}
              </label>
              <input
                type="text"
                value={row.arg ?? ""}
                onChange={(e) => updateRow(idx, { arg: e.target.value })}
                className="w-full p-1.5 text-xs font-mono border rounded bg-white"
              />
            </div>
          )}
        </div>
      ))}

      {assignments.length < 20 && (
        <button
          type="button"
          onClick={() => updateList([...assignments, { key: "", value: "", transform: "template", arg: "" }])}
          className="w-full py-1.5 text-xs font-bold text-slate-700 bg-white border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-1"
        >
          <Plus size={13} /> Add another variable
        </button>
      )}

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

