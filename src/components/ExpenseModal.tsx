import { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { useStore } from '../store';
import type { Expense, ExpenseType, ExpenseFlow, ExpenseStatus } from '../types';
import { todayISO } from '../db';
import { currencySymbol, fmtMoney } from '../utils';

interface Props {
  expense?: Expense | null;
  onClose: () => void;
}

export default function ExpenseModal({ expense, onClose }: Props) {
  const { db, addExpense, updateExpense, showToast } = useStore();
  const s = db.settings;

  const [desc, setDesc] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [friendShare, setFriendShare] = useState(expense ? String(expense.amount) : '');
  const [category, setCategory] = useState(expense?.category ?? s.defaultCategory);
  const [date, setDate] = useState(expense?.date ?? todayISO());
  const [type, setType] = useState<ExpenseType>(expense?.type ?? 'personal');
  const [whoPaid, setWhoPaid] = useState<'me' | 'other'>(
    expense?.type === 'by_friend' ? 'other' : 'me'
  );
  const [splitMode, setSplitMode] = useState<'just_me' | 'for_friend'>(
    expense?.type === 'for_friend' ? 'for_friend' : 'just_me'
  );
  const [flow, setFlow] = useState<ExpenseFlow>(expense?.flow ?? 'out');
  const [friendId, setFriendId] = useState(expense?.friendId ?? '');
  const [walletId, setWalletId] = useState(expense?.walletId ?? s.defaultWalletId);
  const [status, setStatus] = useState<ExpenseStatus>(expense?.status ?? s.defaultStatus);
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    const calculatedType: ExpenseType = whoPaid === 'other'
      ? 'by_friend'
      : splitMode === 'for_friend'
      ? 'for_friend'
      : 'personal';
    setType(calculatedType);
    if (calculatedType === 'personal') setStatus(s.defaultStatus);
    else setStatus('unsettled');
  }, [whoPaid, splitMode, s.defaultStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) { setError('Description is required.'); return; }
    const totalAmt = parseFloat(amount);
    if (!amount || isNaN(totalAmt) || totalAmt <= 0) { setError('Enter a valid amount.'); return; }

    if (whoPaid === 'me' && splitMode === 'for_friend') {
      if (!friendId) { setError('Select a friend.'); return; }
      const fShare = parseFloat(friendShare);
      if (!friendShare || isNaN(fShare) || fShare <= 0 || fShare > totalAmt) {
        setError('Friend share must be a valid amount less than or equal to total spent.');
        return;
      }
      setError('');

      const myShare = totalAmt - fShare;

      if (expense) {
        updateExpense(expense.id, {
          description: desc.trim(),
          amount: fShare,
          category, date, type: 'for_friend',
          flow, friendId, walletId, status: 'unsettled', notes,
        });
        showToast('Expense updated');
      } else {
        // Record friend portion
        addExpense({
          description: `${desc.trim()} (Friend share)`,
          amount: fShare,
          category, date, type: 'for_friend',
          flow, friendId, walletId, status: 'unsettled', notes,
        });

        // Record personal portion if myShare > 0
        if (myShare > 0) {
          addExpense({
            description: desc.trim(),
            amount: myShare,
            category, date, type: 'personal',
            flow, friendId: null, walletId, status: 'paid', notes,
          });
        }
        showToast('Split expense recorded');
      }
    } else {
      if (type !== 'personal' && !friendId) { setError('Select a friend.'); return; }
      setError('');

      const data: Partial<Expense> = {
        description: desc.trim(),
        amount: totalAmt,
        category, date, type,
        flow,
        friendId: type === 'personal' ? null : (friendId || null),
        walletId: whoPaid === 'other' ? '' : walletId,
        status: type === 'personal' ? status : 'unsettled',
        notes,
      };

      if (expense) {
        updateExpense(expense.id, data);
        showToast('Expense updated');
      } else {
        addExpense(data);
        showToast('Expense added');
      }
    }

    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        {/* Drag Handle Indicator for Mobile Bottom Sheet */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        <div className="modal-header">
          <span className="modal-title">{expense ? 'Edit Transaction' : flow === 'out' ? 'Record Expense' : 'Record Income'}</span>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog"><CloseIcon fontSize="small" /></button>
        </div>

        {/* Expense / Income Flow Switcher */}
        <div className="flow-switcher">
          <button
            type="button"
            className={`flow-tab ${flow === 'out' ? 'active-out' : ''}`}
            onClick={() => {
              setFlow('out');
              setError('');
            }}
          >
            <TrendingDownIcon style={{ fontSize: 18 }} /> Expense
          </button>
          <button
            type="button"
            className={`flow-tab ${flow === 'in' ? 'active-in' : ''}`}
            onClick={() => {
              setFlow('in');
              setError('');
            }}
          >
            <TrendingUpIcon style={{ fontSize: 18 }} /> Income
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">

              {/* Hero Amount Field */}
              <div className={`hero-amount-card ${flow === 'out' ? 'hero-debit' : 'hero-credit'}`}>
                <span className="hero-amount-label">
                  {flow === 'out' ? 'Total Amount Spent' : 'Amount Received'} *
                </span>
                <div className="hero-amount-input-wrap">
                  <span className="hero-currency-symbol">{currencySymbol(s.currency)}</span>
                  <input
                    className="hero-amount-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => {
                      setAmount(e.target.value);
                      if (!friendShare || friendShare === amount) {
                        setFriendShare(e.target.value);
                      }
                    }}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              {/* SPENT TAB INPUTS */}
              {flow === 'out' ? (
                <>
                  {/* Who Paid Primary Switcher */}
                  <div className="form-group">
                    <label className="form-label">Who Paid?</label>
                    <div className="segment-control">
                      <button
                        type="button"
                        className={`segment-btn ${whoPaid === 'me' ? 'active' : ''}`}
                        onClick={() => { setWhoPaid('me'); setError(''); }}
                      >
                        <PersonIcon style={{ fontSize: 16 }} /> I Paid
                      </button>
                      <button
                        type="button"
                        className={`segment-btn ${whoPaid === 'other' ? 'active' : ''}`}
                        onClick={() => { setWhoPaid('other'); setError(''); }}
                      >
                        <PeopleIcon style={{ fontSize: 16 }} /> Someone Else Paid
                      </button>
                    </div>
                  </div>

                  {/* Progressive Disclosure: If I Paid */}
                  {whoPaid === 'me' && (
                    <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                      <label className="form-label">Expense Scope</label>
                      <div className="segment-control">
                        <button
                          type="button"
                          className={`segment-btn ${splitMode === 'just_me' ? 'active' : ''}`}
                          onClick={() => setSplitMode('just_me')}
                        >
                          <PersonIcon style={{ fontSize: 16 }} /> Just For Me
                        </button>
                        <button
                          type="button"
                          className={`segment-btn ${splitMode === 'for_friend' ? 'active' : ''}`}
                          onClick={() => {
                            setSplitMode('for_friend');
                            if (!friendShare && amount) setFriendShare(amount);
                          }}
                        >
                          <HandshakeIcon style={{ fontSize: 16 }} /> Split with Friend
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Friend Selection & Custom Split Share: If Split with Friend */}
                  {whoPaid === 'me' && splitMode === 'for_friend' && (
                    <>
                      <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                        <label className="form-label">Friend Involved *</label>
                        <select className="form-select" value={friendId} onChange={e => setFriendId(e.target.value)}>
                          <option value="">— select friend —</option>
                          {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>

                      <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="form-label">Friend's Share (Owed to You) *</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                              onClick={() => {
                                const total = parseFloat(amount) || 0;
                                setFriendShare(String((total / 2).toFixed(2)));
                              }}
                            >
                              50/50 Half
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                              onClick={() => setFriendShare(amount)}
                            >
                              Full Amount
                            </button>
                          </div>
                        </div>
                        <div className="hero-amount-card" style={{ padding: '8px 14px' }}>
                          <div className="hero-amount-input-wrap">
                            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-2)' }}>{currencySymbol(s.currency)}</span>
                            <input
                              className="hero-amount-input"
                              style={{ fontSize: 22, maxWidth: 160 }}
                              type="number"
                              min="0"
                              step="0.01"
                              value={friendShare}
                              onChange={e => setFriendShare(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        {parseFloat(amount) > 0 && parseFloat(friendShare) > 0 && (
                          <p className="form-hint" style={{ marginTop: 4, color: 'var(--accent)', fontWeight: 500 }}>
                            {parseFloat(amount) - parseFloat(friendShare) > 0
                              ? `Your share: ${fmtMoney(parseFloat(amount) - parseFloat(friendShare), s.currency)} · Friend owes: ${fmtMoney(parseFloat(friendShare), s.currency)}`
                              : `Full amount ${fmtMoney(parseFloat(friendShare), s.currency)} will be owed by friend.`}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Friend Selection: If Someone Else Paid */}
                  {whoPaid === 'other' && (
                    <div className="form-group" style={{ animation: 'fadein 0.15s ease' }}>
                      <label className="form-label">Who Paid For You? *</label>
                      <select className="form-select" value={friendId} onChange={e => setFriendId(e.target.value)}>
                        <option value="">— select friend who paid —</option>
                        {db.friends.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <p className="form-hint" style={{ marginTop: 2 }}>
                        You will owe this friend the amount recorded. Money will not be deducted from your wallet.
                      </p>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Description / Item *</label>
                    <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)}
                      placeholder="What did you spend on?" />
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

                  {/* Paid From (Wallet) & Status — ONLY shown when I Paid! */}
                  {whoPaid === 'me' && (
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
                  )}
                </>
              ) : (
                /* RECEIVED TAB INPUTS */
                <>
                  <div className="form-group">
                    <label className="form-label">Source / Received From *</label>
                    <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)}
                      placeholder="e.g. Salary, Client, Gift, Refund" />
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
