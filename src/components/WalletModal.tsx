import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Wallet as WalletIcon, Plus, Check, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';
import type { Wallet } from '../types';
import { WALLET_PRESETS, renderWalletIcon } from './WalletIconRenderer';
import { currencySymbol } from '../utils';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

interface Props {
  wallet?: Wallet;
  onClose: () => void;
}

export default function WalletModal({ wallet, onClose }: Props) {
  useBackButtonModal(true, onClose, { priority: BackPriority.MODAL });

  const { addWallet, updateWallet, showToast, db } = useStore();
  const currency = db.settings?.currency || 'INR';
  const isCurrentlyDefault = wallet
    ? (wallet.isDefault ?? (db.settings.defaultWalletId === wallet.id))
    : db.wallets.length === 0;

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => wallet?.icon ?? 'gpay');
  const [name, setName] = useState(wallet?.name ?? 'Google Pay');
  const [openingBalance, setOpeningBalance] = useState(wallet ? String(wallet.openingBalance) : '0');
  const [isDefault, setIsDefault] = useState<boolean>(isCurrentlyDefault);
  const [error, setError] = useState('');

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = WALLET_PRESETS.find(p => p.id === presetId);
    if (preset) {
      if (!name || WALLET_PRESETS.some(p => p.defaultName === name || p.name === name)) {
        setName(preset.defaultName);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Wallet name is required');
      return;
    }

    const matchedPreset = WALLET_PRESETS.find(p => p.id === selectedPresetId);
    const autoColor = matchedPreset?.color || wallet?.color || '#4285F4';

    const payload = {
      name: name.trim(),
      openingBalance: Number(openingBalance) || 0,
      color: autoColor,
      icon: selectedPresetId,
      isDefault,
    };

    if (wallet) {
      updateWallet(wallet.id, payload);
      showToast('Wallet updated');
    } else {
      addWallet(payload);
      showToast('Wallet created');
    }
    onClose();
  };

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ zIndex: 100050 }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: 440 }}>
        {/* Drag Handle for Mobile */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        {/* Themed Modal Header matching Transfer & Expense Drawers */}
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
              <WalletIcon size={18} />
            </div>
            <div>
              <span className="modal-title" style={{ fontSize: 16 }}>
                {wallet ? 'Edit Wallet' : 'New Wallet'}
              </span>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                {wallet ? 'Update wallet details and balance' : 'Add a new payment account or wallet'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '8px 20px 18px', gap: 12, display: 'flex', flexDirection: 'column' }}>
            {/* 1. OPENING BALANCE (AT TOP) */}
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
                OPENING BALANCE *
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
                  step="0.01"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(e.target.value)}
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
                    width: `${Math.max(1, (openingBalance || '0').length) * 16 + 6}px`,
                    maxWidth: '180px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* 2. WALLET NAME (LEFT-ALIGNED) */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  color: 'var(--text-3)',
                  marginBottom: 5,
                  textAlign: 'left',
                }}
              >
                Wallet Name *
              </label>
              <input
                className="form-input"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Google Pay, HDFC Bank..."
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 500,
                  textAlign: 'left',
                  padding: '0 12px',
                  border: error ? '1.5px solid var(--debit, #ef4444)' : '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
              {error && (
                <span
                  style={{
                    color: 'var(--debit, #ef4444)',
                    fontSize: 11,
                    marginTop: 3,
                    display: 'block',
                    textAlign: 'left',
                  }}
                >
                  {error}
                </span>
              )}
            </div>

            {/* 3. ACCOUNT / UPI TYPE SELECTION */}
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  color: 'var(--text-3)',
                  marginBottom: 6,
                  textAlign: 'left',
                }}
              >
                Select Account Type
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 6,
                }}
              >
                {WALLET_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        padding: '8px 4px 6px',
                        borderRadius: 10,
                        border: isSelected
                          ? '1.5px solid var(--accent)'
                          : '1px solid var(--border)',
                        background: isSelected
                          ? 'var(--accent-soft)'
                          : 'var(--surface2)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {renderWalletIcon(preset.iconKey, 28, preset.color)}
                      </div>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                        }}
                      >
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. SET AS DEFAULT WALLET TOGGLE */}
            <div
              onClick={() => setIsDefault(!isDefault)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 14px',
                borderRadius: 12,
                background: isDefault ? 'var(--accent-soft)' : 'var(--surface2)',
                border: isDefault ? '1px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                userSelect: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: isDefault ? 'var(--accent)' : 'var(--surface3)',
                    color: isDefault ? 'var(--accent-contrast, #ffffff)' : 'var(--text-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                    boxShadow: isDefault ? '0 2px 6px rgba(0,0,0,0.12)' : 'none',
                  }}
                >
                  <CheckCircle2 size={18} strokeWidth={isDefault ? 2.4 : 1.8} style={{ color: 'inherit' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 650,
                      color: 'var(--text)',
                      lineHeight: 1.25,
                    }}
                  >
                    Set as Default Wallet
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.25 }}>
                    Auto-selected for new transactions and settlements
                  </div>
                </div>
              </div>

              {/* Modern Toggle Switch */}
              <div
                style={{
                  width: 42,
                  height: 24,
                  borderRadius: 99,
                  background: isDefault ? 'var(--accent)' : 'var(--surface3)',
                  border: isDefault ? '1px solid var(--accent)' : '1px solid var(--border)',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background-color 0.2s ease, border-color 0.2s ease',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: isDefault ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2, #a1a1aa)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28)',
                    transform: isDefault ? 'translateX(18px)' : 'translateX(0px)',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease',
                  }}
                />
              </div>
            </div>

            {/* 5. ACTION BUTTONS: Cancel on Left, Confirm/Add on Right */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 4,
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
                style={{
                  flex: 1.2,
                  height: 36,
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: 'var(--accent)',
                  color: 'var(--accent-contrast, #ffffff)',
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
                {wallet ? <Check size={14} /> : <Plus size={14} />}
                <span>{wallet ? 'Save Changes' : 'Add Wallet'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
