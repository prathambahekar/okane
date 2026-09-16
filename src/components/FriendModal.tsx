import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  X,
  User,
  Store,
  Tv,
  Pipette,
  Feather,
  RotateCcw,
  Plus,
  Calendar,
  Sparkles,
  Repeat,
  Check,
  Hash,
} from 'lucide-react';
import { useStore } from '../store';
import type { Friend, ContactType } from '../types';
import { FRIEND_PALETTE } from '../db';
import { getAvatarStyle } from '../utils';
import { POPULAR_SUBSCRIPTIONS, detectBrandPreset } from './BrandIcons';
import { NoteEditorModal } from './common/NoteEditorModal';
import { showSoftKeyboard } from '../utils/keyboard';

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

const getCycleDisplayInfo = (cycle: string) => {
  if (cycle === 'monthly') {
    return {
      title: 'Monthly Billing',
      sub: '',
      badge: 'Monthly',
    };
  }
  if (cycle === 'yearly') {
    return {
      title: 'Yearly Billing',
      sub: '',
      badge: 'Yearly',
    };
  }
  // Custom months format (e.g., "every 3 months" or "3 months" or "custom")
  const match = cycle.match(/(\d+)/);
  const months = match ? parseInt(match[1]) : 3;
  return {
    title: `Every ${months} Month${months > 1 ? 's' : ''}`,
    sub: '',
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
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input when contact/vendor/subscription modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nameInputRef.current) {
        showSoftKeyboard(nameInputRef.current, { placeCursorAtEnd: true, scroll: true });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, []);

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

  const handleClear = () => {
    setName('');
    setType(defaultType);
    setColor(friend?.color ?? FRIEND_PALETTE[0]);
    setAvatarNumber('');
    setShowNumberPicker(false);
    setDefaultAmount('');
    setBillingCycle('monthly');
    setNotes('');
    setError('');
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
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

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return createPortal(
    <div className="modal-backdrop-motion">
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="modal-backdrop-overlay"
        onClick={onClose}
      />

      {/* Sheet panel / Desktop center dialog */}
      <motion.div
        initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="modal friend-drawer-modal modal-dialog-panel"
        onClick={e => e.stopPropagation()}
      >
        {/* Top drag handle pill */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 'var(--radius-xs)',
            background: 'var(--border2)',
            margin: '0 auto 16px',
          }}
        />

        {/* Themed Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '0 20px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              {type === 'subscription' ? <Tv size={19} /> : type === 'vendor' ? <Store size={19} /> : <User size={19} />}
            </div>
            <div>
              <span className="modal-title" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>
                {friend
                  ? (type === 'subscription' ? 'Edit Subscription' : type === 'vendor' ? 'Edit Vendor' : 'Edit Friend')
                  : (type === 'subscription' ? 'New Subscription' : type === 'vendor' ? 'New Vendor' : 'New Contact')}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn-icon"
              onClick={openNoteModal}
              title={notes ? `Note: "${notes}"` : 'Add note'}
              aria-label={notes ? 'Edit note' : 'Add note'}
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: notes ? 'var(--text)' : 'var(--text-3)',
                background: notes ? 'var(--surface2)' : 'transparent',
                border: notes ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Feather size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px', gap: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Type Selector (Segmented 3-tab control) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    color: 'var(--text-3)',
                    marginBottom: 6,
                    textAlign: 'left',
                  }}
                >
                  Contact Type
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 4,
                    background: 'var(--surface2)',
                    padding: 4,
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {[
                    { id: 'friend' as const, label: 'Friend', icon: User },
                    { id: 'vendor' as const, label: 'Vendor', icon: Store },
                    { id: 'subscription' as const, label: 'Subscription', icon: Tv },
                  ].map(tab => {
                    const isSelected = type === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setType(tab.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '8px 6px',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? '1px solid var(--text)' : '1px solid transparent',
                          background: isSelected ? 'var(--text)' : 'transparent',
                          color: isSelected ? 'var(--bg)' : 'var(--text-3)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: 'var(--fs-sm)',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none',
                          minHeight: 38,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Icon size={15} style={{ color: isSelected ? 'var(--bg)' : 'inherit' }} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Popular Subscription Presets */}
              {type === 'subscription' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        color: 'var(--text-3)',
                        margin: 0,
                        textAlign: 'left',
                      }}
                    >
                      Popular Presets
                    </label>
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>Tap to fill</span>
                  </div>
                  <div
                    className="no-scrollbar"
                    style={{
                      display: 'flex',
                      flexWrap: 'nowrap',
                      overflowX: 'auto',
                      gap: 8,
                      width: '100%',
                      paddingBottom: 4,
                      scrollbarWidth: 'none',
                    }}
                  >
                    {POPULAR_SUBSCRIPTIONS.map(sub => {
                      const isSelected = name.toLowerCase() === sub.name.toLowerCase();
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => applyPreset(sub)}
                          style={{
                            flexShrink: 0,
                            padding: '7px 16px',
                            borderRadius: 'var(--radius-full)',
                            border: isSelected ? '1px solid var(--text)' : '1px solid var(--border)',
                            background: isSelected ? 'var(--text)' : 'var(--surface2)',
                            color: isSelected ? 'var(--bg)' : 'var(--text-2)',
                            fontSize: 'var(--fs-sm)',
                            fontWeight: isSelected ? 700 : 550,
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
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
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    color: 'var(--text-3)',
                    marginBottom: 5,
                    textAlign: 'left',
                  }}
                >
                  {type === 'vendor' ? 'Vendor Name *' : type === 'subscription' ? 'Subscription Name *' : 'Name *'}
                </label>
                <input
                  ref={nameInputRef}
                  className="form-input"
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--fs-base)',
                    fontWeight: 500,
                    textAlign: 'left',
                    padding: '0 12px',
                    border: error ? '1.5px solid var(--debit, #ef4444)' : '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                  value={name}
                  onChange={e => {
                    handleNameChange(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={namePlaceholder}
                />
              </div>

              {/* Category & Cost Grid Row */}
              {type === 'subscription' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 10 }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          color: 'var(--text-3)',
                          marginBottom: 5,
                          textAlign: 'left',
                        }}
                      >
                        Category
                      </label>
                      <select
                        className="form-select"
                        style={{
                          width: '100%',
                          height: 40,
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--fs-sm)',
                          fontWeight: 500,
                          padding: '0 10px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface2)',
                          color: 'var(--text)',
                          outline: 'none',
                        }}
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                      >
                        {db.settings.categories.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          color: 'var(--text-3)',
                          marginBottom: 5,
                          textAlign: 'left',
                        }}
                      >
                        Cost
                      </label>
                      <input
                        className="form-input"
                        style={{
                          width: '100%',
                          height: 40,
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--fs-base)',
                          fontWeight: 500,
                          padding: '0 12px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface2)',
                          color: 'var(--text)',
                          outline: 'none',
                        }}
                        type="number"
                        step="any"
                        value={defaultAmount}
                        onChange={e => setDefaultAmount(e.target.value)}
                        placeholder="e.g. 649"
                      />
                    </div>
                  </div>

                  {/* Interactive Billing Cycle Banner Card */}
                  <div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={openCycleModal}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--radius-sm)',
                            background: 'transparent',
                            color: 'var(--text-2)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Repeat size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getCycleDisplayInfo(billingCycle).title}
                          </div>
                          {getCycleDisplayInfo(billingCycle).sub ? (
                            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {getCycleDisplayInfo(billingCycle).sub}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'var(--text)',
                          color: 'var(--bg)',
                          border: '1px solid var(--text)',
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        }}
                      >
                        <span>{getCycleDisplayInfo(billingCycle).badge}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : type === 'vendor' ? (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      color: 'var(--text-3)',
                      marginBottom: 5,
                      textAlign: 'left',
                    }}
                  >
                    Category
                  </label>
                  <select
                    className="form-select"
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 500,
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      outline: 'none',
                    }}
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
              {type !== 'subscription' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label
                    style={{
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      color: 'var(--text-3)',
                      margin: 0,
                      textAlign: 'left',
                    }}
                  >
                    Avatar Color
                  </label>
                  {type === 'friend' && (
                    <button
                      type="button"
                      onClick={() => setShowNumberPicker(!showNumberPicker)}
                      style={{
                        fontSize: 'var(--fs-caption)',
                        fontWeight: showNumberPicker || avatarNumber ? 700 : 500,
                        color: showNumberPicker || avatarNumber ? 'var(--bg)' : 'var(--text-2)',
                        background: showNumberPicker || avatarNumber ? 'var(--text)' : 'var(--surface2)',
                        border: '1px solid ' + (showNumberPicker || avatarNumber ? 'var(--text)' : 'var(--border)'),
                        boxShadow: showNumberPicker || avatarNumber ? '0 1px 4px rgba(0, 0, 0, 0.18)' : 'none',
                        padding: '3px 9px',
                        borderRadius: 'var(--radius-full)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4.5,
                        transition: 'all 0.15s ease',
                      }}
                      title="Custom 2-digit number badge for friend avatar"
                    >
                      <Hash size={11} style={{ strokeWidth: 2.5 }} />
                      <span>Number Badge</span>
                      {avatarNumber ? (
                        <span
                          style={{
                            background: showNumberPicker || avatarNumber ? 'var(--bg)' : 'var(--text)',
                            color: showNumberPicker || avatarNumber ? 'var(--text)' : 'var(--bg)',
                            padding: '1px 5px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 800,
                            lineHeight: 1.2,
                          }}
                        >
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
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Mini Avatar Preview */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-full)',
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
                    {type === 'vendor'
                      ? <Store size={13} />
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
                            borderRadius: 'var(--radius-full)',
                            background: c,
                            border: isSelected ? '2px solid var(--surface)' : '1px solid rgba(0,0,0,0.15)',
                            outline: isSelected ? '2px solid var(--text)' : 'none',
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
                        borderRadius: 'var(--radius-full)',
                        background: !FRIEND_PALETTE.includes(color)
                          ? color
                          : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                        border: !FRIEND_PALETTE.includes(color) ? '2px solid var(--surface)' : '1px solid var(--border)',
                        outline: !FRIEND_PALETTE.includes(color) ? '2px solid var(--text)' : 'none',
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

                {/* Number Badge Section */}
                {type === 'friend' && showNumberPicker && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          color: 'var(--text-3)',
                          margin: 0,
                          textAlign: 'left',
                        }}
                      >
                        Number Badge (0–99)
                      </label>
                      {avatarNumber ? (
                        <button
                          type="button"
                          onClick={() => setAvatarNumber('')}
                          style={{
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 600,
                            color: 'var(--text-3)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3.5,
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                          title="Reset to letter initial"
                        >
                          <RotateCcw size={11} />
                          <span>Reset to Initial ({name ? name.slice(0, 1).toUpperCase() : 'A'})</span>
                        </button>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {/* 2-Digit Input Pill */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          height: 32,
                          padding: '0 10px',
                          borderRadius: 'var(--radius-full)',
                          border: avatarNumber ? '1.5px solid var(--text)' : '1px solid var(--border)',
                          background: 'var(--surface2)',
                          boxShadow: avatarNumber ? '0 1px 4px rgba(0, 0, 0, 0.12)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Hash size={12} style={{ color: avatarNumber ? 'var(--text)' : 'var(--text-3)', strokeWidth: 2.2 }} />
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={2}
                          placeholder="0-99"
                          value={avatarNumber}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                            setAvatarNumber(val);
                          }}
                          style={{
                            width: 36,
                            fontSize: 'var(--fs-sm)',
                            fontWeight: 750,
                            background: 'transparent',
                            color: 'var(--text)',
                            border: 'none',
                            outline: 'none',
                            padding: 0,
                            textAlign: 'center',
                          }}
                        />
                      </div>

                      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />

                      {/* Quick Preset Number Pills */}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        {['00', '07', '10', '23', '35', '69', '99'].map(num => {
                          const isSelected = avatarNumber === num;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setAvatarNumber(isSelected ? '' : num)}
                              style={{
                                height: 32,
                                minWidth: 34,
                                padding: '0 11px',
                                fontSize: 'var(--fs-xs)',
                                fontWeight: isSelected ? 750 : 550,
                                borderRadius: 'var(--radius-full)',
                                border: isSelected ? '1px solid var(--text)' : '1px solid var(--border)',
                                background: isSelected ? 'var(--text)' : 'var(--surface2)',
                                color: isSelected ? 'var(--bg)' : 'var(--text-2)',
                                boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.22)' : 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.12s ease',
                              }}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}

              {error && <p className="form-error" style={{ margin: '2px 0 0' }}>{error}</p>}

              {/* Action Buttons: Clear & Submit (Matching Transfer & Add Wallet Drawers) */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 600,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    padding: '0 16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <RotateCcw size={14} style={{ color: 'var(--text)' }} />
                  <span>Clear</span>
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    flex: 1.35,
                    height: 40,
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 700,
                    background: 'var(--text)',
                    border: '1px solid var(--text)',
                    color: 'var(--bg)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                    padding: '0 18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {friend ? <Check size={15} style={{ color: 'inherit' }} /> : <Plus size={15} style={{ color: 'inherit' }} />}
                  <span>{friend ? 'Save' : type === 'vendor' ? 'Add Vendor' : type === 'subscription' ? 'Add Subscription' : 'Add Contact'}</span>
                </button>
              </div>
            </div>
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
              ? ['Monthly supply', 'UPI payment preferred', 'Monthly billing', 'Shop contact', 'Frequent vendor']
              : ['Roommate', 'Family', 'Office colleague', 'Splitwise friend', 'UPI ID']
          }
        />

        {/* Dedicated Billing Cycle Drawer Modal */}
        {isCycleModalOpen && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 100085, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) setIsCycleModalOpen(false); }}
          >
            <div
              className="modal friend-drawer-modal"
              style={{
                maxWidth: 420,
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--surface)',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
                animation: 'slidein 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Drag Handle Indicator */}
              <div
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--border2)',
                  margin: '12px auto 6px',
                  flexShrink: 0,
                }}
              />

              {/* Drawer Header */}
              <div className="modal-header" style={{ padding: '4px 20px 14px', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text)', display: 'grid', placeItems: 'center' }}>
                    <Repeat size={18} />
                  </div>
                  <div>
                    <div className="modal-title" style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)' }}>
                      Select Billing Cycle
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 1 }}>
                      Choose how frequently this subscription recurs
                    </div>
                  </div>
                </div>
                <button
                  className="btn-icon"
                  type="button"
                  onClick={() => setIsCycleModalOpen(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-2)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="modal-body" style={{ padding: '12px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {BILLING_CYCLE_CHOICES.map(choice => {
                  const isSelected = tempCycle === choice.id;
                  const ChoiceIcon = choice.icon;
                  return (
                    <div
                      key={choice.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setTempCycle(choice.id)}
                      onMouseEnter={e => !isSelected && (e.currentTarget.style.borderColor = 'var(--border2)')}
                      onMouseLeave={e => !isSelected && (e.currentTarget.style.borderColor = 'var(--border)')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 18px',
                        borderRadius: 'var(--radius-lg)',
                        border: isSelected ? '1.5px solid var(--text)' : '1px solid var(--border)',
                        background: 'var(--surface2)',
                        boxShadow: isSelected ? '0 2px 10px rgba(0, 0, 0, 0.15)' : 'none',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            background: 'transparent',
                            color: isSelected ? 'var(--text)' : 'var(--text-3)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <ChoiceIcon size={20} />
                        </div>
                        <span style={{ fontSize: 'var(--fs-md)', fontWeight: isSelected ? 700 : 550, color: 'var(--text)' }}>
                          {choice.title}
                        </span>
                      </div>

                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 'var(--radius-full)',
                          border: isSelected ? 'none' : '1.5px solid var(--border2)',
                          background: isSelected ? 'var(--text)' : 'transparent',
                          color: 'var(--bg)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          marginLeft: 12,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}

                {/* If Custom Months is selected, show streamlined custom months card */}
                {tempCycle === 'custom' && (
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                      marginTop: 2,
                    }}
                  >
                    {/* Header with high contrast badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)' }}>
                        Custom Interval
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--fs-xs)',
                          fontWeight: 700,
                          color: 'var(--bg)',
                          background: 'var(--text)',
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-full)',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                        }}
                      >
                        Every {customMonths} Month{customMonths > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Clean Presets: 2, 3, and 6 Months */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[2, 3, 6].map(m => {
                        const isChipSelected = customMonths === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCustomMonths(m)}
                            onMouseEnter={e => !isChipSelected && (e.currentTarget.style.borderColor = 'var(--border2)')}
                            onMouseLeave={e => !isChipSelected && (e.currentTarget.style.borderColor = 'var(--border)')}
                            style={{
                              height: 38,
                              fontSize: 'var(--fs-xs)',
                              fontWeight: isChipSelected ? 700 : 550,
                              borderRadius: 'var(--radius-full)',
                              border: isChipSelected ? '1.5px solid var(--text)' : '1px solid var(--border)',
                              background: isChipSelected ? 'var(--text)' : 'var(--surface)',
                              color: isChipSelected ? 'var(--bg)' : 'var(--text-2)',
                              boxShadow: isChipSelected ? '0 2px 8px rgba(0, 0, 0, 0.18)' : 'none',
                              cursor: 'pointer',
                              outline: 'none',
                              transition: 'all 0.15s ease',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m} Months
                          </button>
                        );
                      })}
                    </div>

                    {/* Exact duration stepper row (no split lines) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 550, color: 'var(--text-2)' }}>
                        Exact duration
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-full)',
                            padding: '3px 6px',
                            gap: 2,
                          }}
                        >
                          <button
                            type="button"
                            className="btn-icon"
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid var(--border)',
                              background: 'var(--surface2)',
                              color: 'var(--text)',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              fontSize: 'var(--fs-lg)',
                              fontWeight: 700,
                            }}
                            onClick={() => setCustomMonths(prev => Math.max(1, prev - 1))}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            className="form-input"
                            style={{
                              height: 30,
                              textAlign: 'center',
                              fontSize: 'var(--fs-base)',
                              fontWeight: 700,
                              width: 42,
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text)',
                              padding: 0,
                            }}
                            value={customMonths}
                            onChange={e => setCustomMonths(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <button
                            type="button"
                            className="btn-icon"
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid var(--border)',
                              background: 'var(--surface2)',
                              color: 'var(--text)',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              fontSize: 'var(--fs-lg)',
                              fontWeight: 700,
                            }}
                            onClick={() => setCustomMonths(prev => Math.min(60, prev + 1))}
                          >
                            +
                          </button>
                        </div>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 550, color: 'var(--text-2)' }}>months</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Live calculated equivalent preview if amount is entered */}
                {defaultAmount && parseFloat(defaultAmount) > 0 && (
                  <div
                    style={{
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-around',
                      alignItems: 'center',
                      gap: 16,
                      marginTop: 4,
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-3)', fontSize: 'var(--fs-caption)', fontWeight: 600 }}>Monthly Equivalent</div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--text)', marginTop: 3 }}>
                        {db.settings.currency} {tempCycle === 'yearly'
                          ? (parseFloat(defaultAmount) / 12).toFixed(0)
                          : tempCycle === 'custom'
                          ? (parseFloat(defaultAmount) / customMonths).toFixed(0)
                          : parseFloat(defaultAmount).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-3)', fontSize: 'var(--fs-caption)', fontWeight: 600 }}>Annualized Cost</div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--text)', marginTop: 3 }}>
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

              {/* Drawer Footer Actions */}
              <div className="modal-footer" style={{ padding: '16px 20px 20px', display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: 'none', background: 'var(--surface)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--fs-base)',
                    fontWeight: 600,
                    height: 44,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onClick={() => {
                    setTempCycle('monthly');
                    setCustomMonths(3);
                    setIsCycleModalOpen(false);
                  }}
                >
                  <RotateCcw size={14} style={{ color: 'var(--text)' }} />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--fs-base)',
                    fontWeight: 700,
                    height: 44,
                    background: 'var(--text)',
                    color: 'var(--bg)',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onClick={saveCycleFromModal}
                >
                  <Check size={15} style={{ color: 'inherit' }} />
                  <span>Apply</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
