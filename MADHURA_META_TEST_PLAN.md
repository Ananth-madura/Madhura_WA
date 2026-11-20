# Madhura Enterprise WhatsApp Tech Provider: Verification & Test Plan

### 1. Overview and Objectives

This test plan defines the automated, unit, integration, and security verification procedures required to guarantee that Madhura operates reliably as an approved Meta WhatsApp Tech Provider and multi-tenant SaaS platform.

All test suites run in continuous integration and local development environments without requiring live external network dependencies by using verified mock Graph API adapters alongside live test suites.

---

### 2. Comprehensive Test Matrix

#### Suite 1: Embedded Signup and Token Vault
* **Test 1.1: Single WABA Onboarding**:
  - Input: Valid authorization code, single WABA ID, and business portfolio ID.
  - Assertion: Generates valid OAuth exchange request, encrypts token with AES-256-GCM, stores records in `waba_connections`, and automatically triggers `POST /{waba_id}/subscribed_apps`.
* **Test 1.2: Multi-WABA Onboarding**:
  - Input: Authorization code with array of 3 WABA IDs (`waba_ids: ["waba_1", "waba_2", "waba_3"]`).
  - Assertion: Creates 3 distinct WABA records scoped to the tenant, registers all discovered phone numbers, and subscribes each WABA to webhooks.
* **Test 1.3: Invalid OAuth Code / Rejection Handling**:
  - Input: Expired or malformed code.
  - Assertion: Gracefully catches Meta error response, returns structured JSON `{ success: false, error: "..." }`, and does not persist invalid records.
* **Test 1.4: Token Encryption Verification**:
  - Inspection: Query database directly for saved `access_token`.
  - Assertion: Matches pattern `enc:gcm:<iv>:<tag>:<ciphertext>`; raw token never appears in database rows.

#### Suite 2: Webhook Gateway, Signatures, and Ingestion
* **Test 2.1: Valid HMAC-SHA256 Signature Verification**:
  - Input: POST request with header `x-hub-signature-256: sha256=<valid_hmac>` and valid JSON payload.
  - Assertion: Returns HTTP 200 within 200ms; persists event to `meta_webhook_logs`.
* **Test 2.2: Tampered Payload Rejection**:
  - Input: Modified request body with mismatched HMAC signature.
  - Assertion: Returns HTTP 401 Unauthorized in production mode; rejects ingestion.
* **Test 2.3: Missing Signature Rejection**:
  - Input: Unsigned POST payload in production mode.
  - Assertion: Rejects request; logs unauthorized attempt.
* **Test 2.4: Idempotent Event Deduplication**:
  - Input: Two identical webhook payloads delivering the same message `wamid`.
  - Assertion: First payload processed and logged; second payload acknowledged with 200 OK without creating duplicate CRM inbox messages.

#### Suite 3: Phone Registration and Two-Step PIN Tools
* **Test 3.1: 6-Digit PIN Registration**:
  - Action: Execute `POST /api/platform/meta-tech-provider/phone/register` with `{ sender_id, pin: "123456" }`.
  - Assertion: Dispatches `POST /{phone_number_id}/register` with `{ messaging_product: "whatsapp", pin: "123456" }`; updates `registration_pin` and sets `status = "ACTIVE"`.
* **Test 3.2: Phone Deregistration**:
  - Action: Execute `POST /api/platform/meta-tech-provider/phone/deregister` with `{ sender_id }`.
  - Assertion: Dispatches `POST /{phone_number_id}/deregister`; updates `status = "DISCONNECTED"`.
* **Test 3.3: Verification Code Request (SMS / Voice)**:
  - Action: Execute `POST /api/platform/meta-tech-provider/phone/request-code` with `{ codeMethod: "SMS" }`.
  - Assertion: Calls Graph API `request_code` and records submission in audit log.
* **Test 3.4: Verification Code Validation**:
  - Action: Execute `POST /api/platform/meta-tech-provider/phone/verify-code` with `{ code: "654321" }`.
  - Assertion: Submits code to Meta; marks number verification status as `VERIFIED`.

#### Suite 4: Inbound Messaging and AckBot Auto-Responder
* **Test 4.1: Live Inbound Message Ingestion**:
  - Input: Webhook payload containing user message from `+919876543210`.
  - Assertion: Ingests message into `conversations` and `wa_message_logs`; emits Socket.IO event to tenant room.
* **Test 4.2: AckBot Automatic Response (Enabled)**:
  - Setup: Receiving sender configured with `is_ack_bot_enabled = 1` and `ack_bot_message = "Thank you for contacting us!"`.
  - Input: Inbound user message.
  - Assertion: Triggers automated dispatch of the configured greeting message back to the sender.
* **Test 4.3: AckBot Suppression (Disabled)**:
  - Setup: Receiving sender configured with `is_ack_bot_enabled = 0`.
  - Input: Inbound user message.
  - Assertion: Message logged to inbox; zero automated messages dispatched.

#### Suite 5: WhatsApp Calling Events and Extended Assets
* **Test 5.1: WhatsApp Calling Event Ingestion**:
  - Input: Webhook payload with `field === 'calls'` and call statuses (`ringing`, `accepted`, `completed`).
  - Assertion: Event logged to `meta_webhook_logs` under category `CALLING`; dispatches real-time call notice to active agents.
* **Test 5.2: Extended Asset Discovery**:
  - Action: Execute asset discovery for connected Business Portfolio.
  - Assertion: Discovers and saves Facebook Pages, Meta Catalogs, Ad Accounts, Datasets, and Instagram Business Accounts into `meta_tech_provider_assets`.

#### Suite 6: Multi-Tenant Boundary Enforcement
* **Test 6.1: Cross-Tenant Sender Modification**:
  - Action: Tenant B user attempts to modify or deregister Tenant A's sender.
  - Assertion: Returns HTTP 404 / 403; operation denied.
* **Test 6.2: Unauthenticated Access Gating**:
  - Action: Request `/api/platform/meta-tech-provider/*` without a valid JWT / cookie session.
  - Assertion: Returns HTTP 401 Unauthorized.

---

### 3. Execution Commands

1. **Compliance & Tech Provider Test Suite**:
   ```bash
   node backend/tests/test_meta_tech_provider_compliance.js
   ```
2. **Full Shared Core Test Suite**:
   ```bash
   node backend/scripts/verify-shared-core.js
   ```
3. **Frontend Auth & Navigation Test Suite**:
   ```bash
   cd frontend
   npm test -- --watchAll=false src/auth/login.test.jsx src/auth/signup.test.jsx src/components/WhatsAppNav.test.jsx
   ```
