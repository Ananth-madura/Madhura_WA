# Madhura WhatsApp CRM - Enterprise Multi-Tenant & Multi-Branch Architecture
## Migration Runbook, Schema Architecture & Operational Guide

**Reference:** [MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md](file:///d:/Whatsapp_CRM/MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md)  
**Git Branch:** `feature/enterprise-multi-tenant-multi-branch`  
**Execution Date:** October 2026  
**Status:** ✅ Fully Migrated, Verified & Tested (100% Pass)

---

## 1. Executive Summary

This enterprise transformation shifts Madhura WhatsApp CRM from a single-tenant or loose multi-user model into a true **Multi-Tenant, Multi-Branch, Multi-WABA Enterprise B2B SaaS Platform**.

### Key Deliverables Completed:
1. **P0 Security & Isolation:** Completely eliminated `req.user?.tenant_id || 1` fallbacks and removed `OR tenant_id IS NULL` across database queries. All API routes enforce fail-closed tenancy (HTTP 403 Forbidden on missing or unauthorized organization headers).
2. **Canonical Schema Engine:** Created 15+ canonical relational tables (`tenants`, `branches`, `organization_memberships`, `staff_branch_memberships`, `permissions`, `roles`, `role_permissions`, `waba_connections`, `wa_senders`, `sender_branch_assignments`, `meta_onboarding_sessions`, `consents`, `conversations`, `plans`, `subscriptions`, `usage_events`, `wallet_accounts`, `wallet_entries`).
3. **Non-Destructive Legacy Backfill:** Backed up raw database files to `backups/pre_migration_20261013/`. Backfilled all pre-existing contacts, campaigns, templates, flows, notes, logs, and accounts to **Tenant 1 ("Madhura Primary Organization")** and **Branch 1 ("Head Office (Main)")**.
4. **Hybrid WhatsApp Sender Model:** Supports both organization-wide shared numbers (with branch routing via menus/teams) and dedicated branch phone numbers.
5. **Meta Embedded Signup (Graph API v22.0):** Built session-based onboarding endpoints (`POST /api/v2/meta/onboarding/sessions` & `POST /api/v2/meta/onboarding/complete`) with token exchange, state validation, and automatic sender registration.
6. **Billing, Subscriptions & Razorpay:** Built canonical plan catalog (`free`, `starter`, `growth`, `business`, `enterprise`), verified Razorpay checkout session creation, webhook HMAC-SHA256 signature verification, quota calculations (`max_branches`, `max_seats`), and append-only wallet ledger (`wallet_entries`).
7. **Frontend Enterprise Experience:** Created `EnterpriseContext.jsx` with persistent multi-tenant & multi-branch state (`x-tenant-id`, `x-branch-id`), `OrganizationSwitcher`, `BranchSwitcher`, `whatsappBranches.jsx` management page, `whatsappBilling.jsx` dashboard, and branch scoping in `whatsappEmployees.jsx`, `whatsappAccounts.jsx`, and `whatsapp.jsx`.
8. **Dedicated Branch Staff & Access Code System:** Each branch has dedicated staff members assigned via `staff_branch_memberships`, unique Access Codes (`WA-XXXXXX`) for rapid self-activation, granular WhatsApp access levels (`full`, `chat_only`, `read_only`, `campaign_only`), and atomic branch manager transfers with full audit logging.
9. **Isolated Branch Customer Records (`wa_contacts`):** Strict customer isolation per tenant and branch, dedicated branch contacts directory with search/export, cross-branch customer transfer with conversation reassignment and audit logging, and direct 1-click WhatsApp chat launch.

---

## 2. Canonical Database Schema

| Table | Purpose | Scoping |
|---|---|---|
| `tenants` | Organizations / Company accounts with subscription limits | Root partition (`id`) |
| `branches` | Branch locations, Head Office flag, addresses, phone | `tenant_id` |
| `organization_memberships` | User mapping to tenants with organization-level roles | `(tenant_id, user_id)` UNIQUE |
| `staff_branch_memberships` | Scopes staff members to one or more branches | `(tenant_id, user_id, branch_id)` UNIQUE |
| `permissions` | 24 granular actions (`organization.*`, `branch.*`, `inbox.*`, `campaign.*`, `sender.*`) | System static |
| `roles` | 5 canonical roles: `organization_owner`, `organization_admin`, `branch_manager`, `agent`, `billing_admin` | `(tenant_id, code)` |
| `role_permissions` | Fine-grained permission assignments | `(role_id, permission_code)` |
| `waba_connections` | Meta WhatsApp Business Accounts registered via Embedded Signup | `tenant_id` |
| `wa_senders` | Phone numbers registered under WABAs (with quality & limit tier) | `tenant_id` |
| `sender_branch_assignments` | Hybrid routing: maps senders to specific branches or marks shared | `(tenant_id, sender_id, branch_id)` |
| `meta_onboarding_sessions` | Short-lived nonce & state tokens for Embedded Signup popup | `(session_id)` UNIQUE |
| `consents` | Audit-proof opt-in/opt-out registry | `tenant_id` |
| `conversations` | Multi-branch team inbox sessions with 24h window tracking | `tenant_id`, `branch_id` |
| `plans` | SaaS tier definitions (`price_inr`, `max_branches`, `max_seats`, `features_json`) | Canonical catalog |
| `subscriptions` | Active organization subscriptions with billing periods | `tenant_id` |
| `wallet_accounts` | Balance containers for AI credits, messaging units | `(tenant_id, credit_type)` UNIQUE |
| `wallet_entries` | Immutable, append-only double-entry audit ledger | `account_id`, `tenant_id` |

---

## 3. Middleware & Security Implementation

### Fail-Closed Tenant Middleware (`backend/middleware/tenantMiddleware.js`)
```javascript
// 1. Validates Authorization JWT
// 2. Extracts x-tenant-id header (or user's default active tenant)
// 3. Verifies user belongs to tenant in organization_memberships
// 4. Sets req.tenantId and req.tenantRole
// 5. If missing or unauthorized -> 403 Forbidden (fail-closed)
```

### Branch Scoping Middleware (`requireBranchScope`)
```javascript
// 1. Reads x-branch-id header
// 2. Verifies branch belongs to req.tenantId
// 3. If user is agent/branch_manager, ensures branch is in their permitted branches
// 4. Sets req.branchId and req.permittedBranchIds
```

### Granular Permission Gate (`requirePermission(action)`)
```javascript
// Validates whether user's role has the requested action in role_permissions
// E.g. requirePermission("branch.create"), requirePermission("sender.manage")
```

---

## 4. Hybrid Sender Resolution Engine

Implemented in `backend/services/metaPartnerService.js` and `backend/services/waConfigHelper.js`:

```
Incoming Request: send WhatsApp message for (tenantId, branchId)
                     │
                     ▼
    Does branchId have a dedicated sender in sender_branch_assignments?
                     ├── YES ──► Use dedicated branch phone_number_id & token
                     └── NO  ──► Does tenant have an active is_shared = 1 sender?
                                    ├── YES ──► Use shared organization sender
                                    └── NO  ──► Fallback to primary verified sender
```

---

## 5. Verification Test Suite Results (100% Passing)

### Suite 1: Enterprise Multi-Tenant & Multi-Branch Core Isolation (8/8)
**Script:** `node backend/tests/enterpriseIsolation.test.js`
```
================================================================================
🚀 ENTERPRISE MULTI-TENANT & MULTI-BRANCH VERIFICATION TEST SUITE
================================================================================
  ✅ PASS: Tenant 1 (Primary Org) and Branch 1 (Head Office) exist in canonical tables
  ✅ PASS: Granular RBAC roles and permissions seeded
  ✅ PASS: Canonical SaaS plans (Free, Starter, Growth, Business, Enterprise) loaded
  ✅ PASS: Create isolated Tenant 2 and test Branch Creation with Quota Enforcement
  ✅ PASS: Cross-Tenant Data Isolation strictly enforced (No leakage between Tenant 1 and Tenant 2)
  ✅ PASS: Hybrid Sender Resolution: Shared vs Dedicated Branch Number
  ✅ PASS: Wallet Ledger append-only audit invariants
  ✅ PASS: Clean up test isolation tenant
🏁 TEST RESULTS: 8 PASSED | 0 FAILED (100% SUCCESS)
```

### Suite 2: Multi-Branch Operating System & Lifecycle (9/9)
**Script:** `node backend/tests/test_branch_lifecycle.js`
```
  ✅ PASS: Branch created with canonical ID and slug.
  ✅ PASS: Duplicate branch code rejected with 409 Conflict.
  ✅ PASS: Second branch created.
  ✅ PASS: Staff member added to branch.
  ✅ PASS: Branch manager transferred atomically and audited.
  ✅ PASS: Dedicated Meta WhatsApp sender assigned to branch.
  ✅ PASS: Inter-branch conversation transferred to target branch.
  ✅ PASS: Branch archive and restore lifecycle verified.
  ✅ PASS: Cross-tenant branch access completely forbidden.
🏁 TEST RESULTS: 9 PASSED | 0 FAILED (100% SUCCESS)
```

### Suite 3: Enterprise Auth, Onboarding & Workspace Context (4/4)
**Script:** `node backend/tests/test_enterprise_auth_flow.js`
```
  ✅ PASS: Demo login returns complete enterprise context.
  ✅ PASS: Enterprise Self-Signup creates tenant, head office branch, and memberships.
  ✅ PASS: Enterprise Login returns correct tenant and primary branch.
  ✅ PASS: Test cleanup complete.
🏁 TEST RESULTS: 4 PASSED | 0 FAILED (100% SUCCESS)
```

### Suite 4: Branch Staff Employees & Customer Contacts Operations (6/6)
**Script:** `node backend/tests/test_branch_employees_contacts.js`
```
  ✅ PASS: Created employee Sarah with Access Code WA-XXXXXX
  ✅ PASS: Branch A member retrieved with access code, job title, and WhatsApp access level.
  ✅ PASS: Branch B contains 0 members (isolation strictly preserved).
  ✅ PASS: Created customer contact Wayne Enterprises scoped to Branch A.
  ✅ PASS: Branch contacts scoped and isolated.
  ✅ PASS: Customer contact successfully transferred across branches with audit log.
🏁 TEST RESULTS: 6 PASSED | 0 FAILED (100% SUCCESS)
```

---

## 6. Production Rollout Runbook

### Pre-Flight Checklist:
1. Verify database backup exists in `backups/pre_migration_20261013/`.
2. Ensure environment variables are loaded:
   - `JWT_SECRET`
   - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` & `RAZORPAY_WEBHOOK_SECRET`
   - `META_APP_ID` & `META_APP_SECRET` & `META_CONFIG_ID`
   - `DB_ENGINE=sqlite` (or production MySQL connection credentials)

### Rollout Steps:
1. **Run Database Migration:**
   ```bash
   node backend/migrations/enterprise_multi_tenant_multi_branch.js
   ```
2. **Execute Isolation Test Suite:**
   ```bash
   node backend/tests/enterpriseIsolation.test.js
   ```
3. **Start Backend Server:**
   ```bash
   cd backend && npm start
   ```
4. **Start Frontend Client:**
   ```bash
   cd frontend && npm start
   ```

### Rollback Plan (If Needed):
If a critical production error occurs:
1. Restore database snapshot from `backups/pre_migration_20261013/database.sqlite` to `backend/database.sqlite`.
2. Check out previous commit: `git checkout main`.
3. Restart backend service.
