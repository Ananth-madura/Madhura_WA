"use strict";
const { createInboxService } = require("./sharedInboxService");

function createCrmIntake(db) {
  const inbox = createInboxService(db);
  async function settings(q, tenantId) {
    const [row] = await q("SELECT crm_strategy,crm_required_skill FROM wa_assignment_settings WHERE tenant_id=?", [tenantId]);
    return row || { crm_strategy: "round_robin", crm_required_skill: null };
  }
  async function candidates(q, tenantId, branchId = null) {
    const rule = await settings(q, tenantId);
    const rows = await q(`SELECT m.user_id,m.branch_id,m.max_open_leads,
      (SELECT COUNT(*) FROM wa_contacts ct WHERE ct.tenant_id=m.tenant_id AND ct.assigned_agent_id=m.user_id AND ct.lifecycle_stage='lead') AS open_count
      FROM staff_branch_memberships m JOIN organization_memberships o ON o.tenant_id=m.tenant_id AND o.user_id=m.user_id AND o.membership_status='active'
      JOIN users u ON u.id=m.user_id AND u.status='active' JOIN branches b ON b.id=m.branch_id AND b.tenant_id=m.tenant_id AND b.status='active'
      WHERE m.tenant_id=? AND m.auto_assign_enabled=1 AND m.is_available=1 AND o.role IN ('employee','agent')
      AND COALESCE(u.whatsapp_access_level,'full') IN ('full','chat_only')
      AND NOT EXISTS (SELECT 1 FROM wa_employee_workspace_permissions p WHERE p.tenant_id=m.tenant_id AND p.user_id=m.user_id AND p.module='customers' AND p.can_view=0)
      ${branchId ? "AND m.branch_id=?" : ""}
      ${rule.crm_required_skill ? "AND EXISTS (SELECT 1 FROM wa_employee_skills s WHERE s.tenant_id=m.tenant_id AND s.user_id=m.user_id AND s.skill=?)" : ""}
      ORDER BY m.user_id,m.is_primary DESC,m.branch_id`, [tenantId,...(branchId ? [branchId] : []),...(rule.crm_required_skill ? [rule.crm_required_skill] : [])]);
    return rows.filter(row => Number(row.open_count) < Number(row.max_open_leads));
  }
  async function assign(q, { tenantId, contactId, branchId = null, actorId = 0 }) {
    await q("INSERT INTO wa_routing_cursors (tenant_id,last_user_id) VALUES (?,0) ON DUPLICATE KEY UPDATE tenant_id=VALUES(tenant_id)", [tenantId]);
    await q("SELECT tenant_id FROM wa_routing_cursors WHERE tenant_id=? FOR UPDATE", [tenantId]);
    const [contact] = await q("SELECT id,assigned_agent_id,branch_id FROM wa_contacts WHERE tenant_id=? AND id=? FOR UPDATE", [tenantId,contactId]);
    if (!contact || contact.assigned_agent_id) return contact || null;
    const [chat] = await q("SELECT id FROM conversations WHERE tenant_id=? AND contact_id=? LIMIT 1", [tenantId,contactId]);
    if (chat) return contact;
    const rule = await settings(q, tenantId);
    if (rule.crm_strategy === "manual") return contact;
    const poolBranch = Number(branchId || contact.branch_id) || 0;
    await q("INSERT IGNORE INTO wa_routing_positions (tenant_id,sender_id,branch_id) VALUES (?,0,?)", [tenantId,poolBranch]);
    const [cursor] = await q("SELECT last_user_id FROM wa_routing_positions WHERE tenant_id=? AND sender_id=0 AND branch_id=?", [tenantId,poolBranch]);
    let eligible = await candidates(q, tenantId, poolBranch);
    if (rule.crm_strategy === "workload" && eligible.length) {
      const minimum = Math.min(...eligible.map(row => Number(row.open_count)));
      eligible = eligible.filter(row => Number(row.open_count) === minimum);
    }
    const selected = eligible.find(row => Number(row.user_id)>Number(cursor.last_user_id)) || eligible[0];
    if (!selected) return contact;
    await q("UPDATE wa_contacts SET assigned_agent_id=?,branch_id=? WHERE tenant_id=? AND id=? AND assigned_agent_id IS NULL", [selected.user_id,selected.branch_id,tenantId,contactId]);
    await q("UPDATE wa_enquiries SET branch_id=? WHERE tenant_id=? AND contact_id=?", [selected.branch_id,tenantId,contactId]);
    await q("UPDATE wa_routing_positions SET last_user_id=? WHERE tenant_id=? AND sender_id=0 AND branch_id=?", [selected.user_id,tenantId,poolBranch]);
    await q("INSERT INTO wa_workspace_audit (tenant_id,actor_id,action,subject_user_id,details) VALUES (?,?,'customer.auto_assigned',?,?)", [tenantId,actorId,selected.user_id,JSON.stringify({contactId,branchId:selected.branch_id,strategy:rule.crm_strategy})]);
    await q("INSERT INTO wa_customer_activities (tenant_id,contact_id,actor_id,kind,body) VALUES (?,?,?,'assignment',?)", [tenantId,contactId,actorId,`Assigned to employee ${selected.user_id} by ${rule.crm_strategy}`]);
    return { ...contact,assigned_agent_id:selected.user_id,branch_id:selected.branch_id };
  }
  async function retry(req) {
    if (!inbox.isAdmin(req)) throw Object.assign(new Error("Organization administrator required"),{status:403});
    return inbox.transaction(async q => {
      const contacts = await q("SELECT ct.id,ct.branch_id FROM wa_contacts ct WHERE ct.tenant_id=? AND ct.assigned_agent_id IS NULL AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.tenant_id=ct.tenant_id AND c.contact_id=ct.id) ORDER BY ct.id LIMIT 50",[req.tenantId]);
      let assigned = 0;
      for (const contact of contacts) if ((await assign(q,{tenantId:req.tenantId,contactId:contact.id,branchId:contact.branch_id,actorId:req.user.id}))?.assigned_agent_id) assigned++;
      return {assigned,reviewed:contacts.length};
    });
  }
  return { assign, candidates, settings, retry };
}
module.exports = { createCrmIntake };
