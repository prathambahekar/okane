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
          <span className="modal-title">{expense ? 'Edit Transaction' : flow === 'out' ? 'Record Expense' : 'Record Income'}</span>
          <button className="btn-icon" onClick={onClose}><CloseIcon fontSize="small" /></button>
        </div>

        {/* Spent / Received Tabs */}
        <div className="tab-list" style={{ margin: 0, padding: '0 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex' }}>
          <button
            type="button"
            className={`tab-btn ${flow === 'out' ? 'active' : ''}`}
            onClick={() => {
              setFlow('out');
              setError('');
            }}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: flow === 'out' ? 'var(--debit)' : 'var(--text-3)',
              borderBottom: flow === 'out' ? '2.5px solid var(--debit)' : '2.5px solid transparent',
              transition: 'all 0.18s ease',
            }}
          >
            💸 Spent (Expense)
          </button>
          <button
            type="button"
            className={`tab-btn ${flow === 'in' ? 'active' : ''}`}
            onClick={() => {
              setFlow('in');
              setError('');
            }}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: flow === 'in' ? 'var(--credit)' : 'var(--text-3)',
              borderBottom: flow === 'in' ? '2.5px solid var(--credit)' : '2.5px solid transparent',
              transition: 'all 0.18s ease',
            }}
          >
            💰 Received (Income)
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              {/* SPENT TAB INPUTS */}
              {flow === 'out' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Expense Type</label>
                    <div className="segment-control">
                      {(['personal', 'for_friend', 'by_friend'] as ExpenseType[]).map(t => (
                        <button key={t} type="button" className={`segment-btn ${type === t ? 'active' : ''}`}
                          onClick={() => setType(t)}>
                          {t === 'personal' ? 'Personal' : t === 'for_friend' ? 'For Friend' : 'By Friend'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Description / Item *</label>
                      <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)}
                        placeholder="What did you spend on?" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount Spent *</label>
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
                      <label className="form-label">Date Spent</label>
                      <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                  </div>

                  {type !== 'personal' && (
                    <div className="form-group">
                      <label className="form-label">Friend Involved *</label>
                      <select className="form-select" value={friendId} onChange={e => setFriendId(e.target.value)}>
                        <option value="">— select friend —</option>
                        {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Paid From (Wallet)</label>
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
                </>
              ) : (
                /* RECEIVED TAB INPUTS */
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Source / Received From *</label>
                      <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)}
                        placeholder="e.g. Salary, Client, Gift, Refund" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount Received *</label>
                      <input className="form-input" type="number" min="0" step="0.01" value={amount}
                        onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Income Category</label>
                      <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="Income">Income</option>
                        {s.categories.filter(c => c.name !== 'Income').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date Received</label>
                      <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Deposited To (Wallet)</label>
                      <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
                        {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Transaction Context</label>
                      <select className="form-select" value={type} onChange={e => setType(e.target.value as ExpenseType)}>
                        <option value="personal">Personal Income</option>
                        <option value="by_friend">Received From Friend</option>
                      </select>
                    </div>
                  </div>

                  {type === 'by_friend' && (
                    <div className="form-group">
                      <label className="form-label">Select Friend *</label>
                      <select className="form-select" value={friendId} onChange={e => setFriendId(e.target.value)}>
                        <option value="">— select friend —</option>
                        {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>

              {error && <p className="form-error">{error}</p>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{
                background: flow === 'in'
                  ? 'linear-gradient(135deg, #2e7d32, #1b5e20)'
                  : undefined
              }}
            >
              {expense ? 'Save Changes' : flow === 'out' ? 'Record Expense' : 'Record Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
