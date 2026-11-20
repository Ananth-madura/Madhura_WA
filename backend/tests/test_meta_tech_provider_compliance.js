"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("Meta Tech Provider Service & Compliance Center (SQLite in-memory)", async () => {
  // Mock DB matching mysql2 query shape
  const senders = [
    { id: 1, tenant_id: 1, phone_number_id: "10987654321", display_phone: "+919757563106", is_ack_bot_enabled: 0, ack_bot_message: null, code_verification_status: "VERIFIED", status: "connected" }
  ];
  const compliance = [];
  const webhooks = [];
  const assets = [];

  const db = {
    isSqlite: true,
    promise() {
      return {
        query: async (sql, params = []) => {
          const s = sql.toLowerCase();
          if (s.includes("create table") || s.includes("alter table")) return [[]];
          if (s.includes("pragma table_info")) return [[{ name: "is_ack_bot_enabled" }, { name: "registration_pin" }]];
          if (s.includes("select * from meta_tech_provider_compliance")) {
            return [compliance];
          }
          if (s.includes("select id from meta_tech_provider_compliance")) {
            return [compliance.map(c => ({ id: c.id }))];
          }
          if (s.includes("insert into meta_tech_provider_compliance")) {
            const row = { id: 1, tenant_id: params[0] || 1, stage_1_business_verification: params[1], stage_2_app_configuration: params[2], stage_3_app_review: params[3], stage_4_video_evidence: params[4], stage_5_embedded_signup: params[5], stage_6_provider_readiness: params[6], overall_status: "VERIFIED_READY", last_verified_at: new Date() };
            compliance.push(row);
            return [{ insertId: 1 }];
          }
          if (s.includes("update meta_tech_provider_compliance")) {
            if (compliance[0]) compliance[0].overall_status = "VERIFIED_READY";
            return [{ affectedRows: 1 }];
          }
          if (s.includes("count(*) as total from wa_senders")) {
            return [[{ total: senders.length }]];
          }
          if (s.includes("count(*) as total from waba_connections")) {
            return [[{ total: 1 }]];
          }
          if (s.includes("count(*) as total from meta_webhook_logs")) {
            return [[{ total: webhooks.length }]];
          }
          if (s.includes("insert into meta_webhook_logs")) {
            webhooks.push({ id: webhooks.length + 1, payload: params[7], object_type: params[1], field: params[2], waba_id: params[3], phone_number_id: params[4], sender_phone: params[5], event_type: params[6], signature_verified: params[8], created_at: new Date() });
            return [{ insertId: webhooks.length }];
          }
          if (s.includes("from meta_webhook_logs")) {
            return [webhooks];
          }
          if (s.includes("is_ack_bot_enabled")) {
            if (s.includes("update")) {
              senders[0].is_ack_bot_enabled = params[0];
              if (params[1]) senders[0].ack_bot_message = params[1];
              return [{ affectedRows: 1 }];
            }
            if (s.includes("select")) {
              return [[senders[0]]];
            }
          }
          if (s.includes("select * from meta_tech_provider_assets")) {
            return [assets];
          }
          return [[]];
        }
      };
    }
  };

  const { createMetaTechProviderService } = require("../services/metaTechProviderService");
  const service = createMetaTechProviderService(db);

  // 1. Check Compliance Status initialization
  const status = await service.getComplianceStatus(1);
  assert.equal(status.success, true);
  assert.equal(status.overallStatus, "VERIFIED_READY");
  assert.equal(status.stages.stage1.id, 1);
  assert.equal(status.stages.stage2.id, 2);
  assert.equal(status.stages.stage3.id, 3);
  assert.equal(status.stages.stage4.id, 4);
  assert.equal(status.stages.stage5.id, 5);
  assert.equal(status.stages.stage6.id, 6);
  assert.equal(status.stages.stage6.score, 100);

  // 2. AckBot configuration
  const ackRes = await service.updateAckBot(1, 1, true, "Welcome to Madhura WhatsApp Suite!");
  assert.equal(ackRes.success, true);
  assert.equal(ackRes.sender.isAckBotEnabled, true);
  assert.equal(ackRes.sender.ackBotMessage, "Welcome to Madhura WhatsApp Suite!");

  // 3. Webhook event logging and retrieval
  await service.logWebhookEvent(1, {
    objectType: "whatsapp_business_account",
    field: "messages",
    wabaId: "1234567890",
    phoneId: "10987654321",
    senderPhone: "+919757563106",
    eventType: "message",
    payload: { entry: [{ id: "1234567890", changes: [{ field: "messages", value: { messages: [{ from: "919757563106", text: { body: "Hello" } }] } }] }] }
  });

  const webhookLogs = await service.getWebhookLogs(1, 10);
  assert.equal(webhookLogs.success, true);
  assert.equal(webhookLogs.logs.length, 1);

  // 4. Extended assets check
  const assetsRes = await service.getExtendedAssets(1);
  assert.equal(assetsRes.success, true);
  assert(Array.isArray(assetsRes.assets.catalogs));
  assert(Array.isArray(assetsRes.assets.pages));

  // 5. Embedded Signup Token Exchange & AES-256 Token Encryption check
  const exchangeRes = await service.exchangeAndConnectEmbeddedSignup({
    tenantId: 1,
    code: "mock_auth_code_12345",
    appId: "780961714856006",
    wabaIds: ["waba_test_101", "waba_test_102"],
    businessId: "biz_987654321",
    subscribeWebhooks: false
  });
  assert.equal(exchangeRes.success, true);
  assert.equal(exchangeRes.tokenSecured, true);
  assert.equal(exchangeRes.wabas.length, 2);
  assert.equal(exchangeRes.wabas[0].wabaId, "waba_test_101");

  console.log("PASS: Meta Tech Provider Compliance Center, AckBot, and Live Webhook streaming tests passed successfully!");
});
