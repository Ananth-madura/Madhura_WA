import React from "react";
const operators = ["equals", "not_equals", "contains", "starts_with", "ends_with", "greater_than", "greater_or_equal", "less_than", "less_or_equal", "in", "is_empty", "is_not_empty"];
export default function FlowSwitchOptions({ config, onChange }) {
  const routes = config.cases || [];
  const update = (index, patch) => onChange({ cases: routes.map((route, i) => i === index ? { ...route, ...patch } : route) });
  return <fieldset className="space-y-3"><legend>Route by value</legend>
    <p className="text-xs">Checks routes from top to bottom and follows the first match. Otherwise follows the fallback connection.</p>
    <label className="text-xs block">Variable<input className="w-full border rounded p-2" value={config.variable || ""} onChange={e => onChange({ variable: e.target.value })} placeholder="service" /></label>
    {routes.map((route, index) => <div key={index} className="border rounded p-3 space-y-2">
      <label className="text-xs block">Route {index + 1} label<input className="w-full border rounded p-2" value={route.label || ""} onChange={e => update(index, { label: e.target.value })} /></label>
      <label className="text-xs block">Operator<select className="w-full border rounded p-2" value={route.operator || "equals"} onChange={e => update(index, { operator: e.target.value })}>{operators.map(op => <option key={op} value={op}>{op.replaceAll("_", " ")}</option>)}</select></label>
      <label className="text-xs block">Compare with<input className="w-full border rounded p-2" value={route.value || ""} onChange={e => update(index, { value: e.target.value })} /></label>
      <button type="button" disabled={routes.length === 1} onClick={() => onChange({ cases: routes.filter((_, i) => i !== index) })}>Remove route {index + 1}</button>
    </div>)}
    <button type="button" disabled={routes.length >= 10} onClick={() => onChange({ cases: [...routes, { label: `Route ${routes.length + 1}`, operator: "equals", value: "", next_node_key: "" }] })}>Add route</button>
  </fieldset>;
}
