import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { pdfService } from '../services/pdfService';
import { StatusBadge } from '../components/StatusBadge';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { ViewNotificationModal } from '../components/ViewNotificationModal';
import { CustomerSubscribeModal } from '../components/CustomerSubscribeModal';
import { RazorpayModal } from '../components/RazorpayModal';
import { StripeModal } from '../components/StripeModal';
import {
  Repeat,
  FileText,
  CreditCard,
  Zap,
  Tag,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  RotateCw,
  XCircle,
  Plus,
  Minus,
  Sparkles,
  ShieldCheck,
  Check,
  Clock,
  Layers,
  ArrowRight,
  Receipt,
  LifeBuoy,
  MessageSquare,
  Bot,
  HelpCircle,
  Send,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  Search,
  Ticket,
  User,
  Mail,
  Bell
} from 'lucide-react';

export function CustomerPortal() {
  const { user, authFetch } = useAuth();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState('subscriptions'); // 'subscriptions' | 'invoices' | 'payments' | 'discounts' | 'support'
  const [subFilter, setSubFilter] = useState('all'); // 'all' | 'active' | 'paused' | 'closed'
  const [invFilter, setInvFilter] = useState('all'); // 'all' | 'outstanding' | 'paid'

  // Data state
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stripeInvoice, setStripeInvoice] = useState(null);
  const [activeNotification, setActiveNotification] = useState(null);
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);

  // Modals
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [quantitySub, setQuantitySub] = useState(null);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Checkout form state
  const [paymentMethod, setPaymentMethod] = useState('Credit Card');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paying, setPaying] = useState(false);

  // Quantity stepper state
  const [newQuantity, setNewQuantity] = useState(1);
  const [updatingQty, setUpdatingQty] = useState(false);

  // Billing run simulation state
  const [runningBilling, setRunningBilling] = useState(false);

  // Support & Enquiry states
  const [createTicketModalOpen, setCreateTicketModalOpen] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('enquiry');
  const [newTicketPriority, setNewTicketPriority] = useState('normal');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [submittingNewTicket, setSubmittingNewTicket] = useState(false);

  const [viewTicketModal, setViewTicketModal] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [loadingTicketMessages, setLoadingTicketMessages] = useState(false);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [sendingTicketReply, setSendingTicketReply] = useState(false);

  const [faqSearch, setFaqSearch] = useState('');
  const [faqCategory, setFaqCategory] = useState('all');
  const [expandedFaqId, setExpandedFaqId] = useState(null);

  // Load portal data
  const loadData = async () => {
    try {
      setLoading(true);
      const [subData, invData, payData, discData, ticketData, faqData, notifData] = await Promise.all([
        authFetch('/api/subscriptions'),
        authFetch('/api/invoices'),
        authFetch('/api/payments').catch(() => ({ payments: [] })),
        authFetch('/api/discounts').catch(() => ({ discounts: [] })),
        authFetch('/api/support/tickets').catch(() => ({ tickets: [] })),
        authFetch('/api/support/faqs').catch(() => ({ faqs: [] })),
        authFetch('/api/notifications').catch(() => ({ notifications: [], unread_count: 0 }))
      ]);

      setSubscriptions(subData.subscriptions || []);
      setInvoices(invData.invoices || []);
      setPayments(payData.payments || []);
      setDiscounts(discData.discounts || []);
      setTickets(ticketData.tickets || []);
      setFaqs(faqData.faqs || []);
      setNotifications(notifData.notifications || []);
      setUnreadCount(notifData.unread_count || 0);
    } catch (err) {
      console.error('Failed to load portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['subscriptions', 'invoices', 'payments', 'discounts', 'support', 'messages'].includes(tabParam)) {
      setActiveTab(tabParam);
    }

    const handleTabSwitch = (e) => {
      if (e.detail && ['subscriptions', 'invoices', 'payments', 'discounts', 'support', 'messages'].includes(e.detail)) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('switch-portal-tab', handleTabSwitch);
    return () => window.removeEventListener('switch-portal-tab', handleTabSwitch);
  }, []);

  useEffect(() => {
    const handleOpenPay = (e) => {
      const invId = e.detail;
      const targetInv = invoices.find(i => i.id === invId);
      if (targetInv) {
        setPaymentInvoice(targetInv);
        setActiveTab('invoices');
      }
    };
    window.addEventListener('pay-invoice-modal', handleOpenPay);
    return () => window.removeEventListener('pay-invoice-modal', handleOpenPay);
  }, [invoices]);

  const handleOpenNotification = async (notif) => {
    setActiveNotification(notif);
    if (notif.status !== 'read') {
      try {
        await authFetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH' });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'read' } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Self-service transition (pause, resume, renew, close)
  const handleTransition = async (subId, action) => {
    if (action === 'close') {
      const confirmClose = window.confirm('Are you sure you want to close this subscription? Service will discontinue at the end of the period.');
      if (!confirmClose) return;
    }
    try {
      await authFetch(`/api/subscriptions/${subId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      await loadData();
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  // Open quantity modal
  const openQuantityModal = async (sub) => {
    try {
      // Fetch full subscription to get lines
      const data = await authFetch(`/api/subscriptions/${sub.id}`);
      setQuantitySub({
        ...sub,
        fullLines: data.lines || [],
        plan_min_quantity: data.subscription?.plan_min_quantity || sub.min_quantity || 1
      });
      const firstLine = (data.lines && data.lines[0]) || {};
      setNewQuantity(firstLine.quantity || 1);
    } catch (err) {
      console.error(err);
      setQuantitySub(sub);
      setNewQuantity(sub.line_count || 1);
    }
  };

  // Submit quantity update
  const handleSaveQuantity = async () => {
    if (!quantitySub) return;
    const firstLine = (quantitySub.fullLines && quantitySub.fullLines[0]) || {};
    const lineId = firstLine.id;

    if (!lineId) {
      alert('Unable to identify subscription line.');
      return;
    }

    try {
      setUpdatingQty(true);
      await authFetch(`/api/subscriptions/${quantitySub.id}/quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ line_id: lineId, quantity: newQuantity })
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      setQuantitySub(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update quantity');
    } finally {
      setUpdatingQty(false);
    }
  };

  // Open invoice detail modal
  const openInvoiceDetail = async (invoice) => {
    try {
      setDetailLoading(true);
      const data = await authFetch(`/api/invoices/${invoice.id}`);
      setDetailInvoice(data.invoice || invoice);
    } catch (err) {
      console.error(err);
      setDetailInvoice(invoice);
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit payment
  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!paymentInvoice) return;

    try {
      setPaying(true);
      const payAmount = Number(paymentInvoice.outstanding || paymentInvoice.total);

      await authFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoice_id: paymentInvoice.id,
          amount: payAmount,
          method: paymentMethod,
          payment_date: new Date().toISOString().split('T')[0],
          note: `Customer self-service online settlement via ${paymentMethod}`
        })
      });

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });

      setPaymentInvoice(null);
      setCardName('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      await loadData();
    } catch (err) {
      alert(err.message || 'Payment processing failed.');
    } finally {
      setPaying(false);
    }
  };

  // Simulate Billing Day Run
  const handleBillingDaySimulation = async () => {
    try {
      setRunningBilling(true);
      const res = await authFetch('/api/billing/run', {
        method: 'POST',
        body: JSON.stringify({ simulationDate: new Date().toISOString().split('T')[0] })
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.5 }
      });

      alert(`⚡ Billing Run Complete!\nGenerated: ${res.generatedCount || 0} invoice(s)\nProcessed: ${res.totalFound || 0} subscription(s)\nTotal Billed: $${(res.totalAmountBilled || 0).toFixed(2)}`);
      await loadData();
      setActiveTab('invoices');
    } catch (err) {
      alert(err.message || 'Billing simulation notice.');
    } finally {
      setRunningBilling(false);
    }
  };

  // Computed Metrics
  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const totalMonthlyValue = activeSubs.reduce((sum, s) => sum + Number(s.total_recurring_amount || 0), 0);

  let nextBillingDateStr = 'None';
  let nextBillingAmount = 0;
  activeSubs.forEach(s => {
    if (s.next_billing_date) {
      if (nextBillingDateStr === 'None' || s.next_billing_date < nextBillingDateStr) {
        nextBillingDateStr = s.next_billing_date;
        nextBillingAmount = Number(s.total_recurring_amount || 0);
      }
    }
  });

  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const paidInvoices = invoices.filter(i => i.status === 'paid' || (i.outstanding === 0 && Number(i.total) > 0));
  const paidTotal = paidInvoices.reduce((sum, i) => sum + Number(i.paid_amount || i.total || 0), 0);
  const outstandingInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && (i.outstanding > 0 || i.status === 'confirmed'));
  const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + Number(i.outstanding || i.total || 0), 0);

  const totalLifetimeCleared = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Support computations and handlers
  const openTicketsCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  const handleCreateTicketSubmit = async (e) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;

    try {
      setSubmittingNewTicket(true);
      const res = await authFetch('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: newTicketSubject.trim(),
          category: newTicketCategory,
          priority: newTicketPriority,
          message: newTicketMessage.trim()
        })
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      setCreateTicketModalOpen(false);
      setNewTicketSubject('');
      setNewTicketMessage('');
      alert(`🎉 Support Ticket ${res.ticket?.ticket_number} submitted! A specialist has been alerted.`);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to submit ticket');
    } finally {
      setSubmittingNewTicket(false);
    }
  };

  const handleOpenTicketThread = async (ticket) => {
    try {
      setViewTicketModal(ticket);
      setLoadingTicketMessages(true);
      const res = await authFetch(`/api/support/tickets/${ticket.id}`);
      setTicketMessages(res.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTicketMessages(false);
    }
  };

  const handleSendCustomerTicketReply = async (e) => {
    e.preventDefault();
    if (!ticketReplyText.trim() || !viewTicketModal) return;

    try {
      setSendingTicketReply(true);
      await authFetch(`/api/support/tickets/${viewTicketModal.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: ticketReplyText.trim() })
      });

      setTicketReplyText('');
      const updated = await authFetch(`/api/support/tickets/${viewTicketModal.id}`);
      setTicketMessages(updated.messages || []);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSendingTicketReply(false);
    }
  };

  const handleFaqVoteHelpful = async (faqId) => {
    try {
      await authFetch(`/api/support/faqs/${faqId}/helpful`, { method: 'POST' });
      setFaqs(prev => prev.map(f => f.id === faqId ? { ...f, helpful_count: (f.helpful_count || 0) + 1 } : f));
    } catch (e) {}
  };

  const filteredFaqs = faqs.filter(f => {
    const matchesSearch = !faqSearch ||
      f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.answer.toLowerCase().includes(faqSearch.toLowerCase()) ||
      (f.tags && f.tags.toLowerCase().includes(faqSearch.toLowerCase()));
    const matchesCategory = faqCategory === 'all' || f.category === faqCategory;
    return matchesSearch && matchesCategory;
  });

  const faqCategories = ['all', ...Array.from(new Set(faqs.map(f => f.category)))];

  // Filtered Subscriptions
  const filteredSubs = subscriptions.filter(sub => {
    if (subFilter === 'all') return true;
    return sub.status.toLowerCase() === subFilter.toLowerCase();
  });

  // Filtered Invoices
  const filteredInvoices = invoices.filter(inv => {
    if (invFilter === 'all') return true;
    if (invFilter === 'outstanding') {
      return inv.status !== 'paid' && inv.status !== 'cancelled' && (inv.outstanding > 0 || inv.status === 'confirmed');
    }
    if (invFilter === 'paid') {
      return inv.status === 'paid' || (inv.outstanding === 0 && Number(inv.total) > 0);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-500">Loading your customer dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Welcome & Identity Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        {/* Ambient Floating Orbs */}
        <div className="orb-ambient absolute -right-10 -top-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="orb-ambient absolute right-40 -bottom-10 w-64 h-64 bg-primary-500/15 rounded-full blur-2xl pointer-events-none [animation-delay:3s]" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-primary-600 to-purple-600 flex items-center justify-center text-white text-xl font-extrabold shadow-lg shadow-indigo-500/30 ring-2 ring-white/10 shrink-0">
              {user?.name?.charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-['Outfit']">
                  Welcome, {user?.name}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Customer
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  VIP Self-Service
                </span>
              </div>
              <p className="text-xs sm:text-sm text-indigo-200/80 mt-1">
                Brightloop Customer Portal • {user?.email} • Real-time self-service enabled
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleBillingDaySimulation}
              disabled={runningBilling}
              className="shimmer-active inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold btn-emerald-glow shadow-md shadow-emerald-500/25 transition-all transform active:scale-95"
              title="Simulates scheduled recurring billing: generates invoice & tests discount engine!"
            >
              <Zap className={`w-4 h-4 text-amber-300 fill-amber-300 ${runningBilling ? 'animate-bounce' : ''}`} />
              <span>{runningBilling ? 'Simulating...' : 'Run Billing Day ⚡'}</span>
            </button>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-brightcare-chat'))}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md shadow-sm transition-all transform hover:scale-102 active:scale-98"
            >
              <Bot className="w-4 h-4 text-indigo-300" />
              <span>Ask BrightCare</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('support');
                setCreateTicketModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md shadow-sm transition-all transform hover:scale-102 active:scale-98"
            >
              <Ticket className="w-4 h-4 text-rose-300" />
              <span>Open Ticket</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Header */}
        <div className="flex items-center gap-2 mt-8 border-t border-white/10 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'subscriptions'
                ? 'bg-white text-slate-900 shadow-md shadow-black/10'
                : 'text-indigo-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>My Subscriptions</span>
            {activeSubs.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'subscriptions' ? 'bg-primary-100 text-primary-800' : 'bg-white/20 text-white'}`}>
                {activeSubs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'invoices'
                ? 'bg-white text-slate-900 shadow-md shadow-black/10'
                : 'text-indigo-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Invoices</span>
            {outstandingInvoices.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                {outstandingInvoices.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'payments'
                ? 'bg-white text-slate-900 shadow-md shadow-black/10'
                : 'text-indigo-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payment History</span>
          </button>

          <button
            onClick={() => setActiveTab('discounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'discounts'
                ? 'bg-white text-slate-900 shadow-md shadow-black/10'
                : 'text-indigo-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Automated Discounts</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300">
              Rule Engine
            </span>
          </button>

          <button
            onClick={() => setActiveTab('support')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'support'
                ? 'bg-white text-slate-900 shadow-md shadow-black/10'
                : 'text-indigo-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <LifeBuoy className="w-4 h-4" />
            <span>Support & Enquiries</span>
            {openTicketsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                {openTicketsCount}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200">
                24/7 AI
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY SUBSCRIPTIONS                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Hero Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-['Outfit']">
                My <span className="gradient-text">Subscriptions</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor and manage your active cloud software plans, seat allocations, and automated billing rules in one real-time dashboard.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Self-service enabled (No email required)
              </span>
            </div>
          </div>

          {/* 4 Overview KPI Metric Cards (Interactive) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setSubFilter('active')}
              className="interactive-card cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between group hover:border-indigo-300"
              title="Click to filter by Active subscriptions"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-primary-600 transition-colors">
                  Active Subscriptions
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform shadow-xs">
                  ⚡
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 font-['Outfit']">{activeSubs.length}</div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>{subscriptions.length} total plans</span>
                  <span className="text-primary-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                    Filter Active →
                  </span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setSubFilter('all')}
              className="interactive-card cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between group hover:border-emerald-300"
              title="Click to view all plans"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 transition-colors">
                  Monthly Investment
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform shadow-xs">
                  💳
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 font-['Outfit']">${totalMonthlyValue.toFixed(2)}</div>
                <div className="text-xs text-slate-400 mt-1">Net recurring software investment</div>
              </div>
            </div>

            <div
              onClick={() => {
                const el = document.getElementById('subscriptions-list');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="interactive-card cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between group hover:border-amber-300"
              title="View next renewal"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">
                  Next Billing Event
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform shadow-xs">
                  📅
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-extrabold text-slate-900 font-['Outfit']">{nextBillingDateStr}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {nextBillingDateStr !== 'None' ? `Estimated: $${nextBillingAmount.toFixed(2)}` : 'All invoices settled'}
                </div>
              </div>
            </div>

            <div
              onClick={() => setActiveTab('discounts')}
              className="interactive-card cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between group hover:border-teal-300"
              title="View active discount rules"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-teal-600 transition-colors">
                  Automated Discounts
                </span>
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform shadow-xs">
                  🏷️
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-emerald-600 font-['Outfit']">Active</div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>Rules auto-applied per invoice</span>
                  <span className="text-teal-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                    View Rules →
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Pills Toolbar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSubFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                subFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Plans ({subscriptions.length})
            </button>
            <button
              onClick={() => setSubFilter('active')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                subFilter === 'active'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Active ({subscriptions.filter(s => s.status === 'active').length})
            </button>
            <button
              onClick={() => setSubFilter('paused')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                subFilter === 'paused'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Paused ({subscriptions.filter(s => s.status === 'paused').length})
            </button>
            <button
              onClick={() => setSubFilter('closed')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                subFilter === 'closed'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Closed ({subscriptions.filter(s => s.status === 'closed').length})
            </button>
          </div>

          {/* Subscription Cards Grid */}
          <div className="space-y-4">
            {filteredSubs.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80">
                <Repeat className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-700">No subscriptions found</h4>
                <p className="text-xs text-slate-400 mt-1">There are no subscriptions matching the selected status.</p>
              </div>
            ) : (
              filteredSubs.map((sub) => {
                const isActive = sub.status === 'active';
                const isPaused = sub.status === 'paused';
                const isClosed = sub.status === 'closed';

                return (
                  <div
                    key={sub.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-extrabold text-indigo-600 text-sm bg-indigo-50 px-2.5 py-1 rounded-md">
                            {sub.number}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isPaused
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {sub.status}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-slate-900 font-['Outfit']">{sub.plan_name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Billing Cadence: <strong className="text-slate-800 capitalize">{sub.billing_period}</strong> • Started: {sub.start_date}
                            {sub.expiry_date && ` • Term Expiry: ${sub.expiry_date}`}
                            {sub.next_billing_date && ` • Next Renewal: ${sub.next_billing_date}`}
                          </p>
                        </div>

                        {/* Recurring Amount & Product Details */}
                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          <div className="text-xs">
                            <span className="text-slate-400">Recurring Total: </span>
                            <span className="text-base font-extrabold text-slate-900 font-mono">
                              ${Number(sub.total_recurring_amount).toFixed(2)}
                            </span>
                            <span className="text-slate-400 text-[11px]"> / {sub.billing_period}</span>
                          </div>

                          <div className="text-xs bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 text-slate-600">
                            License Lines: <strong className="text-slate-900">{sub.line_count || 1}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Self-Service Control Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Change Quantity Stepper Trigger */}
                        {isActive && (
                          <button
                            onClick={() => openQuantityModal(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors"
                          >
                            <span>Change Quantity</span>
                          </button>
                        )}

                        {/* Pause Button */}
                        {isActive && sub.pausable === 1 && (
                          <button
                            onClick={() => handleTransition(sub.id, 'pause')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-colors"
                          >
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause Plan</span>
                          </button>
                        )}

                        {/* Resume Button */}
                        {isPaused && (
                          <button
                            onClick={() => handleTransition(sub.id, 'resume')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Resume Plan</span>
                          </button>
                        )}

                        {/* Renew Button */}
                        {isActive && sub.renewable === 1 && (
                          <button
                            onClick={() => handleTransition(sub.id, 'renew')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Renew Term</span>
                          </button>
                        )}

                        {/* Close Plan Button */}
                        {!isClosed && sub.closable === 1 && (
                          <button
                            onClick={() => handleTransition(sub.id, 'close')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Close Plan</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MY INVOICES                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {/* Hero Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-['Outfit']">
                My <span className="gradient-text">Invoices</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review detailed recurring billing statements, automated tax breakdowns, and discount line items. View or download official PDF invoices instantly.
              </p>
            </div>
            <div>
              {outstandingInvoices.length > 0 ? (
                <button
                  onClick={() => setPaymentInvoice(outstandingInvoices[0])}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md transition-all font-['Outfit']"
                >
                  💳 Settle Outstanding (${outstandingTotal.toFixed(2)})
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-600" />
                  All Invoices Paid in Full
                </span>
              )}
            </div>
          </div>

          {/* 4 Overview KPI Metric Cards (Interactive) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setInvFilter('all')}
              className="interactive-card cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between group hover:border-indigo-300"
              title="Click to view All Invoices"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">
                  Total Invoiced
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform shadow-xs">
                  📑
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 font-['Outfit']">${totalInvoiced.toFixed(2)}</div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>{invoices.length} invoices generated</span>
                  <span className="text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                    View All →
                  </span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setInvFilter('paid')}
              className="interactive-card cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between group hover:border-emerald-300"
              title="Click to filter Paid Invoices"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 transition-colors">
                  Paid to Date
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform shadow-xs">
                  ✓
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-emerald-600 font-['Outfit']">${paidTotal.toFixed(2)}</div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>{paidInvoices.length} settled statements</span>
                  <span className="text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                    Filter Paid →
                  </span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setInvFilter('outstanding')}
              className={`interactive-card cursor-pointer bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between group transition-all ${
                outstandingTotal > 0
                  ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/20 to-white hover:border-amber-400'
                  : 'border-slate-200/80 hover:border-amber-300'
              }`}
              title="Click to filter Outstanding Invoices"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">
                  Outstanding Balance
                </span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform shadow-xs ${
                  outstandingTotal > 0 ? 'bg-amber-100 text-amber-700' : 'bg-amber-50 text-amber-600'
                }`}>
                  ⏳
                </div>
              </div>
              <div className="mt-3">
                <div className={`text-3xl font-extrabold font-['Outfit'] ${outstandingTotal > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                  ${outstandingTotal.toFixed(2)}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>{outstandingInvoices.length} open for payment</span>
                  <span className="text-amber-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                    Filter Due →
                  </span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setActiveTab('discounts')}
              className="interactive-card cursor-pointer bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between group hover:border-teal-300"
              title="View automated tax & discount compliance"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-teal-600 transition-colors">
                  Tax Compliance
                </span>
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform shadow-xs">
                  ⚖️
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-extrabold text-slate-900 font-['Outfit']">Automated</div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>Standard VAT rules calculated</span>
                  <span className="text-teal-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                    View Rates →
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Pills Toolbar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setInvFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                invFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setInvFilter('outstanding')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                invFilter === 'outstanding'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Outstanding ({outstandingInvoices.length})
            </button>
            <button
              onClick={() => setInvFilter('paid')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                invFilter === 'paid'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Paid ({paidInvoices.length})
            </button>
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-bold tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Billing Period</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No invoices match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isPaid = inv.status === 'paid' || (inv.outstanding === 0 && Number(inv.total) > 0);

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                            {inv.number}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            {inv.billing_period_start} → {inv.billing_period_end || 'Period End'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {inv.due_date || 'Immediate'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900">
                            ${Number(inv.total).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-bold">
                            ${Number(inv.paid_amount || 0).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-amber-600 font-bold">
                            ${Number(inv.outstanding || 0).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.is_overdue
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {isPaid ? 'Paid' : inv.is_overdue ? 'Overdue' : 'Outstanding'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!isPaid && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setStripeInvoice(inv)}
                                    className="px-2.5 py-1 bg-[#635bff] hover:bg-[#5349e0] text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors flex items-center gap-1"
                                    title="Pay online with Stripe (Zero PAN required)"
                                  >
                                    <CreditCard className="w-3 h-3" />
                                    <span>Pay (Stripe)</span>
                                  </button>
                                  <button
                                    onClick={() => setPaymentInvoice(inv)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                                    title="Pay with Razorpay"
                                  >
                                    <span>Razorpay</span>
                                  </button>
                                </div>
                              )}

                              <button
                                onClick={() => openInvoiceDetail(inv)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                                title="View Itemized Statement"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => pdfService.downloadInvoicePdf(inv, user)}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 transition-colors"
                                title="Download Vector PDF Invoice"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PAYMENT HISTORY                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Hero Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-['Outfit']">
                Payment <span className="gradient-text">History</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete transaction ledger of settled recurring subscription charges, wire transfers, and digital receipts.
              </p>
            </div>
          </div>

          {/* 3 Overview KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Lifetime Cleared Volume</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">💵</div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 font-['Outfit']">${totalLifetimeCleared.toFixed(2)}</div>
                <div className="text-xs text-slate-400 mt-1">Total customer payments recorded</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Settled Transactions</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold">🧾</div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 font-['Outfit']">{payments.length}</div>
                <div className="text-xs text-slate-400 mt-1">All transactions cleared</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Primary Method</span>
                <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center text-sm font-bold">💳</div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-extrabold text-slate-900 font-['Outfit']">Electronic Settlement</div>
                <div className="text-xs text-slate-400 mt-1">Instant invoice matching</div>
              </div>
            </div>
          </div>

          {/* Payment History Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-bold tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Payment Ref</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => {
                      const matchedInv = invoices.find(i => i.id === p.invoice_id) || { number: p.invoice_number, total: p.amount, id: p.invoice_id };

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                            PAY-{String(p.id).padStart(4, '0')}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-indigo-600">
                            {p.invoice_number || `INV-${p.invoice_id}`}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {p.payment_date || p.created_at?.split('T')[0]}
                          </td>
                          <td className="py-3.5 px-4 text-slate-800 font-medium">
                            {p.method?.includes('Card') ? '💳' : '🏦'} {p.method}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900">
                            ${Number(p.amount).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                              Cleared
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                            {p.note || 'Settled electronically'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => pdfService.downloadInvoicePdf(matchedInv, user)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Receipt PDF</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUTOMATED DISCOUNTS                                                */}
      {/* ========================================================================= */}
      {activeTab === 'discounts' && (
        <div className="space-y-6">
          {/* Hero Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-['Outfit']">
                Automated <span className="gradient-text">Discounts Engine</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Zero promo codes. Zero manual entry. As defined in Brightloop policies, our rule engine automatically detects qualifying volume, ecosystem variants, and spending thresholds, attaching transparent line deductions to your invoices.
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">🏷️</span>
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-800">Current Rule Status</p>
                <p className="text-base font-extrabold text-emerald-900 font-['Outfit']">Engine Active</p>
              </div>
            </div>
          </div>

          {/* Principle Explanation Callout */}
          <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-teal-500/10 border border-indigo-200/80 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">How Brightloop Automated Discounts Work</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Customers never have to search for promo coupons. If an administrative discount rule matches your subscription parameters (such as taking 10+ seats or selecting the Odoo brand integration variant), the discount is appended <strong>automatically as an itemized line item</strong> on your invoice. Once a rule reaches its usage limit or end date, it stops on its own with no human intervention needed.
                </p>
              </div>
            </div>
          </div>

          {/* Rules Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {discounts.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-700">No discount rules configured</h4>
                <p className="text-xs text-slate-400 mt-1">Admin rules will appear here automatically.</p>
              </div>
            ) : (
              discounts.map((rule) => {
                const isLimitReached = rule.usage_limit && rule.times_used >= rule.usage_limit;
                const isExpired = rule.end_date && rule.end_date < new Date().toISOString().split('T')[0];

                return (
                  <div
                    key={rule.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-mono text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                          {rule.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isLimitReached
                            ? 'bg-slate-100 text-slate-600'
                            : isExpired
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isLimitReached ? 'Limit Reached' : isExpired ? 'Expired' : 'Active Rule'}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900 font-['Outfit']">{rule.name}</h4>
                      <div className="mt-2 text-2xl font-extrabold text-indigo-600 font-mono">
                        {rule.type === 'percentage' ? `${rule.value}% OFF` : `$${Number(rule.value).toFixed(2)} FLAT`}
                      </div>

                      <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Applies To:</span>
                          <span className="font-semibold text-slate-800 capitalize">
                            {rule.scope === 'whole_subscription' ? 'Entire Subscription' : 'Specific Product Line'}
                          </span>
                        </div>
                        {rule.min_quantity > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Min Quantity:</span>
                            <span className="font-semibold text-slate-800">{rule.min_quantity} seat(s)</span>
                          </div>
                        )}
                        {rule.min_purchase > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Min Purchase:</span>
                            <span className="font-semibold text-slate-800">${Number(rule.min_purchase).toFixed(2)}</span>
                          </div>
                        )}
                        {rule.usage_limit && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Usage Tracker:</span>
                            <span className="font-semibold text-slate-800">{rule.times_used} / {rule.usage_limit} used</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Auto-detected on invoice generation
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CUSTOMER CARE SUPPORT & ENQUIRIES                                  */}
      {/* ========================================================================= */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          {/* Hero Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-['Outfit']">
                Customer Care & <span className="gradient-text">Site Enquiries</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Instant AI customer support, knowledge base guides, and direct priority ticket dispatch for Brightloop customers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreateTicketModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-500/20 transition-all transform active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Support Ticket</span>
              </button>
            </div>
          </div>

          {/* 4 Support Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: 24/7 AI Assistant */}
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-primary-950 text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">AI Support Agent</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <div className="mt-3 relative z-10">
                <div className="text-xl font-extrabold font-['Outfit']">BrightCare AI</div>
                <div className="text-xs text-indigo-200 mt-0.5">Sub-second answers 24/7</div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold relative z-10">
                <span className="text-emerald-300 text-[11px]">● Active Online</span>
                <span className="text-indigo-200 text-[11px]">Click widget ↘</span>
              </div>
            </div>

            {/* Card 2: Open Tickets */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">My Active Tickets</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold">🎫</div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900 font-['Outfit']">{openTicketsCount}</div>
                <div className="text-xs text-slate-400 mt-1">{tickets.length} total historical inquiries</div>
              </div>
            </div>

            {/* Card 3: Response SLA */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Response SLA</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">⏱️</div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-emerald-600 font-['Outfit']">&lt; 2 Hours</div>
                <div className="text-xs text-slate-400 mt-1">Guaranteed human specialist review</div>
              </div>
            </div>

            {/* Card 4: Support Email */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Direct Support Email</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold">✉️</div>
              </div>
              <div className="mt-3">
                <div className="text-xs font-extrabold text-slate-900 truncate font-mono">support@brightloop.com</div>
                <div className="text-xs text-slate-400 mt-1">Mon - Fri 8am - 8pm EST</div>
              </div>
            </div>
          </div>

          {/* MY SUPPORT TICKETS TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-['Outfit']">My Support Tickets</h3>
                <p className="text-xs text-slate-400 mt-0.5">Track and reply to your open customer support inquiries.</p>
              </div>
              <button
                onClick={() => setCreateTicketModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Inquiry</span>
              </button>
            </div>

            {tickets.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <LifeBuoy className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-700 text-xs font-['Outfit']">No Support Tickets Logged</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Have a question about billing, paused subscriptions, or platform features? Click "Submit Support Ticket" or chat with BrightCare AI!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Ticket #</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-primary-600">
                          {t.ticket_number}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-xs truncate">
                          {t.subject}
                        </td>
                        <td className="py-3.5 px-4 capitalize">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {t.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              t.priority === 'urgent'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : t.priority === 'high'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${
                              t.status === 'open'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : t.status === 'in_progress'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : t.status === 'resolved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                t.status === 'open'
                                  ? 'bg-amber-500 animate-pulse'
                                  : t.status === 'in_progress'
                                  ? 'bg-indigo-500'
                                  : t.status === 'resolved'
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-400'
                              }`}
                            ></span>
                            {t.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenTicketThread(t)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>View Thread</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SITE ENQUIRIES & KNOWLEDGE BASE FAQS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-['Outfit'] flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary-600" />
                  <span>Site Enquiries & Platform Knowledge Base</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Frequently asked questions regarding billing cycles, pausing plans, discounts, and payments.
                </p>
              </div>

              {/* FAQ Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  placeholder="Search FAQ guides..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {faqCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFaqCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all capitalize ${
                    faqCategory === cat
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'All Guides' : cat}
                </button>
              ))}
            </div>

            {/* FAQ Accordion List */}
            <div className="space-y-3 pt-2">
              {filteredFaqs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No FAQ guides match your search term.</p>
              ) : (
                filteredFaqs.map((faq) => {
                  const isExpanded = expandedFaqId === faq.id;

                  return (
                    <div
                      key={faq.id}
                      className="border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200 hover:border-indigo-200"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 bg-white hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                          <span className="text-xs font-bold text-slate-900 font-['Outfit']">
                            {faq.question}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            {faq.category}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 pt-1 bg-slate-50/60 border-t border-slate-100 text-xs text-slate-700 leading-relaxed">
                          <p className="py-2">{faq.answer}</p>

                          <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                            <span>Tags: <code className="text-indigo-600 font-mono text-[10px]">{faq.tags}</code></span>
                            <button
                              onClick={() => handleFaqVoteHelpful(faq.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 font-bold transition-colors"
                            >
                              <ThumbsUp className="w-3 h-3 text-emerald-600" />
                              <span>Helpful ({faq.helpful_count || 0})</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: MESSAGES & RECEIPTS (NOTIFICATIONS)                                */}
      {/* ========================================================================= */}
      {activeTab === 'messages' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary-600" />
                <span>Inbox • Payment Receipts & Due Alerts</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                All official billing notices, payment receipts, and payment reminders sent via Email.
              </p>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <span>No notifications or receipts yet.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                    notif.status !== 'read' ? 'bg-primary-50/40 hover:bg-primary-50/70' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        notif.type === 'payment_receipt'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {notif.type.replace('_', ' ')}
                      </span>
                      {notif.status !== 'read' && (
                        <span className="w-2 h-2 rounded-full bg-primary-600"></span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 text-sm">
                      {notif.subject}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Dispatched on {notif.sent_at} • Delivered to: {notif.recipient_email}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(notif)}
                      className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Receipt / Notice</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stripe Online Payment Modal */}
      {stripeInvoice && (
        <StripeModal
          isOpen={!!stripeInvoice}
          onClose={() => setStripeInvoice(null)}
          invoice={stripeInvoice}
          onSuccess={loadData}
        />
      )}
      {/* Razorpay Online Payment Modal */}
      {paymentInvoice && (
        <RazorpayModal
          isOpen={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          invoice={paymentInvoice}
          onSuccess={loadData}
        />
      )}
      {/* ========================================================================= */}
      {/* MODAL 2: CHANGE QUANTITY STEPPER MODAL                                    */}
      {/* ========================================================================= */}
      {quantitySub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-['Outfit']">Change Seat Quantity</h3>
                <p className="text-xs text-slate-400 mt-0.5">{quantitySub.plan_name}</p>
              </div>
              <button
                onClick={() => setQuantitySub(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Stepper Control */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Licenses / Seats</span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setNewQuantity(Math.max(quantitySub.plan_min_quantity || 1, newQuantity - 1))}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold active:scale-95 shadow-xs transition-transform"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <span className="text-4xl font-extrabold text-slate-900 font-mono w-16 text-center">
                  {newQuantity}
                </span>

                <button
                  type="button"
                  onClick={() => setNewQuantity(newQuantity + 1)}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold active:scale-95 shadow-xs transition-transform"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {quantitySub.plan_min_quantity > 1 && (
                <p className="text-[11px] text-amber-600 font-bold mt-3">
                  Plan minimum required: {quantitySub.plan_min_quantity} seat(s)
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQuantitySub(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingQty}
                onClick={handleSaveQuantity}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all font-['Outfit']"
              >
                {updatingQty ? 'Updating...' : 'Save & Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: INVOICE DETAILS MODAL                                            */}
      {/* ========================================================================= */}
      {detailInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Statement Details</p>
                <h3 className="text-xl font-extrabold text-white font-['Outfit'] mt-1">
                  Tax Invoice {detailInvoice.number}
                </h3>
              </div>
              <button
                onClick={() => setDetailInvoice(null)}
                className="text-white/60 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Billed To:</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{detailInvoice.customer_company || detailInvoice.customer_name}</p>
                  <p className="text-slate-600">{detailInvoice.customer_email}</p>
                  <p className="text-slate-600">{detailInvoice.customer_address || 'Address on file'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Issued By:</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">Brightloop Software Ltd.</p>
                  <p className="text-slate-600">Boston, MA 02110</p>
                  <p className="text-slate-600">billing@brightloop.com</p>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Itemized Charges</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detailInvoice.lines && detailInvoice.lines.length > 0) ? (
                        detailInvoice.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {l.product_name} {l.variant_value && <span className="text-indigo-600 font-normal">({l.variant_value})</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">{l.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono">${Number(l.unit_price).toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">${Number(l.amount).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {detailInvoice.plan_name || 'Enterprise Cloud Software'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">1</td>
                          <td className="py-2.5 px-3 text-right font-mono">${Number(detailInvoice.total).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">${Number(detailInvoice.total).toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">${Number(detailInvoice.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Standard VAT (Calculated):</span>
                  <span className="font-mono font-bold text-slate-900">$0.00</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200 font-['Outfit']">
                  <span>Total Due:</span>
                  <span className="font-mono text-indigo-600">${Number(detailInvoice.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => pdfService.downloadInvoicePdf(detailInvoice, user)}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailInvoice(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: SUBMIT SUPPORT TICKET MODAL                                      */}
      {/* ========================================================================= */}
      {createTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-primary-950 text-white p-6 relative">
              <button
                type="button"
                onClick={() => setCreateTicketModalOpen(false)}
                className="absolute top-5 right-5 text-white/60 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary-400" />
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Direct Customer Care</span>
              </div>
              <h3 className="text-xl font-extrabold text-white font-['Outfit'] mt-1">
                Submit Support Enquiry
              </h3>
              <p className="text-xs text-indigo-200/80 mt-1">
                Our support engineering team will review your account and respond within 2 business hours.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTicketSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject / Summary</label>
                <input
                  type="text"
                  required
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="e.g. Assistance with Odoo connector sync or invoice tax"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Inquiry Category</label>
                  <select
                    value={newTicketCategory}
                    onChange={(e) => setNewTicketCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white font-medium"
                  >
                    <option value="enquiry">General Site Enquiry</option>
                    <option value="billing">Billing & Invoices</option>
                    <option value="subscription">Subscriptions & Plans</option>
                    <option value="technical">Technical / ERP Integration</option>
                    <option value="account">Account Access & Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority Level</label>
                  <select
                    value={newTicketPriority}
                    onChange={(e) => setNewTicketPriority(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white font-medium"
                  >
                    <option value="normal">Normal (Standard SLA)</option>
                    <option value="high">High (Urgent Attention)</option>
                    <option value="urgent">Urgent (Service Critical)</option>
                    <option value="low">Low (General Feedback)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Enquiry Details</label>
                <textarea
                  required
                  rows={4}
                  value={newTicketMessage}
                  onChange={(e) => setNewTicketMessage(e.target.value)}
                  placeholder="Please describe your question or issue in detail. You can include invoice numbers or subscription IDs."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-slate-50/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateTicketModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNewTicket || !newTicketSubject.trim() || !newTicketMessage.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md shadow-primary-500/20 disabled:opacity-50 transition-all inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingNewTicket ? 'Submitting...' : 'Send Inquiry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CUSTOMER VIEW TICKET THREAD & REPLY MODAL                         */}
      {/* ========================================================================= */}
      {viewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[88vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 relative">
              <button
                type="button"
                onClick={() => setViewTicketModal(null)}
                className="absolute top-5 right-5 text-white/60 hover:text-white text-lg font-bold"
              >
                ✕
              </button>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-300">
                  {viewTicketModal.ticket_number}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10 text-white">
                  {viewTicketModal.category}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    viewTicketModal.status === 'resolved'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {viewTicketModal.status.replace('_', ' ')}
                </span>
              </div>

              <h3 className="text-xl font-extrabold text-white font-['Outfit'] mt-2">
                {viewTicketModal.subject}
              </h3>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/70">
              {loadingTicketMessages ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading conversation history...</div>
              ) : ticketMessages.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No messages in this ticket thread.</div>
              ) : (
                ticketMessages.map((m) => {
                  const isCustomerMsg = m.sender_type === 'customer';
                  const isBot = m.sender_type === 'bot';

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isCustomerMsg ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-start gap-2.5 max-w-[88%]">
                        {!isCustomerMsg && (
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                              isBot ? 'bg-gradient-to-tr from-primary-600 to-indigo-600' : 'bg-slate-700'
                            }`}
                          >
                            {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-4 py-3 text-xs shadow-xs ${
                            isCustomerMsg
                              ? 'bg-primary-600 text-white rounded-br-xs'
                              : isBot
                              ? 'bg-indigo-50/80 text-indigo-950 border border-indigo-100 rounded-bl-xs'
                              : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                          }`}
                        >
                          <div className="font-bold text-[11px] mb-1 opacity-80">
                            {m.sender_name || (isCustomerMsg ? 'You' : isBot ? 'BrightCare AI' : 'Support Specialist')}
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                        </div>

                        {isCustomerMsg && (
                          <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {user?.name?.charAt(0) || 'U'}
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 mt-1 px-10">
                        {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Customer Reply Input */}
            <form onSubmit={handleSendCustomerTicketReply} className="p-4 bg-white border-t border-slate-200 space-y-2">
              <label className="block text-[11px] font-bold text-slate-600">Add follow-up message to this inquiry:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ticketReplyText}
                  onChange={(e) => setTicketReplyText(e.target.value)}
                  placeholder="Type your reply to the customer care team..."
                  className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
                <button
                  type="submit"
                  disabled={sendingTicketReply || !ticketReplyText.trim()}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingTicketReply ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Notification Details Modal */}
      {activeNotification && (
        <ViewNotificationModal
          isOpen={!!activeNotification}
          onClose={() => setActiveNotification(null)}
          notification={activeNotification}
        />
      )}

      {/* Customer Subscribe Modal */}
      <CustomerSubscribeModal
        isOpen={subscribeModalOpen}
        onClose={() => setSubscribeModalOpen(false)}
        onSubscribed={loadData}
      />
    </div>
  );
}
