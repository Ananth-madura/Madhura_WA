#!/usr/bin/env node
/**
 * verify-api-link.js — prove the frontend can actually reach the backend,
 * and that the backend's CORS allowlist actually admits this frontend.
 *
 * Run it BEFORE you push, and again from your laptop after you deploy:
 *
 *   cd frontend
 *   npm run verify:api
 *
 * Optional overrides:
 *   VERIFY_API_URL=https://wa-api.madhuratech.com/api/health   npm run verify:api
 *   VERIFY_SITE_URL=https://<your-vercel-domain>               npm run verify:api
 *   VERIFY_WITH_TOKEN=eyJhbGci...                              npm run verify:api
 *
 * Exit code 0 = everything wired. Exit 1 = something is broken, and the
 * output says which of the four links in the chain broke.
 */

const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env.production") });
}

const SITE_URL = (process.env.VERIFY_SITE_URL || "http://localhost:3001").replace(/\/+$/, "");
const API_URL = (process.env.VERIFY_API_URL || "http://localhost:5001").replace(/\/+$/, "");
const TOKEN = process.env.VERIFY_WITH_TOKEN || "";
const SOCKET_URL = (process.env.REACT_APP_SOCKET_URL || "").replace(/\/+$/, "");

const c = {
  ok: (s) => `\u001b[32mPASS\u001b[0m  ${s}`,
  bad: (s) => `\u001b[31mFAIL\u001b[0m  ${s}`,
  warn: (s) => `\u001b[33mWARN\u001b[0m  ${s}`,
  info: (s) => `\u001b[90m      ${s}\u001b[0m`,
};

let failures = 0;
const check = (label, ok, detail) => {
  if (ok) console.log(c.ok(label));
  else {
    failures += 1;
    console.log(c.bad(label));
  }
  if (detail) console.log(c.info(detail));
};

/**
 * Minimal HTTP client built on the core modules.
 *
 * Deliberately NOT global fetch. Two reasons:
 *
 *  1. Correctness of the exit code. On Windows, several undici (fetch) requests
 *     followed by process.exit() trips a libuv double-close assertion —
 *     "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" — which replaces
 *     the script's exit code with a crash code. A check script that cannot
 *     report a passing exit code is useless in a deploy pipeline. Reproduced on
 *     Node 26, both with and without `Connection: close`.
 *
 *  2. It works on Node 18, which Vercel still selects for some projects, where
 *     global fetch is experimental.
 */
function request(url, { method = "GET", headers = {}, timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      return reject(new Error(`bad URL: ${url}`));
    }
    const lib = parsed.protocol === "https:" ? https : http;

    const req = lib.request(
      parsed,
      { method, headers, timeout, agent: false, rejectUnauthorized: true },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
          // Hard cap so a misconfigured rewrite cannot stream a homepage into
          // memory. Health and handshake responses are tiny.
          if (body.length > 256 * 1024) {
            req.destroy();
          }
        });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: body }));
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`timeout after ${timeout}ms`));
    });
    req.on("error", reject);
    req.end();
  });
}

async function getJson(url, opts = {}) {
  const res = await request(url, opts);
  let json = null;
  try {
    json = JSON.parse(res.text);
  } catch {
    /* not json */
  }
  return { status: res.status, headers: res.headers, json, text: res.text };
}


(async () => {
  console.log("");
  console.log("  Whatsapp_CRM — frontend <-> backend link check");
  console.log("  " + "-".repeat(56));
  console.log(c.info(`site   ${SITE_URL}`));
  console.log(c.info(`api    ${API_URL}`));
  if (SOCKET_URL) console.log(c.info(`socket ${SOCKET_URL}`));
  console.log("");

  /* ── Link 1: backend is alive and reachable ─────────────────────────────── */
  let health;
  try {
    health = await getJson(`${API_URL}/health`);
    check(
      "1. Backend /health responds 200",
      health.status === 200 && health.json?.ok === true,
      `status=${health.status} body=${(health.text || "").slice(0, 120)}`
    );
  } catch (err) {
    check("1. Backend /health responds 200", false, `${err.message} — is the VPS app running? (pm2 status)`);
    console.log("");
    console.log("  Cannot continue past a dead backend. Stopping here.");
    process.exit(1);
  }

  /* ── Link 2: does the backend admit the frontend origin? ───────────────────── */
  // The Origin header must actually be sent. A GET without Origin gets no
  // Access-Control-Allow-Origin back regardless of policy, so checking a bare
  // GET reports a false failure against a correctly configured server.
  const origin = SITE_URL;
  try {
    const probe = await getJson(`${API_URL}/api/health`, { headers: { Origin: origin } });
    const reflected = probe.headers["access-control-allow-origin"];
    check(
      "2. Backend reflects the frontend origin in Access-Control-Allow-Origin",
      reflected === origin,
      reflected
        ? `got ${reflected}`
        : "header absent for this Origin — add the frontend domain to ALLOWED_ORIGINS on the backend .env"
    );
  } catch (err) {
    check("2. Backend reflects the frontend origin", false, err.message);
  }

  try {
    const pre = await request(`${API_URL}/api/health`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization",
      },
    });
    const preAcao = pre.headers["access-control-allow-origin"];
    const creds = pre.headers["access-control-allow-credentials"] === "true";
    const allowHeaders = (pre.headers["access-control-allow-headers"] || "").toLowerCase();
    check(
      "3. CORS preflight passes (methods, credentials, Authorization header)",
      pre.status >= 200 && pre.status < 300 && preAcao === origin && creds && allowHeaders.includes("authorization"),
      `status=${pre.status} allow-origin=${preAcao} allow-credentials=${pre.headers["access-control-allow-credentials"]} ` +
        `allow-headers=${pre.headers["access-control-allow-headers"]}`
    );
  } catch (err) {
    check("3. CORS preflight passes", false, err.message);
  }

  /* ── Link 4: an unknown origin is actually rejected ───────────────────────── */
  // Guards against ALLOWED_ORIGINS silently not being applied. If a random
  // origin is allowed, the allowlist is not working and the backend is one
  // reflected page away from leaking a JWT.
  try {
    const evilOrigin = "https://not-your-domain.example";
    const evil = await request(`${API_URL}/api/health`, { headers: { Origin: evilOrigin } });
    const leaked = evil.headers["access-control-allow-origin"] === evilOrigin;
    check(
      "4. Unknown origin is NOT reflected (allowlist is actually active)",
      !leaked,
      leaked
        ? "allow-origin came back for a stranger — ALLOWED_ORIGINS is not set, or NODE_ENV is not production"
        : "correctly withheld"
    );
  } catch (err) {
    check("4. Unknown origin is NOT reflected", false, err.message);
  }

  /* ── Link 5: uploads are served over the public internet ──────────────────── */
  // Meta Cloud API fetches media from PUBLIC_BASE_URL. If /uploads is not
  // publicly reachable, outbound WhatsApp media silently fails.
  try {
    const up = await getJson(`${API_URL}/uploads/`, { timeout: 8000 });
    // 404 is fine: the mount exists, there is just no directory index.
    check(
      "5. /uploads is mounted on the backend (PUBLIC_BASE_URL media path)",
      up.status !== 502 && up.status !== 503,
      `status=${up.status} ${up.status === 404 ? "(404 = mounted, no index — good)" : ""}`
    );
  } catch (err) {
    check("5. /uploads is mounted on the backend", false, err.message);
  }

  /* ── Link 6: Socket.IO handshake ─────────────────────────────────────────── */
  const sockTarget = SOCKET_URL || API_URL;
  try {
    const hs = await getJson(
      `${sockTarget}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`
    );
    const body = hs.text || "";
    check(
      "6. Socket.IO handshake answers (polling transport)",
      hs.status === 200 && body.includes("sid") && body.includes("upgrades"),
      `status=${hs.status} ${body.slice(0, 90)}`
    );
    if (SOCKET_URL && !SOCKET_URL.includes("localhost")) {
      const sockAcao = hs.headers["access-control-allow-origin"];
      check(
        "7. Socket.IO origin is allowlisted for the direct (non-Vercel) socket",
        sockAcao === SITE_URL,
        `allow-origin=${sockAcao} (expected ${SITE_URL})`
      );
    } else {
      console.log(c.warn("7. Skipped: no REACT_APP_SOCKET_URL set, socket rides the same-origin path"));
    }

  } catch (err) {
    check("6. Socket.IO handshake answers (polling transport)", false, `${err.message} — check nginx proxy_set_header Upgrade on /socket.io/`);
  }

  /* ── Link 8: authenticated round trip ────────────────────────────────────── */
  if (TOKEN) {
    try {
      const me = await getJson(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      check(
        "8. Authenticated GET /api/auth/me returns 200",
        me.status === 200,
        `status=${me.status} ${(me.text || "").slice(0, 120)}`
      );
    } catch (err) {
      check("8. Authenticated round trip", false, err.message);
    }
  } else {
    console.log(c.warn("8. Skipped: set VERIFY_WITH_TOKEN=<jwt> to test an authenticated call"));
  }

  console.log("");
  console.log("  " + "-".repeat(56));
  if (failures === 0) {
    console.log("  \u001b[32mAll links good. Ship it.\u001b[0m");
    console.log("");
    process.exit(0);
  }
  console.log(`  \u001b[31m${failures} link(s) broken.\u001b[0m See DEPLOYMENT.md for the matching fix.`);
  console.log("");
  process.exit(1);
})();

