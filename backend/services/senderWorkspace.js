"use strict";
const crypto = require("crypto");
const axios = require("axios");
const { encrypt, decrypt } = require("../backendutil/cryptoHelper");
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const positiveId = value => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw failure("A valid record ID is required"); return id; };
const metaId = value => { if (typeof value !== "string" || !/^\d{5,100}$/.test(value)) throw failure("Enter the numeric Meta asset IDs from your business account"); return value; };
const flag = (value, fallback = true) => { if (value === undefined) return fallback; if (![true, false, 0, 1].includes(value)) throw failure("Routing settings must be boolean values"); return Boolean(value); };
const idList = value => { if (!Array.isArray(value) || value.length > 100) throw failure("Choose up to 100 active branches"); return [...new Set(value.map(positiveId))]; };
const graphVersion = () => /^v\d+\.\d+$/.test(process.env.WA_GRAPH_API_VERSION || "") ? process.env.WA_GRAPH_API_VERSION : "v22.0";
const graphBase = () => `https://graph.facebook.com/${graphVersion()}`;

function createService(db, transport = axios) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  async function transaction(work) {
    if (db.isSqlite) throw failure("Sender management requires the configured MySQL database", 503);
    const connection = await db.promise().getConnection();
    try { await connection.beginTransaction(); const result = await work(async (sql, params = []) => (await connection.query(sql, params))[0]); await connection.commit(); return result; }
    catch (error) { await connection.rollback(); if (error.code === "ER_DUP_ENTRY" || error.code === "ER_LOCK_DEADLOCK") throw failure("The sender changed during this operation. Reload and retry.", 409); throw error; }
    finally { connection.release(); }
  }
  async function tenantLock(query, tenant) {
    const [row] = await query("SELECT id,max_senders,status FROM tenants WHERE id=? FOR UPDATE", [positiveId(tenant)]);
    if (!row || row.status !== "active") throw failure("Active organization membership is required", 403);
    return row;
  }
  async function sender(tenant, id, query = q, lock = false) {
    const [row] = await query(`SELECT s.*,w.waba_id,w.encrypted_token FROM wa_senders s LEFT JOIN waba_connections w ON w.id=s.waba_connection_id AND w.tenant_id=s.tenant_id WHERE s.tenant_id=? AND s.id=?${lock ? " FOR UPDATE" : ""}`, [positiveId(tenant), positiveId(id)]);
    if (!row) throw failure("Sender not found", 404);
    return row;
  }
  const audit = (query, tenant, user, id, action, revision) => query("INSERT INTO wa_sender_audit (tenant_id,sender_id,actor_id,action,revision) VALUES (?,?,?,?,?)", [tenant, id, positiveId(user), action, revision]);
  async function publicSender(tenant, id, query = q) {
    const row = await sender(tenant, id, query);
    const branches = await query("SELECT a.branch_id,a.is_default,b.name,b.status FROM sender_branch_assignments a JOIN branches b ON b.id=a.branch_id AND b.tenant_id=a.tenant_id WHERE a.tenant_id=? AND a.sender_id=? ORDER BY b.name", [tenant, id]);
    return serialize(row, branches);
  }
  function serialize(row, branches) {
    return { id: row.id, tenant_id: row.tenant_id, phone_number_id: row.phone_number_id, display_phone: row.display_phone, verified_name: row.verified_name,
      waba_id: row.waba_id, is_shared: Boolean(row.is_shared), status: row.status, revision: row.revision,
      quality: row.last_verified_at ? row.quality : null, messaging_tier: row.last_verified_at ? row.messaging_tier : null,
      last_verified_at: row.last_verified_at, health_error: row.health_error, webhook_subscribed_at: row.webhook_subscribed_at,
      has_token: Boolean(row.encrypted_token), has_app_secret: Boolean(row.app_secret), has_verify_token: Boolean(row.verify_token), branches,
      assigned_branch_ids: branches.map(branch => branch.branch_id), default_branch_ids: branches.filter(branch => branch.is_default).map(branch => branch.branch_id),
      assigned_branches: branches.map(branch => branch.name).join(", "), created_at: row.created_at };
  }
  async function graphGet(path, token, params = {}) {
    try {
      const response = await transport.get(`${graphBase()}/${path}`, { headers: { Authorization: `Bearer ${token}` }, params, timeout: 15000, maxRedirects: 0, maxContentLength: 1048576 });
      return response.data;
    } catch (error) { throw Object.assign(failure("Meta could not verify this connection. Check the token, asset access and app permissions.", 502), { providerCode: Number(error.response?.data?.error?.code) || null }); }
  }
  async function inspectAssets(wabaId, phoneId, token) {
    let after;
    for (let page = 0; page < 10; page++) {
      const result = await graphGet(`${wabaId}/phone_numbers`, token, { fields: "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,status", limit: 100, ...(after ? { after } : {}) });
      if (!Array.isArray(result?.data)) throw failure("Meta returned an invalid phone-number response", 502);
      const phone = result.data.find(item => String(item.id) === phoneId);
      if (phone) {
        if (typeof phone.display_phone_number !== "string" || !phone.display_phone_number.trim()) throw failure("Meta has not returned a verified display number", 502);
        return { phoneId, displayPhone: phone.display_phone_number.slice(0, 32), name: typeof phone.verified_name === "string" ? phone.verified_name.slice(0, 255) : null,
          quality: ["GREEN", "YELLOW", "RED"].includes(phone.quality_rating) ? phone.quality_rating : "UNKNOWN",
          tier: typeof phone.messaging_limit_tier === "string" ? phone.messaging_limit_tier.slice(0, 50) : null,
          status: String(phone.status || "pending").toUpperCase() === "CONNECTED" ? "connected" : "pending" };
      }
      if (!result.paging?.next) break;
      after = result.paging.cursors?.after;
      if (typeof after !== "string" || after.length > 512) break;
    }
    throw failure("This phone number is not accessible under the selected WhatsApp Business Account", 403);
  }
  async function routing(query, tenant, input) {
    const shared = flag(input.isShared), requested = idList(input.branchIds || []), defaults = idList(input.defaultBranchIds || (input.isDefault ? requested : []));
    const active = await query("SELECT id FROM branches WHERE tenant_id=? AND status='active' ORDER BY id", [tenant]);
    const ids = requested.length ? requested : shared ? active.map(branch => branch.id) : [];
    if (!ids.length || ids.some(id => !active.some(branch => Number(branch.id) === id)) || defaults.some(id => !ids.includes(id))) throw failure("Choose active branches from this organization and defaults within that selection");
    return { shared, ids, defaults };
  }
  async function demoteDefaults(query, tenant, id, branch, user) {
    const affected = await query("SELECT s.id,s.revision FROM wa_senders s JOIN sender_branch_assignments a ON a.sender_id=s.id AND a.tenant_id=s.tenant_id WHERE a.tenant_id=? AND a.branch_id=? AND a.is_default=1 AND a.sender_id<>?", [tenant, branch, id]);
    await query("UPDATE sender_branch_assignments SET is_default=0 WHERE tenant_id=? AND branch_id=?", [tenant, branch]);
    for (const previous of affected) {
      await query("UPDATE wa_senders SET revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?", [tenant, previous.id]);
      await audit(query, tenant, user, previous.id, "branch_default_replaced", Number(previous.revision) + 1);
    }
  }
  async function replaceRouting(query, tenant, id, route, user) {
    await query("DELETE FROM sender_branch_assignments WHERE tenant_id=? AND sender_id=?", [tenant, id]);
    for (const branch of route.ids) {
      if (route.defaults.includes(branch)) await demoteDefaults(query, tenant, id, branch, user);
      await query("INSERT INTO sender_branch_assignments (tenant_id,sender_id,branch_id,is_default,routing_weight) VALUES (?,?,?,?,100)", [tenant, id, branch, Number(route.defaults.includes(branch))]);
    }
  }
  async function connect(tenant, user, input, onboarding = null) {
    const tid = positiveId(tenant), uid = positiveId(user), phoneId = metaId(input.phoneNumberId), wabaId = metaId(input.wabaId);
    if (typeof input.accessToken !== "string" || !input.accessToken.trim() || input.accessToken.length > 8000 || /[\r\n]/.test(input.accessToken)) throw failure("A valid Meta access token is required");
    for (const field of ["appSecret", "verifyToken"]) if (input[field] !== undefined && (typeof input[field] !== "string" || input[field].length > 255 || /\s/.test(input[field]))) throw failure("Webhook secrets must be text without spaces, up to 255 characters");
    const token = input.accessToken.trim(), metadata = await inspectAssets(wabaId, phoneId, token);
    const encrypted = encrypt(token);
    return transaction(async query => {
      const organization = await tenantLock(query, tid), route = await routing(query, tid, input);
      const [existing] = await query("SELECT id,tenant_id,status,revision,app_secret,verify_token FROM wa_senders WHERE phone_number_id=? FOR UPDATE", [phoneId]);
      const [waba] = await query("SELECT id,tenant_id FROM waba_connections WHERE waba_id=? FOR UPDATE", [wabaId]);
      if (existing && Number(existing.tenant_id) !== tid || waba && Number(waba.tenant_id) !== tid) throw failure("These Meta assets are already assigned to another organization", 409);
      if (input.revision !== undefined && existing && Number(input.revision) !== Number(existing.revision)) throw failure("This sender changed in another session. Reload before saving.", 409);
      if (!existing || existing.status === "disconnected") {
        const [usage] = await query("SELECT COUNT(*) AS total FROM wa_senders WHERE tenant_id=? AND status<>'disconnected'", [tid]);
        if (organization.max_senders != null && Number(usage.total) >= Number(organization.max_senders)) throw failure("Your organization's sender allowance has been reached", 409);
      }
      let wabaConnectionId = waba?.id;
      if (waba) await query("UPDATE waba_connections SET encrypted_token=?,status='connected',updated_at=NOW() WHERE tenant_id=? AND id=?", [encrypted, tid, waba.id]);
      else wabaConnectionId = (await query("INSERT INTO waba_connections (tenant_id,waba_id,partner_type,encrypted_token,status) VALUES (?,?,'direct_token',?,'connected')", [tid, wabaId, encrypted])).insertId;
      const appSecret = input.appSecret ? encrypt(input.appSecret) : existing?.app_secret || (process.env.WA_APP_SECRET ? encrypt(process.env.WA_APP_SECRET) : null);
      const verifyToken = input.verifyToken || existing?.verify_token || crypto.randomBytes(24).toString("hex");
      let id = existing?.id;
      if (existing) await query("UPDATE wa_senders SET waba_connection_id=?,display_phone=?,verified_name=?,quality=?,messaging_tier=?,is_shared=?,status=?,app_secret=?,verify_token=?,last_verified_at=NOW(),health_error=NULL,webhook_subscribed_at=NULL,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?", [wabaConnectionId, metadata.displayPhone, metadata.name, metadata.quality, metadata.tier, Number(route.shared), metadata.status, appSecret, verifyToken, tid, id]);
      else id = (await query("INSERT INTO wa_senders (tenant_id,waba_connection_id,phone_number_id,display_phone,verified_name,quality,messaging_tier,is_shared,status,app_secret,verify_token,last_verified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())", [tid, wabaConnectionId, phoneId, metadata.displayPhone, metadata.name, metadata.quality, metadata.tier, Number(route.shared), metadata.status, appSecret, verifyToken])).insertId;
      await replaceRouting(query, tid, id, route, uid);
      if (onboarding) {
        const result = await query("UPDATE meta_onboarding_sessions SET status='completed',meta_waba_id=?,meta_phone_number_id=? WHERE tenant_id=? AND user_id=? AND session_id=? AND status='processing'", [wabaId, phoneId, tid, uid, onboarding.sessionId]);
        if (!result.affectedRows) throw failure("The onboarding session changed. Start again.", 409);
      }
      const row = await publicSender(tid, id, query); await audit(query, tid, uid, id, existing ? "credentials_updated" : "connected", row.revision);
      return row;
    });
  }
  async function updateRouting(tenant, id, input, user) {
    return transaction(async query => {
      await tenantLock(query, tenant); const row = await sender(tenant, id, query, true);
      if (input.revision !== undefined && Number(input.revision) !== Number(row.revision)) throw failure("This sender changed. Reload its routing before saving.", 409);
      if (row.status === "disconnected") throw failure("Reconnect this sender before assigning branches", 409);
      const route = await routing(query, tenant, input); await replaceRouting(query, tenant, id, route, user);
      await query("UPDATE wa_senders SET is_shared=?,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?", [Number(route.shared), tenant, id]);
      await audit(query, tenant, user, id, "routing_updated", Number(row.revision) + 1); return publicSender(tenant, id, query);
    });
  }
  async function changeBranch(tenant, id, branchId, user, options = null) {
    return transaction(async query => {
      const tid = positiveId(tenant), bid = positiveId(branchId);
      await tenantLock(query, tid); const row = await sender(tid, id, query, true);
      const [branch] = await query("SELECT id FROM branches WHERE tenant_id=? AND id=? AND status='active'", [tid, bid]);
      if (!branch) throw failure("Choose an active branch in this organization");
      if (options) {
        if (row.status === "disconnected") throw failure("Reconnect this sender first", 409);
        const weight = Number(options.routingWeight ?? 100), isDefault = flag(options.isDefault, false);
        if (!Number.isInteger(weight) || weight < 1 || weight > 1000) throw failure("Routing weight must be between 1 and 1000");
        if (isDefault) await demoteDefaults(query, tid, id, bid, user);
        await query("INSERT INTO sender_branch_assignments (tenant_id,sender_id,branch_id,is_default,routing_weight) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE is_default=VALUES(is_default),routing_weight=VALUES(routing_weight)", [tid, id, bid, Number(isDefault), weight]);
      } else await query("DELETE FROM sender_branch_assignments WHERE tenant_id=? AND sender_id=? AND branch_id=?", [tid, id, bid]);
      await query("UPDATE wa_senders SET revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?", [tid, id]);
      await audit(query, tid, user, id, options ? "branch_attached" : "branch_detached", Number(row.revision) + 1);
      return { success: true };
    });
  }
  async function sync(tenant, id, user) {
    const row = await sender(tenant, id);
    if (row.status === "disconnected" || !row.encrypted_token) throw failure("Reconnect this sender before checking its status", 409);
    let metadata;
    try { metadata = await inspectAssets(row.waba_id, row.phone_number_id, decrypt(row.encrypted_token)); }
    catch (error) { await q("UPDATE wa_senders SET health_error=? WHERE tenant_id=? AND id=?", [error.message.slice(0, 255), tenant, id]); throw error; }
    return transaction(async query => {
      await tenantLock(query, tenant); const current = await sender(tenant, id, query, true);
      if (current.revision !== row.revision) throw failure("Sender settings changed during the status check. Check again.", 409);
      await query("UPDATE wa_senders SET display_phone=?,verified_name=?,quality=?,messaging_tier=?,status=?,last_verified_at=NOW(),health_error=NULL,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?", [metadata.displayPhone, metadata.name, metadata.quality, metadata.tier, metadata.status, tenant, id]);
      await audit(query, tenant, user, id, "status_checked", Number(row.revision) + 1); return publicSender(tenant, id, query);
    });
  }
  async function disconnect(tenant, id, user) {
    return transaction(async query => {
      await tenantLock(query, tenant); const row = await sender(tenant, id, query, true);
      await query("UPDATE wa_senders SET status='disconnected',app_secret=NULL,verify_token=NULL,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND id=?", [tenant, id]);
      await query("DELETE FROM sender_branch_assignments WHERE tenant_id=? AND sender_id=?", [tenant, id]);
      await query("UPDATE wa_automations SET is_active=0,revision=revision+1,updated_at=NOW() WHERE tenant_id=? AND sender_id=?", [tenant, id]);
      await query("UPDATE wa_automation_logs l JOIN wa_automations a ON a.id=l.automation_id SET l.status='skipped',l.error='Sender disconnected',l.trigger_data=NULL WHERE a.tenant_id=? AND a.sender_id=? AND l.status='scheduled'", [tenant, id]);
      const [others] = await query("SELECT COUNT(*) AS total FROM wa_senders WHERE tenant_id=? AND waba_connection_id=? AND status<>'disconnected'", [tenant, row.waba_connection_id]);
      if (!Number(others.total)) await query("UPDATE waba_connections SET encrypted_token=NULL,status='disconnected',updated_at=NOW() WHERE tenant_id=? AND id=?", [tenant, row.waba_connection_id]);
      await audit(query, tenant, user, id, "disconnected", Number(row.revision) + 1); return { success: true };
    });
  }
  async function register(tenant, id, user, input) {
    if (typeof input.pin !== "string" || !/^\d{6}$/.test(input.pin)) throw failure("Enter a six-digit two-step verification PIN");
    const row = await sender(tenant, id);
    if (row.status !== "pending" || !row.encrypted_token) throw failure("Registration is available for pending numbers with saved credentials", 409);
    try {
      const { data } = await transport.post(`${graphBase()}/${row.phone_number_id}/register`, { messaging_product: "whatsapp", pin: input.pin }, { headers: { Authorization: `Bearer ${decrypt(row.encrypted_token)}` }, timeout: 15000, maxRedirects: 0, maxContentLength: 32768 });
      if (data?.success !== true) throw new Error();
    } catch (_) { throw failure("Meta did not confirm registration. Check the PIN and the number's registration requirements in WhatsApp Manager.", 502); }
    return sync(tenant, id, user);
  }
  function setup() {
    return { embeddedSignupConfigured: Boolean((process.env.META_APP_ID || process.env.WA_APP_ID) && (process.env.META_APP_SECRET || process.env.WA_APP_SECRET) && process.env.META_EMBEDDED_CONFIG_ID),
      appId: process.env.META_APP_ID || process.env.WA_APP_ID || null, configId: process.env.META_EMBEDDED_CONFIG_ID || null, graphVersion: graphVersion(), callbackUrl: callbackUrl() };
  }
  function callbackUrl() { const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, ""); return /^https?:\/\//.test(base) ? `${base}/webhook` : null; }
  async function webhookSettings(tenant, id) { const row = await sender(tenant, id); return { callbackUrl: callbackUrl(), verifyToken: row.verify_token || null, hasAppSecret: Boolean(row.app_secret), subscribedAt: row.webhook_subscribed_at }; }
  async function subscribe(tenant, id, user) {
    const row = await sender(tenant, id);
    if (row.status === "disconnected" || !row.encrypted_token || !row.app_secret || !row.verify_token) throw failure("Save sender credentials and an app secret before subscribing", 409);
    try { const { data } = await transport.post(`${graphBase()}/${row.waba_id}/subscribed_apps`, {}, { headers: { Authorization: `Bearer ${decrypt(row.encrypted_token)}` }, timeout: 15000, maxRedirects: 0, maxContentLength: 32768 }); if (data?.success !== true) throw new Error(); }
    catch (_) { throw failure("Meta did not confirm the webhook subscription. Check your app permissions and try again.", 502); }
    return transaction(async query => {
      await tenantLock(query, tenant); const current = await sender(tenant, id, query, true);
      if (current.revision !== row.revision) throw failure("Sender changed after Meta subscribed the app. Reload its status.", 409);
      await query("UPDATE wa_senders SET webhook_subscribed_at=NOW(),revision=revision+1 WHERE tenant_id=? AND waba_connection_id=?", [tenant, row.waba_connection_id]);
      await audit(query, tenant, user, id, "webhook_subscribed", Number(row.revision) + 1); return publicSender(tenant, id, query);
    });
  }
  async function createSession(tenant, user) {
    if (!setup().embeddedSignupConfigured) throw failure("Embedded signup is not configured. Set the Meta app ID, app secret and embedded configuration ID on the server, or connect with a token.", 503);
    const sessionId = crypto.randomUUID(), stateToken = crypto.randomBytes(32).toString("hex"), expiresAt = new Date(Date.now() + 15 * 60000);
    await q("INSERT INTO meta_onboarding_sessions (session_id,tenant_id,user_id,state_token,status,expires_at) VALUES (?,?,?,?,'pending',?)", [sessionId, positiveId(tenant), positiveId(user), stateToken, expiresAt]);
    return { sessionId, stateToken, expiresAt, appId: setup().appId, configId: setup().configId, graphVersion: graphVersion() };
  }
  async function completeSession(tenant, user, input) {
    if (typeof input.sessionId !== "string" || !/^[a-f0-9-]{36}$/.test(input.sessionId) || typeof input.stateToken !== "string" || !/^[a-f0-9]{64}$/.test(input.stateToken) || typeof input.code !== "string" || !input.code.trim() || input.code.length > 4000) throw failure("A valid signup session and Meta authorization code are required");
    metaId(input.wabaId); metaId(input.phoneNumberId);
    const [session] = await q("SELECT state_token FROM meta_onboarding_sessions WHERE tenant_id=? AND user_id=? AND session_id=? AND status='pending' AND expires_at>NOW()", [tenant, user, input.sessionId]);
    if (!session || typeof session.state_token !== "string" || session.state_token.length !== 64 || !crypto.timingSafeEqual(Buffer.from(session.state_token), Buffer.from(input.stateToken))) throw failure("This signup session is invalid, expired or already used", 409);
    const claim = await q("UPDATE meta_onboarding_sessions SET status='processing' WHERE tenant_id=? AND user_id=? AND session_id=? AND status='pending' AND expires_at>NOW()", [tenant, user, input.sessionId]);
    if (!claim.affectedRows) throw failure("This signup session is already being processed", 409);
    try {
      const appId = process.env.META_APP_ID || process.env.WA_APP_ID, appSecret = process.env.META_APP_SECRET || process.env.WA_APP_SECRET;
      if (!appId || !appSecret) throw failure("Meta app credentials are not configured", 503);
      let token;
      try { const result = await transport.get(`${graphBase()}/oauth/access_token`, { params: { client_id: appId, client_secret: appSecret, code: input.code }, timeout: 15000, maxRedirects: 0, maxContentLength: 32768 }); token = result.data?.access_token; }
      catch (_) { throw failure("Meta did not exchange the authorization code. Start a new signup session.", 502); }
      if (typeof token !== "string" || !token) throw failure("Meta did not return an access token", 502);
      return await connect(tenant, user, { ...input, accessToken: token, appSecret }, { sessionId: input.sessionId });
    } catch (error) { await q("UPDATE meta_onboarding_sessions SET status='failed' WHERE tenant_id=? AND user_id=? AND session_id=? AND status='processing'", [tenant, user, input.sessionId]); throw error; }
  }
  async function list(tenant) {
    const tid = positiveId(tenant);
    const rows = await q("SELECT s.*,w.waba_id,w.encrypted_token FROM wa_senders s LEFT JOIN waba_connections w ON w.id=s.waba_connection_id AND w.tenant_id=s.tenant_id WHERE s.tenant_id=? ORDER BY s.id DESC", [tid]);
    const branches = await q("SELECT a.sender_id,a.branch_id,a.is_default,b.name,b.status FROM sender_branch_assignments a JOIN branches b ON b.id=a.branch_id AND b.tenant_id=a.tenant_id WHERE a.tenant_id=? ORDER BY b.name", [tid]);
    const grouped = new Map();
    for (const branch of branches) { const id = Number(branch.sender_id); if (!grouped.has(id)) grouped.set(id, []); grouped.get(id).push(branch); }
    return rows.map(row => serialize(row, grouped.get(Number(row.id)) || []));
  }
  async function activity(tenant, id) { await sender(tenant, id); return q("SELECT id,actor_id,action,revision,created_at FROM wa_sender_audit WHERE tenant_id=? AND sender_id=? ORDER BY id DESC LIMIT 100", [tenant, id]); }
  return { connect, updateRouting, changeBranch, sync, register, disconnect, setup, webhookSettings, subscribe, createSession, completeSession, list, detail: publicSender, activity };
}
module.exports = { createService };
