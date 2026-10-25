"use strict";
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const storage = require("../services/r2StorageService");

async function main() {
  const result = await storage.verifyConnection({ roundTrip: process.argv.includes("--round-trip") });
  console.log(JSON.stringify({ service: "cloudflare-r2", ...result }));
  if (!result.ok) process.exitCode = 1;
  storage.client?.destroy();
}
main().catch(() => { console.error("R2 verification failed; no credentials were printed"); process.exitCode = 1; });
