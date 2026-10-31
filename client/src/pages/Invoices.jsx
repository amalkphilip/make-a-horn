import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { ChaseReminderModal } from '../components/ChaseReminderModal';
import { NotifyCustomerModal } from '../components/NotifyCustomerModal';
import { RazorpayModal } from '../components/RazorpayModal';
import { StripeModal } from '../components/StripeModal';
import {
  FileText,
  Search,
  Zap,
  Printer,
  CreditCard,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Mail,
  Bell,
  RefreshCw
} from 'lucide-react';

export function Invoices({ onOpenBillingRun }) {
  const { authFetch, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bulkReminding, setBulkReminding] = useState(false);

  const statusFilter = searchParams.get('status') || '';
  const overdueOnly = searchParams.get('overdue_only') === 'true';
  const [search, setSearch] = useState('');

  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [razorpayInvoice, setRazorpayInvoice] = useState(null);
  const [stripeInvoice, setStripeInvoice] = useState(null);
  const [chaseInvoice, setChaseInvoice] = useState(null);
  const [notifyInvoice, setNotifyInvoice] = useState(null);
  const [notifyType, setNotifyType] = useState('invoice_due');

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (overdueOnly) params.append('overdue_only', 'true');
      if (search) params.append('search', search);

      const data = await authFetch(`/api/invoices?${params.toString()}`);
      setInvoices(data.invoices || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [statusFilter, overdueOnly, search]);

  const handleAction = async (invoiceId, action) => {
    try {
      await authFetch(`/api/invoices/${invoiceId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      loadInvoices();
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  const handleTabClick = (status, isOverdue = false) => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (isOverdue) next.set('overdue_only', 'true');
    setSearchParams(next);
  };

  const handleBulkRemind = async () => {
    if (!window.confirm('Send automated payment reminder notifications (Email) to all customers with due or overdue invoices?')) return;
    try {
      setBulkReminding(true);
      const res = await authFetch('/api/notifications/remind-all-due', { method: 'POST' });
      alert(res.message);
      loadInvoices();
    } catch (err) {
      alert(err.message || 'Failed to dispatch bulk reminders.');
    } finally {
      setBulkReminding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            <span>Invoices & Billing</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-generated recurring invoices, payment reconciliation, and collection status.
          </p>
        </div>

        {user?.role !== 'customer' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkRemind}
              disabled={bulkReminding}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              title="Automatically dispatch Email reminders to all customers with unpaid invoices"
            >
              {bulkReminding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              <span>{bulkReminding ? 'Dispatching...' : 'Bulk Remind Due'}</span>
            </button>

            <button
              onClick={onOpenBillingRun}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Run Bulk Billing</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => handleTabClick('')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            !statusFilter && !overdueOnly
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          All Invoices
        </button>
        <button
          onClick={() => handleTabClick('', true)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            overdueOnly
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Overdue</span>
        </button>
        <button
          onClick={() => handleTabClick('confirmed')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            statusFilter === 'confirmed' && !overdueOnly
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Confirmed / Unpaid
        </button>
        <button
          onClick={() => handleTabClick('draft')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            statusFilter === 'draft'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Drafts
        </button>
        <button
          onClick={() => handleTabClick('paid')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            statusFilter === 'paid'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Paid in Full
        </button>
        <button
          onClick={() => handleTabClick('cancelled')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            statusFilter === 'cancelled'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Cancelled
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by INV #, customer, sub #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50/50"
          />
        </div>
        <p className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{invoices.length}</span> of {total} invoices
        </p>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No invoices found</p>
            <p className="text-xs text-slate-400">No records match the current filter selection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-400 uppercase font-bold tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Sub Ref</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-mono font-bold text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        {inv.number}
                      </Link>
                      {inv.sent_at && (
                        <p className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5 font-medium">
                          <CheckCircle className="w-3 h-3" /> Sent
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{inv.customer_name}</p>
                      {inv.customer_company && (
                        <p className="text-[11px] text-slate-500">{inv.customer_company}</p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      <Link to={`/subscriptions/${inv.subscription_id}`} className="hover:underline">
                        {inv.subscription_number}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      {inv.billing_period_start} to {inv.billing_period_end}
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span className={inv.is_overdue ? 'font-bold text-rose-600' : 'text-slate-700'}>
                        {inv.due_date}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ${Number(inv.total).toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      <span className={inv.outstanding > 0 ? (inv.is_overdue ? 'text-rose-600' : 'text-slate-900') : 'text-emerald-600'}>
                        ${Number(inv.outstanding).toFixed(2)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={inv.status} isOverdue={inv.is_overdue} />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Confirm Draft */}
                        {inv.status === 'draft' && user?.role !== 'customer' && (
                          <button
                            onClick={() => handleAction(inv.id, 'confirm')}
                            className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold"
                            title="Confirm Invoice"
                          >
                            Confirm
                          </button>
                        )}

                        {/* Send Invoice */}
                        {inv.status !== 'cancelled' && !inv.sent_at && user?.role !== 'customer' && (
                          <button
                            onClick={() => handleAction(inv.id, 'send')}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-primary-600"
                            title="Send to Customer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Pay with Stripe */}
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => setStripeInvoice(inv)}
                            className="p-1.5 rounded hover:bg-indigo-50 text-[#635bff] hover:text-[#5349e0]"
                            title="Pay online with Stripe (Zero PAN required)"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Pay with Razorpay */}
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => setRazorpayInvoice(inv)}
                            className="p-1.5 rounded hover:bg-blue-50 text-[#3395ff] hover:text-[#0c2340]"
                            title="Pay online with Razorpay (UPI, Card, NetBanking)"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Record Payment */}
                        {user?.role !== 'customer' && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => setPaymentInvoice(inv)}
                            className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center gap-1"
                            title="Record Offline Payment"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Record</span>
                          </button>
                        )}

                        {/* Chase Overdue */}
                        {inv.is_overdue && user?.role !== 'customer' && (
                          <button
                            onClick={() => setChaseInvoice(inv)}
                            className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold"
                            title="Send Chase Email"
                          >
                            Chase
                          </button>
                        )}

                        {/* Notify Customer (Email) */}
                        {user?.role !== 'customer' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              setNotifyInvoice(inv);
                              setNotifyType(inv.status === 'paid' ? 'payment_receipt' : 'invoice_due');
                            }}
                            className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800"
                            title="Send Email Notification / Receipt"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Print */}
                        <Link
                          to={`/invoices/${inv.id}?print=true`}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                          title="Print Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {paymentInvoice && (
        <RecordPaymentModal
          isOpen={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          invoice={paymentInvoice}
          onPaymentRecorded={loadInvoices}
        />
      )}

      {/* Stripe Online Payment Modal */}
      {stripeInvoice && (
        <StripeModal
          isOpen={!!stripeInvoice}
          onClose={() => setStripeInvoice(null)}
          invoice={stripeInvoice}
          onSuccess={loadInvoices}
        />
      )}

      {/* Razorpay Online Payment Modal */}
      {razorpayInvoice && (
        <RazorpayModal
          isOpen={!!razorpayInvoice}
          onClose={() => setRazorpayInvoice(null)}
          invoice={razorpayInvoice}
          onSuccess={loadInvoices}
        />
      )}

      {/* Chase Modal */}
      {chaseInvoice && (
        <ChaseReminderModal
          isOpen={!!chaseInvoice}
          onClose={() => setChaseInvoice(null)}
          invoice={chaseInvoice}
          onChaseSent={loadInvoices}
        />
      )}

      {/* Notify Customer Modal */}
      {notifyInvoice && (
        <NotifyCustomerModal
          isOpen={!!notifyInvoice}
          onClose={() => setNotifyInvoice(null)}
          invoice={notifyInvoice}
          initialType={notifyType}
          onSent={loadInvoices}
        />
      )}
    </div>
  );
}
