import React, { useRef, useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  PieChart,
  CalendarCheck,
  Flame,
  Users,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { fmtMoney } from '../../utils';
import type { CategoryBreakdownItem } from './CategoryDistributionCard';
import type { ChartDayData } from './TotalSpendingCard';

export interface InsightItem {
  id: string;
  type: 'positive' | 'warning' | 'info' | 'neutral';
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

interface AnalyticsInsightsCardProps {
  period: 'week' | 'month';
  totalSpent: number;
  prevTotalSpent: number;
  dailyAvg?: number;
  noSpendDaysCount: number;
  categoryBreakdown: CategoryBreakdownItem[];
  chartDays: ChartDayData[];
  currency: string;
  friendsWithBalance?: { name: string; net: number }[];
  onSelectCategory?: (category: string | null) => void;
  onSelectDate?: (dateStr: string) => void;
}

export const AnalyticsInsightsCard: React.FC<AnalyticsInsightsCardProps> = ({
  period,
  totalSpent,
  prevTotalSpent,
  noSpendDaysCount,
  categoryBreakdown,
  chartDays,
  currency,
  friendsWithBalance = [],
  onSelectCategory,
  onSelectDate,
}) => {
  const periodLabel = period === 'week' ? 'week' : 'month';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Generate dynamic insights based on actual metrics (Important & Actionable only)
  const insights: InsightItem[] = [];

  // 1. Outstanding Friend Debts / Splits (High Priority Actionable)
  if (friendsWithBalance.length > 0) {
    const topOwed = friendsWithBalance.filter((f) => f.net > 0).sort((a, b) => b.net - a.net)[0];
    const topDebt = friendsWithBalance.filter((f) => f.net < 0).sort((a, b) => a.net - b.net)[0];

    if (topOwed && topOwed.net > 0) {
      insights.push({
        id: 'friend-owed',
        type: 'info',
        icon: <Users size={15} strokeWidth={2.4} />,
        tag: 'Split Due',
        title: `${topOwed.name} owes you`,
        description: (
          <span>
            <strong>{fmtMoney(topOwed.net, currency)}</strong> pending to collect.
          </span>
        ),
      });
    } else if (topDebt && topDebt.net < 0) {
      insights.push({
        id: 'friend-debt',
        type: 'warning',
        icon: <Users size={15} strokeWidth={2.4} />,
        tag: 'Split Debt',
        title: `You owe ${topDebt.name}`,
        description: (
          <span>
            <strong>{fmtMoney(Math.abs(topDebt.net), currency)}</strong> pending to settle.
          </span>
        ),
      });
    }
  }

  // 2. Significant Pace Alert or Saving Trend (>= 8% difference only)
  if (prevTotalSpent > 0 && totalSpent > 0) {
    const diff = totalSpent - prevTotalSpent;
    const pct = Math.abs(Math.round((diff / prevTotalSpent) * 100));

    if (diff < 0 && pct >= 8) {
      insights.push({
        id: 'trend-down',
        type: 'positive',
        icon: <TrendingDown size={15} strokeWidth={2.4} />,
        tag: 'Saving Trend',
        title: `${pct}% Lower Spending`,
        description: (
          <span>
            Saved <strong>{fmtMoney(Math.abs(diff), currency)}</strong> vs last {periodLabel}.
          </span>
        ),
      });
    } else if (diff > 0 && pct >= 8) {
      insights.push({
        id: 'trend-up',
        type: 'warning',
        icon: <TrendingUp size={15} strokeWidth={2.4} />,
        tag: 'Pace Alert',
        title: `${pct}% Higher Outflow`,
        description: (
          <span>
            Outflow up by <strong>{fmtMoney(diff, currency)}</strong> vs last {periodLabel}.
          </span>
        ),
      });
    }
  }

  // 3. Top Category Dominance
  if (categoryBreakdown.length > 0 && totalSpent > 0) {
    const topCat = categoryBreakdown[0];
    const isDominant = topCat.pct >= 35;

    insights.push({
      id: 'top-cat',
      type: isDominant ? 'warning' : 'info',
      icon: <PieChart size={15} strokeWidth={2.4} />,
      tag: 'Top Category',
      title: `${topCat.cat} (${topCat.pct}%)`,
      description: (
        <span>
          <strong>{fmtMoney(topCat.amount, currency)}</strong> across {topCat.count}{' '}
          {topCat.count === 1 ? 'entry' : 'entries'}.
        </span>
      ),
      actionLabel: onSelectCategory ? 'Filter Category' : undefined,
      onAction: onSelectCategory ? () => onSelectCategory(topCat.cat) : undefined,
    });
  }

  // 4. Zero-Spend Days & Discipline
  if (noSpendDaysCount > 0 && chartDays.length > 0) {
    insights.push({
      id: 'no-spend',
      type: 'positive',
      icon: <CalendarCheck size={15} strokeWidth={2.4} />,
      tag: 'Saving Habit',
      title: `${noSpendDaysCount} No-Spend ${noSpendDaysCount === 1 ? 'Day' : 'Days'}`,
      description: (
        <span>
          {noSpendDaysCount === 1 ? '1 day' : `${noSpendDaysCount} days`} with ₹0 spend this {periodLabel}.
        </span>
      ),
    });
  }

  // 5. Peak Spend Day
  const spendDays = chartDays.filter((d) => d.spend > 0);
  if (spendDays.length > 1) {
    const highestDay = [...spendDays].sort((a, b) => b.spend - a.spend)[0];
    if (highestDay && highestDay.spend > 0) {
      insights.push({
        id: 'peak-day',
        type: 'neutral',
        icon: <Flame size={15} strokeWidth={2.4} />,
        tag: 'Peak Spend',
        title: `${highestDay.dayName} was peak day`,
        description: (
          <span>
            <strong>{fmtMoney(highestDay.spend, currency)}</strong> spent on {highestDay.dayName}.
          </span>
        ),
        actionLabel: onSelectDate ? 'View Day' : undefined,
        onAction: onSelectDate ? () => onSelectDate(highestDay.dateStr) : undefined,
      });
    }
  }

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [insights.length]);

  const scrollBy = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 10 : 180;
    el.scrollBy({
      left: dir === 'left' ? -itemWidth : itemWidth,
      behavior: 'smooth',
    });
  };

  return (
    <div className="analytics-v2-card analytics-v2-insights-card">
      {/* Header */}
      <div className="analytics-v2-card-header" style={{ marginBottom: 10 }}>
        <div className="analytics-v2-header-left">
          <div className="analytics-v2-insights-header-icon">
            <Sparkles size={14} strokeWidth={2.3} />
          </div>
          <h2 className="analytics-v2-card-title">Smart Insights</h2>
          {insights.length > 0 && (
            <span className="analytics-v2-insights-count-pill">
              {insights.length}
            </span>
          )}
        </div>

        {insights.length > 2 && (
          <div className="analytics-v2-insights-nav-arrows">
            <button
              type="button"
              onClick={() => scrollBy('left')}
              disabled={!canScrollLeft}
              className="analytics-v2-insights-arrow-btn"
              aria-label="Previous insights"
              title="Previous insights"
            >
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => scrollBy('right')}
              disabled={!canScrollRight}
              className="analytics-v2-insights-arrow-btn"
              aria-label="Next insights"
              title="Next insights"
            >
              <ChevronRight size={15} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>

      {/* Insights Horizontal Scroll Track */}
      {insights.length === 0 ? (
        <div className="analytics-v2-empty-box" style={{ padding: '20px 12px' }}>
          <div className="analytics-v2-empty-icon" style={{ width: 36, height: 36, marginBottom: 8 }}>
            <Sparkles size={18} strokeWidth={1.8} />
          </div>
          <div className="analytics-v2-empty-title" style={{ fontSize: 'var(--fs-sm)' }}>No insights yet</div>
          <div className="analytics-v2-empty-desc" style={{ fontSize: 'var(--fs-caption)' }}>
            Add transactions to generate smart observations for this {periodLabel}.
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="analytics-v2-insights-horizontal-track"
        >
          {insights.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className={`analytics-v2-insight-card-compact tone-${item.type}`}
            >
              {/* Header inside mini card */}
              <div className="analytics-v2-insight-card-top">
                <span className={`analytics-v2-insight-tag tone-${item.type}`}>
                  {item.tag}
                </span>
                <div className={`analytics-v2-insight-icon-compact tone-${item.type}`}>
                  {item.icon}
                </div>
              </div>

              {/* Title and Short Description */}
              <div className="analytics-v2-insight-card-body">
                <div className="analytics-v2-insight-title-compact">{item.title}</div>
                <div className="analytics-v2-insight-desc-compact">{item.description}</div>
              </div>

              {/* Action link if available */}
              {item.actionLabel && item.onAction && (
                <button
                  type="button"
                  onClick={item.onAction}
                  className="analytics-v2-insight-action-compact"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight size={11} strokeWidth={2.2} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnalyticsInsightsCard;
