"use strict";

/**
 * test_wati_saas_billing_and_limits.js
 *
 * Comprehensive in-memory SQLite test suite for:
 * 1. Dual Billing Architecture (direct_meta vs provider_managed).
 * 2. Country Rate Cards & October 1, 2026 1,000 Free Service Messages Policy.
 * 3. Meta Messaging Limits & 24h Rolling Unique Recipient Window (Shared WABA limit).
 * 4. Message Reservation -> Settlement -> Failure Release Lifecycle.
 * 5. Multi-Bucket Prepaid Wallet (whatsapp_messaging, ai_credits, automation_credits).
 * 6. Tenant Isolation.
 */

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

const { migrate } = require("../migrations/wati_billing_and_limits");
const { createBillingModeService } = require("../services/metaBillingModeService");
const { createPricingEngine } = require("../services/metaMessagePricingEngine");
const { createLimitEngine } = require("../services/metaMessagingLimitEngine");
const { createWalletService } = require("../services/watiWalletService");

function createTestDb() {
  const sqlite = new DatabaseSync(":memory:");

  // Mock standard MySQL promise interface for SQLite
  sqlite.promise = () => ({
    query: async (sql, params = []) => {
      const stmt = sqlite.prepare(sql);
      if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
        const rows = stmt.all(...params);
        return [rows];
      }
      const info = stmt.run(...params);
      return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }];
    }
  });
  sqlite.isSqlite = true;

  // Base prerequisite tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      status TEXT DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      credit_type VARCHAR(50) DEFAULT 'ai_credits',
      balance INT DEFAULT 0,
      reserved_balance INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return sqlite;
}

async function runTests() {
  console.log("Starting WATI SaaS Billing & Limits Test Suite...\n");
  const db = createTestDb();

  // Run WATI billing migrations
  await migrate(db);

  // Initialize services with isolated test database
  const billingModeService = createBillingModeService({ db });
  const pricingEngine = createPricingEngine({ db });
  const limitEngine = createLimitEngine({ db });
  const walletService = createWalletService({ db });

  // 1. Dual Billing Architecture & Mode Switching
  console.log("1. Testing Dual Billing Architecture & Mode Switching...");
  const tenant1Profile = await billingModeService.getBillingProfile(1);
  assert.equal(tenant1Profile.billing_mode, "direct_meta", "Default mode must be direct_meta");
  assert.equal(tenant1Profile.currency, "INR");
  assert.equal(tenant1Profile.is_direct_meta, true);

  // Switch to provider_managed
  const updatedProfile = await billingModeService.updateBillingMode(1, "provider_managed", {
    creditLineStatus: "partner_credit_line_active"
  });
  assert.equal(updatedProfile.billing_mode, "provider_managed");
  assert.equal(updatedProfile.credit_line_status, "partner_credit_line_active");
  assert.equal(updatedProfile.is_provider_managed, true);

  // Spending limits update
  const limitsProfile = await billingModeService.updateSpendingLimits(1, {
    monthly_spending_limit_minor: 500000, // Rs 5,000
    auto_recharge_enabled: 1,
    auto_recharge_trigger_minor: 100000,  // Rs 1,000
    auto_recharge_amount_minor: 250000    // Rs 2,500
  });
  assert.equal(limitsProfile.monthly_spending_limit_minor, 500000);
  assert.equal(limitsProfile.auto_recharge_enabled, 1);
  console.log("   Dual Billing Profile & Spending Limits: PASS");

  // 2. Country Rate Cards & October 1, 2026 1,000 Free Service Messages Policy
  console.log("2. Testing Rate Cards & 1,000 Free Service Messages Policy...");
  const indiaMarketing = await pricingEngine.getRateCard("IN", "marketing");
  assert.equal(indiaMarketing.rate_minor, 78, "India marketing should be 78 paise (0.78 INR)");

  const usUtility = await pricingEngine.getRateCard("US", "utility");
  assert.equal(usUtility.rate_minor, 150, "US utility should be 150 paise (1.50 INR)");

  const rowRate = await pricingEngine.getRateCard("XYZ", "marketing");
  assert.equal(rowRate.rate_minor, 350, "Unknown country should fall back to ROW (350 paise)");

  // Test Phone Resolution
  assert.equal(pricingEngine.resolveCountryFromPhone("+919876543210"), "IN");
  assert.equal(pricingEngine.resolveCountryFromPhone("+12025550199"), "US");
  assert.equal(pricingEngine.resolveCountryFromPhone("+971501234567"), "AE");
  assert.equal(pricingEngine.resolveCountryFromPhone("+447700900077"), "GB");

  // Verify first 1,000 service messages are FREE (cost_minor = 0)
  const calc1 = await pricingEngine.calculateMessageCost({
    tenantId: 1,
    phoneNumberId: "phone_001",
    recipientPhone: "+919876543210",
    category: "service"
  });
  assert.equal(calc1.rate_minor, 0, "First service message must be free (0 cost)");
  assert.equal(calc1.is_free_allowance, 1, "Should be flagged as free allowance");
  assert.equal(calc1.base_rate_minor, 29, "Base rate in India for service is 29 paise");

  // Simulate usage of 1,000 free service messages in database
  const month = new Date().toISOString().substring(0, 7);
  const q = async (sql, p) => (await db.promise().query(sql, p))[0];
  await q(
    `UPDATE service_message_allowances
     SET used_service_messages = 1000
     WHERE tenant_id = 1 AND phone_number_id = 'phone_001' AND billing_month = ?`,
    [month]
  );

  // Message 1,001: must now be BILLABLE
  const calc1001 = await pricingEngine.calculateMessageCost({
    tenantId: 1,
    phoneNumberId: "phone_001",
    recipientPhone: "+919876543210",
    category: "service"
  });
  assert.equal(calc1001.rate_minor, 29, "1,001st service message must be charged standard rate");
  assert.equal(calc1001.is_free_allowance, 0, "Should no longer be free");
  console.log("   Rate Cards & Oct 1 2026 Free Allowance: PASS");

  // 3. Message Lifecycle: Reservation -> Delivery Settlement -> Failure Release
  console.log("3. Testing Message Reservation, Settlement, and Release Lifecycle...");
  const reserved = await pricingEngine.reserveMessageCost({
    tenantId: 1,
    phoneNumberId: "phone_001",
    recipientPhone: "+919876543210",
    category: "marketing",
    messageId: "msg_lifecycle_001",
    billingMode: "provider_managed"
  });
  assert.equal(reserved.status, "reserved");
  assert.equal(reserved.cost_minor, 78);

  // Delivery settlement
  const settled = await pricingEngine.settleDeliveredMessage({
    tenantId: 1,
    messageId: "msg_lifecycle_001",
    metaMessageId: "wamid_meta_001"
  });
  assert.equal(settled.settled, true);
  assert.equal(settled.cost_minor, 78);

  // Idempotent settlement
  const idempotentSettled = await pricingEngine.settleDeliveredMessage({
    tenantId: 1,
    messageId: "msg_lifecycle_001",
    metaMessageId: "wamid_meta_001"
  });
  assert.equal(idempotentSettled.alreadySettled, true);

  // Failure release
  const failedMsg = await pricingEngine.reserveMessageCost({
    tenantId: 1,
    phoneNumberId: "phone_001",
    recipientPhone: "+919876543210",
    category: "marketing",
    messageId: "msg_lifecycle_002",
    billingMode: "provider_managed"
  });
  const released = await pricingEngine.releaseFailedMessage({
    tenantId: 1,
    messageId: "msg_lifecycle_002",
    failureReason: "RECIPIENT_UNDELIVERABLE"
  });
  assert.equal(released.released, true);
  console.log("   Lifecycle (Reserve -> Settle -> Release): PASS");

  // 4. Meta Messaging Limits & 24h Rolling Unique Recipient Window
  console.log("4. Testing Meta Messaging Limits & 24h Rolling Window (Shared WABA limit)...");
  // Set limit tier to TIER_50 (50 daily unique recipients)
  await limitEngine.syncLimitsFromMeta(1, "act_001", "TIER_50");
  const limitState = await limitEngine.getMessagingLimit(1, "act_001");
  assert.equal(limitState.tier, "TIER_50");
  assert.equal(limitState.max_daily_recipients, 50);
  assert.equal(limitState.is_shared_across_all_senders, true);

  // First dispatch to recipient A: allowed
  const recipientA = "+919800000001";
  const precheck1 = await limitEngine.canDispatch({
    tenantId: 1,
    accountId: "act_001",
    recipientPhone: recipientA,
    isCustomerInitiated: false
  });
  assert.equal(precheck1.allowed, true);

  // Record dispatch
  await limitEngine.recordDispatch({
    tenantId: 1,
    accountId: "act_001",
    recipientPhone: recipientA,
    isCustomerInitiated: false
  });

  // Second dispatch to recipient A within 24h: allowed without consuming additional slot
  const precheckReContact = await limitEngine.canDispatch({
    tenantId: 1,
    accountId: "act_001",
    recipientPhone: recipientA,
    isCustomerInitiated: false
  });
  assert.equal(precheckReContact.allowed, true);
  assert.equal(precheckReContact.reason, "RECIPIENT_ALREADY_IN_ACTIVE_WINDOW");

  // Customer-initiated messages inside service window: always allowed
  const serviceWindowCheck = await limitEngine.canDispatch({
    tenantId: 1,
    accountId: "act_001",
    recipientPhone: "+919999999999",
    isCustomerInitiated: true
  });
  assert.equal(serviceWindowCheck.allowed, true);
  assert.equal(serviceWindowCheck.reason, "CUSTOMER_SERVICE_WINDOW");

  // Record 49 more distinct recipients (2 through 50) so total unique recipients reach 50
  for (let i = 2; i <= 50; i++) {
    await limitEngine.recordDispatch({
      tenantId: 1,
      accountId: "act_001",
      recipientPhone: `+9198000000${String(i).padStart(2, "0")}`,
      isCustomerInitiated: false
    });
  }

  // 51st unique recipient: must be BLOCKED by limit engine
  const blockedCheck = await limitEngine.canDispatch({
    tenantId: 1,
    accountId: "act_001",
    recipientPhone: "+919800000099",
    isCustomerInitiated: false
  });
  assert.equal(blockedCheck.allowed, false, "51st recipient must be blocked when limit is 50");
  assert.equal(blockedCheck.reason, "MESSAGING_LIMIT_REACHED");
  console.log("   Messaging Limits & 24h Rolling Window: PASS");

  // 5. Multi-Bucket Prepaid Wallet & Top-up Orders
  console.log("5. Testing Multi-Bucket Prepaid Wallet & Orders...");
  const balances = await walletService.getWalletBalances(1);
  assert.ok(balances.buckets.whatsapp_messaging);
  assert.ok(balances.buckets.ai_credits);
  assert.ok(balances.buckets.automation_credits);

  // Create top-up order for whatsapp_messaging
  const order = await walletService.createTopupOrder({
    tenantId: 1,
    bucket: "whatsapp_messaging",
    amountMinor: 200000, // Rs 2,000
    currency: "INR",
    paymentGateway: "razorpay"
  });
  assert.equal(order.status, "created");
  assert.equal(order.amount_minor, 200000);

  // Confirm payment
  const paymentConfirm = await walletService.confirmTopupPayment({
    tenantId: 1,
    orderId: order.order_id,
    paymentId: "pay_test_12345",
    signature: "sig_valid_hash"
  });
  assert.equal(paymentConfirm.success, true);
  assert.equal(paymentConfirm.credited_minor, 200000);

  const updatedWallet = await walletService.getWalletBalances(1);
  assert.equal(updatedWallet.buckets.whatsapp_messaging.balance_minor, 200000);
  assert.equal(updatedWallet.buckets.whatsapp_messaging.balance_formatted, "₹2000.00");

  // Auto-recharge check
  const autoRecharge = await walletService.checkAndTriggerAutoRecharge(1, {
    auto_recharge_enabled: 1,
    auto_recharge_trigger_minor: 50000,
    auto_recharge_amount_minor: 100000,
    currency: "INR"
  });
  assert.equal(autoRecharge.autoRechargeTriggered, false, "Should not trigger when balance >= trigger");
  console.log("   Multi-Bucket Wallet & Top-up: PASS");

  // 6. Tenant Isolation
  console.log("6. Testing Tenant Isolation...");
  const tenant2Profile = await billingModeService.getBillingProfile(2);
  assert.equal(tenant2Profile.billing_mode, "direct_meta", "Tenant 2 must be independently direct_meta");
  const tenant2Wallet = await walletService.getWalletBalances(2);
  assert.equal(tenant2Wallet.buckets.whatsapp_messaging.balance_minor, 0, "Tenant 2 wallet must be 0");
  console.log("   Tenant Isolation: PASS");

  console.log("\n==========================================");
  console.log("ALL 6 TEST SUITES PASSED CLEANLY!");
  console.log("==========================================\n");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
