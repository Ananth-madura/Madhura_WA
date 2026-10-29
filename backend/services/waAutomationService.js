const db = require("../config/database");

/**
 * waAutomationService.js
 *
 * Automatic WhatsApp Trigger Engine
 * Automatically sends WhatsApp messages when CRM events occur
 * (new lead, invoice created, payment received, welcome message, etc.)
 */

function cleanPhoneNumber(phone) {
  if (!phone) return null;
  const str = String(phone).trim();
  if (str.includes("@g.us") || str.includes("@broadcast") || (str.replace(/\D/g, "").length >= 18 && str.replace(/\D/g, "").startsWith("120363"))) {
    return null;
  }
  let clean = str.replace(/\D/g, "");
  if (clean.length === 10) clean = "91" + clean;
  return clean.length >= 10 ? clean : null;
}

// Looks up a contact's real CRM record by phone so template/message
// placeholders can be filled with actual deep data across all modules
async function lookupCrmDataByPhone(phone, tenantId) {
  if (!Number.isSafeInteger(Number(tenantId)) || Number(tenantId) < 1) return {};
  const last10 = (phone || "").replace(/\D/g, "").slice(-10);
  const digitsOnly = (phone || "").replace(/\D/g, "");
  if (last10.length < 10) return {};

  const profile = {};

  const sources = [
    ["clients", "name", "company_name", "city", "address", "email", "phone"],
    ["telecalls", "customer_name", "company_name", "location_city", "address", "email", "mobile_number", "service", "assigned_to", "remarks"],
    ["walkins", "customer_name", "company_name", "location_city", "address", "email", "mobile_number", "purpose", "assigned_to"],
    ["fields", "customer_name", "company_name", "location_city", "address", "email", "mobile_number", "service", "assigned_to"],
    ["wa_contacts", "name", "company", "city", "address", "email", "phone", "service", "assigned_agent_name", "notes"],
  ];

  for (const [table, nameCol, companyCol, cityCol, addressCol, emailCol, phoneCol, serviceCol, agentCol, notesCol] of sources) {
    try {
      const [columns] = db.isSqlite
        ? await db.promise().query(`PRAGMA table_info(${table})`)
        : await db.promise().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [table]);
      const available = new Set(columns.map((c) => c.COLUMN_NAME || c.column_name || c.name));
      if (!available.has(phoneCol) || !available.has("tenant_id")) continue;
      const selectColumn = (preferred, alias, alternatives = []) => {
        const column = [preferred, ...alternatives].find((c) => c && available.has(c));
        return column ? `${column} AS ${alias}` : null;
      };
      const selectFields = [
        selectColumn(nameCol, "name"),
        selectColumn(companyCol, "company"),
        selectColumn(cityCol, "city", ["city", "location_city"]),
        selectColumn(addressCol, "address"),
        selectColumn(emailCol, "email"),
        selectColumn(serviceCol, "service", ["service", "service_name", "purpose"]),
        selectColumn(agentCol, "assigned_agent", ["assigned_agent_name", "staff_name"]),
        selectColumn(notesCol, "notes", ["notes", "remarks"]),
        `${phoneCol} AS phone`,
      ].filter(Boolean).join(", ");

      const [rows] = await db.promise().query(
        `SELECT ${selectFields} FROM ${table} WHERE tenant_id=? AND (${phoneCol} LIKE ? OR ${phoneCol} LIKE ?) LIMIT 1`,
        [tenantId, `%${last10}`, `%${digitsOnly}`]
      );
      if (rows && rows[0]) {
        Object.assign(profile, rows[0]);
        break;
      }
    } catch (_) {}
  }

  // Also query latest invoice & contract if client company or name exists
  const lookupName = profile.company || profile.name;
  if (lookupName) {
    try {
      const [invRows] = await db.promise().query(
        `SELECT *
         FROM clientinvoices 
         WHERE tenant_id = ? AND client_company = ?
         ORDER BY id DESC LIMIT 1`,
        [tenantId, lookupName]
      );
      if (invRows && invRows[0]) {
        profile.invoice_no = invRows[0].invoice_no || `INV-${invRows[0].id}`;
        profile.invoice_amount = invRows[0].total_amount ?? invRows[0].grand_total;
        profile.amount = profile.invoice_amount;
        profile.due_date = invRows[0].due_date || invRows[0].invoice_duedate;
        profile.invoice_status = invRows[0].status;
      }
    } catch (_) {}

    try {
      const [amcRows] = await db.promise().query(
        `SELECT *
         FROM contracts 
         WHERE tenant_id = ? AND client_company = ?
         ORDER BY id DESC LIMIT 1`,
        [tenantId, lookupName]
      );
      if (amcRows && amcRows[0]) {
        profile.contract_title = amcRows[0].contract_title;
        profile.amc_plan = amcRows[0].contract_title;
        profile.amc_expiry = amcRows[0].end_date;
      }
    } catch (_) {}
  }

  return profile;
}

// Resolves Spintax format {option1|option2|option3} or [option1|option2|option3]
// to generate dynamic message variations for each recipient so WhatsApp/Meta anti-spam
// hash filters never detect identical messages. Also injects non-rendering micro-jitter.
function resolveSpintax(text, injectMicroJitter = true) {
  if (!text || typeof text !== "string") return "";
  let result = text;
  let matches;
  let iterations = 0;

  // 1. Resolve square bracket spintax: [hii| heloo |welcom | yes we are | how it's | how that all ]
  const squareSpintaxRegex = /\[([^\[\]]+)\]/g;
  iterations = 0;
  while ((matches = result.match(squareSpintaxRegex)) && iterations < 10) {
    result = result.replace(squareSpintaxRegex, (match, choices) => {
      if (!choices.includes("|")) return match;
      const options = choices.split("|");
      return options[Math.floor(Math.random() * options.length)].trim();
    });
    iterations++;
  }

  // 2. Resolve curly bracket spintax: {Hi|Hello|Hey|Greetings|Dear customer}
  const curlySpintaxRegex = /\{([^{}]+)\}/g;
  iterations = 0;
  while ((matches = result.match(curlySpintaxRegex)) && iterations < 10) {
    result = result.replace(curlySpintaxRegex, (match, choices) => {
      // If choices look like a standard placeholder (no pipe), keep it
      if (!choices.includes("|")) return `{${choices}}`;
      const options = choices.split("|");
      return options[Math.floor(Math.random() * options.length)].trim();
    });
    iterations++;
  }

  // 3. Anti-Ban Invisible Micro-Jitter (Zero-Width Space & Non-Joiner Injection)
  if (injectMicroJitter && result.length > 0) {
    const zwChars = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
    const randomZw = zwChars[Math.floor(Math.random() * zwChars.length)];
    result = result + randomZw;
  }

  return result;
}

// Substitutes multi-dynamic {{placeholder}}, {placeholder}, and %placeholder% tokens in a message
function formatMessagePlaceholders(templateText, contactName, data = {}, options = {}) {
  let msg = templateText || "Hello {{name}}!";
  const rawName = contactName || data.name || data.customer_name || data.client_name || data.company_name || data.company || "Customer";
  const nameParts = (rawName || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  // Dynamic Date & Time in Indian Standard Time (Asia/Kolkata)
  const istTz = "Asia/Kolkata";
  const now = new Date();

  const dateOptions = { day: "2-digit", month: "short", year: "numeric", timeZone: istTz };
  const formattedDate = now.toLocaleDateString("en-IN", dateOptions);
  const formattedTime = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: istTz });
  const dayName = now.toLocaleDateString("en-IN", { weekday: "long", timeZone: istTz });

  // Hour in IST for smart greeting
  const istHourStr = now.toLocaleTimeString("en-IN", { hour: "numeric", hour12: false, timeZone: istTz });
  const parsedHour = parseInt(istHourStr, 10);
  const currentHour = Number.isFinite(parsedHour) ? parsedHour : now.getHours();
  let greetingTime = "Hello";
  if (currentHour < 12) greetingTime = "Good morning";
  else if (currentHour < 17) greetingTime = "Good afternoon";
  else greetingTime = "Good evening";

  // Tomorrow calculation in IST
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowFormatted = tomorrow.toLocaleDateString("en-IN", dateOptions);
  const tomorrowDayName = tomorrow.toLocaleDateString("en-IN", { weekday: "long", timeZone: istTz });

  // Yesterday calculation in IST
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayFormatted = yesterday.toLocaleDateString("en-IN", dateOptions);
  const yesterdayDayName = yesterday.toLocaleDateString("en-IN", { weekday: "long", timeZone: istTz });

  const dateTimeStr = `${formattedDate}, ${formattedTime}`;
  const tomorrowDateTimeStr = `${tomorrowFormatted}, ${formattedTime}`;

  const amountVal = data.amount ?? data.total_amount ?? data.invoice_amount ?? data.balance ?? "";
  const formattedAmount = amountVal !== "" ? (String(amountVal).startsWith("₹") ? String(amountVal) : `₹${amountVal}`) : "";

  const known = {
    // 👤 Contact Person & Customer
    name: rawName,
    full_name: rawName,
    customer_name: rawName,
    client_name: rawName,
    contact_name: rawName,
    first_name: firstName,
    firstname: firstName,
    last_name: lastName,
    lastname: lastName,
    "customer.name": rawName,
    "customer.first_name": firstName,
    "customer.phone": data.phone || data.mobile || "",
    "customer.email": data.email || data.email_id || "",
    "customer.city": data.city || data.location_city || "our city",
    "customer.company": data.company || data.company_name || data.business_name || "Madhura Tech",
    
    // 🏢 Business & Company
    company: data.company || data.company_name || data.business_name || "Madhura Tech",
    company_name: data.company || data.company_name || data.business_name || "Madhura Tech",
    business_name: data.company || data.company_name || data.business_name || "Madhura Tech",
    client_company: data.company || data.company_name || data.business_name || "Madhura Tech",
    brand_name: "Madhura Tech",
    sender_company: "Madhura Tech",
    my_company: "Madhura Tech",

    // 📞 Phone & Email
    phone: data.phone || data.mobile || data.mobile_number || "",
    mobile: data.phone || data.mobile || data.mobile_number || "",
    phone_number: data.phone || data.mobile || data.mobile_number || "",
    mobile_number: data.phone || data.mobile || data.mobile_number || "",
    contact_no: data.phone || data.mobile || data.mobile_number || "",
    email: data.email || data.email_id || "",
    email_id: data.email || data.email_id || "",
    email_address: data.email || data.email_id || "",

    // 📍 Location & Address
    address: data.address || data.street_address || data.city || data.location_city || "our office",
    street_address: data.address || data.street_address || "",
    full_address: data.address || data.street_address || data.city || "",
    city: data.city || data.location_city || "our city",
    location: data.location || data.address || data.city || "",
    location_city: data.city || data.location_city || "our city",
    state: data.state || "",
    pincode: data.pincode || data.zip || data.postal_code || "",
    pin_code: data.pincode || data.zip || data.postal_code || "",
    zip: data.pincode || data.zip || "",
    postal_code: data.pincode || data.zip || "",

    // 💼 Service & Offerings
    service: data.service || data.product || data.service_name || "AMC & Services",
    service_name: data.service || data.product || "AMC & Services",
    product: data.product || data.service || "Solutions",
    purpose: data.purpose || data.remarks || data.notes || "",
    notes: data.notes || data.remarks || "",
    remarks: data.notes || data.remarks || "",
    assigned_agent: data.assigned_agent || data.agent_name || data.assigned_to || data.technician || "Support Executive",
    agent_name: data.assigned_agent || data.agent_name || data.assigned_to || data.technician || "Support Executive",
    "agent.name": data.assigned_agent || data.agent_name || data.assigned_to || data.technician || "Support Executive",
    technician: data.technician || data.assigned_agent || data.agent_name || "Senior Technician",
    executive: data.assigned_agent || data.agent_name || "Support Executive",

    // 🧾 Invoicing & Payments
    invoice_no: data.invoice_no || data.invoice_number || data.bill_no || "",
    invoice_number: data.invoice_no || data.invoice_number || "",
    bill_no: data.invoice_no || data.invoice_number || data.bill_no || "",
    quotation_no: data.quotation_no || data.quotation_number || data.quote_no || "",
    quotation_number: data.quotation_no || data.quotation_number || "",
    amount: formattedAmount,
    total_amount: formattedAmount,
    invoice_amount: formattedAmount,
    balance: formattedAmount,
    due_amount: formattedAmount,
    due_date: data.due_date ? String(data.due_date).split("T")[0] : "",
    invoice_status: data.invoice_status || "Pending",
    contract_title: data.contract_title || data.amc_plan || "",
    amc_contract_no: data.amc_contract_no || data.contract_no || data.amc_plan || "",
    contract_no: data.amc_contract_no || data.contract_no || "",
    amc_plan: data.amc_plan || data.contract_title || "",
    amc_expiry: data.amc_expiry || "",
    service_date: data.service_date || tomorrowFormatted,

    // ⏰ Dynamic Time & Date (Today & Live)
    greeting_time: greetingTime,
    greeting: greetingTime,
    greetings: greetingTime,
    smart_greeting: greetingTime,
    time_greeting: greetingTime,
    time: formattedTime,
    current_time: formattedTime,
    live_time: formattedTime,
    now: formattedTime,
    date: formattedDate,
    current_date: formattedDate,
    "current.date": formattedDate,
    today: formattedDate,
    today_date: formattedDate,
    datetime: dateTimeStr,
    date_time: dateTimeStr,
    current_datetime: dateTimeStr,
    current_date_time: dateTimeStr,
    day: dayName,
    day_name: dayName,
    today_day: dayName,
    current_day: dayName,
    day_of_week: dayName,
    weekday: dayName,

    // 🌅 Tomorrow ("tommowe mean tomarrow date and day name and all ways")
    tomorrow: tomorrowFormatted,
    tomorrow_date: tomorrowFormatted,
    tomarrow: tomorrowFormatted,
    tomarrow_date: tomorrowFormatted,
    tommowe: tomorrowFormatted,
    tommowe_date: tomorrowFormatted,
    tommow: tomorrowFormatted,
    tommow_date: tomorrowFormatted,
    tomorow: tomorrowFormatted,
    tomorow_date: tomorrowFormatted,
    tommorow: tomorrowFormatted,
    tommorow_date: tomorrowFormatted,

    tomorrow_day: tomorrowDayName,
    tomorrow_day_name: tomorrowDayName,
    tomorrow_dayofweek: tomorrowDayName,
    tomorrow_weekday: tomorrowDayName,
    tomarrow_day: tomorrowDayName,
    tomarrow_day_name: tomorrowDayName,
    tommowe_day: tomorrowDayName,
    tommowe_day_name: tomorrowDayName,
    tommow_day: tomorrowDayName,
    tomorow_day: tomorrowDayName,
    tommorow_day: tomorrowDayName,

    tomorrow_datetime: tomorrowDateTimeStr,
    tomorrow_date_time: tomorrowDateTimeStr,
    tomorrow_time: formattedTime,

    // ⏪ Yesterday
    yesterday: yesterdayFormatted,
    yesterday_date: yesterdayFormatted,
    yesterday_day: yesterdayDayName,
    yesterday_day_name: yesterdayDayName,

    year: String(now.getFullYear()),
    month: now.toLocaleDateString("en-IN", { month: "long", timeZone: istTz }),
    short_month: now.toLocaleDateString("en-IN", { month: "short", timeZone: istTz }),
    start_time: data.start_time || "09:00 AM",
    end_time: data.end_time || "08:00 PM",

    // 💬 Conversation & State Variables
    "conversation.id": data.conversation_id || data.conversationId || data.run_id || "",
    "selected.option": data.selected_option || data.selectedOption || data.last_input || "",
    "last.message": data.last_message || data.last_input || data.input || "",
    selected_option: data.selected_option || data.selectedOption || "",
    last_input: data.last_input || data.input || "",

    // 🏷️ Custom Fields
    custom_1: data.custom_1 || "",
    custom_2: data.custom_2 || "",
    custom_3: data.custom_3 || "",
    custom_4: data.custom_4 || "",
    custom_5: data.custom_5 || "",
  };

  const dataLookup = {};
  for (const key of Object.keys(data)) {
    const kLow = key.toLowerCase();
    dataLookup[kLow] = data[key];
    dataLookup[kLow.replace(/[\s\-\.]+/g, "_")] = data[key];
    dataLookup[kLow.replace(/_/g, ".")] = data[key];
  }

  // 1. Resolve {{placeholder}}, {placeholder}, and %placeholder% tokens
  // Matches tokens with letters, numbers, underscores, dots, hyphens, or spaces.
  // Explicitly excludes '|' to preserve Spintax [choice1|choice2] or {choice1|choice2}.
  const tokenRegex = /(?:\{\{|\{|\%)\s*([^{}%|]+?)\s*(?:\}\}|\}|\%)/g;

  let resolved = msg.replace(tokenRegex, (match, rawToken) => {
    const rawTrimmed = rawToken.trim();
    const rawLower = rawTrimmed.toLowerCase();
    const normalizedKey = rawLower.replace(/[\s\-\.]+/g, "_");
    const dotNormalized = rawLower.replace(/[\s\-]+/g, ".").replace(/\.+/g, ".");
    const underscoreNormalized = rawLower.replace(/\./g, "_");

    // Explicit custom/event values take precedence over built-in defaults.
    // Monetary aliases retain their currency formatting below.
    const amountKeys = new Set(["amount", "total_amount", "invoice_amount", "balance", "due_amount"]);
    if (!amountKeys.has(normalizedKey)) {
      const deepValue = require("./waRuleConditions").fieldValue(data, rawTrimmed);
      if (deepValue != null && deepValue !== "") return String(deepValue);
      for (const key of [rawLower, normalizedKey, dotNormalized, underscoreNormalized]) {
        if (Object.prototype.hasOwnProperty.call(dataLookup, key) && dataLookup[key] != null && dataLookup[key] !== "") {
          return String(dataLookup[key]);
        }
      }
    }

    // Exact match in known
    if (Object.prototype.hasOwnProperty.call(known, rawLower) && known[rawLower] !== "") {
      return String(known[rawLower]);
    }
    if (Object.prototype.hasOwnProperty.call(known, normalizedKey) && known[normalizedKey] !== "") {
      return String(known[normalizedKey]);
    }
    if (Object.prototype.hasOwnProperty.call(known, dotNormalized) && known[dotNormalized] !== "") {
      return String(known[dotNormalized]);
    }
    if (Object.prototype.hasOwnProperty.call(known, underscoreNormalized) && known[underscoreNormalized] !== "") {
      return String(known[underscoreNormalized]);
    }

    // Direct lookup in dataLookup
    if (Object.prototype.hasOwnProperty.call(dataLookup, rawLower) && dataLookup[rawLower] != null && dataLookup[rawLower] !== "") {
      return String(dataLookup[rawLower]);
    }
    if (Object.prototype.hasOwnProperty.call(dataLookup, normalizedKey) && dataLookup[normalizedKey] != null && dataLookup[normalizedKey] !== "") {
      return String(dataLookup[normalizedKey]);
    }
    if (Object.prototype.hasOwnProperty.call(dataLookup, dotNormalized) && dataLookup[dotNormalized] != null && dataLookup[dotNormalized] !== "") {
      return String(dataLookup[dotNormalized]);
    }
    if (Object.prototype.hasOwnProperty.call(dataLookup, underscoreNormalized) && dataLookup[underscoreNormalized] != null && dataLookup[underscoreNormalized] !== "") {
      return String(dataLookup[underscoreNormalized]);
    }

    // Deep dot path in data (e.g. customer.name)
    if (rawTrimmed.includes(".")) {
      const parts = rawTrimmed.split(".");
      let val = data;
      for (const p of parts) {
        if (val && typeof val === "object" && Object.prototype.hasOwnProperty.call(val, p)) {
          val = val[p];
        } else {
          val = undefined;
          break;
        }
      }
      if (val != null && val !== "") return String(val);

      // Fallback: match last part of dot path (e.g., customer.name -> name)
      const lastPart = parts[parts.length - 1].toLowerCase().replace(/[\s\-]+/g, "_");
      if (Object.prototype.hasOwnProperty.call(known, lastPart) && known[lastPart] !== "") {
        return String(known[lastPart]);
      }
      if (Object.prototype.hasOwnProperty.call(dataLookup, lastPart) && dataLookup[lastPart] != null && dataLookup[lastPart] !== "") {
        return String(dataLookup[lastPart]);
      }
    }

    return match; // Unknown variable — leave as-is
  });

  // 2. Resolve Spintax dynamic text choices [Option 1|Option 2] and {Option 1|Option 2}
  return options.spintaxEnabled === false ? resolved : resolveSpintax(resolved, false);
}

function buildTemplateBodyComponent(templateBody, contactName, data = {}) {
  if (!templateBody) return null;
  const tokens = [...templateBody.matchAll(/(?:\{\{|\{|\%)\s*([^{}%|]+?)\s*(?:\}\}|\}|\%)/g)].map((m) => m[1].trim());
  if (!tokens.length) return null;
  return {
    type: "body",
    parameters: tokens.map((t) => ({ type: "text", text: formatMessagePlaceholders(`{{${t}}}`, contactName, data) })),
  };
}

/**
 * Short-lived claim table so one business event cannot fire the same automation
 * twice, no matter how many subsystems notice it.
 *
 * The window is deliberately short (10 min): long enough to absorb the fan-in
 * from the event bus + inbound handler + webhook for a single message, short
 * enough that a real second invoice or a genuine new enquiry later the same
 * morning is not swallowed.
 */
const AUTOMATION_DEDUPE_TTL_MS = 10 * 60 * 1000;
const AUTOMATION_DEDUPE_MAX = 5000;
const automationDedupeStore = new Map();

function claimAutomationDedupe(key) {
  const now = Date.now();
  const hit = automationDedupeStore.get(key);
  if (hit && hit > now) return false;
  if (automationDedupeStore.size >= AUTOMATION_DEDUPE_MAX) {
    // Drop expired entries first; only then evict the oldest.
    for (const [k, v] of automationDedupeStore) {
      if (v <= now) automationDedupeStore.delete(k);
    }
    while (automationDedupeStore.size >= AUTOMATION_DEDUPE_MAX) {
      const oldest = automationDedupeStore.keys().next().value;
      automationDedupeStore.delete(oldest);
    }
  }
  automationDedupeStore.set(key, now + AUTOMATION_DEDUPE_TTL_MS);
  return true;
}

/**
 * Trigger active WhatsApp automations for a CRM event
 * @param {string} triggerType - 'new_lead' | 'invoice_created' | 'payment_received' | 'welcome_message' | etc.
 * @param {object} eventInfo - { phone, contactName, data }
 * @param {object} [opts] - { dedupeKey } to override the automatic dedupe key
 */
async function triggerAutomation(triggerType, eventInfo = {}, opts = {}) {
  let tenantId = Number(opts.tenantId || eventInfo.tenantId);
  if (!Number.isSafeInteger(tenantId) || tenantId < 1) tenantId = await require("./waContactTenancy").tenantForSessionKey(opts.sessionKey || eventInfo.sessionKey);
  if (!tenantId) return { success: false, reason: "organization_required" };
  const { phone, contactName, data = {} } = eventInfo;
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) {
    console.log(`[WA Automation] Skipped '${triggerType}': invalid phone '${phone}'`);
    return { success: false, reason: "invalid_phone" };
  }

  // Structural backstop against repeat firing. Several subsystems legitimately
  // reach this function for one business event (the CRM event bus, the inbound
  // message handler, lead capture, the webhook), and any overlap used to send
  // the customer the same automation twice. Keyed on rule + contact + trigger
  // with a short TTL, so a genuinely new event still gets through.
  const eventId = eventInfo.eventId ?? data.event_id ?? data.payment_id ?? data.quotation_id ?? data.invoice_id ?? data.lead_id ?? data.reference_id ?? data.invoice_no ?? data.quotation_no ?? data.reference_no;
  const dedupeKey = `${tenantId}:${opts.dedupeKey || `${triggerType}:${cleanPhone}${eventId != null ? `:${eventId}` : ""}`}`;
  if (!claimAutomationDedupe(dedupeKey)) {
    console.log(`♻️ [WA Automation] Skipped duplicate '${triggerType}' for ${cleanPhone} (already fired recently).`);
    return { success: true, count: 0, reason: "duplicate_suppressed" };
  }

  try {
    // 1. Check if phone is opted out or blocked.
    // Opt-outs are recorded from several paths with different phone formats
    // ("9876543210" vs "919876543210"), so this MUST match on the last 10 digits
    // like the campaign engine does — an exact match let opted-out people keep
    // receiving automated messages.
    const [optOuts] = await db.promise().query(
      "SELECT id FROM wa_opt_outs WHERE tenant_id=? AND (phone = ? OR phone LIKE ?) LIMIT 1",
      [tenantId, cleanPhone, `%${cleanPhone.slice(-10)}`]
    );
    if (optOuts.length > 0) {
      console.log(`[WA Automation] Skipped '${triggerType}' for ${cleanPhone}: user opted out`);
      return { success: false, reason: "opted_out" };
    }

    // is_unsubscribed matters as much as is_blocked — the opt-out writers set
    // is_unsubscribed, so checking only is_blocked missed every unsubscribe.
    const [blocked] = await db.promise().query(
      "SELECT id FROM wa_contacts WHERE tenant_id=? AND (phone = ? OR phone LIKE ?) AND (is_blocked = 1 OR is_unsubscribed = 1) LIMIT 1",
      [tenantId, cleanPhone, `%${cleanPhone.slice(-10)}`]
    );
    if (blocked.length > 0) {
      console.log(`[WA Automation] Skipped '${triggerType}' for ${cleanPhone}: contact blocked or unsubscribed`);
      return { success: false, reason: "blocked" };
    }

    // 2. Fetch active rules matching this exact trigger type
    const [rules] = await db.promise().query(
      `SELECT a.*, t.name as template_name, t.body as template_body,
              ft.name as followup_template_name, ft.body as followup_template_body
       FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id AND t.tenant_id=a.tenant_id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id AND ft.tenant_id=a.tenant_id
       WHERE a.tenant_id=? AND a.is_active = 1 AND a.trigger_type = ?`,
      [tenantId, triggerType]
    );

    if (!rules.length) {
      // Nothing was sent, so release the claim: a rule created a moment later
      // must still be able to fire for this contact.
      automationDedupeStore.delete(dedupeKey);
      return { success: true, count: 0, reason: "no_active_rules" };
    }

    // Fill in anything the triggering event didn't already pass (city, email,
    // company...) from the contact's real CRM record — explicit event data
    // (e.g. invoice_no) always wins over the generic lookup.
    const crmData = await lookupCrmDataByPhone(cleanPhone, tenantId).catch(() => ({}));
    const mergedData = { ...crmData, ...data };
    const resolvedName = contactName || data.name || data.customer_name || crmData.name || null;

    console.log(`⚡ [WA Automation] Trigger '${triggerType}' matched ${rules.length} rule(s) for ${cleanPhone}`);

    let triggeredCount = 0;
    let unknownCount = 0;
    for (const rule of rules) {
      if(opts.senderId&&Number(rule.sender_id)!==Number(opts.senderId))continue;
      const ruleSessionKey = opts.sessionKey || eventInfo.sessionKey || rule.created_by || require("./whatsappService").defaultKey;
      const targetChatId = eventInfo.chatId || null;
      if (!require("./waRuleConditions").matchesConditions(rule.conditions, { ...mergedData, phone: cleanPhone, name: resolvedName })) continue;
      const rawText = rule.message_text || rule.template_body || "Hello {name}! Thank you for reaching out.";
      const messageText = formatMessagePlaceholders(rawText, resolvedName, mergedData);

      if (rule.delay_minutes > 0) {
        // Persist the intent FIRST so a restart can't lose it, and log it as
        // 'scheduled' rather than 'sent' — the old code claimed success before
        // the message had even been attempted.
        const [ins] = await db.promise().query(
          `INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status, scheduled_for, session_key, target_chat_id)
           VALUES (?, ?, ?, ?, 'scheduled', DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, ?)`,
          [
            rule.id,
            cleanPhone,
            resolvedName,
            JSON.stringify({ triggerType, scheduledDelay: rule.delay_minutes, messageText, ...mergedData }),
            rule.delay_minutes,
            ruleSessionKey,
            targetChatId,
          ]
        );
        const logId = ins.insertId;

        // Fast path: fire in-process so short delays stay punctual. The claim
        // below makes this safe against the sweeper picking up the same row.
        const delayMs = rule.delay_minutes * 60 * 1000;
        // Node timers overflow beyond ~24.8 days; the durable sweeper handles those.
        if (delayMs <= 2147483647) {
          const timer = setTimeout(() => {
            runDueAutomationsSweep().catch(() => {});
          }, delayMs);
          timer.unref?.();
        }
      } else {
        // Execute immediately
        const requestId=`event:${rule.id}:${dedupeKey}:${eventId == null ? Math.floor(Date.now()/AUTOMATION_DEDUPE_TTL_MS) : "record"}`;
        const result = await executeAutomationSend(rule, cleanPhone, resolvedName, messageText, mergedData, ruleSessionKey, targetChatId,{requestId});
        if (!result?.success) {
          if (result?.deliveryUnknown) unknownCount++;
          continue;
        }
      }
      triggeredCount++;
    }

    if (!triggeredCount && !unknownCount) automationDedupeStore.delete(dedupeKey);
    return { success: triggeredCount > 0, count: triggeredCount, triggeredCount, deliveryUnknown: unknownCount > 0, reason: triggeredCount ? undefined : unknownCount ? "delivery_unknown" : "no_rules_dispatched" };
  } catch (err) {
    automationDedupeStore.delete(dedupeKey);
    console.error(`❌ [WA Automation] Error handling '${triggerType}':`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Run one scheduled automation exactly once.
 * The row is claimed atomically, so the in-process timer and the restart
 * sweeper can both point at the same log row without double-sending.
 */
async function runScheduledAutomation(logId, rule, cleanPhone, contactName, messageText, data, context = {}) {
  const [claim] = await db.promise().query(
    "UPDATE wa_automation_logs SET status = 'sending', claimed_at = NOW() WHERE id = ? AND status = 'scheduled'",
    [logId]
  );
  if (!claim.affectedRows) return false; // already handled elsewhere

  try {
    const [current] = await db.promise().query("SELECT is_active FROM wa_automations WHERE tenant_id=? AND id=?", [rule.tenant_id,rule.id]);
    if (!current[0]?.is_active) throw Object.assign(new Error("Automation was paused or deleted before dispatch."), { skipped: true });
    if(!require("./waRuleConditions").matchesConditions(rule.conditions,{...data,phone:cleanPhone,name:contactName}))throw Object.assign(new Error("Event no longer matches the rule conditions"),{skipped:true});
    const phase = Number(context.execution_step || 1);
    if (phase === 2 && !(rule.followup_message_text || rule.followup_media_url || rule.followup_template_name)) {
      throw Object.assign(new Error("Follow-up content was removed before dispatch."), { skipped: true });
    }
    const dispatchRule = phase === 2 ? {
      ...rule, message_text: rule.followup_message_text, template_id: rule.followup_template_id, template_name: rule.followup_template_name,
      template_body: rule.followup_template_body, media_type: rule.followup_media_type,
      media_url: rule.followup_media_url, media_filename: rule.followup_media_filename,
      followup_message_text: null, followup_media_url: null, followup_template_name: null,
      followup_template_id: null, group_id: null, flow_id: null
    } : rule;
    const result = await executeAutomationSend(dispatchRule, cleanPhone, contactName, phase === 2 ? null : messageText, data,
      context.session_key, context.target_chat_id, { logId, phase });
    if (!result?.success) throw Object.assign(new Error(result?.error || "Automation send failed."), { deliveryUnknown: result?.deliveryUnknown });
    await db.promise().query("UPDATE wa_automation_logs SET status = 'sent', trigger_data = NULL WHERE id = ?", [logId]);
    return true;
  } catch (err) {
    await db.promise().query(
      "UPDATE wa_automation_logs SET status = ?, error = ?, trigger_data = NULL WHERE id = ?",
      [err.deliveryUnknown ? "unknown" : err.skipped ? "skipped" : "failed", String(err.message || err).slice(0, 500), logId]
    ).catch(() => {});
    return false;
  }
}

/**
 * Sweeper for delayed automations whose in-process timer never fired
 * (server restart / crash). Without this every delayed rule was lost silently.
 */
let lastSweepAt=null,lastSweepError=null;
async function runDueAutomationsSweep() {
  try {
    lastSweepAt=new Date().toISOString();lastSweepError=null;
    // Never resend a stale in-flight dispatch: its delivery outcome is uncertain.
    await db.promise().query("UPDATE wa_automation_logs SET status = 'unknown', error = 'Dispatch interrupted; verify provider delivery before retrying', trigger_data = NULL WHERE status = 'sending' AND (claimed_at IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE))");
    await db.promise().query("UPDATE wa_automation_logs SET status = 'skipped', error = 'Automation deleted before dispatch', trigger_data = NULL WHERE status = 'scheduled' AND automation_id NOT IN (SELECT id FROM wa_automations)");
    const [due] = await db.promise().query(
      `SELECT l.*, a.*, l.id AS log_id, a.id AS rule_id,
              t.name AS template_name, t.body AS template_body,
              ft.name AS followup_template_name, ft.body AS followup_template_body
       FROM wa_automation_logs l
       JOIN wa_automations a ON l.automation_id = a.id
       LEFT JOIN wa_templates t ON a.template_id = t.id AND t.tenant_id=a.tenant_id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id AND ft.tenant_id=a.tenant_id
       WHERE l.status = 'scheduled' AND l.scheduled_for IS NOT NULL AND l.scheduled_for <= NOW()

       ORDER BY l.scheduled_for ASC LIMIT 50`
    );
    if (!due.length) return 0;

    console.log(`⏰ [WA Automation] Recovering ${due.length} delayed automation(s) whose timer was lost`);
    let ran = 0;
    for (const row of due) {
      let payload = {};
      try {
        payload = typeof row.trigger_data === "string" ? JSON.parse(row.trigger_data) : (row.trigger_data || {});
      } catch (_) {payload=null;}
      if(!payload||typeof payload!=="object"||Array.isArray(payload)){
        await db.promise().query("UPDATE wa_automation_logs SET status='failed',error='Stored event data is invalid',trigger_data=NULL WHERE id=? AND status='scheduled'",[row.log_id]);continue;
      }

      const rule = { ...row, id: row.rule_id };
      const messageText = payload.messageText
        || formatMessagePlaceholders(rule.message_text || rule.template_body || "Hello {name}!", row.contact_name, payload);

      const ok = await runScheduledAutomation(row.log_id, rule, row.phone, row.contact_name, messageText, payload, row);
      if (ok) ran++;
    }
    return ran;
  } catch (err) {
    lastSweepError="Scheduled automation sweep failed";
    console.error("[WA Automation] Delayed-automation sweep error:", err.message);
    return 0;
  }
}

let sweepTimer = null;
function startAutomationScheduler(intervalMs = 60 * 1000) {
  if (sweepTimer) return;
  // One catch-up pass at boot, then every minute
  runDueAutomationsSweep().catch(() => {});
  sweepTimer = setInterval(() => runDueAutomationsSweep().catch(() => {}), intervalMs);
  if (sweepTimer.unref) sweepTimer.unref();
  console.log("✅ Delayed WhatsApp Automation scheduler started (restart-safe)");
}

/**
 * Welcome-menu buttons are stored as JSON text. Ids are operator-defined and
 * stable; they are what the flow/menu matchers key on, never the shown title.
 * Caps mirror Meta's: 3 buttons, 20-char titles.
 */
function parseWelcomeButtons(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((b) => b && (b.title || b.label))
      .slice(0, 3)
      .map((b, i) => ({
        id: String(b.id || b.reply_id || `welcome_opt_${i + 1}`).slice(0, 256),
        title: String(b.title || b.label).slice(0, 20),
      }));
  } catch (_) {
    return [];
  }
}

async function getWelcomeSettings(tenantId) {
  if(!Number.isSafeInteger(Number(tenantId))||Number(tenantId)<1)return {enabled:false};
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_automation_welcome WHERE tenant_id=?",[tenantId]);
    if (!rows.length) {
      return {
        enabled: false,
        welcome_type: "text",
        welcome_text: "Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?",
        welcome_buttons: [],
        welcome_footer: null,
        template_id: null,
        cooldown_hours: 24,
        working_hours_only: false,
        start_time: "09:00",
        end_time: "21:00",
      };
    }
    return {
      enabled: Boolean(rows[0].enabled),
      welcome_type: rows[0].welcome_type || "text",
      welcome_text: rows[0].welcome_text || "Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?",
      welcome_buttons: parseWelcomeButtons(rows[0].welcome_buttons),
      welcome_footer: rows[0].welcome_footer || null,
      template_id: rows[0].template_id || null,
      cooldown_hours: rows[0].cooldown_hours != null ? rows[0].cooldown_hours : 24,
      working_hours_only: !!rows[0].working_hours_only,
      start_time: rows[0].start_time || "09:00",
      end_time: rows[0].end_time || "21:00",
    };
  } catch (_) {
    return { enabled: false };
  }
}

async function updateWelcomeSettings(settings, tenantId) {
  if(!Number.isSafeInteger(Number(tenantId))||Number(tenantId)<1)throw Object.assign(new Error("Organization is required"),{status:403});
  if(!["text","buttons"].includes(settings.welcome_type)||typeof settings.welcome_text!=="string"||!settings.welcome_text.trim()||settings.welcome_text.length>4096||!Number.isInteger(Number(settings.cooldown_hours))||Number(settings.cooldown_hours)<0||Number(settings.cooldown_hours)>8760||![settings.start_time,settings.end_time].every(value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value)))throw Object.assign(new Error("Provide valid welcome text, hours and cooldown"),{status:400});
  const { enabled, welcome_type, welcome_text, welcome_buttons, welcome_footer, template_id, cooldown_hours, working_hours_only, start_time, end_time } = settings;
  const normalizedButtons = parseWelcomeButtons(welcome_buttons);
  if (welcome_type === "buttons" && !normalizedButtons.length) {
    throw new Error("Welcome type 'buttons' requires at least one button with a title.");
  }
  await db.promise().query(
    `INSERT INTO wa_automation_welcome (tenant_id, enabled, welcome_type, welcome_text, welcome_buttons, welcome_footer, template_id, cooldown_hours, working_hours_only, start_time, end_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       welcome_type = VALUES(welcome_type),
       welcome_text = VALUES(welcome_text),
       welcome_buttons = VALUES(welcome_buttons),
       welcome_footer = VALUES(welcome_footer),
       template_id = VALUES(template_id),
       cooldown_hours = VALUES(cooldown_hours),
       working_hours_only = VALUES(working_hours_only),
       start_time = VALUES(start_time),
       end_time = VALUES(end_time),
       updated_at = NOW()`,
    [
      tenantId, enabled ? 1 : 0,
      welcome_type || "text",
      welcome_text || "Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?",
      normalizedButtons.length ? JSON.stringify(normalizedButtons) : null,
      welcome_footer ? String(welcome_footer).slice(0, 60) : null,
      template_id || null,
      parseInt(cooldown_hours != null ? cooldown_hours : 24, 10),
      working_hours_only ? 1 : 0,
      start_time || "09:00",
      end_time || "21:00",
    ]
  );
  return getWelcomeSettings(tenantId);
}

async function maybeSendWelcomeReply(targetPhoneOrJid, contactName, sessionKey, options = {}) {
  if (!targetPhoneOrJid) return false;
  const rawTarget = String(targetPhoneOrJid).trim();
  if (rawTarget.includes("@g.us") || rawTarget.includes("@broadcast") || rawTarget.startsWith("status@")) {
    return false; // Skip groups, broadcast lists, and status updates
  }

  const cleanPhone = cleanPhoneNumber(rawTarget) || rawTarget.replace(/\D/g, "");
  if (!cleanPhone && !rawTarget.includes("@")) return false;

  // ── 🛡️ 1. Historic / Sync Replay Check ─────────────────────────────────────
  if (options.isHistoric) {
    return false;
  }

  // ── 🛡️ 2. Bulk Campaign Reply Isolation ────────────────────────────────────
  // If the contact is replying to a bulk marketing campaign, NEVER send a general welcome message
  if (options.isCampaignReply) {
    console.log(`🛡️ [WA Welcome] Suppressed welcome reply for ${cleanPhone}: contact is replying to a campaign.`);
    return false;
  }

  try {
    const [recentCampaign] = await db.promise().query(
      `SELECT id FROM wa_campaign_messages
       WHERE (phone = ? OR phone LIKE ?) AND status IN ('sent', 'delivered', 'read')
         AND sent_at >= NOW() - INTERVAL 48 HOUR
       LIMIT 1`,
      [cleanPhone, `%${cleanPhone.slice(-10)}`]
    );
    if (recentCampaign && recentCampaign.length > 0) {
      console.log(`🛡️ [WA Welcome] Suppressed welcome reply for ${cleanPhone}: contact received a campaign message in the last 48h.`);
      return false;
    }
  } catch (_) {}

  // ── 🛡️ 3. User-Initiated Conversation Guard ───────────────────────────────
  // A welcome message should ONLY be sent when the CUSTOMER initiates the conversation.
  // If the company sent an outbound message (quotation, invoice, reminder, manual chat)
  // in the last 24 hours, the customer is responding to us — NOT initiating contact.
  try {
    const [recentOutbound] = await db.promise().query(
      `SELECT id, created_at, message_type FROM wa_message_logs
       WHERE (phone LIKE ? OR phone LIKE ?) AND direction = 'outbound'
         AND created_at >= NOW() - INTERVAL 24 HOUR
       ORDER BY id DESC LIMIT 1`,
      [`%${cleanPhone.slice(-10)}`, `%${cleanPhone}`]
    );
    if (recentOutbound && recentOutbound.length > 0) {
      console.log(`🛡️ [WA Welcome] Suppressed welcome reply for ${cleanPhone}: company sent outbound message within last 24h (customer is replying, not initiating conversation).`);
      return false;
    }
  } catch (_) {}

  // ── 🛡️ 3b. Agent Takeover / Per-Contact Bot Switch ────────────────────────
  if (!(await require("./waBotGate").botMayReply(cleanPhone, "Welcome auto-reply", options))) {
    return false;
  }

  // ── 🛡️ 4. Active Flow Continuity Guard ─────────────────────────────────────
  // If the contact is currently engaged in an active conversational flow run,
  // let the flow engine handle their replies; do NOT interrupt with a welcome message.
  try {
    const [activeFlows] = await db.promise().query(
      `SELECT id, flow_id FROM wa_flow_runs
       WHERE phone LIKE ? AND status = 'active'
         AND updated_at >= NOW() - INTERVAL 60 MINUTE
       LIMIT 1`,
      [`%${cleanPhone.slice(-10)}`]
    );
    if (activeFlows && activeFlows.length > 0) {
      console.log(`🛡️ [WA Welcome] Suppressed welcome reply for ${cleanPhone}: customer is currently in active Flow #${activeFlows[0].flow_id}.`);
      return false;
    }
  } catch (_) {}

  const settings = await getWelcomeSettings(options.tenantId||await require("./waContactTenancy").tenantForSessionKey(sessionKey));
  if (!settings.enabled) return false; // Safe default: strictly requires user to enable it

  // ── 5. Check working hours if enabled ─────────────────────────────────────
  if (settings.working_hours_only && settings.start_time && settings.end_time) {
    try {
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, "0");
      const currentMinutes = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${currentHours}:${currentMinutes}`;
      if (currentTime < settings.start_time || currentTime > settings.end_time) {
        console.log(`⏰ [WA Welcome] Outside working hours (${currentTime} not in ${settings.start_time}-${settings.end_time}) for ${cleanPhone}`);
        return false;
      }
    } catch (_) {}
  }

  // ── 6. Check cooldown / deduplication: One-time welcome reply per contact ───
  const cooldownHours = parseInt(settings.cooldown_hours != null ? settings.cooldown_hours : 24, 10);
  try {
    const timeClause = cooldownHours > 0 ? "AND created_at >= NOW() - INTERVAL ? HOUR" : "";
    const autoTimeClause = cooldownHours > 0 ? "AND sent_at >= NOW() - INTERVAL ? HOUR" : "";
    const params = cooldownHours > 0
      ? [`%${cleanPhone.slice(-10)}`, `%${cleanPhone}`, cooldownHours]
      : [`%${cleanPhone.slice(-10)}`, `%${cleanPhone}`];

    const [recentWelcomeLogs] = await db.promise().query(
      `SELECT id FROM wa_message_logs
       WHERE (phone LIKE ? OR phone LIKE ?) AND direction = 'outbound'
         AND (message_type = 'welcome' OR message_text LIKE '%Welcome%' OR message_text LIKE '%Thank you for reaching out%')
         ${timeClause}
       LIMIT 1`,
      params
    );

    const [recentAutoLogs] = await db.promise().query(
      `SELECT id FROM wa_automation_logs
       WHERE (phone LIKE ? OR phone LIKE ?)
         ${autoTimeClause}
       LIMIT 1`,
      params
    );

    if (recentWelcomeLogs.length > 0 || recentAutoLogs.length > 0) {
      console.log(`⏳ [WA Welcome] Welcome already sent previously to ${cleanPhone} (cooldown: ${cooldownHours}h)`);
      return false;
    }
  } catch (e) {
    console.error("[WA Welcome] Cooldown check error:", e.message);
  }

  // ── 7. Resolve CRM Contact Info ───────────────────────────────────────────
  const welcomeTenantId = await require("./waContactTenancy").tenantForSessionKey(sessionKey);
  const crmData = await lookupCrmDataByPhone(cleanPhone, welcomeTenantId).catch(() => ({}));
  const resolvedName = contactName || crmData.name || crmData.customer_name || "Valued Customer";

  // ── 8. Format Welcome Text ────────────────────────────────────────────────
  const rawWelcome = settings.welcome_text || "Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?";
  const messageText = formatMessagePlaceholders(rawWelcome, resolvedName, crmData);

  const waLoadBalancer = require("./waLoadBalancer");
  try {
    let res;
    if (settings.welcome_type === "buttons" && settings.welcome_buttons?.length) {
      // Real tappable WhatsApp reply buttons. waLoadBalancer degrades to the
      // numbered text equivalent only when no Cloud API sender can deliver.
      res = await waLoadBalancer.sendInteractiveButtons({
        phone: cleanPhone,
        body: messageText,
        footer: settings.welcome_footer || null,
        buttons: settings.welcome_buttons,
        sessionKey,
      });
    } else if (settings.welcome_type === "template" && settings.template_id) {
      const [tmplRows] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ? LIMIT 1", [settings.template_id]);
      if (tmplRows.length > 0) {
        const bodyComp = buildTemplateBodyComponent(tmplRows[0].body, resolvedName, crmData);
        res = await waLoadBalancer.sendTemplateMessage(rawTarget, tmplRows[0].name, tmplRows[0].language || "en", bodyComp ? [bodyComp] : [], sessionKey);
      } else {
        res = await waLoadBalancer.sendTextMessage(rawTarget, messageText, sessionKey);
      }
    } else {
      res = await waLoadBalancer.sendTextMessage(rawTarget, messageText, sessionKey);
    }

    console.log(`👋 [WA Welcome] Sent Welcome Auto-Reply to ${rawTarget} via ${res?.engineUsed || "WA"}`);

    const sentMsgId = require("./waInteractive").deliveryMessageId(res) || "welcome_" + Date.now();
    if (settings.welcome_type === "buttons" && settings.welcome_buttons?.length) {
      const buttons = require("./waInteractive").normalizeButtons(settings.welcome_buttons);
      await require("./waFlowEngine").recordAndEmitBotMessage(cleanPhone, messageText, "welcome", {
        type: "buttons", text: messageText, footer: settings.welcome_footer || "", buttons, native: !!res.native,
      }, sessionKey, rawTarget.includes("@") ? rawTarget : null, { id: sentMsgId, status: "sent" }).catch(() => {});
    }

    // Log outbound welcome message in DB (or update message_type if already logged by session sender)
    const [existingLog] = await db.promise().query(
      "SELECT id FROM wa_message_logs WHERE wa_message_id = ? LIMIT 1",
      [sentMsgId]
    ).catch(() => [[]]);

    if (existingLog && existingLog.length > 0) {
      await db.promise().query(
        "UPDATE wa_message_logs SET message_type = 'welcome' WHERE id = ?",
        [existingLog[0].id]
      ).catch(() => {});
    } else {
      await db.promise().query(
        `INSERT INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
         VALUES (?, ?, 'outbound', 'welcome', ?, ?, 'delivered', NOW())`,
        [sessionKey || require("./whatsappService").defaultKey, cleanPhone, messageText, sentMsgId]
      ).catch(() => {});
    }

    // Broadcast live message update to CRM Live Chat
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        const livePayload = {
          phone: cleanPhone,
          chatId: rawTarget.includes("@") ? rawTarget : `${cleanPhone}@c.us`,
          message: {
            id: sentMsgId,
            from: "me",
            body: messageText,
            timestamp: Math.floor(Date.now() / 1000),
            isMe: true,
            type: "text",
          },
        };
        io.to(`user:${livePayload.sessionKey || sessionKey || require("./whatsappService").defaultKey}`).emit("wa_message_sent", livePayload);
      }
    } catch (_) {}

    return true;
  } catch (err) {
    console.error(`❌ [WA Welcome] Failed to send Welcome Auto-Reply to ${rawTarget}:`, err.message);
    return false;
  }
}

async function executeAutomationSend(rule, cleanPhone, contactName, messageText, data, sessionKey = null, targetChatId = null, execution = {}) {
  // Normalize flexible arguments if messageText is omitted and data object is passed in 4th position:
  let actualMessageText = messageText;
  let actualData = data;
  let actualSessionKey = sessionKey;
  let actualTargetChatId = targetChatId;

  if (typeof messageText === "object" && messageText !== null && (!data || typeof data === "string")) {
    actualTargetChatId = sessionKey;
    actualSessionKey = data;
    actualData = messageText;
    actualMessageText = null;
  }

  if (!actualData || typeof actualData !== "object") {
    actualData = {};
  }

  if (!actualMessageText || typeof actualMessageText !== "string") {
    const rawTemplate = rule.message_text || rule.template_body || "Hello {name}!";
    actualMessageText = formatMessagePlaceholders(rawTemplate, contactName, actualData);
  } else {
    actualMessageText = formatMessagePlaceholders(actualMessageText, contactName, actualData);
  }

  const waLoadBalancer = require("./waLoadBalancer");
  const waService = require("./whatsappService");
  const activeSessionKey = actualSessionKey || rule.created_by || waService.defaultKey;
  const sessionTenantId = rule.sender_id ? rule.tenant_id : await require("./waContactTenancy").tenantForSessionKey(activeSessionKey);
  if (!rule.tenant_id || Number(sessionTenantId) !== Number(rule.tenant_id)) throw new Error("Automation sender organization does not match its rule");

  let sentResult = null;
  let sendError = null;
  let deliveryUnknown = false;
  const warnings=[];
  const sendTarget = (actualTargetChatId && actualTargetChatId.includes("@lid")) ? actualTargetChatId : cleanPhone;
  const chatId = actualTargetChatId || `${cleanPhone}@c.us`;

  try {
    // ── STEP 1: Main Message Send (Template, Rich Media, or Text) ──────────────
    const [optedOut] = await db.promise().query(
      "SELECT id FROM wa_opt_outs WHERE tenant_id=? AND (phone = ? OR phone LIKE ?) LIMIT 1",
      [rule.tenant_id, cleanPhone, `%${cleanPhone.slice(-10)}`]
    );
    const [blocked] = await db.promise().query(
      "SELECT id FROM wa_contacts WHERE tenant_id=? AND (phone = ? OR phone LIKE ?) AND (is_blocked = 1 OR is_unsubscribed = 1) LIMIT 1",
      [rule.tenant_id, cleanPhone, `%${cleanPhone.slice(-10)}`]
    );
    if (optedOut.length || blocked.length) throw new Error("Contact opted out, unsubscribed, or is blocked.");
    if(rule.sender_id){
      sentResult=await require("./automationCloudDelivery").send(rule,cleanPhone,actualMessageText,{...actualData,name:contactName||actualData.name},execution);
    }else if (rule.template_name) {
      const bodyComponent = buildTemplateBodyComponent(rule.template_body, contactName, actualData);
      sentResult = await waLoadBalancer.sendTemplateMessage(sendTarget, rule.template_name, "en", bodyComponent ? [bodyComponent] : [], activeSessionKey);
    } else if (rule.media_type && rule.media_url) {
      sentResult = await waLoadBalancer.sendMediaMessage(sendTarget, rule.media_type, rule.media_url, actualMessageText || "", rule.media_filename || "", activeSessionKey);
    } else {
      sentResult = await waLoadBalancer.sendTextMessage(sendTarget, actualMessageText, activeSessionKey);
    }

    const confirmedId = require("./waInteractive").deliveryMessageId(sentResult);
    if (!confirmedId) throw Object.assign(new Error("Provider acceptance could not be confirmed."), { deliveryUnknown: true });

    // Count an automation once, independent of its follow-up.
    if (execution.phase !== 2) await db.promise().query(
      "UPDATE wa_automations SET run_count = run_count + 1 WHERE id = ?",
      [rule.id]
    );

    if (execution.logId) {
      await db.promise().query("UPDATE wa_automation_logs SET wa_message_id = ? WHERE id = ?", [confirmedId, execution.logId]);
    } else {
      await db.promise().query(
        "INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status, execution_step, session_key, wa_message_id) VALUES (?, ?, ?, NULL, 'sent', ?, ?, ?)",
        [rule.id, cleanPhone, contactName || null, execution.phase || 1, activeSessionKey, confirmedId]
      );
    }

    // Also record in wa_message_logs for CRM conversation history & UI display
    const msgId = confirmedId;
    await db.promise().query(
      `INSERT INTO wa_message_logs (tenant_id,sender_id,conversation_id,session_key,phone,direction,message_type,message_text,wa_message_id,status,created_at)
       VALUES (?,?,?,?,?,'outbound',?,?,?,'sent',NOW())`,
      [rule.tenant_id,rule.sender_id||null,sentResult?.automationConversation?.id||null,activeSessionKey,cleanPhone,(rule.media_type&&rule.media_url)?"media":"text",actualMessageText,msgId]
    ).catch(() => {});

    // Also auto-add/update wa_contacts table if not present. Attributed to the
    // automation's organization (rule.tenant_id) with the session owner as the
    // fallback, so an automation never writes a contact into another tenant.
    if(rule.sender_id){
      await db.promise().query("UPDATE wa_contacts SET last_message_text=?,last_message_at=NOW(),last_contacted=NOW() WHERE tenant_id=? AND id=?",[actualMessageText,rule.tenant_id,sentResult.automationContactId]).catch(()=>{});
    }else await db.promise().query(
      `INSERT INTO wa_contacts (tenant_id, name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, last_contacted)
       VALUES (?, ?, ?, '91', 'Automation Trigger', 1, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), last_message_text=VALUES(last_message_text), last_message_at=NOW(), last_contacted=NOW()`,
      [
        await require("./waContactTenancy").tenantForContactWrite({
          tenantId: rule.tenant_id,
          sessionKey: activeSessionKey,
        }),
        contactName || "Customer",
        cleanPhone.slice(-10),
        actualMessageText,
      ]
    ).catch(() => {});

    // Emit socket event for real-time live chat updates
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        const livePayload = {
          phone: cleanPhone,
          chatId,
          sessionKey: activeSessionKey,
          message: {
            id: msgId,
            from: "me",
            body: actualMessageText,
            timestamp: Math.floor(Date.now() / 1000),
            isMe: true,
            hasMedia: !!(rule.media_type && rule.media_url),
            mediaType: rule.media_type || null,
          },
        };
        io.to(`user:${livePayload.sessionKey || sessionKey || require("./whatsappService").defaultKey}`).emit("wa_message_sent", livePayload);
        io.to(`user:${livePayload.sessionKey || sessionKey || require("./whatsappService").defaultKey}`).emit("wa_message", livePayload);
        if (chatId !== `${cleanPhone}@c.us`) {
          io.to(`user:${livePayload.sessionKey || require("./whatsappService").defaultKey}`).emit("wa_message_sent", { ...livePayload, chatId: `${cleanPhone}@c.us` });
          io.to(`user:${livePayload.sessionKey || require("./whatsappService").defaultKey}`).emit("wa_message", { ...livePayload, chatId: `${cleanPhone}@c.us` });
        }
      }
    } catch (_) {}

    console.log(`✅ [WA Automation] Step 1 sent for rule '${rule.name}' to ${cleanPhone} (session: ${activeSessionKey})`);

    // ── STEP 1.5: Auto Contact Group Enrollment (if configured) ─────────────
    if (rule.group_id && execution.phase !== 2) {
      try {
        // Scoped to the automation's organization, so an enrollment can only
        // touch a group that organization owns.
        const enrollTenantId = await require("./waContactTenancy").tenantForContactWrite({
          tenantId: rule.tenant_id,
          sessionKey: activeSessionKey,
        });
        await db.promise().query(
          `INSERT INTO wa_group_contacts (group_id, name, phone, country_code, notes, tenant_id)
           VALUES (?, ?, ?, '91', 'Added via Automation', ?)
           ON DUPLICATE KEY UPDATE name=VALUES(name)`,
          [rule.group_id, contactName || "Customer", cleanPhone.slice(-10), enrollTenantId]
        );
        console.log(`👥 [WA Automation] Contact ${cleanPhone} enrolled into Group ${rule.group_id}`);
      } catch (grpErr) {
        warnings.push("Contact group enrollment could not be completed.");
        console.warn(`[WA Automation] Group enrollment failed:`, grpErr.message);
      }
    }

    // ── STEP 1.6: Auto Trigger Chatbot Flow (if configured) ─────────────────
    if (rule.flow_id && execution.phase !== 2) {
      try {
        if(rule.sender_id){
          if(!sentResult?.automationConversation?.id)throw new Error("A shared conversation is required to start the linked flow");
          await require("./sharedFlowRuntime").start(rule.tenant_id,sentResult.automationConversation.id,rule.flow_id);
        }else{
        const [flowRows] = await db.promise().query("SELECT * FROM wa_flows WHERE tenant_id=? AND id=? AND status='active' LIMIT 1", [rule.tenant_id,rule.flow_id]);
        if (flowRows.length > 0) {
          const waFlowEngine = require("./waFlowEngine");
          await waFlowEngine.startFlowRun(flowRows[0], cleanPhone, activeSessionKey, "", actualTargetChatId, { ...actualData, automation_id: rule.id });
          console.log(`🤖 [WA Automation] Triggered Chatbot Flow "${flowRows[0].name}" for ${cleanPhone}`);
        }
        }
      } catch (flowErr) {
        warnings.push("The linked flow could not start. Check its publication, conversation window and takeover status.");
        console.warn(`[WA Automation] Chatbot flow trigger failed:`, flowErr.message);
      }
    }

    // ── STEP 1.7: Send Interactive Menu Options (if configured) ─────────────
    try {
      if(rule.sender_id){if(execution.phase!==2)await require("./automationCloudDelivery").sendMenu(rule,cleanPhone,actualData,execution);}
      else{
      const { sendMenu, getOptions } = require("./waMenuHandler");
      const options = await getOptions(rule.id);
      if (execution.phase !== 2 && options.length) await sendMenu(cleanPhone, rule.id, activeSessionKey);
      }
    } catch (menuErr) {
      warnings.push("The reply menu could not be sent.");
      console.error(`[WA Automation] Menu send failed for rule '${rule.name}':`, menuErr.message);
    }

    // ── STEP 2: Multi-Message Sequence with 7-second Gap (Anti-Ban delay) ──
    const hasFollowup = rule.followup_message_text || rule.followup_media_url || rule.followup_template_name || rule.followup_template_id;
    if (hasFollowup && execution.phase !== 2) {
      const delaySec = Math.max(0, Number(rule.sequence_delay_seconds ?? 7));
      if (!Number.isFinite(delaySec)) throw new Error("Invalid automation follow-up delay.");
      await db.promise().query(
        "INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status, scheduled_for, execution_step, session_key, target_chat_id) VALUES (?, ?, ?, ?, 'scheduled', DATE_ADD(NOW(), INTERVAL ? SECOND), 2, ?, ?)",
        [rule.id, cleanPhone, contactName || null, JSON.stringify(actualData), delaySec, activeSessionKey, actualTargetChatId]
      );
      if (delaySec * 1000 <= 2147483647) {
        const timer = setTimeout(() => runDueAutomationsSweep().catch(() => {}), delaySec * 1000);
        timer.unref?.();
      }
    }

  } catch (err) {
    sendError = err.message;
    deliveryUnknown = !!err.deliveryUnknown || !!sentResult;
    console.error(`❌ [WA Automation] Failed sending rule '${rule.name}' to ${cleanPhone}:`, sendError);

    if (!execution.logId) await db.promise().query(
      "INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status, error, session_key, execution_step) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)",
      [rule.id, cleanPhone, contactName || null, deliveryUnknown ? "unknown" : "failed", sendError, activeSessionKey, execution.phase || 1]
    ).catch(() => {});
  }
  if(warnings.length)await db.promise().query("UPDATE wa_automation_logs SET error=? WHERE automation_id=? AND wa_message_id=?",[warnings.join(" ").slice(0,500),rule.id,require("./waInteractive").deliveryMessageId(sentResult)]).catch(()=>{});
  return { success: !sendError, deliveryUnknown, warnings, error: sendError || undefined, result: sentResult };
}

module.exports = {
  triggerAutomation,
  // Exported for tests: the claim is module-private and triggerAutomation
  // releases it when no rule matches, so it cannot be observed from outside
  // without a live rule in the database.
  claimAutomationDedupe,
  AUTOMATION_DEDUPE_TTL_MS,
  cleanPhoneNumber,
  formatMessagePlaceholders,
  resolveSpintax,
  buildTemplateBodyComponent,
  lookupCrmDataByPhone,
  getWelcomeSettings,
  parseWelcomeButtons,
  updateWelcomeSettings,
  maybeSendWelcomeReply,
  executeAutomationSend,
  runScheduledAutomation,
  runDueAutomationsSweep,
  startAutomationScheduler,
  schedulerStatus:()=>({running:Boolean(sweepTimer),lastSweepAt,lastError:lastSweepError}),
};
