import { useState, useMemo } from 'react';
import { ArrowLeft, Handshake, Plus, ChevronDown, ChevronUp, Edit2, Store, Tv, ExternalLink } from 'lucide-react';
import { useStore } from '../store';
import { friendBalance, expenseFlow, contactTotalSpent } from '../db';
import { fmtMoney, fmtDate, friendInitial, typeLabel, statusLabel } from '../utils';
import type { ViewName } from '../types';
import FriendModal from '../components/FriendModal';
import { renderBrandLogo } from '../components/BrandIcons';
import { CategoryBadge } from '../components/CategoryIcon';
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

  const contactType = friend?.type || 'friend';

  const bal = useMemo(() => friend ? friendBalance(db, friend.id) : { owedToMe: 0, owedByMe: 0, net: 0 }, [db, friend]);
  const allExps = useMemo(() =>
    db.expenses
      .filter(e => e.friendId === friendId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [db.expenses, friendId]
  );

  const totalSpent = useMemo(() => friend ? contactTotalSpent(db, friend.id) : 0, [db, friend]);
  const avgOrderVal = useMemo(() => allExps.length > 0 ? totalSpent / allExps.length : 0, [totalSpent, allExps]);

  const activeExps = allExps.filter(e => !e.settled);
  const settledExps = allExps.filter(e => e.settled);
  const shown = contactType === 'friend' ? (tab === 'active' ? activeExps : settledExps) : allExps;

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
      {/* Back Button & Secondary Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('friends')} style={{ gap: 6 }}>
          <ArrowLeft size={18} /> Back to Contacts
        </button>

        <button className="btn btn-secondary btn-sm" style={{ gap: 6 }} onClick={() => setShowEdit(true)}>
          <Edit2 size={14} /> Edit Contact
        </button>
      </div>

      {/* Hero Profile & Stats Card */}
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
              background: friend.color || '#3B82F6',
              width: 50,
              height: 50,
              fontSize: 20,
              fontWeight: 700,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {contactType === 'subscription' ? (
              renderBrandLogo(friend.name, 26) || <Tv size={24} />
            ) : contactType === 'vendor' ? (
              <Store size={24} />
            ) : (
              friendInitial(friend.name)
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{friend.name}</h2>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  background:
                    contactType === 'vendor'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : contactType === 'subscription'
                      ? 'rgba(168, 85, 247, 0.15)'
                      : 'rgba(59, 130, 246, 0.15)',
                  color:
                    contactType === 'vendor'
                      ? '#D97706'
                      : contactType === 'subscription'
                      ? '#9333EA'
                      : 'var(--accent)',
                }}
              >
                {contactType}
              </span>
            </div>

            {(friend.email || friend.phone || friend.website) && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {friend.email && <span>{friend.email}</span>}
                {friend.phone && <span>· {friend.phone}</span>}
                {friend.website && (
                  <a
                    href={friend.website.startsWith('http') ? friend.website : `https://${friend.website}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                  >
                    <span>Website</span> <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
            {friend.notes && (
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, fontStyle: 'italic' }}>
                {friend.notes}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Hero Banner for Contact Type */}
        {contactType === 'friend' ? (
          /* Friend Net Balance Banner Box */
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
                {bal.net > 0.004 ? fmtMoney(bal.net, currency) : bal.net < -0.004 ? fmtMoney(Math.abs(bal.net), currency) : 'Settled Up ✓'}
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
        ) : contactType === 'vendor' ? (
          /* Vendor Hero Stats Box */
          <div>
            {Math.abs(bal.net) > 0.004 && (
              <div
                style={{
                  background: bal.net > 0.004 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${bal.net > 0.004 ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)'}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>
                    Outstanding Balance
                  </span>
                  <div style={{ fontSize: 20, fontWeight: 700, color: bal.net > 0.004 ? 'var(--credit)' : 'var(--debit)', marginTop: 2 }}>
                    {bal.net > 0.004 ? fmtMoney(bal.net, currency) : fmtMoney(Math.abs(bal.net), currency)}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: bal.net > 0.004 ? 'var(--credit)' : 'var(--debit)' }}>
                  {bal.net > 0.004 ? 'Owes You' : 'You Owe Vendor'}
                </div>
              </div>
            )}
            <div
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 16,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Total Spent</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>
                  {fmtMoney(totalSpent, currency)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Total Orders</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>
                  {allExps.length}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Avg / Order</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>
                  {fmtMoney(avgOrderVal, currency)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Category</span>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)' }}>
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
              background: 'rgba(168, 85, 247, 0.06)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Plan Cost</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#9333EA', marginTop: 2 }}>
                {friend.defaultAmount ? fmtMoney(friend.defaultAmount, currency) : 'Flexible'} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>/ {friend.billingCycle || 'mo'}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Lifetime Spend</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>
                {fmtMoney(totalSpent, currency)}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)' }}>Total Payments</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>
                {allExps.length}
              </div>
            </div>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, padding: '9px 14px', fontSize: 13, gap: 6, justifyContent: 'center' }}
            onClick={() => setShowAddExp(true)}
          >
            <Plus size={16} /> {contactType === 'vendor' ? 'Log Vendor Purchase' : contactType === 'subscription' ? 'Log Subscription Payment' : 'Add Shared Expense'}
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
          {(contactType === 'friend' || activeExps.length > 0 || settledExps.length > 0) ? (
            <div className="tab-list" style={{ marginBottom: 0 }}>
              <button className={`tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
                Active ({activeExps.length})
              </button>
              <button className={`tab-btn ${tab === 'settled' ? 'active' : ''}`} onClick={() => setTab('settled')}>
                Settled ({settledExps.length})
              </button>
            </div>
          ) : (
            <div style={{ fontWeight: 600, fontSize: 14, paddingBottom: 10 }}>
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
                      <td style={{ fontWeight: 500, color: contactType === 'friend' ? (isIn ? 'var(--credit)' : e.type === 'by_friend' ? 'var(--debit)' : undefined) : 'var(--text-1)' }}>
                        {contactType === 'friend' ? (isIn ? '+' : '') : ''}{fmtMoney(e.amount, currency)}
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(e.date)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{typeLabel(e.type)}</td>
                      <td>
                        <CategoryBadge category={e.category} color={cat?.color} icon={cat?.icon} />
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
                          <CategoryBadge category={e.category} color={cat?.color} icon={cat?.icon} size={13} showLabel={false} />
                          <span className="mobile-expense-title">{e.description}</span>
                        </div>
                        <div className="mobile-expense-amount" style={{ color: contactType === 'friend' ? (isIn ? 'var(--credit)' : e.type === 'by_friend' ? 'var(--debit)' : undefined) : 'var(--text-1)' }}>
                          {contactType === 'friend' ? (isIn ? '+' : '') : ''}{fmtMoney(e.amount, currency)}
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
                              <CategoryBadge category={e.category} color={cat?.color} icon={cat?.icon} size={13} />
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
    </div>
  );
}
