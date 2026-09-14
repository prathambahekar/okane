import React, { useState } from 'react';
import { PieChart, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { fmtMoney } from '../../utils';
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
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  categorySettings: Category[];
}

export const CategoryDistributionCard: React.FC<CategoryDistributionCardProps> = ({
  categories,
  totalOutflow,
  currency,
  selectedCategory,
  onSelectCategory,
  categorySettings,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  const DISPLAY_LIMIT = 5;
  const visibleCategories = expanded ? categories : categories.slice(0, DISPLAY_LIMIT);
  const hasMore = categories.length > DISPLAY_LIMIT;

  // Find color and icon for a category
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
          <h2 className="analytics-v2-card-title">Category Breakdown</h2>
        </div>

        <div className="analytics-v2-header-right">
          {totalOutflow > 0 && (
            <span className="analytics-v2-header-amount">
              {fmtMoney(totalOutflow, currency)}
            </span>
          )}

          {selectedCategory && (
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className="analytics-v2-clear-btn"
              title="Clear category filter"
              aria-label="Reset category filter"
            >
              <RotateCcw size={13} strokeWidth={2.2} />
              <span className="analytics-v2-btn-label">Reset</span>
            </button>
          )}
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="analytics-v2-empty-box">
          <div className="analytics-v2-empty-icon">
            <PieChart size={24} strokeWidth={1.75} />
          </div>
          <div className="analytics-v2-empty-title">No spending yet</div>
          <div className="analytics-v2-empty-desc">
            No expenses found for this period. Add expenses to see your category breakdown.
          </div>
        </div>
      ) : (
        <>
          {/* Multi-segment Distribution Bar */}
          <div className="analytics-v2-dist-bar-wrapper">
            <div className="analytics-v2-dist-bar">
              {categories.map((item) => {
                const meta = getCatMeta(item.cat);
                const isHovered = hoveredCat === item.cat;
                const isSelected = selectedCategory === item.cat;
                const isDimmed =
                  (hoveredCat && !isHovered) || (selectedCategory && !isSelected);

                return (
                  <div
                    key={item.cat}
                    className="analytics-v2-dist-segment"
                    style={{
                      width: `${Math.max(2, item.pct)}%`,
                      backgroundColor: meta.color,
                      opacity: isDimmed ? 0.35 : 1,
                      transform: isHovered || isSelected ? 'scaleY(1.2)' : 'none',
                    }}
                    onMouseEnter={() => setHoveredCat(item.cat)}
                    onMouseLeave={() => setHoveredCat(null)}
                    onClick={() => onSelectCategory(isSelected ? null : item.cat)}
                    title={`${item.cat}: ${Math.round(item.pct)}% (${fmtMoney(item.amount, currency)})`}
                  />
                );
              })}
            </div>
          </div>

          {/* Category List */}
          <div className="analytics-v2-category-list">
            {visibleCategories.map((item) => {
              const meta = getCatMeta(item.cat);
              const isSelected = selectedCategory === item.cat;
              const isHovered = hoveredCat === item.cat;

              return (
                <div
                  key={item.cat}
                  className={`analytics-v2-cat-row ${isSelected ? 'active' : ''} ${
                    isHovered ? 'hovered' : ''
                  }`}
                  onClick={() => onSelectCategory(isSelected ? null : item.cat)}
                  onMouseEnter={() => setHoveredCat(item.cat)}
                  onMouseLeave={() => setHoveredCat(null)}
                  role="button"
                  tabIndex={0}
                >
                  {/* Top info row */}
                  <div className="analytics-v2-cat-top">
                    <div className="analytics-v2-cat-left">
                      {/* Icon bubble */}
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
                          size={15}
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
                      <span className="analytics-v2-cat-amount">
                        {fmtMoney(item.amount, currency)}
                      </span>
                      <span className="analytics-v2-cat-pct">
                        {Math.round(item.pct)}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="analytics-v2-progress-track">
                    <div
                      className="analytics-v2-progress-fill"
                      style={{
                        width: `${Math.min(100, Math.max(2, item.pct))}%`,
                        backgroundColor: meta.color,
                      }}
                    />
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
