import React from "react";

const OPERATION_GROUPS = [
  {
    system: "Customer Service",
    items: [
      { op: "support.knowledge_search", label: "FAQ & Knowledge Search", inputs: { customer_phone: "{{customer.phone}}", question: "{{question}}" }, outputs: { result_message: "message" } },
      { op: "support.ticket_create", label: "Create Support Ticket", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", details: "{{details}}", priority: "normal" }, outputs: { result_message: "message", ticket_ref: "reference" } },
      { op: "support.ticket_status", label: "Check Ticket Status", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "support.complaint_escalate", label: "Escalate Complaint", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", details: "{{details}}" }, outputs: { result_message: "message" } },
      { op: "support.feedback", label: "Collect CSAT Feedback", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", rating: "{{rating}}", details: "{{details}}" }, outputs: { result_message: "message" } },
    ],
  },
  {
    system: "Appointments (All 10 Workflows)",
    items: [
      { op: "appointments.availability", label: "Live Slot Availability", inputs: { service: "{{service}}", branch: "{{branch}}", date: "{{date}}" }, outputs: { result_message: "message" } },
      { op: "appointments.booking_create", label: "New Appointment Booking", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", branch: "{{branch}}", date: "{{date}}", time: "{{time}}" }, outputs: { result_message: "message", booking_ref: "reference" } },
      { op: "appointments.booking_confirm", label: "Confirm Held Appointment", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "appointments.reminder_schedule", label: "Schedule Booking Reminder", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "appointments.reschedule", label: "Reschedule Appointment", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", date: "{{date}}", time: "{{time}}" }, outputs: { result_message: "message" } },
      { op: "appointments.cancel", label: "Cancel & Release Slot", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "appointments.waitlist", label: "Join Priority Waitlist", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", branch: "{{branch}}", date: "{{date}}" }, outputs: { result_message: "message" } },
      { op: "appointments.staff_assign", label: "Assign Staff Specialist", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", service: "{{service}}" }, outputs: { result_message: "message" } },
      { op: "appointments.no_show_rebook", label: "No-Show Recovery Rebook", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", reference: "{{reference}}", date: "{{date}}", time: "{{time}}" }, outputs: { result_message: "message" } },
      { op: "appointments.follow_up", label: "Post-Appointment Feedback", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", rating: "{{rating}}", details: "{{details}}" }, outputs: { result_message: "message" } },
    ],
  },
  {
    system: "Sales, Billing & E-Commerce",
    items: [
      { op: "sales.lead_capture", label: "Capture Sales Lead", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", email: "{{email}}" }, outputs: { result_message: "message" } },
      { op: "sales.qualify", label: "Qualify & Score Lead", inputs: { customer_phone: "{{customer.phone}}", service: "{{service}}", budget: "{{budget}}", date: "{{date}}" }, outputs: { result_message: "message" } },
      { op: "sales.assign", label: "Assign Sales Rep", inputs: { customer_phone: "{{customer.phone}}", service: "{{service}}", branch: "{{branch}}" }, outputs: { result_message: "message" } },
      { op: "sales.quotation", label: "Request Quotation", inputs: { customer_phone: "{{customer.phone}}", service: "{{service}}", budget: "{{budget}}", details: "{{details}}" }, outputs: { result_message: "message" } },
      { op: "sales.demo", label: "Schedule Product Demo", inputs: { customer_phone: "{{customer.phone}}", service: "{{service}}", date: "{{date}}", time: "{{time}}" }, outputs: { result_message: "message" } },
      { op: "finance.invoice", label: "Fetch Verified Invoice", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "finance.payment_link", label: "Generate Payment Summary", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "finance.receipt", label: "Retrieve Verified Receipt", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "finance.dispute", label: "Open Billing Dispute", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", details: "{{details}}" }, outputs: { result_message: "message" } },
      { op: "commerce.product_search", label: "Search Catalog & Stock", inputs: { product: "{{product}}" }, outputs: { result_message: "message" } },
      { op: "commerce.checkout", label: "Create Verified Order", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", product: "{{product}}", quantity: "{{quantity}}" }, outputs: { result_message: "message", order_ref: "reference" } },
      { op: "commerce.order_status", label: "Track Order Status", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
    ],
  },
  {
    system: "Hospitality, Logistics, HR, Education & Operations",
    items: [
      { op: "hospitality.menu", label: "Hospitality Menu / Packages", inputs: { service: "{{service}}" }, outputs: { result_message: "message" } },
      { op: "hospitality.table", label: "Reserve Restaurant Table", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", date: "{{date}}", time: "{{time}}", guests: "{{guests}}", details: "{{details}}" }, outputs: { result_message: "message" } },
      { op: "hospitality.room", label: "Reserve Hotel Room", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", date: "{{date}}", guests: "{{guests}}", details: "{{details}}" }, outputs: { result_message: "message" } },
      { op: "logistics.tracking", label: "Track Shipment", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "logistics.technician", label: "Schedule Technician / Pickup", inputs: { customer_phone: "{{customer.phone}}", service: "{{service}}", address: "{{address}}", date: "{{date}}", details: "{{details}}" }, outputs: { result_message: "message" } },
      { op: "hr.leave", label: "Submit HR Leave Request", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", date: "{{date}}", details: "{{details}}" }, outputs: { result_message: "message" } },
      { op: "hr.leave_balance", label: "Check Leave Balance", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "hr.payslip", label: "Private Payslip Request", inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" }, outputs: { result_message: "message" } },
      { op: "education.admission", label: "Capture Student Admission", inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", course: "{{course}}", email: "{{email}}" }, outputs: { result_message: "message" } },
      { op: "operations.purchase", label: "Submit Purchase Request", inputs: { customer_phone: "{{customer.phone}}", product: "{{product}}", quantity: "{{quantity}}", budget: "{{budget}}", details: "{{details}}" }, outputs: { result_message: "message" } },
      { op: "operations.report", label: "Daily Operations Summary", inputs: { date: "{{date}}", branch: "{{branch}}" }, outputs: { result_message: "message" } },
    ],
  },
];

function Mappings({ title, values = {}, onChange, hint }) {
  const entries = Object.entries(values);
  const update = (index, key, value) => {
    if (entries.some(([existing], i) => i !== index && existing === key)) return;
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
  const mode = config.connection === "builtin" ? "builtin" : "external";
  const allPresets = OPERATION_GROUPS.flatMap((g) => g.items);

  const applyPreset = (opKey) => {
    const preset = allPresets.find((p) => p.op === opKey);
    if (!preset) return;
    onChange({
      operation: preset.op,
      inputs: preset.inputs,
      outputs: preset.outputs,
    });
  };

  return <div className="space-y-3">
    <p className="text-xs">Runs natively via Built-in CRM database (`builtin`) or dispatches to an External Business API configured in Workflow connections.</p>
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange({ connection: "builtin" })}
        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border ${mode === "builtin" ? "bg-emerald-50 border-emerald-500 text-emerald-800" : "bg-white border-slate-200 text-slate-600"}`}
      >
        Built-in CRM (Ready)
      </button>
      <button
        type="button"
        onClick={() => onChange({ connection: config.connection === "builtin" || !config.connection ? "business" : config.connection })}
        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border ${mode === "external" ? "bg-blue-50 border-blue-500 text-blue-800" : "bg-white border-slate-200 text-slate-600"}`}
      >
        External HTTPS API
      </button>
    </div>

    <label className="text-xs block font-semibold">
      10-System Operation Preset
      <select
        className="w-full border rounded p-2 mt-1 bg-white font-semibold"
        value={allPresets.some((p) => p.op === config.operation) ? config.operation : ""}
        onChange={(e) => applyPreset(e.target.value)}
      >
        <option value="">-- Choose an Industry Operation Preset --</option>
        {OPERATION_GROUPS.map((grp) => (
          <optgroup key={grp.system} label={grp.system}>
            {grp.items.map((item) => (
              <option key={item.op} value={item.op}>{item.label} ({item.op})</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>

    <label className="text-xs block">Connection name<input className="w-full border rounded p-2" value={config.connection || ""} maxLength={80} onChange={e => onChange({ connection: e.target.value })} placeholder="builtin or business" /></label>
    <label className="text-xs block">Operation<input className="w-full border rounded p-2" value={config.operation || ""} maxLength={80} onChange={e => onChange({ operation: e.target.value })} placeholder="appointments.booking_create" /></label>
    <Mappings title="Send fields" values={config.inputs} onChange={inputs => onChange({ inputs })} hint="Only these fields are sent. Use {{service}} or {{customer.phone}} for collected values." />
    <Mappings title="Save response fields" values={config.outputs} onChange={outputs => onChange({ outputs })} hint="Field name is the flow variable, such as result_message. Value is a response data path, such as message or reference." />
    <p className="text-xs">Preview uses labeled sample values and makes no external calls. Live success requires verified completion. Timeouts or conflicts follow the failure route.</p>
  </div>;
}
