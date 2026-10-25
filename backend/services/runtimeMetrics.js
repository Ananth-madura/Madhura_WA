"use strict";
const crypto=require("node:crypto");
const {monitorEventLoopDelay}=require("node:perf_hooks");
const v8=require("node:v8");
const loop=monitorEventLoopDelay({resolution:20});
loop.enable();
const reset=setInterval(()=>loop.reset(),60000);reset.unref();
function snapshot() {
  const memory=process.memoryUsage(),mb=value=>Math.round(value/1048576);
  return {at:new Date().toISOString(),uptimeSeconds:Math.floor(process.uptime()),rssMb:mb(memory.rss),heapUsedMb:mb(memory.heapUsed),heapLimitMb:mb(v8.getHeapStatistics().heap_size_limit),
    eventLoopP99Ms:Math.round(loop.percentile(99)/1000000),admission:require("../middleware/requestAdmission").stats(),
    assistant:require("./sharedInboxAssistant").capacity(),flows:require("./sharedFlowRuntime").capacity(),retention:require("./waStorageRetention").status(),
    socketConnections:require("../sockets/chatsockets").getIO()?.engine?.clientsCount||0};
}
function protectedSnapshot(req,res) {
  const configured=process.env.OPS_METRICS_TOKEN||"",provided=String(req.headers.authorization||"").replace(/^Bearer /,"");
  const incoming=Buffer.from(provided),expected=Buffer.from(configured);
  if(configured.length<32||incoming.length!==expected.length||!crypto.timingSafeEqual(incoming,expected))return res.sendStatus(404);
  res.set("Cache-Control","no-store").json({...snapshot(),database:req.app?.get("databaseHealth")?.status()});
}
module.exports={snapshot,protectedSnapshot};
