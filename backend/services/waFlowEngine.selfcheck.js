/**
 * Self-check for waFlowEngine media resolution.
 * Run: node backend/services/waFlowEngine.selfcheck.js
 * Exits non-zero if the send_media type/URL logic regresses.
 */
const assert = require("assert");

process.env.PUBLIC_BASE_URL = "https://crm.example.com";
const engine = require("./waFlowEngine");

const r = (url, type, name) => engine.resolveMedia(url, type, name);

// Absolute URLs keep their host; type is inferred from the extension
assert.deepStrictEqual(r("https://x.io/a.jpg", ""), { url: "https://x.io/a.jpg", type: "image", filename: "a.jpg" });
assert.strictEqual(r("https://x.io/catalog.pdf", "").type, "document");
assert.strictEqual(r("https://x.io/clip.mp4", "").type, "video");
assert.strictEqual(r("https://x.io/note.ogg", "").type, "audio");

// Uploaded/relative paths resolve against PUBLIC_BASE_URL
assert.strictEqual(r("/uploads/wa-media/brochure.pdf", "document").url, "https://crm.example.com/uploads/wa-media/brochure.pdf");

// A mislabelled node still delivers: "image" pointing at a PDF must send as a document
assert.strictEqual(r("https://x.io/catalog.pdf", "image").type, "document");
// ...and an explicit "document" is always honoured, even for an image file
assert.strictEqual(r("https://x.io/a.jpg", "document").type, "document");
// Legacy/loose type names normalise to document
assert.strictEqual(r("https://x.io/sheet.xlsx", "excel").type, "document");

// Query strings must not leak into the type or filename
assert.strictEqual(r("https://x.io/a.png?v=2", "").type, "image");
assert.strictEqual(r("https://x.io/a.png?v=2", "").filename, "a.png");

// An explicit filename wins over the URL basename
assert.strictEqual(r("https://x.io/9f3b2.pdf", "document", "Invoice-2026.pdf").filename, "Invoice-2026.pdf");

// Nothing sendable
assert.strictEqual(r("", "image"), null);
assert.strictEqual(r(null, "image"), null);

// Relative path with no public base is unreachable by WhatsApp -> null, not a broken URL
delete process.env.PUBLIC_BASE_URL;
delete process.env.REACT_APP_API_URL;
assert.strictEqual(r("/uploads/wa-media/x.pdf", "document"), null);

console.log("✅ waFlowEngine.resolveMedia self-check passed");

// ── Trigger-word matching (decides whether the bot ever wakes up) ────────────
const invoiceFlow = { trigger_type: "keyword", trigger_config: { keywords: ["invoice", "bill", "amc"] } };
const m = (text, opts) => engine.matchesTriggerKeywords(text, invoiceFlow, opts);

assert.strictEqual(m("invoice"), true, "exact keyword");
assert.strictEqual(m("  Invoice  "), true, "trimmed + case-insensitive");
assert.strictEqual(m("invoice, please"), true, "keyword + separator");
assert.strictEqual(m("invoice?"), true);
assert.strictEqual(m("send me my invoice copy"), true, "whole-word mention in a sentence");
assert.strictEqual(m("myinvoice"), true, "loose containment for long keywords");

// The bug this replaced: a 1-2 char reply matched any keyword containing it
assert.strictEqual(m("in"), false, "short reply must not trigger 'invoice'");
assert.strictEqual(m("a"), false);
assert.strictEqual(m("b"), false, "must not trigger 'bill'");
assert.strictEqual(m(""), false);
assert.strictEqual(m("   "), false);
assert.strictEqual(m("hello there"), false, "unrelated message");

// Legacy single-keyword config and a JSON-string trigger_config must still work
assert.strictEqual(engine.matchesTriggerKeywords("quote", { trigger_config: { keyword: "quote" } }), true);
assert.strictEqual(engine.matchesTriggerKeywords("quote", { trigger_config: '{"keywords":["quote"]}' }), true);
// A flow with no keywords can never self-trigger
assert.strictEqual(engine.matchesTriggerKeywords("anything", { trigger_config: {} }), false);
assert.deepStrictEqual(engine.getTriggerKeywords({ trigger_config: { keywords: [" Invoice ", "", null] } }), ["invoice"]);

// strict mode (mid-conversation switching): only deliberate commands may hijack
// a running flow, so an answer that merely mentions a keyword must not.
assert.strictEqual(m("invoice", { strict: true }), true);
assert.strictEqual(m("invoice please", { strict: true }), true);
assert.strictEqual(m("the AC broke and my invoice is wrong", { strict: true }), false,
  "a passing mention must not discard what the customer already typed");
// ...while the same sentence DOES start the flow from idle
assert.strictEqual(m("the AC broke and my invoice is wrong"), true);

console.log("✅ waFlowEngine.matchesTriggerKeywords self-check passed");

// ── Flow walk: simulateFlowStep routing (no DB, no network) ──────────────────
const flow = {
  id: 999,
  entry_node_key: "start",
  nodes: [
    { node_key: "start", node_type: "start", config: { next_node_key: "greet" } },
    { node_key: "greet", node_type: "send_message", config: { text: "Hello!", next_node_key: "share" } },
    { node_key: "share", node_type: "send_media", config: { media_type: "link", media_url: "https://x.io/pricing", caption: "Our pricing:", next_node_key: "menu" } },
    { node_key: "menu", node_type: "send_buttons", config: { text: "Pick one:", buttons: [
      { reply_id: "a", title: "1. Services", next_node_key: "svc" },
      { reply_id: "b", title: "2. Talk to us", next_node_key: "hand" },
    ] } },
    { node_key: "svc", node_type: "api_webhook", config: { method: "GET", url: "https://api.x.io/s", success_next: "route", error_next: "done" } },
    { node_key: "route", node_type: "ai_intent", config: { branches: { booking: "done" }, fallback_node: "done" } },
    { node_key: "hand", node_type: "handoff", config: { note: "Connecting an agent" } },
    { node_key: "done", node_type: "end", config: {} },
  ],
};

(async () => {
  // Entry chain runs until the button menu suspends it
  const r1 = await engine.simulateFlowStep(flow, "hi", null);
  assert.strictEqual(r1.currentNodeKey, "menu", "should suspend on the button menu");
  assert.strictEqual(r1.isEnded, false);
  assert.strictEqual(r1.messages.length, 3, "greeting + link + menu");
  // media_type "link" must render as text (rich preview), not a file attachment
  assert.strictEqual(r1.messages[1].type, "text");
  assert.ok(r1.messages[1].text.includes("https://x.io/pricing"));
  assert.strictEqual(r1.messages[2].type, "buttons");
  assert.strictEqual(r1.messages[2].buttons.length, 2);

  // Replying with the option NUMBER picks the right branch
  const r2 = await engine.simulateFlowStep(flow, "1", { currentNodeKey: "menu", vars: r1.vars });
  // svc -> api_webhook (success path, not called) -> ai_intent (first branch) -> end
  assert.strictEqual(r2.isEnded, true, "webhook + ai_intent must route on to the end, not dead-end");
  assert.strictEqual(r2.vars.webhook_status, "success");
  assert.strictEqual(r2.vars.ai_detected_intent, "booking");

  // Replying with the option TITLE reaches the handoff
  const r3 = await engine.simulateFlowStep(flow, "Talk to us", { currentNodeKey: "menu", vars: r1.vars });
  assert.strictEqual(r3.isHandedOff, true, "title match should reach the handoff step");

  // An unrecognised reply reprompts with the menu — it must NOT silently pick option 1
  const r4 = await engine.simulateFlowStep(flow, "asdfgh", { currentNodeKey: "menu", vars: r1.vars });
  assert.strictEqual(r4.currentNodeKey, "menu", "unknown reply should stay on the menu");
  assert.strictEqual(r4.isEnded, false);
  assert.ok(r4.messages[0].text.includes("1. Services"), "reprompt should list the options again");

  // A second unrecognised reply gives up and follows the fallback path
  const r5 = await engine.simulateFlowStep(flow, "qwerty", { currentNodeKey: "menu", vars: r4.vars });
  assert.notStrictEqual(r5.currentNodeKey, "menu", "second unknown reply must move on, not loop forever");

  console.log("✅ waFlowEngine.simulateFlowStep routing self-check passed");

  // ── collect_input attachment policy ───────────────────────────────────────
  // Mirrors the rule in advanceActiveRun: attachments answer free-text
  // questions, but must not satisfy a validated one unless opted in.
  const accepts = (cfg) => {
    const strict = (cfg.validation_type && cfg.validation_type !== "none") || !!cfg.regex;
    return cfg.accept_media === true || (cfg.accept_media !== false && !strict);
  };
  assert.strictEqual(accepts({}), true, "free-text question accepts a file by default");
  assert.strictEqual(accepts({ validation_type: "none" }), true);
  assert.strictEqual(accepts({ validation_type: "email" }), false, "a photo must not answer 'what is your email?'");
  assert.strictEqual(accepts({ validation_type: "phone" }), false);
  assert.strictEqual(accepts({ regex: "^\\d+$" }), false);
  assert.strictEqual(accepts({ validation_type: "email", accept_media: true }), true, "explicit opt-in overrides");
  assert.strictEqual(accepts({ accept_media: false }), false, "explicit opt-out overrides");
  console.log("✅ collect_input attachment policy self-check passed");

  process.exit(0);
})().catch((e) => {
  console.error("❌ self-check FAILED:", e.message);
  process.exit(1);
});
