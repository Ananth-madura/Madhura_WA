# Optional Cross-Channel Fallback (SMS / RCS / Email)

## Overview
Optional fallback channels (`campaign_fallback_channels` and `campaign_fallback_dispatches`) let workspaces reach WhatsApp `FAILED` recipients over SMS, RCS, or Email when explicitly configured and separately consented.

## Compliance & Financial Invariants
1. **Separate Channel Consent Required**: Every dispatch requires a `GRANTED` record in `contact_consents` with channel-specific purpose (`sms_fallback`, `rcs_fallback`, or `email_fallback`). WhatsApp marketing consent alone is NOT sufficient.
2. **Promotional Fallback Blocked by Default**: Sending fallback for a `MARKETING` campaign is blocked (`403 PROMOTIONAL_FALLBACK_BLOCKED`) unless `allow_promotional_fallback` is explicitly enabled on the channel configuration.
3. **Duplicate-Send Guard**: Only `FAILED` WhatsApp recipients are eligible, and `campaign_fallback_dispatches` enforces one dispatch per `(tenant_id, campaign_id, recipient_id, channel)`.
4. **Separate Identifiers & Cost Ledger**: Every fallback dispatch stores its own `channel_message_id`, `provider_name`, `consent_evidence_ref`, `cost_minor`, and `currency` separately from WhatsApp spend records.

## API Reference
- `GET /api/campaigns/recovery/fallback`
- `POST /api/campaigns/recovery/fallback/channels`
- `POST /api/campaigns/recovery/fallback/dispatch`
