"use strict";
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { localServices } = require("./services.cjs");
const { request } = require("./check-deployment.cjs");
const root = path.resolve(__dirname, "..");

async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--check")) throw new Error("Usage: npm run dev [-- --check]");
  const { ports, origins, allowedOrigins } = localServices();
  const processes = [
    { name: "backend", script: "backend/server.js", env: { NODE_ENV: "development", PORT: String(ports.api), PUBLIC_BASE_URL: origins.api, ALLOWED_ORIGINS: allowedOrigins } },
    { name: "workspace", script: "frontend/node_modules/react-scripts/bin/react-scripts.js", args: ["start"], cwd: "frontend", env: { NODE_ENV: "development", HOST: "0.0.0.0", PORT: String(ports.app), BROWSER: "none", REACT_APP_API_URL: origins.api, REACT_APP_SOCKET_URL: origins.api, REACT_APP_MARKETING_URL: origins.site } },
    { name: "marketing", script: "landing_page/node_modules/vite/bin/vite.js", args: ["--host", "0.0.0.0", "--port", String(ports.site), "--strictPort"], cwd: "landing_page", env: { NODE_ENV: "development", VITE_APP_URL: origins.app, VITE_API_URL: origins.api } },
  ];
  for (const directory of ["backend", "frontend", "landing_page"]) {
    if (!fs.existsSync(path.join(root, directory, "node_modules"))) throw new Error(`Install ${directory} dependencies first: npm --prefix ${directory} ci`);
  }
  if (!fs.existsSync(path.join(root, "backend/.env"))) throw new Error("Create backend/.env from backend/.env.example and configure your local database before starting");
  for (const number of Object.values(ports)) await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`Port ${number} is busy; stop the owning service or choose WA_DEV_APP_PORT, WA_DEV_SITE_PORT and WA_DEV_API_PORT`)));
    server.listen(number, "0.0.0.0", () => server.close(resolve));
  });
  console.log(`Marketing: ${origins.site}\nWorkspace: ${origins.app}/login\nAPI: ${origins.api}\nNode: ${process.version}`);
  if (process.argv.includes("--check")) { console.log("PASS: local dependencies, environment file and service ports. Database credentials are checked when the backend starts."); return; }

  const children = [];
  let stopping = false;
  const stop = code => {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) if (child.exitCode === null && child.pid) {
      if (process.platform === "win32") spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      else child.kill("SIGTERM");
    }
  };
  process.once("SIGINT", () => stop(0));
  process.once("SIGTERM", () => stop(0));
  for (const service of processes) {
    const child = spawn(process.execPath, ["--openssl-legacy-provider", path.join(root, service.script), ...(service.args || [])], {
      cwd: path.join(root, service.cwd || "backend"), env: { ...process.env, ...service.env }, stdio: "inherit", windowsHide: true,
    });
    children.push(child);
    child.once("error", error => { console.error(`${service.name}: ${error.message}`); stop(1); });
    child.once("exit", code => { if (!stopping) { console.error(`${service.name} stopped (${code}); stopping the local stack`); stop(code || 1); } });
  }
  try {
    await Promise.all([origins.site + "/", origins.app + "/login", origins.api + "/health"].map(async address => {
      for (let attempt = 0; attempt < 180 && !stopping; attempt++) {
        try {
          const response = await request(address, { timeout: 2000, headers: { Accept: address.endsWith("/health") ? "application/json" : "text/html" } });
          if (response.status === 200 && (address.endsWith("/health") ? JSON.parse(response.body).sharedInboxReady === true : /<html/i.test(response.body))) return;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!stopping) throw new Error(`${address} did not become ready; inspect the service log above`);
    }));
    if (!stopping) console.log("Local stack ready. Run npm run verify:local to check API readiness and credentialed CORS.");
  } catch (error) { console.error(error.message); stop(1); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
