# Madhura Flowbot & Campaign Automation Engine

Implemented in `backend/services/campaign/campaignJourneyService.js`, `backend/services/campaign/campaignWebhookProcessor.js`, `/dashboard/campaigns/flowbots`, and `/dashboard/campaigns/automations`.

## Flowbot Integration
- Campaigns bind to Madhura Flowbots via `campaign_flowbot_bindings`.
- Conversation state persists across server restarts in `flowbot_conversation_states` (`current_node_id`, `collected_answers_json`, `handover_active`, `assigned_agent_id`).
- Human escalation requests automatically pause the bot, activate Team Inbox handover, and stop automated promotional follow-ups.

## Campaign Automation & E-Commerce Journeys
- Bindings (`campaign_automation_bindings`) react to verified campaign events (`customer_replied`, `quick_reply_clicked`, `whatsapp_flow_completed`, `message_delivered`, `abandoned_cart`, `paid_order`, `contact_opted_out`).
- Enforces re-entry policies (`one_time`, `after_completion`, `after_cooldown`, `never`) and unique event deduplication in `campaign_journey_enrollments`.
- Stop conditions (`contact_opted_out`, `order_completed`, `deal_won`, `human_handover`) immediately halt active follow-up journeys.
- E-Commerce webhook ingestion (`POST /api/campaigns/ecommerce/events`) deduplicates by `(tenant_id, provider, idempotency_key)` and stops abandoned-cart sequences automatically upon verified order completion.
