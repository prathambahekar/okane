import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronRight, FilterX, RotateCcw, History, ChevronUp, ChevronDown } from 'lucide-react';
import { fmtMoney, fmtMoneyCompact, fmtDateWithDay, getRelativeDateLabel, getGroupedExpenseAmount, type GroupedExpense, type SpendingMode } from '../../utils';
import CategoryIcon from '../CategoryIcon';
import type { Category, Wallet, Friend } from '../../types';

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
  isFuture?: boolean;
}

interface DailyExpenditureCardProps {
  days: DayExpenditureRow[];
  currency: string;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onOpenDayDetails: (dateStr: string) => void;
  categorySettings: Category[];
  period?: 'week' | 'month';
  selectedCategory?: string | null;
  onClearCategory?: () => void;
  categoryExpenses?: GroupedExpense[];
  onSelectExpense?: (ge: GroupedExpense) => void;
  spendingMode?: SpendingMode;
  wallets?: Wallet[];
  friends?: Friend[];
  className?: string;
}

export const DailyExpenditureCard: React.FC<DailyExpenditureCardProps> = ({
  days,
  currency,
  selectedDate,
  onSelectDate,
  onOpenDayDetails,
  categorySettings,
  period = 'week',
  selectedCategory,
  onClearCategory,
  categoryExpenses = [],
  onSelectExpense,
  spendingMode = 'all',
  wallets = [],
  friends = [],
  className = '',
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const getCatMeta = (name: string) => {
    const found = categorySettings.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return {
      color: found?.color || '#8B5CF6',
      icon: found?.icon || 'Tag',
    };
  };

  const selectedCatMeta = selectedCategory ? getCatMeta(selectedCategory) : null;

  // Sorted list of category transactions if selectedCategory is active
  const sortedCategoryExpenses = useMemo(() => {
    if (!selectedCategory) return [];
    return [...categoryExpenses].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [categoryExpenses, selectedCategory]);

  const categoryTotalSpent = useMemo(() => {
    if (!selectedCategory) return 0;
    return sortedCategoryExpenses
      .filter((ge) => ge.flow === 'out')
      .reduce((sum, ge) => sum + getGroupedExpenseAmount(ge, spendingMode), 0);
  }, [sortedCategoryExpenses, spendingMode, selectedCategory]);

  // Dynamic title based on active view and category filter
  const cardTitle = selectedCategory
    ? `${selectedCategory} Activity`
    : selectedDate
    ? 'Day Activity'
    : period === 'week'
    ? 'Weekly Activity'
    : 'Monthly Activity';

  const updateScrollState = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 4;
    setCanScrollUp(hasOverflow && el.scrollTop > 4);
    setCanScrollDown(hasOverflow && el.scrollTop < el.scrollHeight - el.clientHeight - 4);
  }, []);

  const scrollBy6 = (direction: 'up' | 'down') => {
    const el = listRef.current;
    if (!el) return;
    const rowHeight = 57; // 54px + 3px gap
    const step = rowHeight * 6; // Scroll exactly 6 rows at a time
    el.scrollBy({
      top: direction === 'down' ? step : -step,
      behavior: 'smooth',
    });
  };

  // Setup smooth 6-items-at-a-time wheel scroll behavior
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    let isWheelScrolling = false;
    let wheelTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleWheel = (e: WheelEvent) => {
      // Only intercept if container has scrollable overflow
      if (el.scrollHeight <= el.clientHeight) return;

      if (Math.abs(e.deltaY) > 5) {
        e.preventDefault();
        if (isWheelScrolling) return;

        isWheelScrolling = true;
        const rowHeight = 57;
        const scrollStep = rowHeight * 6; // 6 at a time
        const direction = e.deltaY > 0 ? 1 : -1;

        const currentScroll = el.scrollTop;
        const targetScroll = direction > 0
          ? Math.min(el.scrollHeight - el.clientHeight, Math.floor((currentScroll + 10) / scrollStep + 1) * scrollStep)
          : Math.max(0, Math.ceil((currentScroll - 10) / scrollStep - 1) * scrollStep);

        el.scrollTo({
          top: targetScroll,
          behavior: 'smooth',
        });

        if (wheelTimeout) clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
          isWheelScrolling = false;
          updateScrollState();
        }, 220);
      }
    };

    const handleScroll = () => {
      updateScrollState();
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('scroll', handleScroll, { passive: true });
    updateScrollState();

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('scroll', handleScroll);
      if (wheelTimeout) clearTimeout(wheelTimeout);
    };
  }, [days.length, sortedCategoryExpenses.length, selectedCategory, updateScrollState]);

  const totalItemsCount = selectedCategory ? sortedCategoryExpenses.length : days.length;
  const showScrollButtons = totalItemsCount > 6;

  return (
    <div className={`analytics-v2-card ${className}`.trim()}>
      {/* Header */}
      <div className="analytics-v2-card-header">
        <div className="analytics-v2-header-left">
          <span
            className="analytics-v2-header-icon-pill"
            style={
              selectedCatMeta
                ? {
                    backgroundColor: `${selectedCatMeta.color}18`,
                    color: selectedCatMeta.color,
                  }
                : undefined
            }
          >
            {selectedCatMeta ? (
              <CategoryIcon
                category={selectedCategory!}
                icon={selectedCatMeta.icon}
                size={15}
                style={{ color: selectedCatMeta.color }}
              />
            ) : (
              <Calendar size={15} strokeWidth={2.2} />
            )}
          </span>
          <h2 className="analytics-v2-card-title">{cardTitle}</h2>
          
          {selectedCategory ? (
            <span className="analytics-v2-pill-badge">
              <span>{sortedCategoryExpenses.length}</span>
              <span className="analytics-v2-pill-badge-label">
                &nbsp;{sortedCategoryExpenses.length === 1 ? 'transaction' : 'transactions'}
              </span>
            </span>
          ) : (
            <span className="analytics-v2-pill-badge">
              <span>{days.length}</span>
              <span className="analytics-v2-pill-badge-label">
                &nbsp;{days.length === 1 ? 'day' : 'days'}
              </span>
            </span>
          )}
        </div>

        <div className="analytics-v2-header-right">
          {selectedCategory && categoryTotalSpent > 0 && (
            <span className="analytics-v2-header-amount">
              {fmtMoney(categoryTotalSpent, currency)}
            </span>
          )}

          {showScrollButtons && (
            <div className="analytics-v2-scroll-controls" title="Scroll 6 days at a time">
              <button
                type="button"
                className="analytics-v2-scroll-btn"
                onClick={() => scrollBy6('up')}
                disabled={!canScrollUp}
                aria-label="Scroll up 6 days"
                title="Scroll up 6 days"
              >
                <ChevronUp size={13} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                className="analytics-v2-scroll-btn"
                onClick={() => scrollBy6('down')}
                disabled={!canScrollDown}
                aria-label="Scroll down 6 days"
                title="Scroll down 6 days"
              >
                <ChevronDown size={13} strokeWidth={2.4} />
              </button>
            </div>
          )}

          {(selectedDate || selectedCategory) && (
            <button
              type="button"
              onClick={() => {
                if (selectedDate) onSelectDate(selectedDate);
                if (selectedCategory) onClearCategory?.();
              }}
              className="analytics-v2-clear-btn"
              title={
                selectedCategory && selectedDate
                  ? 'Clear filters'
                  : selectedCategory
                  ? `Clear ${selectedCategory} filter`
                  : 'Show all days'
              }
              aria-label="Clear active filter"
            >
              <FilterX size={13} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {/* Body Content */}
      {selectedCategory ? (
        /* When a category is selected: Show individual transactions directly */
        sortedCategoryExpenses.length === 0 ? (
          <div className="analytics-v2-empty-box">
            <div className="analytics-v2-empty-icon">
              <CategoryIcon
                category={selectedCategory!}
                icon={selectedCatMeta?.icon || 'Tag'}
                size={24}
                style={{ color: selectedCatMeta?.color }}
              />
            </div>
            <div className="analytics-v2-empty-title">
              No {selectedCategory} activity
            </div>
            <div className="analytics-v2-empty-desc">
              No {selectedCategory.toLowerCase()} transactions recorded for this {period === 'week' ? 'week' : 'month'}.
            </div>
            {onClearCategory && (
              <button
                type="button"
                onClick={onClearCategory}
                style={{
                  marginTop: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 650,
                  borderRadius: 9999,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} strokeWidth={2.2} />
                <span>Show all activity</span>
              </button>
            )}
          </div>
        ) : (
          <div ref={listRef} className="analytics-v2-day-list">
            {sortedCategoryExpenses.map((ge, idx) => {
              const meta = getCatMeta(ge.category);
              const amt = getGroupedExpenseAmount(ge, spendingMode);
              const isOut = ge.flow === 'out';
              const amountColor = isOut ? 'var(--debit)' : 'var(--credit)';
              const amountPrefix = isOut ? '-' : '+';
              const wallet = wallets.find((w) => w.id === ge.walletId);
              const relLabel = getRelativeDateLabel(ge.date);
              const dateLabel = fmtDateWithDay(ge.date);

              // Build informative subtitle: Date (e.g. Fri, Sep 4) · Wallet · Split
              const subtitleParts: string[] = [dateLabel];
              if (wallet) {
                subtitleParts.push(wallet.name);
              }
              if (ge.isSplit) {
                const friendNames = ge.friendIds
                  .map((fid) => friends.find((f) => f.id === fid)?.name)
                  .filter(Boolean);
                if (friendNames.length > 0) {
                  subtitleParts.push(`Split with ${friendNames.join(', ')}`);
                } else {
                  subtitleParts.push('Split');
                }
              } else if (ge.items[0]?.friendId) {
                const fName = friends.find((f) => f.id === ge.items[0].friendId)?.name;
                if (fName) subtitleParts.push(`With ${fName}`);
              }

              const title = ge.description || ge.category;

              return (
                <div
                  key={`cat-exp-${ge.id}-${idx}`}
                  className="analytics-v2-day-row"
                  onClick={() => onSelectExpense?.(ge)}
                  role="button"
                  tabIndex={0}
                >
                  {/* Left Side: Category icon & Transaction details */}
                  <div className="analytics-v2-day-left">
                    <div
                      className="analytics-v2-cat-icon-wrap"
                      style={{
                        backgroundColor: `${meta.color}18`,
                        color: meta.color,
                      }}
                    >
                      <CategoryIcon
                        category={ge.category}
                        icon={meta.icon}
                        size={15}
                        style={{ color: meta.color }}
                      />
                    </div>

                    <div className="analytics-v2-day-info">
                      <div className="analytics-v2-day-title-row">
                        <span className="analytics-v2-day-title">{title}</span>
                        {relLabel === 'Today' && (
                          <span className="analytics-v2-day-tag today">Today</span>
                        )}
                        {relLabel === 'Yesterday' && (
                          <span className="analytics-v2-day-tag yesterday" title="Yesterday" aria-label="Yesterday">
                            <History size={10.5} strokeWidth={2.4} className="analytics-v2-day-tag-icon" />
                            <span className="analytics-v2-day-tag-text">Yesterday</span>
                          </span>
                        )}
                        {ge.isSplit && (
                          <span
                            className="analytics-v2-day-tag"
                            style={{
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#3b82f6',
                            }}
                          >
                            Split
                          </span>
                        )}
                      </div>

                      <div className="analytics-v2-day-subtitle">
                        {subtitleParts.join(' · ')}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Net amount & Chevron */}
                  <div className="analytics-v2-day-right">
                    <span
                      className="analytics-v2-day-amount"
                      style={{ color: amountColor }}
                      title={fmtMoney(amt, currency)}
                    >
                      <span className="day-amount-full">
                        {amountPrefix}{fmtMoney(amt, currency)}
                      </span>
                      <span className="day-amount-compact">
                        {amountPrefix}{fmtMoneyCompact(amt, currency)}
                      </span>
                    </span>
                    <div className="analytics-v2-day-arrow">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* When NO category is selected: Show daily breakdown list */
        days.length === 0 ? (
          <div className="analytics-v2-empty-box">
            <div className="analytics-v2-empty-icon">
              <Calendar size={24} strokeWidth={1.75} />
            </div>
            <div className="analytics-v2-empty-title">
              No {period === 'week' ? 'weekly' : 'monthly'} activity
            </div>
            <div className="analytics-v2-empty-desc">
              No transactions recorded for this {period === 'week' ? 'week' : 'month'}.
            </div>
          </div>
        ) : (
          <div ref={listRef} className="analytics-v2-day-list">
            {days.map((row, idx) => {
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
                  key={`${row.dateStr}-${idx}`}
                  className={`analytics-v2-day-row ${isSelected ? 'active' : ''} ${row.isFuture ? 'future-day' : ''}`}
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
                        opacity: row.isFuture ? 0.6 : 1,
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
                        <span className="analytics-v2-day-title" style={{ opacity: row.isFuture ? 0.75 : 1 }}>
                          {row.dayName}
                        </span>
                        {row.isToday && (
                          <span className="analytics-v2-day-tag today">Today</span>
                        )}
                        {row.isYesterday && (
                          <span className="analytics-v2-day-tag yesterday" title="Yesterday" aria-label="Yesterday">
                            <History size={10.5} strokeWidth={2.4} className="analytics-v2-day-tag-icon" />
                            <span className="analytics-v2-day-tag-text">Yesterday</span>
                          </span>
                        )}
                        {row.isFuture && (
                          <span className="analytics-v2-day-tag upcoming">Upcoming</span>
                        )}
                      </div>

                      <div className="analytics-v2-day-subtitle">
                        {row.count === 0 ? (
                          row.isFuture ? 'Upcoming day' : 'No transactions'
                        ) : (
                          `${row.count} ${row.count === 1 ? 'item' : 'items'}`
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Net amount & Chevron */}
                  <div className="analytics-v2-day-right">
                    <span
                      className="analytics-v2-day-amount"
                      style={{ color: amountColor }}
                      title={fmtMoney(displayAmount, currency)}
                    >
                      {row.count === 0 ? (
                        fmtMoney(0, currency)
                      ) : (
                        <>
                          <span className="day-amount-full">
                            {amountPrefix}{fmtMoney(displayAmount, currency)}
                          </span>
                          <span className="day-amount-compact">
                            {amountPrefix}{fmtMoneyCompact(displayAmount, currency)}
                          </span>
                        </>
                      )}
                    </span>
                    <div className="analytics-v2-day-arrow">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};

export default DailyExpenditureCard;
