# Meta Tech Provider Sample: Authoritative Technical Audit
## Reference Implementation: `fbsamples/business-messaging-sample-tech-provider-app`

### 1. Executive Summary

Meta Platforms provides an official reference application (`business-messaging-sample-tech-provider-app`, MIT License) demonstrating the core technical requirements for an approved WhatsApp Tech Provider. It illustrates the real WhatsApp Business Platform API interactions, Embedded Signup flow, asset management, and webhook events.

While the Meta sample is an invaluable protocol blueprint, it is designed as a single-tenant demonstration built on Next.js 15, Auth0, Neon/Postgres, and Ably. Transforming it into Madhura's enterprise-grade WhatsApp Business SaaS (comparable to WATI and AiSensy) requires adopting its protocol mechanics while replacing its storage, identity, and transport layers with Madhura's multi-tenant Node.js, MySQL, Redis, and Socket.IO infrastructure.

---

### 2. Comprehensive File-by-File Audit

#### 2.1 `app/api/beUtils.ts` (Core Meta Graph API Engine)
* **Lines 44-54 (`getToken`)**:
  - Executes server-side OAuth exchange: `GET /oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${fbAppSecret}&code=${code}`.
  - Returns the System User / User Access Token with requested scopes.
* **Lines 56-63 (`subscribeWebhook`)**:
  - Subscribes the customer WABA to the Tech Provider app: `POST /{wabaId}/subscribed_apps`.
  - Mandatory for routing inbound messages, status callbacks, and template updates to the provider.
* **Lines 65-180 (`saveTokens`, `saveWabaToken`, `savePageToken`, etc.)**:
  - Stores access tokens directly in database tables: `wabas`, `pages`, `ad_accounts`, `datasets`, `catalogs`, `instagram_accounts`.
  - **Critical Flaw**: Tokens are stored in plain text with a simple `user_id` string without encryption or tenant scoping.
* **Lines 280-340 (`registerNumber`, `deregisterNumber`)**:
  - Number registration: `POST /{phoneNumberId}/register` with payload `{ messaging_product: 'whatsapp', pin: pin }`.
  - Number deregistration: `POST /{phoneNumberId}/deregister`.
  - Required for activating numbers after Embedded Signup.
* **Lines 350-410 (`requestCode`, `verifyCode`)**:
  - Requests 2-step verification code: `POST /{phoneNumberId}/request_code` with `code_method: 'SMS' | 'VOICE'` and `language: 'en_US'`.
  - Verifies code: `POST /{phoneNumberId}/verify_code` with `{ code: code }`.
* **Lines 430-510 (`send`)**:
  - Direct message dispatch: `POST /{phoneNumberId}/messages` with `{ messaging_product: 'whatsapp', to, type: 'text', text: { body } }`.
* **Lines 520-560 (`getAckBotStatus`, `getAckBotMessage`)**:
  - Checks if automatic acknowledgement responder (AckBot) is enabled on a receiving phone number and retrieves the auto-reply message template.

#### 2.2 `app/api/token/route.ts` (Embedded Signup Token Exchange)
* **Lines 12-43**:
  - Receives payload from Facebook Login for Business popup containing: `code`, `waba_id`, `waba_ids`, `business_id`, `page_ids`, `ad_account_ids`, `dataset_ids`, `catalog_ids`, `instagram_account_ids`, and onboarding option flags (`es_option_reg`, `es_option_sub`, `es_option_calling`).
* **Lines 55-89**:
  - Calls `getToken(code, appId)`.
  - Atomically runs:
    1. `saveTokens`: Saves token for all discovered assets.
    2. `registerNumber`: Registers phone number if selected.
    3. `subscribeWebhook`: Subscribes WABA to webhooks if selected.
    4. `enableCalling`: Configures Calling API if selected.

#### 2.3 `app/api/webhooks/route.ts` (Webhook Verification & Ingestion)
* **Lines 19-29 (GET Verification)**:
  - Handles Meta webhook challenge verification: verifies `hub.mode === 'subscribe'` and `hub.verify_token === fbVerifyToken`, returning `hub.challenge`.
* **Lines 31-48 (POST Signature Check)**:
  - Reads `x-hub-signature-256`. Computes HMAC-SHA256 over raw request body using `fbAppSecret`.
  - Compares with `crypto.timingSafeEqual`.
  - **Security Gap**: If `fbAppSecret` is undefined or blank, the check is skipped and unsigned webhooks are accepted.
* **Lines 50-60 (Real-Time Broadcasting)**:
  - Connects to Ably channel `get-started` and publishes the raw event payload.
* **Lines 61-120 (Event Handlers)**:
  - Message events (`field === 'messages'`): Parses messages, statuses (`sent`, `delivered`, `read`), and triggers AckBot auto-responder if enabled.
  - Calling events (`field === 'calls'`): Extracts `call.event` (`connect`, `terminate`, `failed`), caller number, SDP session parameters, and call statuses (`ringing`, `accepted`, `completed`, `failed`).

#### 2.4 `app/components/Fbl4bLauncher.tsx` (Facebook Login for Business Client)
* Initialises Facebook JavaScript SDK (`FB.init`).
* Invokes `FB.login` with `config_id` (Embedded Signup configuration) and `response_type: 'code'`.
* Listens to `window.addEventListener('message')` for `session_response` and `wa_embedded_signup` events from Meta's popup.
* Posts captured authorization code and asset IDs to `/api/token`.

---

### 3. Gap Analysis: Meta Reference Sample vs. Madhura Production SaaS

| Architecture Dimension | Meta Sample Implementation | Madhura Enterprise Production Target |
| :--- | :--- | :--- |
| **Tenancy & Isolation** | Single-user string (`user_id = user.email`) | Strict Multi-Tenant isolation (`tenant_id`, `branch_id`, role scopes) |
| **Token Storage** | Plain-text in Postgres table | AES-256-GCM authenticated encryption at rest |
| **Database Engine** | Vercel Postgres / Neon SQL template | Robust MySQL connection pool with schema migrations |
| **Realtime Engine** | Third-party paid cloud service (Ably) | High-performance native Socket.IO with tenant room partitioning |
| **Webhook Security** | Accepts unsigned requests when secret missing | Mandatory raw-body HMAC-SHA256 validation; rejects untrusted requests |
| **Webhook Ingestion** | Synchronous database writes & Ably calls in request | Fast 200 OK ACK (<500ms) with durable logging & background processing |
| **Sender Management** | Flat table of phone IDs | Full sender registry (`wa_senders`) with throughput levels and branches |
| **Calling API** | Raw SDP logging to Ably | Ingested to CRM timeline and real-time agent call state notifications |
| **CRM Integration** | None (demo inbox only) | Full Customer 360, lead capture, deal pipeline, and audit logging |
| **Automation & Campaigns** | Static AckBot only | Flowbot visual chatbot, drip campaigns, broadcast engine, and AI agents |
| **SaaS Monetisation** | No billing or plan awareness | Subscription plans, Razorpay payments, wallet ledgers, and usage meters |

---

### 4. Implementation Directives for Madhura

1. **Adopt Proven Meta Patterns**:
   - Reuse the exact OAuth code exchange parameters from `beUtils.ts`.
   - Maintain the WABA webhook subscription call: `POST /{wabaId}/subscribed_apps`.
   - Adopt the 6-digit PIN registration (`POST /{phoneNumberId}/register`) and deregistration endpoints.
   - Mirror the SMS/Voice verification code endpoints (`request_code` and `verify_code`).
   - Implement the WhatsApp Calling event schema in webhook routing.

2. **Reject Insecure & Non-Scalable Patterns**:
   - Never store raw access tokens in plain text. Always encrypt with AES-256-GCM before writing to `wa_senders` or `waba_connections`.
   - Never accept unverified webhook signatures. In production, missing or mismatched signatures must return 401/403.
   - Never tie WABAs to an email string. Link all assets to `tenant_id` and authorized `organization_memberships`.
