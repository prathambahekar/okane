import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  X,
  Filter,
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

  // Lock body scroll when filters drawer is open on mobile/desktop
  useEffect(() => {
    if (showFilters) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showFilters]);

  return createPortal(
    <AnimatePresence>
      {showFilters && (
        <div className="modal-backdrop-motion">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="modal-backdrop-overlay"
            onClick={() => setShowFilters(false)}
          />

          {/* Sheet panel / Desktop center dialog */}
          <motion.div
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: isMobile ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="filter-drawer-panel modal-dialog-panel"
          >
            {/* Top Drag Handle Pill */}
            <div className="modal-drag-handle" />

        {/* Drawer Header */}
        <div
          style={{
            padding: '16px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              <Filter size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                Filters & Sorting
              </div>
              {activeFilterCount > 0 ? (
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 550, marginTop: 2 }}>
                  {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                </div>
              ) : (
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>
                  Refine transaction view
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {toggleAllDateCollapse && (
              <button
                type="button"
                onClick={() => {
                  toggleAllDateCollapse();
                  setShowFilters(false);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
                  transition: 'all 0.15s ease',
                }}
                title={allCollapsed ? 'Expand all date groups' : 'Collapse all date groups'}
                aria-label={allCollapsed ? 'Expand all date groups' : 'Collapse all date groups'}
              >
                <ChevronsUpDown size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFilters(false)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
              aria-label="Close filters"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Filter Options */}
        <div
          className="filter-drawer-content no-scrollbar"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Section 1: Money Flow */}
          <div>
            <div
              style={{
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: 'var(--text-3)',
                marginBottom: 10,
              }}
            >
              Transaction Flow
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { id: '', label: 'All', icon: Layers },
                { id: 'out', label: 'Spent', icon: ArrowUpRight, color: 'var(--debit)' },
                { id: 'in', label: 'Received', icon: ArrowDownLeft, color: 'var(--credit)' },
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
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: isSelected ? 700 : 550,
                      backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={14} style={{ color: isSelected ? 'var(--accent-contrast)' : f.color || 'var(--text-3)' }} />
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
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: 'var(--text-3)',
                marginBottom: 10,
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
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: isSelected ? 700 : 550,
                      backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{s.label}</span>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent-contrast)' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Categories */}
          <div>
            <div
              style={{
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: 'var(--text-3)',
                marginBottom: 10,
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
                    color: 'var(--text-2)',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Clear Category
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '1px' }}>
              <button
                type="button"
                onClick={() => setCatFilter('')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: catFilter === '' ? 700 : 550,
                  backgroundColor: catFilter === '' ? 'var(--accent)' : 'var(--surface2)',
                  color: catFilter === '' ? 'var(--accent-contrast)' : 'var(--text-2)',
                  border: catFilter === '' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  boxShadow: catFilter === '' ? '0 2px 8px var(--accent-soft)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Sparkles size={13} />
                <span>All Categories</span>
              </button>

              {categories
                .filter((c) => c.name.toLowerCase() !== 'refund' && c.name.toLowerCase() !== 'transfer')
                .map((c, idx) => {
                const isSelected = catFilter === c.name;
                return (
                  <button
                    key={`${c.name}-${idx}`}
                    type="button"
                    onClick={() => setCatFilter(isSelected ? '' : c.name)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: isSelected ? 700 : 550,
                      backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
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
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: 'var(--text-3)',
                marginBottom: 10,
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
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: isSelected ? 700 : 550,
                      backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{t.label}</span>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent-contrast)' }} />}
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
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: 'var(--text-3)',
                  marginBottom: 10,
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
                      color: 'var(--text-2)',
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear Wallet
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
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: walletFilter === '' ? 700 : 550,
                    backgroundColor: walletFilter === '' ? 'var(--accent)' : 'var(--surface2)',
                    color: walletFilter === '' ? 'var(--accent-contrast)' : 'var(--text-2)',
                    border: walletFilter === '' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    boxShadow: walletFilter === '' ? '0 2px 8px var(--accent-soft)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
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
                        padding: '7px 14px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: isSelected ? 700 : 550,
                        backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                        color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                        boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
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

        {/* Drawer Sticky Footer: 2 Action Buttons (Clear & Filter) */}
        <div
          style={{
            padding: '12px 18px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: 'var(--surface)',
            flexShrink: 0,
            paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 16px)' : '16px',
          }}
        >
          <button
            type="button"
            onClick={onClearAll}
            disabled={activeFilterCount === 0}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 650,
              backgroundColor: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: activeFilterCount > 0 ? 'var(--text)' : 'var(--text-3)',
              cursor: activeFilterCount > 0 ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: activeFilterCount > 0 ? 1 : 0.5,
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={14} />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(false)}
            style={{
              flex: 1.6,
              height: 44,
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
              border: 'none',
              boxShadow: '0 3px 12px var(--accent-soft)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>Apply</span>
            {filteredCount !== undefined && (
              <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.85, fontWeight: 600 }}>({filteredCount})</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>,
document.body
  );
};
export default ExpenseFilterBar;
