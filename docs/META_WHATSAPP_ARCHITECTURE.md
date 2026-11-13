# Madhura WhatsApp — Meta Multi-Account & Concurrent Multi-Number SaaS Architecture

## 1. Overview & High-Level Architecture

Madhura Technologies WhatsApp SaaS (`https://live.wa.madhuratech.in/`) is a true multi-tenant WhatsApp Business platform. Every customer organization (tenant) independently connects their Meta account, authorizes Business Portfolios and WABAs, and connects 5 or more WhatsApp phone numbers to operate concurrently.

---

## 2. Multi-Tenant Asset Hierarchy

```
Customer Tenant (Organization)
 └── Meta Connection (User OAuth / Access Token)
      └── Meta Business Portfolio (Meta Business ID)
           └── WABA Connection (WhatsApp Business Account ID)
                ├── WhatsApp Sender 1: +91 98765 00001 (Support Desk)
                ├── WhatsApp Sender 2: +91 98765 00002 (Sales Team)
                ├── WhatsApp Sender 3: +91 98765 00003 (Operations)
                ├── WhatsApp Sender 4: +91 98765 00004 (North Branch)
                └── WhatsApp Sender 5: +91 98765 00005 (Billing & Alerts)
```

### Database Entities
- **`meta_connections`**: Stores the customer's Meta user ID, name, email, encrypted access token (AES-256-GCM), token expiration, and status.
- **`meta_business_portfolios`**: Stores business portfolio IDs and verification statuses.
- **`waba_connections`**: Stores WABA IDs, encrypted WABA tokens, currency, timezone, namespace, and rate limit tiers.
- **`wa_senders`**: Stores individual phone numbers, display names, verified names, quality ratings (GREEN/YELLOW/RED), messaging limit tiers (TIER_250, TIER_1K, TIER_10K, TIER_100K, UNLIMITED), code verification statuses, default sender flags, department names, and branch assignments.
- **`wa_sender_metrics`**: Stores hourly/daily throughput (`messages_sent`, `messages_delivered`, `messages_read`, `messages_failed`) per sender.

---

## 3. Real Facebook Login for Business & Embedded Signup Flow

1. **Frontend Initiation**:
   The customer clicks "Continue with Meta" in Settings -> Accounts & Multi-Sender Platform.
2. **SDK Pop-up**:
   `metaSignup.js` invokes `FB.login` with:
   - `config_id`: Meta Embedded Signup Configuration ID
   - `response_type`: `"code"`
   - `extras`: `{ "sessionInfoVersion": "3" }`
3. **Session Info Listener**:
   Catches `WA_EMBEDDED_SIGNUP` window event with `data.waba_id` and `data.phone_number_id`.
4. **Backend Code Exchange**:
   `POST /api/v2/meta/onboard/exchange` exchanges the authorization code for a system user / access token via Meta Graph API `oauth/access_token`.
5. **Asset Discovery**:
   `POST /api/v2/meta/assets/discover` queries `me/businesses`, client WABAs, and `/{waba_id}/phone_numbers`, returning all portfolios and phone numbers.
6. **Concurrent Batch Connection**:
   `POST /api/v2/meta/senders/connect-batch` connects 1 to 5+ numbers under the tenant, registers WABA webhook subscriptions (`/{waba_id}/subscribed_apps`), and persists encrypted credentials.

---

## 4. Concurrent Messaging & Shared WABA Rate Limiting

### The WABA Concurrency Constraint
Under Meta's Cloud API architecture:
- Multiple phone numbers under the *same WABA* share that WABA's throughput limit (default 80 messages/second).
- Dispatching simultaneously on 5 phone numbers under the same WABA without rate control would result in Meta HTTP 429 `rate_limit_exceeded`.

### Solution: Two-Tier Rate Limiting
1. **WABA Token Bucket (`concurrentSenderEngine.js`)**:
   - Capacity: 80 tokens
   - Refill Rate: 80 tokens / second
   - Every sender under the WABA acquires a token before calling Meta Graph API.
2. **Sender In-Flight Concurrency Guard**:
   - Caps active concurrent HTTP connections per sender.
3. **Tenant Concurrency Isolation**:
   - Broadcast campaigns on Tenant A run through durable paced queues, ensuring Tenant B's real-time inbox chat and flow bots never experience latency or starvation.

---

## 5. Verified Multi-Tenant Inbound Webhooks

- Inbound Meta webhooks arrive at `/webhook` with `X-Hub-Signature-256`.
- `waWebhookAuth.js` resolves the account by `metadata.phone_number_id` (or `entry[].id` WABA ID) and verifies the HMAC-SHA256 signature using the account's specific `app_secret`.
- Delivery and Read status events (`handleStatusUpdate`) update `wa_message_logs` with real timestamps, increment `wa_sender_metrics`, and broadcast live status ticks to the agent workspace via Socket.io.
- Statuses are **never optimistic**: a message stays `sent` until the real delivery receipt is confirmed by Meta.

---

## 6. Real-Time Diagnostics & Operational Tools

- **Ping Check**: Live Meta Graph API latency test measuring round-trip response time and verifying token validity.
- **Test Message Dispatch**: Live WhatsApp message send returning the actual Meta `wamid`.
- **Quality & Tier Badges**: Real-time visualization of Meta quality ratings (GREEN/YELLOW/RED) and messaging tiers.

