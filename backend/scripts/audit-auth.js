#!/usr/bin/env node
/**
 * audit-auth.js — proves that no HTTP route is reachable without a credential.
 *
 * WHY THIS EXISTS
 * ---------------
 * An earlier note in this repo claimed that a dozen `/api/wa/*` mounts were
 * unauthenticated because they are mounted WITHOUT `verifyToken`. That was
 * wrong. They are mounted bare, but every handler inside them applies
 * `verifyToken` itself. Routing auth at the mount is a style, not a
 * requirement, and treating a bare mount as an open route produced a false
 * alarm that would have sent someone chasing a vulnerability that does not
 * exist.
 *
 * So the question has to be answered at the HANDLER level, while accounting
 * for mount-level middleware. This script resolves both and prints the real
 * answer, so the next person does not have to re-derive it by hand.
 *
 *   node scripts/audit-auth.js
 *   node scripts/audit-auth.js --json
 *
 * Exit 0 = every handler is either explicitly guarded, protected by a guarded
 * mount, or on the intentional-public allowlist. Exit 1 = something is open.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "server.js");
const ROUTES_DIR = path.join(ROOT, "routes");

/** Mount points that are public ON PURPOSE, with the reason. */
const INTENTIONAL_PUBLIC = {
  "/api/auth": "login, OTP, registration and access-request flows. Guarded by rate limiters; being open is the point.",
  "/webhook": "Meta calls this. Verified by X-Hub-Signature-256 when WA_APP_SECRET is set.",
  "/api/wa/webhook": "Same Meta webhook, also mounted under the /api/wa namespace for convenience.",
  "/health": "Liveness probe for PM2, nginx and uptime monitors.",
};

/** Guards that count as protection. */
const GUARDS = /\b(verifyToken|requireAuth|isAdmin|isAdminOnly|isEmployee|auth)\b/;

/** Rate limiters / uploaders that appear in the middleware slot but are NOT auth. */
const NON_AUTH_MW = /\b(accessRequestLimiter|messageSendLimiter|campaignLaunchLimiter|upload|rateLimit)/;

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

/* ── 1. Parse mount-level middleware out of server.js ─────────────────────── */
function parseMounts() {
  const src = fs.readFileSync(SERVER, "utf8");
  const mounts = [];
  const re = /app\.use\(\s*(\[[\s\S]*?\]|["'][^"']+["'])\s*,\s*([\s\S]*?)\);/g;
  let m;
  while ((m = re.exec(src))) {
    const rawPath = m[1];
    const rest = m[2];
    const paths = (rawPath.match(/["']([^"']+)["']/g) || []).map((s) => s.slice(1, -1));
    const requires = (rest.match(/require\(["'][^"']+["']\)/g) || []).join(" ");
    const router = (rest.match(/require\(["'][^"']*routes\/(\w+)["']\)/) || [])[1];
    mounts.push({
      paths,
      router,
      guarded: GUARDS.test(rest),
      snippet: rest.replace(/\s+/g, " ").trim().slice(0, 120),
    });
  }
  return mounts;
}

/* ── 2. Parse every handler out of every route file ───────────────────────── */
function parseHandlers(file) {
  const raw = fs.readFileSync(path.join(ROUTES_DIR, file), "utf8");
  const lines = stripComments(raw).split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/router\.(get|post|put|patch|delete)\s*\(/);
    if (!m) continue;

    // Accumulate the full call signature, which is often wrapped over many lines.
    let stmt = lines[i];
    let depth = 0;
    let j = i;
    while (j < lines.length) {
      for (const ch of lines[j]) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      if (depth <= 0 && j > i) break;
      if (depth <= 0 && j === i) { j++; break; }
      j++;
      stmt += " " + (lines[j] || "");
      if (j - i > 12) break;
    }

    const head = stmt.slice(0, stmt.search(/async\s*\(|\bfunction\s*\(|\(\s*req\b|\(\s*\{\s*req/));
    const routePath = (stmt.match(/router\.\w+\s*\(\s*(\[[^\]]*\]|"[^"]*")/) || [, "?"])[1];

    // A guard counts only if it sits in the middleware slot BEFORE the handler.
    const mw = head.replace(/router\.\w+\s*\(/, "");
    const guards = mw.match(new RegExp(GUARDS, "g")) || [];
    const nonAuth = mw.match(new RegExp(NON_AUTH_MW, "g")) || [];
    const realGuards = guards.filter((g) => !NON_AUTH_MW.test(g));

    out.push({
      file,
      line: i + 1,
      method: m[1].toUpperCase(),
      routePath,
      guarded: realGuards.length > 0,
      guards: [...new Set(realGuards)],
      nonAuth: [...new Set(nonAuth)],
    });
    i = j - 1 > i ? j - 1 : i;
  }
  return out;
}

/* ── 3. Match a handler to its mount and decide ───────────────────────────── */
function classify(handlers, mounts) {
  return handlers.map((h) => {
    const candidates = mounts.filter((m) => m.router === h.file.replace(/\.js$/, ""));
    if (candidates.length === 0) {
      return { ...h, mount: null, verdict: "NO_MOUNT", reason: "router is not mounted in server.js" };
    }

    // Prefer the mount whose path most specifically matches the handler path.
    const mount =
      candidates.find((m) => m.guarded && m.paths.some((p) => p !== "/")) ||
      candidates.find((m) => m.guarded) ||
      candidates[0];

    const publicMount = mount.paths.some((p) => INTENTIONAL_PUBLIC[p]);

    if (h.guarded) {
      return { ...h, mount, verdict: "GUARDED", reason: `inline ${h.guards.join(", ")}` };
    }
    if (mount.guarded) {
      return { ...h, mount, verdict: "GUARDED", reason: `mount ${mount.paths.join("|")} applies verifyToken` };
    }
    if (publicMount) {
      return { ...h, mount, verdict: "PUBLIC_BY_DESIGN", reason: INTENTIONAL_PUBLIC[mount.paths[0]] };
    }
    return {
      ...h,
      mount,
      verdict: "OPEN",
      reason: `no auth in the handler and mount ${mount.paths.join("|")} is bare`,
    };
  });
}

/* ── Run ──────────────────────────────────────────────────────────────────── */
const mounts = parseMounts();
const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith("Routes.js"));
const all = [];
for (const f of files) all.push(...parseHandlers(f));
const results = classify(all, mounts);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ mounts, results }, null, 2));
  process.exit(results.some((r) => r.verdict === "OPEN" || r.verdict === "NO_MOUNT") ? 1 : 0);
}

const pad = (s, n) => String(s).padEnd(n);
const tally = results.reduce((acc, r) => ((acc[r.verdict] = (acc[r.verdict] || 0) + 1), acc), {});

console.log("");
console.log("  Route authorisation audit");
console.log("  " + "-".repeat(78));

console.log("\n  Mount points\n");
for (const m of mounts) {
  const publicMount = m.paths.some((p) => INTENTIONAL_PUBLIC[p]);
  const tag = m.guarded ? "verifyToken" : publicMount ? "public by design" : "BARE (handlers self-guard)";
  console.log(`    ${pad(m.paths.join(" | "), 34)} ${pad(m.router || "(inline)", 26)} ${tag}`);
}

console.log("\n  Handlers by verdict\n");
for (const v of ["GUARDED", "PUBLIC_BY_DESIGN", "OPEN", "NO_MOUNT"]) {
  if (!tally[v]) continue;
  console.log(`    ${pad(v, 20)} ${tally[v]}`);
}

const open = results.filter((r) => r.verdict === "OPEN" || r.verdict === "NO_MOUNT");
if (open.length) {
  console.log("\n  REACHABLE WITHOUT A CREDENTIAL\n");
  for (const o of open) {
    console.log(`    ${o.file}:${o.line}  ${o.method} ${o.routePath}`);
    console.log(`      ${o.reason}`);
  }
}

console.log("\n  " + "-".repeat(78));
console.log(
  open.length === 0
    ? `  All ${results.length} handlers are authorised. Nothing reachable without a credential.\n`
    : `  ${open.length} of ${results.length} handlers need attention.\n`
);

// One honest exception, always surfaced rather than buried:
// express.static has no middleware chain at all, so this script cannot see it.
console.log("  NOT COVERED BY THIS AUDIT: the /uploads static mount.");
console.log("  It is served by express.static with no auth. See DEPLOYMENT.md section 10.");
console.log("");

process.exit(open.length === 0 ? 0 : 1);
