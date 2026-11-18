# WhatsApp First Message Verification Specification

## Overview

Step 7 of the Madhura onboarding sequence validates that the entire end-to-end messaging pipeline: Meta token authorization, sender registration, Cloud API connectivity, and webhook routing, is operational by dispatching a verified diagnostic message.

---

## 1. Execution Flow

1. **User Action:** Customer selects an active sender and inputs a recipient mobile number at `/onboarding/whatsapp/test-message`.
2. **API Request:** Frontend dispatches `POST /api/onboarding/first-message`.
3. **Graph API Dispatch:**
   ```http
   POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
   Authorization: Bearer {token}
   Content-Type: application/json

   {
     "messaging_product": "whatsapp",
     "to": "919876543210",
     "type": "text",
     "text": {
       "body": "Hello from Madhura Enterprise WhatsApp CRM! Your workspace activation is complete."
     }
   }
   ```
4. **Meta Response & wamid Capture:**
   ```json
   {
     "messaging_product": "whatsapp",
     "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
     "messages": [{ "id": "wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSQ0U1RTYzODhBQ0YyMDNDNTE0AA==" }]
   }
   ```
5. **Persistence:** The `wamid` is stored in `wa_message_logs` with status `accepted`.
6. **Milestone Unlocking:** The presence of at least one message log under the tenant unlocks Step 7 in the Onboarding State Machine.

---

## 2. API Contract

### Request (`POST /api/onboarding/first-message`)
```json
{
  "sender_id": 1,
  "recipient": "+919876543210",
  "message": "Hello from Madhura Enterprise WhatsApp CRM! Your workspace activation is complete."
}
```

### Success Response
```json
{
  "success": true,
  "message": "First WhatsApp test message dispatched successfully",
  "wamid": "wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSQ0U1RTYzODhBQ0YyMDNDNTE0AA==",
  "recipient": "919876543210",
  "status": "accepted"
}
```
