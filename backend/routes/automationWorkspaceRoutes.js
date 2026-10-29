"use strict";
const router = require("express").Router();
const store = require("../services/automationStore").createStore(require("../config/database"));
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const handle = work => async (req, res) => {
  try { await work(req, res); }
  catch (error) { if (!error.status) console.error("[Automation workspace]", error.code || "OPERATION_FAILED"); res.status(error.status || 503).json({ error: error.status ? error.message : "Automation operation failed. Retry or contact your administrator." }); }
};
const engine = () => require("../services/waAutomationService");
router.use(verifyToken, requireTenantContext, require("../middleware/workspaceModule").workspaceModule("automations"));
router.use((req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
const listing = `SELECT a.*,t.name AS template_name,t.body AS template_body,
  ft.name AS followup_template_name,ft.body AS followup_template_body,f.name AS flow_name,g.name AS group_name,s.display_phone AS sender_phone,
  (SELECT COUNT(*) FROM wa_automation_options o WHERE o.automation_id=a.id) AS option_count
  FROM wa_automations a LEFT JOIN wa_templates t ON t.id=a.template_id AND t.tenant_id=a.tenant_id
  LEFT JOIN wa_templates ft ON ft.id=a.followup_template_id AND ft.tenant_id=a.tenant_id
  LEFT JOIN wa_flows f ON f.id=a.flow_id AND f.tenant_id=a.tenant_id
  LEFT JOIN wa_contact_groups g ON g.id=a.group_id AND g.tenant_id=a.tenant_id
  LEFT JOIN wa_senders s ON s.id=a.sender_id AND s.tenant_id=a.tenant_id`;
const labeled = row => ({ ...row, trigger_label: row.trigger_type.replaceAll("_", " ") });
router.get("/", handle(async (req, res) => res.json((await store.query(`${listing} WHERE a.tenant_id=? ORDER BY a.created_at DESC LIMIT 500`, [req.tenantId])).map(labeled))));
router.get("/references", handle(async (req, res) => {
  const [templates, flows, groups, senders] = await Promise.all([
    store.query("SELECT id,name,category,body,meta_status,meta_template_id FROM wa_templates WHERE tenant_id=? ORDER BY name LIMIT 500", [req.tenantId]),
    store.query("SELECT id,name,status FROM wa_flows WHERE tenant_id=? ORDER BY name LIMIT 500", [req.tenantId]),
    store.query("SELECT g.id,g.name,(SELECT COUNT(*) FROM wa_group_contacts c WHERE c.group_id=g.id AND c.tenant_id=g.tenant_id) AS total_contacts FROM wa_contact_groups g WHERE g.tenant_id=? ORDER BY g.name LIMIT 500", [req.tenantId]),
    store.query("SELECT id,display_phone,status FROM wa_senders WHERE tenant_id=? ORDER BY id LIMIT 100", [req.tenantId]),
  ]); res.json({ templates, flows, groups, senders });
}));
router.get("/stats", handle(async (req, res) => {
  const [rules] = await store.query("SELECT COUNT(*) AS totalRules,COALESCE(SUM(is_active=1),0) AS activeRules,COALESCE(SUM(run_count),0) AS totalRuns FROM wa_automations WHERE tenant_id=?", [req.tenantId]);
  const [logs] = await store.query(`SELECT COALESCE(SUM(l.status='sent'),0) AS sentCount,COALESCE(SUM(l.status='failed'),0) AS failedCount,
    COALESCE(SUM(l.status='scheduled'),0) AS scheduledCount,COALESCE(SUM(l.status='unknown'),0) AS unknownCount,
    COALESCE(SUM(l.status='skipped'),0) AS skippedCount FROM wa_automation_logs l JOIN wa_automations a ON a.id=l.automation_id WHERE a.tenant_id=?`, [req.tenantId]);
  res.json({ ...rules, ...logs, scheduler: engine().schedulerStatus() });
}));
router.get("/logs/recent", handle(async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50)), params = [req.tenantId], filters = ["a.tenant_id=?"];
  if (req.query.status) { if (!["scheduled", "sending", "sent", "failed", "skipped", "unknown"].includes(req.query.status)) throw fail("Unknown execution status"); filters.push("l.status=?"); params.push(req.query.status); }
  if (req.query.automation_id) { filters.push("a.id=?"); params.push(req.query.automation_id); }
  res.json(await store.query(`SELECT l.id,l.automation_id,l.phone,l.contact_name,l.status,l.error,l.sent_at,l.scheduled_for,l.execution_step,l.wa_message_id,a.name AS automation_name,a.trigger_type FROM wa_automation_logs l JOIN wa_automations a ON a.id=l.automation_id WHERE ${filters.join(" AND ")} ORDER BY l.id DESC LIMIT ?`, [...params, limit]));
}));
router.post("/stop-all", handle(async (req, res) => res.json(await store.bulk(req.tenantId, req.user.id, false))));
router.post("/resume-all", handle(async (req, res) => res.json(await store.bulk(req.tenantId, req.user.id, true))));
router.post("/seed", handle(async (req, res) => {
  res.json(await store.transaction(async q => {
    await q("SELECT id FROM tenants WHERE id=? FOR UPDATE", [req.tenantId]); let count = 0;
    for (const starter of require("../services/automationStarters")) {
      if ((await q("SELECT id FROM wa_automations WHERE tenant_id=? AND name=?", [req.tenantId, starter.name])).length) continue;
      await q("INSERT INTO wa_automations (tenant_id,created_by,name,trigger_type,message_text,delay_minutes,is_active,sequence_delay_seconds,followup_message_text) VALUES (?,?,?,?,?,?,0,?,?)", [req.tenantId, req.user.id, starter.name, starter.trigger_type, starter.message_text, starter.delay_minutes, starter.sequence_delay_seconds, starter.followup_message_text || null]); count++;
    } return { success: true, count };
  }));
}));
router.get("/welcome-settings", handle(async (req, res) => res.json(await engine().getWelcomeSettings(req.tenantId))));
router.put("/welcome-settings", handle(async (req, res) => res.json(await engine().updateWelcomeSettings(req.body, req.tenantId))));
const recipient = value => { let phone = String(value || "").replace(/\D/g, ""); if (phone.length === 10) phone = "91" + phone; if (!/^[1-9]\d{9,14}$/.test(phone)) throw fail("A valid recipient phone number is required"); return phone; };
router.post("/test-welcome", handle(async (req, res) => {
  const settings = await engine().getWelcomeSettings(req.tenantId), phone = recipient(req.body.phone), data = await engine().lookupCrmDataByPhone(phone, req.tenantId);
  const result = await require("../services/automationCloudDelivery").send({ tenant_id: req.tenantId, sender_id: req.body.sender_id, template_id: settings.welcome_type === "template" ? settings.template_id : null }, phone, engine().formatMessagePlaceholders(settings.welcome_text || "Hello {name}!", data.name || "Customer", data), data, { buttons: settings.welcome_type === "buttons" ? settings.welcome_buttons : null });
  res.json({ success: true, engineUsed: "Meta Cloud API", native: Boolean(settings.welcome_buttons?.length), providerId: result.messages?.[0]?.id });
}));
router.post("/simulate-trigger", handle(async (req, res) => {
  if (!require("../services/automationStore").TRIGGERS.includes(req.body.trigger_type)) throw fail("Choose a supported event");
  if (req.body.send_real_message) throw fail("Use the individual rule test to send a real message. Event simulation is read-only.");
  const data = req.body.custom_data || {};
  if (!data || typeof data !== "object" || Array.isArray(data) || Buffer.byteLength(JSON.stringify(data)) > 16000) throw fail("Provide a JSON event object up to 16 KiB");
  const rows = await store.query(`${listing} WHERE a.tenant_id=? AND a.is_active=1 AND a.trigger_type=? LIMIT 100`, [req.tenantId, req.body.trigger_type]);
  const evaluated = rows.map(rule => ({ id: rule.id, name: rule.name, trigger_type: rule.trigger_type, conditions_matched: require("../services/waRuleConditions").matchesConditions(rule.conditions, data),
    step1_text: engine().formatMessagePlaceholders(rule.message_text || rule.template_body, req.body.contact_name || data.name, data, { spintaxEnabled: false }),
    step2_followup_text: rule.followup_message_text || rule.followup_template_body ? engine().formatMessagePlaceholders(rule.followup_message_text || rule.followup_template_body, req.body.contact_name || data.name, data, { spintaxEnabled: false }) : null,
    sequence_delay_seconds: rule.sequence_delay_seconds, delay_minutes: rule.delay_minutes, has_media: Boolean(rule.media_url), has_flow_linked: Boolean(rule.flow_id) }));
  res.json({ success: true, trigger_type: req.body.trigger_type, matched_rules_count: evaluated.filter(rule => rule.conditions_matched).length, evaluated_rules: evaluated, sample_data_used: data, real_message_dispatched: false });
}));
router.post("/", handle(async (req, res) => res.status(201).json(labeled(await store.save(req.tenantId, req.user.id, req.body)))));
router.get("/:id", handle(async (req, res) => { const row = await store.get(req.tenantId, req.params.id); res.json({ ...labeled(row), options: await store.query("SELECT id,label,reply_text,sort_order FROM wa_automation_options WHERE automation_id=? ORDER BY sort_order,id", [row.id]) }); }));
router.put("/:id", handle(async (req, res) => res.json(labeled(await store.save(req.tenantId, req.user.id, req.body, req.params.id)))));
router.post("/:id/toggle", handle(async (req, res) => res.json(await store.setEnabled(req.tenantId, req.user.id, req.params.id))));
router.post("/:id/executions/:runId/cancel", handle(async(req,res)=>res.json(await store.transaction(async q=>{
  const rule=await store.get(req.tenantId,req.params.id,q,true);
  const [run]=await q("SELECT id,status FROM wa_automation_logs WHERE automation_id=? AND id=? FOR UPDATE",[rule.id,req.params.runId]);
  if(!run)throw fail("Execution not found",404);
  if(run.status!=="scheduled")throw fail("Only a scheduled execution can be cancelled",409);
  await q("UPDATE wa_automation_logs SET status='skipped',error='Cancelled by an authorized employee',trigger_data=NULL WHERE id=? AND status='scheduled'",[run.id]);
  await q("INSERT INTO wa_automation_audit (tenant_id,automation_id,actor_id,action,revision) VALUES (?,?,?,'execution_cancelled',?)",[req.tenantId,rule.id,req.user.id,rule.revision]);
  return {success:true,status:"skipped"};
}))));
router.delete("/:id", handle(async (req, res) => res.json(await store.remove(req.tenantId, req.user.id, req.params.id))));
router.get("/:id/options", handle(async (req, res) => { const row = await store.get(req.tenantId, req.params.id); res.json(await store.query("SELECT id,label,reply_text,sort_order FROM wa_automation_options WHERE automation_id=? ORDER BY sort_order,id", [row.id])); }));
router.put("/:id/options", handle(async (req, res) => res.json(await store.replaceOptions(req.tenantId, req.user.id, req.params.id, req.body.options))));
router.get("/:id/audit", handle(async (req, res) => { await store.get(req.tenantId, req.params.id); res.json(await store.query("SELECT id,actor_id,action,revision,created_at FROM wa_automation_audit WHERE tenant_id=? AND automation_id=? ORDER BY id DESC LIMIT 100", [req.tenantId, req.params.id])); }));
router.post("/:id/trigger", handle(async (req, res) => {
  if (req.body.sessionKey && String(req.body.sessionKey) !== String(req.user.id)) throw fail("Use your own sender session", 403);
  const row = await store.get(req.tenantId, req.params.id); await store.links(req.tenantId, row);
  const phone = recipient(req.body.phone), data = req.body.trigger_data || {};
  if (!data || typeof data !== "object" || Array.isArray(data) || Buffer.byteLength(JSON.stringify(data)) > 16000) throw fail("Provide a JSON event object up to 16 KiB");
  const crm = await engine().lookupCrmDataByPhone(phone, req.tenantId), merged = { ...crm, ...data };
  if (!require("../services/waRuleConditions").matchesConditions(row.conditions, merged)) throw fail("This recipient does not match the rule conditions", 409);
  const result = await engine().executeAutomationSend(row, phone, req.body.contact_name || crm.name, null, merged, String(req.user.id), null, { manual: true, requestId: req.body.request_id });
  if (!result?.success) return res.status(result?.deliveryUnknown ? 504 : 502).json({ success: false, deliveryUnknown: Boolean(result?.deliveryUnknown), error: result?.error || "The provider did not confirm delivery" });
  res.json({ success: true, phone, warnings:result.warnings||[], message: row.followup_message_text || row.followup_template_id || row.followup_media_url ? "Main message accepted by Meta; follow-up queued." : "Message accepted by Meta." });
}));
module.exports = router;
