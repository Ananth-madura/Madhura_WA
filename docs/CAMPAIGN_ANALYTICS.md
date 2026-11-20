# Campaign Analytics, Attribution & Webhooks

## Explicit Metric Formulas (`campaignAnalyticsService.js`)
Every analytics response includes exact formula definitions and data freshness timestamps without mixing message counts and unique-recipient counts:
- **Delivered Rate**: `delivered_messages / (delivered_messages + failed_messages)`
- **Read Rate**: `read_messages / delivered_messages`
- **Reply Rate**: `unique_replied_recipients / unique_delivered_recipients`
- **Conversion Rate**: `unique_converted_recipients / unique_delivered_recipients`
- **ROI (%)**: `((verified_attributed_revenue - cost) / cost) * 100`

## Verified Conversion Attribution
- `recordVerifiedConversion` requires an authoritative source entity (`order`, `payment`, `deal`, `appointment`) and `entity_id`, deduplicated via `UNIQUE (tenant_id, entity_type, entity_id)`.
- Only attributes to a `DELIVERED` or `READ` campaign recipient within the configured `attribution_window_hours` (`last_touch` or `first_touch`), storing full evidence in `campaign_attributions` and `campaign_conversions`.
- Tracked redirect links (`/api/campaigns/track/:shortCode`) record genuine clicks in `campaign_tracked_links` & `campaign_engagement_events`.

## A/B Experiment Statistical Honesty (`campaignExperimentService.js`)
- Deterministic SHA-256 hash assignment to variants and optional holdout groups.
- Two-proportion z-test never declares a winner until every variant meets `min_sample_size` delivered recipients and reaches the configured `confidence_level`.

## Webhook Processing (`campaignWebhookProcessor.js` & `metaCampaignWebhookRoutes.js`)
- Per-sender `X-Hub-Signature-256` HMAC-SHA256 verification.
- Deduplication via `UNIQUE (tenant_id, wamid, event_status)`.
- Monotonic status rank guard ensures out-of-order `DELIVERED` arriving after `READ` preserves `READ` status and timestamps.
- Correlates `nfm_reply` WhatsApp Flow submissions by `flow_token`, triggers Flowbot & automations, and handles `message_template_status_update` & `account_update`.


---

## WATI Competitive Upgrade Pack: Advanced 7-Stage Funnel & Granular Trends

Added in `backend/services/campaign/watiUpgrade/guidedSetupAndAnalyticsService.js` and exposed at `GET /api/campaigns/analytics/advanced`:

- **7-Stage Delivery-vs-Engagement Funnel**:
  1. `audience` (total recipients evaluated)
  2. `eligible` (excluding `BLOCKED_BY_CONSENT` and `BLOCKED_BY_SUPPRESSION`)
  3. `submitted` (`ACCEPTED_BY_META`, `SENT`, `DELIVERED`, `READ`)
  4. `delivered`
  5. `read`
  6. `engaged` (replied or completed a WhatsApp Flow)
  7. `converted` (verified attribution)
  Plus tracked `cta_clicks`, `failed`, `estimated_cost_minor`, and `revenue_minor`.
- **Granular Time Buckets**: Supports `granularity=hourly | daily | weekly | monthly` with optional `category`, `sender_id`, `country_code`, `date_from`, and `date_to` filters.
- **Failure Reason Breakdown**: Groups failed recipients into the 13 standardized recovery categories (`rate_limit`, `template_paused`, `invalid_recipient`, `unknown_submission_outcome`, etc.).
