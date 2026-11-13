# DATABASE SCHEMA SPECIFICATION
## Madhura Dynamic Multi-Company WhatsApp CRM, Automation & Agency Platform

---

### 1. Database Overview
- **Database Engine**: MySQL 8.0+ / MariaDB 10.5+ (`madhura_wa`)
- **Character Set**: `utf8mb4`
- **Collation**: `utf8mb4_unicode_ci`
- **Fallback Engine**: SQLite 3 adapter (`backend/config/sqliteDatabase.js`)

---

### 2. Core Domain Schemas

#### 2.1 Identity, Tenancy & Access Control
- `tenants`: Primary customer or agency organization.
  - Columns: `id`, `name`, `slug`, `tenant_type` ('agency', 'company'), `parent_tenant_id`, `plan_id`, `status`, `created_at`, `updated_at`.
- `branches`: Physical locations or functional workspaces.
  - Columns: `id`, `tenant_id`, `name`, `code`, `city`, `state`, `is_active`, `created_at`.
- `users`: User profiles with multi-tenant membership.
  - Columns: `id`, `email`, `password`, `first_name`, `last_name`, `role`, `status`, `tenant_id`, `created_at`.
- `organization_memberships`: User-to-tenant mapping with role.
  - Columns: `id`, `tenant_id`, `user_id`, `role` ('organization_owner', 'organization_admin', 'branch_manager', 'agent', 'employee'), `membership_status`, `created_at`.
- `staff_branch_memberships`: User-to-branch scoping.
  - Columns: `id`, `tenant_id`, `branch_id`, `user_id`, `is_primary`, `is_available`, `auto_assign_enabled`.
- `roles` & `permissions` & `role_permissions`: Granular RBAC tables.

#### 2.2 WhatsApp Accounts & Senders (Meta Multi-Account)
- `wa_accounts`: Connected WABAs and individual phone numbers.
  - Columns: `id`, `tenant_id`, `branch_id`, `account_name`, `phone_number`, `phone_number_id`, `waba_id`, `app_id`, `access_token`, `connection_type` ('cloud_api', 'embedded_signup', 'web_session'), `is_active`, `is_default`, `quality_rating`, `messaging_limit`, `created_at`.
- `wa_senders`: Virtual sender identities within sender pools.
  - Columns: `id`, `tenant_id`, `account_id`, `display_name`, `phone_number`, `status`, `daily_limit`, `current_day_count`.
- `sender_branch_assignments`: Mapping senders to branches for outbound routing.
- `wa_anti_ban_settings`: Throttling intervals and batch limits per sender.

#### 2.3 Contacts, Leads & CRM Funnel
- `wa_contacts`: Full WhatsApp contact records.
  - Columns: `id`, `tenant_id`, `branch_id`, `name`, `phone`, `country_code`, `email`, `tags`, `custom_fields`, `opt_in_status`, `source`, `assigned_agent_id`, `lifecycle_stage`, `last_message_text`, `last_message_at`, `unread_count`, `profile_pic_url`.
- `wa_contact_groups`: Groups and segments.
- `wa_group_contacts`: Junction table for group memberships.
- `wa_enquiries`: Lead and enquiry funnel records.
  - Columns: `id`, `tenant_id`, `branch_id`, `contact_id`, `name`, `phone`, `email`, `company`, `source`, `message`, `temperature` ('new', 'cold', 'warm', 'hot'), `status` ('open', 'converted', 'closed'), `converted_client_id`, `created_at`.
- `wa_customer_deals`: Sales pipeline deals.
  - Columns: `id`, `tenant_id`, `contact_id`, `title`, `stage` ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'), `amount`, `expected_close_date`, `created_by`, `created_at`.
- `wa_customer_activities`: Activity timeline for deals and contacts.

#### 2.4 Conversations, Messages & Shared Inbox
- `conversations`: Master thread tracking.
  - Columns: `id`, `tenant_id`, `branch_id`, `contact_id`, `chat_jid`, `assigned_user_id`, `status` ('open', 'snoozed', 'resolved', 'archived'), `last_message_at`.
- `messages`: Message store.
  - Columns: `id`, `tenant_id`, `conversation_id`, `wa_message_id`, `sender_phone`, `recipient_phone`, `message_type` ('text', 'image', 'document', 'audio', 'video', 'interactive', 'template'), `content`, `media_url`, `status` ('pending', 'sent', 'delivered', 'read', 'failed'), `direction` ('inbound', 'outbound'), `created_at`.
- `wa_conversation_shares`: Conversation delegation across agents and teams.
- `wa_internal_notes`: Team-only internal private notes.
- `wa_inbox_reads`: Read receipts tracking per agent.

#### 2.5 Automations & Visual Chatbot Flows
- `wa_automations`: Automation rules.
  - Columns: `id`, `tenant_id`, `title`, `trigger_type`, `conditions_json`, `actions_json`, `is_active`, `created_at`.
- `wa_automation_checkpoints`: Durable execution resumption checkpoints.
- `wa_automation_logs`: Step-by-step execution history and diagnostics.
- `wa_flows`: Visual chatbot flow definitions.
  - Columns: `id`, `tenant_id`, `name`, `description`, `trigger_keyword`, `is_active`, `published_version_id`, `created_at`.
- `wa_flow_nodes`: Flow canvas nodes (start, message, question, condition, api, handover, end).
- `wa_flow_connections`: Directed connections between nodes.
- `wa_flow_runs`: Individual conversation executions of chatbot flows.

#### 2.6 Dynamic Configuration Engine
- `custom_field_definitions`:
  - Columns: `id`, `tenant_id`, `entity_type` ('contact', 'lead', 'customer', 'deal', 'ticket', 'campaign'), `field_name`, `field_label`, `field_type`, `field_options_json`, `validation_rules_json`, `is_required`, `is_unique`, `default_value`, `sort_order`, `created_at`, `updated_at`.
- `custom_field_values`:
  - Columns: `id`, `tenant_id`, `entity_type`, `entity_id`, `field_id`, `field_value_text`, `field_value_number`, `field_value_date`, `field_value_json`, `created_at`, `updated_at`.
- `custom_views`:
  - Columns: `id`, `tenant_id`, `user_id`, `entity_type`, `view_name`, `is_default`, `columns_json`, `filters_json`, `sorting_json`, `created_at`.

---

### 3. Tenant Partitioning & Indexes
Every multi-tenant table includes a composite index:
- `INDEX idx_<table_name>_tenant (tenant_id)`
- `INDEX idx_<table_name>_tenant_created (tenant_id, created_at DESC)`
- `INDEX idx_<table_name>_tenant_phone (tenant_id, phone)` (for contact queries)
