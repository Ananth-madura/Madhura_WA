# Multi-Tenant & Multi-Branch Enterprise SaaS Migration Plan

> Reference Blueprint: `MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md`  
> Target Branch: `feature/enterprise-multi-tenant-multi-branch`

---

## Migration Roadmap (Phased Execution)

### Task 1: Phase 0 — Baseline Security & Tenant Isolation Hardening
- **Goal**: Eliminate cross-tenant leaks and disable insecure backdoors identified in P0 findings.
- **Actions**:
  - Remove all `req.user?.tenant_id || 1` and `OR tenant_id IS NULL` fallbacks in `server.js`, `routes/authRoutes.js`, `routes/waCampaignRoutes.js`, and services. Enforce strict fail-closed (403/404) on missing tenancy.
  - Disable direct `/api/auth/switch-plan` free upgrades; restrict `/self-signup` from granting unverified active paid tiers.
  - Fix `/create-user` and `/register` in `routes/authRoutes.js` to require valid tenant context and authenticated invitation tokens.
- **Verification**: Run `node scripts/audit-auth.js` and verify no unauthenticated or cross-tenant reads return tenant 1 data.

### Task 2: Phase 1 — Canonical Organizations, Branches, Teams & RBAC Schema
- **Goal**: Introduce true enterprise multi-company and multi-branch database entities and middleware.
- **Actions**:
  - Add tables: `organizations`/enhanced `tenants`, `branches`, `teams`, `organization_memberships`, `staff_branch_memberships`, `roles`, `permissions`, and `invitations`.
  - Implement middleware: `requireTenantContext`, `requireBranchScope`, and `authorize(permission)` in `backend/middleware/`.
  - Add REST endpoints: `/api/v2/organizations`, `/api/v2/branches` (CRUD), `/api/v2/teams`, and `/api/v2/context/select-organization`.
  - Build UI components: `OrganizationSwitcher`, `BranchSwitcher`, and Branch Management Settings page in frontend.
- **Verification**: Database migration runs cleanly in both MySQL and SQLite; branch creation and member assignment return isolated datasets.

### Task 3: Phase 2 — Organization-Owned Meta Assets & Branch Senders
- **Goal**: Decouple Meta WhatsApp credentials from individual users and map them to organizations and branches.
- **Actions**:
  - Add tables: `waba_connections`, `wa_senders`, `sender_branch_assignments`, and `sender_access`.
  - Migrate legacy `user_wa_configs` and `wa_accounts` to canonical tenant-owned senders.
  - Update `waConfigHelper.js` to resolve credentials via `(tenantId, senderId)` instead of `user_id`.
  - Implement partner Embedded Signup session endpoints (`/api/v2/meta/onboarding/sessions` & `/complete`) with backend code exchange.
- **Verification**: WhatsApp Cloud client initializes by tenant sender ID; incoming webhooks resolve tenant via `phone_number_id`.

### Task 4: Phase 3 — Verified SaaS Subscriptions & Metered Usage Engine
- **Goal**: Implement server-side entitlement enforcement and verified Razorpay payment reconciliation.
- **Actions**:
  - Create versioned plan catalog (`starter`, `growth`, `business`, `enterprise`) with seat, branch, sender, and message quotas.
  - Implement Razorpay subscription and checkout creation (`/api/v2/billing/checkout`) with HMAC webhook handler (`/webhooks/razorpay`).
  - Add append-only `usage_events` and `wallet_entries` for AI credits and software actions.
  - Replace `WAPlanModal.jsx` free plan switches with a secure checkout and invoice status modal.
- **Verification**: Replaying webhook events does not duplicate credits; quota exhaustion blocks outbound actions server-side.

### Task 5: Phase 4 — Multi-Branch Shared Inbox, Routing & Campaign Controls
- **Goal**: Enable branch-scoped live inbox, queue assignment, and compliant campaign broadcasting.
- **Actions**:
  - Add `branch_id`, `owner_user_id`, and `service_window_expires_at` to conversations and messages.
  - Update shared inbox (`frontend/src/pages/whatsapp.jsx`) with branch filter, conversation assignment, and 24h window timer.
  - Add opt-in consent registry (`consents`, composite unique `UNIQUE(tenant_id, normalized_phone)` on `wa_contacts`).
  - Update campaign engine to throttle per branch sender and respect recipient consent.
- **Verification**: Agent assigned to Branch A cannot view or reply to Branch B conversations.

### Task 6: Phase 5 — Verification, Cross-Tenant Security Audit & Documentation
- **Goal**: Validate isolation across all tiers and document the architecture.
- **Actions**:
  - Write automated adversarial tests verifying Tenant A cannot access Tenant B data, contacts, or senders.
  - Run linting, security scans, and database integrity checks.
  - Create `README-MIGRATION.md` detailing migration steps, environment variables, and rollback plan.
- **Verification**: All unit, integration, and tenant isolation tests pass with zero leaks.
