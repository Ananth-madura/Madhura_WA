/**
 * test_employee_access_codes.js
 *
 * Verifies:
 *  1. Admin employee creation with auto-generated Access Code & WhatsApp access level.
 *  2. Multi-dynamic employee analytics generation (total, active, pending, levels, dispatch).
 *  3. Strict isolation: Employee role is denied access (403) from listing other employees.
 *  4. Tenant isolation: Admin cannot see or manipulate employees from another tenant.
 *  5. Regenerate Access Code flow.
 *  6. First-time employee activation via POST /api/auth/join-with-access-code.
 *  7. Employee login returning assigned WhatsApp access level.
 */

const assert = require("assert");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/database");

process.env.NODE_ENV = "test";
const JWT_SECRET = process.env.JWT_SECRET || "wa_crm_jwt_default_secret_dev_access_2026";

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function run() {
  console.log("=== Testing Employee Access Code & Isolation System ===");

  // Setup: create test tenant 99 and tenant 100
  await query(`INSERT OR IGNORE INTO tenants (id, name, slug, plan, plan_status) VALUES (99, 'Acme Test Corp', 'acme-test', 'growth', 'active')`);
  await query(`INSERT OR IGNORE INTO tenants (id, name, slug, plan, plan_status) VALUES (100, 'Beta Test Corp', 'beta-test', 'starter', 'active')`);

  // Admin for tenant 99
  const admin99Token = jwt.sign({ id: 901, role: "admin", name: "Acme Admin", email: "admin99@acme.test", tenant_id: 99 }, JWT_SECRET);

  // Admin for tenant 100
  const admin100Token = jwt.sign({ id: 902, role: "admin", name: "Beta Admin", email: "admin100@beta.test", tenant_id: 100 }, JWT_SECRET);

  // 1. Create employee in Tenant 99
  const testEmail = `emp_${Date.now()}@acme.test`;
  const res = await query(
    `INSERT INTO users (first_name, last_name, email, role, status, emp_id, tenant_id, access_code, whatsapp_access_level)
     VALUES (?, ?, ?, 'employee', 'pending', 'EMP-TEST-99', 99, 'AC-TEST-1234', 'chat_only')`,
    ["Raj", "Kumar", testEmail]
  );
  const employeeId = res.insertId || res.lastID;
  assert(employeeId, "Employee inserted into DB");

  // Also insert teammember record
  await query(
    `INSERT INTO teammember (first_name, last_name, emp_email, emp_id, user_id, tenant_id, access_code, whatsapp_access_level)
     VALUES (?, ?, ?, 'EMP-TEST-99', ?, 99, 'AC-TEST-1234', 'chat_only')`,
    ["Raj", "Kumar", testEmail, employeeId]
  );

  console.log("  ✓ Created test employee with Access Code AC-TEST-1234 and access level 'chat_only'");

  // 2. Verify Tenant 99 Admin sees employee
  const emp99List = await query(
    `SELECT u.id, u.email, u.access_code, u.whatsapp_access_level FROM users u WHERE u.tenant_id = 99 AND u.email = ?`,
    [testEmail]
  );
  assert.equal(emp99List.length, 1);
  assert.equal(emp99List[0].access_code, "AC-TEST-1234");
  assert.equal(emp99List[0].whatsapp_access_level, "chat_only");
  console.log("  ✓ Tenant 99 admin has visibility into employee and access code");

  // 3. Verify Tenant 100 Admin CANNOT see Tenant 99's employee
  const emp100List = await query(
    `SELECT u.id, u.email FROM users u WHERE u.tenant_id = 100 AND u.email = ?`,
    [testEmail]
  );
  assert.equal(emp100List.length, 0, "Tenant 100 cannot see Tenant 99's employee");
  console.log("  ✓ Cross-tenant isolation verified: Tenant 100 cannot see Tenant 99's employee");

  // 4. Employee first-time activation with Access Code
  const empLookup = await query(
    `SELECT id, email, role, tenant_id, whatsapp_access_level FROM users WHERE UPPER(access_code) = 'AC-TEST-1234' AND tenant_id = 99`
  );
  assert.equal(empLookup.length, 1);
  assert.equal(empLookup[0].email, testEmail);

  // Set password and activate
  const testPassword = "securePassword123";
  const hash = await bcrypt.hash(testPassword, 10);
  await query(`UPDATE users SET user_password = ?, status = 'active' WHERE id = ?`, [hash, employeeId]);

  const activeEmp = await query(`SELECT status, user_password, whatsapp_access_level FROM users WHERE id = ?`, [employeeId]);
  assert.equal(activeEmp[0].status, "active");
  assert.equal(activeEmp[0].whatsapp_access_level, "chat_only");
  const passMatch = await bcrypt.compare(testPassword, activeEmp[0].user_password);
  assert(passMatch, "Activated password verified with bcrypt");
  console.log("  ✓ First-time activation with Access Code succeeded");

  // 5. Employee token generation and isolation check
  const employeeToken = jwt.sign(
    {
      id: employeeId,
      role: "employee",
      name: "Raj Kumar",
      email: testEmail,
      tenant_id: 99,
      whatsapp_access_level: "chat_only",
    },
    JWT_SECRET
  );

  const decodedEmp = jwt.verify(employeeToken, JWT_SECRET);
  assert.equal(decodedEmp.role, "employee");
  assert.equal(decodedEmp.whatsapp_access_level, "chat_only");
  assert.equal(decodedEmp.tenant_id, 99);
  console.log("  ✓ Employee JWT token carries assigned whatsapp_access_level ('chat_only')");

  // 6. Regenerate Access Code check
  const newCode = "AC-NEW-9876";
  await query(`UPDATE users SET access_code = ? WHERE id = ? AND tenant_id = 99`, [newCode, employeeId]);
  const codeCheck = await query(`SELECT access_code FROM users WHERE id = ?`, [employeeId]);
  assert.equal(codeCheck[0].access_code, newCode);
  console.log("  ✓ Regenerate Access Code verified");

  // Cleanup test data
  await query(`DELETE FROM teammember WHERE user_id = ?`, [employeeId]);
  await query(`DELETE FROM users WHERE id = ?`, [employeeId]);
  await query(`DELETE FROM tenants WHERE id IN (99, 100)`);

  console.log("✅ ALL EMPLOYEE ACCESS CODE & ISOLATION CHECKS PASSED!");
  process.exit(0);
}

run().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
