# SECURITY AUDIT & HARDENING SPECIFICATION
## Madhura Multi-Tenant Enterprise Security

---

### 1. Threat Model & Security Controls

| Vulnerability Vector | Potential Risk | Implemented Defense Mechanism |
| :--- | :--- | :--- |
| **Cross-Tenant Data Access** | Customer A sees Customer B's chats or contacts | Parameterized SQL with mandatory `tenant_id` binding; JWT claims verification in middleware (`waContactTenancy.js`). |
| **Horizontal Privilege Escalation** | Agent modifies another team's conversation | Role and assignment policy (`rolePolicy.js`); permission checks on every write endpoint. |
| **Webhook Spoofing** | Attacker fakes delivery or payment events | Meta `X-Hub-Signature-256` and Razorpay `X-Razorpay-Signature` HMAC verification. |
| **SQL Injection** | Malicious input in search or filters | Prepared statements / parameterized queries across all MySQL and SQLite calls. |
| **SSRF (Server-Side Request Forgery)** | Malicious webhook URL targeting internal network | IP filtering and private subnet blocking in `backend/services/waSsrf.js`. |
| **Token Exposure** | Leaked Meta API keys or integration secrets | AES-256 encryption at rest; redaction of secrets in server logs. |
| **Replay Attacks** | Duplicate webhook processing | Unique message ID deduplication via `wa_webhook_claims` and `wa_message_logs`. |

---

### 2. Encryption Standards
- **In Transit**: HTTPS (TLS 1.3) with HSTS headers.
- **At Rest**: AES-256 encryption (`backend/services/waEncryption.js`) for customer Meta access tokens, Razorpay secrets, and email SMTP passwords.
- **Passwords**: Salted bcrypt hashing (10 rounds).

---

### 3. Rate Limiting & Denial of Service Protection
- API endpoints protected by `express-rate-limit`:
  - `messageSendLimiter`: Prevents rapid burst spamming.
  - `qrRefreshLimiter`: Prevents resource exhaustion from rapid QR polling.
  - `sessionResetThrottle`: Enforces minimum cooldown between engine resets.

---

### 4. Audit & Compliance
- **Audit Logging**: `wa_workspace_audit` records all administrative actions with actor ID, IP address, and timestamp.
- **Opt-Out & Privacy**: Explicit unsubscribes (`wa_opt_outs`) suppress future broadcast sends automatically, complying with Meta WhatsApp Business Policies and GDPR.
