import express from 'express';
import { db } from '../db/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  buildPaymentReceiptTemplate,
  buildInvoiceReminderTemplate,
  dispatchNotification
} from '../services/notificationService.js';
import {
  getRazorpayConfig,
  saveRazorpayConfig,
  createRazorpayOrder,
  verifyAndSettlePayment
} from '../services/razorpayService.js';
import {
  getStripeConfig,
  saveStripeConfig,
  createStripePaymentIntent,
  confirmStripePayment
} from '../services/stripeService.js';

const router = express.Router();

// List payments
router.get('/', authenticate, (req, res) => {
  const { invoice_id, method, search, limit = 100, offset = 0 } = req.query;

  let query = `
    SELECT p.*,
           i.number as invoice_number, i.total as invoice_total, i.status as invoice_status,
           c.name as customer_name, c.company as customer_company
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN customers c ON i.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];

  // Customer role restriction
  if (req.user.role === 'customer') {
    const cust = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(req.user.id);
    if (!cust) return res.json({ payments: [], total: 0 });
    query += ' AND i.customer_id = ?';
    params.push(cust.id);
  }

  if (invoice_id) {
    query += ' AND p.invoice_id = ?';
    params.push(invoice_id);
  }

  if (method) {
    query += ' AND p.method = ?';
    params.push(method);
  }

  if (search) {
    query += ' AND (i.number LIKE ? OR c.name LIKE ? OR c.company LIKE ? OR p.note LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  const countRow = db.prepare(countQuery).get(...params);
  const total = countRow ? countRow.total : 0;

  query += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 100, Number(offset) || 0);

  const payments = db.prepare(query).all(...params);
  res.json({ payments, total });
});

// PAY-1 & PAY-2: Record payment against an invoice
router.post('/', authenticate, (req, res) => {
  const { invoice_id, amount, payment_date, note } = req.body;
  const method = req.body.method || req.body.payment_method;

  if (!invoice_id || !method || amount === undefined) {
    return res.status(400).json({ error: 'Invoice, payment method, and amount are required.' });
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
  }

  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
  if (!inv) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  // Customer authorization: can only pay own invoice
  if (req.user.role === 'customer') {
    const cust = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(req.user.id);
    if (!cust || cust.id !== inv.customer_id) {
      return res.status(403).json({ error: 'Access denied. You can only pay your own invoices.' });
    }
  }

  const payDate = payment_date || new Date().toISOString().split('T')[0];

  try {
    db.exec('BEGIN TRANSACTION;');

    const result = db.prepare(`
      INSERT INTO payments (invoice_id, method, amount, payment_date, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(inv.id, method, numAmount, payDate, note || null);

    // Calculate total paid so far
    const totalPaidRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM payments
      WHERE invoice_id = ?
    `).get(inv.id);

    const totalPaid = Number(totalPaidRow.total_paid.toFixed(2));
    const isFullyPaid = totalPaid >= inv.total;

    let newStatus = inv.status;
    if (isFullyPaid) {
      newStatus = 'paid';
    } else if (inv.status === 'draft') {
      newStatus = 'confirmed';
    }

    db.prepare(`
      UPDATE invoices
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, inv.id);

    db.prepare(`
      INSERT INTO activity_logs (type, title, details, target_id, target_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'payment_recorded',
      `Payment of $${numAmount.toFixed(2)} Recorded`,
      `Invoice ${inv.number} received $${numAmount.toFixed(2)} via ${method} (Total Paid: $${totalPaid} / $${inv.total})${isFullyPaid ? ' - FULLY PAID' : ''}`,
      inv.id,
      'invoice',
      req.user.name
    );

    db.exec('COMMIT;');

    const paymentId = Number(result.lastInsertRowid);
    const outstanding = Math.max(0, Number((inv.total - totalPaid).toFixed(2)));

    // Automatically dispatch Payment Receipt notification (Email) to customer
    try {
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(inv.customer_id);
      if (customer) {
        const receiptTemplate = buildPaymentReceiptTemplate({
          payment: { id: paymentId, amount: numAmount, method, payment_date: payDate, note },
          invoice: inv,
          customer,
          isFullyPaid,
          remainingBalance: outstanding
        });

        dispatchNotification({
          customer_id: customer.id,
          invoice_id: inv.id,
          payment_id: paymentId,
          type: 'payment_receipt',
          channel: 'email',
          subject: receiptTemplate.subject,
          email_html: receiptTemplate.emailHtml,
          recipient_email: customer.email,
          recipient_phone: customer.phone,
          created_by: req.user.name
        });
      }
    } catch (e) {
      console.warn('Could not auto-dispatch payment receipt notification:', e.message);
    }

    res.status(201).json({
      message: `Payment of $${numAmount.toFixed(2)} recorded successfully.${isFullyPaid ? ' Invoice is now Paid!' : ''} Payment receipt sent via Email.`,
      paymentId,
      invoiceStatus: newStatus,
      totalPaid,
      outstanding
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Payment recording error:', err);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
});

// PAY-4: Chase overdue invoice
router.post('/chase/:invoiceId', authenticate, requireRole(['admin', 'staff']), (req, res) => {
  const inv = db.prepare(`
    SELECT i.*, c.id as customer_id, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = ?
  `).get(req.params.invoiceId);

  if (!inv) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  const paidRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE invoice_id = ?').get(inv.id);
  const outstanding = Math.max(0, Number((inv.total - paidRow.paid).toFixed(2)));
  inv.outstanding = outstanding;

  const items = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ?').all(inv.id);
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = inv.due_date < today;

  const reminder = buildInvoiceReminderTemplate({
    invoice: inv,
    customer: { name: inv.customer_name, email: inv.customer_email, phone: inv.customer_phone },
    items,
    isOverdue
  });

  // Dispatch actual notification into customer inbox & logs
  dispatchNotification({
    customer_id: inv.customer_id,
    invoice_id: inv.id,
    type: isOverdue ? 'payment_reminder' : 'invoice_due',
    channel: 'email',
    subject: reminder.subject,
    email_html: reminder.emailHtml,
    recipient_email: inv.customer_email,
    recipient_phone: inv.customer_phone,
    created_by: req.user.name
  });

  res.json({
    message: `Payment chase reminder dispatched to ${inv.customer_email} via Email ($${outstanding.toFixed(2)} due).`,
    chasedAt: new Date().toISOString()
  });
});

/**
 * Razorpay Payment Gateway Routes
 */

// 1. Get Razorpay Config
router.get('/razorpay/config', authenticate, (req, res) => {
  const config = getRazorpayConfig();
  res.json({ config });
});

// 2. Create Razorpay Order for an Invoice
router.post('/razorpay/create-order', authenticate, async (req, res) => {
  try {
    const { invoice_id, amount } = req.body;
    if (!invoice_id) return res.status(400).json({ error: 'Invoice ID is required' });

    let customer = null;
    const inv = db.prepare('SELECT customer_id FROM invoices WHERE id = ?').get(invoice_id);
    if (inv) {
      customer = db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(inv.customer_id);
    }

    const orderData = await createRazorpayOrder({ invoiceId: invoice_id, amount, customer });
    res.json(orderData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Verify Razorpay Payment Signature & Settle Invoice
router.post('/razorpay/verify', authenticate, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      invoice_id,
      amount,
      payment_method
    } = req.body;

    if (!invoice_id || !amount) {
      return res.status(400).json({ error: 'Invoice ID and amount are required.' });
    }

    const result = await verifyAndSettlePayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      invoiceId: invoice_id,
      amount,
      paymentMethod: payment_method || 'UPI',
      userName: req.user.name
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Update Razorpay Gateway Credentials
router.post('/razorpay/settings', authenticate, requireRole(['admin']), (req, res) => {
  const { keyId, keySecret } = req.body;
  const config = saveRazorpayConfig({ keyId, keySecret });
  res.json({ message: 'Razorpay configuration saved successfully!', config });
});

/**
 * Stripe Payment Gateway Routes
 */

// 1. Get Stripe Config
router.get('/stripe/config', authenticate, (req, res) => {
  const config = getStripeConfig();
  res.json({ config });
});

// 2. Create Stripe PaymentIntent for an Invoice
router.post('/stripe/create-intent', authenticate, async (req, res) => {
  try {
    const { invoice_id, amount } = req.body;
    if (!invoice_id) return res.status(400).json({ error: 'Invoice ID is required' });

    let customer = null;
    const inv = db.prepare('SELECT customer_id FROM invoices WHERE id = ?').get(invoice_id);
    if (inv) {
      customer = db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(inv.customer_id);
    }

    const intentData = await createStripePaymentIntent({ invoiceId: invoice_id, amount, customer });
    res.json(intentData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Confirm Stripe Payment & Settle Invoice
router.post('/stripe/confirm', authenticate, async (req, res) => {
  try {
    const {
      payment_intent_id,
      invoice_id,
      amount,
      payment_method
    } = req.body;

    if (!invoice_id || !amount) {
      return res.status(400).json({ error: 'Invoice ID and amount are required.' });
    }

    const result = await confirmStripePayment({
      paymentIntentId: payment_intent_id,
      invoiceId: invoice_id,
      amount,
      paymentMethod: payment_method || 'Credit Card (Stripe)',
      userName: req.user.name
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Update Stripe Gateway Credentials
router.post('/stripe/settings', authenticate, requireRole(['admin']), (req, res) => {
  const { publishableKey, secretKey } = req.body;
  const config = saveStripeConfig({ publishableKey, secretKey });
  res.json({ message: 'Stripe configuration saved successfully!', config });
});

export default router;
