const path = require('path');
process.env.DB_ENGINE = 'r2'; // Ensure SQLite + R2 mode
const db = require('../config/database');
const sqliteAdapter = require('../config/sqliteDatabase');
const r2 = require('../services/r2StorageService');

(async () => {
  try {
    console.log('--- 1. Initializing Database (db.ready) ---');
    await db.ready;
    console.log('Database ready! isSqlite:', db.isSqlite, 'r2Enabled:', db.r2Enabled);

    console.log('\n--- 2. Ensuring WhatsApp Tables & Running Migrations ---');
    const waDb = require('../services/waDatabase');
    await waDb.ensureWATables();

    console.log('\n--- 3. Querying All Tables from sqlite_master ---');
    const [tables] = await sqliteAdapter.executeSql(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    console.log(`Successfully verified ${tables.length} tables:`);
    const tableNames = tables.map(t => t.name);
    console.log(tableNames.join(', '));

    console.log('\n--- 4. Checking Critical User & Admin Record ---');
    const [users] = await sqliteAdapter.executeSql("SELECT id, first_name, email, role FROM users");
    console.log('Users in database:', users);

    console.log('\n--- 5. Forcing Snapshot Backup to Cloudflare R2 Bucket (madhurawa) ---');
    const uploadResult = await r2.uploadDatabaseToR2(sqliteAdapter.dbPath);
    console.log('R2 Backup result:', uploadResult);

    console.log('\n--- 6. Verifying Metadata in R2 ---');
    const status = r2.getStatus();
    console.log('R2 Storage Status:', status);

    console.log('\n=== ALL TABLES CREATED & SYNCHRONIZED TO R2 SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
})();
