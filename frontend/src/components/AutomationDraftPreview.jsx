import React, { useState } from "react";
import { sampleMatches, sampleMessage } from "../utils/automationDraft";

const initialSample = { name: "Sample customer", company: "Your business", service: "Consultation", amount: 1500, invoice_no: "SAMPLE-100", due_date: "2026-12-15", city: "Chennai" };
export default function AutomationDraftPreview({ form, conditions, options, templates, flows, groups, issues, triggerLabel }) {
  const [sample, setSample] = useState(JSON.stringify(initialSample, null, 2));
  let data = {}, error = "";
  try { data = JSON.parse(sample); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); }
  catch (_) { error = "Enter a valid JSON event object to preview this rule."; }
  const content = (prefix, kind) => {
    const template = templates.find(item => String(item.id) === String(form[`${prefix}template_id`]));
    const text = kind === "template" ? template?.body : form[`${prefix}message_text`];
    return <div className="border rounded-lg p-3 space-y-2 min-w-0">
      {kind === "template" && <p className="text-xs font-semibold">Template: {template?.name || "Select a template"}</p>}
      {kind === "media" && <p className="text-xs break-all">{form[`${prefix}media_type`]}: {sampleMessage(form[`${prefix}media_url`], data) || "Add a media URL"}</p>}
      <p className="text-sm whitespace-pre-wrap break-words">{sampleMessage(text, data) || (kind === "text" ? "Your message preview appears here." : "")}</p>
    </div>;
  };
  return <aside aria-label="Automation preview and checks" className="p-4 sm:p-6 border-t xl:border-t-0 xl:border-l min-w-0">
    <div className="xl:sticky xl:top-6 space-y-5">
      <section><h2 className="font-semibold">Readiness</h2><p className="text-sm mt-1" role="status">{issues.length ? `${issues.length} items to complete` : "Ready to save"}</p>{issues.length > 0 && <ul className="text-xs space-y-2 mt-3 list-disc pl-4">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}</section>
      <section className="border-t pt-4"><h2 className="font-semibold">Execution plan</h2><ol className="list-decimal pl-4 text-xs space-y-2 mt-3">
        <li>Receive {triggerLabel || "the selected event"}.</li><li>{conditions.rules.length ? `Check ${conditions.rules.length} conditions (${conditions.match}).` : "Accept any matching event."}</li>
        <li>{Number(form.delay_minutes) > 0 ? `Wait ${form.delay_minutes} minutes before sending.` : "Send without an initial delay."}</li>
        <li>Send the main {form.msg_kind} message.</li>
        {form.group_id && <li>Enroll in {groups.find(group => String(group.id) === String(form.group_id))?.name || "the selected group"}.</li>}
        {form.flow_id && <li>Start {flows.find(flow => String(flow.id) === String(form.flow_id))?.name || "the selected flow"}.</li>}
        {options.length > 0 && <li>Offer {options.length} reply options.</li>}
        {form.enable_sequence && <li>Send the {form.followup_msg_kind} follow-up after {form.sequence_delay_seconds} seconds.</li>}
        <li>Save {form.is_active ? "enabled" : "paused"}.</li>
      </ol></section>
      <section className="border-t pt-4 space-y-3"><h2 className="font-semibold">Sample event preview</h2><p className="text-xs">Uses only the sample fields below. Unresolved variables stay visible. This preview sends no messages and performs no actions.</p>
        {!error && <div className="space-y-2">{[["name", "Sample customer name"], ["service", "Sample service"], ["amount", "Sample amount"]].map(([field, label]) => <label key={field} className="block text-xs">{label}<input className="hl-input w-full p-2 mt-1" value={typeof data[field] === "object" ? "" : data[field] ?? ""} onChange={event => setSample(JSON.stringify({ ...data, [field]: event.target.value }, null, 2))} /></label>)}</div>}
        <details><summary className="text-xs cursor-pointer">Advanced event data</summary><label className="block text-xs mt-2">Event data (JSON)<textarea className="hl-input w-full p-2 mt-1 font-mono text-xs" rows={7} value={sample} maxLength={12000} spellCheck={false} onChange={event => setSample(event.target.value)} /></label></details>
        {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : <><p className="text-xs font-semibold" role="status">{sampleMatches(conditions, data) ? "Sample matches the conditions" : "Sample is excluded by the conditions"}</p>{content("", form.msg_kind)}{form.enable_sequence && <><p className="text-xs">Follow-up · {form.sequence_delay_seconds}s later</p>{content("followup_", form.followup_msg_kind)}</>}{options.map((option, index) => <div key={index} className="border rounded p-2 text-xs"><strong>{option.label || `Reply ${index + 1}`}</strong><p className="whitespace-pre-wrap break-words">{sampleMessage(option.reply_text, data)}</p></div>)}</>}
      </section>
    </div>
  </aside>;
}
