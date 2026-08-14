import React, { useState, useMemo } from 'react';
import { X, Users, Search, Plus, Store } from 'lucide-react';
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
  const [pickerTypeFilter, setPickerTypeFilter] = useState<'all' | 'friend' | 'vendor'>('all');
  const [pickerSearch, setPickerSearch] = useState('');

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
    <div className="friend-picker-overlay" onClick={onClose}>
      <div className="friend-picker-sheet" onClick={e => e.stopPropagation()}>
        {/* Sheet Mobile Drag Handle */}
        <div className="friend-picker-handle">
          <div style={{ width: 36, height: 4.5, borderRadius: 99, background: 'var(--border2)' }} />
        </div>

        {/* Dialog Header */}
        <div
          style={{
            padding: '14px 18px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
              }}
            >
              <Users size={17} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>
                Split with Friends
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                Select friends and choose split rule
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
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Merged Ultra-Sleek Search & Filter Bar */}
        <div style={{ padding: '0 18px 8px', background: 'var(--surface)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '3px 4px 3px 10px',
            }}
          >
            {/* Search Input Box */}
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 75, gap: 6 }}>
              <Search size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              <input
                type="text"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  color: 'var(--text)',
                  padding: '4px 0',
                }}
                placeholder="Search or add..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
              />
              {pickerSearch.trim() && !db.friends.some(f => f.name.toLowerCase() === pickerSearch.trim().toLowerCase()) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 10.5, padding: '2px 8px', height: 26, borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0 }}
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
                  <Plus size={12} style={{ marginRight: 2 }} /> Add
                </button>
              )}
            </div>

            {/* Segmented Filter Pills */}
            <div
              style={{
                display: 'flex',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 1.5,
                gap: 1.5,
                flexShrink: 0,
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
                    background: pickerTypeFilter === f.id ? 'var(--text)' : 'transparent',
                    color: pickerTypeFilter === f.id ? 'var(--bg)' : 'var(--text-3)',
                    fontSize: 10,
                    fontWeight: pickerTypeFilter === f.id ? 700 : 500,
                    padding: '2px 6px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
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
                const allSelected = visibleIds.every(id => selectedFriendIds.includes(id));
                if (allSelected) {
                  setSelectedFriendIds(prev => prev.filter(id => !visibleIds.includes(id)));
                } else {
                  setSelectedFriendIds(prev => Array.from(new Set([...prev, ...visibleIds])));
                }
              }}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--text)',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 6px',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {filteredFriendsList.length > 0 && filteredFriendsList.every(f => selectedFriendIds.includes(f.id))
                ? 'Deselect'
                : 'Select All'}
            </button>
          </div>
        </div>

        {/* Dynamic Vertical Space: Friend Selection Section */}
        <div style={{ flex: splitCalcMode === 'custom' && selectedFriendIds.length > 2 ? 0.7 : 1, minHeight: 120, overflowY: 'auto', padding: '6px 18px 10px', background: 'var(--surface)', transition: 'flex 0.2s ease' }}>
          {(() => {
            const showYouChip = (pickerTypeFilter === 'all' || pickerTypeFilter === 'friend') &&
              (!pickerSearch.trim() || 'you'.includes(pickerSearch.toLowerCase().trim()) || 'me'.includes(pickerSearch.toLowerCase().trim()));
            const hasAnyItems = showYouChip || filteredFriendsList.length > 0;

            if (!hasAnyItems) {
              return (
                <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                  No matching friends found
                </div>
              );
            }

            return (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 8px', minHeight: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))', gap: 6 }}>
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
                                if (!nextIncludeYou || !updated[id] || isNaN(parseFloat(updated[id])) || parseFloat(updated[id]) <= 0) {
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
                        padding: '4px 8px',
                        borderRadius: 10,
                        background: isYouSelected ? 'var(--surface)' : 'transparent',
                        border: isYouSelected ? '1.5px solid var(--text)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: 'var(--text)',
                            color: 'var(--bg)',
                            fontSize: 10,
                            fontWeight: 800,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          Y
                        </div>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: isYouSelected ? 700 : 500,
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
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          border: isYouSelected ? '4.5px solid var(--text)' : '1.5px solid var(--text-3)',
                          background: 'var(--surface)',
                          flexShrink: 0,
                          transition: 'all 0.12s ease',
                        }}
                      />
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
                              const equalVal = tot > 0 && denom > 0 ? String(Math.floor((tot * 100) / denom) / 100) : '0';
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
                          padding: '4px 8px',
                          borderRadius: 10,
                          background: isSel ? 'var(--surface)' : 'transparent',
                          border: isSel ? '1.5px solid var(--accent)' : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              ...getAvatarStyle(f.color),
                              fontSize: 10,
                              fontWeight: 700,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {f.type === 'vendor' ? <Store size={11} /> : (f.name[0]?.toUpperCase() || 'F')}
                          </div>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: isSel ? 700 : 500,
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
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: isSel ? '4.5px solid var(--accent)' : '1.5px solid var(--text-3)',
                            background: 'var(--surface)',
                            flexShrink: 0,
                            transition: 'all 0.12s ease',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Split Rule Selector & Custom Friend Breakdown Section */}
        <div
          style={{
            flex: splitCalcMode === 'custom' && selectedFriendIds.length > 2 ? 1 : 'none',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: '10px 18px 6px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Split Rule
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
              {selectedFriendIds.length} Friend{selectedFriendIds.length !== 1 ? 's' : ''} Selected
            </span>
          </div>

          {/* Segmented Split Mode Selector */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 2.5,
              gap: 2,
              marginBottom: 10,
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
                  background: splitCalcMode === m.id ? 'var(--text)' : 'transparent',
                  color: splitCalcMode === m.id ? 'var(--bg)' : 'var(--text-2)',
                  fontSize: 11.5,
                  fontWeight: splitCalcMode === m.id ? 700 : 500,
                  padding: '5px 0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  textAlign: 'center',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Equal Rules Note */}
          {splitCalcMode === 'equal_all' && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', margin: '2px 0 6px' }}>
              Split equally between <strong>You</strong> and <strong>{selectedFriendIds.length} Friend{selectedFriendIds.length !== 1 ? 's' : ''}</strong>
            </div>
          )}

          {splitCalcMode === 'equal_friends' && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', margin: '2px 0 6px' }}>
              Split 100% equally among <strong>{selectedFriendIds.length} Friend{selectedFriendIds.length !== 1 ? 's' : ''}</strong> (Your share: $0.00)
            </div>
          )}

          {/* Custom Mode: Interactive Per-Person Amount Editors */}
          {splitCalcMode === 'custom' && selectedFriendIds.length > 0 && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, paddingRight: 2 }}>
              {/* You (Me) Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--text)',
                      color: 'var(--bg)',
                      fontSize: 9.5,
                      fontWeight: 800,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    Y
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>
                    You (Me)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {isYouSelected ? 'Remainder:' : 'Excluded:'}
                  </span>
                  <strong style={{ fontSize: 12, color: isYouSelected ? 'var(--accent)' : 'var(--text-3)', fontWeight: 700 }}>
                    {fmtMoney(isYouSelected ? Math.max(0, (parseFloat(amount) || 0) - totalFriendsShare) : 0, s.currency)}
                  </strong>
                </div>
              </div>

              {/* Selected Friends Rows */}
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
                      gap: 8,
                      padding: '5px 10px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          ...getAvatarStyle(friendObj?.color),
                          fontSize: 9.5,
                          fontWeight: 700,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {friendObj?.type === 'vendor' ? <Store size={10} /> : (friendObj?.name[0]?.toUpperCase() || 'F')}
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {friendObj?.name || 'Friend'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.currency}</span>
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
                          padding: '3px 6px',
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
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

        {/* Bottom Floating Action & Dynamic Split Math Status */}
        <div style={{ padding: '8px 18px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          {selectedFriendIds.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                marginBottom: 10,
                padding: '5px 8px',
                background: 'var(--surface2)',
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
                        <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtMoney(myShare, s.currency)}</strong>
                      </div>
                    ) : unallocated > 0.01 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                        <span style={{ color: '#ef4444' }}>Unallocated:</span>
                        <strong style={{ color: '#ef4444', fontWeight: 700 }}>{fmtMoney(unallocated, s.currency)}</strong>
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
              onClick={onClose}
              style={{ borderRadius: 10, fontSize: 12, padding: '7px 0' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              style={{ borderRadius: 10, fontSize: 12, fontWeight: 700, padding: '7px 0' }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
