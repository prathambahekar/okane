import React, { useState } from 'react';
import { PieChart, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { fmtMoney, fmtMoneyCompact } from '../../utils';
import CategoryIcon from '../CategoryIcon';
import type { Category } from '../../types';

export interface CategoryBreakdownItem {
  cat: string;
  amount: number;
  pct: number;
  count: number;
}

interface CategoryDistributionCardProps {
  categories: CategoryBreakdownItem[];
  totalOutflow: number;
  currency: string;
  selectedCategory?: string | null;
  onSelectCategory?: (cat: string | null) => void;
  selectedDate?: string | null;
  onClearDate?: () => void;
  categorySettings: Category[];
  maxDisplay?: number;
  hideShowMore?: boolean;
  title?: string;
  headerAction?: React.ReactNode;
  className?: string;
  interactive?: boolean;
  period?: 'week' | 'month';
}

export const CategoryDistributionCard: React.FC<CategoryDistributionCardProps> = ({
  categories,
  totalOutflow,
  currency,
  selectedCategory,
  onSelectCategory,
  selectedDate,
  onClearDate,
  categorySettings,
  maxDisplay = 5,
  hideShowMore = false,
  title = 'Category Breakdown',
  headerAction,
  className = '',
  interactive = true,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  // Collapse expanded list when switching selected date
  if (prevSelectedDate !== selectedDate) {
    setPrevSelectedDate(selectedDate);
    setExpanded(false);
  }

  const isClickable = interactive && (!!onSelectCategory || !!onClearDate);

  const visibleCategories = hideShowMore
    ? categories.slice(0, maxDisplay)
    : expanded
    ? categories
    : categories.slice(0, maxDisplay);
  const hasMore = !hideShowMore && categories.length > maxDisplay;

  // Find color and icon for a category
  const getCatMeta = (name: string) => {
    const found = categorySettings.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return {
      color: found?.color || '#8B5CF6',
      icon: found?.icon || 'Tag',
    };
  };

  const cardTitle = title !== 'Category Breakdown'
    ? title
    : selectedDate
    ? 'Day Breakdown'
    : 'Category Breakdown';

  return (
    <div className={`analytics-v2-card ${className}`}>
      {/* Header */}
      <div className="analytics-v2-card-header">
        <div className="analytics-v2-header-left">
          <span className="analytics-v2-header-icon-pill">
            <PieChart size={15} strokeWidth={2.2} />
          </span>
          <h2 className="analytics-v2-card-title">{cardTitle}</h2>

          {categories.length > 0 && (
            <span className="analytics-v2-pill-badge">
              <span>{categories.length}</span>
              <span className="analytics-v2-pill-badge-label">
                &nbsp;{categories.length === 1 ? 'category' : 'categories'}
              </span>
            </span>
          )}
        </div>

        <div className="analytics-v2-header-right">
          {totalOutflow > 0 && (
            <span className="analytics-v2-header-amount" title={fmtMoney(totalOutflow, currency)}>
              <span className="header-amount-full">{fmtMoney(totalOutflow, currency)}</span>
              <span className="header-amount-compact">{fmtMoneyCompact(totalOutflow, currency)}</span>
            </span>
          )}

          {headerAction}

          {isClickable && (selectedCategory || selectedDate) && (
            <button
              type="button"
              onClick={() => {
                if (selectedCategory && onSelectCategory) onSelectCategory(null);
                if (selectedDate && onClearDate) onClearDate();
              }}
              className="analytics-v2-clear-btn"
              title={selectedCategory ? "Reset category filter" : "Reset day selection"}
              aria-label="Reset selection"
            >
              <RotateCcw size={13} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="analytics-v2-empty-box">
          <div className="analytics-v2-empty-icon">
            <PieChart size={24} strokeWidth={1.75} />
          </div>
          <div className="analytics-v2-empty-title">
            {selectedDate ? 'No spending on this day' : 'No spending yet'}
          </div>
          <div className="analytics-v2-empty-desc">
            {selectedDate
              ? 'No expense transactions recorded on this day.'
              : 'No expenses found for this period. Add expenses to see your category breakdown.'}
          </div>
        </div>
      ) : (
        <>
          {/* Multi-segment Distribution Bar */}
          <div className="analytics-v2-dist-bar-wrapper">
            <div className="analytics-v2-dist-bar">
              {categories.map((item, idx) => {
                const meta = getCatMeta(item.cat);
                const isHovered = isClickable && hoveredCat === item.cat;
                const isSelected = isClickable && selectedCategory === item.cat;
                const isDimmed =
                  isClickable && ((hoveredCat && !isHovered) || (selectedCategory && !isSelected));

                return (
                  <div
                    key={`seg-${item.cat || 'cat'}-${idx}`}
                    className={`analytics-v2-dist-segment ${!isClickable ? 'non-interactive' : ''}`}
                    style={{
                      width: `${Math.max(2, item.pct)}%`,
                      backgroundColor: meta.color,
                      opacity: isDimmed ? 0.35 : 1,
                      transform: isHovered || isSelected ? 'scaleY(1.2)' : 'none',
                    }}
                    onMouseEnter={isClickable && onSelectCategory ? () => setHoveredCat(item.cat) : undefined}
                    onMouseLeave={isClickable && onSelectCategory ? () => setHoveredCat(null) : undefined}
                    onClick={isClickable && onSelectCategory ? () => onSelectCategory(isSelected ? null : item.cat) : undefined}
                    title={`${item.cat}: ${Math.round(item.pct)}% (${fmtMoney(item.amount, currency)})`}
                  />
                );
              })}
            </div>
          </div>

          {/* Category List */}
          <div className="analytics-v2-category-list">
            {visibleCategories.map((item, idx) => {
              const meta = getCatMeta(item.cat);
              const isSelected = isClickable && selectedCategory === item.cat;
              const isHovered = isClickable && hoveredCat === item.cat;

              return (
                <div
                  key={`cat-${item.cat || 'cat'}-${idx}`}
                  className={`analytics-v2-cat-row ${isSelected ? 'active' : ''} ${
                    isHovered ? 'hovered' : ''
                  } ${!isClickable || !onSelectCategory ? 'non-interactive' : ''}`}
                  onClick={isClickable && onSelectCategory ? () => onSelectCategory(isSelected ? null : item.cat) : undefined}
                  onMouseEnter={isClickable && onSelectCategory ? () => setHoveredCat(item.cat) : undefined}
                  onMouseLeave={isClickable && onSelectCategory ? () => setHoveredCat(null) : undefined}
                  role={isClickable && onSelectCategory ? 'button' : undefined}
                  tabIndex={isClickable && onSelectCategory ? 0 : undefined}
                >
                  <div className="analytics-v2-cat-left">
                    {/* Icon avatar */}
                    <div
                      className="analytics-v2-cat-icon-wrap"
                      style={{
                        backgroundColor: `${meta.color}18`,
                        color: meta.color,
                      }}
                    >
                      <CategoryIcon
                        category={item.cat}
                        icon={meta.icon}
                        size={17}
                        style={{ color: meta.color }}
                      />
                    </div>

                    {/* Name & Count */}
                    <div className="analytics-v2-cat-name-group">
                      <span className="analytics-v2-cat-name">{item.cat}</span>
                      <span className="analytics-v2-cat-count">
                        {item.count} {item.count === 1 ? 'transaction' : 'transactions'}
                      </span>
                    </div>
                  </div>

                  {/* Right side: Amount & Percent */}
                  <div className="analytics-v2-cat-right">
                    <span className="analytics-v2-cat-amount" title={fmtMoney(item.amount, currency)}>
                      <span className="cat-amount-full">{fmtMoney(item.amount, currency)}</span>
                      <span className="cat-amount-compact">{fmtMoneyCompact(item.amount, currency)}</span>
                    </span>
                    <span className="analytics-v2-cat-pct">
                      {Math.round(item.pct)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show more/less button */}
          {hasMore && (
            <button
              type="button"
              className="analytics-v2-show-more-btn"
              onClick={() => setExpanded(!expanded)}
            >
              <span>{expanded ? 'Show fewer categories' : `Show all ${categories.length} categories`}</span>
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default CategoryDistributionCard;
