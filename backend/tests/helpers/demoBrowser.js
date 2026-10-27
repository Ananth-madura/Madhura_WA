"use strict";
const assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path"),puppeteer=require("puppeteer");

async function verify(){
  const build=process.env.INBOX_TEST_FRONTEND_BUILD||path.resolve(__dirname,"../../../frontend/build");
  const server=http.createServer((req,res)=>{
    const file=path.resolve(build,"."+new URL(req.url,"http://localhost").pathname);
    if(!file.startsWith(build+path.sep))return res.writeHead(403).end();
    const target=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(build,"index.html");
    res.setHeader("Content-Type",target.endsWith(".js")?"text/javascript":target.endsWith(".css")?"text/css":"text/html");fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve=>server.listen(15318,"127.0.0.1",resolve));let browser;
  try{
    const executablePath=[process.env.INBOX_TEST_BROWSER,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file=>file&&fs.existsSync(file));
    browser=await puppeteer.launch({headless:true,executablePath,args:["--no-sandbox"]});
    const page=await browser.newPage(),errors=[],leaks=[];
    await page.setViewport({width:1440,height:1000});
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error"&&message.text().includes("Workspace rendering failed"))errors.push(message.text());});
    await page.setRequestInterception(true);page.on("request",request=>{
      const url=new URL(request.url());
      if(url.pathname.startsWith("/api/")&&!['/api/v2/billing/plans','/api/auth/plans'].includes(url.pathname)){leaks.push({path:url.pathname,method:request.method()});return request.abort();}
      if(!["localhost","127.0.0.1"].includes(url.hostname))return request.abort();
      return request.continue();
    });
    const open=async route=>page.goto("http://127.0.0.1:15318"+route,{waitUntil:"networkidle2"});
    await open("/login?tab=demo");
    await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent.includes("Primary Organization Admin")).click());
    await page.waitForFunction(()=>location.pathname==="/whatsapp");
    for(const route of ["/whatsapp","/whatsapp/team-inbox","/whatsapp/contacts","/whatsapp/templates","/whatsapp/groups","/whatsapp/campaigns","/whatsapp/automations","/whatsapp/flows","/whatsapp/analytics","/whatsapp/accounts","/whatsapp/employees","/whatsapp/branches","/whatsapp/billing","/whatsapp/workspace","/whatsapp/workspace/campaigns"]){
      await open(route);
      await page.waitForFunction(()=>document.body.innerText.includes("Interactive Demo Mode"),{timeout:5000}).catch(async error=>{throw new Error(`${route}: ${page.url()} ${await page.evaluate(()=>document.body.innerText.slice(0,1800))}: ${error.message}; errors=${JSON.stringify(errors)}`);});
      assert.equal(new URL(page.url()).pathname,route,`Demo route returned to login: ${route}`);
      assert(!await page.evaluate(()=>document.body.innerText.includes("The workspace could not open")),`Demo page failed: ${route}`);
      assert.deepEqual(errors,[],route);
    }
    await open("/whatsapp/contacts");
    await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent.trim()==="Add Contact").click());
    await page.waitForSelector('input[placeholder="Customer Name"]');
    await page.type('input[placeholder="Customer Name"]',"Browser sample customer");
    await page.type('input[placeholder="9876543210"]',"919000000001");
    await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent.trim()==="Create contact").click());
    await page.waitForFunction(()=>!document.querySelector('input[placeholder="Customer Name"]')&&document.body.innerText.includes("Browser sample customer"));
    await open("/whatsapp/contacts");
    await page.waitForFunction(()=>document.body.innerText.includes("Browser sample customer"));
    assert.deepEqual(leaks,[],"Demo must not contact protected backend endpoints");
    await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent.trim()==="Create real workspace").click());
    await page.waitForFunction(()=>location.pathname==="/signup",{timeout:6000}).catch(async error=>{throw new Error(`Demo conversion: ${page.url()} ${await page.evaluate(()=>document.body.innerText.slice(0,900))}; ${error.message}`);});
    assert.equal(await page.evaluate(()=>localStorage.getItem("user")),null);
    assert.equal(await page.evaluate(()=>localStorage.getItem("token")),null);
    await open("/login?tab=demo");
    await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent.includes("Branch Support Agent")).click());
    await page.waitForFunction(()=>location.pathname==="/whatsapp");
    await open("/whatsapp/team-inbox");
    await page.waitForFunction(()=>document.body.innerText.includes("Interactive Demo Mode"));
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("user")).role),"employee");
    assert.deepEqual(errors,[]);
    assert.deepEqual(leaks,[]);
    console.log("PASS: production-built demo login stays in the existing workspace through 15 screens and reloads; sample contact creation persists locally; no protected backend calls; conversion clears demo state and opens real signup.");
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports={verify};
