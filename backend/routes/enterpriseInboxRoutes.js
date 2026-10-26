"use strict";
const router = require("express").Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const { createInboxService } = require("../services/sharedInboxService");
const { serverChatStorageEnabled } = require("../services/waChatPrivacy");
const inbox = createInboxService(db);
const outbound = require("../services/inboxOutbound").createInboxOutbound(db);
const multer = require("multer");
const attachmentUpload = multer({storage:multer.memoryStorage(),limits:{fileSize:require("../services/inboxOutbound").MAX_UPLOAD,files:1,fields:12,fieldSize:32768}});
const { messageSendLimiter } = require("../middleware/waRateLimiter");
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const handle = work => async (req, res) => {
  try { await work(req, res); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Inbox operation failed", code: error.code }); }
};
router.use(verifyToken, requireTenantContext);
router.use((req, res, next) => {
  if (req.method !== "GET" && !req.path.endsWith("/read") && req.waAccessLevel === "read_only") return res.status(403).json({ message: "This employee has read-only inbox access" });
  next();
});

router.get("/flows",handle(async(req,res)=>{
  const flows=await inbox.query("SELECT f.id,v.name FROM wa_flows f JOIN wa_flow_versions v ON v.flow_id=f.id AND v.status='published' WHERE f.tenant_id=? AND f.status='active' ORDER BY v.name LIMIT 100",[req.tenantId]);
  res.json({flows});
}));
router.post("/conversations/:id/flow",messageSendLimiter,handle(async(req,res)=>{
  const row=await inbox.conversation(req,req.params.id);
  const flowId=Number(req.body.flowId);if(!Number.isInteger(flowId)||flowId<1)throw fail("Select a published bot");
  await require("../services/sharedFlowRuntime").start(req.tenantId,row.id,flowId,req.user.id);
  await inbox.emit(req.app.get("io"),row,"inbox_changed",{}).catch(()=>{});
  res.json({success:true});
}));

router.get("/conversations", handle(async (req, res) => {
  const access = await inbox.scope(req);
  const params = [...access.params];
  let where = access.sql;
  if (req.query.status !== "all") { where += " AND c.status = ?"; params.push(req.query.status || "open"); }
  if (req.query.branch_id && req.query.branch_id !== "all") { where += " AND c.branch_id = ?"; params.push(Number(req.query.branch_id)); }
  if (req.query.search) { where += " AND (ct.name LIKE ? OR ct.phone LIKE ?)"; params.push(`%${String(req.query.search).slice(0,100)}%`, `%${String(req.query.search).slice(0,100)}%`); }
  const activity=req.query.sort==="activity"||String(req.query.before||"").startsWith("v1.");
  if(activity&&req.query.before){
    const cursor=require("../services/inboxCursor").decode(req.query.before);
    if(cursor.at===null){where+=" AND c.updated_at IS NULL AND c.id < ?";params.push(cursor.id);}
    else{where+=" AND (c.updated_at < ? OR (c.updated_at = ? AND c.id < ?) OR c.updated_at IS NULL)";params.push(cursor.at,cursor.at,cursor.id);}
  }else if(!activity){const before=Number(req.query.before);if(before>0){where+=" AND c.id < ?";params.push(before);}}
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const rows = await inbox.query(`SELECT c.id, c.tenant_id, c.sender_id, c.contact_id, c.branch_id, c.owner_user_id, c.status,
    c.last_message_at, c.updated_at, c.service_window_expires_at, c.automation_mode, c.automation_error, ct.name AS contact_name, ct.phone AS contact_phone, s.display_phone AS sender_phone
    FROM conversations c JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.tenant_id = c.tenant_id
    JOIN wa_senders s ON s.id = c.sender_id AND s.tenant_id = c.tenant_id WHERE ${where} ORDER BY ${activity?"c.updated_at DESC, c.id DESC":"c.id DESC"} LIMIT ?`, [...params, limit]);
  const last=rows[rows.length-1];
  res.json({ success: true, conversations: rows, nextCursor: rows.length === limit ? (activity?require("../services/inboxCursor").encode(last):last.id) : null, chatStorage: serverChatStorageEnabled() ? "server" : "device", canManage: inbox.isAdmin(req) || req.userRole === "branch_manager",canSend:!["read_only","campaign_only"].includes(req.waAccessLevel) });
}));

router.get("/conversations/:id", handle(async (req,res)=>{
  const row=await inbox.conversation(req,req.params.id);
  const fields=["id","tenant_id","sender_id","contact_id","branch_id","owner_user_id","status","last_message_at","service_window_expires_at","automation_mode","automation_error","contact_name","contact_phone"];
  res.json({success:true,conversation:Object.fromEntries(fields.map(field=>[field,row[field]]))});
}));
router.get("/conversations/:id/messages", handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  const messages = await inbox.query(`SELECT wa_message_id AS id, direction, message_type AS type, status, created_at,
    media_id AS cloudMediaId, sent_by AS sentBy, ${serverChatStorageEnabled() ? "message_text AS body" : "NULL AS body"}
    FROM wa_message_logs WHERE tenant_id = ? AND conversation_id = ? ORDER BY wa_message_logs.id DESC LIMIT 100`, [req.tenantId, row.id]);
  res.json({ success: true, messages: messages.map(item => ({ ...item, isMe: item.direction === "outbound", timestamp: Math.floor(new Date(item.created_at).getTime() / 1000), contentAvailable: item.body !== null })), chatStorage: serverChatStorageEnabled() ? "server" : "device" });
}));
router.get("/conversations/:id/templates",handle(async(req,res)=>res.json({templates:await outbound.catalog(req,req.params.id)})));
router.post("/conversations/:id/send",messageSendLimiter,attachmentUpload.single("file"),handle(async(req,res)=>{
  for(const key of ["parameters","headerParameters","buttonParameters"])if(typeof req.body[key]==="string"){
    try{req.body[key]=JSON.parse(req.body[key]);}catch(_){throw fail(`Invalid ${key}`);}
  }
  res.json(await outbound.send(req,req.params.id,req.body,req.file));
}));
router.post("/conversations/:id/read", handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  await inbox.query("INSERT INTO wa_inbox_reads (tenant_id, conversation_id, user_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_read_at = CURRENT_TIMESTAMP", [req.tenantId, row.id, req.user.id]);
  res.json({ success: true });
}));
router.get("/conversations/:id/contact", handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  const [contact] = await inbox.query("SELECT id, name, phone, email FROM wa_contacts WHERE tenant_id = ? AND id = ?", [req.tenantId, row.contact_id]);
  res.json({ success: true, contact });
}));
router.patch("/conversations/:id/contact", handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  if (!name || name.length > 255 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || email.length > 255) throw fail("Valid customer name and email required");
  await inbox.query("UPDATE wa_contacts SET name = ?, email = ? WHERE tenant_id = ? AND id = ?", [name, email || null, req.tenantId, row.contact_id]);
  await inbox.emit(req.app.get("io"), row, "inbox_changed", {}).catch(() => {});
  res.json({ success: true });
}));

router.post("/conversations/:id/reply", messageSendLimiter, handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  const text = String(req.body.text || "").trim();
  const requestId = String(req.body.requestId || "");
  if (!text || text.length > 4096 || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw fail("A message up to 4096 characters and a unique requestId are required");
  if (row.status === "closed") throw fail("Reopen this conversation before replying", 409);
  if (!row.service_window_expires_at || new Date(row.service_window_expires_at).getTime() <= Date.now()) throw fail("Customer service window expired; use an approved template", 409);
  const [contact] = await inbox.query("SELECT is_unsubscribed, is_blocked FROM wa_contacts WHERE id = ? AND tenant_id = ?", [row.contact_id, req.tenantId]);
  if (contact?.is_unsubscribed || contact?.is_blocked) throw fail("This contact is blocked or has opted out", 403);
  const client = await require("../services/waConfigHelper").cloudClientForTenantSender(req.tenantId, row.sender_id, row.branch_id);
  if (!client.isConfigured()) throw fail("WhatsApp sender is not configured", 503);
  const claim = await inbox.query("INSERT IGNORE INTO wa_inbox_send_requests (tenant_id, conversation_id, request_id) VALUES (?, ?, ?)", [req.tenantId, row.id, requestId]);
  if (!claim.affectedRows) {
    const [previous] = await inbox.query("SELECT conversation_id, status, provider_id FROM wa_inbox_send_requests WHERE tenant_id = ? AND request_id = ?", [req.tenantId, requestId]);
    if (Number(previous.conversation_id) !== Number(row.id)) throw fail("Request ID belongs to another conversation", 409);
    return res.status(previous.status === "sent" ? 200 : 409).json({ success: previous.status === "sent", status: previous.status, providerId: previous.provider_id, message: "This request was already submitted. An uncertain send must not be automatically repeated." });
  }
  let providerId;
  try {
    const result = await require("../services/sharedInboxAssistant").humanSend(req.tenantId,row.id,async()=>{
      await inbox.conversation(req,row.id);
      return client.sendText(row.contact_phone,text,false,15000);
    });
    providerId = result?.messages?.[0]?.id || result?.id;
    if (!providerId) throw Object.assign(new Error("Provider did not confirm a message ID"), { deliveryUnknown: true });
  } catch (error) {
    const uncertain = error.deliveryUnknown || /ETIMEDOUT|ECONNRESET|ECONNABORTED/.test(error.code || "");
    await inbox.query("UPDATE wa_inbox_send_requests SET status = ? WHERE tenant_id = ? AND request_id = ?", [uncertain ? "unknown" : "failed", req.tenantId, requestId]);
    throw fail(uncertain ? "Delivery is unknown. Do not resend automatically." : "WhatsApp rejected the send", uncertain ? 504 : 502);
  }
  // A confirmed provider send remains successful even if local metadata persistence fails.
  try {
    await inbox.query("UPDATE wa_inbox_send_requests SET status = 'sent', provider_id = ? WHERE tenant_id = ? AND request_id = ?", [providerId, req.tenantId, requestId]);
    await inbox.query(`INSERT INTO wa_message_logs (tenant_id, conversation_id, sender_id, phone, direction, message_type, message_text, wa_message_id, status)
      VALUES (?, ?, ?, ?, 'outbound', 'text', ?, ?, 'sent')`, [req.tenantId, row.id, row.sender_id, row.contact_phone, text, providerId]);
    await inbox.query("UPDATE wa_message_logs SET sent_by='employee' WHERE tenant_id=? AND wa_message_id=?",[req.tenantId,providerId]);
    await inbox.query("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?", [req.tenantId, row.id]);
  } catch (error) { console.error("[SharedInbox] Confirmed send metadata could not be saved:", error.code || "DB_ERROR"); }
  const message = { id: providerId, body: text, isMe: true, sentBy:"employee", status: "sent", timestamp: Math.floor(Date.now()/1000), type: "text" };
  await inbox.emit(req.app.get("io"), row, "inbox_message", { message }).catch(() => {});
  res.json({ success: true, message });
}));

router.get("/conversations/:id/notes", handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  const notes = await inbox.query("SELECT id, author_id, author_name, note_text, created_at FROM wa_internal_notes WHERE conversation_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 100", [row.id, req.tenantId]);
  res.json({ success: true, notes });
}));
router.get("/conversations/:id/assignments", handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  const before = Number(req.query.before);
  const rows = await inbox.query(`SELECT id,actor_id,owner_user_id,branch_id,created_at FROM wa_assignment_events WHERE tenant_id=? AND conversation_id=? ${Number.isSafeInteger(before)&&before>0 ? "AND id<?" : ""} ORDER BY id DESC LIMIT 26`, [req.tenantId,row.id,...(Number.isSafeInteger(before)&&before>0 ? [before] : [])]);
  res.json({ records: rows.slice(0,25), nextCursor: rows.length>25 ? rows[24].id : null });
}));
router.post("/conversations/:id/notes", handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  const note = String(req.body.text || "").trim();
  if (!note || note.length > 10000) throw fail("Note must contain 1–10000 characters");
  await inbox.query("INSERT INTO wa_internal_notes (tenant_id, conversation_id, phone, author_id, author_name, note_text) VALUES (?, ?, ?, ?, ?, ?)", [req.tenantId, row.id, row.contact_phone, req.user.id, req.user.name || "Staff", note]);
  await inbox.emit(req.app.get("io"), row, "inbox_changed", {}).catch(() => {});
  res.status(201).json({ success: true });
}));
router.post("/conversations/:id/assign", handle(async (req, res) => {
  const old = await inbox.conversation(req, req.params.id);
  const row = await inbox.reassign(req, req.params.id, { userId: req.body.userId ? Number(req.body.userId) : null, branchId: req.body.branchId ? Number(req.body.branchId) : null });
  if (old.owner_user_id) req.app.get("io")?.to(`user:${old.owner_user_id}`).emit("inbox_access_changed", { tenantId: req.tenantId, conversationId: old.id });
  await inbox.emit(req.app.get("io"), row, "inbox_changed", {}).catch(() => {});
  res.json({ success: true });
}));
router.post("/conversations/:id/transfer", handle(async (req, res) => {
  const old = await inbox.conversation(req, req.params.id);
  const row = await inbox.reassign(req, req.params.id, { userId: req.body.targetUserId ? Number(req.body.targetUserId) : null, branchId: Number(req.body.targetBranchId) });
  if (old.owner_user_id) req.app.get("io")?.to(`user:${old.owner_user_id}`).emit("inbox_access_changed", { tenantId: req.tenantId, conversationId: old.id });
  await inbox.emit(req.app.get("io"), row, "inbox_changed", {}).catch(() => {});
  res.json({ success: true, conversationId: row.id, branchId: row.branch_id });
}));
router.patch("/conversations/:id/status", handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  if (!["open", "closed"].includes(req.body.status)) throw fail("Status must be open or closed");
  if(req.body.status==="closed")await require("../services/sharedInboxAssistant").pause(req.tenantId,row.id);
  await inbox.query("UPDATE conversations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?", [req.body.status, row.id, req.tenantId]);
  await inbox.emit(req.app.get("io"), row, "inbox_changed", {}).catch(() => {});
  res.json({ success: true });
}));
router.get("/conversations/:id/media/:mediaId", handle(async (req, res) => {
  const row = await inbox.conversation(req, req.params.id);
  const [known] = await inbox.query("SELECT id FROM wa_message_logs WHERE tenant_id = ? AND conversation_id = ? AND media_id = ? LIMIT 1", [req.tenantId, row.id, req.params.mediaId]);
  if (!known) throw fail("Attachment not found", 404);
  const client = await require("../services/waConfigHelper").cloudClientForTenantSender(req.tenantId, row.sender_id, row.branch_id);
  const media = await client.downloadMedia(req.params.mediaId, { persist: false });
  res.set("Cache-Control", "no-store").json(media);
}));
router.get("/assistant/settings",handle(async(req,res)=>{
  if(!inbox.isAdmin(req))throw fail("Organization administrator required",403);
  res.json({success:true,settings:await require("../services/sharedInboxAssistant").publicSettings(req.tenantId)});
}));
router.put("/assistant/settings",handle(async(req,res)=>{
  if(!inbox.isAdmin(req))throw fail("Organization administrator required",403);
  res.json({success:true,settings:await require("../services/sharedInboxAssistant").saveSettings(req.tenantId,req.body)});
}));
router.post("/conversations/:id/ai-draft",messageSendLimiter,handle(async(req,res)=>{
  const row=await inbox.conversation(req,req.params.id);
  res.json({success:true,text:await require("../services/sharedInboxAssistant").generate(req.tenantId,row.id,req.body.text)});
}));
router.post("/conversations/:id/assistant",handle(async(req,res)=>{
  const row=await inbox.conversation(req,req.params.id),assistant=require("../services/sharedInboxAssistant");
  if(req.body.mode==="human")await assistant.pause(req.tenantId,row.id);
  else if(req.body.mode==="assistant"&&inbox.isAdmin(req))await assistant.resume(req.tenantId,row.id);
  else throw fail("Only an administrator may resume automatic replies",403);
  await inbox.emit(req.app.get("io"),row,"inbox_changed",{}).catch(()=>{});
  res.json({success:true});
}));
router.get("/routing/employees", handle(async (req, res) => {
  if (!inbox.isAdmin(req) && req.userRole !== "branch_manager") throw fail("Organization administrator required", 403);
  const employees = await inbox.query(`SELECT m.user_id, m.branch_id, m.auto_assign_enabled, m.is_available, m.max_open_chats,m.max_open_leads, u.first_name, u.email, u.status AS employee_status, b.name AS branch_name,
    (SELECT COUNT(*) FROM conversations c WHERE c.tenant_id=m.tenant_id AND c.owner_user_id=m.user_id AND c.branch_id=m.branch_id AND c.status<>'closed') AS open_count
    FROM staff_branch_memberships m JOIN users u ON u.id = m.user_id JOIN branches b ON b.id = m.branch_id AND b.tenant_id = m.tenant_id
    WHERE m.tenant_id = ? ${inbox.isAdmin(req) ? "" : "AND EXISTS (SELECT 1 FROM staff_branch_memberships manager WHERE manager.tenant_id=m.tenant_id AND manager.user_id=? AND manager.branch_id=m.branch_id)"} ORDER BY m.user_id, m.branch_id`, [req.tenantId, ...(inbox.isAdmin(req) ? [] : [req.user.id])]);
  const assignments = await inbox.query("SELECT user_id, sender_id FROM staff_sender_assignments WHERE tenant_id = ?", [req.tenantId]);
  const senders = await inbox.query(`SELECT id, display_phone, verified_name FROM wa_senders s WHERE tenant_id = ? AND status = 'connected' ${inbox.isAdmin(req) ? "" : "AND EXISTS (SELECT 1 FROM sender_branch_assignments a JOIN staff_branch_memberships m ON m.tenant_id=a.tenant_id AND m.branch_id=a.branch_id WHERE a.tenant_id=s.tenant_id AND a.sender_id=s.id AND m.user_id=?)"} ORDER BY id`, [req.tenantId, ...(inbox.isAdmin(req) ? [] : [req.user.id])]);
  const visibleSenders = new Set(senders.map(row=>Number(row.id)));
  res.json({ success: true, employees: employees.map(row => ({ ...row, allowed_sender_ids: assignments.filter(item=>Number(item.user_id)===Number(row.user_id)&&visibleSenders.has(Number(item.sender_id))).map(item=>Number(item.sender_id)) })), senders });
}));

router.get("/routing/settings", handle(async (req, res) => {
  if (!inbox.isAdmin(req)) throw fail("Organization administrator required", 403);
  const [settings] = await inbox.query("SELECT strategy,required_skill,crm_strategy,crm_required_skill FROM wa_assignment_settings WHERE tenant_id=?", [req.tenantId]);
  const skills = await inbox.query("SELECT user_id,skill FROM wa_employee_skills WHERE tenant_id=? ORDER BY user_id,skill", [req.tenantId]);
  res.json({ settings: settings || { strategy: "round_robin", required_skill: null,crm_strategy:"round_robin",crm_required_skill:null }, skills });
}));
router.put("/routing/settings", handle(async (req, res) => {
  if (!inbox.isAdmin(req)) throw fail("Organization administrator required", 403);
  const { strategy, required_skill } = req.body;
  const { crm_strategy,crm_required_skill } = req.body;
  if (crm_strategy!==undefined && !["manual","round_robin","workload"].includes(crm_strategy) || crm_required_skill!==undefined && crm_required_skill!==null && (typeof crm_required_skill!=="string" || crm_required_skill.length>80)) throw fail("Choose a valid CRM assignment strategy and skill");
  if (!["manual", "round_robin", "workload"].includes(strategy) || (required_skill && (typeof required_skill !== "string" || required_skill.length > 80))) throw fail("Choose manual, round robin or workload and a skill up to 80 characters");
  await inbox.transaction(async q => {
    await q("INSERT INTO wa_routing_cursors (tenant_id,last_user_id) VALUES (?,0) ON DUPLICATE KEY UPDATE tenant_id=VALUES(tenant_id)", [req.tenantId]);
    await q("SELECT tenant_id FROM wa_routing_cursors WHERE tenant_id=? FOR UPDATE", [req.tenantId]);
    await q("INSERT INTO wa_assignment_settings (tenant_id,strategy,required_skill) VALUES (?,?,?) ON DUPLICATE KEY UPDATE strategy=VALUES(strategy),required_skill=VALUES(required_skill)", [req.tenantId, strategy, required_skill?.trim() || null]);
    if (crm_strategy!==undefined) await q("UPDATE wa_assignment_settings SET crm_strategy=?,crm_required_skill=? WHERE tenant_id=?",[crm_strategy,crm_required_skill?.trim()||null,req.tenantId]);
    await q("INSERT INTO wa_workspace_audit (tenant_id,actor_id,action,details) VALUES (?,?,'routing.updated',?)", [req.tenantId, req.user.id, JSON.stringify({ strategy, required_skill: required_skill?.trim() || null,crm_strategy,crm_required_skill })]);
  });
  res.json({ success: true });
}));
router.put("/routing/employees/:userId/skills", handle(async (req, res) => {
  if (!inbox.isAdmin(req)) throw fail("Organization administrator required", 403);
  if (!Array.isArray(req.body.skills) || req.body.skills.length > 20 || req.body.skills.some(skill => typeof skill !== "string" || !skill.trim() || skill.length > 80)) throw fail("Enter up to 20 skills, each 1–80 characters");
  await inbox.transaction(async q => {
    const [member] = await q("SELECT user_id FROM organization_memberships WHERE tenant_id=? AND user_id=? AND membership_status='active' FOR UPDATE", [req.tenantId, Number(req.params.userId)]);
    if (!member) throw fail("Employee not found", 404);
    await q("DELETE FROM wa_employee_skills WHERE tenant_id=? AND user_id=?", [req.tenantId, Number(req.params.userId)]);
    for (const skill of new Set(req.body.skills.map(skill => skill.trim()))) await q("INSERT INTO wa_employee_skills (tenant_id,user_id,skill) VALUES (?,?,?)", [req.tenantId, Number(req.params.userId), skill]);
    await q("INSERT INTO wa_workspace_audit (tenant_id,actor_id,action,subject_user_id,details) VALUES (?,?,'skills.updated',?,?)", [req.tenantId, req.user.id, Number(req.params.userId), JSON.stringify(req.body.skills)]);
  });
  res.json({ success: true });
}));
router.post("/routing/rebalance", handle(async (req, res) => {
  const assigned = await inbox.retryUnassigned(req);
  res.json({ success: true, assigned });
}));
router.patch("/routing/employees/:userId", handle(async (req, res) => {
  if (!inbox.isAdmin(req)) throw fail("Organization administrator required", 403);
  const { branchId, available, enabled, maxOpenChats, allowedSenderIds = [] } = req.body;
  const maxOpenLeads = req.body.maxOpenLeads;
  if (maxOpenLeads!==undefined && (!Number.isInteger(maxOpenLeads) || maxOpenLeads<1 || maxOpenLeads>10000)) throw fail("Lead capacity must be 1–10000");
  if (!Number.isSafeInteger(Number(branchId)) || ![true, false].includes(available) || ![true, false].includes(enabled) || !Number.isInteger(maxOpenChats) || maxOpenChats < 1 || maxOpenChats > 1000) throw fail("Valid branch, availability, eligibility and capacity (1–1000) are required");
  if (!Array.isArray(allowedSenderIds) || allowedSenderIds.length > 100 || allowedSenderIds.some(id=>!Number.isSafeInteger(id)||id<1)) throw fail("Allowed number IDs must be a list of positive integers");
  const skills = req.body.skills;
  if (skills !== undefined && (!Array.isArray(skills) || skills.length>20 || skills.some(skill=>typeof skill!=="string" || !skill.trim() || skill.length>80))) throw fail("Enter up to 20 valid skills");
  await inbox.transaction(async q => {
    await q("INSERT INTO wa_routing_cursors (tenant_id,last_user_id) VALUES (?,0) ON DUPLICATE KEY UPDATE tenant_id=VALUES(tenant_id)",[req.tenantId]);
    await q("SELECT tenant_id FROM wa_routing_cursors WHERE tenant_id = ? FOR UPDATE",[req.tenantId]);
    const result = await q("UPDATE staff_branch_memberships SET is_available = ?, auto_assign_enabled = ?, max_open_chats = ? WHERE tenant_id = ? AND user_id = ? AND branch_id = ?", [available ? 1 : 0, enabled ? 1 : 0, maxOpenChats, req.tenantId, Number(req.params.userId), Number(branchId)]);
    if (!result.affectedRows) throw fail("Employee branch membership not found", 404);
    if (maxOpenLeads!==undefined) await q("UPDATE staff_branch_memberships SET max_open_leads=? WHERE tenant_id=? AND user_id=? AND branch_id=?",[maxOpenLeads,req.tenantId,Number(req.params.userId),Number(branchId)]);
    for (const senderId of allowedSenderIds) {
      const [linked] = await q("SELECT s.sender_id FROM sender_branch_assignments s JOIN staff_branch_memberships m ON m.tenant_id = s.tenant_id AND m.branch_id = s.branch_id WHERE s.tenant_id = ? AND m.user_id = ? AND s.sender_id = ? LIMIT 1",[req.tenantId,Number(req.params.userId),senderId]);
      if (!linked) throw fail("A number is outside this employee's branches");
    }
    await q("DELETE FROM staff_sender_assignments WHERE tenant_id = ? AND user_id = ?",[req.tenantId,Number(req.params.userId)]);
    for (const senderId of new Set(allowedSenderIds)) await q("INSERT INTO staff_sender_assignments (tenant_id,user_id,sender_id) VALUES (?,?,?)",[req.tenantId,Number(req.params.userId),senderId]);
    if (skills !== undefined) {
      await q("DELETE FROM wa_employee_skills WHERE tenant_id=? AND user_id=?", [req.tenantId,Number(req.params.userId)]);
      for (const skill of new Set(skills.map(value=>value.trim()))) await q("INSERT INTO wa_employee_skills (tenant_id,user_id,skill) VALUES (?,?,?)", [req.tenantId,Number(req.params.userId),skill]);
    }
    await q("INSERT INTO wa_workspace_audit (tenant_id,actor_id,action,subject_user_id,details) VALUES (?,?,'employee.routing.updated',?,?)", [req.tenantId,req.user.id,Number(req.params.userId),JSON.stringify({branchId,available,enabled,maxOpenChats,allowedSenderIds,skills})]);
  });
  await inbox.retryUnassigned(req);
  res.json({ success: true });
}));

router.use((error,req,res,next)=>{
  if(error instanceof multer.MulterError)return res.status(400).json({message:error.code==="LIMIT_FILE_SIZE"?"Attachment exceeds the 8 MB upload limit":"Invalid attachment upload"});
  next(error);
});
module.exports = router;
