"use strict";

const rules = require("./flowRules");

const SUPPORTED = new Set([
  "start",
  "trigger",
  "keyword_trigger",
  "all_inbound_trigger",
  "first_inbound_trigger",
  "send_message",
  "send_buttons",
  "send_list",
  "interactive_menu",
  "collect_input",
  "collect_number",
  "collect_email",
  "collect_date",
  "condition",
  "set_variable",
  "set_tag",
  "send_template",
  "send_cta",
  "business_hours",
  "contact_lookup",
  "crm_lookup",
  "create_lead",
  "handoff",
  "end",
  "switch",
  "business_action",
  "api_webhook",
  "ai_reply",
  "ai_generate",
  "ai_intent",
  "delay",
  "jump_to_flow",
  "send_media",
]);

const RESERVED = rules.RESERVED_KEYS;
const parse = (value) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (_) {
    throw fail("Configuration must be valid JSON");
  }
};
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function options(node) {
  const c = node.config || {};
  if (c.sections !== undefined && !Array.isArray(c.sections)) throw fail("Menu sections must be an array");
  const sections = c.sections?.length ? c.sections : [{ buttons: c.buttons || c.rows || c.options || [] }];
  return sections
    .flatMap((s) => {
      const list = s?.buttons || s?.rows || s?.options || [];
      if (!Array.isArray(list) || list.some((o) => !o || typeof o !== "object")) {
        throw fail("Menu options must be an array of objects");
      }
      return list;
    })
    .map((o, i) => ({
      ...o,
      id: String(o.reply_id || o.id || `option_${i + 1}`),
      title: String(o.title || o.label || o.text || ""),
      next_node_key: o.next_node_key || o.nextNodeId || o.next_node || o.target_node,
    }));
}

function links(node) {
  const c = node.config || {};
  return [
    c.next_node_key,
    c.true_next,
    c.then_node,
    c.false_next,
    c.else_node,
    c.open_next,
    c.closed_next,
    c.invalid_next,
    c.error_next,
    c.success_next,
    c.found_next,
    c.not_found_next,
    c.fallback_node_key,
    c.fallback_node,
    ...(c.cases || []).map((r) => r.next_node_key),
    ...Object.values(c.branches || {}),
    ...options(node).map((o) => o.next_node_key),
  ].filter(Boolean);
}

function escapeRegex(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTriggerConfig(flow) {
  let cfg = {};
  try {
    cfg = typeof flow?.trigger_config === "string" ? JSON.parse(flow.trigger_config) : flow?.trigger_config || {};
  } catch (_) {}
  return cfg && typeof cfg === "object" && !Array.isArray(cfg) ? cfg : {};
}

function extractKeywords(cfg) {
  const raw = cfg.keywords || (cfg.keyword ? [cfg.keyword] : []);
  if (typeof raw === "string") {
    return raw.split(",").map((k) => k.trim()).filter(Boolean);
  }
  return Array.isArray(raw) ? raw.map((k) => String(k || "").trim()).filter(Boolean) : [];
}

function matchesKeywordList(rawText, keywords, { matchMode = "smart", caseSensitive = false, strict = false } = {}) {
  const raw = String(rawText || "").trim();
  if (!raw || !keywords.length) return false;
  const hay = caseSensitive ? raw : raw.toLowerCase();

  return keywords.some((kwRaw) => {
    const kw = caseSensitive ? kwRaw : kwRaw.toLowerCase();
    if (!kw) return false;

    if (matchMode === "exact") {
      return hay === kw;
    }
    if (matchMode === "starts_with") {
      return hay.startsWith(kw);
    }
    if (matchMode === "contains") {
      if (strict && hay !== kw && !(hay.startsWith(kw) && /^[\s,.!?:;-]/.test(hay.slice(kw.length)))) {
        return false;
      }
      return hay.includes(kw);
    }
    if (matchMode === "regex") {
      if (kwRaw.length > 250) return false;
      try {
        return new RegExp(kwRaw, caseSensitive ? "" : "i").test(raw);
      } catch (_) {
        return false;
      }
    }

    // "smart" (default backward-compatible with waFlowEngine.selfcheck)
    if (hay === kw) return true;
    if (hay.startsWith(kw) && /^[\s,.!?:;-]/.test(hay.slice(kw.length))) return true;
    if (strict) return false;
    try {
      const flags = caseSensitive ? "" : "i";
      if (new RegExp(`^#?${escapeRegex(kw)}[\\s,.!?:;-]`, flags).test(raw)) return true;
      if (new RegExp(`^#${escapeRegex(kw)}$`, flags).test(raw)) return true;
      if (kw.length >= 4 && new RegExp(`\\b${escapeRegex(kw)}\\b`, flags).test(raw)) return true;
      if (kw.length >= 5 && hay.includes(kw)) return true;
    } catch (_) {}
    return false;
  });
}

function flowMatchesSenderScope(cfg, { senderId = null, sessionKey = null } = {}) {
  if (!cfg || cfg.sender_scope === "all" || !Array.isArray(cfg.sender_ids) || cfg.sender_ids.length === 0) {
    return true;
  }
  const normalizedTargets = cfg.sender_ids.map((id) => String(id).trim()).filter(Boolean);
  if (!normalizedTargets.length) return true;
  if (senderId !== null && senderId !== undefined && normalizedTargets.includes(String(senderId))) return true;
  if (sessionKey && normalizedTargets.includes(`web:${sessionKey}`)) return true;
  if (sessionKey && normalizedTargets.includes(String(sessionKey))) return true;
  return false;
}

function matchesFlowTrigger(flow, input = "", context = {}) {
  if (!flow) return false;
  const cfg = parseTriggerConfig(flow);
  if (!flowMatchesSenderScope(cfg, context)) return false;

  if (cfg.active_hours?.enabled) {
    try {
      if (!rules.openHours(cfg.active_hours, context.now || new Date())) return false;
    } catch (_) {}
  }

  const triggerType = flow.trigger_type || "keyword";
  if (triggerType === "manual") return Boolean(context.manual);
  if (triggerType === "first_inbound") return Boolean(context.isNew);
  if (triggerType === "all_inbound") return true;
  if (triggerType === "keyword") {
    const keywords = extractKeywords(cfg);
    return matchesKeywordList(input, keywords, {
      matchMode: cfg.match_mode || "smart",
      caseSensitive: Boolean(cfg.case_sensitive),
      strict: Boolean(context.strict),
    });
  }
  return false;
}

function sortFlowsByPriority(flows = []) {
  const tier = (t) => (t === "keyword" ? 3 : t === "first_inbound" ? 2 : t === "all_inbound" ? 1 : 0);
  return [...flows].sort((a, b) => {
    const tierDiff = tier(b.trigger_type) - tier(a.trigger_type);
    if (tierDiff !== 0) return tierDiff;
    const prioA = Number(parseTriggerConfig(a).priority ?? 50);
    const prioB = Number(parseTriggerConfig(b).priority ?? 50);
    if (prioB !== prioA) return prioB - prioA;
    return Number(b.id || 0) - Number(a.id || 0);
  });
}

function normalize(input, { publish = false } = {}) {
  if (!input || typeof input !== "object" || !String(input.name || "").trim() || String(input.name).length > 255) {
    throw fail("Provide a flow name up to 255 characters");
  }
  if (!Array.isArray(input.nodes) || !input.nodes.length || input.nodes.length > 100) {
    throw fail("A flow needs 1 to 100 steps");
  }
  if (input.nodes.some((node) => !node || typeof node.node_type !== "string")) {
    throw fail("Each step needs a supported type");
  }
  if (Buffer.byteLength(JSON.stringify(input)) > 524288) {
    throw fail("Flow definition exceeds 512 KiB");
  }

  const flow = {
    name: String(input.name).trim(),
    description: String(input.description || "").slice(0, 4000),
    entry_node_key: input.entry_node_key || "start",
    trigger_type: input.trigger_type || "keyword",
    trigger_config: parse(input.trigger_config) || {},
    nodes: input.nodes.map((n) => {
      const c = parse(n.config) || {};
      if (typeof c !== "object" || Array.isArray(c)) throw fail("Step configuration must be an object");
      if (n.node_type.startsWith("collect_")) {
        c.variable = c.var_key || c.variable || c.variable_name || "answer";
        c.var_key = c.variable;
        c.prompt = c.prompt_text || c.prompt || c.text || "";
        c.prompt_text = c.prompt;
        c.validation = c.validation_type || c.validation || n.node_type.replace("collect_", "");
        c.validation_type = c.validation;
      }
      if (n.node_type === "set_variable") {
        c.variable = c.var_key || c.variable || c.variable_name || "value";
        c.var_key = c.variable;
        c.value = c.var_value ?? c.variable_value ?? c.value ?? "";
        c.var_value = c.value;
      }
      if (n.node_type === "condition") {
        c.variable = c.subject_key || c.variable || c.variable_name || c.field || "input";
        c.true_next = c.true_next || c.then_node || "";
        c.false_next = c.false_next || c.else_node || "";
      }
      return {
        ...n,
        node_type: n.node_type.startsWith("collect_") ? "collect_input" : n.node_type,
        config: c,
      };
    }),
  };

  if (!["keyword", "manual", "all_inbound", "first_inbound"].includes(flow.trigger_type)) {
    throw fail("Choose a keyword, manual, all inbound or first inbound trigger");
  }

  const keys = new Set();
  for (const node of flow.nodes) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(node.node_key) || keys.has(node.node_key)) {
      throw fail("Each step needs a unique key using letters, numbers, underscores or hyphens");
    }
    keys.add(node.node_key);
    if (!SUPPORTED.has(node.node_type)) {
      throw fail(`Step ${node.node_key}: ${node.node_type} is not supported by the workflow runtime`);
    }
    if (!node.config || typeof node.config !== "object" || Array.isArray(node.config)) {
      throw fail("Step configuration must be an object");
    }
    if (node.config.max_attempts !== undefined && (!Number.isInteger(node.config.max_attempts) || node.config.max_attempts < 1 || node.config.max_attempts > 5)) {
      throw fail("Retry attempts must be between 1 and 5");
    }
    if (node.config.retry_message !== undefined && (typeof node.config.retry_message !== "string" || node.config.retry_message.length > 1024)) {
      throw fail("Retry messages must be text up to 1024 characters");
    }

    if (node.node_type === "condition") {
      const conditions = node.config.rules ?? [{ field: node.config.variable, operator: node.config.operator || "equals" }];
      if (!Array.isArray(conditions) || !conditions.length || conditions.length > 10 || conditions.some((r) => !r || !rules.OPERATORS.includes(r.operator || "equals") || typeof r.field !== "string" || !r.field.trim())) {
        throw fail("Use 1 to 10 conditions with supported operators and variable names");
      }
      if (node.config.match && !["all", "any"].includes(node.config.match)) throw fail("Choose all or any conditions");
    }

    if (node.node_type === "switch") {
      const c = node.config;
      if (typeof c.variable !== "string" || !c.variable.trim() || !Array.isArray(c.cases) || !c.cases.length || c.cases.length > 10 || c.cases.some((r) => !r || !rules.OPERATORS.includes(r.operator || "equals") || typeof r.value !== "string")) {
        throw fail("Switch needs a variable and 1 to 10 valid routes");
      }
      if (publish && (!c.fallback_node_key || c.cases.some((r) => !r.next_node_key))) {
        throw fail("Connect every switch route and its fallback");
      }
    }

    if (node.node_type === "business_action") {
      require("./flowIntegrations").validate(node.config, { publish });
    }

    if (node.node_type === "api_webhook") {
      require("./flowIntegrations").validateWebhook(node.config, { publish });
    }

    if (node.node_type === "ai_reply") {
      const c = node.config;
      if (typeof c.prompt !== "string" || !c.prompt.trim() || c.prompt.length > 4000 || !/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(c.output_variable || "") || ["constructor", "prototype", "name", "input", "last_input"].includes(c.output_variable)) {
        throw fail("AI reply needs a prompt and a custom output variable");
      }
      if (publish && (!c.next_node_key || !c.error_next)) {
        throw fail("Connect AI reply success and failure routes");
      }
    }

    if (node.node_type === "ai_generate") {
      const c = node.config;
      if (publish && !String(c.prompt || "").trim()) {
        throw fail(`Step ${node.node_key} AI prompt is required`);
      }
    }

    if (node.node_type === "ai_intent") {
      const c = node.config;
      const branches = Object.entries(c.branches || {});
      if (publish && !branches.length && !c.fallback_node && !c.next_node_key) {
        throw fail(`Step ${node.node_key}: add at least one intent branch or fallback route`);
      }
    }

    if (node.node_type === "set_variable" && Array.isArray(node.config.assignments)) {
      if (node.config.assignments.length > 20) throw fail("Set Variable allows up to 20 assignments per step");
      for (const a of node.config.assignments) {
        if (!a || (a.key && RESERVED.has(String(a.key).trim()))) throw fail("Reserved variable name in Set Variable");
      }
    }

    if (node.node_type === "send_media") {
      const c = node.config;
      if (!["image", "video", "audio", "document", "link"].includes(c.media_type)) {
        throw fail("Choose an image, video, audio, document, or link");
      }
      if (publish) {
        try {
          rules.mediaUrl(c.url || c.media_url, {});
        } catch (_) {
          throw fail("Media needs a fixed HTTPS destination or uploaded file URL");
        }
      }
    }

    if (node.node_type === "collect_input") {
      const c = node.config;
      if (!["input", "none", "text", "number", "email", "date", "phone", "reference", "yes_no", "choice"].includes(c.validation)) {
        throw fail("Unsupported input validation");
      }
      for (const name of ["min_length", "max_length"]) {
        if (c[name] !== undefined && (!Number.isInteger(c[name]) || c[name] < 0 || c[name] > 2000)) {
          throw fail("Input lengths must be between 0 and 2000");
        }
      }
      if ((c.min_length || 0) > (c.max_length ?? 2000)) throw fail("Minimum input length cannot exceed maximum");
      if ((c.min !== undefined && !Number.isFinite(c.min)) || (c.max !== undefined && !Number.isFinite(c.max)) || (c.min !== undefined && c.max !== undefined && c.min > c.max)) {
        throw fail("Use valid minimum and maximum numbers");
      }
      if (c.validation === "choice" && (!Array.isArray(c.choices) || !c.choices.length || c.choices.length > 20 || c.choices.some((v) => typeof v !== "string" || !v.trim() || v.length > 100))) {
        throw fail("Provide 1 to 20 allowed answers");
      }
    }

    if (node.node_type === "business_hours") {
      const c = node.config;
      try {
        new Intl.DateTimeFormat("en", { timeZone: c.timezone || "Asia/Kolkata" });
      } catch (_) {
        throw fail("Select a valid IANA timezone");
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.start || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.end || "") || c.start === c.end || !Array.isArray(c.days) || !c.days.length || c.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        throw fail("Configure working days and distinct opening/closing times");
      }
    }

    if (node.node_type === "send_cta" && publish) {
      try {
        rules.secureUrl(node.config.url, {});
      } catch (_) {
        throw fail("The link step needs a fixed HTTPS destination");
      }
      if (!String(node.config.text || "").trim() || !String(node.config.button_text || "").trim() || node.config.button_text.length > 20) {
        throw fail("Link steps need message text and a button label up to 20 characters");
      }
    }

    if (node.node_type === "send_template" && (!Array.isArray(node.config.parameters || []) || (node.config.parameters || []).length > 20)) {
      throw fail("Template parameters must be an array of up to 20 values");
    }
    if (node.config.contact_field && !["name", "email"].includes(node.config.contact_field)) {
      throw fail("Only a contact name or email can be saved from an input step");
    }
    if (RESERVED.has(node.config.variable || node.config.variable_name || "")) {
      throw fail("Reserved variable name");
    }

    if (["send_buttons", "send_list", "interactive_menu"].includes(node.node_type)) {
      const items = options(node);
      const max = node.node_type === "send_buttons" ? 3 : 10;
      if ((publish && !items.length) || items.length > max || new Set(items.map((o) => o.id)).size !== items.length) {
        throw fail(`Step ${node.node_key}: choose 1 to ${max} unique options`);
      }
      if (items.some((o) => (publish && (!o.title || !o.next_node_key)) || o.title.length > (node.node_type === "send_buttons" ? 20 : 24) || o.id.length > 200)) {
        throw fail(`Step ${node.node_key}: options need short titles and connected destinations`);
      }
    }

    if (publish) {
      if (node.node_type === "send_message" && !String(node.config.text || "").trim()) {
        throw fail(`Step ${node.node_key} needs message text`);
      }
      if (["send_buttons", "send_list", "interactive_menu"].includes(node.node_type) && (!String(node.config.text || node.config.message?.text || "").trim() || String(node.config.text || node.config.message?.text).length > 1024)) {
        throw fail(`Step ${node.node_key} needs menu text up to 1024 characters`);
      }
      if (node.node_type.startsWith("collect_") && !String(node.config.prompt || node.config.text || "").trim()) {
        throw fail(`Step ${node.node_key} needs a question`);
      }
      if (node.node_type === "condition" && (!node.config.true_next || !node.config.false_next)) {
        throw fail("Connect both condition routes");
      }
      if (node.node_type === "business_hours" && (!node.config.open_next || !node.config.closed_next)) {
        throw fail("Connect the open and closed business-hours routes");
      }
      if (node.node_type === "jump_to_flow" && !Number(node.config.target_flow_id)) {
        throw fail(`Step ${node.node_key} needs a target flow to jump to`);
      }
      const multiPortTypes = new Set(["end", "handoff", "jump_to_flow", "send_buttons", "send_list", "interactive_menu", "condition", "business_hours", "switch", "business_action", "api_webhook", "ai_intent", "crm_lookup"]);
      if (!multiPortTypes.has(node.node_type) && !node.config.next_node_key) {
        throw fail(`Step ${node.node_key} needs a next step`);
      }
      if (node.node_type === "crm_lookup" && !node.config.next_node_key && !node.config.found_next) {
        throw fail(`Step ${node.node_key} needs a next step or Found branch`);
      }
    }
  }

  if (!keys.has(flow.entry_node_key)) throw fail("The entry step does not exist");
  for (const node of flow.nodes) {
    for (const target of links(node)) {
      if (!keys.has(target)) throw fail(`Step ${node.node_key} points to missing step ${target}`);
    }
  }

  if (publish) {
    const visited = new Set();
    const todo = [flow.entry_node_key];
    while (todo.length) {
      const key = todo.pop();
      if (visited.has(key)) continue;
      visited.add(key);
      todo.push(...links(flow.nodes.find((n) => n.node_key === key)));
    }
    if (visited.size !== keys.size) throw fail("Remove or connect unreachable steps before publishing");
    if (flow.trigger_type === "keyword" && !(Array.isArray(flow.trigger_config.keywords) && flow.trigger_config.keywords.some((k) => typeof k === "string" && k.trim()))) {
      throw fail("Set at least one trigger keyword");
    }
  }
  return flow;
}

function interpolate(text, vars) {
  return rules.interpolateText(text, vars, 4096);
}

function applyVariableAssignments(node, vars) {
  const c = node.config || {};
  if (Array.isArray(c.assignments) && c.assignments.length) {
    for (const a of c.assignments) {
      const k = String(a?.key || "").trim();
      if (!k || RESERVED.has(k)) continue;
      vars[k] = rules.transformValue(a.value ?? "", vars, a.transform || "template", a.arg ?? "");
    }
  } else {
    const k = String(c.variable || c.var_key || c.variable_name || "value").trim();
    if (k && !RESERVED.has(k)) {
      vars[k] = rules.transformValue(c.value ?? c.var_value ?? c.variable_value ?? "", vars, c.transform || "template", c.transform_arg ?? "");
    }
  }
}

const ASYNC_LIVE_ACTION_TYPES = new Set([
  "business_action",
  "api_webhook",
  "ai_reply",
  "ai_generate",
  "ai_intent",
  "crm_lookup",
  "create_lead",
  "set_tag",
  "delay",
  "jump_to_flow",
]);

function step(flow, input = "", state = null, initial = {}, execution = {}) {
  if (state && Buffer.byteLength(JSON.stringify(state)) > 32768) {
    throw fail("Preview state is too large; restart the preview");
  }
  const nodes = new Map(flow.nodes.map((n) => [n.node_key, n]));
  const vars = Object.assign(Object.create(null), initial, state?.vars || {});
  const messages = [];
  const logs = [];
  let key = state?.currentNodeKey || flow.entry_node_key;
  const waiting = Boolean(state?.currentNodeKey);
  let turns = 0;
  const text = String(input || "").trim().slice(0, 2000);

  if (text && !vars.trigger_message) {
    vars.trigger_message = text;
  }

  const retry = (message, c) => {
    vars._invalid_count = (Number(vars._invalid_count) || 0) + 1;
    if (vars._invalid_count >= (c.max_attempts || 3)) {
      return c.invalid_next
        ? step({ ...flow, entry_node_key: c.invalid_next }, "", null, vars, { ...execution, contact: execution.contact || initial })
        : {
            messages: [{ sender: "bot", type: "handoff", text: "A team member will help you continue." }],
            vars,
            currentNodeKey: null,
            isEnded: true,
            isHandedOff: true,
            logs,
          };
    }
    return { messages: [{ sender: "bot", type: "text", text: message }], vars, currentNodeKey: key, waiting: true, isEnded: false, logs };
  };

  if (waiting) {
    const node = nodes.get(key);
    if (!node) throw fail("The waiting step no longer exists; restart this flow");
    const c = node.config;
    if (node.node_type.startsWith("collect_")) {
      const validation = c.validation || node.node_type.replace("collect_", "");
      const valid =
        text &&
        (!(validation === "number") || (Number.isFinite(Number(text)) && (c.min === undefined || Number(text) >= c.min) && (c.max === undefined || Number(text) <= c.max))) &&
        (!(validation === "email") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) &&
        (!(validation === "date") || (/^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)) && new Date(text).toISOString().slice(0, 10) === text));
      const formats = {
        phone: /^\+?[1-9]\d{6,14}$/,
        reference: /^[A-Za-z0-9][A-Za-z0-9 _/-]{1,63}$/,
        yes_no: /^(yes|no)$/i,
      };
      let regexValid = true;
      if (c.regex) {
        try { regexValid = new RegExp(c.regex, "i").test(text); } catch (_) {}
      }
      if (
        !valid ||
        !regexValid ||
        (formats[validation] && !formats[validation].test(text)) ||
        (validation === "choice" && !c.choices.some((value) => value.toLowerCase() === text.toLowerCase())) ||
        text.length < (c.min_length || 0) ||
        text.length > (c.max_length ?? 2000) ||
        (validation === "number" && c.integer && !Number.isInteger(Number(text))) ||
        (c.contact_field && text.length > 255) ||
        (c.contact_field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
      ) {
        return retry(c.retry_message || "Please enter a valid answer.", c);
      }
      vars[c.variable || c.variable_name || "answer"] = text;
      vars.last_input = text;
      vars.input = text;
      key = c.next_node_key;
    } else {
      const items = options(node);
      const choice =
        items.find((o) => o.id === text) ||
        items.find((o) => o.title.toLowerCase() === text.toLowerCase()) ||
        (/^\d+$/.test(text) ? items[Number(text) - 1] : null);
      if (!choice) return retry("Choose one of the displayed options.", c);
      vars.selected_option = choice.title;
      vars["selected.option"] = choice.title;
      key = choice.next_node_key;
    }
    vars._invalid_count = 0;
  }

  while (key && turns++ < 40) {
    const node = nodes.get(key);
    if (!node) throw fail("Flow destination does not exist");
    const c = node.config;
    logs.push(key);

    if (["send_buttons", "send_list", "interactive_menu"].includes(node.node_type)) {
      const items = options(node).map((o) => ({
        ...o,
        title: interpolate(o.title, vars),
        description: o.description ? interpolate(o.description, vars) : undefined,
      }));
      const sectionList = c.sections?.length
        ? c.sections.map((s) => ({
            title: s.title ? interpolate(s.title, vars) : "Options",
            rows: (s.buttons || s.rows || s.options || []).map((o, idx) => ({
              ...o,
              id: String(o.reply_id || o.id || `opt_${idx + 1}`),
              title: interpolate(o.title || o.label || o.text || "", vars),
              description: o.description ? interpolate(o.description, vars) : undefined,
            })),
          }))
        : [{ title: c.title ? interpolate(c.title, vars) : "Options", rows: items }];

      return {
        messages: [
          ...messages,
          {
            sender: "bot",
            type: node.node_type,
            text: interpolate(c.text || c.message?.text, vars),
            header: c.header_text ? interpolate(c.header_text, vars) : undefined,
            footer: c.footer_text ? interpolate(c.footer_text, vars) : undefined,
            button_text: c.button_text ? interpolate(c.button_text, vars) : undefined,
            options: items,
            buttons: node.node_type === "send_buttons" ? items : undefined,
            sections: node.node_type === "send_buttons" ? undefined : sectionList,
          },
        ],
        vars,
        currentNodeKey: key,
        waiting: true,
        isEnded: false,
        logs,
      };
    }

    if (node.node_type.startsWith("collect_")) {
      return {
        messages: [...messages, { sender: "bot", type: "text", text: interpolate(c.prompt || c.text, vars) }],
        vars,
        currentNodeKey: key,
        waiting: true,
        isEnded: false,
        logs,
      };
    }

    if (node.node_type === "switch") {
      key = c.cases.find((route) => rules.compare({ ...route, field: c.variable }, vars))?.next_node_key || c.fallback_node_key;
      continue;
    }

    if (ASYNC_LIVE_ACTION_TYPES.has(node.node_type)) {
      if (execution.live) {
        return { messages, vars, logs, action: node, isEnded: false };
      }

      // Preview / offline simulation mode
      if (node.node_type === "business_action") {
        for (const name of Object.keys(c.outputs || {})) vars[name] = `[Preview: ${name}]`;
        vars["integration.status"] = execution.previewActionError ? "failed" : "preview";
        key = execution.previewActionError ? c.error_next : c.next_node_key;
        continue;
      }
      if (node.node_type === "api_webhook") {
        vars.webhook_status = execution.previewActionError ? "error" : "success";
        vars.webhook_status_code = execution.previewActionError ? 500 : 200;
        for (const [k] of Object.entries(c.response_mapping || {})) {
          if (k) vars[k] = `[Preview: ${k}]`;
        }
        key = execution.previewActionError ? (c.error_next || c.next_node_key) : (c.success_next || c.next_node_key);
        continue;
      }
      if (node.node_type === "ai_reply") {
        vars[c.output_variable] = "[Preview: AI response]";
        vars["integration.status"] = execution.previewActionError ? "failed" : "preview";
        key = execution.previewActionError ? c.error_next : c.next_node_key;
        continue;
      }
      if (node.node_type === "ai_generate") {
        const reply = "[Preview: AI smart reply based on instructions]";
        if (c.output_variable) vars[c.output_variable] = reply;
        vars.ai_last_reply = reply;
        if (c.send_immediately !== false) {
          messages.push({ sender: "bot", type: "text", text: reply });
        }
        key = execution.previewActionError && c.error_next ? c.error_next : c.next_node_key;
        continue;
      }
      if (node.node_type === "ai_intent") {
        const entries = Object.entries(c.branches || {});
        if (execution.previewActionError || !entries.length) {
          vars.ai_detected_intent = "fallback";
          key = c.fallback_node || c.error_next || c.next_node_key;
        } else {
          vars.ai_detected_intent = entries[0][0];
          key = entries[0][1] || c.fallback_node || c.next_node_key;
        }
        continue;
      }
      if (node.node_type === "crm_lookup") {
        const found = !execution.previewActionError;
        vars.record_found = found;
        vars.invoice_no = found ? "INV-2026-088" : "";
        vars.amount = found ? "₹14,500" : "";
        vars.due_date = found ? "25 Aug 2026" : "";
        vars.amc_contract_no = found ? "AMC-2026-904" : "";
        key = found ? (c.found_next || c.next_node_key) : (c.not_found_next || c.next_node_key);
        continue;
      }
      if (node.node_type === "create_lead") {
        vars["crm.lead_created"] = true;
        key = c.next_node_key;
        continue;
      }
      if (node.node_type === "set_tag") {
        vars["crm.last_tag"] = c.tag || "";
        key = c.next_node_key;
        continue;
      }
      if (node.node_type === "delay") {
        key = c.next_node_key;
        continue;
      }
      if (node.node_type === "jump_to_flow") {
        messages.push({ sender: "bot", type: "text", text: `↪️ [Preview: Jumps to sub-flow #${c.target_flow_id || "?"}]` });
        return { messages, vars, currentNodeKey: null, isEnded: true, logs };
      }
    }

    if (node.node_type === "send_message") {
      messages.push({
        sender: "bot",
        type: "text",
        text: interpolate(c.text, vars),
        header: c.header_text ? interpolate(c.header_text, vars) : undefined,
        footer: c.footer_text ? interpolate(c.footer_text, vars) : undefined,
        preview_url: Boolean(c.preview_url),
      });
    }
    if (node.node_type === "send_media") {
      if (c.media_type === "link") {
        messages.push({
          sender: "bot",
          type: "text",
          text: [interpolate(c.caption, vars), interpolate(c.url || c.media_url, vars)].filter(Boolean).join("\n"),
        });
      } else {
        messages.push({
          sender: "bot",
          type: "media",
          media_type: c.media_type,
          url: rules.mediaUrl(c.url || c.media_url, vars),
          text: interpolate(c.caption, vars),
          filename: interpolate(c.filename, vars),
        });
      }
    }
    if (node.node_type === "send_template") {
      messages.push({
        sender: "bot",
        type: "template",
        template_id: c.template_id,
        template_name: c.template_name,
        parameters: c.parameters || [],
        text: "Template delivery requires verified Meta approval for this sender.",
      });
    }
    if (node.node_type === "send_cta") {
      let url;
      try {
        url = rules.secureUrl(c.url, vars);
      } catch (_) {
        throw fail("Configure a fixed HTTPS destination before previewing this link step");
      }
      messages.push({
        sender: "bot",
        type: "cta_url",
        text: interpolate(c.text, vars),
        url,
        button_text: interpolate(c.button_text, vars),
        buttons: [{ type: "url", title: interpolate(c.button_text, vars), url }],
      });
    }
    if (node.node_type === "contact_lookup") {
      for (const field of ["customer.name", "customer.phone", "customer.email", "contact.exists"]) {
        vars[field] = (execution.contact || initial)[field] ?? (field === "contact.exists" ? false : "");
      }
    }
    if (node.node_type === "business_hours") {
      const open = rules.openHours(c, execution.now || new Date());
      vars["business.is_open"] = open;
      key = open ? c.open_next : c.closed_next;
      continue;
    }
    if (node.node_type === "set_variable") {
      applyVariableAssignments(node, vars);
    }
    if (node.node_type === "condition") {
      const match = rules.evaluate(c, vars);
      key = match ? (c.true_next || c.then_node) : (c.false_next || c.else_node);
      continue;
    }
    if (node.node_type === "handoff") {
      if (c.note) messages.push({ sender: "bot", type: "handoff", text: interpolate(c.note, vars) });
      return { messages, vars, currentNodeKey: null, isEnded: true, isHandedOff: true, handoffConfig: c, logs };
    }
    if (node.node_type === "end") {
      return { messages, vars, currentNodeKey: null, isEnded: true, logs };
    }
    key = c.next_node_key;
  }

  if (turns >= 40) throw fail("Flow exceeded 40 steps in one turn; check for an automatic loop");
  return { messages, vars, currentNodeKey: null, isEnded: true, logs };
}

async function execute(flow, input, state, initial, execution) {
  let result = step(flow, input, state, initial, { ...execution, live: true });
  let count = 0;
  const logs = [];

  while (true) {
    count += result.logs.length;
    if (count > 40) throw fail("Flow exceeded 40 steps in one turn; check for an automatic loop");
    if (execution.onVisit) await execution.onVisit(result.logs);
    await execution.onMessages(result.messages, result.vars);
    logs.push(...result.logs);
    if (!result.action) return { ...result, logs };

    const actionNode = result.action;
    const { config: c, node_type: nodeType } = actionNode;
    let next = nodeType === "api_webhook" ? (c.success_next || c.next_node_key) : c.next_node_key;

    try {
      const outputs = (await execution.onAction(actionNode, result.vars)) || {};
      if (outputs._jumped) {
        return { ...result, vars: result.vars, currentNodeKey: null, isEnded: true, jumped: true, logs };
      }

      if (Buffer.byteLength(JSON.stringify({ ...result.vars, ...outputs })) > 24576) {
        throw fail("Action outputs exceed the workflow memory limit");
      }

      const generatedMsg = outputs._generated_message;
      const detectedIntent = outputs._detected_intent;
      const cleanOutputs = { ...outputs };
      delete cleanOutputs._generated_message;
      delete cleanOutputs._detected_intent;
      delete cleanOutputs._jumped;

      Object.assign(result.vars, cleanOutputs, { "integration.status": "success" });

      if (generatedMsg && c.send_immediately !== false) {
        await execution.onMessages([{ sender: "bot", type: "text", text: generatedMsg }], result.vars);
      }

      if (nodeType === "crm_lookup") {
        next = cleanOutputs.record_found ? (c.found_next || c.next_node_key) : (c.not_found_next || c.next_node_key);
      } else if (nodeType === "ai_intent") {
        next = (detectedIntent && c.branches?.[detectedIntent]) || c.fallback_node || c.next_node_key;
      }
    } catch (error) {
      if (error.flowInterrupted) throw error;
      result.vars["integration.status"] = "failed";
      for (const name of Object.keys(c.outputs || {})) delete result.vars[name];
      if (c.output_variable) delete result.vars[c.output_variable];
      next = nodeType === "ai_intent"
        ? (c.error_next || c.fallback_node || c.next_node_key)
        : (c.error_next || (nodeType === "delay" || nodeType === "create_lead" || nodeType === "set_tag" ? c.next_node_key : null));
      if (!next) throw error;
    }

    result = step({ ...flow, entry_node_key: next }, "", null, result.vars, { ...execution, contact: initial, live: true });
  }
}

module.exports = {
  normalize,
  step,
  execute,
  options,
  interpolate,
  matchesKeywordList,
  matchesFlowTrigger,
  sortFlowsByPriority,
  parseTriggerConfig,
  SUPPORTED,
};
