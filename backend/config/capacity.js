"use strict";
const integer = (value, fallback, min, max) => {
  const parsed=Number(value);
  return Number.isInteger(parsed) && parsed>=min && parsed<=max ? parsed : fallback;
};
function limits(env=process.env) {
  return {
    pool: integer(env.DB_POOL_LIMIT||env.DB_CONNECTION_LIMIT,10,2,64),
    poolQueue: integer(env.DB_POOL_QUEUE_LIMIT,128,1,2048),
    http: integer(env.HTTP_MAX_INFLIGHT,64,4,1024),
    uploads: integer(env.HTTP_MAX_UPLOADS,2,1,16),
    webhooks: integer(env.WA_WEBHOOK_CONCURRENCY,16,1,256),
    ai: integer(env.WA_AI_CONCURRENCY,4,1,32),
    aiQueue: integer(env.WA_AI_PROVIDER_QUEUE,32,0,256),
  };
}
function validateOperations(env){
  const errors=[];
  if(env.OPS_METRICS_TOKEN&&env.OPS_METRICS_TOKEN.length<32)errors.push("OPS_METRICS_TOKEN must contain at least 32 characters");
  if(env.WA_RUNTIME_PROFILE==="small-vps"){
    if(String(env.OPS_METRICS_TOKEN||"").length<32)errors.push("The small-vps profile requires an operator metrics token");
    if(env.BACKUP_REQUIRED!=="1")errors.push("Configure and require encrypted backups before launching the small-vps profile");
    if(Number(env.DB_POOL_LIMIT)>16||Number(env.DB_POOL_QUEUE_LIMIT)===0)errors.push("Use a small bounded database pool for the 4 GB profile");
  }
  if(env.BACKUP_REQUIRED==="1"&&(!String(env.RESTIC_REPOSITORY||"").startsWith("s3:https://")||!env.RESTIC_PASSWORD_FILE))errors.push("Required backups need an HTTPS S3 repository and private password file");
  return errors;
}
module.exports={limits,integer,validateOperations};
