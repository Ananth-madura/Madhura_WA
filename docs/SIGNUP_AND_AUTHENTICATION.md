# Madhura Enterprise Signup and Authentication Specification

## Overview

Madhura WhatsApp CRM provides an enterprise-grade self-service registration and authentication system designed for multi-tenant business isolation. The signup process safely provisions a master user, default organization workspace, and Head Office branch while enforcing password entropy and email verification.

---

## 1. Public Signup Architecture

### Endpoints and Flows
- **Route:** `/signup`
- **Controller:** `frontend/src/auth/signup.jsx`
- **Backend Service:** `backend/services/selfSignupService.js`
- **Public API:** `POST /api/auth/self-signup`

### Registration Sequence
1. **Frontend Input Collection:** Full Name, Business Email, Password, Password Confirmation, Country, and Terms/Privacy Acceptance.
2. **Client-side Pre-Validation:** Email format validation, password strength requirements (min 8 chars, mixed case, numbers, special characters), and confirmation match.
3. **Backend Lifecycle Execution:**
   - Rate limiting via IP and email challenge.
   - Normalization: email lowercase trimmed, phone sanitized to E.164.
   - Password hashing via PBKDF2 / bcrypt with high work factor.
   - Atomic database provisioning across tenants, branches, users, and memberships.
   - Dispatch of 6-digit email verification challenge.
   - Audit event logged in `branch_audit_events`.

---

## 2. Multi-Tenant Provisioning Model

When a user submits self-signup, the backend performs the following atomic operations within a single database transaction:

```sql
-- 1. Create Tenant
INSERT INTO tenants (name, legal_name, brand_name, plan, status, timezone, settings_json)
VALUES ('New Organization', 'New Organization', 'New Organization', 'free', 'active', 'Asia/Kolkata', '{}');

-- 2. Create Default Head Office Branch
INSERT INTO branches (tenant_id, name, slug, is_head_office, status)
VALUES (?, 'Head Office', 'head-office', 1, 'active');

-- 3. Create or Link User
INSERT INTO users (email, password_hash, first_name, last_name, status)
VALUES (?, ?, ?, ?, 'active');

-- 4. Assign Owner Role and Memberships
INSERT INTO organization_memberships (tenant_id, user_id, role_id, membership_status)
VALUES (?, ?, (SELECT id FROM roles WHERE name='Owner'), 'active');

INSERT INTO staff_branch_memberships (branch_id, user_id, status)
VALUES (?, ?, 'active');
```

---

## 3. Account Security and Session Management

- **JWT Tokens:** Issued upon successful verification or sign-in with claims: `{ id, email, tenantId, branchId, role }`.
- **Cookie Security:** `httpOnly`, `SameSite=None`, `Secure` in production environments.
- **Tenant Context Isolation:** Enforced via `authWorkspaceScope.js` and `requireTenantContext` middleware.
