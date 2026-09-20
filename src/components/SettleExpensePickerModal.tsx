import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Check, ReceiptText, Filter, RotateCcw, CheckCheck, Store } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import type { Friend, Expense, AppDB } from '../types';
import { expenseFlow } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, cleanExpenseDescription, resolveCategoryMeta } from '../utils';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

export type ExpenseSortOption = 'date_desc' | 'date_asc' | 'friend_asc' | 'amount_desc' | 'amount_asc';

interface SettleExpensePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  friend: Friend;
  expenses: Expense[];
  selectedIds: Set<string> | string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  currency: string;
  db: AppDB;
  title?: string;
}

export default function SettleExpensePickerModal({
  isOpen,
  onClose,
  friend,
  expenses,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  currency,
  db,
  title = 'Select Expenses to Settle',
}: SettleExpensePickerModalProps) {
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.DIALOG });
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'owed_to_me' | 'owed_by_me'>('all');
  const [friendFilter, setFriendFilter] = useState<string>('all'); // 'all' | 'personal' | friendId
  const [sortBy, setSortBy] = useState<ExpenseSortOption>('date_desc');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const selectedSet = useMemo(() => {
    return selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  }, [selectedIds]);

  const friendsList = useMemo(() => db.friends || [], [db.friends]);
  const friendsMap = useMemo(() => {
    const map = new Map<string, Friend>();
    friendsList.forEach(f => {
      if (f && f.id) map.set(f.id, f);
    });
    return map;
  }, [friendsList]);

  const isVendor = friend.type === 'vendor';

  // Compute friend participants in the current expense set (only for vendor settlements)
  const friendStats = useMemo(() => {
    if (!isVendor) {
      return {
        personalCount: 0,
        personalTotal: 0,
        friends: [],
        hasMultipleParticipants: false,
        hasAnyFriendAttribution: false,
      };
    }
    let personalCount = 0;
    let personalTotal = 0;
    const friendCounts = new Map<string, { friend: Friend; count: number; total: number }>();

    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      // Only count actual distinct other friends (not the vendor itself)
      if (e.friendId && e.friendId !== friend.id && friendsMap.has(e.friendId)) {
        const existing = friendCounts.get(e.friendId);
        if (existing) {
          existing.count += 1;
          existing.total += amt;
        } else {
          friendCounts.set(e.friendId, {
            friend: friendsMap.get(e.friendId)!,
            count: 1,
            total: amt,
          });
        }
      } else {
        personalCount += 1;
        personalTotal += amt;
      }
    });

    return {
      personalCount,
      personalTotal,
      friends: Array.from(friendCounts.values()),
      hasMultipleParticipants: (personalCount > 0 ? 1 : 0) + friendCounts.size > 1,
      hasAnyFriendAttribution: friendCounts.size > 0,
    };
  }, [expenses, friendsMap, isVendor, friend.id]);

  const isOwedToMe = useCallback((e: Expense) => {
    const isIncoming = expenseFlow(e) === 'in';
    const isSettlingVendor = e.vendorId === friend.id;
    const isSettlingFriend = e.friendId === friend.id;

    if (isSettlingVendor) {
      return isIncoming;
    }
    if (isSettlingFriend) {
      if (e.type === 'for_friend') return !isIncoming;
      if (e.type === 'by_friend') return isIncoming;
      if (e.status === 'unpaid') return isIncoming;
    }
    return !isIncoming;
  }, [friend.id]);

  // Helper to get friend name for an expense (only distinct other friends)
  const getExpenseFriend = useCallback((e: Expense): { friend?: Friend; isPersonal: boolean; name: string } => {
    if (e.friendId && e.friendId !== friend.id && friendsMap.has(e.friendId)) {
      const f = friendsMap.get(e.friendId)!;
      return { friend: f, isPersonal: false, name: f.name };
    }
    return { isPersonal: true, name: '' };
  }, [friendsMap, friend.id]);

  // Filtered & Sorted expenses
  const filteredExpenses = useMemo(() => {
    let list = expenses;

    // 1. Flow filter (owed to me / owed by me)
    if (filterType === 'owed_to_me') {
      list = list.filter(isOwedToMe);
    } else if (filterType === 'owed_by_me') {
      list = list.filter(e => !isOwedToMe(e));
    }

    // 2. Friend filter
    if (friendFilter === 'personal') {
      list = list.filter(e => !(e.friendId && e.friendId !== friend.id && friendsMap.has(e.friendId)));
    } else if (friendFilter !== 'all') {
      list = list.filter(e => e.friendId === friendFilter);
    }

    // 3. Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(e => {
        const desc = (e.description || '').toLowerCase();
        const cat = (e.category || '').toLowerCase();
        const date = (e.date || '').toLowerCase();
        const amt = String(e.amount || '');
        const fInfo = getExpenseFriend(e);
        const fName = fInfo.name.toLowerCase();
        return desc.includes(q) || cat.includes(q) || date.includes(q) || amt.includes(q) || fName.includes(q);
      });
    }

    // 4. Sorting
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'date_desc') {
        return (b.originalDate || b.date || '').localeCompare(a.originalDate || a.date || '') || (Number(b.createdAt || 0) - Number(a.createdAt || 0));
      }
      if (sortBy === 'date_asc') {
        return (a.originalDate || a.date || '').localeCompare(b.originalDate || b.date || '') || (Number(a.createdAt || 0) - Number(b.createdAt || 0));
      }
      if (sortBy === 'amount_desc') {
        return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      }
      if (sortBy === 'amount_asc') {
        return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      }
      if (sortBy === 'friend_asc') {
        const nameA = getExpenseFriend(a).name;
        const nameB = getExpenseFriend(b).name;
        return nameA.localeCompare(nameB) || (b.date || '').localeCompare(a.date || '');
      }
      return 0;
    });

    return sorted;
  }, [expenses, filterType, friendFilter, search, isOwedToMe, sortBy, getExpenseFriend, friend.id, friendsMap]);

  // Calculate selected total in modal
  const selectedExpenses = useMemo(() => {
    return expenses.filter(e => selectedSet.has(e.id));
  }, [expenses, selectedSet]);

  const { netTotal } = useMemo(() => {
    let toMe = 0;
    let byMe = 0;
    selectedExpenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      const isIncoming = expenseFlow(e) === 'in';
      const isSettlingVendor = e.vendorId === friend.id;
      const isSettlingFriend = e.friendId === friend.id;

      if (isSettlingVendor) {
        if (isIncoming) toMe += amt;
        else byMe += amt;
      } else if (isSettlingFriend) {
        if (e.type === 'for_friend') {
          if (isIncoming) toMe -= amt;
          else toMe += amt;
        } else if (e.type === 'by_friend') {
          if (isIncoming) byMe -= amt;
          else byMe += amt;
        } else if (e.status === 'unpaid') {
          if (isIncoming) toMe += amt;
          else byMe += amt;
        }
      } else {
        if (isIncoming) toMe += amt;
        else byMe += amt;
      }
    });
    return { netTotal: toMe - byMe };
  }, [selectedExpenses, friend.id]);

  const absNet = Math.abs(netTotal);

  // Check selection state for current filtered view
  const currentFilteredIds = useMemo(() => filteredExpenses.map(e => e.id), [filteredExpenses]);
  const allFilteredSelected = currentFilteredIds.length > 0 && currentFilteredIds.every(id => selectedSet.has(id));

  // Toggle selection for current filtered items
  const handleToggleCurrentFiltered = () => {
    if (allFilteredSelected) {
      // Deselect all items in current filter
      currentFilteredIds.forEach(id => {
        if (selectedSet.has(id)) {
          onToggle(id);
        }
      });
    } else {
      // Select all items in current filter
      currentFilteredIds.forEach(id => {
        if (!selectedSet.has(id)) {
          onToggle(id);
        }
      });
    }
  };

  const isFilterActive = sortBy !== 'date_desc' || (isVendor && friendFilter !== 'all');

  if (!isOpen) return null;

  return createPortal(
    <div className="friend-picker-overlay" onClick={onClose}>
      <div
        className="friend-picker-sheet"
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        {/* Mobile Drag Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '10px auto 2px', flexShrink: 0 }} />

        {/* Modal Header */}
        <div
          style={{
            padding: '12px 20px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              className="avatar"
              style={{
                ...getAvatarStyle(friend.color),
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-lg)',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: 'var(--shadow)',
              }}
            >
              {isVendor ? <Store size={20} /> : friendInitial(friend.name, friend.avatarNumber)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                {title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)' }}>
                  {friend.name}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-caption)', opacity: 0.6 }}>•</span>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-3)' }}>
                  {expenses.length} pending transaction{expenses.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text)';
              e.currentTarget.style.background = 'var(--surface3)';
              e.currentTarget.style.borderColor = 'var(--border2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-2)';
              e.currentTarget.style.background = 'var(--surface2)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            aria-label="Close modal"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{ padding: '6px 18px 10px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0 }}>
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              background: isSearchFocused ? 'var(--surface)' : 'var(--surface2)',
              border: isSearchFocused ? '1px solid var(--border2)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '0 13px',
              height: 38,
              boxShadow: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Search
              size={15}
              style={{
                color: isSearchFocused ? 'var(--text)' : 'var(--text-3)',
                marginRight: 9,
                flexShrink: 0,
                transition: 'color 0.15s ease',
              }}
            />
            <input
              type="text"
              value={search}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={e => setSearch(e.target.value)}
              placeholder={isVendor ? "Search by name, category, or friend..." : "Search expenses by name or category..."}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
                color: 'var(--text)',
                padding: '7px 0',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  background: 'var(--surface3)',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  marginLeft: 6,
                  padding: 0,
                  flexShrink: 0,
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.background = 'var(--border2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-3)';
                  e.currentTarget.style.background = 'var(--surface3)';
                }}
                aria-label="Clear search"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Filter Toolbar: Chips for All, To You, You Owe + Filter button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
              <button
                type="button"
                onClick={() => setFilterType('all')}
                style={{
                  height: 35,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: filterType === 'all' ? 700 : 550,
                  background: filterType === 'all' ? 'var(--text)' : 'var(--surface2)',
                  color: filterType === 'all' ? 'var(--bg)' : 'var(--text-2)',
                  border: filterType === 'all' ? '1px solid var(--text)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType('owed_to_me')}
                style={{
                  height: 35,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: filterType === 'owed_to_me' ? 700 : 550,
                  background: filterType === 'owed_to_me' ? 'var(--text)' : 'var(--surface2)',
                  color: filterType === 'owed_to_me' ? 'var(--bg)' : 'var(--text-2)',
                  border: filterType === 'owed_to_me' ? '1px solid var(--text)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                To You
              </button>
              <button
                type="button"
                onClick={() => setFilterType('owed_by_me')}
                style={{
                  height: 35,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: filterType === 'owed_by_me' ? 700 : 550,
                  background: filterType === 'owed_by_me' ? 'var(--text)' : 'var(--surface2)',
                  color: filterType === 'owed_by_me' ? 'var(--bg)' : 'var(--text-2)',
                  border: filterType === 'owed_by_me' ? '1px solid var(--text)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                You Owe
              </button>
            </div>

            {/* Filter button - icon only with new funnel Filter icon */}
            <button
              type="button"
              onClick={() => setShowFilterSheet(true)}
              aria-label="Filter and Sort"
              title="Filter and Sort"
              style={{
                width: 36,
                height: 35,
                borderRadius: 'var(--radius-full)',
                background: isFilterActive ? 'var(--surface3)' : 'var(--surface2)',
                color: isFilterActive ? 'var(--text)' : 'var(--text-2)',
                border: isFilterActive ? '1px solid var(--border2)' : '1px solid var(--border)',
                cursor: 'pointer',
                flexShrink: 0,
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--text-3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = isFilterActive ? 'var(--border2)' : 'var(--border)';
              }}
            >
              <Filter size={15} strokeWidth={2.2} style={{ color: isFilterActive ? 'var(--accent)' : 'var(--text)' }} />
              {isFilterActive && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Expense List */}
        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '8px 18px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {filteredExpenses.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
              <ReceiptText size={28} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-2)' }}>No expenses found</div>
              <div style={{ fontSize: 'var(--fs-caption)', marginTop: 2 }}>
                {search ? 'Try adjusting your search query' : 'No unsettled transactions match this filter'}
              </div>
            </div>
          ) : (
            filteredExpenses.map((e, idx) => {
              const cat = db.settings.categories?.find(c => c.name === e.category);
              const catMeta = resolveCategoryMeta(e.category, cat);
              const isToMe = isOwedToMe(e);
              const isSelected = selectedSet.has(e.id);
              const origAmt = typeof e.originalAmount === 'number' ? e.originalAmount : null;
              const hasDiffOrig = origAmt !== null && origAmt > 0 && Math.abs(origAmt - e.amount) > 0.01;
              const fInfo = getExpenseFriend(e);
              const isOtherFriend = isVendor && fInfo.friend && fInfo.friend.id !== friend.id;

              return (
                <div
                  key={`${e.id}-${idx}`}
                  onClick={() => onToggle(e.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    boxShadow: 'none',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {/* Custom Checkbox */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 'var(--radius-xs)',
                      border: isSelected ? 'none' : '1.5px solid var(--border2, var(--text-3))',
                      background: isSelected ? 'var(--text)' : 'transparent',
                      color: 'var(--bg)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {isSelected && <Check size={13} strokeWidth={3} />}
                  </div>

                  {/* Category Icon Container (like image 3) */}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: catMeta.bg,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CategoryIcon
                      category={catMeta.name}
                      icon={catMeta.icon}
                      size={18}
                      style={{ color: catMeta.color }}
                    />
                  </div>

                  {/* Expense Description & Friend Badge & Meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 'var(--fs-base)',
                          fontWeight: 700,
                          color: 'var(--text)',
                          lineHeight: 1.3,
                        }}
                      >
                        {cleanExpenseDescription(e.description)}
                      </span>

                      {/* Friend Badge - ONLY rendered when settling a vendor and expense belongs to another friend */}
                      {isOtherFriend && fInfo.friend ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4.5,
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 650,
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-xs)',
                            background: 'var(--surface3)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              aspectRatio: '1 / 1',
                              ...getAvatarStyle(fInfo.friend.color),
                              fontSize: 7.5,
                              fontWeight: 750,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                              flexShrink: 0,
                            }}
                          >
                            {friendInitial(fInfo.friend.name, fInfo.friend.avatarNumber)}
                          </span>
                          <span>{fInfo.friend.name}</span>
                        </span>
                      ) : null}
                    </div>

                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-2)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{fmtDate(e.originalDate || e.date)}</span>
                      {e.category ? (
                        <>
                          <span style={{ color: 'var(--text-3)', fontSize: 9 }}>•</span>
                          <span>{e.category}</span>
                        </>
                      ) : null}
                      {hasDiffOrig ? (
                        <>
                          <span style={{ color: 'var(--text-3)', fontSize: 9 }}>•</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 'var(--fs-caption)' }}>Orig {fmtMoney(origAmt!, currency)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Amount Badge */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontWeight: 750,
                        fontSize: 'var(--fs-base)',
                        letterSpacing: '0.2px',
                        color: isToMe ? 'var(--credit)' : 'var(--debit)',
                      }}
                    >
                      {isToMe ? '+' : '-'}{fmtMoney(e.amount, currency)}
                    </div>
                    {hasDiffOrig ? (
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 1 }}>
                        og {fmtMoney(origAmt!, currency)}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Sticky Footer with Clear and Done */}
        <div
          style={{
            padding: '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Beautiful Summary Card */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: selectedSet.size > 0 ? 'rgba(34, 197, 94, 0.16)' : 'var(--surface3)',
                  color: selectedSet.size > 0 ? 'var(--credit)' : 'var(--text-3)',
                  border: selectedSet.size > 0 ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Check size={13} strokeWidth={2.8} />
              </div>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>
                <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{selectedSet.size}</strong> of {expenses.length} selected
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.2px' }}>
                Net Total:
              </span>
              <span
                style={{
                  fontWeight: 750,
                  fontSize: 'var(--fs-base)',
                  letterSpacing: '0.2px',
                  color: netTotal >= 0 ? 'var(--credit)' : 'var(--debit)',
                  background: netTotal >= 0 ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                  border: netTotal >= 0 ? '1px solid rgba(34, 197, 94, 0.28)' : '1px solid rgba(239, 68, 68, 0.28)',
                  padding: '3px 9px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {netTotal >= 0 ? '+' : '-'}{fmtMoney(absNet, currency)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onDeselectAll}
              disabled={selectedSet.size === 0}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 650,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: selectedSet.size === 0 ? 'var(--text-3)' : 'var(--text)',
                cursor: selectedSet.size === 0 ? 'default' : 'pointer',
                opacity: selectedSet.size === 0 ? 0.45 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (selectedSet.size > 0) {
                  e.currentTarget.style.borderColor = 'var(--text-3)';
                  e.currentTarget.style.background = 'var(--surface3)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface2)';
              }}
            >
              <RotateCcw size={14} style={{ strokeWidth: 2.2 }} />
              <span>Clear</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              style={{
                flex: 1.2,
                height: 44,
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                background: 'var(--text)',
                border: '1px solid var(--text)',
                color: 'var(--bg)',
                boxShadow: 'var(--shadow)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Check size={16} strokeWidth={2.4} style={{ color: 'inherit' }} />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Filter Bottom Sheet */}
        <AnimatePresence>
          {showFilterSheet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                zIndex: 40,
                backdropFilter: 'blur(3px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
              onClick={() => setShowFilterSheet(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                style={{
                  background: 'var(--surface)',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  borderTop: '1px solid var(--border)',
                  padding: '14px 20px calc(16px + env(safe-area-inset-bottom, 0px))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  maxHeight: '82%',
                  overflowY: 'auto',
                  boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.3)',
                }}
              >
                {/* Drag Handle */}
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 2px', flexShrink: 0 }} />

                {/* Filter Sheet Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={15} strokeWidth={2.2} style={{ color: 'var(--text-2)' }} />
                    <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)' }}>Filter & Sort</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilterSheet(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-3)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Sort By Section */}
                <div>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-3)', marginBottom: 8 }}>
                    SORT BY
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { id: 'date_desc', label: 'Newest First' },
                      { id: 'date_asc', label: 'Oldest First' },
                      ...(isVendor ? [{ id: 'friend_asc', label: 'Friend A–Z' }] : []),
                      { id: 'amount_desc', label: 'Amount: High to Low' },
                      { id: 'amount_asc', label: 'Amount: Low to High' },
                    ].map(opt => {
                      const isSelected = sortBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSortBy(opt.id as ExpenseSortOption)}
                          style={{
                            padding: '6px 13px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: isSelected ? 700 : 500,
                            background: isSelected ? 'var(--text)' : 'var(--surface2)',
                            color: isSelected ? 'var(--bg)' : 'var(--text-2)',
                            border: isSelected ? '1px solid var(--text)' : '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Selection Section */}
                <div>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-3)', marginBottom: 8 }}>
                    SELECTION
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (allFilteredSelected) {
                          onDeselectAll();
                        } else if (friendFilter === 'all' && filterType === 'all' && !search.trim()) {
                          onSelectAll();
                        } else {
                          handleToggleCurrentFiltered();
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 650,
                        background: 'var(--surface2)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}
                    >
                      <CheckCheck size={14} />
                      <span>{allFilteredSelected ? 'Deselect Filtered' : `Select All (${filteredExpenses.length})`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeselectAll();
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 650,
                        background: 'var(--surface2)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Deselect All</span>
                    </button>
                  </div>
                </div>

                {/* Participant Filter (If vendor has multiple participants) */}
                {isVendor && friendStats.hasMultipleParticipants && (
                  <div>
                    <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-3)', marginBottom: 8 }}>
                      PARTICIPANT
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setFriendFilter('all')}
                        style={{
                          padding: '5px 11px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: friendFilter === 'all' ? 700 : 500,
                          background: friendFilter === 'all' ? 'var(--text)' : 'var(--surface2)',
                          color: friendFilter === 'all' ? 'var(--bg)' : 'var(--text-2)',
                          border: friendFilter === 'all' ? '1px solid var(--text)' : '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        All ({expenses.length})
                      </button>
                      {friendStats.personalCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setFriendFilter('personal')}
                          style={{
                            padding: '5px 11px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: friendFilter === 'personal' ? 700 : 500,
                            background: friendFilter === 'personal' ? 'var(--text)' : 'var(--surface2)',
                            color: friendFilter === 'personal' ? 'var(--bg)' : 'var(--text-2)',
                            border: friendFilter === 'personal' ? '1px solid var(--text)' : '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          You ({friendStats.personalCount})
                        </button>
                      )}
                      {friendStats.friends.map(({ friend: f, count }) => {
                        const isActive = friendFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setFriendFilter(f.id)}
                            style={{
                              padding: '5px 11px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: 'var(--fs-xs)',
                              fontWeight: isActive ? 700 : 500,
                              background: isActive ? 'var(--text)' : 'var(--surface2)',
                              color: isActive ? 'var(--bg)' : 'var(--text-2)',
                              border: isActive ? '1px solid var(--text)' : '1px solid var(--border)',
                              cursor: 'pointer',
                            }}
                          >
                            {f.name} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Filter Sheet Done Button */}
                <button
                  type="button"
                  onClick={() => setShowFilterSheet(false)}
                  style={{
                    height: 40,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--text)',
                    color: 'var(--bg)',
                    border: 'none',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: 4,
                  }}
                >
                  Apply Filters
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body
  );
}
