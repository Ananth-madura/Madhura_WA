"use strict";

/**
 * whatsappFlowsService.js
 *
 * Dedicated Meta WhatsApp Flows Management Engine (strictly distinct from Madhura Flowbot).
 * - Visual screen JSON validation against official Meta Flow JSON schema
 * - Full lifecycle: DRAFT -> VALIDATED -> PUBLISHED (immutable!) -> DEPRECATED
 * - Clone published flow to create a new editable version (never overwrites published JSON)
 * - Static & Dynamic Flow support with secure endpoint linkage
 * - Flow execution & completion tracking correlated by flow_token to campaign_id & recipient_id
 */

const {
  createDbHelper,
  assertTenantId,
  safeJsonParse,
  generateUid,
  httpError,
} = require("./dbHelper");
const { createProviderGateway } = require("./providerGateway");

const SUPPORTED_FLOW_CATEGORIES = new Set([
  "LEAD_GENERATION",
  "APPOINTMENT_BOOKING",
  "CUSTOMER_SUPPORT",
  "CONTACT_US",
  "SURVEY",
  "SHOPPING",
  "SIGN_UP",
  "SIGN_IN",
  "OTHER",
]);

const OFFICIAL_FLOW_COMPONENTS = new Set([
  "TextHeading",
  "TextSubheading",
  "TextBody",
  "TextCaption",
  "RichText",
  "TextInput",
  "TextArea",
  "RadioButtonsGroup",
  "CheckboxGroup",
  "Dropdown",
  "DatePicker",
  "CalendarPicker",
  "OptIn",
  "Image",
  "EmbeddedLink",
  "Footer",
  "Form",
  "If",
  "Switch",
  "NavigationList",
  "ChipsSelector",
  "PhotoPicker",
  "DocumentPicker",
]);

const FORBIDDEN_PAYMENT_FIELDS = /card_?number|cvv|cvc|credit_?card|debit_?card|card_?expiry/i;

/**
 * Validate Meta WhatsApp Flow JSON schema (static or dynamic).
 */
function validateFlowJson(rawJson) {
  const errors = [];
  const warnings = [];
  const doc = typeof rawJson === "string" ? safeJsonParse(rawJson, null) : rawJson;

  if (!doc || typeof doc !== "object") {
    return { valid: false, errors: ["Flow JSON must be a valid JSON object"], warnings };
  }
  if (!doc.version || !/^\d+\.\d+$/.test(String(doc.version))) {
    errors.push("Flow JSON requires a valid Meta version string (e.g. '6.0' or '7.0')");
  }
  if (!Array.isArray(doc.screens) || doc.screens.length === 0) {
    errors.push("Flow JSON must contain at least one screen in 'screens'");
    return { valid: false, errors, warnings };
  }

  const screenIds = new Set();
  let hasTerminalScreen = false;

  for (const screen of doc.screens) {
    if (!screen || typeof screen !== "object") {
      errors.push("Each screen must be an object");
      continue;
    }
    if (!screen.id || !/^[A-Z0-9_]{1,64}$/.test(String(screen.id))) {
      errors.push(`Invalid screen id '${screen.id || ""}': must be uppercase letters, numbers, underscores`);
    } else if (screenIds.has(screen.id)) {
      errors.push(`Duplicate screen id '${screen.id}'`);
    } else {
      screenIds.add(screen.id);
    }

    if (screen.terminal) hasTerminalScreen = true;
    if (!screen.layout || screen.layout.type !== "SingleColumnLayout" || !Array.isArray(screen.layout.children)) {
      errors.push(`Screen '${screen.id}' must have layout.type='SingleColumnLayout' with children array`);
      continue;
    }

    const inspectChildren = (children) => {
      for (const child of children) {
        if (!child || !child.type) {
          errors.push(`Screen '${screen.id}' contains a component without 'type'`);
          continue;
        }
        if (!OFFICIAL_FLOW_COMPONENTS.has(child.type)) {
          errors.push(`Screen '${screen.id}' uses unsupported custom component '${child.type}'`);
        }
        if (child.name && FORBIDDEN_PAYMENT_FIELDS.test(String(child.name))) {
          errors.push(`Screen '${screen.id}' field '${child.name}' violates policy: never collect payment card details in a WhatsApp Flow`);
        }
        if (Array.isArray(child.children)) inspectChildren(child.children);
      }
    };
    inspectChildren(screen.layout.children);
  }

  if (!hasTerminalScreen) {
    warnings.push("No screen is marked terminal: true; Meta requires at least one terminal completion screen before publishing.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

function createWhatsAppFlowsService(options = {}) {
  const db = createDbHelper(options.db);
  const gateway = options.gateway || createProviderGateway({ db: options.db });

  async function listFlows(tenantId, { wabaId = null, status = null, category = null } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?"];
    const params = [tid];
    if (wabaId) {
      clauses.push("waba_id = ?");
      params.push(wabaId);
    }
    if (status) {
      clauses.push("meta_status = ?");
      params.push(String(status).toUpperCase());
    }
    if (category) {
      clauses.push("category = ?");
      params.push(String(category).toUpperCase());
    }
    const rows = await db.query(
      `SELECT * FROM whatsapp_flows WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC`,
      params
    );
    return rows.map((r) => ({
      ...r,
      flow_json_parsed: safeJsonParse(r.flow_json, {}),
      validation_errors: safeJsonParse(r.validation_errors_json, []),
    }));
  }

  async function getFlow(tenantId, flowId) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(
      `SELECT * FROM whatsapp_flows WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(flowId)]
    );
    if (!row) throw httpError("WhatsApp Flow not found", 404, "WHATSAPP_FLOW_NOT_FOUND");
    const versions = await db.query(
      `SELECT id, version_number, json_version, meta_status, is_immutable, created_at
       FROM whatsapp_flow_versions WHERE tenant_id = ? AND flow_id = ? ORDER BY version_number DESC`,
      [tid, row.id]
    );
    return {
      ...row,
      flow_json_parsed: safeJsonParse(row.flow_json, {}),
      validation_errors: safeJsonParse(row.validation_errors_json, []),
      versions,
    };
  }

  async function createFlow(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const name = String(input.name || "").trim();
    if (!name) throw httpError("WhatsApp Flow name is required", 400, "FLOW_NAME_REQUIRED");

    const category = String(input.category || "LEAD_GENERATION").toUpperCase();
    if (!SUPPORTED_FLOW_CATEGORIES.has(category)) {
      throw httpError(`Unsupported Flow category: ${category}`, 400, "INVALID_FLOW_CATEGORY");
    }

    const flowMode = input.flow_mode === "dynamic" ? "dynamic" : "static";
    if (flowMode === "dynamic" && !input.endpoint_uri) {
      throw httpError("Dynamic Flows require an HTTPS data-exchange endpoint_uri", 400, "FLOW_ENDPOINT_REQUIRED");
    }

    const flowObj = input.flow_json || {
      version: input.json_version || "6.0",
      ...(flowMode === "dynamic" ? { data_api_version: "3.0" } : {}),
      screens: [
        {
          id: "WELCOME",
          title: name,
          terminal: true,
          layout: {
            type: "SingleColumnLayout",
            children: [
              { type: "TextHeading", text: name },
              { type: "TextBody", text: "Please share your details below." },
              { type: "TextInput", name: "full_name", label: "Full Name", required: true },
              { type: "Footer", label: "Submit", "on-click-action": { name: "complete", payload: { full_name: "${form.full_name}" } } },
            ],
          },
        },
      ],
    };

    const validation = validateFlowJson(flowObj);
    const flowJsonStr = typeof flowObj === "string" ? flowObj : JSON.stringify(flowObj);
    const jsonVersion = String(flowObj.version || input.json_version || "6.0");

    let metaFlowId = input.meta_flow_id || null;
    if (input.syncToMeta && input.sender_id) {
      const metaRes = await gateway.createWhatsAppFlow(tid, {
        senderId: input.sender_id,
        wabaId: input.waba_id,
        name,
        categories: [category],
        endpointUri: flowMode === "dynamic" ? input.endpoint_uri : null,
      });
      metaFlowId = metaRes?.id || null;
    }

    const res = await db.query(
      `INSERT INTO whatsapp_flows (
        tenant_id, workspace_id, waba_id, sender_id, meta_flow_id, name, category,
        flow_mode, json_version, local_version, meta_status, flow_json,
        data_api_version, endpoint_uri, validation_errors_json, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'DRAFT', ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        input.workspace_id || null,
        input.waba_id || null,
        input.sender_id || null,
        metaFlowId,
        name,
        category,
        flowMode,
        jsonVersion,
        flowJsonStr,
        flowMode === "dynamic" ? input.data_api_version || "3.0" : null,
        input.endpoint_uri || null,
        JSON.stringify(validation.errors),
        actorId,
        actorId,
      ]
    );

    await db.query(
      `INSERT INTO whatsapp_flow_versions (tenant_id, flow_id, version_number, json_version, flow_json, meta_status, is_immutable, created_by)
       VALUES (?, ?, 1, ?, ?, 'DRAFT', 0, ?)`,
      [tid, res.insertId, jsonVersion, flowJsonStr, actorId]
    );

    await db.query(
      `INSERT INTO whatsapp_flow_validations (tenant_id, flow_id, valid, errors_json, warnings_json, source)
       VALUES (?, ?, ?, ?, ?, 'local_schema')`,
      [tid, res.insertId, validation.valid ? 1 : 0, JSON.stringify(validation.errors), JSON.stringify(validation.warnings)]
    );

    return getFlow(tid, res.insertId);
  }

  /**
   * Update DRAFT Flow JSON. Strictly refuses overwriting PUBLISHED or DEPRECATED flows!
   */
  async function updateFlow(tenantId, flowId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const current = await getFlow(tid, flowId);

    if (current.meta_status === "PUBLISHED") {
      throw httpError(
        "Published WhatsApp Flows are immutable on Meta. Clone this Flow to create a new draft version.",
        409,
        "PUBLISHED_FLOW_IMMUTABLE"
      );
    }
    if (current.meta_status === "DEPRECATED") {
      throw httpError("Deprecated WhatsApp Flows cannot be edited. Clone to create a new Flow.", 409, "DEPRECATED_FLOW_IMMUTABLE");
    }

    const nextFlowObj = input.flow_json !== undefined ? input.flow_json : current.flow_json_parsed;
    const validation = validateFlowJson(nextFlowObj);
    const flowJsonStr = typeof nextFlowObj === "string" ? nextFlowObj : JSON.stringify(nextFlowObj);
    const nextVersion = Number(current.local_version || 1) + 1;

    await db.query(
      `UPDATE whatsapp_flows
       SET name = ?, category = ?, flow_mode = ?, flow_json = ?,
           endpoint_uri = ?, local_version = ?, validation_errors_json = ?,
           updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [
        input.name ? String(input.name).trim() : current.name,
        input.category ? String(input.category).toUpperCase() : current.category,
        input.flow_mode || current.flow_mode,
        flowJsonStr,
        input.endpoint_uri !== undefined ? input.endpoint_uri : current.endpoint_uri,
        nextVersion,
        JSON.stringify(validation.errors),
        actorId,
        tid,
        current.id,
      ]
    );

    await db.query(
      `INSERT INTO whatsapp_flow_versions (tenant_id, flow_id, version_number, json_version, flow_json, meta_status, is_immutable, created_by)
       VALUES (?, ?, ?, ?, ?, 'DRAFT', 0, ?)`,
      [tid, current.id, nextVersion, nextFlowObj.version || current.json_version, flowJsonStr, actorId]
    );

    await db.query(
      `INSERT INTO whatsapp_flow_validations (tenant_id, flow_id, valid, errors_json, warnings_json, source)
       VALUES (?, ?, ?, ?, ?, 'local_schema')`,
      [tid, current.id, validation.valid ? 1 : 0, JSON.stringify(validation.errors), JSON.stringify(validation.warnings)]
    );

    return { ...(await getFlow(tid, current.id)), validation };
  }

  async function validateFlow(tenantId, flowId) {
    const tid = assertTenantId(tenantId);
    const flow = await getFlow(tid, flowId);
    const validation = validateFlowJson(flow.flow_json_parsed);
    await db.query(
      `INSERT INTO whatsapp_flow_validations (tenant_id, flow_id, valid, errors_json, warnings_json, source)
       VALUES (?, ?, ?, ?, ?, 'local_schema')`,
      [tid, flow.id, validation.valid ? 1 : 0, JSON.stringify(validation.errors), JSON.stringify(validation.warnings)]
    );
    await db.query(
      `UPDATE whatsapp_flows SET validation_errors_json = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`,
      [JSON.stringify(validation.errors), tid, flow.id]
    );
    return { flow_id: flow.id, ...validation };
  }

  async function publishFlow(tenantId, flowId, { senderId = null, callMetaApi = true } = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const flow = await getFlow(tid, flowId);
    if (flow.meta_status === "PUBLISHED") {
      throw httpError("WhatsApp Flow is already published", 409, "FLOW_ALREADY_PUBLISHED");
    }

    const validation = validateFlowJson(flow.flow_json_parsed);
    if (!validation.valid) {
      throw httpError(
        `Flow JSON failed validation: ${validation.errors.join("; ")}`,
        400,
        "FLOW_VALIDATION_FAILED"
      );
    }

    let metaResponse = null;
    if (callMetaApi) {
      if (!flow.meta_flow_id) {
        throw httpError(
          "Flow must be created on Meta WABA (meta_flow_id required) before publishing",
          409,
          "META_FLOW_ID_REQUIRED"
        );
      }
      metaResponse = await gateway.publishWhatsAppFlow(tid, {
        senderId: senderId || flow.sender_id,
        wabaId: flow.waba_id,
        metaFlowId: flow.meta_flow_id,
      });
    }

    await db.query(
      `UPDATE whatsapp_flows
       SET meta_status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [actorId, tid, flow.id]
    );
    await db.query(
      `UPDATE whatsapp_flow_versions SET meta_status = 'PUBLISHED', is_immutable = 1
       WHERE tenant_id = ? AND flow_id = ? AND version_number = ?`,
      [tid, flow.id, flow.local_version]
    );
    await db.query(
      `INSERT INTO whatsapp_flow_publications (tenant_id, flow_id, meta_flow_id, version_number, published_by, meta_response_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tid, flow.id, flow.meta_flow_id, flow.local_version, actorId, JSON.stringify(metaResponse)]
    );

    return getFlow(tid, flow.id);
  }

  async function deprecateFlow(tenantId, flowId, actorId = null) {
    const tid = assertTenantId(tenantId);
    const flow = await getFlow(tid, flowId);
    await db.query(
      `UPDATE whatsapp_flows SET meta_status = 'DEPRECATED', deprecated_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [actorId, tid, flow.id]
    );
    return getFlow(tid, flow.id);
  }

  async function cloneFlow(tenantId, flowId, { name = null } = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const source = await getFlow(tid, flowId);
    const cloneName = name ? String(name).trim() : `${source.name} (v${Number(source.local_version || 1) + 1})`;
    const created = await createFlow(
      tid,
      {
        name: cloneName,
        workspace_id: source.workspace_id,
        waba_id: source.waba_id,
        sender_id: source.sender_id,
        category: source.category,
        flow_mode: source.flow_mode,
        json_version: source.json_version,
        flow_json: source.flow_json_parsed,
        endpoint_uri: source.endpoint_uri,
      },
      actorId
    );
    await db.query(
      `UPDATE whatsapp_flows SET previous_flow_id = ? WHERE tenant_id = ? AND id = ?`,
      [source.id, tid, created.id]
    );
    return getFlow(tid, created.id);
  }

  async function initiateExecution(tenantId, { flowId, metaFlowId = null, campaignId = null, recipientId = null, contactId = null, normalizedPhone }) {
    const tid = assertTenantId(tenantId);
    const flowToken = generateUid("flwtok");
    const res = await db.query(
      `INSERT INTO whatsapp_flow_executions (
        tenant_id, flow_id, meta_flow_id, campaign_id, recipient_id, contact_id,
        normalized_phone, flow_token, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INITIATED')`,
      [tid, flowId, metaFlowId, campaignId, recipientId, contactId, normalizedPhone, flowToken]
    );
    return { execution_id: res.insertId, flow_token: flowToken };
  }

  async function recordFlowSubmission(tenantId, { flowToken, normalizedPhone, wamid = null, responsePayload = {} }) {
    const tid = assertTenantId(tenantId);
    const execution = flowToken
      ? await db.queryOne(
          `SELECT * FROM whatsapp_flow_executions WHERE tenant_id = ? AND flow_token = ? LIMIT 1`,
          [tid, String(flowToken)]
        )
      : null;

    const res = await db.query(
      `INSERT INTO whatsapp_flow_submissions (
        tenant_id, flow_id, execution_id, campaign_id, recipient_id, contact_id,
        normalized_phone, flow_token, wamid, response_payload_json, validation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'valid')`,
      [
        tid,
        execution?.flow_id || null,
        execution?.id || null,
        execution?.campaign_id || null,
        execution?.recipient_id || null,
        execution?.contact_id || null,
        normalizedPhone,
        flowToken || null,
        wamid,
        JSON.stringify(responsePayload),
      ]
    );

    if (execution) {
      await db.query(
        `UPDATE whatsapp_flow_executions SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [execution.id, tid]
      );
      if (execution.recipient_id) {
        await db.query(
          `UPDATE campaign_recipients SET flow_completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ?`,
          [execution.recipient_id, tid]
        );
      }
      if (execution.campaign_id) {
        await db.query(
          `UPDATE campaigns SET flow_completed_count = flow_completed_count + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ?`,
          [execution.campaign_id, tid]
        );
        await db.query(
          `INSERT INTO campaign_engagement_events (tenant_id, campaign_id, recipient_id, contact_id, normalized_phone, event_type, wamid, metadata_json)
           VALUES (?, ?, ?, ?, ?, 'flow_completed', ?, ?)`,
          [
            tid,
            execution.campaign_id,
            execution.recipient_id,
            execution.contact_id,
            normalizedPhone,
            wamid,
            JSON.stringify({ flow_id: execution.flow_id, submission_id: res.insertId }),
          ]
        );
      }
    }

    return {
      submission_id: res.insertId,
      execution,
      campaign_id: execution?.campaign_id || null,
      recipient_id: execution?.recipient_id || null,
      contact_id: execution?.contact_id || null,
    };
  }

  return {
    listFlows,
    getFlow,
    createFlow,
    updateFlow,
    validateFlow,
    publishFlow,
    deprecateFlow,
    cloneFlow,
    initiateExecution,
    recordFlowSubmission,
    validateFlowJson,
    SUPPORTED_FLOW_CATEGORIES: Array.from(SUPPORTED_FLOW_CATEGORIES),
    OFFICIAL_FLOW_COMPONENTS: Array.from(OFFICIAL_FLOW_COMPONENTS),
  };
}

module.exports = { createWhatsAppFlowsService, validateFlowJson };
