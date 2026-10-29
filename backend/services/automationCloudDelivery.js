"use strict";
const crypto = require("crypto");
const q = async (sql, params = []) => (await require("../config/database").promise().query(sql, params))[0];
const fail = (message, status = 409) => Object.assign(new Error(message), { status });

async function send(rule, phone, text, data = {}, execution = {}) {
  const tenant = Number(rule.tenant_id);
  if (!tenant) throw fail("Organization is required", 403);
  let sender = Number(rule.sender_id);
  if (!sender) {
    const senders = await q("SELECT id FROM wa_senders WHERE tenant_id=? AND status='connected' LIMIT 2", [tenant]);
    if (senders.length !== 1) throw fail("Select one connected organization sender");
    sender = senders[0].id;
  }
  if (!(await q("SELECT id FROM wa_senders WHERE tenant_id=? AND id=? AND status='connected'", [tenant, sender])).length) throw fail("Sender is not connected to this organization", 403);
  const localPhone = phone.startsWith("91") && phone.length === 12 ? phone.slice(-10) : phone;
  const contacts = await q("SELECT id,is_blocked,is_unsubscribed,opt_in_status FROM wa_contacts WHERE tenant_id=? AND phone IN (?,?) LIMIT 2", [tenant, phone, localPhone]);
  if (contacts.length !== 1 || contacts[0].is_blocked || contacts[0].is_unsubscribed) throw fail("Select one eligible organization contact", 403);
  if ((await q("SELECT id FROM wa_opt_outs WHERE tenant_id=? AND phone IN (?,?) LIMIT 1", [tenant, phone, localPhone])).length) throw fail("Contact has opted out", 403);
  const [conversation] = await q("SELECT * FROM conversations WHERE tenant_id=? AND sender_id=? AND contact_id=? ORDER BY id DESC LIMIT 1", [tenant, sender, contacts[0].id]);
  if (conversation?.automation_mode === "human" && Number(conversation.automation_version) > 0 && !execution.manual) throw fail("An employee has taken over this conversation");
  const client = await require("./waConfigHelper").cloudClientForTenantSender(tenant, sender, conversation?.branch_id);
  let template;
  if (rule.template_id) {
    [template] = await q("SELECT * FROM wa_templates WHERE tenant_id=? AND id=? AND waba_id=? AND meta_status='APPROVED' AND meta_template_id IS NOT NULL", [tenant, rule.template_id, client.wabaId]);
    if (!template || !contacts[0].opt_in_status) throw fail("An approved template for this sender and contact opt-in are required", 403);
    if (template.header_type && template.header_type !== "TEXT" || /[{}]/.test(template.header_value || "")) throw fail("This automation supports templates with fixed text headers and body variables");
  } else if (!conversation || conversation.status !== "open" || new Date(conversation.service_window_expires_at).getTime() <= Date.now()) throw fail("The customer service window expired; use an approved template", 409);
  const requestId = crypto.createHash("sha256").update(execution.requestId || (execution.logId ? `scheduled:${execution.logId}` : crypto.randomUUID())).digest("hex");
  const claim = await q("INSERT IGNORE INTO wa_automation_dispatches (tenant_id,request_id) VALUES (?,?)", [tenant, requestId]);
  if (!claim.affectedRows) {
    const [previous] = await q("SELECT status,provider_id FROM wa_automation_dispatches WHERE tenant_id=? AND request_id=?", [tenant, requestId]);
    throw Object.assign(fail("This automation delivery was already attempted; inspect its provider status"), { deliveryUnknown: previous?.status !== "sent", duplicateSuppressed: true });
  }
  let result, providerId;
  try {
    if (template) {
      const body = require("./waAutomationService").buildTemplateBodyComponent(template.body, data.name, data);
      result = await client.sendTemplate(phone, template.name, template.language || "en", body ? [body] : [], 15000);
    } else if (execution.buttons?.length) result = await client.sendInteractiveButtons(phone, text, execution.buttons, null, null, 15000);
    else if (rule.media_url) result = await client.sendMedia(phone, rule.media_type, rule.media_url, text || "");
    else result = await client.sendText(phone, text, false, 15000);
    providerId = result?.messages?.[0]?.id || result?.id;
    if (!providerId) throw Object.assign(new Error("Provider acceptance is unconfirmed"), { deliveryUnknown: true });
  } catch (error) {
    const unknown = error.deliveryUnknown || /ETIMEDOUT|ECONNRESET|ECONNABORTED|WA_TIMEOUT/.test(error.code || "");
    await q("UPDATE wa_automation_dispatches SET status=? WHERE tenant_id=? AND request_id=?", [unknown ? "unknown" : "failed", tenant, requestId]);
    if (!unknown) await q("DELETE FROM wa_automation_dispatches WHERE tenant_id=? AND request_id=? AND status='failed'", [tenant, requestId]);
    throw Object.assign(fail(unknown ? "Delivery is uncertain. Check Meta before retrying." : "Meta rejected the automation message", 502), { deliveryUnknown: Boolean(unknown) });
  }
  await q("UPDATE wa_automation_dispatches SET status='sent',provider_id=? WHERE tenant_id=? AND request_id=?", [providerId, tenant, requestId]).catch(() => {});
  if (conversation) await require("./sharedInboxService").createInboxService(require("../config/database")).emit(require("../sockets/chatsockets").getIO(), conversation, "inbox_message", { message: { id: providerId, body: text, isMe: true, sentBy: "automation", status: "sent", timestamp: Math.floor(Date.now() / 1000) } }).catch(() => {});
  return { ...result, automationConversation: conversation, automationSenderId: sender, automationContactId: contacts[0].id };
}

async function sendMenu(rule, phone, data, execution = {}) {
  const options = await q("SELECT id,label,reply_text FROM wa_automation_options WHERE automation_id=? ORDER BY sort_order,id LIMIT 10", [rule.id]);
  if (!options.length) return;
  const buttons = options.slice(0, 3).map(option => ({ id: `auto:${rule.id}:${option.id}`, title: option.label }));
  if (options.length > 3) throw fail("Edit this rule to use up to three reply buttons with its Meta sender");
  await q("INSERT INTO wa_automation_menus (tenant_id,sender_id,phone,automation_id) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE automation_id=VALUES(automation_id),created_at=CURRENT_TIMESTAMP", [rule.tenant_id, rule.sender_id, phone, rule.id]);
  await send({ ...rule, template_id: null, media_url: null }, phone, "Please choose an option:", data, { ...execution, requestId: `${execution.requestId || execution.logId || crypto.randomUUID()}:menu`, buttons });
}
module.exports = { send, sendMenu };
