"use strict";
const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const puppeteer=require("puppeteer");
async function main(){
  const server=http.createServer((req,res)=>res.end("<!doctype html><title>Local cache verification</title>"));
  await new Promise(resolve=>server.listen(15319,"127.0.0.1",resolve));let browser;
  try{
    const executablePath=[process.env.INBOX_TEST_BROWSER,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file=>file&&fs.existsSync(file));
    browser=await puppeteer.launch({headless:true,...(executablePath?{executablePath}:{}),args:["--no-sandbox"]});
    const page=await browser.newPage();await page.goto("http://127.0.0.1:15319");
    await page.evaluate(async()=>{
      localStorage.setItem("user",JSON.stringify({id:1,tenant_id:1}));localStorage.setItem("active_tenant_id","1");
      await new Promise((resolve,reject)=>{
        const opening=indexedDB.open("whatsapp-crm-device-cache",1);
        opening.onupgradeneeded=()=>opening.result.createObjectStore("cache",{keyPath:"key"});
        opening.onerror=()=>reject(opening.error);
        opening.onsuccess=()=>{const db=opening.result,tx=db.transaction("cache","readwrite");
          tx.objectStore("cache").put({key:"v2:1:1:messages:legacy",updatedAt:Date.now(),value:[{id:"old",body:"Preserve existing device history",timestamp:Date.now()/1000}]});
          tx.oncomplete=()=>{db.close();resolve();};};
      });
    });
    const source=fs.readFileSync(path.resolve(__dirname,"../../frontend/src/utils/waLocalCache.js"),"utf8").replace(/\bexport\s+/g,"");
    await page.evaluate(code=>(0,eval)(code+"\nwindow.cacheApi={readLocalMessages,writeLocalMessages,writeLocalMedia,clearLocalCache};"),source);
    const result=await page.evaluate(async()=>{
      const api=window.cacheApi,legacy=await api.readLocalMessages("legacy");
      let oversizeRejected=false;try{await api.writeLocalMedia("too-big",{data:"x".repeat(6*1024*1024)});}catch(_){oversizeRejected=true;}
      for(let i=0;i<7;i++)await api.writeLocalMedia(`media-${i}`,{data:"x".repeat(4*1024*1024)});
      const metadata=await new Promise((resolve,reject)=>{const opening=indexedDB.open("whatsapp-crm-device-cache",2);opening.onerror=()=>reject(opening.error);opening.onsuccess=()=>{const db=opening.result,request=db.transaction("metadata").objectStore("metadata").getAll();request.onsuccess=()=>{db.close();resolve(request.result);};};});
      const pending=api.writeLocalMessages("pending-before-logout",[{id:"queued",body:"Must not return after purge",timestamp:Date.now()/1000}]);
      await api.clearLocalCache();await pending;
      const purged=await api.readLocalMessages("pending-before-logout");
      localStorage.setItem("user",JSON.stringify({id:2,tenant_id:1}));
      await api.writeLocalMessages("own",[{id:"own",body:"Second account",timestamp:Date.now()/1000}]);
      localStorage.setItem("user",JSON.stringify({id:1,tenant_id:1}));await api.clearLocalCache();
      const foreign=await api.readLocalMessages("own");localStorage.setItem("user",JSON.stringify({id:2,tenant_id:1}));
      const retained=await api.readLocalMessages("own");
      return {legacyBody:legacy?.[0]?.body,oversizeRejected,bytes:metadata.reduce((sum,row)=>sum+row.bytes,0),mediaRows:metadata.filter(row=>row.key.includes(":media:")).length,purged:!purged,foreign:!foreign,otherRetained:retained?.[0]?.body==="Second account"};
    });
    assert.equal(result.legacyBody,"Preserve existing device history");assert(result.oversizeRejected);assert(result.bytes<=25*1024*1024);assert(result.mediaRows<=6);assert(result.purged);assert(result.foreign);assert(result.otherRetained);
    console.log("PASS: actual browser IndexedDB v1->v2 migration preserves history; metadata-based 25 MB eviction; 5 MB item cap; logout cancels queued writes; account cache isolation.");
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
