import React from 'react';
import { Calendar, ChevronRight, RotateCcw } from 'lucide-react';
import { fmtMoney, type GroupedExpense } from '../../utils';
import CategoryIcon from '../CategoryIcon';
import type { Category } from '../../types';

export interface DayExpenditureRow {
  dateStr: string;
  dayName: string;
  spend: number;
  income: number;
  count: number;
  items: GroupedExpense[];
  topCategory: string;
  isToday: boolean;
  isYesterday: boolean;
}

interface DailyExpenditureCardProps {
  days: DayExpenditureRow[];
  currency: string;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onOpenDayDetails: (dateStr: string) => void;
  categorySettings: Category[];
}

export const DailyExpenditureCard: React.FC<DailyExpenditureCardProps> = ({
  days,
  currency,
  selectedDate,
  onSelectDate,
  onOpenDayDetails,
  categorySettings,
}) => {
  const getCatMeta = (name: string) => {
    const found = categorySettings.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return {
      color: found?.color || '#8B5CF6',
      icon: found?.icon || 'Tag',
    };
  };

  return (
    <div className="analytics-v2-card">
      {/* Header */}
      <div className="analytics-v2-card-header">
        <div className="analytics-v2-header-left">
          <h2 className="analytics-v2-card-title">Daily Activity</h2>
          <span className="analytics-v2-pill-badge">
            {days.length} {days.length === 1 ? 'day' : 'days'}
          </span>
        </div>

        {selectedDate && (
          <div className="analytics-v2-header-right">
            <button
              type="button"
              onClick={() => onSelectDate(selectedDate)}
              className="analytics-v2-clear-btn"
              title="Clear date filter"
              aria-label="Show all days"
            >
              <RotateCcw size={13} strokeWidth={2.2} />
              <span className="analytics-v2-btn-label">Show all</span>
            </button>
          </div>
        )}
      </div>

      {days.length === 0 ? (
        <div className="analytics-v2-empty-box">
          <div className="analytics-v2-empty-icon">
            <Calendar size={24} strokeWidth={1.75} />
          </div>
          <div className="analytics-v2-empty-title">No daily activity</div>
          <div className="analytics-v2-empty-desc">
            No transactions recorded for this period.
          </div>
        </div>
      ) : (
        <div className="analytics-v2-day-list">
          {days.map((row) => {
            const meta = getCatMeta(row.topCategory);
            const isSelected = selectedDate === row.dateStr;
            const net = row.income - row.spend;

            let amountColor = 'var(--text-3)';
            let amountPrefix = '';
            let displayAmount = 0;

            if (row.spend > 0 && row.income === 0) {
              displayAmount = row.spend;
              amountColor = 'var(--debit)';
              amountPrefix = '-';
            } else if (row.income > 0 && row.spend === 0) {
              displayAmount = row.income;
              amountColor = 'var(--credit)';
              amountPrefix = '+';
            } else if (net > 0) {
              displayAmount = net;
              amountColor = 'var(--credit)';
              amountPrefix = '+';
            } else if (net < 0) {
              displayAmount = Math.abs(net);
              amountColor = 'var(--debit)';
              amountPrefix = '-';
            }

            return (
              <div
                key={row.dateStr}
                className={`analytics-v2-day-row ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  onSelectDate(row.dateStr);
                  onOpenDayDetails(row.dateStr);
                }}
                role="button"
                tabIndex={0}
              >
                {/* Left Side: Category icon & Day info */}
                <div className="analytics-v2-day-left">
                  <div
                    className="analytics-v2-cat-icon-wrap"
                    style={{
                      backgroundColor: `${meta.color}18`,
                      color: meta.color,
                    }}
                  >
                    <CategoryIcon
                      category={row.topCategory}
                      icon={meta.icon}
                      size={15}
                      style={{ color: meta.color }}
                    />
                  </div>

                  <div className="analytics-v2-day-info">
                    <div className="analytics-v2-day-title-row">
                      <span className="analytics-v2-day-title">{row.dayName}</span>
                      {row.isToday && (
                        <span className="analytics-v2-day-tag today">Today</span>
                      )}
                      {row.isYesterday && (
                        <span className="analytics-v2-day-tag yesterday">Yesterday</span>
                      )}
                    </div>

                    <div className="analytics-v2-day-subtitle">
                      {row.count} {row.count === 1 ? 'item' : 'items'} · {row.topCategory}
                    </div>
                  </div>
                </div>

                {/* Right Side: Net amount & Chevron */}
                <div className="analytics-v2-day-right">
                  <span
                    className="analytics-v2-day-amount"
                    style={{ color: amountColor }}
                  >
                    {amountPrefix}
                    {fmtMoney(displayAmount, currency)}
                  </span>
                  <div className="analytics-v2-day-arrow">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DailyExpenditureCard;
