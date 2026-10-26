"use strict";

/**
 * Quick reminder rules regression.
 *
 * These are the pure validation helpers behind chat-native reminders. The value
 * here is the contract: a reminder that is accepted must have a deliverable
 * phone number, a future schedule, non-empty copy and a repeat end date that
 * cannot sit before the first occurrence. Anything rejected here would
 * otherwise be persisted and then fail silently inside the minute dispatcher.
 *
 * No database and no transport: this test must stay runnable on a bare checkout
 * (`node tests/test_quick_reminders.js`).
 */

const assert = require("assert");
const {
  normalizePhone,
  isValidPhone,
  toSqlDateTime,
  sanitizeOptions,
  validateReminderInput,
  validateReminderPatch,
  nextOccurrence,
} = require("../services/waQuickReminderRules");

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
  }
}

function inHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

console.log("\nQuick reminder rules\n");

check("a 10-digit local number is stored with the 91 country code", () => {
  assert.strictEqual(normalizePhone("98765 43210"), "919876543210");
  assert.strictEqual(normalizePhone("+91 98765-43210"), "919876543210");
  assert.strictEqual(normalizePhone("919876543210"), "919876543210");
  assert.strictEqual(normalizePhone(""), "");
  assert.strictEqual(normalizePhone(null), "");
});

check("phone validation rejects fragments and empty values", () => {
  assert.strictEqual(isValidPhone("9876543210"), true);
  assert.strictEqual(isValidPhone("1234"), false);
  assert.strictEqual(isValidPhone(null), false);
  assert.strictEqual(isValidPhone("123456789012345678"), false);
});

check("toSqlDateTime formats local time and survives junk", () => {
  assert.strictEqual(
    toSqlDateTime(new Date(2026, 9, 25, 9, 5, 7)),
    "2026-10-25 09:05:07"
  );
  assert.strictEqual(toSqlDateTime("not-a-date"), null);
  assert.strictEqual(toSqlDateTime(null), null);
});

check("reply options are trimmed, capped at three and de-duplicated", () => {
  const options = sanitizeOptions([
    { id: "a", label: "  Confirm  " },
    { id: "a", label: "Duplicate id" },
    { label: "Second" },
    { label: "" },
    { label: "Third" },
    { label: "Fourth" },
  ]);
  assert.strictEqual(options.length, 3);
  assert.deepStrictEqual(options[0], { id: "a", label: "Confirm", action: "a" });
  assert.strictEqual(options[1].label, "Second");
  assert.ok(options[1].id);

  const tooLong = sanitizeOptions([{ label: "x".repeat(40) }]);
  assert.strictEqual(tooLong[0].label.length, 20);
});

check("a valid customer reminder is accepted and normalised", () => {
  const result = validateReminderInput({
    phone: "9876543210",
    contact_name: "Asha",
    title: "Call about invoice",
    message_text: "Hello {name}, please confirm.",
    scheduled_for: inHours(2),
    options: [{ label: "Confirm" }],
    repeat_rule: "weekly",
    repeat_until: inHours(24 * 30),
    source: "chat",
  });
  assert.strictEqual(result.ok, true, result.errors.join("; "));
  assert.strictEqual(result.value.phone, "919876543210");
  assert.strictEqual(result.value.audience, "customer");
  assert.strictEqual(result.value.repeatRule, "weekly");
  assert.strictEqual(result.value.options.length, 1);
  assert.ok(result.value.scheduledFor);
  assert.strictEqual(result.value.source, "chat");
});

check("staff reminders never carry customer reply buttons", () => {
  const result = validateReminderInput({
    phone: "9876543210",
    message_text: "Follow up internally",
    scheduled_for: inHours(1),
    audience: "staff",
    options: [{ label: "Should be dropped" }],
  });
  assert.strictEqual(result.ok, true, result.errors.join("; "));
  assert.strictEqual(result.value.audience, "staff");
  assert.deepStrictEqual(result.value.options, []);
});

check("a reminder without a phone number or message is rejected", () => {
  const noPhone = validateReminderInput({
    message_text: "hello",
    scheduled_for: inHours(1),
  });
  assert.strictEqual(noPhone.ok, false);
  assert.match(noPhone.errors.join(" "), /phone number/i);

  const noMessage = validateReminderInput({
    phone: "9876543210",
    message_text: "   ",
    scheduled_for: inHours(1),
  });
  assert.strictEqual(noMessage.ok, false);
  assert.match(noMessage.errors.join(" "), /cannot be empty/i);
});

check("a past schedule is rejected so the dispatcher never fires immediately", () => {
  const result = validateReminderInput({
    phone: "9876543210",
    message_text: "hello",
    scheduled_for: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join(" "), /future/i);
});

check("a repeat end date before the first occurrence is rejected", () => {
  const result = validateReminderInput({
    phone: "9876543210",
    message_text: "hello",
    scheduled_for: inHours(48),
    repeat_rule: "daily",
    repeat_until: inHours(24),
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join(" "), /after the first reminder/i);
});

check("patch validation only returns the fields it was given", () => {
  const patch = validateReminderPatch({ message_text: "New copy" });
  assert.strictEqual(patch.ok, true, patch.errors.join("; "));
  assert.deepStrictEqual(Object.keys(patch.value), ["message_text"]);
  assert.strictEqual(patch.value.message_text, "New copy");

  const badRepeat = validateReminderPatch({ repeat_rule: "hourly" });
  assert.strictEqual(badRepeat.ok, false);
  assert.match(badRepeat.errors.join(" "), /repeat rule/i);

  const past = validateReminderPatch({
    scheduled_for: new Date(Date.now() - 3600 * 1000).toISOString(),
  });
  assert.strictEqual(past.ok, false);
});

check("patch validation accepts the category, flow and label shown in the sheet", () => {
  const patch = validateReminderPatch({
    reminder_type: "payment_due",
    flow_id: 7,
    contact_name: "  Asha Menon  ",
    audience: "staff",
    repeat_rule: "monthly",
  });
  assert.strictEqual(patch.ok, true, patch.errors.join("; "));
  assert.strictEqual(patch.value.reminder_type, "payment_due");
  assert.strictEqual(patch.value.flow_id, 7);
  assert.strictEqual(patch.value.contact_name, "  Asha Menon  ");
  assert.strictEqual(patch.value.audience, "staff");
  assert.strictEqual(patch.value.repeat_rule, "monthly");

  assert.strictEqual(validateReminderPatch({ flow_id: null }).value.flow_id, null);
  assert.strictEqual(validateReminderPatch({ flow_id: "" }).value.flow_id, null);
  assert.strictEqual(validateReminderPatch({ reminder_type: "  " }).ok, false);
});

check("daily, weekly and monthly repeats advance from the scheduled time", () => {
  const base = new Date(2026, 9, 25, 9, 30, 0);
  assert.strictEqual(nextOccurrence(base, "daily").getDate(), 26);
  assert.strictEqual(nextOccurrence(base, "weekly").getDate(), 1);
  const monthly = nextOccurrence(base, "monthly");
  assert.strictEqual(monthly.getMonth(), 10);
  assert.strictEqual(monthly.getDate(), 25);
  assert.strictEqual(nextOccurrence(base, "none"), null);
});

check("month-end repeats clamp instead of overflowing into the next month", () => {
  const jan31 = new Date(2026, 0, 31, 10, 0, 0);
  const feb = nextOccurrence(jan31, "monthly");
  assert.strictEqual(feb.getMonth(), 1);
  assert.strictEqual(feb.getDate(), 28);
  assert.strictEqual(feb.getHours(), 10);

  const mar31 = nextOccurrence(new Date(2026, 2, 31, 10, 0, 0), "monthly");
  assert.strictEqual(mar31.getMonth(), 3);
  assert.strictEqual(mar31.getDate(), 30);
});

if (failures) {
  console.error(`\n${failures} quick reminder rule check(s) failed\n`);
  process.exit(1);
}
console.log("\nAll quick reminder rule checks passed\n");
