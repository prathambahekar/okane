import { useState, useEffect, useCallback, useRef } from 'react';
import { Fingerprint, Delete, Lock, AlertCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { NativeBiometric } from 'capacitor-native-biometric';

interface SecurityLockModalProps {
  onUnlock: () => void;
  savedPin?: string;
  enableBiometricLock?: boolean;
}

export default function SecurityLockModal({
  onUnlock,
  savedPin = '',
  enableBiometricLock = true,
}: SecurityLockModalProps) {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [_isBiometricAvailable, setIsBiometricAvailable] = useState(false);
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
      if (!Capacitor.isNativePlatform()) {
        console.log('Biometric prompt skipped on non-native platform');
        isBiometricRunningRef.current = false;
        return false;
      }

      const available = await NativeBiometric.isAvailable();
      if (!available.isAvailable) {
        setIsBiometricAvailable(false);
        isBiometricRunningRef.current = false;
        return false;
      }

      setIsBiometricAvailable(true);

      await NativeBiometric.verifyIdentity({
        reason: 'Unlock Okane',
        title: 'Okane Security',
        subtitle: 'Biometric Authentication',
        description: 'Scan your fingerprint or face to unlock',
      });

      triggerHaptic(ImpactStyle.Medium);
      onUnlock();
      return true;
    } catch (err) {
      console.warn('Native biometric canceled or failed:', err);
      return false;
    } finally {
      setTimeout(() => {
        isBiometricRunningRef.current = false;
      }, 600);
    }
  }, [onUnlock]);

  // Check biometric availability on mount & trigger if available
  useEffect(() => {
    let isMounted = true;

    async function checkAndPrompt() {
      if (!Capacitor.isNativePlatform()) {
        setIsBiometricAvailable(false);
        return;
      }

      try {
        const available = await NativeBiometric.isAvailable();
        if (isMounted) {
          setIsBiometricAvailable(!!available.isAvailable);
          if (available.biometryType) {
            setBiometricType(
              available.biometryType.toString().toUpperCase().includes('FACE')
                ? 'Face ID'
                : 'Touch ID / Fingerprint'
            );
          }
        }

        if (available.isAvailable && enableBiometricLock) {
          // Auto trigger biometric scan on launch with safe mount delay
          setTimeout(() => {
            if (isMounted) {
              authenticateBiometric();
            }
          }, 350);
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

  return (
    <div
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
        padding: 'calc(env(safe-area-inset-top, 24px) + 16px) 24px calc(env(safe-area-inset-bottom, 24px) + 24px)',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        gap: 'clamp(24px, 5vh, 44px)',
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
          maxWidth: 320,
        }}
      >
        {/* Subtle Lock Accent */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            background: 'var(--surface2)',
            border: '1px solid var(--border-soft, var(--border))',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--accent)',
            marginBottom: 16,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Lock size={22} strokeWidth={2.2} />
        </div>

        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            margin: '0 0 4px',
          }}
        >
          Enter Passcode
        </div>

        {/* Minimalist Dots Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            marginTop: 24,
            transform: isShaking ? 'translateX(-8px)' : 'none',
            transition: isShaking ? 'transform 0.08s ease' : 'transform 0.2s ease',
          }}
        >
          {[0, 1, 2, 3].map(idx => {
            const filled = pinInput.length > idx;
            return (
              <div
                key={idx}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: errorMsg
                    ? 'var(--debit)'
                    : filled
                    ? 'var(--accent)'
                    : 'transparent',
                  border: filled
                    ? `2px solid ${errorMsg ? 'var(--debit)' : 'var(--accent)'}`
                    : '2px solid var(--border-strong, var(--border))',
                  boxShadow: filled && !errorMsg ? '0 0 10px var(--accent-soft)' : 'none',
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
            minHeight: 24,
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {errorMsg && (
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: 'var(--debit)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--danger-soft, rgba(239, 68, 68, 0.12))',
                padding: '4px 12px',
                borderRadius: 20,
              }}
            >
              <AlertCircle size={14} />
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
          gap: '14px 20px',
          maxWidth: 290,
          width: '100%',
        }}
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
          <button
            key={digit}
            type="button"
            onClick={() => handleKeyPress(digit)}
            style={{
              height: 62,
              borderRadius: 22,
              border: '1px solid var(--border-soft, var(--border))',
              background: 'var(--surface2)',
              color: 'var(--text)',
              fontSize: 22,
              fontWeight: 500,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.1s ease, background 0.15s ease',
            }}
            onMouseDown={e => {
              e.currentTarget.style.transform = 'scale(0.94)';
              e.currentTarget.style.background = 'var(--surface3, var(--border))';
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

        {/* Biometric Button */}
        {enableBiometricLock ? (
          <button
            type="button"
            onClick={authenticateBiometric}
            title={`Scan ${biometricType}`}
            style={{
              height: 62,
              borderRadius: 22,
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
            <Fingerprint size={24} />
          </button>
        ) : (
          <div style={{ height: 62 }} />
        )}

        {/* '0' Button */}
        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          style={{
            height: 62,
            borderRadius: 22,
            border: '1px solid var(--border-soft, var(--border))',
            background: 'var(--surface2)',
            color: 'var(--text)',
            fontSize: 22,
            fontWeight: 500,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.1s ease, background 0.15s ease',
          }}
          onMouseDown={e => {
            e.currentTarget.style.transform = 'scale(0.94)';
            e.currentTarget.style.background = 'var(--surface3, var(--border))';
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

        {/* Delete Button */}
        <button
          type="button"
          onClick={handleDelete}
          title="Delete digit"
          style={{
            height: 62,
            borderRadius: 22,
            border: '1px solid transparent',
            background: 'transparent',
            color: pinInput.length === 0 ? 'var(--text-3)' : 'var(--text-2)',
            opacity: pinInput.length === 0 ? 0.2 : 1,
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
          <Delete size={22} />
        </button>
      </div>
    </div>
  );
}
