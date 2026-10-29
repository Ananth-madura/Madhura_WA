"use strict";
const { normalizeConditions } = require("./waRuleConditions");
const TRIGGERS = ["welcome_message", "new_lead", "invoice_created", "quotation_created", "amc_created", "payment_received", "payment_due", "service_visit_scheduled", "walkin_created", "ticket_closed", "birthday", "appointment_reminder", "lead_followup", "abandoned_cart", "custom"];
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const idValue = value => value == null || value === "" ? null : Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : (() => { throw fail("Linked records need valid IDs"); })();
const FIELDS = ["name", "trigger_type", "sender_id", "template_id", "message_text", "media_type", "media_url", "sequence_delay_seconds", "followup_message_text", "followup_media_type", "followup_media_url", "followup_template_id", "flow_id", "group_id", "delay_minutes", "conditions", "is_active"];

function normalize(input) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 255 || !TRIGGERS.includes(input.trigger_type)) throw fail("Provide a rule name up to 255 characters and a supported trigger");
  const result = { ...input, name: input.name.trim() };
  for (const field of ["sender_id", "template_id", "followup_template_id", "flow_id", "group_id"]) result[field] = idValue(input[field]);
  for (const field of ["message_text", "followup_message_text"]) {
    if (input[field] != null && (typeof input[field] !== "string" || input[field].length > 4096)) throw fail("Messages must be text up to 4096 characters");
    result[field] = input[field]?.trim() || null;
  }
  for (const prefix of ["", "followup_"]) {
    const url = input[`${prefix}media_url`], type = input[`${prefix}media_type`];
    result[`${prefix}media_type`] = url ? type : null;
    result[`${prefix}media_url`] = url || null;
    if (url) {
      if (typeof url !== "string" || url.length > 2000 || !["image", "video", "audio", "document", "excel"].includes(type)) throw fail("Choose a supported media type and URL");
      try { const parsed = new URL(url); if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error(); } catch (_) { throw fail("Media must use an HTTPS URL without embedded credentials"); }
    }
    if (result[`${prefix}template_id`] && result[`${prefix}media_url`]) throw fail("Choose either a template or media for each message");
  }
  if (!result.message_text && !result.media_url && !result.template_id) throw fail("Configure the main message, media or template");
  result.delay_minutes = Number(input.delay_minutes ?? 0);
  result.sequence_delay_seconds = Number(input.sequence_delay_seconds ?? 7);
  if (!Number.isInteger(result.delay_minutes) || result.delay_minutes < 0 || result.delay_minutes > 43200) throw fail("Delay must be 0 to 43200 whole minutes");
  if (!Number.isInteger(result.sequence_delay_seconds) || result.sequence_delay_seconds < 5 || result.sequence_delay_seconds > 60) throw fail("Follow-up delay must be 5 to 60 whole seconds");
  if (![undefined, true, false, 0, 1].includes(input.is_active)) throw fail("Enable state must be a boolean");
  result.is_active = input.is_active === undefined ? 0 : Number(Boolean(input.is_active));
  try { result.conditions = JSON.stringify(normalizeConditions(input.conditions)); } catch (error) { throw fail(error.message); }
  return result;
}

function normalizeOptions(options) {
  if (!Array.isArray(options) || options.length > 3) throw fail("Provide up to three reply options");
  const normalized = options.map(option => {
    if (!option || typeof option.label !== "string" || !option.label.trim() || option.label.length > 20 || typeof option.reply_text !== "string" || !option.reply_text.trim() || option.reply_text.length > 4096) throw fail("Reply options need a label up to 20 characters and a response up to 4096 characters");
    return { label: option.label.trim(), reply_text: option.reply_text.trim() };
  });
  if (new Set(normalized.map(option => option.label.toLowerCase())).size !== normalized.length) throw fail("Reply option labels must be unique");
  return normalized;
}

function createStore(db) {
  const query = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  async function transaction(work) {
    if (db.isSqlite) throw fail("Automation editing requires the configured MySQL database", 503);
    const connection = await db.promise().getConnection();
    try { await connection.beginTransaction(); const value = await work(async (sql, params = []) => (await connection.query(sql, params))[0]); await connection.commit(); return value; }
    catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }
  async function get(tenant, id, q = query, lock = false) {
    const [row] = await q(`SELECT * FROM wa_automations WHERE tenant_id=? AND id=?${lock ? " FOR UPDATE" : ""}`, [tenant, id]);
    if (!row) throw fail("Automation not found", 404);
    return row;
  }
  async function links(tenant, rule, q = query) {
    if (!rule.sender_id || !(await q("SELECT id FROM wa_senders WHERE tenant_id=? AND id=? AND status='connected'", [tenant, rule.sender_id])).length) throw fail("Choose a connected Meta sender from this organization");
    for (const field of ["template_id", "followup_template_id"]) if (rule[field]) {
      const [template] = await q("SELECT id FROM wa_templates WHERE tenant_id=? AND id=? AND meta_status='APPROVED' AND meta_template_id IS NOT NULL", [tenant, rule[field]]);
      if (!template) throw fail("Select a Meta-approved template belonging to this organization");
    }
    if (rule.flow_id && !(await q("SELECT f.id FROM wa_flows f JOIN wa_flow_versions v ON v.flow_id=f.id AND v.status='published' WHERE f.tenant_id=? AND f.id=? AND f.status='active'", [tenant, rule.flow_id])).length) throw fail("Select a published, active flow from this organization");
    if (rule.group_id && !(await q("SELECT id FROM wa_contact_groups WHERE tenant_id=? AND id=?", [tenant, rule.group_id])).length) throw fail("Select a contact group from this organization");
  }
  const audit = (q, tenant, user, id, action, revision) => q("INSERT INTO wa_automation_audit (tenant_id,automation_id,actor_id,action,revision) VALUES (?,?,?,?,?)", [tenant, id, user, action, revision]);
  async function options(q, id, values) {
    await q("DELETE FROM wa_automation_options WHERE automation_id=?", [id]);
    for (const [index, option] of values.entries()) await q("INSERT INTO wa_automation_options (automation_id,label,reply_text,sort_order) VALUES (?,?,?,?)", [id, option.label, option.reply_text, index]);
  }
  async function save(tenant, user, input, id = null) {
    const rule = normalize(input), replies = input.options === undefined ? undefined : normalizeOptions(input.options);
    return transaction(async q => {
      const previous = id ? await get(tenant, id, q, true) : null;
      if (previous && input.revision !== undefined && Number(input.revision) !== Number(previous.revision)) throw fail("This automation changed in another session. Reload before saving.", 409);
      await links(tenant, rule, q);
      const values = FIELDS.map(field => rule[field]);
      if (previous) await q(`UPDATE wa_automations SET ${FIELDS.map(field => `${field}=?`).join(",")},revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?`, [...values, tenant, id]);
      else id = (await q(`INSERT INTO wa_automations (tenant_id,created_by,${FIELDS.join(",")}) VALUES (${[tenant, user, ...values].map(() => "?").join(",")})`, [tenant, user, ...values])).insertId;
      if (replies !== undefined) await options(q, id, replies);
      const row = await get(tenant, id, q);
      await audit(q, tenant, user, id, previous ? "updated" : "created", row.revision);
      return row;
    });
  }
  async function setEnabled(tenant, user, id, enabled = null) {
    return transaction(async q => {
      const rule = await get(tenant, id, q, true), active = enabled === null ? !rule.is_active : enabled;
      if (active) { normalize(rule); await links(tenant, rule, q); }
      await q("UPDATE wa_automations SET is_active=?,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?", [Number(active), tenant, id]);
      await audit(q, tenant, user, id, active ? "enabled" : "paused", Number(rule.revision) + 1);
      return { success: true, is_active: Number(active) };
    });
  }
  async function remove(tenant, user, id) {
    return transaction(async q => {
      const row = await get(tenant, id, q, true);
      await audit(q, tenant, user, id, "deleted", row.revision);
      await q("DELETE FROM wa_automations WHERE tenant_id=? AND id=?", [tenant, id]);
      return { success: true };
    });
  }
  async function replaceOptions(tenant, user, id, input) {
    const replies = normalizeOptions(input);
    return transaction(async q => {
      const row = await get(tenant, id, q, true); await options(q, id, replies);
      await q("UPDATE wa_automations SET revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?", [tenant, id]);
      await audit(q, tenant, user, id, "options_updated", Number(row.revision) + 1);
      return replies;
    });
  }
  async function bulk(tenant, user, active) {
    return transaction(async q => {
      const rows = await q("SELECT * FROM wa_automations WHERE tenant_id=? AND is_active=? ORDER BY id LIMIT 501 FOR UPDATE", [tenant, Number(!active)]);
      if(rows.length>500)throw fail("Manage rules in batches of up to 500",409);
      for(const row of rows){
        if(active){normalize(row);await links(tenant,row,q);}
        await q("UPDATE wa_automations SET is_active=?,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?",[Number(active),tenant,row.id]);
        await audit(q,tenant,user,row.id,active?"enabled":"paused",Number(row.revision)+1);
      }
      return {success:true,[active?"resumed":"stopped"]:rows.length};
    });
  }
  return { query, get, save, links, setEnabled, remove, replaceOptions, transaction, bulk };
}
module.exports = { createStore, normalize, normalizeOptions, TRIGGERS };
