import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeftRight, ArrowRight, AlertCircle, FileText, Calendar, ChevronDown, Wallet as WalletIcon } from 'lucide-react';
import { useStore } from '../store';
import { walletBalance, todayISO } from '../db';
import { fmtMoney, currencySymbol } from '../utils';
import { NoteEditorModal } from './common/NoteEditorModal';
import { renderWalletIcon } from './WalletIconRenderer';

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
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen && wallets.length > 0) {
      setFromWalletId(initialFrom);
      setToWalletId(initialTo);
      setAmount('');
      setDate(todayISO());
      setNote('');
      setIsNoteModalOpen(false);
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
      <div className="modal" style={{ maxWidth: 440 }}>
        {/* Mobile handle indicator */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'var(--accent-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                flexShrink: 0,
              }}
            >
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
          <div className="modal-body" style={{ padding: '8px 20px 18px', gap: 12, display: 'flex', flexDirection: 'column' }}>
            {/* 1. HERO AMOUNT CARD (MATCHING NEW THEME) */}
            <div
              className="hero-amount-card"
              style={{
                background: 'var(--surface2)',
                borderRadius: 12,
                padding: '12px 16px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: 'var(--text-3)',
                }}
              >
                TRANSFER AMOUNT *
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-2)',
                    lineHeight: 1,
                  }}
                >
                  {currencySymbol(currency)}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setError(''); }}
                  placeholder="0"
                  style={{
                    fontSize: 26,
                    fontWeight: 750,
                    color: 'var(--text)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                    width: `${Math.max(1, (amount || '0').length) * 16 + 6}px`,
                    maxWidth: '180px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Quick Amount Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: 4 }}>
                {[100, 500, 1000, 5000].map(val => (
                  <button
                    key={val}
                    type="button"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-2)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => handleAddAmount(val)}
                  >
                    +{val}
                  </button>
                ))}
                {fromBalance > 0 && (
                  <button
                    type="button"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent)',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={handleMaxAmount}
                  >
                    All ({fmtMoney(fromBalance, currency)})
                  </button>
                )}
              </div>
            </div>

            {/* Insufficient Balance Warning */}
            {isInsufficient && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11.5,
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.1)',
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>Amount exceeds available source balance ({fmtMoney(fromBalance, currency)}).</span>
              </div>
            )}

            {/* 2. BEAUTIFUL UNIFIED WALLET SELECTION (FROM & TO WITH SWAP) */}
            <div
              style={{
                background: 'var(--surface2)',
                borderRadius: 14,
                padding: '12px 14px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* FROM (SOURCE) WALLET CARD */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)' }}>
                    FROM (SOURCE)
                  </span>
                  {fromWallet && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: fromBalance < 0 ? 'var(--debit)' : 'var(--text-3)' }}>
                      Available: <strong style={{ color: fromBalance < 0 ? 'var(--debit)' : 'var(--text-2)' }}>{fmtMoney(fromBalance, currency)}</strong>
                    </span>
                  )}
                </div>

                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {fromWallet ? renderWalletIcon(fromWallet.icon || 'wallet', 22, fromWallet.color) : <WalletIcon size={16} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fromWallet?.name || 'Select Wallet'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {fmtMoney(fromBalance, currency)}
                    </div>
                  </div>

                  <ChevronDown size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />

                  {/* Accessible overlay select for native interaction */}
                  <select
                    value={fromWalletId}
                    onChange={e => {
                      setFromWalletId(e.target.value);
                      if (e.target.value === toWalletId) {
                        const other = wallets.find(w => w.id !== e.target.value);
                        if (other) setToWalletId(other.id);
                      }
                      setError('');
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
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

              {/* SWAP BUTTON DIVIDER */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-4px 0' }}>
                <button
                  type="button"
                  onClick={handleSwap}
                  title="Swap source and destination wallets"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
                    transition: 'transform 0.2s ease, background 0.15s ease',
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'rotate(180deg) scale(0.95)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'none'}
                >
                  <ArrowLeftRight size={14} />
                </button>
              </div>

              {/* TO (DESTINATION) WALLET CARD */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-3)' }}>
                    TO (DESTINATION)
                  </span>
                  {toWallet && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
                      Current: <strong style={{ color: 'var(--text-2)' }}>{fmtMoney(toBalance, currency)}</strong>
                    </span>
                  )}
                </div>

                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {toWallet ? renderWalletIcon(toWallet.icon || 'wallet', 22, toWallet.color) : <WalletIcon size={16} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {toWallet?.name || 'Select Wallet'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {fmtMoney(toBalance, currency)}
                    </div>
                  </div>

                  <ChevronDown size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />

                  {/* Accessible overlay select for native interaction */}
                  <select
                    value={toWalletId}
                    onChange={e => {
                      setToWalletId(e.target.value);
                      if (e.target.value === fromWalletId) {
                        const other = wallets.find(w => w.id !== e.target.value);
                        if (other) setFromWalletId(other.id);
                      }
                      setError('');
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
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

            {/* 3. DATE & NOTE CONTROLS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                {/* Date Picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      className="form-input"
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      style={{
                        width: '100%',
                        height: 38,
                        borderRadius: 10,
                        fontSize: 12.5,
                        fontWeight: 500,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        paddingLeft: 34,
                      }}
                    />
                    <Calendar
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 11,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-3)',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Note Drawer Button Trigger */}
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(true)}
                  style={{
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 10,
                    background: note ? 'var(--accent-soft)' : 'var(--surface2)',
                    border: note ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: note ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  title="Add or edit transfer note"
                >
                  <FileText size={14} />
                  <span>{note ? 'Note Added' : '+ Note'}</span>
                </button>
              </div>

              {/* Note Preview Strip (if note is added) */}
              {note && (
                <div
                  onClick={() => setIsNoteModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--accent-border-soft, rgba(13, 148, 136, 0.2))',
                    borderRadius: 8,
                    padding: '5px 10px',
                    fontSize: 11.5,
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                    <FileText size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
                      {note}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setNote('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-3)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Remove note"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <p className="form-error" style={{ margin: 0, fontSize: 11.5 }}>
                {error}
              </p>
            )}

            {/* Transfer Summary Badge */}
            {fromWallet && toWallet && Number(amount) > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent)',
                }}
              >
                <span>{fromWallet.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>-{fmtMoney(Number(amount), currency)}</span>
                  <ArrowRight size={13} />
                  <span>+{fmtMoney(Number(amount), currency)}</span>
                </div>
                <span>{toWallet.name}</span>
              </div>
            )}

            {/* 4. ACTION BUTTONS: Cancel on Left, Confirm Transfer on Right */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 2,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  padding: '6px 14px',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={wallets.length < 2 || fromWalletId === toWalletId}
                style={{
                  flex: 1.3,
                  height: 36,
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                }}
              >
                <ArrowLeftRight size={14} />
                <span>Confirm Transfer</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Note Drawer Modal Dialog */}
      <NoteEditorModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title="Transfer Note"
        initialNote={note}
        onSave={setNote}
        placeholder="Add note for this transfer..."
        quickTags={[
          'ATM Cash Withdrawal',
          'Bank to UPI',
          'Savings Transfer',
          'Credit Card Bill',
          'Monthly Allowance',
          'Emergency Fund',
        ]}
      />
    </div>,
    document.body
  );
}
