# Madhura Onboarding Security & Tenant Isolation Specification

## Overview

Security principles, tenant isolation boundaries, and cryptographic controls governing the customer signup and Meta activation system.

---

## 1. Multi-Tenant Data Isolation

- **Logical Separation:** Every database table containing tenant assets (`wa_senders`, `wa_message_logs`, `wa_contacts`, `wa_automations`, `branches`) includes an indexed `tenant_id` column.
- **Middleware Guarding:** `requireTenantContext` extracts `req.tenantId` strictly from verified JWT claims or authenticated session cookies. Requests cannot alter or supply foreign tenant identifiers in route parameters or query bodies.
- **Audit Verification:** `backend/scripts/audit-auth.js` enforces that all 524 Express handlers are explicitly guarded or classified as `public_by_design`.

---

## 2. Secrets Management & Encryption at Rest

- **Token Protection:** Permanent Meta access tokens and system credentials stored in `waba_connections` and `wa_senders` are encrypted at rest using AES-256-GCM.
- **No Client Exposure:** Plaintext Meta tokens are never transmitted to the browser.
- **No Phone OTP Interception:** In compliance with Meta security guidelines, customer phone verification OTPs are processed solely within Meta's dialog and never touch Madhura servers.

---

## 3. Rate Limiting & Abuse Prevention

- **Signup Throttling:** Strict rate limiting per IP address on `POST /api/auth/self-signup`.
- **OTP Challenge Limiting:** Maximum 5 validation attempts per challenge before token invalidation.
- **Resend Cooldown:** 60-second cooldown enforced server-side.
- **CORS Policies:** Configured strictly to trusted application origins (`live.wa.madhuratech.in`, `api.madhuratech.in`, and whitelisted Vercel preview environments).
