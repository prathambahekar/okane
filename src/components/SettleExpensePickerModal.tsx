import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check, ReceiptText, ArrowUpDown, CheckCheck } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import type { Friend, Expense, AppDB } from '../types';
import { expenseFlow } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, cleanExpenseDescription } from '../utils';

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
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'owed_to_me' | 'owed_by_me'>('all');
  const [friendFilter, setFriendFilter] = useState<string>('all'); // 'all' | 'personal' | friendId
  const [sortBy, setSortBy] = useState<ExpenseSortOption>('date_desc');

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

  const hasMixedFlows = useMemo(() => {
    let hasToMe = false;
    let hasByMe = false;
    for (const e of expenses) {
      if (isOwedToMe(e)) hasToMe = true;
      else hasByMe = true;
      if (hasToMe && hasByMe) return true;
    }
    return false;
  }, [expenses, isOwedToMe]);

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

  const activeFriendObj = friendFilter !== 'all' && friendFilter !== 'personal' ? friendsMap.get(friendFilter) : null;
  const activeFilterLabel = friendFilter === 'personal'
    ? 'Personal'
    : activeFriendObj
    ? activeFriendObj.name
    : 'all items';

  if (!isOpen) return null;

  return createPortal(
    <div className="friend-picker-overlay" onClick={onClose}>
      <div
        className="friend-picker-sheet"
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Mobile Drag Handle */}
        <div className="friend-picker-handle">
          <div style={{ width: 36, height: 4.5, borderRadius: 99, background: 'var(--border2)' }} />
        </div>

        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              className="avatar"
              style={{
                ...getAvatarStyle(friend.color),
                width: 34,
                height: 34,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {friendInitial(friend.name, friend.avatarNumber)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                {title}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                {friend.name} • {expenses.length} pending transaction{expenses.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              width: 30,
              height: 30,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{ padding: '10px 18px 8px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '0 10px',
              height: 36,
              transition: 'border-color 0.15s ease',
            }}
          >
            <Search
              size={14.5}
              style={{
                color: 'var(--text-3)',
                marginRight: 8,
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isVendor ? "Search by name, category, or friend..." : "Search expenses by name or category..."}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12.5,
                color: 'var(--text)',
                padding: '5px 0',
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
                  padding: 4,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Friend Filter Pills Bar (ONLY for Vendor settlements with multiple participants) */}
          {isVendor && friendStats.hasMultipleParticipants && (
            <div
              className="no-scrollbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflowX: 'auto',
                padding: '2px 0',
                scrollbarWidth: 'none',
              }}
            >
              {/* All Filter Pill */}
              <button
                type="button"
                onClick={() => setFriendFilter('all')}
                style={{
                  border: friendFilter === 'all' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: friendFilter === 'all' ? 'var(--accent-soft)' : 'var(--surface2)',
                  color: friendFilter === 'all' ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 11.5,
                  fontWeight: friendFilter === 'all' ? 700 : 500,
                  padding: '4px 10px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>All</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 99,
                    background: friendFilter === 'all' ? 'var(--accent)' : 'var(--surface3)',
                    color: friendFilter === 'all' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                  }}
                >
                  {expenses.length}
                </span>
              </button>

              {/* You / Personal Filter Pill */}
              {friendStats.personalCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFriendFilter('personal')}
                  style={{
                    border: friendFilter === 'personal' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: friendFilter === 'personal' ? 'var(--accent-soft)' : 'var(--surface2)',
                    color: friendFilter === 'personal' ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 11.5,
                    fontWeight: friendFilter === 'personal' ? 700 : 500,
                    padding: '4px 10px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: '50%',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      fontSize: 8.5,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                      lineHeight: 1,
                      flexShrink: 0,
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                    }}
                  >
                    Y
                  </span>
                  <span>You</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 99,
                      background: friendFilter === 'personal' ? 'var(--accent)' : 'var(--surface3)',
                      color: friendFilter === 'personal' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                    }}
                  >
                    {friendStats.personalCount}
                  </span>
                </button>
              )}

              {/* Friend Pills */}
              {friendStats.friends.map(({ friend: f, count }) => {
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
                      color: isActive ? 'var(--accent)' : 'var(--text)',
                      fontSize: 11.5,
                      fontWeight: isActive ? 700 : 500,
                      padding: '4px 10px',
                      borderRadius: 20,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: 15,
                        height: 15,
                        borderRadius: '50%',
                        background: avatar.background,
                        color: avatar.color,
                        fontSize: 8.5,
                        fontWeight: 700,
                        display: 'grid',
                        placeItems: 'center',
                        lineHeight: 1,
                        flexShrink: 0,
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                      }}
                    >
                      {friendInitial(f.name, f.avatarNumber)}
                    </span>
                    <span>{f.name}</span>
                    <span
                      style={{
                        fontSize: 10,
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
            </div>
          )}

          {/* Sub-toolbar: Sort Selector + Flow Tabs + Select All */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {/* Sort Selector Dropdown */}
              <div
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  padding: '4px 9px',
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <ArrowUpDown size={11} style={{ color: 'var(--accent)' }} />
                <span>
                  {sortBy === 'date_desc'
                    ? 'Newest'
                    : sortBy === 'date_asc'
                    ? 'Oldest'
                    : sortBy === 'friend_asc'
                    ? 'Friend A-Z'
                    : sortBy === 'amount_desc'
                    ? 'Amt: High'
                    : 'Amt: Low'}
                </span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as ExpenseSortOption)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <option value="date_desc">Date: Newest First</option>
                  <option value="date_asc">Date: Oldest First</option>
                  {isVendor && <option value="friend_asc">Friend Name: A to Z</option>}
                  <option value="amount_desc">Amount: High to Low</option>
                  <option value="amount_asc">Amount: Low to High</option>
                </select>
              </div>

              {/* Mixed Flow Tabs if any */}
              {hasMixedFlows && (
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    padding: 2,
                    gap: 2,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    style={{
                      border: 'none',
                      background: filterType === 'all' ? 'var(--accent)' : 'transparent',
                      color: filterType === 'all' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                      fontSize: 11,
                      fontWeight: filterType === 'all' ? 650 : 500,
                      padding: '2px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    All Flows
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('owed_to_me')}
                    style={{
                      border: 'none',
                      background: filterType === 'owed_to_me' ? 'var(--accent)' : 'transparent',
                      color: filterType === 'owed_to_me' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                      fontSize: 11,
                      fontWeight: filterType === 'owed_to_me' ? 650 : 500,
                      padding: '2px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    To You
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('owed_by_me')}
                    style={{
                      border: 'none',
                      background: filterType === 'owed_by_me' ? 'var(--accent)' : 'transparent',
                      color: filterType === 'owed_by_me' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                      fontSize: 11,
                      fontWeight: filterType === 'owed_by_me' ? 650 : 500,
                      padding: '2px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    You Owe
                  </button>
                </div>
              )}

              <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500 }}>
                {filteredExpenses.length} item{filteredExpenses.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Select/Deselect All Button */}
            <button
              type="button"
              onClick={friendFilter !== 'all' || filterType !== 'all' ? handleToggleCurrentFiltered : (allFilteredSelected ? onDeselectAll : onSelectAll)}
              style={{
                background: 'var(--surface2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 11.5,
                fontWeight: 600,
                padding: '4px 9px',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4.5,
                transition: 'all 0.15s ease',
              }}
            >
              <CheckCheck size={13} strokeWidth={2.4} />
              <span>
                {isVendor && friendFilter !== 'all'
                  ? (allFilteredSelected ? `Deselect ${activeFilterLabel}` : `Select all ${activeFilterLabel}`)
                  : (allFilteredSelected ? 'Deselect all' : 'Select all')}
              </span>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>No expenses found</div>
              <div style={{ fontSize: 11.5, marginTop: 2 }}>
                {search ? 'Try adjusting your search query' : 'No unsettled transactions match this filter'}
              </div>
            </div>
          ) : (
            filteredExpenses.map(e => {
              const cat = db.settings.categories?.find(c => c.name === e.category);
              const isToMe = isOwedToMe(e);
              const isSelected = selectedSet.has(e.id);
              const origAmt = typeof e.originalAmount === 'number' ? e.originalAmount : null;
              const hasDiffOrig = origAmt !== null && origAmt > 0 && Math.abs(origAmt - e.amount) > 0.01;
              const fInfo = getExpenseFriend(e);
              const isOtherFriend = isVendor && fInfo.friend && fInfo.friend.id !== friend.id;

              return (
                <div
                  key={e.id}
                  onClick={() => onToggle(e.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '10px 13px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    boxShadow: 'none',
                    borderRadius: 12,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'border-color 0.12s ease, background 0.12s ease',
                  }}
                >
                  {/* Custom Checkbox */}
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: isSelected ? 'none' : '1.5px solid var(--border2, var(--text-3))',
                      background: isSelected ? 'var(--accent)' : 'var(--surface)',
                      color: 'var(--accent-contrast, #ffffff)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>

                  {/* Category Icon */}
                  <CategoryIcon
                    category={e.category}
                    size={16}
                    style={{ color: cat?.color ?? 'var(--accent)', flexShrink: 0 }}
                  />

                  {/* Expense Description & Friend Badge & Meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 650,
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
                            fontSize: 10.5,
                            fontWeight: 650,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: 'var(--surface3)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            style={{
                              width: 13,
                              height: 13,
                              borderRadius: '50%',
                              background: getAvatarStyle(fInfo.friend.color).background,
                              color: '#ffffff',
                              fontSize: 7.5,
                              fontWeight: 700,
                              display: 'grid',
                              placeItems: 'center',
                              lineHeight: 1,
                            }}
                          >
                            {friendInitial(fInfo.friend.name, fInfo.friend.avatarNumber)}
                          </span>
                          <span>{fInfo.friend.name}</span>
                        </span>
                      ) : null}
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{fmtDate(e.originalDate || e.date)}</span>
                      {e.category ? (
                        <>
                          <span>•</span>
                          <span>{e.category}</span>
                        </>
                      ) : null}
                      {hasDiffOrig ? (
                        <>
                          <span>•</span>
                          <span>Orig {fmtMoney(origAmt!, currency)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Amount Badge */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13.5,
                        color: isToMe ? 'var(--credit)' : 'var(--debit)',
                      }}
                    >
                      {isToMe ? '+' : '-'}{fmtMoney(e.amount, currency)}
                    </div>
                    {hasDiffOrig ? (
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                        og {fmtMoney(origAmt!, currency)}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Sticky Footer with Summary & Confirm Action */}
        <div
          style={{
            padding: '12px 18px calc(12px + env(safe-area-inset-bottom, 0px))',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)' }}>
              {selectedSet.size} of {expenses.length} selected
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
              Net:{' '}
              <strong style={{ color: netTotal >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                {netTotal >= 0 ? '+' : '-'}{fmtMoney(absNet, currency)}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary active-accent"
            onClick={onClose}
            style={{
              padding: '8px 22px',
              fontSize: 13,
              fontWeight: 650,
              borderRadius: 8,
              minWidth: 100,
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast, #ffffff)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
