# Financial Security, Encryption & Compliance Guide

This document details the security safeguards, token encryption standards, privacy hashing, and RBAC permission enforcement protecting Madhura's billing systems.

---

## 1. Cryptographic Standards & Key Management

### 1.1 AES-256-GCM Token Encryption
Meta System User Access Tokens and third-party API credentials are encrypted prior to database insertion:
- **Algorithm**: `aes-256-gcm`
- **Key Derivation**: 32-byte secret key configured via environment variable `SMTP_ENCRYPTION_KEY`
- **Initialization Vector**: Cryptographically random 12-byte IV per encryption operation
- **Authentication Tag**: 16-byte authentication tag ensuring integrity and non-malleability
- **Storage Serialization**: `iv_hex:auth_tag_hex:ciphertext_hex`

```javascript
const crypto = require("crypto");

function encryptToken(plainText, keyHex) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}
```

### 1.2 Phone Number Privacy Hashing
To satisfy privacy regulations (GDPR, India DPDP Act), destination phone numbers tracked in the 24-hour rolling messaging limit window are irreversibly hashed:
- **Algorithm**: SHA-256
- **Normalization**: Strip non-digit characters prior to hashing
- The plaintext phone number is not required to evaluate unique 24-hour recipient counts.

---

## 2. Role-Based Access Control (RBAC)

Financial and subscription endpoints are gated by strict granular permissions:

| Permission | Permitted Roles | Actions Allowed |
| :--- | :--- | :--- |
| `billing.read` | Owner, Admin, Billing Manager | View plans, current quotas, invoices, and rate cards |
| `billing.manage` | Owner, Billing Manager | Upgrade plans, initiate top-ups, switch billing modes, alter spending limits |

Agents, supervisors, and guest members cannot access checkout sessions or modify spending limits.

---

## 3. PCI-DSS Compliance & Gateway Isolation

Madhura minimizes PCI-DSS scope:
1. **Zero Card Storage**: No primary account numbers (PAN), CVVs, or bank credentials ever touch Madhura servers or databases.
2. **Hosted Payment Fields**: Razorpay Standard and Stripe Elements handle all card data collection within sandboxed, PCI-DSS Level 1 compliant iframes.
3. **Webhook Authenticity**: Ingress webhooks require verified HMAC signatures before triggering ledger modifications.
