"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { localServices } = require("./services.cjs");
const { checkDeployment } = require("./check-deployment.cjs");

test("local services use distinct configurable ports and admit private LAN frontends", () => {
  const local = localServices({ WA_DEV_APP_PORT: "3101", WA_DEV_SITE_PORT: "3102", WA_DEV_API_PORT: "5101" }, { ethernet: [{ family: "IPv4", address: "192.168.1.8", internal: false }, { family: "IPv4", address: "203.0.113.1", internal: false }] });
  assert.deepEqual(local.origins, { app: "http://localhost:3101", site: "http://localhost:3102", api: "http://localhost:5101" });
  assert(local.allowedOrigins.includes("http://192.168.1.8:3102"));
  assert(!local.allowedOrigins.includes("203.0.113.1"));
  assert.throws(() => localServices({ WA_DEV_APP_PORT: "5001" }, {}), /different ports/);
  assert.throws(() => localServices({ WA_DEV_API_PORT: "invalid" }, {}), /integers/);
});

async function fixture(state, run) {
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/login") {
      if (state.redirect) return res.writeHead(307, { Location: "/wrong-site" }).end();
      res.setHeader("Content-Type", "text/html"); return res.end("<html><body>App</body></html>");
    }
    if (state.cors !== false) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "content-type,x-browser-session,x-tenant-id");
    }
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, sharedInboxReady: state.ready !== false }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try { return await run({ site: origin, app: origin, api: origin }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test("deployment checks require real ready health and credentialed login preflight", async () => {
  await fixture({}, async origins => assert((await checkDeployment(origins, () => {})).every(result => result.passed)));
});

test("HTTP 200 with an unready database cannot pass deployment verification", async () => {
  await fixture({ ready: false }, async origins => assert((await checkDeployment(origins, () => {})).some(result => !result.passed)));
});

test("missing CORS and frontend redirects fail deployment verification", async () => {
  await fixture({ cors: false, redirect: true }, async origins => assert((await checkDeployment(origins, () => {})).every(result => !result.passed)));
});
