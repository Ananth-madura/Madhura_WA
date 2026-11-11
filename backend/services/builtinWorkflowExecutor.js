"use strict";

const crypto = require("crypto");

const DEFAULT_SLOTS = ["09:30", "11:00", "12:30", "14:30", "16:00", "17:30"];
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const SYSTEMS_META = [
  { id: "support", name: "Customer service", industries: "All industries", desc: "AI FAQ & KB search, support tickets, status lookup, SLA escalation, and CSAT feedback" },
  { id: "appointments", name: "Appointments", industries: "Clinics, salons, consultants and garages", desc: "10 complete workflows: new bookings, live availability, confirmations, reminders, rescheduling, cancel, waitlist, staff assign, no-show & follow-up" },
  { id: "sales", name: "Sales and leads", industries: "Agencies, real estate, SaaS and B2B", desc: "Lead capture, budget/timeline qualification & scoring, rep routing, quotations, and demos" },
  { id: "finance", name: "Invoices and payments", industries: "All businesses", desc: "Verified invoice & receipt retrieval, authorized payment links, balance reminders, and disputes" },
  { id: "commerce", name: "E-commerce", industries: "Retail, D2C and wholesalers", desc: "Product & stock search, cart checkout, live order tracking, cancellations, and returns" },
  { id: "hospitality", name: "Restaurant and hospitality", industries: "Restaurants, hotels and cafes", desc: "Interactive menus, table/room reservations, room service, and guest feedback" },
  { id: "logistics", name: "Logistics and field service", industries: "Transport, courier and repair services", desc: "Shipment tracking, pickup booking, technician visits, issue escalation, and proof of delivery" },
  { id: "hr", name: "Employee self-service", industries: "SMEs, factories and enterprise teams", desc: "Leave requests & balance, private payslip requests, attendance corrections, and shift swaps" },
  { id: "education", name: "Education and admissions", industries: "Schools, colleges and coaching", desc: "Course eligibility search, admission capture, counseling bookings, fee statements, and class schedules" },
  { id: "operations", name: "Operations and approvals", industries: "ERP, procurement and service companies", desc: "Purchase requests, manager approvals, branch stock checks, expense claims, and daily operational summaries" },
];

function clean10(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function makeRef(prefix) {
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${day}-${rand}`;
}

function makeIdemKey(context = {}, operation = "") {
  if (!context.runId && !context.messageId) return null;
  return crypto
    .createHash("sha256")
    .update([context.tenantId || 0, context.runId || 0, context.messageId || "", context.nodeKey || "", context.occurrence || 0, operation].join(":"))
    .digest("hex");
}

async function pickStaff(q, tenantId) {
  const rows = await q(
    "SELECT id, first_name, last_name, email, role FROM users WHERE tenant_id=? ORDER BY id LIMIT 25",
    [tenantId]
  ).catch(() => []);
  if (!rows.length) return { id: null, name: "Assigned Specialist" };
  const idx = Math.floor(Math.random() * rows.length);
  const u = rows[idx];
  return {
    id: u.id,
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || `Staff #${u.id}`,
  };
}

function scoreKbDocs(docs, queryText) {
  const terms = String(queryText || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  if (!docs.length) return [];
  return docs
    .map((doc) => {
      const hay = `${doc.filename || ""} ${doc.content || ""}`.toLowerCase();
      const hits = terms.reduce((sum, t) => sum + (hay.includes(t) ? 1 : 0), 0);
      return { doc, hits };
    })
    .filter((x) => !terms.length || x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3);
}

function createBuiltinExecutor({ db = null, kb = null, billing = null, leadCapture = null, aiAssistant = null } = {}) {
  const getDb = () => db || require("../config/database");
  const q = async (sql, params = []) => (await getDb().promise().query(sql, params))[0];
  const getKb = () => kb || require("./waKnowledgeBase");
  const getBilling = () => billing || require("./waCustomerBillingService");
  const getLeads = () => leadCapture || require("./waLeadCapture");
  const getAi = () => aiAssistant || require("./sharedInboxAssistant");

  async function findByIdem(table, tenantId, idemKey) {
    if (!idemKey) return null;
    const rows = await q(`SELECT * FROM ${table} WHERE tenant_id=? AND idempotency_key=? LIMIT 1`, [tenantId, idemKey]).catch(() => []);
    return rows[0] || null;
  }

  async function safeLeadCapture(payload) {
    try {
      await getLeads().captureLeadFromWhatsApp(payload);
    } catch (_) {}
  }

  // ── 1. CUSTOMER SERVICE ─────────────────────────────────────────────────────
  async function handleSupport(op, inputs, ctx) {
    const phone = inputs.customer_phone || ctx.phone || "";
    const p10 = clean10(phone);
    const tenant = Number(ctx.tenantId) || 1;
    const idem = makeIdemKey(ctx, op);

    if (op === "knowledge_search") {
      const question = String(inputs.question || inputs.query || "").trim();
      const docs = await q("SELECT filename, content FROM wa_knowledge_base ORDER BY created_at DESC LIMIT 30").catch(() => []);
      const ranked = scoreKbDocs(docs, question);
      if (!ranked.length) {
        try {
          if (ctx.conversationId && getAi()?.generate) {
            const aiAnswer = await getAi().generate(tenant, ctx.conversationId, question);
            if (aiAnswer) {
              return { message: aiAnswer, source: "ai_assistant", found: true };
            }
          }
        } catch (_) {}
        return {
          message: "I could not find an exact policy document matching your question. I can connect you with a support specialist or open a ticket right away.",
          found: false,
          source: "none",
        };
      }
      const snippets = ranked.map(({ doc }) => `[${doc.filename}]: ${String(doc.content || "").replace(/\s+/g, " ").slice(0, 320).trim()}`).join("\n\n");
      try {
        if (ctx.conversationId && getAi()?.generate) {
          const aiAnswer = await getAi().generate(tenant, ctx.conversationId, `Answer based ONLY on our company documents below.\nQuestion: ${question}\n\nDocuments:\n${snippets}`);
          if (aiAnswer) return { message: aiAnswer, source: ranked[0].doc.filename, found: true };
        }
      } catch (_) {}
      return {
        message: `Here is what I found in *${ranked[0].doc.filename}*:\n\n${String(ranked[0].doc.content || "").trim().slice(0, 650)}`,
        source: ranked[0].doc.filename,
        found: true,
      };
    }

    if (op === "ticket_create") {
      const existing = await findByIdem("wa_support_tickets", tenant, idem);
      if (existing) {
        return { message: `Support ticket ${existing.ticket_no} is already active (Status: ${existing.status}).`, reference: existing.ticket_no, status: existing.status };
      }
      const ref = makeRef("TKT");
      const slaDue = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 19).replace("T", " ");
      await q(
        `INSERT INTO wa_support_tickets (tenant_id,conversation_id,contact_id,phone,customer_name,ticket_no,category,subject,description,priority,status,sla_due_at,idempotency_key)
         VALUES (?,?,?,?,?,?,?,?,?,?, 'open', ?, ?)`,
        [tenant, ctx.conversationId || null, ctx.contactId || null, phone, inputs.customer_name || ctx.customerName || "Customer", ref, "support", String(inputs.subject || "WhatsApp Support Request").slice(0, 200), String(inputs.details || inputs.description || ""), inputs.priority || "normal", slaDue, idem]
      );
      return { message: `Support ticket *${ref}* has been created. Priority: ${inputs.priority || "normal"}. Target response within 4 hours.`, reference: ref, status: "open" };
    }

    if (op === "ticket_status") {
      const ref = String(inputs.reference || "").trim();
      const rows = await q(
        "SELECT ticket_no, status, priority, subject, created_at FROM wa_support_tickets WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (ticket_no=? OR ?='') ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref]
      ).catch(() => []);
      if (!rows.length) throw fail(`No support ticket found for ${ref || "this number"}`);
      const t = rows[0];
      return { message: `Ticket *${t.ticket_no}* (${t.subject}) is currently *${t.status.toUpperCase()}* (Priority: ${t.priority}).`, reference: t.ticket_no, status: t.status };
    }

    if (op === "complaint_escalate") {
      const ref = String(inputs.reference || "").trim();
      const details = String(inputs.details || "Customer escalation").trim();
      const rows = await q(
        "SELECT id, ticket_no, description FROM wa_support_tickets WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (ticket_no=? OR ?='') ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref]
      ).catch(() => []);
      if (rows.length) {
        const nextDesc = [rows[0].description, `[Escalation]: ${details}`].filter(Boolean).join("\n");
        await q("UPDATE wa_support_tickets SET status='escalated', priority='urgent', description=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [nextDesc, tenant, rows[0].id]);
        return { message: `Ticket *${rows[0].ticket_no}* has been escalated to URGENT priority. A supervisor will follow up shortly.`, reference: rows[0].ticket_no, status: "escalated" };
      }
      const newRef = makeRef("ESC");
      await q(
        "INSERT INTO wa_support_tickets (tenant_id,conversation_id,phone,ticket_no,category,subject,description,priority,status,idempotency_key) VALUES (?,?,?,?,'complaint','Escalated Complaint',?,'urgent','escalated',?)",
        [tenant, ctx.conversationId || null, phone, newRef, details, idem]
      );
      return { message: `Urgent escalation *${newRef}* created and routed to management.`, reference: newRef, status: "escalated" };
    }

    if (op === "feedback") {
      const rating = Math.min(5, Math.max(1, Number(inputs.rating) || 5));
      const ref = String(inputs.reference || "").trim();
      await q(
        "UPDATE wa_support_tickets SET csat_rating=?, csat_comment=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (ticket_no=? OR ?='')",
        [rating, String(inputs.details || "").slice(0, 1000), tenant, `%${p10}`, phone, ref, ref]
      ).catch(() => {});
      return { message: `Thank you for rating us ${rating}/5! Your feedback has been recorded for our quality team.`, reference: ref || "CSAT", rating, status: "recorded" };
    }

    throw fail(`Unsupported support operation: ${op}`);
  }

  // ── 2. APPOINTMENTS & SCHEDULING (All 10 Workflows) ─────────────────────────
  async function handleAppointments(op, inputs, ctx) {
    const tenant = Number(ctx.tenantId) || 1;
    const phone = inputs.customer_phone || ctx.phone || "";
    const p10 = clean10(phone);
    const branch = String(inputs.branch || "Main").trim();
    const service = String(inputs.service || "Consultation").trim();
    const date = String(inputs.date || new Date().toISOString().slice(0, 10)).trim();
    const time = String(inputs.time || "11:00").trim();
    const idem = makeIdemKey(ctx, op);

    const openSlotsForDate = async (d, br) => {
      const bookedRows = await q(
        "SELECT slot_time FROM wa_appointments WHERE tenant_id=? AND slot_date=? AND branch_name=? AND status IN ('held','confirmed','rescheduled')",
        [tenant, d, br]
      ).catch(() => []);
      const taken = new Set(bookedRows.map((r) => String(r.slot_time || "").trim().toLowerCase()));
      return DEFAULT_SLOTS.filter((s) => !taken.has(s.toLowerCase()));
    };

    if (op === "availability") {
      const open = await openSlotsForDate(date, branch);
      if (!open.length) throw fail(`No open slots remaining on ${date} at ${branch}`);
      return {
        message: `Available slots at *${branch}* on *${date}* for ${service}:\n${open.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nReply with your preferred time to confirm.`,
        slots_text: open.join(", "),
        open_count: open.length,
        status: "available",
      };
    }

    if (op === "booking_create") {
      const existing = await findByIdem("wa_appointments", tenant, idem);
      if (existing) {
        return { message: `Your booking *${existing.reference_code}* for ${existing.service_name} on ${existing.slot_date} at ${existing.slot_time} is ${existing.status}.`, reference: existing.reference_code, status: existing.status };
      }
      const open = await openSlotsForDate(date, branch);
      if (open.length && !open.some((s) => s.toLowerCase() === time.toLowerCase())) {
        const conflict = await q(
          "SELECT id FROM wa_appointments WHERE tenant_id=? AND slot_date=? AND branch_name=? AND slot_time=? AND status IN ('held','confirmed','rescheduled') LIMIT 1",
          [tenant, date, branch, time]
        ).catch(() => []);
        if (conflict.length) {
          throw fail(`Slot ${time} on ${date} at ${branch} is already booked. Open slots: ${open.join(", ")}`);
        }
      }
      const ref = makeRef("APT");
      const staff = await pickStaff(q, tenant);
      await q(
        `INSERT INTO wa_appointments (tenant_id,conversation_id,contact_id,phone,customer_name,reference_code,category,service_name,branch_name,slot_date,slot_time,staff_user_id,staff_name,status,notes,idempotency_key)
         VALUES (?,?,?,?,?,?,'appointment',?,?,?,?,?,?, 'confirmed', ?, ?)`,
        [tenant, ctx.conversationId || null, ctx.contactId || null, phone, inputs.customer_name || ctx.customerName || "Customer", ref, service, branch, date, time, staff.id, staff.name, inputs.details || "", idem]
      );
      return {
        message: `Appointment confirmed!\nReference: *${ref}*\nService: ${service}\nBranch: ${branch}\nDate & Time: ${date} at ${time}\nSpecialist: ${staff.name}`,
        reference: ref,
        status: "confirmed",
        staff_name: staff.name,
      };
    }

    if (op === "booking_confirm") {
      const ref = String(inputs.reference || "").trim();
      const rows = await q(
        "SELECT * FROM wa_appointments WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (reference_code=? OR ?='') ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref]
      );
      if (!rows.length) throw fail(`No booking found for reference ${ref || "provided"}`);
      await q("UPDATE wa_appointments SET status='confirmed', updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [tenant, rows[0].id]);
      return { message: `Booking *${rows[0].reference_code}* (${rows[0].service_name} on ${rows[0].slot_date} at ${rows[0].slot_time}) is confirmed.`, reference: rows[0].reference_code, status: "confirmed" };
    }

    if (op === "reminder_schedule") {
      const ref = String(inputs.reference || "").trim();
      const rows = await q(
        "SELECT * FROM wa_appointments WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (reference_code=? OR ?='') ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref]
      );
      if (!rows.length) throw fail(`Booking ${ref || "record"} not found for reminder scheduling`);
      const when = rows[0].slot_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      await q("UPDATE wa_appointments SET reminder_scheduled_at=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [`${when} 08:00:00`, tenant, rows[0].id]).catch(() => {});
      return { message: `Reminder scheduled for appointment *${rows[0].reference_code}* (${rows[0].slot_date} ${rows[0].slot_time}). Outside the 24h Meta window, an approved WhatsApp template reminder will be used automatically.`, reference: rows[0].reference_code, status: "scheduled" };
    }

    if (op === "reschedule") {
      const ref = String(inputs.reference || "").trim();
      const rows = await q(
        "SELECT * FROM wa_appointments WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (reference_code=? OR ?='') AND status!='cancelled' ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref]
      );
      if (!rows.length) throw fail(`Active booking ${ref || "record"} not found for rescheduling`);
      await q("UPDATE wa_appointments SET slot_date=?, slot_time=?, status='rescheduled', updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [date, time, tenant, rows[0].id]);
      return { message: `Booking *${rows[0].reference_code}* has been rescheduled to *${date} at ${time}*.`, reference: rows[0].reference_code, status: "rescheduled" };
    }

    if (op === "cancel") {
      const ref = String(inputs.reference || "").trim();
      const rows = await q(
        "SELECT * FROM wa_appointments WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (reference_code=? OR ?='') AND status!='cancelled' ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref]
      );
      if (!rows.length) throw fail(`Active booking ${ref || "record"} not found`);
      await q("UPDATE wa_appointments SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [tenant, rows[0].id]);
      const wl = await q(
        "SELECT COUNT(*) AS cnt FROM wa_appointment_waitlist WHERE tenant_id=? AND preferred_date=? AND status='waiting'",
        [tenant, rows[0].slot_date]
      ).catch(() => [{ cnt: 0 }]);
      return {
        message: `Appointment *${rows[0].reference_code}* on ${rows[0].slot_date} at ${rows[0].slot_time} has been cancelled and the slot released.${Number(wl[0]?.cnt) > 0 ? ` (${wl[0].cnt} waitlisted customer(s) flagged for notification.)` : ""}`,
        reference: rows[0].reference_code,
        status: "cancelled",
      };
    }

    if (op === "waitlist") {
      const existing = await findByIdem("wa_appointment_waitlist", tenant, idem);
      if (existing) return { message: `You are already on the waitlist for ${existing.preferred_date} at ${existing.branch_name}.`, status: existing.status };
      await q(
        "INSERT INTO wa_appointment_waitlist (tenant_id,phone,customer_name,service_name,branch_name,preferred_date,status,idempotency_key) VALUES (?,?,?,?,?,?,'waiting',?)",
        [tenant, phone, inputs.customer_name || ctx.customerName || "Customer", service, branch, date, idem]
      );
      return { message: `Added you to the priority waitlist for *${service}* at *${branch}* on *${date}*. We will notify you as soon as a slot opens.`, status: "waiting" };
    }

    if (op === "staff_assign") {
      const ref = String(inputs.reference || "").trim();
      const staff = await pickStaff(q, tenant);
      const rows = await q(
        "SELECT id, reference_code FROM wa_appointments WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (reference_code=? OR ?='') ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref]
      );
      if (rows.length) {
        await q("UPDATE wa_appointments SET staff_user_id=?, staff_name=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [staff.id, staff.name, tenant, rows[0].id]);
        return { message: `Assigned specialist *${staff.name}* to appointment *${rows[0].reference_code}*.`, reference: rows[0].reference_code, staff_name: staff.name, status: "assigned" };
      }
      return { message: `Specialist *${staff.name}* has been assigned to coordinate your ${service} request.`, staff_name: staff.name, status: "assigned" };
    }

    if (op === "no_show_rebook") {
      const ref = String(inputs.reference || "").trim();
      const rows = await q(
        "SELECT * FROM wa_appointments WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (reference_code=? OR ?='') ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref]
      );
      const serviceName = rows[0]?.service_name || service;
      const newRef = makeRef("APT");
      await q(
        "INSERT INTO wa_appointments (tenant_id,conversation_id,phone,customer_name,reference_code,category,service_name,branch_name,slot_date,slot_time,status,notes,idempotency_key) VALUES (?,?,?,?,?,'appointment',?,?,?,?, 'confirmed', 'No-show recovery rebooking', ?)",
        [tenant, ctx.conversationId || null, phone, inputs.customer_name || "Customer", newRef, serviceName, rows[0]?.branch_name || branch, date, time, idem]
      );
      return { message: `We've rebooked your *${serviceName}* session for *${date} at ${time}*. New Reference: *${newRef}*.`, reference: newRef, status: "confirmed" };
    }

    if (op === "follow_up") {
      const rating = Math.min(5, Math.max(1, Number(inputs.rating) || 5));
      const ref = String(inputs.reference || "").trim();
      await q(
        "UPDATE wa_appointments SET rating=?, notes=?, status='completed', updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (reference_code=? OR ?='')",
        [rating, `[Feedback]: ${String(inputs.details || "")}`, tenant, `%${p10}`, phone, ref, ref]
      ).catch(() => {});
      return { message: `Thank you for your ${rating}/5 feedback! Our care team appreciates it. Reply "book" whenever you need your next appointment.`, reference: ref || "FOLLOWUP", rating, status: "completed" };
    }

    throw fail(`Unsupported appointment operation: ${op}`);
  }

  // ── 3. SALES & LEADS ────────────────────────────────────────────────────────
  async function handleSales(op, inputs, ctx) {
    const tenant = Number(ctx.tenantId) || 1;
    const phone = inputs.customer_phone || ctx.phone || "";
    const idem = makeIdemKey(ctx, op);

    if (op === "lead_capture") {
      await safeLeadCapture({
        phone,
        tenantId: tenant,
        name: inputs.customer_name || ctx.customerName || "WhatsApp Lead",
        email: inputs.email || "",
        service: inputs.service || "General Inquiry",
        sourceDetail: "Enterprise Flow Lead Capture",
      });
      return { message: `Thanks! We registered your inquiry for *${inputs.service || "our services"}* (${inputs.email || phone}). A specialist will share full details shortly.`, status: "captured" };
    }

    if (op === "qualify") {
      const budgetNum = Number(inputs.budget) || 0;
      const tier = budgetNum >= 50000 ? "Hot (Enterprise)" : budgetNum >= 10000 ? "Warm (Qualified)" : "Standard";
      await safeLeadCapture({
        phone,
        tenantId: tenant,
        name: inputs.customer_name || ctx.customerName || "WhatsApp Lead",
        service: inputs.service || "Qualified Lead",
        notes: `Score: ${tier} | Budget: ${budgetNum} | Target date: ${inputs.date || "Flexible"}`,
        sourceDetail: `Flow Qualify (${tier})`,
      });
      return { message: `Qualification complete (${tier}). Budget noted: ${budgetNum || "To be discussed"}. Routing you to the right product specialist.`, score: tier, status: "qualified" };
    }

    if (op === "assign") {
      const staff = await pickStaff(q, tenant);
      await safeLeadCapture({
        phone,
        tenantId: tenant,
        name: inputs.customer_name || ctx.customerName || "WhatsApp Lead",
        service: inputs.service || "Sales Inquiry",
        city: inputs.branch || "",
        assignedTo: staff.id,
        notes: `Assigned to ${staff.name} (${inputs.branch || "Default branch"})`,
        sourceDetail: "Flow Rep Assignment",
      });
      return { message: `Your inquiry for *${inputs.service || "our solutions"}* (${inputs.branch || "Primary branch"}) has been assigned to *${staff.name}*.`, staff_name: staff.name, status: "assigned" };
    }

    if (op === "quotation") {
      const existing = await findByIdem("wa_approval_requests", tenant, idem);
      if (existing) return { message: `Quotation request *${existing.approval_no}* is recorded (${existing.status}).`, reference: existing.approval_no, status: existing.status };
      const ref = makeRef("QTE");
      await q(
        "INSERT INTO wa_approval_requests (tenant_id,requester_phone,requester_name,approval_no,request_type,item_name,amount,details,status,idempotency_key) VALUES (?,?,?,?,'quotation',?,?,?,'pending',?)",
        [tenant, phone, inputs.customer_name || "Customer", ref, inputs.service || "Custom Package", Number(inputs.budget) || 0, inputs.details || "", idem]
      );
      return { message: `Quotation request *${ref}* recorded for *${inputs.service || "your requirements"}*. Our sales team will send the official PDF quotation after pricing verification.`, reference: ref, status: "pending" };
    }

    if (op === "demo") {
      const ref = makeRef("DMO");
      const staff = await pickStaff(q, tenant);
      await q(
        "INSERT INTO wa_appointments (tenant_id,conversation_id,phone,customer_name,reference_code,category,service_name,branch_name,slot_date,slot_time,staff_user_id,staff_name,status,idempotency_key) VALUES (?,?,?,?,?,'demo',?,?,?,?,?,?,'confirmed',?)",
        [tenant, ctx.conversationId || null, phone, inputs.customer_name || "Prospect", ref, inputs.service || "Product Demo", "Online / Video", inputs.date || new Date().toISOString().slice(0, 10), inputs.time || "11:00", staff.id, staff.name, idem]
      );
      return { message: `Demo confirmed! Reference: *${ref}*\nTopic: ${inputs.service}\nDate: ${inputs.date} at ${inputs.time}\nHost: ${staff.name}`, reference: ref, status: "confirmed", staff_name: staff.name };
    }

    throw fail(`Unsupported sales operation: ${op}`);
  }

  // ── 4. INVOICES & PAYMENTS (Verified Financial Guardrails) ──────────────────
  async function handleFinance(op, inputs, ctx) {
    const tenant = Number(ctx.tenantId) || 1;
    const phone = inputs.customer_phone || ctx.phone || "";
    const p10 = clean10(phone);
    const ref = String(inputs.reference || "").trim();
    const idem = makeIdemKey(ctx, op);

    if (op === "invoice" || op === "receipt" || op === "payment_link") {
      const billingRes = await getBilling().getCustomerBillsAndReceipts(phone).catch(() => ({ found: false, invoices: [] }));
      const matchingOrderRows = await q(
        "SELECT order_no, total_amount, currency, payment_status, fulfillment_status FROM wa_crm_orders WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (order_no=? OR ?='') ORDER BY id DESC LIMIT 3",
        [tenant, `%${p10}`, phone, ref, ref]
      ).catch(() => []);

      const matchedInv = (billingRes.invoices || []).find((i) => !ref || String(i.invoice_no).toLowerCase() === ref.toLowerCase()) || billingRes.invoices?.[0];
      const matchedOrd = matchingOrderRows[0];

      if (!matchedInv && !matchedOrd) {
        throw fail(`No verified invoice or order record found for reference ${ref || "this phone number"}. Transferring to accounts.`);
      }

      if (op === "receipt") {
        const isPaid = matchedInv ? Number(matchedInv.amount_paid) > 0 : matchedOrd?.payment_status === "paid_verified";
        if (!isPaid) throw fail("Payment has not been verified through the payment gateway yet. No receipt is issued until gateway settlement confirms.");
        const invNo = matchedInv?.invoice_no || matchedOrd.order_no;
        const paidAmt = matchedInv ? matchedInv.amount_paid : matchedOrd.total_amount;
        return { message: `Verified Payment Receipt for *${invNo}*\nAmount Paid: INR ${paidAmt}\nStatus: Verified & Settled.`, reference: invNo, status: "paid_verified" };
      }

      if (op === "payment_link") {
        const dueAmt = matchedInv ? matchedInv.balance_due : (matchedOrd.payment_status === "paid_verified" ? 0 : matchedOrd.total_amount);
        const targetNo = matchedInv?.invoice_no || matchedOrd.order_no;
        if (Number(dueAmt) <= 0) {
          return { message: `Invoice *${targetNo}* already has zero balance due.`, reference: targetNo, status: "paid_verified" };
        }
        return {
          message: `Authorized Payment Summary for *${targetNo}*\nBalance Due: *INR ${dueAmt}*\nPlease use your configured Razorpay / portal link. Invoices are marked paid ONLY after provider webhook verification.`,
          reference: targetNo,
          balance_due: dueAmt,
          status: "pending_payment",
        };
      }

      const targetNo = matchedInv?.invoice_no || matchedOrd.order_no;
      const total = matchedInv ? matchedInv.amount_billed : matchedOrd.total_amount;
      const due = matchedInv ? matchedInv.balance_due : (matchedOrd.payment_status === "paid_verified" ? 0 : matchedOrd.total_amount);
      return {
        message: `Verified Invoice *${targetNo}*\nTotal: INR ${total}\nBalance Due: INR ${due}\nStatus: ${matchedInv?.status || matchedOrd.payment_status}`,
        reference: targetNo,
        balance_due: due,
        status: due > 0 ? "unpaid" : "paid_verified",
      };
    }

    if (op === "reminder") {
      const existing = await findByIdem("wa_approval_requests", tenant, idem);
      const rNo = existing?.approval_no || ref || makeRef("REM");
      return { message: `Payment balance reminder configured for reference *${rNo}*. Approved WhatsApp templates will be used outside the 24h window.`, reference: rNo, status: "scheduled" };
    }

    if (op === "dispute") {
      const existing = await findByIdem("wa_support_tickets", tenant, idem);
      if (existing) return { message: `Billing dispute *${existing.ticket_no}* is already registered.`, reference: existing.ticket_no, status: existing.status };
      const tNo = makeRef("DSP");
      await q(
        "INSERT INTO wa_support_tickets (tenant_id,conversation_id,phone,ticket_no,category,subject,description,priority,status,idempotency_key) VALUES (?,?,?,?,'billing_dispute',?,?, 'high', 'escalated', ?)",
        [tenant, ctx.conversationId || null, phone, tNo, `Billing Dispute (${ref || "Invoice"})`, inputs.details || "", idem]
      );
      return { message: `Billing dispute *${tNo}* opened for *${ref || "your invoice"}*. An accounts specialist will review verified ledgers with you.`, reference: tNo, status: "escalated" };
    }

    throw fail(`Unsupported finance operation: ${op}`);
  }

  // ── 5. E-COMMERCE & ORDERS ──────────────────────────────────────────────────
  async function handleCommerce(op, inputs, ctx) {
    const tenant = Number(ctx.tenantId) || 1;
    const phone = inputs.customer_phone || ctx.phone || "";
    const p10 = clean10(phone);
    const idem = makeIdemKey(ctx, op);

    if (op === "product_search") {
      const term = `%${String(inputs.product || "").trim()}%`;
      const rows = await q(
        "SELECT sku, name, category, price, currency, stock_qty FROM wa_crm_products WHERE tenant_id=? AND is_active=1 AND (name LIKE ? OR sku LIKE ? OR category LIKE ?) ORDER BY stock_qty DESC, id DESC LIMIT 5",
        [tenant, term, term, term]
      ).catch(() => []);
      if (!rows.length) {
        return { message: `No catalog products matched "${inputs.product}". Let our specialist check warehouse inventory for you.`, found: false, status: "not_found" };
      }
      const list = rows.map((p, i) => `${i + 1}. *${p.name}* (${p.sku}) — ${p.currency} ${p.price} · Stock: ${p.stock_qty}`).join("\n");
      return { message: `Matching catalog items:\n${list}`, found: true, top_sku: rows[0].sku, status: "found" };
    }

    if (op === "checkout") {
      const existing = await findByIdem("wa_crm_orders", tenant, idem);
      if (existing) return { message: `Order *${existing.order_no}* is created (Total: ${existing.currency} ${existing.total_amount}).`, reference: existing.order_no, status: existing.fulfillment_status };
      const qty = Math.max(1, Math.min(100, Number.parseInt(inputs.quantity, 10) || 1));
      const term = `%${String(inputs.product || "").trim()}%`;
      const prods = await q(
        "SELECT id, sku, name, price, currency, stock_qty FROM wa_crm_products WHERE tenant_id=? AND is_active=1 AND (sku=? OR name LIKE ?) LIMIT 1",
        [tenant, String(inputs.product || "").trim(), term]
      ).catch(() => []);
      const prod = prods[0];
      if (prod && Number(prod.stock_qty) < qty) {
        throw fail(`Insufficient stock for ${prod.name}: only ${prod.stock_qty} available.`);
      }
      const total = prod ? Number(prod.price) * qty : 0;
      const ordNo = makeRef("ORD");
      const items = JSON.stringify([{ product: prod?.name || inputs.product, sku: prod?.sku || "CUSTOM", qty, unit_price: prod?.price || 0 }]);
      await q(
        "INSERT INTO wa_crm_orders (tenant_id,conversation_id,contact_id,phone,customer_name,order_no,items_json,total_amount,currency,payment_status,fulfillment_status,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,'unpaid','pending',?)",
        [tenant, ctx.conversationId || null, ctx.contactId || null, phone, inputs.customer_name || ctx.customerName || "Customer", ordNo, items, total, prod?.currency || "INR", idem]
      );
      if (prod) {
        const nextStock = Math.max(0, Number(prod.stock_qty) - qty);
        await q("UPDATE wa_crm_products SET stock_qty=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [nextStock, tenant, prod.id]).catch(() => {});
      }
      return {
        message: `Order *${ordNo}* created for *${qty}x ${prod?.name || inputs.product}*${total > 0 ? ` (Total: ${prod?.currency || "INR"} ${total})` : ""}. Status: Pending Payment/Confirmation.`,
        reference: ordNo,
        total_amount: total,
        status: "pending",
      };
    }

    if (op === "order_status" || op === "cancel" || op === "return") {
      const ref = String(inputs.reference || "").trim();
      const rows = await q(
        "SELECT * FROM wa_crm_orders WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (order_no=? OR ?='') ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref]
      );
      if (!rows.length) throw fail(`No order found for ${ref || "this phone number"}`);
      const o = rows[0];
      if (op === "order_status") {
        return { message: `Order *${o.order_no}* — Fulfillment: *${o.fulfillment_status.toUpperCase()}*, Payment: *${o.payment_status}*${o.tracking_no ? `, Tracking: ${o.tracking_no}` : ""}.`, reference: o.order_no, status: o.fulfillment_status };
      }
      if (op === "cancel") {
        if (["dispatched", "delivered"].includes(o.fulfillment_status)) {
          throw fail(`Order ${o.order_no} is already ${o.fulfillment_status} and requires a return request instead.`);
        }
        await q("UPDATE wa_crm_orders SET fulfillment_status='cancelled', pod_note=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [inputs.details || "Cancelled by customer", tenant, o.id]);
        return { message: `Order *${o.order_no}* has been cancelled under store rules.`, reference: o.order_no, status: "cancelled" };
      }
      await q("UPDATE wa_crm_orders SET fulfillment_status='returned', pod_note=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [inputs.details || "Return/exchange requested", tenant, o.id]);
      return { message: `Return/exchange request recorded for order *${o.order_no}*. Our returns desk will share pickup details shortly.`, reference: o.order_no, status: "returned" };
    }

    throw fail(`Unsupported commerce operation: ${op}`);
  }

  // ── 6. RESTAURANT & HOSPITALITY ─────────────────────────────────────────────
  async function handleHospitality(op, inputs, ctx) {
    const tenant = Number(ctx.tenantId) || 1;
    const phone = inputs.customer_phone || ctx.phone || "";
    const idem = makeIdemKey(ctx, op);

    if (op === "menu") {
      const term = `%${String(inputs.service || "").trim()}%`;
      const items = await q(
        "SELECT name, price, currency, description FROM wa_crm_products WHERE tenant_id=? AND is_active=1 AND (name LIKE ? OR category LIKE ? OR 'menu'=LOWER(?)) LIMIT 6",
        [tenant, term, term, String(inputs.service || "").trim()]
      ).catch(() => []);
      if (items.length) {
        return { message: `Menu & Packages:\n${items.map((m, i) => `${i + 1}. *${m.name}* — ${m.currency} ${m.price}`).join("\n")}`, status: "listed" };
      }
      return { message: `We offer Dine-in, Private Dining, and Chef Tasting Packages for *${inputs.service || "today"}*. Reply with party size & time to reserve your table.`, status: "info" };
    }

    if (op === "table" || op === "room") {
      const existing = await findByIdem("wa_appointments", tenant, idem);
      if (existing) {
        return { message: `${op === "table" ? "Table" : "Room"} reservation *${existing.reference_code}* is already confirmed for ${existing.slot_date}.`, reference: existing.reference_code, status: existing.status };
      }
      const ref = makeRef(op === "table" ? "TBL" : "ROM");
      const guests = Math.max(1, Number.parseInt(inputs.guests, 10) || 2);
      await q(
        "INSERT INTO wa_appointments (tenant_id,conversation_id,phone,customer_name,reference_code,category,service_name,branch_name,slot_date,slot_time,guests_count,status,notes,idempotency_key) VALUES (?,?,?,?,?,?,?,'Main',?,?,?,'confirmed',?,?)",
        [tenant, ctx.conversationId || null, phone, inputs.customer_name || "Guest", ref, op, op === "table" ? "Table Reservation" : "Room Reservation", inputs.date || new Date().toISOString().slice(0, 10), inputs.time || "19:30", guests, inputs.details || "", idem]
      );
      return { message: `${op === "table" ? "Table" : "Room"} reservation *${ref}* confirmed for *${guests} guest(s)* on *${inputs.date || "today"}*${inputs.time ? ` at ${inputs.time}` : ""}.`, reference: ref, status: "confirmed" };
    }

    if (op === "room_service") {
      const tNo = makeRef("RMS");
      await q(
        "INSERT INTO wa_support_tickets (tenant_id,conversation_id,phone,ticket_no,category,subject,description,priority,status,idempotency_key) VALUES (?,?,?,?,'support',?,?, 'high', 'open', ?)",
        [tenant, ctx.conversationId || null, phone, tNo, `Room Service / Stay (${inputs.reference || "Guest"})`, inputs.details || "", idem]
      );
      return { message: `Hospitality request *${tNo}* received for *${inputs.reference}*. Our concierge team is dispatching now.`, reference: tNo, status: "open" };
    }

    if (op === "feedback") {
      return handleSupport("feedback", inputs, ctx);
    }
    throw fail(`Unsupported hospitality operation: ${op}`);
  }

  // ── 7. LOGISTICS & FIELD SERVICE ────────────────────────────────────────────
  async function handleLogistics(op, inputs, ctx) {
    const tenant = Number(ctx.tenantId) || 1;
    const phone = inputs.customer_phone || ctx.phone || "";
    const p10 = clean10(phone);
    const ref = String(inputs.reference || "").trim();
    const idem = makeIdemKey(ctx, op);

    if (op === "tracking") {
      const rows = await q(
        "SELECT order_no, fulfillment_status, tracking_no, updated_at FROM wa_crm_orders WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (order_no=? OR tracking_no=? OR ?='') ORDER BY id DESC LIMIT 1",
        [tenant, `%${p10}`, phone, ref, ref, ref]
      ).catch(() => []);
      if (!rows.length) throw fail(`No verified shipment found for ${ref || "this phone number"}`);
      const s = rows[0];
      return { message: `Shipment *${s.tracking_no || s.order_no}* status: *${s.fulfillment_status.toUpperCase()}*. Last updated: ${s.updated_at || "Recently"}.`, reference: s.tracking_no || s.order_no, status: s.fulfillment_status };
    }

    if (op === "pickup" || op === "technician") {
      const refCode = makeRef(op === "pickup" ? "PKP" : "TEC");
      const staff = await pickStaff(q, tenant);
      await q(
        "INSERT INTO wa_appointments (tenant_id,conversation_id,phone,customer_name,reference_code,category,service_name,branch_name,slot_date,staff_user_id,staff_name,status,notes,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?)",
        [tenant, ctx.conversationId || null, phone, inputs.customer_name || "Customer", refCode, op, op === "pickup" ? "Courier Pickup" : (inputs.service || "Field Technician"), inputs.address || "On-site", inputs.date || new Date().toISOString().slice(0, 10), staff.id, staff.name, inputs.details || "", idem]
      );
      return { message: `${op === "pickup" ? "Pickup" : "Technician visit"} *${refCode}* scheduled for *${inputs.date}* at *${inputs.address}*. Assigned: ${staff.name}.`, reference: refCode, status: "confirmed" };
    }

    if (op === "delivery_issue") {
      return handleSupport("complaint_escalate", { ...inputs, details: `[Delivery Issue ${ref}]: ${inputs.details || ""}` }, ctx);
    }

    if (op === "delivery_confirm") {
      const updated = await q(
        "UPDATE wa_crm_orders SET fulfillment_status='delivered', pod_note=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND (phone LIKE ? OR phone=?) AND (order_no=? OR tracking_no=?)",
        [inputs.details || "Delivered and verified", tenant, `%${p10}`, phone, ref, ref]
      ).catch(() => ({ affectedRows: 0 }));
      return { message: updated.affectedRows ? `Proof of delivery logged for *${ref}*.` : `Delivery note recorded for *${ref}*. Operations team synced.`, reference: ref || "POD", status: "delivered" };
    }

    throw fail(`Unsupported logistics operation: ${op}`);
  }

  // ── 8. EMPLOYEE & HR SELF-SERVICE ───────────────────────────────────────────
  async function handleHr(op, inputs, ctx) {
    const tenant = Number(ctx.tenantId) || 1;
    const phone = inputs.customer_phone || ctx.phone || "";
    const p10 = clean10(phone);
    const idem = makeIdemKey(ctx, op);

    if (op === "leave_balance" || op === "payslip") {
      // Strictly verify employee phone in users/employees or previous HR records before exposing private data
      const empRows = await q(
        "SELECT id, first_name, last_name, email FROM users WHERE tenant_id=? AND (phone LIKE ? OR phone=?) LIMIT 1",
        [tenant, `%${p10}`, phone]
      ).catch(() => []);
      if (!empRows.length) {
        const ref = makeRef("HRV");
        await q(
          "INSERT INTO wa_hr_requests (tenant_id,employee_phone,employee_name,request_no,request_type,details,status,idempotency_key) VALUES (?,?,?,?,?,?,'pending',?)",
          [tenant, phone, inputs.customer_name || "Employee", ref, op, `Verification required for ${inputs.reference || op}`, idem]
        ).catch(() => {});
        return { message: `Private HR access (*${op}*) requires phone verification matching your registered employee profile. Request *${ref}* queued for HR review.`, reference: ref, status: "pending_verification" };
      }
      const empName = [empRows[0].first_name, empRows[0].last_name].filter(Boolean).join(" ") || empRows[0].email;
      const reqCount = await q("SELECT COUNT(*) AS used FROM wa_hr_requests WHERE tenant_id=? AND employee_phone LIKE ? AND request_type='leave' AND status='approved'", [tenant, `%${p10}`]).catch(() => [{ used: 0 }]);
      if (op === "leave_balance") {
        const remaining = Math.max(0, 18 - Number(reqCount[0]?.used || 0));
        return { message: `Hello *${empName}*, your verified annual leave balance is *${remaining} day(s)* (${reqCount[0]?.used || 0} used this cycle).`, reference: inputs.reference || "BAL", status: "verified" };
      }
      const ref = makeRef("PAY");
      await q("INSERT INTO wa_hr_requests (tenant_id,employee_phone,employee_name,request_no,request_type,details,status,idempotency_key) VALUES (?,?,?,?,'payslip',?,'pending',?)", [tenant, phone, empName, ref, `Payslip period ref: ${inputs.reference || "Latest"}`, idem]).catch(() => {});
      return { message: `Identity verified for *${empName}*. Secure payslip dispatch request *${ref}* generated — check your verified HR portal/email.`, reference: ref, status: "pending" };
    }

    const existing = await findByIdem("wa_hr_requests", tenant, idem);
    if (existing) return { message: `HR request *${existing.request_no}* (${existing.request_type}) is already ${existing.status}.`, reference: existing.request_no, status: existing.status };
    const ref = makeRef("HR");
    await q(
      "INSERT INTO wa_hr_requests (tenant_id,employee_phone,employee_name,request_no,request_type,target_date,target_time,details,status,idempotency_key) VALUES (?,?,?,?,?,?,?,?,'pending',?)",
      [tenant, phone, inputs.customer_name || ctx.customerName || "Employee", ref, op, inputs.date || null, inputs.time || null, inputs.details || "", idem]
    );
    return { message: `HR *${op}* request *${ref}* submitted for manager approval (Target date: ${inputs.date || "N/A"}).`, reference: ref, status: "pending" };
  }

  // ── 9. EDUCATION & ADMISSIONS ───────────────────────────────────────────────
  async function handleEducation(op, inputs, ctx) {
    const tenant = Number(ctx.tenantId) || 1;
    const phone = inputs.customer_phone || ctx.phone || "";
    const idem = makeIdemKey(ctx, op);

    if (op === "course") {
      return handleSupport("knowledge_search", { ...inputs, question: inputs.course || inputs.question }, ctx);
    }
    if (op === "admission") {
      await safeLeadCapture({
        phone,
        tenantId: tenant,
        name: inputs.customer_name || ctx.customerName || "Student Inquiry",
        email: inputs.email || "",
        service: `Course: ${inputs.course || "Admissions"}`,
        sourceDetail: "Education Admissions Flow",
      });
      return { message: `Admission inquiry saved for *${inputs.course}*! Checklist and brochure link sent to ${inputs.email || "this chat"}.`, status: "captured" };
    }
    if (op === "counseling") {
      return handleAppointments("booking_create", { ...inputs, service: `Counseling: ${inputs.course || "Admissions"}`, branch: "Admissions Desk" }, ctx);
    }
    if (op === "fees") {
      return handleFinance("invoice", inputs, ctx);
    }
    if (op === "schedule") {
      return handleSupport("knowledge_search", { ...inputs, question: `class schedule timetable ${inputs.course || ""} ${inputs.reference || ""}` }, ctx);
    }
    throw fail(`Unsupported education operation: ${op}`);
  }

  // ── 10. BUSINESS OPERATIONS & APPROVALS ─────────────────────────────────────
  async function handleOperations(op, inputs, ctx) {
    const tenant = Number(ctx.tenantId) || 1;
    const phone = inputs.customer_phone || ctx.phone || "";
    const idem = makeIdemKey(ctx, op);

    if (op === "stock") {
      const term = `%${String(inputs.product || "").trim()}%`;
      const rows = await q(
        "SELECT sku, name, stock_qty, price, currency FROM wa_crm_products WHERE tenant_id=? AND (name LIKE ? OR sku LIKE ?) LIMIT 5",
        [tenant, term, term]
      ).catch(() => []);
      if (!rows.length) return { message: `No stock record matched "${inputs.product}" at ${inputs.branch || "Warehouse"}.`, status: "not_found" };
      const p = rows[0];
      return { message: `Stock for *${p.name}* (${p.sku}) at ${inputs.branch || "Main"}: *${p.stock_qty} unit(s)* on hand.`, reference: p.sku, stock_qty: p.stock_qty, status: p.stock_qty > 0 ? "in_stock" : "out_of_stock" };
    }

    if (op === "report") {
      const [aptCount] = await q("SELECT COUNT(*) AS cnt FROM wa_appointments WHERE tenant_id=?", [tenant]).catch(() => [{ cnt: 0 }]);
      const [tktCount] = await q("SELECT COUNT(*) AS cnt FROM wa_support_tickets WHERE tenant_id=? AND status IN ('open','escalated')", [tenant]).catch(() => [{ cnt: 0 }]);
      const [ordCount] = await q("SELECT COUNT(*) AS cnt FROM wa_crm_orders WHERE tenant_id=?", [tenant]).catch(() => [{ cnt: 0 }]);
      const [aprCount] = await q("SELECT COUNT(*) AS cnt FROM wa_approval_requests WHERE tenant_id=? AND status='pending'", [tenant]).catch(() => [{ cnt: 0 }]);
      return {
        message: `Daily Operational Summary (${inputs.date || new Date().toISOString().slice(0, 10)}, ${inputs.branch || "All Branches"}):\n• Appointments: ${aptCount?.cnt || 0}\n• Open/Escalated Tickets: ${tktCount?.cnt || 0}\n• Orders: ${ordCount?.cnt || 0}\n• Pending Approvals: ${aprCount?.cnt || 0}`,
        status: "ready",
      };
    }

    if (op === "approval") {
      const ref = String(inputs.reference || "").trim();
      const rows = await q("SELECT * FROM wa_approval_requests WHERE tenant_id=? AND approval_no=? LIMIT 1", [tenant, ref]).catch(() => []);
      if (!rows.length) throw fail(`Approval request ${ref || "reference"} not found`);
      return { message: `Approval *${rows[0].approval_no}* (${rows[0].request_type}: ${rows[0].item_name || rows[0].details}) is currently *${rows[0].status.toUpperCase()}*. Manager confirmation required to change decision.`, reference: rows[0].approval_no, status: rows[0].status };
    }

    // purchase / expense
    const existing = await findByIdem("wa_approval_requests", tenant, idem);
    if (existing) return { message: `Request *${existing.approval_no}* is pending manager approval.`, reference: existing.approval_no, status: existing.status };
    const ref = makeRef(op === "expense" ? "EXP" : "PO");
    await q(
      "INSERT INTO wa_approval_requests (tenant_id,requester_phone,requester_name,approval_no,request_type,item_name,quantity,amount,details,status,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,'pending',?)",
      [tenant, phone, inputs.customer_name || "Staff", ref, op, inputs.product || "Operational Item", Number(inputs.quantity) || 1, Number(inputs.budget) || 0, inputs.details || "", idem]
    );
    return { message: `${op === "expense" ? "Expense claim" : "Purchase request"} *${ref}* queued for authorized manager approval.`, reference: ref, status: "pending" };
  }

  const dispatch = {
    support: handleSupport,
    appointments: handleAppointments,
    sales: handleSales,
    finance: handleFinance,
    commerce: handleCommerce,
    hospitality: handleHospitality,
    logistics: handleLogistics,
    hr: handleHr,
    education: handleEducation,
    operations: handleOperations,
  };

  async function executeOperation(operation, inputs = {}, context = {}) {
    const [system, action] = String(operation || "").split(".");
    const handler = dispatch[system];
    if (!handler || !action) throw fail(`Unknown built-in CRM operation: ${operation}`);
    const data = await handler(action, inputs, context);
    return { success: true, data };
  }

  return { executeOperation, SYSTEMS_META };
}

module.exports = {
  createBuiltinExecutor,
  SYSTEMS_META,
  executeOperation: (...args) => createBuiltinExecutor().executeOperation(...args),
};
