import { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { useStore } from '../store';
import type { Expense, ExpenseType, ExpenseFlow, ExpenseStatus } from '../types';
import { todayISO } from '../db';

interface Props {
  expense?: Expense | null;
  onClose: () => void;
}

export default function ExpenseModal({ expense, onClose }: Props) {
  const { db, addExpense, updateExpense, showToast } = useStore();
  const s = db.settings;

  const [desc, setDesc] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [category, setCategory] = useState(expense?.category ?? s.defaultCategory);
  const [date, setDate] = useState(expense?.date ?? todayISO());
  const [type, setType] = useState<ExpenseType>(expense?.type ?? 'personal');
  const [flow, setFlow] = useState<ExpenseFlow>(expense?.flow ?? 'out');
  const [friendId, setFriendId] = useState(expense?.friendId ?? '');
  const [walletId, setWalletId] = useState(expense?.walletId ?? s.defaultWalletId);
  const [status, setStatus] = useState<ExpenseStatus>(expense?.status ?? s.defaultStatus);
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (type === 'personal') setStatus(s.defaultStatus);
    else setStatus('unsettled');
  }, [type, s.defaultStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) { setError('Description is required.'); return; }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount.'); return; }
    if (type !== 'personal' && !friendId) { setError('Select a friend.'); return; }
    setError('');

    const data: Partial<Expense> = {
      description: desc.trim(), amount: amt, category, date, type,
      flow, friendId: type === 'personal' ? null : (friendId || null),
      walletId, status, notes,
    };

    if (expense) {
      updateExpense(expense.id, data);
      showToast('Expense updated');
    } else {
      addExpense(data);
      showToast('Expense added');
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{expense ? 'Edit Expense' : 'Add Expense'}</span>
          <button className="btn-icon" onClick={onClose}><CloseIcon fontSize="small" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Type</label>
                <div className="segment-control">
                  {(['personal', 'for_friend', 'by_friend'] as ExpenseType[]).map(t => (
                    <button key={t} type="button" className={`segment-btn ${type === t ? 'active' : ''}`}
                      onClick={() => setType(t)}>
                      {t === 'personal' ? 'Personal' : t === 'for_friend' ? 'For Friend' : 'By Friend'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Flow</label>
                <div className="segment-control">
                  <button type="button" className={`segment-btn ${flow === 'out' ? 'active' : ''}`} onClick={() => setFlow('out')}>Spent / Out</button>
                  <button type="button" className={`segment-btn ${flow === 'in' ? 'active' : ''}`} onClick={() => setFlow('in')}>Received / In</button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What was this for?" />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={amount}
                    onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                    {s.categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>

              {type !== 'personal' && (
                <div className="form-group">
                  <label className="form-label">Friend *</label>
                  <select className="form-select" value={friendId} onChange={e => setFriendId(e.target.value)}>
                    <option value="">— select friend —</option>
                    {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Wallet</label>
                  <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
                    {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                {type === 'personal' && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={status} onChange={e => setStatus(e.target.value as ExpenseStatus)}>
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>

              {error && <p className="form-error">{error}</p>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">{expense ? 'Save Changes' : 'Add Expense'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
