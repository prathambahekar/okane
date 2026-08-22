import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Store,
  Tv,
  Pipette,
  FileText,
  Calendar,
  Sparkles,
  Repeat,
  Check,
} from 'lucide-react';
import { useStore } from '../store';
import type { Friend, ContactType } from '../types';
import { FRIEND_PALETTE } from '../db';
import { getAvatarStyle } from '../utils';
import { POPULAR_SUBSCRIPTIONS, renderBrandLogo, detectBrandPreset } from './BrandIcons';
import { NoteEditorModal } from './common/NoteEditorModal';

interface Props {
  friend?: Friend | null;
  defaultType?: ContactType;
  onClose: () => void;
  onSuccess?: (createdFriend: Friend) => void;
}

interface CycleChoice {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeType?: 'accent' | 'success' | 'neutral';
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
}

const BILLING_CYCLE_CHOICES: CycleChoice[] = [
  {
    id: 'monthly',
    title: 'Monthly',
    subtitle: 'Billed once every month (30 days)',
    badge: 'Popular',
    badgeType: 'accent',
    icon: Calendar,
  },
  {
    id: 'yearly',
    title: 'Yearly / Annual',
    subtitle: 'Billed once every 12 months (annual plan)',
    badge: 'Save ~15%',
    badgeType: 'success',
    icon: Sparkles,
  },
  {
    id: 'custom',
    title: 'Custom Months',
    subtitle: 'Custom recurring period (e.g., 3 months, 6 months)',
    badge: 'Flexible',
    badgeType: 'neutral',
    icon: Repeat,
  },
];

const getCycleDisplayInfo = (cycle: string, amountStr?: string, currency = '₹') => {
  const amount = parseFloat(amountStr || '0') || 0;
  if (cycle === 'monthly') {
    return {
      title: 'Monthly Billing',
      sub: amount > 0 ? `Renews every month • ≈ ${currency} ${(amount * 12).toLocaleString()}/yr` : 'Renews every month (30 days)',
      badge: 'Monthly',
    };
  }
  if (cycle === 'yearly') {
    return {
      title: 'Yearly / Annual Billing',
      sub: amount > 0 ? `Renews annually • ≈ ${currency} ${(amount / 12).toFixed(1)}/mo` : 'Billed once a year (12 months)',
      badge: 'Yearly',
    };
  }
  // Custom months format (e.g., "every 3 months" or "3 months" or "custom")
  const match = cycle.match(/(\d+)/);
  const months = match ? parseInt(match[1]) : 3;
  return {
    title: `Every ${months} Month${months > 1 ? 's' : ''}`,
    sub: amount > 0 ? `Renews every ${months} mo • ≈ ${currency} ${(amount / months).toFixed(1)}/mo` : `Custom cycle: billed every ${months} months`,
    badge: `${months} Months`,
  };
};

export default function FriendModal({ friend, defaultType = 'friend', onClose, onSuccess }: Props) {
  const { db, addFriend, updateFriend, showToast } = useStore();
  const [type, setType] = useState<ContactType>(friend?.type ?? defaultType);
  const [name, setName] = useState(friend?.name ?? '');
  const [category, setCategory] = useState(friend?.category ?? (db.settings.categories[0]?.name || 'Food'));
  const [defaultAmount, setDefaultAmount] = useState(friend?.defaultAmount ? String(friend.defaultAmount) : '');
  const [billingCycle, setBillingCycle] = useState<string>(friend?.billingCycle ?? 'monthly');
  const [website] = useState(friend?.website ?? '');
  const [notes, setNotes] = useState(friend?.notes ?? '');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // Billing Cycle Drawer State
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [tempCycle, setTempCycle] = useState<string>(() => {
    if (!friend?.billingCycle) return 'monthly';
    if (friend.billingCycle === 'monthly' || friend.billingCycle === 'yearly') return friend.billingCycle;
    return 'custom';
  });
  const [customMonths, setCustomMonths] = useState<number>(() => {
    if (friend?.billingCycle) {
      const match = friend.billingCycle.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
    return 3;
  });

  const [color, setColor] = useState(() => friend?.color ?? FRIEND_PALETTE[Math.floor(Math.random() * FRIEND_PALETTE.length)]);
  const [avatarNumber, setAvatarNumber] = useState(friend?.avatarNumber ?? '');
  const [showNumberPicker, setShowNumberPicker] = useState(() => Boolean(friend?.avatarNumber));
  const [error, setError] = useState('');
  const friendColorInputRef = useRef<HTMLInputElement>(null);

  const openNoteModal = () => {
    setIsNoteModalOpen(true);
  };

  const openCycleModal = () => {
    if (billingCycle === 'monthly' || billingCycle === 'yearly') {
      setTempCycle(billingCycle);
    } else {
      setTempCycle('custom');
      const match = billingCycle.match(/(\d+)/);
      if (match) setCustomMonths(parseInt(match[1]) || 3);
    }
    setIsCycleModalOpen(true);
  };

  const saveCycleFromModal = () => {
    if (tempCycle === 'custom') {
      setBillingCycle(`every ${customMonths} months`);
    } else {
      setBillingCycle(tempCycle);
    }
    setIsCycleModalOpen(false);
  };

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
      const created = addFriend(payload);
      showToast(`${type === 'vendor' ? 'Vendor' : type === 'subscription' ? 'Subscription' : 'Friend'} added`);
      if (onSuccess) {
        onSuccess(created);
      }
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
      <div className="modal friend-drawer-modal">
        {/* Drag Handle Indicator for Mobile Bottom Sheet */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        <div className="modal-header" style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none' }}>
          <span className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {friend ? (type === 'subscription' ? 'Edit Subscription' : type === 'vendor' ? 'Edit Vendor' : 'Edit Friend') : type === 'subscription' ? 'Add Subscription' : type === 'vendor' ? 'Add Vendor' : 'Add Friend'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn-icon"
              onClick={openNoteModal}
              title={notes ? `Note: "${notes}"` : 'Add note'}
              style={{
                width: 32,
                height: 32,
                position: 'relative',
                color: notes ? 'var(--accent)' : 'var(--text-2)',
                background: notes ? 'var(--accent-soft)' : 'var(--surface2)',
                border: notes ? '1px solid var(--accent-border-soft)' : '1px solid var(--border)',
                borderRadius: 8,
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={16} />
              {notes && (
                <span
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
              )}
            </button>
            <button
              type="button"
              className="btn-icon compact-close-btn"
              onClick={onClose}
              aria-label="Close modal"
              style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Type Selector (Segmented 3-tab control) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>
                  Contact Type
                </label>
                <div
                  className="segment-control"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 4,
                    background: 'var(--surface2)',
                    padding: 3,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                  }}
                >
                  <button
                    type="button"
                    className={`segment-btn ${type === 'friend' ? 'active-accent' : ''}`}
                    onClick={() => setType('friend')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 6px',
                      borderRadius: 9,
                      border: type === 'friend' ? '1px solid var(--accent-border-soft, var(--accent))' : '1px solid transparent',
                      background: type === 'friend' ? 'var(--accent-soft)' : 'transparent',
                      color: type === 'friend' ? 'var(--accent)' : 'var(--text-2)',
                      fontWeight: type === 'friend' ? 650 : 500,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      boxShadow: type === 'friend' ? '0 1px 3px var(--accent-soft)' : 'none',
                      minHeight: 38,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <User size={15} style={{ color: type === 'friend' ? 'var(--accent)' : 'inherit' }} />
                    <span>Friend</span>
                  </button>

                  <button
                    type="button"
                    className={`segment-btn ${type === 'vendor' ? 'active-accent' : ''}`}
                    onClick={() => setType('vendor')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 6px',
                      borderRadius: 9,
                      border: type === 'vendor' ? '1px solid var(--accent-border-soft, var(--accent))' : '1px solid transparent',
                      background: type === 'vendor' ? 'var(--accent-soft)' : 'transparent',
                      color: type === 'vendor' ? 'var(--accent)' : 'var(--text-2)',
                      fontWeight: type === 'vendor' ? 650 : 500,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      boxShadow: type === 'vendor' ? '0 1px 3px var(--accent-soft)' : 'none',
                      minHeight: 38,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Store size={15} style={{ color: type === 'vendor' ? 'var(--accent)' : 'inherit' }} />
                    <span>Vendor</span>
                  </button>

                  <button
                    type="button"
                    className={`segment-btn ${type === 'subscription' ? 'active-accent' : ''}`}
                    onClick={() => setType('subscription')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 6px',
                      borderRadius: 9,
                      border: type === 'subscription' ? '1px solid var(--accent-border-soft, var(--accent))' : '1px solid transparent',
                      background: type === 'subscription' ? 'var(--accent-soft)' : 'transparent',
                      color: type === 'subscription' ? 'var(--accent)' : 'var(--text-2)',
                      fontWeight: type === 'subscription' ? 650 : 500,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      boxShadow: type === 'subscription' ? '0 1px 3px var(--accent-soft)' : 'none',
                      minHeight: 38,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Tv size={15} style={{ color: type === 'subscription' ? 'var(--accent)' : 'inherit' }} />
                    <span>Subscription</span>
                  </button>
                </div>
              </div>

              {/* Popular Subscription Presets */}
              {type === 'subscription' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600, margin: 0, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Popular Presets
                    </label>
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Tap to fill</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      width: '100%',
                    }}
                  >
                    {POPULAR_SUBSCRIPTIONS.slice(0, 4).map(sub => {
                      const isSelected = name.toLowerCase() === sub.name.toLowerCase();
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => applyPreset(sub)}
                          style={{
                            padding: '5px 11px',
                            borderRadius: 8,
                            border: `1px solid ${isSelected ? 'var(--accent-border-soft, var(--accent))' : 'var(--border)'}`,
                            background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                            color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                            fontSize: 12,
                            fontWeight: isSelected ? 650 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Name Input */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                  {type === 'vendor' ? 'Vendor Name *' : type === 'subscription' ? 'Subscription Name *' : 'Name *'}
                </label>
                <input
                  className="form-input"
                  style={{ height: 40, minHeight: 40, padding: '8px 12px', fontSize: 13, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder={namePlaceholder}
                />
              </div>

              {/* Category & Cost Grid Row */}
              {type === 'subscription' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                        Category
                      </label>
                      <select
                        className="form-select"
                        style={{ height: 40, minHeight: 40, padding: '6px 10px', fontSize: 12.5, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                      >
                        {db.settings.categories.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                        Cost ({db.settings.currency})
                      </label>
                      <input
                        className="form-input"
                        style={{ height: 40, minHeight: 40, padding: '6px 10px', fontSize: 12.5, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        type="number"
                        step="any"
                        value={defaultAmount}
                        onChange={e => setDefaultAmount(e.target.value)}
                        placeholder="e.g. 649"
                      />
                    </div>
                  </div>

                  {/* Interactive Billing Cycle Banner Card */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={openCycleModal}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '9px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border-soft, var(--accent))')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          <Repeat size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getCycleDisplayInfo(billingCycle, defaultAmount, db.settings.currency).title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getCycleDisplayInfo(billingCycle, defaultAmount, db.settings.currency).sub}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'var(--accent-gradient, var(--accent))',
                          color: 'var(--accent-contrast, #ffffff)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 650,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          flexShrink: 0,
                          boxShadow: '0 1px 3px var(--accent-soft)',
                        }}
                      >
                        <span>+ {getCycleDisplayInfo(billingCycle, defaultAmount, db.settings.currency).badge}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : type === 'vendor' ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                    Category
                  </label>
                  <select
                    className="form-select"
                    style={{ height: 40, minHeight: 40, padding: '6px 12px', fontSize: 12.5, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    {db.settings.categories.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Minimized Avatar Theme Color Row */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>
                    Avatar Color
                  </label>
                  {type === 'friend' && (
                    <button
                      type="button"
                      onClick={() => setShowNumberPicker(!showNumberPicker)}
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: showNumberPicker || avatarNumber ? 'var(--accent)' : 'var(--text-2)',
                        background: showNumberPicker || avatarNumber ? 'var(--accent-soft)' : 'var(--surface2)',
                        border: '1px solid ' + (showNumberPicker || avatarNumber ? 'var(--accent-border-soft)' : 'var(--border)'),
                        padding: '2px 8px',
                        borderRadius: 10,
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
                        <span style={{ background: 'var(--accent)', color: 'var(--accent-contrast, #fff)', padding: '0 4px', borderRadius: 6, fontSize: 8.5, fontWeight: 700 }}>
                          {avatarNumber}
                        </span>
                      ) : null}
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'var(--surface2)',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Mini Avatar Preview */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      ...getAvatarStyle(color),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: avatarNumber && avatarNumber.length > 2 ? 9 : 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                  >
                    {type === 'subscription' && renderBrandLogo(name, 14)
                      ? renderBrandLogo(name, 14)
                      : type === 'vendor'
                      ? <Store size={13} />
                      : type === 'subscription'
                      ? <Tv size={13} />
                      : (avatarNumber.trim() || (name ? name.slice(0, 1).toUpperCase() : <User size={13} />))}
                  </div>

                  {/* Compact Swatches */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                    {FRIEND_PALETTE.map(c => {
                      const isSelected = color === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: c,
                            border: isSelected ? '2px solid var(--surface)' : '1px solid rgba(0,0,0,0.15)',
                            outline: isSelected ? '2px solid var(--accent)' : 'none',
                            outlineOffset: 1,
                            cursor: 'pointer',
                            padding: 0,
                            flexShrink: 0,
                            transition: 'transform 0.12s ease',
                            transform: isSelected ? 'scale(1.18)' : 'scale(1)',
                          }}
                          aria-label={`Select color ${c}`}
                        />
                      );
                    })}

                    {/* Custom Color Picker Swatch */}
                    <button
                      type="button"
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
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: !FRIEND_PALETTE.includes(color)
                          ? color
                          : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                        border: !FRIEND_PALETTE.includes(color) ? '2px solid var(--surface)' : '1px solid var(--border)',
                        outline: !FRIEND_PALETTE.includes(color) ? '2px solid var(--accent)' : 'none',
                        outlineOffset: 1,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      title="Pick custom color"
                    >
                      <Pipette size={9} color="#FFFFFF" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.8))' }} />
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

                {/* Secret Number Option Box */}
                {type === 'friend' && showNumberPicker && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-2)' }}>
                        Secret Number Badge (0 to 99)
                      </span>
                      {avatarNumber ? (
                        <button
                          type="button"
                          onClick={() => setAvatarNumber('')}
                          style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          Reset to Initial ({name ? name.slice(0, 1).toUpperCase() : 'A'})
                        </button>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                          width: 54,
                          padding: '4px 6px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
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
                              borderRadius: 6,
                              border: avatarNumber === num ? '1px solid var(--accent)' : '1px solid var(--border)',
                              background: avatarNumber === num ? 'var(--accent-soft)' : 'var(--surface)',
                              color: avatarNumber === num ? 'var(--accent)' : 'var(--text-2)',
                              cursor: 'pointer',
                              transition: 'all 0.12s ease',
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

              {error && <p className="form-error" style={{ margin: '2px 0 0' }}>{error}</p>}
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', gap: 10, background: 'var(--surface)', borderTop: 'none' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, height: 40, fontSize: 13, fontWeight: 600, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                flex: 1,
                height: 40,
                fontSize: 13,
                fontWeight: 650,
                borderRadius: 10,
                background: 'var(--accent-gradient, var(--accent))',
                color: 'var(--accent-contrast, #ffffff)',
                border: '1px solid var(--accent-dark, var(--accent))',
                boxShadow: '0 2px 8px var(--accent-soft)',
              }}
            >
              {friend ? 'Save' : 'Add'}
            </button>
          </div>
        </form>

        {/* Separate Dedicated Note Drawer Modal */}
        <NoteEditorModal
          isOpen={isNoteModalOpen}
          onClose={() => setIsNoteModalOpen(false)}
          title={type === 'subscription' ? 'Subscription Note' : type === 'vendor' ? 'Vendor Note' : 'Contact Note'}
          initialNote={notes}
          onSave={(newNote) => {
            setNotes(newNote);
          }}
          quickTags={
            type === 'subscription'
              ? ['Family plan share', 'Annual renewal', 'Card auto-debit', 'Shared with roomies', 'Free trial active']
              : type === 'vendor'
              ? ['Daily tiffin', 'UPI payment preferred', 'Monthly billing', 'Shop contact']
              : ['Roommate', 'Family', 'Office colleague', 'Splitwise friend', 'UPI ID']
          }
        />

        {/* Dedicated Billing Cycle Drawer Modal */}
        {isCycleModalOpen && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 10005, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setIsCycleModalOpen(false); }}
          >
            <div className="modal friend-drawer-modal" style={{ maxWidth: 420, maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface)', animation: 'slidein 0.15s ease' }}>
              <div className="modal-handle-bar">
                <div className="modal-handle" />
              </div>
              <div className="modal-header" style={{ padding: '14px 18px', borderBottom: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                    <Repeat size={15} />
                  </div>
                  <div>
                    <div className="modal-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                      Select Billing Cycle
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Choose how frequently this subscription recurs
                    </div>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setIsCycleModalOpen(false)} style={{ borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}><X size={16} /></button>
              </div>

              <div className="modal-body" style={{ padding: '12px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {BILLING_CYCLE_CHOICES.map(choice => {
                  const isSelected = tempCycle === choice.id;
                  const ChoiceIcon = choice.icon;
                  return (
                    <div
                      key={choice.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTempCycle(choice.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '11px 13px',
                        borderRadius: 10,
                        border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: isSelected ? 'var(--accent-gradient, var(--accent))' : 'var(--surface)',
                            color: isSelected ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <ChoiceIcon size={15} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--accent)' : 'var(--text-1)' }}>
                              {choice.title}
                            </span>
                            {choice.badge && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 99,
                                  background: choice.badgeType === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-soft)',
                                  color: choice.badgeType === 'success' ? 'var(--credit)' : 'var(--accent)',
                                  border: choice.badgeType === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--accent-border-soft)',
                                }}
                              >
                                {choice.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                            {choice.subtitle}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: isSelected ? 'none' : '1.5px solid var(--border2)',
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          color: 'var(--accent-contrast, #ffffff)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          marginLeft: 8,
                        }}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}

                {/* If Custom Months is selected, show streamlined month presets & input */}
                {tempCycle === 'custom' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--surface3, var(--surface))',
                      border: '1px solid var(--accent-border-soft, var(--border))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                        Select number of months:
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                        Every {customMonths} Month{customMonths > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Quick Month Chips */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                      {[2, 3, 6, 9].map(m => {
                        const isChipSelected = customMonths === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCustomMonths(m)}
                            style={{
                              padding: '5px 0',
                              fontSize: 11.5,
                              fontWeight: isChipSelected ? 700 : 500,
                              borderRadius: 8,
                              border: isChipSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                              background: isChipSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                              color: isChipSelected ? 'var(--accent)' : 'var(--text-2)',
                              cursor: 'pointer',
                            }}
                          >
                            {m} Mo
                          </button>
                        );
                      })}
                    </div>

                    {/* Stepper / Direct Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Or custom value:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)' }}
                          onClick={() => setCustomMonths(prev => Math.max(1, prev - 1))}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          className="form-input"
                          style={{ height: 28, textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '2px 6px', width: 60, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          value={customMonths}
                          onChange={e => setCustomMonths(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)' }}
                          onClick={() => setCustomMonths(prev => Math.min(60, prev + 1))}
                        >
                          +
                        </button>
                        <span style={{ fontSize: 11.5, color: 'var(--text-2)', marginLeft: 4 }}>months</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Live calculated equivalent preview if amount is entered */}
                {defaultAmount && parseFloat(defaultAmount) > 0 && (
                  <div
                    style={{
                      marginTop: 2,
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'var(--surface3, var(--surface))',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-around',
                      alignItems: 'center',
                      fontSize: 11,
                      color: 'var(--text-2)',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-3)', fontSize: 10 }}>Monthly Equivalent</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-1)', marginTop: 1 }}>
                        {db.settings.currency} {tempCycle === 'yearly'
                          ? (parseFloat(defaultAmount) / 12).toFixed(1)
                          : tempCycle === 'custom'
                          ? (parseFloat(defaultAmount) / customMonths).toFixed(1)
                          : parseFloat(defaultAmount).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-3)', fontSize: 10 }}>Annualized Cost</div>
                      <div style={{ fontWeight: 700, color: 'var(--accent)', marginTop: 1 }}>
                        {db.settings.currency} {tempCycle === 'yearly'
                          ? parseFloat(defaultAmount).toLocaleString()
                          : tempCycle === 'monthly'
                          ? (parseFloat(defaultAmount) * 12).toLocaleString()
                          : ((parseFloat(defaultAmount) / customMonths) * 12).toFixed(0)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: 'none', background: 'var(--surface)' }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ borderRadius: 8, fontSize: 12, height: 34, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} onClick={() => setIsCycleModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ borderRadius: 8, fontSize: 12, padding: '0 16px', height: 34, background: 'var(--accent-gradient, var(--accent))', color: 'var(--accent-contrast, #ffffff)', border: '1px solid var(--accent-dark, var(--accent))' }}
                  onClick={saveCycleFromModal}
                >
                  ✓ Apply Cycle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
