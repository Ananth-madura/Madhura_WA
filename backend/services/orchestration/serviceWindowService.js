"use strict";

/**
 * serviceWindowService.js
 *
 * Real 24-hour Meta Customer Service Window tracker & outbound eligibility gate.
 *
 * Rules preserved:
 *   - Only an actual inbound customer WhatsApp message updates `window_expires_at`
 *     (inbound_timestamp + 24 hours). Outbound templates NEVER extend the window.
 *   - Inside an active 24-hour window: free-form text, media, interactive reply
 *     buttons, lists, catalog messages, and WhatsApp Flows are permitted.
 *   - Outside the 24-hour window: free-form messages are BLOCKED
 *     (`OUTSIDE_SERVICE_WINDOW_TEMPLATE_REQUIRED`); only an APPROVED Meta template
 *     with valid consent and zero active suppression is permitted.
 */

const { createDbHelper, assertTenantId, normalizePhone, httpError } = require("../campaign/dbHelper");
const { createConsentSuppressionService } = require("../campaign/consentSuppressionService");

const WINDOW_MS = 24 * 60 * 60 * 1000;

function toIso(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
}

function createServiceWindowService(options = {}) {
  const db = createDbHelper(options.db);
  const consentService = options.consentService || createConsentSuppressionService({ db: options.db });

  async function recordInboundMessage(tenantId, {
    senderId = null,
    wabaId = null,
    phone,
    inboundAt = new Date(),
    messageId = null,
    messageType = "text",
  } = {}) {
    const tid = assertTenantId(tenantId);
    const norm = normalizePhone(phone);
    if (!norm.valid) return null;

    const inboundDate = inboundAt instanceof Date ? inboundAt : new Date(inboundAt);
    const baseMs = Number.isNaN(inboundDate.getTime()) ? Date.now() : inboundDate.getTime();
    const expiresIso = new Date(baseMs + WINDOW_MS).toISOString();
    const inboundIso = new Date(baseMs).toISOString();

    const existing = await db.queryOne(
      `SELECT id FROM wa_service_windows
       WHERE tenant_id = ? AND phone = ? AND (sender_id = ? OR (sender_id IS NULL AND ? IS NULL))
       LIMIT 1`,
      [tid, norm.normalized, senderId || null, senderId || null]
    );

    if (existing) {
      await db.query(
        `UPDATE wa_service_windows
         SET last_inbound_at = ?, window_expires_at = ?, last_inbound_message_id = ?,
             last_inbound_type = ?, waba_id = COALESCE(?, waba_id), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [inboundIso, expiresIso, messageId || null, messageType || "text", wabaId || null, existing.id]
      );
    } else {
      await db.query(
        `INSERT INTO wa_service_windows
         (tenant_id, sender_id, waba_id, phone, last_inbound_at, window_expires_at, last_inbound_message_id, last_inbound_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tid, senderId || null, wabaId || null, norm.normalized, inboundIso, expiresIso, messageId || null, messageType || "text"]
      );
    }

    // Also mirror onto conversations table if present
    try {
      await db.query(
        `UPDATE conversations
         SET service_window_expires_at = ?
         WHERE tenant_id = ? AND (sender_id = ? OR ? IS NULL)
           AND contact_id IN (SELECT id FROM wa_contacts WHERE tenant_id = ? AND phone LIKE ?)`,
        [expiresIso, tid, senderId || null, senderId || null, tid, `%${norm.normalized.slice(-10)}`]
      );
    } catch (_) {}

    return {
      phone: norm.normalized,
      sender_id: senderId || null,
      last_inbound_at: inboundIso,
      window_expires_at: expiresIso,
      is_open: baseMs + WINDOW_MS > Date.now(),
    };
  }

  async function getWindowStatus(tenantId, { senderId = null, phone, now = Date.now() } = {}) {
    const tid = assertTenantId(tenantId);
    const norm = normalizePhone(phone);
    if (!norm.valid) {
      return { phone: String(phone || ""), is_open: false, remaining_ms: 0, window_expires_at: null };
    }

    const row = senderId
      ? await db.queryOne(
          `SELECT * FROM wa_service_windows
           WHERE tenant_id = ? AND phone = ? AND (sender_id = ? OR sender_id IS NULL)
           ORDER BY window_expires_at DESC LIMIT 1`,
          [tid, norm.normalized, Number(senderId)]
        )
      : await db.queryOne(
          `SELECT * FROM wa_service_windows
           WHERE tenant_id = ? AND phone = ?
           ORDER BY window_expires_at DESC LIMIT 1`,
          [tid, norm.normalized]
        );

    if (!row || !row.window_expires_at) {
      return { phone: norm.normalized, is_open: false, remaining_ms: 0, window_expires_at: null, last_inbound_at: null };
    }

    const expMs = new Date(row.window_expires_at).getTime();
    const remaining = Math.max(0, expMs - now);
    return {
      phone: norm.normalized,
      sender_id: row.sender_id,
      is_open: remaining > 0,
      remaining_ms: remaining,
      last_inbound_at: toIso(row.last_inbound_at),
      window_expires_at: toIso(row.window_expires_at),
    };
  }

  async function checkOutboundEligibility(tenantId, {
    senderId = null,
    phone,
    messageType = "text", // text | media | buttons | list | catalog | whatsapp_flow | template
    templateId = null,
    category = "UTILITY",
    workspaceId = null,
    now = Date.now(),
  } = {}) {
    const tid = assertTenantId(tenantId);
    const norm = normalizePhone(phone);
    if (!norm.valid) {
      return { eligible: false, code: "INVALID_PHONE", reason: "Phone number is invalid" };
    }

    // Always check global/workspace suppression & opt-out first (even inside 24h window for marketing)
    const isTemplate = String(messageType).toLowerCase() === "template";
    const cat = String(category || (isTemplate ? "MARKETING" : "SERVICE")).toUpperCase();
    const consentCheck = await consentService.checkConsent(tid, norm.normalized, {
      category: cat,
      workspaceId,
    });

    if (!consentCheck.eligible && consentCheck.code === "BLOCKED_BY_SUPPRESSION") {
      return {
        eligible: false,
        code: "BLOCKED_BY_SUPPRESSION",
        reason: consentCheck.reason || "Recipient is opted out or suppressed",
      };
    }

    const win = await getWindowStatus(tid, { senderId, phone: norm.normalized, now });

    // Free-form / interactive messages require an open 24-hour customer service window
    if (!isTemplate) {
      if (!win.is_open) {
        return {
          eligible: false,
          code: "OUTSIDE_SERVICE_WINDOW_TEMPLATE_REQUIRED",
          reason: "Outside 24-hour Meta customer service window. An approved template is required to initiate messaging.",
          service_window: win,
        };
      }
      return {
        eligible: true,
        code: "ALLOWED_IN_SERVICE_WINDOW",
        service_window: win,
      };
    }

    // Template message checks: must be APPROVED in Meta and respect consent
    if (!consentCheck.eligible) {
      return {
        eligible: false,
        code: consentCheck.code || "MISSING_CONSENT",
        reason: consentCheck.reason || "Recipient lacks required opt-in consent for this template category",
        service_window: win,
      };
    }

    if (!templateId) {
      return {
        eligible: false,
        code: "TEMPLATE_REQUIRED",
        reason: "Template ID is required when sending template messages",
        service_window: win,
      };
    }

    const tmpl = await db.queryOne(
      `SELECT id, name, category, meta_status, language FROM wa_templates
       WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(templateId)]
    );
    if (!tmpl) {
      return { eligible: false, code: "TEMPLATE_NOT_FOUND", reason: "Template not found for tenant", service_window: win };
    }
    if (String(tmpl.meta_status || "").toUpperCase() !== "APPROVED") {
      return {
        eligible: false,
        code: "TEMPLATE_NOT_APPROVED",
        reason: `Template '${tmpl.name}' status is '${tmpl.meta_status || "DRAFT"}', not APPROVED`,
        service_window: win,
      };
    }

    return {
      eligible: true,
      code: win.is_open ? "ALLOWED_TEMPLATE_IN_WINDOW" : "ALLOWED_TEMPLATE_OUTSIDE_WINDOW",
      template: tmpl,
      service_window: win,
    };
  }

  return {
    WINDOW_MS,
    recordInboundMessage,
    getWindowStatus,
    checkOutboundEligibility,
  };
}

module.exports = { createServiceWindowService, WINDOW_MS };
