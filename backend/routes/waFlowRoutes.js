const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");
const waFlowEngine = require("../services/waFlowEngine");

// ── List Flows ───────────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const [flows] = await db.promise().query(
      `SELECT f.*, 
        (SELECT COUNT(*) FROM wa_flow_nodes n WHERE n.flow_id = f.id) as node_count,
        (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'active') as active_runs,
        (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'completed') as completed_runs,
        (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'handed_off') as handoff_runs
       FROM wa_flows f
       ORDER BY f.created_at DESC`
    );
    res.json(flows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Single Flow with Nodes ───────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const [flows] = await db.promise().query(
      "SELECT * FROM wa_flows WHERE id = ?",
      [req.params.id]
    );
    if (!flows.length) return res.status(404).json({ error: "Flow not found" });

    const [nodes] = await db.promise().query(
      "SELECT * FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC",
      [req.params.id]
    );

    const parsedNodes = nodes.map(n => ({
      ...n,
      config: typeof n.config === "string" ? JSON.parse(n.config) : (n.config || {})
    }));

    res.json({ ...flows[0], nodes: parsedNodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Flow ──────────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  try {
    const { name, description, trigger_type = "keyword", trigger_config = {}, entry_node_key = "start", nodes = [] } = req.body;
    if (!name) return res.status(400).json({ error: "Flow name is required" });

    const [flowResult] = await db.promise().query(
      `INSERT INTO wa_flows (name, description, status, trigger_type, trigger_config, entry_node_key, created_by)
       VALUES (?, ?, 'draft', ?, ?, ?, ?)`,
      [
        name,
        description || null,
        trigger_type,
        JSON.stringify(trigger_config),
        entry_node_key,
        req.user?.id || null,
      ]
    );
    const flowId = flowResult.insertId;

    // Default starter template if none provided
    const nodesToInsert = nodes.length > 0 ? nodes : [
      { node_key: "start", node_type: "start", config: { next_node_key: "welcome_menu" }, position_x: 100, position_y: 100 },
      { node_key: "welcome_menu", node_type: "send_buttons", config: { 
          text: "Hello {name}! Welcome to Madhura Tech. How can we assist you today?",
          buttons: [
            { reply_id: "btn_services", title: "🛠️ Services", next_node_key: "services_msg" },
            { reply_id: "btn_support", title: "👤 Live Support", next_node_key: "support_handoff" }
          ]
        }, position_x: 100, position_y: 220 
      },
      { node_key: "services_msg", node_type: "send_message", config: { text: "We provide comprehensive HVAC, Electrical, and AMC solutions across {city}!", next_node_key: "end" }, position_x: 50, position_y: 360 },
      { node_key: "support_handoff", node_type: "handoff", config: { note: "Connecting you to our support specialist..." }, position_x: 250, position_y: 360 },
      { node_key: "end", node_type: "end", config: {}, position_x: 150, position_y: 500 }
    ];

    for (const node of nodesToInsert) {
      await db.promise().query(
        `INSERT INTO wa_flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          flowId,
          node.node_key,
          node.node_type,
          JSON.stringify(node.config || {}),
          node.position_x || 0,
          node.position_y || 0,
        ]
      );
    }

    const [newFlow] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ?", [flowId]);
    res.status(201).json(newFlow[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update Flow & Nodes ──────────────────────────────────────────────────────
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, description, status, trigger_type, trigger_config, entry_node_key = "start", nodes } = req.body;
    const flowId = req.params.id;

    await db.promise().query(
      `UPDATE wa_flows 
       SET name = COALESCE(?, name),
           description = ?,
           status = COALESCE(?, status),
           trigger_type = COALESCE(?, trigger_type),
           trigger_config = COALESCE(?, trigger_config),
           entry_node_key = COALESCE(?, entry_node_key),
           updated_at = NOW()
       WHERE id = ?`,
      [
        name,
        description,
        status,
        trigger_type,
        trigger_config ? JSON.stringify(trigger_config) : null,
        entry_node_key,
        flowId,
      ]
    );

    if (Array.isArray(nodes)) {
      // Replace nodes
      await db.promise().query("DELETE FROM wa_flow_nodes WHERE flow_id = ?", [flowId]);
      for (const node of nodes) {
        await db.promise().query(
          `INSERT INTO wa_flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            flowId,
            node.node_key,
            node.node_type,
            JSON.stringify(node.config || {}),
            node.position_x || 0,
            node.position_y || 0,
          ]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Toggle Active Status ─────────────────────────────────────────────────────
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["draft", "active", "archived"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await db.promise().query(
      "UPDATE wa_flows SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, req.params.id]
    );

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete Flow ──────────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_flows WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger Flow directly for a Phone Number ──────────────────────────────────
router.post("/:id/trigger-phone", auth, async (req, res) => {
  try {
    const { phone, sessionKey } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });
    let cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    const [flows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ?", [req.params.id]);
    if (!flows.length) return res.status(404).json({ error: "Flow not found" });

    const reqSessionKey = sessionKey || req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id || null;
    const result = await waFlowEngine.startFlowRun(flows[0], cleanPhone, reqSessionKey);
    res.json({ success: true, message: `Flow "${flows[0].name}" started for +${cleanPhone}`, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Flow Runs Audit History ───────────────────────────────────────────────
router.get("/:id/runs", auth, async (req, res) => {
  try {
    const [runs] = await db.promise().query(
      `SELECT r.*, c.name as contact_name, c.company as contact_company
       FROM wa_flow_runs r
       LEFT JOIN wa_contacts c ON r.phone = c.phone
       WHERE r.flow_id = ?
       ORDER BY r.started_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Interactive In-Memory Test Simulator ──────────────────────────────────────
router.post("/:id/test-simulate", auth, async (req, res) => {
  try {
    const { input = "", state = null } = req.body;
    const [flows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ?", [req.params.id]);
    if (!flows.length) return res.status(404).json({ error: "Flow not found" });

    const [nodes] = await db.promise().query("SELECT * FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC", [req.params.id]);
    const flow = {
      ...flows[0],
      nodes: nodes.map(n => ({
        ...n,
        config: typeof n.config === "string" ? JSON.parse(n.config) : (n.config || {})
      }))
    };

    const simResult = await waFlowEngine.simulateFlowStep(flow, input, state);

    // Tell the tester whether this message would REALLY have started the flow on
    // WhatsApp. The simulator always force-starts at the entry node, so without
    // this a non-matching message looks like it works when it never would.
    const triggerKeywords = waFlowEngine.getTriggerKeywords(flow);
    const isKeywordFlow = waFlowEngine.isKeywordEligible(flow);
    const triggerMatched = isKeywordFlow
      ? waFlowEngine.matchesTriggerKeywords(input, flow)
      : false;

    res.json({
      success: true,
      ...simResult,
      triggerType: flow.trigger_type || "keyword",
      triggerKeywords,
      triggerMatched,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Live In-Memory Draft Flow Simulator (Instant Test without Saving) ──────────
router.post("/draft-simulate", auth, async (req, res) => {
  try {
    const { flow, input = "", state = null } = req.body;
    if (!flow || !flow.nodes) {
      return res.status(400).json({ error: "Draft flow and nodes are required" });
    }

    const simResult = await waFlowEngine.simulateFlowStep(flow, input, state);
    const triggerKeywords = waFlowEngine.getTriggerKeywords(flow);
    const isKeywordFlow = waFlowEngine.isKeywordEligible(flow);
    const triggerMatched = isKeywordFlow
      ? waFlowEngine.matchesTriggerKeywords(input, flow)
      : false;

    res.json({
      success: true,
      ...simResult,
      triggerType: flow.trigger_type || "keyword",
      triggerKeywords,
      triggerMatched,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Flow Versions & Snapshots ─────────────────────────────────────────────────
router.get("/:id/versions", auth, async (req, res) => {
  try {
    const flowId = req.params.id;
    const [versions] = await db.promise().query(
      `SELECT v.*, u.name as publisher_name 
       FROM wa_flow_versions v 
       LEFT JOIN users u ON v.created_by = u.id 
       WHERE v.flow_id = ? 
       ORDER BY v.version_number DESC`,
      [flowId]
    ).catch(() => [[]]);
    res.json(versions || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/versions/publish", auth, async (req, res) => {
  try {
    const flowId = req.params.id;
    const { changelog = "Published new version" } = req.body;

    const [flows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ?", [flowId]);
    if (!flows.length) return res.status(404).json({ error: "Flow not found" });
    const flow = flows[0];

    const [nodes] = await db.promise().query("SELECT * FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC", [flowId]);
    const parsedNodes = nodes.map(n => ({
      ...n,
      config: typeof n.config === "string" ? JSON.parse(n.config) : (n.config || {})
    }));

    // Find next version number
    const [[maxVer]] = await db.promise().query(
      "SELECT COALESCE(MAX(version_number), 0) as max_v FROM wa_flow_versions WHERE flow_id = ?",
      [flowId]
    ).catch(() => [[{ max_v: 0 }]]);
    const nextVersion = (maxVer?.max_v || 0) + 1;

    // Archive previous published versions
    await db.promise().query(
      "UPDATE wa_flow_versions SET status = 'archived' WHERE flow_id = ? AND status = 'published'",
      [flowId]
    ).catch(() => {});

    // Save snapshot
    await db.promise().query(
      `INSERT INTO wa_flow_versions (flow_id, version_number, name, description, trigger_type, trigger_config, entry_node_key, nodes_snapshot, status, changelog, published_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, NOW(), ?)`,
      [
        flowId,
        nextVersion,
        flow.name,
        flow.description,
        flow.trigger_type,
        typeof flow.trigger_config === "string" ? flow.trigger_config : JSON.stringify(flow.trigger_config || {}),
        flow.entry_node_key,
        JSON.stringify(parsedNodes),
        changelog,
        req.user?.id || null
      ]
    ).catch(() => {});

    // Update parent flow to active
    await db.promise().query(
      "UPDATE wa_flows SET status = 'active', updated_at = NOW() WHERE id = ?",
      [flowId]
    );

    res.json({ success: true, versionNumber: nextVersion, status: "active" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/versions/:versionId/rollback", auth, async (req, res) => {
  try {
    const flowId = req.params.id;
    const versionId = req.params.versionId;

    const [vers] = await db.promise().query(
      "SELECT * FROM wa_flow_versions WHERE id = ? AND flow_id = ?",
      [versionId, flowId]
    );
    if (!vers.length) return res.status(404).json({ error: "Version snapshot not found" });
    const targetVer = vers[0];
    const nodes = typeof targetVer.nodes_snapshot === "string" ? JSON.parse(targetVer.nodes_snapshot) : targetVer.nodes_snapshot;

    // Restore flow settings
    await db.promise().query(
      `UPDATE wa_flows 
       SET name = ?, description = ?, trigger_type = ?, trigger_config = ?, entry_node_key = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        targetVer.name,
        targetVer.description,
        targetVer.trigger_type,
        typeof targetVer.trigger_config === "string" ? targetVer.trigger_config : JSON.stringify(targetVer.trigger_config),
        targetVer.entry_node_key,
        flowId
      ]
    );

    // Restore nodes
    await db.promise().query("DELETE FROM wa_flow_nodes WHERE flow_id = ?", [flowId]);
    for (const node of nodes) {
      await db.promise().query(
        `INSERT INTO wa_flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          flowId,
          node.node_key,
          node.node_type,
          JSON.stringify(node.config || {}),
          node.position_x || 0,
          node.position_y || 0
        ]
      );
    }

    res.json({ success: true, message: `Rolled back to version v${targetVer.version_number}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Flow Analytics & Conversion Funnel ─────────────────────────────────────────
router.get("/:id/analytics", auth, async (req, res) => {
  try {
    const flowId = req.params.id;
    const [[summary]] = await db.promise().query(
      `SELECT 
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'handed_off' THEN 1 ELSE 0 END) as handoff_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
       FROM wa_flow_runs WHERE flow_id = ?`,
      [flowId]
    );

    const [events] = await db.promise().query(
      `SELECT node_key, COUNT(*) as hit_count
       FROM wa_flow_run_events e
       JOIN wa_flow_runs r ON e.run_id = r.id
       WHERE r.flow_id = ?
       GROUP BY node_key ORDER BY hit_count DESC LIMIT 20`,
      [flowId]
    );

    res.json({
      totalRuns: summary?.total_runs || 0,
      completedRuns: summary?.completed_count || 0,
      handoffRuns: summary?.handoff_count || 0,
      activeRuns: summary?.active_count || 0,
      nodeDropoffs: events || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger Main Menu / Flow directly for a Phone Number (CRM Integration) ────
router.post("/send-menu", async (req, res) => {
  try {
    const { phone, flow_id, flowId, sessionKey } = req.body || {};
    if (!phone) return res.status(400).json({ error: "Phone number is required" });
    let cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    let targetFlow = null;
    const requestedId = flow_id || flowId;
    if (requestedId) {
      const [flows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ? LIMIT 1", [requestedId]);
      if (flows.length) targetFlow = flows[0];
    }
    if (!targetFlow) {
      const [flows] = await db.promise().query("SELECT * FROM wa_flows WHERE status = 'active' ORDER BY id ASC LIMIT 1");
      if (flows.length) targetFlow = flows[0];
    }
    if (!targetFlow) {
      const [flows] = await db.promise().query("SELECT * FROM wa_flows ORDER BY id ASC LIMIT 1");
      if (flows.length) targetFlow = flows[0];
    }
    if (!targetFlow) {
      return res.status(404).json({ error: "No WhatsApp flow found" });
    }
    const reqSessionKey = sessionKey || req.headers["x-session-key"] || req.query?.sessionKey || req.user?.id || null;
    const result = await waFlowEngine.startFlowRun(targetFlow, cleanPhone, reqSessionKey);
    res.json({ success: true, message: `Flow "${targetFlow.name}" triggered for +${cleanPhone}`, flowId: targetFlow.id, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Seed Comprehensive Prebuilt Business Chatbot Flows ───────────────────────
router.post("/seed", auth, async (req, res) => {
  try {
    const seedFlows = [
      {
        name: "Food & Products Flow Bot (Interactive Catalog & Orders)",
        description: "Official WhatsApp Cloud API interactive flow bot: Quick reply buttons -> Category List ('View All Categories') -> Product details -> Instant Ordering, Bulk Quote Inquiry capture to CRM, and Sales team handoff.",
        trigger_type: "manual",
        trigger_config: { keywords: ["menu"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "welcome_menu" }, position_x: 260, position_y: 40 },
          {
            node_key: "welcome_menu",
            node_type: "send_buttons",
            config: {
              header_text: "Fresh Foods Trading 🍲",
              text: "Welcome to Fresh Foods Trading! 🍲\nWe have all food items - Retail & Wholesale.\n\nWhat do you want?",
              footer_text: "Tap an option or reply with number",
              buttons: [
                { reply_id: "VIEW_MENU", title: "📦 View Full Menu", next_node_key: "category_list" },
                { reply_id: "GET_PRICE", title: "💰 Get Bulk Price", next_node_key: "ask_bulk_details" },
                { reply_id: "TALK_HUMAN", title: "👨💼 Talk to Sales", next_node_key: "sales_handoff" }
              ]
            },
            position_x: 260,
            position_y: 160
          },
          {
            node_key: "category_list",
            node_type: "send_list",
            config: {
              text: "Select a category to see products 👇",
              button_text: "View All Categories",
              title: "Our Categories",
              rows: [
                { id: "CAT_DRYFRUITS", reply_id: "CAT_DRYFRUITS", title: "Dry Fruits & Nuts", description: "Premium quality 1kg packs", next_node_key: "dryfruits_products" },
                { id: "CAT_PICKLE", reply_id: "CAT_PICKLE", title: "Pickles & Podi", description: "Homemade 500g glass jars", next_node_key: "pickles_products" },
                { id: "CAT_RICE", reply_id: "CAT_RICE", title: "Rice & Grains", description: "Basmati, Millets & Ponni", next_node_key: "rice_products" },
                { id: "CAT_MASALA", reply_id: "CAT_MASALA", title: "Masala & Spices", description: "Fresh ground spice kit", next_node_key: "masala_products" }
              ]
            },
            position_x: 60,
            position_y: 340
          },
          {
            node_key: "dryfruits_products",
            node_type: "send_buttons",
            config: {
              header_text: "🌰 Dry Fruits & Nuts",
              text: "🌰 *Best Dry Fruits & Nuts:*\n\n1. Premium Almonds (Badam) - ₹720/kg\n2. Cashews (Kaju) W320 - ₹850/kg\n3. Walnut Kernels - ₹980/kg\n4. Golden Raisins - ₹320/kg\n\n100% fresh stock with airtight packaging.",
              footer_text: "Click below to order or get bulk rate",
              buttons: [
                { reply_id: "ORDER_NOW", title: "🛒 Order Now", next_node_key: "ask_order_address" },
                { reply_id: "GET_PRICE", title: "💰 Bulk Price", next_node_key: "ask_bulk_details" },
                { reply_id: "BACK_MENU", title: "🔙 Back to Menu", next_node_key: "welcome_menu" }
              ]
            },
            position_x: -180,
            position_y: 520
          },
          {
            node_key: "pickles_products",
            node_type: "send_buttons",
            config: {
              header_text: "🌶️ Pickles & Podi",
              text: "🌶️ *Homemade Pickles & Podi:*\n\n1. Andhra Mango Avakaya (500g) - ₹180\n2. Lemon Pickle (500g) - ₹150\n3. Garlic Spicy Pickle (500g) - ₹210\n4. Traditional Idli/Dosa Podi (250g) - ₹120\n\nAuthentic grandma recipe with zero preservatives.",
              footer_text: "Click below to order or return to menu",
              buttons: [
                { reply_id: "ORDER_NOW", title: "🛒 Order Now", next_node_key: "ask_order_address" },
                { reply_id: "GET_PRICE", title: "💰 Bulk Price", next_node_key: "ask_bulk_details" },
                { reply_id: "BACK_MENU", title: "🔙 Back to Menu", next_node_key: "welcome_menu" }
              ]
            },
            position_x: 60,
            position_y: 520
          },
          {
            node_key: "rice_products",
            node_type: "send_buttons",
            config: {
              header_text: "🌾 Rice & Grains",
              text: "🌾 *Premium Rice & Grains:*\n\n1. Royal XXL Basmati Rice - ₹110/kg\n2. Sona Masoori Raw Rice - ₹58/kg\n3. Organic Foxtail Millet - ₹75/kg\n4. Unpolished Red/Brown Rice - ₹68/kg\n\nAvailable in retail 5kg/10kg and wholesale 25kg bags.",
              buttons: [
                { reply_id: "ORDER_NOW", title: "🛒 Order Now", next_node_key: "ask_order_address" },
                { reply_id: "GET_PRICE", title: "💰 Bulk Price", next_node_key: "ask_bulk_details" },
                { reply_id: "BACK_MENU", title: "🔙 Back to Menu", next_node_key: "welcome_menu" }
              ]
            },
            position_x: 300,
            position_y: 520
          },
          {
            node_key: "masala_products",
            node_type: "send_buttons",
            config: {
              header_text: "🌿 Masala & Spices",
              text: "🌿 *Pure Ground Spices:*\n\n1. Guntur Red Chilli Powder (1kg) - ₹340\n2. Salem Turmeric Powder (1kg) - ₹280\n3. Malabar Black Pepper (500g) - ₹420\n4. Garam Masala Blend (500g) - ₹290\n\nCold-ground for maximum aroma and flavor.",
              buttons: [
                { reply_id: "ORDER_NOW", title: "🛒 Order Now", next_node_key: "ask_order_address" },
                { reply_id: "GET_PRICE", title: "💰 Bulk Price", next_node_key: "ask_bulk_details" },
                { reply_id: "BACK_MENU", title: "🔙 Back to Menu", next_node_key: "welcome_menu" }
              ]
            },
            position_x: 540,
            position_y: 520
          },
          {
            node_key: "ask_bulk_details",
            node_type: "collect_input",
            config: {
              prompt_text: "Great! Please reply with:\n1. Product Name\n2. Quantity you need (e.g. 10kg, 50kg)\n3. Your City\n\nOur team will send wholesale discounted price in 2 mins.",
              var_key: "bulk_enquiry",
              validation_type: "none",
              next_node_key: "save_bulk_lead"
            },
            position_x: 480,
            position_y: 260
          },
          {
            node_key: "save_bulk_lead",
            node_type: "create_lead",
            config: {
              default_service: "Wholesale Food Enquiry",
              notes: "Bulk Requirement: {{bulk_enquiry}}",
              next_node_key: "confirm_bulk"
            },
            position_x: 480,
            position_y: 380
          },
          {
            node_key: "confirm_bulk",
            node_type: "send_buttons",
            config: {
              header_text: "Quotation Requested ✅",
              text: "Thank you! We received your bulk requirement:\n\n\"{{bulk_enquiry}}\"\n\nOur wholesale executive is preparing your best quote right now.",
              buttons: [
                { reply_id: "BACK_MENU", title: "🏠 Main Menu", next_node_key: "welcome_menu" },
                { reply_id: "TALK_HUMAN", title: "👨💼 Talk to Sales", next_node_key: "sales_handoff" }
              ]
            },
            position_x: 480,
            position_y: 490
          },
          {
            node_key: "ask_order_address",
            node_type: "collect_input",
            config: {
              prompt_text: "Perfect! Please reply with your full delivery address and quantity.\nExample: 2kg Dry Fruits Mix, 1kg Pickle - Avinashi, Tiruppur",
              var_key: "order_details",
              validation_type: "none",
              next_node_key: "save_order_lead"
            },
            position_x: 180,
            position_y: 720
          },
          {
            node_key: "save_order_lead",
            node_type: "create_lead",
            config: {
              default_service: "Direct Food Order",
              notes: "Customer Order: {{order_details}}",
              next_node_key: "confirm_order"
            },
            position_x: 180,
            position_y: 840
          },
          {
            node_key: "confirm_order",
            node_type: "send_buttons",
            config: {
              header_text: "Order Received 🎉",
              text: "Thank you for ordering! 📦\n\n*Delivery Details:*\n{{order_details}}\n\nOur team has registered your order and will message invoice & dispatch tracker in 10 mins.",
              buttons: [
                { reply_id: "BACK_MENU", title: "🏠 Main Menu", next_node_key: "welcome_menu" },
                { reply_id: "TALK_HUMAN", title: "👨💼 Talk to Sales", next_node_key: "sales_handoff" }
              ]
            },
            position_x: 180,
            position_y: 960
          },
          {
            node_key: "sales_handoff",
            node_type: "handoff",
            config: {
              note: "Connecting you to sales team... 👨💼\nOur executive will call you in 10 mins. Or call us directly: +91 9876543210"
            },
            position_x: 740,
            position_y: 260
          }
        ]
      },
      {
        name: "Interactive Banking & Account Services Bot",
        description: "Multi-section interactive banking menu with structured button options, instant FD, account balance lookup, card applications, loan eligibility checks, and live agent handoff.",
        trigger_type: "manual",
        trigger_config: { keywords: ["banking", "bank"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "banking_menu" }, position_x: 280, position_y: 40 },
          {
            node_key: "banking_menu",
            node_type: "interactive_menu",
            config: {
              text: "Good Afternoon, {{customer.name}} 🍀🙂\n\nPlease type any bank related query or select from the options below",
              sections: [
                {
                  title: "Bank Services",
                  buttons: [
                    { id: "account_balance", label: "Account Balance", nextNodeId: "lookup_balance" },
                    { id: "instant_fd", label: "Instant FD", nextNodeId: "fd_calculator" },
                    { id: "credit_card_due", label: "Credit Card Bill Due", nextNodeId: "card_bill_flow" }
                  ]
                },
                {
                  title: "Explore more! ⭐",
                  buttons: [
                    { id: "credit_card_fd", label: "Credit Card on FD", nextNodeId: "card_fd_flow" },
                    { id: "apply_card", label: "Apply New Card", nextNodeId: "apply_card_flow" },
                    { id: "loan_offers", label: "Loan Offers", nextNodeId: "check_loan_eligibility" }
                  ]
                },
                {
                  title: "Looking for something else? 🔍",
                  buttons: [
                    { id: "live_agent", label: "Live Agent", nextNodeId: "agent_transfer" }
                  ]
                }
              ]
            },
            position_x: 280,
            position_y: 160
          },
          {
            node_key: "lookup_balance",
            node_type: "crm_lookup",
            config: {
              lookup_type: "customer",
              next_node_key: "show_balance_msg"
            },
            position_x: 60,
            position_y: 320
          },
          {
            node_key: "show_balance_msg",
            node_type: "interactive_menu",
            config: {
              text: "💳 *Account Summary for {{customer.name}}:*\n\n• Available Balance: *₹45,280.00*\n• Account: *XXXX-XXXX-4812*\n• Last Updated: {{current.date}}\n\nNeed a detailed mini statement?",
              sections: [
                {
                  title: "Actions",
                  buttons: [
                    { id: "mini_stmt", label: "Mini Statement (PDF)", nextNodeId: "send_stmt_pdf" },
                    { id: "back_main", label: "🏠 Main Menu", nextNodeId: "banking_menu" }
                  ]
                }
              ]
            },
            position_x: 60,
            position_y: 460
          },
          {
            node_key: "send_stmt_pdf",
            node_type: "send_message",
            config: {
              text: "📄 Your last 10 transactions statement has been generated: https://madhurabank.example.com/stmt_4812.pdf\n\nReply MENU to return to main options.",
              next_node_key: "end"
            },
            position_x: 60,
            position_y: 600
          },
          {
            node_key: "fd_calculator",
            node_type: "interactive_menu",
            config: {
              text: "💰 *Instant Fixed Deposit (FD)*\n\nEarn up to *7.85% p.a.* interest with zero paperwork!\n\nChoose your preferred tenure:",
              sections: [
                {
                  title: "Tenures",
                  buttons: [
                    { id: "fd_1yr", label: "1 Year @ 7.25%", nextNodeId: "book_fd_lead" },
                    { id: "fd_3yr", label: "3 Years @ 7.85%", nextNodeId: "book_fd_lead" },
                    { id: "back_main2", label: "🏠 Main Menu", nextNodeId: "banking_menu" }
                  ]
                }
              ]
            },
            position_x: 280,
            position_y: 320
          },
          {
            node_key: "book_fd_lead",
            node_type: "create_lead",
            config: {
              default_service: "Instant FD Application",
              notes: "Customer applied for Fixed Deposit via WhatsApp bot. Selected tenure: {{selected.option}}",
              next_node_key: "fd_success_msg"
            },
            position_x: 280,
            position_y: 460
          },
          {
            node_key: "fd_success_msg",
            node_type: "send_message",
            config: {
              text: "✅ Congratulations! Your Instant FD request has been initiated. Our relationship manager will verify your details within 15 minutes.\n\nReference ID: #FD-{{date}}-8891",
              next_node_key: "end"
            },
            position_x: 280,
            position_y: 600
          },
          {
            node_key: "card_bill_flow",
            node_type: "interactive_menu",
            config: {
              text: "💳 *Credit Card Bill Status*\n\nCard: *Platinum Rewards (ending 9021)*\n• Total Due: *₹18,450.00*\n• Minimum Due: *₹1,200.00*\n• Due Date: *10th of this month*",
              sections: [
                {
                  title: "Payment Options",
                  buttons: [
                    { id: "pay_now", label: "Pay Total Due (UPI)", nextNodeId: "send_pay_link" },
                    { id: "pay_min", label: "Pay Min Due", nextNodeId: "send_pay_link" },
                    { id: "back_main3", label: "🏠 Main Menu", nextNodeId: "banking_menu" }
                  ]
                }
              ]
            },
            position_x: 500,
            position_y: 320
          },
          {
            node_key: "send_pay_link",
            node_type: "send_message",
            config: {
              text: "⚡ Instant UPI Payment Link: https://pay.madhurabank.example.com/bill/9021\n\nInstant confirmation will be sent upon payment receipt.",
              next_node_key: "end"
            },
            position_x: 500,
            position_y: 460
          },
          {
            node_key: "card_fd_flow",
            node_type: "send_message",
            config: {
              text: "🌟 *Credit Card Against FD*\nGet 90% credit limit against your fixed deposit with zero CIBIL checks and instant activation!\n\nLink to apply: https://cards.madhurabank.example.com/card-on-fd",
              next_node_key: "end"
            },
            position_x: 720,
            position_y: 320
          },
          {
            node_key: "apply_card_flow",
            node_type: "collect_input",
            config: {
              prompt_text: "Please enter your monthly take-home income (e.g. 50000):",
              var_key: "income",
              next_node_key: "check_card_eligibility"
            },
            position_x: 720,
            position_y: 460
          },
          {
            node_key: "check_card_eligibility",
            node_type: "condition",
            config: {
              subject_key: "income",
              operator: "greater_or_equal",
              value: "25000",
              true_next: "card_eligible_msg",
              false_next: "card_fd_flow"
            },
            position_x: 720,
            position_y: 600
          },
          {
            node_key: "card_eligible_msg",
            node_type: "send_message",
            config: {
              text: "🎉 You are pre-approved for our *Lifetime Free Titanium Card* with ₹1,50,000 credit limit!\n\nComplete your KYC in 2 mins: https://cards.madhurabank.example.com/kyc",
              next_node_key: "end"
            },
            position_x: 720,
            position_y: 740
          },
          {
            node_key: "check_loan_eligibility",
            node_type: "interactive_menu",
            config: {
              text: "🏡 *Instant Loan Offers for {{customer.name}}*\n\nSelect a loan type to check customized interest rates & eligibility:",
              sections: [
                {
                  title: "Loan Types",
                  buttons: [
                    { id: "home_loan", label: "Home Loan @ 8.40%", nextNodeId: "lead_home_loan" },
                    { id: "personal_loan", label: "Personal Loan @ 10.5%", nextNodeId: "lead_personal_loan" },
                    { id: "car_loan", label: "Car Loan @ 8.75%", nextNodeId: "lead_car_loan" }
                  ]
                }
              ]
            },
            position_x: 940,
            position_y: 320
          },
          {
            node_key: "lead_home_loan",
            node_type: "create_lead",
            config: {
              default_service: "Home Loan Inquiry",
              notes: "Customer checked Home Loan offers via WhatsApp interactive bot",
              next_node_key: "loan_ack_msg"
            },
            position_x: 940,
            position_y: 460
          },
          {
            node_key: "lead_personal_loan",
            node_type: "create_lead",
            config: {
              default_service: "Personal Loan Inquiry",
              notes: "Customer checked Personal Loan offers via WhatsApp interactive bot",
              next_node_key: "loan_ack_msg"
            },
            position_x: 940,
            position_y: 540
          },
          {
            node_key: "lead_car_loan",
            node_type: "create_lead",
            config: {
              default_service: "Car Loan Inquiry",
              notes: "Customer checked Car Loan offers via WhatsApp interactive bot",
              next_node_key: "loan_ack_msg"
            },
            position_x: 940,
            position_y: 620
          },
          {
            node_key: "loan_ack_msg",
            node_type: "send_message",
            config: {
              text: "✅ Thank you! Our loan expert will call you within 30 minutes with customized sanction terms & EMI schedule.",
              next_node_key: "end"
            },
            position_x: 940,
            position_y: 740
          },
          {
            node_key: "agent_transfer",
            node_type: "handoff",
            config: {
              note: "Customer selected Live Agent handoff from interactive banking menu"
            },
            position_x: 1160,
            position_y: 320
          },
          {
            node_key: "end",
            node_type: "end",
            config: {},
            position_x: 600,
            position_y: 900
          }
        ]
      },
      {
        name: "Interactive Main Business & Services Menu",
        description: "24/7 Universal WhatsApp receptionist: Services, Instant Appointment Booking, Working Hours, and Live Agent Transfer for all inbound chats.",
        trigger_type: "manual",
        trigger_config: { keywords: ["menu"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "main_menu" } },
          {
            node_key: "main_menu",
            node_type: "send_buttons",
            config: {
              text: "👋 {Hi|Hello|Greetings} {name}! Welcome to {company}.\nHow can we help you today? Tap an option below 👇",
              footer_text: "Madhura Tech Smart Assistant • Reply MENU anytime",
              buttons: [
                { reply_id: "opt_services", title: "🛠️ Our Services", next_node_key: "services_menu" },
                { reply_id: "opt_booking", title: "📅 Book Service", next_node_key: "ask_booking_date" },
                { reply_id: "opt_hours", title: "🕒 Hours & Address", next_node_key: "hours_info" },
                { reply_id: "opt_agent", title: "👤 Live Agent", next_node_key: "agent_handoff" },
              ]
            }
          },
          {
            node_key: "services_menu",
            node_type: "send_buttons",
            config: {
              text: "🛠️ *Our Core Solutions across {city}:*\n• Commercial HVAC & AC Maintenance\n• Comprehensive AMC Contracts\n• Electrical & Fire Safety Compliance\n\nWould you like our brochure or request an instant quote?",
              buttons: [
                { reply_id: "opt_brochure", title: "📄 Send Brochure", next_node_key: "send_brochure_pdf" },
                { reply_id: "opt_quote", title: "💼 Request Quote", next_node_key: "ask_quote_service" },
                { reply_id: "opt_back", title: "🔙 Back to Menu", next_node_key: "main_menu" },
              ]
            }
          },
          {
            node_key: "send_brochure_pdf",
            node_type: "send_message",
            config: {
              text: "📄 Here is our complete Service & AMC Catalog for {company}:\nhttps://madhuratech.com/catalog.pdf\n\nReply MENU anytime to return to the main menu.",
              next_node_key: "end"
            }
          },
          {
            node_key: "ask_quote_service",
            node_type: "collect_input",
            config: {
              prompt_text: "Please describe what service or equipment you need a quote for:",
              var_key: "service_inquiry",
              next_node_key: "save_quote_lead"
            }
          },
          {
            node_key: "save_quote_lead",
            node_type: "create_lead",
            config: {
              default_service: "Quotation Request",
              notes: "WhatsApp Quotation Request: {service_inquiry}",
              next_node_key: "thank_you_quote"
            }
          },
          {
            node_key: "thank_you_quote",
            node_type: "send_message",
            config: {
              text: "✅ Thank you {name}! Your inquiry for *{service_inquiry}* has been sent to our estimation engineers. We will send the proposal shortly.",
              next_node_key: "end"
            }
          },
          {
            node_key: "ask_booking_date",
            node_type: "collect_input",
            config: {
              prompt_text: "📅 Which date would you like to schedule your service appointment for? (e.g. Tomorrow or 25 Aug)",
              var_key: "booking_date",
              next_node_key: "ask_booking_city"
            }
          },
          {
            node_key: "ask_booking_city",
            node_type: "collect_input",
            config: {
              prompt_text: "Which city/area is the service location in? (e.g. Bangalore, Chennai)",
              var_key: "booking_city",
              next_node_key: "save_appointment_lead"
            }
          },
          {
            node_key: "save_appointment_lead",
            node_type: "create_lead",
            config: {
              default_service: "Service Appointment",
              notes: "Service Appointment Booked: Date {booking_date} in {booking_city}",
              next_node_key: "confirm_appointment_msg"
            }
          },
          {
            node_key: "confirm_appointment_msg",
            node_type: "send_message",
            config: {
              text: "🎉 Appointment Confirmed!\n• *Date:* {booking_date}\n• *Location:* {booking_city}\n• *Service:* AMC & Inspection\n\nOur technician will arrive between {start_time} and {end_time}. Thank you for choosing {company}!",
              next_node_key: "end"
            }
          },
          {
            node_key: "hours_info",
            node_type: "send_message",
            config: {
              text: "🕒 *{company} Working Hours & Info:*\n• Monday to Saturday: {start_time} – {end_time}\n• Location: {city}\n• Emergency Hotline: +91 98765 43210\n\nReply MENU anytime to view the main menu.",
              next_node_key: "end"
            }
          },
          {
            node_key: "agent_handoff",
            node_type: "handoff",
            config: { note: "Connecting you with our support specialist. Please stay online." }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "Live CRM Invoice & Payment Status Lookup Bot",
        description: "Allows customers to query their latest invoice, due date, outstanding amount, and payment options automatically from CRM database.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["invoice", "bill", "payment", "due", "pay", "receipt", "account"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "crm_lookup_invoice" } },
          {
            node_key: "crm_lookup_invoice",
            node_type: "crm_lookup",
            config: {
              lookup_type: "invoice",
              branch_on_result: true,
              found_next: "show_invoice_details",
              not_found_next: "no_invoice_found"
            }
          },
          {
            node_key: "show_invoice_details",
            node_type: "send_buttons",
            config: {
              text: "📄 *Invoice Details for {customer_name}:*\n• *Invoice #:* {invoice_no}\n• *Total Amount:* {amount}\n• *Status:* {payment_status}\n• *Due Date:* {due_date}\n\nWould you like to pay online or download the PDF?",
              buttons: [
                { reply_id: "pay_now", title: "💳 Pay Online Link", next_node_key: "send_pay_link" },
                { reply_id: "download_pdf", title: "📥 Download PDF", next_node_key: "send_invoice_pdf" },
                { reply_id: "billing_agent", title: "👤 Billing Support", next_node_key: "handoff_billing" }
              ]
            }
          },
          {
            node_key: "send_pay_link",
            node_type: "send_message",
            config: {
              text: "💳 You can securely pay invoice *{invoice_no}* ({amount}) online via UPI, NetBanking or Cards:\nhttps://pay.madhuratech.in/{invoice_no}\n\nOnce paid, your payment receipt will be generated instantly!",
              next_node_key: "end"
            }
          },
          {
            node_key: "send_invoice_pdf",
            node_type: "send_message",
            config: {
              text: "📥 Here is your official invoice copy:\nhttps://madhuratech.com/invoices/{invoice_no}.pdf\n\nThank you for your business with {company}!",
              next_node_key: "end"
            }
          },
          {
            node_key: "no_invoice_found",
            node_type: "send_buttons",
            config: {
              text: "🔍 We couldn't find an open invoice for this phone number.\nWould you like our accounts desk to verify your details?",
              buttons: [
                { reply_id: "check_agent", title: "👤 Talk to Accounts", next_node_key: "handoff_billing" },
                { reply_id: "back_home", title: "🏠 Main Menu", next_node_key: "end" }
              ]
            }
          },
          {
            node_key: "handoff_billing",
            node_type: "handoff",
            config: { note: "Connecting to Accounts & Billing desk regarding invoice inquiries." }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "AMC Contract Expiry & Service Renewal Bot",
        description: "Checks active AMC contracts from CRM database and assists customers in scheduling regular service or renewing expiring contracts.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["amc", "contract", "renewal", "maintenance", "service visit"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "crm_lookup_amc" } },
          {
            node_key: "crm_lookup_amc",
            node_type: "crm_lookup",
            config: {
              lookup_type: "amc",
              branch_on_result: true,
              found_next: "show_amc_status",
              not_found_next: "no_amc_found"
            }
          },
          {
            node_key: "show_amc_status",
            node_type: "send_buttons",
            config: {
              text: "🛡️ *AMC Contract Status for {customer_name}:*\n• *Contract #:* {amc_contract_no}\n• *Service Type:* {amc_service}\n• *Status:* {amc_status}\n• *Valid Until:* {amc_expiry}\n\nHow can we help with your maintenance?",
              buttons: [
                { reply_id: "book_visit", title: "📅 Schedule Visit", next_node_key: "ask_visit_date" },
                { reply_id: "renew_amc", title: "🔄 Renew AMC", next_node_key: "ask_amc_renewal" },
                { reply_id: "amc_desk", title: "👤 AMC Helpdesk", next_node_key: "handoff_amc" }
              ]
            }
          },
          {
            node_key: "ask_visit_date",
            node_type: "collect_input",
            config: {
              prompt_text: "📅 Please enter your preferred date for the technician visit:",
              var_key: "visit_date",
              next_node_key: "confirm_amc_visit"
            }
          },
          {
            node_key: "confirm_amc_visit",
            node_type: "send_message",
            config: {
              text: "✅ AMC Inspection scheduled for *{visit_date}* under Contract #{amc_contract_no}. An engineer will reach out prior to visit!",
              next_node_key: "end"
            }
          },
          {
            node_key: "ask_amc_renewal",
            node_type: "create_lead",
            config: {
              default_service: "AMC Contract Renewal",
              notes: "Requested AMC Contract Renewal for #{amc_contract_no}",
              next_node_key: "confirm_amc_renewal"
            }
          },
          {
            node_key: "confirm_amc_renewal",
            node_type: "send_message",
            config: {
              text: "🎉 Thank you {name}! Our AMC Renewal Manager will send you an exclusive renewal quote with early bird benefits shortly.",
              next_node_key: "end"
            }
          },
          {
            node_key: "no_amc_found",
            node_type: "send_buttons",
            config: {
              text: "🛡️ No active AMC contract found for your number. Would you like a free inspection & AMC quotation?",
              buttons: [
                { reply_id: "get_amc_quote", title: "💼 Get AMC Quote", next_node_key: "ask_amc_renewal" },
                { reply_id: "talk_rep", title: "👤 Talk to Specialist", next_node_key: "handoff_amc" }
              ]
            }
          },
          {
            node_key: "handoff_amc",
            node_type: "handoff",
            config: { note: "Connecting to AMC contracts & technical support desk." }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "Instant Quotation & Lead Qualifier Bot",
        description: "Step-by-step qualification tree collecting customer name, equipment size, location, and automatically creates qualified CRM leads.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["quote", "price", "pricing", "cost", "estimate", "rate"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "ask_name" } },
          {
            node_key: "ask_name",
            node_type: "collect_input",
            config: {
              prompt_text: "👋 Welcome to {company}! What is your full name or company name?",
              var_key: "lead_name",
              next_node_key: "ask_service_type"
            }
          },
          {
            node_key: "ask_service_type",
            node_type: "send_buttons",
            config: {
              text: "Nice to meet you, {lead_name}! Which service category are you looking for?",
              buttons: [
                { reply_id: "opt_ac", title: "❄️ HVAC / AC AMC", next_node_key: "ask_location" },
                { reply_id: "opt_elec", title: "⚡ Electrical Audit", next_node_key: "ask_location" },
                { reply_id: "opt_fire", title: "🧯 Fire Safety", next_node_key: "ask_location" }
              ]
            }
          },
          {
            node_key: "ask_location",
            node_type: "collect_input",
            config: {
              prompt_text: "Which city/area is your site located in?",
              var_key: "lead_city",
              next_node_key: "save_qualified_lead"
            }
          },
          {
            node_key: "save_qualified_lead",
            node_type: "create_lead",
            config: {
              default_service: "{selected_option}",
              notes: "Qualified Lead: {lead_name} in {lead_city} interested in {selected_option}",
              next_node_key: "thank_you_qualified"
            }
          },
          {
            node_key: "thank_you_qualified",
            node_type: "send_message",
            config: {
              text: "🎉 Thank you {lead_name}!\nYour quotation request for *{selected_option}* in *{lead_city}* has been registered in our CRM.\n\nOur project engineer will contact you shortly with a personalized proposal!",
              next_node_key: "end"
            }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "24/7 VIP Support Desk & Live Agent Handoff",
        description: "Handles emergency service requests, ticket logging, and transfers urgent complaints directly to human agents in Live Chat.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["support", "agent", "human", "complaint", "issue", "emergency", "breakdown"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "support_menu" } },
          {
            node_key: "support_menu",
            node_type: "send_buttons",
            config: {
              text: "🛠️ *{company} Support & Service Desk*\nHow can we help resolve your issue today?",
              buttons: [
                { reply_id: "opt_breakdown", title: "🚨 Emergency Breakdown", next_node_key: "ask_emergency_details" },
                { reply_id: "opt_status", title: "📋 Service Ticket Status", next_node_key: "crm_lookup_ticket" },
                { reply_id: "opt_live_agent", title: "👤 Live Support Agent", next_node_key: "live_handoff" }
              ]
            }
          },
          {
            node_key: "ask_emergency_details",
            node_type: "collect_input",
            config: {
              prompt_text: "🚨 Please describe the breakdown or emergency issue and site location:",
              var_key: "emergency_note",
              next_node_key: "save_emergency_lead"
            }
          },
          {
            node_key: "save_emergency_lead",
            node_type: "create_lead",
            config: {
              default_service: "Emergency Breakdown",
              notes: "URGENT BREAKDOWN REPORT: {emergency_note}",
              next_node_key: "live_handoff"
            }
          },
          {
            node_key: "crm_lookup_ticket",
            node_type: "send_message",
            config: {
              text: "📋 Checking your recent service requests... Your ticket for *{service}* is currently assigned to a senior technician. Expected resolution by {end_time}.",
              next_node_key: "end"
            }
          },
          {
            node_key: "live_handoff",
            node_type: "handoff",
            config: { note: "🚨 Urgent support request transferred to Live Chat agent desk." }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "Customer Feedback & Google Review Collector",
        description: "Post-service CSAT rating collector (1-5 Stars). 5-star ratings get Google Review link; lower ratings route to quality assurance team.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["feedback", "review", "rate", "rating", "survey"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "ask_rating" } },
          {
            node_key: "ask_rating",
            node_type: "send_buttons",
            config: {
              text: "🌟 {Hi|Hello} {name}! How satisfied were you with our recent service by {company}?",
              buttons: [
                { reply_id: "rate_5", title: "⭐⭐⭐⭐⭐ Excellent (5)", next_node_key: "rating_5_branch" },
                { reply_id: "rate_4", title: "⭐⭐⭐⭐ Good (4)", next_node_key: "rating_5_branch" },
                { reply_id: "rate_low", title: "⚠️ Needs Improvement (1-3)", next_node_key: "rating_low_branch" }
              ]
            }
          },
          {
            node_key: "rating_5_branch",
            node_type: "send_message",
            config: {
              text: "🎉 We are thrilled to hear that, {name}! Could you take 30 seconds to share your review on Google? It helps us tremendously:\n👉 https://g.page/r/madhuratech/review\n\nThank you for choosing {company}!",
              next_node_key: "end"
            }
          },
          {
            node_key: "rating_low_branch",
            node_type: "collect_input",
            config: {
              prompt_text: "We apologize that our service did not meet your full expectations. Please share what we can improve:",
              var_key: "feedback_comment",
              next_node_key: "save_feedback_lead"
            }
          },
          {
            node_key: "save_feedback_lead",
            node_type: "create_lead",
            config: {
              default_service: "Quality Escalation",
              notes: "Service Feedback (Escalation): {feedback_comment}",
              next_node_key: "thank_you_feedback"
            }
          },
          {
            node_key: "thank_you_feedback",
            node_type: "send_message",
            config: {
              text: "🙏 Thank you for your honest feedback. Our Quality Assurance Head has been notified and will contact you to resolve this immediately.",
              next_node_key: "end"
            }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      }
    ];

    for (const f of seedFlows) {
      const [existing] = await db.promise().query("SELECT id FROM wa_flows WHERE name = ?", [f.name]);
      let flowId = null;
      if (existing.length > 0) {
        flowId = existing[0].id;
        await db.promise().query(
          "UPDATE wa_flows SET description=?, trigger_type=?, trigger_config=?, entry_node_key=?, status='active', updated_at=NOW() WHERE id=?",
          [f.description, f.trigger_type, JSON.stringify(f.trigger_config), f.entry_node_key, flowId]
        );
      } else {
        const [resFlow] = await db.promise().query(
          `INSERT INTO wa_flows (name, description, status, trigger_type, trigger_config, entry_node_key, created_by)
           VALUES (?, ?, 'active', ?, ?, ?, ?)`,
          [f.name, f.description, f.trigger_type, JSON.stringify(f.trigger_config), f.entry_node_key, req.user?.id || null]
        );
        flowId = resFlow.insertId;
      }

      // Re-insert nodes
      await db.promise().query("DELETE FROM wa_flow_nodes WHERE flow_id = ?", [flowId]);
      let yPos = 100;
      for (const node of f.nodes) {
        await db.promise().query(
          `INSERT INTO wa_flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [flowId, node.node_key, node.node_type, JSON.stringify(node.config || {}), 150, yPos]
        );
        yPos += 120;
      }
    }

    const [allFlows] = await db.promise().query(
      `SELECT f.*, 
        (SELECT COUNT(*) FROM wa_flow_nodes n WHERE n.flow_id = f.id) as node_count,
        (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'active') as active_runs
       FROM wa_flows f
       ORDER BY f.created_at DESC`
    );
    res.json({ success: true, count: allFlows.length, flows: allFlows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
