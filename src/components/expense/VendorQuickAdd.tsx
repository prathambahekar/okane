import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Store,
  User,
  Search,
  Plus,
  X,
  Check,
  ArrowLeft,
  RotateCcw,
  ChevronDown,
  Ban,
} from 'lucide-react';
import type { Friend } from '../../types';
import { getAvatarStyle, friendInitial } from '../../utils';
import { useBackButtonModal, BackPriority } from '../../utils/backHandler';
import FriendModal from '../FriendModal';

export interface VendorQuickAddProps {
  vendorId: string;
  setVendorId: (id: string) => void;
  vendorsList: Friend[];
  friendsList?: Friend[];
  addFriend?: (friend: Partial<Friend>) => Friend;
  showToast?: (msg: string) => void;
}

export function VendorQuickAdd({
  vendorId,
  setVendorId,
  vendorsList,
  friendsList = [],
  addFriend,
  showToast,
}: VendorQuickAddProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState<'vendor' | 'friend'>('vendor');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'friend' | 'vendor'>('all');

  // Register back button handler for this drawer
  useBackButtonModal(isDrawerOpen, () => setIsDrawerOpen(false), {
    priority: BackPriority.DIALOG,
  });

  // Combine vendors and friends into a single list with deduplication
  const combinedList = useMemo(() => {
    const map = new Map<string, Friend>();
    vendorsList.forEach(v => map.set(v.id, { ...v, type: 'vendor' }));
    friendsList.forEach(f => {
      if (!map.has(f.id)) {
        map.set(f.id, { ...f, type: (f.type || 'friend') as 'friend' | 'vendor' });
      }
    });
    return Array.from(map.values());
  }, [vendorsList, friendsList]);

  // Find currently selected contact
  const selectedContact = useMemo(() => {
    if (!vendorId) return null;
    return combinedList.find(c => c.id === vendorId) || null;
  }, [combinedList, vendorId]);

  const selectedIsFriend = selectedContact?.type === 'friend';

  // Filtered contacts based on search and type filter
  const filteredList = useMemo(() => {
    let list = combinedList;
    if (typeFilter !== 'all') {
      list = list.filter(c => (c.type || 'friend') === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [combinedList, typeFilter, searchQuery]);

  const hasExactMatch = useMemo(() => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return combinedList.some(c => c.name.toLowerCase().trim() === q);
  }, [combinedList, searchQuery]);

  const handleQuickAdd = (type: 'friend' | 'vendor') => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (addFriend) {
      const created = addFriend({ name: trimmed, type });
      if (created?.id) {
        setVendorId(created.id);
        showToast?.(`Added and selected ${created.name}`);
        setSearchQuery('');
        setIsDrawerOpen(false);
      }
    } else {
      setAddModalType(type);
      setShowAddModal(true);
    }
  };

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      {/* Field Label */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: 22,
          height: 22,
          marginBottom: 4,
        }}
      >
        <label
          className="form-label"
          style={{
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
          }}
        >
          {selectedContact ? (
            selectedIsFriend ? (
              <User size={12} style={{ color: 'var(--text-3)' }} />
            ) : (
              <Store size={12} style={{ color: 'var(--text-3)' }} />
            )
          ) : (
            <Store size={12} style={{ color: 'var(--text-3)' }} />
          )}
          <span>Paid To</span>
        </label>
      </div>

      {/* Trigger Button replacing raw <select> */}
      <button
        type="button"
        onClick={() => {
          setSearchQuery('');
          setTypeFilter('all');
          setIsDrawerOpen(true);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: 42,
          padding: '0 12px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          boxSizing: 'border-box',
          textAlign: 'left',
          transition: 'all 0.15s ease',
        }}
        aria-label="Select friend or store paid to"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          {selectedContact ? (
            <>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  ...getAvatarStyle(selectedContact.color),
                  fontSize: selectedContact.avatarNumber && selectedContact.avatarNumber.length > 2 ? 8 : 10,
                  fontWeight: 750,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  letterSpacing: '-0.2px',
                }}
              >
                {selectedContact.type === 'vendor' ? (
                  <Store size={11} />
                ) : (
                  friendInitial(selectedContact.name, selectedContact.avatarNumber)
                )}
              </div>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedContact.name}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
              None
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {selectedContact && (
            <div
              role="button"
              tabIndex={0}
              title="Clear payee"
              onClick={e => {
                e.stopPropagation();
                setVendorId('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  setVendorId('');
                }
              }}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--surface3)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text-3)',
                cursor: 'pointer',
              }}
            >
              <X size={11} />
            </div>
          )}
          <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />
        </div>
      </button>

      {/* Bottom Drawer Modal */}
      {isDrawerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="friend-picker-overlay"
            style={{ zIndex: 100095 }}
            onClick={e => {
              if (e.target === e.currentTarget) setIsDrawerOpen(false);
            }}
          >
            <div
              className="friend-picker-sheet"
              style={{ maxHeight: '86vh' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Grab Handle */}
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
                    onClick={() => setIsDrawerOpen(false)}
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
                      Paid To
                    </h3>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 2 }}>
                      {selectedContact
                        ? `Selected: ${selectedContact.name}`
                        : 'Select a friend or store who received payment'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setIsDrawerOpen(false)}
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
                {/* Search Input */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    background: searchFocused ? 'var(--surface)' : 'var(--surface2)',
                    border: searchFocused ? '1px solid var(--border2)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0 12px',
                    height: 38,
                    boxShadow: searchFocused ? '0 0 0 1px var(--border2)' : 'none',
                    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <Search
                    size={15}
                    style={{
                      color: searchFocused ? 'var(--text-2)' : 'var(--text-3)',
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
                    value={searchQuery}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-3)',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'grid',
                        placeItems: 'center',
                        marginRight: !hasExactMatch ? 6 : 0,
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                  {searchQuery.trim() && !hasExactMatch && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        style={{
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 700,
                          padding: '3px 8px',
                          height: 25,
                          borderRadius: 'var(--radius-full)',
                          whiteSpace: 'nowrap',
                          background: 'var(--surface3)',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                        onClick={() => handleQuickAdd('vendor')}
                      >
                        <Store size={11} /> +Store
                      </button>
                      <button
                        type="button"
                        style={{
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 700,
                          padding: '3px 8px',
                          height: 25,
                          borderRadius: 'var(--radius-full)',
                          whiteSpace: 'nowrap',
                          background: 'var(--text)',
                          color: 'var(--bg)',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                        onClick={() => handleQuickAdd('friend')}
                      >
                        <User size={11} /> +Friend
                      </button>
                    </div>
                  )}
                </div>

                {/* Filter Chips & Add New Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
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
                      const isSel = typeFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setTypeFilter(f.id)}
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

                  {/* Add New Contact / Store Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAddModalType(typeFilter === 'vendor' ? 'vendor' : 'friend');
                      setShowAddModal(true);
                    }}
                    style={{
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0 12px',
                      height: 32,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Plus size={13} />
                    <span>New</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Contact Grid (2 Columns, matching FriendSplitModal) */}
              <div
                style={{
                  padding: '10px 18px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                  }}
                >
                  {/* Option 1: None (No recipient) */}
                  {(!searchQuery.trim() || 'none'.includes(searchQuery.toLowerCase().trim())) && (
                    <div
                      onClick={() => setVendorId('')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-md)',
                        background: !vendorId ? 'var(--surface3)' : 'var(--surface2)',
                        border: !vendorId ? '1px solid var(--border2)' : '1px solid var(--border)',
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
                            background: 'rgba(113, 113, 122, 0.12)',
                            color: 'var(--text-3)',
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 750,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Ban size={13} />
                        </div>
                        <span
                          style={{
                            fontSize: 'var(--fs-xs)',
                            fontWeight: !vendorId ? 700 : 550,
                            color: !vendorId ? 'var(--text)' : 'var(--text-2)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          None
                        </span>
                      </div>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: !vendorId ? 'var(--text)' : 'transparent',
                          border: !vendorId ? '1px solid var(--text)' : '1.5px solid var(--border2)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {!vendorId && <Check size={11} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
                      </div>
                    </div>
                  )}

                  {/* Contact Options */}
                  {filteredList.map(contact => {
                    const isSel = vendorId === contact.id;
                    return (
                      <div
                        key={contact.id}
                        onClick={() => {
                          if (isSel) {
                            setVendorId('');
                          } else {
                            setVendorId(contact.id);
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
                          border: isSel ? '1px solid var(--border2)' : '1px solid var(--border)',
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
                              ...getAvatarStyle(contact.color),
                              fontSize:
                                contact.avatarNumber && contact.avatarNumber.length > 2 ? 9 : 11,
                              fontWeight: 750,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              letterSpacing: '-0.2px',
                            }}
                          >
                            {contact.type === 'vendor' ? (
                              <Store size={13} />
                            ) : (
                              friendInitial(contact.name, contact.avatarNumber)
                            )}
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
                            {contact.name}
                          </span>
                        </div>

                        {/* Single Select Indicator */}
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

                {filteredList.length === 0 && searchQuery.trim() && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px 16px',
                      color: 'var(--text-3)',
                      fontSize: 'var(--fs-sm)',
                    }}
                  >
                    No contacts or stores matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div
                style={{
                  padding: '12px 18px calc(14px + env(safe-area-inset-bottom, 0px))',
                  background: 'var(--surface)',
                  flexShrink: 0,
                  borderTop: '1px solid var(--border)',
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
                      setVendorId('');
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
                    onClick={() => setIsDrawerOpen(false)}
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
                      background: 'var(--text)',
                      color: 'var(--bg)',
                      border: 'none',
                      boxShadow: 'var(--shadow-md)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Check size={16} strokeWidth={2.5} />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Add Friend / Store Modal */}
      {showAddModal && (
        <FriendModal
          defaultType={addModalType}
          onClose={() => setShowAddModal(false)}
          onSuccess={created => {
            if (created?.id) {
              setVendorId(created.id);
              showToast?.(`Selected ${created.name}`);
            }
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}
