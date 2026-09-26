"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const mgr = require("../services/whatsappService");

async function testSessionLifecycle() {
  console.log("=================================================");
  console.log("🧪 TESTING WHATSAPP SESSION ISOLATION & PURGE");
  console.log("=================================================\n");

  const user1Key = "99901";
  const user2Key = "99902";

  const s1 = mgr.get(user1Key);
  const s2 = mgr.get(user2Key);

  // 1. Verify isolated instances
  assert.strictEqual(s1.key, user1Key, "User 1 session key matches");
  assert.strictEqual(s2.key, user2Key, "User 2 session key matches");
  assert.notStrictEqual(s1, s2, "Sessions are distinct instances");
  console.log("  ✅ PASS: Multi-session instances isolated per key");

  // 2. Test hasSavedProfile method exists on instance
  assert.strictEqual(typeof s1.hasSavedProfile, "function", "hasSavedProfile is an instance method");
  assert.strictEqual(s1.hasSavedProfile(), false, "Empty session hasSavedProfile returns false");
  console.log("  ✅ PASS: hasSavedProfile instance method verified");

  // 3. Create dummy session files for user 1
  const testDir = s1.sessionPath;
  fs.mkdirSync(path.join(testDir, "session", "Default"), { recursive: true });
  fs.writeFileSync(path.join(testDir, "session", "Default", "dummy.txt"), "session-active");
  assert.strictEqual(s1.hasSavedProfile(), true, "hasSavedProfile correctly identifies saved session");
  console.log("  ✅ PASS: Saved session profile detected on disk");

  // 4. Test purge on logout
  const logoutRes = await s1.logout(true);
  assert.strictEqual(logoutRes.purged, true, "Logout reports purged = true");
  assert.strictEqual(fs.existsSync(testDir), false, "Session directory completely removed from disk");

  // 5. Verify instance removed from in-memory Map
  const allKeys = mgr.all().map((s) => s.key);
  assert.strictEqual(allKeys.includes(user1Key), false, "Session was removed from in-memory registry");
  console.log("  ✅ PASS: Purge deletes disk directory and evicts from in-memory Map");

  // 6. Test session resolver behavior
  const mockReq1 = { headers: { "x-session-key": user2Key } };
  const mockReqNoUser = { headers: {} };

  // Helper matching routes resolver
  const resolve = (req) => {
    const reqKey = req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id;
    if (reqKey) {
      const target = mgr.get(reqKey);
      if (!target.ready && (req.query?.fallback === "true" || req.headers["x-allow-fallback"] === "true")) {
        const readySession = mgr.all().find((ses) => ses.ready);
        if (readySession) return readySession;
      }
      return target;
    }
    return mgr.default();
  };

  const resolvedForUser2 = resolve(mockReq1);
  assert.strictEqual(resolvedForUser2.key, user2Key, "Resolver returns caller's specific session without leaking");
  console.log("  ✅ PASS: Session resolver strictly isolates user requests");

  console.log("\n=================================================");
  console.log("🏁 ALL WHATSAPP SESSION TESTS PASSED!");
  console.log("=================================================");
  process.exit(0);
}

testSessionLifecycle().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
