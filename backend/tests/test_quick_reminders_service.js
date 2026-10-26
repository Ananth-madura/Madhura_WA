"use strict";

/**
 * Chat-native reminder lifecycle, end to end on the SQLite engine.
 *
 * The failure this guards against is not a crash: it is a reminder that looks
 * saved in the UI but never dispatches, or one organization editing another
 * organization's follow-up. So the assertions are about observable state -
 * the row exists, the other tenant cannot see it, cancelling stops the
 * dispatcher, and a repeat actually queues the next occurrence.
 *
 * Staff reminders are used for the dispatch assertions on purpose: their
 * delivery path is an in-app notification, not a WhatsApp send, so the suite
 * never needs a live sender or network access.
 *
 * Run:  node backend/tests/test_quick_reminders_service.js
 */

const assert = require("assert/strict");
require("./helpers/isolateSqlite")();

process.env.USE_SQLITE = "1";
// The shared verifier exports DB_ENGINE=mysql, and that wins inside
// databaseEngine.usesSqlite(). Pin the engine so this suite is always SQLite.
process.env.DB_ENGINE = "sqlite";

const db = require("../config/database");
const service = require("../services/waQuickReminderService");

const phone = `9195${Math.floor(10000000 + Math.random() * 90000000)}`;
const scope1 = { tenantId: 1, branchId: null, userId: 1 };
const scope2 = { tenantId: 2, branchId: null, userId: 2 };

const inHours = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const toSql = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const rowsForPhone = async () =>
  (
    await db.promise().query("SELECT * FROM wa_interactive_reminders WHERE phone = ? ORDER BY id", [phone])
  )[0];

let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
  }
}

(async () => {
  await db.ready;

  console.log("\nChat-native reminders (SQLite)\n");

  let customerReminder = null;
  let staffReminder = null;

  await step("a customer reminder is scheduled with its reply buttons", async () => {
    customerReminder = await service.createReminder(
      {
        phone,
        contact_name: "Asha",
        reminder_type: "appointment_reminder",
        title: "Visit confirmation",
        message_text: "Hello {name}, please confirm your visit.",
        scheduled_for: inHours(2),
        options: [
          { id: "btn_confirm", label: "Confirm", action: "confirm_appointment" },
          { id: "btn_cancel", label: "Cancel", action: "cancel_appointment" },
        ],
        repeat_rule: "weekly",
        source: "chat",
      },
      scope1
    );

    assert.ok(customerReminder?.id, "the reminder has an id");
    assert.equal(customerReminder.status, "pending");
    assert.equal(customerReminder.audience, "customer");
    assert.equal(customerReminder.repeat_rule, "weekly");
    assert.equal(customerReminder.options.length, 2);
    assert.equal(Number(customerReminder.tenant_id), 1);
    assert.equal(customerReminder.source, "chat");
  });

  await step("the conversation list sees it, another organization does not", async () => {
    const mine = await service.listForChat({ tenantId: 1, phone });
    assert.equal(mine.length, 1, "tenant 1 lists its own reminder");

    const theirs = await service.listForChat({ tenantId: 2, phone });
    assert.equal(theirs.length, 0, "tenant 2 sees nothing for the same number");
  });

  await step("rescheduling and editing a pending reminder persists", async () => {
    const updated = await service.updateReminder(
      customerReminder.id,
      { scheduled_for: inHours(5), message_text: "Updated copy {name}" },
      scope1
    );
    assert.equal(updated.message_text, "Updated copy {name}");
    assert.ok(updated.scheduled_for, "a schedule is stored");

    const stored = (await rowsForPhone()).find((r) => r.id === customerReminder.id);
    assert.equal(stored.message_text, "Updated copy {name}");
  });

  await step("editing another organization's reminder is a 404", async () => {
    await assert.rejects(
      () => service.updateReminder(customerReminder.id, { message_text: "hijack" }, scope2),
      (err) => err.status === 404
    );
  });

  await step("a past schedule cannot be saved through the edit path", async () => {
    await assert.rejects(
      () =>
        service.updateReminder(
          customerReminder.id,
          { scheduled_for: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
          scope1
        ),
      (err) => err.status === 400
    );
  });

  await step("category and flow changes survive an edit", async () => {
    const updated = await service.updateReminder(
      customerReminder.id,
      { reminder_type: "payment_due", flow_id: 3 },
      scope1
    );
    assert.equal(updated.reminder_type, "payment_due");
    assert.equal(Number(updated.flow_id), 3);
  });

  await step("cancelling stops it being pending and blocks further edits", async () => {
    const cancelled = await service.cancelReminder(customerReminder.id, scope1);
    assert.equal(cancelled.status, "cancelled");

    const list = await service.listForChat({ tenantId: 1, phone });
    assert.equal(list.length, 0, "a cancelled reminder leaves the upcoming list");

    await assert.rejects(
      () => service.updateReminder(customerReminder.id, { message_text: "later" }, scope1),
      (err) => err.status === 409
    );
  });

  await step("a staff reminder dispatches without a WhatsApp send and marks sent", async () => {
    staffReminder = await service.createReminder(
      {
        phone,
        contact_name: "Asha",
        reminder_type: "custom_reminder",
        title: "Internal follow-up",
        message_text: "Ask accounts about the pending invoice.",
        scheduled_for: inHours(1),
        audience: "staff",
        options: [{ label: "Should be dropped" }],
        source: "chat",
      },
      scope1
    );
    assert.equal(staffReminder.audience, "staff");
    assert.equal(staffReminder.options.length, 0, "staff reminders carry no customer buttons");

    const { result, reminder } = await service.sendNow(staffReminder.id, scope1);
    assert.equal(result.success, true, result.error || "dispatch succeeded");
    assert.equal(reminder.status, "sent");
    assert.ok(reminder.sent_at, "sent_at is stamped");
  });

  await step("sending the same reminder twice is refused, not duplicated", async () => {
    await assert.rejects(
      () => service.sendNow(staffReminder.id, scope1),
      (err) => err.status === 409
    );
  });

  await step("a repeat queues the next occurrence after a successful send", async () => {
    const repeating = await service.createReminder(
      {
        phone,
        contact_name: "Asha",
        reminder_type: "custom_reminder",
        title: "Daily check-in",
        message_text: "Check the delivery status.",
        scheduled_for: inHours(1),
        audience: "staff",
        repeat_rule: "daily",
        source: "chat",
      },
      scope1
    );

    // Pretend it came due while the worker was busy.
    const pastSql = toSql(new Date(Date.now() - 60 * 1000));
    await db.promise().query("UPDATE wa_interactive_reminders SET scheduled_for = ? WHERE id = ?", [
      pastSql,
      repeating.id,
    ]);

    const { result } = await service.sendNow(repeating.id, scope1);
    assert.equal(result.success, true, result.error || "dispatch succeeded");

    const all = await rowsForPhone();
    const clone = all.find((row) => Number(row.parent_id) === Number(repeating.id));
    assert.ok(clone, "a next occurrence was created");
    assert.equal(clone.status, "pending");
    assert.equal(clone.repeat_rule, "daily");
    assert.equal(clone.audience, "staff");
    const cloneDate =
      clone.scheduled_for instanceof Date
        ? clone.scheduled_for
        : new Date(String(clone.scheduled_for).replace(" ", "T"));
    assert.ok(
      cloneDate.getTime() > Date.now(),
      `the clone is scheduled in the future, not replayed in the past (got ${clone.scheduled_for})`
    );
  });

  await step("the due dispatcher sends a due pending reminder exactly once", async () => {
    // Do not sweep unrelated rows from a developer's local database.
    const [others] = await db.promise().query(
      "SELECT COUNT(*) AS c FROM wa_interactive_reminders WHERE status = 'pending' AND scheduled_for IS NOT NULL AND scheduled_for <= NOW() AND phone <> ?",
      [phone]
    );
    if (Number(others[0].c) > 0) {
      console.log(`       (skipped: ${others[0].c} unrelated due reminder(s) in this database)`);
      return;
    }

    const due = await service.createReminder(
      {
        phone,
        contact_name: "Asha",
        reminder_type: "custom_reminder",
        title: "Due now",
        message_text: "Call back today.",
        scheduled_for: inHours(1),
        audience: "staff",
        source: "chat",
      },
      scope1
    );
    await db.promise().query(
      "UPDATE wa_interactive_reminders SET scheduled_for = ? WHERE id = ?",
      [toSql(new Date(Date.now() - 60 * 1000)), due.id]
    );

    const first = await service.runDueReminderCheck();
    assert.ok(first.sent >= 1, `dispatcher sent at least one (sent=${first.sent})`);

    const second = await service.runDueReminderCheck();
    assert.equal(second.sent, 0, "the same row is not dispatched twice");

    const stored = (await rowsForPhone()).find((row) => row.id === due.id);
    assert.equal(stored.status, "sent");
  });

  await db.promise().query("DELETE FROM wa_interactive_reminders WHERE phone = ?", [phone]).catch(() => {});

  if (failures) {
    console.error(`\n${failures} reminder lifecycle check(s) failed\n`);
    process.exit(1);
  }
  console.log("\nPASS: chat-native reminders create, scope, edit, cancel, dispatch and repeat\n");
  process.exit(0);
})().catch(async (err) => {
  console.error(err);
  await db.promise().query("DELETE FROM wa_interactive_reminders WHERE phone = ?", [phone]).catch(() => {});
  process.exit(1);
});
