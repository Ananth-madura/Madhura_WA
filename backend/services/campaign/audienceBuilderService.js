"use strict";

/**
 * audienceBuilderService.js
 *
 * Enterprise Backend Audience Segmentation, Snapshots & CSV/XLSX Import Engine.
 * - Evaluates nested AND/OR condition trees with inclusion & exclusion groups
 * - Never delegates audience computation to the frontend
 * - Normalizes international phones, detects duplicates & invalid numbers
 * - Integrates Consent & Suppression Engine for live eligibility counts
 * - Creates immutable audience snapshots at scheduling/approval time
 * - Handles CSV/XLSX imports with column mapping, duplicate policies & consent protection
 */

const {
  createDbHelper,
  assertTenantId,
  normalizePhone,
  safeJsonParse,
  httpError,
} = require("./dbHelper");
const { createConsentSuppressionService } = require("./consentSuppressionService");

const SEGMENT_PRESETS = [
  {
    key: "new_leads",
    name: "New Leads",
    description: "Contacts tagged or marked as new leads with valid phone and consent",
    definition: {
      logic: "AND",
      include: [
        { field: "crm_ref_type", operator: "equals", value: "lead" },
      ],
      exclude: [],
    },
  },
  {
    key: "vip_customers",
    name: "VIP Customers",
    description: "Active customers with VIP tag and eligible consent",
    definition: {
      logic: "AND",
      include: [
        { field: "tags", operator: "contains", value: "VIP" },
      ],
      exclude: [],
    },
  },
  {
    key: "interested_product",
    name: "Product Interest Audience",
    description: "Contacts whose custom field product_interest matches target product",
    definition: {
      logic: "AND",
      include: [
        { field: "custom_fields.product_interest", operator: "is_not_empty", value: "" },
      ],
      exclude: [],
    },
  },
  {
    key: "inactive_customers",
    name: "Inactive Customers (30+ days)",
    description: "Customers with no interaction in the last 30 days",
    definition: {
      logic: "AND",
      include: [
        { field: "last_contacted", operator: "older_than_days", value: 30 },
      ],
      exclude: [],
    },
  },
  {
    key: "abandoned_cart",
    name: "Abandoned Cart",
    description: "Contacts with an abandoned cart custom field or tag and no completed order",
    definition: {
      logic: "AND",
      include: [
        { field: "tags", operator: "contains", value: "abandoned_cart" },
      ],
      exclude: [
        { field: "tags", operator: "contains", value: "order_completed" },
      ],
    },
  },
  {
    key: "recent_buyers",
    name: "Recent Buyers (30 days)",
    description: "Verified customers with a completed order within 30 days",
    definition: {
      logic: "AND",
      include: [
        { field: "tags", operator: "contains", value: "recent_buyer" },
      ],
      exclude: [],
    },
  },
];

function extractFieldValue(record, fieldPath) {
  if (!record || !fieldPath) return undefined;
  const parts = String(fieldPath).split(".");
  let current = record;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "string" && (part === "tags" || parts[0] === "custom_fields")) {
      current = safeJsonParse(current, current);
    }
    current = current[part];
  }
  return current;
}

function evaluateCondition(record, cond) {
  if (!cond) return true;
  // Nested group support: { logic: 'AND'|'OR', rules: [...] }
  if (Array.isArray(cond.rules)) {
    const logic = String(cond.logic || "AND").toUpperCase();
    if (!cond.rules.length) return true;
    return logic === "OR"
      ? cond.rules.some((r) => evaluateCondition(record, r))
      : cond.rules.every((r) => evaluateCondition(record, r));
  }

  const rawVal = extractFieldValue(record, cond.field);
  const op = String(cond.operator || "equals").toLowerCase();
  const target = cond.value;

  if (op === "is_empty") return rawVal === null || rawVal === undefined || rawVal === "" || (Array.isArray(rawVal) && rawVal.length === 0);
  if (op === "is_not_empty") return !evaluateCondition(record, { ...cond, operator: "is_empty" });

  if (Array.isArray(rawVal)) {
    const lowerArr = rawVal.map((v) => String(v).toLowerCase());
    const tStr = String(target ?? "").toLowerCase();
    if (op === "contains" || op === "equals" || op === "in") return lowerArr.includes(tStr);
    if (op === "not_contains" || op === "not_equals" || op === "not_in") return !lowerArr.includes(tStr);
    return false;
  }

  const strVal = rawVal === null || rawVal === undefined ? "" : String(rawVal);
  const lowerVal = strVal.toLowerCase();
  const lowerTarget = target === null || target === undefined ? "" : String(target).toLowerCase();

  switch (op) {
    case "equals":
    case "eq":
      return lowerVal === lowerTarget;
    case "not_equals":
    case "neq":
      return lowerVal !== lowerTarget;
    case "contains":
      return lowerVal.includes(lowerTarget);
    case "not_contains":
      return !lowerVal.includes(lowerTarget);
    case "starts_with":
      return lowerVal.startsWith(lowerTarget);
    case "ends_with":
      return lowerVal.endsWith(lowerTarget);
    case "in": {
      const list = Array.isArray(target) ? target : String(target || "").split(",");
      return list.map((x) => String(x).trim().toLowerCase()).includes(lowerVal);
    }
    case "not_in": {
      const list = Array.isArray(target) ? target : String(target || "").split(",");
      return !list.map((x) => String(x).trim().toLowerCase()).includes(lowerVal);
    }
    case "gt":
      return Number(rawVal) > Number(target);
    case "gte":
      return Number(rawVal) >= Number(target);
    case "lt":
      return Number(rawVal) < Number(target);
    case "lte":
      return Number(rawVal) <= Number(target);
    case "is_true":
      return rawVal === true || rawVal === 1 || lowerVal === "true" || lowerVal === "1";
    case "is_false":
      return rawVal === false || rawVal === 0 || lowerVal === "false" || lowerVal === "0";
    case "within_days": {
      if (!rawVal) return false;
      const dt = new Date(rawVal).getTime();
      if (Number.isNaN(dt)) return false;
      return Date.now() - dt <= Number(target || 0) * 86400000;
    }
    case "older_than_days": {
      if (!rawVal) return true;
      const dt = new Date(rawVal).getTime();
      if (Number.isNaN(dt)) return false;
      return Date.now() - dt >= Number(target || 0) * 86400000;
    }
    case "after":
      return rawVal ? new Date(rawVal).getTime() > new Date(target).getTime() : false;
    case "before":
      return rawVal ? new Date(rawVal).getTime() < new Date(target).getTime() : false;
    default:
      return lowerVal === lowerTarget;
  }
}

function matchesDefinition(record, definition = {}) {
  const includeRules = Array.isArray(definition.include)
    ? definition.include
    : Array.isArray(definition.rules)
    ? definition.rules
    : [];
  const excludeRules = Array.isArray(definition.exclude) ? definition.exclude : [];
  const logic = String(definition.logic || "AND").toUpperCase();

  let included = true;
  if (includeRules.length > 0) {
    included =
      logic === "OR"
        ? includeRules.some((r) => evaluateCondition(record, r))
        : includeRules.every((r) => evaluateCondition(record, r));
  }
  if (!included) return false;

  if (excludeRules.length > 0) {
    const excludeLogic = String(definition.excludeLogic || "OR").toUpperCase();
    const excluded =
      excludeLogic === "AND"
        ? excludeRules.every((r) => evaluateCondition(record, r))
        : excludeRules.some((r) => evaluateCondition(record, r));
    if (excluded) return false;
  }
  return true;
}

function createAudienceBuilderService(options = {}) {
  const db = createDbHelper(options.db);
  const consentService =
    options.consentService || createConsentSuppressionService({ db: options.db });

  async function listSegments(tenantId, { workspaceId = null, agencyClientId = null, search = null } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?"];
    const params = [tid];
    if (workspaceId) {
      clauses.push("(workspace_id = ? OR workspace_id IS NULL)");
      params.push(Number(workspaceId));
    }
    if (agencyClientId) {
      clauses.push("agency_client_id = ?");
      params.push(Number(agencyClientId));
    }
    if (search) {
      clauses.push("(name LIKE ? OR description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    const rows = await db.query(
      `SELECT * FROM campaign_segments WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC`,
      params
    );
    return rows.map((r) => ({ ...r, definition: safeJsonParse(r.definition_json, {}) }));
  }

  async function getSegment(tenantId, segmentId) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(
      `SELECT * FROM campaign_segments WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(segmentId)]
    );
    if (!row) throw httpError("Audience segment not found", 404, "SEGMENT_NOT_FOUND");
    return { ...row, definition: safeJsonParse(row.definition_json, {}) };
  }

  async function createSegment(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const name = String(input.name || "").trim();
    if (!name) throw httpError("Segment name is required", 400, "SEGMENT_NAME_REQUIRED");

    const definition = input.definition || { logic: "AND", include: [], exclude: [] };
    const defJson = JSON.stringify(definition);

    const res = await db.query(
      `INSERT INTO campaign_segments (
        tenant_id, workspace_id, agency_client_id, name, description,
        segment_type, visibility, preset_key, definition_json, version, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        tid,
        input.workspace_id || null,
        input.agency_client_id || null,
        name,
        input.description || null,
        input.segment_type || "dynamic",
        input.visibility || "workspace",
        input.preset_key || null,
        defJson,
        actorId,
        actorId,
      ]
    );

    await db.query(
      `INSERT INTO campaign_segment_versions (tenant_id, segment_id, version, definition_json, created_by)
       VALUES (?, ?, 1, ?, ?)`,
      [tid, res.insertId, defJson, actorId]
    );

    return getSegment(tid, res.insertId);
  }

  async function updateSegment(tenantId, segmentId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const current = await getSegment(tid, segmentId);
    const nextVersion = Number(current.version || 1) + 1;
    const definition = input.definition || current.definition;
    const defJson = JSON.stringify(definition);

    await db.query(
      `UPDATE campaign_segments
       SET name = ?, description = ?, visibility = ?, definition_json = ?,
           version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [
        input.name ? String(input.name).trim() : current.name,
        input.description !== undefined ? input.description : current.description,
        input.visibility || current.visibility,
        defJson,
        nextVersion,
        actorId,
        tid,
        current.id,
      ]
    );

    await db.query(
      `INSERT INTO campaign_segment_versions (tenant_id, segment_id, version, definition_json, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [tid, current.id, nextVersion, defJson, actorId]
    );

    return getSegment(tid, current.id);
  }

  /**
   * Load candidate contact records strictly scoped to tenant_id.
   * Supports:
   * - Contact Groups from /whatsapp/groups (definition.group_id), enriched with wa_contacts CRM fields
   * - Static audiences (definition.static_contacts)
   * - Dynamic CRM segments over wa_contacts
   */
  async function loadCandidateRecords(tenantId, definition = {}, { workspaceId = null } = {}) {
    const tid = assertTenantId(tenantId);
    const candidates = [];

    // 1. Contact Group source from /whatsapp/groups (exclusive when group_id is specified)
    if (definition.group_id) {
      try {
        const groupContacts = await db.query(
          `SELECT gc.* FROM wa_group_contacts gc
           JOIN wa_contact_groups g ON g.id = gc.group_id
           WHERE g.tenant_id = ? AND gc.group_id = ?`,
          [tid, Number(definition.group_id)]
        );
        const crmContacts = await db.query(`SELECT * FROM wa_contacts WHERE tenant_id = ?`, [tid]).catch(() => []);
        const crmByLast10 = new Map();
        for (const c of crmContacts) {
          const k = String(c.phone || "").replace(/\D/g, "").slice(-10);
          if (k) crmByLast10.set(k, c);
        }
        for (const gc of groupContacts) {
          const last10 = String(gc.phone || "").replace(/\D/g, "").slice(-10);
          const crm = crmByLast10.get(last10) || null;
          const displayName = gc.name || crm?.name || "";
          candidates.push({
            contact_id: crm?.id || null,
            name: displayName,
            first_name: String(displayName).trim().split(/\s+/)[0] || "",
            full_name: String(displayName).trim(),
            phone: gc.phone,
            country_code: gc.country_code || crm?.country_code || "91",
            email: crm?.email || null,
            tags: safeJsonParse(crm?.tags, []),
            custom_fields: { ...safeJsonParse(crm?.custom_fields, {}), notes: gc.notes || crm?.notes || "" },
            is_blocked: crm?.is_blocked || 0,
            is_unsubscribed: crm?.is_unsubscribed || 0,
            source_type: "wa_contact_groups",
          });
        }
      } catch (_) {}
      return candidates;
    }

    // 2. Static contact list source (exclusive when static_contacts is specified without include rules)
    if (Array.isArray(definition.static_contacts) && definition.static_contacts.length) {
      for (const sc of definition.static_contacts) {
        candidates.push({
          contact_id: sc.contact_id || null,
          name: sc.name || "",
          first_name: String(sc.name || "").trim().split(/\s+/)[0] || "",
          full_name: String(sc.name || "").trim(),
          phone: sc.phone || "",
          email: sc.email || null,
          tags: Array.isArray(sc.tags) ? sc.tags : [],
          custom_fields: sc.custom_fields || {},
          source_type: "static_audience",
        });
      }
      if (!Array.isArray(definition.include) || definition.include.length === 0) {
        return candidates;
      }
    }

    // 3. Primary CRM WhatsApp contacts table
    try {
      const clauses = ["tenant_id = ?"];
      const params = [tid];
      if (workspaceId && definition.restrict_to_workspace) {
        clauses.push("(branch_id = ? OR branch_id IS NULL)");
        params.push(Number(workspaceId));
      }
      const contacts = await db.query(
        `SELECT * FROM wa_contacts WHERE ${clauses.join(" AND ")}`,
        params
      );
      for (const c of contacts) {
        candidates.push({
          ...c,
          contact_id: c.id,
          tags: safeJsonParse(c.tags, []),
          custom_fields: safeJsonParse(c.custom_fields, {}),
          first_name: String(c.name || "").trim().split(/\s+/)[0] || "",
          full_name: String(c.name || "").trim(),
          source_type: "wa_contacts",
        });
      }
    } catch (_) {}

    return candidates;
  }

  /**
   * Backend-only audience estimation & eligibility evaluation.
   */
  async function evaluateAudience(
    tenantId,
    definition = {},
    {
      category = "MARKETING",
      purpose = null,
      workspaceId = null,
      agencyClientId = null,
      requiredFields = [],
      missingVariablePolicy = "exclude",
      sampleLimit = 25,
    } = {}
  ) {
    const tid = assertTenantId(tenantId);
    const allCandidates = await loadCandidateRecords(tid, definition, { workspaceId });
    const matched = allCandidates.filter((rec) => matchesDefinition(rec, definition));

    const seenPhones = new Set();
    const eligible = [];
    const excluded = [];

    const stats = {
      total_candidates: allCandidates.length,
      total_matched: matched.length,
      unique_phones: 0,
      duplicate_count: 0,
      invalid_phone_count: 0,
      missing_variable_count: 0,
      no_consent_count: 0,
      opted_out_count: 0,
      suppressed_count: 0,
      eligible_count: 0,
    };

    for (const rec of matched) {
      const phoneCheck = normalizePhone(rec.phone, rec.country_code || "91");
      if (!phoneCheck.valid) {
        stats.invalid_phone_count++;
        excluded.push({
          contact_id: rec.contact_id,
          phone: rec.phone || "",
          name: rec.name || "",
          reason_code: "INVALID_PHONE",
          reason_detail: phoneCheck.reason,
        });
        continue;
      }

      if (seenPhones.has(phoneCheck.normalized)) {
        stats.duplicate_count++;
        excluded.push({
          contact_id: rec.contact_id,
          phone: phoneCheck.normalized,
          name: rec.name || "",
          reason_code: "DUPLICATE_PHONE",
          reason_detail: "Duplicate phone number in audience",
        });
        continue;
      }
      seenPhones.add(phoneCheck.normalized);
      stats.unique_phones++;

      // Check contact-level blocked/unsubscribed flags
      if (Number(rec.is_blocked) === 1 || Number(rec.is_unsubscribed) === 1) {
        stats.opted_out_count++;
        excluded.push({
          contact_id: rec.contact_id,
          phone: phoneCheck.normalized,
          name: rec.name || "",
          reason_code: Number(rec.is_blocked) === 1 ? "CONTACT_BLOCKED" : "OPTED_OUT",
          reason_detail: "Contact marked blocked or unsubscribed",
        });
        continue;
      }

      // Check Consent & Suppression Engine
      const consentCheck = await consentService.checkConsent(tid, phoneCheck.normalized, {
        category,
        purpose,
        workspaceId,
        agencyClientId,
      });

      if (!consentCheck.eligible) {
        if (consentCheck.code === "BLOCKED_BY_SUPPRESSION") {
          stats.suppressed_count++;
        } else {
          stats.no_consent_count++;
        }
        excluded.push({
          contact_id: rec.contact_id,
          phone: phoneCheck.normalized,
          name: rec.name || "",
          reason_code: consentCheck.code,
          reason_detail: consentCheck.reason,
        });
        continue;
      }

      // Check required template personalization fields
      if (requiredFields.length > 0 && missingVariablePolicy === "exclude") {
        const missing = requiredFields.filter((f) => {
          const v = extractFieldValue(rec, f);
          return v === null || v === undefined || String(v).trim() === "";
        });
        if (missing.length > 0) {
          stats.missing_variable_count++;
          excluded.push({
            contact_id: rec.contact_id,
            phone: phoneCheck.normalized,
            name: rec.name || "",
            reason_code: "MISSING_REQUIRED_VARIABLES",
            reason_detail: `Missing required fields: ${missing.join(", ")}`,
          });
          continue;
        }
      }

      eligible.push({
        contact_id: rec.contact_id,
        name: rec.name || "",
        first_name: rec.first_name || "",
        phone: rec.phone,
        normalized_phone: phoneCheck.normalized,
        country_code: phoneCheck.countryCode,
        email: rec.email || null,
        tags: rec.tags || [],
        custom_fields: rec.custom_fields || {},
        consent_id: consentCheck.consent_id || null,
        consent_evidence_ref: consentCheck.evidence_ref || null,
      });
    }

    stats.eligible_count = eligible.length;

    return {
      stats,
      eligible,
      excluded,
      sample_eligible: eligible.slice(0, sampleLimit),
      sample_excluded: excluded.slice(0, sampleLimit),
    };
  }

  async function estimateSegment(tenantId, segmentId, opts = {}) {
    const segment = await getSegment(tenantId, segmentId);
    const result = await evaluateAudience(tenantId, segment.definition, opts);
    await db.query(
      `UPDATE campaign_segments SET estimated_count = ?, last_evaluated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`,
      [result.stats.eligible_count, assertTenantId(tenantId), segment.id]
    );
    return {
      segment_id: segment.id,
      segment_name: segment.name,
      segment_version: segment.version,
      stats: result.stats,
      sample_eligible: result.sample_eligible,
      sample_excluded: result.sample_excluded,
    };
  }

  /**
   * Create controlled audience snapshot when campaign is scheduled or submitted for approval.
   */
  async function createSnapshot(tenantId, { campaignId = null, segmentId = null, definition = null, opts = {}, actorId = null }) {
    const tid = assertTenantId(tenantId);
    let seg = null;
    let effectiveDef = definition;
    if (segmentId) {
      seg = await getSegment(tid, segmentId);
      effectiveDef = seg.definition;
    }
    const evaluation = await evaluateAudience(tid, effectiveDef || {}, opts);
    const s = evaluation.stats;

    const res = await db.query(
      `INSERT INTO campaign_audience_snapshots (
        tenant_id, workspace_id, campaign_id, segment_id, segment_version,
        query_params_json, total_matched, unique_phones, duplicate_count,
        invalid_phone_count, missing_variable_count, no_consent_count,
        opted_out_count, suppressed_count, eligible_count, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        opts.workspaceId || null,
        campaignId,
        seg?.id || null,
        seg?.version || null,
        JSON.stringify({ definition: effectiveDef, category: opts.category || "MARKETING" }),
        s.total_matched,
        s.unique_phones,
        s.duplicate_count,
        s.invalid_phone_count,
        s.missing_variable_count,
        s.no_consent_count,
        s.opted_out_count,
        s.suppressed_count,
        s.eligible_count,
        actorId,
      ]
    );

    return {
      snapshot_id: res.insertId,
      stats: s,
      eligible: evaluation.eligible,
      excluded: evaluation.excluded,
    };
  }

  /**
   * Parse and process CSV/XLSX rows with international phone normalization,
   * duplicate policy, and strict consent-evidence rules (never overrides opt-out).
   */
  async function processImport(
    tenantId,
    {
      filename = "import.csv",
      fileType = "csv",
      rows = [],
      columnMapping = { phone: "phone", name: "name", email: "email", tags: "tags" },
      consentMapping = null,
      duplicatePolicy = "skip", // skip | update | merge
      defaultCountryCode = "91",
      workspaceId = null,
      createStaticSegmentName = null,
    },
    actorId = null
  ) {
    const tid = assertTenantId(tenantId);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw httpError("Import file contains no rows", 400, "EMPTY_IMPORT");
    }
    if (rows.length > 50000) {
      throw httpError("Import exceeds maximum 50,000 rows per file", 400, "IMPORT_TOO_LARGE");
    }

    const impRes = await db.query(
      `INSERT INTO audience_imports (
        tenant_id, workspace_id, filename, file_type, duplicate_policy,
        column_mapping_json, consent_mapping_json, status, total_rows, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PROCESSING', ?, ?)`,
      [
        tid,
        workspaceId,
        filename,
        fileType,
        duplicatePolicy,
        JSON.stringify(columnMapping),
        JSON.stringify(consentMapping || null),
        rows.length,
        actorId,
      ]
    );
    const importId = impRes.insertId;

    const counters = {
      total_rows: rows.length,
      imported_count: 0,
      created_count: 0,
      updated_count: 0,
      skipped_count: 0,
      invalid_count: 0,
      duplicate_count: 0,
      consent_failed_count: 0,
      error_count: 0,
    };

    const seenInFile = new Set();
    const importedContacts = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const rowNum = i + 1;
      const rawPhone = row[columnMapping.phone || "phone"];
      const name = String(row[columnMapping.name || "name"] || "").trim() || "Contact";
      const email = columnMapping.email ? row[columnMapping.email] || null : null;
      const rawTags = columnMapping.tags ? row[columnMapping.tags] : null;
      const tags = Array.isArray(rawTags)
        ? rawTags
        : rawTags
        ? String(rawTags).split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const customFields = {};
      if (columnMapping.custom_fields && typeof columnMapping.custom_fields === "object") {
        for (const [targetKey, colName] of Object.entries(columnMapping.custom_fields)) {
          if (row[colName] !== undefined) customFields[targetKey] = row[colName];
        }
      }

      const phoneCheck = normalizePhone(rawPhone, defaultCountryCode);
      if (!phoneCheck.valid) {
        counters.invalid_count++;
        await db.query(
          `INSERT INTO audience_import_rows (tenant_id, import_id, row_number, raw_phone, status, error_code, error_message)
           VALUES (?, ?, ?, ?, 'invalid', ?, ?)`,
          [tid, importId, rowNum, String(rawPhone || ""), "INVALID_PHONE", phoneCheck.reason]
        );
        continue;
      }

      if (seenInFile.has(phoneCheck.normalized)) {
        counters.duplicate_count++;
        await db.query(
          `INSERT INTO audience_import_rows (tenant_id, import_id, row_number, raw_phone, normalized_phone, status, error_code, error_message)
           VALUES (?, ?, ?, ?, ?, 'duplicate', 'DUPLICATE_IN_FILE', 'Duplicate phone within uploaded file')`,
          [tid, importId, rowNum, String(rawPhone || ""), phoneCheck.normalized]
        );
        continue;
      }
      seenInFile.add(phoneCheck.normalized);

      try {
        const existing = await db.queryOne(
          `SELECT * FROM wa_contacts WHERE tenant_id = ? AND (phone = ? OR phone = ?) LIMIT 1`,
          [tid, phoneCheck.normalized, phoneCheck.normalized.slice(-10)]
        );

        let contactId = existing?.id || null;
        if (existing) {
          if (duplicatePolicy === "skip") {
            counters.duplicate_count++;
            counters.skipped_count++;
            await db.query(
              `INSERT INTO audience_import_rows (tenant_id, import_id, row_number, raw_phone, normalized_phone, status, error_code, contact_id)
               VALUES (?, ?, ?, ?, ?, 'skipped', 'DUPLICATE_EXISTING', ?)`,
              [tid, importId, rowNum, String(rawPhone || ""), phoneCheck.normalized, existing.id]
            );
            continue;
          }
          const existingTags = safeJsonParse(existing.tags, []);
          const mergedTags =
            duplicatePolicy === "merge"
              ? Array.from(new Set([...existingTags, ...tags]))
              : tags.length
              ? tags
              : existingTags;
          const existingCf = safeJsonParse(existing.custom_fields, {});
          const mergedCf = { ...existingCf, ...customFields };

          // NOTE: Never reset is_unsubscribed or is_blocked during import!
          await db.query(
            `UPDATE wa_contacts
             SET name = COALESCE(?, name),
                 email = COALESCE(?, email),
                 tags = ?,
                 custom_fields = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND tenant_id = ?`,
            [name, email, JSON.stringify(mergedTags), JSON.stringify(mergedCf), existing.id, tid]
          );
          counters.updated_count++;
          counters.imported_count++;
        } else {
          const ins = await db.query(
            `INSERT INTO wa_contacts (
              tenant_id, branch_id, name, phone, country_code, email, tags, custom_fields,
              opt_in_status, is_blocked, is_unsubscribed, source, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
            [
              tid,
              workspaceId,
              name,
              phoneCheck.normalized,
              defaultCountryCode,
              email,
              JSON.stringify(tags),
              JSON.stringify(customFields),
              `import:${importId}`,
              actorId,
            ]
          );
          contactId = ins.insertId;
          counters.created_count++;
          counters.imported_count++;
        }

        // Optional consent evidence mapping — strictly guarded against opt-out override
        if (consentMapping && consentMapping.enabled) {
          const wording = consentMapping.wording_col
            ? row[consentMapping.wording_col]
            : consentMapping.captured_wording;
          const formRef = consentMapping.form_ref_col
            ? row[consentMapping.form_ref_col]
            : consentMapping.form_reference;
          if (wording || formRef) {
            try {
              await consentService.recordConsent(
                tid,
                {
                  contact_id: contactId,
                  workspace_id: workspaceId,
                  phone: phoneCheck.normalized,
                  purpose: consentMapping.purpose || "marketing",
                  source: consentMapping.source || `import:${filename}`,
                  collection_method: "csv_import_with_evidence",
                  form_reference: formRef || null,
                  captured_wording: wording || null,
                  wording_version: consentMapping.wording_version || "1.0",
                  is_import: true,
                },
                actorId
              );
            } catch (cErr) {
              counters.consent_failed_count++;
              await db.query(
                `INSERT INTO audience_import_rows (tenant_id, import_id, row_number, raw_phone, normalized_phone, status, error_code, error_message, contact_id)
                 VALUES (?, ?, ?, ?, ?, 'consent_rejected', ?, ?, ?)`,
                [
                  tid,
                  importId,
                  rowNum,
                  String(rawPhone || ""),
                  phoneCheck.normalized,
                  cErr.code || "CONSENT_REJECTED",
                  cErr.message,
                  contactId,
                ]
              );
              importedContacts.push({ contact_id: contactId, name, phone: phoneCheck.normalized });
              continue;
            }
          } else {
            counters.consent_failed_count++;
          }
        }

        await db.query(
          `INSERT INTO audience_import_rows (tenant_id, import_id, row_number, raw_phone, normalized_phone, status, contact_id)
           VALUES (?, ?, ?, ?, ?, 'imported', ?)`,
          [tid, importId, rowNum, String(rawPhone || ""), phoneCheck.normalized, contactId]
        );
        importedContacts.push({ contact_id: contactId, name, phone: phoneCheck.normalized });
      } catch (err) {
        counters.error_count++;
        await db.query(
          `INSERT INTO audience_import_rows (tenant_id, import_id, row_number, raw_phone, normalized_phone, status, error_code, error_message)
           VALUES (?, ?, ?, ?, ?, 'error', 'PROCESSING_ERROR', ?)`,
          [tid, importId, rowNum, String(rawPhone || ""), phoneCheck.normalized, err.message]
        );
      }
    }

    let createdSegmentId = null;
    if (createStaticSegmentName && importedContacts.length > 0) {
      const seg = await createSegment(
        tid,
        {
          name: createStaticSegmentName,
          workspace_id: workspaceId,
          segment_type: "static",
          definition: { logic: "AND", static_contacts: importedContacts },
        },
        actorId
      );
      createdSegmentId = seg.id;
    }

    await db.query(
      `UPDATE audience_imports
       SET status = 'COMPLETED',
           imported_count = ?, created_count = ?, updated_count = ?, skipped_count = ?,
           invalid_count = ?, duplicate_count = ?, consent_failed_count = ?, error_count = ?,
           segment_id = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [
        counters.imported_count,
        counters.created_count,
        counters.updated_count,
        counters.skipped_count,
        counters.invalid_count,
        counters.duplicate_count,
        counters.consent_failed_count,
        counters.error_count,
        createdSegmentId,
        importId,
        tid,
      ]
    );

    return {
      id: importId,
      status: "COMPLETED",
      segment_id: createdSegmentId,
      ...counters,
    };
  }

  async function getImportReport(tenantId, importId) {
    const tid = assertTenantId(tenantId);
    const imp = await db.queryOne(
      `SELECT * FROM audience_imports WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(importId)]
    );
    if (!imp) throw httpError("Import job not found", 404, "IMPORT_NOT_FOUND");
    const errorRows = await db.query(
      `SELECT row_number, status, error_code, error_message
       FROM audience_import_rows
       WHERE tenant_id = ? AND import_id = ? AND status != 'imported'
       ORDER BY row_number ASC LIMIT 1000`,
      [tid, Number(importId)]
    );
    return { ...imp, error_rows: errorRows };
  }

  async function listImports(tenantId, limit = 50) {
    const tid = assertTenantId(tenantId);
    return db.query(
      `SELECT * FROM audience_imports WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
      [tid, Math.min(200, Number(limit) || 50)]
    );
  }

  return {
    SEGMENT_PRESETS,
    evaluateCondition,
    matchesDefinition,
    listSegments,
    getSegment,
    createSegment,
    updateSegment,
    evaluateAudience,
    estimateSegment,
    createSnapshot,
    processImport,
    getImportReport,
    listImports,
  };
}

module.exports = { createAudienceBuilderService, SEGMENT_PRESETS, evaluateCondition, matchesDefinition };
