# WhatsApp Phone Number Registration and 2-Step PIN Specification

## Overview

After a phone number is authorized under a WhatsApp Business Account (WABA), it must be registered with the Meta Cloud API using a 6-digit PIN. Registration issues a valid client certificate allowing message dispatch.

---

## 1. Two-Step Verification Registration

### Graph API Contract
```http
POST https://graph.facebook.com/v21.0/{phone_number_id}/register
Authorization: Bearer {permanent_access_token}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "pin": "123456"
}
```

### Madhura Backend Endpoint
- **Route:** `POST /api/meta/senders/:id/register`
- **Controller:** `backend/routes/enterpriseMetaRoutes.js`
- **Request Body:** `{ "pin": "123456" }`
- **Database Update:** On success, sets `wa_senders.status = 'connected'` and records registration timestamp.

---

## 2. Sender Status Lifecycle

```
[ discovered ] 
      │
      ▼
[ pending_registration ] ──( 6-digit PIN registered )──► [ connected / ready ]
      │                                                        │
      ▼                                                        ▼
[ error / rejected ]                                     [ rate_limited / flagged ]
```

### Quality Ratings
- `GREEN`: High quality; within acceptable user block/report thresholds.
- `YELLOW`: Medium quality; elevated customer negative feedback.
- `RED`: Low quality; high risk of messaging limit downgrade.
- `UNKNOWN`: Insufficient conversation volume to establish rating.

---

## 3. Disconnection & Deregistration

To disconnect a number or migrate it to another provider:
```http
POST https://graph.facebook.com/v21.0/{phone_number_id}/deregister
Authorization: Bearer {permanent_access_token}
```
Deregistration invalidates the local Cloud API certificate without deleting previous message archives in Madhura CRM.
