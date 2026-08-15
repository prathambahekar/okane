import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Palette,
} from 'lucide-react';
import { useStore } from '../store';
import type { Envelope } from '../types';
import { FRIEND_PALETTE } from '../db';
import { ENVELOPE_ICONS, getEnvelopeIconComponent } from '../utils/envelopeUtils';

interface Props {
  envelope?: Envelope | null;
  defaultWalletId?: string;
  onClose: () => void;
}

export default function EnvelopeModal({ envelope, defaultWalletId, onClose }: Props) {
  const { db, addEnvelope, updateEnvelope, showToast } = useStore();
  const { wallets, settings: { currency } } = db;

  const [name, setName] = useState(envelope?.name ?? '');
  const [walletId, setWalletId] = useState(envelope?.walletId ?? defaultWalletId ?? wallets[0]?.id ?? 'wal_cash');
  const [targetAmount, setTargetAmount] = useState(envelope ? String(envelope.targetAmount) : '10000');
  const [currentAmount, setCurrentAmount] = useState(envelope ? String(envelope.currentAmount) : '0');
  const [color, setColor] = useState(() => envelope?.color ?? FRIEND_PALETTE[Math.floor(Math.random() * FRIEND_PALETTE.length)]);
  const [icon, setIcon] = useState(envelope?.icon ?? 'piggy-bank');
  const [targetDate, setTargetDate] = useState(envelope?.targetDate ?? '');
  const [notes, setNotes] = useState(envelope?.notes ?? '');
  const [error, setError] = useState('');

  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Envelope name is required');
      return;
    }
    const tAmt = Math.max(0, Number(targetAmount) || 0);
    const cAmt = Math.max(0, Number(currentAmount) || 0);

    if (envelope) {
      updateEnvelope(envelope.id, {
        name: name.trim(),
        walletId,
        targetAmount: tAmt,
        currentAmount: cAmt,
        color,
        icon,
        targetDate,
        notes: notes.trim(),
      });
      showToast('Envelope updated');
    } else {
      addEnvelope({
        name: name.trim(),
        walletId,
        targetAmount: tAmt,
        currentAmount: cAmt,
        color,
        icon,
        targetDate,
        notes: notes.trim(),
      });
      showToast('Envelope created');
    }
    onClose();
  };

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: `${color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: color,
              }}
            >
              {React.createElement(getEnvelopeIconComponent(icon), { size: 18 })}
            </div>
            <span className="modal-title">{envelope ? 'Edit Envelope' : 'New Goal Envelope'}</span>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--debit)', borderRadius: 8, color: 'var(--debit)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Goal / Envelope Name *</label>
              <input
                className="form-input"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                placeholder="e.g. Emergency Reserve, Goa Vacation, New Laptop"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Assigned Wallet</label>
                <select className="form-select" value={walletId} onChange={e => setWalletId(e.target.value)}>
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <span className="form-hint">Wallet funding this envelope</span>
              </div>

              <div className="form-group">
                <label className="form-label">Target Date (Optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Target Goal Amount ({currency})</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetAmount}
                  onChange={e => setTargetAmount(e.target.value)}
                  placeholder="10000"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Current Saved ({currency})</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentAmount}
                  onChange={e => setCurrentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Icon Picker */}
            <div className="form-group">
              <label className="form-label">Goal Icon</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {ENVELOPE_ICONS.map(item => {
                  const IconComp = item.icon;
                  const isSel = icon === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      title={item.label}
                      onClick={() => setIcon(item.name)}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: isSel ? `2px solid ${color}` : '1px solid var(--border)',
                        background: isSel ? `${color}18` : 'var(--surface2)',
                        color: isSel ? color : 'var(--text-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <IconComp size={18} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Swatches */}
            <div className="form-group">
              <label className="form-label">Theme Color</label>
              <div className="color-swatch-grid">
                {FRIEND_PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${color === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Select color ${c}`}
                  />
                ))}
                <button
                  type="button"
                  className={`color-swatch ${!FRIEND_PALETTE.includes(color) ? 'selected' : ''}`}
                  onClick={() => colorInputRef.current?.click()}
                  style={{
                    background: !FRIEND_PALETTE.includes(color) ? color : 'var(--surface2)',
                    border: '1.5px dashed var(--border2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Choose Custom Color"
                >
                  <Palette size={12} style={{ color: 'var(--text)' }} />
                </button>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={color.startsWith('#') && color.length === 7 ? color : '#3B82F6'}
                  onChange={e => setColor(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes or Description (Optional)</label>
              <input
                className="form-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g., Saving 2,000 every month until December"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {envelope ? 'Save Changes' : 'Create Envelope'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
