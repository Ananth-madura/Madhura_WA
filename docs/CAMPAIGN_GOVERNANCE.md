# Campaign Governance, Approvals & Safety Invariants

## Overview
Madhura Campaigns enforces enterprise-grade governance across bulk broadcasts, behavioral retargeting, multi-step drip sequences, auto-retry, and optional fallback channels.

## Core Governance Controls
- **Four-Eyes Approval & Version Pinning**: Editing a campaign after approval invalidates prior approval until re-approved.
- **Consent Evidence & Suppression Precedence**: Marketing consent requires verifiable evidence in `contact_consents`. Suppression (`contact_suppressions`) and opt-out keywords (`STOP`, `UNSUBSCRIBE`, `CANCEL`) immediately override positive segments, cancel queued campaign jobs, and exit active drip sequence enrollments.
- **Separate Channel Consent for Fallbacks**: SMS, RCS, and Email fallbacks require separate `sms_fallback`, `rcs_fallback`, or `email_fallback` consent records and block promotional fallback unless explicitly enabled.
- **Strict Tenant Isolation**: Every query and service call validates `tenant_id` via `assertTenantId` and authenticated `requireTenantContext` + `requireBranchScope` middleware.
- **No Unreviewed AI Auto-Launch**: AI blueprints, audience drafts, and next-best-action recommendations always require human review and never bypass approval or compliance checks.
- **No Duplicate Sending on Ambiguous Outcomes**: `UNKNOWN_REQUIRES_RECONCILIATION` records are excluded from auto-retry until reconciled.
