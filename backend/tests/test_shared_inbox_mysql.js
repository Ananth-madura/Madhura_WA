"use strict";
const assert = require("node:assert/strict");
const mysql = require("mysql2");
const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createInboxService } = require("../services/sharedInboxService");
const { redactChatWrite } = require("../services/waChatPrivacy");
process.env.SMTP_ENCRYPTION_KEY="a".repeat(32);

async function main() {
  if (!process.env.INBOX_TEST_MYSQL_PORT) {
    console.log("SKIP: set INBOX_TEST_MYSQL_PORT to an isolated MySQL instance (never a production database)");
    return;
  }
  const database = `inbox_test_${process.pid}_${Date.now()}`;
  const pool = mysql.createPool({ host: "127.0.0.1", port: Number(process.env.INBOX_TEST_MYSQL_PORT), user: process.env.INBOX_TEST_MYSQL_USER || "root", password: process.env.INBOX_TEST_MYSQL_PASSWORD || "", connectionLimit: 12 });
  const raw = pool.promise();
  await raw.query(`CREATE DATABASE \`${database}\``);
  await new Promise((resolve, reject) => pool.end(error => error ? reject(error) : resolve()));
  const scopedPool = mysql.createPool({ host: "127.0.0.1", port: Number(process.env.INBOX_TEST_MYSQL_PORT), user: process.env.INBOX_TEST_MYSQL_USER || "root", password: process.env.INBOX_TEST_MYSQL_PASSWORD || "", database, connectionLimit: 12 });
  const sql = scopedPool.promise();
  const db = { isSqlite: false, getConnection: cb => scopedPool.getConnection(cb),
    query: (...args) => scopedPool.query(...args),
    promise: () => ({ query: (statement, values = []) => { const safe = redactChatWrite(statement, values); return sql.query(safe.sql, safe.params); } }) };
  try {
    const tables = [
      "CREATE TABLE users (id INT PRIMARY KEY, tenant_id INT, first_name VARCHAR(50), email VARCHAR(80), status VARCHAR(20), whatsapp_access_level VARCHAR(20) DEFAULT 'full')",
      "CREATE TABLE tenants (id INT PRIMARY KEY, name VARCHAR(40), slug VARCHAR(40), plan VARCHAR(40), plan_status VARCHAR(40), max_branches INT, max_seats INT, max_senders INT, max_monthly_messages INT, status VARCHAR(20))",
      "CREATE TABLE organization_memberships (tenant_id INT, user_id INT, role VARCHAR(40), membership_status VARCHAR(20), UNIQUE(tenant_id,user_id))",
      "CREATE TABLE branches (id INT PRIMARY KEY, tenant_id INT, name VARCHAR(40), status VARCHAR(20))",
      "CREATE TABLE staff_branch_memberships (id INT AUTO_INCREMENT PRIMARY KEY, tenant_id INT, user_id INT, branch_id INT, is_primary INT DEFAULT 1, UNIQUE(tenant_id,user_id,branch_id))",
      "CREATE TABLE wa_senders (id INT PRIMARY KEY, tenant_id INT, status VARCHAR(20), display_phone VARCHAR(40))",
      "CREATE TABLE sender_branch_assignments (tenant_id INT, sender_id INT, branch_id INT, UNIQUE(tenant_id,sender_id,branch_id))",
      "CREATE TABLE wa_contacts (id INT AUTO_INCREMENT PRIMARY KEY, tenant_id INT, phone VARCHAR(20), name VARCHAR(80), email VARCHAR(255), source VARCHAR(60), is_unsubscribed INT DEFAULT 0, is_blocked INT DEFAULT 0, UNIQUE(tenant_id,phone))",
      "CREATE TABLE conversations (id INT AUTO_INCREMENT PRIMARY KEY, tenant_id INT, sender_id INT, contact_id INT, branch_id INT, owner_user_id INT, status VARCHAR(20), last_message_at TIMESTAMP NULL, service_window_expires_at TIMESTAMP NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant_id,sender_id,contact_id))",
      "CREATE TABLE wa_internal_notes (id INT AUTO_INCREMENT PRIMARY KEY, phone VARCHAR(20), author_id INT, author_name VARCHAR(50), note_text TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      "CREATE TABLE wa_message_logs (id INT AUTO_INCREMENT PRIMARY KEY, tenant_id INT, phone VARCHAR(20), direction VARCHAR(20), message_type VARCHAR(20), message_text TEXT, wa_message_id VARCHAR(255), media_id VARCHAR(255), status VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      "CREATE TABLE wa_webhook_claims (claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      "CREATE TABLE wa_webhook_events (created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      "CREATE TABLE wa_flow_runs (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT, status VARCHAR(30), ended_at TIMESTAMP NULL)",
    ];
    for (const statement of tables) await sql.query(statement);
    await require("../migrations/shared_number_inbox").migrate(db);
    await require("../migrations/shared_number_inbox").migrate(db);
    await sql.query("INSERT INTO tenants (id,name,status) VALUES (1,'One','active'),(2,'Two','active')");
    await sql.query("INSERT INTO users (id,tenant_id,first_name,email,status) VALUES (1,1,'E1','e1','active'),(2,1,'E2','e2','active'),(3,1,'E3','e3','active'),(4,1,'E4','e4','active'),(9,1,'Admin','admin','active'),(10,2,'Other','other','active')");
    await sql.query("INSERT INTO organization_memberships VALUES (1,1,'agent','active'),(1,2,'agent','active'),(1,3,'agent','active'),(1,4,'agent','active'),(1,9,'organization_owner','active'),(2,10,'organization_owner','active')");
    await sql.query("INSERT INTO branches VALUES (1,1,'B1','active'),(2,1,'B2','active'),(3,2,'Other','active')");
    await sql.query("INSERT INTO wa_senders VALUES (1,1,'connected','111'),(2,1,'connected','222'),(3,2,'connected','333')");
    await sql.query("INSERT INTO sender_branch_assignments VALUES (1,1,1),(1,1,2),(1,2,1),(2,3,3)");
    await sql.query("INSERT INTO staff_branch_memberships (tenant_id,user_id,branch_id) VALUES (1,1,1),(1,2,1),(1,3,2),(1,4,2)");
    const service = createInboxService(db);
    const incoming = phone => service.inbound({ tenantId: 1, senderId: 1, phone, timestamp: new Date() });
    const created = await Promise.all(Array.from({ length: 8 }, (_, i) => incoming(`91900000000${i}`)));
    const counts = {};
    created.forEach(row => { counts[row.owner_user_id] = (counts[row.owner_user_id] || 0) + 1; });
    assert.deepEqual(counts, { 1: 2, 2: 2, 3: 2, 4: 2 });
    const duplicates = await Promise.all(Array.from({ length: 8 }, () => incoming("919000000000")));
    assert(duplicates.every(row => row.id === created[0].id && row.owner_user_id === created[0].owner_user_id));
    if(process.env.INBOX_TEST_BENCHMARK==="1")await require("./helpers/inboxBenchmark").run(db,created);
    const otherSender = await service.inbound({ tenantId: 1, senderId: 2, phone: "919000000000", timestamp: new Date() });
    assert.notEqual(otherSender.id, created[0].id);
    assert.equal(otherSender.branch_id,[1,2].includes(Number(created[0].owner_user_id))?1:null,"A second number inherits the established owner only when that employee can access it");
    const independentlyRouted=[];
    for(let i=0;i<8;i++) {
      independentlyRouted.push(await incoming(`91888888888${i}`));
      await service.inbound({tenantId:1,senderId:2,phone:`91777777777${i}`,timestamp:new Date()});
    }
    const perNumber={};independentlyRouted.forEach(row=>{perNumber[row.owner_user_id]=(perNumber[row.owner_user_id]||0)+1;});assert.deepEqual(perNumber,{1:2,2:2,3:2,4:2});
    const employee = { tenantId: 1, user: { id: 1 }, userRole: "agent" };
    const admin = { tenantId: 1, user: { id: 9 }, userRole: "organization_owner" };
    const owned = created.find(row => row.owner_user_id === 1);
    const hidden = created.find(row => row.owner_user_id === 2);
    await service.conversation(employee, owned.id);
    await assert.rejects(service.conversation(employee, hidden.id), { status: 404 });
    await sql.query("UPDATE conversations SET automation_mode='flow' WHERE id=?",[owned.id]);
    await assert.rejects(service.reassign(employee, owned.id, { userId: 2 }), { status: 403 });
    await assert.rejects(service.reassign(admin, owned.id, { userId: 10,branchId:1 }), { status: 400 });
    assert.equal((await service.conversation(employee,owned.id)).automation_mode,"flow","Denied and failed assignments must not pause the current bot");
    await service.reassign(admin, owned.id, { userId: 3, branchId: 2 });
    await assert.rejects(service.conversation(employee, owned.id), { status: 404 });
    const recipients = await service.recipients({ ...owned, owner_user_id: 3, branch_id: 2 });
    assert.deepEqual(recipients.sort((a,b)=>a-b), [3,9]);
    await sql.query("UPDATE staff_branch_memberships SET is_available = 0 WHERE user_id IN (1,2,3,4)");
    const waiting = await incoming("919777777777"); assert.equal(waiting.owner_user_id, null);
    await sql.query("UPDATE staff_branch_memberships SET is_available = 1, max_open_chats = 100 WHERE user_id = 4");
    assert.equal(await service.retryUnassigned(admin), 1);
    await sql.query("UPDATE staff_branch_memberships SET max_open_chats = 1 WHERE user_id = 4");
    const full = await incoming("919777777778"); assert.equal(full.owner_user_id, null);

    process.env.JWT_SECRET = "isolated-shared-inbox-test-key";
    process.env.WA_SERVER_CHAT_STORAGE = "0";
    require.cache[require.resolve("../config/database")] = { id: require.resolve("../config/database"), filename: require.resolve("../config/database"), loaded: true, exports: db };
    let sends = 0, configured = true, unknown = false;
    const providerClient = require("../services/whatsappCloudApi").withAccount({phone_number_id:"fixture-provider-number",access_token:"fixture-token"});
    providerClient.isConfigured = () => configured;
    require("axios").post = async (url, body, options) => {
      assert(url.endsWith("/fixture-provider-number/messages"));assert.equal(body.type,"text");assert.equal(options.headers.Authorization,"Bearer fixture-token");
      sends++;if(unknown)throw Object.assign(new Error("timeout"),{deliveryUnknown:true});
      return {data:{messages:[{id:`wamid.${sends}`}]}};
    };
    require.cache[require.resolve("../services/waConfigHelper")] = { loaded: true, exports: { cloudClientForTenantSender: async () => providerClient } };
    require.cache[require.resolve("../services/waBotGate")] = { loaded: true, exports: { pauseBot: async () => {} } };
    const app = express(); app.use(express.json());
    app.use("/api", require("../middleware/sharedWorkspaceGuard"));
    app.use("/api/v2/inbox", require("../routes/enterpriseInboxRoutes"));
    app.use("/api/storage", require("../routes/r2Routes"));
    app.post("/api/wa/campaigns/upload-media", require("../middleware/r2CampaignUpload"), (req,res)=>res.status(500).json({error:"Unexpected disk fallback"}));
    const token = (id, tenant = 1) => jwt.sign({ id, tenant_id: tenant, role: id === 9 || id === 10 ? "admin" : "employee" }, process.env.JWT_SECRET);
    const api = (method, path, id = 1, tenant = 1) => request(app)[method](`/api${path}`).set("Authorization", `Bearer ${token(id,tenant)}`);
    const s3 = await require("./helpers/localS3").start();
    const r2 = require("../services/r2StorageService");
    Object.assign(r2, {client:s3.client,bucket:"fixture-private",publicBucket:"fixture-public",publicDomain:"https://assets.fixture.test",disabled:false,authFailed:false});
    try {
      assert.equal((await api("post","/storage/verify",9)).status,200);
      assert.equal(s3.objects.size,0,"probe object was deleted");
      const asset=await api("post","/storage/upload",9).attach("file",Buffer.from("private asset"),"fixture.pdf");
      assert.equal(asset.status,201,JSON.stringify(asset.body));assert.match(asset.body.key,/^tenants\/1\/assets\//);
      assert(!asset.body.url.startsWith("https://assets."));
      const downloaded=await api("get",asset.body.url.replace("/api",""),9);
      assert.equal(downloaded.status,200);assert.equal(downloaded.headers["cache-control"],"private, no-store");
      assert.equal(Buffer.from(downloaded.body).toString(),"private asset");
      assert.equal((await api("get",asset.body.url.replace("/api",""),10,2)).status,403);
      assert.equal((await api("get",asset.body.url.replace("/api","").replace("tenant_id=1","tenant_id=2"),10,2)).status,404);
      assert.equal((await api("get",asset.body.url.replace("/api",""),1)).status,403);
      assert.equal((await api("get","/storage/r2/database.sqlite",9)).status,404);
      assert.equal((await api("post","/storage/sync",9)).status,403);
      const publicAsset=await require("../services/workspaceAssets").upload({tenantId:1,file:{buffer:Buffer.from("business image"),originalname:"offer.jpg",mimetype:"image/jpeg",size:14}},{published:true});
      assert(publicAsset.url.startsWith("https://assets.fixture.test/tenants/1/public-assets/"));
      assert(s3.objects.has(`/fixture-public/${publicAsset.key}`));
      assert(s3.objects.has(`/fixture-private/${asset.body.key}`));
      const campaignAsset=await api("post","/wa/campaigns/upload-media",9).attach("file",Buffer.from("image bytes"),"offer.jpg");
      assert.equal(campaignAsset.status,201,JSON.stringify(campaignAsset.body));assert.equal(campaignAsset.body.published,true);
      assert(campaignAsset.body.url.startsWith("https://assets.fixture.test/tenants/1/public-assets/"));
      r2.publicBucket=null;
      assert.equal((await api("post","/wa/campaigns/upload-media",9).attach("file",Buffer.from("image"),"private-only.jpg")).status,409);
      r2.publicBucket="fixture-public";
      s3.denied=true;
      const failed=await api("post","/storage/upload",9).attach("file",Buffer.from("do not save locally"),"fail.pdf");
      assert.equal(failed.status,502);assert.equal(failed.body.storage,undefined);
      s3.denied=false;r2.authFailed=false;r2.authError=null;
      assert.equal((await api("delete",asset.body.url.replace("/api",""),9)).status,200);
      assert.equal((await api("get",asset.body.url.replace("/api",""),9)).status,404);
      assert(s3.requests.every(row=>row.signed));
      console.log("PASS: real AWS SDK signed PUT/GET/DELETE against local S3 transport; tenant-private assets, separate public bucket, cross-tenant/employee rejection, no disk fallback.");
    } finally { await s3.close();r2.client=null; }
    const ownRow = created.find(row => row.owner_user_id === 1 && row.id !== owned.id);
    const list = await api("get", "/v2/inbox/conversations"); assert.equal(list.status, 200); assert(list.body.conversations.every(row => row.owner_user_id === 1));
    const page=await api("get","/v2/inbox/conversations?sort=activity&limit=1");assert.equal(page.status,200);assert(page.body.nextCursor.startsWith("v1."));
    const next=await api("get",`/v2/inbox/conversations?sort=activity&limit=1&before=${encodeURIComponent(page.body.nextCursor)}`);assert.equal(next.status,200);assert.notEqual(next.body.conversations[0].id,page.body.conversations[0].id);
    assert.equal((await api("get","/v2/inbox/conversations?sort=activity&before=broken")).status,400);
    assert.equal((await api("get", `/v2/inbox/conversations/${hidden.id}/messages`)).status, 404);
    assert.equal((await api("get", `/v2/inbox/conversations/${hidden.id}`)).status,404);
    const summary=await api("get",`/v2/inbox/conversations/${ownRow.id}`);assert.equal(summary.status,200);assert.equal(summary.body.conversation.last_message_text,undefined);
    assert.equal((await api("get", `/v2/inbox/conversations/${hidden.id}/notes`)).status, 404);
    assert.equal((await api("get", `/v2/inbox/conversations/${ownRow.id}/messages`,10,2)).status, 404);
    assert.equal((await api("get", "/whatsapp/chats")).status, 403);
    assert.equal((await api("post", `/v2/inbox/conversations/${hidden.id}/reply`).send({ text: "private", requestId: "hidden-123" })).status, 404);
    assert.equal((await api("post", `/v2/inbox/conversations/${ownRow.id}/notes`).send({ text: "Shared CRM note" })).status, 201);
    assert.equal((await api("get", `/v2/inbox/conversations/${ownRow.id}/notes`)).body.notes[0].note_text, "Shared CRM note");
    assert.equal((await api("patch", `/v2/inbox/conversations/${ownRow.id}/contact`).send({name:"Edited customer",email:"customer@fixture.test"})).status,200);
    assert.equal((await api("get", `/v2/inbox/conversations/${ownRow.id}/contact`)).body.contact.email,"customer@fixture.test");
    assert.equal((await api("post", `/v2/inbox/conversations/${ownRow.id}/read`)).status,200);
    const payload = { text: "Transient body", requestId: "send-request-1234" };
    assert.equal((await api("post", `/v2/inbox/conversations/${ownRow.id}/reply`).send(payload)).status, 200);
    assert.equal((await api("post", `/v2/inbox/conversations/${ownRow.id}/reply`).send(payload)).status, 200);
    assert.equal(sends, 1);
    const assistant=require("../services/sharedInboxAssistant");
    let aiCalls=0,failAI=false,gate=null;
    require("axios").post=async(url,body,options)=>{
      if(url==="https://api.openai.com/v1/chat/completions"){
        aiCalls++;assert.equal(options.headers.Authorization,"Bearer fixture-ai-key");assert(!JSON.stringify(body).includes("Shared CRM note"));
        if(gate){gate.enter();await gate.wait;}
        if(failAI)throw new Error("fixture provider failure");
        return {data:{choices:[{message:{content:"Scoped assistant reply"}}]}};
      }
      assert(url.endsWith("/fixture-provider-number/messages"));sends++;
      if(unknown)throw Object.assign(new Error("timeout"),{deliveryUnknown:true});
      return {data:{messages:[{id:`wamid.${sends}`}]}};
    };
    const aiSettings=await api("put","/v2/inbox/assistant/settings",9).send({enabled:true,autoStart:false,provider:"openai",model:"fixture-model",systemPrompt:"Business service information",apiKey:"fixture-ai-key"});
    assert.equal(aiSettings.status,200);assert.equal(aiSettings.body.settings.api_key,undefined);assert.equal(aiSettings.body.settings.hasApiKey,true);
    assert.equal((await api("get","/v2/inbox/assistant/settings")).status,403);
    assert.equal((await api("post",`/v2/inbox/conversations/${hidden.id}/ai-draft`).send({text:"hidden"})).status,404);
    const draft=await api("post",`/v2/inbox/conversations/${ownRow.id}/ai-draft`).send({text:"Current customer question"});assert.equal(draft.body.text,"Scoped assistant reply");assert.equal(sends,1);
    await assistant.resume(1,ownRow.id);assistant.enqueue(1,ownRow.id,"auto-1","Current customer question");await assistant.idle();assert.equal(sends,2);
    assistant.enqueue(1,ownRow.id,"auto-1","Repeated event");await assistant.idle();assert.equal(sends,2);
    let release,entered;const providerEntered=new Promise(resolve=>{entered=resolve;});
    gate={enter:entered,wait:new Promise(resolve=>{release=resolve;})};
    assistant.enqueue(1,ownRow.id,"auto-2","Slow provider question");await Promise.race([providerEntered,new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("AI generation did not start")),5000);timer.unref();})]);
    const handoff=assistant.pause(1,ownRow.id);
    for(let i=0;i<30;i++){const [[row]]=await sql.query("SELECT automation_mode FROM conversations WHERE id=?",[ownRow.id]);if(row.automation_mode==="human")break;await new Promise(resolve=>setTimeout(resolve,5));}
    release();await handoff;await assistant.idle();gate=null;assert.equal(sends,2);
    const beforeHandoff=aiCalls;await assistant.resume(1,ownRow.id);assistant.enqueue(1,ownRow.id,"auto-3","I want a human agent");await assistant.idle();assert.equal(aiCalls,beforeHandoff);
    failAI=true;await assistant.resume(1,ownRow.id);assistant.enqueue(1,ownRow.id,"auto-4","Provider failure");await assistant.idle();failAI=false;
    const [[paused]]=await sql.query("SELECT automation_mode,automation_error FROM conversations WHERE id=?",[ownRow.id]);assert.equal(paused.automation_mode,"human");assert.equal(paused.automation_error,"assistant_failed");
    await assert.rejects(assistant.generate(2,ownRow.id,"Other business"),{status:404});
    const [logs] = await sql.query("SELECT message_text FROM wa_message_logs"); assert.equal(logs[0].message_text, null);
    configured = false;
    assert.equal((await api("post", `/v2/inbox/conversations/${ownRow.id}/reply`).send({ text: "No mock send", requestId: "send-request-5678" })).status, 503);
    assert.equal(sends, 2);
    configured = true; unknown = true;
    const uncertain = {text:"Unknown delivery",requestId:"uncertain-send-1234"};
    assert.equal((await api("post", `/v2/inbox/conversations/${ownRow.id}/reply`).send(uncertain)).status,504);
    assert.equal((await api("post", `/v2/inbox/conversations/${ownRow.id}/reply`).send(uncertain)).status,409);
    assert.equal(sends,3);
    await sql.query("UPDATE users SET whatsapp_access_level='read_only' WHERE id=1");
    assert.equal((await api("post", `/v2/inbox/conversations/${ownRow.id}/notes`).send({text:"denied"})).status,403);
    await sql.query("UPDATE users SET status='banned' WHERE id=1");
    assert.equal((await api("get", "/v2/inbox/conversations")).status,403);
    assert.equal((await api("patch", "/v2/inbox/routing/employees/2",9).send({branchId:1,available:true,enabled:true,maxOpenChats:100,allowedSenderIds:[2]})).status,200);
    await sql.query("UPDATE staff_branch_memberships SET is_available=1,max_open_chats=100 WHERE user_id=3");
    const scopedNumber = await incoming("919666666666");assert.equal(scopedNumber.owner_user_id,3);
    assert.equal((await api("get", `/v2/inbox/conversations/${hidden.id}/messages`,2)).status,404);
    const permittedNumber = await service.inbound({tenantId:1,senderId:2,phone:"919666666666",timestamp:new Date()});assert.equal(permittedNumber.owner_user_id,null,"A second number must not split customer ownership when the existing owner cannot access that number");
    await sql.query("INSERT INTO wa_webhook_claims VALUES ('2001-01-01')");
    await sql.query("INSERT INTO wa_webhook_events VALUES ('2001-01-01')");
    await sql.query("INSERT INTO wa_message_logs (tenant_id,phone,status,created_at) VALUES (1,'old','delivered','2001-01-01')");
    await require("../services/waStorageRetention").cleanup();
    const [[retained]] = await sql.query("SELECT COUNT(*) AS count FROM wa_message_logs WHERE phone='old'");assert.equal(retained.count,0);
    const [[noteCount]] = await sql.query("SELECT COUNT(*) AS count FROM wa_internal_notes");assert.equal(noteCount.count,1);
    console.log("PASS: MySQL concurrent routing and number permissions; scoped CRM; AI drafts and opt-in replies; duplicate-send protection; handoff during generation; provider failure => human; no persisted chat bodies; retention preserves notes.");
  } finally {
    await sql.query(`DROP DATABASE \`${database}\``);
    await new Promise((resolve, reject) => scopedPool.end(error => error ? reject(error) : resolve()));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
