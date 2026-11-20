# Guided First-Campaign Setup Assistant

## Overview
The Guided First-Campaign Assistant (`/whatsapp/campaigns/get-started`) walks a new workspace through every mandatory prerequisite before its first live WhatsApp campaign launch:

1. **Connect Authorized WhatsApp Sender**: Verifies an active WABA connection and connected sender in `/whatsapp/accounts`.
2. **Import or Select Contacts**: Audits existing CRM contacts and flags duplicate phone number groups before broadcast.
3. **Verify Opt-In Consent & DNC Suppression**: Confirms recorded consent evidence in `/whatsapp/campaigns/consent`.
4. **Select or Create an Approved Meta Template**: Checks approved vs pending Meta templates in `/whatsapp/templates`.
5. **Create, Validate & Launch First Campaign**: Direct handoff into `/whatsapp/campaigns/create`.

## Pending Meta Template Approval Watch
When a campaign uses a template whose `meta_status` is `PENDING`:
- Save the campaign draft and register a watch via `POST /api/campaigns/get-started/watch-approval`.
- `campaign_pending_auto_launches` tracks `auto_launch_enabled`, `status`, and `last_blockers_json`.
- On Meta `message_template_status_update` webhooks (or manual `POST /api/campaigns/get-started/evaluate-pending`):
  - If rejected or disabled, the watch transitions to `REJECTED` and never launches.
  - If approved, full pre-launch validation (`validateAndPreview`) runs again.
  - If `auto_launch_enabled` is false, status becomes `READY` for manual review.
  - Automatic launch executes only when explicitly enabled by the user AND zero validation blockers remain.

## API Reference
- `GET /api/campaigns/get-started/status`
- `POST /api/campaigns/get-started/watch-approval`
- `POST /api/campaigns/get-started/evaluate-pending`
