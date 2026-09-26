const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

// ── Rate cards for Meta Direct 0% Markup (INR per conversation) ──────────────
const META_RATE_CARD = {
  MARKETING: 0.78, // ~ ₹0.78 per marketing conversation
  UTILITY: 0.31, // ~ ₹0.31 per utility conversation
  AUTHENTICATION: 0.12, // ~ ₹0.12 per OTP/auth conversation
  SERVICE: 0.0, // Free 24-hr user-initiated service window
};

// ── List Payments ────────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const [payments] = await db.promise().query(
      `SELECT p.*, c.name as contact_name_ref
       FROM wa_payments p
       LEFT JOIN wa_contacts c ON p.phone = c.phone
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create WhatsApp Payment Link & Send to Chat ──────────────────────────────
router.post("/create-link", auth, async (req, res) => {
  try {
    const {
      phone,
      contact_name,
      amount,
      currency = "INR",
      description = "Service / Product Payment",
      invoice_id = null,
      quotation_id = null,
      provider = "razorpay",
      send_to_whatsapp = true,
    } = req.body;

    if (!phone || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Valid phone and amount required" });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const safeAmount = parseFloat(amount).toFixed(2);
    const txId = "TXN_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

    // Dynamic payment link / UPI intent URL
    const upiLink = `upi://pay?pa=madhuratech@upi&pn=Madhura%20Tech&am=${safeAmount}&cu=INR&tn=${encodeURIComponent(description)}`;
    const paymentLink = `https://pay.madhuratech.in/checkout?txn=${txId}&amount=${safeAmount}&desc=${encodeURIComponent(description)}`;

    const [result] = await db.promise().query(
      `INSERT INTO wa_payments (phone, contact_name, amount, currency, description, payment_link, provider, status, transaction_id, invoice_id, quotation_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?, ?)`,
      [
        cleanPhone,
        contact_name || null,
        safeAmount,
        currency,
        description,
        paymentLink,
        provider,
        txId,
        invoice_id,
        quotation_id,
        req.user?.id || null,
      ]
    );

    const paymentId = result.insertId;

    // Send WhatsApp Payment Request Card to chat if requested
    if (send_to_whatsapp) {
      try {
        const waService = require("../services/whatsappService").get(req.user?.id || 1);
        const formattedMsg = `💳 *Payment Request from Madhura Tech*\n\n` +
          `• *Description:* ${description}\n` +
          `• *Amount Due:* ₹${parseFloat(safeAmount).toLocaleString()}\n` +
          `• *Transaction Ref:* \`${txId}\`\n\n` +
          `👉 *Pay Online Securely (UPI/Cards/Netbanking):*\n${paymentLink}\n\n` +
          `_Upon successful payment, your official receipt and invoice will be delivered instantly._`;

        await waService.sendMessage(`${cleanPhone}@c.us`, formattedMsg);
      } catch (waErr) {
        console.warn("Could not send payment WhatsApp message:", waErr.message);
      }
    }

    res.json({
      success: true,
      paymentId,
      transactionId: txId,
      paymentLink,
      upiLink,
      amount: safeAmount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mark Payment as Paid & Deliver Instant Receipt / PDF Invoice ──────────────
router.post("/:id/mark-paid", auth, async (req, res) => {
  try {
    const { transaction_id, send_receipt = true } = req.body;
    const [rows] = await db.promise().query("SELECT * FROM wa_payments WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Payment not found" });
    const p = rows[0];

    await db.promise().query(
      "UPDATE wa_payments SET status = 'paid', transaction_id = COALESCE(?, transaction_id), paid_at = NOW() WHERE id = ?",
      [transaction_id || null, req.params.id]
    );

    // If linked to an invoice, update invoice balance & payments table
    if (p.invoice_id) {
      try {
        await db.promise().query(
          "INSERT INTO payments (invoice_id, amount, payment_date, payment_method, notes) VALUES (?, ?, NOW(), 'whatsapp_pay', ?)",
          [p.invoice_id, p.amount, `WhatsApp Pay Txn: ${p.transaction_id}`]
        );
      } catch (e) {
        console.warn("Could not insert payment row:", e.message);
      }
    }

    // Deliver instant receipt on WhatsApp
    if (send_receipt) {
      try {
        const waService = require("../services/whatsappService").get(req.user?.id || 1);
        const receiptMsg = `✅ *Payment Confirmation Receipt*\n\n` +
          `Dear ${p.contact_name || "Customer"},\n` +
          `We have successfully received your payment of *₹${parseFloat(p.amount).toLocaleString()}* for *${p.description}*.\n\n` +
          `• *Txn ID:* \`${p.transaction_id}\`\n` +
          `• *Date & Time:* ${new Date().toLocaleString()}\n` +
          `• *Status:* Successful (0% Fee Direct)\n\n` +
          `Thank you for doing business with Madhura Tech!`;

        await waService.sendMessage(`${p.phone}@c.us`, receiptMsg);
      } catch (waErr) {
        console.warn("Could not send receipt WhatsApp message:", waErr.message);
      }
    }

    res.json({ success: true, message: "Payment marked as paid & receipt delivered" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 0% Markup Direct Meta Category Ledger Summary ─────────────────────────────
router.get("/ledger/summary", auth, async (req, res) => {
  try {
    const [ledgerStats] = await db.promise().query(
      `SELECT 
         category,
         COUNT(*) as conversation_count,
         SUM(cost_inr) as total_cost,
         SUM(markup_inr) as total_markup_saved
       FROM wa_meta_ledger
       GROUP BY category`
    );

    const [recentEntries] = await db.promise().query(
      `SELECT l.*, c.name as contact_name
       FROM wa_meta_ledger l
       LEFT JOIN wa_contacts c ON l.phone = c.phone
       ORDER BY l.created_at DESC LIMIT 50`
    );

    res.json({
      rateCard: META_RATE_CARD,
      stats: ledgerStats,
      recentEntries,
      zeroMarkupGuarantee: "All Meta conversations billed at exact direct rates with 0% markup.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
