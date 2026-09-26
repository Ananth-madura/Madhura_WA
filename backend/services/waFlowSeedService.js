"use strict";

const db = require("../config/database");

/**
 * waFlowSeedService.js
 * Comprehensive Seed Service for WhatsApp Flow Bots, Production Automations, and Interactive Reminders.
 */

async function seedAll(forceUpdate = false) {
  try {
    console.log("🌱 [WA Flow & Automation Seed] Starting initialization...");

    // 1. Seed Flow Bots if empty or forceUpdate; migrate legacy all_inbound triggers to manual
    try {
      await db.promise().query(
        "UPDATE wa_flows SET trigger_type = 'manual' WHERE trigger_type IN ('all_inbound', 'universal', 'default', 'fallback', 'catch_all', 'no_keyword', 'first_inbound', 'ai_intent')"
      );
    } catch (err) {
      console.error("❌ [WA Flow Seed] Failed to migrate legacy flow trigger types to manual:", err.message);
    }

    const [existingFlows] = await db.promise().query("SELECT COUNT(*) as count FROM wa_flows");
    if (existingFlows[0].count === 0 || forceUpdate) {
      await seedFlowBots();
    } else {
      console.log(`ℹ️ [WA Flow Seed] ${existingFlows[0].count} flow(s) exist in DB. Flows are configured to run for given numbers via Send Flow Bot.`);
    }

    // 2. Seed & Activate Automations
    await seedAndActivateAutomations();

    // 3. Ensure Reminder Settings are Active
    await ensureReminderSettingsActive();

    console.log("✅ [WA Flow & Automation Seed] All flows, automations, and reminders are active and ready!");
    return { success: true };
  } catch (err) {
    console.error("❌ [WA Flow & Automation Seed] Error:", err.message);
    return { success: false, error: err.message };
  }
}

async function seedFlowBots() {
  const seedFlows = [
    {
      name: "Interactive Main Business & Services Menu",
      description: "Interactive WhatsApp menu: Services, Instant Appointment Booking, Working Hours, and Live Agent Transfer. Triggered for given numbers via Send Flow Bot.",
      trigger_type: "manual",
      trigger_config: { keywords: ["menu"] },
      entry_node_key: "start",
      nodes: [
        { node_key: "start", node_type: "start", config: { next_node_key: "main_menu" } },
        {
          node_key: "main_menu",
          node_type: "send_buttons",
          config: {
            text: "👋 Hello {name}! Welcome to Madhura Tech.\nHow can we help you today? Tap an option below 👇",
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
            text: "🛠️ *Our Core Solutions:*\n• Commercial HVAC & AC Maintenance\n• Comprehensive AMC Contracts\n• Electrical & Fire Safety Compliance\n\nWould you like our brochure or request an instant quote?",
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
            text: "📄 Here is our complete Service & AMC Catalog:\nhttps://madhuratech.com/catalog.pdf\n\nReply MENU anytime to return to the main menu.",
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
            prompt_text: "Which city/area is the service location in? (e.g. Bangalore, Chennai, Tiruppur)",
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
            text: "🎉 Appointment Registered!\n• *Date:* {booking_date}\n• *Location:* {booking_city}\n• *Service:* AMC & Inspection\n\nOur technician will arrive on schedule. Thank you for choosing Madhura Tech!",
            next_node_key: "end"
          }
        },
        {
          node_key: "hours_info",
          node_type: "send_message",
          config: {
            text: "🕒 *Working Hours & Contact:*\n• Monday to Saturday: 09:00 AM – 08:00 PM\n• Location: Madhura Tech Central Office\n• Emergency Hotline: +91 98765 43210\n\nReply MENU anytime to view the main menu.",
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
      trigger_config: { keywords: ["invoice", "bill", "payment", "due", "pay", "receipt", "account", "balance"] },
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
            text: "📄 *Invoice Details for {customer_name}:*\n• *Invoice #:* {invoice_no}\n• *Total Amount:* ₹{amount}\n• *Status:* {payment_status}\n• *Due Date:* {due_date}\n\nWould you like to pay online or download the PDF?",
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
            text: "💳 You can securely pay invoice *{invoice_no}* online via UPI, NetBanking or Cards:\nhttps://pay.madhuratech.in/{invoice_no}\n\nOnce paid, your payment receipt will be generated instantly!",
            next_node_key: "end"
          }
        },
        {
          node_key: "send_invoice_pdf",
          node_type: "send_message",
          config: {
            text: "📥 Here is your official invoice copy:\nhttps://madhuratech.com/invoices/{invoice_no}.pdf\n\nThank you for your business!",
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
      name: "Food & Products Flow Bot (Interactive Catalog & Orders)",
      description: "Official WhatsApp interactive catalog flow bot: Quick reply buttons -> Category List -> Product details -> Instant Ordering, Bulk Quote Inquiry to CRM, and Sales handoff.",
      trigger_type: "keyword",
      trigger_config: { keywords: ["food", "catalog", "order", "product", "products", "price", "buy"] },
      entry_node_key: "start",
      nodes: [
        { node_key: "start", node_type: "start", config: { next_node_key: "welcome_menu" } },
        {
          node_key: "welcome_menu",
          node_type: "send_buttons",
          config: {
            header_text: "Fresh Products Catalog 🍲",
            text: "Welcome to our Products & Catalog! 🍲\nWe have all items available for Retail & Wholesale.\n\nWhat would you like to explore?",
            footer_text: "Tap an option or reply with number",
            buttons: [
              { reply_id: "VIEW_MENU", title: "📦 View Categories", next_node_key: "category_list" },
              { reply_id: "GET_PRICE", title: "💰 Bulk Quotation", next_node_key: "ask_bulk_details" },
              { reply_id: "TALK_HUMAN", title: "👨‍💼 Talk to Sales", next_node_key: "sales_handoff" }
            ]
          }
        },
        {
          node_key: "category_list",
          node_type: "send_list",
          config: {
            text: "Select a category to view products 👇",
            button_text: "View Categories",
            title: "Categories",
            rows: [
              { id: "CAT_DRYFRUITS", reply_id: "CAT_DRYFRUITS", title: "Dry Fruits & Nuts", description: "Premium quality 1kg packs", next_node_key: "dryfruits_products" },
              { id: "CAT_PICKLE", reply_id: "CAT_PICKLE", title: "Pickles & Specialty Items", description: "Homemade 500g jars", next_node_key: "pickles_products" },
              { id: "CAT_GRAINS", reply_id: "CAT_GRAINS", title: "Rice & Grains", description: "Basmati, Millets & Premium Rice", next_node_key: "dryfruits_products" }
            ]
          }
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
          }
        },
        {
          node_key: "pickles_products",
          node_type: "send_buttons",
          config: {
            header_text: "🌶️ Specialty Items",
            text: "🌶️ *Homemade Specialties:*\n\n1. Traditional Mango Pickle (500g) - ₹180\n2. Lemon Pickle (500g) - ₹150\n3. Garlic Spicy Pickle (500g) - ₹210\n\nAuthentic recipe with zero preservatives.",
            buttons: [
              { reply_id: "ORDER_NOW", title: "🛒 Order Now", next_node_key: "ask_order_address" },
              { reply_id: "BACK_MENU", title: "🔙 Back to Menu", next_node_key: "welcome_menu" }
            ]
          }
        },
        {
          node_key: "ask_bulk_details",
          node_type: "collect_input",
          config: {
            prompt_text: "Great! Please reply with:\n1. Product Name\n2. Quantity you need (e.g. 25kg, 100kg)\n3. Your City\n\nOur sales team will send wholesale discounted price immediately.",
            var_key: "bulk_enquiry",
            next_node_key: "save_bulk_lead"
          }
        },
        {
          node_key: "save_bulk_lead",
          node_type: "create_lead",
          config: {
            default_service: "Wholesale Inquiry",
            notes: "Bulk Requirement: {{bulk_enquiry}}",
            next_node_key: "confirm_bulk"
          }
        },
        {
          node_key: "confirm_bulk",
          node_type: "send_buttons",
          config: {
            header_text: "Quotation Requested ✅",
            text: "Thank you! We received your bulk requirement:\n\n\"{{bulk_enquiry}}\"\n\nOur wholesale executive is preparing your best quote right now.",
            buttons: [
              { reply_id: "BACK_MENU", title: "🏠 Main Menu", next_node_key: "welcome_menu" },
              { reply_id: "TALK_HUMAN", title: "👨‍💼 Talk to Sales", next_node_key: "sales_handoff" }
            ]
          }
        },
        {
          node_key: "ask_order_address",
          node_type: "collect_input",
          config: {
            prompt_text: "Perfect! Please reply with your delivery address and items needed:\nExample: 2kg Almonds, 1kg Kaju - Tiruppur",
            var_key: "order_details",
            next_node_key: "save_order_lead"
          }
        },
        {
          node_key: "save_order_lead",
          node_type: "create_lead",
          config: {
            default_service: "Direct Product Order",
            notes: "Customer Order: {{order_details}}",
            next_node_key: "confirm_order"
          }
        },
        {
          node_key: "confirm_order",
          node_type: "send_buttons",
          config: {
            header_text: "Order Received 🎉",
            text: "Thank you for ordering! 📦\n\n*Order Details:*\n{{order_details}}\n\nOur team will confirm dispatch and invoice shortly.",
            buttons: [
              { reply_id: "BACK_MENU", title: "🏠 Main Menu", next_node_key: "welcome_menu" },
              { reply_id: "TALK_HUMAN", title: "👨‍💼 Talk to Sales", next_node_key: "sales_handoff" }
            ]
          }
        },
        {
          node_key: "sales_handoff",
          node_type: "handoff",
          config: { note: "Connecting you with our sales representative." }
        },
        { node_key: "end", node_type: "end", config: {} }
      ]
    },
    {
      name: "AMC Contract Expiry & Service Renewal Bot",
      description: "Checks active AMC contracts from CRM database and assists customers in scheduling regular service or renewing expiring contracts.",
      trigger_type: "keyword",
      trigger_config: { keywords: ["amc", "contract", "renewal", "maintenance"] },
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
      trigger_config: { keywords: ["quote", "estimate", "cost", "pricing", "rate"] },
      entry_node_key: "start",
      nodes: [
        { node_key: "start", node_type: "start", config: { next_node_key: "ask_name" } },
        {
          node_key: "ask_name",
          node_type: "collect_input",
          config: {
            prompt_text: "👋 Welcome to Madhura Tech! What is your full name or company name?",
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
         VALUES (?, ?, 'active', ?, ?, ?, 1)`,
        [f.name, f.description, f.trigger_type, JSON.stringify(f.trigger_config), f.entry_node_key]
      );
      flowId = resFlow.insertId;
    }

    // Insert / refresh nodes
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

  console.log(`✅ [WA Flow Seed] Successfully seeded ${seedFlows.length} interactive business flow bots with 'active' status!`);
}

async function seedAndActivateAutomations() {
  const allAutomations = [
    {
      name: "Auto Welcome New Leads",
      trigger_type: "new_lead",
      message_text: "Hi {name}! 👋 Thank you for your inquiry regarding {service}. Our team at Madhura Tech has received your request and will contact you shortly.",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "Instant Invoice WhatsApp Notice",
      trigger_type: "invoice_created",
      message_text: "Hello {name}, your invoice *{invoice_no}* for ₹{amount} has been generated. Due Date: {due_date}. You can view and pay your invoice online.",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "Payment Receipt Acknowledgement",
      trigger_type: "payment_received",
      message_text: "Dear {name}, thank you! We received your payment of ₹{amount} for invoice *{invoice_no}* on {date}. Your receipt has been logged.",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "New Client Welcome Onboarding",
      trigger_type: "welcome_message",
      message_text: "Welcome to Madhura Tech, {name}! 🎉 We are delighted to partner with {company}. Let us know anytime if you need assistance.",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "Payment Due 1-Day Reminder",
      trigger_type: "payment_due",
      message_text: "Hi {name}, friendly reminder that payment for invoice *{invoice_no}* (₹{amount}) is due tomorrow ({due_date}). Please reply if you need payment links.",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "Lead Follow-Up Nudge",
      trigger_type: "lead_followup",
      message_text: "Hi {name}, following up on your inquiry regarding {service}. Feel free to reply here if you have any questions or would like to schedule a visit!",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "Instant Quotation Proposal Notice",
      trigger_type: "quotation_created",
      message_text: "Hello {name}, your quotation *{quote_no}* for {service_name} (₹{amount}) has been generated. Please review your proposal and reply to approve!",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "AMC Contract Agreement Notice",
      trigger_type: "amc_created",
      message_text: "Dear {name}, your Annual Maintenance Contract *{contract_title}* has been successfully registered! Our engineering team will ensure continuous coverage.",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "Service Visit Scheduled Alert",
      trigger_type: "service_visit_scheduled",
      message_text: "Hi {name}, your service inspection has been scheduled for {visit_date}. Assigned Engineer: {engineer_name}. We look forward to serving you!",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "Ticket Closed Feedback Request",
      trigger_type: "ticket_closed",
      message_text: "Hello {name}, your service ticket *{ticket_id}* has been resolved. How was your experience with our team? Please reply 1-5 to rate our service.",
      delay_minutes: 0,
      is_active: 1
    },
    {
      name: "Walkin Shop Visit Welcome",
      trigger_type: "walkin_created",
      message_text: "Hello {name}! Thank you for visiting Madhura Tech today. We appreciate your interest in {service}. Feel free to message us anytime!",
      delay_minutes: 0,
      is_active: 1
    }
  ];

  for (const a of allAutomations) {
    const [existing] = await db.promise().query(
      "SELECT id FROM wa_automations WHERE trigger_type = ? OR name = ? LIMIT 1",
      [a.trigger_type, a.name]
    );
    if (existing.length > 0) {
      await db.promise().query(
        "UPDATE wa_automations SET message_text = ?, is_active = 1, updated_at = NOW() WHERE id = ?",
        [a.message_text, existing[0].id]
      );
    } else {
      await db.promise().query(
        "INSERT INTO wa_automations (name, trigger_type, message_text, delay_minutes, is_active) VALUES (?, ?, ?, ?, 1)",
        [a.name, a.trigger_type, a.message_text, a.delay_minutes]
      );
    }
  }

  // Ensure ALL automations in table are active
  await db.promise().query("UPDATE wa_automations SET is_active = 1 WHERE is_active = 0");
  console.log("✅ [WA Automation Seed] All 11 CRM automations activated!");
}

async function ensureReminderSettingsActive() {
  await db.promise().query(`
    UPDATE wa_reminder_settings SET
      appointment_reminders_enabled = 1,
      payment_due_reminders_enabled = 1,
      lead_followup_reminders_enabled = 1,
      amc_renewal_reminders_enabled = 1,
      confirmation_auto_update_crm = 1,
      notify_staff_on_response = 1
    WHERE id = 1
  `);
  console.log("✅ [WA Reminder Seed] Reminder settings enabled for appointments, payments, followups, and AMC renewals!");
}

module.exports = {
  seedAll,
  seedFlowBots,
  seedAndActivateAutomations,
  ensureReminderSettingsActive
};
