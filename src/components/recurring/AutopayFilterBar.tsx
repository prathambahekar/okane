import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  X,
  Filter,
  RotateCcw,
  Check,
  Search,
  RefreshCw,
  Zap,
  Layers,
  AlertTriangle,
  Play,
  Pause,
} from 'lucide-react';
import { showSoftKeyboard } from '../../utils/keyboard';
import type { RecurringKind } from '../../types';

export type AutopayStatusFilter = 'all' | 'active' | 'paused' | 'due';
export type AutopayFreqFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type AutopaySortOption = 'due_asc' | 'recent' | 'amount_desc' | 'amount_asc' | 'name_asc';

interface Props {
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  kindFilter: RecurringKind;
  setKindFilter: (k: RecurringKind) => void;
  statusFilter: AutopayStatusFilter;
  setStatusFilter: (s: AutopayStatusFilter) => void;
  freqFilter: AutopayFreqFilter;
  setFreqFilter: (f: AutopayFreqFilter) => void;
  sortBy: AutopaySortOption;
  setSortBy: (s: AutopaySortOption) => void;
  search: string;
  setSearch: (s: string) => void;
  activeFilterCount: number;
  onClearAll: () => void;
  counts: {
    all: number;
    autopay: number;
    quick_log: number;
    due: number;
    paused: number;
  };
  filteredCount?: number;
  totalMonthlySpend?: number;
  currency?: string;
}

export const AutopayFilterBar: React.FC<Props> = ({
  showFilters,
  setShowFilters,
  kindFilter,
  setKindFilter,
  statusFilter,
  setStatusFilter,
  freqFilter,
  setFreqFilter,
  sortBy,
  setSortBy,
  search,
  setSearch,
  activeFilterCount,
  onClearAll,
  counts,
  filteredCount,
}) => {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when autopay filters drawer opens
  useEffect(() => {
    if (showFilters) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          showSoftKeyboard(searchInputRef.current, { placeCursorAtEnd: true, scroll: true });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showFilters]);

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

  // Lock body scroll when filters drawer is open
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
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                    Filters & Sorting
                  </div>
                  {activeFilterCount > 0 ? (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: 550, marginTop: 2 }}>
                      {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>
                      Refine subscriptions
                    </div>
                  )}
                </div>
              </div>

              {/* Header Right: Close Button only (Spend toggle removed) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              {/* Section 1: Search */}
              <div>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: 'var(--text-3)',
                    marginBottom: 10,
                  }}
                >
                  Search
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <Search size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by title, category, or note..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '13px',
                      color: 'var(--text)',
                      width: '100%',
                      fontFamily: 'inherit',
                    }}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        searchInputRef.current?.focus();
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-3)',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 4,
                      }}
                      aria-label="Clear search text"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Section 2: Rule Type (Discrete cards in grid, NO split lines) */}
              <div>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: 'var(--text-3)',
                    marginBottom: 10,
                  }}
                >
                  Rule Type
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[
                    { id: 'autopay' as const, label: 'Subscriptions', icon: RefreshCw, count: counts.autopay },
                    { id: 'quick_log' as const, label: 'Custom', icon: Zap, count: counts.quick_log },
                  ].map(tab => {
                    const isSelected = kindFilter === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setKindFilter(tab.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: '12.5px',
                          fontWeight: isSelected ? 700 : 550,
                          backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                          color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <Icon size={14} style={{ color: isSelected ? 'var(--accent-contrast)' : 'var(--text-3)', flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.label}</span>
                          <span style={{ fontSize: '11px', opacity: isSelected ? 0.9 : 0.65 }}>({tab.count})</span>
                        </div>
                        {isSelected && <Check size={14} style={{ color: 'var(--accent-contrast)', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Status (2x2 grid, NO split lines) */}
              <div>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: 'var(--text-3)',
                    marginBottom: 10,
                  }}
                >
                  Status
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[
                    { id: 'all' as AutopayStatusFilter, label: 'All Statuses', icon: Layers },
                    { id: 'active' as AutopayStatusFilter, label: 'Active Only', icon: Play, color: 'var(--credit, #22c55e)' },
                    { id: 'due' as AutopayStatusFilter, label: 'Due / Overdue', icon: AlertTriangle, color: '#ef4444' },
                    { id: 'paused' as AutopayStatusFilter, label: 'Paused', icon: Pause, color: 'var(--text-3)' },
                  ].map(opt => {
                    const isSelected = statusFilter === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStatusFilter(opt.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: '12.5px',
                          fontWeight: isSelected ? 700 : 550,
                          backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                          color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <Icon size={14} style={{ color: isSelected ? 'var(--accent-contrast)' : opt.color || 'var(--text-3)', flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                        </div>
                        {isSelected && <Check size={14} style={{ color: 'var(--accent-contrast)', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 4: Frequency (Wrap pills, NO split lines) */}
              <div>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: 'var(--text-3)',
                    marginBottom: 10,
                  }}
                >
                  Frequency
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '1px' }}>
                  {[
                    { id: 'all' as AutopayFreqFilter, label: 'All Frequencies' },
                    { id: 'daily' as AutopayFreqFilter, label: 'Daily' },
                    { id: 'weekly' as AutopayFreqFilter, label: 'Weekly' },
                    { id: 'monthly' as AutopayFreqFilter, label: 'Monthly' },
                    { id: 'yearly' as AutopayFreqFilter, label: 'Yearly' },
                  ].map(opt => {
                    const isSelected = freqFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFreqFilter(opt.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 14px',
                          borderRadius: 9999,
                          fontSize: '12.5px',
                          fontWeight: isSelected ? 700 : 550,
                          backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                          color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 5: Sort Order (2-column grid, NO split lines) */}
              <div>
                <div
                  style={{
                    fontSize: '11.5px',
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
                    { id: 'due_asc' as AutopaySortOption, label: 'Next Due Date' },
                    { id: 'recent' as AutopaySortOption, label: 'Recently Added' },
                    { id: 'amount_desc' as AutopaySortOption, label: 'Highest Amount' },
                    { id: 'amount_asc' as AutopaySortOption, label: 'Lowest Amount' },
                    { id: 'name_asc' as AutopaySortOption, label: 'Title (A to Z)', fullWidth: true },
                  ].map(s => {
                    const isSelected = sortBy === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSortBy(s.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: '12.5px',
                          fontWeight: isSelected ? 700 : 550,
                          backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface2)',
                          color: isSelected ? 'var(--accent-contrast)' : 'var(--text-2)',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          boxShadow: isSelected ? '0 2px 8px var(--accent-soft)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          gridColumn: s.fullWidth ? '1 / -1' : undefined,
                        }}
                      >
                        <span>{s.label}</span>
                        {isSelected && <Check size={14} style={{ color: 'var(--accent-contrast)' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Drawer Sticky Footer: Clear & Apply buttons */}
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
                disabled={activeFilterCount === 0 && !search}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 9999,
                  fontSize: '13.5px',
                  fontWeight: 650,
                  backgroundColor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: (activeFilterCount > 0 || search) ? 'var(--text)' : 'var(--text-3)',
                  cursor: (activeFilterCount > 0 || search) ? 'pointer' : 'default',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: (activeFilterCount > 0 || search) ? 1 : 0.5,
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
                  borderRadius: 9999,
                  fontSize: '13.5px',
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
                  <span style={{ fontSize: '12px', opacity: 0.85, fontWeight: 600 }}>({filteredCount})</span>
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

export default AutopayFilterBar;
