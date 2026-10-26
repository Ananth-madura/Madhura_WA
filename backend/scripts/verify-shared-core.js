"use strict";
const path=require("node:path");
const fs=require("node:fs"),os=require("node:os");
const {spawnSync}=require("node:child_process");
const args=new Set(process.argv.slice(2));
if([...args].some(arg=>!["--integration","--browser"].includes(arg))||args.has("--browser")&&!args.has("--integration")){
  console.error("Usage: node scripts/verify-shared-core.js [--integration [--browser]]");process.exit(2);
}
const port=Number(process.env.INBOX_TEST_MYSQL_PORT);
if(args.has("--integration")&&(!Number.isInteger(port)||port<1024||port>65535||port===3306)){
  console.error("Set INBOX_TEST_MYSQL_PORT to an isolated local test instance, for example 13307. The default database port is refused.");process.exit(2);
}
const suites=["test_capacity_controls.js","test_production_preflight.js","test_shared_flow_definition.js","test_flow_customization.js","test_quick_reminders.js","test_quick_reminders_service.js","test_reminder_schema_heal.js","test_enquiry_service.js","test_shared_flow_lifecycle.js","test_wa_webhook_auth.js","test_wa_privacy_and_receipts.js","test_razorpay_security.js","test_keep_alive.js","test_schema_readiness.js"];
suites.push("test_automation_tenant_scope.js");
suites.push("test_client_portal.js");
suites.push("test_inbox_outbound_validation.js");
suites.push("test_workspace_transaction_connection.js");
if(args.has("--integration"))suites.push("test_browser_sessions_mysql.js","test_shared_inbox_mysql.js","test_employee_workspace_mysql.js","test_shared_inbox_boot.js","test_billing_mysql.js");
const env={...process.env,NODE_ENV:"test",WA_SKIP_DOTENV:"1",DB_ENGINE:"mysql",USE_SQLITE:"0",DB_HOST:"127.0.0.1",DB_PORT:"9",DB_NAME:"shared_core_test_only",DB_USER:"isolated_tests_only",DB_PASS:"",DISABLE_R2:"1",REDIS_URL:"",WA_SERVER_CHAT_STORAGE:"0",INBOX_TEST_REAL_BROWSER:args.has("--browser")?"1":"0",INBOX_TEST_AUTH_BROWSER:args.has("--browser")?"1":"0"};
let failed=0;
for(const suite of suites){
  const testData=fs.mkdtempSync(path.join(os.tmpdir(),"wa-core-test-"));
  const result=spawnSync(process.execPath,[path.resolve(__dirname,"../tests",suite)],{env:{...env,WA_DATA_DIR:testData,WA_ENABLE_WEB_ENGINE:"0"},stdio:"inherit",timeout:suite==="test_shared_inbox_boot.js"?240000:60000});
  if(result.error||result.status!==0){failed++;console.error(`FAIL: ${suite}${result.error?` (${result.error.code||"process error"})`:""}`);}
}
console.log(JSON.stringify({suites:suites.length,passed:suites.length-failed,failed,node:process.versions.node,integration:args.has("--integration"),browser:args.has("--browser")}));
if(failed)process.exitCode=1;
