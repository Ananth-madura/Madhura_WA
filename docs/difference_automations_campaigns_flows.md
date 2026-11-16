# 📊 Difference Between Automations, Bulk Campaigns & Chatbot Flows

This guide explains the distinct roles, triggers, audience targets, and real-world business use cases for **Automations**, **Bulk Campaigns**, and **Chatbot Flows** in your WhatsApp CRM.

---

## ⚡ Quick Comparison Matrix

| Feature | ⚡ Automations | 📢 Bulk Campaigns | 🔀 Chatbot Flows |
| :--- | :--- | :--- | :--- |
| **Primary Purpose** | **Event-Driven Auto-Actions** (Hands-off CRM background rules) | **Mass Outreach & Marketing** (Promos, announcements, updates) | **Interactive 24/7 Conversational Bot** (Customer-driven Q&A tree) |
| **Direction** | Outbound (Triggered by CRM database events) | Outbound (One-to-Many broadcast to lists) | Inbound & Interactive (Bi-directional conversation) |
| **Who Initiates?** | **The System / CRM Event** (Invoice created, date reached, new lead added) | **The Business / Marketer** (Admin launches broadcast to contact group) | **The Customer** (Types "Hi", taps a menu button, or sends an inquiry) |
| **Audience Scope** | **1-to-1 Individual** (Specific customer reaching an event milestone) | **1-to-Many Group** (600–800 targeted recipients per batch) | **1-to-1 Dynamic** (Anyone actively chatting with your number) |
| **Interaction Style** | Single notification or timed sequential drip | Broadcast blast with media, links, or catalog | Multi-step interactive branching (Options `1`, `2`, `3`, buttons, input forms) |
| **Pacing / Timing** | Immediate or scheduled delay (7s–15s safety pacing) | Paced broadcast queue (7s–35s human delay per message) | Instant interactive reply (< 1s response with typing simulation) |
| **Human Handoff** | Mutes bot if human takes over chat | Customer reply goes directly to live chat inbox | Built-in `handoff` node transfers to live agent and mutes bot |

---

## 🔍 Deep-Dive: Understanding Each Module

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        HOW ALL 3 WORK TOGETHER IN HARMONY                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   📢 1. BULK CAMPAIGN      ──▶  Sends Diwali Promo Offer to 600 Customers              │
│            │                                                                           │
│            ▼ (Customer replies "1" or "Interested")                                    │
│                                                                                        │
│   🔀 2. CHATBOT FLOW       ──▶  Takes over! Asks what service they need,               │
│            │                    shows price catalog, and captures lead                 │
│            ▼ (Lead converted & invoice generated in CRM)                              │
│                                                                                        │
│   ⚡ 3. AUTOMATION         ──▶  Sends invoice payment reminder 2 days before due date,  │
│                                 and sends AMC service renewal alert 6 months later     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. ⚡ Automations (Background Event Triggers)

#### 🎯 What is it?
Automations are **"Set-and-Forget" background rules**. You configure them once, and whenever a specific event happens in the CRM database (like a new invoice generated, a payment received, or a lead status change), the CRM automatically sends a personalized message to that specific customer.

#### 🛠️ When is it triggered?
- **Date & Time Milestones**: 2 days before invoice due date, on customer birthday, or 15 days before AMC contract expires.
- **CRM Database Events**: When an inquiry is marked as `"Follow-up Required"`, when a quotation is generated, or when a payment is marked as `"Paid"`.
- **Inactivity Triggers**: When a lead hasn't replied in 7 days, sends a polite check-in nudge.

#### 💡 Real-World Examples:
1. **Invoice Reminder**: *"Hi Vikram, reminder that Invoice #INV-2026-088 for ₹14,500 is due on 25 Aug."*
2. **Payment Receipt**: *"Dear Priya, we have received your payment of ₹5,000. Thank you!"*
3. **AMC Service Alert**: *"Hi Rahul, your solar inverter maintenance contract expires next week. Click here to renew."*

---

### 2. 📢 Bulk Campaigns (Mass Promotional Broadcasts)

#### 🎯 What is it?
Bulk Campaigns are **One-to-Many marketing broadcasts**. You select a contact group (e.g., *VIP Clients*, *Shop Walkins*, *Inactive Leads*), compose a dynamic message with media (photo/video/PDF catalog), and send it to **600–800 people safely** using anti-ban pacing.

#### 🛠️ When is it triggered?
- **Manual Launch**: The marketing manager clicks "Launch Campaign" now or schedules it for a specific date & time (e.g., Saturday at 10:00 AM).
- **Segmented Broadcasting**: Targeted only to specific contact tags or groups.

#### 💡 Real-World Examples:
1. **Festival Offers**: *"Diwali Special: 20% OFF on all AC Services this weekend only!"*
2. **Product Catalog Launch**: Sending a PDF catalog of new solar inverters to 500 business leads.
3. **Store Relocation Notice**: Informing all local walkin clients about a new shop address with Google Maps link.

---

### 3. 🔀 Chatbot Flows (Interactive Conversational State Machine)

#### 🎯 What is it?
Chatbot Flows are **Visual Decision Trees** that talk to customers 24/7. When a customer sends an inbound message on WhatsApp, the bot evaluates the message, displays interactive options (`1️⃣`, `2️⃣`, `3️⃣` or buttons), asks qualifying questions, collects input data, and routes them to the right solution or human agent.

#### 🛠️ When is it triggered?
- **Customer Inbound Message**: Customer types `"Hi"`, `"Menu"`, `"Price"`, `"Repair"`, or taps a quick-reply button.
- **Multi-Branch Navigation**: Customer replies with a number (`"1"`, `"2"`) or keyword, leading down specific flow branches.

#### 💡 Real-World Examples:
1. **24/7 Digital Receptionist**:
   - Customer: *"Hi"*
   - Bot: *"Welcome to Madhura Solutions! Reply: 1 for Services, 2 for Invoices, 3 for Support"*
   - Customer: *"1"*
   - Bot: *"Here is our solar catalog: [PDF]. What is your location?"*
   - Customer: *"Bangalore"*
   - Bot: *"Got it! A lead for Bangalore Solar setup has been created. An engineer will call you."*
2. **Live Agent Handoff**: When customer types `"agent"` or `"human"`, bot immediately steps aside and alerts the live support desk.

---

## 📋 Summary Table: Which One Should You Use?

| If you want to... | Use this Module |
| :--- | :--- |
| Send an automatic payment reminder when an invoice is 2 days away from due date | ⚡ **Automations** |
| Send a Diwali holiday promotion to 500 past shop customers | 📢 **Bulk Campaigns** |
| Greet customers when they message at 11:00 PM and answer common FAQs automatically | 🔀 **Chatbot Flows** |
| Send an automated "Thank you for visiting our shop" message right after adding a Walkin lead | ⚡ **Automations** |
| Broadcast a new price list PDF to all electrical contractors in your city | 📢 **Bulk Campaigns** |
| Ask the customer 3 qualification questions (Name, City, Required Service) and store it in CRM | 🔀 **Chatbot Flows** |
| Proactively notify a client when their Annual Maintenance Contract is expiring | ⚡ **Automations** |
| Allow customers to type "STOP" to unsubscribe or "MENU" to see available options | 🔀 **Chatbot Flows** |
