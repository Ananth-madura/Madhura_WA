"use strict";

/**
 * flowbotRuntimeService.js
 *
 * Enterprise Conversational Flowbot Runtime Engine.
 * Built directly on Madhura's existing `wa_flows` & `wa_flow_versions` tables
 * so the existing `/whatsapp/flows` visual builder remains the single source
 * of truth while gaining full persisted sessions, immutable version rollback,
 * trigger priority routing, 18 validated data-capture types, AI & CRM actions,
 * 24-hour Meta service-window enforcement, human handover, durable restart
 * recovery, and an isolated draft test console.
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
const { createConsentSuppressionService } = require("../campaign/consentSuppressionService");
const { createServiceWindowService } = require("./serviceWindowService");
const {
  evaluateConditionGroup,
  validateCapturedInput,
  interpolateText,
  maskSensitiveData,
} = require("./conditionEvaluator");
const { createAiAgentService } = require("./aiAgentService");
const { createSharedContextService } = require("./sharedContextService");

const MAX_NODES_PER_TURN = 30;
const MAX_TOTAL_NODE_EXECS = 200;
const OPT_OUT_RE = /^(stop|unsubscribe|cancel|optout|opt out|quit)$/i;
const HUMAN_REQ_RE = /^(human|agent|representative|support agent|talk to human|live agent)$/i;

const ACTIVE_SESSION_STATUSES = [
  "NEW",
  "ACTIVE",
  "WAITING_FOR_INPUT",
  "WAITING_FOR_EVENT",
  "WAITING_FOR_DELAY",
  "EXECUTING",
  "HANDOVER_PENDING",
  "HUMAN_OWNED",
];

function createFlowbotRuntimeService(options = {}) {
  const db = createDbHelper(options.db);
  const consentService = options.consentService || createConsentSuppressionService({ db: options.db });
  const serviceWindow = options.serviceWindow || createServiceWindowService({ db: options.db, consentService });
  const aiService = options.aiService || createAiAgentService({ db: options.db, llmClient: options.llmClient });
  const sharedContext = options.sharedContext || createSharedContextService({ db: options.db });
  const messageDispatcher = options.messageDispatcher || null;
  let automationBridge = options.automationBridge || null;

  function setAutomationBridge(bridge) {
    automationBridge = bridge;
  }

  // ── 1. Graph Validation & Immutable Version Publish / Rollback ─────────────
  function validateFlowGraph(nodes = [], entryKey = "start") {
    const errors = [];
    const warnings = [];
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return { valid: false, errors: [{ code: "EMPTY_GRAPH", message: "Flowbot must contain at least one node" }], warnings };
    }

    const byKey = new Map();
    for (const n of nodes) {
      const k = String(n.node_key || n.id || "").trim();
      if (!k) {
        errors.push({ code: "MISSING_NODE_KEY", message: "Every node requires a unique node_key" });
        continue;
      }
      if (byKey.has(k)) {
        errors.push({ code: "DUPLICATE_NODE_KEY", node_key: k, message: `Duplicate node key '${k}'` });
      }
      byKey.set(k, n);
    }

    const resolvedEntry = byKey.has(entryKey) ? entryKey : String(nodes[0].node_key || nodes[0].id);
    if (!byKey.has(resolvedEntry)) {
      errors.push({ code: "MISSING_ENTRY", message: `Entry node '${entryKey}' does not exist` });
    }

    const getTargets = (node) => {
      const cfg = node.config || {};
      const out = [];
      if (cfg.next_node_key) out.push(cfg.next_node_key);
      if (cfg.true_next) out.push(cfg.true_next);
      if (cfg.false_next) out.push(cfg.false_next);
      if (cfg.fallback_next) out.push(cfg.fallback_next);
      if (cfg.timeout_next) out.push(cfg.timeout_next);
      if (cfg.error_next) out.push(cfg.error_next);
      if (cfg.body_next) out.push(cfg.body_next);
      if (cfg.exit_next) out.push(cfg.exit_next);
      if (Array.isArray(cfg.buttons)) {
        for (const b of cfg.buttons) if (b.next_node_key) out.push(b.next_node_key);
      }
      if (Array.isArray(cfg.rows)) {
        for (const r of cfg.rows) if (r.next_node_key) out.push(r.next_node_key);
      }
      if (Array.isArray(cfg.branches)) {
        for (const br of cfg.branches) if (br.next_node_key) out.push(br.next_node_key);
      }
      return out.filter(Boolean);
    };

    let hasHandoverOrEscalation = false;
    for (const [k, node] of byKey.entries()) {
      const type = String(node.node_type || node.type || "").toLowerCase();
      const cfg = node.config || {};
      if (type === "human_handover" || type === "handoff") hasHandoverOrEscalation = true;

      if (type === "loop" && (!cfg.max_iterations || Number(cfg.max_iterations) > 50)) {
        errors.push({ code: "UNBOUNDED_LOOP", node_key: k, message: "Loop nodes must specify max_iterations <= 50" });
      }
      if (type === "ai_action" && Array.isArray(cfg.allowed_tools)) {
        try {
          aiService.assertAiToolsAllowed(cfg.allowed_tools);
        } catch (err) {
          errors.push({ code: "AI_FORBIDDEN_ACTION", node_key: k, message: err.message });
        }
      }

      for (const target of getTargets(node)) {
        if (!byKey.has(target)) {
          errors.push({ code: "BROKEN_EDGE", node_key: k, message: `Node '${k}' points to missing target '${target}'` });
        }
      }
    }

    if (!hasHandoverOrEscalation) {
      warnings.push({
        code: "NO_EXPLICIT_HANDOVER",
        message: "Meta policy recommends a clear human escalation path. Runtime will still honor 'human'/'agent' keywords.",
      });
    }

    // Reachability check
    const visited = new Set();
    const queue = [resolvedEntry];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (!cur || visited.has(cur) || !byKey.has(cur)) continue;
      visited.add(cur);
      for (const t of getTargets(byKey.get(cur))) {
        if (!visited.has(t)) queue.push(t);
      }
    }
    for (const k of byKey.keys()) {
      if (!visited.has(k)) {
        warnings.push({ code: "UNREACHABLE_NODE", node_key: k, message: `Node '${k}' is unreachable from '${resolvedEntry}'` });
      }
    }

    return { valid: errors.length === 0, errors, warnings, entry_node_key: resolvedEntry };
  }

  async function publishFlowVersion(tenantId, flowId, {
    nodes = null,
    entryNodeKey = "start",
    triggerType = null,
    triggerConfig = null,
    name = null,
  } = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const flow = await db.queryOne(`SELECT * FROM wa_flows WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(flowId)]);
    if (!flow) throw httpError("Flowbot not found", 404, "FLOWBOT_NOT_FOUND");

    let graphNodes = nodes;
    if (!Array.isArray(graphNodes)) {
      const dbNodes = await db.query(`SELECT * FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC`, [flow.id]).catch(() => []);
      graphNodes = dbNodes.map((n) => ({
        node_key: n.node_key,
        node_type: n.node_type,
        config: safeJsonParse(n.config, {}),
      }));
    }

    const validation = validateFlowGraph(graphNodes, entryNodeKey);
    if (!validation.valid) {
      throw httpError(
        `Flowbot validation failed: ${validation.errors.map((e) => e.message).join("; ")}`,
        400,
        "FLOWBOT_VALIDATION_FAILED"
      );
    }

    const maxVer = await db.queryOne(
      `SELECT COALESCE(MAX(version_number), 0) AS max_v FROM wa_flow_versions WHERE flow_id = ?`,
      [flow.id]
    );
    const nextVersion = Number(maxVer?.max_v || 0) + 1;

    // Demote previously published version to archived (existing sessions stay pinned to their version_id!)
    await db.query(
      `UPDATE wa_flow_versions SET status = 'archived' WHERE flow_id = ? AND status = 'published'`,
      [flow.id]
    );

    const res = await db.query(
      `INSERT INTO wa_flow_versions
       (flow_id, tenant_id, version_number, status, name, trigger_type, trigger_config, entry_node_key, nodes_snapshot, published_by)
       VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?, ?)`,
      [
        flow.id,
        tid,
        nextVersion,
        name || flow.name,
        triggerType || flow.trigger_type || "keyword",
        JSON.stringify(triggerConfig || safeJsonParse(flow.trigger_config, {})),
        validation.entry_node_key,
        JSON.stringify(graphNodes),
        actorId || null,
      ]
    );

    await db.query(`UPDATE wa_flows SET status = 'active' WHERE tenant_id = ? AND id = ?`, [tid, flow.id]).catch(() => {});

    return {
      flow_id: flow.id,
      version_id: res.insertId,
      version_number: nextVersion,
      status: "published",
      warnings: validation.warnings,
    };
  }

  async function rollbackFlowVersion(tenantId, flowId, targetVersionNumber, actorId = null) {
    const tid = assertTenantId(tenantId);
    const target = await db.queryOne(
      `SELECT * FROM wa_flow_versions WHERE flow_id = ? AND version_number = ? LIMIT 1`,
      [Number(flowId), Number(targetVersionNumber)]
    );
    if (!target) throw httpError("Target Flowbot version not found", 404, "VERSION_NOT_FOUND");
    const flow = await db.queryOne(`SELECT id FROM wa_flows WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(flowId)]);
    if (!flow) throw httpError("Flowbot not found", 404, "FLOWBOT_NOT_FOUND");

    await db.query(`UPDATE wa_flow_versions SET status = 'archived' WHERE flow_id = ? AND status = 'published'`, [flow.id]);
    await db.query(`UPDATE wa_flow_versions SET status = 'published', published_by = COALESCE(?, published_by) WHERE id = ?`, [actorId || null, target.id]);

    return {
      flow_id: flow.id,
      rolled_back_to_version: target.version_number,
      version_id: target.id,
      note: "Existing active sessions remain pinned to their original version; new conversations use this version.",
    };
  }

  async function listFlowVersions(tenantId, flowId) {
    const tid = assertTenantId(tenantId);
    const flow = await db.queryOne(`SELECT id FROM wa_flows WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(flowId)]);
    if (!flow) throw httpError("Flowbot not found", 404, "FLOWBOT_NOT_FOUND");
    return db.query(
      `SELECT id, flow_id, version_number, status, name, trigger_type, entry_node_key, published_by, created_at
       FROM wa_flow_versions WHERE flow_id = ? ORDER BY version_number DESC LIMIT 50`,
      [flow.id]
    );
  }

  // ── 2. Trigger Priority Registry ───────────────────────────────────────────
  async function registerTrigger(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    if (!input.flow_id || !input.trigger_type) {
      throw httpError("flow_id and trigger_type are required", 400, "TRIGGER_INVALID");
    }
    const flow = await db.queryOne(`SELECT id FROM wa_flows WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(input.flow_id)]);
    if (!flow) throw httpError("Flowbot not found for tenant", 404, "FLOWBOT_NOT_FOUND");

    const res = await db.query(
      `INSERT INTO flowbot_triggers
       (tenant_id, workspace_id, flow_id, trigger_type, match_value, campaign_id, sender_id, entry_node_key, priority, is_active, conditions_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        input.workspace_id || null,
        Number(input.flow_id),
        String(input.trigger_type).toLowerCase(),
        input.match_value ? String(input.match_value).trim() : null,
        input.campaign_id ? Number(input.campaign_id) : null,
        input.sender_id ? Number(input.sender_id) : null,
        input.entry_node_key || "start",
        Number(input.priority ?? 50),
        input.is_active === false ? 0 : 1,
        JSON.stringify(input.conditions || null),
        actorId || null,
      ]
    );
    return { id: res.insertId, flow_id: Number(input.flow_id), trigger_type: input.trigger_type, priority: Number(input.priority ?? 50) };
  }

  async function resolveMatchingTrigger(tenantId, {
    text = "",
    buttonPayload = null,
    listRowId = null,
    campaignId = null,
    senderId = null,
    isFirstMessage = false,
    isWhatsAppFlowCompletion = false,
  } = {}) {
    const tid = assertTenantId(tenantId);
    const triggers = await db.query(
      `SELECT t.*, f.status AS flow_status
       FROM flowbot_triggers t
       JOIN wa_flows f ON f.id = t.flow_id AND f.tenant_id = t.tenant_id
       WHERE t.tenant_id = ? AND t.is_active = 1 AND f.status = 'active'
       ORDER BY t.priority ASC, t.id ASC`,
      [tid]
    );

    const lcText = String(text || "").trim().toLowerCase();
    for (const trig of triggers) {
      if (trig.sender_id && senderId && Number(trig.sender_id) !== Number(senderId)) continue;
      if (trig.campaign_id && Number(trig.campaign_id) !== Number(campaignId)) continue;

      const mv = String(trig.match_value || "").trim().toLowerCase();
      switch (trig.trigger_type) {
        case "quick_reply":
          if (buttonPayload && (!mv || String(buttonPayload).toLowerCase() === mv)) return trig;
          break;
        case "list_selection":
          if (listRowId && (!mv || String(listRowId).toLowerCase() === mv)) return trig;
          break;
        case "whatsapp_flow_completion":
          if (isWhatsAppFlowCompletion) return trig;
          break;
        case "campaign_response":
          if (campaignId && (!mv || lcText.includes(mv) || String(buttonPayload || "").toLowerCase() === mv)) return trig;
          break;
        case "keyword":
          if (mv && lcText.split(/\s+/).includes(mv)) return trig;
          break;
        case "phrase":
          if (mv && lcText.includes(mv)) return trig;
          break;
        case "first_message":
          if (isFirstMessage) return trig;
          break;
        case "help_intent":
          if (/\b(help|assist|support)\b/i.test(lcText)) return trig;
          break;
        case "sales_intent":
          if (/\b(buy|price|quote|demo|sales|interested)\b/i.test(lcText)) return trig;
          break;
        case "support_intent":
          if (/\b(issue|problem|broken|order|refund|ticket)\b/i.test(lcText)) return trig;
          break;
        case "existing_contact":
        case "all_inbound":
          return trig;
        default:
          break;
      }
    }
    return null;
  }

  // ── 3. Outbound Delivery with Service Window & Consent Guard ───────────────
  async function sendBotMessage(session, payload, isTestMode = false) {
    const messageType = payload.message_type || "text";
    if (!isTestMode) {
      const elig = await serviceWindow.checkOutboundEligibility(session.tenant_id, {
        senderId: session.sender_id,
        phone: session.phone,
        messageType,
        templateId: payload.template_id || null,
        category: payload.category || (messageType === "template" ? "MARKETING" : "SERVICE"),
        workspaceId: session.workspace_id,
      });
      if (!elig.eligible) {
        return { sent: false, blocked: true, code: elig.code, reason: elig.reason };
      }
      if (messageDispatcher && typeof messageDispatcher.send === "function") {
        const res = await messageDispatcher.send(session.tenant_id, {
          sender_id: session.sender_id,
          phone: session.phone,
          ...payload,
        });
        return { sent: true, blocked: false, provider_message_id: res?.message_id || null, payload };
      }
    }
    return {
      sent: true,
      blocked: false,
      simulated: Boolean(isTestMode),
      provider_message_id: isTestMode ? `sim_${generateUid("msg")}` : null,
      payload,
    };
  }

  async function recordStep(session, nodeKey, nodeType, status, { input = null, output = null, errorCode = null, errorMessage = null, durationMs = 0 } = {}) {
    await db.query(
      `INSERT INTO flowbot_execution_steps
       (tenant_id, session_id, flow_id, flow_version_id, node_key, node_type, status, input_json, output_json, error_code, error_message, duration_ms, is_test_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.tenant_id,
        session.id,
        session.flow_id,
        session.flow_version_id || null,
        String(nodeKey),
        String(nodeType),
        status,
        input ? JSON.stringify(maskSensitiveData(input)) : null,
        output ? JSON.stringify(maskSensitiveData(output)) : null,
        errorCode,
        errorMessage,
        Math.max(0, Math.round(durationMs)),
        session.is_test_mode ? 1 : 0,
      ]
    );
  }

  async function loadVersionGraph(flowId, versionId = null) {
    const ver = versionId
      ? await db.queryOne(`SELECT * FROM wa_flow_versions WHERE id = ? LIMIT 1`, [Number(versionId)])
      : await db.queryOne(`SELECT * FROM wa_flow_versions WHERE flow_id = ? AND status = 'published' ORDER BY version_number DESC LIMIT 1`, [Number(flowId)]);
    if (!ver) return null;
    const nodes = safeJsonParse(ver.nodes_snapshot, []);
    const byKey = new Map();
    for (const n of nodes) byKey.set(String(n.node_key || n.id), n);
    return { version: ver, nodes, byKey };
  }

  async function updateSession(session, patch = {}) {
    const merged = { ...session, ...patch };
    await db.query(
      `UPDATE flowbot_sessions
       SET status = ?, current_node_key = ?, previous_node_key = ?,
           variables_json = ?, collected_data_json = ?, subflow_stack_json = ?,
           attempt_count = ?, iteration_count = ?, node_exec_count = ?,
           waiting_for_variable = ?, waiting_until = ?, resume_event = ?, timeout_node_key = ?,
           handover_agent_id = ?, handover_team_id = ?, handover_summary = ?,
           last_error_code = ?, last_error_message = ?,
           completed_at = ?, last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        merged.status,
        merged.current_node_key || null,
        merged.previous_node_key || null,
        JSON.stringify(merged.variables || {}),
        JSON.stringify(merged.collected_data || {}),
        JSON.stringify(merged.subflow_stack || []),
        Number(merged.attempt_count || 0),
        Number(merged.iteration_count || 0),
        Number(merged.node_exec_count || 0),
        merged.waiting_for_variable || null,
        merged.waiting_until || null,
        merged.resume_event || null,
        merged.timeout_node_key || null,
        merged.handover_agent_id || null,
        merged.handover_team_id || null,
        merged.handover_summary || null,
        merged.last_error_code || null,
        merged.last_error_message || null,
        merged.completed_at || null,
        merged.id,
      ]
    );
    return merged;
  }

  function hydrateSession(row) {
    if (!row) return null;
    return {
      ...row,
      variables: safeJsonParse(row.variables_json, {}),
      collected_data: safeJsonParse(row.collected_data_json, {}),
      subflow_stack: safeJsonParse(row.subflow_stack_json, []),
    };
  }

  // ── 4. Core Session Step Execution Loop ────────────────────────────────────
  async function executeSessionLoop(sessionInput, { inboundInput = null, inboundMeta = {} } = {}) {
    let session = sessionInput;
    const graph = await loadVersionGraph(session.flow_id, session.flow_version_id);
    if (!graph) {
      session = await updateSession(session, {
        status: "FAILED",
        last_error_code: "VERSION_MISSING",
        last_error_message: "Published Flowbot version not found",
      });
      return { session, messages: [] };
    }

    const outgoingMessages = [];
    let stepsThisTurn = 0;

    // If session was waiting for input, consume the inbound message first!
    if (session.status === "WAITING_FOR_INPUT" && inboundInput !== null) {
      const waitNode = graph.byKey.get(session.current_node_key);
      if (waitNode) {
        const cfg = waitNode.config || {};
        const nType = String(waitNode.node_type || waitNode.type || "").toLowerCase();

        // Button / List branch matching
        if (nType === "send_buttons" || nType === "send_list") {
          const choices = nType === "send_buttons" ? (cfg.buttons || []) : (cfg.rows || []);
          const rawVal = String(inboundMeta.buttonPayload || inboundMeta.listRowId || inboundInput || "").trim();
          const matched = choices.find(
            (c) =>
              String(c.id || "").toLowerCase() === rawVal.toLowerCase() ||
              String(c.label || c.title || "").toLowerCase() === rawVal.toLowerCase()
          );

          if (matched) {
            const varName = cfg.save_as || "selected_option";
            session.variables[varName] = matched.id || matched.label || matched.title;
            session.collected_data[varName] = matched.label || matched.title || matched.id;
            session.variables.last_input = rawVal;
            await recordStep(session, waitNode.node_key, nType, "INPUT_MATCHED", {
              input: { rawVal },
              output: { matched_id: matched.id, next: matched.next_node_key || cfg.next_node_key },
            });
            session = await updateSession(session, {
              status: "EXECUTING",
              previous_node_key: waitNode.node_key,
              current_node_key: matched.next_node_key || cfg.next_node_key || null,
              attempt_count: 0,
              waiting_for_variable: null,
              waiting_until: null,
            });
          } else {
            // Free text fallback instead of clicking expected button
            const attempts = Number(session.attempt_count || 0) + 1;
            const maxAttempts = Number(cfg.max_attempts || 2);
            if (attempts >= maxAttempts && cfg.fallback_next) {
              session.variables.last_input = rawVal;
              await recordStep(session, waitNode.node_key, nType, "FALLBACK_ROUTED", { input: { rawVal, attempts } });
              session = await updateSession(session, {
                status: "EXECUTING",
                previous_node_key: waitNode.node_key,
                current_node_key: cfg.fallback_next,
                attempt_count: 0,
                waiting_until: null,
              });
            } else {
              const retryText = cfg.error_response || "Please select one of the available options, or reply HUMAN to speak with an agent.";
              const sent = await sendBotMessage(session, { message_type: "text", text: retryText }, Boolean(session.is_test_mode));
              outgoingMessages.push(sent);
              session = await updateSession(session, { status: "WAITING_FOR_INPUT", attempt_count: attempts });
              return { session, messages: outgoingMessages };
            }
          }
        } else if (nType === "ask_input" || nType === "collect_input") {
          const check = validateCapturedInput(inboundInput, cfg);
          if (!check.valid) {
            const attempts = Number(session.attempt_count || 0) + 1;
            const maxAttempts = Number(cfg.max_attempts || 3);
            await recordStep(session, waitNode.node_key, nType, "VALIDATION_FAILED", {
              input: { raw: inboundInput, attempts },
              errorCode: "INVALID_INPUT",
              errorMessage: check.error,
            });
            if (attempts >= maxAttempts) {
              if (cfg.fallback_next) {
                session = await updateSession(session, {
                  status: "EXECUTING",
                  previous_node_key: waitNode.node_key,
                  current_node_key: cfg.fallback_next,
                  attempt_count: 0,
                  waiting_until: null,
                });
              } else {
                const msg = await sendBotMessage(session, { message_type: "text", text: cfg.fallback_message || "I could not verify that input. Connecting you to our team." }, Boolean(session.is_test_mode));
                outgoingMessages.push(msg);
                session = await updateSession(session, { status: "HANDOVER_PENDING", handover_summary: `Max input attempts exceeded at ${waitNode.node_key}` });
                return { session, messages: outgoingMessages };
              }
            } else {
              const sent = await sendBotMessage(session, { message_type: "text", text: check.error }, Boolean(session.is_test_mode));
              outgoingMessages.push(sent);
              session = await updateSession(session, { status: "WAITING_FOR_INPUT", attempt_count: attempts });
              return { session, messages: outgoingMessages };
            }
          } else {
            const varName = cfg.variable_name || waitNode.node_key;
            session.variables[varName] = check.value;
            session.collected_data[varName] = check.value;
            session.variables.last_input = check.value;
            await recordStep(session, waitNode.node_key, nType, "INPUT_CAPTURED", {
              input: { raw: inboundInput },
              output: { variable: varName, value: check.value },
            });
            session = await updateSession(session, {
              status: "EXECUTING",
              previous_node_key: waitNode.node_key,
              current_node_key: cfg.next_node_key || null,
              attempt_count: 0,
              waiting_for_variable: null,
              waiting_until: null,
            });
          }
        }
      }
    }

    // Advance graph nodes until we wait, hand over, complete, or hit cap
    while (session.current_node_key && stepsThisTurn < MAX_NODES_PER_TURN) {
      if (Number(session.node_exec_count || 0) >= MAX_TOTAL_NODE_EXECS) {
        session = await updateSession(session, {
          status: "FAILED",
          last_error_code: "NODE_EXECUTION_CAP",
          last_error_message: `Flowbot exceeded maximum node execution cap (${MAX_TOTAL_NODE_EXECS})`,
        });
        break;
      }

      const node = graph.byKey.get(session.current_node_key);
      if (!node) {
        session = await updateSession(session, { status: "COMPLETED", completed_at: new Date().toISOString() });
        break;
      }

      stepsThisTurn++;
      session.node_exec_count = Number(session.node_exec_count || 0) + 1;
      const t0 = Date.now();
      const nType = String(node.node_type || node.type || "").toLowerCase();
      const cfg = node.config || {};

      // Reload fresh CRM context so variables are never stale
      const ctx = await sharedContext.loadFreshContext(session.tenant_id, {
        workspaceId: session.workspace_id,
        contactId: session.contact_id,
        phone: session.phone,
        conversationId: session.conversation_id,
        senderId: session.sender_id,
        wabaId: session.waba_id,
        campaignId: session.campaign_id,
        flowVars: session.variables,
        aiVars: session.variables._ai || {},
      });

      try {
        if (nType === "start") {
          await recordStep(session, node.node_key, nType, "COMPLETED", { durationMs: Date.now() - t0 });
          session = await updateSession(session, {
            status: "EXECUTING",
            previous_node_key: node.node_key,
            current_node_key: cfg.next_node_key || null,
          });
          continue;
        }

        if (nType === "send_text" || nType === "send_message") {
          const text = interpolateText(cfg.text || cfg.message || "", ctx);
          const sent = await sendBotMessage(session, { message_type: "text", text }, Boolean(session.is_test_mode));
          outgoingMessages.push(sent);
          if (sent.blocked) {
            await recordStep(session, node.node_key, nType, "BLOCKED", { output: sent, errorCode: sent.code, errorMessage: sent.reason, durationMs: Date.now() - t0 });
            session = await updateSession(session, {
              status: cfg.error_next ? "EXECUTING" : "FAILED",
              current_node_key: cfg.error_next || node.node_key,
              last_error_code: sent.code,
              last_error_message: sent.reason,
            });
            if (!cfg.error_next) break;
            continue;
          }
          await recordStep(session, node.node_key, nType, "COMPLETED", { output: { text, message_id: sent.provider_message_id }, durationMs: Date.now() - t0 });
          session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: cfg.next_node_key || null });
          continue;
        }

        if (nType === "send_media" || nType === "send_catalog" || nType === "send_whatsapp_flow" || nType === "send_template") {
          const payload = {
            message_type: nType === "send_template" ? "template" : nType.replace("send_", ""),
            template_id: cfg.template_id || null,
            category: cfg.category || "UTILITY",
            media_type: cfg.media_type || null,
            media_url: interpolateText(cfg.media_url || "", ctx),
            caption: interpolateText(cfg.caption || "", ctx),
            catalog_id: cfg.catalog_id || null,
            product_ids: cfg.product_ids || [],
            whatsapp_flow_id: cfg.whatsapp_flow_id || null,
            flow_token: cfg.whatsapp_flow_id ? `fb_${session.session_uid}_${Date.now()}` : null,
            variables: cfg.variables || {},
          };
          const sent = await sendBotMessage(session, payload, Boolean(session.is_test_mode));
          outgoingMessages.push(sent);
          if (sent.blocked) {
            await recordStep(session, node.node_key, nType, "BLOCKED", { output: sent, errorCode: sent.code, errorMessage: sent.reason, durationMs: Date.now() - t0 });
            session = await updateSession(session, { status: "FAILED", last_error_code: sent.code, last_error_message: sent.reason });
            break;
          }
          await recordStep(session, node.node_key, nType, "COMPLETED", { output: sent, durationMs: Date.now() - t0 });
          if (nType === "send_whatsapp_flow" && cfg.wait_for_completion !== false) {
            session = await updateSession(session, {
              status: "WAITING_FOR_EVENT",
              resume_event: "whatsapp_flow_submitted",
              current_node_key: cfg.next_node_key || null,
            });
            break;
          }
          session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: cfg.next_node_key || null });
          continue;
        }

        if (nType === "send_buttons" || nType === "send_list") {
          const body = interpolateText(cfg.text || cfg.body || "", ctx);
          const sent = await sendBotMessage(session, {
            message_type: nType === "send_buttons" ? "buttons" : "list",
            text: body,
            buttons: cfg.buttons || [],
            title: cfg.title || "",
            rows: cfg.rows || [],
          }, Boolean(session.is_test_mode));
          outgoingMessages.push(sent);
          if (sent.blocked) {
            await recordStep(session, node.node_key, nType, "BLOCKED", { errorCode: sent.code, errorMessage: sent.reason, durationMs: Date.now() - t0 });
            session = await updateSession(session, { status: "FAILED", last_error_code: sent.code, last_error_message: sent.reason });
            break;
          }
          const timeoutUntil = cfg.timeout_seconds
            ? new Date(Date.now() + Number(cfg.timeout_seconds) * 1000).toISOString()
            : null;
          await recordStep(session, node.node_key, nType, "WAITING_FOR_INPUT", { output: { text: body }, durationMs: Date.now() - t0 });
          session = await updateSession(session, {
            status: "WAITING_FOR_INPUT",
            current_node_key: node.node_key,
            waiting_until: timeoutUntil,
            timeout_node_key: cfg.timeout_next || null,
          });
          break;
        }

        if (nType === "ask_input" || nType === "collect_input") {
          const promptText = interpolateText(cfg.prompt || cfg.text || "", ctx);
          const sent = await sendBotMessage(session, { message_type: "text", text: promptText }, Boolean(session.is_test_mode));
          outgoingMessages.push(sent);
          if (sent.blocked) {
            await recordStep(session, node.node_key, nType, "BLOCKED", { errorCode: sent.code, errorMessage: sent.reason, durationMs: Date.now() - t0 });
            session = await updateSession(session, { status: "FAILED", last_error_code: sent.code, last_error_message: sent.reason });
            break;
          }
          const timeoutUntil = cfg.timeout_seconds
            ? new Date(Date.now() + Number(cfg.timeout_seconds) * 1000).toISOString()
            : null;
          await recordStep(session, node.node_key, nType, "WAITING_FOR_INPUT", { output: { prompt: promptText, variable: cfg.variable_name }, durationMs: Date.now() - t0 });
          session = await updateSession(session, {
            status: "WAITING_FOR_INPUT",
            current_node_key: node.node_key,
            waiting_for_variable: cfg.variable_name || node.node_key,
            waiting_until: timeoutUntil,
            timeout_node_key: cfg.timeout_next || null,
          });
          break;
        }

        if (nType === "condition") {
          const matched = evaluateConditionGroup(cfg.condition || cfg, ctx);
          const nextKey = matched ? cfg.true_next : cfg.false_next;
          await recordStep(session, node.node_key, nType, "COMPLETED", { output: { matched, next_node_key: nextKey }, durationMs: Date.now() - t0 });
          session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: nextKey || null });
          continue;
        }

        if (nType === "crm_action" || nType === "create_lead" || nType === "create_deal" || nType === "schedule_followup" || nType === "set_tag") {
          const effectiveAction = nType === "crm_action"
            ? cfg.action
            : nType === "schedule_followup"
            ? "schedule_follow_up"
            : nType === "set_tag"
            ? "add_tag"
            : nType;
          const rawParams = nType === "crm_action" ? (cfg.params || {}) : cfg;
          const resolvedParams = {};
          for (const [k, v] of Object.entries(rawParams)) {
            resolvedParams[k] = typeof v === "string" ? interpolateText(v, ctx) : v;
          }
          const res = session.is_test_mode && !cfg.allow_crm_write_in_test
            ? { ok: true, simulated: true, action: effectiveAction, params: resolvedParams }
            : await sharedContext.executeCrmAction(session.tenant_id, effectiveAction, resolvedParams, ctx);
          session.variables[cfg.output_var || "last_crm_result"] = res;
          await recordStep(session, node.node_key, nType, res.ok ? "COMPLETED" : "FAILED", { output: res, durationMs: Date.now() - t0 });
          session = await updateSession(session, {
            status: "EXECUTING",
            previous_node_key: node.node_key,
            current_node_key: res.ok ? (cfg.next_node_key || null) : (cfg.error_next || cfg.next_node_key || null),
          });
          continue;
        }

        if (nType === "ai_action") {
          const aiOut = await aiService.executeAiNode(session.tenant_id, cfg, ctx);
          session.variables._ai = aiOut;
          session.variables[cfg.output_var || "ai_result"] = aiOut;
          await recordStep(session, node.node_key, nType, "COMPLETED", { output: aiOut, durationMs: Date.now() - t0 });

          if (aiOut.below_threshold && cfg.fallback_next) {
            session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: cfg.fallback_next });
            continue;
          }
          if (cfg.send_reply && aiOut.draft_reply && !aiOut.requires_human_approval) {
            const sent = await sendBotMessage(session, { message_type: "text", text: aiOut.draft_reply }, Boolean(session.is_test_mode));
            outgoingMessages.push(sent);
          }
          session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: cfg.next_node_key || null });
          continue;
        }

        if (nType === "wait" || nType === "delay") {
          const delaySec = Math.max(1, Number(cfg.delay_seconds || cfg.seconds || 60));
          const resumeAt = new Date(Date.now() + delaySec * 1000).toISOString();
          await recordStep(session, node.node_key, nType, "WAITING_FOR_DELAY", { output: { resume_at: resumeAt }, durationMs: Date.now() - t0 });
          session = await updateSession(session, {
            status: "WAITING_FOR_DELAY",
            previous_node_key: node.node_key,
            current_node_key: cfg.next_node_key || null,
            waiting_until: resumeAt,
          });
          break;
        }

        if (nType === "loop") {
          const maxIter = Math.min(50, Math.max(1, Number(cfg.max_iterations || 5)));
          const iter = Number(session.iteration_count || 0);
          if (iter < maxIter) {
            session.iteration_count = iter + 1;
            await recordStep(session, node.node_key, nType, "COMPLETED", { output: { iteration: session.iteration_count, max_iterations: maxIter } });
            session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: cfg.body_next || cfg.next_node_key || null });
          } else {
            await recordStep(session, node.node_key, nType, "COMPLETED", { output: { loop_finished: true, iterations: iter } });
            session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: cfg.exit_next || null, iteration_count: 0 });
          }
          continue;
        }

        if (nType === "goto") {
          session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: cfg.target_node_key || cfg.next_node_key || null });
          continue;
        }

        if (nType === "start_automation") {
          let emitted = { triggered: false };
          if (automationBridge && typeof automationBridge.emitEvent === "function") {
            emitted = await automationBridge.emitEvent(
              session.tenant_id,
              cfg.event_type || "flowbot_triggered_automation",
              {
                workspace_id: session.workspace_id,
                contact_id: session.contact_id,
                phone: session.phone,
                conversation_id: session.conversation_id,
                campaign_id: session.campaign_id,
                sender_id: session.sender_id,
                flow_session_id: session.id,
                collected_data: session.collected_data,
                ai: session.variables._ai || null,
                ...(cfg.payload || {}),
              },
              {
                source: "flowbot",
                idempotencyKey: `fb_auto_${session.id}_${node.node_key}`,
                isTestMode: Boolean(session.is_test_mode),
              }
            );
          }
          await recordStep(session, node.node_key, nType, "COMPLETED", { output: emitted, durationMs: Date.now() - t0 });
          session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: cfg.next_node_key || null });
          continue;
        }

        if (nType === "human_handover" || nType === "handoff") {
          const summary = interpolateText(
            cfg.summary_template ||
              `Handover for {{customer.name|Customer}} ({{customer.phone}}). Collected: ${JSON.stringify(session.collected_data || {})}`,
            ctx
          );
          if (cfg.handover_message) {
            const sent = await sendBotMessage(session, { message_type: "text", text: interpolateText(cfg.handover_message, ctx) }, Boolean(session.is_test_mode));
            outgoingMessages.push(sent);
          }
          const hoRes = await db.query(
            `INSERT INTO flowbot_handover_events
             (tenant_id, workspace_id, session_id, conversation_id, contact_id, phone, routing_strategy, assigned_agent_id, assigned_team_id, priority, escalation_channel, reason, context_summary, collected_answers_json, bot_paused, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'OPEN')`,
            [
              session.tenant_id,
              session.workspace_id,
              session.id,
              session.conversation_id,
              session.contact_id,
              session.phone,
              cfg.routing_strategy || "round_robin",
              cfg.agent_id || null,
              cfg.team_id || null,
              cfg.priority || "high",
              cfg.escalation_channel || "in_chat",
              cfg.reason || "Flowbot handover node",
              summary,
              JSON.stringify(session.collected_data || {}),
            ]
          );
          await recordStep(session, node.node_key, nType, "HANDED_OVER", {
            output: { handover_id: hoRes.insertId, agent_id: cfg.agent_id || null, team_id: cfg.team_id || null, summary },
            durationMs: Date.now() - t0,
          });
          session = await updateSession(session, {
            status: "HUMAN_OWNED",
            previous_node_key: node.node_key,
            current_node_key: cfg.resume_node_key || cfg.next_node_key || null,
            handover_agent_id: cfg.agent_id || null,
            handover_team_id: cfg.team_id || null,
            handover_summary: summary,
          });
          if (automationBridge && typeof automationBridge.emitEvent === "function") {
            await automationBridge.emitEvent(
              session.tenant_id,
              "human_handover",
              {
                session_id: session.id,
                handover_id: hoRes.insertId,
                phone: session.phone,
                contact_id: session.contact_id,
                campaign_id: session.campaign_id,
                summary,
                collected_data: session.collected_data,
              },
              { source: "flowbot", idempotencyKey: `ho_${hoRes.insertId}`, isTestMode: Boolean(session.is_test_mode) }
            ).catch(() => {});
          }
          break;
        }

        if (nType === "end" || nType === "exit" || nType === "stop") {
          await recordStep(session, node.node_key, nType, "COMPLETED", { durationMs: Date.now() - t0 });
          session = await updateSession(session, {
            status: "COMPLETED",
            previous_node_key: node.node_key,
            current_node_key: null,
            completed_at: new Date().toISOString(),
          });
          if (automationBridge && typeof automationBridge.emitEvent === "function") {
            await automationBridge.emitEvent(
              session.tenant_id,
              "flowbot_completed",
              {
                session_id: session.id,
                flow_id: session.flow_id,
                phone: session.phone,
                contact_id: session.contact_id,
                campaign_id: session.campaign_id,
                collected_data: session.collected_data,
              },
              { source: "flowbot", idempotencyKey: `fb_done_${session.id}`, isTestMode: Boolean(session.is_test_mode) }
            ).catch(() => {});
          }
          break;
        }

        // Default pass-through for unknown/extension node types
        await recordStep(session, node.node_key, nType, "COMPLETED", { durationMs: Date.now() - t0 });
        session = await updateSession(session, { status: "EXECUTING", previous_node_key: node.node_key, current_node_key: cfg.next_node_key || null });
      } catch (err) {
        await recordStep(session, node.node_key, nType, "ERROR", {
          errorCode: err.code || "NODE_ERROR",
          errorMessage: err.message,
          durationMs: Date.now() - t0,
        });
        if (cfg.error_next) {
          session = await updateSession(session, {
            status: "EXECUTING",
            previous_node_key: node.node_key,
            current_node_key: cfg.error_next,
            last_error_code: err.code || "NODE_ERROR",
            last_error_message: err.message,
          });
          continue;
        }
        session = await updateSession(session, {
          status: "FAILED",
          last_error_code: err.code || "NODE_ERROR",
          last_error_message: err.message,
        });
        break;
      }
    }

    if (!session.current_node_key && session.status === "EXECUTING") {
      session = await updateSession(session, { status: "COMPLETED", completed_at: new Date().toISOString() });
    }

    return { session, messages: outgoingMessages };
  }

  // ── 5. Public Entrypoints: Start, Inbound Message, Resume, Handover, Test ──
  async function startSession(tenantId, {
    flowId,
    phone,
    contactId = null,
    conversationId = null,
    senderId = null,
    wabaId = null,
    campaignId = null,
    workspaceId = null,
    entryNodeKey = null,
    initialVars = {},
    isTestMode = false,
  } = {}) {
    const tid = assertTenantId(tenantId);
    const norm = normalizePhone(phone);
    if (!norm.valid) throw httpError("Valid phone number is required", 400, "INVALID_PHONE");

    const graph = await loadVersionGraph(flowId, null);
    if (!graph) throw httpError("No published version found for this Flowbot", 409, "FLOWBOT_NOT_PUBLISHED");

    // Prevent accidental duplicate active Flowbots on the same conversation/phone
    const existingActive = await db.queryOne(
      `SELECT id, status, flow_id FROM flowbot_sessions
       WHERE tenant_id = ? AND phone = ? AND is_test_mode = ?
         AND status IN ('NEW','ACTIVE','WAITING_FOR_INPUT','WAITING_FOR_EVENT','WAITING_FOR_DELAY','EXECUTING','HANDOVER_PENDING','HUMAN_OWNED')
       ORDER BY id DESC LIMIT 1`,
      [tid, norm.normalized, isTestMode ? 1 : 0]
    );
    if (existingActive) {
      return {
        started: false,
        duplicate_prevented: true,
        existing_session_id: existingActive.id,
        existing_status: existingActive.status,
      };
    }

    const sessionUid = generateUid("fbs");
    const entry = entryNodeKey || graph.version.entry_node_key || "start";
    const res = await db.query(
      `INSERT INTO flowbot_sessions
       (session_uid, tenant_id, workspace_id, conversation_id, contact_id, phone, sender_id, waba_id, campaign_id,
        flow_id, flow_version_id, flow_version_number, status, current_node_key, variables_json, collected_data_json, is_test_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, '{}', ?)`,
      [
        sessionUid,
        tid,
        workspaceId || null,
        conversationId || null,
        contactId || null,
        norm.normalized,
        senderId || null,
        wabaId || null,
        campaignId || null,
        Number(flowId),
        graph.version.id,
        graph.version.version_number,
        entry,
        JSON.stringify(initialVars || {}),
        isTestMode ? 1 : 0,
      ]
    );

    const row = await db.queryOne(`SELECT * FROM flowbot_sessions WHERE id = ?`, [res.insertId]);
    const result = await executeSessionLoop(hydrateSession(row));
    return { started: true, ...result };
  }

  async function handleInboundMessage(tenantId, {
    phone,
    text = "",
    buttonPayload = null,
    listRowId = null,
    senderId = null,
    wabaId = null,
    conversationId = null,
    contactId = null,
    campaignId = null,
    workspaceId = null,
    messageId = null,
    inboundAt = new Date(),
    isFirstMessage = false,
    isWhatsAppFlowCompletion = false,
    flowResponseData = null,
  } = {}) {
    const tid = assertTenantId(tenantId);
    const norm = normalizePhone(phone);
    if (!norm.valid) return { handled: false, reason: "invalid_phone" };

    // 1. Update real 24-hour Meta Customer Service Window using actual inbound timestamp
    await serviceWindow.recordInboundMessage(tid, {
      senderId,
      wabaId,
      phone: norm.normalized,
      inboundAt,
      messageId,
      messageType: buttonPayload ? "interactive_button" : listRowId ? "interactive_list" : "text",
    });

    const trimmed = String(text || "").trim();

    // 2. Instant Opt-Out Enforcement: halt all active Flowbot sessions & suppress contact
    if (OPT_OUT_RE.test(trimmed)) {
      await db.query(
        `UPDATE flowbot_sessions SET status = 'CANCELLED', completed_at = CURRENT_TIMESTAMP, last_error_code = 'OPTED_OUT'
         WHERE tenant_id = ? AND phone = ? AND status IN ('NEW','ACTIVE','WAITING_FOR_INPUT','WAITING_FOR_EVENT','WAITING_FOR_DELAY','EXECUTING')`,
        [tid, norm.normalized]
      );
      await consentService.revokeConsent(tid, {
        phone: norm.normalized,
        keyword: trimmed,
        reason: "Customer opted out via WhatsApp",
        source: "flowbot_inbound",
      }).catch(() => {});
      if (automationBridge && typeof automationBridge.cancelRunsForOptOut === "function") {
        await automationBridge.cancelRunsForOptOut(tid, norm.normalized).catch(() => {});
      }
      return { handled: true, opted_out: true, action: "stopped_flowbots_and_automations" };
    }

    // 3. Check existing active session for this phone
    const activeRow = await db.queryOne(
      `SELECT * FROM flowbot_sessions
       WHERE tenant_id = ? AND phone = ? AND is_test_mode = 0
         AND status IN ('NEW','ACTIVE','WAITING_FOR_INPUT','WAITING_FOR_EVENT','WAITING_FOR_DELAY','EXECUTING','HANDOVER_PENDING','HUMAN_OWNED')
       ORDER BY id DESC LIMIT 1`,
      [tid, norm.normalized]
    );

    if (activeRow) {
      const session = hydrateSession(activeRow);

      // Respect HUMAN_OWNED conversations: never interrupt human agents!
      if (session.status === "HUMAN_OWNED") {
        return { handled: false, human_owned: true, session_id: session.id };
      }

      // Clear & direct human escalation keyword honored at any step (Meta policy)
      if (HUMAN_REQ_RE.test(trimmed)) {
        const updated = await updateSession(session, {
          status: "HUMAN_OWNED",
          handover_summary: `Customer explicitly requested human escalation: "${trimmed}"`,
        });
        await db.query(
          `INSERT INTO flowbot_handover_events (tenant_id, workspace_id, session_id, conversation_id, contact_id, phone, routing_strategy, priority, escalation_channel, reason, context_summary, collected_answers_json, bot_paused, status)
           VALUES (?, ?, ?, ?, ?, ?, 'explicit_escalation', 'high', 'in_chat', 'Customer requested human agent', ?, ?, 1, 'OPEN')`,
          [tid, session.workspace_id, session.id, session.conversation_id, session.contact_id, session.phone, updated.handover_summary, JSON.stringify(session.collected_data || {})]
        );
        const ack = await sendBotMessage(updated, {
          message_type: "text",
          text: "I am transferring you to a human agent now. They will see your conversation context shortly.",
        });
        return { handled: true, escalated_to_human: true, session: updated, messages: [ack] };
      }

      if (session.status === "WAITING_FOR_EVENT" && isWhatsAppFlowCompletion) {
        session.collected_data = { ...(session.collected_data || {}), ...(flowResponseData || {}) };
        session.variables = { ...(session.variables || {}), ...(flowResponseData || {}) };
        const resumed = await updateSession(session, { status: "EXECUTING", resume_event: null });
        const out = await executeSessionLoop(resumed);
        return { handled: true, resumed_from_flow: true, ...out };
      }

      if (session.status === "WAITING_FOR_INPUT") {
        const out = await executeSessionLoop(session, {
          inboundInput: buttonPayload || listRowId || trimmed,
          inboundMeta: { buttonPayload, listRowId },
        });
        return { handled: true, continued: true, ...out };
      }

      return { handled: false, reason: `session_in_state_${session.status}`, session_id: session.id };
    }

    // 4. No active session -> resolve highest-priority matching trigger
    const trig = await resolveMatchingTrigger(tid, {
      text: trimmed,
      buttonPayload,
      listRowId,
      campaignId,
      senderId,
      isFirstMessage,
      isWhatsAppFlowCompletion,
    });
    if (!trig) {
      return { handled: false, reason: "no_matching_trigger" };
    }

    const started = await startSession(tid, {
      flowId: trig.flow_id,
      phone: norm.normalized,
      contactId,
      conversationId,
      senderId,
      wabaId,
      campaignId: campaignId || trig.campaign_id || null,
      workspaceId: workspaceId || trig.workspace_id || null,
      entryNodeKey: trig.entry_node_key || "start",
      initialVars: {
        last_input: buttonPayload || listRowId || trimmed,
        trigger_type: trig.trigger_type,
      },
    });
    return { handled: true, trigger_id: trig.id, ...started };
  }

  async function resumeBotFromHandover(tenantId, sessionId, { resumeNodeKey = null, actorId = null } = {}) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(`SELECT * FROM flowbot_sessions WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(sessionId)]);
    if (!row) throw httpError("Flowbot session not found", 404, "SESSION_NOT_FOUND");

    await db.query(
      `UPDATE flowbot_handover_events SET status = 'RESUMED', resumed_by = ?, resumed_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND session_id = ? AND status = 'OPEN'`,
      [actorId || null, tid, row.id]
    );
    const session = await updateSession(hydrateSession(row), {
      status: "EXECUTING",
      current_node_key: resumeNodeKey || row.current_node_key,
    });
    return executeSessionLoop(session);
  }

  async function resumeDueSessions(nowIso = new Date().toISOString()) {
    // 1. Resume WAITING_FOR_DELAY sessions whose timer elapsed
    const dueDelays = await db.query(
      `SELECT * FROM flowbot_sessions
       WHERE status = 'WAITING_FOR_DELAY' AND waiting_until IS NOT NULL AND waiting_until <= ?
       ORDER BY waiting_until ASC LIMIT 100`,
      [nowIso]
    );
    let resumedCount = 0;
    for (const r of dueDelays) {
      const s = await updateSession(hydrateSession(r), { status: "EXECUTING", waiting_until: null });
      await executeSessionLoop(s);
      resumedCount++;
    }

    // 2. Timeout expired WAITING_FOR_INPUT sessions
    const timedOut = await db.query(
      `SELECT * FROM flowbot_sessions
       WHERE status = 'WAITING_FOR_INPUT' AND waiting_until IS NOT NULL AND waiting_until <= ?
       ORDER BY waiting_until ASC LIMIT 100`,
      [nowIso]
    );
    let timedOutCount = 0;
    for (const r of timedOut) {
      const s = hydrateSession(r);
      if (s.timeout_node_key) {
        const nextS = await updateSession(s, {
          status: "EXECUTING",
          current_node_key: s.timeout_node_key,
          waiting_until: null,
          timeout_node_key: null,
        });
        await executeSessionLoop(nextS);
      } else {
        await updateSession(s, { status: "TIMED_OUT", waiting_until: null, completed_at: nowIso });
      }
      timedOutCount++;
    }

    return { resumed_delays: resumedCount, timed_out_sessions: timedOutCount };
  }

  async function simulateSession(tenantId, { flowId, messages = [], phone = "919999999999", initialVars = {} } = {}) {
    const tid = assertTenantId(tenantId);
    const startRes = await startSession(tid, {
      flowId,
      phone,
      initialVars,
      isTestMode: true,
    });
    if (!startRes.started) return startRes;

    let session = startRes.session;
    const transcript = [...(startRes.messages || [])];
    for (const msg of messages) {
      if (session.status !== "WAITING_FOR_INPUT") break;
      const stepOut = await executeSessionLoop(session, {
        inboundInput: typeof msg === "string" ? msg : (msg.buttonPayload || msg.listRowId || msg.text || ""),
        inboundMeta: typeof msg === "object" ? msg : {},
      });
      session = stepOut.session;
      transcript.push(...(stepOut.messages || []));
    }

    const steps = await db.query(
      `SELECT node_key, node_type, status, input_json, output_json, error_code, error_message, duration_ms, created_at
       FROM flowbot_execution_steps WHERE tenant_id = ? AND session_id = ? ORDER BY id ASC`,
      [tid, session.id]
    );

    return {
      is_test_mode: true,
      session,
      transcript,
      steps: steps.map((st) => ({
        ...st,
        input: safeJsonParse(st.input_json, null),
        output: safeJsonParse(st.output_json, null),
      })),
    };
  }

  // ── 6. Dashboard Monitoring & Masked Execution Inspector ───────────────────
  async function getDashboardOverview(tenantId) {
    const tid = assertTenantId(tenantId);
    const [activeFlows, sessionStats, handoverCount, perFlow] = await Promise.all([
      db.queryOne(`SELECT COUNT(*) AS cnt FROM wa_flows WHERE tenant_id = ? AND status = 'active'`, [tid]).catch(() => ({ cnt: 0 })),
      db.query(
        `SELECT status, COUNT(*) AS cnt FROM flowbot_sessions WHERE tenant_id = ? AND is_test_mode = 0 GROUP BY status`,
        [tid]
      ).catch(() => []),
      db.queryOne(`SELECT COUNT(*) AS cnt FROM flowbot_handover_events WHERE tenant_id = ?`, [tid]).catch(() => ({ cnt: 0 })),
      db.query(
        `SELECT f.id, f.name, f.status,
                COUNT(s.id) AS total_sessions,
                SUM(CASE WHEN s.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_sessions,
                SUM(CASE WHEN s.status = 'HUMAN_OWNED' THEN 1 ELSE 0 END) AS human_transfers,
                SUM(CASE WHEN s.status = 'TIMED_OUT' THEN 1 ELSE 0 END) AS timed_out_sessions,
                SUM(CASE WHEN s.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_sessions
         FROM wa_flows f
         LEFT JOIN flowbot_sessions s ON s.flow_id = f.id AND s.tenant_id = f.tenant_id AND s.is_test_mode = 0
         WHERE f.tenant_id = ?
         GROUP BY f.id, f.name, f.status
         ORDER BY f.id DESC LIMIT 100`,
        [tid]
      ).catch(() => []),
    ]);

    const byStatus = {};
    let total = 0;
    for (const r of sessionStats) {
      byStatus[r.status] = Number(r.cnt || 0);
      total += Number(r.cnt || 0);
    }
    const completed = byStatus.COMPLETED || 0;
    const completionRate = total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0;

    return {
      active_flowbots: Number(activeFlows?.cnt || 0),
      total_sessions: total,
      active_sessions: (byStatus.ACTIVE || 0) + (byStatus.EXECUTING || 0) + (byStatus.WAITING_FOR_INPUT || 0) + (byStatus.WAITING_FOR_DELAY || 0),
      waiting_for_input: byStatus.WAITING_FOR_INPUT || 0,
      completed_sessions: completed,
      failed_sessions: byStatus.FAILED || 0,
      timed_out_sessions: byStatus.TIMED_OUT || 0,
      handover_count: Number(handoverCount?.cnt || 0),
      completion_rate: completionRate,
      by_status: byStatus,
      flowbots: perFlow,
    };
  }

  async function listSessions(tenantId, { flowId = null, status = null, limit = 50 } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?"];
    const params = [tid];
    if (flowId) {
      clauses.push("flow_id = ?");
      params.push(Number(flowId));
    }
    if (status && status !== "ALL") {
      clauses.push("status = ?");
      params.push(String(status).toUpperCase());
    }
    params.push(Math.min(200, Number(limit) || 50));
    const rows = await db.query(
      `SELECT * FROM flowbot_sessions WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`,
      params
    );
    return rows.map((r) => ({
      ...hydrateSession(r),
      variables: maskSensitiveData(safeJsonParse(r.variables_json, {})),
      collected_data: maskSensitiveData(safeJsonParse(r.collected_data_json, {})),
    }));
  }

  async function getSessionTrace(tenantId, sessionId) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(`SELECT * FROM flowbot_sessions WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(sessionId)]);
    if (!row) throw httpError("Flowbot session not found", 404, "SESSION_NOT_FOUND");
    const steps = await db.query(
      `SELECT * FROM flowbot_execution_steps WHERE tenant_id = ? AND session_id = ? ORDER BY id ASC`,
      [tid, row.id]
    );
    const handovers = await db.query(
      `SELECT * FROM flowbot_handover_events WHERE tenant_id = ? AND session_id = ? ORDER BY id DESC`,
      [tid, row.id]
    );
    return {
      session: {
        ...hydrateSession(row),
        variables: maskSensitiveData(safeJsonParse(row.variables_json, {})),
        collected_data: maskSensitiveData(safeJsonParse(row.collected_data_json, {})),
      },
      steps: steps.map((s) => ({
        ...s,
        input: maskSensitiveData(safeJsonParse(s.input_json, null)),
        output: maskSensitiveData(safeJsonParse(s.output_json, null)),
      })),
      handovers,
    };
  }

  return {
    ACTIVE_SESSION_STATUSES,
    setAutomationBridge,
    validateFlowGraph,
    publishFlowVersion,
    rollbackFlowVersion,
    listFlowVersions,
    registerTrigger,
    resolveMatchingTrigger,
    startSession,
    handleInboundMessage,
    resumeBotFromHandover,
    resumeDueSessions,
    simulateSession,
    getDashboardOverview,
    listSessions,
    getSessionTrace,
  };
}

module.exports = { createFlowbotRuntimeService };
