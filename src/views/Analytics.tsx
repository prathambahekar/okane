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
  ChevronDown,
  ChevronUp,
  X,
  Edit2,
  Trash2,
  Wallet,
  User,
  Tag,
  Award,
  Check
} from 'lucide-react';

function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Analytics() {
  const { db, deleteExpense, showToast } = useStore();
  const { expenses, wallets, friends, settings: { currency } } = db;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'weekly' | 'monthly'>('weekly');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
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

  // Base expense filter
  const typeFilteredExpenses = expenses;

  // Filtered expenses according to category, date, or month
  const filteredExpenses = useMemo(() => {
    return typeFilteredExpenses.filter(e => {
      if (selectedCategory && e.category !== selectedCategory) return false;
      if (selectedDate) return e.date === selectedDate;
      if (selectedMonth) return e.date.slice(0, 7) === selectedMonth;
      return true;
    });
  }, [typeFilteredExpenses, selectedCategory, selectedDate, selectedMonth]);

  // Outflow total
  const totalSpent = useMemo(() =>
    filteredExpenses.filter(e => expenseFlow(e) === 'out').reduce((sum, e) => sum + Number(e.amount), 0),
  [filteredExpenses]);

  // Days in selected timeframe or selected month
  const daysInPeriod = useMemo(() => {
    if (selectedDate) return 1;
    if (selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      const isCurrentM = selectedMonth === todayStr.slice(0, 7);
      const totalDaysInM = new Date(y, m, 0).getDate();
      return Math.max(1, isCurrentM ? Math.min(now.getDate(), totalDaysInM) : totalDaysInM);
    }
    if (typeFilteredExpenses.length === 0) return 30;
    const dates = typeFilteredExpenses.map(e => new Date(e.date).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return 30;
    const minDate = Math.min(...dates);
    const diffDays = Math.ceil((now.getTime() - minDate) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [now, typeFilteredExpenses, selectedDate, selectedMonth, todayStr]);

  const dailyAvgSpend = totalSpent / daysInPeriod;

  const chartScrollRef = useRef<HTMLDivElement>(null);

  // Multi-month Chart Data for Interactive Monthly Spending Chart
  const monthlyMonths = useMemo(() => {
    const baseList = typeFilteredExpenses.filter(e => !selectedCategory || e.category === selectedCategory);
    const currentMonthKey = todayStr.slice(0, 7);

    let numMonths = 12;
    if (baseList.length > 0) {
      const earliest = baseList.reduce((min, e) => (e.date < min ? e.date : min), todayStr);
      const [ey, em] = earliest.split('-').map(Number);
      const [cy, cm] = todayStr.split('-').map(Number);
      const monthsDiff = (cy - ey) * 12 + (cm - em) + 1;
      numMonths = Math.max(6, Math.min(24, monthsDiff));
    }

    const [cy, cm] = todayStr.split('-').map(Number);
    const months = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(cy, cm - 1 - i, 1);
      const monthKey = `${d.getFullYear()}-${padZero(d.getMonth() + 1)}`;
      const monthName = d.toLocaleDateString(undefined, { month: 'short' });
      const fullMonthName = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      const isCurrentMonth = monthKey === currentMonthKey;

      const monthExps = baseList.filter(e => e.date.slice(0, 7) === monthKey);
      const spend = monthExps.filter(e => expenseFlow(e) === 'out').reduce((s, e) => s + Number(e.amount), 0);
      const count = monthExps.length;

      const daysInM = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const daysPassed = isCurrentMonth ? Math.min(now.getDate(), daysInM) : daysInM;
      const dailyAvg = spend / Math.max(1, daysPassed);

      months.push({
        monthKey,
        year: d.getFullYear(),
        monthName,
        fullMonthName,
        isCurrentMonth,
        spend,
        count,
        dailyAvg,
      });
    }

    return months;
  }, [typeFilteredExpenses, selectedCategory, todayStr, now]);

  const maxMonthlyVal = useMemo(() => {
    return Math.max(...monthlyMonths.map(m => m.spend), dailyAvgSpend, 10);
  }, [monthlyMonths, dailyAvgSpend]);

  // Selected Month details
  const selectedMonthObj = useMemo(() => {
    if (!selectedMonth) return null;
    return monthlyMonths.find(m => m.monthKey === selectedMonth) || null;
  }, [selectedMonth, monthlyMonths]);

  // Multi-week Chart Data for Horizontal Scrolling across Past Weeks or Weeks of Selected Month
  const weeklyWeeks = useMemo(() => {
    const baseList = typeFilteredExpenses.filter(e => !selectedCategory || e.category === selectedCategory);

    if (selectedMonth) {
      const [sy, sm] = selectedMonth.split('-').map(Number);
      const firstDayOfMonth = new Date(sy, sm - 1, 1);
      const lastDayOfMonth = new Date(sy, sm, 0);

      const firstDayOfWeek = firstDayOfMonth.getDay();
      const diffToMon = (firstDayOfWeek + 6) % 7;
      const startMon = new Date(sy, sm - 1, 1 - diffToMon);

      const weeks = [];
      let currentMon = new Date(startMon);
      let weekIndex = 1;

      while (currentMon <= lastDayOfMonth) {
        const mon = new Date(currentMon);
        const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);

        const monStr = formatISO(mon);
        const sunStr = formatISO(sun);

        const monMonth = mon.toLocaleDateString(undefined, { month: 'short' });
        const sunMonth = sun.toLocaleDateString(undefined, { month: 'short' });
        const dateRange = monMonth === sunMonth
          ? `${monMonth} ${mon.getDate()}–${sun.getDate()}`
          : `${monMonth} ${mon.getDate()} – ${sunMonth} ${sun.getDate()}`;

        const isCurrentWeek = monStr <= todayStr && todayStr <= sunStr;
        const label = `Week ${weekIndex} (${dateRange})`;

        const days = [];
        let weekTotal = 0;

        for (let i = 0; i < 7; i++) {
          const cur = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
          const dateStr = formatISO(cur);
          const dayName = cur.toLocaleDateString(undefined, { weekday: 'short' });
          const dayNum = cur.getDate();

          const inSelectedMonth = dateStr.slice(0, 7) === selectedMonth;
          const dayExps = baseList.filter(e => e.date === dateStr && inSelectedMonth);
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
            inSelectedMonth,
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

        currentMon = new Date(currentMon.getFullYear(), currentMon.getMonth(), currentMon.getDate() + 7);
        weekIndex++;
      }

      return weeks;
    }

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
          inSelectedMonth: true,
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
  }, [typeFilteredExpenses, selectedCategory, selectedMonth, todayStr, yesterdayStr]);

  // Auto-scroll to the rightmost week (This Week) on load or week update
  useEffect(() => {
    if (chartScrollRef.current) {
      chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
    }
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

      {/* Active Filter Indicators */}
      {(selectedDate || selectedMonth || selectedCategory) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {selectedDate && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              background: 'rgba(56, 189, 248, 0.15)', border: '1px solid var(--accent)',
              borderRadius: 99, fontSize: 12, color: 'var(--accent)', fontWeight: 600,
            }}>
              <Calendar size={13} />
              Date: {formatDateLabel(selectedDate)}
              <button
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                onClick={() => setSelectedDate(null)}
                title="Clear date filter"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {selectedMonth && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              background: 'rgba(139, 92, 246, 0.15)', border: '1px solid #8B5CF6',
              borderRadius: 99, fontSize: 12, color: '#8B5CF6', fontWeight: 600,
            }}>
              <Calendar size={13} />
              Month: {selectedMonthObj?.fullMonthName || selectedMonth}
              <button
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                onClick={() => setSelectedMonth(null)}
                title="Clear month filter"
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

      {/* Spending Bar Chart (Interactive Weekly / Monthly View) */}
      <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
        {/* Uncluttered Header with View Mode Switcher and Month Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
              <BarChart2 size={16} style={{ color: 'var(--accent)' }} />
              <span>
                {chartMode === 'monthly'
                  ? 'Monthly Spending'
                  : selectedMonthObj
                  ? `Weekly Spending (${selectedMonthObj.fullMonthName})`
                  : 'Weekly Spending'}
              </span>
            </div>

            {/* Custom Month Selector Popover */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius)',
                  border: selectedMonth ? '1px solid #8B5CF6' : '1px solid var(--border)',
                  background: selectedMonth ? 'rgba(139, 92, 246, 0.12)' : 'var(--surface2)',
                  color: selectedMonth ? '#8B5CF6' : 'var(--text-2)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Calendar size={12} style={{ color: selectedMonth ? '#8B5CF6' : 'var(--text-3)' }} />
                <span>{selectedMonthObj ? selectedMonthObj.fullMonthName : 'All Months (Rolling)'}</span>
                <ChevronDown size={12} style={{ opacity: 0.7, transform: isMonthPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {isMonthPickerOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => setIsMonthPickerOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      zIndex: 100,
                      width: 230,
                      maxHeight: 280,
                      overflowY: 'auto',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.35), 0 4px 10px -2px rgba(0,0,0,0.2)',
                      padding: 5,
                      animation: 'fadein 0.15s ease',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMonth(null);
                        setSelectedDate(null);
                        setIsMonthPickerOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius)',
                        background: !selectedMonth ? 'var(--surface2)' : 'transparent',
                        border: 'none',
                        color: !selectedMonth ? 'var(--accent)' : 'var(--text)',
                        fontSize: 12,
                        fontWeight: !selectedMonth ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>All Months (Rolling)</span>
                      {!selectedMonth && <Check size={14} style={{ color: 'var(--accent)' }} />}
                    </button>

                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

                    {monthlyMonths.map((m) => {
                      const isSelected = selectedMonth === m.monthKey;
                      return (
                        <button
                          key={m.monthKey}
                          type="button"
                          onClick={() => {
                            setSelectedMonth(m.monthKey);
                            setSelectedDate(null);
                            setChartMode('weekly');
                            setIsMonthPickerOpen(false);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            borderRadius: 'var(--radius)',
                            background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                            border: 'none',
                            color: isSelected ? '#8B5CF6' : 'var(--text)',
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={12} style={{ opacity: 0.6 }} />
                            <span>{m.fullMonthName}</span>
                          </div>
                          <span style={{ fontSize: 11, color: isSelected ? '#8B5CF6' : 'var(--text-3)', fontWeight: 600 }}>
                            {fmtMoney(m.spend, currency)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--text-2)',
                background: 'var(--surface2)',
                padding: '4px 9px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>Avg</span>
              <strong style={{ color: 'var(--text)', fontWeight: 700 }}>
                {fmtMoney(
                  chartMode === 'monthly'
                    ? monthlyMonths.reduce((s, m) => s + m.spend, 0) / Math.max(1, monthlyMonths.length)
                    : dailyAvgSpend,
                  currency
                )}
              </strong>
              <span>/ {chartMode === 'monthly' ? 'month' : 'day'}</span>
            </div>

            {/* Toggle between Weekly & Monthly Chart */}
            <div className="analytics-segmented-group" style={{ marginBottom: 0, padding: 2, flexShrink: 0 }}>
              <button
                className={`analytics-segmented-btn ${chartMode === 'weekly' ? 'active' : ''}`}
                style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                onClick={() => setChartMode('weekly')}
              >
                Weekly
              </button>
              <button
                className={`analytics-segmented-btn ${chartMode === 'monthly' ? 'active' : ''}`}
                style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                onClick={() => setChartMode('monthly')}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>

        {/* Chart Content Container */}
        {chartMode === 'monthly' ? (
          /* Horizontally Scrollable Interactive Monthly Spending Chart */
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
                gap: 14,
                alignItems: 'flex-end',
                paddingTop: 16,
                paddingBottom: 6,
                minWidth: 'max-content',
              }}
            >
              {monthlyMonths.map((m) => {
                const isSelected = selectedMonth === m.monthKey;
                const barHeightPct = m.spend > 0 ? Math.max(10, Math.round((m.spend / maxMonthlyVal) * 100)) : 0;

                return (
                  <div
                    key={m.monthKey}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: 160,
                      cursor: 'pointer',
                      width: 54,
                    }}
                    onClick={() => {
                      if (selectedMonth === m.monthKey) {
                        setSelectedMonth(null);
                      } else {
                        setSelectedMonth(m.monthKey);
                        setSelectedDate(null);
                        setChartMode('weekly');
                      }
                    }}
                  >
                    {/* Amount Badge directly above the bar */}
                    <div style={{ minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      {m.spend > 0 ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: isSelected || m.isCurrentMonth ? 700 : 600,
                            color: isSelected ? '#8B5CF6' : m.isCurrentMonth ? 'var(--accent)' : 'var(--debit)',
                            whiteSpace: 'nowrap',
                            letterSpacing: '-0.2px',
                            background: isSelected ? 'rgba(139, 92, 246, 0.18)' : undefined,
                            padding: isSelected ? '1px 5px' : undefined,
                            borderRadius: 4,
                          }}
                        >
                          {fmtMoney(m.spend, currency)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-3)', opacity: 0.3 }}>-</span>
                      )}
                    </div>

                    {/* Bar Column */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: 'center', marginTop: 4 }}>
                      <div
                        style={{
                          width: 32,
                          background: isSelected
                            ? '#8B5CF6'
                            : m.isCurrentMonth
                            ? 'var(--accent)'
                            : 'var(--debit)',
                          borderRadius: '6px 6px 0 0',
                          height: m.spend > 0 ? `${barHeightPct}%` : '4px',
                          opacity: m.spend > 0 ? (isSelected ? 1 : 0.88) : 0.2,
                          transition: 'all 0.25s ease',
                          boxShadow: isSelected
                            ? '0 0 0 2px #8B5CF6, 0 0 14px rgba(139, 92, 246, 0.6)'
                            : m.isCurrentMonth
                            ? '0 0 10px var(--accent-soft)'
                            : undefined,
                        }}
                        title={`${m.fullMonthName}: ${fmtMoney(m.spend, currency)} (${m.count} items, Avg ${fmtMoney(m.dailyAvg, currency)}/day)`}
                      />
                    </div>

                    {/* Month Label */}
                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: isSelected ? '#8B5CF6' : m.isCurrentMonth ? 'var(--accent)' : 'var(--text-2)',
                          fontWeight: isSelected || m.isCurrentMonth ? 700 : 500,
                          whiteSpace: 'nowrap',
                          display: 'block',
                        }}
                      >
                        {m.monthName}
                      </span>
                      {m.isCurrentMonth && (
                        <span style={{ fontSize: 8, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          NOW
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Horizontally scrollable container across past weeks */
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
        )}

        {/* Chart Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'var(--text-3)', paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {chartMode === 'monthly' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, background: 'var(--debit)', borderRadius: 2 }} /> Past Months
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: 2 }} /> Current Month
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, background: '#8B5CF6', borderRadius: 2 }} /> Selected Month
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, background: 'var(--debit)', borderRadius: 2 }} /> Past Days
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: 2 }} /> Today
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, background: '#8B5CF6', borderRadius: 2 }} /> Selected Day
              </div>
            </>
          )}
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
