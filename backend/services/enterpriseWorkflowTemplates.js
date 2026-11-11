"use strict";

/**
 * Enterprise 10-System WhatsApp Workflow Templates & Hub Installer.
 * Provides deep multi-branch editable templates (AI intent/KB, Business Hours,
 * Interactive Pickers, Switch/Condition Logic, Built-in/External Business Actions,
 * Wait/Reminders, Sub-workflow Chaining, and Human Escalation) for all 10 systems.
 */

const { SYSTEMS_META } = require("./builtinWorkflowExecutor");
const industryBlueprints = require("./industryFlowBlueprints");

const n = (key, type, config, col = 0, row = 0) => ({
  node_key: key,
  node_type: type,
  config,
  position_x: 120 + col * 270,
  position_y: 120 + row * 190,
});

function buildFlagshipTemplates() {
  const flows = [];

  // ── SYSTEM 1: CUSTOMER SERVICE ──────────────────────────────────────────────
  flows.push({
    key: "enterprise.support.hub",
    systemId: "support",
    category: "Customer service",
    industries: "All industries",
    isFlagship: true,
    usesAi: false,
    name: "Customer Support Concierge (KB + Tickets + SLA)",
    description: "Greets contacts, routes FAQ/KB search, ticket creation, ticket status check, or urgent human escalation based on office hours.",
    trigger_type: "keyword",
    trigger_config: {
      template_key: "enterprise.support.hub",
      keywords: ["help", "support", "issue", "faq", "complaint", "ticket"],
      match_mode: "contains",
      priority: 20,
      cooldown_minutes: 0,
      allow_restart_after_human: true,
      escape_keywords: "stop, human, agent",
    },
    entry_node_key: "lookup_contact",
    nodes: [
      n("lookup_contact", "contact_lookup", { next_node_key: "check_hours" }, 0, 0),
      n("check_hours", "business_hours", {
        timezone: "Asia/Kolkata", days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "20:00",
        open_next: "support_menu", closed_next: "afterhours_menu",
      }, 1, 0),
      n("support_menu", "send_list", {
        text: "Hello {{customer.name}}! Welcome to Support. Choose how we can help today:",
        button_text: "Support Options",
        options: [
          { id: "kb", title: "Ask FAQ / Docs", description: "Instant policy & product answers", next_node_key: "ask_question" },
          { id: "new_ticket", title: "Create Support Ticket", description: "Log an issue with SLA tracking", next_node_key: "collect_ticket" },
          { id: "status", title: "Check Ticket Status", description: "Look up TKT reference", next_node_key: "collect_ref" },
          { id: "escalate", title: "Escalate Urgent Issue", description: "Priority supervisor review", next_node_key: "collect_escalate_ref" },
          { id: "human", title: "Talk to Agent", description: "Connect to support team", next_node_key: "human_handoff" },
        ],
      }, 2, 0),
      n("afterhours_menu", "send_buttons", {
        text: "Our live desk is currently outside working hours (9 AM - 8 PM). I can search instant FAQs or create a priority morning ticket:",
        buttons: [
          { id: "kb", title: "Search FAQs", next_node_key: "ask_question" },
          { id: "new_ticket", title: "Log Offline Ticket", next_node_key: "collect_ticket" },
          { id: "human", title: "Urgent Callback", next_node_key: "human_handoff" },
        ],
      }, 2, 2),
      n("ask_question", "collect_input", {
        prompt_text: "Type your question and I will search our company Knowledge Base & policies:",
        var_key: "question", validation_type: "none", min_length: 3, max_length: 600, next_node_key: "run_kb",
      }, 3, 0),
      n("run_kb", "business_action", {
        connection: "builtin", operation: "support.knowledge_search",
        inputs: { customer_phone: "{{customer.phone}}", question: "{{question}}" },
        outputs: { kb_answer: "message" },
        next_node_key: "send_kb_answer", error_next: "human_handoff",
      }, 4, 0),
      n("send_kb_answer", "send_buttons", {
        text: "{{kb_answer}}\n\nDid this solve your question?",
        buttons: [
          { id: "solved", title: "Yes, Resolved", next_node_key: "rate_experience" },
          { id: "ticket", title: "Open Ticket", next_node_key: "collect_ticket" },
          { id: "agent", title: "Speak to Agent", next_node_key: "human_handoff" },
        ],
      }, 5, 0),
      n("collect_ticket", "collect_input", {
        prompt_text: "Please describe your issue or complaint in detail so our team can assign it with a 4-hour SLA:",
        var_key: "details", validation_type: "none", min_length: 5, max_length: 1000, next_node_key: "tag_support",
      }, 3, 1),
      n("tag_support", "set_tag", { tag: "support-ticket", next_node_key: "create_ticket_action" }, 4, 1),
      n("create_ticket_action", "business_action", {
        connection: "builtin", operation: "support.ticket_create",
        inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", details: "{{details}}", priority: "normal" },
        outputs: { ticket_msg: "message", ticket_ref: "reference" },
        next_node_key: "ticket_done", error_next: "human_handoff",
      }, 5, 1),
      n("ticket_done", "send_buttons", {
        text: "{{ticket_msg}}",
        buttons: [
          { id: "csat", title: "Rate Support", next_node_key: "rate_experience" },
          { id: "done", title: "Done", next_node_key: "end_flow" },
        ],
      }, 6, 1),
      n("collect_ref", "collect_input", {
        prompt_text: "Enter your Ticket Reference (e.g. TKT-260101-AB12):",
        var_key: "reference", validation_type: "reference", max_length: 64, next_node_key: "lookup_ticket",
      }, 3, 2),
      n("lookup_ticket", "business_action", {
        connection: "builtin", operation: "support.ticket_status",
        inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" },
        outputs: { status_msg: "message" },
        next_node_key: "show_status", error_next: "human_handoff",
      }, 4, 2),
      n("show_status", "send_message", { text: "{{status_msg}}", next_node_key: "end_flow" }, 5, 2),
      n("collect_escalate_ref", "collect_input", {
        prompt_text: "Share your ticket/order reference and what went wrong so we can escalate immediately:",
        var_key: "details", validation_type: "none", min_length: 5, max_length: 800, next_node_key: "run_escalate",
      }, 3, 3),
      n("run_escalate", "business_action", {
        connection: "builtin", operation: "support.complaint_escalate",
        inputs: { customer_phone: "{{customer.phone}}", reference: "", details: "{{details}}" },
        outputs: { escalate_msg: "message" },
        next_node_key: "escalate_handoff", error_next: "human_handoff",
      }, 4, 3),
      n("escalate_handoff", "send_message", { text: "{{escalate_msg}}", next_node_key: "human_handoff" }, 5, 3),
      n("rate_experience", "collect_input", {
        prompt_text: "How would you rate our support today from 1 to 5?",
        var_key: "rating", validation_type: "number", min: 1, max: 5, integer: true, next_node_key: "save_csat",
      }, 6, 0),
      n("save_csat", "business_action", {
        connection: "builtin", operation: "support.feedback",
        inputs: { customer_phone: "{{customer.phone}}", reference: "", rating: "{{rating}}", details: "Support Hub Rating" },
        outputs: { csat_msg: "message" },
        next_node_key: "send_csat_thanks", error_next: "end_flow",
      }, 7, 0),
      n("send_csat_thanks", "send_message", { text: "{{csat_msg}}", next_node_key: "end_flow" }, 8, 0),
      n("human_handoff", "handoff", { note: "Connecting you to our support specialist right away. They can see your details above." }, 6, 3),
      n("end_flow", "end", {}, 9, 0),
    ],
  });

  // Optional AI-powered Customer Service Router (uses ai_intent + KB)
  flows.push({
    key: "enterprise.support.ai_agent",
    systemId: "support",
    category: "Customer service",
    industries: "All industries",
    isFlagship: true,
    usesAi: true,
    name: "AI Customer Service & Intent Router (LLM + KB)",
    description: "Uses AI Intent Classification + Knowledge Base search + automatic escalation when negative or unresolved. Requires Inbox AI API key to publish.",
    trigger_type: "keyword",
    trigger_config: {
      template_key: "enterprise.support.ai_agent",
      keywords: ["ask ai", "ai help", "chat bot"],
      match_mode: "contains",
      priority: 30,
    },
    entry_node_key: "lookup",
    nodes: [
      n("lookup", "contact_lookup", { next_node_key: "ask_msg" }, 0, 0),
      n("ask_msg", "collect_input", {
        prompt_text: "Hi {{customer.name}}! Ask me anything about pricing, policies, bookings, orders, or support:",
        var_key: "question", validation_type: "none", max_length: 800, next_node_key: "classify",
      }, 1, 0),
      n("classify", "ai_intent", {
        input_variable: "question",
        prompt: "Classify into faq, billing, booking, complaint",
        branches: { faq: "kb_lookup", billing: "billing_route", booking: "booking_route", complaint: "ticket_route" },
        fallback_node: "kb_lookup",
        error_next: "human",
      }, 2, 0),
      n("kb_lookup", "business_action", {
        connection: "builtin", operation: "support.knowledge_search",
        inputs: { customer_phone: "{{customer.phone}}", question: "{{question}}" },
        outputs: { kb_answer: "message" },
        next_node_key: "ai_polish", error_next: "human",
      }, 3, 0),
      n("ai_polish", "ai_generate", {
        system_prompt: "You are a helpful business concierge. Polish facts without inventing prices, dates, or payment confirmations.",
        prompt: "Customer asked: {{question}}\nVerified KB Result: {{kb_answer}}",
        output_variable: "ai_reply_text",
        send_immediately: true,
        next_node_key: "end_ai",
        error_next: "human",
      }, 4, 0),
      n("billing_route", "business_action", {
        connection: "builtin", operation: "finance.invoice",
        inputs: { customer_phone: "{{customer.phone}}", reference: "" },
        outputs: { inv_msg: "message" },
        next_node_key: "reply_billing", error_next: "human",
      }, 3, 1),
      n("reply_billing", "send_message", { text: "{{inv_msg}}", next_node_key: "end_ai" }, 4, 1),
      n("booking_route", "jump_to_flow", { target_flow_key: "enterprise.appointments.01_new_booking", target_flow_id: 0 }, 3, 2),
      n("ticket_route", "business_action", {
        connection: "builtin", operation: "support.ticket_create",
        inputs: { customer_phone: "{{customer.phone}}", details: "{{question}}", priority: "high" },
        outputs: { tkt_msg: "message" },
        next_node_key: "reply_ticket", error_next: "human",
      }, 3, 3),
      n("reply_ticket", "send_message", { text: "{{tkt_msg}}", next_node_key: "human" }, 4, 3),
      n("human", "handoff", { note: "Routing your request to a team specialist with full context." }, 5, 2),
      n("end_ai", "end", {}, 5, 0),
    ],
  });

  // ── SYSTEM 2: APPOINTMENTS & SCHEDULING (All 10 Workflows Upgraded) ──────────
  const appointmentDeepWorkflows = [
    {
      key: "enterprise.appointments.01_new_booking",
      systemId: "appointments",
      category: "Appointments",
      industries: "Clinics, salons, consultants, garages",
      name: "01. New Appointment Booking (Branch + Slots + Auto-Assign)",
      description: "Full booking flow: branch selector list -> service selection -> live open slot check -> booking confirmation with auto staff assignment.",
      keywords: ["book", "appointment", "book appointment"],
      extraNodes: () => ({
        entry_node_key: "start",
        nodes: [
          n("start", "contact_lookup", { next_node_key: "branch_pick" }, 0, 0),
          n("branch_pick", "send_buttons", {
            text: "Hi {{customer.name}}! Let's book your appointment. Which branch do you prefer?",
            buttons: [
              { id: "Main", title: "Main Branch", next_node_key: "set_main" },
              { id: "Downtown", title: "Downtown Clinic", next_node_key: "set_downtown" },
              { id: "Online", title: "Online / Video", next_node_key: "set_online" },
            ],
          }, 1, 0),
          n("set_main", "set_variable", { var_key: "branch", var_value: "Main", next_node_key: "ask_service" }, 2, 0),
          n("set_downtown", "set_variable", { var_key: "branch", var_value: "Downtown", next_node_key: "ask_service" }, 2, 1),
          n("set_online", "set_variable", { var_key: "branch", var_value: "Online", next_node_key: "ask_service" }, 2, 2),
          n("ask_service", "collect_input", { prompt_text: "Which service do you need at {{branch}}?", var_key: "service", validation_type: "none", max_length: 120, next_node_key: "ask_date" }, 3, 0),
          n("ask_date", "collect_input", { prompt_text: "Preferred date? (YYYY-MM-DD)", var_key: "date", validation_type: "date", next_node_key: "check_slots" }, 4, 0),
          n("check_slots", "business_action", {
            connection: "builtin", operation: "appointments.availability",
            inputs: { service: "{{service}}", branch: "{{branch}}", date: "{{date}}" },
            outputs: { avail_msg: "message", open_slots: "slots_text" },
            next_node_key: "ask_time", error_next: "waitlist_offer",
          }, 5, 0),
          n("ask_time", "collect_input", { prompt_text: "{{avail_msg}}", var_key: "time", validation_type: "none", max_length: 30, next_node_key: "confirm_step" }, 6, 0),
          n("confirm_step", "send_buttons", {
            text: "Confirm booking?\nService: {{service}}\nBranch: {{branch}}\nDate: {{date}} at {{time}}",
            buttons: [
              { id: "confirm", title: "Confirm Booking", next_node_key: "create_booking" },
              { id: "change", title: "Change Date", next_node_key: "ask_date" },
              { id: "agent", title: "Staff Help", next_node_key: "handoff" },
            ],
          }, 7, 0),
          n("create_booking", "business_action", {
            connection: "builtin", operation: "appointments.booking_create",
            inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", branch: "{{branch}}", date: "{{date}}", time: "{{time}}" },
            outputs: { booking_msg: "message", booking_ref: "reference" },
            next_node_key: "tag_booked", error_next: "handoff",
          }, 8, 0),
          n("tag_booked", "set_tag", { tag: "booked-customer", next_node_key: "send_confirm" }, 9, 0),
          n("send_confirm", "send_message", { text: "{{booking_msg}}\n\nSave *{{booking_ref}}* to reschedule or cancel anytime.", next_node_key: "end_node" }, 10, 0),
          n("waitlist_offer", "send_buttons", {
            text: "All slots on {{date}} at {{branch}} are currently full. Join the priority waitlist?",
            buttons: [
              { id: "wl", title: "Join Waitlist", next_node_key: "add_waitlist" },
              { id: "other", title: "Try Another Date", next_node_key: "ask_date" },
              { id: "agent", title: "Speak to Staff", next_node_key: "handoff" },
            ],
          }, 5, 2),
          n("add_waitlist", "business_action", {
            connection: "builtin", operation: "appointments.waitlist",
            inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", branch: "{{branch}}", date: "{{date}}" },
            outputs: { wl_msg: "message" },
            next_node_key: "send_wl", error_next: "handoff",
          }, 6, 2),
          n("send_wl", "send_message", { text: "{{wl_msg}}", next_node_key: "end_node" }, 7, 2),
          n("handoff", "handoff", { note: "Connecting you with our scheduling coordinator." }, 9, 2),
          n("end_node", "end", {}, 11, 0),
        ],
      }),
    },
    {
      key: "enterprise.appointments.02_availability",
      systemId: "appointments", category: "Appointments", industries: "Clinics, salons, consultants, garages",
      name: "02. Live Slot Availability Checker",
      description: "Reads live open appointment slots by service, branch, and date before letting the customer jump straight to booking or waitlist.",
      keywords: ["slots", "availability", "free slots"],
      op: "appointments.availability",
      prompts: [
        ["service", "Which service availability would you like to check?", "none"],
        ["branch", "Which branch (e.g. Main, Downtown)?", "none"],
        ["date", "Which date (YYYY-MM-DD)?", "date"],
      ],
      inputs: { service: "{{service}}", branch: "{{branch}}", date: "{{date}}" },
    },
    {
      key: "enterprise.appointments.03_confirmation",
      systemId: "appointments", category: "Appointments", industries: "Clinics, salons, consultants, garages",
      name: "03. Booking Confirmation & Verification",
      description: "Validates reference ID and transitions held bookings to confirmed status with customer confirmation summary.",
      keywords: ["confirm booking", "confirm appointment"],
      op: "appointments.booking_confirm",
      prompts: [["reference", "Enter your booking reference (e.g. APT-260101-XXXX):", "reference"]],
      inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" },
    },
    {
      key: "enterprise.appointments.04_reminder_engine",
      systemId: "appointments", category: "Appointments", industries: "Clinics, salons, consultants, garages",
      name: "04. Smart Reminder Engine (24h Window + Template Check)",
      description: "Checks Meta 24-hour customer service window; uses interactive confirm if open or approved reminder schedule outside 24h.",
      keywords: ["appointment reminder", "remind booking"],
      extraNodes: () => ({
        entry_node_key: "ask_ref",
        nodes: [
          n("ask_ref", "collect_input", { prompt_text: "Enter the appointment reference (APT-...) to schedule automated reminders:", var_key: "reference", validation_type: "reference", next_node_key: "window_check" }, 0, 0),
          n("window_check", "condition", {
            rules: [{ field: "customer.window_open", operator: "equals", value: "true" }],
            true_next: "schedule_now", false_next: "outside_window_note",
          }, 1, 0),
          n("outside_window_note", "send_message", { text: "Note: Customer is currently outside the 24h Meta chat window; reminder will dispatch via approved template.", next_node_key: "schedule_now" }, 2, 1),
          n("schedule_now", "business_action", {
            connection: "builtin", operation: "appointments.reminder_schedule",
            inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" },
            outputs: { result_msg: "message" },
            next_node_key: "done_msg", error_next: "handoff",
          }, 3, 0),
          n("done_msg", "send_message", { text: "{{result_msg}}", next_node_key: "end_node" }, 4, 0),
          n("handoff", "handoff", { note: "Could not locate booking for reminder scheduling." }, 3, 2),
          n("end_node", "end", {}, 5, 0),
        ],
      }),
    },
    {
      key: "enterprise.appointments.05_reschedule",
      systemId: "appointments", category: "Appointments", industries: "Clinics, salons, consultants, garages",
      name: "05. Appointment Rescheduling",
      description: "Checks new date slot availability before updating an existing booking reference.",
      keywords: ["reschedule", "change booking", "move appointment"],
      op: "appointments.reschedule",
      prompts: [
        ["reference", "Enter your Appointment Reference (APT-...):", "reference"],
        ["date", "Enter the new preferred date (YYYY-MM-DD):", "date"],
        ["time", "Preferred time (e.g. 11:00, 14:30, 16:00):", "none"],
      ],
      inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", date: "{{date}}", time: "{{time}}" },
    },
    {
      key: "enterprise.appointments.06_cancellation",
      systemId: "appointments", category: "Appointments", industries: "Clinics, salons, consultants, garages",
      name: "06. Cancellation & Slot Release",
      description: "Verifies ownership, cancels booking, releases slot cleanly, and flags waitlisted customers.",
      keywords: ["cancel booking", "cancel appointment"],
      op: "appointments.cancel",
      prompts: [["reference", "Enter your Appointment Reference (APT-...) to cancel:", "reference"]],
      inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" },
    },
    {
      key: "enterprise.appointments.07_waitlist",
      systemId: "appointments", category: "Appointments", industries: "Clinics, salons, consultants, garages",
      name: "07. Priority Waitlist Management",
      description: "Adds customers to preferred branch/date waitlist when slots are full.",
      keywords: ["waitlist", "join waitlist"],
      op: "appointments.waitlist",
      prompts: [
        ["service", "Which service do you need?", "none"],
        ["branch", "Preferred branch?", "none"],
        ["date", "Preferred date (YYYY-MM-DD):", "date"],
      ],
      inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", branch: "{{branch}}", date: "{{date}}" },
    },
    {
      key: "enterprise.appointments.08_staff_assignment",
      systemId: "appointments", category: "Appointments", industries: "Clinics, salons, consultants, garages",
      name: "08. Staff & Specialist Assignment",
      description: "Routes/assigns an active specialist to an existing booking by service & branch.",
      keywords: ["assign specialist", "assign doctor", "assign staff"],
      op: "appointments.staff_assign",
      prompts: [
        ["reference", "Appointment reference (APT-...):", "reference"],
        ["service", "Requested service or specialty:", "none"],
      ],
      inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", service: "{{service}}" },
    },
    {
      key: "enterprise.appointments.09_no_show_recovery",
      systemId: "appointments", category: "Appointments", industries: "Clinics, salons, consultants, garages",
      name: "09. No-Show Recovery & Rebooking",
      description: "Re-engages customers who missed an appointment and books a verified recovery slot.",
      keywords: ["missed appointment", "no show"],
      op: "appointments.no_show_rebook",
      prompts: [
        ["reference", "Enter your missed appointment reference (APT-...):", "reference"],
        ["date", "Which new date works best (YYYY-MM-DD)?", "date"],
        ["time", "Preferred time slot (e.g. 11:00, 14:30):", "none"],
      ],
      inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", reference: "{{reference}}", date: "{{date}}", time: "{{time}}" },
    },
    {
      key: "enterprise.appointments.10_post_followup",
      systemId: "appointments", category: "Appointments", industries: "Clinics, salons, consultants, garages",
      name: "10. Post-Appointment Feedback & Rebooking Offer",
      description: "Collects rating & aftercare notes, marks session completed, and offers next visit rebooking.",
      keywords: ["visit feedback", "appointment feedback"],
      op: "appointments.follow_up",
      prompts: [
        ["reference", "Appointment reference (optional or APT-...):", "none"],
        ["rating", "How was your visit from 1 to 5?", "number"],
        ["details", "Any comments or aftercare questions?", "none"],
      ],
      inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", rating: "{{rating}}", details: "{{details}}" },
    },
  ];

  for (const wf of appointmentDeepWorkflows) {
    if (wf.extraNodes) {
      const built = wf.extraNodes();
      flows.push({
        key: wf.key, systemId: wf.systemId, category: wf.category, industries: wf.industries,
        isFlagship: true, usesAi: false, name: wf.name, description: wf.description,
        trigger_type: "keyword",
        trigger_config: { template_key: wf.key, keywords: wf.keywords, match_mode: "contains", priority: 25 },
        entry_node_key: built.entry_node_key,
        nodes: built.nodes,
      });
    } else {
      const nodes = [n("start", "contact_lookup", { next_node_key: wf.prompts[0][0] }, 0, 0)];
      wf.prompts.forEach(([varKey, prompt, valType], i) => {
        nodes.push(n(varKey, "collect_input", {
          prompt_text: prompt, var_key: varKey, validation_type: valType, max_attempts: 3, max_length: 400,
          ...(valType === "number" ? { min: 1, max: 5, integer: true } : {}),
          next_node_key: wf.prompts[i + 1] ? wf.prompts[i + 1][0] : "action",
        }, i + 1, 0));
      });
      nodes.push(n("action", "business_action", {
        connection: "builtin", operation: wf.op, inputs: wf.inputs, outputs: { result_msg: "message" },
        next_node_key: "done", error_next: "handoff",
      }, wf.prompts.length + 1, 0));
      nodes.push(n("done", "send_message", { text: "{{result_msg}}", next_node_key: "end_node" }, wf.prompts.length + 2, 0));
      nodes.push(n("handoff", "handoff", { note: "Our scheduling team will help complete your request." }, wf.prompts.length + 2, 1));
      nodes.push(n("end_node", "end", {}, wf.prompts.length + 3, 0));
      flows.push({
        key: wf.key, systemId: wf.systemId, category: wf.category, industries: wf.industries,
        isFlagship: true, usesAi: false, name: wf.name, description: wf.description,
        trigger_type: "keyword",
        trigger_config: { template_key: wf.key, keywords: wf.keywords, match_mode: "contains", priority: 28 },
        entry_node_key: "start",
        nodes,
      });
    }
  }

  // ── SYSTEM 3–10: DEEP ENTERPRISE FLAGSHIP WORKFLOWS ─────────────────────────
  const remainingSystems = [
    {
      key: "enterprise.sales.pipeline",
      systemId: "sales", category: "Sales and leads", industries: "Agencies, real estate, SaaS, B2B",
      name: "Sales Qualification, Lead Scoring & Rep Assignment",
      description: "Captures inquiry, qualifies budget/timeline, branches high-budget VIP leads into demo booking & rep assignment, and writes directly to CRM Leads.",
      keywords: ["pricing", "quote", "demo", "sales", "buy plan"],
      entry: "start",
      nodes: [
        n("start", "contact_lookup", { next_node_key: "ask_service" }, 0, 0),
        n("ask_service", "collect_input", { prompt_text: "Welcome {{customer.name}}! Which product or solution are you looking for?", var_key: "service", validation_type: "none", max_length: 160, next_node_key: "ask_email" }, 1, 0),
        n("ask_email", "collect_input", { prompt_text: "Work email address for sending the proposal or demo link:", var_key: "email", validation_type: "email", contact_field: "email", next_node_key: "ask_budget" }, 2, 0),
        n("ask_budget", "collect_input", { prompt_text: "What is your estimated monthly/project budget (number in INR)?", var_key: "budget", validation_type: "number", min: 0, next_node_key: "capture_crm" }, 3, 0),
        n("capture_crm", "create_lead", { default_service: "{{service}}", notes: "Email: {{email}} | Budget: {{budget}}", next_node_key: "tier_switch" }, 4, 0),
        n("tier_switch", "switch", {
          variable: "budget",
          cases: [{ label: "Enterprise VIP (>= 50k)", operator: "greater_or_equal", value: "50000", next_node_key: "vip_tag" }],
          fallback_node_key: "standard_qualify",
        }, 5, 0),
        n("vip_tag", "set_tag", { tag: "vip-enterprise-lead", next_node_key: "vip_assign" }, 6, 0),
        n("vip_assign", "business_action", {
          connection: "builtin", operation: "sales.assign",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", branch: "Enterprise" },
          outputs: { assign_msg: "message" },
          next_node_key: "vip_msg", error_next: "handoff",
        }, 7, 0),
        n("vip_msg", "send_buttons", {
          text: "{{assign_msg}}\n\nWould you like to book a live demo or request a formal quote?",
          buttons: [
            { id: "demo", title: "Schedule Demo", next_node_key: "ask_demo_date" },
            { id: "quote", title: "Request Quote", next_node_key: "create_quote" },
          ],
        }, 8, 0),
        n("ask_demo_date", "collect_input", { prompt_text: "Preferred date for live demo (YYYY-MM-DD):", var_key: "date", validation_type: "date", next_node_key: "book_demo" }, 9, 0),
        n("book_demo", "business_action", {
          connection: "builtin", operation: "sales.demo",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", date: "{{date}}", time: "11:00" },
          outputs: { demo_msg: "message" },
          next_node_key: "send_final", error_next: "handoff",
        }, 10, 0),
        n("create_quote", "business_action", {
          connection: "builtin", operation: "sales.quotation",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", budget: "{{budget}}", details: "WhatsApp Sales Quote Request" },
          outputs: { demo_msg: "message" },
          next_node_key: "send_final", error_next: "handoff",
        }, 9, 1),
        n("standard_qualify", "business_action", {
          connection: "builtin", operation: "sales.qualify",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "{{service}}", budget: "{{budget}}", date: "" },
          outputs: { demo_msg: "message" },
          next_node_key: "send_final", error_next: "handoff",
        }, 6, 2),
        n("send_final", "send_message", { text: "{{demo_msg}}", next_node_key: "end_node" }, 11, 0),
        n("handoff", "handoff", { note: "Connecting you directly with a senior account manager." }, 10, 2),
        n("end_node", "end", {}, 12, 0),
      ],
    },
    {
      key: "enterprise.finance.collections",
      systemId: "finance", category: "Invoices and payments", industries: "All businesses",
      name: "Verified Invoice, Payment Link, Receipt & Dispute Desk",
      description: "Zero financial hallucination: validates records via billing database, shares payment links, issues receipts ONLY after webhook confirmation, and escalates disputes.",
      keywords: ["invoice", "bill", "receipt", "payment", "due", "dispute"],
      entry: "start",
      nodes: [
        n("start", "contact_lookup", { next_node_key: "menu" }, 0, 0),
        n("menu", "send_buttons", {
          text: "Hello {{customer.name}}, choose a billing option:",
          buttons: [
            { id: "inv", title: "View Invoice / Link", next_node_key: "ask_ref" },
            { id: "rcpt", title: "Get Paid Receipt", next_node_key: "ask_receipt_ref" },
            { id: "disp", title: "Billing Dispute", next_node_key: "ask_dispute" },
          ],
        }, 1, 0),
        n("ask_ref", "collect_input", { prompt_text: "Enter your Invoice / Order Reference (or type ALL for latest):", var_key: "reference", validation_type: "none", max_length: 64, next_node_key: "fetch_inv" }, 2, 0),
        n("fetch_inv", "business_action", {
          connection: "builtin", operation: "finance.payment_link",
          inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" },
          outputs: { fin_msg: "message" },
          next_node_key: "send_fin", error_next: "handoff",
        }, 3, 0),
        n("ask_receipt_ref", "collect_input", { prompt_text: "Enter the paid Invoice Reference to download verified receipt details:", var_key: "reference", validation_type: "none", max_length: 64, next_node_key: "fetch_receipt" }, 2, 1),
        n("fetch_receipt", "business_action", {
          connection: "builtin", operation: "finance.receipt",
          inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" },
          outputs: { fin_msg: "message" },
          next_node_key: "send_fin", error_next: "handoff",
        }, 3, 1),
        n("ask_dispute", "collect_input", { prompt_text: "Enter the invoice reference and reason for dispute:", var_key: "details", validation_type: "none", max_length: 600, next_node_key: "log_dispute" }, 2, 2),
        n("log_dispute", "business_action", {
          connection: "builtin", operation: "finance.dispute",
          inputs: { customer_phone: "{{customer.phone}}", reference: "", details: "{{details}}" },
          outputs: { fin_msg: "message" },
          next_node_key: "dispute_handoff", error_next: "handoff",
        }, 3, 2),
        n("dispute_handoff", "send_message", { text: "{{fin_msg}}", next_node_key: "handoff" }, 4, 2),
        n("send_fin", "send_message", { text: "{{fin_msg}}", next_node_key: "end_node" }, 4, 0),
        n("handoff", "handoff", { note: "Transferring you to our Accounts team for verified ledger assistance." }, 5, 2),
        n("end_node", "end", {}, 5, 0),
      ],
    },
    {
      key: "enterprise.commerce.storefront",
      systemId: "commerce", category: "E-commerce", industries: "Retail, D2C, wholesalers",
      name: "WhatsApp Commerce: Catalog, Order, Tracking & Returns",
      description: "Search inventory stock/prices, place confirmed orders with automatic stock validation, track shipments, or handle cancellations/returns.",
      keywords: ["shop", "catalog", "order", "track order", "return"],
      entry: "start",
      nodes: [
        n("start", "contact_lookup", { next_node_key: "menu" }, 0, 0),
        n("menu", "send_list", {
          text: "Welcome to our Store! What would you like to do?",
          button_text: "Store Menu",
          options: [
            { id: "browse", title: "Search & Order", description: "Check stock & create order", next_node_key: "ask_product" },
            { id: "track", title: "Track Order", description: "Live order & shipping status", next_node_key: "ask_ord_ref" },
            { id: "return", title: "Cancel / Return", description: "Return or exchange request", next_node_key: "ask_ret_ref" },
          ],
        }, 1, 0),
        n("ask_product", "collect_input", { prompt_text: "Which product name or SKU are you looking for?", var_key: "product", validation_type: "none", max_length: 120, next_node_key: "search_prod" }, 2, 0),
        n("search_prod", "business_action", {
          connection: "builtin", operation: "commerce.product_search",
          inputs: { product: "{{product}}" },
          outputs: { prod_msg: "message" },
          next_node_key: "show_prod", error_next: "handoff",
        }, 3, 0),
        n("show_prod", "send_buttons", {
          text: "{{prod_msg}}\n\nWould you like to place an order?",
          buttons: [
            { id: "buy", title: "Place Order", next_node_key: "ask_qty" },
            { id: "again", title: "Search Another", next_node_key: "ask_product" },
          ],
        }, 4, 0),
        n("ask_qty", "collect_input", { prompt_text: "Quantity to order (1-100):", var_key: "quantity", validation_type: "number", min: 1, max: 100, integer: true, next_node_key: "create_ord" }, 5, 0),
        n("create_ord", "business_action", {
          connection: "builtin", operation: "commerce.checkout",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", product: "{{product}}", quantity: "{{quantity}}" },
          outputs: { done_msg: "message" },
          next_node_key: "send_done", error_next: "handoff",
        }, 6, 0),
        n("ask_ord_ref", "collect_input", { prompt_text: "Enter your Order Number (e.g. ORD-...):", var_key: "reference", validation_type: "reference", next_node_key: "track_ord" }, 2, 1),
        n("track_ord", "business_action", {
          connection: "builtin", operation: "commerce.order_status",
          inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" },
          outputs: { done_msg: "message" },
          next_node_key: "send_done", error_next: "handoff",
        }, 3, 1),
        n("ask_ret_ref", "collect_input", { prompt_text: "Enter Order Reference for return/exchange:", var_key: "reference", validation_type: "reference", next_node_key: "ask_ret_reason" }, 2, 2),
        n("ask_ret_reason", "collect_input", { prompt_text: "Reason for return/exchange:", var_key: "details", validation_type: "none", max_length: 400, next_node_key: "req_ret" }, 3, 2),
        n("req_ret", "business_action", {
          connection: "builtin", operation: "commerce.return",
          inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", details: "{{details}}" },
          outputs: { done_msg: "message" },
          next_node_key: "send_done", error_next: "handoff",
        }, 4, 2),
        n("send_done", "send_message", { text: "{{done_msg}}", next_node_key: "end_node" }, 7, 0),
        n("handoff", "handoff", { note: "Connecting you to our store fulfillment specialist." }, 6, 2),
        n("end_node", "end", {}, 8, 0),
      ],
    },
    {
      key: "enterprise.hospitality.concierge",
      systemId: "hospitality", category: "Restaurant and hospitality", industries: "Restaurants, hotels, cafes",
      name: "Hospitality Front Desk (Menu, Table/Room Booking & Concierge)",
      description: "Handles menu inquiries, restaurant table or hotel room reservations with guest counts/dietary notes, room service, and guest feedback.",
      keywords: ["menu", "table", "reserve table", "hotel room", "room service"],
      entry: "start",
      nodes: [
        n("start", "contact_lookup", { next_node_key: "menu" }, 0, 0),
        n("menu", "send_buttons", {
          text: "Welcome {{customer.name}}! How can Hospitality Concierge assist you?",
          buttons: [
            { id: "tbl", title: "Book Table / Room", next_node_key: "ask_date" },
            { id: "food", title: "View Menu / Packages", next_node_key: "show_menu" },
            { id: "svc", title: "Room Service / Help", next_node_key: "ask_svc" },
          ],
        }, 1, 0),
        n("show_menu", "business_action", {
          connection: "builtin", operation: "hospitality.menu",
          inputs: { service: "menu" },
          outputs: { hosp_msg: "message" },
          next_node_key: "send_hosp", error_next: "handoff",
        }, 2, 0),
        n("ask_date", "collect_input", { prompt_text: "Preferred reservation date (YYYY-MM-DD):", var_key: "date", validation_type: "date", next_node_key: "ask_guests" }, 2, 1),
        n("ask_guests", "collect_input", { prompt_text: "How many guests?", var_key: "guests", validation_type: "number", min: 1, max: 50, integer: true, next_node_key: "ask_notes" }, 3, 1),
        n("ask_notes", "collect_input", { prompt_text: "Time & dietary/seating preferences:", var_key: "details", validation_type: "none", max_length: 300, next_node_key: "book_tbl" }, 4, 1),
        n("book_tbl", "business_action", {
          connection: "builtin", operation: "hospitality.table",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", date: "{{date}}", time: "19:30", guests: "{{guests}}", details: "{{details}}" },
          outputs: { hosp_msg: "message" },
          next_node_key: "send_hosp", error_next: "handoff",
        }, 5, 1),
        n("ask_svc", "collect_input", { prompt_text: "Enter your Room/Table number and request:", var_key: "details", validation_type: "none", max_length: 400, next_node_key: "create_svc" }, 2, 2),
        n("create_svc", "business_action", {
          connection: "builtin", operation: "hospitality.room_service",
          inputs: { customer_phone: "{{customer.phone}}", reference: "Guest", details: "{{details}}" },
          outputs: { hosp_msg: "message" },
          next_node_key: "send_hosp", error_next: "handoff",
        }, 3, 2),
        n("send_hosp", "send_message", { text: "{{hosp_msg}}", next_node_key: "end_node" }, 6, 0),
        n("handoff", "handoff", { note: "Routing to hospitality desk manager." }, 5, 2),
        n("end_node", "end", {}, 7, 0),
      ],
    },
    {
      key: "enterprise.logistics.dispatch",
      systemId: "logistics", category: "Logistics and field service", industries: "Transport, courier, repair services",
      name: "Logistics Tracking, Pickup, Field Visit & Proof of Delivery",
      description: "Live shipment lookup, courier pickup & technician visit scheduling, POD logging, and delayed delivery escalations.",
      keywords: ["track shipment", "delivery", "pickup", "technician", "courier"],
      entry: "start",
      nodes: [
        n("start", "contact_lookup", { next_node_key: "menu" }, 0, 0),
        n("menu", "send_buttons", {
          text: "Logistics & Field Coordination — select an option:",
          buttons: [
            { id: "trk", title: "Track Shipment", next_node_key: "ask_trk" },
            { id: "tech", title: "Pickup / Tech Visit", next_node_key: "ask_addr" },
            { id: "pod", title: "Confirm Delivery", next_node_key: "ask_pod" },
          ],
        }, 1, 0),
        n("ask_trk", "collect_input", { prompt_text: "Enter Shipment / Tracking / Order ID:", var_key: "reference", validation_type: "reference", next_node_key: "do_trk" }, 2, 0),
        n("do_trk", "business_action", {
          connection: "builtin", operation: "logistics.tracking",
          inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" },
          outputs: { log_msg: "message" },
          next_node_key: "send_log", error_next: "handoff",
        }, 3, 0),
        n("ask_addr", "collect_input", { prompt_text: "Full pickup or site address:", var_key: "address", validation_type: "none", max_length: 300, next_node_key: "ask_pdate" }, 2, 1),
        n("ask_pdate", "collect_input", { prompt_text: "Preferred visit date (YYYY-MM-DD):", var_key: "date", validation_type: "date", next_node_key: "do_tech" }, 3, 1),
        n("do_tech", "business_action", {
          connection: "builtin", operation: "logistics.technician",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", service: "Field Dispatch", address: "{{address}}", date: "{{date}}", details: "WhatsApp Dispatch" },
          outputs: { log_msg: "message" },
          next_node_key: "send_log", error_next: "handoff",
        }, 4, 1),
        n("ask_pod", "collect_input", { prompt_text: "Enter Order/Shipment ID to confirm Proof of Delivery:", var_key: "reference", validation_type: "reference", next_node_key: "do_pod" }, 2, 2),
        n("do_pod", "business_action", {
          connection: "builtin", operation: "logistics.delivery_confirm",
          inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}", details: "Customer confirmed via WhatsApp" },
          outputs: { log_msg: "message" },
          next_node_key: "send_log", error_next: "handoff",
        }, 3, 2),
        n("send_log", "send_message", { text: "{{log_msg}}", next_node_key: "end_node" }, 5, 0),
        n("handoff", "handoff", { note: "Transferring you to dispatch operations." }, 4, 2),
        n("end_node", "end", {}, 6, 0),
      ],
    },
    {
      key: "enterprise.hr.selfservice",
      systemId: "hr", category: "Employee self-service", industries: "SMEs, factories, enterprise teams",
      name: "Employee HR Self-Service (Leave, Balance, Payslip & Shifts)",
      description: "Phone-verified employee access for leave balances & payslip requests, plus leave/attendance/shift change manager approval workflows.",
      keywords: ["leave", "payslip", "hr help", "shift change", "attendance"],
      entry: "start",
      nodes: [
        n("start", "contact_lookup", { next_node_key: "menu" }, 0, 0),
        n("menu", "send_buttons", {
          text: "Employee Self-Service Portal ({{customer.name}}):",
          buttons: [
            { id: "leave", title: "Request Leave", next_node_key: "ask_date" },
            { id: "bal", title: "Leave Balance", next_node_key: "get_bal" },
            { id: "pay", title: "Request Payslip", next_node_key: "get_pay" },
          ],
        }, 1, 0),
        n("ask_date", "collect_input", { prompt_text: "Start date for leave request (YYYY-MM-DD):", var_key: "date", validation_type: "date", next_node_key: "ask_reason" }, 2, 0),
        n("ask_reason", "collect_input", { prompt_text: "Number of days & brief reason for your manager:", var_key: "details", validation_type: "none", max_length: 400, next_node_key: "submit_leave" }, 3, 0),
        n("submit_leave", "business_action", {
          connection: "builtin", operation: "hr.leave",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", date: "{{date}}", details: "{{details}}" },
          outputs: { hr_msg: "message" },
          next_node_key: "send_hr", error_next: "handoff",
        }, 4, 0),
        n("get_bal", "business_action", {
          connection: "builtin", operation: "hr.leave_balance",
          inputs: { customer_phone: "{{customer.phone}}", reference: "Current" },
          outputs: { hr_msg: "message" },
          next_node_key: "send_hr", error_next: "handoff",
        }, 2, 1),
        n("get_pay", "business_action", {
          connection: "builtin", operation: "hr.payslip",
          inputs: { customer_phone: "{{customer.phone}}", reference: "Latest" },
          outputs: { hr_msg: "message" },
          next_node_key: "send_hr", error_next: "handoff",
        }, 2, 2),
        n("send_hr", "send_message", { text: "{{hr_msg}}", next_node_key: "end_node" }, 5, 0),
        n("handoff", "handoff", { note: "Routing to HR Operations for identity verification." }, 4, 2),
        n("end_node", "end", {}, 6, 0),
      ],
    },
    {
      key: "enterprise.education.admissions",
      systemId: "education", category: "Education and admissions", industries: "Schools, colleges, coaching",
      name: "Admissions, Course Info, Counseling & Fee Statements",
      description: "Answers course/eligibility questions from KB, captures prospective student admissions leads, schedules counseling, and checks verified fee statements.",
      keywords: ["admission", "course", "fees", "counseling", "classes"],
      entry: "start",
      nodes: [
        n("start", "contact_lookup", { next_node_key: "menu" }, 0, 0),
        n("menu", "send_buttons", {
          text: "Admissions & Student Desk — how can we assist?",
          buttons: [
            { id: "course", title: "Courses & Admissions", next_node_key: "ask_course" },
            { id: "counsel", title: "Book Counseling", next_node_key: "ask_cdate" },
            { id: "fees", title: "Fee Statement", next_node_key: "ask_fref" },
          ],
        }, 1, 0),
        n("ask_course", "collect_input", { prompt_text: "Which course/program are you interested in?", var_key: "course", validation_type: "none", max_length: 140, next_node_key: "ask_email" }, 2, 0),
        n("ask_email", "collect_input", { prompt_text: "Student/parent email for prospectus:", var_key: "email", validation_type: "email", contact_field: "email", next_node_key: "do_adm" }, 3, 0),
        n("do_adm", "business_action", {
          connection: "builtin", operation: "education.admission",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", course: "{{course}}", email: "{{email}}" },
          outputs: { edu_msg: "message" },
          next_node_key: "send_edu", error_next: "handoff",
        }, 4, 0),
        n("ask_cdate", "collect_input", { prompt_text: "Preferred counseling date (YYYY-MM-DD):", var_key: "date", validation_type: "date", next_node_key: "do_counsel" }, 2, 1),
        n("do_counsel", "business_action", {
          connection: "builtin", operation: "education.counseling",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", course: "Admissions Counseling", date: "{{date}}", time: "11:00" },
          outputs: { edu_msg: "message" },
          next_node_key: "send_edu", error_next: "handoff",
        }, 3, 1),
        n("ask_fref", "collect_input", { prompt_text: "Enter student invoice/fee reference:", var_key: "reference", validation_type: "none", max_length: 64, next_node_key: "do_fees" }, 2, 2),
        n("do_fees", "business_action", {
          connection: "builtin", operation: "education.fees",
          inputs: { customer_phone: "{{customer.phone}}", reference: "{{reference}}" },
          outputs: { edu_msg: "message" },
          next_node_key: "send_edu", error_next: "handoff",
        }, 3, 2),
        n("send_edu", "send_message", { text: "{{edu_msg}}", next_node_key: "end_node" }, 5, 0),
        n("handoff", "handoff", { note: "Connecting you with an admissions counselor." }, 4, 2),
        n("end_node", "end", {}, 6, 0),
      ],
    },
    {
      key: "enterprise.operations.approvals",
      systemId: "operations", category: "Operations and approvals", industries: "ERP, procurement, service companies",
      name: "Internal Operations, Stock Check, Purchases & Executive Summary",
      description: "Controlled WhatsApp operations console for purchase/expense approvals, real-time stock checks, and daily system metrics reports.",
      keywords: ["purchase", "expense", "approval", "stock check", "ops report"],
      entry: "start",
      nodes: [
        n("start", "contact_lookup", { next_node_key: "menu" }, 0, 0),
        n("menu", "send_buttons", {
          text: "Operations & Approval Console:",
          buttons: [
            { id: "po", title: "Purchase / Expense", next_node_key: "ask_item" },
            { id: "stk", title: "Check Stock", next_node_key: "ask_sku" },
            { id: "rpt", title: "Daily Ops Report", next_node_key: "get_rpt" },
          ],
        }, 1, 0),
        n("ask_item", "collect_input", { prompt_text: "Item/vendor description for Purchase Request:", var_key: "product", validation_type: "none", max_length: 140, next_node_key: "ask_qty" }, 2, 0),
        n("ask_qty", "collect_input", { prompt_text: "Quantity:", var_key: "quantity", validation_type: "number", min: 1, integer: true, next_node_key: "ask_amt" }, 3, 0),
        n("ask_amt", "collect_input", { prompt_text: "Estimated total amount:", var_key: "budget", validation_type: "number", min: 0, next_node_key: "create_po" }, 4, 0),
        n("create_po", "business_action", {
          connection: "builtin", operation: "operations.purchase",
          inputs: { customer_phone: "{{customer.phone}}", customer_name: "{{customer.name}}", product: "{{product}}", quantity: "{{quantity}}", budget: "{{budget}}", details: "Submitted via WhatsApp Ops Console" },
          outputs: { ops_msg: "message" },
          next_node_key: "send_ops", error_next: "handoff",
        }, 5, 0),
        n("ask_sku", "collect_input", { prompt_text: "Enter product name or SKU to check stock:", var_key: "product", validation_type: "none", max_length: 100, next_node_key: "check_stk" }, 2, 1),
        n("check_stk", "business_action", {
          connection: "builtin", operation: "operations.stock",
          inputs: { product: "{{product}}", branch: "Main" },
          outputs: { ops_msg: "message" },
          next_node_key: "send_ops", error_next: "handoff",
        }, 3, 1),
        n("get_rpt", "business_action", {
          connection: "builtin", operation: "operations.report",
          inputs: { date: "", branch: "All Branches" },
          outputs: { ops_msg: "message" },
          next_node_key: "send_ops", error_next: "handoff",
        }, 2, 2),
        n("send_ops", "send_message", { text: "{{ops_msg}}", next_node_key: "end_node" }, 6, 0),
        n("handoff", "handoff", { note: "Routing approval request to operations manager." }, 5, 2),
        n("end_node", "end", {}, 7, 0),
      ],
    },
  ];

  for (const s of remainingSystems) {
    flows.push({
      key: s.key, systemId: s.systemId, category: s.category, industries: s.industries,
      isFlagship: true, usesAi: false, name: s.name, description: s.description,
      trigger_type: "keyword",
      trigger_config: { template_key: s.key, keywords: s.keywords, match_mode: "contains", priority: 20 },
      entry_node_key: s.entry,
      nodes: s.nodes,
    });
  }

  return flows;
}

const FLAGSHIP_TEMPLATES = buildFlagshipTemplates();

function applyConnectionMode(flow, mode = "builtin") {
  const clone = JSON.parse(JSON.stringify(flow));
  clone.trigger_config = {
    ...(clone.trigger_config || {}),
    template_key: clone.trigger_config?.template_key || clone.key,
  };
  clone.nodes = (clone.nodes || []).map((node) => {
    if (node.node_type === "business_action") {
      return { ...node, config: { ...node.config, connection: mode === "business" ? "business" : "builtin" } };
    }
    return node;
  });
  return clone;
}

function getHubCatalog() {
  const bySystem = SYSTEMS_META.map((sys) => {
    const deep = FLAGSHIP_TEMPLATES.filter((f) => f.systemId === sys.id);
    const individual = industryBlueprints
      .filter((b) => String(b.key || "").startsWith(`${sys.id}.`))
      .map((b) => ({
        ...b,
        systemId: sys.id,
        isFlagship: false,
        usesAi: false,
      }));
    return {
      ...sys,
      flagshipCount: deep.length,
      blueprintCount: individual.length,
      templates: [...deep, ...individual],
    };
  });
  return {
    systems: bySystem,
    totalTemplates: bySystem.reduce((sum, s) => sum + s.templates.length, 0),
  };
}

async function installHubTemplates({ db, tenantId, userId, systemId = null, templateKeys = [], connectionMode = "builtin", autoPublish = false }) {
  const store = require("./flowStore").createFlowStore(db);
  const catalog = getHubCatalog();
  let chosen = [];
  const hasExplicitKeys = Array.isArray(templateKeys) && templateKeys.length > 0;

  if (hasExplicitKeys) {
    const keySet = new Set(templateKeys.map((k) => String(k || "").trim()));
    for (const sys of catalog.systems) {
      for (const tpl of sys.templates) {
        if (keySet.has(tpl.key)) chosen.push(tpl);
      }
    }
  } else if (systemId) {
    const sys = catalog.systems.find((s) => s.id === systemId);
    if (!sys) throw Object.assign(new Error("Unknown automation system"), { status: 404 });
    // Install flagship deep workflows first + remaining individual sub-workflows for that system
    chosen = sys.templates;
  } else {
    // Install all flagship workflows across all 10 systems
    chosen = FLAGSHIP_TEMPLATES;
  }

  if (!chosen.length) {
    throw Object.assign(new Error("No matching templates selected"), { status: 400 });
  }

  const existing = await store.query(
    "SELECT id, name, trigger_config FROM wa_flows WHERE tenant_id=? ORDER BY id DESC LIMIT 500",
    [tenantId]
  ).catch(() => []);
  const keyToFlowId = new Map();
  for (const row of existing) {
    try {
      const tc = typeof row.trigger_config === "string" ? JSON.parse(row.trigger_config) : (row.trigger_config || {});
      if (tc.template_key) keyToFlowId.set(tc.template_key, row.id);
    } catch (_) {}
  }

  const installed = [];
  const skipped = [];

  // Pass 1: create drafts (skip already installed keys to avoid duplicate clutter on repeated pack installs)
  for (const rawTpl of chosen) {
    if (keyToFlowId.has(rawTpl.key) && !hasExplicitKeys) {
      skipped.push({ key: rawTpl.key, id: keyToFlowId.get(rawTpl.key), name: rawTpl.name });
      continue;
    }
    const prepared = applyConnectionMode(rawTpl, connectionMode);
    const saved = await store.save(tenantId, userId, prepared);
    keyToFlowId.set(rawTpl.key, saved.id);
    installed.push({ ...saved, key: rawTpl.key, usesAi: Boolean(rawTpl.usesAi) });
  }

  // Pass 2: resolve target_flow_key -> target_flow_id and publish when requested (skip AI auto-publish if AI key missing)
  const publishedIds = [];
  const publishNotes = [];
  for (const flow of installed) {
    let dirtyLinks = false;
    const nextNodes = (flow.nodes || []).map((node) => {
      if (node.node_type === "jump_to_flow" && node.config?.target_flow_key && keyToFlowId.has(node.config.target_flow_key)) {
        dirtyLinks = true;
        return { ...node, config: { ...node.config, target_flow_id: keyToFlowId.get(node.config.target_flow_key) } };
      }
      return node;
    });
    if (dirtyLinks) {
      await store.save(tenantId, userId, { ...flow, nodes: nextNodes }, flow.id);
    }
    if (autoPublish) {
      try {
        await store.publish(tenantId, userId, flow.id, "Installed from 10-System Enterprise Hub");
        await store.query("UPDATE wa_flows SET status='active',updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?", [tenantId, flow.id]);
        publishedIds.push(flow.id);
      } catch (err) {
        publishNotes.push({ id: flow.id, name: flow.name, reason: err.message });
      }
    }
  }

  require("./sharedFlowRuntime").invalidate(tenantId);
  return {
    success: true,
    installedCount: installed.length,
    skippedCount: skipped.length,
    publishedCount: publishedIds.length,
    installed: installed.map((f) => ({ id: f.id, key: f.key, name: f.name, status: publishedIds.includes(f.id) ? "active" : "draft" })),
    skipped,
    publishNotes,
  };
}

module.exports = {
  FLAGSHIP_TEMPLATES,
  applyConnectionMode,
  getHubCatalog,
  installHubTemplates,
};
