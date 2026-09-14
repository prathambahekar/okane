import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { groupExpenses, getGroupedExpenseAmount, type GroupedExpense } from '../utils';
import ExpenseModal from '../components/ExpenseModal';
import ExpenseDetailDrawer from '../components/ExpenseDetailDrawer';
import DailyWalletBalanceDrawer from '../components/DailyWalletBalanceDrawer';
import AnalyticsHeader from '../components/analytics/AnalyticsHeader';
import TotalSpendingCard, { type ChartDayData } from '../components/analytics/TotalSpendingCard';
import CategoryDistributionCard from '../components/analytics/CategoryDistributionCard';
import DailyExpenditureCard from '../components/analytics/DailyExpenditureCard';
import AnalyticsInsightsCard from '../components/analytics/AnalyticsInsightsCard';
import { friendBalance } from '../db';
import type { Expense, ViewName } from '../types';
import {
  X,
  Filter,
} from 'lucide-react';

function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

interface AnalyticsProps {
  onNavigate?: (v: ViewName) => void;
}

export default function Analytics({ onNavigate }: AnalyticsProps = {}) {
  const { db, deleteExpense, showToast } = useStore();
  const { expenses, wallets, settings: { currency } } = db;
  const spendingMode = db.settings?.spendingMode || 'all';

  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatISO(now), [now]);
  const currentWeekMonStr = useMemo(() => formatISO(getMonday(now)), [now]);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  const [activeWeekMonStr, setActiveWeekMonStr] = useState<string>(currentWeekMonStr);
  const [activeMonthStr, setActiveMonthStr] = useState<string>(currentMonthStr);

  const [selectedGroupExpense, setSelectedGroupExpense] = useState<GroupedExpense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDailyBalanceDrawer, setShowDailyBalanceDrawer] = useState(false);

  // Grouped expenses base
  const groupedExpenses = useMemo(() => groupExpenses(expenses, wallets), [expenses, wallets]);

  // Handle Date Navigation (Prev / Next)
  const handlePrevDate = () => {
    if (period === 'week') {
      const [y, m, d] = activeWeekMonStr.split('-').map(Number);
      const prevMon = new Date(y, m - 1, d - 7);
      setActiveWeekMonStr(formatISO(prevMon));
      setSelectedDate(null);
    } else {
      const [y, m] = activeMonthStr.split('-').map(Number);
      const prevM = new Date(y, m - 2, 1);
      setActiveMonthStr(`${prevM.getFullYear()}-${padZero(prevM.getMonth() + 1)}`);
      setSelectedDate(null);
    }
  };

  const handleNextDate = () => {
    if (period === 'week') {
      if (activeWeekMonStr >= currentWeekMonStr) return;
      const [y, m, d] = activeWeekMonStr.split('-').map(Number);
      const nextMon = new Date(y, m - 1, d + 7);
      setActiveWeekMonStr(formatISO(nextMon));
      setSelectedDate(null);
    } else {
      if (activeMonthStr >= currentMonthStr) return;
      const [y, m] = activeMonthStr.split('-').map(Number);
      const nextM = new Date(y, m, 1);
      setActiveMonthStr(`${nextM.getFullYear()}-${padZero(nextM.getMonth() + 1)}`);
      setSelectedDate(null);
    }
  };

  const handleResetDate = () => {
    if (period === 'week') {
      setActiveWeekMonStr(currentWeekMonStr);
    } else {
      setActiveMonthStr(currentMonthStr);
    }
    setSelectedDate(null);
  };

  const isCurrentPeriod = useMemo(() => {
    return period === 'week'
      ? activeWeekMonStr >= currentWeekMonStr
      : activeMonthStr >= currentMonthStr;
  }, [period, activeWeekMonStr, currentWeekMonStr, activeMonthStr, currentMonthStr]);

  // Date Range Label (e.g. "Sep 8 – Sep 14" or "September 2026")
  const dateRangeLabel = useMemo(() => {
    if (period === 'week') {
      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      const monDate = new Date(wy, wm - 1, wd);
      const sunDate = new Date(wy, wm - 1, wd + 6);
      const monMonth = monDate.toLocaleDateString('en-US', { month: 'short' });
      const sunMonth = sunDate.toLocaleDateString('en-US', { month: 'short' });
      const monD = monDate.getDate();
      const sunD = sunDate.getDate();

      if (monMonth === sunMonth) {
        return `${monMonth} ${monD} – ${sunD}`;
      }
      return `${monMonth} ${monD} – ${sunMonth} ${sunD}`;
    } else {
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const mDate = new Date(my, mm - 1, 1);
      return mDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }, [period, activeWeekMonStr, activeMonthStr]);

  // Active period boundaries
  const activeDateRange = useMemo(() => {
    if (period === 'week') {
      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      const monDate = new Date(wy, wm - 1, wd);
      const sunDate = new Date(wy, wm - 1, wd + 6);
      return {
        startDate: formatISO(monDate),
        endDate: formatISO(sunDate),
      };
    } else {
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const firstDay = new Date(my, mm - 1, 1);
      const lastDay = new Date(my, mm, 0);
      return {
        startDate: formatISO(firstDay),
        endDate: formatISO(lastDay),
      };
    }
  }, [period, activeWeekMonStr, activeMonthStr]);

  // Preceding period boundaries for comparison
  const prevDateRange = useMemo(() => {
    if (period === 'week') {
      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      const prevMon = new Date(wy, wm - 1, wd - 7);
      const prevSun = new Date(wy, wm - 1, wd - 1);
      return {
        startDate: formatISO(prevMon),
        endDate: formatISO(prevSun),
      };
    } else {
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const firstDay = new Date(my, mm - 2, 1);
      const lastDay = new Date(my, mm - 1, 0);
      return {
        startDate: formatISO(firstDay),
        endDate: formatISO(lastDay),
      };
    }
  }, [period, activeWeekMonStr, activeMonthStr]);

  // Filtered expenses for active period
  const periodExpenses = useMemo(() => {
    return groupedExpenses.filter(ge => {
      if (ge.date < activeDateRange.startDate || ge.date > activeDateRange.endDate) return false;
      if (selectedCategory && ge.category !== selectedCategory) return false;
      if (selectedWalletId && ge.walletId !== selectedWalletId) return false;
      return true;
    });
  }, [groupedExpenses, activeDateRange, selectedCategory, selectedWalletId]);

  // Preceding period expenses
  const prevPeriodExpenses = useMemo(() => {
    return groupedExpenses.filter(ge => {
      if (ge.date < prevDateRange.startDate || ge.date > prevDateRange.endDate) return false;
      if (selectedCategory && ge.category !== selectedCategory) return false;
      if (selectedWalletId && ge.walletId !== selectedWalletId) return false;
      return true;
    });
  }, [groupedExpenses, prevDateRange, selectedCategory, selectedWalletId]);

  // Total spent in active period & previous period
  const totalSpent = useMemo(() => {
    return periodExpenses
      .filter(ge => ge.flow === 'out')
      .reduce((sum, ge) => sum + getGroupedExpenseAmount(ge, spendingMode), 0);
  }, [periodExpenses, spendingMode]);

  const prevPeriodSpent = useMemo(() => {
    return prevPeriodExpenses
      .filter(ge => ge.flow === 'out')
      .reduce((sum, ge) => sum + getGroupedExpenseAmount(ge, spendingMode), 0);
  }, [prevPeriodExpenses, spendingMode]);

  // Chart days computation
  const chartDays: ChartDayData[] = useMemo(() => {
    if (period === 'week') {
      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      const days: ChartDayData[] = [];
      for (let i = 0; i < 7; i++) {
        const cur = new Date(wy, wm - 1, wd + i);
        const dateStr = formatISO(cur);
        const dayName = cur.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = cur.getDate();
        const fullDateLabel = cur.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        
        const dayExps = periodExpenses.filter(ge => ge.date === dateStr);
        const spend = dayExps
          .filter(ge => ge.flow === 'out')
          .reduce((s, ge) => s + getGroupedExpenseAmount(ge, spendingMode), 0);

        days.push({
          dateStr,
          dayName,
          dayNum,
          fullDateLabel,
          spend,
          count: dayExps.length,
          isToday: dateStr === todayStr,
          isYesterday: false,
        });
      }
      return days;
    } else {
      // Month mode: 7 days or days of month (for clean visual display, provide days in month or 4-5 weekly buckets)
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const totalDays = new Date(my, mm, 0).getDate();
      const days: ChartDayData[] = [];

      for (let d = 1; d <= totalDays; d++) {
        const cur = new Date(my, mm - 1, d);
        const dateStr = formatISO(cur);
        const dayName = cur.toLocaleDateString('en-US', { weekday: 'narrow' });
        const fullDateLabel = cur.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        
        const dayExps = periodExpenses.filter(ge => ge.date === dateStr);
        const spend = dayExps
          .filter(ge => ge.flow === 'out')
          .reduce((s, ge) => s + getGroupedExpenseAmount(ge, spendingMode), 0);

        days.push({
          dateStr,
          dayName,
          dayNum: d,
          fullDateLabel,
          spend,
          count: dayExps.length,
          isToday: dateStr === todayStr,
          isYesterday: false,
        });
      }
      return days;
    }
  }, [period, activeWeekMonStr, activeMonthStr, periodExpenses, spendingMode, todayStr]);

  // Highest day amount & No-spend days
  const highestDayAmount = useMemo(() => {
    return Math.max(...chartDays.map(d => d.spend), 0);
  }, [chartDays]);

  const noSpendDaysCount = useMemo(() => {
    // Count days where spend is 0, up to today if in current period
    return chartDays.filter(d => {
      if (d.dateStr > todayStr) return false; // Don't count future days in current week as no-spend
      return d.spend === 0;
    }).length;
  }, [chartDays, todayStr]);

  const daysPassedCount = useMemo(() => {
    const elapsed = chartDays.filter(d => d.dateStr <= todayStr).length;
    return Math.max(1, elapsed);
  }, [chartDays, todayStr]);

  const dailyAvg = useMemo(() => {
    return totalSpent / daysPassedCount;
  }, [totalSpent, daysPassedCount]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (selectedCategory) c++;
    if (selectedWalletId) c++;
    return c;
  }, [selectedCategory, selectedWalletId]);

  const friendsWithBalance = useMemo(() => {
    return (db.friends || [])
      .map((f) => {
        const bal = friendBalance(db, f.id);
        return { name: f.name, net: bal.net };
      })
      .filter((f) => Math.abs(f.net) > 0.01);
  }, [db]);

  const handleDeleteExpense = (id: string) => {
    deleteExpense(id);
    showToast('Expense deleted');
    setDeletingId(null);
  };

  const yesterdayStr = useMemo(() => {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return formatISO(y);
  }, [now]);

  // Filtered expenses according to category, wallet, or specific selected date
  const filteredExpenses = useMemo(() => {
    return periodExpenses.filter(ge => {
      if (selectedDate && ge.date !== selectedDate) return false;
      return true;
    });
  }, [periodExpenses, selectedDate]);

  const timeframeExpenses = periodExpenses;
  const timeframeOutflowTotal = totalSpent;

  // Daily log breakdown
  const perDayList = useMemo(() => {
    const map: Record<string, { spend: number; income: number; items: GroupedExpense[]; categories: Record<string, number> }> = {};

    filteredExpenses.forEach(ge => {
      const d = ge.date;
      if (!map[d]) {
        map[d] = { spend: 0, income: 0, items: [], categories: {} };
      }
      map[d].items.push(ge);
      const amt = getGroupedExpenseAmount(ge, spendingMode);
      if (ge.flow === "out") {
        map[d].spend += amt;
        map[d].categories[ge.category] = (map[d].categories[ge.category] || 0) + amt;
      } else {
        map[d].income += amt;
        map[d].categories[ge.category] = (map[d].categories[ge.category] || 0) + amt;
      }
    });

    return Object.entries(map)
      .map(([dateStr, data]) => {
        const topCatEntry = Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0];
        const [y, m, d] = dateStr.split("-").map(Number);
        const dObj = new Date(y, m - 1, d);
        const dayName = isNaN(dObj.getTime())
          ? dateStr
          : dObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        return {
          dateStr,
          dayName,
          spend: data.spend,
          income: data.income,
          count: data.items.length,
          items: data.items,
          topCategory: topCatEntry ? topCatEntry[0] : (data.items[0]?.category || "General"),
          isToday: dateStr === todayStr,
          isYesterday: dateStr === yesterdayStr,
        };
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredExpenses, todayStr, yesterdayStr, spendingMode]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    timeframeExpenses.forEach(ge => {
      if (ge.flow !== "out") return;
      const amt = getGroupedExpenseAmount(ge, spendingMode);
      if (amt === 0) return;
      if (!map[ge.category]) map[ge.category] = { amount: 0, count: 0 };
      map[ge.category].amount += amt;
      map[ge.category].count += 1;
    });

    return Object.entries(map)
      .map(([cat, data]) => ({
        cat,
        amount: data.amount,
        count: data.count,
        pct: timeframeOutflowTotal > 0 ? (data.amount / timeframeOutflowTotal) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [timeframeExpenses, timeframeOutflowTotal, spendingMode]);

  // Toggle date selection from bar chart or list
  const handleToggleDate = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
    } else {
      setSelectedDate(dateStr);
    }
  };

  return (
    <div className="view-container analytics-v2-container" style={{ paddingBottom: 80 }}>
      {/* 1. Header & Period / Date Range Navigator */}
      <AnalyticsHeader
        period={period}
        setPeriod={setPeriod}
        dateRangeLabel={dateRangeLabel}
        onPrevDate={handlePrevDate}
        onNextDate={handleNextDate}
        onResetDate={handleResetDate}
        isCurrentPeriod={isCurrentPeriod}
        onNavigate={onNavigate}
      />

      {/* 2. Card 1: Total Spending Overview & Interactive Visual Bar Chart */}
      <div style={{ width: '100%' }}>
        <TotalSpendingCard
          period={period}
          totalSpent={totalSpent}
          prevPeriodSpent={prevPeriodSpent}
          dailyAvg={dailyAvg}
          highestDayAmount={highestDayAmount}
          noSpendDaysCount={noSpendDaysCount}
          chartDays={chartDays}
          currency={currency}
          onOpenFilter={() => setShowFilterDrawer(true)}
          activeFilterCount={activeFilterCount}
          onSelectDay={handleToggleDate}
          selectedDateStr={selectedDate}
        />
      </div>

      {/* Quick Filter Modal / Drawer */}
      {showFilterDrawer && (
        <div className="modal-backdrop" onClick={() => setShowFilterDrawer(false)}>
          <div
            className="modal"
            style={{ maxWidth: 420, padding: '20px 22px', borderRadius: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={18} color="var(--text)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Filter Analytics</h3>
              </div>
              <button
                onClick={() => setShowFilterDrawer(false)}
                className="btn-icon"
                style={{ width: 32, height: 32, border: 'none', background: 'transparent' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Category Filter */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                Category
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`chip ${!selectedCategory ? 'active' : ''}`}
                >
                  All Categories
                </button>
                {db.settings.categories.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedCategory(selectedCategory === c.name ? null : c.name)}
                    className={`chip ${selectedCategory === c.name ? 'active' : ''}`}
                  >
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Wallet Filter */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                Wallet / Account
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
                <button
                  type="button"
                  onClick={() => setSelectedWalletId(null)}
                  className={`chip ${!selectedWalletId ? 'active' : ''}`}
                >
                  All Wallets
                </button>
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedWalletId(selectedWalletId === w.id ? null : w.id)}
                    className={`chip ${selectedWalletId === w.id ? 'active' : ''}`}
                  >
                    <span>{w.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedWalletId(null);
                }}
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '8px 14px' }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowFilterDrawer(false)}
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '8px 20px', borderRadius: 9999 }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Cards Grid: Smart Insights, Category Breakdown & Daily Activity */}
      <div className="analytics-v2-grid">
        {/* Smart Insights Card (Full Width Span) */}
        <div className="analytics-v2-grid-full">
          <AnalyticsInsightsCard
            period={period}
            totalSpent={timeframeOutflowTotal}
            prevTotalSpent={prevPeriodSpent}
            dailyAvg={dailyAvg}
            noSpendDaysCount={noSpendDaysCount}
            categoryBreakdown={categoryBreakdown}
            chartDays={chartDays}
            currency={currency}
            friendsWithBalance={friendsWithBalance}
            onSelectCategory={setSelectedCategory}
            onSelectDate={handleToggleDate}
          />
        </div>

        {/* Category Breakdown Card */}
        <CategoryDistributionCard
          categories={categoryBreakdown}
          totalOutflow={timeframeOutflowTotal}
          currency={currency}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categorySettings={db.settings.categories}
        />

        {/* Daily Activity Card */}
        <DailyExpenditureCard
          days={perDayList}
          currency={currency}
          selectedDate={selectedDate}
          onSelectDate={handleToggleDate}
          onOpenDayDetails={(dateStr) => {
            setSelectedDate(dateStr);
            setShowDailyBalanceDrawer(true);
          }}
          categorySettings={db.settings.categories}
        />
      </div>

      {/* Transaction Detail Drawer */}
      {selectedGroupExpense && (
        <ExpenseDetailDrawer
          ge={selectedGroupExpense}
          onClose={() => setSelectedGroupExpense(null)}
          onEdit={(item) => {
            setSelectedGroupExpense(null);
            setEditingExpense(item);
          }}
          onDelete={(id) => {
            setSelectedGroupExpense(null);
            setDeletingId(id);
          }}
          currency={currency}
          friends={db.friends}
          wallets={db.wallets}
          categories={db.settings.categories}
          settlements={db.settlements}
        />
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <ExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {/* Daily Wallet Balance Drawer */}
      <DailyWalletBalanceDrawer
        isOpen={showDailyBalanceDrawer}
        onClose={() => setShowDailyBalanceDrawer(false)}
        initialMonth={period === 'month' ? activeMonthStr : undefined}
        initialDate={selectedDate || undefined}
      />

      {/* Confirmation Delete Dialog */}
      {deletingId && (
        <div className="modal-backdrop" onClick={() => setDeletingId(null)}>
          <div className="modal" style={{ maxWidth: 360, padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Expense?</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 16 }}>
              Are you sure you want to delete this expense transaction? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setDeletingId(null)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                style={{ background: '#EF4444' }}
                onClick={() => handleDeleteExpense(deletingId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
