const db = require("../config/database");

async function runCleanup() {
  console.log("🧹 Starting WhatsApp LID & duplicate contact database cleanup...");

  // 1. Find all LID <-> Real phone pairs based on identical contact names
  const [pairs] = await db.promise().query(`
    SELECT l.phone as lid_phone, MIN(r.phone) as real_phone, l.name 
    FROM wa_contacts l 
    JOIN wa_contacts r ON l.name = r.name AND l.id != r.id 
    WHERE LENGTH(l.phone) >= 14 
      AND LENGTH(r.phone) <= 13 
      AND l.name NOT LIKE '+%' 
      AND l.phone NOT LIKE '120363%' 
    GROUP BY l.phone, l.name
  `);
  console.log(`🔍 Found ${pairs.length} distinct LID-to-real-phone mappings.`);

  // 2. Update wa_message_logs for these matched LIDs to point to real phone
  let updatedLogs = 0;
  for (const pair of pairs) {
    const [res] = await db.promise().query(
      "UPDATE wa_message_logs SET phone = ? WHERE phone = ? OR phone LIKE ?",
      [pair.real_phone, pair.lid_phone, `%${pair.lid_phone}%`]
    );
    updatedLogs += res.affectedRows;
  }
  console.log(`✅ Updated ${updatedLogs} message logs to use real phone numbers.`);

  // 3. Delete matched duplicate LID rows from wa_contacts
  const lidPhonesToDelete = pairs.map((p) => p.lid_phone);
  let deletedMatched = 0;
  // Batch in chunks of 500
  for (let i = 0; i < lidPhonesToDelete.length; i += 500) {
    const chunk = lidPhonesToDelete.slice(i, i + 500);
    const [res] = await db.promise().query(
      `DELETE FROM wa_contacts WHERE phone IN (${chunk.map(() => "?").join(",")})`,
      chunk
    );
    deletedMatched += res.affectedRows;
  }
  console.log(`🗑️ Deleted ${deletedMatched} duplicate LID rows with valid real phone counterparts.`);

  // 4. Delete orphaned bogus LID rows (e.g. name = '+1048...' and phone = '1048...')
  const [resBogus] = await db.promise().query(
    "DELETE FROM wa_contacts WHERE LENGTH(phone) >= 14 AND phone NOT LIKE '120363%' AND name LIKE '+%'"
  );
  console.log(`🗑️ Deleted ${resBogus.affectedRows} bogus LID rows from wa_contacts.`);

  console.log("🎉 Database cleanup completed successfully!");
}

if (require.main === module) {
  runCleanup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Cleanup error:", err);
      process.exit(1);
    });
}

module.exports = runCleanup;
