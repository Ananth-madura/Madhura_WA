# Madhura Onboarding API Reference

## Overview

Comprehensive reference for all REST endpoints supporting account registration, identity challenge verification, company workspace configuration, and Meta WhatsApp activation.

---

## 1. Authentication & Verification Endpoints

### `POST /api/auth/self-signup`
Registers a new enterprise account and initializes tenant structure.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "full_name": "Rohan Sharma",
    "email": "rohan@company.com",
    "password": "StrongPassword!2026",
    "country": "India"
  }
  ```
- **Response:** `201 Created` with pending user challenge.

### `POST /api/auth/verify-email`
Validates the 6-digit email OTP and issues authenticated session JWT.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "rohan@company.com",
    "code": "123456"
  }
  ```
- **Response:** `200 OK` with session token and user profile.

### `POST /api/auth/resend-verification`
Generates and dispatches a fresh 6-digit OTP code (subject to rate limit).
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "rohan@company.com"
  }
  ```
- **Response:** `200 OK` with countdown cooldown.

---

## 2. Onboarding State & Organization Endpoints

### `GET /api/onboarding/status`
Evaluates the 10-step onboarding state machine against authoritative DB state.
- **Access:** Bearer Token (Authenticated Tenant Context)
- **Response:** `200 OK` with steps array, completed count, progress percentage.

### `POST /api/onboarding/company`
Updates company legal information and operational parameters.
- **Access:** `workspace.manage` permission
- **Request Body:**
  ```json
  {
    "company_name": "Acme Global",
    "legal_name": "Acme Global Technologies Pvt Ltd",
    "brand_name": "Acme",
    "timezone": "Asia/Kolkata",
    "country": "India",
    "category": "Software",
    "gstin": "29AAAAA0000A1Z5"
  }
  ```
- **Response:** `200 OK`.

### `POST /api/onboarding/first-message`
Dispatches diagnostic test message to verify real WhatsApp Cloud API delivery.
- **Access:** `sender.manage` permission
- **Request Body:**
  ```json
  {
    "sender_id": 1,
    "recipient": "+919876543210",
    "message": "Hello from Madhura!"
  }
  ```
- **Response:** `200 OK` with `wamid`.

### `POST /api/onboarding/complete`
Finalizes onboarding milestones.
- **Access:** `workspace.manage` permission
- **Response:** `200 OK` with next route.

---

## 3. Meta Asset & Sender Management Endpoints

### `POST /api/meta/onboard/exchange`
Exchanges Meta Embedded Signup authorization code for permanent token.
- **Access:** `sender.connect` permission
- **Request Body:** `{ "code": "...", "version": "v4" }`

### `POST /api/meta/assets/discover`
Discovers authorized WABAs and phone numbers from Meta Graph API.
- **Access:** `sender.view` permission

### `POST /api/meta/senders/connect-batch`
Connects discovered phone numbers to the workspace in batch.
- **Access:** `sender.connect` permission

### `POST /api/meta/senders/:id/register`
Submits 2-step verification PIN to Meta Cloud API.
- **Access:** `sender.manage` permission
- **Request Body:** `{ "pin": "123456" }`
