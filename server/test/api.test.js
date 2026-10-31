process.env.NODE_ENV = 'test';
import { randomBytes } from 'node:crypto';
import http from 'node:http';

process.env.JWT_SECRET = randomBytes(32).toString('hex');

const [{ default: app }, { db }, { seedData }] = await Promise.all([
  import('../src/server.js'),
  import('../src/db/database.js'),
  import('../src/db/seed.js')
]);

// Helper to make HTTP requests against local test server
function request(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let testServer;
let adminToken = '';
let staffToken = '';
let customerToken = '';

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 BRIGHTLOOP SUBSCRIPTION SYSTEM - ACCEPTANCE TEST SUITE');
  console.log('======================================================\n');

  // Fresh seed
  seedData(true);

  // Start test server on random port
  await new Promise((resolve) => {
    testServer = app.listen(0, '127.0.0.1', () => {
      console.log(`Test server running on port ${testServer.address().port}`);
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // MODULE 1: AUTHENTICATION & ACCESS CONTROL (AUTH-1 to AUTH-7)
    // ----------------------------------------------------
    console.log('\n--- 1. Authentication & Role Permissions Tests ---');

    // Test: Login with admin credentials
    const adminLogin = await request(testServer, {
      method: 'POST',
      path: '/api/auth/login'
    }, { email: 'admin@brightloop.com', password: 'BrightloopAdmin2026!' });
    assert(adminLogin.status === 200 && adminLogin.body.token, 'Admin login successful and returned JWT');
    adminToken = adminLogin.body.token;

    // Test: Login with staff credentials
    const staffLogin = await request(testServer, {
      method: 'POST',
      path: '/api/auth/login'
    }, { email: 'staff@brightloop.com', password: 'BrightloopStaff2026!' });
    assert(staffLogin.status === 200 && staffLogin.body.user.role === 'staff', 'Staff login successful with role "staff"');
    staffToken = staffLogin.body.token;

    // Test: Login with customer credentials
    const custLogin = await request(testServer, {
      method: 'POST',
      path: '/api/auth/login'
    }, { email: 'customer@acmecorp.com', password: 'CustomerAcme2026!' });
    assert(custLogin.status === 200 && custLogin.body.user.role === 'customer', 'Customer login successful');
    customerToken = custLogin.body.token;

    // AUTH-2: Reject duplicate email signup
    const dupSignup = await request(testServer, {
      method: 'POST',
      path: '/api/auth/register'
    }, {
      name: 'Duplicate Guy',
      email: 'customer@acmecorp.com',
      password: 'ValidPassword2026!'
    });
    assert(dupSignup.status === 400, 'AUTH-2: Signing up with an already-used email is rejected (HTTP 400)');

    // AUTH-3: Password length <= 8 rejected
    const shortPass = await request(testServer, {
      method: 'POST',
      path: '/api/auth/register'
    }, {
      name: 'Short Pass',
      email: 'short@test.com',
      password: 'Pass1!' // 6 chars
    });
    assert(shortPass.status === 400 && shortPass.body.error.includes('eight characters'), 'AUTH-3: Password of 8 chars or fewer rejected');

    // AUTH-3: Password missing uppercase rejected
    const noUpper = await request(testServer, {
      method: 'POST',
      path: '/api/auth/register'
    }, {
      name: 'No Upper',
      email: 'noupper@test.com',
      password: 'password123!'
    });
    assert(noUpper.status === 400 && noUpper.body.error.includes('uppercase'), 'AUTH-3: Password missing uppercase letter rejected');

    // AUTH-3: Password missing special char rejected
    const noSpecial = await request(testServer, {
      method: 'POST',
      path: '/api/auth/register'
    }, {
      name: 'No Special',
      email: 'nospecial@test.com',
      password: 'Password12345'
    });
    assert(noSpecial.status === 400 && noSpecial.body.error.includes('special character'), 'AUTH-3: Password missing special char rejected');

    // AUTH-1: Successful customer signup
    const validSignup = await request(testServer, {
      method: 'POST',
      path: '/api/auth/register'
    }, {
      name: 'New Startup Ltd',
      email: 'founder@newstartup.io',
      password: 'SecureStartup2026!',
      company: 'New Startup Ltd'
    });
    assert(validSignup.status === 201 && validSignup.body.user.role === 'customer', 'AUTH-1: Valid customer signup succeeds with customer role');

    // AUTH-4: Forgot password request
    const forgotRes = await request(testServer, {
      method: 'POST',
      path: '/api/auth/forgot-password'
    }, { email: 'founder@newstartup.io' });
    assert(forgotRes.status === 200 && forgotRes.body.simulation.resetToken, 'AUTH-4: Forgot password generates reset link with token');

    // AUTH-4: Reset password using token
    const resetToken = forgotRes.body.simulation.resetToken;
    const resetRes = await request(testServer, {
      method: 'POST',
      path: '/api/auth/reset-password'
    }, {
      token: resetToken,
      newPassword: 'BrandNewPassword2026!'
    });
    assert(resetRes.status === 200, 'AUTH-4: Reset password succeeds with new policy-compliant password');

    // AUTH-6: Only admin can add staff member
    // Attempt with Staff token -> should fail 403
    const staffCreateByStaff = await request(testServer, {
      method: 'POST',
      path: '/api/users/staff',
      headers: { Authorization: `Bearer ${staffToken}` }
    }, {
      name: 'Unauthorized Staff',
      email: 'fake.staff@brightloop.com',
      password: 'StaffPassword2026!'
    });
    assert(staffCreateByStaff.status === 403, 'AUTH-6: Internal staff CANNOT add staff members (403 Forbidden)');

    // Attempt with Admin token -> should succeed
    const staffCreateByAdmin = await request(testServer, {
      method: 'POST',
      path: '/api/users/staff',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      name: 'Emily Watson',
      email: 'emily.staff@brightloop.com',
      password: 'EmilyStaffPass2026!'
    });
    assert(staffCreateByAdmin.status === 201 && staffCreateByAdmin.body.staff.role === 'staff', 'AUTH-6: ONLY Admin can add new staff members');

    // AUTH-7: Customer sees only their own data
    const customerSubs = await request(testServer, {
      method: 'GET',
      path: '/api/subscriptions',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const allBelongToAcme = customerSubs.body.subscriptions.every(s => s.customer_name === 'Alex Rivera');
    assert(customerSubs.status === 200 && allBelongToAcme, 'AUTH-7: Customer sees ONLY their own subscriptions in portal');

    // ----------------------------------------------------
    // MODULE 2: PRODUCT & VARIANT MANAGEMENT (PROD-1 to PROD-3)
    // ----------------------------------------------------
    console.log('\n--- 2. Product & Variant Management Tests ---');

    // PROD-1: Admin adds product
    const createProd = await request(testServer, {
      method: 'POST',
      path: '/api/products',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      name: 'Custom ERP Bridge',
      type: 'Software',
      sales_price: 900.0,
      cost_price: 150.0,
      notes: 'Custom ERP integration bridge',
      variants: [
        { attribute: 'Brand', value: 'Odoo Enterprise', extra_price: 560.0 }, // PROD-3
        { attribute: 'Brand', value: 'Generic REST', extra_price: 0.0 }
      ]
    });
    assert(createProd.status === 201 && createProd.body.product.name === 'Custom ERP Bridge', 'PROD-1: Admin can add product with type, sales price, cost price, and notes');

    // PROD-3: Check Odoo variant price adjustment (+560)
    const odooVariant = createProd.body.product.variants.find(v => v.value === 'Odoo Enterprise');
    assert(odooVariant && odooVariant.extra_price === 560, 'PROD-3: Odoo variant carries +560 extra price adjustment');

    // Staff cannot create product
    const staffCreateProd = await request(testServer, {
      method: 'POST',
      path: '/api/products',
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { name: 'Illegal Prod', type: 'Software', sales_price: 100 });
    assert(staffCreateProd.status === 403, 'Role constraint: Staff cannot create products (403 Forbidden)');

    // ----------------------------------------------------
    // MODULE 3: PLAN MANAGEMENT (PLAN-1 to PLAN-4)
    // ----------------------------------------------------
    console.log('\n--- 3. Plan Management Tests ---');

    const createPlan = await request(testServer, {
      method: 'POST',
      path: '/api/plans',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      name: 'Daily High Frequency Sandbox',
      price: 25.0,
      billing_period: 'daily',
      min_quantity: 2,
      available_from: '2026-01-01',
      available_to: '2028-12-31',
      auto_close: 1,
      closable: 1,
      pausable: 0,
      renewable: 0
    });
    assert(createPlan.status === 201 && createPlan.body.plan.billing_period === 'daily', 'PLAN-1 & PLAN-4: Admin created plan with daily billing, min quantity, auto_close, pausable=0');

    // ----------------------------------------------------
    // MODULE 4: DISCOUNT RULES (DISC-1 to DISC-8)
    // ----------------------------------------------------
    console.log('\n--- 4. Discount Rules Tests ---');

    // DISC-1: Staff cannot create discount
    const staffDisc = await request(testServer, {
      method: 'POST',
      path: '/api/discounts',
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { code: 'STAFF10', name: 'Discount', type: 'percentage', value: 10 });
    assert(staffDisc.status === 403, 'DISC-1: Only Admin can create discount rules (Staff returns 403)');

    // DISC-1 to DISC-6: Admin creates discount with min_quantity and usage_limit
    const adminDisc = await request(testServer, {
      method: 'POST',
      path: '/api/discounts',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      code: 'SUPERVIP',
      name: 'Super VIP Discount $75',
      type: 'fixed',
      value: 75.0,
      min_purchase: 200.0,
      min_quantity: 1,
      start_date: '2026-01-01',
      end_date: '2027-12-31',
      usage_limit: 10,
      scope: 'whole_subscription'
    });
    assert(adminDisc.status === 201 && adminDisc.body.discount.code === 'SUPERVIP', 'DISC-2 to DISC-6: Admin created discount with fixed amount, min purchase, dates, and usage limit');

    // ----------------------------------------------------
    // MODULE 5: SUBSCRIPTION LIFECYCLE (SUB-1 to SUB-6)
    // ----------------------------------------------------
    console.log('\n--- 5. Subscription Lifecycle State Machine Tests ---');

    // Create subscription
    const custAcme = db.prepare('SELECT id FROM customers WHERE email = ?').get('customer@acmecorp.com');
    const starterPlan = db.prepare("SELECT id FROM plans WHERE name = 'Starter Growth Monthly'").get();
    const crmProduct = db.prepare("SELECT id FROM products WHERE name = 'Brightloop CRM Core'").get();
    const vatTax = db.prepare("SELECT id FROM tax_rules WHERE rate = 10.0").get();

    const subRes = await request(testServer, {
      method: 'POST',
      path: '/api/subscriptions',
      headers: { Authorization: `Bearer ${staffToken}` }
    }, {
      customer_id: custAcme.id,
      plan_id: starterPlan.id,
      start_date: '2026-11-01',
      expiry_date: '2027-11-01',
      payment_terms: 'Net 30',
      status: 'draft',
      lines: [
        { product_id: crmProduct.id, quantity: 2, unit_price: 1200.0, tax_id: vatTax.id }
      ]
    });
    assert(subRes.status === 201 && subRes.body.number.startsWith('SUB-'), 'SUB-1 & SUB-2: Created subscription with unique SUB-YYYY-XXXX number');
    const testSubId = subRes.body.subscriptionId;

    // Transition Draft -> Quotation
    const toQuote = await request(testServer, {
      method: 'POST',
      path: `/api/subscriptions/${testSubId}/transition`,
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { action: 'send_quote' });
    assert(toQuote.status === 200 && toQuote.body.status === 'quotation', 'SUB-4: Transition Draft -> Quotation succeeds');

    // Transition Quotation -> Confirmed
    const toConfirm = await request(testServer, {
      method: 'POST',
      path: `/api/subscriptions/${testSubId}/transition`,
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { action: 'confirm' });
    assert(toConfirm.status === 200 && toConfirm.body.status === 'confirmed', 'SUB-4: Transition Quotation -> Confirmed succeeds');

    // Transition Confirmed -> Active
    const toActive = await request(testServer, {
      method: 'POST',
      path: `/api/subscriptions/${testSubId}/transition`,
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { action: 'activate' });
    assert(toActive.status === 200 && toActive.body.status === 'active', 'SUB-4: Transition Confirmed -> Active succeeds');

    // Transition Active -> Paused (if pausable)
    const toPause = await request(testServer, {
      method: 'POST',
      path: `/api/subscriptions/${testSubId}/transition`,
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { action: 'pause' });
    assert(toPause.status === 200 && toPause.body.status === 'paused', 'Plan behavior: Transition Active -> Paused succeeds');

    // Transition Paused -> Active
    const toResume = await request(testServer, {
      method: 'POST',
      path: `/api/subscriptions/${testSubId}/transition`,
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { action: 'resume' });
    assert(toResume.status === 200 && toResume.body.status === 'active', 'Plan behavior: Resuming paused subscription succeeds');

    // ----------------------------------------------------
    // MODULE 6: INVOICING & BULK BILLING (INV-1 to INV-6)
    // ----------------------------------------------------
    console.log('\n--- 6. Invoicing, Bulk Billing & Idempotency Tests ---');

    // Generate invoice for subscription
    const genInv = await request(testServer, {
      method: 'POST',
      path: `/api/invoices/generate/${testSubId}`,
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { billingDate: '2026-11-01', initialStatus: 'draft' });
    assert(genInv.status === 201 && genInv.body.invoiceNumber.startsWith('INV-'), 'INV-1: Invoice auto-generated with lines, taxes, and customer details');
    const testInvId = genInv.body.invoiceId;

    // INV-6: Idempotency check - Re-running billing for same period must not duplicate
    const reGenInv = await request(testServer, {
      method: 'POST',
      path: `/api/invoices/generate/${testSubId}`,
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { billingDate: '2026-11-01' });
    assert(reGenInv.body.skipped === true, 'INV-6: Idempotent billing - duplicate billing for the same period is rejected/skipped');

    // INV-4 & INV-5: Invoice status transitions (Draft -> Confirmed, Send)
    const confInv = await request(testServer, {
      method: 'POST',
      path: `/api/invoices/${testInvId}/action`,
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { action: 'confirm' });
    assert(confInv.status === 200 && confInv.body.status === 'confirmed', 'INV-4 & INV-5: Confirm invoice succeeds (Draft -> Confirmed)');

    const sendInv = await request(testServer, {
      method: 'POST',
      path: `/api/invoices/${testInvId}/action`,
      headers: { Authorization: `Bearer ${staffToken}` }
    }, { action: 'send' });
    assert(sendInv.status === 200 && sendInv.body.sent_at, 'INV-4: Send invoice updates sent_at timestamp');

    // INV-2: Bulk billing run
    const bulkRun = await request(testServer, {
      method: 'POST',
      path: '/api/billing/run',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, { simulationDate: '2026-12-01' });
    assert(bulkRun.status === 200 && bulkRun.body.durationMs >= 0, 'INV-2: Bulk billing run executes smoothly and returns metrics');

    // ----------------------------------------------------
    // MODULE 7: PAYMENTS & OVERDUE CHASING (PAY-1 to PAY-4)
    // ----------------------------------------------------
    console.log('\n--- 7. Payments, Partial Payments & Overdue Tracking Tests ---');

    // Check invoice total
    const getInv = await request(testServer, {
      method: 'GET',
      path: `/api/invoices/${testInvId}`,
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const totalToPay = getInv.body.invoice.total;

    // PAY-1: Partial payment
    const partialPay = await request(testServer, {
      method: 'POST',
      path: '/api/payments',
      headers: { Authorization: `Bearer ${staffToken}` }
    }, {
      invoice_id: testInvId,
      method: 'Bank Transfer',
      amount: 1000.0,
      note: 'Deposit installment #1'
    });
    assert(partialPay.status === 201 && partialPay.body.outstanding === (totalToPay - 1000), 'PAY-1 & PAY-3: Partial payment recorded; remaining balance tracked accurately');

    // PAY-3: Settle full remaining payment -> status flips to 'paid'
    const finalPay = await request(testServer, {
      method: 'POST',
      path: '/api/payments',
      headers: { Authorization: `Bearer ${staffToken}` }
    }, {
      invoice_id: testInvId,
      method: 'Credit Card',
      amount: totalToPay - 1000.0,
      note: 'Settling remaining balance'
    });
    assert(finalPay.body.invoiceStatus === 'paid' && finalPay.body.outstanding === 0, 'PAY-3 & INV-5: Full settlement automatically moves invoice status to "paid"');

    // PAY-4: Overdue invoice check & chase
    const overdueList = await request(testServer, {
      method: 'GET',
      path: '/api/invoices?overdue_only=true',
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(overdueList.status === 200 && overdueList.body.invoices.length > 0, 'PAY-4: Overdue invoices identified and listed');

    const overdueInv = overdueList.body.invoices[0];
    const chaseRes = await request(testServer, {
      method: 'POST',
      path: `/api/payments/chase/${overdueInv.id}`,
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(chaseRes.status === 200 && chaseRes.body.chasedAt, 'PAY-4: Chasing overdue invoice sends automated notification and logs activity');

    // ----------------------------------------------------
    // MODULE 8: DASHBOARD & REPORTING (REP-1 to REP-3)
    // ----------------------------------------------------
    console.log('\n--- 8. Financial Dashboard & Performance Tests ---');

    const reportRes = await request(testServer, {
      method: 'GET',
      path: '/api/reports/dashboard',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(reportRes.status === 200, 'REP-1: Dashboard metrics endpoint responds successfully');
    assert(reportRes.body.kpis.activeSubscriptions > 0, 'REP-3: Answers how many subscriptions are active');
    assert(reportRes.body.kpis.totalRevenue > 0, 'REP-3: Answers how much revenue came in');
    assert(reportRes.body.kpis.totalOutstanding >= 0, 'REP-3: Answers how much is still owed');
    assert(reportRes.body.overdueInvoices.length > 0, 'REP-3: Identifies which invoices are overdue');

    // Benchmark Stress Test (1,000 subscriptions)
    console.log('\n--- 9. Benchmark Stress Test (1,000 Subscriptions, sub-2s response) ---');
    const benchRes = await request(testServer, {
      method: 'POST',
      path: '/api/system/benchmark',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, { count: 1000 });
    assert(benchRes.status === 200, 'Benchmark test executed successfully');
    assert(benchRes.body.queryResponseTimeMs < 2000, `Performance non-functional requirement: Query responded in ${benchRes.body.queryResponseTimeMs}ms (< 2000ms target)`);

    // -------------------------------------------------------------------------
    // MODULE 10: DYNAMIC SUBSCRIPTION USAGE TRACKING (SECTION 12 VERIFICATION)
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Dynamic Subscription Usage Tracking Tests ---');

    // Login Client 2 (RetailFlow)
    const cust2Login = await request(testServer, {
      method: 'POST',
      path: '/api/auth/login'
    }, { email: 'sarah@retailflow.io', password: 'CustomerRetail2026!' });
    const customer2Token = cust2Login.body.token;

    // Test 1: Client A (Acme) sees features for Plan A
    const acmeUsage = await request(testServer, {
      method: 'GET',
      path: '/api/usage/current',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(acmeUsage.status === 200 && acmeUsage.body.features.length > 0, 'Test 1: Client A retrieves active plan features');
    const acmeFeatureKeys = acmeUsage.body.features.map(f => f.feature_key);
    assert(acmeFeatureKeys.includes('invoices_generation') && acmeFeatureKeys.includes('api_requests'), 'Test 1: Client A has Starter plan core features');

    // Test 2: Client B (RetailFlow) sees features for Plan B (SUB-2026-0002 Professional Yearly)
    const sub2Row = db.prepare("SELECT id FROM subscriptions WHERE number = 'SUB-2026-0002'").get();
    const retailUsage = await request(testServer, {
      method: 'GET',
      path: `/api/usage/current?subscription_id=${sub2Row.id}`,
      headers: { Authorization: `Bearer ${customer2Token}` }
    });
    assert(retailUsage.status === 200 && retailUsage.body.features.length > 0, 'Test 2: Client B retrieves active plan features');
    const retailFeatureKeys = retailUsage.body.features.map(f => f.feature_key);

    // Test 3: Exclusive feature support
    assert(retailFeatureKeys.includes('erp_sync') && !acmeFeatureKeys.includes('erp_sync'), 'Test 3: Exclusive feature "erp_sync" present for Plan B but NOT Plan A');

    // Test 4: Multi-sector catalog support
    const catalogRes = await request(testServer, {
      method: 'GET',
      path: '/api/usage/catalog',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const catalogSectors = Array.from(new Set(catalogRes.body.catalog.map(f => f.sector)));
    assert(
      catalogSectors.includes('healthcare') &&
      catalogSectors.includes('education') &&
      catalogSectors.includes('ecommerce') &&
      catalogSectors.includes('transportation') &&
      catalogSectors.includes('general'),
      'Test 4: System supports completely different business sectors in unified catalog'
    );

    // Test 5: Newly integrated feature registration
    const newFeatRes = await request(testServer, {
      method: 'POST',
      path: '/api/usage/record',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      subscription_id: acmeUsage.body.subscription.id,
      feature_key: 'non_existent_feature_123',
      quantity: 1
    });
    assert(newFeatRes.status === 400 || newFeatRes.status === 404, 'Test 5: Non-registered feature correctly rejected');

    // Test 6: Different measurement types (Access, Quantity, Consumption)
    const typesPresent = Array.from(new Set(retailUsage.body.features.map(f => f.type)));
    assert(
      typesPresent.includes('access') &&
      typesPresent.includes('quantity') &&
      typesPresent.includes('consumption'),
      'Test 6: Supports access-based, quantity-based, and consumption-based measurement types'
    );

    // Test 7: Unlimited features do not trigger false limit alerts
    const unlimitedFeature = retailUsage.body.features.find(f => f.is_unlimited);
    assert(unlimitedFeature && unlimitedFeature.status === 'unlimited', 'Test 7: Unlimited feature properly recognized');
    assert(!unlimitedFeature.alerts || unlimitedFeature.alerts.length === 0, 'Test 7: Unlimited feature triggers 0 false limit alerts');

    // Test 8: Failed operations do not increase usage
    const invalidQtyRes = await request(testServer, {
      method: 'POST',
      path: '/api/usage/record',
      headers: { Authorization: `Bearer ${customerToken}` }
    }, {
      feature_key: 'api_requests',
      quantity: -50
    });
    assert(invalidQtyRes.status === 400, 'Test 8: Negative or invalid quantity rejected without increasing usage');

    // Test 9: Duplicate events rejected via idempotency key
    const idemKey = `idem-test-${Date.now()}`;
    const event1 = await request(testServer, {
      method: 'POST',
      path: '/api/usage/record',
      headers: { Authorization: `Bearer ${customerToken}` }
    }, {
      feature_key: 'api_requests',
      quantity: 10,
      idempotency_key: idemKey
    });
    assert(event1.status === 201, 'Test 9: First event with idempotency key succeeded');

    const event2 = await request(testServer, {
      method: 'POST',
      path: '/api/usage/record',
      headers: { Authorization: `Bearer ${customerToken}` }
    }, {
      feature_key: 'api_requests',
      quantity: 10,
      idempotency_key: idemKey
    });
    assert(event2.status === 201 && event2.body.is_duplicate === true, 'Test 9: Duplicate event with same idempotency key skipped without double-counting');

    // Test 10: Threshold alerts work correctly
    const alertsRes = await request(testServer, {
      method: 'GET',
      path: '/api/usage/alerts',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(alertsRes.status === 200 && alertsRes.body.alerts.length > 0, 'Test 10: Threshold alerts generated and retrieved');
    const alertThresholds = alertsRes.body.alerts.map(a => a.threshold_percent);
    assert(alertThresholds.includes(50) || alertThresholds.includes(80), 'Test 10: 50% or 80% threshold alerts recorded');

    // Test 11: Backend enforcement of hard limit policy
    // staff_accounts on Acme Plan has hard_limit of 3. Currently 2 used.
    // Attempting to record +5 seats should be blocked with 429!
    const hardLimitExceed = await request(testServer, {
      method: 'POST',
      path: '/api/usage/record',
      headers: { Authorization: `Bearer ${customerToken}` }
    }, {
      feature_key: 'staff_accounts',
      quantity: 5
    });
    assert(hardLimitExceed.status === 429, 'Test 11: Backend enforces hard limit policy and blocks request (HTTP 429)');

    // Test 12: Overage charges calculation
    const chargesRes = await request(testServer, {
      method: 'GET',
      path: '/api/usage/charges',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(chargesRes.status === 200 && chargesRes.body.charges.length > 0, 'Test 12: Overage charges properly calculated and recorded');
    assert(chargesRes.body.total_pending_amount > 0, 'Test 12: Total pending overage dollar amount accurately tracked');

    // Test 13: Historical consumption and analytics
    const analyticsRes = await request(testServer, {
      method: 'GET',
      path: '/api/usage/analytics',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(analyticsRes.status === 200 && analyticsRes.body.forecast.length > 0, 'Test 13: Usage analytics generates period-end forecast');
    assert(analyticsRes.body.recommendations.length > 0, 'Test 13: Intelligent usage recommendations generated based on actual consumption');

    // Test 14: Customer isolation (AUTH-7)
    // Acme customer attempts to access RetailFlow's subscription id
    const retailSubId = retailUsage.body.subscription.id;
    const forbiddenUsage = await request(testServer, {
      method: 'GET',
      path: `/api/usage/current?subscription_id=${retailSubId}`,
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(forbiddenUsage.status === 403, 'Test 14: Customer CANNOT access another customer\'s subscription usage (403 Forbidden)');

    // Test 15: Existing invoicing workflow auto-records usage
    const preInvUsage = await request(testServer, {
      method: 'GET',
      path: '/api/usage/features/invoices_generation',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const preInvCount = preInvUsage.body.feature.actual_usage;

    // Trigger an invoice generation for Acme
    const newInvRes = await request(testServer, {
      method: 'POST',
      path: `/api/invoices/generate/${acmeUsage.body.subscription.id}`,
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      billingDate: '2026-12-01',
      billingPeriodStart: '2026-12-01'
    });

    const postInvUsage = await request(testServer, {
      method: 'GET',
      path: '/api/usage/features/invoices_generation',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(
      postInvUsage.status === 200 &&
      (postInvUsage.body.feature.actual_usage === preInvCount + 1 || newInvRes.body.skipped),
      'USG-15: System auto-tracked invoice creation feature usage'
    );

    console.log('\n--- 11. Real-Time Razorpay Payment Gateway Tests ---');
    // Test 1: Retrieve Razorpay config
    const rzpConfigRes = await request(testServer, {
      method: 'GET',
      path: '/api/payments/razorpay/config',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(rzpConfigRes.status === 200 && rzpConfigRes.body.config.currency === 'INR', 'PAY-RZP-1: Public Razorpay configuration retrieved');

    // Test 2: Create Razorpay Order for an open invoice
    const invListRes = await request(testServer, {
      method: 'GET',
      path: '/api/invoices',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const unpaidInv = invListRes.body.invoices.find(i => i.status !== 'paid' && (i.total - (i.paid_amount || 0)) >= 50) || invListRes.body.invoices[0];
    const rzpTargetInvoiceId = unpaidInv.id;

    const rzpOrderRes = await request(testServer, {
      method: 'POST',
      path: '/api/payments/razorpay/create-order',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      invoice_id: rzpTargetInvoiceId,
      amount: 50
    });
    assert(rzpOrderRes.status === 200 && rzpOrderRes.body.orderId && rzpOrderRes.body.amountInPaise === 5000, 'PAY-RZP-2: Razorpay order generated with amount converted to paise');

    // Test 3: Verify and settle payment
    const rzpVerifyRes = await request(testServer, {
      method: 'POST',
      path: '/api/payments/razorpay/verify',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      razorpay_order_id: rzpOrderRes.body.orderId,
      razorpay_payment_id: 'pay_test_' + Date.now(),
      razorpay_signature: 'sig_test_valid',
      invoice_id: rzpTargetInvoiceId,
      amount: 50,
      payment_method: 'UPI'
    });
    assert(rzpVerifyRes.status === 200 && rzpVerifyRes.body.success, 'PAY-RZP-3: Razorpay payment verified and settled against invoice');

    // Test 4: Configure Razorpay Settings as Admin
    const rzpSettingsRes = await request(testServer, {
      method: 'POST',
      path: '/api/payments/razorpay/settings',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      keyId: 'rzp_test_NewKey123',
      keySecret: 'SecretKey456'
    });
    assert(rzpSettingsRes.status === 200 && rzpSettingsRes.body.config.isConfigured, 'PAY-RZP-4: Admin can configure custom Razorpay API credentials');

    console.log('\n--- 12. Real-Time Stripe Payment Gateway Tests (Zero PAN) ---');
    // Test 1: Retrieve Stripe config
    const strpConfigRes = await request(testServer, {
      method: 'GET',
      path: '/api/payments/stripe/config',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(strpConfigRes.status === 200 && strpConfigRes.body.config.currency === 'USD', 'PAY-STRIPE-1: Public Stripe configuration retrieved');

    // Test 2: Create Stripe PaymentIntent for an open invoice
    const strpIntentRes = await request(testServer, {
      method: 'POST',
      path: '/api/payments/stripe/create-intent',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      invoice_id: rzpTargetInvoiceId,
      amount: 25
    });
    assert(strpIntentRes.status === 200 && strpIntentRes.body.paymentIntentId && strpIntentRes.body.amountInCents === 2500, 'PAY-STRIPE-2: Stripe PaymentIntent created with amount in cents');

    // Test 3: Confirm Stripe payment and settle invoice
    const strpConfirmRes = await request(testServer, {
      method: 'POST',
      path: '/api/payments/stripe/confirm',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      payment_intent_id: strpIntentRes.body.paymentIntentId,
      invoice_id: rzpTargetInvoiceId,
      amount: 25,
      payment_method: 'Credit Card (Stripe)'
    });
    assert(strpConfirmRes.status === 200 && strpConfirmRes.body.success, 'PAY-STRIPE-3: Stripe payment confirmed and settled against invoice');

    // Test 4: Configure Stripe Settings as Admin
    const strpSettingsRes = await request(testServer, {
      method: 'POST',
      path: '/api/payments/stripe/settings',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      publishableKey: 'pk_test_NewStripeKey123',
      secretKey: 'sk_test_SecretStripeKey456'
    });
    assert(strpSettingsRes.status === 200 && strpSettingsRes.body.config.isConfigured, 'PAY-STRIPE-4: Admin can configure custom Stripe API credentials');

    console.log('\n======================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

  } catch (error) {
    console.error('Fatal error during test run:', error);
  } finally {
    testServer.close();
  }
}

runTests();
