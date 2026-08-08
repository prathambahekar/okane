import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Palette } from 'lucide-react';
import { useStore } from '../store';
import type { Wallet } from '../types';
import { FRIEND_PALETTE } from '../db';

interface Props {
  wallet?: Wallet | null;
  onClose: () => void;
}

export default function WalletModal({ wallet, onClose }: Props) {
  const { addWallet, updateWallet, showToast } = useStore();
  const [name, setName] = useState(wallet?.name ?? '');
  const [openingBalance, setOpeningBalance] = useState(wallet ? String(wallet.openingBalance) : '0');
  const [color, setColor] = useState(() => wallet?.color ?? FRIEND_PALETTE[Math.floor(Math.random() * FRIEND_PALETTE.length)]);
  const [error, setError] = useState('');
  const walletColorInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (wallet) {
      updateWallet(wallet.id, { name: name.trim(), openingBalance: Number(openingBalance) || 0, color });
      showToast('Wallet updated');
    } else {
      addWallet({ name: name.trim(), openingBalance: Number(openingBalance) || 0, color });
      showToast('Wallet created');
    }
    onClose();
  };

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{wallet ? 'Edit Wallet' : 'New Wallet'}</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Wallet Name *</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cash, Credit Card…" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Opening Balance</label>
                <input className="form-input" type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="0.00" />
                <span className="form-hint">Starting balance for this wallet</span>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div className="color-swatch-grid">
                  {FRIEND_PALETTE.map(c => (
                    <button key={c} type="button"
                      className={`color-swatch ${color === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                  <button
                    type="button"
                    className={`color-swatch ${!FRIEND_PALETTE.includes(color) ? 'selected' : ''}`}
                    onClick={() => {
                      if (walletColorInputRef.current) {
                        try {
                          if ('showPicker' in walletColorInputRef.current && typeof walletColorInputRef.current.showPicker === 'function') {
                            walletColorInputRef.current.showPicker();
                            return;
                          }
                        } catch {
                          // Fallback
                        }
                        walletColorInputRef.current.click();
                      }
                    }}
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
                    ref={walletColorInputRef}
                    type="color"
                    value={color.startsWith('#') && color.length === 7 ? color : '#3B82F6'}
                    onChange={e => setColor(e.target.value)}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: 1,
                      height: 1,
                      pointerEvents: 'none',
                      visibility: 'hidden',
                    }}
                  />
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">{wallet ? 'Save Changes' : 'Add Wallet'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
