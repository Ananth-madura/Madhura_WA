"use strict";

/**
 * Enquiry pipeline on the SQLite engine.
 *
 * Guards the three things that were broken: an enquiry can be filed with a
 * type and a message, the row's columns self-heal on a legacy table (including
 * `created_at`/`updated_at`), and nothing crosses an organization boundary.
 *
 * Run:  node backend/tests/test_enquiry_service.js
 */

const assert = require("assert/strict");
require("./helpers/isolateSqlite")();

process.env.USE_SQLITE = "1";
// The shared verifier exports DB_ENGINE=mysql, and that wins inside
// databaseEngine.usesSqlite(). Pin the engine so this suite is always SQLite.
process.env.DB_ENGINE = "sqlite";

const db = require("../config/database");
const svc = require("../services/enquiryService");

const phone = `9197${Math.floor(10000000 + Math.random() * 90000000)}`;

(async () => {
  await db.ready;

  console.log("\nEnquiries: create, type, list, update, convert (SQLite)\n");

  const [exists] = await db.promise().query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'wa_enquiries'"
  );
  if (exists.length) {
    await db.promise().query("ALTER TABLE wa_enquiries RENAME TO wa_enquiries_test_backup");
  }

  try {
    // Legacy shape: no enquiry_type, no timestamps. `CREATE TABLE IF NOT EXISTS`
    // would leave it exactly like this, which is the bug being guarded.
    await db.promise().query(
      `CREATE TABLE wa_enquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        branch_id INTEGER DEFAULT NULL,
        name TEXT NOT NULL,
        phone TEXT DEFAULT NULL,
        email TEXT DEFAULT NULL,
        company TEXT DEFAULT NULL,
        source TEXT DEFAULT 'manual',
        message TEXT DEFAULT NULL,
        temperature TEXT DEFAULT 'new',
        status TEXT DEFAULT 'open',
        notes TEXT DEFAULT NULL,
        converted_client_id INTEGER DEFAULT NULL,
        crm_lead_id INTEGER DEFAULT NULL,
        converted_at TEXT DEFAULT NULL,
        converted_by INTEGER DEFAULT NULL,
        created_by INTEGER DEFAULT NULL
      )`
    );

    // Alias handling keeps the UI labels and API slugs compatible.
    assert.equal(svc.normaliseEnquiryType("Pricing / Quote"), "pricing");
    assert.equal(svc.normaliseEnquiryType("product-service"), "product");
    assert.equal(svc.normaliseEnquiryType("nonsense"), "general");
    assert.equal(svc.normaliseEnquiryType(""), "general");
    console.log("  ok  enquiry types normalise from labels, slugs and aliases");

    const created = await svc.create(
      1,
      {
        name: "Priya Heal Test",
        phone,
        enquiry_type: "pricing",
        message: "Needs a quote for 10 seats",
        source: "whatsapp_chat",
        branch_id: 999999,
      },
      7
    );

    assert.ok(created && created.id, "enquiry was created");
    assert.equal(created.enquiry_type, "pricing", "type is stored");
    assert.equal(created.message, "Needs a quote for 10 seats", "message is stored");
    assert.equal(Number(created.created_by), 7, "creator is stamped from the caller");
    assert.equal(created.branch_id, null, "a branch the tenant does not own is refused");
    assert.ok(created.created_at, "created_at exists on a healed table");
    assert.ok(Object.prototype.hasOwnProperty.call(created, "created_by_name"));
    console.log("  ok  legacy table healed; enquiry saved with type, message and creator");

    const mine = await svc.list(1, { search: "Priya Heal Test", enquiry_type: "pricing" });
    assert.ok(mine.enquiries.some((row) => row.id === created.id), "tenant sees its enquiry");
    assert.equal(mine.enquiries.find((row) => row.id === created.id).enquiry_type, "pricing");

    const theirs = await svc.list(2, { search: "Priya Heal Test" });
    assert.ok(!theirs.enquiries.some((row) => row.id === created.id), "other tenant cannot list it");
    assert.equal(await svc.getById(created.id, 2), null, "other tenant cannot read it");
    console.log("  ok  list + getById are tenant-scoped");

    const updated = await svc.update(created.id, 1, { enquiry_type: "support" });
    assert.equal(updated.enquiry_type, "support", "type can be changed");

    await assert.rejects(
      () => svc.update(created.id, 1, { enquiry_type: "nonsense" }),
      (err) => err.status === 400
    );
    console.log("  ok  type updates are validated");

    // Temperature qualification still creates/links a CRM lead via the bridge;
    // it is best-effort on SQLite, so only the enquiry side is asserted.
    const qualified = await svc.update(created.id, 1, { temperature: "warm" });
    assert.equal(qualified.temperature, "warm");

    const result = await svc.convert(created.id, 1, 7);
    assert.equal(result.enquiry.status, "converted", "enquiry is marked converted");
    assert.ok(result.client && result.client.id, "a CRM client exists");
    assert.equal(result.client.name, "Priya Heal Test");

    const replay = await svc.convert(created.id, 1, 7);
    assert.equal(replay.deduped, true, "converting twice links instead of duplicating");
    assert.equal(replay.client.id, result.client.id, "the same client is returned");
    console.log("  ok  convert to client is idempotent and keeps the client");

    await assert.rejects(
      () => svc.convert(created.id, 2, 2),
      (err) => err.status === 404
    );
    console.log("  ok  another tenant cannot convert the enquiry");
  } finally {
    await db.promise().query("DELETE FROM wa_enquiries WHERE phone = ?", [phone]).catch(() => {});
    await db.promise().query("DELETE FROM clients WHERE phone = ?", [phone]).catch(() => {});
    await db.promise().query("DELETE FROM telecalls WHERE phone = ?", [phone]).catch(() => {});
    await db.promise().query("DROP TABLE IF EXISTS wa_enquiries").catch(() => {});
    if (exists.length) {
      await db.promise()
        .query("ALTER TABLE wa_enquiries_test_backup RENAME TO wa_enquiries")
        .catch(() => {});
    }
  }

  console.log("\nPASS: enquiries file, scope, qualify and convert correctly\n");
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
