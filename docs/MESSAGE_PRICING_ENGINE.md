# Meta WhatsApp Message Pricing Engine

This document specifies the rate card resolution, country-aware pricing calculations, October 1, 2026 free allowance tracking, and the reservation-settlement lifecycle.

---

## 1. Rate Card Architecture

All monetary amounts are strictly maintained as **integer minor units** (paise for INR, cents for USD) to prevent floating-point rounding errors.

### 1.1 Category Matrix & Effective Rates (INR Minor Units / Paise)
Rates sourced from Meta Published Rate Cards:

| Country Code | Country Name | Marketing (Paise) | Utility (Paise) | Authentication (Paise) | Service (Paise) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **IN** | India | 78 (₹0.78) | 31 (₹0.31) | 15 (₹0.15) | 29 (₹0.29) |
| **US** | United States / Canada | 250 (₹2.50) | 150 (₹1.50) | 120 (₹1.20) | 80 (₹0.80) |
| **AE** | United Arab Emirates | 320 (₹3.20) | 180 (₹1.80) | 140 (₹1.40) | 110 (₹1.10) |
| **GB** | United Kingdom | 410 (₹4.10) | 220 (₹2.20) | 180 (₹1.80) | 140 (₹1.40) |
| **ROW** | Rest of World (Default) | 350 (₹3.50) | 200 (₹2.00) | 150 (₹1.50) | 120 (₹1.20) |

---

## 2. Dynamic Country Resolution

The pricing engine inspects the destination E.164 phone number prefix:
- `+91...` (12+ digits) -> India (`IN`)
- `+1...` (11 digits) -> United States (`US`)
- `+971...` -> United Arab Emirates (`AE`)
- `+44...` -> United Kingdom (`GB`)
- `+55...` -> Brazil (`BR`)
- `+62...` -> Indonesia (`ID`)
- All other prefixes fall back safely to `ROW`.

---

## 3. October 1, 2026 Meta Policy: Free Service Conversations

### 3.1 Policy Rule
> **Each calendar month, the first 1,000 service messages / service conversations per business phone number are 100% free of charge.**
> From the 1,001st service message onward in that month, standard service message rates apply.

### 3.2 Database Tracking
Tracking is maintained in `service_message_allowances` partitioned by:
`tenant_id`, `phone_number_id`, and `billing_month` (YYYY-MM).
```sql
SELECT used_service_messages, free_allowance_limit
FROM service_message_allowances
WHERE tenant_id = ? AND phone_number_id = ? AND billing_month = ?;
```
If `used_service_messages < 1000`, the calculation yields:
- `rate_minor = 0`
- `is_free_allowance = 1`
- `base_rate_minor = 29` (for transparency)

---

## 4. Message Billing Lifecycle

The lifecycle spans three atomic phases:

```
[Outbound Dispatch]
        |
        v
[Phase 1: Reserve]
  - Create message_billing_records (status = 'reserved')
  - In Mode 2: Verify wallet balance >= rate_minor, place temporary hold
        |
        +-----------------------------------+
        |                                   |
(Webhook: delivered)                (Webhook: failed / rejected)
        |                                   |
        v                                   v
[Phase 2: Delivery Settlement]      [Phase 3: Failure Release]
  - Status = 'delivered'             - Status = 'failed'
  - Finalize ledger debit            - Release reservation hold
  - Increment service allowance      - Customer is not charged
```

### 4.1 Idempotent Settlement
Meta webhooks can resend delivery receipts. `metaMessagePricingEngine.settleDeliveredMessage` verifies the current record status; if already `delivered`, it returns `{ settled: true, alreadySettled: true }` without double-debiting.
