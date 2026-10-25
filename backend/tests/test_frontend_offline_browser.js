"use strict";
const assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path"),puppeteer=require("puppeteer");
async function main(){
  const build=path.resolve(__dirname,"../../frontend/build");
  const server=http.createServer((req,res)=>{
    const target=path.resolve(build,"."+new URL(req.url,"http://localhost").pathname);
    if(!target.startsWith(build+path.sep))return res.writeHead(403).end();
    const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(build,"index.html");
    res.setHeader("Content-Type",file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":"text/html");fs.createReadStream(file).pipe(res);
  });await new Promise(resolve=>server.listen(15318,"127.0.0.1",resolve));let browser;
  try{
    const executablePath=[process.env.INBOX_TEST_BROWSER,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file=>file&&fs.existsSync(file));
    browser=await puppeteer.launch({headless:true,...(executablePath?{executablePath}:{}),args:["--no-sandbox"]});
    for(const mode of ["html","invalid-json","offline"]){for(const demoMode of [true,false]){
      const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],apiOrigins=new Set();page.on("pageerror",error=>errors.push(error.message));
      await page.evaluateOnNewDocument(demo=>{localStorage.setItem("user",JSON.stringify({id:2147483647,role:"admin",first_name:"Test account",tenant_id:1,demoMode:demo,isStrictDemo:demo}));localStorage.setItem("active_tenant_id","1");if(!demo)localStorage.setItem("token","invalid-test-token");},demoMode);
      await page.setRequestInterception(true);page.on("request",request=>{
        const url=new URL(request.url());
        if(url.pathname.startsWith("/api/")){
          apiOrigins.add(url.origin);
          if(mode==="offline")return request.abort("failed");
          return request.respond({status:200,headers:{"access-control-allow-origin":"http://127.0.0.1:15318","access-control-allow-credentials":"true","content-type":mode==="html"?"text/html":"application/json"},body:mode==="html"?"<!doctype html><html><body>Vercel SPA fallback</body></html>":JSON.stringify({unexpected:true})});
        }
        if(!["127.0.0.1","localhost"].includes(url.hostname))return request.abort();
        return request.continue();
      });
      await page.goto(`http://127.0.0.1:15318${process.env.FRONTEND_TEST_PATH||"/whatsapp"}`,{waitUntil:"networkidle2"});await new Promise(resolve=>setTimeout(resolve,1000));
      assert.deepEqual(errors,[],`${mode}, demo=${demoMode}: ${errors.join(", ")}`);
      const text=await page.evaluate(()=>document.body.innerText);
      assert(text.trim().length>60,`${mode}: page became blank`);assert(!text.includes("workspace could not open"),`${mode}: render boundary caught an unexpected crash`);
      if(!demoMode)assert(/backend|invalid response|unavailable/i.test(text),text.slice(0,400));
      await page.reload({waitUntil:"networkidle2"});await new Promise(resolve=>setTimeout(resolve,500));assert.deepEqual(errors,[]);assert((await page.evaluate(()=>document.body.innerText)).trim().length>60);
      if(process.env.FRONTEND_TEST_EXPECT_API&&!demoMode){assert(apiOrigins.size>0,"No API request was exercised");assert.deepEqual([...apiOrigins],[process.env.FRONTEND_TEST_EXPECT_API],"Built frontend requested the wrong API origin");}
      await page.screenshot({path:path.resolve(__dirname,`../../scratch/flows-offline-${mode}-${demoMode}.png`),fullPage:true});await context.close();
    }}
    console.log("PASS: deployed-build routes stay visible after login and hard reload for HTML-200 fallbacks, invalid JSON and an unavailable API, in both offline demo and cached-user sessions. No production requests.");
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
