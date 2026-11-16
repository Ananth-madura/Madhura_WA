# Multi-Bucket Wallet and Credit System Specification

This document details the multi-bucket prepaid credit pools, immutable ledger bookkeeping, auto-recharge triggers, and spending cap safeguards.

---

## 1. Multi-Bucket Wallet Architecture

Madhura segments credits into three independent buckets to ensure complete financial and functional separation:

```
+-----------------------------------------------------------------+
|                    Tenant Prepaid Wallet System                 |
+-----------------------------------------------------------------+
         |                           |                           |
         v                           v                           v
+------------------+       +------------------+       +------------------+
| whatsapp_messaging|      |    ai_credits    |       |automation_credits|
|                  |       |                  |       |                  |
| - Used in Mode 2 |       | - RAG embeddings |       | - Webhooks       |
| - Meta rate-card |       | - Auto-replies   |       | - Triggers       |
| - Paise/Cents    |       | - Copilot tokens |       | - CRM sync       |
+------------------+       +------------------+       +------------------+
```

### 1.1 Bucket Responsibilities
1. **`whatsapp_messaging`**:
   - Active exclusively in **Model B (Provider-Managed Billing)**.
   - Holds prepaid funds for Meta Cloud API conversation charges.
   - In Model A, this bucket remains inactive, since Meta bills the customer directly.
2. **`ai_credits`**:
   - Consumed by neural conversational auto-responses, document RAG, and message summarization.
   - Deducted per completed generation unit.
3. **`automation_credits`**:
   - Consumed by workflow hub nodes, webhook dispatches, and scheduled broadcast automation jobs.

---

## 2. Append-Only Financial Ledger (`wallet_entries`)

### 2.1 Double-Entry Integrity
Direct balance overwrites are forbidden. All credit and debit operations insert an immutable record into `wallet_entries`:
- `tenant_id`: Organization scope
- `credit_type`: Bucket identifier
- `amount`: Transaction magnitude in minor units
- `direction`: `credit` or `debit`
- `balance_after`: Snapshot balance immediately post-transaction
- `reference_id`: Associated payment ID or message ID
- `description`: Audit explanation

### 2.2 Balance Invariant
At any point in time:
$$\text{Calculated Balance} = \sum \text{Credits} - \sum \text{Debits} = \text{Current Wallet Balance}$$
The system runs periodic reconciliation sweeps via `billingReconciliation.js` to ensure the stored balance matches the ledger sum.

---

## 3. Auto-Recharge & Spending Cap Protection

### 3.1 Auto-Recharge Protocol
1. An administrator configures:
   - `auto_recharge_enabled`: 1 (Active)
   - `auto_recharge_trigger_minor`: e.g., 50,000 paise (₹500 threshold)
   - `auto_recharge_amount_minor`: e.g., 200,000 paise (₹2,000 top-up)
2. When the available balance dips below the trigger threshold, the system initiates an auto-recharge session.

### 3.2 Monthly Spending Cap
To protect organizations against runaway automation scripts or broadcast misconfigurations:
- `monthly_spending_limit_minor`: Configurable ceiling (e.g., ₹100,000/month).
- Once total spend reaches 100%, outbound automated dispatches pause and alert administrators immediately.
- Proactive alerts are sent at **50%**, **75%** (25% remaining), and **90%** (10% remaining).
