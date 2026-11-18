# WhatsApp Phone Number and Business Verification Specification

## Overview

Operating on the WhatsApp Business Platform requires phone number ownership validation and compliance with Meta Business Verification tiers. This document defines how Madhura handles ownership validation and tracks Meta verification statuses.

---

## 1. Phone Number Ownership Verification

### Meta Hosted Challenge Rule
Phone number ownership is validated exclusively inside Meta's embedded interface:
1. Customer inputs physical SIM or landline number.
2. Meta dispatches an SMS OTP or voice call with a 6-digit code.
3. Customer enters the code directly into Meta's popup.

### Explicit Security Restrictions
Madhura strictly adheres to Meta platform rules:
- **No Interception:** Madhura never provides an ordinary web form asking customers to reveal Meta phone verification codes.
- **No Storage:** Madhura never logs, buffers, or stores Meta phone ownership codes.
- **No Bypass:** Phone numbers cannot dispatch messages until verified by Meta.

---

## 2. Meta Business Verification Tracking

Business Verification is an independent Meta compliance review that elevates messaging tier limits. Madhura monitors verification state through the Graph API:

| Status Enum | Meaning | Permitted Operations |
| :--- | :--- | :--- |
| `not_started` | Customer has not submitted documents to Meta | Tier 1 (250 business-initiated conversations / 24 hrs) |
| `pending` | Documents submitted and under Meta review | Tier 1 messaging permitted |
| `verified` | Meta verified legal business entity | Tier 2 (1,000 conversations / 24 hrs) or higher |
| `rejected` | Verification rejected by Meta | Limited to Tier 1; customer advised to appeal |
| `revoked` | Previously verified status revoked | Restricted messaging tier |

Madhura surfaces actual verification states without blocking customers whose accounts are permitted by Meta to operate in initial tiers.
