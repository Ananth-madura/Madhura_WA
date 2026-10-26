"use strict";

const rolePolicy = require("./rolePolicy");
const fail = (message, status = 403) => Object.assign(new Error(message), { status });

function createWorkspaceSessionService(db) {
  const query = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  return async function resolve(user, read = query) {
    if (user.status !== "active") throw fail("This account is not active. Contact your organization administrator.");
    const tenantId = Number(user.tenant_id);
    if (!Number.isSafeInteger(tenantId) || tenantId < 1) throw fail("This account has no organization assignment. Contact your administrator.");
    const organizations = await read(`SELECT t.id,t.name,t.slug,t.legal_name,t.brand_name,t.plan,t.plan_status,t.pending_plan_id,
      t.max_branches,t.max_seats,t.max_senders,t.max_monthly_messages,t.status,m.role,m.membership_status
      FROM tenants t JOIN organization_memberships m ON m.tenant_id=t.id
      WHERE m.user_id=? AND m.membership_status='active' AND t.status='active'
      ORDER BY t.id`, [user.id]);
    const activeOrganization = organizations.find(org => Number(org.id) === tenantId);
    if (!activeOrganization) throw fail("Your organization membership is not active. Contact your administrator.");
    const admin = ["organization_owner", "organization_admin"].includes(activeOrganization.role);
    const branches = admin
      ? await read("SELECT b.* FROM branches b WHERE b.tenant_id=? AND b.status='active' ORDER BY b.is_head_office DESC,b.id", [tenantId])
      : await read(`SELECT b.* FROM branches b
          JOIN staff_branch_memberships sbm ON sbm.branch_id=b.id AND sbm.tenant_id=b.tenant_id
          WHERE b.tenant_id=? AND sbm.user_id=? AND b.status='active'
          ORDER BY sbm.is_primary DESC,b.id`, [tenantId, user.id]);
    const activeBranch = branches[0];
    if (!activeBranch) throw fail("No active branch is assigned to this account. Ask your organization administrator to assign a branch.");
    const role = rolePolicy.effectiveRole({ userRole: user.role, membershipRole: activeOrganization.role });
    return {
      user: {
        id: user.id, name: user.first_name, email: user.email, role,
        tenant_id: tenantId, tenant_name: activeOrganization.name,
        branch_id: activeBranch.id, branch_name: activeBranch.name, branch_code: activeBranch.code,
        whatsapp_access_level: user.whatsapp_access_level || "full", plan: activeOrganization.plan,
      },
      activeOrganization, organizations, activeBranch, branches,
      permittedBranchIds: branches.map(branch => Number(branch.id)),
      tenant: activeOrganization,
      nextPath: activeOrganization.pending_plan_id && activeOrganization.role === "organization_owner"
        ? "/whatsapp/billing?onboarding=1&plan=" + encodeURIComponent(activeOrganization.pending_plan_id)
        : "/whatsapp",
    };
  };
}

module.exports = { createWorkspaceSessionService };
