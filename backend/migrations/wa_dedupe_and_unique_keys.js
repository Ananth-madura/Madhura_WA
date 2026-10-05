/**
 * One-shot: clear legacy duplicate rows, then add the unique indexes that stop
 * them coming back.
 *
 * Two tables relied on INSERT IGNORE / ON DUPLICATE KEY UPDATE to dedupe, but
 * neither had the unique key those statements need — so every call appended a
 * fresh row:
 *
 *   wa_message_logs    → duplicate outbound/inbound log rows
 *   wa_group_contacts  → a contact group grew to "everyone, many times over",
 *                        and starting a campaign against it then messaged the
 *                        same person several times
 *
 * ensureWATables() now creates these indexes, but it cannot create them while
 * duplicate rows exist. Run this once to clean up, then restart the server.
 *
 *     node backend/migrations/wa_dedupe_and_unique_keys.js
 */
const db = require("../config/database");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const countRows = async (sql) => {
  const [row] = await q(sql);
  return Number(Object.values(row || {})[0] || 0);
};

async function addUnique(table, indexName, columns) {
  try {
    await q(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${indexName}\` (${columns})`);
    console.log(`✅ ${indexName} created on ${table}`);
  } catch (err) {
    if (/Duplicate key name/i.test(err.message)) {
      console.log(`=  ${indexName} already present on ${table}`);
    } else {
      throw err;
    }
  }
}

// The DELETEs below are irreversible, so snapshot each table into a sibling
// *_bak_<timestamp> table first. Roll back with:
//   INSERT INTO wa_message_logs SELECT * FROM wa_message_logs_bak_20260101_1200;
//   ALTER TABLE wa_message_logs DROP INDEX uniq_session_msg;
async function backup(table) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 12);
  const backupTable = `${table}_bak_${stamp}`;
  const [{ found }] = await q(
    "SELECT COUNT(*) AS found FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [backupTable]
  );
  if (found) {
    console.log(`  = backup ${backupTable} already exists — leaving it alone`);
    return;
  }
  await q(`CREATE TABLE \`${backupTable}\` AS SELECT * FROM \`${table}\``);
  console.log(`  📦 backed up to ${backupTable}`);
}

(async () => {
  await db.ready;
  console.log("Connected.\n");

  // ── wa_message_logs ────────────────────────────────────────────────────────
  console.log("[1/3] wa_message_logs");
  console.log(`  rows before: ${await countRows("SELECT COUNT(*) AS c FROM wa_message_logs")}`);
  await backup("wa_message_logs");
  // Keep the lowest id of each (session_key, wa_message_id) group.
  await q(
    `DELETE t1 FROM wa_message_logs t1
       JOIN wa_message_logs t2
         ON t1.wa_message_id = t2.wa_message_id
        AND t1.session_key <=> t2.session_key
        AND t1.id > t2.id
     WHERE t1.wa_message_id IS NOT NULL`
  );
  console.log(`  rows after:  ${await countRows("SELECT COUNT(*) AS c FROM wa_message_logs")}`);
  await addUnique("wa_message_logs", "uniq_session_msg", "session_key, wa_message_id");

  // ── wa_group_contacts ──────────────────────────────────────────────────────
  // Normalise to the last 10 digits first: the same person was stored as both
  // "9876543210" and "919876543210" by different code paths, which would defeat
  // a naive unique key and keep the duplicate alive.
  console.log("\n[2/3] wa_group_contacts");
  console.log(`  rows before: ${await countRows("SELECT COUNT(*) AS c FROM wa_group_contacts")}`);
  if (await countRows("SELECT COUNT(*) AS c FROM wa_group_contacts")) {
    await backup("wa_group_contacts");
    try {
      await q(
        `UPDATE wa_group_contacts
            SET phone = RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10)
          WHERE phone IS NOT NULL
            AND phone <> RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10)`
      );
      console.log("  normalised phone values to last 10 digits");
    } catch (err) {
      console.warn(`  ⚠️  could not normalise phones (${err.message}) — continuing`);
    }
    await q(
      `DELETE t1 FROM wa_group_contacts t1
         JOIN wa_group_contacts t2
           ON t1.group_id = t2.group_id
          AND t1.phone = t2.phone
          AND t1.id > t2.id`
    );
    console.log(`  rows after:  ${await countRows("SELECT COUNT(*) AS c FROM wa_group_contacts")}`);
  } else {
    console.log("  table is empty — nothing to clean");
  }
  await addUnique("wa_group_contacts", "uniq_group_phone", "group_id, phone");

  // ── wa_campaign_messages ────────────────────────────────────────────────────
  // A campaign must never hold two rows for one phone: the engine's row claim
  // is per-row, so a duplicate pair means the same person can be messaged twice.
  console.log("\n[3/3] wa_campaign_messages");
  console.log(`  rows before: ${await countRows("SELECT COUNT(*) AS c FROM wa_campaign_messages")}`);
  if (await countRows("SELECT COUNT(*) AS c FROM wa_campaign_messages")) {
    await backup("wa_campaign_messages");
    // Keep the most-advanced row per (campaign, phone): a terminal status is the
    // one that must not be lost, since that is what stops a re-send.
    await q(
      `DELETE t1 FROM wa_campaign_messages t1
         JOIN wa_campaign_messages t2
           ON t1.campaign_id = t2.campaign_id
          AND t1.phone = t2.phone
          AND (
            (t2.status IN ('sent','delivered','read') AND t1.status NOT IN ('sent','delivered','read'))
            OR ((t2.status IN ('sent','delivered','read')) = (t1.status IN ('sent','delivered','read')) AND t2.id < t1.id)
          )`
    );
    console.log(`  rows after:  ${await countRows("SELECT COUNT(*) AS c FROM wa_campaign_messages")}`);
  } else {
    console.log("  table is empty — nothing to clean");
  }
  await addUnique("wa_campaign_messages", "uniq_campaign_phone", "campaign_id, phone");

  console.log("\nDone. Restart the backend so ensureWATables() verifies the indexes.");
  process.exit(0);
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});