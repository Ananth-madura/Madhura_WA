"use strict";

module.exports = [
  // 🏥 Hospital & Clinic
  {
    name: "Hospital: Appointment Booking & Consultation Confirmation",
    trigger_type: "appointment_booked",
    category: "support",
    message_text: "🏥 *Care Confirmation:* Hello {name}, your appointment with Dr. Sharma at {company} has been scheduled for *{appointment.date}*. Please arrive 10 minutes prior with any previous medical records.",
    delay_minutes: 0,
    is_active: 0,
    sequence_delay_seconds: 7,
    followup_message_text: "📍 Location: 4th Floor, Health Wing. Reply *CONFIRM* to verify or *RESCHEDULE* to select another slot.",
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_message",
        title: "Send Appointment Confirmation",
        params: { text: "🏥 Hello {name}, your consultation is confirmed for *{appointment.date}* with {company}." },
      },
      {
        id: "act_2",
        type: "ask_question",
        title: "Ask for Patient Confirmation",
        params: {
          question_text: "Reply *1* to Confirm or *2* to Reschedule:",
          options: ["1. Confirm", "2. Reschedule"],
          crm_field: "appointment_status",
          expected_type: "button",
        },
      },
    ]),
  },
  {
    name: "Hospital: Diagnostic Lab Report Ready Alert",
    trigger_type: "service_visit_scheduled",
    category: "support",
    message_text: "📋 *Lab Report Ready:* Dear {name}, your diagnostic test results from {company} are now ready. You can download your verified digital report securely.",
    delay_minutes: 0,
    is_active: 0,
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_document",
        title: "Send Medical Report PDF",
        params: { caption: "📄 Your verified laboratory report is attached. For medical queries, contact our clinic desk." },
      },
    ]),
  },

  // 🏡 Real Estate
  {
    name: "Real Estate: Property Enquiry Qualification & Site Visit",
    trigger_type: "new_lead",
    category: "sales",
    message_text: "🏡 *Prime Properties:* Hello {name}! Thank you for inquiring about our luxury residential projects. We have exclusive 2 & 3 BHK units available.",
    delay_minutes: 0,
    is_active: 0,
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_message",
        title: "Welcome & Brochure",
        params: { text: "Hello {name}, welcome to {company}. Here is our latest project overview and floor plan brochure." },
      },
      {
        id: "act_2",
        type: "ask_question",
        title: "Collect Budget & Preferred Unit",
        params: {
          question_text: "What unit configuration are you looking for?",
          options: ["2 BHK (₹75L - ₹95L)", "3 BHK (₹1.1Cr - ₹1.4Cr)", "Penthouse / Villa"],
          crm_field: "preferred_budget",
          expected_type: "button",
        },
      },
      {
        id: "act_3",
        type: "update_crm",
        title: "Mark Qualified Lead",
        params: { field: "service", value: "Real Estate Qualified" },
      },
      {
        id: "act_4",
        type: "assign_employee",
        title: "Assign Senior Property Consultant",
        params: { agent_name: "Senior Sales Desk" },
      },
    ]),
  },

  // 🎓 Education & Coaching
  {
    name: "Education: Admission Enquiry & Course Details",
    trigger_type: "new_lead",
    category: "onboarding",
    message_text: "🎓 *Academy Admissions:* Hello {name}! Thank you for your interest in our programs at {company}. Admissions for the upcoming academic session are now open.",
    delay_minutes: 0,
    is_active: 0,
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_message",
        title: "Course Syllabus Overview",
        params: { text: "Hi {name}! Welcome to {company}. Which stream or certification are you interested in?" },
      },
      {
        id: "act_2",
        type: "ask_question",
        title: "Select Course Track",
        params: {
          question_text: "Please choose your desired program:",
          options: ["Full Stack Dev", "Data Science & AI", "Cloud & DevOps"],
          crm_field: "service",
          expected_type: "button",
        },
      },
      {
        id: "act_3",
        type: "send_message",
        title: "Send Curriculum PDF & Fee Structure",
        params: { text: "Great choice! Our admissions counselor will schedule a 15-minute guidance session." },
      },
    ]),
  },

  // 🍽️ Restaurant & Hospitality
  {
    name: "Restaurant: Table Reservation & Instant Bill Receipt",
    trigger_type: "walkin_created",
    category: "billing",
    message_text: "🍽️ *Welcome to {company}:* Hello {name}, your table reservation is confirmed. We look forward to hosting you for an exceptional culinary experience!",
    delay_minutes: 0,
    is_active: 0,
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_bill",
        title: "Send Digital Bill PDF",
        params: { caption: "🧾 Thank you for dining with us! Here is your itemized digital bill." },
      },
      {
        id: "act_2",
        type: "send_payment_link",
        title: "Send UPI / Card Payment Link",
        params: { text: "💳 You can settle your bill directly using UPI or card here: {payment_link}" },
      },
    ]),
  },

  // 💻 SaaS & Cloud Software
  {
    name: "SaaS: Trial Onboarding & Feature Activation",
    trigger_type: "welcome_message",
    category: "onboarding",
    message_text: "🚀 *Welcome to {company}:* Hello {name}! Your workspace is active. Let's get you set up with your first automated campaign in under 3 minutes.",
    delay_minutes: 0,
    is_active: 0,
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_message",
        title: "Quick Start Guide",
        params: { text: "Hello {name}! 🎯 Step 1: Connect your WhatsApp number. Step 2: Upload your first contact list. Need live help?" },
      },
      {
        id: "act_2",
        type: "ask_question",
        title: "Book Onboarding Demo Call",
        params: {
          question_text: "Would you like our technical team to assist your initial setup?",
          options: ["Yes, book demo call", "I will self-explore"],
          crm_field: "onboarding_status",
          expected_type: "button",
        },
      },
    ]),
  },
  {
    name: "SaaS: Subscription Invoice & Auto-Reminder Sequence",
    trigger_type: "invoice_created",
    category: "billing",
    message_text: "🧾 *Subscription Renewal Notice:* Hello {name}, your monthly subscription invoice *{invoice_no}* for ₹{amount} is generated. Due date: *{due_date}*.",
    delay_minutes: 0,
    is_active: 0,
    schedule_json: JSON.stringify({
      reminder_type: "relative",
      delay_value: 1,
      delay_unit: "days",
      cancel_on_event: "invoice_paid",
      max_attempts: 2,
    }),
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_bill",
        title: "Send Invoice PDF",
        params: { caption: "🧾 Attached is your tax invoice. Download or pay online with one tap." },
      },
      {
        id: "act_2",
        type: "wait_delay",
        title: "Wait 1 Day for Settlement",
        params: { minutes: 1440 },
      },
      {
        id: "act_3",
        type: "send_payment_link",
        title: "Send Reminder If Still Unpaid",
        params: { text: "Hi {name}, gentle reminder that your subscription invoice is pending. Please renew to avoid service interruption: {payment_link}" },
      },
    ]),
  },

  // 🛠️ Service Business & Technician Dispatch
  {
    name: "Service: Technician Dispatch & Real-Time Tracking",
    trigger_type: "service_visit_scheduled",
    category: "support",
    message_text: "📅 *Service Technician Assigned:* Hi {name}, our technician has been dispatched for your *{service}* request on *{service_date}*.",
    delay_minutes: 0,
    is_active: 0,
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_message",
        title: "Technician Dispatch Alert",
        params: { text: "📅 Technician *{assigned_agent}* is assigned for *{service}* on *{service_date}*." },
      },
      {
        id: "act_2",
        type: "ask_question",
        title: "Confirm Home Presence",
        params: {
          question_text: "Will someone be available at the premises at the scheduled time?",
          options: ["Yes, available", "Please reschedule"],
          crm_field: "visit_confirmation",
          expected_type: "button",
        },
      },
    ]),
  },
  {
    name: "Service: Completion & 5-Star Feedback Collector",
    trigger_type: "ticket_closed",
    category: "support",
    message_text: "⭐ *Job Completed:* Hello {name}, your service request for *{service}* has been successfully marked completed. We hope everything was done to your satisfaction!",
    delay_minutes: 0,
    is_active: 0,
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "ask_question",
        title: "Collect Service Rating",
        params: {
          question_text: "How would you rate the technician's quality of work?",
          options: ["⭐⭐⭐⭐⭐ Excellent", "⭐⭐⭐⭐ Good", "Needs Improvement"],
          crm_field: "customer_rating",
          expected_type: "button",
          completion_message: "Thank you for your valuable feedback! We appreciate your business with {company}.",
        },
      },
    ]),
  },

  // 💳 General CRM Billing & Payment Starters
  {
    name: "Instant Payment Receipt Acknowledgement",
    trigger_type: "payment_received",
    category: "billing",
    message_text: "Dear {name}, thank you! We have received your payment of *{amount}* for invoice *{invoice_no}* on {date}. Your official receipt has been verified.",
    delay_minutes: 0,
    is_active: 0,
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_receipt",
        title: "Send Verified Payment Receipt",
        params: { text: "✅ *Payment Received:* ₹{amount} for Invoice #{invoice_no} on {date}. Thank you for trusting {company}!" },
      },
    ]),
  },
  {
    name: "Quotation & Proposal Delivery Alert",
    trigger_type: "quotation_created",
    category: "sales",
    message_text: "Hello {name}, your quotation *{quotation_no}* for *{service}* (Total: {amount}) has been generated. Let us know if you would like to proceed or schedule a technical call!",
    delay_minutes: 0,
    is_active: 0,
    actions_json: JSON.stringify([
      {
        id: "act_1",
        type: "send_bill",
        title: "Send Quotation PDF",
        params: { caption: "💼 Here is your official quotation proposal #{quotation_no}. Reply ACCEPT to proceed." },
      },
    ]),
  },
];
