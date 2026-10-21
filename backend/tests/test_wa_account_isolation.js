const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const cloud = require('../services/whatsappCloudApi');
const original = { phone: cloud.phoneNumberId, token: cloud.accessToken };
const helperModule = { exports: {} };
let databaseError = false;

// Enterprise fixture: users belong to organizations, organizations own senders.
// A user never owns credentials directly - tenancy is resolved first, then the
// organization's sender is selected (optionally scoped to the primary branch).
const members = {
  41: { tenant_id: 11, branch_id: 101 },
  42: { tenant_id: 12, branch_id: 102 },
  43: { tenant_id: 13, branch_id: 103 },
  44: { tenant_id: 22, branch_id: 201 },
};
const userTenants = { 41: 11, 42: 12, 43: 13, 44: 22 };
const sendersByTenant = {
  11: { phone_number_id: 'phone-A', access_token: 'token-A', app_secret: 'secret-A', verify_token: 'verify-A' },
  12: { phone_number_id: 'phone-B', access_token: 'token-B', app_secret: 'secret-B', verify_token: 'verify-B' },
  // Connected row whose credentials were cleared: must read as not configured.
  13: { phone_number_id: 'disabled-phone', access_token: '', app_secret: '', verify_token: '' },
  // Tenant 22 has no sender at all (intentionally absent).
};

function fixtureRequire(name) {
  if (name === '../config/database') {
    return { query: (sql, params, callback) => setImmediate(() => {
      if (databaseError) return callback(new Error('Fixture database unavailable'));
      if (/organization_memberships/i.test(sql)) {
        const m = members[params[0]];
        return callback(null, m ? [m] : []);
      }
      if (/\bFROM\s+users\b/i.test(sql)) {
        const t = userTenants[params[0]];
        return callback(null, t ? [{ tenant_id: t }] : []);
      }
      return callback(null, []);
    })};
  }
  if (name === './whatsappCloudApi') return cloud;
  if (name === './metaPartnerService') {
    return {
      resolveSenderCredentials: async (tenantId) =>
        sendersByTenant[tenantId] || { phone_number_id: '', access_token: '' },
    };
  }
  return { decrypt: (value) => value };
}

vm.runInNewContext(fs.readFileSync(require.resolve('../services/waConfigHelper'), 'utf8'), {
  module: helperModule, process, console,
  require: fixtureRequire,
});
const helper = helperModule.exports;
(async () => {
  const [first, second] = await Promise.all([helper.cloudClientForUser(41), helper.cloudClientForUser(42)]);
  assert.equal(first.phoneNumberId, 'phone-A'); assert.equal(second.phoneNumberId, 'phone-B');
  assert.equal(first.appSecret, 'secret-A'); assert.equal(second.appSecret, 'secret-B');
  assert.equal(await helper.configureForUser(42), true);
  assert.equal(first.accessToken, 'token-A', 'A later request cannot replace another request credentials');
  assert.equal(cloud.phoneNumberId, original.phone); assert.equal(cloud.accessToken, original.token);
  assert.equal((await helper.cloudClientForUser(43)).isConfigured(), false,
    'A sender with cleared credentials must report not configured');
  await assert.rejects(helper.cloudClientForUser(44), /No connected WhatsApp sender/i,
    'A tenant with no connected sender must fail closed instead of borrowing another org sender');
  await assert.rejects(helper.cloudClientForUser(''), /no authenticated user context/i,
    'A caller without a user identity must never be mapped to an organization');
  assert.equal(await helper.configureForUser(44), false,
    'The boolean probe reports "not configured" instead of throwing');
  databaseError = true;
  await assert.rejects(helper.cloudClientForUser(41), /database unavailable/, 'Database failure must not silently select the system sender');
  assert.equal(await helper.configureForUser(41), false,
    'A database outage must never resolve into "configured"');
  databaseError = false;

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
