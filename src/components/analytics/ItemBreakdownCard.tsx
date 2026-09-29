import React, { useState, useMemo } from 'react';
import {
  Layers,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  TrendingUp,
  Percent,
  ArrowUpRight,
  Users,
  FileText,
} from 'lucide-react';
import { fmtMoney, type GroupedExpense, getGroupedExpenseAmount, type SpendingMode } from '../../utils';
import CategoryIcon from '../CategoryIcon';
import { renderWalletIcon } from '../WalletIconRenderer';
import { useStore } from '../../store';
import type { Category } from '../../types';

export interface ItemBreakdownEntry {
  rawName: string;
  displayName: string;
  category: string;
  totalAmount: number;
  count: number;
  pctOfCategory: number;
  expenses: GroupedExpense[];
}

interface ItemBreakdownCardProps {
  expenses: GroupedExpense[];
  currency: string;
  categorySettings: Category[];
  spendingMode?: SpendingMode;
  onSelectExpense?: (ge: GroupedExpense) => void;
  className?: string;
}

const formatTxDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const ItemBreakdownCard: React.FC<ItemBreakdownCardProps> = ({
  expenses,
  currency,
  categorySettings,
  spendingMode = 'all',
  onSelectExpense,
  className = '',
}) => {
  const { db } = useStore();
  const wallets = db.wallets || [];
  const friends = db.friends || [];

  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedItemName, setExpandedItemName] = useState<string | null>(null);

  // Group outflow expenses by normalized item description and category
  const { items, categoriesWithSpend } = useMemo(() => {
    const itemMap: Record<string, {
      rawName: string;
      displayName: string;
      category: string;
      totalAmount: number;
      count: number;
      expenses: GroupedExpense[];
    }> = {};

    const catSpendMap: Record<string, number> = {};
    let totalOutflow = 0;

    expenses.forEach((ge) => {
      if (ge.flow !== 'out') return;
      if (ge.category === 'Transfer' || ge.category === 'Settlement' || ge.category?.toLowerCase() === 'refund') return;

      const amt = getGroupedExpenseAmount(ge, spendingMode);
      if (amt <= 0) return;

      totalOutflow += amt;
      catSpendMap[ge.category] = (catSpendMap[ge.category] || 0) + amt;

      // Normalize item name (trim whitespace, title case)
      const rawDesc = (ge.description || ge.category || 'Untitled').trim();
      const normKey = `${ge.category}:::${rawDesc.toLowerCase()}`;

      if (!itemMap[normKey]) {
        itemMap[normKey] = {
          rawName: rawDesc,
          displayName: rawDesc.charAt(0).toUpperCase() + rawDesc.slice(1),
          category: ge.category,
          totalAmount: 0,
          count: 0,
          expenses: [],
        };
      }

      itemMap[normKey].totalAmount += amt;
      itemMap[normKey].count += (ge.items && ge.items.length > 0) ? ge.items.length : 1;
      itemMap[normKey].expenses.push(ge);
    });

    const entries: ItemBreakdownEntry[] = Object.values(itemMap).map((entry) => {
      const catTotal = catSpendMap[entry.category] || 1;
      return {
        ...entry,
        pctOfCategory: catTotal > 0 ? (entry.totalAmount / catTotal) * 100 : 0,
      };
    });

    // Sort by total amount descending
    entries.sort((a, b) => b.totalAmount - a.totalAmount);

    const availableCats = Object.entries(catSpendMap)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => ({ cat, total }));

    return {
      items: entries,
      categoriesWithSpend: availableCats,
      totalSpendInScope: totalOutflow,
    };
  }, [expenses, spendingMode]);

  // Filter by selected category & search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCatFilter !== 'all' && item.category !== selectedCatFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.displayName.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, selectedCatFilter, searchQuery]);

  const getCatMeta = (name: string) => {
    const found = categorySettings.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return {
      color: found?.color || '#8B5CF6',
      icon: found?.icon || 'Tag',
    };
  };

  const getFriendNames = (ge: GroupedExpense) => {
    if (!ge.friendIds || ge.friendIds.length === 0) return '';
    const names = ge.friendIds
      .map((id) => friends.find((f) => f.id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) return '';
    if (names.length <= 2) return names.join(', ');
    return `${names[0]} +${names.length - 1}`;
  };

  return (
    <div className={`analytics-v2-card ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Header Row */}
      <div className="analytics-v2-card-header" style={{ marginBottom: 0 }}>
        <div className="analytics-v2-header-left">
          <span className="analytics-v2-header-icon-pill">
            <Layers size={15} strokeWidth={2.2} />
          </span>
          <h2 className="analytics-v2-card-title">Item Breakdown</h2>

          {filteredItems.length > 0 && (
            <span className="analytics-v2-pill-badge">
              <span>{filteredItems.length}</span>
              <span className="analytics-v2-pill-badge-label">
                &nbsp;{filteredItems.length === 1 ? 'item' : 'items'}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Responsive Dedicated Search Bar Row */}
      {items.length > 3 && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              color: 'var(--text-3)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search items by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: 38,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              paddingLeft: 36,
              paddingRight: searchQuery ? 34 : 14,
              fontSize: 'var(--fs-sm)',
              color: 'var(--text)',
              outline: 'none',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 8,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-3)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-full)',
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* 3. Category Filter Chips */}
      {categoriesWithSpend.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            paddingBottom: 2,
            margin: '0 -2px',
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedCatFilter('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: selectedCatFilter === 'all' ? '1px solid var(--text)' : '1px solid var(--border)',
              background: selectedCatFilter === 'all' ? 'var(--text)' : 'var(--surface2)',
              color: selectedCatFilter === 'all' ? 'var(--surface)' : 'var(--text-2)',
              fontSize: 'var(--fs-sm)',
              fontWeight: selectedCatFilter === 'all' ? 700 : 550,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              boxShadow: selectedCatFilter === 'all' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            All Categories
          </button>

          {categoriesWithSpend.map(({ cat }) => {
            const isSelected = selectedCatFilter === cat;
            const meta = getCatMeta(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCatFilter(isSelected ? 'all' : cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? `1px solid ${meta.color}` : '1px solid var(--border)',
                  background: isSelected ? meta.color : 'var(--surface2)',
                  color: isSelected ? '#ffffff' : 'var(--text-2)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: isSelected ? 700 : 550,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <CategoryIcon
                  category={cat}
                  icon={meta.icon}
                  size={14}
                  style={{ color: isSelected ? '#ffffff' : meta.color }}
                />
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Item List */}
      {filteredItems.length === 0 ? (
        <div
          style={{
            padding: '28px 12px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: 'var(--fs-sm)',
            background: 'var(--surface2)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border)',
          }}
        >
          No items found for this period.
        </div>
      ) : (
        <div className="analytics-v2-category-list" style={{ gap: 4 }}>
          {filteredItems.map((item, idx) => {
            const meta = getCatMeta(item.category);
            const isExpanded = expandedItemName === item.rawName;

            // Compute metrics
            const avgAmount = item.totalAmount / (item.count || 1);

            return (
              <div
                key={`${item.category}-${item.rawName}-${idx}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Seamless item row */}
                <div
                  className="analytics-v2-cat-row"
                  onClick={() => setExpandedItemName(isExpanded ? null : item.rawName)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedItemName(isExpanded ? null : item.rawName);
                    }
                  }}
                  style={{
                    padding: '8px 8px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Left: Icon squircle + Name & Count */}
                  <div className="analytics-v2-cat-left">
                    <div
                      className="analytics-v2-cat-icon-wrap"
                      style={{
                        backgroundColor: `${meta.color}18`,
                        color: meta.color,
                      }}
                    >
                      <CategoryIcon
                        category={item.category}
                        icon={meta.icon}
                        size={17}
                        style={{ color: meta.color }}
                      />
                    </div>

                    <div className="analytics-v2-cat-name-group">
                      <span className="analytics-v2-cat-name">{item.displayName}</span>
                      <span className="analytics-v2-cat-count">
                        {item.count}x{selectedCatFilter === 'all' ? ` • ${item.category}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Right: Amount & Chevron */}
                  <div className="analytics-v2-cat-right">
                    <span className="analytics-v2-cat-amount">
                      {fmtMoney(item.totalAmount, currency)}
                    </span>

                    <span
                      style={{
                        color: 'var(--text-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 4,
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} strokeWidth={2.2} />
                      ) : (
                        <ChevronRight size={16} strokeWidth={2.2} />
                      )}
                    </span>
                  </div>
                </div>

                {/* 🌟 Clean, Minimal & Mobile-Friendly Expanded Section */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 4,
                      marginBottom: 8,
                      padding: '10px 10px',
                      background: 'var(--surface2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      animation: 'popIn 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxSizing: 'border-box',
                      width: '100%',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Minimal Stats Strip (Clean, responsive pills without divider lines) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 6,
                        width: '100%',
                      }}
                    >
                      {/* Average Cost */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--fs-caption)',
                          color: 'var(--text-2)',
                        }}
                      >
                        <TrendingUp size={11} style={{ color: 'var(--text-3)' }} />
                        <span>
                          Avg: <strong style={{ color: 'var(--text)' }}>{fmtMoney(avgAmount, currency)}</strong>
                        </span>
                      </div>

                      {/* Category Share */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--fs-caption)',
                          color: 'var(--text-2)',
                        }}
                      >
                        <Percent size={11} style={{ color: meta.color }} />
                        <span>
                          <strong style={{ color: 'var(--text)' }}>{item.pctOfCategory.toFixed(0)}%</strong> of {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Transaction List (Fully responsive on mobile) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
                      {item.expenses.map((ge, eIdx) => {
                        const wallet = wallets.find((w) => w.id === ge.walletId);
                        const amt = getGroupedExpenseAmount(ge, spendingMode);
                        const friendNames = getFriendNames(ge);
                        const noteText = ge.items[0]?.notes || (ge.description !== item.displayName ? ge.description : '');

                        return (
                          <div
                            key={`${ge.id}-${eIdx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectExpense?.(ge);
                            }}
                            role="button"
                            tabIndex={0}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              cursor: 'pointer',
                              gap: 10,
                              transition: 'all 0.15s ease',
                              boxSizing: 'border-box',
                              width: '100%',
                              minWidth: 0,
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                onSelectExpense?.(ge);
                              }
                            }}
                          >
                            {/* Left details: Date, Wallet badge, Split badges, Notes */}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3,
                                minWidth: 0,
                                flex: 1,
                                overflow: 'hidden',
                              }}
                            >
                              {/* Date row */}
                              <div
                                style={{
                                  fontSize: 'var(--fs-xs)',
                                  fontWeight: 650,
                                  color: 'var(--text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatTxDate(ge.date)}
                              </div>

                              {/* Metadata row */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  flexWrap: 'wrap',
                                  minWidth: 0,
                                  overflow: 'hidden',
                                }}
                              >
                                {/* Wallet Badge */}
                                {wallet && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      fontSize: '11px',
                                      color: 'var(--text-2)',
                                      background: 'var(--surface2)',
                                      border: '1px solid var(--border)',
                                      padding: '1px 6px',
                                      borderRadius: 'var(--radius-full)',
                                      whiteSpace: 'nowrap',
                                      maxWidth: 120,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {renderWalletIcon(wallet.icon || wallet.name || 'cash', 11, wallet.color)}
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{wallet.name}</span>
                                  </span>
                                )}

                                {/* Split badge with friend names */}
                                {ge.isSplit && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: 'var(--amber)',
                                      background: 'var(--amber-bg)',
                                      border: '1px solid var(--amber-border)',
                                      padding: '1px 6px',
                                      borderRadius: 'var(--radius-full)',
                                      whiteSpace: 'nowrap',
                                      maxWidth: 130,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    <Users size={9} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {friendNames ? `Split with ${friendNames}` : 'Split'}
                                    </span>
                                  </span>
                                )}

                                {/* Note preview */}
                                {noteText && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      fontSize: '11px',
                                      color: 'var(--text-3)',
                                      maxWidth: 130,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <FileText size={9} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{noteText}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right details: Amount & Click indicator */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flexShrink: 0,
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span
                                  style={{
                                    fontSize: 'var(--fs-sm)',
                                    fontWeight: 750,
                                    color: 'var(--debit)',
                                    fontVariantNumeric: 'tabular-nums',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {fmtMoney(amt, currency)}
                                </span>
                                {ge.isSplit && spendingMode === 'all' && ge.personalShare > 0 && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                                    Mine: {fmtMoney(ge.personalShare, currency)}
                                  </span>
                                )}
                              </div>

                              <ArrowUpRight size={13} style={{ color: 'var(--text-3)', opacity: 0.6 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ItemBreakdownCard;
