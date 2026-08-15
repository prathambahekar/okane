import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeftRight, ArrowRight, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { walletBalance, todayISO } from '../db';
import { fmtMoney } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultFromWalletId?: string;
  defaultToWalletId?: string;
}

export default function TransferModal({ isOpen, onClose, defaultFromWalletId, defaultToWalletId }: Props) {
  const { db, transferFunds, showToast } = useStore();
  const { wallets, settings: { currency } } = db;

  const [prevIsOpen, setPrevIsOpen] = useState(false);

  const initialFrom = defaultFromWalletId && wallets.some(w => w.id === defaultFromWalletId)
    ? defaultFromWalletId
    : (wallets[0]?.id || '');

  let initialTo = defaultToWalletId && wallets.some(w => w.id === defaultToWalletId)
    ? defaultToWalletId
    : wallets.find(w => w.id !== initialFrom)?.id || wallets[0]?.id || '';

  if (initialTo === initialFrom && wallets.length > 1) {
    initialTo = wallets.find(w => w.id !== initialFrom)!.id;
  }

  const [fromWalletId, setFromWalletId] = useState<string>(initialFrom);
  const [toWalletId, setToWalletId] = useState<string>(initialTo);
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(todayISO());
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen && wallets.length > 0) {
      setFromWalletId(initialFrom);
      setToWalletId(initialTo);
      setAmount('');
      setDate(todayISO());
      setNote('');
      setError('');
    }
  }

  if (!isOpen) return null;

  const fromWallet = wallets.find(w => w.id === fromWalletId);
  const toWallet = wallets.find(w => w.id === toWalletId);

  const fromBalance = fromWallet ? walletBalance(db, fromWallet.id) : 0;
  const toBalance = toWallet ? walletBalance(db, toWallet.id) : 0;

  const handleSwap = () => {
    if (fromWalletId && toWalletId) {
      setFromWalletId(toWalletId);
      setToWalletId(fromWalletId);
      setError('');
    }
  };

  const handleAddAmount = (addAmt: number) => {
    const current = Number(amount) || 0;
    setAmount((current + addAmt).toString());
    setError('');
  };

  const handleMaxAmount = () => {
    if (fromBalance > 0) {
      setAmount(fromBalance.toString());
      setError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);

    if (!fromWalletId || !toWalletId) {
      setError('Please select both source and destination wallets.');
      return;
    }

    if (fromWalletId === toWalletId) {
      setError('Source and destination wallets must be different.');
      return;
    }

    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid transfer amount greater than 0.');
      return;
    }

    transferFunds(fromWalletId, toWalletId, numAmount, date, note.trim());
    showToast(`Transferred ${fmtMoney(numAmount, currency)} from ${fromWallet?.name} to ${toWallet?.name}`);
    onClose();
  };

  const isInsufficient = Number(amount) > fromBalance && fromBalance >= 0;

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <ArrowLeftRight size={18} />
            </div>
            <div>
              <span className="modal-title" style={{ fontSize: 16 }}>Transfer Between Wallets</span>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Move money between your personal accounts</div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ gap: 16 }}>
            {/* Wallet Selection Controls (From -> To with Swap) */}
            <div style={{
              background: 'var(--surface2)',
              borderRadius: 12,
              padding: 14,
              border: '1px solid var(--border)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {/* From Wallet */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    From (Source)
                  </label>
                  {fromWallet && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: fromBalance < 0 ? 'var(--debit)' : 'var(--text-2)' }}>
                      Available: {fmtMoney(fromBalance, currency)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {fromWallet && (
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: fromWallet.color, flexShrink: 0 }} />
                  )}
                  <select
                    className="form-select"
                    style={{ flex: 1, fontWeight: 600, padding: '8px 10px' }}
                    value={fromWalletId}
                    onChange={e => {
                      setFromWalletId(e.target.value);
                      if (e.target.value === toWalletId) {
                        const other = wallets.find(w => w.id !== e.target.value);
                        if (other) setToWalletId(other.id);
                      }
                      setError('');
                    }}
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({fmtMoney(walletBalance(db, w.id), currency)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Swap Button Divider */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-4px 0' }}>
                <button
                  type="button"
                  onClick={handleSwap}
                  title="Swap source and destination wallets"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s ease',
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'rotate(180deg) scale(0.95)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'none'}
                >
                  <ArrowLeftRight size={15} />
                </button>
              </div>

              {/* To Wallet */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    To (Destination)
                  </label>
                  {toWallet && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                      Current: {fmtMoney(toBalance, currency)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {toWallet && (
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: toWallet.color, flexShrink: 0 }} />
                  )}
                  <select
                    className="form-select"
                    style={{ flex: 1, fontWeight: 600, padding: '8px 10px' }}
                    value={toWalletId}
                    onChange={e => {
                      setToWalletId(e.target.value);
                      if (e.target.value === fromWalletId) {
                        const other = wallets.find(w => w.id !== e.target.value);
                        if (other) setFromWalletId(other.id);
                      }
                      setError('');
                    }}
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({fmtMoney(walletBalance(db, w.id), currency)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Transfer Amount Input */}
            <div className="form-group">
              <label className="form-label">Transfer Amount *</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setError(''); }}
                  placeholder="0.00"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    paddingLeft: 14,
                    color: 'var(--text)'
                  }}
                />
              </div>

              {/* Quick Amount Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {[100, 500, 1000, 5000].map(val => (
                  <button
                    key={val}
                    type="button"
                    className="btn btn-secondary btn-xs"
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6 }}
                    onClick={() => handleAddAmount(val)}
                  >
                    +{val}
                  </button>
                ))}
                {fromBalance > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, color: 'var(--accent)', fontWeight: 700 }}
                    onClick={handleMaxAmount}
                  >
                    All ({fmtMoney(fromBalance, currency)})
                  </button>
                )}
              </div>

              {/* Insufficient Balance Warning */}
              {isInsufficient && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: '#f59e0b' }}>
                  <AlertCircle size={14} />
                  <span>Amount exceeds available source balance ({fmtMoney(fromBalance, currency)}).</span>
                </div>
              )}
            </div>

            {/* Date & Note Grid */}
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group">
                <label className="form-label">Transfer Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Note / Reason (Optional)</label>
                <input
                  className="form-input"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. ATM cash, Savings..."
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <p className="form-error" style={{ margin: 0, fontSize: 12 }}>
                {error}
              </p>
            )}

            {/* Transfer Flow Summary Box */}
            {fromWallet && toWallet && Number(amount) > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent)',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--accent)'
              }}>
                <span>{fromWallet.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>-{fmtMoney(Number(amount), currency)}</span>
                  <ArrowRight size={14} />
                  <span>+{fmtMoney(Number(amount), currency)}</span>
                </div>
                <span>{toWallet.name}</span>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={wallets.length < 2 || fromWalletId === toWalletId}
              style={{ gap: 6 }}
            >
              <ArrowLeftRight size={14} />
              Confirm Transfer
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
