"use strict";
const db = require("../config/database");
let timer;
let running = false;
let lastRun=null;
const days = (key, fallback, minimum) => Math.max(minimum, Math.min(365, Number.parseInt(process.env[key], 10) || fallback));
async function cleanup() {
  if (running) return;
  running = true;
  try {
    const before = count => new Date(Date.now() - count * 86400000);
    const operations = [
      ["DELETE FROM browser_sessions WHERE expires_at < ? LIMIT 1000", before(7)],
      ["DELETE FROM wa_webhook_claims WHERE claimed_at < ? LIMIT 1000", before(days("WA_DEDUPE_RETENTION_DAYS", 14, 8))],
      ["DELETE FROM wa_webhook_events WHERE created_at < ? LIMIT 1000", before(days("WA_METADATA_RETENTION_DAYS", 30, 14))],
      ["DELETE FROM wa_message_logs WHERE created_at < ? AND status IN ('sent','delivered','read') LIMIT 1000", before(days("WA_METADATA_RETENTION_DAYS", 30, 14))],
      ["DELETE FROM wa_assignment_events WHERE created_at < ? LIMIT 1000", before(days("WA_AUDIT_RETENTION_DAYS", 90, 30))],
      ["DELETE FROM wa_inbox_send_requests WHERE created_at < ? AND status IN ('sent','failed') LIMIT 1000", before(days("WA_METADATA_RETENTION_DAYS", 30, 14))],
      ["DELETE FROM wa_flow_runs WHERE conversation_id IS NOT NULL AND ended_at < ? AND status <> 'active' LIMIT 1000", before(days("WA_AUDIT_RETENTION_DAYS", 90, 30))],
    ];
    if (db.isSqlite) return;
    const report={at:new Date().toISOString(),deleted:0,backlogPossible:false};
    for (const [sql, cutoff] of operations) {
      for (let batch = 0; batch < 10; batch++) {
        const [result] = await db.promise().query(sql, [cutoff]);
        report.deleted+=result.affectedRows;
        if (result.affectedRows < 1000) break;
        if(batch===9)report.backlogPossible=true;
      }
    }
    lastRun=report;
  } finally { running = false; }
}
function start() {
  if (timer) return;
  const interval=require("../config/capacity").integer(process.env.WA_RETENTION_INTERVAL_MS,300000,60000,3600000);
  timer = setInterval(() => cleanup().catch(error => console.error("[StorageRetention] Cleanup failed:", error.code || "DB_ERROR")), interval);
  timer.unref();
}
module.exports = { cleanup, start, status:()=>({running,lastRun}) };
