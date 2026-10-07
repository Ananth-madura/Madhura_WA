#!/usr/bin/env node
/**
 * test-cors-policy.js — proves the origin allowlist behaves, without booting
 * the app and without needing a running server.
 *
 *   node scripts/test-cors-policy.js
 *
 * The policy in config/corsPolicy.js is the difference between "the backend
 * answers requests" and "the backend answers requests *only* from the frontend".
 * A silent regression here is the kind that shows up as a mystery CORS error in
 * a browser console hours later, so it gets its own check.
 */

const { createCorsOrigin, describePolicy } = require("../config/corsPolicy");

const SITE = "https://app.example.com";
const WWW = "https://www.example.com";

const PROD = {
  NODE_ENV: "production",
  ALLOWED_ORIGINS: `${SITE},${WWW}`,
};
const PROD_EMPTY = { NODE_ENV: "production", ALLOWED_ORIGINS: "" };
const PROD_SLOPPY = { NODE_ENV: "production", ALLOWED_ORIGINS: ` ${SITE}/ , ,${WWW} ` };
const DEV = { NODE_ENV: "development", ALLOWED_ORIGINS: "" };
const DEV_LISTED = { NODE_ENV: "development", ALLOWED_ORIGINS: SITE };

/** @returns {boolean} whether the policy allows the origin */
const allows = (env, origin) => {
  const fn = createCorsOrigin(env);
  let verdict = null;
  fn(origin, (_err, allow) => {
    verdict = allow;
  });
  if (verdict === null) throw new Error(`policy did not call back for origin=${origin}`);
  return verdict;
};

const cases = [
  // [label, env, origin, expectedAllowed]
  ["prod + the real frontend", PROD, SITE, true],
  ["prod + www (listed separately)", PROD, WWW, true],
  ["prod + trailing slash", PROD, `${SITE}/`, true],
  ["prod + lookalike subdomain", PROD, "https://app.example.com.evil.test", false],
  ["prod + suffix attack", PROD, `${SITE}.evil.test`, false],
  ["prod + http instead of https", PROD, `http://app.example.com`, false],
  ["prod + port appended", PROD, `${SITE}:443`, false],
  ["prod + a stranger", PROD, "https://not-your-domain.example", false],
  ["prod + localhost", PROD, "http://localhost:3001", false],
  ["prod + LAN ip", PROD, "http://192.168.0.131:3001", false],
  ["prod, ALLOWED_ORIGINS empty + real site", PROD_EMPTY, SITE, false],
  ["prod, ALLOWED_ORIGINS empty + localhost", PROD_EMPTY, "http://localhost:3001", false],
  ["prod + no Origin (curl/webhook/API-key)", PROD, undefined, true],
  ["prod + empty string Origin", PROD, "", true],
  ["sloppy env (spaces, empty items, trailing slash)", PROD_SLOPPY, SITE, true],
  ["sloppy env + www", PROD_SLOPPY, WWW, true],
  ["sloppy env + stranger", PROD_SLOPPY, "https://evil.test", false],
  ["dev + localhost", DEV, "http://localhost:3001", true],
  ["dev + 127.0.0.1", DEV, "http://127.0.0.1:5173", true],
  ["dev + LAN ip (reflect-all convenience)", DEV, "http://192.168.0.131:3001", true],
  ["dev + any stranger", DEV, "https://whatever.test", true],
  ["dev with list set + LAN ip is refused", DEV_LISTED, "http://192.168.0.131:3001", false],
  ["dev with list set + listed origin", DEV_LISTED, SITE, true],
  [
    "prod wildcard match Vercel preview",
    { NODE_ENV: "production", ALLOWED_ORIGINS: "https://madhura-wa.vercel.app,https://*-madhura.vercel.app" },
    "https://madhura-ohyc9pp2x-madhura.vercel.app",
    true,
  ],
  [
    "prod wildcard reject external attacker",
    { NODE_ENV: "production", ALLOWED_ORIGINS: "https://madhura-wa.vercel.app,https://*-madhura.vercel.app" },
    "https://madhura-ohyc9pp2x-madhura.vercel.app.evil.test",
    false,
  ],
];

let failures = 0;
console.log("");
console.log("  CORS origin policy");
console.log("  " + "-".repeat(70));

for (const [label, env, origin, expected] of cases) {
  const actual = allows(env, origin);
  const ok = actual === expected;
  if (!ok) failures += 1;
  const shown = origin === undefined ? "(no Origin header)" : origin;
  console.log(
    `  ${ok ? "\u001b[32mPASS\u001b[0m" : "\u001b[31mFAIL\u001b[0m"}  ${label.padEnd(46)} ${shown} -> ${actual ? "allow" : "deny"}`
  );
}

/* The property that actually matters: in production, nothing outside the
   allowlist is ever reflected. Assert it over a batch of hostile origins so a
   future refactor cannot quietly reintroduce reflect-all. */
console.log("");
const HOSTILE = [
  "https://evil.test",
  "https://app.example.com.evil.test",
  "https://evil.test/app.example.com",
  "https://APP.EXAMPLE.COM",
  "https://app.example.com:8443",
  "http://app.example.com",
  "https://xn--app-example-com.test",
  "null",
  "https://attacker.test",
];
const leaks = HOSTILE.filter((o) => allows(PROD, o));
if (leaks.length) {
  failures += 1;
  console.log(`  \u001b[31mFAIL\u001b[0m  production allowlist leaked to: ${leaks.join(", ")}`);
} else {
  console.log(`  \u001b[32mPASS\u001b[0m  production allowlist leaks to none of ${HOSTILE.length} hostile origins`);
}

/* The policy must never throw, because a throw becomes an opaque 500 for the
   client instead of a clean browser-side block. */
let threw = null;
try {
  createCorsOrigin(PROD)("https://evil.test", () => {});
} catch (e) {
  threw = e;
}
if (threw) {
  failures += 1;
  console.log(`  \u001b[31mFAIL\u001b[0m  policy threw instead of returning false: ${threw.message}`);
} else {
  console.log("  \u001b[32mPASS\u001b[0m  refused origins return false rather than throwing (no opaque 500s)");
}

console.log("");
console.log(`  prod describe(): ${describePolicy(PROD)}`);
console.log(`  prod empty     : ${describePolicy(PROD_EMPTY)}`);
console.log(`  dev            : ${describePolicy(DEV)}`);
console.log("");
console.log("  " + "-".repeat(70));
if (failures === 0) {
  console.log(`  \u001b[32mAll ${cases.length + 2} policy checks passed.\u001b[0m\n`);
  process.exit(0);
}
console.log(`  \u001b[31m${failures} policy check(s) failed.\u001b[0m\n`);
process.exit(1);
