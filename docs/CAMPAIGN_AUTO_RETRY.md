# Configurable Auto-Retry Policies

## Overview
Configurable retry policies (`campaign_retry_policies`) allow workspaces to safely re-queue eligible transient failures with exponential backoff and jitter.

## Policy Configuration
- `retry_delays_seconds`: Ordered backoff intervals in seconds (minimum 10s, default `[120, 600, 1800]`).
- `max_attempts`: Bounded between 1 and 5.
- `jitter_pct`: Random jitter percentage (0 to 50%) to prevent thundering-herd retries.
- `deadline_hours`: Maximum retry window (1 to 168 hours).

## Hard Safety Invariants
1. **Permanent errors are never retried** (template rejected, invalid recipient, opted-out, missing permission, billing restriction, invalid variable).
2. **`UNKNOWN_REQUIRES_RECONCILIATION` is never auto-retried** until provider state is reconciled, preventing accidental duplicate billing or double delivery.
3. **Live consent and suppression are re-verified** immediately before every retry enqueue.

## API Reference
- `GET /api/campaigns/recovery/retry-policies`
- `POST /api/campaigns/recovery/retry-policies`
- `POST /api/campaigns/recovery/retry-transient/:campaignId`
