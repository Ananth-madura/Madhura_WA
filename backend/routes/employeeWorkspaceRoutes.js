"use strict";
const router = require("express").Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const { createEmployeeWorkspace, text } = require("../services/employeeWorkspace");
const workspace = createEmployeeWorkspace(require("../config/database"));
const handle = work => async (req, res) => {
  try { await work(req, res); }
  catch (error) {
    if ([403, 404].includes(error.status)) console.warn("[WorkspaceAccess] denied", { tenantId: req.tenantId, userId: req.user?.id, method: req.method, path: req.path });
    else if (!error.status) console.error("[Workspace] operation failed", error.code || "INTERNAL_ERROR", error.message);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Workspace operation failed. Try again." });
  }
};
router.use(verifyToken, requireTenantContext, (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

// Resolved grants for the signed-in member
router.get("/me/permissions", handle(async (req, res) => {
  res.json({ permissions: await workspace.permissionsFor(req), admin: workspace.inbox.isAdmin(req) });
}));

router.use("/campaigns", require("./employeeCampaignRoutes"));

// Customers listing & creation
router.get("/customers", handle(async (req, res) => res.json(await workspace.list(req, req.query))));
router.post("/customers", handle(async (req, res) => {
  await workspace.requireModule(req, "customers", true);
  if (["read_only", "campaign_only"].includes(req.waAccessLevel)) throw Object.assign(new Error("Customer editing is not permitted"), { status: 403 });
  const name = text(req.body.name, 255, true), digits = text(req.body.phone, 20, true).replace(/\D/g, "");
  const phone = digits.length === 10 ? `91${digits}` : digits;
  if (!/^\d{10,15}$/.test(phone)) throw Object.assign(new Error("Use the full phone number including country code; ten local digits use India +91"), { status: 400 });
  try {
    const result = await workspace.inbox.transaction(async q => {
      const created = await q("INSERT INTO wa_contacts (tenant_id,name,phone,source,assigned_agent_id,opt_in_status) VALUES (?,?,?,'manual',?,0)", [req.tenantId, name, phone, workspace.inbox.isAdmin(req) ? null : req.user.id]);
      if (workspace.inbox.isAdmin(req)) await require("../services/crmIntake").createCrmIntake(require("../config/database")).assign(q, { tenantId: req.tenantId, contactId: created.insertId, actorId: req.user.id });
      return created;
    });
    const [owner] = await workspace.inbox.query("SELECT assigned_agent_id FROM wa_contacts WHERE tenant_id=? AND id=?", [req.tenantId, result.insertId]);
    if (owner?.assigned_agent_id) req.app.get("io")?.to(`user:${owner.assigned_agent_id}`).emit("customer_access_changed", { tenantId: req.tenantId, contactId: result.insertId });
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw Object.assign(new Error("This customer already exists. Ask an administrator to review its assignment."), { status: 409 });
    throw error;
  }
}));

router.post("/intake/rebalance", handle(async (req, res) => res.json(await require("../services/crmIntake").createCrmIntake(require("../config/database")).retry(req))));
router.post("/reassign-inactive", handle(async (req, res) => {
  const results = await workspace.reassignInactive(req);
  for (const result of results) if (result.status === "transferred") {
    for (const row of result.conversations) {
      req.app.get("io")?.to(`user:${row.owner_user_id}`).emit("inbox_access_changed", { tenantId: req.tenantId, conversationId: row.id });
      await workspace.inbox.emit(req.app.get("io"), row, "inbox_changed", {}).catch(() => {});
    }
  }
  res.json({ results: results.map(({ conversations, ...row }) => row) });
}));

router.get("/customers/export", handle(async (req, res) => {
  await workspace.requireModule(req, "exports");
  const page = await workspace.list(req, req.query);
  const csv = value => `"${String(value ?? "").replace(/^(?:\s*[=+\-@]|[\t\r\n])/, "'$&").replace(/"/g, '""')}"`;
  res.set("Content-Disposition", 'attachment; filename="authorized-customers.csv"');
  if (page.nextCursor) res.set("X-Next-Cursor", String(page.nextCursor));
  res.type("text/csv").send(["id,name,phone,email,owner,lifecycle", ...page.customers.map(row => [row.id, row.name, row.phone, row.email, row.assigned_agent_id, row.lifecycle_stage].map(csv).join(","))].join("\r\n"));
}));

// Aggregated Analytics & Operational Overview
router.get("/analytics", handle(async (req, res) => res.json(await workspace.analytics(req, req.query))));

// My Day Personalized Work Queues
router.get("/my-day", handle(async (req, res) => res.json(await workspace.myDay(req))));

// Global Tasks CRUD
router.get("/tasks", handle(async (req, res) => res.json(await workspace.listTasks(req, req.query))));
router.post("/tasks", handle(async (req, res) => {
  const result = await workspace.createTaskGlobal(req, req.body);
  req.app.get("io")?.to(`user:${req.user.id}`).emit("workspace_task_created", { id: result.id, tenantId: req.tenantId });
  res.status(201).json(result);
}));
router.patch("/tasks/:id", handle(async (req, res) => {
  const result = await workspace.updateTaskGlobal(req, req.params.id, req.body);
  req.app.get("io")?.to(`user:${req.user.id}`).emit("workspace_task_updated", { id: req.params.id, tenantId: req.tenantId });
  res.json(result);
}));

// Global Leads CRUD
router.get("/leads", handle(async (req, res) => res.json(await workspace.listLeadsGlobal(req, req.query))));
router.patch("/leads/:id", handle(async (req, res) => {
  const result = await workspace.updateLeadGlobal(req, req.params.id, req.body);
  req.app.get("io")?.to(`user:${req.user.id}`).emit("workspace_lead_updated", { id: req.params.id, tenantId: req.tenantId });
  res.json(result);
}));

// Global Deals CRUD
router.get("/deals", handle(async (req, res) => res.json(await workspace.listDealsGlobal(req, req.query))));
router.post("/deals", handle(async (req, res) => {
  const result = await workspace.createDealGlobal(req, req.body);
  req.app.get("io")?.to(`user:${req.user.id}`).emit("workspace_deal_created", { id: result.id, tenantId: req.tenantId });
  res.status(201).json(result);
}));
router.patch("/deals/:id", handle(async (req, res) => {
  const result = await workspace.updateDealGlobal(req, req.params.id, req.body);
  req.app.get("io")?.to(`user:${req.user.id}`).emit("workspace_deal_updated", { id: req.params.id, tenantId: req.tenantId });
  res.json(result);
}));

// Conversations, Campaigns & Automations Summaries
router.get("/conversations-summary", handle(async (req, res) => res.json(await workspace.conversationsSummary(req, req.query))));
router.get("/campaigns-summary", handle(async (req, res) => res.json(await workspace.campaignsSummary(req))));
router.get("/automations-summary", handle(async (req, res) => res.json(await workspace.automationsSummary(req))));

// Universal Global Search
router.get("/search", handle(async (req, res) => res.json(await workspace.globalSearch(req, req.query.q))));

// User Workspace Preferences
router.get("/preferences", handle(async (req, res) => res.json(await workspace.getPreferences(req))));
router.put("/preferences", handle(async (req, res) => res.json(await workspace.savePreferences(req, req.body))));

// Audit Trail
router.get("/audit", handle(async (req, res) => {
  if (!workspace.inbox.isAdmin(req)) throw Object.assign(new Error("Organization administrator required"), { status: 403 });
  const before = Number(req.query.before);
  const rows = await workspace.inbox.query(`SELECT id,actor_id,action,subject_user_id,details,created_at FROM wa_workspace_audit WHERE tenant_id=? ${Number.isSafeInteger(before) && before > 0 ? "AND id<?" : ""} ORDER BY id DESC LIMIT 26`, [req.tenantId, ...(Number.isSafeInteger(before) && before > 0 ? [before] : [])]);
  res.json({ records: rows.slice(0, 25), nextCursor: rows.length > 25 ? rows[24].id : null });
}));

// Customer Detail & Submodules
router.get("/customers/:id", handle(async (req, res) => {
  const customer = await workspace.customer(req, req.params.id);
  const permissions = {};
  for (const module of workspace.modules) permissions[module] = { view: await workspace.permission(req, module), edit: !["read_only", "campaign_only"].includes(req.waAccessLevel) && await workspace.permission(req, module, true) };
  res.json({ customer, permissions, canTransfer: workspace.inbox.isAdmin(req), canEdit: permissions.customers.edit });
}));

router.patch("/customers/:id", handle(async (req, res) => {
  await workspace.requireModule(req, "customers", true);
  await workspace.mutate(req, req.params.id, async (q, row) => {
    const name = text(req.body.name, 255, true), email = text(req.body.email, 255);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Enter a valid email"), { status: 400 });
    if (!["lead", "client"].includes(req.body.lifecycle_stage)) throw Object.assign(new Error("Choose lead or client"), { status: 400 });
    await q("UPDATE wa_contacts SET name=?,email=?,lifecycle_stage=? WHERE tenant_id=? AND id=?", [name, email || null, req.body.lifecycle_stage, req.tenantId, row.id]);
    await workspace.activity(q, req, row.id, "profile", `Customer profile updated; stage: ${req.body.lifecycle_stage}`);
  });
  res.json({ success: true });
}));

router.patch("/customers/:id/consent", handle(async (req, res) => {
  await workspace.requireModule(req, "customers", true);
  if (typeof req.body.optIn !== "boolean") throw Object.assign(new Error("Choose whether marketing consent is granted"), { status: 400 });
  const proof = text(req.body.proof, 1000, req.body.optIn);
  await workspace.mutate(req, req.params.id, async (q, contact) => {
    const [current] = await q("SELECT is_unsubscribed FROM wa_contacts WHERE tenant_id=? AND id=?", [req.tenantId, contact.id]);
    if (req.body.optIn && current.is_unsubscribed && !workspace.inbox.isAdmin(req)) throw Object.assign(new Error("Restoring an opted-out customer requires administrator review"), { status: 403 });
    await q("UPDATE wa_contacts SET opt_in_status=? WHERE tenant_id=? AND id=?", [req.body.optIn ? 1 : 0, req.tenantId, contact.id]);
    if (req.body.optIn) {
      if (current.is_unsubscribed) {
        const previous = await q("SELECT * FROM wa_opt_outs WHERE tenant_id=? AND phone=?", [req.tenantId, contact.phone]);
        if (previous.length) await workspace.activity(q, req, contact.id, "consent", `Previous opt-out markers retained before verified re-consent: ${JSON.stringify(previous)}`);
        await q("DELETE FROM wa_opt_outs WHERE tenant_id=? AND phone=?", [req.tenantId, contact.phone]);
      }
      await q("UPDATE wa_contacts SET is_unsubscribed=0 WHERE tenant_id=? AND id=?", [req.tenantId, contact.id]);
      await q("INSERT INTO consents (tenant_id,contact_id,channel,purpose,source,proof_uri) VALUES (?,?,'whatsapp','marketing','manual',?)", [req.tenantId, contact.id, proof]);
    } else await q("UPDATE consents SET revoked_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND contact_id=? AND purpose='marketing' AND revoked_at IS NULL", [req.tenantId, contact.id]);
    await workspace.activity(q, req, contact.id, "consent", req.body.optIn ? `Marketing consent recorded: ${proof}` : "Marketing consent revoked");
    await q("INSERT INTO wa_workspace_audit (tenant_id,actor_id,action,details) VALUES (?,?,'customer.consent',?)", [req.tenantId, req.user.id, JSON.stringify({ contactId: contact.id, optIn: req.body.optIn, proof: req.body.optIn ? proof : null })]);
  });
  res.json({ success: true });
}));

router.get("/permissions/:userId", handle(async (req, res) => {
  if (!workspace.inbox.isAdmin(req)) throw Object.assign(new Error("Organization administrator required"), { status: 403 });
  const [member] = await workspace.inbox.query("SELECT user_id, role FROM organization_memberships WHERE tenant_id=? AND user_id=?", [req.tenantId, Number(req.params.userId)]);
  if (!member) throw Object.assign(new Error("Employee not found"), { status: 404 });
  if (["organization_owner", "organization_admin"].includes(member.role)) throw Object.assign(new Error("Administrator accounts already have full workspace access"), { status: 400 });
  const permissions = await workspace.inbox.query("SELECT module,can_view,can_edit FROM wa_employee_workspace_permissions WHERE tenant_id=? AND user_id=?", [req.tenantId, Number(req.params.userId)]);
  res.json({ modules: workspace.modules, permissions });
}));

router.put("/permissions/:userId", handle(async (req, res) => {
  if (!workspace.inbox.isAdmin(req)) throw Object.assign(new Error("Organization administrator required"), { status: 403 });
  const grants = req.body.permissions;
  if (!Array.isArray(grants) || grants.length !== workspace.modules.length || new Set(grants.map(grant => grant.module)).size !== workspace.modules.length || grants.some(grant => !workspace.modules.includes(grant.module) || typeof grant.can_view !== "boolean" || typeof grant.can_edit !== "boolean")) throw Object.assign(new Error("Provide one valid view/edit grant for every module"), { status: 400 });
  await workspace.inbox.transaction(async q => {
    const [member] = await q("SELECT user_id, role FROM organization_memberships WHERE tenant_id=? AND user_id=? AND role IN ('agent','employee','branch_manager') FOR UPDATE", [req.tenantId, Number(req.params.userId)]);
    if (!member) {
      const [admin] = await q("SELECT user_id FROM organization_memberships WHERE tenant_id=? AND user_id=?", [req.tenantId, Number(req.params.userId)]);
      if (admin) throw Object.assign(new Error("Administrator accounts already have full workspace access"), { status: 400 });
      throw Object.assign(new Error("Employee not found"), { status: 404 });
    }
    for (const grant of grants) {
      if (workspace.inbox.db?.isSqlite) {
        await q("INSERT INTO wa_employee_workspace_permissions (tenant_id,user_id,module,can_view,can_edit) VALUES (?,?,?,?,?) ON CONFLICT(tenant_id,user_id,module) DO UPDATE SET can_view=excluded.can_view,can_edit=excluded.can_edit", [req.tenantId, member.user_id, grant.module, grant.can_view ? 1 : 0, grant.can_view && grant.can_edit ? 1 : 0]);
      } else {
        await q("INSERT INTO wa_employee_workspace_permissions (tenant_id,user_id,module,can_view,can_edit) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE can_view=VALUES(can_view),can_edit=VALUES(can_edit)", [req.tenantId, member.user_id, grant.module, grant.can_view ? 1 : 0, grant.can_view && grant.can_edit ? 1 : 0]);
      }
    }
    await q("INSERT INTO wa_workspace_audit (tenant_id,actor_id,action,subject_user_id,details) VALUES (?,?,'permissions.updated',?,?)", [req.tenantId, req.user.id, member.user_id, JSON.stringify(grants)]);
  });
  req.app.get("io")?.to(`user:${Number(req.params.userId)}`).emit("customer_access_changed", { tenantId: req.tenantId });
  res.json({ success: true });
}));

router.post("/customers/:id/transfer", handle(async (req, res) => {
  const result = await workspace.transfer(req, req.params.id, req.body);
  const io = req.app.get("io");
  const owners = new Set([result.previousOwnerId, ...result.conversations.map(row => row.owner_user_id)]);
  for (const row of result.conversations) {
    for (const owner of owners) if (owner) io?.to(`user:${owner}`).emit("inbox_access_changed", { tenantId: req.tenantId, conversationId: row.id });
    await workspace.inbox.emit(io, row, "inbox_changed", {}).catch(() => {});
  }
  for (const owner of [...owners, result.ownerId, req.user.id]) if (owner) io?.to(`user:${owner}`).emit("customer_access_changed", { tenantId: req.tenantId, contactId: Number(req.params.id) });
  res.json({ success: true, transferId: result.transferId, ownerId: result.ownerId });
}));

for (const kind of ["tasks", "deals", "leads", "activities", "transfers"]) {
  router.get(`/customers/:id/${kind}`, handle(async (req, res) => res.json(await workspace.history(req, req.params.id, kind, req.query.before))));
  if (kind === "transfers") continue;
  router.post(`/customers/:id/${kind}`, handle(async (req, res) => res.status(201).json(await workspace.createRecord(req, req.params.id, kind, req.body))));
  if (kind !== "activities") router.patch(`/customers/:id/${kind}/:recordId`, handle(async (req, res) => res.json(await workspace.updateRecord(req, req.params.id, kind, req.params.recordId, req.body))));
}

module.exports = router;
