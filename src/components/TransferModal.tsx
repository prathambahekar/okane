import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeftRight, AlertCircle, Calendar, ChevronDown, Wallet as WalletIcon, Feather, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { walletBalance, todayISO } from '../db';
import { fmtMoney, currencySymbol } from '../utils';
import { NoteEditorModal } from './common/NoteEditorModal';
import { renderWalletIcon } from './WalletIconRenderer';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';
import { showSoftKeyboard } from '../utils/keyboard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultFromWalletId?: string;
  defaultToWalletId?: string;
}

export default function TransferModal({ isOpen, onClose, defaultFromWalletId, defaultToWalletId }: Props) {
  useBackButtonModal(isOpen, onClose, { priority: BackPriority.MODAL });

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
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus amount input on modal open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (amountInputRef.current) {
          showSoftKeyboard(amountInputRef.current, { placeCursorAtEnd: true, scroll: true });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useBackButtonModal(isNoteModalOpen, () => setIsNoteModalOpen(false), { priority: BackPriority.DIALOG });

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

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
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
            className="modal modal-dialog-panel"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag Handle Pill */}
            <div className="modal-drag-handle" />

        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '16px 20px 14px' }}>
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
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <span className="modal-title" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>Transfer Between Wallets</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Note Drawer Button Trigger */}
            <button
              type="button"
              className={`btn-icon ${note ? 'has-note' : ''}`}
              onClick={() => setIsNoteModalOpen(true)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: note ? 'var(--text)' : 'var(--text-3)',
                background: note ? 'var(--surface2)' : 'transparent',
                border: note ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={note ? `Note: "${note}"` : 'Add note'}
              aria-label={note ? 'Edit note' : 'Add note'}
            >
              <Feather size={16} strokeWidth={2} />
            </button>
            <button
              className="btn-icon"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
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

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '8px 20px 20px', gap: 14, display: 'flex', flexDirection: 'column' }}>
            {/* 1. HERO AMOUNT CARD */}
            <div
              className="hero-amount-card"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 18px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 'var(--fs-caption)',
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
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--fs-hero-sm)',
                    fontWeight: 700,
                    color: 'var(--text-2)',
                    lineHeight: 1,
                  }}
                >
                  {currencySymbol(currency)}
                </span>
                <input
                  ref={amountInputRef}
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setError(''); }}
                  placeholder="0"
                  style={{
                    fontSize: 'var(--fs-hero)',
                    fontWeight: 700,
                    color: 'var(--text)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                    width: `${Math.max(1, (amount || '0').length) * 18 + 8}px`,
                    maxWidth: '220px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* Insufficient Balance Warning */}
            {isInsufficient && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--fs-caption)',
                  color: 'var(--amber)',
                  background: 'var(--amber-bg)',
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--amber-border)',
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>Amount exceeds available source balance ({fmtMoney(fromBalance, currency)}).</span>
              </div>
            )}

            {/* 2. BEAUTIFUL UNIFIED WALLET SELECTION (FROM & TO WITH SWAP) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
              {/* FROM (SOURCE) WALLET CARD */}
              <div
                style={{
                  position: 'relative',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-3)' }}>
                    FROM (SOURCE)
                  </span>
                  {fromWallet && (
                    <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: fromBalance < 0 ? 'var(--debit)' : 'var(--text-3)' }}>
                      Available: <strong style={{ color: fromBalance < 0 ? 'var(--debit)' : 'var(--text-2)' }}>{fmtMoney(fromBalance, currency)}</strong>
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {fromWallet ? renderWalletIcon(fromWallet.icon || fromWallet.name, 30, fromWallet.color) : <WalletIcon size={18} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fromWallet?.name || 'Select Wallet'}
                    </div>
                  </div>

                  <ChevronDown size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                </div>

                {/* Accessible overlay select */}
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

              {/* SWAP BUTTON (FLOATING CENTER) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '-12px 0',
                  zIndex: 2,
                  position: 'relative',
                }}
              >
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
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    transition: 'transform 0.2s ease, border-color 0.15s ease, color 0.15s ease',
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'rotate(180deg) scale(0.95)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'none'}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--text)';
                    e.currentTarget.style.borderColor = 'var(--border2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--text-2)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <ArrowLeftRight size={14} />
                </button>
              </div>

              {/* TO (DESTINATION) WALLET CARD */}
              <div
                style={{
                  position: 'relative',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-3)' }}>
                    TO (DESTINATION)
                  </span>
                  {toWallet && (
                    <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text-3)' }}>
                      Current: <strong style={{ color: 'var(--text-2)' }}>{fmtMoney(toBalance, currency)}</strong>
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {toWallet ? renderWalletIcon(toWallet.icon || toWallet.name, 30, toWallet.color) : <WalletIcon size={18} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {toWallet?.name || 'Select Wallet'}
                    </div>
                  </div>

                  <ChevronDown size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                </div>

                {/* Accessible overlay select */}
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

            {/* 3. DATE CONTROL & NOTE PREVIEW */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  className="form-input"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--fs-sm)',
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

              {/* Note Preview Strip (if note is added) */}
              {note && (
                <div
                  onClick={() => setIsNoteModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 10px',
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                    <Feather size={12} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
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
              <p className="form-error" style={{ margin: 0, fontSize: 'var(--fs-caption)' }}>
                {error}
              </p>
            )}

            {/* 4. ACTION BUTTONS: Clear on Left, Confirm Transfer on Right (Pill Styled) */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={(e) => {
                  e.preventDefault();
                  setAmount('');
                  setError('');
                  if (amountInputRef.current) {
                    amountInputRef.current.focus();
                  }
                }}
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
                disabled={wallets.length < 2 || fromWalletId === toWalletId}
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
                <ArrowLeftRight size={15} style={{ color: 'inherit' }} />
                <span>Confirm Transfer</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>

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
    </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
