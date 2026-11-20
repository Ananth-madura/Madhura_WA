# Multi-Step Drip Campaign Sequences

## Overview
Drip Campaign Sequences (`/whatsapp/campaigns/sequences`) orchestrate persistent multi-step WhatsApp journeys with durable delay states, stop conditions, reply routing, and step-level funnel analytics.

## Supported Step Types
- `template`, `free_form`, `interactive`, `whatsapp_flow`
- `delay` (minutes, hours, days, or `specific_date`)
- `condition` (evaluated via `conditionEvaluator`)
- `flowbot`, `automation`, `human_handover`, `end`

## Durable Wait Execution
- When an enrollment hits a `delay` step, its `status` transitions to `WAITING_DELAY` with a persisted ISO timestamp in `drip_sequence_enrollments.next_run_at`.
- The backend 30-second worker tick calls `dripSequenceService.processDueEnrollments()`, resuming due enrollments cleanly across server restarts.
- Before every outbound message step, `serviceWindowService.checkOutboundEligibility` re-verifies consent, suppression, and Meta 24-hour session rules.

## Stop Conditions & Reply Routing
- Supported stop events: `opt_out`, `suppressed`, `purchase`, `deal_won`, `payment_succeeded`, `reply`, `human_support`, `campaign_cancelled`, `expired`.
- `reply_behavior` supports:
  - `stop`: exits the sequence on customer reply.
  - `route_flowbot`: keeps tracking and logs `REPLIED` while routing the customer into the bound Flowbot.
  - `route_inbox`: hands off to Team Inbox.
- Meta inbound `STOP`/opt-out and reply webhooks in `campaignWebhookProcessor.js` automatically notify `dripSequenceService.handleStopEvent`.

## API Reference
- `GET /api/campaigns/sequences`
- `POST /api/campaigns/sequences`
- `GET /api/campaigns/sequences/:id`
- `PATCH /api/campaigns/sequences/:id/status`
- `POST /api/campaigns/sequences/:id/duplicate`
- `POST /api/campaigns/sequences/:id/enroll`
- `POST /api/campaigns/sequences/stop-event`
- `POST /api/campaigns/sequences/process-due`
