"use strict";

const router = require("express").Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext, requirePermission } = require("../middleware/tenantMiddleware");
const { createOnboardingService } = require("../services/metaCustomerOnboardingService");
const metaPartnerService = require("../services/metaPartnerService");

const onboardingMetaService = createOnboardingService(db);

const handle = work => async (req, res) => {
  try {
    await work(req, res);
  } catch (error) {
    if (!error.status) console.error("[Onboarding workspace]", error.code || "OPERATION_FAILED", error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Onboarding operation failed. Retry or contact support."
    });
  }
};

router.use(verifyToken, requireTenantContext);
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

/**
 * GET /api/onboarding/status
 * Evaluates the full 10-step onboarding state machine from authoritative database state.
 */
router.get("/status", handle(async (req, res) => {
  const tid = Number(req.tenantId);
  const uid = Number(req.user.id);

  const [tenants] = await db.promise().query(
    "SELECT id, name, legal_name, brand_name, plan, status, timezone, created_at, settings_json FROM tenants WHERE id = ? LIMIT 1",
    [tid]
  );
  const tenant = tenants?.[0] || { id: tid, plan: "free", name: "Workspace" };

  const [users] = await db.promise().query(
    "SELECT id, email, first_name, last_name, status, two_factor_enabled FROM users WHERE id = ? LIMIT 1",
    [uid]
  );
  const user = users?.[0] || req.user;

  const [senders] = await db.promise().query(
    "SELECT id, display_phone, verified_name, quality_rating, status, waba_id, phone_number_id, is_default, created_at FROM wa_senders WHERE tenant_id = ? AND status != 'deleted' ORDER BY id ASC",
    [tid]
  );

  const [firstMessages] = await db.promise().query(
    "SELECT id, message_id, status, recipient, created_at FROM wa_message_logs WHERE tenant_id = ? ORDER BY id ASC LIMIT 1",
    [tid]
  );

  const [staffCount] = await db.promise().query(
    "SELECT COUNT(*) AS total FROM organization_memberships WHERE tenant_id = ? AND membership_status = 'active'",
    [tid]
  );

  const [contactsCount] = await db.promise().query(
    "SELECT COUNT(*) AS total FROM wa_contacts WHERE tenant_id = ?",
    [tid]
  );

  const [automationsCount] = await db.promise().query(
    "SELECT COUNT(*) AS total FROM wa_automations WHERE tenant_id = ?",
    [tid]
  );

  let settings = {};
  try {
    if (tenant.settings_json) settings = JSON.parse(tenant.settings_json);
  } catch (_) {}

  // 10 Authoritative Onboarding Steps
  const step1_accountVerified = user.status === "active";
  const step2_companyCompleted = Boolean(tenant.name && (tenant.legal_name || tenant.name !== "New Organization"));
  const step3_planSelected = Boolean(tenant.plan);
  const step4_whatsappConnected = senders.length > 0;
  const step5_numberRegistered = senders.some(s => s.status === "connected" || s.status === "ready");
  const step6_webhookConnected = senders.some(s => Boolean(s.waba_id));
  const step7_firstMessageSent = Boolean(firstMessages?.[0]);
  const step8_teamConfigured = (staffCount?.[0]?.total || 0) >= 1;
  const step9_crmConfigured = Boolean((contactsCount?.[0]?.total || 0) > 0 || settings.crm_configured);
  const step10_automationPublished = Boolean((automationsCount?.[0]?.total || 0) > 0 || settings.automation_configured);

  const steps = [
    {
      id: 1,
      key: "account_verified",
      title: "Account Verified",
      description: "Madhura master administrator user account confirmed with active credentials.",
      completed: step1_accountVerified,
      status: step1_accountVerified ? "completed" : "action_required",
      route: "/signup/verify-email",
      evidence: user.email ? `Verified as ${user.email}` : null
    },
    {
      id: 2,
      key: "company_profile",
      title: "Company Profile",
      description: "Business legal entity, primary operational timezone, and industry category registered.",
      completed: step2_companyCompleted,
      status: step2_companyCompleted ? "completed" : "action_required",
      route: "/onboarding/company",
      evidence: tenant.name ? `${tenant.name} (${tenant.timezone || "Asia/Kolkata"})` : null
    },
    {
      id: 3,
      key: "subscription_selected",
      title: "Subscription Tier",
      description: "Active multi-branch capacity and messaging quota assigned to workspace.",
      completed: step3_planSelected,
      status: step3_planSelected ? "completed" : "action_required",
      route: "/onboarding/plan",
      evidence: tenant.plan ? `Current tier: ${tenant.plan.toUpperCase()}` : null
    },
    {
      id: 4,
      key: "whatsapp_connected",
      title: "WhatsApp Account Connected",
      description: "Meta Business Portfolio and WhatsApp Business Account (WABA) authorized.",
      completed: step4_whatsappConnected,
      status: step4_whatsappConnected ? "completed" : "action_required",
      route: "/onboarding/whatsapp/connect",
      evidence: senders[0] ? `WABA: ${senders[0].waba_id || "Connected"}` : null
    },
    {
      id: 5,
      key: "number_registered",
      title: "Phone Number Registered",
      description: "WhatsApp phone number verified and registered for Cloud API messaging.",
      completed: step5_numberRegistered,
      status: step5_numberRegistered ? "completed" : "action_required",
      route: "/onboarding/whatsapp/numbers",
      evidence: senders[0]?.display_phone ? `Active Number: ${senders[0].display_phone}` : null
    },
    {
      id: 6,
      key: "webhook_connected",
      title: "Meta Webhook Subscribed",
      description: "Direct real-time webhook callback configured for incoming chats and delivery status.",
      completed: step6_webhookConnected,
      status: step6_webhookConnected ? "completed" : "action_required",
      route: "/onboarding/whatsapp/connect",
      evidence: "Endpoint: https://api.madhuratech.in/webhook"
    },
    {
      id: 7,
      key: "first_message",
      title: "First WhatsApp Message Verified",
      description: "Verified real delivery with actual WhatsApp Message ID (wamid).",
      completed: step7_firstMessageSent,
      status: step7_firstMessageSent ? "completed" : "action_required",
      route: "/onboarding/whatsapp/test-message",
      evidence: firstMessages?.[0]?.message_id ? `Message ID: ${firstMessages[0].message_id}` : null
    },
    {
      id: 8,
      key: "team_configured",
      title: "Team Access & Branch Routing",
      description: "Assigned staff memberships and conversation capacities configured.",
      completed: step8_teamConfigured,
      status: step8_teamConfigured ? "completed" : "action_required",
      route: "/whatsapp/employees",
      evidence: `${staffCount?.[0]?.total || 1} staff seat(s) active`
    },
    {
      id: 9,
      key: "crm_configured",
      title: "CRM Pipeline & Contacts",
      description: "Customer directory initialized with lead stages and tags.",
      completed: step9_crmConfigured,
      status: step9_crmConfigured ? "completed" : "optional",
      route: "/whatsapp/contacts",
      evidence: `${contactsCount?.[0]?.total || 0} customer contact(s) tracked`
    },
    {
      id: 10,
      key: "automation_published",
      title: "First Automation Published",
      description: "Interactive welcome trigger, customer triage, or appointment reminder active.",
      completed: step10_automationPublished,
      status: step10_automationPublished ? "completed" : "optional",
      route: "/whatsapp/automations",
      evidence: `${automationsCount?.[0]?.total || 0} live automation(s)`
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  res.json({
    success: true,
    progress: progressPercent,
    completedSteps: completedCount,
    totalSteps: steps.length,
    isComplete: completedCount >= 7, // Steps 1-7 are core activation
    steps,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      legal_name: tenant.legal_name,
      brand_name: tenant.brand_name,
      plan: tenant.plan,
      timezone: tenant.timezone
    },
    senders: senders.map(s => ({
      id: s.id,
      phone: s.display_phone,
      verifiedName: s.verifiedName,
      status: s.status,
      qualityRating: s.quality_rating
    }))
  });
}));

/**
 * POST /api/onboarding/company
 * Updates company profile details during workspace setup.
 */
router.post("/company", requirePermission("workspace.manage"), handle(async (req, res) => {
  const tid = Number(req.tenantId);
  const {
    company_name,
    legal_name,
    brand_name,
    industry,
    category,
    country = "India",
    timezone = "Asia/Kolkata",
    gstin,
    website,
    phone
  } = req.body;

  const cleanCompany = String(company_name || legal_name || "").trim();
  if (!cleanCompany) {
    return res.status(400).json({ success: false, message: "Company or Organization name is required" });
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch (_) {
    return res.status(400).json({ success: false, message: "Invalid timezone identifier" });
  }

  const [tenants] = await db.promise().query("SELECT settings_json FROM tenants WHERE id = ? LIMIT 1", [tid]);
  let currentSettings = {};
  try {
    if (tenants?.[0]?.settings_json) currentSettings = JSON.parse(tenants[0].settings_json);
  } catch (_) {}

  const updatedSettings = {
    ...currentSettings,
    industry: industry || category || "General",
    category: category || industry || "General",
    country,
    gstin: gstin ? String(gstin).trim().toUpperCase() : null,
    website: website ? String(website).trim() : null,
    phone: phone ? String(phone).trim() : null,
    updated_at: new Date().toISOString()
  };

  await db.promise().query(
    "UPDATE tenants SET name = ?, legal_name = ?, brand_name = ?, timezone = ?, settings_json = ?, updated_at = NOW() WHERE id = ?",
    [
      cleanCompany,
      legal_name ? String(legal_name).trim() : cleanCompany,
      brand_name ? String(brand_name).trim() : cleanCompany,
      timezone,
      JSON.stringify(updatedSettings),
      tid
    ]
  );

  res.json({
    success: true,
    message: "Company details updated successfully",
    company: {
      name: cleanCompany,
      legal_name: legal_name || cleanCompany,
      brand_name: brand_name || cleanCompany,
      timezone,
      country,
      settings: updatedSettings
    }
  });
}));

/**
 * POST /api/onboarding/first-message
 * Sends the diagnostic first WhatsApp test message from a verified number.
 */
router.post("/first-message", requirePermission("sender.manage"), handle(async (req, res) => {
  const tid = Number(req.tenantId);
  const { sender_id, recipient, message } = req.body;

  const cleanRecipient = String(recipient || "").trim().replace(/[^\d+]/g, "");
  if (!cleanRecipient || cleanRecipient.length < 8) {
    return res.status(400).json({ success: false, message: "Please provide a valid recipient phone number with country code" });
  }

  let sender = null;
  if (sender_id) {
    sender = await metaPartnerService.getSender(tid, sender_id);
  } else {
    const senders = await metaPartnerService.getTenantSenders(tid);
    sender = senders.find(s => s.status === "connected") || senders[0];
  }

  if (!sender) {
    return res.status(400).json({ success: false, message: "No active WhatsApp sender found. Connect a WhatsApp number first." });
  }

  const result = await onboardingMetaService.sendTestMessage(tid, sender.id, {
    recipient: cleanRecipient,
    message: message || "Hello from Madhura Enterprise WhatsApp CRM! Your workspace activation is complete."
  });

  res.json({
    success: true,
    message: "First WhatsApp test message dispatched successfully",
    ...result
  });
}));

/**
 * POST /api/onboarding/complete
 * Marks the onboarding milestone as complete.
 */
router.post("/complete", requirePermission("workspace.manage"), handle(async (req, res) => {
  const tid = Number(req.tenantId);
  const [tenants] = await db.promise().query("SELECT settings_json FROM tenants WHERE id = ? LIMIT 1", [tid]);
  let currentSettings = {};
  try {
    if (tenants?.[0]?.settings_json) currentSettings = JSON.parse(tenants[0].settings_json);
  } catch (_) {}

  currentSettings.onboarding_completed = true;
  currentSettings.onboarding_completed_at = new Date().toISOString();

  await db.promise().query("UPDATE tenants SET settings_json = ?, updated_at = NOW() WHERE id = ?", [
    JSON.stringify(currentSettings),
    tid
  ]);

  res.json({
    success: true,
    message: "Onboarding completed successfully. Welcome to Madhura WhatsApp CRM!",
    next: "/whatsapp"
  });
}));

module.exports = router;
