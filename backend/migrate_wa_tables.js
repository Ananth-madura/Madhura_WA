const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "127.0.0.1",
  port: 3306,
  user: "achme_user",
  password: "AchmeSecure@2024",
  database: "achme",
  charset: "utf8mb4",
  multipleStatements: true,
});

const tables = [
  `CREATE TABLE IF NOT EXISTS wa_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'MARKETING',
    language VARCHAR(10) DEFAULT 'en',
    header_type VARCHAR(50) DEFAULT NULL,
    header_value TEXT DEFAULT NULL,
    body TEXT NOT NULL,
    footer TEXT DEFAULT NULL,
    button_type VARCHAR(50) DEFAULT NULL,
    buttons JSON DEFAULT NULL,
    meta_template_id VARCHAR(100) DEFAULT NULL,
    meta_status VARCHAR(50) DEFAULT 'APPROVED',
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS wa_contact_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    total_contacts INT DEFAULT 0,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS wa_group_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    name VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(20) NOT NULL,
    country_code VARCHAR(5) DEFAULT '91',
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES wa_contact_groups(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS wa_campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    type ENUM('text','template','media') DEFAULT 'text',
    template_id INT DEFAULT NULL,
    message_text TEXT DEFAULT NULL,
    media_type VARCHAR(20) DEFAULT NULL,
    media_url TEXT DEFAULT NULL,
    group_id INT DEFAULT NULL,
    status ENUM('draft','scheduled','running','completed','paused','failed') DEFAULT 'draft',
    scheduled_at DATETIME DEFAULT NULL,
    started_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    total_contacts INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    read_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS wa_campaign_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    contact_name VARCHAR(255) DEFAULT NULL,
    message_text TEXT DEFAULT NULL,
    template_name VARCHAR(255) DEFAULT NULL,
    template_components JSON DEFAULT NULL,
    status ENUM('queued','sent','delivered','read','failed') DEFAULT 'queued',
    wa_message_id VARCHAR(255) DEFAULT NULL,
    error TEXT DEFAULT NULL,
    sent_at DATETIME DEFAULT NULL,
    delivered_at DATETIME DEFAULT NULL,
    read_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS wa_message_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT DEFAULT NULL,
    campaign_message_id INT DEFAULT NULL,
    phone VARCHAR(20) NOT NULL,
    direction ENUM('outbound','inbound') DEFAULT 'outbound',
    message_type ENUM('text','template','media','interactive') DEFAULT 'text',
    message_text TEXT DEFAULT NULL,
    template_name VARCHAR(255) DEFAULT NULL,
    wa_message_id VARCHAR(255) DEFAULT NULL,
    status ENUM('queued','sent','delivered','read','failed') DEFAULT 'queued',
    error TEXT DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    sent_at DATETIME DEFAULT NULL,
    delivered_at DATETIME DEFAULT NULL,
    read_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS wa_webhook_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(100) DEFAULT NULL,
    wa_message_id VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    status VARCHAR(50) DEFAULT NULL,
    payload JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

db.connect((err) => {
  if (err) {
    console.error("Connection error:", err.message);
    process.exit(1);
  }

  let done = 0;
  let failed = 0;
  const tableNames = ["wa_templates", "wa_contact_groups", "wa_group_contacts", "wa_campaigns", "wa_campaign_messages", "wa_message_logs", "wa_webhook_events"];

  tables.forEach((sql, i) => {
    db.query(sql, (err) => {
      if (err && !err.message.includes("already exists")) {
        console.error(`Error creating ${tableNames[i]}:`, err.message);
        failed++;
      } else {
        console.log(`✅ ${tableNames[i]} ready`);
      }
      done++;
      if (done === tables.length) {
        if (failed === 0) {
          console.log("\n✅ All WhatsApp tables created successfully!");
        } else {
          console.log(`\n⚠️ ${failed} tables had errors`);
        }
        db.end();
      }
    });
  });
});
