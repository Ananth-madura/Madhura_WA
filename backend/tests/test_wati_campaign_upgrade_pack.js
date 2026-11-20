"use strict";

/**
 * test_wati_campaign_upgrade_pack.js
 *
 * Automated end-to-end verification suite for the Madhura Campaigns WATI
 * Competitive Upgrade Pack using Node built-in SQLite (:memory:).
 */

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

const { migrate: migrateMeta } = require("../migrations/meta_multi_account_saas");
const { migrate: migrateBilling } = require("../migrations/wati_billing_and_limits");
const { migrate: migrateCampaigns } = require("../migrations/enterprise_campaign_management");
const { migrate: migrateOrchestration } = require("../migrations/enterprise_flowbot_and_automation_engine");
const { migrate: migrateWatiUpgrade } = require("../migrations/campaign_wati_upgrade_pack");

const { createConsentSuppressionService } = require("../services/campaign/consentSuppressionService");
const { createAudienceBuilderService } = require("../services/campaign/audienceBuilderService");
const { createCampaignManagementService } = require("../services/campaign/campaignManagementService");
const { createCampaignExecutionEngine } = require("../services/campaign/campaignExecutionEngine");
const { createRetargetingService } = require("../services/campaign/watiUpgrade/retargetingService");
const { createDripSequenceService } = require("../services/campaign/watiUpgrade/dripSequenceService");
const { createFailureRecoveryService } = require("../services/campaign/watiUpgrade/failureRecoveryService");
const { createTemplateHealthService } = require("../services/campaign/watiUpgrade/templateHealthService");
const { createAiCampaignAssistantService } = require("../services/campaign/watiUpgrade/aiCampaignAssistantService");
const { createGuidedSetupAndAnalyticsService } = require("../services/campaign/watiUpgrade/guidedSetupAndAnalyticsService");
const { createCampaignWebhookProcessor } = require("../services/campaign/campaignWebhookProcessor");
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

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tenants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS wa_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL, phone VARCHAR(32) NOT NULL,
      country_code VARCHAR(5) DEFAULT '91', email VARCHAR(255) DEFAULT NULL, tags TEXT DEFAULT NULL,
      custom_fields TEXT DEFAULT NULL, opt_in_status TINYINT DEFAULT 0, last_contacted DATETIME DEFAULT NULL,
      is_blocked TINYINT DEFAULT 0, is_unsubscribed TINYINT DEFAULT 0, source VARCHAR(100) DEFAULT NULL,
      crm_ref_type VARCHAR(50) DEFAULT NULL, crm_ref_id INT DEFAULT NULL, notes TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL, tenant_id INT NOT NULL DEFAULT 1, branch_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_opt_outs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, phone VARCHAR(32) NOT NULL, tenant_id INT NOT NULL DEFAULT 1,
      reason VARCHAR(100) DEFAULT 'user_request', opt_out_keyword VARCHAR(50) DEFAULT NULL,
      opted_out_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_contact_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL, description TEXT DEFAULT NULL,
      source VARCHAR(100) DEFAULT 'manual', tenant_id INT NOT NULL DEFAULT 1, branch_id INT DEFAULT NULL,
      created_by INT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_group_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INT NOT NULL, name VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(32) NOT NULL, extra_data TEXT DEFAULT NULL, tenant_id INT NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_flows (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL, status VARCHAR(50) DEFAULT 'active',
      tenant_id INT NOT NULL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL, trigger_type VARCHAR(100) DEFAULT 'incoming_message',
      is_active TINYINT DEFAULT 1, tenant_id INT NOT NULL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL, category VARCHAR(50) DEFAULT 'MARKETING',
      language VARCHAR(20) DEFAULT 'en', header_type VARCHAR(50) DEFAULT NULL, header_value TEXT DEFAULT NULL,
      body TEXT NOT NULL, footer TEXT DEFAULT NULL, button_type VARCHAR(50) DEFAULT NULL, buttons TEXT DEFAULT NULL,
      variables TEXT DEFAULT NULL, meta_template_id VARCHAR(100) DEFAULT NULL, meta_status VARCHAR(50) DEFAULT 'DRAFT',
      created_by INT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT NOT NULL, currency VARCHAR(10) DEFAULT 'INR',
      credit_type VARCHAR(50) DEFAULT 'whatsapp_messaging', balance INT DEFAULT 0, reserved_balance INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, credit_type)
    );
    CREATE TABLE IF NOT EXISTS wallet_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT NOT NULL, credit_type VARCHAR(50) NOT NULL,
      amount INT NOT NULL, balance_after INT NOT NULL, direction VARCHAR(20) NOT NULL,
      description TEXT, reference_id VARCHAR(100), created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS wa_enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT NOT NULL, contact_id INT DEFAULT NULL, branch_id INT DEFAULT NULL,
      name VARCHAR(150) NOT NULL, phone VARCHAR(40) DEFAULT NULL, email VARCHAR(180) DEFAULT NULL,
      source VARCHAR(60) DEFAULT 'manual', enquiry_type VARCHAR(24) DEFAULT 'general', message TEXT,
      temperature VARCHAR(12) DEFAULT 'new', status VARCHAR(16) DEFAULT 'open', notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INT NOT NULL DEFAULT 1, sender_id INT DEFAULT NULL,
      phone VARCHAR(40), direction VARCHAR(20), body TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return sqlite;
}

async function seedWorkspace(db) {
  const q = (sql, params = []) => db.promise().query(sql, params);
  await q(`INSERT INTO tenants (id, name) VALUES (1, 'SolarTech Pvt Ltd'), (2, 'Other Tenant LLC')`);

  // Connected sender + WABA for tenant 1
  const encToken = cryptoHelper.encrypt("EAA_TEST_TOKEN_123");
  const wabaRes = await q(
    `INSERT INTO waba_connections (tenant_id, meta_business_id, waba_id, encrypted_token, status, marketing_messages_lite_api_status, marketing_messages_onboarding_status, marketing_messages_terms_accepted)
     VALUES (1, 'biz_100', 'waba_100', ?, 'connected', 'ONBOARDED', 'ONBOARDED', 1)`,
    [encToken]
  );
  const senderRes = await q(
    `INSERT INTO wa_senders (tenant_id, waba_connection_id, phone_number_id, display_phone, verified_name, quality, messaging_tier, status)
     VALUES (1, ?, 'pn_100', '+919800000001', 'SolarTech Official', 'GREEN', 'TIER_1K', 'connected')`,
    [wabaRes[0].insertId]
  );
  const senderId = senderRes[0].insertId;

  // Contacts (including one duplicate phone group for guided setup audit)
  await q(`INSERT INTO wa_contacts (tenant_id, name, phone, country_code, email, tags) VALUES (1, 'Asha Rao', '+919876500001', 'IN', 'asha@example.com', 'solar,commercial')`);
  await q(`INSERT INTO wa_contacts (tenant_id, name, phone, country_code, email, tags) VALUES (1, 'Asha Dup', '+919876500001', 'IN', 'asha2@example.com', 'solar')`);
  await q(`INSERT INTO wa_contacts (tenant_id, name, phone, country_code, email, tags) VALUES (1, 'Bala Nair', '+919876500002', 'IN', 'bala@example.com', 'solar')`);
  await q(`INSERT INTO wa_contacts (tenant_id, name, phone, country_code, email, tags) VALUES (1, 'Chitra Sen', '+919876500003', 'IN', 'chitra@example.com', 'vip')`);
  await q(`INSERT INTO wa_contacts (tenant_id, name, phone, country_code, email, tags) VALUES (1, 'Dev Patel', '+919876500004', 'IN', 'dev@example.com', 'solar')`);
  await q(`INSERT INTO wa_contacts (tenant_id, name, phone, country_code, email, tags) VALUES (1, 'Esha Khan', '+919876500005', 'IN', 'esha@example.com', 'solar')`);

  // Flowbot & automation for AI assistant lookup
  await q(`INSERT INTO wa_flows (tenant_id, name, status) VALUES (1, 'Solar Commercial Qualifier Bot', 'active')`);
  await q(`INSERT INTO wa_automations (tenant_id, name, trigger_type, is_active) VALUES (1, 'Hot Lead Assigner', 'campaign_replied', 1)`);

  // Templates: 1 APPROVED, 1 PENDING, 1 PAUSED
  const tApproved = await q(
    `INSERT INTO wa_templates (tenant_id, name, category, language, body, meta_template_id, meta_status, waba_id, sender_id)
     VALUES (1, 'solar_launch_v1', 'MARKETING', 'en', 'Hi {{1}}, discover our commercial solar package with 25% savings. Reply YES for a demo.', 'meta_t1', 'APPROVED', 'waba_100', ?)`,
    [senderId]
  );
  const tPending = await q(
    `INSERT INTO wa_templates (tenant_id, name, category, language, body, meta_template_id, meta_status, waba_id, sender_id)
     VALUES (1, 'solar_pending_offer', 'MARKETING', 'en', 'Hi {{1}}, your solar quote is ready. Tap below to review.', 'meta_t2', 'PENDING', 'waba_100', ?)`,
    [senderId]
  );
  const tPaused = await q(
    `INSERT INTO wa_templates (tenant_id, name, category, language, body, meta_template_id, meta_status, waba_id, sender_id)
     VALUES (1, 'solar_paused_promo', 'MARKETING', 'en', 'Limited time promo for {{1}}!', 'meta_t3', 'PAUSED', 'waba_100', ?)`,
    [senderId]
  );

  return {
    senderId,
    approvedTemplateId: tApproved[0].insertId,
    pendingTemplateId: tPending[0].insertId,
    pausedTemplateId: tPaused[0].insertId,
  };
}

async function runTests() {
  const db = createTestDb();
  await migrateMeta(db);
  await migrateBilling(db);
  await migrateCampaigns(db);
  await migrateOrchestration(db);
  await migrateWatiUpgrade(db);

  const env = await seedWorkspace(db);
  const consentSvc = createConsentSuppressionService({ db });
  const audienceSvc = createAudienceBuilderService({ db, consentService: consentSvc });
  const mgmtSvc = createCampaignManagementService({ db, audienceService: audienceSvc });

  // Stub gateway that accepts sends deterministically for unit testing
  const stubGateway = {
    sendTemplateMessage: async () => ({ ok: true, wamid: `wamid_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }),
    getWabaMarketingStatus: async () => ({ onboarded: true }),
    resolveSenderForCampaign: async () => ({ id: env.senderId, waba_id: "waba_100", status: "connected" }),
  };
  const execEngine = createCampaignExecutionEngine({ db, gateway: stubGateway, consentService: consentSvc, audienceService: audienceSvc, managementService: mgmtSvc });

  const retargetSvc = createRetargetingService({ db, consentService: consentSvc, audienceService: audienceSvc, managementService: mgmtSvc });
  const dripSvc = createDripSequenceService({ db, consentService: consentSvc });
  const recoverySvc = createFailureRecoveryService({ db, consentService: consentSvc, audienceService: audienceSvc, managementService: mgmtSvc });
  const healthSvc = createTemplateHealthService({ db });
  const aiSvc = createAiCampaignAssistantService({ db, templateHealth: healthSvc });
  const guidedSvc = createGuidedSetupAndAnalyticsService({ db, managementService: mgmtSvc, executionEngine: execEngine });
  const webhookProc = createCampaignWebhookProcessor({ db, consentService: consentSvc });

  const q = (sql, params = []) => db.promise().query(sql, params);

  // Record verifiable marketing opt-in consent for 4 contacts (leave 5th unconsented!)
  for (const phone of ["+919876500001", "+919876500002", "+919876500003", "+919876500004"]) {
    await consentSvc.recordConsent(1, {
      phone,
      purpose: "marketing",
      category: "MARKETING",
      collection_method: "website_form",
      captured_wording: "I agree to receive WhatsApp updates from SolarTech",
    });
  }

  let passed = 0;
  async function test(name, fn) {
    await fn();
    passed++;
    console.log(`  PASS [${passed}]: ${name}`);
  }

  // ── 1. Guided Setup Readiness, Duplicate Phone Detection & Pending Template Auto-Launch ──
  await test("Guided setup audits sender, contacts, duplicates, consent, templates, and pending auto-launch safety", async () => {
    const status = await guidedSvc.getGuidedOnboardingStatus(1);
    assert.equal(status.total_steps, 5);
    assert.equal(status.duplicate_phone_groups.length, 1);
    assert.equal(status.duplicate_phone_groups[0].phone, "+919876500001");

    const seg = await audienceSvc.createSegment(1, {
      name: "Guided Launch Cohort",
      segment_type: "static",
      definition: { static_contacts: [{ name: "Asha Rao", phone: "+919876500001" }] },
    });
    const draftCamp = await mgmtSvc.createCampaign(1, {
      name: "Guided Pending Template Campaign",
      category: "MARKETING",
      segment_id: seg.id,
      sender_id: env.senderId,
      waba_id: "waba_100",
      template_id: env.pendingTemplateId,
      template_name: "solar_pending_offer",
      variable_mapping: { "1": { field: "name", fallback: "Customer" } },
    });

    const watch = await guidedSvc.registerPendingApprovalWatch(1, {
      campaignId: draftCamp.id,
      templateId: env.pendingTemplateId,
      autoLaunchEnabled: true,
    });
    assert.equal(watch.status, "WAITING_TEMPLATE_APPROVAL");

    // Still PENDING -> must NOT launch
    const eval1 = await guidedSvc.evaluatePendingAutoLaunches(1);
    assert.equal(eval1.results[0].status, "WAITING_TEMPLATE_APPROVAL");

    // Approve template in Meta -> evaluate should validate & launch!
    await q(`UPDATE wa_templates SET meta_status = 'APPROVED' WHERE id = ?`, [env.pendingTemplateId]);
    const eval2 = await guidedSvc.evaluatePendingAutoLaunches(1, { syncDispatch: false });
    assert.equal(eval2.results[0].status, "LAUNCHED");
    assert.ok(eval2.results[0].queued_count >= 1);
  });

  // ── 2. Smart Retargeting Segments, Tracked Clicks Only, Read Observability & Anti-Repeat ──
  let sourceCampId;
  await test("Smart retargeting supports real engagement segments, read observability, anti-repeat, and consent rechecks", async () => {
    const seg = await audienceSvc.createSegment(1, {
      name: "Base Promo Audience",
      segment_type: "static",
      definition: { static_contacts: [{ name: "Asha", phone: "+919876500001" }] },
    });
    const camp = await mgmtSvc.createCampaign(1, {
      name: "Q4 Solar Blast",
      category: "MARKETING",
      segment_id: seg.id,
      sender_id: env.senderId,
      waba_id: "waba_100",
      template_id: env.approvedTemplateId,
      template_name: "solar_launch_v1",
      variable_mapping: { "1": { field: "name", fallback: "Customer" } },
    });
    sourceCampId = camp.id;

    // Seed real recipient outcomes across statuses
    const r1 = await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, country_code, status, delivered_at, read_at)
       VALUES (1, ?, ?, 'Asha Rao', '+919876500001', '+919876500001', 'IN', 'READ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [camp.id, env.senderId]
    );
    const r2 = await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, country_code, status, delivered_at, read_at, replied_at)
       VALUES (1, ?, ?, 'Bala Nair', '+919876500002', '+919876500002', 'IN', 'READ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [camp.id, env.senderId]
    );
    const r3 = await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, country_code, status, delivered_at)
       VALUES (1, ?, ?, 'Chitra Sen', '+919876500003', '+919876500003', 'IN', 'DELIVERED', CURRENT_TIMESTAMP)`,
      [camp.id, env.senderId]
    );
    await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, country_code, status, error_code, error_message)
       VALUES (1, ?, ?, 'Dev Patel', '+919876500004', '+919876500004', 'IN', 'FAILED', '429', 'Rate-limit exceeded')`,
      [camp.id, env.senderId]
    );
    await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, country_code, status, error_code, error_message)
       VALUES (1, ?, ?, 'Esha Khan', '+919876500005', '+919876500005', 'IN', 'UNKNOWN_REQUIRES_RECONCILIATION', 'ETIMEDOUT', 'Gateway timeout')`,
      [camp.id, env.senderId]
    );
    // Tracked CTA click ONLY for r1
    await q(
      `INSERT INTO campaign_tracked_links (tenant_id, campaign_id, recipient_id, short_code, destination_url, click_count)
       VALUES (1, ?, ?, 'clk_r1', 'https://solartech.example/quote', 2)`,
      [camp.id, r1[0].insertId]
    );
    await q(
      `UPDATE campaigns SET submitted_count = 5, delivered_count = 3, read_count = 2, reply_count = 1, failed_count = 1 WHERE id = ?`,
      [camp.id]
    );

    const readNoReply = await retargetSvc.computeEngagementAudience(1, camp.id, "read_not_replied");
    assert.equal(readNoReply.matched_count, 1);
    assert.equal(readNoReply.eligible[0].phone, "+919876500001");

    const ctaClicked = await retargetSvc.computeEngagementAudience(1, camp.id, "cta_clicked");
    assert.equal(ctaClicked.matched_count, 1);
    assert.equal(ctaClicked.eligible[0].phone, "+919876500001");

    // Create retargeting campaign -> records anti-repeat history
    const created = await retargetSvc.createRetargetingCampaign(1, {
      source_campaign_id: camp.id,
      engagement_segment: "read_not_replied",
      template_id: env.approvedTemplateId,
    });
    assert.equal(created.stats.eligible_count, 1);
    assert.ok(created.campaign.id > 0);

    // Running same retarget segment again MUST block repeat contact!
    const repeatCheck = await retargetSvc.computeEngagementAudience(1, camp.id, "read_not_replied");
    assert.equal(repeatCheck.eligible_count, 0);
    assert.equal(repeatCheck.repeat_blocked_count, 1);

    // Save retargeting rule
    const rule = await retargetSvc.createRetargetingRule(1, {
      name: "48h Unreplied Follow-Up",
      source_campaign_id: camp.id,
      engagement_segment: "read_not_replied",
      delay_hours: 48,
      target_template_id: env.approvedTemplateId,
    });
    assert.ok(rule.id > 0);

    // Opted-out segment is strictly audit-only (0 outbound eligible)
    await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, country_code, status)
       VALUES (1, ?, ?, 'Opted Out User', '+919876599999', '+919876599999', 'IN', 'BLOCKED_BY_SUPPRESSION')`,
      [camp.id, env.senderId]
    );
    const optOutSeg = await retargetSvc.computeEngagementAudience(1, camp.id, "opted_out");
    assert.equal(optOutSeg.matched_count, 1);
    assert.equal(optOutSeg.eligible_count, 0);
    assert.equal(r2[0].insertId > 0 && r3[0].insertId > 0, true);
  });

  // ── 3. Drip Campaign Sequences: Durable Delays, Stop-on-Purchase & Reply-to-Flowbot ──
  await test("Drip sequence persists durable delays, resumes due enrollments, routes reply to Flowbot, and exits on purchase", async () => {
    const seq = await dripSvc.createSequence(1, {
      name: "Solar 3-Step Nurture",
      sender_id: env.senderId,
      reply_behavior: "route_flowbot",
      reply_flowbot_id: 1,
      stop_conditions: ["opt_out", "purchase", "deal_won", "suppressed"],
      steps: [
        { type: "template", template_id: env.approvedTemplateId, category: "MARKETING" },
        { type: "delay", amount: 1, unit: "hours" },
        { type: "template", template_id: env.approvedTemplateId, category: "MARKETING" },
        { type: "delay", amount: 2, unit: "hours" },
        { type: "template", template_id: env.approvedTemplateId, category: "MARKETING" },
      ],
    });
    assert.equal(seq.steps.length, 5);

    // Enroll Asha (consented), Bala (consented), and Esha (NOT consented -> must skip!)
    const enroll = await dripSvc.enrollContacts(1, seq.id, [
      { name: "Asha Rao", phone: "+919876500001" },
      { name: "Bala Nair", phone: "+919876500002" },
      { name: "Esha Unconsented", phone: "+919876500005" },
    ]);
    assert.equal(enroll.enrolled_count, 2);
    assert.equal(enroll.skipped_count, 1);

    // Both enrolled contacts should now be durably in WAITING_DELAY at step_index 2
    const [enrRows] = await q(`SELECT normalized_phone, status, current_step_index FROM drip_sequence_enrollments WHERE sequence_id = ? ORDER BY id ASC`, [seq.id]);
    assert.equal(enrRows[0].status, "WAITING_DELAY");
    assert.equal(enrRows[0].current_step_index, 2);

    // Reply from Asha routes to Flowbot (does NOT stop her sequence because reply_behavior === 'route_flowbot')
    const replyRes = await dripSvc.handleStopEvent(1, "+919876500001", "reply");
    assert.equal(replyRes.routed_to_flowbot, 1);
    assert.equal(replyRes.stopped, 0);

    // Purchase event from Bala stops Bala's sequence and records conversion revenue!
    const purchRes = await dripSvc.handleStopEvent(1, "+919876500002", "purchase", { revenueMinor: 450000 });
    assert.equal(purchRes.stopped, 1);

    // Fast-forward next_run_at for Asha and run durable due processor -> advances to step 3 & waits at step 4
    await q(`UPDATE drip_sequence_enrollments SET next_run_at = '2020-01-01T00:00:00.000Z' WHERE sequence_id = ? AND normalized_phone = '919876500001'`, [seq.id]);
    const proc = await dripSvc.processDueEnrollments();
    assert.equal(proc.processed, 1);

    const detail = await dripSvc.getSequence(1, seq.id);
    assert.equal(Number(detail.analytics.totals.converted), 1);
    assert.equal(Number(detail.analytics.totals.revenue_minor), 450000);
    assert.ok(detail.analytics.steps.length >= 2);

    // Duplicate & cancel safety
    const dup = await dripSvc.duplicateSequence(1, seq.id);
    assert.ok(dup.name.includes("(Copy)"));
    const cancelled = await dripSvc.setSequenceStatus(1, dup.id, "CANCELLED");
    assert.equal(cancelled.status, "CANCELLED");
  });

  // ── 4. Meta Template Pacing Pause & Approved Replacement Template Recovery ──
  await test("Meta template pacing pauses dispatch, preserves accepted contacts, rejects unapproved templates, and recovers unsent contacts", async () => {
    const seg = await audienceSvc.createSegment(1, {
      name: "Pacing Test Segment",
      segment_type: "static",
      definition: { static_contacts: [{ name: "Asha", phone: "+919876500001" }] },
    });
    const camp = await mgmtSvc.createCampaign(1, {
      name: "Pacing Demo Campaign",
      category: "MARKETING",
      segment_id: seg.id,
      sender_id: env.senderId,
      waba_id: "waba_100",
      template_id: env.pausedTemplateId,
      template_name: "solar_paused_promo",
      variable_mapping: { "1": { field: "name", fallback: "Customer" } },
    });
    await q(`UPDATE campaigns SET status = 'RUNNING' WHERE id = ?`, [camp.id]);
    // 1 already DELIVERED (must be preserved & NOT resent), 1 FAILED with 132015, 1 QUEUED
    await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, status, delivered_at)
       VALUES (1, ?, ?, 'Asha Rao', '+919876500001', '+919876500001', 'DELIVERED', CURRENT_TIMESTAMP)`,
      [camp.id, env.senderId]
    );
    await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, status, error_code, error_message)
       VALUES (1, ?, ?, 'Bala Nair', '+919876500002', '+919876500002', 'FAILED', '132015', 'Template paused by Meta pacing')`,
      [camp.id, env.senderId]
    );
    await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, status)
       VALUES (1, ?, ?, 'Chitra Sen', '+919876500003', '+919876500003', 'QUEUED')`,
      [camp.id, env.senderId]
    );

    const incident = await recoverySvc.handleTemplatePacingDetected(1, {
      campaignId: camp.id,
      templateId: env.pausedTemplateId,
      errorCode: "132015",
      errorMessage: "Meta template pacing pause",
    });
    assert.equal(incident.preserved_accepted_count, 1);
    assert.equal(incident.affected_pending_count, 2);

    const [campAfter] = await q(`SELECT status FROM campaigns WHERE id = ?`, [camp.id]);
    assert.equal(campAfter[0].status, "PAUSED");

    // Reject PAUSED replacement template!
    await assert.rejects(
      () => recoverySvc.recoverWithReplacementTemplate(1, incident.id, { replacementTemplateId: env.pausedTemplateId }),
      (err) => err.code === "TEMPLATE_NOT_APPROVED"
    );

    // Recover with APPROVED template -> recovers ONLY Bala & Chitra (2), preserving Asha (1)
    const recovered = await recoverySvc.recoverWithReplacementTemplate(1, incident.id, {
      replacementTemplateId: env.approvedTemplateId,
    });
    assert.equal(recovered.recovered_recipient_count, 2);
    assert.equal(recovered.preserved_already_sent_count, 1);
    assert.ok(recovered.recovery_campaign.id > 0);
  });

  // ── 5. Configurable Auto-Retry Skipping Permanent & UNKNOWN_REQUIRES_RECONCILIATION ──
  await test("Auto-retry requeues transient failures while skipping permanent errors and UNKNOWN_REQUIRES_RECONCILIATION", async () => {
    const policy = await recoverySvc.saveRetryPolicy(1, {
      name: "Transient Backoff",
      retry_delays_seconds: [60, 300],
      max_attempts: 3,
      jitter_pct: 10,
    });
    assert.ok(policy.id > 0);

    // Add a permanent failure (invalid recipient 131021) to sourceCampId alongside existing 429 transient & UNKNOWN_REQUIRES_RECONCILIATION
    await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, status, error_code, error_message)
       VALUES (1, ?, ?, 'Bad Phone', '+910000000000', '+910000000000', 'FAILED', '131021', 'Invalid recipient phone')`,
      [sourceCampId, env.senderId]
    );

    const res = await recoverySvc.retryEligibleTransientFailures(1, sourceCampId, { policyId: policy.id });
    assert.equal(res.requeued_count, 1); // Dev Patel (429 rate-limit)
    assert.equal(res.skipped_permanent, 1); // Bad Phone (131021)
    assert.equal(res.skipped_reconciliation_required, 1); // Esha (UNKNOWN_REQUIRES_RECONCILIATION)
  });

  // ── 6. Optional Cross-Channel Fallback (SMS) with Separate Consent & Compliance Guard ──
  await test("SMS fallback blocks promotional fallback unless enabled, requires separate sms_fallback consent, and uses separate cost ledger", async () => {
    // Configure SMS fallback with promotional fallback OFF first
    const chStrict = await recoverySvc.configureFallbackChannel(1, {
      channel: "sms",
      provider_name: "Twilio SMS",
      sender_identity: "SOLART",
      allow_promotional_fallback: false,
      cost_per_message_minor: 35,
      currency: "INR",
    });
    assert.ok(chStrict.id > 0);

    // Create a FAILED recipient on a MARKETING campaign
    const failRec = await q(
      `INSERT INTO campaign_recipients (tenant_id, campaign_id, sender_id, contact_name, phone, normalized_phone, status, error_code, error_message)
       VALUES (1, ?, ?, 'Chitra Sen', '+919876500003', '919876500003', 'FAILED', '131026', 'Recipient unavailable')`,
      [sourceCampId, env.senderId]
    );
    const failRecId = failRec[0].insertId;

    // 1) Blocked because promotional fallback is disabled!
    await assert.rejects(
      () => recoverySvc.dispatchFallbackForRecipient(1, { campaignId: sourceCampId, recipientId: failRecId, channel: "sms", messageText: "Fallback SMS" }),
      (err) => err.code === "PROMOTIONAL_FALLBACK_BLOCKED"
    );

    // 2) Enable promotional fallback explicitly -> still blocked because separate `sms_fallback` consent is missing!
    await recoverySvc.configureFallbackChannel(1, {
      channel: "sms",
      provider_name: "Twilio SMS",
      sender_identity: "SOLART",
      allow_promotional_fallback: true,
      cost_per_message_minor: 35,
      currency: "INR",
    });
    await assert.rejects(
      () => recoverySvc.dispatchFallbackForRecipient(1, { campaignId: sourceCampId, recipientId: failRecId, channel: "sms", messageText: "Fallback SMS" }),
      (err) => err.code === "FALLBACK_CHANNEL_CONSENT_MISSING"
    );

    // 3) Grant separate `sms_fallback` consent -> succeeds with separate channel_message_id & cost_minor = 35!
    await consentSvc.recordConsent(1, {
      phone: "+919876500003",
      purpose: "sms_fallback",
      category: "MARKETING",
      collection_method: "website_form",
      captured_wording: "I consent to receive SMS fallback alerts if WhatsApp fails",
    });
    const dispatched = await recoverySvc.dispatchFallbackForRecipient(1, {
      campaignId: sourceCampId,
      recipientId: failRecId,
      channel: "sms",
      messageText: "Hi Chitra, your solar proposal is ready.",
    });
    assert.equal(dispatched.channel, "sms");
    assert.equal(dispatched.cost_minor, 35);
    assert.ok(dispatched.channel_message_id.startsWith("sms_"));

    // 4) Duplicate fallback dispatch blocked!
    await assert.rejects(
      () => recoverySvc.dispatchFallbackForRecipient(1, { campaignId: sourceCampId, recipientId: failRecId, channel: "sms", messageText: "Duplicate" }),
      (err) => err.code === "FALLBACK_DUPLICATE_BLOCKED"
    );
  });

  // ── 7. Template Health Center, AI Assistant & Advanced Analytics ──
  await test("Template Health Center, AI Campaign Assistant, and Advanced 7-Stage Analytics work on live DB records", async () => {
    const health = await healthSvc.getTemplateHealthOverview(1);
    assert.ok(health.summary.total >= 3);
    assert.ok(health.summary.approved >= 2);
    assert.ok(health.summary.paused >= 1);

    // Duplicate & draft replacement
    const dupTmpl = await healthSvc.duplicateTemplate(1, env.approvedTemplateId);
    assert.equal(dupTmpl.meta_status, "DRAFT");

    const draftCamp = await mgmtSvc.createCampaign(1, {
      name: "Draft Using Paused Template",
      category: "MARKETING",
      template_id: env.pausedTemplateId,
      template_name: "solar_paused_promo",
    });
    const swapped = await healthSvc.replaceTemplateInDraftCampaigns(1, env.pausedTemplateId, env.approvedTemplateId);
    assert.ok(swapped.updated_draft_campaigns >= 1);
    assert.ok(draftCamp.id > 0);

    // AI Assistant: blueprint, audience draft, policy-safe template check, live Q&A, recommendations
    const bp = await aiSvc.proposeCampaignBlueprint(1, "Launch our new commercial solar package to India leads");
    assert.equal(bp.requires_user_review, true);
    assert.equal(bp.auto_launched, false);
    assert.equal(bp.proposed_campaign.campaign_type, "product_launch");

    const tmplCheck = aiSvc.evaluateTemplateQuality({ category: "UTILITY", body: "Limited time 50% off discount sale!" });
    assert.equal(tmplCheck.preserved_category, "UTILITY");
    assert.ok(tmplCheck.risk_warnings.some((w) => w.includes("Policy Warning")));

    const qa = await aiSvc.answerPerformanceQuestion(1, "Which campaign had the most replies?");
    assert.ok(qa.answer.includes("Q4 Solar Blast"));
    assert.ok(qa.calculation_method.includes("MAX(reply_count)"));

    const recs = await aiSvc.getNextBestActions(1);
    assert.equal(recs.auto_launch_permitted, false);
    assert.ok(Array.isArray(recs.recommendations));

    // Advanced 7-stage analytics
    const adv = await guidedSvc.getAdvancedAnalytics(1, { granularity: "hourly" });
    assert.ok(adv.funnel.audience >= 5);
    assert.ok(adv.funnel.delivered >= 3);
    assert.ok(adv.funnel.cta_clicks >= 2);
    assert.ok(adv.trends.length >= 1);
    assert.ok(adv.failure_breakdown.length >= 1);
  });

  // ── 8. Webhook Integration & Multi-Tenant Isolation ──
  await test("Webhook opt-out exits drip enrollments and multi-tenant isolation blocks cross-tenant access", async () => {
    // Send STOP inbound message for Asha -> should exit her active drip sequence
    const stopRes = await webhookProc.processInboundMessage(1, {
      id: "wamid_in_stop_1",
      from: "+919876500001",
      type: "text",
      text: { body: "STOP" },
    });
    assert.equal(stopRes.opted_out, true);

    const [ashaDrip] = await q(
      `SELECT status, exit_reason FROM drip_sequence_enrollments WHERE tenant_id = 1 AND normalized_phone = '919876500001' ORDER BY id DESC LIMIT 1`
    );
    assert.equal(ashaDrip[0].status, "EXITED");
    assert.equal(ashaDrip[0].exit_reason, "opt_out");

    // Tenant 2 cannot see Tenant 1's campaigns, sequences, or template health
    await assert.rejects(
      () => retargetSvc.computeEngagementAudience(2, sourceCampId, "read_not_replied"),
      (err) => err.code === "CAMPAIGN_NOT_FOUND"
    );
    const t2Seqs = await dripSvc.listSequences(2);
    assert.equal(t2Seqs.length, 0);
    const t2Health = await healthSvc.getTemplateHealthOverview(2);
    assert.equal(t2Health.summary.total, 0);
  });

  console.log(`\nALL ${passed}/${passed} WATI CAMPAIGN UPGRADE PACK TESTS PASSED`);
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
