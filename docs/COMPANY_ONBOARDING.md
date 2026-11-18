# Madhura Company and Workspace Setup Specification

## Overview

Step 2 of the activation lifecycle provisions the business legal profile, default operating timezone, and commercial parameters for the enterprise workspace.

---

## 1. Routes & Controllers

- **Route:** `/onboarding/company`
- **Frontend Component:** `frontend/src/pages/onboarding/CompanyOnboarding.jsx`
- **API Endpoint:** `POST /api/onboarding/company`
- **Required Permission:** `workspace.manage` (held by Owner and Administrator roles)

---

## 2. Field Specifications and Validation

| Field | Required | Type | Validation Rules |
| :--- | :--- | :--- | :--- |
| `company_name` | Yes | String | 2 to 120 characters |
| `legal_name` | No | String | Official registered corporate name |
| `brand_name` | No | String | Customer-facing display name |
| `country` | Yes | String | ISO country name, default "India" |
| `timezone` | Yes | String | Valid IANA timezone (e.g., "Asia/Kolkata") |
| `category` | Yes | String | Standard industry classification |
| `gstin` | Conditional | String | Valid Indian 15-character GST format |
| `website` | No | String | Valid URL format |
| `phone` | No | String | E.164 phone number format |

---

## 3. Data Persistence Model

Company updates are committed to the `tenants` table and serialized into `tenants.settings_json`:

```json
{
  "industry": "Retail",
  "category": "Retail",
  "country": "India",
  "gstin": "27AAAPL1234C1ZV",
  "website": "https://example.com",
  "phone": "+919876543210",
  "updated_at": "2026-01-15T10:30:00.000Z"
}
```

Concurrency protection ensures that simultaneous configuration changes update atomically without overriding existing branch assignments.
