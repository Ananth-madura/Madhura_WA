import assert from "node:assert/strict";
import { resolveOrigin } from "../src/config/origins.js";

const production = "https://live.wa.madhuratech.in";
assert.equal(resolveOrigin("", production, 3001, { hostname: "wa.madhuratech.in", protocol: "https:" }, true), production);
assert.equal(resolveOrigin("https://live.madhuratech.in///", production, 3001, null, true), "https://live.madhuratech.in");
for (const hostname of ["localhost", "127.0.0.1", "192.168.0.106", "10.0.0.8", "172.20.0.4", "[::1]"]) {
  const location = { hostname, protocol: "http:" };
  assert.equal(resolveOrigin("", production, 3001, location), `http://${hostname}:3001`);
  assert.equal(resolveOrigin("http://localhost:5001", "https://api.madhuratech.in", 5001, location), `http://${hostname}:5001`);
}
for (const configured of ["http://localhost:3001", "invalid", "javascript:alert(1)"]) {
  assert.equal(resolveOrigin(configured, production, 3001, { hostname: "wa.madhuratech.in", protocol: "https:" }, true), production);
}
console.log("PASS: production, alias, custom environment, LAN, IPv6 and API origin resolution");
