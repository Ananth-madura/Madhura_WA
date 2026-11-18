"use strict";

/**
 * marketingMessagesAdapter.js
 *
 * Dedicated Meta Marketing Messages API for WhatsApp adapter.
 * Separate from standard Cloud API messaging:
 * - Tracks WABA-level marketing_messages_lite_api_status & marketing_messages_onboarding_status
 * - Supports current & future Meta enum states without hardcoding exclusions
 * - Routes eligible onboarded MARKETING sends to /{API_VERSION}/{PHONE_NUMBER_ID}/marketing_messages
 * - Never silently falls back to standard Cloud API unless explicitly enabled and audited.
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
const { createDbHelper, assertTenantId, httpError } = require("./dbHelper");

const DEFAULT_API_VERSION = process.env.META_GRAPH_API_VERSION || "v22.0";

const KNOWN_ONBOARDED_STATES = new Set(["ONBOARDED", "ACTIVE"]);
const KNOWN_BLOCKED_STATES = new Set([
  "INELIGIBLE",
  "PENDING_VALID_PAYMENT_METHOD",
  "PENDING_INTERNAL_SETUP",
  "INELIGIBLE_INACTIVE_OR_RESTRICTED",
]);

function createMarketingMessagesAdapter(options = {}) {
  const db = createDbHelper(options.db);
  const httpClient = options.httpClient || getDefaultHttpClient();
  const apiVersion = options.apiVersion || DEFAULT_API_VERSION;

  async function syncWabaMarketingStatus(tenantId, wabaId, accessToken) {
    const tid = assertTenantId(tenantId);
    if (!wabaId || !accessToken) {
      throw httpError("WABA ID and authorized access token are required", 400, "MISSING_WABA_CREDENTIALS");
    }

    const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(wabaId)}`;
    const { data } = await httpClient.get(url, {
      params: {
        fields: "id,name,marketing_messages_lite_api_status,marketing_messages_onboarding_status",
      },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });

    const liteStatus = String(data?.marketing_messages_lite_api_status || "UNKNOWN");
    const onboardingStatus = String(data?.marketing_messages_onboarding_status || "UNKNOWN");

    await db.query(
      `UPDATE waba_connections
       SET marketing_messages_lite_api_status = ?,
           marketing_messages_onboarding_status = ?,
           marketing_messages_synced_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND waba_id = ?`,
      [liteStatus, onboardingStatus, tid, wabaId]
    );

    return {
      waba_id: wabaId,
      marketing_messages_lite_api_status: liteStatus,
      marketing_messages_onboarding_status: onboardingStatus,
      synced_at: new Date().toISOString(),
    };
  }

  async function updateFromAccountWebhook(tenantId, wabaId, payload = {}) {
    const tid = assertTenantId(tenantId);
    const liteStatus = payload.marketing_messages_lite_api_status || null;
    const onboardingStatus = payload.marketing_messages_onboarding_status || null;
    if (!liteStatus && !onboardingStatus) return { updated: false };

    const sets = [];
    const params = [];
    if (liteStatus) {
      sets.push("marketing_messages_lite_api_status = ?");
      params.push(String(liteStatus));
    }
    if (onboardingStatus) {
      sets.push("marketing_messages_onboarding_status = ?");
      params.push(String(onboardingStatus));
    }
    sets.push("marketing_messages_synced_at = CURRENT_TIMESTAMP");
    params.push(tid, wabaId);

    const res = await db.query(
      `UPDATE waba_connections SET ${sets.join(", ")} WHERE tenant_id = ? AND waba_id = ?`,
      params
    );
    return { updated: Number(res?.affectedRows || 0) > 0, liteStatus, onboardingStatus };
  }

  function evaluateEligibility(wabaRow, optionsCheck = {}) {
    if (!wabaRow) {
      return {
        eligible: false,
        route: "blocked",
        code: "WABA_NOT_FOUND",
        reason: "Blocked: WABA connection not found",
      };
    }

    const liteStatus = String(wabaRow.marketing_messages_lite_api_status || "UNKNOWN");
    const onboardingStatus = String(wabaRow.marketing_messages_onboarding_status || "UNKNOWN");
    const termsAccepted = Boolean(wabaRow.marketing_messages_terms_accepted);
    const category = String(optionsCheck.templateCategory || "MARKETING").toUpperCase();

    if (category !== "MARKETING") {
      return {
        eligible: false,
        route: "whatsapp_cloud_api",
        code: "NON_MARKETING_CATEGORY",
        reason: "Marketing Messages API only handles MARKETING category templates",
      };
    }

    const isOnboarded =
      KNOWN_ONBOARDED_STATES.has(liteStatus) || KNOWN_ONBOARDED_STATES.has(onboardingStatus);

    if (!isOnboarded) {
      const code = KNOWN_BLOCKED_STATES.has(liteStatus)
        ? liteStatus
        : KNOWN_BLOCKED_STATES.has(onboardingStatus)
        ? onboardingStatus
        : "ONBOARDING_REQUIRED";
      return {
        eligible: false,
        route: optionsCheck.allowCloudFallback ? "whatsapp_cloud_api" : "blocked",
        code,
        liteStatus,
        onboardingStatus,
        reason: `Blocked: Meta Marketing Messages API onboarding required (lite=${liteStatus}, onboarding=${onboardingStatus})`,
        fallbackUsed: Boolean(optionsCheck.allowCloudFallback),
      };
    }

    if (optionsCheck.requireTermsAccepted && !termsAccepted) {
      return {
        eligible: false,
        route: optionsCheck.allowCloudFallback ? "whatsapp_cloud_api" : "blocked",
        code: "TERMS_NOT_ACCEPTED",
        reason: "Blocked: Customer Marketing Messages API terms acceptance not confirmed",
        fallbackUsed: Boolean(optionsCheck.allowCloudFallback),
      };
    }

    return {
      eligible: true,
      route: "marketing_messages_api",
      code: "ONBOARDED",
      liteStatus,
      onboardingStatus,
      reason: "Onboarded and eligible for Marketing Messages API",
      fallbackUsed: false,
    };
  }

  async function sendMarketingTemplate({
    phoneNumberId,
    accessToken,
    to,
    templateName,
    languageCode = "en",
    components = [],
    productPolicy = null,
    timeoutMs = 30000,
  }) {
    if (!phoneNumberId || !accessToken) {
      throw httpError("Authorized sender credentials are required", 400, "MISSING_CREDENTIALS");
    }
    const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/marketing_messages`;
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to).replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && components.length ? { components } : {}),
      },
      ...(productPolicy ? { product_policy: productPolicy } : {}),
    };

    const { data } = await httpClient.post(endpoint, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: timeoutMs,
    });
    return {
      provider_route: "marketing_messages_api",
      endpoint,
      response: data,
      wamid: data?.messages?.[0]?.id || null,
    };
  }

  return {
    syncWabaMarketingStatus,
    updateFromAccountWebhook,
    evaluateEligibility,
    sendMarketingTemplate,
  };
}

module.exports = { createMarketingMessagesAdapter };
