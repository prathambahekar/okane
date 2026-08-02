import { useState, useMemo, useCallback } from 'react';
import { Calendar, BarChart2, LineChart, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { personalNetAmount } from '../db';
import { fmtMoney } from '../utils';
import type { Expense, ViewName } from '../types';

interface Props {
  expenses: Expense[];
  currency: string;
  onNavigate?: (v: ViewName) => void;
}

export default function MonthlySpendingTrend({ expenses, currency, onNavigate }: Props) {
  const [chartType, setChartType] = useState<'cumulative' | 'daily'>('cumulative');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const now = useMemo(() => new Date(), []);
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const thisMonthName = useMemo(() => new Date(thisYear, thisMonth - 1, 1).toLocaleDateString(undefined, { month: 'short' }), [thisYear, thisMonth]);
  const thisFullMonthName = useMemo(() => new Date(thisYear, thisMonth - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), [thisYear, thisMonth]);

  const prevDate = useMemo(() => new Date(thisYear, thisMonth - 2, 1), [thisYear, thisMonth]);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const prevMonthName = useMemo(() => prevDate.toLocaleDateString(undefined, { month: 'short' }), [prevDate]);
  const prevFullMonthName = useMemo(() => prevDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), [prevDate]);

  const thisDaysInMonth = useMemo(() => new Date(thisYear, thisMonth, 0).getDate(), [thisYear, thisMonth]);
  const prevDaysInMonth = useMemo(() => new Date(prevYear, prevMonth, 0).getDate(), [prevYear, prevMonth]);

  const maxDays = Math.max(thisDaysInMonth, prevDaysInMonth);

  // Calculate day-by-day spend using net personal spending (excluding transfers)
  const trendData = useMemo(() => {
    const getSpendForDay = (y: number, m: number, d: number) => {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rawNet = expenses
        .filter(e => e.date === dateStr)
        .reduce((sum, e) => sum + personalNetAmount(e), 0);
      return Math.max(0, rawNet);
    };

    const days = [];
    let thisCum = 0;
    let prevCum = 0;

    for (let d = 1; d <= maxDays; d++) {
      const thisDaily = d <= thisDaysInMonth ? getSpendForDay(thisYear, thisMonth, d) : 0;
      const prevDaily = d <= prevDaysInMonth ? getSpendForDay(prevYear, prevMonth, d) : 0;

      if (d <= currentDay && d <= thisDaysInMonth) {
        thisCum += thisDaily;
      }
      if (d <= prevDaysInMonth) {
        prevCum += prevDaily;
      }

      days.push({
        day: d,
        thisDaily,
        prevDaily,
        thisCum: d <= currentDay && d <= thisDaysInMonth ? thisCum : null,
        prevCum: d <= prevDaysInMonth ? prevCum : null,
        isToday: d === currentDay,
        isFuture: d > currentDay,
      });
    }

    return days;
  }, [expenses, thisYear, thisMonth, prevYear, prevMonth, thisDaysInMonth, prevDaysInMonth, maxDays, currentDay]);

  // Totals & Comparison metrics
  const thisTotalSoFar = useMemo(() => {
    const lastValid = trendData.filter(d => d.day <= currentDay && d.thisCum !== null).pop();
    return lastValid?.thisCum ?? 0;
  }, [trendData, currentDay]);

  const prevTotalSamePoint = useMemo(() => {
    const pDay = Math.min(currentDay, prevDaysInMonth);
    const item = trendData.find(d => d.day === pDay);
    return item?.prevCum ?? 0;
  }, [trendData, currentDay, prevDaysInMonth]);

  const diffAmount = thisTotalSoFar - prevTotalSamePoint;
  const pctChange = prevTotalSamePoint > 0 ? ((thisTotalSoFar - prevTotalSamePoint) / prevTotalSamePoint) * 100 : 0;
  const projectedMonthTotal = currentDay > 0 ? (thisTotalSoFar / currentDay) * thisDaysInMonth : 0;

  // SVG Chart Geometry
  const width = 600;
  const height = 210;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 32;
  const paddingBottom = 32;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxVal = useMemo(() => {
    if (chartType === 'cumulative') {
      const allVals = trendData
        .flatMap(d => [d.thisCum, d.prevCum])
        .filter((v): v is number => v !== null);
      return Math.max(...allVals, 100) * 1.12;
    } else {
      const allVals = trendData.flatMap(d => [d.thisDaily, d.prevDaily]);
      return Math.max(...allVals, 50) * 1.15;
    }
  }, [trendData, chartType]);

  const getX = useCallback((day: number) => {
    if (maxDays <= 1) return paddingLeft + chartW / 2;
    return paddingLeft + ((day - 1) / (maxDays - 1)) * chartW;
  }, [maxDays, paddingLeft, chartW]);

  const getY = useCallback((val: number | null) => {
    if (val === null) return paddingTop + chartH;
    const clamped = Math.max(0, val);
    const ratio = clamped / maxVal;
    return paddingTop + chartH - ratio * chartH;
  }, [paddingTop, chartH, maxVal]);

  // Generate SVG paths for cumulative mode
  const currentMonthPoints = useMemo(() => {
    return trendData
      .filter(d => d.day <= currentDay && d.thisCum !== null)
      .map(d => ({ x: getX(d.day), y: getY(d.thisCum), day: d.day, val: d.thisCum }));
  }, [trendData, currentDay, getX, getY]);

  const prevMonthPoints = useMemo(() => {
    return trendData
      .filter(d => d.day <= prevDaysInMonth && d.prevCum !== null)
      .map(d => ({ x: getX(d.day), y: getY(d.prevCum), day: d.day, val: d.prevCum }));
  }, [trendData, prevDaysInMonth, getX, getY]);

  const currentLinePath = useMemo(() => {
    if (currentMonthPoints.length === 0) return '';
    return currentMonthPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }, [currentMonthPoints]);

  const currentAreaPath = useMemo(() => {
    if (currentMonthPoints.length === 0) return '';
    const firstX = currentMonthPoints[0].x.toFixed(1);
    const lastX = currentMonthPoints[currentMonthPoints.length - 1].x.toFixed(1);
    const baseY = (paddingTop + chartH).toFixed(1);
    return `${currentLinePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [currentLinePath, currentMonthPoints, paddingTop, chartH]);

  const prevLinePath = useMemo(() => {
    if (prevMonthPoints.length === 0) return '';
    return prevMonthPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }, [prevMonthPoints]);

  // Active hover info
  const activeHoverData = useMemo(() => {
    if (hoveredDay === null) return null;
    return trendData.find(d => d.day === hoveredDay) || null;
  }, [hoveredDay, trendData]);

  // Grid tick lines
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Monthly Spending Trend</h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0 0' }}>
            Comparing <strong style={{ color: 'var(--accent)' }}>{thisFullMonthName}</strong> vs{' '}
            <strong style={{ color: '#a855f7' }}>{prevFullMonthName}</strong>
          </p>
        </div>

        {/* Control Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--surface2)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => setChartType('cumulative')}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 6,
                background: chartType === 'cumulative' ? 'var(--surface)' : 'transparent',
                color: chartType === 'cumulative' ? 'var(--accent)' : 'var(--text-3)',
                boxShadow: chartType === 'cumulative' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                border: 'none',
              }}
            >
              <LineChart size={13} style={{ marginRight: 4 }} /> Pace Curve
            </button>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => setChartType('daily')}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 6,
                background: chartType === 'daily' ? 'var(--surface)' : 'transparent',
                color: chartType === 'daily' ? 'var(--accent)' : 'var(--text-3)',
                boxShadow: chartType === 'daily' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                border: 'none',
              }}
            >
              <BarChart2 size={13} style={{ marginRight: 4 }} /> Daily
            </button>
          </div>

          {onNavigate && (
            <button className="btn-ghost btn-sm btn" onClick={() => onNavigate('analytics')} style={{ fontSize: 12, padding: '4px 8px' }}>
              Full Analytics →
            </button>
          )}
        </div>
      </div>

      {/* Metric Summary Ribbon - Responsive 2x2 grid on mobile, 4-across on desktop */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
        marginBottom: 16,
        padding: '10px 12px',
        background: 'var(--surface2)',
        borderRadius: 10,
        border: '1px solid var(--border)'
      }}>
        {/* Metric 1: Current Month Spend */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {thisMonthName} Spend (Day {currentDay})
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
            {fmtMoney(thisTotalSoFar, currency)}
          </div>
        </div>

        {/* Metric 2: Previous Month Spend (At Same Day) */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {prevMonthName} (Same Point)
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#a855f7', marginTop: 2 }}>
            {fmtMoney(prevTotalSamePoint, currency)}
          </div>
        </div>

        {/* Metric 3: Variance / Pace */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Pace vs Last Month
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: diffAmount > 0 ? '#ef4444' : '#10b981',
              display: 'inline-flex',
              alignItems: 'center'
            }}>
              {diffAmount > 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              {Math.abs(pctChange).toFixed(0)}% ({diffAmount >= 0 ? '+' : ''}{fmtMoney(diffAmount, currency)})
            </span>
          </div>
        </div>

        {/* Metric 4: Projected Month End */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Projected Month End
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
            ~{fmtMoney(projectedMonthTotal, currency)}
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart */}
      <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHoveredDay(null)}
        >
          <defs>
            {/* Current Month Gradient */}
            <linearGradient id="currentMonthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
            </linearGradient>

            {/* Previous Month Gradient */}
            <linearGradient id="prevMonthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Y-Axis Horizontal Grid Lines & Labels */}
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
                  y={y + 3.5}
                  fill="var(--text-3)"
                  fontSize="9.5"
                  textAnchor="end"
                  fontWeight="500"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Today Indicator Line */}
          {currentDay <= maxDays && (
            <g>
              <line
                x1={getX(currentDay)}
                y1={paddingTop - 2}
                x2={getX(currentDay)}
                y2={paddingTop + chartH}
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.85"
              />
              <rect
                x={getX(currentDay) - 24}
                y={paddingTop - 20}
                width="48"
                height="16"
                rx="4"
                fill="var(--accent)"
              />
              <text
                x={getX(currentDay)}
                y={paddingTop - 8}
                fill="#ffffff"
                fontSize="9"
                fontWeight="700"
                textAnchor="middle"
              >
                Today ({currentDay})
              </text>
            </g>
          )}

          {/* Render Cumulative Area/Line or Daily Bars */}
          {chartType === 'cumulative' ? (
            <>
              {/* Previous Month Area & Line */}
              {prevLinePath && (
                <path
                  d={prevLinePath}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.85"
                />
              )}

              {/* Current Month Area & Line */}
              {currentAreaPath && (
                <path d={currentAreaPath} fill="url(#currentMonthGrad)" />
              )}
              {currentLinePath && (
                <path
                  d={currentLinePath}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                />
              )}

              {/* Data points for Current Month */}
              {currentMonthPoints.map(p => (
                <circle
                  key={p.day}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredDay === p.day ? 5 : (p.day === currentDay ? 4 : 2)}
                  fill={p.day === currentDay ? 'var(--accent)' : 'var(--surface)'}
                  stroke="var(--accent)"
                  strokeWidth="2"
                  style={{ transition: 'all 0.15s ease' }}
                />
              ))}
            </>
          ) : (
            /* Daily Bar Chart Mode */
            <g>
              {trendData.map(d => {
                const xCenter = getX(d.day);
                const barWidth = Math.max(3, (chartW / maxDays) * 0.35);

                const prevY = getY(d.prevDaily);
                const prevH = Math.max(0, paddingTop + chartH - prevY);

                const thisY = getY(d.thisDaily);
                const thisH = d.day <= currentDay ? Math.max(0, paddingTop + chartH - thisY) : 0;

                return (
                  <g key={d.day}>
                    {/* Previous Month Bar (left) */}
                    <rect
                      x={xCenter - barWidth - 1}
                      y={prevY}
                      width={barWidth}
                      height={prevH}
                      fill="#a855f7"
                      opacity="0.6"
                      rx="1"
                    />
                    {/* Current Month Bar (right) */}
                    <rect
                      x={xCenter + 1}
                      y={thisY}
                      width={barWidth}
                      height={thisH}
                      fill="var(--accent)"
                      opacity={d.isToday ? 1 : 0.85}
                      rx="1"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Interactive Hover Vertical Column Overlay */}
          {trendData.map(d => {
            const x = getX(d.day);
            const colW = chartW / maxDays;
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

          {/* Active Hover Highlight Line */}
          {hoveredDay !== null && (
            <line
              x1={getX(hoveredDay)}
              y1={paddingTop}
              x2={getX(hoveredDay)}
              y2={paddingTop + chartH}
              stroke="var(--text-3)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {/* X-Axis Day Labels (every 5 days) */}
          {trendData.map(d => {
            if (d.day % 5 !== 0 && d.day !== 1 && d.day !== maxDays && d.day !== currentDay) return null;
            return (
              <text
                key={d.day}
                x={getX(d.day)}
                y={paddingTop + chartH + 18}
                fill={d.day === currentDay ? 'var(--accent)' : 'var(--text-3)'}
                fontSize="10"
                fontWeight={d.day === currentDay ? '700' : '500'}
                textAnchor="middle"
              >
                {d.day}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Box */}
        {activeHoverData && (
          <div style={{
            position: 'absolute',
            top: 10,
            right: 15,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 11.5,
            pointerEvents: 'none',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
              Day {activeHoverData.day} {activeHoverData.isToday ? '(Today)' : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>● {thisMonthName}:</span>
              <span style={{ fontWeight: 700 }}>
                {activeHoverData.thisCum !== null
                  ? `${fmtMoney(activeHoverData.thisDaily, currency)} (Cum: ${fmtMoney(activeHoverData.thisCum, currency)})`
                  : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ color: '#a855f7', fontWeight: 600 }}>● {prevMonthName}:</span>
              <span style={{ fontWeight: 700 }}>
                {activeHoverData.prevCum !== null
                  ? `${fmtMoney(activeHoverData.prevDaily, currency)} (Cum: ${fmtMoney(activeHoverData.prevCum, currency)})`
                  : 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{thisFullMonthName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 2, borderRadius: 2, background: '#a855f7', borderStyle: 'dashed' }} />
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{prevFullMonthName}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Info size={13} style={{ color: 'var(--accent)' }} />
          <span>
            {pctChange < 0
              ? `Spending ${Math.abs(pctChange).toFixed(0)}% slower than last month (${fmtMoney(Math.abs(diffAmount), currency)} saved)`
              : `Spending ${pctChange.toFixed(0)}% faster than last month (+${fmtMoney(diffAmount, currency)})`}
          </span>
        </div>
      </div>
    </div>
  );
}
