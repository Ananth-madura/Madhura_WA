"use strict";

const STATUS_TRANSITIONS = {
  appointment: { table: "wa_appointments", col: "status", allowed: new Set(["held", "confirmed", "rescheduled", "cancelled", "no_show", "completed"]) },
  ticket: { table: "wa_support_tickets", col: "status", allowed: new Set(["open", "in_progress", "escalated", "resolved", "closed"]) },
  order: { table: "wa_crm_orders", col: "fulfillment_status", allowed: new Set(["pending", "confirmed", "dispatched", "delivered", "cancelled", "returned"]) },
  approval: { table: "wa_approval_requests", col: "status", allowed: new Set(["pending", "approved", "rejected"]), hasDecision: true },
};

function clean10(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function createBridge({ db = null, executorFactory = null, eventBus = null, webhookForwarder = null, getIO = null } = {}) {
  const getDb = () => db || require("../config/database");
  const q = async (sql, params = []) => (await getDb().promise().query(sql, params))[0];
  const exec = () => {
    if (executorFactory) return executorFactory({ db: getDb() });
    return require("./builtinWorkflowExecutor").createBuiltinExecutor({
      db: getDb(),
      eventBus: eventBus || undefined,
    });
  };
  const emitSocket = (tenantId, event, data) => {
    try {
      const io = getIO ? getIO() : require("../sockets/chatsockets").getIO();
      if (io && tenantId) io.to(`tenant:${tenantId}`).emit(event, { tenantId, ...data });
    } catch (_) {}
  };

  async function safeTenantQuery(sqlWithTenant, paramsWithTenant, sqlFallback, paramsFallback) {
    try {
      return await q(sqlWithTenant, paramsWithTenant);
    } catch (err) {
      if (sqlFallback && /unknown column|no such column/i.test(err.message || "")) {
        return await q(sqlFallback, paramsFallback).catch(() => []);
      }
      return [];
    }
  }

  async function getUnifiedContext({ tenantId, phone, conversationId = null }) {
    const tid = Number(tenantId) || null;
    const raw = String(phone || "");
    const digitsOnly = raw.replace(/\D/g, "");
    const p10 = clean10(digitsOnly);

    let resolvedPhone = digitsOnly;
    let resolvedName = null;
    if (conversationId && tid) {
      const convRows = await q(
        "SELECT c.id, ct.phone, ct.name FROM conversations c JOIN wa_contacts ct ON ct.id=c.contact_id AND ct.tenant_id=c.tenant_id WHERE c.tenant_id=? AND c.id=? LIMIT 1",
        [tid, Number(conversationId)]
      ).catch(() => []);
      if (convRows[0]) {
        resolvedPhone = convRows[0].phone || resolvedPhone;
        resolvedName = convRows[0].name || null;
      }
    }

    const search10 = clean10(resolvedPhone || p10);
    const searchFull = resolvedPhone || digitsOnly;
    if (!search10 && !searchFull) {
      return {
        contact: null,
        client: null,
        telecalls: [],
        walkins: [],
        invoices: [],
        quotations: [],
        amcContracts: [],
        appointments: [],
        tickets: [],
        orders: [],
        approvals: [],
        enquiries: [],
        recentActivity: [],
      };
    }

    const like10 = `%${search10 || searchFull}`;
    const contactRows = await (tid
      ? q("SELECT * FROM wa_contacts WHERE tenant_id = ? AND (phone LIKE ? OR phone = ?) LIMIT 1", [tid, like10, searchFull])
      : q("SELECT * FROM wa_contacts WHERE phone LIKE ? OR phone = ? LIMIT 1", [like10, searchFull])
    ).catch(() => []);
    const contact = contactRows[0] || (resolvedName ? { name: resolvedName, phone: searchFull } : null);

    const clients = await (tid
      ? safeTenantQuery(
          "SELECT id, name, company_name, email, phone, address, source FROM clients WHERE tenant_id = ? AND (phone LIKE ? OR phone = ?) LIMIT 1",
          [tid, like10, searchFull],
          "SELECT id, name, company_name, email, phone, address, source FROM clients WHERE phone LIKE ? OR phone = ? LIMIT 1",
          [like10, searchFull]
        )
      : q("SELECT id, name, company_name, email, phone, address, source FROM clients WHERE phone LIKE ? OR phone = ? LIMIT 1", [like10, searchFull]).catch(() => []));

    const telecalls = await (tid
      ? safeTenantQuery(
          "SELECT id, customer_name, company_name, mobile_number, status, service, remarks, created_at FROM telecalls WHERE tenant_id = ? AND mobile_number LIKE ? ORDER BY id DESC LIMIT 5",
          [tid, like10],
          "SELECT id, customer_name, company_name, mobile_number, status, service, remarks, created_at FROM telecalls WHERE mobile_number LIKE ? ORDER BY id DESC LIMIT 5",
          [like10]
        )
      : q("SELECT id, customer_name, company_name, mobile_number, status, service, remarks, created_at FROM telecalls WHERE mobile_number LIKE ? ORDER BY id DESC LIMIT 5", [like10]).catch(() => []));

    const walkins = await (tid
      ? safeTenantQuery(
          "SELECT id, customer_name, company_name, mobile_number, status, purpose, created_at FROM walkins WHERE tenant_id = ? AND mobile_number LIKE ? ORDER BY id DESC LIMIT 5",
          [tid, like10],
          "SELECT id, customer_name, company_name, mobile_number, status, purpose, created_at FROM walkins WHERE mobile_number LIKE ? ORDER BY id DESC LIMIT 5",
          [like10]
        )
      : q("SELECT id, customer_name, company_name, mobile_number, status, purpose, created_at FROM walkins WHERE mobile_number LIKE ? ORDER BY id DESC LIMIT 5", [like10]).catch(() => []));

    const clientComp = clients[0]?.company_name || clients[0]?.name || telecalls[0]?.company_name || "";
    let invoices = [];
    let quotations = [];
    let amcContracts = [];

    if (clientComp) {
      invoices = await (tid
        ? safeTenantQuery(
            "SELECT id, invoice_no, client_company, total_amount, due_date, status, created_at FROM clientinvoices WHERE tenant_id = ? AND (client_company = ? OR customer_name = ?) ORDER BY id DESC LIMIT 5",
            [tid, clientComp, clientComp],
            "SELECT id, invoice_no, client_company, total_amount, due_date, status, created_at FROM clientinvoices WHERE client_company = ? OR customer_name = ? ORDER BY id DESC LIMIT 5",
            [clientComp, clientComp]
          )
        : q("SELECT id, invoice_no, client_company, total_amount, due_date, status, created_at FROM clientinvoices WHERE client_company = ? OR customer_name = ? ORDER BY id DESC LIMIT 5", [clientComp, clientComp]).catch(() => []));

      quotations = await (tid
        ? safeTenantQuery(
            "SELECT id, quotation_no, company_name, grand_total, status, created_at FROM quotations WHERE tenant_id = ? AND company_name = ? ORDER BY id DESC LIMIT 5",
            [tid, clientComp],
            "SELECT id, quotation_no, company_name, grand_total, status, created_at FROM quotations WHERE company_name = ? ORDER BY id DESC LIMIT 5",
            [clientComp]
          )
        : q("SELECT id, quotation_no, company_name, grand_total, status, created_at FROM quotations WHERE company_name = ? ORDER BY id DESC LIMIT 5", [clientComp]).catch(() => []));

      amcContracts = await (tid
        ? safeTenantQuery(
            "SELECT id, contract_title, client_company, total_amount, start_date, end_date, status FROM contracts WHERE tenant_id = ? AND client_company = ? ORDER BY id DESC LIMIT 5",
            [tid, clientComp],
            "SELECT id, contract_title, client_company, total_amount, start_date, end_date, status FROM contracts WHERE client_company = ? ORDER BY id DESC LIMIT 5",
            [clientComp]
          )
        : q("SELECT id, contract_title, client_company, total_amount, start_date, end_date, status FROM contracts WHERE client_company = ? ORDER BY id DESC LIMIT 5", [clientComp]).catch(() => []));
    }

    // 10-System Built-in CRM tables (strictly tenant-scoped when tenantId exists)
    const [appointments, tickets, orders, approvals, enquiries, automationLogs] = tid
      ? await Promise.all([
          q("SELECT id, reference_code, category, service_name, branch_name, slot_date, slot_time, status, created_at FROM wa_appointments WHERE tenant_id = ? AND (phone LIKE ? OR phone = ?) ORDER BY id DESC LIMIT 10", [tid, like10, searchFull]).catch(() => []),
          q("SELECT id, ticket_no, category, subject, priority, status, created_at FROM wa_support_tickets WHERE tenant_id = ? AND (phone LIKE ? OR phone = ?) ORDER BY id DESC LIMIT 10", [tid, like10, searchFull]).catch(() => []),
          q("SELECT id, order_no, total_amount, currency, payment_status, fulfillment_status, tracking_no, created_at FROM wa_crm_orders WHERE tenant_id = ? AND (phone LIKE ? OR phone = ?) ORDER BY id DESC LIMIT 10", [tid, like10, searchFull]).catch(() => []),
          q("SELECT id, approval_no, request_type, item_name, quantity, amount, branch_name, status, created_at FROM wa_approval_requests WHERE tenant_id = ? AND (requester_phone LIKE ? OR requester_phone = ?) ORDER BY id DESC LIMIT 10", [tid, like10, searchFull]).catch(() => []),
          q("SELECT id, enquiry_type, subject, status, source, created_at FROM wa_enquiries WHERE tenant_id = ? AND (phone LIKE ? OR phone = ?) ORDER BY id DESC LIMIT 10", [tid, like10, searchFull]).catch(() => []),
          q(
            `SELECT l.id, l.automation_id, a.name AS rule_name, l.status, l.error, l.created_at
             FROM wa_automation_logs l JOIN wa_automations a ON a.id = l.automation_id
             WHERE a.tenant_id = ? AND (l.phone LIKE ? OR l.phone = ?) ORDER BY l.id DESC LIMIT 10`,
            [tid, like10, searchFull]
          ).catch(() => []),
        ])
      : [[], [], [], [], [], []];

    return {
      contact,
      client: clients[0] || null,
      telecalls,
      walkins,
      invoices,
      quotations,
      amcContracts,
      appointments,
      tickets,
      orders,
      approvals,
      enquiries,
      recentActivity: automationLogs,
    };
  }

  async function executeAction({ tenantId, userId = null, phone, conversationId = null, customerName = null, action, payload = {} }) {
    const tid = Number(tenantId);
    if (!Number.isInteger(tid) || tid < 1) {
      throw Object.assign(new Error("Organization context is required"), { status: 400 });
    }

    let resolvedPhone = String(phone || "").replace(/\D/g, "");
    let resolvedName = customerName || null;
    if (conversationId) {
      const convRows = await q(
        "SELECT c.id, ct.phone, ct.name FROM conversations c JOIN wa_contacts ct ON ct.id=c.contact_id AND ct.tenant_id=c.tenant_id WHERE c.tenant_id=? AND c.id=? LIMIT 1",
        [tid, Number(conversationId)]
      ).catch(() => []);
      if (convRows[0]) {
        resolvedPhone = resolvedPhone || convRows[0].phone;
        resolvedName = resolvedName || convRows[0].name;
      }
    }

    const ctx = {
      tenantId: tid,
      phone: resolvedPhone,
      customerName: resolvedName || "Customer",
      conversationId: conversationId ? Number(conversationId) : null,
    };

    const bus = eventBus || require("./crmEventBus");
    const wh = webhookForwarder || require("./crmWebhookForwarder");

    if (action === "create_ticket") {
      if (!resolvedPhone) throw Object.assign(new Error("Phone is required"), { status: 400 });
      const res = await exec().executeOperation(
        "support.ticket_create",
        {
          customer_name: payload.customer_name || ctx.customerName,
          subject: payload.subject || "WhatsApp Support Request",
          priority: payload.priority || "normal",
          category: payload.category || "support",
          details: payload.description || payload.notes || "",
        },
        ctx
      );
      emitSocket(tid, "crm_record_updated", { type: "ticket", phone: resolvedPhone, conversationId: ctx.conversationId, record: res.data });
      return { success: true, action, record: res.data, suggestedMessage: res.data?.result_message || res.data?.message || null };
    }

    if (action === "create_appointment") {
      if (!resolvedPhone) throw Object.assign(new Error("Phone is required"), { status: 400 });
      const res = await exec().executeOperation(
        "appointments.booking_create",
        {
          customer_name: payload.customer_name || ctx.customerName,
          service: payload.service || "Consultation",
          branch: payload.branch || "Main",
          date: payload.date || new Date().toISOString().slice(0, 10),
          time: payload.time || "11:00",
          details: payload.notes || "",
        },
        ctx
      );
      emitSocket(tid, "crm_record_updated", { type: "appointment", phone: resolvedPhone, conversationId: ctx.conversationId, record: res.data });
      return { success: true, action, record: res.data, suggestedMessage: res.data?.result_message || res.data?.message || null };
    }

    if (action === "create_approval") {
      if (!resolvedPhone) throw Object.assign(new Error("Phone is required"), { status: 400 });
      const opType = payload.request_type === "expense" ? "expense" : "purchase";
      const res = await exec().executeOperation(
        `operations.${opType}`,
        {
          customer_name: payload.requester_name || ctx.customerName,
          product: payload.item_name || payload.subject || "Approval Request",
          quantity: Number(payload.quantity || 1),
          budget: Number(payload.amount || 0),
          branch: payload.branch || "Main",
          details: payload.details || "",
        },
        ctx
      );
      emitSocket(tid, "crm_record_updated", { type: "approval", phone: resolvedPhone, conversationId: ctx.conversationId, record: res.data });
      return { success: true, action, record: res.data, suggestedMessage: res.data?.result_message || res.data?.message || null };
    }

    if (action === "update_status") {
      const recordType = String(payload.recordType || payload.type || "");
      const recordId = Number(payload.recordId || payload.id);
      const nextStatus = String(payload.status || "").trim();
      const note = String(payload.decision_note || "").slice(0, 500);
      const cfg = STATUS_TRANSITIONS[recordType];
      if (!cfg || !Number.isInteger(recordId) || recordId < 1 || !cfg.allowed.has(nextStatus)) {
        throw Object.assign(new Error("Invalid record type or status transition"), { status: 400 });
      }
      if (cfg.hasDecision) {
        await q(
          `UPDATE ${cfg.table} SET ${cfg.col} = ?, approver_user_id = ?, decision_note = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`,
          [nextStatus, userId || null, note || null, tid, recordId]
        );
      } else {
        await q(
          `UPDATE ${cfg.table} SET ${cfg.col} = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`,
          [nextStatus, tid, recordId]
        );
      }

      if (recordType === "ticket" && ["resolved", "closed"].includes(nextStatus)) {
        bus.emit("ticket_closed", { tenantId: tid, phone: resolvedPhone, id: recordId, status: nextStatus });
      } else if (recordType === "appointment" && nextStatus === "cancelled") {
        bus.emit("appointment_cancelled", { tenantId: tid, phone: resolvedPhone, id: recordId, status: nextStatus });
      }
      wh.sendTenantEvent?.(tid, "crm.record_updated", {
        type: recordType,
        id: recordId,
        status: nextStatus,
        phone: resolvedPhone,
      })?.catch?.(() => {});
      emitSocket(tid, "crm_record_updated", { type: recordType, id: recordId, status: nextStatus, phone: resolvedPhone, conversationId: ctx.conversationId });
      return { success: true, action, recordType, recordId, status: nextStatus };
    }

    throw Object.assign(new Error(`Unsupported CRM action: ${action}`), { status: 400 });
  }

  return { getUnifiedContext, executeAction };
}

const defaultBridge = createBridge();
defaultBridge.createBridge = createBridge;
module.exports = defaultBridge;
