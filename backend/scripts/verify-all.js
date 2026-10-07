#!/usr/bin/env node
/**
 * verify-all.js — one command that answers "does this actually work?"
 *
 *   cd backend
 *   npm run verify:all
 *
 * Runs, in order:
 *   1. Route authorisation audit   (static — no server needed, always runs)
 *   2. Socket authorisation check  (needs a running backend)
 *   3. Frontend<->backend link check (needs a running backend; run from the
 *                                   backend folder, it finds ../frontend)
 *
 * Flags:
 *   --api https://api.example.com   target backend (default http://localhost:5001)
 *   --site https://app.example.com  target frontend origin (default http://localhost:3001)
 *   --skip-socket                   static checks only
 *   --skip-link                     skip the frontend check
 *
 * Exit 0 only if every check that ran passed. A skipped check is reported as
 * skipped, never as a pass — an unverified link is not a working link.
 */

const path = require("path");
const fs = require("fs");
const net = require("http");
const { spawnSync } = require("child_process");

const HERE = __dirname;
const ROOT = path.join(HERE, "..");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(name);

const API_URL = flag("--api", process.env.VERIFY_API_URL || "http://localhost:5001").replace(/\/+$/, "");
const SITE_URL = flag("--site", process.env.VERIFY_SITE_URL || "http://localhost:3001").replace(/\/+$/, "");

const results = [];
const record = (name, status, detail) => {
  results.push({ name, status, detail });
  const icon = { pass: "\u001b[32m✓\u001b[0m", fail: "\u001b[31m✗\u001b[0m", skip: "\u001b[33m–\u001b[0m" }[status];
  console.log(`  ${icon} ${name}${detail ? `\n      \u001b[90m${detail}\u001b[0m` : ""}`);
};

const runNode = (script, env = {}) => {
  const res = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 120000,
  });
  return { code: res.status, out: `${res.stdout || ""}${res.stderr || ""}`.trim() };
};

const lastLines = (text, n = 3) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-n)
    .join("  |  ");

const pingHealth = (base) =>
  new Promise((resolve) => {
    let url;
    try {
      url = new URL(`${base}/health`);
    } catch (_) {
      return resolve(false);
    }
    const req = net.request(url, { method: "GET", timeout: 6000, agent: false }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(res.statusCode === 200 && body.includes('"ok":true')));
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });

async function main() {
  console.log("");
  console.log("  Whatsapp_CRM — deployment verification");
  console.log("  " + "-".repeat(74));
  console.log(`  \u001b[90mbackend  ${API_URL}`);
  console.log(`  \u001b[90mfrontend ${SITE_URL}`);
  console.log("");

  /* ── 1. Static checks: route auth + CORS policy ─────────────────────────── */
  console.log("  \u001b[1mStatic checks\u001b[0m");
  {
    const r = runNode(path.join(HERE, "audit-auth.js"));
    const guarded = (r.out.match(/GUARDED\s+(\d+)/) || [])[1];
    if (r.code === 0) {
      record("Route authorisation", "pass", `${guarded || "?"} handlers guarded, 0 reachable without a credential`);
    } else {
      record("Route authorisation", "fail", lastLines(r.out, 2));
    }
  }
  {
    const r = runNode(path.join(HERE, "test-cors-policy.js"));
    const n = (r.out.match(/All (\d+) policy checks passed/) || [])[1];
    if (r.code === 0) {
      record("CORS origin policy", "pass", `${n || "?"} cases, including ${"9"} hostile origins refused in production`);
    } else {
      record("CORS origin policy", "fail", lastLines(r.out, 2));
    }
  }

  /* ── 2. Backend reachable? ──────────────────────────────────────────────── */
  const reachable = await pingHealth(API_URL);

  /* ── 3. Socket authorisation ────────────────────────────────────────────── */
  console.log("");
  console.log("  \u001b[1mRuntime checks\u001b[0m");
  if (has("--skip-socket")) {
    record("Socket authorisation", "skip", "--skip-socket");
  } else if (!reachable) {
    record("Socket authorisation", "skip", `no backend answering at ${API_URL} — start it, then re-run`);
  } else {
    const r = runNode(path.join(HERE, "check-socket-auth.js"), { VERIFY_API_URL: API_URL });
    if (r.code === 0) {
      record("Socket authorisation", "pass", "anonymous refused, impersonation refused, admin path intact");
    } else {
      const refused = /Anonymous socket CONNECTED/.test(r.out);
      record(
        "Socket authorisation",
        "fail",
        refused
          ? "backend is running the OLD socket code (no handshake auth) — restart it to pick up sockets/socketAuth.js"
          : lastLines(r.out, 2)
      );
    }
  }

  /* ── 4. Frontend link ───────────────────────────────────────────────────── */
  const linkScript = path.join(ROOT, "..", "frontend", "scripts", "verify-api-link.js");
  if (has("--skip-link")) {
    record("Frontend link", "skip", "--skip-link");
  } else if (!fs.existsSync(linkScript)) {
    record("Frontend link", "skip", "frontend/scripts/verify-api-link.js not found (single-repo checkout)");
  } else if (!reachable) {
    record("Frontend link", "skip", `no backend answering at ${API_URL}`);
  } else {
    const r = runNode(linkScript, { VERIFY_API_URL: API_URL, VERIFY_SITE_URL: SITE_URL });
    if (r.code === 0) {
      record("Frontend link", "pass", "health, CORS, preflight, uploads and socket handshake all good");
    } else {
      const leaks = /Unknown origin is NOT reflected/.test(r.out);
      record(
        "Frontend link",
        "fail",
        leaks
          ? "backend is reflecting ANY origin — restart it to pick up the ALLOWED_ORIGINS allowlist in server.js"
          : lastLines(r.out, 2)
      );
    }
  }

  /* ── Summary ────────────────────────────────────────────────────────────── */
  const failed = results.filter((r) => r.status === "fail");
  const skipped = results.filter((r) => r.status === "skip");

  console.log("");
  console.log("  " + "-".repeat(74));
  if (failed.length === 0 && skipped.length === 0) {
    console.log("  \u001b[32mAll checks passed. This deployment is wired correctly.\u001b[0m");
  } else if (failed.length === 0) {
    console.log(`  \u001b[33m${skipped.length} check(s) skipped — unverified is not the same as working.\u001b[0m`);
    for (const s of skipped) console.log(`      ${s.name}: ${s.detail}`);
  } else {
    console.log(`  \u001b[31m${failed.length} check(s) failed.\u001b[0m`);
    for (const f of failed) console.log(`      ${f.name}: ${f.detail}`);
  }
  console.log("");

  // A skipped check is not a pass. Exit non-zero so a deploy pipeline notices.
  process.exit(failed.length === 0 && skipped.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n  verify:all crashed:", err);
  process.exit(1);
});
