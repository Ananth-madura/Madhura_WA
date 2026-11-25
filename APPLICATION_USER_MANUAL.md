# Madhura WhatsApp CRM - Complete Enterprise Application User Manual

**Document Version:** 2.4.0  
**Target Release:** Madhura WhatsApp Business Platform & Meta Tech Provider Suite  
**Classification:** Official Product Documentation, Operational Guide & Training Manual  
**Last Updated:** November 2026  

---

## Document Overview & Reading Guide

This manual is the official operational handbook for the Madhura WhatsApp CRM platform. It provides exhaustive instructions for business owners, organization administrators, branch managers, customer support agents, sales representatives, and technical operators.

Every section reflects the production codebase across the authenticated React CRM application (`port 3001`), the Node/Express backend API (`port 5001`), the public marketing landing page (`port 3002`), and the customer client portal.

---

## Master Table of Contents

- [PART 01: Getting Started](#part-01-getting-started)
  - [1.1 Platform Introduction & Architecture](#11-platform-introduction--architecture)
  - [1.2 Key Capabilities Overview](#12-key-capabilities-overview)
  - [1.3 System Requirements & Supported Browsers](#13-system-requirements--supported-browsers)
  - [1.4 Application Access URLs](#14-application-access-urls)
  - [1.5 Account Registration (Two-Step Organization Wizard)](#15-account-registration-two-step-organization-wizard)
  - [1.6 Email & Phone Verification](#16-email--phone-verification)
  - [1.7 User Authentication (Work Account, Access Code, 2FA, 1-Click Demo)](#17-user-authentication-work-account-access-code-2fa-1-click-demo)
  - [1.8 Password Management & Recovery](#18-password-management--recovery)
  - [1.9 First-Time User Experience & Interface Walkthrough](#19-first-time-user-experience--interface-walkthrough)
- [PART 02: Account & Workspace Setup](#part-02-account--workspace-setup)
  - [2.1 User Profile & Personal Preferences](#21-user-profile--personal-preferences)
  - [2.2 Organization Profile & Multi-Tenant Boundaries](#22-organization-profile--multi-tenant-boundaries)
  - [2.3 Multi-Branch Operating Architecture](#23-multi-branch-operating-architecture)
  - [2.4 Team Member Invitations & Access Code Generation](#24-team-member-invitations--access-code-generation)
  - [2.5 Localization, Timezones & Currency Formatting](#25-localization-timezones--currency-formatting)
  - [2.6 Real-Time Notifications & WebSocket Subscriptions](#26-real-time-notifications--websocket-subscriptions)
- [PART 03: Dashboard & Navigation Hierarchy](#part-03-dashboard--navigation-hierarchy)
  - [3.1 The Auto-Hiding Shell Header](#31-the-auto-hiding-shell-header)
  - [3.2 The Left Navigation Rail (16 Modules)](#32-the-left-navigation-rail-16-modules)
  - [3.3 Unified Command Bar & Key Performance Indicators](#33-unified-command-bar--key-performance-indicators)
  - [3.4 Workspace & Branch Scope Filter](#34-workspace--branch-scope-filter)
- [PART 04: Complete Module Documentation](#part-04-complete-module-documentation)
  - [4.1 Live Chats & Shared WhatsApp Inbox (`/whatsapp`)](#41-live-chats--shared-whatsapp-inbox-whatsapp)
  - [4.2 Team Inbox & Internal Messaging (`/whatsapp/team-inbox`)](#42-team-inbox--internal-messaging-whatsappteam-inbox)
  - [4.3 Employee Operations Workspace (`/whatsapp/workspace`)](#43-employee-operations-workspace-whatsappworkspace)
  - [4.4 Contacts Directory & Segment Manager (`/whatsapp/contacts`)](#44-contacts-directory--segment-manager-whatsappcontacts)
  - [4.5 Lead Enquiries Pipeline (`/whatsapp/enquiries`)](#45-lead-enquiries-pipeline-whatsappenquiries)
  - [4.6 WhatsApp Message Templates Studio (`/whatsapp/templates`)](#46-whatsapp-message-templates-studio-whatsapptemplates)
  - [4.7 Contact Groups & Broadcasting Segments (`/whatsapp/groups`)](#47-contact-groups--broadcasting-segments-whatsappgroups)
  - [4.8 Enterprise Campaign Command Center (`/whatsapp/campaigns`)](#48-enterprise-campaign-command-center-whatsappcampaigns)
  - [4.9 Business Event Automations (`/whatsapp/automations`)](#49-business-event-automations-whatsappautomations)
  - [4.10 Visual Interactive Flowbot Builder (`/whatsapp/flows`)](#410-visual-interactive-flowbot-builder-whatsappflows)
  - [4.11 AI Agent Studio (`/whatsapp/ai-agents`)](#411-ai-agent-studio-whatsappai-agents)
  - [4.12 Click-to-WhatsApp Ads (`/whatsapp/ads`)](#412-click-to-whatsapp-ads-whatsappads)
  - [4.13 WhatsApp Commerce & Product Catalogs (`/whatsapp/commerce`)](#413-whatsapp-commerce--product-catalogs-whatsappcommerce)
  - [4.14 Analytics & Conversation Reporting (`/whatsapp/analytics`)](#414-analytics--conversation-reporting-whatsappanalytics)
  - [4.15 Accounts & Multi-Sender Hub (`/whatsapp/accounts`)](#415-accounts--multi-sender-hub-whatsappaccounts)
  - [4.16 Meta Tech Provider Compliance Center (`/whatsapp/tech-provider`)](#416-meta-tech-provider-compliance-center-whatsapptech-provider)
  - [4.17 Employee Directory & Access Controls (`/whatsapp/employees`)](#417-employee-directory--access-controls-whatsappemployees)
  - [4.18 Multi-Branch Management (`/whatsapp/branches`)](#418-multi-branch-management-whatsappbranches)
  - [4.19 Subscriptions, Billing & Wallet (`/whatsapp/billing`)](#419-subscriptions-billing--wallet-whatsappbilling)
  - [4.20 Customer Client Portal (`/portal` & `/whatsapp/client-portal`)](#420-customer-client-portal-portal--whatsappclient-portal)
  - [4.21 Agency & White-Label Workspaces (`/agency`)](#421-agency--white-label-workspaces-agency)
  - [4.22 Third-Party Integration Center (`/integrations`)](#422-third-party-integration-center-integrations)
  - [4.23 Platform Administration Console (`/platform/*`)](#423-platform-administration-console-platform)
  - [4.24 Onboarding Command Center (`/onboarding/*`)](#424-onboarding-command-center-onboarding)
- [PART 05: Forms, Fields & Data Management](#part-05-forms-fields--data-management)
- [PART 06: User Roles, Permissions & Access Matrix](#part-06-user-roles-permissions--access-matrix)
- [PART 07: Complete End-to-End Business Workflows](#part-07-complete-end-to-end-business-workflows)
- [PART 08: Automations & Third-Party Integrations](#part-08-automations--third-party-integrations)
- [PART 09: Reports, Metrics & Analytics Interpretation](#part-09-reports-metrics--analytics-interpretation)
- [PART 10: Notifications & Real-Time Communication](#part-10-notifications--real-time-communication)
- [PART 11: Administration, Storage & System Governance](#part-11-administration-storage--system-governance)
- [PART 12: Security, Compliance & Data Privacy](#part-12-security-compliance--data-privacy)
- [PART 13: Systematic Troubleshooting & FAQ](#part-13-troubleshooting--faq)
- [PART 14: Glossary & Technical Reference](#part-14-glossary--technical-reference)

---

## PART 01: Getting Started

### 1.1 Platform Introduction & Architecture

Madhura is an enterprise-grade multi-tenant WhatsApp Business platform and customer relationship management suite. It serves two distinct functional tiers:
1. **Official Meta Tech Provider Layer**: Built directly on Meta Cloud API Graph v22.0, supporting Facebook Login for Business, Embedded Signup, WABA management, phone number registration, 2-step verification PIN management, webhook stream verification, and App Review compliance tools.
2. **Enterprise SaaS Product Layer**: A complete operational suite equivalent to WATI and AiSensy, encompassing shared multi-agent team inboxes, visual drag-and-drop flowbot builders, business event automation triggers, multi-branch routing, CRM lead capture, click-to-WhatsApp ads attribution, e-commerce catalog sync, and Razorpay billing settlement.

The software uses a Yellow and Navy corporate design system (`#202C52` primary navy, `#050E2F` dark navy, `#FCBD16` amber accent, `#FFF4CC` soft surface, `#16803C` Meta verification green).

```
+-------------------------------------------------------------------------------+
|                       MADHURA ENTERPRISE ECOSYSTEM                            |
+-------------------------------------------------------------------------------+
|  PUBLIC SITE (Port 3002)     |  SAAS CRM (Port 3001)   |  CLIENT PORTAL (/portal)
|  Vite + Tailwind Marketing   |  React 18 + SPA Shell   |  Customer Quote/Pay/Chat
+------------------------------+-------------------------+----------------------+
                                      |
                      API REST & Socket.io (Port 5001)
                                      |
       +------------------------------+------------------------------+
       |                                                             |
+---------------+                                             +-----------------+
| Meta Cloud API| <====== Webhooks & Graph API v22.0 =======> | MySQL / SQLite  |
| Tech Provider |                                             | Multi-Tenant DB |
+---------------+                                             +-----------------+
```

### 1.2 Key Capabilities Overview

- **Concurrent Multi-Sender Operations**: Connect multiple WhatsApp numbers under one or more WhatsApp Business Accounts (WABAs), assigning distinct numbers to specific branches, stores, or departments.
- **Shared Team Inbox**: Centralized customer conversation management with automated round-robin agent assignment, custom canned replies, private internal notes, and audit logs.
- **Visual Interactive Flowbots**: Drag-and-drop conversational chatbot builder with keyword triggers, interactive buttons, list menus, data capture forms, business hours gating, and live test simulators.
- **Event-Driven Business Automations**: Real-time WhatsApp notifications dispatched on CRM triggers: Invoices, Quotations, Payment Receipts, New Leads, Walk-in visits, AMC maintenance contracts, and Support Tickets.
- **High-Throughput Broadcast Campaigns**: Targeted messaging to filtered contact segments with consent tracking, opt-out suppression, pacing rate controls, and delivery receipt tracking.
- **Multi-Branch Organization Structure**: Isolate contacts, chats, campaigns, and staff by regional store, city, or franchise unit while retaining central executive reporting.
- **Dual Billing Architecture**: Choice between direct customer settlement with Meta or platform-managed prepaid wallet credits with Razorpay integration.

### 1.3 System Requirements & Supported Browsers

Madhura runs entirely inside modern web browsers with no local desktop client required.

| Browser | Minimum Version | Recommended | WebSockets Support |
| :--- | :--- | :--- | :--- |
| Google Chrome | Version 110+ | Latest Stable | Required (Active) |
| Mozilla Firefox | Version 115+ | Latest Stable | Required (Active) |
| Microsoft Edge | Version 110+ | Latest Stable | Required (Active) |
| Apple Safari | Version 16.4+ | Latest Stable | Required (Active) |

**Hardware & Viewport Requirements:**
- **Desktop / Laptop (Recommended)**: 1280x720 minimum resolution (1920x1080 optimal) for flow builders and campaign dashboards.
- **Tablet**: 768px minimum width with responsive sidebar auto-collapse.
- **Mobile Handset**: Responsive touch view for live chat responses, customer searches, and approval workflows.
- **Network**: Broadband connection with HTTPS port 443 and WebSocket (WSS) access enabled.

### 1.4 Application Access URLs

- **SaaS Workspace Login**: `http://localhost:3001/login` (Production: `https://app.madhuratech.com/login`)
- **Self-Serve Registration**: `http://localhost:3001/signup` (Production: `https://app.madhuratech.com/signup`)
- **Main Workspace Board**: `http://localhost:3001/whatsapp` (Redirects to active inbox)
- **Customer Client Portal**: `http://localhost:3001/portal` (Production: `https://app.madhuratech.com/portal`)
- **Backend API Health Check**: `http://localhost:5001/health`
- **Public Marketing Website**: `http://localhost:3002/` (Production: `https://madhuratech.com`)

### 1.5 Account Registration (Two-Step Organization Wizard)

To create a new company workspace on Madhura:

1. Open `/signup` in your browser.
2. Ensure the top mode tab is set to **New Company Workspace**.
3. **Complete Step 1: Company & Owner Profile**:
   - **Organization Legal Name**: Enter your registered company name (e.g. Acme Retail Private Limited).
   - **Industry Sector**: Select your business vertical from the dropdown (Retail, Real Estate, Healthcare, Financial Services, Education, Automotive, Hospitality, Logistics, Technology, or Other).
   - **First Name & Last Name**: Enter the primary business owner's legal name.
   - **Work Email Address**: Enter a valid business email. This becomes your administrative username.
   - **Mobile Phone Number**: Enter your 10-digit phone number with country code.
   - **Create Master Password**: Choose a strong password of at least 6 characters.
   - **Confirm Password**: Re-enter the password.
   - Click **Proceed to Branch & Subscription Plan**.
4. **Complete Step 2: Branch & Subscription Plan**:
   - **Branch Name**: Defaults to `[Company Name] Head Office`. Customize as needed.
   - **Branch Code**: Defaults to `HQ-01`. Enter your unique alphanumeric store/branch identifier.
   - **Timezone**: Select your operational timezone (default: `Asia/Kolkata (IST +5:30)`).
   - **Select Subscription Plan**: Choose between **Free** (1 number, 1 branch, 2 seats), **Growth** (3 numbers, 3 branches, 15 seats, full flowbots & broadcasts), or **Enterprise** (10 numbers, 10 branches, 50 seats, priority concurrency).
5. **Finalize Setup**:
   - If Free is selected, click **Create free workspace**.
   - If a paid plan is selected, click **Create account & continue to payment** to open the Razorpay checkout.
   - Upon completion, the system automatically authenticates your session and routes you to `/whatsapp`.

> **Note on Database Compatibility**: In SQLite demonstration environments, self-signup displays an informational notice that MySQL is required for real payment settlements. Free workspace initialization proceeds directly.

### 1.6 Email & Phone Verification

- When two-step verification is enabled, signing in or registering prompts an email verification challenge.
- A 6-digit numeric OTP is generated and sent to your registered work email.
- The verification code is valid for 5 minutes.
- Enter the code into the verification input and click **Verify and sign in**.
- If the code expires, click **Send a new code** (60-second cooldown applies).

### 1.7 User Authentication

The login page (`/login`) provides three distinct sign-in methods:

#### Method A: Work Account Credentials
1. Select the **Work Account** tab.
2. Enter your registered work email or employee ID in the **Work Email or Employee ID** field.
3. Enter your password in the **Password** field (toggle visibility via the eye icon).
4. Check **Remember this workstation** to persist session tokens.
5. Click **Sign In to Dashboard**.

#### Method B: Employee Access Code (Zero-Password Activation)
1. Select the **Access Code** tab.
2. Enter the alphanumeric code provided by your administrator (e.g. `AC-9B21-48`).
3. The platform validates the code in real time, displaying the verified company name, assigned branch, and role.
4. Click **Continue Activation**.
5. Set your personal password, confirm it, and click **Activate account & open workspace**.

#### Method C: Instant 1-Click Interactive Demo
1. Select the **Try Demo** tab.
2. Choose your testing role:
   - **Launch as Primary Organization Admin**: Opens full administrative controls, billing, tech provider compliance, and multi-branch configuration.
   - **Launch as Branch Agent**: Opens staff-level live chat inbox and daily customer task boards.
3. The demo environment loads with pre-seeded customers, conversations, and template metrics in an isolated local session.

### 1.8 Password Management & Recovery

- If a password is forgotten, click **Forgot password?** on the login card.
- A recovery dialog informs you to contact your workspace administrator or branch supervisor to issue a temporary reset code.
- Master administrators can reset employee passwords directly from `/whatsapp/employees`.
- Administrative master passwords can be updated through platform management.

### 1.9 First-Time User Experience & Interface Walkthrough

Upon signing in, you are greeted by the unified workspace shell:
- **Top Header Bar**: Shows CRM integration links, active Meta Cloud API connectivity badges, branch selectors, and quick-action utility controls.
- **Left Navigation Rail**: Contains icons and titles for all 16 accessible modules.
- **Command Bar (`.hl-commandbar`)**: Displays module title, organization status badges, and primary action buttons (e.g., Refresh, Create, Filter).
- **Metric Overview Strip (`.hl-kpis`)**: Summarizes real-time performance counters (e.g., active conversations, messages sent, pending follow-ups).
- **Workspace Canvas**: Displays data tables, conversation feeds, or interactive visual builders.

---

## PART 02: Account & Workspace Setup

### 2.1 User Profile & Personal Preferences

- Access your profile settings via the top-bar profile icon or `/whatsapp/workspace?view=my_day`.
- View your registered legal name, email address, assigned organization role, and branch allocations.
- Notification sounds, desktop push alerts, and auto-assignment preferences can be configured per workstation.

### 2.2 Organization Profile & Multi-Tenant Boundaries

Madhura operates under strict multi-tenant isolation. Every customer record, conversation, template, campaign, and financial transaction is scoped to a specific `tenant_id`.
- Data cannot leak across organizations.
- Organization settings can be updated from `/platform/tenants` or `/whatsapp/accounts`.
- Organizations maintain their own company legal name, brand identifier, registered business portfolio, and timezone.

### 2.3 Multi-Branch Operating Architecture

Scaling businesses can partition their operations across branches (e.g. Bangalore Central, Mumbai Retail, Chennai Service Hub):
- Navigate to `/whatsapp/branches`.
- Click **New Branch Wizard** to register a regional store or department.
- Enter branch name, unique branch code (e.g., `BLR-01`), physical address, and assigned phone numbers.
- Employees assigned to a branch see only their branch's conversations and leads when operating in **My Branch** scope.
- Organization administrators retain unified oversight across all branches.

### 2.4 Team Member Invitations & Access Code Generation

Administrators can invite staff without sending insecure raw passwords:
1. Open `/whatsapp/employees`.
2. Click **Add Team Member**.
3. Enter the employee's name, email address, mobile number, and select their primary branch.
4. Choose an **Access Level**:
   - **Full WhatsApp Access**: Inbox, campaigns, templates, automations, and flows.
   - **Live Chat Only**: 1-on-1 customer chat handling and template sending.
   - **Read Only**: View chat logs, contact lists, and analytics; outbound messaging disabled.
   - **Campaigns Only**: Create and schedule broadcasts; live chat hidden.
5. Click **Create Employee & Generate Code**.
6. Copy the unique **Access Code** (e.g. `AC-4F91-12`) or copy the direct activation link and send it via WhatsApp or email.

### 2.5 Localization, Timezones & Currency Formatting

- **Supported Timezones**: `Asia/Kolkata` (IST), `Asia/Dubai` (GST), `Asia/Singapore` (SGT), `Europe/London` (BST), `America/New_York` (EST), and `UTC`.
- Timezones govern automated campaign dispatch windows, business hours evaluation, and reminder scheduling.
- **Currencies**: Displayed in Indian Rupees (`INR`, `₹`) or United States Dollars (`USD`, `$`), formatted cleanly via localized number formatters.

### 2.6 Real-Time Notifications & WebSocket Subscriptions

The platform maintains persistent bidirectional Socket.io connections (`port 5001`):
- `wa_message_received`: Informs the team inbox of incoming customer replies.
- `wa_message`: Broadcasts outbound dispatch status (Sent, Delivered, Read, Failed).
- `wa_chat_read`: Updates unread counters in real time.
- `wa_ready`: Alerts administrators that a WhatsApp phone session is authenticated and operational.
- `wa_disconnected`: Alerts operators if a connection drops.

---

## PART 03: Dashboard & Navigation Hierarchy

### 3.1 The Auto-Hiding Shell Header

The shell header (`WALayout.jsx`) maximizes screen space for chat operators:
- Automatically hides after 1.5 seconds of pointer inactivity on desktop displays.
- Slides back into view as soon as the cursor moves within 16 pixels of the top edge or any header control receives keyboard focus.
- Remains permanently visible on touchscreen mobile devices.
- Contains:
  - **CRM Link**: Quick navigation to external CRM systems.
  - **Meta API Status Badge**: Green indicator with active sender phone number.
  - **Branches Button**: Direct shortcut to multi-branch management.
  - **Employees Button**: Quick access to employee directories.
  - **Billing & Plans**: Financial ledger and subscription status.
  - **Quota & Balance**: Modal showing remaining 24-hour service allowances and prepaid wallet balances.
  - **Sync All Button**: Forces immediate synchronization of WhatsApp contacts and chats.
  - **API Config Button**: Quick configuration of Meta Cloud API credentials.
  - **Disconnect Button**: Disconnects active WhatsApp session.
  - **Sign Out Button**: Clears tokens and returns to `/login`.

### 3.2 The Left Navigation Rail (16 Modules)

The navigation rail (`WhatsAppNav.jsx`) lists 16 modules:

| Icon | Tab Name | Route | Minimum Role | Business Purpose |
| :--- | :--- | :--- | :--- | :--- |
| MessagesSquare | **Team Inbox** | `/whatsapp/team-inbox` | Member | Multi-agent internal collaboration, team channels, and cross-branch chat |
| Users | **My Workspace** | `/whatsapp/workspace` | Member | Daily customer execution, task checklists, follow-ups, and sales deals |
| MessageCircle | **Live Chats** | `/whatsapp` | Member | Direct 1-on-1 customer messaging, QR scan connection, and message history |
| UserCheck | **Contacts** | `/whatsapp/contacts` | Member | WhatsApp contacts directory, custom tags, and CSV import/export |
| Inbox | **Enquiries** | `/whatsapp/enquiries` | Member | Lead capture pipeline: cold, warm, hot triage and customer conversion |
| FileText | **Templates** | `/whatsapp/templates` | Member | Meta HSM approved templates, variable mapping, and creation studio |
| Users | **Groups** | `/whatsapp/groups` | Member | Contact broadcasting groups and static audience segments |
| Send | **Campaigns** | `/whatsapp/campaigns` | Member | Bulk broadcast command center, scheduling, drip sequences, and analytics |
| Zap | **Automations** | `/whatsapp/automations` | Member | Business event triggers: Invoices, Quotes, Receipts, AMC, and Welcome messages |
| Bot | **Flows** | `/whatsapp/flows` | Member | Drag-and-drop visual chatbot builder and interactive menu flows |
| BarChart3 | **Analytics** | `/whatsapp/analytics` | Member | Message delivery rates, read receipts, cost attribution, and team metrics |
| UserCheck | **Client Portal** | `/whatsapp/client-portal` | Member | Customer self-serve portal management, quote approvals, and invoices |
| GitBranch | **Branches** | `/whatsapp/branches` | Admin | Multi-branch routing, regional store numbers, and quota allocation |
| Smartphone | **Accounts** | `/whatsapp/accounts` | Admin | WhatsApp Business Accounts (WABAs), phone numbers, and AI Assistant setup |
| ShieldCheck | **Tech Provider**| `/whatsapp/tech-provider`| Admin | Meta Partner Compliance, App Review permissions, and webhook inspection |
| Users | **Employees** | `/whatsapp/employees` | Admin | Employee roster, access levels, permissions, and unique access codes |

### 3.3 Unified Command Bar & Key Performance Indicators

Every major module is topped by a unified command bar (`.hl-commandbar`):
- High-contrast module icon and title.
- Status badges showing active organization, connected phone numbers, and tier status.
- Contextual primary buttons: **Refresh**, **Create Record**, **Export**, and **Filter**.
- Directly below, the KPI strip (`.hl-kpis`) displays real-time statistics in clean, elevated white cards.

### 3.4 Workspace & Branch Scope Filter

In modules supporting multi-branch data (e.g. Operations Workspace, Contacts, Inquiries):
- **My Work (`mine`)**: Shows records assigned specifically to the logged-in agent.
- **My Branch (`branch`)**: Shows records belonging to the agent's assigned branch.
- **All Branches (`organization`)**: Shows company-wide records (available to Administrators).

---

## PART 04: Complete Module Documentation

---

### 4.1 Live Chats & Shared WhatsApp Inbox (`/whatsapp`)

#### 1. Module Overview
The Live Chats interface is the primary operational workspace for frontline customer communication. It connects agents directly to WhatsApp users through official Meta Cloud API v22.0 webhooks and WebSocket concurrency. Frontline agents can manage multiple chats, assign conversations, write internal private notes, create sales enquiries, synchronize contacts with the CRM, and attach rich media.

#### 2. How to Access
- **Sidebar Path**: Click **Live Chats** (MessageCircle icon).
- **Direct URL**: `/whatsapp` or `/whatsapp/inbox`.
- **Required Permission**: Minimum `chat_only` access level. Supervisors and Administrators have visibility across all branch conversations; team members see assigned conversations.

#### 3. Complete Interface Breakdown (3-Column Layout)
- **Left Column (Conversation Explorer & Filters)**:
  - **Filter Tabs**:
    - **All Chats**: Complete stream of organization or branch conversations.
    - **Mine**: Only conversations assigned specifically to your logged-in agent profile.
    - **Unassigned**: Inbound conversations awaiting triage and agent assignment.
    - **Closed / Resolved**: Inactive or completed conversations.
  - **Search Bar**: Real-time filtering by contact name, phone number (e.g. `+9198765...`), or message text snippet.
  - **Conversation List Items**: Displays avatar, customer name/number, last message preview, timestamp, unread message count badge, assigned agent avatar, and status indicator.
- **Middle Column (Active Conversation & Messaging Thread)**:
  - **Conversation Header**: Customer name, phone number, branch badge, 24-hour service window timer, chat assignment dropdown, and quick action buttons (**Create Enquiry**, **Add to CRM**, **Mark Resolved**).
  - **Thread Scroll Area**: Chronological speech bubbles:
    - **Incoming customer messages**: White bubble aligned to the left.
    - **Outgoing agent messages**: Light green bubble aligned to the right with delivery tick icons.
    - **Internal Team Notes**: Distinctive soft amber/yellow sticky-note cards visible ONLY to internal staff and never sent to WhatsApp.
    - **System Event Logs**: Centered grey pills (e.g. *"Assigned to Priya by Alex"*, *"Window expired"*).
  - **Bottom Action Bar**: Text entry box, emoji picker, attachment clip, template selector, canned response trigger (`/`), and send button.
- **Right Column (Collapsible CRM Drawer & Contact Profile)**:
  - Full contact identity (Legal Name, Phone, Email, Company, Physical Address).
  - Active CRM Tags (e.g. `VIP`, `Payment_Pending`, `High_Priority`).
  - Linked Deals and Enquiries in the sales pipeline.
  - Custom data attributes and interaction history.

#### 4. Step-by-Step Guide: How to Chat with Customers
1. Open `/whatsapp` and select a conversation from the left feed (filter by **Mine** to view your active chats).
2. Review previous conversation history, incoming voice notes, images, or PDF catalogs.
3. Check the **24-Hour Service Window Status** in the top header:
   - **Active Window**: The customer has messaged within the last 24 hours. You can type any free-form text message, send emoji, or attach media directly.
   - **Expired Window**: More than 24 hours have elapsed since the customer's last incoming message. Free-form text input is disabled by Meta to protect users from spam. Click **Send Template** and choose an approved Meta HSM Template to re-open the communication session.
4. Type your message in the bottom input bar.
5. **Using Canned Quick Replies**: Type `/` in the message box to open the quick response menu. Select a pre-saved response (e.g. `/greeting`, `/bank-details`, `/support-hours`) to insert standardized text instantly.
6. **Sending Media Attachments**: Click the Paperclip icon to attach:
   - **Images**: JPEG or PNG format (up to 5MB).
   - **Documents / PDFs**: Invoices, brochures, price sheets (up to 100MB).
   - **Videos**: MP4 format (up to 16MB).
7. Press **Enter** or click the **Send** button.
8. Monitor message delivery ticks:
   - **Single Grey Tick (`✓`)**: Message accepted by Meta Cloud API and en route.
   - **Double Grey Ticks (`✓✓`)**: Message successfully delivered to customer's smartphone.
   - **Double Blue Ticks (`✓✓`)**: Message opened and read by the customer.

#### 5. Step-by-Step Guide: How to Assign and Re-Assign Chats
1. Inside the active chat thread, locate the **Assign** dropdown located in the conversation header.
2. Click the dropdown to view available team members in your branch or organization.
3. Select the colleague who should take ownership (e.g. *"Priya (Sales Rep)"* or *"Chennai Support Pool"*).
4. An automated internal system note is logged in the chat history: *"Conversation assigned to Priya by [Your Name]"*.
5. The assigned team member receives an instant desktop audio chime and unread badge notification on their **Mine** filter tab.
6. To return the chat to the general queue, select **Unassigned** from the dropdown.

#### 6. Step-by-Step Guide: How to Add Internal Private Notes
Internal notes allow colleagues to record important customer context, phone call summaries, credit checks, or special instructions without exposing them to the customer on WhatsApp.
1. Above the message input box, click the **Note** tab or the Notepad icon.
2. The input border transitions to an amber/yellow focus ring to clearly indicate private internal mode.
3. Type your note (e.g. *"Customer called via landline. Agreed on ₹4,500/yr pricing. Awaiting signed contract by Friday."*).
4. **Mentioning Teammates**: Type `@` followed by a colleague's name (e.g. `@priya`) to mention them. They will receive an immediate notification with a direct link to this conversation.
5. Click **Post Note**.
6. The note renders in the thread as an amber-tinted card with a lock icon. **It is stored in the internal database and is NEVER transmitted over WhatsApp to the customer.**

#### 7. Step-by-Step Guide: How to Convert a Chat into a Sales Enquiry
When an incoming inquiry presents a commercial opportunity, operators can convert the conversation into a tracked CRM pipeline deal directly from the chat:
1. In the active conversation header or right-hand CRM drawer, click **+ Create Enquiry** (or **Convert to Lead**).
2. The Enquiry Creation modal opens, pre-populating the contact's name and WhatsApp phone number automatically.
3. **Fill in Enquiry Parameters**:
   - **Enquiry Title**: Descriptive subject (e.g. *"Enterprise Cloud Setup - 10 Senders"*).
   - **Estimated Deal Value**: Projected revenue in INR (e.g. `₹85,000`).
   - **Pipeline Stage**: Choose initial stage (`New`, `Contacted`, `Requirements Gathered`, `Proposal Sent`).
   - **Lead Temperature**: Select `Hot`, `Warm`, or `Cold`.
   - **Assigned Sales Representative**: Allocate ownership to yourself or a sales colleague.
4. Click **Save Enquiry**.
5. The conversation header immediately links to the newly generated Enquiry ID (e.g. `ENQ-8821`), and the record populates on the Kanban board at `/whatsapp/enquiries`.

#### 8. Step-by-Step Guide: How to Add & Sync Contacts with CRM
1. In the right-hand panel of the chat window, inspect the **Contact Profile** card.
2. If the user is currently an unsaved number, click **+ Add to CRM**.
3. **Enter Profile Fields**:
   - **First & Last Name**: Customer legal contact name.
   - **Email Address**: Work email for sending invoices and PDF reports.
   - **Company / Account**: Organization name.
   - **Physical Address & City**: Branch or billing address.
   - **Customer Category**: Retail, Wholesale, Enterprise, Partner.
4. **Attach Custom CRM Tags**: Click **+ Add Tag** and select or create tags such as `VIP`, `Payment_Pending`, or `Event_Attendee`. Tags automatically filter contacts into broadcast segments and trigger event automations.
5. Click **Save Contact**. All details are permanently synchronized across your team workspace and contacts directory.

#### 9. Step-by-Step Guide: Resolving & Closing Conversations
1. Once customer requirements are fulfilled, click the **Mark Resolved** button in the chat header.
2. Select a resolution tag (e.g. *"Support Query Solved"*, *"Sale Completed"*, *"General FAQ"*).
3. The conversation moves from the **Active / Mine** tab into the **Closed / Resolved** archive.
4. **Automatic Reopening**: If the customer sends a new message in the future, the system automatically reactivates the chat, unarchives the thread, and assigns it based on branch routing rules.

---

### 4.2 Team Inbox & Internal Messaging (`/whatsapp/team-inbox`)

#### 1. Module Overview
The Team Inbox is Madhura's integrated internal collaboration workspace. It functions like Slack or Microsoft Teams embedded directly within the WhatsApp CRM. It allows staff across different branches, shifts, and departments to communicate internally, coordinate broadcast campaigns, share customer tickets, and discuss complex customer issues without switching between external chat apps.

#### 2. How to Access
- **Sidebar Path**: Click **Team Inbox** (MessagesSquare icon).
- **Direct URL**: `/whatsapp/team-inbox`.
- **Required Permission**: Open to all active organization staff and employees.

#### 3. Complete Module Breakdown
- **Channels Column (Left)**:
  - **Public Channels**: Open to all employees across the organization (e.g. `#general`, `#announcements`, `#broadcast-schedules`).
  - **Departmental Channels**: Specific to operational teams (e.g. `#sales-team`, `#technical-support`, `#finance-billing`).
  - **Branch Channels**: Restricted to specific branch members (e.g. `#chennai-branch`, `#hq-operations`).
  - **Direct Messages (DMs)**: 1-on-1 private messaging between colleagues with online/offline presence indicators.
- **Message Feed (Center)**: Threaded discussions, rich markdown formatting, internal file attachments, message search, and emoji reactions.
- **Channel Info & Members (Right)**: Channel description, pinned messages, shared documents and files, and list of participating team members.

#### 4. Step-by-Step Guide: Creating Channels & Organizing Team Chats
1. Navigate to `/whatsapp/team-inbox`.
2. Beside the **Channels** header on the left, click the **+ (Create Channel)** icon.
3. In the modal:
   - Enter **Channel Name** (e.g. `campaign-dispatches` or `vip-escalations`).
   - Enter **Purpose / Description** (e.g. *"Coordination channel for daily high-volume broadcasts"*).
   - Select **Branch Scope**: Choose **Organization-Wide** (all branches) or restrict to a specific branch.
   - Select **Privacy Mode**:
     - **Public**: Any team member in the organization can search and join.
     - **Private (Invite-Only)**: Only staff explicitly invited by administrators can see and participate.
4. Click **Create Channel**. The channel appears immediately in the left list.

#### 5. Step-by-Step Guide: Team Collaboration & Sharing Customer Context
1. Select the relevant channel or initiate a Direct Message with a colleague.
2. Type your message in the chat box. You can use full formatting including **bold**, *italics*, and bullet lists.
3. **Sharing WhatsApp Customer Links**: When discussing a tricky customer case, copy the customer's chat link or phone number from `/whatsapp` and paste it into the team channel. The system automatically renders a rich preview pill containing the customer's name, phone, and current status. Clicking the pill opens the exact customer chat thread in a side split pane!
4. **Mentioning Teammates (`@mention`)**: Type `@` followed by a colleague's name (e.g. `@arun`) or `@channel` to alert all members. This triggers a visual bell alert and an audio chime on their device.
5. **Attaching Internal Assets**: Click the Paperclip icon to attach spreadsheets (quotation pricing sheets), internal presentation slides, or screenshot bug reports.
6. **Pre-Broadcast Alerts**: Before launching large bulk marketing broadcasts in `/whatsapp/campaigns`, marketing staff post scheduled dispatch notices in `#broadcast-schedules` so frontline customer support staff are alerted to prepare for incoming inquiry surges.

---

### 4.3 Employee Operations Workspace (`/whatsapp/workspace`)

#### 1. Module Overview
A unified CRM command center for frontline staff. Combines daily task checklists, customer profile cards, sales lead scoring, deal pipeline boards, and follow-up reminders into one view.

#### 2. How to Access
- **Sidebar Path**: Click **My workspace** (Users icon).
- **Direct URL**: `/whatsapp/workspace`.
- **Required Permission**: Available to all members with `customers` module permission.

#### 3. Module Interface & Tabs
- **Overview**: High-level statistical cards (Total Customers, Active Clients, Open Tasks, Won Revenue).
- **My Day**: Prioritized daily checklist showing overdue follow-ups, today's appointments, and urgent customer tickets.
- **Customers**: Searchable master customer table with phone numbers, tags, total spent, and last contact date.
- **Tasks & Follow-ups**: Kanban board and list view of staff follow-ups categorized as `open`, `in_progress`, `completed`, or `cancelled`.
- **Leads**: Sales qualification pipeline categorized by temperature (`new`, `cold`, `warm`, `hot`).
- **Deals Pipeline**: Commercial opportunity board (`new`, `qualified`, `proposal`, `negotiation`, `won`, `lost`).

#### 4. Step-by-Step Workflow: Creating a Customer & Task
1. Open `/whatsapp/workspace` and select the **Customers** tab.
2. Click **+ Add Customer**.
3. Fill in Legal Name, WhatsApp Phone (`+91...`), Email Address, and Company.
4. Click **Save Customer**.
5. Inside the customer details drawer, click **Add Task**.
6. Set Task Title (e.g., "Send Quotation for AMC"), Due Date, and Priority.
7. Click **Create Task**. It immediately populates in your **My Day** schedule.

---

### 4.4 Contacts Directory & Segment Manager (`/whatsapp/contacts`)

#### 1. Module Overview
Centralized directory of all WhatsApp contacts. Manages customer opt-in status, phone number validity, custom attributes, behavioral tags, and bulk CSV imports.

#### 2. How to Access
- **Sidebar Path**: Click **Contacts** (UserCheck icon).
- **Direct URL**: `/whatsapp/contacts`.

#### 3. Managing Contacts
- **Add Single Contact**: Click **+ Add Contact**, input valid E.164 phone number (e.g. `+919876543210`), name, email, and tags.
- **Bulk CSV Import**: Click **Import CSV**, upload a CSV containing `phone`, `name`, `email`, and `tags` columns. Map fields and click **Execute Import**.
- **Export Contacts**: Click **Export** to generate a secure CSV download.
- **Opt-Out Management**: If a customer replies `STOP` or `UNSUBSCRIBE`, their contact record is automatically flagged as `OPT_OUT`. Outbound broadcasts skip them to preserve Meta quality ratings.

---

### 4.5 Lead Enquiries Pipeline (`/whatsapp/enquiries`)

#### 1. Module Overview
Captures and triages inbound inquiries originating from WhatsApp click-to-chat links, website widgets, Facebook/Instagram ads, and flowbots.

#### 2. How to Access
- **Sidebar Path**: Click **Enquiries** (Inbox icon).
- **Direct URL**: `/whatsapp/enquiries`.

#### 3. Temperature Classification
- **New (Gray)**: Inbound inquiry received; pending agent review.
- **Cold (Blue)**: Low buying intent; enrolled in automated nurture sequences.
- **Warm (Amber)**: Customer actively asking for pricing or specifications.
- **Hot (Red)**: Urgent buying signal; immediate quote or call required.

#### 4. Conversion Action
1. Select an open enquiry card.
2. Click **Convert to Customer**.
3. The system creates a verified Customer record, transitions the enquiry status to `Converted`, and opens a Deal creation prompt.

---

### 4.6 WhatsApp Message Templates Studio (`/whatsapp/templates`)

#### 1. Module Overview
Author, test, validate, and synchronize official Meta Highly Structured Message (HSM) templates required for proactive outbound messaging outside the 24-hour customer service window.

#### 2. How to Access
- **Sidebar Path**: Click **Templates** (FileText icon).
- **Direct URL**: `/whatsapp/templates`.
- **Create Route**: `/whatsapp/templates/create`.

#### 3. Template Categories
- **MARKETING**: Promotions, seasonal discounts, product announcements, and re-engagement campaigns.
- **UTILITY**: Transaction receipts, order tracking updates, booking confirmations, and billing reminders.
- **AUTHENTICATION**: One-Time Passwords (OTPs) and account verification codes with security buttons.

#### 4. Creating a Template Step-by-Step
1. Click **+ Create Template**.
2. **Template Name**: Enter lowercase letters, numbers, and underscores only (e.g. `order_shipped_v2`).
3. **Category**: Select `UTILITY` or `MARKETING`.
4. **Language**: Choose language code (e.g., `en` for English, `hi` for Hindi).
5. **Header (Optional)**: Select `None`, `Text`, `Image`, `Video`, or `Document`.
6. **Message Body**: Enter message text using bracketed variables:
   `Hello {{1}}, your order #{{2}} has been shipped via {{3}}. Tracking link: {{4}}.`
7. **Footer (Optional)**: Short disclaimer text (e.g., "Reply STOP to unsubscribe").
8. **Interactive Buttons**: Add up to 3 Quick Reply buttons or 2 Call-to-Action buttons (URL link or phone call).
9. Click **Submit to Meta for Approval**.
10. Meta reviews the template automatically (typically approved within 1 to 15 minutes). The status badge reflects `APPROVED`, `PENDING`, or `REJECTED` with specific feedback.

---

### 4.7 Contact Groups & Broadcasting Segments (`/whatsapp/groups`)

#### 1. Module Overview
Organizes contacts into static lists or dynamic segments based on branch, purchase history, tags, or customer status for broadcast campaigns.

#### 2. How to Access
- **Sidebar Path**: Click **Groups** (Users icon).
- **Direct URL**: `/whatsapp/groups`.

#### 3. Creating & Managing Groups
1. Click **+ Create Group**.
2. Name the group (e.g., "Diwali VIP Buyers", "Chennai Corporate Clients").
3. Assign contacts individually, by tag filtering, or by uploading a phone number list.
4. Groups can be immediately selected as the target audience in the Campaign Command Center.

---

### 4.8 Enterprise Campaign Command Center (`/whatsapp/campaigns`)

#### 1. Module Overview
The Campaign Command Center is Madhura's high-volume WhatsApp broadcasting engine. Built to match and exceed WATI and AiSensy capabilities, it enables marketing and growth teams to execute compliant, high-converting broadcast campaigns to tens of thousands of contacts. It features dynamic contact placeholder personalization, pacing rate limiters, opt-out suppression, wallet cost calculation, and granular delivery analytics.

#### 2. How to Access
- **Sidebar Path**: Click **Campaigns** (Send icon).
- **Direct URL**: `/whatsapp/campaigns`.
- **Composer Route**: `/whatsapp/campaigns/create`.
- **Required Permission**: Requires `campaigns_only` or `full_access` permission.

#### 3. Campaign Module Sub-Navigation
- **Dashboard**: Master list of broadcasts with status pills (`DRAFT`, `SCHEDULED`, `RUNNING`, `COMPLETED`, `PAUSED`), delivery percentages, and key metrics.
- **Campaign Composer**: 5-step wizard for building and validating broadcasts.
- **Calendar View**: Visual scheduling calendar showing planned dispatch times to prevent overlapping broadcasts.
- **Audiences & Import**: Segment builder and CSV list upload with consent confirmation.
- **Consent & Suppression**: Blacklist management, unsubscription records, and quiet hours enforcement (e.g. no promotional messaging between 9 PM and 8 AM).
- **Retargeting & Follow-ups**: Automated sequence rules triggered for contacts who received or read the broadcast but did not reply.

#### 4. Step-by-Step Guide: How to Create a High-Converting Campaign
Follow this comprehensive 5-step workflow to configure and launch a campaign:

##### Step 1: Campaign Identity & Sender Selection
1. Navigate to `/whatsapp/campaigns` and click the **+ Create Campaign** button.
2. Enter a **Campaign Name** that reflects the objective and date (e.g. *"Diwali_Flash_Sale_Nov2026"* or *"VIP_Renewals_Q4"*).
3. Select **Sending WhatsApp Number**: Choose from your organization's connected multi-sender phone numbers. If sending a promotional message, choose your dedicated marketing sender.
4. Select **Branch Ownership**: Allocate campaign results to a specific regional branch or select **Headquarters / Organization**.
5. Click **Next: Select Audience**.

##### Step 2: Audience Selection & Segmentation
1. Choose your audience source:
   - **Option A - Pre-Configured Contact Group**: Select an existing group from `/whatsapp/groups` (e.g. *"Retail Buyers Chennai"* or *"Inquiries Last 30 Days"*).
   - **Option B - Tag-Based Filter**: Filter contacts dynamically by tags (e.g. Contacts with tag `VIP` AND NOT `Churned`).
   - **Option C - Upload Dedicated CSV File**: Click **Upload CSV** and drag your recipient file. The CSV must contain an E.164 phone column (e.g. `+919876543210`). You can also include custom columns such as `name`, `discount_code`, `due_date`.
2. The system automatically runs an **Opt-Out Suppression Check**: Contacts present in the organization blacklist or who previously replied *"STOP"* are automatically filtered out to preserve your Meta sender reputation.
3. Review total eligible recipient count and click **Next: Select Template**.

##### Step 3: Template Selection & Dynamic Variable Mapping
1. Select an approved Meta HSM Template from the dropdown (e.g. `diwali_offer_v2`). Only templates approved by Meta (`STATUS: APPROVED`) are eligible for broadcasting.
2. Preview the template content on the live mobile screen simulator on the right.
3. **Map Dynamic Placeholders**:
   - For placeholder `{{1}}`: Map to CRM field `Contact.First_Name` (or fallback to *"Valued Customer"*).
   - For placeholder `{{2}}`: Map to CRM field `Offer.Discount_Code` or CSV column.
4. **Configure Header Media** (if required by template): Upload an eye-catching campaign image (JPEG/PNG 1080x1080px), promotional video (MP4 under 16MB), or PDF brochure.
5. **Configure Call-to-Action Buttons**: Confirm button URLs or quick-reply payloads.
6. Click **Next: Scheduling & Pacing**.

##### Step 4: Scheduling & Throttling Pacing Controls
1. Choose dispatch timing:
   - **Send Immediately**: Dispatch begins as soon as the campaign is confirmed.
   - **Schedule for Future Date & Time**: Set the target dispatch date and operational time window (e.g. *Tomorrow at 10:30 AM IST*).
2. **Configure Pacing Throttle (Rate Limiting)**:
   - To maintain high sender health and avoid Meta spam filters, set a safe dispatch speed:
     - **Safe Starter Speed**: 30 to 50 messages per minute.
     - **High-Tier Sender Speed**: 100 to 200 messages per minute.
3. **Quiet Hours Enforcement**: Toggle ON to automatically pause dispatch if the clock reaches 21:00 (9 PM) and resume automatically at 08:00 (8 AM) local recipient time.
4. Click **Next: Review & Launch**.

##### Step 5: Cost Calculation & Launch Confirmation
1. Review the **Campaign Summary Card**:
   - Total Target Recipients: e.g. `10,000`.
   - Message Category: **Marketing** (Meta Graph API rate e.g. `₹0.78` per conversation).
   - Estimated Meta Network Fee: `₹7,800`.
   - Madhura Platform Credit Fee: `₹500`.
   - Total Wallet Deduction: `₹8,300`.
2. The system checks your prepaid organization wallet balance at `/whatsapp/billing`:
   - If balance is sufficient, the **Launch Campaign** button is enabled.
   - If balance is insufficient, a top-up alert prompt directs you to recharge via Razorpay.
3. Click **Launch Broadcast**.

#### 5. Step-by-Step Guide: How to Monitor and Analyze Running Campaigns
1. After launch, open the campaign detail dashboard.
2. Monitor the **Real-Time Dispatch Progress Bar** showing percent complete.
3. Inspect the live delivery funnel:
   - **Sent**: Dispatched from Madhura to Meta Cloud API servers.
   - **Delivered**: Reached the customer's device.
   - **Read**: Opened by the customer (blue ticks).
   - **Replied**: Customer responded to the campaign, creating an active 24-hour service window.
   - **Failed**: Messages rejected by Meta. Click **View Failure Breakdown** to inspect error codes (e.g. *Error 131026: Phone number not on WhatsApp*, *Error 131042: Payment issue*).
4. **Pause / Resume Controls**: Click **Pause Broadcast** at any time to temporarily suspend dispatch (useful if customer support gets overwhelmed by incoming replies). Click **Resume** to continue.
5. Click **Export CSV Report** to download a recipient-by-recipient log containing delivery timestamps, read status, and button click records.

---

### 4.9 Business Event Automations (`/whatsapp/automations`)

#### 1. Module Overview
Business Event Automations provide background, event-driven workflow automation. Unlike Flowbots (which are interactive decision trees triggered by customer text), Automations listen for system events occurring within the CRM, sales pipeline, or external webhooks, and execute pre-configured actions automatically. This includes sending instant order confirmations, payment reminders, deal stage notifications, and staff assignments.

#### 2. How to Access
- **Sidebar Path**: Click **Automations** (Zap icon).
- **Direct URL**: `/whatsapp/automations`.
- **Required Permission**: Requires `automations` or `full_access` permission.

#### 3. Core Automation Structure (Trigger -> Condition -> Action)
Every automation rule consists of three structural components:
1. **Event Trigger (When This Happens)**: The internal or external event that initiates the rule.
2. **Filter Conditions (Only If This Is True)**: Optional logical filters to narrow down target records.
3. **Automated Action (Do This)**: The automated tasks to execute immediately or after a scheduled delay.

#### 4. Supported Event Triggers

| Trigger Name | Event Key | Description & Typical Application |
| :--- | :--- | :--- |
| **New Contact Created** | `contact_created` | Welcomes new contacts and dispatches onboarding guides |
| **Tag Added to Contact** | `tag_added` | Fires when tag like `VIP` or `Payment_Pending` is attached |
| **Enquiry Stage Changed** | `enquiry_stage_changed` | Alerts customer when proposal is ready or quotation is sent |
| **Deal Won** | `deal_won` | Dispatches welcome pack, receipt, and alerts management |
| **Invoice Generated** | `invoice_created` | Dispatches PDF invoice and Razorpay payment link |
| **Invoice Due Reminder** | `invoice_due_soon` | Sends proactive payment reminder 48 hours prior to due date |
| **Payment Received** | `payment_received` | Dispatches instant payment receipt and updates CRM deal status |
| **Inbound Webhook Received** | `external_webhook` | Triggers on Shopify purchase, WooCommerce order, or web form fill |

#### 5. Step-by-Step Guide: How to Configure an Automation Rule
Follow this practical procedure to create an automated WhatsApp payment confirmation and receipt workflow:

1. Navigate to `/whatsapp/automations` and click **+ Create Automation**.
2. **Step 1 - Rule Name & Trigger**:
   - Rule Name: Enter *"Automated_Payment_Confirmation_WhatsApp"*.
   - Trigger Event: Select **Payment Received (`payment_received`)**.
3. **Step 2 - Filter Conditions**:
   - Click **+ Add Condition**.
   - Condition: Set `Payment_Status == 'SUCCESS'` AND `Amount > 0`.
   - Branch Filter: Set **All Branches** or restrict to a specific branch.
4. **Step 3 - Define Actions**:
   - **Action 1 - Send WhatsApp Message**:
     - Choose sending phone number from connected senders.
     - Select approved Meta HSM Template: `payment_receipt_v1`.
     - Map dynamic parameters:
       - `{{1}}` -> `Customer.Name`
       - `{{2}}` -> `Payment.Transaction_ID`
       - `{{3}}` -> `Payment.Amount_INR`
       - `{{4}}` -> `Payment.Receipt_URL`
   - **Action 2 - Update CRM Record**:
     - Automatically add CRM tag `Paid_Client` to the contact profile.
     - Advance linked Deal stage to **Closed Won**.
   - **Action 3 - Internal Staff Alert**:
     - Send notification message to the `#finance-billing` internal channel in `/whatsapp/team-inbox`.
5. **Step 4 - Review & Activation**:
   - Set execution delay (Immediate or delay by X minutes).
   - Toggle **Rule Active** switch to ON.
   - Click **Save & Activate Automation**.
6. The rule runs continuously in the background. Every successful payment logged in the system will automatically dispatch the WhatsApp confirmation and update all CRM records within seconds.

---

### 4.10 Visual Interactive Flowbot Builder (`/whatsapp/flows`)

#### 1. Module Overview
The Visual Flowbot Builder is a no-code conversational automation canvas. It empowers administrators and operations managers to build automated customer journeys, interactive menu trees, lead qualification forms, appointment scheduling bots, and FAQ responders. Flowbots operate 24/7, providing instant replies to incoming customer inquiries and seamlessly handing off conversations to human agents when required.

#### 2. How to Access
- **Sidebar Path**: Click **Flows** (Bot icon).
- **Direct URL**: `/whatsapp/flows` or `/whatsapp/flows/build`.
- **Required Permission**: Requires `automations` or `full_access` permission.

#### 3. Core Component Palette (The 5 Node Categories)
Every Flowbot is composed of visual nodes placed on an infinite canvas and linked by connector wires:
- **1. Trigger Nodes**:
  - **Keyword Match**: Fires when customer message equals or contains specific keywords (e.g. `PRICE`, `DEMO`, `MENU`, `OFFER`).
  - **Welcome Trigger**: Fires automatically when a brand new customer messages your WhatsApp number for the first time.
  - **Fallback / Default Trigger**: Fires when an incoming message does not match any existing keyword or active flow.
- **2. Message Nodes**:
  - **Interactive Button Menu**: Dispatches a message with up to 3 quick-reply buttons (e.g. *[ View Catalog ]*, *[ Pricing ]*, *[ Support ]*).
  - **Interactive List Menu**: Dispatches a WhatsApp menu button that opens a structured picker list with up to 10 rows grouped into sections.
  - **Rich Text & Media**: Sends plain text, images, videos, audio notes, or PDF brochures.
- **3. User Input & Data Capture Nodes**:
  - **Text Input**: Captures free-form customer answers (e.g. Full Name, City).
  - **Number Input**: Captures and validates numeric answers (e.g. Quantity, PIN code).
  - **Email Validator**: Captures email addresses with built-in format validation.
  - **Date Picker**: Captures target dates for appointments or service visits.
- **4. Logic & Routing Nodes**:
  - **Condition (If / Else)**: Branches the conversation based on customer input, tags, or CRM attributes (e.g. *If Customer Tag == "VIP" -> Route to Priority Branch*).
  - **Business Hours Checker**: Evaluates current system time against branch working hours. Branches to **True** (Open) or **False** (Closed / Send Offline Auto-Reply).
- **5. Action & Integration Nodes**:
  - **REST Webhook / API Dispatch**: Executes an external HTTP GET or POST request to your website, Shopify store, ERP, or internal database, and injects dynamic JSON variables back into the chat.
  - **Human Agent Handoff**: Stops the automated bot, tags the conversation as `Needs Human`, transfers the chat to a specific branch agent, and posts an internal alert.

#### 4. Step-by-Step Guide: How to Build an Interactive Lead Qualification Flowbot
Follow this detailed operational procedure to build a complete customer intake flowbot from scratch:

##### Step 1: Initialize New Flow Canvas
1. Navigate to `/whatsapp/flows` and click **+ Create New Flow**.
2. Name your flow (e.g. *"Inbound_Lead_Qualification_v1"*).
3. Select the sending WhatsApp phone number this flow applies to.
4. Click **Open Canvas**. An empty grid canvas appears with a default **Start Node**.

##### Step 2: Configure the Inbound Trigger
1. Drag a **Keyword Match Trigger** node from the left palette onto the canvas.
2. In the right configuration panel:
   - Select Match Mode: **Contains Any Keyword**.
   - Input target trigger keywords: `HI`, `HELLO`, `START`, `DEMO`, `INQUIRY`.
   - Set Case Sensitivity: **False** (matches both upper and lower case).
3. Connect the **Start Node** output port to the **Keyword Match Trigger** input port.

##### Step 3: Add Business Hours Logic Check
1. Drag a **Business Hours** node onto the canvas.
2. Connect the output of the Keyword Trigger to the Business Hours node.
3. In the right panel, configure operating hours:
   - Timezone: `Asia/Kolkata (IST)`.
   - Monday to Friday: `09:00 - 18:00`.
   - Saturday: `09:00 - 14:00`.
   - Sunday: `Closed`.
4. The node generates two output branches: **Open (True)** and **Closed (False)**.

##### Step 4: Configure the Off-Hours Path (False Branch)
1. Drag a **Send Message** node onto the canvas.
2. Connect the **Closed (False)** port to this message node.
3. Enter message text: *"Thank you for contacting Madhura! Our offices are currently closed. Our regular hours are Monday through Saturday, 9 AM to 6 PM IST. Please select an option below or leave a message, and our team will contact you first thing in the morning."*
4. Drag an **Interactive Button Menu** node with options: *[ View Catalog PDF ]*, *[ Request Morning Callback ]*.

##### Step 5: Configure the Open Hours Path (True Branch) & Interactive Menu
1. Drag an **Interactive Button Menu** node onto the canvas.
2. Connect the **Open (True)** port to this node.
3. Configure Header Text: *"Welcome to Madhura WhatsApp CRM!"*.
4. Configure Body Text: *"How can our enterprise team assist your organization today? Please select an option:"*.
5. Create 3 Interactive Buttons:
   - **Button 1**: `📦 Product Catalog`
   - **Button 2**: `💰 Enterprise Pricing`
   - **Button 3**: `👨‍💼 Speak to Human Agent`

##### Step 6: Configure Button Actions & Human Agent Handoff
1. **For Button 1 (Catalog)**:
   - Connect Button 1 output to a **Send Media** node.
   - Upload your company product brochure (PDF format).
   - Add a follow-up text node: *"Would you like a specialist to schedule a 15-minute product walkthrough?"*.
2. **For Button 2 (Pricing)**:
   - Connect Button 2 output to a **Send Message** node displaying standard package tiers (Growth: ₹3,999/mo, Enterprise: ₹8,999/mo).
3. **For Button 3 (Speak to Agent)**:
   - Connect Button 3 output to a **Human Agent Handoff** node.
   - In the configuration panel:
     - Target Branch: Select `Chennai Branch` or `Headquarters`.
     - Routing Method: **Round-Robin** across available online support staff.
     - Tag Applied: Add tag `Hot_Lead_Inquiry`.
     - Internal System Message: *"Customer selected live human agent from Flowbot menu."*.
   - Add a confirmation message to the customer: *"Connecting you with a specialist now. Please hold for a moment..."*.

##### Step 7: Test and Publish the Flowbot
1. In the top right corner of the canvas, click **Run Simulator**.
2. A live WhatsApp smartphone emulator appears on the right screen.
3. Type *"Hello"* in the simulator input.
4. Watch the flowbot trigger, check business hours, and dispatch the interactive buttons. Click each button to verify that every path executes correctly.
5. Once tested, click **Publish Flow**.
6. The flowbot is live immediately. All incoming WhatsApp messages matching your trigger keywords will be handled automatically!

---

### 4.11 AI Agent Studio (`/whatsapp/ai-agents`)

#### 1. Module Overview
Deploys autonomous Large Language Model copilots for 24/7 intelligent customer triage, catalog inquiry answering, and booking.

#### 2. Supported LLM Providers
- **Google Gemini**: Recommended for fast, high-context conversational customer service (`gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash-exp`).
- **OpenAI**: Industry standard for complex structured reasoning (`gpt-4o-mini`, `gpt-4o`).
- **Groq**: Ultra-low latency inference for instantaneous customer responses (`llama-3.3-70b-versatile`).
- **DeepSeek**: High-intelligence cost-effective conversational model (`deepseek-chat`).
- **OpenRouter**: Unified frontier gateway including Anthropic Claude 3.5 Sonnet.

#### 3. Configuration Steps
1. Navigate to `/whatsapp/ai-agents` or `/whatsapp/accounts?tab=assistant`.
2. Toggle **AI Assistant Active** to ON.
3. Select LLM Provider and Model ID.
4. Enter Provider API Key (encrypted and stored in vault).
5. In the **System Instructions** text area, define your company's persona, operating hours, product pricing facts, and boundary rules (e.g. "Politely decline medical advice and route to a human agent").
6. Set **Human Handoff Trigger**: Define keywords (e.g., "human", "agent", "complaint") that instantly disengage the AI and ring human agents.

---

### 4.12 Click-to-WhatsApp Ads (`/whatsapp/ads`)

#### 1. Module Overview
Integrates with Meta Ad Accounts to track Click-to-WhatsApp (CTWA) ad campaigns run across Facebook and Instagram. Attaches ad referral payloads directly to customer chat threads, attributing sales revenue and calculating Return on Ad Spend (ROAS).

#### 2. Features
- Real-time campaign spend, conversation starts, and cost-per-lead tracking.
- Pre-filled customer greeting identification.
- Automatic routing of ad leads to specialized sales agents.

---

### 4.13 WhatsApp Commerce & Product Catalogs (`/whatsapp/commerce`)

#### 1. Module Overview
Synchronizes Meta Business Manager product catalogs directly into WhatsApp. Customers can browse multi-item catalogs, add products to an interactive cart, and submit orders inside WhatsApp.

#### 2. Key Actions
- **Catalog Synchronization**: Connect Meta Catalog ID to sync inventory counts, product titles, descriptions, and INR prices.
- **Cart Handling**: Receive structured customer carts inside the Live Chat inbox.
- **Payment Link Generation**: Generate and send instant Razorpay payment links for complete cart amounts.

---

### 4.14 Analytics & Conversation Reporting (`/whatsapp/analytics`)

#### 1. Module Overview
Audits messaging metrics, conversation volumes, delivery success rates, read receipts, and agent resolution times across branches.

#### 2. Key Metrics Explained
- **Delivery Rate (%)**: Calculated as `(Delivered Messages / Total Sent) * 100`. Healthy rates exceed 95%.
- **Read Rate (%)**: Percentage of delivered messages opened and read by recipients.
- **Average First Response Time**: Time elapsed between customer message arrival and first agent reply.
- **Conversation Quota Usage**: 24-hour rolling consumption against Meta messaging limit tiers.

---

### 4.15 Accounts & Multi-Sender Hub (`/whatsapp/accounts`)

#### 1. Module Overview
The Accounts & Multi-Sender Hub is the technical foundation of your WhatsApp Business operations. It manages official Meta Cloud API connections, Embedded Signup onboarding, multi-sender concurrency, phone number verification, 2-step verification PIN registration, and sender health monitoring. Madhura allows enterprises to connect multiple WhatsApp numbers to a single workspace, allowing different phone numbers to handle support, sales, marketing broadcasts, or branch operations.

#### 2. How to Access
- **Sidebar Path**: Click **Accounts** (Server / Phone icon).
- **Direct URL**: `/whatsapp/accounts`.
- **Required Permission**: Requires **Administrator** or **Tech Provider** access.

#### 3. Core Interface & Navigation Tabs
- **Connected Numbers Tab**: List of active WhatsApp phone numbers, display names, Meta Phone Number IDs, WABA IDs, quality health scores, and messaging limit tiers.
- **Meta Integrations & Signup Tab**: Official Facebook Login for Business Embedded Signup launcher and manual token configurator.
- **Multi-Sender Concurrency Tab**: Allocating specific phone numbers to branches, departments, or campaign engines.
- **AI Copilot & Assistant Tab**: Configuring LLM models (Gemini, OpenAI, Claude) and autonomous fallback behaviors.

#### 4. Step-by-Step Guide: How to Connect a WhatsApp Number via Official Embedded Signup
Embedded Signup is Meta's official onboarding experience that links your WhatsApp Business Account (WABA) to Madhura in under 2 minutes:

1. Navigate to `/whatsapp/accounts` and select the **Meta Integrations & Signup** tab.
2. Click the **Connect WhatsApp Number (Embedded Signup)** button.
3. A secure Meta popup window appears displaying **Facebook Login for Business**.
4. **Log in with your Facebook credentials** that have admin access to your Meta Business Portfolio.
5. **Select or Create Meta Business Portfolio**: Choose your verified company portfolio (e.g. *"Acme Technologies Private Limited"*).
6. **Select or Create WhatsApp Business Account (WABA)**:
   - Choose an existing WABA, or click **Create New WABA** and input your business name and timezone.
7. **Create or Select WhatsApp Business Profile**:
   - Enter your **WhatsApp Business Display Name** (must match your legal business name or registered trademark to pass Meta review).
   - Select your Business Category (e.g. *Retail, Technology, Healthcare*).
8. **Verify Phone Number**:
   - Enter the clean phone number to be connected. (Ensure this number is NOT currently registered on a consumer WhatsApp or WhatsApp Business mobile app; if it is, delete the account on your mobile app before proceeding).
   - Choose verification method: **SMS** or **Voice Phone Call**.
   - Enter the 6-digit verification code received on your phone.
9. **Authorize Permissions**: Confirm permission grant for `whatsapp_business_messaging` and `whatsapp_business_management`.
10. Click **Finish**. The popup closes automatically.
11. Madhura's backend automatically captures the System User Access Token, discovers your WABA ID, registers your Phone Number ID, and sets up real-time webhook subscriptions.
12. The number appears in your **Connected Numbers** list with a green **ACTIVE** status pill!

#### 5. Step-by-Step Guide: 2-Step Verification PIN Registration
Meta mandates a 6-digit two-step verification PIN to register a phone number on Cloud API:
1. In `/whatsapp/accounts`, locate your connected phone number in the table.
2. Click **Action Menu (...)** and select **Register 2-Step PIN**.
3. Enter a secure 6-digit numeric PIN (e.g. `849201`).
4. Click **Register with Meta**.
5. Madhura executes a POST request to `https://graph.facebook.com/v22.0/{phone_number_id}/register` with the PIN payload.
6. A success badge confirms registration. Store this PIN safely; it is required if the phone number is ever migrated.

#### 6. Step-by-Step Guide: Multi-Sender Concurrency Management
Enterprises operating across multiple locations or departments can utilize multi-sender concurrency:
1. In `/whatsapp/accounts`, click the **Multi-Sender Concurrency** tab.
2. View your connected numbers:
   - **Sender 1 (`+91 98765 43210`)**: Assigned to **Customer Support & Team Inbox**. All inbound messages to this number route to frontline support agents.
   - **Sender 2 (`+91 98765 43211`)**: Assigned to **Marketing & Broadcast Campaigns**. High-volume promotional broadcasts are dispatched from this dedicated sender to keep the support line clear.
   - **Sender 3 (`+91 98765 43212`)**: Assigned to **Chennai Regional Branch**. Regional inquiries route directly to Chennai staff.
3. To change assignments, click **Edit Sender Mapping**, select the designated module or branch, and click **Save Mapping**.

#### 7. Monitoring Quality Rating & Messaging Limit Tiers
Meta continuously monitors sender health based on customer block and spam reporting rates:
- **Quality Ratings**:
  - **High (Green)**: Optimal sender health. Messages deliver with zero restrictions.
  - **Medium (Yellow)**: Moderate spam reports. Review template content and reduce frequency.
  - **Low (Red)**: Danger of rate limiting or phone number suspension. Immediately audit contact consent and pause cold broadcast campaigns.
- **Messaging Limit Tiers**:
  - **Tier 1**: Up to 1,000 unique business-initiated contacts per rolling 24-hour window.
  - **Tier 2**: Up to 10,000 unique contacts per 24 hours (automatically upgraded by Meta after maintaining good quality and sending at least 1,000 messages).
  - **Tier 3**: Up to 100,000 unique contacts per 24 hours.
  - **Tier 4**: Unlimited contacts per 24 hours.

---

### 4.16 Meta Tech Provider Compliance Center (`/whatsapp/tech-provider`)

#### 1. Module Overview
A platform operator console specifically built for Madhura's Meta Partner compliance, webhook debugging, App Review preparation, and AckBot auto-responder validation.

#### 2. Four Compliance Stages
1. **Stage 1 - Meta Business Verification**: Track legal business verification submission date, Business Portfolio ID, official website, and document proofs.
2. **Stage 2 - Meta App Configuration**: Manage App ID, App Secret, Privacy Policy URLs, Terms of Service, and Data Deletion webhook callbacks.
3. **Stage 3 - App Review & Advanced Access**: Track approval status for critical permissions: `whatsapp_business_messaging`, `whatsapp_business_management`, and `business_management`.
4. **Stage 4 - Video Evidence & Screencasts**: Structured checklists and demonstration scripts required by Meta review auditors.

#### 3. Real-Time Webhook Inspector
- Inspect raw JSON payloads delivered by Meta Graph API.
- Live signature verification (`X-Hub-Signature-256`) checking.
- One-click payload copying for developer testing.

---

### 4.17 Employee Directory & Access Controls (`/whatsapp/employees`)

#### 1. Module Overview
Manage human agents, supervisors, and administrative personnel across regional branches.

#### 2. Key Actions
- View staff directory, active branch assignments, and access levels.
- Generate or revoke unique employee access codes.
- Audit employee dispatch volume and average response times.

---

### 4.18 Multi-Branch Management (`/whatsapp/branches`)

#### 1. Module Overview
Administer regional store branches, physical office locations, or departmental units.

#### 2. Capabilities
- Register new branches with unique codes, contact persons, and operational timezones.
- Allocate dedicated WhatsApp numbers to specific branches.
- Archive inactive branches with safety locks that pause linked outbound campaigns.

---

### 4.19 Subscriptions, Billing & Wallet (`/whatsapp/billing`)

#### 1. Module Overview
Dual billing engine supporting both direct Meta invoicing and platform-managed prepaid wallets.

#### 2. Components
- **Subscription Tier**: Display of current plan (Free, Growth, Enterprise) with upgrade controls.
- **Prepaid Wallet**: Balance indicator for WhatsApp message credits, AI tokens, and automation jobs.
- **Razorpay Checkout**: Seamless top-up via UPI, NetBanking, and Corporate Credit Cards.
- **Meta Category Rate Cards**: Transparent per-message costs for Marketing, Utility, Authentication, and Service messages across domestic (India) and international destinations.

---

### 4.20 Customer Client Portal (`/portal` & `/whatsapp/client-portal`)

#### 1. Module Overview
An external self-service portal for your clients. Customers can log in using their verified phone number to review quotations, approve invoices, track project tasks, and initiate authenticated WhatsApp chats with their assigned representative.

---

### 4.21 Agency & White-Label Workspaces (`/agency`)

#### 1. Module Overview
Designed for digital marketing agencies, consultants, and enterprise resellers managing multiple sub-client brands from a single login.

#### 2. Capabilities
- Provision isolated client tenant accounts.
- Allocate pooled message allowances and wallet credits.
- Configure white-label portal branding (custom domain, agency logo, support email).

---

### 4.22 Third-Party Integration Center (`/integrations`)

#### 1. Module Overview
Connects Madhura to external business platforms:
- **Shopify & WooCommerce**: Automated catalog synchronization, cart recovery, and shipping notifications.
- **Razorpay**: Automated payment link generation and webhook signature verification.
- **Google Sheets**: Real-time sync of lead captures to Google spreadsheets.
- **HubSpot & Zoho CRM**: Bi-directional contact synchronization and conversation logging.
- **REST API Keys**: Generate secure bearer tokens for custom backend integrations.

---

### 4.23 Platform Administration Console (`/platform/*`)

#### 1. Module Overview
Super-administrative interface for platform operators:
- **Tenants & Organizations**: Monitor all registered company workspaces, change plan statuses, and manage tenant quotas.
- **Subscriptions Ledger**: Audit all payment transactions and invoice receipts.
- **Platform Health**: Monitor database connections, memory usage, background queue workers, and Redis socket clusters.

---

### 4.24 Onboarding Command Center (`/onboarding/*`)

#### 1. Module Overview
An interactive wizard guiding new business owners through complete workspace setup:
1. **Company Profile**: Setup company name and branch.
2. **Subscription Selection**: Choose operational plan.
3. **Meta Embedded Signup**: Authorize Facebook Business Portfolio and WABA.
4. **Phone Registration**: Configure 6-digit PIN.
5. **Test Message**: Dispatch an instant live WhatsApp test to verify delivery.

---

## PART 05: Forms, Fields & Data Management

### 5.1 Organization Self-Signup Form (`/signup`)

| Field Name | Description | Required | Input Type | Validation Rules | Example |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `company_name` | Registered legal business name | Yes | Text | Min 2 chars | "Acme Retail Pvt Ltd" |
| `industry` | Primary industry vertical | Yes | Select | Valid catalog option | "Retail & E-Commerce" |
| `first_name` | Administrator first name | Yes | Text | Min 2 chars | "Ananth" |
| `last_name` | Administrator family name | No | Text | Optional | "Kumar" |
| `email` | Work email for authentication | Yes | Email | Valid RFC 5322 format | "admin@acmeretail.com" |
| `mobile_number`| Primary contact phone | No | Tel | 10-15 digits with code | "+919876543210" |
| `password` | Master password | Yes | Password | Min 6 characters | "SecurePass#2026" |
| `confirmPassword`| Password match confirmation | Yes | Password | Must match `password` | "SecurePass#2026" |
| `branch_name` | Initial office / branch name | Yes | Text | Min 2 chars | "Bangalore Head Office"|
| `branch_code` | Alphanumeric branch code | Yes | Text | Uppercase alphanumeric | "BLR-01" |
| `timezone` | Operational timezone | Yes | Select | Valid IANA timezone | "Asia/Kolkata" |
| `plan` | Subscription tier | Yes | Radio | `free`, `growth`, `enterprise` | "growth" |

### 5.2 Contact Creation Form (`/whatsapp/contacts`)

| Field Name | Description | Required | Input Type | Validation Rules | Example |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `phone` | WhatsApp mobile number | Yes | Tel | E.164 international format | "+919123456789" |
| `name` | Customer contact name | Yes | Text | Min 2 chars | "Priya Sharma" |
| `email` | Customer email address | No | Email | Valid email format | "priya@example.com" |
| `company` | Organization / Employer | No | Text | Max 100 chars | "Infosys" |
| `tags` | Classification labels | No | Comma-text | Alphanumeric tags | "VIP, Retail, Diwali2026" |

### 5.3 Template Creation Form (`/whatsapp/templates/create`)

| Field Name | Description | Required | Input Type | Validation Rules | Example |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `name` | Meta template unique key | Yes | Text | `^[a-z0-9_]+$` (lowercase) | "order_confirmed_v1" |
| `category` | Template intent category | Yes | Select | `MARKETING`, `UTILITY`, `AUTHENTICATION` | "UTILITY" |
| `language` | Language ISO code | Yes | Text | 2-5 letter code | "en" |
| `header_type`| Optional media header | No | Select | `None`, `Text`, `Image`, `Video`, `Document` | "Image" |
| `body` | Main message template text | Yes | Textarea | Max 1024 chars; variables `{{1}}` | "Hi {{1}}, order #{{2}} confirmed!" |
| `footer` | Disclaimer text | No | Text | Max 60 chars | "Acme Customer Care" |
| `buttons` | Interactive buttons payload | No | JSON | Valid button schema | `[{"text":"Track Order"}]` |

---

## PART 06: User Roles, Permissions & Access Matrix

### 6.1 Role Definitions

1. **Super Administrator / Platform Operator (`platform_admin`)**: Full unconstrained access across all tenants, financial ledgers, Meta provider configurations, and server health.
2. **Organization Owner (`organization_owner`)**: Legal owner of the business workspace. Can manage subscription billing, change organization roles, add branches, and delete workspaces.
3. **Organization Administrator (`organization_admin` / `admin`)**: Full management rights across the workspace including Meta connections, employees, campaigns, templates, and automations. Cannot demote the organization owner.
4. **Delegated Sub-Administrator (`subadmin`)**: Operational administrative privileges. Can configure campaigns, flows, and assign staff. Cannot modify billing or delete branches.
5. **Branch Manager (`branch_manager`)**: Supervisory role scoped to a single branch. Manages staff assignments, branch queues, local campaigns, and branch contacts.
6. **Customer Support Agent / Sales Rep (`employee` / `agent`)**: Frontline staff. Operates Live Chats, handles assigned inquiries, completes daily tasks, and initiates outbound templates. Access further restricted by Access Level (`full`, `chat_only`, `read_only`, `campaign_only`).

### 6.2 Master Role-Permission Matrix

| Functional Module | Super Admin | Org Owner | Org Admin | Sub-Admin | Branch Manager | Staff (Full) | Staff (Chat Only) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Live Chats (`/whatsapp`)** | View/Manage | Full | Full | Full | Branch Only | Assigned | Assigned |
| **Team Inbox (`/whatsapp/team-inbox`)** | Full | Full | Full | Full | Branch/Org | Full | Full |
| **Operations Workspace** | Full | Full | Full | Full | Branch Scope | Assigned | Assigned |
| **Contacts Manager** | Full | Full | Full | Full | Branch Scope | View/Edit | View Only |
| **Lead Enquiries** | Full | Full | Full | Full | Branch Scope | View/Convert | View Only |
| **Templates Studio** | Full | Full | Full | Full | View/Create | View/Create | View Only |
| **Campaigns Command Center** | Full | Full | Full | Full | Branch Only | Create/Launch | Hidden |
| **Event Automations** | Full | Full | Full | Full | View Only | View Only | Hidden |
| **Flowbot Builder** | Full | Full | Full | Full | View/Edit | View Only | Hidden |
| **Analytics & Reports** | Full | Full | Full | Full | Branch Only | Own Stats | Own Stats |
| **Multi-Branch Setup** | Full | Full | Full | View Only | View Own | Hidden | Hidden |
| **Accounts & Senders Hub** | Full | Full | Full | Full | View Own | Hidden | Hidden |
| **Tech Provider Compliance** | Full | Full | Full | View Only | Hidden | Hidden | Hidden |
| **Employee Management** | Full | Full | Full | View/Assign | View Branch | Hidden | Hidden |
| **Billing & Razorpay** | Full | Full | Full | Hidden | Hidden | Hidden | Hidden |

---

## PART 07: Complete End-to-End Business Workflows

### 7.1 Workflow 1: New Business Registration to Live WhatsApp Messaging

```
[Register Account (/signup)]
           │
           ▼
[Verify Email OTP Challenge]
           │
           ▼
[Select Subscription Tier (Growth)]
           │
           ▼
[Open /whatsapp/accounts -> Meta Embedded Signup]
           │
           ▼
[Authorize Meta Portfolio & Select Phone Number]
           │
           ▼
[Enter 6-Digit Registration PIN & Confirm]
           │
           ▼
[System Dispatches Test WhatsApp Message -> Ready for Production]
```

1. **Step 1**: Owner registers on `/signup`, providing company details and selecting the Growth plan.
2. **Step 2**: System verifies email challenge and routes to `/whatsapp/accounts`.
3. **Step 3**: Owner clicks **Connect WhatsApp Number** to launch Meta's official Embedded Signup dialogue.
4. **Step 4**: Owner logs into Facebook, selects their Business Portfolio, chooses or registers their WhatsApp Business Account (WABA), and authorizes permissions.
5. **Step 5**: Upon window closure, Madhura exchanges the authorization code for a long-lived access token, subscribes webhooks, registers the 6-digit PIN, and updates status to `Connected`.
6. **Step 6**: The owner clicks **Send Test Message**. A live WhatsApp message is delivered to their mobile device. The workspace is officially live.

### 7.2 Workflow 2: Inbound Lead Capture to CRM Deal Conversion

1. **Trigger**: A prospective client clicks a Click-to-WhatsApp ad on Instagram and sends "Hi, I am interested in solar panel installation".
2. **System Action**: 
   - Backend ingests webhook event, verifies `X-Hub-Signature-256`, and captures contact details (`wa_contacts`).
   - Automatically registers a lead enquiry (`wa_enquiries`) with temperature set to `Warm`.
   - Fires an automated welcome message (`wa_automations`) containing a link to your digital brochure.
3. **Triage**: In `/whatsapp/enquiries`, the sales supervisor assigns the enquiry to agent "Priya Nair".
4. **Agent Action**: Priya opens `/whatsapp`, reviews the customer thread, and clicks **Convert to Customer**.
5. **Result**: A verified customer record and active Deal card (Value: ₹2,50,000) are created in `/whatsapp/workspace`.

### 7.3 Workflow 3: Bulk Marketing Broadcast with Compliance Safeguards

1. **Step 1**: Marketing team navigates to `/whatsapp/templates/create` and authors a seasonal festival promotion template (`diwali_mega_sale_2026`).
2. **Step 2**: Meta approves the template in 4 minutes.
3. **Step 3**: Marketer navigates to `/whatsapp/campaigns/create`.
4. **Step 4**: Selects target Contact Group ("All Retail Customers - South Zone").
5. **Step 5**: System automatically checks consent records; contacts with `OPT_OUT` status are suppressed from the dispatch queue.
6. **Step 6**: Pacing rate is configured at 100 messages/minute. Campaign is scheduled for Friday at 10:00 AM IST.
7. **Step 7**: At the scheduled time, the campaign engine dispatches messages via Meta Cloud API, streaming live delivery receipts to the dashboard.

---

## PART 08: Automations & Third-Party Integrations

### 8.1 Event-Driven CRM Automation Architecture

Madhura includes an internal event bus (`backend/services/automationStore.js`) that captures operational events and dispatches WhatsApp messages automatically.

```
+-------------------------------------------------------------------------------+
|                        MADHURA EVENT AUTOMATION BUS                           |
+-------------------------------------------------------------------------------+
  [Invoice Created]        [Lead Added]       [Payment Received]    [AMC Contract]
          │                      │                    │                    │
          └──────────────────────┴─────────┬──────────┴────────────────────┘
                                           │
                                           ▼
                                [Rule Condition Engine]
                                (Verify Branch, Amount, Tags)
                                           │
                                           ▼
                                [Template & Variable Engine]
                                (Evaluate {name}, {amount})
                                           │
                                           ▼
                              [Meta Cloud API Dispatcher]
                                           │
                                           ▼
                           [Customer WhatsApp Delivery]
```

### 8.2 Shopify & E-Commerce Integration
- Automatically syncs product catalogs to WhatsApp Commerce collections.
- Captures abandoned checkouts and triggers recovery WhatsApp messages after 60 minutes with dynamic discount coupons.
- Dispatches automated order confirmations and tracking links when order status updates to `Fulfilled`.

### 8.3 Razorpay Payment Gateway Integration
- Secure server-to-server webhook verification using shared HMAC secrets (`X-Razorpay-Signature`).
- Automatically generates UPI/card payment links attached to invoice messages.
- Upon payment completion, triggers `payment_received` automation, records receipt in customer ledger, and marks invoice as `Paid`.

---

## PART 09: Reports, Metrics & Analytics Interpretation

### 9.1 Delivery Health Metrics
- **Sent**: Total message packets successfully handed off to Meta Cloud API.
- **Delivered**: Message packets acknowledged as received by customer handset.
- **Read**: Messages opened by the customer (blue ticks enabled).
- **Failed**: Messages rejected due to invalid numbers, country blocks, or template variable mismatches.

### 9.2 Financial Usage Ledger
- View live consumption against your monthly spending limit.
- Per-message costs broken down by category (Marketing vs Utility vs Service).
- Wallet debit logs with unique transaction reference IDs.

---

## PART 10: Notifications & Real-Time Communication

### 10.1 Desktop & Sound Alerts
- Audible chime sounds when an incoming customer reply arrives in an assigned conversation.
- Browser notification toasts show customer name and message preview.
- Unread count badge dynamically updates in the left navigation rail and browser tab title.

### 10.2 System Status Banners
- Alerts operators if the Meta Cloud API connection requires re-authentication.
- Notifies administrators when phone quality rating dips to Medium or Low.

---

## PART 11: Administration, Storage & System Governance

### 11.1 Multi-Tenant Data Governance
- Every database query strictly incorporates `tenant_id` filters.
- Administrators can only inspect and manage assets belonging to their licensed organization.

### 11.2 Cloudflare R2 Object Storage
- Media attachments, customer voice notes, and invoice PDFs are securely stored in Cloudflare R2 object storage.
- Private URLs with expiring signatures prevent unauthorized asset downloads.

### 11.3 Database Engines
- **MySQL (Production Recommended)**: High-concurrency relational storage supporting multi-tenant partitioning, connection pooling, and ACID financial transactions.
- **SQLite (Development / Testing)**: Embedded lightweight storage for local testing, rapid development, and offline demonstrations.

---

## PART 12: Security, Compliance & Data Privacy

### 12.1 Authentication & Session Security
- Passwords hashed using industry-standard bcrypt with cryptographic salt rounds.
- Session tokens transmitted via HTTP-only, `SameSite=None`, Secure cookies or Bearer Authorization headers.
- Automatic session invalidation upon explicit logout or administrative demotion.

### 12.2 GDPR & Data Privacy Compliance
- Public Privacy Policy available at `/privacy`.
- Terms of Service available at `/terms`.
- Automated Data Deletion Callback endpoint active at `/data-deletion`, fulfilling official Meta Platform requirements.
- Customer opt-out commands (`STOP`, `UNSUBSCRIBE`) are honored instantaneously.

---

## PART 13: Systematic Troubleshooting & FAQ

### Scenario 1: Unable to Sign In (Invalid Credentials)
- **Problem**: Login card displays "Login failed. Please verify your credentials."
- **Cause**: Typo in work email, incorrect password, or workspace account inactive.
- **Solution**: Re-verify email casing (system normalizes to lowercase). Ensure Caps Lock is off. If forgotten, contact your workspace administrator for a temporary reset code.

### Scenario 2: Meta Cloud API Shows "Pending Credentials"
- **Problem**: Header status badge displays yellow "Pending Credentials" and outbound messages fail.
- **Cause**: Meta Embedded Signup was not completed or the System User Token expired.
- **Solution**: Open `/whatsapp/accounts`, click **Meta Integrations & Signup**, and click **Reconnect WhatsApp Number** to re-authorize your Meta Business Portfolio.

### Scenario 3: Messages Reject Outside the 24-Hour Window
- **Problem**: Message delivery fails with Meta Error 131047: "Re-engagement message requires template".
- **Cause**: Customer has not messaged your number in over 24 hours. Meta policy prohibits free-form text.
- **Solution**: Click **Send Template** in the chat window and select an approved `UTILITY` or `MARKETING` template.

### Scenario 4: Broadcast Campaign Fails Immediately
- **Problem**: Campaign status immediately transitions to `FAILED`.
- **Cause**: Selected template is pending approval, or prepaid wallet balance is exhausted.
- **Solution**: Check `/whatsapp/templates` to ensure template status is `APPROVED`. Check `/whatsapp/billing` and top up your message credit wallet.

### Scenario 5: Access Code Fails During Employee Activation
- **Problem**: Employee enters code on `/signup` and receives "Invalid access code."
- **Cause**: Code was mistyped, already redeemed, or expired.
- **Solution**: Administrator should open `/whatsapp/employees`, locate the employee, and click **Regenerate Access Code**.

---

## PART 14: Glossary & Technical Reference

- **Cloud API**: Official Meta REST Graph API connecting business applications directly to WhatsApp servers without local gateway hardware.
- **WABA (WhatsApp Business Account)**: The Meta Business Manager container that owns business phone numbers, templates, credit lines, and webhook configurations.
- **Embedded Signup**: The official Meta popup onboarding flow allowing customers to connect their WhatsApp numbers to Madhura in under 2 minutes.
- **HSM (Highly Structured Message) Template**: Pre-approved message format required for proactive business-initiated messaging outside the 24-hour service window.
- **24-Hour Service Window**: Rolling 24-hour period triggered whenever a customer messages your business, during which free-form messaging is permitted.
- **Quality Rating**: A rolling rating (`High / Green`, `Medium / Yellow`, `Low / Red`) assigned by Meta reflecting customer spam reports and block rates.
- **Messaging Limit Tier**: Daily cap on unique recipients: Tier 250 (250/day), Tier 1K (1,000/day), Tier 10K (10,000/day), Tier 100K (100,000/day), or Unlimited.
- **Rate Card**: Meta's country-specific per-message pricing schedule categorizing charges into Marketing, Utility, Authentication, and Service conversations.
- **Webhook**: Real-time HTTP POST callback sent by Meta to Madhura notifying the server of incoming messages, delivery receipts, and template approval decisions.
- **Baileys Engine**: Alternative web-based multi-device socket connection allowing WhatsApp Web QR scanning for regional low-volume operations.
- **Multi-Tenant**: Architectural model where multiple client organizations share the same software application while their data remains completely isolated.
