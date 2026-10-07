#!/usr/bin/env node
/**
 * run-tests.js — test runner for the suites in tests/.
 *
 * WHY THIS EXISTS
 * ---------------
 * `npm test` used to invoke jest, which could never work here. Two independent
 * reasons, both discovered by actually running it:
 *
 *   1. The `test` script passed `--setupFilesAfterEnv=./tests/setup.js`, and no
 *      such file was ever committed, so jest aborted with a validation error
 *      before running anything.
 *
 *   2. More fundamentally, the suites in tests/ are NOT jest tests. They are
 *      standalone Node scripts: they use `assert`, print their own PASS/FAIL
 *      lines, and call `process.exit(0)` / `process.exit(1)` themselves. Jest
 *      never invokes them as suites, and a single `process.exit()` inside one
 *      kills the whole run — so even after fixing (1), one suite would abort the
 *      others and no summary would ever print.
 *
 * So each file is spawned as its own child process with node. That matches how
 * the suites are written: each owns its exit code, and its output is its report.
 *
 * SUITES THAT NEED A DATABASE
 * ---------------------------
 * Several suites `require("../config/database")`, which opens a real MySQL
 * connection on import. Those fail with ECONNREFUSED when no database is
 * running, which is an environment problem rather than a code failure — the
 * runner labels them so the distinction is obvious instead of looking like a
 * broken test.
 *
 *   node scripts/run-tests.js              # everything
 *   node scripts/run-tests.js dedupe blast # only suites whose name matches
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TESTS_DIR = path.join(ROOT, "tests");

// Suites inherit the same env the server would use. override:false so a real
// environment (CI, an exported var) still wins over .env.
require("dotenv").config({ path: path.join(ROOT, ".env") });
process.env.NODE_ENV = process.env.NODE_ENV || "test";

// Nothing should reach for Redis during a test run; the services already fall
// back to synchronous sends when it is unset.
if (!process.env.REDIS_URL) process.env.REDIS_URL = "";

const filters = process.argv.slice(2);
const suites = fs
  .readdirSync(TESTS_DIR)
  .filter((f) => f.startsWith("test_") && f.endsWith(".js"))
  .filter((f) => !filters.length || filters.some((k) => f.includes(k)))
  .sort();

if (!suites.length) {
  console.error(filters.length ? `no suites match: ${filters.join(", ")}` : "no suites found in tests/");
  process.exit(1);
}

const is = {
  pass: (s) => `\u001b[32m${s}\u001b[0m`,
  fail: (s) => `\u001b[31m${s}\u001b[0m`,
  skip: (s) => `\u001b[33m${s}\u001b[0m`,
  dim: (s) => `\u001b[90m${s}\u001b[0m`,
};

const looksLikeMissingDb = (output) =>
  /ECONNREFUSED|connect ETIMEDOUT|ER_ACCESS_DENIED_ERROR|ER_BAD_DB_ERROR|Can't connect to MySQL server/i.test(output);

const run = (file) =>
  new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(TESTS_DIR, file)], {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      out += d;
      process.stderr.write(d);
    });

    child.on("close", (code) => {
      const ms = Date.now() - started;
      if (code === 0) return resolve({ file, state: "pass", code, ms, out });
      if (looksLikeMissingDb(out)) return resolve({ file, state: "needs-db", code, ms, out });
      resolve({ file, state: "fail", code, ms, out });
    });

    child.on("error", (err) => resolve({ file, state: "fail", code: -1, ms, out: String(err) }));
  });

(async () => {
  console.log(`\nrunning ${suites.length} suite(s)${filters.length ? ` matching "${filters.join(", ")}"` : ""}\n`);

  const results = [];
  for (const file of suites) {
    results.push(await run(file));
    console.log("");
  }

  const counts = { pass: 0, fail: 0, "needs-db": 0 };
  for (const r of results) counts[r.state]++;

  console.log("─".repeat(72));
  console.log("summary\n");
  for (const r of results) {
    const label =
      r.state === "pass"
        ? is.pass("PASS   ")
        : r.state === "needs-db"
        ? is.skip("NO-DB  ")
        : is.fail("FAIL   ");
    console.log(`  ${label} ${r.file} ${is.dim(`(${r.ms}ms${r.code ? `, exit ${r.code}` : ""})`)}`);
  }

  console.log("\n" + "─".repeat(72));
  console.log(`  ${counts.pass} passed, ${counts.fail} failed, ${counts["needs-db"]} need a running database`);
  if (counts["needs-db"]) {
    console.log(
      is.dim(
        "\n  NO-DB suites require MySQL on " +
          `${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 3306} with the ` +
          `${process.env.DB_NAME || "achme_wa"} schema. Start MySQL and re-run to exercise them.`
      )
    );
  }
  console.log("");

  process.exit(counts.fail ? 1 : 0);
})();
