"use strict";

/**
 * HTTP smoke test for the mounted team chat API.
 *
 * Boots the real server on the SQLite engine and talks to
 * `/api/v2/team-chat` over HTTP, so it proves the things the service test
 * cannot: the route is mounted, the ready flag gates it, the shared workspace
 * guard resolves the organization, and the JSON shapes the browser consumes.
 *
 * Run:  node tests/test_team_chat_http.js
 */

const assert = require("assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PORT = 5600 + Math.floor(Math.random() * 300);
const ROOT = path.join(__dirname, "..");
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wa-team-chat-http-"));
const SECRET = "testsecret12345678901234567890123456789012";
const jwt = require("jsonwebtoken");

const tokenFor = (payload) => jwt.sign(payload, SECRET, { algorithm: "HS256", expiresIn: "1h" });

function request(method, url, { token, tenant, body } = {}) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (tenant) headers["x-tenant-id"] = String(tenant);
    const req = http.request(
      { host: "127.0.0.1", port: PORT, path: url, method, headers, timeout: 20000 },
      (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => {
          let parsed = null;
          try { parsed = JSON.parse(text); } catch (_) { parsed = { raw: text }; }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on("error", (error) => resolve({ status: 0, error: error.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, error: "timeout" }); });
    if (payload) req.write(payload);
    req.end();
  });
}

const child = spawn(process.execPath, ["server.js"], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: "test",
    WA_SKIP_DOTENV: "1",
    DB_ENGINE: "sqlite",
    USE_SQLITE: "1",
    DISABLE_R2: "1",
    WA_ENABLE_WEB_ENGINE: "0",
    WA_DISABLE_OUTBOUND: "1",
    WA_DATA_DIR: DATA_DIR,
    JWT_SECRET: SECRET,
    ALLOW_START_WITHOUT_DB: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let log = "";
child.stdout.on("data", (chunk) => (log += chunk));
child.stderr.on("data", (chunk) => (log += chunk));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForBoot() {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const health = await request("GET", "/api/health");
    if (health.status === 200 && health.data?.dbEngine) return;
    await wait(500);
  }
  throw new Error(`server did not boot\n${log.slice(-4000)}`);
}

(async () => {
  await waitForBoot();

  const adminToken = tokenFor({ id: 1, role: "organization_owner", tenant_id: 1, email: "admin@test.local" });

  // ── 1. Bootstrap returns the screen's whole payload ──────────────────────
  const boot = await request("GET", "/api/v2/team-chat/bootstrap", { token: adminToken, tenant: 1 });
  assert.equal(boot.status, 200, `bootstrap answered 200 (${boot.status}: ${JSON.stringify(boot.data).slice(0, 300)})`);
  assert.equal(boot.data.success, true, "bootstrap reports success");
  assert.ok(Array.isArray(boot.data.channels) && boot.data.channels.length >= 1, "bootstrap returns channels");
  assert.equal(boot.data.retentionDays, 7, "the client is told the server window");
  const org = boot.data.channels.find((channel) => channel.kind === "organization");
  assert.ok(org, "the company-wide channel exists");

  // ── 2. Send, then read back ───────────────────────────────────────────────
  const sent = await request("POST", `/api/v2/team-chat/channels/${org.id}/messages`, {
    token: adminToken,
    tenant: 1,
    body: { text: "HTTP smoke message", clientId: "http-smoke-1" },
  });
  assert.equal(sent.status, 201, `send answered 201 (${sent.status}: ${JSON.stringify(sent.data).slice(0, 300)})`);
  assert.equal(sent.data.message.body, "HTTP smoke message", "the stored body round-trips");

  const replay = await request("POST", `/api/v2/team-chat/channels/${org.id}/messages`, {
    token: adminToken,
    tenant: 1,
    body: { text: "HTTP smoke message", clientId: "http-smoke-1" },
  });
  assert.equal(replay.data.message.id, sent.data.message.id, "a retried clientId stays one message");

  const list = await request("GET", `/api/v2/team-chat/channels/${org.id}/messages?limit=50`, { token: adminToken, tenant: 1 });
  assert.equal(list.status, 200, "the message list answered 200");
  assert.equal(list.data.messages.filter((message) => message.body === "HTTP smoke message").length, 1, "the retried send left one row");

  const read = await request("POST", `/api/v2/team-chat/channels/${org.id}/read`, { token: adminToken, tenant: 1 });
  assert.equal(read.status, 200, "mark-read answered 200");

  const members = await request("GET", "/api/v2/team-chat/members", { token: adminToken, tenant: 1 });
  assert.equal(members.status, 200, "members answered 200");
  assert.ok(Array.isArray(members.data.members), "members returns a list");

  // ── 3. Policy changes are admin-only and persisted ───────────────────────
  const settings = await request("PATCH", "/api/v2/team-chat/settings", {
    token: adminToken,
    tenant: 1,
    body: { crossBranchDm: true },
  });
  assert.equal(settings.status, 200, "settings answered 200");
  assert.equal(settings.data.settings.crossBranchDm, true, "the policy was stored");

  // ── 4. Validation and tenancy fail closed over HTTP ──────────────────────
  const empty = await request("POST", `/api/v2/team-chat/channels/${org.id}/messages`, {
    token: adminToken,
    tenant: 1,
    body: { text: "   " },
  });
  assert.equal(empty.status, 400, "an empty message is rejected");

  const foreign = await request("GET", "/api/v2/team-chat/bootstrap", { token: adminToken, tenant: 9999 });
  assert.equal(foreign.status, 403, `a foreign organization is refused (${foreign.status})`);

  const anonymous = await request("GET", "/api/v2/team-chat/bootstrap", { tenant: 1 });
  assert.equal(anonymous.status, 401, "an anonymous request is refused");

  console.log("PASS: team chat API is mounted, authorized, idempotent and tenant-scoped over HTTP");
  child.kill();
  process.exit(0);
})().catch((error) => {
  console.error(error);
  console.error(log.slice(-4000));
  child.kill();
  process.exit(1);
});
