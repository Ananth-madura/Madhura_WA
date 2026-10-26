"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http"),puppeteer=require("puppeteer");
async function verify({query,meta}){
  const build=path.resolve(__dirname,"../../../frontend/build"),fixture=path.resolve(__dirname,"../../../scratch/employee-workspace-browser-upload.pdf");
  fs.writeFileSync(fixture,"%PDF-1.4\nbrowser fixture\n%%EOF");
  const server=http.createServer((req,res)=>{
    const file=path.resolve(build,"."+new URL(req.url,"http://localhost").pathname);
    if(!file.startsWith(build+path.sep))return res.writeHead(403).end();
    const target=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(build,"index.html");
    res.setHeader("Content-Type",target.endsWith(".js")?"text/javascript":target.endsWith(".css")?"text/css":"text/html");fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve=>server.listen(15318,"127.0.0.1",resolve));let browser;
  try{
    const executablePath=[process.env.INBOX_TEST_BROWSER,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file=>file&&fs.existsSync(file));
    browser=await puppeteer.launch({headless:true,...(executablePath?{executablePath}:{}),args:["--no-sandbox"]});
    const page=await browser.newPage(),errors=[];page.on("pageerror",error=>errors.push(error.message));page.on("dialog",dialog=>dialog.accept());
    await page.setRequestInterception(true);page.on("request",request=>["127.0.0.1","localhost"].includes(new URL(request.url()).hostname)?request.continue():request.abort());
    await page.goto("http://127.0.0.1:15318/login?returnUrl=/whatsapp/team-inbox",{waitUntil:"networkidle2"});
    await page.type("#hl-email","agent@fixture.test");await page.type("#hl-password","fixture-browser-password");await page.click('form button[type="submit"]');
    await page.waitForSelector('aside[aria-label="Conversations"] button');await page.click('aside[aria-label="Conversations"] button');
    await page.waitForFunction(()=>[...document.querySelectorAll("summary")].some(element=>element.textContent.includes("Attachments and approved templates")));
    await page.evaluate(()=>[...document.querySelectorAll("summary")].find(element=>element.textContent.includes("Attachments and approved templates")).click());
    const fileInput=await page.$('input[type="file"]');await fileInput.uploadFile(fixture);
    const sent=page.waitForResponse(response=>response.request().method()==="POST"&&/\/conversations\/\d+\/send$/.test(new URL(response.url()).pathname));
    await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent==="Send selected content").click());assert.equal((await sent).status(),200);
    await page.waitForFunction(()=>document.body.textContent.includes("Message sent"));
    const [[logged]]=await query("SELECT COUNT(*) AS count FROM wa_message_logs WHERE media_id IS NOT NULL AND sent_by='employee' AND message_text IS NULL");assert(logged.count>0);
    await page.goto("http://127.0.0.1:15318/whatsapp/workspace/campaigns",{waitUntil:"networkidle2"});
    const focus=async label=>page.evaluate(value=>[...document.querySelectorAll("label")].find(element=>element.textContent.trim().startsWith(value)).querySelector("input").focus(),label);
    await focus("Campaign name");await page.keyboard.type("Browser employee outreach");
    await page.waitForFunction(()=>[...document.querySelectorAll("label")].find(label=>label.textContent.startsWith("Business number"))?.querySelectorAll("option").length>1);
    await page.evaluate(()=>{const select=[...document.querySelectorAll("label")].find(label=>label.textContent.startsWith("Business number")).querySelector("select");select.value=select.options[1].value;select.dispatchEvent(new Event("change",{bubbles:true}));});
    await page.waitForFunction(()=>[...document.querySelectorAll("option")].some(option=>option.textContent.includes("verified_greeting")));
    await page.evaluate(()=>{const select=[...document.querySelectorAll("label")].find(label=>label.textContent.startsWith("Approved template")).querySelector("select");select.value=[...select.options].find(option=>option.textContent.includes("verified_greeting")).value;select.dispatchEvent(new Event("change",{bubbles:true}));});
    await focus("Body value 1");await page.keyboard.type("{name}");
    await page.evaluate(()=>[...document.querySelectorAll("label")].find(label=>label.textContent.includes("919999999999")&&label.querySelector('input[type="checkbox"]')).querySelector("input").click());
    const deliveriesBefore=meta.deliveries.length;
    await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent==="Create draft campaign").click());
    await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(button=>button.textContent==="start"));
    assert.equal(meta.deliveries.length,deliveriesBefore,"Saving a draft must not send messages");
    const started=page.waitForResponse(response=>response.request().method()==="POST"&&/\/campaigns\/\d+\/start$/.test(new URL(response.url()).pathname));
    await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent==="start").click());assert.equal((await started).status(),200);
    for(let attempt=0;attempt<100&&meta.deliveries.length===deliveriesBefore;attempt++)await new Promise(resolve=>setTimeout(resolve,100));
    assert.equal(meta.deliveries.length,deliveriesBefore+1);
    assert.equal(meta.deliveries.at(-1).type,"template");
    await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.resolve(__dirname,"../../../scratch/employee-workspace-outreach-browser.png"),fullPage:true});assert.deepEqual(errors,[]);
    console.log("PASS: built employee UI uploads a private file to Meta transport, persists only metadata, creates a campaign draft without sending, explicitly starts the worker, and renders on mobile without runtime errors.");
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.unlinkSync(fixture);}
}
module.exports={verify};
