import React, { useState, useMemo, useRef } from 'react';
import { Filter, ArrowDownRight, ArrowUpRight, Minus, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  periodKey?: string;
  slideDirection?: 'prev' | 'next' | null;
  onPrevDate?: () => void;
  onNextDate?: () => void;
  isCurrentPeriod?: boolean;
  periodBadge?: { label: string; isCurrent: boolean; isPrev: boolean } | null;
  totalSpent: number;
  prevPeriodSpent: number;
  dailyAvg: number;
  daysPassedCount?: number;
  totalDaysInPeriod?: number;
  highestDayAmount: number;
  noSpendDaysCount: number;
  chartDays: ChartDayData[];
  currency: string;
  onOpenFilter?: () => void;
  activeFilterCount?: number;
  onSelectDay?: (dateStr: string) => void;
  selectedDateStr?: string | null;
  selectedCategory?: string | null;
}

export const TotalSpendingCard: React.FC<TotalSpendingCardProps> = ({
  period,
  periodKey,
  slideDirection,
  onPrevDate,
  onNextDate,
  isCurrentPeriod = false,
  periodBadge,
  totalSpent,
  prevPeriodSpent,
  dailyAvg,
  daysPassedCount,
  totalDaysInPeriod,
  highestDayAmount,
  noSpendDaysCount,
  chartDays,
  currency,
  onOpenFilter,
  activeFilterCount = 0,
  onSelectDay,
  selectedDateStr,
  selectedCategory,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Swipe / Drag interactive state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Touch gesture refs
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isHorizontalGestureRef = useRef<boolean | null>(null);
  const hasNavigatedTouchRef = useRef<boolean>(false);

  // Mouse drag refs
  const mouseStartRef = useRef<{ x: number; time: number } | null>(null);
  const isMouseDraggingRef = useRef(false);

  // Wheel / Trackpad inertia cooldown refs
  const isWheelingRef = useRef(false);
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute comparison trend and velocity pace
  const comparison = useMemo(() => {
    const periodLabel = period === 'week' ? 'last week' : 'last month';

    if (prevPeriodSpent <= 0) {
      if (totalSpent > 0) return { type: 'neutral', pct: 0, label: `No spend ${periodLabel}`, trajectory: 'baseline' };
      return { type: 'neutral', pct: 0, label: `0% vs ${periodLabel}`, trajectory: 'even' };
    }

    const diff = totalSpent - prevPeriodSpent;
    const pct = Math.abs(Math.round((diff / prevPeriodSpent) * 100));

    // Calculate pace trajectory if in active period
    let trajectory = 'even';
    if (isCurrentPeriod && daysPassedCount && totalDaysInPeriod && daysPassedCount < totalDaysInPeriod) {
      const elapsedFraction = daysPassedCount / totalDaysInPeriod;
      const expectedSpentAtThisPace = prevPeriodSpent * elapsedFraction;
      if (totalSpent > expectedSpentAtThisPace * 1.05) {
        trajectory = 'faster';
      } else if (totalSpent < expectedSpentAtThisPace * 0.95) {
        trajectory = 'slower';
      }
    }

    if (diff < 0) {
      return {
        type: 'down',
        pct,
        label: `-${pct}% vs ${periodLabel}`,
        trajectory,
      };
    } else if (diff > 0) {
      return {
        type: 'up',
        pct,
        label: `+${pct}% vs ${periodLabel}`,
        trajectory,
      };
    }
    return {
      type: 'neutral',
      pct: 0,
      label: `0% vs ${periodLabel}`,
      trajectory,
    };
  }, [totalSpent, prevPeriodSpent, period, isCurrentPeriod, daysPassedCount, totalDaysInPeriod]);

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
  const isMonthView = period === 'month' || chartDays.length > 7;

  // Touch Event Handlers (Phone & Tablet)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    isHorizontalGestureRef.current = null;
    hasNavigatedTouchRef.current = false;
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    if (isHorizontalGestureRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          isHorizontalGestureRef.current = true;
          setIsDragging(true);
          setHoveredDate(null);
        } else {
          isHorizontalGestureRef.current = false;
        }
      }
    }

    if (isHorizontalGestureRef.current) {
      let offset = deltaX;
      // Rubber-band resistance if dragging towards next period while already on current period
      if (offset < 0 && isCurrentPeriod) {
        offset = deltaX * 0.18;
      }
      setDragOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    if (isHorizontalGestureRef.current && touchStartRef.current && !hasNavigatedTouchRef.current) {
      const elapsed = Date.now() - touchStartRef.current.time;
      const absOffset = Math.abs(dragOffset);
      const velocity = absOffset / Math.max(1, elapsed);

      const shouldNavigate = absOffset > 38 || (absOffset > 20 && velocity > 0.28);

      if (shouldNavigate) {
        hasNavigatedTouchRef.current = true;
        if (dragOffset > 0) {
          onPrevDate?.();
        } else if (dragOffset < 0 && !isCurrentPeriod) {
          onNextDate?.();
        }
      }
    }

    touchStartRef.current = null;
    isHorizontalGestureRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  // Mouse Drag Handlers (Desktop click & drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    mouseStartRef.current = { x: e.clientX, time: Date.now() };
    isMouseDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseStartRef.current) return;
    const deltaX = e.clientX - mouseStartRef.current.x;

    if (!isMouseDraggingRef.current && Math.abs(deltaX) > 8) {
      isMouseDraggingRef.current = true;
      setIsDragging(true);
      setHoveredDate(null);
    }

    if (isMouseDraggingRef.current) {
      let offset = deltaX;
      if (offset < 0 && isCurrentPeriod) {
        offset = deltaX * 0.18;
      }
      setDragOffset(offset);
    }
  };

  const handleMouseUp = () => {
    if (isMouseDraggingRef.current && mouseStartRef.current) {
      const elapsed = Date.now() - mouseStartRef.current.time;
      const absOffset = Math.abs(dragOffset);
      const velocity = absOffset / Math.max(1, elapsed);

      const shouldNavigate = absOffset > 38 || (absOffset > 20 && velocity > 0.28);

      if (shouldNavigate) {
        if (dragOffset > 0) {
          onPrevDate?.();
        } else if (dragOffset < 0 && !isCurrentPeriod) {
          onNextDate?.();
        }
      }
    }

    mouseStartRef.current = null;
    isMouseDraggingRef.current = false;
    setIsDragging(false);
    setDragOffset(0);
  };

  // Wheel / Trackpad horizontal scroll handler (changes strictly ONE period at a time)
  const handleWheel = (e: React.WheelEvent) => {
    const deltaX = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    const absX = Math.abs(deltaX);

    // Ignore tiny trackpad noise
    if (absX < 16) return;

    // Trigger ONCE per gesture
    if (!isWheelingRef.current) {
      if (absX > 22) {
        isWheelingRef.current = true;
        if (deltaX > 0) {
          if (!isCurrentPeriod) {
            onNextDate?.();
          }
        } else {
          onPrevDate?.();
        }
      }
    }

    // Keep resetting debounce timer until trackpad momentum has completely ceased
    if (wheelResetTimerRef.current) {
      clearTimeout(wheelResetTimerRef.current);
    }
    wheelResetTimerRef.current = setTimeout(() => {
      isWheelingRef.current = false;
    }, 280);
  };

  return (
    <div className="analytics-v2-card">
      {/* 1. Header: Icon Pill, Title, Period Badge & Filters Button */}
      <div className="analytics-v2-card-header">
        <div className="analytics-v2-header-left">
          <span className="analytics-v2-header-icon-pill">
            <TrendingUp size={15} strokeWidth={2.2} />
          </span>
          <h2 className="analytics-v2-card-title">
            {selectedCategory ? `${selectedCategory} Spending` : 'Total Spending'}
          </h2>
          {selectedCategory && (
            <span
              className="analytics-v2-pill-badge"
              style={{ fontWeight: 650 }}
            >
              {selectedCategory}
            </span>
          )}
          {periodBadge && (
            <span className={`analytics-v2-period-badge ${periodBadge.isCurrent ? 'is-current' : periodBadge.isPrev ? 'is-prev' : 'is-past'}`}>
              {periodBadge.label}
            </span>
          )}
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

      {/* 2. Hero Total Amount */}
      <div className="analytics-v2-hero-amount">
        {fmtMoney(totalSpent, currency)}
      </div>

      {/* 3. Comparison Trend Badge & Pace / Velocity Trajectory */}
      <div className="analytics-v2-trend-row">
        <div className={`analytics-v2-trend-badge ${comparison.type}`}>
          {comparison.type === 'down' && <ArrowDownRight size={14} strokeWidth={2.5} />}
          {comparison.type === 'up' && <ArrowUpRight size={14} strokeWidth={2.5} />}
          {comparison.type === 'neutral' && <Minus size={14} strokeWidth={2.5} />}
          <span>{comparison.label}</span>
        </div>

        {isCurrentPeriod && comparison.trajectory === 'faster' && (
          <div className="analytics-v2-pace-pill faster" title="Spending pace is trending faster than previous period">
            <TrendingUp size={13} strokeWidth={2.2} />
            <span>Pacing faster</span>
          </div>
        )}
        {isCurrentPeriod && comparison.trajectory === 'slower' && (
          <div className="analytics-v2-pace-pill slower" title="Spending pace is trending slower than previous period">
            <TrendingDown size={13} strokeWidth={2.2} />
            <span>Pacing slower</span>
          </div>
        )}
      </div>

      {/* 4. 3-Metric Summary Columns */}
      <div className="analytics-v2-metrics-strip">
        <div className="analytics-v2-metric-col" title={`Active burn rate: ${fmtMoney(dailyAvg, currency)}/day across ${daysPassedCount || 1} days elapsed`}>
          <span className="analytics-v2-metric-val">
            {fmtMoney(dailyAvg, currency)}
          </span>
          <span className="analytics-v2-metric-lbl">
            {period === 'month' && isCurrentPeriod ? `Daily burn (${daysPassedCount || 1}d)` : 'Daily burn rate'}
          </span>
        </div>

        <div className="analytics-v2-metric-col">
          <span className="analytics-v2-metric-val">
            {fmtMoney(highestDayAmount, currency)}
          </span>
          <span className="analytics-v2-metric-lbl">Highest day</span>
        </div>

        <div className="analytics-v2-metric-col">
          <span className="analytics-v2-metric-val">
            {noSpendDaysCount}
          </span>
          <span className="analytics-v2-metric-lbl">No-spend days</span>
        </div>
      </div>

      {/* 5. Interactive Visual Bar Chart with Y-Axis & Horizontally Swipable Days */}
      <div
        className="analytics-v2-chart-stage"
        onMouseLeave={() => {
          setHoveredDate(null);
          if (isMouseDraggingRef.current) handleMouseUp();
        }}
      >
        {/* Fixed Y-Axis Column on Left */}
        <div className="analytics-v2-y-axis-col">
          {yAxisMarkers.map((marker, idx) => (
            <span key={idx} className="analytics-v2-grid-label">
              {fmtMoneyCompact(marker, currency)}
            </span>
          ))}
          <div className="analytics-v2-y-axis-spacer" />
        </div>

        {/* Swipable Chart Stage: Swiping horizontally steps week by week or month by month */}
        <div
          className={`analytics-v2-chart-scroll-wrap ${isMonthView ? 'month-mode' : 'week-mode'} ${isDragging ? 'is-dragging' : ''}`}
          ref={scrollContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Direct touch/drag interactive wrapper */}
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: `translateX(${dragOffset}px)`,
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
            }}
          >
            <AnimatePresence mode="popLayout" initial={false} custom={slideDirection}>
              <motion.div
                key={periodKey || period}
                custom={slideDirection}
                variants={{
                  enter: (dir: 'prev' | 'next' | null) => ({
                    x: dir === 'prev' ? -40 : dir === 'next' ? 40 : 0,
                    opacity: 0,
                  }),
                  center: {
                    x: 0,
                    opacity: 1,
                    transition: {
                      x: { type: 'spring', stiffness: 380, damping: 30 },
                      opacity: { duration: 0.16 },
                    },
                  },
                  exit: (dir: 'prev' | 'next' | null) => ({
                    x: dir === 'prev' ? 40 : dir === 'next' ? -40 : 0,
                    opacity: 0,
                    transition: {
                      x: { type: 'spring', stiffness: 380, damping: 30 },
                      opacity: { duration: 0.12 },
                    },
                  }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                className="analytics-v2-chart-canvas"
              >
                {/* Background Horizontal Grid Lines Layer */}
                <div className="analytics-v2-grid-lines-layer">
                  {yAxisMarkers.map((_, idx) => (
                    <div key={idx} className="analytics-v2-canvas-grid-line" />
                  ))}
                </div>

                {/* Bars Row */}
                <div
                  className={`analytics-v2-bars-row ${isMonthView ? 'month-mode' : ''}`}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  {chartDays.map((day, idx) => {
                    const heightPercent = maxDaySpend > 0 ? (day.spend / maxDaySpend) * 100 : 0;
                    const isHovered = hoveredDate === day.dateStr;
                    const isSelected = selectedDateStr === day.dateStr;
                    const hasSpend = day.spend > 0;

                    // Edge-aware tooltip alignment to avoid clipping
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

                    // For month view, selectively display day numbers on milestones so bars remain clean
                    const showDayNumber = !isMonthView || day.dayNum === 1 || day.dayNum % 5 === 0 || day.dayNum === chartDays.length || day.isToday || isSelected;

                    return (
                      <div
                        key={day.dateStr}
                        className={`analytics-v2-bar-col ${isSelected ? 'selected active' : ''} ${isHovered ? 'hovered' : ''} ${isMonthView ? 'month-col' : ''}`}
                        onMouseEnter={() => {
                          if (!isDragging) setHoveredDate(day.dateStr);
                        }}
                        onMouseLeave={() => setHoveredDate(null)}
                        onClick={() => {
                          if (isDragging || Math.abs(dragOffset) > 6) return;
                          onSelectDay?.(day.dateStr);
                          setHoveredDate(prev => prev === day.dateStr ? null : day.dateStr);
                        }}
                      >
                        {/* Floating Tooltip Bubble */}
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

                        {/* Day Meta (Name + Day Number, or clean ticks for month) */}
                        {isMonthView ? (
                          <div className="analytics-v2-day-meta month-meta">
                            {showDayNumber ? (
                              <span className={`analytics-v2-day-num ${day.isToday ? 'is-today-num' : ''}`}>
                                {day.dayNum}
                              </span>
                            ) : (
                              <span className="analytics-v2-day-tick" />
                            )}
                          </div>
                        ) : (
                          <div className="analytics-v2-day-meta">
                            <span className="analytics-v2-day-name">{day.dayName}</span>
                            <span className="analytics-v2-day-num">{day.dayNum}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalSpendingCard;
