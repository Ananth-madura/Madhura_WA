"use strict";

const definitions = [
  ["free", "Free", 0, 1, 3, 1, 250, 1000, 0, 0],
  ["starter", "Starter", 2499, 1, 6, 1, 2500, 10000, 100, 300],
  ["growth", "Growth", 5999, 3, 15, 3, 25000, 50000, 300, 1500],
  ["business", "Business", 17499, 10, 40, 10, 100000, 200000, 1000, 5000],
  ["enterprise", "Enterprise", 49999, 50, 150, 50, 500000, 1000000, 2500, 15000],
];

const PLANS = Object.fromEntries(definitions.map(([id, name, price, branches, seats, senders, contacts, ceiling, messageGrant, aiGrant]) => {
  const features = [
    `${branches} included ${branches === 1 ? "branch" : "branches"}`,
    `${seats} staff seats`,
    `${senders} WhatsApp ${senders === 1 ? "number" : "numbers"}`,
    `${contacts.toLocaleString("en-IN")} contacts`,
    "Shared inbox, manual assignment and contact export",
    "Consent tracking and template pre-flight",
    "Message charges are separate from the subscription",
  ];
  if (["growth", "business", "enterprise"].includes(id)) features.push("Knowledge-base AI and branch routing");
  return [id, {
    id, name, badge: id === "growth" ? "Recommended" : "",
    price_inr: price, annual_price_inr: price * 10, billing_interval: "month", gst_inclusive: 0,
    max_branches: branches, max_seats: seats, max_senders: senders,
    max_contacts: contacts, max_monthly_messages: ceiling,
    message_grant_inr: messageGrant, ai_credit_grant: aiGrant,
    features, features_json: JSON.stringify(features),
    price: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price),
    billing: price === 0 ? "Free plan" : "/ 30 days, excluding GST",
    maxBranches: branches, maxSeats: seats, maxSenders: senders,
    maxContacts: contacts, maxMonthlyMessages: ceiling,
    aiReplies: price > 0, flows: true, senderPools: ["growth", "business", "enterprise"].includes(id),
  }];
}));

module.exports = { PLANS };
