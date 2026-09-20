import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  X,
  Filter,
  RotateCcw,
  Check,
  Users,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
} from 'lucide-react';
import { showSoftKeyboard } from '../utils/keyboard';
import type { Friend } from '../types';
import type { SettlementTimeframe } from '../views/Settlements';
import { friendInitial, getAvatarStyle } from '../utils';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

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
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DRAWER });
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [friendSearch, setFriendSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto focus search when settlement drawer opens and search input exists
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (searchRef.current) {
          showSoftKeyboard(searchRef.current, { placeCursorAtEnd: true, scroll: true });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
            paddingTop: '12px',
            paddingBottom: '6px',
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
              borderRadius: '2px',
              backgroundColor: 'var(--border2)',
              margin: '0 auto',
            }}
          />
        </div>

        {/* Drawer Header */}
        <div
          style={{
            padding: '16px 20px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--surface)',
            borderBottom: 'none',
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
              <Filter size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div
                id="settlement-filter-title"
                style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}
              >
                Filters &amp; Sorting
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
            <button
              type="button"
              onClick={onClose}
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

        {/* Drawer Scrollable Content */}
        <div
          className="filter-drawer-content no-scrollbar"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '4px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* SECTION 1: TRANSACTION FLOW (ALL, RECEIVED, PAID) */}
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
              <span>Transaction Flow</span>
              {typeFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
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
                  Reset
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { id: 'all' as const, label: 'All', icon: Layers },
                { id: 'received' as const, label: 'Received', icon: ArrowDownLeft, color: 'var(--credit)' },
                { id: 'paid' as const, label: 'Paid', icon: ArrowUpRight, color: 'var(--debit)' },
              ].map(f => {
                const isSelected = typeFilter === f.id;
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTypeFilter(f.id)}
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
                    <Icon
                      size={14}
                      style={{ color: isSelected ? 'var(--accent-contrast)' : f.color || 'var(--text-3)' }}
                    />
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: TIMEFRAME */}
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
              <span>Timeframe</span>
              {timeframe !== 'this_month' && (
                <button
                  type="button"
                  onClick={() => setTimeframe('this_month')}
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
                  Reset
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '1px' }}>
              {timeframeOptions.map(opt => {
                const isSelected = timeframe === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTimeframe(opt.id)}
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
                    {isSelected && <Check size={13} style={{ color: 'var(--accent-contrast)' }} />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: FRIENDS FILTER */}
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
              <span>Friend ({timeframeFriends.length})</span>
              {friendFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFriendFilter('all')}
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
                  Clear friend
                </button>
              )}
            </div>

            {/* Friend Search Bar */}
            {timeframeFriends.length > 4 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0 14px',
                  height: 38,
                  marginBottom: 10,
                }}
              >
                <Search size={14} style={{ color: 'var(--text-3)', marginRight: 8, flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  placeholder="Find friend..."
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text)',
                  }}
                />
                {friendSearch && (
                  <button
                    type="button"
                    onClick={() => setFriendSearch('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-3)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: '200px', overflowY: 'auto', padding: '1px' }}>
              {/* All Friends Option */}
              <button
                type="button"
                onClick={() => setFriendFilter('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: friendFilter === 'all' ? 700 : 550,
                  backgroundColor: friendFilter === 'all' ? 'var(--accent)' : 'var(--surface2)',
                  color: friendFilter === 'all' ? 'var(--accent-contrast)' : 'var(--text-2)',
                  border: friendFilter === 'all' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  boxShadow: friendFilter === 'all' ? '0 2px 8px var(--accent-soft)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Users size={13} style={{ color: friendFilter === 'all' ? 'var(--accent-contrast)' : 'var(--text-3)' }} />
                <span>All Friends</span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: friendFilter === 'all' ? 'rgba(255, 255, 255, 0.2)' : 'var(--surface3)',
                    color: friendFilter === 'all' ? 'var(--accent-contrast)' : 'var(--text-3)',
                  }}
                >
                  {totalTimeframeCount}
                </span>
              </button>

              {/* Individual Friend Chips */}
              {filteredFriendList.map(({ friend: f, count }) => {
                const isSelected = friendFilter === f.id;
                const avatar = getAvatarStyle(f.color);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFriendFilter(isSelected ? 'all' : f.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
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
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 'var(--radius-xs)',
                        background: isSelected ? 'rgba(255,255,255,0.25)' : avatar.background,
                        color: isSelected ? '#fff' : avatar.color,
                        fontSize: '9.5px',
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
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'var(--surface3)',
                        color: isSelected ? 'var(--accent-contrast)' : 'var(--text-3)',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {filteredFriendList.length === 0 && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', padding: '6px 2px' }}>
                  No friends matched &ldquo;{friendSearch}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Sticky Footer: 2 Action Buttons (Clear & Apply) */}
        <div
          style={{
            padding: '12px 18px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: 'var(--surface)',
            borderTop: 'none',
            flexShrink: 0,
            paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 16px)' : '16px',
          }}
        >
          <button
            type="button"
            onClick={onResetFilters}
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
            onClick={onClose}
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
      </div>
    </div>,
    document.body
  );
};

export default SettlementFilterDrawer;
