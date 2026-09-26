"use strict";
/**
 * waCustomerBillingService.js
 *
 * Self-Service WhatsApp Invoicing & Receipt Dispatcher.
 * Allows customers to text keywords like "BILL", "RECEIPT", "INVOICE", "MY BILL",
 * and automatically receive ONLY their own registered bills, receipts, and payment statements.
 * Strict phone-number scoping ensures complete data privacy and security.
 */

const db = require("../config/database");

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function clean10DigitPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
}

/**
 * Looks up all invoices, performa invoices, receipts, and contract balances
 * strictly registered under this customer's phone number.
 */
async function getCustomerBillsAndReceipts(phone) {
  const last10 = clean10DigitPhone(phone);
  if (!last10 || last10.length < 10) {
    return { found: false, invoices: [], totalBilled: 0, totalPaid: 0, balanceDue: 0 };
  }

  // 1. Find customer name
  let customerName = "Customer";
  const nameLookups = [
    "SELECT name FROM clients WHERE phone LIKE ? LIMIT 1",
    "SELECT customer_name as name FROM customers WHERE mobile_number LIKE ? LIMIT 1",
    "SELECT customer_name as name FROM telecalls WHERE mobile_number LIKE ? LIMIT 1",
    "SELECT name FROM wa_contacts WHERE phone LIKE ? LIMIT 1",
  ];
  for (const q of nameLookups) {
    try {
      const rows = await queryAsync(q, [`%${last10}`]);
      if (rows[0] && rows[0].name && rows[0].name !== "WhatsApp Lead") {
        customerName = rows[0].name;
        break;
      }
    } catch (_) {}
  }

  const allInvoices = [];
  let totalBilled = 0;
  let totalPaid = 0;

  // 2. Lookup Client Invoices & linked payments
  try {
    const clientInvRows = await queryAsync(
      `SELECT ci.id, ci.client_company, ci.project_names, ci.invoice_date, ci.invoice_duedate, ci.category,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = ci.id), 0) AS paid_amount,
        COALESCE((SELECT MAX(p.payment_date) FROM payments p WHERE p.invoice_id = ci.id), NULL) AS last_payment_date
       FROM clientinvoices ci
       JOIN clients c ON (c.company_name = ci.client_company OR c.name = ci.client_company)
       WHERE c.phone LIKE ?
       ORDER BY ci.id DESC LIMIT 10`,
      [`%${last10}`]
    );

    for (const inv of clientInvRows) {
      const paid = parseFloat(inv.paid_amount) || 0;
      // If clientinvoices doesn't store a fixed grand_total column, use paid amount or estimated project value
      const billed = paid > 0 ? paid : 0;
      const isPaid = paid > 0;

      allInvoices.push({
        id: inv.id,
        invoice_no: `INV-${inv.id}`,
        type: "Tax Invoice",
        project_name: inv.project_names || "AMC & Maintenance",
        date: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString("en-IN") : "Recent",
        due_date: inv.invoice_duedate ? new Date(inv.invoice_duedate).toLocaleDateString("en-IN") : "N/A",
        amount_billed: billed,
        amount_paid: paid,
        balance_due: Math.max(0, billed - paid),
        status: isPaid ? "Paid ✅" : "Payment Pending ⏳",
        last_payment_date: inv.last_payment_date ? new Date(inv.last_payment_date).toLocaleDateString("en-IN") : null,
      });

      totalBilled += billed;
      totalPaid += paid;
    }
  } catch (_) {}

  // 3. Lookup Performa Invoices (Quotations/Invoices with grand_total)
  try {
    const performaRows = await queryAsync(
      `SELECT p.id, p.invoice_date, p.grand_total, p.status, p.created_at,
        c.customer_name
       FROM performainvoices p
       JOIN customers c ON c.id = p.customer_id
       WHERE (c.mobile_number LIKE ? OR c.phone LIKE ?) AND p.is_latest = 1
       ORDER BY p.id DESC LIMIT 5`,
      [`%${last10}`, `%${last10}`]
    );

    for (const p of performaRows) {
      const grandTotal = parseFloat(p.grand_total) || 0;
      const isPaid = (p.status || "").toLowerCase() === "paid";
      const paid = isPaid ? grandTotal : 0;

      // Avoid duplicating invoice if already added
      if (!allInvoices.some((x) => x.id === p.id && x.type === "Performa Invoice")) {
        allInvoices.push({
          id: p.id,
          invoice_no: `PI-${p.id}`,
          type: "Performa Invoice",
          project_name: "Service & Supply Order",
          date: p.invoice_date ? new Date(p.invoice_date).toLocaleDateString("en-IN") : "Recent",
          due_date: "On Receipt",
          amount_billed: grandTotal,
          amount_paid: paid,
          balance_due: Math.max(0, grandTotal - paid),
          status: isPaid ? "Paid ✅" : "Pending Payment ⏳",
          last_payment_date: isPaid ? new Date(p.created_at).toLocaleDateString("en-IN") : null,
        });

        totalBilled += grandTotal;
        totalPaid += paid;
      }
    }
  } catch (_) {}

  // 4. Lookup Contracts (AMC / ALC)
  try {
    const contractRows = await queryAsync(
      `SELECT id, contract_title, client_company, amount_value, remaining, start_date, end_date
       FROM contracts
       WHERE mobile_number LIKE ?
       ORDER BY id DESC LIMIT 3`,
      [`%${last10}`]
    );

    for (const ct of contractRows) {
      const contractAmt = parseFloat(ct.amount_value) || 0;
      const remainingAmt = parseFloat(ct.remaining) || 0;
      const paidAmt = Math.max(0, contractAmt - remainingAmt);

      allInvoices.push({
        id: ct.id,
        invoice_no: `AMC-${ct.id}`,
        type: "AMC Maintenance Contract",
        project_name: ct.contract_title || "Annual Maintenance",
        date: ct.start_date ? new Date(ct.start_date).toLocaleDateString("en-IN") : "Active",
        due_date: ct.end_date ? new Date(ct.end_date).toLocaleDateString("en-IN") : "Renewal Due",
        amount_billed: contractAmt,
        amount_paid: paidAmt,
        balance_due: remainingAmt,
        status: remainingAmt <= 0 ? "Fully Paid ✅" : "Balance Due ⏳",
        last_payment_date: null,
      });

      totalBilled += contractAmt;
      totalPaid += paidAmt;
    }
  } catch (_) {}

  const balanceDue = Math.max(0, totalBilled - totalPaid);

  return {
    found: allInvoices.length > 0,
    customerName,
    phone: last10,
    invoices: allInvoices,
    totalBilled,
    totalPaid,
    balanceDue,
  };
}

/**
 * Formats a billing statement into clean WhatsApp Markdown.
 */
function formatCustomerBillingStatement(billingData) {
  const { customerName, phone, invoices, totalBilled, totalPaid, balanceDue } = billingData;

  if (!invoices || invoices.length === 0) {
    return (
      `Hello *${customerName}*,\n\n` +
      `We checked our billing records, and no past or pending bills were found for your registered number *+91${phone}*.\n\n` +
      `If your account was created under a company name or alternate number, please reply with your *Invoice Number* (e.g. *INV-102*) or reply *AGENT* to speak with our accounts coordinator! 🙏`
    );
  }

  let text = `🧾 *OFFICIAL BILLING & INVOICE STATEMENT*\n`;
  text += `👤 *Customer:* ${customerName}\n`;
  text += `📱 *Registered Mobile:* +91${phone}\n`;
  text += `📅 *Date:* ${new Date().toLocaleDateString("en-IN")}\n`;
  text += `─────────────────────────\n\n`;

  invoices.forEach((inv, index) => {
    text += `*${index + 1}. ${inv.invoice_no}* (${inv.type})\n`;
    text += `   • Service: _${inv.project_name}_\n`;
    text += `   • Date / Due: ${inv.date} (Due: ${inv.due_date})\n`;
    if (inv.amount_billed > 0) {
      text += `   • Amount: ₹${inv.amount_billed.toLocaleString("en-IN")} | Paid: ₹${inv.amount_paid.toLocaleString("en-IN")}\n`;
    }
    text += `   • Status: *${inv.status}*\n\n`;
  });

  text += `─────────────────────────\n`;
  text += `💰 *Total Billed:* ₹${totalBilled.toLocaleString("en-IN")}\n`;
  text += `✅ *Total Paid:* ₹${totalPaid.toLocaleString("en-IN")}\n`;
  if (balanceDue > 0) {
    text += `⏳ *Outstanding Balance:* *₹${balanceDue.toLocaleString("en-IN")}*\n`;
  } else {
    text += `🎉 *All Invoices Clear (No Outstanding Dues)*\n`;
  }
  text += `─────────────────────────\n`;
  text += `_Reply *PAY* to get instant UPI / online payment details, or reply *RECEIPT* for payment confirmation._`;

  return text;
}

/**
 * Checks if incoming text is asking for bill / receipt / invoice keywords.
 * Returns true if handled, false otherwise.
 */
async function handleInboundBillKeyword(phone, messageText, sessionKey = null) {
  if (!phone || !messageText) return false;
  const rawText = messageText.trim();
  const lowerText = rawText.toLowerCase();

  // Keyword trigger patterns
  const isBillKeyword =
    /^(bill|bills|my bill|my bills|receipt|receipts|my receipt|invoice|invoices|my invoice|statement|billing|ledger)$/i.test(lowerText) ||
    /\b(send bill|send my bill|give my bill|bill copy|invoice copy|payment receipt|payment history|get invoice|check bill|view bill|bill details|invoice details|how much do i owe|my dues)\b/i.test(lowerText);

  if (!isBillKeyword) return false;

  console.log(`🧾 [WA Customer Billing] Self-service bill request from +${phone}: "${rawText}"`);

  const billingData = await getCustomerBillsAndReceipts(phone);
  const formattedStatement = formatCustomerBillingStatement(billingData);

  const cleanPhone = phone.replace(/\D/g, "");
  const waLoadBalancer = require("./waLoadBalancer");
  const mdToWa = require("./mdToWa");

  try {
    if (billingData.found) {
      // Statement + native quick actions; falls back to numbered text when no
      // Cloud API sender is available (a throw here used to drop the statement).
      await waLoadBalancer.sendInteractiveButtons({
        phone: cleanPhone,
        body: formattedStatement,
        buttons: [
          { id: "btn_paid", title: "💳 Pay Online / UPI" },
          { id: "btn_support", title: "📞 Call Accounts" },
        ],
        sessionKey,
      });
    } else {
      await waLoadBalancer.sendTextMessage(cleanPhone, mdToWa.toWhatsApp(formattedStatement), sessionKey).catch((sendErr) => {
        console.warn(`⚠️ [WA Customer Billing] Message queued / engine warn: ${sendErr.message}`);
      });
    }

    // Log outbound in wa_message_logs
    await queryAsync(
      `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, status, created_at)
       VALUES (?, 'outbound', 'billing_statement', ?, 'sent', NOW())`,
      [cleanPhone, formattedStatement]
    ).catch(() => {});

    console.log(`✅ [WA Customer Billing] Dispatched billing statement to +${cleanPhone}`);
    return true;
  } catch (err) {
    console.error(`❌ [WA Customer Billing] Failed to send bill to +${cleanPhone}:`, err.message);
    return true;
  }
}

module.exports = {
  getCustomerBillsAndReceipts,
  formatCustomerBillingStatement,
  handleInboundBillKeyword,
};
