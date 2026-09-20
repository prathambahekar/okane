import { useState, useMemo, useCallback, useRef } from 'react';
import { Calendar, BarChart2, LineChart, TrendingUp, ArrowUpRight, ArrowDownRight, Info, Plus, Filter, ChevronDown, Layers, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { personalNetAmount } from '../db';
import { fmtMoney } from '../utils';
import type { Expense, ViewName } from '../types';

interface Props {
  expenses: Expense[];
  currency: string;
  onNavigate?: (v: ViewName) => void;
  onAddExpense?: () => void;
}

export default function MonthlySpendingTrend({ expenses, currency, onNavigate, onAddExpense }: Props) {
  const [chartType, setChartType] = useState<'cumulative' | 'daily' | 'history'>('cumulative');
  const [comparisonBaseline, setComparisonBaseline] = useState<'prev_month' | 'prev_year' | 'avg_month'>('prev_month');
  const [filterScope, setFilterScope] = useState<string>('personal'); // 'personal' | 'all' | category name
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [hoveredHistoryIdx, setHoveredHistoryIdx] = useState<number | null>(null);

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentMonthKey = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  // Unique month keys from expenses + recent 12 months
  const availableMonthKeys = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthKey);

    // Add all months with expenses
    expenses.forEach(e => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.slice(0, 7));
      }
    });

    // Add past 12 calendar months
    for (let i = 0; i < 12; i++) {
      const d = new Date(currentYear, currentMonthNum - 1 - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(k);
    }

    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [expenses, currentMonthKey, currentYear, currentMonthNum]);

  // Default selected month: current month or latest month with expenses
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    // If current month has expenses, use current month
    const hasCurrentExpenses = expenses.some(e => e.date && e.date.startsWith(currentMonthKey));
    if (hasCurrentExpenses) return currentMonthKey;
    // Otherwise pick latest month with expenses if available
    const sortedExpenseMonths = availableMonthKeys.filter(k => expenses.some(e => e.date && e.date.startsWith(k)));
    return sortedExpenseMonths[0] || currentMonthKey;
  });

  const [selYear, selMonthNum] = useMemo(() => {
    const parts = selectedMonthKey.split('-').map(Number);
    return [parts[0] || currentYear, parts[1] || currentMonthNum];
  }, [selectedMonthKey, currentYear, currentMonthNum]);

  const isCurrentMonth = selYear === currentYear && selMonthNum === currentMonthNum;

  const selFullMonthName = useMemo(() => {
    return new Date(selYear, selMonthNum - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [selYear, selMonthNum]);

  const selShortMonthName = useMemo(() => {
    return new Date(selYear, selMonthNum - 1, 1).toLocaleDateString(undefined, { month: 'short' });
  }, [selYear, selMonthNum]);

  const selDaysInMonth = useMemo(() => new Date(selYear, selMonthNum, 0).getDate(), [selYear, selMonthNum]);

  // Comparison baseline month key and info
  const baselineMonthKey = useMemo(() => {
    if (comparisonBaseline === 'prev_year') {
      return `${selYear - 1}-${String(selMonthNum).padStart(2, '0')}`;
    }
    // Default 'prev_month'
    const prevD = new Date(selYear, selMonthNum - 2, 1);
    return `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
  }, [comparisonBaseline, selYear, selMonthNum]);

  const [baseYear, baseMonthNum] = useMemo(() => {
    const parts = baselineMonthKey.split('-').map(Number);
    return [parts[0], parts[1]];
  }, [baselineMonthKey]);

  const baseFullMonthName = useMemo(() => {
    if (comparisonBaseline === 'avg_month') return 'Monthly Average';
    return new Date(baseYear, baseMonthNum - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [comparisonBaseline, baseYear, baseMonthNum]);

  const baseShortMonthName = useMemo(() => {
    if (comparisonBaseline === 'avg_month') return 'Avg';
    return new Date(baseYear, baseMonthNum - 1, 1).toLocaleDateString(undefined, { month: 'short' });
  }, [comparisonBaseline, baseYear, baseMonthNum]);

  const baseDaysInMonth = useMemo(() => new Date(baseYear, baseMonthNum, 0).getDate(), [baseYear, baseMonthNum]);

  // Unique categories list for scope filter
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    expenses.forEach(e => {
      if (e.category) cats.add(e.category);
    });
    return Array.from(cats).sort();
  }, [expenses]);

  // Expense amount calculator according to filterScope
  const getExpenseAmount = useCallback((e: Expense) => {
    if (filterScope === 'personal') {
      return personalNetAmount(e);
    } else if (filterScope === 'all') {
      if (e.category === 'Transfer') return 0;
      if (e.flow === 'in') return -Number(e.amount || 0);
      return Number(e.amount || 0);
    } else {
      // Specific category
      if (e.category !== filterScope) return 0;
      if (e.flow === 'in') return -Number(e.amount || 0);
      return Number(e.amount || 0);
    }
  }, [filterScope]);

  // Get total spend for specific date
  const getSpendForDate = useCallback((dateStr: string) => {
    const total = expenses
      .filter(e => e.date && e.date.startsWith(dateStr))
      .reduce((sum, e) => sum + getExpenseAmount(e), 0);
    return Math.max(0, total);
  }, [expenses, getExpenseAmount]);

  // Historical Monthly Average daily spend calculation
  const historicalAvgDailySpend = useMemo(() => {
    const monthTotals: Record<string, number> = {};
    expenses.forEach(e => {
      if (!e.date || e.date.length < 7) return;
      const mk = e.date.slice(0, 7);
      if (mk === selectedMonthKey) return; // exclude current selected month
      monthTotals[mk] = (monthTotals[mk] || 0) + getExpenseAmount(e);
    });
    const months = Object.keys(monthTotals);
    if (months.length === 0) return 0;
    const grandTotal = Object.values(monthTotals).reduce((a, b) => a + b, 0);
    return grandTotal / (months.length * 30);
  }, [expenses, selectedMonthKey, getExpenseAmount]);

  const maxDays = Math.max(selDaysInMonth, baseDaysInMonth);

  // Day-by-day trend data
  const trendData = useMemo(() => {
    const days = [];
    let selCum = 0;
    let baseCum = 0;

    const maxActiveDay = isCurrentMonth ? Math.min(currentDay, selDaysInMonth) : selDaysInMonth;

    for (let d = 1; d <= maxDays; d++) {
      const selDateStr = `${selYear}-${String(selMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const baseDateStr = `${baseYear}-${String(baseMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const selDaily = d <= selDaysInMonth ? getSpendForDate(selDateStr) : 0;
      const baseDaily = comparisonBaseline === 'avg_month'
        ? historicalAvgDailySpend
        : (d <= baseDaysInMonth ? getSpendForDate(baseDateStr) : 0);

      if (d <= maxActiveDay) {
        selCum += selDaily;
      }
      if (d <= baseDaysInMonth || comparisonBaseline === 'avg_month') {
        baseCum += baseDaily;
      }

      days.push({
        day: d,
        selDaily,
        baseDaily,
        selCum: d <= maxActiveDay ? selCum : null,
        baseCum: (d <= baseDaysInMonth || comparisonBaseline === 'avg_month') ? baseCum : null,
        isToday: isCurrentMonth && d === currentDay,
        isFuture: isCurrentMonth && d > currentDay,
      });
    }

    return days;
  }, [
    maxDays, selDaysInMonth, baseDaysInMonth, selYear, selMonthNum, baseYear, baseMonthNum,
    isCurrentMonth, currentDay, getSpendForDate, comparisonBaseline, historicalAvgDailySpend
  ]);

  // Totals & Comparison metrics
  const activeDayCount = isCurrentMonth ? Math.min(currentDay, selDaysInMonth) : selDaysInMonth;

  const selTotalSoFar = useMemo(() => {
    const valid = trendData.filter(d => d.selCum !== null).pop();
    return valid?.selCum ?? 0;
  }, [trendData]);

  const baseTotalSamePoint = useMemo(() => {
    const targetDay = Math.min(activeDayCount, baseDaysInMonth);
    const item = trendData.find(d => d.day === targetDay);
    return item?.baseCum ?? 0;
  }, [trendData, activeDayCount, baseDaysInMonth]);

  const diffAmount = selTotalSoFar - baseTotalSamePoint;
  const pctChange = baseTotalSamePoint > 0 ? ((selTotalSoFar - baseTotalSamePoint) / baseTotalSamePoint) * 100 : (selTotalSoFar > 0 ? 100 : 0);
  const dailyAverageRate = activeDayCount > 0 ? selTotalSoFar / activeDayCount : 0;
  const projectedMonthTotal = isCurrentMonth && activeDayCount > 0 ? (selTotalSoFar / activeDayCount) * selDaysInMonth : selTotalSoFar;

  // Peak spending day
  const peakDayObj = useMemo(() => {
    let maxObj = { day: 1, amount: 0 };
    trendData.forEach(d => {
      if (d.selDaily > maxObj.amount) {
        maxObj = { day: d.day, amount: d.selDaily };
      }
    });
    return maxObj;
  }, [trendData]);

  // 6-Month Historical Trend Data
  const historyMonthsData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selYear, selMonthNum - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const mk = `${y}-${String(m).padStart(2, '0')}`;
      const name = d.toLocaleDateString(undefined, { month: 'short' });

      // Total for this month
      const daysInM = new Date(y, m, 0).getDate();
      let total = 0;
      for (let day = 1; day <= daysInM; day++) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        total += getSpendForDate(ds);
      }

      months.push({
        monthKey: mk,
        name,
        year: y,
        label: `${name} ${y !== currentYear ? y : ''}`,
        total,
        isSelected: mk === selectedMonthKey,
      });
    }

    const avg = months.reduce((s, m) => s + m.total, 0) / (months.length || 1);
    return { months, avg };
  }, [selYear, selMonthNum, currentYear, selectedMonthKey, getSpendForDate]);

  // Zoom & Pan state
  const [zoomStart, setZoomStart] = useState<number>(1);
  const [zoomEnd, setZoomEnd] = useState<number>(maxDays);
  const [prevMonthKey, setPrevMonthKey] = useState<string>(selectedMonthKey);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartRangeRef = useRef<[number, number] | null>(null);

  // Reset zoom whenever selected month changes
  if (prevMonthKey !== selectedMonthKey) {
    setPrevMonthKey(selectedMonthKey);
    setZoomStart(1);
    setZoomEnd(maxDays);
  }

  const isZoomed = zoomStart > 1 || zoomEnd < maxDays;
  const zoomSpan = Math.max(1, zoomEnd - zoomStart);
  const zoomFactor = (maxDays / Math.max(1, zoomSpan)).toFixed(1);

  const handleZoomIn = useCallback(() => {
    if (zoomSpan <= 2) return; // Min 3 days window
    const center = (zoomStart + zoomEnd) / 2;
    const newHalfSpan = Math.max(1, Math.floor((zoomSpan * 0.7) / 2));
    let calcStart = Math.max(1, Math.round(center - newHalfSpan));
    const calcEnd = Math.min(maxDays, Math.round(center + newHalfSpan));
    if (calcEnd - calcStart < 2) {
      calcStart = Math.max(1, calcEnd - 2);
    }
    setZoomStart(calcStart);
    setZoomEnd(calcEnd);
  }, [zoomSpan, zoomStart, zoomEnd, maxDays]);

  const handleZoomOut = useCallback(() => {
    if (!isZoomed) return;
    const center = (zoomStart + zoomEnd) / 2;
    const newHalfSpan = Math.ceil((zoomSpan * 1.4) / 2);
    const newStart = Math.max(1, Math.round(center - newHalfSpan));
    const newEnd = Math.min(maxDays, Math.round(center + newHalfSpan));
    if (newStart <= 1 && newEnd >= maxDays) {
      setZoomStart(1);
      setZoomEnd(maxDays);
    } else {
      setZoomStart(newStart);
      setZoomEnd(newEnd);
    }
  }, [isZoomed, zoomSpan, zoomStart, zoomEnd, maxDays]);

  const handleResetZoom = useCallback(() => {
    setZoomStart(1);
    setZoomEnd(maxDays);
  }, [maxDays]);

  const handlePresetZoom = useCallback((start: number, end: number) => {
    setZoomStart(Math.max(1, start));
    setZoomEnd(Math.min(maxDays, end));
  }, [maxDays]);

  // Mouse / Touch Drag Panning Handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isZoomed) return;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartRangeRef.current = [zoomStart, zoomEnd];
  }, [isZoomed, zoomStart, zoomEnd]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || dragStartXRef.current === null || !dragStartRangeRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    const chartWidthPx = e.currentTarget.getBoundingClientRect().width || 1;
    const daysPerPx = (zoomEnd - zoomStart) / chartWidthPx;
    const dayDelta = Math.round(deltaX * daysPerPx);

    if (dayDelta !== 0) {
      const [start, end] = dragStartRangeRef.current;
      const windowSize = end - start;
      let newStart = start - dayDelta;
      let newEnd = newStart + windowSize;

      if (newStart < 1) {
        newStart = 1;
        newEnd = newStart + windowSize;
      }
      if (newEnd > maxDays) {
        newEnd = maxDays;
        newStart = newEnd - windowSize;
      }

      setZoomStart(newStart);
      setZoomEnd(newEnd);
    }
  }, [isDragging, zoomStart, zoomEnd, maxDays]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartXRef.current = null;
    dragStartRangeRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    if (chartType === 'history') return;
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else if (e.deltaY > 0) {
      handleZoomOut();
    }
  }, [chartType, handleZoomIn, handleZoomOut]);

  // SVG Geometry Dimensions
  const width = 580;
  const height = 260;
  const paddingLeft = 48;
  const paddingRight = 18;
  const paddingTop = 36;
  const paddingBottom = 38;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxVal = useMemo(() => {
    const visibleData = trendData.filter(d => d.day >= zoomStart && d.day <= zoomEnd);
    if (chartType === 'cumulative') {
      const vals = visibleData.flatMap(d => [d.selCum, d.baseCum]).filter((v): v is number => v !== null);
      const max = Math.max(...vals, 0);
      return max > 0 ? max * 1.15 : 1000;
    } else if (chartType === 'daily') {
      const vals = visibleData.flatMap(d => [d.selDaily, d.baseDaily]);
      const max = Math.max(...vals, 0);
      return max > 0 ? max * 1.2 : 500;
    } else {
      // History
      const vals = historyMonthsData.months.map(m => m.total);
      const max = Math.max(...vals, 0);
      return max > 0 ? max * 1.2 : 2000;
    }
  }, [chartType, trendData, historyMonthsData, zoomStart, zoomEnd]);

  const getX = useCallback((day: number) => {
    if (zoomSpan <= 0) return paddingLeft + chartW / 2;
    return paddingLeft + ((day - zoomStart) / zoomSpan) * chartW;
  }, [zoomStart, zoomSpan, paddingLeft, chartW]);

  const getY = useCallback((val: number | null) => {
    if (val === null) return paddingTop + chartH;
    const clamped = Math.max(0, val);
    const ratio = maxVal > 0 ? clamped / maxVal : 0;
    return paddingTop + chartH - ratio * chartH;
  }, [paddingTop, chartH, maxVal]);

  // Points & SVG Paths
  const selPoints = useMemo(() => {
    return trendData
      .filter(d => d.selCum !== null)
      .map(d => ({ x: getX(d.day), y: getY(d.selCum), day: d.day, val: d.selCum }));
  }, [trendData, getX, getY]);

  const basePoints = useMemo(() => {
    return trendData
      .filter(d => d.baseCum !== null)
      .map(d => ({ x: getX(d.day), y: getY(d.baseCum), day: d.day, val: d.baseCum }));
  }, [trendData, getX, getY]);

  const selLinePath = useMemo(() => {
    if (selPoints.length === 0) return '';
    return selPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }, [selPoints]);

  const selAreaPath = useMemo(() => {
    if (selPoints.length === 0) return '';
    const firstX = selPoints[0].x.toFixed(1);
    const lastX = selPoints[selPoints.length - 1].x.toFixed(1);
    const baseY = (paddingTop + chartH).toFixed(1);
    return `${selLinePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [selLinePath, selPoints, paddingTop, chartH]);

  const baseLinePath = useMemo(() => {
    if (basePoints.length === 0) return '';
    return basePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }, [basePoints]);

  // Hover Tooltip Info
  const activeHoverData = useMemo(() => {
    if (hoveredDay === null) return null;
    return trendData.find(d => d.day === hoveredDay) || null;
  }, [hoveredDay, trendData]);

  // Y-Ticks
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  // Compact currency formatter for graph labels
  const fmtCompactMoney = (amount: number, currencySymbol: string) => {
    if (Math.abs(amount) >= 100000) {
      return `${currencySymbol}${(amount / 1000).toFixed(0)}k`;
    }
    if (Math.abs(amount) >= 10000) {
      return `${currencySymbol}${(amount / 1000).toFixed(1)}k`;
    }
    if (Math.abs(amount) >= 1000) {
      return `${currencySymbol}${(amount / 1000).toFixed(1)}k`;
    }
    return fmtMoney(amount, currencySymbol);
  };

  return (
    <div className="card spending-trend-card">
      {/* Header Row: Title & View Switcher */}
      <div className="spending-trend-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}>
            <Calendar size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.2px' }}>Monthly Spending Trend</h2>
              {isCurrentMonth && (
                <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-md)' }}>
                  Live
                </span>
              )}
            </div>
            <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', margin: '1px 0 0 0' }}>
              <strong style={{ color: 'var(--accent)' }}>{selShortMonthName}</strong> vs{' '}
              <strong style={{ color: '#a855f7' }}>{baseShortMonthName}</strong>
            </p>
          </div>
        </div>

        {/* Chart View Mode Buttons */}
        <div style={{ display: 'flex', background: 'var(--surface2)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => setChartType('cumulative')}
            title="Day-by-day cumulative pace curve"
            style={{
              fontSize: 'var(--fs-caption)',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: chartType === 'cumulative' ? 'var(--surface)' : 'transparent',
              color: chartType === 'cumulative' ? 'var(--accent)' : 'var(--text-3)',
              boxShadow: chartType === 'cumulative' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: 'none',
            }}
          >
            <LineChart size={13} style={{ marginRight: 3 }} /> Pace
          </button>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => setChartType('daily')}
            title="Daily expenditure comparison"
            style={{
              fontSize: 'var(--fs-caption)',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: chartType === 'daily' ? 'var(--surface)' : 'transparent',
              color: chartType === 'daily' ? 'var(--accent)' : 'var(--text-3)',
              boxShadow: chartType === 'daily' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: 'none',
            }}
          >
            <BarChart2 size={13} style={{ marginRight: 3 }} /> Daily
          </button>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => setChartType('history')}
            title="6-Month historical spending trend"
            style={{
              fontSize: 'var(--fs-caption)',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: chartType === 'history' ? 'var(--surface)' : 'transparent',
              color: chartType === 'history' ? 'var(--accent)' : 'var(--text-3)',
              boxShadow: chartType === 'history' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: 'none',
            }}
          >
            <Layers size={13} style={{ marginRight: 3 }} /> 6-Mo
          </button>
        </div>
      </div>

      {/* Horizontal Scroll Filter Bar (Pills style) */}
      <div className="spending-trend-filters" style={{ marginBottom: 12 }}>
        {/* Month Selector Pill */}
        <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
          <select
            className="filter-pill-select"
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
          >
            {availableMonthKeys.map(k => {
              const [y, m] = k.split('-').map(Number);
              const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
              const isCurr = k === currentMonthKey;
              return (
                <option key={k} value={k}>
                  {label} {isCurr ? '(Current)' : ''}
                </option>
              );
            })}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }} />
        </div>

        {/* Scope Filter Pill */}
        <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
          <select
            className="filter-pill-select"
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
          >
            <option value="personal">Personal Net Spend</option>
            <option value="all">All Outflows (Gross)</option>
            {categoriesList.map(c => (
              <option key={c} value={c}>Cat: {c}</option>
            ))}
          </select>
          <Filter size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }} />
        </div>

        {/* Comparison Baseline Switcher Pill */}
        {chartType !== 'history' && (
          <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
            <select
              className="filter-pill-select"
              value={comparisonBaseline}
              onChange={(e) => setComparisonBaseline(e.target.value as 'prev_month' | 'prev_year' | 'avg_month')}
              style={{ color: 'var(--accent)', borderColor: 'var(--accent-soft)' }}
            >
              <option value="prev_month">vs Prev Month</option>
              <option value="prev_year">vs Prev Year</option>
              <option value="avg_month">vs Avg Month</option>
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--accent)' }} />
          </div>
        )}

        {onNavigate && (
          <button
            className="btn-ghost btn-xs btn"
            onClick={() => onNavigate('analytics')}
            style={{ fontSize: 'var(--fs-caption)', padding: '4px 8px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 'auto' }}
          >
            Statistics →
          </button>
        )}
      </div>

      {/* Metric Summary Cards Grid (2x2 on Mobile, 4x1 on Desktop) */}
      <div className="spending-trend-metrics">
        {/* Metric 1: Selected Month Total */}
        <div className="metric-box">
          <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            {selShortMonthName} Spend ({activeDayCount}d)
          </div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
            {fmtMoney(selTotalSoFar, currency)}
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', marginTop: 1 }}>
            ~{fmtMoney(dailyAverageRate, currency)}/day
          </div>
        </div>

        {/* Metric 2: Baseline Comparison */}
        <div className="metric-box">
          <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            {baseShortMonthName} (Day {activeDayCount})
          </div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: '#a855f7', marginTop: 2 }}>
            {fmtMoney(baseTotalSamePoint, currency)}
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', marginTop: 1 }}>
            Same point total
          </div>
        </div>

        {/* Metric 3: Pace Variance */}
        <div className="metric-box">
          <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Spending Pace
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span style={{
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              color: diffAmount > 0 ? 'var(--debit)' : 'var(--credit)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2
            }}>
              {diffAmount > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(pctChange).toFixed(0)}% ({diffAmount >= 0 ? '+' : ''}{fmtMoney(diffAmount, currency)})
            </span>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', marginTop: 1 }}>
            {diffAmount > 0 ? 'Faster than base' : 'Slower than base'}
          </div>
        </div>

        {/* Metric 4: Projected Month End or Peak Day */}
        <div className="metric-box">
          <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            {isCurrentMonth ? 'Projected Total' : 'Peak Spend Day'}
          </div>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
            {isCurrentMonth ? `~${fmtMoney(projectedMonthTotal, currency)}` : `Day ${peakDayObj.day} (${fmtMoney(peakDayObj.amount, currency)})`}
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', marginTop: 1 }}>
            {isCurrentMonth ? `${selDaysInMonth - currentDay} days left` : 'Single highest day'}
          </div>
        </div>
      </div>

      {/* Main Interactive Chart Section */}
      {selTotalSoFar === 0 && historyMonthsData.months.every(m => m.total === 0) ? (
        /* Empty State when no data is available */
        <div style={{
          padding: '36px 20px',
          textAlign: 'center',
          background: 'var(--surface2)',
          borderRadius: 'var(--radius-md)',
          border: '1px border-dashed var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
              No spending logged for {selFullMonthName}
            </h3>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', margin: 0, maxWidth: 380 }}>
              Start logging expenses to unlock interactive pace curves, category breakdowns, and monthly trends.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            {onAddExpense && (
              <button className="btn btn-primary btn-sm" onClick={onAddExpense}>
                <Plus size={15} /> Add Expense
              </button>
            )}
          </div>
        </div>
      ) : (
        /* SVG Interactive Chart Render */
        <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
          {/* Zoom & Pan Controls Toolbar */}
          {chartType !== 'history' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '4px 0 10px 0', flexWrap: 'wrap' }}>
              {/* Quick Preset Range Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 650, color: 'var(--text-3)', marginRight: 2 }}>
                  Zoom Range:
                </span>
                <button
                  type="button"
                  onClick={() => handleResetZoom()}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 650,
                    border: '1px solid var(--border)',
                    background: !isZoomed ? 'var(--accent)' : 'var(--surface)',
                    color: !isZoomed ? 'var(--accent-contrast)' : 'var(--text-2)',
                    cursor: 'pointer',
                  }}
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetZoom(1, 10)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 650,
                    border: '1px solid var(--border)',
                    background: zoomStart === 1 && zoomEnd === 10 ? 'var(--accent)' : 'var(--surface)',
                    color: zoomStart === 1 && zoomEnd === 10 ? 'var(--accent-contrast)' : 'var(--text-2)',
                    cursor: 'pointer',
                  }}
                >
                  1–10d
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetZoom(11, 20)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 650,
                    border: '1px solid var(--border)',
                    background: zoomStart === 11 && zoomEnd === 20 ? 'var(--accent)' : 'var(--surface)',
                    color: zoomStart === 11 && zoomEnd === 20 ? 'var(--accent-contrast)' : 'var(--text-2)',
                    cursor: 'pointer',
                  }}
                >
                  11–20d
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetZoom(21, maxDays)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 650,
                    border: '1px solid var(--border)',
                    background: zoomStart === 21 && zoomEnd === maxDays ? 'var(--accent)' : 'var(--surface)',
                    color: zoomStart === 21 && zoomEnd === maxDays ? 'var(--accent-contrast)' : 'var(--text-2)',
                    cursor: 'pointer',
                  }}
                >
                  21–{maxDays}d
                </button>
              </div>

              {/* Zoom Action Buttons & Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isZoomed && (
                  <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 7px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Move size={11} /> Day {zoomStart}–{zoomEnd} ({zoomFactor}x)
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface2)', padding: 2, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    title="Zoom In (+)"
                    disabled={zoomSpan <= 2}
                    style={{
                      width: 24,
                      height: 24,
                      display: 'grid',
                      placeItems: 'center',
                      border: 'none',
                      background: 'transparent',
                      color: zoomSpan <= 2 ? 'var(--text-3)' : 'var(--text)',
                      cursor: zoomSpan <= 2 ? 'default' : 'pointer',
                      borderRadius: 'var(--radius-xs)',
                      opacity: zoomSpan <= 2 ? 0.4 : 1,
                    }}
                  >
                    <ZoomIn size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    title="Zoom Out (-)"
                    disabled={!isZoomed}
                    style={{
                      width: 24,
                      height: 24,
                      display: 'grid',
                      placeItems: 'center',
                      border: 'none',
                      background: 'transparent',
                      color: !isZoomed ? 'var(--text-3)' : 'var(--text)',
                      cursor: !isZoomed ? 'default' : 'pointer',
                      borderRadius: 'var(--radius-xs)',
                      opacity: !isZoomed ? 0.4 : 1,
                    }}
                  >
                    <ZoomOut size={13} />
                  </button>
                  {isZoomed && (
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      title="Reset Zoom"
                      style={{
                        width: 24,
                        height: 24,
                        display: 'grid',
                        placeItems: 'center',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-xs)',
                      }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              overflow: 'visible',
              cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'crosshair',
              touchAction: 'none',
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { handleMouseUp(); setHoveredDay(null); setHoveredHistoryIdx(null); }}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                const touch = e.touches[0];
                if (!isZoomed) return;
                setIsDragging(true);
                dragStartXRef.current = touch.clientX;
                dragStartRangeRef.current = [zoomStart, zoomEnd];
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 1 && isDragging && dragStartXRef.current !== null && dragStartRangeRef.current) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - dragStartXRef.current;
                const chartWidthPx = e.currentTarget.getBoundingClientRect().width || 1;
                const daysPerPx = (zoomEnd - zoomStart) / chartWidthPx;
                const dayDelta = Math.round(deltaX * daysPerPx);

                if (dayDelta !== 0) {
                  const [start, end] = dragStartRangeRef.current;
                  const windowSize = end - start;
                  let newStart = start - dayDelta;
                  let newEnd = newStart + windowSize;

                  if (newStart < 1) {
                    newStart = 1;
                    newEnd = newStart + windowSize;
                  }
                  if (newEnd > maxDays) {
                    newEnd = maxDays;
                    newStart = newEnd - windowSize;
                  }

                  setZoomStart(newStart);
                  setZoomEnd(newEnd);
                }
              }
            }}
            onTouchEnd={handleMouseUp}
          >
            <defs>
              {/* Plot Area Clip Path for smooth zooming */}
              <clipPath id="monthlyTrendClip">
                <rect x={paddingLeft - 2} y={0} width={chartW + 4} height={height} />
              </clipPath>

              {/* Selected Month Gradient */}
              <linearGradient id="selMonthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
              </linearGradient>

              {/* Baseline Gradient */}
              <linearGradient id="baseMonthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Y-Axis Horizontal Grid Lines & Scale Labels */}
            {yTicks.map((val, idx) => {
              const y = getY(val);
              return (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray={idx === 0 ? 'none' : '3 3'}
                    strokeWidth="1"
                    opacity="0.6"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    fill="var(--text-2)"
                    fontSize="12"
                    textAnchor="end"
                    fontWeight="600"
                  >
                    {val >= 1000 ? `${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k` : Math.round(val)}
                  </text>
                </g>
              );
            })}

            {/* Mode 1 & 2: Cumulative Pace Curve & Daily Bars */}
            {(chartType === 'cumulative' || chartType === 'daily') && (
              <g clipPath="url(#monthlyTrendClip)">
                {/* Today Indicator Line (if current month) */}
                {isCurrentMonth && currentDay >= zoomStart && currentDay <= zoomEnd && (
                  <g>
                    <line
                      x1={getX(currentDay)}
                      y1={paddingTop - 2}
                      x2={getX(currentDay)}
                      y2={paddingTop + chartH}
                      stroke="var(--accent)"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      opacity="0.9"
                    />
                    <rect
                      x={getX(currentDay) - 28}
                      y={paddingTop - 24}
                      width="56"
                      height="18"
                      rx="6"
                      fill="var(--accent)"
                    />
                    <text
                      x={getX(currentDay)}
                      y={paddingTop - 11}
                      fill="#ffffff"
                      fontSize="10.5"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      Today ({currentDay})
                    </text>
                  </g>
                )}

                {/* Render Cumulative Area/Line */}
                {chartType === 'cumulative' ? (
                  <>
                    {/* Baseline Path */}
                    {baseLinePath && (
                      <path
                        d={baseLinePath}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                        opacity="0.85"
                      />
                    )}

                    {/* Selected Month Area & Line */}
                    {selAreaPath && <path d={selAreaPath} fill="url(#selMonthGrad)" />}
                    {selLinePath && (
                      <path
                        d={selLinePath}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="3"
                      />
                    )}

                    {/* Selected Month Data Circles */}
                    {selPoints.map(p => {
                      if (p.day < zoomStart || p.day > zoomEnd) return null;
                      return (
                        <circle
                          key={p.day}
                          cx={p.x}
                          cy={p.y}
                          r={hoveredDay === p.day ? 6 : (p.day === currentDay && isCurrentMonth ? 4.5 : 3)}
                          fill={p.day === currentDay && isCurrentMonth ? 'var(--accent)' : 'var(--surface)'}
                          stroke="var(--accent)"
                          strokeWidth="2"
                          style={{ transition: 'all 0.15s ease' }}
                        />
                      );
                    })}
                  </>
                ) : (
                  /* Daily Bars Chart Mode */
                  <g>
                    {trendData.map(d => {
                      if (d.day < zoomStart || d.day > zoomEnd) return null;
                      const xCenter = getX(d.day);
                      const barWidth = Math.max(4, (chartW / zoomSpan) * 0.38);

                      const baseY = getY(d.baseDaily);
                      const baseH = Math.max(0, paddingTop + chartH - baseY);

                      const selY = getY(d.selDaily);
                      const selH = (d.selCum !== null) ? Math.max(0, paddingTop + chartH - selY) : 0;

                      return (
                        <g key={d.day}>
                          {/* Baseline Bar */}
                          <rect
                            x={xCenter - barWidth - 1}
                            y={baseY}
                            width={barWidth}
                            height={baseH}
                            fill="#a855f7"
                            opacity="0.5"
                            rx="1.5"
                          />
                          {/* Selected Month Bar */}
                          <rect
                            x={xCenter + 1}
                            y={selY}
                            width={barWidth}
                            height={selH}
                            fill="var(--accent)"
                            opacity={d.isToday ? 1 : 0.85}
                            rx="1.5"
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Interactive Touch/Hover Columns Overlay */}
                {trendData.map(d => {
                  if (d.day < zoomStart || d.day > zoomEnd) return null;
                  const x = getX(d.day);
                  const colW = chartW / zoomSpan;
                  return (
                    <rect
                      key={d.day}
                      x={x - colW / 2}
                      y={paddingTop}
                      width={colW}
                      height={chartH + paddingBottom}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredDay(d.day)}
                      onTouchStart={() => setHoveredDay(d.day)}
                    />
                  );
                })}

                {/* Hover Vertical Guide Line */}
                {hoveredDay !== null && hoveredDay >= zoomStart && hoveredDay <= zoomEnd && (
                  <line
                    x1={getX(hoveredDay)}
                    y1={paddingTop}
                    x2={getX(hoveredDay)}
                    y2={paddingTop + chartH}
                    stroke="var(--text-2)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* X-Axis Day Labels */}
                {trendData.map(d => {
                  if (d.day < zoomStart || d.day > zoomEnd) return null;
                  const labelStep = zoomSpan <= 10 ? 1 : zoomSpan <= 20 ? 2 : 5;
                  if (d.day % labelStep !== 0 && d.day !== zoomStart && d.day !== zoomEnd && d.day !== currentDay) return null;

                  return (
                    <text
                      key={d.day}
                      x={getX(d.day)}
                      y={paddingTop + chartH + 22}
                      fill={d.day === currentDay && isCurrentMonth ? 'var(--accent)' : 'var(--text-2)'}
                      fontSize="12.5"
                      fontWeight={d.day === currentDay && isCurrentMonth ? '800' : '600'}
                      textAnchor="middle"
                    >
                      {d.day}
                    </text>
                  );
                })}
              </g>
            )}

            {/* Mode 3: 6-Month History Bar Chart Mode */}
            {chartType === 'history' && (
              <g>
                {/* Monthly Average Guideline */}
                <line
                  x1={paddingLeft}
                  y1={getY(historyMonthsData.avg)}
                  x2={width - paddingRight}
                  y2={getY(historyMonthsData.avg)}
                  stroke="#a855f7"
                  strokeDasharray="3 3"
                  strokeWidth="1.5"
                  opacity="0.75"
                />
                <text
                  x={width - paddingRight}
                  y={getY(historyMonthsData.avg) - 6}
                  fill="#a855f7"
                  fontSize="12"
                  fontWeight="700"
                  textAnchor="end"
                >
                  6-Mo Avg: {fmtCompactMoney(historyMonthsData.avg, currency)}
                </text>

                {/* 6 Monthly Bar Columns */}
                {historyMonthsData.months.map((m, idx) => {
                  const numM = historyMonthsData.months.length;
                  const colW = chartW / numM;
                  const xCenter = paddingLeft + (idx + 0.5) * colW;
                  const barW = Math.min(42, colW * 0.55);

                  const y = getY(m.total);
                  const h = Math.max(0, paddingTop + chartH - y);

                  const isHovered = hoveredHistoryIdx === idx;

                  return (
                    <g
                      key={m.monthKey}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredHistoryIdx(idx)}
                      onClick={() => setSelectedMonthKey(m.monthKey)}
                    >
                      {/* Bar Background Hover Target */}
                      <rect
                        x={xCenter - colW / 2}
                        y={paddingTop}
                        width={colW}
                        height={chartH + paddingBottom}
                        fill="transparent"
                      />

                      {/* Main Bar */}
                      <rect
                        x={xCenter - barW / 2}
                        y={y}
                        width={barW}
                        height={h}
                        fill={m.isSelected ? 'var(--accent)' : 'var(--surface3)'}
                        stroke={m.isSelected ? 'var(--accent)' : (isHovered ? 'var(--text-2)' : 'none')}
                        strokeWidth="1.5"
                        rx="5"
                        style={{ transition: 'all 0.2s ease' }}
                      />

                      {/* Total Amount above Bar */}
                      <text
                        x={xCenter}
                        y={y - 7}
                        fill={m.isSelected ? 'var(--accent)' : 'var(--text)'}
                        fontSize="12"
                        fontWeight={m.isSelected ? '800' : '600'}
                        textAnchor="middle"
                      >
                        {fmtCompactMoney(m.total, currency)}
                      </text>

                      {/* Month Label below Bar */}
                      <text
                        x={xCenter}
                        y={paddingTop + chartH + 22}
                        fill={m.isSelected ? 'var(--accent)' : 'var(--text-2)'}
                        fontSize="12.5"
                        fontWeight={m.isSelected ? '800' : '600'}
                        textAnchor="middle"
                      >
                        {m.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
          </svg>

          {/* Mini Brush Timeline Bar when zoomed or in cumulative/daily mode */}
          {chartType !== 'history' && (
            <div
              style={{
                marginTop: 8,
                marginBottom: 6,
                padding: '0 48px 0 48px',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 10,
                  background: 'var(--surface3)',
                  borderRadius: 'var(--radius-xs)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const clickDay = Math.round(1 + clickRatio * (maxDays - 1));
                  const windowHalf = Math.round(zoomSpan / 2);
                  let calcStart = Math.max(1, clickDay - windowHalf);
                  const calcEnd = Math.min(maxDays, calcStart + zoomSpan);
                  if (calcEnd === maxDays) calcStart = Math.max(1, calcEnd - zoomSpan);
                  setZoomStart(calcStart);
                  setZoomEnd(calcEnd);
                }}
                title="Click or drag timeline to move visible zoom range"
              >
                {/* Active Zoom Window Indicator */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${((zoomStart - 1) / Math.max(1, maxDays - 1)) * 100}%`,
                    width: `${Math.max(4, (zoomSpan / Math.max(1, maxDays - 1)) * 100)}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    opacity: 0.85,
                    borderRadius: 'var(--radius-xs)',
                    boxShadow: '0 0 4px rgba(0,0,0,0.2)',
                    transition: isDragging ? 'none' : 'all 0.15s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 600 }}>
                <span>Day 1</span>
                {isZoomed ? (
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    Scroll / drag graph to pan • Showing Days {zoomStart}–{zoomEnd}
                  </span>
                ) : (
                  <span>Drag or pinch graph to inspect dates closely</span>
                )}
                <span>Day {maxDays}</span>
              </div>
            </div>
          )}

          {/* Touch & Hover Details Panel (Mobile Optimized) */}
          {(chartType === 'cumulative' || chartType === 'daily') && (
            <div style={{
              marginTop: 6,
              padding: '10px 14px',
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 'var(--fs-xs)',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text)' }}>
                <Calendar size={14} style={{ color: 'var(--accent)' }} />
                <span>
                  {activeHoverData
                    ? `Day ${activeHoverData.day} ${activeHoverData.isToday ? '(Today)' : ''}`
                    : `Day ${currentDay} ${isCurrentMonth ? '(Today)' : ''}`}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{selShortMonthName}:</span>
                  <strong style={{ color: 'var(--text)' }}>
                    {activeHoverData
                      ? (activeHoverData.selCum !== null ? fmtMoney(activeHoverData.selDaily, currency) : '—')
                      : fmtMoney(trendData.find(d => d.day === currentDay)?.selDaily ?? 0, currency)}
                  </strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }} />
                  <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{baseShortMonthName}:</span>
                  <strong style={{ color: 'var(--text)' }}>
                    {activeHoverData
                      ? (activeHoverData.baseCum !== null ? fmtMoney(activeHoverData.baseDaily, currency) : '—')
                      : fmtMoney(trendData.find(d => d.day === currentDay)?.baseDaily ?? 0, currency)}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Legend & Insights */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{selFullMonthName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 2, borderRadius: 2, background: '#a855f7', borderStyle: 'dashed' }} />
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{baseFullMonthName}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Info size={13} style={{ color: 'var(--accent)' }} />
          <span>
            {diffAmount === 0
              ? `Spending pace is identical to baseline.`
              : pctChange < 0
              ? `Spending ${Math.abs(pctChange).toFixed(0)}% slower than ${baseShortMonthName} (${fmtMoney(Math.abs(diffAmount), currency)} saved)`
              : `Spending ${pctChange.toFixed(0)}% faster than ${baseShortMonthName} (+${fmtMoney(diffAmount, currency)})`}
          </span>
        </div>
      </div>
    </div>
  );
}
