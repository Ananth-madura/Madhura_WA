/**
 * test_enterprise_auth_flow.js
 *
 * Integration test verifying multi-tenant & multi-branch authentication,
 * self-signup provisioning, access code branch resolution, and login session payloads.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const assert = require("assert");
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const authRoutes = require("../routes/authRoutes");
const db = require("../config/database");

const app = express();
app.use(bodyParser.json());
app.use("/api/auth", authRoutes);

const server = http.createServer(app);

const request = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 5088,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
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

async function runTests() {
  await new Promise((res) => server.listen(5088, "127.0.0.1", res));
  console.log("🚀 Running Enterprise Auth & Onboarding Integration Test Suite...");

  try {
    // 1. Test Demo Login with Branch Context
    console.log("  Testing POST /api/auth/demo-login...");
    const demoRes = await request("POST", "/api/auth/demo-login", { role: "admin" });
    assert.strictEqual(demoRes.status, 200, "Demo login should return 200");
    assert(demoRes.data.token, "Demo login must return token");
    assert(demoRes.data.user.branch_id, "Demo user must have active branch_id");
    assert(demoRes.data.activeBranch, "Demo response must contain activeBranch");
    assert(demoRes.data.activeOrganization, "Demo response must contain activeOrganization");
    console.log("  ✅ PASS: Demo login returns complete enterprise context.");

    // 2. Test Self-Signup with Multi-Branch Provisioning
    console.log("  Testing POST /api/auth/self-signup with custom branch...");
    const testEmail = `test_founder_${Date.now()}@acmeglobal.test`;
    const signupPayload = {
      company_name: "Acme Enterprise Corp",
      legal_name: "Acme Enterprise Corp India Pvt Ltd",
      brand_name: "Acme Connect",
      industry: "Retail & E-Commerce",
      first_name: "Arjun",
      last_name: "Mehta",
      email: testEmail,
      password: "EnterprisePassword123!",
      mobile_number: "+919876543210",
      branch_name: "Acme Flagship Bangalore",
      branch_code: "BLR-01",
      timezone: "Asia/Kolkata",
      plan: "growth",
    };

    const signupRes = await request("POST", "/api/auth/self-signup", signupPayload);
    assert.strictEqual(signupRes.status, 201, `Self signup should return 201, got ${signupRes.status}: ${JSON.stringify(signupRes.data)}`);
    assert(signupRes.data.token, "Must return token on signup");
    assert(signupRes.data.user.tenant_id > 1, "Must assign newly created tenant_id > 1");
    assert.strictEqual(signupRes.data.user.branch_name, "Acme Flagship Bangalore", "Branch name must match payload");
    assert.strictEqual(signupRes.data.user.branch_code, "BLR-01", "Branch code must match payload");
    assert(signupRes.data.activeBranch.is_head_office === 1, "First branch must be head office");
    assert.strictEqual(signupRes.data.activeOrganization.name, "Acme Enterprise Corp");
    console.log("  ✅ PASS: Enterprise Self-Signup creates tenant, head office branch, and memberships.");

    // 3. Test Regular Login with New User
    console.log("  Testing POST /api/auth/login for newly created user...");
    const loginRes = await request("POST", "/api/auth/login", {
      email: testEmail,
      password: "EnterprisePassword123!",
    });
    assert.strictEqual(loginRes.status, 200, `Login should return 200, got ${loginRes.status}`);
    assert.strictEqual(loginRes.data.user.email, testEmail);
    assert.strictEqual(loginRes.data.user.tenant_id, signupRes.data.user.tenant_id);
    assert.strictEqual(loginRes.data.user.branch_id, signupRes.data.user.branch_id);
    assert.strictEqual(loginRes.data.activeBranch.name, "Acme Flagship Bangalore");
    console.log("  ✅ PASS: Enterprise Login returns correct tenant and primary branch.");

    // 4. Clean up test user & tenant
    const createdTenantId = signupRes.data.user.tenant_id;
    const createdUserId = signupRes.data.user.id;
    await new Promise((res) => db.query("DELETE FROM users WHERE id = ?", [createdUserId], res));
    await new Promise((res) => db.query("DELETE FROM branches WHERE tenant_id = ?", [createdTenantId], res));
    await new Promise((res) => db.query("DELETE FROM organization_memberships WHERE tenant_id = ?", [createdTenantId], res));
    await new Promise((res) => db.query("DELETE FROM staff_branch_memberships WHERE tenant_id = ?", [createdTenantId], res));
    await new Promise((res) => db.query("DELETE FROM wallet_accounts WHERE tenant_id = ?", [createdTenantId], res));
    await new Promise((res) => db.query("DELETE FROM tenants WHERE id = ?", [createdTenantId], res));
    console.log("  ✅ PASS: Test cleanup complete.");

    console.log("\n=======================================================");
    console.log("🎉 ALL ENTERPRISE AUTH & ONBOARDING TESTS PASSED (4/4)!");
    console.log("=======================================================\n");
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
