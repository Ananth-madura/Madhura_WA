#!/usr/bin/env node
/**
 * test-zero-config.js — prove the service boots and serves with NO environment
 * variables at all.
 *
 * This reproduces the exact Render failure: a container built fine, then exited
 * with every variable reported missing, including PUBLIC_BASE_URL and
 * ALLOWED_ORIGINS, which were present in render.yaml. The service had been
 * created by hand, so none of the blueprint's variables reached it.
 *
 * Asserts:
 *   1. Zero-config production boot succeeds and /health answers 200.
 *   2. Non-secret values are defaulted, and /health lists exactly which.
 *   3. JWT_SECRET is generated, never hardcoded — so it differs per process and
 *      cannot be read out of the repository.
 *   4. The generated secret is genuinely random, not a public constant.
 *   5. /health reports the database as degraded and /api answers 503.
 *   6. REQUIRE_HARD_CONFIG=1 still refuses to boot (the safety valve).
 *   7. A real environment variable still wins over a default.
 */
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const os = require("os");

const ROOT = path.join(__dirname, "..");

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
};

/**
 * A deliberately empty environment: NODE_ENV and PORT only.
 *
 * WA_SKIP_DOTENV is essential here. Without it, dotenv loads the developer's
 * local .env and quietly supplies DB_NAME and friends — so the "zero config" test
 * passes using values from disk and proves nothing. That is exactly how a
 * missing-DB_NAME crash in config/database.js survived every local run and only
 * appeared on Render, where there is no .env to rescue it.
 */
function bareEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("npm_") || k === "PSModulePath" || k.includes("CHROME") || k.includes("PUPPETEER")) continue;
    env[k] = v;
  }
  for (const k of ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASS", "DB_NAME", "JWT_SECRET",
                   "PUBLIC_BASE_URL", "ALLOWED_ORIGINS", "ALLOWED_ORIGIN", "WA_DATA_DIR",
                   "WA_ENABLE_WEB_ENGINE", "ALLOW_START_WITHOUT_DB", "REQUIRE_HARD_CONFIG",
                   "PORT", "TZ", "WA_MESSAGE_INTERVAL", "WA_SKIP_DOTENV", "DB_ENGINE", "USE_SQLITE"]) delete env[k];
  return { ...env, NODE_ENV: "production", WA_SKIP_DOTENV: "1", DISABLE_R2: "1", ...extra };
}

const get = (port, urlPath) =>
  new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: urlPath, timeout: 5000 }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => resolve({ status: res.statusCode, body: b }));
    });
    req.on("error", (e) => resolve({ status: 0, body: `connection error: ${e.code || e.message}` }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
  });

function boot(env, port, waitMs = 13000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve({ ...r, log, child }); } };
    setTimeout(async () => done({
      health: await get(port, "/health"),
      api: await get(port, "/api/auth/login"),
      exited: null,
    }), waitMs);
    child.on("exit", (code) => done({ health: { status: null, body: "exited" }, api: {}, exited: code }));
  });
}

(async () => {
  console.log("zero-config boot\n" + "=".repeat(68) + "\n");

  // ── unit: defaults + generated secret ─────────────────────────────────────
  const { applyDefaults, ensureJwtSecret } = require(path.join(ROOT, "config", "runtimeDefaults.js"));

  const e1 = {};
  const r1 = applyDefaults(e1);
  check("non-secret values are defaulted", r1.applied.length > 0, `${r1.applied.length} defaulted`);
  check("PUBLIC_BASE_URL gets a working default", /^https:\/\//.test(e1.PUBLIC_BASE_URL || ""), e1.PUBLIC_BASE_URL);
  check("ALLOWED_ORIGINS gets a working default", /^https:\/\//.test(e1.ALLOWED_ORIGINS || ""));
  check("ALLOW_START_WITHOUT_DB defaults on", e1.ALLOW_START_WITHOUT_DB === "1");

  // a real value must win
  const e2 = { PUBLIC_BASE_URL: "https://custom.example.com" };
  applyDefaults(e2);
  check("a real environment variable wins over a default", e2.PUBLIC_BASE_URL === "https://custom.example.com");

  // JWT_SECRET is generated, not hardcoded
  const g1 = {}, g2 = {};
  const s1 = ensureJwtSecret(g1), s2 = ensureJwtSecret(g2);
  check("JWT_SECRET is generated when absent", Boolean(g1.JWT_SECRET) && s1.ephemeral === true);
  check("two generations differ (not a constant in the repo)", g1.JWT_SECRET !== g2.JWT_SECRET);
  check("generated secret is long and random", /^[0-9a-f]{96}$/.test(g1.JWT_SECRET), `${g1.JWT_SECRET.length} hex chars`);
  const g3 = { JWT_SECRET: "a-real-configured-secret-value" };
  check("a configured JWT_SECRET is left alone", ensureJwtSecret(g3).ephemeral === false && g3.JWT_SECRET === "a-real-configured-secret-value");
  const g4 = { JWT_SECRET: "CHANGE_ME" };
  check("a CHANGE_ME placeholder is replaced, not used", ensureJwtSecret(g4).ephemeral === true && g4.JWT_SECRET !== "CHANGE_ME");

  // ── integration: boot with nothing configured ────────────────────────────
  console.log("\nbooting the real server with zero environment variables\n" + "=".repeat(68) + "\n");
  const run = await boot(bareEnv({ PORT: "5621" }), 5621);
  let h = {};
  try { h = JSON.parse(run.health.body); } catch {}

  check("server booted with zero config", !run.exited, run.exited !== null ? `exited ${run.exited}\n${run.log.split("\n").slice(-8).join("\n        ")}` : "still running");
  check("/health answered 200", run.health.status === 200, `status ${run.health.status}`);
  check("/health lists the defaulted values", Array.isArray(h.defaultedValues) && h.defaultedValues.length > 0, JSON.stringify(h.defaultedValues));
  check("/health flags the generated JWT secret", h.ephemeralJwtSecret === true);
  check("/health is honest about the database", h.degraded === true && h.ok === false, `ok=${h.ok} degraded=${h.degraded}`);
  check("/api answers 503 while degraded", run.api.status === 503, `status ${run.api.status}`);
  check("boot log explains the defaults", /defaulted/.test(run.log));
  try { run.child.kill(); } catch {}

  // ── strict mode still refuses ─────────────────────────────────────────────
  const strict = await boot(bareEnv({ PORT: "5622", REQUIRE_HARD_CONFIG: "1" }), 5622, 11000);
  check("REQUIRE_HARD_CONFIG=1 still refuses to boot", strict.exited !== null, `exited ${strict.exited}`);
  check("strict refusal names the variables", /CONFIGURATION ERRORS/.test(strict.log));
  try { strict.child.kill(); } catch {}

  console.log("\n" + "=".repeat(68));
  console.log(failures === 0 ? "zero-config boot confirmed" : `${failures} check(s) failed`);
  process.exit(failures ? 1 : 0);
})();
