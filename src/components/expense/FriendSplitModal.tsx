import React, { useState, useMemo } from 'react';
import { X, Search, Plus, Store, Check, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import type { AppDB } from '../../types';
import { fmtMoney, currencySymbol, getAvatarStyle, friendInitial } from '../../utils';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';

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
  excludedFriendIds?: string[];
}

function CustomShareInputBox({
  currency,
  value,
  onChange,
}: {
  currency: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        background: isFocused ? 'var(--surface)' : 'rgba(255, 255, 255, 0.03)',
        border: isFocused ? '1.5px solid var(--credit)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '3px 8px',
        height: 30,
        minWidth: 72,
        maxWidth: 95,
        flexShrink: 0,
        boxShadow: isFocused ? '0 0 0 2.5px var(--credit-bg)' : 'none',
        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'text',
      }}
    >
      <span
        style={{
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          color: isFocused ? 'var(--credit)' : 'var(--text-3)',
          transition: 'color 0.15s ease',
          userSelect: 'none',
        }}
      >
        {currencySymbol(currency)}
      </span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onFocus={e => {
          setIsFocused(true);
          e.target.select();
        }}
        onBlur={() => setIsFocused(false)}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        style={{
          width: 48,
          textAlign: 'right',
          padding: 0,
          fontSize: 'var(--fs-sm)',
          fontWeight: 700,
          background: 'transparent',
          border: 'none',
          color: isFocused ? 'var(--text)' : 'var(--credit)',
          outline: 'none',
          fontVariantNumeric: 'tabular-nums',
          caretColor: 'var(--credit)',
        }}
      />
    </div>
  );
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
  excludedFriendIds,
}: FriendSplitModalProps) {
  const s = db.settings;
  const [currentStep, setCurrentStep] = useState<'select_friends' | 'split_rules'>('select_friends');
  const [pickerTypeFilter, setPickerTypeFilter] = useState<'all' | 'friend' | 'vendor'>('friend');
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSearchFocused, setPickerSearchFocused] = useState(false);

  const handleClose = () => {
    setCurrentStep('select_friends');
    setPickerTypeFilter('friend');
    setPickerSearch('');
    onClose();
  };

  const handleBack = () => {
    if (currentStep === 'split_rules') {
      setCurrentStep('select_friends');
    } else {
      handleClose();
    }
  };

  useBackButtonModal(isOpen, handleBack, { priority: BackPriority.DRAWER });

  const filteredFriendsList = useMemo(() => {
    let list = db.friends;
    if (excludedFriendIds && excludedFriendIds.length > 0) {
      list = list.filter(f => !excludedFriendIds.includes(f.id));
    }
    if (pickerTypeFilter !== 'all') {
      list = list.filter(f => (f.type || 'friend') === pickerTypeFilter);
    }
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase().trim();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }
    return list;
  }, [db.friends, pickerTypeFilter, pickerSearch, excludedFriendIds]);

  const totalAmount = parseFloat(amount) || 0;

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
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '12px auto 4px', flexShrink: 0 }} />

        {/* ========================================================================= */}
        {/* STEP 1: SELECT FRIENDS                                                    */}
        {/* ========================================================================= */}
        {currentStep === 'select_friends' && (
          <>
            {/* Header */}
            <div
              style={{
                padding: '12px 18px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={handleClose}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label="Back to expense drawer"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                    Split with Friends
                  </h3>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 2 }}>
                    {selectedFriendIds.length === 0
                      ? 'Select friends who share this bill'
                      : `${selectedFriendIds.length} friend${selectedFriendIds.length !== 1 ? 's' : ''} selected`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={handleClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-full)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div style={{ padding: '8px 18px 10px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
              {/* Row 1: Search Input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  background: pickerSearchFocused ? 'var(--surface)' : 'var(--surface2)',
                  border: pickerSearchFocused ? '1px solid var(--border2)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 12px',
                  height: 38,
                  boxShadow: pickerSearchFocused ? '0 0 0 1px var(--border2)' : 'none',
                  transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <Search
                  size={15}
                  style={{
                    color: pickerSearchFocused ? 'var(--text-2)' : 'var(--text-3)',
                    marginRight: 9,
                    flexShrink: 0,
                    transition: 'color 0.15s ease',
                  }}
                />
                <input
                  type="text"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 500,
                    color: 'var(--text)',
                    padding: '4px 0',
                  }}
                  placeholder="Search friends or stores..."
                  value={pickerSearch}
                  onFocus={() => setPickerSearchFocused(true)}
                  onBlur={() => setPickerSearchFocused(false)}
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
                    <X size={13} />
                  </button>
                )}
                {pickerSearch.trim() && !db.friends.some(f => f.name.toLowerCase() === pickerSearch.trim().toLowerCase()) && (
                  <button
                    type="button"
                    style={{
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      padding: '3px 10px',
                      height: 25,
                      borderRadius: 'var(--radius-full)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      background: 'var(--text)',
                      color: 'var(--bg)',
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
                          const denom = isYouSelected ? next.length + 1 : next.length;
                          const equalVal = totalAmount > 0 && denom > 0 ? String(Math.floor((totalAmount * 100) / denom) / 100) : '0';
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
                    <Plus size={12} strokeWidth={2.5} /> Add
                  </button>
                )}
              </div>

              {/* Row 2: Filter Chips & Select All Action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                {/* Filter Chips */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                  }}
                >
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'friend', label: 'Friends' },
                      { id: 'vendor', label: 'Stores' },
                    ] as const
                  ).map(f => {
                    const isSel = pickerTypeFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPickerTypeFilter(f.id)}
                        style={{
                          border: isSel ? '1px solid var(--text)' : '1px solid var(--border)',
                          background: isSel ? 'var(--text)' : 'var(--surface2)',
                          color: isSel ? 'var(--bg)' : 'var(--text-3)',
                          fontSize: 'var(--fs-sm)',
                          fontWeight: isSel ? 700 : 550,
                          padding: '0 14px',
                          borderRadius: 'var(--radius-full)',
                          height: 32,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isSel ? '0 1px 4px rgba(0, 0, 0, 0.18)' : 'none',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
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
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 650,
                    padding: '0 14px',
                    borderRadius: 'var(--radius-full)',
                    height: 32,
                    cursor: 'pointer',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  {filteredFriendsList.length > 0 && filteredFriendsList.every(f => selectedFriendIds.includes(f.id))
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>
            </div>

            {/* Friend Selection Grid (Full Height in Step 1) */}
            <div
              className="no-scrollbar"
              style={{
                flex: '0 1 auto',
                maxHeight: '52vh',
                overflowY: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                padding: '6px 18px 12px',
                background: 'var(--surface)',
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
                    <div style={{ padding: '36px 8px', textAlign: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                      No matching friends found
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
                    {showYouChip && (
                      <div
                        onClick={() => {
                          if (splitCalcMode === 'custom') {
                            const nextIncludeYou = !includeYouInCustom;
                            setIncludeYouInCustom(nextIncludeYou);
                            const n = selectedFriendIds.length;
                            if (n > 0 && totalAmount > 0) {
                              const denom = nextIncludeYou ? n + 1 : n;
                              const equalVal = String(Math.floor((totalAmount * 100) / denom) / 100);
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
                          borderRadius: 'var(--radius-md)',
                          background: isYouSelected ? 'var(--surface3)' : 'var(--surface2)',
                          border: '1px solid var(--border)',
                          boxShadow: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              ...getAvatarStyle('#3b82f6'),
                              fontSize: 'var(--fs-caption)',
                              fontWeight: 750,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            M
                          </div>
                          <span
                            style={{
                              fontSize: 'var(--fs-xs)',
                              fontWeight: isYouSelected ? 700 : 550,
                              color: isYouSelected ? 'var(--text)' : 'var(--text-2)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            Me
                          </span>
                        </div>
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: isYouSelected ? 'var(--text)' : 'transparent',
                            border: isYouSelected ? '1px solid var(--text)' : '1.5px solid var(--border2)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isYouSelected && <Check size={11} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
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
                                const denom = isYouSelected ? nextCount + 1 : nextCount;
                                const equalVal =
                                  totalAmount > 0 && denom > 0 ? String(Math.floor((totalAmount * 100) / denom) / 100) : '0';
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
                            borderRadius: 'var(--radius-md)',
                            background: isSel ? 'var(--surface3)' : 'var(--surface2)',
                            border: '1px solid var(--border)',
                            boxShadow: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                aspectRatio: '1 / 1',
                                ...getAvatarStyle(f.color),
                                fontSize: f.avatarNumber && f.avatarNumber.length > 2 ? 9 : 11,
                                fontWeight: 750,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                                letterSpacing: '-0.2px',
                              }}
                            >
                              {f.type === 'vendor' ? <Store size={13} /> : friendInitial(f.name, f.avatarNumber)}
                            </div>
                            <span
                              style={{
                                fontSize: 'var(--fs-xs)',
                                fontWeight: isSel ? 700 : 550,
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
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: isSel ? 'var(--text)' : 'transparent',
                              border: isSel ? '1px solid var(--text)' : '1.5px solid var(--border2)',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isSel && <Check size={11} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer Action for Step 1 */}
            <div
              style={{
                padding: '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))',
                background: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              <div
                className="modal-actions"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="btn btn-drawer-cancel"
                  onClick={() => {
                    setSelectedFriendIds([]);
                    setCustomFriendShares({});
                    if (splitCalcMode === 'equal_friends') {
                      handleSelectSplitCalcMode('equal_all');
                    }
                  }}
                  style={{
                    flex: 1,
                    height: 42,
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700,
                    fontSize: 'var(--fs-sm)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <RotateCcw size={14} style={{ color: 'var(--text)' }} />
                  <span>Clear</span>
                </button>

                <button
                  type="button"
                  className="btn btn-drawer-save-mono"
                  onClick={() => {
                    if (selectedFriendIds.length === 0) {
                      handleClose();
                    } else {
                      setCurrentStep('split_rules');
                    }
                  }}
                  style={{
                    flex: 1.35,
                    height: 42,
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700,
                    fontSize: 'var(--fs-sm)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    background: 'var(--text)',
                    border: '1px solid var(--text)',
                    color: 'var(--bg)',
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  {selectedFriendIds.length > 0 ? (
                    <>
                      <span>Next: Split Rule</span>
                      <ArrowRight size={15} strokeWidth={2.5} style={{ color: 'inherit' }} />
                    </>
                  ) : (
                    <>
                      <Check size={15} strokeWidth={2.5} style={{ color: 'inherit' }} />
                      <span>Done</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: SPLIT RULES & DISTRIBUTION                                        */}
        {/* ========================================================================= */}
        {currentStep === 'split_rules' && (
          <>
            {/* Header */}
            <div
              style={{
                padding: '16px 18px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setCurrentStep('select_friends')}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label="Back to friend selection"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                    Split Breakdown
                  </h3>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 2 }}>
                    {selectedFriendIds.length + (isYouSelected ? 1 : 0)} participant{selectedFriendIds.length + (isYouSelected ? 1 : 0) !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  {fmtMoney(totalAmount, s.currency)} Total
                </span>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={handleClose}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Split Rule Configuration Body */}
            <div
              className="no-scrollbar"
              style={{
                flex: '0 1 auto',
                maxHeight: '58vh',
                overflowY: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                padding: '6px 18px 10px',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Selected Friends Preview Strip */}
              <div
                className="no-scrollbar"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                  {isYouSelected && (
                    <span
                      style={{
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 650,
                        padding: '4px 10px 4px 5px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        borderRadius: 'var(--radius-full)',
                        color: 'var(--accent)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          ...getAvatarStyle('#3b82f6'),
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 800,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        M
                      </span>
                      <span>Me</span>
                    </span>
                  )}
                  {selectedFriendIds.map(fId => {
                    const friendObj = db.friends.find(f => f.id === fId);
                    const color = friendObj?.color || '#10b981';
                    const name = friendObj?.name || 'Friend';
                    const initial = name.charAt(0).toUpperCase();
                    const avStyle = getAvatarStyle(color);

                    return (
                      <span
                        key={fId}
                        style={{
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 600,
                          padding: '4px 10px 4px 5px',
                          background: `${color}18`,
                          borderRadius: 'var(--radius-full)',
                          color: 'var(--text)',
                          border: `1px solid ${color}35`,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            ...avStyle,
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 800,
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          {initial}
                        </span>
                        <span>{name}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Split Mode Selector Segmented Bar */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 4,
                    gap: 4,
                  }}
                >
                  {(
                    [
                      { id: 'equal_all', label: 'Equal' },
                      { id: 'equal_friends', label: 'Friends Only' },
                      { id: 'custom', label: 'Custom' },
                    ] as const
                  ).map(m => {
                    const isSel = splitCalcMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectSplitCalcMode(m.id)}
                        style={{
                          flex: 1,
                          border: isSel ? '1px solid var(--text)' : '1px solid transparent',
                          background: isSel ? 'var(--text)' : 'transparent',
                          color: isSel ? 'var(--bg)' : 'var(--text-3)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: isSel ? 700 : 550,
                          padding: '8px 8px',
                          borderRadius: 'var(--radius-md)',
                          minHeight: 38,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isSel ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Per-Person Calculation List */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {/* Me Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '11px 15px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    opacity: isYouSelected ? 1 : 0.75,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        ...getAvatarStyle('#3b82f6'),
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 750,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      M
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 650, color: 'var(--text)' }}>
                        Me
                      </div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 1 }}>
                        {isYouSelected
                          ? splitCalcMode === 'custom'
                            ? 'Remaining share'
                            : 'Equal split'
                          : 'Excluded (0%)'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--fs-base)',
                        color: isYouSelected ? 'var(--text)' : 'var(--text-3)',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {fmtMoney(
                        isYouSelected ? Math.max(0, totalAmount - totalFriendsShare) : 0,
                        s.currency
                      )}
                    </div>
                  </div>
                </div>

                {/* Friends Rows */}
                {selectedFriendIds.map(fId => {
                  const friendObj = db.friends.find(f => f.id === fId);
                  const shareVal = getFriendShare(fId);
                  const currentCustomInput = customFriendShares[fId] ?? String(shareVal);

                  return (
                    <div
                      key={fId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '11px 15px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            aspectRatio: '1 / 1',
                            ...getAvatarStyle(friendObj?.color),
                            fontSize: friendObj?.avatarNumber && friendObj.avatarNumber.length > 2 ? 10 : 12.5,
                            fontWeight: 750,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            letterSpacing: '-0.2px',
                          }}
                        >
                          {friendObj?.type === 'vendor' ? <Store size={15} /> : friendInitial(friendObj?.name, friendObj?.avatarNumber)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 'var(--fs-sm)',
                              fontWeight: 650,
                              color: 'var(--text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {friendObj?.name || 'Friend'}
                          </div>
                          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 1 }}>
                            {splitCalcMode === 'custom'
                              ? 'Custom share'
                              : (friendObj?.type === 'vendor' ? 'Store' : 'Friend')}
                          </div>
                        </div>
                      </div>

                      {splitCalcMode === 'custom' ? (
                        <CustomShareInputBox
                          currency={s.currency}
                          value={currentCustomInput}
                          onChange={val => {
                            setCustomFriendShares(prev => ({
                              ...prev,
                              [fId]: val,
                            }));
                          }}
                        />
                      ) : (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div
                            style={{
                              fontSize: 'var(--fs-base)',
                              color: 'var(--credit)',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {fmtMoney(shareVal, s.currency)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions for Step 2 */}
            <div
              style={{
                padding: '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))',
                background: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              <div
                className="modal-actions"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="btn btn-drawer-cancel"
                  onClick={() => {
                    handleSelectSplitCalcMode('equal_all');
                    setCustomFriendShares({});
                    setIncludeYouInCustom(true);
                    showToast('Split reset to default');
                  }}
                  style={{
                    flex: 1,
                    height: 42,
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700,
                    fontSize: 'var(--fs-sm)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <RotateCcw size={14} style={{ color: 'var(--text)' }} />
                  <span>Clear</span>
                </button>

                <button
                  type="button"
                  className="btn btn-drawer-save-mono"
                  onClick={handleClose}
                  style={{
                    flex: 1.35,
                    height: 42,
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700,
                    fontSize: 'var(--fs-sm)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    background: 'var(--text)',
                    border: '1px solid var(--text)',
                    color: 'var(--bg)',
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  <Check size={15} strokeWidth={2.5} style={{ color: 'inherit' }} />
                  <span>Apply Split</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

