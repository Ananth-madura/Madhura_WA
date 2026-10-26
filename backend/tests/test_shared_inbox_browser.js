"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const puppeteer = require("puppeteer");

async function main() {
  const build = path.resolve(__dirname, "../../frontend/build");
  let notes = [], sent = 0, expiredOnce=false,refreshes=0;
  const cookieMode=process.env.INBOX_TEST_COOKIE_BROWSER==="1";
  const server = http.createServer((req, res) => {
    const target = path.resolve(build, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if (!target.startsWith(build + path.sep) && target !== build) { res.writeHead(403).end(); return; }
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(build, "index.html");
    res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(15318, "127.0.0.1", resolve));
  let browser;
  try {
    const installedBrowser = [process.env.INBOX_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => file && fs.existsSync(file));
    browser = await puppeteer.launch({ headless: true, ...(installedBrowser ? {executablePath:installedBrowser} : {}), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const failures = [], apiRequests = [];
    page.on("pageerror", error => failures.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", async req => {
      const url = new URL(req.url());
      const respond = (data,status=200) => req.respond({ status, headers: { "Access-Control-Allow-Origin": req.headers().origin || "http://127.0.0.1:15318", "Access-Control-Allow-Credentials":"true", "Access-Control-Allow-Headers": "authorization,content-type,x-tenant-id,x-branch-id,x-browser-session", "Access-Control-Allow-Methods":"GET,POST,PATCH,PUT,DELETE,OPTIONS" }, contentType: "application/json", body: JSON.stringify(data) });
      if (req.method() === "OPTIONS") return respond({});
      if (url.pathname.startsWith("/api/")) {
        apiRequests.push(`${req.method()} ${url.pathname}`);
        if(url.pathname==="/api/auth/session")return respond({success:true,user:{id:1,role:"employee",tenant_id:1,name:"Employee",cookieSession:true}});
        if(url.pathname==="/api/auth/refresh"){refreshes++;return respond({success:true,cookieSession:true});}
        if(cookieMode&&!expiredOnce&&url.pathname==="/api/v2/inbox/conversations"){expiredOnce=true;return respond({message:"Expired"},401);}
        if (url.pathname === "/api/v2/me") return respond({ success: true, activeOrganization: { id:1,name:"Fixture business" }, organizations: [{ id:1,name:"Fixture business" }], branches: [], permittedBranchIds: [1], roleInActiveOrg: "agent" });
        if (url.pathname === "/api/v2/inbox/conversations") return respond({ success: true, canManage:false, conversations:[{ id:1,tenant_id:1,sender_id:1,contact_id:1,branch_id:1,owner_user_id:1,status:"open",contact_name:"Customer",contact_phone:"919999999999",sender_phone:"919123456789" }] });
        if (url.pathname.endsWith("/messages")) return respond({ success:true,messages:[{ id:"incoming-1",body:null,isMe:false,status:"delivered",timestamp:Math.floor(Date.now()/1000) }] });
        if (url.pathname.endsWith("/contact")) return respond({ success:true,contact:{ id:1,name:"Customer",phone:"919999999999",email:"" } });
        if (url.pathname.endsWith("/notes")) {
          if (req.method()==="POST") notes.push({id:notes.length+1,author_name:"Employee",note_text:JSON.parse(req.postData()).text});
          return respond({success:true,notes});
        }
        if (url.pathname.endsWith("/reply")) { sent++; return respond({success:true,message:{id:"outgoing-1",body:JSON.parse(req.postData()).text,isMe:true,status:"sent",timestamp:Math.floor(Date.now()/1000)}}); }
        return respond({ success:true, connected:false });
      }
      if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/socket.io")) return req.abort();
      return req.continue();
    });
    await page.evaluateOnNewDocument(cookieMode => {
      localStorage.setItem("user", JSON.stringify({ id:1,role:"employee",tenant_id:1,name:"Employee",...(cookieMode?{cookieSession:true}:{token:"fixture"}) }));
      if(!cookieMode)localStorage.setItem("token", "fixture");localStorage.setItem("active_tenant_id", "1");
    },cookieMode);
    await page.goto("http://127.0.0.1:15318/whatsapp/team-inbox", {waitUntil:"networkidle2"});
    try { await page.waitForSelector('.emp-conv[aria-pressed="false"]', {timeout:10000}); }
    catch (error) { console.error({failures,apiRequests,body:await page.evaluate(()=>document.body.innerText.slice(0,3000))});await page.screenshot({path:path.resolve(__dirname,"../../scratch/shared-inbox-failure.png"),fullPage:true});throw error; }
    await page.click('.emp-conv[aria-pressed="false"]');
    await page.waitForFunction(() => document.body.textContent.includes("Message content unavailable on this device"));
    const typeByLabel = async (label, value) => {
      await page.evaluate((label) => { const el=[...document.querySelectorAll('label')].find(el=>el.textContent.startsWith(label));el.querySelector('textarea,input').focus(); }, label);
      await page.keyboard.type(value);
    };
    const click = text => page.evaluate(text => [...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text).click(),text);
    await typeByLabel("New internal note", "Shared note from browser");await click("Save note");
    await page.waitForFunction(() => document.body.textContent.includes("Employee: Shared note from browser"));
    await typeByLabel("Reply", "Confirmed browser reply");await click("Send reply");
    await page.waitForFunction(() => document.body.textContent.includes("Confirmed browser reply"));
    assert.equal(sent,1);assert.equal(notes.length,1);assert.deepEqual(failures,[]);
    if(cookieMode){assert.equal(refreshes,1);assert.equal(await page.evaluate(()=>localStorage.getItem("token")),null);}
    await page.screenshot({path:path.resolve(__dirname,"../../scratch/shared-inbox-desktop.png"),fullPage:true});
    await page.setViewport({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:path.resolve(__dirname,"../../scratch/shared-inbox-mobile.png"),fullPage:true});
    console.log("PASS: browser loads assigned inbox, shows history gap, saves shared note, sends a confirmed reply, no runtime errors, mobile page has no horizontal overflow. API responses are fixtures; real backend is covered separately.");
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
