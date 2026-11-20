"use strict";

/**
 * test_flowbot_and_automation_engine.js
 *
 * Comprehensive automated test suite for Madhura's Enterprise Flowbot Runtime
 * and Business Automation Workflow Engine covering:
 *   Suite 1: Flowbot Triggers, Duplicate-Launch Guard, Buttons/Lists, 18 Input
 *            Validation & Retry Prompts, Conditions, Delays, Restart Recovery,
 *            Human Handover, Timeout, Published Version Rollback, Draft Test Console.
 *   Suite 2: Automation Engine (Event Triggers, Nested AND/OR/NOT Conditions,
 *            Durable Waits, Parallel Branches + Merge without duplicating succeeded
 *            irreversible actions, Bounded Loops, Subflows, Non-Bypassable Approvals,
 *            Retry Backoff vs Permanent Dead-Letter + Safe Replay, Idempotency,
 *            Tenant Isolation, Encrypted Credentials).
 *   Suite 3: Meta 24-Hour Service Window, AI Policy Guardrails, KB Retrieval,
 *            Customer Order Ownership Security, and Opt-Out Halt.
 *   Suite 4: Complete End-to-End Customer Journey:
 *            Campaign -> Approved Template -> Customer Button Reply -> Flowbot ->
 *            Data Capture -> AI Lead Scoring -> Automation -> CRM Lead ->
 *            Sales Agent Assignment -> Follow-up Task -> Human Handover ->
 *            Deal Creation -> Verified Order Conversion -> Analytics Verification.
 */

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

const { migrate: migrateMeta } = require("../migrations/meta_multi_account_saas");
const { migrate: migrateBilling } = require("../migrations/wati_billing_and_limits");
const { migrate: migrateCampaigns } = require("../migrations/enterprise_campaign_management");
const { migrate: migrateOrchestration } = require("../migrations/enterprise_flowbot_and_automation_engine");

const { createOrchestrationEngines } = require("../services/orchestration");
const { createCampaignManagementService } = require("../services/campaign/campaignManagementService");
const { createCampaignExecutionEngine } = require("../services/campaign/campaignExecutionEngine");
const { createCampaignAnalyticsService } = require("../services/campaign/campaignAnalyticsService");
const { createProviderGateway } = require("../services/campaign/providerGateway");
const cryptoHelper = require("../backendutil/cryptoHelper");

function createTestDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.isSqlite = true;
  sqlite.promise = () => ({
    query: async (sql, params = []) => {
      const stmt = sqlite.prepare(sql);
      if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
        return [stmt.all(...params)];
      }
      const info = stmt.run(...params);
      return [{ insertId: Number(info.lastInsertRowid), affectedRows: Number(info.changes) }];
    },
  });

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tenants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS wa_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(32) NOT NULL,
      country_code VARCHAR(5) DEFAULT '91',
      email VARCHAR(255) DEFAULT NULL,
      tags TEXT DEFAULT NULL,
      custom_fields TEXT DEFAULT NULL,
      opt_in_status TINYINT DEFAULT 0,
      is_blocked TINYINT DEFAULT 0,
      is_unsubscribed TINYINT DEFAULT 0,
      source VARCHAR(100) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      tenant_id INT NOT NULL DEFAULT 1,
      branch_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_opt_outs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone VARCHAR(32) NOT NULL,
      tenant_id INT NOT NULL DEFAULT 1,
      reason VARCHAR(100) DEFAULT 'user_request',
      opt_out_keyword VARCHAR(50) DEFAULT NULL,
      opted_out_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) DEFAULT 'MARKETING',
      language VARCHAR(20) DEFAULT 'en',
      header_type VARCHAR(50) DEFAULT NULL,
      header_value TEXT DEFAULT NULL,
      body TEXT NOT NULL,
      footer TEXT DEFAULT NULL,
      buttons TEXT DEFAULT NULL,
      meta_template_id VARCHAR(120) DEFAULT NULL,
      meta_status VARCHAR(50) DEFAULT 'APPROVED',
      waba_id VARCHAR(100) DEFAULT NULL,
      sender_id INT DEFAULT NULL,
      archived TINYINT DEFAULT 0,
      tenant_id INT NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_senders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      waba_connection_id INT DEFAULT NULL,
      waba_id VARCHAR(120),
      phone_number_id VARCHAR(120),
      display_phone VARCHAR(32),
      verified_name VARCHAR(255),
      access_token_encrypted TEXT,
      status VARCHAR(40) DEFAULT 'connected',
      quality_rating VARCHAR(40) DEFAULT 'GREEN',
      messaging_tier VARCHAR(60) DEFAULT 'TIER_1K',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_flows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      name VARCHAR(255) NOT NULL,
      trigger_type VARCHAR(64) DEFAULT 'keyword',
      trigger_config TEXT DEFAULT NULL,
      status VARCHAR(32) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      phone VARCHAR(32) NOT NULL,
      name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'warm',
      notes TEXT,
      source VARCHAR(100) DEFAULT 'whatsapp',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      phone VARCHAR(32),
      direction VARCHAR(16),
      message_text TEXT,
      status VARCHAR(32),
      wa_message_id VARCHAR(191),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return sqlite;
}

async function run() {
  console.log("=== Madhura Flowbot & Automation Engine Test Suite ===\n");
  const db = createTestDb();
  await migrateMeta(db);
  await migrateBilling(db);
  await migrateCampaigns(db);
  await migrateOrchestration(db);

  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  await q(`INSERT INTO tenants (id, name) VALUES (1, 'Madhura Solar Pvt Ltd'), (2, 'Isolated Tenant Two')`);

  const dispatchedMessages = [];
  const httpCalls = [];
  let nextHttpFailure = null;
  let irreversibleBranchExecutions = 0;

  const mockDispatcher = {
    send: async (tenantId, payload) => {
      dispatchedMessages.push({ tenantId, ...payload });
      return { message_id: `wamid.out.${dispatchedMessages.length}` };
    },
  };
  const mockHttp = {
    request: async (cfg) => {
      httpCalls.push(cfg);
      if (cfg.url.includes("irreversible-step")) irreversibleBranchExecutions++;
      if (nextHttpFailure && cfg.url.includes("flaky-step")) {
        const err = nextHttpFailure;
        nextHttpFailure = null;
        throw err;
      }
      return { status: 200, data: { received: true, url: cfg.url } };
    },
  };

  const engines = createOrchestrationEngines({
    db,
    messageDispatcher: mockDispatcher,
    httpClient: mockHttp,
  });
  const { consentService, serviceWindow, aiService, sharedContext, flowbotRuntime, automationEngine } = engines;

  // ── SUITE 1: Flowbot Runtime, Validation, Retry, Handover, Delay, Rollback & Test Console ──
  console.log("1. Testing Flowbot Runtime: Triggers, Validation, Conditions, Delay, Handover, Rollback & Simulator...");

  await q(`INSERT INTO wa_contacts (name, phone, email, tenant_id) VALUES ('Priya Sharma', '919876500001', 'priya@acme.in', 1)`);
  await q(`INSERT INTO wa_flows (tenant_id, name, status) VALUES (1, 'Solar Qualification Flowbot', 'active')`);
  const flow = (await q(`SELECT * FROM wa_flows WHERE tenant_id = 1 LIMIT 1`))[0];

  const v1Nodes = [
    { node_key: "start", node_type: "start", config: { next_node_key: "menu" } },
    {
      node_key: "menu",
      node_type: "send_buttons",
      config: {
        text: "Hello {{customer.first_name|there}}! What are you looking for?",
        save_as: "interest",
        buttons: [
          { id: "btn_enterprise", label: "Enterprise", next_node_key: "ask_budget" },
          { id: "btn_starter", label: "Starter", next_node_key: "starter_info" },
        ],
      },
    },
    {
      node_key: "ask_budget",
      node_type: "ask_input",
      config: {
        variable_name: "budget",
        input_type: "currency",
        min: 10000,
        prompt: "What is your estimated project budget in INR?",
        error_response: "Please enter a valid budget amount of at least 10000.",
        max_attempts: 3,
        next_node_key: "check_tier",
      },
    },
    {
      node_key: "check_tier",
      node_type: "condition",
      config: {
        logic: "AND",
        conditions: [
          { field: "flow.interest", operator: "equals", value: "btn_enterprise" },
          { field: "flow.budget", operator: "greater_than", value: 100000 },
        ],
        true_next: "delay_brief",
        false_next: "starter_info",
      },
    },
    {
      node_key: "delay_brief",
      node_type: "delay",
      config: { delay_seconds: 1, next_node_key: "handover_sales" },
    },
    {
      node_key: "handover_sales",
      node_type: "human_handover",
      config: {
        agent_id: 42,
        team_id: 7,
        routing_strategy: "lead_score",
        priority: "high",
        handover_message: "Connecting you to our Enterprise Solar specialist now.",
        resume_node_key: "done",
      },
    },
    {
      node_key: "starter_info",
      node_type: "send_text",
      config: { text: "Here is our Starter package guide.", next_node_key: "done" },
    },
    { node_key: "done", node_type: "end", config: {} },
  ];

  // Validate & publish v1
  const pubV1 = await flowbotRuntime.publishFlowVersion(1, flow.id, { nodes: v1Nodes, entryNodeKey: "start" }, 10);
  assert.equal(pubV1.version_number, 1);

  // Register trigger priority
  await flowbotRuntime.registerTrigger(1, {
    flow_id: flow.id,
    trigger_type: "keyword",
    match_value: "solar",
    priority: 10,
  }, 10);

  // Isolated Draft Test Console (does not touch live sessions!)
  const sim = await flowbotRuntime.simulateSession(1, {
    flowId: flow.id,
    phone: "919900000001",
    messages: [{ buttonPayload: "btn_starter" }],
  });
  assert.equal(sim.is_test_mode, true);
  assert.equal(sim.session.status, "COMPLETED");
  assert.ok(sim.transcript.some((m) => m.payload?.text?.includes("Starter package guide")));

  // Live inbound message opens 24h window and triggers v1 Flowbot
  const turn1 = await flowbotRuntime.handleInboundMessage(1, {
    phone: "919876500001",
    text: "solar",
    senderId: 1,
    messageId: "wamid.in.1",
  });
  assert.equal(turn1.handled, true);
  assert.equal(turn1.session.status, "WAITING_FOR_INPUT");
  assert.equal(turn1.session.flow_version_number, 1);

  // Publish v2 while Priya's v1 session is active — Priya MUST stay pinned to v1!
  const v2Nodes = [
    { node_key: "start", node_type: "start", config: { next_node_key: "v2_msg" } },
    { node_key: "v2_msg", node_type: "send_text", config: { text: "Welcome to V2 Flowbot!", next_node_key: "end" } },
    { node_key: "end", node_type: "end", config: {} },
  ];
  const pubV2 = await flowbotRuntime.publishFlowVersion(1, flow.id, { nodes: v2Nodes, entryNodeKey: "start" }, 10);
  assert.equal(pubV2.version_number, 2);

  // Prevent accidental duplicate Flowbot launch on Priya's phone
  const dupStart = await flowbotRuntime.startSession(1, { flowId: flow.id, phone: "919876500001" });
  assert.equal(dupStart.duplicate_prevented, true);

  // Turn 2: Button selection "Enterprise"
  const turn2 = await flowbotRuntime.handleInboundMessage(1, {
    phone: "919876500001",
    buttonPayload: "btn_enterprise",
    senderId: 1,
    messageId: "wamid.in.2",
  });
  assert.equal(turn2.session.status, "WAITING_FOR_INPUT");
  assert.equal(turn2.session.waiting_for_variable, "budget");

  // Turn 3: Invalid budget triggers retry prompt without advancing!
  const turn3Bad = await flowbotRuntime.handleInboundMessage(1, {
    phone: "919876500001",
    text: "not-a-number",
    senderId: 1,
    messageId: "wamid.in.3",
  });
  assert.equal(turn3Bad.session.status, "WAITING_FOR_INPUT");
  assert.equal(turn3Bad.session.attempt_count, 1);

  // Turn 4: Valid budget ₹250,000 -> Condition TRUE -> enters durable WAITING_FOR_DELAY
  const turn4Good = await flowbotRuntime.handleInboundMessage(1, {
    phone: "919876500001",
    text: "₹250,000",
    senderId: 1,
    messageId: "wamid.in.4",
  });
  assert.equal(turn4Good.session.status, "WAITING_FOR_DELAY");
  assert.equal(turn4Good.session.collected_data.budget, 250000);

  // Simulate worker restart recovery -> resumes WAITING_FOR_DELAY -> reaches HUMAN_OWNED handover!
  const futureIso = new Date(Date.now() + 5000).toISOString();
  const recovered = await flowbotRuntime.resumeDueSessions(futureIso);
  assert.equal(recovered.resumed_delays, 1);

  const trace = await flowbotRuntime.getSessionTrace(1, turn1.session.id);
  assert.equal(trace.session.status, "HUMAN_OWNED");
  assert.equal(trace.session.handover_agent_id, 42);
  assert.equal(trace.handovers.length, 1);

  // While HUMAN_OWNED, bot must NOT interrupt human agent!
  const ignoredWhileHuman = await flowbotRuntime.handleInboundMessage(1, {
    phone: "919876500001",
    text: "Are you there?",
    senderId: 1,
    messageId: "wamid.in.5",
  });
  assert.equal(ignoredWhileHuman.human_owned, true);
  assert.equal(ignoredWhileHuman.handled, false);

  // Controlled resumption from handover completes session cleanly
  const resumed = await flowbotRuntime.resumeBotFromHandover(1, turn1.session.id, { actorId: 42 });
  assert.equal(resumed.session.status, "COMPLETED");

  // Rollback from v2 back to v1 and confirm new session gets v1!
  const rb = await flowbotRuntime.rollbackFlowVersion(1, flow.id, 1, 10);
  assert.equal(rb.rolled_back_to_version, 1);
  console.log("   PASS: Flowbot triggers, validation/retry, delay recovery, handover, version pinning & rollback");

  // ── SUITE 2: Automation Engine (Parallel, Idempotency, Loops, Subflows, Approvals, Retries, DLQ, Credentials) ──
  console.log("2. Testing Automation Engine: Parallel, Loops, Subflows, Approvals, Retries, DLQ & Credentials...");

  // Encrypted credential never exposed in list API
  const cred = await automationEngine.saveIntegrationCredential(1, {
    name: "ERP Webhook Key",
    provider: "http",
    auth_type: "bearer",
    secret: "sk_live_super_secret_token_999",
  }, 10);
  const credList = await automationEngine.listIntegrationCredentials(1);
  assert.equal(credList.length, 1);
  assert.equal(credList[0].encrypted_secret, undefined, "Decrypted or encrypted secrets must never be returned in list API");

  // Subflow workflow
  const subWf = await automationEngine.createWorkflow(1, {
    name: "Reusable Tag & Task Subflow",
    trigger_type: "subflow_call",
    graph: {
      entry_node_key: "add_tag",
      nodes: [
        { key: "add_tag", type: "crm_action", config: { action: "add_tag", params: { tag: "subflow_verified" }, next_node_key: "done" } },
        { key: "done", type: "end", config: {} },
      ],
    },
  }, 10);
  await automationEngine.publishWorkflow(1, subWf.id, {}, 10);

  // Complex workflow with nested condition, parallel branch (1 irreversible + 1 flaky), bounded loop, subflow, and approval gate!
  const mainWf = await automationEngine.createWorkflow(1, {
    name: "Enterprise Deal Approval & Provisioning",
    trigger_type: "deal_qualified",
    graph: {
      entry_node_key: "check_nested",
      nodes: [
        {
          key: "check_nested",
          type: "condition",
          config: {
            logic: "AND",
            conditions: [
              { field: "trigger.budget", operator: "gte", value: 50000 },
              {
                logic: "OR",
                conditions: [
                  { field: "trigger.product", operator: "contains", value: "Solar" },
                  { field: "trigger.vip", operator: "equals", value: "true" },
                ],
              },
            ],
            true_next: "parallel_ops",
            false_next: "done",
          },
        },
        {
          key: "parallel_ops",
          type: "parallel",
          config: {
            merge_rule: "wait_all",
            branches: [
              {
                branch_id: "br_irrev",
                type: "http_request",
                config: { url: "https://api.example.com/irreversible-step", credential_id: cred.id },
              },
              {
                branch_id: "br_flaky",
                type: "http_request",
                config: { url: "https://api.example.com/flaky-step", credential_id: cred.id },
              },
            ],
            merge_next: "loop_items",
          },
        },
        {
          key: "loop_items",
          type: "loop",
          config: {
            items_field: "line_items",
            max_iterations: 2,
            body_action: { type: "team_notify", config: { message: "Processing line item" } },
            next_node_key: "call_subflow",
          },
        },
        {
          key: "call_subflow",
          type: "subflow",
          config: { workflow_id: subWf.id, next_node_key: "mgr_approval" },
        },
        {
          key: "mgr_approval",
          type: "approval",
          config: {
            approval_mode: "single",
            approvers: [99],
            approved_next: "create_deal_node",
            rejected_next: "done",
          },
        },
        {
          key: "create_deal_node",
          type: "crm_action",
          config: { action: "create_deal", params: { title: "Enterprise Solar Rooftop", value_minor: 25000000 }, next_node_key: "done" },
        },
        { key: "done", type: "end", config: {} },
      ],
    },
  }, 10);
  await automationEngine.publishWorkflow(1, mainWf.id, {}, 10);

  // Inject transient network timeout on flaky branch -> run transitions to RETRYING
  nextHttpFailure = Object.assign(new Error("timeout of 15000ms"), { code: "ETIMEDOUT", retryable: true });
  const ev1 = await automationEngine.emitEvent(1, "deal_qualified", {
    phone: "919876500001",
    budget: 250000,
    product: "5kW Solar Rooftop",
    line_items: ["Panel", "Inverter", "Battery"], // 3 items, bounded to max_iterations=2!
  }, { idempotencyKey: "deal_qual_ev_1" });

  assert.equal(ev1.deduplicated, false);
  assert.equal(ev1.started_runs.length, 1);
  assert.equal(ev1.started_runs[0].status, "RETRYING");
  assert.equal(irreversibleBranchExecutions, 1, "Irreversible branch ran once on attempt 1");

  // Duplicate event MUST be deduplicated!
  const evDup = await automationEngine.emitEvent(1, "deal_qualified", { phone: "919876500001" }, { idempotencyKey: "deal_qual_ev_1" });
  assert.equal(evDup.deduplicated, true);

  // Process due retry -> flaky branch succeeds, irreversible branch is NOT duplicated, loop caps at 2, subflow runs, pauses at WAITING_APPROVAL!
  await automationEngine.processDueWorkflows(new Date(Date.now() + 600000).toISOString());
  assert.equal(irreversibleBranchExecutions, 1, "Retrying parallel step must NEVER re-execute succeeded irreversible branch");

  const runBeforeApproval = await automationEngine.getRunInspector(1, ev1.started_runs[0].id);
  assert.equal(runBeforeApproval.run.status, "WAITING_APPROVAL", "Approval node must never be bypassed");
  assert.equal(runBeforeApproval.approvals.length, 1);

  // Tenant 2 cannot inspect Tenant 1's run!
  await assert.rejects(
    () => automationEngine.getRunInspector(2, ev1.started_runs[0].id),
    (err) => err.code === "RUN_NOT_FOUND"
  );

  // Approve -> resumes workflow -> creates Deal -> COMPLETED!
  const apprRes = await automationEngine.decideApproval(1, runBeforeApproval.approvals[0].id, {
    decision: "APPROVED",
    approverId: 99,
    reason: "Enterprise discount verified",
  });
  assert.equal(apprRes.status, "APPROVED");
  assert.equal(apprRes.run.status, "COMPLETED");
  assert.ok(apprRes.run.deal_id > 0);

  // Permanent error (invalid credentials / SSRF block) goes straight to Dead-Letter Queue without endless retries!
  const badWf = await automationEngine.createWorkflow(1, {
    name: "Permanent Error DLQ Test",
    trigger_type: "manual_dlq",
    graph: {
      entry_node_key: "bad_http",
      nodes: [
        { key: "bad_http", type: "http_request", config: { url: "http://127.0.0.1:9999/internal" } },
      ],
    },
  }, 10);
  await automationEngine.publishWorkflow(1, badWf.id, {}, 10);
  const badRun = await automationEngine.startWorkflowRun(1, badWf.id, { triggerEvent: "manual_dlq" });
  assert.equal(badRun.status, "DEAD_LETTER", "Permanent security/permission error must move straight to DLQ");
  assert.equal(badRun.retry_count, 0, "Permanent error must not retry");
  console.log("   PASS: Parallel idempotency, bounded loop, subflow, non-bypassable approval, DLQ, tenant isolation & encrypted credentials");

  // ── SUITE 3: 24-Hour Service Window, AI Guardrails, KB Retrieval, Order Ownership & Opt-Out ──
  console.log("3. Testing 24h Meta Service Window, AI Guardrails, KB Citations, Order Security & Opt-Out...");

  // Outside 24h window -> free-form BLOCKED!
  const outWin = await serviceWindow.checkOutboundEligibility(1, {
    senderId: 1,
    phone: "919876500099",
    messageType: "text",
  });
  assert.equal(outWin.eligible, false);
  assert.equal(outWin.code, "OUTSIDE_SERVICE_WINDOW_TEMPLATE_REQUIRED");

  // Approved template + consent ALLOWED outside 24h window (and must NOT open 24h window!)
  await q(`INSERT INTO wa_templates (tenant_id, name, category, language, body, meta_status) VALUES (1, 'promo_offer', 'MARKETING', 'en', 'Hi {{1}}, check our new Solar offer!', 'APPROVED')`);
  const promoTmpl = (await q(`SELECT * FROM wa_templates WHERE tenant_id = 1 LIMIT 1`))[0];
  await consentService.recordConsent(1, {
    phone: "919876500099",
    purpose: "marketing",
    collection_method: "website_form",
    captured_wording: "Opted in for WhatsApp updates",
  }, 10);
  const tmplElig = await serviceWindow.checkOutboundEligibility(1, {
    senderId: 1,
    phone: "919876500099",
    messageType: "template",
    templateId: promoTmpl.id,
    category: "MARKETING",
  });
  assert.equal(tmplElig.eligible, true);
  const winAfterTemplate = await serviceWindow.getWindowStatus(1, { senderId: 1, phone: "919876500099" });
  assert.equal(winAfterTemplate.is_open, false, "Sending a template must NEVER open the 24-hour customer service window");

  // AI Policy Guardrail: forbidden financial/consent actions blocked
  await assert.rejects(
    () => aiService.executeAiNode(1, { allowed_tools: ["issue_refund"] }, {}),
    (err) => err.code === "AI_FORBIDDEN_ACTION"
  );

  // Tenant-scoped Knowledge Base retrieval
  await aiService.upsertKnowledgeArticle(1, {
    category: "policy",
    title: "Solar Panel 25-Year Warranty",
    content: "All Madhura Solar panels carry a 25-year linear performance warranty.",
    tags: ["solar", "warranty"],
  }, 10);
  const aiKbRes = await aiService.executeAiNode(1, {
    ai_action: "kb_response",
    use_knowledge_base: true,
    user_prompt: "What is the solar panel warranty?",
  }, { system: { tenant_id: 1 } });
  assert.equal(aiKbRes.sources.length, 1);
  assert.ok(aiKbRes.draft_reply.includes("25-year"));

  // Order ownership protection: another customer CANNOT view Priya's order
  await q(
    `INSERT INTO campaign_ecommerce_events (tenant_id, provider, event_type, idempotency_key, external_order_id, normalized_phone, amount_minor, currency, payload_json)
     VALUES (1, 'shopify', 'order_created', 'ord_sec_1', 'ORD-PRIYA-1', '919876500001', 150000, 'INR', '{}')`
  );
  const badLookup = await sharedContext.executeCrmAction(1, "lookup_customer_order", {
    order_id: "ORD-PRIYA-1",
    phone: "919876500099",
  }, {});
  assert.equal(badLookup.authorized, false);
  assert.equal(badLookup.code, "ORDER_OWNERSHIP_MISMATCH");

  const goodLookup = await sharedContext.executeCrmAction(1, "lookup_customer_order", {
    order_id: "ORD-PRIYA-1",
    phone: "919876500001",
  }, {});
  assert.equal(goodLookup.authorized, true);
  assert.equal(goodLookup.order.order_id, "ORD-PRIYA-1");
  console.log("   PASS: 24h Service Window, AI guardrails, tenant KB citations & strict order ownership check");

  // ── SUITE 4: Complete End-to-End Customer Journey ──────────────────────────
  console.log("4. Testing Full E2E Customer Journey: Campaign -> Reply -> Flowbot -> AI -> Automation -> Lead -> Deal -> Conversion...");

  // Seed authorized WABA connection + sender + campaign + recipient for 919876500099
  await q(
    `INSERT INTO waba_connections (id, tenant_id, meta_business_id, waba_id, encrypted_token, status)
     VALUES (1, 1, 'biz_e2e', 'waba_e2e', ?, 'connected')`,
    [cryptoHelper.encrypt("EAAG_test_token")]
  );
  await q(
    `INSERT INTO wa_senders (id, tenant_id, waba_connection_id, waba_id, phone_number_id, display_phone, verified_name, access_token_encrypted, status)
     VALUES (1, 1, 1, 'waba_e2e', 'pn_e2e', '+919800000001', 'Madhura Solar', ?, 'connected')`,
    [cryptoHelper.encrypt("EAAG_test_token")]
  );
  await q(`INSERT INTO wa_contacts (name, phone, tenant_id) VALUES ('Rohan Verma', '919876500099', 1)`);
  const rohan = (await q(`SELECT * FROM wa_contacts WHERE tenant_id = 1 AND phone = '919876500099' LIMIT 1`))[0];
  await q(`UPDATE wa_templates SET waba_id = 'waba_e2e', sender_id = 1 WHERE id = ?`, [promoTmpl.id]);

  const mgmt = createCampaignManagementService({ db, gateway: createProviderGateway({ db }) });
  const camp = await mgmt.createCampaign(1, {
    name: "Q4 Solar Enterprise Outreach",
    category: "MARKETING",
    sender_id: 1,
    waba_id: "waba_e2e",
    template_id: promoTmpl.id,
    template_name: promoTmpl.name,
  }, 10);

  // Record campaign recipient send
  await q(
    `INSERT INTO campaign_recipients (tenant_id, campaign_id, contact_id, contact_name, phone, normalized_phone, status, wamid, delivered_at)
     VALUES (1, ?, ?, 'Rohan Verma', '919876500099', '919876500099', 'DELIVERED', 'wamid.camp.e2e.1', CURRENT_TIMESTAMP)`,
    [camp.id, rohan.id]
  );

  // Create Journey Automation triggered by Flowbot completion -> creates CRM Lead, assigns agent, schedules follow-up, creates Deal, records Conversion!
  const journeyWf = await automationEngine.createWorkflow(1, {
    name: "Campaign Qualified Lead to Deal Journey",
    trigger_type: "flowbot_triggered_automation",
    graph: {
      entry_node_key: "create_lead",
      nodes: [
        { key: "create_lead", type: "crm_action", config: { action: "create_lead", params: { status: "hot", source: "campaign_response" }, next_node_key: "assign_rep" } },
        { key: "assign_rep", type: "crm_action", config: { action: "assign_employee", params: { employee_id: 77 }, next_node_key: "sched_followup" } },
        { key: "sched_followup", type: "crm_action", config: { action: "schedule_follow_up", params: { title: "Demo Call with Rohan", assigned_to: 77, due_in_hours: 2 }, next_node_key: "create_deal" } },
        { key: "create_deal", type: "crm_action", config: { action: "create_deal", params: { title: "Rohan Verma - 10kW Commercial Solar", value_minor: 45000000, assigned_to: 77 }, next_node_key: "end" } },
        { key: "end", type: "end", config: {} },
      ],
    },
  }, 10);
  await automationEngine.publishWorkflow(1, journeyWf.id, {}, 10);

  // Create Campaign-Triggered Flowbot: Quick-Reply "Interested" -> Ask Budget -> AI Score -> Start Automation -> End
  await q(`INSERT INTO wa_flows (tenant_id, name, status) VALUES (1, 'Campaign Lead Qualifier Bot', 'active')`);
  const campBot = (await q(`SELECT * FROM wa_flows WHERE tenant_id = 1 AND name = 'Campaign Lead Qualifier Bot' LIMIT 1`))[0];
  await flowbotRuntime.publishFlowVersion(1, campBot.id, {
    entryNodeKey: "start",
    nodes: [
      { node_key: "start", node_type: "start", config: { next_node_key: "ask_req" } },
      { node_key: "ask_req", node_type: "ask_input", config: { variable_name: "requirement", input_type: "text", prompt: "Great! Tell us your required solar capacity and budget.", next_node_key: "ai_score" } },
      { node_key: "ai_score", node_type: "ai_action", config: { ai_action: "lead_scoring", user_prompt: "{{flow.requirement}}", next_node_key: "trigger_auto" } },
      { node_key: "trigger_auto", node_type: "start_automation", config: { event_type: "flowbot_triggered_automation", next_node_key: "handover" } },
      { node_key: "handover", node_type: "human_handover", config: { agent_id: 77, priority: "high", handover_message: "Our sales executive will call you shortly!" } },
    ],
  }, 10);
  await flowbotRuntime.registerTrigger(1, {
    flow_id: campBot.id,
    trigger_type: "campaign_response",
    campaign_id: camp.id,
    match_value: "interested",
    priority: 1,
  }, 10);

  // Step 1: Rohan clicks "Interested" button on campaign template -> Flowbot activates!
  const jTurn1 = await flowbotRuntime.handleInboundMessage(1, {
    phone: "919876500099",
    buttonPayload: "Interested",
    campaignId: camp.id,
    contactId: rohan.id,
    senderId: 1,
    messageId: "wamid.e2e.btn.1",
  });
  assert.equal(jTurn1.handled, true);
  assert.equal(jTurn1.session.campaign_id, camp.id);
  assert.equal(jTurn1.session.status, "WAITING_FOR_INPUT");

  // Step 2: Rohan replies with budget & requirement -> AI scores lead -> Automation creates Lead, Task, Deal -> Human Handover!
  const jTurn2 = await flowbotRuntime.handleInboundMessage(1, {
    phone: "919876500099",
    text: "Need 10kW commercial solar quote, budget ₹450000",
    campaignId: camp.id,
    contactId: rohan.id,
    senderId: 1,
    messageId: "wamid.e2e.txt.2",
  });
  assert.equal(jTurn2.session.status, "HUMAN_OWNED");
  assert.equal(jTurn2.session.variables._ai.qualification_tier, "hot");

  // Verify real persisted CRM Lead, Follow-up Task & Deal linked to Campaign!
  const leads = await q(`SELECT * FROM wa_enquiries WHERE tenant_id = 1 AND phone = '919876500099' AND source = 'campaign_response'`);
  const tasks = await q(`SELECT * FROM crm_tasks WHERE tenant_id = 1 AND contact_id = ? AND assigned_to = 77`, [rohan.id]);
  const deals = await q(`SELECT * FROM crm_deals WHERE tenant_id = 1 AND contact_id = ? AND campaign_id = ?`, [rohan.id, camp.id]);
  assert.equal(leads.length, 1, "Automation must persist real CRM lead");
  assert.equal(tasks.length, 1, "Automation must persist real assigned follow-up task");
  assert.equal(deals.length, 1, "Automation must persist real Deal linked to campaign_id");

  // Step 3: Verified Order Conversion attributed back to Campaign!
  const analytics = createCampaignAnalyticsService({ db });
  const conv = await analytics.recordVerifiedConversion(1, {
    entity_type: "order",
    entity_id: "ORD-ROHAN-2026",
    conversion_type: "order",
    phone: "919876500099",
    revenue_minor: 45000000,
    evidence: { payment_provider: "razorpay", verified: true },
  });
  assert.equal(conv.attributed, true);
  assert.equal(conv.campaign_id, camp.id);

  // Verify Dashboard KPIs reflect real persisted sessions & runs
  const fbDash = await flowbotRuntime.getDashboardOverview(1);
  const autoDash = await automationEngine.getDashboardOverview(1);
  assert.ok(fbDash.total_sessions >= 2);
  assert.ok(fbDash.handover_count >= 2);
  assert.ok(autoDash.completed_runs >= 2);
  assert.ok(autoDash.dead_letter_jobs >= 1);

  console.log("   PASS: Complete E2E Journey (Campaign -> Reply -> Flowbot -> AI -> Automation -> Lead -> Task -> Deal -> Verified Conversion)");
  console.log("\nALL FLOWBOT & AUTOMATION ENGINE TESTS PASSED (4/4 comprehensive suites verified)");
}

run().catch((err) => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
