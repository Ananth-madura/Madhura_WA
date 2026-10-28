"use strict";

/**
 * Enterprise Internal Team Messaging Platform Service.
 *
 * Enforces:
 *   • Multi-Tenant Isolation — every read, write, search, attachment and audit log
 *     is strictly scoped by tenant_id. Cross-tenant access is impossible.
 *   • Branch Isolation & Administrative Cross-Branch Policies — granular control
 *     over branch-to-branch direct messages, groups, discovery, and file sharing.
 *   • Rolling Seven-Day Server Retention — server purges expired messages, reactions,
 *     attachments (from disk), pins, and reads. Local devices retain authorized archives.
 *   • Complete Interaction Model — direct messages, custom groups, message replies,
 *     edits, deletions, emoji reactions, message pinning, secure file attachments,
 *     typing status, and unread counts.
 *   • Real-Time WebSocket Delivery — emits scoped events exclusively to authorized user rooms.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const db = require("../config/database");
const { mediaDir, privateChatDir } = require("../config/runtimePaths");

const RETENTION_DAYS = 7;
const MAX_BODY = 4000;
const MAX_PAGE = 100;
const ADMIN_ROLES = new Set(["organization_owner", "organization_admin"]);
const transactionContext = new (require("node:async_hooks").AsyncLocalStorage)();

const query = async (sql, params = []) => (await (transactionContext.getStore() || db.promise()).query(sql, params))[0];

async function atomicMutation(work) {
  if (db.isSqlite || transactionContext.getStore()) return work();
  const connection = await new Promise((resolve, reject) => db.getConnection((error, client) => error ? reject(error) : resolve(client)));
  const client = connection.promise();
  try {
    await client.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await client.beginTransaction();
    const result = await transactionContext.run(client, work);
    await client.commit();
    return result;
  } catch (error) { await client.rollback(); throw error; }
  finally { connection.release(); }
}

async function windowSql(tenantId) {
  const [tenant] = await query("SELECT timezone FROM tenants WHERE id = ? LIMIT 1", [tenantId]);
  return `'${require("./teamChatRetention").calendarCutoff(tenant?.timezone || "UTC")}'`;
}

function fail(message, status = 400, code) {
  return Object.assign(new Error(message), { status, code });
}

function isAdmin(req) {
  return ADMIN_ROLES.has(req.userRole) || req.user?.role === "platform_admin";
}

function fullName(row) {
  if (!row) return "";
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || String(row.email || "").split("@")[0] || "Teammate";
}

function iso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  if (text.includes("T")) return text;
  return `${text.replace(" ", "T")}${db.isSqlite ? "Z" : ""}`;
}

function idsFromDmKey(key) {
  return String(key || "")
    .split(":")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
}

function dmKeyFor(a, b) {
  const one = Number(a);
  const two = Number(b);
  return `${Math.min(one, two)}:${Math.max(one, two)}`;
}

function uniqueIds(values) {
  if (!Array.isArray(values)) throw fail("Choose a list of employees or teams", 400);
  return [...new Set(values.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function branchPairKey(a, b) {
  const one = Number(a) || 0;
  const two = Number(b) || 0;
  return [Math.min(one, two), Math.max(one, two)];
}

/* ── Branch Communication Policies ────────────────────────────────────────── */

async function getBranchPolicy(tenantId, branchA, branchB) {
  const [a, b] = branchPairKey(branchA, branchB);
  if (a === b) return { enabled: 1, allowDirect: 1, allowGroups: 1, allowDiscovery: 1, allowFiles: 1 };
  const [row] = await query(
    `SELECT * FROM team_chat_branch_policies
      WHERE tenant_id = ? AND branch_a_id = ? AND branch_b_id = ? LIMIT 1`,
    [tenantId, a, b]
  );
  if (row) {
    let constraints;
    try { constraints = JSON.parse(row.constraints_json || "{}"); } catch (_) { return { enabled: false }; }
    return {
      id: Number(row.id),
      enabled: Boolean(Number(row.enabled)),
      allowDirect: Boolean(Number(row.allow_direct)),
      allowGroups: Boolean(Number(row.allow_groups)),
      allowDiscovery: Boolean(Number(row.allow_discovery)),
      allowFiles: Boolean(Number(row.allow_files)),
      constraints,
      version: Number(row.version) || 0,
    };
  }
  return {
    enabled: false,
    allowDirect: false,
    allowGroups: false,
    allowDiscovery: false,
    allowFiles: false,
  };
}

async function canCommunicateBranches(tenantId, branchA, branchB, feature = "allowDirect") {
  const policy = await getBranchPolicy(tenantId, branchA, branchB);
  if (!policy.enabled) return false;
  return Boolean(policy[feature]);
}

async function logAudit(tenantId, actorId, action, targetType, targetId = 0, details = null) {
  await query(
      "INSERT INTO team_chat_audit_logs (tenant_id, actor_id, action, target_type, target_id, details_json) VALUES (?, ?, ?, ?, ?, ?)",
      [tenantId, actorId, action, targetType, targetId, details ? JSON.stringify(details) : null]
  );
}

/* ── Channels & Access Control ────────────────────────────────────────────── */

async function findOrCreateChannel({ tenantId, kind, branchId = 0, dmKey = "", name = null, description = null, createdBy = null }) {
  const scope = [tenantId, kind, branchId, dmKey];
  const [existing] = await query(
    "SELECT * FROM team_chat_channels WHERE tenant_id = ? AND kind = ? AND branch_id = ? AND dm_key = ? LIMIT 1",
    scope
  );
  if (existing) return existing;
  try {
    const result = await query(
      "INSERT INTO team_chat_channels (tenant_id, kind, branch_id, dm_key, name, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tenantId, kind, branchId, dmKey, name, description, createdBy]
    );
    return {
      id: result.insertId,
      tenant_id: tenantId,
      kind,
      branch_id: branchId,
      dm_key: dmKey,
      name,
      description,
      created_by: createdBy,
    };
  } catch (error) {
    const [row] = await query(
      "SELECT * FROM team_chat_channels WHERE tenant_id = ? AND kind = ? AND branch_id = ? AND dm_key = ? LIMIT 1",
      scope
    );
    if (row) return row;
    throw error;
  }
}

async function ensureOrganizationChannel(tenantId, userId) {
  return findOrCreateChannel({ tenantId, kind: "organization", createdBy: userId });
}

async function ensureBranchChannel(tenantId, branch, userId) {
  return findOrCreateChannel({
    tenantId,
    kind: "branch",
    branchId: Number(branch.id),
    name: branch.name || null,
    createdBy: userId,
  });
}

async function visibleBranches(req) {
  const admin = isAdmin(req);
  const rows = await query(
    `SELECT b.id, b.name, b.code, b.is_head_office
       FROM branches b
      WHERE b.tenant_id = ? AND b.status = 'active'
        ${admin ? "" : "AND EXISTS (SELECT 1 FROM staff_branch_memberships s WHERE s.tenant_id = b.tenant_id AND s.user_id = ? AND s.branch_id = b.id)"}
      ORDER BY b.is_head_office DESC, b.name ASC`,
    admin ? [req.tenantId] : [req.tenantId, req.user.id]
  );
  return rows;
}

async function allTenantBranches(tenantId) {
  return query(
    `SELECT b.id, b.name, b.code, b.is_head_office
       FROM branches b
      WHERE b.tenant_id = ? AND b.status = 'active'
      ORDER BY b.is_head_office DESC, b.name ASC`,
    [tenantId]
  );
}

async function memberBranchIds(tenantId, userId) {
  const rows = await query(
    "SELECT branch_id FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = ?",
    [tenantId, userId]
  );
  return uniqueIds(rows.map((row) => row.branch_id));
}

async function userBranchIds(tenantId, userIds) {
  if (!userIds.length) return new Map();
  const rows = await query(
    `SELECT user_id, branch_id FROM staff_branch_memberships
      WHERE tenant_id = ? AND user_id IN (${userIds.map(() => "?").join(",")})
      ORDER BY is_primary DESC, id ASC`,
    [tenantId, ...userIds]
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(Number(row.user_id))) map.set(Number(row.user_id), Number(row.branch_id));
  }
  return map;
}

async function usersByIds(tenantId, userIds) {
  const ids = uniqueIds(userIds);
  if (!ids.length) return new Map();
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.status
       FROM users u
      WHERE u.status = 'active' AND u.id IN (${ids.map(() => "?").join(",")})
        AND EXISTS (SELECT 1 FROM organization_memberships m WHERE m.tenant_id = ? AND m.user_id = u.id AND m.membership_status = 'active')`,
    [...ids, tenantId]
  );
  const branches = await userBranchIds(tenantId, ids);
  const map = new Map();
  for (const row of rows) {
    map.set(Number(row.id), {
      id: Number(row.id),
      name: fullName(row),
      email: row.email || "",
      role: row.role || "",
      branchId: branches.get(Number(row.id)) || null,
    });
  }
  return map;
}

async function settings(tenantId) {
  const [row] = await query(
    "SELECT cross_branch_dm, retention_days, allow_file_sharing, max_file_size_mb, local_cache_days, clear_cache_on_logout, updated_at FROM team_chat_settings WHERE tenant_id = ? LIMIT 1",
    [tenantId]
  );
  return {
    crossBranchDm: Boolean(Number(row?.cross_branch_dm || 0)),
    retentionDays: RETENTION_DAYS,
    allowFileSharing: Boolean(Number(row?.allow_file_sharing ?? 1)),
    maxFileSizeMb: Number(row?.max_file_size_mb || 25),
    localCacheDays: Number(row?.local_cache_days) || 0,
    clearCacheOnLogout: Boolean(Number(row?.clear_cache_on_logout)),
  };
}

async function updateSettings(req, patch) {
  if (!isAdmin(req)) throw fail("Only an organization administrator can change team chat settings", 403, "ADMIN_ONLY");
  const current = await settings(req.tenantId);
  const crossBranchDm = typeof patch.crossBranchDm === "boolean" ? (patch.crossBranchDm ? 1 : 0) : (current.crossBranchDm ? 1 : 0);
  const allowFileSharing = typeof patch.allowFileSharing === "boolean" ? (patch.allowFileSharing ? 1 : 0) : (current.allowFileSharing ? 1 : 0);
  const maxFileSizeMb = Number.isInteger(Number(patch.maxFileSizeMb)) ? Number(patch.maxFileSizeMb) : current.maxFileSizeMb;
  if (maxFileSizeMb < 1 || maxFileSizeMb > 35) throw fail("File size limit must be between 1 and 35 MB", 400);
  const localCacheDays = patch.localCacheDays === undefined ? current.localCacheDays : Number(patch.localCacheDays);
  if (!Number.isInteger(localCacheDays) || localCacheDays < 0 || localCacheDays > 3650) throw fail("Device retention must be between 0 and 3650 days; 0 keeps history until cleared", 400);
  const clearCacheOnLogout = patch.clearCacheOnLogout === undefined ? current.clearCacheOnLogout : Boolean(patch.clearCacheOnLogout);

  const [existing] = await query("SELECT tenant_id FROM team_chat_settings WHERE tenant_id = ? LIMIT 1", [req.tenantId]);
  if (existing) {
    await query(
      "UPDATE team_chat_settings SET cross_branch_dm = ?, allow_file_sharing = ?, max_file_size_mb = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?",
      [crossBranchDm, allowFileSharing, maxFileSizeMb, req.tenantId]
    );
  } else {
    await query(
      "INSERT INTO team_chat_settings (tenant_id, cross_branch_dm, allow_file_sharing, max_file_size_mb) VALUES (?, ?, ?, ?)",
      [req.tenantId, crossBranchDm, allowFileSharing, maxFileSizeMb]
    );
  }
  await query("UPDATE team_chat_settings SET local_cache_days = ?, clear_cache_on_logout = ? WHERE tenant_id = ?", [localCacheDays, clearCacheOnLogout ? 1 : 0, req.tenantId]);
  await logAudit(req.tenantId, req.user.id, "UPDATE_SETTINGS", "settings", 0, patch);
  return settings(req.tenantId);
}

async function notificationPreferences(req) {
  const [row] = await query("SELECT in_app, desktop, mentions_when_muted FROM team_chat_notification_preferences WHERE tenant_id = ? AND user_id = ?", [req.tenantId, req.user.id]);
  return { inApp: row ? Boolean(Number(row.in_app)) : true, desktop: Boolean(Number(row?.desktop)), mentionsWhenMuted: Boolean(Number(row?.mentions_when_muted)) };
}

async function updateNotificationPreferences(req, patch = {}) {
  const current = await notificationPreferences(req);
  const next = Object.fromEntries(Object.entries(current).map(([key, value]) => [key, typeof patch[key] === "boolean" ? patch[key] : value]));
  await query("INSERT INTO team_chat_notification_preferences (tenant_id, user_id, in_app, desktop, mentions_when_muted) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE in_app = VALUES(in_app), desktop = VALUES(desktop), mentions_when_muted = VALUES(mentions_when_muted)", [req.tenantId, req.user.id, next.inApp ? 1 : 0, next.desktop ? 1 : 0, next.mentionsWhenMuted ? 1 : 0]);
  return next;
}

async function findChannel(tenantId, channelId) {
  const id = Number(channelId);
  if (!Number.isInteger(id) || id < 1) return null;
  const [row] = await query(
    "SELECT * FROM team_chat_channels WHERE tenant_id = ? AND id = ? LIMIT 1",
    [tenantId, id]
  );
  return row || null;
}

async function authorizationGraph(tenantId) {
  const [members, scopes, policies] = await Promise.all([
    query("SELECT m.user_id, m.role FROM organization_memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? AND m.membership_status = 'active' AND u.status = 'active'", [tenantId]),
    query("SELECT s.user_id, s.branch_id, s.team_id FROM staff_branch_memberships s JOIN branches b ON b.id = s.branch_id AND b.tenant_id = s.tenant_id AND b.status = 'active' WHERE s.tenant_id = ?", [tenantId]),
    query("SELECT * FROM team_chat_branch_policies WHERE tenant_id = ?", [tenantId]),
  ]);
  const users = new Map(members.map((member) => [Number(member.user_id), member]));
  const userScopes = new Map();
  for (const scope of scopes) { const id = Number(scope.user_id); if (!userScopes.has(id)) userScopes.set(id, []); userScopes.get(id).push(scope); }
  const pairs = new Map();
  for (const policy of policies) {
    try { pairs.set(branchPairKey(policy.branch_a_id, policy.branch_b_id).join(":"), { ...policy, constraints: JSON.parse(policy.constraints_json || "{}") }); }
    catch (_) { /* A malformed policy grants no access. */ }
  }
  const allows = (firstId, secondId, feature) => {
    const first = users.get(Number(firstId)); const second = users.get(Number(secondId));
    if (!first || !second || Number(firstId) === Number(secondId)) return false;
    for (const a of userScopes.get(Number(firstId)) || []) for (const b of userScopes.get(Number(secondId)) || []) {
      if (Number(a.branch_id) === Number(b.branch_id)) return true;
      const policy = pairs.get(branchPairKey(a.branch_id, b.branch_id).join(":"));
      const column = { allowDirect: "allow_direct", allowGroups: "allow_groups", allowDiscovery: "allow_discovery", allowFiles: "allow_files", allowGroupCreation: "allow_groups" }[feature];
      if (!policy || !Number(policy.enabled) || !Number(policy[column])) continue;
      const restrictions = policy.constraints;
      if (feature === "allowGroupCreation" && restrictions.allowGroupCreation === false) continue;
      if (restrictions.userIds?.length && ![Number(firstId), Number(secondId)].every((id) => restrictions.userIds.includes(id))) continue;
      if (restrictions.roles?.length && ![first.role, second.role].every((role) => restrictions.roles.includes(role))) continue;
      if (restrictions.teamIds?.length && ![Number(a.team_id), Number(b.team_id)].every((id) => restrictions.teamIds.includes(id))) continue;
      return true;
    }
    return false;
  };
  return { users, scopes: userScopes, allows };
}

async function canAccessChannel(req, channel, graph = null) {
  if (!channel || Number(channel.tenant_id) !== Number(req.tenantId)) return false;
  graph ||= await authorizationGraph(req.tenantId);
  const membership = graph.users.get(Number(req.user.id));
  if (!membership) return false;
  // Legacy company-wide channels are restricted to administrators. Branch chats
  // and explicitly authorized groups are the employee communication boundary.
  if (channel.kind === "organization") return ADMIN_ROLES.has(membership.role);
  if (channel.kind === "branch") {
    if (ADMIN_ROLES.has(membership.role)) return true;
    return (graph.scopes.get(Number(req.user.id)) || []).some((scope) => Number(scope.branch_id) === Number(channel.branch_id));
  }
  if (channel.kind === "direct") {
    const ids = idsFromDmKey(channel.dm_key);
    return ids.includes(Number(req.user.id)) && graph.allows(ids[0], ids[1], "allowDirect");
  }
  if (channel.kind === "group") {
    if (!(graph.scopes.get(Number(req.user.id)) || []).length) return false;
    const [membership] = await query(
      "SELECT id FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ? AND user_id = ? LIMIT 1",
      [req.tenantId, channel.id, req.user.id]
    );
    if (!membership) return false;
    const members = await query("SELECT user_id FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ?", [req.tenantId, channel.id]);
    const active = members.filter((member) => graph.users.has(Number(member.user_id)) && (graph.scopes.get(Number(member.user_id)) || []).length > 0);
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
      if (!graph.allows(active[i].user_id, active[j].user_id, "allowGroups")) return false;
    }
    return true;
  }
  return false;
}

async function canUsersCommunicate(tenantId, firstId, secondId, feature, graph = null) {
  graph ||= await authorizationGraph(tenantId);
  return graph.allows(firstId, secondId, feature);
}

async function assertChannel(req, channelId) {
  const channel = await findChannel(req.tenantId, channelId);
  if (!channel) throw fail("This team chat does not exist", 404, "CHANNEL_NOT_FOUND");
  if (!(await canAccessChannel(req, channel))) {
    throw fail("This team chat belongs to another team", 403, "CHANNEL_FORBIDDEN");
  }
  return channel;
}

/* ── Group Management ─────────────────────────────────────────────────────── */

async function createGroup(req, { name, description = "", memberIds = [] }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw fail("Group name is required", 400, "INVALID_NAME");
  if (trimmed.length > 100) throw fail("Group name must be 100 characters or fewer", 400, "INVALID_NAME");

  const requestedIds = uniqueIds(memberIds).filter((id) => id !== Number(req.user.id));
  const validUsers = await usersByIds(req.tenantId, requestedIds);
  if (validUsers.size !== requestedIds.length) throw fail("Select active employees in this organization", 403);
  for (const targetId of requestedIds) if (!(await canUsersCommunicate(req.tenantId, req.user.id, targetId, "allowGroupCreation"))) throw fail("Group creation is disabled for this branch pair", 403);
  await validateGroupPairs(req.tenantId, [Number(req.user.id), ...requestedIds]);
  const myBranches = await memberBranchIds(req.tenantId, req.user.id);
  const myBranch = myBranches[0] || 0;

  // Validate cross-branch group permission
  for (const [id, user] of validUsers.entries()) {
    const targetBranch = user.branchId || 0;
    if (targetBranch && myBranch && targetBranch !== myBranch && !isAdmin(req) && !(await canUsersCommunicate(req.tenantId, req.user.id, id, "allowGroups"))) {
      const allowed = await canCommunicateBranches(req.tenantId, myBranch, targetBranch, "allowGroups");
      if (!allowed) {
        throw fail(
          `Cross-branch group with ${user.name} is not permitted by organization policy`,
          403,
          "CROSS_BRANCH_GROUP_FORBIDDEN"
        );
      }
    }
  }

  const dmKey = `grp-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const channel = await findOrCreateChannel({
    tenantId: req.tenantId,
    kind: "group",
    branchId: 0,
    dmKey,
    name: trimmed,
    description: String(description || "").trim().slice(0, 500),
    createdBy: req.user.id,
  });

  // Creator as owner
  await query(
    "INSERT IGNORE INTO team_chat_channel_members (tenant_id, channel_id, user_id, role) VALUES (?, ?, ?, 'owner')",
    [req.tenantId, channel.id, req.user.id]
  );

  // Members
  for (const memberId of validUsers.keys()) {
    await query(
      "INSERT IGNORE INTO team_chat_channel_members (tenant_id, channel_id, user_id, role) VALUES (?, ?, ?, 'member')",
      [req.tenantId, channel.id, memberId]
    );
  }

  await logAudit(req.tenantId, req.user.id, "CREATE_GROUP", "channel", channel.id, { name: trimmed });
  return channel;
}

async function addGroupMembers(req, channelId, { userIds = [] }) {
  const channel = await assertChannel(req, channelId);
  if (channel.kind !== "group") throw fail("Can only add members to custom group chats", 400);

  const [myMembership] = await query(
    "SELECT role FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ? AND user_id = ? LIMIT 1",
    [req.tenantId, channel.id, req.user.id]
  );
  if (!isAdmin(req) && !["owner", "admin"].includes(myMembership?.role)) {
    throw fail("Only group admins can add members", 403, "ADMIN_REQUIRED");
  }

  const validUsers = await usersByIds(req.tenantId, uniqueIds(userIds));
  if (validUsers.size !== uniqueIds(userIds).length) throw fail("Select active employees in this organization", 403);
  const existingMembers = await query("SELECT user_id FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ?", [req.tenantId, channel.id]);
  await validateGroupPairs(req.tenantId, uniqueIds([...existingMembers.map((m) => m.user_id), ...validUsers.keys()]));
  const myBranches = await memberBranchIds(req.tenantId, req.user.id);
  const myBranch = myBranches[0] || 0;

  const added = [];
  for (const [id, user] of validUsers.entries()) {
    const targetBranch = user.branchId || 0;
    if (targetBranch && myBranch && targetBranch !== myBranch && !isAdmin(req) && !(await canUsersCommunicate(req.tenantId, req.user.id, id, "allowGroups"))) {
      const allowed = await canCommunicateBranches(req.tenantId, myBranch, targetBranch, "allowGroups");
      if (!allowed) continue;
    }
    await query(
      "INSERT IGNORE INTO team_chat_channel_members (tenant_id, channel_id, user_id, role) VALUES (?, ?, ?, 'member')",
      [req.tenantId, channel.id, id]
    );
    added.push(user);
  }
  await logAudit(req.tenantId, req.user.id, "ADD_MEMBERS", "channel", channel.id, { addedIds: added.map((u) => u.id) });
  return { channelId: Number(channel.id), added };
}

async function validateGroupPairs(tenantId, ids) {
  const graph = await authorizationGraph(tenantId);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (!graph.allows(ids[i], ids[j], "allowGroups")) {
        throw fail("Every pair of group members must be permitted to communicate", 403, "CROSS_BRANCH_GROUP_FORBIDDEN");
      }
    }
  }
}

async function removeGroupMember(req, channelId, targetUserId) {
  const channel = await assertChannel(req, channelId);
  if (channel.kind !== "group") throw fail("Can only remove members from custom group chats", 400);

  const targetId = Number(targetUserId);
  const [myMembership] = await query(
    "SELECT role FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ? AND user_id = ? LIMIT 1",
    [req.tenantId, channel.id, req.user.id]
  );
  if (!isAdmin(req) && !["owner", "admin"].includes(myMembership?.role) && targetId !== Number(req.user.id)) {
    throw fail("Only group admins can remove members", 403, "ADMIN_REQUIRED");
  }
  const memberships = await query("SELECT user_id, role FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ?", [req.tenantId, channel.id]);
  const target = memberships.find((member) => Number(member.user_id) === targetId);
  if (target?.role === "owner" && targetId !== Number(req.user.id) && !isAdmin(req)) throw fail("The group owner must leave or transfer their role themselves", 403);
  const remaining = memberships.filter((member) => Number(member.user_id) !== targetId);
  if (remaining.length && !remaining.some((member) => ["owner", "admin"].includes(member.role))) throw fail("Make another member a group admin before leaving", 409, "GROUP_ADMIN_REQUIRED");

  await query(
    "DELETE FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ? AND user_id = ?",
    [req.tenantId, channel.id, targetId]
  );
  await logAudit(req.tenantId, req.user.id, "REMOVE_MEMBER", "channel", channel.id, { removedUserId: targetId });
  return { channelId: Number(channel.id), removedUserId: targetId };
}

async function setGroupRole(req, channelId, targetUserId, role) {
  const channel = await assertChannel(req, channelId);
  if (channel.kind !== "group" || !["admin", "member"].includes(role)) throw fail("Choose a valid group role", 400);
  const members = await query("SELECT user_id, role FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ?", [req.tenantId, channel.id]);
  const actor = members.find((member) => Number(member.user_id) === Number(req.user.id));
  const target = members.find((member) => Number(member.user_id) === Number(targetUserId));
  if (!isAdmin(req) && actor?.role !== "owner") throw fail("Only the group owner can assign group administrators", 403);
  if (!target || target.role === "owner" || Number(targetUserId) === Number(req.user.id)) throw fail("Choose another group member", 400);
  await query("UPDATE team_chat_channel_members SET role = ? WHERE tenant_id = ? AND channel_id = ? AND user_id = ?", [role, req.tenantId, channel.id, targetUserId]);
  await logAudit(req.tenantId, req.user.id, "GROUP_ROLE_CHANGED", "channel", channel.id, { userId: Number(targetUserId), role });
  return groupMembers(req, channel.id);
}

async function orphanedGroups(req) {
  if (!isAdmin(req)) throw fail("Organization administrator required", 403);
  const graph = await authorizationGraph(req.tenantId);
  const groups = await query("SELECT id, name FROM team_chat_channels WHERE tenant_id = ? AND kind = 'group'", [req.tenantId]);
  const rows = await query("SELECT m.channel_id, m.user_id, m.role, u.first_name, u.last_name, u.email FROM team_chat_channel_members m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ?", [req.tenantId]);
  const byChannel = new Map();
  for (const member of rows) {
    if (!graph.users.has(Number(member.user_id)) || !(graph.scopes.get(Number(member.user_id)) || []).length) continue;
    if (!byChannel.has(Number(member.channel_id))) byChannel.set(Number(member.channel_id), []);
    byChannel.get(Number(member.channel_id)).push(member);
  }
  return groups.flatMap((group) => {
    const members = byChannel.get(Number(group.id)) || [];
    if (!members.length || members.some((member) => ["owner", "admin"].includes(member.role))) return [];
    return [{ id: Number(group.id), name: group.name, members: members.map((member) => ({ id: Number(member.user_id), name: fullName(member) })) }];
  });
}

async function recoverGroupAdmin(req, channelId, userId) {
  if (!isAdmin(req)) throw fail("Organization administrator required", 403);
  const orphan = (await orphanedGroups(req)).find((group) => group.id === Number(channelId));
  if (!orphan || !orphan.members.some((member) => member.id === Number(userId))) throw fail("Choose a current member of a group without an administrator", 409);
  const channel = await findChannel(req.tenantId, channelId);
  if (!(await canAccessChannel({ tenantId: req.tenantId, user: { id: Number(userId) } }, channel))) throw fail("Resolve the group's branch communication policy before assigning an administrator", 403);
  await query("UPDATE team_chat_channel_members SET role = 'member' WHERE tenant_id = ? AND channel_id = ? AND role IN ('owner', 'admin')", [req.tenantId, channel.id]);
  await query("UPDATE team_chat_channel_members SET role = 'owner' WHERE tenant_id = ? AND channel_id = ? AND user_id = ?", [req.tenantId, channel.id, Number(userId)]);
  await logAudit(req.tenantId, req.user.id, "GROUP_ADMIN_RECOVERED", "channel", channel.id, { userId: Number(userId) });
  return { channelId: Number(channel.id), ownerId: Number(userId) };
}

async function updateGroup(req, channelId, patch = {}) {
  const channel = await assertChannel(req, channelId);
  if (channel.kind !== "group") throw fail("Can only edit group chats", 400);

  const [myMembership] = await query(
    "SELECT role FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ? AND user_id = ? LIMIT 1",
    [req.tenantId, channel.id, req.user.id]
  );
  if (!isAdmin(req) && !["owner", "admin"].includes(myMembership?.role)) {
    throw fail("Only group admins can update group settings", 403, "ADMIN_REQUIRED");
  }

  const updates = [];
  const params = [];
  if (typeof patch.name === "string" && patch.name.trim()) {
    updates.push("name = ?");
    params.push(patch.name.trim().slice(0, 100));
  }
  if (typeof patch.description === "string") {
    updates.push("description = ?");
    params.push(patch.description.trim().slice(0, 500));
  }
  if (typeof patch.isArchived === "boolean") {
    updates.push("is_archived = ?");
    params.push(patch.isArchived ? 1 : 0);
  }
  if (!updates.length) return channel;
  updates.push("updated_at = CURRENT_TIMESTAMP");

  await query(
    `UPDATE team_chat_channels SET ${updates.join(", ")} WHERE tenant_id = ? AND id = ?`,
    [...params, req.tenantId, channel.id]
  );
  await logAudit(req.tenantId, req.user.id, "UPDATE_GROUP", "channel", channel.id, patch);
  return findChannel(req.tenantId, channel.id);
}

async function groupMembers(req, channelId) {
  const channel = await assertChannel(req, channelId);
  if (channel.kind === "direct") {
    const ids = idsFromDmKey(channel.dm_key);
    const users = await usersByIds(req.tenantId, ids);
    return [...users.values()];
  }
  if (channel.kind === "branch") {
    const rows = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, 'member' as group_role
         FROM users u
         JOIN staff_branch_memberships s ON s.user_id = u.id AND s.branch_id = ? AND s.tenant_id = ?
        WHERE u.status = 'active' AND EXISTS (SELECT 1 FROM organization_memberships o WHERE o.tenant_id = s.tenant_id AND o.user_id = u.id AND o.membership_status = 'active')`,
      [channel.branch_id, req.tenantId]
    );
    return rows.map((r) => ({ id: Number(r.id), name: fullName(r), email: r.email, role: r.role, groupRole: "member" }));
  }
  if (channel.kind === "organization") {
    return membersFor(req);
  }
  // Custom group
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, m.role AS group_role, m.joined_at
       FROM users u
       JOIN team_chat_channel_members m ON m.user_id = u.id AND m.channel_id = ? AND m.tenant_id = ?
      WHERE u.status = 'active' AND EXISTS (SELECT 1 FROM organization_memberships o WHERE o.tenant_id = m.tenant_id AND o.user_id = u.id AND o.membership_status = 'active')`,
    [channel.id, req.tenantId]
  );
  const branches = await userBranchIds(req.tenantId, rows.map((r) => r.id));
  const bRows = await allTenantBranches(req.tenantId);
  const bMap = new Map(bRows.map((b) => [Number(b.id), b.name]));
  return rows.map((r) => {
    const bId = branches.get(Number(r.id)) || null;
    return {
      id: Number(r.id),
      name: fullName(r),
      email: r.email,
      role: r.role,
      groupRole: r.group_role || "member",
      branchId: bId,
      branchName: bId ? bMap.get(bId) || null : null,
      joinedAt: iso(r.joined_at),
    };
  });
}

/* ── Message Shapes & Enrichment ─────────────────────────────────────────── */

async function reactionsForMessages(tenantId, messageIds) {
  if (!messageIds.length) return new Map();
  const rows = await query(
    `SELECT message_id, emoji, user_id FROM team_chat_reactions
      WHERE tenant_id = ? AND message_id IN (${messageIds.map(() => "?").join(",")})`,
    [tenantId, ...messageIds]
  );
  const userMap = await usersByIds(tenantId, rows.map((r) => r.user_id));
  const map = new Map();
  for (const r of rows) {
    const mId = Number(r.message_id);
    if (!map.has(mId)) map.set(mId, []);
    map.get(mId).push({
      emoji: r.emoji,
      userId: Number(r.user_id),
      userName: userMap.get(Number(r.user_id))?.name || `User ${r.user_id}`,
    });
  }
  return map;
}

async function attachmentsForMessages(tenantId, messageIds) {
  if (!messageIds.length) return new Map();
  const rows = await query(
    `SELECT * FROM team_chat_attachments
      WHERE tenant_id = ? AND message_id IN (${messageIds.map(() => "?").join(",")})`,
    [tenantId, ...messageIds]
  );
  const map = new Map();
  for (const r of rows) {
    const mId = Number(r.message_id);
    if (!map.has(mId)) map.set(mId, []);
    map.get(mId).push({
      id: Number(r.id),
      fileName: r.file_name,
      fileSize: Number(r.file_size),
      mimeType: r.mime_type,
      fileUrl: r.file_url,
      createdAt: iso(r.created_at),
    });
  }
  return map;
}

async function pinsForChannel(tenantId, channelId) {
  const rows = await query(
    "SELECT message_id FROM team_chat_pins WHERE tenant_id = ? AND channel_id = ?",
    [tenantId, channelId]
  );
  return new Set(rows.map((r) => Number(r.message_id)));
}

async function repliesForMessages(tenantId, replyIds) {
  const ids = uniqueIds(replyIds);
  if (!ids.length) return new Map();
  const rows = await query(
    `SELECT id, sender_id, body FROM team_chat_messages
      WHERE tenant_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
    [tenantId, ...ids]
  );
  const senders = await usersByIds(tenantId, rows.map((r) => r.sender_id));
  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.id), {
      id: Number(r.id),
      senderId: Number(r.sender_id),
      senderName: senders.get(Number(r.sender_id))?.name || "Teammate",
      body: String(r.body || "").slice(0, 140),
    });
  }
  return map;
}

function groupReactions(rawList = []) {
  const byEmoji = new Map();
  for (const item of rawList) {
    if (!byEmoji.has(item.emoji)) {
      byEmoji.set(item.emoji, { emoji: item.emoji, count: 0, users: [], userIds: [] });
    }
    const entry = byEmoji.get(item.emoji);
    entry.count += 1;
    entry.users.push(item.userName);
    entry.userIds.push(item.userId);
  }
  return [...byEmoji.values()];
}

function messageShape(row, names, reactionsMap, attachmentsMap, pinsSet, repliesMap) {
  const sender = names?.get(Number(row.sender_id));
  const id = Number(row.id);
  const rawReactions = reactionsMap?.get(id) || [];
  const attachments = attachmentsMap?.get(id) || [];
  const replyTo = row.reply_to_id ? repliesMap?.get(Number(row.reply_to_id)) || null : null;

  return {
    id,
    channelId: Number(row.channel_id),
    senderId: Number(row.sender_id),
    senderName: sender?.name || `Teammate ${row.sender_id}`,
    senderBranchId: sender?.branchId ?? null,
    body: row.is_deleted ? "This message was deleted" : String(row.body || ""),
    clientId: row.client_id || null,
    replyToId: row.reply_to_id ? Number(row.reply_to_id) : null,
    replyTo: row.is_deleted ? null : replyTo,
    isEdited: Boolean(Number(row.is_edited || 0)),
    editedAt: iso(row.edited_at),
    isDeleted: Boolean(Number(row.is_deleted || 0)),
    deletedAt: iso(row.deleted_at),
    isPinned: pinsSet ? pinsSet.has(id) : false,
    reactions: row.is_deleted ? [] : groupReactions(rawReactions),
    attachments: row.is_deleted ? [] : attachments,
    createdAt: iso(row.created_at),
    stateVersion: Number(row.state_version) || 1,
    mentionIds: JSON.parse(row.mention_ids_json || "[]"),
  };
}

async function latestMessages(tenantId, channelIds) {
  if (!channelIds.length) return new Map();
  const rows = await query(
    `SELECT m.* FROM team_chat_messages m
       JOIN (SELECT channel_id, MAX(id) AS id FROM team_chat_messages
              WHERE tenant_id = ? AND channel_id IN (${channelIds.map(() => "?").join(",")}) AND created_at >= ${await windowSql(tenantId)}
              GROUP BY channel_id) newest ON newest.id = m.id`,
    [tenantId, ...channelIds]
  );
  const names = await usersByIds(tenantId, rows.map((row) => row.sender_id));
  const map = new Map();
  for (const row of rows) map.set(Number(row.channel_id), messageShape(row, names));
  return map;
}

async function unreadCounts(tenantId, userId, channelIds) {
  if (!channelIds.length) return new Map();
  const rows = await query(
    `SELECT m.channel_id, COUNT(*) AS total
       FROM team_chat_messages m
       LEFT JOIN team_chat_reads r
         ON r.tenant_id = m.tenant_id AND r.channel_id = m.channel_id AND r.user_id = ?
      WHERE m.tenant_id = ?
        AND m.channel_id IN (${channelIds.map(() => "?").join(",")})
        AND m.sender_id <> ?
        AND m.id > COALESCE(r.last_read_id, 0)
        AND m.created_at >= ${await windowSql(tenantId)}
      GROUP BY m.channel_id`,
    [userId, tenantId, ...channelIds, userId]
  );
  const map = new Map();
  for (const row of rows) map.set(Number(row.channel_id), Number(row.total) || 0);
  return map;
}

async function channelsFor(req) {
  const orgChannel = await ensureOrganizationChannel(req.tenantId, req.user.id);
  const branches = await visibleBranches(req);
  const branchChannels = [];
  for (const branch of branches) {
    branchChannels.push(await ensureBranchChannel(req.tenantId, branch, req.user.id));
  }

  const directRows = await query(
    `SELECT * FROM team_chat_channels
      WHERE tenant_id = ? AND kind = 'direct' AND (dm_key LIKE ? OR dm_key LIKE ?)
      ORDER BY id DESC LIMIT 60`,
    [req.tenantId, `${req.user.id}:%`, `%:${req.user.id}`]
  );

  const groupRows = await query(
    `SELECT c.* FROM team_chat_channels c
       JOIN team_chat_channel_members m ON m.channel_id = c.id AND m.tenant_id = c.tenant_id
      WHERE c.tenant_id = ? AND c.kind = 'group' AND m.user_id = ?
      ORDER BY c.id DESC LIMIT 60`,
    [req.tenantId, req.user.id]
  );

  const all = [];
  const graph = await authorizationGraph(req.tenantId);
  for (const row of [orgChannel, ...branchChannels, ...groupRows, ...directRows]) {
    if (await canAccessChannel(req, row, graph)) all.push(row);
  }
  const channelIds = all.map((row) => Number(row.id));
  const [latest, unread, names] = await Promise.all([
    latestMessages(req.tenantId, channelIds),
    unreadCounts(req.tenantId, req.user.id, channelIds),
    usersByIds(
      req.tenantId,
      directRows.flatMap((row) => idsFromDmKey(row.dm_key))
    ),
  ]);
  const branchNames = new Map(branches.map((branch) => [Number(branch.id), branch.name]));
  const preferences = await query("SELECT channel_id, muted, pinned, archived, marked_unread FROM team_chat_channel_members WHERE tenant_id = ? AND user_id = ?", [req.tenantId, req.user.id]);
  const preferenceMap = new Map(preferences.map((item) => [Number(item.channel_id), item]));

  const channels = all.map((row) => {
    const kind = row.kind;
    const branchId = Number(row.branch_id) || null;
    const participants = kind === "direct"
      ? idsFromDmKey(row.dm_key).map((id) => names.get(id) || { id, name: `Teammate ${id}`, branchId: null })
      : [];
    const other = participants.find((person) => Number(person.id) !== Number(req.user.id));
    const name = kind === "organization"
      ? "Company wide"
      : kind === "branch"
        ? branchNames.get(branchId) || row.name || "Branch team"
        : kind === "group"
          ? row.name || "Group chat"
          : other?.name || "Direct message";
    return {
      id: Number(row.id),
      kind,
      name,
      description: row.description || null,
      avatarUrl: row.avatar_url ? `/api/v2/team-chat/channels/${row.id}/avatar?version=${encodeURIComponent(row.avatar_url)}` : null,
      branchId,
      branchName: kind === "branch" ? branchNames.get(branchId) || null : null,
      participants,
      dmKey: kind === "direct" ? row.dm_key : null,
      lastMessage: latest.get(Number(row.id)) || null,
      unread: unread.get(Number(row.id)) || 0,
      muted: Boolean(preferenceMap.get(Number(row.id))?.muted),
      pinned: Boolean(preferenceMap.get(Number(row.id))?.pinned),
      archived: Boolean(preferenceMap.get(Number(row.id))?.archived),
      isArchived: Boolean(Number(row.is_archived)),
      markedUnread: Boolean(Number(preferenceMap.get(Number(row.id))?.marked_unread)),
    };
  });

  channels.sort((a, b) => {
    const order = { organization: 0, branch: 1, group: 2, direct: 3 };
    if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
    const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    if (at !== bt) return bt - at;
    return a.name.localeCompare(b.name);
  });
  return channels;
}

async function updatePreferences(req, channelId, patch) {
  const channel = await assertChannel(req, channelId);
  await query("INSERT IGNORE INTO team_chat_channel_members (tenant_id, channel_id, user_id, role) VALUES (?, ?, ?, 'member')", [req.tenantId, channel.id, req.user.id]);
  for (const field of ["muted", "pinned", "archived"]) {
    if (typeof patch[field] === "boolean") await query(`UPDATE team_chat_channel_members SET ${field} = ? WHERE tenant_id = ? AND channel_id = ? AND user_id = ?`, [patch[field] ? 1 : 0, req.tenantId, channel.id, req.user.id]);
  }
  const [preferences] = await query("SELECT muted, pinned, archived FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ? AND user_id = ?", [req.tenantId, channel.id, req.user.id]);
  return Object.fromEntries(Object.entries(preferences).map(([key, value]) => [key, Boolean(value)]));
}

async function membersFor(req, searchTerm = "") {
  const graph = await authorizationGraph(req.tenantId);
  const term = String(searchTerm || "").trim().slice(0, 100);
  const pattern = `%${term}%`;
  const nameExpression = db.isSqlite ? "(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))" : "CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))";
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, m.role AS member_role,
            (SELECT s.branch_id FROM staff_branch_memberships s
              WHERE s.tenant_id = ? AND s.user_id = u.id
              ORDER BY s.is_primary DESC, s.id ASC LIMIT 1) AS branch_id
       FROM users u
       JOIN organization_memberships m
         ON m.user_id = u.id AND m.tenant_id = ? AND m.membership_status = 'active'
      WHERE u.status = 'active' ${term ? `AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR ${nameExpression} LIKE ? OR EXISTS (SELECT 1 FROM staff_branch_memberships sb JOIN branches branch ON branch.id = sb.branch_id AND branch.tenant_id = sb.tenant_id WHERE sb.tenant_id = m.tenant_id AND sb.user_id = u.id AND branch.name LIKE ?))` : ""}
      ORDER BY u.first_name ASC, u.last_name ASC
      LIMIT 500`,
    [req.tenantId, req.tenantId, ...(term ? [pattern, pattern, pattern, pattern, pattern] : [])]
  );
  const branches = await allTenantBranches(req.tenantId);
  const branchNames = new Map(branches.map((b) => [Number(b.id), b.name]));
  const myBranches = await memberBranchIds(req.tenantId, req.user.id);
  const myBranch = myBranches[0] || 0;

  const results = [];
  for (const row of rows) {
    if (Number(row.id) === Number(req.user.id)) continue;
    const branchId = Number(row.branch_id) || null;
    const canDirect = graph.allows(req.user.id, row.id, "allowDirect");
    const canGroup = graph.allows(req.user.id, row.id, "allowGroups");
    const canDiscover = graph.allows(req.user.id, row.id, "allowDiscovery");

    if (!canDiscover) continue;

    results.push({
      id: Number(row.id),
      name: fullName(row),
      email: row.email || "",
      role: row.role || "",
      branchId,
      branchName: branchId ? branchNames.get(branchId) || null : null,
      canDirect,
      canGroup,
    });
  }
  return results;
}

async function bootstrap(req) {
  const [channels, members, policy, branches] = await Promise.all([
    channelsFor(req),
    membersFor(req),
    settings(req.tenantId),
    visibleBranches(req),
  ]);
  const [tenantRow] = await query("SELECT name FROM tenants WHERE id = ? LIMIT 1", [req.tenantId]);
  return {
    me: {
      id: Number(req.user.id),
      name: req.user.name || "",
      role: req.userRole || req.user.role || "",
      isAdmin: isAdmin(req),
    },
    tenantName: tenantRow?.name || "",
    branches,
    channels,
    members,
    settings: policy,
    retentionDays: RETENTION_DAYS,
    canManageSettings: isAdmin(req),
    notificationPreferences: await notificationPreferences(req),
  };
}

/* ── Messages Fetch & List ────────────────────────────────────────────────── */

async function listMessages(req, channelId, { after, before, limit } = {}) {
  const channel = await assertChannel(req, channelId);
  const size = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(limit, 10) || 50));
  const params = [req.tenantId, channel.id];
  let where = `tenant_id = ? AND channel_id = ? AND created_at >= ${await windowSql(req.tenantId)}`;
  const afterId = Number.parseInt(after, 10);
  const beforeId = Number.parseInt(before, 10);
  if (afterId > 0) {
    where += " AND id > ?";
    params.push(afterId);
  } else if (beforeId > 0) {
    where += " AND id < ?";
    params.push(beforeId);
  }
  const rows = await query(
    `SELECT * FROM team_chat_messages WHERE ${where} ORDER BY id ${afterId > 0 ? "ASC" : "DESC"} LIMIT ?`,
    [...params, size]
  );
  const ordered = afterId > 0 ? rows : rows.slice().reverse();
  const mIds = ordered.map((r) => Number(r.id));
  const [names, reactions, attachments, pins, replies] = await Promise.all([
    usersByIds(req.tenantId, ordered.map((r) => r.sender_id)),
    reactionsForMessages(req.tenantId, mIds),
    attachmentsForMessages(req.tenantId, mIds),
    pinsForChannel(req.tenantId, channel.id),
    repliesForMessages(req.tenantId, ordered.map((r) => r.reply_to_id).filter(Boolean)),
  ]);

  const messages = ordered.map((row) =>
    messageShape(row, names, reactions, attachments, pins, replies)
  );

  return {
    channel: {
      id: Number(channel.id),
      kind: channel.kind,
      name: channel.name,
      branchId: Number(channel.branch_id) || null,
    },
    messages,
    nextBefore: !afterId && rows.length === size ? messages[0]?.id || null : null,
    retentionDays: RETENTION_DAYS,
  };
}

async function recordMessageChange(tenantId, channelId, messageId) {
  await query("INSERT INTO team_chat_changes (tenant_id, channel_id, message_id) VALUES (?, ?, ?)", [tenantId, channelId, messageId]);
}

async function syncMessages(req, channelId, { after = 0 } = {}) {
  const channel = await assertChannel(req, channelId);
  const cursor = Math.max(0, Number.parseInt(after, 10) || 0);
  const changes = await query("SELECT id, message_id FROM team_chat_changes WHERE tenant_id = ? AND channel_id = ? AND id > ? ORDER BY id ASC LIMIT 100", [req.tenantId, channel.id, cursor]);
  const ids = uniqueIds(changes.map((change) => change.message_id));
  const cutoff = await windowSql(req.tenantId);
  const rows = ids.length ? await query(`SELECT * FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ? AND id IN (${ids.map(() => "?").join(",")}) AND created_at >= ${cutoff}`, [req.tenantId, channel.id, ...ids]) : [];
  const [names, reactions, attachments, pins, replies] = await Promise.all([
    usersByIds(req.tenantId, rows.map((message) => message.sender_id)), reactionsForMessages(req.tenantId, ids),
    attachmentsForMessages(req.tenantId, ids), pinsForChannel(req.tenantId, channel.id),
    repliesForMessages(req.tenantId, rows.map((message) => message.reply_to_id).filter(Boolean)),
  ]);
  const permittedReaders = new Set(await recipientsFor(channel));
  const readers = (await query("SELECT user_id AS userId, last_read_id AS lastReadId FROM team_chat_reads WHERE tenant_id = ? AND channel_id = ?", [req.tenantId, channel.id])).filter((reader) => permittedReaders.has(Number(reader.userId)));
  return { messages: rows.map((message) => messageShape(message, names, reactions, attachments, pins, replies)), readers, cursor: Number(changes.at(-1)?.id || cursor), hasMore: changes.length === 100, retentionCutoff: cutoff.slice(1, -1).replace(" ", "T") + "Z" };
}

/* ── Send Message ─────────────────────────────────────────────────────────── */

const rateState = new Map();
function assertWithinRate(userId) {
  const now = Date.now();
  const entry = rateState.get(Number(userId)) || { start: now, count: 0 };
  if (now - entry.start > 10000) {
    entry.start = now;
    entry.count = 0;
  }
  entry.count += 1;
  rateState.set(Number(userId), entry);
  if (rateState.size > 5000) {
    for (const [key, value] of rateState) {
      if (now - value.start > 60000) rateState.delete(key);
    }
  }
  if (entry.count > 25) {
    throw fail("You are sending messages too quickly. Try again in a few seconds.", 429, "RATE_LIMITED");
  }
}

async function sendMessage(req, channelId, input = {}) {
  const channel = await assertChannel(req, channelId);
  if (Number(channel.is_archived)) throw fail("This group is archived", 409, "CHANNEL_ARCHIVED");
  const cutoff = new Date((await windowSql(req.tenantId)).slice(1, -1).replace(" ", "T") + "Z").getTime();
  if (input.clientCreatedAt) {
    const operationTime = new Date(input.clientCreatedAt).getTime();
    if (!Number.isFinite(operationTime)) throw fail("Invalid message operation timestamp", 400);
    if (operationTime < cutoff) throw fail("This pending operation is older than the server recovery window. Copy it to the composer to send it as a new message.", 409, "OPERATION_EXPIRED");
  }
  const body = String(input.text ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  const replyToId = Number.isInteger(Number(input.replyToId)) && Number(input.replyToId) > 0 ? Number(input.replyToId) : null;
  const attachmentIds = uniqueIds(Array.isArray(input.attachmentIds) ? input.attachmentIds : input.attachmentId ? [input.attachmentId] : []);
  const mentionIds = uniqueIds(input.mentionIds || []);
  if (mentionIds.length > 100) throw fail("Mention at most 100 participants in one message", 400);
  if (mentionIds.length) {
    const permitted = new Set(await recipientsFor(channel));
    const people = await usersByIds(req.tenantId, mentionIds);
    if (mentionIds.some((id) => !permitted.has(id) || !body.includes(`@${people.get(id)?.name}`))) throw fail("Mentions must name current conversation participants", 400, "INVALID_MENTION");
  }
  if (replyToId) {
    const [reply] = await query(`SELECT id FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ? AND id = ? AND is_deleted = 0 AND created_at >= ${await windowSql(req.tenantId)}`, [req.tenantId, channel.id, replyToId]);
    if (!reply) throw fail("The replied message has expired or is unavailable", 409, "REPLY_UNAVAILABLE");
  }
  if (attachmentIds.length) {
    await assertFileSharing(req, channel);
    const files = await query(`SELECT id FROM team_chat_attachments WHERE tenant_id = ? AND channel_id = ? AND uploaded_by = ? AND message_id = 0 AND id IN (${attachmentIds.map(() => "?").join(",")})`, [req.tenantId, channel.id, req.user.id, ...attachmentIds]);
    if (files.length !== attachmentIds.length) {
      const [prior] = await query("SELECT id FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ? AND sender_id = ? AND client_id = ?", [req.tenantId, channel.id, req.user.id, input.clientId || ""]);
      if (!prior) throw fail("Attachment is not available for this message", 403);
    }
  }

  if (!body && !attachmentIds.length) throw fail("Write a message or attach a file before sending", 400, "EMPTY_MESSAGE");
  if (body.length > MAX_BODY) throw fail(`Keep team chat messages under ${MAX_BODY} characters`, 400, "MESSAGE_TOO_LONG");
  assertWithinRate(req.user.id);

  const clientId = String(input.clientId || "").trim().slice(0, 80) || crypto.randomUUID();
  const [existing] = await query(
    "SELECT * FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ? AND sender_id = ? AND client_id = ? LIMIT 1",
    [req.tenantId, channel.id, req.user.id, clientId]
  );
  let row = existing;
  if (row && new Date(iso(row.created_at)).getTime() < cutoff) throw fail("The original message has expired", 409, "OPERATION_EXPIRED");
  let replayed = Boolean(existing);
  if (!row) {
    try {
      const result = await query(
        "INSERT INTO team_chat_messages (tenant_id, channel_id, sender_id, body, client_id, reply_to_id, mention_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [req.tenantId, channel.id, req.user.id, body || (attachmentIds.length ? "Sent an attachment" : ""), clientId, replyToId, JSON.stringify(mentionIds)]
      );
      [row] = await query("SELECT * FROM team_chat_messages WHERE id = ? LIMIT 1", [result.insertId]);
    } catch (error) {
      [row] = await query(
        "SELECT * FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ? AND sender_id = ? AND client_id = ? LIMIT 1",
        [req.tenantId, channel.id, req.user.id, clientId]
      );
      if (!row) throw error;
      replayed = true;
    }
  }

  // Link attachments to this message
  if (attachmentIds.length) {
    await query(
      `UPDATE team_chat_attachments SET message_id = ?
        WHERE tenant_id = ? AND channel_id = ? AND uploaded_by = ? AND message_id = 0 AND id IN (${attachmentIds.map(() => "?").join(",")})`,
      [row.id, req.tenantId, channel.id, req.user.id, ...attachmentIds]
    );
  }

  const [names, reactions, attachments, pins, replies] = await Promise.all([
    usersByIds(req.tenantId, [row.sender_id]),
    reactionsForMessages(req.tenantId, [row.id]),
    attachmentsForMessages(req.tenantId, [row.id]),
    pinsForChannel(req.tenantId, channel.id),
    repliesForMessages(req.tenantId, row.reply_to_id ? [row.reply_to_id] : []),
  ]);

  if (!replayed) await recordMessageChange(req.tenantId, channel.id, row.id);

  return {
    channel,
    message: messageShape(row, names, reactions, attachments, pins, replies),
    recipients: await recipientsFor(channel),
    replayed,
  };
}

/* ── Message Interactions: Edit, Delete, Reactions, Pins ─────────────────── */

async function editMessage(req, channelId, messageId, { text }) {
  const channel = await assertChannel(req, channelId);
  const mId = Number(messageId);
  const newBody = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!newBody) throw fail("Message content cannot be empty", 400);
  if (newBody.length > MAX_BODY) throw fail(`Keep message under ${MAX_BODY} characters`, 400);

  const [row] = await query(
    `SELECT * FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ? AND id = ? AND created_at >= ${await windowSql(req.tenantId)} LIMIT 1`,
    [req.tenantId, channel.id, mId]
  );
  if (!row) throw fail("Message not found or expired", 404);
  if (Number(row.sender_id) !== Number(req.user.id)) {
    throw fail("You can only edit your own messages", 403);
  }
  if (row.is_deleted) throw fail("Cannot edit a deleted message", 400);

  const participants = await usersByIds(req.tenantId, await recipientsFor(channel));
  const mentionIds = [...participants.values()].filter((person) => Number(person.id) !== Number(req.user.id) && newBody.includes(`@${person.name}`)).map((person) => person.id);
  await query(
    "UPDATE team_chat_messages SET body = ?, mention_ids_json = ?, is_edited = 1, edited_at = CURRENT_TIMESTAMP, state_version = state_version + 1 WHERE tenant_id = ? AND id = ?",
    [newBody, JSON.stringify(mentionIds), req.tenantId, mId]
  );

  const [updated] = await query("SELECT * FROM team_chat_messages WHERE id = ? LIMIT 1", [mId]);
  await recordMessageChange(req.tenantId, channel.id, mId);
  const [names, reactions, attachments, pins, replies] = await Promise.all([
    usersByIds(req.tenantId, [updated.sender_id]),
    reactionsForMessages(req.tenantId, [mId]),
    attachmentsForMessages(req.tenantId, [mId]),
    pinsForChannel(req.tenantId, channel.id),
    repliesForMessages(req.tenantId, updated.reply_to_id ? [updated.reply_to_id] : []),
  ]);

  return {
    channel,
    message: messageShape(updated, names, reactions, attachments, pins, replies),
    recipients: await recipientsFor(channel),
  };
}

async function deleteMessage(req, channelId, messageId) {
  const channel = await assertChannel(req, channelId);
  const mId = Number(messageId);

  const [row] = await query(
    `SELECT * FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ? AND id = ? AND created_at >= ${await windowSql(req.tenantId)} LIMIT 1`,
    [req.tenantId, channel.id, mId]
  );
  if (!row) throw fail("Message not found", 404);
  if (Number(row.sender_id) !== Number(req.user.id) && !isAdmin(req)) {
    throw fail("You can only delete your own messages", 403);
  }

  await query(
    "UPDATE team_chat_messages SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, body = 'This message was deleted', state_version = state_version + 1 WHERE tenant_id = ? AND id = ?",
    [req.tenantId, mId]
  );
  const files = await query("SELECT storage_key FROM team_chat_attachments WHERE tenant_id = ? AND message_id = ?", [req.tenantId, mId]);
  for (const file of files) {
    if (!file.storage_key || path.basename(file.storage_key) !== file.storage_key) continue;
    try { await fs.promises.unlink(path.join(privateChatDir, file.storage_key)); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  for (const table of ["team_chat_attachments", "team_chat_reactions", "team_chat_pins"]) await query(`DELETE FROM ${table} WHERE tenant_id = ? AND message_id = ?`, [req.tenantId, mId]);
  await recordMessageChange(req.tenantId, channel.id, mId);

  const [deletedState] = await query("SELECT state_version FROM team_chat_messages WHERE tenant_id = ? AND id = ?", [req.tenantId, mId]);
  return {
    channel,
    messageId: mId,
    stateVersion: Number(deletedState.state_version),
    recipients: await recipientsFor(channel),
  };
}

async function toggleReaction(req, channelId, messageId, emoji) {
  const channel = await assertChannel(req, channelId);
  const mId = Number(messageId);
  const cleanEmoji = String(emoji || "").trim().slice(0, 16);
  if (!cleanEmoji) throw fail("Valid emoji required", 400);

  const [message] = await query(
    `SELECT id FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ? AND id = ? AND is_deleted = 0 AND created_at >= ${await windowSql(req.tenantId)} LIMIT 1`,
    [req.tenantId, channel.id, mId]
  );
  if (!message) throw fail("Message not found or expired", 404);

  const [existing] = await query(
    "SELECT id FROM team_chat_reactions WHERE tenant_id = ? AND message_id = ? AND user_id = ? AND emoji = ? LIMIT 1",
    [req.tenantId, mId, req.user.id, cleanEmoji]
  );

  if (existing) {
    await query(
      "DELETE FROM team_chat_reactions WHERE tenant_id = ? AND message_id = ? AND user_id = ? AND emoji = ?",
      [req.tenantId, mId, req.user.id, cleanEmoji]
    );
  } else {
    await query(
      "INSERT IGNORE INTO team_chat_reactions (tenant_id, channel_id, message_id, user_id, emoji) VALUES (?, ?, ?, ?, ?)",
      [req.tenantId, channel.id, mId, req.user.id, cleanEmoji]
    );
  }

  const rawMap = await reactionsForMessages(req.tenantId, [mId]);
  const grouped = groupReactions(rawMap.get(mId) || []);
  await query("UPDATE team_chat_messages SET state_version = state_version + 1 WHERE tenant_id = ? AND id = ?", [req.tenantId, mId]);
  const [reactionState] = await query("SELECT state_version FROM team_chat_messages WHERE tenant_id = ? AND id = ?", [req.tenantId, mId]);
  await recordMessageChange(req.tenantId, channel.id, mId);

  return {
    channel,
    messageId: mId,
    reactions: grouped,
    stateVersion: Number(reactionState.state_version),
    recipients: await recipientsFor(channel),
  };
}

async function togglePin(req, channelId, messageId) {
  const channel = await assertChannel(req, channelId);
  const mId = Number(messageId);

  const [message] = await query(
    `SELECT id FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ? AND id = ? AND is_deleted = 0 AND created_at >= ${await windowSql(req.tenantId)} LIMIT 1`,
    [req.tenantId, channel.id, mId]
  );
  if (!message) throw fail("Message not found or expired", 404);

  const [existing] = await query(
    "SELECT message_id FROM team_chat_pins WHERE tenant_id = ? AND channel_id = ? AND message_id = ? LIMIT 1",
    [req.tenantId, channel.id, mId]
  );

  let isPinned = false;
  if (existing) {
    await query(
      "DELETE FROM team_chat_pins WHERE tenant_id = ? AND channel_id = ? AND message_id = ?",
      [req.tenantId, channel.id, mId]
    );
    isPinned = false;
  } else {
    await query(
      "INSERT IGNORE INTO team_chat_pins (tenant_id, channel_id, message_id, pinned_by) VALUES (?, ?, ?, ?)",
      [req.tenantId, channel.id, mId, req.user.id]
    );
    isPinned = true;
  }

  await query("UPDATE team_chat_messages SET state_version = state_version + 1 WHERE tenant_id = ? AND id = ?", [req.tenantId, mId]);
  const [pinState] = await query("SELECT state_version FROM team_chat_messages WHERE tenant_id = ? AND id = ?", [req.tenantId, mId]);
  await recordMessageChange(req.tenantId, channel.id, mId);
  return {
    channel,
    messageId: mId,
    isPinned,
    stateVersion: Number(pinState.state_version),
    recipients: await recipientsFor(channel),
  };
}

async function listPins(req, channelId) {
  const channel = await assertChannel(req, channelId);
  const rows = await query(
    `SELECT m.* FROM team_chat_messages m
       JOIN team_chat_pins p ON p.message_id = m.id AND p.tenant_id = m.tenant_id
      WHERE m.tenant_id = ? AND m.channel_id = ? AND m.created_at >= ${await windowSql(req.tenantId)}
      ORDER BY p.pinned_at DESC LIMIT 50`,
    [req.tenantId, channel.id]
  );
  const mIds = rows.map((r) => Number(r.id));
  const [names, reactions, attachments, replies] = await Promise.all([
    usersByIds(req.tenantId, rows.map((r) => r.sender_id)),
    reactionsForMessages(req.tenantId, mIds),
    attachmentsForMessages(req.tenantId, mIds),
    repliesForMessages(req.tenantId, rows.map((r) => r.reply_to_id).filter(Boolean)),
  ]);
  const pinsSet = new Set(mIds);
  return rows.map((r) => messageShape(r, names, reactions, attachments, pinsSet, replies));
}

/* ── Attachments ──────────────────────────────────────────────────────────── */

async function saveAttachment(req, channelId, file) {
  const channel = await assertChannel(req, channelId);
  if (Number(channel.is_archived)) throw fail("This group is archived", 409, "CHANNEL_ARCHIVED");
  if (!file) throw fail("No file uploaded", 400);
  await assertFileSharing(req, channel);
  const allowed = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain", "text/csv", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
  if (!allowed.has(file.mimetype)) throw fail("This file format is not allowed", 400);

  const policy = await settings(req.tenantId);
  if (!policy.allowFileSharing) throw fail("File sharing is disabled by organization policy", 403);
  const maxBytes = policy.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxBytes) throw fail(`File exceeds ${policy.maxFileSizeMb} MB limit`, 400);

  const fileName = path.basename(file.originalname || "attachment");
  const storageKey = file.filename || path.basename(file.path);
  const fileUrl = `/api/v2/team-chat/attachments/stream/${storageKey}`;

  const result = await query(
    `INSERT INTO team_chat_attachments (tenant_id, channel_id, message_id, file_name, file_size, mime_type, file_url, storage_key, uploaded_by)
     VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    [req.tenantId, channel.id, fileName, file.size, file.mimetype || "application/octet-stream", fileUrl, storageKey, req.user.id]
  );

  return {
    id: result.insertId,
    fileName,
    fileSize: file.size,
    mimeType: file.mimetype,
    fileUrl,
    createdAt: new Date().toISOString(),
  };
}

async function getAttachmentFile(req, storageKey) {
  if (!storageKey || path.basename(storageKey) !== storageKey) throw fail("Attachment not found", 404);
  const [row] = await query(
    `SELECT * FROM team_chat_attachments a WHERE tenant_id = ? AND storage_key = ? AND ((message_id = 0 AND created_at >= ${await windowSql(req.tenantId)}) OR EXISTS (SELECT 1 FROM team_chat_messages m WHERE m.tenant_id = a.tenant_id AND m.id = a.message_id AND m.is_deleted = 0 AND m.created_at >= ${await windowSql(req.tenantId)})) LIMIT 1`,
    [req.tenantId, storageKey]
  );
  if (!row) throw fail("Attachment not found", 404);
  const channel = await assertChannel(req, row.channel_id);
  if (!row.message_id && Number(row.uploaded_by) !== Number(req.user.id)) throw fail("Attachment not available", 403);
  const filePath = path.join(privateChatDir, row.storage_key);
  if (!fs.existsSync(filePath)) throw fail("Attachment file expired or unavailable", 404);
  return { row, filePath };
}

async function assertFileSharing(req, channel) {
  const policy = await settings(req.tenantId);
  if (!policy.allowFileSharing) throw fail("File sharing is disabled", 403);
  if (["branch", "organization"].includes(channel.kind)) return;
  const members = await recipientsFor(channel);
  for (const member of members) {
    if (Number(member) !== Number(req.user.id) && !(await canUsersCommunicate(req.tenantId, req.user.id, member, "allowFiles"))) throw fail("File sharing is not permitted between these branches", 403);
  }
}

async function saveGroupAvatar(req, channelId, file) {
  const channel = await updateGroup(req, channelId, {});
  if (!file || file.size > 2 * 1024 * 1024) throw fail("Choose an image no larger than 2 MB", 400);
  await assertFileSharing(req, channel);
  const bytes = await fs.promises.readFile(file.path);
  let mime;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = "image/png";
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = "image/jpeg";
  else if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString())) mime = "image/gif";
  else if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") mime = "image/webp";
  if (!mime) throw fail("Choose a PNG, JPEG, GIF or WebP image", 400);
  await query("UPDATE team_chat_channels SET avatar_url = ?, avatar_mime = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?", [file.filename, mime, req.tenantId, channel.id]);
  await logAudit(req.tenantId, req.user.id, "GROUP_AVATAR_CHANGED", "channel", channel.id);
  return { oldStorageKey: channel.avatar_url, channel: await findChannel(req.tenantId, channel.id) };
}

async function getGroupAvatar(req, channelId) {
  const channel = await assertChannel(req, channelId);
  if (!channel.avatar_url || path.basename(channel.avatar_url) !== channel.avatar_url || !channel.avatar_mime?.startsWith("image/")) throw fail("Group image is unavailable", 404);
  return { filePath: path.join(privateChatDir, channel.avatar_url), mimeType: channel.avatar_mime };
}

async function removeGroupAvatar(req, channelId) {
  const channel = await updateGroup(req, channelId, {});
  await query("UPDATE team_chat_channels SET avatar_url = NULL, avatar_mime = NULL, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?", [req.tenantId, channel.id]);
  await logAudit(req.tenantId, req.user.id, "GROUP_AVATAR_REMOVED", "channel", channel.id);
  return { oldStorageKey: channel.avatar_url, channel: await findChannel(req.tenantId, channel.id) };
}

/* ── Recipients Determination ─────────────────────────────────────────────── */

async function recipientsFor(channel) {
  const candidates = await candidateRecipientsFor(channel);
  const graph = await authorizationGraph(channel.tenant_id);
  if (channel.kind === "group") {
    const active = candidates.filter((id) => graph.users.has(id) && (graph.scopes.get(id) || []).length > 0);
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) if (!graph.allows(active[i], active[j], "allowGroups")) return [];
    return active;
  }
  const recipients = [];
  for (const id of candidates) {
    if (await canAccessChannel({ tenantId: channel.tenant_id, user: { id } }, channel, graph)) recipients.push(id);
  }
  return recipients;
}

async function candidateRecipientsFor(channel) {
  if (channel.kind === "direct") return idsFromDmKey(channel.dm_key);
  if (channel.kind === "group") {
    const rows = await query(
      "SELECT user_id AS id FROM team_chat_channel_members WHERE tenant_id = ? AND channel_id = ?",
      [channel.tenant_id, channel.id]
    );
    return uniqueIds(rows.map((r) => r.id));
  }
  if (channel.kind === "branch") {
    const rows = await query(
      `SELECT user_id AS id FROM staff_branch_memberships
        WHERE tenant_id = ? AND branch_id = ?
       UNION
       SELECT m.user_id AS id FROM organization_memberships m
        WHERE m.tenant_id = ? AND m.membership_status = 'active'
          AND m.role IN ('organization_owner', 'organization_admin')`,
      [channel.tenant_id, Number(channel.branch_id), channel.tenant_id]
    );
    return uniqueIds(rows.map((row) => row.id));
  }
  // Organization channel
  const rows = await query(
    `SELECT m.user_id AS id FROM organization_memberships m
       JOIN users u ON u.id = m.user_id AND u.status = 'active'
      WHERE m.tenant_id = ? AND m.membership_status = 'active'`,
    [channel.tenant_id]
  );
  return uniqueIds(rows.map((row) => row.id));
}

/* ── Mark Read ────────────────────────────────────────────────────────────── */

async function markRead(req, channelId) {
  const channel = await assertChannel(req, channelId);
  await query("UPDATE team_chat_channel_members SET marked_unread = 0 WHERE tenant_id = ? AND channel_id = ? AND user_id = ?", [req.tenantId, channel.id, req.user.id]);
  const [last] = await query(
    "SELECT MAX(id) AS id FROM team_chat_messages WHERE tenant_id = ? AND channel_id = ?",
    [req.tenantId, channel.id]
  );
  const lastId = Number(last?.id) || 0;
  const [existing] = await query(
    "SELECT user_id FROM team_chat_reads WHERE tenant_id = ? AND channel_id = ? AND user_id = ? LIMIT 1",
    [req.tenantId, channel.id, req.user.id]
  );
  if (existing) {
    await query(
      `UPDATE team_chat_reads
          SET last_read_id = CASE WHEN last_read_id < ? THEN ? ELSE last_read_id END,
              last_read_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND channel_id = ? AND user_id = ?`,
      [lastId, lastId, req.tenantId, channel.id, req.user.id]
    );
  } else {
    try {
      await query(
        "INSERT INTO team_chat_reads (tenant_id, channel_id, user_id, last_read_id) VALUES (?, ?, ?, ?)",
        [req.tenantId, channel.id, req.user.id, lastId]
      );
    } catch (_) {
      await query(
        "UPDATE team_chat_reads SET last_read_id = ?, last_read_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND channel_id = ? AND user_id = ?",
        [lastId, req.tenantId, channel.id, req.user.id]
      );
    }
  }
  return { channelId: Number(channel.id), lastReadId: lastId };
}

async function markUnread(req, channelId) {
  const channel = await assertChannel(req, channelId);
  await updatePreferences(req, channel.id, {});
  await query("UPDATE team_chat_channel_members SET marked_unread = 1 WHERE tenant_id = ? AND channel_id = ? AND user_id = ?", [req.tenantId, channel.id, req.user.id]);
  return { channelId: Number(channel.id), markedUnread: true };
}

/* ── Open Direct Channel ──────────────────────────────────────────────────── */

async function openDirect(req, otherUserId) {
  const otherId = Number(otherUserId);
  if (!Number.isInteger(otherId) || otherId < 1) throw fail("Choose a teammate to message", 400, "INVALID_MEMBER");
  if (otherId === Number(req.user.id)) throw fail("You cannot open a direct message with yourself", 400, "INVALID_MEMBER");

  const names = await usersByIds(req.tenantId, [otherId]);
  if (!names.has(otherId)) throw fail("That teammate is not in this organization", 404, "MEMBER_NOT_FOUND");
  if (!(await canUsersCommunicate(req.tenantId, req.user.id, otherId, "allowDirect"))) {
    throw fail("Your administrator has not enabled direct messages between your branches", 403, "CROSS_BRANCH_DISABLED");
  }

  const target = names.get(otherId);
  const [mine, memberRole] = await Promise.all([
    memberBranchIds(req.tenantId, req.user.id),
    query(
      "SELECT role FROM organization_memberships WHERE tenant_id = ? AND user_id = ? AND membership_status = 'active' LIMIT 1",
      [req.tenantId, otherId]
    ),
  ]);
  const myBranch = mine[0] || 0;
  const targetBranch = target.branchId || 0;
  const targetIsAdmin = ADMIN_ROLES.has(memberRole[0]?.role);

  if (!(await canUsersCommunicate(req.tenantId, req.user.id, otherId, "allowDirect"))) {
    const allowed = await canCommunicateBranches(req.tenantId, myBranch, targetBranch, "allowDirect");
    if (!allowed) {
      throw fail(
        "Your administrator has not enabled direct messages between your branches. Use the branch team or company-wide chat instead.",
        403,
        "CROSS_BRANCH_DISABLED"
      );
    }
  }

  const channel = await findOrCreateChannel({
    tenantId: req.tenantId,
    kind: "direct",
    dmKey: dmKeyFor(req.user.id, otherId),
    createdBy: req.user.id,
  });

  return {
    id: Number(channel.id),
    kind: "direct",
    name: target.name,
    branchId: null,
    branchName: null,
    participants: [target],
    dmKey: channel.dm_key,
    lastMessage: null,
    unread: 0,
  };
}

/* ── Branch Communication Policies Administration ────────────────────────── */

async function listBranchPolicies(req) {
  if (!isAdmin(req)) throw fail("Only administrators can view branch communication policies", 403);
  const branches = await allTenantBranches(req.tenantId);
  const rows = await query("SELECT * FROM team_chat_branch_policies WHERE tenant_id = ?", [req.tenantId]);
  const policyMap = new Map();
  for (const r of rows) {
    policyMap.set(`${r.branch_a_id}:${r.branch_b_id}`, {
      id: Number(r.id),
      branchAId: Number(r.branch_a_id),
      branchBId: Number(r.branch_b_id),
      enabled: Boolean(Number(r.enabled)),
      allowDirect: Boolean(Number(r.allow_direct)),
      allowGroups: Boolean(Number(r.allow_groups)),
      allowDiscovery: Boolean(Number(r.allow_discovery)),
      allowFiles: Boolean(Number(r.allow_files)),
      updatedAt: iso(r.updated_at),
      constraints: JSON.parse(r.constraints_json || "{}"),
      version: Number(r.version) || 0,
    });
  }

  // Build full matrix pairs
  const pairs = [];
  for (let i = 0; i < branches.length; i += 1) {
    for (let j = i + 1; j < branches.length; j += 1) {
      const bA = branches[i];
      const bB = branches[j];
      const key = branchPairKey(bA.id, bB.id).join(":");
      const existing = policyMap.get(key) || {
        branchAId: Number(bA.id),
        branchBId: Number(bB.id),
        enabled: false,
        allowDirect: false,
        allowGroups: false,
        allowDiscovery: false,
        allowFiles: false,
        constraints: {},
        version: 0,
      };
      pairs.push({
        ...existing,
        branchAName: bA.name,
        branchBName: bB.name,
      });
    }
  }
  const teams = await query("SELECT id, name, branch_id AS branchId FROM teams WHERE tenant_id = ? ORDER BY name", [req.tenantId]);
  const employees = await query("SELECT u.id, u.first_name, u.last_name, m.role FROM users u JOIN organization_memberships m ON m.user_id = u.id WHERE m.tenant_id = ? AND m.membership_status = 'active' AND u.status = 'active' ORDER BY u.first_name", [req.tenantId]);
  return { branches, policies: pairs, teams, employees: employees.map((employee) => ({ id: Number(employee.id), name: fullName(employee), role: employee.role })), roles: [...new Set(employees.map((employee) => employee.role))] };
}

async function updateBranchPolicy(req, input = {}) {
  if (!isAdmin(req)) throw fail("Only administrators can configure branch communication policies", 403);
  const branchA = Number(input.branchAId);
  const branchB = Number(input.branchBId);
  if (!branchA || !branchB || branchA === branchB) throw fail("Select two distinct branches", 400);

  const [a, b] = branchPairKey(branchA, branchB);
  const branches = await allTenantBranches(req.tenantId);
  if (![a, b].every((id) => branches.some((branch) => Number(branch.id) === id))) throw fail("Choose branches in this organization", 403);
  const enabled = input.enabled ? 1 : 0;
  const allowDirect = input.allowDirect !== false ? 1 : 0;
  const allowGroups = input.allowGroups !== false ? 1 : 0;
  const allowDiscovery = input.allowDiscovery !== false ? 1 : 0;
  const allowFiles = input.allowFiles !== false ? 1 : 0;
  const constraints = input.constraints || {};
  if (typeof constraints !== "object" || Array.isArray(constraints) || ["userIds", "teamIds", "roles"].some((field) => constraints[field] !== undefined && !Array.isArray(constraints[field]))) throw fail("Policy restrictions must be lists", 400);
  const normalized = { userIds: uniqueIds(constraints.userIds || []), teamIds: uniqueIds(constraints.teamIds || []), roles: Array.isArray(constraints.roles) ? constraints.roles.map(String).slice(0, 50) : [], allowGroupCreation: constraints.allowGroupCreation !== false };
  const validUsers = await usersByIds(req.tenantId, normalized.userIds);
  if (validUsers.size !== normalized.userIds.length) throw fail("Selected employees must belong to this organization", 403);
  if (normalized.teamIds.length) {
    const teams = await query(`SELECT id FROM teams WHERE tenant_id = ? AND id IN (${normalized.teamIds.map(() => "?").join(",")})`, [req.tenantId, ...normalized.teamIds]);
    if (teams.length !== normalized.teamIds.length) throw fail("Selected teams must belong to this organization", 403);
  }

  const [existing] = await query(
    "SELECT id, version FROM team_chat_branch_policies WHERE tenant_id = ? AND branch_a_id = ? AND branch_b_id = ? LIMIT 1",
    [req.tenantId, a, b]
  );

  if (existing) {
    if (input.version !== undefined && Number(input.version) !== Number(existing.version)) throw fail("This policy was changed by another administrator. Reload settings before saving.", 409, "POLICY_CONFLICT");
    const result = await query(
      `UPDATE team_chat_branch_policies
          SET enabled = ?, allow_direct = ?, allow_groups = ?, allow_discovery = ?, allow_files = ?, constraints_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND branch_a_id = ? AND branch_b_id = ? AND version = ?`,
      [enabled, allowDirect, allowGroups, allowDiscovery, allowFiles, JSON.stringify(normalized), req.tenantId, a, b, existing.version]
    );
    if (!result.affectedRows) throw fail("This policy changed while saving. Reload settings.", 409, "POLICY_CONFLICT");
  } else {
    await query(
      `INSERT INTO team_chat_branch_policies (tenant_id, branch_a_id, branch_b_id, enabled, allow_direct, allow_groups, allow_discovery, allow_files, constraints_json, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [req.tenantId, a, b, enabled, allowDirect, allowGroups, allowDiscovery, allowFiles, JSON.stringify(normalized)]
    );
  }

  await logAudit(req.tenantId, req.user.id, "UPDATE_BRANCH_POLICY", "branch_policy", 0, {
    branchAId: a,
    branchBId: b,
    enabled: Boolean(enabled),
    allowDirect: Boolean(allowDirect),
    allowGroups: Boolean(allowGroups),
    allowDiscovery: Boolean(allowDiscovery),
    allowFiles: Boolean(allowFiles),
  });

  return getBranchPolicy(req.tenantId, a, b);
}

/* ── Search ───────────────────────────────────────────────────────────────── */

async function search(req, { query: searchTerm = "", channelId = null }) {
  const term = String(searchTerm || "").trim().slice(0, 100);
  if (!term) return { messages: [], channels: [], members: [] };

  const like = `%${term}%`;
  const visible = await channelsFor(req);
  const visibleIds = visible.map((c) => c.id);
  if (channelId && !visibleIds.includes(Number(channelId))) throw fail("Conversation access denied", 403);
  if (!visibleIds.length) return { messages: [], channels: [], members: [] };

  let channelFilter = `channel_id IN (${visibleIds.map(() => "?").join(",")})`;
  const params = [...visibleIds];
  if (channelId && visibleIds.includes(Number(channelId))) {
    channelFilter = "channel_id = ?";
    params.length = 0;
    params.push(Number(channelId));
  }

  const rows = await query(
    `SELECT * FROM team_chat_messages
      WHERE tenant_id = ? AND ${channelFilter} AND is_deleted = 0 AND body LIKE ? AND created_at >= ${await windowSql(req.tenantId)}
      ORDER BY id DESC LIMIT 40`,
    [req.tenantId, ...params, like]
  );

  const mIds = rows.map((r) => Number(r.id));
  const [names, reactions, attachments, replies] = await Promise.all([
    usersByIds(req.tenantId, rows.map((r) => r.sender_id)),
    reactionsForMessages(req.tenantId, mIds),
    attachmentsForMessages(req.tenantId, mIds),
    repliesForMessages(req.tenantId, rows.map((r) => r.reply_to_id).filter(Boolean)),
  ]);

  const messages = rows.map((r) => messageShape(r, names, reactions, attachments, null, replies));
  const matchingChannels = visible.filter((c) => c.name.toLowerCase().includes(term.toLowerCase()));
  const allMembers = await membersFor(req);
  const matchingMembers = allMembers.filter((m) => m.name.toLowerCase().includes(term.toLowerCase()) || m.email.toLowerCase().includes(term.toLowerCase()));

  return { messages, channels: matchingChannels, members: matchingMembers };
}

/* ── 7-Day Retention Purge ────────────────────────────────────────────────── */

async function purgeExpired() {
  const auditCutoff = db.isSqlite ? "datetime('now', '-90 days')" : "DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)";
  await query(`DELETE FROM team_chat_audit_logs WHERE created_at < ${auditCutoff}`);
  let removed = 0;
  const failures = [];
  const tenants = await query("SELECT id FROM tenants");
  for (const tenant of tenants) {
    try {
    const cutoff = await windowSql(tenant.id);
    const expired = `SELECT id FROM team_chat_messages WHERE tenant_id = ? AND created_at < ${cutoff}`;
    const attachments = await query(`SELECT id, storage_key FROM team_chat_attachments WHERE tenant_id = ? AND (created_at < ${cutoff} OR message_id IN (${expired}))`, [tenant.id, tenant.id]);
    for (const file of attachments) {
      if (file.storage_key && path.basename(file.storage_key) === file.storage_key) {
        for (const directory of [privateChatDir, mediaDir]) {
          try { await fs.promises.unlink(path.join(directory, file.storage_key)); }
          catch (error) { if (error.code !== "ENOENT") throw error; }
        }
      }
      await query("DELETE FROM team_chat_attachments WHERE tenant_id = ? AND id = ?", [tenant.id, file.id]);
    }
    for (const table of ["team_chat_reactions", "team_chat_pins"]) {
      await query(`DELETE FROM ${table} WHERE tenant_id = ? AND message_id IN (${expired})`, [tenant.id, tenant.id]);
    }
    await query(`DELETE FROM team_chat_changes WHERE tenant_id = ? AND (created_at < ${cutoff} OR message_id IN (${expired}))`, [tenant.id, tenant.id]);
    await query(`UPDATE team_chat_messages SET reply_to_id = NULL WHERE tenant_id = ? AND reply_to_id IN (SELECT expired_id FROM (SELECT id AS expired_id FROM team_chat_messages WHERE tenant_id = ? AND created_at < ${cutoff}) expired_rows)`, [tenant.id, tenant.id]);
    const result = await query(`DELETE FROM team_chat_messages WHERE tenant_id = ? AND created_at < ${cutoff}`, [tenant.id]);
    removed += Number(result?.affectedRows || 0);
    await query("DELETE FROM team_chat_reads WHERE tenant_id = ? AND last_read_id NOT IN (SELECT id FROM team_chat_messages WHERE tenant_id = ?)", [tenant.id, tenant.id]);
    } catch (error) { failures.push(error); }
  }
  if (Date.now() - lastOrphanScan > 3600000) {
    const referenced = new Set((await query("SELECT storage_key FROM team_chat_attachments WHERE storage_key IS NOT NULL")).map((file) => file.storage_key));
    for (const channel of await query("SELECT avatar_url FROM team_chat_channels WHERE avatar_url IS NOT NULL")) referenced.add(channel.avatar_url);
    const files = await fs.promises.readdir(privateChatDir, { withFileTypes: true }).catch((error) => { if (error.code === "ENOENT") return []; throw error; });
    for (const file of files) {
      if (!file.isFile() || !file.name.startsWith("tc_") || referenced.has(file.name)) continue;
      const filename = path.join(privateChatDir, file.name);
      try { const stat = await fs.promises.stat(filename); if (stat.mtimeMs < Date.now() - RETENTION_DAYS * 86400000) await fs.promises.unlink(filename); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    lastOrphanScan = Date.now();
  }
  if (failures.length) throw new Error(`Retention cleanup failed for ${failures.length} organization(s); ${failures[0].message}`);
  return removed;
}

let sweep = null;
let lastOrphanScan = 0;
let lastSweepAt = null;
let lastSweepError = null;
let sweeping = false;

function startRetentionSweep() {
  if (sweep) return;
  const run = () => {
    if (sweeping) return;
    sweeping = true;
    purgeExpired()
      .then((count) => {
        lastSweepAt = new Date().toISOString();
        lastSweepError = null;
        if (count) console.log(`[team-chat] removed ${count} message(s) older than ${RETENTION_DAYS} days`);
      })
      .catch((error) => { lastSweepError = error.message; console.warn("[team-chat] retention sweep failed:", error.message); })
      .finally(() => { sweeping = false; });
  };
  run();
  sweep = setInterval(run, 60 * 1000);
  if (typeof sweep.unref === "function") sweep.unref();
}

function retentionState() {
  return { retentionDays: RETENTION_DAYS, lastSweepAt, lastSweepError, sweeping };
}

/* ── Real-Time WebSocket Emitters ─────────────────────────────────────────── */

function emitToRecipients(io, recipients, event, payload) {
  if (!io) return;
  for (const id of uniqueIds(recipients || [])) {
    io.to(`user:${id}`).emit(event, payload);
  }
}

function emitMessage(io, payload) {
  emitToRecipients(io, payload.recipients, "team_chat_message", {
    tenantId: payload.tenantId,
    channelId: payload.channelId,
    channelKind: payload.channelKind,
    message: payload.message,
  });
}

function emitMessageEdited(io, payload) {
  emitToRecipients(io, payload.recipients, "team_chat_message_edited", {
    tenantId: payload.tenantId,
    channelId: payload.channelId,
    message: payload.message,
  });
}

function emitMessageDeleted(io, payload) {
  emitToRecipients(io, payload.recipients, "team_chat_message_deleted", {
    tenantId: payload.tenantId,
    channelId: payload.channelId,
    messageId: payload.messageId,
    stateVersion: payload.stateVersion,
  });
}

function emitReaction(io, payload) {
  emitToRecipients(io, payload.recipients, "team_chat_reaction", {
    tenantId: payload.tenantId,
    channelId: payload.channelId,
    messageId: payload.messageId,
    reactions: payload.reactions,
    stateVersion: payload.stateVersion,
  });
}

function emitPin(io, payload) {
  emitToRecipients(io, payload.recipients, "team_chat_pin", {
    tenantId: payload.tenantId,
    channelId: payload.channelId,
    messageId: payload.messageId,
    isPinned: payload.isPinned,
    stateVersion: payload.stateVersion,
  });
}

function emitChannelCreated(io, payload) {
  emitToRecipients(io, payload.recipients, "team_chat_channel_created", {
    tenantId: payload.tenantId,
    channel: payload.channel,
  });
}

function emitChannelUpdated(io, payload) {
  emitToRecipients(io, payload.recipients, "team_chat_channel_updated", {
    tenantId: payload.tenantId,
    channel: payload.channel,
  });
}

async function emitPolicyUpdated(io, tenantId, policy, affectedUserIds = []) {
  if (!io) return;
  const members = await query("SELECT user_id FROM organization_memberships WHERE tenant_id = ?", [tenantId]);
  emitToRecipients(io, [...members.map((m) => m.user_id), ...affectedUserIds], "team_chat_policy_updated", { tenantId });
}

module.exports = {
  orphanedGroups,
  recoverGroupAdmin,
  markUnread,
  removeGroupAvatar,
  saveGroupAvatar,
  getGroupAvatar,
  notificationPreferences,
  updateNotificationPreferences,
  setGroupRole,
  syncMessages,
  updatePreferences,
  RETENTION_DAYS,
  isAdmin,
  bootstrap,
  channelsFor,
  membersFor,
  groupMembers,
  settings,
  updateSettings,
  findChannel,
  assertChannel,
  canAccessChannel,
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  togglePin,
  listPins,
  saveAttachment,
  getAttachmentFile,
  markRead,
  openDirect,
  createGroup,
  addGroupMembers,
  removeGroupMember,
  updateGroup,
  listBranchPolicies,
  updateBranchPolicy,
  search,
  recipientsFor,
  purgeExpired,
  startRetentionSweep,
  retentionState,
  emitMessage,
  emitMessageEdited,
  emitMessageDeleted,
  emitReaction,
  emitPin,
  emitChannelCreated,
  emitChannelUpdated,
  emitPolicyUpdated,
};

for (const name of ["recoverGroupAdmin", "markUnread", "removeGroupAvatar", "saveGroupAvatar", "setGroupRole", "updatePreferences", "updateSettings", "sendMessage", "editMessage", "deleteMessage", "toggleReaction", "togglePin", "saveAttachment", "markRead", "openDirect", "createGroup", "addGroupMembers", "removeGroupMember", "updateGroup", "updateBranchPolicy"]) {
  const operation = module.exports[name];
  module.exports[name] = (...args) => atomicMutation(async () => {
    const groupMutation = ["recoverGroupAdmin", "removeGroupAvatar", "saveGroupAvatar", "setGroupRole", "addGroupMembers", "removeGroupMember", "updateGroup"].includes(name);
    const channelOperation = groupMutation || ["sendMessage", "editMessage", "deleteMessage", "toggleReaction", "togglePin", "saveAttachment", "markRead", "markUnread", "updatePreferences"].includes(name);
    if (!db.isSqlite && channelOperation && Number.isSafeInteger(Number(args[1])) && Number(args[1]) > 0) await query(`SELECT id FROM team_chat_channels WHERE tenant_id = ? AND id = ? ${groupMutation ? "FOR UPDATE" : "LOCK IN SHARE MODE"}`, [args[0].tenantId, Number(args[1])]);
    return operation(...args);
  });
}
