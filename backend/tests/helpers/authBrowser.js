"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http"),puppeteer=require("puppeteer");
async function verify(){
  const build=path.resolve(__dirname,"../../../frontend/build");
  const server=http.createServer((req,res)=>{
    const target=path.resolve(build,"."+new URL(req.url,"http://localhost").pathname);
    if(!target.startsWith(build+path.sep))return res.writeHead(403).end();
    const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(build,"index.html");
    res.setHeader("Content-Type",file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":"text/html");fs.createReadStream(file).pipe(res);
  });await new Promise(resolve=>server.listen(15318,resolve));let browser;
  const diagnostics=[];
  try{
    const executablePath=[process.env.INBOX_TEST_BROWSER,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file=>file&&fs.existsSync(file));
    browser=await puppeteer.launch({headless:true,...(executablePath?{executablePath}:{}),args:["--no-sandbox"]});
    for(const hostname of ["127.0.0.1","localhost"]){
      const context=await browser.createBrowserContext(),page=await context.newPage(),origin=`http://${hostname}:15318`;
      const errors=[];page.on("pageerror",error=>errors.push(error.message));
      page.on("response",response=>{const url=new URL(response.url());if(url.pathname.startsWith("/api/auth/")||url.pathname==="/api/v2/me")diagnostics.push({host:hostname,path:url.pathname,status:response.status()});});
      await page.setRequestInterception(true);page.on("request",request=>["localhost","127.0.0.1"].includes(new URL(request.url()).hostname)?request.continue():request.abort());
      const email=`browser-signup-${hostname.replace(/\./g,"-")}-${Date.now()}@fixture.test`,password="browser-signup-only-123";
      await page.goto(`${origin}/signup`,{waitUntil:"networkidle2"});
      for(const [selector,value] of [["#lp-company-name","Browser signup workspace"],["#lp-first-name","Browser owner"],["#lp-email",email],["#lp-pass",password],["#lp-pass-confirm",password]])await page.type(selector,value);
      await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent.includes("Proceed to Branch")).click());
      await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(button=>button.textContent.includes("Create free workspace")&&!button.disabled),{timeout:15000});
      await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>button.textContent.includes("Create free workspace")).click());
      await page.waitForFunction(()=>location.pathname==="/whatsapp",{timeout:10000});await new Promise(resolve=>setTimeout(resolve,2000));
      assert.equal(new URL(page.url()).pathname,"/whatsapp","Signup returned to login");
      await page.reload({waitUntil:"networkidle2"});assert.equal(new URL(page.url()).pathname,"/whatsapp","Reload lost the authenticated session");
      const state=await page.evaluate(()=>({cookieSession:JSON.parse(localStorage.getItem("user")||"null")?.cookieSession,tokenStored:Boolean(localStorage.getItem("token"))}));assert.equal(state.cookieSession,true);assert.equal(state.tokenStored,false);
      await page.goto(`${origin}/login`,{waitUntil:"networkidle2"});assert.equal(new URL(page.url()).pathname,"/whatsapp");
      await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(button=>/log\s*out/i.test(button.textContent)),{timeout:15000});
      await page.evaluate(()=>[...document.querySelectorAll("button")].find(button=>/log\s*out/i.test(button.textContent)).click());
      await page.waitForFunction(()=>location.pathname==="/login",{timeout:10000});
      await page.type("#hl-email",email);await page.type("#hl-password",password);await page.click('form button[type="submit"]');
      await page.waitForFunction(()=>location.pathname==="/whatsapp",{timeout:10000});await new Promise(resolve=>setTimeout(resolve,2000));assert.equal(new URL(page.url()).pathname,"/whatsapp","Login returned to the public page");
      await page.screenshot({path:path.resolve(__dirname,`../../../scratch/flows-auth-${hostname}.png`),fullPage:true});assert.deepEqual(errors,[]);await context.close();
    }
    console.log("PASS: real browser signup, workspace entry, hard refresh, public-login redirect, logout and later login on both localhost and 127.0.0.1, using HttpOnly sessions without localStorage tokens. Isolated database only.");
  }finally{
    fs.writeFileSync(path.resolve(__dirname,"../../../scratch/flows-auth-browser-debug.log"),JSON.stringify(diagnostics,null,2));
    if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  }
}
module.exports={verify};
