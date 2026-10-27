"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

async function main() {
  const landing = path.resolve(__dirname, "../../landing_page/dist");
  const frontend = path.resolve(__dirname, "../../frontend/build");
  const executablePath = [process.env.INBOX_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => file && fs.existsSync(file));
  const browser = await puppeteer.launch({ headless: true, executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      const directory = url.hostname === "wa.madhuratech.in" ? landing
        : ["live.wa.madhuratech.in", "live.madhuratech.in"].includes(url.hostname) ? frontend : null;
      if (!directory) return request.abort();
      const target = path.resolve(directory, "." + decodeURIComponent(url.pathname));
      if (target !== directory && !target.startsWith(directory + path.sep)) return request.abort();
      const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(directory, "index.html");
      const extension = path.extname(file);
      const contentType = ({ ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2" })[extension] || "text/html";
      return request.respond({ status: 200, contentType, body: fs.readFileSync(file) });
    });
    const navigate = async address => { await page.goto(address, { waitUntil: "networkidle2" }); };
    await navigate("https://wa.madhuratech.in/");
    const tryNow = await page.waitForSelector('a[href="https://live.wa.madhuratech.in/login"]');
    // Keep the destination in this intercepted page instead of opening an uncontrolled tab.
    await tryNow.evaluate(link => { link.target = "_self"; });
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), tryNow.click()]);
    assert.equal(new URL(page.url()).hostname, "live.wa.madhuratech.in");
    assert.equal(new URL(page.url()).pathname, "/login");
    await page.waitForFunction(() => document.body.innerText.includes("Back to Home"));
    await page.waitForSelector('a.lp-auth-back[href="https://wa.madhuratech.in"]');
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.click("a.lp-auth-back")]);
    assert.equal(new URL(page.url()).hostname, "wa.madhuratech.in");
    for (const hostname of ["live.wa.madhuratech.in", "live.madhuratech.in"]) {
      await navigate(`https://${hostname}/?tab=demo&returnUrl=%2Fwhatsapp%2Fcontacts#signin`);
      await page.waitForFunction(() => window.location.pathname === "/login");
      const current = new URL(page.url());
      assert.equal(current.hostname, hostname);
      assert.equal(current.searchParams.get("tab"), "demo");
      assert.equal(current.searchParams.get("returnUrl"), "/whatsapp/contacts");
      assert.equal(current.hash, "#signin");
    }
    await navigate("https://wa.madhuratech.in/portal/activate?source=email#token=fixture");
    await page.waitForFunction(() => window.location.hostname === "live.wa.madhuratech.in" && window.location.pathname === "/portal/activate");
    const portal = new URL(page.url());
    assert.equal(portal.search, "?source=email");
    assert.equal(portal.hash, "#token=fixture");
    await navigate("https://wa.madhuratech.in/whatsapp/contacts?filter=opted_in#list");
    await page.waitForFunction(() => window.location.hostname === "live.wa.madhuratech.in");
    assert.equal(new URL(page.url()).hostname, "live.wa.madhuratech.in");
    await navigate("https://live.wa.madhuratech.in/docs?source=workspace#api");
    await page.waitForFunction(() => window.location.hostname === "wa.madhuratech.in" && window.location.pathname === "/docs");
    assert.equal(new URL(page.url()).search, "?source=workspace");
    assert.equal(new URL(page.url()).hash, "#api");
    assert.deepEqual(errors, []);
    console.log("PASS: compiled landing Try Now, login/Home round trip, both app roots, demo parameters, portal activation, workspace and documentation handoffs. All network requests intercepted; no production services contacted.");
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
