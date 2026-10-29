export const isApprovedTemplate = template => String(template?.meta_status || template?.status || "").toUpperCase() === "APPROVED";

export function automationIssues(form, conditions, options, templates, flows, senders = []) {
  const issues = [];
  if (!form.name.trim()) issues.push("Enter a rule name.");
  if (!form.trigger_type) issues.push("Choose a trigger event.");
  if (!form.sender_id || !senders.some(sender => String(sender.id) === String(form.sender_id) && sender.status === "connected")) issues.push("Choose a connected Meta sender.");
  const message = (prefix, kind, label) => {
    if (kind === "template") {
      const template = templates.find(item => String(item.id) === String(form[`${prefix}template_id`]));
      if (!template || !isApprovedTemplate(template)) issues.push(`${label}: select an approved template.`);
    } else if (kind === "media") {
      try {
        const url = new URL(form[`${prefix}media_url`]);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error();
      } catch (_) { issues.push(`${label}: enter a public HTTPS media URL.`); }
    } else if (!String(form[`${prefix}message_text`] || "").trim()) issues.push(`${label}: enter message text.`);
  };
  message("", form.msg_kind, "Main message");
  if (form.flow_id && !flows.some(flow => String(flow.id) === String(form.flow_id) && flow.status === "active")) issues.push("Choose a published, active flow.");
  if (form.enable_sequence) {
    message("followup_", form.followup_msg_kind, "Follow-up");
    if (!Number.isInteger(Number(form.sequence_delay_seconds)) || Number(form.sequence_delay_seconds) < 5 || Number(form.sequence_delay_seconds) > 60) issues.push("Follow-up delay must be 5 to 60 whole seconds.");
  }
  if (String(form.delay_minutes).trim() === "" || !Number.isInteger(Number(form.delay_minutes)) || Number(form.delay_minutes) < 0 || Number(form.delay_minutes) > 43200) issues.push("Send delay must be 0 to 43200 whole minutes.");
  if ((conditions.rules || []).some(rule => !/^[a-zA-Z0-9_.-]+$/.test(rule.field || ""))) issues.push("Every condition needs a valid event field.");
  if ((conditions.rules || []).some(rule => ["gt", "gte", "lt", "lte"].includes(rule.operator) && (String(rule.value ?? "").trim() === "" || !Number.isFinite(Number(rule.value))))) issues.push("Numeric conditions need a valid comparison number.");
  if (options.some(option => !option.label.trim() || !option.reply_text.trim())) issues.push("Complete each reply option's label and response, or remove it.");
  if (options.some(option => option.label.length > 20)) issues.push("Reply option labels must be 20 characters or fewer.");
  if (new Set(options.map(option => option.label.trim().toLowerCase())).size !== options.length) issues.push("Use a unique label for each reply option.");
  return issues;
}

export function eventField(data, field) {
  if (Object.hasOwn(data, field)) return data[field];
  return field.split(".").reduce((value, key) => value && typeof value === "object" && Object.hasOwn(value, key) ? value[key] : undefined, data);
}

export function sampleMatches(conditions, data) {
  const rules = conditions.rules || [];
  if (!rules.length) return true;
  const compare = rule => {
    const actual = eventField(data, rule.field || ""), exists = actual != null && actual !== "";
    if (rule.operator === "exists") return exists;
    if (rule.operator === "not_exists") return !exists;
    if (!exists) return false;
    const a = String(actual).toLowerCase(), b = String(rule.value ?? "").toLowerCase();
    if (rule.operator === "equals") return a === b;
    if (rule.operator === "not_equals") return a !== b;
    if (rule.operator === "contains") return a.includes(b);
    const x = Number(actual), y = Number(rule.value);
    if (!Number.isFinite(x) || !Number.isFinite(y) || String(rule.value ?? "").trim() === "") return false;
    return { gt: x > y, gte: x >= y, lt: x < y, lte: x <= y }[rule.operator] === true;
  };
  return conditions.match === "any" ? rules.some(compare) : rules.every(compare);
}

export const sampleMessage = (text, data) => String(text || "").replace(/\{\{?([\w.]+)\}?\}/g, (match, field) => {
  const value = eventField(data, field);
  return value != null && typeof value !== "object" ? String(value) : match;
});
