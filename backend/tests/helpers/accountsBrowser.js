"use strict";
const assert = require("node:assert/strict"), http = require("node:http"), fs = require("node:fs"), path = require("node:path"), puppeteer = require("puppeteer");
async function verify({ email, secondId }) {
  if (!process.env.INBOX_TEST_FRONTEND_BUILD) throw new Error("An isolated frontend build is required");
  const build = path.resolve(process.env.INBOX_TEST_FRONTEND_BUILD);
  if (!fs.existsSync(path.join(build, "index.html"))) throw new Error("An isolated frontend build is required");
  const server = http.createServer((req, res) => {
    const target = path.resolve(build, "." + new URL(req.url, "http://localhost").pathname);
    if (!target.startsWith(build + path.sep)) return res.writeHead(403).end();
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(build, "index.html");
    res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html"); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(15318, "127.0.0.1", resolve)); let browser;
  try {
    const executablePath = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
    browser = await puppeteer.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
    const page = await browser.newPage(), errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 }); await page.setRequestInterception(true);
    page.on("request", req => ["127.0.0.1", "localhost"].includes(new URL(req.url()).hostname) ? req.continue() : req.abort());
    await page.goto("http://127.0.0.1:15318/login?returnUrl=/whatsapp/accounts", { waitUntil: "networkidle2" });
    try { await page.waitForSelector("#hl-email", { timeout: 30000 }); }
    catch (error) { console.error(JSON.stringify({ pageErrors: errors, url: page.url(), loginText: (await page.evaluate(() => document.body.innerText)).slice(0, 500) })); throw error; }
    await page.type("#hl-email", email); await page.type("#hl-password", "isolated-admin-only");
    const signedIn = page.waitForResponse(response => response.url().endsWith("/api/v2/me") && response.ok()); await page.click('form button[type="submit"]'); await signedIn;
    await page.evaluate(() => { localStorage.setItem("active_tenant_id", "1"); localStorage.removeItem("active_branch_id"); });
    await page.goto("http://127.0.0.1:15318/account", { waitUntil: "networkidle2" });
    await page.waitForSelector(".ac-sender"); assert(new URL(page.url()).pathname === "/whatsapp/accounts"); await page.click(".ac-sender");
    await page.waitForFunction(() => document.querySelectorAll(".ac-routing").length > 0);
    const click = async label => {
      await page.waitForFunction(text => [...document.querySelectorAll(".ac-workspace button")].some(el => el.textContent === text && !el.disabled), {}, label);
      await page.evaluate(text => [...document.querySelectorAll(".ac-workspace button")].find(el => el.textContent === text).click(), label);
    };
    const synced = page.waitForResponse(response => response.url().endsWith("/sync") && response.request().method() === "POST"); await click("Check connection"); assert((await synced).ok());
    await page.waitForFunction(() => document.body.textContent.includes("Status verified with Meta."));
    const routing = page.waitForResponse(response => response.url().endsWith("/branch-assignments") && response.request().method() === "PATCH"); await click("Save routing"); assert((await routing).ok());
    await page.waitForFunction(() => document.body.textContent.includes("Branch routing saved."));
    await browser.defaultBrowserContext().overridePermissions("http://127.0.0.1:15318", ["clipboard-read", "clipboard-write"]);
    await click("Copy verify token"); await page.waitForFunction(() => document.body.textContent.includes("Verify token copied."));
    await page.evaluate(() => document.querySelector('.ac-tabs a[href$="assistant"]').click()); await page.waitForSelector("textarea");
    await page.type("textarea", "Use the verified source system."); const saved = page.waitForResponse(response => response.url().endsWith("/assistant/settings") && response.request().method() === "PUT"); await click("Save assistant settings"); assert((await saved).ok());
    await page.goto("http://127.0.0.1:15318/whatsapp/accounts", { waitUntil: "networkidle2" }); await page.waitForSelector(".ac-sender"); await page.click(".ac-sender");
    for (const width of [390, 768, 1440]) {
      await page.setViewport({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `app layout overflow at ${width}`);
      await page.screenshot({ path: path.resolve(__dirname, `../../../scratch/accounts-app-${width}.png`), fullPage: true });
    }
    await page.evaluate(id => { localStorage.setItem("active_tenant_id", String(id)); localStorage.removeItem("active_branch_id"); }, secondId);
    await page.reload({ waitUntil: "networkidle2" }); await page.waitForFunction(() => document.body.textContent.includes("Connect your first number")); assert.equal(await page.$(".ac-sender"), null);
    assert.deepEqual(errors, []);
    console.log("PASS: built account page -> real cookie login/CORS -> actual sender/assistant APIs -> isolated MySQL; /account redirect, health, revisioned routing, clipboard feedback, assistant save, organization isolation and responsive app shell at 390/768/1440. Meta HTTP transport is local fixture only.");
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
module.exports = { verify };
