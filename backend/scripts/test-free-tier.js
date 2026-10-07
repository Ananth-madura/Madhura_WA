#!/usr/bin/env node
/**
 * test-free-tier.js — proves the app can boot and serve in a configuration
 * shaped like Render's free tier: no database, browser engine disabled.
 *
 * This is the claim that matters for free-plan testing, so it is asserted
 * rather than assumed:
 *
 *   1. With WA_ENABLE_WEB_ENGINE=0 the server still boots and /health answers.
 *   2. /health reports the engine as disabled, so a dead QR button is explained
 *      rather than mysterious.
 *   3. Asking for a WhatsApp session fails fast with a clear message and a 503
 *      status instead of launching Chromium and being OOM-killed.
 *   4. config/webEngine.js is dependency-free, so answering /health does not
 *      pull Puppeteer into memory on a small instance.
 *   5. The default (flag unset) keeps the engine enabled.
 */
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const ROOT = path.join(__dirname, "..");

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

console.log("config/webEngine.js\n" + "=".repeat(68) + "\n");

// ── 1. pure unit checks, no server needed ──────────────────────────────────
{
  const { isWebEngineEnabled, WEB_ENGINE_DISABLED_REASON } = require(path.join(ROOT, "config", "webEngine.js"));

  check("enabled by default", isWebEngineEnabled({}) === true);
  check("enabled when explicitly 1", isWebEngineEnabled({ WA_ENABLE_WEB_ENGINE: "1" }) === true);
  for (const v of ["0", "false", "FALSE", "no", "off"]) {
    check(`disabled by "${v}"`, isWebEngineEnabled({ WA_ENABLE_WEB_ENGINE: v }) === false);
  }
  check("disabled reason is non-empty and mentions Chromium", WEB_ENGINE_DISABLED_REASON.length > 40 && /Chromium/.test(WEB_ENGINE_DISABLED_REASON));

  // 4. dependency-free: it must not pull a browser stack into memory.
  const src = require("fs").readFileSync(path.join(ROOT, "config", "webEngine.js"), "utf8");
  check(
    "no heavy requires in webEngine.js",
    !/require\(\s*["'](puppeteer|whatsapp-web\.js)/.test(src),
    "server.js requires this at boot; a browser import here would defeat the point"
  );
}

// ── 2. boot the real server in a free-tier-shaped config ────────────────────
const env = { ...process.env };
for (const k of ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASS", "DB_NAME", "JWT_SECRET",
                 "PUBLIC_BASE_URL", "ALLOWED_ORIGINS", "ALLOWED_ORIGIN", "WA_DATA_DIR",
                 "WA_ENABLE_WEB_ENGINE", "ALLOW_START_WITHOUT_DB", "PORT"]) delete env[k];
Object.assign(env, {
  NODE_ENV: "production",
  PORT: "5611",
  // No database at all, exactly like a free MySQL that has not finished booting.
  DB_HOST: "", DB_PORT: "3306", DB_USER: "", DB_PASS: "", DB_NAME: "",
  JWT_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  PUBLIC_BASE_URL: "https://madhura-wa-backend.onrender.com",
  ALLOWED_ORIGINS: "https://madhura-wa-frontend.vercel.app",
  WA_DATA_DIR: path.join(require("os").tmpdir(), "wa-free-tier-test"),
  WA_ENABLE_WEB_ENGINE: "0",
  ALLOW_START_WITHOUT_DB: "1",
});

function get(urlPath) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: 5611, path: urlPath, timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", (e) => resolve({ status: 0, body: `connection error: ${e.code || e.message}` }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
  });
}

const child = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const finish = () => {
  console.log("\n" + "=".repeat(68));
  console.log(failures === 0 ? "free-tier behaviour confirmed" : `${failures} check(s) failed`);
  process.exit(failures ? 1 : 0);
};

setTimeout(async () => {
  console.log("\nbooting the server with WA_ENABLE_WEB_ENGINE=0 and no database\n" + "=".repeat(68) + "\n");

  const health = await get("/health");
  let h = {};
  try { h = JSON.parse(health.body); } catch {}

  check("server booted and /health answered", health.status === 200, `status ${health.status}`);
  check("/health reports the Web engine disabled", h.whatsappWebEngine === "disabled", `got ${JSON.stringify(h.whatsappWebEngine)}`);
  check("/health explains why", typeof h.whatsappWebEngineHint === "string" && h.whatsappWebEngineHint.length > 20);
  check("/health is honest about the database", h.degraded === true && h.ok === false, `ok=${h.ok} degraded=${h.degraded}`);

  const api = await get("/api/auth/login");
  check("/api answers 503 while degraded", api.status === 503, `status ${api.status}`);

  check("no Chromium was launched", !/Restoring saved WhatsApp session/.test(log), "the restore path must not spawn a browser");

  // 3. session creation must fail fast with a clear, typed error.
  //
  // The flag has to be set in THIS process too, not only in the spawned child:
  // webEngine reads process.env at module load, so requiring whatsappService from
  // a shell that lacks WA_ENABLE_WEB_ENGINE=0 would exercise the enabled path
  // and launch a real browser.
  process.env.WA_ENABLE_WEB_ENGINE = "0";
  const gate = require(path.join(ROOT, "services", "whatsappService.js"));
  check("isWebEngineEnabled() exported and false", gate.isWebEngineEnabled() === false);
  let initErr = null;
  await gate.get("freetier-probe").init().catch((e) => { initErr = e; });
  check(
    "init() rejects with a clear code instead of launching a browser",
    initErr && initErr.code === "WHATSAPP_WEB_ENGINE_DISABLED",
    initErr ? `code=${initErr.code}` : "init() resolved — it would have launched Chromium"
  );
  check("rejection carries a 503 status for the routes", initErr && initErr.status === 503);
  check("rejection message is human-readable", initErr && /Chromium/.test(initErr.message));

  // Leave no probe profile behind for a stray run to pick up.
  try {
    const fs = require("fs");
    const probeDir = path.join(gate.SESSIONS_ROOT, "freetier-probe");
    if (fs.existsSync(probeDir)) fs.rmSync(probeDir, { recursive: true, force: true });
  } catch {}

  try { child.kill(); } catch {}
  finish();
}, 12000);

child.on("exit", (code) => {
  console.log(`\nserver exited early with ${code}\n${log.split("\n").slice(-15).join("\n")}`);
  failures++;
  finish();
});
