# Multi-Number Architecture & Branch Routing Specification

## Overview

Madhura allows businesses to connect and orchestrate multiple WhatsApp phone numbers within a single enterprise workspace. Numbers can be dedicated to specific branches, assigned to departments (e.g., Sales, Support), or shared in an intelligent outbound sender pool.

---

## 1. Multi-Number Data Architecture

### Database Relationships
- `tenants` (1) ── (N) `waba_connections`
- `waba_connections` (1) ── (N) `wa_senders`
- `wa_senders` (N) ── (M) `sender_branch_assignments` ── (1) `branches`

```
┌──────────────────────────────────────────┐
│             Tenant Workspace             │
└────────────────────┬─────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│ WABA Connection  │   │ WABA Connection  │
│ (Primary Sales)  │   │ (Support Team)   │
└────────┬─────────┘   └────────┬─────────┘
         │                      │
   ┌─────┴─────┐          ┌─────┴─────┐
   ▼           ▼          ▼           ▼
┌───────┐   ┌───────┐  ┌───────┐   ┌───────┐
│Sender1│   │Sender2│  │Sender3│   │Sender4│
└───────┘   └───────┘  └───────┘   └───────┘
```

---

## 2. Branch Routing & Isolation

- **Default Sender Flag (`is_default`):** Primary number used for automated notifications and workspace-wide broadcasts unless overridden.
- **Branch Binding (`sender_branch_assignments`):** Associates a sender exclusively with a branch (e.g. Bangalore Branch, Mumbai Branch).
- **Concurrency & Rate Limit Engine:** Managed by `concurrentSenderEngine.js` to prevent overloading any single Meta phone number ID and to balance conversation throughput across eligible numbers.
- **Quality Rating Isolation:** If a single number encounters a `RED` rating due to high spam reports, the router automatically fails over outbound broadcasts to healthy alternative numbers in the tenant's sender pool.
