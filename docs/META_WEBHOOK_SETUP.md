# Meta WhatsApp Webhook Setup & Signature Verification Specification

## Overview

Madhura processes inbound customer WhatsApp messages, delivery receipts (sent, delivered, read), and template approvals via real-time webhooks signed by Meta.

---

## 1. Webhook Verification Handshake (GET)

When configuring the callback URL in Meta Developer Console or during automated app subscription, Meta issues a verification challenge:

```http
GET https://api.madhuratech.in/webhook?hub.mode=subscribe&hub.challenge=1158201444&hub.verify_token=madhura_wa_verify_2026
```

### Handler Verification Logic
```javascript
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});
```

---

## 2. Inbound Payload Cryptographic Verification (POST)

Every inbound event payload includes the `x-hub-signature-256` HTTP header containing the HMAC-SHA256 hash calculated with the Meta App Secret.

### Verification Implementation
```javascript
const crypto = require("crypto");

function verifyMetaSignature(req, res, buf, encoding) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    throw new Error("Missing x-hub-signature-256 header");
  }

  const expectedSignature = "sha256=" + crypto
    .createHmac("sha256", process.env.META_APP_SECRET)
    .update(buf)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error("Invalid Meta webhook HMAC signature");
  }
}
```

---

## 3. Automated WABA Subscription

During onboarding, Madhura subscribes the tenant's WABA automatically:
```http
POST https://graph.facebook.com/v21.0/{waba_id}/subscribed_apps
Authorization: Bearer {access_token}
```
This guarantees real-time event delivery without requiring manual configuration in Meta App Dashboards.
