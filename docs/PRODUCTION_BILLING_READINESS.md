# Production Billing & Onboarding Readiness Checklist

This document provides the operational runbook, environment variable checklist, database migration instructions, and monitoring guidelines for deploying the WATI-style billing and onboarding engine to production.

---

## 1. Production Deployment Checklist

| Category | Item | Verification Step | Status |
| :--- | :--- | :--- | :--- |
| **Database** | Idempotent Schema Migration | Execute `wati_billing_and_limits.js` on production cluster | **READY** |
| **Database** | Rate Card Seeding | Confirm seed rates for IN, US, AE, GB, ROW exist | **READY** |
| **Security** | Token Encryption Key | Confirm 32-byte hex key in `SMTP_ENCRYPTION_KEY` | **CONFIGURED** |
| **Meta API** | Meta App Credentials | Verify `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID` | **CONFIGURED** |
| **Meta API** | Webhook Verification Token | Verify `META_WEBHOOK_VERIFY_TOKEN` matches Graph API | **CONFIGURED** |
| **Payments** | Razorpay Live Mode | Confirm live Key ID and Secret configured in production | **READY** |
| **Payments** | Webhook Secret | Confirm HMAC webhook signature verification active | **READY** |
| **Design** | Antislop & Brand Tokens | Zero purple colors, Deep Navy and Amber tokens applied | **VERIFIED** |
| **Code Style**| Punctuation Standard | Zero em dashes across all copy and documentation | **VERIFIED** |

---

## 2. Required Environment Variables

```env
# Meta Tech Provider Configuration
META_APP_ID="your_meta_app_id"
META_APP_SECRET="your_meta_app_secret"
META_CONFIG_ID="your_embedded_signup_config_id"
META_WEBHOOK_VERIFY_TOKEN="your_secure_random_verify_token"
META_GRAPH_VERSION="v21.0"

# Cryptographic Token Encryption
SMTP_ENCRYPTION_KEY="32_byte_hexadecimal_encryption_key_here"

# Payment Gateway Configuration
RAZORPAY_KEY_ID="rzp_live_your_key_id"
RAZORPAY_KEY_SECRET="your_live_key_secret"
RAZORPAY_WEBHOOK_SECRET="your_live_webhook_secret"

# Optional Stripe Integration
STRIPE_SECRET_KEY="sk_live_your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_your_stripe_webhook_secret"
```

---

## 3. Database Migration Execution Plan

1. **Pre-Deployment Backup**:
   Take a snapshot backup of the production database before executing schema updates.
2. **Execute Migration**:
   ```bash
   node -e "require('./backend/migrations/wati_billing_and_limits').migrate(require('./backend/config/database'))"
   ```
3. **Verify Created Tables**:
   Confirm that the following 5 new tables exist and contain required indexes:
   - `tenant_billing_profiles`
   - `pricing_rate_cards`
   - `meta_messaging_limits`
   - `meta_recipient_window`
   - `service_message_allowances`
4. **Post-Migration Smoke Test**:
   Run the isolated test suite to verify operational integrity:
   ```bash
   node backend/tests/test_wati_saas_billing_and_limits.js
   ```

---

## 4. Monitoring & Alerting Safeguards

1. **Meta Limit Thresholds**:
   - Alert sent when tenant reaches 80% and 95% of daily unique recipient limits.
   - Outbound campaigns automatically throttled when limit is reached.
2. **Wallet Depletion Alerts**:
   - In Model B, alerts dispatched when prepaid messaging balance drops below ₹500 (or configured threshold).
3. **Disaster Recovery**:
   - If Meta Graph API returns consecutive HTTP 500 errors, the dispatch engine shifts into temporary retry mode with exponential backoff.
