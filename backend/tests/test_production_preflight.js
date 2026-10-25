"use strict";
const assert=require("node:assert/strict");
const http=require("node:http");
const path=require("node:path");
const {validate}=require("../scripts/production-preflight");
const {check}=require("../scripts/readiness-check");
async function main(){
  const env={NODE_ENV:"production",DB_ENGINE:"mysql",USE_SQLITE:"0",DB_HOST:"127.0.0.1",DB_NAME:"fixture",DB_USER:"fixture_user",DB_PASS:"fixture_password",JWT_SECRET:"a".repeat(64),SMTP_ENCRYPTION_KEY:"b".repeat(64),PUBLIC_BASE_URL:"https://api.fixture.test",ALLOWED_ORIGINS:"https://app.fixture.test",WA_DATA_DIR:path.resolve(__dirname,"../../scratch/fixture-data"),REQUIRE_HARD_CONFIG:"1",ALLOW_START_WITHOUT_DB:"0",WA_SERVER_CHAT_STORAGE:"0",WA_ENABLE_WEB_ENGINE:"0",WA_LEGACY_PUBLIC_UPLOADS:"0",AUTH_BROWSER_COOKIES:"1"};
  env.AUTH_COOKIE_SITE_DOMAIN="fixture.test";
  assert.deepEqual(validate(env,24),[]);
  assert(validate({...env,WA_RUNTIME_PROFILE:"small-vps"},24).length>0);
  assert.deepEqual(validate({...env,WA_RUNTIME_PROFILE:"small-vps",OPS_METRICS_TOKEN:"c".repeat(48),BACKUP_REQUIRED:"1",RESTIC_REPOSITORY:"s3:https://fixture.r2.cloudflarestorage.com/private-backups",RESTIC_PASSWORD_FILE:"/private/password"},24),[]);
  for(const override of [{DB_USER:"root"},{JWT_SECRET:"CHANGE_ME"},{ALLOWED_ORIGINS:"https://*.fixture.test"},{PUBLIC_BASE_URL:"http://api.fixture.test"},{DB_ENGINE:"sqlite"},{WA_SERVER_CHAT_STORAGE:"1"},{AUTH_BROWSER_COOKIES:"0"},{WA_DATA_DIR:path.resolve(__dirname,"..")}])assert(validate({...env,...override},24).length>0);
  assert(validate(env,26).includes("Use the declared Node 24 runtime"));
  assert(validate({...env,DISABLE_R2:"0"},24).some(error=>error.includes("R2_ACCOUNT_ID")));
  assert(validate({...env,DISABLE_R2:"1",R2_REQUIRED:"1"},24).some(error=>error.includes("R2_REQUIRED")));
  const r2={DISABLE_R2:"0",R2_ACCOUNT_ID:"fixture-account",R2_ACCESS_KEY_ID:"fixture-key",R2_SECRET_ACCESS_KEY:"fixture-secret",R2_BUCKET_NAME:"fixture-private"};
  assert.deepEqual(validate({...env,...r2},24),[]);
  assert(validate({...env,...r2,R2_PUBLIC_DOMAIN:"https://assets.fixture.test",R2_PUBLIC_BUCKET_NAME:"fixture-private"},24).length>0);
  const {usesSqlite}=require("../config/databaseEngine");
  assert.equal(usesSqlite({DB_ENGINE:"mysql",USE_SQLITE:"1",R2_ACCOUNT_ID:"fixture"}),false);
  assert.equal(usesSqlite({DB_ENGINE:"r2"}),true);
  assert.equal(usesSqlite({DB_ENGINE:"mysql",R2_ACCOUNT_ID:"fixture"}),false);
  let health={ok:false,sharedInboxReady:false};
  const server=http.createServer((req,res)=>{res.setHeader("Content-Type","application/json");res.end(JSON.stringify(health));});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    const target=`http://127.0.0.1:${server.address().port}/health`;
    assert.equal(await check(target),false);health={ok:true,sharedInboxReady:false};assert.equal(await check(target),false);health={ok:true,sharedInboxReady:true};assert.equal(await check(target),true);
  }finally{await new Promise(resolve=>server.close(resolve));}
  console.log("PASS: strict production preflight rejects unsafe deployment settings; readiness requires DB and inbox readiness even when HTTP status is 200.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
