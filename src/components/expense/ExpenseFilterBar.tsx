import React, { useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  X,
  SlidersHorizontal,
  RotateCcw,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  Wallet as WalletIcon,
  Sparkles,
  ChevronsUpDown,
} from 'lucide-react';
import type { Category, Wallet } from '../../types';
import CategoryIcon from '../CategoryIcon';

interface Props {
  search?: string;
  setSearch?: (s: string) => void;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  activeFilterCount: number;
  catFilter: string;
  setCatFilter: (c: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  walletFilter: string;
  setWalletFilter: (w: string) => void;
  sort: string;
  setSort: (s: string) => void;
  statusFilter?: string;
  setStatusFilter?: (s: string) => void;
  flowFilter: string;
  setFlowFilter: (f: string) => void;
  categories: Category[];
  wallets: Wallet[];
  onClearAll: () => void;
  filteredCount?: number;
  allCollapsed?: boolean;
  toggleAllDateCollapse?: () => void;
}

export const ExpenseFilterBar: React.FC<Props> = ({
  showFilters,
  setShowFilters,
  activeFilterCount,
  catFilter,
  setCatFilter,
  typeFilter,
  setTypeFilter,
  walletFilter,
  setWalletFilter,
  sort,
  setSort,
  flowFilter,
  setFlowFilter,
  categories,
  wallets,
  onClearAll,
  filteredCount,
  allCollapsed,
  toggleAllDateCollapse,
}) => {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFilters) {
        setShowFilters(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilters, setShowFilters]);

  if (!showFilters) return null;

  return (
    <div
      className="filter-drawer-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) setShowFilters(false);
      }}
    >
      <div className="filter-drawer-panel">
        {/* Mobile Grab Handle */}
        <div
          style={{
            width: '100%',
            paddingTop: '12px',
            paddingBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--surface)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '999px',
              backgroundColor: 'var(--text-3)',
              opacity: 0.4,
              margin: '0 auto',
            }}
          />
        </div>

        {/* Drawer Header */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'var(--surface2)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent)',
              }}
            >
              <SlidersHorizontal size={16} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 650, color: 'var(--text)', lineHeight: 1.2 }}>
                Filters & Sorting
              </div>
              {activeFilterCount > 0 && (
                <div style={{ fontSize: '11.5px', color: 'var(--accent)', fontWeight: 500 }}>
                  {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 6,
                }}
              >
                <RotateCcw size={12} />
                <span>Reset all</span>
              </button>
            )}

            {toggleAllDateCollapse && (
              <button
                type="button"
                onClick={toggleAllDateCollapse}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 32,
                  padding: '0 10px',
                  borderRadius: 8,
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={allCollapsed ? 'Expand all date groups' : 'Collapse all date groups'}
              >
                <ChevronsUpDown size={14} />
                <span>{allCollapsed ? 'Expand All' : 'Collapse All'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFilters(false)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                padding: 0,
              }}
              aria-label="Close filters"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Filter Options */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Section 1: Money Flow */}
          <div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--text-3)',
                marginBottom: 8,
              }}
            >
              Transaction Flow
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { id: '', label: 'All', icon: Layers },
                { id: 'out', label: 'Spent', icon: ArrowUpRight, color: 'var(--debit, #ef4444)' },
                { id: 'in', label: 'Received', icon: ArrowDownLeft, color: 'var(--credit, #22c55e)' },
              ].map(f => {
                const isSelected = flowFilter === f.id;
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFlowFilter(f.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '9px 8px',
                      borderRadius: 10,
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 650 : 500,
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={14} style={{ color: isSelected ? 'var(--accent)' : f.color || 'var(--text-3)' }} />
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Sort By */}
          <div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--text-3)',
                marginBottom: 8,
              }}
            >
              Sort Order
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { id: 'date-desc', label: 'Latest Date' },
                { id: 'date-asc', label: 'Oldest Date' },
                { id: 'amount-desc', label: 'Highest Amount' },
                { id: 'amount-asc', label: 'Lowest Amount' },
              ].map(s => {
                const isSelected = sort === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSort(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 650 : 500,
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{s.label}</span>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Categories */}
          <div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--text-3)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Category</span>
              {catFilter && (
                <button
                  type="button"
                  onClick={() => setCatFilter('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 180, overflowY: 'auto', padding: '1px' }}>
              <button
                type="button"
                onClick={() => setCatFilter('')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: '12px',
                  fontWeight: catFilter === '' ? 650 : 500,
                  backgroundColor: catFilter === '' ? 'var(--accent-soft)' : 'var(--surface2)',
                  color: catFilter === '' ? 'var(--accent)' : 'var(--text-2)',
                  border: catFilter === '' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={13} />
                <span>All Categories</span>
              </button>

              {categories.map(c => {
                const isSelected = catFilter === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setCatFilter(isSelected ? '' : c.name)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: '12px',
                      fontWeight: isSelected ? 650 : 500,
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <CategoryIcon category={c.name} size={14} />
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Transaction Type */}
          <div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--text-3)',
                marginBottom: 8,
              }}
            >
              Transaction Type
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { id: '', label: 'All Types' },
                { id: 'personal', label: 'Personal' },
                { id: 'for_friend', label: 'Paid For Friend' },
                { id: 'by_friend', label: 'Paid By Friend' },
              ].map(t => {
                const isSelected = typeFilter === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeFilter(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 650 : 500,
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{t.label}</span>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5: Wallets */}
          {wallets.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--text-3)',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Wallet / Account</span>
                {walletFilter && (
                  <button
                    type="button"
                    onClick={() => setWalletFilter('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                <button
                  type="button"
                  onClick={() => setWalletFilter('')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: '12px',
                    fontWeight: walletFilter === '' ? 650 : 500,
                    backgroundColor: walletFilter === '' ? 'var(--accent-soft)' : 'var(--surface2)',
                    color: walletFilter === '' ? 'var(--accent)' : 'var(--text-2)',
                    border: walletFilter === '' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <WalletIcon size={13} />
                  <span>All Wallets</span>
                </button>

                {wallets.map(w => {
                  const isSelected = walletFilter === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWalletFilter(isSelected ? '' : w.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 20,
                        fontSize: '12px',
                        fontWeight: isSelected ? 650 : 500,
                        backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                        color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                    >
                      <WalletIcon size={13} />
                      <span>{w.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Sticky Footer */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            backgroundColor: 'var(--surface)',
            paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 14px)' : '12px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            {filteredCount !== undefined ? `${filteredCount} result${filteredCount === 1 ? '' : 's'}` : ''}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowFilters(false)}
            style={{
              flex: isMobile ? 1 : undefined,
              minWidth: 120,
              height: 38,
              fontSize: '13px',
              fontWeight: 600,
              justifyContent: 'center',
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};
export default ExpenseFilterBar;
