import { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Flame,
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
  currency,
  monthName,
  isCardMasked = false,
  highestExpense = null,
  highestExpenseGrouped = null,
  netFriends = 0,
  onNavigate,
  onSelectDetailGe,
  className = '',
}: QuickStatsWidgetProps) {
  const shortMonth = useMemo(() => {
    if (!monthName) return 'Month';
    return monthName.slice(0, 3);
  }, [monthName]);

  const highestAmt = highestExpense ? Number(highestExpense.amount) || 0 : 0;

  return (
    <div
      className={`quick-stats-widget ${className}`}
      data-testid="quick-stats-widget"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {/* 2x2 Minimal Clean Stats Grid */}
      <div className="quick-stats-grid">
        {/* 1. Month Spend */}
        <div
          className="quick-stats-card quick-stats-card-expenses"
          data-testid="quick-stats-expenses"
          onClick={() => onNavigate?.('expenses')}
          role="button"
          tabIndex={0}
          title={`View ${shortMonth} Spend in Expenses`}
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
              <span>{shortMonth} Spend</span>
            </div>
          </div>

          <div
            className="quick-stats-card-value"
            style={{ color: 'var(--debit)' }}
          >
            {fmtMoney(totalExpenses, currency, isCardMasked)}
          </div>
        </div>

        {/* 2. Month Income */}
        <div
          className="quick-stats-card quick-stats-card-income"
          data-testid="quick-stats-income"
          onClick={() => onNavigate?.('expenses')}
          role="button"
          tabIndex={0}
          title={`View ${shortMonth} Income in Expenses`}
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
              <span>{shortMonth} Income</span>
            </div>
          </div>

          <div
            className="quick-stats-card-value"
            style={{ color: 'var(--credit)' }}
          >
            {fmtMoney(totalIncome, currency, isCardMasked)}
          </div>
        </div>

        {/* 3. Friends Net */}
        <div
          className="quick-stats-card quick-stats-card-friends"
          data-testid="quick-stats-friends"
          onClick={() => onNavigate?.('friends')}
          role="button"
          tabIndex={0}
          title="View Contacts & Friends Net Balance"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate?.('friends');
            }
          }}
        >
          <div className="quick-stats-card-top">
            <div className="quick-stats-card-label-wrap">
              <div
                className="quick-stats-card-icon-box"
                style={{
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-border-soft)',
                  color: 'var(--text-2)',
                }}
              >
                <Users size={13} strokeWidth={2.4} />
              </div>
              <span>Friends Net</span>
            </div>
          </div>

          <div
            className="quick-stats-card-value"
            style={{
              color: netFriends > 0 ? 'var(--credit)' : netFriends < 0 ? 'var(--debit)' : 'var(--text)',
            }}
          >
            {netFriends > 0 ? '+' : ''}
            {fmtMoney(netFriends, currency, isCardMasked)}
          </div>
        </div>

        {/* 4. Highest Expense */}
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
                )}`
              : 'No expenses this month'
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
              <span>Highest Exp</span>
            </div>
          </div>

          <div
            className="quick-stats-card-value"
            style={{ color: 'var(--amber)' }}
          >
            {fmtMoney(highestAmt, currency, isCardMasked)}
          </div>
        </div>
      </div>
    </div>
  );
}
