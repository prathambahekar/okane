import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, ReceiptText, FileText, Check, Wallet } from 'lucide-react';
import { useStore } from '../store';
import type { Friend } from '../types';
import { expenseFlow, unsettledExpensesForFriend, todayISO } from '../db';
import { fmtMoney, friendInitial, getAvatarStyle } from '../utils';
import SettleExpensePickerModal from './SettleExpensePickerModal';

interface Props {
  friend: Friend;
  onClose: () => void;
}

export default function SettleModal({ friend, onClose }: Props) {
  const { db, recordSettlement, showToast } = useStore();
  const { wallets, settings: { currency } } = db;

  const unsettled = useMemo(() => unsettledExpensesForFriend(db, friend.id), [db, friend.id]);
  const [selected, setSelected] = useState<Set<string>>(new Set(unsettled.map(e => e.id)));
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    db.settings.defaultWalletId || wallets[0]?.id || ''
  );
  const [settleDate, setSettleDate] = useState<string>(todayISO());
  const [note, setNote] = useState('');
  const [tempNote, setTempNote] = useState('');

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customAmountStr, setCustomAmountStr] = useState('');

  const selectedArr = unsettled.filter(e => selected.has(e.id));

  const owedToMe = selectedArr.filter(e => {
    if (e.friendId === friend.id && e.type === 'for_friend' && expenseFlow(e) === 'out') return true;
    return false;
  }).reduce((s, e) => s + Number(e.amount), 0);

  const owedByMe = selectedArr.filter(e => {
    if (e.friendId === friend.id && e.type === 'by_friend' && expenseFlow(e) === 'out') return true;
    if (e.vendorId === friend.id && e.status === 'unpaid' && expenseFlow(e) === 'out') return true;
    if (e.vendorId === friend.id && e.type === 'by_friend' && expenseFlow(e) === 'out') return true;
    if (e.friendId === friend.id && e.status === 'unpaid' && expenseFlow(e) === 'out') return true;
    return false;
  }).reduce((s, e) => s + Number(e.amount), 0);
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
    setTempNote(note);
    setIsNoteModalOpen(true);
  };

  const saveNoteModal = () => {
    setNote(tempNote.trim());
    setIsNoteModalOpen(false);
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
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth: 500 }}>
        {/* Drag Handle Indicator for Mobile Drawer Sheet */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar" style={{ ...getAvatarStyle(friend.color), borderRadius: 'var(--radius)' }}>
              {friendInitial(friend.name, friend.avatarNumber)}
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: 16, fontWeight: 700 }}>Settle with {friend.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{unsettled.length} unsettled expense{unsettled.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Note Icon Button in Header */}
            <button
              type="button"
              className="btn-icon"
              onClick={openNoteModal}
              title={note ? `Note: "${note}"` : 'Add note'}
              style={{
                position: 'relative',
                color: note ? 'var(--accent)' : 'var(--text-3)',
                background: note ? 'var(--accent-soft)' : 'transparent',
                border: note ? '1px solid var(--accent-border-soft)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <FileText size={17} />
              {note && (
                <span
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
              )}
            </button>
            <button type="button" className="btn-icon" onClick={onClose} title="Close" style={{ borderRadius: 'var(--radius-sm)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '16px 20px 20px' }}>
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
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      <ReceiptText size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selected.size === 0
                          ? 'Tap to Select Expenses'
                          : selected.size === unsettled.length
                          ? `All ${unsettled.length} Expenses Selected`
                          : `${selected.size} of ${unsettled.length} Expenses Selected`}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selected.size > 0 ? (
                          <>
                            Net Total: <strong style={{ color: net >= 0 ? 'var(--credit)' : 'var(--debit)' }}>{fmtMoney(absNet, currency)}</strong>
                            {' • '}
                            <span>{unsettled.length} available</span>
                          </>
                        ) : (
                          `Choose from ${unsettled.length} unsettled transaction${unsettled.length !== 1 ? 's' : ''}`
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--accent-contrast, #ffffff)',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    {selected.size > 0 ? 'Edit' : '+ Select'}
                  </button>
                </div>
              </div>

              {/* Settlement Amount Mode Segment Toggle */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                  Settlement Amount Mode
                </div>
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 3,
                    gap: 3,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: !isCustomMode ? 650 : 500,
                      borderRadius: 6,
                      border: !isCustomMode ? '1px solid var(--accent-border-soft, var(--accent))' : '1px solid transparent',
                      background: !isCustomMode ? 'var(--accent-soft)' : 'transparent',
                      color: !isCustomMode ? 'var(--accent)' : 'var(--text-3)',
                      boxShadow: !isCustomMode ? '0 1px 3px var(--accent-soft)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => {
                      setIsCustomMode(false);
                      setCustomAmountStr('');
                    }}
                  >
                    Full ({fmtMoney(absNet, currency)})
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: isCustomMode ? 650 : 500,
                      borderRadius: 6,
                      border: isCustomMode ? '1px solid var(--accent-border-soft, var(--accent))' : '1px solid transparent',
                      background: isCustomMode ? 'var(--accent-soft)' : 'transparent',
                      color: isCustomMode ? 'var(--accent)' : 'var(--text-3)',
                      boxShadow: isCustomMode ? '0 1px 3px var(--accent-soft)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => {
                      setIsCustomMode(true);
                      if (!customAmountStr) setCustomAmountStr(String(absNet));
                    }}
                  >
                    Custom / Partial
                  </button>
                </div>
              </div>

              {/* Compact Custom Amount Input Field */}
              {isCustomMode && (
                <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                      Custom Amount ({currency})
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Total due: {fmtMoney(absNet, currency)}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder={`Enter amount (e.g. ${Math.round(absNet / 2)})`}
                    value={customAmountStr}
                    onChange={e => setCustomAmountStr(e.target.value)}
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      height: 36,
                      background: 'var(--surface)',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>
              )}

              {/* Clean Summary Card */}
              <div
                style={{
                  background: 'var(--surface2)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 14px',
                  marginBottom: 14,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-3)' }}>Total Debt Selected</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtMoney(absNet, currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: remainingBalance > 0 ? 5 : 0 }}>
                  <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>Amount Settling Now</span>
                  <span style={{ fontWeight: 700, color: net >= 0 ? 'var(--credit)' : 'var(--debit)', fontSize: 13.5 }}>
                    {net >= 0 ? '+' : '-'}{fmtMoney(effectiveSettleAmt, currency)}
                  </span>
                </div>
                {isCustomMode && remainingBalance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-3)', borderTop: '1px dashed var(--border)', paddingTop: 6, marginTop: 5 }}>
                    <span>Remaining Balance</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {fmtMoney(remainingBalance, currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Date & Payment Method in One Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
                {/* Settlement Date */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Calendar size={13} style={{ color: 'var(--accent)' }} />
                    <span>Settlement Date</span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={settleDate}
                    onChange={e => setSettleDate(e.target.value)}
                    style={{
                      fontWeight: 600,
                      height: 40,
                      fontSize: 12.5,
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  />
                </div>

                {/* Payment Method (Wallet) Dropdown */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Wallet size={13} style={{ color: 'var(--accent)' }} />
                    <span>Payment Method</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="form-select"
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
                        height: 40,
                        fontSize: 12.5,
                        fontWeight: 600,
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        paddingLeft: 28,
                        width: '100%',
                      }}
                    >
                      {wallets.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    {/* Wallet Color Indicator Dot */}
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: activeWallet?.color || 'var(--accent)',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ borderRadius: 'var(--radius)', fontSize: 12.5 }}>
            Cancel
          </button>
          {unsettled.length > 0 && (
            <button
              className="btn btn-primary"
              disabled={!selected.size || (isCustomMode && (!customAmountStr || effectiveSettleAmt <= 0))}
              onClick={handleSettle}
              style={{
                padding: '9px 20px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 'var(--radius)',
                background: net >= 0 ? 'linear-gradient(135deg, #34D399, #10B981)' : undefined,
              }}
            >
              Confirm Settlement ({fmtMoney(effectiveSettleAmt, currency)})
            </button>
          )}
        </div>
      </div>

      {/* Separate Dedicated Note Modal */}
      {isNoteModalOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 10005, background: 'rgba(0,0,0,0.65)' }}
          onClick={e => { if (e.target === e.currentTarget) setIsNoteModalOpen(false); }}
        >
          <div className="modal" style={{ maxWidth: 380, animation: 'slidein 0.15s ease' }}>
            <div className="modal-handle-bar">
              <div className="modal-handle" />
            </div>
            <div className="modal-header" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                  <FileText size={15} />
                </div>
                <div className="modal-title" style={{ fontSize: 14, fontWeight: 700 }}>Settlement Note</div>
              </div>
              <button className="btn-icon" onClick={() => setIsNoteModalOpen(false)} style={{ borderRadius: 'var(--radius-sm)' }}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ padding: '14px 18px' }}>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Add optional settlement remarks or note..."
                value={tempNote}
                onChange={e => setTempNote(e.target.value)}
                style={{ fontSize: 13, width: '100%', marginBottom: 12, resize: 'none', borderRadius: 'var(--radius)' }}
              />
              {/* Quick suggestion tags */}
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Quick tags:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  activeWallet ? `Paid via ${activeWallet.name}` : 'Paid via Google Pay',
                  'Cash repayment',
                  'Settled in full',
                  'Bill share',
                ].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setTempNote(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: 'var(--radius-sm)', fontSize: 12 }}
                onClick={() => {
                  setTempNote('');
                  setNote('');
                  setIsNoteModalOpen(false);
                }}
              >
                Clear
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ borderRadius: 'var(--radius-sm)', fontSize: 12 }} onClick={() => setIsNoteModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={saveNoteModal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 'var(--radius-sm)', fontSize: 12 }}
                >
                  <Check size={14} /> Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
