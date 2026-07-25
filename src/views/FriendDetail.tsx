import { useState, useMemo } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import HandshakeIcon from '@mui/icons-material/Handshake';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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

  if (!friend) {
    return (
      <div className="view-container">
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('friends')}><ArrowBackIcon fontSize="small" /> Back to Friends</button>
        <div className="card" style={{ marginTop: 20 }}><div className="empty-state"><p>Friend not found.</p></div></div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('friends')}>
          <ArrowBackIcon fontSize="small" /> Back to Friends
        </button>
      </div>

      {/* Profile */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="avatar avatar-lg" style={{ background: friend.color, width: 56, height: 56, fontSize: 22 }}>
            {friendInitial(friend.name)}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{friend.name}</div>
            {friend.email && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{friend.email}</div>}
            {friend.phone && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{friend.phone}</div>}
            {friend.notes && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>{friend.notes}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', maxWidth: 360 }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setShowEdit(true)}><EditIcon fontSize="small" /> Edit</button>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setShowAddExp(true)}><AddIcon fontSize="small" /> Add Expense</button>
            {activeExps.length > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowSettle(true)} style={{ flex: '1 1 100%', background: 'linear-gradient(135deg, #34D399, #10B981)' }}>
                <HandshakeIcon fontSize="small" /> Settle Up
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Owes You</div>
          <div className="stat-value credit">{fmtMoney(bal.owedToMe, currency)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">You Owe</div>
          <div className="stat-value debit">{fmtMoney(bal.owedByMe, currency)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Balance</div>
          <div className={`stat-value ${bal.net > 0 ? 'credit' : bal.net < 0 ? 'debit' : ''}`}>
            {bal.net >= 0 ? '+' : ''}{fmtMoney(bal.net, currency)}
          </div>
          <div className="stat-sub">{bal.net > 0.004 ? `${friend.name} owes you` : bal.net < -0.004 ? 'You owe' : 'Settled'}</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 20px 0', borderBottom: '1px solid var(--border)' }}>
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
              <thead><tr><th>Description</th><th>Amount</th><th>Date</th><th>Type</th><th>Category</th><th>Status</th></tr></thead>
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
                      <td><span className={`badge badge-${e.settled ? 'settled' : e.status}`}>{e.settled ? 'Settled' : e.status.charAt(0).toUpperCase() + e.status.slice(1)}</span></td>
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
                          <span>{e.category}</span>
                          <span>·</span>
                          <span>{fmtDate(e.date)}</span>
                        </div>
                        <div className="mobile-expense-expand-btn">
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
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

