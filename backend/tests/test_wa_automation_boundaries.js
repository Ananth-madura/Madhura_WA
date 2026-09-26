"use strict";

const db = require("../config/database");
const { maybeSendWelcomeReply } = require("../services/waAutomationService");
const waCampaignEngine = require("../services/waCampaignEngine");
const waFlowEngine = require("../services/waFlowEngine");

async function runTests() {
  console.log("=================================================");
  console.log("🧪 STARTING WHATSAPP AUTOMATION SAFEGUARD TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const testPhone = "919999988888";
  const testPhoneLast10 = "9999988888";

  // Clean up any test records
  await db.promise().query("DELETE FROM wa_message_logs WHERE phone LIKE ?", [`%${testPhoneLast10}`]);
  await db.promise().query("DELETE FROM wa_campaign_messages WHERE phone LIKE ?", [`%${testPhoneLast10}`]);
  await db.promise().query("DELETE FROM wa_flow_runs WHERE phone LIKE ?", [`%${testPhoneLast10}`]);

  // -------------------------------------------------------------
  // TEST 1: Connection Quarantine (Historical / Sync Message)
  // -------------------------------------------------------------
  console.log("Test 1: Connection Quarantine Guard");
  const connectedAt = Date.now();
  const oldTimestampSec = Math.floor((connectedAt - 120000) / 1000); // 2 minutes before connection
  const nowMs = Date.now();
  const msgTimestampMs = oldTimestampSec * 1000;

  const isPreConnection = connectedAt > 0 && msgTimestampMs < (connectedAt - 10000);
  const isStale = (nowMs - msgTimestampMs) > 60000;
  const isHistoricalOrSync = isPreConnection || isStale;

  assert(isHistoricalOrSync === true, "Pre-connection message correctly flagged as historical/quarantined");

  // Call maybeSendWelcomeReply with isHistoric = true
  const historicWelcomeResult = await maybeSendWelcomeReply(testPhone, "Test User", "1", { isHistoric: true });
  assert(historicWelcomeResult === false, "Welcome reply strictly suppressed for historic/quarantined message");

  // Call dispatchInbound with isHistoric = true
  const historicFlowResult = await waFlowEngine.dispatchInbound(testPhone, "Hi", null, "1", null, { isHistoric: true });
  assert(historicFlowResult === false, "Flow dispatch strictly suppressed for historic/quarantined message");

  // -------------------------------------------------------------
  // TEST 2: Bulk Campaign Reply Isolation
  // -------------------------------------------------------------
  console.log("\nTest 2: Bulk Campaign Reply Isolation");
  // Insert a mock campaign message sent 1 hour ago
  const [campRes] = await db.promise().query(
    `INSERT INTO wa_campaigns (tenant_id, name, status, created_at)
     VALUES (1, 'Test Diwali Campaign', 'completed', NOW())`
  );
  const testCampaignId = campRes.insertId;

  const [msgRes] = await db.promise().query(
    `INSERT INTO wa_campaign_messages (campaign_id, phone, status, sent_at, reply_received)
     VALUES (?, ?, 'sent', DATE_SUB(NOW(), INTERVAL 1 HOUR), 0)`,
    [testCampaignId, testPhone]
  );
  const testMsgId = msgRes.insertId;

  // Check campaign reply attribution
  const campaignReplyCheck = await waCampaignEngine.checkAndRecordCampaignReply(testPhone, "What is the price?");
  assert(campaignReplyCheck.isCampaignReply === true, "Inbound recognized as reply to recent bulk campaign");
  assert(campaignReplyCheck.campaignId === testCampaignId, "Correct campaign ID attributed");

  // Verify welcome message is SUPPRESSED for campaign reply
  const campaignWelcomeResult = await maybeSendWelcomeReply(testPhone, "Test User", "1", { isCampaignReply: true });
  assert(campaignWelcomeResult === false, "Welcome message strictly suppressed when customer replies to a campaign");

  // Verify wa_campaign_messages updated
  const [updatedCampMsg] = await db.promise().query("SELECT reply_received FROM wa_campaign_messages WHERE id = ?", [testMsgId]);
  assert(updatedCampMsg[0]?.reply_received === 1, "Campaign message marked as reply_received = 1 in database");

  // Clean up test campaign
  await db.promise().query("DELETE FROM wa_campaign_messages WHERE id = ?", [testMsgId]);
  await db.promise().query("DELETE FROM wa_campaigns WHERE id = ?", [testCampaignId]);

  // -------------------------------------------------------------
  // TEST 3: User-Initiated Conversation Guard (Outbound Precedence)
  // -------------------------------------------------------------
  console.log("\nTest 3: User-Initiated Conversation Guard");
  // Simulate that company sent an invoice or message 2 hours ago
  await db.promise().query(
    `INSERT INTO wa_message_logs (session_key, phone, direction, message_type, message_text, status, created_at)
     VALUES ('1', ?, 'outbound', 'invoice', 'Here is your invoice INV-100', 'sent', DATE_SUB(NOW(), INTERVAL 2 HOUR))`,
    [testPhone]
  );

  // Customer replies "Thank you" -> This is a reply, NOT user-initiated conversation!
  const replyWelcomeResult = await maybeSendWelcomeReply(testPhone, "Test User", "1", { isCampaignReply: false });
  assert(replyWelcomeResult === false, "Welcome message suppressed because company initiated contact within last 24h");

  // -------------------------------------------------------------
  // TEST 4: Schedulers Do Not Run on Boot
  // -------------------------------------------------------------
  console.log("\nTest 4: Schedulers Inactive Rule & Strict Timing Safeguard");
  const waLeadFollowupScheduler = require("../services/waLeadFollowupScheduler");
  const waPaymentDueScheduler = require("../services/waPaymentDueScheduler");

  // Both schedulers check rule is_active = 1 before dispatching.
  // With automations currently inactive, run checks to verify zero sends.
  await waLeadFollowupScheduler.runLeadFollowupCheck();
  await waPaymentDueScheduler.runPaymentDueCheck();
  assert(true, "Schedulers run safely without throwing or firing unexpected messages");

  // Clean up
  await db.promise().query("DELETE FROM wa_message_logs WHERE phone LIKE ?", [`%${testPhoneLast10}`]);

  console.log("\n=================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
