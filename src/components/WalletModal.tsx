import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Wallet as WalletIcon, Plus, Check, CheckCircle2, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import type { Wallet } from '../types';
import { WALLET_PRESETS, renderWalletIcon, detectWalletPresetFromName } from './WalletIconRenderer';
import { currencySymbol } from '../utils';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';
import { showSoftKeyboard } from '../utils/keyboard';

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

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    if (wallet?.icon && wallet.icon !== 'wallet') return wallet.icon;
    if (wallet?.name) {
      const detected = detectWalletPresetFromName(wallet.name);
      if (detected) return detected;
    }
    return wallet?.icon ?? 'gpay';
  });
  const [name, setName] = useState(wallet?.name ?? 'Google Pay');
  const [openingBalance, setOpeningBalance] = useState(wallet ? String(wallet.openingBalance) : '0');
  const [isDefault, setIsDefault] = useState<boolean>(isCurrentlyDefault);
  const [error, setError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus wallet name input on modal mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nameInputRef.current) {
        showSoftKeyboard(nameInputRef.current, { placeCursorAtEnd: true, scroll: true });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    if (error) setError('');
    const detected = detectWalletPresetFromName(val);
    if (detected) {
      setSelectedPresetId(detected);
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = WALLET_PRESETS.find(p => p.id === presetId);
    if (preset) {
      if (!name || WALLET_PRESETS.some(p => p.defaultName.toLowerCase() === name.trim().toLowerCase() || p.name.toLowerCase() === name.trim().toLowerCase())) {
        setName(preset.defaultName);
      }
    }
  };

  const handleClear = () => {
    setOpeningBalance('0');
    setSelectedPresetId('gpay');
    const defaultPreset = WALLET_PRESETS.find(p => p.id === 'gpay');
    setName(defaultPreset ? defaultPreset.defaultName : 'Google Pay');
    setIsDefault(false);
    setError('');
    if (nameInputRef.current) {
      nameInputRef.current.focus();
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

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        className="modal wallet-drawer-modal modal-dialog-panel"
        onClick={e => e.stopPropagation()}
      >
        {/* Top drag handle pill */}
        <div className="modal-drag-handle" />

        {/* Themed Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
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
              <WalletIcon size={19} strokeWidth={2.2} />
            </div>
            <div>
              <span className="modal-title" style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>
                {wallet ? 'Edit Wallet' : 'New Wallet'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '8px 20px 18px', gap: 'var(--space-3)', display: 'flex', flexDirection: 'column' }}>
            {/* 1. OPENING BALANCE (AT TOP) */}
            <div
              className="hero-amount-card"
              style={{
                background: 'var(--surface2)',
                borderRadius: 'var(--radius-lg)',
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
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 'var(--fw-bold)',
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
                    fontSize: 'var(--fs-hero-sm)',
                    fontWeight: 'var(--fw-bold)',
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
                    fontSize: 'var(--fs-hero-sm)',
                    fontWeight: 'var(--fw-bold)',
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
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 'var(--fw-bold)',
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
                ref={nameInputRef}
                className="form-input"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. Google Pay, HDFC Bank..."
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--fs-base)',
                  fontWeight: 'var(--fw-medium)',
                  textAlign: 'left',
                  padding: '0 12px',
                  border: error ? '1.5px solid var(--debit)' : '1px solid var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
              {error && (
                <span
                  style={{
                    color: 'var(--debit)',
                    fontSize: 'var(--fs-caption)',
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
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 'var(--fw-bold)',
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
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: isSelected
                          ? 'var(--surface3)'
                          : 'var(--surface2)',
                        boxShadow: isSelected
                          ? 'var(--shadow-sm)'
                          : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative',
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
                          transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                          transition: 'transform 0.15s ease',
                        }}
                      >
                        {renderWalletIcon(preset.iconKey, 28, preset.color)}
                      </div>
                      <span
                        style={{
                          fontSize: 'var(--fs-caption)',
                          fontWeight: isSelected ? 'var(--fw-bold)' : 'var(--fw-medium)',
                          color: isSelected ? 'var(--text)' : 'var(--text-2)',
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
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                userSelect: 'none',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    background: 'transparent',
                    color: isDefault ? 'var(--text)' : 'var(--text-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle2 size={20} strokeWidth={isDefault ? 2.2 : 1.7} style={{ color: 'inherit' }} />
                </div>
                <div
                  style={{
                    fontSize: 'var(--fs-base)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text)',
                    lineHeight: 1.2,
                  }}
                >
                  Set as Default Wallet
                </div>
              </div>

              {/* Modern Toggle Switch */}
              <div
                style={{
                  width: 42,
                  height: 24,
                  borderRadius: 'var(--radius-full)',
                  background: isDefault ? 'var(--text)' : 'var(--surface3)',
                  border: isDefault ? '1px solid var(--text)' : '1px solid var(--border)',
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
                    background: isDefault ? 'var(--surface)' : 'var(--text-2)',
                    boxShadow: 'var(--shadow-sm)',
                    transform: isDefault ? 'translateX(18px)' : 'translateX(0px)',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease',
                  }}
                />
              </div>
            </div>

            {/* 5. ACTION BUTTONS: Clear on Left, Confirm/Add on Right */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                justifyContent: 'flex-end',
                marginTop: 6,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClear}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 'var(--fw-semibold)',
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
                style={{
                  flex: 1.35,
                  height: 40,
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 'var(--fw-bold)',
                  background: 'var(--text)',
                  border: '1px solid var(--text)',
                  color: 'var(--bg)',
                  boxShadow: 'var(--shadow-sm)',
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
                {wallet ? <Check size={15} style={{ color: 'inherit' }} /> : <Plus size={15} style={{ color: 'inherit' }} />}
                <span>{wallet ? 'Save Changes' : 'Add Wallet'}</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
