import React from "react";

function Mappings({ title, values = {}, onChange, hint }) {
  const entries = Object.entries(values);
  const update = (index, key, value) => {
    if(entries.some(([existing],i)=>i!==index&&existing===key))return;
    onChange(Object.fromEntries(entries.map((entry, i) => i === index ? [key, value] : entry)));
  };
  return <fieldset className="border rounded p-3 space-y-2"><legend>{title}</legend><p className="text-xs">{hint}</p>
    {entries.map(([key, value], index) => <div key={index} className="space-y-1 border-b pb-2">
      <label className="text-xs block">Field name<input className="w-full border rounded p-2" value={key} maxLength={80} onChange={e => update(index, e.target.value, value)} /></label>
      <label className="text-xs block">Value<input className="w-full border rounded p-2" value={value} maxLength={2000} onChange={e => update(index, key, e.target.value)} /></label>
      <button type="button" onClick={() => onChange(Object.fromEntries(entries.filter((_, i) => i !== index)))}>Remove field {index + 1}</button>
    </div>)}
    <button type="button" disabled={entries.length >= 20} onClick={() => { let index = entries.length + 1; while (Object.hasOwn(values, `field_${index}`)) index++; onChange({ ...values, [`field_${index}`]: "" }); }}>Add field</button>
  </fieldset>;
}

export default function FlowBusinessActionOptions({ config, onChange }) {
  return <div className="space-y-3">
    <p className="text-xs">Runs inside SOCIA's workflow engine. Choose an organization connection and an allowed operation. Configure endpoints and credentials in Workflow connections. No n8n account is needed.</p>
    <label className="text-xs block">Connection name<input className="w-full border rounded p-2" value={config.connection || ""} maxLength={80} onChange={e => onChange({ connection: e.target.value })} placeholder="business" /></label>
    <label className="text-xs block">Operation<input className="w-full border rounded p-2" value={config.operation || ""} maxLength={80} onChange={e => onChange({ operation: e.target.value })} placeholder="appointments.availability" /></label>
    <Mappings title="Send fields" values={config.inputs} onChange={inputs => onChange({ inputs })} hint="Only these fields are sent. Use {{service}} or {{customer.phone}} for collected values." />
    <Mappings title="Save response fields" values={config.outputs} onChange={outputs => onChange({ outputs })} hint="Field name is the flow variable, such as result_message. Value is a response data path, such as message or booking.reference." />
    <p className="text-xs">Preview uses labeled sample values and makes no external calls. Live success requires the connected system to confirm the action. Timeouts follow the failure route; check the system before retrying.</p>
  </div>;
}
