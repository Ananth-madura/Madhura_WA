# Audience Segmentation & Snapshots

Implemented in `backend/services/campaign/audienceBuilderService.js` and `/dashboard/campaigns/audiences`.

## Backend-Only Evaluation
- All segment queries run exclusively on the backend against tenant-scoped `wa_contacts`, `wa_contact_groups`, and static lists—the frontend never downloads full contact lists to compute campaign audiences.
- Supports nested `AND` / `OR` condition groups, inclusion and exclusion rules, tags, custom fields (`custom_fields.*`), dates (`within_days`, `older_than_days`, `before`, `after`), numeric comparisons (`gt`, `gte`, `lt`, `lte`), and text operators.
- Built-in reusable presets: `new_leads`, `vip_customers`, `interested_product`, `inactive_customers`, `abandoned_cart`, `recent_buyers`.

## Controlled Audience Snapshots
- When a campaign launches or schedules, an immutable `campaign_audience_snapshots` row records `segment_version`, `total_matched`, `unique_phones`, `duplicate_count`, `invalid_phone_count`, `no_consent_count`, `opted_out_count`, `suppressed_count`, and `eligible_count`.
- Every excluded contact is persisted in `campaign_recipient_exclusions` with an explicit `reason_code`.
- Snapshots never override subsequent opt-outs or suppressions at send time.
