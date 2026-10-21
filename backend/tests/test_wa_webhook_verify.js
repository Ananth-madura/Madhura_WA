/**
 * Per-account webhook verification.
 *
 * Meta's subscription handshake (GET) and the message POST are two different
 * trust decisions:
 *
 *   - GET carries only the token the operator typed into the App Dashboard, so
 *     it must be checked against every token this deployment has configured -
 *     env, user_wa_configs, wa_accounts and wa_senders.
 *   - POST resolves the sender by phone_number_id and verifies the signature
 *     against THAT sender's own app_secret (covered in
 *     tests/test_wa_webhook_auth.js).
 *
 * The regression this guards: config/sqliteDatabase.js (the default engine)
 * created user_wa_configs without app_secret/verify_token while
 * services/waDatabase.js created it with both. On SQLite the lookup threw, the
 * GET handler answered 503 to every non-env token, and the resolver read
 * app_secret as undefined and verified against the process-wide secret.
 */
const assert = require("assert/strict");
const fs = require("fs");
const vm = require("vm");

const routesPath = require.resolve("../routes/waWebhookRoutes");
const source = fs.readFileSync(routesPath, "utf8");

/** Extract a balanced {...} block starting at `marker`, skipping string bodies. */
function extractBlock(src, marker) {
  const start = src.indexOf(marker);
  assert.ok(start !== -1, `marker not found: ${marker}`);
  let i = src.indexOf("{", start + marker.length - 1);
  assert.ok(i !== -1, "opening brace not found");
  let depth = 0;
  let quote = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") { const nl = src.indexOf("\n", i); i = nl === -1 ? src.length : nl; continue; }
    if (ch === "/" && src[i + 1] === "*") { const close = src.indexOf("*/", i); i = close === -1 ? src.length : close + 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { text: src.slice(start, i + 1), start, end: i + 1 };
    }
  }
  throw new Error("unbalanced block: " + marker);
}

// ── the verify-token source list ────────────────────────────────────────────
const vsStart = source.indexOf("const verifyTokenSources = [");
assert.ok(vsStart !== -1, "verifyTokenSources not found");
const vsEnd = source.indexOf("\n];", vsStart);
assert.ok(vsEnd !== -1, "verifyTokenSources terminator not found");
const sourcesCode = source.slice(vsStart, vsEnd + 3);

// ── the GET handler ─────────────────────────────────────────────────────────
const getMarker = 'router.get("/", async (req, res) => {';
const getStart = source.indexOf(getMarker);
assert.ok(getStart !== -1, "GET handler not found");
const getOpen = source.indexOf("{", getStart + 'router.get("/",'.length);
let depth = 0, gi = getOpen, quote = null, getClose = -1;
for (; gi < source.length; gi++) {
  const ch = source[gi];
  if (quote) { if (ch === "\\") { gi++; continue; } if (ch === quote) quote = null; continue; }
  if (ch === "/" && source[gi + 1] === "/") { const nl = source.indexOf("\n", gi); gi = nl === -1 ? source.length : nl; continue; }
  if (ch === "/" && source[gi + 1] === "*") { const close = source.indexOf("*/", gi); gi = close === -1 ? source.length : close + 1; continue; }
  if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
  if (ch === "{") depth++;
  else if (ch === "}") { depth--; if (depth === 0) { getClose = gi; break; } }
}
assert.ok(getClose > 0, "GET handler close not found");
const handlerCode = "const getHandler = async (req, res) => " + source.slice(getOpen, getClose + 1) + ";";

// ── resolveWebhookAccount ───────────────────────────────────────────────────
const resolveCode = extractBlock(source, "async function resolveWebhookAccount(phoneId)").text;

/** Minimal express response double. */
function makeRes() {
  const res = {
    statusCode: null, body: null, sent: null,
    status(c) { res.statusCode = c; return res; },
    send(v) { res.sent = v; res.body = v; return res; },
    sendStatus(c) { res.statusCode = c; res.sent = c; return res; },
    json(v) { res.body = v; return res; },
  };
  return res;
}

/** Fake db whose queries are routed by SQL fragment. */
function fakeDb(routes) {
  return {
    promise: () => ({
      query: async (sql, params) => {
        for (const [fragment, handler] of routes) {
          if (sql.includes(fragment)) {
            const out = handler(params, sql);
            if (out instanceof Error) throw out;
            return [out];
          }
        }
        throw new Error("unrouted SQL: " + sql);
      },
    }),
  };
}

(async () => {
  const savedEnv = { WA_VERIFY_TOKEN: process.env.WA_VERIFY_TOKEN, WA_APP_SECRET: process.env.WA_APP_SECRET, WA_PHONE_NUMBER_ID: process.env.WA_PHONE_NUMBER_ID };
  const restore = () => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  };
  try {
    process.env.WA_VERIFY_TOKEN = "env-secret-token";

    // ── GET: each configured source is accepted ─────────────────────────────
    const context = {
      console: { warn() {}, log() {}, error() {} },
      process,
      db: fakeDb([
        ["FROM user_wa_configs WHERE verify_token", (p) => (p[0] === "user-config-token" ? [{ 1: 1 }] : [])],
        ["FROM wa_accounts WHERE verify_token", (p) => (p[0] === "account-token" ? [{ 1: 1 }] : [])],
        ["FROM wa_senders WHERE verify_token", (p) => (p[0] === "sender-token" ? [{ 1: 1 }] : [])],
      ]),
    };
    vm.runInNewContext(sourcesCode + "\n" + handlerCode + "\nglobalThis.__get = getHandler;", context);
    const get = context.__get;

    const handshake = (token) => ({ query: { "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": "challenge-abc" } });

    let res = makeRes();
    await get(handshake("env-secret-token"), res);
    assert.equal(res.statusCode, 200, "env verify token accepted");
    assert.equal(res.sent, "challenge-abc", "challenge echoed back");

    res = makeRes();
    await get(handshake("account-token"), res);
    assert.equal(res.statusCode, 200, "wa_accounts.verify_token accepted");

    res = makeRes();
    await get(handshake("sender-token"), res);
    assert.equal(res.statusCode, 200, "wa_senders.verify_token accepted");

    res = makeRes();
    await get(handshake("user-config-token"), res);
    assert.equal(res.statusCode, 200, "user_wa_configs.verify_token accepted");

    // Unknown token is 403 - and specifically NOT 503, which is what it
    // answered when the user_wa_configs lookup threw on a column SQLite
    // never created.
    res = makeRes();
    await get(handshake("nope"), res);
    assert.equal(res.statusCode, 403, "unknown token is rejected, not 503");
    assert.match(String(res.sent), /Invalid verification token/);

    // Wrong mode is rejected outright.
    res = makeRes();
    await get({ query: { "hub.mode": "unsubscribe", "hub.verify_token": "env-secret-token", "hub.challenge": "x" } }, res);
    assert.equal(res.statusCode, 403, "non-subscribe mode rejected");

    // ── GET: one broken source must not sink the handshake ──────────────────
    const partialContext = {
      console: { warn() {}, log() {}, error() {} },
      process,
      db: fakeDb([
        // user_wa_configs unavailable (table/column missing) - errors
        ["FROM user_wa_configs WHERE verify_token", () => new Error("no such column: verify_token")],
        ["FROM wa_accounts WHERE verify_token", (p) => (p[0] === "account-token" ? [{ 1: 1 }] : [])],
        ["FROM wa_senders WHERE verify_token", () => []],
      ]),
    };
    vm.runInNewContext(sourcesCode + "\n" + handlerCode + "\nglobalThis.__get = getHandler;", partialContext);
    res = makeRes();
    await partialContext.__get(handshake("account-token"), res);
    assert.equal(res.statusCode, 200, "a failing source is skipped, the next one still matches");

    res = makeRes();
    await partialContext.__get(handshake("nope"), res);
    // One source could not be consulted, so "no source matched" is not the
    // same as "this token is unknown" - saying 403 would tell the operator
    // their credentials are wrong when the real fault is a broken lookup.
    assert.equal(res.statusCode, 503, "no match while a source is broken reports the outage, not a bad token");

    // Every source broken => 503, so operators see an outage rather than a
    // credentials problem they do not have.
    const brokenContext = {
      console: { warn() {}, log() {}, error() {} },
      process,
      db: fakeDb([
        ["FROM user_wa_configs WHERE verify_token", () => new Error("no such column: verify_token")],
        ["FROM wa_accounts WHERE verify_token", () => new Error("no such table")],
        ["FROM wa_senders WHERE verify_token", () => new Error("no such table")],
      ]),
    };
    vm.runInNewContext(sourcesCode + "\n" + handlerCode + "\nglobalThis.__get = getHandler;", brokenContext);
    res = makeRes();
    await brokenContext.__get(handshake("env-secret-token"), res);
    // env source still matches without touching the DB, so 200 here is correct;
    // the 503 path is exercised when env is unset:
    assert.equal(res.statusCode, 200, "env source never needs the database");

    process.env.WA_VERIFY_TOKEN = "";
    res = makeRes();
    await brokenContext.__get(handshake("env-secret-token"), res);
    assert.equal(res.statusCode, 503, "all lookups broken and no env token => 503, not a bogus 403");

    // ── resolveWebhookAccount: the sender's own secret wins ─────────────────
    process.env.WA_APP_SECRET = "process-wide-secret";
    process.env.WA_PHONE_NUMBER_ID = "env-sender-id";

    const waStub = { withAccount: (row) => ({ row }) };
    const rowsFor = (userRow, accountRow, senderRow) => fakeDb([
      ["SELECT * FROM user_wa_configs WHERE phone_number_id", () => (userRow ? [userRow] : [])],
      ["SELECT * FROM wa_accounts WHERE phone_number_id", () => (accountRow ? [accountRow] : [])],
      ["FROM wa_senders s WHERE s.phone_number_id", () => (senderRow ? [senderRow] : [])],
    ]);

    const resolveIn = (db) => {
      const ctx = {
        console: { warn() {}, log() {}, error() {} },
        process, db, wa: waStub, require,
        module: { exports: {} },
      };
      vm.runInNewContext(resolveCode + "\nglobalThis.__resolve = resolveWebhookAccount;", ctx);
      return ctx.__resolve;
    };

    // 1. An account with its own secret is verified with that secret, never
    //    with the process-wide one.
    let resolve = resolveIn(rowsFor({ id: 9, user_id: 41, phone_number_id: "A", is_enabled: 1, app_secret: "tenant-two-secret" }, null, null));
    let account = await resolve("A");
    assert.equal(account.sessionKey, "41");
    assert.equal(account.appSecret, "tenant-two-secret", "the sender's own app_secret is used, not WA_APP_SECRET");

    // 2. A sender with no stored secret falls back to env (documented, logged).
    resolve = resolveIn(rowsFor({ id: 10, user_id: 42, phone_number_id: "B", is_enabled: 1, app_secret: null }, null, null));
    account = await resolve("B");
    assert.equal(account.appSecret, "process-wide-secret", "env fallback used only when the row has no secret of its own");

    // 3. A secret that cannot be read fails CLOSED rather than substituting
    //    the process-wide secret - otherwise a different Meta app's key would
    //    be trusted for this sender.
    resolve = resolveIn(rowsFor({ id: 11, user_id: 43, phone_number_id: "C", is_enabled: 1, app_secret: "deadbeef:cafebabe" }, null, null));
    assert.equal(await resolve("C"), null, "undecryptable secret => reject, never substitute WA_APP_SECRET");

    // 4. Disabled config is rejected.
    resolve = resolveIn(rowsFor({ id: 12, user_id: 44, phone_number_id: "D", is_enabled: 0, app_secret: "s" }, null, null));
    assert.equal(await resolve("D"), null, "disabled configuration rejects");

    // 5. wa_accounts branch: session owner + own secret.
    resolve = resolveIn(rowsFor(null, { id: 3, created_by: 77, phone_number_id: "E", is_active: 1, app_secret: "acct-secret" }, null));
    account = await resolve("E");
    assert.equal(account.sessionKey, "77");
    assert.equal(account.appSecret, "acct-secret");

    // 6. wa_senders branch: attributed to the owning organization's user.
    resolve = resolveIn(rowsFor(null, null, { id: 5, tenant_id: 1, phone_number_id: "F", app_secret: "sender-secret", owner_user_id: 41 }));
    account = await resolve("F");
    assert.equal(account.sessionKey, "41", "sender resolves to a user in its own organization");
    assert.equal(account.tenantId, 1);
    assert.equal(account.appSecret, "sender-secret");

    // 7. wa_senders with no user to own the traffic => reject.
    resolve = resolveIn(rowsFor(null, null, { id: 6, tenant_id: 2, phone_number_id: "G", app_secret: "s", owner_user_id: null }));
    assert.equal(await resolve("G"), null, "a sender whose organization has no user cannot be attributed");

    // 8. Unknown sender, not the env sender => reject.
    resolve = resolveIn(rowsFor(null, null, null));
    assert.equal(await resolve("unknown-id"), null, "unknown phone_number_id rejects");

    // 9. The env sender resolves to the system organization with the env secret.
    resolve = resolveIn(rowsFor(null, null, null));
    account = await resolve("env-sender-id");
    assert.equal(account.appSecret, "process-wide-secret", "env sender verified with the env secret");
    assert.equal(account.tenantId, 1, "env sender belongs to the system organization");

    // 10. A lookup failure is a rejection, not a resolvable sender.
    resolve = resolveIn(fakeDb([["SELECT * FROM user_wa_configs WHERE phone_number_id", () => new Error("db down")]]));
    assert.equal(await resolve("A"), null, "a failed lookup fails closed");

    // ── schema parity: SQLite must create the columns MySQL creates ─────────
    const sqliteSchema = fs.readFileSync(require.resolve("../config/sqliteDatabase"), "utf8");
    const mysqlSchema = fs.readFileSync(require.resolve("../services/waDatabase"), "utf8");
    const sqliteBlock = sqliteSchema.slice(sqliteSchema.indexOf("CREATE TABLE IF NOT EXISTS user_wa_configs"));
    assert.match(sqliteBlock, /app_secret/, "SQLite user_wa_configs declares app_secret");
    assert.match(sqliteBlock, /verify_token/, "SQLite user_wa_configs declares verify_token");
    assert.match(mysqlSchema, /verify_token VARCHAR\(255\) DEFAULT 'crm_verify_123'/, "MySQL user_wa_configs declares verify_token");

    // The migration must also repair databases created before the fix.
    const migration = fs.readFileSync(require.resolve("../migrations/enterprise_multi_tenant_multi_branch"), "utf8");
    assert.match(migration, /ensureColumn\("user_wa_configs", "app_secret"/, "migration backfills user_wa_configs.app_secret");
    assert.match(migration, /ensureColumn\("user_wa_configs", "verify_token"/, "migration backfills user_wa_configs.verify_token");

    console.log("PASS: per-account verify tokens accepted from all four sources, unknown token 403 (not 503), broken source skipped, all-broken 503, sender's own app_secret preferred and never substituted");
  } finally {
    restore();
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
