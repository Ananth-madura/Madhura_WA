"use strict";

/**
 * Regression tests for the second layer of duplicate protection: the guards that
 * sit above the send path.
 *
 *   1. checkBlastSize   — bulk-send caps (the "everyone got my message" guard)
 *   2. triggerAutomation— the (trigger, contact) dedupe claim
 *
 * Run:  node backend/tests/test_wa_blast_and_automation_dedupe.js
 */

const assert = require("assert");
const { checkBlastSize, SOFT_CAP, HARD_CAP } = require("../services/waBlastGuard");

const results = [];
function pass(name) {
  results.push(name);
  console.log(`  ✅ PASS: ${name}`);
}

async function testBlastGuard() {
  console.log("\n── Bulk-send blast guard ──");

  const soft = SOFT_CAP();
  const hard = HARD_CAP();

  // Under the soft cap: always allowed, no confirmation needed.
  assert.strictEqual(checkBlastSize(1, undefined), null, "1 recipient needs no confirmation");
  assert.strictEqual(checkBlastSize(soft, undefined), null, "exactly the soft cap is allowed");
  pass("sends at or below the soft cap proceed without confirmation");

  // Above the soft cap: must be acknowledged with the exact count.
  const over = soft + 1;
  assert.ok(checkBlastSize(over, undefined), "above soft cap without confirm_count must be refused");
  assert.ok(checkBlastSize(over, over - 1), "a wrong confirm_count must be refused");
  assert.ok(checkBlastSize(over, over + 1), "an inflated confirm_count must be refused");
  assert.strictEqual(checkBlastSize(over, over), null, "the exact count must be accepted");
  assert.strictEqual(checkBlastSize(over, String(over)), null, "a numeric string count must be accepted");
  pass("above the soft cap the exact recipient count must be echoed back");

  // Hard cap: refused outright, confirmation or not.
  assert.ok(checkBlastSize(hard + 1, hard + 1), "above the hard cap is refused even when confirmed");
  assert.ok(checkBlastSize(hard + 1, undefined), "above the hard cap is refused when unconfirmed");
  assert.strictEqual(checkBlastSize(hard, hard), null, "exactly the hard cap is still allowed");
  pass("the hard cap is never exceeded, confirmed or not");

  // The error text must state the number, so an operator can see what happened.
  const msg = checkBlastSize(over, undefined);
  assert.ok(msg.includes(String(over)), "the error must state the recipient count");
  assert.ok(msg.includes("confirm_count"), "the error must say how to proceed");
  pass("the rejection message states the count and the way forward");
}

async function testAutomationDedupe() {
  console.log("\n── triggerAutomation dedupe claim ──");

  // The claim is module-private, and triggerAutomation deliberately RELEASES it
  // when no active rule matches (so a rule created a moment later can still
  // fire). That makes it unobservable through the public entry point without a
  // live rule in the database, so it is tested directly.
  const {
    claimAutomationDedupe,
    AUTOMATION_DEDUPE_TTL_MS,
    triggerAutomation,
  } = require("../services/waAutomationService");

  // 1. First claim wins, the immediate repeat is refused.
  assert.strictEqual(claimAutomationDedupe("t:first"), true, "first claim must be granted");
  assert.strictEqual(claimAutomationDedupe("t:first"), false, "an immediate repeat must be refused");
  pass("a repeated claim on the same key is refused");

  // 2. Distinct keys are independent.
  assert.strictEqual(claimAutomationDedupe("t:second"), true, "a different key must be granted");
  pass("distinct keys do not block each other");

  // 3. The TTL is sane: short enough that a real later event still fires,
  //    long enough to absorb one event fanning in from several subsystems.
  assert.ok(
    AUTOMATION_DEDUPE_TTL_MS >= 60 * 1000,
    "the window must absorb same-event fan-in (>= 1 minute)"
  );
  assert.ok(
    AUTOMATION_DEDUPE_TTL_MS <= 60 * 60 * 1000,
    "the window must not swallow a genuinely separate event later (<= 1 hour)"
  );
  pass("the dedupe window is between 1 minute and 1 hour");

  // 4. An expired claim is re-granted. Simulate expiry rather than waiting.
  const clock = Date.now;
  const realNow = Date.now();
  try {
    // Rewind "now" past the TTL, then confirm the key frees up.
    Date.now = () => realNow + AUTOMATION_DEDUPE_TTL_MS + 1000;
    assert.strictEqual(
      claimAutomationDedupe("t:first"),
      true,
      "an expired claim must be granted again"
    );
  } finally {
    Date.now = clock;
  }
  pass("an expired claim is granted again");

  // 5. Contact identity: the derived key uses the last 10 digits, so the same
  //    person written two ways collides.
  const { cleanPhoneNumber } = require("../services/waAutomationService");
  const withCc = cleanPhoneNumber("919876543210");
  const local = cleanPhoneNumber("9876543210");
  assert.strictEqual(
    String(withCc).slice(-10),
    String(local).slice(-10),
    "both formats must normalise to the same last 10 digits"
  );
  pass("phone formats that denote the same person normalise together");

  // 6. End-to-end through the public entry point: a repeated trigger with no
  //    matching rule must still report no_active_rules (and release the claim),
  //    never crash and never claim to have sent anything.
  const a = await triggerAutomation("__dedupe_probe_a__", { phone: "919000000001" });
  const b = await triggerAutomation("__dedupe_probe_a__", { phone: "919000000001" });
  assert.strictEqual(a.reason, "no_active_rules", "baseline: no rule matches");
  assert.strictEqual(
    b.reason,
    "no_active_rules",
    "with no rule the claim is released, so a repeat is re-evaluated harmlessly"
  );
  assert.ok(!a.count && !b.count, "neither call may report sending anything");
  pass("a no-rule trigger is safely re-evaluated and never reports a send");

  // 7. An invalid phone is rejected before any claim is taken.
  const invalid = await triggerAutomation("__dedupe_probe_f__", { phone: "not-a-phone" });
  assert.strictEqual(invalid.reason, "invalid_phone", "an invalid phone is rejected up front");
  pass("an invalid phone is rejected before the dedupe claim");
}

async function main() {
  console.log("=================================================");
  console.log("🧪 TESTING BLAST GUARD & AUTOMATION DEDUPE");
  console.log("=================================================");

  await testBlastGuard();
  await testAutomationDedupe();

  console.log("\n=================================================");
  console.log(`🏁 ALL ${results.length} TESTS PASSED!`);
  console.log("=================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err && err.message ? err.message : err);
  process.exit(1);
});