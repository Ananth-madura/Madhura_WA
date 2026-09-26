/**
 * One-shot: dedupe wa_message_logs, then add the unique index that prevents it
 * recurring.
 *
 * wa_message_id never had a unique key, yet three call sites relied on
 * INSERT IGNORE to dedupe — so every chat-history re-sync appended duplicate
 * rows. This deletes the accumulated duplicates (keeping the lowest id of each
 * group) and adds UNIQUE(session_key, wa_message_id).
 *
 * Run once, manually, before/after deploying:
 *     node backend/migrations/wa_dedupe_message_logs.js
 *
 * Deliberately NOT in waDatabase.ensureWATables(): on a table with a lot of
 * legacy duplicates the DELETE holds a long lock, and boot is the worst time
 * to discover that. The index is composite rather than on wa_message_id alone
 * because two CRM users in the same WhatsApp group legitimately log the same
 * message id once each.
 */
const db = require("../config/database");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

(async () => {
  await db.ready;
  console.log("Connected. Deduping wa_message_logs...");

  const [{ before }] = await q("SELECT COUNT(*) AS before FROM wa_message_logs");
  console.log(`Rows before: ${before}`);

  const res = await q(
    `DELETE t1 FROM wa_message_logs t1
       JOIN wa_message_logs t2
         ON t1.wa_message_id = t2.wa_message_id
        AND t1.session_key <=> t2.session_key
        AND t1.id > t2.id
      WHERE t1.wa_message_id IS NOT NULL`
  );
  console.log(`Duplicates removed: ${res.affectedRows}`);

  try {
    await q("ALTER TABLE wa_message_logs ADD UNIQUE INDEX uniq_session_msg (session_key, wa_message_id)");
    console.log("Unique index uniq_session_msg created.");
  } catch (err) {
    if (/Duplicate key name/i.test(err.message)) console.log("Unique index already present — nothing to do.");
    else throw err;
  }

  const [{ after }] = await q("SELECT COUNT(*) AS after FROM wa_message_logs");
  console.log(`Rows after: ${after}`);
  console.log("Done.");
  process.exit(0);
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
