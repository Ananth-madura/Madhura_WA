# Madhura WhatsApp CRM: Enterprise Campaigns, Flowbot & Automation User Manual

This handbook explains how the entire Madhura WhatsApp platform works together end to end: how **Contacts & Groups**, **Templates**, **Meta Forms**, **Campaigns**, **Chatbot Flowbots**, **Business Automations**, **Compliance (Consent & DNC)**, **Approvals**, **Analytics**, and **Governance** connect into one operational workflow.

---

## 1. System Overview: How Everything Connects

Every module in `/whatsapp/*` shares one single source of truth (tenant-isolated CRM contacts, authorized Meta WABA senders, templates, conversations, leads, deals, and billing):

```text
Contacts (/whatsapp/contacts)
   |
   +--> Groups & Dynamic Segments (/whatsapp/groups)
           |
           +--> Consent & DNC Compliance Gate (/whatsapp/campaigns/consent)
                   |
                   +--> Campaign Composer (/whatsapp/campaigns/create)
                           |   - Picks Group or Segment
                           |   - Picks Approved Template (/whatsapp/templates)
                           |   - Optional Meta Form (/whatsapp/campaigns/flows)
                           |   - Optional Flowbot (/whatsapp/flows)
                           |   - Optional Automation (/whatsapp/automations)
                           |
                           +--> Approvals (/whatsapp/campaigns/approvals) [if required]
                                   |
                                   +--> Schedule / Dispatch (/whatsapp/campaigns/calendar)
                                           |
                                           v
                                  Meta Cloud API / Marketing Messages API
                                           |
                          +----------------+----------------+
                          |                                 |
                    Delivery Webhooks                 Customer Replies / Button Clicks
                 (Sent / Delivered / Read / Failed)         |
                          |                                 v
                          |                      Chatbot Flowbot Runtime (/whatsapp/flows)
                          |                      - Asks questions, validates inputs
                          |                      - Runs AI intent/KB/lead scoring
                          |                      - Creates Lead / Deal / Follow-up
                          |                      - Hands over to Human Agent (Team Inbox)
                          |                                 |
                          +----------------+----------------+
                                           |
                                           v
                               Business Automation Engine (/whatsapp/automations)
                               - Background waits, delays, conditions, approvals
                               - Assigns sales reps, creates deals & follow-ups
                               - Retries transient errors & logs Dead-Letter Queue
                                           |
                                           v
                               CRM Leads (/whatsapp/enquiries) & ROI Analytics (/whatsapp/campaigns/analytics)
```

### Key Distinction: Flowbot vs. Automation vs. Meta Forms

| Module | Route | What It Controls | When To Use It |
| :--- | :--- | :--- | :--- |
| **Campaigns** | `/whatsapp/campaigns` | Bulk, scheduled, A/B, and triggered outbound WhatsApp template broadcasts | Reaching hundreds or thousands of opted-in contacts with cost & limit checks |
| **Meta Forms (WhatsApp Flows)** | `/whatsapp/campaigns/flows` | Official in-app interactive WhatsApp JSON forms (v6.0+) with RSA-2048 encryption | Structured multi-field forms (lead gen, booking, surveys) opened natively inside WhatsApp |
| **Chatbot Flowbots** | `/whatsapp/flows` | Live customer conversation: asks questions, buttons, lists, AI replies, and human handover | Real-time interactive customer chats after a customer messages you or clicks a campaign button |
| **Business Automations** | `/whatsapp/automations` | Background business operations: waits, conditions, CRM updates, deals, approvals, webhooks | Multi-step background processes triggered by leads, orders, payments, replies, or schedules |

---

## 2. Step-by-Step User Manual by Page

### A. Contacts (`/whatsapp/contacts`) and Groups & Segments (`/whatsapp/groups`)
1. **Sync or import contacts** in `/whatsapp/contacts` or directly inside `/whatsapp/groups` using CSV/XLSX upload, bulk paste, or the CRM Contact Picker.
2. **Create Contact Groups** (static lists such as `VIP Solar Buyers` or `Q4 Exhibition Leads`) in `/whatsapp/groups`.
3. **Create Dynamic CRM Segments** in the second tab of `/whatsapp/groups` using nested `AND` / `OR` rules (for example: `tags contains vip` AND `country equals IN`).
4. **Audit Consent & DNC eligibility** right inside `/whatsapp/groups` before sending. Every group shows how many contacts are eligible, unconsented, or suppressed.
5. Click **Create campaign** on any group or segment to jump straight into `/whatsapp/campaigns/create` with that audience pre-selected.

### B. Consent & DNC Suppression (`/whatsapp/campaigns/consent`)
- **Why it matters**: Meta requires verifiable opt-in consent before sending marketing templates, and requires immediate opt-out handling.
- **Record Consent**: Log phone number, purpose (`marketing`, `utility`, `product_updates`, etc.), collection method (`website_form`, `checkout_form`, `whatsapp_inbound_optin`), source URL, and captured opt-in wording. Madhura generates an immutable `evidence_ref`.
- **Suppression (Do-Not-Contact)**: Add any phone at company, workspace, agency client, or legal scope.
- **Automatic STOP Protection**: If a customer replies `STOP`, `UNSUBSCRIBE`, `CANCEL`, or `OPT OUT` during a live campaign or Flowbot chat, Madhura immediately:
  1. Adds the contact to the suppression list.
  2. Cancels all unsent queued campaign jobs for that phone.
  3. Stops active marketing Flowbot sessions and linked automation runs.
  4. Blocks future CSV re-imports from accidentally re-enabling consent.

### C. WhatsApp Templates (`/whatsapp/templates`)
1. Create templates with header (text/image/video/document), body with placeholders (`{{1}}`, `{{2}}`), footer, and interactive buttons (Quick Reply, CTA URL, or Meta Form button).
2. Submit and sync approval status with Meta (`APPROVED`, `PENDING`, `REJECTED`, `PAUSED`).
3. **Policy guard**: Promotional content cannot be misclassified as `UTILITY` to bypass marketing rules.
4. Click **Use in campaign** on any approved template to open `/whatsapp/campaigns/create` pre-loaded with that template.
5. Templates from `/whatsapp/templates` also appear live inside the **Template node** in `/whatsapp/flows/create`.

### D. Meta Forms / WhatsApp Flows (`/whatsapp/campaigns/flows`)
1. Pick a starter (`+ Lead`, `+ Booking`, `+ Survey`) or author official Meta Flow JSON v6.0+.
2. Review the **Live Screen Preview** on the right panel.
3. Click **Validate** (schema check automatically blocks forbidden payment-card fields).
4. For dynamic data-exchange forms, choose `Dynamic (Encrypted)` and click **RSA-2048 Keys** to provision an encrypted endpoint.
5. Click **Publish** to lock an immutable version. To edit later, click **Clone** to create a new draft version.
6. Attach published forms directly via **Launch Campaign**, **+ Template**, or **+ Flowbot**.

### E. Campaign Command Center (`/whatsapp/campaigns`) & Composer (`/whatsapp/campaigns/create`)
Creating and launching a campaign takes 7 structured steps with autosave:
1. **Campaign Info**: Name, description, campaign type (`broadcast`, `promotional`, `abandoned_cart`, `order_updates`, `payment_reminders`, `recurring`, `ab_testing`, etc.), objective, priority, and reporting timezone.
2. **Audience**: Choose a native Contact Group (`/whatsapp/groups`) or Dynamic CRM Segment.
3. **Sender & Routing**: Pick one or more authorized tenant WABA phone numbers (strictly tenant-isolated with zero `.env` fallback). Marketing campaigns automatically route to Meta's Marketing Messages API when onboarded, or fall back to Cloud API when allowed.
4. **Template & Personalization**: Choose an approved template from `/whatsapp/templates`, map `{{1}}`, `{{2}}` to live CRM attributes (`customer.name`, `customer.phone`, `customer.email`, `custom_fields.*`), and inspect the **Live WhatsApp Phone Preview** side-by-side.
5. **Interactive Journey**: Optionally attach a **Meta Form**, **Chatbot Flowbot** (`/whatsapp/flows`), and **Automation Rule** (`/whatsapp/automations`) so replies automatically convert into qualified leads and deals.
6. **Schedule & Pacing**: Send immediately, schedule in UTC with quiet-hour protection, configure recurring cadence, or enable A/B testing.
7. **Pre-Launch Validation & Launch**:
   - Computes exact eligible vs. excluded recipients, shared 24-hour Meta business limit check, and dual-billing cost estimate (Direct Meta vs. Provider-Managed Wallet).
   - Send a live test message to verify rendering.
   - Click **Submit for approval**, **Schedule campaign**, or **Launch campaign**.
   - During execution, you can safely **Pause**, **Resume**, **Cancel**, or **Retry transient failed** recipients from `/whatsapp/campaigns/:id`.

### F. Visual Chatbot Flowbot Builder (`/whatsapp/flows` & `/whatsapp/flows/create`)
1. Click **Create flow** to open `/whatsapp/flows/create` (saving automatically locks the URL to `/whatsapp/flows/builder/:id`).
2. Drag and connect nodes on the visual canvas:
   - **Triggers**: Keyword, phrase, first message, all inbound, campaign button response, or Meta Form completion.
   - **Messages**: Text with variables, Media/PDF, Templates (synced live from `/whatsapp/templates`), Quick-Reply Buttons, List Menus, CTA Link Buttons, and **Meta Form Flow** (`send_whatsapp_flow`).
   - **Data Capture**: Name, phone, email, number, currency, date, and custom fields with built-in input validation, error prompts, max retry attempts, and fallback routing.
   - **Logic & AI**: If/Else Conditions, Switch, Business Hours, AI Reply, AI Intent Router, and AI Knowledge Base retrieval (with strict policy guardrails: AI can never alter wallet balances, permissions, consent, or issue refunds).
   - **CRM & Automation Actions**: Contact/CRM Lookup, **Create CRM Lead**, **Create CRM Deal** (`create_deal`), **Schedule Follow-up** (`schedule_followup`), Tag Contact, **Start Automation** (`start_automation`), API Webhook.
   - **Human Handover**: Transfers the chat to a live agent in Team Inbox with a full structured summary of collected answers, pauses the bot so it never interrupts the agent, and supports controlled resumption.
3. Test inside the built-in **Smartphone Simulator**, then click **Publish** (automatically syncs triggers into the live Flowbot runtime and creates an immutable version with safe rollback).

### G. Business Automations (`/whatsapp/automations`)
- Configure background rules triggered by CRM events (`new_lead`, `lead_status_changed`, `deal_won`, `invoice_created`, `invoice_overdue`, `payment_received`, `appointment_booked`, `abandoned_cart`) or WhatsApp events (`incoming_message`, `campaign_replied`, `whatsapp_flow_submitted`, `flowbot_completed`, `human_handover`).
- Durable background engine guarantees:
  - **Persisted Waits & Delays**: Multi-hour/day delays and event waits survive server restarts.
  - **Non-Bypassable Approvals**: High-risk actions pause until required approvers decide.
  - **Safe Retries & Dead-Letter Queue**: Transient network/rate-limit errors retry with exponential backoff + jitter; permanent errors (invalid credentials, opted-out contacts, blocked URLs) go straight to Dead-Letter Queue without infinite loops.
  - **Idempotency**: Duplicate webhooks never double-create leads, deals, or messages.

### H. Schedule (`/whatsapp/campaigns/calendar`) & Approvals (`/whatsapp/campaigns/approvals`)
- **Schedule**: View all upcoming and recurring campaigns with UTC timestamps, timezone, recipient counts, and estimated spend.
- **Approvals**: Four-eyes maker-checker queue where campaign creators cannot approve their own high-volume or high-budget sends. Approvers can **Approve**, **Request Changes**, or **Reject** with an audit note. Editing a critical field (audience, template, sender, budget) automatically invalidates prior approval.

### I. Analytics & Verified Attribution (`/whatsapp/campaigns/analytics`)
- Track real Meta delivery rates (`Delivered / (Delivered + Failed)`), read rates (`Read / Delivered`), reply rates, Meta Form completions, verified revenue conversions, and ROI.
- Record verified orders, payments, won deals, or booked appointments to attribute revenue cleanly back to the originating campaign.
- Build and save custom reports and export CSV summaries.

### J. Governance (`/whatsapp/campaigns/settings`) & Ops Control (`/admin/campaigns`)
- **Governance (Admin only)**: Configure quiet hours (e.g., 21:00 to 09:00), max messages per contact in 24 hours, recipient approval thresholds, four-eyes enforcement, and isolated **Agency Multi-Client** tenants.
- **Ops Control (Admin only)**: Real-time platform view of active campaigns, failed/DLQ jobs, reconciliation-required timeouts (`UNKNOWN_REQUIRES_RECONCILIATION`), and emergency dispatch circuit-breakers to pause/resume any Sender, WABA, or Tenant instantly.

---

## 3. Meta WhatsApp Messaging Rules Enforced Automatically

1. **24-Hour Customer Service Window**:
   - Opens ONLY when a customer sends an inbound WhatsApp message (calculated from the actual inbound timestamp).
   - Inside 24 hours: Free-form text, buttons, lists, media, AI replies, and Meta Forms are allowed.
   - Outside 24 hours: Free-form messages are automatically blocked (`OUTSIDE_SERVICE_WINDOW_TEMPLATE_REQUIRED`). Only an **APPROVED** Meta template with valid consent can initiate outreach. Sending a template never reopens the 24-hour window.
2. **Shared 24-Hour Rolling Business Limit**:
   - Multiple phone numbers under the same WABA share ONE 24-hour unique-recipient limit. Adding more senders improves throughput and regional branding, not the Meta portfolio tier.
3. **Clear Human Escalation**:
   - Typing `human`, `agent`, or `support agent` during any Flowbot conversation escalates directly to a human agent so customers are never trapped in a loop.
4. **Dual Billing Integrity**:
   - **Direct Meta**: Charges go directly to the customer's Meta payment method; Madhura tracks cost estimates and Meta billing readiness.
   - **Provider-Managed Wallet**: Funds are atomically reserved at launch, settled only on confirmed billable `DELIVERED` webhooks, and automatically released if delivery fails.

---

## 4. Real-World Business Use Cases (End-to-End Flows)

### Use Case 1: Solar / Real Estate Lead Generation Campaign to Closed Deal
1. **Setup**: Import 2,500 opted-in leads into a Contact Group (`Commercial Solar Prospects`) in `/whatsapp/groups`.
2. **Campaign**: Create a Marketing campaign in `/whatsapp/campaigns/create` using an approved template with a Quick-Reply button (`Get Custom Quote`), linked to your `Solar Lead Qualifier` Flowbot.
3. **Approval**: Because recipients exceed 1,000, the Marketing Manager approves it in `/whatsapp/campaigns/approvals`.
4. **Customer Interaction**:
   - Customer taps `Get Custom Quote`.
   - Flowbot greets them by name (`{{customer.first_name}}`), asks for **Location**, **Capacity (kW)**, and **Estimated Budget** (validated as currency).
   - AI scores the lead (`Hot` because budget > ₹1,00,000).
5. **Background Automation**:
   - Flowbot triggers `create_lead`, `create_deal`, `schedule_followup` (due in 2 hours), and `human_handover` to the Enterprise Sales Team.
   - Sales rep sees the full summary in Team Inbox, closes the order, and the verified payment attributes ₹4,50,000 revenue back to the campaign in `/whatsapp/campaigns/analytics`.

### Use Case 2: E-Commerce Abandoned Cart Recovery (Stop-on-Purchase)
1. Customer abandons a checkout cart on Shopify/WooCommerce.
2. Automation Engine receives the idempotent `cart_abandoned` event, waits 30 minutes (persisted in DB), verifies consent and DNC suppression, and sends an approved cart-reminder template.
3. If the customer completes payment before the second reminder fires, the `order_completed` webhook immediately cancels the remaining recovery journey and attributes the recovered revenue to the campaign.

### Use Case 3: Appointment Booking with Meta Interactive Form
1. Clinic or service center creates a `Book Appointment` Meta Form in `/whatsapp/campaigns/flows` and attaches it to a Flowbot `send_whatsapp_flow` node.
2. Customer taps `Book Slot`, fills name and preferred date inside WhatsApp's native form UI, and submits.
3. Webhook correlates the `nfm_reply` via `flow_token`, creates the appointment record, schedules a 24-hour reminder automation, and confirms the booking in chat.

### Use Case 4: Payment & Invoice Due Reminder with Verified Stop
1. ERP/Billing emits `invoice_due` with invoice number, amount, and due date.
2. Automation checks consent, sends an approved `UTILITY` payment reminder template with a CTA link button, and enters a durable wait for `payment_succeeded`.
3. Only a verified payment gateway webhook marks the invoice paid and ends the reminder sequence; unpaid overdue invoices automatically escalate to the Accounts team.

### Use Case 5: Multi-Client Agency Operations
1. Agency links Client A (Tenant #2) and Client B (Tenant #3) in `/whatsapp/campaigns/settings`.
2. Each client has isolated contacts, groups, templates, WABA senders, Flowbots, billing wallets, and ROI dashboards. Agency operators manage both without any risk of cross-client data mixing.

---

## 5. Quick Troubleshooting Checklist

| Symptom | Cause | Next Step |
| :--- | :--- | :--- |
| **Campaign blocked: `NO_AUTHORIZED_SENDER`** | No active WABA phone number connected for this tenant | Connect a sender in `/whatsapp/accounts` |
| **Campaign blocked: `TEMPLATE_NOT_APPROVED`** | Template is still `DRAFT`, `PENDING`, or `REJECTED` | Submit and sync template approval in `/whatsapp/templates` |
| **Recipient excluded: `BLOCKED_BY_SUPPRESSION`** | Contact opted out or is on DNC list | Expected compliance block; inspect in `/whatsapp/campaigns/consent` |
| **Flowbot message blocked: `OUTSIDE_SERVICE_WINDOW_TEMPLATE_REQUIRED`** | More than 24 hours since customer's last message | Use a `Template` node with an approved Meta template instead of free-form text |
| **Campaign stuck in `PENDING_APPROVAL`** | Exceeds approval threshold or four-eyes policy active | Have a second authorized reviewer approve in `/whatsapp/campaigns/approvals` |
| **New endpoints return HTML instead of JSON** | Backend server has not restarted with new routes | Restart the Node backend server (`port 5001`) so migrations and routers load |


---

## WATI Competitive Upgrade Pack (Enterprise Extensions)

The Madhura Campaigns platform includes six additional enterprise modules built on top of the core campaign engine, preserving all existing pages, database schemas, and compliance guarantees.

### 1. Guided First-Campaign Launch Assistant (`/whatsapp/campaigns/get-started`)
- Audits all 5 readiness milestones: connected WABA sender, CRM contacts with duplicate phone detection, verifiable opt-in consent, approved Meta templates, and first campaign creation.
- Supports **Pending Meta Template Approval Watches**: save a draft campaign while Meta reviews its template, monitor actual webhook status updates, and optionally enable automatic launch only once Meta approves the template and zero launch-time blockers remain.

### 2. Smart Behavioral Retargeting Engine (`/whatsapp/campaigns/retargeting`)
- Converts verified campaign outcomes into static audience segments and linked follow-up campaign drafts across 11 segments (`delivered_not_read`, `read_not_replied`, `replied`, `cta_clicked`, `flow_submitted`, `flow_not_completed`, `converted`, `not_converted`, `failed_delivery`, `unresolved_delivery`, and audit-only `opted_out`).
- Uses tracked links exclusively for CTA clicks, distinguishes unknown read receipts from confirmed unread, rechecks live consent/DNC/frequency caps, and enforces anti-repeat history so contacts never receive duplicate follow-ups.

### 3. Multi-Step Drip Campaign Sequences (`/whatsapp/campaigns/sequences`)
- Orchestrates multi-step WhatsApp journeys (`template`, `delay`, `condition`, `whatsapp_flow`, `flowbot`, `automation`, `human_handover`, `end`).
- Persists durable wait states (`WAITING_DELAY` with `next_run_at`) processed every 30 seconds by the backend worker.
- Enforces configurable stop conditions (`opt_out`, `purchase`, `deal_won`, `payment_succeeded`, `suppressed`, `reply`) and supports routing customer replies into Flowbots or Team Inbox while logging step-level funnel conversions.

### 4. Smart Failure Recovery, Meta Pacing, Auto-Retry & Optional Fallback (`/whatsapp/campaigns/recovery`)
- Classifies failed and blocked recipients into 13 actionable categories and exports CSV diagnostics.
- Automatically pauses active campaigns on Meta template pacing (`132015` / `132016`), preserves already-sent recipients, and creates a linked recovery campaign for unsent/failed recipients using strictly `APPROVED` replacement templates.
- Runs configurable transient auto-retry policies (backoff + jitter) while strictly skipping permanent failures and `UNKNOWN_REQUIRES_RECONCILIATION`.
- Supports optional SMS, RCS, and Email fallback channels requiring separate channel consent (`sms_fallback`, `rcs_fallback`, `email_fallback`), blocking promotional fallback by default, and maintaining separate provider IDs and cost ledgers.

### 5. Template Health Center (`/whatsapp/campaigns/template-health`)
- Monitors `APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, and `DISABLED` templates with usage counts, pacing incident alerts, variable validation, one-click duplication, AI copy review (preserving Meta category rules), and safe draft-campaign replacement.

### 6. AI Campaign Assistant (`/whatsapp/campaigns/ai-assistant`)
- Generates reviewable campaign blueprints and CRM audience drafts (`auto_launched: false`, `consent_enforced: true`, `dnc_enforced: true`), reviews template quality against Meta rules, answers live analytics questions with explicit calculation formulas, and surfaces next-best-action optimization cards.
