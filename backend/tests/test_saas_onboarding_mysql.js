"use strict";

const assert = require("node:assert/strict");
const mysql = require("mysql2");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

async function main() {
  if (!process.env.INBOX_TEST_MYSQL_PORT) { console.log("SKIP: set INBOX_TEST_MYSQL_PORT for the isolated SaaS onboarding test"); return; }
  const name = `saas_onboarding_test_${process.pid}_${Date.now()}`;
  const settings = { host: process.env.INBOX_TEST_MYSQL_HOST || "127.0.0.1", port: Number(process.env.INBOX_TEST_MYSQL_PORT), user: process.env.INBOX_TEST_MYSQL_USER || "root", password: process.env.INBOX_TEST_MYSQL_PASSWORD || "", connectionLimit: 4 };
  if (!["127.0.0.1", "localhost"].includes(settings.host)) throw new Error("This test requires a local MySQL server");
  const root = mysql.createPool(settings);
  let db;
  try {
    await root.promise().query(`CREATE DATABASE \`${name}\``);
    db = mysql.createPool({ ...settings, database: name });
    const sql = db.promise();
    for (const statement of [
      "CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,first_name VARCHAR(100),last_name VARCHAR(100),email VARCHAR(255) UNIQUE,user_password VARCHAR(255),role VARCHAR(30),status VARCHAR(30),emp_id VARCHAR(60) UNIQUE,mobile_number VARCHAR(30),access_code VARCHAR(100),whatsapp_access_level VARCHAR(30) DEFAULT 'full',two_factor_enabled INT DEFAULT 0)",
      "CREATE TABLE tenants (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255),slug VARCHAR(191),legal_name VARCHAR(255),brand_name VARCHAR(255),owner_user_id INT,plan VARCHAR(50),pending_plan_id VARCHAR(50),plan_status VARCHAR(30),max_branches INT,max_seats INT,max_senders INT,max_monthly_messages INT,status VARCHAR(30))",
      "CREATE TABLE plans (id VARCHAR(50) PRIMARY KEY,price_inr INT,is_active INT,max_branches INT,max_seats INT,max_senders INT,max_monthly_messages INT)",
      "CREATE TABLE branches (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,code VARCHAR(40),name VARCHAR(255),timezone VARCHAR(64),manager_id INT,is_head_office INT DEFAULT 0,status VARCHAR(30),slug VARCHAR(191),city VARCHAR(100),phone VARCHAR(40),email VARCHAR(255),address TEXT,operating_hours_json TEXT,settings_json TEXT,UNIQUE(tenant_id,code))",
      "CREATE TABLE organization_memberships (tenant_id INT,user_id INT,role VARCHAR(40),membership_status VARCHAR(30),joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE(tenant_id,user_id))",
      "CREATE TABLE staff_branch_memberships (tenant_id INT,user_id INT,branch_id INT,is_primary INT,UNIQUE(tenant_id,user_id,branch_id))",
      "CREATE TABLE teammember (id INT AUTO_INCREMENT PRIMARY KEY,first_name VARCHAR(100),last_name VARCHAR(100),emp_email VARCHAR(255),mobile VARCHAR(30),job_title VARCHAR(255),emp_role VARCHAR(40),emp_id VARCHAR(60),user_id INT,tenant_id INT,access_code VARCHAR(100),whatsapp_access_level VARCHAR(30),branch_id INT)",
      "CREATE TABLE wallet_accounts (tenant_id INT,currency VARCHAR(3),credit_type VARCHAR(30),balance INT,reserved_balance INT,UNIQUE(tenant_id,credit_type))",
      "CREATE TABLE branch_audit_events (tenant_id INT,branch_id INT,actor_user_id INT,event_type VARCHAR(80),changes_json TEXT)",
      "CREATE TABLE conversations (branch_id INT,status VARCHAR(30))",
      "CREATE TABLE sender_branch_assignments (branch_id INT)",
      "CREATE TABLE browser_sessions (id VARCHAR(36) PRIMARY KEY,user_id INT,refresh_hash CHAR(64),expires_at TIMESTAMP,revoked_at TIMESTAMP NULL)",
      "CREATE TABLE email_otp (email VARCHAR(255),otp VARCHAR(10),expires_at TIMESTAMP)",
    ]) await sql.query(statement);
    await sql.query("INSERT INTO plans VALUES ('free',0,1,3,10,1,1000)");
    const file = require.resolve("../config/database");
    require.cache[file] = { id: file, filename: file, loaded: true, exports: db };
    process.env.JWT_SECRET = "isolated-saas-onboarding-test-secret";
    process.env.NODE_ENV = "test";
    process.env.PUBLIC_BASE_URL = "http://app.fixture.test";
    process.env.ALLOWED_ORIGINS = "http://app.fixture.test";
    const app = express(); app.use(express.json());
    const sessions = require("../services/browserSessions");
    app.use("/api/auth", require("../routes/browserSessionRoutes"));
    app.use("/api/auth", require("../middleware/authWorkspaceScope"), sessions.interceptLogin, require("../routes/authRoutes"));
    app.use("/api", require("../middleware/sharedWorkspaceGuard"));
    app.use("/api/v2", require("../routes/enterpriseOrganizationRoutes"));
    const tenantGuard = require("../middleware/tenantMiddleware");
    app.get("/api/v2/test-branch-scope", tenantGuard.requireTenantContext, tenantGuard.requireBranchScope, (req, res) => res.json({ branchId: req.branchId }));
    const post = (route, body, token, tenantId) => {
      const call = request(app).post(route).send(body);
      if (token) call.set("Authorization", `Bearer ${token}`);
      if (tenantId) call.set("x-tenant-id", String(tenantId));
      return call;
    };
    const signup = suffix => post("/api/auth/self-signup", { first_name: `Owner ${suffix}`, company_name: `Company ${suffix}`, email: `owner${suffix}@fixture.test`, password: "owner-password", plan: "free", branch_name: "Head Office", branch_code: "HQ", tenant_id: 999, role: "employee" });
    const one = await signup("one"), two = await signup("two");
    assert.equal(one.status, 201, JSON.stringify(one.body)); assert.equal(two.status, 201, JSON.stringify(two.body));
    const tenant1 = one.body.user.tenant_id, tenant2 = two.body.user.tenant_id;
    assert.notEqual(tenant1, tenant2); assert.notEqual(tenant1, 999);
    assert.equal(one.body.user.role, "admin"); assert.equal(one.body.organizations[0].role, "organization_owner");
    const extraBranch = await post("/api/v2/branches", { name: "Regional office", code: "REG" }, one.body.token, tenant1);
    assert.equal(extraBranch.status, 201, JSON.stringify(extraBranch.body));
    const branchId = extraBranch.body.branch.id;
    const wrongBranch = await post("/api/auth/employees", { first_name: "Wrong", email: "wrong@fixture.test", branch_id: two.body.activeBranch.id }, one.body.token, tenant1);
    assert.equal(wrongBranch.status, 400);
    const employee = await post("/api/auth/employees", { first_name: "Employee", email: "staff@fixture.test", branch_id: branchId, tenant_id: tenant2 }, one.body.token, tenant1);
    assert.equal(employee.status, 201, JSON.stringify(employee.body)); assert.equal(employee.body.employee.role, "employee");
    const code = employee.body.access_code;
    const preview = await post("/api/auth/verify-access-code", { access_code: code });
    assert.equal(preview.status, 200); assert.equal(preview.body.tenant_id, tenant1); assert.equal(preview.body.branch_id, branchId); assert.equal(preview.body.requires_activation, true);
    const identity = { access_code: code, email: "staff@fixture.test", password: "employee-password", full_name: "Activated employee", tenant_id: tenant2, branch_id: two.body.activeBranch.id, role: "admin" };
    assert.equal((await post("/api/auth/join-with-access-code", { ...identity, email: "another@fixture.test" })).status, 400);
    await sql.query("CREATE TRIGGER fail_employee_activation BEFORE UPDATE ON teammember FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture activation failure'");
    assert.equal((await post("/api/auth/join-with-access-code", identity)).status, 503);
    const [[unactivated]] = await sql.query("SELECT status,user_password FROM users WHERE id=?", [employee.body.employee.id]);
    assert.equal(unactivated.status, "pending"); assert.equal(unactivated.user_password, null);
    await sql.query("DROP TRIGGER fail_employee_activation");
    const joined = await post("/api/auth/join-with-access-code", identity);
    assert.equal(joined.status, 200, JSON.stringify(joined.body)); assert.equal(joined.body.user.role, "employee");
    assert.equal(joined.body.user.tenant_id, tenant1); assert.equal(joined.body.user.branch_id, branchId);
    assert.deepEqual(joined.body.permittedBranchIds, [branchId]); assert.deepEqual(joined.body.branches.map(row => row.id), [branchId]);
    const claims = jwt.verify(joined.body.token, process.env.JWT_SECRET);
    assert.equal(claims.role, "employee"); assert.equal(claims.tenant_id, tenant1); assert.equal(claims.branch_id, branchId);
    const me = await request(app).get("/api/v2/me").set("Authorization", `Bearer ${joined.body.token}`).set("x-tenant-id", String(tenant1));
    assert.equal(me.status, 200, JSON.stringify(me.body)); assert.equal(me.body.roleInActiveOrg, "agent"); assert.deepEqual(me.body.permittedBranchIds, [branchId]);
    assert.equal((await request(app).get("/api/v2/test-branch-scope").set("Authorization", `Bearer ${joined.body.token}`).set("x-branch-id", String(one.body.activeBranch.id))).status, 403);
    assert.equal((await request(app).get("/api/v2/test-branch-scope").set("Authorization", `Bearer ${joined.body.token}`).set("x-branch-id", String(branchId))).status, 200);
    assert.equal((await request(app).get("/api/v2/me").set("Authorization", `Bearer ${joined.body.token}`).set("x-tenant-id", String(tenant2))).status, 403);
    assert.equal((await post("/api/auth/employees", { first_name: "Unauthorized", email: "unauthorized@fixture.test", branch_id: branchId }, joined.body.token, tenant1)).status, 403);
    const login = await post("/api/auth/login", { email: code, password: identity.password });
    assert.equal(login.status, 200, JSON.stringify(login.body)); assert.equal(login.body.user.role, "employee"); assert.deepEqual(login.body.permittedBranchIds, [branchId]);
    assert.equal((await post("/api/auth/join-with-access-code", { ...identity, password: "replacement-password" })).status, 401);
    assert.equal((await post("/api/auth/login", { email: identity.email, password: identity.password })).status, 200);
    await sql.query("INSERT INTO email_otp VALUES (?,'123456',DATE_ADD(NOW(),INTERVAL 5 MINUTE))", [identity.email]);
    const verified = await post("/api/auth/verify-2fa", { email: identity.email, otp: "123456" });
    assert.equal(verified.status, 200); assert.equal(verified.body.user.tenant_id, tenant1); assert.equal(verified.body.user.branch_id, branchId); assert.equal(verified.body.user.role, "employee");
    const activePreview = await post("/api/auth/verify-access-code", { access_code: code }); assert.equal(activePreview.body.requires_activation, false);
    const cookieLogin = await request(app).post("/api/auth/join-with-access-code").set("X-Browser-Session", "1").set("Origin", process.env.PUBLIC_BASE_URL).send(identity);
    assert.equal(cookieLogin.status, 200, JSON.stringify(cookieLogin.body)); assert.equal(cookieLogin.body.cookieSession, true); assert.equal(cookieLogin.body.token, undefined);
    const cookie = cookieLogin.headers["set-cookie"].map(value => value.split(";")[0]).join("; ");
    assert.equal((await request(app).get("/api/v2/me").set("Cookie", cookie).set("x-tenant-id", String(tenant1))).status, 200);
    await sql.query("UPDATE users SET two_factor_enabled=1 WHERE id=?", [joined.body.user.id]);
    assert.equal((await post("/api/auth/join-with-access-code", identity)).status, 403, "Access codes cannot bypass an active account's two-factor check");
    await sql.query("UPDATE users SET two_factor_enabled=0,status='banned' WHERE id=?", [joined.body.user.id]);
    assert.equal((await post("/api/auth/verify-access-code", { access_code: code })).status, 403);
    assert.equal((await post("/api/auth/join-with-access-code", identity)).status, 403, "A banned account cannot be reactivated by access code");
    await sql.query("UPDATE users SET status='active' WHERE id=?", [joined.body.user.id]);
    await sql.query("DELETE FROM staff_branch_memberships WHERE user_id=?", [joined.body.user.id]);
    assert.equal((await post("/api/auth/join-with-access-code", identity)).status, 403, "Missing branch scope must not fall back to head office");
    await sql.query("INSERT INTO staff_branch_memberships VALUES (?,?,?,1)", [tenant1, joined.body.user.id, branchId]);
    await sql.query("UPDATE organization_memberships SET membership_status='revoked' WHERE user_id=?", [joined.body.user.id]);
    assert.equal((await post("/api/auth/join-with-access-code", identity)).status, 403);
    assert.equal((await post("/api/auth/login", { email: code, password: identity.password })).status, 403);
    const [[membership]] = await sql.query("SELECT membership_status FROM organization_memberships WHERE user_id=?", [joined.body.user.id]);
    assert.equal(membership.membership_status, "revoked");
    const [[count]] = await sql.query("SELECT COUNT(*) AS n FROM tenants"); assert.equal(count.n, 2);
    const additional = await post("/api/v2/organizations", { name: "Owner's second organization", plan: "free" }, one.body.token, tenant1);
    assert.equal(additional.status, 201, JSON.stringify(additional.body));
    const additionalOrg = additional.body.organization;
    const additionalEmployee = await post("/api/auth/employees", { first_name: "Second-organization employee", email: "second-staff@fixture.test", branch_id: additionalOrg.head_office_branch_id }, one.body.token, additionalOrg.id);
    assert.equal(additionalEmployee.status, 201, JSON.stringify(additionalEmployee.body));
    const additionalPreview = await post("/api/auth/verify-access-code", { access_code: additionalEmployee.body.access_code });
    assert.equal(additionalPreview.body.tenant_id, additionalOrg.id, "An owner can manage another organization only through its real owner membership");
    console.log("PASS: real MySQL + HTTP: two self-signups create separate owners; owner creates regional branch and employee; access-code preview/activation/login and cookie session keep the assigned tenant/branch/member role; role injection, foreign branches, cross-tenant access, employee administration, password replacement and revoked memberships are rejected. Only an isolated test schema was changed.");
  } finally {
    if (db) await db.promise().end();
    if (/^saas_onboarding_test_\d+_\d+$/.test(name)) await root.promise().query(`DROP DATABASE IF EXISTS \`${name}\``);
    await root.promise().end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
