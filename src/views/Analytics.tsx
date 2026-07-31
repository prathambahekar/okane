import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { expenseFlow } from '../db';
import { fmtMoney } from '../utils';
import { CategoryBadge } from '../components/CategoryIcon';
import ExpenseModal from '../components/ExpenseModal';
import type { Expense } from '../types';
import {
  BarChart2,
  PieChart,
  Calendar,
  Sun,
  SlidersHorizontal,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Edit2,
  Trash2,
  Wallet,
  User,
  Tag,
  Flame,
  Award
} from 'lucide-react';

type TimeFrame = 'this_week' | 'this_month' | 'this_year' | 'all';
type TypeFilter = 'all' | 'personal' | 'friend';

function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

export default function Analytics() {
  const { db, deleteExpense, showToast } = useStore();
  const { expenses, wallets, friends, settings: { currency } } = db;

  const [timeframe, setTimeframe] = useState<TimeFrame>('this_week');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatISO(now), [now]);

  const yesterdayStr = useMemo(() => {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return formatISO(y);
  }, [now]);

  // Robust Monday to Sunday current week calculation
  const { mondayStr, sundayStr } = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMonday = (day + 6) % 7; // Mon=0, Tue=1 ... Sun=6

    const monday = new Date(y, m - 1, d - diffToMonday);
    const days: { dateStr: string; label: string; dayName: string; dayNum: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dateStr = formatISO(cur);
      const dayName = cur.toLocaleDateString(undefined, { weekday: 'short' });
      const dayNum = cur.getDate();
      days.push({
        dateStr,
        label: `${dayName} ${dayNum}`,
        dayName,
        dayNum,
      });
    }

    return {
      mondayStr: days[0].dateStr,
      sundayStr: days[6].dateStr,
    };
  }, [todayStr]);

  // Days passed in current Monday-to-Sunday week (Mon = 1, Tue = 2, ..., Sun = 7)
  const daysPassedInWeek = useMemo(() => {
    const day = now.getDay();
    return ((day + 6) % 7) + 1;
  }, [now]);

  // Base expense filter by expense type (all, personal only, or friend splits)
  const typeFilteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (typeFilter === 'personal') return e.type === 'personal';
      if (typeFilter === 'friend') return e.type !== 'personal';
      return true;
    });
  }, [expenses, typeFilter]);

  // Today's outflow
  const todaySpent = useMemo(() =>
    typeFilteredExpenses.filter(e => e.date === todayStr && expenseFlow(e) === 'out')
      .reduce((sum, e) => sum + Number(e.amount), 0),
  [typeFilteredExpenses, todayStr]);

  // Yesterday's outflow
  const yesterdaySpent = useMemo(() =>
    typeFilteredExpenses.filter(e => e.date === yesterdayStr && expenseFlow(e) === 'out')
      .reduce((sum, e) => sum + Number(e.amount), 0),
  [typeFilteredExpenses, yesterdayStr]);

  // Filtered expenses according to timeframe, type, category, date
  const filteredExpenses = useMemo(() => {
    return typeFilteredExpenses.filter(e => {
      if (selectedCategory && e.category !== selectedCategory) return false;
      if (selectedDate) {
        return e.date === selectedDate;
      }

      const d = e.date;
      switch (timeframe) {
        case 'this_week':
          return d >= mondayStr && d <= sundayStr;
        case 'this_month':
          return d.slice(0, 7) === todayStr.slice(0, 7);
        case 'this_year':
          return d.slice(0, 4) === todayStr.slice(0, 4);
        case 'all':
        default:
          return true;
      }
    });
  }, [typeFilteredExpenses, timeframe, todayStr, mondayStr, sundayStr, selectedCategory, selectedDate]);

  // Outflow & Inflow totals for selected timeframe
  const totalSpent = useMemo(() =>
    filteredExpenses.filter(e => expenseFlow(e) === 'out').reduce((sum, e) => sum + Number(e.amount), 0),
  [filteredExpenses]);

  // Days in selected timeframe
  const daysInPeriod = useMemo(() => {
    switch (timeframe) {
      case 'this_week':
        return Math.max(1, daysPassedInWeek);
      case 'this_month':
        return Math.max(1, now.getDate());
      case 'this_year': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const diffDays = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
      }
      case 'all': default: {
        if (typeFilteredExpenses.length === 0) return 30;
        const dates = typeFilteredExpenses.map(e => new Date(e.date).getTime()).filter(t => !isNaN(t));
        if (dates.length === 0) return 30;
        const minDate = Math.min(...dates);
        const diffDays = Math.ceil((now.getTime() - minDate) / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
      }
    }
  }, [timeframe, daysPassedInWeek, now, typeFilteredExpenses]);

  const dailyAvgSpend = totalSpent / daysInPeriod;

  const chartScrollRef = useRef<HTMLDivElement>(null);

  // Multi-week Chart Data for Horizontal Scrolling across Past Weeks
  const weeklyWeeks = useMemo(() => {
    const baseList = typeFilteredExpenses.filter(e => !selectedCategory || e.category === selectedCategory);

    const [y, m, d] = todayStr.split('-').map(Number);
    const todayObj = new Date(y, m - 1, d);
    const day = todayObj.getDay();
    const diffToMonday = (day + 6) % 7;
    const currentMon = new Date(y, m - 1, d - diffToMonday);

    // Determine how many weeks back to generate (min 8 weeks, up to 26)
    let numWeeks = 8;
    if (baseList.length > 0) {
      const earliest = baseList.reduce((min, e) => (e.date < min ? e.date : min), todayStr);
      const [ey, em, ed] = earliest.split('-').map(Number);
      const earliestObj = new Date(ey, em - 1, ed);
      const msDiff = currentMon.getTime() - earliestObj.getTime();
      if (msDiff > 0) {
        const weeksDiff = Math.ceil(msDiff / (7 * 24 * 60 * 60 * 1000)) + 1;
        numWeeks = Math.max(8, Math.min(26, weeksDiff));
      }
    }

    const weeks = [];
    for (let w = numWeeks - 1; w >= 0; w--) {
      const mon = new Date(currentMon.getFullYear(), currentMon.getMonth(), currentMon.getDate() - w * 7);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);

      const monStr = formatISO(mon);
      const sunStr = formatISO(sun);

      const isCurrentWeek = w === 0;
      const isLastWeek = w === 1;

      const monMonth = mon.toLocaleDateString(undefined, { month: 'short' });
      const sunMonth = sun.toLocaleDateString(undefined, { month: 'short' });
      const dateRange = monMonth === sunMonth
        ? `${monMonth} ${mon.getDate()}–${sun.getDate()}`
        : `${monMonth} ${mon.getDate()} – ${sunMonth} ${sun.getDate()}`;

      let label = dateRange;
      if (isCurrentWeek) label = 'This Week';
      else if (isLastWeek) label = 'Last Week';

      const days = [];
      let weekTotal = 0;

      for (let i = 0; i < 7; i++) {
        const cur = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
        const dateStr = formatISO(cur);
        const dayName = cur.toLocaleDateString(undefined, { weekday: 'short' });
        const dayNum = cur.getDate();
        const dayExps = baseList.filter(e => e.date === dateStr);
        const spend = dayExps.filter(e => expenseFlow(e) === 'out').reduce((s, e) => s + Number(e.amount), 0);

        weekTotal += spend;

        days.push({
          dateStr,
          label: `${dayName} ${dayNum}`,
          dayName,
          dayNum,
          spend,
          count: dayExps.length,
          isToday: dateStr === todayStr,
          isYesterday: dateStr === yesterdayStr,
        });
      }

      weeks.push({
        weekMonStr: monStr,
        weekSunStr: sunStr,
        label,
        dateRange,
        isCurrentWeek,
        days,
        weekTotal,
      });
    }

    return weeks;
  }, [typeFilteredExpenses, selectedCategory, todayStr, yesterdayStr]);

  // Auto-scroll to the rightmost week (This Week) on load or week update
  useEffect(() => {
    if (chartScrollRef.current) {
      chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
    }
  }, [weeklyWeeks]);

  // Peak Spending Day in current week
  const peakDayInfo = useMemo(() => {
    const currentWeek = weeklyWeeks[weeklyWeeks.length - 1];
    if (!currentWeek || currentWeek.days.length === 0) return null;
    const sorted = [...currentWeek.days].sort((a, b) => b.spend - a.spend);
    if (sorted[0] && sorted[0].spend > 0) {
      return sorted[0];
    }
    return null;
  }, [weeklyWeeks]);

  // Daily log breakdown
  const perDayList = useMemo(() => {
    const map: Record<string, { spend: number; income: number; items: Expense[]; categories: Record<string, number> }> = {};

    filteredExpenses.forEach(e => {
      const d = e.date;
      if (!map[d]) {
        map[d] = { spend: 0, income: 0, items: [], categories: {} };
      }
      map[d].items.push(e);
      const flow = expenseFlow(e);
      if (flow === 'out') {
        map[d].spend += Number(e.amount);
        map[d].categories[e.category] = (map[d].categories[e.category] || 0) + Number(e.amount);
      } else {
        map[d].income += Number(e.amount);
      }
    });

    return Object.entries(map)
      .map(([dateStr, data]) => {
        const topCatEntry = Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0];
        const [y, m, d] = dateStr.split('-').map(Number);
        const dObj = new Date(y, m - 1, d);
        const dayName = isNaN(dObj.getTime())
          ? dateStr
          : dObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        return {
          dateStr,
          dayName,
          spend: data.spend,
          income: data.income,
          count: data.items.length,
          items: data.items,
          topCategory: topCatEntry ? topCatEntry[0] : (data.items[0]?.category || 'General'),
          isToday: dateStr === todayStr,
          isYesterday: dateStr === yesterdayStr,
        };
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredExpenses, todayStr, yesterdayStr]);

  // Category breakdown
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
        pct: totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, totalSpent]);

  const diffTodayVsYesterday = todaySpent - yesterdaySpent;

  // Toggle date selection from bar chart or list
  const handleToggleDate = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
    } else {
      setSelectedDate(dateStr);
      setExpandedDates(prev => ({ ...prev, [dateStr]: true }));
    }
  };

  // Toggle inline row expansion in Daily Expenditure Log
  const handleToggleExpand = (dateStr: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  const handleDeleteExpense = (id: string) => {
    deleteExpense(id);
    showToast('Expense deleted');
    setDeletingId(null);
  };

  return (
    <div className="view-container" style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page-title">Analytics</h1>
        </div>
      </div>

      {/* Sleek Control Bar with Timeframe Tabs & Inline Filter Icon Widget */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div className="analytics-segmented-group" style={{ flex: 1, maxWidth: 500, marginBottom: 0 }}>
          <button
            className={`analytics-segmented-btn ${timeframe === 'this_week' ? 'active' : ''}`}
            onClick={() => setTimeframe('this_week')}
          >
            <Calendar size={13} /> Week
          </button>
          <button
            className={`analytics-segmented-btn ${timeframe === 'this_month' ? 'active' : ''}`}
            onClick={() => setTimeframe('this_month')}
          >
            Month
          </button>
          <button
            className={`analytics-segmented-btn ${timeframe === 'this_year' ? 'active' : ''}`}
            onClick={() => setTimeframe('this_year')}
          >
            Year
          </button>
          <button
            className={`analytics-segmented-btn ${timeframe === 'all' ? 'active' : ''}`}
            onClick={() => setTimeframe('all')}
          >
            All Time
          </button>

          <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px', opacity: 0.6 }} />

          {/* Icon-Only Filter Trigger on the right */}
          <div style={{ position: 'relative' }}>
            <button
              title={`Scope Filter: ${typeFilter === 'all' ? 'All Expenses' : typeFilter === 'personal' ? 'Personal Only' : 'Friend Splits'}`}
              className={`analytics-segmented-btn ${typeFilter !== 'all' || isFilterOpen ? 'active' : ''}`}
              style={{
                width: 36,
                height: 32,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <SlidersHorizontal size={15} />
              {typeFilter !== 'all' && (
                <span
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ffffff',
                    boxShadow: '0 0 4px rgba(0,0,0,0.3)',
                  }}
                />
              )}
            </button>

            {/* Expandable Dropdown Popover */}
            {isFilterOpen && (
              <>
                {/* Backdrop overlay to dismiss on click outside */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setIsFilterOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    zIndex: 50,
                    width: 210,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                    padding: 6,
                    animation: 'fadein 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', padding: '6px 10px 4px 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Filter Expense Scope
                  </div>

                  <button
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius)',
                      background: typeFilter === 'all' ? 'var(--surface2)' : 'transparent',
                      border: 'none',
                      color: typeFilter === 'all' ? 'var(--accent)' : 'var(--text)',
                      fontSize: 12.5,
                      fontWeight: typeFilter === 'all' ? 600 : 400,
                      cursor: 'pointer',
                      marginBottom: 2,
                    }}
                    onClick={() => {
                      setTypeFilter('all');
                      setIsFilterOpen(false);
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag size={14} /> All Expenses
                    </span>
                    {typeFilter === 'all' && <Check size={14} />}
                  </button>

                  <button
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius)',
                      background: typeFilter === 'personal' ? 'var(--surface2)' : 'transparent',
                      border: 'none',
                      color: typeFilter === 'personal' ? 'var(--accent)' : 'var(--text)',
                      fontSize: 12.5,
                      fontWeight: typeFilter === 'personal' ? 600 : 400,
                      cursor: 'pointer',
                      marginBottom: 2,
                    }}
                    onClick={() => {
                      setTypeFilter('personal');
                      setIsFilterOpen(false);
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Wallet size={14} /> Personal Only
                    </span>
                    {typeFilter === 'personal' && <Check size={14} />}
                  </button>

                  <button
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius)',
                      background: typeFilter === 'friend' ? 'var(--surface2)' : 'transparent',
                      border: 'none',
                      color: typeFilter === 'friend' ? 'var(--accent)' : 'var(--text)',
                      fontSize: 12.5,
                      fontWeight: typeFilter === 'friend' ? 600 : 400,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setTypeFilter('friend');
                      setIsFilterOpen(false);
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <User size={14} /> Friend / Splits
                    </span>
                    {typeFilter === 'friend' && <Check size={14} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active Filter Indicators */}
      {(selectedDate || selectedCategory) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {selectedDate && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              background: 'rgba(56, 189, 248, 0.15)', border: '1px solid var(--accent)',
              borderRadius: 99, fontSize: 12, color: 'var(--accent)', fontWeight: 600,
            }}>
              <Calendar size={13} />
              Filter Date: {selectedDate}
              <button
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                onClick={() => setSelectedDate(null)}
                title="Clear date filter"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {selectedCategory && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              background: 'rgba(168, 85, 247, 0.15)', border: '1px solid #A855F7',
              borderRadius: 99, fontSize: 12, color: '#A855F7', fontWeight: 600,
            }}>
              <Tag size={13} />
              Category: {selectedCategory}
              <button
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                onClick={() => setSelectedCategory(null)}
                title="Clear category filter"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3 Smart Context Metrics (Non-Redundant Cards) */}
      <div className="analytics-stat-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 16
      }}>
        {/* Card 1: Today's Spend */}
        <div
          className={`stat-card ${selectedDate === todayStr ? 'active-card' : ''}`}
          style={{
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: selectedDate === todayStr ? '1px solid var(--accent)' : '1px solid var(--border)',
            boxShadow: selectedDate === todayStr ? '0 0 10px var(--accent-soft)' : undefined,
          }}
          onClick={() => handleToggleDate(todayStr)}
          title="Click to inspect Today's expenses"
        >
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>
            <Sun size={13.5} style={{ color: '#F59E0B' }} /> Today
          </div>
          <div className="stat-value debit" style={{ fontSize: 20, fontWeight: 700 }}>
            {fmtMoney(todaySpent, currency)}
          </div>
          <div className="stat-sub" style={{ fontSize: 11, marginTop: 3, color: 'var(--text-3)' }}>
            {yesterdaySpent > 0 ? (
              diffTodayVsYesterday > 0 ? (
                <span style={{ color: 'var(--debit)' }}>
                  +{fmtMoney(diffTodayVsYesterday, currency)} vs yesterday
                </span>
              ) : diffTodayVsYesterday < 0 ? (
                <span style={{ color: 'var(--credit)' }}>
                  {fmtMoney(diffTodayVsYesterday, currency)} vs yesterday
                </span>
              ) : (
                <span>Same as yesterday</span>
              )
            ) : (
              <span>Yesterday: {fmtMoney(yesterdaySpent, currency)}</span>
            )}
          </div>
        </div>

        {/* Card 2: Period Total Outflow */}
        <div className="stat-card" style={{ padding: '12px 14px' }}>
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>
            <Calendar size={13.5} style={{ color: '#3B82F6' }} />
            {timeframe === 'this_week' ? 'Weekly Spend' : timeframe === 'this_month' ? 'Monthly Spend' : 'Period Spend'}
          </div>
          <div className="stat-value debit" style={{ fontSize: 20, fontWeight: 700 }}>
            {fmtMoney(totalSpent, currency)}
          </div>
          <div className="stat-sub" style={{ fontSize: 11, marginTop: 3, color: 'var(--text-3)' }}>
            Avg {fmtMoney(dailyAvgSpend, currency)} / day
          </div>
        </div>

        {/* Card 3: Peak Day */}
        <div
          className="stat-card"
          style={{
            padding: '12px 14px',
            cursor: peakDayInfo ? 'pointer' : 'default',
            border: peakDayInfo && selectedDate === peakDayInfo.dateStr ? '1px solid #F59E0B' : '1px solid var(--border)',
          }}
          onClick={() => {
            if (peakDayInfo) handleToggleDate(peakDayInfo.dateStr);
          }}
          title={peakDayInfo ? `Click to inspect peak day (${peakDayInfo.label})` : undefined}
        >
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>
            <Flame size={13.5} style={{ color: '#EF4444' }} /> Peak Day
          </div>
          <div className="stat-value debit" style={{ fontSize: 20, fontWeight: 700 }}>
            {peakDayInfo ? fmtMoney(peakDayInfo.spend, currency) : fmtMoney(0, currency)}
          </div>
          <div className="stat-sub" style={{ fontSize: 11, marginTop: 3, color: 'var(--text-3)' }}>
            {peakDayInfo ? (
              <span>{peakDayInfo.label} ({peakDayInfo.count} items)</span>
            ) : (
              <span>No peak day recorded</span>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Bar Chart with Horizontal Scroll across Past Weeks */}
      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        {/* Uncluttered Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
            <BarChart2 size={16} style={{ color: 'var(--accent)' }} />
            <span>Weekly Spending</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            Avg <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtMoney(dailyAvgSpend, currency)}</strong> / day
          </div>
        </div>

        {/* Horizontally scrollable container across past weeks */}
        <div
          ref={chartScrollRef}
          className="analytics-chart-scroll"
          style={{
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'flex-end',
              paddingTop: 12,
              paddingBottom: 4,
              minWidth: 'max-content',
            }}
          >
            {weeklyWeeks.map((week, wIdx) => {
              const isCurrent = week.isCurrentWeek;
              return (
                <div
                  key={week.weekMonStr}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    paddingRight: wIdx < weeklyWeeks.length - 1 ? 16 : 0,
                    borderRight: wIdx < weeklyWeeks.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* Week Label & Total */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    padding: '0 4px',
                  }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: isCurrent ? 700 : 600,
                      color: isCurrent ? 'var(--accent)' : 'var(--text-2)',
                    }}>
                      {week.label}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 500 }}>
                      {fmtMoney(week.weekTotal, currency)}
                    </span>
                  </div>

                  {/* 7 Days Columns */}
                  {(() => {
                    const weekMaxSpend = Math.max(...week.days.map(d => d.spend), dailyAvgSpend, 10);
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                        {week.days.map(d => {
                          const isSelected = selectedDate === d.dateStr;
                          const barHeightPct = d.spend > 0 ? Math.max(8, Math.round((d.spend / weekMaxSpend) * 100)) : 0;

                          return (
                            <div
                              key={d.dateStr}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                height: '100%',
                                cursor: 'pointer',
                                width: 36,
                              }}
                              onClick={() => handleToggleDate(d.dateStr)}
                            >
                              {/* Amount Badge directly above the bar */}
                              <div style={{ minHeight: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {d.spend > 0 ? (
                                  <span style={{
                                    fontSize: 9,
                                    fontWeight: isSelected || d.isToday ? 700 : 600,
                                    color: isSelected ? '#8B5CF6' : d.isToday ? 'var(--accent)' : 'var(--debit)',
                                    whiteSpace: 'nowrap',
                                    letterSpacing: '-0.2px',
                                    background: isSelected ? 'rgba(139, 92, 246, 0.18)' : undefined,
                                    padding: isSelected ? '1px 3px' : undefined,
                                    borderRadius: 3,
                                  }}>
                                    {fmtMoney(d.spend, currency)}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 9, color: 'var(--text-3)', opacity: 0.3 }}>-</span>
                                )}
                              </div>

                              {/* Bar Column */}
                              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: 'center', marginTop: 2 }}>
                                <div
                                  style={{
                                    width: '80%',
                                    maxWidth: 28,
                                    background: isSelected
                                      ? '#8B5CF6'
                                      : d.isToday
                                      ? 'var(--accent)'
                                      : 'var(--debit)',
                                    borderRadius: '4px 4px 0 0',
                                    height: d.spend > 0 ? `${barHeightPct}%` : '4px',
                                    opacity: d.spend > 0 ? (isSelected ? 1 : 0.88) : 0.18,
                                    transition: 'all 0.2s ease',
                                    boxShadow: isSelected
                                      ? '0 0 0 2px #8B5CF6, 0 0 12px rgba(139, 92, 246, 0.6)'
                                      : d.isToday
                                      ? '0 0 8px var(--accent-soft)'
                                      : undefined,
                                  }}
                                  title={`${d.label}: ${fmtMoney(d.spend, currency)} (${d.count} items)`}
                                />
                              </div>

                              {/* Day Label */}
                              <div style={{ marginTop: 6, textAlign: 'center' }}>
                                <span style={{
                                  fontSize: 10,
                                  color: isSelected ? '#8B5CF6' : d.isToday ? 'var(--accent)' : 'var(--text-2)',
                                  fontWeight: isSelected || d.isToday ? 700 : 500,
                                  whiteSpace: 'nowrap',
                                  display: 'block',
                                }}>
                                  {d.label}
                                </span>
                                {d.isToday && (
                                  <span style={{ fontSize: 8, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                    TODAY
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'var(--text-3)', paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, background: 'var(--debit)', borderRadius: 2 }} /> Past Days
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: 2 }} /> Today
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, background: '#8B5CF6', borderRadius: 2 }} /> Selected Day
          </div>
        </div>
      </div>

      {/* Grid: Daily Expenditure Log & Category Share */}
      <div className="dashboard-grid" style={{ gap: 16 }}>
        {/* Daily Log List (Interactive & Expandable) */}
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 auto' }}>
              <Award size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Daily Expenditure Log</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', flexShrink: 0 }}>
                ({perDayList.length} {perDayList.length === 1 ? 'day' : 'days'})
              </span>
            </div>
            {selectedDate && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '3px 10px', height: 26, whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => setSelectedDate(null)}
              >
                Clear Date
              </button>
            )}
          </div>

          {perDayList.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '24px 0', textAlign: 'center' }}>
              No transactions recorded for this selection
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {perDayList.map(row => {
                const catObj = db.settings.categories.find(c => c.name === row.topCategory);
                const isExpanded = Boolean(expandedDates[row.dateStr] || selectedDate === row.dateStr);

                return (
                  <div
                    key={row.dateStr}
                    style={{
                      background: 'var(--surface2)',
                      borderRadius: 8,
                      border: selectedDate === row.dateStr ? '1px solid #8B5CF6' : '1px solid var(--border)',
                      boxShadow: selectedDate === row.dateStr ? '0 0 10px rgba(139, 92, 246, 0.2)' : undefined,
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Day Row Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontSize: 12.5,
                        gap: 8,
                        userSelect: 'none',
                      }}
                      onClick={() => handleToggleExpand(row.dateStr)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                        <CategoryBadge category={row.topCategory} color={catObj?.color} icon={catObj?.icon} size={14} showLabel={false} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{row.dayName}</span>
                            {row.isToday && <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent)', fontSize: 9, padding: '1px 5px' }}>Today</span>}
                            {row.isYesterday && <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6', fontSize: 9, padding: '1px 5px' }}>Yest.</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.count} {row.count === 1 ? 'item' : 'items'} · {row.topCategory}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13.5, color: row.spend > 0 ? 'var(--debit)' : 'var(--credit)', whiteSpace: 'nowrap' }}>
                          {fmtMoney(row.spend, currency)}
                        </div>
                        <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', padding: '2px', flexShrink: 0 }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Itemized Transactions List */}
                    {isExpanded && (
                      <div style={{
                        borderTop: '1px solid var(--border)',
                        background: 'var(--surface)',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        animation: 'fadein 0.15s ease',
                      }}>
                        {row.items.map(item => {
                          const isDebit = expenseFlow(item) === 'out';
                          const itemCat = db.settings.categories.find(c => c.name === item.category);
                          const walletObj = wallets.find(w => w.id === item.walletId);
                          const friendObj = friends.find(f => f.id === item.friendId);

                          return (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                borderRadius: 6,
                                background: 'var(--surface2)',
                                gap: 8,
                                fontSize: 12,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                <CategoryBadge category={item.category} color={itemCat?.color} icon={itemCat?.icon} size={13} showLabel={false} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.description || 'Expense'}
                                  </div>
                                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                    {item.type === 'personal' ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                        <Wallet size={10} /> {walletObj?.name || 'Personal'}
                                      </span>
                                    ) : (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--accent)' }}>
                                        <User size={10} /> {item.type === 'by_friend' ? `Paid by ${friendObj?.name || 'Friend'}` : `Split with ${friendObj?.name || 'Friend'}`}
                                      </span>
                                    )}
                                    <span>·</span>
                                    <span style={{
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                      fontSize: 9.5,
                                      fontWeight: 600,
                                      background: item.status === 'paid' || item.settled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: item.status === 'paid' || item.settled ? '#22C55E' : '#EF4444',
                                      textTransform: 'capitalize',
                                    }}>
                                      {item.settled ? 'Settled' : item.status}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <div style={{
                                  fontWeight: 700,
                                  fontSize: 12.5,
                                  color: isDebit ? 'var(--debit)' : 'var(--credit)',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {isDebit ? '-' : '+'}{fmtMoney(item.amount, currency)}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                  <button
                                    className="btn-icon"
                                    style={{ width: 26, height: 26, padding: 0, borderRadius: 6, flexShrink: 0 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingExpense(item);
                                    }}
                                    title="Edit expense"
                                  >
                                    <Edit2 size={12} />
                                  </button>

                                  <button
                                    className="btn-icon"
                                    style={{ width: 26, height: 26, padding: 0, borderRadius: 6, flexShrink: 0, color: '#EF4444' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingId(item.id);
                                    }}
                                    title="Delete expense"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Share */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <PieChart size={15} style={{ color: 'var(--accent)' }} /> Category Distribution
            </div>
            {selectedCategory && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => setSelectedCategory(null)}
              >
                Clear Category
              </button>
            )}
          </div>

          {categoryBreakdown.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '20px 0', textAlign: 'center' }}>
              No categories to display
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {categoryBreakdown.map(({ cat, amount, pct, count }) => {
                const catObj = db.settings.categories.find(c => c.name === cat);
                const catColor = catObj?.color ?? '#6B7280';
                const isSelectedCat = selectedCategory === cat;

                return (
                  <div
                    key={cat}
                    style={{
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: isSelectedCat ? 'var(--surface2)' : 'transparent',
                      border: isSelectedCat ? '1px solid var(--accent)' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setSelectedCategory(isSelectedCat ? null : cat)}
                    title={`Click to filter by ${cat}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CategoryBadge category={cat} color={catColor} icon={catObj?.icon} size={13} />
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({count})</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontWeight: 600 }}>
                        <span style={{ color: 'var(--text-3)' }}>{Math.round(pct)}%</span>
                        <span>{fmtMoney(amount, currency)}</span>
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

      {/* Edit Expense Modal */}
      {editingExpense && (
        <ExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}

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
