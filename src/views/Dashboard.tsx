import { useMemo } from 'react';
import AddIcon from '@mui/icons-material/Add';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
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

  const recentExpenses = [...expenses].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  const balancedFriends = useMemo(() =>
    friends
      .map(f => ({ friend: f, ...friendBalance(db, f.id) }))
      .filter(b => Math.abs(b.net) > 0.004)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 5),
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
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [expenses, thisKey]);

  const maxCat = catTotals[0]?.[1] || 1;
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <button className="btn btn-primary" onClick={onAddExpense}>
          <AddIcon fontSize="small" /> Add Expense
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Balance</div>
          <div className={`stat-value ${totalBalance < 0 ? 'debit' : ''}`}>{fmtMoney(totalBalance, currency)}</div>
          <div className="stat-sub">{wallets.length} wallet{wallets.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{monthName} Spend</div>
          <div className="stat-value">{fmtMoney(monthSpend, currency)}</div>
          <div className="stat-sub">{monthExpenses.filter(e => expenseFlow(e) === 'out').length} transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{monthName} Income</div>
          <div className="stat-value credit">{fmtMoney(monthIncome, currency)}</div>
          <div className="stat-sub">Received this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">You're Owed</div>
          <div className="stat-value credit">{fmtMoney(overallCredit, currency)}</div>
          <div className="stat-sub" style={{ color: overallDebt > 0 ? 'var(--debit)' : undefined }}>
            {overallDebt > 0 ? `You owe ${fmtMoney(overallDebt, currency)}` : 'No outstanding debt'}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Expenses */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Recent Expenses</h2>
            <button className="btn-ghost btn-sm btn" onClick={() => onNavigate('expenses')} style={{ fontSize: 12, padding: '4px 10px' }}>View all →</button>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px' }}>
              <p>No expenses yet. Add your first one!</p>
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
                    padding: '10px 0',
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Friend Balances</h2>
            <button className="btn-ghost btn-sm btn" onClick={() => onNavigate('friends')} style={{ fontSize: 12, padding: '4px 10px' }}>View all →</button>
          </div>
          {balancedFriends.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>All settled up!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {balancedFriends.map(({ friend, net }: { friend: Friend; net: number }) => (
                <div key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => onNavigate('friend-detail', friend.id)}>
                  <div className="avatar avatar-sm" style={{ background: friend.color }}>{friendInitial(friend.name)}</div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{friend.name}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: net > 0 ? 'var(--credit)' : 'var(--debit)' }}>
                      {net > 0 ? '+' : ''}{fmtMoney(net, currency)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{net > 0 ? 'owes you' : 'you owe'}</div>
                  </div>
                  {net > 0 ? <TrendingUpIcon fontSize="small" style={{ color: 'var(--credit)' }} /> : <TrendingDownIcon fontSize="small" style={{ color: 'var(--debit)' }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wallets */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Wallets</h2>
            <button className="btn-ghost btn-sm btn" onClick={() => onNavigate('wallets')} style={{ fontSize: 12, padding: '4px 10px' }}>Manage →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {wallets.map(w => {
              const bal = walletBalance(db, w.id);
              return (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: w.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{w.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: bal < 0 ? 'var(--debit)' : 'var(--text)' }}>{fmtMoney(bal, currency)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Spend */}
      {catTotals.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Top Categories — {monthName}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catTotals.map(([cat, total]) => {
              const catColor = db.settings.categories.find(c => c.name === cat)?.color ?? '#6B7280';
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="cat-dot" style={{ background: catColor }} />
                      <span>{cat}</span>
                    </div>
                    <span style={{ fontWeight: 500 }}>{fmtMoney(total, currency)}</span>
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
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Insights</h2>
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
