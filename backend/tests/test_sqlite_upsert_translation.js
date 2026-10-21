"use strict";

/**
 * Engine regression: a MySQL-style upsert must actually do something, and
 * phone uniqueness must be scoped to the organization.
 *
 * Two defects that only ever surfaced on the SQLite/R2 engine:
 *
 *   1. `ON DUPLICATE KEY UPDATE` was translated to `ON CONFLICT DO UPDATE`
 *      with no conflict target, which SQLite rejects outright. Almost every
 *      call site wraps those writes in `.catch(() => {})`, so inbound contacts
 *      and message rows were silently never written - a data-loss bug with no
 *      error anywhere.
 *
 *   2. `wa_contacts.phone` was declared globally UNIQUE, so the first
 *      organization to touch a number owned it forever: the next
 *      organization's inbound message for that same person could not create a
 *      contact at all, and an opt-out taken by one business suppressed a
 *      different business.
 *
 * Runs against the real bootstrap (db.ready), because that is where the
 * schema and the enterprise migration are applied - a test that reached past
 * it to the raw adapter would assert against a table the server never has.
 *
 * Run:  node backend/tests/test_sqlite_upsert_translation.js
 */

const assert = require("assert/strict");

process.env.USE_SQLITE = "1";
// This suite asserts that upserts reach the database at all. The privacy layer
// (services/waChatPrivacy.js) deliberately NULLs message text columns unless
// chat storage is enabled, and it is covered by test_wa_privacy_and_receipts.js
// - leaving it on here would assert the redaction instead of the upsert.
process.env.WA_SERVER_CHAT_STORAGE = "1";

const db = require("../config/database");

// Scratch numbers in a private block so this suite cannot collide with the
// seed data or with another suite's fixtures.
const sharedPhone = `93${Math.floor(10000000 + Math.random() * 90000000)}`;
const secondPhone = `94${Math.floor(10000000 + Math.random() * 90000000)}`;

const upsertLegacy = (phone, text) =>
  db.promise().query(
    `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
     VALUES (?, ?, '91', 'WhatsApp Chat', 1, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       last_message_text = VALUES(last_message_text),
       last_message_at = NOW()`,
    ["Inbound Contact", phone, text, 1]
  );

const upsertForTenant = (tenantId, phone, text) =>
  db.promise().query(
    `INSERT INTO wa_contacts (tenant_id, name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
     VALUES (?, ?, ?, '91', 'WhatsApp Chat', 1, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       last_message_text = VALUES(last_message_text),
       last_message_at = NOW()`,
    [tenantId, "Me", phone, text, 0]
  );

const rowsFor = async (phone) => (await db.promise().query("SELECT * FROM wa_contacts WHERE phone = ?", [phone]))[0];

(async () => {
  await db.ready;

  try {
    await db.promise().query("DELETE FROM wa_contacts WHERE phone IN (?, ?)", [sharedPhone, secondPhone]);

    // ── 1. A legacy upsert (no scoping column) must insert, then update ──
    await upsertLegacy(sharedPhone, "first message");
    let rows = await rowsFor(sharedPhone);
    assert.equal(rows.length, 1, "the first upsert inserts exactly one row");

    await upsertLegacy(sharedPhone, "second message");
    rows = await rowsFor(sharedPhone);
    assert.equal(rows.length, 1, "the second upsert updates the row instead of throwing");
    assert.equal(rows[0].last_message_text, "second message", "the upsert overwrote the payload");
    assert.equal(Number(rows[0].tenant_id), 1, "an unscoped legacy write lands on the default organization");

    // ── 2. A second organization stores its own contact independently ──
    await upsertForTenant(2, secondPhone, "tenant 2 hello");
    rows = await rowsFor(secondPhone);
    assert.equal(rows.length, 1, "tenant 2 stores its own contact");
    assert.equal(Number(rows[0].tenant_id), 2, "the row carries the writing organization");
    assert.equal(
      rows.filter((r) => Number(r.tenant_id) === 1).length,
      0,
      "tenant 1 cannot see a contact tenant 2 created"
    );

    // ── 3. The same number, written by another organization, is a second row ──
    await upsertForTenant(2, sharedPhone, "tenant 2 message to a shared number");
    rows = await rowsFor(sharedPhone);
    assert.equal(
      rows.filter((r) => Number(r.tenant_id) === 2).length,
      1,
      "tenant 2 owns its own copy of the number"
    );

    // ── 4. ...and the first organization's row is untouched ──
    const tenant1Rows = rows.filter((r) => Number(r.tenant_id) === 1);
    assert.equal(tenant1Rows.length, 1, "tenant 1's row survived tenant 2's write");
    assert.equal(tenant1Rows[0].last_message_text, "second message", "tenant 1's history is untouched");

    // ── 5. Repeats inside one organization still collapse to a single row ──
    await upsertForTenant(2, sharedPhone, "tenant 2 follow-up");
    const tenant2Rows = (await rowsFor(sharedPhone)).filter((r) => Number(r.tenant_id) === 2);
    assert.equal(tenant2Rows.length, 1, "repeat writes inside one organization stay one row");
    assert.equal(tenant2Rows[0].last_message_text, "tenant 2 follow-up", "the newest write wins");

    console.log(
      "PASS: MySQL-style upserts write on the SQLite engine and phone uniqueness is scoped per organization"
    );
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await db.promise().query("DELETE FROM wa_contacts WHERE phone IN (?, ?)", [sharedPhone, secondPhone]).catch(() => {});
  }
})();
