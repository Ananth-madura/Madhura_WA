"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const puppeteer = require("puppeteer");

async function main() {
  const build = path.resolve(__dirname, "../../frontend/build");
  const output = path.resolve(__dirname, "../../scratch");
  const server = http.createServer((req, res) => {
    const target = path.resolve(build, "." + new URL(req.url, "http://localhost").pathname);
    if (!target.startsWith(build + path.sep) && target !== build) return res.writeHead(403).end();
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(build, "index.html");
    res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(15328, "127.0.0.1", resolve));
  let browser;
  const customer = { id: 1, name: "Ananya Deshpande", phone: "919876543210", email: "ananya@example.com", lifecycle_stage: "lead", assigned_agent_id: 1, opt_in_status: false };
  const conversation = { id: 1, sender_id: 1, contact_id: 1, branch_id: 1, owner_user_id: 1, status: "open", automation_mode: "human", contact_name: customer.name, contact_phone: customer.phone, sender_phone: "919123456789" };
  let enquiries = [{ ...customer, company: "Deshpande Trading", temperature: "hot", status: "open", enquiry_type: "pricing", message: "Please share a quote for our annual service contract.", created_at: "2026-10-26T09:00:00Z" }];
  let notes = [], replies = [], tasks = [], readOnly = false, failEnquiries = false;
  const failures = [];
  try {
    const executablePath = [process.env.INBOX_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => file && fs.existsSync(file));
    browser = await puppeteer.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage();
    page.on("pageerror", error => failures.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", req => {
      const url = new URL(req.url());
      const respond = (data, status = 200) => req.respond({ status, headers: { "Access-Control-Allow-Origin": req.headers().origin || "http://127.0.0.1:15328", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "authorization,content-type,x-tenant-id,x-branch-id,x-browser-session", "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS" }, contentType: "application/json", body: JSON.stringify(data) });
      if (req.method() === "OPTIONS") return respond({});
      if (url.pathname.startsWith("/api/")) {
        const route = url.pathname;
        const body = req.postData() ? JSON.parse(req.postData()) : {};
        if (route === "/api/auth/session") return respond({ success: true, user: { id: 1, role: "admin", tenant_id: 1, name: "Operations" } });
        if (route === "/api/v2/me") return respond({ success: true, activeOrganization: { id: 1, name: "Fixture business" }, organizations: [{ id: 1, name: "Fixture business" }], branches: [], permittedBranchIds: [1], roleInActiveOrg: "organization_owner" });
        if (route === "/api/v2/inbox/conversations") return respond({ conversations: [conversation], canManage: false, canSend: !readOnly });
        if (route.endsWith("/messages")) return respond({ messages: [{ id: "incoming", body: "Could you send us the service quote?", isMe: false, timestamp: 1793005200 }, ...replies] });
        if (route.endsWith("/contact")) return respond({ contact: customer });
        if (route.endsWith("/assignments")) return respond({ records: [] });
        if (route.endsWith("/notes")) {
          if (req.method() === "POST") notes.push({ id: notes.length + 1, author_name: "Operations", note_text: body.text });
          return respond({ notes });
        }
        if (route.endsWith("/reply")) {
          const message = { id: "reply-" + replies.length, body: body.text, isMe: true, status: "sent", timestamp: 1793005300 };
          replies.push(message);
          return respond({ message });
        }
        if (route === "/api/v2/workspace/analytics") return respond({ customers: 1, open_tasks: tasks.length, overdue_tasks: 0, deals: 0, conversations: 1, average_first_response_seconds: null, clients: 0 });
        if (route === "/api/v2/workspace/customers") return respond({ customers: [customer], nextCursor: null });
        if (route === "/api/v2/workspace/customers/1") return respond({ customer, canEdit: true, canTransfer: false, permissions: Object.fromEntries(["tasks", "leads", "deals", "activities", "transfers"].map(key => [key, { view: true, edit: true }])) });
        if (route === "/api/v2/workspace/customers/1/tasks") {
          if (req.method() === "POST") tasks.push({ id: tasks.length + 1, title: body.title, status: "open" });
          return respond({ records: tasks, nextCursor: null });
        }
        if (/\/customers\/1\/(leads|deals|activities|transfers)$/.test(route)) return respond({ records: [], nextCursor: null });
        if (route === "/api/wa/enquiries/summary") return respond({ total: enquiries.length, new: 0, cold: 0, warm: 0, hot: enquiries.filter(row => row.temperature === "hot").length, converted: enquiries.filter(row => row.status === "converted").length });
        if (route === "/api/wa/enquiries") {
          if (failEnquiries) return respond({ message: "Fixture service unavailable" }, 503);
          if (req.method() === "POST") { enquiries.push({ ...body, id: enquiries.length + 1, status: "open" }); return respond({ success: true }); }
          const rows = enquiries.filter(row => (!url.searchParams.get("temperature") || row.temperature === url.searchParams.get("temperature")) && (!url.searchParams.get("status") || row.status === url.searchParams.get("status")) && (!url.searchParams.get("search") || row.name.toLowerCase().includes(url.searchParams.get("search").toLowerCase())));
          return respond({ enquiries: rows, total: rows.length, totalPages: 1 });
        }
        if (/\/api\/wa\/enquiries\/\d+\/convert$/.test(route)) {
          const row = enquiries.find(item => item.id === Number(route.split("/").at(-2)));
          row.status = "converted"; row.converted_client_id = row.id;
          return respond({ enquiry: row, client: row, deduped: false });
        }
        if (/\/api\/wa\/enquiries\/\d+$/.test(route)) {
          const id = Number(route.split("/").at(-1));
          if (req.method() === "DELETE") enquiries = enquiries.filter(row => row.id !== id);
          else Object.assign(enquiries.find(row => row.id === id), body);
          return respond({ success: true });
        }
        return respond({ success: true, connected: false, records: [], flows: [], senders: [] });
      }
      if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/socket.io")) return req.abort();
      return req.continue();
    });
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("user", JSON.stringify({ id: 1, role: "admin", tenant_id: 1, name: "Operations", token: "fixture" }));
      localStorage.setItem("token", "fixture"); localStorage.setItem("active_tenant_id", "1");
    });
    const goto = route => page.goto("http://127.0.0.1:15328" + route, { waitUntil: "networkidle2" });
    const clickText = text => page.evaluate(text => {
      const element = [...document.querySelectorAll("button, summary")].find(el => el.textContent.trim() === text && el.getClientRects().length);
      if (!element) throw new Error("Missing visible control: " + text);
      element.click();
    }, text);
    const typeLabel = async (label, value) => {
      await page.evaluate(label => {
        const el = [...document.querySelectorAll("label")].find(el => el.textContent.trim().startsWith(label) && el.getClientRects().length);
        const input = el?.querySelector("input,textarea") || document.getElementById(el?.htmlFor);
        if (!input) throw new Error("Missing field: " + label);
        input.focus();
      }, label);
      await page.keyboard.type(value);
    };
    const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Page must fit the viewport");
    const visible = selector => page.$eval(selector, el => Boolean(el.getClientRects().length));
    const screenshot = async name => {
      await page.$eval(".wa-page-workspace", el => { el.scrollTop = 0; });
      return page.screenshot({ path: path.join(output, "customer-ops-" + name + ".png"), fullPage: true });
    };

    await page.setViewport({ width: 1440, height: 1000 });
    await goto("/whatsapp/team-inbox");
    await page.waitForSelector(".emp-conv"); await page.click(".emp-conv");
    await page.waitForFunction(() => document.querySelector(".emp-messages")?.textContent.includes("Could you send"));
    await typeLabel("Reply", "I will send your quote today."); await clickText("Send reply");
    await page.waitForFunction(() => document.querySelector(".emp-messages")?.textContent.includes("I will send"));
    assert.equal(replies.length, 1); await fits(); await screenshot("inbox-desktop");
    await page.setViewport({ width: 1024, height: 900 });
    await clickText("Customer details"); assert.equal(await visible(".emp-pane-meta"), true);
    await clickText("Back to conversation"); assert.equal(await visible(".emp-pane-thread"), true); await fits();
    for (const width of [390, 320]) {
      await page.setViewport({ width, height: 844 });
      assert.equal(await visible(".emp-pane-list"), false); assert.equal(await visible(".emp-pane-thread"), true); await fits();
      assert.equal(await page.$eval(".emp-compose-row", el => {
        const outer = el.getBoundingClientRect(), button = el.querySelector("button").getBoundingClientRect();
        return button.right <= outer.right + 1 && button.left >= outer.left - 1;
      }), true, "Send reply must stay inside the composer");
      await clickText("Customer details");
      assert.equal(await visible(".emp-pane-thread"), false);
      await typeLabel("New internal note", "Quote requested; follow up tomorrow."); await clickText("Save note");
      await page.waitForFunction(() => document.querySelector(".emp-meta-body")?.textContent.includes("Quote requested"));
      await clickText("Back to conversation");
      await page.click('[aria-label="Back to conversations"]');
      assert.equal(await visible(".emp-pane-list"), true);
      await page.click(".emp-conv"); await fits();
    }
    await screenshot("inbox-mobile");
    readOnly = true; await goto("/whatsapp/team-inbox"); await page.waitForSelector(".emp-conv"); await page.click(".emp-conv");
    assert.equal(await page.$eval(".emp-compose-row button", el => el.disabled), true);
    readOnly = false;

    await goto("/whatsapp/workspace"); await page.waitForSelector(".emp-customer"); await page.click(".emp-customer");
    await page.waitForSelector(".emp-work-main");
    assert.equal(await visible(".emp-work-list"), false);
    await typeLabel("Task title", "Follow up on the service quote"); await clickText("Add record");
    await page.waitForFunction(() => [...document.querySelectorAll(".emp-record")].some(el => el.textContent.includes("Follow up on the service quote")));
    assert.equal(tasks.length, 1); await fits(); await screenshot("workspace-mobile");
    await clickText("All customers"); await page.waitForSelector(".emp-customer"); assert.equal(await visible(".emp-work-list"), true);
    await page.setViewport({ width: 1440, height: 1000 }); await page.click(".emp-customer"); await page.waitForSelector(".emp-work-main");
    await fits(); await screenshot("workspace-desktop");

    await goto("/whatsapp/enquiries"); await page.waitForSelector("td[data-label='Enquiry']");
    await fits(); await screenshot("enquiries-desktop");
    await page.click('.crm-enquiry-stats button:nth-child(5)');
    await page.waitForFunction(() => location.search.includes("temp=hot"));
    await page.click('.crm-enquiry-stats button:nth-child(3)');
    await page.waitForFunction(() => document.body.textContent.includes("No enquiries match"));
    await page.goBack({ waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.querySelector('[aria-label="Filter by lead temperature"]').value === "hot");
    await clickText("Reset filters"); await page.waitForSelector("td[data-label='Enquiry']");
    for (const width of [1024, 768, 390, 320]) { await page.setViewport({ width, height: 900 }); await fits(); }
    await screenshot("enquiries-mobile");
    await clickText("Add enquiry"); await page.waitForSelector('[role="dialog"]');
    await typeLabel("Name", "Browser lead"); await typeLabel("Phone", "+919111222333"); await fits();
    await page.click('[role="dialog"] button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    assert.equal(enquiries.length, 2);
    await page.click('[aria-label="Convert Browser lead to client"]'); await clickText("Yes, convert it");
    await page.waitForSelector('[aria-label="Conversion result"]'); await fits();
    await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    await page.click('[aria-label="Edit Ananya Deshpande"]'); await page.waitForSelector('[role="dialog"]');
    await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    await page.click('[aria-label="Delete Browser lead"]'); await clickText("Delete");
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    assert.equal(enquiries.length, 1);
    failEnquiries = true; await clickText("Refresh");
    await page.waitForSelector('.crm-enquiries-page [role="alert"]');
    failEnquiries = false; await clickText("Retry");
    await page.waitForFunction(() => !document.querySelector('.crm-enquiries-page [role="alert"]'));
    assert.deepEqual(failures, []);
    console.log("PASS: three pages at 320/390/768/1024/1440px; inbox reply, read-only state, notes, pane navigation; workspace task creation and back navigation; enquiry filters, browser history, create/convert/edit/delete dialogs and error retry. Fixture APIs only; no live messages or customer records changed.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
