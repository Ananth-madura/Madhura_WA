"use strict";
const os = require("node:os");

function port(value, fallback) {
  const selected = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(selected) || selected < 1024 || selected > 65535) throw new Error("Development ports must be integers from 1024 to 65535");
  return selected;
}

function localServices(env = process.env, interfaces = os.networkInterfaces()) {
  const ports = { app: port(env.WA_DEV_APP_PORT, 3001), site: port(env.WA_DEV_SITE_PORT, 3002), api: port(env.WA_DEV_API_PORT, 5001) };
  if (new Set(Object.values(ports)).size !== 3) throw new Error("App, marketing and API must use different ports");
  const origins = Object.fromEntries(Object.entries(ports).map(([service, number]) => [service, `http://localhost:${number}`]));
  const hosts = new Set(["localhost", "127.0.0.1"]);
  for (const addresses of Object.values(interfaces)) for (const address of addresses || []) {
    if (address.family === "IPv4" && !address.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)) hosts.add(address.address);
  }
  const allowed = new Set(String(env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean));
  for (const host of hosts) for (const number of [ports.app, ports.site]) allowed.add(`http://${host}:${number}`);
  return { ports, origins, allowedOrigins: [...allowed].join(",") };
}

const productionServices = Object.freeze({ site: "https://wa.madhuratech.in", app: "https://live.wa.madhuratech.in", alias: "https://live.madhuratech.in", api: "https://api.madhuratech.in" });
module.exports = { localServices, productionServices };
