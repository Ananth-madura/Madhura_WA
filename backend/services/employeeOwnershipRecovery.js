"use strict";
let timer, running = false, lastRun = null;
let lastTenant = 0;
async function run(db, io) {
  if (running || db.isSqlite) return;
  running = true;
  try {
    const workspace = require("./employeeWorkspace").createEmployeeWorkspace(db);
    const tenants = await workspace.inbox.query(`SELECT DISTINCT ct.tenant_id FROM wa_contacts ct
      JOIN tenants t ON t.id=ct.tenant_id AND t.status='active'
      LEFT JOIN users u ON u.id=ct.assigned_agent_id
      LEFT JOIN organization_memberships m ON m.tenant_id=ct.tenant_id AND m.user_id=ct.assigned_agent_id
      WHERE ct.tenant_id>? AND ct.assigned_agent_id IS NOT NULL AND (u.id IS NULL OR u.status<>'active' OR m.user_id IS NULL OR m.membership_status<>'active') ORDER BY ct.tenant_id LIMIT 25`, [lastTenant]);
    lastTenant = tenants.length ? Number(tenants[tenants.length - 1].tenant_id) : 0;
    let transferred = 0, manualReview = 0;
    for (const { tenant_id: tenantId } of tenants) {
      // Actor zero denotes the internal recovery worker, never a browser principal.
      const [position] = await workspace.inbox.query("SELECT last_contact_id FROM wa_ownership_recovery_positions WHERE tenant_id=?", [tenantId]);
      const results = await workspace.reassignInactive({ tenantId, userRole: "organization_owner", user: { id: 0, role: "system" } }, Number(position?.last_contact_id || 0));
      const after = results.length ? Math.max(...results.map(result => result.contactId)) : 0;
      await workspace.inbox.query("INSERT INTO wa_ownership_recovery_positions (tenant_id,last_contact_id) VALUES (?,?) ON DUPLICATE KEY UPDATE last_contact_id=VALUES(last_contact_id)", [tenantId, after]);
      for (const result of results) {
        if (result.status !== "transferred") { manualReview++; continue; }
        transferred++;
        for (const row of result.conversations) {
          if (row.owner_user_id) io?.to(`user:${row.owner_user_id}`).emit("inbox_access_changed", { tenantId, conversationId: row.id });
          await workspace.inbox.emit(io, row, "inbox_changed", {}).catch(() => {});
        }
        for (const userId of [result.previousOwnerId, result.ownerId]) if (userId) io?.to(`user:${userId}`).emit("customer_access_changed", { tenantId, contactId: result.contactId });
      }
    }
    lastRun = { at: new Date().toISOString(), transferred, manualReview };
    return lastRun;
  } finally { running = false; }
}
function start(db, io) {
  if (timer || process.env.WA_AUTO_REASSIGN_INACTIVE === "0") return;
  timer = setInterval(() => run(db, io).catch(error => console.error("[OwnershipRecovery] failed", error.code || "INTERNAL_ERROR")), 60000);
  timer.unref();
}
function stop() { clearInterval(timer); timer = null; }
module.exports = { start, stop, run, status: () => ({ running, lastRun }) };
