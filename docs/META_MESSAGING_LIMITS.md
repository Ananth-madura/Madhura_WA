# Meta Messaging Limits & Multi-Number Routing

## Shared Business-Level 24-Hour Rolling Limit
Integrated with `backend/services/metaMessagingLimitEngine.js`:
- Meta's rolling 24-hour unique-recipient limit outside the customer service window applies at the **Business Portfolio / WABA level** and is **shared across all phone numbers owned by the business**.
- Madhura coordinates all campaign send queues against `meta_messaging_limits` and `meta_recipient_window` (SHA-256 phone hashes).
- Adding multiple WhatsApp phone numbers **never** multiplies the Meta unique-recipient limit.
- Technical API throughput (`rate_limit_per_sec`, queue concurrency) is controlled independently of the 24-hour unique-recipient tier.

## Multi-Number Routing Modes
Configured via `campaigns.sender_mode` and `campaign_senders`:
- `single`: One explicitly authorized phone number.
- `team`: Senders assigned to the workspace/branch.
- `manual_distribution`: Weighted distribution across authorized senders under shared business capacity accounting.
- `rule_based` / `fallback`: Explicit authorized sender selection after full WABA/tenant/health revalidation.
