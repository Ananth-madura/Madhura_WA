# AI Campaign Assistant

## Overview
The AI Campaign Assistant (`/whatsapp/campaigns/ai-assistant`) accelerates campaign creation, template review, audience drafting, and live analytics analysis without compromising Meta compliance or human approval controls.

## Capabilities
1. **Campaign Blueprint Generator (`POST /api/campaigns/ai-assistant/propose-campaign`)**: Converts a business goal into a reviewable campaign draft matched against real tenant approved templates, active Flowbots, automations, and groups (`requires_user_review: true`, `auto_launched: false`).
2. **Audience Segment Draft (`POST /api/campaigns/ai-assistant/propose-audience`)**: Translates natural-language targeting into structured CRM segment rules while enforcing `consent_enforced: true` and `dnc_enforced: true`.
3. **Template Quality & Policy Reviewer (`POST /api/campaigns/ai-assistant/evaluate-template`)**: Audits variable sequencing, personalization, length, call-to-action clarity, and flags promotional language inside `UTILITY` templates. Preserves Meta category rules and includes an explicit disclaimer that suggestions do not guarantee Meta approval.
4. **Live Performance Q&A (`POST /api/campaigns/ai-assistant/ask`)**: Answers questions directly from live tenant `campaigns` metrics with explicit `calculation_method` and `date_range`.
5. **Next-Best-Action Recommendations (`GET /api/campaigns/ai-assistant/recommendations`)**: Surfaces open pacing incidents, high-reply retargeting opportunities, and high-failure templates with `auto_launch_permitted: false`.
