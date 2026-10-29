import React from "react";
import WAVariablePicker from "./WAVariablePicker";
import { isApprovedTemplate } from "../utils/automationDraft";

export default function AutomationFollowupOptions({ form, setForm, templates }) {
  const update = patch => setForm(previous => ({ ...previous, ...patch }));
  return <div className="space-y-3">
    <label className="block text-sm">Follow-up format<select className="hl-select w-full p-2 mt-1" value={form.followup_msg_kind} onChange={event => update({ followup_msg_kind: event.target.value })}><option value="text">Text message</option><option value="media">Media attachment</option><option value="template">Approved template</option></select></label>
    {form.followup_msg_kind === "template" ? <label className="block text-sm">Follow-up template<select className="hl-select w-full p-2 mt-1" value={form.followup_template_id} onChange={event => update({ followup_template_id: event.target.value })}><option value="">Choose an approved template</option>{templates.filter(isApprovedTemplate).map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label> : <>
      {form.followup_msg_kind === "media" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="block text-sm">Attachment type<select className="hl-select w-full p-2 mt-1" value={form.followup_media_type} onChange={event => update({ followup_media_type: event.target.value })}>{["image", "video", "audio", "document", "excel"].map(type => <option key={type} value={type}>{type}</option>)}</select></label><label className="block text-sm">Attachment HTTPS URL<input type="url" className="hl-input w-full p-2 mt-1" value={form.followup_media_url} onChange={event => update({ followup_media_url: event.target.value })} placeholder="https://example.com/brochure.pdf" /></label></div>}
      <WAVariablePicker onInsert={tag => setForm(previous => ({ ...previous, followup_message_text: `${previous.followup_message_text || ""} ${tag}`.trim() }))} />
      <label className="block text-sm">{form.followup_msg_kind === "media" ? "Follow-up caption (optional)" : "Follow-up message"}<textarea className="hl-input w-full p-3 mt-1" rows={3} maxLength={4096} value={form.followup_message_text || ""} onChange={event => update({ followup_message_text: event.target.value })} /></label>
    </>}
  </div>;
}
