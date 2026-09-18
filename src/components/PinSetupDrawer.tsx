import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, Delete, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

interface PinSetupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePin: (newPin: string) => void;
  hasExistingPin?: boolean;
  currentPin?: string;
}

const MASTER_PIN = '9691';

export default function PinSetupDrawer({
  isOpen,
  onClose,
  onSavePin,
  hasExistingPin = false,
  currentPin = '',
}: PinSetupDrawerProps) {
  const initialStep = hasExistingPin ? 'verify_old' : 'enter';
  const [step, setStep] = useState<'verify_old' | 'enter' | 'confirm'>(initialStep);
  const [oldPin, setOldPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const handleClose = useCallback(() => {
    setStep(hasExistingPin ? 'verify_old' : 'enter');
    setOldPin('');
    setFirstPin('');
    setConfirmPin('');
    setErrorMsg('');
    setIsShaking(false);
    onClose();
  }, [hasExistingPin, onClose]);

  useBackButtonModal(isOpen, handleClose, { priority: BackPriority.DRAWER });

  const triggerHaptic = useCallback((style: ImpactStyle = ImpactStyle.Light) => {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style }).catch(() => {});
    }
  }, []);

  const triggerNotificationHaptic = useCallback((type: NotificationType) => {
    if (Capacitor.isNativePlatform()) {
      Haptics.notification({ type }).catch(() => {});
    }
  }, []);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    triggerNotificationHaptic(NotificationType.Error);
    setTimeout(() => setIsShaking(false), 400);
  }, [triggerNotificationHaptic]);

  const currentInput =
    step === 'verify_old' ? oldPin : step === 'enter' ? firstPin : confirmPin;

  const handleDigitPress = useCallback(
    (digit: string) => {
      triggerHaptic(ImpactStyle.Light);
      setErrorMsg('');

      if (step === 'verify_old') {
        if (oldPin.length < 4) {
          const nextVal = oldPin + digit;
          setOldPin(nextVal);
          if (nextVal.length === 4) {
            // Verify against currentPin OR Master Passcode '9691'
            if (nextVal === MASTER_PIN || (currentPin && nextVal === currentPin) || (!currentPin && nextVal === '1234')) {
              triggerNotificationHaptic(NotificationType.Success);
              setTimeout(() => {
                setStep('enter');
                triggerHaptic(ImpactStyle.Medium);
              }, 180);
            } else {
              triggerShake();
              setErrorMsg('Incorrect current passcode. Please try again.');
              setTimeout(() => {
                setOldPin('');
              }, 300);
            }
          }
        }
      } else if (step === 'enter') {
        if (firstPin.length < 4) {
          const nextVal = firstPin + digit;
          setFirstPin(nextVal);
          if (nextVal.length === 4) {
            // Advance to confirmation step
            setTimeout(() => {
              setStep('confirm');
              triggerHaptic(ImpactStyle.Medium);
            }, 180);
          }
        }
      } else {
        if (confirmPin.length < 4) {
          const nextVal = confirmPin + digit;
          setConfirmPin(nextVal);
          if (nextVal.length === 4) {
            // Check match with newly entered PIN
            if (nextVal === firstPin) {
              triggerNotificationHaptic(NotificationType.Success);
              setTimeout(() => {
                onSavePin(nextVal);
                handleClose();
              }, 200);
            } else {
              triggerShake();
              setErrorMsg('PINs do not match. Please try again.');
              setTimeout(() => {
                setConfirmPin('');
              }, 300);
            }
          }
        }
      }
    },
    [step, oldPin, firstPin, confirmPin, currentPin, triggerHaptic, triggerNotificationHaptic, triggerShake, onSavePin, handleClose]
  );

  const handleBackspace = useCallback(() => {
    triggerHaptic(ImpactStyle.Light);
    setErrorMsg('');
    if (step === 'verify_old') {
      setOldPin(prev => prev.slice(0, -1));
    } else if (step === 'enter') {
      setFirstPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  }, [step, triggerHaptic]);

  const handleReset = useCallback(() => {
    triggerHaptic(ImpactStyle.Medium);
    setStep(hasExistingPin ? 'verify_old' : 'enter');
    setOldPin('');
    setFirstPin('');
    setConfirmPin('');
    setErrorMsg('');
  }, [hasExistingPin, triggerHaptic]);

  // Handle Physical / Desktop Keyboard Typing
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigitPress, handleBackspace, handleClose]);

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
            onClick={handleClose}
          />

          {/* Sheet panel / Desktop center dialog */}
          <motion.div
            initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
            animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="sheet-modal modal-dialog-panel"
            style={{ maxWidth: 400, margin: '0 auto' }}
          >
            {/* Drag Handle */}
            <div className="sheet-drag-handle" />

            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className="drawer-header-icon">
                  <KeyRound size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', margin: 0, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                    {hasExistingPin ? 'Change Security Passcode' : 'Create Security Passcode'}
                  </h3>
                  <p className="drawer-header-sub">
                    {hasExistingPin
                      ? step === 'verify_old'
                        ? 'Step 1 of 3: Verify Current Passcode'
                        : step === 'enter'
                        ? 'Step 2 of 3: Set New Passcode'
                        : 'Step 3 of 3: Confirm New Passcode'
                      : step === 'enter'
                      ? 'Step 1 of 2: Set Passcode'
                      : 'Step 2 of 2: Confirm Passcode'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="drawer-close-btn"
                onClick={handleClose}
                title="Close"
              >
                <X size={17} />
              </button>
            </div>

        {/* Step Indicator Progress Bar Pills */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          {hasExistingPin ? (
            <>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--accent)',
                  transition: 'all 0.3s ease',
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 'var(--radius-xs)',
                  background: step === 'enter' || step === 'confirm' ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.3s ease',
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 'var(--radius-xs)',
                  background: step === 'confirm' ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.3s ease',
                }}
              />
            </>
          ) : (
            <>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--accent)',
                  transition: 'all 0.3s ease',
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 'var(--radius-xs)',
                  background: step === 'confirm' ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.3s ease',
                }}
              />
            </>
          )}
        </div>

        {/* Instruction Message */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', marginBottom: 'var(--space-1)' }}>
            {step === 'verify_old'
              ? 'Enter your current 4-digit PIN'
              : step === 'enter'
              ? 'Enter a new 4-digit PIN'
              : 'Re-enter your PIN to confirm'}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
            {step === 'verify_old'
              ? 'Verify your identity to set a new passcode'
              : step === 'enter'
              ? 'This passcode will be required to unlock Okane'
              : 'Type the exact same 4 digits again'}
          </div>

          {/* Animated PIN Dots */}
          <div
            className={isShaking ? 'animate-shake' : ''}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
              marginTop: 22,
            }}
          >
            {[0, 1, 2, 3].map(index => {
              const isFilled = index < currentInput.length;
              return (
                <div
                  key={index}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: errorMsg
                      ? 'var(--debit)'
                      : isFilled
                      ? 'var(--accent)'
                      : 'transparent',
                    border: isFilled
                      ? `2px solid ${errorMsg ? 'var(--debit)' : 'var(--accent)'}`
                      : '2px solid var(--border-strong, var(--border))',
                    transform: isFilled ? 'scale(1.2)' : 'scale(1)',
                    boxShadow: isFilled && !errorMsg ? '0 0 10px var(--accent-soft)' : 'none',
                    transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                />
              );
            })}
          </div>

          {/* Error Message */}
          <div style={{ minHeight: 28, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {errorMsg ? (
              <div
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 'var(--fw-medium)',
                  color: 'var(--debit)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--debit-bg)',
                  border: '1px solid var(--debit-border)',
                  padding: '4px 14px',
                  borderRadius: 'var(--radius-xl)',
                }}
              >
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            ) : step !== (hasExistingPin ? 'verify_old' : 'enter') ? (
              <button
                type="button"
                onClick={handleReset}
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--accent)',
                  background: 'transparent',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  padding: '2px 8px',
                }}
              >
                <RefreshCw size={13} />
                <span>Start Over</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Numpad Keypad */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px 18px',
            width: '100%',
            maxWidth: 320,
            margin: '0 auto 8px',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              style={{
                height: 58,
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                fontSize: 'var(--fs-xl)',
                fontWeight: 'var(--fw-medium)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                transition: 'transform 0.1s ease, background 0.15s ease',
              }}
              onMouseDown={e => {
                e.currentTarget.style.transform = 'scale(0.94)';
                e.currentTarget.style.background = 'var(--surface3)';
              }}
              onMouseUp={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'var(--surface2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'var(--surface2)';
              }}
            >
              {digit}
            </button>
          ))}

          {/* Reset / Start Over Key */}
          <button
            type="button"
            onClick={handleReset}
            title="Reset"
            style={{
              height: 58,
              borderRadius: 'var(--radius-xl)',
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--text-3)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 'var(--fw-semibold)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.1s ease',
            }}
            onMouseDown={e => {
              e.currentTarget.style.transform = 'scale(0.9)';
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <RefreshCw size={18} />
          </button>

          {/* '0' Key */}
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            style={{
              height: 58,
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              fontSize: 'var(--fs-xl)',
              fontWeight: 'var(--fw-medium)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.1s ease, background 0.15s ease',
            }}
            onMouseDown={e => {
              e.currentTarget.style.transform = 'scale(0.94)';
              e.currentTarget.style.background = 'var(--surface3)';
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'var(--surface2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'var(--surface2)';
            }}
          >
            0
          </button>

          {/* Delete / Backspace Key */}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={currentInput.length === 0}
            title="Delete"
            style={{
              height: 58,
              borderRadius: 'var(--radius-xl)',
              border: '1px solid transparent',
              background: 'transparent',
              color: currentInput.length === 0 ? 'var(--text-3)' : 'var(--text-2)',
              opacity: currentInput.length === 0 ? 0.2 : 1,
              display: 'grid',
              placeItems: 'center',
              cursor: currentInput.length === 0 ? 'default' : 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.1s ease, opacity 0.15s ease',
            }}
            onMouseDown={e => {
              if (currentInput.length > 0) {
                e.currentTarget.style.transform = 'scale(0.9)';
              }
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Delete size={22} strokeWidth={1.8} />
          </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>,
document.body
  );
}
