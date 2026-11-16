# Meta Embedded Signup & Multi-Number Provisioning Specification

This document details the complete 11-step customer onboarding flow, client-side Facebook SDK handshake, server-side asset discovery, and multi-number provisioning engine.

---

## 1. Onboarding Journey (11 Stages)

```
[1. Model Selection] -> [2. Portfolio Discovery] -> [3. WABA Association]
                                                            |
[6. PIN Setup]       <- [5. Profile & Category]  <- [4. Multi-Number Pick]
      |
[7. Meta Billing]    -> [8. Webhook Handshake]   -> [9. Department Routing]
                                                            |
[11. Go-Live Dashboard] <----------------------- [10. Ping Latency Check]
```

### 1.1 Stage Details
1. **Billing Architecture**: Tenant selects Model A (Direct Meta) or Model B (Provider Credit Line).
2. **Business Portfolio**: Tenant discovers or binds their Meta Business Portfolio ID.
3. **WABA Association**: Tenant connects the WhatsApp Business Account.
4. **Phone Provisioning**: Tenant selects 1 to 5+ concurrent phone numbers for registration.
5. **Display Name & Category**: Public WhatsApp Business Profile metadata setup.
6. **Two-Step Security PIN**: 6-digit PIN registered via `/register` endpoint.
7. **Meta Billing Verification**: Checks attached credit card on Meta Portfolio (Model A).
8. **Webhook Handshake**: Registers webhook endpoints for messages and delivery receipts.
9. **Branch Routing**: Assigns departments (Sales, Support, Billing, Marketing) to each sender.
10. **Diagnostic Ping**: Executes real Graph API ping to verify round-trip latency.
11. **Go-Live Activation**: Summarizes limits and transitions senders to live state.

---

## 2. Facebook JavaScript SDK Integration

### 2.1 SDK Loader & Configuration
Embedded Signup requires loading Meta's JavaScript SDK and configuring the `sessionInfoListener`:

```javascript
window.fbAsyncInit = function() {
  FB.init({
    appId: process.env.REACT_APP_META_APP_ID,
    autoLogAppEvents: true,
    xfbml: true,
    version: "v21.0"
  });
};

function launchEmbeddedSignup() {
  FB.login(function(response) {
    if (response.authResponse) {
      const code = response.authResponse.code;
      handleServerExchange(code);
    } else {
      console.warn("User cancelled login or did not fully authorize.");
    }
  }, {
    config_id: process.env.REACT_APP_META_CONFIG_ID,
    response_type: "code",
    override_default_response_type: true,
    extras: {
      setup: {
        // Multi-number support configuration
        allow_multi_number: true
      }
    }
  });
}
```

### 2.2 sessionInfoListener Event Capture
During Embedded Signup, Meta broadcasts window messages indicating selected assets:
```javascript
window.addEventListener("message", (event) => {
  if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
  try {
    const data = JSON.parse(event.data);
    if (data.type === "WA_EMBEDDED_SIGNUP") {
      const { waba_id, phone_number_id, current_step } = data.data;
      console.log(`Onboarding progression: ${current_step} for WABA ${waba_id}`);
    }
  } catch (err) {
    // Non-JSON message from other extensions
  }
});
```

---

## 3. Server-Side Asset Discovery & Registration

### 3.1 Discovering Available Phone Numbers
Once the permanent System User Token is established, the backend queries:
```
GET https://graph.facebook.com/v21.0/{waba_id}/phone_numbers
  ?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,messaging_limit_tier
  &access_token={DECRYPTED_TOKEN}
```

### 3.2 Registering the 6-Digit PIN
Before a phone number can send or receive messages via Cloud API, it must be registered with its two-step verification PIN:
```
POST https://graph.facebook.com/v21.0/{phone_number_id}/register
Headers:
  Authorization: Bearer {DECRYPTED_TOKEN}
  Content-Type: application/json

Body:
{
  "messaging_product": "whatsapp",
  "pin": "482910"
}
```

---

## 4. Error Handling & Recovery Protocols

1. **User Cancellation**: If the popup is closed before completing, the session state is preserved in `meta_onboarding_sessions` with status `cancelled`. The user can resume at any time.
2. **Name Mismatch / Review Required**: If a requested display name requires Meta human review, the status is set to `pending_review`. The sender can still be provisioned for testing with unverified tier.
3. **Rate Limits & Backoff**: Graph API calls use exponential backoff on HTTP 429 and 5xx errors.
