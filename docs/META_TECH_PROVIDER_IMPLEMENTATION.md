# Meta Tech Provider Implementation Guide

Madhura operates as an enterprise Meta Tech Provider, enabling multi-tenant SaaS onboarding, customer-owned asset governance, and WhatsApp Cloud API orchestration.

---

## 1. Meta Tech Provider Architecture

### 1.1 Tech Provider vs Solution Partner Distinction
Meta defines two primary commercial relationship models for WhatsApp Business Platform software:

1. **Tech Provider (Madhura's Default Architecture)**:
   - Onboards businesses via Meta Embedded Signup.
   - The customer retains legal ownership of their Meta Business Portfolio, WhatsApp Business Account (WABA), phone numbers, and payment arrangements.
   - Madhura receives a scoped System User Access Token to manage messaging, templates, phone numbers, and webhooks on the customer's behalf.
   - Meta bills the customer directly for WhatsApp Cloud API message usage. Madhura does not assume the financial liability of paying Meta's invoices for every tenant.

2. **Solution Partner (Credit Line / Provider-Managed)**:
   - Allows sharing an approved Meta Partner Credit Line with client accounts.
   - Madhura settles messaging invoices with Meta and debits a prepaid wallet or issues consolidated invoices to tenants.
   - Supported as Mode 2 in Madhura for select enterprise or agency partners.

```
+-------------------------------------------------------------------------+
|                  Madhura Multi-Tenant Platform Engine                  |
+-------------------------------------------------------------------------+
                                    |
      +-----------------------------+-----------------------------+
      | (Embedded Signup Dialog)                                  | (Cloud API v21.0)
      v                                                           v
+-------------------------------+               +-------------------------------+
|    Customer Meta Portfolio    |               |      Meta Cloud API Edge      |
|  - WABA Asset Ownership       |               |  - Phone Number 1 (Sales)     |
|  - Direct Meta Payment Method |               |  - Phone Number 2 (Support)   |
|  - Invoices to Customer       |               |  - Phone Number 3 (Marketing) |
+-------------------------------+               |  - Phone Number 4 (Billing)   |
                                                |  - Phone Number 5 (VIP)       |
                                                +-------------------------------+
```

---

## 2. Meta Embedded Signup Specification

### 2.1 Permission Scopes
The Embedded Signup flow requests only the minimal necessary permissions:
- `whatsapp_business_management`: Allows managing WABA assets, templates, and phone numbers.
- `whatsapp_business_messaging`: Allows dispatching messages and processing webhook events.

### 2.2 Server-Side Token Exchange & Encryption
1. The frontend Embedded Signup dialog issues a transient user access token.
2. The frontend sends this code to `POST /api/v2/meta/onboard/exchange`.
3. The server exchanges the code for a permanent System User Token via Graph API endpoint:
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={META_APP_ID}
     &client_secret={META_APP_SECRET}
     &fb_exchange_token={SHORT_LIVED_TOKEN}
   ```
4. The token is encrypted using AES-256-GCM before persistent storage in the database:
   - Cipher: `aes-256-gcm`
   - Key: 32-byte secret (`process.env.SMTP_ENCRYPTION_KEY`)
   - Storage format: `iv_hex:auth_tag_hex:ciphertext_hex`

---

## 3. Concurrent Multi-Number Management (5+ Phone Numbers)

### 3.1 Department and Queue Allocation
Each customer can register 5 or more phone numbers under their WABA. Madhura routes inbound and outbound traffic concurrently:
- Number 1: Primary Sales Desk (Branch Head Office)
- Number 2: Customer Support Desk (Tier 1 Support Queue)
- Number 3: Promotional & Marketing Broadcasts
- Number 4: Billing & Finance Notifications
- Number 5: VIP Key Accounts Desk

### 3.2 Shared WABA Limits Awareness
All phone numbers belonging to a WABA share the same underlying daily recipient messaging limit tier (e.g., TIER_250 or TIER_1K). Connecting 5 phone numbers does not provide 5 times the daily limit. The dispatch engine enforces this unified limit centrally.

---

## 4. Operational Best Practices

1. **Fail-Closed Secret Validation**: If the Meta App Secret or encryption key is missing, token exchange aborts immediately with explicit diagnostics.
2. **Webhook Idempotency**: Meta webhooks may deliver duplicate delivery receipts; Madhura stores idempotency locks on `wa_message_id`.
3. **Zero Purple Design**: All partner and connection UIs strictly adhere to Deep Navy (`#202C52`) and Madhura Amber (`#FCBD16`).
