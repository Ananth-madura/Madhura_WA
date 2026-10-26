"use strict";

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { migrate } = require("../migrations/legacy_employee_memberships");

async function accountCreationWaitsForMembership() {
  const source = require("node:fs").readFileSync(require.resolve("../routes/authRoutes"), "utf8");
  const start = source.indexOf('router.post("/create-user"');
  const end = source.indexOf("/* ================= EMPLOYEE MANAGEMENT", start);
  assert.ok(start >= 0 && end > start, "Account-creation route boundaries must exist");
  let handler, finishMembership, failMembership, pending, response;
  require("node:vm").runInNewContext(source.slice(start, end), {
    router: { post: (path, ...callbacks) => { handler = callbacks.at(-1); } },
    verifyToken() {}, isAdmin() {},
    bcrypt: { hash: (password, rounds, callback) => callback(null, "fixture-hash") },
    rolePolicy: require("../services/rolePolicy"),
    db: { query: (sql, params, callback) => {
      if (sql.startsWith("INSERT INTO users")) pending = callback(null, { insertId: 77 });
      else callback(null, {});
    } },
    queryAsync: (sql, values) => {
      assert.equal(values[0], 1); assert.equal(values[1], 77); assert.equal(values[2], "agent");
      return new Promise((resolve, reject) => { finishMembership = resolve; failMembership = reject; });
    },
    console: { error() {} },
  });
  const request = { user: { id: 1, role: "admin", tenant_id: 1 }, body: { first_name: "Employee", email: "fixture@example.test", user_password: "fixture-password" } };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { response = body; return this; } };
  handler(request, res);
  assert.equal(response, undefined, "Success cannot precede the membership write");
  finishMembership({ affectedRows: 1 }); await pending;
  assert.equal(response.userId, 77);
  response = undefined;
  handler(request, res);
  failMembership(Object.assign(new Error("Fixture membership failure"), { code: "FIXTURE_ERROR" })); await pending;
  assert.equal(res.code, 500, "A failed membership write must never report successful onboarding");
  assert.match(response.message, /membership could not be saved/);
}

function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`
    CREATE TABLE schema_migrations (name TEXT,version INTEGER);
    CREATE TABLE tenants (id INTEGER PRIMARY KEY,name TEXT,slug TEXT,plan TEXT,plan_status TEXT,max_branches INTEGER,max_seats INTEGER,max_senders INTEGER,max_monthly_messages INTEGER,status TEXT);
    CREATE TABLE users (id INTEGER PRIMARY KEY,tenant_id INTEGER,role TEXT,status TEXT,whatsapp_access_level TEXT);
    CREATE TABLE teammember (user_id INTEGER,tenant_id INTEGER,branch_id INTEGER);
    CREATE TABLE branches (id INTEGER PRIMARY KEY,tenant_id INTEGER,status TEXT);
    CREATE TABLE organization_memberships (tenant_id INTEGER,user_id INTEGER,role TEXT,membership_status TEXT,UNIQUE(tenant_id,user_id));
    CREATE TABLE staff_branch_memberships (tenant_id INTEGER,user_id INTEGER,branch_id INTEGER,is_primary INTEGER,UNIQUE(tenant_id,user_id,branch_id));
    INSERT INTO tenants (id,name,status) VALUES (1,'One','active'),(2,'Two','active'),(3,'Suspended','suspended');
    INSERT INTO branches VALUES (10,1,'active'),(11,1,'active'),(12,1,'inactive'),(20,2,'active'),(30,3,'active');
    INSERT INTO users VALUES (1,1,'employee','active','full'),(2,1,'employee','active','full'),(3,1,'employee','inactive','full'),(4,1,'employee','active','full'),(5,1,'employee','active','full'),(6,1,'employee','active','full'),(7,1,'employee','active','full'),(8,1,'admin','active','full'),(9,1,'agent','active','full'),(10,1,'employee','active','full'),(11,3,'employee','active','full');
    INSERT INTO teammember VALUES (1,1,10),(2,2,20),(3,1,10),(4,1,10),(5,1,12),(6,1,20),(8,1,10),(9,1,10),(9,1,11),(10,1,10),(11,3,30);
    INSERT INTO organization_memberships VALUES (1,4,'agent','revoked'),(1,10,'branch_manager','active');
    INSERT INTO staff_branch_memberships VALUES (1,9,10,1);
  `);
  const db = { isSqlite: false, failBranchWrite: false };
  const query = (statement, values = []) => {
    if (statement.startsWith("SET TRANSACTION")) return [];
    if (db.failBranchWrite && statement.startsWith("INSERT IGNORE INTO staff_branch")) throw new Error("Fixture branch write failed");
    const prepared = sql.prepare(statement.replace(/INSERT IGNORE/gi, "INSERT OR IGNORE"));
    return prepared.columns().length ? prepared.all(...values) : { affectedRows: Number(prepared.run(...values).changes) };
  };
  const client = { query: async (statement, values) => [query(statement, values)], beginTransaction: async () => sql.exec("BEGIN"), commit: async () => sql.exec("COMMIT"), rollback: async () => sql.exec("ROLLBACK") };
  db.getConnection = callback => callback(null, { promise: () => client, release() {} });
  db.query = (statement, values, callback) => { try { callback(null, query(statement, values)); } catch (error) { callback(error); } };
  return { db, sql };
}

async function main() {
  const { db, sql } = fixture();
  try {
    assert.deepEqual(await migrate(db), { skipped: false, employees: 2, branches: 2 });
    assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM organization_memberships WHERE membership_status='active' AND role='agent'").get().n, 2);
    assert.equal(sql.prepare("SELECT membership_status FROM organization_memberships WHERE user_id=4").get().membership_status, "revoked");
    assert.equal(sql.prepare("SELECT role FROM organization_memberships WHERE user_id=10").get().role, "branch_manager");
    assert.equal(sql.prepare("SELECT is_primary FROM staff_branch_memberships WHERE user_id=9 AND branch_id=10").get().is_primary, 1);
    for (const id of [2,3,5,6,7,8,11]) assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM organization_memberships WHERE user_id=?").get(id).n, 0, `Ineligible employee ${id} must not get membership`);

    const databasePath = require.resolve("../config/database");
    require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: db };
    const { requireTenantContext } = require("../middleware/tenantMiddleware");
    const authorize = async (userId, tenantId) => {
      let passed = false, body, status = 200;
      const req = { user: { id: userId, role: "employee", tenant_id: 1 }, headers: { "x-tenant-id": tenantId } };
      const res = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
      await requireTenantContext(req, res, () => { passed = true; });
      return { passed, body, status, req };
    };
    const employee = await authorize(1, 1);
    assert.equal(employee.passed, true); assert.equal(employee.req.userRole, "agent");
    assert.equal((await authorize(1, 2)).body.code, "FORBIDDEN_TENANT_ACCESS");
    assert.equal((await authorize(4, 1)).body.code, "MEMBERSHIP_INACTIVE");
    assert.equal((await authorize(3, 1)).body.code, "ACCOUNT_INACTIVE");
    sql.exec("DELETE FROM organization_memberships WHERE user_id=1");
    assert.equal((await migrate(db)).skipped, true);
    assert.equal((await authorize(1, 1)).passed, false, "Migration must never restore a later membership removal");
  } finally { sql.close(); }

  const failed = fixture();
  try {
    failed.db.failBranchWrite = true;
    await assert.rejects(migrate(failed.db), /Fixture branch write failed/);
    assert.equal(failed.sql.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get().n, 0);
    assert.equal(failed.sql.prepare("SELECT COUNT(*) AS n FROM organization_memberships WHERE user_id=1").get().n, 0, "Failed repair rolls back membership and branch changes together");
    failed.db.failBranchWrite = false;
    assert.equal((await migrate(failed.db)).employees, 2);
  } finally { failed.sql.close(); }
  await accountCreationWaitsForMembership();
  console.log("PASS: legacy employee memberships and branch scope repaired atomically; inactive, revoked, unmatched and cross-tenant records stay denied; repeat boot cannot restore removed access.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
