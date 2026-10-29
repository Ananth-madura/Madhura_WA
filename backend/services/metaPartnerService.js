"use strict";
const db = require("../config/database");
const workspace = require("./senderWorkspace").createService(db);
const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
async function resolveSenderCredentials(tenantId, senderId = null, branchId = null) {
  const tenant = Number(tenantId);
  if (!Number.isSafeInteger(tenant) || tenant < 1) throw Object.assign(new Error("Organization context is required"), { code: "TENANT_REQUIRED" });
  const select = `SELECT s.*,w.encrypted_token,w.waba_id FROM wa_senders s JOIN waba_connections w ON w.id=s.waba_connection_id AND w.tenant_id=s.tenant_id AND w.status='connected'`;
  let sender;
  if (senderId) {
    [sender] = await q(`${select} WHERE s.tenant_id=? AND s.id=? AND s.status='connected' LIMIT 1`, [tenant, Number(senderId)]);
    if (!sender) throw Object.assign(new Error("Requested WhatsApp number is not connected to this organization"), { code: "SENDER_NOT_FOUND" });
  } else if (branchId) {
    const [branch] = await q("SELECT id FROM branches WHERE tenant_id=? AND id=? AND status='active'", [tenant, Number(branchId)]);
    if (!branch) throw Object.assign(new Error("Branch does not belong to this organization"), { code: "BRANCH_NOT_FOUND" });
    [sender] = await q(`${select} JOIN sender_branch_assignments a ON a.sender_id=s.id AND a.tenant_id=s.tenant_id WHERE s.tenant_id=? AND a.branch_id=? AND s.status='connected' ORDER BY a.is_default DESC,s.id LIMIT 1`, [tenant, Number(branchId)]);
    if (!sender) [sender] = await q(`${select} WHERE s.tenant_id=? AND s.is_shared=1 AND s.status='connected' ORDER BY s.id LIMIT 1`, [tenant]);
  } else [sender] = await q(`${select} WHERE s.tenant_id=? AND s.status='connected' ORDER BY s.is_shared DESC,s.id LIMIT 1`, [tenant]);
  if (sender) return { phone_number_id: sender.phone_number_id, access_token: sender.encrypted_token || "", display_phone: sender.display_phone,
    verified_name: sender.verified_name, quality: sender.last_verified_at ? sender.quality : null, waba_id: sender.waba_id,
    app_secret: sender.app_secret || "", verify_token: sender.verify_token || "", sender_id: sender.id, tenant_id: tenant,
    isConfigured: Boolean(sender.phone_number_id && sender.encrypted_token) };
  if (tenant === 1 && !senderId && !branchId) return { phone_number_id: process.env.WA_PHONE_NUMBER_ID || "", access_token: process.env.WA_ACCESS_TOKEN || "",
    display_phone: process.env.WA_DISPLAY_PHONE_NUMBER || "", verified_name: process.env.WA_VERIFIED_NAME || "", quality: null,
    waba_id: process.env.WA_WABA_ID || "", app_secret: process.env.WA_APP_SECRET || "", verify_token: process.env.WA_VERIFY_TOKEN || "",
    sender_id: null, tenant_id: tenant, isConfigured: Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) };
  return { phone_number_id: "", access_token: "", app_secret: "", verify_token: "", waba_id: "", sender_id: null, tenant_id: tenant, isConfigured: false };
}
module.exports = {
  createOnboardingSession: workspace.createSession, completeOnboarding: workspace.completeSession,
  getTenantSenders: workspace.list, updateSenderBranchAssignments: workspace.updateRouting, resolveSenderCredentials,
  registerDirectSender: workspace.connect, syncSenderHealth: workspace.sync, deleteSender: workspace.disconnect,
  setup: workspace.setup, getSender: workspace.detail, webhookSettings: workspace.webhookSettings,
  subscribeWebhook: workspace.subscribe, activity: workspace.activity,
  registerSender: workspace.register,
};
