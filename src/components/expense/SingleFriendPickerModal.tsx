import { useState, useMemo } from 'react';
import { X, Search, Plus, Store, Check, ArrowLeft, RotateCcw } from 'lucide-react';
import type { AppDB, Friend } from '../../types';
import { getAvatarStyle, friendInitial } from '../../utils';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';

interface SingleFriendPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFriendId: string;
  onSelectFriend: (friendId: string) => void;
  title?: string;
  subtitle?: string;
  db: AppDB;
  addFriend: (friend: { name: string; type: 'friend' | 'vendor' }) => { id: string; name: string };
  showToast: (msg: string) => void;
  defaultFilter?: 'all' | 'friend' | 'vendor';
  excludedFriendIds?: string[];
}

export function SingleFriendPickerModal({
  isOpen,
  onClose,
  selectedFriendId,
  onSelectFriend,
  title = 'Select Who Paid',
  subtitle = 'Select the person who paid for this expense',
  db,
  addFriend,
  showToast,
  defaultFilter = 'friend',
  excludedFriendIds,
}: SingleFriendPickerModalProps) {
  const [pickerTypeFilter, setPickerTypeFilter] = useState<'all' | 'friend' | 'vendor'>(defaultFilter);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSearchFocused, setPickerSearchFocused] = useState(false);

  const handleClose = () => {
    setPickerTypeFilter(defaultFilter);
    setPickerSearch('');
    onClose();
  };

  useBackButtonModal(isOpen, handleClose, { priority: BackPriority.DRAWER });

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

  const currentSelectedFriend = useMemo(() => {
    if (!selectedFriendId) return null;
    return db.friends.find(f => f.id === selectedFriendId) || null;
  }, [selectedFriendId, db.friends]);

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
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--border2)',
            margin: '12px auto 4px',
            flexShrink: 0,
          }}
        />

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
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'var(--fs-md)',
                  fontWeight: 700,
                  color: 'var(--text)',
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h3>
              <div
                style={{
                  fontSize: 'var(--fs-caption)',
                  color: 'var(--text-3)',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 220,
                }}
              >
                {currentSelectedFriend ? `Selected: ${currentSelectedFriend.name}` : subtitle}
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
        <div
          style={{
            padding: '8px 18px 10px',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            flexShrink: 0,
          }}
        >
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
                  marginRight: !db.friends.some(
                    f => f.name.toLowerCase() === pickerSearch.trim().toLowerCase()
                  )
                    ? 6
                    : 0,
                }}
              >
                <X size={13} />
              </button>
            )}
            {pickerSearch.trim() &&
              !db.friends.some(
                f => f.name.toLowerCase() === pickerSearch.trim().toLowerCase()
              ) && (
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
                    const friendType = pickerTypeFilter === 'vendor' ? 'vendor' : 'friend';
                    const created = addFriend({ name: pickerSearch.trim(), type: friendType });
                    onSelectFriend(created.id);
                    showToast(`Added ${created.name}`);
                    setPickerSearch('');
                  }}
                >
                  <Plus size={12} strokeWidth={2.5} /> Add
                </button>
              )}
          </div>

          {/* Row 2: Filter Chips */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
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
          </div>
        </div>

        {/* Friend Selection Grid */}
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
          {filteredFriendsList.length === 0 ? (
            <div
              style={{
                padding: '36px 8px',
                textAlign: 'center',
                fontSize: 'var(--fs-xs)',
                color: 'var(--text-3)',
              }}
            >
              No matching friends found
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
              {filteredFriendsList.map((f: Friend) => {
                const isSel = selectedFriendId === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => {
                      if (isSel) {
                        onSelectFriend('');
                      } else {
                        onSelectFriend(f.id);
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
                      border: isSel ? '1px solid var(--text)' : '1px solid var(--border)',
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
          )}
        </div>

        {/* Footer Actions */}
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
                onSelectFriend('');
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
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
