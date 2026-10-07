#!/usr/bin/env node
// Boot the server under three configurations and assert what /health and an
// /api route actually return. Runs against the real config, real dotenv, real
// MySQL client — the point is to prove the degraded path behaves as documented.
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const BASE_DB = {
  DB_HOST: "127.0.0.1",
  DB_PORT: "3306",
  DB_USER: "someuser",
  DB_PASS: "somepassword-value",
  DB_NAME: "achme_wa",
  JWT_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  PUBLIC_BASE_URL: "https://wa-api.madhuratech.com",
  ALLOWED_ORIGINS: "https://madhura-wa-frontend.vercel.app",
  WA_DATA_DIR: path.join(require("os").tmpdir(), "wa-degraded-test"),
};

const strip = (o) => {
  const e = { ...process.env };
  for (const k of ["DB_HOST","DB_PORT","DB_USER","DB_PASS","DB_NAME","JWT_SECRET","PUBLIC_BASE_URL","ALLOWED_ORIGINS","ALLOWED_ORIGIN","WA_DATA_DIR","ALLOW_START_WITHOUT_DB","NODE_ENV","PORT","DB_ENGINE","USE_SQLITE"]) delete e[k];
  return { ...e, DISABLE_R2: "1", WA_SKIP_DOTENV: "1", ...o };
};

function get(port, urlPath) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: urlPath, timeout: 4000 }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", (e) => resolve({ status: 0, body: `connection error: ${e.code || e.message}` }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
  });
}

function boot(env, port) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const finish = (result) => { try { child.kill(); } catch {} resolve({ ...result, log: out }); };
    // Without ALLOW_START_WITHOUT_DB the boot waits for db.ready, which retries
    // 15 times at 3s intervals. Poll until the port answers or that budget is
    // spent, rather than guessing a fixed delay.
    const deadline = Date.now() + (env.ALLOW_START_WITHOUT_DB === "0" || env.REQUIRE_HARD_CONFIG === "1" ? 75000 : 20000);
    const poll = async () => {
      const health = await get(port, "/health");
      if (health.status !== 0) {
        const api = await get(port, "/api/auth/login");
        return finish({ health, api });
      }
      if (Date.now() > deadline) {
        const api = await get(port, "/api/auth/login");
        return finish({ health, api });
      }
      setTimeout(poll, 1500);
    };
    poll();
    child.on("exit", (code) => finish({ health: { status: null, body: "exited" }, api: {}, exited: code }));
  });
}

const scenarios = [
  {
    // BEHAVIOUR CHANGE: this used to require the process to refuse to boot.
    // Refusing told you far less than starting and reporting why, so a missing
    // database is now a warning plus a 503 (the 503 guard fires whenever the DB
    // is down, whether or not degraded boot was requested).
    name: "1. no DB vars -> boots, /health degraded, /api 503",
    port: 5591,
    env: strip({ ...BASE_DB, DB_HOST: "", DB_USER: "", DB_PASS: "", DB_NAME: "", NODE_ENV: "production", PORT: "5591" }),
    expect: { healthOk: false, degraded: true, apiStatus: 503 },
  },
  {
    name: "2. no DB vars, ALLOW_START_WITHOUT_DB=1 -> boots degraded, /api 503",
    port: 5592,
    env: strip({ ...BASE_DB, DB_HOST: "", DB_USER: "", DB_PASS: "", DB_NAME: "", NODE_ENV: "production", PORT: "5592", ALLOW_START_WITHOUT_DB: "1" }),
    expect: { healthOk: false, degraded: true, apiStatus: 503 },
  },
  {
    name: "3. DB configured but unreachable, degraded allowed -> boots degraded",
    port: 5593,
    env: strip({ ...BASE_DB, DB_HOST: "10.255.255.1", DB_PORT: "3306", NODE_ENV: "production", PORT: "5593", ALLOW_START_WITHOUT_DB: "1" }),
    expect: { healthOk: false, degraded: true, apiStatus: 503 },
  },
  {
    // Explicitly setting ALLOW_START_WITHOUT_DB=0 is the operator asking for
    // fail-fast, so an unreachable database correctly means the process exits.
    // That is distinct from the default, where the value is merely unset and the
    // service boots degraded.
    //
    // Uses 127.0.0.1:1 rather than an unroutable address on purpose. With no
    // degraded boot the start sequence waits for db.ready, which retries 15 times
    // at 3s; a closed port refuses instantly so that budget is 45s, whereas an
    // unroutable IP burns the full TCP connect timeout per attempt and the test
    // would time out rather than assert anything.
    name: "4. ALLOW_START_WITHOUT_DB=0 + unreachable DB -> exits (explicit fail-fast)",
    port: 5595,
    env: strip({ ...BASE_DB, DB_HOST: "127.0.0.1", DB_PORT: "1", NODE_ENV: "production", PORT: "5595", ALLOW_START_WITHOUT_DB: "0" }),
    expect: { refusesBoot: true },
  },
  {
    // BEHAVIOUR CHANGE: a CHANGE_ME placeholder used to refuse to boot. It is
    // now replaced by a freshly generated random secret by
    // config/runtimeDefaults.js, which is safer than booting with a public
    // string. REQUIRE_HARD_CONFIG=1 is the opt-in that restores refusal.
    name: "5. JWT_SECRET=CHANGE_ME -> replaced by a generated secret, boots",
    port: 5594,
    env: strip({ ...BASE_DB, JWT_SECRET: "CHANGE_ME", NODE_ENV: "production", PORT: "5594", ALLOW_START_WITHOUT_DB: "1" }),
    expect: { healthOk: false, degraded: true, apiStatus: 503, ephemeralJwt: true },
  },
  {
    name: "6. REQUIRE_HARD_CONFIG=1 with no DB -> refuses to boot",
    port: 5596,
    env: strip({ ...BASE_DB, DB_HOST: "", DB_USER: "", DB_PASS: "", DB_NAME: "", NODE_ENV: "production", PORT: "5596", REQUIRE_HARD_CONFIG: "1" }),
    expect: { refusesBoot: true },
  },
];

(async () => {
  let failures = 0;
  console.log("degraded-mode behaviour\n" + "=".repeat(72) + "\n");
  for (const s of scenarios) {
    const r = await boot(s.env, s.port);
    let parsed = {};
    try { parsed = JSON.parse(r.health.body); } catch {}
    let apiParsed = {};
    try { apiParsed = JSON.parse(r.api.body); } catch {}

    const problems = [];
    if (s.expect.refusesBoot) {
      if (!r.exited) problems.push("expected the process to exit, but it kept running");
      // Two different refusal paths produce two different messages, and both are
      // correct: config/envCheck.js rejects a bad environment, while an
      // unreachable database fails in startServer after the connection retries.
      const explained =
        /CONFIGURATION ERRORS/.test(r.log) || /Database is not ready\. Server not started/.test(r.log);
      if (!explained) problems.push("the process exited without an explanation in the log");
    } else {
      if (r.exited) problems.push(`process exited early with ${r.exited}`);
      if (parsed.ok !== s.expect.healthOk) problems.push(`/health ok = ${parsed.ok}, expected ${s.expect.healthOk}`);
      if (parsed.degraded !== s.expect.degraded) problems.push(`/health degraded = ${parsed.degraded}, expected ${s.expect.degraded}`);
      if (r.api.status !== s.expect.apiStatus) problems.push(`/api status = ${r.api.status}, expected ${s.expect.apiStatus}`);
      if (apiParsed.degraded !== true) problems.push("/api body did not flag degraded:true");
      if (s.expect.ephemeralJwt && parsed.ephemeralJwtSecret !== true) {
        problems.push("/health did not report the generated JWT secret");
      }
    }

    const ok = problems.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${s.name}`);
    console.log(`      /health -> ${r.health.status} ${JSON.stringify(parsed).slice(0, 150)}`);
    console.log(`      /api    -> ${r.api.status} ${JSON.stringify(apiParsed).slice(0, 110)}`);
    problems.forEach((p) => console.log(`      x ${p}`));
    if (!ok) {
      console.log("      --- child log (last 12 lines) ---");
      r.log.split("\n").filter((l) => l.trim()).slice(-12).forEach((l) => console.log("      | " + l.slice(0, 150)));
    }
    console.log("");
  }
  console.log("=".repeat(72));
  console.log(failures === 0 ? "all degraded-mode scenarios behaved as documented" : `${failures} scenario(s) wrong`);
  process.exit(failures ? 1 : 0);
})();
