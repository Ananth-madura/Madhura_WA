export const flowLabel = node => typeof node.config?._editor?.label === "string" && node.config._editor.label.trim() ? node.config._editor.label : node.node_type.replaceAll("_", " ");

export function flowPorts(node) {
  const cfg = node.config || {};
  const ports = [];
  const add = (id, label, path, target = "", button = false) => ports.push({ id, label, path, target, button });
  if (["end", "handoff"].includes(node.node_type)) return ports;
  if (node.node_type === "switch") {
    (cfg.cases || []).forEach((route, index) => add(`case_${index}`, route.label || `Route ${index + 1}`, ["cases", index, "next_node_key"], route.next_node_key));
    add("fallback", "Otherwise", ["fallback_node_key"], cfg.fallback_node_key);
  } else if (["business_action", "ai_reply"].includes(node.node_type)) {
    add("success", "Success", ["next_node_key"], cfg.next_node_key);
    add("error", "Failure", ["error_next"], cfg.error_next);
  } else if (node.node_type === "condition") {
    add("true", "Yes", ["true_next"], cfg.true_next);
    add("false", "No", ["false_next"], cfg.false_next);
  } else if(node.node_type==="business_hours"){
    add("open","Open",["open_next"],cfg.open_next);
    add("closed","Closed",["closed_next"],cfg.closed_next);
  } else if (node.node_type === "ai_intent") {
    Object.entries(cfg.branches || {}).forEach(([name, target]) => add(name, name, ["branches", name], target));
  } else if (node.node_type === "crm_lookup") {
    add("found", "Found", ["found_next"], cfg.found_next);
    add("missing", "Not found", ["not_found_next"], cfg.not_found_next);
    if (cfg.next_node_key) add("next", "Next", ["next_node_key"], cfg.next_node_key);
  } else if (node.node_type === "interactive_menu") {
    if (cfg.sections?.length) cfg.sections.forEach((section, s) => (section.buttons || []).forEach((button, b) => add(`s${s}b${b}`, button.label || button.title || `Option ${b + 1}`, ["sections", s, "buttons", b], button.next_node_key || button.nextNodeId, true)));
    else (cfg.buttons || []).forEach((button, b) => add(`b${b}`, button.label || button.title || `Option ${b + 1}`, ["buttons", b], button.next_node_key || button.nextNodeId, true));
  } else if (["send_buttons", "send_list"].includes(node.node_type)) {
    const key = node.node_type === "send_list" && cfg.rows ? "rows" : "buttons";
    (cfg[key] || []).forEach((button, b) => add(`b${b}`, button.title || button.label || `Option ${b + 1}`, [key, b], button.next_node_key || button.nextNodeId, true));
  } else add("next", "Next", ["next_node_key"], cfg.next_node_key);
  if(node.node_type==="collect_input")add("invalid","Invalid after retries",["invalid_next"],cfg.invalid_next);
  return ports;
}

export function setFlowPort(node, port, target) {
  const config = JSON.parse(JSON.stringify(node.config || {}));
  let cursor = config;
  port.path.slice(0, -1).forEach((key, i) => { cursor[key] ??= typeof port.path[i + 1] === "number" ? [] : {}; cursor = cursor[key]; });
  const key = port.path[port.path.length - 1];
  if (port.button) cursor[key] = { ...cursor[key], next_node_key: target, nextNodeId: target };
  else cursor[key] = target;
  if (node.node_type === "send_list" && config.rows) config.buttons = config.rows;
  return { ...node, config };
}

export function removeFlowNodes(nodes, keys) {
  return nodes.filter(node => !keys.has(node.node_key)).map(node => flowPorts(node).reduce((current, port) => keys.has(port.target) ? setFlowPort(current, port, "") : current, node));
}

export function duplicateFlowNodes(nodes, selection, offset = { x: 64, y: 64 }) {
  const used = new Set(nodes.map(node => node.node_key));
  const mapping = {};
  selection.forEach(node => {
    let key = `${node.node_key}_copy`, index = 2;
    while (used.has(key)) key = `${node.node_key}_copy_${index++}`;
    used.add(key); mapping[node.node_key] = key;
  });
  return selection.map(original => {
    let node = JSON.parse(JSON.stringify(original));
    node.node_key = mapping[original.node_key];
    node.position_x = (Number(node.position_x) || 0) + offset.x;
    node.position_y = (Number(node.position_y) || 0) + offset.y;
    flowPorts(node).forEach(port => { node = setFlowPort(node, port, mapping[port.target] || ""); });
    return node;
  });
}

export function parseFlowImport(text, allowedTypes) {
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a JSON flow object.");
  if (value.name != null && typeof value.name !== "string") throw new Error("The flow name must be text.");
  if (value.description != null && typeof value.description !== "string") throw new Error("The description must be text.");
  if (value.trigger_config?.keywords != null && (!Array.isArray(value.trigger_config.keywords) || value.trigger_config.keywords.some(keyword => typeof keyword !== "string"))) throw new Error("Trigger keywords must be an array of text values.");
  if (!Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > 100) throw new Error("Choose a flow JSON file containing between 1 and 100 steps.");
  const keys = new Set();
  const nodes = value.nodes.map((node, index) => {
    if (typeof node.node_key !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(node.node_key) || keys.has(node.node_key)) throw new Error(`Step ${index + 1} needs a unique key containing letters, numbers, hyphens or underscores.`);
    if (!allowedTypes.has(node.node_type)) throw new Error(`Unsupported step type: ${node.node_type}`);
    if (!node.config || typeof node.config !== "object" || Array.isArray(node.config)) throw new Error(`Invalid configuration for ${node.node_key}.`);
    keys.add(node.node_key);
    return { node_key: node.node_key, node_type: node.node_type, config: node.config, position_x: Number.isFinite(Number(node.position_x)) ? Number(node.position_x) : index * 240, position_y: Number.isFinite(Number(node.position_y)) ? Number(node.position_y) : 160 };
  });
  if (value.entry_node_key && !keys.has(value.entry_node_key)) throw new Error("The entry step is missing from the imported graph.");
  for (const node of nodes) for (const port of flowPorts(node)) if (port.target && !keys.has(port.target)) throw new Error(`The route from ${node.node_key} points to missing step ${port.target}.`);
  return { ...value, nodes };
}
