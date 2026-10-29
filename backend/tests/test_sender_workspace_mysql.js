"use strict";
const assert = require("node:assert/strict"), mysql = require("mysql2");
process.env.SMTP_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
const { decrypt } = require("../backendutil/cryptoHelper");
const { createService } = require("../services/senderWorkspace");
async function main() {
  const port = Number(process.env.INBOX_TEST_MYSQL_PORT);
  if (!Number.isInteger(port) || port < 1024 || port === 3306) throw new Error("Isolated MySQL port required");
  const options = { host: "127.0.0.1", port, user: process.env.INBOX_TEST_MYSQL_USER || "root", password: process.env.INBOX_TEST_MYSQL_PASSWORD || "", connectionLimit: 12 };
  const admin = mysql.createPool(options), database = `sender_workspace_test_${process.pid}_${Date.now()}`;
  await admin.promise().query(`CREATE DATABASE \`${database}\``);
  const pool = mysql.createPool({ ...options, database }), sql = pool.promise(), db = { promise: () => sql };
  let checks = 0;
  const passed = name => { checks++; console.log(`PASS: ${name}`); };
  try {
    for (const table of [
      "tenants (id INT PRIMARY KEY,status VARCHAR(30),max_senders INT)",
      "branches (id INT PRIMARY KEY,tenant_id INT,name VARCHAR(100),status VARCHAR(30))",
      "waba_connections (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,waba_id VARCHAR(100) UNIQUE,partner_type VARCHAR(50),encrypted_token TEXT,status VARCHAR(30),updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
      "wa_senders (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,waba_connection_id INT,phone_number_id VARCHAR(128) UNIQUE,display_phone VARCHAR(32),verified_name VARCHAR(255),quality VARCHAR(30) DEFAULT 'GREEN',messaging_tier VARCHAR(50) DEFAULT 'TIER_250',is_shared TINYINT DEFAULT 1,status VARCHAR(30),app_secret TEXT,verify_token VARCHAR(255),created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
      "sender_branch_assignments (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,sender_id INT,branch_id INT,is_default TINYINT,routing_weight INT,UNIQUE(tenant_id,sender_id,branch_id))",
      "meta_onboarding_sessions (id INT AUTO_INCREMENT PRIMARY KEY,session_id VARCHAR(100) UNIQUE,tenant_id INT,user_id INT,state_token VARCHAR(128),status VARCHAR(50),meta_waba_id VARCHAR(100),meta_phone_number_id VARCHAR(100),expires_at DATETIME)",
      "wa_automations (id INT PRIMARY KEY,tenant_id INT,sender_id INT,is_active TINYINT,revision INT DEFAULT 1,updated_at DATETIME)",
      "wa_automation_logs (id INT PRIMARY KEY,automation_id INT,status VARCHAR(30),error VARCHAR(255),trigger_data TEXT)"
    ]) await sql.query(`CREATE TABLE ${table}`);
    await require("../migrations/sender_workspace").migrate(db); await require("../migrations/sender_workspace").migrate(db);
    passed("additive migration is repeatable on MySQL");
    await sql.query("INSERT INTO tenants VALUES (1,'active',3),(2,'active',3)");
    await sql.query("INSERT INTO branches VALUES (1,1,'North','active'),(2,1,'South','active'),(3,2,'Foreign','active'),(4,1,'Inactive','inactive')");
    let rejectMeta = false, oauthFailure = false, subscription = true, requests = [];
    const transport = {
      get: async (url, config) => {
        requests.push({ url, config });
        if (url.endsWith("oauth/access_token")) { if (oauthFailure) throw new Error("provider secret response"); return { data: { access_token: "exchanged-token" } }; }
        if (rejectMeta) throw { response: { data: { error: { code: 190, message: "must not leak" } } } };
        return { data: { data: ["11111", "22222", "33333", "44444"].map(id => ({ id, display_phone_number: `+1555${id}`, verified_name: `Business ${id}`, quality_rating: "GREEN", status: "CONNECTED" })) } };
      },
      post: async () => ({ data: { success: subscription } })
    };
    const service = createService(db, transport), input = { wabaId: "99999", phoneNumberId: "11111", accessToken: "secret-token", appSecret: "app-secret", branchIds: [1], defaultBranchIds: [1] };
    let one = await service.connect(1, 10, input);
    assert.equal(one.status, "connected"); assert.equal(one.messaging_tier, null); assert.equal(one.has_token, true);
    assert(!JSON.stringify(one).includes("secret-token")); assert(!JSON.stringify(one).includes("app-secret")); assert(!("encrypted_token" in one));
    const [[stored]] = await sql.query("SELECT encrypted_token FROM waba_connections"); assert.notEqual(stored.encrypted_token, input.accessToken); assert.equal(decrypt(stored.encrypted_token), input.accessToken);
    passed("verified assets, encrypted persistence, redacted public data, no invented tier");
    await sql.query("UPDATE waba_connections SET encrypted_token='legacy-plaintext-token'");
    await sql.query("UPDATE wa_senders SET app_secret='legacy-plaintext-secret'");
    await require("../migrations/sender_workspace").migrate(db);
    const [[legacy]] = await sql.query("SELECT encrypted_token FROM waba_connections"); assert.equal(decrypt(legacy.encrypted_token), "legacy-plaintext-token"); assert.notEqual(legacy.encrypted_token, "legacy-plaintext-token");
    await sql.query("UPDATE waba_connections SET encrypted_token=?", [stored.encrypted_token]);
    passed("legacy plaintext credentials upgraded by the additive migration");
    await assert.rejects(service.connect(2, 20, { ...input, branchIds: [3], defaultBranchIds: [3] }), { status: 409 });
    await assert.rejects(service.detail(2, one.id), { status: 404 }); assert.deepEqual(await service.list(2), []);
    await assert.rejects(service.connect(1, 10, { ...input, phoneNumberId: "55555" }), { status: 403 });
    passed("cross-tenant ownership and wrong WABA assets rejected");
    const original = one.revision;
    for (const branchIds of [[3], [4], [-1]]) await assert.rejects(service.updateRouting(1, one.id, { branchIds }, 10), { status: 400 });
    assert.equal((await service.detail(1, one.id)).revision, original);
    passed("foreign and inactive branches cannot mutate routing");
    const results = await Promise.allSettled([1, 2].map(branch => service.updateRouting(1, one.id, { branchIds: [branch], defaultBranchIds: [branch], revision: original }, 10)));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
    passed("concurrent updates reject stale revisions");
    let two = await service.connect(1, 10, { ...input, phoneNumberId: "22222", defaultBranchIds: [1] });
    await service.changeBranch(1, one.id, 1, 10, { isDefault: true, routingWeight: 90 });
    const [[defaults]] = await sql.query("SELECT COUNT(*) total FROM sender_branch_assignments WHERE tenant_id=1 AND branch_id=1 AND is_default=1"); assert.equal(defaults.total, 1);
    await service.changeBranch(1, one.id, 1, 10); assert(!(await service.detail(1, one.id)).assigned_branch_ids.includes(1));
    passed("branch APIs share atomic default routing and revision tracking");
    one = await service.detail(1, one.id);
    await sql.query("CREATE TRIGGER reject_route BEFORE INSERT ON sender_branch_assignments FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected rollback'");
    await assert.rejects(service.updateRouting(1, one.id, { branchIds: [1], revision: one.revision }, 10));
    assert.deepEqual(await service.detail(1, one.id), one); await sql.query("DROP TRIGGER reject_route");
    passed("database failures roll back sender and routing changes together");
    rejectMeta = true; await assert.rejects(service.sync(1, one.id, 10), { status: 502 });
    assert((await service.detail(1, one.id)).health_error); assert(!JSON.stringify(await service.detail(1, one.id)).includes("must not leak"));
    rejectMeta = false; one = await service.sync(1, one.id, 10); assert.equal(one.health_error, null);
    assert.equal(requests.at(-1).config.headers.Authorization, "Bearer secret-token");
    passed("health checks decrypt tokens and preserve sanitized failures");
    subscription = false; await assert.rejects(service.subscribe(1, one.id, 10), { status: 502 }); assert.equal((await service.detail(1, one.id)).webhook_subscribed_at, null);
    subscription = true; await service.subscribe(1, one.id, 10); assert((await service.detail(1, two.id)).webhook_subscribed_at);
    passed("webhook subscription requires explicit Meta confirmation");
    await sql.query("UPDATE wa_senders SET status='pending' WHERE id=?", [one.id]);
    await assert.rejects(service.register(1, one.id, 10, { pin: "123" }), { status: 400 });
    one = await service.register(1, one.id, 10, { pin: "123456" }); assert.equal(one.status, "connected");
    assert(!(await service.activity(1, one.id)).some(e => JSON.stringify(e).includes("123456")));
    passed("pending Cloud API registration validates its PIN and refreshes verified status without storing the PIN");
    process.env.META_APP_ID = "12345"; process.env.META_APP_SECRET = "meta-secret"; process.env.META_EMBEDDED_CONFIG_ID = "67890";
    const session = await service.createSession(1, 10), completion = { ...session, code: "real-code", wabaId: "99999", phoneNumberId: "33333", branchIds: [2] };
    await assert.rejects(service.completeSession(2, 10, completion), { status: 409 }); await assert.rejects(service.completeSession(1, 11, completion), { status: 409 });
    const three = await service.completeSession(1, 10, completion); assert.equal(three.phone_number_id, "33333");
    await assert.rejects(service.completeSession(1, 10, completion), { status: 409 });
    passed("onboarding state is tenant- and actor-bound, single-use and persisted atomically");
    const failed = await service.createSession(2, 20); oauthFailure = true;
    await assert.rejects(service.completeSession(2, 20, { ...failed, code: "bad", wabaId: "88888", phoneNumberId: "44444", branchIds: [3] }), { status: 502 });
    assert.deepEqual(await service.list(2), []); const [[failedSession]] = await sql.query("SELECT status FROM meta_onboarding_sessions WHERE session_id=?", [failed.sessionId]); assert.equal(failedSession.status, "failed");
    passed("OAuth failures never manufacture credentials or sender records");
    await assert.rejects(service.connect(1, 10, { ...input, phoneNumberId: "44444" }), { status: 409 });
    passed("organization sender allowance enforced inside the transaction");
    await sql.query("INSERT INTO wa_automations (id,tenant_id,sender_id,is_active) VALUES (1,1,?,1)", [one.id]);
    await sql.query("INSERT INTO wa_automation_logs VALUES (1,1,'scheduled',NULL,'private payload')");
    await service.disconnect(1, one.id, 10); const disconnected = await service.detail(1, one.id); assert.equal(disconnected.status, "disconnected"); assert.equal(disconnected.has_app_secret, false); assert.deepEqual(disconnected.branches, []);
    const [[automation]] = await sql.query("SELECT is_active FROM wa_automations WHERE id=1"); assert.equal(automation.is_active, 0);
    const [[log]] = await sql.query("SELECT status,trigger_data FROM wa_automation_logs WHERE id=1"); assert.equal(log.status, "skipped"); assert.equal(log.trigger_data, null);
    assert((await service.detail(1, two.id)).has_token); assert((await service.activity(1, one.id)).some(e => e.action === "disconnected"));
    passed("disconnect preserves history, clears routing, pauses queued work, preserves sibling credentials and audits changes");
    console.log(JSON.stringify({ checks, failed: 0 }));
  } finally { await pool.promise().end(); await admin.promise().query(`DROP DATABASE \`${database}\``); await admin.promise().end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
