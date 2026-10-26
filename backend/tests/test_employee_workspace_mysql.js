"use strict";
const assert = require("node:assert/strict");
const mysql = require("mysql2"), request = require("supertest"), express = require("express"), jwt = require("jsonwebtoken");
const { createInboxService } = require("../services/sharedInboxService");
const { createEmployeeWorkspace } = require("../services/employeeWorkspace");

async function main() {
  const port = Number(process.env.INBOX_TEST_MYSQL_PORT);
  if (!Number.isInteger(port) || port < 1024 || port === 3306) throw new Error("An isolated MySQL port other than 3306 is required");
  const database = `employee_workspace_test_${process.pid}_${Date.now()}`;
  const options = { host: "127.0.0.1", port, user: process.env.INBOX_TEST_MYSQL_USER || "root", password: process.env.INBOX_TEST_MYSQL_PASSWORD || "", connectionLimit: 16 };
  const adminPool = mysql.createPool(options);
  await adminPool.promise().query(`CREATE DATABASE \`${database}\``);
  const pool = mysql.createPool({ ...options, database }), sql = pool.promise();
  const db = { isSqlite: false, getConnection: callback => pool.getConnection(callback), query: (...args) => pool.query(...args), promise: () => sql };
  try {
    const schemas = [
      "users (id INT PRIMARY KEY,tenant_id INT,first_name VARCHAR(50),email VARCHAR(150),status ENUM('pending','active','rejected','on_leave') DEFAULT 'pending',whatsapp_access_level VARCHAR(20) DEFAULT 'full')",
      "tenants (id INT PRIMARY KEY,name VARCHAR(50),slug VARCHAR(50),plan VARCHAR(20),plan_status VARCHAR(20),max_branches INT,max_seats INT,max_senders INT,max_monthly_messages INT,status VARCHAR(20))",
      "organization_memberships (tenant_id INT,user_id INT,role VARCHAR(40),membership_status VARCHAR(20),PRIMARY KEY(tenant_id,user_id))",
      "branches (id INT PRIMARY KEY,tenant_id INT,name VARCHAR(50),status VARCHAR(20))",
      "staff_branch_memberships (tenant_id INT,user_id INT,branch_id INT,is_primary INT DEFAULT 1,PRIMARY KEY(tenant_id,user_id,branch_id))",
      "wa_senders (id INT PRIMARY KEY,tenant_id INT,status VARCHAR(20),display_phone VARCHAR(40))",
      "sender_branch_assignments (tenant_id INT,sender_id INT,branch_id INT,PRIMARY KEY(tenant_id,sender_id,branch_id))",
      "wa_contacts (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,name VARCHAR(255),phone VARCHAR(40),email VARCHAR(255),source VARCHAR(60),opt_in_status INT DEFAULT 1,is_blocked INT DEFAULT 0,is_unsubscribed INT DEFAULT 0,UNIQUE(tenant_id,phone))",
      "conversations (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,sender_id INT,contact_id INT,branch_id INT,owner_user_id INT,status VARCHAR(20),last_message_at DATETIME,service_window_expires_at DATETIME,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE(tenant_id,sender_id,contact_id))",
      "wa_internal_notes (id INT AUTO_INCREMENT PRIMARY KEY,note_text TEXT)",
      "wa_message_logs (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,direction VARCHAR(20),message_type VARCHAR(30),status VARCHAR(30),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,wa_message_id VARCHAR(100))",
      "wa_webhook_claims (claimed_at DATETIME)", "wa_webhook_events (created_at DATETIME)",
      "wa_flow_runs (id INT AUTO_INCREMENT PRIMARY KEY,conversation_id INT,status VARCHAR(30),ended_at DATETIME)",
      "wa_enquiries (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,branch_id INT,crm_lead_id INT,converted_client_id INT,name VARCHAR(255),phone VARCHAR(40),email VARCHAR(255),message TEXT,temperature VARCHAR(20) DEFAULT 'new',created_by INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      "telecalls (id INT PRIMARY KEY,tenant_id INT,mobile_number VARCHAR(40),assigned_to INT)",
      "clients (id INT PRIMARY KEY,tenant_id INT,name VARCHAR(255))",
      "wa_interactive_reminders (id INT PRIMARY KEY,tenant_id INT,assigned_user_id INT,phone VARCHAR(40),status VARCHAR(30))"
    ];
    for (const schema of schemas) await sql.query(`CREATE TABLE ${schema}`);
    await require("../migrations/shared_number_inbox").migrate(db);
    await require("../migrations/shared_number_inbox").migrate(db);
    const [[statusColumn]]=await sql.query("SHOW COLUMNS FROM users LIKE 'status'");assert(statusColumn.Type.includes("'inactive'"));assert(statusColumn.Type.includes("'banned'"));assert(statusColumn.Type.includes("'on_leave'"));
    const organizations = [6, 4, 3];
    for (let index = 0; index < organizations.length; index++) {
      const tenant = index + 1;
      await sql.query("INSERT INTO tenants (id,name,status) VALUES (?,?,'active')", [tenant, `Org ${tenant}`]);
      await sql.query("INSERT INTO branches VALUES (?,?,?,'active')", [tenant, tenant, `Branch ${tenant}`]);
      await sql.query("INSERT INTO wa_senders VALUES (?,?,'connected',?)", [tenant, tenant, `Number ${tenant}`]);
      await sql.query("INSERT INTO sender_branch_assignments VALUES (?,?,?)", [tenant, tenant, tenant]);
      for (let employee = 1; employee <= organizations[index]; employee++) {
        const user = tenant * 10 + employee;
        await sql.query("INSERT INTO users (id,tenant_id,first_name,email,status) VALUES (?,?,?,?,'active')", [user, tenant, `Employee ${user}`, `${user}@test.invalid`]);
        await sql.query("INSERT INTO organization_memberships VALUES (?,?,'employee','active')", [tenant, user]);
        await sql.query("INSERT INTO staff_branch_memberships (tenant_id,user_id,branch_id) VALUES (?,?,?)", [tenant, user, tenant]);
      }
      await sql.query("INSERT INTO users (id,tenant_id,first_name,email,status) VALUES (?,?,?,?,'active')", [100 + tenant, tenant, "Admin", `admin${tenant}@test.invalid`]);
      await sql.query("INSERT INTO organization_memberships VALUES (?,?,'organization_owner','active')", [tenant, 100 + tenant]);
    }
    const inbox = createInboxService(db), workspace = createEmployeeWorkspace(db);
    const principal = (tenant, user, role = "employee") => ({ tenantId: tenant, user: { id: user, tenant_id: tenant }, userRole: role, waAccessLevel: "full" });
    const owner = principal(2, 102, "organization_owner"), employee = principal(2, 21), destination = principal(2, 22), foreign = principal(1, 101, "organization_owner");
    const incoming = phone => inbox.inbound({ tenantId: 2, senderId: 2, phone });
    const conversations = await Promise.all(Array.from({ length: 12 }, (_, index) => incoming(`9190000000${String(index).padStart(2, "0")}`)));
    const counts = {}; conversations.forEach(row => { counts[row.owner_user_id] = (counts[row.owner_user_id] || 0) + 1; });
    assert.deepEqual(counts, { 21: 3, 22: 3, 23: 3, 24: 3 });
    assert.equal((await workspace.list(employee)).customers.length, 3);
    const own = conversations.find(row => row.owner_user_id === 21), hidden = conversations.find(row => row.owner_user_id === 22);
    const samePhoneOtherOrganizations = await Promise.all([1,3].map(tenantId => inbox.inbound({ tenantId, senderId: tenantId, phone: own.contact_phone })));
    assert(samePhoneOtherOrganizations.every(row => row.contact_id !== own.contact_id));
    assert.equal((await workspace.list(principal(1,11))).customers.length, 1);
    assert.equal((await workspace.list(principal(3,31))).customers.length, 1);
    await assert.rejects(workspace.customer(employee, hidden.contact_id), { status: 404 });
    await assert.rejects(workspace.customer(foreign, own.contact_id), { status: 404 });
    const task = await workspace.createRecord(employee, own.contact_id, "tasks", { title: "Follow up", due_at: "2030-01-01" });
    const deal = await workspace.createRecord(employee, own.contact_id, "deals", { title: "Contract", amount: 1000 });
    const lead = await workspace.createRecord(employee, own.contact_id, "leads", { message: "Needs quote" });
    await sql.query("INSERT INTO telecalls VALUES (1,2,?,21)", [own.contact_phone]);
    await sql.query("INSERT INTO clients (id,tenant_id,name,owner_user_id) VALUES (1,2,'Linked client',21)");
    await sql.query("UPDATE wa_enquiries SET crm_lead_id=1,converted_client_id=1,branch_id=2 WHERE id=?", [lead.id]);
    await sql.query("INSERT INTO wa_interactive_reminders VALUES (1,2,21,?,'pending')", [own.contact_phone]);
    await workspace.createRecord(employee, own.contact_id, "activities", { kind: "note", body: "Private note" });
    await assert.rejects(workspace.history(destination, own.contact_id, "tasks"), { status: 404 });
    await sql.query("INSERT INTO wa_internal_notes (tenant_id,conversation_id,note_text) VALUES (?,?,?)", [2, own.id, "Historical note"]);
    await sql.query("INSERT INTO wa_flow_runs (conversation_id,status) VALUES (?,'active')", [own.id]);
    await sql.query("UPDATE conversations SET automation_mode='flow' WHERE id=?", [own.id]);
    const transfer = { userId: 22, branchId: 2, expectedOwnerId: 21, reason: "Coverage transfer" };
    await assert.rejects(workspace.transfer(employee, own.contact_id, transfer), { status: 403 });
    await assert.rejects(workspace.transfer(owner, own.contact_id, { ...transfer, userId: 11, branchId: 1 }), { status: 400 });
    await sql.query("CREATE TRIGGER reject_transfer BEFORE INSERT ON wa_customer_transfers FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected rollback'");
    await assert.rejects(workspace.transfer(owner, own.contact_id, transfer), /injected rollback/);
    assert.equal((await workspace.customer(employee, own.contact_id)).assigned_agent_id, 21);
    assert.equal((await inbox.conversation(employee, own.id)).automation_mode, "flow");
    assert.equal((await workspace.history(employee, own.contact_id, "transfers")).records.length, 0);
    await sql.query("DROP TRIGGER reject_transfer");
    const races = await Promise.allSettled([workspace.transfer(owner, own.contact_id, transfer), workspace.transfer(owner, own.contact_id, transfer)]);
    assert.equal(races.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(races.find(result => result.status === "rejected").reason.status, 409);
    await assert.rejects(workspace.customer(employee, own.contact_id), { status: 404 });
    await assert.rejects(inbox.conversation(employee, own.id), { status: 404 });
    assert.equal((await workspace.history(destination, own.contact_id, "tasks")).records[0].id, task.id);
    assert.equal((await workspace.history(destination, own.contact_id, "deals")).records[0].id, deal.id);
    assert.equal((await workspace.history(destination, own.contact_id, "leads")).records[0].id, lead.id);
    assert.equal((await sql.query("SELECT assigned_to FROM telecalls WHERE id=1"))[0][0].assigned_to, 22);
    assert.equal((await sql.query("SELECT owner_user_id FROM clients WHERE id=1"))[0][0].owner_user_id, 22);
    assert.equal((await sql.query("SELECT assigned_user_id FROM wa_interactive_reminders WHERE id=1"))[0][0].assigned_user_id, 22);
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM wa_internal_notes WHERE conversation_id=?", [own.id]))[0][0].count, 1);
    const repeated = await incoming(own.contact_phone);
    assert.equal(repeated.id, own.id); assert.equal(repeated.owner_user_id, 22);
    const [[run]] = await sql.query("SELECT status FROM wa_flow_runs WHERE conversation_id=?", [own.id]); assert.equal(run.status, "paused_by_agent");
    assert.equal((await workspace.analytics(employee)).customers, 2);
    assert.equal((await workspace.analytics(destination)).customers, 4);
    await sql.query("INSERT INTO wa_message_logs (tenant_id,conversation_id,direction,sent_by,created_at) VALUES (2,?,'inbound',NULL,DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 30 SECOND)),(2,?,'outbound','employee',CURRENT_TIMESTAMP)", [own.id, own.id]);
    const responseMetrics = await workspace.analytics(destination);
    assert.equal(Number(responseMetrics.average_first_response_seconds), 30);
    assert.equal(Number(responseMetrics.unread_messages), 1);
    assert.equal(Number((await workspace.analytics(employee)).unread_messages), 0);
    await sql.query("INSERT INTO users (id,tenant_id,first_name,email,status) VALUES (2000,2,'Supervisor','supervisor@test.invalid','active')");
    await sql.query("INSERT INTO organization_memberships VALUES (2,2000,'branch_manager','active')");
    await sql.query("INSERT INTO staff_branch_memberships (tenant_id,user_id,branch_id) VALUES (2,2000,2)");
    const manager = principal(2,2000,"branch_manager");
    await workspace.customer(manager,own.contact_id);
    await assert.rejects(workspace.customer(manager,samePhoneOtherOrganizations[0].contact_id),{status:404});
    await assert.rejects(inbox.reassign(manager,own.id,{userId:11,branchId:1}),{status:403});
    await workspace.updateRecord(destination, own.contact_id, "tasks", task.id, { status: "completed" });
    assert.equal((await workspace.analytics(destination)).completed_tasks, 1);
    await sql.query("INSERT INTO wa_assignment_settings (tenant_id,strategy,required_skill) VALUES (2,'manual',NULL)");
    const waiting = await incoming("919999999999"); assert.equal(waiting.owner_user_id, null);
    await sql.query("UPDATE wa_assignment_settings SET strategy='workload',required_skill='Tamil' WHERE tenant_id=2");
    await sql.query("INSERT INTO wa_employee_skills VALUES (2,24,'Tamil')");
    assert.equal((await incoming("919999999998")).owner_user_id, 24);
    await sql.query("UPDATE users SET status='inactive' WHERE id=24");
    assert.equal((await incoming("919999999997")).owner_user_id, null);

    process.env.JWT_SECRET = "isolated-employee-workspace-test-secret";
    require.cache[require.resolve("../config/database")] = { loaded: true, exports: db };
    const app = express(); app.use(express.json()); app.use("/api", require("../middleware/sharedWorkspaceGuard")); app.use("/api/v2/workspace", require("../routes/employeeWorkspaceRoutes"));
    const call = (method, path, user = 21, tenant = 2) => request(app)[method](`/api/v2/workspace${path}`).set("Authorization", `Bearer ${jwt.sign({ id: user, tenant_id: tenant, role: "employee" }, process.env.JWT_SECRET)}`).set("x-tenant-id", String(tenant));
    assert.equal((await call("get", `/customers/${own.contact_id}`)).status, 404);
    assert.equal((await call("get", `/customers/${own.contact_id}/tasks`, 22)).body.records[0].id, task.id);
    assert.equal((await call("patch", `/customers/${hidden.contact_id}/tasks/${task.id}`, 22).send({ status: "open" })).status, 404);
    assert.equal((await call("get", "/customers?search=919000", 21, 1)).status, 403);
    assert.equal((await call("get", "/customers", 24)).status, 403);
    assert.equal((await call("post", `/customers/${hidden.contact_id}/transfer`).send(transfer)).status, 403);
    assert.equal((await call("get", "/audit")).status,403);
    const audit = await call("get", "/audit",102);
    assert.equal(audit.status,200); assert(audit.body.records.some(row=>row.action==="customer.transfer"));
    assert.equal((await call("get", "/permissions/11",102)).status,404);
    const grants = workspace.modules.map(module=>({module,can_view:true,can_edit:module!=="deals"}));
    assert.equal((await call("put", "/permissions/22",102).send({permissions:grants})).status,200);
    assert.equal((await call("post", `/customers/${own.contact_id}/deals`,22).send({title:"No deal editing"})).status,403);
    const exported = await call("get", "/customers/export?search=919000");
    assert.equal(exported.status, 200); assert(!exported.text.includes(own.contact_phone));
    await sql.query("UPDATE wa_employee_workspace_permissions SET can_view=0,can_edit=0 WHERE tenant_id=2 AND user_id=22 AND module='tasks'");
    assert.equal((await call("get", `/customers/${own.contact_id}/tasks`, 22)).status, 403);
    assert.equal((await call("get", "/analytics", 22)).body.completed_tasks, undefined);
    await sql.query("DELETE FROM wa_employee_workspace_permissions WHERE tenant_id=2 AND user_id=22");
    await sql.query("UPDATE wa_assignment_settings SET strategy='round_robin',required_skill=NULL WHERE tenant_id=2");
    const recovered = await workspace.reassignInactive(owner);
    assert(recovered.some(result => result.status === "transferred"));
    await assert.rejects(workspace.reassignInactive(employee), { status: 403 });
    await sql.query("UPDATE users SET whatsapp_access_level='read_only' WHERE id=22");
    assert.equal((await call("post", `/customers/${own.contact_id}/tasks`, 22).send({ title: "Denied" })).status, 403);
    const intakeRows=await Promise.all(Array.from({length:12},(_,index)=>call("post","/customers",101,1).send({name:`Intake ${index}`,phone:`9166600000${String(index).padStart(2,"0")}`})));
    assert(intakeRows.every(response=>response.status===201));
    const [intakeCounts]=await sql.query("SELECT assigned_agent_id,COUNT(*) AS count FROM wa_contacts WHERE tenant_id=1 AND phone LIKE '9166600000%' GROUP BY assigned_agent_id ORDER BY assigned_agent_id");
    assert.deepEqual(intakeCounts.map(row=>Number(row.count)),[2,2,2,2,2,2]);
    const intakeContact=intakeRows[0].body.id;
    const [[intakeOwner]]=await sql.query("SELECT assigned_agent_id,branch_id FROM wa_contacts WHERE id=?",[intakeContact]);
    assert.equal(intakeOwner.branch_id,1);
    await workspace.customer(principal(1,intakeOwner.assigned_agent_id),intakeContact);
    await assert.rejects(workspace.customer(employee,intakeContact),{status:404});
    assert.equal((await call("post","/customers",101,1).send({name:"Duplicate",phone:"916660000000"})).status,409);
    await sql.query("INSERT INTO wa_assignment_settings (tenant_id,crm_strategy) VALUES (1,'manual')");
    const manualIntake=await call("post","/customers",101,1).send({name:"Waiting intake",phone:"916661111111"});assert.equal(manualIntake.status,201);
    assert.equal((await sql.query("SELECT assigned_agent_id FROM wa_contacts WHERE id=?",[manualIntake.body.id]))[0][0].assigned_agent_id,null);
    assert.equal((await call("post","/intake/rebalance",101,1).send({})).body.assigned,0);
    await sql.query("UPDATE wa_assignment_settings SET crm_strategy='workload',crm_required_skill='CRM Tamil' WHERE tenant_id=1");
    await sql.query("INSERT INTO wa_employee_skills VALUES (1,14,'CRM Tamil')");
    await sql.query("UPDATE staff_branch_memberships SET max_open_leads=1 WHERE tenant_id=1 AND user_id=14");
    assert.equal((await call("post","/intake/rebalance",101,1).send({})).body.assigned,0);
    await sql.query("UPDATE staff_branch_memberships SET max_open_leads=250 WHERE tenant_id=1 AND user_id=14");
    assert.equal((await call("post","/intake/rebalance",101,1).send({})).body.assigned,1);
    assert.equal((await sql.query("SELECT assigned_agent_id FROM wa_contacts WHERE id=?",[manualIntake.body.id]))[0][0].assigned_agent_id,14);
    await sql.query("UPDATE wa_assignment_settings SET crm_required_skill=NULL WHERE tenant_id=1");
    await sql.query("UPDATE users SET status='inactive' WHERE id=14");
    const crmRecovered=await workspace.reassignInactive(foreign);
    assert(crmRecovered.some(row=>row.contactId===manualIntake.body.id&&row.status==='transferred'));
    await sql.query("CREATE TRIGGER reject_intake BEFORE INSERT ON wa_workspace_audit FOR EACH ROW BEGIN IF NEW.action='customer.auto_assigned' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected intake rollback'; END IF; END");
    assert.equal((await call("post","/customers",101,1).send({name:"Must roll back",phone:"916662222222"})).status,500);
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM wa_contacts WHERE tenant_id=1 AND phone='916662222222'"))[0][0].count,0);
    await sql.query("DROP TRIGGER reject_intake");
    await sql.query("UPDATE users SET whatsapp_access_level='campaign_only' WHERE id=11");
    await sql.query("INSERT INTO wa_employee_workspace_permissions VALUES (1,11,'campaigns',1,1)");
    const campaignOnly={...principal(1,11),waAccessLevel:"campaign_only"};
    assert.equal((await workspace.list(campaignOnly)).customers.length,0);
    const audiences=await require("../services/employeeCampaigns").createEmployeeCampaigns(db).recipients(campaignOnly);
    assert(audiences.records.length>0);
    assert(audiences.records.every(row=>row.phone.startsWith("9166600000")||row.id===samePhoneOtherOrganizations[0].contact_id));
    const [[standalone]]=await sql.query("SELECT id,assigned_agent_id FROM wa_contacts WHERE tenant_id=1 AND assigned_agent_id=12 AND phone LIKE '9166600000%' LIMIT 1");
    await workspace.transfer(foreign,standalone.id,{userId:11,branchId:1,expectedOwnerId:12,reason:"Campaign-only ownership for CRM customer"});
    await assert.rejects(workspace.customer(campaignOnly,standalone.id),{status:404});
    assert((await require("../services/employeeCampaigns").createEmployeeCampaigns(db).recipients(campaignOnly)).records.some(row=>row.id===standalone.id));
    await assert.rejects(workspace.transfer(foreign,samePhoneOtherOrganizations[0].contact_id,{userId:11,branchId:1,expectedOwnerId:11,reason:"Cannot assign chat to campaign-only account"}),{status:400});
    await sql.query("INSERT INTO wa_employee_workspace_permissions VALUES (1,11,'customers',0,0)");
    await assert.rejects(require("../services/employeeCampaigns").createEmployeeCampaigns(db).recipients(campaignOnly),{status:403});
    console.log("PASS: CRM-only concurrent intake distributes 12 customers across six employees; customer privacy, manual queue, skill/workload/capacity rules, inactive-owner recovery and whole-create rollback.");
    console.log("PASS: 3 organizations with 6/4/3 employees; concurrent 12-chat distribution; private customer/leads/tasks/deals and analytics; full transfer rollback, racing transfer conflict, preserved history, old-owner denial and subsequent inbound ownership; manual/workload/skill/inactive routing; direct HTTP ID and tenant tampering denied.");
  } finally {
    await pool.promise().query(`DROP DATABASE \`${database}\``);
    await pool.promise().end(); await adminPool.promise().end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
