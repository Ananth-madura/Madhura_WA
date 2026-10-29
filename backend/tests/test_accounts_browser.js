"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const frontend = path.resolve(__dirname, "../../frontend"), modules = path.join(frontend, "node_modules"), output = path.resolve(__dirname, "../../scratch/account-browser");
process.env.NODE_ENV = "test"; process.env.BABEL_ENV = "test";
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const webpack = require(path.join(modules, "webpack"));
  await new Promise((resolve, reject) => webpack({
    mode: "development", entry: path.resolve(__dirname, "helpers/accountsFixture.jsx"), output: { path: output, filename: "fixture.js" },
    resolve: { modules: [modules, "node_modules"], alias: { "../../context/EnterpriseContext": false } },
    module: { rules: [
      { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: path.join(modules, "babel-loader"), options: { presets: [path.join(modules, "babel-preset-react-app")] } } },
      { test: /\.css$/, use: [path.join(modules, "style-loader"), path.join(modules, "css-loader")] }
    ] },
    plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "test", REACT_APP_API_URL: "http://127.0.0.1:15329" }) })]
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); fs.createReadStream(path.join(output, "fixture.js")).pipe(res); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(15329, "127.0.0.1", resolve)); let browser;
  try {
    const puppeteer = require("puppeteer"), executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
    browser = await puppeteer.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
    const page = await browser.newPage(), errors = [], requests = []; page.on("pageerror", error => errors.push(error.message));
    let row = { id: 1, phone_number_id: "11111", display_phone: "+1 555 111 1111", verified_name: "North business", waba_id: "99999", is_shared: true, status: "connected", revision: 1, has_token: true, has_app_secret: true, assigned_branch_ids: [1], default_branch_ids: [1], assigned_branches: "North branch", last_verified_at: "2026-10-29T07:00:00Z" };
    let settings = { enabled: false, auto_start: false, provider: "openai", model: "", system_prompt: "", hasApiKey: false }, fail = false;
    await page.setRequestInterception(true);
    page.on("request", req => {
      if (req.url().includes("/api/v2/")) {
        const url = new URL(req.url()), method = req.method(), body = req.postData() ? JSON.parse(req.postData()) : null; requests.push({ path: url.pathname, method, body });
        let data = { success: true }, status = 200;
        if (url.pathname.endsWith("/meta/setup")) data.embeddedSignupConfigured = false;
        if (url.pathname.endsWith("/meta/senders")) data.senders = [row];
        if (url.pathname.endsWith("/activity")) data.events = [{ id: 1, actor_id: 10, action: "connected", revision: 1, created_at: "2026-10-29T07:00:00Z" }];
        if (url.pathname.endsWith("/webhook")) { data.verifyToken = "fixture-verify-token"; data.callbackUrl = "https://example.test/webhook"; }
        if (url.pathname.endsWith("/sync") && fail) { status = 502; data = { success: false, message: "Meta could not verify this connection." }; }
        if (url.pathname.endsWith("/manual")) data.sender = row;
        if (method === "delete" || method === "DELETE") row = { ...row, status: "disconnected" };
        if (url.pathname.endsWith("/assistant/settings")) { if (method === "PUT") settings = { ...settings, ...body }; data.settings = settings; }
        req.respond({ status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "http://127.0.0.1:15329", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-tenant-id", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,PUT,OPTIONS" }, body: JSON.stringify(data) });
      } else if (new URL(req.url()).hostname === "127.0.0.1") req.continue(); else req.abort();
    });
    const click = async text => { await page.waitForFunction(label => [...document.querySelectorAll("button,a,summary")].some(el => el.textContent === label), {}, text); await page.evaluate(label => [...document.querySelectorAll("button,a,summary")].find(el => el.textContent === label).click(), text); };
    const settled = () => page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && !document.body.textContent.includes("Loading sender setup"));
    await page.setViewport({ width: 1440, height: 1000 }); await page.goto("http://127.0.0.1:15329/whatsapp/accounts?sender=1", { waitUntil: "networkidle0" }); await settled();
    assert.deepEqual(errors, []); await page.waitForSelector('.ac-header button:not(:disabled)');
    await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.activeElement.textContent), "Refresh"); assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none");
    await click("Check connection"); await page.waitForFunction(() => document.body.textContent.includes("Status verified with Meta.")); await settled();
    fail = true; await click("Check connection"); await page.waitForSelector('[role="alert"]'); fail = false;
    await click("Save routing"); await page.waitForFunction(() => document.body.textContent.includes("Branch routing saved.")); await settled();
    await click("Subscribe app"); await page.waitForFunction(() => document.body.textContent.includes("Meta confirmed the app subscription.")); await settled();
    await click("Update credentials"); await page.type('details input[type="password"]', "fixture-token"); await click("Verify and update credentials"); await page.waitForFunction(() => document.body.textContent.includes("Credentials verified and updated.")); await settled();
    await click("Disconnect number"); await click("Keep connected"); assert(!requests.some(r => r.method === "DELETE"));
    await click("Connect number"); await page.waitForSelector('[aria-labelledby="connect-title"]');
    for (const width of [390, 768, 1440]) {
      await page.setViewport({ width, height: 1000 });
      for (const dark of [false, true]) {
        await page.evaluate(d => document.documentElement.classList.toggle("dark", d), dark);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width} dark=${dark}`);
        await page.screenshot({ path: path.join(output, `accounts-${width}-${dark ? "dark" : "light"}.png`), fullPage: true });
      }
    }
    await click("Close connection form");
    await click("Business assistant"); await page.waitForSelector('textarea'); await page.type('textarea', "Use verified business records."); await click("Save assistant settings"); await page.waitForFunction(() => document.body.textContent.includes("Assistant settings saved."));
    assert(requests.some(r => r.method === "PUT" && r.body.systemPrompt === "Use verified business records."));
    await click("WhatsApp numbers"); await settled(); await page.type('input[type="search"]', "missing"); await page.waitForFunction(() => document.body.textContent.includes("No matching numbers"));
    assert.deepEqual(errors, []);
    console.log("PASS: Chromium keyboard focus; connection error/success; routing, subscription, credentials, disconnect cancellation, assistant save, search, inline connection form; no overflow at 390/768/1440 in light/dark; no page errors. Provider transport is a fixture.");
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
