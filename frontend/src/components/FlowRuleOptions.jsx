import React from "react";
const operators=["equals","not_equals","contains","not_contains","starts_with","ends_with","greater_or_equal","greater_than","less_than","less_or_equal","is_numeric","is_not_empty","is_empty","in"];
export default function FlowRuleOptions({config:c,onChange}){
  const grouped=Boolean(c.rules?.length),rules=c.rules||[];
  const update=(index,value)=>onChange({rules:rules.map((rule,i)=>i===index?{...rule,...value}:rule)});
  return <fieldset className="border rounded p-3 space-y-3"><legend>Combine conditions</legend>
    <label className="text-xs block">Match<select className="w-full border rounded p-2" value={grouped?c.match||"all":"single"} onChange={e=>onChange(e.target.value==="single"?{rules:undefined,match:undefined}:{match:e.target.value,rules:grouped?rules:[{field:c.subject_key||"input",operator:c.operator||"equals",value:c.value||""}]})}><option value="single">Single condition</option><option value="all">Every condition (AND)</option><option value="any">Any condition (OR)</option></select></label>
    {grouped&&rules.map((rule,index)=><div className="space-y-2 border-t pt-2" key={index}>
      <label className="block text-xs">Variable {index+1}<input className="w-full border rounded p-2" value={rule.field} onChange={e=>update(index,{field:e.target.value})} placeholder="customer.email"/></label>
      <label className="block text-xs">Operator<select className="w-full border rounded p-2" value={rule.operator} onChange={e=>update(index,{operator:e.target.value})}>{operators.map(op=><option key={op} value={op}>{op.replaceAll("_"," ")}</option>)}</select></label>
      <label className="block text-xs">Compare with<input className="w-full border rounded p-2" value={rule.value??""} onChange={e=>update(index,{value:e.target.value})} placeholder="For 'in', separate values with commas"/></label>
      <button type="button" disabled={rules.length===1} onClick={()=>onChange({rules:rules.filter((_,i)=>i!==index)})}>Remove condition {index+1}</button>
    </div>)}
    {grouped&&<button type="button" disabled={rules.length>=10} onClick={()=>onChange({rules:[...rules,{field:"input",operator:"equals",value:""}]})}>Add condition</button>}
  </fieldset>;
}
