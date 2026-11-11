"use strict";

const router = require("express").Router();
const db = require("../config/database");
const store = require("../services/flowStore").createFlowStore(db);
const definition = require("../services/flowDefinition");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");

router.use(verifyToken, requireTenantContext, require("../middleware/workspaceModule").workspaceModule("flows"));
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

const route = (work) => async (req, res) => {
  try {
    await work(req, res);
  } catch (error) {
    res.status(error.status || 503).json({
      error: error.status ? error.message : "Flow operation failed; retry or contact your administrator",
    });
  }
};

router.get(
  "/",
  route(async (req, res) =>
    res.json(
      await store.query(
        `SELECT f.*,
          (SELECT COUNT(*) FROM wa_flow_nodes n WHERE n.flow_id=f.id) AS node_count,
          (SELECT COUNT(*) FROM wa_flow_versions v WHERE v.flow_id=f.id AND v.status='published') AS published_count,
          (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id=f.id AND r.status='active') AS active_runs,
          (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id=f.id AND r.status='completed') AS completed_runs,
          (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id=f.id AND r.status='handed_off') AS handoff_runs
         FROM wa_flows f WHERE f.tenant_id=? ORDER BY f.created_at DESC LIMIT 500`,
        [req.tenantId]
      )
    )
  )
);

router.get(
  "/library",
  route(async (req, res) => {
    const enterprise = require("../services/enterpriseWorkflowTemplates");
    res.json([
      ...require("../services/prebuiltFlows"),
      ...require("../services/serviceFlowBlueprints"),
      ...enterprise.FLAGSHIP_TEMPLATES,
      ...require("../services/industryFlowBlueprints"),
    ]);
  })
);

router.get(
  "/hub",
  route(async (req, res) => {
    const enterprise = require("../services/enterpriseWorkflowTemplates");
    const catalog = enterprise.getHubCatalog();
    const existing = await store
      .query("SELECT id, name, status, trigger_config FROM wa_flows WHERE tenant_id=? ORDER BY id DESC LIMIT 500", [req.tenantId])
      .catch(() => []);
    const installedByKey = {};
    for (const f of existing) {
      try {
        const tc = typeof f.trigger_config === "string" ? JSON.parse(f.trigger_config) : (f.trigger_config || {});
        if (tc.template_key) {
          installedByKey[tc.template_key] = { id: f.id, name: f.name, status: f.status };
        }
      } catch (_) {}
    }
    const [aptCnt] = await store.query("SELECT COUNT(*) AS cnt FROM wa_appointments WHERE tenant_id=?", [req.tenantId]).catch(() => [{ cnt: 0 }]);
    const [tktCnt] = await store.query("SELECT COUNT(*) AS cnt FROM wa_support_tickets WHERE tenant_id=? AND status IN ('open','escalated')", [req.tenantId]).catch(() => [{ cnt: 0 }]);
    const [ordCnt] = await store.query("SELECT COUNT(*) AS cnt FROM wa_crm_orders WHERE tenant_id=?", [req.tenantId]).catch(() => [{ cnt: 0 }]);
    const [aprCnt] = await store.query("SELECT COUNT(*) AS cnt FROM wa_approval_requests WHERE tenant_id=? AND status='pending'", [req.tenantId]).catch(() => [{ cnt: 0 }]);
    const [alertCnt] = await store.query("SELECT COUNT(*) AS cnt FROM wa_flow_error_alerts WHERE tenant_id=? AND status='open'", [req.tenantId]).catch(() => [{ cnt: 0 }]);

    res.json({
      success: true,
      ...catalog,
      installedByKey,
      metrics: {
        appointments: Number(aptCnt?.cnt || 0),
        openTickets: Number(tktCnt?.cnt || 0),
        orders: Number(ordCnt?.cnt || 0),
        pendingApprovals: Number(aprCnt?.cnt || 0),
        openAlerts: Number(alertCnt?.cnt || 0),
      },
    });
  })
);

router.post(
  "/hub/install",
  route(async (req, res) => {
    const enterprise = require("../services/enterpriseWorkflowTemplates");
    const { systemId, templateKeys, connectionMode, autoPublish } = req.body || {};
    const result = await enterprise.installHubTemplates({
      db,
      tenantId: req.tenantId,
      userId: req.user.id,
      systemId: systemId || null,
      templateKeys: Array.isArray(templateKeys) ? templateKeys : [],
      connectionMode: connectionMode === "business" ? "business" : "builtin",
      autoPublish: Boolean(autoPublish),
    });
    res.status(201).json(result);
  })
);

router.get(
  "/senders",
  route(async (req, res) => {
    const cloudSenders = await store
      .query(
        "SELECT id, display_phone, verified_name, status, 'cloud' AS channel FROM wa_senders WHERE tenant_id=? ORDER BY id LIMIT 100",
        [req.tenantId]
      )
      .catch(() => []);
    const webAccounts = await store
      .query(
        `SELECT a.id, a.session_key, a.phone_number AS display_phone, a.account_name AS verified_name,
                CASE WHEN a.is_active=1 THEN 'connected' ELSE 'disconnected' END AS status,
                'web_session' AS channel
         FROM wa_accounts a
         LEFT JOIN users u ON u.id=a.created_by
         WHERE COALESCE(u.tenant_id, ?) = ?
         ORDER BY a.id LIMIT 100`,
        [req.tenantId, req.tenantId]
      )
      .catch(() => []);

    const list = [
      ...cloudSenders.map((s) => ({
        id: String(s.id),
        label: `${s.verified_name || "Cloud Number"} (${s.display_phone || `#${s.id}`})`,
        display_phone: s.display_phone,
        verified_name: s.verified_name,
        channel: "cloud",
        status: s.status || "connected",
      })),
      ...webAccounts.map((a) => ({
        id: `web:${a.session_key || a.id}`,
        label: `${a.verified_name || "WhatsApp Web"} (${a.display_phone || "QR Session"})`,
        display_phone: a.display_phone,
        verified_name: a.verified_name,
        channel: "web_session",
        status: a.status,
      })),
    ];
    res.json({ senders: list });
  })
);

router.get(
  "/agents",
  route(async (req, res) => {
    const agents = await store
      .query(
        "SELECT id, first_name, last_name, email, role FROM users WHERE tenant_id=? ORDER BY first_name, id LIMIT 200",
        [req.tenantId]
      )
      .catch(() => []);
    res.json({
      agents: agents.map((u) => ({
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || `User #${u.id}`,
        email: u.email,
        role: u.role,
      })),
    });
  })
);

router.get(
  "/chat-status",
  route(async (req, res) => {
    const conversationId = req.query.conversationId ? Number(req.query.conversationId) : null;
    const rawPhone = String(req.query.phone || "").replace(/\D/g, "");
    const clean10 = rawPhone.slice(-10);

    let activeRun = null;
    if (conversationId) {
      const mem = require("../services/sharedFlowRuntime").activeState(req.tenantId, conversationId);
      if (mem) {
        activeRun = {
          runId: mem.runId,
          flowId: mem.flow?.id,
          flowName: mem.flow?.name,
          currentNode: mem.state?.currentNodeKey || mem.flow?.entry_node_key || "Active",
          status: "active",
        };
      }
    }

    if (!activeRun && (conversationId || clean10.length >= 8)) {
      const rows = await store
        .query(
          conversationId
            ? `SELECT r.id AS runId, r.flow_id AS flowId, f.name AS flowName, r.current_node_key AS currentNode, r.status
               FROM wa_flow_runs r JOIN wa_flows f ON f.id=r.flow_id
               WHERE f.tenant_id=? AND r.conversation_id=? AND r.status='active' ORDER BY r.id DESC LIMIT 1`
            : `SELECT r.id AS runId, r.flow_id AS flowId, f.name AS flowName, r.current_node_key AS currentNode, r.status
               FROM wa_flow_runs r JOIN wa_flows f ON f.id=r.flow_id
               WHERE f.tenant_id=? AND (r.phone LIKE ? OR r.phone=?) AND r.status='active' ORDER BY r.id DESC LIMIT 1`,
          conversationId ? [req.tenantId, conversationId] : [req.tenantId, `%${clean10}`, rawPhone]
        )
        .catch(() => []);
      if (rows[0]) activeRun = rows[0];
    }

    let botPaused = false;
    if (clean10.length >= 8) {
      const gate = await require("../services/waBotGate").shouldBotEngage(rawPhone).catch(() => ({ allowed: true }));
      botPaused = !gate.allowed && gate.reason === "agent_takeover";
    }

    res.json({ success: true, activeRun, botPaused });
  })
);

router.post(
  "/stop-chat-bot",
  route(async (req, res) => {
    const conversationId = req.body.conversationId ? Number(req.body.conversationId) : null;
    const rawPhone = String(req.body.phone || "").replace(/\D/g, "");
    const clean10 = rawPhone.slice(-10);

    if (conversationId) {
      await require("../services/sharedFlowRuntime").stopConversation(req.tenantId, conversationId).catch(() => {});
    }

    if (clean10.length >= 8) {
      await store
        .query(
          `UPDATE wa_flow_runs r JOIN wa_flows f ON f.id=r.flow_id
           SET r.status='paused_by_agent', r.end_reason='manual_stop', r.ended_at=NOW()
           WHERE f.tenant_id=? AND (r.phone LIKE ? OR r.phone=?) AND r.status='active'`,
          [req.tenantId, `%${clean10}`, rawPhone]
        )
        .catch(() => {});

      if (req.body.resumeAuto === true) {
        await require("../services/waBotGate").resumeBot(rawPhone, req.user?.id).catch(() => {});
      } else if (req.body.pauseBot !== false) {
        await require("../services/waBotGate").pauseBot(rawPhone, undefined, "manual bot stop", req.user?.id).catch(() => {});
      }

      try {
        const io = req.app?.get("io");
        if (io) {
          io.to(`user:${req.user?.id}`).emit("wa_flow_status", {
            phone: rawPhone,
            flowStatus: "stopped",
            conversationId: conversationId || null,
          });
        }
      } catch (_) {}
    }

    res.json({ success: true });
  })
);

const connectionAdmin = (req, res, next) =>
  require("../middleware/workspaceModule").isAdmin(req)
    ? next()
    : res.status(403).json({ error: "Only organization administrators can manage workflow connections" });

router.get("/connections", route(async (req, res) => res.json(await require("../services/flowConnectionStore").list(req.tenantId))));
router.post("/connections", connectionAdmin, route(async (req, res) => res.json(await require("../services/flowConnectionStore").save(req.tenantId, req.body))));
router.delete(
  "/connections/:name",
  connectionAdmin,
  route(async (req, res) => {
    await require("../services/flowConnectionStore").remove(req.tenantId, req.params.name);
    res.json({ success: true });
  })
);

router.post("/seed", route(async (req, res) => res.json(await store.seed(req.tenantId, req.user.id))));

router.get(
  "/records",
  route(async (req, res) => {
    const [appointments, waitlist, tickets, products, orders, hrRequests, approvals] = await Promise.all([
      store.query("SELECT * FROM wa_appointments WHERE tenant_id=? ORDER BY id DESC LIMIT 50", [req.tenantId]).catch(() => []),
      store.query("SELECT * FROM wa_appointment_waitlist WHERE tenant_id=? ORDER BY id DESC LIMIT 50", [req.tenantId]).catch(() => []),
      store.query("SELECT * FROM wa_support_tickets WHERE tenant_id=? ORDER BY id DESC LIMIT 50", [req.tenantId]).catch(() => []),
      store.query("SELECT * FROM wa_crm_products WHERE tenant_id=? ORDER BY id DESC LIMIT 50", [req.tenantId]).catch(() => []),
      store.query("SELECT * FROM wa_crm_orders WHERE tenant_id=? ORDER BY id DESC LIMIT 50", [req.tenantId]).catch(() => []),
      store.query("SELECT * FROM wa_hr_requests WHERE tenant_id=? ORDER BY id DESC LIMIT 50", [req.tenantId]).catch(() => []),
      store.query("SELECT * FROM wa_approval_requests WHERE tenant_id=? ORDER BY id DESC LIMIT 50", [req.tenantId]).catch(() => []),
    ]);
    res.json({ success: true, appointments, waitlist, tickets, products, orders, hrRequests, approvals });
  })
);

router.post(
  "/records/catalog",
  route(async (req, res) => {
    const { sku, name, category, description, price, currency, stock_qty } = req.body || {};
    const cleanSku = String(sku || "").trim().slice(0, 64);
    const cleanName = String(name || "").trim().slice(0, 180);
    if (!cleanSku || !cleanName) {
      return res.status(400).json({ error: "Provide both SKU and product/service name" });
    }
    const cleanPrice = Math.max(0, Number(price) || 0);
    const cleanStock = Math.max(0, Number.parseInt(stock_qty ?? 10, 10) || 0);
    const cleanCat = String(category || "general").slice(0, 80);
    const cleanDesc = String(description || "").slice(0, 500);
    const cleanCurr = String(currency || "INR").slice(0, 10);
    const existingProd = await store.query("SELECT id FROM wa_crm_products WHERE tenant_id=? AND sku=? LIMIT 1", [req.tenantId, cleanSku]);
    if (existingProd.length) {
      await store.query(
        "UPDATE wa_crm_products SET name=?,category=?,description=?,price=?,stock_qty=?,is_active=1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?",
        [cleanName, cleanCat, cleanDesc, cleanPrice, cleanStock, req.tenantId, existingProd[0].id]
      );
    } else {
      await store.query(
        "INSERT INTO wa_crm_products (tenant_id,sku,name,category,description,price,currency,stock_qty,is_active) VALUES (?,?,?,?,?,?,?,?,1)",
        [req.tenantId, cleanSku, cleanName, cleanCat, cleanDesc, cleanPrice, cleanCurr, cleanStock]
      );
    }
    const products = await store.query("SELECT * FROM wa_crm_products WHERE tenant_id=? ORDER BY id DESC LIMIT 50", [req.tenantId]);
    res.status(201).json({ success: true, products });
  })
);

router.patch(
  "/records/:type/:recordId",
  route(async (req, res) => {
    const recordId = Number(req.params.recordId);
    const status = String(req.body?.status || "").trim();
    const note = String(req.body?.decision_note || "").slice(0, 500);
    if (!Number.isInteger(recordId) || recordId < 1 || !status) {
      return res.status(400).json({ error: "Valid record ID and status required" });
    }
    const tableConfig = {
      appointment: { table: "wa_appointments", allowed: new Set(["held", "confirmed", "rescheduled", "cancelled", "no_show", "completed"]) },
      ticket: { table: "wa_support_tickets", allowed: new Set(["open", "in_progress", "escalated", "resolved", "closed"]) },
      order: { table: "wa_crm_orders", col: "fulfillment_status", allowed: new Set(["pending", "confirmed", "dispatched", "delivered", "cancelled", "returned"]) },
      hr: { table: "wa_hr_requests", allowed: new Set(["pending", "approved", "rejected", "completed"]), hasDecision: true },
      approval: { table: "wa_approval_requests", allowed: new Set(["pending", "approved", "rejected"]), hasDecision: true },
    }[req.params.type];

    if (!tableConfig || !tableConfig.allowed.has(status)) {
      return res.status(400).json({ error: "Unsupported record type or status transition" });
    }
    const col = tableConfig.col || "status";
    if (tableConfig.hasDecision) {
      await store.query(
        `UPDATE ${tableConfig.table} SET ${col}=?, approver_user_id=?, decision_note=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?`,
        [status, req.user.id, note, req.tenantId, recordId]
      );
    } else {
      await store.query(
        `UPDATE ${tableConfig.table} SET ${col}=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?`,
        [status, req.tenantId, recordId]
      );
    }
    res.json({ success: true });
  })
);

router.get(
  "/alerts",
  route(async (req, res) => {
    const rows = await store
      .query("SELECT * FROM wa_flow_error_alerts WHERE tenant_id=? ORDER BY id DESC LIMIT 100", [req.tenantId])
      .catch(() => []);
    res.json({ success: true, alerts: rows });
  })
);

router.patch(
  "/alerts/:alertId",
  route(async (req, res) => {
    const alertId = Number(req.params.alertId);
    const status = String(req.body?.status || "resolved");
    if (!Number.isInteger(alertId) || !["open", "acknowledged", "resolved"].includes(status)) {
      return res.status(400).json({ error: "Invalid alert update" });
    }
    await store.query(
      "UPDATE wa_flow_error_alerts SET status=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?",
      [status, req.tenantId, alertId]
    );
    res.json({ success: true });
  })
);

function simulation(flow, req) {
  const normalized = definition.normalize(flow);
  const triggerDefaults =
    normalized.trigger_config?.default_vars && typeof normalized.trigger_config.default_vars === "object"
      ? normalized.trigger_config.default_vars
      : {};
  const result = definition.step(
    normalized,
    req.body.input,
    req.body.state,
    {
      ...triggerDefaults,
      name: "Preview customer",
      "customer.name": "Preview customer",
      "customer.phone": "919000000000",
      "customer.email": "preview@example.test",
      "contact.exists": true,
    },
    { previewActionError: req.body.previewActionError === true }
  );
  const input = String(req.body.input || "");
  return {
    success: true,
    ...result,
    triggerType: normalized.trigger_type,
    triggerKeywords: normalized.trigger_config.keywords || [],
    triggerMatched:
      normalized.trigger_type === "keyword" &&
      definition.matchesFlowTrigger(normalized, input, { manual: false }),
  };
}

router.post("/draft-simulate", route(async (req, res) => res.json(simulation(req.body.flow, req))));

const trigger = route(async (req, res) => {
  const id = req.params.id || req.body.flow_id;
  const flow = await store.get(req.tenantId, id);
  let phone = String(req.body.phone || "").replace(/\D/g, "");
  if (phone.length === 10) phone = "91" + phone;

  const where = req.body.conversationId ? "c.id=?" : "ct.phone=?";
  const rows = await store.query(
    `SELECT c.id FROM conversations c JOIN wa_contacts ct ON ct.id=c.contact_id AND ct.tenant_id=c.tenant_id WHERE c.tenant_id=? AND ${where} LIMIT 2`,
    [req.tenantId, req.body.conversationId || phone]
  );

  if (rows.length === 1) {
    const result = await require("../services/sharedFlowRuntime").start(req.tenantId, rows[0].id, id, req.user.id);
    return res.json({ success: true, result, phone, message: "Published flow started in the shared conversation" });
  }

  // Fallback to direct Web/Cloud session flow execution if chat is not a shared inbox Cloud conversation
  if (phone.length >= 10 || req.body.chatId) {
    const waFlowEngine = require("../services/waFlowEngine");
    const sessionKey = req.body.sessionKey || String(req.user?.id || "");
    await require("../services/waBotGate").resumeBot(phone, sessionKey).catch(() => {});
    await waFlowEngine.startFlowRun(flow, phone || req.body.chatId, sessionKey, "", req.body.chatId || null, {
      _tenant_id: req.tenantId,
    });
    return res.json({ success: true, phone, message: `Flow bot "${flow.name}" started for +${phone || req.body.chatId}` });
  }

  return res.status(409).json({
    error: "Select one existing conversation using conversationId or provide a valid phone number.",
  });
});

router.post("/send-menu", trigger);
router.post("/:id/trigger-phone", trigger);

router.get("/:id", route(async (req, res) => res.json(await store.get(req.tenantId, req.params.id))));
router.post("/", route(async (req, res) => res.status(201).json(await store.save(req.tenantId, req.user.id, req.body))));
router.put("/:id", route(async (req, res) => res.json(await store.save(req.tenantId, req.user.id, req.body, req.params.id))));
router.post("/:id/duplicate", route(async (req, res) => res.status(201).json(await store.duplicate(req.tenantId, req.user.id, req.params.id))));

router.patch(
  "/:id/status",
  route(async (req, res) => {
    await store.get(req.tenantId, req.params.id);
    if (!["draft", "active", "archived"].includes(req.body.status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    if (req.body.status === "active") {
      const publishedVersions = await store.query(
        "SELECT id FROM wa_flow_versions WHERE flow_id=? AND status='published'",
        [req.params.id]
      );
      if (!publishedVersions.length) {
        if (req.body.autoPublish) {
          await store.publish(req.tenantId, req.user.id, req.params.id, "Published on activation");
        } else {
          return res.status(409).json({ error: "Test and publish a version before activating this flow" });
        }
      }
    }
    await store.query("UPDATE wa_flows SET status=?,updated_at=NOW() WHERE tenant_id=? AND id=?", [
      req.body.status,
      req.tenantId,
      req.params.id,
    ]);
    require("../services/sharedFlowRuntime").invalidate(req.tenantId);
    res.json({ success: true, status: req.body.status });
  })
);

router.delete(
  "/:id",
  route(async (req, res) => {
    await store.get(req.tenantId, req.params.id);
    await store.query("DELETE FROM wa_flows WHERE tenant_id=? AND id=?", [req.tenantId, req.params.id]);
    require("../services/sharedFlowRuntime").invalidate(req.tenantId);
    res.json({ success: true });
  })
);

router.post("/:id/test-simulate", route(async (req, res) => res.json(simulation(await store.get(req.tenantId, req.params.id), req))));

router.get(
  "/:id/runs",
  route(async (req, res) => {
    await store.get(req.tenantId, req.params.id);
    res.json(
      await store.query(
        "SELECT id,flow_id,phone,status,current_node_key,started_at,last_advanced_at,ended_at,end_reason FROM wa_flow_runs WHERE flow_id=? ORDER BY id DESC LIMIT 50",
        [req.params.id]
      )
    );
  })
);

router.get(
  "/:id/runs/:runId/events",
  route(async (req, res) => {
    await store.get(req.tenantId, req.params.id);
    const runs = await store.query("SELECT id FROM wa_flow_runs WHERE id=? AND flow_id=?", [req.params.runId, req.params.id]);
    if (!runs.length) return res.status(404).json({ error: "Run not found" });
    res.json(await store.query("SELECT id,node_key,event_type,created_at FROM wa_flow_run_events WHERE run_id=? ORDER BY id LIMIT 500", [req.params.runId]));
  })
);

router.get(
  "/:id/versions",
  route(async (req, res) => {
    await store.get(req.tenantId, req.params.id);
    res.json(
      await store.query(
        "SELECT id,flow_id,version_number,name,status,changelog,published_at,created_at,created_by FROM wa_flow_versions WHERE flow_id=? ORDER BY version_number DESC LIMIT 100",
        [req.params.id]
      )
    );
  })
);

router.post(
  "/:id/versions/publish",
  route(async (req, res) => res.json(await store.publish(req.tenantId, req.user.id, req.params.id, req.body.changelog)))
);

router.post(
  "/:id/versions/:versionId/rollback",
  route(async (req, res) => {
    await store.transaction(async (q) => {
      await store.get(req.tenantId, req.params.id, q, true);
      const [version] = await q("SELECT * FROM wa_flow_versions WHERE id=? AND flow_id=?", [req.params.versionId, req.params.id]);
      if (!version) throw Object.assign(new Error("Version not found"), { status: 404 });
      const flow = definition.normalize({
        ...version,
        nodes: typeof version.nodes_snapshot === "string" ? JSON.parse(version.nodes_snapshot) : version.nodes_snapshot,
      });
      await q(
        "UPDATE wa_flows SET name=?,description=?,trigger_type=?,trigger_config=?,entry_node_key=?,status='draft',updated_at=NOW() WHERE tenant_id=? AND id=?",
        [flow.name, flow.description, flow.trigger_type, JSON.stringify(flow.trigger_config), flow.entry_node_key, req.tenantId, req.params.id]
      );
      await store.replaceNodes(q, req.params.id, flow.nodes);
    });
    require("../services/sharedFlowRuntime").invalidate(req.tenantId);
    res.json({ success: true, message: "Version restored to a draft. Test and publish to enable it." });
  })
);

router.get(
  "/:id/analytics",
  route(async (req, res) => {
    await store.get(req.tenantId, req.params.id);
    const [row] = await store.query(
      "SELECT COUNT(*) AS totalRuns,SUM(status='completed') AS completedRuns,SUM(status='handed_off') AS handoffRuns,SUM(status='active') AS activeRuns FROM wa_flow_runs WHERE flow_id=?",
      [req.params.id]
    );
    const nodeDropoffs = await store.query(
      "SELECT e.node_key,COUNT(*) AS hit_count FROM wa_flow_run_events e JOIN wa_flow_runs r ON r.id=e.run_id WHERE r.flow_id=? GROUP BY e.node_key ORDER BY hit_count DESC LIMIT 20",
      [req.params.id]
    );
    res.json({ ...row, nodeDropoffs });
  })
);

module.exports = router;
