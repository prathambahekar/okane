import { useMemo } from 'react';
import { useStore } from '../store';
import { expenseFlow, friendBalance, personalNetAmount, monthKey } from '../db';
import { fmtMoney, fmtMonth, friendInitial } from '../utils';

export default function Analytics() {
  const { db } = useStore();
  const { expenses, friends, settings: { currency } } = db;

  const now = new Date();
  const last6Months = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return months;
  }, []);

  const monthlyData = useMemo(() =>
    last6Months.map(key => {
      const mExps = expenses.filter(e => monthKey(e.date) === key && e.type === 'personal');
      const spend = mExps.filter(e => expenseFlow(e) === 'out').reduce((s, e) => s + Number(e.amount), 0);
      const income = mExps.filter(e => expenseFlow(e) === 'in').reduce((s, e) => s + Number(e.amount), 0);
      return { key, spend, income };
    }), [expenses, last6Months]);

  const maxMonthly = Math.max(...monthlyData.map(m => Math.max(m.spend, m.income)), 1);

  const catData = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.type !== 'personal' || expenseFlow(e) !== 'out') return;
      totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
    });
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({ cat, amount, pct: total > 0 ? (amount / total) * 100 : 0 }));
  }, [expenses]);

  const totalSpend = catData.reduce((s, c) => s + c.amount, 0);

  const friendBalances = useMemo(() =>
    friends
      .map(f => ({ friend: f, ...friendBalance(db, f.id) }))
      .filter(b => Math.abs(b.net) > 0.004)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8),
    [db, friends]
  );
  const maxFriendNet = Math.max(...friendBalances.map(b => Math.abs(b.net)), 1);

  const thisKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const lastKey = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  })();

  const thisMonthSpend = expenses.filter(e => monthKey(e.date) === thisKey && e.type === 'personal').reduce((s, e) => s + personalNetAmount(e), 0);
  const lastMonthSpend = expenses.filter(e => monthKey(e.date) === lastKey && e.type === 'personal').reduce((s, e) => s + personalNetAmount(e), 0);
  const pctChange = lastMonthSpend > 0 ? ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100 : 0;

  const totalIncome = expenses.filter(e => e.type === 'personal' && expenseFlow(e) === 'in').reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = expenses.filter(e => e.type === 'personal' && expenseFlow(e) === 'out').reduce((s, e) => s + Number(e.amount), 0);

  const creditMonths: Record<string, number> = {};
  expenses.forEach(e => {
    if (e.type !== 'personal' || expenseFlow(e) !== 'out') return;
    creditMonths[monthKey(e.date)] = (creditMonths[monthKey(e.date)] || 0) + Number(e.amount);
  });
  const avgMonthlySpend = Object.values(creditMonths).length
    ? Object.values(creditMonths).reduce((a, b) => a + b, 0) / Object.values(creditMonths).length
    : 0;

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Spending insights across all time</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value">{fmtMoney(totalOut, currency)}</div>
          <div className="stat-sub">All time personal</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Income</div>
          <div className="stat-value credit">{fmtMoney(totalIncome, currency)}</div>
          <div className="stat-sub">All time received</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Monthly Spend</div>
          <div className="stat-value">{fmtMoney(avgMonthlySpend, currency)}</div>
          <div className="stat-sub">Personal expenses</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">vs Last Month</div>
          <div className={`stat-value ${pctChange > 0 ? 'debit' : pctChange < 0 ? 'credit' : ''}`}>
            {pctChange === 0 ? '—' : `${pctChange > 0 ? '+' : ''}${Math.round(pctChange)}%`}
          </div>
          <div className="stat-sub">{fmtMoney(thisMonthSpend, currency)} this month</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Monthly bar chart */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Monthly Spend vs Income</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
            {monthlyData.map(m => (
              <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, width: '100%' }}>
                  <div style={{ flex: 1, background: 'var(--debit)', borderRadius: '3px 3px 0 0', height: `${(m.spend / maxMonthly) * 100}%`, opacity: 0.8 }} title={`Spend: ${fmtMoney(m.spend, currency)}`} />
                  <div style={{ flex: 1, background: 'var(--credit)', borderRadius: '3px 3px 0 0', height: `${(m.income / maxMonthly) * 100}%`, opacity: 0.8 }} title={`Income: ${fmtMoney(m.income, currency)}`} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{fmtMonth(m.key + '-01').slice(0, 3)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, background: 'var(--debit)', borderRadius: 2 }} />Spend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, background: 'var(--credit)', borderRadius: 2 }} />Income</div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Category Breakdown</h2>
          {catData.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No data yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {catData.slice(0, 7).map(({ cat, amount, pct }) => {
                const catColor = db.settings.categories.find(c => c.name === cat)?.color ?? '#6B7280';
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span className="cat-dot" style={{ background: catColor }} />
                        <span>{cat}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ color: 'var(--text-3)' }}>{Math.round(pct)}%</span>
                        <span style={{ fontWeight: 500 }}>{fmtMoney(amount, currency)}</span>
                      </div>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: catColor }} />
                    </div>
                  </div>
                );
              })}
              {catData.length > 7 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>+{catData.length - 7} more categories</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Friend balances */}
      {friendBalances.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Friend Balances Overview</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {friendBalances.map(({ friend, net, owedToMe, owedByMe }) => (
              <div key={friend.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <div className="avatar avatar-sm" style={{ background: friend.color }}>{friendInitial(friend.name)}</div>
                  <span style={{ flex: 1, fontSize: 13 }}>{friend.name}</span>
                  {owedToMe > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>owes {fmtMoney(owedToMe, currency)}</span>}
                  {owedByMe > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>you owe {fmtMoney(owedByMe, currency)}</span>}
                  <span style={{ fontWeight: 600, fontSize: 13, color: net > 0 ? 'var(--credit)' : 'var(--debit)' }}>
                    {net > 0 ? '+' : ''}{fmtMoney(net, currency)}
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill"
                    style={{ width: `${(Math.abs(net) / maxFriendNet) * 100}%`, background: net > 0 ? 'var(--credit)' : 'var(--debit)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top categories table */}
      {catData.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>All Categories (All Time)</div>
          <table className="data-table">
            <thead><tr><th>#</th><th>Category</th><th>Total Spent</th><th>Share</th><th></th></tr></thead>
            <tbody>
              {catData.map(({ cat, amount, pct }, i) => {
                const catColor = db.settings.categories.find(c => c.name === cat)?.color ?? '#6B7280';
                return (
                  <tr key={cat}>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="cat-dot" style={{ background: catColor }} />
                        <span style={{ fontSize: 13 }}>{cat}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{fmtMoney(amount, currency)}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{Math.round(pct)}%</td>
                    <td style={{ width: 120 }}>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: catColor }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Total personal spend</span>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{fmtMoney(totalSpend, currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
