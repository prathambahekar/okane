import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { expenseFlow, friendBalance } from '../db';
import { fmtMoney, fmtMonth, friendInitial } from '../utils';
import { CategoryBadge } from '../components/CategoryIcon';

type TimeFrame = 'this_month' | '3_months' | '6_months' | 'this_year' | 'all';

export default function Analytics() {
  const { db } = useStore();
  const { expenses, friends, settings: { currency } } = db;
  const [timeframe, setTimeframe] = useState<TimeFrame>('6_months');

  const now = new Date();

  // Date filtering logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (e.type !== 'personal') return false;
      const expDate = new Date(e.date);
      switch (timeframe) {
        case 'this_month':
          return expDate.getFullYear() === now.getFullYear() && expDate.getMonth() === now.getMonth();
        case '3_months': {
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          return expDate >= threeMonthsAgo;
        }
        case '6_months': {
          const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          return expDate >= sixMonthsAgo;
        }
        case 'this_year':
          return expDate.getFullYear() === now.getFullYear();
        case 'all':
        default:
          return true;
      }
    });
  }, [expenses, timeframe, now]);

  // Key Financial Metrics
  const totalSpent = useMemo(() =>
    filteredExpenses.filter(e => expenseFlow(e) === 'out').reduce((s, e) => s + Number(e.amount), 0),
  [filteredExpenses]);

  const totalIncome = useMemo(() =>
    filteredExpenses.filter(e => expenseFlow(e) === 'in').reduce((s, e) => s + Number(e.amount), 0),
  [filteredExpenses]);

  const netSavings = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100) : 0;

  const daysInPeriod = useMemo(() => {
    switch (timeframe) {
      case 'this_month': return Math.max(1, now.getDate());
      case '3_months': return 90;
      case '6_months': return 180;
      case 'this_year': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const diffTime = Math.abs(now.getTime() - startOfYear.getTime());
        return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }
      case 'all': default: {
        if (expenses.length === 0) return 30;
        const dates = expenses.map(e => new Date(e.date).getTime());
        const minDate = Math.min(...dates);
        const diffDays = Math.ceil((now.getTime() - minDate) / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
      }
    }
  }, [timeframe, now, expenses]);

  const dailyAvgSpend = totalSpent / daysInPeriod;

  const largestExpense = useMemo(() => {
    const spentList = filteredExpenses.filter(e => expenseFlow(e) === 'out');
    if (spentList.length === 0) return null;
    return spentList.reduce((max, e) => (Number(e.amount) > Number(max.amount) ? e : max), spentList[0]);
  }, [filteredExpenses]);

  // Monthly Bar Chart Data
  const monthlyChartData = useMemo(() => {
    const monthCount = timeframe === 'this_month' ? 1 : timeframe === '3_months' ? 3 : timeframe === 'this_year' ? now.getMonth() + 1 : 6;
    const months: string[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }

    return months.map(key => {
      const mExps = expenses.filter(e => e.date.startsWith(key) && e.type === 'personal');
      const spend = mExps.filter(e => expenseFlow(e) === 'out').reduce((s, e) => s + Number(e.amount), 0);
      const income = mExps.filter(e => expenseFlow(e) === 'in').reduce((s, e) => s + Number(e.amount), 0);
      return { key, spend, income };
    });
  }, [expenses, timeframe, now]);

  const maxMonthlyVal = Math.max(...monthlyChartData.map(m => Math.max(m.spend, m.income)), 1);

  // Category Distribution & Transaction Averages
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    filteredExpenses.forEach(e => {
      if (expenseFlow(e) !== 'out') return;
      if (!map[e.category]) map[e.category] = { amount: 0, count: 0 };
      map[e.category].amount += Number(e.amount);
      map[e.category].count += 1;
    });

    return Object.entries(map)
      .map(([cat, data]) => ({
        cat,
        amount: data.amount,
        count: data.count,
        avg: data.amount / data.count,
        pct: totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, totalSpent]);

  // Friend Balances Overview
  const friendBalances = useMemo(() =>
    friends
      .map(f => ({ friend: f, ...friendBalance(db, f.id) }))
      .filter(b => Math.abs(b.net) > 0.004)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    [db, friends]
  );
  const maxFriendNet = Math.max(...friendBalances.map(b => Math.abs(b.net)), 1);

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Meaningful financial insights & spending patterns</p>
        </div>
      </div>

      {/* Timeframe Filter Tabs */}
      <div className="tab-list" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${timeframe === 'this_month' ? 'active' : ''}`} onClick={() => setTimeframe('this_month')}>
          This Month
        </button>
        <button className={`tab-btn ${timeframe === '3_months' ? 'active' : ''}`} onClick={() => setTimeframe('3_months')}>
          Last 3 Months
        </button>
        <button className={`tab-btn ${timeframe === '6_months' ? 'active' : ''}`} onClick={() => setTimeframe('6_months')}>
          Last 6 Months
        </button>
        <button className={`tab-btn ${timeframe === 'this_year' ? 'active' : ''}`} onClick={() => setTimeframe('this_year')}>
          This Year
        </button>
        <button className={`tab-btn ${timeframe === 'all' ? 'active' : ''}`} onClick={() => setTimeframe('all')}>
          All Time
        </button>
      </div>

      {/* Financial Health Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value debit">{fmtMoney(totalSpent, currency)}</div>
          <div className="stat-sub">Avg {fmtMoney(dailyAvgSpend, currency)}/day</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Income</div>
          <div className="stat-value credit">{fmtMoney(totalIncome, currency)}</div>
          <div className="stat-sub">{filteredExpenses.filter(e => expenseFlow(e) === 'in').length} income records</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Net Cash Flow</div>
          <div className={`stat-value ${netSavings >= 0 ? 'credit' : 'debit'}`}>
            {netSavings >= 0 ? '+' : ''}{fmtMoney(netSavings, currency)}
          </div>
          <div className="stat-sub">{netSavings >= 0 ? 'Surplus / Saved' : 'Deficit / Overspent'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Savings Rate</div>
          <div className={`stat-value ${savingsRate >= 20 ? 'credit' : savingsRate < 0 ? 'debit' : 'text-accent'}`}>
            {totalIncome > 0 ? `${savingsRate}%` : 'N/A'}
          </div>
          <div className="stat-sub">
            {totalIncome > 0
              ? savingsRate >= 20 ? 'Great savings rate!' : savingsRate >= 0 ? 'Moderate savings' : 'Spending exceeds income'
              : 'Add income to track'}
          </div>
        </div>
      </div>

      {/* Highlights Banner */}
      {largestExpense && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--surface2)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Largest Single Expense</span>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{largestExpense.description}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{largestExpense.category} · {largestExpense.date}</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--debit)' }}>
            {fmtMoney(largestExpense.amount, currency)}
          </div>
        </div>
      )}

      {/* Grid: Monthly Trend Chart & Category Breakdown */}
      <div className="dashboard-grid">
        {/* Monthly Trend Chart */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Monthly Income vs Spend</h2>
          {monthlyChartData.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>No data for this period</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 170, paddingTop: 10 }}>
                {monthlyChartData.map(m => (
                  <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4, width: '100%' }}>
                      <div
                        style={{
                          flex: 1,
                          background: 'var(--debit)',
                          borderRadius: '3px 3px 0 0',
                          height: `${(m.spend / maxMonthlyVal) * 100}%`,
                          opacity: 0.85,
                          transition: 'height 0.3s ease',
                        }}
                        title={`Spend: ${fmtMoney(m.spend, currency)}`}
                      />
                      <div
                        style={{
                          flex: 1,
                          background: 'var(--credit)',
                          borderRadius: '3px 3px 0 0',
                          height: `${(m.income / maxMonthlyVal) * 100}%`,
                          opacity: 0.85,
                          transition: 'height 0.3s ease',
                        }}
                        title={`Income: ${fmtMoney(m.income, currency)}`}
                      />
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 6, fontWeight: 500 }}>
                      {fmtMonth(m.key + '-01').slice(0, 3)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, color: 'var(--text-2)', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: 'var(--debit)', borderRadius: 2 }} />
                  <span>Spent</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: 'var(--credit)', borderRadius: 2 }} />
                  <span>Received</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Category Share</h2>
          {categoryBreakdown.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>No expenses recorded</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {categoryBreakdown.slice(0, 6).map(({ cat, amount, pct }) => {
                const catObj = db.settings.categories.find(c => c.name === cat);
                const catColor = catObj?.color ?? '#6B7280';
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <CategoryBadge category={cat} color={catColor} icon={catObj?.icon} size={14} />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ color: 'var(--text-3)' }}>{Math.round(pct)}%</span>
                        <span style={{ fontWeight: 600 }}>{fmtMoney(amount, currency)}</span>
                      </div>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: catColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Category Deep Details Table */}
      {categoryBreakdown.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
            Detailed Category Breakdown ({timeframe.replace('_', ' ')})
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total Spent</th>
                  <th>Share</th>
                  <th>Transactions</th>
                  <th>Avg / Transaction</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map(({ cat, amount, pct, count, avg }) => {
                  const catObj = db.settings.categories.find(c => c.name === cat);
                  const catColor = catObj?.color ?? '#6B7280';
                  return (
                    <tr key={cat}>
                      <td>
                        <CategoryBadge category={cat} color={catColor} icon={catObj?.icon} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmtMoney(amount, currency)}</td>
                      <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{Math.round(pct)}%</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{count} transaction{count !== 1 ? 's' : ''}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>{fmtMoney(avg, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Friend Social Balance Breakdown */}
      {friendBalances.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Social Owed / Debt Overview</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {friendBalances.map(({ friend, net, owedToMe, owedByMe }) => (
              <div key={friend.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div className="avatar avatar-sm" style={{ background: friend.color }}>{friendInitial(friend.name)}</div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{friend.name}</span>
                  {owedToMe > 0 && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>owes {fmtMoney(owedToMe, currency)}</span>}
                  {owedByMe > 0 && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>you owe {fmtMoney(owedByMe, currency)}</span>}
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: net > 0 ? 'var(--credit)' : 'var(--debit)' }}>
                    {net > 0 ? '+' : ''}{fmtMoney(net, currency)}
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${(Math.abs(net) / maxFriendNet) * 100}%`, background: net > 0 ? 'var(--credit)' : 'var(--debit)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

