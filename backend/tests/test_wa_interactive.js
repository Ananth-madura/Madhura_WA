/**
 * Self-check for the WhatsApp interactive messaging layer.
 *
 * No DB, no network, no jest — run directly:
 *     node backend/tests/test_wa_interactive.js
 *
 * Covers the two things that actually break in production:
 *   1. Title/id normalization — an authored "1. Our Services" must reach Meta
 *      as a native button labelled "Our Services", while ids stay untouched.
 *   2. waLoadBalancer.sendInteractive routing — native when a Cloud API sender
 *      exists, numbered-text fallback when it does not or when it throws, and
 *      never a silent drop.
 */
const assert = require("assert");
const waInteractive = require("../services/waInteractive");

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("\nwaInteractive — normalization");

ok("strips authored ordinals from native button titles", () => {
  const btns = waInteractive.normalizeButtons([
    { reply_id: "opt_services", title: "1. 🛠️ Our Services" },
    { reply_id: "opt_booking", title: "2) 📅 Book Service" },
    { reply_id: "opt_agent", title: "3 - 👤 Live Agent" },
  ]);
  assert.deepStrictEqual(
    btns.map((b) => b.title),
    ["🛠️ Our Services", "📅 Book Service", "👤 Live Agent"]
  );
});

ok("keeps operator-defined ids verbatim and never uses the title as the id", () => {
  const [b] = waInteractive.normalizeButtons([{ reply_id: "quote_view", title: "Check my quote" }]);
  assert.strictEqual(b.id, "quote_view");
  assert.notStrictEqual(b.id, b.title);
});

ok("a title that is only a number survives normalization", () => {
  // "2024" must not be stripped to empty — it is the whole label.
  const [b] = waInteractive.normalizeButtons([{ id: "yr", title: "2024" }]);
  assert.strictEqual(b.title, "2024");
});

ok("enforces Meta caps: 3 buttons, 20-char titles", () => {
  const btns = waInteractive.normalizeButtons([
    { id: "a", title: "x".repeat(50) },
    { id: "b", title: "b" },
    { id: "c", title: "c" },
    { id: "d", title: "d" },
  ]);
  assert.strictEqual(btns.length, 3);
  assert.strictEqual(btns[0].title.length, 20);
});

ok("list rows honour the global 10-row budget across sections", () => {
  const sections = waInteractive.normalizeSections([
    { title: "A", rows: Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, title: `A${i}` })) },
    { title: "B", rows: Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, title: `B${i}` })) },
  ]);
  const total = sections.reduce((n, s) => n + s.rows.length, 0);
  assert.strictEqual(total, 10);
});

ok("a flat row array is wrapped into a single section", () => {
  const sections = waInteractive.normalizeSections([{ id: "r1", title: "Row 1" }], "Services");
  assert.strictEqual(sections.length, 1);
  assert.strictEqual(sections[0].title, "Services");
});

ok("text fallback numbering matches the normalized titles", () => {
  const btns = waInteractive.normalizeButtons([
    { id: "a", title: "1. Our Services" },
    { id: "b", title: "2. Book Service" },
  ]);
  const text = waInteractive.buildNumberedText({ body: "How can we help?", items: btns });
  // Exactly one "1." per option — the authored ordinal must not double up.
  assert.ok(text.includes("*1.* Our Services"), text);
  assert.ok(text.includes("*2.* Book Service"), text);
  assert.ok(!text.includes("1. 1."), "authored ordinal was not stripped: " + text);
  assert.ok(/option number/i.test(text), "fallback must tell the user to reply with a number");
});

console.log("\nwaLoadBalancer — interactive routing");

const waLoadBalancer = require("../services/waLoadBalancer");

// Stub getActiveEngines so routing is tested without DB/network.
// Must await fn() before restoring — the fallback path calls getActiveEngines
// a second time, after the first await yields.
async function withEngines(engines, fn) {
  const original = waLoadBalancer.getActiveEngines;
  waLoadBalancer.getActiveEngines = async () => engines;
  try {
    return await fn();
  } finally {
    waLoadBalancer.getActiveEngines = original;
  }
}

function cloudEngine(name, { fail = false, calls } = {}) {
  return {
    id: name,
    name,
    type: "cloud_api",
    phone: "911234567890",
    supportsInteractive: true,
    sendButtons: async (...args) => {
      calls?.push([name, "buttons", ...args]);
      if (fail) throw new Error("(#131047) Re-engagement message");
      return { messages: [{ id: "wamid.native" }] };
    },
    sendList: async (...args) => {
      calls?.push([name, "list", ...args]);
      if (fail) throw new Error("token expired");
      return { messages: [{ id: "wamid.native" }] };
    },
    sendCTA: async (...args) => {
      calls?.push([name, "cta", ...args]);
      if (fail) throw new Error("cta send failed");
      return { messages: [{ id: "wamid.cta" }] };
    },
    sendText: async (...args) => {
      calls?.push([name, "text", ...args]);
      return { messages: [{ id: "wamid.text" }] };
    },
  };
}

function webEngine(name, { calls } = {}) {
  return {
    id: name,
    name,
    type: "web_session",
    phone: "919999999999",
    // whatsapp-web.js deprecated Buttons/List — deliberately not interactive.
    sendText: async (...args) => {
      calls?.push([name, "text", ...args]);
      return { id: { _serialized: "web_msg" } };
    },
  };
}

const run = async () => {
  await (async () => {
    const calls = [];
    const res = await withEngines([cloudEngine("cloud", { calls })], () =>
      waLoadBalancer.sendInteractiveButtons({
        phone: "9876543210",
        body: "Your quote is ready.",
        buttons: [{ id: "quote_view", title: "1. Check my quote" }],
      })
    );
    ok("cloud sender delivers NATIVE buttons with the ordinal stripped", () => {
      assert.strictEqual(res.native, true);
      assert.strictEqual(calls.length, 1);
      const [, kind, phone, , buttons] = calls[0];
      assert.strictEqual(kind, "buttons");
      assert.strictEqual(phone, "919876543210", "10-digit number must be normalized to E.164 digits");
      assert.deepStrictEqual(buttons, [{ id: "quote_view", title: "Check my quote" }]);
    });
  })();

  await (async () => {
    const calls = [];
    const res = await withEngines([webEngine("web", { calls })], () =>
      waLoadBalancer.sendInteractiveButtons({
        phone: "919876543210",
        body: "Your quote is ready.",
        buttons: [{ id: "quote_view", title: "Check my quote" }],
      })
    );
    ok("web-only sender degrades to numbered text, never a silent drop", () => {
      assert.strictEqual(res.native, false);
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0][1], "text");
      assert.ok(calls[0][3].includes("*1.* Check my quote"), calls[0][3]);
    });
  })();

  await (async () => {
    const calls = [];
    const res = await withEngines(
      [cloudEngine("cloud-a", { fail: true, calls }), cloudEngine("cloud-b", { calls })],
      () =>
        waLoadBalancer.sendInteractiveButtons({
          phone: "919876543210",
          body: "hi",
          buttons: [{ id: "x", title: "X" }],
          routingStrategy: "cloud_first",
        })
    );
    ok("a failing cloud sender fails over to the next cloud sender", () => {
      assert.strictEqual(res.native, true);
      assert.strictEqual(res.failover, true);
      assert.deepStrictEqual(calls.map((c) => c[0]), ["cloud-a", "cloud-b"]);
    });
  })();

  await (async () => {
    const calls = [];
    const res = await withEngines([cloudEngine("cloud", { fail: true, calls }), webEngine("web", { calls })], () =>
      waLoadBalancer.sendInteractiveList({
        phone: "919876543210",
        body: "Pick a service",
        sections: [{ id: "service_web", title: "Website Development", description: "Build your site" }],
      })
    );
    ok("cloud failure with no other cloud sender falls back to text via web", () => {
      assert.strictEqual(res.native, false);
      assert.deepStrictEqual(calls.map((c) => c[1]), ["list", "text"]);
      assert.ok(calls[1][3].includes("*1.* Website Development"), calls[1][3]);
    });
  })();

  await (async () => {
    let threw = null;
    await withEngines([cloudEngine("cloud")], async () => {
      try {
        await waLoadBalancer.sendInteractiveButtons({ phone: "919876543210", body: "hi", buttons: [] });
      } catch (err) {
        threw = err;
      }
    });
    ok("an empty option set is rejected rather than sent as a bare body", () => {
      assert.ok(threw, "expected a throw");
      assert.ok(/at least one button/i.test(threw.message), threw.message);
    });
  })();

  console.log("\nwaLoadBalancer — CTA URL button");

  await (async () => {
    const calls = [];
    const res = await withEngines([cloudEngine("cloud", { calls })], () =>
      waLoadBalancer.sendCTAButtonMessage({
        phone: "9876543210",
        body: "Your quote is ready.",
        displayText: "Check my quote",
        url: "https://madhuratech.com/q/1024",
      })
    );
    ok("cloud sender delivers a NATIVE cta_url button", () => {
      assert.strictEqual(res.native, true);
      assert.strictEqual(res.kind, "cta_url");
      const [, kind, phone, , displayText, url] = calls[0];
      assert.strictEqual(kind, "cta");
      assert.strictEqual(phone, "919876543210");
      assert.strictEqual(displayText, "Check my quote");
      assert.strictEqual(url, "https://madhuratech.com/q/1024");
    });
  })();

  await (async () => {
    const calls = [];
    const res = await withEngines([webEngine("web", { calls })], () =>
      waLoadBalancer.sendCTAButtonMessage({
        phone: "919876543210",
        body: "Your quote is ready.",
        displayText: "Check my quote",
        url: "https://madhuratech.com/q/1024",
      })
    );
    ok("web-only sender falls back to a real link, not a numbered menu", () => {
      assert.strictEqual(res.native, false);
      const sent = calls[0][3];
      assert.ok(sent.includes("https://madhuratech.com/q/1024"), sent);
      // There are no options to enumerate, so the reply-with-a-number hint
      // would be nonsense here.
      assert.ok(!/option number/i.test(sent), "CTA fallback must not add a menu hint: " + sent);
    });
  })();

  await (async () => {
    let threw = null;
    await withEngines([cloudEngine("cloud")], async () => {
      try {
        await waLoadBalancer.sendCTAButtonMessage({
          phone: "919876543210",
          body: "hi",
          displayText: "Open",
          url: "madhuratech.com/q/1024", // no scheme — Meta rejects this
        });
      } catch (err) {
        threw = err;
      }
    });
    ok("a url without http(s) is rejected before hitting Meta", () => {
      assert.ok(threw, "expected a throw");
      assert.ok(/must start with http/i.test(threw.message), threw.message);
    });
  })();

  await (async () => {
    let threw = null;
    await withEngines([cloudEngine("cloud")], async () => {
      try {
        await waLoadBalancer.sendCTAButtonMessage({ phone: "919876543210", body: "hi", displayText: "Open" });
      } catch (err) {
        threw = err;
      }
    });
    ok("a missing url is rejected", () => {
      assert.ok(threw && /requires a url/i.test(threw.message), threw?.message);
    });
  })();

  console.log(`\n${process.exitCode ? "❌ FAILURES above" : "✅ all"} — ${passed} checks passed\n`);
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    // requiring waLoadBalancer opens the shared MySQL pool as a side effect;
    // these checks never touch it, so exit rather than wait on its retry loop.
    process.exit(process.exitCode || 0);
  });
