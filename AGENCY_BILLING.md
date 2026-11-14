# Agency Multi-Client Billing & Workspace Architecture

This document specifies the agency operating model, client workspace isolation, multi-tenant financial governance, and quota management.

---

## 1. Agency Multi-Workspace Architecture

Madhura enables marketing agencies and solution providers to manage hundreds of client organizations under a single parent partnership:

```
+-------------------------------------------------------------------------+
|                         Parent Agency Workspace                         |
|   - Consolidated Client Overview                                        |
|   - Master Credit Line Allocation                                       |
|   - Global Rate Card Management & Markup Options                        |
+-------------------------------------------------------------------------+
                                    |
      +-----------------------------+-----------------------------+
      |                             |                             |
      v                             v                             v
+-----------------------+   +-----------------------+   +-----------------------+
|  Client 1 Workspace   |   |  Client 2 Workspace   |   |  Client 3 Workspace   |
| - Own Meta Portfolio  |   | - Agency Shared Credit|   | - Own Meta Portfolio  |
| - Model A (Direct)    |   | - Model B (Managed)   |   | - Model A (Direct)    |
| - 2 Phone Numbers     |   | - 5 Phone Numbers     |   | - 1 Phone Number      |
+-----------------------+   +-----------------------+   +-----------------------+
```

---

## 2. Client Billing Configurations

Agencies can assign distinct billing models to individual client workspaces:

### 2.1 Model A (Client Direct Meta Billing)
- **Use Case**: Enterprise clients who require direct corporate tax invoices from Meta.
- **Agency Role**: Agency charges a SaaS retainer for platform management, marketing automation, and agent seats.
- **Client Role**: Client connects their Meta Business Portfolio and card. Meta charges the client directly for message conversations.

### 2.2 Model B (Agency Provider-Managed Credit Line)
- **Use Case**: SMB clients who prefer paying a single consolidated invoice directly to the agency without configuring Meta Business Manager.
- **Agency Role**: Agency extends their Meta Solution Partner credit line or tops up sub-account wallets.
- **Client Role**: Client purchases prepaid messaging credits from the agency.

---

## 3. Sub-Account Quota & Markup Management

1. **Workspace Quota Allocation**: The parent agency can enforce hard monthly caps on:
   - Outbound campaign volumes per client.
   - AI agent credit usage per client.
   - Maximum active phone numbers per client.
2. **Independent Ledger Isolation**: All transactions in `wallet_entries` and `message_billing_records` are strictly scoped by `tenant_id`. Client A can never view or consume Client B's balances.
3. **White-Label Invoicing**: Exportable PDF and CSV financial statements feature the agency's branding, GSTIN, and currency.
