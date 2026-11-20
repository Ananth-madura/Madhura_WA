"use strict";

/**
 * aiAgentService.js
 *
 * Authorized AI Agent & Tenant-Scoped Knowledge Base Service.
 *
 * Security & Policy Invariants:
 *   - AI nodes can NEVER execute forbidden financial, permission, consent,
 *     opt-out, or deletion actions (`FORBIDDEN_AI_ACTIONS`).
 *   - Knowledge base retrieval is strictly scoped to `tenant_id` (and optional
 *     `workspace_id`) and returns source citations for auditing.
 *   - Supports real configured LLM providers when credentials exist, and
 *     deterministic structured extraction / intent / sentiment / lead scoring /
 *     KB matching when operating offline or without external API keys.
 *   - Enforces confidence thresholds and returns structured fallback / handover
 *     signals instead of fabricating certainty.
 */

const { createDbHelper, assertTenantId, safeJsonParse, httpError } = require("../campaign/dbHelper");
const { interpolateText } = require("./conditionEvaluator");

const FORBIDDEN_AI_ACTIONS = new Set([
  "change_wallet_balance",
  "credit_wallet",
  "debit_wallet",
  "change_permissions",
  "approve_payment",
  "issue_refund",
  "delete_customer",
  "delete_contact",
  "bypass_opt_out",
  "change_consent",
  "send_prohibited_message",
]);

function assertAiToolsAllowed(allowedTools = []) {
  for (const tool of allowedTools) {
    const normalized = String(tool || "").toLowerCase().trim();
    if (FORBIDDEN_AI_ACTIONS.has(normalized)) {
      throw httpError(
        `AI policy violation: tool '${normalized}' is permanently forbidden for AI nodes`,
        403,
        "AI_FORBIDDEN_ACTION"
      );
    }
  }
}

function createAiAgentService(options = {}) {
  const db = createDbHelper(options.db);
  const llmClient = options.llmClient || null;

  async function upsertKnowledgeArticle(tenantId, data = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const title = String(data.title || "").trim();
    const content = String(data.content || "").trim();
    if (!title || !content) throw httpError("Knowledge article title and content are required", 400, "KB_INVALID");

    const res = await db.query(
      `INSERT INTO ai_knowledge_articles (tenant_id, workspace_id, category, title, content, tags_json, source_url, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        tid,
        data.workspace_id || null,
        data.category || "faq",
        title,
        content,
        JSON.stringify(Array.isArray(data.tags) ? data.tags : []),
        data.source_url || null,
        actorId || null,
      ]
    );
    return { id: res.insertId, tenant_id: tid, title, category: data.category || "faq" };
  }

  async function listKnowledgeArticles(tenantId, { workspaceId = null, category = null } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?", "is_active = 1"];
    const params = [tid];
    if (workspaceId) {
      clauses.push("(workspace_id = ? OR workspace_id IS NULL)");
      params.push(Number(workspaceId));
    }
    if (category) {
      clauses.push("category = ?");
      params.push(String(category));
    }
    const rows = await db.query(
      `SELECT id, tenant_id, workspace_id, category, title, content, tags_json, source_url, created_at
       FROM ai_knowledge_articles WHERE ${clauses.join(" AND ")} ORDER BY id DESC LIMIT 200`,
      params
    );
    return rows.map((r) => ({ ...r, tags: safeJsonParse(r.tags_json, []) }));
  }

  async function searchKnowledgeBase(tenantId, queryText, { workspaceId = null, limit = 3 } = {}) {
    const tid = assertTenantId(tenantId);
    const articles = await listKnowledgeArticles(tid, { workspaceId });
    const terms = String(queryText || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    if (terms.length === 0 || articles.length === 0) return [];

    const scored = articles
      .map((a) => {
        const hay = `${a.title} ${a.content} ${(a.tags || []).join(" ")}`.toLowerCase();
        let hits = 0;
        for (const t of terms) {
          if (hay.includes(t)) hits++;
        }
        const score = hits / terms.length;
        return { ...a, relevance_score: Number(score.toFixed(3)) };
      })
      .filter((a) => a.relevance_score > 0)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit);

    return scored;
  }

  function deterministicAnalyze(action, text, context = {}, kbHits = []) {
    const raw = String(text || "");
    const lc = raw.toLowerCase();

    // Intent detection
    let intent = "general_enquiry";
    let confidence = 0.62;
    if (/(quote|quotation|price|pricing|cost|budget|proposal|demo|enterprise|buy|solar|plan)/i.test(lc)) {
      intent = "sales_enquiry";
      confidence = 0.88;
    } else if (/(order|track|shipping|delivery|dispatch|package|refund|damaged)/i.test(lc)) {
      intent = "order_support";
      confidence = 0.86;
    } else if (/(human|agent|representative|manager|call me|help desk|support)/i.test(lc)) {
      intent = "human_escalation";
      confidence = 0.94;
    } else if (/(invoice|payment|bill|due|paid|receipt|upi)/i.test(lc)) {
      intent = "billing_support";
      confidence = 0.87;
    } else if (/(complaint|angry|terrible|worst|bad|delay|broken|frustrated)/i.test(lc)) {
      intent = "complaint";
      confidence = 0.84;
    }

    // Sentiment classification
    let sentiment = "neutral";
    if (/(thank|great|awesome|love|good|interested|happy|excellent)/i.test(lc)) sentiment = "positive";
    if (/(angry|bad|worst|delay|broken|refund|cancel|terrible|frustrated|unhappy)/i.test(lc)) sentiment = "negative";

    // Entity extraction
    const budgetMatch = raw.match(/(?:₹|rs\.?|inr|\$)?\s*(\d[\d,]{2,})/i);
    const emailMatch = raw.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/);
    const entities = {
      budget: budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : (context.flow?.budget || null),
      email: emailMatch ? emailMatch[0].toLowerCase() : (context.customer?.email || null),
      location: context.flow?.location || null,
      product: context.flow?.product || context.flow?.product_interest || null,
    };

    // Lead scoring (0..100)
    let leadScore = 30;
    if (intent === "sales_enquiry") leadScore += 25;
    if (entities.budget && Number(entities.budget) >= 50000) leadScore += 25;
    if (entities.budget && Number(entities.budget) >= 100000) leadScore += 10;
    if (entities.email) leadScore += 10;
    if (sentiment === "positive") leadScore += 5;
    leadScore = Math.min(100, leadScore);

    // Summary & KB answer
    const kbAnswer = kbHits.length > 0 ? kbHits[0].content : null;
    const summaryParts = [
      `Customer: ${context.customer?.name || context.customer?.phone || "Unknown"}`,
      `Intent: ${intent} (${sentiment})`,
    ];
    if (entities.product) summaryParts.push(`Product: ${entities.product}`);
    if (entities.budget) summaryParts.push(`Budget: ${entities.budget}`);
    if (entities.location) summaryParts.push(`Location: ${entities.location}`);

    const result = {
      intent,
      sentiment,
      language: /[\u0900-\u097F]/.test(raw) ? "hi" : /[\u0B80-\u0BFF]/.test(raw) ? "ta" : "en",
      entities,
      lead_score: leadScore,
      qualification_tier: leadScore >= 75 ? "hot" : leadScore >= 50 ? "warm" : "cold",
      summary: summaryParts.join(" | "),
      next_step:
        intent === "human_escalation" || intent === "complaint"
          ? "handover_to_human"
          : leadScore >= 75
          ? "assign_enterprise_sales"
          : "send_product_info",
      draft_reply:
        kbAnswer ||
        (intent === "sales_enquiry"
          ? `Thank you for sharing your requirements. Our sales team has noted your interest${entities.product ? ` in ${entities.product}` : ""} and will assist you shortly.`
          : "Thank you for reaching out. How can we assist you further?"),
      confidence: kbHits.length > 0 ? Math.max(confidence, Math.min(0.95, 0.65 + kbHits[0].relevance_score * 0.3)) : confidence,
      sources: kbHits.map((k) => ({ id: k.id, title: k.title, category: k.category, score: k.relevance_score })),
      provider_mode: "deterministic_engine",
    };

    if (action === "kb_response" && kbHits.length === 0) {
      result.confidence = 0.25;
      result.draft_reply = null;
    }

    return result;
  }

  async function executeAiNode(tenantId, nodeConfig = {}, context = {}) {
    const tid = assertTenantId(tenantId);
    assertAiToolsAllowed(nodeConfig.allowed_tools || []);

    if (nodeConfig.action_requested && FORBIDDEN_AI_ACTIONS.has(String(nodeConfig.action_requested).toLowerCase())) {
      throw httpError(
        `AI policy violation: action '${nodeConfig.action_requested}' cannot be executed by AI`,
        403,
        "AI_FORBIDDEN_ACTION"
      );
    }

    const action = String(nodeConfig.ai_action || nodeConfig.action || "intent_detection").toLowerCase();
    const userPrompt = interpolateText(
      nodeConfig.user_prompt || nodeConfig.prompt || "{{flow.last_input}}",
      context
    );
    const confidenceThreshold = Number(nodeConfig.confidence_threshold ?? 0.6);

    const kbHits = nodeConfig.use_knowledge_base || action === "kb_response" || action === "product_recommendation"
      ? await searchKnowledgeBase(tid, userPrompt, { workspaceId: context.system?.workspace_id || null, limit: 3 })
      : [];

    let output;
    if (llmClient && typeof llmClient.complete === "function") {
      output = await llmClient.complete({
        tenantId: tid,
        provider: nodeConfig.model_provider || "configured",
        model: nodeConfig.model || "default",
        systemInstructions: nodeConfig.system_instructions || "",
        userPrompt,
        maxTokens: Math.min(2000, Number(nodeConfig.max_tokens || 500)),
        temperature: Number(nodeConfig.temperature ?? 0.2),
        kbContext: kbHits,
      });
    } else {
      output = deterministicAnalyze(action, userPrompt, context, kbHits);
    }

    const belowThreshold = Number(output.confidence || 0) < confidenceThreshold;
    return {
      ok: true,
      action,
      ...output,
      confidence_threshold: confidenceThreshold,
      below_threshold: belowThreshold,
      requires_human_approval: Boolean(nodeConfig.require_human_approval),
      recommended_fallback: belowThreshold
        ? (nodeConfig.fallback_action || "human_handover")
        : null,
      fallback_message: belowThreshold
        ? (nodeConfig.fallback_message || "Let me connect you with a specialist who can help directly.")
        : null,
    };
  }

  return {
    FORBIDDEN_AI_ACTIONS,
    assertAiToolsAllowed,
    upsertKnowledgeArticle,
    listKnowledgeArticles,
    searchKnowledgeBase,
    executeAiNode,
  };
}

module.exports = { createAiAgentService, FORBIDDEN_AI_ACTIONS };
