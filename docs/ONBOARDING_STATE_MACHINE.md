# Madhura Onboarding State Machine & Command Center

## Overview

Madhura avoids superficial, visual-only onboarding wizards. Every step displayed in the Onboarding Command Center (`/onboarding`) evaluates verified database state in real time via `GET /api/onboarding/status`.

---

## 1. The 10 Authoritative Setup Milestones

| Step | Milestone | Evaluation Query / DB Condition | Action Route |
| :---: | :--- | :--- | :--- |
| **1** | **Account Verified** | `users.status === 'active'` | `/signup/verify-email` |
| **2** | **Company Profile** | `tenants.name != 'New Organization' AND tenants.timezone IS NOT NULL` | `/onboarding/company` |
| **3** | **Subscription Selected** | `tenants.plan IS NOT NULL` (e.g. 'trial', 'starter', 'growth', 'enterprise') | `/onboarding/plan` |
| **4** | **WhatsApp Connected** | `COUNT(wa_senders WHERE tenant_id = ?) > 0` | `/onboarding/whatsapp/connect` |
| **5** | **Number Registered** | `wa_senders.status IN ('connected', 'ready')` | `/onboarding/whatsapp/numbers` |
| **6** | **Webhook Subscribed** | `wa_senders.waba_id IS NOT NULL` | `/onboarding/whatsapp/connect` |
| **7** | **First Message Verified** | `COUNT(wa_message_logs WHERE tenant_id = ?) > 0` | `/onboarding/whatsapp/test-message` |
| **8** | **Team Configured** | `COUNT(organization_memberships WHERE tenant_id = ?) >= 1` | `/whatsapp/employees` |
| **9** | **CRM Configured** | `COUNT(wa_contacts WHERE tenant_id = ?) > 0 OR settings.crm_configured` | `/whatsapp/contacts` |
| **10** | **Automation Published**| `COUNT(wa_automations WHERE tenant_id = ?) > 0 OR settings.automation_configured` | `/whatsapp/automations` |

---

## 2. Status Calculation Logic

- **Progress Percentage:** `Math.round((completedSteps / 10) * 100)`
- **Core Activation Threshold:** Steps 1 through 7 constitute the foundational operational baseline. Once steps 1-7 are verified, `isComplete` flag returns `true`.
- **Completion Finalization:** Calling `POST /api/onboarding/complete` writes `onboarding_completed: true` and `onboarding_completed_at: ISO8601` to `tenants.settings_json`.

---

## 3. API Contract (`GET /api/onboarding/status`)

```json
{
  "success": true,
  "progress": 70,
  "completedSteps": 7,
  "totalSteps": 10,
  "isComplete": true,
  "steps": [
    {
      "id": 1,
      "key": "account_verified",
      "title": "Account Verified",
      "description": "Madhura master administrator user account confirmed with active credentials.",
      "completed": true,
      "status": "completed",
      "route": "/signup/verify-email",
      "evidence": "Verified as user@company.com"
    }
  ],
  "tenant": {
    "id": 1,
    "name": "Acme Retail Ltd",
    "plan": "growth"
  },
  "senders": [
    {
      "id": 1,
      "phone": "+919876543210",
      "verifiedName": "Acme Support",
      "status": "connected",
      "qualityRating": "GREEN"
    }
  ]
}
```
