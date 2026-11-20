# Madhura Enterprise WhatsApp Tech Provider: Integration Plan

### 1. Architectural Blueprint

The integration bridges Meta's WhatsApp Business Cloud API with Madhura's multi-tenant enterprise CRM. The architecture guarantees high-throughput message processing, strict tenant data isolation, and comprehensive compliance with Meta's Tech Provider requirements.

```
+-----------------------------------------------------------------------------------+
|                            Meta WhatsApp Ecosystem                                |
|  [Embedded Signup / FBL4B]   [WhatsApp Cloud API]   [Meta Webhook Dispatcher]     |
+-----------------------------------------------------------------------------------+
                                   |                       |
                 (1) OAuth Code    |                       | (2) Raw Event Stream
                 & Asset Discovery |                       |     (HMAC-SHA256)
                                   v                       v
+-----------------------------------------------------------------------------------+
|                        Madhura Tech Provider Gateway                              |
|                                                                                   |
|  +---------------------------+       +-----------------------------------------+  |
|  |     OAuth Token Vault     |       |       Webhook Ingestion Engine          |  |
|  |  AES-256-GCM Encryption   |       |  - Raw-Body HMAC-SHA256 Verification    |  |
|  |  WABA & Phone Discovery   |       |  - Fast 200 OK Response (<500ms)        |  |
|  |  6-Digit PIN Registration |       |  - Durable Logging (meta_webhook_logs)  |  |
|  |  Subscribed Apps (Meta)   |       |  - Idempotent Deduplication (wamids)    |  |
|  +---------------------------+       +-----------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                   |                       |
                     Tenant Scoped |                       | Dispatched Events
                     Credentials   |                       | (BullMQ / In-Memory)
                                   v                       v
+-----------------------------------------------------------------------------------+
|                        Madhura Core Business SaaS                                 |
|                                                                                   |
|  +---------------------------+  +---------------------+  +---------------------+  |
|  |    Tenant & Multi-Branch  |  |  Real-Time Engine   |  |     Automation      |  |
|  |   - Multi-Tenant DB       |  |  - Socket.IO Server |  |  - AckBot Responder |  |
|  |   - Branch Sender Routing |  |  - Shared Team Inbox|  |  - Flowbot Engine   |  |
|  |   - Asset Scoping         |  |  - Agent Assignment |  |  - Broadcast Engine |  |
|  +---------------------------+  +---------------------+  +---------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     Compliance & Monetisation Layer                         |  |
|  |   - Meta Tech Provider Compliance Center (/platform/meta-tech-provider)     |  |
|  |   - SaaS Subscription Plans, Wallet Accounting & Razorpay Settlement       |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

### 2. Tenant and Asset Hierarchy

In Madhura, assets are structured to support enterprise multi-branch, multi-location, and franchise operations:

1. **Organization (Tenant)**:
   - Root corporate identity (`tenants` table) holding the business subscription and master billing ledger.
2. **Branches / Workspaces**:
   - Regional offices or department units (`branches` table) under the organization.
3. **WABA Connections**:
   - Authorized WhatsApp Business Accounts (`waba_connections` table) linked to the tenant with encrypted access tokens and portfolio IDs.
4. **WhatsApp Senders (Phone Numbers)**:
   - Verified senders (`wa_senders` table) attached to specific branches, carrying:
     - Phone Number ID, Display Phone Number, and Verified Name.
     - 6-digit registration PIN (`registration_pin`).
     - Two-step verification and registration state.
     - AckBot configuration (`is_ack_bot_enabled`, `ack_bot_message`).
     - Real-time quality rating and throughput tier.
5. **Discovered Meta Business Assets**:
   - Extended marketing and commerce assets (`meta_tech_provider_assets` table) discovered during Embedded Signup:
     - Facebook Pages (for Click-to-WhatsApp ads).
     - Meta Catalogs (for product catalog messaging).
     - Ad Accounts (for ad attribution).
     - Meta Datasets / Pixels (for conversion tracking).
     - Instagram Business Accounts (for multi-channel inbox routing).

---

### 3. Core Implementation Modules

#### 3.1 Embedded Signup & Token Vault Module
* **Path**: `backend/services/metaTechProviderService.js` and `backend/routes/platformMetaTechProviderRoutes.js`.
* **Workflow**:
  1. Frontend launches official Meta Embedded Signup popup via `window.FB.login` using configuration ID `1189434863378370`.
  2. Receives authorization code and asset IDs (`waba_ids`, `page_ids`, `catalog_ids`).
  3. Server exchanges code for permanent system user access token using Graph API `GET /oauth/access_token`.
  4. Encrypts token using AES-256-GCM with tenant-scoped encryption keys and stores in database.
  5. Automatically executes WABA webhook subscription: `POST /{wabaId}/subscribed_apps`.
  6. Discovers all phone numbers under the WABA and registers them into `wa_senders`.

#### 3.2 Phone Registration & Verification Tooling
* **Endpoints**:
  - `POST /api/platform/meta-tech-provider/phone/register`: Submits 6-digit PIN to `POST /{phone_number_id}/register`.
  - `POST /api/platform/meta-tech-provider/phone/deregister`: Calls `POST /{phone_number_id}/deregister`.
  - `POST /api/platform/meta-tech-provider/phone/request-code`: Triggers SMS or Voice OTP dispatch.
  - `POST /api/platform/meta-tech-provider/phone/verify-code`: Validates received 6-digit OTP with Meta.

#### 3.3 High-Performance Webhook Gateway
* **Path**: `backend/routes/metaCampaignWebhookRoutes.js`.
* **Execution Contract**:
  1. **Strict Verification**: Validates `x-hub-signature-256` HMAC-SHA256 signature against the app secret using raw request payload.
  2. **Fast Acknowledgement**: Returns HTTP 200 OK immediately (<500ms) to satisfy Meta delivery latency criteria.
  3. **Durable Logging**: Logs raw payload to `meta_webhook_logs` table for compliance auditing and live streaming.
  4. **Deduplication**: Checks message ID (`wamid`) against indexed message logs to prevent duplicate processing.
  5. **Tenant Routing**: Resolves receiving `phone_number_id` or `waba_id` to determine tenant, branch, and assigned staff.
  6. **AckBot Execution**: If AckBot is enabled on the receiving sender, automatically dispatches configured auto-reply.
  7. **Calling API Handling**: If change field is `calls`, routes call status (`ringing`, `accepted`, `completed`) to real-time agent sockets.

#### 3.4 Platform Administration Module
* **Route**: `/platform/meta-tech-provider`.
* **Compliance Checklist Tracking**:
  - Stage 1: Meta Business Verification.
  - Stage 2: Meta App Configuration.
  - Stage 3: App Review and Permissions.
  - Stage 4: Video Evidence Submissions.
  - Stage 5: Embedded Signup Readiness.
  - Stage 6: Provider Readiness.
* **Operational Consoles**:
  - Live Webhook Stream Viewer with search, category filtering, and JSON inspector.
  - Phone Registration & Two-Step PIN Management modal.
  - Extended Meta Assets Explorer.

---

### 4. Implementation Phasing & Milestones

1. **Phase 1: Database Migration & Schema Foundations (Completed)**:
   - Tables: `meta_tech_provider_compliance`, `meta_webhook_logs`, `meta_tech_provider_assets`.
   - Columns: `is_ack_bot_enabled`, `ack_bot_message`, `registration_pin` in `wa_senders`.
2. **Phase 2: Service Layer & Graph API Parity (Completed)**:
   - Full implementation of `metaTechProviderService.js` and `platformMetaTechProviderRoutes.js`.
   - Comprehensive test suite passing 100%.
3. **Phase 3: Webhook Routing, Deduplication & AckBot (Completed)**:
   - Signature verification, live webhook streaming, and AckBot auto-responder in `metaCampaignWebhookRoutes.js`.
4. **Phase 4: Frontend UI/UX & Compliance Dashboard (Completed)**:
   - Interactive Compliance Center at `/platform/meta-tech-provider`.
   - Fully accessible Login and Signup pages adhering to antislop rules.
5. **Phase 5: Production Hardening & Security Audit (Current)**:
   - Token encryption verification, OAuth state validation, and test plan execution.
