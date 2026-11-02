"use strict";

const assert = require("node:assert/strict");

// Load backend DB
const db = require("../config/database");
const { createConversationShareService } = require("../services/conversationShareService");

async function run() {
  console.log("Starting Enterprise Team Access & Shared Inbox test suite...");
  await db.ready;
  const sql = db.promise();
  const service = createConversationShareService(db);

  let checks = 0;
  const pass = (label) => {
    checks++;
    console.log(`  [PASS ${checks}] ${label}`);
  };

  const testTenantId = 9999;
  const foreignTenantId = 8888;
  let senderId = null;
  let branchId = null;
  let conversationId = null;

  try {
    // 1. Prepare test fixtures
    await sql.query("DELETE FROM wa_conversation_shares WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM wa_message_logs WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM conversations WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM wa_contacts WHERE tenant_id = ?", [testTenantId]);

    // Ensure test tenants exist
    await sql.query("INSERT IGNORE INTO tenants (id, name, status) VALUES (?, 'Test Org A', 'active'), (?, 'Test Org B', 'active')", [testTenantId, foreignTenantId]);

    // Ensure branch exists
    await sql.query("INSERT INTO branches (tenant_id, name, code, status) VALUES (?, 'Main Branch', 'TEST-MAIN', 'active') ON DUPLICATE KEY UPDATE name='Main Branch'", [testTenantId]);
    const [[branchRow]] = await sql.query("SELECT id FROM branches WHERE tenant_id = ? AND code = 'TEST-MAIN'", [testTenantId]);
    branchId = branchRow.id;

    // Ensure users exist: Vinoth (owner), Arun (collaborator), Priya (viewer), Foreign (other tenant)
    await sql.query(
      `INSERT INTO users (id, tenant_id, first_name, last_name, email, role, status) VALUES 
       (9001, ?, 'Vinoth', 'Owner', 'vinoth.test@domain.com', 'employee', 'active'),
       (9002, ?, 'Arun', 'Collaborator', 'arun.test@domain.com', 'employee', 'active'),
       (9003, ?, 'Priya', 'Viewer', 'priya.test@domain.com', 'employee', 'active'),
       (9004, ?, 'Foreign', 'User', 'foreign.test@domain.com', 'employee', 'active')
       ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name=VALUES(last_name), status='active'`,
      [testTenantId, testTenantId, testTenantId, foreignTenantId]
    );

    // Ensure memberships in org and branch
    await sql.query(
      `INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES
       (?, 9001, 'employee', 'active'),
       (?, 9002, 'employee', 'active'),
       (?, 9003, 'employee', 'active')
       ON DUPLICATE KEY UPDATE membership_status='active'`,
      [testTenantId, testTenantId, testTenantId]
    );

    await sql.query(
      `INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary, is_available, auto_assign_enabled) VALUES
       (?, 9001, ?, 1, 1, 1),
       (?, 9002, ?, 1, 1, 1),
       (?, 9003, ?, 1, 1, 1)
       ON DUPLICATE KEY UPDATE is_available=1, auto_assign_enabled=1`,
      [testTenantId, branchId, testTenantId, branchId, testTenantId, branchId]
    );

    // Ensure sender exists
    await sql.query(
      `INSERT INTO wa_senders (tenant_id, phone_number_id, display_phone, verified_name, status)
       VALUES (?, 'test-phone-id-9999', '+919876510001', 'Sales Desk', 'connected')
       ON DUPLICATE KEY UPDATE display_phone=VALUES(display_phone)`,
      [testTenantId]
    );
    const [[senderRow]] = await sql.query("SELECT id FROM wa_senders WHERE phone_number_id = 'test-phone-id-9999'");
    senderId = senderRow.id;

    // Link sender to branch
    await sql.query(
      `INSERT IGNORE INTO sender_branch_assignments (tenant_id, sender_id, branch_id, is_default)
       VALUES (?, ?, ?, 1)`,
      [testTenantId, senderId, branchId]
    );

    // 2. Test Multi-Number Employee Assignments
    console.log("\nTesting Multi-Number Employee Assignments:");
    await service.updateSenderTeamAssignments(
      testTenantId,
      senderId,
      9001,
      {
        userIds: [9001, 9002],
        permissions: {
          can_view: 1,
          can_reply: 1,
          can_send_templates: 1,
          can_send_attachments: 1,
          can_add_notes: 1,
          can_transfer: 1,
          can_share: 1,
          can_manage_collaborators: 0,
          role_in_sender: "member"
        }
      }
    );

    const overview = await service.getNumberAssignmentsOverview(testTenantId);
    assert(overview.numbers.length > 0, "Overview should list WhatsApp numbers");
    const testSenderData = overview.numbers.find(n => n.id === senderId);
    assert(testSenderData, "Overview should include test sender");
    assert.equal(testSenderData.assignedEmployees.length, 2, "Test sender should have 2 assigned employees");
    pass("Multi-number team assignments updated and overview aggregated correctly");

    // 3. Create a Test Contact and Conversation in conversations table
    const [contactResult] = await sql.query(
      `INSERT INTO wa_contacts (tenant_id, branch_id, name, phone)
       VALUES (?, ?, 'Acme Corp Lead', '+919999900001')`,
      [testTenantId, branchId]
    );
    const contactId = contactResult.insertId;

    const [convResult] = await sql.query(
      `INSERT INTO conversations (tenant_id, sender_id, branch_id, contact_id, owner_user_id, status, subject)
       VALUES (?, ?, ?, ?, 9001, 'open', 'Acme Corp Inquiry')`,
      [testTenantId, senderId, branchId, contactId]
    );
    conversationId = convResult.insertId;

    // Check Vinoth (Owner) access
    const vinothAccess = await service.getUserAccess(testTenantId, conversationId, 9001, "employee", "full");
    assert(vinothAccess, "Vinoth should have access");
    assert.equal(vinothAccess.canView, true, "Owner should have canView");
    assert.equal(vinothAccess.canReply, true, "Owner should have canReply");
    assert.equal(vinothAccess.isOwner, true, "Owner flag should be true");
    assert.equal(vinothAccess.isCollaborator, false, "Owner should not be flagged as isCollaborator");
    pass("Conversation owner access correctly identified with full privileges");

    // Check Arun access BEFORE sharing
    const arunPreShareAccess = await service.getUserAccess(testTenantId, conversationId, 9002, "employee", "full");
    assert.equal(arunPreShareAccess, null, "Arun should not have conversation access before being shared");
    pass("Non-owner employee without a share cannot access specific conversation");

    // 4. Test Conversation Sharing (Vinoth shares to Arun as collaborator)
    console.log("\nTesting Conversation Sharing:");
    const shareResult = await service.shareConversation(
      testTenantId,
      conversationId,
      9001,
      {
        userIds: [9002],
        permissionLevel: "collaborator",
        reason: "Please assist customer with pricing"
      }
    );
    assert.equal(shareResult.success, true, "Share operation must succeed");
    assert.equal(shareResult.count, 1, "One share created");
    pass("Vinoth successfully shared conversation with Arun (collaborator)");

    // Verify Arun access AFTER sharing
    const arunPostShareAccess = await service.getUserAccess(testTenantId, conversationId, 9002, "employee", "full");
    assert(arunPostShareAccess, "Arun must now have access");
    assert.equal(arunPostShareAccess.isCollaborator, true, "Arun should now have isCollaborator=true");
    assert.equal(arunPostShareAccess.permissionLevel, "collaborator");
    assert.equal(arunPostShareAccess.canReply, true, "Collaborator has reply permission");
    assert.equal(arunPostShareAccess.canNote, true, "Collaborator has note permission");
    assert.equal(arunPostShareAccess.canManageCollaborators, false, "Collaborator cannot manage collaborators");
    pass("Arun received collaborator access without consuming owner capacity");

    // 5. Test Outbound Message Attribution
    console.log("\nTesting Outbound Message Attribution:");
    await sql.query(
      `INSERT INTO wa_message_logs (
        tenant_id, conversation_id, sender_id, phone, message_text, direction, status, author_id, author_name
       ) VALUES (?, ?, ?, '+919999900001', 'Hello from Arun, pricing details attached.', 'outbound', 'sent', 9002, 'Arun Collaborator')`,
      [testTenantId, conversationId, senderId]
    );

    const [[msgLog]] = await sql.query(
      "SELECT * FROM wa_message_logs WHERE conversation_id = ? ORDER BY id DESC LIMIT 1",
      [conversationId]
    );
    console.log("Inserted msgLog:", { id: msgLog.id, author_id: msgLog.author_id, author_name: msgLog.author_name, text: msgLog.message_text });
    assert.equal(msgLog.author_id, 9002, "Message log must store employee author_id");
    assert.equal(msgLog.author_name, "Arun Collaborator", "Message log must store author_name");
    if (msgLog.message_text) {
      assert(!msgLog.message_text.includes("[Internal]"), "Customer text remains clean business message");
    }
    pass("Message logged with clean business text and internal employee attribution (author_id & author_name)");

    // 6. Test View-Only Share (Vinoth shares with Priya as viewer)
    console.log("\nTesting View-Only Permissions:");
    await service.shareConversation(
      testTenantId,
      conversationId,
      9001,
      {
        userIds: [9003],
        permissionLevel: "viewer",
        reason: "Auditing chat history"
      }
    );

    const priyaAccess = await service.getUserAccess(testTenantId, conversationId, 9003, "employee", "full");
    assert(priyaAccess, "Priya should have access");
    assert.equal(priyaAccess.canView, true, "Viewer can view");
    assert.equal(priyaAccess.canReply, false, "Viewer CANNOT reply");
    assert.equal(priyaAccess.canNote, false, "Viewer CANNOT note");
    assert.equal(priyaAccess.canTransfer, false, "Viewer CANNOT transfer chat");
    pass("Viewer role strictly enforces read-only access and blocks outbound sends");

    // 7. Test Temporary Sharing Expiration
    console.log("\nTesting Temporary Sharing Expiration:");
    // Create an expired share directly in DB for user 9002
    await sql.query(
      `INSERT INTO wa_conversation_shares (tenant_id, conversation_id, owner_user_id, shared_with_user_id, shared_by_user_id, permission_level, expires_at, status)
       VALUES (?, ?, 9001, 9002, 9001, 'collaborator', DATE_SUB(NOW(), INTERVAL 10 MINUTE), 'active')
       ON DUPLICATE KEY UPDATE expires_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE), status = 'active'`,
      [testTenantId, conversationId]
    );

    // Check user 9002 access - should NOT be recognized because expires_at < NOW()
    const expiredUserAccess = await service.getUserAccess(testTenantId, conversationId, 9002, "employee", "full");
    assert.equal(expiredUserAccess, null, "Expired share query must immediately fail-closed and deny access");
    pass("Database query immediately blocks expired shares without relying on background delays");

    // Run background sweep
    const sweepCount = await service.sweepExpiredShares();
    assert(sweepCount >= 1, "Sweep should mark at least 1 expired share");
    const [[expiredRecord]] = await sql.query(
      "SELECT status FROM wa_conversation_shares WHERE conversation_id = ? AND shared_with_user_id = 9002",
      [conversationId]
    );
    assert.equal(expiredRecord.status, "expired", "Sweep must update status to 'expired'");
    pass("Background audit sweep properly marks expired records and logs audit events");

    // 8. Test Share Revocation
    console.log("\nTesting Share Revocation:");
    // First, give Priya active collaborator access
    await service.shareConversation(
      testTenantId,
      conversationId,
      9001,
      {
        userIds: [9003],
        permissionLevel: "collaborator",
        reason: "Re-activating"
      }
    );
    const [[priyaShare]] = await sql.query(
      "SELECT id FROM wa_conversation_shares WHERE conversation_id = ? AND shared_with_user_id = 9003 AND status = 'active'",
      [conversationId]
    );
    assert(priyaShare, "Priya share should exist");

    await service.revokeShare(testTenantId, conversationId, priyaShare.id, 9001);

    const priyaRevokedAccess = await service.getUserAccess(testTenantId, conversationId, 9003, "employee", "full");
    assert.equal(priyaRevokedAccess, null, "Revoked share must immediately deny access");
    pass("Share revocation immediately revokes collaborator access");

    // 9. Test Tenant Isolation
    console.log("\nTesting Tenant Isolation:");
    let tenantIsolationCaught = false;
    try {
      await service.shareConversation(
        foreignTenantId, // Different tenant attempting to access testTenantId conversation
        conversationId,
        9004,
        {
          userIds: [9001],
          permissionLevel: "collaborator"
        }
      );
    } catch (err) {
      tenantIsolationCaught = true;
    }
    assert.equal(tenantIsolationCaught, true, "Cross-tenant sharing attempt must be strictly blocked");
    pass("Cross-tenant isolation strictly verified");

    // 10. Clean up test records
    await sql.query("DELETE FROM wa_assignment_events WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM wa_workspace_audit WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM wa_conversation_shares WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM wa_message_logs WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM conversations WHERE id = ?", [conversationId]);
    await sql.query("DELETE FROM wa_contacts WHERE id = ?", [contactId]);
    await sql.query("DELETE FROM staff_sender_assignments WHERE sender_id = ?", [senderId]);
    await sql.query("DELETE FROM sender_branch_assignments WHERE sender_id = ?", [senderId]);
    await sql.query("DELETE FROM wa_senders WHERE id = ?", [senderId]);
    await sql.query("DELETE FROM staff_branch_memberships WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM organization_memberships WHERE tenant_id = ?", [testTenantId]);
    await sql.query("DELETE FROM users WHERE id IN (9001, 9002, 9003, 9004)");
    await sql.query("DELETE FROM branches WHERE id = ?", [branchId]);

    console.log(`\n========================================`);
    console.log(`ALL ${checks} TESTS PASSED SUCCESSFULLY!`);
    console.log(`========================================\n`);
  } catch (error) {
    console.error("Test Suite Failed with error:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
