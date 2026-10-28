"use strict";

require("./helpers/isolateSqlite")();
process.env.USE_SQLITE = "1";

const assert = require("node:assert/strict");
const db = require("../config/database");
const { createEmployeeWorkspace } = require("../services/employeeWorkspace");

const TENANT_A = 8801;
const TENANT_B = 8802;

const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];

async function setup() {
  await require("../migrations/shared_number_inbox").migrate(db);
  await q(`CREATE TABLE IF NOT EXISTS wa_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INT,
    branch_id INT,
    contact_id INT,
    crm_lead_id INT,
    converted_client_id INT,
    name VARCHAR(255),
    phone VARCHAR(40),
    email VARCHAR(255),
    message TEXT,
    temperature VARCHAR(20) DEFAULT 'new',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await require("../migrations/employee_workspace").migrate(db);

  // Setup sample users and organizations
  for (const tenant of [TENANT_A, TENANT_B]) {
    await q("INSERT OR IGNORE INTO tenants (id, name, status) VALUES (?, ?, 'active')", [tenant, `Tenant ${tenant}`]);
    await q("INSERT OR IGNORE INTO branches (id, tenant_id, name, status) VALUES (?, ?, ?, 'active')", [tenant * 10 + 1, tenant, `Branch 1`]);
    await q("INSERT OR IGNORE INTO branches (id, tenant_id, name, status) VALUES (?, ?, ?, 'active')", [tenant * 10 + 2, tenant, `Branch 2`]);

    // Admin user (1) and Agent user (2)
    const adminId = tenant * 10 + 1;
    const agentId = tenant * 10 + 2;

    await q("INSERT OR IGNORE INTO users (id, tenant_id, first_name, email, status) VALUES (?, ?, ?, ?, 'active')",
      [adminId, tenant, `Admin ${tenant}`, `admin${tenant}@test.com`]);
    await q("INSERT OR IGNORE INTO users (id, tenant_id, first_name, email, status) VALUES (?, ?, ?, ?, 'active')",
      [agentId, tenant, `Agent ${tenant}`, `agent${tenant}@test.com`]);

    await q("INSERT OR IGNORE INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, 'organization_admin', 'active')",
      [tenant, adminId]);
    await q("INSERT OR IGNORE INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, 'agent', 'active')",
      [tenant, agentId]);

    await q("INSERT OR IGNORE INTO staff_branch_memberships (tenant_id, user_id, branch_id) VALUES (?, ?, ?)",
      [tenant, agentId, tenant * 10 + 1]);
  }
}

async function runTests() {
  await setup();
  const workspace = createEmployeeWorkspace(db);

  const adminReqA = { tenantId: TENANT_A, user: { id: 88011 }, userRole: "organization_admin", waAccessLevel: "full" };
  const agentReqA = { tenantId: TENANT_A, user: { id: 88012 }, userRole: "agent", waAccessLevel: "full" };
  const agentReqB = { tenantId: TENANT_B, user: { id: 88022 }, userRole: "agent", waAccessLevel: "full" };

  console.log("▶ Test 1: Create customer & verify multi-tenant isolation");
  const custA1 = await q("INSERT INTO wa_contacts (tenant_id, name, phone, source, assigned_agent_id, branch_id, lifecycle_stage) VALUES (?, ?, ?, 'manual', ?, ?, 'lead')",
    [TENANT_A, "Acme Corp", "919876543210", 88012, 88011]);
  const custA2 = await q("INSERT INTO wa_contacts (tenant_id, name, phone, source, assigned_agent_id, branch_id, lifecycle_stage) VALUES (?, ?, ?, 'manual', ?, ?, 'client')",
    [TENANT_A, "Beta Industries", "919876543211", 88012, 88011]);

  const custB1 = await q("INSERT INTO wa_contacts (tenant_id, name, phone, source, assigned_agent_id, branch_id, lifecycle_stage) VALUES (?, ?, ?, 'manual', ?, ?, 'lead')",
    [TENANT_B, "Gamma LLC", "919876543212", 88022, 88021]);

  // Agent A should see only Tenant A customers
  const listA = await workspace.list(agentReqA);
  assert.equal(listA.customers.length, 2);
  assert.ok(listA.customers.some(c => c.name === "Acme Corp"));
  assert.ok(!listA.customers.some(c => c.name === "Gamma LLC"));

  // Agent B should see only Tenant B customer
  const listB = await workspace.list(agentReqB);
  assert.equal(listB.customers.length, 1);
  assert.equal(listB.customers[0].name, "Gamma LLC");
  console.log("  ✔ Tenant customer isolation passed");

  console.log("▶ Test 2: Global Tasks CRUD with priorities, due dates & status completion");
  const task1 = await workspace.createTaskGlobal(agentReqA, {
    contact_id: custA1.insertId,
    title: "Send pricing proposal",
    due_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour overdue
    priority: "urgent",
    description: "Prepare standard SaaS contract"
  });
  assert.ok(task1.id > 0);

  const task2 = await workspace.createTaskGlobal(agentReqA, {
    contact_id: custA2.insertId,
    title: "Annual account review",
    due_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
    priority: "normal",
    description: "Check satisfaction metrics"
  });
  assert.ok(task2.id > 0);

  // List tasks
  const tasksList = await workspace.listTasks(agentReqA, { status: "open" });
  assert.equal(tasksList.tasks.length, 2);
  assert.equal(tasksList.tasks[0].priority, "urgent");

  // Complete task1
  await workspace.updateTaskGlobal(agentReqA, task1.id, { status: "completed" });
  const [completedTask] = await q("SELECT status, completed_by, completed_at FROM wa_customer_tasks WHERE id=?", [task1.id]);
  assert.equal(completedTask.status, "completed");
  assert.equal(completedTask.completed_by, 88012);
  assert.ok(completedTask.completed_at);
  console.log("  ✔ Global Tasks CRUD and completion tracking passed");

  console.log("▶ Test 3: Global Deals CRUD with stages & pipeline value calculation");
  const deal1 = await workspace.createDealGlobal(agentReqA, {
    contact_id: custA1.insertId,
    title: "Enterprise Annual License",
    amount: 150000,
    stage: "proposal",
    notes: "Negotiating discount"
  });
  assert.ok(deal1.id > 0);

  const deal2 = await workspace.createDealGlobal(agentReqA, {
    contact_id: custA2.insertId,
    title: "Support Tier Addon",
    amount: 50000,
    stage: "won",
    notes: "Payment received"
  });
  assert.ok(deal2.id > 0);

  const dealsList = await workspace.listDealsGlobal(agentReqA);
  assert.equal(dealsList.deals.length, 2);
  assert.equal(dealsList.totalPipelineValue, 150000);
  assert.equal(dealsList.totalWonValue, 50000);

  // Update deal1 stage to won
  await workspace.updateDealGlobal(agentReqA, deal1.id, { stage: "won" });
  const dealsListAfter = await workspace.listDealsGlobal(agentReqA);
  assert.equal(dealsListAfter.totalPipelineValue, 0);
  assert.equal(dealsListAfter.totalWonValue, 200000);
  console.log("  ✔ Global Deals pipeline tracking passed");

  console.log("▶ Test 4: Global Leads temperature updates");
  const enquiry1 = await q("INSERT INTO wa_enquiries (tenant_id, contact_id, name, phone, email, message, temperature, created_by) VALUES (?, ?, ?, ?, ?, ?, 'warm', ?)",
    [TENANT_A, custA1.insertId, "Acme Contact", "919876543210", "acme@test.com", "Interested in 50 seats", 88012]);
  
  const leadsList = await workspace.listLeadsGlobal(agentReqA);
  assert.equal(leadsList.leads.length, 1);
  assert.equal(leadsList.leads[0].temperature, "warm");

  await workspace.updateLeadGlobal(agentReqA, enquiry1.insertId, { temperature: "hot" });
  const [updatedLead] = await q("SELECT temperature FROM wa_enquiries WHERE id=?", [enquiry1.insertId]);
  assert.equal(updatedLead.temperature, "hot");
  console.log("  ✔ Global Leads pipeline temperature updates passed");

  console.log("▶ Test 5: Operational Analytics with dynamic Alerts & Stage Breakdown");
  const analytics = await workspace.analytics(agentReqA);
  assert.equal(analytics.customers, 2);
  assert.equal(analytics.clients, 1);
  assert.equal(analytics.deals, 2);
  assert.equal(analytics.won_deals, 2);
  assert.equal(analytics.temperature_counts.hot, 1);
  assert.ok(Array.isArray(analytics.alerts));
  console.log("  ✔ Analytics calculations and dynamic alerts passed");

  console.log("▶ Test 6: Global Cross-Module Search");
  const searchResults = await workspace.globalSearch(agentReqA, "Acme");
  assert.equal(searchResults.customers.length, 1);
  assert.equal(searchResults.customers[0].name, "Acme Corp");
  assert.equal(searchResults.leads.length, 1);
  console.log("  ✔ Cross-module search passed");

  console.log("▶ Test 7: Workspace Preferences persistence");
  const initialPrefs = await workspace.getPreferences(agentReqA);
  assert.ok(initialPrefs.visibleWidgets);

  await workspace.savePreferences(agentReqA, {
    visibleWidgets: ["customers", "deals", "tasks"],
    defaultView: "my_day",
    density: "compact"
  });

  const savedPrefs = await workspace.getPreferences(agentReqA);
  assert.equal(savedPrefs.defaultView, "my_day");
  assert.equal(savedPrefs.density, "compact");
  assert.deepEqual(savedPrefs.visibleWidgets, ["customers", "deals", "tasks"]);
  console.log("  ✔ Preferences persistence passed");

  console.log("\n✨ ALL UNIFIED WORKSPACE BACKEND TESTS PASSED SUCCESSFULLY! ✨");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
