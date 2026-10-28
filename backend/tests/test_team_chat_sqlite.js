"use strict";

/**
 * Internal team chat: isolation, policy, idempotency and retention.
 *
 * Runs against the real bootstrap on the SQLite engine (same schema path the
 * server takes), then drives `services/teamChat.js` with hand-built `req`
 * objects. That is deliberate: the service is the security boundary, so the
 * assertions target it directly instead of trusting the HTTP wrapper.
 *
 * Covered here:
 *
 *   • tenant isolation      — another organization's channel is "not found"
 *   • branch isolation      — a member sees and writes only their own branch
 *   • admin reach           — an organization admin sees every branch
 *   • direct messages       — branch-only by default, cross-branch after opt-in
 *   • idempotent send       — a retried clientId cannot duplicate a message
 *   • unread counts         — counted per reader, cleared by markRead
 *   • seven-day retention   — purge deletes yesterday's server copy, reads hide it
 *   • socket fan-out        — a direct message reaches only its two participants
 *
 * Run:  node tests/test_team_chat_sqlite.js
 */

require("./helpers/isolateSqlite")();
process.env.USE_SQLITE = "1";

const assert = require("assert/strict");
const db = require("../config/database");

const suffix = Math.random().toString(36).slice(2, 8);
const TENANT_A = 9901;
const TENANT_B = 9902;

const ids = {};
const req = (userId, tenantId, role) => ({
  tenantId,
  user: { id: userId, role, name: `User ${userId}` },
  userRole: role,
});

const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];

async function cleanup() {
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await q("DELETE FROM team_chat_messages WHERE tenant_id = ?", [tenantId]).catch(() => {});
    await q("DELETE FROM team_chat_reads WHERE tenant_id = ?", [tenantId]).catch(() => {});
    await q("DELETE FROM team_chat_channels WHERE tenant_id = ?", [tenantId]).catch(() => {});
    await q("DELETE FROM team_chat_settings WHERE tenant_id = ?", [tenantId]).catch(() => {});
    await q("DELETE FROM staff_branch_memberships WHERE tenant_id = ?", [tenantId]).catch(() => {});
    await q("DELETE FROM organization_memberships WHERE tenant_id = ?", [tenantId]).catch(() => {});
    await q("DELETE FROM branches WHERE tenant_id = ?", [tenantId]).catch(() => {});
    await q("DELETE FROM tenants WHERE id = ?", [tenantId]).catch(() => {});
    await q("DELETE FROM users WHERE email LIKE ?", [`tc-${suffix}-%@test.local`]).catch(() => {});
  }
}

async function fixture() {
  for (const [tenantId, name] of [[TENANT_A, "Team Chat Test A"], [TENANT_B, "Team Chat Test B"]]) {
    await q("INSERT INTO tenants (id, name, slug, status) VALUES (?, ?, ?, 'active')", [
      tenantId,
      name,
      `tc-${suffix}-${tenantId}`,
    ]);
  }

  const addUser = async (key, first) => {
    const result = await q(
      "INSERT INTO users (first_name, last_name, email, role, status) VALUES (?, 'Tester', ?, 'employee', 'active')",
      [first, `tc-${suffix}-${key}@test.local`]
    );
    ids[key] = Number(result.insertId);
    assert.ok(ids[key] > 0, `fixture user ${key} was created`);
    return ids[key];
  };

  await addUser("admin", "Ada");
  await addUser("alpha", "Alfa");
  await addUser("beta", "Beta");
  await addUser("outsider", "Oscar");

  await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, 'organization_admin', 'active')", [TENANT_A, ids.admin]);
  await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, 'agent', 'active')", [TENANT_A, ids.alpha]);
  await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, 'agent', 'active')", [TENANT_A, ids.beta]);
  await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, 'agent', 'active')", [TENANT_B, ids.outsider]);

  const branch = async (tenantId, code, name, head = 0) => {
    const result = await q(
      "INSERT INTO branches (tenant_id, code, name, is_head_office, status) VALUES (?, ?, ?, ?, 'active')",
      [tenantId, code, name, head]
    );
    return Number(result.insertId);
  };
  const alphaBranch = await branch(TENANT_A, `A-${suffix}`, "Alpha Branch", 1);
  const betaBranch = await branch(TENANT_A, `B-${suffix}`, "Beta Branch", 0);
  const outsideBranch = await branch(TENANT_B, `C-${suffix}`, "Outside Branch", 1);
  ids.alphaBranch = alphaBranch;
  ids.betaBranch = betaBranch;
  ids.outsideBranch = outsideBranch;

  await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id) VALUES (?, ?, ?)", [TENANT_A, ids.alpha, alphaBranch]);
  await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id) VALUES (?, ?, ?)", [TENANT_A, ids.admin, alphaBranch]);
  await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id) VALUES (?, ?, ?)", [TENANT_A, ids.beta, betaBranch]);
  await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id) VALUES (?, ?, ?)", [TENANT_B, ids.outsider, outsideBranch]);
}

(async () => {
  await db.ready;
  const teamChat = require("../services/teamChat");
  await require("../migrations/team_chat").migrate(db);
  await cleanup();
  await fixture();

  const admin = req(ids.admin, TENANT_A, "organization_admin");
  const alpha = req(ids.alpha, TENANT_A, "agent");
  const beta = req(ids.beta, TENANT_A, "agent");
  const outsider = req(ids.outsider, TENANT_B, "agent");

  // ── 1. Channel visibility ────────────────────────────────────────────────
  const adminBoot = await teamChat.bootstrap(admin);
  const org = adminBoot.channels.find((channel) => channel.kind === "branch" && Number(channel.branchId) === ids.alphaBranch);
  const adminBranches = adminBoot.channels.filter((channel) => channel.kind === "branch");
  assert.equal(adminBranches.length, 2, "an organization admin sees every branch channel");
  assert.ok(org, "the administrator can access the branch channel");

  const alphaBoot = await teamChat.bootstrap(alpha);
  const alphaBranches = alphaBoot.channels.filter((channel) => channel.kind === "branch");
  assert.equal(alphaBranches.length, 1, "a member sees only their own branch");
  assert.equal(Number(alphaBranches[0].branchId), ids.alphaBranch, "the visible branch is the member's own");
  assert.equal(alphaBoot.channels.some((channel) => channel.kind === "organization"), false, "company-wide channels cannot bypass branch isolation");

  const outsiderBoot = await teamChat.bootstrap(outsider);
  assert.equal(
    outsiderBoot.channels.some((channel) => Number(channel.id) === Number(org.id)),
    false,
    "another organization never receives this organization's channel"
  );

  // ── 2. Cross-tenant access fails closed ──────────────────────────────────
  await assert.rejects(
    () => teamChat.listMessages(outsider, org.id),
    (error) => error.status === 404 && error.code === "CHANNEL_NOT_FOUND",
    "a foreign channel id resolves to not-found, not to a foreign thread"
  );
  await assert.rejects(
    () => teamChat.sendMessage(outsider, org.id, { text: "leak attempt" }),
    (error) => error.status === 404,
    "a foreign channel cannot be written to"
  );

  // ── 3. Branch write isolation ────────────────────────────────────────────
  const alphaChannel = alphaBranches[0];
  await assert.rejects(
    () => teamChat.listMessages(alpha, adminBranches.find((channel) => Number(channel.branchId) === ids.betaBranch).id),
    (error) => error.status === 403 && error.code === "CHANNEL_FORBIDDEN",
    "a member cannot read the other branch's channel"
  );
  await assert.rejects(
    () => teamChat.sendMessage(alpha, adminBranches.find((channel) => Number(channel.branchId) === ids.betaBranch).id, { text: "wrong branch" }),
    (error) => error.status === 403,
    "a member cannot write to the other branch's channel"
  );

  // ── 4. Sending, idempotency and unread counts ────────────────────────────
  const first = await teamChat.sendMessage(admin, org.id, { text: "All-hands at 4pm", clientId: "org-1" });
  assert.equal(first.message.body, "All-hands at 4pm", "the message body round-trips");
  assert.equal(Number(first.message.senderId), ids.admin, "the sender is the authenticated user");

  const replay = await teamChat.sendMessage(admin, org.id, { text: "All-hands at 4pm", clientId: "org-1" });
  assert.equal(replay.message.id, first.message.id, "a retried clientId returns the original row");
  const orgRows = await q("SELECT id FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ?", [TENANT_A, org.id]);
  assert.equal(orgRows.length, 1, "the retry did not create a duplicate");

  const alphaView = await teamChat.listMessages(alpha, org.id, { limit: 50 });
  assert.equal(alphaView.messages.length, 1, "the member receives the company-wide message");

  let alphaList = await teamChat.channelsFor(alpha);
  assert.equal(alphaList.find((channel) => Number(channel.id) === Number(org.id)).unread, 1, "unread is counted for the reader");

  await teamChat.markRead(alpha, org.id);
  alphaList = await teamChat.channelsFor(alpha);
  assert.equal(alphaList.find((channel) => Number(channel.id) === Number(org.id)).unread, 0, "markRead clears the badge");

  const betaList = await teamChat.channelsFor(beta);
  assert.equal(betaList.some((channel) => Number(channel.id) === Number(org.id)), false, "another branch cannot see this channel");

  // ── 5. Branch channel delivery reaches members and admins ────────────────
  await teamChat.sendMessage(alpha, alphaChannel.id, { text: "Counter open", clientId: "alpha-1" });
  const alphaBranchView = await teamChat.listMessages(admin, alphaChannel.id, { limit: 50 });
  assert.equal(alphaBranchView.messages.some((message) => message.body === "Counter open"), true, "an admin can read every branch");
  const branchRecipients = await teamChat.recipientsFor(await teamChat.assertChannel(admin, alphaChannel.id));
  assert.equal(branchRecipients.includes(ids.alpha), true, "a branch member is a recipient");
  assert.equal(branchRecipients.includes(ids.admin), true, "an admin is a recipient of branch traffic");
  assert.equal(branchRecipients.includes(ids.beta), false, "the other branch is never a recipient");
  assert.equal(branchRecipients.includes(ids.outsider), false, "another organization is never a recipient");

  // ── 6. Direct messages: branch-only until an admin opts in ───────────────
  await assert.rejects(
    () => teamChat.openDirect(alpha, ids.beta),
    (error) => error.status === 403 && error.code === "CROSS_BRANCH_DISABLED",
    "cross-branch direct messages are refused by default"
  );
  const sameBranch = await teamChat.openDirect(alpha, ids.admin);
  assert.equal(sameBranch.kind, "direct", "an administrator in the same branch can be messaged");
  await teamChat.openDirect(alpha, ids.alpha).then(
    () => assert.fail("self direct message must fail"),
    (error) => assert.equal(error.code, "INVALID_MEMBER", "self direct messages are refused")
  );

  await assert.rejects(
    () => teamChat.updateSettings(alpha, { crossBranchDm: true }),
    (error) => error.status === 403,
    "a non-admin cannot change the policy"
  );
  await teamChat.updateBranchPolicy(admin, { branchAId: ids.alphaBranch, branchBId: ids.betaBranch, enabled: true, allowDirect: true });
  const crossBranch = await teamChat.openDirect(alpha, ids.beta);
  assert.equal(crossBranch.kind, "direct", "the admin opt-in opens cross-branch messaging");
  const dmChannels = await q("SELECT id FROM team_chat_channels WHERE tenant_id = ? AND kind = 'direct'", [TENANT_A]);
  assert.equal(dmChannels.length, 2, "the direct channels are reused, not duplicated");

  const dmRecipients = await teamChat.recipientsFor(await teamChat.assertChannel(alpha, crossBranch.id));
  assert.deepEqual(dmRecipients.slice().sort(), [ids.alpha, ids.beta].sort(), "a direct message is delivered to its two participants only");

  // A direct channel from another organization is still invisible.
  await assert.rejects(
    () => teamChat.listMessages(outsider, crossBranch.id),
    (error) => error.status === 403 || error.status === 404,
    "a foreign direct channel stays closed"
  );

  // ── 7. Socket fan-out never uses a tenant-wide room ──────────────────────
  const rooms = [];
  teamChat.emitMessage(
    { to: (room) => ({ emit: (event) => rooms.push({ room, event }) }) },
    {
      tenantId: TENANT_A,
      channelId: crossBranch.id,
      channelKind: "direct",
      message: { id: 123 },
      recipients: dmRecipients,
    }
  );
  assert.deepEqual(rooms.map((entry) => entry.room).sort(), [`user:${ids.alpha}`, `user:${ids.beta}`].sort(), "the socket payload targets only the participants");
  assert.equal(rooms.every((entry) => entry.event === "team_chat_message"), true, "the socket event name is stable");

  // ── 8. Retention: server keeps seven days, reads never show more ─────────
  await q(
    "INSERT INTO team_chat_messages (tenant_id, channel_id, sender_id, body, client_id, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-8 day'))",
    [TENANT_A, org.id, ids.admin, "expired message", "expired-1"]
  );
  const beforePurge = await teamChat.listMessages(alpha, org.id, { limit: 100 });
  assert.equal(beforePurge.messages.some((message) => message.body === "expired message"), false, "reads apply the seven-day window even before the sweep");

  const purged = await teamChat.purgeExpired();
  assert.ok(purged >= 1, "the sweep deletes at least the expired row");
  const expiredRows = await q("SELECT id FROM team_chat_messages WHERE tenant_id = ? AND client_id = 'expired-1'", [TENANT_A]);
  assert.equal(expiredRows.length, 0, "the expired server copy is gone");
  const freshRows = await q("SELECT id FROM team_chat_messages WHERE tenant_id = ? AND client_id = 'org-1'", [TENANT_A]);
  assert.equal(freshRows.length, 1, "messages inside the window survive the sweep");

  console.log("PASS: team chat isolation, DM policy, idempotency, unread counts and 7-day retention");
  process.exit(0);
})().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => {});
  process.exit(1);
});
