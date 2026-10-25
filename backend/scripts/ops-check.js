"use strict";
const fs=require("node:fs");
const path=require("node:path");
function evaluate({health,metrics,disk,backupRequired=false,backupAt}) {
  const critical=[],warnings=[];
  if(!health?.ok||!health?.sharedInboxReady)critical.push("backend_not_ready");
  if(!disk)critical.push("disk_unobservable");
  else if(disk.usedPercent>=90||disk.freeGb<10)critical.push("disk_capacity");
  else if(disk.usedPercent>=80||disk.freeGb<20)warnings.push("disk_headroom");
  if(!metrics)warnings.push("runtime_metrics_unavailable");
  else {
    if(metrics.rssMb>=1000||metrics.eventLoopP99Ms>=250)critical.push("runtime_pressure");
    else if(metrics.rssMb>=850||metrics.eventLoopP99Ms>=100)warnings.push("runtime_headroom");
    if(metrics.retention?.lastRun?.backlogPossible)warnings.push("retention_backlog");
    if(metrics.assistant?.provider?.waiting>=16)warnings.push("assistant_queue_pressure");
    if(metrics.flows?.pending>=32||metrics.flows?.sessions>=200)warnings.push("flow_capacity_pressure");
    if(metrics.database?.queryMs>=1000)warnings.push("database_latency");
    if(metrics.admission?.http?.active>=metrics.admission?.http?.limit*0.8)warnings.push("http_capacity_pressure");
  }
  if(backupRequired&&(!backupAt||!Number.isFinite(new Date(backupAt).getTime())||Date.now()-new Date(backupAt).getTime()>36*3600000))critical.push("backup_stale_or_missing");
  return {ok:critical.length===0,critical,warnings};
}
async function main() {
  const envFile=path.resolve(__dirname,"../.env");if(fs.existsSync(envFile))process.loadEnvFile(envFile);
  const base=`http://127.0.0.1:${Number(process.env.PORT)||5001}`;
  const read=async(route,headers={})=>{try{const response=await fetch(base+route,{headers,signal:AbortSignal.timeout(5000)});return response.ok?await response.json():null;}catch(_){return null;}};
  const [health,metrics]=await Promise.all([read("/health"),read("/api/ops/metrics",{Authorization:`Bearer ${process.env.OPS_METRICS_TOKEN||""}`})]);
  let disk=null;
  let backupAt=null;
  try{backupAt=JSON.parse(fs.readFileSync(path.join(process.env.WA_DATA_DIR||"/var/data","backups/last-success.json"),"utf8")).at;}catch(_){}
  try {const state=await fs.promises.statfs(process.env.WA_DATA_DIR||"/var/data");disk={freeGb:Math.round(state.bavail*state.bsize/1e9),usedPercent:Math.round((1-state.bavail/state.blocks)*100)};}catch(_){}
  const report={at:new Date().toISOString(),...evaluate({health,metrics,disk,backupRequired:process.env.BACKUP_REQUIRED==="1",backupAt}),disk,rssMb:metrics?.rssMb,eventLoopP99Ms:metrics?.eventLoopP99Ms};
  console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;
}
if(require.main===module)main().catch(()=>{console.error("Operations check failed");process.exitCode=1;});
module.exports={evaluate};
