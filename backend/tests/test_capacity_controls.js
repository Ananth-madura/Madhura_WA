"use strict";
const assert=require("node:assert/strict");
const express=require("express");
const {createAdmission}=require("../middleware/requestAdmission");
const {createExecutor}=require("../services/boundedExecutor");
const {limits}=require("../config/capacity");
const {evaluate}=require("../scripts/ops-check");

async function main(){
  assert.deepEqual(limits({}),{pool:10,poolQueue:128,http:64,uploads:2,webhooks:16,ai:4,aiQueue:32});
  assert.equal(limits({DB_POOL_LIMIT:"0",DB_POOL_QUEUE_LIMIT:"0"}).poolQueue,128);
  const app=express(),gate=createAdmission(2);let releaseWork;
  const work=new Promise(resolve=>{releaseWork=resolve;});
  app.get("/health",(req,res)=>res.json({ok:true}));
  app.use(gate.middleware);app.get("/work",async(req,res)=>{await work;res.json({ok:true});});
  const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const first=fetch(base+"/work"),second=fetch(base+"/work");
    for(let i=0;i<100&&gate.stats().active<2;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(gate.stats().active,2);
    const overloaded=await fetch(base+"/work");assert.equal(overloaded.status,503);assert.equal(overloaded.headers.get("retry-after"),"2");
    assert.equal((await fetch(base+"/health")).status,200);
    releaseWork();await Promise.all([first,second]);assert.equal(gate.stats().active,0);
    const release=gate.enter();release();release();assert.equal(gate.stats().active,0);
  }finally{releaseWork();await new Promise(resolve=>server.close(resolve));}
  const provider=createExecutor(2,1,1000);let finish;
  const hold=new Promise(resolve=>{finish=resolve;});let active=0,peak=0;
  const run=()=>provider.run(async()=>{active++;peak=Math.max(peak,active);await hold;active--;});
  const tasks=[run(),run(),run()];await assert.rejects(run(),/capacity/);assert.equal(provider.stats().waiting,1);
  finish();await Promise.all(tasks);assert.equal(peak,2);
  const timeout=createExecutor(1,1,10);let complete;
  const busy=timeout.run(()=>new Promise(resolve=>{complete=resolve;}));
  await assert.rejects(timeout.run(()=>{}),/wait expired/);complete();await busy;
  const healthy={health:{ok:true,sharedInboxReady:true},metrics:{rssMb:500,eventLoopP99Ms:20},disk:{usedPercent:50,freeGb:50}};
  assert.equal(evaluate(healthy).ok,true);
  assert(evaluate({...healthy,disk:{usedPercent:95,freeGb:5}}).critical.includes("disk_capacity"));
  assert(evaluate({...healthy,health:{ok:false}}).critical.includes("backend_not_ready"));
  assert(evaluate({...healthy,backupRequired:true}).critical.includes("backup_stale_or_missing"));
  const cursor=require("../services/inboxCursor");assert.equal(cursor.decode(cursor.encode({id:7,updated_at:new Date("2026-01-01T00:00:00Z")})).id,7);
  assert.throws(()=>cursor.decode("v1.not-json"),{status:400});
  let clock=1000,checks=0,finishCheck;
  const database={isSqlite:false,promise:()=>({query:()=>{checks++;return new Promise(resolve=>{finishCheck=resolve;});}})};
  const probe=require("../services/databaseHealth").createDatabaseHealth(database,{now:()=>clock});
  const firstCheck=probe.check(),secondCheck=probe.check();await Promise.resolve();assert.equal(checks,1);finishCheck();await Promise.all([firstCheck,secondCheck]);assert.equal(probe.status().ok,true);
  clock+=31000;assert.equal(probe.status().ok,false);
  database.promise=()=>({query:async()=>{throw Object.assign(new Error("offline"),{code:"ECONNREFUSED"});}});
  await probe.check();assert.equal(probe.status().ok,false);assert.equal(probe.status().errorCode,"ECONNREFUSED");
  database.promise=()=>({query:async()=>[[]]});await probe.check();assert.equal(probe.status().ok,true);probe.stop();
  console.log("PASS: bounded HTTP admission returns retryable 503 while health remains available; release is idempotent; AI concurrency, queue and wait limits; pool bounds; resource alerts.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
