const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const cloud = require('../services/whatsappCloudApi');
const original = { phone: cloud.phoneNumberId, token: cloud.accessToken };
const helperModule = { exports: {} };
let databaseError = false;
const records = {
  41: { phone_number_id: 'phone-A', access_token: 'token-A', app_secret: 'secret-A', verify_token: 'verify-A', is_enabled: 1 },
  42: { phone_number_id: 'phone-B', access_token: 'token-B', app_secret: 'secret-B', verify_token: 'verify-B', is_enabled: 1 },
  43: { phone_number_id: 'disabled-phone', access_token: 'disabled-token', is_enabled: 0 }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../services/waConfigHelper'), 'utf8'), {
  module: helperModule, process,
  require: (name) => name === '../config/database' ? { query: (sql, params, callback) => {
    setImmediate(() => callback(databaseError ? new Error('Fixture database unavailable') : null, records[params[0]] ? [records[params[0]]] : []));
  } } : name === './whatsappCloudApi' ? cloud : { decrypt: (value) => value }
});
const helper = helperModule.exports;
(async () => {
  const [first, second] = await Promise.all([helper.cloudClientForUser(41), helper.cloudClientForUser(42)]);
  assert.equal(first.phoneNumberId, 'phone-A'); assert.equal(second.phoneNumberId, 'phone-B');
  assert.equal(first.appSecret, 'secret-A'); assert.equal(second.appSecret, 'secret-B');
  await helper.configureForUser(42);
  assert.equal(first.accessToken, 'token-A', 'A later request cannot replace another request credentials');
  assert.equal(cloud.phoneNumberId, original.phone); assert.equal(cloud.accessToken, original.token);
  assert.equal((await helper.cloudClientForUser(43)).isConfigured(), false);
  databaseError = true;
  await assert.rejects(helper.cloudClientForUser(41), /database unavailable/, 'Database failure must not silently select the system sender');

  // Execute the actual account-list SQL against an isolated database, including stored tokens.
  const { DatabaseSync } = require('node:sqlite');
  const database = new DatabaseSync(':memory:');
  database.exec('CREATE TABLE wa_accounts (id INTEGER, account_name TEXT, phone_number TEXT, phone_number_id TEXT, waba_id TEXT, connection_type TEXT, is_active INTEGER, is_default INTEGER, quality_rating TEXT, messaging_limit TEXT, created_at TEXT, created_by INTEGER, access_token TEXT, app_secret TEXT)');
  const insert = database.prepare("INSERT INTO wa_accounts (id, account_name, phone_number_id, created_by, access_token, app_secret, is_active, connection_type) VALUES (?, ?, ?, ?, ?, ?, 1, 'cloud_api')");
  insert.run(1, 'Own account', 'phone-A', 41, 'private-token-A', 'private-secret-A');
  insert.run(2, 'Other account', 'phone-B', 42, 'private-token-B', 'private-secret-B');
  const source = fs.readFileSync(require.resolve('../routes/whatsappRoutes'), 'utf8');
  const start = source.indexOf('router.get("/accounts/list"');
  const end = source.indexOf('router.post("/accounts/switch-default"', start);
  let handler;
  vm.runInNewContext(source.slice(start, end), {
    router: { get: (path, callback) => { handler = callback; } },
    db: { promise: () => ({ query: async (sql, params) => [database.prepare(sql).all(...params)] }) },
    require: () => ({ cloudClientForUser: async () => ({ phoneNumberId: 'phone-A' }) })
  });
  let result;
  await handler({ user: { id: 41 } }, { json(value) { result = value; }, status() { return this; } });
  assert.equal(result.length, 1); assert.equal(result[0].id, 1);
  assert.equal(result[0].access_token, undefined); assert.equal(result[0].app_secret, undefined);
  const switchStart = source.indexOf('router.post("/accounts/switch-default"');
  const switchEnd = source.indexOf('router.post("/seen"', switchStart);
  const writes = [];
  vm.runInNewContext(source.slice(switchStart, switchEnd), {
    router: { post: (path, callback) => { handler = callback; } },
    db: { promise: () => ({ query: async (sql, params) => {
      if (sql.startsWith('SELECT')) return [database.prepare(sql).all(...params)];
      writes.push({ sql, params }); return [{ affectedRows: 1 }];
    } }) },
    require: () => ({ cloudClientForUser: async () => ({ phoneNumberId: 'phone-A' }) })
  });
  let status;
  const response = { json(value) { result = value; }, status(value) { status = value; return this; } };
  await handler({ user: { id: 41 }, body: { accountId: 2 } }, response);
  assert.equal(status, 404); assert.equal(writes.length, 0, 'Switching another account never changes provider credentials');
  await handler({ user: { id: 41 }, body: { accountId: 1 } }, response);
  assert.equal(writes[0].params[0], 41); assert.equal(writes[0].params[1], 'phone-A');
  assert.equal(writes[1].params[1], 41, 'Default flags are updated only within the caller account scope');
  database.close();
  console.log('PASS: concurrent Cloud clients, disabled accounts, database failure isolation, account ownership and secret-free account lists');
})().catch((error) => { console.error(error); process.exitCode = 1; });
