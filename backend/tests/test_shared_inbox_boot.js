"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");

async function main() {
  if (!process.env.INBOX_TEST_MYSQL_PORT) { console.log("SKIP: isolated INBOX_TEST_MYSQL_PORT required"); return; }
  const database = `inbox_boot_${process.pid}_${Date.now()}`;
  const connection = await mysql.createConnection({ host: "127.0.0.1", port: Number(process.env.INBOX_TEST_MYSQL_PORT), user: "root", password: "" });
  await connection.query(`CREATE DATABASE \`${database}\``);
  const logPath = path.resolve(__dirname, "../../scratch/shared-inbox-boot.log");
  const log = fs.openSync(logPath, "w");
  const secret = "isolated-boot-test-secret-over-32-characters";
  const meta=await require("./helpers/metaTransport").start();
  const signupProvider=await require("./helpers/signupLifecycle").start();
  const child = spawn(process.execPath, ["--require",path.resolve(__dirname,"helpers/metaPreload.js"),path.resolve(__dirname, "../server.js")], {
    cwd: path.resolve(__dirname, ".."), stdio: ["ignore", log, log], env: {
      ...process.env, WA_SKIP_DOTENV: "1", NODE_ENV: "development", PORT: "15317", DB_ENGINE: "mysql", USE_SQLITE: "0", DISABLE_R2: "1", DB_HOST: "127.0.0.1", DB_PORT: process.env.INBOX_TEST_MYSQL_PORT,
      INBOX_TEST_META_TRANSPORT:meta.url,
      RAZORPAY_API_BASE:signupProvider.url,RAZORPAY_KEY_ID:"rzp_test_signupfixture",RAZORPAY_KEY_SECRET:"signup-fixture-key-secret",RAZORPAY_WEBHOOK_SECRET:"signup-fixture-webhook",RAZORPAY_CHECKOUT_ENABLED:"1",BILLING_ALLOW_DEV_PAYMENTS:"0",
      DB_USER: "root", DB_PASS: "", DB_NAME: database, JWT_SECRET: secret, SMTP_ENCRYPTION_KEY: "a".repeat(32), ALLOW_START_WITHOUT_DB: "0",
      WA_ENABLE_WEB_ENGINE: "0", WA_ACCESS_TOKEN: "", WA_PHONE_NUMBER_ID: "", WA_APP_SECRET: "fixture-app-secret", REDIS_URL: "", REQUIRE_HARD_CONFIG: "0",
      WA_DATA_DIR: path.resolve(__dirname, "../../scratch/shared-inbox-runtime"), ADMIN_SEED_PASSWORD: "isolated-admin-only", WA_SERVER_CHAT_STORAGE: "0", PUBLIC_BASE_URL: "http://127.0.0.1:15317",
      ALLOWED_ORIGINS:"http://127.0.0.1:15317,http://127.0.0.1:15318", WA_LEGACY_PUBLIC_UPLOADS:"0", R2_REQUIRED:"0",OPS_METRICS_TOKEN:"isolated-metrics-fixture-over-32-characters",WA_ENABLE_CRM_SWEEP:"0",
    },
  });
  const base = "http://127.0.0.1:15317";
  try {
    let health;
    for (let i = 0; i < 240; i++) {
      try { health = await fetch(`${base}/health`,{signal:AbortSignal.timeout(1500)}).then(res => res.json()); if (health.sharedInboxReady) break; } catch (_) {}
      if (child.exitCode !== null) throw new Error(`Server exited; inspect ${logPath}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.equal(health?.sharedInboxReady, true, `Schema not ready; inspect ${logPath}`);
    assert.equal((await fetch(`${base}/api/ops/metrics`)).status,404);
    const metrics=await fetch(`${base}/api/ops/metrics`,{headers:{Authorization:"Bearer isolated-metrics-fixture-over-32-characters"}});
    const observed=await metrics.json();assert.equal(metrics.status,200);assert(observed.rssMb>0);assert.equal(observed.admission.webhooks.limit,16);
    for(let i=0;i<40;i++)assert.equal((await fetch(`${base}/api/auth/refresh`,{method:"POST",headers:{Origin:base}})).status,401,"shared-office refresh traffic must not consume the old 35-login IP quota");
    await connection.query(`USE \`${database}\``);
    await require("./helpers/signupLifecycle").run({base,connection});
    const [[admin]] = await connection.query("SELECT id,email FROM users WHERE role='admin' ORDER BY id LIMIT 1");
    assert(admin);
    await connection.query("UPDATE tenants SET max_seats=100 WHERE id=1");
    await connection.query("INSERT IGNORE INTO organization_memberships (tenant_id,user_id,role,membership_status) VALUES (1,?,'organization_owner','active')", [admin.id]);
    const [[branch]] = await connection.query("SELECT id FROM branches WHERE tenant_id=1 ORDER BY id LIMIT 1");
    assert(branch);
    const token = jwt.sign({ id: admin.id, role: "admin", tenant_id: 1 }, secret);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    assert.equal((await fetch(`${base}/api/wa/campaigns/upload-media`, {method:"POST",headers,body:"{}"})).status,409);
    assert.equal((await fetch(`${base}/api/whatsapp/upload-media`, {method:"POST",headers,body:"{}"})).status,409);
    assert.equal((await fetch(`${base}/uploads/wa-media/fixture.jpg`)).status,404);
    const senderPayload = {phoneNumberId:"fixture-provider-number",accessToken:"fixture-access-token",wabaId:"fixture-waba",displayPhone:"919123456789",isShared:1};
    for (let i=0;i<2;i++) {
      const registered = await fetch(`${base}/api/v2/meta/senders/manual`, {method:"POST",headers,body:JSON.stringify(senderPayload)});
      assert.equal(registered.status,201,await registered.text());
    }
    const [[sender]] = await connection.query("SELECT id FROM wa_senders WHERE phone_number_id='fixture-provider-number'");
    const [[connectionRecord]] = await connection.query("SELECT encrypted_token FROM waba_connections WHERE waba_id='fixture-waba'");
    assert.notEqual(connectionRecord.encrypted_token,"fixture-access-token");
    const [[assignedNumber]] = await connection.query("SELECT COUNT(*) AS count FROM sender_branch_assignments WHERE sender_id=?",[sender.id]);assert.equal(assignedNumber.count,1);
    const employeeResponse = await fetch(`${base}/api/auth/employees`, { method: "POST", headers, body: JSON.stringify({ first_name: "Agent", email: "agent@fixture.test", role: "employee", branch_id: branch.id, whatsapp_access_level: "chat_only" }) });
    const employee = await employeeResponse.json();
    assert.equal(employeeResponse.status, 201, JSON.stringify(employee));
    const update = await fetch(`${base}/api/auth/employees/${employee.employee.id}`, { method: "PUT", headers, body: JSON.stringify({ status: "active" }) });
    assert.equal(update.status, 200);
    const body = JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "fixture-provider-number" }, contacts: [{ profile: { name: "Customer" } }], messages: [{ id: "wamid.boot", from: "919999999999", timestamp: String(Math.floor(Date.now()/1000)), type: "text", text: { body: "Do not persist this body" } }] } }] }] });
    const signature = "sha256=" + crypto.createHmac("sha256", "fixture-app-secret").update(body).digest("hex");
    const deliver = () => fetch(`${base}/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": signature }, body });
    const received = await deliver(); assert.equal(received.status, 200, await received.text());
    await connection.query("UPDATE conversations SET status='closed' WHERE tenant_id=1");
    assert.equal((await deliver()).status, 200);
    const [[unchanged]]=await connection.query("SELECT status FROM conversations WHERE tenant_id=1 LIMIT 1");assert.equal(unchanged.status,"closed","duplicate delivery must not reopen a closed chat");
    await connection.query("UPDATE conversations SET status='open' WHERE tenant_id=1");
    const [[rawEvents]]=await connection.query("SELECT COUNT(*) AS count FROM wa_webhook_events");assert.equal(rawEvents.count,0,"device-history mode must not duplicate webhook event rows");
    const employeeToken = jwt.sign({ id: employee.employee.id, role: "employee", tenant_id: 1 }, secret);
    const inboxResponse = await fetch(`${base}/api/v2/inbox/conversations`, { headers: { Authorization: `Bearer ${employeeToken}` } });
    const inbox = await inboxResponse.json(); assert.equal(inboxResponse.status, 200, JSON.stringify(inbox)); assert.equal(inbox.conversations.length, 1);
    const [[state]] = await connection.query("SELECT COUNT(*) AS count, MAX(message_text) AS body FROM wa_message_logs WHERE wa_message_id='wamid.boot'");
    assert.equal(state.count, 1); assert.equal(state.body, null);
    const [[contact]] = await connection.query("SELECT COUNT(*) AS count FROM wa_contacts WHERE phone='919999999999'"); assert.equal(contact.count, 1);
    const password=await require("bcryptjs").hash("fixture-browser-password",10);
    await connection.query("UPDATE users SET user_password=? WHERE id=?",[password,employee.employee.id]);
    if(process.env.INBOX_TEST_REAL_BROWSER==="1")await require("./helpers/realFrontend").verify({query:(...args)=>connection.query(...args),deliverLive:async()=>{
      const liveBody=body.replace("wamid.boot","wamid.browser.live").replace("Do not persist this body","Live signed webhook reaches actual browser");
      const signed="sha256="+crypto.createHmac("sha256","fixture-app-secret").update(liveBody).digest("hex");
      const response=await fetch(`${base}/webhook`,{method:"POST",headers:{"Content-Type":"application/json","x-hub-signature-256":signed},body:liveBody});
      assert.equal(response.status,200);
    }});
    const browserLogin=await fetch(`${base}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json","X-Browser-Session":"1",Origin:base},body:JSON.stringify({email:"agent@fixture.test",password:"fixture-browser-password"})});
    const browserBody=await browserLogin.json();assert.equal(browserLogin.status,200,JSON.stringify(browserBody));assert.equal(browserBody.token,undefined);assert.equal(browserBody.cookieSession,true);
    const browserCookies=browserLogin.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
    assert.equal((await fetch(`${base}/api/v2/inbox/conversations`,{headers:{Cookie:browserCookies}})).status,200);
    const {io}=require("socket.io-client");
    const browserSocket=io(base,{transports:["websocket"],reconnection:false,extraHeaders:{Cookie:browserCookies,Origin:base}});
    await new Promise((resolve,reject)=>{browserSocket.once("connect",resolve);browserSocket.once("connect_error",reject);});
    const deniedRelay=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Legacy socket relay was not rejected")),5000);browserSocket.once("socket_error",error=>{clearTimeout(timer);resolve(error);});});
    browserSocket.emit("send_message",{senderId:admin.id,receiverId:employee.employee.id,text:"Do not accept a forged sender"});
    assert.equal((await deniedRelay).code,"REST_REQUIRED");
    const disconnected=new Promise(resolve=>browserSocket.once("disconnect",resolve));
    assert.equal((await fetch(`${base}/api/auth/logout`,{method:"POST",headers:{Cookie:browserCookies,Origin:base}})).status,200);
    await disconnected;browserSocket.close();
    assert.equal((await fetch(`${base}/api/v2/inbox/conversations`,{headers:{Cookie:browserCookies}})).status,401);
    const socketCheck = await require("node:util").promisify(require("node:child_process").execFile)(process.execPath, [path.resolve(__dirname,"../scripts/check-socket-auth.js")], {env:{...process.env,JWT_SECRET:secret,VERIFY_API_URL:base},timeout:20000});
    assert(socketCheck.stdout.includes("PASS") || socketCheck.stdout.includes("passed"), socketCheck.stdout);
    const newWorkspace=await fetch(`${base}/api/v2/organizations`,{method:"POST",headers,body:JSON.stringify({name:"Second isolated workspace",plan:"starter"})});
    const workspace=await newWorkspace.json();assert.equal(newWorkspace.status,201,JSON.stringify(workspace));
    const secondId=workspace.organization.id;
    const secondHeaders={...headers,"x-tenant-id":String(secondId)};
    const switched=await fetch(`${base}/api/v2/me`,{headers:secondHeaders});
    const context=await switched.json();assert.equal(switched.status,200,JSON.stringify(context));assert.equal(context.activeOrganization.id,secondId);
    assert(context.branches.every(row=>row.tenant_id===secondId));
    const empty=await fetch(`${base}/api/v2/inbox/conversations`,{headers:secondHeaders}).then(response=>response.json());assert.equal(empty.conversations.length,0);
    const primaryAnalytics=await fetch(`${base}/api/wa/analytics/dashboard`,{headers});
    const primaryStats=await primaryAnalytics.json();assert.equal(primaryAnalytics.status,200,JSON.stringify(primaryStats));assert(primaryStats.totalContacts>=1);
    const foreignAnalytics=await fetch(`${base}/api/wa/analytics/dashboard`,{headers:secondHeaders});
    const foreignStats=await foreignAnalytics.json();assert.equal(foreignAnalytics.status,200,JSON.stringify(foreignStats));assert.equal(foreignStats.totalContacts,0);assert.equal(foreignStats.totalAccounts,0);assert.equal(foreignStats.totalFlows,0);
    for(const path of ["campaigns","automations","flows","daily","status-distribution","webhook-events"]){const response=await fetch(`${base}/api/wa/analytics/${path}`,{headers:secondHeaders});assert.equal(response.status,200,`${path}: ${await response.clone().text()}`);assert.deepEqual(await response.json(),[]);}
    const logResponse=await fetch(`${base}/api/wa/analytics/logs?limit=1000000`,{headers:secondHeaders});const scopedLogs=await logResponse.json();assert.equal(logResponse.status,200);assert.equal(scopedLogs.total,0);assert.deepEqual(scopedLogs.logs,[]);
    assert.equal((await fetch(`${base}/api/wa/analytics/dashboard`,{headers:{Authorization:`Bearer ${employeeToken}`}})).status,403);
    assert.equal((await fetch(`${base}/api/v2/me`,{headers:{Authorization:`Bearer ${employeeToken}`,"x-tenant-id":String(secondId)}})).status,403);
    await require("./helpers/sharedFlows").verify({base,headers,secondHeaders,employeeToken,connection,sender,meta});
    if(process.env.INBOX_TEST_REAL_BROWSER==="1")await require("./helpers/flowBrowser").verify({email:admin.email,secondId});
    await connection.query("DELETE FROM staff_branch_memberships WHERE tenant_id=1 AND user_id=?",[employee.employee.id]);
    const noBranch=await fetch(`${base}/api/v2/me`,{headers:{Authorization:`Bearer ${employeeToken}`}}).then(response=>response.json());
    assert.deepEqual(noBranch.branches,[]);assert.deepEqual(noBranch.permittedBranchIds,[]);assert.equal(noBranch.activeBranch,null);
    const linkCheck=await require("node:util").promisify(require("node:child_process").execFile)(process.execPath,[path.resolve(__dirname,"../../frontend/scripts/verify-api-link.js")],{env:{...process.env,VERIFY_API_URL:base,VERIFY_SITE_URL:"http://127.0.0.1:15318",REACT_APP_SOCKET_URL:base,VERIFY_WITH_TOKEN:token},timeout:30000});
    assert(linkCheck.stdout.includes("All links good"),linkCheck.stdout);
    console.log("PASS: actual organization creation/switching, isolated inboxes, forbidden foreign tenant, no implicit employee branch, and frontend API/CORS/socket link checker.");
    console.log("PASS: fresh full MySQL schema, actual backend startup/readiness, transactional employee creation/activation, signed Meta webhook, duplicate webhook, assigned employee HTTP inbox and no persisted body.");
  } finally {
    child.kill();
    await new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once("exit",resolve); });
    fs.closeSync(log);
    await meta.close();
    await signupProvider.close();
    await connection.query(`DROP DATABASE \`${database}\``); await connection.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
