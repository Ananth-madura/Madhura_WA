# MASTER ARCHITECTURE SPECIFICATION
## Madhura Dynamic Multi-Company WhatsApp CRM, Automation & Agency Platform

---

### 1. Architectural Principles

1. **Strict Multi-Tenancy**: Every business record (contacts, leads, conversations, senders, automations, campaigns) is partitioned by `tenant_id`. No cross-tenant data leakage is permitted.
2. **Multi-Account & Multi-Sender Concurrency**: Multiple WhatsApp Business Accounts (WABAs) and 5+ phone numbers can be linked to a single tenant and operated simultaneously.
3. **Event-Driven Interconnection**: Modules communicate through durable message queues and shared event buses (`crmEventBus.js`, BullMQ `waQueue.js`).
4. **Dynamic Extensibility**: Field definitions, layouts, validation rules, tags, and workflow actions are stored in the database rather than hardcoded in the frontend.
5. **No Simulations**: All operations interact with real MySQL tables and the live Meta Cloud API.

---

### 2. High-Level System Architecture

```
                    ┌────────────────────────────────────────┐
                    │            Client Browsers             │
                    │  React 18 SPA (Port 3001) / TailWind   │
                    └───────────────────┬────────────────────┘
                                        │ HTTPS / WebSocket (Socket.IO)
                                        ▼
                    ┌────────────────────────────────────────┐
                    │         Reverse Proxy / CORS           │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           Node.js / Express Backend (Port 5001)                  │
├───────────────────────────────────────┬──────────────────────────────────────────┤
│           Security & Auth             │            Domain Services               │
│  • JWT Auth & Session Mgmt            │  • WhatsApp CRM & Contacts               │
│  • RBAC & ABAC Enforcer               │  • Team Inbox & Shared Chats             │
│  • Tenant & Branch Scoping            │  • Visual Automation & Flow Engine       │
│  • Rate Limiting & BlastGuard         │  • Campaign Dispatcher & Pacing          │
│  • Webhook Signature Verifier         │  • AI RAG & Knowledge Base Engine        │
│                                       │  • Sales Deals & Pipelines               │
├───────────────────────────────────────┼──────────────────────────────────────────┤
│             Async Workers             │           Gateway Connectors             │
│  • BullMQ Broadcast Queue             │  • Meta Graph API v21.0 Client           │
│  • Scheduled Follow-ups & Reminders   │  • Meta Embedded Signup Flow             │
│  • Inbound Webhook Ingestion          │  • Razorpay Payment Gateway              │
│  • Auto-retry & Dead Letter Handler   │  • Shopify / WooCommerce Webhooks        │
└───────────────────────────────────────┴───────────────────┬──────────────────────┘
                                                            │
                            ┌───────────────────────────────┴──────────────────────────────┐
                            ▼                                                              ▼
        ┌───────────────────────────────────────┐                      ┌───────────────────────────────────────┐
        │       Primary Relational Store        │                      │           External Services           │
        │  MySQL (madhura_wa) / SQLite Fallback │                      │  • Meta Cloud API (graph.facebook.com)│
        │  • 170+ Normalized Tables             │                      │  • Cloudflare R2 / S3 Object Storage  │
        │  • Tenant-partitioned Indexes         │                      │  • Redis (BullMQ Queue)               │
        └───────────────────────────────────────┘                      └───────────────────────────────────────┘
```

---

### 3. Core Subsystems

#### 3.1 Tenant & Workspace Hierarchy
- **Platform**: Top-level administrative oversight.
- **Agency**: A tenant of type `agency` capable of provisioning child client companies.
- **Client Company**: An independent organization with its own billing, senders, contacts, and members.
- **Branches / Workspaces**: Physical or departmental units within a company (e.g. Head Office, West Branch).
- **Teams**: Specialized agent groups within a workspace (e.g., Sales, Tier-1 Support).
- **Users**: Multi-membership identity with fine-grained role assignments per organization and branch.

#### 3.2 Meta WhatsApp Cloud API Gateway
- Customer connects via **Facebook Login for Business (Embedded Signup)**.
- Backend exchanges OAuth code for System User Access Token and stores encrypted tokens in `wa_accounts`.
- Discovers WABA and registered phone numbers via Graph API.
- Automatically subscribes WABA to `messages`, `message_deliveries`, and `message_template_status_update` webhooks.
- Multi-sender engine dispatches concurrent broadcasts across numbers, respecting Meta's per-number throughput tiers.

#### 3.3 Event Bus & Interconnected Workflows
When a message arrives:
```
Meta Webhook Ingested -> HMAC Verified -> Deduped
  └── Inbound Message Logged
        ├── Contact Resolved / Created (Module 1: CRM)
        ├── Lead Score & Lifecycle Updated (Module 1 & 7)
        ├── Conversation Updated & Assigned (Module 2: Team Inbox)
        ├── Workflow Triggers Fired (Module 3: Automations)
        ├── Flow Evaluated (Module 4: Chatbot Builder)
        └── AI Intent Evaluated (Module 6: AI Platform)
```

---

### 4. Scalability & Resilience Design
- **Idempotent Webhooks**: Message delivery receipts and inbound payloads check `wa_webhook_claims` to eliminate duplicate processing.
- **Anti-Ban Throttling**: Pacing delays between sequential sends, warm-up ramping for newly registered numbers, and automatic pause on error spikes.
- **Durable Checkpoints**: Long-running multi-day workflows persist state in `wa_automation_checkpoints`.

