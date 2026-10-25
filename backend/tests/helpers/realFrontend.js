"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const puppeteer = require("puppeteer");

async function verify({ deliverLive, query }) {
  const build = path.resolve(__dirname, "../../../frontend/build");
  const server = http.createServer((req, res) => {
    const target = path.resolve(build, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if (!target.startsWith(build + path.sep)) return res.writeHead(403).end();
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(build, "index.html");
    res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(15318, "127.0.0.1", resolve));
  let browser;
  try {
    const executablePath = [process.env.INBOX_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => file && fs.existsSync(file));
    browser = await puppeteer.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox"] });
    const page = await browser.newPage(), failures = [], requests = [], frames = [];
    page.on("pageerror", error => failures.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", req => {
      const url = new URL(req.url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) return req.abort();
      if (url.pathname.startsWith("/api/")) requests.push({ path: url.pathname, tenant: req.headers()["x-tenant-id"], method: req.method() });
      return req.continue();
    });
    const session = await page.createCDPSession();await session.send("Network.enable");
    session.on("Network.webSocketFrameReceived", event => frames.push(event.response.payloadData));
    await page.goto("http://127.0.0.1:15318/login?returnUrl=/whatsapp/team-inbox", { waitUntil: "networkidle2" });
    await page.type("#hl-email", "agent@fixture.test");await page.type("#hl-password", "fixture-browser-password");
    const workspaceReady=page.waitForResponse(response=>response.url().endsWith("/api/v2/me")&&response.status()===200);
    await page.click('form button[type="submit"]');
    await workspaceReady;await page.waitForNetworkIdle({idleTime:500,timeout:15000});
    await page.waitForSelector('button[aria-pressed="false"]', { timeout: 20000 });
    await page.click('button[aria-pressed="false"]');
    await page.waitForFunction(() => document.body.textContent.includes("Message content unavailable on this device"));
    assert.equal(await page.evaluate(() => localStorage.getItem("token")), null);
    assert((await page.cookies("http://127.0.0.1:15317")).some(cookie => cookie.name === "wa_access" && cookie.httpOnly));
    await page.evaluate(() => { const label=[...document.querySelectorAll("label")].find(el=>el.textContent.startsWith("New internal note"));label.querySelector("textarea").focus(); });
    await page.keyboard.type("Note saved through the real frontend and backend");
    const noteSaved=page.waitForResponse(response=>response.request().method()==="POST"&&response.url().endsWith("/notes"));
    await page.evaluate(() => [...document.querySelectorAll("button")].find(el=>el.textContent.trim()==="Save note").click());
    const noteResponse=await noteSaved;assert(noteResponse.ok(),await noteResponse.text());
    await page.waitForFunction(() => [...document.querySelectorAll("p")].some(el=>el.querySelector("strong")&&el.textContent.includes("Note saved through the real frontend and backend")));
    const [[note]] = await query("SELECT COUNT(*) AS count FROM wa_internal_notes WHERE note_text=?", ["Note saved through the real frontend and backend"]);
    assert.equal(note.count, 1);
    await page.waitForNetworkIdle({idleTime:1000,timeout:15000});
    const listsBefore=requests.filter(req=>req.path==="/api/v2/inbox/conversations"&&req.method==="GET").length;
    await deliverLive();
    await page.waitForFunction(() => document.body.textContent.includes("Live signed webhook reaches actual browser"));
    assert(frames.some(frame => frame.includes("inbox_message") && frame.includes("Live signed webhook reaches actual browser")), "live body arrived over a real WebSocket");
    await page.waitForNetworkIdle({idleTime:1000,timeout:15000});
    assert.equal(requests.filter(req=>req.path==="/api/v2/inbox/conversations"&&req.method==="GET").length,listsBefore,"known-chat messages must not refetch the inbox");
    const [[message]] = await query("SELECT message_text FROM wa_message_logs WHERE wa_message_id='wamid.browser.live'");
    assert.equal(message.message_text, null);
    await page.reload({ waitUntil: "networkidle2" });await page.waitForSelector('button[aria-pressed="false"]');await page.click('button[aria-pressed="false"]');
    await page.waitForFunction(() => document.body.textContent.includes("Note saved through the real frontend and backend") && document.body.textContent.includes("Live signed webhook reaches actual browser"));
    assert(requests.some(req => req.path === "/api/v2/me"));
    assert(requests.some(req => req.path === "/api/v2/inbox/conversations" && req.tenant === "1"));
    assert.deepEqual(failures, []);
    await page.setViewport({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.resolve(__dirname, "../../../scratch/shared-inbox-real-browser.png"), fullPage: true });
    console.log("PASS: built frontend -> actual backend -> isolated MySQL; real cookie login/CORS, scoped requests, durable notes, signed webhook -> real WebSocket -> device cache, reload and mobile layout. No API fixture responses.");
  } finally { if (browser) await browser.close();await new Promise(resolve => server.close(resolve)); }
}
module.exports = { verify };
