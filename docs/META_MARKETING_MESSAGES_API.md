# Meta Marketing Messages API for WhatsApp Integration

## Separation from Standard Cloud API
Implemented in `backend/services/campaign/marketingMessagesAdapter.js` and `backend/services/campaign/providerGateway.js`.

- Tracks per-WABA onboarding status on `waba_connections`:
  - `marketing_messages_lite_api_status`
  - `marketing_messages_onboarding_status`
  - `marketing_messages_terms_accepted`
  - `marketing_messages_synced_at`
- Supports dynamic Meta enum states (`INELIGIBLE`, `ELIGIBLE`, `ONBOARDED`, `UNKNOWN`, `PENDING_VALID_PAYMENT_METHOD`, `PENDING_INTERNAL_SETUP`, `INELIGIBLE_INACTIVE_OR_RESTRICTED`, plus any future Meta values).
- Synchronizes status via `GET /{API_VERSION}/{WABA_ID}?fields=id,name,marketing_messages_lite_api_status,marketing_messages_onboarding_status` and `account_update` webhooks.

## Routing Policy
- Only `MARKETING` templates on an `ONBOARDED`/`ACTIVE` WABA route to `POST /{API_VERSION}/{PHONE_NUMBER_ID}/marketing_messages`.
- Non-marketing categories (`UTILITY`, `AUTHENTICATION`) always route through standard Cloud API `POST /{API_VERSION}/{PHONE_NUMBER_ID}/messages`.
- If a WABA is not onboarded, the campaign is **blocked** unless `allow_cloud_fallback` is explicitly enabled and recorded in audit logs.
- Marketing optimization is never displayed as enabled until Meta confirms onboarding.
