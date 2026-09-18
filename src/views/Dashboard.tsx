import { useState, useMemo } from 'react';
import { Plus, TrendingUp, TrendingDown, Users, ReceiptText, ArrowLeftRight, ArrowRight, Eye, EyeOff, Flame, CheckCircle2, ArrowUpRight, ArrowDownLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { walletBalance, totalWalletBalance, expenseFlow, monthKey, allFriendBalances, unsettledExpensesForFriend } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, groupExpenses, getGroupedExpenseAmount, resolveCategoryMeta, cleanSettlementDescription, type GroupedExpense } from '../utils';
import type { Friend, ViewName, Expense } from '../types';
import CategoryIcon from '../components/CategoryIcon';
import CategoryDistributionCard, { type CategoryBreakdownItem } from '../components/analytics/CategoryDistributionCard';
import TransferModal from '../components/TransferModal';
import { ExpenseDetailDrawer } from '../components/ExpenseDetailDrawer';
import ExpenseModal from '../components/ExpenseModal';
import SettleModal from '../components/SettleModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { renderWalletIcon } from '../components/WalletIconRenderer';
import DesktopSearchBar from '../components/DesktopSearchBar';
import { SmartExpenseMeta } from '../components/expenses/SmartExpenseMeta';
import SettlementBadge from '../components/common/SettlementBadge';

interface Props {
  onNavigate: (v: ViewName, arg?: string) => void;
  onAddExpense: () => void;
}

export default function Dashboard({ onNavigate, onAddExpense }: Props) {
  const { db, deleteExpense, showToast } = useStore();
  const { expenses, wallets, settings: { currency } } = db;
  const hideAmounts = Boolean(db.settings?.hideAmounts);
  const [tempReveal, setTempReveal] = useState(false);
  const isCardMasked = hideAmounts && !tempReveal;
  const visibleWallets = useMemo(() => wallets.filter(w => !w.isHidden), [wallets]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedDetailGe, setSelectedDetailGe] = useState<GroupedExpense | null>(null);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [settleFriend, setSettleFriend] = useState<Friend | null>(null);

  const now = new Date();
  const thisKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  const totalBalance = useMemo(() => totalWalletBalance(db), [db]);

  const { monthSpend, monthIncome } = useMemo(() => {
    let spend = 0;
    let income = 0;
    expenses.forEach(e => {
      if (monthKey(e.date) === thisKey && e.type === 'personal' && e.status !== 'unpaid' && e.category !== 'Transfer') {
        const amt = Number(e.amount) || 0;
        if (expenseFlow(e) === 'out') {
          spend += amt;
        } else if (expenseFlow(e) === 'in') {
          income += amt;
        }
      }
    });
    return { monthSpend: spend, monthIncome: income };
  }, [expenses, thisKey]);

  const highestExpenseObj = useMemo<Expense | null>(() => {
    let maxAmt = 0;
    let maxExp: Expense | null = null;
    expenses.forEach((e: Expense) => {
      if (
        monthKey(e.date) === thisKey &&
        e.type === 'personal' &&
        e.status !== 'unpaid' &&
        e.category !== 'Transfer' &&
        expenseFlow(e) === 'out'
      ) {
        const amt = Number(e.amount) || 0;
        if (amt > maxAmt) {
          maxAmt = amt;
          maxExp = e;
        }
      }
    });
    return maxExp;
  }, [expenses, thisKey]);

  const highestExpenseGrouped = useMemo(() => {
    if (!highestExpenseObj) return null;
    const grouped = groupExpenses([highestExpenseObj], db.wallets, db.friends);
    return grouped[0] || null;
  }, [highestExpenseObj, db.wallets, db.friends]);

  const { allBalances, netFriends } = useMemo(() => {
    let credit = 0;
    let debt = 0;
    const balances = allFriendBalances(db).filter(b => (b.friend.type || 'friend') === 'friend');
    balances.forEach(b => {
      if (b.net > 0) credit += b.net;
      else if (b.net < 0) debt += Math.abs(b.net);
    });
    return { allBalances: balances, netFriends: credit - debt };
  }, [db]);

  const recentExpenses = useMemo(() => {
    // Process only top candidates needed for the 5 dashboard entries rather than the entire DB history
    const candidateExpenses: Expense[] = [];
    const neededGroupIds = new Set<string>();
    for (let i = 0; i < expenses.length && candidateExpenses.length < 25; i++) {
      const e = expenses[i];
      candidateExpenses.push(e);
      if (e.groupId) neededGroupIds.add(e.groupId);
    }
    if (neededGroupIds.size > 0) {
      for (const e of expenses) {
        if (e.groupId && neededGroupIds.has(e.groupId) && !candidateExpenses.some(c => c.id === e.id)) {
          candidateExpenses.push(e);
        }
      }
    }
    return groupExpenses(candidateExpenses, db.wallets, db.friends, db.settlements).slice(0, 5);
  }, [expenses, db.wallets, db.friends, db.settlements]);

  const balancedFriends = useMemo(() =>
    allBalances
      .filter(b => Math.abs(b.net) > 0.004)
      .slice(0, 8),
    [allBalances]
  );

  const totalBalancedCount = useMemo(() =>
    allBalances.filter(b => Math.abs(b.net) > 0.004).length,
    [allBalances]
  );

  const balancedFriendsWithContext = useMemo(() => {
    return balancedFriends.map(({ friend, net }) => {
      const isOwed = net > 0;
      const unsettled = unsettledExpensesForFriend(db, friend.id);
      let reason = '';
      if (unsettled.length === 1) {
        const topExp = unsettled[0];
        const desc = cleanSettlementDescription(topExp.description) || topExp.category;
        reason = desc ? `for ${desc}` : '1 pending split';
      } else if (unsettled.length > 1) {
        const topExp = unsettled[0];
        const desc = cleanSettlementDescription(topExp.description) || topExp.category;
        reason = desc ? `${desc} +${unsettled.length - 1} more` : `${unsettled.length} pending splits`;
      } else {
        reason = 'Pending balance';
      }
      return {
        friend,
        net,
        isOwed,
        reason,
        unsettledCount: unsettled.length
      };
    });
  }, [balancedFriends, db]);

  // Group all expenses for accurate month category breakdown (matching Analytics view)
  const allGroupedExpenses = useMemo(() => {
    return groupExpenses(expenses, db.wallets, db.friends, db.settlements);
  }, [expenses, db.wallets, db.friends, db.settlements]);

  const { catBreakdown, totalCatSpend } = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    allGroupedExpenses.forEach(ge => {
      if (ge.category === 'Transfer' || ge.items?.some(i => i.category === 'Transfer')) return;
      if (ge.isSettlementGroup || ge.category === 'Settlement' || ge.category?.toLowerCase() === 'settlement') return;
      if (ge.category?.toLowerCase() === 'refund') return;
      if (monthKey(ge.date) !== thisKey) return;
      if (ge.flow !== 'out') return;
      const amt = getGroupedExpenseAmount(ge, 'all');
      if (amt === 0) return;
      if (!map[ge.category]) map[ge.category] = { amount: 0, count: 0 };
      map[ge.category].amount += amt;
      map[ge.category].count += 1;
    });

    const grandTotal = Object.values(map).reduce((sum, item) => sum + item.amount, 0);
    const sorted: CategoryBreakdownItem[] = Object.entries(map)
      .map(([cat, data]) => ({
        cat,
        amount: data.amount,
        count: data.count,
        pct: grandTotal > 0 ? (data.amount / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { catBreakdown: sorted, totalCatSpend: grandTotal };
  }, [allGroupedExpenses, thisKey]);

  const monthName = now.toLocaleDateString(undefined, { month: 'long' });
  const shortMonthName = now.toLocaleDateString(undefined, { month: 'short' });

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <DesktopSearchBar placeholder="Search expenses, contacts, wallets..." defaultTab="all" />
        <div className="desktop-only" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
              <div className="dashboard-hero-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: 1.1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="text-caption">
                    Total Net Worth
                  </span>
                  {hideAmounts && (
                    <button
                      type="button"
                      onClick={() => setTempReveal(!tempReveal)}
                      title={isCardMasked ? "Click to show amounts" : "Click to hide amounts"}
                      style={{
                        background: isCardMasked ? 'var(--surface)' : 'var(--surface2)',
                        border: `1px solid ${isCardMasked ? 'var(--border2)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-full)',
                        padding: '2px 8px',
                        color: isCardMasked ? 'var(--text)' : 'var(--text-3)',
                        boxShadow: isCardMasked ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 'var(--fs-caption)',
                        fontWeight: isCardMasked ? 700 : 500,
                        transition: 'all 0.2s ease',
                        lineHeight: 1,
                      }}
                    >
                      {isCardMasked ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{isCardMasked ? 'Hidden' : 'Shown'}</span>
                    </button>
                  )}
                </div>
                <span className="badge pill-chip" style={{ fontSize: 'var(--fs-caption)', padding: '2px 8px' }}>
                  {`${visibleWallets.length} ${visibleWallets.length === 1 ? 'Wallet' : 'Wallets'}`}
                </span>
              </div>

              <div
                className="dashboard-hero-balance text-hero"
                style={{
                  color: totalBalance < 0 ? 'var(--debit)' : 'var(--text)',
                  marginTop: 10,
                }}
              >
                {fmtMoney(totalBalance, currency, isCardMasked)}
              </div>
            </div>

            {/* Quick Wallet Breakdown Chips */}
            <div className="dashboard-wallet-breakdown-section" style={{ marginTop: 18 }}>
              <div className="dashboard-wallet-breakdown-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="text-caption" style={{ display: 'flex', alignItems: 'center' }}>
                  Wallets Breakdown
                </div>
                {visibleWallets.length >= 2 && (
                  <button
                    type="button"
                    className="btn-header-pill"
                    onClick={() => setShowTransfer(true)}
                    title="Transfer funds between wallets"
                  >
                    <ArrowLeftRight size={13} />
                    <span>Transfer</span>
                  </button>
                )}
              </div>
              <div className="dashboard-wallet-chips-scroll">
                {visibleWallets.map((w, idx) => {
                  const bal = walletBalance(db, w.id);
                  return (
                    <div
                      key={`${w.id}-${idx}`}
                      className="dashboard-wallet-chip"
                      onClick={() => onNavigate('wallets')}
                      title={`Click to view ${w.name} in Wallets`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {renderWalletIcon(w.icon || w.name || 'other_upi', 18, w.color)}
                      </div>
                      <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{w.name}:</span>
                      <span style={{ fontWeight: 700, color: bal < 0 ? 'var(--debit)' : 'var(--text)' }}>
                        {fmtMoney(bal, currency, isCardMasked)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stats Section: 4 Mini Metric Cards Grid */}
          <div className="dashboard-hero-stats">
            <div className="dashboard-stats-grid">
              <div
                className="dashboard-mini-stat dashboard-mini-stat-spend"
                onClick={() => onNavigate('expenses')}
                title={`View ${monthName} Expenses`}
              >
                <div className="dashboard-mini-stat-header">
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--debit-bg, rgba(239, 68, 68, 0.12))',
                    border: '1px solid var(--debit-border, rgba(239, 68, 68, 0.25))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--debit)',
                    flexShrink: 0
                  }}>
                    <TrendingDown size={12} />
                  </div>
                  <span>{shortMonthName} Spend</span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--debit)' }}>
                  {fmtMoney(monthSpend, currency)}
                </div>
              </div>

              <div
                className="dashboard-mini-stat dashboard-mini-stat-income"
                onClick={() => onNavigate('expenses')}
                title={`View ${monthName} Income`}
              >
                <div className="dashboard-mini-stat-header">
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--credit-bg, rgba(34, 197, 94, 0.12))',
                    border: '1px solid var(--credit-border, rgba(34, 197, 94, 0.25))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--credit)',
                    flexShrink: 0
                  }}>
                    <TrendingUp size={12} />
                  </div>
                  <span>{shortMonthName} Income</span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--credit)' }}>
                  {fmtMoney(monthIncome, currency)}
                </div>
              </div>

              <div
                className="dashboard-mini-stat dashboard-mini-stat-friends"
                onClick={() => onNavigate('friends')}
                title={netFriends > 0 ? 'Friends owe you in total (Click to view)' : netFriends < 0 ? 'You owe friends in total (Click to view)' : 'All balances settled (Click to view)'}
              >
                <div className="dashboard-mini-stat-header">
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 'var(--radius-sm)',
                    background: netFriends > 0
                      ? 'var(--credit-bg, rgba(34, 197, 94, 0.12))'
                      : netFriends < 0
                      ? 'var(--debit-bg, rgba(239, 68, 68, 0.12))'
                      : 'var(--surface3)',
                    border: `1px solid ${netFriends > 0 ? 'var(--credit-border, rgba(46, 125, 50, 0.22))' : netFriends < 0 ? 'var(--debit-border, rgba(211, 47, 47, 0.22))' : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: netFriends > 0 ? 'var(--credit)' : netFriends < 0 ? 'var(--debit)' : 'var(--text-2)',
                    flexShrink: 0
                  }}>
                    <Users size={12} />
                  </div>
                  <span>Friends Net</span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: netFriends > 0 ? 'var(--credit)' : netFriends < 0 ? 'var(--debit)' : 'var(--text)' }}>
                  {fmtMoney(Math.abs(netFriends), currency)}
                </div>
              </div>

              <div
                className="dashboard-mini-stat dashboard-mini-stat-highest"
                onClick={() => {
                  if (highestExpenseGrouped) {
                    setSelectedDetailGe(highestExpenseGrouped);
                  } else {
                    onNavigate('expenses');
                  }
                }}
                title={highestExpenseObj ? `${highestExpenseObj.description || highestExpenseObj.category || 'Expense'} (${highestExpenseObj.category || 'Expense'}) - Click to view drawer` : 'Highest Expense'}
              >
                <div className="dashboard-mini-stat-header">
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--amber-bg, rgba(245, 158, 11, 0.12))',
                    border: '1px solid var(--amber-border, rgba(245, 158, 11, 0.25))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--amber, #f59e0b)',
                    flexShrink: 0
                  }}>
                    <Flame size={12} />
                  </div>
                  <span>
                    Highest Exp
                  </span>
                </div>
                <div className="dashboard-mini-stat-val" style={{ color: 'var(--amber, #f59e0b)' }}>
                  {highestExpenseObj ? fmtMoney(highestExpenseObj.amount, currency) : fmtMoney(0, currency)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Expenses */}
        <div className="card" style={{ gridColumn: '1 / -1', minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, width: '100%', minWidth: 0, minHeight: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <div className="dashboard-card-icon">
                <ReceiptText size={17} />
              </div>
              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, display: 'flex', alignItems: 'center' }}>Recent Expenses</h2>
            </div>
            <button className="btn-view-all" onClick={() => onNavigate('expenses')}>
              <span>View all</span>
              <ArrowRight size={14} className="btn-view-all-arrow" />
            </button>
          </div>
          {recentExpenses.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '28px 16px',
              textAlign: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'transparent'
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface2)',
                color: 'var(--text-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10
              }}>
                <ReceiptText size={20} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No expenses yet</div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>
                Transactions you log will show up here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 0 }}>
              {recentExpenses.map((ge, idx) => {
                const cat = db.settings.categories.find(c => c.name === ge.category);
                const isSettlement = ge.isSettlementGroup || ge.category === 'Settlement';
                const catMeta = resolveCategoryMeta(ge.category, cat, isSettlement);
                const isIn = ge.flow === 'in' && ge.category !== 'Transfer';
                const friendsInGroup = ge.friendIds.map(fid => db.friends.find(f => f.id === fid)).filter(Boolean);
                const settlementObj = isSettlement && ge.settlementId ? db.settlements.find(s => s.id === ge.settlementId) : null;
                const isForgiven = isSettlement && Boolean(ge.isForgiven || settlementObj?.isForgiven || (ge.description && /forgiv|waiv|forgotten/i.test(ge.description)));

                return (
                  <div
                    key={`${ge.id}-${idx}`}
                    onClick={() => setSelectedDetailGe(ge)}
                    role="button"
                    tabIndex={0}
                    className="recent-expense-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      gap: 12,
                      width: 'calc(100% + 12px)',
                      margin: '0 -6px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 'var(--radius-md, 10px)',
                          backgroundColor: catMeta.bg,
                          border: `1px solid ${catMeta.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: catMeta.color,
                        }}
                      >
                        <CategoryIcon category={catMeta.name} icon={catMeta.icon} size={20} style={{ color: catMeta.color }} />
                      </div>
                      <div style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--fs-base)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, width: '100%' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>
                            {cleanSettlementDescription(ge.description)}
                          </span>
                          {isSettlement ? (
                            <SettlementBadge ge={ge} settlementObj={settlementObj} isForgiven={isForgiven} />
                          ) : (
                            ge.isSplit && (
                              <span style={{
                                fontSize: 'var(--fs-caption)',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--accent-soft)',
                                color: 'var(--accent)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>Split</span>
                            )
                          )}
                        </div>
                        <SmartExpenseMeta
                          category={!isSettlement && ge.category !== 'Transfer' ? ge.category : undefined}
                          dateText={fmtDate(ge.date)}
                          friends={friendsInGroup.filter((f): f is Friend => Boolean(f && f.type !== 'vendor'))}
                          vendor={friendsInGroup.find((f): f is Friend => Boolean(f && f.type === 'vendor')) || null}
                          style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}
                        />
                      </div>
                    </div>
                    <div style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: 'var(--fs-base)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                      color: isSettlement
                        ? (isForgiven ? 'var(--amber)' : (ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)'))
                        : (isIn ? 'var(--credit)' : 'var(--text)')
                    }}>
                      {isSettlement
                        ? (isForgiven ? '~' : (ge.flow === 'in' ? '+' : '-'))
                        : (isIn ? '+' : '')}
                      {fmtMoney(ge.totalAmount, currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Friend Balances */}
        <div className="card dashboard-friends-card" style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, width: '100%', minWidth: 0, minHeight: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
              <div className="dashboard-card-icon">
                <Users size={16} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
                <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap' }}>Friends</h2>
                {totalBalancedCount > 0 && (
                  <span
                    className="pill-chip"
                    style={{
                      fontSize: 'var(--fs-caption)',
                      padding: '1.5px 7.5px',
                      background: netFriends >= 0 ? 'var(--credit-bg, rgba(34, 197, 94, 0.12))' : 'var(--debit-bg, rgba(239, 68, 68, 0.12))',
                      color: netFriends >= 0 ? 'var(--credit)' : 'var(--debit)',
                      border: `1px solid ${netFriends >= 0 ? 'var(--credit-border, rgba(46, 125, 50, 0.22))' : 'var(--debit-border, rgba(211, 47, 47, 0.22))'}`,
                      letterSpacing: '-0.2px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                    title={netFriends > 0 ? `Total net owed to you: ${fmtMoney(netFriends, currency)}` : netFriends < 0 ? `Total net you owe: ${fmtMoney(Math.abs(netFriends), currency)}` : 'All settled'}
                  >
                    {netFriends > 0
                      ? `+${fmtMoney(netFriends, currency)} to collect`
                      : netFriends < 0
                      ? `${fmtMoney(Math.abs(netFriends), currency)} to pay`
                      : 'Balanced'}
                  </span>
                )}
              </div>
            </div>
            <button className="btn-view-all" onClick={() => onNavigate('friends')}>
              <span>View all</span>
              <ArrowRight size={14} className="btn-view-all-arrow" />
            </button>
          </div>

          {balancedFriendsWithContext.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '28px 16px',
              textAlign: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'transparent'
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface2)',
                color: 'var(--text-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10
              }}>
                <CheckCircle2 size={20} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                All settled up
              </div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>
                No outstanding balances with friends
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', minWidth: 0 }}>
              {balancedFriendsWithContext.map(({ friend, net, isOwed, reason }, idx: number) => {
                return (
                  <div
                    key={`${friend.id}-${idx}`}
                    onClick={() => onNavigate('friend-detail', friend.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigate('friend-detail', friend.id);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      margin: '0 -6px',
                      width: 'calc(100% + 12px)',
                      boxSizing: 'border-box'
                    }}
                    className="friend-balance-row"
                  >
                    {/* Left: Squircle Avatar + Name + Reason Context */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                      <div
                        className="avatar"
                        style={{
                          ...getAvatarStyle(friend.color),
                          width: 34,
                          height: 34,
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 700,
                          flexShrink: 0,
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)'
                        }}
                      >
                        {friendInitial(friend.name, friend.avatarNumber)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <div style={{
                          fontSize: 'var(--fs-base)',
                          fontWeight: 600,
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          letterSpacing: '-0.1px'
                        }}>
                          {friend.name}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4.5,
                          fontSize: 'var(--fs-xs)',
                          color: 'var(--text-3)',
                          marginTop: 1.5,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          <span style={{
                            color: isOwed ? 'var(--credit)' : 'var(--debit)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            flexShrink: 0
                          }}>
                            {isOwed ? <ArrowUpRight size={11} strokeWidth={2.4} /> : <ArrowDownLeft size={11} strokeWidth={2.4} />}
                            {isOwed ? 'Owes you' : 'You owe'}
                          </span>
                          {reason && (
                            <>
                              <span style={{ opacity: 0.4, fontSize: 8, flexShrink: 0 }}>•</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                                {reason}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Chevron */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontSize: 'var(--fs-base)',
                          fontWeight: 700,
                          color: isOwed ? 'var(--credit)' : 'var(--debit)',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.2px'
                        }}>
                          {isOwed ? '+' : ''}{fmtMoney(net, currency)}
                        </div>
                      </div>

                      <ChevronRight size={13} className="friend-row-chevron" />
                    </div>
                  </div>
                );
              })}

              {/* View all remaining indicator */}
              {totalBalancedCount > balancedFriends.length && (
                <div
                  onClick={() => onNavigate('friends')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '8px 0 2px',
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'color 0.15s ease'
                  }}
                  className="hover:text-[var(--accent)]"
                >
                  <span>+{totalBalancedCount - balancedFriends.length} more with balance</span>
                  <ArrowRight size={11} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Spend */}
        <div className="dashboard-categories-card">
          <CategoryDistributionCard
            title="Top Categories"
            categories={catBreakdown}
            totalOutflow={totalCatSpend}
            currency={currency}
            categorySettings={db.settings.categories}
            maxDisplay={6}
            hideShowMore={true}
            interactive={false}
          />
        </div>
      </div>

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
          message="Removes this expense and restores the amount to your wallet."
          onConfirm={() => {
            deleteExpense(delId);
            setDelId(null);
            showToast('Expense deleted & balance updated');
          }}
          onClose={() => setDelId(null)}
        />
      )}

      {settleFriend && (
        <SettleModal
          friend={settleFriend}
          onClose={() => setSettleFriend(null)}
        />
      )}
    </div>
  );
}
