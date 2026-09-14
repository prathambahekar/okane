import React from 'react';
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  PieChart,
  CalendarCheck,
  Flame,
  Users,
  Minus,
  ArrowRight,
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
  dailyAvg: number;
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
  dailyAvg,
  noSpendDaysCount,
  categoryBreakdown,
  chartDays,
  currency,
  friendsWithBalance = [],
  onSelectCategory,
  onSelectDate,
}) => {
  const periodLabel = period === 'week' ? 'week' : 'month';

  // Generate dynamic insights based on actual metrics
  const insights: InsightItem[] = [];

  // 1. Comparison & Spending Velocity
  if (prevTotalSpent > 0 && totalSpent > 0) {
    const diff = totalSpent - prevTotalSpent;
    const pct = Math.abs(Math.round((diff / prevTotalSpent) * 100));

    if (diff < 0 && pct >= 3) {
      insights.push({
        id: 'trend-down',
        type: 'positive',
        icon: <TrendingDown size={17} strokeWidth={2.4} />,
        tag: 'Spending Trend',
        title: `${pct}% lower than previous ${periodLabel}`,
        description: (
          <span>
            You spent <strong>{fmtMoney(totalSpent, currency)}</strong> compared to{' '}
            <strong>{fmtMoney(prevTotalSpent, currency)}</strong> last {periodLabel}, saving{' '}
            <strong>{fmtMoney(Math.abs(diff), currency)}</strong>.
          </span>
        ),
      });
    } else if (diff > 0 && pct >= 3) {
      insights.push({
        id: 'trend-up',
        type: 'warning',
        icon: <TrendingUp size={17} strokeWidth={2.4} />,
        tag: 'Spending Alert',
        title: `${pct}% increase over last ${periodLabel}`,
        description: (
          <span>
            Outflow rose by <strong>{fmtMoney(diff, currency)}</strong> compared to last{' '}
            {periodLabel} ({fmtMoney(prevTotalSpent, currency)}).
          </span>
        ),
      });
    } else {
      insights.push({
        id: 'trend-neutral',
        type: 'neutral',
        icon: <Minus size={17} strokeWidth={2.4} />,
        tag: 'Pace',
        title: `Consistent with last ${periodLabel}`,
        description: (
          <span>
            Spending remained steady within ~{pct}% of the previous {periodLabel}'s total (
            {fmtMoney(prevTotalSpent, currency)}).
          </span>
        ),
      });
    }
  }

  // 2. Top Category Dominance
  if (categoryBreakdown.length > 0 && totalSpent > 0) {
    const topCat = categoryBreakdown[0];
    const isDominant = topCat.pct >= 40;

    insights.push({
      id: 'top-cat',
      type: isDominant ? 'warning' : 'info',
      icon: <PieChart size={17} strokeWidth={2.4} />,
      tag: 'Top Category',
      title: `${topCat.cat} leads with ${topCat.pct}% of outflow`,
      description: (
        <span>
          <strong>{fmtMoney(topCat.amount, currency)}</strong> spent across {topCat.count}{' '}
          {topCat.count === 1 ? 'expense' : 'expenses'} in <strong>{topCat.cat}</strong>.
        </span>
      ),
      actionLabel: onSelectCategory ? 'View Category' : undefined,
      onAction: onSelectCategory ? () => onSelectCategory(topCat.cat) : undefined,
    });
  }

  // 3. Peak Spend Day
  const spendDays = chartDays.filter((d) => d.spend > 0);
  if (spendDays.length > 0) {
    const highestDay = [...spendDays].sort((a, b) => b.spend - a.spend)[0];
    if (highestDay && highestDay.spend > 0) {
      const shareOfTotal = totalSpent > 0 ? Math.round((highestDay.spend / totalSpent) * 100) : 0;
      insights.push({
        id: 'peak-day',
        type: 'neutral',
        icon: <Flame size={17} strokeWidth={2.4} />,
        tag: 'Peak Day',
        title: `${highestDay.dayName} was your heaviest spending day`,
        description: (
          <span>
            Spent <strong>{fmtMoney(highestDay.spend, currency)}</strong> on{' '}
            <strong>{highestDay.fullDateLabel}</strong> ({shareOfTotal}% of {periodLabel}'s total).
          </span>
        ),
        actionLabel: onSelectDate ? 'View Day' : undefined,
        onAction: onSelectDate ? () => onSelectDate(highestDay.dateStr) : undefined,
      });
    }
  }

  // 4. Zero-Spend Days & Discipline
  if (noSpendDaysCount > 0 && chartDays.length > 0) {
    insights.push({
      id: 'no-spend',
      type: 'positive',
      icon: <CalendarCheck size={17} strokeWidth={2.4} />,
      tag: 'Saving Habit',
      title: `${noSpendDaysCount} zero-spend ${noSpendDaysCount === 1 ? 'day' : 'days'} recorded`,
      description: (
        <span>
          Great financial discipline! You had <strong>{noSpendDaysCount} {noSpendDaysCount === 1 ? 'day' : 'days'}</strong> with zero out-of-pocket expenses this {periodLabel}.
        </span>
      ),
    });
  }

  // 5. Daily Average Burn Rate (if more than 1 day with expenses)
  if (dailyAvg > 0 && totalSpent > 0) {
    insights.push({
      id: 'daily-avg',
      type: 'info',
      icon: <Sparkles size={17} strokeWidth={2.4} />,
      tag: 'Burn Rate',
      title: `Average daily outflow: ${fmtMoney(dailyAvg, currency)}`,
      description: (
        <span>
          Based on {chartDays.length} days in this {periodLabel}, your baseline average spending is{' '}
          <strong>{fmtMoney(dailyAvg, currency)}/day</strong>.
        </span>
      ),
    });
  }

  // 6. Outstanding Friend Debts / Splits
  if (friendsWithBalance.length > 0) {
    const topOwed = friendsWithBalance.filter((f) => f.net > 0).sort((a, b) => b.net - a.net)[0];
    const topDebt = friendsWithBalance.filter((f) => f.net < 0).sort((a, b) => a.net - b.net)[0];

    if (topOwed && topOwed.net > 0) {
      insights.push({
        id: 'friend-owed',
        type: 'info',
        icon: <Users size={17} strokeWidth={2.4} />,
        tag: 'Shared Balance',
        title: `${topOwed.name} owes you ${fmtMoney(topOwed.net, currency)}`,
        description: (
          <span>
            You have outstanding unsettled shared expenses with <strong>{topOwed.name}</strong>.
          </span>
        ),
      });
    } else if (topDebt && topDebt.net < 0) {
      insights.push({
        id: 'friend-debt',
        type: 'warning',
        icon: <Users size={17} strokeWidth={2.4} />,
        tag: 'Shared Balance',
        title: `You owe ${topDebt.name} ${fmtMoney(Math.abs(topDebt.net), currency)}`,
        description: (
          <span>
            Remember to settle up your pending balance with <strong>{topDebt.name}</strong>.
          </span>
        ),
      });
    }
  }

  return (
    <div className="analytics-v2-card analytics-v2-insights-card">
      {/* Header */}
      <div className="analytics-v2-card-header">
        <div className="analytics-v2-header-left">
          <div className="analytics-v2-insights-header-icon">
            <Sparkles size={15} strokeWidth={2.2} />
          </div>
          <h2 className="analytics-v2-card-title">Smart Insights</h2>
        </div>

        <div className="analytics-v2-header-right">
          {insights.length > 0 && (
            <span className="analytics-v2-pill-badge">
              {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
            </span>
          )}
        </div>
      </div>

      {/* Insights List */}
      {insights.length === 0 ? (
        <div className="analytics-v2-empty-box">
          <div className="analytics-v2-empty-icon">
            <Sparkles size={24} strokeWidth={1.75} />
          </div>
          <div className="analytics-v2-empty-title">No insights yet</div>
          <div className="analytics-v2-empty-desc">
            Add transactions to generate smart spending observations and habits for this {periodLabel}.
          </div>
        </div>
      ) : (
        <div className="analytics-v2-insights-list">
          {insights.map((item) => (
            <div
              key={item.id}
              className={`analytics-v2-insight-item tone-${item.type}`}
            >
              <div className={`analytics-v2-insight-icon-wrap tone-${item.type}`}>
                {item.icon}
              </div>

              <div className="analytics-v2-insight-content">
                <div className="analytics-v2-insight-top">
                  <span className={`analytics-v2-insight-tag tone-${item.type}`}>
                    {item.tag}
                  </span>
                  <span className="analytics-v2-insight-title">{item.title}</span>
                </div>

                <div className="analytics-v2-insight-desc">{item.description}</div>

                {item.actionLabel && item.onAction && (
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="analytics-v2-insight-action-btn"
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight size={12} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnalyticsInsightsCard;
