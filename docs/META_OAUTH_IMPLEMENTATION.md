# Meta OAuth 2.0 Server-Side Implementation Specification

## Overview

Meta Embedded Signup delivers a short-lived authorization code. Madhura's backend exchanges this code server-to-server for a permanent access token to prevent exposing client secrets or long-lived tokens in browser code.

---

## 1. Server-Side Exchange Architecture

### Flow Diagram
1. **Frontend:** Receives `authResponse.code` from Meta Popup.
2. **Frontend -> Backend:** `POST /api/meta/onboard/exchange` with `{ code }`.
3. **Backend -> Meta Graph API:**
   `GET https://graph.facebook.com/v21.0/oauth/access_token`
   - `client_id`: Meta App ID
   - `client_secret`: Meta App Secret
   - `code`: Authorization code
4. **Backend -> Token Inspection:**
   `GET https://graph.facebook.com/v21.0/debug_token`
   Validates granted scopes, user ID, and target WABA permissions.
5. **Database Storage:**
   Encrypts token using AES-256-GCM and persists record in `waba_connections`.

---

## 2. API Contract: Code Exchange

### Endpoint
`POST /api/meta/onboard/exchange`

### Request Body
```json
{
  "code": "AQDx...meta_auth_code...",
  "version": "v4"
}
```

### Success Response
```json
{
  "success": true,
  "wabaId": "192837465019283",
  "businessId": "102938475610293",
  "tokenType": "bearer",
  "expiresIn": 5184000,
  "discoveredAssets": {
    "totalWabas": 1,
    "totalNumbers": 2
  }
}
```

---

## 3. Cryptographic Storage & Security

- System User permanent tokens and access keys are encrypted at rest using AES-256-GCM with distinct initialization vectors per record.
- Plaintext tokens are never returned to client responses; they are masked (`EAAG...XXXX`) in all management and monitoring endpoints.
