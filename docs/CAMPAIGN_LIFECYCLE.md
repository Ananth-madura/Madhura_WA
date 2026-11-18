# Madhura Campaign Lifecycle & State Machines

## Campaign States
`DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `SCHEDULED` → `PREPARING` → `RUNNING` → `PAUSED` / `COMPLETED` / `CANCELLED` / `FAILED` / `REJECTED`

- **Versioning**: Every edit increments `current_version` and records a snapshot in `campaign_versions`. Editing critical attributes (`template_id`, `segment_id`, `sender_id`, `waba_id`, `category`, `budget_limit_minor`, `max_recipients`, `whatsapp_flow_id`, `provider_route`) automatically invalidates prior approvals and returns the campaign to `DRAFT`.
- **Freeze on Launch**: Launching freezes the approved version and materializes an immutable `campaign_audience_snapshots` record.
- **Pause / Resume / Cancel**:
  - `PAUSE` stops claiming new jobs, allows in-flight API calls to settle, and preserves all queued/delivered rows.
  - `RESUME` revalidates sender, WABA, and template eligibility before continuing remaining unsent recipients without duplicate sends.
  - `CANCEL` cancels only unsent queued jobs/recipients and preserves immutable execution and delivery history.

## Recipient Execution States
`PENDING` · `ELIGIBILITY_CHECK` · `EXCLUDED` · `WAITING_FOR_SCHEDULE` · `QUEUED` · `RESERVED` · `SUBMITTING` · `ACCEPTED_BY_META` · `SENT` · `DELIVERED` · `READ` · `FAILED` · `BLOCKED_BY_CONSENT` · `BLOCKED_BY_SUPPRESSION` · `BLOCKED_BY_TEMPLATE` · `BLOCKED_BY_SENDER` · `BLOCKED_BY_META_LIMIT` · `BLOCKED_BY_BILLING` · `CANCELLED` · `UNKNOWN_REQUIRES_RECONCILIATION`

API acceptance (`ACCEPTED_BY_META`) is strictly separated from webhook delivery (`DELIVERED`) and read receipts (`READ`).
