import { useState, useMemo } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, Users, ReceiptText, ArrowLeftRight, Store, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../store';
import { walletBalance, totalWalletBalance, expenseFlow, personalNetAmount, monthKey, allFriendBalances } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, groupExpenses, type GroupedExpense } from '../utils';
import type { Friend, ViewName, Expense } from '../types';
import { CategoryBadge } from '../components/CategoryIcon';
import TransferModal from '../components/TransferModal';
import { ExpenseDetailDrawer } from '../components/ExpenseDetailDrawer';
import ExpenseModal from '../components/ExpenseModal';
import ConfirmDialog from '../components/ConfirmDialog';

interface Props {
  onNavigate: (v: ViewName, arg?: string) => void;
  onAddExpense: () => void;
}

export default function Dashboard({ onNavigate, onAddExpense }: Props) {
  const { db, updateSettings, deleteExpense, showToast } = useStore();
  const { expenses, wallets, settings: { currency } } = db;
  const hideAmounts = db.settings?.hideAmounts ?? (typeof localStorage !== 'undefined' && localStorage.getItem('hide_amounts') === 'true');
  const visibleWallets = useMemo(() => wallets.filter(w => !w.isHidden), [wallets]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedDetailGe, setSelectedDetailGe] = useState<GroupedExpense | null>(null);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

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
          <button className="btn btn-primary desktop-only" onClick={onAddExpense}>
            <Plus size={16} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Hero Financial Overview Header Card */}
      <div className="dashboard-hero-card">
        <div className="dashboard-hero-content">

          {/* Top/Left Section: Total Net Worth & Interactive Wallet Chips */}
          <div className="dashboard-hero-top">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Total Net Worth
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateSettings({ hideAmounts: !hideAmounts });
                    }}
                    title={hideAmounts ? "Privacy Mode ON (Click to show amounts)" : "Privacy Mode OFF (Click to hide amounts)"}
                    style={{
                      background: hideAmounts ? 'var(--accent-soft)' : 'var(--surface2)',
                      border: `1px solid ${hideAmounts ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 999,
                      padding: '2px 8px',
                      color: hideAmounts ? 'var(--accent)' : 'var(--text-3)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10.5,
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      lineHeight: 1,
                    }}
                  >
                    {hideAmounts ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{hideAmounts ? 'Hidden' : 'Hide'}</span>
                  </button>
                </div>
                <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-2)', fontSize: 11 }}>
                  {visibleWallets.length} Active Wallet{visibleWallets.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ fontSize: 32, fontWeight: 800, color: totalBalance < 0 ? 'var(--debit)' : 'var(--text)', marginTop: 4, letterSpacing: '-0.8px' }}>
                {fmtMoney(totalBalance, currency, hideAmounts)}
              </div>
            </div>

            {/* Quick Wallet Breakdown Chips */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Wallets Breakdown
                </div>
                {visibleWallets.length >= 2 && (
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
                      padding: '3px 9px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title="Transfer funds between wallets"
                  >
                    <ArrowLeftRight size={12} /> Transfer
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {visibleWallets.map(w => {
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
                      <span style={{ fontWeight: 700, color: bal < 0 ? 'var(--debit)' : 'var(--text)' }}>{fmtMoney(bal, currency, hideAmounts)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stats Section: 3 Mini Metric Cards Grid */}
          <div className="dashboard-hero-stats">
            <div className="dashboard-stats-grid">
              <div className="dashboard-mini-stat">
                <div className="dashboard-mini-stat-header">
                  <TrendingDown size={14} style={{ color: 'var(--debit)' }} />
                  <span>{monthName.toUpperCase()} SPEND</span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--debit)' }}>
                  {fmtMoney(monthSpend, currency, hideAmounts)}
                </div>
              </div>

              <div className="dashboard-mini-stat">
                <div className="dashboard-mini-stat-header">
                  <TrendingUp size={14} style={{ color: 'var(--credit)' }} />
                  <span>{monthName.toUpperCase()} INCOME</span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--credit)' }}>
                  {fmtMoney(monthIncome, currency, hideAmounts)}
                </div>
              </div>

              <div className="dashboard-mini-stat">
                <div className="dashboard-mini-stat-header">
                  <Users size={14} style={{ color: (overallCredit - overallDebt) >= 0 ? 'var(--credit)' : 'var(--debit)' }} />
                  <span>FRIENDS NET</span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: (overallCredit - overallDebt) >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                  {(overallCredit - overallDebt) >= 0 ? '+' : ''}{fmtMoney(overallCredit - overallDebt, currency, hideAmounts)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Expenses */}
        <div className="card" style={{ gridColumn: '1 / -1', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, width: '100%', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              <ReceiptText size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Recent Expenses</h2>
            </div>
            <button className="btn-view-all" onClick={() => onNavigate('expenses')}>
              <span>View all</span>
              <ArrowRight size={13} className="btn-view-all-arrow" />
            </button>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p>No expenses yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
              {recentExpenses.map((ge, idx) => {
                const cat = db.settings.categories.find(c => c.name === ge.category);
                const isIn = ge.flow === 'in' && ge.category !== 'Transfer';
                const friendsInGroup = ge.friendIds.map(fid => db.friends.find(f => f.id === fid)).filter(Boolean);
                const vendorId = ge.vendorId || ge.items.find(i => i.vendorId)?.vendorId;
                const vendor = vendorId ? db.friends.find(f => f.id === vendorId) : null;
                return (
                  <div
                    key={ge.id}
                    onClick={() => setSelectedDetailGe(ge)}
                    role="button"
                    tabIndex={0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 0',
                      borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                      gap: 10,
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDetailGe(ge);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                      <CategoryBadge category={ge.category} color={cat?.color} icon={cat?.icon} size={14} showLabel={false} />
                      <div style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                        <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, width: '100%' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>{ge.description}</span>
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
                                flexShrink: 0,
                                maxWidth: '110px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={`Vendor: ${vendor.name}`}
                            >
                              <Store size={9} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendor.name}</span>
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
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                          {fmtDate(ge.date)} · {ge.category}
                          {friendsInGroup.length > 0 ? ` · ${friendsInGroup.map(f => f?.name).join(', ')}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: isIn ? 'var(--credit)' : undefined }}>
                      {isIn ? '+' : ''}{fmtMoney(ge.totalAmount, currency, hideAmounts)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Friend Balances */}
        <div className="card" style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, width: '100%', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              <Users size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Friends</h2>
            </div>
            <button className="btn-view-all" onClick={() => onNavigate('friends')}>
              <span>View all</span>
              <ArrowRight size={13} className="btn-view-all-arrow" />
            </button>
          </div>
          {balancedFriends.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 12.5, padding: '12px 0' }}>All settled up!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0 }}>
              {balancedFriends.map(({ friend, net }: { friend: Friend; net: number }) => (
                <div key={friend.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                  onClick={() => onNavigate('friend-detail', friend.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <div className="avatar avatar-sm" style={{ ...getAvatarStyle(friend.color), width: 22, height: 22, fontSize: 10, flexShrink: 0 }}>{friendInitial(friend.name, friend.avatarNumber)}</div>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{friend.name}</span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: net > 0 ? 'var(--credit)' : 'var(--debit)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {net > 0 ? '+' : ''}{fmtMoney(net, currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wallets */}
        <div className="card" style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, width: '100%', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              <Wallet size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <h2 style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Wallets</h2>
            </div>
            <button className="btn-view-all" onClick={() => onNavigate('wallets')}>
              <span>Manage</span>
              <ArrowRight size={13} className="btn-view-all-arrow" />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0 }}>
            {wallets.map(w => {
              const bal = walletBalance(db, w.id);
              return (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: w.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{w.name}</span>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: bal < 0 ? 'var(--debit)' : 'var(--text)', flexShrink: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(bal, currency)}</span>
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

      {selectedDetailGe && (
        <ExpenseDetailDrawer
          ge={selectedDetailGe}
          currency={currency}
          onClose={() => setSelectedDetailGe(null)}
          onEdit={(exp) => {
            setSelectedDetailGe(null);
            setEditExp(exp);
          }}
          onDelete={(id) => {
            setSelectedDetailGe(null);
            setDelId(id);
          }}
        />
      )}

      {editExp && (
        <ExpenseModal
          expense={editExp}
          onClose={() => setEditExp(null)}
        />
      )}

      {delId && (
        <ConfirmDialog
          title="Delete Expense"
          message="Are you sure you want to delete this expense? Any amount deducted from your wallet will be added back automatically."
          onConfirm={() => {
            deleteExpense(delId);
            setDelId(null);
            showToast('Expense deleted & balance updated');
          }}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}
