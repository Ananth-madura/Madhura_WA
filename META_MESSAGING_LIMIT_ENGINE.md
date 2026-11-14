# Meta Messaging Limit Engine Specification

This document details the mechanics of Meta's 24-hour rolling messaging limit, tier capacity management, SHA-256 recipient tracking, and limit-aware campaign throttling.

---

## 1. Meta Messaging Limit Tiers

Meta enforces daily unique recipient limits for business-initiated conversations outside the 24-hour customer service window:

| Limit Tier | Daily Unique Recipient Capacity | Qualification Criteria |
| :--- | :--- | :--- |
| **TIER_50** | 50 unique contacts / 24h | Unverified Business Portfolio |
| **TIER_250** | 250 unique contacts / 24h | Default starting tier for verified businesses |
| **TIER_1K** | 1,000 unique contacts / 24h | Standard commercial tier |
| **TIER_10K** | 10,000 unique contacts / 24h | High-volume verified commercial tier |
| **TIER_100K** | 100,000 unique contacts / 24h | Enterprise broadcast tier |
| **TIER_UNLIMITED** | Unlimited unique contacts / 24h | Verified high-reputation enterprise tier |

---

## 2. Shared Limit Architecture Across Phone Numbers

A foundational Meta rule governs multi-number environments:
> **The daily recipient limit is enforced at the WABA / Business Portfolio level, not per phone number.**

If a business connects 5 phone numbers under a WABA with `TIER_250`:
- Number 1 dispatches to 100 unique contacts.
- Number 2 dispatches to 100 unique contacts.
- Number 3 dispatches to 50 unique contacts.
- **The daily limit of 250 is now exhausted.** Numbers 4 and 5 cannot initiate new business-initiated conversations until the 24-hour rolling window frees slots.
- Madhura enforces this unified quota centrally in `backend/services/metaMessagingLimitEngine.js`.

---

## 3. 24-Hour Rolling Recipient Window

### 3.1 Mechanics & Privacy Hashing
1. When a business-initiated message is dispatched, the recipient's normalized E.164 phone number is hashed using SHA-256:
   ```javascript
   const phoneHash = crypto.createHash("sha256").update(cleanedPhone).digest("hex");
   ```
2. The hash is recorded in `meta_recipient_window` with an expiry timestamp 24 hours into the future:
   ```sql
   INSERT INTO meta_recipient_window (tenant_id, account_id, phone_hash, first_contact_at, window_expires_at, is_service_window)
   VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 0);
   ```
3. **Re-messaging Exemption**: If the business messages the same contact multiple times within that 24-hour window, it **does not** count as an additional unique recipient.
4. **Customer Service Window Exemption**: If a contact messages the business first, messages sent by the business within 24 hours are classified as customer-initiated (`is_service_window = 1`) and **do not count** against the daily recipient limit.

---

## 4. Pre-Flight Dispatch Protection & Campaign Scheduler

### 4.1 Decision Matrix
Before sending any message:
```
[Inbound customer message within 24h?]
      |-- YES --> ALLOW (Service Window Exemption)
      |-- NO  --> [Recipient already in 24h active window?]
                      |-- YES --> ALLOW (Already counted)
                      |-- NO  --> [Current 24h unique count >= Max Daily Limit?]
                                      |-- YES --> BLOCK (MESSAGING_LIMIT_REACHED)
                                      |-- NO  --> ALLOW (Increment counter)
```

### 4.2 Graceful Campaign Throttling
When a scheduled broadcast campaign hits the daily recipient ceiling:
1. The campaign status transitions to `paused_limit_reached`.
2. Outbound jobs are held in the database queue without failure or penalty.
3. As earlier recipient windows roll past 24 hours, the scheduler resumes queued messages automatically.
