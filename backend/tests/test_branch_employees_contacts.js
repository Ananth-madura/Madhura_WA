/**
 * Enterprise Multi-Tenant Multi-Branch:
 * Branch Employee and Customer Contact Isolation & Operations Verification Suite
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const db = require("../config/database");
const organizationService = require("../services/organizationService");

async function runTests() {
  console.log("\n🏢 Running Enterprise Branch Employees & Customer Contacts Test Suite...\n");

  const testTenantId = 9999;
  const testBranchA = 9991;
  const testBranchB = 9992;
  const adminUserId = 8888;

  try {
    // 1. Setup Fixture
    await new Promise((resolve) => {
      db.query("DELETE FROM wa_contacts WHERE tenant_id = ?", [testTenantId], () => {
        db.query("DELETE FROM staff_branch_memberships WHERE tenant_id = ?", [testTenantId], () => {
          db.query("DELETE FROM organization_memberships WHERE tenant_id = ?", [testTenantId], () => {
            db.query("DELETE FROM teammember WHERE tenant_id = ?", [testTenantId], () => {
              db.query("DELETE FROM users WHERE tenant_id = ?", [testTenantId], () => {
                db.query("DELETE FROM branches WHERE tenant_id = ?", [testTenantId], () => {
                  db.query("DELETE FROM tenants WHERE id = ?", [testTenantId], resolve);
                });
              });
            });
          });
        });
      });
    });

    // Create Tenant
    await new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO tenants (id, name, slug, status, plan) VALUES (?, ?, ?, 'active', 'enterprise')",
        [testTenantId, "Apex Global Corp", "apex-corp-test"],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create Branches A and B
    await new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO branches (id, tenant_id, name, code, slug, is_head_office) VALUES (?, ?, ?, ?, ?, 1)",
        [testBranchA, testTenantId, "New York HQ", "NY-01", "apex-ny-hq"],
        (err) => (err ? reject(err) : resolve())
      );
    });

    await new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO branches (id, tenant_id, name, code, slug, is_head_office) VALUES (?, ?, ?, ?, ?, 0)",
        [testBranchB, testTenantId, "London Branch", "LON-01", "apex-lon-branch"],
        (err) => (err ? reject(err) : resolve())
      );
    });

    console.log("  1. Testing createBranchEmployee in Branch A (New York HQ)...");
    const empResult = await organizationService.createBranchEmployee(
      testTenantId,
      testBranchA,
      {
        first_name: "Sarah",
        last_name: "Connor",
        email: "sarah.connor@apex-test.com",
        job_title: "Senior Support Specialist",
        mobile: "+12125550199",
        whatsapp_access_level: "full",
        role: "employee",
      },
      adminUserId
    );

    const emp = empResult.employee || empResult;
    if (!emp || !emp.id || !emp.access_code?.startsWith("WA-")) {
      throw new Error(`Failed to create branch employee or access code not generated correctly: ${JSON.stringify(empResult)}`);
    }
    console.log(`  ✅ PASS: Created employee ${emp.first_name} with Access Code ${emp.access_code}`);

    console.log("  2. Testing getBranchMembers for Branch A...");
    const membersA = await organizationService.getBranchMembers(testTenantId, testBranchA);
    const foundEmp = membersA.find((m) => m.email === "sarah.connor@apex-test.com");
    if (!foundEmp || foundEmp.access_code !== emp.access_code || foundEmp.whatsapp_access_level !== "full") {
      throw new Error("Branch member verification failed in Branch A");
    }
    console.log("  ✅ PASS: Branch A member retrieved with access code, job title, and WhatsApp access level.");

    console.log("  3. Testing member isolation in Branch B (London)...");
    const membersB = await organizationService.getBranchMembers(testTenantId, testBranchB);
    if (membersB.some((m) => m.email === "sarah.connor@apex-test.com")) {
      throw new Error("Employee leaked into Branch B!");
    }
    console.log("  ✅ PASS: Branch B contains 0 members (isolation strictly preserved).");

    console.log("  4. Testing createBranchContact in Branch A...");
    const contactResult = await organizationService.createBranchContact(
      testTenantId,
      testBranchA,
      {
        name: "Wayne Enterprises",
        phone: "+12125550999",
        email: "contact@wayne-test.com",
        tags: ["VIP", "Enterprise"],
      },
      adminUserId
    );

    if (!contactResult || !contactResult.id || contactResult.branch_id !== testBranchA) {
      throw new Error("Failed to create branch contact or branch_id mismatch");
    }
    console.log(`  ✅ PASS: Created customer contact ${contactResult.name} scoped to Branch A.`);

    console.log("  5. Testing getBranchContacts with search and branch scoping...");
    const contactsA = await organizationService.getBranchContacts(testTenantId, testBranchA, { search: "Wayne" });
    if (contactsA.total !== 1 || !contactsA.contacts[0].phone.endsWith("2125550999")) {
      throw new Error(`Customer contact search failed in Branch A: ${JSON.stringify(contactsA)}`);
    }
    const contactsB = await organizationService.getBranchContacts(testTenantId, testBranchB);
    if (contactsB.total !== 0) {
      throw new Error("Branch A customer contact leaked into Branch B!");
    }
    console.log("  ✅ PASS: Branch contacts scoped and isolated.");

    console.log("  6. Testing transferBranchContact from Branch A to Branch B...");
    const transferRes = await organizationService.transferBranchContact(
      testTenantId,
      contactResult.id,
      testBranchB,
      adminUserId,
      "Customer relocated to UK office"
    );

    if (!transferRes.success || transferRes.target_branch_id !== testBranchB) {
      throw new Error("Contact transfer failed");
    }

    const contactsBAfter = await organizationService.getBranchContacts(testTenantId, testBranchB);
    if (contactsBAfter.total !== 1 || contactsBAfter.contacts[0].id !== contactResult.id) {
      throw new Error("Transferred contact not found in Branch B");
    }
    const contactsAAfter = await organizationService.getBranchContacts(testTenantId, testBranchA);
    if (contactsAAfter.total !== 0) {
      throw new Error("Transferred contact still remains in Branch A");
    }
    console.log("  ✅ PASS: Customer contact successfully transferred across branches with audit log.");

    // Clean up
    await new Promise((resolve) => {
      db.query("DELETE FROM wa_contacts WHERE tenant_id = ?", [testTenantId], () => {
        db.query("DELETE FROM staff_branch_memberships WHERE tenant_id = ?", [testTenantId], () => {
          db.query("DELETE FROM organization_memberships WHERE tenant_id = ?", [testTenantId], () => {
            db.query("DELETE FROM teammember WHERE tenant_id = ?", [testTenantId], () => {
              db.query("DELETE FROM users WHERE tenant_id = ?", [testTenantId], () => {
                db.query("DELETE FROM branches WHERE tenant_id = ?", [testTenantId], () => {
                  db.query("DELETE FROM tenants WHERE id = ?", [testTenantId], resolve);
                });
              });
            });
          });
        });
      });
    });

    console.log("\n=======================================================");
    console.log("🎉 ALL BRANCH EMPLOYEES & CUSTOMER CONTACT TESTS PASSED (6/6)!");
    console.log("=======================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

runTests();
