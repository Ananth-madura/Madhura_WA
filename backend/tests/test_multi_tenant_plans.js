const assert = require("assert/strict");
const path = require("path");

process.env.USE_SQLITE = "1";
process.env.JWT_SECRET = "test-secret-multi-tenant-crm-plans-2026-auth";

const tenantPlanService = require("../services/tenantPlanService");

async function runTests() {
  console.log("Running Multi-Tenant & Subscription Plans Test Suite...");

  // 1. Verify Plans definition
  const plans = tenantPlanService.getAvailablePlans();
  assert(Array.isArray(plans), "Plans should be an array");
  assert(plans.length >= 4, "Should have at least 4 plans (Free, Starter, Growth, Enterprise)");

  const planIds = plans.map((p) => p.id);
  assert(planIds.includes("free"), "Must include Free plan");
  assert(planIds.includes("starter"), "Must include Starter plan");
  assert(planIds.includes("growth"), "Must include Growth plan");
  assert(planIds.includes("enterprise"), "Must include Enterprise plan");

  // 2. Check Plan details and limits
  const freePlan = tenantPlanService.getPlan("free");
  assert.equal(freePlan.maxSenders, 1, "Free plan should allow 1 sender");
  assert.equal(freePlan.maxMonthlyMessages, 500, "Free plan should allow 500 messages");

  const growthPlan = tenantPlanService.getPlan("growth");
  assert.equal(growthPlan.maxSenders, 10, "Growth plan should allow 10 senders");
  assert.equal(growthPlan.aiReplies, true, "Growth plan should have AI replies enabled");

  // 3. Ensure Table & Default Tenant creation
  await tenantPlanService.ensureTenantsTable();
  const defaultTenant = await tenantPlanService.getTenantById(1);
  assert(defaultTenant, "Default tenant #1 must exist");
  assert.equal(defaultTenant.id, 1);
  assert(defaultTenant.planMeta, "Default tenant must have planMeta");

  // 4. Test Tenant Creation (Self-Signup Simulation)
  const newTenant = await tenantPlanService.createTenant({
    name: "Acme Global Retail",
    plan: "growth",
  });

  assert(newTenant.id, "Created tenant must have an ID");
  assert.equal(newTenant.name, "Acme Global Retail");
  assert.equal(newTenant.plan, "growth");
  assert.equal(newTenant.max_senders, 10);
  assert.equal(newTenant.max_monthly_messages, 25000);

  // 5. Test Switching / Upgrading Plan
  const upgradedTenant = await tenantPlanService.switchTenantPlan(newTenant.id, "enterprise");
  assert.equal(upgradedTenant.plan, "enterprise");
  assert.equal(upgradedTenant.max_senders, 50);
  assert.equal(upgradedTenant.max_monthly_messages, 100000);

  // 6. Test Tenant Usage Query
  const usage = await tenantPlanService.getTenantUsage(newTenant.id);
  assert(usage.tenant, "Usage response must contain tenant");
  assert(typeof usage.usage.sendersUsed === "number", "sendersUsed must be numeric");
  assert.equal(usage.usage.sendersLimit, 50, "Limit should match upgraded plan");

  console.log("PASS: Multi-tenant database schemas, plans catalog, self-signup creation, and upgrade workflows verified!");
}

runTests().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
