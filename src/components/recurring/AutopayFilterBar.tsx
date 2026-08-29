import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Search,
  RefreshCw,
  Zap,
  Calendar,
  Layers,
  ArrowUpDown,
  AlertTriangle,
  Play,
  Pause,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { showSoftKeyboard } from '../../utils/keyboard';
import type { RecurringKind } from '../../types';
import { fmtMoney } from '../../utils';

export type AutopayStatusFilter = 'all' | 'active' | 'paused' | 'due';
export type AutopayFreqFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type AutopaySortOption = 'due_asc' | 'amount_desc' | 'amount_asc' | 'name_asc' | 'recent';

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
  totalMonthlySpend: number;
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
  totalMonthlySpend,
  currency = 'USD',
}) => {
  const [showStats, setShowStats] = useState(false);
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

  if (!showFilters) return null;

  return createPortal(
    <div
      className="filter-drawer-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) setShowFilters(false);
      }}
    >
      <div className="filter-drawer-panel">
        {/* Mobile Grab Handle */}
        <div
          className="mobile-only"
          style={{
            width: '100%',
            paddingTop: '10px',
            paddingBottom: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--surface)',
          }}
        >
          <div
            style={{
              width: '36px',
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
            padding: '14px 18px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--surface)',
            flexShrink: 0,
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'var(--surface2)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent)',
                flexShrink: 0,
              }}
            >
              <SlidersHorizontal size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 650, color: 'var(--text)', lineHeight: 1.2 }}>
                Filters & Search
              </div>
              {activeFilterCount > 0 && (
                <div style={{ fontSize: '11.5px', color: 'var(--accent)', fontWeight: 500 }}>
                  {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
                  padding: '4px 6px',
                  borderRadius: 6,
                }}
              >
                <RotateCcw size={12} />
                <span className="desktop-only">Reset</span>
              </button>
            )}

            {/* Spend Breakdown Toggle */}
            <button
              type="button"
              onClick={() => setShowStats(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 9px',
                borderRadius: 8,
                backgroundColor: showStats ? 'var(--accent-soft)' : 'var(--surface2)',
                border: showStats ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: showStats ? 'var(--accent)' : 'var(--text-2)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Toggle Spend Breakdown"
            >
              <BarChart3 size={14} style={{ flexShrink: 0 }} />
              <span>Spend</span>
              {showStats ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {/* Close Button */}
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
          className="filter-drawer-content no-scrollbar"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Collapsible Spend Summary inside Drawer */}
          {showStats && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '12px',
                backgroundColor: 'var(--surface2)',
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)' }}>
                  Subscription Spend Summary
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>
                  {counts.all} total recurring rules
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>Projected Monthly</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                    {fmtMoney(totalMonthlySpend, currency)}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>Due / Overdue Bills</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: counts.due > 0 ? '#ef4444' : 'var(--text-2)', marginTop: 2 }}>
                    {counts.due} bill{counts.due === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Input Filter */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Search
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '7px 10px',
              }}
            >
              <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
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
                  fontSize: '12.5px',
                  color: 'var(--text)',
                  width: '100%',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Rule Kind Filter */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Rule Type
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 6,
                backgroundColor: 'var(--surface2)',
                padding: 4,
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            >
              {[
                { id: 'autopay' as const, label: 'Subscriptions', icon: <RefreshCw size={13} />, count: counts.autopay },
                { id: 'quick_log' as const, label: 'Custom', icon: <Zap size={13} />, count: counts.quick_log },
              ].map(tab => {
                const isSelected = kindFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setKindFilter(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '7px 4px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid var(--accent-border-soft, var(--accent))' : '1px solid transparent',
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 650 : 500,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 1px 3px var(--accent-soft)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {React.cloneElement(tab.icon, {
                      style: { color: isSelected ? 'var(--accent)' : 'var(--text-3)' }
                    })}
                    <span>{tab.label}</span>
                    <span style={{ fontSize: '10px', opacity: isSelected ? 0.95 : 0.6 }}>({tab.count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Section */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Status
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {[
                { id: 'all' as AutopayStatusFilter, label: 'All Statuses', icon: <Layers size={13} /> },
                { id: 'active' as AutopayStatusFilter, label: 'Active Only', icon: <Play size={13} style={{ color: 'var(--credit)' }} /> },
                { id: 'due' as AutopayStatusFilter, label: 'Due / Overdue', icon: <AlertTriangle size={13} style={{ color: '#ef4444' }} /> },
                { id: 'paused' as AutopayStatusFilter, label: 'Paused', icon: <Pause size={13} style={{ color: 'var(--text-3)' }} /> },
              ].map(opt => {
                const isSelected = statusFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatusFilter(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                      border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {opt.icon}
                      <div style={{ fontSize: '12px', fontWeight: isSelected ? 650 : 500, color: isSelected ? 'var(--accent)' : 'inherit' }}>
                        {opt.label}
                      </div>
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frequency Filter */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Frequency
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                      border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 650 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort Order Section */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Sort Order
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { id: 'due_asc' as AutopaySortOption, label: 'Next Due Date (Soonest First)', icon: <Calendar size={13} /> },
                { id: 'amount_desc' as AutopaySortOption, label: 'Amount: High to Low', icon: <ArrowUpDown size={13} /> },
                { id: 'amount_asc' as AutopaySortOption, label: 'Amount: Low to High', icon: <ArrowUpDown size={13} /> },
                { id: 'name_asc' as AutopaySortOption, label: 'Title (A to Z)', icon: <ArrowUpDown size={13} /> },
                { id: 'recent' as AutopaySortOption, label: 'Recently Logged', icon: <Calendar size={13} /> },
              ].map(opt => {
                const isSelected = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'transparent',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {opt.icon}
                      <span style={{ fontSize: '12.5px', fontWeight: isSelected ? 650 : 500 }}>
                        {opt.label}
                      </span>
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--surface)',
            borderTop: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {activeFilterCount > 0 ? (
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
                padding: '6px 8px',
              }}
            >
              Reset Filters
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowFilters(false)}
            style={{
              padding: '0 20px',
              height: '36px',
              fontSize: '13px',
              fontWeight: 650,
              borderRadius: '9px',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AutopayFilterBar;
