"use strict";
const assert=require("node:assert/strict"),mysql=require("mysql2"),express=require("express"),request=require("supertest");
async function main(){
  const port=Number(process.env.INBOX_TEST_MYSQL_PORT);
  if(!port){console.log("SKIP: automation integration requires an isolated INBOX_TEST_MYSQL_PORT");return;}
  assert(port>1024&&port!==3306,"Production/default MySQL port is refused");
  const database=`automation_test_${process.pid}_${Date.now()}`;
  const root=mysql.createPool({host:"127.0.0.1",port,user:"root",password:""});
  await root.promise().query(`CREATE DATABASE \`${database}\``);
  const pool=mysql.createPool({host:"127.0.0.1",port,user:"root",password:"",database,connectionLimit:8});
  const db={isSqlite:false,promise:()=>pool.promise(),query:(...args)=>pool.query(...args)};
  const stub=(name,exports)=>{const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports};};
  stub("../config/database",db);
  stub("../middleware/authMiddleware",{verifyToken:(req,res,next)=>{req.user={id:1};next();}});
  stub("../middleware/tenantMiddleware",{requireTenantContext:(req,res,next)=>{req.tenantId=Number(req.headers["x-test-tenant"]||1);req.userRole="organization_owner";next();}});
  stub("../server",{get:()=>null});
  stub("../sockets/chatsockets",{getIO:()=>null});
  stub("../services/sharedInboxService",{createInboxService:()=>({emit:async()=>{}})});
  const sends=[];let mode="success";
  const deliver=async(type,to,text)=>{sends.push({type,to,text});if(mode==="timeout")throw Object.assign(new Error("timeout"),{code:"ETIMEDOUT"});return {messages:[{id:`wamid.integration.${sends.length}`}]};};
  stub("../services/waConfigHelper",{cloudClientForTenantSender:async(tenant,sender)=>{assert.equal(tenant,1);assert.equal(Number(sender),1);return {wabaId:"waba-one",sendText:(to,text)=>deliver("text",to,text),sendTemplate:(to,name)=>deliver("template",to,name),sendInteractiveButtons:(to,text)=>deliver("buttons",to,text),sendMedia:(to,type,url)=>deliver(type,to,url)};}});
  try{
    const q=(sql,params=[])=>pool.promise().query(sql,params);
    for(const sql of [
      "CREATE TABLE tenants(id INT PRIMARY KEY)",
      "CREATE TABLE users(id INT PRIMARY KEY,tenant_id INT)",
      "CREATE TABLE wa_automations(id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,name VARCHAR(255),trigger_type VARCHAR(100),template_id INT,message_text TEXT,media_type VARCHAR(20),media_url TEXT,sequence_delay_seconds INT DEFAULT 7,followup_message_text TEXT,followup_media_type VARCHAR(20),followup_media_url TEXT,followup_template_id INT,flow_id INT,group_id INT,delay_minutes INT DEFAULT 0,conditions JSON,is_active INT DEFAULT 0,run_count INT DEFAULT 0,created_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      "CREATE TABLE wa_automation_options(id INT AUTO_INCREMENT PRIMARY KEY,automation_id INT NOT NULL,label VARCHAR(255),reply_text TEXT,sort_order INT,FOREIGN KEY(automation_id) REFERENCES wa_automations(id) ON DELETE CASCADE)",
      "CREATE TABLE wa_automation_logs(id INT AUTO_INCREMENT PRIMARY KEY,automation_id INT NOT NULL,phone VARCHAR(20),contact_name VARCHAR(255),trigger_data JSON,status VARCHAR(20),error TEXT,sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,scheduled_for DATETIME,execution_step INT DEFAULT 1,session_key VARCHAR(100),target_chat_id VARCHAR(150),claimed_at DATETIME,wa_message_id VARCHAR(255),FOREIGN KEY(automation_id) REFERENCES wa_automations(id) ON DELETE CASCADE)",
      "CREATE TABLE wa_welcome_settings(id INT PRIMARY KEY,enabled INT,welcome_type VARCHAR(20),welcome_text TEXT,welcome_buttons TEXT,welcome_footer VARCHAR(60),template_id INT,cooldown_hours INT,working_hours_only INT,start_time VARCHAR(10),end_time VARCHAR(10))",
      "CREATE TABLE wa_templates(id INT PRIMARY KEY,tenant_id INT,name VARCHAR(100),category VARCHAR(100),body TEXT,meta_status VARCHAR(20),meta_template_id VARCHAR(100),waba_id VARCHAR(100),language VARCHAR(20),header_type VARCHAR(20),header_value TEXT)",
      "CREATE TABLE wa_flows(id INT PRIMARY KEY,tenant_id INT,name VARCHAR(100),status VARCHAR(30))",
      "CREATE TABLE wa_flow_versions(id INT PRIMARY KEY,flow_id INT,status VARCHAR(30))",
      "CREATE TABLE wa_contact_groups(id INT PRIMARY KEY,name VARCHAR(100),created_by INT)",
      "CREATE TABLE wa_group_contacts(id INT PRIMARY KEY,tenant_id INT,group_id INT)",
      "CREATE TABLE wa_senders(id INT PRIMARY KEY,tenant_id INT,display_phone VARCHAR(30),status VARCHAR(30))",
      "CREATE TABLE wa_contacts(id INT PRIMARY KEY,tenant_id INT,name VARCHAR(100),phone VARCHAR(20),is_blocked INT DEFAULT 0,is_unsubscribed INT DEFAULT 0,opt_in_status INT DEFAULT 1,last_message_text TEXT,last_message_at DATETIME,last_contacted DATETIME)",
      "CREATE TABLE wa_opt_outs(id INT PRIMARY KEY,tenant_id INT,phone VARCHAR(20))",
      "CREATE TABLE conversations(id INT PRIMARY KEY,tenant_id INT,sender_id INT,contact_id INT,status VARCHAR(20),automation_mode VARCHAR(20),automation_version INT DEFAULT 0,service_window_expires_at DATETIME,branch_id INT)",
      "CREATE TABLE wa_message_logs(id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,sender_id INT,conversation_id INT,session_key VARCHAR(100),phone VARCHAR(20),direction VARCHAR(20),message_type VARCHAR(20),message_text TEXT,wa_message_id VARCHAR(255),status VARCHAR(20),created_at DATETIME)",
    ])await q(sql);
    await q("INSERT INTO tenants VALUES(1),(2)");
    await q("INSERT INTO users VALUES(1,1),(2,2)");
    await q("INSERT INTO wa_senders VALUES(1,1,'+919111111111','connected'),(2,2,'+919222222222','connected')");
    await q("INSERT INTO wa_templates(id,tenant_id,name,body,meta_status,meta_template_id,waba_id,language) VALUES(1,1,'receipt','Receipt {name}','APPROVED','meta-one','waba-one','en'),(2,2,'other','private','APPROVED','meta-two','waba-two','en')");
    await q("INSERT INTO wa_flows VALUES(1,1,'own','active'),(2,2,'foreign','active')");await q("INSERT INTO wa_flow_versions VALUES(1,1,'published'),(2,2,'published')");
    await q("INSERT INTO wa_contact_groups VALUES(1,'own',1),(2,'foreign',2)");
    await q("INSERT INTO wa_contacts(id,tenant_id,name,phone) VALUES(1,1,'Priya','919123456789'),(2,2,'Other','919123456789')");
    await q("INSERT INTO conversations VALUES(1,1,1,1,'open','idle',0,DATE_ADD(NOW(),INTERVAL 1 DAY),NULL)");
    await require("../migrations/automation_workspace").migrate(db);await require("../migrations/automation_workspace").migrate(db);
    const [legacyGroups]=await q("SELECT tenant_id FROM wa_contact_groups ORDER BY id");assert.deepEqual(legacyGroups.map(group=>group.tenant_id),[1,2],"Legacy groups inherit verified creator ownership");
    const app=express();app.use(express.json());app.use("/api/wa/automations",require("../routes/waAutomationRoutes"));
    const api=(method,path,body,tenant=1)=>{let call=request(app)[method](`/api/wa/automations${path}`).set("x-test-tenant",String(tenant));return body===undefined?call:call.send(body);};
    const draft={name:"Invoice notice",trigger_type:"invoice_created",sender_id:1,message_text:"Hello {name}",delay_minutes:0,is_active:1,options:[{label:"Help",reply_text:"How can we help?"}]};
    let response=await api("post","/",draft);assert.equal(response.status,201,JSON.stringify(response.body));const id=response.body.id;
    assert.equal(response.body.tenant_id,1);assert.equal(response.body.revision,1);
    await q("CREATE TRIGGER reject_bad_option BEFORE INSERT ON wa_automation_options FOR EACH ROW BEGIN IF NEW.reply_text='force rollback' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Test rollback'; END IF; END");
    assert.equal((await api("post","/",{...draft,name:"Must roll back",options:[{label:"Fail",reply_text:"force rollback"}]})).status,503);
    const [[afterRollback]]=await q("SELECT COUNT(*) AS count FROM wa_automations");assert.equal(afterRollback.count,1,"A reply write failure rolls back its parent rule");
    await q("DROP TRIGGER reject_bad_option");
    assert.equal((await api("get",`/${id}`)).body.options.length,1);
    assert.equal((await api("get","/welcome-settings")).status,200,"Static settings route is reachable");
    for(const [method,path,body] of [["get",`/${id}`],["get",`/${id}/options`],["put",`/${id}/options`,{options:[]}],["post",`/${id}/toggle`,{}],["delete",`/${id}`],["get",`/${id}/audit`]])assert.equal((await api(method,path,body,2)).status,404,`${method} ${path}`);
    for(const patch of [{sender_id:2},{template_id:2},{flow_id:2},{group_id:2}])assert.equal((await api("post","/",{...draft,...patch})).status,400);
    const concurrent=await Promise.all([api("put",`/${id}`,{...draft,name:"Updated A",revision:1}),api("put",`/${id}`,{...draft,name:"Updated B",revision:1})]);assert.deepEqual(concurrent.map(row=>row.status).sort(),[200,409]);
    assert.equal((await api("get",`/${id}/audit`)).body.length,2);
    assert.equal((await api("get","/references",undefined,2)).body.senders[0].id,2);
    response=await api("post",`/${id}/trigger`,{phone:"919123456789",request_id:"manual-1"});assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(sends.length,2,"Main and reply menu accepted by Meta");
    const [[option]]=await q("SELECT id FROM wa_automation_options WHERE automation_id=?",[id]);
    assert.equal(await require("../services/automationInbound").handle(1,1,{id:1},"reply-one",`auto:${id}:${option.id}`,false),true);assert.equal(sends.length,3);assert.equal(sends.at(-1).text,"How can we help?");
    const [[contactCount]]=await q("SELECT COUNT(*) AS count FROM wa_contacts WHERE tenant_id=1");assert.equal(contactCount.count,1,"Cloud dispatch never creates a second local-format contact");
    const native=require("../services/automationCloudDelivery");
    await assert.rejects(native.send({tenant_id:1,sender_id:1},"919123456789","Again",{},{requestId:"manual-1"}),/already attempted/);
    await q("UPDATE conversations SET service_window_expires_at=DATE_SUB(NOW(),INTERVAL 1 DAY)");
    await assert.rejects(native.send({tenant_id:1,sender_id:1},"919123456789","No",{}),/service window/);
    await native.send({tenant_id:1,sender_id:1,template_id:1},"919123456789","Receipt",{name:"Priya"});
    await q("UPDATE conversations SET service_window_expires_at=DATE_ADD(NOW(),INTERVAL 1 DAY)");
    mode="timeout";await assert.rejects(native.send({tenant_id:1,sender_id:1},"919123456789","Uncertain",{},{requestId:"uncertain"}),/uncertain/);mode="success";
    const before=sends.length;await assert.rejects(native.send({tenant_id:1,sender_id:1},"919123456789","Retry",{},{requestId:"uncertain"}),/already attempted/);assert.equal(sends.length,before);
    const engine=require("../services/waAutomationService");
    const scheduled={...draft,name:"Scheduled",options:[],delay_minutes:1,trigger_type:"new_lead"};
    response=await api("post","/",scheduled);assert.equal(response.status,201);const scheduledId=response.body.id;
    assert.equal((await engine.triggerAutomation("new_lead",{tenantId:1,phone:"919123456789",eventId:"lead-101",data:{name:"Priya"}})).triggeredCount,1);
    await q("UPDATE wa_automation_logs SET scheduled_for=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE automation_id=?",[scheduledId]);
    await Promise.all([engine.runDueAutomationsSweep(),engine.runDueAutomationsSweep()]);assert.equal(sends.length,before+1,"Concurrent sweepers claim one delivery");
    await engine.triggerAutomation("new_lead",{tenantId:1,phone:"919123456789",eventId:"lead-102",data:{name:"Priya"}});
    const scheduledRuns=(await api("get","/logs/recent?status=scheduled")).body;assert.equal(scheduledRuns.length,1);
    assert.equal((await api("post",`/${scheduledId}/executions/${scheduledRuns[0].id}/cancel`,{},2)).status,404);
    assert.equal((await api("post",`/${scheduledId}/executions/${scheduledRuns[0].id}/cancel`,{})).status,200);
    assert.equal((await api("post",`/${scheduledId}/executions/${scheduledRuns[0].id}/cancel`,{})).status,409);
    assert.equal((await api("post","/stop-all",{})).status,200);assert.equal((await api("post","/resume-all",{})).status,200);
    assert.equal((await api("get","/logs/recent",undefined,2)).body.length,0);
    const welcome={enabled:true,welcome_type:"text",welcome_text:"Welcome {name}",cooldown_hours:24,start_time:"09:00",end_time:"18:00"};assert.equal((await api("put","/welcome-settings",welcome)).status,200);assert.equal((await api("get","/welcome-settings",undefined,2)).body.enabled,false);
    const welcomeBefore=sends.length;assert.equal(await require("../services/automationInbound").handle(1,1,{id:1},"welcome-one","Hello",false),true);assert.equal(sends.length,welcomeBefore+1);assert.equal(await require("../services/automationInbound").handle(1,1,{id:1},"welcome-two","Hello again",false),false);assert.equal(sends.length,welcomeBefore+1,"Welcome cooldown survives separate inbound events");
    await q("UPDATE conversations SET automation_mode='human',automation_version=1");assert.equal(await require("../services/automationInbound").handle(1,1,{id:1},"takeover","Hello",true),false);assert.equal(sends.length,welcomeBefore+1,"Employee takeover suppresses welcome automation");
    const seeded=await api("post","/seed",{});assert.equal(seeded.status,200);assert.equal((await api("post","/seed",{})).body.count,0);
    assert.equal((await api("get","/",undefined,2)).body.length,0);
    assert.equal((await api("post","/simulate-trigger",{trigger_type:"invoice_created",send_real_message:true})).status,400);
    console.log("PASS: real MySQL migration idempotence, atomic CRUD/options, optimistic locking, tenant/link isolation, audit, Meta dispatch, windows/templates, durable uncertainty claims, concurrent scheduled recovery, welcome settings and safe starter seeding");
  }finally{await pool.promise().end();await root.promise().query(`DROP DATABASE \`${database}\``);await root.promise().end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
