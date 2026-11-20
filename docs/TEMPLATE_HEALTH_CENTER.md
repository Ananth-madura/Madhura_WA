# Template Health Center

## Overview
The Template Health Center (`/whatsapp/campaigns/template-health`) provides a real-time operational view of every workspace WhatsApp template across `APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, and `DISABLED` states.

## Diagnostics & Actions
- **Live Health Counters & Alerts**: Tracks campaign usage count, draft usage count, last successful delivery timestamp, most recent failure error message, open Meta pacing incidents, and sequential variable checks (`{{1}}`, `{{2}}`, ...).
- **Duplicate Template (`POST /api/campaigns/template-health/:id/duplicate`)**: Creates a clean `DRAFT` copy for safe iteration without mutating live approved templates.
- **Replace Across Draft Campaigns (`POST /api/campaigns/template-health/replace-in-drafts`)**: Swaps a paused or rejected template across all eligible `DRAFT` campaigns using strictly `APPROVED` replacement templates (`409 TEMPLATE_NOT_APPROVED` otherwise).
- **AI Copy Review (`POST /api/campaigns/template-health/suggest-improvements`)**: Suggests copy improvements while preserving Meta template category rules.
