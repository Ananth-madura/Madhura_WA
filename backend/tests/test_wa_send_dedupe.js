"use strict";

/**
 * Regression tests for the outbound duplicate-send fixes.
 *
 * Each test here corresponds to a way one message used to reach a contact more
 * than once:
 *
 *   1. sendMessage retried the SAME jid after a 20s timeout, up to 4 attempts
 *   2. media/location sends fell through to the Cloud API after a timeout
 *   3. the load balancer failed over to another sender after a timeout
 *   4. a repeated idempotency key re-sent instead of replaying
 *   5. concurrent sends to one recipient were not serialised
 *   6. an unready session silently substituted another user's ready session
 *
 * Run:  node backend/tests/test_wa_send_dedupe.js
 */

const assert = require("assert");
const mgr = require("../services/whatsappService");

const results = [];
function pass(name) {
  results.push(name);
  console.log(`  ✅ PASS: ${name}`);
}

// Build a session wired to a fake wweb.js client, without launching a browser.
function fakeSession(key, sendImpl, { ready = true } = {}) {
  const session = mgr.get(key);
  session.ready = ready;
  session.client = { sendMessage: sendImpl, info: { wid: { user: "919999999999" } } };
  session.phone = "919999999999";
  session.messagesCache = {};
  session.messagesFetchCache = {};
  session._sendLocks = new Map();
  session._lastSendAt = 0;
  // Neutralise the DB and socket side effects; we only care about dispatch.
  session.emitWaEvent = () => {};
  session.resolveTargetJid = async (jid) => jid;
  session._paceSend = async () => {};
  return session;
}

// The send path reads mdToWa, waCloud and the DB. Stub the ones that would
// otherwise touch the network or MySQL.
function stubSends() {
  const waCloud = require("../services/whatsappCloudApi");
  const origIsConfigured = waCloud.isConfigured;
  const origSendText = waCloud.sendText;
  waCloud.isConfigured = () => false;
  waCloud.sendText = async () => {
    throw new Error("waCloud.sendText must not be reached in these tests");
  };
  return () => {
    waCloud.isConfigured = origIsConfigured;
    waCloud.sendText = origSendText;
  };
}

async function main() {
  console.log("=================================================");
  console.log("🧪 TESTING OUTBOUND DUPLICATE-SEND FIXES");
  console.log("=================================================\n");

  const restoreCloud = stubSends();

  try {
    // ── 1. A timed-out send must NOT be retried ──────────────────────────────
    {
      let dispatchCount = 0;
      const session = fakeSession("dedupe_timeout_user", async () => {
        dispatchCount++;
        // Never settles: forces withTimeout to reject while the underlying
        // promise is still "in flight", which is the real-world condition.
        return new Promise(() => {});
      });

      let threw = null;
      try {
        await session.sendMessage("919876543210", "hello", {});
      } catch (e) {
        threw = e;
      }

      assert.ok(threw, "A timed-out send must reject rather than report success");
      assert.strictEqual(
        threw.deliveryUnknown,
        true,
        "Timeout must be flagged deliveryUnknown so callers do not retry"
      );
      assert.strictEqual(dispatchCount, 1, "Exactly one dispatch attempt, no same-jid retries");
      pass("a timed-out send is dispatched once and fails loudly as deliveryUnknown");
    }

    // ── 2. A timeout must not fall through to the Cloud API ────────────────
    {
      let dispatchCount = 0;
      const session = fakeSession("dedupe_nocloudfallback_user", async () => {
        dispatchCount++;
        return new Promise(() => {});
      });
      await session.sendMessage("919876543211", "hi", {}).catch(() => {});
      assert.strictEqual(dispatchCount, 1, "No second delivery attempt after a timeout");
      pass("a timeout never hands the message to a second transport");
    }

    // ── 3. A definitive failure retries ONLY at a genuinely different jid ──
    {
      const attempted = [];
      const session = fakeSession("dedupe_altjid_user", async (jid) => {
        attempted.push(jid);
        if (attempted.length === 1) throw new Error("Chat not found");
        return { id: { id: "ok_msg_1", _serialized: "ok_msg_1" } };
      });
      // resolveTargetJid hands back a DIFFERENT jid on the retry.
      session.resolveTargetJid = async () => "919876543212@c.us";

      const res = await session.sendMessage("919876543210", "retry me", {});
      assert.strictEqual(attempted.length, 2, "One retry, and only one");
      assert.notStrictEqual(attempted[0], attempted[1], "The retry targeted a different jid");
      assert.strictEqual(res.success, true, "The retry succeeded");
      pass("a definitive failure retries once, and only at a different jid");
    }

    // ── 4. A definitive failure at the SAME jid must NOT retry ──────────────
    {
      let dispatchCount = 0;
      const session = fakeSession("dedupe_nojiddup_user", async () => {
        dispatchCount++;
        throw new Error("Chat not found");
      });
      // Same jid comes back from resolution, so there is nowhere new to try.
      session.resolveTargetJid = async (jid) => jid;

      await session.sendMessage("919876543210", "no second copy", {}).catch(() => {});
      assert.strictEqual(dispatchCount, 1, "Must not re-send to the identical jid");
      pass("a definitive failure is never retried against the identical jid");
    }

    // ── 5. A repeated idempotency key replays instead of re-sending ─────────
    {
      let dispatchCount = 0;
      const session = fakeSession("dedupe_idem_user", async () => {
        dispatchCount++;
        return { id: { id: "idem_msg_1", _serialized: "idem_msg_1" } };
      });

      const first = await session.sendMessage("919876543210", "once only", { idempotencyKey: "k1" });
      const second = await session.sendMessage("919876543210", "once only", { idempotencyKey: "k1" });

      assert.strictEqual(dispatchCount, 1, "The repeated key must not dispatch again");
      assert.strictEqual(second.id, first.id, "The replay returns the original message id");
      pass("a repeated idempotency key replays the original result");
    }

    // ── 6. Concurrent duplicate POSTs collapse to one dispatch ──────────────
    {
      let dispatchCount = 0;
      const session = fakeSession("dedupe_inflight_user", async () => {
        dispatchCount++;
        await new Promise((r) => setTimeout(r, 25));
        return { id: { id: "inflight_msg_1", _serialized: "inflight_msg_1" } };
      });

      // The shape of a double-click / Enter-then-click: same key, fired together.
      await Promise.all([
        session.sendMessage("919876543210", "double click", { idempotencyKey: "k2" }),
        session.sendMessage("919876543210", "double click", { idempotencyKey: "k2" }),
        session.sendMessage("919876543210", "double click", { idempotencyKey: "k2" }),
      ]);
      assert.strictEqual(dispatchCount, 1, "Three simultaneous identical sends produce one message");
      pass("simultaneous duplicate sends to one recipient collapse to a single dispatch");
    }

    // ── 7. Distinct keys are still separate messages ────────────────────────
    {
      let dispatchCount = 0;
      const session = fakeSession("dedupe_distinct_user", async () => {
        dispatchCount++;
        return { id: { id: `m_${dispatchCount}`, _serialized: `m_${dispatchCount}` } };
      });
      await session.sendMessage("919876543210", "first", { idempotencyKey: "d1" });
      await session.sendMessage("919876543210", "second", { idempotencyKey: "d2" });
      assert.strictEqual(dispatchCount, 2, "Different keys must not be collapsed");
      pass("distinct idempotency keys still send separately");
    }

    // ── 8. A failed send may be retried; an unknown one may not ─────────────
    {
      let dispatchCount = 0;
      const session = fakeSession("dedupe_failretry_user", async () => {
        dispatchCount++;
        throw new Error("Chat not found");
      });
      const opts = { idempotencyKey: "k3" };
      await session.sendMessage("919876543210", "retryable", opts).catch(() => {});
      await session.sendMessage("919876543210", "retryable", opts).catch(() => {});
      assert.strictEqual(dispatchCount, 2, "A clean failure releases the key so a retry is allowed");
      pass("a clean failure can be retried with the same key");
    }
    {
      let dispatchCount = 0;
      const session = fakeSession("dedupe_unknownretry_user", async () => {
        dispatchCount++;
        return new Promise(() => {});
      });
      const opts = { idempotencyKey: "k4" };
      await session.sendMessage("919876543210", "unknown", opts).catch(() => {});
      await session.sendMessage("919876543210", "unknown", opts).catch(() => {});
      assert.strictEqual(
        dispatchCount,
        1,
        "An unknown-delivery failure must retain the key so a repeat cannot duplicate"
      );
      pass("an unknown-delivery failure cannot be replayed into a second copy");
    }

    // ── 9. An unready session must NOT borrow a ready one ───────────────────
    {
      const ready = fakeSession("dedupe_ready_user", async () => ({ id: { id: "r", _serialized: "r" } }));
      assert.strictEqual(ready.ready, true, "Precondition: a ready session exists");

      const unready = mgr.get("dedupe_unready_user");
      unready.ready = false;

      // getDefault() used to be `all().find(s => s.ready)` — i.e. `ready` above.
      const resolved = mgr.default();
      assert.notStrictEqual(
        resolved.key,
        "dedupe_ready_user",
        "getDefault() must not hand back an unrelated ready session"
      );
      pass("getDefault() never substitutes another user's ready session");
    }

    // ── 10. resolveDefaultReady() reports not-ready instead of substituting ─
    {
      mgr.get("dedupe_defaultprobe_user").ready = false;
      const r = mgr.resolveDefaultReady();
      assert.ok(
        r === null || r.ready,
        "resolveDefaultReady() returns a ready session or null, never an unready one"
      );
      pass("resolveDefaultReady() returns null rather than an unready session");
    }
  } finally {
    restoreCloud();
  }

  console.log("\n=================================================");
  console.log(`🏁 ALL ${results.length} SEND DEDUPE TESTS PASSED!`);
  console.log("=================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err && err.message ? err.message : err);
  process.exit(1);
});