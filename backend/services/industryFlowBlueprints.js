"use strict";

const fields = {
  question: ["What would you like help with?", "none"],
  reference: ["Enter your booking, order or request reference. Do not share passwords or verification codes.", "reference"],
  details: ["Describe your request so we can process it.", "none"],
  service: ["Which service do you need?", "none"],
  branch: ["Which branch or location do you prefer?", "none"],
  date: ["Which date do you prefer? Use YYYY-MM-DD.", "date"],
  time: ["What time or time range do you prefer? Availability must be checked before confirmation.", "none"],
  email: ["What is your email address?", "email"],
  budget: ["What is your budget? Enter a number.", "number"],
  product: ["Which product, variant or stock code do you need?", "none"],
  quantity: ["How many do you need? Enter a whole number.", "number"],
  guests: ["How many guests? Enter a whole number.", "number"],
  address: ["What is the pickup or service address?", "none"],
  course: ["Which course are you interested in?", "none"],
  rating: ["How would you rate your experience from 1 to 5?", "number"],
};

const systems = [
  ["support", "Customer service", "All industries", [
    ["knowledge_search", "FAQ and knowledge search", ["question"]],
    ["ticket_create", "Create support ticket", ["details"]],
    ["ticket_status", "Check ticket status", ["reference"]],
    ["complaint_escalate", "Escalate complaint", ["reference", "details"]],
    ["feedback", "Collect support feedback", ["reference", "rating"]],
  ]],
  ["appointments", "Appointments", "Clinics, salons, consultants and garages", [
    ["booking_create", "New booking", ["service", "branch", "date", "time"]],
    ["availability", "Live availability", ["service", "branch", "date"]],
    ["booking_confirm", "Confirm held appointment", ["reference"]],
    ["reminder_schedule", "Schedule booking reminders", ["reference"]],
    ["reschedule", "Reschedule appointment", ["reference", "date", "time"]],
    ["cancel", "Cancel appointment", ["reference"]],
    ["waitlist", "Join appointment waitlist", ["service", "branch", "date"]],
    ["staff_assign", "Request staff assignment", ["reference", "service"]],
    ["no_show_rebook", "Rebook missed appointment", ["reference", "date", "time"]],
    ["follow_up", "Post-appointment feedback", ["reference", "rating", "details"]],
  ]],
  ["sales", "Sales and leads", "Agencies, real estate, SaaS and B2B", [
    ["lead_capture", "Capture sales inquiry", ["service", "email"]],
    ["qualify", "Qualify and score lead", ["service", "budget", "date"]],
    ["assign", "Assign sales representative", ["service", "branch"]],
    ["quotation", "Request quotation", ["service", "budget", "details"]],
    ["demo", "Schedule demo request", ["service", "date", "time"]],
  ]],
  ["finance", "Invoices and payments", "All businesses", [
    ["invoice", "Retrieve verified invoice", ["reference"]],
    ["payment_link", "Request payment link", ["reference"]],
    ["receipt", "Retrieve verified receipt", ["reference"]],
    ["reminder", "Schedule balance reminders", ["reference"]],
    ["dispute", "Open invoice dispute", ["reference", "details"]],
  ]],
  ["commerce", "E-commerce", "Retail, D2C and wholesalers", [
    ["product_search", "Search products and stock", ["product"]],
    ["checkout", "Create checkout request", ["product", "quantity"]],
    ["order_status", "Track order", ["reference"]],
    ["cancel", "Request order cancellation", ["reference", "details"]],
    ["return", "Request return or exchange", ["reference", "details"]],
  ]],
  ["hospitality", "Restaurant and hospitality", "Restaurants, hotels and cafes", [
    ["menu", "Menu and package inquiry", ["service"]],
    ["table", "Request table reservation", ["date", "time", "guests"]],
    ["room", "Request room reservation", ["date", "guests", "details"]],
    ["room_service", "Room service request", ["reference", "details"]],
    ["feedback", "Guest feedback", ["reference", "rating", "details"]],
  ]],
  ["logistics", "Logistics and field service", "Transport, courier and repair services", [
    ["tracking", "Track shipment", ["reference"]],
    ["pickup", "Request pickup", ["address", "date", "details"]],
    ["technician", "Request technician visit", ["service", "address", "date"]],
    ["delivery_issue", "Report delivery issue", ["reference", "details"]],
    ["delivery_confirm", "Submit delivery confirmation", ["reference", "details"]],
  ]],
  ["hr", "Employee self-service", "SMEs, factories and enterprise teams", [
    ["leave", "Submit leave request", ["date", "details"]],
    ["leave_balance", "Check leave balance", ["reference"]],
    ["payslip", "Request private payslip access", ["reference"]],
    ["attendance", "Request attendance correction", ["date", "details"]],
    ["shift", "Request shift change", ["date", "time", "details"]],
  ]],
  ["education", "Education and admissions", "Schools, colleges and coaching", [
    ["course", "Course and eligibility inquiry", ["course"]],
    ["admission", "Capture admission inquiry", ["course", "email"]],
    ["counseling", "Request counseling", ["course", "date", "time"]],
    ["fees", "Request fee statement", ["reference"]],
    ["schedule", "Request class schedule", ["reference", "course"]],
  ]],
  ["operations", "Operations and approvals", "ERP, procurement and service companies", [
    ["purchase", "Submit purchase request", ["product", "quantity", "details"]],
    ["approval", "Review approval request", ["reference", "details"]],
    ["stock", "Check stock availability", ["product", "branch"]],
    ["expense", "Submit expense claim", ["budget", "details"]],
    ["report", "Request operational summary", ["date", "branch"]],
  ]],
];

const node = (key, type, config, index) => ({ node_key: key, node_type: type, config, position_x: 160 + index * 220, position_y: 160 });

function blueprint(system, category, industries, [operation, name, answers]) {
  const operationKey = `${system}.${operation}`;
  const nodes = [node("start", "contact_lookup", { next_node_key: answers[0] }, 0)];
  answers.forEach((field, index) => {
    const [prompt, validation] = fields[field];
    const config = { prompt_text: prompt, var_key: field, validation_type: validation, max_attempts: 3, max_length: 500, next_node_key: answers[index + 1] || "confirm" };
    if (validation === "number") Object.assign(config, { min: field === "budget" ? 0 : 1, integer: field !== "budget", ...(field === "rating" ? { max: 5 } : {}) });
    nodes.push(node(field, "collect_input", config, index + 1));
  });
  nodes.push(node("confirm", "send_buttons", {
    text: `Review your request: ${name}\n${answers.map(field => `${field}: {{${field}}}`).join("\n")}\nContinue with this request?`,
    buttons: [{ id: "confirm", title: "Continue", next_node_key: "action" }, { id: "agent", title: "Speak to a person", next_node_key: "handoff" }, { id: "cancel", title: "Cancel", next_node_key: "cancelled" }],
  }, answers.length + 1));
  nodes.push(node("action", "business_action", {
    connection: "business", operation: operationKey,
    inputs: { customer_phone: "{{customer.phone}}", ...Object.fromEntries(answers.map(field => [field, `{{${field}}}`])) },
    outputs: { result_message: "message" }, next_node_key: "result", error_next: "handoff",
  }, answers.length + 2));
  nodes.push(node("result", "send_message", { text: "{{result_message}}", next_node_key: "end" }, answers.length + 3));
  nodes.push(node("end", "end", {}, answers.length + 4));
  nodes.push({ ...node("handoff", "handoff", { note: "A team member will review your request. If an action was interrupted, they will check its status before trying again." }, answers.length + 2), position_y: 420 });
  nodes.push({ ...node("cancelled", "send_message", { text: "Request cancelled before submission.", next_node_key: "end" }, answers.length + 1), position_y: 680 });
  return {
    key: operationKey, category, industries, name, trigger_type: "keyword", trigger_config: { keywords: [name.toLowerCase()] }, entry_node_key: "start",
    description: `${category}: ${name}. Collects validated details, asks for confirmation and calls your configured business connection. Configure ${operationKey} before publishing. The business system must check identity, permissions and source records; reminders require its scheduler.`,
    nodes,
  };
}

module.exports = systems.flatMap(([system, category, industries, workflows]) => workflows.map(workflow => blueprint(system, category, industries, workflow)));
