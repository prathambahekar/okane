import { useState } from 'react';
import { X, RefreshCw, Zap, Check, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import type { RecurringRule, RecurringKind, FrequencyType, ExpenseType } from '../types';
import { todayISO } from '../db';

interface Props {
  rule?: RecurringRule | null;
  defaultKind?: RecurringKind;
  onClose: () => void;
}

const PRESETS: { label: string; kind: RecurringKind; amount: number; category: string; frequency: FrequencyType; intervalValue?: number; notes?: string }[] = [
  // Subscription Autopays (Netflix, YT, Spotify, etc.)
  { label: 'Netflix', kind: 'autopay', amount: 199, category: 'Entertainment', frequency: 'monthly', notes: 'Monthly HD plan' },
  { label: 'Spotify', kind: 'autopay', amount: 119, category: 'Entertainment', frequency: 'monthly', notes: 'Music subscription' },
  { label: 'YouTube Premium', kind: 'autopay', amount: 149, category: 'Entertainment', frequency: 'monthly', notes: 'Ad-free video & music' },
  { label: 'Wi-Fi', kind: 'autopay', amount: 799, category: 'Utilities', frequency: 'monthly', notes: 'Fiber internet' },
  { label: 'Gym Membership', kind: 'autopay', amount: 1500, category: 'Health', frequency: 'monthly', notes: 'Fitness center' },

  // Quick Daily / Custom Logs
  { label: 'Daily Tiffin', kind: 'quick_log', amount: 75, category: 'Food', frequency: 'daily', notes: 'Lunch tiffin service' },
  { label: 'Daily Milk', kind: 'quick_log', amount: 50, category: 'Groceries', frequency: 'daily', notes: 'Daily 1L milk' },
  { label: 'Bus / Metro', kind: 'quick_log', amount: 100, category: 'Transport', frequency: 'daily', notes: 'Daily commute' },
];

export default function RecurringModal({ rule, defaultKind = 'autopay', onClose }: Props) {
  const { db, addRecurringRule, updateRecurringRule, addFriend, showToast } = useStore();
  const s = db.settings;

  const [kind, setKind] = useState<RecurringKind>(rule?.kind || defaultKind);
  const [title, setTitle] = useState(rule?.title || '');
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '');
  const [category, setCategory] = useState(rule?.category || s.defaultCategory);
  const [walletId, setWalletId] = useState(rule?.walletId || s.defaultWalletId || db.wallets[0]?.id || '');
  const [type, setType] = useState<ExpenseType>(rule?.type || 'personal');
  const [friendId, setFriendId] = useState(rule?.friendId || '');
  const [paymentMode, setPaymentMode] = useState<'debt' | 'paid'>(
    rule?.type === 'for_friend' || rule?.type === 'by_friend' ? 'debt' : 'paid'
  );
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>(rule?.frequency || 'monthly');
  const [intervalValue, setIntervalValue] = useState(rule?.intervalValue ? String(rule.intervalValue) : '1');
  const [startDate, setStartDate] = useState(rule?.startDate || todayISO());
  const [nextDueDate, setNextDueDate] = useState(rule?.nextDueDate || todayISO());
  const [autoDeduct, setAutoDeduct] = useState(rule?.autoDeduct || false);
  const [notes, setNotes] = useState(rule?.notes || '');
  const [error, setError] = useState('');

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setTitle(preset.label);
    setKind(preset.kind);
    setAmount(String(preset.amount));
    setCategory(preset.category);
    setFrequency(preset.frequency);
    if (preset.intervalValue) setIntervalValue(String(preset.intervalValue));
    if (preset.notes) setNotes(preset.notes);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmt = parseFloat(amount);
    if (!title.trim()) {
      setError('Please enter a title (e.g. Netflix, Tiffin)');
      return;
    }
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }

    const isFriendExpense = Boolean(friendId);
    const finalType: ExpenseType = isFriendExpense
      ? (paymentMode === 'debt' ? (type === 'personal' ? 'for_friend' : type) : 'personal')
      : 'personal';

    const payload: Partial<RecurringRule> = {
      title: title.trim(),
      kind,
      amount: parsedAmt,
      category,
      walletId,
      type: finalType,
      flow: 'out',
      friendId: friendId || null,
      frequency,
      intervalValue: Math.max(1, parseInt(intervalValue, 10) || 1),
      startDate,
      nextDueDate: kind === 'autopay' ? (nextDueDate || startDate) : undefined,
      autoDeduct,
      notes,
      status: rule?.status || 'active',
    };

    if (rule) {
      updateRecurringRule(rule.id, payload);
      showToast(`Updated recurring item "${title}"`);
    } else {
      addRecurringRule(payload);
      showToast(`Added new ${kind === 'autopay' ? 'Autopay' : 'Quick-log'} rule for "${title}"`);
    }

    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius)',
              background: kind === 'autopay' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(251, 191, 36, 0.15)',
              color: kind === 'autopay' ? 'var(--info)' : '#d97706',
              display: 'grid', placeItems: 'center', flexShrink: 0
            }}>
              {kind === 'autopay' ? <RefreshCw size={18} /> : <Zap size={18} />}
            </div>
            <div>
              <h2 className="modal-title">{rule ? 'Edit' : 'Autopay'}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                {kind === 'autopay' ? 'Manage Subscription and Logs' : '1-tap quick log for daily/regular expenses'}
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(239, 83, 80, 0.12)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: 'var(--radius)', color: 'var(--debit)', fontSize: 13 }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Kind Selector Tabs */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 12 }}>Type</label>
              <div className="segment-control">
                <button
                  type="button"
                  className={`segment-btn ${kind === 'autopay' ? 'active' : ''}`}
                  onClick={() => {
                    setKind('autopay');
                    setFriendId('');
                    setType('personal');
                    if (frequency === 'daily' || frequency === 'weekly' || frequency === 'custom_days') {
                      setFrequency('monthly');
                    }
                  }}
                  style={{ fontSize: 12.5 }}
                >
                  <RefreshCw size={14} />
                  <span>Subscription</span>
                </button>
                <button
                  type="button"
                  className={`segment-btn ${kind === 'quick_log' ? 'active' : ''}`}
                  onClick={() => setKind('quick_log')}
                  style={{ fontSize: 12.5 }}
                >
                  <Zap size={14} />
                  <span>Log</span>
                </button>
              </div>
            </div>

            {/* Presets Row */}
            {!rule && (
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Quick Presets</label>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, flexWrap: 'nowrap', width: '100%' }}>
                  {PRESETS.filter(p => p.kind === kind).map(p => (
                    <button
                      key={p.label}
                      type="button"
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: 11.5, padding: '3px 10px', height: 26, borderRadius: 13, flexShrink: 0, whiteSpace: 'nowrap' }}
                      onClick={() => applyPreset(p)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title & Amount */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Name</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: 13 }}
                  placeholder={kind === 'autopay' ? 'e.g. Netflix, Spotify' : 'e.g. Daily Tiffin, Milk'}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Amount</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  style={{ fontSize: 13 }}
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Category & Wallet */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Category</label>
                <select className="form-select" style={{ fontSize: 13 }} value={category} onChange={e => setCategory(e.target.value)}>
                  {s.categories.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Payment Wallet</label>
                <select className="form-select" style={{ fontSize: 13 }} value={walletId} onChange={e => setWalletId(e.target.value)}>
                  {db.wallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Frequency & Custom Interval */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Frequency</label>
                <select className="form-select" style={{ fontSize: 13 }} value={frequency} onChange={e => setFrequency(e.target.value as FrequencyType)}>
                  {kind === 'quick_log' && <option value="daily">Daily</option>}
                  {kind === 'quick_log' && <option value="weekly">Weekly</option>}
                  <option value="monthly">Monthly</option>
                  {kind === 'quick_log' && <option value="custom_days">Custom Days</option>}
                  <option value="custom_months">Custom Months (e.g. Quarterly/Yearly)</option>
                </select>
              </div>

              {(frequency === 'custom_days' || frequency === 'custom_months') && (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Interval</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      style={{ fontSize: 13 }}
                      value={intervalValue}
                      onChange={e => setIntervalValue(e.target.value)}
                    />
                    <span style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {frequency === 'custom_days' ? 'Days' : 'Months'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Date Pickers */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  style={{ fontSize: 13 }}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              {kind === 'autopay' && (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Next Due Date</label>
                  <input
                    type="date"
                    className="form-control"
                    style={{ fontSize: 13 }}
                    value={nextDueDate}
                    onChange={e => setNextDueDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Subscription specific simple toggle */}
            {kind === 'autopay' && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="autoDeductCheck"
                  checked={autoDeduct}
                  onChange={e => setAutoDeduct(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <label htmlFor="autoDeductCheck" style={{ fontSize: 12, cursor: 'pointer', margin: 0, color: 'var(--text-2)' }}>
                  Auto-deduct prompt when due
                </label>
              </div>
            )}

            {/* Detailed Log specific options: Friend / Debt split */}
            {kind === 'quick_log' && (
              <>
                <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="form-label" style={{ margin: 0, fontSize: 12 }}>Person / Friend (Optional)</label>
                    {!showAddFriend && (
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                        onClick={() => setShowAddFriend(true)}
                      >
                        + Add Friend
                      </button>
                    )}
                  </div>

                  {showAddFriend ? (
                    <div style={{ background: 'var(--surface2)', padding: 8, borderRadius: 'var(--radius)', border: '1px solid var(--accent)', marginBottom: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>
                        New Friend Name (e.g. Tiffin Aunty):
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          className="form-control"
                          style={{ fontSize: 12.5 }}
                          placeholder="e.g. Tiffin Aunty"
                          value={newFriendName}
                          onChange={e => setNewFriendName(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                          onClick={() => {
                            if (!newFriendName.trim()) return;
                            const created = addFriend({ name: newFriendName.trim() });
                            setFriendId(created.id);
                            if (type === 'personal') setType('for_friend');
                            setNewFriendName('');
                            setShowAddFriend(false);
                            showToast(`Added friend "${created.name}"`);
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          style={{ fontSize: 12 }}
                          onClick={() => setShowAddFriend(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      style={{ fontSize: 13 }}
                      value={friendId}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'NEW_FRIEND') {
                          setShowAddFriend(true);
                          setFriendId('');
                        } else {
                          setFriendId(val);
                          if (val && type === 'personal') {
                            setType('for_friend');
                          }
                        }
                      }}
                    >
                      <option value="">No Friend</option>
                      {db.friends.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                      <option value="NEW_FRIEND">+ Add New Friend (e.g. Tiffin Aunty)...</option>
                    </select>
                  )}
                </div>

                {friendId && (
                  <>
                    <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                      <label className="form-label" style={{ fontSize: 12 }}>Payment Relation</label>
                      <select className="form-select" style={{ fontSize: 12.5 }} value={type} onChange={e => setType(e.target.value as ExpenseType)}>
                        <option value="for_friend">I Pay For Friend (Friend owes me)</option>
                        <option value="by_friend">Friend Pays For Me (I owe friend)</option>
                        <option value="personal">Personal Expense (Under my name)</option>
                      </select>
                    </div>

                    {type !== 'personal' && (
                      <div
                        className="form-group"
                        style={{
                          background: 'var(--surface2)',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                          animation: 'fadein 0.15s ease'
                        }}
                      >
                        <label className="form-label" style={{ marginBottom: 6, fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>
                          When logged:
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}>
                            <input
                              type="radio"
                              name="paymentModeRadio"
                              checked={paymentMode === 'debt'}
                              onChange={() => setPaymentMode('debt')}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <span>Add to Debt of <strong>{db.friends.find(f => f.id === friendId)?.name || 'Friend'}</strong></span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}>
                            <input
                              type="radio"
                              name="paymentModeRadio"
                              checked={paymentMode === 'paid'}
                              onChange={() => setPaymentMode('paid')}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <span>Paid Now (Settle Immediately)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes / Description</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. add more details"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              {rule ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
