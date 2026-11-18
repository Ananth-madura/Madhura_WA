# Madhura Enterprise Campaign API Reference & Security

All endpoints (except Meta webhooks and public tracked redirects) require JWT authentication (`verifyToken`) and fail-closed membership-verified tenant context (`requireTenantContext`). Tenant/workspace IDs from the frontend are never trusted without authorization.

## Core Endpoints
- **Campaigns**: `GET/POST /api/campaigns`, `GET/PATCH/DELETE /api/campaigns/:id`, `POST /api/campaigns/:id/{duplicate,validate,preview,test-send,submit-approval,approve,reject,request-changes,withdraw-approval,schedule,launch,dispatch-batch,pause,resume,cancel,retry-failed}`
- **Execution & Trace**: `GET /api/campaigns/:id/{recipients,exclusions,execution,analytics,attribution,experiments,automation}`
- **Audiences & Import**: `GET/POST /api/campaigns/audiences`, `PATCH /api/campaigns/audiences/:id`, `POST /api/campaigns/audiences/{estimate-live,:id/estimate,:id/preview,import}`, `GET /api/campaigns/audiences/{presets,imports,import/:importId}`
- **Consent & Suppression**: `GET/POST /api/campaigns/consent`, `POST /api/campaigns/consent/{revoke,check,preferences}`, `GET/POST /api/campaigns/suppressions`, `DELETE /api/campaigns/suppressions/:id`
- **Templates**: `GET/POST /api/whatsapp/templates`, `GET /api/whatsapp/templates/:id/status`, `POST /api/whatsapp/templates/{sync,:id/sync,:id/submit}`
- **WhatsApp Flows**: `GET/POST /api/whatsapp/flows`, `GET/PATCH /api/whatsapp/flows/:id`, `POST /api/whatsapp/flows/:id/{validate,publish,deprecate,clone}`, `GET /api/whatsapp/flows/endpoints`, `POST /api/whatsapp/flows/endpoints/provision`, `GET /api/whatsapp/flows/:id/submissions`
- **Provider Gateway**: `GET /api/provider/whatsapp/{status,marketing-status}`, `POST /api/provider/whatsapp/{send,send-template,send-marketing,send-flow}`
- **Flowbots & E-Commerce**: `GET /api/flowbots`, `POST /api/flowbots/:id/attach-to-campaign`, `POST /api/campaigns/ecommerce/events`, `POST /api/campaigns/conversions`
- **Calendar, Approvals, Reports, Settings & Agency**: `GET /api/campaigns/{calendar,approvals,reports,settings,audit,agency/clients}`, `POST /api/campaigns/{approvals/rules,reports,agency/clients}`, `PUT /api/campaigns/settings`
- **Platform Admin Ops (`/api/admin/campaigns`)**: `GET /overview`, `POST /dispatch-controls`, `POST /:campaignId/{pause,retry-failed}`
- **Meta Webhooks (`/api/webhooks/meta`)**: `GET/POST /whatsapp`, `POST /flows/:endpointId`

## Security Controls
1. **Zero Global Fallback**: `providerGateway.resolveAuthorizedSender` rejects unconfigured tenants instead of borrowing global `.env` tokens.
2. **Encrypted Secrets at Rest**: WABA tokens and WhatsApp Flow RSA private keys are encrypted with AES-256-CBC (`cryptoHelper`).
3. **Parameterized SQL Everywhere**: All dynamic filters run via bound parameters or in-process object evaluation (zero raw SQL string interpolation of user values).
4. **Admin & Four-Eyes Guards**: Maker-checker approval prevents creator self-approval; `/api/admin/campaigns` requires administrator roles and writes immutable `campaign_audit_logs`.
