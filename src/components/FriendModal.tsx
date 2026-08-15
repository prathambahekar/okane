import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Store, Tv, Pipette } from 'lucide-react';
import { useStore } from '../store';
import type { Friend, ContactType } from '../types';
import { FRIEND_PALETTE } from '../db';
import { getAvatarStyle } from '../utils';
import { POPULAR_SUBSCRIPTIONS, renderBrandLogo, detectBrandPreset } from './BrandIcons';

interface Props {
  friend?: Friend | null;
  defaultType?: ContactType;
  onClose: () => void;
}

export default function FriendModal({ friend, defaultType = 'friend', onClose }: Props) {
  const { db, addFriend, updateFriend, showToast } = useStore();
  const [type, setType] = useState<ContactType>(friend?.type ?? defaultType);
  const [name, setName] = useState(friend?.name ?? '');
  const [category, setCategory] = useState(friend?.category ?? (db.settings.categories[0]?.name || 'Food'));
  const [defaultAmount, setDefaultAmount] = useState(friend?.defaultAmount ? String(friend.defaultAmount) : '');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'custom' | 'one_time'>(friend?.billingCycle ?? 'monthly');
  const [website, setWebsite] = useState(friend?.website ?? '');
  const [notes, setNotes] = useState(friend?.notes ?? '');
  const [color, setColor] = useState(() => friend?.color ?? FRIEND_PALETTE[Math.floor(Math.random() * FRIEND_PALETTE.length)]);
  const [avatarNumber, setAvatarNumber] = useState(friend?.avatarNumber ?? '');
  const [showNumberPicker, setShowNumberPicker] = useState(() => Boolean(friend?.avatarNumber));
  const [error, setError] = useState('');
  const friendColorInputRef = useRef<HTMLInputElement>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (type === 'subscription' && !friend) {
      const match = detectBrandPreset(val);
      if (match) {
        if (!defaultAmount && match.defaultAmount) setDefaultAmount(String(match.defaultAmount));
        if (match.color) setColor(match.color);
        if (match.category) setCategory(match.category);
      }
    }
  };

  const applyPreset = (preset: typeof POPULAR_SUBSCRIPTIONS[0]) => {
    setName(preset.name);
    setColor(preset.color);
    setCategory(preset.category);
    if (preset.defaultAmount) setDefaultAmount(String(preset.defaultAmount));
    setBillingCycle(preset.billingCycle);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!friend && db.friends.some(f => f.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('A contact with this name already exists.'); return;
    }

    const payload: Partial<Friend> = {
      name: name.trim(),
      type,
      category: type !== 'friend' ? category : undefined,
      defaultAmount: type === 'subscription' && defaultAmount ? parseFloat(defaultAmount) : undefined,
      billingCycle: type === 'subscription' ? billingCycle : undefined,
      website: website.trim(),
      notes: notes.trim(),
      color,
      avatarNumber: type === 'friend' && avatarNumber.trim() ? avatarNumber.trim() : undefined,
    };

    if (friend) {
      updateFriend(friend.id, payload);
      showToast(`${type === 'vendor' ? 'Vendor' : type === 'subscription' ? 'Subscription' : 'Friend'} updated`);
    } else {
      addFriend(payload);
      showToast(`${type === 'vendor' ? 'Vendor' : type === 'subscription' ? 'Subscription' : 'Friend'} added`);
    }
    onClose();
  };

  const namePlaceholder =
    type === 'vendor'
      ? 'e.g. Tiffin Aunty, Amazon, Local Grocer'
      : type === 'subscription'
      ? 'e.g. Netflix, Spotify, ChatGPT'
      : 'e.g. Alex, Priya, Rahul';

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: '100%', maxWidth: 440 }}>
        {/* Drag Handle Indicator for Mobile Bottom Sheet */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        <div className="modal-header" style={{ padding: '12px 16px' }}>
          <span className="modal-title" style={{ fontSize: 15 }}>
            {friend ? 'Edit Contact' : type === 'subscription' ? 'Add Subscription' : type === 'vendor' ? 'Add Vendor' : 'Add Friend'}
          </span>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Type Selector (Compact 3-column pill segment) */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>Contact Type</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 4,
                    background: 'var(--surface2)',
                    padding: 3,
                    borderRadius: 10,
                    border: '1px solid var(--border2)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setType('friend')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      padding: '6px 4px',
                      borderRadius: 7,
                      border: type === 'friend' ? '1px solid var(--border2)' : '1px solid transparent',
                      background: type === 'friend' ? 'var(--surface)' : 'transparent',
                      color: type === 'friend' ? 'var(--text-1)' : 'var(--text-3)',
                      fontWeight: type === 'friend' ? 600 : 500,
                      fontSize: 12,
                      cursor: 'pointer',
                      boxShadow: type === 'friend' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                      height: 34,
                    }}
                  >
                    <User size={15} />
                    <span>Friend</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('vendor')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      padding: '6px 4px',
                      borderRadius: 7,
                      border: type === 'vendor' ? '1px solid var(--border2)' : '1px solid transparent',
                      background: type === 'vendor' ? 'var(--surface)' : 'transparent',
                      color: type === 'vendor' ? 'var(--text-1)' : 'var(--text-3)',
                      fontWeight: type === 'vendor' ? 600 : 500,
                      fontSize: 12,
                      cursor: 'pointer',
                      boxShadow: type === 'vendor' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                      height: 34,
                    }}
                  >
                    <Store size={15} />
                    <span>Vendor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('subscription')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      padding: '6px 4px',
                      borderRadius: 7,
                      border: type === 'subscription' ? '1px solid var(--border2)' : '1px solid transparent',
                      background: type === 'subscription' ? 'var(--surface)' : 'transparent',
                      color: type === 'subscription' ? 'var(--text-1)' : 'var(--text-3)',
                      fontWeight: type === 'subscription' ? 600 : 500,
                      fontSize: 12,
                      cursor: 'pointer',
                      boxShadow: type === 'subscription' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                      height: 34,
                    }}
                  >
                    <Tv size={15} />
                    <span>Subscription</span>
                  </button>
                </div>
              </div>

              {/* Popular Subscription Presets Bar */}
              {type === 'subscription' && (
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600, margin: 0, color: 'var(--text-3)' }}>
                      Popular Presets
                    </label>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Tap to fill</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      overflowX: 'auto',
                      paddingBottom: 4,
                      WebkitOverflowScrolling: 'touch',
                      width: '100%',
                    }}
                  >
                    {POPULAR_SUBSCRIPTIONS.map(sub => {
                      const logo = renderBrandLogo(sub.logoKey, 14);
                      const isSelected = name.toLowerCase() === sub.name.toLowerCase();
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => applyPreset(sub)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 16,
                            border: `1px solid ${isSelected ? sub.color : 'var(--border)'}`,
                            background: isSelected ? `${sub.color}22` : 'var(--surface2)',
                            color: isSelected ? 'var(--text-1)' : 'var(--text-2)',
                            fontSize: 11.5,
                            fontWeight: isSelected ? 700 : 500,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            flexShrink: 0,
                            height: 28,
                          }}
                        >
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              background: sub.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {logo || <Tv size={10} color="#fff" />}
                          </span>
                          <span>{sub.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Name Input */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                  {type === 'vendor' ? 'Vendor Name *' : type === 'subscription' ? 'Subscription Name *' : 'Name *'}
                </label>
                <input
                  className="form-input"
                  style={{ height: 38, minHeight: 38, padding: '6px 12px', fontSize: 13 }}
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder={namePlaceholder}
                />
              </div>

              {/* Category & Cost Grid Row */}
              {type === 'subscription' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Category</label>
                      <select
                        className="form-select"
                        style={{ height: 38, minHeight: 38, padding: '6px 10px', fontSize: 13 }}
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                      >
                        {db.settings.categories.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                        Cost ({db.settings.currency})
                      </label>
                      <input
                        className="form-input"
                        style={{ height: 38, minHeight: 38, padding: '6px 12px', fontSize: 13 }}
                        type="number"
                        step="any"
                        value={defaultAmount}
                        onChange={e => setDefaultAmount(e.target.value)}
                        placeholder="e.g. 649"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Billing Cycle</label>
                      <select
                        className="form-select"
                        style={{ height: 38, minHeight: 38, padding: '6px 10px', fontSize: 13 }}
                        value={billingCycle}
                        onChange={e => setBillingCycle(e.target.value as unknown as typeof billingCycle)}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom</option>
                        <option value="one_time">One Time</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>App / Web URL</label>
                      <input
                        className="form-input"
                        style={{ height: 38, minHeight: 38, padding: '6px 12px', fontSize: 13 }}
                        type="text"
                        value={website}
                        onChange={e => setWebsite(e.target.value)}
                        placeholder="https://netflix.com"
                      />
                    </div>
                  </div>
                </>
              ) : type === 'vendor' ? (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Category</label>
                  <select
                    className="form-select"
                    style={{ height: 38, minHeight: 38, padding: '6px 10px', fontSize: 13 }}
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    {db.settings.categories.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Avatar Theme Color */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>
                    Avatar Color
                  </label>
                  {type === 'friend' && (
                    <button
                      type="button"
                      onClick={() => setShowNumberPicker(!showNumberPicker)}
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: showNumberPicker || avatarNumber ? 'var(--accent)' : 'var(--text-3)',
                        background: showNumberPicker || avatarNumber ? 'var(--accent-soft)' : 'transparent',
                        border: '1px solid ' + (showNumberPicker || avatarNumber ? 'var(--accent)' : 'var(--border)'),
                        padding: '2px 8px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                      title="Secret option: Use custom number badge instead of initial"
                    >
                      <span># Number Badge</span>
                      {avatarNumber ? (
                        <span style={{ background: 'var(--accent)', color: '#fff', padding: '0 5px', borderRadius: 8, fontSize: 9, fontWeight: 700 }}>
                          {avatarNumber}
                        </span>
                      ) : null}
                    </button>
                  )}
                </div>
                <div
                  style={{
                    background: 'var(--surface2)',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Live Avatar Preview */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        ...getAvatarStyle(color),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: avatarNumber && avatarNumber.length > 2 ? 11 : 14,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {type === 'subscription' && renderBrandLogo(name, 20)
                        ? renderBrandLogo(name, 20)
                        : type === 'vendor'
                        ? <Store size={18} />
                        : type === 'subscription'
                        ? <Tv size={18} />
                        : (avatarNumber.trim() || (name ? name.slice(0, 1).toUpperCase() : <User size={18} />))}
                    </div>

                    {/* Swatches Grid */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="color-swatch-grid">
                        {FRIEND_PALETTE.map(c => {
                          const isSelected = color === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              className={`color-swatch ${isSelected ? 'selected' : ''}`}
                              onClick={() => setColor(c)}
                              style={{ background: c }}
                              aria-label={`Select color ${c}`}
                            />
                          );
                        })}

                        {/* Custom Color Picker Swatch */}
                        <button
                          type="button"
                          className={`color-swatch ${!FRIEND_PALETTE.includes(color) ? 'selected' : ''}`}
                          onClick={() => {
                            if (friendColorInputRef.current) {
                              try {
                                if ('showPicker' in friendColorInputRef.current && typeof friendColorInputRef.current.showPicker === 'function') {
                                  friendColorInputRef.current.showPicker();
                                  return;
                                }
                              } catch {
                                // Fallback
                              }
                              friendColorInputRef.current.click();
                            }
                          }}
                          style={{
                            background: !FRIEND_PALETTE.includes(color)
                              ? color
                              : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Pick custom color"
                        >
                          <Pipette size={12} color="#FFFFFF" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }} />
                        </button>

                        <input
                          ref={friendColorInputRef}
                          type="color"
                          value={color.startsWith('#') && color.length === 7 ? color : '#3B82F6'}
                          onChange={e => setColor(e.target.value)}
                          style={{
                            position: 'absolute',
                            opacity: 0,
                            width: 1,
                            height: 1,
                            pointerEvents: 'none',
                            visibility: 'hidden',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Secret Number Option Box */}
                  {type === 'friend' && showNumberPicker && (
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: '1px dashed var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>Secret Number Badge (0 to 99)</span>
                        </span>
                        {avatarNumber ? (
                          <button
                            type="button"
                            onClick={() => setAvatarNumber('')}
                            style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            Reset to Initial ({name ? name.slice(0, 1).toUpperCase() : 'A'})
                          </button>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          maxLength={2}
                          placeholder="0-99"
                          value={avatarNumber}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                            setAvatarNumber(val);
                          }}
                          style={{
                            width: 68,
                            padding: '4px 8px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            textAlign: 'center',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          {['00', '07', '10', '23', '35', '69', '99'].map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setAvatarNumber(num)}
                              style={{
                                padding: '2px 7px',
                                fontSize: 10.5,
                                fontWeight: 600,
                                borderRadius: 5,
                                border: avatarNumber === num ? '1px solid var(--accent)' : '1px solid var(--border)',
                                background: avatarNumber === num ? 'var(--accent-soft)' : 'var(--surface)',
                                color: avatarNumber === num ? 'var(--accent)' : 'var(--text-2)',
                                cursor: 'pointer',
                                transition: 'all 0.1s ease',
                              }}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Notes</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 46, height: 46, padding: '6px 12px', fontSize: 12.5 }}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>

              {error && <p className="form-error">{error}</p>}
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '10px 16px' }}>
            <button type="button" className="btn btn-secondary btn-sm" style={{ height: 36, fontSize: 13 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" style={{ height: 36, fontSize: 13, minWidth: 80 }}>
              {friend ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
