const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, "../.env"), override: true });

const mysql = require("mysql2");
const bcrypt = require("bcryptjs");

const dbPort = Number(process.env.DB_PORT) || 3306;
const dbName = process.env.DB_NAME;
const escapedDbName = dbName.replace(/`/g, "``");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: dbPort,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: dbName,
  charset: "utf8mb4",
  multipleStatements: true
});

const schemaPath = path.join(__dirname, "../schema.sql");

function runQuerySafe(sql, description, callback) {
  db.query(sql, (err) => {
    if (err) {
      if (err.message.includes("Duplicate column") || err.message.includes("already exists") || err.message.includes("Duplicate entry")) {
        console.log(`✅ ${description} (already exists)`);
      } else {
        console.error(`❌ ${description}:`, err.message);
      }
    } else {
      console.log(`✅ ${description}`);
    }
    if (callback) callback(err);
  });
}

function ensureColumn(table, column, definition, expectedType, callback) {
  db.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [process.env.DB_NAME, table, column],
    (err, rows) => {
      if (err) {
        console.error(`❌ Check column ${table}.${column}:`, err.message);
        return callback(err);
      }
      if (rows.length === 0) {
        runQuerySafe(`ALTER TABLE ${table} ADD COLUMN ${definition}`, `${table}.${column}`, callback);
      } else {
        const type = (rows[0].DATA_TYPE || rows[0].data_type || "").toLowerCase();
        if (expectedType && type !== expectedType.toLowerCase()) {
          runQuerySafe(`ALTER TABLE ${table} MODIFY COLUMN ${definition}`, `${table}.${column} type`, callback);
        } else {
          console.log(`✅ ${table}.${column} exists`);
          callback(null);
        }
      }
    }
  );
}

function querySafe(sql, description) {
  return new Promise((resolve, reject) => {
    runQuerySafe(sql, description, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function ensureColumnAsync(table, column, definition, expectedType) {
  return new Promise((resolve, reject) => {
    ensureColumn(table, column, definition, expectedType, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function ensureTablesAndColumns() {
  const tableStatements = [
    {
      name: "pi_from_addresses",
      sql: `CREATE TABLE IF NOT EXISTS pi_from_addresses (id INT AUTO_INCREMENT PRIMARY KEY, label VARCHAR(100) NOT NULL, address TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "email_otp",
      sql: `CREATE TABLE IF NOT EXISTS email_otp (email CHAR(100) PRIMARY KEY, otp CHAR(6) DEFAULT NULL, expires_at DATETIME DEFAULT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "payments",
      sql: `CREATE TABLE IF NOT EXISTS payments (id INT AUTO_INCREMENT PRIMARY KEY, invoice_id INT DEFAULT NULL, amount DECIMAL(10,2) NOT NULL, payment_date DATE NOT NULL, payment_method ENUM('Paypal','Cash','Bank') DEFAULT 'Paypal', Transaction_ID INT DEFAULT NULL, invoice_email VARCHAR(150) DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "clientinvoices",
      sql: `CREATE TABLE IF NOT EXISTS clientinvoices (id INT AUTO_INCREMENT PRIMARY KEY, client_company VARCHAR(150) DEFAULT NULL, project_names VARCHAR(150) DEFAULT NULL, invoice_date DATE DEFAULT NULL, invoice_duedate DATE DEFAULT NULL, category ENUM('Default') DEFAULT 'Default', created_by INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "messages",
      sql: `CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, sender_id INT DEFAULT NULL, receiver_id INT DEFAULT NULL, message TEXT DEFAULT NULL, type VARCHAR(20) DEFAULT NULL, seen TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "service_items",
      sql: `CREATE TABLE IF NOT EXISTS service_items (id INT AUTO_INCREMENT PRIMARY KEY, service_id INT NOT NULL, product_number INT NOT NULL, description VARCHAR(255) NOT NULL, brand_model VARCHAR(150) DEFAULT NULL, hsn_sac VARCHAR(20) DEFAULT NULL, uom VARCHAR(20) DEFAULT 'Nos', price DECIMAL(10,2) NOT NULL, quantity INT NOT NULL, tax DECIMAL(10,2) DEFAULT 0, discount DECIMAL(10,2) DEFAULT 0, subtotal DECIMAL(10,2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "service_estimations",
      sql: `CREATE TABLE IF NOT EXISTS service_estimations (id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, invoice_date DATE NOT NULL, subtotal DECIMAL(12,2) DEFAULT 0, total_tax DECIMAL(12,2) DEFAULT 0, total_discount DECIMAL(12,2) DEFAULT 0, grand_total DECIMAL(12,2) DEFAULT 0, created_by INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, total_cgst DECIMAL(12,2) DEFAULT 0, total_sgst DECIMAL(12,2) DEFAULT 0, total_igst DECIMAL(12,2) DEFAULT 0, reference_no VARCHAR(50) DEFAULT NULL, from_address_id INT DEFAULT NULL, from_address_custom TEXT DEFAULT NULL, client_company VARCHAR(150) DEFAULT NULL, client_address1 TEXT DEFAULT NULL, client_address2 TEXT DEFAULT NULL, client_city VARCHAR(100) DEFAULT NULL, client_state VARCHAR(100) DEFAULT NULL, client_pincode VARCHAR(20) DEFAULT NULL, client_country VARCHAR(50) DEFAULT 'India', tax_type VARCHAR(20) DEFAULT 'GST18', custom_tax VARCHAR(20) DEFAULT NULL, exec_name VARCHAR(100) DEFAULT NULL, exec_phone VARCHAR(20) DEFAULT NULL, exec_email VARCHAR(150) DEFAULT NULL, terms_general TINYINT(1) DEFAULT 0, terms_tax TINYINT(1) DEFAULT 0, terms_project_period VARCHAR(100) DEFAULT NULL, terms_validity VARCHAR(50) DEFAULT NULL, terms_separate_orders TEXT DEFAULT NULL, terms_payment VARCHAR(100) DEFAULT NULL, terms_payment_custom VARCHAR(100) DEFAULT NULL, terms_warranty VARCHAR(100) DEFAULT NULL, hsn_sac_code VARCHAR(50) DEFAULT NULL, supplier_branch VARCHAR(100) DEFAULT NULL, bank_details_id VARCHAR(50) DEFAULT NULL, bank_company VARCHAR(150) DEFAULT NULL, bank_name VARCHAR(100) DEFAULT NULL, bank_account VARCHAR(50) DEFAULT NULL, bank_ifsc VARCHAR(50) DEFAULT NULL, bank_branch VARCHAR(100) DEFAULT NULL, custom_terms TEXT DEFAULT NULL, status VARCHAR(20) DEFAULT 'Pending', is_latest TINYINT(1) DEFAULT 1, parent_id INT DEFAULT NULL, version INT DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "service_estimation_items",
      sql: `CREATE TABLE IF NOT EXISTS service_estimation_items (id INT AUTO_INCREMENT PRIMARY KEY, invoice_id INT NOT NULL, product_number INT NOT NULL, description VARCHAR(255) NOT NULL, brand_model VARCHAR(150) DEFAULT NULL, hsn_sac VARCHAR(20) DEFAULT NULL, uom VARCHAR(20) DEFAULT 'Nos', price DECIMAL(10,2) NOT NULL, quantity INT NOT NULL, tax DECIMAL(10,2) DEFAULT 0, discount DECIMAL(10,2) DEFAULT 0, subtotal DECIMAL(10,2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "estimate_invoices",
      sql: `CREATE TABLE IF NOT EXISTS estimate_invoices (id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, invoice_date DATE NOT NULL, subtotal DECIMAL(12,2) DEFAULT 0, total_tax DECIMAL(12,2) DEFAULT 0, total_discount DECIMAL(12,2) DEFAULT 0, grand_total DECIMAL(12,2) DEFAULT 0, created_by INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, total_cgst DECIMAL(12,2) DEFAULT 0, total_sgst DECIMAL(12,2) DEFAULT 0, total_igst DECIMAL(12,2) DEFAULT 0, reference_no VARCHAR(50) DEFAULT NULL, from_address_id INT DEFAULT NULL, from_address_custom TEXT DEFAULT NULL, client_company VARCHAR(150) DEFAULT NULL, client_address1 TEXT DEFAULT NULL, client_address2 TEXT DEFAULT NULL, client_city VARCHAR(100) DEFAULT NULL, client_state VARCHAR(100) DEFAULT NULL, client_pincode VARCHAR(20) DEFAULT NULL, client_country VARCHAR(50) DEFAULT 'India', tax_type VARCHAR(20) DEFAULT 'GST18', custom_tax VARCHAR(20) DEFAULT NULL, exec_name VARCHAR(100) DEFAULT NULL, exec_phone VARCHAR(20) DEFAULT NULL, exec_email VARCHAR(150) DEFAULT NULL, terms_general TINYINT(1) DEFAULT 0, terms_tax TINYINT(1) DEFAULT 0, terms_project_period VARCHAR(100) DEFAULT NULL, terms_validity VARCHAR(50) DEFAULT NULL, terms_separate_orders TEXT DEFAULT NULL, terms_payment VARCHAR(100) DEFAULT NULL, terms_payment_custom VARCHAR(100) DEFAULT NULL, terms_warranty VARCHAR(100) DEFAULT NULL, hsn_sac_code VARCHAR(50) DEFAULT NULL, supplier_branch VARCHAR(100) DEFAULT NULL, bank_details_id VARCHAR(50) DEFAULT NULL, bank_company VARCHAR(150) DEFAULT NULL, bank_name VARCHAR(100) DEFAULT NULL, bank_account VARCHAR(50) DEFAULT NULL, bank_ifsc VARCHAR(50) DEFAULT NULL, bank_branch VARCHAR(100) DEFAULT NULL, custom_terms TEXT DEFAULT NULL, status VARCHAR(20) DEFAULT 'Pending', is_latest TINYINT(1) DEFAULT 1, parent_id INT DEFAULT NULL, version INT DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "estimate_invoice_items",
      sql: `CREATE TABLE IF NOT EXISTS estimate_invoice_items (id INT AUTO_INCREMENT PRIMARY KEY, invoice_id INT NOT NULL, product_number INT NOT NULL, description VARCHAR(255) NOT NULL, brand_model VARCHAR(150) DEFAULT NULL, hsn_sac VARCHAR(20) DEFAULT NULL, uom VARCHAR(20) DEFAULT 'Nos', price DECIMAL(10,2) NOT NULL, quantity INT NOT NULL, tax DECIMAL(10,2) DEFAULT 0, discount DECIMAL(10,2) DEFAULT 0, subtotal DECIMAL(10,2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "estimate_items",
      sql: `CREATE TABLE IF NOT EXISTS estimate_items (id INT AUTO_INCREMENT PRIMARY KEY, estimate_id INT NOT NULL, product_number INT NOT NULL, description VARCHAR(255) NOT NULL, brand_model VARCHAR(150) DEFAULT NULL, hsn_sac VARCHAR(20) DEFAULT NULL, uom VARCHAR(20) DEFAULT 'Nos', price DECIMAL(10,2) NOT NULL, quantity INT NOT NULL, tax DECIMAL(10,2) DEFAULT 0, discount DECIMAL(10,2) DEFAULT 0, subtotal DECIMAL(10,2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "performainvoice_items",
      sql: `CREATE TABLE IF NOT EXISTS performainvoice_items (id INT AUTO_INCREMENT PRIMARY KEY, invoice_id INT NOT NULL, product_number INT NOT NULL, description VARCHAR(255) NOT NULL, brand_model VARCHAR(150) DEFAULT NULL, hsn_sac VARCHAR(20) DEFAULT NULL, uom VARCHAR(20) DEFAULT 'Nos', price DECIMAL(10,2) NOT NULL, quantity INT NOT NULL, tax DECIMAL(10,2) DEFAULT 0, discount DECIMAL(10,2) DEFAULT 0, subtotal DECIMAL(10,2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "performainvoices",
      sql: `CREATE TABLE IF NOT EXISTS performainvoices (id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, invoice_date DATE NOT NULL, subtotal DECIMAL(12,2) DEFAULT 0, total_tax DECIMAL(12,2) DEFAULT 0, total_discount DECIMAL(12,2) DEFAULT 0, grand_total DECIMAL(12,2) DEFAULT 0, created_by INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, total_cgst DECIMAL(12,2) DEFAULT 0, total_sgst DECIMAL(12,2) DEFAULT 0, total_igst DECIMAL(12,2) DEFAULT 0, reference_no VARCHAR(50) DEFAULT NULL, from_address_id INT DEFAULT NULL, from_address_custom TEXT DEFAULT NULL, client_company VARCHAR(150) DEFAULT NULL, client_address1 TEXT DEFAULT NULL, client_address2 TEXT DEFAULT NULL, client_city VARCHAR(100) DEFAULT NULL, client_state VARCHAR(100) DEFAULT NULL, client_pincode VARCHAR(20) DEFAULT NULL, client_country VARCHAR(50) DEFAULT 'India', tax_type VARCHAR(20) DEFAULT 'GST18', custom_tax VARCHAR(20) DEFAULT NULL, exec_name VARCHAR(100) DEFAULT NULL, exec_phone VARCHAR(20) DEFAULT NULL, exec_email VARCHAR(150) DEFAULT NULL, terms_general TINYINT(1) DEFAULT 0, terms_tax TINYINT(1) DEFAULT 0, terms_project_period VARCHAR(100) DEFAULT NULL, terms_validity VARCHAR(50) DEFAULT NULL, terms_separate_orders TEXT DEFAULT NULL, terms_payment VARCHAR(100) DEFAULT NULL, terms_payment_custom VARCHAR(100) DEFAULT NULL, terms_warranty VARCHAR(100) DEFAULT NULL, hsn_sac_code VARCHAR(50) DEFAULT NULL, supplier_branch VARCHAR(100) DEFAULT NULL, bank_details_id VARCHAR(50) DEFAULT NULL, bank_company VARCHAR(150) DEFAULT NULL, bank_name VARCHAR(100) DEFAULT NULL, bank_account VARCHAR(50) DEFAULT NULL, bank_ifsc VARCHAR(50) DEFAULT NULL, bank_branch VARCHAR(100) DEFAULT NULL, custom_terms TEXT DEFAULT NULL, status VARCHAR(20) DEFAULT 'Pending', is_latest TINYINT(1) DEFAULT 1, parent_id INT DEFAULT NULL, version INT DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "services",
      sql: `CREATE TABLE IF NOT EXISTS services (id INT AUTO_INCREMENT PRIMARY KEY, client VARCHAR(150) DEFAULT NULL, material VARCHAR(255) DEFAULT NULL, warranty VARCHAR(100) DEFAULT NULL, amc TINYINT(1) DEFAULT 0, date DATE DEFAULT NULL, images TEXT DEFAULT NULL, issues TEXT DEFAULT NULL, created_by INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, engineer_name VARCHAR(150) DEFAULT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "customers",
      sql: `CREATE TABLE IF NOT EXISTS customers (id INT AUTO_INCREMENT PRIMARY KEY, customer_name VARCHAR(150) NOT NULL, mobile_number VARCHAR(20) DEFAULT NULL, email VARCHAR(150) DEFAULT NULL, gst_number VARCHAR(50) DEFAULT NULL, location_city VARCHAR(100) DEFAULT NULL, created_by INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "quotations",
      sql: `CREATE TABLE IF NOT EXISTS quotations (id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, quotation_date DATE NOT NULL, subtotal DECIMAL(12,2) DEFAULT 0, total_tax DECIMAL(12,2) DEFAULT 0, total_discount DECIMAL(12,2) DEFAULT 0, grand_total DECIMAL(12,2) DEFAULT 0, created_by INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, total_cgst DECIMAL(12,2) DEFAULT 0, total_sgst DECIMAL(12,2) DEFAULT 0, total_igst DECIMAL(12,2) DEFAULT 0, reference_no VARCHAR(50) DEFAULT NULL, from_address_id INT DEFAULT NULL, from_address_custom TEXT DEFAULT NULL, client_company VARCHAR(150) DEFAULT NULL, client_address1 TEXT DEFAULT NULL, client_address2 TEXT DEFAULT NULL, client_city VARCHAR(100) DEFAULT NULL, client_state VARCHAR(100) DEFAULT NULL, client_pincode VARCHAR(20) DEFAULT NULL, client_country VARCHAR(50) DEFAULT 'India', tax_type VARCHAR(20) DEFAULT 'GST18', custom_tax VARCHAR(20) DEFAULT NULL, exec_name VARCHAR(100) DEFAULT NULL, exec_phone VARCHAR(20) DEFAULT NULL, exec_email VARCHAR(150) DEFAULT NULL, terms_general TINYINT(1) DEFAULT 0, terms_tax TINYINT(1) DEFAULT 0, terms_project_period VARCHAR(100) DEFAULT NULL, terms_validity VARCHAR(50) DEFAULT NULL, terms_separate_orders TEXT DEFAULT NULL, terms_payment VARCHAR(100) DEFAULT NULL, terms_payment_custom VARCHAR(100) DEFAULT NULL, terms_warranty VARCHAR(100) DEFAULT NULL, hsn_sac_code VARCHAR(50) DEFAULT NULL, supplier_branch VARCHAR(100) DEFAULT NULL, bank_details_id VARCHAR(50) DEFAULT NULL, bank_company VARCHAR(150) DEFAULT NULL, bank_name VARCHAR(100) DEFAULT NULL, bank_account VARCHAR(50) DEFAULT NULL, bank_ifsc VARCHAR(50) DEFAULT NULL, bank_branch VARCHAR(100) DEFAULT NULL, custom_terms TEXT DEFAULT NULL, is_latest TINYINT(1) DEFAULT 1, parent_id INT DEFAULT NULL, version INT DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "quotation_items",
      sql: `CREATE TABLE IF NOT EXISTS quotation_items (id INT AUTO_INCREMENT PRIMARY KEY, quotation_id INT NOT NULL, product_number INT NOT NULL, description VARCHAR(255) NOT NULL, brand_model VARCHAR(150) DEFAULT NULL, hsn_sac VARCHAR(20) DEFAULT NULL, uom VARCHAR(20) DEFAULT 'Nos', price DECIMAL(10,2) NOT NULL, quantity INT NOT NULL, tax DECIMAL(10,2) DEFAULT 0, discount DECIMAL(10,2) DEFAULT 0, subtotal DECIMAL(10,2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "lead_reminders",
      sql: `CREATE TABLE IF NOT EXISTS lead_reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        lead_type ENUM('telecall','walkin','field') DEFAULT 'telecall',
        reminder_date DATE,
        reminder_time TIME DEFAULT NULL,
        reminder_notes TEXT,
        status ENUM('Pending','Done','Missed') DEFAULT 'Pending',
        missed_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "lead_activity",
      sql: `CREATE TABLE IF NOT EXISTS lead_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        lead_type ENUM('telecall','walkin','field') DEFAULT 'telecall',
        action VARCHAR(100),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "lead_escalations",
      sql: `CREATE TABLE IF NOT EXISTS lead_escalations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lead_id INT NOT NULL,
        lead_type ENUM('telecall','walkin','field') DEFAULT 'telecall',
        customer_name VARCHAR(150),
        mobile_number VARCHAR(20),
        staff_name VARCHAR(150),
        last_followup_date DATE,
        missed_count INT DEFAULT 0,
        status ENUM('Open','Resolved') DEFAULT 'Open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "admin_notifications",
      sql: `CREATE TABLE IF NOT EXISTS admin_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) DEFAULT 'registration',
        user_id INT,
        message TEXT,
        related_id INT DEFAULT NULL,
        related_type VARCHAR(50) DEFAULT NULL,
        created_by INT DEFAULT NULL,
        priority VARCHAR(20) DEFAULT 'normal',
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "profile_change_requests",
      sql: `CREATE TABLE IF NOT EXISTS profile_change_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        field VARCHAR(50) NOT NULL,
        new_value TEXT,
        status ENUM('pending','approved','declined') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        admin_response_at TIMESTAMP NULL DEFAULT NULL,
        KEY user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "amc_alc_services",
      sql: `CREATE TABLE IF NOT EXISTS amc_alc_services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contract_id INT NOT NULL,
        service_type ENUM('AMC', 'ALC', 'None') DEFAULT 'AMC',
        customer_name VARCHAR(255),
        mobile_number VARCHAR(20),
        location_city VARCHAR(255),
        service_date DATE NOT NULL,
        start_time TIME DEFAULT NULL,
        end_time TIME DEFAULT NULL,
        km DECIMAL(10,2) DEFAULT NULL,
        technician VARCHAR(150) DEFAULT NULL,
        sales_person VARCHAR(150) DEFAULT NULL,
        service_person VARCHAR(255),
        description TEXT,
        remarks TEXT,
        email VARCHAR(150) DEFAULT NULL,
        next_service_date DATE DEFAULT NULL,
        petrol_charges DECIMAL(10,2) DEFAULT 0,
        spare_parts_price DECIMAL(10,2) DEFAULT 0,
        labour_charges DECIMAL(10,2) DEFAULT 0.00,
        total_expenses DECIMAL(10,2) DEFAULT 0,
        status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "service_activity",
      sql: `CREATE TABLE IF NOT EXISTS service_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_id INT,
        activity_type VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "task_targets",
      sql: `CREATE TABLE IF NOT EXISTS task_targets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        user_name VARCHAR(150) NOT NULL,
        yearly_target DECIMAL(15,2) DEFAULT 0,
        monthly_target DECIMAL(15,2) DEFAULT 0,
        carry_forward DECIMAL(15,2) DEFAULT 0,
        effective_target DECIMAL(15,2) DEFAULT 0,
        created_by_admin TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "task_achievements",
      sql: `CREATE TABLE IF NOT EXISTS task_achievements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        user_name VARCHAR(150) NOT NULL,
        target_id INT NOT NULL,
        month_year VARCHAR(7) NOT NULL,
        achieved_count INT DEFAULT 0,
        achieved_amount DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_target_month (target_id, month_year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "task_updates",
      sql: `CREATE TABLE IF NOT EXISTS task_updates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        user_name VARCHAR(150) NOT NULL,
        target_id INT NOT NULL,
        month_year VARCHAR(7) NOT NULL,
        count INT DEFAULT 0,
        amount DECIMAL(15,2) DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "call_reports",
      sql: `CREATE TABLE IF NOT EXISTS call_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        call_id VARCHAR(20) DEFAULT NULL,
        session_id VARCHAR(50) DEFAULT NULL,
        customer_id INT DEFAULT NULL,
        contract_id INT DEFAULT NULL,
        contract_title VARCHAR(200) DEFAULT NULL,
        service_type ENUM('AMC', 'ALC', 'None') DEFAULT 'None',
        client_name VARCHAR(200) DEFAULT NULL,
        customer_name VARCHAR(200) DEFAULT NULL,
        name VARCHAR(150) DEFAULT NULL,
        staff_name VARCHAR(150) DEFAULT NULL,
        executive_name VARCHAR(150) DEFAULT NULL,
        technician VARCHAR(150) DEFAULT NULL,
        sales_person VARCHAR(150) DEFAULT NULL,
        service_person VARCHAR(150) DEFAULT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        mobile_number VARCHAR(20) DEFAULT NULL,
        email VARCHAR(150) DEFAULT NULL,
        location VARCHAR(100) DEFAULT NULL,
        location_city VARCHAR(100) DEFAULT NULL,
        call_sequence INT DEFAULT 1,
        report_date DATE DEFAULT NULL,
        service_date DATE DEFAULT NULL,
        start_time TIME DEFAULT NULL,
        end_time TIME DEFAULT NULL,
        assigned_time INT DEFAULT 30,
        actual_duration INT DEFAULT 0,
        is_exceeded TINYINT(1) DEFAULT 0,
        duration_limit INT DEFAULT NULL,
        call_details TEXT,
        complaint TEXT,
        description TEXT,
        remarks TEXT,
        km DECIMAL(10,2) DEFAULT NULL,
        petrol_charges DECIMAL(10,2) DEFAULT 0,
        spare_parts_price DECIMAL(10,2) DEFAULT 0,
        labour_charges DECIMAL(10,2) DEFAULT 0,
        total_expenses DECIMAL(10,2) DEFAULT 0,
        status ENUM('Pending', 'In Progress', 'Completed', 'Closed', 'Live', 'Observation') DEFAULT 'Completed',
        priority ENUM('Critical', 'High', 'Medium') DEFAULT 'Medium',
        call_type VARCHAR(50) DEFAULT 'AMC',
        call_referrer VARCHAR(150) DEFAULT NULL,
        payment_type VARCHAR(50) DEFAULT NULL,
        payment_mode VARCHAR(50) DEFAULT NULL,
        invoice_value DECIMAL(10,2) DEFAULT 0,
        amount_collected DECIMAL(10,2) DEFAULT 0,
        payment_status VARCHAR(50) DEFAULT NULL,
        gst_number VARCHAR(50) DEFAULT NULL,
        company_name VARCHAR(150) DEFAULT NULL,
        step2_completed TINYINT(1) DEFAULT 0,
        completed_at TIMESTAMP NULL,
        carry_forward_date DATE NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "task_activity",
      sql: `CREATE TABLE IF NOT EXISTS task_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT,
        action VARCHAR(50),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "notifications",
      sql: `CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL DEFAULT 0,
        user_id INT DEFAULT NULL,
        type VARCHAR(50) DEFAULT NULL,
        title VARCHAR(150) DEFAULT NULL,
        description VARCHAR(255) DEFAULT NULL,
        is_read TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "task_assignments",
      sql: `CREATE TABLE IF NOT EXISTS task_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT,
        assigned_to_user_id INT,
        assigned_to_user_name VARCHAR(255),
        assigned_by VARCHAR(255),
        status ENUM('Pending','Accepted','Declined','In Progress','Completed') DEFAULT 'Pending',
        assigned_date DATE,
        due_date DATE,
        priority ENUM('Low', 'Normal', 'High', 'Urgent') DEFAULT 'Normal',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "clients",
      sql: `CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        company_name VARCHAR(150) DEFAULT NULL,
        email VARCHAR(150) DEFAULT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        alternate_phone VARCHAR(20) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        city VARCHAR(100) DEFAULT NULL,
        state VARCHAR(100) DEFAULT NULL,
        pincode VARCHAR(20) DEFAULT NULL,
        service VARCHAR(255) DEFAULT NULL,
        gst_number VARCHAR(50) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        client_status ENUM('active','inactive','converted','prospect') DEFAULT 'active',
        created_by INT DEFAULT NULL,
        assigned_teammember_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        original_lead_id INT DEFAULT NULL,
        original_lead_type ENUM('telecall','walkin','field') DEFAULT NULL,
        converted_at TIMESTAMP NULL DEFAULT NULL,
        lead_email VARCHAR(150) DEFAULT NULL,
        lead_city VARCHAR(100) DEFAULT NULL,
        lead_reference VARCHAR(255) DEFAULT NULL,
        lead_purpose VARCHAR(255) DEFAULT NULL,
        lead_staff_name VARCHAR(150) DEFAULT NULL,
        lead_id_display VARCHAR(50) DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "client_shares",
      sql: `CREATE TABLE IF NOT EXISTS client_shares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        shared_by INT DEFAULT NULL,
        shared_to INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_client_shares_client (client_id),
        KEY idx_client_shares_shared_to (shared_to)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    },
    {
      name: "user_email_configs",
      sql: `CREATE TABLE IF NOT EXISTS user_email_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        email_user VARCHAR(150) NOT NULL,
        email_pass VARCHAR(255) NOT NULL,
        smtp_host VARCHAR(100) DEFAULT 'smtp.gmail.com',
        smtp_port INT DEFAULT 587,
        smtp_secure VARCHAR(50) DEFAULT 'STARTTLS',
        from_email_address VARCHAR(150) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    }
  ];

  const columnChecks = [
    { table: "lead_reminders", column: "reminder_time", definition: "reminder_time TIME DEFAULT NULL", expectedType: "time" },
    { table: "lead_reminders", column: "missed_count", definition: "missed_count INT DEFAULT 0" },
    { table: "lead_reminders", column: "notification_sent", definition: "notification_sent TINYINT(1) DEFAULT 0" },
    { table: "lead_reminders", column: "employee_id", definition: "employee_id INT DEFAULT NULL" },
    { table: "lead_escalations", column: "missed_count", definition: "missed_count INT DEFAULT 0" },
    { table: "users", column: "status", definition: "status ENUM('pending','active','rejected') DEFAULT 'pending'", expectedType: "enum" },
    { table: "users", column: "emp_id", definition: "emp_id VARCHAR(50) DEFAULT NULL" },
    { table: "admin_notifications", column: "related_id", definition: "related_id INT DEFAULT NULL" },
    { table: "admin_notifications", column: "related_type", definition: "related_type VARCHAR(50) DEFAULT NULL" },
    { table: "admin_notifications", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "admin_notifications", column: "priority", definition: "priority VARCHAR(20) DEFAULT 'normal'" },
    { table: "admin_notifications", column: "is_archived", definition: "is_archived TINYINT(1) DEFAULT 0" },
    { table: "notifications", column: "user_id", definition: "user_id INT DEFAULT NULL" },
    { table: "notifications", column: "type", definition: "type VARCHAR(50) DEFAULT NULL" },
    { table: "notifications", column: "is_archived", definition: "is_archived TINYINT(1) DEFAULT 0" },
    { table: "task_assignments", column: "status", definition: "status ENUM('Pending','Accepted','Declined','In Progress','Completed') DEFAULT 'Pending'", expectedType: "enum" },
    { table: "teammember", column: "mobile_number", definition: "mobile_number VARCHAR(20) DEFAULT NULL" },
    { table: "teammember", column: "emp_id", definition: "emp_id VARCHAR(50) DEFAULT NULL" },
    { table: "teammember", column: "user_id", definition: "user_id INT DEFAULT NULL" },
    { table: "teammember", column: "emp_address", definition: "emp_address TEXT DEFAULT NULL" },
    { table: "telecalls", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "telecalls", column: "email", definition: "email VARCHAR(150) DEFAULT NULL" },
    { table: "walkins", column: "assigned_to", definition: "assigned_to INT DEFAULT NULL" },
    { table: "walkins", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "walkins", column: "email", definition: "email VARCHAR(150) DEFAULT NULL" },
    { table: "fields", column: "assigned_to", definition: "assigned_to INT DEFAULT NULL" },
    { table: "fields", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "fields", column: "email", definition: "email VARCHAR(150) DEFAULT NULL" },
    { table: "quotations", column: "lead_id", definition: "lead_id INT DEFAULT NULL" },
    { table: "quotations", column: "lead_type", definition: "lead_type VARCHAR(20) DEFAULT NULL" },
    { table: "contracts", column: "contract_type", definition: "contract_type VARCHAR(20) DEFAULT 'Service'" },
    { table: "contracts", column: "quotation_id", definition: "quotation_id INT DEFAULT NULL" },
    { table: "contracts", column: "mobile_number", definition: "mobile_number VARCHAR(20) DEFAULT NULL" },
    { table: "contracts", column: "location_city", definition: "location_city VARCHAR(100) DEFAULT NULL" },
    { table: "amc_alc_services", column: "labour_charges", definition: "labour_charges DECIMAL(10,2) DEFAULT 0.00" },
    { table: "amc_alc_services", column: "contract_title", definition: "contract_title VARCHAR(150) DEFAULT NULL" },
    { table: "amc_alc_services", column: "start_time", definition: "start_time TIME DEFAULT NULL" },
    { table: "amc_alc_services", column: "end_time", definition: "end_time TIME DEFAULT NULL" },
    { table: "amc_alc_services", column: "km", definition: "km DECIMAL(10,2) DEFAULT NULL" },
    { table: "amc_alc_services", column: "technician", definition: "technician VARCHAR(150) DEFAULT NULL" },
    { table: "amc_alc_services", column: "sales_person", definition: "sales_person VARCHAR(150) DEFAULT NULL" },
    { table: "amc_alc_services", column: "remarks", definition: "remarks TEXT DEFAULT NULL" },
    { table: "amc_alc_services", column: "email", definition: "email VARCHAR(150) DEFAULT NULL" },
    { table: "amc_alc_services", column: "next_service_date", definition: "next_service_date DATE DEFAULT NULL" },
    { table: "amc_alc_services", column: "service_type", definition: "service_type ENUM('AMC', 'ALC', 'None') DEFAULT 'AMC'" },
    { table: "task_targets", column: "user_id", definition: "user_id INT DEFAULT NULL" },
    { table: "task_targets", column: "created_by_admin", definition: "created_by_admin TINYINT(1) DEFAULT 1" },
    { table: "task_achievements", column: "achieved_amount", definition: "achieved_amount DECIMAL(15,2) DEFAULT 0" },
    { table: "task_updates", column: "amount", definition: "amount DECIMAL(15,2) DEFAULT 0" },
    { table: "call_reports", column: "start_time", definition: "start_time TIME DEFAULT NULL" },
    { table: "call_reports", column: "end_time", definition: "end_time TIME DEFAULT NULL" },
    { table: "call_reports", column: "km", definition: "km DECIMAL(10,2) DEFAULT NULL" },
    { table: "call_reports", column: "remarks", definition: "remarks TEXT DEFAULT NULL" },
    { table: "call_reports", column: "technician", definition: "technician VARCHAR(150) DEFAULT NULL" },
    { table: "call_reports", column: "sales_person", definition: "sales_person VARCHAR(150) DEFAULT NULL" },
    { table: "tasks", column: "assigned_teammember_id", definition: "assigned_teammember_id INT DEFAULT NULL" },
    { table: "task_targets", column: "teammember_id", definition: "teammember_id INT DEFAULT NULL" },
    { table: "quotations", column: "reference_no", definition: "reference_no VARCHAR(50) DEFAULT NULL" },
    { table: "task_targets", column: "carry_forward", definition: "carry_forward DECIMAL(15,2) DEFAULT 0" },
    { table: "task_targets", column: "effective_target", definition: "effective_target DECIMAL(15,2) DEFAULT 0" },
  { table: "task_targets", column: "user_id", definition: "user_id INT DEFAULT NULL" },
  { table: "task_targets", column: "created_by_admin", definition: "created_by_admin TINYINT(1) DEFAULT 1" },
  { table: "task_achievements", column: "achieved_amount", definition: "achieved_amount DECIMAL(15,2) DEFAULT 0" },
    { table: "clients", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "tasks", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "tasks", column: "task_description", definition: "task_description TEXT DEFAULT NULL" },
    { table: "tasks", column: "assigned_to", definition: "assigned_to VARCHAR(150) DEFAULT NULL" },
    { table: "quotations", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "contracts", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "contracts", column: "client_company", definition: "client_company VARCHAR(200) DEFAULT NULL" },
    { table: "contracts", column: "amount_value", definition: "amount_value DECIMAL(10,2) DEFAULT 0" },
    { table: "contracts", column: "remaining", definition: "remaining DECIMAL(10,2) DEFAULT 0" },
    { table: "contracts", column: "email", definition: "email VARCHAR(150) DEFAULT NULL" },
    { table: "clientinvoices", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "performainvoices", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "services", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "services", column: "engineer_name", definition: "engineer_name VARCHAR(150) DEFAULT NULL" },
    { table: "call_reports", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    { table: "call_reports", column: "customer_id", definition: "customer_id INT DEFAULT NULL" },
    { table: "call_reports", column: "name", definition: "name VARCHAR(150) DEFAULT NULL" },
    { table: "call_reports", column: "call_details", definition: "call_details TEXT DEFAULT NULL" },
    { table: "lead_activity", column: "employee_id", definition: "employee_id INT DEFAULT NULL" },
    { table: "lead_escalations", column: "missed_threshold_reached", definition: "missed_threshold_reached TINYINT(1) DEFAULT 0" },
    { table: "lead_escalations", column: "employee_id", definition: "employee_id INT DEFAULT NULL" },
    { table: "performainvoices", column: "is_latest", definition: "is_latest TINYINT(1) DEFAULT 1" },
    { table: "performainvoices", column: "version", definition: "version INT DEFAULT 1" },
    { table: "performainvoices", column: "parent_id", definition: "parent_id INT DEFAULT NULL" },
    { table: "performa_invoice_items", column: "uom", definition: "uom VARCHAR(50) DEFAULT 'Nos'" },
    { table: "performainvoice_items", column: "uom", definition: "uom VARCHAR(50) DEFAULT 'Nos'" },
    { table: "task_assignments", column: "response_notes", definition: "response_notes TEXT DEFAULT NULL" },
    { table: "call_reports", column: "amount_collected", definition: "amount_collected DECIMAL(10,2) DEFAULT 0" },
    { table: "call_reports", column: "payment_mode", definition: "payment_mode VARCHAR(50) DEFAULT NULL" },
    { table: "call_reports", column: "duration_limit", definition: "duration_limit INT DEFAULT NULL" },
    { table: "call_reports", column: "actual_duration", definition: "actual_duration INT DEFAULT 0" },
    { table: "call_reports", column: "is_exceeded", definition: "is_exceeded TINYINT(1) DEFAULT 0" },
    { table: "call_reports", column: "assigned_time", definition: "assigned_time INT DEFAULT 30" },
    { table: "call_reports", column: "call_id", definition: "call_id VARCHAR(20) DEFAULT NULL" },
    { table: "call_reports", column: "session_id", definition: "session_id VARCHAR(50) DEFAULT NULL" },
    { table: "call_reports", column: "client_name", definition: "client_name VARCHAR(200) DEFAULT NULL" },
    { table: "call_reports", column: "staff_name", definition: "staff_name VARCHAR(150) DEFAULT NULL" },
    { table: "call_reports", column: "executive_name", definition: "executive_name VARCHAR(150) DEFAULT NULL" },
    { table: "call_reports", column: "phone", definition: "phone VARCHAR(20) DEFAULT NULL" },
    { table: "call_reports", column: "location", definition: "location VARCHAR(100) DEFAULT NULL" },
    { table: "call_reports", column: "call_sequence", definition: "call_sequence INT DEFAULT 1" },
    { table: "call_reports", column: "report_date", definition: "report_date DATE DEFAULT NULL" },
    { table: "call_reports", column: "complaint", definition: "complaint TEXT" },
    { table: "call_reports", column: "priority", definition: "priority ENUM('Critical', 'High', 'Medium') DEFAULT 'Medium'" },
    { table: "call_reports", column: "call_type", definition: "call_type VARCHAR(50) DEFAULT 'AMC'" },
    { table: "call_reports", column: "payment_type", definition: "payment_type VARCHAR(50) DEFAULT NULL" },
    { table: "call_reports", column: "invoice_value", definition: "invoice_value DECIMAL(10,2) DEFAULT 0" },
    { table: "call_reports", column: "payment_status", definition: "payment_status VARCHAR(50) DEFAULT NULL" },
    { table: "call_reports", column: "petrol_charges", definition: "petrol_charges DECIMAL(10,2) DEFAULT 0" },
    { table: "call_reports", column: "spare_parts_price", definition: "spare_parts_price DECIMAL(10,2) DEFAULT 0" },
    { table: "call_reports", column: "labour_charges", definition: "labour_charges DECIMAL(10,2) DEFAULT 0" },
    { table: "call_reports", column: "total_expenses", definition: "total_expenses DECIMAL(10,2) DEFAULT 0" },
    { table: "call_reports", column: "customer_name", definition: "customer_name VARCHAR(200) DEFAULT NULL" },
    { table: "call_reports", column: "mobile_number", definition: "mobile_number VARCHAR(20) DEFAULT NULL" },
    { table: "call_reports", column: "location_city", definition: "location_city VARCHAR(100) DEFAULT NULL" },
    { table: "call_reports", column: "contract_title", definition: "contract_title VARCHAR(200) DEFAULT NULL" },
    { table: "call_reports", column: "service_type", definition: "service_type ENUM('AMC', 'ALC', 'None') DEFAULT 'None'" },
    { table: "call_reports", column: "description", definition: "description TEXT" },
    { table: "call_reports", column: "service_person", definition: "service_person VARCHAR(150) DEFAULT NULL" },
    { table: "call_reports", column: "contract_id", definition: "contract_id INT DEFAULT NULL" },
    { table: "call_reports", column: "call_referrer", definition: "call_referrer VARCHAR(150) DEFAULT NULL" },
    { table: "call_reports", column: "step2_completed", definition: "step2_completed TINYINT(1) DEFAULT 0" },
    { table: "call_reports", column: "email", definition: "email VARCHAR(150) DEFAULT NULL" },
    { table: "call_reports", column: "status", definition: "status ENUM('Pending','In Progress','Completed','Closed','Live','Observation') DEFAULT 'Completed'", expectedType: "enum" },
    { table: "call_reports", column: "gst_number", definition: "gst_number VARCHAR(50) DEFAULT NULL" },
    { table: "call_reports", column: "company_name", definition: "company_name VARCHAR(150) DEFAULT NULL" },
    { table: "call_reports", column: "completed_at", definition: "completed_at TIMESTAMP NULL" },
    { table: "call_reports", column: "carry_forward_date", definition: "carry_forward_date DATE NULL" },
    { table: "amc_alc_services", column: "amount_collected", definition: "amount_collected DECIMAL(10,2) DEFAULT 0" },
    { table: "amc_alc_services", column: "payment_mode", definition: "payment_mode VARCHAR(50) DEFAULT NULL" },
    { table: "amc_alc_services", column: "call_number", definition: "call_number INT DEFAULT 1" },
    { table: "amc_alc_services", column: "breakpoints", definition: "breakpoints TEXT DEFAULT NULL" },
    { table: "amc_alc_services", column: "duration_limit", definition: "duration_limit INT DEFAULT NULL" },
    { table: "clients", column: "gst_number", definition: "gst_number VARCHAR(50) DEFAULT NULL" },
    { table: "clients", column: "company_name", definition: "company_name VARCHAR(150) DEFAULT NULL" },
    { table: "clients", column: "service", definition: "service VARCHAR(255) DEFAULT NULL" },
    { table: "clients", column: "alternate_phone", definition: "alternate_phone VARCHAR(20) DEFAULT NULL" },
    { table: "clients", column: "city", definition: "city VARCHAR(100) DEFAULT NULL" },
    { table: "clients", column: "state", definition: "state VARCHAR(100) DEFAULT NULL" },
    { table: "clients", column: "pincode", definition: "pincode VARCHAR(20) DEFAULT NULL" },
    { table: "clients", column: "notes", definition: "notes TEXT DEFAULT NULL" },
    { table: "clients", column: "client_status", definition: "client_status ENUM('active','inactive','prospect') DEFAULT 'active'" },
    { table: "clients", column: "original_lead_id", definition: "original_lead_id INT DEFAULT NULL" },
    { table: "clients", column: "original_lead_type", definition: "original_lead_type ENUM('telecall','walkin','field') DEFAULT NULL" },
    { table: "clients", column: "converted_at", definition: "converted_at TIMESTAMP NULL DEFAULT NULL" },
    { table: "clients", column: "lead_email", definition: "lead_email VARCHAR(150) DEFAULT NULL" },
    { table: "clients", column: "lead_city", definition: "lead_city VARCHAR(100) DEFAULT NULL" },
    { table: "clients", column: "lead_reference", definition: "lead_reference VARCHAR(255) DEFAULT NULL" },
    { table: "clients", column: "lead_purpose", definition: "lead_purpose VARCHAR(255) DEFAULT NULL" },
    { table: "clients", column: "client_status", definition: "client_status ENUM('active','inactive','converted') DEFAULT 'active'" },
    { table: "clients", column: "lead_staff_name", definition: "lead_staff_name VARCHAR(150) DEFAULT NULL" },
    { table: "clients", column: "lead_id_display", definition: "lead_id_display VARCHAR(50) DEFAULT NULL" },
    { table: "clients", column: "assigned_teammember_id", definition: "assigned_teammember_id INT DEFAULT NULL" },
    { table: "clients", column: "state", definition: "state VARCHAR(100) DEFAULT NULL" },
    { table: "clients", column: "pincode", definition: "pincode VARCHAR(20) DEFAULT NULL" },
    { table: "users", column: "emp_id", definition: "emp_id VARCHAR(50) DEFAULT NULL", uniqueKey: "emp_id" },
    // Quotations extra columns
    { table: "quotations", column: "reference_no", definition: "reference_no VARCHAR(50) DEFAULT NULL" },
    { table: "quotations", column: "from_address_id", definition: "from_address_id INT DEFAULT NULL" },
    { table: "quotations", column: "from_address_custom", definition: "from_address_custom TEXT DEFAULT NULL" },
    { table: "quotations", column: "client_company", definition: "client_company VARCHAR(150) DEFAULT NULL" },
    { table: "quotations", column: "client_address1", definition: "client_address1 TEXT DEFAULT NULL" },
    { table: "quotations", column: "client_address2", definition: "client_address2 TEXT DEFAULT NULL" },
    { table: "quotations", column: "client_city", definition: "client_city VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "client_state", definition: "client_state VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "client_pincode", definition: "client_pincode VARCHAR(20) DEFAULT NULL" },
    { table: "quotations", column: "client_country", definition: "client_country VARCHAR(50) DEFAULT 'India'" },
    { table: "quotations", column: "tax_type", definition: "tax_type VARCHAR(20) DEFAULT 'GST18'" },
    { table: "quotations", column: "custom_tax", definition: "custom_tax VARCHAR(20) DEFAULT NULL" },
    { table: "quotations", column: "exec_name", definition: "exec_name VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "exec_phone", definition: "exec_phone VARCHAR(20) DEFAULT NULL" },
    { table: "quotations", column: "exec_email", definition: "exec_email VARCHAR(150) DEFAULT NULL" },
    { table: "quotations", column: "terms_general", definition: "terms_general TINYINT(1) DEFAULT 0" },
    { table: "quotations", column: "terms_tax", definition: "terms_tax TINYINT(1) DEFAULT 0" },
    { table: "quotations", column: "terms_project_period", definition: "terms_project_period VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "terms_validity", definition: "terms_validity VARCHAR(50) DEFAULT NULL" },
    { table: "quotations", column: "terms_separate_orders", definition: "terms_separate_orders TEXT DEFAULT NULL" },
    { table: "quotations", column: "terms_payment", definition: "terms_payment VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "terms_payment_custom", definition: "terms_payment_custom VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "terms_warranty", definition: "terms_warranty VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "hsn_sac_code", definition: "hsn_sac_code VARCHAR(50) DEFAULT NULL" },
    { table: "quotations", column: "supplier_branch", definition: "supplier_branch VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "bank_details_id", definition: "bank_details_id VARCHAR(50) DEFAULT NULL" },
    { table: "quotations", column: "bank_company", definition: "bank_company VARCHAR(150) DEFAULT NULL" },
    { table: "quotations", column: "bank_name", definition: "bank_name VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "bank_account", definition: "bank_account VARCHAR(50) DEFAULT NULL" },
    { table: "quotations", column: "bank_ifsc", definition: "bank_ifsc VARCHAR(50) DEFAULT NULL" },
    { table: "quotations", column: "bank_branch", definition: "bank_branch VARCHAR(100) DEFAULT NULL" },
    { table: "quotations", column: "custom_terms", definition: "custom_terms TEXT DEFAULT NULL" },
    { table: "quotations", column: "is_latest", definition: "is_latest TINYINT(1) DEFAULT 1" },
    { table: "quotations", column: "parent_id", definition: "parent_id INT DEFAULT NULL" },
    { table: "quotations", column: "version", definition: "version INT DEFAULT 1" },
    // Performa invoices extra columns
    { table: "performainvoices", column: "reference_no", definition: "reference_no VARCHAR(50) DEFAULT NULL" },
    { table: "performainvoices", column: "from_address_id", definition: "from_address_id INT DEFAULT NULL" },
    { table: "performainvoices", column: "from_address_custom", definition: "from_address_custom TEXT DEFAULT NULL" },
    { table: "performainvoices", column: "client_company", definition: "client_company VARCHAR(150) DEFAULT NULL" },
    { table: "performainvoices", column: "client_address1", definition: "client_address1 TEXT DEFAULT NULL" },
    { table: "performainvoices", column: "client_address2", definition: "client_address2 TEXT DEFAULT NULL" },
    { table: "performainvoices", column: "client_city", definition: "client_city VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "client_state", definition: "client_state VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "client_pincode", definition: "client_pincode VARCHAR(20) DEFAULT NULL" },
    { table: "performainvoices", column: "client_country", definition: "client_country VARCHAR(50) DEFAULT 'India'" },
    { table: "performainvoices", column: "tax_type", definition: "tax_type VARCHAR(20) DEFAULT 'GST18'" },
    { table: "performainvoices", column: "custom_tax", definition: "custom_tax VARCHAR(20) DEFAULT NULL" },
    { table: "performainvoices", column: "exec_name", definition: "exec_name VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "exec_phone", definition: "exec_phone VARCHAR(20) DEFAULT NULL" },
    { table: "performainvoices", column: "exec_email", definition: "exec_email VARCHAR(150) DEFAULT NULL" },
    { table: "performainvoices", column: "terms_general", definition: "terms_general TINYINT(1) DEFAULT 0" },
    { table: "performainvoices", column: "terms_tax", definition: "terms_tax TINYINT(1) DEFAULT 0" },
    { table: "performainvoices", column: "terms_project_period", definition: "terms_project_period VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "terms_validity", definition: "terms_validity VARCHAR(50) DEFAULT NULL" },
    { table: "performainvoices", column: "terms_separate_orders", definition: "terms_separate_orders TEXT DEFAULT NULL" },
    { table: "performainvoices", column: "terms_payment", definition: "terms_payment VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "terms_payment_custom", definition: "terms_payment_custom VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "terms_warranty", definition: "terms_warranty VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "hsn_sac_code", definition: "hsn_sac_code VARCHAR(50) DEFAULT NULL" },
    { table: "performainvoices", column: "supplier_branch", definition: "supplier_branch VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "bank_details_id", definition: "bank_details_id VARCHAR(50) DEFAULT NULL" },
    { table: "performainvoices", column: "bank_company", definition: "bank_company VARCHAR(150) DEFAULT NULL" },
    { table: "performainvoices", column: "bank_name", definition: "bank_name VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "bank_account", definition: "bank_account VARCHAR(50) DEFAULT NULL" },
    { table: "performainvoices", column: "bank_ifsc", definition: "bank_ifsc VARCHAR(50) DEFAULT NULL" },
    { table: "performainvoices", column: "bank_branch", definition: "bank_branch VARCHAR(100) DEFAULT NULL" },
    { table: "performainvoices", column: "custom_terms", definition: "custom_terms TEXT DEFAULT NULL" },
    // Services (service estimation) extra columns
    { table: "services", column: "reference_no", definition: "reference_no VARCHAR(50) DEFAULT NULL" },
    { table: "services", column: "from_address_id", definition: "from_address_id INT DEFAULT NULL" },
    { table: "services", column: "from_address_custom", definition: "from_address_custom TEXT DEFAULT NULL" },
    { table: "services", column: "client_company", definition: "client_company VARCHAR(150) DEFAULT NULL" },
    { table: "services", column: "client_address1", definition: "client_address1 TEXT DEFAULT NULL" },
    { table: "services", column: "client_address2", definition: "client_address2 TEXT DEFAULT NULL" },
    { table: "services", column: "client_city", definition: "client_city VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "client_state", definition: "client_state VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "client_pincode", definition: "client_pincode VARCHAR(20) DEFAULT NULL" },
    { table: "services", column: "client_country", definition: "client_country VARCHAR(50) DEFAULT 'India'" },
    { table: "services", column: "tax_type", definition: "tax_type VARCHAR(20) DEFAULT 'GST18'" },
    { table: "services", column: "custom_tax", definition: "custom_tax VARCHAR(20) DEFAULT NULL" },
    { table: "services", column: "exec_name", definition: "exec_name VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "exec_phone", definition: "exec_phone VARCHAR(20) DEFAULT NULL" },
    { table: "services", column: "exec_email", definition: "exec_email VARCHAR(150) DEFAULT NULL" },
    { table: "services", column: "terms_general", definition: "terms_general TINYINT(1) DEFAULT 0" },
    { table: "services", column: "terms_tax", definition: "terms_tax TINYINT(1) DEFAULT 0" },
    { table: "services", column: "terms_project_period", definition: "terms_project_period VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "terms_validity", definition: "terms_validity VARCHAR(50) DEFAULT NULL" },
    { table: "services", column: "terms_separate_orders", definition: "terms_separate_orders TEXT DEFAULT NULL" },
    { table: "services", column: "terms_payment", definition: "terms_payment VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "terms_payment_custom", definition: "terms_payment_custom VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "terms_warranty", definition: "terms_warranty VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "hsn_sac_code", definition: "hsn_sac_code VARCHAR(50) DEFAULT NULL" },
    { table: "services", column: "supplier_branch", definition: "supplier_branch VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "bank_details_id", definition: "bank_details_id VARCHAR(50) DEFAULT NULL" },
    { table: "services", column: "bank_company", definition: "bank_company VARCHAR(150) DEFAULT NULL" },
    { table: "services", column: "bank_name", definition: "bank_name VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "bank_account", definition: "bank_account VARCHAR(50) DEFAULT NULL" },
    { table: "services", column: "bank_ifsc", definition: "bank_ifsc VARCHAR(50) DEFAULT NULL" },
    { table: "services", column: "bank_branch", definition: "bank_branch VARCHAR(100) DEFAULT NULL" },
    { table: "services", column: "custom_terms", definition: "custom_terms TEXT DEFAULT NULL" },
    // Estimate new extra columns
    { table: "estimatenew", column: "client_company", definition: "client_company VARCHAR(150) DEFAULT NULL" },
    { table: "estimatenew", column: "client_address", definition: "client_address TEXT DEFAULT NULL" },
    { table: "estimatenew", column: "client_city", definition: "client_city VARCHAR(100) DEFAULT NULL" },
    { table: "estimatenew", column: "client_state", definition: "client_state VARCHAR(100) DEFAULT NULL" },
    { table: "estimatenew", column: "client_gst", definition: "client_gst VARCHAR(50) DEFAULT NULL" },
    { table: "estimatenew", column: "client_phone", definition: "client_phone VARCHAR(20) DEFAULT NULL" },
    { table: "estimatenew", column: "subtotal", definition: "subtotal DECIMAL(12,2) DEFAULT 0" },
    { table: "estimatenew", column: "total_tax", definition: "total_tax DECIMAL(12,2) DEFAULT 0" },
    { table: "estimatenew", column: "total_discount", definition: "total_discount DECIMAL(12,2) DEFAULT 0" },
    { table: "estimatenew", column: "grand_total", definition: "grand_total DECIMAL(12,2) DEFAULT 0" },
    // Estimate client extra columns
    { table: "estimateclient", column: "subtotal", definition: "subtotal DECIMAL(12,2) DEFAULT 0" },
    { table: "estimateclient", column: "total_tax", definition: "total_tax DECIMAL(12,2) DEFAULT 0" },
    { table: "estimateclient", column: "total_discount", definition: "total_discount DECIMAL(12,2) DEFAULT 0" },
    { table: "estimateclient", column: "grand_total", definition: "grand_total DECIMAL(12,2) DEFAULT 0" },
    // Quotation items extra columns
    { table: "quotation_items", column: "uom", definition: "uom VARCHAR(20) DEFAULT 'Nos'" },
    { table: "quotation_items", column: "hsn_sac", definition: "hsn_sac VARCHAR(20) DEFAULT NULL" },
    { table: "quotation_items", column: "brand_model", definition: "brand_model VARCHAR(150) DEFAULT NULL" },
    // Customer extra columns
    { table: "customers", column: "gst_number", definition: "gst_number VARCHAR(50) DEFAULT NULL" },
    { table: "customers", column: "created_by", definition: "created_by INT DEFAULT NULL" },
    // Users extra columns
    { table: "users", column: "last_name", definition: "last_name VARCHAR(100) DEFAULT NULL" },
    // user_email_configs extra columns
    { table: "user_email_configs", column: "smtp_secure", definition: "smtp_secure VARCHAR(50) DEFAULT 'STARTTLS'" },
    { table: "user_email_configs", column: "from_email_address", definition: "from_email_address VARCHAR(150) DEFAULT NULL" },
    { table: "user_email_configs", column: "sender_name", definition: "sender_name VARCHAR(150) DEFAULT NULL" },
    { table: "user_email_configs", column: "provider", definition: "provider VARCHAR(50) DEFAULT NULL" },
    { table: "user_email_configs", column: "is_enabled", definition: "is_enabled TINYINT(1) DEFAULT 1" },
    { table: "users", column: "two_factor_enabled", definition: "two_factor_enabled TINYINT(1) DEFAULT 0" },
    // GST mode columns
    { table: "quotations", column: "gst_mode", definition: "gst_mode VARCHAR(20) DEFAULT 'Exclusive'" },
    { table: "quotations", column: "status", definition: "status VARCHAR(20) DEFAULT 'Pending'" },
    { table: "performainvoices", column: "gst_mode", definition: "gst_mode VARCHAR(20) DEFAULT 'Exclusive'" },
    { table: "performainvoices", column: "status", definition: "status VARCHAR(20) DEFAULT 'Pending'" },
    { table: "estimate_invoices", column: "gst_mode", definition: "gst_mode VARCHAR(20) DEFAULT 'Exclusive'" },
    { table: "estimate_invoices", column: "status", definition: "status VARCHAR(20) DEFAULT 'Pending'" },
    { table: "service_estimations", column: "gst_mode", definition: "gst_mode VARCHAR(20) DEFAULT 'Exclusive'" },
    { table: "service_estimations", column: "status", definition: "status VARCHAR(20) DEFAULT 'Pending'" },
    { table: "services", column: "gst_mode", definition: "gst_mode VARCHAR(20) DEFAULT 'Exclusive'" },
    { table: "estimatenew", column: "gst_mode", definition: "gst_mode VARCHAR(20) DEFAULT 'Exclusive'" },
    // WhatsApp automation dedupe columns (waPaymentDueScheduler.js / waLeadFollowupScheduler.js)
    { table: "clientinvoices", column: "wa_payment_due_sent", definition: "wa_payment_due_sent TINYINT(1) DEFAULT 0" },
    { table: "telecalls", column: "wa_followup_sent_date", definition: "wa_followup_sent_date DATE DEFAULT NULL" },
    { table: "walkins", column: "wa_followup_sent_date", definition: "wa_followup_sent_date DATE DEFAULT NULL" },
    { table: "fields", column: "wa_followup_sent_date", definition: "wa_followup_sent_date DATE DEFAULT NULL" }
  ];

  const enumFixes = [
    { table: "tasks", column: "project_priority", oldEnum: "'Low','Normal','High','Urgent'", newEnum: "'Low','Normal','Medium','High','Urgent'" },
    // teammember.emp_role is converted to VARCHAR in seedDefaultEmployees() below — no
    // enum widen needed (or possible) here anymore.
    { table: "telecalls", column: "call_outcome", oldEnum: "'New','Converted','Disqualified'", newEnum: "'New','Hot Case','Warm Case','Cold Case','Not Required','Converted','Closed','Billed','Custom'" },
    { table: "walkins", column: "walkin_status", oldEnum: "'New','Converted','Disqualified'", newEnum: "'New','Hot Case','Warm Case','Cold Case','Not Required','Converted','Disqualified','Closed','Billed','Custom'" },
    { table: "fields", column: "field_outcome", oldEnum: "'New','Converted','Disqualified'", newEnum: "'New','Hot Case','Warm Case','Cold Case','Not Required','Converted','Disqualified','Closed','Billed','Custom'" }
  ];

  for (const { table, column, definition, expectedType } of columnChecks) {
    try {
      await ensureColumnAsync(table, column, definition, expectedType);
    } catch (e) {
      // Table may not exist yet — will retry in second pass after tables are created
    }
  }

  for (const { table, column, oldEnum, newEnum } of enumFixes) {
    try {
      await new Promise((resolve, reject) => {
        db.query(
          `SELECT column_type FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
          [process.env.DB_NAME, table, column],
          (err, rows) => {
            if (err || rows.length === 0) return resolve();
            const currentType = rows[0].column_type || "";
            const isPriorityFix = table === "tasks" && currentType.toLowerCase().includes("medium");
            const isRoleFix = table === "teammember" && currentType.includes("Manager");
            if (isPriorityFix || isRoleFix) {
              console.log(`✅ ${table}.${column} already updated`);
              return resolve();
            }
            const newType = currentType.replace(oldEnum, newEnum);
            if (newType !== currentType) {
              db.query(`ALTER TABLE ${table} MODIFY ${column} ENUM${newType}`, (e) => {
                if (e && !e.message.includes("Duplicate") && !e.message.includes("Data truncated")) console.error(`❌ Fix ${table}.${column}:`, e.message);
                else console.log(`✅ Fixed ${table}.${column} enum`);
                resolve();
              });
            } else {
              resolve();
            }
          }
        );
      });
    } catch (e) { console.error(`Enum fix error: ${e.message}`); }
  }

  for (const { name, sql } of tableStatements) {
    try {
      await querySafe(sql, `Create table ${name}`);
    } catch (e) {
      console.error(`Error creating table ${name}:`, e.message);
    }
  }

  for (const { table, column, definition, expectedType } of columnChecks) {
    try {
      await ensureColumnAsync(table, column, definition, expectedType);
    } catch (e) {
      console.error(`Error adding column ${table}.${column}:`, e.message);
    }
  }
}

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function seedDefaultEmployees() {
  try {
    await new Promise((resolve) => {
      db.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','subadmin','employee','user') DEFAULT 'employee'", (err) => {
        if (err) console.log("Alter users role:", err.message);
        else console.log("Users role column updated");
        resolve();
      });
    });
    await new Promise((resolve) => {
      // emp_role is freeform ("Admin dept", "sales dept", "Service", ...) everywhere it's
      // written (authRoutes.js, team.js accept any string) — a fixed ENUM here re-fought
      // that on every boot and started failing ("Data truncated") the moment any row held
      // a role outside the 4 hardcoded values. VARCHAR accepts whatever role text is in use.
      db.query("ALTER TABLE teammember MODIFY COLUMN emp_role VARCHAR(150) DEFAULT 'Sales'", (err) => {
        if (err) console.log("Alter teammember emp_role:", err.message);
        else console.log("Teammember emp_role updated");
        resolve();
      });
    });
  } catch (e) { console.log("Seed alter skip:", e.message); }

  const adminUser = { first_name: "Admin", last_name: "", emp_id: "ADMIN001", email: "admin@madhuratech.com", mobile: "", job_title: "Administrator", emp_role: "Manager", role: "admin", password: "admin@123" };
  const adminHash = await bcrypt.hash(adminUser.password, 10);
  try {
    const existingAdmin = await queryAsync(`SELECT id FROM users WHERE email = ?`, [adminUser.email]);
    if (existingAdmin.length > 0) {
      await queryAsync(`UPDATE users SET first_name=?, last_name=?, emp_id=?, user_password=?, role='admin', status='active' WHERE email=?`,
        [adminUser.first_name, adminUser.last_name, adminUser.emp_id, adminHash, adminUser.email]);
    } else {
      await queryAsync(`INSERT INTO users (first_name, last_name, emp_id, email, user_password, role, status) VALUES (?, ?, ?, ?, ?, 'admin', 'active')`,
        [adminUser.first_name, adminUser.last_name, adminUser.emp_id, adminUser.email, adminHash]);
    }
  } catch (e) { console.log("Admin seed:", e.message); }

  try {
    const adminTeamCheck = await queryAsync(`SELECT id FROM teammember WHERE emp_email = ?`, [adminUser.email]);
    if (adminTeamCheck.length === 0) {
      await queryAsync(
        `INSERT INTO teammember (first_name, last_name, emp_id, emp_email, mobile, job_title, emp_role, quotation_count, user_id)
         SELECT ?, ?, ?, ?, ?, ?, ?, 0, id FROM users WHERE email = ? LIMIT 1`,
        [adminUser.first_name, adminUser.last_name, adminUser.emp_id, adminUser.email, adminUser.mobile, adminUser.job_title, adminUser.emp_role, adminUser.email]
      );
    } else {
      await queryAsync(
        `UPDATE teammember SET first_name = ?, last_name = ?, emp_id = ?, job_title = ?, emp_role = ?, user_id = (SELECT id FROM users WHERE email = ? LIMIT 1) WHERE emp_email = ?`,
        [adminUser.first_name, adminUser.last_name, adminUser.emp_id, adminUser.job_title, adminUser.emp_role, adminUser.email, adminUser.email]
      );
    }
  } catch (e) { console.log("Admin teammember seed:", e.message); }

  const employees = [
    { first_name: "Princee", last_name: "SD", emp_id: "MT055", email: "info@madhuratech.com", mobile: "", job_title: "Sales", emp_role: "Sales" },
    { first_name: "Vimal", last_name: "", emp_id: "MT051", email: "sales1@technostore.co.in", mobile: "", job_title: "Sales", emp_role: "Sales" },
    { first_name: "Moorthi", last_name: "", emp_id: "MT015", email: "sales5@technostore.co.in", mobile: "", job_title: "Sales", emp_role: "Sales" },
    { first_name: "Uma", last_name: "Kalyani", emp_id: "MT010", email: "uma@madhuratech.com", mobile: "", job_title: "Sales", emp_role: "Sales" },
    { first_name: "Nagaraj", last_name: "", emp_id: "MT014", email: "nagaraj@technostore.co.in", mobile: "", job_title: "Sales", emp_role: "Sales" },
    { first_name: "Priyanka", last_name: "", emp_id: "MT099", email: "service@madhuratech.com", mobile: "", job_title: "Sales", emp_role: "Sales" },
    { first_name: "Malarvannan", last_name: "", emp_id: "MT016", email: "malarvannan@technostore.co.in", mobile: "", job_title: "Service", emp_role: "Sales", role: "subadmin" },
    { first_name: "Jai", last_name: "sir", emp_id: "MT002", email: "jai@technostore.co.in", mobile: "", job_title: "Admin dept", emp_role: "Manager", role: "subadmin" },
    { first_name: "Manikandan", last_name: "", emp_id: "MT061", email: "mani@technostore.co.in", mobile: "", job_title: "sales dept", emp_role: "Sales", role: "employee" },
    { first_name: "Anand", last_name: "", emp_id: "MT012", email: "sales3@technostore.co.in", mobile: "", job_title: "sales dept", emp_role: "Sales", role: "employee" }
  ];

  for (const employee of employees) {
    const hash = await bcrypt.hash(`Madhura@${employee.first_name}`, 10);
    try {
      const existing = await queryAsync(`SELECT id FROM users WHERE email = ?`, [employee.email]);
      if (existing.length > 0) {
        // Do NOT overwrite role or user_password to avoid resetting updates made in the app
        await queryAsync(
          `UPDATE users SET first_name=?, last_name=?, emp_id=? WHERE email=?`,
          [employee.first_name, employee.last_name, employee.emp_id, employee.email]
        );
      } else {
        await queryAsync(
          `INSERT INTO users (first_name, last_name, emp_id, email, user_password, role, status)
           VALUES (?, ?, ?, ?, ?, ?, 'active')`,
          [employee.first_name, employee.last_name, employee.emp_id, employee.email, hash, employee.role || 'employee']
        );
      }
    } catch (e) { console.log("User seed:", employee.email, e.message); }

    const checkExist = await queryAsync(`SELECT id FROM teammember WHERE emp_email = ?`, [employee.email]);
    if (checkExist.length === 0) {
      await queryAsync(
        `INSERT INTO teammember (first_name, last_name, emp_id, emp_email, mobile, job_title, emp_role, quotation_count, user_id)
         SELECT ?, ?, ?, ?, ?, ?, ?, 0, id FROM users WHERE email = ? LIMIT 1`,
        [employee.first_name, employee.last_name, employee.emp_id, employee.email, employee.mobile, employee.job_title, employee.emp_role, employee.email]
      );
    } else {
      await queryAsync(
        `UPDATE teammember SET first_name = ?, last_name = ?, emp_id = ?, job_title = ?, emp_role = ?, user_id = (SELECT id FROM users WHERE email = ? LIMIT 1) WHERE emp_email = ?`,
        [employee.first_name, employee.last_name, employee.emp_id, employee.job_title, employee.emp_role, employee.email, employee.email]
      );
    }
  }
  console.log("Default employees seeded successfully.");
}

const ready = new Promise((resolve, reject) => {
  let attempts = 0;
  const maxAttempts = 15;

  function attemptConnect() {
    attempts++;
    db.connect((err) => {
      if (err) {
        if (attempts < maxAttempts) {
          console.warn(`⏳ [MySQL Connection Retry] Attempt ${attempts}/${maxAttempts} failed (${err.message}). Retrying in 3 seconds...`);
          setTimeout(attemptConnect, 3000);
          return;
        }
        console.error("❌ MySQL connection failed after max retries:", err.message);
        return reject(err);
      }
      console.log(`✅ MySQL Connected (${process.env.DB_HOST}:${dbPort})`);

      db.query(
        `CREATE DATABASE IF NOT EXISTS \`${escapedDbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        async (err) => {
        if (err) {
          console.error(`Database creation failed for ${dbName}:`, err.message);
          return reject(err);
        }

        db.changeUser({ database: dbName }, async (err) => {
          if (err) {
            console.error(`Database selection failed for ${dbName}:`, err.message);
            return reject(err);
          }
          console.log(`Using database ${dbName}`);

          if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, "utf8");
            
            // Temporarily disable foreign key checks to prevent referenced table/foreign key errors on clean installs
            db.query("SET FOREIGN_KEY_CHECKS = 0;", (fkErr) => {
              if (fkErr) {
                console.error("Failed to disable foreign key checks:", fkErr.message);
                return reject(fkErr);
              }
              
              db.query(schema, (err) => {
                // Always restore foreign key checks
                db.query("SET FOREIGN_KEY_CHECKS = 1;", async (fkRestoreErr) => {
                  if (err) {
                    console.error("Database initialization failed:", err.message);
                    return reject(err);
                  }
                  if (fkRestoreErr) {
                    console.error("Failed to re-enable foreign key checks:", fkRestoreErr.message);
                    return reject(fkRestoreErr);
                  }
                  
                  console.log("Database initialized successfully");
                  try {
                    await ensureTablesAndColumns();
                    await seedDefaultEmployees();
                    resolve(db);
                  } catch (migrationErr) {
                    reject(migrationErr);
                  }
                });
              });
            });
          } else {
            try {
              await ensureTablesAndColumns();
              await seedDefaultEmployees();
              resolve(db);
            } catch (migrationErr) {
              reject(migrationErr);
            }
          }
        });
      }
    );
  });
}

attemptConnect();
});

db.ready = ready;

module.exports = db;
