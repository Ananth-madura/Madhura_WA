# Meta WhatsApp Dual Billing Architecture

This document specifies the dual billing operational models in Madhura, comparing direct Meta invoicing against provider-managed credit line billing.

---

## 1. Architectural Models Overview

| Feature | Model A: Direct Meta Billing (Recommended) | Model B: Provider Credit Line |
| :--- | :--- | :--- |
| **Meta Partner Role** | Tech Provider | Solution Partner (Credit Line) |
| **Asset Ownership** | Customer owns Portfolio, WABA, Senders | Customer owns assets; Partner extends line |
| **WhatsApp Message Charges** | Billed directly by Meta to customer credit card | Billed by Meta to partner; deducted from wallet |
| **Madhura SaaS Subscription** | Billed by Madhura via Razorpay / Stripe | Billed by Madhura via Razorpay / Stripe |
| **Invoicing Entity for Messaging** | Meta Platforms Ireland Ltd / Local Meta entity | Madhura / Partner Agency |
| **Free 1,000 Service Messages** | 100% applied on customer Meta account | 100% tracked and zero-rated in Madhura |
| **Financial Exposure / Risk** | Zero financial liability for Madhura | Madhura absorbs credit default risk |

---

## 2. Model A Specification: Direct Meta Billing

### 2.1 How Money Flows
1. **Madhura Platform Fees**:
   - Monthly or annual plan fee (Starter, Growth, Pro, Enterprise).
   - Additional staff seats, branch queues, and AI agent credit packs.
   - Collected by Madhura via Razorpay or Stripe checkout.
2. **Meta Cloud API Message Charges**:
   - Customer adds their corporate credit card or direct debit in Meta Business Manager (`business.facebook.com/billing_hub`).
   - Meta charges the customer's payment method directly based on Meta's official country rate cards.
   - Madhura provides live telemetry, estimated costs, and delivery logs, but **never** deducts Meta message fees from the Madhura balance.

### 2.2 Payment Readiness Verification
Madhura queries Meta Graph API to verify that the customer's WABA has a functional payment method attached:
```
GET https://graph.facebook.com/v21.0/{waba_id}?fields=payment_method,billing_status
```
If not configured, the UI surfaces a prominent status badge directing the administrator to attach a card in Meta Billing Hub before launching high-volume campaigns.

---

## 3. Model B Specification: Provider-Managed Credit Line

### 3.1 Prepaid Messaging Wallet Mechanism
1. The customer maintains a dedicated `whatsapp_messaging` prepaid balance in Madhura.
2. Top-ups are purchased via Razorpay or Stripe in integer minor units (paise or cents).
3. Prior to message dispatch, Madhura reserves the estimated cost from the wallet.
4. Upon delivery receipt confirmation (`status = delivered`), the reservation is finalized into an immutable ledger debit.
5. If delivery fails or is rejected by Meta, the reserved balance is released immediately.

### 3.2 Auto-Recharge and Spending Safeguards
- **Auto-Recharge Trigger**: Automatically initiates a wallet top-up order when the available balance drops below a configurable threshold (e.g., ₹500).
- **Monthly Spending Limit**: Hard ceiling (e.g., ₹100,000/month). When reached, automated outbound campaigns pause gracefully.

---

## 4. Switching Modes & Governance Rules

1. **Switching from Model A to Model B**:
   - Requires verified partner credit line status.
   - The customer must seed their `whatsapp_messaging` wallet with a minimum balance of ₹1,000.
2. **Switching from Model B to Model A**:
   - Any unused wallet balance remains in the tenant account and can be applied toward SaaS renewals or AI credits.
   - The customer must verify an active payment method in Meta Business Manager.
