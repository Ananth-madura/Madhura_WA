# Campaign Scheduling, Approvals, Billing & Agency Isolation

## Scheduling & Quiet Hours (`campaignSchedulerService.js`)
- Stores all schedules in UTC (`campaign_schedules.run_at_utc`, `next_run_at_utc`) while retaining `timezone` and `use_recipient_local_time`.
- Configurable quiet hours, allowed weekdays, and holiday calendars via `campaign_settings` (`isWithinQuietHours`).
- Supports `once` and `recurring` (daily/weekly/monthly) schedules with unique execution instances.

## Enterprise Approvals (`campaignApprovalService.js`)
- Multi-stage rules (`campaign_approval_rules`) triggered by recipient count, estimated cost, category, or campaign type.
- **Four-Eyes Maker-Checker**: When `require_four_eyes = 1`, campaign creator/submitter cannot approve their own campaign (`FOUR_EYES_VIOLATION`).
- Full decision audit trail (`campaign_approval_events`) and automatic invalidation on critical campaign edits.

## Dual Billing Integration (`metaBillingModeService.js` + `watiWalletService.js`)
- **Direct Meta Billing (`direct_meta`)**: Shows country/category Meta cost estimates and disclaimers without deducting Meta charges from an unrelated Madhura wallet.
- **Provider-Managed Billing (`provider_managed`)**: Atomically reserves funds in `wallet_accounts` (`reserveFunds`), settles only upon confirmed billable `DELIVERED`/`READ` webhooks (`settleReservation`, deduplicated via `campaign_spend_records`), and releases reservations on confirmed `FAILED` webhooks (`releaseReservation`).

## Agency Multi-Client Isolation (`campaign_agency_clients`)
- Explicit tenant links enforce that Client B cannot access Client A's campaigns, contacts, templates, senders, budgets, or reports.
