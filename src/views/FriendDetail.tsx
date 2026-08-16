import { useState, useMemo } from 'react';
import { ArrowLeft, Handshake, Plus, ChevronDown, ChevronUp, Edit2, Trash2, Store, Tv, ExternalLink, RefreshCw, Zap, Play } from 'lucide-react';
import { useStore } from '../store';
import { friendBalance, expenseFlow, contactTotalSpent } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, typeLabel, cleanExpenseDescription, formatBillingCycleShort } from '../utils';
import type { ViewName, Expense } from '../types';
import FriendModal from '../components/FriendModal';
import { renderBrandLogo } from '../components/BrandIcons';
import { CategoryBadge } from '../components/CategoryIcon';
import SettleModal from '../components/SettleModal';
import ExpenseModal from '../components/ExpenseModal';
import RecurringModal from '../components/RecurringModal';
import ConfirmDialog from '../components/ConfirmDialog';

interface Props {
  friendId: string;
  onNavigate: (v: ViewName, arg?: string) => void;
}

export default function FriendDetail({ friendId, onNavigate }: Props) {
  const { db, deleteExpense, triggerAutopayDeduct, quickLogRecurringRule, showToast } = useStore();
  const { settings: { currency } } = db;
  const friend = db.friends.find(f => f.id === friendId);

  const [showEdit, setShowEdit] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [tab, setTab] = useState<'active' | 'settled'>('active');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const contactType = friend?.type || 'friend';

  const bal = useMemo(() => friend ? friendBalance(db, friend.id) : { owedToMe: 0, owedByMe: 0, net: 0 }, [db, friend]);
  const allExps = useMemo(() =>
    db.expenses
      .filter(e => e.friendId === friendId || e.vendorId === friendId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [db.expenses, friendId]
  );

  const totalSpent = useMemo(() => friend ? contactTotalSpent(db, friend.id) : 0, [db, friend]);
  const avgOrderVal = useMemo(() => allExps.length > 0 ? totalSpent / allExps.length : 0, [totalSpent, allExps]);

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

  const dateGroupInfo = useMemo(() => {
    const groupMap: Record<string, number> = {};
    const isFirstMap: Record<string, boolean> = {};
    let currentGroup = 0;
    let prevDate: string | null = null;

    shown.forEach((e) => {
      if (prevDate !== null && e.date !== prevDate) {
        currentGroup++;
        isFirstMap[e.id] = true;
      } else {
        isFirstMap[e.id] = prevDate === null;
      }
      groupMap[e.id] = currentGroup % 2;
      prevDate = e.date;
    });

    return { groupMap, isFirstMap };
  }, [shown]);

  const connectedRules = useMemo(() => {
    if (!friend) return [];
    return (db.recurringRules || []).filter(
      r => r.friendId === friend.id || (r.title && r.title.toLowerCase().includes(friend.name.toLowerCase()))
    );
  }, [db.recurringRules, friend]);

  if (!friend) {
    return (
      <div className="view-container">
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('friends')}>
          <ArrowLeft size={16} /> Back to Contacts
        </button>
        <div className="card" style={{ marginTop: 20 }}>
          <div className="empty-state"><p>Contact not found.</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Hero Profile & Stats Card */}
      <div
        className="card"
        style={{
          padding: '16px 18px',
          marginBottom: 16,
          background: 'var(--accent-gradient-soft), var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 4px 16px -4px var(--accent-soft)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <div
              className="avatar"
              style={{
                ...getAvatarStyle(friend.color),
                width: 44,
                height: 44,
                fontSize: 18,
                fontWeight: 700,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
              }}
            >
              {contactType === 'subscription' ? (
                renderBrandLogo(friend.name, 22) || <Tv size={20} />
              ) : contactType === 'vendor' ? (
                <Store size={20} />
              ) : (
                friendInitial(friend.name, friend.avatarNumber)
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{friend.name}</h2>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    background:
                      contactType === 'vendor'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : contactType === 'subscription'
                        ? 'var(--accent-soft)'
                        : 'var(--accent-soft)',
                    color:
                      contactType === 'vendor'
                        ? '#D97706'
                        : contactType === 'subscription'
                        ? 'var(--accent)'
                        : 'var(--accent)',
                  }}
                >
                  {contactType}
                </span>
              </div>

              {friend.website && (
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={friend.website.startsWith('http') ? friend.website : `https://${friend.website}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                  >
                    <span>Website</span> <ExternalLink size={11} />
                  </a>
                </div>
              )}
              {friend.notes && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, fontStyle: 'italic' }}>
                  {friend.notes}
                </div>
              )}
            </div>
          </div>

          {/* Edit Contact: icon-only inside card */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowEdit(true)}
            title="Edit Contact"
            aria-label="Edit Contact"
            style={{
              padding: '7px',
              width: 34,
              height: 34,
              borderRadius: '9px',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text-2)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Edit2 size={15} />
          </button>
        </div>

        {/* Dynamic Hero Banner for Contact Type */}
        {contactType === 'friend' ? (
          /* Friend Net Balance Banner Box */
          <div
            style={{
              background: bal.net > 0.004
                ? 'var(--credit-bg)'
                : bal.net < -0.004
                  ? 'var(--debit-bg)'
                  : 'var(--surface2)',
              border: `1px solid ${bal.net > 0.004
                ? 'var(--credit-border)'
                : bal.net < -0.004
                  ? 'var(--debit-border)'
                  : 'var(--border)'
                }`,
              borderRadius: 'var(--radius-sm, 8px)',
              padding: '8px 12px',
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
                Net Balance Status
              </span>
              <div style={{ fontSize: 18, fontWeight: 700, color: bal.net > 0.004 ? 'var(--credit)' : bal.net < -0.004 ? 'var(--debit)' : 'var(--text-2)', marginTop: 0 }}>
                {bal.net > 0.004 ? fmtMoney(bal.net, currency) : bal.net < -0.004 ? fmtMoney(Math.abs(bal.net), currency) : 'Settled Up ✓'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 0 }}>
                {bal.net > 0.004 ? `${friend.name} owes you in total` : bal.net < -0.004 ? `You owe ${friend.name} in total` : 'All shared bills are settled'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Owes You</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--credit)', marginTop: 1 }}>{fmtMoney(bal.owedToMe, currency)}</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)', height: 20 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>You Owe</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--debit)', marginTop: 1 }}>{fmtMoney(bal.owedByMe, currency)}</div>
              </div>
            </div>
          </div>
        ) : contactType === 'vendor' ? (
          /* Vendor Hero Stats Box */
          <div>
            {Math.abs(bal.net) > 0.004 && (
              <div
                style={{
                  background: bal.net > 0.004 ? 'var(--credit-bg)' : 'var(--debit-bg)',
                  border: `1px solid ${bal.net > 0.004 ? 'var(--credit-border)' : 'var(--debit-border)'}`,
                  borderRadius: 'var(--radius-sm, 8px)',
                  padding: '8px 12px',
                  marginBottom: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>
                    Outstanding Balance
                  </span>
                  <div style={{ fontSize: 17, fontWeight: 700, color: bal.net > 0.004 ? 'var(--credit)' : 'var(--debit)', marginTop: 0 }}>
                    {bal.net > 0.004 ? fmtMoney(bal.net, currency) : fmtMoney(Math.abs(bal.net), currency)}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: bal.net > 0.004 ? 'var(--credit)' : 'var(--debit)' }}>
                  {bal.net > 0.004 ? 'Owes You' : 'You Owe Vendor'}
                </div>
              </div>
            )}
            <div
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm, 8px)',
                padding: '10px 14px',
                marginBottom: 12,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: 10,
              }}
            >
              <div>
                <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Total Spent</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginTop: 1 }}>
                  {fmtMoney(totalSpent, currency)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Total Orders</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginTop: 1 }}>
                  {allExps.length}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Avg / Order</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginTop: 1 }}>
                  {fmtMoney(avgOrderVal, currency)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Category</span>
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    {friend.category || 'General'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Subscription Hero Stats Box */
          <div
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm, 8px)',
              padding: '10px 14px',
              marginBottom: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 10,
            }}
          >
            <div>
              <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Plan Cost</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginTop: 1 }}>
                {friend.defaultAmount ? fmtMoney(friend.defaultAmount, currency) : 'Flexible'} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-3)' }}>/ {formatBillingCycleShort(friend.billingCycle)}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Lifetime Spend</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginTop: 1 }}>
                {fmtMoney(totalSpent, currency)}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Total Payments</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginTop: 1 }}>
                {allExps.length}
              </div>
            </div>
          </div>
        )}

        {/* Primary Action Buttons with Accent Gradient & Compact Design */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={{
              flex: 1,
              padding: '9px 12px',
              fontSize: 12.5,
              fontWeight: 600,
              gap: 5,
              justifyContent: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 'var(--radius, 12px)',
              border: 'none',
              background: 'var(--accent-gradient)',
              color: 'var(--accent-contrast, #ffffff)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 10px var(--accent-soft)',
              transition: 'opacity 0.15s ease',
            }}
            onClick={() => setShowAddExp(true)}
          >
            <Plus size={15} /> {contactType === 'vendor' ? 'Log Purchase' : contactType === 'subscription' ? 'Log Payment' : 'Add Expense'}
          </button>

          {activeExps.length > 0 && (
            <button
              style={{
                flex: 1,
                padding: '9px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                gap: 5,
                justifyContent: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 'var(--radius, 12px)',
                border: '1px solid var(--credit-border)',
                background: 'var(--credit-bg)',
                color: 'var(--credit)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setShowSettle(true)}
            >
              <Handshake size={15} /> Settle Up
            </button>
          )}
        </div>
      </div>

      {/* Connected Autopay & Subscriptions Section - Only show when rules exist or contact is a subscription */}
      {(connectedRules.length > 0 || contactType === 'subscription') && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: connectedRules.length > 0 ? 12 : 8, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.15)', color: 'var(--info)',
                display: 'grid', placeItems: 'center', flexShrink: 0
              }}>
                <RefreshCw size={17} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                  Autopay & Subscriptions ({connectedRules.length})
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0 0' }}>
                  Recurring rules & automated billing for {friend.name}
                </p>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11.5, gap: 5, padding: '5px 12px' }}
              onClick={() => setShowRecurringModal(true)}
            >
              <Plus size={14} /> Add Autopay Rule
            </button>
          </div>

          {connectedRules.length === 0 ? (
            <div style={{
              background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px',
              border: '1px dashed var(--border2)', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 10, flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                No active autopay or subscription rule connected to {friend.name} yet.
              </span>
              <button
                className="btn btn-primary btn-sm"
                style={{ fontSize: 11.5, padding: '5px 12px', gap: 5 }}
                onClick={() => setShowRecurringModal(true)}
              >
                <Zap size={13} /> Connect Autopay Rule
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {connectedRules.map(r => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--surface2)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    gap: 10,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: r.kind === 'autopay' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                      color: r.kind === 'autopay' ? 'var(--info)' : '#d97706',
                      display: 'grid', placeItems: 'center', flexShrink: 0
                    }}>
                      {r.kind === 'autopay' ? <RefreshCw size={16} /> : <Zap size={16} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{r.title}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                          background: r.kind === 'autopay' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(251, 191, 36, 0.12)',
                          color: r.kind === 'autopay' ? 'var(--info)' : '#d97706',
                          textTransform: 'uppercase'
                        }}>
                          {r.kind === 'autopay' ? 'Autopay' : 'Custom'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                        {fmtMoney(r.amount, currency)} / {r.frequency}
                        {r.nextDueDate && ` · Next due: ${r.nextDueDate}`}
                        {r.lastDeductedDate && ` · Last paid: ${r.lastDeductedDate}`}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 12, padding: '5px 12px', gap: 5 }}
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
                    <Play size={13} /> {r.kind === 'autopay' ? 'Deduct / Pay Now' : 'Log Now'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transactions List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          {(contactType === 'friend' || activeExps.length > 0 || settledExps.length > 0) ? (
            <div className="tab-list" style={{ marginBottom: 0, padding: 4, background: 'var(--surface2)', borderRadius: 10 }}>
              <button className={`tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600 }}>
                Active ({activeExps.length})
              </button>
              <button className={`tab-btn ${tab === 'settled' ? 'active' : ''}`} onClick={() => setTab('settled')} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600 }}>
                Settled ({settledExps.length})
              </button>
            </div>
          ) : (
            <div style={{ fontWeight: 600, fontSize: 14, padding: '2px 0' }}>
              Payment & Order History ({allExps.length})
            </div>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <p>{contactType === 'friend' ? (tab === 'active' ? 'No active expenses with this friend.' : 'No settled expenses yet.') : 'No recorded transactions yet.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-wrapper desktop-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(e => {
                    const cat = db.settings.categories.find(c => c.name === e.category);
                    const isIn = expenseFlow(e) === 'in';
                    const isEvenGroup = dateGroupInfo.groupMap[e.id] === 0;
                    const isFirstOfDate = dateGroupInfo.isFirstMap[e.id];
                    const rowClass = `${isEvenGroup ? 'date-row-even' : 'date-row-odd'}${isFirstOfDate ? ' date-row-first' : ''}`;

                    const isVendorView = e.vendorId === friendId;
                    const isIncome = expenseFlow(e) === 'in' && e.type === 'personal';
                    const isSettled = isVendorView
                      ? Boolean(e.vendorSettled || (e.status === 'paid' && e.vendorSettled !== false))
                      : Boolean(e.settled);
                    const isPartial = isVendorView
                      ? Boolean(e.vendorSettledAmount && e.vendorSettledAmount > 0 && !e.vendorSettled)
                      : Boolean((e.settledAmount && e.settledAmount > 0 && !e.settled) || (e.originalAmount && Math.abs(e.originalAmount - e.amount) > 0.01 && e.settled));
                    const statusKey = isIncome
                      ? 'none'
                      : (isSettled ? (isPartial ? 'partial' : 'settled') : (isPartial ? 'partial' : (e.type === 'personal' && e.status === 'paid' ? 'paid' : (e.status || 'unsettled'))));
                    const itemStatusLabel = isIncome
                      ? ''
                      : (isSettled
                        ? (isPartial ? 'Partially Settled' : 'Settled')
                        : (isPartial ? 'Partially Settled' : (e.type === 'personal' && e.status === 'paid' ? 'Paid' : (e.status === 'unpaid' ? 'Unpaid' : 'Unsettled'))));

                    return (
                      <tr key={e.id} className={rowClass}>
                        <td style={{ fontWeight: 500, fontSize: 13 }}>{cleanExpenseDescription(e.description)}</td>
                        <td style={{ fontWeight: 500, color: contactType === 'friend' ? (isIn ? 'var(--credit)' : e.type === 'by_friend' ? 'var(--debit)' : undefined) : 'var(--text-1)' }}>
                          {contactType === 'friend' ? (isIn ? '+' : '') : ''}{fmtMoney(e.amount, currency)}
                          {e.originalAmount && Math.abs(e.originalAmount - e.amount) > 0.01 ? (
                            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                              og {fmtMoney(e.originalAmount, currency)}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(e.originalDate || e.date)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{typeLabel(e.type, contactType)}</td>
                        <td>
                          <CategoryBadge category={e.category} color={cat?.color} icon={cat?.icon} />
                        </td>
                        <td>
                          {statusKey !== 'none' && itemStatusLabel ? (
                            <span className={`badge badge-${statusKey}`}>
                              {itemStatusLabel}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button className="btn-icon" onClick={() => setEditingExpense(e)} title="Edit"><Edit2 size={15} /></button>
                            <button className="btn-icon" onClick={() => setDeletingExpenseId(e.groupId || e.id)} title="Delete" style={{ color: 'var(--debit)' }}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Expandable Cards View */}
            <div className="mobile-expense-list mobile-only">
              {shown.map(e => {
                const cat = db.settings.categories.find(c => c.name === e.category);
                const wallet = db.wallets.find(w => w.id === e.walletId);
                const isIn = expenseFlow(e) === 'in';
                const isExpanded = !!expandedIds[e.id];
                const isEvenGroup = dateGroupInfo.groupMap[e.id] === 0;
                const isFirstOfDate = dateGroupInfo.isFirstMap[e.id];
                const cardClass = `mobile-expense-card ${isEvenGroup ? 'date-card-even' : 'date-card-odd'}${isFirstOfDate ? ' date-card-first' : ''}${isExpanded ? ' is-expanded' : ''}`;

                const isVendorView = e.vendorId === friendId;
                const isIncome = expenseFlow(e) === 'in' && e.type === 'personal';
                const isSettled = isVendorView
                  ? Boolean(e.vendorSettled || (e.status === 'paid' && e.vendorSettled !== false))
                  : Boolean(e.settled);
                const isPartial = isVendorView
                  ? Boolean(e.vendorSettledAmount && e.vendorSettledAmount > 0 && !e.vendorSettled)
                  : Boolean((e.settledAmount && e.settledAmount > 0 && !e.settled) || (e.originalAmount && Math.abs(e.originalAmount - e.amount) > 0.01 && e.settled));
                const statusKey = isIncome
                  ? 'none'
                  : (isSettled ? (isPartial ? 'partial' : 'settled') : (isPartial ? 'partial' : (e.type === 'personal' && e.status === 'paid' ? 'paid' : (e.status || 'unsettled'))));
                const itemStatusLabel = isIncome
                  ? ''
                  : (isSettled
                    ? (isPartial ? 'Partially Settled' : 'Settled')
                    : (isPartial ? 'Partially Settled' : (e.type === 'personal' && e.status === 'paid' ? 'Paid' : (e.status === 'unpaid' ? 'Unpaid' : 'Unsettled'))));

                return (
                  <div key={e.id} className={cardClass}>
                    <div className="mobile-expense-header" onClick={() => toggleExpand(e.id)}>
                      <div className="mobile-expense-top">
                        <div className="mobile-expense-desc-wrap">
                          <CategoryBadge category={e.category} color={cat?.color} icon={cat?.icon} size={13} showLabel={false} />
                          <span className="mobile-expense-title">{e.description}</span>
                        </div>
                        <div className="mobile-expense-amount" style={{ color: contactType === 'friend' ? (isIn ? 'var(--credit)' : e.type === 'by_friend' ? 'var(--debit)' : undefined) : 'var(--text-1)', textAlign: 'right' }}>
                          {contactType === 'friend' ? (isIn ? '+' : '') : ''}{fmtMoney(e.amount, currency)}
                          {e.originalAmount ? (
                            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>
                              og {fmtMoney(e.originalAmount, currency)}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mobile-expense-meta">
                        <div className="mobile-expense-meta-left" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span>{fmtDate(e.date)}</span>
                          <span>·</span>
                          <span>{e.category}</span>
                          {statusKey !== 'none' && itemStatusLabel && (
                            <span className={`badge badge-${statusKey}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                              {itemStatusLabel}
                            </span>
                          )}
                        </div>
                        <div className="mobile-expense-expand-btn">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mobile-expense-details">
                        <div className="mobile-expense-detail-grid">
                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Category</span>
                            <span className="mobile-expense-detail-val">
                              <CategoryBadge category={e.category} color={cat?.color} icon={cat?.icon} size={13} />
                            </span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Wallet</span>
                            <span className="mobile-expense-detail-val">{wallet?.name ?? '—'}</span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Type</span>
                            <span className="mobile-expense-detail-val">{typeLabel(e.type, contactType)}</span>
                          </div>

                          {statusKey !== 'none' && itemStatusLabel && (
                            <div className="mobile-expense-detail-item">
                              <span className="mobile-expense-detail-label">Status</span>
                              <span className="mobile-expense-detail-val">
                                <span className={`badge badge-${statusKey}`}>{itemStatusLabel}</span>
                              </span>
                            </div>
                          )}

                          {e.notes && (
                            <div className="mobile-expense-detail-item" style={{ gridColumn: '1 / -1' }}>
                              <span className="mobile-expense-detail-label">Notes</span>
                              <span className="mobile-expense-detail-val" style={{ fontWeight: 400, fontStyle: 'italic' }}>{e.notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="mobile-expense-actions" style={{ marginTop: 12 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingExpense(e)}>
                            <Edit2 size={14} /> Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeletingExpenseId(e.groupId || e.id)}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

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
          message="Are you sure you want to delete this expense? Any amount deducted from your wallet will be added back automatically."
          onConfirm={() => {
            deleteExpense(deletingExpenseId);
            setDeletingExpenseId(null);
            showToast('Expense deleted & money restored to wallet');
          }}
          onClose={() => setDeletingExpenseId(null)}
        />
      )}
    </div>
  );
}
