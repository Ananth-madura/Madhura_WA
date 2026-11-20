# Madhura Enterprise WhatsApp Tech Provider: Security Audit

### 1. Security Scope and Threat Model

Operating as an enterprise Meta Tech Provider involves handling sensitive corporate WhatsApp Business Accounts, high volumes of customer messaging, and official Meta Graph API credentials. A failure in data isolation, token storage, or webhook signature verification could expose customer conversations or compromise Meta authorization tokens.

The threat model evaluates five primary attack surfaces:
1. **Access Token Interception & Storage Compromise**: Unauthorized exfiltration of customer or provider access tokens.
2. **Webhook Forgery & Spoofing**: Injection of counterfeit messages or status receipts to trick CRM pipelines.
3. **OAuth Cross-Tenant Hijacking (CSRF)**: Forcing an authorized administrator into linking their WABA to an attacker's workspace.
4. **Tenant Data Leakage**: Unsanitized multi-tenant queries or cross-branch data access.
5. **Credential Exposure in Client Bundles**: Accidentally leaking Meta App Secrets or System User tokens to browser JavaScript.

---

### 2. Critical Security Findings & Remediation

#### 2.1 Access Token Encryption at Rest
* **Sample Implementation Risk**:
  - In `beUtils.ts` (lines 74-97), access tokens are written directly to database columns in clear plain text:
    ```sql
    INSERT INTO wabas (user_id, app_id, waba_id, access_token, business_id) VALUES (...)
    ```
  - Any database snapshot or read-access breach exposes all connected client tokens.
* **Madhura Security Implementation**:
  - Customer access tokens are encrypted using **AES-256-GCM** authenticated symmetric encryption prior to persistence.
  - Encryption employs a cryptographically random 12-byte initialization vector (IV) per record and generates a 16-byte authentication tag.
  - Stored format: `enc:gcm:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
  - Master encryption keys are sourced from the server's isolated environment (`TOKEN_ENCRYPTION_SECRET` or `JWT_SECRET`), never stored in database tables.
  - Redaction: REST APIs returning sender or WABA details always redact tokens (`token: "enc:gcm:***"` or masked strings).

#### 2.2 Webhook Signature Enforcement
* **Sample Implementation Risk**:
  - In `app/api/webhooks/route.ts` (lines 35-48):
    ```typescript
    if (fbAppSecret) {
      // validates signature
    }
    const data = JSON.parse(rawBody); // Proceeds even if fbAppSecret is undefined!
    ```
  - If the environment variable `FB_APP_SECRET` is unset or blank, signature verification is silently bypassed, allowing arbitrary forged JSON payloads to be ingested.
* **Madhura Security Implementation**:
  - Production mode strictly rejects any request lacking a valid `x-hub-signature-256` header.
  - Verification parses the exact raw request bytes before JSON deserialization to prevent character encoding discrepancies:
    ```javascript
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
    ```
  - Uses `crypto.timingSafeEqual` to prevent timing attack side-channels.
  - Multi-Sender Aware: If individual WABAs or numbers use separate app secrets, Madhura resolves the recipient sender secret before validation.

#### 2.3 OAuth State and Session Correlation
* **Sample Implementation Risk**:
  - In `app/api/token/route.ts`, the server accepts `code`, `waba_id`, and `business_id` without verifying an OAuth `state` parameter linked to the active browser session.
  - Vulnerable to OAuth CSRF where an attacker tricks a victim into linking the attacker's WABA.
* **Madhura Security Implementation**:
  - Embedded Signup launches generate a cryptographically signed HMAC token containing `{ tenant_id, user_id, timestamp, nonce }`.
  - Upon receiving the callback, Madhura verifies that:
    1. The signature of the `state` matches the session.
    2. The session has not expired (maximum 15-minute validity window).
    3. The authorized user has `admin` role in the targeted tenant.
  - Discovered WABAs and phone numbers are verified via Graph API `/debug_token` to confirm that the asset ownership matches the authorized Business Portfolio.

#### 2.4 Browser Redaction and Zero Client Secret Exposure
* **Sample Implementation Risk**:
  - Sample uses Next.js server actions where private config can easily be leaked if improperly imported in client components.
* **Madhura Security Implementation**:
  - Strict boundary separation: Frontend never handles `client_secret`, system user tokens, or raw encryption keys.
  - Frontend only interacts with public configuration (`appId`, `configId`, redirect URIs).
  - All token exchange, registration PIN submission, and webhook registrations occur strictly server-side.

#### 2.5 Multi-Tenant Authorization and Scoped Access
* **Madhura Security Implementation**:
  - Every API endpoint under `/api/platform/meta-tech-provider` and `/api/meta` validates `organization_memberships`.
  - Non-admin users are strictly barred from viewing compliance checklists, raw webhook event streams, or modifying phone registration PINs.
  - Audit Logging: All sensitive actions (PIN registration, deregistration, code verification, AckBot modifications) create immutable audit logs in `branch_audit_events`.
