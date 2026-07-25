import { useMemo } from 'react';
import AddIcon from '@mui/icons-material/Add';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useStore } from '../store';
import { friendBalance, walletBalance, totalWalletBalance, expenseFlow, personalNetAmount, monthKey } from '../db';
import { fmtMoney, fmtDate, friendInitial, generateInsights } from '../utils';
import type { Friend, ViewName } from '../types';

interface Props {
  onNavigate: (v: ViewName, arg?: string) => void;
  onAddExpense: () => void;
}

export default function Dashboard({ onNavigate, onAddExpense }: Props) {
  const { db } = useStore();
  const { expenses, friends, wallets, settings: { currency } } = db;

  const now = new Date();
  const thisKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const totalBalance = totalWalletBalance(db);

  const monthExpenses = expenses.filter(e => monthKey(e.date) === thisKey && e.type === 'personal');
  const monthSpend = monthExpenses.reduce((s, e) => s + personalNetAmount(e), 0);
  const monthIncome = monthExpenses.filter(e => expenseFlow(e) === 'in').reduce((s, e) => s + Number(e.amount), 0);

  const overallCredit = friends.reduce((s, f) => {
    const b = friendBalance(db, f.id);
    return s + b.owedToMe;
  }, 0);
  const overallDebt = friends.reduce((s, f) => {
    const b = friendBalance(db, f.id);
    return s + b.owedByMe;
  }, 0);

  const recentExpenses = [...expenses].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  const balancedFriends = useMemo(() =>
    friends
      .map(f => ({ friend: f, ...friendBalance(db, f.id) }))
      .filter(b => Math.abs(b.net) > 0.004)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 4),
    [db, friends]
  );

  const insights = useMemo(() =>
    generateInsights(expenses, friends, (id) => friendBalance(db, id), currency),
    [expenses, friends, db, currency]
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
          <p className="page-subtitle">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="btn btn-primary desktop-only" onClick={onAddExpense}>
          <AddIcon fontSize="small" /> Add Expense
        </button>
      </div>

      {/* Hero Financial Overview Header Card */}
      <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', background: 'var(--surface)' }}>

          {/* Left Column: Total Net Worth & Interactive Wallet Chips */}
          <div style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.06) 0%, rgba(52, 211, 153, 0.04) 100%)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16
          }}>
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
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Wallets Breakdown
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {wallets.map(w => {
                  const bal = walletBalance(db, w.id);
                  return (
                    <div
                      key={w.id}
                      onClick={() => onNavigate('wallets')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 11.5,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
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
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>

            {/* 3 Metric Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.18)', borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingDownIcon style={{ fontSize: 13, color: 'var(--debit)' }} /> {monthName} Spend
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--debit)', marginTop: 4 }}>
                  {fmtMoney(monthSpend, currency)}
                </div>
              </div>

              <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.18)', borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUpIcon style={{ fontSize: 13, color: 'var(--credit)' }} /> {monthName} Income
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--credit)', marginTop: 4 }}>
                  {fmtMoney(monthIncome, currency)}
                </div>
              </div>

              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Friends Net
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: (overallCredit - overallDebt) >= 0 ? 'var(--credit)' : 'var(--debit)', marginTop: 4 }}>
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
              <ReceiptLongIcon style={{ fontSize: 18, color: 'var(--accent)' }} />
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
              {recentExpenses.map((e, idx) => {
                const cat = db.settings.categories.find(c => c.name === e.category);
                const friend = e.friendId ? db.friends.find(f => f.id === e.friendId) : null;
                const isIn = expenseFlow(e) === 'in';
                return (
                  <div key={e.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 0',
                    borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                    gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <span className="cat-dot" style={{ background: cat?.color ?? '#6B7280', display: 'block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{e.category}{friend ? ` · ${friend.name}` : ''} · {fmtDate(e.date)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, flexShrink: 0, color: isIn ? 'var(--credit)' : undefined }}>
                      {isIn ? '+' : ''}{fmtMoney(e.amount, currency)}
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
              <PeopleIcon style={{ fontSize: 18, color: 'var(--accent)' }} />
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
                  <div className="avatar avatar-sm" style={{ background: friend.color, width: 22, height: 22, fontSize: 10 }}>{friendInitial(friend.name)}</div>
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
              <AccountBalanceWalletIcon style={{ fontSize: 18, color: 'var(--accent)' }} />
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
              const catColor = db.settings.categories.find(c => c.name === cat)?.color ?? '#6B7280';
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="cat-dot" style={{ background: catColor }} />
                      <span>{cat}</span>
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

      {/* Insights */}
      {insights.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Insights</h2>
          <div className="insight-list">
            {insights.map((ins, i) => (
              <div key={i} className="insight-item">
                <span className="insight-dot" style={{ background: ins.tone === 'up' ? 'var(--debit)' : ins.tone === 'down' ? 'var(--credit)' : 'var(--info)' }} />
                <span dangerouslySetInnerHTML={{ __html: ins.html }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
