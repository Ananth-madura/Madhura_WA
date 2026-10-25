import React from "react";
export default function FlowInputOptions({config:c,onChange}){
  const number=(key,value)=>onChange({[key]:value===""?undefined:Number(value)});
  return <fieldset className="space-y-3 border rounded p-3"><legend>Validation and recovery</legend>
    <label className="block text-xs">Answer format<select className="w-full border rounded p-2" value={c.validation_type||"none"} onChange={e=>onChange({validation_type:e.target.value})}>{[["none","Text"],["number","Number"],["email","Email"],["date","Date (YYYY-MM-DD)"],["phone","International phone"],["reference","Request reference"],["yes_no","Yes or no"],["choice","Allowed answers"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {c.validation_type==="choice"&&<label className="block text-xs">Allowed answers, one per line<textarea className="w-full border rounded p-2" value={(c.choices||[]).join("\n")} onChange={e=>onChange({choices:e.target.value.split("\n")})}/></label>}
    <div className="grid grid-cols-2 gap-2">{["min_length","max_length"].map(key=><label key={key} className="text-xs">{key==="min_length"?"Minimum characters":"Maximum characters"}<input className="w-full border rounded p-2" type="number" min="0" max="2000" value={c[key]??""} onChange={e=>number(key,e.target.value)}/></label>)}</div>
    {c.validation_type==="number"&&<><div className="grid grid-cols-2 gap-2">{["min","max"].map(key=><label className="text-xs" key={key}>{key==="min"?"Minimum value":"Maximum value"}<input className="w-full border rounded p-2" type="number" value={c[key]??""} onChange={e=>number(key,e.target.value)}/></label>)}</div><label className="text-xs"><input type="checkbox" checked={Boolean(c.integer)} onChange={e=>onChange({integer:e.target.checked})}/> Whole numbers only</label></>}
    <label className="block text-xs">Attempts before recovery<input className="w-full border rounded p-2" type="number" min="1" max="5" value={c.max_attempts??3} onChange={e=>number("max_attempts",e.target.value)}/></label>
    <label className="block text-xs">Invalid answer message<textarea className="w-full border rounded p-2" maxLength={1024} value={c.retry_message||""} onChange={e=>onChange({retry_message:e.target.value})} placeholder="Please enter a valid answer."/></label>
    <p className="text-xs">Use the Invalid after retries connection for a recovery branch. Without one, the bot hands off to a person. Use a secure portal for passwords, PINs and verification codes.</p>
  </fieldset>;
}
