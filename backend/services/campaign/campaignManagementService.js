"use strict";

/**
 * campaignManagementService.js
 *
 * Enterprise Campaign Lifecycle, Versioning, Sender Resolution, Cost Estimation,
 * Budget Enforcement, Validation, Preview, Duplication, and Agency Client Isolation.
 */

const {
  createDbHelper,
  assertTenantId,
  safeJsonParse,
  generateUid,
  httpError,
} = require("./dbHelper");
const { createProviderGateway } = require("./providerGateway");
const { createAudienceBuilderService } = require("./audienceBuilderService");
const { createTemplateManagementService, renderTemplateForRecipient } = require("./templateManagementService");
const { createCampaignApprovalService } = require("./campaignApprovalService");
const { createCampaignAuditService } = require("./campaignAuditService");
const { createBillingModeService } = require("../metaBillingModeService");
const { createPricingEngine } = require("../metaMessagePricingEngine");
const { createLimitEngine } = require("../metaMessagingLimitEngine");
const { createWalletService } = require("../watiWalletService");

const SUPPORTED_CAMPAIGN_TYPES = [
  "broadcast",
  "promotional",
  "product_launch",
  "seasonal",
  "customer_retention",
  "lead_nurturing",
  "customer_lifecycle",
  "abandoned_cart",
  "order_updates",
  "payment_reminders",
  "event_campaign",
  "appointment_reminders",
  "win_back",
  "recurring",
  "triggered",
  "ab_testing",
  "journey_based",
  "flow_based",
  "chatbot_campaign",
];

const CRITICAL_FIELDS = [
  "template_id",
  "template_name",
  "template_language",
  "category",
  "segment_id",
  "sender_id",
  "waba_id",
  "whatsapp_flow_id",
  "budget_limit_minor",
  "max_recipients",
  "provider_route",
];

function createCampaignManagementService(options = {}) {
  const db = createDbHelper(options.db);
  const gateway = options.gateway || createProviderGateway({ db: options.db });
  const audienceService = options.audienceService || createAudienceBuilderService({ db: options.db });
  const templateService = options.templateService || createTemplateManagementService({ db: options.db, gateway });
  const approvalService = options.approvalService || createCampaignApprovalService({ db: options.db });
  const audit = options.auditService || createCampaignAuditService({ db: options.db });
  const billingModeService = options.billingModeService || createBillingModeService({ db: options.db });
  const pricingEngine = options.pricingEngine || createPricingEngine({ db: options.db });
  const limitEngine = options.limitEngine || createLimitEngine({ db: options.db });
  const walletService = options.walletService || createWalletService({ db: options.db });

  async function assertAgencyClientAccess(tenantId, agencyClientId) {
    if (!agencyClientId) return null;
    const tid = assertTenantId(tenantId);
    const link = await db.queryOne(
      `SELECT * FROM campaign_agency_clients
       WHERE agency_tenant_id = ? AND client_tenant_id = ? AND status = 'active' LIMIT 1`,
      [tid, Number(agencyClientId)]
    );
    if (!link) {
      throw httpError("Agency is not authorized for this client tenant", 403, "AGENCY_CLIENT_UNAUTHORIZED");
    }
    return link;
  }

  async function listCampaigns(tenantId, filters = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["c.tenant_id = ?"];
    const params = [tid];

    if (filters.status && filters.status !== "ALL") {
      clauses.push("c.status = ?");
      params.push(String(filters.status).toUpperCase());
    }
    if (filters.campaign_type) {
      clauses.push("c.campaign_type = ?");
      params.push(filters.campaign_type);
    }
    if (filters.category) {
      clauses.push("c.category = ?");
      params.push(String(filters.category).toUpperCase());
    }
    if (filters.owner_id) {
      clauses.push("c.owner_id = ?");
      params.push(Number(filters.owner_id));
    }
    if (filters.workspace_id) {
      clauses.push("c.workspace_id = ?");
      params.push(Number(filters.workspace_id));
    }
    if (filters.agency_client_id) {
      clauses.push("c.agency_client_id = ?");
      params.push(Number(filters.agency_client_id));
    }
    if (filters.sender_id) {
      clauses.push("c.sender_id = ?");
      params.push(Number(filters.sender_id));
    }
    if (filters.waba_id) {
      clauses.push("c.waba_id = ?");
      params.push(filters.waba_id);
    }
    if (filters.objective) {
      clauses.push("c.objective = ?");
      params.push(filters.objective);
    }
    if (filters.date_from) {
      clauses.push("c.created_at >= ?");
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      clauses.push("c.created_at <= ?");
      params.push(filters.date_to);
    }
    if (filters.search) {
      clauses.push("(c.name LIKE ? OR c.description LIKE ? OR c.campaign_uid LIKE ?)");
      const like = `%${filters.search}%`;
      params.push(like, like, like);
    }

    const limit = Math.min(200, Number(filters.limit) || 50);
    const offset = Math.max(0, Number(filters.offset) || 0);
    params.push(limit, offset);

    const rows = await db.query(
      `SELECT c.*,
              s.name AS segment_name,
              t.meta_status AS template_meta_status,
              wf.name AS whatsapp_flow_name,
              wf.meta_status AS whatsapp_flow_status
       FROM campaigns c
       LEFT JOIN campaign_segments s ON s.id = c.segment_id AND s.tenant_id = c.tenant_id
       LEFT JOIN wa_templates t ON t.id = c.template_id AND t.tenant_id = c.tenant_id
       LEFT JOIN whatsapp_flows wf ON wf.id = c.whatsapp_flow_id AND wf.tenant_id = c.tenant_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY c.updated_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    return rows.map((r) => {
      const config = safeJsonParse(r.config_json, {});
      return {
        ...r,
        group_id: config.group_id || null,
        automation_id: config.automation_id || null,
        tags: safeJsonParse(r.tags_json, []),
        config,
      };
    });
  }

  async function getCampaign(tenantId, campaignId) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(
      `SELECT * FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(campaignId)]
    );
    if (!row) throw httpError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");

    const [senders, approvals, versions, bindings, flowbotBindings] = await Promise.all([
      db.query(`SELECT * FROM campaign_senders WHERE tenant_id = ? AND campaign_id = ? ORDER BY id ASC`, [tid, row.id]),
      db.query(`SELECT * FROM campaign_approvals WHERE tenant_id = ? AND campaign_id = ? ORDER BY campaign_version DESC, stage_index ASC`, [tid, row.id]),
      db.query(`SELECT id, version_number, change_summary, critical_change, frozen, created_by, created_at FROM campaign_versions WHERE tenant_id = ? AND campaign_id = ? ORDER BY version_number DESC LIMIT 20`, [tid, row.id]),
      db.query(`SELECT * FROM campaign_automation_bindings WHERE tenant_id = ? AND campaign_id = ? ORDER BY id ASC`, [tid, row.id]),
      db.query(`SELECT * FROM campaign_flowbot_bindings WHERE tenant_id = ? AND campaign_id = ? ORDER BY id ASC`, [tid, row.id]),
    ]);

    const config = safeJsonParse(row.config_json, {});
    return {
      ...row,
      group_id: config.group_id || null,
      automation_id: config.automation_id || null,
      tags: safeJsonParse(row.tags_json, []),
      config,
      senders,
      approvals,
      versions,
      automation_bindings: bindings,
      flowbot_bindings: flowbotBindings,
    };
  }

  async function createCampaign(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const name = String(input.name || "").trim();
    if (!name) throw httpError("Campaign name is required", 400, "CAMPAIGN_NAME_REQUIRED");

    if (input.agency_client_id) {
      await assertAgencyClientAccess(tid, input.agency_client_id);
    }

    const campaignUid = generateUid("cmp");
    const campaignType = SUPPORTED_CAMPAIGN_TYPES.includes(input.campaign_type)
      ? input.campaign_type
      : "broadcast";
    const category = String(input.category || "MARKETING").toUpperCase();
    const billingProfile = await billingModeService.getBillingProfile(tid).catch(() => ({
      billing_mode: "direct_meta",
      currency: "INR",
    }));

    const configObj = {
      group_id: input.group_id || input.config?.group_id || null,
      automation_id: input.automation_id || input.config?.automation_id || null,
      variable_mapping: input.variable_mapping || input.config?.variable_mapping || {},
      conditional_rules: input.conditional_rules || input.config?.conditional_rules || [],
      header_media_url: input.header_media_url || input.config?.header_media_url || null,
      tracked_urls: input.tracked_urls || input.config?.tracked_urls || [],
      missing_variable_policy: input.missing_variable_policy || input.config?.missing_variable_policy || "exclude",
      prefer_marketing_api: input.prefer_marketing_api ?? input.config?.prefer_marketing_api ?? true,
      allow_cloud_fallback: input.allow_cloud_fallback ?? input.config?.allow_cloud_fallback ?? true,
      sending: input.sending || input.config?.sending || { mode: "immediate", batch_size: 200, rate_limit_per_sec: 20 },
      audience_definition: input.audience_definition || input.config?.audience_definition || (input.group_id ? { group_id: Number(input.group_id) } : null),
      test_recipients: input.test_recipients || input.config?.test_recipients || [],
    };

    const res = await db.query(
      `INSERT INTO campaigns (
        campaign_uid, tenant_id, company_id, workspace_id, branch_id, agency_client_id,
        team_id, owner_id, scope, name, description, objective, campaign_type, category,
        priority, internal_reference, tags_json, status, current_version,
        provider_route, waba_id, sender_id, sender_mode, template_id, template_name,
        template_language, whatsapp_flow_id, flowbot_id, segment_id, reporting_timezone,
        start_date, end_date, scheduled_at, max_recipients, budget_limit_minor,
        currency, billing_mode, is_ab_test, is_recurring, is_test_mode,
        config_json, created_by, updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'DRAFT',1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        campaignUid,
        tid,
        input.company_id || tid,
        input.workspace_id || null,
        input.branch_id || null,
        input.agency_client_id || null,
        input.team_id || null,
        input.owner_id || actorId,
        input.scope || "workspace",
        name,
        input.description || null,
        input.objective || "product_promotion",
        campaignType,
        category,
        Number(input.priority || 5),
        input.internal_reference || null,
        JSON.stringify(Array.isArray(input.tags) ? input.tags : []),
        input.provider_route || "whatsapp_cloud_api",
        input.waba_id || null,
        input.sender_id || null,
        input.sender_mode || "single",
        input.template_id || null,
        input.template_name || null,
        input.template_language || "en",
        input.whatsapp_flow_id || null,
        input.flowbot_id || null,
        input.segment_id || null,
        input.reporting_timezone || "Asia/Kolkata",
        input.start_date || null,
        input.end_date || null,
        input.scheduled_at || null,
        input.max_recipients || null,
        input.budget_limit_minor || null,
        input.currency || billingProfile.currency || "INR",
        billingProfile.billing_mode || "direct_meta",
        input.is_ab_test ? 1 : 0,
        input.is_recurring ? 1 : 0,
        input.is_test_mode ? 1 : 0,
        JSON.stringify(configObj),
        actorId,
        actorId,
      ]
    );

    const campaignId = res.insertId;

    if (Array.isArray(input.senders) && input.senders.length > 0) {
      await setCampaignSenders(tid, campaignId, input.senders);
    } else if (input.sender_id) {
      await setCampaignSenders(tid, campaignId, [{ sender_id: input.sender_id, role: "primary", allocation_weight: 100 }]);
    }

    if (input.budget_limit_minor || input.max_recipients) {
      await db.query(
        `INSERT INTO campaign_budgets (tenant_id, workspace_id, campaign_id, scope, max_spend_minor, max_recipients, currency)
         VALUES (?, ?, ?, 'campaign', ?, ?, ?)`,
        [tid, input.workspace_id || null, campaignId, input.budget_limit_minor || null, input.max_recipients || null, input.currency || billingProfile.currency || "INR"]
      );
    }

    const created = await getCampaign(tid, campaignId);
    await db.query(
      `INSERT INTO campaign_versions (tenant_id, campaign_id, version_number, snapshot_json, change_summary, critical_change, created_by)
       VALUES (?, ?, 1, ?, 'Initial draft created', 0, ?)`,
      [tid, campaignId, JSON.stringify(created), actorId]
    );

    await audit.log(tid, {
      workspaceId: created.workspace_id,
      campaignId,
      entityType: "campaign",
      entityId: campaignId,
      action: "CREATE_CAMPAIGN",
      actorId,
      after: { name: created.name, campaign_uid: campaignUid, type: campaignType },
    });

    return created;
  }

  async function setCampaignSenders(tenantId, campaignId, senders = []) {
    const tid = assertTenantId(tenantId);
    await db.query(`DELETE FROM campaign_senders WHERE tenant_id = ? AND campaign_id = ?`, [tid, Number(campaignId)]);
    for (const s of senders) {
      const resolved = await gateway.resolveAuthorizedSender(tid, { senderId: s.sender_id, wabaId: s.waba_id });
      await db.query(
        `INSERT INTO campaign_senders (tenant_id, campaign_id, sender_id, waba_id, phone_number_id, role, allocation_weight, allocation_cap, routing_rule_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tid,
          Number(campaignId),
          resolved.sender_id,
          resolved.waba_id,
          resolved.phone_number_id,
          s.role || "primary",
          Number(s.allocation_weight || 100),
          s.allocation_cap || null,
          s.routing_rule ? JSON.stringify(s.routing_rule) : null,
        ]
      );
    }
  }

  async function updateCampaign(tenantId, campaignId, patch = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const current = await getCampaign(tid, campaignId);
    if (["RUNNING", "COMPLETED", "CANCELLED"].includes(current.status)) {
      throw httpError(`Cannot edit campaign in '${current.status}' state`, 409, "CAMPAIGN_LOCKED");
    }

    const criticalChanged = CRITICAL_FIELDS.some(
      (f) => patch[f] !== undefined && String(patch[f] ?? "") !== String(current[f] ?? "")
    );
    const nextVersion = Number(current.current_version || 1) + 1;
    const mergedConfig = { ...(current.config || {}), ...(patch.config || {}) };
    if (patch.group_id !== undefined) {
      mergedConfig.group_id = patch.group_id ? Number(patch.group_id) : null;
      if (mergedConfig.group_id) mergedConfig.audience_definition = { group_id: mergedConfig.group_id };
    }
    if (patch.automation_id !== undefined) mergedConfig.automation_id = patch.automation_id ? Number(patch.automation_id) : null;
    if (patch.variable_mapping) mergedConfig.variable_mapping = patch.variable_mapping;
    if (patch.audience_definition) mergedConfig.audience_definition = patch.audience_definition;
    if (patch.sending) mergedConfig.sending = patch.sending;
    if (patch.prefer_marketing_api !== undefined) mergedConfig.prefer_marketing_api = patch.prefer_marketing_api;
    if (patch.allow_cloud_fallback !== undefined) mergedConfig.allow_cloud_fallback = patch.allow_cloud_fallback;
    if (patch.missing_variable_policy) mergedConfig.missing_variable_policy = patch.missing_variable_policy;
    if (patch.header_media_url !== undefined) mergedConfig.header_media_url = patch.header_media_url;

    const updatable = {
      name: patch.name !== undefined ? String(patch.name).trim() : current.name,
      description: patch.description !== undefined ? patch.description : current.description,
      objective: patch.objective || current.objective,
      campaign_type: patch.campaign_type || current.campaign_type,
      category: patch.category ? String(patch.category).toUpperCase() : current.category,
      priority: patch.priority !== undefined ? Number(patch.priority) : current.priority,
      internal_reference: patch.internal_reference !== undefined ? patch.internal_reference : current.internal_reference,
      tags_json: patch.tags !== undefined ? JSON.stringify(patch.tags) : current.tags_json,
      waba_id: patch.waba_id !== undefined ? patch.waba_id : current.waba_id,
      sender_id: patch.sender_id !== undefined ? patch.sender_id : current.sender_id,
      sender_mode: patch.sender_mode || current.sender_mode,
      template_id: patch.template_id !== undefined ? patch.template_id : current.template_id,
      template_name: patch.template_name !== undefined ? patch.template_name : current.template_name,
      template_language: patch.template_language || current.template_language,
      whatsapp_flow_id: patch.whatsapp_flow_id !== undefined ? patch.whatsapp_flow_id : current.whatsapp_flow_id,
      flowbot_id: patch.flowbot_id !== undefined ? patch.flowbot_id : current.flowbot_id,
      segment_id: patch.segment_id !== undefined ? patch.segment_id : current.segment_id,
      reporting_timezone: patch.reporting_timezone || current.reporting_timezone,
      start_date: patch.start_date !== undefined ? patch.start_date : current.start_date,
      end_date: patch.end_date !== undefined ? patch.end_date : current.end_date,
      scheduled_at: patch.scheduled_at !== undefined ? patch.scheduled_at : current.scheduled_at,
      max_recipients: patch.max_recipients !== undefined ? patch.max_recipients : current.max_recipients,
      budget_limit_minor: patch.budget_limit_minor !== undefined ? patch.budget_limit_minor : current.budget_limit_minor,
      is_ab_test: patch.is_ab_test !== undefined ? (patch.is_ab_test ? 1 : 0) : current.is_ab_test,
      is_recurring: patch.is_recurring !== undefined ? (patch.is_recurring ? 1 : 0) : current.is_recurring,
      config_json: JSON.stringify(mergedConfig),
    };

    await db.query(
      `UPDATE campaigns SET
        name=?, description=?, objective=?, campaign_type=?, category=?, priority=?,
        internal_reference=?, tags_json=?, waba_id=?, sender_id=?, sender_mode=?,
        template_id=?, template_name=?, template_language=?, whatsapp_flow_id=?,
        flowbot_id=?, segment_id=?, reporting_timezone=?, start_date=?, end_date=?,
        scheduled_at=?, max_recipients=?, budget_limit_minor=?, is_ab_test=?,
        is_recurring=?, config_json=?, current_version=?, updated_by=?, updated_at=CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [
        updatable.name, updatable.description, updatable.objective, updatable.campaign_type,
        updatable.category, updatable.priority, updatable.internal_reference, updatable.tags_json,
        updatable.waba_id, updatable.sender_id, updatable.sender_mode, updatable.template_id,
        updatable.template_name, updatable.template_language, updatable.whatsapp_flow_id,
        updatable.flowbot_id, updatable.segment_id, updatable.reporting_timezone,
        updatable.start_date, updatable.end_date, updatable.scheduled_at,
        updatable.max_recipients, updatable.budget_limit_minor, updatable.is_ab_test,
        updatable.is_recurring, updatable.config_json, nextVersion, actorId, tid, current.id,
      ]
    );

    if (Array.isArray(patch.senders)) {
      await setCampaignSenders(tid, current.id, patch.senders);
    }

    if (criticalChanged && ["APPROVED", "PENDING_APPROVAL", "SCHEDULED"].includes(current.status)) {
      await approvalService.invalidateApproval(
        tid,
        current.id,
        `Critical campaign attributes changed in version ${nextVersion}`,
        actorId
      );
    }

    const updated = await getCampaign(tid, current.id);
    await db.query(
      `INSERT INTO campaign_versions (tenant_id, campaign_id, version_number, snapshot_json, change_summary, critical_change, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tid, current.id, nextVersion, JSON.stringify(updated), patch.change_summary || "Campaign updated", criticalChanged ? 1 : 0, actorId]
    );

    await audit.log(tid, {
      workspaceId: updated.workspace_id,
      campaignId: current.id,
      entityType: "campaign",
      entityId: current.id,
      action: "UPDATE_CAMPAIGN",
      actorId,
      metadata: { version: nextVersion, critical_change: criticalChanged },
    });

    return updated;
  }

  async function duplicateCampaign(tenantId, campaignId, actorId = null) {
    const src = await getCampaign(tenantId, campaignId);
    return createCampaign(
      tenantId,
      {
        name: `${src.name} (Copy)`,
        description: src.description,
        objective: src.objective,
        campaign_type: src.campaign_type,
        category: src.category,
        workspace_id: src.workspace_id,
        branch_id: src.branch_id,
        agency_client_id: src.agency_client_id,
        team_id: src.team_id,
        scope: src.scope,
        priority: src.priority,
        tags: src.tags,
        waba_id: src.waba_id,
        sender_id: src.sender_id,
        sender_mode: src.sender_mode,
        template_id: src.template_id,
        template_name: src.template_name,
        template_language: src.template_language,
        whatsapp_flow_id: src.whatsapp_flow_id,
        flowbot_id: src.flowbot_id,
        segment_id: src.segment_id,
        reporting_timezone: src.reporting_timezone,
        max_recipients: src.max_recipients,
        budget_limit_minor: src.budget_limit_minor,
        config: src.config,
      },
      actorId
    );
  }

  async function deleteDraftCampaign(tenantId, campaignId, actorId = null) {
    const tid = assertTenantId(tenantId);
    const camp = await getCampaign(tid, campaignId);
    if (camp.status !== "DRAFT") {
      throw httpError("Only DRAFT campaigns can be deleted; cancel active campaigns instead", 409, "DELETE_NON_DRAFT_FORBIDDEN");
    }
    await db.query(`DELETE FROM campaigns WHERE tenant_id = ? AND id = ?`, [tid, camp.id]);
    await audit.log(tid, { campaignId: camp.id, entityType: "campaign", entityId: camp.id, action: "DELETE_DRAFT", actorId });
    return { deleted: true, id: camp.id };
  }

  /**
   * Full Pre-Launch Validation, Cost Estimation & Sample Personalization Preview.
   */
  async function validateAndPreview(tenantId, campaignId, actorId = null) {
    const tid = assertTenantId(tenantId);
    const camp = await getCampaign(tid, campaignId);
    const blockers = [];
    const warnings = [];

    // 1. Sender & WABA check
    let sender = null;
    try {
      sender = await gateway.resolveAuthorizedSender(tid, {
        senderId: camp.sender_id,
        wabaId: camp.waba_id,
        branchId: camp.branch_id,
      });
    } catch (err) {
      blockers.push({ code: err.code || "SENDER_INVALID", message: err.message });
    }

    // 2. Template check
    let template = null;
    if (!camp.template_id) {
      blockers.push({ code: "TEMPLATE_REQUIRED", message: "An approved Meta WhatsApp template is required for campaigns" });
    } else {
      try {
        template = await templateService.assertTemplateEligibleForWaba(tid, camp.template_id, sender?.waba_id || camp.waba_id);
      } catch (err) {
        blockers.push({ code: err.code || "TEMPLATE_INVALID", message: err.message });
      }
    }

    // 3. Provider Route evaluation (Cloud API vs Marketing Messages API)
    let routeDecision = { route: "blocked", reason: "Sender unavailable", code: "SENDER_INVALID" };
    if (sender) {
      routeDecision = gateway.resolveRouteForTemplate(sender, {
        templateCategory: template?.category || camp.category,
        preferMarketingApi: camp.config?.prefer_marketing_api !== false,
        allowCloudFallback: camp.config?.allow_cloud_fallback !== false,
      });
      if (routeDecision.route === "blocked") {
        blockers.push({ code: `ROUTE_${routeDecision.code}`, message: routeDecision.reason });
      }
    }

    // 4. WhatsApp Flow check (if attached)
    if (camp.whatsapp_flow_id) {
      const wf = await db.queryOne(`SELECT * FROM whatsapp_flows WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, camp.whatsapp_flow_id]);
      if (!wf) blockers.push({ code: "FLOW_NOT_FOUND", message: "Attached WhatsApp Flow not found" });
      else if (wf.meta_status !== "PUBLISHED") {
        blockers.push({ code: "FLOW_NOT_PUBLISHED", message: `Attached WhatsApp Flow '${wf.name}' is ${wf.meta_status}; must be PUBLISHED` });
      }
    }

    // 5. Audience evaluation on backend (supports Saved Segment, Contact Group from /whatsapp/groups, or inline definition)
    let audienceDef = camp.config?.audience_definition || {};
    if (camp.segment_id) {
      try {
        const seg = await audienceService.getSegment(tid, camp.segment_id);
        audienceDef = seg.definition;
      } catch (err) {
        blockers.push({ code: "SEGMENT_NOT_FOUND", message: err.message });
      }
    } else if (camp.config?.group_id) {
      audienceDef = { group_id: Number(camp.config.group_id) };
    }
    const evaluation = await audienceService.evaluateAudience(tid, audienceDef, {
      category: template?.category || camp.category,
      workspaceId: camp.workspace_id,
      agencyClientId: camp.agency_client_id,
    });

    const effectiveEligible = camp.max_recipients
      ? evaluation.eligible.slice(0, Number(camp.max_recipients))
      : evaluation.eligible;

    if (effectiveEligible.length === 0) {
      blockers.push({ code: "NO_ELIGIBLE_RECIPIENTS", message: "Zero eligible recipients after consent, suppression, and phone validation" });
    }

    // 6. Personalization preview on sample recipients
    const variableMapping = camp.config?.variable_mapping || {};
    const missingPolicy = camp.config?.missing_variable_policy || "exclude";
    const samplePreviews = [];
    let personalizationFailures = 0;

    if (template) {
      for (const rec of effectiveEligible.slice(0, 10)) {
        const rendered = renderTemplateForRecipient(template, rec, variableMapping, {
          missingVariablePolicy: missingPolicy,
          headerMediaUrl: camp.config?.header_media_url || null,
        });
        if (!rendered.ok) personalizationFailures++;
        samplePreviews.push({
          contact_id: rec.contact_id,
          name: rec.name,
          phone: rec.normalized_phone,
          ok: rendered.ok,
          rendered_body: rendered.renderedBody || null,
          error: rendered.error || null,
        });
      }
    }

    // 7. Meta Shared Messaging Limit check (24h rolling business limit — never multiplied by sender count!)
    const messagingLimit = await limitEngine.getMessagingLimit(tid, sender?.waba_id || null).catch(() => ({
      tier: "TIER_250",
      max_daily_recipients: 250,
      used_daily_recipients: 0,
      remaining_daily_recipients: 250,
    }));

    if (effectiveEligible.length > messagingLimit.remaining_daily_recipients) {
      warnings.push({
        code: "EXCEEDS_META_ROLLING_LIMIT",
        message: `Eligible recipients (${effectiveEligible.length}) exceed current remaining 24h shared Meta business limit (${messagingLimit.remaining_daily_recipients} of ${messagingLimit.max_daily_recipients}). Dispatch will pace/pause safely at the limit.`,
      });
    }

    // 8. Cost Estimation & Dual Billing Readiness
    const billingProfile = await billingModeService.getBillingProfile(tid).catch(() => ({
      billing_mode: "direct_meta",
      currency: "INR",
      meta_payment_method_status: "not_configured",
      is_direct_meta: true,
      is_provider_managed: false,
    }));

    const catLower = String(template?.category || camp.category || "marketing").toLowerCase();
    let totalEstimatedMinor = 0;
    const rateBreakdown = {};
    for (const rec of effectiveEligible) {
      const cc = rec.country_code || "IN";
      if (!rateBreakdown[cc]) {
        const rc = await pricingEngine.getRateCard(cc, catLower).catch(() => ({ rate_minor: 78, currency: "INR", version: 1 }));
        rateBreakdown[cc] = { country_code: cc, rate_minor: Number(rc.rate_minor || 0), count: 0, subtotal_minor: 0, pricing_version: rc.version || 1 };
      }
      rateBreakdown[cc].count++;
      rateBreakdown[cc].subtotal_minor += rateBreakdown[cc].rate_minor;
      totalEstimatedMinor += rateBreakdown[cc].rate_minor;
    }

    if (camp.budget_limit_minor && totalEstimatedMinor > Number(camp.budget_limit_minor)) {
      blockers.push({
        code: "BUDGET_EXCEEDED",
        message: `Estimated cost (${totalEstimatedMinor} minor units) exceeds campaign budget (${camp.budget_limit_minor})`,
      });
    }

    let walletCheck = null;
    if (billingProfile.billing_mode === "provider_managed") {
      const wallet = await walletService.getWalletBalances(tid).catch(() => null);
      const avail = Number(wallet?.buckets?.whatsapp_messaging?.available_minor || 0);
      walletCheck = { available_minor: avail, required_minor: totalEstimatedMinor, sufficient: avail >= totalEstimatedMinor };
      if (avail < totalEstimatedMinor) {
        blockers.push({
          code: "INSUFFICIENT_WALLET_BALANCE",
          message: `Provider-managed wallet balance (${avail}) is below estimated campaign charge (${totalEstimatedMinor})`,
        });
      }
    } else if (billingProfile.meta_payment_method_status === "missing" || billingProfile.meta_payment_method_status === "expired") {
      blockers.push({
        code: "META_BILLING_NOT_READY",
        message: `Direct Meta payment method status is '${billingProfile.meta_payment_method_status}'`,
      });
    }

    // 9. Approval requirement check
    const approvalReq = await approvalService.evaluateRequiredStages(tid, {
      ...camp,
      total_eligible: effectiveEligible.length,
      estimated_cost_minor: totalEstimatedMinor,
    });

    // Persist computed estimates & route on campaign
    await db.query(
      `UPDATE campaigns
       SET total_matched = ?, total_eligible = ?, total_excluded = ?,
           estimated_cost_minor = ?, provider_route = ?, provider_route_status = ?,
           billing_mode = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [
        evaluation.stats.total_matched,
        effectiveEligible.length,
        evaluation.stats.total_matched - effectiveEligible.length,
        totalEstimatedMinor,
        routeDecision.route,
        routeDecision.code,
        billingProfile.billing_mode,
        tid,
        camp.id,
      ]
    );

    const valid = blockers.length === 0;
    await audit.recordPolicyDecision(tid, {
      campaignId: camp.id,
      policyName: "pre_launch_validation",
      outcome: valid ? "PASS" : "BLOCKED",
      details: { blockers, warnings, route: routeDecision.route, eligible: effectiveEligible.length },
      actorId,
    });

    const ratePerSec = Math.max(1, Number(camp.config?.sending?.rate_limit_per_sec || 20));
    const estimatedDurationSec = Math.ceil(effectiveEligible.length / ratePerSec);

    return {
      valid,
      blockers,
      warnings,
      campaign_id: camp.id,
      campaign_version: camp.current_version,
      provider_route: routeDecision,
      sender: sender
        ? {
            sender_id: sender.sender_id,
            waba_id: sender.waba_id,
            phone_number_id: sender.phone_number_id,
            display_phone: sender.display_phone,
            quality: sender.quality,
            messaging_tier: sender.messaging_tier,
            marketing_messages_lite_api_status: sender.marketing_messages_lite_api_status,
            marketing_messages_onboarding_status: sender.marketing_messages_onboarding_status,
          }
        : null,
      template: template ? { id: template.id, name: template.name, category: template.category, language: template.language, meta_status: template.meta_status } : null,
      audience: evaluation.stats,
      effective_eligible_count: effectiveEligible.length,
      sample_previews: samplePreviews,
      personalization_failures: personalizationFailures,
      messaging_limit: messagingLimit,
      billing: {
        billing_mode: billingProfile.billing_mode,
        currency: billingProfile.currency,
        estimated_cost_minor: totalEstimatedMinor,
        rate_breakdown: Object.values(rateBreakdown),
        wallet: walletCheck,
        meta_payment_method_status: billingProfile.meta_payment_method_status,
        disclaimer:
          billingProfile.billing_mode === "direct_meta"
            ? "Estimated Meta WhatsApp charge billed directly by Meta; final invoice is determined by Meta."
            : "Estimated provider-managed charge; only confirmed delivered billable messages are settled.",
      },
      estimated_duration_seconds: estimatedDurationSec,
      approval: approvalReq,
    };
  }

  /**
   * Agency Client management
   */
  async function linkAgencyClient(agencyTenantId, input = {}, actorId = null) {
    const aid = assertTenantId(agencyTenantId);
    const clientTenantId = assertTenantId(input.client_tenant_id);
    if (aid === clientTenantId) throw httpError("Agency tenant and client tenant must differ", 400);
    await db.query(
      `INSERT INTO campaign_agency_clients (
        agency_tenant_id, client_tenant_id, client_name, brand_logo_url,
        brand_primary_color, brand_domain, status, permissions_json, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        aid,
        clientTenantId,
        String(input.client_name || `Client ${clientTenantId}`),
        input.brand_logo_url || null,
        input.brand_primary_color || null,
        input.brand_domain || null,
        JSON.stringify(input.permissions || ["campaigns:*"]),
        actorId,
      ]
    );
    return db.queryOne(
      `SELECT * FROM campaign_agency_clients WHERE agency_tenant_id = ? AND client_tenant_id = ?`,
      [aid, clientTenantId]
    );
  }

  async function listAgencyClients(agencyTenantId) {
    const aid = assertTenantId(agencyTenantId);
    return db.query(`SELECT * FROM campaign_agency_clients WHERE agency_tenant_id = ? AND status = 'active' ORDER BY client_name ASC`, [aid]);
  }

  return {
    SUPPORTED_CAMPAIGN_TYPES,
    listCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    duplicateCampaign,
    deleteDraftCampaign,
    setCampaignSenders,
    validateAndPreview,
    linkAgencyClient,
    listAgencyClients,
    assertAgencyClientAccess,
  };
}

module.exports = { createCampaignManagementService, SUPPORTED_CAMPAIGN_TYPES };
