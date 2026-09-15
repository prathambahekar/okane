import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Calendar, ReceiptText, Feather, Wallet, Check, RotateCcw, Pencil, ChevronDown } from 'lucide-react';
import { useStore } from '../store';
import type { Friend } from '../types';
import { expenseFlow, unsettledExpensesForFriend, todayISO } from '../db';
import { fmtMoney, friendInitial, getAvatarStyle, currencySymbol } from '../utils';
import SettleExpensePickerModal from './SettleExpensePickerModal';
import { NoteEditorModal } from './common/NoteEditorModal';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

interface Props {
  friend: Friend;
  onClose: () => void;
}

export default function SettleModal({ friend, onClose }: Props) {
  useBackButtonModal(true, onClose, { priority: BackPriority.MODAL });

  const { db, recordSettlement, showToast } = useStore();
  const { wallets, settings: { currency } } = db;

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const unsettled = useMemo(() => unsettledExpensesForFriend(db, friend.id), [db, friend.id]);
  const [selected, setSelected] = useState<Set<string>>(new Set(unsettled.map(e => e.id)));
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  useBackButtonModal(isPickerOpen, () => setIsPickerOpen(false), { priority: BackPriority.DIALOG });
  useBackButtonModal(isNoteModalOpen, () => setIsNoteModalOpen(false), { priority: BackPriority.DIALOG });
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    db.settings.defaultWalletId || wallets[0]?.id || ''
  );
  const [settleDate, setSettleDate] = useState<string>(todayISO());
  const [note, setNote] = useState('');

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customAmountStr, setCustomAmountStr] = useState('');

  const selectedArr = unsettled.filter(e => selected.has(e.id));

  const { owedToMe, owedByMe } = useMemo(() => {
    let toMe = 0;
    let byMe = 0;
    selectedArr.forEach(e => {
      const amt = Number(e.amount) || 0;
      const isIncoming = expenseFlow(e) === 'in';
      const isSettlingVendor = e.vendorId === friend.id;
      const isSettlingFriend = e.friendId === friend.id;

      if (isSettlingVendor) {
        if (isIncoming) toMe += amt;
        else byMe += amt;
      } else if (isSettlingFriend) {
        if (e.type === 'for_friend') {
          if (isIncoming) toMe -= amt;
          else toMe += amt;
        } else if (e.type === 'by_friend') {
          if (isIncoming) byMe -= amt;
          else byMe += amt;
        } else if (e.status === 'unpaid') {
          if (isIncoming) toMe += amt;
          else byMe += amt;
        }
      } else {
        if (isIncoming) toMe += amt;
        else byMe += amt;
      }
    });
    return { owedToMe: toMe, owedByMe: byMe };
  }, [selectedArr, friend.id]);

  const net = owedToMe - owedByMe;
  const absNet = Math.abs(net);

  const parsedCustom = parseFloat(customAmountStr);
  const effectiveSettleAmt = isCustomMode && !isNaN(parsedCustom) && parsedCustom > 0 ? parsedCustom : absNet;
  const remainingBalance = Math.max(0, absNet - effectiveSettleAmt);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(unsettled.map(e => e.id)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const openNoteModal = () => {
    setIsNoteModalOpen(true);
  };

  const handleClearToDefault = () => {
    setSelected(new Set(unsettled.map(e => e.id)));
    setIsCustomMode(false);
    setCustomAmountStr('');
    setSettleDate(todayISO());
    setSelectedWalletId(db.settings.defaultWalletId || wallets[0]?.id || '');
    setNote('');
    showToast('Reset to default');
  };

  const handleSettle = () => {
    if (!selected.size) return;
    const customVal = isCustomMode && !isNaN(parsedCustom) && parsedCustom > 0 ? parsedCustom : undefined;
    recordSettlement(friend.id, Array.from(selected), note, selectedWalletId, customVal, settleDate);
    const targetWallet = wallets.find(w => w.id === selectedWalletId);
    const wName = targetWallet?.name || 'Wallet';
    const actionText = net >= 0 ? `credited to ${wName}` : `deducted from ${wName}`;
    const remText = remainingBalance > 0 ? ` • ${fmtMoney(remainingBalance, currency)} remaining` : '';
    showToast(`Settled ${fmtMoney(effectiveSettleAmt, currency)} (${actionText})${remText}`);
    onClose();
  };

  const activeWallet = wallets.find(w => w.id === selectedWalletId);

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

      {/* Sheet panel / Desktop center dialog */}
      <motion.div
        initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="modal modal-dialog-panel"
        style={{
          maxWidth: 560,
          width: '100%',
          maxHeight: 'min(90vh, 90dvh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-2xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag Handle Indicator */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 'var(--radius-full)',
            background: 'var(--border2)',
            margin: '12px auto 10px',
            flexShrink: 0,
          }}
        />

        {/* Themed Modal Header */}
        <div className="modal-header" style={{ padding: '0 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="avatar"
              style={{
                ...getAvatarStyle(friend.color),
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-lg)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
              }}
            >
              {friendInitial(friend.name, friend.avatarNumber)}
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                Settle with {friend.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--text-3)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-2)' }}>
                  {unsettled.length} unsettled transaction{unsettled.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Note Drawer Button Trigger */}
            <button
              type="button"
              className={`btn-icon ${note ? 'has-note' : ''}`}
              onClick={openNoteModal}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: note ? 'var(--text)' : 'var(--text-3)',
                background: note ? 'var(--surface2)' : 'var(--surface2)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={note ? `Note: "${note}"` : 'Add note'}
              aria-label={note ? 'Edit note' : 'Add note'}
            >
              <Feather size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '16px 20px 0px' }}>
          {unsettled.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <p>No unsettled expenses with {friend.name}.</p>
            </div>
          ) : (
            <>
              {/* Tap to Select Expenses Banner */}
              <div style={{ marginBottom: 14 }}>
                <div
                  onClick={() => setIsPickerOpen(true)}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-sm)',
                        background: 'transparent',
                        color: 'var(--text)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ReceiptText size={20} style={{ color: 'var(--text)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selected.size === 0
                          ? 'Tap to Select Expenses'
                          : selected.size === unsettled.length
                          ? `All ${unsettled.length} Expenses Selected`
                          : `${selected.size} of ${unsettled.length} Expenses Selected`}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {selected.size > 0 ? (
                          <>
                            <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 500, color: 'var(--text-3)' }}>Net Total:</span>
                            <span
                              style={{
                                color: net >= 0 ? 'var(--credit)' : 'var(--debit)',
                                fontWeight: 700,
                                fontSize: 'var(--fs-xs)',
                                letterSpacing: '0.2px',
                              }}
                            >
                              {fmtMoney(absNet, currency)}
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                            {`Choose from ${unsettled.length} unsettled transaction${unsettled.length !== 1 ? 's' : ''}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Edit selected expenses"
                    title="Edit selected expenses"
                    style={{
                      background: 'transparent',
                      color: 'var(--text-2)',
                      border: 'none',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      padding: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'var(--text)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'var(--text-2)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Pencil size={15} style={{ strokeWidth: 2 }} />
                  </button>
                </div>
              </div>

              {/* Settle Amount Mode Segment Toggle */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                  Settle Mode
                </div>
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 4,
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '8px 12px',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: !isCustomMode ? 700 : 500,
                      borderRadius: 'var(--radius-md)',
                      border: !isCustomMode ? '1px solid var(--text)' : '1px solid transparent',
                      background: !isCustomMode ? 'var(--text)' : 'transparent',
                      color: !isCustomMode ? 'var(--bg)' : 'var(--text-3)',
                      boxShadow: !isCustomMode ? '0 2px 6px rgba(0,0,0,0.25)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      setIsCustomMode(false);
                      setCustomAmountStr('');
                    }}
                  >
                    <span>Full</span>
                    <span
                      style={{
                        fontSize: 'var(--fs-xs)',
                        fontWeight: !isCustomMode ? 700 : 500,
                        opacity: !isCustomMode ? 0.95 : 0.65,
                        letterSpacing: '0.15px',
                      }}
                    >
                      {fmtMoney(absNet, currency)}
                    </span>
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '8px 12px',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: isCustomMode ? 700 : 500,
                      borderRadius: 'var(--radius-md)',
                      border: isCustomMode ? '1px solid var(--text)' : '1px solid transparent',
                      background: isCustomMode ? 'var(--text)' : 'transparent',
                      color: isCustomMode ? 'var(--bg)' : 'var(--text-3)',
                      boxShadow: isCustomMode ? '0 2px 6px rgba(0,0,0,0.25)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      setIsCustomMode(true);
                      if (!customAmountStr) setCustomAmountStr(String(absNet));
                    }}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Styled Custom Amount Input Field */}
              {isCustomMode && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      Custom Amount
                    </label>
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500 }}>
                      Total due: <span style={{ color: 'var(--text)', fontWeight: 700 }}>{fmtMoney(absNet, currency)}</span>
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0 14px',
                      height: 44,
                      transition: 'all 0.15s ease',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--fs-lg)',
                        fontWeight: 700,
                        color: 'var(--accent, #10b981)',
                        userSelect: 'none',
                        lineHeight: 1,
                      }}
                    >
                      {currencySymbol(currency)}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={absNet}
                      placeholder="0.00"
                      value={customAmountStr}
                      onChange={e => setCustomAmountStr(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 700,
                        fontSize: 'var(--fs-md)',
                        background: 'transparent',
                        color: 'var(--text)',
                        border: 'none',
                        outline: 'none',
                        padding: 0,
                        boxSizing: 'border-box',
                        width: '100%',
                      }}
                      autoFocus
                    />
                    {customAmountStr && (
                      <button
                        type="button"
                        onClick={() => setCustomAmountStr('')}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: 'var(--text-2)',
                          cursor: 'pointer',
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 9999,
                          padding: 0,
                          flexShrink: 0,
                        }}
                        title="Clear amount"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Clean Summary Card */}
              <div
                style={{
                  background: 'var(--surface2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 16px',
                  marginBottom: 14,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-3)', fontWeight: 500, fontSize: 'var(--fs-xs)' }}>Total Debt Selected</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: 'var(--fs-sm)', letterSpacing: '0.2px' }}>{fmtMoney(absNet, currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: remainingBalance > 0 ? 6 : 0 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 'var(--fs-base)' }}>Amount Settling Now</span>
                  <span style={{ fontWeight: 700, color: net >= 0 ? 'var(--credit)' : 'var(--debit)', fontSize: 'var(--fs-md)', letterSpacing: '0.2px' }}>
                    {net >= 0 ? '+' : '-'}{fmtMoney(effectiveSettleAmt, currency)}
                  </span>
                </div>
                {isCustomMode && remainingBalance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, marginTop: 6 }}>
                    <span style={{ color: 'var(--text-3)', fontWeight: 500, fontSize: 'var(--fs-xs)' }}>Remaining Balance</span>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 'var(--fs-sm)', letterSpacing: '0.2px' }}>
                      {fmtMoney(remainingBalance, currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Date & Payment Method in One Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
                {/* Settle Date */}
                <div>
                  <label style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Calendar size={13} style={{ color: 'var(--accent)' }} />
                    <span>Settle Date</span>
                  </label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={e => setSettleDate(e.target.value)}
                    style={{
                      width: '100%',
                      fontWeight: 600,
                      height: 42,
                      fontSize: 'var(--fs-sm)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      padding: '0 12px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Payment Method (Wallet) Dropdown */}
                <div>
                  <label style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Wallet size={13} style={{ color: 'var(--accent)' }} />
                    <span>Payment Method</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedWalletId}
                      onChange={e => {
                        const wId = e.target.value;
                        setSelectedWalletId(wId);
                        const selW = wallets.find(w => w.id === wId);
                        if (selW && (!note || note.startsWith('Paid via ') || note.startsWith('Settled via '))) {
                          setNote(`Paid via ${selW.name}`);
                        }
                      }}
                      style={{
                        width: '100%',
                        height: 42,
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface2)',
                        color: 'var(--text)',
                        padding: '0 32px 0 12px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {wallets.map(w => (
                        <option key={w.id} value={w.id} style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={15}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: 'var(--text-2)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '16px 20px 18px',
            display: 'flex',
            gap: 10,
            borderTop: 'none',
            background: 'transparent',
            flexShrink: 0,
          }}
        >
          {unsettled.length === 0 ? (
            <button
              type="button"
              className="btn"
              onClick={onClose}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--fs-base)',
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
              <X size={15} style={{ color: 'var(--text)' }} />
              <span>Close</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={handleClearToDefault}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-base)',
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
                title="Reset to default values"
              >
                <RotateCcw size={14} style={{ color: 'var(--text)' }} />
                <span>Clear</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selected.size || (isCustomMode && (!customAmountStr || effectiveSettleAmt <= 0))}
                onClick={handleSettle}
                style={{
                  flex: 1.35,
                  height: 44,
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-base)',
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
                <Check size={16} style={{ color: 'inherit' }} />
                <span>Settle {fmtMoney(effectiveSettleAmt, currency)}</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Separate Dedicated Note Modal */}
      <NoteEditorModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title="Settle Note"
        initialNote={note}
        onSave={(newNote) => setNote(newNote)}
        placeholder="Add optional settle remarks, payment reference or note..."
        quickTags={
          activeWallet
            ? [`Paid via ${activeWallet.name}`, 'Cash repayment', 'Settled in full', 'Bill share', 'UPI Transfer', 'Bank Transfer']
            : ['Paid via Google Pay', 'Cash repayment', 'Settled in full', 'Bill share', 'UPI Transfer', 'Bank Transfer']
        }
      />

      {/* Settle Expense Picker Drawer Modal */}
      {isPickerOpen && (
        <SettleExpensePickerModal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          friend={friend}
          expenses={unsettled}
          selectedIds={selected}
          onToggle={toggle}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          currency={currency}
          db={db}
          title="Select Expenses to Settle"
        />
      )}
    </div>,
    document.body
  );
}
