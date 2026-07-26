import { useState, useMemo } from 'react';
import { ArrowLeft, Handshake, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store';
import { friendBalance, expenseFlow } from '../db';
import { fmtMoney, fmtDate, friendInitial, typeLabel, statusLabel } from '../utils';
import type { ViewName } from '../types';
import FriendModal from '../components/FriendModal';
import SettleModal from '../components/SettleModal';
import ExpenseModal from '../components/ExpenseModal';

interface Props {
  friendId: string;
  onNavigate: (v: ViewName, arg?: string) => void;
}

export default function FriendDetail({ friendId, onNavigate }: Props) {
  const { db } = useStore();
  const { settings: { currency } } = db;
  const friend = db.friends.find(f => f.id === friendId);

  const [showEdit, setShowEdit] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [tab, setTab] = useState<'active' | 'settled'>('active');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const bal = useMemo(() => friend ? friendBalance(db, friend.id) : { owedToMe: 0, owedByMe: 0, net: 0 }, [db, friend]);
  const allExps = useMemo(() =>
    db.expenses
      .filter(e => e.friendId === friendId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [db.expenses, friendId]
  );
  const activeExps = allExps.filter(e => !e.settled);
  const settledExps = allExps.filter(e => e.settled);
  const shown = tab === 'active' ? activeExps : settledExps;

  // const handleShareReminder = () => {
  //   if (!friend) return;
  //   const msg = bal.net > 0
  //     ? `Hey ${friend.name}! Quick reminder: You owe me ${fmtMoney(bal.owedToMe, currency)} on Okane for shared expenses. Let me know when you settle up!`
  //     : `Hey ${friend.name}! I owe you ${fmtMoney(bal.owedByMe, currency)} on Okane. Let me know how you'd like to get paid!`;

  //   navigator.clipboard.writeText(msg);
  //   showToast('Payment request copied to clipboard!');
  // };

  if (!friend) {
    return (
      <div className="view-container">
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('friends')}>
          <ArrowLeft size={16} /> Back to Friends
        </button>
        <div className="card" style={{ marginTop: 20 }}>
          <div className="empty-state"><p>Friend not found.</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Back Button & Secondary Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('friends')} style={{ gap: 6 }}>
          <ArrowLeft size={18} /> Back to Friends
        </button>



      </div>

      {/* Profile & Net Balance Hero Card */}
      <div
        className="card"
        style={{
          padding: '18px 20px',
          marginBottom: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div
            className="avatar"
            style={{
              background: friend.color,
              width: 50,
              height: 50,
              fontSize: 20,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {friendInitial(friend.name)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{friend.name}</h2>
            {(friend.email || friend.phone) && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {friend.email}{friend.email && friend.phone ? ' · ' : ''}{friend.phone}
              </div>
            )}
            {friend.notes && (
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, fontStyle: 'italic' }}>
                {friend.notes}
              </div>
            )}
          </div>
        </div>

        {/* Hero Net Balance Banner Box */}
        <div
          style={{
            background: bal.net > 0.004
              ? 'rgba(34, 197, 94, 0.08)'
              : bal.net < -0.004
                ? 'rgba(239, 68, 68, 0.08)'
                : 'var(--surface2)',
            border: `1px solid ${bal.net > 0.004
              ? 'rgba(34, 197, 94, 0.22)'
              : bal.net < -0.004
                ? 'rgba(239, 68, 68, 0.22)'
                : 'var(--border2)'
              }`,
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)' }}>
              Net Balance Status
            </span>
            <div style={{ fontSize: 24, fontWeight: 700, color: bal.net > 0.004 ? 'var(--credit)' : bal.net < -0.004 ? 'var(--debit)' : 'var(--text-2)', marginTop: 2 }}>
              {bal.net > 0.004 ? `+${fmtMoney(bal.net, currency)}` : bal.net < -0.004 ? `-${fmtMoney(-bal.net, currency)}` : 'Settled Up ✓'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
              {bal.net > 0.004 ? `${friend.name} owes you in total` : bal.net < -0.004 ? `You owe ${friend.name} in total` : 'All shared bills are settled'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Owes You</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--credit)', marginTop: 1 }}>{fmtMoney(bal.owedToMe, currency)}</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)', height: 26 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>You Owe</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--debit)', marginTop: 1 }}>{fmtMoney(bal.owedByMe, currency)}</div>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, padding: '9px 14px', fontSize: 13, gap: 6, justifyContent: 'center' }}
            onClick={() => setShowAddExp(true)}
          >
            <Plus size={16} /> Add Shared Expense
          </button>

          {activeExps.length > 0 && (
            <button
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: '9px 14px',
                fontSize: 13,
                gap: 6,
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
              }}
              onClick={() => setShowSettle(true)}
            >
              <Handshake size={16} /> Settle Up
            </button>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 18px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="tab-list" style={{ marginBottom: 0 }}>
            <button className={`tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
              Active ({activeExps.length})
            </button>
            <button className={`tab-btn ${tab === 'settled' ? 'active' : ''}`} onClick={() => setTab('settled')}>
              Settled ({settledExps.length})
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <p>{tab === 'active' ? 'No active expenses with this friend.' : 'No settled expenses yet.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <table className="data-table desktop-only">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(e => {
                  const cat = db.settings.categories.find(c => c.name === e.category);
                  const isIn = expenseFlow(e) === 'in';
                  return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{e.description}</td>
                      <td style={{ fontWeight: 500, color: isIn ? 'var(--credit)' : e.type === 'by_friend' ? 'var(--debit)' : undefined }}>
                        {isIn ? '+' : ''}{fmtMoney(e.amount, currency)}
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(e.date)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{typeLabel(e.type)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cat && <span className="cat-dot" style={{ background: cat.color }} />}
                          <span style={{ fontSize: 12 }}>{e.category}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${e.settled ? 'settled' : e.status}`}>
                          {e.settled ? 'Settled' : e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Expandable Cards View */}
            <div className="mobile-expense-list mobile-only">
              {shown.map(e => {
                const cat = db.settings.categories.find(c => c.name === e.category);
                const wallet = db.wallets.find(w => w.id === e.walletId);
                const isIn = expenseFlow(e) === 'in';
                const statusKey = e.settled ? 'settled' : e.status;
                const isExpanded = !!expandedIds[e.id];

                return (
                  <div key={e.id} className={`mobile-expense-card ${isExpanded ? 'is-expanded' : ''}`}>
                    <div className="mobile-expense-header" onClick={() => toggleExpand(e.id)}>
                      <div className="mobile-expense-top">
                        <div className="mobile-expense-desc-wrap">
                          {cat && <span className="cat-dot" style={{ background: cat.color }} />}
                          <span className="mobile-expense-title">{e.description}</span>
                        </div>
                        <div className="mobile-expense-amount" style={{ color: isIn ? 'var(--credit)' : e.type === 'by_friend' ? 'var(--debit)' : undefined }}>
                          {isIn ? '+' : ''}{fmtMoney(e.amount, currency)}
                        </div>
                      </div>

                      <div className="mobile-expense-meta">
                        <div className="mobile-expense-meta-left">
                          <span>{fmtDate(e.date)}</span>
                          <span>·</span>
                          <span>{e.category}</span>
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
                              {cat && <span className="cat-dot" style={{ background: cat.color }} />}
                              {e.category}
                            </span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Wallet</span>
                            <span className="mobile-expense-detail-val">{wallet?.name ?? '—'}</span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Type</span>
                            <span className="mobile-expense-detail-val">{typeLabel(e.type)}</span>
                          </div>

                          <div className="mobile-expense-detail-item">
                            <span className="mobile-expense-detail-label">Status</span>
                            <span className="mobile-expense-detail-val">
                              <span className={`badge badge-${statusKey}`}>{statusLabel(statusKey)}</span>
                            </span>
                          </div>

                          {e.notes && (
                            <div className="mobile-expense-detail-item" style={{ gridColumn: '1 / -1' }}>
                              <span className="mobile-expense-detail-label">Notes</span>
                              <span className="mobile-expense-detail-val" style={{ fontWeight: 400, fontStyle: 'italic' }}>{e.notes}</span>
                            </div>
                          )}
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
      {showAddExp && <ExpenseModal expense={{ friendId: friend.id, type: 'for_friend' } as never} onClose={() => setShowAddExp(false)} />}
    </div>
  );
}
