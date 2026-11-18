"use strict";

/**
 * templateManagementService.js
 *
 * WABA-scoped WhatsApp Template Management & Personalization Renderer.
 * - Syncs real templates from Meta Graph API via Madhura Provider Gateway
 * - Creates templates (TEXT/IMAGE/VIDEO/DOCUMENT header, BODY, FOOTER,
 *   QUICK_REPLY, URL, PHONE_NUMBER, FLOW buttons) — never marks approved locally
 * - Prevents misclassifying promotional content as UTILITY
 * - Handles Meta template status updates (PAUSED, REJECTED, DISABLED, DELETED)
 *   and stops affected active/scheduled campaigns cleanly
 * - Provides TemplateRendererService with conditional values, locale/currency/date
 *   formatting, fallback policies, and strict missing-variable exclusion
 */

const {
  createDbHelper,
  assertTenantId,
  safeJsonParse,
  httpError,
} = require("./dbHelper");
const { createProviderGateway } = require("./providerGateway");

const PROMOTIONAL_SIGNALS = [
  /\b(\d+%\s*off|flat\s*discount|flash\s*sale|mega\s*sale|promo\s*code|coupon|limited[\s-]time\s*offer|buy\s*1\s*get\s*1|bogo|special\s*offer|exclusive\s*deal)\b/i,
];

const ALLOWED_META_STATUSES = new Set([
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "DISABLED",
  "DELETED",
  "IN_APPEAL",
  "PENDING_DELETION",
  "UNAVAILABLE",
]);

function validateCategoryPolicy(category, bodyText) {
  const cat = String(category || "MARKETING").toUpperCase();
  if (!["MARKETING", "UTILITY", "AUTHENTICATION"].includes(cat)) {
    throw httpError(`Invalid Meta template category: ${cat}`, 400, "INVALID_TEMPLATE_CATEGORY");
  }
  if (cat === "UTILITY" && PROMOTIONAL_SIGNALS.some((rx) => rx.test(String(bodyText || "")))) {
    throw httpError(
      "Promotional/discount content cannot be classified as UTILITY under Meta template policy. Select MARKETING.",
      400,
      "UTILITY_MISCLASSIFICATION_BLOCKED"
    );
  }
}

function extractVariableIndices(text) {
  const matches = [...String(text || "").matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return Array.from(new Set(matches)).sort((a, b) => a - b);
}

function formatValue(val, formatSpec = {}) {
  if (val === null || val === undefined || val === "") return "";
  const type = formatSpec.type || "text";
  const locale = formatSpec.locale || "en-IN";
  if (type === "currency") {
    const num = Number(val);
    if (Number.isNaN(num)) return String(val);
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: formatSpec.currency || "INR",
      }).format(num);
    } catch {
      return `${formatSpec.currency || "INR"} ${num.toFixed(2)}`;
    }
  }
  if (type === "number") {
    const num = Number(val);
    if (Number.isNaN(num)) return String(val);
    return new Intl.NumberFormat(locale).format(num);
  }
  if (type === "date" || type === "datetime") {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        ...(type === "datetime" ? { timeStyle: "short" } : {}),
        ...(formatSpec.timezone ? { timeZone: formatSpec.timezone } : {}),
      }).format(d);
    } catch {
      return d.toISOString();
    }
  }
  return String(val);
}

function readContactAttr(contact, fieldPath) {
  if (!contact || !fieldPath) return undefined;
  const parts = String(fieldPath).split(".");
  let cur = contact;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Pure TemplateRendererService — safe substitution, conditional rules,
 * formatting, and strict missing-variable policy.
 */
function renderTemplateForRecipient(template, contact, mapping = {}, options = {}) {
  const missingPolicy = options.missingVariablePolicy || "exclude";
  const body = String(template?.body || "");
  const indices = extractVariableIndices(body);
  const resolvedParams = [];
  const missingVars = [];

  for (const idx of indices) {
    const key = String(idx);
    const rule = mapping[key] || mapping[`{{${key}}}`] || null;
    let rawVal;

    if (typeof rule === "string") {
      rawVal = readContactAttr(contact, rule);
    } else if (rule && typeof rule === "object") {
      // Conditional override support
      if (Array.isArray(rule.conditions)) {
        for (const cond of rule.conditions) {
          const checkVal = readContactAttr(contact, cond.when_field);
          if (String(checkVal ?? "").toLowerCase() === String(cond.equals ?? "").toLowerCase()) {
            rawVal = cond.value;
            break;
          }
        }
      }
      if (rawVal === undefined && rule.field) {
        rawVal = readContactAttr(contact, rule.field);
      }
      if ((rawVal === undefined || rawVal === null || String(rawVal).trim() === "") && rule.static_value !== undefined) {
        rawVal = rule.static_value;
      }
      if ((rawVal === undefined || rawVal === null || String(rawVal).trim() === "") && rule.fallback !== undefined && rule.fallback !== "") {
        rawVal = rule.fallback;
      }
      if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== "") {
        rawVal = formatValue(rawVal, rule.format || {});
      }
    }

    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === "") {
      missingVars.push(key);
      if (missingPolicy === "exclude") {
        return {
          ok: false,
          missingVariables: missingVars,
          error: `Missing required template variable {{${key}}}`,
        };
      }
      rawVal = "";
    }

    // Sanitize newlines/tabs that Meta rejects inside template parameters
    const sanitized = String(rawVal).replace(/[\r\n\t]+/g, " ").replace(/\s{5,}/g, "    ").trim().slice(0, 1024);
    resolvedParams.push({ index: idx, value: sanitized });
  }

  let renderedBody = body;
  for (const p of resolvedParams) {
    renderedBody = renderedBody.replaceAll(`{{${p.index}}}`, p.value);
  }

  const components = [];
  if (options.headerMediaUrl && ["IMAGE", "VIDEO", "DOCUMENT"].includes(String(template.header_type || "").toUpperCase())) {
    const mediaType = String(template.header_type).toLowerCase();
    components.push({
      type: "header",
      parameters: [{ type: mediaType, [mediaType]: { link: options.headerMediaUrl } }],
    });
  }

  if (resolvedParams.length > 0) {
    components.push({
      type: "body",
      parameters: resolvedParams.map((p) => ({ type: "text", text: p.value })),
    });
  }

  // Attach FLOW button action payload if template contains a FLOW button
  const buttons = safeJsonParse(template.buttons, []);
  if (Array.isArray(buttons)) {
    buttons.forEach((btn, idx) => {
      if (String(btn?.type || "").toUpperCase() === "FLOW" && options.flowToken) {
        components.push({
          type: "button",
          sub_type: "flow",
          index: String(idx),
          parameters: [
            {
              type: "action",
              action: {
                flow_token: String(options.flowToken),
                ...(options.flowActionData ? { flow_action_data: options.flowActionData } : {}),
              },
            },
          ],
        });
      }
    });
  }

  return {
    ok: true,
    renderedBody,
    parameters: resolvedParams,
    components,
    missingVariables: [],
  };
}

function createTemplateManagementService(options = {}) {
  const db = createDbHelper(options.db);
  const gateway = options.gateway || createProviderGateway({ db: options.db });

  async function listTemplates(tenantId, { wabaId = null, category = null, status = null, search = null } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?", "(archived IS NULL OR archived = 0)"];
    const params = [tid];
    if (wabaId) {
      clauses.push("waba_id = ?");
      params.push(wabaId);
    }
    if (category) {
      clauses.push("category = ?");
      params.push(String(category).toUpperCase());
    }
    if (status) {
      clauses.push("meta_status = ?");
      params.push(String(status).toUpperCase());
    }
    if (search) {
      clauses.push("(name LIKE ? OR body LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    const rows = await db.query(
      `SELECT * FROM wa_templates WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT 500`,
      params
    );
    return rows.map((r) => ({
      ...r,
      buttons: safeJsonParse(r.buttons, []),
      variables: extractVariableIndices(r.body),
    }));
  }

  async function getTemplate(tenantId, templateId) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(
      `SELECT * FROM wa_templates WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(templateId)]
    );
    if (!row) throw httpError("Template not found", 404, "TEMPLATE_NOT_FOUND");
    return {
      ...row,
      buttons: safeJsonParse(row.buttons, []),
      variables: extractVariableIndices(row.body),
    };
  }

  /**
   * Build validated Meta Graph API components array for template submission.
   */
  function buildMetaComponents(input) {
    const components = [];
    if (input.header_type && input.header_type !== "NONE") {
      const hType = String(input.header_type).toUpperCase();
      if (hType === "TEXT") {
        if (!input.header_value) throw httpError("Header text is required for TEXT header", 400);
        components.push({ type: "HEADER", format: "TEXT", text: String(input.header_value).slice(0, 60) });
      } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(hType)) {
        components.push({
          type: "HEADER",
          format: hType,
          ...(input.header_example_handle ? { example: { header_handle: [input.header_example_handle] } } : {}),
        });
      }
    }

    const bodyIndices = extractVariableIndices(input.body);
    const bodyComp = { type: "BODY", text: String(input.body) };
    if (bodyIndices.length > 0) {
      const examples = Array.isArray(input.examples) ? input.examples : [];
      if (examples.length !== bodyIndices.length) {
        throw httpError(
          `Provide ${bodyIndices.length} example value(s) for body variables`,
          400,
          "TEMPLATE_EXAMPLES_REQUIRED"
        );
      }
      bodyComp.example = { body_text: [examples.map((e) => String(e))] };
    }
    components.push(bodyComp);

    if (input.footer) {
      components.push({ type: "FOOTER", text: String(input.footer).slice(0, 60) });
    }

    const buttons = Array.isArray(input.buttons) ? input.buttons : [];
    if (buttons.length > 0) {
      const normalizedButtons = buttons.map((b) => {
        const bType = String(b.type || "").toUpperCase();
        if (bType === "QUICK_REPLY") return { type: "QUICK_REPLY", text: String(b.text || "").slice(0, 25) };
        if (bType === "URL") return { type: "URL", text: String(b.text || "").slice(0, 25), url: String(b.url || "") };
        if (bType === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: String(b.text || "").slice(0, 25), phone_number: String(b.phone_number || "") };
        if (bType === "FLOW") {
          if (!b.flow_id && !b.flow_name) {
            throw httpError("FLOW button requires a published Meta flow_id or flow_name", 400, "FLOW_BUTTON_INVALID");
          }
          return {
            type: "FLOW",
            text: String(b.text || "Open Form").slice(0, 25),
            ...(b.flow_id ? { flow_id: String(b.flow_id) } : { flow_name: String(b.flow_name) }),
            flow_action: b.flow_action || "navigate",
            ...(b.navigate_screen ? { navigate_screen: b.navigate_screen } : {}),
          };
        }
        throw httpError(`Unsupported template button type: ${bType}`, 400, "UNSUPPORTED_BUTTON");
      });
      components.push({ type: "BUTTONS", buttons: normalizedButtons });
    }
    return components;
  }

  /**
   * Save local draft — NEVER marks template APPROVED.
   */
  async function createLocalTemplate(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const name = String(input.name || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{1,512}$/.test(name)) {
      throw httpError("Template name must contain only lowercase letters, numbers, and underscores", 400, "INVALID_TEMPLATE_NAME");
    }
    if (!input.body || String(input.body).length > 4096) {
      throw httpError("Template body is required (max 4096 chars)", 400, "INVALID_TEMPLATE_BODY");
    }
    const category = String(input.category || "MARKETING").toUpperCase();
    validateCategoryPolicy(category, input.body);

    const language = String(input.language || "en");
    const buttons = Array.isArray(input.buttons) ? input.buttons : [];
    const components = buildMetaComponents({ ...input, name, category, language, buttons });

    const res = await db.query(
      `INSERT INTO wa_templates (
        tenant_id, name, category, language, header_type, header_value, body, footer,
        buttons, variables, waba_id, sender_id, meta_status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [
        tid,
        name,
        category,
        language,
        input.header_type || null,
        input.header_value || null,
        input.body,
        input.footer || null,
        JSON.stringify(buttons),
        JSON.stringify(extractVariableIndices(input.body)),
        input.waba_id || null,
        input.sender_id || null,
        actorId,
      ]
    );

    await db.query(
      `INSERT INTO whatsapp_template_versions (tenant_id, template_id, version, components_json, category, language, meta_status, created_by)
       VALUES (?, ?, 1, ?, ?, ?, 'DRAFT', ?)`,
      [tid, res.insertId, JSON.stringify(components), category, language, actorId]
    );

    return getTemplate(tid, res.insertId);
  }

  async function submitTemplateToMeta(tenantId, templateId, { senderId, wabaId = null, examples = [] }, actorId = null) {
    const tid = assertTenantId(tenantId);
    const tmpl = await getTemplate(tid, templateId);
    validateCategoryPolicy(tmpl.category, tmpl.body);
    const components = buildMetaComponents({
      header_type: tmpl.header_type,
      header_value: tmpl.header_value,
      body: tmpl.body,
      footer: tmpl.footer,
      buttons: tmpl.buttons,
      examples,
    });

    const sender = await gateway.resolveAuthorizedSender(tid, { senderId, wabaId });
    const metaRes = await gateway.createTemplate(tid, {
      senderId: sender.sender_id,
      payload: {
        name: tmpl.name,
        language: tmpl.language,
        category: tmpl.category,
        components,
      },
    });

    const metaStatus = ALLOWED_META_STATUSES.has(String(metaRes?.status || "").toUpperCase())
      ? String(metaRes.status).toUpperCase()
      : "PENDING";

    await db.query(
      `UPDATE wa_templates
       SET meta_template_id = ?, meta_status = ?, waba_id = ?, sender_id = ?, last_synced_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [metaRes?.id || null, metaStatus, sender.waba_id, sender.sender_id, tid, tmpl.id]
    );

    await db.query(
      `INSERT INTO whatsapp_template_status_events (tenant_id, template_id, meta_template_id, waba_id, previous_status, new_status, source)
       VALUES (?, ?, ?, ?, ?, ?, 'meta_submission')`,
      [tid, tmpl.id, metaRes?.id || null, sender.waba_id, tmpl.meta_status, metaStatus]
    );

    return getTemplate(tid, tmpl.id);
  }

  async function syncFromMeta(tenantId, { senderId, wabaId = null }, actorId = null) {
    const tid = assertTenantId(tenantId);
    const synced = await gateway.syncTemplates(tid, { senderId, wabaId });
    let count = 0;

    for (const item of synced.templates) {
      if (!item.id || !item.name) continue;
      const bodyComp = (item.components || []).find((c) => c.type === "BODY");
      const headerComp = (item.components || []).find((c) => c.type === "HEADER");
      const footerComp = (item.components || []).find((c) => c.type === "FOOTER");
      const buttonsComp = (item.components || []).find((c) => c.type === "BUTTONS");
      const quality = item.quality_score?.score || (typeof item.quality_score === "string" ? item.quality_score : null);
      const status = String(item.status || "PENDING").toUpperCase();

      const existing = await db.queryOne(
        `SELECT id, meta_status, category FROM wa_templates WHERE tenant_id = ? AND waba_id = ? AND meta_template_id = ? LIMIT 1`,
        [tid, synced.waba_id, String(item.id)]
      );

      if (existing) {
        await db.query(
          `UPDATE wa_templates
           SET name = ?, category = ?, language = ?, header_type = ?, header_value = ?,
               body = ?, footer = ?, buttons = ?, meta_status = ?, quality_score = ?,
               rejection_reason = ?, sender_id = ?, last_synced_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ?`,
          [
            item.name,
            item.category || "MARKETING",
            item.language || "en",
            headerComp?.format || null,
            headerComp?.text || null,
            bodyComp?.text || "",
            footerComp?.text || null,
            JSON.stringify(buttonsComp?.buttons || []),
            status,
            quality,
            item.rejected_reason || null,
            synced.sender_id,
            existing.id,
            tid,
          ]
        );
        if (existing.meta_status !== status) {
          await handleTemplateStatusTransition(tid, existing.id, existing.meta_status, status, item.rejected_reason || null, "meta_sync");
        }
      } else {
        await db.query(
          `INSERT INTO wa_templates (
            tenant_id, name, category, language, header_type, header_value, body, footer,
            buttons, meta_template_id, meta_status, quality_score, rejection_reason,
            waba_id, sender_id, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            tid,
            item.name,
            item.category || "MARKETING",
            item.language || "en",
            headerComp?.format || null,
            headerComp?.text || null,
            bodyComp?.text || "",
            footerComp?.text || null,
            JSON.stringify(buttonsComp?.buttons || []),
            String(item.id),
            status,
            quality,
            item.rejected_reason || null,
            synced.waba_id,
            synced.sender_id,
          ]
        );
      }
      count++;
    }

    await db.query(
      `INSERT INTO whatsapp_template_sync_logs (tenant_id, waba_id, sender_id, synced_count, status, synced_by)
       VALUES (?, ?, ?, ?, 'success', ?)`,
      [tid, synced.waba_id, synced.sender_id, count, actorId]
    );

    return { synced_count: count, waba_id: synced.waba_id };
  }

  /**
   * When Meta rejects, pauses, disables, or deletes a template, automatically
   * pause scheduled/running campaigns relying on it and block unsent recipients.
   */
  async function handleTemplateStatusTransition(tenantId, templateId, previousStatus, newStatus, reason = null, source = "webhook") {
    const tid = assertTenantId(tenantId);
    const tmpl = await db.queryOne(`SELECT * FROM wa_templates WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(templateId)]);
    if (!tmpl) return { updated: false };

    const normalizedStatus = String(newStatus || "").toUpperCase();
    await db.query(
      `UPDATE wa_templates SET meta_status = ?, rejection_reason = COALESCE(?, rejection_reason), last_synced_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [normalizedStatus, reason, tid, tmpl.id]
    );

    await db.query(
      `INSERT INTO whatsapp_template_status_events (
        tenant_id, template_id, meta_template_id, waba_id, previous_status, new_status, reason, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tid, tmpl.id, tmpl.meta_template_id, tmpl.waba_id, previousStatus || tmpl.meta_status, normalizedStatus, reason, source]
    );

    let pausedCampaigns = 0;
    if (["REJECTED", "PAUSED", "DISABLED", "DELETED", "UNAVAILABLE"].includes(normalizedStatus)) {
      const activeCampaigns = await db.query(
        `SELECT id FROM campaigns
         WHERE tenant_id = ? AND template_id = ? AND status IN ('SCHEDULED','PREPARING','RUNNING')`,
        [tid, tmpl.id]
      );
      for (const camp of activeCampaigns) {
        await db.query(
          `UPDATE campaigns
           SET status = 'PAUSED',
               paused_at = CURRENT_TIMESTAMP,
               pause_reason = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND id = ?`,
          [`Template '${tmpl.name}' became ${normalizedStatus}${reason ? `: ${reason}` : ""}`, tid, camp.id]
        );
        await db.query(
          `UPDATE campaign_recipients
           SET status = 'BLOCKED_BY_TEMPLATE',
               exclusion_reason = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND campaign_id = ? AND status IN ('PENDING','WAITING_FOR_SCHEDULE','QUEUED','RESERVED')`,
          [`template_${normalizedStatus.toLowerCase()}`, tid, camp.id]
        );
        pausedCampaigns++;
      }
    }

    return { updated: true, new_status: normalizedStatus, paused_campaigns: pausedCampaigns };
  }

  /**
   * Verify template is strictly approved and belongs to the selected WABA.
   */
  async function assertTemplateEligibleForWaba(tenantId, templateId, wabaId) {
    const tmpl = await getTemplate(tenantId, templateId);
    if (tmpl.meta_status !== "APPROVED" || !tmpl.meta_template_id) {
      throw httpError(
        `Template '${tmpl.name}' is not approved by Meta (status=${tmpl.meta_status})`,
        409,
        "TEMPLATE_NOT_APPROVED"
      );
    }
    if (wabaId && tmpl.waba_id && String(tmpl.waba_id) !== String(wabaId)) {
      throw httpError(
        `Template '${tmpl.name}' belongs to WABA ${tmpl.waba_id}, not selected WABA ${wabaId}`,
        409,
        "TEMPLATE_WABA_MISMATCH"
      );
    }
    return tmpl;
  }

  return {
    listTemplates,
    getTemplate,
    createLocalTemplate,
    submitTemplateToMeta,
    syncFromMeta,
    handleTemplateStatusTransition,
    assertTemplateEligibleForWaba,
    validateCategoryPolicy,
    renderTemplateForRecipient,
    extractVariableIndices,
  };
}

module.exports = {
  createTemplateManagementService,
  renderTemplateForRecipient,
  validateCategoryPolicy,
  extractVariableIndices,
};
