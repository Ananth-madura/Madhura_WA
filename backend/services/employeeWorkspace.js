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
const sqlDate = value => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
};

function createEmployeeWorkspace(db) {
  const inbox = createInboxService(db);
  const q = inbox.query;
  const isSqlite = Boolean(db.isSqlite);

  async function columns(query, table) {
    if (isSqlite) {
      const rows = await query(`PRAGMA table_info(${table})`);
      return new Set(rows.map(row => row.name));
    }
    return new Set((await query("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?", [table])).map(row => row.name));
  }
  const modules = MODULES;
  async function permission(req, module, edit = false, reader = q) {
    if (!modules.includes(module)) throw fail(400, "Unknown workspace module");
    if (inbox.isAdmin(req)) return true;
    const [grant] = await reader("SELECT can_view,can_edit FROM wa_employee_workspace_permissions WHERE tenant_id=? AND user_id=? AND module=?", [req.tenantId, req.user.id, module]);
    if (grant) return Boolean(grant.can_view && (!edit || grant.can_edit));
    return edit ? DEFAULT_EDIT.has(module) : true;
  }

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

  async function requireModule(req, module, edit = false, reader = q) {
    if (!await permission(req, module, edit, reader)) throw fail(403, "This module action is not permitted");
  }

  async function scope(req, alias = "ct", options = {}, reader = q) {
    const requestedScope = options.scope || req.query?.scope;
    const requestedBranch = options.branchId || req.query?.branchId;
    const principal = inbox.principalScope(req, alias);
    const base = `${alias}.tenant_id=? AND ${principal.sql}`, baseParams = [req.tenantId, ...principal.params];

    if (inbox.isAdmin(req)) {
      if (requestedScope === "mine") {
        return { sql: `${base} AND ${alias}.assigned_agent_id=?`, params: [...baseParams, req.user.id] };
      }
      if (requestedBranch) {
        return { sql: `${base} AND ${alias}.branch_id=?`, params: [...baseParams, positiveId(requestedBranch)] };
      }
      return { sql: base, params: baseParams };
    }

    if (req.waAccessLevel === "campaign_only" && !options.campaign) return { sql: "1=0", params: [] };

    if (requestedScope === "mine") {
      return { sql: `${base} AND ${alias}.assigned_agent_id=?`, params: [...baseParams, req.user.id] };
    }

    if (req.userRole === "branch_manager") {
      const access = await inbox.scope(req, "c", reader);
      let branchFilter = "";
      let branchParams = [];
      if (requestedBranch) {
        branchFilter = ` AND ${alias}.branch_id=?`;
        branchParams = [positiveId(requestedBranch)];
      }
      return {
        sql: `${base}${branchFilter} AND (EXISTS (SELECT 1 FROM conversations c WHERE c.contact_id=${alias}.id AND ${access.sql}) OR (NOT EXISTS (SELECT 1 FROM conversations c WHERE c.tenant_id=${alias}.tenant_id AND c.contact_id=${alias}.id) AND EXISTS (SELECT 1 FROM staff_branch_memberships m WHERE m.tenant_id=${alias}.tenant_id AND m.user_id=? AND m.branch_id=${alias}.branch_id))) AND NOT EXISTS
        (SELECT 1 FROM conversations x WHERE x.tenant_id=${alias}.tenant_id AND x.contact_id=${alias}.id AND (x.branch_id IS NULL OR NOT EXISTS
        (SELECT 1 FROM staff_branch_memberships m WHERE m.tenant_id=x.tenant_id AND m.user_id=? AND m.branch_id=x.branch_id)))`,
        params: [...baseParams, ...branchParams, ...access.params, req.user.id, req.user.id]
      };
    }

    return {
      sql: `${base} AND ${alias}.assigned_agent_id=? AND NOT EXISTS
      (SELECT 1 FROM conversations x WHERE x.tenant_id=${alias}.tenant_id AND x.contact_id=${alias}.id AND
       (x.owner_user_id IS NULL OR x.owner_user_id<>? OR NOT EXISTS (SELECT 1 FROM staff_branch_memberships m WHERE m.tenant_id=x.tenant_id AND m.user_id=? AND m.branch_id=x.branch_id)
       OR NOT EXISTS (SELECT 1 FROM sender_branch_assignments s WHERE s.tenant_id=x.tenant_id AND s.sender_id=x.sender_id AND s.branch_id=x.branch_id)
       OR (EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=x.tenant_id AND a.user_id=?) AND NOT EXISTS
       (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=x.tenant_id AND a.user_id=? AND a.sender_id=x.sender_id))))`,
      params: [...baseParams, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
    };
  }

  async function customer(req, id, query = q, lock = false, options = {}) {
    await requireModule(req, "customers", false, query);
    const access = await scope(req, "ct", options, query);
    const [row] = await query(`SELECT ct.id,ct.tenant_id,ct.name,ct.phone,ct.email,ct.assigned_agent_id,ct.lifecycle_stage,ct.branch_id,ct.opt_in_status
      FROM wa_contacts ct WHERE ct.id=? AND ${access.sql}${lock && !isSqlite ? " FOR UPDATE" : ""}`, [positiveId(id), ...access.params]);
    if (!row) throw fail(404, "Customer not found");
    return row;
  }

  async function list(req, filters = {}) {
    await requireModule(req, "customers");
    const access = await scope(req, "ct", filters);
    const clauses = [access.sql], params = [...access.params];
    if (filters.before) { clauses.push("ct.id<?"); params.push(positiveId(filters.before)); }
    if (filters.search) { clauses.push("(ct.name LIKE ? OR ct.phone LIKE ? OR ct.email LIKE ?)"); const search = `%${text(filters.search, 100)}%`; params.push(search, search, search); }
    if (filters.lifecycle) { clauses.push("ct.lifecycle_stage = ?"); params.push(text(filters.lifecycle, 30)); }
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 25));
    const rows = await q(`SELECT ct.id,ct.name,ct.phone,ct.email,ct.assigned_agent_id,ct.lifecycle_stage,ct.branch_id,ct.opt_in_status FROM wa_contacts ct WHERE ${clauses.join(" AND ")} ORDER BY ct.id DESC LIMIT ?`, [...params, limit + 1]);
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
        const due = data.due_at ? sqlDate(data.due_at) : null;
        if (data.due_at && !due) throw fail(400, "Enter a valid follow-up date");
        const priority = ["urgent", "high", "normal", "low"].includes(data.priority) ? data.priority : "normal";
        const description = data.description ? text(data.description, 5000) : null;
        result = await query("INSERT INTO wa_customer_tasks (tenant_id,contact_id,title,due_at,priority,description,created_by) VALUES (?,?,?,?,?,?,?)",
          [req.tenantId, contact.id, text(data.title, 255, true), due, priority, description, req.user.id]);
      } else if (kind === "deals") {
        const amount = Number(data.amount || 0);
        if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999.99) throw fail(400, "Enter a valid deal amount");
        const stage = ["new", "qualified", "proposal", "negotiation", "won", "lost"].includes(data.stage) ? data.stage : "new";
        const notes = data.notes ? text(data.notes, 5000) : null;
        result = await query("INSERT INTO wa_customer_deals (tenant_id,contact_id,title,amount,stage,notes,created_by) VALUES (?,?,?,?,?,?,?)",
          [req.tenantId, contact.id, text(data.title, 255, true), amount, stage, notes, req.user.id]);
      } else if (kind === "leads") {
        result = await query("INSERT INTO wa_enquiries (tenant_id,contact_id,name,phone,email,message,created_by) VALUES (?,?,?,?,?,?,?)",
          [req.tenantId, contact.id, contact.name, contact.phone, contact.email, text(data.message, 10000, true), req.user.id]);
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
      if (!isSqlite) {
        await query("INSERT INTO wa_routing_cursors (tenant_id,last_user_id) VALUES (?,0) ON DUPLICATE KEY UPDATE tenant_id=VALUES(tenant_id)", [req.tenantId]);
        await query("SELECT tenant_id FROM wa_routing_cursors WHERE tenant_id=? FOR UPDATE", [req.tenantId]);
      }
      const contact = await customer(req, id, query, true);
      if (Number(contact.assigned_agent_id || 0) !== Number(data.expectedOwnerId || 0)) throw fail(409, "Ownership changed. Refresh before transferring");
      const [employee] = await query(`SELECT u.id,u.whatsapp_access_level FROM users u JOIN organization_memberships o ON o.user_id=u.id AND o.tenant_id=? AND o.membership_status='active'
        JOIN staff_branch_memberships m ON m.user_id=u.id AND m.tenant_id=o.tenant_id AND m.branch_id=?
        JOIN branches b ON b.id=m.branch_id AND b.tenant_id=m.tenant_id AND b.status='active'
        WHERE u.id=? AND u.status='active' AND o.role IN ('agent','employee') AND COALESCE(u.whatsapp_access_level,'full') IN ('full','chat_only','read_only','campaign_only')`, [req.tenantId, branchId, userId]);
      if (!employee) throw fail(400, "Select an active employee in this organization and branch");
      const conversations = await query(`SELECT * FROM conversations WHERE tenant_id=? AND contact_id=? ORDER BY id ${isSqlite ? "" : "FOR UPDATE"}`, [req.tenantId, contact.id]);
      if (conversations.length && employee.whatsapp_access_level === "campaign_only") throw fail(400, "A campaigns-only employee cannot receive active conversation ownership");
      if (data.enforceCapacity) {
        const pool = conversations.length ? await inbox.candidates(query, req.tenantId, conversations[0].sender_id, branchId) : await require("./crmIntake").createCrmIntake(db).candidates(query, req.tenantId, branchId);
        const eligible = pool.find(row => Number(row.user_id) === userId);
        const added = conversations.filter(row => row.status !== "closed" && Number(row.owner_user_id) !== userId).length;
        if (!eligible || (conversations.length ? Number(eligible.open_count) + added > Number(eligible.max_open_chats) : Number(eligible.open_count) + 1 > Number(eligible.max_open_leads))) throw fail(409, "The destination employee no longer has capacity");
      }
      for (const row of conversations) {
        const [linked] = await query(`SELECT sender_id FROM sender_branch_assignments WHERE tenant_id=? AND sender_id=? AND branch_id=?
          AND (NOT EXISTS (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=? AND a.user_id=?) OR EXISTS
          (SELECT 1 FROM staff_sender_assignments a WHERE a.tenant_id=? AND a.user_id=? AND a.sender_id=?))`, [req.tenantId, row.sender_id, branchId, req.tenantId, userId, req.tenantId, userId, row.sender_id]);
        if (!linked) throw fail(400, "Destination employee must have access to every customer WhatsApp number");
      }
      await query("UPDATE wa_contacts SET assigned_agent_id=?,branch_id=? WHERE tenant_id=? AND id=?", [userId, branchId, req.tenantId, contact.id]);
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

  async function analytics(req, options = {}) {
    await requireModule(req, "customers");
    const access = await scope(req, "ct", options);
    const [counts] = await q(`SELECT COUNT(*) AS customers,SUM(CASE WHEN ct.lifecycle_stage='client' THEN 1 ELSE 0 END) AS clients FROM wa_contacts ct WHERE ${access.sql}`, access.params);

    const totals = {};
    for (const [key, table, condition] of [
      ["open_tasks", "wa_customer_tasks", "r.status='open'"],
      ["overdue_tasks", "wa_customer_tasks", `r.status='open' AND r.due_at<CURRENT_TIMESTAMP`],
      ["today_tasks", "wa_customer_tasks", `r.status='open' AND DATE(r.due_at)=${isSqlite ? "DATE('now')" : "CURRENT_DATE"}`],
      ["completed_tasks", "wa_customer_tasks", "r.status='completed'"],
      ["won_deals", "wa_customer_deals", "r.stage='won'"],
      ["deals", "wa_customer_deals", "1=1"],
      ["leads", "wa_enquiries", "1=1"],
      ["qualified_leads", "wa_enquiries", "r.temperature IN ('cold','warm','hot')"]
    ]) {
      const moduleKey = table === "wa_customer_tasks" ? "tasks" : table === "wa_customer_deals" ? "deals" : "leads";
      if (!await permission(req, moduleKey)) continue;
      const [row] = await q(`SELECT COUNT(*) AS count FROM ${table} r JOIN wa_contacts ct ON ct.tenant_id=r.tenant_id AND ct.id=r.contact_id WHERE ${access.sql} AND ${condition}`, access.params);
      totals[key] = row?.count || 0;
    }

    // Pipeline amounts
    let pipeline_value = 0, won_value = 0;
    if (await permission(req, "deals")) {
      const [pipe] = await q(`SELECT SUM(CASE WHEN r.stage IN ('new','qualified','proposal','negotiation') THEN r.amount ELSE 0 END) AS pipe_val,
        SUM(CASE WHEN r.stage='won' THEN r.amount ELSE 0 END) AS won_val
        FROM wa_customer_deals r JOIN wa_contacts ct ON ct.tenant_id=r.tenant_id AND ct.id=r.contact_id WHERE ${access.sql}`, access.params);
      pipeline_value = Number(pipe?.pipe_val || 0);
      won_value = Number(pipe?.won_val || 0);
    }

    // Stage breakdown for deals
    const stage_counts = { new: 0, qualified: 0, proposal: 0, negotiation: 0, won: 0, lost: 0 };
    if (await permission(req, "deals")) {
      const stageRows = await q(`SELECT r.stage, COUNT(*) AS count FROM wa_customer_deals r JOIN wa_contacts ct ON ct.tenant_id=r.tenant_id AND ct.id=r.contact_id WHERE ${access.sql} GROUP BY r.stage`, access.params);
      for (const row of stageRows) if (stage_counts[row.stage] !== undefined) stage_counts[row.stage] = row.count;
    }

    // Temperature breakdown for leads
    const temperature_counts = { new: 0, cold: 0, warm: 0, hot: 0 };
    if (await permission(req, "leads")) {
      const tempRows = await q(`SELECT r.temperature, COUNT(*) AS count FROM wa_enquiries r JOIN wa_contacts ct ON ct.tenant_id=r.tenant_id AND ct.id=r.contact_id WHERE ${access.sql} GROUP BY r.temperature`, access.params);
      for (const row of tempRows) if (temperature_counts[row.temperature] !== undefined) temperature_counts[row.temperature] = row.count;
    }

    // Chat stats
    const chatAccess = await inbox.scope(req);
    const [chat] = await q(`SELECT COUNT(*) AS conversations,SUM(CASE WHEN c.status='open' THEN 1 ELSE 0 END) AS active_conversations FROM conversations c WHERE ${chatAccess.sql}`, chatAccess.params);

    const sevenDaysAgo = isSqlite ? "datetime('now', '-7 days')" : "DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 7 DAY)";
    const [metadata] = await q(`SELECT COALESCE(SUM(metrics.unread),0) AS unread_messages,COUNT(CASE WHEN metrics.first_reply>=metrics.first_inbound THEN 1 END) AS first_response_samples,
      ROUND(AVG(CASE WHEN metrics.first_reply>=metrics.first_inbound THEN ${isSqlite ? "(strftime('%s',metrics.first_reply) - strftime('%s',metrics.first_inbound))" : "TIMESTAMPDIFF(SECOND,metrics.first_inbound,metrics.first_reply)"} END)) AS average_first_response_seconds
      FROM (SELECT c.id,MIN(CASE WHEN l.direction='inbound' THEN l.created_at END) AS first_inbound,
        MIN(CASE WHEN l.direction='outbound' AND l.sent_by='employee' THEN l.created_at END) AS first_reply,
        SUM(CASE WHEN l.direction='inbound' AND l.created_at>COALESCE(r.last_read_at,'1970-01-01') THEN 1 ELSE 0 END) AS unread
        FROM conversations c LEFT JOIN wa_message_logs l ON l.tenant_id=c.tenant_id AND l.conversation_id=c.id AND l.created_at>=${sevenDaysAgo}
        LEFT JOIN wa_inbox_reads r ON r.tenant_id=c.tenant_id AND r.conversation_id=c.id AND r.user_id=? WHERE ${chatAccess.sql} GROUP BY c.id) metrics`, [req.user.id, ...chatAccess.params]);

    // Campaigns & automations stats
    let campaigns = { campaigns_total: 0, campaigns_active: 0, campaigns_completed: 0, campaigns_failed: 0 };
    if (await permission(req, "campaigns")) {
      const [campRow] = await q(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN status IN ('sending','scheduled','in_progress','active') THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status IN ('failed','error') THEN 1 ELSE 0 END) AS failed
        FROM wa_campaigns WHERE tenant_id=?`, [req.tenantId]);
      campaigns = {
        campaigns_total: campRow?.total || 0,
        campaigns_active: campRow?.active || 0,
        campaigns_completed: campRow?.completed || 0,
        campaigns_failed: campRow?.failed || 0
      };
    }

    let automations = { automations_total: 0, automations_active: 0 };
    if (await permission(req, "automations")) {
      const autoCols = await columns(q, "wa_automations");
      if (autoCols.has("is_active")) {
        const [autoRow] = await q(`SELECT COUNT(*) AS total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) AS active FROM wa_automations WHERE tenant_id=?`, [req.tenantId]);
        automations = {
          automations_total: autoRow?.total || 0,
          automations_active: autoRow?.active || 0
        };
      } else if (autoCols.has("status")) {
        const [autoRow] = await q(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM wa_automations WHERE tenant_id=?`, [req.tenantId]);
        automations = {
          automations_total: autoRow?.total || 0,
          automations_active: autoRow?.active || 0
        };
      }
    }

    // Dynamic actionable alerts based on real operational health
    const alerts = [];
    if (totals.overdue_tasks > 0) {
      alerts.push({
        id: "alert_overdue_tasks",
        severity: "warning",
        title: `${totals.overdue_tasks} overdue ${totals.overdue_tasks === 1 ? "task" : "tasks"} require action`,
        message: "Customer follow-ups have passed their scheduled SLA deadline.",
        actionView: "tasks",
        actionFilter: "overdue"
      });
    }
    if (temperature_counts.hot > 0) {
      alerts.push({
        id: "alert_hot_leads",
        severity: "info",
        title: `${temperature_counts.hot} hot ${temperature_counts.hot === 1 ? "lead" : "leads"} awaiting immediate callback`,
        message: "High intent prospective clients ready for quotation or qualification.",
        actionView: "leads",
        actionFilter: "hot"
      });
    }
    if ((metadata?.unread_messages || 0) > 0) {
      alerts.push({
        id: "alert_unread_messages",
        severity: "info",
        title: `${metadata.unread_messages} unread customer ${metadata.unread_messages === 1 ? "message" : "messages"}`,
        message: "Incoming WhatsApp communications waiting for reply.",
        actionView: "conversations",
        actionFilter: "unread"
      });
    }
    if (campaigns.campaigns_failed > 0) {
      alerts.push({
        id: "alert_campaigns_failed",
        severity: "danger",
        title: `${campaigns.campaigns_failed} broadcast ${campaigns.campaigns_failed === 1 ? "campaign" : "campaigns"} encountered errors`,
        message: "Verify Meta WhatsApp template status, sender quota, or audience numbers.",
        actionView: "campaigns",
        actionFilter: "failed"
      });
    }

    // Recent activities feed across authorized scope
    const recentActivities = await q(`SELECT a.id, a.kind, a.body, a.actor_id, a.created_at, ct.id AS contact_id, ct.name AS contact_name
      FROM wa_customer_activities a
      JOIN wa_contacts ct ON ct.id=a.contact_id AND ct.tenant_id=a.tenant_id
      WHERE ${access.sql} ORDER BY a.id DESC LIMIT 15`, access.params);

    // Team workload (only for admins & branch managers)
    let workload = [];
    if (inbox.isAdmin(req) || req.userRole === "branch_manager") {
      workload = await q(`SELECT u.id AS user_id, u.first_name, u.email,
        COUNT(DISTINCT ct.id) AS assigned_customers,
        COUNT(DISTINCT CASE WHEN t.status='open' THEN t.id END) AS open_tasks,
        COUNT(DISTINCT CASE WHEN d.stage IN ('new','qualified','proposal','negotiation') THEN d.id END) AS active_deals
        FROM users u
        JOIN organization_memberships m ON m.user_id=u.id AND m.tenant_id=? AND m.membership_status='active'
        LEFT JOIN wa_contacts ct ON ct.assigned_agent_id=u.id AND ct.tenant_id=m.tenant_id
        LEFT JOIN wa_customer_tasks t ON t.contact_id=ct.id AND t.tenant_id=ct.tenant_id
        LEFT JOIN wa_customer_deals d ON d.contact_id=ct.id AND d.tenant_id=ct.tenant_id
        WHERE u.status='active' AND m.role IN ('agent','employee','branch_manager')
        GROUP BY u.id, u.first_name, u.email ORDER BY open_tasks DESC, assigned_customers DESC LIMIT 10`, [req.tenantId]);
    }

    return {
      ...counts,
      ...totals,
      ...chat,
      ...metadata,
      pipeline_value,
      won_value,
      stage_counts,
      temperature_counts,
      ...campaigns,
      ...automations,
      alerts,
      recent_activities: recentActivities,
      workload,
      response_window_days: 7
    };
  }

  // My Day personalized action center
  async function myDay(req) {
    const access = await scope(req, "ct", { scope: "mine" });
    const overdueTasks = await q(`SELECT t.id, t.title, t.due_at, t.priority, t.status, t.description, t.created_at,
      ct.id AS contact_id, ct.name AS contact_name, ct.phone AS contact_phone
      FROM wa_customer_tasks t
      JOIN wa_contacts ct ON ct.id=t.contact_id AND ct.tenant_id=t.tenant_id
      WHERE ${access.sql} AND t.status='open' AND t.due_at < CURRENT_TIMESTAMP
      ORDER BY t.due_at ASC LIMIT 25`, access.params);

    const todayDate = isSqlite ? "DATE('now')" : "CURRENT_DATE";
    const todayTasks = await q(`SELECT t.id, t.title, t.due_at, t.priority, t.status, t.description, t.created_at,
      ct.id AS contact_id, ct.name AS contact_name, ct.phone AS contact_phone
      FROM wa_customer_tasks t
      JOIN wa_contacts ct ON ct.id=t.contact_id AND ct.tenant_id=t.tenant_id
      WHERE ${access.sql} AND t.status='open' AND DATE(t.due_at) = ${todayDate}
      ORDER BY t.due_at ASC LIMIT 25`, access.params);

    const urgentLeads = await q(`SELECT e.id, e.name, e.phone, e.message, e.temperature, e.created_at,
      ct.id AS contact_id, ct.name AS contact_name, ct.phone AS contact_phone
      FROM wa_enquiries e
      JOIN wa_contacts ct ON ct.id=e.contact_id AND ct.tenant_id=e.tenant_id
      WHERE ${access.sql} AND e.temperature IN ('hot','warm')
      ORDER BY e.id DESC LIMIT 20`, access.params);

    const chatAccess = await inbox.scope(req);
    const waitingConversations = await q(`SELECT c.id, c.sender_id, c.contact_id, c.status, c.updated_at,
      ct.name AS contact_name, ct.phone AS contact_phone
      FROM conversations c
      JOIN wa_contacts ct ON ct.id=c.contact_id AND ct.tenant_id=c.tenant_id
      WHERE ${chatAccess.sql} AND c.status='open'
      ORDER BY c.updated_at DESC LIMIT 15`, chatAccess.params);

    const completedToday = await q(`SELECT t.id, t.title, t.due_at, t.completed_at,
      ct.id AS contact_id, ct.name AS contact_name, ct.phone AS contact_phone
      FROM wa_customer_tasks t
      JOIN wa_contacts ct ON ct.id=t.contact_id AND ct.tenant_id=t.tenant_id
      WHERE ${access.sql} AND t.status='completed' AND DATE(t.completed_at) = ${todayDate}
      ORDER BY t.completed_at DESC LIMIT 20`, access.params);

    return {
      overdueTasks,
      todayTasks,
      urgentLeads,
      waitingConversations,
      completedToday
    };
  }

  // Global Tasks API
  async function listTasks(req, filters = {}) {
    await requireModule(req, "tasks");
    const access = await scope(req, "ct", filters);
    const clauses = [access.sql], params = [...access.params];
    if (filters.status) {
      clauses.push("t.status = ?");
      params.push(text(filters.status, 20));
    }
    if (filters.priority) {
      clauses.push("t.priority = ?");
      params.push(text(filters.priority, 20));
    }
    if (filters.due === "overdue") {
      clauses.push("t.status='open' AND t.due_at < CURRENT_TIMESTAMP");
    } else if (filters.due === "today") {
      clauses.push(`t.status='open' AND DATE(t.due_at) = ${isSqlite ? "DATE('now')" : "CURRENT_DATE"}`);
    } else if (filters.due === "this_week") {
      const nextWeek = isSqlite ? "datetime('now', '+7 days')" : "DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY)";
      clauses.push(`t.status='open' AND t.due_at >= CURRENT_TIMESTAMP AND t.due_at <= ${nextWeek}`);
    }
    if (filters.search) {
      clauses.push("(t.title LIKE ? OR ct.name LIKE ? OR ct.phone LIKE ?)");
      const term = `%${text(filters.search, 100)}%`;
      params.push(term, term, term);
    }
    if (filters.before) {
      clauses.push("t.id < ?");
      params.push(positiveId(filters.before));
    }
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 30));
    const rows = await q(`SELECT t.id, t.title, t.due_at, t.priority, t.status, t.description, t.completed_at, t.created_by, t.created_at,
      ct.id AS contact_id, ct.name AS contact_name, ct.phone AS contact_phone
      FROM wa_customer_tasks t
      JOIN wa_contacts ct ON ct.id=t.contact_id AND ct.tenant_id=t.tenant_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END, t.due_at ASC, t.id DESC LIMIT ?`, [...params, limit + 1]);
    return {
      tasks: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null
    };
  }

  async function createTaskGlobal(req, data) {
    await requireModule(req, "tasks", true);
    const contactId = positiveId(data.contact_id);
    const contact = await customer(req, contactId);
    const due = data.due_at ? sqlDate(data.due_at) : null;
    if (data.due_at && !due) throw fail(400, "Enter a valid follow-up date");
    const priority = ["urgent", "high", "normal", "low"].includes(data.priority) ? data.priority : "normal";
    const description = data.description ? text(data.description, 5000) : null;
    const taskTitle = text(data.title, 255, true);

    const result = await q("INSERT INTO wa_customer_tasks (tenant_id,contact_id,title,due_at,priority,description,created_by) VALUES (?,?,?,?,?,?,?)",
      [req.tenantId, contact.id, taskTitle, due, priority, description, req.user.id]);
    await activity(q, req, contact.id, "created", `Task #${result.insertId} created: ${taskTitle}`);
    return { id: result.insertId };
  }

  async function updateTaskGlobal(req, taskId, data) {
    await requireModule(req, "tasks", true);
    const id = positiveId(taskId);
    const [existing] = await q("SELECT t.*, ct.assigned_agent_id FROM wa_customer_tasks t JOIN wa_contacts ct ON ct.id=t.contact_id AND ct.tenant_id=t.tenant_id WHERE t.id=? AND t.tenant_id=?", [id, req.tenantId]);
    if (!existing) throw fail(404, "Task not found");
    await customer(req, existing.contact_id);

    const updates = [], params = [];
    if (data.status) {
      if (!["open", "completed", "cancelled"].includes(data.status)) throw fail(400, "Invalid status");
      updates.push("status=?");
      params.push(data.status);
      if (data.status === "completed") {
        updates.push("completed_by=?", "completed_at=CURRENT_TIMESTAMP");
        params.push(req.user.id);
      } else {
        updates.push("completed_by=NULL", "completed_at=NULL");
      }
    }
    if (data.due_at !== undefined) {
      const due = data.due_at ? sqlDate(data.due_at) : null;
      if (data.due_at && !due) throw fail(400, "Enter a valid follow-up date");
      updates.push("due_at=?");
      params.push(due);
    }
    if (data.priority) {
      if (!["urgent", "high", "normal", "low"].includes(data.priority)) throw fail(400, "Invalid priority");
      updates.push("priority=?");
      params.push(data.priority);
    }
    if (data.title) {
      updates.push("title=?");
      params.push(text(data.title, 255, true));
    }
    if (data.description !== undefined) {
      updates.push("description=?");
      params.push(data.description ? text(data.description, 5000) : null);
    }
    updates.push("updated_at=CURRENT_TIMESTAMP");
    if (!updates.length) return { success: true };

    await q(`UPDATE wa_customer_tasks SET ${updates.join(",")} WHERE id=? AND tenant_id=?`, [...params, id, req.tenantId]);
    await activity(q, req, existing.contact_id, "updated", `Task #${id} updated`);
    return { success: true };
  }

  // Global Leads API
  async function listLeadsGlobal(req, filters = {}) {
    await requireModule(req, "leads");
    const access = await scope(req, "ct", filters);
    const clauses = [access.sql], params = [...access.params];
    if (filters.temperature) {
      clauses.push("e.temperature = ?");
      params.push(text(filters.temperature, 20));
    }
    if (filters.search) {
      clauses.push("(e.name LIKE ? OR e.phone LIKE ? OR e.message LIKE ? OR ct.name LIKE ?)");
      const term = `%${text(filters.search, 100)}%`;
      params.push(term, term, term, term);
    }
    if (filters.before) {
      clauses.push("e.id < ?");
      params.push(positiveId(filters.before));
    }
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 30));
    const rows = await q(`SELECT e.id, e.name, e.phone, e.email, e.message, e.temperature, e.created_at, e.updated_at,
      ct.id AS contact_id, ct.name AS contact_name, ct.assigned_agent_id
      FROM wa_enquiries e
      JOIN wa_contacts ct ON ct.id=e.contact_id AND ct.tenant_id=e.tenant_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY e.id DESC LIMIT ?`, [...params, limit + 1]);
    return {
      leads: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null
    };
  }

  async function updateLeadGlobal(req, leadId, data) {
    await requireModule(req, "leads", true);
    const id = positiveId(leadId);
    const [existing] = await q("SELECT e.* FROM wa_enquiries e JOIN wa_contacts ct ON ct.id=e.contact_id AND ct.tenant_id=e.tenant_id WHERE e.id=? AND e.tenant_id=?", [id, req.tenantId]);
    if (!existing) throw fail(404, "Lead not found");
    await customer(req, existing.contact_id);

    const updates = [], params = [];
    if (data.temperature) {
      if (!["new", "cold", "warm", "hot"].includes(data.temperature)) throw fail(400, "Select a valid temperature");
      updates.push("temperature=?");
      params.push(data.temperature);
    }
    if (data.message) {
      updates.push("message=?");
      params.push(text(data.message, 10000, true));
    }
    updates.push("updated_at=CURRENT_TIMESTAMP");
    await q(`UPDATE wa_enquiries SET ${updates.join(",")} WHERE id=? AND tenant_id=?`, [...params, id, req.tenantId]);
    await activity(q, req, existing.contact_id, "updated", `Lead #${id} temperature set to ${data.temperature || existing.temperature}`);
    return { success: true };
  }

  // Global Deals API
  async function listDealsGlobal(req, filters = {}) {
    await requireModule(req, "deals");
    const access = await scope(req, "ct", filters);
    const clauses = [access.sql], params = [...access.params];
    if (filters.stage) {
      clauses.push("d.stage = ?");
      params.push(text(filters.stage, 30));
    }
    if (filters.search) {
      clauses.push("(d.title LIKE ? OR ct.name LIKE ? OR ct.phone LIKE ?)");
      const term = `%${text(filters.search, 100)}%`;
      params.push(term, term, term);
    }
    if (filters.before) {
      clauses.push("d.id < ?");
      params.push(positiveId(filters.before));
    }
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 30));
    const rows = await q(`SELECT d.id, d.title, d.stage, d.amount, d.notes, d.expected_close_date, d.created_at, d.updated_at,
      ct.id AS contact_id, ct.name AS contact_name, ct.phone AS contact_phone, ct.assigned_agent_id
      FROM wa_customer_deals d
      JOIN wa_contacts ct ON ct.id=d.contact_id AND ct.tenant_id=d.tenant_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY d.id DESC LIMIT ?`, [...params, limit + 1]);

    const [totals] = await q(`SELECT
      SUM(CASE WHEN d.stage IN ('new','qualified','proposal','negotiation') THEN d.amount ELSE 0 END) AS total_pipeline_value,
      SUM(CASE WHEN d.stage='won' THEN d.amount ELSE 0 END) AS total_won_value
      FROM wa_customer_deals d
      JOIN wa_contacts ct ON ct.id=d.contact_id AND ct.tenant_id=d.tenant_id
      WHERE ${clauses.join(" AND ")}`, params.slice(0, -1));

    return {
      deals: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
      totalPipelineValue: Number(totals?.total_pipeline_value || 0),
      totalWonValue: Number(totals?.total_won_value || 0)
    };
  }

  async function createDealGlobal(req, data) {
    await requireModule(req, "deals", true);
    const contactId = positiveId(data.contact_id);
    const contact = await customer(req, contactId);
    const amount = Number(data.amount || 0);
    if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999.99) throw fail(400, "Enter a valid deal amount");
    const stage = ["new", "qualified", "proposal", "negotiation", "won", "lost"].includes(data.stage) ? data.stage : "new";
    const title = text(data.title, 255, true);
    const notes = data.notes ? text(data.notes, 5000) : null;
    const expectedClose = data.expected_close_date ? sqlDate(data.expected_close_date) : null;

    const result = await q("INSERT INTO wa_customer_deals (tenant_id,contact_id,title,amount,stage,notes,expected_close_date,created_by) VALUES (?,?,?,?,?,?,?,?)",
      [req.tenantId, contact.id, title, amount, stage, notes, expectedClose, req.user.id]);
    await activity(q, req, contact.id, "created", `Deal #${result.insertId} created: ${title} (${stage})`);
    return { id: result.insertId };
  }

  async function updateDealGlobal(req, dealId, data) {
    await requireModule(req, "deals", true);
    const id = positiveId(dealId);
    const [existing] = await q("SELECT d.* FROM wa_customer_deals d JOIN wa_contacts ct ON ct.id=d.contact_id AND ct.tenant_id=d.tenant_id WHERE d.id=? AND d.tenant_id=?", [id, req.tenantId]);
    if (!existing) throw fail(404, "Deal not found");
    await customer(req, existing.contact_id);

    const updates = [], params = [];
    if (data.stage) {
      if (!["new", "qualified", "proposal", "negotiation", "won", "lost"].includes(data.stage)) throw fail(400, "Select a valid deal stage");
      updates.push("stage=?");
      params.push(data.stage);
    }
    if (data.amount !== undefined) {
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount < 0) throw fail(400, "Enter a valid deal amount");
      updates.push("amount=?");
      params.push(amount);
    }
    if (data.title) {
      updates.push("title=?");
      params.push(text(data.title, 255, true));
    }
    if (data.notes !== undefined) {
      updates.push("notes=?");
      params.push(data.notes ? text(data.notes, 5000) : null);
    }
    if (data.expected_close_date !== undefined) {
      const expDate = data.expected_close_date ? sqlDate(data.expected_close_date) : null;
      updates.push("expected_close_date=?");
      params.push(expDate);
    }
    updates.push("updated_at=CURRENT_TIMESTAMP");
    await q(`UPDATE wa_customer_deals SET ${updates.join(",")} WHERE id=? AND tenant_id=?`, [...params, id, req.tenantId]);
    await activity(q, req, existing.contact_id, "updated", `Deal #${id} stage set to ${data.stage || existing.stage}`);
    return { success: true };
  }

  // Conversations Summary
  async function conversationsSummary(req, filters = {}) {
    const chatAccess = await inbox.scope(req);
    const clauses = [chatAccess.sql], params = [...chatAccess.params];
    if (filters.status) {
      clauses.push("c.status = ?");
      params.push(text(filters.status, 20));
    }
    const rows = await q(`SELECT c.id, c.sender_id, c.contact_id, c.branch_id, c.owner_user_id, c.status, c.last_message_at, c.updated_at,
      ct.name AS contact_name, ct.phone AS contact_phone,
      (SELECT body FROM wa_message_logs l WHERE l.conversation_id=c.id ORDER BY l.id DESC LIMIT 1) AS last_message_body,
      (SELECT direction FROM wa_message_logs l WHERE l.conversation_id=c.id ORDER BY l.id DESC LIMIT 1) AS last_message_direction,
      COALESCE((SELECT COUNT(*) FROM wa_message_logs l LEFT JOIN wa_inbox_reads r ON r.conversation_id=c.id AND r.user_id=?
        WHERE l.conversation_id=c.id AND l.direction='inbound' AND l.created_at>COALESCE(r.last_read_at,'1970-01-01')),0) AS unread_count
      FROM conversations c
      JOIN wa_contacts ct ON ct.id=c.contact_id AND ct.tenant_id=c.tenant_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY c.updated_at DESC LIMIT 30`, [req.user.id, ...params]);
    return { conversations: rows };
  }

  // Campaigns Summary
  async function campaignsSummary(req) {
    if (!await permission(req, "campaigns")) throw fail(403, "Campaigns access not permitted");
    const rows = await q(`SELECT id, name, status, audience_policy, total_recipients, sent_count, failed_count, scheduled_at, created_at
      FROM wa_campaigns WHERE tenant_id=? ORDER BY id DESC LIMIT 20`, [req.tenantId]);
    return { campaigns: rows };
  }

  // Automations Summary
  async function automationsSummary(req) {
    if (!await permission(req, "automations")) throw fail(403, "Automations access not permitted");
    const autoCols = await columns(q, "wa_automations");
    const activeField = autoCols.has("is_active") ? "is_active" : autoCols.has("status") ? "status" : "1";
    const automations = await q(`SELECT id, name, trigger_event, ${activeField} AS status FROM wa_automations WHERE tenant_id=? ORDER BY id DESC LIMIT 15`, [req.tenantId]);
    const flows = await q(`SELECT id, name, status, created_at, updated_at FROM wa_flows WHERE tenant_id=? ORDER BY id DESC LIMIT 15`, [req.tenantId]);
    return { automations, flows };
  }

  // Global Cross-Module Search
  async function globalSearch(req, queryText) {
    const term = text(queryText, 100, true);
    const searchPattern = `%${term}%`;
    const access = await scope(req, "ct");

    const customers = await q(`SELECT ct.id, ct.name, ct.phone, ct.email, ct.lifecycle_stage FROM wa_contacts ct WHERE ${access.sql} AND (ct.name LIKE ? OR ct.phone LIKE ? OR ct.email LIKE ?) LIMIT 5`,
      [...access.params, searchPattern, searchPattern, searchPattern]);

    let tasks = [];
    if (await permission(req, "tasks")) {
      tasks = await q(`SELECT t.id, t.title, t.status, t.due_at, t.priority, ct.id AS contact_id, ct.name AS contact_name FROM wa_customer_tasks t JOIN wa_contacts ct ON ct.id=t.contact_id AND ct.tenant_id=t.tenant_id WHERE ${access.sql} AND (t.title LIKE ? OR ct.name LIKE ?) LIMIT 5`,
        [...access.params, searchPattern, searchPattern]);
    }

    let deals = [];
    if (await permission(req, "deals")) {
      deals = await q(`SELECT d.id, d.title, d.amount, d.stage, ct.id AS contact_id, ct.name AS contact_name FROM wa_customer_deals d JOIN wa_contacts ct ON ct.id=d.contact_id AND ct.tenant_id=d.tenant_id WHERE ${access.sql} AND (d.title LIKE ? OR ct.name LIKE ?) LIMIT 5`,
        [...access.params, searchPattern, searchPattern]);
    }

    let leads = [];
    if (await permission(req, "leads")) {
      leads = await q(`SELECT e.id, e.name, e.temperature, e.message, ct.id AS contact_id, ct.name AS contact_name FROM wa_enquiries e JOIN wa_contacts ct ON ct.id=e.contact_id AND ct.tenant_id=e.tenant_id WHERE ${access.sql} AND (e.name LIKE ? OR e.message LIKE ? OR ct.name LIKE ?) LIMIT 5`,
        [...access.params, searchPattern, searchPattern, searchPattern]);
    }

    return { customers, tasks, deals, leads };
  }

  // User Preferences
  async function getPreferences(req) {
    const [row] = await q("SELECT preferences_json FROM wa_workspace_preferences WHERE tenant_id=? AND user_id=?", [req.tenantId, req.user.id]);
    if (row?.preferences_json) {
      try { return JSON.parse(row.preferences_json); }
      catch { return {}; }
    }
    return {
      visibleWidgets: ["customers", "open_tasks", "overdue_tasks", "deals", "conversations", "unread_messages"],
      defaultView: "overview",
      density: "comfortable"
    };
  }

  async function savePreferences(req, preferences) {
    const json = JSON.stringify(preferences || {});
    if (isSqlite) {
      await q("INSERT INTO wa_workspace_preferences (tenant_id, user_id, preferences_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(tenant_id, user_id) DO UPDATE SET preferences_json=excluded.preferences_json, updated_at=CURRENT_TIMESTAMP",
        [req.tenantId, req.user.id, json]);
    } else {
      await q("INSERT INTO wa_workspace_preferences (tenant_id, user_id, preferences_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE preferences_json=VALUES(preferences_json), updated_at=CURRENT_TIMESTAMP",
        [req.tenantId, req.user.id, json]);
    }
    return { success: true };
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
      let employees = conversation ? (await inbox.candidates(q, req.tenantId, conversation.sender_id, conversation.branch_id)).filter(row => Number(row.open_count) < Number(row.max_open_chats)) : await require("./crmIntake").createCrmIntake(db).candidates(q, req.tenantId, contact.branch_id);
      if (conversation && settings?.required_skill) {
        const skilled = await q("SELECT user_id FROM wa_employee_skills WHERE tenant_id=? AND skill=?", [req.tenantId, settings.required_skill]);
        employees = employees.filter(row => skilled.some(skill => Number(skill.user_id) === Number(row.user_id)));
      }
      employees.sort((a, b) => Number(a.open_count) - Number(b.open_count) || Number(a.user_id) - Number(b.user_id));
      let result;
      for (const employee of employees) {
        try { result = await transfer(req, contact.id, { userId: employee.user_id, branchId: employee.branch_id, expectedOwnerId: contact.assigned_agent_id, reason: "Inactive employee ownership recovery", enforceCapacity: true }); break; }
        catch (error) { if (![400, 409].includes(error.status)) throw error; }
      }
      results.push(result ? { contactId: contact.id, status: "transferred", ...result } : { contactId: contact.id, status: "manual_review", reason: "No available employee can receive every linked number" });
    }
    return results;
  }

  return {
    scope,
    customer,
    list,
    history,
    mutate,
    activity,
    createRecord,
    updateRecord,
    transfer,
    analytics,
    myDay,
    listTasks,
    createTaskGlobal,
    updateTaskGlobal,
    listLeadsGlobal,
    updateLeadGlobal,
    listDealsGlobal,
    createDealGlobal,
    updateDealGlobal,
    conversationsSummary,
    campaignsSummary,
    automationsSummary,
    globalSearch,
    getPreferences,
    savePreferences,
    inbox,
    permission,
    permissionsFor,
    requireModule,
    modules,
    reassignInactive
  };
}

module.exports = { createEmployeeWorkspace, positiveId, text };
