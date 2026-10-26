"use strict";

const { createInboxService } = require("../services/sharedInboxService");
const NAME = "legacy_employee_memberships";
const VERSION = 1;

async function migrate(db) {
  if (db.isSqlite) return { skipped: true, employees: 0, branches: 0 };
  return createInboxService(db).transaction(async q => {
    const applied = await q("SELECT version FROM schema_migrations WHERE name=? AND version=? LIMIT 1", [NAME, VERSION]);
    if (applied.length) return { skipped: true, employees: 0, branches: 0 };

    // A legacy user tenant alone is insufficient proof: require the staff
    // record and an active branch in that same active organization as well.
    const candidates = await q(`SELECT DISTINCT u.id AS user_id, u.tenant_id, tm.branch_id
      FROM users u
      JOIN tenants t ON t.id=u.tenant_id AND t.status='active'
      JOIN teammember tm ON tm.user_id=u.id AND tm.tenant_id=u.tenant_id
      JOIN branches b ON b.id=tm.branch_id AND b.tenant_id=u.tenant_id AND b.status='active'
      LEFT JOIN organization_memberships m ON m.user_id=u.id AND m.tenant_id=u.tenant_id
      WHERE u.status='active' AND u.role IN ('employee','agent') AND m.user_id IS NULL`);
    const employees = new Map();
    for (const row of candidates) {
      const key = `${row.tenant_id}:${row.user_id}`;
      if (!employees.has(key)) employees.set(key, { ...row, branches: new Set() });
      employees.get(key).branches.add(row.branch_id);
    }
    let restored = 0, branches = 0;
    for (const employee of employees.values()) {
      // Existing grants, including revoked memberships, are never updated.
      const inserted = await q("INSERT IGNORE INTO organization_memberships (tenant_id,user_id,role,membership_status) VALUES (?,?,'agent','active')", [employee.tenant_id, employee.user_id]);
      if (inserted.affectedRows !== 1) continue;
      restored++;
      for (const branchId of employee.branches) {
        const result = await q("INSERT IGNORE INTO staff_branch_memberships (tenant_id,user_id,branch_id,is_primary) VALUES (?,?,?,0)", [employee.tenant_id, employee.user_id, branchId]);
        branches += result.affectedRows;
      }
    }
    // Run once, so deleting a membership later cannot cause a re-grant on boot.
    await q("INSERT INTO schema_migrations (name,version) VALUES (?,?)", [NAME, VERSION]);
    return { skipped: false, employees: restored, branches };
  });
}

module.exports = { migrate };
