"use strict";

const ADMIN_ROLES = new Set(["organization_owner", "organization_admin"]);
const fail = (message, status = 403) => Object.assign(new Error(message), { status });

function createInboxService(database) {
  const query = async (sql, params = []) => (await database.promise().query(sql, params))[0];
  const transaction = async (work) => {
    if (database.isSqlite) throw fail("Shared-number routing requires the configured MySQL database", 503);
    const connection = await new Promise((resolve, reject) => database.getConnection((err, conn) => err ? reject(err) : resolve(conn)));
    const client = connection.promise();
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await client.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
          await client.beginTransaction();
          const result = await work(async (sql, values = []) => (await client.query(sql, values))[0]);
          await client.commit();
          return result;
        } catch (error) {
          await client.rollback();
          if (attempt >= 3 || !["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code)) throw error;
          await new Promise(resolve => setTimeout(resolve, 15 * (attempt + 1)));
        }
      }
    } finally { connection.release(); }
  };
  const isAdmin = req => ADMIN_ROLES.has(req.userRole) || req.user?.role === "platform_admin";
  async function branches(req) {
    if (isAdmin(req)) return null;
    const rows = await query("SELECT branch_id FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = ?", [req.tenantId, req.user.id]);
    return rows.map(row => Number(row.branch_id));
  }
  async function scope(req, alias = "c") {
    const clauses = [`${alias}.tenant_id = ?`], params = [req.tenantId];
    const permitted = await branches(req);
    if (permitted !== null) {
      if (req.waAccessLevel === "campaign_only") clauses.push("1 = 0");
      clauses.push(`EXISTS (SELECT 1 FROM sender_branch_assignments sba WHERE sba.tenant_id = ${alias}.tenant_id AND sba.sender_id = ${alias}.sender_id AND sba.branch_id = ${alias}.branch_id)`);
      if (!permitted.length) clauses.push("1 = 0");
      else { clauses.push(`${alias}.branch_id IN (${permitted.map(() => "?").join(",")})`); params.push(...permitted); }
      if (req.userRole !== "branch_manager") { clauses.push(`${alias}.owner_user_id = ?`); params.push(req.user.id); }
      if (req.userRole !== "branch_manager") {
        clauses.push(`(NOT EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id = ${alias}.tenant_id AND a.user_id = ?) OR EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id = ${alias}.tenant_id AND a.user_id = ? AND a.sender_id = ${alias}.sender_id))`);
        params.push(req.user.id, req.user.id);
      }
    }
    return { sql: clauses.join(" AND "), params };
  }
  async function conversation(req, id) {
    const access = await scope(req);
    const [row] = await query(`SELECT c.*, ct.phone AS contact_phone, ct.name AS contact_name
      FROM conversations c JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.tenant_id = c.tenant_id
      WHERE c.id = ? AND ${access.sql}`, [Number(id), ...access.params]);
    if (!row) throw fail("Conversation not found", 404);
    return row;
  }
  async function lockPool(q, tenantId) {
    await q("INSERT INTO wa_routing_cursors (tenant_id, last_user_id) VALUES (?, 0) ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id)", [tenantId]);
    return (await q("SELECT last_user_id FROM wa_routing_cursors WHERE tenant_id = ? FOR UPDATE", [tenantId]))[0];
  }
  async function candidates(q, tenantId, senderId, branchId = null) {
    return q(`SELECT m.user_id, m.branch_id, m.max_open_chats,
      (SELECT COUNT(*) FROM conversations c WHERE c.tenant_id = m.tenant_id AND c.owner_user_id = m.user_id AND c.status <> 'closed') AS open_count
      FROM staff_branch_memberships m
      JOIN organization_memberships o ON o.tenant_id = m.tenant_id AND o.user_id = m.user_id AND o.membership_status = 'active'
      JOIN users u ON u.id = m.user_id AND u.status = 'active'
      JOIN branches b ON b.id = m.branch_id AND b.tenant_id = m.tenant_id AND b.status = 'active'
      JOIN sender_branch_assignments s ON s.tenant_id = m.tenant_id AND s.branch_id = m.branch_id AND s.sender_id = ?
      WHERE m.tenant_id = ? AND m.auto_assign_enabled = 1 AND m.is_available = 1
      AND (NOT EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id = m.tenant_id AND a.user_id = m.user_id)
        OR EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id = m.tenant_id AND a.user_id = m.user_id AND a.sender_id = s.sender_id))
      AND o.role IN ('agent', 'employee') AND COALESCE(u.whatsapp_access_level, 'full') IN ('full', 'chat_only') ${branchId ? "AND m.branch_id = ?" : ""}
      ORDER BY m.user_id, m.is_primary DESC, m.branch_id`, [senderId, tenantId, ...(branchId ? [branchId] : [])]);
  }
  async function selectOwner(q, tenantId, senderId, branchId) {
    await q("INSERT IGNORE INTO wa_routing_positions (tenant_id, sender_id, branch_id) VALUES (?, ?, ?)", [tenantId,senderId,branchId || 0]);
    const [cursor] = await q("SELECT last_user_id FROM wa_routing_positions WHERE tenant_id = ? AND sender_id = ? AND branch_id = ?", [tenantId,senderId,branchId || 0]);
    const rows = (await candidates(q, tenantId, senderId, branchId)).filter(row => Number(row.open_count) < Number(row.max_open_chats));
    const chosen = rows.find(row => Number(row.user_id) > Number(cursor.last_user_id)) || rows[0];
    if (chosen) await q("UPDATE wa_routing_positions SET last_user_id = ? WHERE tenant_id = ? AND sender_id = ? AND branch_id = ?", [chosen.user_id, tenantId, senderId, branchId || 0]);
    return chosen;
  }
  async function inbound({ tenantId, senderId, phone, name, timestamp }) {
    if (!tenantId || !senderId || !/^\d{7,20}$/.test(phone)) throw fail("Invalid sender or WhatsApp identity", 400);
    return transaction(async q => {
      const [sender] = await q("SELECT id FROM wa_senders WHERE tenant_id = ? AND id = ? AND status = 'connected'", [tenantId, senderId]);
      if (!sender) throw fail("Sender is not connected", 503);
      await q(`INSERT INTO wa_contacts (tenant_id, phone, name, source) VALUES (?, ?, ?, 'WhatsApp Cloud API')
        ON DUPLICATE KEY UPDATE phone = VALUES(phone)`, [tenantId, phone, name || `+${phone}`]);
      const [contact] = await q("SELECT id FROM wa_contacts WHERE tenant_id = ? AND phone = ?", [tenantId, phone]);
      const created=await q("INSERT IGNORE INTO conversations (tenant_id, sender_id, contact_id, status) VALUES (?, ?, ?, 'open')", [tenantId, senderId, contact.id]);
      const [current] = await q("SELECT * FROM conversations WHERE tenant_id = ? AND sender_id = ? AND contact_id = ? FOR UPDATE", [tenantId, senderId, contact.id]);
      let owner = current.owner_user_id;
      let branch = current.branch_id;
      if (owner) {
        const [validOwner] = await q(`SELECT u.id FROM users u JOIN organization_memberships o ON o.user_id = u.id AND o.tenant_id = ? AND o.membership_status = 'active'
          JOIN staff_branch_memberships m ON m.tenant_id = o.tenant_id AND m.user_id = u.id AND m.branch_id = ?
          JOIN sender_branch_assignments s ON s.tenant_id = m.tenant_id AND s.branch_id = m.branch_id AND s.sender_id = ?
          WHERE u.id = ? AND u.status = 'active' AND COALESCE(u.whatsapp_access_level, 'full') IN ('full','chat_only','read_only')
          AND (NOT EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id = o.tenant_id AND a.user_id = u.id)
            OR EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id = o.tenant_id AND a.user_id = u.id AND a.sender_id = s.sender_id))`, [tenantId, branch, senderId, owner]);
        if (!validOwner) owner = null;
      }
      if (!owner) {
        await lockPool(q, tenantId);
        const selected = await selectOwner(q, tenantId, senderId, branch);
        owner = selected?.user_id || null;
        branch = selected?.branch_id || branch;
      }
      const at = new Date(timestamp || Date.now());
      await q(`UPDATE conversations SET owner_user_id = ?, branch_id = ?, status = 'open',
        last_message_at = GREATEST(COALESCE(last_message_at, ?), ?),
        service_window_expires_at = GREATEST(COALESCE(service_window_expires_at, ?), ?), updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND id = ?`, [owner, branch, at, at, new Date(at.getTime() + 86400000), new Date(at.getTime() + 86400000), tenantId, current.id]);
      if (Number(current.owner_user_id) !== Number(owner)) await q("INSERT INTO wa_assignment_events (tenant_id, conversation_id, actor_id, owner_user_id, branch_id) VALUES (?, ?, NULL, ?, ?)", [tenantId, current.id, owner, branch]);
      return { ...current, owner_user_id: owner, branch_id: branch, contact_phone: phone, isNew:created.affectedRows>0 };
    });
  }
  async function reassign(req, id, { userId = null, branchId = null, status = null }) {
    if (!isAdmin(req) && req.userRole !== "branch_manager") throw fail("Assignment management requires a manager");
    await conversation(req, id);
    const allowed = await branches(req);
    if (branchId && allowed !== null && !allowed.includes(Number(branchId))) throw fail("Target branch is not permitted");
    return transaction(async q => {
      await lockPool(q, req.tenantId);
      const [row] = await q("SELECT * FROM conversations WHERE tenant_id = ? AND id = ? FOR UPDATE", [req.tenantId, Number(id)]);
      if (!row || (allowed !== null && !allowed.includes(Number(row.branch_id)))) throw fail("Conversation not found", 404);
      const targetBranch = Number(branchId || row.branch_id) || null;
      if (userId) {
        const eligible = await candidates(q, req.tenantId, row.sender_id, targetBranch);
        if (!eligible.some(item => Number(item.user_id) === Number(userId) && Number(item.open_count) < Number(item.max_open_chats))) throw fail("Employee is unavailable, at capacity, or outside the sender/branch", 400);
      }
      if (targetBranch) {
        const [linked] = await q("SELECT branch_id FROM sender_branch_assignments WHERE tenant_id = ? AND sender_id = ? AND branch_id = ?", [req.tenantId, row.sender_id, targetBranch]);
        if (!linked) throw fail("Number is not assigned to the target branch", 400);
      }
      await q("UPDATE conversations SET owner_user_id = ?, branch_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?", [userId || null, targetBranch, status || row.status, req.tenantId, row.id]);
      await q("INSERT INTO wa_assignment_events (tenant_id, conversation_id, actor_id, owner_user_id, branch_id) VALUES (?, ?, ?, ?, ?)", [req.tenantId, row.id, req.user.id, userId || null, targetBranch]);
      return { ...row, owner_user_id: userId || null, branch_id: targetBranch };
    });
  }
  async function audience(row) {
    const [current] = await query(`SELECT c.id,c.owner_user_id,c.branch_id,c.status,c.automation_mode,c.automation_error,c.last_message_at,c.updated_at,c.service_window_expires_at,
      EXISTS (SELECT 1 FROM sender_branch_assignments s WHERE s.tenant_id=c.tenant_id AND s.sender_id=c.sender_id AND s.branch_id=c.branch_id) AS number_linked
      FROM conversations c WHERE c.tenant_id=? AND c.id=?`, [row.tenant_id, row.id]);
    if (!current) return {users:[],current:null};
    row = { ...row, ...current };
    if (!current.number_linked) row = { ...row, owner_user_id:null, branch_id:null };
    const members = await query(`SELECT DISTINCT o.user_id FROM organization_memberships o JOIN users u ON u.id = o.user_id AND u.status = 'active'
      WHERE o.tenant_id = ? AND o.membership_status = 'active' AND
      (o.role IN ('organization_owner', 'organization_admin') OR (o.user_id = ? AND
        (NOT EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id = o.tenant_id AND a.user_id = o.user_id)
          OR EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id = o.tenant_id AND a.user_id = o.user_id AND a.sender_id = ?)) AND EXISTS
        (SELECT 1 FROM staff_branch_memberships m WHERE m.tenant_id = o.tenant_id AND m.user_id = o.user_id AND m.branch_id = ?))
      OR (o.role = 'branch_manager' AND EXISTS (SELECT 1 FROM staff_branch_memberships m WHERE m.tenant_id = o.tenant_id AND m.user_id = o.user_id AND m.branch_id = ?)))`,
    [row.tenant_id, row.owner_user_id, row.sender_id, row.branch_id, row.branch_id]);
    return {users:members.map(member => Number(member.user_id)),current};
  }
  async function recipients(row){return (await audience(row)).users;}
  async function retryUnassigned(req) {
    if (!isAdmin(req)) throw fail("Organization administrator required");
    return transaction(async q => {
      await lockPool(q, req.tenantId);
      const rows = await q("SELECT * FROM conversations WHERE tenant_id = ? AND owner_user_id IS NULL AND status = 'open' ORDER BY id LIMIT 100 FOR UPDATE", [req.tenantId]);
      let assigned = 0;
      for (const row of rows) {
        const selected = await selectOwner(q, req.tenantId, row.sender_id, row.branch_id);
        if (!selected) continue;
        await q("UPDATE conversations SET owner_user_id = ?, branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?", [selected.user_id, selected.branch_id, req.tenantId, row.id]);
        await q("INSERT INTO wa_assignment_events (tenant_id, conversation_id, actor_id, owner_user_id, branch_id) VALUES (?, ?, ?, ?, ?)", [req.tenantId, row.id, req.user.id, selected.user_id, selected.branch_id]);
        assigned++;
      }
      return assigned;
    });
  }
  async function emit(io, row, event, payload) {
    if (!io) return;
    const scope=await audience(row);
    if(!scope.current)return;
    const {number_linked,...conversation}=scope.current;
    for (const id of scope.users) io.to(`user:${id}`).emit(event, { ...payload, conversation, tenantId: row.tenant_id, conversationId: row.id, senderId: row.sender_id });
  }
  return { query, transaction, isAdmin, scope, conversation, inbound, reassign, recipients, emit, retryUnassigned };
}

module.exports = { createInboxService, ADMIN_ROLES };
