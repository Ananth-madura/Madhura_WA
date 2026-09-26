/**
 * One-shot: dedupe wa_webhook_events, then add the unique index that makes
 * webhook processing idempotent.
 *
 * Meta re-delivers a webhook whenever our 200 is slow or missing, and
 * handleIncomingMessage has real side effects — CRM lead capture, flow
 * dispatch, welcome auto-reply, campaign counters. Nothing prevented a retry
 * from running all of that a second time.
 *
 * routes/waWebhookRoutes.js now claims each event with
 *     INSERT IGNORE INTO wa_webhook_events ...
 * and skips processing when affectedRows === 0. That claim only actually
 * dedupes once this index exists; until then INSERT IGNORE always inserts and
 * behaviour is unchanged (no regression, just no protection yet).
 *
 * Run once, manually:
 *     node backend/migrations/wa_webhook_idempotency.js
 *
 * Key is (event_type, wa_message_id, status) rather than wa_message_id alone
 * because one message legitimately produces three status_update rows — sent,
 * delivered, read — and each must still be applied exactly once.
 *
 * Deliberately NOT in waDatabase.ensureWATables(): on a busy table the DELETE
 * holds a long lock, and server boot is the worst time to discover that. Same
 * reasoning as migrations/wa_dedupe_message_logs.js.
 */
const db = require("../config/database");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

(async () => {
  await db.ready;
  console.log("Connected. Deduping wa_webhook_events...");

  const [{ before }] = await q("SELECT COUNT(*) AS before FROM wa_webhook_events");
  console.log(`Rows before: ${before}`);

  // Keep the lowest id of each (event_type, wa_message_id, status) group.
  // Rows with a NULL wa_message_id (e.g. the raw 'webhook_received' audit
  // rows) are left alone — they are not claims and carry no id to key on.
  const res = await q(
    `DELETE t1 FROM wa_webhook_events t1
       JOIN wa_webhook_events t2
         ON t1.wa_message_id = t2.wa_message_id
        AND t1.event_type <=> t2.event_type
        AND t1.status <=> t2.status
        AND t1.id > t2.id
      WHERE t1.wa_message_id IS NOT NULL`
  );
  console.log(`Duplicates removed: ${res.affectedRows}`);

  try {
    await q(
      "ALTER TABLE wa_webhook_events ADD UNIQUE INDEX uniq_wa_event (event_type, wa_message_id, status)"
    );
    console.log("Unique index uniq_wa_event created — webhook processing is now idempotent.");
  } catch (err) {
    if (/Duplicate key name/i.test(err.message)) {
      console.log("Unique index already present — nothing to do.");
    } else {
      throw err;
    }
  }

  const [{ after }] = await q("SELECT COUNT(*) AS after FROM wa_webhook_events");
  console.log(`Rows after: ${after}`);
  process.exit(0);
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
