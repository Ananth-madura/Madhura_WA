"use strict";
const http = require("node:http");
const https = require("node:https");
const { localServices, productionServices } = require("./services.cjs");

function request(address, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(address);
    const transport = target.protocol === "https:" ? https : http;
    const req = transport.request(target, { method: options.method || "GET", headers: options.headers, timeout: options.timeout || 10000 }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; if (body.length > 1024 * 1024) response.destroy(new Error("Response exceeded 1 MB")); });
      response.on("error", reject);
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.once("timeout", () => req.destroy(new Error("Request timed out")));
    req.once("error", reject);
    req.end();
  });
}

async function checkDeployment(origins, output = console.log) {
  const checks = [];
  const check = async (name, verify) => {
    try { await verify(); checks.push({ name, passed: true }); output(`PASS: ${name}`); }
    catch (error) { checks.push({ name, passed: false }); output(`FAIL: ${name}: ${error.code || error.message}`); }
  };
  const expect = (condition, message) => { if (!condition) throw new Error(message); };
  await Promise.all([origins.site, origins.app, origins.alias].filter(Boolean).map(origin => check(`${origin} serves its frontend`, async () => {
    const response = await request(`${origin}${origin === origins.site ? "/" : "/login"}`, { headers: { Accept: "text/html" } });
    expect(response.status === 200, `HTTP ${response.status}${response.headers.location ? ` redirects to ${response.headers.location}` : ""}`);
    expect(/text\/html/i.test(response.headers["content-type"] || "") && /<html/i.test(response.body), "Expected an HTML application");
  })));
  for (const origin of [origins.site, origins.app, origins.alias].filter(Boolean)) await check(`API health and credentialed CORS for ${origin}`, async () => {
    const response = await request(`${origins.api}/health`, { headers: { Origin: origin } });
    expect(response.status === 200, `Health HTTP ${response.status}`);
    let health; try { health = JSON.parse(response.body); } catch { throw new Error("Health returned non-JSON data"); }
    expect(health.ok === true && health.sharedInboxReady === true, "Backend database/schema is not ready");
    expect(response.headers["access-control-allow-origin"] === origin, "API does not allow this exact frontend origin");
    expect(response.headers["access-control-allow-credentials"] === "true", "API does not allow credentialed browser requests");
    const preflight = await request(`${origins.api}/api/auth/login`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-browser-session,x-tenant-id" } });
    expect([200, 204].includes(preflight.status), `Login preflight HTTP ${preflight.status}`);
    expect(preflight.headers["access-control-allow-origin"] === origin && preflight.headers["access-control-allow-credentials"] === "true", "Login preflight does not allow this frontend");
    const allowedHeaders = String(preflight.headers["access-control-allow-headers"] || "").toLowerCase().split(/\s*,\s*/);
    expect(["content-type", "x-browser-session", "x-tenant-id"].every(header => allowedHeaders.includes(header)), "Login preflight blocks required headers");
  });
  return checks;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--local", "--production"].includes(args[0])) throw new Error("Usage: node scripts/check-deployment.cjs --local|--production");
  const origins = args[0] === "--local" ? localServices().origins : productionServices;
  const checks = await checkDeployment(origins);
  if (checks.some(check => !check.passed)) process.exitCode = 1;
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { request, checkDeployment };
