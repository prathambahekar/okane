import React, { useMemo, useState } from 'react';
import {
  Target,
  ChevronRight,
  Plus,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../../store';
import { fmtMoney } from '../../utils';
import CategoryIcon from '../CategoryIcon';
import { getAllCategoryBudgetStatuses, type CategoryBudgetStatus } from '../../utils/budget';
import { BudgetSetupDrawer } from '../analytics/BudgetSetupDrawer';
import { CategoryDetailDrawer } from '../analytics/CategoryDetailDrawer';
import type { ViewName } from '../../types';

interface DashboardBudgetsWidgetProps {
  onNavigate?: (v: ViewName, arg?: string) => void;
  className?: string;
}

export const DashboardBudgetsWidget: React.FC<DashboardBudgetsWidgetProps> = ({
  onNavigate,
  className = '',
}) => {
  const { db } = useStore();
  const currency = db.settings?.currency || 'INR';

  const [isBudgetDrawerOpen, setIsBudgetDrawerOpen] = useState(false);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [activeDrawerCategory, setActiveDrawerCategory] = useState<string | null>(null);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { budgetStatuses, summary, unbudgetedCategories } = useMemo(() => {
    return getAllCategoryBudgetStatuses(db, currentMonthStr);
  }, [db, currentMonthStr]);

  const hasBudgets = budgetStatuses.length > 0;
  const displayBudgets = useMemo(() => budgetStatuses.slice(0, 4), [budgetStatuses]);

  return (
    <>
      <div
        className={`card dashboard-budgets-card ${className}`}
        style={{
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box',
          padding: '18px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            width: '100%',
            minWidth: 0,
            minHeight: 30,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              flex: '1 1 auto',
              overflow: 'hidden',
            }}
          >
            <div className="dashboard-card-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Target size={16} strokeWidth={2.4} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
              <h2
                style={{
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 700,
                  color: 'var(--text)',
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Monthly Budgets
              </h2>

              {hasBudgets && (
                <span
                  className="pill-chip"
                  style={{
                    fontSize: 'var(--fs-caption)',
                    padding: '1.5px 7.5px',
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
                    letterSpacing: '-0.2px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    fontWeight: 700,
                  }}
                  title={`Total spend is ${summary.percent}% of budgeted categories`}
                >
                  {summary.status === 'exceeded' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <AlertCircle size={10} strokeWidth={2.5} />
                      {summary.percent}% used
                    </span>
                  ) : summary.status === 'danger' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <AlertTriangle size={10} strokeWidth={2.5} />
                      {summary.percent}% used
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <CheckCircle2 size={10} strokeWidth={2.5} />
                      {summary.percent}% used
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn-view-all"
              onClick={() => {
                setSelectedCategoryName(null);
                setIsBudgetDrawerOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-3)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
                padding: '4px 6px',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Configure category spending limits"
            >
              <Sliders size={13} strokeWidth={2} />
              <span>{hasBudgets ? 'Manage' : 'Set Limits'}</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {!hasBudgets ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              textAlign: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface2)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <Target size={22} strokeWidth={2} />
            </div>
            <div
              style={{
                fontSize: 'var(--fs-base)',
                fontWeight: 650,
                color: 'var(--text)',
                marginBottom: 4,
              }}
            >
              No category limits set
            </div>
            <p
              style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--text-3)',
                margin: '0 0 14px',
                lineHeight: 1.45,
                maxWidth: 280,
              }}
            >
              Set monthly spending budgets for Food, Shopping, Bills & more to prevent overspending.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryName(null);
                setIsBudgetDrawerOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--text)',
                color: 'var(--surface)',
                border: 'none',
                fontSize: 'var(--fs-xs)',
                fontWeight: 650,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={14} strokeWidth={2.4} />
              <span>Set Category Limits</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0 }}>
            {/* Quick Summary Pill Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--surface2)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                fontSize: 'var(--fs-xs)',
                gap: 8,
              }}
            >
              <div style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>Budgeted:</span>
                <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(summary.totalSpent, currency)}
                </strong>
                <span style={{ color: 'var(--text-3)' }}>/</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(summary.totalBudget, currency)}
                </span>
              </div>

              <div
                style={{
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: summary.totalRemaining >= 0 ? 'var(--credit)' : 'var(--debit)',
                  whiteSpace: 'nowrap',
                }}
              >
                {summary.totalRemaining >= 0
                  ? `${fmtMoney(summary.totalRemaining, currency)} left`
                  : `${fmtMoney(Math.abs(summary.totalRemaining), currency)} over`}
              </div>
            </div>

            {/* List of Category Progress Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minWidth: 0 }}>
              {displayBudgets.map((item: CategoryBudgetStatus) => {
                const catColor = item.category.color || 'var(--accent)';
                const bgTint = catColor.startsWith('#') && catColor.length === 7 ? `${catColor}18` : 'var(--accent-soft)';
                const borderTint = catColor.startsWith('#') && catColor.length === 7 ? `${catColor}35` : 'var(--border)';

                return (
                  <div
                    key={item.categoryName}
                    onClick={() => setActiveDrawerCategory(item.categoryName)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveDrawerCategory(item.categoryName);
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      margin: '0 -6px',
                      width: 'calc(100% + 12px)',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    className="hover:bg-[var(--surface2)]"
                  >
                    {/* Row Top: Icon, Name, and Spent vs Limit */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 'var(--radius-sm)',
                            background: bgTint,
                            border: `1px solid ${borderTint}`,
                            color: catColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CategoryIcon category={item.categoryName} icon={item.category.icon} size={14} style={{ color: catColor }} />
                        </div>
                        <span
                          style={{
                            fontSize: 'var(--fs-sm)',
                            fontWeight: 650,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.categoryName}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 4,
                          fontSize: 'var(--fs-xs)',
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: item.isOverBudget
                              ? 'var(--debit)'
                              : item.percent >= 75
                              ? 'var(--amber)'
                              : 'var(--text)',
                          }}
                        >
                          {fmtMoney(item.spent, currency)}
                        </span>
                        <span style={{ color: 'var(--text-3)' }}>/</span>
                        <span style={{ color: 'var(--text-2)' }}>{fmtMoney(item.budget, currency)}</span>
                      </div>
                    </div>

                    {/* Progress Track */}
                    <div
                      style={{
                        height: 5,
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
                          background: item.isOverBudget
                            ? 'var(--debit)'
                            : item.percent >= 85
                            ? 'var(--debit)'
                            : item.percent >= 70
                            ? 'var(--amber)'
                            : catColor || 'var(--credit)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    {/* Bottom Status Caption */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 'var(--fs-caption)',
                        color: 'var(--text-3)',
                        lineHeight: 1.2,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: item.isOverBudget || item.percent >= 75 ? 650 : 500,
                          color: item.isOverBudget
                            ? 'var(--debit)'
                            : item.percent >= 75
                            ? 'var(--amber)'
                            : 'var(--text-3)',
                        }}
                      >
                        {item.isOverBudget
                          ? `⚠️ Over by ${fmtMoney(Math.abs(item.remaining), currency)}`
                          : `${item.percent}% used · ${fmtMoney(item.remaining, currency)} left`}
                      </span>

                      {item.projectedMonthEnd > 0 && (
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          Pace: ~{fmtMoney(item.projectedMonthEnd, currency)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* If more budgeted categories exist or unbudgeted exist */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 4,
                borderTop: '1px solid var(--border)',
                marginTop: 2,
              }}
            >
              {unbudgetedCategories.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryName(unbudgetedCategories[0]?.name || null);
                    setIsBudgetDrawerOpen(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  className="hover:text-[var(--accent)]"
                >
                  <Plus size={11} />
                  <span>+{unbudgetedCategories.length} unbudgeted categories</span>
                </button>
              ) : (
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                  All categories budgeted
                </div>
              )}

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('analytics')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontWeight: 600,
                  }}
                  className="hover:text-[var(--accent)]"
                >
                  <span>View in Analytics</span>
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Budget Setup Drawer */}
      <BudgetSetupDrawer
        isOpen={isBudgetDrawerOpen}
        onClose={() => {
          setIsBudgetDrawerOpen(false);
          setSelectedCategoryName(null);
        }}
        initialCategoryName={selectedCategoryName}
      />

      {/* Category Detail Drawer */}
      {activeDrawerCategory && (
        <CategoryDetailDrawer
          isOpen={Boolean(activeDrawerCategory)}
          onClose={() => setActiveDrawerCategory(null)}
          categoryName={activeDrawerCategory}
          expenses={db.expenses}
          currency={currency}
          wallets={db.wallets}
          activeMonthStr={currentMonthStr}
        />
      )}
    </>
  );
};

export default DashboardBudgetsWidget;
