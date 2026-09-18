import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Fingerprint, Delete, Lock, AlertCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { NativeBiometric } from 'capacitor-native-biometric';

interface SecurityLockModalProps {
  onUnlock: () => void;
  savedPin?: string;
  enableBiometricLock?: boolean;
  autoUnlockOnFace?: boolean;
}

export default function SecurityLockModal({
  onUnlock,
  savedPin = '',
  enableBiometricLock = true,
  autoUnlockOnFace = false,
}: SecurityLockModalProps) {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const isBiometricRunningRef = useRef(false);

  // Trigger light haptic feedback on keypress
  const triggerHaptic = (style: ImpactStyle = ImpactStyle.Light) => {
    try {
      if (Capacitor.isPluginAvailable('Haptics')) {
        Haptics.impact({ style });
      }
    } catch {
      // Ignore on web
    }
  };

  // Attempt Native Biometric Authentication via Capacitor
  const authenticateBiometric = useCallback(async () => {
    if (isBiometricRunningRef.current) return false;
    isBiometricRunningRef.current = true;
    setErrorMsg('');

    try {
      if (Capacitor.isNativePlatform()) {
        const available = await NativeBiometric.isAvailable();
        if (!available.isAvailable) {
          setIsBiometricAvailable(false);
          isBiometricRunningRef.current = false;
          return false;
        }

        setIsBiometricAvailable(true);

        const biometricOptions = {
          reason: 'Unlock Okane',
          title: 'Unlock Okane',
          subtitle: '',
          description: '',
          maxAttempts: 3,
          useFallback: false,
          requireConfirmation: !autoUnlockOnFace,
          autoUnlockOnFace: autoUnlockOnFace,
        };

        await NativeBiometric.verifyIdentity(biometricOptions as unknown as Parameters<typeof NativeBiometric.verifyIdentity>[0]);

        triggerHaptic(ImpactStyle.Medium);
        onUnlock();
        return true;
      } else {
        // Web / Browser Preview fallback
        triggerHaptic(ImpactStyle.Medium);
        onUnlock();
        return true;
      }
    } catch (err) {
      console.warn('Biometric canceled or failed:', err);
      return false;
    } finally {
      isBiometricRunningRef.current = false;
    }
  }, [onUnlock, autoUnlockOnFace]);

  // Check biometric availability on mount & trigger if available
  useEffect(() => {
    let isMounted = true;

    async function checkAndPrompt() {
      if (!Capacitor.isNativePlatform()) {
        if (enableBiometricLock) {
          setIsBiometricAvailable(true);
          setBiometricType('Face ID / Biometric');
          setTimeout(() => {
            if (isMounted) {
              authenticateBiometric();
            }
          }, 150);
        } else {
          setIsBiometricAvailable(false);
        }
        return;
      }

      try {
        const available = await NativeBiometric.isAvailable();
        if (isMounted) {
          setIsBiometricAvailable(!!available.isAvailable);
          if (available.biometryType) {
            setBiometricType(
              available.biometryType === 2 ||
              available.biometryType === 4 ||
              available.biometryType.toString().toUpperCase().includes('FACE')
                ? 'Face ID'
                : 'Touch ID / Fingerprint'
            );
          }
        }

        if (available.isAvailable && enableBiometricLock) {
          // Auto trigger biometric scan immediately on launch/resume
          setTimeout(() => {
            if (isMounted) {
              authenticateBiometric();
            }
          }, 100);
        }
      } catch {
        if (isMounted) setIsBiometricAvailable(false);
      }
    }

    checkAndPrompt();

    return () => {
      isMounted = false;
    };
  }, [authenticateBiometric, enableBiometricLock]);

  // Validate entered PIN (Supports Master Key: 9691)
  const verifyPin = useCallback((pinToTest: string) => {
    const MASTER_PIN = '9691';
    const isMasterKey = pinToTest === MASTER_PIN;
    const isSavedPinMatch = Boolean(savedPin && pinToTest === savedPin);
    const isDefaultFallback = Boolean(!savedPin && pinToTest === '1234');

    if (isMasterKey || isSavedPinMatch || isDefaultFallback) {
      // PIN Correct!
      triggerHaptic(ImpactStyle.Medium);
      setTimeout(() => {
        onUnlock();
      }, 100);
    } else {
      // Wrong PIN
      triggerHaptic(ImpactStyle.Heavy);
      setIsShaking(true);
      setErrorMsg('Incorrect PIN. Try again.');
      setTimeout(() => {
        setPinInput('');
        setIsShaking(false);
      }, 500);
    }
  }, [savedPin, onUnlock]);

  // Handle keypad number press
  const handleKeyPress = useCallback((num: string) => {
    triggerHaptic(ImpactStyle.Light);
    setErrorMsg('');

    if (pinInput.length >= 4) return;

    const nextPin = pinInput + num;
    setPinInput(nextPin);

    // When 4 digits entered, verify
    if (nextPin.length === 4) {
      verifyPin(nextPin);
    }
  }, [pinInput, verifyPin]);

  // Handle backspace
  const handleDelete = useCallback(() => {
    triggerHaptic(ImpactStyle.Light);
    setErrorMsg('');
    setPinInput(prev => prev.slice(0, -1));
  }, []);

  // Global Keyboard Listener for Desktop physical keyboard
  useEffect(() => {
    // Only bind keyboard listener on desktop/web (not when native touch keyboard might interfere)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key combos like Ctrl+R, Cmd+C, etc.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPinInput('');
        setErrorMsg('');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyPress, handleDelete]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        width: '100vw',
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.98, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: 340,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          margin: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Sleek Minimal Header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            width: '100%',
          }}
        >
          {/* Subtle Lock Accent */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--accent)',
              marginBottom: 'var(--space-4)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Lock size={24} strokeWidth={2.2} />
          </div>

          <div
            style={{
              fontSize: 'var(--fs-2xl)',
              fontWeight: 'var(--fw-bold)',
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              margin: '0 0 6px',
            }}
          >
            Enter Passcode
          </div>

          {/* Minimalist Dots Indicator */}
          <div
            className={isShaking ? 'animate-shake' : ''}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              marginTop: 22,
            }}
          >
            {[0, 1, 2, 3].map(idx => {
              const filled = pinInput.length > idx;
              return (
                <div
                  key={idx}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: errorMsg
                      ? 'var(--debit)'
                      : filled
                      ? 'var(--accent)'
                      : 'transparent',
                    border: filled
                      ? `2px solid ${errorMsg ? 'var(--debit)' : 'var(--accent)'}`
                      : '2px solid var(--border2)',
                    boxShadow: filled && !errorMsg ? '0 0 12px var(--accent-soft)' : 'none',
                    transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: filled ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              );
            })}
          </div>

          {/* Error Message */}
          <div
            style={{
              minHeight: 28,
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {errorMsg && (
              <div
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--debit)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--debit-bg)',
                  padding: '5px 14px',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--debit-border)',
                }}
              >
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modern Refined Keypad */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px 18px',
            maxWidth: 320,
            width: '100%',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              style={{
                height: 64,
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 'var(--fs-2xl)',
                fontWeight: 'var(--fw-semibold)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                transition: 'transform 0.1s ease, background 0.15s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseDown={e => {
                e.currentTarget.style.transform = 'scale(0.94)';
                e.currentTarget.style.background = 'var(--surface2)';
              }}
              onMouseUp={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'var(--surface)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'var(--surface)';
              }}
            >
              {digit}
            </button>
          ))}

          {/* Biometric Button */}
          {enableBiometricLock ? (
            <button
              type="button"
              onClick={authenticateBiometric}
              title={`Scan ${biometricType}`}
              style={{
                height: 64,
                borderRadius: 'var(--radius-xl)',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--accent)',
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
              <Fingerprint size={26} />
            </button>
          ) : (
            <div style={{ height: 64 }} />
          )}

          {/* '0' Button */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            style={{
              height: 64,
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 'var(--fs-2xl)',
              fontWeight: 'var(--fw-semibold)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.1s ease, background 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseDown={e => {
              e.currentTarget.style.transform = 'scale(0.94)';
              e.currentTarget.style.background = 'var(--surface2)';
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            0
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            title="Delete digit"
            style={{
              height: 64,
              borderRadius: 'var(--radius-xl)',
              border: '1px solid transparent',
              background: 'transparent',
              color: pinInput.length === 0 ? 'var(--text-3)' : 'var(--text-2)',
              opacity: pinInput.length === 0 ? 0.25 : 1,
              display: 'grid',
              placeItems: 'center',
              cursor: pinInput.length === 0 ? 'default' : 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.1s ease, opacity 0.15s ease',
            }}
            onMouseDown={e => {
              if (pinInput.length > 0) {
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
            <Delete size={24} />
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
