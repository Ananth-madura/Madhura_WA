# API DOCUMENTATION & CONTRACTS
## Madhura Multi-Tenant WhatsApp CRM API Reference

---

### 1. General Principles
- **Base URL**: `http://localhost:5001/api` (Production: `https://live.wa.madhuratech.in/api`)
- **Authentication**: `Authorization: Bearer <JWT>` header required for protected endpoints.
- **Tenant Context**: Passed via `x-tenant-id` header or extracted automatically from user token claims.
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": { ... },
    "error": null
  }
  ```

---

### 2. Core Endpoints Summary

#### 2.1 Authentication & Profile
- `POST /api/auth/login`: Email and password login.
  - Body: `{ "email": "admin@madhuratech.com", "password": "..." }`
  - Returns: `{ "token": "...", "user": { "id": 723, "email": "...", "role": "admin", "tenant_id": 1 } }`
- `POST /api/auth/verify-2fa`: Verify OTP for 2FA-enabled accounts.
- `GET /api/auth/me`: Fetch current authenticated profile, memberships, and active permissions.

#### 2.2 WhatsApp Accounts & Multi-Sender
- `GET /api/whatsapp/accounts/list`: List all connected phone numbers and WABAs for the active organization.
- `POST /api/enterprise/meta/embedded-callback`: Embedded Signup authorization callback.
  - Body: `{ "code": "...", "waba_id": "...", "phone_number_id": "..." }`
- `GET /api/whatsapp/status`: Check current WhatsApp engine connection status.
- `GET /api/whatsapp/qr`: Fetch active QR code for linked-device session.
- `POST /api/whatsapp/reconnect`: Trigger background reconnection.

#### 2.3 Contacts & CRM
- `GET /api/wa/contacts`: List and filter contacts with pagination (`limit`, `offset`, `search`, `tag`).
- `POST /api/wa/contacts`: Create a new contact.
- `PUT /api/wa/contacts/:id`: Update existing contact fields and tags.
- `DELETE /api/wa/contacts/:id`: Soft-delete or archive contact.
- `GET /api/whatsapp/contacts-list`: Fast search across contacts for the live inbox.

#### 2.4 Conversations & Live Messaging
- `GET /api/whatsapp/chats`: Retrieve active conversation list for the active user/role.
- `GET /api/whatsapp/chat/:chatId/messages`: Fetch historical messages for a specific chat.
- `POST /api/whatsapp/chat/:chatId/message`: Send an outbound text message to a conversation.
- `POST /api/whatsapp/chat/:chatId/media`: Send an outbound media attachment.
- `POST /api/whatsapp/chat/:chatId/notes`: Add an internal private note.
- `POST /api/whatsapp/chat/:chatId/assign`: Assign chat to a specific agent or team.

#### 2.5 Campaigns & Broadcasts
- `GET /api/wa/campaigns`: List existing campaigns with status and delivery counters.
- `POST /api/wa/campaigns`: Create and schedule a new broadcast campaign.
- `POST /api/wa/campaigns/:id/send`: Trigger immediate dispatch of a campaign.
- `POST /api/wa/campaigns/:id/pause`: Pause an in-flight campaign.
- `POST /api/wa/campaigns/stop-all`: Emergency stop for all running broadcasts.

#### 2.6 Automations & Chatbot Flows
- `GET /api/wa/automations`: List all configured automation rules.
- `POST /api/wa/automations`: Create a new automation rule with triggers, conditions, and actions.
- `PUT /api/wa/automations/:id`: Update an existing automation rule.
- `GET /api/wa/flows`: List all visual chatbot flows.
- `POST /api/wa/flows`: Create a new flow definition.
- `GET /api/wa/flows/:id`: Fetch flow structure including nodes and connections.
- `PUT /api/wa/flows/:id`: Update flow structure.
- `POST /api/wa/flows/:id/publish`: Publish flow version for live execution.

#### 2.7 Sales CRM & Enquiries
- `GET /api/whatsapp/enquiries`: List enquiries with temperature filtering (`new`, `cold`, `warm`, `hot`).
- `POST /api/whatsapp/enquiries`: Create an enquiry from an incoming lead.
- `POST /api/whatsapp/enquiries/:id/convert`: Convert an enquiry into a client and deal.
- `GET /api/whatsapp/crm-leads`: Search integrated CRM leads (`telecalls`, `walkins`, `fields`).

#### 2.8 Native Integrations & Payments
- `POST /api/wa/payments/create-order`: Generate Razorpay order and payment link.
- `POST /api/wa/payments/verify`: Verify Razorpay webhook or payment signature.
- `POST /api/whatsapp/webhook`: Meta Cloud API inbound webhook endpoint.
- `GET /api/whatsapp/webhook`: Meta Cloud API webhook verification challenge.
