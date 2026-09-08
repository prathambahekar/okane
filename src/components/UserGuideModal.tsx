import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  BookOpen,
  HelpCircle,
  ReceiptText,
  Users,
  Handshake,
  Wallet,
  RefreshCw,
  Sparkles,
  Search,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Zap,
  ChevronDown,
} from 'lucide-react';
import type { ViewName } from '../types';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface UserGuideModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (view: ViewName) => void;
  onAddExpense?: () => void;
  onStartExpenseTutorial?: () => void;
}

export default function UserGuideModal({
  open,
  onClose,
  onNavigate,
  onAddExpense,
  onStartExpenseTutorial,
}: UserGuideModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const isMobile = useMediaQuery('(max-width: 639.98px)');

  const handleAction = (action: 'addExpense' | 'view' | 'tutorial', view?: ViewName) => {
    onClose();
    if (action === 'tutorial' && onStartExpenseTutorial) {
      onStartExpenseTutorial();
    } else if (action === 'addExpense' && onAddExpense) {
      onAddExpense();
    } else if (action === 'view' && view && onNavigate) {
      onNavigate(view);
    }
  };

  const faqItems = [
    {
      q: 'What is the difference between "Paid for Friend" and "Paid by Friend"?',
      a: '• "Paid for Friend": YOU paid money out of your wallet for someone else. They owe you money (increases what they owe you).\n• "Paid by Friend": A FRIEND paid for something for you. You owe them money (increases your debt to them).',
      category: 'Expenses & Debts',
    },
    {
      q: 'How do I settle debts with a friend?',
      a: 'Go to the "Settlements" or "Contacts" tab, select the friend, and click "Settle Up". You can choose to settle all pending items at once or record a partial payment using cash or any wallet.',
      category: 'Settlements',
    },
    {
      q: 'How do Wallets work in Okane?',
      a: 'Wallets represent your real-world money accounts (e.g., Cash, Bank, Credit Card, Paytm). When you log an expense, the money is automatically deducted from your chosen wallet. You can also transfer money between wallets under the Wallets tab.',
      category: 'Wallets',
    },
    {
      q: 'Will transferring money between wallets change my total spending?',
      a: 'No! Wallet transfers move funds internally from one account to another (e.g., ATM Cash withdrawal from Bank). It does not count as spending or income.',
      category: 'Wallets',
    },
    {
      q: 'What are Autopays & Subscriptions?',
      a: 'Autopay keeps track of recurring bills like Netflix, Rent, Broadband, or SIPs. Okane alerts you when a bill is due and lets you record it in one click.',
      category: 'Autopay',
    },
    {
      q: 'How does the Smart AI Assistant work?',
      a: 'Click the AI icon or open Assistant in Okane and type natural sentences like "Paid $30 for lunch with Rahul" or "Borrowed 500 from Priya for groceries". The AI automatically understands categories, friends, and amounts!',
      category: 'AI Assistant',
    },
    {
      q: 'How do I track split expenses with multiple people?',
      a: 'When creating an expense, pick "Split Expense" mode. You can split equally among contacts or enter custom amounts for each person.',
      category: 'Expenses & Debts',
    },
  ];

  const filteredFaqs = searchQuery.trim()
    ? faqItems.filter(
        f =>
          f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqItems;

  const tabs = [
    { label: 'Overview', icon: Lightbulb },
    { label: 'Expense Types', icon: ReceiptText },
    { label: 'Settle Up & Debts', icon: Handshake },
    { label: 'Wallets & Autopay', icon: Wallet },
    { label: 'AI Assistant', icon: Sparkles },
    { label: 'FAQs & Help', icon: HelpCircle },
  ];

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
          animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
          exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          onClick={e => e.stopPropagation()}
          className="w-full sm:max-w-3xl max-h-[88vh] sm:max-h-[90vh] flex flex-col bg-[var(--surface)] text-[var(--text)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden"
        >
          {/* Mobile Handle */}
          {isMobile && (
            <div className="flex justify-center pt-2.5 pb-1 bg-[var(--surface)]">
              <div className="w-9 h-1 rounded-full bg-[var(--border2)]" />
            </div>
          )}

          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold leading-tight">
                  Okane User Guide & Help
                </h2>
                <p className="text-xs text-[var(--text-2)]">
                  Learn how to track expenses, manage debts, and settle up easily
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface3)] transition-colors"
              aria-label="Close user guide"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-[var(--border)] bg-[var(--surface)] overflow-x-auto no-scrollbar flex px-3">
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isSelected = activeTab === idx;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    isSelected
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-[var(--text-2)] hover:text-[var(--text)]'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-sm">
            {/* TAB 0: OVERVIEW */}
            {activeTab === 0 && (
              <div className="flex flex-col gap-5">
                <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--accent-soft)] to-blue-500/5 border border-[var(--accent-soft)] flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-[var(--surface)] text-[var(--accent)] shadow-sm flex-shrink-0">
                    <Zap size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[var(--text)] mb-1">
                      Welcome to Okane! 🌸
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--text-2)] leading-relaxed">
                      Okane is designed to make personal finance & shared group expenses completely effortless. Whether you are tracking daily coffee runs, splitting restaurant bills, or settling monthly rent with friends — Okane keeps everything clear and balanced.
                    </p>
                  </div>
                </div>

                <h4 className="font-bold text-[var(--text)] text-sm">
                  Core Features at a Glance:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
                    <div className="flex items-center gap-2 mb-1.5 text-[var(--accent)]">
                      <ReceiptText size={18} />
                      <span className="font-bold text-sm">1. Log Expenses Easily</span>
                    </div>
                    <p className="text-xs text-[var(--text-2)] leading-relaxed">
                      Track personal spending, vendor payments, or expenses paid for/by friends with flexible wallet selection.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
                    <div className="flex items-center gap-2 mb-1.5 text-[var(--credit)]">
                      <Users size={18} />
                      <span className="font-bold text-sm">2. Clear Friend Balances</span>
                    </div>
                    <p className="text-xs text-[var(--text-2)] leading-relaxed">
                      See exactly who owes you money and whom you owe, down to the exact rupee or dollar without awkward math.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
                    <div className="flex items-center gap-2 mb-1.5 text-[var(--info)]">
                      <Handshake size={18} />
                      <span className="font-bold text-sm">3. One-Click Settle Up</span>
                    </div>
                    <p className="text-xs text-[var(--text-2)] leading-relaxed">
                      Settle up pending debts in full or partially. Payment updates wallet balances and friend ledgers instantly.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
                    <div className="flex items-center gap-2 mb-1.5 text-pink-500">
                      <Sparkles size={18} />
                      <span className="font-bold text-sm">4. Smart AI Assistant</span>
                    </div>
                    <p className="text-xs text-[var(--text-2)] leading-relaxed">
                      Simply speak or type natural phrases like "Dinner with Rahul $40" and let AI auto-fill your log!
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5 mt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAction('tutorial')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[var(--accent)] text-white shadow-md hover:brightness-95 transition-all"
                  >
                    <Sparkles size={16} />
                    <span>Start Interactive Expense Tutorial ✨</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('addExpense')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface2)] transition-colors"
                  >
                    <ReceiptText size={16} />
                    <span>Add Real Expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('view', 'friends')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface2)] transition-colors"
                  >
                    <span>View Contacts</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 1: EXPENSE TYPES */}
            {activeTab === 1 && (
              <div className="flex flex-col gap-4">
                <p className="text-xs sm:text-sm text-[var(--text-2)]">
                  Understanding the 4 expense modes in Okane prevents confusion about who paid and who owes what:
                </p>

                <div className="flex flex-col gap-3">
                  {/* Type 1: Personal */}
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--surface3)] text-[var(--text)]">
                        Personal
                      </span>
                      <h5 className="font-bold text-sm">My Own Personal Expense</h5>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--text-2)] mb-2">
                      <strong>Who paid:</strong> You paid out of your wallet.<br />
                      <strong>Impact:</strong> Reduces your wallet balance. No friends involved.
                    </p>
                    <div className="p-2 rounded-lg bg-[var(--surface)] text-xs text-[var(--text-3)] font-mono">
                      Example: Coffee for $4 paid via Google Pay cash wallet.
                    </div>
                  </div>

                  {/* Type 2: Paid for Friend */}
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] border-l-4 border-l-[var(--credit)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-[var(--credit)]">
                        For Friend
                      </span>
                      <h5 className="font-bold text-sm">I Paid for a Friend (They owe me)</h5>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--text-2)] mb-2">
                      <strong>Who paid:</strong> You paid the bill for a friend.<br />
                      <strong>Impact:</strong> Reduces your wallet balance, but increases <em>Friend's Debt to You</em> (Credit badge).
                    </p>
                    <div className="p-2 rounded-lg bg-[var(--surface)] text-xs text-[var(--credit)] font-mono">
                      Example: You paid $50 for Rahul's concert ticket. Rahul now owes you $50.
                    </div>
                  </div>

                  {/* Type 3: Paid by Friend */}
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] border-l-4 border-l-[var(--debit)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-[var(--debit)]">
                        By Friend
                      </span>
                      <h5 className="font-bold text-sm">Paid by Friend for Me (I owe them)</h5>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--text-2)] mb-2">
                      <strong>Who paid:</strong> A friend paid a bill on your behalf.<br />
                      <strong>Impact:</strong> No cash leaves your wallet right now, but increases <em>Your Debt to Friend</em> (Debit badge).
                    </p>
                    <div className="p-2 rounded-lg bg-[var(--surface)] text-xs text-[var(--debit)] font-mono">
                      Example: Priya paid $30 for your cab fare. You now owe Priya $30.
                    </div>
                  </div>

                  {/* Type 4: Split Bill */}
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface2)] border-l-4 border-l-[var(--info)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-sky-500/15 text-[var(--info)]">
                        Split Bill
                      </span>
                      <h5 className="font-bold text-sm">Shared / Group Bill Split</h5>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--text-2)] mb-2">
                      <strong>Who paid:</strong> You (or a friend) paid a total bill shared among 2+ people.<br />
                      <strong>Impact:</strong> Automatically splits total amount equally or with custom percentages/amounts into individual friend debts.
                    </p>
                    <div className="p-2 rounded-lg bg-[var(--surface)] text-xs text-[var(--info)] font-mono">
                      Example: $100 dinner bill paid by you. You split 50/50 with Amit. Your personal share is $50, and Amit owes you $50.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAction('tutorial')}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-[var(--accent)] text-white shadow-md hover:brightness-95 transition-all text-xs sm:text-sm mt-1"
                >
                  <Sparkles size={16} />
                  <span>Try Interactive Expense & Debt Tutorial ✨</span>
                </button>
              </div>
            )}

            {/* TAB 2: SETTLE UP & DEBTS */}
            {activeTab === 2 && (
              <div className="flex flex-col gap-4">
                <div className="p-4 sm:p-5 rounded-xl bg-[var(--surface2)] border border-[var(--border)]">
                  <div className="flex items-center gap-2.5 mb-2.5 text-[var(--accent)]">
                    <Handshake size={22} />
                    <h5 className="font-bold text-sm sm:text-base">How Debt Settlement Works</h5>
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--text-2)] leading-relaxed mb-4">
                    Whenever you or a friend pay back money, use the <strong>"Settle Up"</strong> button in Settlements or Contact details instead of adding a new random expense. This ensures your friend ledger is cleanly cleared!
                  </p>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 size={18} className="text-[var(--credit)] mt-0.5 flex-shrink-0" />
                      <div>
                        <h6 className="font-semibold text-xs sm:text-sm">Full Settlement:</h6>
                        <p className="text-xs text-[var(--text-2)]">
                          Marks all selected pending expenses as "Settled" in one tap and updates your chosen Wallet.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 size={18} className="text-[var(--info)] mt-0.5 flex-shrink-0" />
                      <div>
                        <h6 className="font-semibold text-xs sm:text-sm">Partial Payment:</h6>
                        <p className="text-xs text-[var(--text-2)]">
                          If a friend pays back ₹500 out of ₹1,500 owed, record a custom partial settlement. It reduces the net balance directly without erasing history!
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 size={18} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
                      <div>
                        <h6 className="font-semibold text-xs sm:text-sm">Undo & History:</h6>
                        <p className="text-xs text-[var(--text-2)]">
                          Made a mistake? Every settlement is saved in Settlement History with a single-click "Undo" button to restore unsettled states effortlessly.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => handleAction('view', 'settlements')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[var(--accent)] text-white hover:brightness-95 transition-all"
                  >
                    <Handshake size={16} />
                    <span>Go to Settlements Tab</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: WALLETS & AUTOPAY */}
            {activeTab === 3 && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 sm:p-5 rounded-xl bg-[var(--surface2)] border border-[var(--border)]">
                    <div className="flex items-center gap-2 mb-2 text-[var(--accent)]">
                      <Wallet size={20} />
                      <h5 className="font-bold text-sm sm:text-base">Wallets & Transfers</h5>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--text-2)] leading-relaxed mb-3">
                      Keep separate accounts for Cash, HDFC Bank, Credit Card, or UPI Wallets.
                    </p>
                    <p className="text-xs text-[var(--text-2)] mb-3">
                      💡 <strong>Internal Transfer:</strong> Moving ₹2,000 from Bank to Cash Wallet updates both balances instantly without affecting your monthly expense metrics!
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAction('view', 'wallets')}
                      className="text-xs sm:text-sm font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
                    >
                      Manage Wallets →
                    </button>
                  </div>

                  <div className="p-4 sm:p-5 rounded-xl bg-[var(--surface2)] border border-[var(--border)]">
                    <div className="flex items-center gap-2 mb-2 text-rose-500">
                      <RefreshCw size={20} />
                      <h5 className="font-bold text-sm sm:text-base">Autopay & Recurring Bills</h5>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--text-2)] leading-relaxed mb-3">
                      Set up monthly rent, Wi-Fi bills, Spotify, or gym subscriptions once.
                    </p>
                    <p className="text-xs text-[var(--text-2)] mb-3">
                      🔔 <strong>Smart Reminders:</strong> Okane badges upcoming due dates in red so you never miss a bill or get hit with late fees.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAction('view', 'recurring')}
                      className="text-xs sm:text-sm font-semibold text-rose-500 hover:underline flex items-center gap-1"
                    >
                      View Autopays →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: AI ASSISTANT */}
            {activeTab === 4 && (
              <div className="flex flex-col gap-4">
                <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2 text-purple-500">
                    <Sparkles size={22} />
                    <h5 className="font-bold text-sm sm:text-base">Okane Smart AI Assistant</h5>
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--text-2)] leading-relaxed mb-4">
                    Skip manual form filling! Open the AI Assistant from the bottom floating bar or AI modal and type or speak naturally:
                  </p>

                  <div className="flex flex-col gap-2">
                    <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <p className="font-semibold text-xs sm:text-sm text-[var(--accent)] mb-0.5">
                        💬 "Paid 450 for Tiffin with Aunty yesterday"
                      </p>
                      <p className="text-xs text-[var(--text-2)]">
                        → Automatically logs $450 under Food/Tiffin category linked to contact Tiffin Aunty!
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <p className="font-semibold text-xs sm:text-sm text-[var(--accent)] mb-0.5">
                        💬 "Split 1200 restaurant bill equally with Hrishikesh and Parth"
                      </p>
                      <p className="text-xs text-[var(--text-2)]">
                        → Creates a 3-way equal split ($400 each) and assigns friend debts instantly!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: FAQs & HELP */}
            {activeTab === 5 && (
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)]">
                  <Search size={18} className="text-[var(--text-3)] flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search help topics (e.g. debt, settle, wallet, split)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-xs sm:text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1 text-[var(--text-3)] hover:text-[var(--text)]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {filteredFaqs.length === 0 ? (
                    <p className="text-xs sm:text-sm text-[var(--text-2)] text-center py-6">
                      No matching help topics found for "{searchQuery}". Try searching for "wallet", "settle", or "split".
                    </p>
                  ) : (
                    filteredFaqs.map((faq, index) => {
                      const isExpanded = expandedFaqIndex === index;
                      return (
                        <div
                          key={faq.q}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedFaqIndex(isExpanded ? null : index)}
                            className="w-full flex items-center justify-between p-3.5 text-left font-semibold text-xs sm:text-sm hover:bg-[var(--surface3)] transition-colors gap-2"
                          >
                            <span>{faq.q}</span>
                            <ChevronDown
                              size={16}
                              className={`text-[var(--text-3)] transition-transform duration-200 flex-shrink-0 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3.5 pb-3.5 pt-1 text-xs sm:text-sm text-[var(--text-2)] leading-relaxed border-t border-[var(--border)]">
                                  <p className="whitespace-pre-line mb-2">{faq.a}</p>
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface3)] text-[var(--text-3)]">
                                    {faq.category}
                                  </span>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-[var(--border)] bg-[var(--surface2)] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-3)]">
              <HelpCircle size={14} />
              <span>Need more help? Tap AI Assistant anytime.</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[var(--accent)] text-white hover:brightness-95 transition-all shadow-sm"
            >
              Got it!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
