"use strict";
const { createInboxService } = require("./sharedInboxService");
const { MODULES, DEFAULT_EDIT } = require("../middleware/workspaceModule");
const fail = (status, message) => Object.assign(new Error(message), { status });
const positiveId = value => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw fail(400, "A valid record ID is required");
  return id;
};
const text = (value, max, required = false) => {
  const result = String(value ?? "").trim();
  if (result.length > max || (required && !result)) throw fail(400, `Enter between ${required ? 1 : 0} and ${max} characters`);
  return result;
};

function createEmployeeWorkspace(db) {
  const inbox = createInboxService(db);
  const q = inbox.query;
  async function columns(query, table) {
    return new Set((await query("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?", [table])).map(row => row.name));
  }
  const modules = MODULES;
  async function permission(req, module, edit = false,reader=q) {
    if (!modules.includes(module)) throw fail(400, "Unknown workspace module");
    if (inbox.isAdmin(req)) return true;
    const [grant] = await reader("SELECT can_view,can_edit FROM wa_employee_workspace_permissions WHERE tenant_id=? AND user_id=? AND module=?", [req.tenantId, req.user.id, module]);
    if (grant) return Boolean(grant.can_view && (!edit || grant.can_edit));
    return edit ? DEFAULT_EDIT.has(module) : true;
  }
  // Resolved view/edit map for the signed-in member. The dashboard rail uses
  // this to show only the modules an administrator has granted.
  async function permissionsFor(req) {
    const resolved = {};
    if (inbox.isAdmin(req)) {
      for (const module of modules) resolved[module] = { view: true, edit: true };
      return resolved;
    }
    const rows = await q("SELECT module,can_view,can_edit FROM wa_employee_workspace_permissions WHERE tenant_id=? AND user_id=?", [req.tenantId, req.user.id]);
    const saved = Object.fromEntries(rows.map(row => [row.module, row]));
    for (const module of modules) {
      const row = saved[module];
      resolved[module] = row
        ? { view: Boolean(row.can_view), edit: Boolean(row.can_view && row.can_edit) }
        : { view: true, edit: DEFAULT_EDIT.has(module) };
    }
    return resolved;
  }
  async function requireModule(req, module, edit = false,reader=q) {
    if (!await permission(req, module, edit,reader)) throw fail(403, "This module action is not permitted");
  }
  async function scope(req, alias = "ct", options = {},reader=q) {
    const principal=inbox.principalScope(req,alias);
    const base=`${alias}.tenant_id=? AND ${principal.sql}`,baseParams=[req.tenantId,...principal.params];
    if (inbox.isAdmin(req)) return { sql: base, params: baseParams };
    if (req.waAccessLevel === "campaign_only" && !options.campaign) return { sql: "1=0", params: [] };
    if (req.userRole === "branch_manager") {
      const access = await inbox.scope(req,"c",reader);
      // A customer with conversations outside the manager's branch is not a team-wide grant.
      return { sql: `${base} AND (EXISTS (SELECT 1 FROM conversations c WHERE c.contact_id=${alias}.id AND ${access.sql}) OR (NOT EXISTS (SELECT 1 FROM conversations c WHERE c.tenant_id=${alias}.tenant_id AND c.contact_id=${alias}.id) AND EXISTS (SELECT 1 FROM staff_branch_memberships m WHERE m.tenant_id=${alias}.tenant_id AND m.user_id=? AND m.branch_id=${alias}.branch_id))) AND NOT EXISTS
        (SELECT 1 FROM conversations x WHERE x.tenant_id=${alias}.tenant_id AND x.contact_id=${alias}.id AND (x.branch_id IS NULL OR NOT EXISTS
        (SELECT 1 FROM staff_branch_memberships m WHERE m.tenant_id=x.tenant_id AND m.user_id=? AND m.branch_id=x.branch_id)))`, params: [...baseParams, ...access.params, req.user.id,req.user.id] };
    }
    return { sql: `${base} AND ${alias}.assigned_agent_id=? AND NOT EXISTS
      (SELECT 1 FROM conversations x WHERE x.tenant_id=${alias}.tenant_id AND x.contact_id=${alias}.id AND
       (x.owner_user_id IS NULL OR x.owner_user_id<>? OR NOT EXISTS (SELECT 1 FROM staff_branch_memberships m WHERE m.tenant_id=x.tenant_id AND m.user_id=? AND m.branch_id=x.branch_id)
       OR NOT EXISTS (SELECT 1 FROM sender_branch_assignments s WHERE s.tenant_id=x.tenant_id AND s.sender_id=x.sender_id AND s.branch_id=x.branch_id)
       OR (EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=x.tenant_id AND a.user_id=?) AND NOT EXISTS
       (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=x.tenant_id AND a.user_id=? AND a.sender_id=x.sender_id))))`,
      params: [...baseParams, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id] };
  }
  async function customer(req, id, query = q, lock = false, options = {}) {
    await requireModule(req, "customers",false,query);
    const access = await scope(req,"ct",options,query);
    const [row] = await query(`SELECT ct.id,ct.tenant_id,ct.name,ct.phone,ct.email,ct.assigned_agent_id,ct.lifecycle_stage,ct.branch_id,ct.opt_in_status
      FROM wa_contacts ct WHERE ct.id=? AND ${access.sql}${lock ? " FOR UPDATE" : ""}`, [positiveId(id), ...access.params]);
    if (!row) throw fail(404, "Customer not found");
    return row;
  }
  async function list(req, filters = {}) {
    await requireModule(req, "customers");
    const access = await scope(req);
    const clauses = [access.sql], params = [...access.params];
    if (filters.before) { clauses.push("ct.id<?"); params.push(positiveId(filters.before)); }
    if (filters.search) { clauses.push("(ct.name LIKE ? OR ct.phone LIKE ? OR ct.email LIKE ?)"); const search = `%${text(filters.search, 100)}%`; params.push(search, search, search); }
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 25));
    const rows = await q(`SELECT ct.id,ct.name,ct.phone,ct.email,ct.assigned_agent_id,ct.lifecycle_stage FROM wa_contacts ct WHERE ${clauses.join(" AND ")} ORDER BY ct.id DESC LIMIT ?`, [...params, limit + 1]);
    return { customers: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
  }
  async function history(req, id, kind, before) {
    await requireModule(req, kind);
    await customer(req, id);
    const tables = { tasks: "wa_customer_tasks", deals: "wa_customer_deals", activities: "wa_customer_activities", transfers: "wa_customer_transfers", leads: "wa_enquiries" };
    const table = tables[kind];
    if (!table) throw fail(400, "Unknown record type");
    const access = await scope(req);
    const rows = await q(`SELECT r.* FROM ${table} r JOIN wa_contacts ct ON ct.id=r.contact_id AND ct.tenant_id=r.tenant_id WHERE r.contact_id=? AND ${access.sql} ${before ? "AND r.id<?" : ""} ORDER BY r.id DESC LIMIT 26`, [positiveId(id), ...access.params, ...(before ? [positiveId(before)] : [])]);
    return { records: rows.slice(0, 25), nextCursor: rows.length > 25 ? rows[24].id : null };
  }
  const writable = req => { if (["read_only", "campaign_only"].includes(req.waAccessLevel)) throw fail(403, "Customer editing is not permitted"); };
  async function mutate(req, id, work) {
    writable(req);
    return inbox.transaction(async query => {
      const contact = await customer(req, id, query, true);
      return work(query, contact);
    });
  }
  const activity = (query, req, id, kind, body) => query("INSERT INTO wa_customer_activities (tenant_id,contact_id,actor_id,kind,body) VALUES (?,?,?,?,?)", [req.tenantId, id, req.user.id, kind, body]);
  async function createRecord(req, id, kind, data) {
    await requireModule(req, kind, true);
    return mutate(req, id, async (query, contact) => {
      let result;
      if (kind === "activities") {
        if (!["note", "call", "meeting"].includes(data.kind)) throw fail(400, "Choose note, call or meeting");
        result = await activity(query, req, contact.id, data.kind, text(data.body, 10000, true));
      } else if (kind === "tasks") {
        const due = data.due_at ? new Date(data.due_at) : null;
        if (due && !Number.isFinite(due.getTime())) throw fail(400, "Enter a valid follow-up date");
        result = await query("INSERT INTO wa_customer_tasks (tenant_id,contact_id,title,due_at,created_by) VALUES (?,?,?,?,?)", [req.tenantId, contact.id, text(data.title, 255, true), due, req.user.id]);
      } else if (kind === "deals") {
        const amount = Number(data.amount || 0);
        if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999.99) throw fail(400, "Enter a valid deal amount");
        result = await query("INSERT INTO wa_customer_deals (tenant_id,contact_id,title,amount,created_by) VALUES (?,?,?,?,?)", [req.tenantId, contact.id, text(data.title, 255, true), amount, req.user.id]);
      } else if (kind === "leads") {
        result = await query("INSERT INTO wa_enquiries (tenant_id,contact_id,name,phone,email,message,created_by) VALUES (?,?,?,?,?,?,?)", [req.tenantId, contact.id, contact.name, contact.phone, contact.email, text(data.message, 10000, true), req.user.id]);
      } else throw fail(400, "Unknown record type");
      if (kind !== "activities") await activity(query, req, contact.id, "created", `${kind} #${result.insertId} created`);
      return { id: result.insertId };
    });
  }
  async function updateRecord(req, id, kind, recordId, data) {
    await requireModule(req, kind, true);
    return mutate(req, id, async (query, contact) => {
      const options = {
        tasks: { table: "wa_customer_tasks", column: "status", values: ["open", "completed", "cancelled"] },
        deals: { table: "wa_customer_deals", column: "stage", values: ["new", "qualified", "proposal", "negotiation", "won", "lost"] },
        leads: { table: "wa_enquiries", column: "temperature", values: ["new", "cold", "warm", "hot"] }
      };
      const option = options[kind], value = option && data[option.column];
      if (!option || !option.values.includes(value)) throw fail(400, "Select a valid status or stage");
      const extra = kind === "tasks" ? ",completed_by=?,completed_at=?" : "";
      const result = await query(`UPDATE ${option.table} SET ${option.column}=?,updated_at=CURRENT_TIMESTAMP${extra} WHERE tenant_id=? AND contact_id=? AND id=?`,
        [value, ...(kind === "tasks" ? [value === "completed" ? req.user.id : null, value === "completed" ? new Date() : null] : []), req.tenantId, contact.id, positiveId(recordId)]);
      if (!result.affectedRows) throw fail(404, "Record not found");
      await activity(query, req, contact.id, "updated", `${kind} #${recordId}: ${value}`);
      return { success: true };
    });
  }
  async function transfer(req, id, data) {
    if (!inbox.isAdmin(req)) throw fail(403, "Full customer transfers require an organization administrator");
    const userId = positiveId(data.userId), branchId = positiveId(data.branchId);
    if (!Object.hasOwn(data, "expectedOwnerId")) throw fail(400, "Confirm the current customer owner before transfer");
    const reason = text(data.reason, 1000, true);
    return inbox.transaction(async query => {
      await query("INSERT INTO wa_routing_cursors (tenant_id,last_user_id) VALUES (?,0) ON DUPLICATE KEY UPDATE tenant_id=VALUES(tenant_id)", [req.tenantId]);
      await query("SELECT tenant_id FROM wa_routing_cursors WHERE tenant_id=? FOR UPDATE", [req.tenantId]);
      const contact = await customer(req, id, query, true);
      if (Number(contact.assigned_agent_id || 0) !== Number(data.expectedOwnerId || 0)) throw fail(409, "Ownership changed. Refresh before transferring");
      const [employee] = await query(`SELECT u.id,u.whatsapp_access_level FROM users u JOIN organization_memberships o ON o.user_id=u.id AND o.tenant_id=? AND o.membership_status='active'
        JOIN staff_branch_memberships m ON m.user_id=u.id AND m.tenant_id=o.tenant_id AND m.branch_id=?
        JOIN branches b ON b.id=m.branch_id AND b.tenant_id=m.tenant_id AND b.status='active'
        WHERE u.id=? AND u.status='active' AND o.role IN ('agent','employee') AND COALESCE(u.whatsapp_access_level,'full') IN ('full','chat_only','read_only','campaign_only')`, [req.tenantId, branchId, userId]);
      if (!employee) throw fail(400, "Select an active employee in this organization and branch");
      const conversations = await query("SELECT * FROM conversations WHERE tenant_id=? AND contact_id=? ORDER BY id FOR UPDATE", [req.tenantId, contact.id]);
      if(conversations.length&&employee.whatsapp_access_level==="campaign_only")throw fail(400,"A campaigns-only employee cannot receive active conversation ownership");
      if (data.enforceCapacity) {
        const pool = conversations.length ? await inbox.candidates(query,req.tenantId,conversations[0].sender_id,branchId) : await require("./crmIntake").createCrmIntake(db).candidates(query,req.tenantId,branchId);
        const eligible = pool.find(row => Number(row.user_id) === userId);
        const added = conversations.filter(row => row.status !== "closed" && Number(row.owner_user_id) !== userId).length;
        if (!eligible || (conversations.length ? Number(eligible.open_count)+added>Number(eligible.max_open_chats) : Number(eligible.open_count)+1>Number(eligible.max_open_leads))) throw fail(409, "The destination employee no longer has capacity");
      }
      for (const row of conversations) {
        const [linked] = await query(`SELECT sender_id FROM sender_branch_assignments WHERE tenant_id=? AND sender_id=? AND branch_id=?
          AND (NOT EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=? AND a.user_id=?) OR EXISTS
          (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=? AND a.user_id=? AND a.sender_id=?))`, [req.tenantId, row.sender_id, branchId, req.tenantId, userId, req.tenantId, userId, row.sender_id]);
        if (!linked) throw fail(400, "Destination employee must have access to every customer WhatsApp number");
      }
      await query("UPDATE wa_contacts SET assigned_agent_id=?,branch_id=? WHERE tenant_id=? AND id=?", [userId,branchId,req.tenantId,contact.id]);
      const enquiryColumns = await columns(query, "wa_enquiries");
      if (enquiryColumns.has("branch_id")) await query("UPDATE wa_enquiries SET branch_id=? WHERE tenant_id=? AND contact_id=?", [branchId, req.tenantId, contact.id]);
      const leadColumns = await columns(query, "telecalls");
      if (leadColumns.has("tenant_id") && leadColumns.has("assigned_to") && enquiryColumns.has("crm_lead_id")) await query("UPDATE telecalls t JOIN wa_enquiries e ON e.crm_lead_id=t.id AND e.tenant_id=t.tenant_id SET t.assigned_to=? WHERE e.tenant_id=? AND e.contact_id=?", [userId, req.tenantId, contact.id]);
      const clientColumns = await columns(query, "clients");
      if (clientColumns.has("tenant_id") && clientColumns.has("owner_user_id") && enquiryColumns.has("converted_client_id")) await query("UPDATE clients c JOIN wa_enquiries e ON e.converted_client_id=c.id AND e.tenant_id=c.tenant_id SET c.owner_user_id=? WHERE e.tenant_id=? AND e.contact_id=?", [userId, req.tenantId, contact.id]);
      const reminderColumns = await columns(query, "wa_interactive_reminders");
      if (["tenant_id", "assigned_user_id", "phone", "status"].every(column => reminderColumns.has(column))) await query("UPDATE wa_interactive_reminders SET assigned_user_id=? WHERE tenant_id=? AND phone=? AND status='pending' AND (assigned_user_id=? OR assigned_user_id IS NULL)", [userId, req.tenantId, contact.phone, contact.assigned_agent_id]);
      for (const row of conversations) {
        await query("UPDATE conversations SET owner_user_id=?,branch_id=?,automation_mode='human',automation_version=automation_version+1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [userId, branchId, req.tenantId, row.id]);
        await query("UPDATE wa_flow_runs SET status='paused_by_agent',ended_at=CURRENT_TIMESTAMP WHERE conversation_id=? AND status='active'", [row.id]);
        await query("INSERT INTO wa_assignment_events (tenant_id,conversation_id,actor_id,owner_user_id,branch_id) VALUES (?,?,?,?,?)", [req.tenantId, row.id, req.user.id, userId, branchId]);
      }
      const result = await query("INSERT INTO wa_customer_transfers (tenant_id,contact_id,previous_owner_user_id,owner_user_id,actor_id,branch_id,reason,conversation_count) VALUES (?,?,?,?,?,?,?,?)", [req.tenantId, contact.id, contact.assigned_agent_id, userId, req.user.id, branchId, reason, conversations.length]);
      await query("INSERT INTO wa_workspace_audit (tenant_id,actor_id,action,subject_user_id,details) VALUES (?,?,'customer.transfer',?,?)", [req.tenantId, req.user.id, userId, JSON.stringify({ transferId: result.insertId, contactId: contact.id, previousOwnerId: contact.assigned_agent_id, reason })]);
      await activity(query, req, contact.id, "transfer", `Owner ${contact.assigned_agent_id || "unassigned"} → ${userId}. ${reason}`);
      return { transferId: result.insertId, previousOwnerId: contact.assigned_agent_id, ownerId: userId, conversations };
    });
  }
  async function analytics(req) {
    await requireModule(req, "customers");
    const access = await scope(req);
    const [counts] = await q(`SELECT COUNT(*) AS customers,SUM(ct.lifecycle_stage='client') AS clients FROM wa_contacts ct WHERE ${access.sql}`, access.params);
    const totals = {};
    for (const [key, table, condition] of [["open_tasks", "wa_customer_tasks", "r.status='open'"], ["overdue_tasks", "wa_customer_tasks", "r.status='open' AND r.due_at<CURRENT_TIMESTAMP"], ["completed_tasks", "wa_customer_tasks", "r.status='completed'"], ["won_deals", "wa_customer_deals", "r.stage='won'"], ["deals", "wa_customer_deals", "1=1"], ["leads", "wa_enquiries", "1=1"], ["qualified_leads", "wa_enquiries", "r.temperature IN ('cold','warm','hot')"]]) {
      if (!await permission(req, table === "wa_customer_tasks" ? "tasks" : table === "wa_customer_deals" ? "deals" : "leads")) continue;
      const [row] = await q(`SELECT COUNT(*) AS count FROM ${table} r JOIN wa_contacts ct ON ct.tenant_id=r.tenant_id AND ct.id=r.contact_id WHERE ${access.sql} AND ${condition}`, access.params);
      totals[key] = row.count;
    }
    const chatAccess = await inbox.scope(req);
    const [chat] = await q(`SELECT COUNT(*) AS conversations,SUM(c.status='open') AS active_conversations FROM conversations c WHERE ${chatAccess.sql}`, chatAccess.params);
    const [metadata] = await q(`SELECT COALESCE(SUM(metrics.unread),0) AS unread_messages,COUNT(CASE WHEN metrics.first_reply>=metrics.first_inbound THEN 1 END) AS first_response_samples,
      ROUND(AVG(CASE WHEN metrics.first_reply>=metrics.first_inbound THEN TIMESTAMPDIFF(SECOND,metrics.first_inbound,metrics.first_reply) END)) AS average_first_response_seconds
      FROM (SELECT c.id,MIN(CASE WHEN l.direction='inbound' THEN l.created_at END) AS first_inbound,
        MIN(CASE WHEN l.direction='outbound' AND l.sent_by='employee' THEN l.created_at END) AS first_reply,
        SUM(CASE WHEN l.direction='inbound' AND l.created_at>COALESCE(r.last_read_at,'1970-01-01') THEN 1 ELSE 0 END) AS unread
        FROM conversations c LEFT JOIN wa_message_logs l ON l.tenant_id=c.tenant_id AND l.conversation_id=c.id AND l.created_at>=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 7 DAY)
        LEFT JOIN wa_inbox_reads r ON r.tenant_id=c.tenant_id AND r.conversation_id=c.id AND r.user_id=? WHERE ${chatAccess.sql} GROUP BY c.id) metrics`, [req.user.id, ...chatAccess.params]);
    return { ...counts, ...totals, ...chat, ...metadata, response_window_days: 7 };
  }
  async function reassignInactive(req, afterId = 0) {
    if (!inbox.isAdmin(req)) throw fail(403, "Organization administrator required");
    const contacts = await q(`SELECT ct.id,ct.assigned_agent_id,ct.branch_id FROM wa_contacts ct LEFT JOIN users u ON u.id=ct.assigned_agent_id
      LEFT JOIN organization_memberships m ON m.tenant_id=ct.tenant_id AND m.user_id=ct.assigned_agent_id
      WHERE ct.tenant_id=? AND ct.id>? AND ct.assigned_agent_id IS NOT NULL AND (u.id IS NULL OR u.status<>'active' OR m.user_id IS NULL OR m.membership_status<>'active') ORDER BY ct.id LIMIT 25`, [req.tenantId, afterId]);
    const results = [];
    for (const contact of contacts) {
      const [conversation] = await q("SELECT sender_id,branch_id FROM conversations WHERE tenant_id=? AND contact_id=? ORDER BY id LIMIT 1", [req.tenantId, contact.id]);
      const [settings] = await q("SELECT strategy,required_skill,crm_strategy,crm_required_skill FROM wa_assignment_settings WHERE tenant_id=?", [req.tenantId]);
      if ((conversation ? settings?.strategy : settings?.crm_strategy) === "manual") { results.push({ contactId: contact.id, status: "manual_review", reason: "Manual routing is enabled" }); continue; }
      let employees = conversation ? (await inbox.candidates(q,req.tenantId,conversation.sender_id,conversation.branch_id)).filter(row=>Number(row.open_count)<Number(row.max_open_chats)) : await require("./crmIntake").createCrmIntake(db).candidates(q,req.tenantId,contact.branch_id);
      if (conversation && settings?.required_skill) {
        const skilled = await q("SELECT user_id FROM wa_employee_skills WHERE tenant_id=? AND skill=?", [req.tenantId, settings.required_skill]);
        employees = employees.filter(row => skilled.some(skill => Number(skill.user_id) === Number(row.user_id)));
      }
      employees.sort((a, b) => Number(a.open_count) - Number(b.open_count) || Number(a.user_id) - Number(b.user_id));
      let result;
      for (const employee of employees) {
        try { result = await transfer(req, contact.id, { userId: employee.user_id, branchId: employee.branch_id, expectedOwnerId: contact.assigned_agent_id, reason: "Inactive employee ownership recovery", enforceCapacity: true }); break; }
        catch (error) { if (![400,409].includes(error.status)) throw error; }
      }
      results.push(result ? { contactId: contact.id, status: "transferred", ...result } : { contactId: contact.id, status: "manual_review", reason: "No available employee can receive every linked number" });
    }
    return results;
  }
  return { scope, customer, list, history, mutate, activity, createRecord, updateRecord, transfer, analytics, inbox, permission, permissionsFor, requireModule, modules, reassignInactive };
}
module.exports = { createEmployeeWorkspace, positiveId, text };
