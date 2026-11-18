# Meta WhatsApp Flows Builder & Encrypted Data Exchange

Implemented in `backend/services/campaign/whatsappFlowsService.js`, `backend/services/campaign/whatsappFlowCryptoService.js`, `/api/whatsapp/flows`, `/api/webhooks/meta/flows/:endpointId`, and `/dashboard/campaigns/flows`.

## Distinction from Madhura Flowbot
- **Meta WhatsApp Flows** are interactive multi-screen JSON forms rendered natively inside WhatsApp.
- **Madhura Flowbot** is Madhura's conversational chatbot/decision engine handling replies and post-Flow interactions.

## Flow Lifecycle & Immutability
- `DRAFT` → `VALIDATED` → `PUBLISHED` (immutable!) → `DEPRECATED`.
- Editing a `PUBLISHED` Flow is rejected (`PUBLISHED_FLOW_IMMUTABLE`); operators must `clone` to create a new draft version linked via `previous_flow_id`.
- Schema validator (`validateFlowJson`) enforces official Flow JSON v6+ components and strictly blocks payment-card input fields (`card_number`, `cvv`, `credit_card`).

## Encrypted Data Exchange Protocol
- `provisionEndpointKeys` generates per-tenant RSA-2048 keys and encrypts private keys at rest via `cryptoHelper`.
- `POST /api/webhooks/meta/flows/:endpointId` decrypts `encrypted_aes_key` (RSA-OAEP SHA-256) and `encrypted_flow_data` (AES-128-GCM with 16-byte auth tag), handles Meta `ping` health checks, correlates `flow_token` to `(tenant_id, campaign_id, recipient_id, contact_id)`, and returns AES-GCM encrypted JSON using the bitwise-flipped IV as `text/plain`.
