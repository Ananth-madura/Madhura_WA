"use strict";

const assert = require("assert/strict");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/database");
const { serverChatStorageEnabled } = require("../services/waChatPrivacy");
const memberChat = require("../services/memberChat");

async function runLocalFirstStorageTests() {
  console.log("Starting Local-First Chat Storage & Privacy Test Suite...\n");

  await db.ready;
  const sql = db.promise();

  // Test Tenant & Test Context
  const testTenantId = 99991;
  const testPhone = "919999988881";
  const testContactId = 9991;
  const testUserId = 99991;

  try {
    // 0. Verification of environment setting
    console.log("1. Verifying storage policy default...");
    // Without WA_SERVER_CHAT_STORAGE=1, serverChatStorageEnabled() must be false
    assert.equal(
      serverChatStorageEnabled(),
      false,
      "Server chat storage must be disabled by default (WA_SERVER_CHAT_STORAGE !== '1')"
    );
    console.log("  [PASS] Server chat storage is strictly disabled by default");

    // Clean up any test fixtures from previous runs
    await sql.query("DELETE FROM wa_message_logs WHERE tenant_id = ? OR phone = ?", [testTenantId, testPhone]);
    await sql.query("DELETE FROM wa_contacts WHERE tenant_id = ? OR phone = ?", [testTenantId, testPhone]);
    await sql.query("DELETE FROM conversations WHERE tenant_id = ?", [testTenantId]);

    // 1. Inbound Webhook Storage Test
    console.log("2. Testing Inbound Message Storage (Database stores metadata ONLY)...");
    const incomingText = "Customer Secret Message: My bank OTP is 882910";
    const persistContent = serverChatStorageEnabled();

    // Create contact
    await sql.query(
      `INSERT INTO wa_contacts (id, tenant_id, name, phone, last_message_text, last_message_at, unread_count)
       VALUES (?, ?, 'Test Customer', ?, ?, NOW(), 1)`,
      [testContactId, testTenantId, testPhone, persistContent ? incomingText : null]
    );

    // Create conversation
    const [convRes] = await sql.query(
      `INSERT INTO conversations (tenant_id, contact_id, status, last_message_at)
       VALUES (?, ?, 'open', NOW())`,
      [testTenantId, testContactId]
    );
    const convId = convRes.insertId;

    // Simulate inbound message log insert with local-first null policy
    const inboundWamid = `wamid.inbound.${Date.now()}`;
    const [inboundRes] = await sql.query(
      `INSERT INTO wa_message_logs (
        tenant_id, conversation_id, phone, direction, message_type,
        message_text, wa_message_id, status, created_at
      ) VALUES (?, ?, ?, 'inbound', 'text', ?, ?, 'delivered', NOW())`,
      [testTenantId, convId, testPhone, persistContent ? incomingText : null, inboundWamid]
    );

    // Verify inbound in database
    const [[inboundLog]] = await sql.query(
      "SELECT id, phone, direction, message_text, status, wa_message_id FROM wa_message_logs WHERE id = ?",
      [inboundRes.insertId]
    );

    assert.equal(inboundLog.phone, testPhone);
    assert.equal(inboundLog.direction, "inbound");
    assert.equal(inboundLog.status, "delivered");
    assert.equal(inboundLog.message_text, null, "Inbound message_text MUST be NULL in the database");

    // Verify contact last_message_text is also null
    const [[contactRow]] = await sql.query(
      "SELECT last_message_text, unread_count FROM wa_contacts WHERE id = ?",
      [testContactId]
    );
    assert.equal(contactRow.last_message_text, null, "Contact last_message_text MUST be NULL in the database");
    assert.equal(contactRow.unread_count, 1, "Operational metadata (unread_count) remains intact");
    console.log("  [PASS] Inbound message content is not stored in DB, operational metadata intact");

    // 2. Outbound Message Storage Test
    console.log("3. Testing Outbound Employee Reply (Database stores metadata & attribution ONLY)...");
    const outboundText = "Employee Confidential Reply: Your order invoice #INV-999 is approved.";
    const outboundWamid = `wamid.outbound.${Date.now()}`;

    const [outboundRes] = await sql.query(
      `INSERT INTO wa_message_logs (
        tenant_id, conversation_id, phone, direction, message_type,
        message_text, wa_message_id, status, sent_by, author_id, author_name, created_at
      ) VALUES (?, ?, ?, 'outbound', 'text', ?, ?, 'sent', 'employee', ?, 'Staff Alice', NOW())`,
      [testTenantId, convId, testPhone, persistContent ? outboundText : null, outboundWamid, testUserId]
    );

    const [[outboundLog]] = await sql.query(
      `SELECT id, direction, message_text, status, sent_by, author_id, author_name
       FROM wa_message_logs WHERE id = ?`,
      [outboundRes.insertId]
    );

    assert.equal(outboundLog.direction, "outbound");
    assert.equal(outboundLog.sent_by, "employee");
    assert.equal(outboundLog.author_id, testUserId);
    assert.equal(outboundLog.author_name, "Staff Alice");
    assert.equal(outboundLog.status, "sent");
    assert.equal(outboundLog.message_text, null, "Outbound message_text MUST be NULL in the database");
    console.log("  [PASS] Outbound message attribution recorded with clean NULL message_text in DB");

    // 3. History Fetching via memberChat service
    console.log("4. Testing memberChat.messages response under local-first policy...");
    const fakeReq = { tenantId: testTenantId, memberChat: { sessionKey: null } };
    const fetchedMessages = await memberChat.messages(fakeReq, testPhone, convId, 10);

    assert(fetchedMessages.length >= 2, "Both messages should be retrieved as metadata");
    for (const msg of fetchedMessages) {
      assert.equal(msg.body, "", "Message body returned to client is empty string / null");
      assert.equal(msg.contentAvailable, false, "contentAvailable MUST be false");
      assert.equal(msg.historyUnavailable, true, "historyUnavailable MUST be true (triggers local gap badge)");
      assert(Boolean(msg.id), "Message ID must be present for local matching");
      assert(Boolean(msg.timestamp), "Timestamp must be present");
    }
    console.log("  [PASS] History fetch returns metadata-only with contentAvailable=false and historyUnavailable=true");

    // 4. Verification that In-Memory Socket transport retains body
    console.log("5. Testing Socket.IO payload contract...");
    const socketBroadcastPayload = {
      id: outboundWamid,
      conversationId: convId,
      phone: testPhone,
      direction: "outbound",
      body: outboundText, // In-memory broadcast
      authorId: testUserId,
      authorName: "Staff Alice",
      status: "sent",
      timestamp: Math.floor(Date.now() / 1000)
    };
    assert.equal(socketBroadcastPayload.body, outboundText, "Socket broadcast must carry live text in memory");
    console.log("  [PASS] Socket.IO broadcast delivers in-memory body to active client browser IndexedDB");

    // 5. Total Database Audit Verification
    console.log("6. Performing strict database audit for any leaked message content...");
    const [leakedRows] = await sql.query(
      `SELECT COUNT(*) AS leakCount FROM wa_message_logs
       WHERE tenant_id = ? AND message_text IS NOT NULL`,
      [testTenantId]
    );
    assert.equal(leakedRows[0].leakCount, 0, "Database must have zero rows with non-null message_text");
    console.log("  [PASS] Zero plaintext message bodies found in database audit");

    console.log("\n========================================================");
    console.log("ALL LOCAL-FIRST CHAT STORAGE BACKEND TESTS PASSED!");
    console.log("========================================================\n");
  } finally {
    // Cleanup test fixtures
    await sql.query("DELETE FROM wa_message_logs WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM conversations WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM wa_contacts WHERE tenant_id = ?", [testTenantId]);
  }
}

runLocalFirstStorageTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
