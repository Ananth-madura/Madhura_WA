"use strict";

/**
 * providerGateway.js — Madhura WhatsApp Provider Gateway
 *
 * Unified, strictly tenant-isolated gateway for ALL enterprise campaign
 * WhatsApp operations:
 * - Resolves tenant -> workspace/agency -> authorized WABA -> sender -> decrypted token
 * - NEVER falls back to global .env credentials for any tenant
 * - Routes MARKETING templates through Marketing Messages API when onboarded/eligible
 *   and standard Cloud API otherwise (with explicit auditable fallback rules)
 * - Exposes unified methods for Messages, Templates, WhatsApp Flows, Limits & Status.
 */

function getDefaultHttpClient() {
  try {
    return require("axios");
  } catch {
    return {
      async get(url, cfg = {}) {
        const qs = cfg.params ? `?${new URLSearchParams(cfg.params).toString()}` : "";
        const res = await fetch(`${url}${qs}`, { headers: cfg.headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data?.error?.message || `HTTP ${res.status}`), { response: { status: res.status, data } });
        return { data };
      },
      async post(url, body, cfg = {}) {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(cfg.headers || {}) }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data?.error?.message || `HTTP ${res.status}`), { response: { status: res.status, data } });
        return { data };
      },
    };
  }
}
const cryptoHelper = require("../../backendutil/cryptoHelper");
const { createDbHelper, assertTenantId, httpError } = require("./dbHelper");
const { createMarketingMessagesAdapter } = require("./marketingMessagesAdapter");
const { createLimitEngine } = require("../metaMessagingLimitEngine");

const DEFAULT_API_VERSION = process.env.META_GRAPH_API_VERSION || "v22.0";

function createProviderGateway(options = {}) {
  const db = createDbHelper(options.db);
  const httpClient = options.httpClient || getDefaultHttpClient();
  const apiVersion = options.apiVersion || DEFAULT_API_VERSION;
  const marketingAdapter =
    options.marketingAdapter ||
    createMarketingMessagesAdapter({ db: options.db, httpClient, apiVersion });
  const limitEngine = options.limitEngine || createLimitEngine({ db: options.db });

  function decryptToken(raw) {
    if (!raw) return "";
    try {
      return cryptoHelper.decrypt(raw);
    } catch {
      return raw;
    }
  }

  /**
   * Strict fail-closed sender & WABA credential resolution.
   * Never uses global process.env fallbacks.
   */
  async function resolveAuthorizedSender(tenantId, { senderId = null, wabaId = null, branchId = null } = {}) {
    const tid = assertTenantId(tenantId);

    // Check operational dispatch pause controls
    const tenantPause = await db.queryOne(
      `SELECT is_paused, reason FROM campaign_dispatch_controls
       WHERE scope_type = 'tenant' AND scope_id = ? AND is_paused = 1 LIMIT 1`,
      [String(tid)]
    );
    if (tenantPause) {
      throw httpError(
        `Tenant dispatch is paused: ${tenantPause.reason || "administrative hold"}`,
        423,
        "TENANT_DISPATCH_PAUSED"
      );
    }

    let sql = `
      SELECT s.*,
             w.id AS waba_conn_id,
             w.waba_id AS conn_waba_id,
             w.meta_business_id,
             w.encrypted_token,
             w.status AS waba_status,
             w.marketing_messages_lite_api_status,
             w.marketing_messages_onboarding_status,
             w.marketing_messages_terms_accepted,
             w.agency_client_id
      FROM wa_senders s
      JOIN waba_connections w
        ON w.id = s.waba_connection_id
       AND w.tenant_id = s.tenant_id
      WHERE s.tenant_id = ?
    `;
    const params = [tid];

    if (senderId) {
      sql += " AND s.id = ?";
      params.push(Number(senderId));
    }
    if (wabaId) {
      sql += " AND w.waba_id = ?";
      params.push(String(wabaId));
    }
    if (branchId && !senderId) {
      sql += ` AND (s.is_shared = 1 OR EXISTS (
        SELECT 1 FROM sender_branch_assignments sba
        WHERE sba.sender_id = s.id AND sba.tenant_id = s.tenant_id AND sba.branch_id = ?
      ))`;
      params.push(Number(branchId));
    }
    sql += " ORDER BY s.id ASC LIMIT 1";

    const row = await db.queryOne(sql, params);
    if (!row) {
      throw httpError(
        "No authorized WhatsApp sender found for this organization",
        403,
        "SENDER_UNAUTHORIZED"
      );
    }
    if (row.status !== "connected") {
      throw httpError(
        `Selected WhatsApp sender (${row.display_phone || row.id}) is not connected (status=${row.status})`,
        409,
        "SENDER_DISCONNECTED"
      );
    }
    if (row.waba_status !== "connected") {
      throw httpError(
        `WABA (${row.conn_waba_id}) is not connected (status=${row.waba_status})`,
        409,
        "WABA_DISCONNECTED"
      );
    }
    if (row.dispatch_paused) {
      throw httpError(
        `Sender dispatch is paused: ${row.pause_reason || "administrative hold"}`,
        423,
        "SENDER_PAUSED"
      );
    }

    const wabaPause = await db.queryOne(
      `SELECT is_paused, reason FROM campaign_dispatch_controls
       WHERE scope_type = 'waba' AND scope_id = ? AND is_paused = 1 LIMIT 1`,
      [String(row.conn_waba_id)]
    );
    if (wabaPause) {
      throw httpError(
        `WABA dispatch is paused: ${wabaPause.reason || "administrative hold"}`,
        423,
        "WABA_DISPATCH_PAUSED"
      );
    }

    const accessToken = decryptToken(row.encrypted_token);
    if (!row.phone_number_id || !accessToken) {
      throw httpError(
        "Sender is missing required Meta phone_number_id or encrypted access token",
        409,
        "SENDER_CREDENTIALS_INCOMPLETE"
      );
    }

    return {
      tenant_id: tid,
      sender_id: row.id,
      waba_connection_id: row.waba_conn_id,
      waba_id: row.conn_waba_id,
      meta_business_id: row.meta_business_id || null,
      phone_number_id: row.phone_number_id,
      display_phone: row.display_phone || null,
      verified_name: row.verified_name || null,
      quality: row.quality || null,
      messaging_tier: row.messaging_tier || "TIER_250",
      access_token: accessToken,
      app_secret: decryptToken(row.app_secret || ""),
      marketing_messages_lite_api_status: row.marketing_messages_lite_api_status || "UNKNOWN",
      marketing_messages_onboarding_status: row.marketing_messages_onboarding_status || "UNKNOWN",
      marketing_messages_terms_accepted: Boolean(row.marketing_messages_terms_accepted),
      agency_client_id: row.agency_client_id || null,
    };
  }

  async function postCloudApi(sender, payload, timeoutMs = 30000) {
    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(sender.phone_number_id)}/messages`;
    const { data } = await httpClient.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${sender.access_token}`,
        "Content-Type": "application/json",
      },
      timeout: timeoutMs,
    });
    return {
      provider_route: "whatsapp_cloud_api",
      endpoint,
      response: data,
      wamid: data?.messages?.[0]?.id || null,
    };
  }

  function resolveRouteForTemplate(sender, { templateCategory = "MARKETING", preferMarketingApi = true, allowCloudFallback = true } = {}) {
    const cat = String(templateCategory || "MARKETING").toUpperCase();
    if (cat !== "MARKETING" || !preferMarketingApi) {
      return {
        route: "whatsapp_cloud_api",
        eligible: true,
        code: "CLOUD_API_STANDARD",
        reason: cat === "MARKETING" ? "Standard Cloud API selected" : `Category ${cat} uses WhatsApp Cloud API`,
      };
    }
    return marketingAdapter.evaluateEligibility(sender, {
      templateCategory: cat,
      allowCloudFallback,
    });
  }

  async function sendMessage(tenantId, { senderId, wabaId, to, text, previewUrl = false }) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    return postCloudApi(sender, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to).replace(/\D/g, ""),
      type: "text",
      text: { body: String(text), preview_url: Boolean(previewUrl) },
    });
  }

  async function sendTemplate(
    tenantId,
    { senderId, wabaId, to, templateName, languageCode = "en", components = [] }
  ) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    return postCloudApi(sender, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to).replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && components.length ? { components } : {}),
      },
    });
  }

  async function sendMarketingTemplate(
    tenantId,
    {
      senderId,
      wabaId,
      to,
      templateName,
      languageCode = "en",
      components = [],
      allowCloudFallback = false,
      productPolicy = null,
    }
  ) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    const routeDecision = marketingAdapter.evaluateEligibility(sender, {
      templateCategory: "MARKETING",
      allowCloudFallback,
    });

    if (routeDecision.route === "blocked") {
      throw httpError(routeDecision.reason, 409, `MARKETING_API_${routeDecision.code}`);
    }

    if (routeDecision.route === "marketing_messages_api") {
      return marketingAdapter.sendMarketingTemplate({
        phoneNumberId: sender.phone_number_id,
        accessToken: sender.access_token,
        to,
        templateName,
        languageCode,
        components,
        productPolicy,
      });
    }

    const res = await postCloudApi(sender, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to).replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && components.length ? { components } : {}),
      },
    });
    return { ...res, fallback_used: true, fallback_reason: routeDecision.reason };
  }

  async function sendInteractiveMessage(tenantId, { senderId, wabaId, to, interactive }) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    return postCloudApi(sender, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to).replace(/\D/g, ""),
      type: "interactive",
      interactive,
    });
  }

  async function sendFlowMessage(
    tenantId,
    {
      senderId,
      wabaId,
      to,
      flowId,
      flowCta = "Open Form",
      flowToken,
      screen = "WELCOME",
      bodyText = "Please complete this form",
      headerText = null,
      footerText = null,
      mode = "published",
      flowAction = "navigate",
      flowActionPayload = null,
    }
  ) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    const interactive = {
      type: "flow",
      body: { text: String(bodyText).slice(0, 1024) },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: String(flowToken),
          flow_id: String(flowId),
          flow_cta: String(flowCta).slice(0, 20),
          flow_action: flowAction,
          ...(mode === "draft" ? { mode: "draft" } : {}),
          ...(flowAction === "navigate"
            ? { flow_action_payload: flowActionPayload || { screen } }
            : {}),
        },
      },
    };
    if (headerText) interactive.header = { type: "text", text: String(headerText).slice(0, 60) };
    if (footerText) interactive.footer = { text: String(footerText).slice(0, 60) };
    return postCloudApi(sender, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to).replace(/\D/g, ""),
      type: "interactive",
      interactive,
    });
  }

  async function sendMedia(tenantId, { senderId, wabaId, to, mediaType, mediaUrl, mediaId, caption, filename }) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    const mediaObj = mediaId ? { id: mediaId } : { link: mediaUrl };
    if (caption && ["image", "video", "document"].includes(mediaType)) mediaObj.caption = caption;
    if (filename && mediaType === "document") mediaObj.filename = filename;
    return postCloudApi(sender, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to).replace(/\D/g, ""),
      type: mediaType,
      [mediaType]: mediaObj,
    });
  }

  async function createTemplate(tenantId, { senderId, wabaId, payload }) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(sender.waba_id)}/message_templates`;
    const { data } = await httpClient.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${sender.access_token}`, "Content-Type": "application/json" },
      timeout: 20000,
    });
    return data;
  }

  async function syncTemplates(tenantId, { senderId, wabaId, limit = 250 }) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(sender.waba_id)}/message_templates`;
    const { data } = await httpClient.get(endpoint, {
      params: {
        limit,
        fields: "id,name,language,category,status,quality_score,rejected_reason,components",
      },
      headers: { Authorization: `Bearer ${sender.access_token}` },
      timeout: 20000,
    });
    return { waba_id: sender.waba_id, sender_id: sender.sender_id, templates: data?.data || [] };
  }

  async function createWhatsAppFlow(tenantId, { senderId, wabaId, name, categories = ["LEAD_GENERATION"], endpointUri = null }) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(sender.waba_id)}/flows`;
    const { data } = await httpClient.post(
      endpoint,
      {
        name,
        categories,
        ...(endpointUri ? { endpoint_uri: endpointUri } : {}),
      },
      { headers: { Authorization: `Bearer ${sender.access_token}` }, timeout: 20000 }
    );
    return data;
  }

  async function publishWhatsAppFlow(tenantId, { senderId, wabaId, metaFlowId }) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(metaFlowId)}/publish`;
    const { data } = await httpClient.post(
      endpoint,
      {},
      { headers: { Authorization: `Bearer ${sender.access_token}` }, timeout: 20000 }
    );
    return data;
  }

  async function syncPhoneNumber(tenantId, { senderId, wabaId }) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(sender.phone_number_id)}`;
    const { data } = await httpClient.get(endpoint, {
      params: {
        fields: "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,status",
      },
      headers: { Authorization: `Bearer ${sender.access_token}` },
      timeout: 15000,
    });
    await db.query(
      `UPDATE wa_senders
       SET quality = COALESCE(?, quality),
           messaging_tier = COALESCE(?, messaging_tier),
           verified_name = COALESCE(?, verified_name),
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [data?.quality_rating || null, data?.messaging_limit_tier || null, data?.verified_name || null, sender.tenant_id, sender.sender_id]
    );
    return data;
  }

  async function getMessagingLimit(tenantId, { senderId = null, wabaId = null } = {}) {
    const tid = assertTenantId(tenantId);
    return limitEngine.getMessagingLimit(tid, wabaId || (senderId ? String(senderId) : null));
  }

  async function getMarketingMessageStatus(tenantId, { senderId = null, wabaId = null, sync = false } = {}) {
    const sender = await resolveAuthorizedSender(tenantId, { senderId, wabaId });
    if (sync) {
      await marketingAdapter.syncWabaMarketingStatus(tenantId, sender.waba_id, sender.access_token);
      const refreshed = await resolveAuthorizedSender(tenantId, { senderId: sender.sender_id });
      return marketingAdapter.evaluateEligibility(refreshed, { templateCategory: "MARKETING" });
    }
    return marketingAdapter.evaluateEligibility(sender, { templateCategory: "MARKETING" });
  }

  async function getDeliveryStatus(tenantId, wamid) {
    const tid = assertTenantId(tenantId);
    const events = await db.query(
      `SELECT event_status, provider_timestamp, error_code, error_title, received_at
       FROM campaign_delivery_events
       WHERE tenant_id = ? AND wamid = ?
       ORDER BY received_at ASC`,
      [tid, String(wamid)]
    );
    const latest = events.length ? events[events.length - 1] : null;
    return { wamid, latest_status: latest?.event_status || "UNKNOWN", events };
  }

  return {
    resolveAuthorizedSender,
    resolveRouteForTemplate,
    sendMessage,
    sendTemplate,
    sendMarketingTemplate,
    sendInteractiveMessage,
    sendFlowMessage,
    sendMedia,
    createTemplate,
    syncTemplates,
    createWhatsAppFlow,
    publishWhatsAppFlow,
    syncPhoneNumber,
    getMessagingLimit,
    getMarketingMessageStatus,
    getDeliveryStatus,
    marketingAdapter,
  };
}

module.exports = { createProviderGateway };
