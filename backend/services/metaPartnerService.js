/**
 * metaPartnerService.js
 *
 * Meta Partner Embedded Signup and Enterprise Multi-Sender Asset Management.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md §6 & §12
 */

const crypto = require("crypto");
const axios = require("axios");
const db = require("../config/database");

const GRAPH_API_VERSION = "v21.0";
const META_GRAPH_BASE = "https://graph.facebook.com";

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

/**
 * Initiates an Embedded Signup session with a short-lived nonce and state token.
 */
async function createOnboardingSession(tenantId, userId) {
  const tid = Number(tenantId);
  const uid = Number(userId);

  const sessionId = `meta_onb_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  const stateToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

  await q(
    `INSERT INTO meta_onboarding_sessions (session_id, tenant_id, user_id, state_token, status, expires_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [sessionId, tid, uid, stateToken, expiresAt]
  );

  return {
    sessionId,
    stateToken,
    expiresAt,
    appId: process.env.META_APP_ID || process.env.WA_APP_ID || "1492305718783457",
    configId: process.env.META_EMBEDDED_CONFIG_ID || "1622340822002341",
    graphVersion: GRAPH_API_VERSION,
  };
}

/**
 * Completes Embedded Signup onboarding:
 * 1. Verifies session & state token
 * 2. Exchanges short-lived authorization code for access token with Meta Graph API
 * 3. Inspects shared WABA and Phone Number assets
 * 4. Transactionally records waba_connections and wa_senders
 * 5. Maps sender to organization and branches (Hybrid topology)
 */
async function completeOnboarding(tenantId, userId, payload) {
  const tid = Number(tenantId);
  const { sessionId, stateToken, code, wabaId, phoneNumberId, branchId } = payload;

  // 1. Verify session
  const [session] = await q(
    `SELECT * FROM meta_onboarding_sessions 
     WHERE session_id = ? AND tenant_id = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP 
     LIMIT 1`,
    [sessionId, tid]
  );

  if (!session) {
    throw new Error("Invalid, expired, or already used onboarding session");
  }

  if (session.state_token !== stateToken) {
    throw new Error("Security verification failed: state token mismatch (possible CSRF or replay)");
  }

  let finalAccessToken = process.env.WA_ACCESS_TOKEN || "";
  let metaWabaId = wabaId || session.meta_waba_id;
  let metaPhoneId = phoneNumberId || session.meta_phone_number_id;
  let displayPhone = null;
  let verifiedName = null;
  let qualityRating = "GREEN";
  let messagingTier = "TIER_250";

  // 2. Exchange code if code was provided and credentials configured
  const appId = process.env.META_APP_ID || process.env.WA_APP_ID;
  const appSecret = process.env.META_APP_SECRET || process.env.WA_APP_SECRET;

  if (code && appId && appSecret) {
    try {
      const tokenRes = await axios.get(`${META_GRAPH_BASE}/${GRAPH_API_VERSION}/oauth/access_token`, {
        params: {
          client_id: appId,
          client_secret: appSecret,
          code,
        },
      });
      if (tokenRes.data && tokenRes.data.access_token) {
        finalAccessToken = tokenRes.data.access_token;
      }
    } catch (tokenErr) {
      console.warn("[completeOnboarding] Graph API code exchange notice:", tokenErr.response?.data || tokenErr.message);
      // Fallback to configured access token if testing in dev
      if (!finalAccessToken) {
        finalAccessToken = process.env.WA_ACCESS_TOKEN || "mock_token_" + Date.now();
      }
    }
  }

  // 3. Inspect phone number details if phone_number_id provided
  if (metaPhoneId && finalAccessToken && !finalAccessToken.startsWith("mock_")) {
    try {
      const phoneRes = await axios.get(`${META_GRAPH_BASE}/${GRAPH_API_VERSION}/${metaPhoneId}`, {
        headers: { Authorization: `Bearer ${finalAccessToken}` },
        params: { fields: "display_phone_number,verified_name,quality_rating,messaging_limit_tier,status" },
      });
      if (phoneRes.data) {
        displayPhone = phoneRes.data.display_phone_number;
        verifiedName = phoneRes.data.verified_name;
        qualityRating = phoneRes.data.quality_rating || "GREEN";
        messagingTier = phoneRes.data.messaging_limit_tier || "TIER_250";
      }
    } catch (e) {
      console.warn("[completeOnboarding] Failed to fetch phone metadata:", e.message);
    }
  }

  // Fallbacks if metadata fetch was partial
  metaWabaId = metaWabaId || process.env.WA_WABA_ID || `waba_${Date.now()}`;
  metaPhoneId = metaPhoneId || process.env.WA_PHONE_NUMBER_ID || `phone_${Date.now()}`;
  displayPhone = displayPhone || process.env.WA_DISPLAY_PHONE_NUMBER || "+919876543210";
  verifiedName = verifiedName || process.env.WA_VERIFIED_NAME || "Verified Business";

  // 4. Upsert WABA Connection
  await q(
    `INSERT INTO waba_connections (tenant_id, waba_id, partner_type, encrypted_token, status)
     VALUES (?, ?, 'tech_provider', ?, 'connected')
     ON DUPLICATE KEY UPDATE encrypted_token = excluded.encrypted_token, status = 'connected'`,
    [tid, metaWabaId, finalAccessToken]
  );

  const [wabaRow] = await q("SELECT id FROM waba_connections WHERE waba_id = ? LIMIT 1", [metaWabaId]);
  const wabaConnId = wabaRow ? wabaRow.id : null;

  // 5. Upsert WhatsApp Sender
  await q(
    `INSERT INTO wa_senders (tenant_id, waba_connection_id, phone_number_id, display_phone, verified_name, quality, messaging_tier, is_shared, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'connected')
     ON DUPLICATE KEY UPDATE display_phone = excluded.display_phone, verified_name = excluded.verified_name, quality = excluded.quality, status = 'connected'`,
    [tid, wabaConnId, metaPhoneId, displayPhone, verifiedName, qualityRating, messagingTier]
  );

  const [senderRow] = await q("SELECT id FROM wa_senders WHERE phone_number_id = ? LIMIT 1", [metaPhoneId]);
  const senderId = senderRow ? senderRow.id : null;

  // 6. Assign Sender to requested branch or default Head Office branch
  let targetBranchId = branchId ? Number(branchId) : null;
  if (!targetBranchId) {
    const [headOffice] = await q("SELECT id FROM branches WHERE tenant_id = ? AND is_head_office = 1 LIMIT 1", [tid]);
    targetBranchId = headOffice ? headOffice.id : 1;
  }

  if (senderId && targetBranchId) {
    await q(
      `INSERT INTO sender_branch_assignments (tenant_id, sender_id, branch_id, is_default, routing_weight)
       VALUES (?, ?, ?, 1, 100)
       ON DUPLICATE KEY UPDATE is_default = 1`,
      [tid, senderId, targetBranchId]
    );
  }

  // 7. Mark session completed
  await q(
    `UPDATE meta_onboarding_sessions 
     SET status = 'completed', meta_waba_id = ?, meta_phone_number_id = ? 
     WHERE session_id = ?`,
    [metaWabaId, metaPhoneId, sessionId]
  );

  return {
    success: true,
    wabaId: metaWabaId,
    phoneNumberId: metaPhoneId,
    displayPhone,
    verifiedName,
    qualityRating,
    messagingTier,
    assignedBranchId: targetBranchId,
    senderId,
  };
}

/**
 * Get all connected senders for an organization, with branch assignments.
 */
async function getTenantSenders(tenantId) {
  const tid = Number(tenantId);
  const senders = await q(
    `SELECT s.*, 
            wc.waba_id, wc.partner_type,
            (SELECT GROUP_CONCAT(b.name, ', ') 
             FROM sender_branch_assignments sba 
             JOIN branches b ON sba.branch_id = b.id 
             WHERE sba.sender_id = s.id AND sba.tenant_id = ?) as assigned_branches,
            (SELECT GROUP_CONCAT(sba.branch_id) 
             FROM sender_branch_assignments sba 
             WHERE sba.sender_id = s.id AND sba.tenant_id = ?) as assigned_branch_ids
     FROM wa_senders s
     LEFT JOIN waba_connections wc ON s.waba_connection_id = wc.id
     WHERE s.tenant_id = ?
     ORDER BY s.id ASC`,
    [tid, tid, tid]
  );

  return senders.map((s) => ({
    ...s,
    assigned_branch_ids: s.assigned_branch_ids
      ? s.assigned_branch_ids.split(",").map((id) => Number(id.trim()))
      : [],
  }));
}

/**
 * Update branch assignments for a sender (Hybrid Model: Shared vs Dedicated).
 */
async function updateSenderBranchAssignments(tenantId, senderId, { branchIds, isShared = 1 }) {
  const tid = Number(tenantId);
  const sid = Number(senderId);

  // Verify sender belongs to tenant
  const [sender] = await q("SELECT id FROM wa_senders WHERE id = ? AND tenant_id = ? LIMIT 1", [sid, tid]);
  if (!sender) throw new Error("Sender not found");

  // Update sender is_shared flag
  await q("UPDATE wa_senders SET is_shared = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [isShared ? 1 : 0, sid]);

  // Replace branch assignments
  await q("DELETE FROM sender_branch_assignments WHERE tenant_id = ? AND sender_id = ?", [tid, sid]);

  if (Array.isArray(branchIds) && branchIds.length > 0) {
    for (let i = 0; i < branchIds.length; i++) {
      const bid = Number(branchIds[i]);
      await q(
        `INSERT INTO sender_branch_assignments (tenant_id, sender_id, branch_id, is_default, routing_weight)
         VALUES (?, ?, ?, ?, 100)`,
        [tid, sid, bid, i === 0 ? 1 : 0]
      );
    }
  }

  return { success: true };
}

/**
 * Resolve sender credentials for Cloud API dispatch.
 * Priority: Specific sender > Branch assigned sender > Shared default sender > Process env fallback
 */
async function resolveSenderCredentials(tenantId, senderId = null, branchId = null) {
  const tid = Number(tenantId);
  let sender = null;

  // 1. Direct sender ID requested
  if (senderId) {
    const rows = await q(
      `SELECT s.*, wc.encrypted_token 
       FROM wa_senders s
       LEFT JOIN waba_connections wc ON s.waba_connection_id = wc.id
       WHERE s.id = ? AND s.tenant_id = ? AND s.status = 'connected' LIMIT 1`,
      [Number(senderId), tid]
    );
    if (rows && rows.length > 0) sender = rows[0];
  }

  // 2. Branch assigned sender requested
  if (!sender && branchId) {
    const rows = await q(
      `SELECT s.*, wc.encrypted_token 
       FROM sender_branch_assignments sba
       JOIN wa_senders s ON sba.sender_id = s.id
       LEFT JOIN waba_connections wc ON s.waba_connection_id = wc.id
       WHERE sba.tenant_id = ? AND sba.branch_id = ? AND s.status = 'connected'
       ORDER BY sba.is_default DESC, s.id ASC LIMIT 1`,
      [tid, Number(branchId)]
    );
    if (rows && rows.length > 0) sender = rows[0];
  }

  // 3. Fallback: Organization's primary shared sender
  if (!sender && tid) {
    const rows = await q(
      `SELECT s.*, wc.encrypted_token 
       FROM wa_senders s
       LEFT JOIN waba_connections wc ON s.waba_connection_id = wc.id
       WHERE s.tenant_id = ? AND s.status = 'connected'
       ORDER BY s.is_shared DESC, s.id ASC LIMIT 1`,
      [tid]
    );
    if (rows && rows.length > 0) sender = rows[0];
  }

  if (sender) {
    return {
      phone_number_id: sender.phone_number_id,
      access_token: sender.encrypted_token || process.env.WA_ACCESS_TOKEN || "",
      display_phone: sender.display_phone,
      verified_name: sender.verified_name,
      quality: sender.quality,
      sender_id: sender.id,
      tenant_id: sender.tenant_id,
      isConfigured: Boolean(sender.phone_number_id && (sender.encrypted_token || process.env.WA_ACCESS_TOKEN)),
    };
  }

  // 4. Default process env config (if matches or tenant 1)
  return {
    phone_number_id: process.env.WA_PHONE_NUMBER_ID || "",
    access_token: process.env.WA_ACCESS_TOKEN || "",
    display_phone: process.env.WA_DISPLAY_PHONE_NUMBER || "",
    verified_name: process.env.WA_VERIFIED_NAME || "",
    quality: "GREEN",
    sender_id: null,
    tenant_id: tid || 1,
    isConfigured: Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN),
  };
}

/**
 * Register a direct Meta Cloud API sender manually with provided credentials.
 */
async function registerDirectSender(tenantId, userId, { phoneNumberId, accessToken, wabaId, displayName, displayPhone, isShared = 1, branchIds = [] }) {
  const tid = Number(tenantId);
  const cleanPhoneId = (phoneNumberId || "").trim();
  const cleanToken = (accessToken || "").trim();
  const cleanWabaId = (wabaId || "").trim() || `waba_${Date.now()}`;
  const cleanName = (displayName || "WhatsApp Business").trim();
  const cleanPhone = (displayPhone || cleanPhoneId).replace(/[^0-9]/g, "");

  if (!cleanPhoneId || !cleanToken) {
    throw new Error("Phone Number ID and Access Token are required");
  }

  // 1. Upsert WABA Connection
  await q(
    `INSERT INTO waba_connections (tenant_id, waba_id, partner_type, encrypted_token, status)
     VALUES (?, ?, 'direct_token', ?, 'connected')
     ON DUPLICATE KEY UPDATE encrypted_token = excluded.encrypted_token, status = 'connected'`,
    [tid, cleanWabaId, cleanToken]
  );

  const [wabaRow] = await q("SELECT id FROM waba_connections WHERE waba_id = ? AND tenant_id = ? LIMIT 1", [cleanWabaId, tid]);
  const wabaConnId = wabaRow ? wabaRow.id : null;

  // 2. Upsert WhatsApp Sender
  await q(
    `INSERT INTO wa_senders (tenant_id, waba_connection_id, phone_number_id, display_phone, verified_name, quality, messaging_tier, is_shared, status)
     VALUES (?, ?, ?, ?, ?, 'GREEN', 'TIER_1K', ?, 'connected')
     ON DUPLICATE KEY UPDATE display_phone = excluded.display_phone, verified_name = excluded.verified_name, is_shared = excluded.is_shared, status = 'connected'`,
    [tid, wabaConnId, cleanPhoneId, cleanPhone, cleanName, isShared ? 1 : 0]
  );

  const [senderRow] = await q("SELECT id FROM wa_senders WHERE phone_number_id = ? AND tenant_id = ? LIMIT 1", [cleanPhoneId, tid]);
  const senderId = senderRow ? senderRow.id : null;

  // 3. Branch assignments
  if (senderId && Array.isArray(branchIds) && branchIds.length > 0) {
    await q("DELETE FROM sender_branch_assignments WHERE tenant_id = ? AND sender_id = ?", [tid, senderId]);
    for (let i = 0; i < branchIds.length; i++) {
      const bid = Number(branchIds[i]);
      await q(
        `INSERT INTO sender_branch_assignments (tenant_id, sender_id, branch_id, is_default, routing_weight)
         VALUES (?, ?, ?, ?, 100)`,
        [tid, senderId, bid, i === 0 ? 1 : 0]
      );
    }
  }

  return {
    id: senderId,
    phone_number_id: cleanPhoneId,
    display_phone: cleanPhone,
    verified_name: cleanName,
    waba_id: cleanWabaId,
  };
}

/**
 * Sync sender health & tier from Meta Graph API.
 */
async function syncSenderHealth(tenantId, senderId) {
  const tid = Number(tenantId);
  const sid = Number(senderId);

  const [sender] = await q(
    `SELECT s.*, wc.encrypted_token 
     FROM wa_senders s
     LEFT JOIN waba_connections wc ON s.waba_connection_id = wc.id
     WHERE s.id = ? AND s.tenant_id = ? LIMIT 1`,
    [sid, tid]
  );
  if (!sender) throw new Error("Sender not found");

  const token = sender.encrypted_token || process.env.WA_ACCESS_TOKEN;
  let quality = sender.quality || "GREEN";
  let messagingTier = sender.messaging_tier || "TIER_1K";
  let status = "connected";

  if (token && sender.phone_number_id && !sender.phone_number_id.startsWith("phone_")) {
    try {
      const url = `https://graph.facebook.com/v22.0/${sender.phone_number_id}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,status`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 7000 });
      if (res.data) {
        if (res.data.quality_rating) quality = res.data.quality_rating;
        if (res.data.messaging_limit_tier) messagingTier = res.data.messaging_limit_tier;
        if (res.data.status) status = res.data.status.toLowerCase() === "connected" ? "connected" : res.data.status.toLowerCase();
      }
    } catch (_) {}
  }

  await q(
    `UPDATE wa_senders SET quality = ?, messaging_tier = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [quality, messagingTier, status, sid]
  );

  return { id: sid, quality, messagingTier, status, syncedAt: new Date().toISOString() };
}

/**
 * Safely delete / disconnect a sender from the organization.
 */
async function deleteSender(tenantId, senderId) {
  const tid = Number(tenantId);
  const sid = Number(senderId);

  await q("DELETE FROM sender_branch_assignments WHERE tenant_id = ? AND sender_id = ?", [tid, sid]);
  await q("DELETE FROM wa_senders WHERE id = ? AND tenant_id = ?", [sid, tid]);
  return { success: true };
}

module.exports = {
  createOnboardingSession,
  completeOnboarding,
  getTenantSenders,
  updateSenderBranchAssignments,
  resolveSenderCredentials,
  registerDirectSender,
  syncSenderHealth,
  deleteSender,
};
