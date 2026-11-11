"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const {
  normalize,
  step,
  execute,
  matchesFlowTrigger,
  sortFlowsByPriority,
} = require("../services/flowDefinition");
const integrations = require("../services/flowIntegrations");

async function main() {
  console.log("Running Enterprise n8n Flow Builder & Multi-Bot Engine verification...");

  // 1. Multi-Variable Assignments & Transforms (n8n Edit Fields / Set)
  const transformFlow = normalize(
    {
      name: "Dynamic Calculator Bot",
      trigger_type: "keyword",
      trigger_config: { keywords: ["calc"], match_mode: "exact", priority: 80 },
      nodes: [
        { node_key: "start", node_type: "keyword_trigger", config: { next_node_key: "set_fields" } },
        {
          node_key: "set_fields",
          node_type: "set_variable",
          config: {
            assignments: [
              { key: "upper_name", value: "{{customer.name}}", transform: "uppercase" },
              { key: "discounted", value: "{{base_amount}}", transform: "number_subtract", arg: "250" },
              { key: "followup_day", value: "2026-11-10", transform: "date_offset_days", arg: "5" },
              { key: "tier", value: "", transform: "fallback_default", arg: "Standard" },
            ],
            next_node_key: "reply",
          },
        },
        {
          node_key: "reply",
          node_type: "send_message",
          config: { text: "Hi {{upper_name}}, Total: {{discounted}}, Date: {{followup_day}}, Tier: {{tier}}", next_node_key: "end" },
        },
        { node_key: "end", node_type: "end", config: {} },
      ],
    },
    { publish: true }
  );

  const simTransform = step(transformFlow, "", null, { "customer.name": "arun", base_amount: "1000" });
  assert.equal(simTransform.isEnded, true);
  assert.equal(simTransform.messages[0].text, "Hi ARUN, Total: 750, Date: 2026-11-15, Tier: Standard");
  console.log("  [PASS 1] Multi-variable transforms (uppercase, math, date offset, fallback)");

  // 2. Full n8n HTTP Request / API Webhook Runner (Auth, Query, Body, Retries, Response Mapping, SSRF Guard)
  let attempts = 0;
  let capturedReq = null;
  const webhookRunner = integrations.createWebhookRunner({
    skipDnsCheck: true,
    request: async (opts) => {
      attempts++;
      capturedReq = opts;
      if (attempts === 1) throw new Error("Transient 502 error");
      return {
        status: 200,
        data: { success: true, data: { order: { status: "Shipped", eta: "2 days" } } },
      };
    },
  });

  const webhookNode = {
    node_key: "fetch_order",
    node_type: "api_webhook",
    config: {
      method: "POST",
      url: "https://orders.example.test/api/lookup",
      auth_type: "bearer",
      auth_token: "secret-api-token",
      query_params: { ref: "{{customer.phone}}" },
      headers: { "X-Client": "MadhuraCRM" },
      body_type: "json",
      body: '{"orderId":"{{order_id}}"}',
      retry_count: 1,
      timeout_ms: 5000,
      response_mapping: { order_status: "data.order.status", eta: "data.order.eta" },
      next_node_key: "done",
      error_next: "fail",
    },
  };

  const webhookOutputs = await webhookRunner(
    webhookNode,
    { "customer.phone": "919876543210", order_id: "ORD-99" },
    { tenantId: 1, runId: 10, messageId: "msg-1", occurrence: 0 }
  );
  assert.equal(attempts, 2, "Webhook should retry once after failure");
  assert.equal(capturedReq.method, "POST");
  assert(capturedReq.url.includes("ref=919876543210"));
  assert.equal(capturedReq.headers.Authorization, "Bearer secret-api-token");
  assert.equal(capturedReq.headers["X-Client"], "MadhuraCRM");
  assert.deepEqual(capturedReq.data, { orderId: "ORD-99" });
  assert.equal(webhookOutputs.order_status, "Shipped");
  assert.equal(webhookOutputs.eta, "2 days");
  assert.equal(webhookOutputs.webhook_status, "success");

  // SSRF Guard Verification (live DNS check enabled)
  const ssrfRunner = integrations.createWebhookRunner({ request: async () => ({ status: 200, data: {} }) });
  await assert.rejects(
    () => ssrfRunner({ ...webhookNode, config: { ...webhookNode.config, url: "https://127.0.0.1/secret" } }, {}, {}),
    /SSRF|public address|blocked/i
  );
  await assert.rejects(
    () => ssrfRunner({ ...webhookNode, config: { ...webhookNode.config, url: "https://169.254.169.254/latest/meta-data" } }, {}, {}),
    /SSRF|public address|blocked/i
  );
  console.log("  [PASS 2] HTTP Webhook auth, query/body interpolation, retries, JSON path extraction & SSRF guard");

  // 3. Preview Simulation of Restored n8n Nodes (api_webhook -> ai_intent -> crm_lookup -> set_tag -> jump_to_flow)
  const n8nGraph = normalize(
    {
      name: "Full Enterprise Router",
      trigger_type: "keyword",
      trigger_config: { keywords: ["support", "help"], match_mode: "contains" },
      nodes: [
        { node_key: "start", node_type: "start", config: { next_node_key: "hook" } },
        { node_key: "hook", node_type: "api_webhook", config: { method: "GET", url: "https://api.example.test/status", response_mapping: { tier: "tier" }, next_node_key: "crm", error_next: "err_msg" } },
        { node_key: "crm", node_type: "crm_lookup", config: { lookup_type: "invoice", found_next: "intent", not_found_next: "err_msg" } },
        { node_key: "intent", node_type: "ai_intent", config: { branches: { sales: "tag_hot", support: "hand" }, fallback_node: "hand" } },
        { node_key: "tag_hot", node_type: "set_tag", config: { tag: "Hot Lead", next_node_key: "ok_msg" } },
        { node_key: "ok_msg", node_type: "send_message", config: { text: "Tier={{tier}}, Invoice={{invoice_no}}", next_node_key: "end" } },
        { node_key: "err_msg", node_type: "send_message", config: { text: "Webhook Error Route", next_node_key: "end" } },
        { node_key: "hand", node_type: "handoff", config: { note: "Agent assigned" } },
        { node_key: "end", node_type: "end", config: {} },
      ],
    },
    { publish: true }
  );

  const okWalk = step(n8nGraph, "help me", null, {});
  assert.equal(okWalk.isEnded, true);
  assert.equal(okWalk.messages[0].text, "Tier=[Preview: tier], Invoice=INV-2026-088");
  const errWalk = step(n8nGraph, "help me", null, {}, { previewActionError: true });
  assert.equal(errWalk.messages[0].text, "Webhook Error Route");
  console.log("  [PASS 3] Restored n8n nodes (webhook, crm_lookup, ai_intent, set_tag) simulate & route cleanly");

  // 4. Multi-Bot Trigger Rules: Keyword Match Modes, Sender Scoping, Priority Order & Human-Pause Wakeup
  const flowKeywordHigh = {
    id: 101,
    trigger_type: "keyword",
    trigger_config: { keywords: ["pricing", "quote"], match_mode: "contains", priority: 90, sender_ids: ["5"] },
  };
  const flowKeywordExact = {
    id: 102,
    trigger_type: "keyword",
    trigger_config: { keywords: ["^vip-\\d+$"], match_mode: "regex", priority: 70, allow_restart_after_human: true },
  };
  const flowWelcome = {
    id: 103,
    trigger_type: "first_inbound",
    trigger_config: { priority: 60 },
  };
  const flowGlobalCatchAll = {
    id: 104,
    trigger_type: "all_inbound",
    trigger_config: { priority: 40, sender_scope: "all" },
  };

  const sorted = sortFlowsByPriority([flowGlobalCatchAll, flowWelcome, flowKeywordExact, flowKeywordHigh]);
  assert.deepEqual(sorted.map((f) => f.id), [101, 102, 103, 104], "Keyword (P90 > P70) > first_inbound > all_inbound");

  assert.equal(matchesFlowTrigger(flowKeywordHigh, "send pricing sheet", { senderId: 5 }), true);
  assert.equal(matchesFlowTrigger(flowKeywordHigh, "send pricing sheet", { senderId: 9 }), false, "Respects sender_ids scoping");
  assert.equal(matchesFlowTrigger(flowKeywordExact, "VIP-405", { senderId: 9 }), true, "Regex match works");
  assert.equal(matchesFlowTrigger(flowKeywordExact, "vip access", { senderId: 9 }), false);
  assert.equal(matchesFlowTrigger(flowWelcome, "hello", { isNew: true }), true);
  assert.equal(matchesFlowTrigger(flowWelcome, "hello", { isNew: false }), false);
  assert.equal(matchesFlowTrigger(flowGlobalCatchAll, "random chat", { senderId: 9 }), true);
  console.log("  [PASS 4] Priority sorting, regex/contains match modes & number-scoped Global/Separate triggers");

  // 5. Shared Runtime End-to-End Test: allow_restart_after_human & Global catch-all vs Keyword switch
  const filename = path.resolve(__dirname, "../services/sharedFlowRuntime.js");
  const realRequire = createRequire(filename);
  const fGlobal = normalize(
    {
      id: 201,
      name: "Global Bot",
      trigger_type: "all_inbound",
      trigger_config: { priority: 40 },
      nodes: [
        { node_key: "start", node_type: "send_message", config: { text: "Global Welcome!", next_node_key: "ask" } },
        { node_key: "ask", node_type: "collect_input", config: { prompt_text: "How can we help?", var_key: "q", validation_type: "none", next_node_key: "end" } },
        { node_key: "end", node_type: "end", config: {} },
      ],
    },
    { publish: true }
  );
  const fWake = normalize(
    {
      id: 202,
      name: "Menu Keyword Bot",
      trigger_type: "keyword",
      trigger_config: { keywords: ["menu"], match_mode: "exact", allow_restart_after_human: true, priority: 90 },
      nodes: [
        { node_key: "start", node_type: "send_message", config: { text: "Menu Restarted!", next_node_key: "end" } },
        { node_key: "end", node_type: "end", config: {} },
      ],
    },
    { publish: true }
  );

  const conv = {
    id: 42,
    tenant_id: 1,
    sender_id: 3,
    branch_id: 1,
    contact_id: 9,
    owner_user_id: 1,
    contact_name: "Arun",
    contact_phone: "919999988888",
    contact_email: "arun@example.test",
    status: "open",
    automation_mode: "human",
    automation_version: 2, // human previously replied!
    service_window_expires_at: new Date(Date.now() + 86400000),
  };

  let seq = 0;
  const delivered = [];
  const runtimeQueries = async (sql, params = []) => {
    if (sql.startsWith("SELECT c.*")) return [[{ ...conv }]];
    if (sql.includes("FROM wa_flows f JOIN wa_flow_versions v")) {
      return [
        [
          { ...fGlobal, id: 201, nodes_snapshot: JSON.stringify(fGlobal.nodes) },
          { ...fWake, id: 202, nodes_snapshot: JSON.stringify(fWake.nodes) },
        ],
      ];
    }
    if (sql.startsWith("SELECT id FROM wa_flows")) return [[{ id: 1 }]];
    if (sql.startsWith("UPDATE conversations SET automation_mode='flow'")) {
      if (Number(params[2]) !== conv.automation_version) return [{ affectedRows: 0 }];
      conv.automation_mode = "flow";
      conv.automation_version++;
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("UPDATE conversations SET automation_mode=?")) {
      conv.automation_mode = params[0];
      conv.automation_version++;
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("INSERT INTO wa_flow_runs")) return [{ insertId: ++seq, affectedRows: 1 }];
    return [{ affectedRows: 1 }];
  };

  const mocks = {
    "../config/database": { promise: () => ({ query: runtimeQueries }) },
    "./sharedInboxAssistant": { schedule: (_t, _id, work) => Promise.resolve().then(work), generate: async () => "AI ok" },
    "./sharedInboxService": { createInboxService: () => ({ emit: async () => {} }) },
    "../sockets/chatsockets": { getIO: () => null },
    "./waConfigHelper": {
      cloudClientForTenantSender: async () => ({
        sendText: async (_p, msgText) => {
          delivered.push(msgText);
          return { messages: [{ id: `wamid.${delivered.length}` }] };
        },
      }),
    },
  };
  const mod = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(filename, "utf8"),
    { module: mod, exports: mod.exports, require: (n) => (Object.hasOwn(mocks, n) ? mocks[n] : realRequire(n)), Date, Buffer, console, setInterval: () => ({ unref() {} }) },
    { filename }
  );

  // Regular random message when human previously paused MUST NOT trigger Global Catch-All bot
  const ignored = await mod.exports.handle(1, 3, "m1", "random message", false);
  assert.equal(ignored, false, "Global bot stays muted after human takeover");

  // Explicit keyword bot WITH allow_restart_after_human=true MUST wake up cleanly!
  const woken = await mod.exports.handle(1, 3, "m2", "menu", false);
  assert.equal(woken, true, "Keyword bot with allow_restart_after_human wakes cleanly");
  assert.deepEqual(delivered, ["Menu Restarted!"]);
  console.log("  [PASS 5] Runtime respects human pause for global bot & allows explicit keyword restart when enabled");

  console.log("\nALL ENTERPRISE N8N FLOW BUILDER & MULTI-BOT TESTS PASSED!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

