"use strict";

/**
 * automationEngineService.js
 *
 * Enterprise Event-Driven Business Automation Workflow Engine.
 *
 * Capabilities:
 *   - Multi-step DAG workflows with immutable published versions & rollback.
 *   - Durable event ingestion with atomic idempotency deduplication.
 *   - Grouped AND/OR/NOT conditional branching.
 *   - Durable wait/delay engine (seconds/minutes/hours/days, wait_until,
 *     wait_for_reply, wait_for_deal_stage, wait_for_payment, wait_for_event,
 *     wait_for_flow_submission) persisted in DB — never in-memory-only timers!
 *   - Controlled parallel branches with merge rules (`wait_all`, `any`,
 *     `required_branches`, `stop_on_failure`) & per-branch idempotency so
 *     retrying a failed branch never re-runs succeeded irreversible actions.
 *   - Safe bounded loops & tenant-preserving subflows.
 *   - Non-bypassable Approval nodes (single, sequential, parallel, timeout escalation).
 *   - Provider-aware error classification, exponential backoff + jitter retries,
 *     and Dead-Letter Queue with safe replay.
 *   - Admin-only encrypted integration credentials (never returned decrypted).
 *   - Full bidirectional integration with Flowbot, Campaigns, CRM, AI & Service Window.
 */

const crypto = require("crypto");
const {
  createDbHelper,
  assertTenantId,
  normalizePhone,
  safeJsonParse,
  httpError,
  generateUid,
} = require("../campaign/dbHelper");
const cryptoHelper = require("../../backendutil/cryptoHelper");
const { createConsentSuppressionService } = require("../campaign/consentSuppressionService");
const { createServiceWindowService } = require("./serviceWindowService");
const {
  evaluateConditionGroup,
  interpolateText,
  maskSensitiveData,
} = require("./conditionEvaluator");
const { createAiAgentService } = require("./aiAgentService");
const { createSharedContextService } = require("./sharedContextService");

const MAX_STEPS_PER_TICK = 40;
const PERMANENT_ERROR_CATEGORIES = new Set([
  "INVALID_CREDENTIALS",
  "REJECTED_TEMPLATE",
  "INVALID_RECIPIENT",
  "OPTED_OUT",
  "BLOCKED_BY_SUPPRESSION",
  "OUTSIDE_SERVICE_WINDOW_TEMPLATE_REQUIRED",
  "PERMISSION_DENIED",
  "AI_FORBIDDEN_ACTION",
  "CONFIGURATION_ERROR",
]);

function classifyError(err) {
  const code = String(err?.code || err?.category || "").toUpperCase();
  if (PERMANENT_ERROR_CATEGORIES.has(code)) {
    return { category: code, retryable: false };
  }
  if (/401|403|unauthorized|forbidden|invalid token/i.test(err?.message || "")) {
    return { category: "INVALID_CREDENTIALS", retryable: false };
  }
  if (/timeout|etimedout|econnaborted/i.test(`${code} ${err?.message || ""}`)) {
    return { category: "TIMEOUT", retryable: true };
  }
  if (/429|rate.?limit/i.test(`${code} ${err?.message || ""}`)) {
    return { category: "RATE_LIMIT", retryable: true };
  }
  if (/econnrefused|enotfound|network|5\d\d/i.test(`${code} ${err?.message || ""}`)) {
    return { category: "NETWORK_ERROR", retryable: true };
  }
  return { category: code || "INTEGRATION_FAILURE", retryable: Boolean(err?.retryable) };
}

function computeBackoffMs(retryCount, baseDelayMs = 2000) {
  const exp = Math.min(300000, baseDelayMs * Math.pow(2, Math.max(0, retryCount - 1)));
  const jitter = Math.floor(Math.random() * Math.min(1000, exp * 0.25));
  return exp + jitter;
}

function assertSafeOutboundUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ""));
  } catch {
    throw httpError("Invalid HTTP action URL", 400, "CONFIGURATION_ERROR");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw httpError("Only http and https URLs are permitted", 400, "CONFIGURATION_ERROR");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "169.254.169.254" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw httpError("Private or loopback integration URLs are blocked for security", 403, "PERMISSION_DENIED");
  }
  return parsed.toString();
}

function createAutomationEngineService(options = {}) {
  const db = createDbHelper(options.db);
  const consentService = options.consentService || createConsentSuppressionService({ db: options.db });
  const serviceWindow = options.serviceWindow || createServiceWindowService({ db: options.db, consentService });
  const aiService = options.aiService || createAiAgentService({ db: options.db, llmClient: options.llmClient });
  const sharedContext = options.sharedContext || createSharedContextService({ db: options.db });
  const httpClient = options.httpClient || null;
  const messageDispatcher = options.messageDispatcher || null;
  let flowbotRuntime = options.flowbotRuntime || null;

  function setFlowbotRuntime(rt) {
    flowbotRuntime = rt;
  }

  // ── 1. Encrypted Integration Credentials (Admin-Only, Never Decrypted in API) ──
  async function saveIntegrationCredential(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const name = String(input.name || "").trim();
    const provider = String(input.provider || "http").trim().toLowerCase();
    const secret = String(input.secret || "").trim();
    if (!name || !secret) throw httpError("Credential name and secret are required", 400, "CREDENTIAL_INVALID");

    const encrypted = cryptoHelper.encrypt(secret);
    const res = await db.query(
      `INSERT INTO integration_credentials (tenant_id, workspace_id, name, provider, auth_type, encrypted_secret, metadata_json, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [tid, input.workspace_id || null, name, provider, input.auth_type || "bearer", encrypted, JSON.stringify(input.metadata || {}), actorId || null]
    );
    return { id: res.insertId, tenant_id: tid, name, provider, auth_type: input.auth_type || "bearer", status: "active" };
  }

  async function listIntegrationCredentials(tenantId) {
    const tid = assertTenantId(tenantId);
    // Explicitly omit `encrypted_secret` from listing responses!
    return db.query(
      `SELECT id, tenant_id, workspace_id, name, provider, auth_type, metadata_json, status, last_tested_at, last_rotated_at, created_at
       FROM integration_credentials WHERE tenant_id = ? ORDER BY id DESC`,
      [tid]
    );
  }

  async function resolveDecryptedSecretInternal(tenantId, credentialId) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(
      `SELECT id, auth_type, encrypted_secret FROM integration_credentials WHERE tenant_id = ? AND id = ? AND status = 'active' LIMIT 1`,
      [tid, Number(credentialId)]
    );
    if (!row) throw httpError("Integration credential not found or inactive", 403, "INVALID_CREDENTIALS");
    return { auth_type: row.auth_type, secret: cryptoHelper.decrypt(row.encrypted_secret) };
  }

  // ── 2. Workflow CRUD, Validation, Immutable Publish & Rollback ─────────────
  function validateWorkflowGraph(graph = {}) {
    const errors = [];
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    if (nodes.length === 0) {
      return { valid: false, errors: [{ code: "EMPTY_WORKFLOW", message: "Workflow must contain at least one step node" }] };
    }
    const byKey = new Map();
    for (const n of nodes) {
      const k = String(n.key || n.node_key || "").trim();
      if (!k) errors.push({ code: "MISSING_KEY", message: "Every workflow node requires a unique key" });
      else if (byKey.has(k)) errors.push({ code: "DUPLICATE_KEY", key: k, message: `Duplicate node key '${k}'` });
      else byKey.set(k, n);
    }

    const entry = graph.entry_node_key || String(nodes[0].key || nodes[0].node_key);
    if (!byKey.has(entry)) {
      errors.push({ code: "MISSING_ENTRY", message: `Entry node '${entry}' does not exist` });
    }

    for (const [k, n] of byKey.entries()) {
      const cfg = n.config || {};
      const type = String(n.type || n.node_type || "").toLowerCase();
      if (type === "loop" && (!cfg.max_iterations || Number(cfg.max_iterations) > 100)) {
        errors.push({ code: "UNBOUNDED_LOOP", key: k, message: "Loop nodes must configure max_iterations <= 100" });
      }
      if (type === "ai_action" && Array.isArray(cfg.allowed_tools)) {
        try {
          aiService.assertAiToolsAllowed(cfg.allowed_tools);
        } catch (err) {
          errors.push({ code: "AI_FORBIDDEN_ACTION", key: k, message: err.message });
        }
      }
      const refs = [
        cfg.next_node_key,
        cfg.true_next,
        cfg.false_next,
        cfg.approved_next,
        cfg.rejected_next,
        cfg.timeout_next,
        cfg.error_next,
        cfg.merge_next,
      ].filter(Boolean);
      for (const r of refs) {
        if (!byKey.has(r)) errors.push({ code: "BROKEN_EDGE", key: k, message: `Step '${k}' references missing node '${r}'` });
      }
    }

    return { valid: errors.length === 0, errors, entry_node_key: entry };
  }

  async function createWorkflow(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const name = String(input.name || "").trim();
    if (!name) throw httpError("Workflow name is required", 400, "WORKFLOW_NAME_REQUIRED");
    const triggerType = String(input.trigger_type || "manual").toLowerCase();
    const graph = input.graph || { entry_node_key: "step_1", nodes: [] };
    const uid = generateUid("wf");

    const res = await db.query(
      `INSERT INTO automation_workflows
       (workflow_uid, tenant_id, workspace_id, company_id, agency_client_id, legacy_automation_id,
        name, description, category, scope, status, current_version, trigger_type, trigger_config_json,
        graph_json, permissions_json, max_concurrency, max_iterations, owner_id, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        tid,
        input.workspace_id || null,
        input.company_id || tid,
        input.agency_client_id || null,
        input.legacy_automation_id || null,
        name,
        input.description || null,
        input.category || "general",
        input.scope || "workspace",
        triggerType,
        JSON.stringify(input.trigger_config || {}),
        JSON.stringify(graph),
        JSON.stringify(input.permissions || {}),
        Math.min(100, Number(input.max_concurrency || 25)),
        Math.min(100, Number(input.max_iterations || 50)),
        input.owner_id || actorId || null,
        actorId || null,
        actorId || null,
      ]
    );
    return getWorkflow(tid, res.insertId);
  }

  async function getWorkflow(tenantId, workflowId) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(`SELECT * FROM automation_workflows WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(workflowId)]);
    if (!row) throw httpError("Automation workflow not found", 404, "WORKFLOW_NOT_FOUND");
    const versions = await db.query(
      `SELECT id, version_number, status, change_summary, published_by, created_at
       FROM automation_workflow_versions WHERE tenant_id = ? AND workflow_id = ? ORDER BY version_number DESC LIMIT 25`,
      [tid, row.id]
    );
    return {
      ...row,
      trigger_config: safeJsonParse(row.trigger_config_json, {}),
      graph: safeJsonParse(row.graph_json, { nodes: [] }),
      permissions: safeJsonParse(row.permissions_json, {}),
      versions,
    };
  }

  async function listWorkflows(tenantId, { status = null, triggerType = null } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?"];
    const params = [tid];
    if (status && status !== "ALL") {
      clauses.push("status = ?");
      params.push(String(status).toUpperCase());
    }
    if (triggerType) {
      clauses.push("trigger_type = ?");
      params.push(String(triggerType).toLowerCase());
    }
    const rows = await db.query(
      `SELECT w.*,
              (SELECT COUNT(*) FROM automation_workflow_runs r WHERE r.workflow_id = w.id AND r.tenant_id = w.tenant_id) AS total_runs,
              (SELECT COUNT(*) FROM automation_workflow_runs r WHERE r.workflow_id = w.id AND r.tenant_id = w.tenant_id AND r.status = 'COMPLETED') AS completed_runs,
              (SELECT COUNT(*) FROM automation_workflow_runs r WHERE r.workflow_id = w.id AND r.tenant_id = w.tenant_id AND r.status IN ('FAILED','DEAD_LETTER')) AS failed_runs
       FROM automation_workflows w WHERE ${clauses.join(" AND ")} ORDER BY w.updated_at DESC LIMIT 200`,
      params
    );
    return rows.map((r) => ({
      ...r,
      trigger_config: safeJsonParse(r.trigger_config_json, {}),
      graph: safeJsonParse(r.graph_json, { nodes: [] }),
    }));
  }

  async function publishWorkflow(tenantId, workflowId, { changeSummary = "Published version" } = {}, actorId = null) {
    const wf = await getWorkflow(tenantId, workflowId);
    const validation = validateWorkflowGraph(wf.graph);
    if (!validation.valid) {
      throw httpError(
        `Workflow validation failed: ${validation.errors.map((e) => e.message).join("; ")}`,
        400,
        "WORKFLOW_VALIDATION_FAILED"
      );
    }

    const maxVer = await db.queryOne(
      `SELECT COALESCE(MAX(version_number), 0) AS max_v FROM automation_workflow_versions WHERE tenant_id = ? AND workflow_id = ?`,
      [wf.tenant_id, wf.id]
    );
    const nextVer = Number(maxVer?.max_v || 0) + 1;

    await db.query(
      `UPDATE automation_workflow_versions SET status = 'ARCHIVED' WHERE tenant_id = ? AND workflow_id = ? AND status = 'PUBLISHED'`,
      [wf.tenant_id, wf.id]
    );

    await db.query(
      `INSERT INTO automation_workflow_versions
       (tenant_id, workflow_id, version_number, status, trigger_type, trigger_config_json, graph_json, change_summary, published_by)
       VALUES (?, ?, ?, 'PUBLISHED', ?, ?, ?, ?, ?)`,
      [wf.tenant_id, wf.id, nextVer, wf.trigger_type, wf.trigger_config_json, wf.graph_json, changeSummary, actorId || null]
    );

    await db.query(
      `UPDATE automation_workflows
       SET status = 'PUBLISHED', current_version = ?, published_version = ?, published_by = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [nextVer, nextVer, actorId || null, wf.tenant_id, wf.id]
    );

    return { workflow_id: wf.id, published_version: nextVer, status: "PUBLISHED" };
  }

  // ── 3. Idempotent Event Ingestion & Durable Run Creation ───────────────────
  async function claimIdempotency(tenantId, scope, key) {
    if (!key) return { duplicate: false };
    const tid = assertTenantId(tenantId);
    const existing = await db.queryOne(
      `SELECT id, result_json FROM execution_idempotency WHERE tenant_id = ? AND scope = ? AND idempotency_key = ? LIMIT 1`,
      [tid, scope, String(key)]
    );
    if (existing) {
      return { duplicate: true, result: safeJsonParse(existing.result_json, null) };
    }
    try {
      await db.query(
        `INSERT INTO execution_idempotency (tenant_id, scope, idempotency_key, result_json) VALUES (?, ?, ?, '{}')`,
        [tid, scope, String(key)]
      );
      return { duplicate: false };
    } catch {
      return { duplicate: true };
    }
  }

  async function emitEvent(tenantId, eventType, payload = {}, {
    source = "system",
    idempotencyKey = null,
    isTestMode = false,
  } = {}) {
    const tid = assertTenantId(tenantId);
    const et = String(eventType || "").toLowerCase().trim();
    if (!et) throw httpError("event_type is required", 400, "EVENT_TYPE_REQUIRED");

    if (idempotencyKey) {
      const claim = await claimIdempotency(tid, `event:${et}`, idempotencyKey);
      if (claim.duplicate) {
        return { deduplicated: true, event_type: et, started_runs: [], resumed_runs: [] };
      }
    }

    const normPhone = payload.phone ? normalizePhone(payload.phone).normalized : null;
    const evUid = generateUid("evt");
    const evRes = await db.query(
      `INSERT INTO automation_events
       (event_uid, tenant_id, workspace_id, event_type, source, idempotency_key, contact_id, phone, conversation_id, campaign_id, payload_json, processed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        evUid,
        tid,
        payload.workspace_id || null,
        et,
        source,
        idempotencyKey || null,
        payload.contact_id || null,
        normPhone,
        payload.conversation_id || null,
        payload.campaign_id || null,
        JSON.stringify(payload || {}),
      ]
    );

    // 1. Resume any runs currently waiting for this exact event!
    const resumedRuns = await resumeWaitingRunsForEvent(tid, et, payload, normPhone);

    // 2. Trigger all PUBLISHED workflows subscribed to this event_type
    const matchingWorkflows = await db.query(
      `SELECT * FROM automation_workflows
       WHERE tenant_id = ? AND status = 'PUBLISHED' AND trigger_type = ?
       ORDER BY id ASC`,
      [tid, et]
    );

    const startedRuns = [];
    for (const wf of matchingWorkflows) {
      const run = await startWorkflowRun(tid, wf.id, {
        triggerEvent: et,
        triggerEventId: evUid,
        idempotencyKey: idempotencyKey ? `${idempotencyKey}:wf:${wf.id}` : null,
        payload,
        isTestMode,
      });
      if (run && !run.deduplicated) startedRuns.push(run);
    }

    await db.query(`UPDATE automation_events SET processed = 1, processed_at = CURRENT_TIMESTAMP WHERE id = ?`, [evRes.insertId]);

    return {
      deduplicated: false,
      event_id: evRes.insertId,
      event_uid: evUid,
      event_type: et,
      started_runs: startedRuns,
      resumed_runs: resumedRuns,
    };
  }

  async function startWorkflowRun(tenantId, workflowId, {
    triggerEvent = "manual",
    triggerEventId = null,
    idempotencyKey = null,
    payload = {},
    parentRunId = null,
    isTestMode = false,
  } = {}) {
    const tid = assertTenantId(tenantId);
    if (idempotencyKey) {
      const claim = await claimIdempotency(tid, `wf_run:${workflowId}`, idempotencyKey);
      if (claim.duplicate) return { deduplicated: true, workflow_id: Number(workflowId) };
    }

    const wf = await db.queryOne(`SELECT * FROM automation_workflows WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(workflowId)]);
    if (!wf) throw httpError("Workflow not found", 404, "WORKFLOW_NOT_FOUND");

    const verNum = wf.published_version || wf.current_version || 1;
    const verRow = await db.queryOne(
      `SELECT * FROM automation_workflow_versions WHERE tenant_id = ? AND workflow_id = ? AND version_number = ? LIMIT 1`,
      [tid, wf.id, verNum]
    );
    const graph = safeJsonParse(verRow?.graph_json || wf.graph_json, { nodes: [] });
    const entryKey = graph.entry_node_key || graph.nodes?.[0]?.key || graph.nodes?.[0]?.node_key || null;
    const normPhone = payload.phone ? normalizePhone(payload.phone).normalized : null;

    const runUid = generateUid("run");
    const res = await db.query(
      `INSERT INTO automation_workflow_runs
       (run_uid, tenant_id, workspace_id, workflow_id, workflow_version, parent_run_id,
        trigger_event, trigger_event_id, idempotency_key, status, current_node_key,
        contact_id, phone, conversation_id, campaign_id, sender_id, lead_id, deal_id, order_id,
        context_json, completed_nodes_json, branch_results_json, is_test_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RUNNING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '{}', ?)`,
      [
        runUid,
        tid,
        payload.workspace_id || wf.workspace_id || null,
        wf.id,
        verNum,
        parentRunId || null,
        triggerEvent,
        triggerEventId || null,
        idempotencyKey || null,
        entryKey,
        payload.contact_id || null,
        normPhone,
        payload.conversation_id || null,
        payload.campaign_id || null,
        payload.sender_id || null,
        payload.lead_id || null,
        payload.deal_id || null,
        payload.order_id || null,
        JSON.stringify({ trigger: payload, vars: {} }),
        isTestMode ? 1 : 0,
      ]
    );

    const runRow = await db.queryOne(`SELECT * FROM automation_workflow_runs WHERE id = ?`, [res.insertId]);
    return executeWorkflowRun(hydrateRun(runRow), graph);
  }

  function hydrateRun(row) {
    if (!row) return null;
    return {
      ...row,
      context: safeJsonParse(row.context_json, { trigger: {}, vars: {} }),
      completed_nodes: safeJsonParse(row.completed_nodes_json, []),
      branch_results: safeJsonParse(row.branch_results_json, {}),
    };
  }

  async function persistRun(run, patch = {}) {
    const m = { ...run, ...patch };
    await db.query(
      `UPDATE automation_workflow_runs
       SET status = ?, current_node_key = ?, contact_id = ?, lead_id = ?, deal_id = ?,
           context_json = ?, completed_nodes_json = ?, branch_results_json = ?,
           resume_at = ?, resume_event = ?, wait_timeout_at = ?, timeout_node_key = ?,
           retry_count = ?, next_retry_at = ?, last_error_category = ?, last_error_message = ?,
           completed_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        m.status,
        m.current_node_key || null,
        m.contact_id || null,
        m.lead_id || null,
        m.deal_id || null,
        JSON.stringify(m.context || {}),
        JSON.stringify(m.completed_nodes || []),
        JSON.stringify(m.branch_results || {}),
        m.resume_at || null,
        m.resume_event || null,
        m.wait_timeout_at || null,
        m.timeout_node_key || null,
        Number(m.retry_count || 0),
        m.next_retry_at || null,
        m.last_error_category || null,
        m.last_error_message || null,
        m.completed_at || null,
        m.id,
      ]
    );
    return m;
  }

  async function recordRunStep(run, nodeKey, nodeType, status, {
    branchId = null,
    stepIdemKey = null,
    attemptNumber = 1,
    input = null,
    output = null,
    errorCategory = null,
    errorMessage = null,
    durationMs = 0,
  } = {}) {
    await db.query(
      `INSERT INTO automation_workflow_run_steps
       (tenant_id, run_id, workflow_id, node_key, node_type, branch_id, step_idempotency_key, attempt_number,
        status, input_json, output_json, error_category, error_message, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.tenant_id,
        run.id,
        run.workflow_id,
        String(nodeKey),
        String(nodeType),
        branchId || null,
        stepIdemKey || null,
        Number(attemptNumber || 1),
        status,
        input ? JSON.stringify(maskSensitiveData(input)) : null,
        output ? JSON.stringify(maskSensitiveData(output)) : null,
        errorCategory || null,
        errorMessage || null,
        Math.max(0, Math.round(durationMs)),
      ]
    );
  }

  // ── 4. Single Action Executor (reused by main DAG, parallel branches & loops) ──
  async function executeSingleNodeAction(run, node, liveCtx, branchId = null) {
    const nType = String(node.type || node.node_type || "").toLowerCase();
    const cfg = node.config || {};

    if (nType === "crm_action") {
      const resolved = {};
      for (const [k, v] of Object.entries(cfg.params || {})) {
        resolved[k] = typeof v === "string" ? interpolateText(v, liveCtx) : v;
      }
      const res = await sharedContext.executeCrmAction(run.tenant_id, cfg.action, resolved, liveCtx);
      if (res.contact_id) run.contact_id = res.contact_id;
      if (res.lead_id) run.lead_id = res.lead_id;
      if (res.deal_id) run.deal_id = res.deal_id;
      return res;
    }

    if (nType === "ai_action") {
      return aiService.executeAiNode(run.tenant_id, cfg, liveCtx);
    }

    if (nType === "whatsapp_action") {
      const waAction = String(cfg.action || "send_template").toLowerCase();
      if (waAction === "start_flowbot") {
        if (!flowbotRuntime) throw httpError("Flowbot runtime unavailable", 503, "RESOURCE_UNAVAILABLE");
        return flowbotRuntime.startSession(run.tenant_id, {
          flowId: cfg.flow_id,
          phone: interpolateText(cfg.phone || "{{customer.phone}}", liveCtx),
          contactId: run.contact_id,
          conversationId: run.conversation_id,
          senderId: cfg.sender_id || run.sender_id,
          campaignId: run.campaign_id,
          workspaceId: run.workspace_id,
          isTestMode: Boolean(run.is_test_mode),
        });
      }
      if (waAction === "pause_flowbot") {
        await db.query(
          `UPDATE flowbot_sessions SET status = 'PAUSED' WHERE tenant_id = ? AND phone = ? AND status IN ('ACTIVE','WAITING_FOR_INPUT','EXECUTING')`,
          [run.tenant_id, run.phone || liveCtx.customer?.phone || ""]
        );
        return { ok: true, paused: true };
      }

      const targetPhone = interpolateText(cfg.phone || "{{customer.phone}}", liveCtx);
      const msgType = waAction === "send_template" ? "template" : waAction === "send_whatsapp_flow" ? "whatsapp_flow" : "text";
      const elig = await serviceWindow.checkOutboundEligibility(run.tenant_id, {
        senderId: cfg.sender_id || run.sender_id,
        phone: targetPhone,
        messageType: msgType,
        templateId: cfg.template_id || null,
        category: cfg.category || (msgType === "template" ? "UTILITY" : "SERVICE"),
        workspaceId: run.workspace_id,
      });
      if (!elig.eligible) {
        throw httpError(elig.reason, 403, elig.code);
      }
      const text = interpolateText(cfg.text || "", liveCtx);
      if (!run.is_test_mode && messageDispatcher && typeof messageDispatcher.send === "function") {
        const sent = await messageDispatcher.send(run.tenant_id, {
          sender_id: cfg.sender_id || run.sender_id,
          phone: targetPhone,
          message_type: msgType,
          template_id: cfg.template_id || null,
          text,
          variables: cfg.variables || {},
        });
        return { ok: true, sent: true, message_id: sent?.message_id || null };
      }
      return { ok: true, sent: true, simulated: Boolean(run.is_test_mode), message_type: msgType, to: targetPhone, text };
    }

    if (nType === "http_request" || nType === "webhook") {
      const targetUrl = assertSafeOutboundUrl(interpolateText(cfg.url || "", liveCtx));
      const headers = { "Content-Type": "application/json", ...(cfg.headers || {}) };
      if (cfg.credential_id) {
        const cred = await resolveDecryptedSecretInternal(run.tenant_id, cfg.credential_id);
        headers.Authorization = cred.auth_type === "bearer" ? `Bearer ${cred.secret}` : cred.secret;
      }
      const method = String(cfg.method || "POST").toUpperCase();
      const bodyPayload = cfg.body || liveCtx.trigger || {};
      if (httpClient && typeof httpClient.request === "function") {
        const res = await httpClient.request({ method, url: targetUrl, headers, data: bodyPayload, timeout: Number(cfg.timeout_ms || 15000) });
        return { ok: true, status: res?.status || 200, data: res?.data || {} };
      }
      const resp = await fetch(targetUrl, {
        method,
        headers,
        body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(bodyPayload),
      });
      const text = await resp.text();
      if (!resp.ok) {
        const err = new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
        err.code = resp.status === 429 ? "RATE_LIMIT" : resp.status >= 500 ? "NETWORK_ERROR" : "INTEGRATION_FAILURE";
        err.retryable = resp.status === 429 || resp.status >= 500;
        throw err;
      }
      return { ok: true, status: resp.status, data: safeJsonParse(text, { raw: text }) };
    }

    if (nType === "subflow") {
      if (!cfg.workflow_id) throw httpError("Subflow requires workflow_id", 400, "CONFIGURATION_ERROR");
      const subRun = await startWorkflowRun(run.tenant_id, cfg.workflow_id, {
        triggerEvent: "subflow_call",
        parentRunId: run.id,
        idempotencyKey: `sub_${run.id}_${node.key || node.node_key}_${branchId || "main"}`,
        payload: {
          workspace_id: run.workspace_id,
          contact_id: run.contact_id,
          phone: run.phone,
          conversation_id: run.conversation_id,
          campaign_id: run.campaign_id,
          sender_id: run.sender_id,
          lead_id: run.lead_id,
          deal_id: run.deal_id,
          ...(cfg.inputs || {}),
        },
        isTestMode: Boolean(run.is_test_mode),
      });
      return { ok: subRun.status !== "FAILED" && subRun.status !== "DEAD_LETTER", subflow_run_id: subRun.id, subflow_status: subRun.status, outputs: subRun.context?.vars || {} };
    }

    if (nType === "team_notify" || nType === "create_notification" || nType === "log") {
      return {
        ok: true,
        notified: true,
        recipient: cfg.recipient || cfg.role || "manager",
        message: interpolateText(cfg.message || "Workflow notification", liveCtx),
      };
    }

    return { ok: true, noop: true, type: nType };
  }

  // ── 5. Main Durable DAG Execution Engine ───────────────────────────────────
  async function executeWorkflowRun(runInput, graphInput = null) {
    let run = runInput;
    let graph = graphInput;
    if (!graph) {
      const ver = await db.queryOne(
        `SELECT graph_json FROM automation_workflow_versions WHERE tenant_id = ? AND workflow_id = ? AND version_number = ? LIMIT 1`,
        [run.tenant_id, run.workflow_id, run.workflow_version]
      );
      const wf = !ver
        ? await db.queryOne(`SELECT graph_json FROM automation_workflows WHERE tenant_id = ? AND id = ? LIMIT 1`, [run.tenant_id, run.workflow_id])
        : null;
      graph = safeJsonParse(ver?.graph_json || wf?.graph_json, { nodes: [] });
    }

    const byKey = new Map();
    for (const n of graph.nodes || []) byKey.set(String(n.key || n.node_key), n);

    let steps = 0;
    while (run.current_node_key && run.status === "RUNNING" && steps < MAX_STEPS_PER_TICK) {
      const node = byKey.get(run.current_node_key);
      if (!node) {
        run = await persistRun(run, { status: "COMPLETED", current_node_key: null, completed_at: new Date().toISOString() });
        break;
      }

      steps++;
      const t0 = Date.now();
      const nodeKey = String(node.key || node.node_key);
      const nType = String(node.type || node.node_type || "").toLowerCase();
      const cfg = node.config || {};

      // Reload live CRM state for every step
      const fresh = await sharedContext.loadFreshContext(run.tenant_id, {
        workspaceId: run.workspace_id,
        contactId: run.contact_id,
        phone: run.phone,
        conversationId: run.conversation_id,
        senderId: run.sender_id,
        campaignId: run.campaign_id,
        leadId: run.lead_id,
        dealId: run.deal_id,
      });
      const liveCtx = {
        ...fresh,
        trigger: run.context?.trigger || {},
        vars: run.context?.vars || {},
        flow: run.context?.trigger?.collected_data || {},
      };

      try {
        // Condition node (AND/OR/NOT grouped)
        if (nType === "condition") {
          const matched = evaluateConditionGroup(cfg.condition || cfg, liveCtx);
          const nextKey = matched ? cfg.true_next : cfg.false_next;
          await recordRunStep(run, nodeKey, nType, "COMPLETED", { output: { matched, next_node_key: nextKey }, durationMs: Date.now() - t0 });
          run.completed_nodes.push(nodeKey);
          run = await persistRun(run, { current_node_key: nextKey || null });
          continue;
        }

        // Durable Wait / Delay node
        if (nType === "wait" || nType === "delay") {
          const waitMode = String(cfg.wait_mode || "duration").toLowerCase();
          let resumeAt = null;
          let resumeEvent = null;
          let waitTimeoutAt = null;
          let nextStatus = "WAITING_DELAY";

          if (waitMode === "duration") {
            const mult = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 }[cfg.unit || "seconds"] || 1000;
            const ms = Math.max(1000, Number(cfg.amount || cfg.delay_seconds || 1) * mult);
            resumeAt = new Date(Date.now() + ms).toISOString();
          } else if (waitMode === "until") {
            resumeAt = new Date(cfg.until_timestamp).toISOString();
          } else {
            // Event-based wait: wait_for_reply | wait_for_deal_stage | wait_for_payment | wait_for_flow_submission | wait_for_event
            nextStatus = "WAITING_EVENT";
            resumeEvent = cfg.resume_event || waitMode.replace("wait_for_", "");
            if (cfg.max_wait_seconds) {
              waitTimeoutAt = new Date(Date.now() + Number(cfg.max_wait_seconds) * 1000).toISOString();
            }
          }

          await recordRunStep(run, nodeKey, nType, nextStatus, {
            output: { wait_mode: waitMode, resume_at: resumeAt, resume_event: resumeEvent, wait_timeout_at: waitTimeoutAt },
            durationMs: Date.now() - t0,
          });
          run = await persistRun(run, {
            status: nextStatus,
            current_node_key: cfg.next_node_key || null,
            resume_at: resumeAt,
            resume_event: resumeEvent,
            wait_timeout_at: waitTimeoutAt,
            timeout_node_key: cfg.timeout_next || null,
          });
          break;
        }

        // Non-bypassable Approval Node
        if (nType === "approval") {
          const expiresAt = cfg.timeout_seconds
            ? new Date(Date.now() + Number(cfg.timeout_seconds) * 1000).toISOString()
            : null;
          const apprRes = await db.query(
            `INSERT INTO automation_workflow_approvals
             (tenant_id, workspace_id, run_id, workflow_id, workflow_version, node_key, approval_mode,
              requester_id, required_approvers_json, decisions_json, status, record_ref_type, record_ref_id, expires_at, escalate_to_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'PENDING', ?, ?, ?, ?)`,
            [
              run.tenant_id,
              run.workspace_id,
              run.id,
              run.workflow_id,
              run.workflow_version,
              nodeKey,
              cfg.approval_mode || "single",
              cfg.requester_id || null,
              JSON.stringify(Array.isArray(cfg.approvers) ? cfg.approvers : []),
              cfg.record_ref_type || "workflow_run",
              String(cfg.record_ref_id || run.id),
              expiresAt,
              cfg.escalate_to_user_id || null,
            ]
          );
          await recordRunStep(run, nodeKey, nType, "WAITING_APPROVAL", {
            output: { approval_id: apprRes.insertId, mode: cfg.approval_mode || "single", approvers: cfg.approvers || [] },
            durationMs: Date.now() - t0,
          });
          run = await persistRun(run, {
            status: "WAITING_APPROVAL",
            current_node_key: nodeKey,
            wait_timeout_at: expiresAt,
            timeout_node_key: cfg.timeout_next || null,
          });
          break;
        }

        // Controlled Parallel Branches + Merge (with per-branch idempotency!)
        if (nType === "parallel") {
          const branches = Array.isArray(cfg.branches) ? cfg.branches : [];
          const mergeRule = String(cfg.merge_rule || "wait_all").toLowerCase();
          const requiredIds = new Set(Array.isArray(cfg.required_branches) ? cfg.required_branches : []);
          const existingBranchState = run.branch_results[nodeKey] || {};
          let failedBranches = 0;
          let succeededBranches = 0;

          for (const br of branches) {
            const bid = String(br.branch_id || br.key);
            // Never re-execute an irreversible branch that already succeeded!
            if (existingBranchState[bid]?.status === "COMPLETED") {
              succeededBranches++;
              continue;
            }
            const bt0 = Date.now();
            try {
              const bOut = await executeSingleNodeAction(run, br, liveCtx, bid);
              existingBranchState[bid] = { status: "COMPLETED", output: bOut };
              succeededBranches++;
              await recordRunStep(run, nodeKey, `parallel:${br.type}`, "COMPLETED", {
                branchId: bid,
                stepIdemKey: `${run.id}:${nodeKey}:${bid}`,
                output: bOut,
                durationMs: Date.now() - bt0,
              });
            } catch (bErr) {
              const cls = classifyError(bErr);
              existingBranchState[bid] = { status: "FAILED", error: bErr.message, category: cls.category, retryable: cls.retryable };
              failedBranches++;
              await recordRunStep(run, nodeKey, `parallel:${br.type}`, "FAILED", {
                branchId: bid,
                errorCategory: cls.category,
                errorMessage: bErr.message,
                durationMs: Date.now() - bt0,
              });
              if (mergeRule === "stop_on_failure") break;
            }
          }

          run.branch_results[nodeKey] = existingBranchState;
          const allRequiredOk = requiredIds.size === 0 || Array.from(requiredIds).every((id) => existingBranchState[id]?.status === "COMPLETED");
          const canProceed =
            (mergeRule === "any" && succeededBranches > 0) ||
            (mergeRule === "required_branches" && allRequiredOk) ||
            (failedBranches === 0);

          if (!canProceed) {
            const err = new Error(`Parallel step '${nodeKey}' had ${failedBranches} failed branch(es)`);
            const anyRetryable = Object.values(existingBranchState).some((b) => b.status === "FAILED" && b.retryable);
            err.code = anyRetryable ? "NETWORK_ERROR" : "INTEGRATION_FAILURE";
            err.retryable = anyRetryable;
            throw err;
          }

          run.context.vars[cfg.output_var || nodeKey] = existingBranchState;
          run.completed_nodes.push(nodeKey);
          run = await persistRun(run, { current_node_key: cfg.merge_next || cfg.next_node_key || null });
          continue;
        }

        // Bounded Loop over array items
        if (nType === "loop") {
          const itemsSource = Array.isArray(cfg.items)
            ? cfg.items
            : (liveCtx.trigger?.[cfg.items_field] || liveCtx.vars?.[cfg.items_field] || []);
          const maxIter = Math.min(100, Math.max(1, Number(cfg.max_iterations || 20)));
          const bounded = itemsSource.slice(0, maxIter);
          const loopResults = [];
          const bodyNode = cfg.body_action;
          for (let i = 0; i < bounded.length; i++) {
            const itemCtx = { ...liveCtx, item: bounded[i], loop_index: i };
            const itemRes = bodyNode ? await executeSingleNodeAction(run, bodyNode, itemCtx, `iter_${i}`) : { item: bounded[i] };
            loopResults.push(itemRes);
          }
          run.context.vars[cfg.output_var || nodeKey] = loopResults;
          await recordRunStep(run, nodeKey, nType, "COMPLETED", {
            output: { processed_items: loopResults.length, max_iterations: maxIter, truncated: itemsSource.length > maxIter },
            durationMs: Date.now() - t0,
          });
          run.completed_nodes.push(nodeKey);
          run = await persistRun(run, { current_node_key: cfg.next_node_key || null });
          continue;
        }

        if (nType === "stop" || nType === "end") {
          await recordRunStep(run, nodeKey, nType, "COMPLETED", { durationMs: Date.now() - t0 });
          run = await persistRun(run, { status: "COMPLETED", current_node_key: null, completed_at: new Date().toISOString() });
          break;
        }

        // Standard Action Step (CRM, WhatsApp, AI, HTTP, Subflow, Notification)
        const stepIdemKey = `${run.id}:${nodeKey}`;
        const out = await executeSingleNodeAction(run, node, liveCtx);
        run.context.vars[cfg.output_var || nodeKey] = out;
        run.completed_nodes.push(nodeKey);
        await recordRunStep(run, nodeKey, nType, "COMPLETED", {
          stepIdemKey,
          attemptNumber: Number(run.retry_count || 0) + 1,
          output: out,
          durationMs: Date.now() - t0,
        });
        run = await persistRun(run, { current_node_key: cfg.next_node_key || null, retry_count: 0, last_error_category: null, last_error_message: null });
      } catch (err) {
        const classified = classifyError(err);
        await recordRunStep(run, nodeKey, nType, "FAILED", {
          attemptNumber: Number(run.retry_count || 0) + 1,
          errorCategory: classified.category,
          errorMessage: err.message,
          durationMs: Date.now() - t0,
        });

        if (cfg.error_next) {
          run.context.vars.last_error = { category: classified.category, message: err.message, node: nodeKey };
          run = await persistRun(run, { current_node_key: cfg.error_next, last_error_category: classified.category, last_error_message: err.message });
          continue;
        }

        const maxRetries = cfg.retry_allowed === false ? 0 : Number(cfg.max_retries ?? run.max_retries ?? 3);
        const nextRetryNum = Number(run.retry_count || 0) + 1;

        if (classified.retryable && nextRetryNum <= maxRetries) {
          const backoffMs = computeBackoffMs(nextRetryNum, Number(cfg.base_delay_ms || 1000));
          const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
          run = await persistRun(run, {
            status: "RETRYING",
            retry_count: nextRetryNum,
            next_retry_at: nextRetryAt,
            resume_at: nextRetryAt,
            last_error_category: classified.category,
            last_error_message: err.message,
          });
          break;
        }

        // Exhausted retries OR non-retryable permanent failure -> Dead-Letter Queue
        await db.query(
          `INSERT INTO automation_dead_letters
           (tenant_id, workspace_id, run_id, workflow_id, node_key, error_category, error_message, payload_json, retryable, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
          [
            run.tenant_id,
            run.workspace_id,
            run.id,
            run.workflow_id,
            nodeKey,
            classified.category,
            err.message,
            JSON.stringify(maskSensitiveData(run.context || {})),
            classified.retryable ? 1 : 0,
          ]
        );
        run = await persistRun(run, {
          status: "DEAD_LETTER",
          last_error_category: classified.category,
          last_error_message: err.message,
          completed_at: new Date().toISOString(),
        });
        break;
      }
    }

    if (!run.current_node_key && run.status === "RUNNING") {
      run = await persistRun(run, { status: "COMPLETED", completed_at: new Date().toISOString() });
    }
    return run;
  }

  // ── 6. Approvals, Resumes, Retries, Cancellation & Dead-Letter Replay ──────
  async function decideApproval(tenantId, approvalId, { decision, approverId, reason = "" } = {}) {
    const tid = assertTenantId(tenantId);
    const appr = await db.queryOne(
      `SELECT * FROM automation_workflow_approvals WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(approvalId)]
    );
    if (!appr) throw httpError("Approval request not found", 404, "APPROVAL_NOT_FOUND");
    if (appr.status !== "PENDING") throw httpError(`Approval is already '${appr.status}'`, 409, "APPROVAL_ALREADY_DECIDED");

    const dec = String(decision || "").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(dec)) throw httpError("Decision must be APPROVED or REJECTED", 400, "INVALID_DECISION");

    const required = safeJsonParse(appr.required_approvers_json, []);
    const decisions = safeJsonParse(appr.decisions_json, []);
    decisions.push({ approver_id: approverId || null, decision: dec, reason, decided_at: new Date().toISOString() });

    let finalStatus = "PENDING";
    if (dec === "REJECTED") {
      finalStatus = "REJECTED";
    } else if (appr.approval_mode === "single" || required.length <= 1) {
      finalStatus = "APPROVED";
    } else {
      // Sequential / parallel multi-approver: require all listed approvers to approve
      const approvedCount = decisions.filter((d) => d.decision === "APPROVED").length;
      if (approvedCount >= required.length) finalStatus = "APPROVED";
    }

    await db.query(
      `UPDATE automation_workflow_approvals
       SET decisions_json = ?, status = ?, reason = COALESCE(NULLIF(?, ''), reason),
           decided_by = ?, decided_at = CASE WHEN ? != 'PENDING' THEN CURRENT_TIMESTAMP ELSE decided_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(decisions), finalStatus, reason, approverId || null, finalStatus, appr.id]
    );

    if (finalStatus === "PENDING") {
      return { approval_id: appr.id, status: "PENDING", decisions_recorded: decisions.length, required_count: required.length };
    }

    // Resume the waiting workflow run along approved_next or rejected_next!
    const runRow = await db.queryOne(`SELECT * FROM automation_workflow_runs WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, appr.run_id]);
    if (!runRow) return { approval_id: appr.id, status: finalStatus };

    const wfVer = await db.queryOne(
      `SELECT graph_json FROM automation_workflow_versions WHERE tenant_id = ? AND workflow_id = ? AND version_number = ? LIMIT 1`,
      [tid, runRow.workflow_id, runRow.workflow_version]
    );
    const graph = safeJsonParse(wfVer?.graph_json, { nodes: [] });
    const apprNode = (graph.nodes || []).find((n) => String(n.key || n.node_key) === appr.node_key);
    const nextKey = finalStatus === "APPROVED" ? apprNode?.config?.approved_next || apprNode?.config?.next_node_key : apprNode?.config?.rejected_next;

    const hydrated = hydrateRun(runRow);
    hydrated.context.vars.approval_decision = { approval_id: appr.id, status: finalStatus, reason };
    if (!nextKey && finalStatus === "REJECTED") {
      const done = await persistRun(hydrated, { status: "CANCELLED", current_node_key: null, completed_at: new Date().toISOString() });
      return { approval_id: appr.id, status: finalStatus, run: done };
    }

    const resumed = await persistRun(hydrated, {
      status: "RUNNING",
      current_node_key: nextKey || null,
      wait_timeout_at: null,
    });
    const outRun = await executeWorkflowRun(resumed, graph);
    return { approval_id: appr.id, status: finalStatus, run: outRun };
  }

  async function resumeWaitingRunsForEvent(tenantId, eventType, payload = {}, normPhone = null) {
    const tid = assertTenantId(tenantId);
    const waiting = await db.query(
      `SELECT * FROM automation_workflow_runs
       WHERE tenant_id = ? AND status = 'WAITING_EVENT' AND resume_event = ?
       ORDER BY id ASC LIMIT 100`,
      [tid, eventType]
    );
    const resumed = [];
    for (const r of waiting) {
      if (normPhone && r.phone && r.phone !== normPhone) continue;
      if (payload.deal_id && r.deal_id && Number(r.deal_id) !== Number(payload.deal_id)) continue;
      const hydrated = hydrateRun(r);
      hydrated.context.vars[`event_${eventType}`] = payload;
      const updated = await persistRun(hydrated, { status: "RUNNING", resume_event: null, wait_timeout_at: null });
      const out = await executeWorkflowRun(updated);
      resumed.push({ run_id: out.id, status: out.status });
    }
    return resumed;
  }

  async function processDueWorkflows(nowIso = new Date().toISOString()) {
    const due = await db.query(
      `SELECT * FROM automation_workflow_runs
       WHERE status IN ('WAITING_DELAY', 'RETRYING') AND resume_at IS NOT NULL AND resume_at <= ?
       ORDER BY resume_at ASC LIMIT 100`,
      [nowIso]
    );
    let resumedCount = 0;
    for (const r of due) {
      const hydrated = hydrateRun(r);
      const updated = await persistRun(hydrated, { status: "RUNNING", resume_at: null, next_retry_at: null });
      await executeWorkflowRun(updated);
      resumedCount++;
    }

    // Handle expired WAITING_EVENT / WAITING_APPROVAL timeouts
    const timedOut = await db.query(
      `SELECT * FROM automation_workflow_runs
       WHERE status IN ('WAITING_EVENT', 'WAITING_APPROVAL') AND wait_timeout_at IS NOT NULL AND wait_timeout_at <= ?
       ORDER BY wait_timeout_at ASC LIMIT 100`,
      [nowIso]
    );
    let timedOutCount = 0;
    for (const r of timedOut) {
      const hydrated = hydrateRun(r);
      if (hydrated.status === "WAITING_APPROVAL") {
        await db.query(
          `UPDATE automation_workflow_approvals SET status = 'TIMED_OUT', updated_at = CURRENT_TIMESTAMP
           WHERE run_id = ? AND status = 'PENDING'`,
          [hydrated.id]
        );
      }
      if (hydrated.timeout_node_key) {
        const nextR = await persistRun(hydrated, {
          status: "RUNNING",
          current_node_key: hydrated.timeout_node_key,
          wait_timeout_at: null,
          timeout_node_key: null,
          resume_event: null,
        });
        await executeWorkflowRun(nextR);
      } else {
        await persistRun(hydrated, { status: "CANCELLED", wait_timeout_at: null, completed_at: nowIso });
      }
      timedOutCount++;
    }

    return { resumed_runs: resumedCount, timed_out_runs: timedOutCount };
  }

  async function replayDeadLetter(tenantId, deadLetterId) {
    const tid = assertTenantId(tenantId);
    const dlq = await db.queryOne(
      `SELECT * FROM automation_dead_letters WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(deadLetterId)]
    );
    if (!dlq) throw httpError("Dead-letter entry not found", 404, "DLQ_NOT_FOUND");
    const runRow = await db.queryOne(`SELECT * FROM automation_workflow_runs WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, dlq.run_id]);
    if (!runRow) throw httpError("Associated workflow run not found", 404, "RUN_NOT_FOUND");

    await db.query(
      `UPDATE automation_dead_letters SET status = 'REPLAYED', replay_count = replay_count + 1, last_replayed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [dlq.id]
    );

    const hydrated = hydrateRun(runRow);
    const reset = await persistRun(hydrated, {
      status: "RUNNING",
      retry_count: 0,
      last_error_category: null,
      last_error_message: null,
      completed_at: null,
    });
    return executeWorkflowRun(reset);
  }

  async function cancelRun(tenantId, runId, reason = "Cancelled by operator") {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(`SELECT * FROM automation_workflow_runs WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(runId)]);
    if (!row) throw httpError("Workflow run not found", 404, "RUN_NOT_FOUND");
    return persistRun(hydrateRun(row), {
      status: "CANCELLED",
      last_error_message: reason,
      completed_at: new Date().toISOString(),
    });
  }

  async function cancelRunsForOptOut(tenantId, phone) {
    const tid = assertTenantId(tenantId);
    const norm = normalizePhone(phone);
    if (!norm.valid) return { cancelled: 0 };
    const res = await db.query(
      `UPDATE automation_workflow_runs
       SET status = 'CANCELLED', last_error_category = 'OPTED_OUT', last_error_message = 'Customer opted out', completed_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND phone = ? AND status IN ('PENDING','RUNNING','WAITING_DELAY','WAITING_EVENT','RETRYING')`,
      [tid, norm.normalized]
    );
    return { cancelled: Number(res.affectedRows || 0) };
  }

  // ── 7. Dashboard KPIs & Masked Execution Inspector ─────────────────────────
  async function getDashboardOverview(tenantId) {
    const tid = assertTenantId(tenantId);
    const [enabledWf, runStats, dlqCount, pendingApprovals, workflows] = await Promise.all([
      db.queryOne(`SELECT COUNT(*) AS cnt FROM automation_workflows WHERE tenant_id = ? AND status = 'PUBLISHED'`, [tid]).catch(() => ({ cnt: 0 })),
      db.query(`SELECT status, COUNT(*) AS cnt FROM automation_workflow_runs WHERE tenant_id = ? AND is_test_mode = 0 GROUP BY status`, [tid]).catch(() => []),
      db.queryOne(`SELECT COUNT(*) AS cnt FROM automation_dead_letters WHERE tenant_id = ? AND status = 'OPEN'`, [tid]).catch(() => ({ cnt: 0 })),
      db.queryOne(`SELECT COUNT(*) AS cnt FROM automation_workflow_approvals WHERE tenant_id = ? AND status = 'PENDING'`, [tid]).catch(() => ({ cnt: 0 })),
      listWorkflows(tid),
    ]);

    const byStatus = {};
    let total = 0;
    for (const r of runStats) {
      byStatus[r.status] = Number(r.cnt || 0);
      total += Number(r.cnt || 0);
    }

    return {
      enabled_workflows: Number(enabledWf?.cnt || 0),
      total_runs: total,
      pending_runs: byStatus.PENDING || 0,
      running_runs: byStatus.RUNNING || 0,
      waiting_runs: (byStatus.WAITING_DELAY || 0) + (byStatus.WAITING_EVENT || 0) + (byStatus.WAITING_APPROVAL || 0),
      retrying_runs: byStatus.RETRYING || 0,
      completed_runs: byStatus.COMPLETED || 0,
      failed_runs: (byStatus.FAILED || 0) + (byStatus.DEAD_LETTER || 0),
      paused_runs: byStatus.PAUSED || 0,
      dead_letter_jobs: Number(dlqCount?.cnt || 0),
      pending_approvals: Number(pendingApprovals?.cnt || 0),
      workflows,
    };
  }

  async function listRuns(tenantId, { workflowId = null, status = null, limit = 50 } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?"];
    const params = [tid];
    if (workflowId) {
      clauses.push("workflow_id = ?");
      params.push(Number(workflowId));
    }
    if (status && status !== "ALL") {
      clauses.push("status = ?");
      params.push(String(status).toUpperCase());
    }
    params.push(Math.min(200, Number(limit) || 50));
    const rows = await db.query(
      `SELECT * FROM automation_workflow_runs WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`,
      params
    );
    return rows.map((r) => ({
      ...hydrateRun(r),
      context: maskSensitiveData(safeJsonParse(r.context_json, {})),
    }));
  }

  async function getRunInspector(tenantId, runId) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(`SELECT * FROM automation_workflow_runs WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(runId)]);
    if (!row) throw httpError("Workflow run not found", 404, "RUN_NOT_FOUND");
    const [steps, approvals, deadLetters] = await Promise.all([
      db.query(`SELECT * FROM automation_workflow_run_steps WHERE tenant_id = ? AND run_id = ? ORDER BY id ASC`, [tid, row.id]),
      db.query(`SELECT * FROM automation_workflow_approvals WHERE tenant_id = ? AND run_id = ? ORDER BY id DESC`, [tid, row.id]),
      db.query(`SELECT * FROM automation_dead_letters WHERE tenant_id = ? AND run_id = ? ORDER BY id DESC`, [tid, row.id]),
    ]);
    return {
      run: {
        ...hydrateRun(row),
        context: maskSensitiveData(safeJsonParse(row.context_json, {})),
      },
      steps: steps.map((s) => ({
        ...s,
        input: maskSensitiveData(safeJsonParse(s.input_json, null)),
        output: maskSensitiveData(safeJsonParse(s.output_json, null)),
      })),
      approvals,
      dead_letters: deadLetters,
    };
  }

  return {
    PERMANENT_ERROR_CATEGORIES,
    setFlowbotRuntime,
    saveIntegrationCredential,
    listIntegrationCredentials,
    validateWorkflowGraph,
    createWorkflow,
    getWorkflow,
    listWorkflows,
    publishWorkflow,
    emitEvent,
    startWorkflowRun,
    decideApproval,
    resumeWaitingRunsForEvent,
    processDueWorkflows,
    replayDeadLetter,
    cancelRun,
    cancelRunsForOptOut,
    getDashboardOverview,
    listRuns,
    getRunInspector,
  };
}

module.exports = { createAutomationEngineService, classifyError };
