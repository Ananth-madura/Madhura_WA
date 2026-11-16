# 🚀 Universal WhatsApp Engine & CRM Connector (v2.0)

Turn your `Whatsapp_CRM` into an independent, plug-and-play WhatsApp microservice connectable to **any CRM system** (HubSpot, Zoho, Salesforce, LeadSquared, or any custom Node.js, PHP, Python, Laravel, or Django CRM).

---

## 🌟 Architecture & Features

- **Standalone Microservice**: Operates independently on Port `5001` with its own database and headless WhatsApp Web / Meta Cloud API engines.
- **Universal REST API**: Send messages, send documents/media, fetch chats, sync contacts, and retrieve live QR codes.
- **Dual Authentication**: Accepts either **API Key** (`x-api-key: <key>` or `Authorization: Bearer <key>`) or JWT User Tokens.
- **Real-Time Outbound Webhooks**: Automatically forwards incoming customer replies, outbound sent messages, and delivery receipts (sent, delivered, read) to your CRM's webhook endpoint with HMAC SHA-256 signatures.
- **Resilient Engine**: Automatically bypasses WhatsApp Web internal module updates, recovers from stale session corruption, and suppresses sync replay loops.

---

## 🔑 Authentication

Default Master API Key:
```
wa_crm_secret_key_2026
```
*(Configurable via `WA_API_KEY` in `backend/.env`)*

Pass this in your HTTP headers:
```http
x-api-key: wa_crm_secret_key_2026
```
Or:
```http
Authorization: Bearer wa_crm_secret_key_2026
```

---

## 📡 Core REST API Endpoints

Base URL: `http://localhost:5001/api/v1` (or your public server URL)

### 1. Engine Health & Status
```http
GET /api/v1/status
```
**Response:**
```json
{
  "success": true,
  "service": "whatsapp-crm",
  "version": "2.0.0",
  "connected": true,
  "phone": "919876543210",
  "activeEngine": "WhatsApp Web Session",
  "webhookUrl": "https://your-crm.com/api/whatsapp-webhook"
}
```

---

### 2. Live QR Code (JSON, PNG, or SVG)
```http
GET /api/v1/qr
```
Optional query parameters:
- `?format=png` - Returns image/png stream directly for embedding `<img src="..." />`
- `?format=svg` - Returns image/svg+xml stream directly
- `?refresh=true` - Forces a fresh QR scan token

**JSON Response:**
```json
{
  "success": true,
  "connected": false,
  "initializing": false,
  "qr": "2@4l2A...==",
  "qrDataUrl": "data:image/png;base64,iVBORw0KGgo...",
  "message": "QR Ready"
}
```

---

### 3. Send Text Message
```http
POST /api/v1/messages/send
Content-Type: application/json
x-api-key: wa_crm_secret_key_2026

{
  "phone": "919876543210",
  "message": "Hello from our CRM! Your ticket #4089 is resolved. 🚀"
}
```
**Response:**
```json
{
  "success": true,
  "messageId": "true_919876543210@c.us_3EB0...",
  "to": "919876543210",
  "status": "sent"
}
```

---

### 4. Send Document, PDF, or Media
```http
POST /api/v1/messages/send-media
Content-Type: multipart/form-data
x-api-key: wa_crm_secret_key_2026

form fields:
- phone: "919876543210"
- file: (Binary PDF, JPG, PNG, DOCX)
- caption: "Here is your invoice #1042"
```

---

### 5. Fetch Chat Conversations
```http
GET /api/v1/chats?refresh=true
```

### 6. Fetch Messages For a Specific Chat
```http
GET /api/v1/chats/919876543210@c.us/messages?limit=50
```

---

### 7. Configure Outbound Webhook URL
```http
POST /api/v1/webhook/configure
Content-Type: application/json
x-api-key: wa_crm_secret_key_2026

{
  "webhookUrl": "https://your-crm.com/api/whatsapp-webhook",
  "secret": "my_crm_signature_secret"
}
```

### 8. Send Test Ping to Configured Webhook
```http
POST /api/v1/webhook/test
Content-Type: application/json
x-api-key: wa_crm_secret_key_2026
```

---

## 🪝 Outbound Webhook Events

When enabled, this microservice POSTs JSON payloads to your configured webhook URL with:
- `x-wa-event`: event name (`message.received`, `message.sent`, `message.status`, `session.status`)
- `x-hub-signature-256`: `sha256=<hex_hmac_hash>` (if secret configured)

### Incoming Customer Message Payload (`message.received`):
```json
{
  "event": "message.received",
  "sessionKey": "708",
  "phone": "919876543210",
  "chatId": "919876543210@c.us",
  "message": {
    "id": "false_919876543210@c.us_3EB0...",
    "body": "Hi, I need pricing details for your service",
    "from": "919876543210@c.us",
    "to": "919123456789@c.us",
    "isMe": false,
    "timestamp": 1727339000,
    "type": "text"
  },
  "timestamp": "2026-09-26T06:05:00.000Z"
}
```

### Message Status Update (`message.status`):
```json
{
  "event": "message.status",
  "sessionKey": "708",
  "messageId": "true_919876543210@c.us_3EB0...",
  "chatId": "919876543210@c.us",
  "phone": "919876543210",
  "status": "read",
  "ack": 3,
  "timestamp": "2026-09-26T06:05:02.000Z"
}
```

---

## 💻 Integration Code Snippets

### Node.js / Express
```javascript
const axios = require('axios');

async function sendWhatsApp(phone, message) {
  const { data } = await axios.post('http://localhost:5001/api/v1/messages/send', {
    phone,
    message
  }, {
    headers: { 'x-api-key': 'wa_crm_secret_key_2026' }
  });
  return data;
}

// Webhook Receiver Express Route:
app.post('/api/whatsapp-webhook', (req, res) => {
  const { event, phone, message } = req.body;
  if (event === 'message.received') {
    console.log(`Received message from ${phone}: ${message.body}`);
    // Save to your CRM database, notify agent, or trigger automation
  }
  res.json({ received: true });
});
```

### Python
```python
import requests

def send_whatsapp(phone, message):
    response = requests.post(
        "http://localhost:5001/api/v1/messages/send",
        headers={"x-api-key": "wa_crm_secret_key_2026"},
        json={"phone": phone, "message": message}
    )
    return response.json()
```

### PHP
```php
function sendWhatsApp($phone, $message) {
    $ch = curl_init("http://localhost:5001/api/v1/messages/send");
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        "phone" => $phone,
        "message" => $message
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json",
        "x-api-key: wa_crm_secret_key_2026"
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $res = curl_exec($ch);
    curl_close($ch);
    return json_decode($res, true);
}
```

### cURL
```bash
curl -X POST "http://localhost:5001/api/v1/messages/send" \
  -H "Content-Type: application/json" \
  -H "x-api-key: wa_crm_secret_key_2026" \
  -d '{"phone": "919876543210", "message": "Test from cURL"}'
```
