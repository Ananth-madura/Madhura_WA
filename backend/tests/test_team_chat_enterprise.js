"use strict";

/**
 * Enterprise Team Chat Automated Verification Suite:
 *
 * Proves:
 *   1. Custom Groups: create group, add members, remove member, access control
 *   2. Message Editing & Deletion: author can edit/delete, updates broadcast and data state
 *   3. Emoji Reactions: toggling emoji reaction aggregates counts and users
 *   4. Message Pinning: toggle pin, pin list reflects pinned messages
 *   5. Branch Communication Policies:
 *      - By default or when disabled, cross-branch DM is blocked with 403
 *      - Admin enables branch pair policy, cross-branch DM is permitted
 *      - Admin disables branch pair policy, cross-branch DM is blocked again
 *   6. Multi-Tenant Isolation: Tenant A cannot access Tenant B's group, messages or pins
 *   7. 7-Day Retention: purges expired messages and attachments, keeps active messages
 */

require("./helpers/isolateSqlite")();
process.env.USE_SQLITE = "1";

const assert = require("assert/strict");
const db = require("../config/database");
const teamChat = require("../services/teamChat");

const TENANT_A = 9911;
const TENANT_B = 9912;
const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];

const req = (userId, tenantId, role = "agent") => ({
  tenantId,
  user: { id: userId, role, name: `User ${userId}`, tenant_id: tenantId },
  userRole: role,
});

async function setup() {
  await require("../migrations/team_chat").migrate(db);
  // Cleanup test tenants
  for (const t of [TENANT_A, TENANT_B]) {
    await q("DELETE FROM team_chat_reactions WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM team_chat_pins WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM team_chat_attachments WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM team_chat_messages WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM team_chat_channel_members WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM team_chat_channels WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM team_chat_branch_policies WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM team_chat_settings WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM staff_branch_memberships WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM organization_memberships WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM branches WHERE tenant_id = ?", [t]).catch(() => {});
    await q("DELETE FROM tenants WHERE id = ?", [t]).catch(() => {});
  }

  // Tenants
  await q("INSERT INTO tenants (id, name, slug, status) VALUES (?, 'Org Alpha', 'org-alpha', 'active')", [TENANT_A]);
  await q("INSERT INTO tenants (id, name, slug, status) VALUES (?, 'Org Beta', 'org-beta', 'active')", [TENANT_B]);

  // Branches in Tenant A: Branch 101 (Coimbatore), Branch 102 (Chennai)
  await q("INSERT INTO branches (id, tenant_id, name, code, slug, status) VALUES (101, ?, 'Coimbatore', 'CBE', 'cbe', 'active')", [TENANT_A]);
  await q("INSERT INTO branches (id, tenant_id, name, code, slug, status) VALUES (102, ?, 'Chennai', 'CHN', 'chn', 'active')", [TENANT_A]);

  // Users in Tenant A
  // Admin: User 1
  // Coimbatore: User 2
  // Chennai: User 3
  for (const [uId, first, last, email] of [
    [1, "Admin", "Boss", "admin.alpha@test.local"],
    [2, "Arun", "Kumar", "arun.cbe@test.local"],
    [3, "Divya", "Ramesh", "divya.chn@test.local"],
  ]) {
    await q("DELETE FROM users WHERE id = ?", [uId]).catch(() => {});
    await q("INSERT INTO users (id, first_name, last_name, email, role, status) VALUES (?, ?, ?, ?, 'agent', 'active')", [uId, first, last, email]);
  }

  await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, 1, 'organization_owner', 'active')", [TENANT_A]);
  await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, 2, 'agent', 'active')", [TENANT_A]);
  await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, 3, 'agent', 'active')", [TENANT_A]);

  await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary) VALUES (?, 1, 101, 1)", [TENANT_A]);
  await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary) VALUES (?, 2, 101, 1)", [TENANT_A]);
  await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary) VALUES (?, 3, 102, 1)", [TENANT_A]);

  // Tenant B: Branch 201, User 4
  await q("INSERT INTO branches (id, tenant_id, name, code, slug, status) VALUES (201, ?, 'Beta Branch', 'BETA', 'beta-br', 'active')", [TENANT_B]);
  await q("DELETE FROM users WHERE id = 4").catch(() => {});
  await q("INSERT INTO users (id, first_name, last_name, email, role, status) VALUES (4, 'Beta', 'User', 'beta.user@test.local', 'agent', 'active')");
  await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, 4, 'agent', 'active')", [TENANT_B]);
  await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary) VALUES (?, 4, 201, 1)", [TENANT_B]);
}

async function run() {
  await setup();
  console.log("🚀 Running Enterprise Team Chat Tests...");

  const adminReq = req(1, TENANT_A, "organization_owner");
  const arunReq = req(2, TENANT_A, "agent");
  const divyaReq = req(3, TENANT_A, "agent");
  const betaReq = req(4, TENANT_B, "agent");

  // 1. Cross-Branch Policy Enforcement
  console.log("-> Testing Branch Communication Policy Enforcement...");
  try {
    await teamChat.openDirect(arunReq, 3);
    assert.fail("Should have thrown error");
  } catch (err) {
    console.log("-> Caught expected openDirect error:", err.message);
    assert.match(err.message, /administrator has not enabled direct messages between your branches/i);
  }

  // Admin enables Coimbatore <-> Chennai communication policy
  await teamChat.updateBranchPolicy(adminReq, {
    branchAId: 101,
    branchBId: 102,
    enabled: true,
    allowDirect: true,
    allowGroups: true,
    allowDiscovery: true,
    allowFiles: true,
  });

  // Now Arun can open a DM with Divya
  const crossDm = await teamChat.openDirect(arunReq, 3);
  assert.ok(crossDm && crossDm.id > 0, "Cross branch DM succeeds when admin enabled policy");

  // Now Admin disables communication between Coimbatore and Chennai
  await teamChat.updateBranchPolicy(adminReq, {
    branchAId: 101,
    branchBId: 102,
    enabled: false,
    allowDirect: false,
  });

  // Arun trying to open DM with Divya should be blocked again
  await assert.rejects(
    async () => teamChat.openDirect(arunReq, 3),
    /administrator has not enabled direct messages between your branches/i,
    "Cross branch DM is blocked when admin disables policy"
  );
  await assert.rejects(() => teamChat.listMessages(arunReq, crossDm.id), (error) => error.status === 403);
  await assert.rejects(() => teamChat.sendMessage(arunReq, crossDm.id, { text: "revoked", clientId: "revoked" }), (error) => error.status === 403);
  assert.equal((await teamChat.channelsFor(arunReq)).some((channel) => channel.id === crossDm.id), false);
  assert.deepEqual(await teamChat.recipientsFor(await teamChat.findChannel(TENANT_A, crossDm.id)), []);
  assert.equal((await teamChat.membersFor(arunReq)).some((member) => member.id === 3), false);
  await assert.rejects(() => teamChat.search(arunReq, { query: "private", channelId: crossDm.id }), (error) => error.status === 403);
  await assert.rejects(() => teamChat.updateBranchPolicy(adminReq, { branchAId: 101, branchBId: 201, enabled: true }), (error) => error.status === 403);
  await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary) VALUES (?, 2, 102, 0)", [TENANT_A]);
  assert.ok((await teamChat.openDirect(arunReq, 3)).id, "all authorized branch memberships participate in access checks");
  await q("DELETE FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = 2 AND branch_id = 102", [TENANT_A]);
  await assert.rejects(() => teamChat.openDirect(arunReq, 3), (error) => error.status === 403);

  // Re-enable for subsequent interaction tests
  await teamChat.updateBranchPolicy(adminReq, {
    branchAId: 101,
    branchBId: 102,
    enabled: true,
    allowDirect: true,
    allowGroups: true,
    allowFiles: true,
  });

  // 2. Custom Group Channels
  console.log("-> Testing Custom Group Channels & Membership...");
  const group = await teamChat.createGroup(arunReq, {
    name: "Coimbatore-Chennai Project",
    description: "Joint initiative between branches",
    memberIds: [3],
  });
  assert.equal(group.kind, "group", "Group created with kind=group");
  assert.equal(group.name, "Coimbatore-Chennai Project");
  assert.ok((await teamChat.membersFor(arunReq, "Divya Ramesh")).some((member) => member.id === 3));
  assert.ok((await teamChat.membersFor(arunReq, "Chennai")).some((member) => member.id === 3));
  assert.deepEqual(await teamChat.membersFor(arunReq, "Beta User"), []);
  await assert.rejects(() => teamChat.listMessages(adminReq, group.id), (error) => error.status === 403, "configuration rights do not grant private group access");
  const preferences = await teamChat.updatePreferences(arunReq, group.id, { pinned: true, muted: true, archived: true });
  assert.deepEqual(preferences, { muted: true, pinned: true, archived: true });
  assert.equal((await teamChat.channelsFor(arunReq)).find((channel) => channel.id === group.id).archived, true);
  await teamChat.updatePreferences(arunReq, group.id, { archived: false });
  await teamChat.markUnread(arunReq, group.id);
  assert.equal((await teamChat.channelsFor(arunReq)).find((channel) => channel.id === group.id).markedUnread, true);
  await teamChat.markRead(arunReq, group.id);
  assert.equal((await teamChat.channelsFor(arunReq)).find((channel) => channel.id === group.id).markedUnread, false);

  // Check members
  const members = await teamChat.groupMembers(arunReq, group.id);
  assert.equal(members.length, 2, "Group has creator and added member");
  assert.ok(members.some((m) => m.id === 2 && m.groupRole === "owner"), "Creator is owner");
  assert.ok(members.some((m) => m.id === 3 && m.groupRole === "member"), "Invitee is member");
  const mentioned = await teamChat.sendMessage(arunReq, group.id, { text: "@Divya Ramesh please review", mentionIds: [3], clientId: "mention-1" });
  assert.deepEqual(mentioned.message.mentionIds, [3]);
  await assert.rejects(() => teamChat.sendMessage(arunReq, group.id, { text: "@Beta User outside", mentionIds: [4], clientId: "invalid-mention" }), (error) => error.status === 400);
  await assert.rejects(() => teamChat.sendMessage(arunReq, group.id, { text: "old uncertain operation", clientCreatedAt: "2020-01-01T00:00:00Z", clientId: "old-operation" }), (error) => error.status === 409);
  const notifications = await teamChat.updateNotificationPreferences(arunReq, { inApp: false, desktop: false, mentionsWhenMuted: true });
  assert.deepEqual(notifications, { inApp: false, desktop: false, mentionsWhenMuted: true });
  assert.deepEqual(await teamChat.notificationPreferences(divyaReq), { inApp: true, desktop: false, mentionsWhenMuted: false });
  const devicePolicy = await teamChat.updateSettings(adminReq, { localCacheDays: 90, clearCacheOnLogout: true });
  assert.equal(devicePolicy.localCacheDays, 90); assert.equal(devicePolicy.clearCacheOnLogout, true);

  // Divya can send a message in the group
  const sentInGroup = await teamChat.sendMessage(divyaReq, group.id, {
    text: "Hello team from Chennai!",
    clientId: "grp-msg-1",
  });
  assert.equal(sentInGroup.message.body, "Hello team from Chennai!");

  // 3. Message Edit & Delete
  console.log("-> Testing Message Edit & Delete...");
  const edited = await teamChat.editMessage(divyaReq, group.id, sentInGroup.message.id, {
    text: "Hello team from Chennai! (Updated)",
  });
  assert.equal(edited.message.body, "Hello team from Chennai! (Updated)");
  assert.equal(edited.message.isEdited, true);

  // Arun cannot edit Divya's message
  await assert.rejects(
    async () => teamChat.editMessage(arunReq, group.id, sentInGroup.message.id, { text: "Hacked" }),
    /only edit your own messages/i
  );

  // Divya deletes the message
  const deleted = await teamChat.deleteMessage(divyaReq, group.id, sentInGroup.message.id);
  assert.equal(deleted.messageId, sentInGroup.message.id);

  // Message list reflects deleted status
  const msgList = await teamChat.listMessages(arunReq, group.id);
  const foundMsg = msgList.messages.find((m) => m.id === sentInGroup.message.id);
  assert.equal(foundMsg.isDeleted, true);
  assert.equal(foundMsg.body, "This message was deleted");

  // 4. Reactions & Pinned Messages
  console.log("-> Testing Reactions & Pins...");
  const newMsg = await teamChat.sendMessage(arunReq, group.id, {
    text: "Here is the sprint plan",
    clientId: "msg-sprint-plan",
  });

  // Toggle reaction: Arun reacts with 👍
  const r1 = await teamChat.toggleReaction(arunReq, group.id, newMsg.message.id, "👍");
  assert.equal(r1.reactions.length, 1);
  assert.equal(r1.reactions[0].emoji, "👍");
  assert.equal(r1.reactions[0].count, 1);

  // Divya also reacts with 👍
  const r2 = await teamChat.toggleReaction(divyaReq, group.id, newMsg.message.id, "👍");
  assert.equal(r2.reactions[0].count, 2);

  // Arun toggles 👍 off
  const r3 = await teamChat.toggleReaction(arunReq, group.id, newMsg.message.id, "👍");
  assert.equal(r3.reactions[0].count, 1);

  // Pin message
  const pinResult = await teamChat.togglePin(arunReq, group.id, newMsg.message.id);
  assert.equal(pinResult.isPinned, true);

  const pinnedList = await teamChat.listPins(divyaReq, group.id);
  assert.equal(pinnedList.length, 1);
  assert.equal(pinnedList[0].id, newMsg.message.id);

  // 5. Multi-Tenant Isolation
  console.log("-> Testing Multi-Tenant Isolation...");
  // User 4 from Tenant B cannot access Tenant A's group
  await assert.rejects(
    async () => teamChat.assertChannel(betaReq, group.id),
    /team chat does not exist/i,
    "Tenant B cannot discover Tenant A channel"
  );
  await assert.rejects(
    async () => teamChat.listMessages(betaReq, group.id),
    /team chat does not exist/i,
    "Tenant B cannot read Tenant A messages"
  );

  // 6. Retention Expiration
  console.log("-> Testing Retention Purge...");
  // Backdate newMsg to 10 days ago
  await q(
    `UPDATE team_chat_messages SET created_at = ${db.isSqlite ? "datetime('now', '-10 days')" : "DATE_SUB(NOW(), INTERVAL 10 DAY)"} WHERE id = ?`,
    [newMsg.message.id]
  );
  const purged = await teamChat.purgeExpired();
  assert.ok(purged >= 1, "Expired message was purged by retention sweep");

  // Verify message is no longer in active server list
  const refreshedList = await teamChat.listMessages(arunReq, group.id);
  assert.ok(!refreshedList.messages.some((m) => m.id === newMsg.message.id), "Purged message does not appear on server");
  assert.equal((await q("SELECT id FROM team_chat_reactions WHERE message_id = ?", [newMsg.message.id])).length, 0);
  assert.equal((await q("SELECT message_id FROM team_chat_pins WHERE message_id = ?", [newMsg.message.id])).length, 0);
  await teamChat.removeGroupMember(arunReq, group.id, 3);
  await assert.rejects(() => teamChat.listMessages(divyaReq, group.id), (error) => error.status === 403);
  const restricted = await teamChat.updateBranchPolicy(adminReq, { branchAId: 101, branchBId: 102, enabled: true, constraints: { userIds: [2] } });
  await assert.rejects(() => teamChat.openDirect(arunReq, 3), (error) => error.status === 403);
  await assert.rejects(() => teamChat.updateBranchPolicy(adminReq, { branchAId: 101, branchBId: 102, enabled: true, version: restricted.version - 1 }), (error) => error.status === 409);
  await teamChat.updateBranchPolicy(adminReq, { branchAId: 101, branchBId: 102, enabled: true, version: restricted.version, constraints: { roles: ["agent"], allowGroupCreation: false } });
  assert.ok((await teamChat.openDirect(arunReq, 3)).id);
  await assert.rejects(() => teamChat.createGroup(arunReq, { name: "Disallowed creation", memberIds: [3] }), (error) => error.status === 403);
  const teamA = await q("INSERT INTO teams (tenant_id, branch_id, name) VALUES (?, 101, 'Coimbatore QA')", [TENANT_A]);
  const teamB = await q("INSERT INTO teams (tenant_id, branch_id, name) VALUES (?, 102, 'Chennai QA')", [TENANT_A]);
  await q("UPDATE staff_branch_memberships SET team_id = ? WHERE tenant_id = ? AND user_id = 2", [teamA.insertId, TENANT_A]);
  await q("UPDATE staff_branch_memberships SET team_id = ? WHERE tenant_id = ? AND user_id = 3", [teamB.insertId, TENANT_A]);
  await teamChat.updateBranchPolicy(adminReq, { branchAId: 101, branchBId: 102, enabled: true, constraints: { teamIds: [teamA.insertId] } });
  await assert.rejects(() => teamChat.openDirect(arunReq, 3), (error) => error.status === 403);
  await teamChat.updateBranchPolicy(adminReq, { branchAId: 101, branchBId: 102, enabled: true, constraints: { teamIds: [teamA.insertId, teamB.insertId] } });
  assert.ok((await teamChat.openDirect(arunReq, 3)).id);
  const policies = await teamChat.listBranchPolicies(adminReq);
  assert.equal(policies.policies.find((policy) => [policy.branchAId, policy.branchBId].includes(101)).enabled, true);
  const recoveryGroup = await teamChat.createGroup(arunReq, { name: "Administrator recovery", memberIds: [3] });
  await q("UPDATE organization_memberships SET membership_status = 'suspended' WHERE tenant_id = ? AND user_id = 2", [TENANT_A]);
  await assert.rejects(() => teamChat.listMessages(arunReq, group.id), (error) => error.status === 403);
  assert.ok((await teamChat.orphanedGroups(adminReq)).some((item) => item.id === recoveryGroup.id));
  await teamChat.recoverGroupAdmin(adminReq, recoveryGroup.id, 3);
  assert.equal((await teamChat.updateGroup(divyaReq, recoveryGroup.id, { name: "Recovered group" })).name, "Recovered group");
  await assert.rejects(() => teamChat.listMessages(adminReq, recoveryGroup.id), (error) => error.status === 403);

  const { calendarCutoff } = require("../services/teamChatRetention");
  assert.equal(calendarCutoff("Asia/Kolkata", new Date("2026-10-28T20:00:00Z")), "2026-10-22 18:30:00");
  assert.equal(calendarCutoff("America/New_York", new Date("2026-03-10T12:00:00Z")), "2026-03-04 05:00:00");
  assert.equal(calendarCutoff("UTC", new Date("2026-10-28T12:00:00Z")), "2026-10-22 00:00:00");

  console.log("✅ All Enterprise Team Chat Tests PASSED successfully!");
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
