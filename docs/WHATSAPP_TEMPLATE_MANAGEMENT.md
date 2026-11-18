# WhatsApp Template Management & Personalization

Implemented in `backend/services/campaign/templateManagementService.js` and `/dashboard/campaigns/templates`.

## WABA Template Lifecycle
- Templates are scoped to `(tenant_id, waba_id)` and synchronized via `GET /{WABA_ID}/message_templates` and submitted via `POST /{WABA_ID}/message_templates`.
- Local saves always create `DRAFT` rows; templates are never marked `APPROVED` locally.
- Supports `TEXT`/`IMAGE`/`VIDEO`/`DOCUMENT` headers, `BODY` with numbered positional variables, `FOOTER`, and `QUICK_REPLY`, `URL`, `PHONE_NUMBER`, and `FLOW` buttons.
- **Anti-Misclassification Guard**: Promotional signals (discounts, flash sales, promo codes) are rejected when category is `UTILITY`.
- **Mid-Campaign Protection**: When Meta updates a template to `REJECTED`, `PAUSED`, `DISABLED`, or `DELETED` (via webhook or sync), active/scheduled campaigns using it are automatically paused and unsent recipients are marked `BLOCKED_BY_TEMPLATE`.

## Personalization (`renderTemplateForRecipient`)
- Resolves contact attributes, custom fields, conditional rules, currency/number/date/timezone formatting, and configured fallbacks.
- By default (`missing_variable_policy = 'exclude'`), recipients with unresolved required variables are excluded rather than sent broken or fabricated text.
