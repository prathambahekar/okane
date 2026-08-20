import React, { useState, useMemo } from 'react';
import { X, Users, Search, Plus, Store, Check } from 'lucide-react';
import type { AppDB } from '../../types';
import { fmtMoney, getAvatarStyle } from '../../utils';

interface FriendSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  selectedFriendIds: string[];
  setSelectedFriendIds: React.Dispatch<React.SetStateAction<string[]>>;
  splitCalcMode: 'equal_all' | 'equal_friends' | 'custom';
  includeYouInCustom: boolean;
  setIncludeYouInCustom: React.Dispatch<React.SetStateAction<boolean>>;
  customFriendShares: Record<string, string>;
  setCustomFriendShares: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSelectSplitCalcMode: (mode: 'equal_all' | 'equal_friends' | 'custom', includeYouOverride?: boolean) => void;
  getFriendShare: (fId: string) => number;
  totalFriendsShare: number;
  isYouSelected: boolean;
  db: AppDB;
  addFriend: (friend: { name: string; type: 'friend' | 'vendor' }) => { id: string; name: string };
  showToast: (msg: string) => void;
}

export function FriendSplitModal({
  isOpen,
  onClose,
  amount,
  selectedFriendIds,
  setSelectedFriendIds,
  splitCalcMode,
  includeYouInCustom,
  setIncludeYouInCustom,
  customFriendShares,
  setCustomFriendShares,
  handleSelectSplitCalcMode,
  getFriendShare,
  totalFriendsShare,
  isYouSelected,
  db,
  addFriend,
  showToast,
}: FriendSplitModalProps) {
  const s = db.settings;
  const [pickerTypeFilter, setPickerTypeFilter] = useState<'all' | 'friend' | 'vendor'>('friend');
  const [pickerSearch, setPickerSearch] = useState('');

  const handleClose = () => {
    setPickerTypeFilter('friend');
    setPickerSearch('');
    onClose();
  };

  const filteredFriendsList = useMemo(() => {
    let list = db.friends;
    if (pickerTypeFilter !== 'all') {
      list = list.filter(f => (f.type || 'friend') === pickerTypeFilter);
    }
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }
    return list;
  }, [db.friends, pickerTypeFilter, pickerSearch]);

  if (!isOpen) return null;

  return (
    <div
      className="friend-picker-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="friend-picker-sheet" onClick={e => e.stopPropagation()}>
        {/* Mobile Grab Handle */}
        <div className="friend-picker-handle">
          <div style={{ width: 36, height: 4, borderRadius: 999, backgroundColor: 'var(--text-3)', opacity: 0.4 }} />
        </div>

        {/* Dialog Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--surface2)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Users size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650, color: 'var(--text)', lineHeight: 1.2 }}>
                Split with Friends
              </h3>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                Select friends and choose split rule
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
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
              transition: 'all 0.15s ease',
            }}
            aria-label="Close dialog"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ padding: '4px 20px 10px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          {/* Row 1: Full-Width Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '0 10px',
              height: 38,
              transition: 'border-color 0.15s ease',
            }}
          >
            <Search size={15} style={{ color: 'var(--text-3)', marginRight: 8, flexShrink: 0 }} />
            <input
              type="text"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: 'var(--text)',
                padding: '6px 0',
              }}
              placeholder="Search friends or stores..."
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
            />
            {pickerSearch.trim() && (
              <button
                type="button"
                onClick={() => setPickerSearch('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'grid',
                  placeItems: 'center',
                  marginRight: !db.friends.some(f => f.name.toLowerCase() === pickerSearch.trim().toLowerCase()) ? 6 : 0,
                }}
              >
                <X size={14} />
              </button>
            )}
            {pickerSearch.trim() && !db.friends.some(f => f.name.toLowerCase() === pickerSearch.trim().toLowerCase()) && (
              <button
                type="button"
                style={{
                  fontSize: 11.5,
                  fontWeight: 650,
                  padding: '4px 10px',
                  height: 26,
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: 'var(--accent)',
                  color: 'var(--accent-contrast, #ffffff)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => {
                  const created = addFriend({ name: pickerSearch.trim(), type: 'friend' });
                  setSelectedFriendIds(prev => {
                    const next = [...prev, created.id];
                    if (splitCalcMode === 'custom' && next.length > 0) {
                      const tot = parseFloat(amount) || 0;
                      const denom = isYouSelected ? next.length + 1 : next.length;
                      const equalVal = tot > 0 && denom > 0 ? String(Math.floor((tot * 100) / denom) / 100) : '0';
                      setCustomFriendShares(existing => ({
                        ...existing,
                        [created.id]: equalVal,
                      }));
                    }
                    return next;
                  });
                  showToast(`Added ${created.name}`);
                  setPickerSearch('');
                }}
              >
                <Plus size={13} /> Add
              </button>
            )}
          </div>

          {/* Row 2: Filter Pills & Select All Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {/* Segmented Filter Pills */}
            <div
              style={{
                display: 'flex',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 2,
                gap: 2,
              }}
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'friend', label: 'Friends' },
                  { id: 'vendor', label: 'Stores' },
                ] as const
              ).map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPickerTypeFilter(f.id)}
                  style={{
                    border: 'none',
                    background: pickerTypeFilter === f.id ? 'var(--accent)' : 'transparent',
                    color: pickerTypeFilter === f.id ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                    fontSize: 11.5,
                    fontWeight: pickerTypeFilter === f.id ? 650 : 500,
                    padding: '3px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Select All Action */}
            <button
              type="button"
              onClick={() => {
                const visibleIds = filteredFriendsList.map(f => f.id);
                const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedFriendIds.includes(id));
                if (allSelected) {
                  setSelectedFriendIds(prev => prev.filter(id => !visibleIds.includes(id)));
                } else {
                  setSelectedFriendIds(prev => Array.from(new Set([...prev, ...visibleIds])));
                }
              }}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--accent)',
                fontSize: 11.5,
                fontWeight: 650,
                padding: '4px 6px',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {filteredFriendsList.length > 0 && filteredFriendsList.every(f => selectedFriendIds.includes(f.id))
                ? 'Deselect All'
                : 'Select All'}
            </button>
          </div>
        </div>

        {/* Friend Selection Section */}
        <div
          className="no-scrollbar"
          style={{
            flex: splitCalcMode === 'custom' && selectedFriendIds.length > 2 ? 0.7 : 1,
            minHeight: 120,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '2px 20px 10px',
            background: 'var(--surface)',
            transition: 'flex 0.2s ease',
          }}
        >
          {(() => {
            const showYouChip =
              (pickerTypeFilter === 'all' || pickerTypeFilter === 'friend') &&
              (!pickerSearch.trim() ||
                'you'.includes(pickerSearch.toLowerCase().trim()) ||
                'me'.includes(pickerSearch.toLowerCase().trim()));
            const hasAnyItems = showYouChip || filteredFriendsList.length > 0;

            if (!hasAnyItems) {
              return (
                <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                  No matching friends found
                </div>
              );
            }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {showYouChip && (
                  <div
                    onClick={() => {
                      if (splitCalcMode === 'custom') {
                        const nextIncludeYou = !includeYouInCustom;
                        setIncludeYouInCustom(nextIncludeYou);
                        const n = selectedFriendIds.length;
                        const tot = parseFloat(amount) || 0;
                        if (n > 0 && tot > 0) {
                          const denom = nextIncludeYou ? n + 1 : n;
                          const equalVal = String(Math.floor((tot * 100) / denom) / 100);
                          setCustomFriendShares(existing => {
                            const updated = { ...existing };
                            selectedFriendIds.forEach(id => {
                              if (
                                !nextIncludeYou ||
                                !updated[id] ||
                                isNaN(parseFloat(updated[id])) ||
                                parseFloat(updated[id]) <= 0
                              ) {
                                updated[id] = equalVal;
                              }
                            });
                            return updated;
                          });
                        }
                      } else {
                        if (isYouSelected) {
                          handleSelectSplitCalcMode('equal_friends');
                        } else {
                          handleSelectSplitCalcMode('equal_all');
                        }
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: 'var(--surface2)',
                      border: isYouSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          background: isYouSelected ? 'var(--accent-soft)' : 'var(--surface3)',
                          color: isYouSelected ? 'var(--accent)' : 'var(--text-3)',
                          fontSize: 11.5,
                          fontWeight: 750,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Y
                      </div>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: isYouSelected ? 650 : 500,
                          color: isYouSelected ? 'var(--text)' : 'var(--text-2)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        You (Me)
                      </span>
                    </div>
                    <div
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 5,
                        background: isYouSelected ? 'var(--accent)' : 'transparent',
                        border: isYouSelected ? 'none' : '1.5px solid var(--border2, var(--text-3))',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isYouSelected && <Check size={11} strokeWidth={3} style={{ color: 'var(--accent-contrast, #ffffff)' }} />}
                    </div>
                  </div>
                )}

                {filteredFriendsList.map(f => {
                  const isSel = selectedFriendIds.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        if (isSel) {
                          setSelectedFriendIds(prev => prev.filter(id => id !== f.id));
                        } else {
                          setSelectedFriendIds(prev => [...prev, f.id]);
                          if (splitCalcMode === 'custom') {
                            const nextCount = selectedFriendIds.length + 1;
                            const tot = parseFloat(amount) || 0;
                            const denom = isYouSelected ? nextCount + 1 : nextCount;
                            const equalVal =
                              tot > 0 && denom > 0 ? String(Math.floor((tot * 100) / denom) / 100) : '0';
                            setCustomFriendShares(existing => ({
                              ...existing,
                              [f.id]: equalVal,
                            }));
                          }
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: 'var(--surface2)',
                        border: isSel ? '1px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 7,
                            ...getAvatarStyle(f.color),
                            fontSize: 11.5,
                            fontWeight: 700,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {f.type === 'vendor' ? <Store size={13} /> : (f.name[0]?.toUpperCase() || 'F')}
                        </div>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: isSel ? 650 : 500,
                            color: isSel ? 'var(--text)' : 'var(--text-2)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {f.name}
                        </span>
                      </div>
                      <div
                        style={{
                          width: 17,
                          height: 17,
                          borderRadius: 5,
                          background: isSel ? 'var(--accent)' : 'transparent',
                          border: isSel ? 'none' : '1.5px solid var(--border2, var(--text-3))',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSel && <Check size={11} strokeWidth={3} style={{ color: 'var(--accent-contrast, #ffffff)' }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Split Rule Selector & Custom Friend Breakdown Section */}
        <div
          className="no-scrollbar"
          style={{
            flex: splitCalcMode === 'custom' && selectedFriendIds.length > 2 ? 1 : 'none',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
            padding: '6px 18px 6px',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Split Rule
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 650,
                color: selectedFriendIds.length > 0 ? 'var(--accent)' : 'var(--text-3)',
              }}
            >
              {selectedFriendIds.length} Friend{selectedFriendIds.length !== 1 ? 's' : ''} Selected
            </span>
          </div>

          {/* Segmented Split Mode Selector with Theme Accent */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 3,
              gap: 4,
              marginBottom: 8,
            }}
          >
            {(
              [
                { id: 'equal_all', label: 'Equal' },
                { id: 'equal_friends', label: 'Friends Only' },
                { id: 'custom', label: 'Custom' },
              ] as const
            ).map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectSplitCalcMode(m.id)}
                style={{
                  border: 'none',
                  background: splitCalcMode === m.id ? 'var(--accent)' : 'transparent',
                  color: splitCalcMode === m.id ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                  fontSize: 12,
                  fontWeight: splitCalcMode === m.id ? 650 : 500,
                  padding: '7px 0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Equal Rules Note */}
          {splitCalcMode === 'equal_all' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center', margin: '2px 0 6px' }}>
              Split equally between <strong style={{ color: 'var(--accent)' }}>You</strong> and{' '}
              <strong style={{ color: 'var(--text)' }}>
                {selectedFriendIds.length} Friend{selectedFriendIds.length !== 1 ? 's' : ''}
              </strong>
            </div>
          )}

          {splitCalcMode === 'equal_friends' && (
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center', margin: '2px 0 6px' }}>
              Split 100% equally among{' '}
              <strong style={{ color: 'var(--text)' }}>
                {selectedFriendIds.length} Friend{selectedFriendIds.length !== 1 ? 's' : ''}
              </strong>{' '}
              (Your share: {fmtMoney(0, s.currency)})
            </div>
          )}

          {/* Custom Mode: Interactive Per-Person Cards */}
          {splitCalcMode === 'custom' && selectedFriendIds.length > 0 && (
            <div
              className="no-scrollbar"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 8,
                paddingRight: 2,
              }}
            >
              {/* You (Me) Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      fontSize: 13,
                      fontWeight: 750,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    Y
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)' }}>
                      You (Me)
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {isYouSelected ? 'Remainder calculated automatically' : 'Excluded from split'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    background: isYouSelected ? 'var(--accent-soft)' : 'var(--surface)',
                    border: isYouSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 11, color: isYouSelected ? 'var(--accent)' : 'var(--text-3)', fontWeight: 600 }}>
                    {isYouSelected ? 'Share:' : 'Excluded:'}
                  </span>
                  <strong
                    style={{
                      fontSize: 12.5,
                      color: isYouSelected ? 'var(--accent)' : 'var(--text-3)',
                      fontWeight: 700,
                    }}
                  >
                    {fmtMoney(
                      isYouSelected ? Math.max(0, (parseFloat(amount) || 0) - totalFriendsShare) : 0,
                      s.currency
                    )}
                  </strong>
                </div>
              </div>

              {/* Selected Friends Cards */}
              {selectedFriendIds.map(fId => {
                const friendObj = db.friends.find(f => f.id === fId);
                const currentVal = customFriendShares[fId] ?? String(getFriendShare(fId));

                return (
                  <div
                    key={fId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          ...getAvatarStyle(friendObj?.color),
                          fontSize: 12.5,
                          fontWeight: 700,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {friendObj?.type === 'vendor' ? <Store size={14} /> : (friendObj?.name[0]?.toUpperCase() || 'F')}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 650,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {friendObj?.name || 'Friend'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                          {friendObj?.type === 'vendor' ? 'Store / Vendor' : 'Friend'}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '4px 8px',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)' }}>{s.currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={currentVal}
                        onChange={e => {
                          const val = e.target.value;
                          setCustomFriendShares(prev => ({
                            ...prev,
                            [fId]: val,
                          }));
                        }}
                        style={{
                          width: 75,
                          textAlign: 'right',
                          padding: 0,
                          fontSize: 12.5,
                          fontWeight: 700,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text)',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Action & Dynamic Split Math Status */}
        <div style={{ padding: '8px 18px 16px', background: 'var(--surface)', flexShrink: 0 }}>
          {selectedFriendIds.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11.5,
                marginBottom: 10,
                padding: '7px 10px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            >
              {(() => {
                const tot = parseFloat(amount) || 0;
                const myShare = isYouSelected ? Math.max(0, tot - totalFriendsShare) : 0;
                const unallocated = !isYouSelected ? Math.max(0, tot - totalFriendsShare) : 0;
                const perFriend = selectedFriendIds.length > 0 ? totalFriendsShare / selectedFriendIds.length : 0;

                return (
                  <>
                    {isYouSelected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                        <span style={{ color: 'var(--text-2)' }}>My Share:</span>
                        <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>
                          {fmtMoney(myShare, s.currency)}
                        </strong>
                      </div>
                    ) : unallocated > 0.01 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                        <span style={{ color: '#ef4444' }}>Unallocated:</span>
                        <strong style={{ color: '#ef4444', fontWeight: 700 }}>
                          {fmtMoney(unallocated, s.currency)}
                        </strong>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                        <span style={{ color: 'var(--text-2)' }}>Split:</span>
                        <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>Friends Only (100%)</strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--credit)' }} />
                      <span style={{ color: 'var(--text-2)' }}>Friends:</span>
                      <strong style={{ color: 'var(--credit)', fontWeight: 700 }}>
                        {fmtMoney(totalFriendsShare, s.currency)}
                        {splitCalcMode !== 'custom' && selectedFriendIds.length > 1 && (
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>
                            ({fmtMoney(perFriend, s.currency)}/ea)
                          </span>
                        )}
                      </strong>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              style={{
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: 600,
                padding: '9px 0',
                backgroundColor: 'var(--surface2)',
                color: 'var(--text-2)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary active-accent"
              onClick={handleClose}
              style={{
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: 650,
                padding: '9px 0',
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast, #ffffff)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
