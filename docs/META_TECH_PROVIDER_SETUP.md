# Meta Tech Provider Setup Specification

## Overview

Madhura operates as an authorized Meta Tech Provider enabling multi-tenant WhatsApp Business Platform onboarding via Facebook Login for Business and Embedded Signup v4.

---

## 1. Meta Developer App Configuration

- **Meta App Type:** Business
- **Meta App ID:** `780961714856006`
- **Embedded Signup Configuration ID:** `1189434863378370`
- **Graph API Target Version:** `v21.0`

### Required Scopes and Permissions
1. `whatsapp_business_messaging`: Enables sending and receiving real-time customer messages and media.
2. `whatsapp_business_management`: Enables querying WABAs, phone numbers, quality ratings, and webhook subscriptions.
3. `business_management`: Allows discovering Business Portfolios and system users.

---

## 2. Tech Provider Partnership Model

Under the Tech Provider model:
- The customer retains legal ownership of their Meta Business Portfolio and phone numbers.
- Madhura receives delegated access via short-lived authorization codes exchanged server-side for permanent System User Tokens.
- Phone number verification is handled exclusively within Meta's embedded dialog, ensuring customer verification codes are never intercepted or stored on third-party servers.

---

## 3. Webhook Architecture

- **Public Callback URL:** `https://api.madhuratech.in/webhook`
- **Verify Token:** `madhura_wa_verify_2026`
- **Verification Signature:** Validated via HMAC-SHA256 (`x-hub-signature-256`) using the Meta App Secret.
- **Subscribed Fields:**
  - `messages`
  - `messaging_postbacks`
  - `message_template_status_update`
  - `phone_number_quality_update`
