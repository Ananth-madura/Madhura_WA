# Madhura Account Verification and Challenge Protocols

## Overview

Madhura strictly distinguishes between user identity verification and external Meta asset authorization. This document specifies the challenge mechanisms, lifecycle, and security controls for Madhura account verification.

---

## 1. Distinction of Verification Domains

| Domain | Scope | Mechanism | Stored by Madhura |
| :--- | :--- | :--- | :--- |
| **Madhura User Account** | Verifies ownership of business email | 6-digit Email OTP / Signed link | Hashed challenge token with expiry |
| **Meta OAuth** | Grants access to Meta Business Assets | Meta Embedded Signup / OAuth 2.0 | Encrypted System User Token |
| **WhatsApp Phone Ownership** | Verifies ownership of physical SIM/number | Meta Hosted SMS/Voice Challenge | NEVER (handled solely by Meta) |
| **Meta Business Verification** | Validates official legal registration | Meta Business Manager Review | Tracked status enum only |

---

## 2. Email Challenge Protocol

### Endpoints
- **Verification Submission:** `POST /api/auth/verify-email`
  - Body: `{ email: "user@domain.com", code: "123456" }`
  - Response: `{ success: true, token: "JWT...", user: { ... } }`
- **Resend Code:** `POST /api/auth/resend-verification`
  - Body: `{ email: "user@domain.com" }`
  - Response: `{ success: true, message: "Code sent" }`

### Lifecycle and Rate Limits
1. **Challenge Generation:** 6-digit numeric token generated via cryptographically secure pseudo-random number generator (CSPRNG).
2. **TTL (Time to Live):** Code expires strictly after 15 minutes.
3. **Resend Cooldown:** 60-second client-side and server-side cooldown window between successive code requests.
4. **Max Attempts:** 5 failed attempts per challenge before the code is invalidated, requiring a fresh challenge to prevent brute force attacks.
5. **No Exposure in Logs:** OTP codes are masked in operational server logs and error traces.

---

## 3. Account Activation & Session Issuance

Upon valid code verification:
1. `users.status` transitioned from `pending_verification` to `active`.
2. Session JWT generated with full tenant and primary branch claims.
3. User redirected to Step 2: `/onboarding/company`.
