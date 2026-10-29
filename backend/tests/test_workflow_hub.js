"use strict";
const assert = require("node:assert/strict");
const { normalize, step, execute } = require("../services/flowDefinition");
const integrations = require("../services/flowIntegrations");
const library = require("../services/industryFlowBlueprints");
const env = { WA_FLOW_CONNECTIONS: JSON.stringify({ 7: { business: { url: "https://business.example.test/actions", token: "server-secret", operations: ["appointments.booking_create"] } } }) };
const context = { tenantId: 7, conversationId: 10, runId: 20, messageId: "message-1", occurrence: 0 };
const draft = library.find(flow => flow.key === "appointments.booking_create");

async function main() {
  assert.equal(library.length, 55);
  assert.equal(new Set(library.map(flow => flow.category)).size, 10);
  assert.equal(library.filter(flow => flow.category === "Appointments").length, 10);
  assert.equal(new Set(library.map(flow => flow.key)).size, library.length);
  for (const blueprint of library) {
    const flow = normalize(blueprint, { publish: true });
    let result = step(flow);
    while (result.waiting) {
      const node = flow.nodes.find(n => n.node_key === result.currentNodeKey);
      const c = node.config;
      const answer = node.node_type === "send_buttons" ? "confirm" : c.validation === "date" ? "2026-12-15" : c.validation === "email" ? "person@example.test" : c.validation === "number" ? "4" : "Service request";
      result = step(flow, answer, result);
    }
    assert(result.isEnded && !result.isHandedOff, blueprint.key);
    assert(result.messages.some(message => message.text === "[Preview: result_message]"));
  }

  const flow = normalize(draft, { publish: true });
  let waiting = step(flow);
  for (const input of ["Haircut", "Central", "2026-12-15", "10:00"]) waiting = step(flow, input, waiting);
  assert.equal(waiting.currentNodeKey, "confirm");
  const calls = [];
  const request = async options => {
    calls.push(options);
    return { status: 200, data: { success: true, data: { message: "Booking confirmed: B-100" } } };
  };
  const run = integrations.createRunner({ request, env, resolve: integrations.connection });
  const delivered = [], visited = [];
  const result = await execute(flow, "confirm", waiting, {}, {
    onMessages: async messages => delivered.push(...messages.map(message => message.text)),
    onVisit: async keys => visited.push(...keys),
    onAction: (node, vars) => run(node, vars, context),
  });
  assert(result.isEnded && !result.isHandedOff);
  assert.deepEqual(delivered, ["Booking confirmed: B-100"]);
  assert(visited.includes("action") && visited.includes("end"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.inputs.service, "Haircut");
  assert(!Object.hasOwn(calls[0].data.inputs, "customer.email"));
  assert.equal(calls[0].headers.Authorization, "Bearer server-secret");
  assert.equal(calls[0].maxRedirects, 0);
  assert.equal(calls[0].timeout, 15000);
  const action = flow.nodes.find(node => node.node_key === "action");
  await run(action, waiting.vars, context);
  assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
  await run(action, waiting.vars, { ...context, runId: 21 });
  assert.notEqual(calls[0].headers["Idempotency-Key"], calls[2].headers["Idempotency-Key"]);
  await assert.rejects(run(action, waiting.vars, { ...context, tenantId: 8 }), /not configured/);
  assert.equal(calls.length, 3, "Tenant mismatch never sends credentials");
  await assert.rejects(run(action, {}, context), /missing workflow variable/);
  assert.equal(calls.length, 3, "Missing inputs never submit an external action");
  assert(step(flow,"confirm",waiting,{}, {previewActionError:true}).isHandedOff);

  for (const response of [{ status: 200, data: { success: false } }, { status: 200, data: { success: true, data: {} } }, { status: 302, data: {} }]) {
    const failing = integrations.createRunner({ request: async () => response, env, resolve: integrations.connection });
    const messages = [];
    const failed = await execute(flow, "confirm", waiting, {}, { onMessages: async batch => messages.push(...batch), onAction: (node, vars) => failing(node, vars, context) });
    assert(failed.isHandedOff);
    assert(!messages.some(message => message.text.includes("Booking confirmed")));
    assert.equal(failed.vars["integration.status"], "failed");
  }
  const cancelled = await execute(flow, "cancel", waiting, {}, { onMessages: async () => {}, onAction: async () => { throw new Error("Cancellation must never submit an action"); } });
  assert(cancelled.isEnded && !cancelled.isHandedOff);
  await assert.rejects(execute(flow, "confirm", waiting, {}, { onMessages: async () => {}, onAction: async () => { throw Object.assign(new Error("takeover"), { flowInterrupted: true }); } }), /takeover/);

  const switchFlow = normalize({ name: "Router", trigger_type: "manual", nodes: [
    { node_key: "start", node_type: "switch", config: { variable: "priority", cases: [{ operator: "greater_or_equal", value: "5", next_node_key: "urgent" }, { operator: "equals", value: "3", next_node_key: "normal" }], fallback_node_key: "other" } },
    { node_key: "urgent", node_type: "end", config: {} },
    { node_key: "normal", node_type: "end", config: {} },
    { node_key: "other", node_type: "handoff", config: {} },
  ] }, { publish: true });
  assert.deepEqual(step(switchFlow, "", null, { priority: 6 }).logs, ["start", "urgent"]);
  assert.deepEqual(step(switchFlow, "", null, { priority: 3 }).logs, ["start", "normal"]);
  assert(step(switchFlow, "", null, {}).isHandedOff);
  assert.throws(() => normalize({ ...switchFlow, nodes: switchFlow.nodes.map(node => node.node_key === "start" ? { ...node, config: { ...node.config, fallback_node_key: "missing" } } : node) }), /missing step/);
  assert.throws(() => integrations.validate({ ...action.config, outputs: { "customer.phone": "phone" } }), /own variable/);
  assert.throws(() => integrations.validate({ ...action.config, outputs: JSON.parse('{"__proto__":"message"}') }), /Invalid/);
  assert.throws(() => integrations.validate({ ...action.config, error_next: "" }, { publish: true }), /success and failure/);

  const cyclic = { ...flow, entry_node_key: "action", nodes: flow.nodes.map(node => node.node_key === "action" ? { ...node, config: { ...node.config, next_node_key: "action" } } : node) };
  let effects = 0;
  await assert.rejects(execute(cyclic, "", null, {}, { onMessages: async () => {}, onAction: async () => { effects++; return {}; } }), /40 steps/);
  assert.equal(effects, 40);
  console.log("PASS: 55 industry workflows, confirmation/cancellation, live action execution, output mapping, tenant boundaries, idempotency keys, failure routes, takeover, switch routes and bounded action loops");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
