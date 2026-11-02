export const isApprovedTemplate = template => String(template?.meta_status || template?.status || "").toUpperCase() === "APPROVED";

export function automationIssues(form = {}, conditions = {}, options = [], templates = [], flows = [], senders = []) {
  const issues = [];
  const safeForm = form || {};
  const safeConditions = conditions || {};
  const safeOptions = Array.isArray(options) ? options : [];
  const safeTemplates = Array.isArray(templates) ? templates : [];
  const safeFlows = Array.isArray(flows) ? flows : [];
  const safeSenders = Array.isArray(senders) ? senders : [];

  if (!String(safeForm.name || "").trim()) issues.push("Enter a rule name.");
  if (!safeForm.trigger_type) issues.push("Choose a trigger event.");
  if (!safeForm.sender_id || !safeSenders.some(sender => String(sender?.id) === String(safeForm.sender_id) && sender?.status === "connected")) {
    issues.push("Choose a connected Meta sender.");
  }

  const message = (prefix, kind, label) => {
    if (kind === "template") {
      const template = safeTemplates.find(item => String(item?.id) === String(safeForm[`${prefix}template_id`]));
      if (!template || !isApprovedTemplate(template)) issues.push(`${label}: select an approved template.`);
    } else if (kind === "media") {
      try {
        const url = new URL(safeForm[`${prefix}media_url`]);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error();
      } catch (_) {
        issues.push(`${label}: enter a public HTTPS media URL.`);
      }
    } else if (!String(safeForm[`${prefix}message_text`] || "").trim()) {
      if (!safeForm.actions_json && (!safeForm.actions || !safeForm.actions.length)) {
        issues.push(`${label}: enter message text or configure workflow actions.`);
      }
    }
  };

  message("", safeForm.msg_kind, "Main message");

  if (safeForm.flow_id && !safeFlows.some(flow => String(flow?.id) === String(safeForm.flow_id) && flow?.status === "active")) {
    issues.push("Choose a published, active flow.");
  }

  if (safeForm.enable_sequence) {
    message("followup_", safeForm.followup_msg_kind, "Follow-up");
    if (!Number.isInteger(Number(safeForm.sequence_delay_seconds)) || Number(safeForm.sequence_delay_seconds) < 5 || Number(safeForm.sequence_delay_seconds) > 60) {
      issues.push("Follow-up delay must be 5 to 60 whole seconds.");
    }
  }

  if (String(safeForm.delay_minutes ?? "").trim() === "" || !Number.isInteger(Number(safeForm.delay_minutes)) || Number(safeForm.delay_minutes) < 0 || Number(safeForm.delay_minutes) > 43200) {
    issues.push("Send delay must be 0 to 43200 whole minutes.");
  }

  const rules = Array.isArray(safeConditions.rules) ? safeConditions.rules : [];
  if (rules.some(rule => !/^[a-zA-Z0-9_.-]+$/.test(rule?.field || ""))) {
    issues.push("Every condition needs a valid event field.");
  }
  if (rules.some(rule => ["gt", "gte", "lt", "lte"].includes(rule?.operator) && (String(rule?.value ?? "").trim() === "" || !Number.isFinite(Number(rule?.value))))) {
    issues.push("Numeric conditions need a valid comparison number.");
  }

  if (safeOptions.some(option => !String(option?.label || "").trim() || !String(option?.reply_text || "").trim())) {
    issues.push("Complete each reply option's label and response, or remove it.");
  }
  if (safeOptions.some(option => String(option?.label || "").length > 20)) {
    issues.push("Reply option labels must be 20 characters or fewer.");
  }
  if (new Set(safeOptions.map(option => String(option?.label || "").trim().toLowerCase())).size !== safeOptions.length) {
    issues.push("Use a unique label for each reply option.");
  }

  return issues;
}

export function eventField(data, field) {
  if (!data || typeof data !== "object") return undefined;
  if (Object.hasOwn(data, field)) return data[field];
  return String(field || "").split(".").reduce((value, key) => value && typeof value === "object" && Object.hasOwn(value, key) ? value[key] : undefined, data);
}

export function sampleMatches(conditions, data) {
  if (!conditions || typeof conditions !== "object") return true;
  const rules = Array.isArray(conditions.rules) ? conditions.rules : [];
  if (!rules.length) return true;
  const compare = (item) => {
    if (!item) return false;
    if (item.rules || item.match) return sampleMatches(item, data);
    const actual = eventField(data, item.field || ""), exists = actual != null && actual !== "";
    if (item.operator === "exists" || item.operator === "is_not_empty") return exists;
    if (item.operator === "not_exists" || item.operator === "is_empty") return !exists;
    if (!exists) return false;
    const a = String(actual).toLowerCase(), b = String(item.value ?? "").toLowerCase();
    if (item.operator === "equals") return a === b;
    if (item.operator === "not_equals") return a !== b;
    if (item.operator === "contains") return a.includes(b);
    if (item.operator === "not_contains") return !a.includes(b);
    const x = Number(actual), y = Number(item.value);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (item.operator === "gt") return x > y;
      if (item.operator === "gte") return x >= y;
      if (item.operator === "lt") return x < y;
      if (item.operator === "lte") return x <= y;
    }
    return false;
  };
  return conditions.match === "any" ? rules.some(compare) : rules.every(compare);
}

export const sampleMessage = (text, data) => String(text || "").replace(/\{\{?([\w.]+)\}?\}/g, (match, field) => {
  const value = eventField(data, field);
  return value != null && typeof value !== "object" ? String(value) : match;
});
