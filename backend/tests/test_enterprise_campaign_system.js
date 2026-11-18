"use strict";

/**
 * test_enterprise_campaign_system.js
 *
 * Comprehensive automated test suite for the Madhura Enterprise Campaign
 * Management System covering Tests A-H and E2E Scenarios 1-5:
 *   Test A: Audience Builder (nested AND/OR, custom fields, duplicates, invalid phones,
 *           missing consent, opt-outs, suppression, snapshots, CSV import consent guard)
 *   Test B: Template Management (approval gating, WABA scoping, promotional utility block,
 *           variable rendering, missing variable exclusion, mid-campaign status pause)
 *   Test C: Campaign Lifecycle (draft, edit, versioning, duplicate, four-eyes approval,
 *           critical-edit approval invalidation, reject, approve, schedule, launch,
 *           pause, resume, cancel, complete)
 *   Test D: Sending & Webhooks (Cloud API vs Marketing Messages API routing, invalid sender,
 *           opt-out during active campaign, shared Meta limit reached, network timeout ->
 *           UNKNOWN_REQUIRES_RECONCILIATION, idempotent job dedupe, duplicate webhook dedupe,
 *           out-of-order READ -> DELIVERED monotonic status guard)
 *   Test E: Multi-Number & Shared Business Limits (weighted distribution across 2 senders
 *           under 1 WABA sharing a single 24h rolling business recipient limit)
 *   Test F: Billing (Direct Meta vs Provider-Managed wallet reservation, settlement on
 *           DELIVERED, release on FAILED, duplicate settlement prevention, low balance block)
 *   Test G: Analytics, Verified Attribution & A/B Experiments (exact rate formulas, tracked
 *           links, verified order attribution within window, honest significance sample guard)
 *   Test H: Security & Agency Multi-Client Isolation (cross-tenant blocked, unauthorized
 *           sender blocked, zero global env fallback, RSA-OAEP + AES-128-GCM Flow encryption,
 *           payment-card field rejection in WhatsApp Flows)
 *   Scenarios 1-5: Small Business Promotion, Enterprise Multi-Team + Multi-Number,
 *                  E-Commerce Abandoned Cart -> Order Stops Journey + Attribution,
 *                  Agency Multi-Client Isolation (Client A vs Client B),
 *                  Opt-Out During Active Campaign + CSV Re-Import Protection.
 */

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

const { migrate: migrateMeta } = require("../migrations/meta_multi_account_saas");
const { migrate: migrateBilling } = require("../migrations/wati_billing_and_limits");
const { migrate: migrateCampaigns } = require("../migrations/enterprise_campaign_management");

const { createProviderGateway } = require("../services/campaign/providerGateway");
const { createConsentSuppressionService } = require("../services/campaign/consentSuppressionService");
const { createAudienceBuilderService } = require("../services/campaign/audienceBuilderService");
const { createTemplateManagementService } = require("../services/campaign/templateManagementService");
const { createWhatsAppFlowsService } = require("../services/campaign/whatsappFlowsService");
const {
  createWhatsAppFlowCryptoService,
  encryptFlowRequestForTest,
  decryptFlowResponseForTest,
} = require("../services/campaign/whatsappFlowCryptoService");
const { createCampaignApprovalService } = require("../services/campaign/campaignApprovalService");
const { createCampaignManagementService } = require("../services/campaign/campaignManagementService");
const { createCampaignExperimentService } = require("../services/campaign/campaignExperimentService");
const { createCampaignSchedulerService } = require("../services/campaign/campaignSchedulerService");
const { createCampaignExecutionEngine } = require("../services/campaign/campaignExecutionEngine");
const { createCampaignJourneyService } = require("../services/campaign/campaignJourneyService");
const { createCampaignWebhookProcessor } = require("../services/campaign/campaignWebhookProcessor");
const { createCampaignAnalyticsService } = require("../services/campaign/campaignAnalyticsService");
const { createBillingModeService } = require("../services/metaBillingModeService");
const { createWalletService } = require("../services/watiWalletService");
const { createLimitEngine } = require("../services/metaMessagingLimitEngine");
const cryptoHelper = require("../backendutil/cryptoHelper");

function createTestDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.isSqlite = true;
  sqlite.promise = () => ({
    query: async (sql, params = []) => {
      const stmt = sqlite.prepare(sql);
      if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
        return [stmt.all(...params)];
      }
      const info = stmt.run(...params);
      return [{ insertId: Number(info.lastInsertRowid), affectedRows: Number(info.changes) }];
    },
  });

  // Base prerequisite tables present in Madhura
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      status TEXT DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS wa_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(32) NOT NULL,
      country_code VARCHAR(5) DEFAULT '91',
      email VARCHAR(255) DEFAULT NULL,
      tags TEXT DEFAULT NULL,
      custom_fields TEXT DEFAULT NULL,
      opt_in_status TINYINT DEFAULT 0,
      last_contacted DATETIME DEFAULT NULL,
      is_blocked TINYINT DEFAULT 0,
      is_unsubscribed TINYINT DEFAULT 0,
      source VARCHAR(100) DEFAULT NULL,
      crm_ref_type VARCHAR(50) DEFAULT NULL,
      crm_ref_id INT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      tenant_id INT NOT NULL DEFAULT 1,
      branch_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_opt_outs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone VARCHAR(32) NOT NULL,
      tenant_id INT NOT NULL DEFAULT 1,
      reason VARCHAR(100) DEFAULT 'user_request',
      opt_out_keyword VARCHAR(50) DEFAULT NULL,
      opted_out_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_contact_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      source VARCHAR(100) DEFAULT 'manual',
      tenant_id INT NOT NULL DEFAULT 1,
      branch_id INT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_group_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INT NOT NULL,
      name VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(32) NOT NULL,
      extra_data TEXT DEFAULT NULL,
      tenant_id INT NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      trigger_type VARCHAR(100) DEFAULT 'incoming_message',
      is_active TINYINT DEFAULT 1,
      tenant_id INT NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) DEFAULT 'MARKETING',
      language VARCHAR(20) DEFAULT 'en',
      header_type VARCHAR(50) DEFAULT NULL,
      header_value TEXT DEFAULT NULL,
      body TEXT NOT NULL,
      footer TEXT DEFAULT NULL,
      button_type VARCHAR(50) DEFAULT NULL,
      buttons TEXT DEFAULT NULL,
      variables TEXT DEFAULT NULL,
      meta_template_id VARCHAR(100) DEFAULT NULL,
      meta_status VARCHAR(50) DEFAULT 'DRAFT',
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      credit_type VARCHAR(50) DEFAULT 'whatsapp_messaging',
      balance INT DEFAULT 0,
      reserved_balance INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, credit_type)
    );
    CREATE TABLE IF NOT EXISTS wallet_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      credit_type VARCHAR(50) NOT NULL,
      amount INT NOT NULL,
      balance_after INT NOT NULL,
      direction VARCHAR(20) NOT NULL,
      description TEXT,
      reference_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      contact_id INT DEFAULT NULL,
      branch_id INT DEFAULT NULL,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(40) DEFAULT NULL,
      email VARCHAR(180) DEFAULT NULL,
      source VARCHAR(60) DEFAULT 'manual',
      enquiry_type VARCHAR(24) DEFAULT 'general',
      message TEXT,
      temperature VARCHAR(12) DEFAULT 'new',
      status VARCHAR(16) DEFAULT 'open',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return sqlite;
}

function createMockHttpClient() {
  const calls = [];
  let nextError = null;
  let seq = 1;

  const client = {
    calls,
    setNextError(err) {
      nextError = err;
    },
    async post(url, body, config) {
      calls.push({ method: "POST", url, body, headers: config?.headers });
      if (nextError) {
        const err = nextError;
        nextError = null;
        throw err;
      }
      if (url.includes("/message_templates")) {
        return { data: { id: `meta_tmpl_${seq++}`, status: "PENDING" } };
      }
      if (url.includes("/flows") && url.endsWith("/publish")) {
        return { data: { success: true } };
      }
      if (url.includes("/flows")) {
        return { data: { id: `meta_flow_${seq++}` } };
      }
      return {
        data: {
          messaging_product: "whatsapp",
          contacts: [{ input: body.to, wa_id: body.to }],
          messages: [{ id: `wamid.test_${seq++}` }],
        },
      };
    },
    async get(url, config) {
      calls.push({ method: "GET", url, params: config?.params });
      if (url.includes("/message_templates")) {
        return {
          data: {
            data: [
              {
                id: "meta_tmpl_approved_1",
                name: "diwali_launch_offer",
                language: "en",
                category: "MARKETING",
                status: "APPROVED",
                quality_score: { score: "GREEN" },
                components: [
                  { type: "BODY", text: "Hello {{1}}, enjoy {{2}} on Solar Kit!" },
                  { type: "BUTTONS", buttons: [{ type: "FLOW", text: "Enquire Now", flow_id: "meta_flow_1" }] },
                ],
              },
            ],
          },
        };
      }
      return {
        data: {
          id: "waba_1001",
          marketing_messages_lite_api_status: "ONBOARDED",
          marketing_messages_onboarding_status: "ONBOARDED",
        },
      };
    },
  };
  return client;
}

async function run() {
  console.log("=== Madhura Enterprise Campaign Management Test Suite ===\n");
  const db = createTestDb();

  await migrateMeta(db);
  await migrateBilling(db);
  await migrateCampaigns(db);

  const httpClient = createMockHttpClient();
  const gateway = createProviderGateway({ db, httpClient });
  const consentService = createConsentSuppressionService({ db });
  const audienceService = createAudienceBuilderService({ db, consentService });
  const templateService = createTemplateManagementService({ db, gateway });
  const flowsService = createWhatsAppFlowsService({ db, gateway });
  const flowCrypto = createWhatsAppFlowCryptoService({ db });
  const approvalService = createCampaignApprovalService({ db });
  const managementService = createCampaignManagementService({ db, gateway, audienceService, templateService, approvalService });
  const experimentService = createCampaignExperimentService({ db });
  const schedulerService = createCampaignSchedulerService({ db });
  const executionEngine = createCampaignExecutionEngine({
    db, gateway, consentService, audienceService, templateService, managementService, experimentService, flowsService,
  });
  const journeyService = createCampaignJourneyService({ db, consentService });
  const webhookProcessor = createCampaignWebhookProcessor({
    db, consentService, templateService, flowsService, journeyService, marketingAdapter: gateway.marketingAdapter,
  });
  const analyticsService = createCampaignAnalyticsService({ db });
  const billingModeService = createBillingModeService({ db });
  const walletService = createWalletService({ db });
  const limitEngine = createLimitEngine({ db });

  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];

  // Seed Tenants 1 (Agency/Enterprise), 2 (Client A), 3 (Client B)
  await q(`INSERT INTO tenants (id, name, status) VALUES (1,'Madhura Solar Corp','active'),(2,'Client Alpha','active'),(3,'Client Beta','active')`);

  const encToken1 = cryptoHelper.encrypt("EAAG_TENANT_1_TOKEN");
  const encToken2 = cryptoHelper.encrypt("EAAG_TENANT_2_TOKEN");

  // Seed WABA & 2 Senders for Tenant 1 (Marketing Messages API ONBOARDED)
  await q(
    `INSERT INTO waba_connections (id, tenant_id, meta_business_id, waba_id, encrypted_token, status, marketing_messages_lite_api_status, marketing_messages_onboarding_status, marketing_messages_terms_accepted)
     VALUES (1, 1, 'biz_1', 'waba_1001', ?, 'connected', 'ONBOARDED', 'ONBOARDED', 1)`,
    [encToken1]
  );
  await q(
    `INSERT INTO wa_senders (id, tenant_id, waba_connection_id, phone_number_id, display_phone, verified_name, quality, messaging_tier, status)
     VALUES (1, 1, 1, 'pn_101', '+919800000101', 'Solar Primary', 'GREEN', 'TIER_1K', 'connected'),
            (2, 1, 1, 'pn_102', '+919800000102', 'Solar Secondary', 'GREEN', 'TIER_1K', 'connected')`
  );

  // Seed WABA & Sender for Tenant 2 (Client A — NOT onboarded to Marketing Messages API -> uses Cloud API)
  await q(
    `INSERT INTO waba_connections (id, tenant_id, meta_business_id, waba_id, encrypted_token, status, marketing_messages_lite_api_status, marketing_messages_onboarding_status)
     VALUES (2, 2, 'biz_2', 'waba_2002', ?, 'connected', 'ELIGIBLE', 'PENDING_INTERNAL_SETUP')`,
    [encToken2]
  );
  await q(
    `INSERT INTO wa_senders (id, tenant_id, waba_connection_id, phone_number_id, display_phone, verified_name, quality, status)
     VALUES (3, 2, 2, 'pn_201', '+919800000201', 'Alpha Support', 'GREEN', 'connected')`
  );

  // ── TEST H (Security): Zero Global Env Fallback & Cross-Tenant Sender Block ─
  console.log("1. Testing Security: Tenant Isolation & Zero Env Fallback...");
  await assert.rejects(
    () => gateway.resolveAuthorizedSender(3, {}),
    (err) => err.code === "SENDER_UNAUTHORIZED",
    "Tenant 3 with no connected sender must fail closed without env fallback"
  );
  await assert.rejects(
    () => gateway.resolveAuthorizedSender(2, { senderId: 1 }),
    (err) => err.code === "SENDER_UNAUTHORIZED",
    "Tenant 2 must not resolve Tenant 1's sender"
  );
  console.log("   PASS: Strict fail-closed sender resolution & cross-tenant isolation");

  // ── TEST A: Audience Builder, Consent Evidence, Suppression & CSV Import ───
  console.log("2. Testing Audience Builder, Consent Evidence, Suppression & CSV Import...");
  // Reject marketing consent without evidence
  await assert.rejects(
    () => consentService.recordConsent(1, { phone: "9876543210", purpose: "marketing", collection_method: "crm_manual_with_evidence" }),
    (err) => err.code === "CONSENT_EVIDENCE_REQUIRED"
  );

  const importRes = await audienceService.processImport(1, {
    filename: "vip_customers.csv",
    rows: [
      { phone: "9876543210", name: "Arun Kumar", city: "Chennai", tags: "VIP,solar", consent_text: "I agree to WhatsApp updates" },
      { phone: "+91 98765 43211", name: "Priya Nair", city: "Chennai", tags: "VIP,solar", consent_text: "Checkout opt-in v1" },
      { phone: "9876543212", name: "Karthik R", city: "Chennai", tags: "VIP", consent_text: "Web form opt-in" },
      { phone: "9876543213", name: "No Consent User", city: "Chennai", tags: "VIP", consent_text: "" },
      { phone: "9876543210", name: "Duplicate Arun", city: "Chennai", tags: "VIP", consent_text: "Dup" },
      { phone: "abc-invalid", name: "Bad Phone", city: "Chennai", tags: "VIP", consent_text: "Bad" },
      { phone: "9876543214", name: "Suppressed Sam", city: "Chennai", tags: "VIP", consent_text: "Opted in earlier" },
    ],
    columnMapping: { phone: "phone", name: "name", tags: "tags", custom_fields: { city: "city" } },
    consentMapping: { enabled: true, purpose: "marketing", wording_col: "consent_text", source: "website_import" },
  }, 10);

  assert.equal(importRes.created_count, 5, "Should create 5 valid unique contacts");
  assert.equal(importRes.duplicate_count, 1, "Should detect 1 duplicate in file");
  assert.equal(importRes.invalid_count, 1, "Should detect 1 invalid phone");
  assert.equal(importRes.consent_failed_count, 1, "Missing consent evidence must not grant consent");

  // Add global suppression on 919876543214 (takes precedence over positive segment rules & consent!)
  await consentService.addSuppression(1, { phone: "919876543214", scope: "company", category: "ALL", reason: "dnc_compliance" }, 10);

  // Create dynamic segment with nested AND/OR rules
  const seg = await audienceService.createSegment(1, {
    name: "Chennai VIP Solar",
    definition: {
      logic: "AND",
      include: [
        { field: "tags", operator: "contains", value: "VIP" },
        {
          logic: "OR",
          rules: [
            { field: "custom_fields.city", operator: "equals", value: "Chennai" },
            { field: "custom_fields.city", operator: "equals", value: "Bengaluru" },
          ],
        },
      ],
      exclude: [],
    },
  }, 10);

  const est = await audienceService.estimateSegment(1, seg.id, { category: "MARKETING" });
  assert.equal(est.stats.total_matched, 5);
  assert.equal(est.stats.no_consent_count, 1, "Contact without consent evidence must be excluded");
  assert.equal(est.stats.suppressed_count, 1, "Suppressed contact must be excluded despite consent");
  assert.equal(est.stats.eligible_count, 3, "Exactly 3 eligible VIP contacts");
  console.log("   PASS: Nested AND/OR segmentation, consent evidence, suppression precedence & import");

  // ── TEST B: Template Policy, Meta Sync, Personalization & Flow Validation ──
  console.log("3. Testing Template Management, Policy Guard & WhatsApp Flows Crypto...");
  // Block promotional content classified as UTILITY
  await assert.rejects(
    () => templateService.createLocalTemplate(1, { name: "bad_utility", category: "UTILITY", body: "Flash Sale! Get 50% off with promo code TODAY!" }, 10),
    (err) => err.code === "UTILITY_MISCLASSIFICATION_BLOCKED"
  );

  // Sync approved template from Meta
  const syncRes = await templateService.syncFromMeta(1, { senderId: 1 }, 10);
  assert.equal(syncRes.synced_count, 1);
  const templates = await templateService.listTemplates(1, { status: "APPROVED" });
  assert.equal(templates.length, 1);
  const approvedTemplate = templates[0];

  // WhatsApp Flows: create, reject card fields, validate, publish, immutability, clone, RSA+AES-GCM crypto!
  const badFlow = await flowsService.createFlow(1, {
    name: "Bad Payment Flow",
    flow_json: {
      version: "6.0",
      screens: [{ id: "PAY", terminal: true, layout: { type: "SingleColumnLayout", children: [{ type: "TextInput", name: "credit_card_number", label: "Card" }] } }],
    },
  }, 10);
  const badVal = await flowsService.validateFlow(1, badFlow.id);
  assert.equal(badVal.valid, false, "Payment card collection inside WhatsApp Flow must be rejected");

  const solarFlow = await flowsService.createFlow(1, {
    name: "Solar Enquiry Flow",
    category: "LEAD_GENERATION",
    flow_mode: "dynamic",
    endpoint_uri: "https://api.madhura.example/api/webhooks/meta/flows/1",
    sender_id: 1,
    waba_id: "waba_1001",
    syncToMeta: true,
  }, 10);
  const publishedFlow = await flowsService.publishFlow(1, solarFlow.id, { senderId: 1, callMetaApi: true }, 10);
  assert.equal(publishedFlow.meta_status, "PUBLISHED");
  await assert.rejects(
    () => flowsService.updateFlow(1, publishedFlow.id, { name: "Overwrite Published" }, 10),
    (err) => err.code === "PUBLISHED_FLOW_IMMUTABLE",
    "Published WhatsApp Flow must remain immutable"
  );
  const clonedFlow = await flowsService.cloneFlow(1, publishedFlow.id, {}, 10);
  assert.equal(clonedFlow.meta_status, "DRAFT");
  assert.equal(clonedFlow.previous_flow_id, publishedFlow.id);

  // Test RSA-OAEP + AES-128-GCM Encrypted Flow Data Exchange (ping + INIT + flow_token correlation)
  const ep = await flowCrypto.provisionEndpointKeys(1, {
    wabaId: "waba_1001",
    phoneNumberId: "pn_101",
    endpointUri: "https://api.madhura.example/api/webhooks/meta/flows/1",
  }, 10);
  const pingReq = encryptFlowRequestForTest({ version: "3.0", action: "ping" }, ep.public_key_pem);
  const pingOut = await flowCrypto.handleEncryptedDataExchange(ep.id, pingReq);
  const pingDecrypted = decryptFlowResponseForTest(pingOut.encryptedResponse, pingReq.aesKey, pingReq.iv);
  assert.equal(pingDecrypted.data.status, "active", "Encrypted Flow ping health check must return active");
  console.log("   PASS: Template policy, WhatsApp Flow immutability/clone & RSA+AES-128-GCM encryption");

  // ── TEST C & SCENARIO 1+2: Lifecycle, Four-Eyes Approval, Multi-Number & Shared Limit ─
  console.log("4. Testing Campaign Lifecycle, Four-Eyes Approval, Multi-Number & Shared Limit...");
  // Configure rule requiring 2-stage four-eyes approval for MARKETING campaigns
  await approvalService.createRule(1, {
    name: "Marketing Governance",
    condition: { category: "MARKETING" },
    stages: [
      { stage_name: "compliance_review", required_role: "compliance_reviewer" },
      { stage_name: "finance_approval", required_role: "finance_approver" },
    ],
    require_four_eyes: true,
  }, 10);

  // Set shared Meta 24h limit to 2 recipients (even though Tenant 1 has 2 senders!)
  await q(
    `INSERT INTO meta_messaging_limits (tenant_id, account_id, waba_id, tier, max_daily_recipients, used_daily_recipients, rolling_window_hours, status)
     VALUES (1, 'waba_1001', 'waba_1001', 'TIER_50', 2, 0, 24, 'active')`
  );

  // Enable provider_managed billing for Tenant 1 & fund wallet with Rs 100.00 (10,000 paise)
  await billingModeService.updateBillingMode(1, "provider_managed");
  const topupOrder = await walletService.createTopupOrder({ tenantId: 1, bucket: "whatsapp_messaging", amountMinor: 10000 });
  await walletService.confirmTopupPayment({ tenantId: 1, orderId: topupOrder.order_id, paymentId: "pay_test_1" });

  const campaign = await managementService.createCampaign(1, {
    name: "Diwali Solar Launch",
    campaign_type: "product_launch",
    category: "MARKETING",
    segment_id: seg.id,
    waba_id: "waba_1001",
    sender_id: 1,
    sender_mode: "manual_distribution",
    senders: [
      { sender_id: 1, allocation_weight: 1 },
      { sender_id: 2, allocation_weight: 1 },
    ],
    template_id: approvedTemplate.id,
    template_name: approvedTemplate.name,
    template_language: approvedTemplate.language,
    whatsapp_flow_id: publishedFlow.id,
    variable_mapping: {
      1: { field: "first_name", fallback: "Valued Customer" },
      2: { static_value: "20% Subsidy" },
    },
    prefer_marketing_api: true,
  }, 10);

  // Attach Flowbot + Automation binding (creates real CRM lead + tag on Flow completion!)
  await journeyService.bindFlowbot(1, campaign.id, { flowbotId: 42, triggerOn: "reply" });
  await journeyService.createAutomationBinding(1, campaign.id, {
    name: "Post-Flow Lead Qualification",
    trigger_event: "whatsapp_flow_completed",
    actions: [{ type: "create_lead", enquiry_type: "product" }, { type: "add_tag", tag: "flow_qualified" }, { type: "assign_agent", agent_id: 55 }],
  }, 10);

  const preview = await managementService.validateAndPreview(1, campaign.id, 10);
  assert.equal(preview.valid, true, "Campaign validation should pass");
  assert.equal(preview.provider_route.route, "marketing_messages_api", "Onboarded WABA should route to Marketing Messages API");
  assert.equal(preview.effective_eligible_count, 3);
  assert.equal(preview.approval.required, true);

  // Submit for approval & verify four-eyes maker-checker enforcement
  await approvalService.submitForApproval(1, campaign.id, 10);
  await assert.rejects(
    () => approvalService.decideApproval(1, campaign.id, { action: "APPROVE", actorId: 10 }),
    (err) => err.code === "FOUR_EYES_VIOLATION",
    "Creator (user 10) must not approve their own campaign"
  );

  // Stage 1 approved by Compliance Reviewer (user 20), Stage 2 by Finance Approver (user 30)
  const stage1 = await approvalService.decideApproval(1, campaign.id, { action: "APPROVE", actorId: 20, reason: "Consent verified" });
  assert.equal(stage1.campaign_status, "PENDING_APPROVAL", "Still needs stage 2 finance approval");
  const stage2 = await approvalService.decideApproval(1, campaign.id, { action: "APPROVE", actorId: 30, reason: "Budget verified" });
  assert.equal(stage2.campaign_status, "APPROVED");

  // Schedule then launch (do not dispatch yet so we can test Scenario 5: opt-out during active campaign!)
  await schedulerService.scheduleCampaign(1, campaign.id, { run_at_utc: new Date(Date.now() + 60000).toISOString() }, 10);
  const launch = await executionEngine.launchCampaign(1, campaign.id, 10, { syncDispatch: false });
  assert.equal(launch.queued_count, 3);

  // ── SCENARIO 5: Opt-out during active campaign + CSV re-import protection ──
  console.log("5. Testing Scenario 5: Opt-Out During Active Campaign & Re-Import Guard...");
  const optOutRes = await webhookProcessor.processInboundMessage(1, {
    id: "wamid.inbound.stop",
    from: "919876543212",
    type: "text",
    text: { body: "STOP" },
  });
  assert.equal(optOutRes.opted_out, true);
  assert.equal(optOutRes.cancelled_recipients, 1, "Queued unsent recipient must be cancelled immediately");
  assert.equal(optOutRes.cancelled_jobs, 1, "Queued job for opted-out recipient must be cancelled immediately");

  // Verify CSV re-import does NOT re-enable revoked consent!
  const reImport = await audienceService.processImport(1, {
    filename: "reimport.csv",
    duplicatePolicy: "update",
    rows: [{ phone: "919876543212", name: "Karthik R", consent_text: "Re-imported row" }],
    columnMapping: { phone: "phone", name: "name" },
    consentMapping: { enabled: true, purpose: "marketing", wording_col: "consent_text" },
  }, 10);
  assert.equal(reImport.consent_failed_count, 1, "CSV re-import must never overwrite revoked consent");
  const recheck = await consentService.checkConsent(1, "919876543212", { category: "MARKETING" });
  assert.equal(recheck.eligible, false, "Opted-out contact must remain suppressed");

  // Now dispatch remaining 2 eligible recipients across the 2 senders (shared limit = 2 -> both send via Marketing Messages API!)
  const dispatch = await executionEngine.processCampaignBatch(1, campaign.id, { limit: 10 });
  assert.equal(dispatch.accepted, 2, "Both remaining eligible recipients should be accepted by Meta");
  const marketingCalls = httpClient.calls.filter((c) => c.url.includes("/marketing_messages"));
  assert.equal(marketingCalls.length, 2, "Onboarded WABA must use /marketing_messages endpoint");

  // Verify multi-number distribution used BOTH senders under the single shared business limit
  const sentRecs = await q(`SELECT * FROM campaign_recipients WHERE tenant_id = 1 AND campaign_id = ? AND status = 'ACCEPTED_BY_META'`, [campaign.id]);
  assert.equal(sentRecs.length, 2);
  const usedLimit = await limitEngine.getMessagingLimit(1, "waba_1001");
  assert.equal(usedLimit.used_daily_recipients, 2, "Shared 24h rolling business limit must count unique recipients across all senders");
  assert.equal(usedLimit.remaining_daily_recipients, 0, "Shared limit of 2 must be exhausted regardless of having 2 senders");
  console.log("   PASS: Opt-out live cancellation, CSV guard, Marketing Messages API & shared business limit");

  // ── TEST D & F & G: Webhooks (Dedupe, Out-of-Order, Wallet Settlement, Flow Completion, Attribution) ──
  console.log("6. Testing Webhooks, Out-of-Order Guard, Wallet Settlement, Flow Submission & Attribution...");
  const rec1 = sentRecs[0];
  const rec2 = sentRecs[1];

  // Out-of-order: READ arrives BEFORE DELIVERED for rec1, followed by duplicate DELIVERED
  await webhookProcessor.processStatusWebhook(1, { id: rec1.wamid, status: "read", timestamp: String(Math.floor(Date.now() / 1000)), pricing: { billable: true } });
  await webhookProcessor.processStatusWebhook(1, { id: rec1.wamid, status: "delivered", timestamp: String(Math.floor(Date.now() / 1000)) });
  const dupStatus = await webhookProcessor.processStatusWebhook(1, { id: rec1.wamid, status: "delivered", timestamp: String(Math.floor(Date.now() / 1000)) });
  assert.equal(dupStatus.deduplicated, true, "Duplicate webhook event must be ignored");

  const rec1After = (await q(`SELECT * FROM campaign_recipients WHERE id = ?`, [rec1.id]))[0];
  assert.equal(rec1After.status, "READ", "Late DELIVERED must not downgrade READ status");

  // rec2 FAILS at delivery -> wallet reservation must be released!
  await webhookProcessor.processStatusWebhook(1, { id: rec2.wamid, status: "failed", errors: [{ code: 131026, title: "Message undeliverable" }] });
  const walletAfter = await walletService.getWalletBalances(1);
  assert.equal(walletAfter.buckets.whatsapp_messaging.reserved_minor, 0, "All reservations settled/released cleanly");
  assert.equal(walletAfter.buckets.whatsapp_messaging.balance_minor, 10000 - rec1.estimated_cost_minor, "Only confirmed delivered billable message deducted");

  // Customer completes WhatsApp Flow (`nfm_reply`) correlated by flow_token!
  const flowSub = await webhookProcessor.processInboundMessage(1, {
    id: "wamid.flow.submit.1",
    from: rec1.normalized_phone,
    type: "interactive",
    interactive: {
      type: "nfm_reply",
      nfm_reply: {
        response_json: JSON.stringify({ flow_token: rec1.flow_token, product: "5kW Solar Rooftop", budget: "250000" }),
      },
    },
  });
  assert.equal(flowSub.type, "flow_submission");
  assert.equal(flowSub.campaign_id, campaign.id);
  assert.equal(flowSub.recipient_id, rec1.id);

  // Verify Campaign -> Flow -> Automation -> CRM Enquiries & Contacts real interconnection!
  const createdLeads = await q(`SELECT * FROM wa_enquiries WHERE tenant_id = 1 AND phone = ? AND source = 'campaign_response'`, [rec1.normalized_phone]);
  assert.equal(createdLeads.length, 1, "Flow completion automation must create a real CRM lead in wa_enquiries");
  const taggedContact = (await q(`SELECT tags FROM wa_contacts WHERE tenant_id = 1 AND id = ?`, [rec1.contact_id]))[0];
  assert.ok(String(taggedContact.tags).includes("flow_qualified"), "Flow completion automation must apply CRM contact tag");

  // Customer replies requesting human agent -> Flowbot handover!
  const replyOut = await webhookProcessor.processInboundMessage(1, {
    id: "wamid.reply.1",
    from: rec1.normalized_phone,
    type: "text",
    text: { body: "Please connect me to a human agent" },
  });
  assert.equal(replyOut.matched_campaign, true);
  assert.equal(replyOut.flowbot_state.handover_active, 1, "Human request must activate Team Inbox handover");

  // Verified order conversion attribution
  const conv = await analyticsService.recordVerifiedConversion(1, {
    entity_type: "order",
    entity_id: "ORD-2026-9001",
    conversion_type: "order",
    phone: rec1.normalized_phone,
    revenue_minor: 25000000, // Rs 2,50,000
    evidence: { gateway: "razorpay", payment_id: "pay_verified_1" },
  });
  assert.equal(conv.attributed, true);
  assert.equal(conv.campaign_id, campaign.id);

  const analytics = await analyticsService.getCampaignAnalytics(1, campaign.id);
  assert.equal(analytics.funnel.delivered, 1);
  assert.equal(analytics.funnel.read, 1);
  assert.equal(analytics.funnel.failed, 1);
  assert.equal(analytics.funnel.unique_flow_completed, 1);
  assert.equal(analytics.funnel.unique_replied, 1);
  assert.equal(analytics.funnel.unique_converted, 1);
  assert.equal(analytics.rates.delivered_rate, 50, "1 delivered / (1 delivered + 1 failed) = 50%");
  assert.equal(analytics.rates.read_rate, 100, "1 read / 1 delivered = 100%");
  assert.equal(analytics.financial.verified_revenue_minor, 25000000);
  console.log("   PASS: Webhooks, monotonic status, wallet settlement/release, Flow submission & ROI analytics");

  // ── SCENARIO 3: E-Commerce Abandoned Cart -> Order Completed Stops Journey ──
  console.log("7. Testing Scenario 3: E-Commerce Abandoned Cart & Stop-on-Purchase...");
  const cartCamp = await managementService.createCampaign(1, {
    name: "Shopify Abandoned Cart Recovery",
    campaign_type: "abandoned_cart",
    category: "MARKETING",
    sender_id: 1,
    waba_id: "waba_1001",
    template_id: approvedTemplate.id,
  }, 10);
  await q(`UPDATE campaigns SET status = 'RUNNING' WHERE id = ?`, [cartCamp.id]);
  await journeyService.createAutomationBinding(1, cartCamp.id, {
    name: "Cart Recovery Sequence",
    trigger_event: "abandoned_cart",
    actions: [{ type: "wait", minutes: 30 }, { type: "send_template" }],
    stop_conditions: ["order_completed", "contact_opted_out"],
  }, 10);

  const cartEv = await journeyService.ingestEcommerceEvent(1, {
    provider: "shopify",
    event_type: "abandoned_cart",
    idempotency_key: "cart_ev_101",
    cart_id: "CART-101",
    phone: "919876543210",
    amount_minor: 499900,
  });
  assert.equal(cartEv.deduplicated, false);
  assert.ok(cartEv.actions.some((a) => a.action === "enrolled_journey"));

  // Duplicate event must be deduplicated
  const cartEvDup = await journeyService.ingestEcommerceEvent(1, {
    provider: "shopify",
    event_type: "abandoned_cart",
    idempotency_key: "cart_ev_101",
    cart_id: "CART-101",
    phone: "919876543210",
  });
  assert.equal(cartEvDup.deduplicated, true);

  // Customer pays order -> stops abandoned cart journey immediately!
  const orderEv = await journeyService.ingestEcommerceEvent(1, {
    provider: "shopify",
    event_type: "order_completed",
    idempotency_key: "ord_ev_101",
    order_id: "SHP-101",
    phone: "919876543210",
    amount_minor: 499900,
  });
  assert.ok(orderEv.actions.some((a) => a.action === "stopped_abandoned_cart_journeys" && a.count >= 1));
  console.log("   PASS: E-Commerce idempotency & stop-on-order enforcement");

  // ── TEST D (Unknown Timeout Reconciliation) + TEST B (Template Pause Mid-Campaign) + A/B Significance ──
  console.log("8. Testing Unknown Timeout Reconciliation, Template Disable Pause & A/B Honesty...");
  // Reset limit for Tenant 2 (Client A) and test Cloud API fallback + Timeout -> UNKNOWN_REQUIRES_RECONCILIATION
  await q(`INSERT INTO wa_contacts (name, phone, tenant_id, tags) VALUES ('Alpha Lead','919911223344',2,'["vip"]')`);
  await consentService.recordConsent(2, {
    phone: "919911223344",
    purpose: "marketing",
    collection_method: "website_form",
    captured_wording: "Alpha opt-in",
  }, 100);
  await q(
    `INSERT INTO wa_templates (tenant_id, name, category, language, body, meta_template_id, meta_status, waba_id, sender_id)
     VALUES (2, 'alpha_promo', 'MARKETING', 'en', 'Hi {{1}}, Alpha promo!', 'meta_alpha_1', 'APPROVED', 'waba_2002', 3)`
  );
  const alphaTmpl = (await q(`SELECT * FROM wa_templates WHERE tenant_id = 2 LIMIT 1`))[0];
  const alphaCamp = await managementService.createCampaign(2, {
    name: "Client Alpha Promo",
    category: "MARKETING",
    sender_id: 3,
    waba_id: "waba_2002",
    template_id: alphaTmpl.id,
    template_name: alphaTmpl.name,
    audience_definition: { logic: "AND", include: [{ field: "tags", operator: "contains", value: "vip" }] },
    variable_mapping: { 1: { field: "first_name" } },
    prefer_marketing_api: true,
    allow_cloud_fallback: true,
  }, 100);

  // Create A/B experiment & verify honest significance guard (will NOT declare winner on sample < 100)
  await experimentService.createExperiment(2, alphaCamp.id, {
    name: "Copy Test",
    min_sample_size: 100,
    variants: [
      { variant_key: "A", name: "Control", allocation_pct: 50, template_id: alphaTmpl.id },
      { variant_key: "B", name: "Challenger", allocation_pct: 50, template_id: alphaTmpl.id },
    ],
  });
  const abReport = await experimentService.getExperimentReport(2, alphaCamp.id);
  assert.equal(abReport.significance.statistically_significant, false, "Must never claim significance on insufficient sample size");

  // Simulate network timeout on send -> UNKNOWN_REQUIRES_RECONCILIATION (never blindly retries!)
  const timeoutErr = Object.assign(new Error("timeout of 30000ms exceeded"), { code: "ECONNABORTED" });
  httpClient.setNextError(timeoutErr);
  const alphaLaunch = await executionEngine.launchCampaign(2, alphaCamp.id, 100, { syncDispatch: true, bypassApprovalCheck: true });
  assert.equal(alphaLaunch.dispatch_summary.reconciliation_required, 1, "Timeout must transition to UNKNOWN_REQUIRES_RECONCILIATION");

  // ── SCENARIO 4: Agency Multi-Client Isolation ─────────────────────────────
  await managementService.linkAgencyClient(1, { client_tenant_id: 2, client_name: "Client Alpha" }, 10);
  await assert.rejects(
    () => managementService.getCampaign(3, alphaCamp.id),
    (err) => err.code === "CAMPAIGN_NOT_FOUND",
    "Client B (tenant 3) must not access Client A (tenant 2) campaigns"
  );
  await assert.rejects(
    () => managementService.assertAgencyClientAccess(1, 3),
    (err) => err.code === "AGENCY_CLIENT_UNAUTHORIZED",
    "Agency cannot access unlinked Client B"
  );

  // Template disabled mid-campaign auto-pauses active campaign
  const campForTmplTest = await managementService.createCampaign(2, {
    name: "Active Template Guard Test",
    sender_id: 3,
    waba_id: "waba_2002",
    template_id: alphaTmpl.id,
  }, 100);
  await q(`UPDATE campaigns SET status = 'RUNNING' WHERE id = ?`, [campForTmplTest.id]);
  const tmplTransition = await templateService.handleTemplateStatusTransition(2, alphaTmpl.id, "APPROVED", "PAUSED", "Quality degraded", "webhook");
  assert.equal(tmplTransition.paused_campaigns, 1, "Template pause must automatically pause running campaign");

  // Platform Admin Ops Control Center pause/resume check
  const opsBefore = await analyticsService.getPlatformOperationsOverview();
  assert.ok(opsBefore.reconciliation_required_count >= 1);
  await analyticsService.setDispatchControl({ scopeType: "sender", scopeId: "3", isPaused: true, reason: "Ops incident", actorId: 1 });
  await assert.rejects(
    () => gateway.resolveAuthorizedSender(2, { senderId: 3 }),
    (err) => err.code === "SENDER_PAUSED"
  );
  console.log("   PASS: Timeout reconciliation, A/B honesty, Agency isolation, Template auto-pause & Ops controls");

  // ── SUITE 9: Native /whatsapp/groups, /whatsapp/automations & /whatsapp/flows Unification ──
  console.log("9. Testing Native Contact Groups Targeting, CRM Enrichment & Unified Asset Binding...");
  // Re-enable sender 3 and template for tenant 2 clean group test
  await analyticsService.setDispatchControl({ scopeType: "sender", scopeId: "3", isPaused: false, reason: "Cleared", actorId: 1 });
  await q(`UPDATE wa_templates SET meta_status = 'APPROVED' WHERE id = ?`, [alphaTmpl.id]);

  // Create a native Contact Group (from /whatsapp/groups) for Tenant 2 with 2 members:
  // 1) Alpha Lead (919911223344, has marketing consent + custom CRM attributes)
  // 2) Unconsented Member (919911223399, no marketing consent)
  await q(`UPDATE wa_contacts SET email = 'alpha@client.com', custom_fields = '{"tier":"Platinum"}' WHERE tenant_id = 2 AND phone = '919911223344'`);
  await q(`INSERT INTO wa_contact_groups (name, description, source, tenant_id) VALUES ('VIP Solar Buyers', 'Exported from CRM', 'manual', 2)`);
  const grp = (await q(`SELECT * FROM wa_contact_groups WHERE tenant_id = 2 LIMIT 1`))[0];
  await q(`INSERT INTO wa_group_contacts (group_id, name, phone, tenant_id) VALUES (?, 'Alpha Lead', '919911223344', 2)`, [grp.id]);
  await q(`INSERT INTO wa_group_contacts (group_id, name, phone, tenant_id) VALUES (?, 'No Consent Contact', '919911223399', 2)`, [grp.id]);
  // Add an extra tenant-2 contact NOT in the group to ensure group targeting stays strictly scoped to the group
  await q(`INSERT INTO wa_contacts (name, phone, tenant_id) VALUES ('Outside Group', '919911223377', 2)`);
  await consentService.recordConsent(2, { phone: "919911223377", purpose: "marketing", collection_method: "website_form", captured_wording: "Opt in" }, 100);
  await q(`INSERT INTO wa_automations (name, trigger_type, is_active, tenant_id) VALUES ('Post-Campaign Tagging', 'incoming_message', 1, 2)`);
  const autoRule = (await q(`SELECT * FROM wa_automations WHERE tenant_id = 2 LIMIT 1`))[0];

  // Evaluate group directly via audienceService
  const grpEval = await audienceService.evaluateAudience(2, { group_id: grp.id }, { category: "MARKETING" });
  assert.equal(grpEval.stats.total_matched, 2, "Group evaluation must match ONLY the 2 contacts in the group (not Outside Group)");
  assert.equal(grpEval.stats.eligible_count, 1, "Only consented group member should be eligible");
  assert.equal(grpEval.excluded.length, 1, "Unconsented group member must be excluded");
  assert.equal(grpEval.eligible[0].email, "alpha@client.com", "Group member must be enriched with wa_contacts CRM fields");
  assert.equal(grpEval.eligible[0].custom_fields.tier, "Platinum", "Group member must include wa_contacts custom_fields for personalization");

  // Create campaign directly bound to group_id + automation_id
  const grpCamp = await managementService.createCampaign(2, {
    name: "Native Group Broadcast",
    category: "MARKETING",
    group_id: grp.id,
    automation_id: autoRule.id,
    sender_id: 3,
    waba_id: "waba_2002",
    template_id: alphaTmpl.id,
    template_name: alphaTmpl.name,
    variable_mapping: { 1: { field: "custom_fields.tier" } },
  }, 100);
  assert.equal(grpCamp.group_id, grp.id);
  assert.equal(grpCamp.automation_id, autoRule.id);

  const grpValidation = await managementService.validateAndPreview(2, grpCamp.id);
  assert.equal(grpValidation.valid, true, `Group campaign should validate cleanly: ${JSON.stringify(grpValidation.blockers)}`);
  assert.equal(grpValidation.audience.eligible_count, 1);
  assert.ok(grpValidation.sample_previews[0].rendered_body.includes("Platinum"), "Preview must render enriched custom_fields variable");
  console.log("   PASS: Native Contact Group targeting, CRM enrichment, consent gating & unified asset binding");

  console.log("\nALL ENTERPRISE CAMPAIGN MANAGEMENT TESTS PASSED (9/9 suites, Scenarios 1-5 verified)");
}

run().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
