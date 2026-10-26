"use strict";

/**
 * Reminder schema self-healing.
 *
 * The reported failure was `Unknown column 'updated_at' in 'field list'`:
 * `CREATE TABLE IF NOT EXISTS` does not add columns to a table that already
 * exists, so a restored/older database was missing `created_at`/`updated_at`
 * (and the newer chat-native columns) while the code happily wrote them.
 *
 * This suite rebuilds exactly that legacy table and proves the lazy guard adds
 * the columns back before any reminder query runs.
 *
 * Run:  node backend/tests/test_reminder_schema_heal.js
 */

const assert = require("assert/strict");
require("./helpers/isolateSqlite")();

process.env.USE_SQLITE = "1";
// The shared verifier exports DB_ENGINE=mysql, and that wins inside
// databaseEngine.usesSqlite(). Pin the engine so this suite is always SQLite.
process.env.DB_ENGINE = "sqlite";

const db = require("../config/database");
const service = require("../services/waQuickReminderService");

(async () => {
  await db.ready;

  console.log("\nReminder schema self-heal (SQLite)\n");

  await db.promise().query(
    "ALTER TABLE wa_interactive_reminders RENAME TO wa_interactive_reminders_heal_backup"
  );

  try {
    // Legacy shape: no timestamps, no tenancy, none of the chat-native columns.
    await db.promise().query(
      `CREATE TABLE wa_interactive_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        reminder_type TEXT NOT NULL,
        title TEXT NOT NULL,
        message_text TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        scheduled_for TEXT DEFAULT NULL
      )`
    );

    await service.ensureReminderSchema();

    const [columns] = await db.promise().query("PRAGMA table_info(wa_interactive_reminders)");
    const names = new Set(columns.map((column) => String(column.name).toLowerCase()));
    for (const required of [
      "created_at",
      "updated_at",
      "tenant_id",
      "audience",
      "repeat_rule",
      "options_payload",
      "assigned_user_id",
    ]) {
      assert.ok(names.has(required), `schema guard added ${required}`);
    }

    // The exact statement that used to blow up.
    const [insert] = await db.promise().query(
      "INSERT INTO wa_interactive_reminders (phone, reminder_type, title, message_text, tenant_id) VALUES (?, ?, ?, ?, ?)",
      ["919000000001", "custom_reminder", "Heal check", "Updated at must exist", 1]
    );
    await db.promise().query(
      "UPDATE wa_interactive_reminders SET status = 'cancelled', updated_at = ? WHERE id = ? AND tenant_id = ?",
      ["2026-01-01 00:00:00", insert.insertId, 1]
    );
    const [rows] = await db.promise().query(
      "SELECT status, updated_at FROM wa_interactive_reminders WHERE id = ?",
      [insert.insertId]
    );
    assert.equal(rows[0].status, "cancelled");
    assert.equal(rows[0].updated_at, "2026-01-01 00:00:00");

    console.log("  ok  legacy reminder table gains timestamps and tenancy columns");
    console.log("  ok  UPDATE ... updated_at succeeds after the guard runs");
  } finally {
    await db.promise().query("DROP TABLE IF EXISTS wa_interactive_reminders").catch(() => {});
    await db.promise()
      .query("ALTER TABLE wa_interactive_reminders_heal_backup RENAME TO wa_interactive_reminders")
      .catch(() => {});
  }

  console.log("\nPASS: reminder schema heals itself instead of failing on unknown columns\n");
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
