# Smart Behavioral Retargeting Engine

## Overview
The Smart Behavioral Retargeting Engine (`/whatsapp/campaigns/retargeting`) converts verified campaign engagement events into reusable static audience segments and linked follow-up campaign drafts.

## Supported Engagement Segments (11)
1. `delivered_not_read` (distinguishes unknown read receipts from confirmed unread)
2. `read_not_replied`
3. `replied`
4. `cta_clicked` (strictly sourced from `campaign_tracked_links.click_count > 0`, never inferred from delivery)
5. `flow_submitted`
6. `flow_not_completed`
7. `converted`
8. `not_converted`
9. `failed_delivery`
10. `unresolved_delivery` (`UNKNOWN_REQUIRES_RECONCILIATION`)
11. `opted_out` (audit-only segment; never eligible for outbound sends)

## Safety & Compliance Guards
- **Live Consent & DNC Recheck**: Every matched contact is re-checked against `contact_consents` and `contact_suppressions` at preview and creation time.
- **24-Hour Frequency Cap**: Contacts who hit `campaign_settings.max_messages_per_contact_24h` are excluded.
- **Anti-Repeat History**: `campaign_retargeting_history` enforces `UNIQUE (tenant_id, source_campaign_id, engagement_segment, normalized_phone)` so the same contact never receives the same follow-up twice.

## API Reference
- `GET /api/campaigns/retargeting/overview`
- `POST /api/campaigns/retargeting/preview`
- `POST /api/campaigns/retargeting/create-campaign`
- `POST /api/campaigns/retargeting/rules`
