"use strict";
const fs = require("node:fs");
const puppeteer = require("puppeteer");

async function main() {
  const executablePath = [process.env.INBOX_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => file && fs.existsSync(file));
  const browser = await puppeteer.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const responses = [], failures = [];
    await page.setViewport({width:1440,height:1000});
    page.on("pageerror", error => failures.push(error.message));
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/")) responses.push({path:url.pathname,status:response.status()});
    });
    await page.goto("https://live.wa.madhuratech.in/login?tab=demo", {waitUntil:"networkidle2"});
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent.includes("Primary Organization Admin")));
    await page.evaluate(() => [...document.querySelectorAll("button")].find(button => button.textContent.includes("Primary Organization Admin")).click());
    await new Promise(resolve => setTimeout(resolve, 8000));
    console.log(JSON.stringify({url:page.url(),responses,failures,visibleText:(await page.evaluate(()=>document.body.innerText)).slice(0,1800)}));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
