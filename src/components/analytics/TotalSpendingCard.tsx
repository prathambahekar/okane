import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Filter, ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from 'lucide-react';
import { fmtMoney, fmtMoneyCompact } from '../../utils';

export interface ChartDayData {
  dateStr: string;
  dayName: string;
  dayNum: number;
  fullDateLabel: string;
  spend: number;
  count: number;
  isToday: boolean;
  isYesterday: boolean;
}

interface TotalSpendingCardProps {
  period: 'week' | 'month';
  totalSpent: number;
  prevPeriodSpent: number;
  dailyAvg: number;
  highestDayAmount: number;
  noSpendDaysCount: number;
  chartDays: ChartDayData[];
  currency: string;
  onOpenFilter?: () => void;
  activeFilterCount?: number;
  onSelectDay?: (dateStr: string) => void;
  selectedDateStr?: string | null;
}

export const TotalSpendingCard: React.FC<TotalSpendingCardProps> = ({
  period,
  totalSpent,
  prevPeriodSpent,
  dailyAvg,
  highestDayAmount,
  noSpendDaysCount,
  chartDays,
  currency,
  onOpenFilter,
  activeFilterCount = 0,
  onSelectDay,
  selectedDateStr,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeBarRef = useRef<HTMLDivElement>(null);

  // Compute comparison trend
  const comparison = useMemo(() => {
    if (prevPeriodSpent <= 0) {
      if (totalSpent > 0) return { type: 'neutral', label: `No spend ${period === 'week' ? 'last week' : 'last month'}` };
      return { type: 'neutral', label: `0% change vs ${period === 'week' ? 'last week' : 'last month'}` };
    }
    const diff = totalSpent - prevPeriodSpent;
    const pct = Math.abs(Math.round((diff / prevPeriodSpent) * 100));
    const periodLabel = period === 'week' ? 'last week' : 'last month';

    if (diff < 0) {
      return {
        type: 'down',
        pct,
        label: `${pct}% less than ${periodLabel}`,
      };
    } else if (diff > 0) {
      return {
        type: 'up',
        pct,
        label: `${pct}% more than ${periodLabel}`,
      };
    }
    return {
      type: 'neutral',
      pct: 0,
      label: `Same as ${periodLabel}`,
    };
  }, [totalSpent, prevPeriodSpent, period]);

  // Determine highest value for Y-axis scaling
  const maxDaySpend = useMemo(() => {
    const maxVal = Math.max(...chartDays.map(d => d.spend), 100);
    if (maxVal <= 500) return Math.ceil(maxVal / 100) * 100;
    if (maxVal <= 2000) return Math.ceil(maxVal / 300) * 300;
    if (maxVal <= 10000) return Math.ceil(maxVal / 1000) * 1000;
    return Math.ceil(maxVal / 5000) * 5000;
  }, [chartDays]);

  // Y-axis steps: max, 2/3, 1/3, 0
  const yAxisMarkers = useMemo(() => {
    const step = maxDaySpend / 3;
    return [
      Math.round(maxDaySpend),
      Math.round(step * 2),
      Math.round(step),
      0,
    ];
  }, [maxDaySpend]);

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Target date for initial centering in month view: selected date, today, or latest day
  const scrollTargetDateStr = useMemo(() => {
    if (selectedDateStr) return selectedDateStr;
    const todayDay = chartDays.find(d => d.isToday);
    if (todayDay) return todayDay.dateStr;
    return chartDays[chartDays.length - 1]?.dateStr || null;
  }, [chartDays, selectedDateStr]);

  // Auto-scroll to active bar in month view or when selectedDate changes
  useEffect(() => {
    if (activeBarRef.current && scrollContainerRef.current && chartDays.length > 7) {
      const container = scrollContainerRef.current;
      const bar = activeBarRef.current;
      const barLeft = bar.offsetLeft;
      const barWidth = bar.offsetWidth;
      const containerWidth = container.offsetWidth;

      // Center the active bar in the scroll container
      const targetScroll = barLeft - containerWidth / 2 + barWidth / 2;
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [scrollTargetDateStr, period, chartDays.length]);

  const isMonthView = period === 'month' || chartDays.length > 7;

  return (
    <div className="analytics-v2-card">
      {/* Header: Icon Pill, Title & Filters Button */}
      <div className="analytics-v2-card-header">
        <div className="analytics-v2-header-left">
          <span className="analytics-v2-header-icon-pill">
            <TrendingUp size={15} strokeWidth={2.2} />
          </span>
          <h2 className="analytics-v2-card-title">Total Spending</h2>
        </div>

        {onOpenFilter && (
          <button
            type="button"
            onClick={onOpenFilter}
            className={`analytics-v2-filter-btn ${activeFilterCount > 0 ? 'active' : ''}`}
            title={activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Filters'}
            aria-label="Filter analytics"
          >
            <Filter size={14} strokeWidth={2.2} />
            <span className="analytics-v2-filter-text">Filters</span>
            {activeFilterCount > 0 && (
              <span className="analytics-v2-filter-badge">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Hero Total Amount */}
      <div className="analytics-v2-hero-amount">
        {fmtMoney(totalSpent, currency)}
      </div>

      {/* Comparison Trend Badge */}
      <div>
        <div className={`analytics-v2-trend-badge ${comparison.type}`}>
          {comparison.type === 'down' && <ArrowDownRight size={14} strokeWidth={2.5} />}
          {comparison.type === 'up' && <ArrowUpRight size={14} strokeWidth={2.5} />}
          {comparison.type === 'neutral' && <Minus size={14} strokeWidth={2.5} />}
          <span>{comparison.label}</span>
        </div>
      </div>

      {/* 3-Metric Summary Columns */}
      <div className="analytics-v2-metrics-strip">
        <div className="analytics-v2-metric-col">
          <span className="analytics-v2-metric-val">
            {fmtMoney(dailyAvg, currency)}
          </span>
          <span className="analytics-v2-metric-lbl">Daily avg</span>
        </div>

        <div className="analytics-v2-metric-col">
          <span className="analytics-v2-metric-val">
            {fmtMoney(highestDayAmount, currency)}
          </span>
          <span className="analytics-v2-metric-lbl">Highest day</span>
        </div>

        <div className="analytics-v2-metric-col">
          <span className="analytics-v2-metric-val">{noSpendDaysCount}</span>
          <span className="analytics-v2-metric-lbl">No-spend days</span>
        </div>
      </div>

      {/* Interactive Visual Bar Chart with Fixed Y-Axis & Scrollable Days */}
      <div
        className="analytics-v2-chart-stage"
        onMouseLeave={() => setHoveredDate(null)}
      >
        {/* Fixed Y-Axis Column on Left */}
        <div className="analytics-v2-y-axis-col">
          {yAxisMarkers.map((marker, idx) => (
            <span key={idx} className="analytics-v2-grid-label">
              {fmtMoneyCompact(marker, currency)}
            </span>
          ))}
          {/* Spacer for bottom day meta label row */}
          <div className="analytics-v2-y-axis-spacer" />
        </div>

        {/* Scrollable Chart Stage: Scrollable in Month, Fixed Grid in Week */}
        <div
          className={`analytics-v2-chart-scroll-wrap ${!isMonthView ? 'week-mode' : ''}`}
          ref={scrollContainerRef}
        >
          <div
            className="analytics-v2-chart-canvas"
            style={{
              minWidth: isMonthView ? `${Math.max(chartDays.length * 34, 320)}px` : '100%',
            }}
          >
            {/* Background Horizontal Grid Lines Layer */}
            <div className="analytics-v2-grid-lines-layer">
              {yAxisMarkers.map((_, idx) => (
                <div key={idx} className="analytics-v2-canvas-grid-line" />
              ))}
            </div>

            {/* Bars Row */}
            <div
              className="analytics-v2-bars-row"
              onMouseLeave={() => setHoveredDate(null)}
            >
              {chartDays.map((day, idx) => {
                const heightPercent = maxDaySpend > 0 ? (day.spend / maxDaySpend) * 100 : 0;
                const isHovered = hoveredDate === day.dateStr;
                const isSelected = selectedDateStr === day.dateStr;
                const hasSpend = day.spend > 0;

                // Edge-aware tooltip alignment to avoid clipping on left/right edges
                let tooltipAlign = 'align-center';
                if (idx === 0) {
                  tooltipAlign = 'align-left';
                } else if (idx === chartDays.length - 1) {
                  tooltipAlign = 'align-right';
                } else if (!isMonthView && idx === 1) {
                  tooltipAlign = 'align-left-soft';
                } else if (!isMonthView && idx === chartDays.length - 2) {
                  tooltipAlign = 'align-right-soft';
                }

                return (
                  <div
                    key={day.dateStr}
                    ref={day.dateStr === scrollTargetDateStr ? activeBarRef : null}
                    className={`analytics-v2-bar-col ${isSelected ? 'selected active' : ''} ${isHovered ? 'hovered' : ''} ${isMonthView ? 'month-col' : ''}`}
                    onMouseEnter={() => setHoveredDate(day.dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                    onClick={() => {
                      onSelectDay?.(day.dateStr);
                      // Toggle tooltip on tap for touch/mobile devices
                      setHoveredDate(prev => prev === day.dateStr ? null : day.dateStr);
                    }}
                  >
                    {/* Floating Tooltip Bubble - ONLY shown when actively hovered or tapped */}
                    {isHovered && (
                      <div className={`analytics-v2-tooltip-bubble ${tooltipAlign}`}>
                        <div className="analytics-v2-tooltip-content">
                          <div className="analytics-v2-tooltip-date">{day.fullDateLabel}</div>
                          <div className="analytics-v2-tooltip-amount">{fmtMoney(day.spend, currency)}</div>
                          <div className="analytics-v2-tooltip-count">
                            {day.count} {day.count === 1 ? 'transaction' : 'transactions'}
                          </div>
                        </div>
                        <div className="analytics-v2-tooltip-pointer" />
                      </div>
                    )}

                    {/* Bar Track & Fill */}
                    <div className="analytics-v2-bar-track">
                      <div
                        className={`analytics-v2-bar-fill ${isSelected ? 'selected active' : ''} ${isHovered ? 'hovered' : ''}`}
                        style={{
                          height: hasSpend ? `${Math.max(8, Math.min(100, heightPercent))}%` : '4px',
                        }}
                      />
                    </div>

                    {/* Day Meta (Name + Day Number) */}
                    <div className="analytics-v2-day-meta">
                      <span className="analytics-v2-day-name">{day.dayName}</span>
                      <span className="analytics-v2-day-num">{day.dayNum}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalSpendingCard;

