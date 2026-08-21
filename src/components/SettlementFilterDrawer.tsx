import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  X,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  Search,
} from 'lucide-react';
import type { Friend } from '../types';
import type { SettlementTimeframe } from '../views/Settlements';
import { friendInitial, getAvatarStyle } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  viewMode?: 'detailed' | 'compact';
  setViewMode?: (v: 'detailed' | 'compact') => void;
  typeFilter: 'all' | 'received' | 'paid';
  setTypeFilter: (t: 'all' | 'received' | 'paid') => void;
  timeframe: SettlementTimeframe;
  setTimeframe: (t: SettlementTimeframe) => void;
  friendFilter: string;
  setFriendFilter: (f: string) => void;
  timeframeFriends: Array<{ friend: Friend; count: number }>;
  totalTimeframeCount: number;
  filteredCount: number;
  onResetFilters: () => void;
  activeFilterCount: number;
}

export const SettlementFilterDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  typeFilter,
  setTypeFilter,
  timeframe,
  setTimeframe,
  friendFilter,
  setFriendFilter,
  timeframeFriends,
  totalTimeframeCount,
  filteredCount,
  onResetFilters,
  activeFilterCount,
}) => {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [friendSearch, setFriendSearch] = useState('');

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const timeframeOptions: Array<{ id: SettlementTimeframe; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'last_3_months', label: 'Last 3 Months' },
    { id: 'this_year', label: 'This Year' },
    { id: 'all', label: 'All Time' },
  ];

  const filteredFriendList = timeframeFriends.filter(({ friend }) =>
    friend.name.toLowerCase().includes(friendSearch.trim().toLowerCase())
  );

  return createPortal(
    <div
      className="filter-drawer-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settlement-filter-title"
    >
      <div className="filter-drawer-panel" style={{ maxHeight: isMobile ? '88vh' : '82vh' }}>
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
            padding: '16px 20px 8px',
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
                width: 34,
                height: 34,
                borderRadius: 9,
                backgroundColor: 'var(--accent-soft)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent)',
              }}
            >
              <SlidersHorizontal size={17} strokeWidth={2.2} />
            </div>
            <div>
              <div
                id="settlement-filter-title"
                style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}
              >
                Filter Settlements
              </div>
              <div style={{ fontSize: '11.5px', color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-3)', fontWeight: 500 }}>
                {activeFilterCount > 0
                  ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
                  : 'Customize layout & filter records'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onResetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-2)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 8px',
                  borderRadius: 6,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
              >
                <RotateCcw size={12.5} />
                <span>Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface2)',
                color: 'var(--text-2)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Close filter drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="filter-drawer-content" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* SECTION 1: TRANSACTION TYPE (ALL, RECEIVED, PAID) */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-3)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <TrendingUp size={13} />
                <span>Transaction Flow</span>
              </div>
              {typeFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
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
                  Reset
                </button>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                backgroundColor: 'var(--surface2)',
                padding: 4,
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '8px 6px',
                  borderRadius: 9,
                  border: 'none',
                  backgroundColor: typeFilter === 'all' ? 'var(--surface)' : 'transparent',
                  color: typeFilter === 'all' ? 'var(--text)' : 'var(--text-2)',
                  fontSize: '12.5px',
                  fontWeight: typeFilter === 'all' ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: typeFilter === 'all' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>All</span>
              </button>

              <button
                type="button"
                onClick={() => setTypeFilter('received')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '8px 6px',
                  borderRadius: 9,
                  border: 'none',
                  backgroundColor: typeFilter === 'received' ? 'var(--credit-bg)' : 'transparent',
                  color: typeFilter === 'received' ? 'var(--credit)' : 'var(--text-2)',
                  fontSize: '12.5px',
                  fontWeight: typeFilter === 'received' ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: typeFilter === 'received' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <TrendingUp size={13} strokeWidth={2.4} />
                <span>Received</span>
              </button>

              <button
                type="button"
                onClick={() => setTypeFilter('paid')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '8px 6px',
                  borderRadius: 9,
                  border: 'none',
                  backgroundColor: typeFilter === 'paid' ? 'var(--debit-bg)' : 'transparent',
                  color: typeFilter === 'paid' ? 'var(--debit)' : 'var(--text-2)',
                  fontSize: '12.5px',
                  fontWeight: typeFilter === 'paid' ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: typeFilter === 'paid' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <TrendingDown size={13} strokeWidth={2.4} />
                <span>Paid</span>
              </button>
            </div>
          </div>

          {/* SECTION 3: TIMEFRAME */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-3)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={13} />
                <span>Timeframe</span>
              </div>
              {timeframe !== 'this_month' && (
                <button
                  type="button"
                  onClick={() => setTimeframe('this_month')}
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
                  Reset
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {timeframeOptions.map(opt => {
                const isSelected = timeframe === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTimeframe(opt.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 18,
                      border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected && <Check size={12} strokeWidth={2.8} />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: FRIENDS FILTER */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-3)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Users size={13} />
                <span>Friend ({timeframeFriends.length})</span>
              </div>
              {friendFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFriendFilter('all')}
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
                  Clear friend
                </button>
              )}
            </div>

            {/* Optional Friend Search if there are many friends */}
            {timeframeFriends.length > 5 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0 8px',
                  height: 32,
                  marginBottom: 10,
                }}
              >
                <Search size={12.5} style={{ color: 'var(--text-3)', marginRight: 6 }} />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  placeholder="Find friend..."
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '12px',
                    color: 'var(--text)',
                  }}
                />
                {friendSearch && (
                  <button
                    type="button"
                    onClick={() => setFriendSearch('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: '180px', overflowY: 'auto' }}>
              {/* All Friends Option */}
              <button
                type="button"
                onClick={() => setFriendFilter('all')}
                style={{
                  border: friendFilter === 'all' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: friendFilter === 'all' ? 'var(--accent-soft)' : 'var(--surface2)',
                  color: friendFilter === 'all' ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 12,
                  fontWeight: friendFilter === 'all' ? 700 : 500,
                  padding: '5px 11px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Users size={13} strokeWidth={2.4} />
                <span>All Friends</span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 99,
                    background: friendFilter === 'all' ? 'var(--accent)' : 'var(--surface3)',
                    color: friendFilter === 'all' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                  }}
                >
                  {totalTimeframeCount}
                </span>
              </button>

              {/* Individual Friend Chips */}
              {filteredFriendList.map(({ friend: f, count }) => {
                const isActive = friendFilter === f.id;
                const avatar = getAvatarStyle(f.color);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFriendFilter(f.id)}
                    style={{
                      border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: isActive ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: isActive ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      padding: '4px 10px',
                      borderRadius: 20,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: avatar.background,
                        color: avatar.color,
                        fontSize: '9px',
                        fontWeight: 700,
                        display: 'grid',
                        placeItems: 'center',
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      {friendInitial(f.name, f.avatarNumber)}
                    </span>
                    <span>{f.name}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 99,
                        background: isActive ? 'var(--accent)' : 'var(--surface3)',
                        color: isActive ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {filteredFriendList.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-3)', padding: '6px 2px' }}>
                  No friends matched &ldquo;{friendSearch}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Sticky Footer */}
        <div
          style={{
            padding: '12px 20px 16px',
            backgroundColor: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            Showing <strong style={{ color: 'var(--text)' }}>{filteredCount}</strong> result{filteredCount === 1 ? '' : 's'}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 10,
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast, #ffffff)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px var(--accent-soft)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SettlementFilterDrawer;
