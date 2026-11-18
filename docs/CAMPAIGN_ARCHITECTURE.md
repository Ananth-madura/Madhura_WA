# Madhura Enterprise Campaign & Provider Gateway Architecture

## Overview
The Madhura Enterprise Campaign Management System is an event-driven, multi-tenant orchestration engine built inside the existing Madhura Express 5 + Dual MySQL/SQLite + BullMQ + React 19 architecture.

All campaign operations—bulk broadcasts, Meta templates, Meta WhatsApp Flows, Madhura Flowbot conversations, automation journeys, CRM updates, and revenue attribution—share unified identifiers: `(tenant_id, campaign_id, recipient_id, contact_id, execution_id, wamid, flow_token)`.

## Domain Separation (`backend/services/campaign/`)
- **Campaign Management (`campaignManagementService.js`)**: CRUD, versioning, pre-launch validation, cost estimation, multi-sender allocation, agency client isolation.
- **Provider Gateway (`providerGateway.js`)**: Unified tenant-scoped gateway (`sendMessage`, `sendTemplate`, `sendMarketingTemplate`, `sendInteractiveMessage`, `sendFlowMessage`, `sendMedia`, `createTemplate`, `syncTemplates`, `createWhatsAppFlow`, `publishWhatsAppFlow`, `syncPhoneNumber`, `getMessagingLimit`, `getMarketingMessageStatus`, `getDeliveryStatus`). Strictly fail-closed with zero global `.env` credential fallback.
- **Marketing Messages Adapter (`marketingMessagesAdapter.js`)**: Separate Meta Marketing Messages API for WhatsApp onboarding status sync (`marketing_messages_lite_api_status`, `marketing_messages_onboarding_status`) and `POST /{API_VERSION}/{PHONE_NUMBER_ID}/marketing_messages` transport.
- **Audience Engine (`audienceBuilderService.js`)**: Backend nested AND/OR segmentation, presets, immutable audience snapshots, and CSV/XLSX import with consent protection.
- **Consent & Suppression (`consentSuppressionService.js`)**: Evidence-backed consent ledger, keyword opt-out cancellation, and global/workspace/agency/category suppression precedence.
- **Template Management (`templateManagementService.js`)**: WABA-scoped template library, Meta sync/submission, promotional-as-utility prevention, status transition auto-pause, and `TemplateRendererService`.
- **WhatsApp Flows (`whatsappFlowsService.js` + `whatsappFlowCryptoService.js`)**: Meta in-app interactive Forms (distinct from Madhura Flowbot), Flow JSON v6+ schema validator, immutable publish/clone lifecycle, and RSA-OAEP (SHA-256) + AES-128-GCM data exchange.
- **Flowbot & Automation (`campaignJourneyService.js`)**: Persistent Flowbot conversation states with Team Inbox handover, automation triggers/stop-conditions/re-entry policies, and idempotent E-Commerce event ingestion.
- **Execution Engine (`campaignExecutionEngine.js`)**: Recipient materialization, 10-queue BullMQ topology with DB-backed fallback, 14-point just-in-time revalidation, idempotency, error taxonomy, and timeout reconciliation.
- **Approvals, Scheduling & Experiments**: `campaignApprovalService.js`, `campaignSchedulerService.js`, `campaignExperimentService.js`.
- **Webhooks, Analytics & Audit**: `campaignWebhookProcessor.js`, `campaignAnalyticsService.js`, `campaignAuditService.js`.

## Tech Provider Role vs Meta APIs
Madhura acts as the Tech Provider backend coordinating Meta's official Graph APIs using each customer's authorized Business Portfolio, WABA, and phone numbers. Bulk sending is never a single Meta batch call; it is durable job orchestration sending individual personalized API requests per eligible recipient.
