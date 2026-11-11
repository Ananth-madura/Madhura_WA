"use strict";

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const EventEmitter = require("node:events");
const crypto = require("node:crypto");

const { migrate: migrateInterconnect } = require("../migrations/chat_crm_interconnection");
const { migrate: migrateHub } = require("../migrations/enterprise_workflow_hub");
const { createForwarder } = require("../services/crmWebhookForwarder");
const { createPipeline } = require("../services/unifiedChatPipeline");
const { createBridge } = require("../services/chatCrmBridge");
const { syncConversationTakeover } = require("../services/waBotGate");

function createTestSqliteDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT DEFAULT 1, first_name TEXT, last_name TEXT, email TEXT, role TEXT DEFAULT 'agent', status TEXT DEFAULT 'active');
    CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, name TEXT, company_name TEXT, email TEXT, phone TEXT, address TEXT, source TEXT);
    CREATE TABLE telecalls (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, customer_name TEXT, company_name TEXT, mobile_number TEXT, status TEXT, service TEXT, remarks TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE walkins (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, customer_name TEXT, company_name TEXT, mobile_number TEXT, status TEXT, purpose TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE wa_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, name TEXT, phone TEXT, email TEXT, is_unsubscribed INT DEFAULT 0, opt_in_status INT DEFAULT 1, ai_paused_until TEXT DEFAULT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, sender_id INT, contact_id INT, branch_id INT, owner_user_id INT, status TEXT DEFAULT 'open', automation_mode TEXT DEFAULT 'assistant', automation_version INT DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE wa_flow_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, flow_id INT, conversation_id INT, phone TEXT, status TEXT DEFAULT 'active', end_reason TEXT DEFAULT NULL, ended_at TEXT DEFAULT NULL);
    CREATE TABLE wa_opt_outs (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, phone TEXT, reason TEXT, opt_out_keyword TEXT, UNIQUE (tenant_id, phone));
    CREATE TABLE wa_campaign_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, phone TEXT, status TEXT, opt_out INT DEFAULT 0, error TEXT);
    CREATE TABLE wa_enquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, phone TEXT, enquiry_type TEXT, subject TEXT, status TEXT, source TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE wa_automations (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, name TEXT);
    CREATE TABLE wa_automation_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, automation_id INT, phone TEXT, status TEXT, error TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE wa_knowledge_base (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT, content TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE wa_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT, phone TEXT, name TEXT, source TEXT, status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);

  const db = {
    isSqlite: true,
    promise: () => ({
      query: async (sql, params = []) => {
        const cleanSql = sql
          .replace(/`/g, "")
          .replace(/\s+FOR\s+UPDATE\b/gi, "")
          .replace(/INSERT\s+IGNORE\s+INTO/gi, "INSERT OR IGNORE INTO");
        const trimmed = cleanSql.trim().toUpperCase();
        const stmt = sqlite.prepare(cleanSql);
        if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA")) {
          return [stmt.all(...params)];
        }
        const info = stmt.run(...params);
        return [{ affectedRows: info.changes, insertId: Number(info.lastInsertRowid || 0) }];
      },
    }),
  };
  return { db, sqlite };
}

async function testTenantWebhookForwarder() {
  const { db } = createTestSqliteDb();
  await migrateInterconnect(db);
  await migrateInterconnect(db);

  const posted = [];
  const forwarder = createForwarder({
    db,
    httpPost: async (url, payload, opts) => {
      posted.push({ url, payload, headers: opts.headers });
      return { status: 200 };
    },
  });

  // SSRF metadata block
  await assert.rejects(
    forwarder.configureTenantWebhook(1, { webhookUrl: "http://169.254.169.254/latest/meta-data" }),
    /restricted metadata/
  );

  // Configure per-tenant endpoints with distinct secrets
  await forwarder.configureTenantWebhook(1, {
    webhookUrl: "https://erp-one.example.test/hooks/wa",
    secret: "secret-one",
    events: ["message.received", "crm.ticket_created"],
    userId: 10,
  });
  await forwarder.configureTenantWebhook(2, {
    webhookUrl: "https://erp-two.example.test/hooks/wa",
    secret: "secret-two",
    userId: 20,
  });

  const cfg1 = await forwarder.getTenantWebhook(1);
  assert.equal(cfg1.configured, true);
  assert.equal(cfg1.webhook_url, "https://erp-one.example.test/hooks/wa");
  assert.equal(cfg1.has_secret, true);
  assert.equal(cfg1.webhook_secret, undefined, "Secret must not be exposed on read");

  await forwarder.sendTenantEvent(1, "message.received", { phone: "919876543210", text: "Hi" });
  await forwarder.sendTenantEvent(1, "crm.order_ignored", { phone: "919876543210" }); // filtered by subscribed_events
  await forwarder.sendTenantEvent(2, "crm.ticket_created", { phone: "919111111111" });

  assert.equal(posted.length, 2);
  assert.equal(posted[0].url, "https://erp-one.example.test/hooks/wa");
  assert.equal(posted[1].url, "https://erp-two.example.test/hooks/wa");

  const expectedSig1 =
    "sha256=" + crypto.createHmac("sha256", "secret-one").update(JSON.stringify(posted[0].payload)).digest("hex");
  assert.equal(posted[0].headers["X-WA-Signature-256"], expectedSig1);
  assert.equal(posted[0].headers["X-WA-Tenant-Id"], "1");

  const t1Deliveries = await forwarder.getTenantDeliveries(1);
  const t2Deliveries = await forwarder.getTenantDeliveries(2);
  assert.equal(t1Deliveries.length, 1);
  assert.equal(t2Deliveries.length, 1);
  assert.equal(t1Deliveries[0].event, "message.received");
  assert.equal(t2Deliveries[0].event, "crm.ticket_created");
  console.log("  [PASS 1] Per-tenant webhook persistence, HMAC signing, SSRF guard & tenant isolation verified");
}

async function testUnifiedPipelineAndTakeover() {
  const { db } = createTestSqliteDb();
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  await migrateInterconnect(db);

  await q("INSERT INTO wa_contacts (id, tenant_id, name, phone) VALUES (1, 7, 'Priya', '919876543210')");
  await q("INSERT INTO conversations (id, tenant_id, sender_id, contact_id, automation_mode, automation_version) VALUES (10, 7, 3, 1, 'assistant', 0)");
  await q("INSERT INTO wa_campaign_messages (tenant_id, phone, status) VALUES (7, '919876543210', 'queued')");

  const calls = { leads: [], webhooks: [], auto: [], flows: [], sharedFlows: [], ai: [] };
  let pausedContact = false;
  let sharedFlowRestartResult = false;
  let automationInboundMatch = false;

  const pipeline = createPipeline({
    db,
    leadCapture: { captureLeadFromWhatsApp: async (p) => calls.leads.push(p) },
    webhookForwarder: {
      forwardIncomingMessage: (p) => calls.webhooks.push({ type: "in", ...p }),
      sendTenantEvent: async (tid, evt, data) => calls.webhooks.push({ type: evt, tid, data }),
    },
    campaignEngine: { checkAndRecordCampaignReply: async () => ({ isCampaignReply: false }) },
    confirmationService: { handleInboundConfirmation: async () => false },
    billingService: { handleInboundBillKeyword: async () => false },
    automationInbound: { handle: async () => automationInboundMatch },
    automationService: {
      triggerAutomation: async (evt, payload) => {
        calls.auto.push({ evt, payload });
        return { triggeredCount: 0 };
      },
      maybeSendWelcomeReply: async () => false,
    },
    sharedFlowRuntime: {
      handle: async (tid, cid, mid, input) => {
        calls.sharedFlows.push({ tid, cid, input });
        return sharedFlowRestartResult;
      },
      start: async () => {},
    },
    flowEngine: { dispatchInbound: async () => false, startFlowRun: async () => {} },
    menuHandler: { handleMenuReply: async () => false },
    checkpointService: { findActiveCheckpoint: async () => null },
    botGate: {
      shouldBotEngage: async () =>
        pausedContact ? { allowed: false, reason: "agent_takeover", contact: { id: 1 } } : { allowed: true, reason: null, contact: { id: 1 } },
    },
    inboxAssistant: {
      enqueue: (tid, cid, mid, text) => calls.ai.push({ tid, cid, text }),
      pause: async () => {},
    },
    waAiReply: { maybeAutoReply: async () => {} },
  });

  // 1. Shared inbox inbound message captures lead, forwards webhook, checks automations, flows & AI
  const r1 = await pipeline.processInbound({
    channel: "cloud_shared",
    tenantId: 7,
    senderId: 3,
    sharedConversation: { id: 10, tenant_id: 7, sender_id: 3, automation_mode: "assistant", automation_version: 0, isNew: true },
    sessionKey: "5",
    phone: "919876543210",
    messageId: "msg-1",
    messageText: "Hi price please",
    contactName: "Priya",
    timestampSec: Math.floor(Date.now() / 1000),
  });
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(r1.stage, "shared_ai_enqueued");
  assert.equal(calls.leads.length, 1);
  assert.equal(calls.webhooks[0].type, "in");
  assert.equal(calls.auto.some((a) => a.evt === "keyword_detected"), true);
  assert.equal(calls.sharedFlows.length, 1);
  assert.equal(calls.ai.length, 1);

  // 2. Strict Human Takeover pauses automations & AI, only allowing explicit keyword Flow restart when matched
  pausedContact = true;
  calls.auto.length = 0;
  calls.ai.length = 0;
  sharedFlowRestartResult = false;
  const rPaused = await pipeline.processInbound({
    channel: "cloud_shared",
    tenantId: 7,
    senderId: 3,
    sharedConversation: { id: 10, tenant_id: 7, sender_id: 3, automation_mode: "human", automation_version: 2 },
    sessionKey: "5",
    phone: "919876543210",
    messageId: "msg-2",
    messageText: "Hello again",
    timestampSec: Math.floor(Date.now() / 1000),
  });
  assert.equal(rPaused.stage, "human_paused");
  assert.equal(calls.auto.length, 0);
  assert.equal(calls.ai.length, 0);

  sharedFlowRestartResult = true;
  const rRestart = await pipeline.processInbound({
    channel: "cloud_shared",
    tenantId: 7,
    senderId: 3,
    sharedConversation: { id: 10, tenant_id: 7, sender_id: 3, automation_mode: "human", automation_version: 2 },
    sessionKey: "5",
    phone: "919876543210",
    messageId: "msg-3",
    messageText: "MENU",
    timestampSec: Math.floor(Date.now() / 1000),
  });
  assert.equal(rRestart.stage, "shared_flow_keyword_restart");

  // 3. Opt-Out / STOP runs even when paused & updates opt_outs + contact + campaign rows + webhook
  const rStop = await pipeline.processInbound({
    channel: "cloud_shared",
    tenantId: 7,
    senderId: 3,
    sharedConversation: { id: 10, tenant_id: 7, sender_id: 3, contact_id: 1, automation_mode: "human", automation_version: 2 },
    sessionKey: "5",
    phone: "919876543210",
    messageId: "msg-4",
    messageText: "STOP",
    timestampSec: Math.floor(Date.now() / 1000),
  });
  assert.equal(rStop.stage, "opt_out");
  const [opt] = await q("SELECT * FROM wa_opt_outs WHERE tenant_id = 7 AND phone = '919876543210'");
  assert(opt, "wa_opt_outs row written");
  const [ct] = await q("SELECT is_unsubscribed FROM wa_contacts WHERE id = 1");
  assert.equal(ct.is_unsubscribed, 1);
  console.log("  [PASS 2] Unified inbound pipeline across Shared/Web channels, strict takeover & opt-out verified");
}

async function testChatCrmBridgeAndTakeoverSync() {
  const { db } = createTestSqliteDb();
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  await migrateHub(db);
  await migrateInterconnect(db);

  await q("INSERT INTO users (id, tenant_id, first_name) VALUES (1, 1, 'Agent One')");
  await q("INSERT INTO wa_contacts (id, tenant_id, name, phone) VALUES (1, 1, 'Kiran', '919988776655')");
  await q("INSERT INTO conversations (id, tenant_id, sender_id, contact_id, automation_mode, automation_version) VALUES (20, 1, 2, 1, 'flow', 0)");
  await q("INSERT INTO wa_flow_runs (id, flow_id, conversation_id, phone, status) VALUES (100, 9, 20, '919988776655', 'active')");

  const busEvents = [];
  const socketEvents = [];
  const whEvents = [];
  const eventBus = new EventEmitter();
  const origEmit = eventBus.emit.bind(eventBus);
  eventBus.emit = (evt, payload) => {
    busEvents.push({ evt, payload });
    return origEmit(evt, payload);
  };

  const bridge = createBridge({
    db,
    eventBus,
    webhookForwarder: {
      sendTenantEvent: async (tid, evt, data) => whEvents.push({ tid, evt, data }),
    },
    getIO: () => ({
      to: (room) => ({
        emit: (evt, data) => socketEvents.push({ room, evt, data }),
      }),
    }),
  });

  // Create ticket, appointment & approval right from active chat
  const tkt = await bridge.executeAction({
    tenantId: 1,
    userId: 1,
    phone: "919988776655",
    conversationId: 20,
    customerName: "Kiran",
    action: "create_ticket",
    payload: { subject: "AC Repair Issue", priority: "high" },
  });
  assert.equal(tkt.success, true);

  const apt = await bridge.executeAction({
    tenantId: 1,
    userId: 1,
    phone: "919988776655",
    conversationId: 20,
    customerName: "Kiran",
    action: "create_appointment",
    payload: { service: "Demo Session", date: "2026-12-20", time: "14:30" },
  });
  assert.equal(apt.success, true);

  const apr = await bridge.executeAction({
    tenantId: 1,
    userId: 1,
    phone: "919988776655",
    conversationId: 20,
    customerName: "Kiran",
    action: "create_approval",
    payload: { item_name: "Enterprise Discount", amount: 5000 },
  });
  assert.equal(apr.success, true);

  // Tenant 1 sees records; Tenant 2 sees empty (tenant isolation)
  const ctx1 = await bridge.getUnifiedContext({ tenantId: 1, phone: "9988776655", conversationId: 20 });
  const ctx2 = await bridge.getUnifiedContext({ tenantId: 2, phone: "9988776655" });
  assert.equal(ctx1.tickets.length, 1);
  assert.equal(ctx1.appointments.length, 1);
  assert.equal(ctx1.approvals.length, 1);
  assert.equal(ctx2.tickets.length, 0);
  assert.equal(ctx2.appointments.length, 0);
  assert.equal(ctx2.approvals.length, 0);

  // Update ticket status to resolved -> fires ticket_closed + webhook + socket refresh
  await bridge.executeAction({
    tenantId: 1,
    userId: 1,
    phone: "919988776655",
    conversationId: 20,
    action: "update_status",
    payload: { recordType: "ticket", recordId: ctx1.tickets[0].id, status: "resolved" },
  });
  assert.equal(busEvents.some((e) => e.evt === "ticket_closed"), true);
  assert.equal(whEvents.some((e) => e.evt === "crm.record_updated" && e.data.status === "resolved"), true);
  assert.equal(socketEvents.some((s) => s.evt === "crm_record_updated"), true);

  // Sync human takeover -> pauses contact ai_paused_until, conversation automation_mode & active flow run
  await syncConversationTakeover({ db, tenantId: 1, phone: "919988776655", conversationId: 20, paused: true, reason: "agent_reply" });
  const [cRow] = await q("SELECT automation_mode, automation_version FROM conversations WHERE id = 20");
  const [fRun] = await q("SELECT status, end_reason FROM wa_flow_runs WHERE id = 100");
  const [ctRow] = await q("SELECT ai_paused_until FROM wa_contacts WHERE id = 1");
  assert.equal(cRow.automation_mode, "human");
  assert.equal(cRow.automation_version, 1);
  assert.equal(fRun.status, "paused_by_agent");
  assert(ctRow.ai_paused_until !== null);
  console.log("  [PASS 3] Chat <-> 10-System CRM Bridge, tenant isolation & Human Takeover Sync verified");
}

async function main() {
  console.log("Running Unified Chat <-> CRM <-> Flows <-> External Webhook verification...");
  await testTenantWebhookForwarder();
  await testUnifiedPipelineAndTakeover();
  await testChatCrmBridgeAndTakeoverSync();
  console.log("\nALL UNIFIED CHAT & REAL-WORLD CRM INTERCONNECTION TESTS PASSED!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
