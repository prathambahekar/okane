import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useStore } from '../store';
import type { Envelope } from '../types';
import { walletBalance, walletUnallocatedBalance } from '../db';
import { fmtMoney } from '../utils';
import { getEnvelopeIconComponent } from '../utils/envelopeUtils';

interface Props {
  envelope: Envelope;
  onClose: () => void;
}

export default function EnvelopeFundModal({ envelope, onClose }: Props) {
  const { db, adjustEnvelopeBalance, showToast } = useStore();
  const { settings: { currency } } = db;

  const wallet = db.wallets.find(w => w.id === envelope.walletId) || db.wallets[0];
  const totalWalletBal = wallet ? walletBalance(db, wallet.id) : 0;
  const unallocatedBal = wallet ? walletUnallocatedBalance(db, wallet.id) : 0;

  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const remainingNeeded = Math.max(0, envelope.targetAmount - envelope.currentAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (mode === 'deposit') {
      adjustEnvelopeBalance(envelope.id, val);
      showToast(`Added ${fmtMoney(val, currency)} to ${envelope.name}`);
    } else {
      if (val > envelope.currentAmount) {
        setError(`Cannot withdraw more than current envelope balance (${fmtMoney(envelope.currentAmount, currency)})`);
        return;
      }
      adjustEnvelopeBalance(envelope.id, -val);
      showToast(`Withdrew ${fmtMoney(val, currency)} from ${envelope.name}`);
    }
    onClose();
  };

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${envelope.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: envelope.color,
              }}
            >
              {React.createElement(getEnvelopeIconComponent(envelope.icon), { size: 18 })}
            </div>
            <div>
              <div className="modal-title">{envelope.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {wallet?.name ?? 'Wallet'}
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Mode Switcher */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--surface2)', padding: 4, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => { setMode('deposit'); setError(''); }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: mode === 'deposit' ? 'var(--surface)' : 'transparent',
                  color: mode === 'deposit' ? 'var(--credit)' : 'var(--text-2)',
                  boxShadow: mode === 'deposit' ? 'var(--shadow-sm)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <ArrowDownLeft size={16} /> Deposit Funds
              </button>
              <button
                type="button"
                onClick={() => { setMode('withdraw'); setError(''); }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: mode === 'withdraw' ? 'var(--surface)' : 'transparent',
                  color: mode === 'withdraw' ? 'var(--debit)' : 'var(--text-2)',
                  boxShadow: mode === 'withdraw' ? 'var(--shadow-sm)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <ArrowUpRight size={16} /> Withdraw
              </button>
            </div>

            {/* Quick Summary Box */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Envelope Balance
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                  {fmtMoney(envelope.currentAmount, currency)}
                </div>
                {envelope.targetAmount > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                    Goal: {fmtMoney(envelope.targetAmount, currency)}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Wallet Unallocated
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: unallocatedBal < 0 ? 'var(--debit)' : 'var(--text)', marginTop: 2 }}>
                  {fmtMoney(unallocatedBal, currency)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                  Total: {fmtMoney(totalWalletBal, currency)}
                </div>
              </div>
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--debit)', borderRadius: 8, color: 'var(--debit)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                {mode === 'deposit' ? 'Amount to Deposit' : 'Amount to Withdraw'} ({currency})
              </label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError(''); }}
                placeholder="0.00"
              />
            </div>

            {/* Quick Quick-Select Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[100, 500, 1000, 5000].map(val => (
                <button
                  key={val}
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px', height: 'auto' }}
                  onClick={() => setAmount(String(val))}
                >
                  +{val}
                </button>
              ))}
              {mode === 'deposit' && remainingNeeded > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px', height: 'auto', color: envelope.color }}
                  onClick={() => setAmount(String(remainingNeeded))}
                >
                  Fill Goal ({fmtMoney(remainingNeeded, currency)})
                </button>
              )}
              {mode === 'withdraw' && envelope.currentAmount > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px', height: 'auto', color: 'var(--debit)' }}
                  onClick={() => setAmount(String(envelope.currentAmount))}
                >
                  Withdraw All ({fmtMoney(envelope.currentAmount, currency)})
                </button>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                background: mode === 'deposit' ? 'var(--credit)' : 'var(--debit)',
                borderColor: mode === 'deposit' ? 'var(--credit)' : 'var(--debit)',
              }}
            >
              {mode === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
