import { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Flame,
  Zap,
  ChevronRight,
  Wallet,
  Scale
} from 'lucide-react';
import { fmtMoney } from '../utils';
import type { Expense, ViewName, GroupedExpense } from '../types';

export interface QuickStatsWidgetProps {
  totalIncome: number;
  totalExpenses: number;
  incomeCount?: number;
  expenseCount?: number;
  currency: string;
  monthName: string;
  year?: number;
  isCardMasked?: boolean;
  highestExpense?: Expense | null;
  highestExpenseGrouped?: GroupedExpense | null;
  netFriends?: number;
  onNavigate?: (view: ViewName, arg?: string) => void;
  onSelectDetailGe?: (ge: GroupedExpense) => void;
  className?: string;
}

export default function QuickStatsWidget({
  totalIncome,
  totalExpenses,
  incomeCount = 0,
  expenseCount = 0,
  currency,
  monthName,
  year = new Date().getFullYear(),
  isCardMasked = false,
  highestExpense = null,
  highestExpenseGrouped = null,
  onNavigate,
  onSelectDetailGe,
  className = '',
}: QuickStatsWidgetProps) {
  const netSavings = totalIncome - totalExpenses;
  const now = new Date();
  const currentDay = now.getDate();
  const dailyBurn = totalExpenses / Math.max(1, currentDay);

  // Compute savings rate
  const savingsRate = useMemo(() => {
    if (totalIncome > 0) {
      return Math.round((netSavings / totalIncome) * 100);
    }
    if (totalExpenses > 0) {
      return -100;
    }
    return 0;
  }, [totalIncome, totalExpenses, netSavings]);

  // Compute spend ratio vs income
  const spendRatio = useMemo(() => {
    if (totalIncome > 0) {
      return Math.min(100, Math.round((totalExpenses / totalIncome) * 100));
    }
    return totalExpenses > 0 ? 100 : 0;
  }, [totalIncome, totalExpenses]);

  return (
    <div
      className={`quick-stats-widget ${className}`}
      data-testid="quick-stats-widget"
    >
      {/* Widget Header with Title & Current Month Pill */}
      <div className="quick-stats-header">
        <div className="quick-stats-title-group">
          <div className="quick-stats-icon">
            <Zap size={14} strokeWidth={2.4} />
          </div>
          <span className="quick-stats-title">Quick Stats</span>
        </div>
        <div className="quick-stats-header-actions">
          <span className="quick-stats-month-badge">
            {monthName} {year}
          </span>
        </div>
      </div>

      {/* Grid Layout: Total Income, Total Expenses, Net Savings, Highest Expense/Daily Avg */}
      <div className="quick-stats-grid">
        {/* 1. Total Income Card */}
        <div
          className="quick-stats-card quick-stats-card-income"
          data-testid="quick-stats-income"
          onClick={() => onNavigate?.('expenses')}
          role="button"
          tabIndex={0}
          title={`View ${monthName} Income in Expenses`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate?.('expenses');
            }
          }}
        >
          <div className="quick-stats-card-top">
            <div className="quick-stats-card-label-wrap">
              <div
                className="quick-stats-card-icon-box"
                style={{
                  background: 'var(--credit-bg)',
                  border: '1px solid var(--credit-border)',
                  color: 'var(--credit)',
                }}
              >
                <TrendingUp size={13} strokeWidth={2.4} />
              </div>
              <span>Total Income</span>
            </div>
            <ArrowUpRight size={13} className="quick-stats-nav-icon" />
          </div>

          <div
            className="quick-stats-card-value"
            style={{ color: 'var(--credit)' }}
          >
            {fmtMoney(totalIncome, currency, isCardMasked)}
          </div>

          <div className="quick-stats-card-sub">
            <span>
              {incomeCount} {incomeCount === 1 ? 'transaction' : 'transactions'}
            </span>
            <span style={{ color: 'var(--credit)', fontWeight: 600 }}>Inflow</span>
          </div>
        </div>

        {/* 2. Total Expenses Card */}
        <div
          className="quick-stats-card quick-stats-card-expenses"
          data-testid="quick-stats-expenses"
          onClick={() => onNavigate?.('expenses')}
          role="button"
          tabIndex={0}
          title={`View ${monthName} Expenses`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate?.('expenses');
            }
          }}
        >
          <div className="quick-stats-card-top">
            <div className="quick-stats-card-label-wrap">
              <div
                className="quick-stats-card-icon-box"
                style={{
                  background: 'var(--debit-bg)',
                  border: '1px solid var(--debit-border)',
                  color: 'var(--debit)',
                }}
              >
                <TrendingDown size={13} strokeWidth={2.4} />
              </div>
              <span>Total Expenses</span>
            </div>
            <ArrowUpRight size={13} className="quick-stats-nav-icon" />
          </div>

          <div
            className="quick-stats-card-value"
            style={{ color: 'var(--debit)' }}
          >
            {fmtMoney(totalExpenses, currency, isCardMasked)}
          </div>

          <div className="quick-stats-card-sub">
            <span>
              {expenseCount} {expenseCount === 1 ? 'transaction' : 'transactions'}
            </span>
            <span style={{ color: 'var(--debit)', fontWeight: 600 }}>Outflow</span>
          </div>
        </div>

        {/* 3. Net Savings / Net Cash Flow Card */}
        <div
          className="quick-stats-card quick-stats-card-net"
          data-testid="quick-stats-net"
          onClick={() => onNavigate?.('analytics')}
          role="button"
          tabIndex={0}
          title="View Cash Flow & Monthly Analytics"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate?.('analytics');
            }
          }}
        >
          <div className="quick-stats-card-top">
            <div className="quick-stats-card-label-wrap">
              <div
                className="quick-stats-card-icon-box"
                style={{
                  background: netSavings >= 0 ? 'var(--credit-bg)' : 'var(--debit-bg)',
                  border: `1px solid ${netSavings >= 0 ? 'var(--credit-border)' : 'var(--debit-border)'}`,
                  color: netSavings >= 0 ? 'var(--credit)' : 'var(--debit)',
                }}
              >
                {netSavings >= 0 ? (
                  <Wallet size={13} strokeWidth={2.4} />
                ) : (
                  <Scale size={13} strokeWidth={2.4} />
                )}
              </div>
              <span>Net Savings</span>
            </div>
            <ArrowUpRight size={13} className="quick-stats-nav-icon" />
          </div>

          <div
            className="quick-stats-card-value"
            style={{
              color: netSavings > 0 ? 'var(--credit)' : netSavings < 0 ? 'var(--debit)' : 'var(--text)',
            }}
          >
            {netSavings > 0 ? '+' : ''}
            {fmtMoney(netSavings, currency, isCardMasked)}
          </div>

          <div className="quick-stats-card-sub">
            <span>
              {totalIncome > 0
                ? `${savingsRate}% saved`
                : netSavings < 0
                ? 'Deficit'
                : 'Balanced'}
            </span>
            <span
              style={{
                color: netSavings >= 0 ? 'var(--credit)' : 'var(--debit)',
                fontWeight: 600,
              }}
            >
              {netSavings >= 0 ? 'Surplus' : 'Deficit'}
            </span>
          </div>
        </div>

        {/* 4. Highest Expense / Daily Burn Rate Card */}
        <div
          className="quick-stats-card quick-stats-card-highest"
          data-testid="quick-stats-highest"
          onClick={() => {
            if (highestExpenseGrouped && onSelectDetailGe) {
              onSelectDetailGe(highestExpenseGrouped);
            } else {
              onNavigate?.('expenses');
            }
          }}
          role="button"
          tabIndex={0}
          title={
            highestExpense
              ? `${highestExpense.description || highestExpense.category}: ${fmtMoney(
                  highestExpense.amount,
                  currency
                )} - Click to view`
              : `Daily Burn Rate: ${fmtMoney(dailyBurn, currency)}/day`
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (highestExpenseGrouped && onSelectDetailGe) {
                onSelectDetailGe(highestExpenseGrouped);
              } else {
                onNavigate?.('expenses');
              }
            }
          }}
        >
          <div className="quick-stats-card-top">
            <div className="quick-stats-card-label-wrap">
              <div
                className="quick-stats-card-icon-box"
                style={{
                  background: 'var(--amber-bg)',
                  border: '1px solid var(--amber-border)',
                  color: 'var(--amber)',
                }}
              >
                <Flame size={13} strokeWidth={2.4} />
              </div>
              <span>{highestExpense ? 'Highest Exp' : 'Daily Burn'}</span>
            </div>
            {highestExpenseGrouped ? (
              <ChevronRight size={13} className="quick-stats-nav-icon" />
            ) : (
              <ArrowUpRight size={13} className="quick-stats-nav-icon" />
            )}
          </div>

          <div
            className="quick-stats-card-value"
            style={{ color: 'var(--amber)' }}
          >
            {highestExpense
              ? fmtMoney(highestExpense.amount, currency, isCardMasked)
              : fmtMoney(dailyBurn, currency, isCardMasked)}
          </div>

          <div className="quick-stats-card-sub">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {highestExpense
                ? highestExpense.description || highestExpense.category
                : `${currentDay}d elapsed`}
            </span>
            <span style={{ color: 'var(--amber)', fontWeight: 600, flexShrink: 0 }}>
              {highestExpense ? highestExpense.category : 'Daily Avg'}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Monthly Cashflow Proportion Bar */}
      {(totalIncome > 0 || totalExpenses > 0) && (
        <div className="quick-stats-ratio-bar-wrap">
          <div className="quick-stats-ratio-labels">
            <span>
              Spend: <strong style={{ color: 'var(--text)' }}>{spendRatio}%</strong> of income
            </span>
            <span>
              Saved:{' '}
              <strong
                style={{
                  color: netSavings >= 0 ? 'var(--credit)' : 'var(--debit)',
                }}
              >
                {Math.max(0, 100 - spendRatio)}%
              </strong>
            </span>
          </div>
          <div className="quick-stats-ratio-track" role="progressbar" aria-valuenow={spendRatio} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="quick-stats-ratio-fill-spend"
              style={{ width: `${Math.min(100, spendRatio)}%` }}
              title={`Expenses: ${fmtMoney(totalExpenses, currency)}`}
            />
            {netSavings > 0 && (
              <div
                className="quick-stats-ratio-fill-saved"
                style={{ width: `${Math.max(0, 100 - spendRatio)}%` }}
                title={`Savings: ${fmtMoney(netSavings, currency)}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
