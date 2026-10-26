/**
 * reminderPresets.js
 *
 * Shared reminder categories, default copy and reply buttons. Used by the
 * in-chat reminder sheet so the composer and the Automations workspace speak
 * the same language.
 */

export const REMINDER_CATEGORIES = [
  {
    id: "appointment_reminder",
    key: "appointment",
    label: "Appointment",
    icon: "calendar",
    title: "Appointment reminder",
    text: "Hello {name}! This is a reminder about your appointment with us. Please confirm your availability:",
    options: [
      { id: "btn_confirm", label: "✅ Confirm", action: "confirm_appointment" },
      { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
      { id: "btn_cancel", label: "❌ Cancel", action: "cancel_appointment" },
    ],
  },
  {
    id: "payment_due",
    key: "payment",
    label: "Payment",
    icon: "card",
    title: "Payment reminder",
    text: "Hello {name}! A friendly reminder about your pending payment of ₹{amount}. Please choose an option below:",
    options: [
      { id: "btn_paid", label: "💳 Already paid", action: "confirm_payment" },
      { id: "btn_invoice", label: "📄 Send invoice", action: "send_invoice_copy" },
      { id: "btn_call_acc", label: "📞 Accounts", action: "request_callback" },
    ],
  },
  {
    id: "quotation_followup",
    key: "quotation",
    label: "Quotation",
    icon: "file",
    title: "Quotation follow-up",
    text: "Hello {name}! Just following up on the quotation we shared. Let us know how you would like to proceed:",
    options: [
      { id: "btn_approve_quote", label: "👍 Approve", action: "approve_quotation" },
      { id: "btn_modify_quote", label: "💬 Need changes", action: "request_callback" },
      { id: "btn_reject_quote", label: "❌ Not interested", action: "reject_quotation" },
    ],
  },
  {
    id: "amc_renewal",
    key: "amc",
    label: "AMC renewal",
    icon: "shield",
    title: "AMC renewal reminder",
    text: "Hello {name}! Your annual maintenance contract is due for renewal. Reply below and our team will help you renew:",
    options: [
      { id: "btn_renew_amc", label: "🛡️ Renew AMC", action: "renew_amc" },
      { id: "btn_call_amc", label: "📞 Speak to team", action: "request_callback" },
    ],
  },
  {
    id: "lead_followup",
    key: "followup",
    label: "Follow-up",
    icon: "message",
    title: "Follow-up reminder",
    text: "Hello {name}! Following up on our recent conversation. Are you still interested?",
    options: [
      { id: "btn_interested", label: "👍 Interested", action: "confirm_lead_interest" },
      { id: "btn_demo", label: "📅 Book demo", action: "reschedule_appointment" },
      { id: "btn_not_now", label: "❌ Not now", action: "cancel_appointment" },
    ],
  },
  {
    id: "custom_reminder",
    key: "custom",
    label: "Custom",
    icon: "bell",
    title: "Reminder",
    text: "",
    options: [],
  },
];

export function getReminderCategory(id) {
  return (
    REMINDER_CATEGORIES.find(
      (category) => category.key === id || category.id === id
    ) || REMINDER_CATEGORIES[0]
  );
}

export function defaultReminderOptions(id) {
  return getReminderCategory(id).options.map((option) => ({ ...option }));
}

export const REMINDER_VARIABLES = [
  { token: "{name}", label: "Name" },
  { token: "{invoice_no}", label: "Invoice" },
  { token: "{amount}", label: "Amount" },
  { token: "{date}", label: "Date" },
];

export const REPEAT_OPTIONS = [
  { id: "none", label: "Doesn't repeat" },
  { id: "daily", label: "Every day" },
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
];
