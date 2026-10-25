"use strict";
const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
async function run(db,rows){
  let statements=0,routingLocks=0;
  const traced={...db,getConnection:callback=>db.getConnection((error,connection)=>{
    if(error)return callback(error);
    const client=connection.promise();
    callback(null,{release:()=>connection.release(),promise:()=>({
      beginTransaction:()=>client.beginTransaction(),commit:()=>client.commit(),rollback:()=>client.rollback(),
      query:(sql,params)=>{statements++;if(sql.includes("SELECT last_user_id FROM wa_routing_cursors"))routingLocks++;return client.query(sql,params);},
    })});
  })};
  const service=require("../../services/sharedInboxService").createInboxService(traced);
  const count=200,concurrency=8,latencies=[];let completed=0;
  const started=performance.now();
  await Promise.all(Array.from({length:concurrency},async(_,worker)=>{
    for(let i=worker;i<count;i+=concurrency){
      const row=rows[i%rows.length],before=performance.now();
      const result=await service.inbound({tenantId:1,senderId:1,phone:row.contact_phone,timestamp:new Date()});
      assert.equal(result.owner_user_id,row.owner_user_id);completed++;latencies.push(performance.now()-before);
    }
  }));
  const elapsed=performance.now()-started;latencies.sort((a,b)=>a-b);
  assert.equal(routingLocks,0);
  const report={scenario:"existing-owner routing metadata only",messages:completed,concurrency,elapsedMs:Math.round(elapsed),operationsPerSecond:Math.round(completed*1000/elapsed),p50Ms:Math.round(latencies[Math.floor(count*0.5)]),p95Ms:Math.round(latencies[Math.floor(count*0.95)]),sqlStatementsPerMessage:statements/count,routingLocks,node:process.version};
  console.log("BENCHMARK "+JSON.stringify(report));return report;
}
module.exports={run};
