# NATIVE INTEGRATIONS & WEBHOOK PLATFORM SPECIFICATION
## Shopify, WooCommerce, Razorpay & Custom External APIs

---

### 1. Integration Registry Architecture

All external integrations are configured per-tenant in `tenant_crm_webhooks` and `meta_connections`:
- Credentials are encrypted at rest using AES-256.
- Raw webhook payloads are logged in `tenant_crm_webhook_deliveries` for audit and replay.
- Inbound webhooks require valid HMAC signatures.

---

### 2. Supported Integrations

#### 2.1 Razorpay Payment Gateway
- **Primary Service**: `backend/services/razorpayClient.js`
- **Supported Workflows**:
  - Direct Checkout Order Generation (`POST /api/wa/payments/create-order`).
  - WhatsApp Payment Link Dispatch: Sends automated payment links with amounts, invoice IDs, and expiry times.
  - Webhook Ingestion (`payment.captured`, `payment.failed`):
    - Validates signature via `RAZORPAY_WEBHOOK_SECRET`.
    - Updates `wa_payments` table.
    - Transitions deal stage to `won` or creates order receipt in `wa_crm_orders`.
    - Dispatches instant WhatsApp confirmation template with receipt PDF.

#### 2.2 Shopify Integration
- **Supported Workflows**:
  - `orders/create`: Captures customer phone and order details, creates/updates `wa_contacts`, and triggers an order confirmation WhatsApp template.
  - `orders/fulfilled`: Captures tracking carrier and number, sends shipping notification template.
  - `checkouts/abandoned`: After configured delay (e.g., 2 hours), triggers an abandoned cart recovery sequence.

#### 2.3 WooCommerce Integration
- **Supported Workflows**:
  - REST Webhooks: `order.created`, `order.updated`, `customer.created`.
  - Secure verification using WooCommerce Webhook Secret (`X-WC-Webhook-Signature`).
  - Auto-syncs customers and order totals into the CRM customer profile.

#### 2.4 Custom REST Webhooks & External CRM Bridge
- **Primary Service**: `backend/services/crmWebhookForwarder.js` and `backend/services/crmEventBus.js`
- **Inbound Webhook Forwarding**:
  - Receives lead data from landing pages, Facebook Lead Ads, or legacy CRMs.
  - Normalizes fields to `name`, `phone`, `email`, `source`, `custom_fields`.
  - Automatically identifies or creates contact and triggers assignment rules.
- **Outbound Webhook Dispatch**:
  - Workflows can trigger external POST/PUT requests with custom headers, HMAC authentication, and payload transformation templates.
  - Supports automated retries (exponential backoff: 1s, 5s, 30s) on network failures.
