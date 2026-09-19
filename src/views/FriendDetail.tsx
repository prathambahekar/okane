import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Handshake,
  Plus,
  Edit2,
  RefreshCw,
  Zap,
  Play,
  X,
  History,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../store';
import { friendBalance, expenseFlow, contactTotalSpent } from '../db';
import {
  fmtMoney,
  fmtDate,
  cleanExpenseDescription,
  formatBillingCycleShort,
  groupExpenses,
  type GroupedExpense,
} from '../utils';
import type { ViewName, Expense } from '../types';
import ContactAvatar from '../components/common/ContactAvatar';
import FriendModal from '../components/FriendModal';
import { CategoryBadge } from '../components/CategoryIcon';
import SettleModal from '../components/SettleModal';
import ExpenseModal from '../components/ExpenseModal';
import RecurringModal from '../components/RecurringModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { ExpenseDetailDrawer } from '../components/ExpenseDetailDrawer';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

interface Props {
  friendId: string;
  onNavigate: (v: ViewName, arg?: string) => void;
}

export default function FriendDetail({ friendId, onNavigate }: Props) {
  useBackButtonModal(true, () => onNavigate('friends'), { priority: BackPriority.DRAWER });

  const { db, deleteExpense, unsettleExpense, triggerAutopayDeduct, quickLogRecurringRule, showToast } = useStore();
  const { settings: { currency } } = db;
  const friend = db.friends.find(f => f.id === friendId);

  const [showEdit, setShowEdit] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [undoExpId, setUndoExpId] = useState<string | null>(null);
  const [selectedDetailGe, setSelectedDetailGe] = useState<GroupedExpense | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showTxDrawer, setShowTxDrawer] = useState(false);
  const [tab, setTab] = useState<'active' | 'settled'>('active');

  useBackButtonModal(showTxDrawer, () => setShowTxDrawer(false), { priority: BackPriority.MODAL });

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const contactType = friend?.type || 'friend';

  // ESC key listener to close drawer card
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !showEdit &&
        !showSettle &&
        !showAddExp &&
        !editingExpense &&
        !deletingExpenseId &&
        !undoExpId &&
        !selectedDetailGe &&
        !showRecurringModal
      ) {
        onNavigate('friends');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, showEdit, showSettle, showAddExp, editingExpense, deletingExpenseId, undoExpId, selectedDetailGe, showRecurringModal]);

  const handleOpenDetail = (e: Expense) => {
    const related = e.groupId
      ? db.expenses.filter(x => x.groupId === e.groupId)
      : [e];
    const relevantSettlement = e.settlementId
      ? db.settlements.filter(s => s.id === e.settlementId)
      : undefined;
    const grouped = groupExpenses(
      related.length > 0 ? related : [e],
      db.wallets,
      db.friends,
      relevantSettlement
    );
    const target = grouped.find(
      ge => ge.id === e.id || (e.groupId && ge.groupId === e.groupId) || ge.items?.some(it => it.id === e.id)
    ) || grouped[0];

    if (target) {
      setSelectedDetailGe(target);
    } else {
      setSelectedDetailGe({
        id: e.id,
        groupId: e.groupId,
        settlementId: e.settlementId,
        description: e.description,
        totalAmount: e.amount,
        date: e.date,
        category: e.category || 'General',
        walletId: e.walletId,
        flow: expenseFlow(e),
        createdAt: e.createdAt || 0,
        items: [e],
        isSplit: Boolean(e.friendId),
        personalShare: e.type === 'personal' ? e.amount : 0,
        friendShare: e.type !== 'personal' ? e.amount : 0,
        friendIds: e.friendId ? [e.friendId] : [],
        vendorId: e.vendorId,
      });
    }
  };

  const bal = useMemo(() => friend ? friendBalance(db, friend.id) : { owedToMe: 0, owedByMe: 0, net: 0 }, [db, friend]);
  
  const allExps = useMemo(() => {
    return db.expenses
      .filter(e => e.friendId === friendId || e.vendorId === friendId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [db.expenses, friendId]);

  const totalSpent = useMemo(() => friend ? contactTotalSpent(db, friend.id) : 0, [db, friend]);

  const activeExps = useMemo(() => allExps.filter(e => {
    if (e.friendId === friendId && e.type !== 'personal') return !e.settled;
    if (e.vendorId === friendId && e.status === 'unpaid') return !e.vendorSettled && (!e.settled || e.type === 'for_friend');
    if (e.vendorId === friendId && e.type === 'by_friend') return !e.vendorSettled && !e.settled;
    if (e.friendId === friendId && e.status === 'unpaid') return !e.settled;
    return !e.settled && (e.type !== 'personal' || e.status === 'unpaid');
  }), [allExps, friendId]);

  const settledExps = useMemo(() => {
    const activeSet = new Set(activeExps);
    return allExps.filter(e => !activeSet.has(e));
  }, [allExps, activeExps]);

  const shown = useMemo(() => tab === 'active' ? activeExps : settledExps, [tab, activeExps, settledExps]);

  const [tabLimits, setTabLimits] = useState<Record<string, number>>({});
  const currentLimit = tabLimits[`${friendId}_${tab}`] || 60;

  const displayedShown = useMemo(() => shown.slice(0, currentLimit), [shown, currentLimit]);

  const categories = db?.settings?.categories;
  const categoriesMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof categories>[0]>();
    (categories || []).forEach(c => map.set(c.name, c));
    return map;
  }, [categories]);

  const connectedRules = useMemo(() => {
    if (!friend) return [];
    const seen = new Set<string>();
    return (db.recurringRules || []).filter(r => {
      if (!r || !r.id) return false;
      const matches = r.friendId === friend.id || (r.title && r.title.toLowerCase().includes(friend.name.toLowerCase()));
      if (!matches) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [db.recurringRules, friend]);

  if (!friend) {
    return null;
  }

  const drawerContent = (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          display: 'flex',
          alignItems: isMobileScreen ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isMobileScreen ? 0 : 16,
        }}
      >
        {/* Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => onNavigate('friends')}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
          }}
        />

        {/* Drawer Card Modal Container (Matching image.png) */}
        <motion.div
          initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
          animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
          exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'relative',
            zIndex: 1201,
            width: '100%',
            maxWidth: '480px',
            maxHeight: 'min(88vh, 88dvh)',
            background: 'var(--drawer-bg, #141416)',
            color: 'var(--text)',
            borderRadius: isMobileScreen ? 'var(--radius-2xl) var(--radius-2xl) 0 0' : 'var(--radius-2xl)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden',
          }}
        >
          {/* Top Drag Handle Pill */}
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 'var(--radius-full)',
              background: 'var(--text-3)',
              opacity: 0.35,
              margin: '8px auto 4px',
              flexShrink: 0,
            }}
          />

          {/* Drawer Card Header */}
          <div
            style={{
              padding: '12px 16px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0,
              borderBottom: 'none',
              background: 'transparent',
            }}
          >
            {/* Contact Avatar & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <ContactAvatar
                contact={friend}
                size={44}
                fontSize="var(--fs-lg)"
                borderRadius="var(--radius-md)"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.14)' }}
              />

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, margin: 0, lineHeight: 1.2, color: 'var(--text)', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {friend.name}
                  </h2>
                  <span className={`app-contact-badge ${contactType}`}>
                    {contactType}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--text-3)',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)' }}>
                    {contactType === 'friend'
                      ? `${allExps.length} transaction${allExps.length !== 1 ? 's' : ''}`
                      : contactType === 'vendor'
                      ? `${allExps.length} order${allExps.length !== 1 ? 's' : ''}`
                      : friend.billingCycle
                      ? `${formatBillingCycleShort(friend.billingCycle)} renewal`
                      : `${allExps.length} payments`}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Action Icons: Edit & Close (Image.png circular close style) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                title="Edit Contact"
                aria-label="Edit Contact"
              >
                <Edit2 size={13} />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('friends')}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                title="Close"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Card 1: TOTAL AMOUNT / NET BALANCE STATUS Card */}
            {contactType === 'friend' ? (
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-3)' }}>
                    TOTAL NET BALANCE
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--fs-hero-sm)',
                      fontWeight: 700,
                      letterSpacing: '-0.4px',
                      color: bal.net > 0.004 ? 'var(--credit)' : bal.net < -0.004 ? 'var(--debit)' : 'var(--text)',
                      marginTop: 2,
                    }}
                  >
                    {bal.net > 0.004
                      ? `+${fmtMoney(bal.net, currency)}`
                      : bal.net < -0.004
                      ? `-${fmtMoney(Math.abs(bal.net), currency)}`
                      : fmtMoney(0, currency)}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 1, fontWeight: 500 }}>
                    {bal.net > 0.004
                      ? `${friend.name} owes you in total`
                      : bal.net < -0.004
                      ? `You owe ${friend.name} in total`
                      : 'All shared bills are settled up'}
                  </div>
                </div>

                {/* OWES YOU / YOU OWE Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                  <div
                    style={{
                      padding: '3px 9px',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: 'var(--credit)',
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>OWES YOU</span>
                    <span>{fmtMoney(bal.owedToMe, currency)}</span>
                  </div>

                  <div
                    style={{
                      padding: '3px 9px',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: 'var(--debit)',
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>YOU OWE</span>
                    <span>{fmtMoney(bal.owedByMe, currency)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.5px' }}>
                    Total Lifetime Spend
                  </span>
                  <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                    {fmtMoney(totalSpent, currency)}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons (Simplified Pill Buttons) */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowAddExp(true)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 600,
                  fontSize: 'var(--fs-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'var(--text)',
                  color: 'var(--bg)',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.16)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus size={16} strokeWidth={2.4} />
                <span>
                  {contactType === 'subscription' ? 'Log Payment' : 'Add Expense'}
                </span>
              </button>

              {contactType === 'friend' && (
                <button
                  type="button"
                  onClick={() => setShowSettle(true)}
                  style={{
                    flex: 1,
                    height: 42,
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 600,
                    fontSize: 'var(--fs-sm)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Handshake size={16} strokeWidth={2.2} />
                  <span>Settle Up</span>
                </button>
              )}
            </div>

            {/* Connected Autopay Section if present */}
            {(connectedRules.length > 0 || contactType === 'subscription') && (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: connectedRules.length > 0 ? 8 : 4, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-soft)', color: 'var(--accent)',
                      display: 'grid', placeItems: 'center', flexShrink: 0
                    }}>
                      <RefreshCw size={14} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>
                      Autopay Rules ({connectedRules.length})
                    </span>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 'var(--fs-caption)', gap: 4, padding: '3px 10px', borderRadius: 'var(--radius-full)' }}
                    onClick={() => setShowRecurringModal(true)}
                  >
                    <Plus size={11} /> Add Rule
                  </button>
                </div>

                {connectedRules.length === 0 ? (
                  <div style={{
                    borderRadius: 'var(--radius-sm)', padding: '8px 10px',
                    border: '1px dashed var(--border)', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 6, flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                      No active rule connected.
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 'var(--fs-caption)', padding: '3px 8px', gap: 4, borderRadius: 'var(--radius-full)' }}
                      onClick={() => setShowRecurringModal(true)}
                    >
                      <Zap size={11} /> Connect Rule
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {connectedRules.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                            background: r.kind === 'autopay' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                            color: r.kind === 'autopay' ? 'var(--info)' : '#d97706',
                            display: 'grid', placeItems: 'center', flexShrink: 0
                          }}>
                            {r.kind === 'autopay' ? <RefreshCw size={13} /> : <Zap size={13} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>{r.title}</div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                              {fmtMoney(r.amount, currency)} / {r.frequency}
                            </div>
                          </div>
                        </div>

                        <button
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 'var(--fs-caption)', padding: '3px 8px', gap: 3, borderRadius: 'var(--radius-full)' }}
                          onClick={() => {
                            if (r.kind === 'autopay') {
                              triggerAutopayDeduct(r.id);
                              showToast(`Deducted autopay for "${r.title}"`);
                            } else {
                              quickLogRecurringRule(r.id);
                              showToast(`Logged expense for "${r.title}"`);
                            }
                          }}
                        >
                          <Play size={10} /> Pay
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transactions Section Card */}
            <div
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Header with History Icon & Transactions Title */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '2px 2px 4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 'var(--radius-full)',
                      background: 'transparent',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text-2, #a1a1aa)',
                    }}
                  >
                    <History size={18} />
                  </div>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text)' }}>
                    Transactions
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTxDrawer(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-3)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  className="hover:text-[var(--text)] transition-colors"
                  title="View all transactions"
                >
                  <span>View all</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              {/* Expense List (Limited to 3 items for a clean, compact view with no scrolling) */}
              {allExps.length === 0 ? (
                <div
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    color: 'var(--text-3)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 500,
                  }}
                >
                  No recent expenses recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {allExps.slice(0, 3).map((e, idx) => {
                    const cat = db.settings.categories.find(c => c.name === e.category);
                    const isIn = expenseFlow(e) === 'in';
                    const isSettlement = e.category === 'Settlement' || Boolean(e.settlementId) || e.description.startsWith('Settlement');

                    const amountPrefix = isIn ? '+' : (isSettlement && e.flow === 'out' ? '-' : '');
                    const amountColor = isIn
                      ? 'var(--credit, #10b981)'
                      : (isSettlement && e.flow === 'out') || e.type === 'by_friend'
                      ? 'var(--debit, #ef4444)'
                      : 'var(--text)';

                    return (
                      <div
                        key={`${e.id}-${idx}`}
                        onClick={() => handleOpenDetail(e)}
                        style={{
                          padding: '7px 8px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          transition: 'all 0.15s ease',
                        }}
                        className="hover:bg-[rgba(255,255,255,0.07)] active:bg-[rgba(255,255,255,0.1)] active:scale-[0.99]"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                          <CategoryBadge category={e.category} color={cat?.color} icon={cat?.icon} size={14} showLabel={false} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 'var(--fs-base)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cleanExpenseDescription(e.description)}
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{fmtDate(e.originalDate || e.date)}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 'var(--fs-base)',
                              color: amountColor,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {amountPrefix}{fmtMoney(e.amount, currency)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Nested Transactions History Drawer */}
      <AnimatePresence>
        {showTxDrawer && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1300,
              display: 'flex',
              alignItems: isMobileScreen ? 'flex-end' : 'center',
              justifyContent: 'center',
              padding: isMobileScreen ? 0 : 16,
            }}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowTxDrawer(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)',
              }}
            />

            {/* Drawer Container */}
            <motion.div
              initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
              animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'relative',
                zIndex: 1301,
                width: '100%',
                maxWidth: '480px',
                maxHeight: 'min(88vh, 88dvh)',
                background: 'var(--drawer-bg, #141416)',
                color: 'var(--text)',
                borderRadius: isMobileScreen ? 'var(--radius-2xl) var(--radius-2xl) 0 0' : 'var(--radius-2xl)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                overflow: 'hidden',
              }}
            >
              {/* Top Handle Pill */}
              <div
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--text-3)',
                  opacity: 0.35,
                  margin: '8px auto 4px',
                  flexShrink: 0,
                }}
              />

              {/* Drawer Header with Friend Avatar, Name, Type Pill, and Tx Count */}
              <div
                style={{
                  padding: '12px 16px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexShrink: 0,
                  borderBottom: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <ContactAvatar
                    contact={friend}
                    size={44}
                    fontSize="var(--fs-lg)"
                    borderRadius="var(--radius-md)"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.14)' }}
                  />

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <h3
                        style={{
                          fontSize: 'var(--fs-xl)',
                          fontWeight: 700,
                          margin: 0,
                          lineHeight: 1.2,
                          color: 'var(--text)',
                          letterSpacing: '-0.3px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {friend.name}
                      </h3>
                      <span className={`app-contact-badge ${contactType}`}>
                        {contactType}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 3, fontWeight: 500 }}>
                      {contactType === 'friend'
                        ? `${allExps.length} transaction${allExps.length !== 1 ? 's' : ''}`
                        : contactType === 'vendor'
                        ? `${allExps.length} order${allExps.length !== 1 ? 's' : ''}`
                        : `${allExps.length} payment${allExps.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTxDrawer(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="Close transactions"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Drawer Body with Segmented Control & List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '10px 16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Segmented Control for Active & Settled Tabs */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 4,
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border)',
                    width: '100%',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTab('active')}
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: 'var(--fs-sm)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      background: tab === 'active' ? 'var(--text)' : 'transparent',
                      color: tab === 'active' ? 'var(--bg)' : 'var(--text-3)',
                      boxShadow: tab === 'active' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
                    }}
                  >
                    <span>Active</span>
                    <span
                      style={{
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: 'var(--radius-full)',
                        background: tab === 'active' ? 'var(--bg)' : 'rgba(255, 255, 255, 0.08)',
                        color: tab === 'active' ? 'var(--text)' : 'var(--text-3)',
                      }}
                    >
                      {activeExps.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('settled')}
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: 'var(--fs-sm)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      background: tab === 'settled' ? 'var(--text)' : 'transparent',
                      color: tab === 'settled' ? 'var(--bg)' : 'var(--text-3)',
                      boxShadow: tab === 'settled' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
                    }}
                  >
                    <span>Settled</span>
                    <span
                      style={{
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: 'var(--radius-full)',
                        background: tab === 'settled' ? 'var(--bg)' : 'rgba(255, 255, 255, 0.08)',
                        color: tab === 'settled' ? 'var(--text)' : 'var(--text-3)',
                      }}
                    >
                      {settledExps.length}
                    </span>
                  </button>
                </div>

                {/* Transactions List */}
                {shown.length === 0 ? (
                  <div
                    style={{
                      padding: '24px 16px',
                      borderRadius: 'var(--radius-lg)',
                      textAlign: 'center',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                    }}
                  >
                    <p style={{ color: 'var(--text-3)', margin: 0, fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                      {contactType === 'friend'
                        ? tab === 'active'
                          ? 'No active expenses with this friend.'
                          : 'No settled expenses yet.'
                        : 'No recorded transactions yet.'}
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    {displayedShown.map((e, idx) => {
                      const cat = categoriesMap.get(e.category);
                      const isIn = expenseFlow(e) === 'in';
                      const isSettlement = e.category === 'Settlement' || Boolean(e.settlementId) || e.description.startsWith('Settlement');

                      const amountPrefix = isIn ? '+' : (isSettlement && e.flow === 'out' ? '-' : '');
                      const amountColor = isIn
                        ? 'var(--credit, #10b981)'
                        : (isSettlement && e.flow === 'out') || e.type === 'by_friend'
                        ? 'var(--debit, #ef4444)'
                        : 'var(--text)';

                      return (
                        <div
                          key={`${e.id}-${idx}`}
                          onClick={() => handleOpenDetail(e)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            border: '1px solid transparent',
                            transition: 'all 0.16s ease-in-out',
                          }}
                          className="hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.12)] active:bg-[rgba(255,255,255,0.12)] active:scale-[0.99]"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            <CategoryBadge category={e.category} color={cat?.color} icon={cat?.icon} size={16} showLabel={false} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 'var(--fs-base)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cleanExpenseDescription(e.description)}
                              </div>
                              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span>{fmtDate(e.originalDate || e.date)}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 'var(--fs-base)',
                                color: amountColor,
                              }}
                            >
                              {amountPrefix}{fmtMoney(e.amount, currency)}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {shown.length > currentLimit && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 'var(--fs-sm)', padding: '6px 16px', borderRadius: 'var(--radius-full)' }}
                          onClick={() => setTabLimits(prev => ({
                            ...prev,
                            [`${friendId}_${tab}`]: Math.min(shown.length, currentLimit + 60),
                          }))}
                        >
                          Showing {currentLimit} of {shown.length} transactions — Load More
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals & Dialogs */}
      {selectedDetailGe && (
        <ExpenseDetailDrawer
          ge={selectedDetailGe}
          currency={currency}
          onClose={() => setSelectedDetailGe(null)}
          onEdit={(exp) => {
            setSelectedDetailGe(null);
            setEditingExpense(exp);
          }}
          onDelete={(id) => {
            setSelectedDetailGe(null);
            setDeletingExpenseId(id);
          }}
          onUndo={(id) => {
            setSelectedDetailGe(null);
            setUndoExpId(id);
          }}
        />
      )}

      {showEdit && <FriendModal friend={friend} onClose={() => setShowEdit(false)} />}
      {showSettle && <SettleModal friend={friend} onClose={() => setShowSettle(false)} />}
      {showRecurringModal && (
        <RecurringModal
          rule={{
            title: `${friend.name}`,
            amount: friend.defaultAmount || 2500,
            category: friend.category || 'Food',
            friendId: friend.id,
            kind: 'autopay',
            frequency: 'monthly',
          } as never}
          onClose={() => setShowRecurringModal(false)}
        />
      )}
      {showAddExp && (
        <ExpenseModal
          expense={{
            friendId: friend.id,
            type: contactType === 'friend' ? 'for_friend' : 'personal',
            category: friend.category || undefined,
            description: contactType === 'subscription' ? `${friend.name} Subscription` : contactType === 'vendor' ? `${friend.name}` : '',
            amount: friend.defaultAmount || undefined,
          } as never}
          onClose={() => setShowAddExp(false)}
        />
      )}
      {editingExpense && (
        <ExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}
      {deletingExpenseId && (
        <ConfirmDialog
          title="Delete Expense"
          message="Removes this expense and restores the amount to your wallet."
          onConfirm={() => {
            deleteExpense(deletingExpenseId);
            setDeletingExpenseId(null);
            showToast('Expense deleted & money restored to wallet');
          }}
          onClose={() => setDeletingExpenseId(null)}
        />
      )}
      {undoExpId && (
        <ConfirmDialog
          title="Undo Settlement"
          message="Restores your wallet balance and marks this balance as unpaid."
          confirmLabel="Undo Settlement"
          danger
          onConfirm={() => {
            unsettleExpense(undoExpId);
            setUndoExpId(null);
            showToast('Settlement undone & debt restored');
          }}
          onClose={() => setUndoExpId(null)}
        />
      )}
    </AnimatePresence>
  );

  return createPortal(drawerContent, document.body);
}
