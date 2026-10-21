/**
 * enterpriseIsolation.test.js
 *
 * Automated verification test suite for Multi-Tenant & Multi-Branch Enterprise SaaS.
 * Tests strict fail-closed tenancy, cross-tenant isolation, branch scoping,
 * sender credentials resolution, RBAC permissions, and quota calculations.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md §16
 */

const assert = require("assert");
const db = require("../config/database");
const organizationService = require("../services/organizationService");
const metaPartnerService = require("../services/metaPartnerService");
const billingService = require("../services/billingService");
const waConfigHelper = require("../services/waConfigHelper");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

async function runTests() {
  console.log("================================================================================");
  console.log("🚀 STARTING ENTERPRISE MULTI-TENANT & MULTI-BRANCH VERIFICATION TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function report(name, fn) {
    return async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}\n`);
        failed++;
      }
    };
  }

  // ── TEST 1: Tenant 1 & Branch 1 Canonical Presence ──
  await report("Tenant 1 (Primary Org) and Branch 1 (Head Office) exist in canonical tables", async () => {
    const tenants = await q("SELECT * FROM tenants WHERE id = 1");
    assert.strictEqual(tenants.length, 1, "Tenant 1 must exist");
    assert.ok(tenants[0].name.includes("Madhura"), "Tenant 1 must be Madhura organization");

    const branches = await q("SELECT * FROM branches WHERE id = 1 AND tenant_id = 1");
    assert.strictEqual(branches.length, 1, "Branch 1 must exist for Tenant 1");
    assert.strictEqual(branches[0].is_head_office, 1, "Branch 1 must be flagged as head office");
  })();

  // ── TEST 2: Granular RBAC Permissions Seeded ──
  await report("Granular RBAC roles and permissions seeded", async () => {
    const permissions = await q("SELECT COUNT(*) as count FROM permissions");
    assert.ok(permissions[0].count >= 20, "At least 20 permissions must be registered");

    const roles = await q("SELECT code FROM roles");
    const roleCodes = roles.map((r) => r.code);
    assert.ok(roleCodes.includes("organization_owner"), "organization_owner role must exist");
    assert.ok(roleCodes.includes("organization_admin"), "organization_admin role must exist");
    assert.ok(roleCodes.includes("branch_manager"), "branch_manager role must exist");
    assert.ok(roleCodes.includes("agent"), "agent role must exist");
  })();

  // ── TEST 3: SaaS Plans and Quotas ──
  await report("Canonical SaaS plans (Free, Starter, Growth, Business, Enterprise) loaded", async () => {
    const catalog = await billingService.getPlanCatalog();
    assert.ok(catalog.length >= 5, "At least 5 plans in catalog");

    const growth = catalog.find((p) => p.id === "growth" || p.name.toLowerCase() === "growth");
    assert.ok(growth, "Growth plan must exist");
    assert.strictEqual(growth.max_branches, 3, "Growth plan has 3 branches limit");
    assert.strictEqual(growth.max_seats, 15, "Growth plan has 15 seats limit");
  })();

  // ── TEST 4: Tenant Isolation & Quota Enforcement on Create Branch ──
  let testTenant2Id = null;
  let testBranch2Id = null;
  await report("Create isolated Tenant 2 and test Branch Creation with Quota Enforcement", async () => {
    // 1. Create a dummy secondary tenant with starter quota (max_branches = 2)
    const insTenant = await q(
      `INSERT INTO tenants (name, slug, plan, max_branches, max_seats, status) VALUES ('Test Isolation Org', 'test-iso-org', 'starter', 2, 5, 'active')`
    );
    testTenant2Id = Number(insTenant.insertId || insTenant.lastID || insTenant);
    if (!testTenant2Id) {
      const row = await q("SELECT id FROM tenants WHERE slug = 'test-iso-org'");
      testTenant2Id = row[0]?.id;
    }
    assert.ok(testTenant2Id, "Test Tenant 2 created");

    // 2. Create head office branch for Tenant 2
    const b1 = await organizationService.createBranch(testTenant2Id, {
      name: "Tenant 2 Main Branch",
      code: "T2-HQ",
      isHeadOffice: true,
    });
    testBranch2Id = b1.id;
    assert.strictEqual(b1.tenant_id, testTenant2Id, "Branch tenant_id matches Tenant 2");

    // 3. Create second branch (Starter allows 2 branches)
    const b2 = await organizationService.createBranch(testTenant2Id, {
      name: "Tenant 2 Secondary Branch",
      code: "T2-BR2",
      isHeadOffice: false,
    });
    assert.ok(b2.id, "Second branch created within starter plan quota");

    // 4. Third branch must throw quota exceeded
    let quotaThrew = false;
    try {
      await organizationService.createBranch(testTenant2Id, {
        name: "Tenant 2 Exceeded Branch",
        code: "T2-BR3",
      });
    } catch (err) {
      if (err.message.includes("quota exceeded") || err.message.includes("Branch limit reached")) {
        quotaThrew = true;
      }
    }
    assert.strictEqual(quotaThrew, true, "Creating branch beyond quota must throw quota exceeded error");
  })();

  // ── TEST 5: Cross-Tenant Data Isolation (Contacts, Campaigns, Senders) ──
  const dynamicTestPhone = "9198" + Math.floor(10000000 + Math.random() * 90000000);
  await report("Cross-Tenant Data Isolation strictly enforced (No leakage between Tenant 1 and Tenant 2)", async () => {
    // 1. Insert a contact into Tenant 2
    await q(
      `INSERT INTO wa_contacts (tenant_id, branch_id, name, phone) VALUES (?, ?, 'Tenant 2 Secret Contact', ?)`,
      [testTenant2Id, testBranch2Id, dynamicTestPhone]
    );

    // 2. Query contacts strictly for Tenant 1
    const t1Contacts = await q("SELECT * FROM wa_contacts WHERE tenant_id = 1 AND phone = ?", [dynamicTestPhone]);
    assert.strictEqual(t1Contacts.length, 0, "Tenant 1 CANNOT see Tenant 2 contacts");

    // 3. Query contacts strictly for Tenant 2
    const t2Contacts = await q("SELECT * FROM wa_contacts WHERE tenant_id = ? AND phone = ?", [testTenant2Id, dynamicTestPhone]);
    assert.strictEqual(t2Contacts.length, 1, "Tenant 2 sees its own contact");

    // 4. Assert no contacts have NULL tenant_id
    const nullTenantContacts = await q("SELECT COUNT(*) as count FROM wa_contacts WHERE tenant_id IS NULL");
    assert.strictEqual(nullTenantContacts[0].count, 0, "Zero contacts can have NULL tenant_id");
  })();

  // ── TEST 6: Meta Sender Credentials Resolution (Hybrid Model) ──
  await report("Hybrid Sender Resolution: Shared vs Dedicated Branch Number", async () => {
    // 1. Register a shared sender for Tenant 2
    const s1 = await q(
      `INSERT INTO wa_senders (tenant_id, phone_number_id, display_phone, verified_name, is_shared, status)
       VALUES (?, 'PNID_SHARED_T2', '919999900002', 'T2 Shared Number', 1, 'connected')`,
      [testTenant2Id]
    );
    let sharedSenderId = Number(s1.insertId || s1.lastID || s1);
    if (!sharedSenderId) {
      const r = await q("SELECT id FROM wa_senders WHERE phone_number_id = 'PNID_SHARED_T2'");
      sharedSenderId = r[0]?.id;
    }

    // 2. Register a dedicated branch sender for Tenant 2 Branch 2
    const s2 = await q(
      `INSERT INTO wa_senders (tenant_id, phone_number_id, display_phone, verified_name, is_shared, status)
       VALUES (?, 'PNID_BRANCH_T2', '919999900003', 'T2 Branch Dedicated', 0, 'connected')`,
      [testTenant2Id]
    );
    let branchSenderId = Number(s2.insertId || s2.lastID || s2);
    if (!branchSenderId) {
      const r = await q("SELECT id FROM wa_senders WHERE phone_number_id = 'PNID_BRANCH_T2'");
      branchSenderId = r[0]?.id;
    }

    await q(
      `INSERT INTO sender_branch_assignments (tenant_id, sender_id, branch_id, is_default)
       VALUES (?, ?, ?, 1)`,
      [testTenant2Id, branchSenderId, testBranch2Id]
    );

    // 3. Resolve for Branch 2 -> must yield dedicated sender
    const credsDedicated = await metaPartnerService.resolveSenderCredentials(testTenant2Id, null, testBranch2Id);
    assert.strictEqual(credsDedicated.phone_number_id, "PNID_BRANCH_T2", "Branch 2 resolves its dedicated sender");

    // 4. Resolve without branch -> must yield shared sender
    const credsShared = await metaPartnerService.resolveSenderCredentials(testTenant2Id, null, null);
    assert.strictEqual(credsShared.phone_number_id, "PNID_SHARED_T2", "Global query resolves shared sender");
  })();

  // ── TEST 7: Append-Only Wallet Invariants & Grant Transaction ──
  await report("Wallet Ledger append-only audit invariants", async () => {
    // 1. Grant initial balance
    const wallet = await billingService.grantWalletCredits(testTenant2Id, "ai_credits", 500, "Initial test credit grant", "test_ref_01");
    assert.strictEqual(wallet.balance, 500, "Wallet balance reflects grant");

    // 2. Check entries count
    const entries = await q(
      `SELECT * FROM wallet_entries WHERE account_id = ? ORDER BY id ASC`,
      [wallet.accountId]
    );
    assert.strictEqual(entries.length, 1, "One ledger entry logged");
    assert.strictEqual(entries[0].amount, 500, "Entry amount matches grant");
    assert.strictEqual(entries[0].balance_after, 500, "Balance after matches");
  })();

  // ── TEST 8: Clean Up Test Artifacts ──
  await report("Clean up test isolation tenant", async () => {
    if (testTenant2Id) {
      await q("DELETE FROM wa_contacts WHERE tenant_id = ?", [testTenant2Id]);
      await q("DELETE FROM sender_branch_assignments WHERE tenant_id = ?", [testTenant2Id]);
      await q("DELETE FROM wa_senders WHERE tenant_id = ?", [testTenant2Id]);
      await q("DELETE FROM wallet_entries WHERE tenant_id = ?", [testTenant2Id]);
      await q("DELETE FROM wallet_accounts WHERE tenant_id = ?", [testTenant2Id]);
      await q("DELETE FROM branches WHERE tenant_id = ?", [testTenant2Id]);
      await q("DELETE FROM tenants WHERE id = ?", [testTenant2Id]);
    }
  })();

  console.log("\n================================================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
