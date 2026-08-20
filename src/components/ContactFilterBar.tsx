import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  X,
  SlidersHorizontal,
  RotateCcw,
  Check,
  User,
  Store,
  Tv,
  ArrowUpDown,
  LayoutGrid,
  List,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Handshake,
  Clock,
  Layers,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ContactType } from '../types';
import { fmtMoney } from '../utils';

export type FriendFilterStatus = 'all' | 'owes_me' | 'i_owe' | 'settled';
export type SortOption = 'owed_desc' | 'owed_asc' | 'name' | 'recent' | 'expenses_count';
export type DensityOption = 'compact' | 'detailed' | 'grid';

interface Props {
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  typeFilter: ContactType;
  setTypeFilter: (t: ContactType) => void;
  statusFilter: FriendFilterStatus;
  setStatusFilter: (s: FriendFilterStatus) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
  density: DensityOption;
  setDensity: (d: DensityOption) => void;
  search: string;
  setSearch: (s: string) => void;
  activeFilterCount: number;
  onClearAll: () => void;
  counts: {
    all: number;
    friend: number;
    vendor: number;
    subscription: number;
  };
  filteredCount: number;
  friendStats?: {
    credit: number;
    debit: number;
    net: number;
  };
  vendorAndSubSpend?: {
    total: number;
    subTotal: number;
  };
  currency?: string;
}

export const ContactFilterBar: React.FC<Props> = ({
  showFilters,
  setShowFilters,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  density,
  setDensity,
  search,
  setSearch,
  activeFilterCount,
  onClearAll,
  counts,
  filteredCount,
  friendStats,
  vendorAndSubSpend,
  currency = 'USD',
}) => {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [showBreakdown, setShowBreakdown] = useState(false);

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
                Filters & Sorting
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

            {/* Full Breakdown Stats Button (on left of close btn) */}
            {friendStats && (
              <button
                type="button"
                onClick={() => setShowBreakdown(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 9px',
                  borderRadius: 8,
                  backgroundColor: showBreakdown ? 'var(--accent-soft)' : 'var(--surface2)',
                  border: showBreakdown ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: showBreakdown ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Toggle Financial Breakdown Stats"
                aria-label="Toggle Financial Breakdown Stats"
              >
                <BarChart3 size={14} style={{ flexShrink: 0 }} />
                <span>Stats</span>
                {showBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}

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
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Collapsible Full Breakdown Stats Panel inside Drawer */}
          {showBreakdown && friendStats && vendorAndSubSpend && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '12px',
                backgroundColor: 'var(--surface2)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                animation: 'fadein 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)' }}>
                  Financial Breakdown Stats
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>
                  {counts.all} total contacts
                </div>
              </div>

              {/* Friends Balance Box */}
              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '12px', fontWeight: 650, color: 'var(--text)' }}>
                    <User size={13} className="text-accent" />
                    <span>Friends Balance Status</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>{counts.friend} friends</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>Owed to You</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--credit)' }}>
                      +{fmtMoney(friendStats.credit, currency)}
                    </div>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>You Owe</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--debit)' }}>
                      -{fmtMoney(Math.abs(friendStats.debit), currency)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vendors & Subscriptions Spend Box */}
              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '12px', fontWeight: 650, color: 'var(--text)' }}>
                    <Store size={13} style={{ color: '#F59E0B' }} />
                    <span>Vendors & Subscriptions Spend</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>{counts.vendor + counts.subscription} contacts</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>Total Spent</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                      {fmtMoney(vendorAndSubSpend.total, currency)}
                    </div>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>Active Subscriptions ({counts.subscription})</div>
                    <div style={{ fontSize: '13px', fontWeight: 650, color: 'var(--text-2)' }}>
                      {fmtMoney(vendorAndSubSpend.subTotal, currency)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Search Input Filter */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Search Contact
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
                type="text"
                placeholder="Search by name, nickname, or category..."
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

          {/* Contact Type Section */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Contact Type
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                backgroundColor: 'var(--surface2)',
                padding: 4,
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            >
              {[
                { id: 'friend' as ContactType, label: 'Friends', icon: <User size={13} />, count: counts.friend },
                { id: 'vendor' as ContactType, label: 'Vendors', icon: <Store size={13} />, count: counts.vendor },
                { id: 'subscription' as ContactType, label: 'Subscriptions', icon: <Tv size={13} />, count: counts.subscription },
              ].map(tab => {
                const isSelected = typeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id)}
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

          {/* Financial Status Section (Only for Friends and Vendors) */}
          {(typeFilter === 'friend' || typeFilter === 'vendor') && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
                Financial Status
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {[
                  { id: 'all' as FriendFilterStatus, label: 'All Contacts', icon: <Layers size={13} />, desc: 'Show all balance states' },
                  { id: 'owes_me' as FriendFilterStatus, label: 'Owes You', icon: <ArrowDownLeft size={13} style={{ color: 'var(--credit)' }} />, desc: 'Has outstanding balance' },
                  { id: 'i_owe' as FriendFilterStatus, label: 'You Owe', icon: <ArrowUpRight size={13} style={{ color: 'var(--debit)' }} />, desc: 'You need to pay back' },
                  { id: 'settled' as FriendFilterStatus, label: 'Settled Up', icon: <Handshake size={13} style={{ color: 'var(--text-2)' }} />, desc: 'Zero balance / all clear' },
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
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: isSelected ? 650 : 500, color: isSelected ? 'var(--accent)' : 'inherit' }}>
                            {opt.label}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sort Order Section */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              Sort Order
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                ...((typeFilter === 'friend' || typeFilter === 'vendor') ? [
                  { id: 'owed_desc' as SortOption, label: 'Highest Owed First', icon: <ArrowDownLeft size={13} style={{ color: 'var(--credit)' }} /> },
                  { id: 'owed_asc' as SortOption, label: 'You Owe Most First', icon: <ArrowUpRight size={13} style={{ color: 'var(--debit)' }} /> },
                ] : []),
                { id: 'name' as SortOption, label: 'Name (A to Z)', icon: <ArrowUpDown size={13} /> },
                { id: 'recent' as SortOption, label: 'Recent Activity', icon: <Clock size={13} /> },
                { id: 'expenses_count' as SortOption, label: 'Most Expenses / Orders', icon: <Layers size={13} /> },
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
                      border: isSelected ? '1px solid var(--accent-border-soft, var(--accent))' : '1px solid transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 650 : 450,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {React.cloneElement(opt.icon, {
                        style: { color: isSelected ? 'var(--accent)' : 'var(--text-3)', ...opt.icon.props.style }
                      })}
                      <span>{opt.label}</span>
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* View Density / Layout Section */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
              View Layout & Density
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                backgroundColor: 'var(--surface2)',
                padding: 4,
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            >
              {[
                { id: 'compact' as DensityOption, label: 'Compact', icon: <List size={14} /> },
                { id: 'detailed' as DensityOption, label: 'Detailed', icon: <SlidersHorizontal size={14} /> },
                { id: 'grid' as DensityOption, label: 'Grid Cards', icon: <LayoutGrid size={14} /> },
              ].map(opt => {
                const isSelected = density === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDensity(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 6px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid var(--accent-border-soft, var(--accent))' : '1px solid transparent',
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 650 : 500,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 1px 3px var(--accent-soft)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {React.cloneElement(opt.icon, {
                      style: { color: isSelected ? 'var(--accent)' : 'var(--text-3)' }
                    })}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Sticky Footer */}
        <div
          style={{
            padding: '10px 18px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--surface)',
            flexShrink: 0,
            paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 14px)' : '14px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            <strong style={{ color: 'var(--text-1)', fontWeight: 650 }}>{filteredCount}</strong> contact{filteredCount === 1 ? '' : 's'}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowFilters(false)}
            style={{
              padding: '8px 24px',
              fontSize: '13px',
              fontWeight: 650,
              borderRadius: '20px',
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ContactFilterBar;
