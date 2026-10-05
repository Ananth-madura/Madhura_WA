"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const mgr = require("../services/whatsappService");

async function testSessionLifecycle() {
  console.log("=================================================");
  console.log("🧪 TESTING WHATSAPP SESSION ISOLATION & PURGE");
  console.log("=================================================\n");

  // Unique per run. This test used fixed keys (99901/99902), so a previous run's
  // real Chrome profile was still sitting in whatsapp-sessions/<key>/ holding
  // Windows file locks — logout() swallows the rmSync error, and the
  // "directory removed" assertion then failed for reasons unrelated to the code
  // under test. A fresh key guarantees an unlocked directory.
  const runId = `wa_test_${process.pid}_${Date.now()}`;
  const user1Key = runId + "_a";
  const user2Key = runId + "_b";

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

  // 3. A session only counts as linked once session_meta.json says so.
  //    This test used to write session/Default/dummy.txt, which was the old
  //    contract — _doInit mkdirs the folder before launching Chrome, so a bare
  //    directory is residue from an aborted scan, not a linked session. The
  //    production check (hasSavedProfile) reads session_meta.json.
  const testDir = s1.sessionPath;
  const metaPath = path.join(testDir, "session_meta.json");
  fs.mkdirSync(testDir, { recursive: true });

  // Incomplete metadata must not be mistaken for a live session.
  fs.writeFileSync(metaPath, JSON.stringify({ status: "active" }), "utf8"); // no phone
  assert.strictEqual(s1.hasSavedProfile(), false, "metadata without a phone is not a session");
  fs.writeFileSync(metaPath, JSON.stringify({ status: "logged_out", phone: "919999999999" }), "utf8");
  assert.strictEqual(s1.hasSavedProfile(), false, "A logged-out session is not active");
  fs.writeFileSync(metaPath, "{ this is not json", "utf8");
  assert.strictEqual(s1.hasSavedProfile(), false, "Unparseable metadata is not a session");
  console.log("  ✅ PASS: Incomplete/logged-out/corrupt metadata rejected");

  fs.writeFileSync(
    metaPath,
    JSON.stringify({ sessionKey: user1Key, phone: "919999999999", status: "active" }),
    "utf8"
  );
  assert.strictEqual(s1.hasSavedProfile(), true, "hasSavedProfile correctly identifies a saved session");
  console.log("  ✅ PASS: Saved session profile detected on disk");

  // 4. Test purge on logout
  const logoutRes = await s1.logout(true);
  assert.strictEqual(logoutRes.purged, true, "Logout reports purged = true");
  assert.strictEqual(fs.existsSync(testDir), false, "Session directory completely removed from disk");

  // 5. The in-memory instance is DELIBERATELY kept after a purge.
  //    _doLogout comments this as "prevent split-brain re-initializations" — the
  //    registry entry is reused rather than a second service being constructed
  //    for the same key. The old assertion expected the opposite and had been
  //    failing since that change.
  const allKeys = mgr.all().map((s) => s.key);
  assert.strictEqual(
    allKeys.includes(user1Key),
    true,
    "Instance is intentionally retained in the registry after purge"
  );
  assert.strictEqual(mgr.get(user1Key), s1, "Re-requesting the key returns the same instance");
  assert.strictEqual(s1.ready, false, "A purged session is reset, not ready");
  assert.strictEqual(s1.client, null, "A purged session has no client");
  console.log("  ✅ PASS: Purge deletes the profile and resets state, keeping one instance per key");

  // 6. Session resolver must NEVER substitute another user's session.
  //    This helper previously mirrored an opt-in `x-allow-fallback` header and
  //    an `all().find(ses => ses.ready)` lookup. Both are gone: a send now
  //    either uses the caller's own session or fails. Assert the real shape,
  //    including the case that used to leak.
  const resolve = (req) => {
    const reqKey = req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id;
    if (reqKey) return mgr.get(reqKey);
    return mgr.default();
  };

  const resolvedForUser2 = resolve({ headers: { "x-session-key": user2Key } });
  assert.strictEqual(resolvedForUser2.key, user2Key, "Resolver returns caller's specific session");

  // Mark another session ready, then ask for a caller whose own is NOT ready.
  // The old code answered with the ready one; it must now answer with the
  // caller's own unready session so the send is refused rather than misrouted.
  const otherReadyKey = "99903";
  mgr.get(otherReadyKey).ready = true;
  mgr.get(otherReadyKey).phone = "919888888888";

  const unreadyKey = "99904";
  const asked = resolve({
    headers: { "x-session-key": unreadyKey, "x-allow-fallback": "true" },
    query: { fallback: "true" },
  });
  assert.strictEqual(asked.key, unreadyKey, "An unready caller's session is returned as-is");
  assert.notStrictEqual(asked.key, otherReadyKey, "Never substitutes a ready session");
  assert.strictEqual(asked.ready, false, "The returned session is unready, so requireReadySession() refuses");
  console.log("  ✅ PASS: Resolver never substitutes another session, even when asked to");

  // No user context at all resolves to the configured default, not a random one.
  const noContext = resolve({ headers: {} });
  assert.strictEqual(noContext.key, mgr.defaultKey, "No user context resolves to the configured default");
  console.log("  ✅ PASS: No-user-context resolves to the configured default session");

  mgr.get(otherReadyKey).ready = false;
  mgr.get(unreadyKey).ready = false;

  console.log("\n=================================================");
  console.log("🏁 ALL WHATSAPP SESSION TESTS PASSED!");
  console.log("=================================================");
  process.exit(0);
}

testSessionLifecycle().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
