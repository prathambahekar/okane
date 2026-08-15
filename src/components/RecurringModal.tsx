import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  RefreshCw,
  Zap,
  Check,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Bell,
  User,
  Users,
  Store,
  Plus,
  Search,
  FileText
} from 'lucide-react';
import { useStore } from '../store';
import type { RecurringRule, RecurringKind, FrequencyType, ExpenseType } from '../types';
import { todayISO, computeNextDueDate } from '../db';
import { currencySymbol, getAvatarStyle, friendInitial } from '../utils';

interface Props {
  rule?: RecurringRule | null;
  defaultKind?: RecurringKind;
  onClose: () => void;
}

// Preset subscription frequency keys
type SubPreset = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'weekly' | 'bi_weekly' | 'custom_months' | 'custom_days';

export default function RecurringModal({ rule, defaultKind = 'autopay', onClose }: Props) {
  const { db, addRecurringRule, updateRecurringRule, addFriend, showToast } = useStore();
  const s = db.settings;
  const currSym = currencySymbol(s.currency);

  const [kind, setKind] = useState<RecurringKind>(rule?.kind || defaultKind);
  const [title, setTitle] = useState(rule?.title || '');
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '');
  const [category, setCategory] = useState(
    rule?.category || (defaultKind === 'autopay' ? 'Entertainment' : (s.defaultCategory || 'Other'))
  );
  const [walletId, setWalletId] = useState(rule?.walletId || s.defaultWalletId || db.wallets[0]?.id || '');
  const [type, setType] = useState<ExpenseType>(rule?.type || 'personal');
  const [friendId, setFriendId] = useState(rule?.friendId || '');
  const [paymentMode, setPaymentMode] = useState<'debt' | 'paid'>(
    rule?.type === 'for_friend' || rule?.type === 'by_friend' ? 'debt' : 'paid'
  );
  const [showContactDrawer, setShowContactDrawer] = useState(false);
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
  const [autoDeduct, setAutoDeduct] = useState(rule?.autoDeduct ?? true);
  const [notes, setNotes] = useState(rule?.notes || '');
  const [showNoteInput, setShowNoteInput] = useState(Boolean(rule?.notes));
  const [error, setError] = useState('');

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

    const finalCategory = isSubscription ? 'Entertainment' : category;
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
      showToast(`Created ${isSubscription ? 'subscription' : 'custom'} "${title.trim()}"`);
    }

    onClose();
  };

  const isEditing = Boolean(rule?.id);
  const linkedFriend = friendId ? db.friends.find(f => f.id === friendId) : null;

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal"
        style={{
          maxWidth: 440,
          borderRadius: 'var(--radius-lg, 16px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '94vh',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.22)',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        {/* Compact Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px 6px 16px',
            background: 'var(--surface)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm, 8px)',
                background: isSubscription
                  ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(99, 102, 241, 0.16))'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(239, 68, 68, 0.16))',
                color: isSubscription ? 'var(--accent, #0284c7)' : '#d97706',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                border: `1px solid ${isSubscription ? 'rgba(14, 165, 233, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`
              }}
            >
              {isSubscription ? <RefreshCw size={16} /> : <Zap size={16} />}
            </div>
            <div>
              <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.2 }}>
                {isEditing ? `Edit ${isSubscription ? 'Subscription' : 'Custom'}` : (isSubscription ? 'New Subscription' : 'Custom')}
              </h2>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                {isSubscription ? 'Track recurring bills and due reminders' : 'Quick 1-tap repetitive logs (milk, tiffin, maid, etc.)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-2)',
              cursor: 'pointer'
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Compact Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
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
                  gap: 7,
                  padding: '7px 10px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  color: 'var(--debit, #dc2626)',
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Mode Switcher: Subscription vs Custom Logs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: 'var(--surface2)',
                padding: 2.5,
                borderRadius: 'var(--radius-md, 10px)',
                border: '1px solid var(--border)'
              }}
            >
              <button
                type="button"
                onClick={() => handleSwitchKind('autopay')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: 'none',
                  background: isSubscription ? 'var(--surface)' : 'transparent',
                  color: isSubscription ? 'var(--accent, #0284c7)' : 'var(--text-3)',
                  fontWeight: isSubscription ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: isSubscription ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <RefreshCw size={13} />
                <span>Subscription</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchKind('quick_log')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: 'none',
                  background: !isSubscription ? 'var(--surface)' : 'transparent',
                  color: !isSubscription ? '#d97706' : 'var(--text-3)',
                  fontWeight: !isSubscription ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: !isSubscription ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Zap size={13} />
                <span>Custom</span>
              </button>
            </div>

            {/* Row 1: Name / Title with Note icon button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                  Name / Title <span style={{ color: 'var(--debit)' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  title={showNoteInput ? 'Hide note' : 'Add a note'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3.5,
                    background: notes || showNoteInput ? 'var(--accent-soft)' : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    padding: '1px 5px',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: notes || showNoteInput ? 'var(--accent)' : 'var(--text-3)',
                    cursor: 'pointer'
                  }}
                >
                  <FileText size={11.5} />
                  <span>{notes ? 'Note added' : '+ Note'}</span>
                </button>
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  required
                  placeholder={isSubscription ? 'e.g. Netflix, Spotify, Prime, Gym...' : 'e.g. Daily Coffee, Milk, Maid, Metro'}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="form-control"
                  style={{
                    fontSize: 12.5,
                    height: 35,
                    padding: '5px 9px',
                    borderRadius: 'var(--radius-sm, 6px)'
                  }}
                />
              </div>

              {/* Inline expandable Note input if triggered */}
              {showNoteInput && (
                <div style={{ marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    autoFocus={!notes}
                    placeholder="Add brief note or plan detail (optional)..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="form-control"
                    style={{
                      fontSize: 11.5,
                      height: 30,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      background: 'var(--surface2)',
                      border: '1px dashed var(--border)'
                    }}
                  />
                  {notes && (
                    <button
                      type="button"
                      onClick={() => setNotes('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-3)',
                        fontSize: 11,
                        cursor: 'pointer',
                        padding: '0 4px'
                      }}
                      title="Clear note"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Row 2: Amount (Dedicated Separate Row) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                Amount <span style={{ color: 'var(--debit)' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-3)',
                    pointerEvents: 'none'
                  }}
                >
                  {currSym}
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="form-control"
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    height: 35,
                    padding: '5px 9px 5px 24px',
                    borderRadius: 'var(--radius-sm, 6px)'
                  }}
                />
              </div>
            </div>

            {/* Row 3: Category & Payment Wallet (Custom) OR Payment Wallet & Frequency (Subscription) */}
            {isSubscription ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: (subPreset === 'custom_months' || subPreset === 'custom_days')
                    ? '1fr 1.1fr 0.7fr'
                    : '1fr 1fr',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                    Payment Wallet
                  </label>
                  <select
                    value={walletId}
                    onChange={e => setWalletId(e.target.value)}
                    className="form-select"
                    style={{ fontSize: 12, height: 35, padding: '5px 8px', borderRadius: 'var(--radius-sm, 6px)' }}
                  >
                    {db.wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                    Frequency / Cycle
                  </label>
                  <select
                    value={subPreset}
                    onChange={e => handleSubPresetChange(e.target.value as SubPreset)}
                    className="form-select"
                    style={{ fontSize: 12, height: 35, padding: '5px 8px', borderRadius: 'var(--radius-sm, 6px)' }}
                  >
                    <option value="monthly">Monthly (1 Mo)</option>
                    <option value="quarterly">Quarterly (3 Mo)</option>
                    <option value="half_yearly">Half-Yearly (6 Mo)</option>
                    <option value="yearly">Yearly (12 Mo)</option>
                    <option value="weekly">Weekly (1 Wk)</option>
                    <option value="bi_weekly">Bi-Weekly (2 Wks)</option>
                    <option value="custom_months">Custom Months...</option>
                    <option value="custom_days">Custom Days...</option>
                  </select>
                </div>

                {(subPreset === 'custom_months' || subPreset === 'custom_days') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                      Every
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={intervalValue}
                      onChange={e => handleIntervalChange(e.target.value)}
                      className="form-control"
                      style={{ fontSize: 12, height: 35, padding: '5px 6px', borderRadius: 'var(--radius-sm, 6px)', width: '100%' }}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Custom Mode: Clean Side-by-Side Category and Payment Wallet */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="form-select"
                    style={{ fontSize: 12, height: 35, padding: '5px 8px', borderRadius: 'var(--radius-sm, 6px)' }}
                  >
                    {s.categories.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                    Payment Wallet
                  </label>
                  <select
                    value={walletId}
                    onChange={e => setWalletId(e.target.value)}
                    className="form-select"
                    style={{ fontSize: 12, height: 35, padding: '5px 8px', borderRadius: 'var(--radius-sm, 6px)' }}
                  >
                    {db.wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Row 4: Dates & Frequency */}
            {isSubscription ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => handleStartDateChange(e.target.value)}
                    className="form-control"
                    style={{ fontSize: 12, height: 35, padding: '5px 8px', borderRadius: 'var(--radius-sm, 6px)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    value={nextDueDate}
                    onChange={e => {
                      setNextDueDate(e.target.value);
                      setUserEditedDueDate(true);
                    }}
                    className="form-control"
                    style={{ fontSize: 12, height: 35, padding: '5px 8px', borderRadius: 'var(--radius-sm, 6px)' }}
                  />
                </div>
              </div>
            ) : (
              /* Custom Mode: Frequency & Start Date Side-by-Side */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: (customFrequency === 'custom_days' || customFrequency === 'custom_months')
                    ? '1.1fr 0.7fr 1fr'
                    : '1fr 1fr',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                    Frequency / Repeat
                  </label>
                  <select
                    value={customFrequency}
                    onChange={e => setCustomFrequency(e.target.value as FrequencyType)}
                    className="form-select"
                    style={{ fontSize: 12, height: 35, padding: '5px 8px', borderRadius: 'var(--radius-sm, 6px)' }}
                  >
                    <option value="daily">Daily (Every Day)</option>
                    <option value="weekly">Weekly (Every Week)</option>
                    <option value="monthly">Monthly (Every Month)</option>
                    <option value="yearly">Yearly (Every Year)</option>
                    <option value="custom_days">Custom Days...</option>
                    <option value="custom_months">Custom Months...</option>
                  </select>
                </div>

                {(customFrequency === 'custom_days' || customFrequency === 'custom_months') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                      Every
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={intervalValue}
                      onChange={e => handleIntervalChange(e.target.value)}
                      className="form-control"
                      style={{ fontSize: 12, height: 35, padding: '5px 6px', borderRadius: 'var(--radius-sm, 6px)', width: '100%' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => handleStartDateChange(e.target.value)}
                    className="form-control"
                    style={{ fontSize: 12, height: 35, padding: '5px 8px', borderRadius: 'var(--radius-sm, 6px)' }}
                  />
                </div>
              </div>
            )}

            {/* Row 5: Compact Auto-deduct Prompt Switch Card (Subscription Only) */}
            {isSubscription && (
              <div
                onClick={() => setAutoDeduct(!autoDeduct)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  background: autoDeduct ? 'var(--accent-soft)' : 'var(--surface2)',
                  border: autoDeduct ? '1px solid var(--accent-border-soft)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: autoDeduct ? 'var(--accent)' : 'var(--surface)',
                      color: autoDeduct ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Bell size={13} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: autoDeduct ? 'var(--accent)' : 'var(--text)', lineHeight: 1.2 }}>
                      Auto-Deduct Prompt
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.1 }}>
                      Show 1-tap deduct shortcut when payment is due
                    </div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={autoDeduct}
                  onChange={e => setAutoDeduct(e.target.checked)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>
            )}

            {/* Custom Mode Only: Dedicated Menu Row to open Separate Link Contact/Vendor Drawer */}
            {!isSubscription && (
              <div
                onClick={() => setShowContactDrawer(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 11px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  background: 'var(--surface2)',
                  border: friendId ? '1.5px solid var(--accent-border-soft, var(--border))' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: friendId ? 'var(--accent-soft)' : 'var(--surface)',
                      display: 'grid',
                      placeItems: 'center',
                      color: friendId ? 'var(--accent)' : 'var(--text-3)',
                      border: '1px solid var(--border)',
                      flexShrink: 0
                    }}
                  >
                    {friendId ? (
                      linkedFriend?.type === 'vendor' ? <Store size={14} /> : <User size={14} />
                    ) : (
                      <Users size={14} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                      Link Contact / Vendor
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                      {friendId
                        ? `${linkedFriend?.name || 'Linked'} • ${paymentMode === 'debt' ? 'Unpaid' : 'Settled'}`
                        : 'Personal (No contact linked)'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {friendId ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1.5px 7px',
                        borderRadius: 4,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)'
                      }}
                    >
                      Linked
                    </span>
                  ) : (
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Optional</span>
                  )}
                  <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                </div>
              </div>
            )}
          </div>

          {/* Compact Modal Footer */}
          <div
            style={{
              padding: '6px 16px 14px 16px',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              flexShrink: 0
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '5px 12px', minHeight: 30, borderRadius: 'var(--radius-sm, 6px)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '5px 18px',
                minHeight: 30,
                borderRadius: 'var(--radius-sm, 6px)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <Check size={14} />
              <span>{isEditing ? 'Save Changes' : 'Create'}</span>
            </button>
          </div>
        </form>

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
              borderRadius: 'var(--radius-lg, 16px)',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px 8px 14px',
                background: 'var(--surface)',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowContactDrawer(false)}
                  aria-label="Back"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text)',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={14} />
                </button>
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    Link Contact or Vendor
                  </h3>
                  <p style={{ fontSize: 10.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                    Connect ledger balances or tag expenses
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowContactDrawer(false)}
                className="btn btn-sm btn-primary"
                style={{ fontSize: 11, height: 26, padding: '0 12px', borderRadius: 6 }}
              >
                Apply
              </button>
            </div>

            {/* Drawer Body */}
            <div
              style={{
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                overflowY: 'auto',
                flex: 1
              }}
            >
              {/* Search & Filter Bar (Matching App Standard) */}
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
              </div>

              {/* Grid of Contacts */}
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '8px',
                  maxHeight: 230,
                  overflowY: 'auto'
                }}
              >
                {filteredFriendsList.length === 0 ? (
                  <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                    No matching contacts found
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                    {filteredFriendsList.map(f => {
                      const isSel = friendId === f.id;
                      const isVendor = f.type === 'vendor';
                      const avatarStyle = isVendor
                        ? { background: 'rgba(99, 102, 241, 0.15)', color: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.3)' }
                        : getAvatarStyle(f.color || f.name);

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
                            padding: '6px 8px',
                            borderRadius: 10,
                            background: isSel ? 'var(--surface)' : 'transparent',
                            border: isSel ? '1.5px solid var(--text)' : '1px solid transparent',
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
                                fontSize: 10,
                                fontWeight: 700,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                                ...avatarStyle,
                              }}
                            >
                              {isVendor ? <Store size={12} /> : friendInitial(f.name)}
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
                              border: isSel ? '4.5px solid var(--text)' : '1.5px solid var(--text-3)',
                              background: 'var(--surface)',
                              flexShrink: 0,
                              transition: 'all 0.12s ease',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Simple Settlement Settings when Contact is selected */}
              {friendId && (() => {
                const cName = linkedFriend?.name || 'Contact';

                return (
                  <div
                    style={{
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {/* Payment status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                        Payment status:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMode('paid');
                            setType('personal');
                          }}
                          style={{
                            padding: '6px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: paymentMode === 'paid' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                            background: paymentMode === 'paid' ? 'var(--accent-soft)' : 'var(--surface)',
                            color: paymentMode === 'paid' ? 'var(--accent)' : 'var(--text)',
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
                            padding: '6px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: paymentMode === 'debt' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                            background: paymentMode === 'debt' ? 'var(--accent-soft)' : 'var(--surface)',
                            color: paymentMode === 'debt' ? 'var(--accent)' : 'var(--text)',
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
                    <div style={{ fontSize: 10.5, color: 'var(--text-2)', lineHeight: 1.35, paddingTop: 2 }}>
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
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
