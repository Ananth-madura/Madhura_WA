# Database Financial Ledger & Schema Architecture

This document details the relational database schema, tables, foreign keys, indexes, and constraints supporting multi-tenant billing, limits, and rate cards.

---

## 1. Schema Entity Relationship

```
+--------------------------+
|         tenants          |
+--------------------------+
             |
             +-----------------------+-----------------------+
             |                       |                       |
             v                       v                       v
+--------------------------+ +-------------------+ +--------------------------+
| tenant_billing_profiles  | |  wallet_accounts  | |  meta_messaging_limits   |
+--------------------------+ +-------------------+ +--------------------------+
                                     |                       |
                                     v                       v
                             +-------------------+ +--------------------------+
                             |  wallet_entries   | |  meta_recipient_window   |
                             +-------------------+ +--------------------------+
                                     |
                                     v
                             +--------------------------+
                             | message_billing_records  |
                             +--------------------------+
                                     |
                                     v
                             +--------------------------+
                             |service_message_allowances|
                             +--------------------------+
```

---

## 2. Table Definitions

### 2.1 `tenant_billing_profiles`
Maintains the organization's billing mode, currency, and spending constraints:
```sql
CREATE TABLE IF NOT EXISTS tenant_billing_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  billing_mode VARCHAR(40) NOT NULL DEFAULT 'direct_meta',
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  meta_payment_method_status VARCHAR(40) NOT NULL DEFAULT 'not_configured',
  meta_account_status VARCHAR(40) NOT NULL DEFAULT 'active',
  credit_line_status VARCHAR(40) NOT NULL DEFAULT 'none',
  auto_recharge_enabled TINYINT NOT NULL DEFAULT 0,
  auto_recharge_trigger_minor INT NOT NULL DEFAULT 50000,
  auto_recharge_amount_minor INT NOT NULL DEFAULT 200000,
  monthly_spending_limit_minor INT NOT NULL DEFAULT 10000000,
  low_balance_alert_thresholds_json TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id)
);
```

### 2.2 `pricing_rate_cards`
Maintains versioned category rates per country:
```sql
CREATE TABLE IF NOT EXISTS pricing_rate_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  country_code VARCHAR(10) NOT NULL,
  country_name VARCHAR(100) DEFAULT NULL,
  category VARCHAR(40) NOT NULL,
  rate_minor INT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to DATETIME DEFAULT NULL,
  version INT NOT NULL DEFAULT 1,
  source VARCHAR(120) NOT NULL DEFAULT 'meta_published_rate_card_2026',
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 `meta_messaging_limits`
Tracks daily recipient limits per WABA:
```sql
CREATE TABLE IF NOT EXISTS meta_messaging_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  account_id VARCHAR(100) DEFAULT NULL,
  waba_id VARCHAR(100) DEFAULT NULL,
  meta_business_id VARCHAR(100) DEFAULT NULL,
  tier VARCHAR(50) NOT NULL DEFAULT 'TIER_250',
  max_daily_recipients INT NOT NULL DEFAULT 250,
  used_daily_recipients INT NOT NULL DEFAULT 0,
  rolling_window_hours INT NOT NULL DEFAULT 24,
  status VARCHAR(50) NOT NULL DEFAULT 'healthy',
  last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(60) NOT NULL DEFAULT 'meta_graph_api',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 `meta_recipient_window`
Tracks 24-hour rolling unique recipients:
```sql
CREATE TABLE IF NOT EXISTS meta_recipient_window (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  account_id VARCHAR(100) DEFAULT NULL,
  waba_id VARCHAR(100) DEFAULT NULL,
  phone_hash VARCHAR(64) DEFAULT NULL,
  recipient_phone_hash VARCHAR(64) DEFAULT NULL,
  first_contact_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_contacted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  window_expires_at DATETIME DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  is_service_window TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.5 `service_message_allowances`
Enforces October 1, 2026 free 1,000 service messages/month per number:
```sql
CREATE TABLE IF NOT EXISTS service_message_allowances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  phone_number_id VARCHAR(64) NOT NULL DEFAULT 'default',
  sender_id INT DEFAULT NULL,
  billing_month VARCHAR(10) NOT NULL,
  used_service_messages INT NOT NULL DEFAULT 0,
  free_allowance_limit INT NOT NULL DEFAULT 1000,
  billable_messages_used INT NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, phone_number_id, billing_month)
);
```

---

## 3. High-Performance Indexing Strategy

1. **`meta_recipient_window` Index**:
   - `INDEX idx_rolling_check (tenant_id, phone_hash, window_expires_at)`: Accelerates pre-flight duplicate recipient lookups to sub-millisecond speeds.
2. **`message_billing_records` Index**:
   - `INDEX idx_msg_status (tenant_id, status, created_at)`: Supports rapid monthly spending calculations and settlement reconciliations.
3. **`service_message_allowances` Unique Key**:
   - `UNIQUE (tenant_id, phone_number_id, billing_month)`: Eliminates duplicate month rows per sender.
