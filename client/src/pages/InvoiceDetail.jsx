import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PrintableInvoice } from '../components/PrintableInvoice';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { ChaseReminderModal } from '../components/ChaseReminderModal';
import { NotifyCustomerModal } from '../components/NotifyCustomerModal';
import { RazorpayModal } from '../components/RazorpayModal';
import { StripeModal } from '../components/StripeModal';
import { CheckCircle2, XCircle, Send, CreditCard, AlertTriangle, Mail, Zap } from 'lucide-react';

export function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authFetch, user } = useAuth();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const [stripeModalOpen, setStripeModalOpen] = useState(false);
  const [chaseModalOpen, setChaseModalOpen] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/invoices/${id}`);
      setInvoice(res.invoice);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const handleAction = async (action) => {
    try {
      await authFetch(`/api/invoices/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      loadInvoice();
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  if (loading || !invoice) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading invoice #{id}...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Invoice Actions:</span>

          {invoice.status === 'draft' && user?.role !== 'customer' && (
            <button
              onClick={() => handleAction('confirm')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirm Invoice</span>
            </button>
          )}

          {invoice.status !== 'cancelled' && !invoice.sent_at && user?.role !== 'customer' && (
            <button
              onClick={() => handleAction('send')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send to Customer</span>
            </button>
          )}

          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && user?.role !== 'customer' && (
            <button
              onClick={() => handleAction('cancel')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Invoice</span>
            </button>
          )}

          {user?.role !== 'customer' && invoice.status !== 'cancelled' && (
            <button
              onClick={() => setNotifyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Notify Customer (Email)</span>
            </button>
          )}

          {invoice.is_overdue && user?.role !== 'customer' && (
            <button
              onClick={() => setChaseModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Chase Overdue Payment</span>
            </button>
          )}
        </div>

        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStripeModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#635bff] hover:bg-[#5349e0] text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              title="Pay invoice online using Stripe (Credit/Debit Card, Zero PAN required)"
            >
              <CreditCard className="w-4 h-4" />
              <span>Pay Online (Stripe)</span>
            </button>

            <button
              onClick={() => setRazorpayModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0c2340] hover:bg-[#14325a] text-white rounded-lg text-xs font-bold shadow-xs transition-colors border border-[#3395ff]/30"
              title="Pay invoice online using Razorpay"
            >
              <Zap className="w-4 h-4 text-[#3395ff]" />
              <span>Razorpay</span>
            </button>

            {user?.role !== 'customer' && (
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>Record Offline Payment</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Printable Layout */}
      <PrintableInvoice
        invoice={invoice}
        onBack={() => navigate('/invoices')}
      />

      {/* Payment Modal */}
      {paymentModalOpen && (
        <RecordPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          invoice={invoice}
          onPaymentRecorded={loadInvoice}
        />
      )}

      {/* Stripe Online Payment Modal */}
      {stripeModalOpen && (
        <StripeModal
          isOpen={stripeModalOpen}
          onClose={() => setStripeModalOpen(false)}
          invoice={invoice}
          onSuccess={loadInvoice}
        />
      )}

      {/* Razorpay Online Payment Modal */}
      {razorpayModalOpen && (
        <RazorpayModal
          isOpen={razorpayModalOpen}
          onClose={() => setRazorpayModalOpen(false)}
          invoice={invoice}
          onSuccess={loadInvoice}
        />
      )}

      {/* Chase Reminder Modal */}
      {chaseModalOpen && (
        <ChaseReminderModal
          isOpen={chaseModalOpen}
          onClose={() => setChaseModalOpen(false)}
          invoice={invoice}
          onChaseSent={loadInvoice}
        />
      )}

      {/* Notify Customer Modal */}
      {notifyModalOpen && (
        <NotifyCustomerModal
          isOpen={notifyModalOpen}
          onClose={() => setNotifyModalOpen(false)}
          invoice={invoice}
          initialType={invoice.status === 'paid' ? 'payment_receipt' : 'invoice_due'}
          onSent={loadInvoice}
        />
      )}
    </div>
  );
}
