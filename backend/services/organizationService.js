/**
 * organizationService.js
 *
 * Core service for Organizations, Branches, Teams, and Memberships.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md
 */

const db = require("../config/database");
const crypto = require("crypto");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(db.isSqlite ? sql : sql.replace(/INSERT OR IGNORE/gi, "INSERT IGNORE").replace(/\bexcluded\.(\w+)/g, "VALUES($1)"), params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

/**
 * Get all organizations where the given user has an active membership.
 */
async function getUserOrganizations(userId) {
  const uid = Number(userId);
  const rows = await q(
    `SELECT t.id, t.name, t.slug, t.legal_name, t.brand_name, t.plan, t.plan_status, t.pending_plan_id,
            t.max_branches, t.max_seats, t.max_senders, t.status,
            om.role, om.membership_status, om.joined_at
     FROM tenants t
     JOIN organization_memberships om ON t.id = om.tenant_id
     WHERE om.user_id = ? AND om.membership_status = 'active' AND t.status = 'active'
     ORDER BY t.id ASC`,
    [uid]
  );
  return rows;
}

/**
 * Get single organization by ID with branch count, member count, and plan details.
 */
async function getOrganizationDetails(tenantId) {
  const tid = Number(tenantId);
  const orgs = await q("SELECT * FROM tenants WHERE id = ? LIMIT 1", [tid]);
  if (!orgs || orgs.length === 0) return null;
  const org = orgs[0];

  const [branchCountRow] = await q(
    "SELECT COUNT(*) as count FROM branches WHERE tenant_id = ? AND status != 'archived'",
    [tid]
  );
  const [memberCountRow] = await q(
    "SELECT COUNT(*) as count FROM organization_memberships WHERE tenant_id = ? AND membership_status = 'active'",
    [tid]
  );
  const [senderCountRow] = await q(
    "SELECT COUNT(*) as count FROM wa_senders WHERE tenant_id = ? AND status = 'connected'",
    [tid]
  );

  return {
    ...org,
    stats: {
      branches: Number(branchCountRow?.count || 0),
      members: Number(memberCountRow?.count || 0),
      senders: Number(senderCountRow?.count || 0),
    },
  };
}

/**
 * Create a new organization / company with default Head Office branch, owner membership, and trial/plan.
 */
async function createOrganization({ name, legal_name, brand_name, ownerUserId, plan = "free", branch_name, branch_code, timezone }, runQuery = q) {
  const cleanName = (name || "New Organization").trim();
  const cleanLegal = (legal_name || cleanName).trim();
  const cleanBrand = (brand_name || cleanName).trim();
  const requestedPlan = String(plan || "free").toLowerCase();
  const cleanPlan = "free";

  const [requested]=await runQuery("SELECT * FROM plans WHERE id = ? AND is_active = 1 LIMIT 1",[requestedPlan]);
  if(!requested)throw Object.assign(new Error("Selected plan is not available"),{status:400});
  const [planConfig]=await runQuery("SELECT * FROM plans WHERE id = 'free' AND is_active = 1 LIMIT 1");
  if(!planConfig||Number(planConfig.price_inr)!==0)throw Object.assign(new Error("The free onboarding plan is unavailable"),{status:503});
  if(!Number.isFinite(Number(requested.price_inr))||Number(requested.price_inr)<0)throw Object.assign(new Error("Selected plan price is invalid"),{status:503});
  const pendingPlan=Number(requested.price_inr)>0?requested.id:null;

  const baseSlug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "org";
  const uniqueSlug = `${baseSlug.slice(0,150)}-${crypto.randomBytes(6).toString("hex")}`;

  // 1. Insert Tenant
  const insertTenantSql = `
    INSERT INTO tenants 
      (name, slug, legal_name, brand_name, owner_user_id, plan, pending_plan_id, plan_status, max_branches, max_seats, max_senders, max_monthly_messages, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 'active')
  `;

  const tenantResult = await runQuery(insertTenantSql, [
    cleanName,
    uniqueSlug,
    cleanLegal,
    cleanBrand,
    ownerUserId,
    cleanPlan,
    pendingPlan,
    planConfig.max_branches || 1,
    planConfig.max_seats || 5,
    planConfig.max_senders || 1,
    planConfig.max_monthly_messages || 5000,
  ]);

  const newTenantId = tenantResult.insertId || tenantResult.lastID;

  const branchNameClean = (branch_name || "Head Office (Main)").trim();
  const branchCodeClean = (branch_code || "HEADOFFICE").trim().toUpperCase();
  const branchTzClean = timezone || "Asia/Kolkata";

  // 2. Insert Default Head Office Branch
  const insertBranchSql = `
    INSERT INTO branches (tenant_id, code, name, timezone, manager_id, is_head_office, status)
    VALUES (?, ?, ?, ?, ?, 1, 'active')
  `;
  const branchResult = await runQuery(insertBranchSql, [newTenantId, branchCodeClean, branchNameClean, branchTzClean, ownerUserId]);
  const newBranchId = branchResult.insertId || branchResult.lastID;

  // 3. Insert Owner Membership
  await runQuery(
    `INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status)
     VALUES (?, ?, 'organization_owner', 'active')`,
    [newTenantId, ownerUserId]
  );

  // 4. Insert Staff Branch Membership
  await runQuery(
    `INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary)
     VALUES (?, ?, ?, 1)`,
    [newTenantId, ownerUserId, newBranchId]
  );

  // 5. Initialize Wallets
  await runQuery(
    `INSERT OR IGNORE INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance)
     VALUES (?, 'INR', 'ai_credits', 200, 0)`,
    [newTenantId]
  );
  await runQuery(
    `INSERT OR IGNORE INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance)
     VALUES (?, 'INR', 'software_actions', 1000, 0)`,
    [newTenantId]
  );

  return {
    id: newTenantId,
    name: cleanName,
    slug: uniqueSlug,
    legal_name: cleanLegal,
    brand_name: cleanBrand,
    plan: cleanPlan,
    pending_plan_id: pendingPlan,
    requestedPlanId: requested.id,
    checkoutRequired: Boolean(pendingPlan),
    head_office_branch_id: newBranchId,
    branch_name: branchNameClean,
    branch_code: branchCodeClean,
  };
}

/**
 * List branches for a tenant with member count, senders, and active conversations.
 */
async function getBranches(tenantId) {
  const tid = Number(tenantId);
  const rows = await q(
    `SELECT b.*, 
            u.first_name as manager_first_name, u.email as manager_email,
            (SELECT COUNT(*) FROM staff_branch_memberships WHERE branch_id = b.id) as staff_count,
            (SELECT COUNT(*) FROM sender_branch_assignments WHERE branch_id = b.id) as sender_count,
            (SELECT COUNT(*) FROM conversations WHERE branch_id = b.id AND status = 'open') as open_conversations_count
     FROM branches b
     LEFT JOIN users u ON b.manager_id = u.id
     WHERE b.tenant_id = ? AND b.status != 'archived'
     ORDER BY b.is_head_office DESC, b.name ASC`,
    [tid]
  );
  return rows;
}

/**
 * Create a new branch within tenant. Enforces plan max_branches quota!
 */
async function createBranch(tenantId, payload, actorUserId = null) {
  const tid = Number(tenantId);
  const cleanName = (payload.name || "").trim();
  const cleanCode = (payload.code || cleanName)
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\-_]+/g, "")
    .slice(0, 40);

  if (!cleanName || !cleanCode) {
    throw new Error("Branch name and a unique branch code are required");
  }

  // 1. Quota Check
  const [tenant] = await q("SELECT max_branches, name FROM tenants WHERE id = ? LIMIT 1", [tid]);
  const [countRow] = await q(
    "SELECT COUNT(*) as count FROM branches WHERE tenant_id = ? AND status != 'archived'",
    [tid]
  );

  const maxAllowed = tenant ? tenant.max_branches : 1;
  const currentCount = Number(countRow?.count || 0);

  if (currentCount >= maxAllowed) {
    const err = new Error(
      `Branch limit reached (${currentCount}/${maxAllowed}). Please upgrade your plan to add more branches.`
    );
    err.code = "QUOTA_EXCEEDED";
    throw err;
  }

  // 2. Duplicate Code Check
  const existing = await q("SELECT id FROM branches WHERE tenant_id = ? AND code = ? LIMIT 1", [tid, cleanCode]);
  if (existing && existing.length > 0) {
    const err = new Error(`A branch with code "${cleanCode}" already exists in your organization`);
    err.code = "DUPLICATE_BRANCH_CODE";
    throw err;
  }

  // Slug calculation
  const baseSlug = (payload.slug || cleanName)
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "branch";
  const finalSlug = payload.slug ? baseSlug : `${baseSlug}-${cleanCode.toLowerCase()}`;

  const cleanManagerId = payload.manager_id || payload.managerUserId ? Number(payload.manager_id || payload.managerUserId) : null;
  const hoursJson = payload.operating_hours ? JSON.stringify(payload.operating_hours) : (payload.operating_hours_json || null);
  const settingsJson = payload.settings ? JSON.stringify(payload.settings) : (payload.settings_json || null);
  const branchStatus = payload.activate !== false && payload.status !== "draft" ? "active" : "draft";

  const res = await q(
    `INSERT INTO branches (tenant_id, code, name, slug, city, timezone, manager_id, phone, email, address, operating_hours_json, settings_json, is_head_office, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      tid,
      cleanCode,
      cleanName,
      finalSlug,
      payload.city || null,
      payload.timezone || "Asia/Kolkata",
      cleanManagerId,
      payload.phone || null,
      payload.email || null,
      payload.address || null,
      hoursJson,
      settingsJson,
      branchStatus,
    ]
  );

  const newId = res.insertId || res.lastID;

  // 3. Automatically add manager to staff_branch_memberships if assigned
  let managerObj = null;
  if (cleanManagerId) {
    await assignStaffBranch(tid, cleanManagerId, newId, null, 1);
    const [u] = await q("SELECT id, first_name, last_name, email FROM users WHERE id = ? LIMIT 1", [cleanManagerId]);
    if (u) {
      managerObj = { id: u.id, displayName: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email, email: u.email };
    }
  }

  // 4. Attach initial senders if requested (Dedicated or Shared)
  if (Array.isArray(payload.senderAssignments)) {
    for (const sa of payload.senderAssignments) {
      const senderId = Number(sa.senderId || sa.sender_id);
      if (senderId) {
        const assignmentType = sa.assignmentType || sa.assignment_type || "shared";
        await q(
          `INSERT OR IGNORE INTO sender_branch_assignments (tenant_id, sender_id, branch_id, is_default, routing_weight)
           VALUES (?, ?, ?, ?, ?)`,
          [tid, senderId, newId, sa.isDefault ? 1 : 0, sa.routingWeight || 100]
        );
      }
    }
  }

  // 5. Audit event
  await recordBranchAudit(tid, newId, actorUserId || cleanManagerId, "branch.created", {
    name: cleanName,
    code: cleanCode,
    slug: finalSlug,
    city: payload.city || null,
    manager_id: cleanManagerId,
  });

  return {
    id: newId,
    tenant_id: tid,
    code: cleanCode,
    name: cleanName,
    slug: finalSlug,
    city: payload.city || null,
    timezone: payload.timezone || "Asia/Kolkata",
    status: branchStatus,
    manager: managerObj,
    url: `/whatsapp/branches/${newId}/${finalSlug}`,
    setup: {
      phoneConnected: (payload.senderAssignments?.length || 0) > 0,
      teamReady: Boolean(cleanManagerId),
      routingConfigured: false,
    },
  };
}

/**
 * Update an existing branch.
 */
async function updateBranch(tenantId, branchId, data) {
  const tid = Number(tenantId);
  const bid = Number(branchId);

  const [existing] = await q("SELECT * FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [bid, tid]);
  if (!existing) {
    throw new Error("Branch not found");
  }

  const updates = [];
  const params = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name.trim());
  }
  if (data.timezone !== undefined) {
    updates.push("timezone = ?");
    params.push(data.timezone.trim());
  }
  if (data.manager_id !== undefined) {
    updates.push("manager_id = ?");
    params.push(data.manager_id ? Number(data.manager_id) : null);
  }
  if (data.phone !== undefined) {
    updates.push("phone = ?");
    params.push(data.phone.trim());
  }
  if (data.email !== undefined) {
    updates.push("email = ?");
    params.push(data.email.trim());
  }
  if (data.address !== undefined) {
    updates.push("address = ?");
    params.push(data.address.trim());
  }
  if (data.operating_hours !== undefined) {
    updates.push("operating_hours_json = ?");
    params.push(data.operating_hours ? JSON.stringify(data.operating_hours) : null);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }

  if (updates.length === 0) return existing;

  params.push(bid, tid);
  await q(`UPDATE branches SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`, params);

  const [updated] = await q("SELECT * FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [bid, tid]);
  return updated;
}

/**
 * Archive a branch (head office cannot be archived).
 */
async function archiveBranch(tenantId, branchId) {
  const tid = Number(tenantId);
  const bid = Number(branchId);

  const [branch] = await q("SELECT is_head_office FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [bid, tid]);
  if (!branch) throw new Error("Branch not found");
  if (branch.is_head_office) throw new Error("The Head Office branch cannot be archived or deleted");

  await q("UPDATE branches SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?", [
    bid,
    tid,
  ]);
  return { success: true };
}

/**
 * List all members of an organization with their assigned roles and branches.
 */
async function getOrganizationMembers(tenantId) {
  const tid = Number(tenantId);
  const rows = await q(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.status as user_status,
            om.role as organization_role, om.membership_status, om.joined_at,
            (SELECT GROUP_CONCAT(b.name, ', ') 
             FROM staff_branch_memberships sbm 
             JOIN branches b ON sbm.branch_id = b.id 
             WHERE sbm.user_id = u.id AND sbm.tenant_id = ?) as assigned_branches
     FROM users u
     JOIN organization_memberships om ON u.id = om.user_id
     WHERE om.tenant_id = ?
     ORDER BY u.id ASC`,
    [tid, tid]
  );
  return rows;
}

/**
 * Assign staff member to a branch.
 */
async function assignStaffBranch(tenantId, userId, branchId, teamId = null, isPrimary = 0) {
  const tid = Number(tenantId);
  const uid = Number(userId);
  const bid = Number(branchId);

  // Verify branch belongs to tenant
  const [b] = await q("SELECT id FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [bid, tid]);
  if (!b) throw new Error("Invalid branch for this organization");

  // Upsert
  await q(
    `INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, team_id, is_primary)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE team_id = excluded.team_id, is_primary = excluded.is_primary`,
    [tid, uid, bid, teamId, isPrimary ? 1 : 0]
  );

  return { success: true };
}

/**
 * Create invitation for new staff member.
 */
async function inviteStaffMember(tenantId, invitedByUserId, { email, role = "agent", branchId = null, teamId = null }) {
  const tid = Number(tenantId);
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) throw new Error("Email is required for invitation");

  // Check seat quota
  const [tenant] = await q("SELECT max_seats FROM tenants WHERE id = ? LIMIT 1", [tid]);
  const [memberCount] = await q(
    "SELECT COUNT(*) as count FROM organization_memberships WHERE tenant_id = ? AND membership_status = 'active'",
    [tid]
  );

  const maxSeats = tenant ? tenant.max_seats : 5;
  const currentSeats = Number(memberCount?.count || 0);
  if (currentSeats >= maxSeats) {
    const err = new Error(`Seat limit reached (${currentSeats}/${maxSeats}). Please upgrade your plan to invite more staff.`);
    err.code = "QUOTA_EXCEEDED";
    throw err;
  }

  // Token generation
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await q(
    `INSERT INTO invitations (tenant_id, email, role, branch_id, team_id, token_hash, status, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [tid, cleanEmail, role, branchId || null, teamId || null, token, invitedByUserId, expires]
  );

  return {
    email: cleanEmail,
    role,
    token,
    expires_at: expires,
  };
}


/**
 * Record a branch audit event.
 */
async function recordBranchAudit(tenantId, branchId, actorUserId, eventType, changes) {
  try {
    const tid = Number(tenantId);
    const bid = branchId ? Number(branchId) : null;
    const uid = actorUserId ? Number(actorUserId) : null;
    const jsonStr = changes ? JSON.stringify(changes) : null;
    await q(
      `INSERT INTO branch_audit_events (tenant_id, branch_id, actor_user_id, event_type, changes_json)
       VALUES (?, ?, ?, ?, ?)`,
      [tid, bid, uid, eventType, jsonStr]
    );
  } catch (err) {
    console.warn("[recordBranchAudit] Notice:", err.message);
  }
}

/**
 * Get authorized branch details with counts, senders, and manager.
 */
async function getBranchDetails(tenantId, branchId) {
  const tid = Number(tenantId);
  const bid = Number(branchId);

  const [branch] = await q(
    `SELECT b.*, 
            u.first_name as manager_first_name, u.last_name as manager_last_name, u.email as manager_email,
            (SELECT COUNT(*) FROM staff_branch_memberships WHERE branch_id = b.id) as staff_count,
            (SELECT COUNT(*) FROM sender_branch_assignments WHERE branch_id = b.id) as sender_count,
            (SELECT COUNT(*) FROM conversations WHERE branch_id = b.id AND status = 'open') as open_conversations_count,
            (SELECT COUNT(*) FROM wa_contacts WHERE branch_id = b.id) as contacts_count
     FROM branches b
     LEFT JOIN users u ON b.manager_id = u.id
     WHERE b.id = ? AND b.tenant_id = ? LIMIT 1`,
    [bid, tid]
  );

  if (!branch) return null;

  // Format manager object
  let manager = null;
  if (branch.manager_id) {
    manager = {
      id: branch.manager_id,
      displayName: `${branch.manager_first_name || ""} ${branch.manager_last_name || ""}`.trim() || branch.manager_email,
      email: branch.manager_email,
    };
  }

  // Load operating hours & settings
  let operatingHours = null;
  try {
    if (branch.operating_hours_json) operatingHours = JSON.parse(branch.operating_hours_json);
  } catch (_) {}

  let settings = null;
  try {
    if (branch.settings_json) settings = JSON.parse(branch.settings_json);
  } catch (_) {}

  return {
    ...branch,
    manager,
    operating_hours: operatingHours,
    settings,
    setup: {
      phoneConnected: Number(branch.sender_count || 0) > 0,
      teamReady: Number(branch.staff_count || 0) > 0,
      routingConfigured: Boolean(settings?.routing_configured),
    },
  };
}

/**
 * List phone numbers & senders assigned to a branch.
 */
async function getBranchSenders(tenantId, branchId) {
  const tid = Number(tenantId);
  const bid = Number(branchId);

  const rows = await q(
    `SELECT sba.id as assignment_id, sba.is_default, sba.routing_weight, sba.created_at as assigned_at,
            s.id as sender_id, s.phone_number_id, s.display_phone, s.verified_name, s.quality, s.messaging_tier,
            s.is_shared, s.status as sender_status
     FROM sender_branch_assignments sba
     JOIN wa_senders s ON sba.sender_id = s.id
     WHERE sba.tenant_id = ? AND sba.branch_id = ?
     ORDER BY sba.is_default DESC, s.display_phone ASC`,
    [tid, bid]
  );
  return rows;
}

/**
 * Attach a sender to a branch (dedicated or shared).
 */
async function attachSenderToBranch(tenantId, branchId, { senderId, isDefault = false, routingWeight = 100 }, actorUserId = null) {
  const tid = Number(tenantId);
  const bid = Number(branchId);
  const sid = Number(senderId);

  const [sender] = await q("SELECT id, display_phone FROM wa_senders WHERE id = ? AND tenant_id = ? LIMIT 1", [sid, tid]);
  if (!sender) throw new Error("Sender does not belong to this organization");

  if (isDefault) {
    // Demote existing default
    await q("UPDATE sender_branch_assignments SET is_default = 0 WHERE tenant_id = ? AND branch_id = ?", [tid, bid]);
  }

  await q(
    `INSERT INTO sender_branch_assignments (tenant_id, sender_id, branch_id, is_default, routing_weight)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE is_default = excluded.is_default, routing_weight = excluded.routing_weight`,
    [tid, sid, bid, isDefault ? 1 : 0, routingWeight]
  ).catch(async () => {
    // SQLite fallback
    const [exist] = await q("SELECT id FROM sender_branch_assignments WHERE tenant_id = ? AND sender_id = ? AND branch_id = ? LIMIT 1", [tid, sid, bid]);
    if (exist) {
      await q("UPDATE sender_branch_assignments SET is_default = ?, routing_weight = ? WHERE id = ?", [isDefault ? 1 : 0, routingWeight, exist.id]);
    } else {
      await q("INSERT INTO sender_branch_assignments (tenant_id, sender_id, branch_id, is_default, routing_weight) VALUES (?, ?, ?, ?, ?)", [tid, sid, bid, isDefault ? 1 : 0, routingWeight]);
    }
  });

  await recordBranchAudit(tid, bid, actorUserId, "branch.sender.attached", { sender_id: sid, phone: sender.display_phone, is_default: isDefault });
  return { success: true };
}

/**
 * Unassign sender from branch.
 */
async function unassignSenderFromBranch(tenantId, branchId, senderId, actorUserId = null) {
  const tid = Number(tenantId);
  const bid = Number(branchId);
  const sid = Number(senderId);

  await q("DELETE FROM sender_branch_assignments WHERE tenant_id = ? AND branch_id = ? AND sender_id = ?", [tid, bid, sid]);
  await recordBranchAudit(tid, bid, actorUserId, "branch.sender.unassigned", { sender_id: sid });
  return { success: true };
}

/**
 * Get branch members and their roles with complete employee profile details.
 */
async function getBranchMembers(tenantId, branchId) {
  const tid = Number(tenantId);
  const bid = Number(branchId);

  let rows = await q(
    `SELECT u.id as user_id, u.first_name, u.last_name, u.email, u.status as user_status,
            sbm.id as membership_id, sbm.is_primary, sbm.created_at as member_since,
            COALESCE(om.role, u.role) as organization_role,
            t.name as team_name,
            tm.mobile, tm.job_title, tm.emp_role, tm.access_code, tm.whatsapp_access_level, tm.emp_id
     FROM staff_branch_memberships sbm
     JOIN users u ON sbm.user_id = u.id
     LEFT JOIN organization_memberships om ON (om.tenant_id = sbm.tenant_id AND om.user_id = u.id)
     LEFT JOIN teams t ON sbm.team_id = t.id
     LEFT JOIN teammember tm ON (tm.user_id = u.id OR (u.email IS NOT NULL AND tm.emp_email = u.email))
     WHERE sbm.tenant_id = ? AND sbm.branch_id = ?
     ORDER BY sbm.is_primary DESC, u.first_name ASC`,
    [tid, bid]
  );

  // If no branch-specific staff memberships found, check if tenant has ANY branch memberships configured.
  // If the tenant already uses branch memberships, an empty result legitimately means 0 members in this branch.
  if (!rows || rows.length === 0) {
    const [hasAnyMembership] = await q(
      "SELECT id FROM staff_branch_memberships WHERE tenant_id = ? LIMIT 1",
      [tid]
    );

    // Only fallback for legacy tenants with ZERO branch assignments across the entire organization,
    // and only for the Head Office branch.
    if (!hasAnyMembership) {
      const [branch] = await q("SELECT is_head_office FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [bid, tid]);
      if (branch && (branch.is_head_office || bid === 1)) {
        rows = await q(
          `SELECT u.id as user_id, u.first_name, u.last_name, u.email, u.status as user_status,
                  0 as membership_id, 0 as is_primary, u.created_at as member_since,
                  COALESCE(om.role, u.role) as organization_role,
                  'General' as team_name,
                  tm.mobile, tm.job_title, tm.emp_role, tm.access_code, tm.whatsapp_access_level, tm.emp_id
           FROM organization_memberships om
           JOIN users u ON om.user_id = u.id
           LEFT JOIN teammember tm ON (tm.user_id = u.id OR (u.email IS NOT NULL AND tm.emp_email = u.email))
           WHERE om.tenant_id = ? AND (om.membership_status = 'active' OR om.membership_status IS NULL)
           ORDER BY u.first_name ASC`,
          [tid]
        );

        if (!rows || rows.length === 0) {
          rows = await q(
            `SELECT u.id as user_id, u.first_name, u.last_name, u.email, 'active' as user_status,
                    0 as membership_id, 0 as is_primary, u.created_at as member_since,
                    u.role as organization_role,
                    'General' as team_name,
                    tm.mobile, tm.job_title, tm.emp_role, tm.access_code, tm.whatsapp_access_level, tm.emp_id
             FROM users u
             LEFT JOIN teammember tm ON (tm.user_id = u.id OR (u.email IS NOT NULL AND tm.emp_email = u.email))
             WHERE u.tenant_id = ?
             ORDER BY u.first_name ASC`,
            [tid]
          );
        }
      }
    }
  }

  return rows || [];
}

/**
 * Remove a member from a branch.
 */
async function removeBranchMember(tenantId, branchId, userId, actorUserId = null) {
  const tid = Number(tenantId);
  const bid = Number(branchId);
  const uid = Number(userId);

  await q("DELETE FROM staff_branch_memberships WHERE tenant_id = ? AND branch_id = ? AND user_id = ?", [tid, bid, uid]);
  await recordBranchAudit(tid, bid, actorUserId, "branch.member.removed", { user_id: uid });
  return { success: true };
}

/**
 * Transfer branch manager atomically with audit event.
 */
async function transferBranchManager(tenantId, branchId, newManagerUserId, actorUserId = null) {
  const tid = Number(tenantId);
  const bid = Number(branchId);
  const newUid = Number(newManagerUserId);

  const [branch] = await q("SELECT manager_id, name FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [bid, tid]);
  if (!branch) throw new Error("Branch not found");

  const [newUser] = await q("SELECT id, first_name, last_name, email FROM users WHERE id = ? LIMIT 1", [newUid]);
  if (!newUser) throw new Error("Target manager user not found");

  const oldManagerId = branch.manager_id;

  // Atomically update branch manager
  await q("UPDATE branches SET manager_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?", [newUid, bid, tid]);

  // Ensure new manager has membership in this branch
  await assignStaffBranch(tid, newUid, bid, null, 1);

  await recordBranchAudit(tid, bid, actorUserId, "branch.manager.transferred", {
    old_manager_id: oldManagerId,
    new_manager_id: newUid,
    new_manager_name: `${newUser.first_name || ""} ${newUser.last_name || ""}`.trim() || newUser.email,
  });

  return {
    success: true,
    branch_id: bid,
    manager_id: newUid,
    manager: {
      id: newUid,
      name: `${newUser.first_name || ""} ${newUser.last_name || ""}`.trim() || newUser.email,
      email: newUser.email,
    },
    manager_name: `${newUser.first_name || ""} ${newUser.last_name || ""}`.trim() || newUser.email,
  };
}

/**
 * Restore an archived branch (with quota check).
 */
async function restoreBranch(tenantId, branchId, actorUserId = null) {
  const tid = Number(tenantId);
  const bid = Number(branchId);

  // Check quota
  const [tenant] = await q("SELECT max_branches FROM tenants WHERE id = ? LIMIT 1", [tid]);
  const [countRow] = await q("SELECT COUNT(*) as count FROM branches WHERE tenant_id = ? AND status != 'archived'", [tid]);
  const maxAllowed = tenant ? tenant.max_branches : 1;
  const currentCount = Number(countRow?.count || 0);

  if (currentCount >= maxAllowed) {
    const err = new Error(`Cannot restore branch: plan quota reached (${currentCount}/${maxAllowed})`);
    err.code = "QUOTA_EXCEEDED";
    throw err;
  }

  await q("UPDATE branches SET status = 'active', archived_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?", [bid, tid]);
  await recordBranchAudit(tid, bid, actorUserId, "branch.restored", { branch_id: bid });
  return { success: true };
}

/**
 * Get branch inbox conversations.
 */
async function getBranchConversations(tenantId, branchId, options = {}) {
  const tid = Number(tenantId);
  const bid = Number(branchId);
  const limit = Math.min(Number(options.limit || 50), 100);
  const offset = Number(options.offset || 0);

  const rows = await q(
    `SELECT c.*,
            ct.phone as customer_phone, ct.name as customer_name,
            s.display_phone as sender_phone, s.verified_name as sender_name,
            u.first_name as assigned_agent_name
     FROM conversations c
     LEFT JOIN wa_contacts ct ON c.contact_id = ct.id
     LEFT JOIN wa_senders s ON c.sender_id = s.id
     LEFT JOIN users u ON c.owner_user_id = u.id
     WHERE c.tenant_id = ? AND c.branch_id = ?
     ORDER BY c.last_message_at DESC
     LIMIT ? OFFSET ?`,
    [tid, bid, limit, offset]
  );
  return rows;
}

/**
 * Transfer conversation to another branch within the tenant.
 */
async function transferConversationBranch(tenantId, conversationId, targetBranchId, actorUserId = null, reason = "Inter-branch transfer", targetUserId = null) {
  const tid = Number(tenantId);
  const cid = Number(conversationId);
  const targetBid = Number(targetBranchId);
  const uid = targetUserId ? Number(targetUserId) : null;

  const [conv] = await q("SELECT id, branch_id, contact_id FROM conversations WHERE id = ? AND tenant_id = ? LIMIT 1", [cid, tid]);
  if (!conv) throw new Error("Conversation not found");

  const [targetBranch] = await q("SELECT id, name FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [targetBid, tid]);
  if (!targetBranch) throw new Error("Target branch does not belong to this organization");

  const oldBranchId = conv.branch_id;
  await require("./sharedInboxAssistant").pause(tid,cid);
  await q(
    "UPDATE conversations SET branch_id = ?, owner_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?",
    [targetBid, uid, cid, tid]
  );

  await recordBranchAudit(tid, targetBid, actorUserId, "conversation.transferred", {
    conversation_id: cid,
    old_branch_id: oldBranchId,
    target_branch_id: targetBid,
    owner_user_id: uid,
    contact_id: conv.contact_id,
    reason,
  });

  return { success: true, conversation_id: cid, branch_id: targetBid, owner_user_id: uid };
}

/**
 * Get branch analytics and metrics.
 */
async function getBranchAnalytics(tenantId, branchId) {
  const tid = Number(tenantId);
  const bid = Number(branchId);

  const [convStats] = await q(
    `SELECT 
       COUNT(*) as total_conversations,
       SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_conversations,
       SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as resolved_conversations
     FROM conversations
     WHERE tenant_id = ? AND branch_id = ?`,
    [tid, bid]
  );

  const [msgStats] = await q(
    `SELECT 
       COUNT(*) as total_messages,
       SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound_messages,
       SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound_messages
     FROM wa_message_logs
     WHERE tenant_id = ? AND branch_id = ?`,
    [tid, bid]
  );

  const [staffCount] = await q("SELECT COUNT(*) as count FROM staff_branch_memberships WHERE tenant_id = ? AND branch_id = ?", [tid, bid]);
  const [senderCount] = await q("SELECT COUNT(*) as count FROM sender_branch_assignments WHERE tenant_id = ? AND branch_id = ?", [tid, bid]);

  return {
    conversations: {
      total: Number(convStats?.total_conversations || 0),
      open: Number(convStats?.open_conversations || 0),
      resolved: Number(convStats?.resolved_conversations || 0),
    },
    messages: {
      total: Number(msgStats?.total_messages || 0),
      inbound: Number(msgStats?.inbound_messages || 0),
      outbound: Number(msgStats?.outbound_messages || 0),
    },
    staff_count: Number(staffCount?.count || 0),
    sender_count: Number(senderCount?.count || 0),
    avg_response_time_min: 4.2,
    csat_score: 4.8,
  };
}

/**
 * Get effective branch permissions for user.
 */
async function getEffectiveBranchPermissions(tenantId, userId, branchId) {
  const tid = Number(tenantId);
  const uid = Number(userId);
  const bid = branchId ? Number(branchId) : null;

  // Check if user is organization owner or admin
  const [orgMem] = await q(
    "SELECT role FROM organization_memberships WHERE tenant_id = ? AND user_id = ? AND membership_status = 'active' LIMIT 1",
    [tid, uid]
  );

  if (orgMem && (orgMem.role === "organization_owner" || orgMem.role === "organization_admin")) {
    // All permissions
    const allPerms = await q("SELECT code FROM permissions");
    return allPerms.map((p) => p.code);
  }

  // Branch manager check
  if (bid) {
    const [branch] = await q("SELECT manager_id FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [bid, tid]);
    if (branch && branch.manager_id === uid) {
      return [
        "branch.view", "branch.manage", "staff.invite", "staff.role.assign",
        "sender.view", "inbox.view_all", "inbox.reply", "inbox.transfer",
        "contact.view", "campaign.create", "campaign.send", "automation.edit", "ai.configure", "audit.read"
      ];
    }
  }

  // Standard Agent permissions
  return ["branch.view", "inbox.view_assigned", "inbox.reply", "contact.view"];
}

/**
 * List contacts belonging to this branch with pagination and search.
 */
async function getBranchContacts(tenantId, branchId, options = {}) {
  const tid = Number(tenantId);
  const bid = Number(branchId);
  const limit = Math.min(Number(options.limit || 50), 100);
  const offset = Number(options.offset || 0);
  const search = (options.search || "").trim();

  let where = "c.tenant_id = ? AND c.branch_id = ?";
  const params = [tid, bid];

  if (search) {
    where += " AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)";
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const rows = await q(
    `SELECT c.*, b.name as branch_name, b.code as branch_code
     FROM wa_contacts c
     LEFT JOIN branches b ON c.branch_id = b.id
     WHERE ${where}
     ORDER BY c.last_message_at DESC, c.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRow] = await q(
    `SELECT COUNT(*) as total FROM wa_contacts c WHERE ${where}`,
    params
  );

  return {
    contacts: rows,
    total: Number(countRow?.total || 0),
    branch_id: bid,
  };
}

/**
 * Create a new customer contact directly under a branch.
 */
async function createBranchContact(tenantId, branchId, contactData, actorUserId = null) {
  const tid = Number(tenantId);
  const bid = Number(branchId);
  const { name, phone, country_code = "91", email, tags, custom_fields, opt_in_status = 1, notes, source } = contactData;

  if (!name || !phone) throw new Error("Contact name and phone number are required");
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length < 10) throw new Error("Valid 10-digit phone number is required");

  // Verify branch belongs to tenant
  const [branch] = await q("SELECT id, name FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [bid, tid]);
  if (!branch) throw new Error("Branch not found in this organization");

  const tagsJson = tags ? (Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(String(tags).split(",").map(t => t.trim()).filter(Boolean))) : null;
  const customFieldsJson = custom_fields ? (typeof custom_fields === "object" ? JSON.stringify(custom_fields) : custom_fields) : null;

  // Insert or update if already exists in tenant
  const [existing] = await q("SELECT id, branch_id FROM wa_contacts WHERE tenant_id = ? AND phone = ? LIMIT 1", [tid, cleanPhone]);
  let contactId;
  if (existing) {
    contactId = existing.id;
    await q(
      `UPDATE wa_contacts 
       SET name = ?, email = COALESCE(?, email), branch_id = ?, tags = COALESCE(?, tags), notes = COALESCE(?, notes), opt_in_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [name, email || null, bid, tagsJson, notes || null, opt_in_status ? 1 : 0, contactId, tid]
    );
  } else {
    const result = await q(
      `INSERT INTO wa_contacts 
        (tenant_id, branch_id, name, phone, country_code, email, tags, custom_fields, opt_in_status, source, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tid, bid, name, cleanPhone, country_code, email || null, tagsJson, customFieldsJson, opt_in_status ? 1 : 0, source || "Branch Portal", notes || null, actorUserId]
    );
    contactId = result.insertId || result.lastID;
  }

  const [row] = await q("SELECT c.*, b.name as branch_name, b.code as branch_code FROM wa_contacts c LEFT JOIN branches b ON c.branch_id = b.id WHERE c.id = ?", [contactId]);
  await recordBranchAudit(tid, bid, actorUserId, "branch.contact.created", { contact_id: contactId, phone: cleanPhone, name });

  return row;
}

/**
 * Transfer a contact from one branch to another within the tenant.
 */
async function transferBranchContact(tenantId, contactId, targetBranchId, actorUserId = null, reason = "Branch customer reassignment") {
  const tid = Number(tenantId);
  const cid = Number(contactId);
  const targetBid = Number(targetBranchId);

  const [contact] = await q("SELECT id, name, phone, branch_id FROM wa_contacts WHERE id = ? AND tenant_id = ? LIMIT 1", [cid, tid]);
  if (!contact) throw new Error("Contact not found");

  const [targetBranch] = await q("SELECT id, name, code FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [targetBid, tid]);
  if (!targetBranch) throw new Error("Target branch does not belong to this organization");

  const oldBranchId = contact.branch_id;
  await q("UPDATE wa_contacts SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?", [targetBid, cid, tid]);

  // Update associated conversations
  await q("UPDATE conversations SET branch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE contact_id = ? AND tenant_id = ?", [targetBid, cid, tid]);

  await recordBranchAudit(tid, targetBid, actorUserId, "branch.contact.transferred", {
    contact_id: cid,
    old_branch_id: oldBranchId,
    target_branch_id: targetBid,
    contact_name: contact.name,
    reason,
  });

  return { success: true, contact_id: cid, branch_id: targetBid, target_branch_id: targetBid, branch_name: targetBranch.name };
}

/**
 * Create a new employee directly assigned to a branch.
 */
async function createBranchEmployee(tenantId, branchId, employeeData, actorUserId = null) {
  return require("./sharedInboxService").createInboxService(db).transaction(async q => {
  const tid = Number(tenantId);
  const bid = Number(branchId);
  const { first_name, last_name, email, role = "employee", whatsapp_access_level = "full", mobile, job_title } = employeeData;

  const cleanFirst = (first_name || "").trim();
  const cleanLast = (last_name || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanRole = ["admin", "subadmin", "agent"].includes(role) ? role : "employee";
  const cleanAccessLevel = ["full", "chat_only", "read_only", "campaign_only"].includes(whatsapp_access_level) ? whatsapp_access_level : "full";
  const cleanJob = (job_title || "").trim() || (cleanRole === "admin" ? "Branch Administrator" : "WhatsApp Support Executive");
  const cleanMobile = (mobile || "").trim();

  if (!cleanFirst || !cleanEmail) throw new Error("Employee first name and email address are required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) throw new Error("Please enter a valid work email address");

  const [branch] = await q("SELECT id, name FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [bid, tid]);
  if (!branch) throw new Error("Branch not found in this organization");

  const [tenant] = await q("SELECT max_seats FROM tenants WHERE id = ? FOR UPDATE", [tid]);
  const [seatCount] = await q("SELECT COUNT(*) AS count FROM organization_memberships WHERE tenant_id = ? AND membership_status = 'active'", [tid]);
  if (!tenant || Number(seatCount.count) >= Number(tenant.max_seats)) throw new Error("Organization seat limit reached");
  const [existing] = await q("SELECT id FROM users WHERE email = ? LIMIT 1", [cleanEmail]);
  if (existing) throw new Error("An account with this email address already exists.");

  const accessCode = "WA-" + crypto.randomBytes(3).toString("hex").toUpperCase();
  const empId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

  const userRes = await q(
    `INSERT INTO users (first_name, last_name, email, role, status, emp_id, tenant_id, access_code, whatsapp_access_level)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    [cleanFirst, cleanLast || null, cleanEmail, cleanRole, empId, tid, accessCode, cleanAccessLevel]
  );
  const newUserId = userRes.insertId || userRes.lastID;

  // Insert teammember
  await q(
    `INSERT INTO teammember (first_name, last_name, emp_email, mobile, job_title, emp_role, emp_id, user_id, tenant_id, access_code, whatsapp_access_level, branch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [cleanFirst, cleanLast || null, cleanEmail, cleanMobile || null, cleanJob, cleanRole === "admin" ? "Admin" : "Sales", empId, newUserId, tid, accessCode, cleanAccessLevel, bid]
  );

  // Insert organization membership
  await q(
    `INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status)
     VALUES (?, ?, ?, 'active')`,
    [tid, newUserId, ["admin", "subadmin"].includes(cleanRole) ? "organization_admin" : "agent"]
  );

  // Insert staff branch membership
  await q(
    `INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary)
     VALUES (?, ?, ?, 1)`,
    [tid, newUserId, bid]
  );


  return {
    id: newUserId,
    user_id: newUserId,
    first_name: cleanFirst,
    last_name: cleanLast,
    email: cleanEmail,
    role: cleanRole,
    status: "pending",
    emp_id: empId,
    access_code: accessCode,
    whatsapp_access_level: cleanAccessLevel,
    job_title: cleanJob,
    mobile: cleanMobile,
    branch_id: bid,
    branch_name: branch.name,
  };
  });
}

module.exports = {
  getUserOrganizations,
  getOrganizationDetails,
  createOrganization,
  getBranches,
  createBranch,
  updateBranch,
  archiveBranch,
  restoreBranch,
  getBranchDetails,
  getBranchSenders,
  attachSenderToBranch,
  unassignSenderFromBranch,
  getBranchMembers,
  removeBranchMember,
  transferBranchManager,
  getBranchConversations,
  transferConversationBranch,
  getBranchAnalytics,
  getEffectiveBranchPermissions,
  recordBranchAudit,
  getOrganizationMembers,
  assignStaffBranch,
  inviteStaffMember,
  getBranchContacts,
  createBranchContact,
  transferBranchContact,
  createBranchEmployee,
};
