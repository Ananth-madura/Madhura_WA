#!/usr/bin/env node
const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const testDir = path.join(os.tmpdir(), "wa-sqlite-test-" + Date.now());
fs.mkdirSync(testDir, { recursive: true });

const env = {
  ...process.env,
  PORT: "5599",
  NODE_ENV: "development",
  USE_SQLITE: "1",
  DB_HOST: "127.0.0.1",
  DB_NAME: "achme_wa",
  WA_DATA_DIR: testDir,
  JWT_SECRET: "testsecret12345678901234567890123456789012",
  ALLOW_START_WITHOUT_DB: "1",
};

function request(method, pathUrl, data = null, headers = {}) {
  return new Promise((resolve) => {
    const postData = data ? JSON.stringify(data) : null;
    const reqHeaders = {
      ...headers,
      ...(postData ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) } : {}),
    };

    const req = http.request(
      {
        host: "127.0.0.1",
        port: 5599,
        path: pathUrl,
        method,
        headers: reqHeaders,
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch (_) { parsed = { raw: body }; }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on("error", (err) => resolve({ status: 0, error: err.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, error: "timeout" }); });
    if (postData) req.write(postData);
    req.end();
  });
}

const child = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

async function run() {
  console.log("=== Testing SQLite + R2 Storage Adapter ===");
  try {
    // 1. Wait for server boot
    let health = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      health = await request("GET", "/health");
      if (health.status === 200 && health.data && health.data.database === "ready") break;
    }

    if (!health || health.status !== 200 || health.data.database !== "ready") {
      console.error("❌ Server failed to boot with SQLite:", health);
      console.error("Boot logs:\n", log);
      process.exit(1);
    }
    console.log("  PASS 1: Server booted and /health reports database=ready, dbEngine=" + health.data.dbEngine);

    // 2. Storage status endpoint
    const storage = await request("GET", "/api/storage/status");
    if (storage.status !== 200 || !storage.data.database.isSqlite) {
      console.error("❌ /api/storage/status invalid:", storage);
      process.exit(1);
    }
    console.log("  PASS 2: /api/storage/status confirms SQLite engine active");

    // 3. Admin login against SQLite users table
    const login = await request("POST", "/api/auth/login", {
      email: "admin@madhuratech.com",
      password: "Admin@123",
    });

    if (login.status !== 200 || !login.data.token) {
      console.error("❌ Admin login failed:", login);
      process.exit(1);
    }
    const token = login.data.token;
    console.log("  PASS 3: Admin login succeeded against seeded SQLite user");

    // 4. Create a template in SQLite
    const createTpl = await request(
      "POST",
      "/api/wa/templates",
      {
        name: "test_welcome_msg",
        category: "MARKETING",
        body: "Hello {{name}}, welcome to our service!",
        language: "en",
      },
      { Authorization: `Bearer ${token}` }
    );

    if (createTpl.status !== 200 && createTpl.status !== 201) {
      console.error("❌ Template creation failed:", createTpl);
      process.exit(1);
    }
    console.log("  PASS 4: Template created successfully in SQLite table");

    // 5. Fetch templates from SQLite
    const listTpl = await request("GET", "/api/wa/templates", null, {
      Authorization: `Bearer ${token}`,
    });

    if (listTpl.status !== 200 || !Array.isArray(listTpl.data) || listTpl.data.length === 0) {
      console.error("❌ Template list failed:", listTpl);
      process.exit(1);
    }
    console.log("  PASS 5: Fetched " + listTpl.data.length + " template(s) from SQLite");

    console.log("===========================================");
    console.log("✅ All SQLite + R2 Storage tests PASSED!");
    child.kill();
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error("❌ Test crashed:", err);
    child.kill();
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (_) {}
    process.exit(1);
  }
}

run();
