import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { fmtMoney, groupExpenses, type GroupedExpense } from '../utils';
import { CategoryBadge } from '../components/CategoryIcon';
import ExpenseModal from '../components/ExpenseModal';
import ExpenseDetailDrawer from '../components/ExpenseDetailDrawer';
import type { Expense } from '../types';
import {
  BarChart2,
  PieChart,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Wallet,
  User,
  Award,
  Check,
  X
} from 'lucide-react';

function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function fmtCompactMoney(amount: number, currency: string): string {
  if (amount === 0) return '-';
  const sym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  if (amount >= 1000000) {
    const val = (amount / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${sym}${val}M`;
  }
  if (amount >= 10000) {
    const val = (amount / 1000).toFixed(1).replace(/\.0$/, '');
    return `${sym}${val}k`;
  }
  return `${sym}${Math.round(amount).toLocaleString()}`;
}

export default function Analytics() {
  const { db, deleteExpense, showToast } = useStore();
  const { expenses, wallets, settings: { currency } } = db;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'weekly' | 'monthly'>('weekly');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [selectedGroupExpense, setSelectedGroupExpense] = useState<GroupedExpense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);

  // Lock body scroll when Category Drawer is open
  useEffect(() => {
    if (showCategoryDrawer) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [showCategoryDrawer]);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatISO(now), [now]);

  const yesterdayStr = useMemo(() => {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return formatISO(y);
  }, [now]);

  // Base expense filter using grouped expenses
  const groupedExpenses = useMemo(() => groupExpenses(expenses, wallets), [expenses, wallets]);

  // Filtered expenses according to category, date, week, or month
  const filteredExpenses = useMemo(() => {
    return groupedExpenses.filter(ge => {
      if (selectedCategory && ge.category !== selectedCategory) return false;
      if (selectedDate) return ge.date === selectedDate;
      if (chartMode === 'weekly' && selectedWeek) {
        const [wy, wm, wd] = selectedWeek.split('-').map(Number);
        const monD = new Date(wy, wm - 1, wd);
        const sunD = new Date(monD.getFullYear(), monD.getMonth(), monD.getDate() + 6);
        const sunStr = formatISO(sunD);
        if (ge.date < selectedWeek || ge.date > sunStr) return false;
      } else if (chartMode === 'monthly' && selectedMonth) {
        if (ge.date.slice(0, 7) !== selectedMonth) return false;
      }
      return true;
    });
  }, [groupedExpenses, selectedCategory, selectedDate, chartMode, selectedWeek, selectedMonth]);

  // Timeframe expenses (ignoring selectedCategory filter so drawer shows full distribution)
  const timeframeExpenses = useMemo(() => {
    return groupedExpenses.filter(ge => {
      if (selectedDate) return ge.date === selectedDate;
      if (chartMode === 'weekly' && selectedWeek) {
        const [wy, wm, wd] = selectedWeek.split('-').map(Number);
        const monD = new Date(wy, wm - 1, wd);
        const sunD = new Date(monD.getFullYear(), monD.getMonth(), monD.getDate() + 6);
        const sunStr = formatISO(sunD);
        if (ge.date < selectedWeek || ge.date > sunStr) return false;
      } else if (chartMode === 'monthly' && selectedMonth) {
        if (ge.date.slice(0, 7) !== selectedMonth) return false;
      }
      return true;
    });
  }, [groupedExpenses, selectedDate, chartMode, selectedWeek, selectedMonth]);

  // Outflow total for filtered view
  const totalSpent = useMemo(() =>
    filteredExpenses.filter(ge => ge.flow === 'out').reduce((sum, ge) => sum + Number(ge.totalAmount), 0),
  [filteredExpenses]);

  // Outflow total across the active timeframe (for category share % and summary)
  const timeframeOutflowTotal = useMemo(() =>
    timeframeExpenses.filter(ge => ge.flow === 'out').reduce((sum, ge) => sum + Number(ge.totalAmount), 0),
  [timeframeExpenses]);

  // Days in selected timeframe or selected month / week
  const daysInPeriod = useMemo(() => {
    if (selectedDate) return 1;
    if (chartMode === 'weekly' && selectedWeek) return 7;
    if (chartMode === 'monthly' && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      const isCurrentM = selectedMonth === todayStr.slice(0, 7);
      const totalDaysInM = new Date(y, m, 0).getDate();
      return Math.max(1, isCurrentM ? Math.min(now.getDate(), totalDaysInM) : totalDaysInM);
    }
    if (groupedExpenses.length === 0) return 30;
    const dates = groupedExpenses.map(ge => new Date(ge.date).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return 30;
    const minDate = Math.min(...dates);
    const diffDays = Math.ceil((now.getTime() - minDate) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [now, groupedExpenses, selectedDate, chartMode, selectedWeek, selectedMonth, todayStr]);

  const dailyAvgSpend = totalSpent / daysInPeriod;

  const chartScrollRef = useRef<HTMLDivElement>(null);

  // Desktop mouse drag-to-scroll & wheel scrolling
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftStart, setScrollLeftStart] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const isWheelScrolling = useRef(false);

  useEffect(() => {
    const el = chartScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 5) return;

      e.preventDefault();

      if (isWheelScrolling.current) return;
      isWheelScrolling.current = true;

      const step = el.clientWidth;
      const dir = delta > 0 ? 1 : -1;
      el.scrollBy({ left: dir * step, behavior: 'smooth' });

      setTimeout(() => {
        isWheelScrolling.current = false;
      }, 300);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [chartMode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = chartScrollRef.current;
    if (!el) return;
    setIsMouseDown(true);
    setHasMoved(false);
    setStartX(e.clientX);
    setScrollLeftStart(el.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown) return;
    const el = chartScrollRef.current;
    if (!el) return;
    e.preventDefault();
    const diff = e.clientX - startX;
    if (Math.abs(diff) > 5) {
      setHasMoved(true);
    }
    el.scrollLeft = scrollLeftStart - diff;
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent) => {
    if (!isMouseDown) return;
    setIsMouseDown(false);

    const el = chartScrollRef.current;
    if (!el) return;

    const diff = e.clientX - startX;
    if (Math.abs(diff) > 20) {
      const dir = diff < 0 ? 1 : -1;
      const targetScroll = scrollLeftStart + dir * el.clientWidth;
      el.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  };

  // Multi-month Chart Data for Interactive Monthly Spending Chart
  const monthlyMonths = useMemo(() => {
    const baseList = groupedExpenses.filter(ge => !selectedCategory || ge.category === selectedCategory);
    const currentMonthKey = todayStr.slice(0, 7);

    let numMonths = 12;
    if (baseList.length > 0) {
      const earliest = baseList.reduce((min, ge) => (ge.date < min ? ge.date : min), todayStr);
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

      const monthExps = baseList.filter(ge => ge.date.slice(0, 7) === monthKey);
      const spend = monthExps.filter(ge => ge.flow === 'out').reduce((s, ge) => s + Number(ge.totalAmount), 0);
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
  }, [groupedExpenses, selectedCategory, todayStr, now]);

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
    const baseList = groupedExpenses.filter(ge => !selectedCategory || ge.category === selectedCategory);

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
          const dayExps = baseList.filter(ge => ge.date === dateStr && inSelectedMonth);
          const spend = dayExps.filter(ge => ge.flow === 'out').reduce((s, ge) => s + Number(ge.totalAmount), 0);

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
      const earliest = baseList.reduce((min, ge) => (ge.date < min ? ge.date : min), todayStr);
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
        const dayExps = baseList.filter(ge => ge.date === dateStr);
        const spend = dayExps.filter(ge => ge.flow === 'out').reduce((s, ge) => s + Number(ge.totalAmount), 0);

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
  }, [groupedExpenses, selectedCategory, selectedMonth, todayStr, yesterdayStr]);

  // Selected Week details
  const selectedWeekObj = useMemo(() => {
    if (!selectedWeek) return null;
    return weeklyWeeks.find(w => w.weekMonStr === selectedWeek) || null;
  }, [selectedWeek, weeklyWeeks]);

  // Auto-scroll when selectedWeek or chartMode changes
  useEffect(() => {
    if (!chartScrollRef.current) return;
    if (chartMode === 'weekly') {
      if (selectedWeek) {
        const target = chartScrollRef.current.querySelector(`[data-week-id="${selectedWeek}"]`) as HTMLElement;
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
      } else {
        chartScrollRef.current.scrollTo({ left: chartScrollRef.current.scrollWidth, behavior: 'smooth' });
      }
    }
  }, [selectedWeek, chartMode]);

  // Initial scroll to rightmost week (This Week) on load or week list recalculation
  useEffect(() => {
    if (chartScrollRef.current && chartMode === 'weekly' && !selectedWeek) {
      chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
    }
  }, [weeklyWeeks, chartMode, selectedWeek]);

  // Daily log breakdown
  const perDayList = useMemo(() => {
    const map: Record<string, { spend: number; income: number; items: GroupedExpense[]; categories: Record<string, number> }> = {};

    filteredExpenses.forEach(ge => {
      const d = ge.date;
      if (!map[d]) {
        map[d] = { spend: 0, income: 0, items: [], categories: {} };
      }
      map[d].items.push(ge);
      if (ge.flow === 'out') {
        map[d].spend += Number(ge.totalAmount);
        map[d].categories[ge.category] = (map[d].categories[ge.category] || 0) + Number(ge.totalAmount);
      } else {
        map[d].income += Number(ge.totalAmount);
        map[d].categories[ge.category] = (map[d].categories[ge.category] || 0) + Number(ge.totalAmount);
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
    timeframeExpenses.forEach(ge => {
      if (ge.flow !== 'out') return;
      if (!map[ge.category]) map[ge.category] = { amount: 0, count: 0 };
      map[ge.category].amount += Number(ge.totalAmount);
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
  }, [timeframeExpenses, timeframeOutflowTotal]);

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

      {/* Spending Bar Chart (Interactive Weekly / Monthly View) */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        {/* Top Header Row: Title & Icon on Left, Segmented Control on Right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <BarChart2 size={16} strokeWidth={2.2} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                {chartMode === 'monthly' ? 'Monthly Spending' : 'Weekly Spending'}
              </h3>
            </div>
          </div>

          {/* Segmented Mode Switcher */}
          <div style={{ display: 'inline-flex', background: 'var(--surface2)', padding: 3, borderRadius: 'var(--radius)', border: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                setChartMode('weekly');
                setSelectedMonth(null);
                setSelectedDate(null);
                setIsPickerOpen(false);
              }}
              style={{
                padding: '4px 11px',
                fontSize: 12,
                fontWeight: chartMode === 'weekly' ? 650 : 500,
                borderRadius: 6,
                border: 'none',
                background: chartMode === 'weekly' ? 'var(--accent)' : 'transparent',
                color: chartMode === 'weekly' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => {
                setChartMode('monthly');
                setSelectedWeek(null);
                setSelectedDate(null);
                setIsPickerOpen(false);
              }}
              style={{
                padding: '4px 11px',
                fontSize: 12,
                fontWeight: chartMode === 'monthly' ? 650 : 500,
                borderRadius: 6,
                border: 'none',
                background: chartMode === 'monthly' ? 'var(--accent)' : 'transparent',
                color: chartMode === 'monthly' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Sub Header Toolbar Row: Period Filter Dropdown on Left, Average Metric Badge and Nav Arrows on Right */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          {/* Custom Period (Week / Month) Selector Popover */}
          <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: selectedWeekObj ? '4px 10px' : '6px 11px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: (chartMode === 'weekly' ? selectedWeek : selectedMonth) ? 'var(--accent-soft)' : 'var(--surface2)',
                color: (chartMode === 'weekly' ? selectedWeek : selectedMonth) ? 'var(--accent)' : 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Calendar size={13} style={{ color: (chartMode === 'weekly' ? selectedWeek : selectedMonth) ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }} />
              {chartMode === 'weekly' ? (
                selectedWeekObj ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', lineHeight: 1.25 }}>
                    <span style={{ fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap' }}>{selectedWeekObj.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.85, color: 'inherit', whiteSpace: 'nowrap' }}>
                      ({selectedWeekObj.dateRange})
                    </span>
                  </div>
                ) : (
                  <span style={{ whiteSpace: 'nowrap' }}>All Weeks</span>
                )
              ) : (
                <span style={{ whiteSpace: 'nowrap' }}>{selectedMonthObj ? selectedMonthObj.fullMonthName : 'All Months'}</span>
              )}
              <ChevronDown size={13} style={{ opacity: 0.7, transform: isPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
            </button>

            {isPickerOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setIsPickerOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    zIndex: 100,
                    width: 250,
                    maxHeight: 280,
                    overflowY: 'auto',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                    padding: 5,
                    animation: 'fadein 0.15s ease',
                  }}
                >
                  {chartMode === 'weekly' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWeek(null);
                          setSelectedDate(null);
                          setIsPickerOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius)',
                          background: !selectedWeek ? 'var(--surface2)' : 'transparent',
                          border: 'none',
                          color: !selectedWeek ? 'var(--accent)' : 'var(--text)',
                          fontSize: 12,
                          fontWeight: !selectedWeek ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span>All Weeks</span>
                        {!selectedWeek && <Check size={14} style={{ color: 'var(--accent)' }} />}
                      </button>

                      {[...weeklyWeeks].reverse().map((w) => {
                        const isSelected = selectedWeek === w.weekMonStr;
                        return (
                          <button
                            key={w.weekMonStr}
                            type="button"
                            onClick={() => {
                              setSelectedWeek(w.weekMonStr);
                              setSelectedDate(null);
                              setIsPickerOpen(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              borderRadius: 'var(--radius)',
                              background: isSelected ? 'var(--accent-soft)' : 'transparent',
                              border: 'none',
                              color: isSelected ? 'var(--accent)' : 'var(--text)',
                              fontSize: 12,
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calendar size={12} style={{ opacity: 0.6 }} />
                                <span>{w.label}</span>
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--text-3)', paddingLeft: 18 }}>
                                {w.dateRange}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: isSelected ? 'var(--accent)' : 'var(--text-3)', fontWeight: 600 }}>
                              {fmtMoney(w.weekTotal, currency)}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMonth(null);
                          setSelectedDate(null);
                          setIsPickerOpen(false);
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
                        <span>All Months</span>
                        {!selectedMonth && <Check size={14} style={{ color: 'var(--accent)' }} />}
                      </button>

                      {monthlyMonths.map((m) => {
                        const isSelected = selectedMonth === m.monthKey;
                        return (
                          <button
                            key={m.monthKey}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(m.monthKey);
                              setSelectedDate(null);
                              setIsPickerOpen(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              borderRadius: 'var(--radius)',
                              background: isSelected ? 'var(--accent-soft)' : 'transparent',
                              border: 'none',
                              color: isSelected ? 'var(--accent)' : 'var(--text)',
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
                            <span style={{ fontSize: 11, color: isSelected ? 'var(--accent)' : 'var(--text-3)', fontWeight: 600 }}>
                              {fmtMoney(m.spend, currency)}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Average Metric Badge (Top) & Scroll Arrows (Below) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-2)',
                background: 'var(--surface2)',
                padding: '4px 10px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>Avg</span>
              <strong style={{ color: 'var(--text)', fontWeight: 700 }}>
                {fmtMoney(
                  chartMode === 'monthly'
                    ? monthlyMonths.reduce((s, m) => s + m.spend, 0) / Math.max(1, monthlyMonths.length)
                    : dailyAvgSpend,
                  currency
                )}
              </strong>
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>/ {chartMode === 'monthly' ? 'month' : 'day'}</span>
            </div>

            {/* Prev / Next Scroll Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                title="Previous"
                onClick={() => {
                  const el = chartScrollRef.current;
                  if (!el) return;
                  el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
                }}
                style={{
                  height: 24,
                  padding: '0 8px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text-2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.borderColor = 'var(--border2, var(--border))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-2)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>
              <button
                type="button"
                title="Next"
                onClick={() => {
                  const el = chartScrollRef.current;
                  if (!el) return;
                  el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
                }}
                style={{
                  height: 24,
                  padding: '0 8px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text-2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.borderColor = 'var(--border2, var(--border))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-2)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Chart Content Container */}
        {chartMode === 'monthly' ? (
          /* Horizontally Scrollable Interactive Monthly Spending Chart Container */
          <div
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 14px 12px 14px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <div
              ref={chartScrollRef}
              className="analytics-chart-scroll"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              style={{
                position: 'relative',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                cursor: isMouseDown ? 'grabbing' : 'grab',
                userSelect: isMouseDown ? 'none' : 'auto',
                scrollBehavior: 'smooth',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: 6,
                  width: '100%',
                  minWidth: monthlyMonths.length > 8 ? `${monthlyMonths.length * 56}px` : '100%',
                  height: 180,
                  position: 'relative',
                  zIndex: 1,
                  boxSizing: 'border-box',
                }}
              >
                {monthlyMonths.map((m) => {
                  const isSelected = selectedMonth === m.monthKey;
                  const barHeightPct = m.spend > 0 ? Math.max(10, Math.round((m.spend / maxMonthlyVal) * 100)) : 0;

                  return (
                    <div
                      key={m.monthKey}
                      data-month-id={m.monthKey}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: '100%',
                        cursor: 'pointer',
                        flex: 1,
                        minWidth: 48,
                        borderRadius: 'var(--radius)',
                        background: isSelected ? 'var(--accent-soft)' : 'transparent',
                        padding: '6px 2px',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                      }}
                      onClick={() => {
                        if (hasMoved) return;
                        if (selectedMonth === m.monthKey) {
                          setSelectedMonth(null);
                        } else {
                          setSelectedMonth(m.monthKey);
                          setSelectedDate(null);
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--surface)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Amount Badge directly above the bar */}
                      <div style={{ minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {m.spend > 0 ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: isSelected || m.isCurrentMonth ? 700 : 600,
                              color: isSelected ? 'var(--accent)' : m.isCurrentMonth ? 'var(--text)' : 'var(--text-2)',
                              whiteSpace: 'nowrap',
                              letterSpacing: '-0.2px',
                            }}
                          >
                            {fmtCompactMoney(m.spend, currency)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--text-3)', opacity: 0.3 }}>-</span>
                        )}
                      </div>

                      {/* Bar Column Container */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: 'center', marginTop: 4, marginBottom: 6 }}>
                        <div
                          style={{
                            width: '55%',
                            maxWidth: 28,
                            minWidth: 14,
                            background: 'var(--accent)',
                            borderRadius: m.spend > 0 ? '6px 6px 3px 3px' : '2px',
                            height: m.spend > 0 ? `${barHeightPct}%` : '4px',
                            opacity: m.spend > 0 ? (selectedMonth ? (isSelected ? 1 : 0.45) : (m.isCurrentMonth ? 1 : 0.8)) : 0.2,
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected
                              ? '0 0 0 2px var(--surface), 0 0 10px var(--accent-soft)'
                              : undefined,
                          }}
                          title={`${m.fullMonthName}: ${fmtMoney(m.spend, currency)} (${m.count} items, Avg ${fmtMoney(m.dailyAvg, currency)}/day)`}
                        />
                      </div>

                      {/* Month Label */}
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            color: isSelected || m.isCurrentMonth ? 'var(--accent)' : 'var(--text-2)',
                            fontWeight: isSelected || m.isCurrentMonth ? 750 : 500,
                            whiteSpace: 'nowrap',
                            lineHeight: 1.1,
                          }}
                        >
                          {m.monthName}
                        </span>
                        {m.isCurrentMonth && (
                          <span
                            style={{
                              fontSize: 8,
                              color: 'var(--accent)',
                              background: 'var(--accent-soft)',
                              fontWeight: 700,
                              padding: '1px 4px',
                              borderRadius: 3,
                              marginTop: 2,
                              display: 'inline-block',
                              letterSpacing: '0.3px',
                            }}
                          >
                            NOW
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Horizontally scrollable container across past weeks */
          <div
            ref={chartScrollRef}
            className="analytics-chart-scroll"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            style={{
              position: 'relative',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              paddingTop: 4,
              paddingBottom: 4,
              cursor: isMouseDown ? 'grabbing' : 'grab',
              userSelect: isMouseDown ? 'none' : 'auto',
              scrollSnapType: isMouseDown ? 'none' : 'x mandatory',
              scrollBehavior: 'smooth',
              scrollPadding: 0,
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                paddingTop: 4,
                paddingBottom: 4,
                width: '100%',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {weeklyWeeks.map((week) => {
                const isSelected = selectedWeek === week.weekMonStr;
                const isCurrent = week.isCurrentWeek;
                const isActiveCard = isSelected || (!selectedWeek && isCurrent);

                return (
                  <div
                    key={week.weekMonStr}
                    data-week-id={week.weekMonStr}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      scrollSnapAlign: 'start',
                      scrollSnapStop: 'always',
                      flexShrink: 0,
                      width: '100%',
                      minWidth: '100%',
                      boxSizing: 'border-box',
                      background: 'var(--surface2)',
                      border: isActiveCard ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '12px 14px',
                      boxShadow: isActiveCard ? '0 2px 10px var(--accent-soft)' : undefined,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Week Label & Total - Click to select/filter by this week */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        padding: '2px 4px',
                        gap: 12,
                        cursor: 'pointer',
                        borderRadius: 'var(--radius)',
                      }}
                      onClick={() => {
                        if (hasMoved) return;
                        if (selectedWeek === week.weekMonStr) {
                          setSelectedWeek(null);
                        } else {
                          setSelectedWeek(week.weekMonStr);
                          setSelectedDate(null);
                        }
                      }}
                      title={isSelected ? 'Click to show All Weeks' : `Click to select ${week.label}`}
                    >
                      <span style={{
                        fontSize: 11,
                        fontWeight: isActiveCard ? 700 : 600,
                        color: isActiveCard ? 'var(--accent)' : 'var(--text-2)',
                        whiteSpace: 'nowrap',
                      }}>
                        {week.label}
                      </span>
                      <span style={{ fontSize: 10.5, color: isActiveCard ? 'var(--text)' : 'var(--text-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {fmtMoney(week.weekTotal, currency)}
                      </span>
                    </div>

                    {/* 7 Days Columns */}
                    {(() => {
                      const weekMaxSpend = Math.max(...week.days.map(d => d.spend), dailyAvgSpend, 10);
                      return (
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4, height: 140, width: '100%' }}>
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
                                  flex: 1,
                                  minWidth: 0,
                                }}
                                onClick={() => {
                                  if (!hasMoved) handleToggleDate(d.dateStr);
                                }}
                              >
                                {/* Amount Badge directly above the bar */}
                                <div style={{ minHeight: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {d.spend > 0 ? (
                                    <span style={{
                                      fontSize: 9,
                                      fontWeight: isSelected || d.isToday ? 700 : 600,
                                      color: isSelected ? 'var(--accent)' : d.isToday ? 'var(--text)' : 'var(--text-2)',
                                      whiteSpace: 'nowrap',
                                      letterSpacing: '-0.2px',
                                      background: isSelected ? 'var(--accent-soft)' : undefined,
                                      padding: isSelected ? '1px 4px' : undefined,
                                      borderRadius: 4,
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
                                      width: 22,
                                      background: 'var(--accent)',
                                      borderRadius: d.spend > 0 ? '4px 4px 2px 2px' : '2px',
                                      height: d.spend > 0 ? `${barHeightPct}%` : '4px',
                                      opacity: d.spend > 0 ? (selectedDate ? (isSelected ? 1 : 0.6) : (d.isToday ? 1 : 0.85)) : 0.2,
                                      transition: 'all 0.2s ease',
                                      boxShadow: isSelected
                                        ? '0 0 0 2px var(--surface), 0 0 8px var(--accent-soft)'
                                        : undefined,
                                    }}
                                    title={`${d.label}: ${fmtMoney(d.spend, currency)} (${d.count} items)`}
                                  />
                                </div>

                                {/* Day Label */}
                                <div style={{ marginTop: 6, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{
                                    fontSize: 10,
                                    color: isSelected || d.isToday ? 'var(--text)' : 'var(--text-2)',
                                    fontWeight: isSelected || d.isToday ? 700 : 500,
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    lineHeight: 1.1,
                                  }}>
                                    {d.label}
                                  </span>
                                  {d.isToday && (
                                    <span style={{
                                      fontSize: 8,
                                      color: 'var(--accent)',
                                      background: 'var(--accent-soft)',
                                      fontWeight: 700,
                                      padding: '1px 4px',
                                      borderRadius: 4,
                                      marginTop: 2,
                                      display: 'inline-block',
                                      letterSpacing: '0.3px',
                                    }}>
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


      </div>

      {/* Grid: Daily Expenditure Log & Category Share */}
      <div className="dashboard-grid" style={{ gap: 16, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* Category Distribution Button in Daily Log Header */}
        <div className="card" style={{ padding: '16px', overflow: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'nowrap', gap: 8, width: '100%', minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
              <Award size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px', flexShrink: 1 }}>
                Daily Expenditure
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                  background: 'var(--surface2)',
                  padding: '2px 6px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  lineHeight: '1.2',
                }}
              >
                {perDayList.length} {perDayList.length === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  height: 26,
                  gap: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  border: 'none',
                  background: 'var(--surface2)',
                  fontWeight: 600,
                }}
                onClick={() => setShowCategoryDrawer(true)}
              >
                <PieChart size={13} style={{ color: 'var(--accent)' }} /> Categories
              </button>
              {selectedDate && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    height: 26,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    border: 'none',
                    background: 'var(--surface2)',
                    fontWeight: 600,
                  }}
                  onClick={() => setSelectedDate(null)}
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          {perDayList.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '28px 0', textAlign: 'center' }}>
              No transactions recorded for this selection
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {perDayList.map(row => {
                const catObj = db.settings.categories.find(c => c.name === row.topCategory);
                const isExpanded = Boolean(expandedDates[row.dateStr] || selectedDate === row.dateStr);

                return (
                  <div
                    key={row.dateStr}
                    className="daily-expenditure-group"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      border: selectedDate === row.dateStr ? '1.5px solid var(--accent)' : undefined,
                    }}
                  >
                    {/* Day Row Header */}
                    <button
                      type="button"
                      className="daily-expenditure-header"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      onClick={() => handleToggleExpand(row.dateStr)}
                      aria-expanded={isExpanded}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <CategoryBadge category={row.topCategory} color={catObj?.color} icon={catObj?.icon} size={15} showLabel={false} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 650, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)', fontSize: 13.5 }}>{row.dayName}</span>
                            {row.isToday && <span style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 9.5, fontWeight: 700, padding: '1.5px 6px', borderRadius: 5, flexShrink: 0 }}>Today</span>}
                            {row.isYesterday && <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontSize: 9.5, fontWeight: 700, padding: '1.5px 6px', borderRadius: 5, flexShrink: 0 }}>Yest.</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.count} {row.count === 1 ? 'item' : 'items'} · {row.topCategory}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {(() => {
                          const net = row.income - row.spend;
                          let amountText = fmtMoney(0, currency);
                          let amountColor = 'var(--text-3)';

                          if (row.spend > 0 && row.income === 0) {
                            amountText = fmtMoney(row.spend, currency);
                            amountColor = 'var(--debit)';
                          } else if (row.income > 0 && row.spend === 0) {
                            amountText = `+${fmtMoney(row.income, currency)}`;
                            amountColor = 'var(--credit)';
                          } else if (net > 0) {
                            amountText = `+${fmtMoney(net, currency)}`;
                            amountColor = 'var(--credit)';
                          } else if (net < 0) {
                            amountText = `-${fmtMoney(Math.abs(net), currency)}`;
                            amountColor = 'var(--debit)';
                          }

                          return (
                            <div style={{ textAlign: 'right', fontWeight: 750, fontSize: 14, color: amountColor, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {amountText}
                            </div>
                          );
                        })()}
                        <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </div>
                      </div>
                    </button>

                    {/* Expandable Itemized Transactions List */}
                    {isExpanded && (
                      <div className="daily-expenditure-items">
                        {row.items.map(ge => {
                          const isDebit = ge.flow === 'out';
                          const itemCat = db.settings.categories.find(c => c.name === ge.category);
                          const walletObj = wallets.find(w => w.id === ge.walletId);

                          // Settlement status calculation
                          const allSettled = ge.items.every(i => i.settled || i.status === 'paid');
                          const someSettled = ge.items.some(i => i.settled || i.status === 'paid');

                          return (
                            <div
                              key={ge.id}
                              className="daily-expense-row-wrap"
                              onClick={() => setSelectedGroupExpense(ge)}
                              style={{ cursor: 'pointer' }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedGroupExpense(ge);
                                }
                              }}
                            >
                              <div className="daily-expense-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                                  <CategoryBadge category={ge.category} color={itemCat?.color} icon={itemCat?.icon} size={15} showLabel={false} />
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {ge.description || 'Expense'}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap', marginTop: 1, overflow: 'hidden' }}>
                                      {ge.isSplit ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                                          <User size={11} /> Split
                                        </span>
                                      ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85px' }}>
                                          <Wallet size={11} /> {walletObj?.name || 'Personal'}
                                        </span>
                                      )}
                                      <span style={{ flexShrink: 0, opacity: 0.5 }}>·</span>
                                      <span style={{
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                        fontSize: 9.5,
                                        fontWeight: 650,
                                        flexShrink: 0,
                                        whiteSpace: 'nowrap',
                                        background: allSettled ? 'rgba(16, 185, 129, 0.12)' : (someSettled ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                                        color: allSettled ? '#10b981' : (someSettled ? '#f59e0b' : '#ef4444'),
                                      }}>
                                        {allSettled ? 'Settled' : (someSettled ? 'Partial' : 'Unsettled')}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  {(() => {
                                    let displayAmount: string | null = null;
                                    let displayColor = isDebit ? 'var(--debit)' : 'var(--credit)';

                                    if (ge.flow === 'in' && ge.category !== 'Transfer') {
                                      displayAmount = `+${fmtMoney(ge.totalAmount, currency)}`;
                                      displayColor = 'var(--credit)';
                                    } else if (ge.isSplit) {
                                      if (allSettled) {
                                        if (ge.personalShare > 0) {
                                          displayAmount = `-${fmtMoney(ge.personalShare, currency)}`;
                                          displayColor = 'var(--debit)';
                                        } else {
                                          displayAmount = null;
                                        }
                                      } else {
                                        displayAmount = `-${fmtMoney(ge.totalAmount, currency)}`;
                                        displayColor = 'var(--debit)';
                                      }
                                    } else {
                                      displayAmount = `${isDebit ? '-' : '+'}${fmtMoney(ge.totalAmount, currency)}`;
                                      displayColor = isDebit ? 'var(--debit)' : 'var(--credit)';
                                    }

                                    if (!displayAmount) return null;

                                    return (
                                      <div style={{
                                        fontWeight: 700,
                                        fontSize: 13.5,
                                        color: displayColor,
                                        whiteSpace: 'nowrap',
                                        fontVariantNumeric: 'tabular-nums',
                                      }}>
                                        {displayAmount}
                                      </div>
                                    );
                                  })()}
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

      </div>

      {/* Category Distribution Modal Drawer */}
      {showCategoryDrawer && createPortal(
        <div
          className="modal-backdrop"
          onClick={e => {
            if (e.target === e.currentTarget) setShowCategoryDrawer(false);
          }}
        >
          <div className="modal category-dist-modal">
            {/* Drag Handle Bar for mobile bottom sheet */}
            <div className="modal-handle-bar">
              <div className="modal-handle" />
            </div>

            {/* Header */}
            <div className="category-dist-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PieChart size={19} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                    Category Distribution
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0 0' }}>
                    {selectedCategory ? `Filtering by ${selectedCategory} · Click to reset` : 'Breakdown of spending across categories'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedCategory && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11.5, padding: '4px 10px', height: 30, borderRadius: 8 }}
                    onClick={() => setSelectedCategory(null)}
                  >
                    Clear Filter
                  </button>
                )}
                <button
                  type="button"
                  className="compact-close-btn"
                  onClick={() => setShowCategoryDrawer(false)}
                  title="Close drawer"
                  aria-label="Close drawer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="category-dist-body">
              {categoryBreakdown.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px 20px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'var(--surface2)',
                      color: 'var(--text-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <PieChart size={26} strokeWidth={1.8} style={{ opacity: 0.6 }} />
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.2px' }}>
                    No Category Data
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 260, lineHeight: 1.45 }}>
                    There are no outflow expenses recorded for the selected timeframe.
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 12px',
                      background: 'var(--surface2)',
                      borderRadius: 9,
                      fontSize: 11.5,
                      color: 'var(--text-2)',
                      marginBottom: 2,
                    }}
                  >
                    <span>{categoryBreakdown.length} {categoryBreakdown.length === 1 ? 'Category' : 'Categories'}</span>
                    <span>
                      Total:{' '}
                      <strong style={{ color: 'var(--text)', fontWeight: 700 }}>
                        {fmtMoney(timeframeOutflowTotal, currency)}
                      </strong>
                    </span>
                  </div>

                  {/* Category Cards List */}
                  {categoryBreakdown.map(({ cat, amount, pct, count }) => {
                    const catObj = db.settings.categories.find(c => c.name === cat);
                    const catColor = catObj?.color ?? '#6B7280';
                    const isSelectedCat = selectedCategory === cat;

                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`category-dist-card ${isSelectedCat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(isSelectedCat ? null : cat)}
                        title={`Click to filter log by ${cat}`}
                      >
                        {/* Top Info Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            <CategoryBadge
                              category={cat}
                              color={catColor}
                              icon={catObj?.icon}
                              size={15}
                              showLabel={false}
                            />
                            <span
                              style={{
                                fontWeight: 650,
                                fontSize: 14,
                                color: isSelectedCat ? 'var(--accent)' : 'var(--text)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {cat}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: isSelectedCat ? 'var(--accent)' : 'var(--text-3)',
                                background: isSelectedCat ? 'var(--accent-soft)' : 'var(--surface3)',
                                padding: '2px 7px',
                                borderRadius: 6,
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {count} {count === 1 ? 'item' : 'items'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <span
                              style={{
                                color: isSelectedCat ? 'var(--accent)' : 'var(--text-3)',
                                fontSize: 12,
                                fontWeight: 650,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {Math.round(pct)}%
                            </span>
                            <span
                              style={{
                                fontSize: 14.5,
                                fontWeight: 750,
                                color: 'var(--text)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {fmtMoney(amount, currency)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="category-dist-progress-track">
                          <div
                            className="category-dist-progress-fill"
                            style={{
                              width: `${Math.min(100, Math.max(1.5, pct))}%`,
                              background: isSelectedCat ? 'var(--accent)' : catColor,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

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
