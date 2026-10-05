import React, { useMemo } from 'react';
import {
  Target,
  ChevronRight,
  TrendingUp,
  Plus,
  Sliders,
} from 'lucide-react';
import { fmtMoney } from '../../utils';
import type { AppDB } from '../../types';
import CategoryIcon from '../CategoryIcon';
import { getAllCategoryBudgetStatuses, type CategoryBudgetStatus } from '../../utils/budget';

interface CategoryBudgetsCardProps {
  db: AppDB;
  activeMonthStr?: string; // YYYY-MM
  onOpenBudgetDrawer: (categoryName?: string) => void;
  onOpenCategoryDrawer?: (categoryName: string) => void;
  className?: string;
}

export const CategoryBudgetsCard: React.FC<CategoryBudgetsCardProps> = ({
  db,
  activeMonthStr,
  onOpenBudgetDrawer,
  onOpenCategoryDrawer,
  className = '',
}) => {
  const currency = db.settings?.currency || 'INR';

  const { budgetStatuses, summary, unbudgetedCategories } = useMemo(() => {
    return getAllCategoryBudgetStatuses(db, activeMonthStr);
  }, [db, activeMonthStr]);

  const hasBudgets = budgetStatuses.length > 0;

  return (
    <div className={`analytics-v2-card ${className}`} style={{ width: '100%' }}>
      {/* Card Header */}
      <div className="analytics-v2-card-header">
        <div className="analytics-v2-header-left">
          <span
            className="analytics-v2-header-icon-pill"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            <Target size={15} strokeWidth={2.4} />
          </span>
          <h2 className="analytics-v2-card-title">Category Budgets</h2>

          {hasBudgets && (
            <span
              className="analytics-v2-pill-badge"
              style={{
                background:
                  summary.status === 'exceeded'
                    ? 'var(--debit-bg)'
                    : summary.status === 'danger'
                    ? 'var(--amber-bg)'
                    : 'var(--credit-bg)',
                color:
                  summary.status === 'exceeded'
                    ? 'var(--debit)'
                    : summary.status === 'danger'
                    ? 'var(--amber)'
                    : 'var(--credit)',
                border: `1px solid ${
                  summary.status === 'exceeded'
                    ? 'var(--debit-border)'
                    : summary.status === 'danger'
                    ? 'var(--amber-border)'
                    : 'var(--credit-border)'
                }`,
                fontWeight: 700,
              }}
            >
              <span>{summary.percent}%</span>
              <span className="analytics-v2-pill-badge-label">&nbsp;used</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenBudgetDrawer()}
          className="drawer-reset-btn"
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Sliders size={13} strokeWidth={2.2} />
          <span>{hasBudgets ? 'Edit Limits' : 'Set Limits'}</span>
        </button>
      </div>

      {/* Card Body */}
      <div className="analytics-v2-card-body" style={{ padding: '14px 18px 16px' }}>
        {!hasBudgets ? (
          /* Empty State */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              textAlign: 'center',
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border)',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Target size={22} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
                No Category Spending Limits Yet
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', maxWidth: 320, lineHeight: 1.4 }}>
                Set monthly spending budgets for categories like Food, Shopping, and Entertainment to keep your expenses under control.
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenBudgetDrawer()}
              style={{
                marginTop: 4,
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
                border: 'none',
                fontSize: 'var(--fs-sm)',
                fontWeight: 650,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px var(--accent-soft)',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Set Up Category Limits</span>
            </button>
          </div>
        ) : (
          /* Active Budgets View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Overall Monthly Budget Banner */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text-2)' }}>
                  Total Budgeted Spend
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 750, color: 'var(--text)' }}>
                  {fmtMoney(summary.totalSpent, currency)} / {fmtMoney(summary.totalBudget, currency)}
                </div>
              </div>

              {/* Overall Multi-Tone Progress Bar */}
              <div
                style={{
                  height: 7,
                  width: '100%',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--surface3)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, summary.percent)}%`,
                    borderRadius: 'var(--radius-full)',
                    background:
                      summary.status === 'exceeded'
                        ? 'var(--debit)'
                        : summary.status === 'danger'
                        ? 'var(--amber)'
                        : 'var(--credit)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              {/* Summary Stats Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                <span>
                  {summary.totalRemaining >= 0
                    ? `${fmtMoney(summary.totalRemaining, currency)} remaining`
                    : `${fmtMoney(Math.abs(summary.totalRemaining), currency)} over budget`}
                </span>
                <span>
                  {summary.overBudgetCategoriesCount > 0 ? (
                    <span style={{ color: 'var(--debit)', fontWeight: 600 }}>
                      ⚠️ {summary.overBudgetCategoriesCount} exceeded
                    </span>
                  ) : summary.nearLimitCategoriesCount > 0 ? (
                    <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                      🔔 {summary.nearLimitCategoriesCount} near limit
                    </span>
                  ) : (
                    <span style={{ color: 'var(--credit)', fontWeight: 600 }}>
                      ✓ All on track
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Individual Budgeted Categories List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {budgetStatuses.map((item: CategoryBudgetStatus) => {
                const bgTint =
                  item.category.color.startsWith('#') && item.category.color.length === 7
                    ? `${item.category.color}1c`
                    : 'var(--accent-soft)';
                const borderTint =
                  item.category.color.startsWith('#') && item.category.color.length === 7
                    ? `${item.category.color}35`
                    : 'var(--border)';

                const isExceeded = item.isOverBudget;
                const isNearLimit = item.percent >= 75 && !isExceeded;

                const progressColor = isExceeded
                  ? 'var(--debit)'
                  : isNearLimit
                  ? 'var(--amber)'
                  : item.category.color || 'var(--credit)';

                return (
                  <div
                    key={item.categoryName}
                    onClick={() => {
                      if (onOpenCategoryDrawer) onOpenCategoryDrawer(item.categoryName);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface2)',
                      border: isExceeded ? '1px solid var(--debit-border)' : '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      cursor: onOpenCategoryDrawer ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                    }}
                    className="category-budget-row"
                  >
                    {/* Top Row: Category Info & Amounts */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 'var(--radius-sm)',
                            background: bgTint,
                            border: `1px solid ${borderTint}`,
                            color: item.category.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CategoryIcon category={item.categoryName} icon={item.category.icon} size={15} style={{ color: item.category.color }} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.categoryName}
                            </span>
                            {isExceeded && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 750,
                                  background: 'var(--debit-bg)',
                                  color: 'var(--debit)',
                                  padding: '1px 5px',
                                  borderRadius: 'var(--radius-full)',
                                  border: '1px solid var(--debit-border)',
                                }}
                              >
                                OVER LIMIT
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                            Limit: {fmtMoney(item.budget, currency)}
                          </div>
                        </div>
                      </div>

                      {/* Right: Spent & Percent */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 750, color: isExceeded ? 'var(--debit)' : 'var(--text)' }}>
                          {fmtMoney(item.spent, currency)}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 650,
                            color: isExceeded ? 'var(--debit)' : isNearLimit ? 'var(--amber)' : 'var(--credit)',
                          }}
                        >
                          {item.percent}% used
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        height: 6,
                        width: '100%',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface3)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, item.percent)}%`,
                          borderRadius: 'var(--radius-full)',
                          background: progressColor,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    {/* Footer Row: Pacing Forecast & Remaining */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-3)' }}>
                      <span>
                        {item.remaining >= 0
                          ? `₹${Math.round(item.remaining)} left (${fmtMoney(item.dailyAllowanceRemaining, currency)}/day)`
                          : `Over by ${fmtMoney(Math.abs(item.remaining), currency)}`}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <TrendingUp size={11} />
                        <span>Pacing: ~{fmtMoney(item.projectedMonthEnd, currency)}</span>
                        {onOpenCategoryDrawer && <ChevronRight size={12} style={{ color: 'var(--text-3)' }} />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unbudgeted Categories Quick Trigger */}
            {unbudgetedCategories.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface2)',
                  border: '1px dashed var(--border)',
                  fontSize: 'var(--fs-caption)',
                  color: 'var(--text-2)',
                }}
              >
                <span>
                  {unbudgetedCategories.length} categories have no spending limits
                </span>
                <button
                  type="button"
                  onClick={() => onOpenBudgetDrawer()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 'var(--fs-caption)',
                    padding: 0,
                  }}
                >
                  + Add Limits
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryBudgetsCard;
