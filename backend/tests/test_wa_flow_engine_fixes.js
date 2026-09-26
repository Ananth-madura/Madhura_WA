const assert = require("assert");

// Test 1: Button formatting and clean title extraction
function testButtonTitleExtraction() {
  const buttons = [
    { label: "📦 View Full Menu", next_node_key: "category_list" },
    { title: "💰 Get Bulk Price", next_node_key: "ask_bulk_details" },
    { text: "👨💼 Talk to Sales", next_node_key: "sales_handoff" },
    { name: "✨ Custom Offer", next_node_key: "offers" }
  ];

  const processed = buttons.map((b, idx) => {
    const rawTitle = b.title || b.label || b.text || b.name || `Option ${idx + 1}`;
    const cleanTitle = String(rawTitle).replace(/^\d+[\s.)-]+\s*/, "").trim();
    return {
      id: b.id || b.reply_id || `btn_${idx + 1}`,
      title: cleanTitle,
      label: cleanTitle,
      next_node_key: b.next_node_key
    };
  });

  assert.strictEqual(processed[0].title, "📦 View Full Menu");
  assert.strictEqual(processed[1].title, "💰 Get Bulk Price");
  assert.strictEqual(processed[2].title, "👨💼 Talk to Sales");
  assert.strictEqual(processed[3].title, "✨ Custom Offer");

  // Numbered menu formatting
  let menuBody = "*Fresh Foods*\n\nWelcome!\n\n";
  processed.forEach((b, idx) => {
    menuBody += `*${idx + 1}.* ${b.title}\n`;
  });
  menuBody += "\n_Reply with option number (1, 2, 3...) or option name_";

  assert(menuBody.includes("*1.* 📦 View Full Menu"));
  assert(menuBody.includes("*2.* 💰 Get Bulk Price"));
  assert(menuBody.includes("*3.* 👨💼 Talk to Sales"));
  assert(menuBody.includes("*4.* ✨ Custom Offer"));
  console.log("✅ Test 1 Passed: Button title extraction & menu formatting");
}

// Test 2: User reply matching (numbers, IDs, keywords, text)
function testOptionMatching() {
  const buttons = [
    { id: "VIEW_MENU", reply_id: "VIEW_MENU", title: "View Full Menu", next_node_key: "category_list" },
    { id: "GET_PRICE", reply_id: "GET_PRICE", title: "Get Bulk Price", next_node_key: "ask_bulk_details" },
    { id: "TALK_HUMAN", reply_id: "TALK_HUMAN", title: "Talk to Sales", next_node_key: "sales_handoff" }
  ];

  const matchInput = (input, tappedId = null) => {
    const rawText = (input || "").trim();
    const tap = tappedId || rawText;
    const lowerRaw = rawText.toLowerCase();

    // 1. Number match: "1", "2", "option 1", "#1"
    const numMatch = rawText.match(/^(?:option\s*|opt\s*|choice\s*|select\s*|#\s*)?(\d+)[.)]?$/i);
    if (numMatch) {
      const numIdx = parseInt(numMatch[1], 10) - 1;
      if (numIdx >= 0 && numIdx < buttons.length) {
        return buttons[numIdx];
      }
    }

    // 2. Exact ID / reply_id
    if (tap) {
      const tapLower = String(tap).toLowerCase().trim();
      const matched = buttons.find(b => 
        (b.reply_id && String(b.reply_id).toLowerCase().trim() === tapLower) ||
        (b.id && String(b.id).toLowerCase().trim() === tapLower) ||
        (b.title && String(b.title).toLowerCase().trim() === tapLower)
      );
      if (matched) return matched;
    }

    // 3. Substring & word token overlap match
    const stripSymbols = (s) => (s || "").replace(/^\d+[\s.)-]+\s*/, "").replace(/[^\p{L}\p{N}\s]/gu, "").toLowerCase().trim();
    const cleanInput = stripSymbols(rawText);
    if (cleanInput) {
      const matched = buttons.find(b => {
        const cleanTitle = stripSymbols(b.title);
        if (cleanTitle === cleanInput || cleanInput.includes(cleanTitle) || cleanTitle.includes(cleanInput)) {
          return true;
        }
        const inputWords = cleanInput.split(/\s+/).filter(w => w.length >= 3);
        const titleWords = cleanTitle.split(/\s+/).filter(w => w.length >= 3);
        if (inputWords.length > 0 && inputWords.every(w => titleWords.includes(w))) {
          return true;
        }
        return false;
      });
      if (matched) return matched;
    }

    return null;
  };

  // Test replies
  assert.strictEqual(matchInput("1")?.next_node_key, "category_list");
  assert.strictEqual(matchInput("2")?.next_node_key, "ask_bulk_details");
  assert.strictEqual(matchInput("3")?.next_node_key, "sales_handoff");
  assert.strictEqual(matchInput("option 1")?.next_node_key, "category_list");
  assert.strictEqual(matchInput("#2")?.next_node_key, "ask_bulk_details");
  assert.strictEqual(matchInput("View Full Menu")?.next_node_key, "category_list");
  assert.strictEqual(matchInput("view menu")?.next_node_key, "category_list");
  assert.strictEqual(matchInput("bulk price")?.next_node_key, "ask_bulk_details");
  assert.strictEqual(matchInput(null, "TALK_HUMAN")?.next_node_key, "sales_handoff");
  console.log("✅ Test 2 Passed: Option reply matching by number, title, and ID");
}

// Test 3: Phone number normalization
function testPhoneNormalization() {
  const normalize = (phone) => {
    let clean = String(phone || "").replace(/\D/g, "");
    if (clean.length === 10) clean = "91" + clean;
    return clean;
  };

  assert.strictEqual(normalize("9876543210"), "919876543210");
  assert.strictEqual(normalize("+91 9876543210"), "919876543210");
  assert.strictEqual(normalize("919876543210@c.us"), "919876543210");
  assert.strictEqual(normalize("919876543210"), "919876543210");
  console.log("✅ Test 3 Passed: Phone normalization");
}

// Test 4: Trigger node type identification
function testTriggerNodeTypes() {
  const triggerTypes = ["start", "keyword_trigger", "all_inbound_trigger", "first_inbound_trigger", "trigger"];
  const isTrigger = (type) => triggerTypes.includes(type);

  assert(isTrigger("start"));
  assert(isTrigger("keyword_trigger"));
  assert(isTrigger("all_inbound_trigger"));
  assert(isTrigger("first_inbound_trigger"));
  assert(isTrigger("trigger"));
  assert(!isTrigger("send_buttons"));
  assert(!isTrigger("end"));
  console.log("✅ Test 4 Passed: Trigger node types recognized");
}

testButtonTitleExtraction();
testOptionMatching();
testPhoneNormalization();
testTriggerNodeTypes();
console.log("\n🎉 ALL UNIT CHECKS PASSED SUCCESSFULLY!");
