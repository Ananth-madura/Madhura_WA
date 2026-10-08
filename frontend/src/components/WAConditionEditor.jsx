import React from "react";

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

const operators = [
  ["equals", "Equals"], ["not_equals", "Does not equal"], ["contains", "Contains"],
  ["gt", "Greater than"], ["gte", "At least"], ["lt", "Less than"], ["lte", "At most"],
  ["exists", "Has a value"], ["not_exists", "Has no value"],
];

export default function WAConditionEditor({ value, onChange }) {
  const rules = value.rules || [];
  const update = (index, patch) => onChange({ ...value, rules: rules.map((r, i) => i === index ? { ...r, ...patch } : r) });
  return (
    <fieldset className="hl-card p-4 space-y-3">
      <legend className="text-sm font-semibold px-1">Send only when conditions match</legend>
      <p className="text-sm text-[var(--color-ink-2)]">Compare contact or event fields, such as city, service, amount, or customer.plan. Leave empty to run for every matching event.</p>
      <label className="flex items-center gap-2 text-sm">
        Match
        <select className="hl-input p-2" value={value.match || "all"} onChange={(e) => onChange({ ...value, match: e.target.value })}>
          <option value="all">All conditions</option>
          <option value="any">Any condition</option>
        </select>
      </label>
      {rules.map((rule, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <input aria-label={`Condition ${index + 1} field`} className="hl-input p-2 flex-1 min-w-32" placeholder="Field, e.g. city" value={rule.field} onChange={(e) => update(index, { field: e.target.value })} />
          <select aria-label={`Condition ${index + 1} comparison`} className="hl-input p-2" value={rule.operator} onChange={(e) => update(index, { operator: e.target.value })}>
            {operators.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {!['exists', 'not_exists'].includes(rule.operator) && <input aria-label={`Condition ${index + 1} value`} className="hl-input p-2 flex-1 min-w-32" placeholder="Value" value={rule.value ?? ""} onChange={(e) => update(index, { value: e.target.value })} />}
          <button type="button" className="hl-btn-danger-ghost p-2 text-sm" aria-label={`Remove condition ${index + 1}`} onClick={() => onChange({ ...value, rules: rules.filter((_, i) => i !== index) })}>Remove</button>
        </div>
      ))}
      <button type="button" className="hl-btn-secondary px-3 py-2 text-sm" disabled={rules.length >= 30} onClick={() => onChange({ ...value, rules: [...rules, { field: "", operator: "equals", value: "" }] })}>Add condition</button>
    </fieldset>
  );
}
