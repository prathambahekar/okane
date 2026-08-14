import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import { useStore } from '../store';
import type { Friend } from '../types';
import { expenseFlow, unsettledExpensesForFriend, todayISO } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, cleanExpenseDescription } from '../utils';

interface Props {
  friend: Friend;
  onClose: () => void;
}

export default function SettleModal({ friend, onClose }: Props) {
  const { db, recordSettlement, showToast } = useStore();
  const { wallets, settings: { currency } } = db;

  const unsettled = useMemo(() => unsettledExpensesForFriend(db, friend.id), [db, friend.id]);
  const [selected, setSelected] = useState<Set<string>>(new Set(unsettled.map(e => e.id)));
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    db.settings.defaultWalletId || wallets[0]?.id || ''
  );
  const [settleDate, setSettleDate] = useState<string>(todayISO());
  const [note, setNote] = useState('');

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customAmountStr, setCustomAmountStr] = useState('');

  const selectedArr = unsettled.filter(e => selected.has(e.id));

  const owedToMe = selectedArr.filter(e => {
    if (e.type === 'for_friend' && expenseFlow(e) === 'out') return true;
    return false;
  }).reduce((s, e) => s + Number(e.amount), 0);

  const owedByMe = selectedArr.filter(e => {
    if (e.type === 'by_friend' && expenseFlow(e) === 'out') return true;
    if (e.status === 'unpaid' && expenseFlow(e) === 'out') return true;
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

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar" style={getAvatarStyle(friend.color)}>{friendInitial(friend.name, friend.avatarNumber)}</div>
            <div>
              <div className="modal-title">Settle with {friend.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{unsettled.length} unsettled expense{unsettled.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {unsettled.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <p>No unsettled expenses with {friend.name}.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 12, color: 'var(--text-3)' }}>
                <span>Select expenses to settle</span>
                <button className="btn-ghost btn-sm" style={{ fontSize: 11.5, padding: '3px 8px' }}
                  onClick={() => setSelected(selected.size === unsettled.length ? new Set() : new Set(unsettled.map(e => e.id)))}>
                  {selected.size === unsettled.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>
                {unsettled.map(e => {
                  const cat = db.settings.categories.find(c => c.name === e.category);
                  const isForFriend = e.type === 'for_friend';
                  const origAmt = e.originalAmount;
                  return (
                    <label key={e.id} className="settle-check-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8 }}>
                      <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                      <CategoryIcon category={e.category} size={15} style={{ color: cat?.color ?? 'var(--accent)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cleanExpenseDescription(e.description)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                          {fmtDate(e.originalDate || e.date)} {origAmt && Math.abs(origAmt - e.amount) > 0.01 ? `• Original ${fmtMoney(origAmt, currency)}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isForFriend ? 'var(--credit)' : 'var(--debit)' }}>
                          {isForFriend ? '+' : '-'}{fmtMoney(e.amount, currency)}
                        </div>
                        {origAmt && Math.abs(origAmt - e.amount) > 0.01 ? (
                          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                            og {fmtMoney(origAmt, currency)}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Settlement Type Segment Control (Full vs Custom Amount) */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                  Settlement Amount Mode
                </div>
                <div className="segment-control" style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`segment-btn ${!isCustomMode ? 'active' : ''}`}
                    style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      setIsCustomMode(false);
                      setCustomAmountStr('');
                    }}
                  >
                    Full Settlement ({fmtMoney(absNet, currency)})
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${isCustomMode ? 'active' : ''}`}
                    style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      setIsCustomMode(true);
                      if (!customAmountStr) setCustomAmountStr(String(absNet));
                    }}
                  >
                    Custom / Partial
                  </button>
                </div>
              </div>

              {/* Custom Amount Input Field with Quick Preset Chips */}
              {isCustomMode && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Amount Paid / Received ({currency})</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Total debt: {fmtMoney(absNet, currency)}</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder={`e.g. 30 (Full is ${absNet})`}
                    value={customAmountStr}
                    onChange={e => setCustomAmountStr(e.target.value)}
                    style={{ fontWeight: 700, fontSize: 16 }}
                  />
                  {/* Preset Chips */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {[0.25, 0.5, 0.75].map(ratio => {
                      const val = Math.round(absNet * ratio);
                      return (
                        <button
                          key={ratio}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6 }}
                          onClick={() => setCustomAmountStr(String(val))}
                        >
                          {ratio * 100}% ({fmtMoney(val, currency)})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary Card */}
              <div style={{
                background: net >= 0 ? 'rgba(46, 125, 50, 0.12)' : 'rgba(211, 47, 47, 0.12)',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                marginBottom: 14,
                border: net >= 0 ? '1px solid rgba(46, 125, 50, 0.25)' : '1px solid rgba(211, 47, 47, 0.25)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-2)' }}>Total Debt Selected</span>
                  <span style={{ fontWeight: 600 }}>{fmtMoney(absNet, currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-2)' }}>Amount Being Settled</span>
                  <span className={net >= 0 ? 'credit' : 'debit'} style={{ fontWeight: 700 }}>
                    {fmtMoney(effectiveSettleAmt, currency)}
                  </span>
                </div>
                {isCustomMode && remainingBalance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-2)', borderTop: '1px dashed var(--border)', paddingTop: 6, marginTop: 4 }}>
                    <span>Remaining Debt Owed</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {fmtMoney(remainingBalance, currency)}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Calendar size={14} style={{ color: 'var(--accent)' }} />
                  <span>Settlement Date</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={settleDate}
                  onChange={e => setSettleDate(e.target.value)}
                  style={{ fontWeight: 600 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Payment Method (Wallet)</label>
                <div className="segment-control" style={{ flexWrap: 'wrap' }}>
                  {wallets.map(w => {
                    const isSelected = selectedWalletId === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        className={`segment-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedWalletId(w.id);
                          if (!note || note.startsWith('Paid via ') || note.startsWith('Settled via ')) {
                            setNote(`Paid via ${w.name}`);
                          }
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <span className="cat-dot" style={{ background: w.color || 'var(--accent)' }} />
                        {w.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input
                  className="form-input"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={`e.g. Paid via ${wallets.find(w => w.id === selectedWalletId)?.name || 'Cash'}`}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          {unsettled.length > 0 && (
            <button className="btn btn-primary btn-sm" disabled={!selected.size || (isCustomMode && (!customAmountStr || effectiveSettleAmt <= 0))} onClick={handleSettle}
              style={{ background: net >= 0 ? 'linear-gradient(135deg, #34D399, #10B981)' : undefined }}>
              Confirm Settlement ({fmtMoney(effectiveSettleAmt, currency)})
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
