import React from "react";
export default function FlowHoursOptions({config:c,onChange}){
  return <fieldset className="space-y-3 border rounded p-3"><legend>Business hours</legend>
    <label className="block text-xs">Timezone<input className="w-full border rounded p-2" value={c.timezone||"Asia/Kolkata"} onChange={e=>onChange({timezone:e.target.value})} placeholder="Asia/Kolkata"/></label>
    <div className="flex flex-wrap gap-2">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((name,index)=><label className="text-xs" key={name}><input type="checkbox" checked={(c.days||[]).includes(index)} onChange={e=>onChange({days:e.target.checked?[...(c.days||[]),index]:(c.days||[]).filter(day=>day!==index)})}/>{name}</label>)}</div>
    <label className="block text-xs">Opens<input className="w-full border rounded p-2" type="time" value={c.start||"09:00"} onChange={e=>onChange({start:e.target.value})}/></label>
    <label className="block text-xs">Closes<input className="w-full border rounded p-2" type="time" value={c.end||"18:00"} onChange={e=>onChange({end:e.target.value})}/></label>
    <p className="text-xs">Connect Open and Closed below. Overnight shifts are supported. Preview uses the current time in this timezone.</p>
  </fieldset>;
}
