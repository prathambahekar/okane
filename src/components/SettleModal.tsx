import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import { useStore } from '../store';
import type { Friend } from '../types';
import { expenseFlow, unsettledExpensesForFriend } from '../db';
import { fmtMoney, fmtDate, friendInitial } from '../utils';

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
  const [note, setNote] = useState('');

  const selectedArr = unsettled.filter(e => selected.has(e.id));
  const owedToMe = selectedArr.filter(e => e.type === 'for_friend' && expenseFlow(e) === 'out').reduce((s, e) => s + Number(e.amount), 0);
  const owedByMe = selectedArr.filter(e => e.type === 'by_friend' && expenseFlow(e) === 'out').reduce((s, e) => s + Number(e.amount), 0);
  const net = owedToMe - owedByMe;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSettle = () => {
    if (!selected.size) return;
    recordSettlement(friend.id, Array.from(selected), note, selectedWalletId);
    const targetWallet = wallets.find(w => w.id === selectedWalletId);
    const wName = targetWallet?.name || 'Wallet';
    const actionText = net >= 0 ? `credited to ${wName}` : `deducted from ${wName}`;
    showToast(`Settled ${fmtMoney(Math.abs(net), currency)} (${actionText})`);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar" style={{ background: friend.color }}>{friendInitial(friend.name)}</div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', marginBottom: 14 }}>
                {unsettled.map(e => {
                  const cat = db.settings.categories.find(c => c.name === e.category);
                  return (
                    <label key={e.id} className="settle-check-row">
                      <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                      <CategoryIcon category={e.category} size={15} style={{ color: cat?.color ?? 'var(--accent)', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{e.description}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 10 }}>{fmtDate(e.date)}</span>
                      <span style={{ fontWeight: 500, color: e.type === 'for_friend' ? 'var(--credit)' : 'var(--debit)' }}>
                        {e.type === 'for_friend' ? '+' : '-'}{fmtMoney(e.amount, currency)}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div style={{
                background: net >= 0 ? 'rgba(46, 125, 50, 0.12)' : 'rgba(211, 47, 47, 0.12)',
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
                marginBottom: 14,
                border: net >= 0 ? '1px solid rgba(46, 125, 50, 0.25)' : '1px solid rgba(211, 47, 47, 0.25)'
              }}>
                {owedToMe > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-2)' }}>{friend.name} owes you</span>
                    <span className="credit" style={{ fontWeight: 600 }}>{fmtMoney(owedToMe, currency)}</span>
                  </div>
                )}
                {owedByMe > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-2)' }}>You owe {friend.name}</span>
                    <span className="debit" style={{ fontWeight: 600 }}>{fmtMoney(owedByMe, currency)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                  <span>Net Settlement</span>
                  <span className={net >= 0 ? 'credit' : 'debit'}>
                    {net >= 0 ? `${friend.name} pays You ` : `You pay ${friend.name} `}{fmtMoney(Math.abs(net), currency)}
                  </span>
                </div>
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
            <button className="btn btn-primary btn-sm" disabled={!selected.size} onClick={handleSettle}
              style={{ background: net >= 0 ? 'linear-gradient(135deg, #34D399, #10B981)' : undefined }}>
              Confirm Settlement ({selected.size})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
