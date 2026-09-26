/**
 * Self-check for the WhatsApp bot gate.
 *
 * No DB, no network, no jest — run directly:
 *     node backend/tests/test_wa_bot_gate.js
 *
 * The bug this guards: `wa_contacts.ai_paused_until` was set by a manual agent
 * reply, by a flow `handoff` node and by the AI handoff tool, but only
 * waAiReply read it. So an agent takeover muted the AI while the flow bot kept
 * talking, and a handoff was undone by the customer's next message. These
 * checks pin the gate's decisions so that cannot regress.
 */
const assert = require("assert");
const db = require("../config/database");
const waBotGate = require("../services/waBotGate");

let passed = 0;
const failures = [];

function ok(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}

// Stub the shared pool so the gate's single SELECT returns a chosen contact row.
function withContact(row, fn) {
  const original = db.promise;
  db.promise = () => ({
    query: async () => [row ? [row] : []],
  });
  return Promise.resolve(fn()).finally(() => {
    db.promise = original;
  });
}

function withQueryError(fn) {
  const original = db.promise;
  db.promise = () => ({
    query: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  return Promise.resolve(fn()).finally(() => {
    db.promise = original;
  });
}

const future = new Date(Date.now() + 30 * 60 * 1000);
const past = new Date(Date.now() - 30 * 60 * 1000);
const PHONE = "919876543210";

const run = async () => {
  console.log("\nwaBotGate — engagement decisions");

  // The regression that matters most.
  await withContact({ id: 1, ai_enabled: 1, ai_paused_until: future }, async () => {
    const r = await waBotGate.shouldBotEngage(PHONE);
    ok("agent takeover blocks the bot (not just the AI)", () => {
      assert.strictEqual(r.allowed, false);
      assert.strictEqual(r.reason, "agent_takeover");
    });
  });

  await withContact({ id: 1, ai_enabled: 1, ai_paused_until: past }, async () => {
    const r = await waBotGate.shouldBotEngage(PHONE);
    ok("an expired pause lets the bot resume on its own", () => {
      assert.strictEqual(r.allowed, true);
      assert.strictEqual(r.reason, null);
    });
  });

  await withContact({ id: 1, ai_enabled: 0, ai_paused_until: null }, async () => {
    const r = await waBotGate.shouldBotEngage(PHONE);
    ok("per-contact bot switch off blocks the bot", () => {
      assert.strictEqual(r.allowed, false);
      assert.strictEqual(r.reason, "bot_disabled_for_contact");
    });
  });

  await withContact({ id: 1, ai_enabled: 1, is_unsubscribed: 1 }, async () => {
    const r = await waBotGate.shouldBotEngage(PHONE);
    ok("an unsubscribed contact is never engaged", () => {
      assert.strictEqual(r.allowed, false);
      assert.strictEqual(r.reason, "contact_unsubscribed");
    });
  });

  await withContact({ id: 1, ai_enabled: 1, is_blocked: 1 }, async () => {
    const r = await waBotGate.shouldBotEngage(PHONE);
    ok("a blocked contact is never engaged", () => {
      assert.strictEqual(r.allowed, false);
      assert.strictEqual(r.reason, "contact_blocked");
    });
  });

  // A first-time sender has no wa_contacts row yet. Existing behaviour is to
  // let the bot greet them; this pins that so the gate is not silently
  // changing what happens for genuinely new customers.
  await withContact(null, async () => {
    const r = await waBotGate.shouldBotEngage(PHONE);
    ok("an unknown first-time sender is still allowed (no row yet)", () => {
      assert.strictEqual(r.allowed, true);
      assert.strictEqual(r.contact, null);
    });
  });

  await withContact({ id: 1, ai_enabled: 1 }, async () => {
    const r = await waBotGate.shouldBotEngage("12345");
    ok("a malformed phone is rejected before any query", () => {
      assert.strictEqual(r.allowed, false);
      assert.strictEqual(r.reason, "invalid_phone");
    });
  });

  // Fail open: losing the DB must not silence a real customer conversation.
  await withQueryError(async () => {
    const r = await waBotGate.shouldBotEngage(PHONE);
    ok("a lookup failure fails OPEN rather than muting the bot", () => {
      assert.strictEqual(r.allowed, true);
    });
  });

  await withContact({ id: 1, ai_enabled: 1, ai_paused_until: future }, async () => {
    const allowed = await waBotGate.botMayReply(PHONE, "Flow bot");
    ok("botMayReply returns a plain boolean", () => {
      assert.strictEqual(allowed, false);
    });
  });

  console.log(
    `\n${failures.length ? `❌ ${failures.length} FAILED` : "✅ all"} — ${passed} checks passed\n`
  );
  process.exit(failures.length ? 1 : 0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
