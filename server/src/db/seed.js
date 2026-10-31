import bcrypt from 'bcryptjs';
import { db, initDatabase } from './database.js';

export function seedData(force = false) {
  initDatabase();

  // If not forcing a re-seed and data already exists, preserve all user data!
  if (!force) {
    try {
      const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
      if (existingUsers && existingUsers.count > 0) {
        console.log('Database already populated. Preserving all existing user data and subscriptions.');
        return;
      }
    } catch {
      // Table might not exist yet, continue with seed
    }
  }

  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('BrightloopAdmin2026!', salt);
  const staffHash = bcrypt.hashSync('BrightloopStaff2026!', salt);
  const customerHash = bcrypt.hashSync('CustomerAcme2026!', salt);
  const customer2Hash = bcrypt.hashSync('CustomerRetail2026!', salt);
  const customer3Hash = bcrypt.hashSync('CustomerBakery2026!', salt);

  // Clear existing if fresh seed requested
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('DELETE FROM usage_charges');
  db.exec('DELETE FROM usage_alerts');
  db.exec('DELETE FROM usage_events');
  db.exec('DELETE FROM subscription_usage');
  db.exec('DELETE FROM usage_periods');
  db.exec('DELETE FROM plan_features');
  db.exec('DELETE FROM feature_catalog');

  try { db.exec('DELETE FROM support_ticket_messages'); } catch (_) {}
  try { db.exec('DELETE FROM support_tickets'); } catch (_) {}
  try { db.exec('DELETE FROM customer_notifications'); } catch (_) {}

  db.exec('DELETE FROM activity_logs');
  db.exec('DELETE FROM payments');
  db.exec('DELETE FROM invoice_lines');
  db.exec('DELETE FROM invoices');
  db.exec('DELETE FROM subscription_lines');
  db.exec('DELETE FROM subscriptions');
  db.exec('DELETE FROM quotation_template_lines');
  db.exec('DELETE FROM quotation_templates');
  db.exec('DELETE FROM discounts');
  db.exec('DELETE FROM plans');
  db.exec('DELETE FROM tax_rules');
  db.exec('DELETE FROM product_variants');
  db.exec('DELETE FROM products');
  db.exec('DELETE FROM customers');
  db.exec('DELETE FROM users');
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Users (Admin, Staff, Customers)
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES (?, ?, ?, ?)
  `);

  const adminUser = insertUser.run('admin@brightloop.com', adminHash, 'Sarah Jenkins (Admin)', 'admin');
  const staffUser = insertUser.run('staff@brightloop.com', staffHash, 'Marcus Vance (Staff)', 'staff');
  const custUser1 = insertUser.run('customer@acmecorp.com', customerHash, 'Alex Rivera', 'customer');
  const custUser2 = insertUser.run('sarah@retailflow.io', customer2Hash, 'Sarah Connor', 'customer');
  const custUser3 = insertUser.run('liam@cornerstonebakery.com', customer3Hash, 'Liam Murphy', 'customer');

  // 2. Customers (Small shops to large enterprises, Section 2.1)
  const insertCustomer = db.prepare(`
    INSERT INTO customers (user_id, name, email, phone, company, billing_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Large Enterprise on yearly contract
  const acmeCust = insertCustomer.run(
    Number(custUser1.lastInsertRowid),
    'Alex Rivera',
    'customer@acmecorp.com',
    '+1 (555) 234-5678',
    'Acme Global Enterprises',
    '100 Innovation Way, Suite 400, San Francisco, CA 94107'
  );

  // Mid-sized company on annual plan with Odoo sync
  const retailCust = insertCustomer.run(
    Number(custUser2.lastInsertRowid),
    'Sarah Connor',
    'sarah@retailflow.io',
    '+1 (555) 987-6543',
    'RetailFlow Technologies',
    '742 Evergreen Terrace, Seattle, WA 98101'
  );

  // Small local shop on monthly plan (Section 2.1)
  const bakeryCust = insertCustomer.run(
    Number(custUser3.lastInsertRowid),
    'Liam Murphy',
    'liam@cornerstonebakery.com',
    '+1 (555) 123-9876',
    'Cornerstone Artisan Bakery',
    '12 Market Street, Boston, MA 02108'
  );

  // Growing media agency
  const nexusCust = insertCustomer.run(
    null,
    'David Chen',
    'david.chen@nexusmedia.com',
    '+1 (555) 345-6789',
    'Nexus Media Group',
    '500 5th Avenue, New York, NY 10110'
  );

  // Small boutique florist on monthly plan
  const floristCust = insertCustomer.run(
    null,
    'Chloe Bennett',
    'chloe@bloomflowers.com',
    '+1 (555) 888-4321',
    'Bloom Florist Studio',
    '88 Blossom Lane, Portland, OR 97201'
  );

  // 3. Tax Rules (Admin created, INV-3)
  const insertTax = db.prepare('INSERT INTO tax_rules (name, rate, is_active) VALUES (?, ?, ?)');
  const vat10 = insertTax.run('Standard VAT (10%)', 10.0, 1);
  const tax5 = insertTax.run('State Sales Tax (5%)', 5.0, 1);
  const zeroTax = insertTax.run('Zero Rated Export (0%)', 0.0, 1);

  // 4. Products & Variants (PROD-1 to PROD-3)
  const insertProduct = db.prepare(`
    INSERT INTO products (name, type, sales_price, cost_price, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const crmProd = insertProduct.run('Brightloop CRM Core', 'Software', 1200.0, 250.0, 'Full lead management, pipeline forecasting, contact tracking and sales automation');
  const analyticsProd = insertProduct.run('Brightloop Analytics Suite', 'Software', 800.0, 150.0, 'Real-time telemetry, cohort retention, and executive BI dashboards');
  const odooProd = insertProduct.run('Odoo Integration Connector', 'Add-on', 450.0, 50.0, 'Bi-directional ERP synchronization module with custom field mappings');
  const supportProd = insertProduct.run('24/7 Priority Support SLA', 'Service', 350.0, 100.0, 'Dedicated account manager with guaranteed 15-minute response SLA');
  const storageProd = insertProduct.run('Cloud Storage Pack (1TB)', 'Add-on', 100.0, 20.0, 'Encrypted multi-region object storage bundle with daily snapshots');

  // Insert Variants (PROD-2, PROD-3)
  const insertVariant = db.prepare(`
    INSERT INTO product_variants (product_id, attribute, value, extra_price)
    VALUES (?, ?, ?, ?)
  `);

  // Odoo variant with extra price of 560 as explicitly required in the spec!
  insertVariant.run(Number(odooProd.lastInsertRowid), 'Brand', 'Odoo Enterprise', 560.0);
  insertVariant.run(Number(odooProd.lastInsertRowid), 'Brand', 'Standard Community', 0.0);

  // Storage variants
  insertVariant.run(Number(storageProd.lastInsertRowid), 'Storage Tier', 'Ultra NVMe Flash', 80.0);
  insertVariant.run(Number(storageProd.lastInsertRowid), 'Storage Tier', 'Standard SSD', 0.0);

  // CRM deployment variants
  insertVariant.run(Number(crmProd.lastInsertRowid), 'Deployment', 'Dedicated Private VPC', 300.0);
  insertVariant.run(Number(crmProd.lastInsertRowid), 'Deployment', 'Multi-Tenant Cloud', 0.0);

  // 5. Plans (PLAN-1 to PLAN-4)
  const insertPlan = db.prepare(`
    INSERT INTO plans (name, price, billing_period, min_quantity, available_from, available_to, auto_close, closable, pausable, renewable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const planStarter = insertPlan.run('Starter Growth Monthly', 299.0, 'monthly', 1, '2026-01-01', '2028-12-31', 0, 1, 1, 1);
  const planProYearly = insertPlan.run('Professional Yearly', 2999.0, 'yearly', 1, '2026-01-01', '2028-12-31', 0, 1, 1, 1);
  const planEnterprise = insertPlan.run('Enterprise Scale Yearly', 9500.0, 'yearly', 5, '2026-01-01', '2028-12-31', 0, 1, 1, 1);
  const planSprintWeekly = insertPlan.run('Agile Sprint Weekly', 99.0, 'weekly', 1, '2026-01-01', '2028-12-31', 0, 1, 1, 1);
  const planSandboxDaily = insertPlan.run('Sandbox Test Daily', 15.0, 'daily', 1, '2026-01-01', '2028-12-31', 1, 1, 0, 0);

  // 6. Discounts (created by admin only, DISC-1 to DISC-8)
  const insertDiscount = db.prepare(`
    INSERT INTO discounts (code, name, type, value, min_purchase, min_quantity, start_date, end_date, usage_limit, times_used, scope, target_product_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const discVolume = insertDiscount.run('VOLUME10', 'Volume Discount 10%', 'percentage', 10.0, 0, 3, '2026-01-01', '2027-12-31', 100, 8, 'whole_subscription', null, 1);
  const discFixed50 = insertDiscount.run('WELCOME50', 'New Customer $50 Off', 'fixed', 50.0, 500.0, 0, '2026-01-01', '2027-12-31', 50, 4, 'whole_subscription', null, 1);
  const discOdoo = insertDiscount.run('ODOOBOOST', 'Odoo Connector $100 Off', 'fixed', 100.0, 0, 1, '2026-01-01', '2027-12-31', 30, 2, 'specific_products', Number(odooProd.lastInsertRowid), 1);
  // Expired discount for testing auto-stop (DISC-8)
  insertDiscount.run('EXPIRED20', 'Past Promotional 20%', 'percentage', 20.0, 0, 0, '2025-01-01', '2025-12-31', 10, 10, 'whole_subscription', null, 1);

  // 7. Quotation Templates (QT-1 to QT-3)
  const insertTemplate = db.prepare(`
    INSERT INTO quotation_templates (name, plan_id, validity_days, notes)
    VALUES (?, ?, ?, ?)
  `);

  const tplStandard = insertTemplate.run('Standard Growth Pack Template', Number(planStarter.lastInsertRowid), 30, 'Recommended for small shops and growing software teams up to 20 seats');
  const tplEnterprise = insertTemplate.run('Enterprise Odoo Suite Template', Number(planProYearly.lastInsertRowid), 45, 'Complete ERP synchronization connector and high-priority SLA bundle');

  const insertTemplateLine = db.prepare(`
    INSERT INTO quotation_template_lines (template_id, product_id, variant_id, quantity, unit_price)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertTemplateLine.run(Number(tplStandard.lastInsertRowid), Number(crmProd.lastInsertRowid), null, 1, 1200.0);
  insertTemplateLine.run(Number(tplStandard.lastInsertRowid), Number(supportProd.lastInsertRowid), null, 1, 350.0);

  const odooVariant = db.prepare("SELECT id FROM product_variants WHERE value = 'Odoo Enterprise'").get();
  insertTemplateLine.run(Number(tplEnterprise.lastInsertRowid), Number(analyticsProd.lastInsertRowid), null, 2, 800.0);
  insertTemplateLine.run(Number(tplEnterprise.lastInsertRowid), Number(odooProd.lastInsertRowid), odooVariant ? odooVariant.id : null, 1, 1010.0);
  insertTemplateLine.run(Number(tplEnterprise.lastInsertRowid), Number(supportProd.lastInsertRowid), null, 1, 350.0);

  // 8. Seed Subscriptions across all statuses (SUB-1 to SUB-6)
  const insertSub = db.prepare(`
    INSERT INTO subscriptions (number, customer_id, plan_id, start_date, expiry_date, payment_terms, status, next_billing_date, auto_close, closable, pausable, renewable, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSubLine = db.prepare(`
    INSERT INTO subscription_lines (subscription_id, product_id, variant_id, quantity, unit_price, tax_id, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Sub 1: Active Monthly for Acme Corp (Large Enterprise)
  const sub1 = insertSub.run(
    'SUB-2026-0001',
    Number(acmeCust.lastInsertRowid),
    Number(planStarter.lastInsertRowid),
    '2026-09-01',
    '2027-09-01',
    'Net 30',
    'active',
    '2026-11-01',
    0, 1, 1, 1,
    'Key enterprise client on monthly auto-billing'
  );
  insertSubLine.run(Number(sub1.lastInsertRowid), Number(crmProd.lastInsertRowid), null, 2, 1200.0, Number(vat10.lastInsertRowid), 2400.0);
  insertSubLine.run(Number(sub1.lastInsertRowid), Number(supportProd.lastInsertRowid), null, 1, 350.0, Number(vat10.lastInsertRowid), 350.0);

  // Sub 2: Active Yearly for RetailFlow with Odoo variant (+560)
  const sub2 = insertSub.run(
    'SUB-2026-0002',
    Number(retailCust.lastInsertRowid),
    Number(planProYearly.lastInsertRowid),
    '2026-08-15',
    '2027-08-15',
    'Immediate',
    'active',
    '2026-10-15', // Due for billing!
    0, 1, 1, 1,
    'Annual contract with Odoo enterprise synchronization'
  );
  insertSubLine.run(Number(sub2.lastInsertRowid), Number(analyticsProd.lastInsertRowid), null, 3, 800.0, Number(vat10.lastInsertRowid), 2400.0);
  insertSubLine.run(Number(sub2.lastInsertRowid), Number(odooProd.lastInsertRowid), odooVariant ? odooVariant.id : null, 1, 1010.0, Number(vat10.lastInsertRowid), 1010.0);

  // Sub 3: Active Monthly for Small Shop (Cornerstone Bakery)
  const sub3 = insertSub.run(
    'SUB-2026-0003',
    Number(bakeryCust.lastInsertRowid),
    Number(planStarter.lastInsertRowid),
    '2026-09-10',
    '2027-09-10',
    'Net 15',
    'active',
    '2026-11-10',
    0, 1, 1, 1,
    'Small shop plan: single seat CRM Core + Cloud Storage'
  );
  insertSubLine.run(Number(sub3.lastInsertRowid), Number(crmProd.lastInsertRowid), null, 1, 1200.0, Number(tax5.lastInsertRowid), 1200.0);
  insertSubLine.run(Number(sub3.lastInsertRowid), Number(storageProd.lastInsertRowid), null, 1, 100.0, Number(tax5.lastInsertRowid), 100.0);

  // Sub 4: Quotation for Nexus Media
  const sub4 = insertSub.run(
    'SUB-2026-0004',
    Number(nexusCust.lastInsertRowid),
    Number(planEnterprise.lastInsertRowid),
    '2026-11-01',
    '2027-11-01',
    'Net 15',
    'quotation',
    '2026-11-01',
    0, 1, 1, 1,
    'Commercial proposal for 5 enterprise seats + 2 priority SLAs'
  );
  insertSubLine.run(Number(sub4.lastInsertRowid), Number(crmProd.lastInsertRowid), null, 5, 1200.0, Number(tax5.lastInsertRowid), 6000.0);
  insertSubLine.run(Number(sub4.lastInsertRowid), Number(supportProd.lastInsertRowid), null, 2, 350.0, Number(tax5.lastInsertRowid), 700.0);

  // Sub 5: Draft Subscription for Bloom Florist Studio
  const sub5 = insertSub.run(
    'SUB-2026-0005',
    Number(floristCust.lastInsertRowid),
    Number(planStarter.lastInsertRowid),
    '2026-11-05',
    '2027-11-05',
    'Immediate',
    'draft',
    '2026-11-05',
    0, 1, 1, 1,
    'Initial draft proposal being prepared by sales rep'
  );
  insertSubLine.run(Number(sub5.lastInsertRowid), Number(crmProd.lastInsertRowid), null, 1, 1200.0, Number(vat10.lastInsertRowid), 1200.0);

  // Sub 6: Confirmed (awaiting activation)
  const sub6 = insertSub.run(
    'SUB-2026-0006',
    Number(retailCust.lastInsertRowid),
    Number(planStarter.lastInsertRowid),
    '2026-11-01',
    '2027-11-01',
    'Net 30',
    'confirmed',
    '2026-11-01',
    0, 1, 1, 1,
    'Customer confirmed contract, ready to go live'
  );
  insertSubLine.run(Number(sub6.lastInsertRowid), Number(analyticsProd.lastInsertRowid), null, 1, 800.0, Number(vat10.lastInsertRowid), 800.0);

  // Sub 7: Paused Subscription (Customer requested freeze)
  insertSub.run(
    'SUB-2026-0007',
    Number(nexusCust.lastInsertRowid),
    Number(planStarter.lastInsertRowid),
    '2026-05-01',
    '2027-05-01',
    'Immediate',
    'paused',
    '2026-12-01',
    0, 1, 1, 1,
    'Customer paused during seasonal freeze (no billing generated)'
  );

  // Sub 8: Closed Subscription
  insertSub.run(
    'SUB-2026-0008',
    Number(nexusCust.lastInsertRowid),
    Number(planSandboxDaily.lastInsertRowid),
    '2026-01-01',
    '2026-03-01',
    'Immediate',
    'closed',
    null,
    1, 1, 0, 0,
    'Auto-closed sandbox after pilot period ended'
  );

  // 9. Invoices & Lines (INV-1 to INV-6)
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (number, subscription_id, customer_id, billing_period_start, billing_period_end, issue_date, due_date, subtotal, tax_total, discount_total, total, status, sent_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInvLine = db.prepare(`
    INSERT INTO invoice_lines (invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, tax_amount, discount_amount, total_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO payments (invoice_id, method, amount, payment_date, note)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Invoice 1: Paid invoice for Acme Corp
  const inv1 = insertInvoice.run(
    'INV-2026-0001',
    Number(sub1.lastInsertRowid),
    Number(acmeCust.lastInsertRowid),
    '2026-09-01',
    '2026-09-30',
    '2026-09-01',
    '2026-10-01',
    2750.0,
    275.0,
    50.0, // WELCOME50 applied automatically
    2975.0,
    'paid',
    '2026-09-01 10:00:00',
    'September 2026 billing run'
  );

  insertInvLine.run(Number(inv1.lastInsertRowid), Number(crmProd.lastInsertRowid), null, 'Brightloop CRM Core (Monthly)', 2, 1200.0, 10.0, 240.0, 50.0, 2590.0);
  insertInvLine.run(Number(inv1.lastInsertRowid), Number(supportProd.lastInsertRowid), null, '24/7 Priority Support SLA', 1, 350.0, 10.0, 35.0, 0.0, 385.0);
  insertPayment.run(Number(inv1.lastInsertRowid), 'Credit Card', 2975.0, '2026-09-03', 'Stripe auto-charge transaction #ch_992178');

  // Invoice 2: Confirmed OVERDUE invoice for RetailFlow! (due date 2026-09-15, partial payment only)
  const inv2 = insertInvoice.run(
    'INV-2026-0002',
    Number(sub2.lastInsertRowid),
    Number(retailCust.lastInsertRowid),
    '2026-08-15',
    '2026-09-14',
    '2026-08-15',
    '2026-09-15', // Past due!
    3410.0,
    341.0,
    0.0,
    3751.0,
    'confirmed',
    '2026-08-15 11:30:00',
    'Annual kickoff invoice - requires chasing'
  );

  insertInvLine.run(Number(inv2.lastInsertRowid), Number(analyticsProd.lastInsertRowid), null, 'Brightloop Analytics Suite', 3, 800.0, 10.0, 240.0, 0.0, 2640.0);
  insertInvLine.run(Number(inv2.lastInsertRowid), Number(odooProd.lastInsertRowid), odooVariant ? odooVariant.id : null, 'Odoo Integration (Brand: Odoo Enterprise +$560)', 1, 1010.0, 10.0, 101.0, 0.0, 1111.0);
  // Partial payment ($1000 of $3751 paid, $2751 remains overdue)
  insertPayment.run(Number(inv2.lastInsertRowid), 'Bank Transfer', 1000.0, '2026-09-10', 'Wire payment installment #1 (ref: WT-4412)');

  // Invoice 3: Current confirmed invoice for Acme Corp
  const inv3 = insertInvoice.run(
    'INV-2026-0003',
    Number(sub1.lastInsertRowid),
    Number(acmeCust.lastInsertRowid),
    '2026-10-01',
    '2026-10-31',
    '2026-10-01',
    '2026-11-01',
    2750.0,
    275.0,
    0.0,
    3025.0,
    'confirmed',
    '2026-10-01 09:15:00',
    'October 2026 billing run'
  );
  insertInvLine.run(Number(inv3.lastInsertRowid), Number(crmProd.lastInsertRowid), null, 'Brightloop CRM Core (Monthly)', 2, 1200.0, 10.0, 240.0, 0.0, 2640.0);
  insertInvLine.run(Number(inv3.lastInsertRowid), Number(supportProd.lastInsertRowid), null, '24/7 Priority Support SLA', 1, 350.0, 10.0, 35.0, 0.0, 385.0);

  // Invoice 4: Paid invoice for Small Shop (Cornerstone Bakery)
  const inv4 = insertInvoice.run(
    'INV-2026-0004',
    Number(sub3.lastInsertRowid),
    Number(bakeryCust.lastInsertRowid),
    '2026-09-10',
    '2026-10-09',
    '2026-09-10',
    '2026-09-25',
    1300.0,
    65.0,
    0.0,
    1365.0,
    'paid',
    '2026-09-10 14:00:00',
    'First month small shop billing'
  );
  insertInvLine.run(Number(inv4.lastInsertRowid), Number(crmProd.lastInsertRowid), null, 'Brightloop CRM Core (Small Shop)', 1, 1200.0, 5.0, 60.0, 0.0, 1260.0);
  insertInvLine.run(Number(inv4.lastInsertRowid), Number(storageProd.lastInsertRowid), null, 'Cloud Storage Pack (1TB)', 1, 100.0, 5.0, 5.0, 0.0, 105.0);
  insertPayment.run(Number(inv4.lastInsertRowid), 'Credit Card', 1365.0, '2026-09-12', 'Square terminal card payment #sq_1882');

  // Invoice 5: Draft invoice waiting for review
  const inv5 = insertInvoice.run(
    'INV-2026-0005',
    Number(sub2.lastInsertRowid),
    Number(retailCust.lastInsertRowid),
    '2026-09-15',
    '2026-10-14',
    '2026-10-31',
    '2026-11-30',
    3410.0,
    341.0,
    0.0,
    3751.0,
    'draft',
    null,
    'Generated by system run, awaiting team verification'
  );
  insertInvLine.run(Number(inv5.lastInsertRowid), Number(analyticsProd.lastInsertRowid), null, 'Brightloop Analytics Suite', 3, 800.0, 10.0, 240.0, 0.0, 2640.0);

  // 10. Activity Logs
  const insertLog = db.prepare(`
    INSERT INTO activity_logs (type, title, details, target_id, target_type, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertLog.run('billing_run', 'System Billing Run Executed', 'Processed 4 active subscriptions, generated 1 new draft invoice', null, 'billing', 'System');
  insertLog.run('payment_recorded', 'Payment Received ($2,975.00)', 'Recorded $2,975.00 via Credit Card for INV-2026-0001', Number(inv1.lastInsertRowid), 'invoice', 'Sarah Jenkins');
  insertLog.run('payment_recorded', 'Partial Payment Received ($1,000.00)', 'Recorded wire payment of $1,000.00 for INV-2026-0002', Number(inv2.lastInsertRowid), 'invoice', 'Marcus Vance');
  insertLog.run('chase_sent', 'Overdue Payment Chased', 'Sent overdue notification to sarah@retailflow.io for invoice INV-2026-0002 ($2,751.00 balance)', Number(inv2.lastInsertRowid), 'invoice', 'Marcus Vance');

  // 11. Feature Catalog across sectors (General, Healthcare, Education, E-commerce, Transportation)
  const insertFeature = db.prepare(`
    INSERT INTO feature_catalog (key, name, description, sector, feature_type, unit, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const featInvoices = insertFeature.run('invoices_generation', 'Invoice Generation', 'Monthly automated & manual invoice generation engine', 'general', 'quantity', 'invoices', 1);
  const featStaff = insertFeature.run('staff_accounts', 'Team Seats', 'Active staff and administrative user seats', 'general', 'quantity', 'seats', 1);
  const featApi = insertFeature.run('api_requests', 'API Requests', 'High-throughput REST API and Webhook requests', 'general', 'consumption', 'requests', 1);
  const featStorage = insertFeature.run('cloud_storage', 'Cloud Storage', 'Secure multi-region encrypted document storage', 'general', 'consumption', 'GB', 1);
  const featReports = insertFeature.run('report_exports', 'Report Exports', 'Financial intelligence PDF & CSV exports', 'general', 'quantity', 'reports', 1);
  const featPriority = insertFeature.run('priority_support', 'Priority Support SLA', '24/7 dedicated support team with 15-minute response SLA', 'general', 'access', 'access', 1);
  const featBranding = insertFeature.run('custom_branding', 'Custom Branding', 'White-labeled customer portal and custom domain styling', 'general', 'access', 'access', 1);
  const featErp = insertFeature.run('erp_sync', 'ERP Real-time Sync', 'Bi-directional synchronization events with Odoo ERP', 'general', 'consumption', 'syncs', 1);
  const featAi = insertFeature.run('ai_report_generation', 'AI Report Generation', 'Autonomous neural network financial forecasting and insights', 'general', 'consumption', 'credits', 1);

  // Cross-sector features to prove dynamic multi-industry adaptability
  // Healthcare
  insertFeature.run('patient_records', 'Patient Electronic Records', 'Digital medical charts and HIPAA-compliant history', 'healthcare', 'quantity', 'records', 1);
  insertFeature.run('appointment_scheduling', 'Appointment Slots', 'Telehealth and in-clinic consultation bookings', 'healthcare', 'quantity', 'bookings', 1);
  // Education
  insertFeature.run('student_accounts', 'Student Enrollment', 'Active student directory and course access profiles', 'education', 'quantity', 'students', 1);
  insertFeature.run('online_exams', 'Proctored Examinations', 'Automated grading and online exam sessions', 'education', 'quantity', 'exams', 1);
  // E-commerce
  insertFeature.run('product_listings', 'Product Catalog Items', 'Active SKU listings, variations, and catalog sync', 'ecommerce', 'quantity', 'products', 1);
  insertFeature.run('order_processing', 'Order Processing Engine', 'Checkout routing and multi-channel fulfillment orders', 'ecommerce', 'quantity', 'orders', 1);
  // Transportation
  insertFeature.run('vehicle_tracking', 'Fleet GPS Telematics', 'Live GPS asset tracking and telemetry updates', 'transportation', 'quantity', 'vehicles', 1);
  insertFeature.run('trip_management', 'Trip Dispatches', 'Automated route dispatching and driver manifests', 'transportation', 'quantity', 'trips', 1);

  // 12. Plan Features Mapping
  const insertPlanFeature = db.prepare(`
    INSERT INTO plan_features (plan_id, feature_id, allowance, is_unlimited, overage_allowed, overage_rate, reset_frequency, policy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Starter Growth Monthly Plan
  insertPlanFeature.run(Number(planStarter.lastInsertRowid), Number(featInvoices.lastInsertRowid), 50, 0, 1, 1.50, 'billing_period', 'overage');
  insertPlanFeature.run(Number(planStarter.lastInsertRowid), Number(featStaff.lastInsertRowid), 3, 0, 0, 0.0, 'billing_period', 'hard_limit');
  insertPlanFeature.run(Number(planStarter.lastInsertRowid), Number(featApi.lastInsertRowid), 100, 0, 1, 0.01, 'billing_period', 'overage');
  insertPlanFeature.run(Number(planStarter.lastInsertRowid), Number(featStorage.lastInsertRowid), 10, 0, 1, 4.00, 'billing_period', 'overage');
  insertPlanFeature.run(Number(planStarter.lastInsertRowid), Number(featReports.lastInsertRowid), 10, 0, 0, 0.0, 'billing_period', 'soft_alert');
  insertPlanFeature.run(Number(planStarter.lastInsertRowid), Number(featBranding.lastInsertRowid), 0, 0, 0, 0.0, 'never', 'hard_limit');

  // Professional Yearly Plan (includes exclusive erp_sync and priority_support)
  insertPlanFeature.run(Number(planProYearly.lastInsertRowid), Number(featInvoices.lastInsertRowid), 500, 0, 1, 1.00, 'billing_period', 'overage');
  insertPlanFeature.run(Number(planProYearly.lastInsertRowid), Number(featStaff.lastInsertRowid), 15, 0, 0, 0.0, 'billing_period', 'hard_limit');
  insertPlanFeature.run(Number(planProYearly.lastInsertRowid), Number(featApi.lastInsertRowid), 100, 0, 1, 0.005, 'billing_period', 'overage');
  insertPlanFeature.run(Number(planProYearly.lastInsertRowid), Number(featStorage.lastInsertRowid), 100, 0, 1, 2.50, 'billing_period', 'overage');
  insertPlanFeature.run(Number(planProYearly.lastInsertRowid), Number(featReports.lastInsertRowid), 100, 0, 0, 0.0, 'billing_period', 'soft_alert');
  insertPlanFeature.run(Number(planProYearly.lastInsertRowid), Number(featPriority.lastInsertRowid), null, 1, 0, 0.0, 'never', 'soft_alert');
  insertPlanFeature.run(Number(planProYearly.lastInsertRowid), Number(featBranding.lastInsertRowid), null, 1, 0, 0.0, 'never', 'soft_alert');
  insertPlanFeature.run(Number(planProYearly.lastInsertRowid), Number(featErp.lastInsertRowid), 100, 0, 1, 0.05, 'billing_period', 'overage');

  // Enterprise Scale Yearly Plan (includes exclusive ai_report_generation, unlimited invoices and reports)
  insertPlanFeature.run(Number(planEnterprise.lastInsertRowid), Number(featInvoices.lastInsertRowid), null, 1, 0, 0.0, 'billing_period', 'soft_alert');
  insertPlanFeature.run(Number(planEnterprise.lastInsertRowid), Number(featStaff.lastInsertRowid), 100, 0, 0, 0.0, 'billing_period', 'hard_limit');
  insertPlanFeature.run(Number(planEnterprise.lastInsertRowid), Number(featApi.lastInsertRowid), 100, 0, 1, 0.002, 'billing_period', 'overage');
  insertPlanFeature.run(Number(planEnterprise.lastInsertRowid), Number(featStorage.lastInsertRowid), 500, 0, 1, 1.50, 'billing_period', 'overage');
  insertPlanFeature.run(Number(planEnterprise.lastInsertRowid), Number(featReports.lastInsertRowid), null, 1, 0, 0.0, 'billing_period', 'soft_alert');
  insertPlanFeature.run(Number(planEnterprise.lastInsertRowid), Number(featPriority.lastInsertRowid), null, 1, 0, 0.0, 'never', 'soft_alert');
  insertPlanFeature.run(Number(planEnterprise.lastInsertRowid), Number(featBranding.lastInsertRowid), null, 1, 0, 0.0, 'never', 'soft_alert');
  insertPlanFeature.run(Number(planEnterprise.lastInsertRowid), Number(featErp.lastInsertRowid), 100, 0, 1, 0.02, 'billing_period', 'overage');
  insertPlanFeature.run(Number(planEnterprise.lastInsertRowid), Number(featAi.lastInsertRowid), 500, 0, 1, 0.50, 'billing_period', 'overage');

  // Agile Sprint Weekly Plan
  insertPlanFeature.run(Number(planSprintWeekly.lastInsertRowid), Number(featInvoices.lastInsertRowid), 15, 0, 0, 0.0, 'billing_period', 'soft_alert');
  insertPlanFeature.run(Number(planSprintWeekly.lastInsertRowid), Number(featApi.lastInsertRowid), 100, 0, 0, 0.0, 'billing_period', 'soft_alert');

  // Sandbox Test Daily Plan
  insertPlanFeature.run(Number(planSandboxDaily.lastInsertRowid), Number(featInvoices.lastInsertRowid), 5, 0, 0, 0.0, 'billing_period', 'hard_limit');
  insertPlanFeature.run(Number(planSandboxDaily.lastInsertRowid), Number(featApi.lastInsertRowid), 100, 0, 0, 0.0, 'billing_period', 'hard_limit');

  // 13. Seed Usage Periods and Actual Usage for Subscriptions
  const insertUsagePeriod = db.prepare(`
    INSERT INTO usage_periods (subscription_id, period_start, period_end, status)
    VALUES (?, ?, ?, ?)
  `);

  const insertUsage = db.prepare(`
    INSERT INTO subscription_usage (subscription_id, feature_id, period_id, usage_value, last_recorded_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  const insertUsageEvent = db.prepare(`
    INSERT INTO usage_events (idempotency_key, subscription_id, feature_id, period_id, quantity, operation_type, source_ref, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertUsageAlert = db.prepare(`
    INSERT INTO usage_alerts (subscription_id, feature_id, period_id, threshold_percent, message, severity, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertUsageCharge = db.prepare(`
    INSERT INTO usage_charges (subscription_id, feature_id, period_id, units_over, rate, amount, status, invoice_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Sub 1 (Acme Corp on Starter Growth Monthly: current period 2026-10-01 to 2026-11-01)
  const periodSub1 = insertUsagePeriod.run(Number(sub1.lastInsertRowid), '2026-10-01', '2026-11-01', 'active');
  const period1Id = Number(periodSub1.lastInsertRowid);

  // Sub 1 Usage:
  // Invoices: 42 / 50 (84%)
  insertUsage.run(Number(sub1.lastInsertRowid), Number(featInvoices.lastInsertRowid), period1Id, 42);
  insertUsageAlert.run(Number(sub1.lastInsertRowid), Number(featInvoices.lastInsertRowid), period1Id, 50, 'Invoices reached 50% allowance (25 / 50).', 'info', 1);
  insertUsageAlert.run(Number(sub1.lastInsertRowid), Number(featInvoices.lastInsertRowid), period1Id, 80, 'Invoices reached 80% allowance (40 / 50). Consider reviewing your upcoming billing needs.', 'warning', 0);

  // Staff: 2 / 3 (66.7%)
  insertUsage.run(Number(sub1.lastInsertRowid), Number(featStaff.lastInsertRowid), period1Id, 2);
  insertUsageAlert.run(Number(sub1.lastInsertRowid), Number(featStaff.lastInsertRowid), period1Id, 50, 'Team Seats reached 50% capacity (2 / 3).', 'info', 1);

  // API Requests: 4,650 / 5,000 (93%)
  insertUsage.run(Number(sub1.lastInsertRowid), Number(featApi.lastInsertRowid), period1Id, 4650);
  insertUsageAlert.run(Number(sub1.lastInsertRowid), Number(featApi.lastInsertRowid), period1Id, 50, 'API Requests crossed 50% monthly quota (2,500 / 5,000).', 'info', 1);
  insertUsageAlert.run(Number(sub1.lastInsertRowid), Number(featApi.lastInsertRowid), period1Id, 80, 'API Requests reached 80% quota (4,000 / 5,000).', 'warning', 1);
  insertUsageAlert.run(Number(sub1.lastInsertRowid), Number(featApi.lastInsertRowid), period1Id, 90, 'CRITICAL: API Requests at 93% (4,650 / 5,000). Approaching plan ceiling.', 'critical', 0);

  // Cloud Storage: 12 / 10 GB (120% -> 2 GB overage!)
  insertUsage.run(Number(sub1.lastInsertRowid), Number(featStorage.lastInsertRowid), period1Id, 12);
  insertUsageAlert.run(Number(sub1.lastInsertRowid), Number(featStorage.lastInsertRowid), period1Id, 80, 'Storage usage at 8.0 GB of 10 GB.', 'warning', 1);
  insertUsageAlert.run(Number(sub1.lastInsertRowid), Number(featStorage.lastInsertRowid), period1Id, 90, 'Storage usage reached 9.0 GB of 10 GB.', 'critical', 1);
  insertUsageAlert.run(Number(sub1.lastInsertRowid), Number(featStorage.lastInsertRowid), period1Id, 100, 'Storage limit exceeded by 2.0 GB. Overage billing policy active ($4.00/GB).', 'danger', 0);
  // Overage charge: 2 GB * $4.00 = $8.00
  insertUsageCharge.run(Number(sub1.lastInsertRowid), Number(featStorage.lastInsertRowid), period1Id, 2.0, 4.00, 8.00, 'pending', null);

  // Report Exports: 5 / 10 (50%)
  insertUsage.run(Number(sub1.lastInsertRowid), Number(featReports.lastInsertRowid), period1Id, 5);

  // Seed sample usage events for Sub 1 across recent days to power analytics charts
  for (let i = 1; i <= 14; i++) {
    const day = String(i).padStart(2, '0');
    insertUsageEvent.run(`sub1-api-${i}`, Number(sub1.lastInsertRowid), Number(featApi.lastInsertRowid), period1Id, 300 + (i * 15), 'api_call', `/api/v1/sync-${i}`, JSON.stringify({ ip: '192.168.1.1' }), `2026-10-${day} 14:00:00`);
    if (i % 2 === 0) {
      insertUsageEvent.run(`sub1-inv-${i}`, Number(sub1.lastInsertRowid), Number(featInvoices.lastInsertRowid), period1Id, 3, 'invoice_generated', `INV-BATCH-${i}`, null, `2026-10-${day} 10:30:00`);
    }
  }

  // Sub 2 (RetailFlow on Professional Yearly: period 2026-08-15 to 2027-08-15)
  const periodSub2 = insertUsagePeriod.run(Number(sub2.lastInsertRowid), '2026-08-15', '2027-08-15', 'active');
  const period2Id = Number(periodSub2.lastInsertRowid);

  insertUsage.run(Number(sub2.lastInsertRowid), Number(featInvoices.lastInsertRowid), period2Id, 180);
  insertUsage.run(Number(sub2.lastInsertRowid), Number(featStaff.lastInsertRowid), period2Id, 8);
  insertUsage.run(Number(sub2.lastInsertRowid), Number(featApi.lastInsertRowid), period2Id, 38000);
  insertUsage.run(Number(sub2.lastInsertRowid), Number(featStorage.lastInsertRowid), period2Id, 65);
  insertUsage.run(Number(sub2.lastInsertRowid), Number(featReports.lastInsertRowid), period2Id, 42);
  insertUsage.run(Number(sub2.lastInsertRowid), Number(featPriority.lastInsertRowid), period2Id, 1);
  insertUsage.run(Number(sub2.lastInsertRowid), Number(featBranding.lastInsertRowid), period2Id, 1);
  insertUsage.run(Number(sub2.lastInsertRowid), Number(featErp.lastInsertRowid), period2Id, 1950);

  insertUsageAlert.run(Number(sub2.lastInsertRowid), Number(featApi.lastInsertRowid), period2Id, 50, 'API consumption crossed 50% (25,000 / 50,000).', 'info', 1);
  insertUsageAlert.run(Number(sub2.lastInsertRowid), Number(featErp.lastInsertRowid), period2Id, 50, 'ERP Real-time Sync crossed 50% of annual allowance.', 'info', 1);

  console.log('Default Brightloop seed data initialized successfully.');
}

// Function to generate benchmark stress data (1,000+ subscriptions)
export function generateBenchmarkData(count = 1000) {
  initDatabase();
  console.log(`Generating ${count} benchmark subscriptions and related data...`);

  const startTime = Date.now();
  db.exec('BEGIN TRANSACTION;');

  try {
    const plans = db.prepare('SELECT id, billing_period FROM plans').all();
    const products = db.prepare('SELECT id, sales_price FROM products').all();
    const customers = db.prepare('SELECT id FROM customers').all();
    const taxes = db.prepare('SELECT id, rate FROM tax_rules').all();

    const insertSub = db.prepare(`
      INSERT INTO subscriptions (number, customer_id, plan_id, start_date, expiry_date, payment_terms, status, next_billing_date, auto_close, closable, pausable, renewable, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertLine = db.prepare(`
      INSERT INTO subscription_lines (subscription_id, product_id, variant_id, quantity, unit_price, tax_id, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const statuses = ['active', 'active', 'active', 'confirmed', 'quotation', 'draft', 'paused', 'closed'];
    const terms = ['Immediate', 'Net 15', 'Net 30', 'Net 60'];

    const baseCount = db.prepare('SELECT COUNT(*) as count FROM subscriptions').get().count;

    for (let i = 1; i <= count; i++) {
      const subNum = `SUB-BENCH-${String(baseCount + i).padStart(5, '0')}`;
      const cust = customers[(i % customers.length)];
      const plan = plans[(i % plans.length)];
      const status = statuses[(i % statuses.length)];
      const term = terms[(i % terms.length)];

      const nextBill = status === 'active' ? '2026-10-31' : '2026-11-15';

      const res = insertSub.run(
        subNum,
        cust.id,
        plan.id,
        '2026-01-01',
        '2027-01-01',
        term,
        status,
        nextBill,
        0, 1, 1, 1,
        'Benchmark load test subscription'
      );

      const subId = Number(res.lastInsertRowid);
      const prod = products[(i % products.length)];
      const tax = taxes[(i % taxes.length)];
      const qty = (i % 5) + 1;
      const amt = qty * prod.sales_price;

      insertLine.run(subId, prod.id, null, qty, prod.sales_price, tax.id, amt);
    }

    db.exec('COMMIT;');
    const elapsed = Date.now() - startTime;
    console.log(`Successfully generated ${count} subscriptions in ${elapsed}ms!`);
    return { success: true, count, elapsedMs: elapsed };
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Benchmark generation failed:', err);
    throw err;
  }
}

if (process.argv[1]?.endsWith('seed.js')) {
  seedData();
}
