# Madhura SaaS Subscription Billing Specification

This document defines the platform subscription tiers, resource entitlement quotas, billing cycles, and add-on packaging.

---

## 1. Platform Subscription Tiers

Madhura offers 4 tiered SaaS subscription plans:

| Tier | Price (Excl. GST) | Billing Cycle | Branch Queues | Staff Seats | Senders | Included Monthly Outbound |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Starter** | Free (₹0) | Perpetual | 1 | 2 | 1 | 1,000 messages |
| **Growth** | ₹1,499 / 30 days | 30-day Prepaid | 3 | 5 | 2 | 10,000 messages |
| **Pro** | ₹2,999 / 30 days | 30-day Prepaid | 10 | 15 | 5 | 50,000 messages |
| **Enterprise** | Custom Quote | Annual / Custom | Unlimited | Unlimited | Unlimited | Custom high-volume |

---

## 2. Resource Entitlements & Metering

### 2.1 Enforced Entitlement Quotas
Each tenant's subscription unlocks concrete resource quotas managed via `billingService.js`:
- **Branch Queues**: Isolates departmental chats and assigned customer conversations.
- **Staff Seats**: Controls simultaneous agent logins and RBAC roles.
- **WhatsApp Senders**: Maximum concurrent phone numbers provisioned under the tenant's WABA.
- **Monthly Platform Outbound**: Software message queue capacity. Resets on the 1st of each calendar month.

### 2.2 30-Day Prepaid Model (No Hidden Auto-Debits)
Madhura deliberately operates on a verified, transparent 30-day prepaid cycle:
1. Customers purchase or renew access for 30 days via Razorpay or Stripe checkout.
2. Recurring automatic bank debits are **not** forced without explicit consent.
3. 5 days prior to expiration, the platform displays renewal reminders in the dashboard.
4. If a plan expires, the tenant gracefully downscales to Starter rather than abruptly locking customer data.

---

## 3. Add-On Modular Pricing

Tenants can extend individual quotas without upgrading their entire plan:
- **Additional Staff Seat**: ₹250 / seat / 30 days.
- **Additional Branch Queue**: ₹500 / branch / 30 days.
- **Additional WhatsApp Sender**: ₹750 / number / 30 days.
- **AI Agent Credit Pack (10,000 tokens)**: ₹500 prepaid.
- **Automation Action Pack (5,000 actions)**: ₹300 prepaid.
