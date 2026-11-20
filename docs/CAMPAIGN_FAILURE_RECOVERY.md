# Smart Failure Recovery & Meta Template Pacing

## Overview
The Failure Recovery Center (`/whatsapp/campaigns/recovery`) classifies failed and blocked recipients across 13 failure categories and manages safe recovery when Meta pauses or paces a template.

## 13 Failure Categories
- **Retryable Transient**: `temporary_network`, `rate_limit`, `provider_outage`, `recipient_unavailable`
- **Reconciliation Required (Never Auto-Retried)**: `unknown_submission_outcome` (`UNKNOWN_REQUIRES_RECONCILIATION`)
- **Permanent (Never Auto-Retried)**: `template_rejected`, `template_paused`, `invalid_recipient`, `invalid_variable`, `sender_disconnected`, `missing_permission`, `policy_restriction`, `billing_restriction`

## Meta Template Pacing Recovery Workflow
1. When Meta returns pacing/quality pause codes (`132015` or `132016`), `campaignWebhookProcessor` calls `failureRecoveryService.handleTemplatePacingDetected`.
2. Active dispatch for the affected campaign pauses cleanly (`status = 'PAUSED'`) without modifying already-accepted or delivered recipients.
3. An incident record is stored in `campaign_template_pacing_incidents` with `preserved_accepted_count` and `affected_pending_count`.
4. To recover, operators select an `APPROVED` replacement template (`POST /api/campaigns/recovery/pacing-incident/:id/recover`). Non-approved templates are rejected (`409 TEMPLATE_NOT_APPROVED`).
5. Madhura revalidates consent and suppression for ONLY unsent/failed recipients, creates a linked recovery segment and recovery campaign draft, and preserves all already-sent contacts without duplicate messaging.
