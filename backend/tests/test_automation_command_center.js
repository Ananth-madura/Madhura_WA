"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

async function runTests() {
  console.log("▶ [Test Suite] WhatsApp Automation Command Center Integration Tests");

  // ── 1. Condition Engine Tests (Nested Groups, All Operators & Diagnostics) ──
  console.log("  [1/4] Testing Condition Engine (Nested AND/OR, Diagnostics, Operators)...");
  const { matchesConditions, evaluateConditionsWithDiagnostics, normalizeConditions } = require("../services/waRuleConditions");

  // Flat condition
  const flatRule = {
    match: "all",
    rules: [
      { field: "amount", operator: "gt", value: 5000 },
      { field: "invoice_status", operator: "equals", value: "unpaid" },
    ],
  };

  assert.equal(matchesConditions(flatRule, { amount: 7500, invoice_status: "unpaid" }), true);
  assert.equal(matchesConditions(flatRule, { amount: 3500, invoice_status: "unpaid" }), false);
  assert.equal(matchesConditions(flatRule, { amount: 7500, invoice_status: "paid" }), false);

  // Nested condition: (amount > 10000) OR (vip = 'yes' AND city contains 'mumbai')
  const nestedRule = {
    match: "any",
    rules: [
      { field: "amount", operator: "gt", value: 10000 },
      {
        match: "all",
        rules: [
          { field: "vip", operator: "equals", value: "yes" },
          { field: "city", operator: "contains", value: "mumbai" },
        ],
      },
    ],
  };

  assert.equal(matchesConditions(nestedRule, { amount: 15000, vip: "no", city: "Delhi" }), true);
  assert.equal(matchesConditions(nestedRule, { amount: 2000, vip: "yes", city: "Navi Mumbai" }), true);
  assert.equal(matchesConditions(nestedRule, { amount: 2000, vip: "no", city: "Navi Mumbai" }), false);

  // Operators: is_empty, is_not_empty, not_contains, date_before, date_after
  assert.equal(
    matchesConditions(
      { match: "all", rules: [{ field: "notes", operator: "is_empty" }] },
      { notes: "" }
    ),
    true
  );
  assert.equal(
    matchesConditions(
      { match: "all", rules: [{ field: "service", operator: "not_contains", value: "hvac" }] },
      { service: "Plumbing Maintenance" }
    ),
    true
  );
  assert.equal(
    matchesConditions(
      { match: "all", rules: [{ field: "due_date", operator: "date_before", value: "2026-12-31" }] },
      { due_date: "2026-06-15" }
    ),
    true
  );

  // Diagnostics evaluation test
  const diagResult = evaluateConditionsWithDiagnostics(flatRule, { amount: 3000, invoice_status: "unpaid" });
  assert.equal(diagResult.matched, false);
  assert.equal(diagResult.diagnostics.length, 2);
  assert.equal(diagResult.diagnostics[0].passed, false);
  assert.equal(diagResult.diagnostics[1].passed, true);
  console.log("  ✔ Condition Engine passed all tests.");

  // ── 2. Automation Store Pipeline & Schedule Normalization ──
  console.log("  [2/4] Testing Pipeline & Schedule Normalization in Store...");
  const { normalize, normalizeActions, normalizeSchedule, TRIGGERS } = require("../services/automationStore");

  assert(TRIGGERS.includes("invoice_created"));
  assert(TRIGGERS.includes("appointment_booked"));
  assert(TRIGGERS.includes("lead_qualified"));

  const validActions = [
    { type: "send_message", params: { text: "Hello {name}" } },
    { type: "send_bill", params: { caption: "Here is your invoice" } },
    { type: "ask_question", params: { question_text: "What service?", options: ["A", "B"] } },
  ];
  const normalizedActions = JSON.parse(normalizeActions(validActions));
  assert.equal(normalizedActions.length, 3);
  assert.equal(normalizedActions[1].type, "send_bill");

  const normalizedSchedule = JSON.parse(
    normalizeSchedule({
      reminder_type: "relative",
      delay_value: 2,
      delay_unit: "days",
      cancel_on_event: "invoice_paid",
    })
  );
  assert.equal(normalizedSchedule.cancel_on_event, "invoice_paid");
  assert.equal(normalizedSchedule.delay_value, 2);

  const fullRule = normalize({
    name: "Enterprise Multi-Action Pipeline",
    trigger_type: "invoice_created",
    category: "billing",
    actions_json: JSON.stringify(validActions),
    schedule_json: JSON.stringify(normalizedSchedule),
    is_active: 1,
  });
  assert.equal(fullRule.category, "billing");
  assert.equal(fullRule.name, "Enterprise Multi-Action Pipeline");
  console.log("  ✔ Automation Store Normalization passed.");

  // ── 3. Conversational Checkpoint Service Tests ──
  console.log("  [3/4] Testing Conversational Checkpoint Service...");
  const { validateAndFormatAnswer } = require("../services/waAutomationCheckpointService");

  assert.deepEqual(validateAndFormatAnswer(" 4500 ", "number"), { valid: true, value: 4500 });
  assert.equal(validateAndFormatAnswer("not_a_number", "number").valid, false);
  assert.deepEqual(validateAndFormatAnswer("test@madhuratech.com", "email"), {
    valid: true,
    value: "test@madhuratech.com",
  });
  assert.equal(validateAndFormatAnswer("invalid-email", "email").valid, false);
  assert.deepEqual(validateAndFormatAnswer("2026-11-15", "date"), { valid: true, value: "2026-11-15" });
  assert.deepEqual(validateAndFormatAnswer("1. Confirm", "button"), { valid: true, value: "1. Confirm" });
  console.log("  ✔ Conversational Checkpoint validation passed.");

  // ── 4. Industry Starters Verification ──
  console.log("  [4/4] Testing Industry Blueprints Library...");
  const starters = require("../services/automationStarters");
  assert(Array.isArray(starters));
  assert(starters.length >= 8, "Expected at least 8 starter blueprints");

  for (const s of starters) {
    assert(s.name, "Starter missing name");
    assert(s.trigger_type, "Starter missing trigger_type");
    assert(s.message_text, "Starter missing message_text");
    if (s.actions_json) {
      const parsed = JSON.parse(s.actions_json);
      assert(Array.isArray(parsed), "Starter actions_json must be an array");
    }
  }
  console.log(`  ✔ Verified ${starters.length} industry automation blueprints.`);

  console.log("\n🎉 ALL AUTOMATION COMMAND CENTER INTEGRATION TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failure:", err);
  process.exit(1);
});
