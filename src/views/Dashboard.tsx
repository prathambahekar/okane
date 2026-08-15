import { useState, useMemo } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, Users, ReceiptText, RefreshCw, ArrowLeftRight, Store } from 'lucide-react';
import { useStore } from '../store';
import { walletBalance, totalWalletBalance, expenseFlow, personalNetAmount, monthKey, allFriendBalances } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, groupExpenses } from '../utils';
import type { Friend, ViewName } from '../types';
import { CategoryBadge } from '../components/CategoryIcon';
import TransferModal from '../components/TransferModal';

interface Props {
  onNavigate: (v: ViewName, arg?: string) => void;
  onAddExpense: () => void;
}

export default function Dashboard({ onNavigate, onAddExpense }: Props) {
  const { db } = useStore();
  const { expenses, wallets, settings: { currency } } = db;
  const [showTransfer, setShowTransfer] = useState(false);

  const now = new Date();
  const thisKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const totalBalance = useMemo(() => totalWalletBalance(db), [db]);

  const { monthSpend, monthIncome } = useMemo(() => {
    let spend = 0;
    let income = 0;
    expenses.forEach(e => {
      if (monthKey(e.date) === thisKey && e.type === 'personal') {
        spend += personalNetAmount(e);
        if (expenseFlow(e) === 'in') {
          income += Number(e.amount) || 0;
        }
      }
    });
    return { monthSpend: spend, monthIncome: income };
  }, [expenses, thisKey]);

  const { allBalances, overallCredit, overallDebt } = useMemo(() => {
    let credit = 0;
    let debt = 0;
    const balances = allFriendBalances(db);
    balances.forEach(b => {
      credit += b.owedToMe;
      debt += b.owedByMe;
    });
    return { allBalances: balances, overallCredit: credit, overallDebt: debt };
  }, [db]);

  const recentExpenses = useMemo(() => groupExpenses(expenses, db.wallets, db.friends).slice(0, 5), [expenses, db.wallets, db.friends]);

  const balancedFriends = useMemo(() =>
    allBalances
      .filter(b => Math.abs(b.net) > 0.004)
      .slice(0, 4),
    [allBalances]
  );

  const catTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.type !== 'personal' || expenseFlow(e) !== 'out') return;
      const key = monthKey(e.date);
      if (key !== thisKey) return;
      totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [expenses, thisKey]);

  const maxCat = catTotals[0]?.[1] || 1;
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost desktop-only" onClick={() => onNavigate('recurring')}>
            <RefreshCw size={15} />
            <span>Subscriptions & Autopay</span>
          </button>
          <button className="btn btn-primary desktop-only" onClick={onAddExpense}>
            <Plus size={16} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Hero Financial Overview Header Card */}
      <div className="dashboard-hero-card">
        <div className="dashboard-hero-grid">

          {/* Left Column: Total Net Worth & Interactive Wallet Chips */}
          <div className="dashboard-hero-left">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Total Net Worth
                </span>
                <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-2)', fontSize: 11 }}>
                  {wallets.length} Active Wallet{wallets.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ fontSize: 32, fontWeight: 800, color: totalBalance < 0 ? 'var(--debit)' : 'var(--text)', marginTop: 4, letterSpacing: '-0.8px' }}>
                {fmtMoney(totalBalance, currency)}
              </div>
            </div>

            {/* Quick Wallet Breakdown Chips */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Wallets Breakdown
                </div>
                {wallets.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => setShowTransfer(true)}
                    style={{
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title="Transfer funds between wallets"
                  >
                    <ArrowLeftRight size={12} /> Transfer
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {wallets.map(w => {
                  const bal = walletBalance(db, w.id);
                  return (
                    <div
                      key={w.id}
                      className="dashboard-wallet-chip"
                      onClick={() => onNavigate('wallets')}
                      title={`Click to view ${w.name} in Wallets`}
                    >
                      <span className="cat-dot" style={{ background: w.color }} />
                      <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{w.name}:</span>
                      <span style={{ fontWeight: 700, color: bal < 0 ? 'var(--debit)' : 'var(--text)' }}>{fmtMoney(bal, currency)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Month Cash Flow & Friends Net Summary */}
          <div className="dashboard-hero-right">

            {/* 3 Metric Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 10 }}>
              <div className="dashboard-mini-stat">
                <div className="dashboard-mini-stat-header">
                  <TrendingDown size={13} style={{ color: 'var(--debit)' }} /> {monthName} Spend
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--debit)' }}>
                  {fmtMoney(monthSpend, currency)}
                </div>
              </div>

              <div className="dashboard-mini-stat">
                <div className="dashboard-mini-stat-header">
                  <TrendingUp size={13} style={{ color: 'var(--credit)' }} /> {monthName} Income
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--credit)' }}>
                  {fmtMoney(monthIncome, currency)}
                </div>
              </div>

              <div className="dashboard-mini-stat">
                <div className="dashboard-mini-stat-header">
                  <Users size={13} style={{ color: (overallCredit - overallDebt) >= 0 ? 'var(--credit)' : 'var(--debit)' }} /> Friends Net
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: (overallCredit - overallDebt) >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                  {(overallCredit - overallDebt) >= 0 ? '+' : ''}{fmtMoney(overallCredit - overallDebt, currency)}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Expenses */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ReceiptText size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>Recent Expenses</h2>
            </div>
            <button className="btn-ghost btn-sm btn" onClick={() => onNavigate('expenses')} style={{ fontSize: 12, padding: '2px 8px' }}>View all →</button>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p>No expenses yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentExpenses.map((ge, idx) => {
                const cat = db.settings.categories.find(c => c.name === ge.category);
                const isIn = ge.flow === 'in' && ge.category !== 'Transfer';
                const friendsInGroup = ge.friendIds.map(fid => db.friends.find(f => f.id === fid)).filter(Boolean);
                const vendorId = ge.vendorId || ge.items.find(i => i.vendorId)?.vendorId;
                const vendor = vendorId ? db.friends.find(f => f.id === vendorId) : null;
                return (
                  <div key={ge.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 0',
                    borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                    gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <CategoryBadge category={ge.category} color={cat?.color} icon={cat?.icon} size={14} showLabel={false} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ge.description}</span>
                          {vendor && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: 'var(--surface2)',
                                color: 'var(--text-2)',
                                border: '1px solid var(--border)',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                flexShrink: 0
                              }}
                              title={`Vendor: ${vendor.name}`}
                            >
                              <Store size={9} style={{ color: 'var(--accent)' }} />
                              {vendor.name}
                            </span>
                          )}
                          {ge.isSplit && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>Split</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                          {fmtDate(ge.date)} · {ge.category}
                          {friendsInGroup.length > 0 ? ` · ${friendsInGroup.map(f => f?.name).join(', ')}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, flexShrink: 0, color: isIn ? 'var(--credit)' : undefined }}>
                      {isIn ? '+' : ''}{fmtMoney(ge.totalAmount, currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Friend Balances */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>Friends</h2>
            </div>
            <button className="btn-ghost btn-sm btn" onClick={() => onNavigate('friends')} style={{ fontSize: 12, padding: '2px 8px' }}>View all →</button>
          </div>
          {balancedFriends.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 12.5, padding: '12px 0' }}>All settled up!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {balancedFriends.map(({ friend, net }: { friend: Friend; net: number }) => (
                <div key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => onNavigate('friend-detail', friend.id)}>
                  <div className="avatar avatar-sm" style={{ ...getAvatarStyle(friend.color), width: 22, height: 22, fontSize: 10 }}>{friendInitial(friend.name, friend.avatarNumber)}</div>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{friend.name}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: net > 0 ? 'var(--credit)' : 'var(--debit)' }}>
                      {net > 0 ? '+' : ''}{fmtMoney(net, currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wallets */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wallet size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>Wallets</h2>
            </div>
            <button className="btn-ghost btn-sm btn" onClick={() => onNavigate('wallets')} style={{ fontSize: 12, padding: '2px 8px' }}>Manage →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {wallets.map(w => {
              const bal = walletBalance(db, w.id);
              return (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: w.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12.5 }}>{w.name}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: bal < 0 ? 'var(--debit)' : 'var(--text)' }}>{fmtMoney(bal, currency)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Spend */}
      {catTotals.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top Categories — {monthName}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catTotals.map(([cat, total]) => {
              const catObj = db.settings.categories.find(c => c.name === cat);
              const catColor = catObj?.color ?? '#6B7280';
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CategoryBadge category={cat} color={catColor} icon={catObj?.icon} size={14} />
                    </div>
                    <span style={{ fontWeight: 600 }}>{fmtMoney(total, currency)}</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${(total / maxCat) * 100}%`, background: catColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TransferModal
        isOpen={showTransfer}
        onClose={() => setShowTransfer(false)}
      />
    </div>
  );
}
