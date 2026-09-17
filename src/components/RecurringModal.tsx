import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  X,
  Zap,
  Check,
  AlertCircle,
  ArrowLeft,
  User,
  Users,
  Store,
  Plus,
  Search,
  Feather,
  RotateCcw,
  Tv,
  Calendar
} from 'lucide-react';
import { useStore } from '../store';
import type { RecurringRule, RecurringKind, FrequencyType, ExpenseType } from '../types';
import { todayISO, computeNextDueDate } from '../db';
import { currencySymbol, getAvatarStyle, friendInitial, fmtDate } from '../utils';
import { POPULAR_SUBSCRIPTIONS, type SubscriptionPreset } from './BrandIcons';
import { NoteEditorModal } from './common/NoteEditorModal';
import { NotePreviewCard } from './common/NotePreviewCard';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';
import { showSoftKeyboard } from '../utils/keyboard';

interface Props {
  rule?: RecurringRule | null;
  defaultKind?: RecurringKind;
  onClose: () => void;
}

// Preset subscription frequency keys
type SubPreset = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'weekly' | 'bi_weekly' | 'custom_months' | 'custom_days';

export default function RecurringModal({ rule, defaultKind = 'autopay', onClose }: Props) {
  useBackButtonModal(true, onClose, { priority: BackPriority.MODAL });

  const { db, addRecurringRule, updateRecurringRule, addFriend, showToast } = useStore();
  const s = db.settings;
  const currSym = currencySymbol(s.currency);

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [kind, setKind] = useState<RecurringKind>(rule?.kind || defaultKind);
  const [title, setTitle] = useState(rule?.title || '');
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '');
  const [category, setCategory] = useState(
    rule?.category || (defaultKind === 'autopay' ? 'Entertainment' : (s.defaultCategory || 'Food'))
  );
  const [walletId, setWalletId] = useState(rule?.walletId || s.defaultWalletId || db.wallets[0]?.id || '');
  const [type, setType] = useState<ExpenseType>(rule?.type || 'personal');
  const [friendId, setFriendId] = useState(rule?.friendId || '');
  const [paymentMode, setPaymentMode] = useState<'debt' | 'paid'>(
    rule?.type === 'for_friend' || rule?.type === 'by_friend' ? 'debt' : 'paid'
  );
  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [showScheduleDrawer, setShowScheduleDrawer] = useState(false);
  const [pickerTypeFilter, setPickerTypeFilter] = useState<'all' | 'friend' | 'vendor'>('all');
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSearchFocused, setPickerSearchFocused] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus title input on modal open
  useEffect(() => {
    const timer = setTimeout(() => {
      if (titleInputRef.current) {
        showSoftKeyboard(titleInputRef.current, { placeCursorAtEnd: true, scroll: true });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  useBackButtonModal(showContactDrawer, () => setShowContactDrawer(false), { priority: BackPriority.DRAWER });
  useBackButtonModal(showScheduleDrawer, () => setShowScheduleDrawer(false), { priority: BackPriority.DRAWER });

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

  // Derive initial subscription preset from existing rule
  const getInitialSubPreset = (): SubPreset => {
    if (!rule) return 'monthly';
    if (rule.frequency === 'monthly') return 'monthly';
    if (rule.frequency === 'weekly') return 'weekly';
    if (rule.frequency === 'custom_days') {
      if (rule.intervalValue === 14) return 'bi_weekly';
      return 'custom_days';
    }
    if (rule.frequency === 'custom_months') {
      if (rule.intervalValue === 3) return 'quarterly';
      if (rule.intervalValue === 6) return 'half_yearly';
      if (rule.intervalValue === 12) return 'yearly';
      return 'custom_months';
    }
    return 'monthly';
  };

  const [subPreset, setSubPreset] = useState<SubPreset>(getInitialSubPreset);
  const [customFrequency, setCustomFrequency] = useState<FrequencyType>(
    rule?.frequency || 'monthly'
  );
  const [intervalValue, setIntervalValue] = useState(rule?.intervalValue ? String(rule.intervalValue) : '1');
  const [startDate, setStartDate] = useState(rule?.startDate || todayISO());
  const [nextDueDate, setNextDueDate] = useState(rule?.nextDueDate || todayISO());
  const [userEditedDueDate, setUserEditedDueDate] = useState(Boolean(rule?.nextDueDate));
  const autoDeduct = rule?.autoDeduct ?? true;
  const [notes, setNotes] = useState(rule?.notes || '');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [error, setError] = useState('');

  useBackButtonModal(isNoteModalOpen, () => setIsNoteModalOpen(false), { priority: BackPriority.DIALOG });

  const isSubscription = kind === 'autopay';

  const getSubFreqAndVal = (preset: SubPreset, customValStr: string): { freq: FrequencyType; val: number } => {
    switch (preset) {
      case 'monthly': return { freq: 'monthly', val: 1 };
      case 'quarterly': return { freq: 'custom_months', val: 3 };
      case 'half_yearly': return { freq: 'custom_months', val: 6 };
      case 'yearly': return { freq: 'custom_months', val: 12 };
      case 'weekly': return { freq: 'weekly', val: 1 };
      case 'bi_weekly': return { freq: 'custom_days', val: 14 };
      case 'custom_months': return { freq: 'custom_months', val: Math.max(1, parseInt(customValStr, 10) || 1) };
      case 'custom_days': return { freq: 'custom_days', val: Math.max(1, parseInt(customValStr, 10) || 1) };
    }
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (isSubscription && !userEditedDueDate && !rule) {
      const { freq, val } = getSubFreqAndVal(subPreset, intervalValue);
      setNextDueDate(computeNextDueDate(newStart, freq, val));
    }
  };

  const handleSubPresetChange = (newPreset: SubPreset) => {
    setSubPreset(newPreset);
    if (isSubscription && !userEditedDueDate && !rule) {
      const { freq, val } = getSubFreqAndVal(newPreset, intervalValue);
      setNextDueDate(computeNextDueDate(startDate, freq, val));
    }
  };

  const handleIntervalChange = (newValStr: string) => {
    setIntervalValue(newValStr);
    if (isSubscription && !userEditedDueDate && !rule && (subPreset === 'custom_months' || subPreset === 'custom_days')) {
      const { freq, val } = getSubFreqAndVal(subPreset, newValStr);
      setNextDueDate(computeNextDueDate(startDate, freq, val));
    }
  };

  const applyPreset = (preset: SubscriptionPreset) => {
    setTitle(preset.name);
    if (preset.defaultAmount) {
      setAmount(String(preset.defaultAmount));
    }
    if (preset.category) {
      const exists = s.categories.some(c => c.name.toLowerCase() === preset.category.toLowerCase());
      setCategory(exists ? preset.category : (s.categories[0]?.name || 'Entertainment'));
    }
    if (preset.billingCycle) {
      const newPreset: SubPreset = preset.billingCycle === 'yearly' ? 'yearly' : 'monthly';
      setSubPreset(newPreset);
      const { freq, val } = getSubFreqAndVal(newPreset, '1');
      setNextDueDate(computeNextDueDate(startDate, freq, val));
    }
    if (error) setError('');
  };

  const handleSwitchKind = (newKind: RecurringKind) => {
    setKind(newKind);
    if (newKind === 'autopay') {
      setCategory('Entertainment');
      setFriendId('');
      setType('personal');
    } else {
      if (category === 'Entertainment') {
        setCategory(s.defaultCategory || 'Food');
      }
    }
  };

  const getScheduleTitle = () => {
    if (isSubscription) {
      switch (subPreset) {
        case 'monthly': return 'Monthly';
        case 'quarterly': return 'Quarterly';
        case 'half_yearly': return 'Half-Yearly';
        case 'yearly': return 'Yearly';
        case 'weekly': return 'Weekly';
        case 'bi_weekly': return 'Bi-Weekly';
        case 'custom_months': return `Every ${intervalValue || 1} Month${parseInt(intervalValue, 10) > 1 ? 's' : ''}`;
        case 'custom_days': return `Every ${intervalValue || 1} Day${parseInt(intervalValue, 10) > 1 ? 's' : ''}`;
        default: return 'Monthly';
      }
    } else {
      switch (customFrequency) {
        case 'daily': return 'Daily';
        case 'weekly': return 'Weekly';
        case 'monthly': return 'Monthly';
        case 'yearly' as unknown as FrequencyType: return 'Yearly';
        case 'custom_days': return `Every ${intervalValue || 1} Day${parseInt(intervalValue, 10) > 1 ? 's' : ''}`;
        case 'custom_months': return `Every ${intervalValue || 1} Month${parseInt(intervalValue, 10) > 1 ? 's' : ''}`;
        default: return 'Monthly';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmt = parseFloat(amount);
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    let finalFrequency: FrequencyType = 'monthly';
    let finalInterval = 1;

    if (isSubscription) {
      switch (subPreset) {
        case 'monthly':
          finalFrequency = 'monthly';
          finalInterval = 1;
          break;
        case 'quarterly':
          finalFrequency = 'custom_months';
          finalInterval = 3;
          break;
        case 'half_yearly':
          finalFrequency = 'custom_months';
          finalInterval = 6;
          break;
        case 'yearly':
          finalFrequency = 'custom_months';
          finalInterval = 12;
          break;
        case 'weekly':
          finalFrequency = 'weekly';
          finalInterval = 1;
          break;
        case 'bi_weekly':
          finalFrequency = 'custom_days';
          finalInterval = 14;
          break;
        case 'custom_months':
          finalFrequency = 'custom_months';
          finalInterval = Math.max(1, parseInt(intervalValue, 10) || 1);
          break;
        case 'custom_days':
          finalFrequency = 'custom_days';
          finalInterval = Math.max(1, parseInt(intervalValue, 10) || 1);
          break;
      }
    } else {
      finalFrequency = customFrequency;
      if (customFrequency === 'yearly' as unknown as FrequencyType) {
        finalFrequency = 'custom_months';
        finalInterval = 12;
      } else {
        finalInterval = Math.max(1, parseInt(intervalValue, 10) || 1);
      }
    }

    const finalCategory = isSubscription ? category : category;
    const finalFriendId = isSubscription ? null : (friendId || null);
    const finalType: ExpenseType = isSubscription
      ? 'personal'
      : (finalFriendId
          ? (paymentMode === 'debt' ? 'by_friend' : 'personal')
          : 'personal');

    const payload: Partial<RecurringRule> = {
      title: title.trim(),
      kind,
      amount: parsedAmt,
      category: finalCategory,
      walletId,
      type: finalType,
      flow: 'out',
      friendId: finalFriendId,
      frequency: finalFrequency,
      intervalValue: finalInterval,
      startDate,
      nextDueDate: isSubscription ? (nextDueDate || startDate) : undefined,
      autoDeduct: isSubscription ? autoDeduct : false,
      notes: notes.trim(),
      status: rule?.status || 'active',
    };

    if (rule?.id) {
      updateRecurringRule(rule.id, payload);
      showToast(`Updated "${title.trim()}"`);
    } else {
      addRecurringRule(payload);
      showToast(`Created ${isSubscription ? 'subscription' : 'routine'} "${title.trim()}"`);
    }

    onClose();
  };

  const isEditing = Boolean(rule?.id);
  const linkedFriend = friendId ? db.friends.find(f => f.id === friendId) : null;

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

      {/* Dialog sheet / Desktop center panel */}
      <motion.div
        initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="modal modal-dialog-panel"
        style={{
          maxWidth: 520,
          width: '100%',
          maxHeight: 'min(92vh, 92dvh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag Handle Indicator */}
        <div
          style={{
            width: 38,
            height: 4.5,
            borderRadius: 'var(--radius-full)',
            background: 'var(--border2, #444)',
            margin: '10px auto 4px',
            flexShrink: 0,
            opacity: 0.85,
          }}
        />

        {!showScheduleDrawer ? (
          <>
            {/* Themed Clean Header */}
            <div style={{ padding: '4px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              {isSubscription ? <Tv size={22} strokeWidth={2.2} /> : <Zap size={22} strokeWidth={2.2} />}
            </div>
            <div>
              <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                {isEditing ? (isSubscription ? 'Edit Subscription' : 'Edit Routine') : (isSubscription ? 'New Subscription' : 'New Routine')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Note Button */}
            <button
              type="button"
              className={`btn-icon ${notes ? 'has-note' : ''}`}
              onClick={() => setIsNoteModalOpen(true)}
              style={{
                width: 34,
                height: 34,
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
              title={notes ? `Note: "${notes}"` : 'Add note'}
              aria-label={notes ? 'Edit note' : 'Add note'}
            >
              <Feather size={16} strokeWidth={2} />
            </button>

            {/* Close Button */}
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <X size={17} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Clean Form Body (No splitting lines) */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              padding: '8px 20px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              overflowY: 'auto',
              flex: 1
            }}
          >
            {/* Error Notification */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--debit, #ef4444)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 550
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Segmented Switcher: Subscription vs Custom (High-Contrast Theme) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: 'var(--surface2)',
                padding: 4,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                gap: 4
              }}
            >
              <button
                type="button"
                onClick={() => handleSwitchKind('autopay')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: isSubscription ? '1px solid var(--text)' : '1px solid transparent',
                  background: isSubscription ? 'var(--text)' : 'transparent',
                  color: isSubscription ? 'var(--bg)' : 'var(--text-3)',
                  fontWeight: isSubscription ? 700 : 500,
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                  boxShadow: isSubscription ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Tv size={15} style={{ color: isSubscription ? 'var(--bg)' : 'inherit' }} />
                <span>Subscription</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchKind('quick_log')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: !isSubscription ? '1px solid var(--text)' : '1px solid transparent',
                  background: !isSubscription ? 'var(--text)' : 'transparent',
                  color: !isSubscription ? 'var(--bg)' : 'var(--text-3)',
                  fontWeight: !isSubscription ? 700 : 500,
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                  boxShadow: !isSubscription ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Zap size={15} style={{ color: !isSubscription ? 'var(--bg)' : 'inherit' }} />
                <span>Custom</span>
              </button>
            </div>

            {/* Popular Presets Carousel (Subscription Mode) */}
            {isSubscription && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      color: 'var(--text-3)',
                      margin: 0,
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
                    paddingBottom: 2,
                    scrollbarWidth: 'none',
                  }}
                >
                  {POPULAR_SUBSCRIPTIONS.map(sub => {
                    const isSelected = title.toLowerCase() === sub.name.toLowerCase();
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => applyPreset(sub)}
                        style={{
                          flexShrink: 0,
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-full)',
                          border: isSelected ? '1px solid var(--text)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--text)' : 'var(--surface2)',
                          color: isSelected ? 'var(--bg)' : 'var(--text-2)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: isSelected ? 700 : 550,
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
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

            {/* 1. HERO AMOUNT INPUT (Above Subscription Name) */}
            <div className="hero-amount-card hero-debit" style={{ margin: 0, width: '100%' }}>
              <span className="hero-amount-label">
                TOTAL AMOUNT SPENT *
              </span>
              <div className="hero-amount-input-wrap">
                <span className="hero-currency-symbol" style={{ color: 'var(--debit, #ef4444)' }}>
                  {currSym}
                </span>
                <input
                  className="hero-amount-input"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => {
                    setAmount(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus={!title}
                />
              </div>
            </div>

            {/* 2. SUBSCRIPTION / ROUTINE NAME INPUT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label
                style={{
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  color: 'var(--text-3)',
                }}
              >
                {isSubscription ? 'Subscription Name *' : 'Routine Name *'}
              </label>

              <input
                ref={titleInputRef}
                type="text"
                required
                placeholder={isSubscription ? 'e.g. Netflix, Spotify, ChatGPT' : 'e.g. Daily Coffee, Milk, Maid, Metro'}
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (error) setError('');
                }}
                className="form-input"
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--fs-base)',
                  fontWeight: 550,
                  padding: '0 14px',
                  border: error && !title.trim() ? '1.5px solid var(--debit, #ef4444)' : '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />

              <NotePreviewCard
                notes={notes}
                onEdit={() => setIsNoteModalOpen(true)}
                onClear={() => setNotes('')}
              />
            </div>

            {/* 3. CATEGORY AND PAYMENT WALLET IN SAME ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label
                  style={{
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    color: 'var(--text-3)',
                  }}
                >
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="form-select"
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 500,
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                >
                  {s.categories.map((c, idx) => (
                    <option key={`${c.name}-${idx}`} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label
                  style={{
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    color: 'var(--text-3)',
                  }}
                >
                  Payment Wallet
                </label>
                <select
                  value={walletId}
                  onChange={e => setWalletId(e.target.value)}
                  className="form-select"
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 500,
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                >
                  {db.wallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. TAP TO SELECT INTERVAL & DATES CARD (Minimal & Beautiful Monthly Card) */}
            <div
              onClick={() => setShowScheduleDrawer(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--text)',
                    color: 'var(--bg)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Calendar size={15} strokeWidth={2.4} />
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.1px' }}>
                  {getScheduleTitle()}
                </div>
              </div>

              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--surface3, var(--surface))',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
              >
                <Plus size={14} strokeWidth={2.5} />
              </div>
            </div>

            {/* Custom Mode Only: Link Contact/Vendor Card (Matching Monthly Card) */}
            {!isSubscription && (
              <div
                onClick={() => setShowContactDrawer(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface2)',
                  border: friendId ? '1px solid var(--text)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--text)',
                      color: 'var(--bg)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {friendId ? (
                      linkedFriend?.type === 'vendor' ? <Store size={15} strokeWidth={2.4} /> : <User size={15} strokeWidth={2.4} />
                    ) : (
                      <Users size={15} strokeWidth={2.4} />
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {friendId ? (linkedFriend?.name || 'Contact Linked') : 'Link Contact / Vendor'}
                  </div>
                </div>

                {friendId ? (
                  <div
                    style={{
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--text)',
                      color: 'var(--bg)',
                      flexShrink: 0,
                    }}
                  >
                    {paymentMode === 'debt' ? 'Debt' : 'Linked'}
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 600,
                      color: 'var(--text-3)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      padding: '3px 9px',
                      borderRadius: 'var(--radius-full)',
                      flexShrink: 0,
                    }}
                  >
                    Optional
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Buttons */}
          <div
            style={{
              padding: '10px 20px 18px',
              display: 'flex',
              gap: 12,
              background: 'transparent',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={isEditing ? onClose : () => {
                setTitle('');
                setAmount('');
                setNotes('');
                setFriendId('');
                setCategory(defaultKind === 'autopay' ? 'Entertainment' : (s.defaultCategory || 'Food'));
                setWalletId(s.defaultWalletId || db.wallets[0]?.id || '');
              }}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 650,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              {isEditing ? <X size={16} style={{ color: 'var(--text)' }} /> : <RotateCcw size={16} style={{ color: 'var(--text)' }} />}
              <span>{isEditing ? 'Cancel' : 'Clear'}</span>
            </button>
            <button
              type="submit"
              style={{
                flex: 1.35,
                height: 44,
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                background: 'var(--text)',
                border: '1px solid var(--text)',
                color: 'var(--bg)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {isEditing ? <Check size={16} style={{ color: 'inherit' }} /> : <Plus size={16} style={{ color: 'inherit' }} />}
              <span>{isEditing ? 'Save Changes' : (isSubscription ? 'Create Subscription' : 'Create Routine')}</span>
            </button>
          </div>
        </form>
        </>
        ) : null}

        {/* Separate Drawer Menu for Link Contact / Vendor */}
        {showContactDrawer && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--surface)',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '4px 20px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setShowContactDrawer(false)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    transition: 'all 0.15s ease',
                  }}
                  aria-label="Back"
                >
                  <ArrowLeft size={17} strokeWidth={2.2} />
                </button>
                <div>
                  <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                    Link Contact or Vendor
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowContactDrawer(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  transition: 'all 0.15s ease',
                }}
                aria-label="Close"
              >
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            {/* Search & Filter Controls */}
            <div style={{ padding: '6px 20px 10px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
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
                      height: 26,
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
                      const created = addFriend({
                        name: pickerSearch.trim(),
                        type: pickerTypeFilter === 'vendor' ? 'vendor' : 'friend'
                      });
                      setFriendId(created.id);
                      setType(created.type === 'vendor' ? 'by_friend' : 'for_friend');
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

            {/* Contacts Grid & Content */}
            <div
              className="no-scrollbar"
              style={{
                padding: '6px 20px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {filteredFriendsList.length === 0 ? (
                <div style={{ padding: '36px 8px', textAlign: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                  No matching contacts found
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
                  {filteredFriendsList.map(f => {
                    const isSel = friendId === f.id;
                    const isVendor = f.type === 'vendor';

                    return (
                      <div
                        key={f.id}
                        onClick={() => {
                          if (isSel) {
                            setFriendId('');
                            setType('personal');
                          } else {
                            setFriendId(f.id);
                            if (type === 'personal') {
                              setType(isVendor ? 'by_friend' : 'for_friend');
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
                              borderRadius: 'var(--radius-full)',
                              aspectRatio: '1 / 1',
                              ...getAvatarStyle(f.color),
                              fontSize: f.avatarNumber && f.avatarNumber.length > 2 ? 'var(--fs-caption)' : 'var(--fs-caption)',
                              fontWeight: 750,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              letterSpacing: '-0.2px',
                            }}
                          >
                            {isVendor ? <Store size={13} /> : friendInitial(f.name, f.avatarNumber)}
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
                            borderRadius: 'var(--radius-full)',
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

              {/* Simple Settlement Settings when Contact is selected */}
              {friendId && (() => {
                const cName = linkedFriend?.name || 'Contact';

                return (
                  <div
                    style={{
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    {/* Payment status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)' }}>
                        Payment status:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMode('paid');
                            setType('personal');
                          }}
                          style={{
                            padding: '7px 10px',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: paymentMode === 'paid' ? 700 : 500,
                            borderRadius: 'var(--radius-sm)',
                            border: paymentMode === 'paid' ? '1px solid var(--text)' : '1px solid var(--border)',
                            background: paymentMode === 'paid' ? 'var(--text)' : 'var(--surface)',
                            color: paymentMode === 'paid' ? 'var(--bg)' : 'var(--text)',
                            boxShadow: paymentMode === 'paid' ? '0 1px 4px rgba(0, 0, 0, 0.15)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                            textAlign: 'center',
                          }}
                        >
                          Paid (Settled)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMode('debt');
                            setType('by_friend');
                          }}
                          style={{
                            padding: '7px 10px',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: paymentMode === 'debt' ? 700 : 500,
                            borderRadius: 'var(--radius-sm)',
                            border: paymentMode === 'debt' ? '1px solid var(--text)' : '1px solid var(--border)',
                            background: paymentMode === 'debt' ? 'var(--text)' : 'var(--surface)',
                            color: paymentMode === 'debt' ? 'var(--bg)' : 'var(--text)',
                            boxShadow: paymentMode === 'debt' ? '0 1px 4px rgba(0, 0, 0, 0.15)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                            textAlign: 'center',
                          }}
                        >
                          Unpaid (Debt)
                        </button>
                      </div>
                    </div>

                    {/* Concise 1-Line Contextual Note */}
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 1.4, paddingTop: 2 }}>
                      {paymentMode === 'debt' ? (
                        <span>⚡ Each log adds <strong>{currSym}{amount || '0'}</strong> to unpaid balance with <strong>{cName}</strong>.</span>
                      ) : (
                        <span>⚡ Each log records <strong>{currSym}{amount || '0'}</strong> paid directly to <strong>{cName}</strong>.</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Bottom Drawer Actions */}
            <div
              style={{
                padding: '10px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
                background: 'var(--surface)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 10,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setFriendId('');
                  setType('personal');
                }}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  fontSize: 'var(--fs-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <RotateCcw size={15} />
                <span>Clear</span>
              </button>
              <button
                type="button"
                onClick={() => setShowContactDrawer(false)}
                style={{
                  flex: 1.3,
                  height: 42,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--text)',
                  border: '1px solid var(--text)',
                  color: 'var(--bg)',
                  fontWeight: 750,
                  fontSize: 'var(--fs-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                }}
              >
                <Check size={15} strokeWidth={2.5} />
                <span>Done</span>
              </button>
            </div>
          </div>
        )}

        {/* Schedule & Billing Dates View */}
        {showScheduleDrawer && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Consistent Schedule Header */}
            <div style={{ padding: '4px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowScheduleDrawer(false)}
                  className="btn-icon"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  aria-label="Back"
                >
                  <ArrowLeft size={17} strokeWidth={2.2} />
                </button>
                <div>
                  <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                    Schedule & Dates
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowScheduleDrawer(false)}
                aria-label="Close dialog"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={17} strokeWidth={2.2} />
              </button>
            </div>

            {/* Schedule Body */}
            <div
              style={{
                padding: '8px 20px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 13,
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {/* Cycle / Frequency Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)' }}>
                  {isSubscription ? 'Select Billing Cycle' : 'Select Frequency'}
                </label>

                {isSubscription ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    {[
                      { key: 'monthly', label: 'Monthly' },
                      { key: 'yearly', label: 'Yearly' },
                      { key: 'quarterly', label: 'Quarterly' },
                      { key: 'custom_months', label: 'Custom' },
                    ].map(item => {
                      const isSel = subPreset === item.key;
                      return (
                        <div
                          key={item.key}
                          onClick={() => handleSubPresetChange(item.key as SubPreset)}
                          style={{
                            padding: '11px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: isSel ? 'var(--text)' : 'var(--surface2)',
                            color: isSel ? 'var(--bg)' : 'var(--text)',
                            border: isSel ? '1px solid var(--text)' : '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: isSel ? 700 : 550,
                            fontSize: 'var(--fs-sm)',
                            textAlign: 'center',
                          }}
                        >
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    {[
                      { key: 'daily', label: 'Daily' },
                      { key: 'weekly', label: 'Weekly' },
                      { key: 'monthly', label: 'Monthly' },
                      { key: 'custom_days', label: 'Custom' },
                    ].map(item => {
                      const isSel = customFrequency === item.key;
                      return (
                        <div
                          key={item.key}
                          onClick={() => setCustomFrequency(item.key as FrequencyType)}
                          style={{
                            padding: '11px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: isSel ? 'var(--text)' : 'var(--surface2)',
                            color: isSel ? 'var(--bg)' : 'var(--text)',
                            border: isSel ? '1px solid var(--text)' : '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: isSel ? 700 : 550,
                            fontSize: 'var(--fs-sm)',
                            textAlign: 'center',
                          }}
                        >
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Decreased Size: Custom Interval Stepper if Custom Selected */}
              {((isSubscription && (subPreset === 'custom_months' || subPreset === 'custom_days')) ||
                (!isSubscription && (customFrequency === 'custom_days' || customFrequency === 'custom_months'))) && (
                <div
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text)' }}>
                    Repeat every:
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={intervalValue}
                      onChange={e => handleIntervalChange(e.target.value)}
                      className="form-input"
                      style={{
                        width: 48,
                        height: 32,
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                        textAlign: 'center',
                        padding: '0 4px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                      }}
                    />
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)' }}>
                      {(isSubscription && subPreset === 'custom_days') || (!isSubscription && customFrequency === 'custom_days')
                        ? 'Day(s)'
                        : 'Month(s)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Start Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    height: 42,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 500,
                    padding: '0 14px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Next Due Date (Subscriptions) */}
              {isSubscription && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)' }}>
                      Next Due Date
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const { freq, val } = getSubFreqAndVal(subPreset, intervalValue);
                        setNextDueDate(computeNextDueDate(startDate, freq, val));
                        setUserEditedDueDate(false);
                      }}
                      className="btn-icon"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-2)',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      title="Auto-recalculate due date"
                      aria-label="Auto-recalculate due date"
                    >
                      <RotateCcw size={13} strokeWidth={2.2} />
                    </button>
                  </div>
                  <input
                    type="date"
                    value={nextDueDate}
                    onChange={e => {
                      setNextDueDate(e.target.value);
                      setUserEditedDueDate(true);
                    }}
                    className="form-input"
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 500,
                      padding: '0 14px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Informative Summary Card */}
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--text)',
                    color: 'var(--bg)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Calendar size={16} strokeWidth={2.4} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.1px' }}>
                    Repeats {getScheduleTitle()}
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', marginTop: 3, lineHeight: 1.45, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {isSubscription ? (
                      <>
                        <div>
                          Starts <strong>{fmtDate(startDate)}</strong>
                        </div>
                        <div>
                          Due on <strong style={{ color: 'var(--text)' }}>{fmtDate(nextDueDate)}</strong>
                        </div>
                      </>
                    ) : (
                      <div>
                        Routine logs starting <strong>{fmtDate(startDate)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Footer: Clear & Apply Buttons */}
            <div
              style={{
                padding: '10px 20px 18px',
                display: 'flex',
                gap: 12,
                background: 'transparent',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (isSubscription) {
                    setSubPreset('monthly');
                    setIntervalValue('1');
                    const today = todayISO();
                    setStartDate(today);
                    setNextDueDate(computeNextDueDate(today, 'monthly', 1));
                    setUserEditedDueDate(false);
                  } else {
                    setCustomFrequency('monthly');
                    setIntervalValue('1');
                    setStartDate(todayISO());
                  }
                }}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 650,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <RotateCcw size={16} style={{ color: 'var(--text)' }} />
                <span>Clear</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScheduleDrawer(false)}
                style={{
                  flex: 1.35,
                  height: 44,
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  background: 'var(--text)',
                  border: '1px solid var(--text)',
                  color: 'var(--bg)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Check size={16} style={{ color: 'inherit' }} />
                <span>Apply Schedule</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Note Editor Modal Dialog */}
      <NoteEditorModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title={isSubscription ? 'Subscription Note' : 'Routine Note'}
        initialNote={notes}
        onSave={setNotes}
        quickTags={
          isSubscription
            ? ['Family plan share', 'Annual renewal', 'Auto-debit active', 'Shared with roomies', 'Free trial active']
            : ['Monthly salary', 'House rent', 'Daily milk / dairy', 'Gym membership', 'Internet / Broadband']
        }
      />
    </div>,
    document.body
  );
}
