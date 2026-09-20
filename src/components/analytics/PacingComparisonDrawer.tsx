import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  TrendingUp,
  TrendingDown,
  Flame,
  Calendar,
  BarChart2,
} from 'lucide-react';
import { fmtMoney, fmtMoneyCompact, getGroupedExpenseAmount } from '../../utils';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';
import type { GroupedExpense } from '../../utils';

export interface DayComparisonData {
  dayIndex: number;
  dayLabel: string;
  curDateStr: string;
  curDateDisplay: string;
  prevDateStr: string;
  prevDateDisplay: string;
  curSpend: number;
  prevSpend: number;
  diff: number;
  diffPct: number;
  isToday: boolean;
  isFuture: boolean;
  curCumulative: number;
  prevCumulative: number;
}

interface PacingComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  period: 'week' | 'month';
  activeWeekMonStr: string;
  activeMonthStr: string;
  currentWeekMonStr: string;
  currentMonthStr: string;
  todayStr: string;
  totalSpent: number;
  prevPeriodSpent: number;
  currency: string;
  periodExpenses: GroupedExpense[];
  prevPeriodExpenses: GroupedExpense[];
  daysPassedCount?: number;
  totalDaysInPeriod?: number;
  isCurrentPeriod?: boolean;
}

function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

function formatISO(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

export const PacingComparisonDrawer: React.FC<PacingComparisonDrawerProps> = ({
  isOpen,
  onClose,
  period,
  activeWeekMonStr,
  activeMonthStr,
  currentWeekMonStr,
  currentMonthStr,
  todayStr,
  totalSpent,
  prevPeriodSpent,
  currency,
  periodExpenses,
  prevPeriodExpenses,
  daysPassedCount = 1,
  totalDaysInPeriod = 7,
  isCurrentPeriod = false,
}) => {
  // Back button handling
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });

  // Escape key handling
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute period labels for header
  const { currentPeriodLabel, prevPeriodLabel, comparisonSubtitle } = useMemo(() => {
    if (period === 'week') {
      const isCur = activeWeekMonStr === currentWeekMonStr;
      const curLbl = isCur ? 'This Week' : 'Selected Week';
      const prevLbl = isCur ? 'Last Week' : 'Previous Week';

      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      const curMon = new Date(wy, wm - 1, wd);
      const curSun = new Date(wy, wm - 1, wd + 6);
      const prevMon = new Date(wy, wm - 1, wd - 7);
      const prevSun = new Date(wy, wm - 1, wd - 1);

      const curRange = `${curMon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${curSun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const prevRange = `${prevMon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${prevSun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      return {
        currentPeriodLabel: curLbl,
        prevPeriodLabel: prevLbl,
        comparisonSubtitle: `${curRange} vs. ${prevRange}`,
      };
    } else {
      const isCur = activeMonthStr === currentMonthStr;
      const curLbl = isCur ? 'This Month' : 'Selected Month';
      const prevLbl = isCur ? 'Last Month' : 'Previous Month';

      const [my, mm] = activeMonthStr.split('-').map(Number);
      const curM = new Date(my, mm - 1, 1);
      const prevM = new Date(my, mm - 2, 1);

      const curName = curM.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const prevName = prevM.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      return {
        currentPeriodLabel: curLbl,
        prevPeriodLabel: prevLbl,
        comparisonSubtitle: `${curName} vs. ${prevName}`,
      };
    }
  }, [period, activeWeekMonStr, activeMonthStr, currentWeekMonStr, currentMonthStr]);

  // Compute daily spend comparison array
  const dayComparisons: DayComparisonData[] = useMemo(() => {
    const results: DayComparisonData[] = [];

    if (period === 'week') {
      const [wy, wm, wd] = activeWeekMonStr.split('-').map(Number);
      let runCur = 0;
      let runPrev = 0;

      for (let i = 0; i < 7; i++) {
        const curD = new Date(wy, wm - 1, wd + i);
        const prevD = new Date(wy, wm - 1, wd - 7 + i);

        const curDateStr = formatISO(curD);
        const prevDateStr = formatISO(prevD);

        const curDayName = curD.toLocaleDateString('en-US', { weekday: 'short' });
        const curDateDisplay = curD.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const prevDateDisplay = prevD.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        const isToday = curDateStr === todayStr;
        const isFuture = isCurrentPeriod && curDateStr > todayStr;

        const curExps = periodExpenses.filter((ge) => ge.date === curDateStr && ge.flow === 'out');
        const prevExps = prevPeriodExpenses.filter((ge) => ge.date === prevDateStr && ge.flow === 'out');

        const curSpend = curExps.reduce((s, ge) => s + getGroupedExpenseAmount(ge), 0);
        const prevSpend = prevExps.reduce((s, ge) => s + getGroupedExpenseAmount(ge), 0);

        if (!isFuture) {
          runCur += curSpend;
        }
        runPrev += prevSpend;

        const diff = curSpend - prevSpend;
        const diffPct = prevSpend > 0 ? Math.round((diff / prevSpend) * 100) : curSpend > 0 ? 100 : 0;

        results.push({
          dayIndex: i,
          dayLabel: curDayName,
          curDateStr,
          curDateDisplay,
          prevDateStr,
          prevDateDisplay,
          curSpend: isFuture ? 0 : curSpend,
          prevSpend,
          diff: isFuture ? 0 : diff,
          diffPct: isFuture ? 0 : diffPct,
          isToday,
          isFuture,
          curCumulative: runCur,
          prevCumulative: runPrev,
        });
      }
    } else {
      // Month mode
      const [my, mm] = activeMonthStr.split('-').map(Number);
      const totalDays = new Date(my, mm, 0).getDate();
      const prevTotalDays = new Date(my, mm - 1, 0).getDate();

      let runCur = 0;
      let runPrev = 0;

      for (let d = 1; d <= totalDays; d++) {
        const curD = new Date(my, mm - 1, d);
        const curDateStr = formatISO(curD);
        const isToday = curDateStr === todayStr;
        const isFuture = isCurrentPeriod && curDateStr > todayStr;

        let prevDateStr = '';
        let prevDateDisplay = '';
        let prevSpend = 0;

        if (d <= prevTotalDays) {
          const prevD = new Date(my, mm - 2, d);
          prevDateStr = formatISO(prevD);
          prevDateDisplay = prevD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const prevExps = prevPeriodExpenses.filter((ge) => ge.date === prevDateStr && ge.flow === 'out');
          prevSpend = prevExps.reduce((s, ge) => s + getGroupedExpenseAmount(ge), 0);
        }

        const curDateDisplay = curD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const curExps = periodExpenses.filter((ge) => ge.date === curDateStr && ge.flow === 'out');
        const curSpend = curExps.reduce((s, ge) => s + getGroupedExpenseAmount(ge), 0);

        if (!isFuture) {
          runCur += curSpend;
        }
        runPrev += prevSpend;

        const diff = curSpend - prevSpend;
        const diffPct = prevSpend > 0 ? Math.round((diff / prevSpend) * 100) : curSpend > 0 ? 100 : 0;

        results.push({
          dayIndex: d - 1,
          dayLabel: String(d),
          curDateStr,
          curDateDisplay,
          prevDateStr,
          prevDateDisplay,
          curSpend: isFuture ? 0 : curSpend,
          prevSpend,
          diff: isFuture ? 0 : diff,
          diffPct: isFuture ? 0 : diffPct,
          isToday,
          isFuture,
          curCumulative: runCur,
          prevCumulative: runPrev,
        });
      }
    }

    return results;
  }, [
    period,
    activeWeekMonStr,
    activeMonthStr,
    todayStr,
    isCurrentPeriod,
    periodExpenses,
    prevPeriodExpenses,
  ]);

  // Selected or hovered day for deep-dive inspection card
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'cumulative' | 'daily'>('cumulative');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleScrubPointer = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = clientX - rect.left;
    const svgX = (relX / rect.width) * 500;
    const padL = 48;
    const padR = 18;
    const plotW = 500 - padL - padR;
    const count = dayComparisons.length;
    if (count <= 1) return;
    const clampedX = Math.max(padL, Math.min(padL + plotW, svgX));
    const normalized = (clampedX - padL) / plotW;
    const nearestIdx = Math.round(normalized * (count - 1));
    if (nearestIdx >= 0 && nearestIdx < count) {
      setSelectedDayIndex(nearestIdx);
    }
  };

  const activeInspectedDay = useMemo(() => {
    if (selectedDayIndex !== null && dayComparisons[selectedDayIndex]) {
      return dayComparisons[selectedDayIndex];
    }
    // Find today or highest spend day
    const todayMatch = dayComparisons.find((d) => d.isToday);
    if (todayMatch) return todayMatch;

    const withSpend = dayComparisons.filter((d) => !d.isFuture && (d.curSpend > 0 || d.prevSpend > 0));
    if (withSpend.length > 0) {
      return withSpend.reduce((max, d) => (Math.abs(d.diff) > Math.abs(max.diff) ? d : max), withSpend[0]);
    }
    return dayComparisons[0] || null;
  }, [selectedDayIndex, dayComparisons]);

  // Calculate high-level pacing stats
  const pacingStats = useMemo(() => {
    const diff = totalSpent - prevPeriodSpent;
    const diffPct = prevPeriodSpent > 0 ? Math.round((diff / prevPeriodSpent) * 100) : totalSpent > 0 ? 100 : 0;

    const daysCount = Math.max(1, daysPassedCount);
    const curDailyAvg = totalSpent / daysCount;
    const prevDailyAvg = prevPeriodSpent / daysCount;
    const dailyDiff = curDailyAvg - prevDailyAvg;

    // Projected period end total (if current period)
    const projectedTotal = isCurrentPeriod ? curDailyAvg * Math.max(daysCount, totalDaysInPeriod) : totalSpent;

    // Trajectory
    let trajectory: 'faster' | 'slower' | 'even' = 'even';
    if (prevPeriodSpent > 0) {
      if (totalSpent > prevPeriodSpent * 1.05) {
        trajectory = 'faster';
      } else if (totalSpent < prevPeriodSpent * 0.95) {
        trajectory = 'slower';
      }
    } else if (totalSpent > 0) {
      trajectory = 'faster';
    }

    // Find highest variance day
    const validDays = dayComparisons.filter((d) => !d.isFuture);
    const highestIncreaseDay = validDays.length > 0
      ? validDays.reduce((max, d) => (d.diff > max.diff ? d : max), validDays[0])
      : null;

    const highestSavingDay = validDays.length > 0
      ? validDays.reduce((min, d) => (d.diff < min.diff ? d : min), validDays[0])
      : null;

    // No-spend days count
    const curNoSpendCount = dayComparisons.filter((d) => !d.isFuture && d.curSpend === 0).length;
    const prevNoSpendCount = dayComparisons.filter((d) => d.prevSpend === 0).length;

    return {
      diff,
      diffPct,
      curDailyAvg,
      prevDailyAvg,
      dailyDiff,
      projectedTotal,
      trajectory,
      highestIncreaseDay,
      highestSavingDay,
      curNoSpendCount,
      prevNoSpendCount,
    };
  }, [totalSpent, prevPeriodSpent, daysPassedCount, totalDaysInPeriod, isCurrentPeriod, dayComparisons]);

  // Max value for Y-Axis scaling in the graph
  const maxBarValue = useMemo(() => {
    const allValues = dayComparisons.flatMap((d) =>
      chartMode === 'cumulative'
        ? [d.curCumulative, d.prevCumulative]
        : [d.curSpend, d.prevSpend]
    );
    const maxVal = Math.max(...allValues, 100);
    if (maxVal <= 500) return Math.ceil(maxVal / 100) * 100;
    if (maxVal <= 2000) return Math.ceil(maxVal / 300) * 300;
    if (maxVal <= 10000) return Math.ceil(maxVal / 1000) * 1000;
    if (maxVal <= 50000) return Math.ceil(maxVal / 5000) * 5000;
    return Math.ceil(maxVal / 10000) * 10000;
  }, [dayComparisons, chartMode]);

  // Y-axis steps calibrated for both linear cumulative and power-scale daily distributions
  const yAxisSteps = useMemo(() => {
    if (chartMode === 'cumulative') {
      const step = maxBarValue / 3;
      return [Math.round(maxBarValue), Math.round(step * 2), Math.round(step), 0];
    }

    // Daily mode: pick clean, human-friendly milestone levels matching the power curve
    if (maxBarValue <= 300) {
      return [maxBarValue, Math.round(maxBarValue * 0.5), 0];
    }

    const roundToNice = (v: number) => {
      if (v >= 20000) return Math.round(v / 5000) * 5000;
      if (v >= 5000) return Math.round(v / 1000) * 1000;
      if (v >= 1000) return Math.round(v / 250) * 250;
      if (v >= 500) return Math.round(v / 100) * 100;
      if (v >= 100) return Math.round(v / 50) * 50;
      return Math.max(10, Math.round(v / 10) * 10);
    };

    const top = maxBarValue;
    const mid = roundToNice(maxBarValue * 0.35);
    const low = roundToNice(maxBarValue * 0.08);

    const ticks: number[] = [top];
    if (mid < top && mid > low) ticks.push(mid);
    if (low < (ticks[ticks.length - 1] || top) && low > 0) ticks.push(low);
    ticks.push(0);

    return ticks;
  }, [maxBarValue, chartMode]);

  if (!isOpen) return null;

  const isMonth = period === 'month';

  return createPortal(
    <div
      className="modal-backdrop-motion"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pacing-drawer-title"
    >
      <div
        className="modal-dialog-panel pacing-comparison-drawer-panel"
        style={{
          maxWidth: 520,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--border2)',
            margin: '12px auto 4px',
            flexShrink: 0,
          }}
        />

        {/* 1. Header (Seamless) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px 8px',
            backgroundColor: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-full)',
                display: 'grid',
                placeItems: 'center',
                backgroundColor:
                  pacingStats.trajectory === 'faster'
                    ? 'var(--debit-bg)'
                    : pacingStats.trajectory === 'slower'
                    ? 'var(--credit-bg)'
                    : 'var(--surface2)',
                color:
                  pacingStats.trajectory === 'faster'
                    ? 'var(--debit)'
                    : pacingStats.trajectory === 'slower'
                    ? 'var(--credit)'
                    : 'var(--accent)',
                flexShrink: 0,
              }}
            >
              {pacingStats.trajectory === 'faster' ? (
                <Flame size={19} strokeWidth={2.4} />
              ) : pacingStats.trajectory === 'slower' ? (
                <TrendingDown size={19} strokeWidth={2.4} />
              ) : (
                <TrendingUp size={19} strokeWidth={2.4} />
              )}
            </div>

            <div>
              <h3
                id="pacing-drawer-title"
                style={{
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text)',
                  lineHeight: 1.2,
                }}
              >
                Pacing & Comparison
              </h3>
              <div
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-3)',
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                {comparisonSubtitle}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            aria-label="Close drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body - Clean canvas without nested gray cards */}
        <div
          style={{
            padding: '8px 18px 12px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flex: 1,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Main Chart Container - Merged seamlessly with panel background */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Chart Header Row 1: Title + Sleek Mode Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={15} style={{ color: '#f97316' }} />
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)' }}>
                  {period === 'week' ? 'Weekly Pace' : 'Monthly Pace'}
                </span>
              </div>

              {/* Mode Switch Pills with Icons */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  background: 'var(--surface2)',
                  padding: '2px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setChartMode('cumulative')}
                  title="Running Total"
                  aria-label="Running Total"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 650,
                    border: 'none',
                    background: chartMode === 'cumulative' ? 'var(--accent)' : 'transparent',
                    color: chartMode === 'cumulative' ? 'var(--accent-contrast)' : 'var(--text-3)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <TrendingUp size={11} strokeWidth={2.5} />
                  <span>Total</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('daily')}
                  title="Daily Spend"
                  aria-label="Daily Spend"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 650,
                    border: 'none',
                    background: chartMode === 'daily' ? 'var(--accent)' : 'transparent',
                    color: chartMode === 'daily' ? 'var(--accent-contrast)' : 'var(--text-3)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <BarChart2 size={11} strokeWidth={2.5} />
                  <span>Daily</span>
                </button>
              </div>
            </div>

            {/* Chart Header Row 2: Legend & Interactive Day Readout */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
                minHeight: 24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#f97316',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text)', fontWeight: 650 }}>
                    {currentPeriodLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#0284c7',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', fontWeight: 550 }}>
                    {prevPeriodLabel}
                  </span>
                </div>
              </div>

              {activeInspectedDay && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--surface2)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border)',
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--text)',
                    fontWeight: 650,
                  }}
                >
                  <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>
                    {isMonth ? activeInspectedDay.curDateDisplay : activeInspectedDay.dayLabel}
                  </span>
                  <span style={{ color: '#f97316' }}>
                    {fmtMoneyCompact(
                      chartMode === 'cumulative' ? activeInspectedDay.curCumulative : activeInspectedDay.curSpend,
                      currency
                    )}
                  </span>
                  <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-caption)' }}>vs</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {fmtMoneyCompact(
                      chartMode === 'cumulative' ? activeInspectedDay.prevCumulative : activeInspectedDay.prevSpend,
                      currency
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* SVG Dual-Line Chart Stage - Interactive Scrubbing & Gesture Support */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                userSelect: 'none',
                marginTop: 2,
                touchAction: 'none',
              }}
              onPointerDown={(e) => {
                setIsDragging(true);
                handleScrubPointer(e.clientX);
              }}
              onPointerMove={(e) => {
                if (isDragging || e.buttons > 0) {
                  handleScrubPointer(e.clientX);
                }
              }}
              onPointerUp={() => setIsDragging(false)}
              onPointerCancel={() => setIsDragging(false)}
              onTouchStart={(e) => {
                if (e.touches.length > 0) {
                  handleScrubPointer(e.touches[0].clientX);
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length > 0) {
                  handleScrubPointer(e.touches[0].clientX);
                }
              }}
            >
              <svg
                ref={svgRef}
                viewBox="0 0 500 215"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  overflow: 'visible',
                  cursor: 'ew-resize',
                }}
              >
                {/* Chart Coordinate Math */}
                {(() => {
                  const padL = 48;
                  const padR = 18;
                  const padT = 24;
                  const padB = 30;
                  const plotW = 500 - padL - padR;
                  const plotH = 215 - padT - padB;
                  const count = dayComparisons.length;

                  const getX = (idx: number) => {
                    if (count <= 1) return padL + plotW / 2;
                    return padL + (idx / (count - 1)) * plotW;
                  };

                  const isCumulative = chartMode === 'cumulative';

                  const getY = (val: number) => {
                    const clamped = Math.max(0, val);
                    if (maxBarValue <= 0 || clamped <= 0) return padT + plotH;

                    if (!isCumulative) {
                      // Power scale (gamma 0.48) provides high contrast & vertical dynamic range for small/medium spends
                      // even when a large outlier spike exists in the month
                      const ratio = Math.min(1, clamped / maxBarValue);
                      const scaledRatio = Math.pow(ratio, 0.48);
                      return padT + plotH - scaledRatio * plotH;
                    }

                    // Linear scale for Cumulative Running Total
                    const ratio = Math.min(1, clamped / maxBarValue);
                    return padT + plotH - ratio * plotH;
                  };

                  // Horizontal Grid Lines & Y-Axis Labels
                  const yGrid = yAxisSteps.map((val) => ({
                    val,
                    y: getY(val),
                  }));

                  // Build SVG Points
                  const prevPoints = dayComparisons.map((day, idx) => ({
                    x: getX(idx),
                    y: getY(isCumulative ? day.prevCumulative : day.prevSpend),
                  }));

                  const validCurDays = isCurrentPeriod
                    ? dayComparisons.filter((d) => !d.isFuture)
                    : dayComparisons;

                  const curPoints = validCurDays.map((day) => ({
                    x: getX(day.dayIndex),
                    y: getY(isCumulative ? day.curCumulative : day.curSpend),
                  }));

                  // Build SVG Path strings
                  let prevPathD = '';
                  prevPoints.forEach((p, idx) => {
                    prevPathD += idx === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
                  });

                  let curPathD = '';
                  curPoints.forEach((p, idx) => {
                    curPathD += idx === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
                  });

                  // Build Area Fill strings
                  let prevAreaD = '';
                  if (prevPoints.length > 0) {
                    const firstX = prevPoints[0].x;
                    const lastX = prevPoints[prevPoints.length - 1].x;
                    const bottomY = padT + plotH;
                    prevAreaD = `${prevPathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
                  }

                  let curAreaD = '';
                  if (curPoints.length > 0) {
                    const firstX = curPoints[0].x;
                    const lastX = curPoints[curPoints.length - 1].x;
                    const bottomY = padT + plotH;
                    curAreaD = `${curPathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
                  }

                  const activeIdx = activeInspectedDay ? activeInspectedDay.dayIndex : -1;
                  const activeX = activeIdx >= 0 ? getX(activeIdx) : null;
                  const activeCurPoint = activeIdx >= 0 ? curPoints.find((p) => Math.abs(p.x - (activeX || 0)) < 0.5) : null;
                  const activePrevPoint = activeIdx >= 0 ? prevPoints[activeIdx] : null;

                  return (
                    <>
                      <defs>
                        <linearGradient id="pacingCurAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="pacingPrevAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0284c7" stopOpacity="0.14" />
                          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Background Soft Grid Lines (Horizontal) */}
                      {yGrid.map((g, i) => (
                        <g key={`hgrid-${i}`}>
                          <line
                            x1={padL}
                            y1={g.y}
                            x2={padL + plotW}
                            y2={g.y}
                            stroke="var(--border)"
                            strokeOpacity={i === yGrid.length - 1 ? 0.7 : 0.4}
                            strokeWidth="1"
                            strokeDasharray={i === yGrid.length - 1 ? 'none' : '4 4'}
                          />
                          <text
                            x={padL - 8}
                            y={g.y + 4}
                            textAnchor="end"
                            fill="var(--text-2)"
                            fontSize="11.5"
                            fontWeight="650"
                            fontFamily="inherit"
                          >
                            {fmtMoneyCompact(g.val, currency)}
                          </text>
                        </g>
                      ))}

                      {/* Vertical Soft Grid Lines & X-Axis Labels */}
                      {dayComparisons.map((day, idx) => {
                        const x = getX(idx);
                        const isSelected = activeIdx === idx;
                        const showTickLabel =
                          !isMonth ||
                          idx === 0 ||
                          (idx + 1) % 5 === 0 ||
                          idx === count - 1 ||
                          day.isToday ||
                          isSelected;

                        return (
                          <g key={`vgrid-${idx}`}>
                            {/* Vertical Grid Line */}
                            <line
                              x1={x}
                              y1={padT}
                              x2={x}
                              y2={padT + plotH}
                              stroke="var(--border)"
                              strokeOpacity={isSelected ? 0.55 : 0.2}
                              strokeWidth={isSelected ? 1.5 : 1}
                              strokeDasharray="3 3"
                            />

                            {/* X-Axis Tick Label */}
                            {showTickLabel && (
                              <text
                                x={x}
                                y={padT + plotH + 18}
                                textAnchor="middle"
                                fill={
                                  day.isToday
                                    ? '#f97316'
                                    : isSelected
                                    ? 'var(--text)'
                                    : 'var(--text-2)'
                                }
                                fontSize={isMonth ? '11' : '12'}
                                fontWeight={day.isToday || isSelected ? '800' : '650'}
                                fontFamily="inherit"
                              >
                                {day.dayLabel}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Area Fill Polygons */}
                      {prevAreaD && <path d={prevAreaD} fill="url(#pacingPrevAreaGrad)" />}
                      {curAreaD && <path d={curAreaD} fill="url(#pacingCurAreaGrad)" />}

                      {/* Line 1: Previous Period (Blue Path) */}
                      {prevPathD && (
                        <path
                          d={prevPathD}
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Line 2: Current Period (Orange Path) */}
                      {curPathD && (
                        <path
                          d={curPathD}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Node Points: Previous Period (Blue Dots) - Clean Non-Cluttered Rendering */}
                      {dayComparisons.map((day, idx) => {
                        const x = getX(idx);
                        const val = isCumulative ? day.prevCumulative : day.prevSpend;
                        const y = getY(val);
                        const isSelected = activeIdx === idx;

                        const showNode =
                          isSelected ||
                          (!isMonth && (idx === 0 || idx === count - 1 || day.isToday || val > 0)) ||
                          (isMonth && !isCumulative && day.prevSpend > 0) ||
                          (isMonth && isCumulative && (idx === 0 || (idx + 1) % 5 === 0 || idx === count - 1));

                        if (!showNode) return null;

                        return (
                          <g key={`prev-node-${idx}`}>
                            <circle
                              cx={x}
                              cy={y}
                              r={isSelected ? 6 : 3.5}
                              fill="#0284c7"
                              stroke="var(--surface)"
                              strokeWidth={isSelected ? 2.5 : 1.5}
                              style={{ transition: 'r 0.15s ease' }}
                            />
                          </g>
                        );
                      })}

                      {/* Node Points: Current Period (Orange Dots) - Clean Non-Cluttered Rendering */}
                      {validCurDays.map((day) => {
                        const x = getX(day.dayIndex);
                        const val = isCumulative ? day.curCumulative : day.curSpend;
                        const y = getY(val);
                        const isSelected = activeIdx === day.dayIndex;

                        const showNode =
                          isSelected ||
                          day.isToday ||
                          (!isMonth && (day.dayIndex === 0 || day.dayIndex === count - 1 || val > 0)) ||
                          (isMonth && !isCumulative && day.curSpend > 0) ||
                          (isMonth && isCumulative && (day.dayIndex === 0 || (day.dayIndex + 1) % 5 === 0 || day.dayIndex === count - 1));

                        if (!showNode) return null;

                        return (
                          <g key={`cur-node-${day.dayIndex}`}>
                            <circle
                              cx={x}
                              cy={y}
                              r={isSelected ? 6.5 : 4}
                              fill="#f97316"
                              stroke="var(--surface)"
                              strokeWidth={isSelected ? 2.5 : 1.5}
                              style={{ transition: 'r 0.15s ease' }}
                            />
                          </g>
                        );
                      })}

                      {/* Active Day Vertical Scrubber Line & Highlight Overlays */}
                      {activeX !== null && (
                        <g>
                          <line
                            x1={activeX}
                            y1={padT}
                            x2={activeX}
                            y2={padT + plotH}
                            stroke="#f97316"
                            strokeWidth="2"
                            strokeDasharray="4 3"
                            opacity="0.9"
                          />

                          {/* Previous Point Ring Highlight */}
                          {activePrevPoint && (
                            <circle
                              cx={activePrevPoint.x}
                              cy={activePrevPoint.y}
                              r={11}
                              fill="rgba(2, 132, 199, 0.22)"
                            />
                          )}

                          {/* Active Current Node Highlight & Callout */}
                          {activeCurPoint && (
                            <g>
                              <circle
                                cx={activeCurPoint.x}
                                cy={activeCurPoint.y}
                                r={12}
                                fill="rgba(249, 115, 22, 0.25)"
                              />
                            </g>
                          )}
                        </g>
                      )}

                      {/* Interactive Invisible Column Hit Areas for Click/Tap */}
                      {dayComparisons.map((_, idx) => {
                        const x = getX(idx);
                        const colW = count > 1 ? plotW / (count - 1) : plotW;
                        const hitLeft = x - colW / 2;

                        return (
                          <rect
                            key={`hit-${idx}`}
                            x={Math.max(padL, hitLeft)}
                            y={padT - 10}
                            width={colW}
                            height={plotH + padB + 10}
                            fill="transparent"
                            cursor="pointer"
                            onClick={() => setSelectedDayIndex(idx)}
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* NEW Projection at Month-End or Week-End Card */}
          {(() => {
            const isWeekPeriod = period === 'week';
            const projTitle = isWeekPeriod ? 'End-of-Week Projection' : 'End-of-Month Projection';
            const curDaysCount = Math.max(1, daysPassedCount);
            const maxDays = totalDaysInPeriod || (isWeekPeriod ? 7 : 30);
            const projectedTotal = pacingStats.projectedTotal;
            const diffVsPrev = projectedTotal - prevPeriodSpent;
            const isLower = diffVsPrev < 0;

            return (
              <div
                style={{
                  padding: '11px 13px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  boxShadow: 'var(--shadow)',
                }}
              >
                {/* Title & Projection Status Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'nowrap',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 750, color: 'var(--text)', lineHeight: 1.2 }}>
                      {projTitle}
                    </div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Based on avg {fmtMoney(pacingStats.curDailyAvg, currency)}/day
                    </div>
                  </div>

                  {/* Pacing Badge */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      backgroundColor: isLower
                        ? 'var(--credit-bg)'
                        : diffVsPrev > 0
                        ? 'var(--debit-bg)'
                        : 'var(--surface)',
                      color: isLower ? 'var(--credit)' : diffVsPrev > 0 ? 'var(--debit)' : 'var(--text-2)',
                      border: `1px solid ${
                        isLower
                          ? 'var(--credit-border)'
                          : diffVsPrev > 0
                          ? 'var(--debit-border)'
                          : 'var(--border)'
                      }`,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isLower ? (
                      <TrendingDown size={13} strokeWidth={2.4} />
                    ) : diffVsPrev > 0 ? (
                      <TrendingUp size={13} strokeWidth={2.4} />
                    ) : null}
                    <span>
                      {isLower ? '' : diffVsPrev > 0 ? '+' : ''}
                      {fmtMoney(diffVsPrev, currency)} vs last
                    </span>
                  </div>
                </div>

                {/* 3-Column Stats Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    background: 'var(--surface)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Column 1: Current Spent */}
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 600 }}>
                      Current Spent
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text)', marginTop: 1 }}>
                      {fmtMoney(totalSpent, currency)}
                    </div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 1 }}>
                      Day {curDaysCount} of {maxDays}
                    </div>
                  </div>

                  {/* Column 2: Projected Total */}
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 600 }}>
                      Projected Total
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#f97316', marginTop: 1 }}>
                      {fmtMoney(projectedTotal, currency)}
                    </div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 1 }}>
                      {isWeekPeriod ? 'By Sun' : 'By End'}
                    </div>
                  </div>

                  {/* Column 3: Previous Period Total */}
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 600 }}>
                      {isWeekPeriod ? 'Last Week' : 'Last Month'}
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-2)', marginTop: 1 }}>
                      {fmtMoney(prevPeriodSpent, currency)}
                    </div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 1 }}>
                      Full Actual
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer Close Button */}
        <div
          style={{
            padding: '10px 18px calc(10px + env(safe-area-inset-bottom, 0px))',
            backgroundColor: 'var(--surface)',
            flexShrink: 0,
            display: 'flex',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              height: 40,
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 3px 12px var(--accent-soft)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PacingComparisonDrawer;
