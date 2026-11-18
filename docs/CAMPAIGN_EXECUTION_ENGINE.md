# Campaign Bulk Execution Engine & Queue Architecture

## Dedicated Queue Topology
Defined in `backend/services/campaign/campaignExecutionEngine.js`:
1. `campaign.prepare`
2. `campaign.audience`
3. `campaign.dispatch`
4. `campaign.whatsapp.cloud`
5. `campaign.whatsapp.marketing`
6. `campaign.flowbot`
7. `campaign.automation`
8. `campaign.webhook`
9. `campaign.analytics`
10. `campaign.reconciliation`

Jobs are persisted in `campaign_jobs` with unique `idempotency_key` (`job:cmp:{id}:v{ver}:ex{execId}:p:{phone}`) and atomic claim updates (`WHERE status = 'QUEUED'`) so concurrent workers never double-send a recipient.

## Just-in-Time Pre-Send Revalidation
Immediately before calling Meta for every recipient:
1. Campaign status must be `RUNNING`.
2. Recipient must not already be accepted/sent/delivered/read/reconciling.
3. Live consent & suppression recheck (snapshots never override new opt-outs).
4. Authorized sender, WABA connection & administrative pause controls recheck.
5. Meta template `APPROVED` status & WABA ownership recheck.
6. Shared 24-hour Meta Business-Level unique-recipient limit recheck.
7. Billing mode & wallet fund reservation (only for `provider_managed` tenants).

## Error Taxonomy & Timeout Safety
- **Transient** (HTTP 429/5xx, Graph codes `4, 17, 613, 80007, 130429, 131048, 131056`): retried with recorded backoff in `campaign_retry_records`.
- **Network Timeout (`ECONNABORTED`, `ETIMEDOUT`, `ECONNRESET`, `EPIPE`)**: marked `UNKNOWN_REQUIRES_RECONCILIATION` — never blindly resent, avoiding duplicate customer messages.
- **Permanent** (invalid recipient `131026`, invalid template params `132000`, auth `190`): failed immediately without retry loop.
- **Policy / Operational**: blocked cleanly with explicit `BLOCKED_BY_*` recipient status and audit trail.
