import React from "react";
import { Plus, Trash2, Layers, Filter } from "lucide-react";

export function parseConditions(raw) {
  if (!raw) return { match: "all", rules: [] };
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(value)) return { match: "all", rules: value };
    return value && Array.isArray(value.rules) ? value : { match: "all", rules: [] };
  } catch (_) {
    return { match: "all", rules: [] };
  }
}

export const CRM_FIELD_SUGGESTIONS = [
  {
    category: "👤 Contact & Customer",
    fields: [
      { key: "name", label: "Full Name" },
      { key: "company", label: "Company Name" },
      { key: "phone", label: "Phone Number" },
      { key: "email", label: "Email Address" },
      { key: "city", label: "City / Location" },
      { key: "opt_in_status", label: "WhatsApp Opt-in Status" },
    ],
  },
  {
    category: "🧾 Billing & Financials",
    fields: [
      { key: "amount", label: "Invoice Amount (₹)" },
      { key: "invoice_no", label: "Invoice Number" },
      { key: "invoice_status", label: "Invoice Status (unpaid, paid, overdue)" },
      { key: "due_date", label: "Invoice Due Date" },
      { key: "payment.status", label: "Payment Status" },
    ],
  },
  {
    category: "🎯 Leads & Sales",
    fields: [
      { key: "service", label: "Service / Requirement" },
      { key: "lead.status", label: "Lead Status" },
      { key: "lead.source", label: "Lead Source" },
      { key: "deal.stage", label: "Deal Pipeline Stage" },
      { key: "assigned_agent", label: "Assigned Agent Name" },
    ],
  },
  {
    category: "📅 Appointments & Visits",
    fields: [
      { key: "service_date", label: "Service / Visit Date" },
      { key: "appointment.date", label: "Appointment Date" },
      { key: "appointment.status", label: "Appointment Status" },
    ],
  },
];

const OPERATORS = [
  { key: "equals", label: "Equals" },
  { key: "not_equals", label: "Does not equal" },
  { key: "contains", label: "Contains" },
  { key: "not_contains", label: "Does not contain" },
  { key: "gt", label: "Greater than (>)" },
  { key: "gte", label: "At least (>=)" },
  { key: "lt", label: "Less than (<)" },
  { key: "lte", label: "At most (<=)" },
  { key: "is_empty", label: "Is empty / missing" },
  { key: "is_not_empty", label: "Has a value / exists" },
  { key: "date_before", label: "Date before" },
  { key: "date_after", label: "Date after" },
  { key: "date_between", label: "Date between (start, end)" },
];

export default function WAConditionEditor({ value, onChange }) {
  const group = value && Array.isArray(value.rules) ? value : { match: "all", rules: [] };

  const handleGroupChange = (updated) => {
    onChange(updated);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-700" />
          <span className="text-sm font-semibold text-slate-900">Advanced Condition Engine</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
            Multi-Group AND/OR
          </span>
        </div>
        <p className="text-xs text-slate-500">Execution triggers only when these CRM conditions evaluate to true.</p>
      </div>

      <GroupEditor
        group={group}
        onChange={handleGroupChange}
        isRoot={true}
      />
    </div>
  );
}

function GroupEditor({ group, onChange, isRoot = false, onRemoveGroup }) {
  const rules = group.rules || [];

  const updateRule = (idx, patch) => {
    const updated = rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange({ ...group, rules: updated });
  };

  const removeRule = (idx) => {
    onChange({ ...group, rules: rules.filter((_, i) => i !== idx) });
  };

  const addRule = () => {
    onChange({
      ...group,
      rules: [...rules, { field: "amount", operator: "gt", value: "" }],
    });
  };

  const addNestedGroup = () => {
    onChange({
      ...group,
      rules: [...rules, { match: "all", rules: [{ field: "city", operator: "contains", value: "" }] }],
    });
  };

  return (
    <div className={`space-y-3 ${isRoot ? "" : "rounded-lg border border-slate-300/80 bg-white p-3 shadow-xs"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            {isRoot ? "Main Group Match:" : "Sub-Group Match:"}
          </span>
          <select
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-xs focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
            value={group.match || "all"}
            onChange={(e) => onChange({ ...group, match: e.target.value })}
          >
            <option value="all">ALL conditions must match (AND)</option>
            <option value="any">ANY condition may match (OR)</option>
          </select>
        </div>

        {!isRoot && onRemoveGroup && (
          <button
            type="button"
            onClick={onRemoveGroup}
            className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove Group
          </button>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
          No conditions set. This automation will run for <strong>every matching event</strong>.
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((item, idx) => {
            // Check if nested group
            if (item.rules || item.match) {
              return (
                <div key={idx} className="relative pl-3 border-l-2 border-slate-300">
                  <GroupEditor
                    group={item}
                    onChange={(updatedSub) => {
                      const updated = rules.map((r, i) => (i === idx ? updatedSub : r));
                      onChange({ ...group, rules: updated });
                    }}
                    onRemoveGroup={() => removeRule(idx)}
                  />
                </div>
              );
            }

            // Normal rule
            const noVal = ["is_empty", "is_not_empty", "exists", "not_exists"].includes(item.operator);

            return (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs"
              >
                {/* Field selector with datalist suggestion */}
                <div className="flex-1 min-w-[180px]">
                  <input
                    list={`crm-fields-${idx}`}
                    aria-label={`${isRoot ? "Condition" : "Sub-condition"} ${idx + 1} field`}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-xs focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                    placeholder="Field path (e.g. amount, city)"
                    value={item.field || ""}
                    onChange={(e) => updateRule(idx, { field: e.target.value })}
                  />
                  <datalist id={`crm-fields-${idx}`}>
                    {CRM_FIELD_SUGGESTIONS.map((grp) =>
                      grp.fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label} ({grp.category})
                        </option>
                      ))
                    )}
                  </datalist>
                </div>

                {/* Operator selector */}
                <select
                  aria-label={`${isRoot ? "Condition" : "Sub-condition"} ${idx + 1} comparison`}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-xs focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  value={item.operator || "equals"}
                  onChange={(e) => updateRule(idx, { operator: e.target.value })}
                >
                  {OPERATORS.map((op) => (
                    <option key={op.key} value={op.key}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value input if needed */}
                {!noVal && (
                  <input
                    aria-label={`${isRoot ? "Condition" : "Sub-condition"} ${idx + 1} value`}
                    className="flex-1 min-w-[140px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-xs focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                    placeholder={
                      item.operator?.includes("date")
                        ? "YYYY-MM-DD"
                        : item.operator === "gt" || item.operator === "lt"
                        ? "Number (e.g. 5000)"
                        : "Value to compare"
                    }
                    value={item.value ?? ""}
                    onChange={(e) => updateRule(idx, { value: e.target.value })}
                  />
                )}

                <button
                  type="button"
                  onClick={() => removeRule(idx)}
                  className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  title="Remove condition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={addRule}
          disabled={rules.length >= 30}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition"
        >
          <Plus className="w-3.5 h-3.5 text-slate-600" /> Add condition
        </button>

        {isRoot && (
          <button
            type="button"
            onClick={addNestedGroup}
            disabled={rules.length >= 30}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <Layers className="w-3.5 h-3.5 text-slate-600" /> Add Nested Group
          </button>
        )}
      </div>
    </div>
  );
}
