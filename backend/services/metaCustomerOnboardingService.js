"use strict";

const crypto = require("crypto");
const axios = require("axios");
const { encrypt, decrypt } = require("../backendutil/cryptoHelper");

const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const positiveId = (value, label = "Record ID") => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw failure(`A valid ${label} is required`);
  return id;
};
const metaId = value => {
  if (typeof value !== "string" || !/^\d{5,100}$/.test(value)) {
    throw failure("Enter the numeric Meta asset IDs from your business account");
  }
  return value;
};
const graphVersion = () =>
  /^v\d+\.\d+$/.test(process.env.WA_GRAPH_API_VERSION || "")
    ? process.env.WA_GRAPH_API_VERSION
    : "v22.0";
const graphBase = () => `https://graph.facebook.com/${graphVersion()}`;

function createOnboardingService(db, transport = axios) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];

  async function getMetaAppCredentials() {
    const appId = process.env.META_APP_ID || process.env.WA_APP_ID;
    const appSecret = process.env.META_APP_SECRET || process.env.WA_APP_SECRET;
    if (!appId || !appSecret) {
      throw failure("Meta App credentials are not configured on the server", 503);
    }
    return { appId, appSecret };
  }

  async function graphGet(path, token, params = {}) {
    try {
      const response = await transport.get(`${graphBase()}/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        timeout: 15000,
        maxRedirects: 0,
        maxContentLength: 1048576,
      });
      return response.data;
    } catch (error) {
      const providerMsg = error.response?.data?.error?.message;
      const providerCode = error.response?.data?.error?.code;
      const err = failure(
        providerMsg || "Meta could not verify this request. Check app permissions and tokens.",
        error.response?.status || 502
      );
      err.providerCode = providerCode;
      throw err;
    }
  }

  async function graphPost(path, token, payload = {}) {
    try {
      const response = await transport.post(`${graphBase()}/${path}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
        maxRedirects: 0,
        maxContentLength: 1048576,
      });
      return response.data;
    } catch (error) {
      const providerMsg = error.response?.data?.error?.message;
      const providerCode = error.response?.data?.error?.code;
      const err = failure(
        providerMsg || "Meta rejected the operation.",
        error.response?.status || 502
      );
      err.providerCode = providerCode;
      throw err;
    }
  }

  /**
   * Exchanges authorization code from Facebook Login for Business & WhatsApp Embedded Signup.
   * Discovers user profile and saves active connection under the tenant.
   */
  async function exchangeAndAuthorize(tenantId, userId, { code, sessionId, stateToken }) {
    const tid = positiveId(tenantId, "organization ID");
    const uid = positiveId(userId, "user ID");

    if (sessionId && stateToken) {
      const [session] = await q(
        "SELECT state_token FROM meta_onboarding_sessions WHERE tenant_id=? AND user_id=? AND session_id=? AND status='pending' AND expires_at>NOW()",
        [tid, uid, sessionId]
      );
      if (
        !session ||
        typeof session.state_token !== "string" ||
        session.state_token.length !== 64 ||
        !crypto.timingSafeEqual(Buffer.from(session.state_token), Buffer.from(stateToken))
      ) {
        throw failure("This signup session is invalid, expired or already completed", 409);
      }
      await q(
        "UPDATE meta_onboarding_sessions SET status='processing' WHERE tenant_id=? AND user_id=? AND session_id=?",
        [tid, uid, sessionId]
      );
    }

    const { appId, appSecret } = await getMetaAppCredentials();
    let tokenData;
    try {
      const res = await transport.get(`${graphBase()}/oauth/access_token`, {
        params: { client_id: appId, client_secret: appSecret, code },
        timeout: 15000,
        maxRedirects: 0,
        maxContentLength: 32768,
      });
      tokenData = res.data;
    } catch (err) {
      throw failure("Meta could not exchange the authorization code. Start a new signup session.", 502);
    }

    const accessToken = tokenData?.access_token;
    if (!accessToken || typeof accessToken !== "string") {
      throw failure("Meta did not return a valid access token", 502);
    }

    let metaUser = { id: null, name: null, email: null };
    try {
      metaUser = await graphGet("me", accessToken, { fields: "id,name,email" });
    } catch (_) {}

    let scopes = null;
    let tokenExpiresAt = null;
    if (tokenData.expires_in) {
      tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString().slice(0, 19).replace("T", " ");
    }

    const encryptedToken = encrypt(accessToken);

    // Upsert meta_connections for this tenant
    const [existing] = await q(
      "SELECT id FROM meta_connections WHERE tenant_id=? AND (meta_user_id=? OR id IS NOT NULL) ORDER BY id DESC LIMIT 1",
      [tid, metaUser.id || ""]
    );

    let connectionId;
    if (existing) {
      connectionId = existing.id;
      await q(
        "UPDATE meta_connections SET meta_user_id=?, meta_user_name=?, meta_user_email=?, encrypted_access_token=?, scopes=?, token_expires_at=?, status='active', updated_at=NOW() WHERE id=?",
        [metaUser.id, metaUser.name, metaUser.email, encryptedToken, scopes, tokenExpiresAt, connectionId]
      );
    } else {
      const res = await q(
        "INSERT INTO meta_connections (tenant_id, meta_user_id, meta_user_name, meta_user_email, encrypted_access_token, scopes, token_expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')",
        [tid, metaUser.id, metaUser.name, metaUser.email, encryptedToken, scopes, tokenExpiresAt]
      );
      connectionId = res.insertId;
    }

    if (sessionId) {
      await q(
        "UPDATE meta_onboarding_sessions SET status='completed' WHERE tenant_id=? AND user_id=? AND session_id=?",
        [tid, uid, sessionId]
      );
    }

    return {
      connectionId,
      metaUserId: metaUser.id,
      metaUserName: metaUser.name,
      metaUserEmail: metaUser.email,
      tokenExpiresAt,
      accessToken, // Returned ephemerally for immediate asset discovery in same flow
    };
  }

  /**
   * Discover portfolios, WABAs, and all phone numbers under the authorized Meta account.
   */
  async function discoverAssets(tenantId, { connectionId = null, directToken = null, targetWabaId = null }) {
    const tid = positiveId(tenantId, "organization ID");

    let token = directToken;
    let connId = connectionId;
    if (!token) {
      const [conn] = await q(
        "SELECT id, encrypted_access_token, meta_user_name FROM meta_connections WHERE tenant_id=? " +
        (connId ? "AND id=? " : "") +
        "AND status='active' ORDER BY id DESC LIMIT 1",
        connId ? [tid, connId] : [tid]
      );
      if (!conn || !conn.encrypted_access_token) {
        throw failure("No active Meta connection found for this organization. Authorize via Meta first.", 404);
      }
      connId = conn.id;
      token = decrypt(conn.encrypted_access_token);
    }

    // 1. Fetch user's business portfolios
    let businesses = [];
    try {
      const bRes = await graphGet("me/businesses", token, {
        fields: "id,name,verification_status",
        limit: 50,
      });
      if (Array.isArray(bRes?.data)) businesses = bRes.data;
    } catch (_) {}

    // Upsert business portfolios
    for (const b of businesses) {
      await q(
        `INSERT INTO meta_business_portfolios (tenant_id, meta_connection_id, meta_business_id, name, verification_status, sharing_status)
         VALUES (?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE name=VALUES(name), verification_status=VALUES(verification_status), updated_at=NOW()`,
        [tid, connId, String(b.id), b.name || "Meta Business Portfolio", b.verification_status || "not_verified"]
      ).catch(() => {});
    }

    // 2. Discover client WABAs
    const discoveredWabas = new Map();

    if (targetWabaId) {
      try {
        const wRes = await graphGet(metaId(targetWabaId), token, {
          fields: "id,name,currency,timezone_id,message_template_namespace",
        });
        if (wRes?.id) discoveredWabas.set(String(wRes.id), wRes);
      } catch (_) {}
    }

    for (const b of businesses) {
      try {
        const cwRes = await graphGet(`${b.id}/client_whatsapp_business_accounts`, token, {
          fields: "id,name,currency,timezone_id,message_template_namespace",
          limit: 50,
        });
        if (Array.isArray(cwRes?.data)) {
          cwRes.data.forEach(w => discoveredWabas.set(String(w.id), { ...w, businessId: b.id }));
        }
      } catch (_) {}

      try {
        const owRes = await graphGet(`${b.id}/whatsapp_business_accounts`, token, {
          fields: "id,name,currency,timezone_id,message_template_namespace",
          limit: 50,
        });
        if (Array.isArray(owRes?.data)) {
          owRes.data.forEach(w => {
            if (!discoveredWabas.has(String(w.id))) {
              discoveredWabas.set(String(w.id), { ...w, businessId: b.id });
            }
          });
        }
      } catch (_) {}
    }

    // 3. For each WABA, discover all phone numbers
    const existingSenders = await q(
      "SELECT phone_number_id, id, status, is_default, department_name FROM wa_senders WHERE tenant_id=?",
      [tid]
    );
    const existingMap = new Map((existingSenders || []).map(s => [s.phone_number_id, s]));

    const resultWabas = [];

    for (const [wId, wData] of discoveredWabas.entries()) {
      let phoneNumbers = [];
      try {
        const pRes = await graphGet(`${wId}/phone_numbers`, token, {
          fields: "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status,status",
          limit: 100,
        });
        if (Array.isArray(pRes?.data)) {
          phoneNumbers = pRes.data.map(p => {
            const existing = existingMap.get(String(p.id));
            return {
              id: String(p.id),
              displayPhone: p.display_phone_number || "",
              verifiedName: p.verified_name || "",
              quality: p.quality_rating || "UNKNOWN",
              messagingTier: p.messaging_limit_tier || "TIER_250",
              codeVerificationStatus: p.code_verification_status || "NOT_VERIFIED",
              status: String(p.status || "pending").toLowerCase(),
              alreadyConnected: Boolean(existing && existing.status === "connected"),
              senderId: existing ? existing.id : null,
              isDefault: Boolean(existing?.is_default),
              departmentName: existing?.department_name || null,
            };
          });
        }
      } catch (_) {}

      resultWabas.push({
        id: wId,
        name: wData.name || `WhatsApp Account ${wId}`,
        currency: wData.currency || "INR",
        timezoneId: wData.timezone_id || "Asia/Kolkata",
        messageTemplateNamespace: wData.message_template_namespace || null,
        phoneNumbers,
      });
    }

    return {
      connectionId: connId,
      portfolios: businesses.map(b => ({
        id: String(b.id),
        name: b.name,
        verificationStatus: b.verification_status,
      })),
      wabas: resultWabas,
    };
  }

  /**
   * Connect multiple discovered phone numbers concurrently under the tenant.
   * Registers WABA webhook subscription automatically.
   */
  async function connectDiscoveredNumbers(tenantId, userId, { wabaId, numbers = [], branchIds = [], isShared = true, accessToken = null, appSecret = null }) {
    const tid = positiveId(tenantId, "organization ID");
    const uid = positiveId(userId, "user ID");
    const cleanWabaId = metaId(wabaId);

    if (!Array.isArray(numbers) || !numbers.length) {
      throw failure("Select at least one phone number to connect");
    }

    let token = accessToken;
    if (!token) {
      const [conn] = await q(
        "SELECT encrypted_access_token FROM meta_connections WHERE tenant_id=? AND status='active' ORDER BY id DESC LIMIT 1",
        [tid]
      );
      if (conn?.encrypted_access_token) token = decrypt(conn.encrypted_access_token);
    }
    if (!token) {
      const [waba] = await q(
        "SELECT encrypted_token FROM waba_connections WHERE tenant_id=? AND waba_id=? LIMIT 1",
        [tid, cleanWabaId]
      );
      if (waba?.encrypted_token) token = decrypt(waba.encrypted_token);
    }
    if (!token) throw failure("A valid Meta access token is required for connection", 400);

    const encryptedToken = encrypt(token);
    const configuredAppSecret = appSecret || process.env.META_APP_SECRET || process.env.WA_APP_SECRET || "";
    const encryptedSecret = configuredAppSecret ? encrypt(configuredAppSecret) : null;

    // 1. Ensure WABA connection is persisted
    const [existingWaba] = await q(
      "SELECT id FROM waba_connections WHERE waba_id=? LIMIT 1",
      [cleanWabaId]
    );

    let wabaConnectionId;
    if (existingWaba) {
      wabaConnectionId = existingWaba.id;
      await q(
        "UPDATE waba_connections SET encrypted_token=?, status='connected', updated_at=NOW() WHERE id=?",
        [encryptedToken, wabaConnectionId]
      );
    } else {
      const wabaInsert = await q(
        "INSERT INTO waba_connections (tenant_id, waba_id, partner_type, encrypted_token, status) VALUES (?, ?, 'embedded_signup', ?, 'connected')",
        [tid, cleanWabaId, encryptedToken]
      );
      wabaConnectionId = wabaInsert.insertId;
    }

    // 2. Subscribe WABA to webhook app
    try {
      await graphPost(`${cleanWabaId}/subscribed_apps`, token, {});
    } catch (subErr) {
      console.warn(`[Meta Onboarding] Webhook auto-subscribe warning for WABA ${cleanWabaId}: ${subErr.message}`);
    }

    const connectedSenders = [];

    // 3. Connect each selected phone number
    for (const num of numbers) {
      const phoneId = metaId(num.phoneId || num.id);
      const displayPhone = String(num.displayPhone || num.display_phone_number || "").slice(0, 32);
      const verifiedName = String(num.verifiedName || num.verified_name || "").slice(0, 255);
      const quality = ["GREEN", "YELLOW", "RED"].includes(num.quality) ? num.quality : "GREEN";
      const messagingTier = num.messagingTier || "TIER_250";
      const codeVerificationStatus = num.codeVerificationStatus || "NOT_VERIFIED";
      const departmentName = num.departmentName ? String(num.departmentName).slice(0, 100) : null;
      const isDefault = Boolean(num.isDefault);
      const verifyToken = crypto.randomBytes(24).toString("hex");

      const [existingSender] = await q(
        "SELECT id, tenant_id FROM wa_senders WHERE phone_number_id=? LIMIT 1",
        [phoneId]
      );
      if (existingSender && Number(existingSender.tenant_id) !== tid) {
        throw failure(`Phone number ${displayPhone} is already connected to another organization`, 409);
      }

      let senderId;
      if (existingSender) {
        senderId = existingSender.id;
        await q(
          `UPDATE wa_senders SET
            waba_connection_id=?, display_phone=?, verified_name=?, quality=?, messaging_tier=?,
            code_verification_status=?, department_name=?, is_default=?, is_shared=?, status='connected',
            app_secret=COALESCE(?, app_secret), verify_token=COALESCE(verify_token, ?),
            last_verified_at=NOW(), health_error=NULL, webhook_subscribed_at=NOW(), revision=revision+1, updated_at=NOW()
           WHERE id=? AND tenant_id=?`,
          [
            wabaConnectionId, displayPhone, verifiedName, quality, messagingTier,
            codeVerificationStatus, departmentName, Number(isDefault), Number(Boolean(isShared)),
            encryptedSecret, verifyToken, senderId, tid
          ]
        );
      } else {
        const senderInsert = await q(
          `INSERT INTO wa_senders (
            tenant_id, waba_connection_id, phone_number_id, display_phone, verified_name,
            quality, messaging_tier, code_verification_status, department_name, is_default,
            is_shared, status, app_secret, verify_token, last_verified_at, webhook_subscribed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', ?, ?, NOW(), NOW())`,
          [
            tid, wabaConnectionId, phoneId, displayPhone, verifiedName,
            quality, messagingTier, codeVerificationStatus, departmentName, Number(isDefault),
            Number(Boolean(isShared)), encryptedSecret, verifyToken
          ]
        );
        senderId = senderInsert.insertId;
      }

      // If marked default, demote any other default senders for this tenant
      if (isDefault) {
        await q(
          "UPDATE wa_senders SET is_default=0 WHERE tenant_id=? AND id<>?",
          [tid, senderId]
        );
      }

      // Branch routing
      if (branchIds && branchIds.length) {
        await q("DELETE FROM sender_branch_assignments WHERE tenant_id=? AND sender_id=?", [tid, senderId]);
        for (const bid of branchIds) {
          await q(
            "INSERT INTO sender_branch_assignments (tenant_id, sender_id, branch_id, is_default, routing_weight) VALUES (?, ?, ?, 1, 100)",
            [tid, senderId, Number(bid)]
          ).catch(() => {});
        }
      }

      await q(
        "INSERT INTO wa_sender_audit (tenant_id, sender_id, actor_id, action, revision, details) VALUES (?, ?, ?, 'connected_via_onboarding', 1, ?)",
        [tid, senderId, uid, JSON.stringify({ phoneId, displayPhone, wabaId: cleanWabaId })]
      );

      connectedSenders.push({
        id: senderId,
        phoneId,
        displayPhone,
        verifiedName,
        quality,
        messagingTier,
        isDefault,
        departmentName,
      });
    }

    return {
      wabaId: cleanWabaId,
      totalConnected: connectedSenders.length,
      senders: connectedSenders,
    };
  }

  /**
   * Ping sender to verify live Meta API connectivity and measure latency.
   */
  async function pingSender(tenantId, senderId) {
    const tid = positiveId(tenantId, "organization ID");
    const sid = positiveId(senderId, "sender ID");

    const [sender] = await q(
      `SELECT s.*, w.encrypted_token, w.waba_id
       FROM wa_senders s
       JOIN waba_connections w ON w.id=s.waba_connection_id AND w.tenant_id=s.tenant_id
       WHERE s.tenant_id=? AND s.id=? LIMIT 1`,
      [tid, sid]
    );

    if (!sender) throw failure("WhatsApp sender not found", 404);
    if (!sender.encrypted_token) throw failure("Sender has no active credentials saved", 409);

    const token = decrypt(sender.encrypted_token);
    const start = Date.now();

    try {
      const live = await graphGet(sender.phone_number_id, token, {
        fields: "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status,status",
      });
      const latencyMs = Date.now() - start;

      const quality = live.quality_rating || sender.quality || "GREEN";
      const tier = live.messaging_limit_tier || sender.messaging_tier || "TIER_250";
      const codeStatus = live.code_verification_status || sender.code_verification_status || "VERIFIED";

      await q(
        `UPDATE wa_senders SET
          last_ping_at=NOW(), last_ping_status='healthy', quality=?, messaging_tier=?,
          code_verification_status=?, last_verified_at=NOW(), health_error=NULL, updated_at=NOW()
         WHERE id=?`,
        [quality, tier, codeStatus, sid]
      );

      return {
        success: true,
        latencyMs,
        phoneId: sender.phone_number_id,
        displayPhone: live.display_phone_number || sender.display_phone,
        verifiedName: live.verified_name || sender.verified_name,
        quality,
        messagingTier: tier,
        codeVerificationStatus: codeStatus,
        status: String(live.status || "connected").toLowerCase(),
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errorMsg = (err.message || "Meta API check failed").slice(0, 255);
      await q(
        "UPDATE wa_senders SET last_ping_at=NOW(), last_ping_status='error', health_error=? WHERE id=?",
        [errorMsg, sid]
      );
      throw failure(`Ping failed (${latencyMs}ms): ${errorMsg}`, 502);
    }
  }

  /**
   * Diagnostic test send: real Cloud API dispatch verifying message sending.
   */
  async function sendTestMessage(tenantId, senderId, { recipientPhone, messageText = "Madhura WhatsApp Business: Test ping verified!" }) {
    const tid = positiveId(tenantId, "organization ID");
    const sid = positiveId(senderId, "sender ID");
    if (!recipientPhone || typeof recipientPhone !== "string") {
      throw failure("A valid recipient phone number is required for test send");
    }

    const cleanPhone = recipientPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) throw failure("Recipient phone number must contain at least 10 digits");

    const [sender] = await q(
      `SELECT s.*, w.encrypted_token
       FROM wa_senders s
       JOIN waba_connections w ON w.id=s.waba_connection_id AND w.tenant_id=s.tenant_id
       WHERE s.tenant_id=? AND s.id=? AND s.status='connected' LIMIT 1`,
      [tid, sid]
    );

    if (!sender) throw failure("Connected WhatsApp sender not found", 404);
    const token = decrypt(sender.encrypted_token);

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone,
      type: "text",
      text: { preview_url: false, body: messageText },
    };

    let metaRes;
    try {
      metaRes = await graphPost(`${sender.phone_number_id}/messages`, token, payload);
    } catch (err) {
      throw failure(`Meta message dispatch failed: ${err.message}`, 502);
    }

    const metaMsgId = metaRes?.messages?.[0]?.id || `wamid.test_${Date.now()}`;

    // Record test message log
    await q(
      `INSERT INTO wa_message_logs (
        tenant_id, sender_id, phone, direction, message_type, message_text,
        wa_message_id, status, created_at
      ) VALUES (?, ?, ?, 'outbound', 'text', ?, ?, 'sent', NOW())`,
      [tid, sid, cleanPhone, messageText, metaMsgId]
    ).catch(() => {});

    return {
      success: true,
      metaMessageId: metaMsgId,
      senderId: sid,
      displayPhone: sender.display_phone,
      recipient: cleanPhone,
      status: "sent",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    exchangeAndAuthorize,
    discoverAssets,
    connectDiscoveredNumbers,
    pingSender,
    sendTestMessage,
    getMetaAppCredentials,
  };
}

module.exports = { createOnboardingService };
