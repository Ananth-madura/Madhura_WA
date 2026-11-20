"use strict";

/**
 * consentSuppressionService.js
 *
 * Centralized compliance engine for Consent Evidence, Opt-Out handling,
 * Global/Category/Workspace/Agency Suppression, and Communication Preferences.
 *
 * Hard compliance invariants:
 * 1. Marketing consent is NEVER inferred from a saved contact, CSV row, or past order alone.
 * 2. Evidence is mandatory for manual/imported marketing consent.
 * 3. Suppression ALWAYS takes precedence over positive segment rules.
 * 4. An opt-out immediately cancels queued unsent campaign jobs & recipients for that phone.
 * 5. CSV re-import NEVER silently re-enables a revoked/opted-out consent.
 */

const crypto = require("crypto");
const {
  createDbHelper,
  assertTenantId,
  normalizePhone,
  generateUid,
  httpError,
} = require("./dbHelper");

const VALID_PURPOSES = new Set([
  "marketing",
  "promotional_updates",
  "product_updates",
  "utility",
  "appointment_notifications",
  "order_updates",
  "payment_reminders",
  "sms_fallback",
  "rcs_fallback",
  "email_fallback",
]);

const VALID_COLLECTION_METHODS = new Set([
  "website_form",
  "landing_page",
  "checkout_form",
  "customer_onboarding",
  "crm_manual_with_evidence",
  "whatsapp_inbound_optin",
  "external_form_integration",
  "meta_optin_flow",
  "csv_import_with_evidence",
]);

const DEFAULT_OPT_OUT_KEYWORDS = [
  "STOP",
  "UNSUBSCRIBE",
  "CANCEL",
  "OPT OUT",
  "OPTOUT",
  "STOP ALL",
  "REMOVE ME",
  "NO MORE",
];

function purposeForCategory(category) {
  const c = String(category || "MARKETING").toUpperCase();
  if (c === "UTILITY") return "utility";
  if (c === "AUTHENTICATION") return "utility";
  return "marketing";
}

function createConsentSuppressionService(options = {}) {
  const db = createDbHelper(options.db);

  async function recordConsent(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const { valid, normalized, reason } = normalizePhone(input.phone, input.defaultCountryCode || "91");
    if (!valid) throw httpError(`Invalid phone number (${reason})`, 400, "INVALID_PHONE");

    const purpose = String(input.purpose || "marketing").toLowerCase();
    if (!VALID_PURPOSES.has(purpose)) {
      throw httpError(`Unsupported consent purpose: ${purpose}`, 400, "INVALID_CONSENT_PURPOSE");
    }

    const collectionMethod = String(input.collection_method || "").toLowerCase();
    if (!VALID_COLLECTION_METHODS.has(collectionMethod)) {
      throw httpError(
        "A valid collection_method is required; consent cannot be inferred without evidence",
        400,
        "CONSENT_EVIDENCE_REQUIRED"
      );
    }

    const source = String(input.source || collectionMethod).trim();
    const capturedWording = String(input.captured_wording || "").trim();
    const formReference = input.form_reference ? String(input.form_reference).trim() : null;
    const hasEvidence = Boolean(
      capturedWording || formReference || input.evidence_payload || input.evidence_url
    );

    if (["marketing", "promotional_updates", "product_updates"].includes(purpose) && !hasEvidence) {
      throw httpError(
        "Marketing consent requires captured wording, form/webpage reference, or evidence payload",
        400,
        "CONSENT_EVIDENCE_REQUIRED"
      );
    }

    // Never allow a CSV import to silently override an existing REVOKED consent
    const existing = await db.queryOne(
      `SELECT * FROM contact_consents WHERE tenant_id = ? AND normalized_phone = ? AND purpose = ? LIMIT 1`,
      [tid, normalized, purpose]
    );
    if (
      existing &&
      existing.status === "REVOKED" &&
      input.is_import &&
      !input.explicit_reoptin_evidence
    ) {
      throw httpError(
        "Contact previously opted out; CSV import cannot silently re-enable consent",
        409,
        "OPT_OUT_PROTECTED"
      );
    }

    const category = String(
      input.category || (purpose === "utility" ? "UTILITY" : "MARKETING")
    ).toUpperCase();
    const evidenceUid = generateUid("cns_ev");

    let consentId;
    if (existing) {
      await db.query(
        `UPDATE contact_consents
         SET contact_id = COALESCE(?, contact_id),
             workspace_id = COALESCE(?, workspace_id),
             category = ?,
             status = 'GRANTED',
             source = ?,
             collection_method = ?,
             form_reference = ?,
             campaign_reference = ?,
             captured_wording = ?,
             wording_version = ?,
             evidence_ref = ?,
             granted_at = CURRENT_TIMESTAMP,
             revoked_at = NULL,
             updated_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [
          input.contact_id || null,
          input.workspace_id || null,
          category,
          source,
          collectionMethod,
          formReference,
          input.campaign_reference || null,
          capturedWording || null,
          input.wording_version || "1.0",
          evidenceUid,
          actorId,
          existing.id,
          tid,
        ]
      );
      consentId = existing.id;
    } else {
      const res = await db.query(
        `INSERT INTO contact_consents (
          tenant_id, workspace_id, contact_id, normalized_phone, purpose, category,
          status, source, collection_method, form_reference, campaign_reference,
          captured_wording, wording_version, evidence_ref, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'GRANTED', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tid,
          input.workspace_id || null,
          input.contact_id || null,
          normalized,
          purpose,
          category,
          source,
          collectionMethod,
          formReference,
          input.campaign_reference || null,
          capturedWording || null,
          input.wording_version || "1.0",
          evidenceUid,
          actorId,
        ]
      );
      consentId = res.insertId;
    }

    const ipHash = input.ip_address
      ? crypto.createHash("sha256").update(String(input.ip_address)).digest("hex")
      : null;

    await db.query(
      `INSERT INTO consent_evidence (
        evidence_uid, tenant_id, consent_id, evidence_type, source_url, ip_hash, payload_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidenceUid,
        tid,
        consentId,
        collectionMethod,
        input.evidence_url || formReference || null,
        ipHash,
        JSON.stringify({
          captured_wording: capturedWording || null,
          wording_version: input.wording_version || "1.0",
          ...(input.evidence_payload || {}),
        }),
        actorId,
      ]
    );

    await db.query(
      `INSERT INTO consent_events (
        tenant_id, consent_id, contact_id, normalized_phone, purpose, action, source, reason, actor_id, metadata_json
      ) VALUES (?, ?, ?, ?, ?, 'GRANTED', ?, ?, ?, ?)`,
      [
        tid,
        consentId,
        input.contact_id || null,
        normalized,
        purpose,
        source,
        input.reason || "consent_captured",
        actorId,
        JSON.stringify({ evidence_ref: evidenceUid, collection_method: collectionMethod }),
      ]
    );

    return {
      id: consentId,
      tenant_id: tid,
      normalized_phone: normalized,
      purpose,
      category,
      status: "GRANTED",
      evidence_ref: evidenceUid,
    };
  }

  /**
   * Revoke consent and immediately suppress & cancel all queued unsent campaign jobs/recipients.
   */
  async function revokeConsent(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const { valid, normalized } = normalizePhone(input.phone, input.defaultCountryCode || "91");
    if (!valid) throw httpError("Valid phone number is required", 400, "INVALID_PHONE");

    const purpose = String(input.purpose || "marketing").toLowerCase();
    const category = String(input.category || (purpose === "all" ? "ALL" : "MARKETING")).toUpperCase();
    const source = String(input.source || "user_opt_out");
    const reason = String(input.reason || "opt_out");

    const existing = await db.queryOne(
      `SELECT id FROM contact_consents WHERE tenant_id = ? AND normalized_phone = ? AND purpose = ? LIMIT 1`,
      [tid, normalized, purpose === "all" ? "marketing" : purpose]
    );

    let consentId = existing?.id || null;
    if (existing) {
      await db.query(
        `UPDATE contact_consents
         SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [actorId, existing.id, tid]
      );
    } else {
      const res = await db.query(
        `INSERT INTO contact_consents (
          tenant_id, workspace_id, contact_id, normalized_phone, purpose, category,
          status, source, collection_method, revoked_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'REVOKED', ?, 'whatsapp_inbound_optin', CURRENT_TIMESTAMP, ?)`,
        [
          tid,
          input.workspace_id || null,
          input.contact_id || null,
          normalized,
          purpose === "all" ? "marketing" : purpose,
          category === "ALL" ? "MARKETING" : category,
          source,
          actorId,
        ]
      );
      consentId = res.insertId;
    }

    await db.query(
      `INSERT INTO consent_events (
        tenant_id, consent_id, contact_id, normalized_phone, purpose, action, source, reason, actor_id, metadata_json
      ) VALUES (?, ?, ?, ?, ?, 'REVOKED', ?, ?, ?, ?)`,
      [
        tid,
        consentId,
        input.contact_id || null,
        normalized,
        purpose,
        source,
        reason,
        actorId,
        JSON.stringify({ keyword: input.keyword || null }),
      ]
    );

    // Sync legacy wa_opt_outs & wa_contacts if present
    try {
      await db.query(
        `UPDATE wa_contacts SET is_unsubscribed = 1 WHERE tenant_id = ? AND (phone = ? OR phone = ?)`,
        [tid, normalized, normalized.slice(-10)]
      );
    } catch (_) {}

    // Create active suppression entry (which immediately cancels unsent queued jobs & recipients)
    const suppression = await addSuppression(
      tid,
      {
        phone: normalized,
        contact_id: input.contact_id || null,
        workspace_id: input.workspace_id || null,
        agency_client_id: input.agency_client_id || null,
        scope: input.scope || "company",
        category,
        reason,
        source,
      },
      actorId
    );

    return {
      revoked: true,
      consent_id: consentId,
      normalized_phone: normalized,
      purpose,
      suppression_id: suppression.id,
      cancelled_recipients: suppression.cancelledRecipients || 0,
      cancelled_jobs: suppression.cancelledJobs || 0,
    };
  }

  async function cancelUnsentForPhone(tenantId, normalizedPhone, reason = "suppressed") {
    const tid = assertTenantId(tenantId);
    const unsentStates = "'PENDING','ELIGIBILITY_CHECK','WAITING_FOR_SCHEDULE','QUEUED','RESERVED'";

    const affectedRecipients = await db.query(
      `SELECT id, campaign_id FROM campaign_recipients
       WHERE tenant_id = ? AND normalized_phone = ? AND status IN (${unsentStates})`,
      [tid, normalizedPhone]
    );

    let cancelledRecipients = 0;
    let cancelledJobs = 0;

    if (affectedRecipients.length > 0) {
      const rRes = await db.query(
        `UPDATE campaign_recipients
         SET status = 'BLOCKED_BY_SUPPRESSION',
             exclusion_reason = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND normalized_phone = ? AND status IN (${unsentStates})`,
        [reason, tid, normalizedPhone]
      );
      cancelledRecipients = Number(rRes?.affectedRows || affectedRecipients.length);

      for (const rec of affectedRecipients) {
        const jRes = await db.query(
          `UPDATE campaign_jobs
           SET status = 'CANCELLED',
               last_error = ?,
               completed_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND recipient_id = ? AND status IN ('QUEUED','DELAYED','WAITING')`,
          [reason, tid, rec.id]
        );
        cancelledJobs += Number(jRes?.affectedRows || 0);

        await db.query(
          `INSERT INTO campaign_recipient_exclusions (
            tenant_id, campaign_id, recipient_id, phone, reason_code, reason_detail
          ) VALUES (?, ?, ?, ?, 'OPT_OUT_DURING_EXECUTION', ?)`,
          [tid, rec.campaign_id, rec.id, normalizedPhone, `Cancelled during active execution (${reason})`]
        ).catch(async () => {
          // Fallback if schema has contact_id instead of recipient_id
          await db.query(
            `INSERT INTO campaign_recipient_exclusions (
              tenant_id, campaign_id, phone, reason_code, reason_detail
            ) VALUES (?, ?, ?, 'OPT_OUT_DURING_EXECUTION', ?)`,
            [tid, rec.campaign_id, normalizedPhone, `Cancelled during active execution (${reason})`]
          );
        });
      }
    }

    return { cancelledRecipients, cancelledJobs };
  }

  async function addSuppression(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const { valid, normalized } = normalizePhone(input.phone, input.defaultCountryCode || "91");
    if (!valid) throw httpError("Valid phone number is required", 400, "INVALID_PHONE");

    const scope = String(input.scope || "company").toLowerCase();
    const category = String(input.category || "ALL").toUpperCase();
    const reason = String(input.reason || "manual_suppression");
    const source = String(input.source || "admin");

    const existing = await db.queryOne(
      `SELECT id FROM contact_suppressions
       WHERE tenant_id = ? AND normalized_phone = ? AND scope = ? AND category = ? AND is_active = 1 LIMIT 1`,
      [tid, normalized, scope, category]
    );
    if (existing) {
      await cancelUnsentForPhone(tid, normalized, reason);
      return { id: existing.id, already_active: true, normalized_phone: normalized, scope, category };
    }

    const res = await db.query(
      `INSERT INTO contact_suppressions (
        tenant_id, workspace_id, agency_client_id, list_id, contact_id,
        normalized_phone, scope, category, reason, source, is_active, expires_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        tid,
        input.workspace_id || null,
        input.agency_client_id || null,
        input.list_id || null,
        input.contact_id || null,
        normalized,
        scope,
        category,
        reason,
        source,
        input.expires_at || null,
        actorId,
      ]
    );

    const cancelStats = await cancelUnsentForPhone(tid, normalized, reason);
    return {
      id: res.insertId,
      normalized_phone: normalized,
      scope,
      category,
      reason,
      ...cancelStats,
    };
  }

  async function removeSuppression(tenantId, suppressionId, actorId = null) {
    const tid = assertTenantId(tenantId);
    const res = await db.query(
      `UPDATE contact_suppressions SET is_active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [Number(suppressionId), tid]
    );
    return { removed: Number(res?.affectedRows || 0) > 0, actor_id: actorId };
  }

  async function checkSuppression(tenantId, phone, { category = "MARKETING", workspaceId = null, agencyClientId = null } = {}) {
    const tid = assertTenantId(tenantId);
    const { valid, normalized } = normalizePhone(phone);
    if (!valid) return { suppressed: true, reason: "invalid_phone" };

    const cat = String(category || "MARKETING").toUpperCase();
    const rows = await db.query(
      `SELECT id, scope, category, reason, source, workspace_id, agency_client_id, expires_at
       FROM contact_suppressions
       WHERE tenant_id = ? AND normalized_phone = ? AND is_active = 1
         AND (category = 'ALL' OR category = ?)`,
      [tid, normalized, cat]
    );

    const now = Date.now();
    for (const row of rows) {
      if (row.expires_at && new Date(row.expires_at).getTime() <= now) continue;
      if (row.scope === "workspace" && workspaceId && row.workspace_id && Number(row.workspace_id) !== Number(workspaceId)) {
        continue;
      }
      if (row.scope === "agency_client" && agencyClientId && row.agency_client_id && Number(row.agency_client_id) !== Number(agencyClientId)) {
        continue;
      }
      return {
        suppressed: true,
        suppression_id: row.id,
        scope: row.scope,
        category: row.category,
        reason: row.reason,
        source: row.source,
      };
    }

    // Check legacy wa_opt_outs table as an additional safety guard
    try {
      const legacy = await db.queryOne(
        `SELECT id, reason FROM wa_opt_outs WHERE tenant_id = ? AND (phone = ? OR phone = ?) LIMIT 1`,
        [tid, normalized, normalized.slice(-10)]
      );
      if (legacy) {
        return { suppressed: true, scope: "company", category: "ALL", reason: legacy.reason || "legacy_opt_out" };
      }
    } catch (_) {}

    return { suppressed: false };
  }

  async function checkConsent(tenantId, phone, { purpose = null, category = "MARKETING", workspaceId = null, agencyClientId = null } = {}) {
    const tid = assertTenantId(tenantId);
    const { valid, normalized } = normalizePhone(phone);
    if (!valid) {
      return { eligible: false, code: "INVALID_PHONE", reason: "Invalid phone number" };
    }

    // Suppression ALWAYS takes precedence over consent
    const sup = await checkSuppression(tid, normalized, { category, workspaceId, agencyClientId });
    if (sup.suppressed) {
      return {
        eligible: false,
        code: "BLOCKED_BY_SUPPRESSION",
        reason: `Suppressed (${sup.reason || sup.scope})`,
        suppression: sup,
      };
    }

    const effectivePurpose = purpose || purposeForCategory(category);
    const consent = await db.queryOne(
      `SELECT * FROM contact_consents
       WHERE tenant_id = ? AND normalized_phone = ? AND purpose = ?
       LIMIT 1`,
      [tid, normalized, effectivePurpose]
    );

    if (!consent) {
      return {
        eligible: false,
        code: "BLOCKED_BY_CONSENT",
        reason: `No recorded ${effectivePurpose} consent for recipient`,
      };
    }
    if (consent.status !== "GRANTED") {
      return {
        eligible: false,
        code: "BLOCKED_BY_CONSENT",
        reason: `Consent status is ${consent.status}`,
        consent_id: consent.id,
      };
    }

    // Check communication preferences if set
    const pref = await db.queryOne(
      `SELECT * FROM communication_preferences WHERE tenant_id = ? AND normalized_phone = ? LIMIT 1`,
      [tid, normalized]
    );
    if (pref) {
      const cat = String(category || "MARKETING").toUpperCase();
      if (cat === "MARKETING" && Number(pref.marketing_enabled) === 0) {
        return {
          eligible: false,
          code: "BLOCKED_BY_PREFERENCE",
          reason: "Contact communication preference disabled marketing messages",
        };
      }
      if (cat === "UTILITY" && Number(pref.utility_enabled) === 0) {
        return {
          eligible: false,
          code: "BLOCKED_BY_PREFERENCE",
          reason: "Contact communication preference disabled utility messages",
        };
      }
    }

    return {
      eligible: true,
      code: "CONSENT_VERIFIED",
      consent_id: consent.id,
      evidence_ref: consent.evidence_ref,
      purpose: consent.purpose,
      granted_at: consent.granted_at,
    };
  }

  async function processOptOutKeyword(tenantId, phone, messageText, extraKeywords = []) {
    if (!messageText || typeof messageText !== "string") return { matched: false };
    const normalizedText = messageText.trim().toUpperCase();
    const keywords = [...DEFAULT_OPT_OUT_KEYWORDS, ...extraKeywords.map((k) => String(k).trim().toUpperCase())];
    const matched = keywords.find(
      (kw) =>
        normalizedText === kw ||
        normalizedText.startsWith(`${kw} `) ||
        normalizedText.endsWith(` ${kw}`)
    );
    if (!matched) return { matched: false };

    const result = await revokeConsent(tenantId, {
      phone,
      purpose: "marketing",
      category: "ALL",
      source: "whatsapp_keyword_optout",
      reason: `keyword:${matched}`,
      keyword: matched,
    });
    return { matched: true, keyword: matched, ...result };
  }

  async function listConsents(tenantId, { status = null, purpose = null, search = null, limit = 100, offset = 0 } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?"];
    const params = [tid];
    if (status) {
      clauses.push("status = ?");
      params.push(status);
    }
    if (purpose) {
      clauses.push("purpose = ?");
      params.push(purpose);
    }
    if (search) {
      clauses.push("(normalized_phone LIKE ? OR source LIKE ? OR form_reference LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    params.push(Math.min(500, Number(limit) || 100), Math.max(0, Number(offset) || 0));
    return db.query(
      `SELECT * FROM contact_consents WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      params
    );
  }

  async function listSuppressions(tenantId, { activeOnly = true, scope = null, search = null, limit = 100, offset = 0 } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?"];
    const params = [tid];
    if (activeOnly) clauses.push("is_active = 1");
    if (scope) {
      clauses.push("scope = ?");
      params.push(scope);
    }
    if (search) {
      clauses.push("(normalized_phone LIKE ? OR reason LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like);
    }
    params.push(Math.min(500, Number(limit) || 100), Math.max(0, Number(offset) || 0));
    return db.query(
      `SELECT * FROM contact_suppressions WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      params
    );
  }

  async function upsertPreferences(tenantId, phone, prefs = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const { valid, normalized } = normalizePhone(phone);
    if (!valid) throw httpError("Valid phone number is required", 400, "INVALID_PHONE");

    const existing = await db.queryOne(
      `SELECT id FROM communication_preferences WHERE tenant_id = ? AND normalized_phone = ? LIMIT 1`,
      [tid, normalized]
    );
    if (existing) {
      await db.query(
        `UPDATE communication_preferences
         SET marketing_enabled = COALESCE(?, marketing_enabled),
             utility_enabled = COALESCE(?, utility_enabled),
             appointment_enabled = COALESCE(?, appointment_enabled),
             preferred_language = COALESCE(?, preferred_language),
             timezone = COALESCE(?, timezone),
             quiet_hours_start = COALESCE(?, quiet_hours_start),
             quiet_hours_end = COALESCE(?, quiet_hours_end),
             max_messages_per_week = COALESCE(?, max_messages_per_week),
             updated_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [
          prefs.marketing_enabled !== undefined ? (prefs.marketing_enabled ? 1 : 0) : null,
          prefs.utility_enabled !== undefined ? (prefs.utility_enabled ? 1 : 0) : null,
          prefs.appointment_enabled !== undefined ? (prefs.appointment_enabled ? 1 : 0) : null,
          prefs.preferred_language || null,
          prefs.timezone || null,
          prefs.quiet_hours_start || null,
          prefs.quiet_hours_end || null,
          prefs.max_messages_per_week ?? null,
          actorId,
          existing.id,
          tid,
        ]
      );
      return db.queryOne(`SELECT * FROM communication_preferences WHERE id = ?`, [existing.id]);
    }
    const res = await db.query(
      `INSERT INTO communication_preferences (
        tenant_id, contact_id, normalized_phone, marketing_enabled, utility_enabled,
        appointment_enabled, preferred_language, timezone, quiet_hours_start,
        quiet_hours_end, max_messages_per_week, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        prefs.contact_id || null,
        normalized,
        prefs.marketing_enabled ? 1 : 0,
        prefs.utility_enabled === false ? 0 : 1,
        prefs.appointment_enabled === false ? 0 : 1,
        prefs.preferred_language || "en",
        prefs.timezone || null,
        prefs.quiet_hours_start || null,
        prefs.quiet_hours_end || null,
        prefs.max_messages_per_week ?? null,
        actorId,
      ]
    );
    return db.queryOne(`SELECT * FROM communication_preferences WHERE id = ?`, [res.insertId]);
  }

  return {
    recordConsent,
    revokeConsent,
    cancelUnsentForPhone,
    addSuppression,
    removeSuppression,
    checkSuppression,
    checkConsent,
    processOptOutKeyword,
    listConsents,
    listSuppressions,
    upsertPreferences,
    DEFAULT_OPT_OUT_KEYWORDS,
    VALID_PURPOSES: Array.from(VALID_PURPOSES),
    VALID_COLLECTION_METHODS: Array.from(VALID_COLLECTION_METHODS),
  };
}

module.exports = { createConsentSuppressionService };
