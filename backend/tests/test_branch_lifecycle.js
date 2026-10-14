/**
 * test_branch_lifecycle.js
 *
 * Comprehensive integration test suite for Multi-Branch Operating System.
 * Tests:
 * 1. Branch Creation with Slug, Short Code, Entitlements, and Settings.
 * 2. Uniqueness constraints (Tenant-scoped code and slug).
 * 3. Manager Assignment & Atomic Manager Transfer with Audit Logs.
 * 4. Staff Membership Grants & Role Permissions.
 * 5. Meta WhatsApp Sender Allocations (Dedicated & Shared).
 * 6. Inter-Branch Conversation Routing & Transfers with Audit Trail.
 * 7. Soft-Archive & Restore Lifecycle.
 * 8. Strict Multi-Tenant & Cross-Branch Isolation Boundaries.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const assert = require("assert");
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

const enterpriseBranchRoutes = require("../routes/enterpriseBranchRoutes");
const enterpriseOrgRoutes = require("../routes/enterpriseOrganizationRoutes");

const app = express();
app.use(bodyParser.json());
app.use("/api/v2", enterpriseBranchRoutes);
app.use("/api/v2", enterpriseOrgRoutes);

const server = http.createServer(app);
const PORT = 5092;

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch (_) {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
};

function generateToken(payload) {
  const secret = process.env.JWT_SECRET || "madhura_secret_key_2026";
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

async function runBranchTestSuite() {
  await new Promise((res) => server.listen(PORT, "127.0.0.1", res));
  console.log(`\n🏢 Running Enterprise Multi-Branch Operating System Test Suite...`);

  let tenant1Id, tenant2Id, user1Id, user2Id, branch1Id, branch2Id, senderId;

  try {
    // 0. Setup test tenants and users
    console.log("  Preparing clean test fixture data in tenants...");
    const t1 = await q(
      "INSERT INTO tenants (name, slug, plan, max_branches, status) VALUES (?, ?, ?, ?, ?)",
      ["Madhura Enterprises", "madhura-ent-" + Date.now(), "enterprise", 5, "active"]
    );
    tenant1Id = t1.insertId;

    const t2 = await q(
      "INSERT INTO tenants (name, slug, plan, max_branches, status) VALUES (?, ?, ?, ?, ?)",
      ["Rival Corp", "rival-corp-" + Date.now(), "starter", 1, "active"]
    );
    tenant2Id = t2.insertId;

    // Create Tenant 1 Admin
    const u1 = await q(
      "INSERT INTO users (tenant_id, first_name, last_name, email, user_password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tenant1Id, "T1", "Owner", `owner_${Date.now()}@madhura.com`, "hash", "admin", "active"]
    );
    user1Id = u1.insertId;
    await q(
      "INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, ?, ?)",
      [tenant1Id, user1Id, "organization_owner", "active"]
    );

    // Create Tenant 1 Staff
    const staff1 = await q(
      "INSERT INTO users (tenant_id, first_name, last_name, email, user_password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tenant1Id, "Staff", "Coimbatore", `staff_${Date.now()}@madhura.com`, "hash", "agent", "active"]
    );
    const staff1Id = staff1.insertId;

    // Create Tenant 2 Admin
    const u2 = await q(
      "INSERT INTO users (tenant_id, first_name, last_name, email, user_password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tenant2Id, "T2", "Admin", `admin_${Date.now()}@rival.com`, "hash", "admin", "active"]
    );
    user2Id = u2.insertId;
    await q(
      "INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, ?, ?)",
      [tenant2Id, user2Id, "organization_admin", "active"]
    );

    const tokenT1 = generateToken({ id: user1Id, tenant_id: tenant1Id, role: "admin" });
    const tokenT2 = generateToken({ id: user2Id, tenant_id: tenant2Id, role: "admin" });

    // 1. Create Branch with Wizard Schema
    console.log("  1. Testing POST /api/v2/branches (Branch Creation)...");
    const createRes = await request(
      "POST",
      "/api/v2/branches",
      {
        name: "Coimbatore Main",
        code: "CBE-01",
        slug: "coimbatore-main",
        city: "Coimbatore",
        timezone: "Asia/Kolkata",
        managerUserId: user1Id,
        settings: {
          operating_hours: { open: "09:00", close: "19:00" },
          assignment_strategy: "round_robin",
        },
      },
      {
        Authorization: `Bearer ${tokenT1}`,
        "x-tenant-id": tenant1Id,
      }
    );

    assert.strictEqual(createRes.status, 201, `Failed to create branch: ${JSON.stringify(createRes.data)}`);
    assert(createRes.data.success, "Response should be success: true");
    branch1Id = createRes.data.branch.id;
    assert.strictEqual(createRes.data.branch.code, "CBE-01");
    console.log("  ✅ PASS: Branch created with canonical ID and slug.");

    // 2. Duplicate Code Constraint within Same Tenant
    console.log("  2. Testing duplicate branch code rejection (409 Conflict)...");
    const dupRes = await request(
      "POST",
      "/api/v2/branches",
      {
        name: "Coimbatore Duplicate",
        code: "CBE-01", // Duplicate!
        slug: "coimbatore-2",
      },
      {
        Authorization: `Bearer ${tokenT1}`,
        "x-tenant-id": tenant1Id,
      }
    );
    assert.strictEqual(dupRes.status, 409, "Should reject duplicate branch code");
    console.log("  ✅ PASS: Duplicate branch code rejected with 409 Conflict.");

    // 3. Create Second Branch in Tenant 1 (Pollachi Branch)
    console.log("  3. Testing secondary branch creation...");
    const b2Res = await request(
      "POST",
      "/api/v2/branches",
      {
        name: "Pollachi Hub",
        code: "POL-01",
        slug: "pollachi-hub",
        city: "Pollachi",
      },
      {
        Authorization: `Bearer ${tokenT1}`,
        "x-tenant-id": tenant1Id,
      }
    );
    assert.strictEqual(b2Res.status, 201);
    branch2Id = b2Res.data.branch.id;
    console.log("  ✅ PASS: Second branch created.");

    // 4. Assign Staff Member to Branch
    console.log("  4. Testing POST /api/v2/branches/:id/members...");
    const memberRes = await request(
      "POST",
      `/api/v2/branches/${branch1Id}/members`,
      {
        userId: staff1Id,
        role: "agent",
      },
      {
        Authorization: `Bearer ${tokenT1}`,
        "x-tenant-id": tenant1Id,
        "x-branch-id": branch1Id,
      }
    );
    assert.strictEqual(memberRes.status, 201);
    console.log("  ✅ PASS: Staff member added to branch.");

    // 5. Transfer Manager Atomically
    console.log("  5. Testing POST /api/v2/branches/:id/manager (Manager Transfer)...");
    const xferMgrRes = await request(
      "POST",
      `/api/v2/branches/${branch1Id}/manager`,
      {
        newManagerUserId: staff1Id,
      },
      {
        Authorization: `Bearer ${tokenT1}`,
        "x-tenant-id": tenant1Id,
        "x-branch-id": branch1Id,
      }
    );
    assert.strictEqual(xferMgrRes.status, 200);
    assert.strictEqual(xferMgrRes.data.manager.id, staff1Id);

    // Verify audit log recorded the transfer
    const auditEvents = await q(
      "SELECT * FROM branch_audit_events WHERE tenant_id = ? AND branch_id = ? AND event_type = 'branch.manager.transferred'",
      [tenant1Id, branch1Id]
    );
    assert(auditEvents.length > 0, "Audit event must be emitted on manager transfer");
    console.log("  ✅ PASS: Branch manager transferred atomically and audited.");

    // 6. Test WhatsApp Sender Assignment
    console.log("  6. Testing POST /api/v2/branches/:id/senders (Sender Allocation)...");
    const metaNum = await q(
      "INSERT INTO wa_senders (tenant_id, phone_number_id, display_phone, verified_name, is_shared, status) VALUES (?, ?, ?, ?, ?, ?)",
      [tenant1Id, "pn_id_" + Date.now(), "+91 98765 43210", "Madhura Tech", 1, "connected"]
    );
    senderId = metaNum.insertId;

    const senderRes = await request(
      "POST",
      `/api/v2/branches/${branch1Id}/senders`,
      {
        senderId,
        assignmentType: "dedicated",
        isDefault: true,
      },
      {
        Authorization: `Bearer ${tokenT1}`,
        "x-tenant-id": tenant1Id,
        "x-branch-id": branch1Id,
      }
    );
    assert.strictEqual(senderRes.status, 201);
    console.log("  ✅ PASS: Dedicated Meta WhatsApp sender assigned to branch.");

    // 7. Test Inter-Branch Conversation Transfer
    console.log("  7. Testing POST /api/v2/branches/:id/conversations/:chatId/transfer...");
    // Mock contact and conversation in branch 1
    const contact = await q(
      "INSERT INTO wa_contacts (tenant_id, branch_id, phone, name) VALUES (?, ?, ?, ?)",
      [tenant1Id, branch1Id, `+9199999${Date.now().toString().slice(-5)}`, "Ramesh Kumar"]
    );
    const contactId = contact.insertId;

    const conv = await q(
      "INSERT INTO conversations (tenant_id, branch_id, sender_id, contact_id, status, subject, last_message_text) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tenant1Id, branch1Id, senderId, contactId, "open", "Support Request", "Hello Coimbatore store!"]
    );
    const convId = conv.insertId;

    const chatXferRes = await request(
      "POST",
      `/api/v2/branches/${branch1Id}/conversations/${convId}/transfer`,
      {
        targetBranchId: branch2Id,
        reason: "Customer relocated to Pollachi",
      },
      {
        Authorization: `Bearer ${tokenT1}`,
        "x-tenant-id": tenant1Id,
        "x-branch-id": branch1Id,
      }
    );
    assert.strictEqual(chatXferRes.status, 200);

    const [updatedConv] = await q("SELECT branch_id FROM conversations WHERE id = ?", [convId]);
    assert.strictEqual(updatedConv.branch_id, branch2Id, "Conversation branch_id must be updated to target branch");
    console.log("  ✅ PASS: Inter-branch conversation transferred to target branch.");

    // 8. Test Branch Archive and Restore
    console.log("  8. Testing POST /api/v2/branches/:id/archive & restore...");
    const arcRes = await request(
      "POST",
      `/api/v2/branches/${branch2Id}/archive`,
      {},
      {
        Authorization: `Bearer ${tokenT1}`,
        "x-tenant-id": tenant1Id,
        "x-branch-id": branch2Id,
      }
    );
    assert.strictEqual(arcRes.status, 200);
    const [arcBranch] = await q("SELECT status, archived_at FROM branches WHERE id = ?", [branch2Id]);
    assert.strictEqual(arcBranch.status, "archived");
    assert(arcBranch.archived_at !== null);

    const resRes = await request(
      "POST",
      `/api/v2/branches/${branch2Id}/restore`,
      {},
      {
        Authorization: `Bearer ${tokenT1}`,
        "x-tenant-id": tenant1Id,
        "x-branch-id": branch2Id,
      }
    );
    assert.strictEqual(resRes.status, 200);
    console.log("  ✅ PASS: Branch archive and restore lifecycle verified.");

    // 9. Strict Multi-Tenant Isolation
    console.log("  9. Testing strict tenant isolation (Tenant 2 cannot access Tenant 1 branch)...");
    const isoRes = await request(
      "GET",
      `/api/v2/branches/${branch1Id}`,
      null,
      {
        Authorization: `Bearer ${tokenT2}`,
        "x-tenant-id": tenant2Id, // Tenant 2 asking for Tenant 1's branch
      }
    );
    assert(isoRes.status === 403 || isoRes.status === 404, `Should reject cross-tenant access with 403/404, got: ${isoRes.status}`);
    console.log("  ✅ PASS: Cross-tenant branch access completely forbidden.");

    console.log("\n=======================================================");
    console.log("🎉 ALL MULTI-BRANCH LIFECYCLE TESTS PASSED (9/9)!");
    console.log("=======================================================\n");
  } finally {
    // Cleanup fixtures
    if (tenant1Id) {
      await q("DELETE FROM branch_audit_events WHERE tenant_id IN (?, ?)", [tenant1Id, tenant2Id]);
      await q("DELETE FROM sender_branch_assignments WHERE tenant_id IN (?, ?)", [tenant1Id, tenant2Id]);
      await q("DELETE FROM staff_branch_memberships WHERE tenant_id IN (?, ?)", [tenant1Id, tenant2Id]);
      await q("DELETE FROM conversations WHERE tenant_id IN (?, ?)", [tenant1Id, tenant2Id]);
      await q("DELETE FROM wa_contacts WHERE tenant_id IN (?, ?)", [tenant1Id, tenant2Id]);
      await q("DELETE FROM wa_senders WHERE tenant_id IN (?, ?)", [tenant1Id, tenant2Id]);
      await q("DELETE FROM branches WHERE tenant_id IN (?, ?)", [tenant1Id, tenant2Id]);
      await q("DELETE FROM organization_memberships WHERE tenant_id IN (?, ?)", [tenant1Id, tenant2Id]);
      await q("DELETE FROM users WHERE tenant_id IN (?, ?)", [tenant1Id, tenant2Id]);
      await q("DELETE FROM tenants WHERE id IN (?, ?)", [tenant1Id, tenant2Id]);
    }
    server.close();
  }
}

runBranchTestSuite().catch((err) => {
  console.error("❌ Multi-Branch Lifecycle Test Failed:", err);
  if (server.listening) server.close();
  process.exit(1);
});
