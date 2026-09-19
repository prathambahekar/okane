import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowRight,
  Search,
  X,
  Sun,
  Moon,
  EyeOff,
  Eye,
  Wallet as WalletIcon,
  ShieldCheck,
  Plus,
  Sparkles,
  RefreshCw,
  Plane,
  Lock,
  KeyRound,
  Delete,
} from 'lucide-react';
import { useStore } from '../store';
import { CURRENCIES, type CurrencyInfo } from '../db';
import { currencySymbol, fmtMoney } from '../utils';
import { useColorMode } from '../theme';
import { renderWalletIcon } from './WalletIconRenderer';

export interface IntroCarouselProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAction?: (action?: 'dashboard' | 'add-expense') => void;
}

const POPULAR_CURRENCIES: Array<{ code: string; symbol: string; name: string }> = [
  { code: 'INR', symbol: '₹', name: 'Rupee' },
  { code: 'USD', symbol: '$', name: 'Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'Dirham' },
  { code: 'CAD', symbol: 'C$', name: 'CAD' },
  { code: 'AUD', symbol: 'A$', name: 'AUD' },
  { code: 'JPY', symbol: '¥', name: 'Yen' },
  { code: 'SGD', symbol: 'S$', name: 'SGD' },
];

export const IntroCarousel: React.FC<IntroCarouselProps> = ({
  isOpen,
  onClose,
  onStartAction,
}) => {
  const { db, updateSettings, updateWallet } = useStore();
  const { mode, setMode } = useColorMode();

  const [step, setStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  // Available wallets in DB
  const availableWallets = useMemo(() => {
    return db.wallets && db.wallets.length > 0 ? db.wallets : [
      { id: 'wal_cash', name: 'Cash', openingBalance: 0, color: '#FBBF24', icon: 'cash' },
      { id: 'wal_upi', name: 'UPI', openingBalance: 0, color: '#34D399', icon: 'card' },
    ];
  }, [db.wallets]);

  // Setup State
  const [selectedCurrency, setSelectedCurrency] = useState(() => db.settings?.currency || 'INR');
  const [showAllCurrencies, setShowAllCurrencies] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  // Wallets
  const [selectedWalletId, setSelectedWalletId] = useState<string>(() => availableWallets[0]?.id || 'wal_cash');
  const [walletBalances, setWalletBalances] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    availableWallets.forEach((w) => {
      map[w.id] = (w.openingBalance && w.openingBalance > 0) ? String(w.openingBalance) : '';
    });
    return map;
  });

  // Privacy & Appearance
  const [privacyMask, setPrivacyMask] = useState(() => Boolean(db.settings?.hideAmounts));

  // Passcode Lock
  const [enablePasscode, setEnablePasscode] = useState(() => Boolean(db.settings?.enableSecurityLock));
  const [passcodePin, setPasscodePin] = useState(() => db.settings?.securityPin || '');
  const [pinDraft, setPinDraft] = useState('');
  const [isEditingPin, setIsEditingPin] = useState(false);

  // Advanced Features
  const [enableAI, setEnableAI] = useState(() => db.settings?.enableAIAssistant ?? true);
  const [enableSubs, setEnableSubs] = useState(() => db.settings?.enableAutopay ?? true);
  const [enableTrips, setEnableTrips] = useState(() => db.settings?.enableSplitTrips ?? true);

  const touchStartXRef = useRef<number | null>(null);

  const totalSteps = 5;
  const sym = currencySymbol(selectedCurrency);

  const handleSelectCurrency = (code: string) => {
    setSelectedCurrency(code);
    updateSettings({ currency: code });
    setShowAllCurrencies(false);
  };

  const handleSetWalletBalance = (walletId: string, val: string) => {
    setWalletBalances(prev => ({ ...prev, [walletId]: val }));
    const num = parseFloat(val) || 0;
    updateWallet(walletId, {
      openingBalance: num,
      currentBalance: num,
    });
  };

  const handleTogglePrivacy = () => {
    const nextVal = !privacyMask;
    setPrivacyMask(nextVal);
    updateSettings({ hideAmounts: nextVal });
    try {
      localStorage.setItem('hide_amounts', String(nextVal));
    } catch {
      // ignore
    }
  };

  const handleThemeChange = (newMode: 'light' | 'dark') => {
    setMode(newMode);
    updateSettings({ colorMode: newMode });
    try {
      localStorage.setItem('color-mode', newMode);
      document.documentElement.setAttribute('data-color-scheme', newMode);
      document.documentElement.setAttribute('data-theme', newMode);
    } catch {
      // ignore
    }
  };

  const handleTogglePasscode = () => {
    const nextVal = !enablePasscode;
    setEnablePasscode(nextVal);
    if (!nextVal) {
      setPasscodePin('');
      setPinDraft('');
      setIsEditingPin(false);
      updateSettings({ enableSecurityLock: false, securityPin: '' });
    } else {
      if (!passcodePin) {
        setIsEditingPin(true);
        setPinDraft('');
      }
    }
  };

  const handlePinKeyClick = (digit: string) => {
    if (pinDraft.length < 4) {
      const next = pinDraft + digit;
      setPinDraft(next);
      if (next.length === 4) {
        setPasscodePin(next);
        setIsEditingPin(false);
        updateSettings({ enableSecurityLock: true, securityPin: next });
      }
    }
  };

  const handlePinBackspace = () => {
    setPinDraft(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPinDraft('');
  };

  const handleComplete = useCallback((action?: 'dashboard' | 'add-expense') => {
    // Sync all wallet balances to database
    availableWallets.forEach(w => {
      const num = parseFloat(walletBalances[w.id] || '0') || 0;
      updateWallet(w.id, {
        openingBalance: num,
        currentBalance: num,
      });
    });

    try {
      localStorage.setItem('okane_onboarding_completed', 'true');
    } catch {
      // ignore
    }

    const isPinActive = Boolean(enablePasscode && passcodePin && passcodePin.length === 4);

    updateSettings({
      hasCompletedOnboarding: true,
      currency: selectedCurrency,
      hideAmounts: privacyMask,
      colorMode: mode,
      enableSecurityLock: isPinActive,
      securityPin: isPinActive ? passcodePin : '',
      enableAIAssistant: enableAI,
      enableAutopay: enableSubs,
      enableSplitTrips: enableTrips,
    });

    onClose();
    if (onStartAction) {
      onStartAction(action || 'dashboard');
    }
  }, [
    availableWallets,
    walletBalances,
    updateWallet,
    updateSettings,
    selectedCurrency,
    privacyMask,
    mode,
    enablePasscode,
    passcodePin,
    enableAI,
    enableSubs,
    enableTrips,
    onClose,
    onStartAction
  ]);

  const handleNext = useCallback(() => {
    setStep(prev => {
      if (prev < totalSteps - 1) {
        setSlideDirection(1);
        return prev + 1;
      } else {
        handleComplete('dashboard');
        return prev;
      }
    });
  }, [totalSteps, handleComplete]);

  const handlePrev = useCallback(() => {
    setStep(prev => {
      if (prev > 0) {
        setSlideDirection(-1);
        return prev - 1;
      }
      return prev;
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAllCurrencies) {
        if (e.key === 'Escape') setShowAllCurrencies(false);
        return;
      }
      if (e.key === 'ArrowRight' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleComplete('dashboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleComplete, showAllCurrencies]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (showAllCurrencies || isEditingPin) return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || showAllCurrencies || isEditingPin) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartXRef.current = null;
  };

  if (!isOpen) return null;

  const isLastStep = step === totalSteps - 1;

  const filteredCurrencies = CURRENCIES.filter((c: CurrencyInfo) =>
    c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.country.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const configuredWallets = availableWallets.filter(w => (parseFloat(walletBalances[w.id] || '0') || 0) > 0);

  return createPortal(
    <div
      className="intro-carousel-fullscreen"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        background: 'var(--bg, #0a0a0c)',
        color: 'var(--text, #ffffff)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* Top Header - Minimal counter and skip button */}
      <header
        style={{
          padding: 'calc(16px + env(safe-area-inset-top, 0px)) 24px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '520px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--text-3, #71717a)',
              textTransform: 'uppercase',
            }}
          >
            Step {step + 1} of {totalSteps}
          </span>
        </div>

        {/* Minimal text Skip button */}
        <button
          type="button"
          onClick={() => handleComplete('dashboard')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-3, #71717a)',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: 'var(--radius-full, 9999px)',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-3, #71717a)';
          }}
        >
          Skip
        </button>
      </header>

      {/* Main Content Area with Clean Transitions */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          maxWidth: '520px',
          width: '100%',
          margin: '0 auto',
          padding: '0 24px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        <AnimatePresence mode="wait" custom={slideDirection}>
          {/* STEP 1: CURRENCY */}
          {step === 0 && (
            <motion.div
              key="step-currency"
              custom={slideDirection}
              initial={{ opacity: 0, x: slideDirection > 0 ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDirection > 0 ? -28 : 28 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              <div>
                <h1
                  style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    color: 'var(--text)',
                    margin: '0 0 8px',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.2,
                  }}
                >
                  Choose your currency
                </h1>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: 'var(--text-2)',
                    margin: 0,
                  }}
                >
                  Select your primary currency. You can change this later in settings.
                </p>
              </div>

              {/* Popular Currencies Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                }}
              >
                {POPULAR_CURRENCIES.map((c) => {
                  const isSelected = selectedCurrency === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelectCurrency(c.code)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: 'var(--radius-lg, 16px)',
                        background: isSelected ? 'var(--text, #ffffff)' : 'var(--surface, #141416)',
                        color: isSelected ? 'var(--bg, #0a0a0c)' : 'var(--text, #ffffff)',
                        border: isSelected ? '1px solid transparent' : '1px solid var(--border, rgba(255,255,255,0.08))',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1.2 }}>
                        {c.symbol}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 650, opacity: isSelected ? 0.9 : 0.7 }}>
                        {c.code}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Show All Currencies Button */}
              <button
                type="button"
                onClick={() => {
                  setCurrencySearch('');
                  setShowAllCurrencies(true);
                }}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-lg, 16px)',
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: '13px',
                  fontWeight: 650,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Search size={14} />
                <span>Search all currencies ({CURRENCIES.length})</span>
              </button>
            </motion.div>
          )}

          {/* STEP 2: OPENING BALANCE & WALLETS */}
          {step === 1 && (
            <motion.div
              key="step-balance"
              custom={slideDirection}
              initial={{ opacity: 0, x: slideDirection > 0 ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDirection > 0 ? -28 : 28 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              <div>
                <h1
                  style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    color: 'var(--text)',
                    margin: '0 0 8px',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.2,
                  }}
                >
                  Opening balance
                </h1>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: 'var(--text-2)',
                    margin: 0,
                  }}
                >
                  Set your starting balance for cash or bank accounts, or start from 0.
                </p>
              </div>

              {/* Big Centered Balance Input Card */}
              <div
                style={{
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl, 24px)',
                  padding: '24px 20px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {/* Horizontal Centered Amount Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '34px',
                      fontWeight: 800,
                      color: 'var(--text-2)',
                      marginRight: 4,
                      lineHeight: 1,
                    }}
                  >
                    {sym}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={walletBalances[selectedWalletId] || ''}
                    onChange={(e) => handleSetWalletBalance(selectedWalletId, e.target.value)}
                    style={{
                      fontSize: '44px',
                      fontWeight: 800,
                      color: 'var(--text)',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      width: '160px',
                      maxWidth: '60%',
                      textAlign: 'left',
                      padding: 0,
                      letterSpacing: '-0.03em',
                      lineHeight: 1,
                    }}
                  />
                </div>

                {/* Target Wallet Selection Chips */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    width: '100%',
                  }}
                >
                  {availableWallets.map((w) => {
                    const isSelected = selectedWalletId === w.id;
                    const val = parseFloat(walletBalances[w.id] || '0') || 0;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWalletId(w.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 'var(--radius-full, 9999px)',
                          background: isSelected ? 'var(--text, #ffffff)' : 'var(--surface2, rgba(255,255,255,0.06))',
                          color: isSelected ? 'var(--bg, #0a0a0c)' : 'var(--text)',
                          border: isSelected ? '1px solid transparent' : '1px solid var(--border)',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {renderWalletIcon(w.icon || w.name, 20, isSelected ? 'var(--bg)' : (w.color || 'var(--text)'))}
                        </div>
                        <span>{w.name}</span>
                        {val > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 750,
                              opacity: isSelected ? 0.9 : 0.7,
                              marginLeft: 2,
                            }}
                          >
                            • {sym}{val}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                {[100, 500, 1000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(walletBalances[selectedWalletId] || '0') || 0;
                      const nextVal = String(cur + amt);
                      handleSetWalletBalance(selectedWalletId, nextVal);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-full, 9999px)',
                      background: 'var(--surface, #141416)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-2)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <Plus size={13} strokeWidth={2.5} />
                    <span>{sym}{amt}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 3: APPEARANCE & SECURITY */}
          {step === 2 && (
            <motion.div
              key="step-theme"
              custom={slideDirection}
              initial={{ opacity: 0, x: slideDirection > 0 ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDirection > 0 ? -28 : 28 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div>
                <h1
                  style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    color: 'var(--text)',
                    margin: '0 0 6px',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.2,
                  }}
                >
                  Appearance & privacy
                </h1>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: 'var(--text-2)',
                    margin: 0,
                  }}
                >
                  Choose your theme and optional passcode protection.
                </p>
              </div>

              {/* Minimal Theme Toggle Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Dark Theme Button */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  style={{
                    padding: '16px 14px',
                    borderRadius: 'var(--radius-xl, 18px)',
                    background: '#121214',
                    color: '#ffffff',
                    border: mode === 'dark' ? '2px solid var(--text, #ffffff)' : '1px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {mode === 'dark' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        background: '#ffffff',
                        color: '#000000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                  <Moon size={22} strokeWidth={2.4} />
                  <span style={{ fontSize: '13.5px', fontWeight: 750 }}>
                    Dark
                  </span>
                </button>

                {/* Light Theme Button */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  style={{
                    padding: '16px 14px',
                    borderRadius: 'var(--radius-xl, 18px)',
                    background: '#f4f4f6',
                    color: '#171717',
                    border: mode === 'light' ? '2px solid var(--text, #171717)' : '1px solid rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {mode === 'light' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        background: '#171717',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                  <Sun size={22} strokeWidth={2.4} />
                  <span style={{ fontSize: '13.5px', fontWeight: 750 }}>
                    Light
                  </span>
                </button>
              </div>

              {/* Privacy Mask Toggle Card */}
              <button
                type="button"
                onClick={handleTogglePrivacy}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg, 16px)',
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-md, 10px)',
                      background: 'var(--surface2, rgba(255,255,255,0.06))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text)',
                    }}
                  >
                    {privacyMask ? <EyeOff size={17} /> : <Eye size={17} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--text)' }}>
                      Mask Financial Amounts
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                      {privacyMask ? 'Amounts hidden in public spaces' : 'Amounts shown openly'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    width: 40,
                    height: 24,
                    borderRadius: 12,
                    background: privacyMask ? 'var(--text)' : 'var(--surface2, rgba(255,255,255,0.12))',
                    padding: 2,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: privacyMask ? 'flex-end' : 'flex-start',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      background: privacyMask ? 'var(--bg)' : 'var(--text-3)',
                    }}
                  />
                </div>
              </button>

              {/* Passcode Lock Toggle Card */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg, 16px)',
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md, 10px)',
                        background: 'var(--surface2, rgba(255,255,255,0.06))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text)',
                      }}
                    >
                      <Lock size={17} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--text)' }}>
                        App Passcode Lock
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                        {enablePasscode && passcodePin.length === 4
                          ? 'Protected with 4-digit PIN'
                          : 'Lock app with secret passcode'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTogglePasscode}
                    style={{
                      width: 40,
                      height: 24,
                      borderRadius: 12,
                      background: enablePasscode ? 'var(--text)' : 'var(--surface2, rgba(255,255,255,0.12))',
                      padding: 2,
                      border: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: enablePasscode ? 'flex-end' : 'flex-start',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: enablePasscode ? 'var(--bg)' : 'var(--text-3)',
                      }}
                    />
                  </button>
                </div>

                {/* If Passcode Enabled & Configured */}
                {enablePasscode && !isEditingPin && passcodePin.length === 4 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--credit, #34d399)' }}>
                      <Check size={15} strokeWidth={2.5} />
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Passcode Active (••••)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPinDraft('');
                        setIsEditingPin(true);
                      }}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '11.5px',
                        fontWeight: 650,
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        cursor: 'pointer',
                      }}
                    >
                      Change PIN
                    </button>
                  </div>
                )}

                {/* Interactive Keypad to enter 4-digit PIN */}
                {enablePasscode && (isEditingPin || passcodePin.length !== 4) && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                      paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 650 }}>
                      Enter 4-Digit Passcode
                    </div>

                    {/* 4 Digit Slots */}
                    <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
                      {[0, 1, 2, 3].map((idx) => {
                        const isFilled = idx < pinDraft.length;
                        return (
                          <div
                            key={idx}
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 7,
                              background: isFilled ? 'var(--text)' : 'transparent',
                              border: isFilled ? '2px solid var(--text)' : '2px solid var(--text-3)',
                              transition: 'all 0.15s ease',
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Compact Number Pad */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                        width: '100%',
                        maxWidth: '220px',
                        marginTop: 4,
                      }}
                    >
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handlePinKeyClick(num)}
                          style={{
                            height: 38,
                            borderRadius: 'var(--radius-md, 10px)',
                            background: 'var(--surface2, rgba(255,255,255,0.06))',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            fontSize: '15px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handlePinClear}
                        style={{
                          height: 38,
                          borderRadius: 'var(--radius-md, 10px)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-3)',
                          fontSize: '11px',
                          fontWeight: 650,
                          cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePinKeyClick('0')}
                        style={{
                          height: 38,
                          borderRadius: 'var(--radius-md, 10px)',
                          background: 'var(--surface2, rgba(255,255,255,0.06))',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          fontSize: '15px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={handlePinBackspace}
                        style={{
                          height: 38,
                          borderRadius: 'var(--radius-md, 10px)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-3)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Delete size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 4: ADVANCED FEATURES */}
          {step === 3 && (
            <motion.div
              key="step-advanced"
              custom={slideDirection}
              initial={{ opacity: 0, x: slideDirection > 0 ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDirection > 0 ? -28 : 28 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <div>
                <h1
                  style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    color: 'var(--text)',
                    margin: '0 0 6px',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.2,
                  }}
                >
                  Advanced features
                </h1>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: 'var(--text-2)',
                    margin: 0,
                  }}
                >
                  Enable or customize additional tools & utilities.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. AI Assistant (Max) */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-lg, 16px)',
                    background: 'var(--surface, #141416)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md, 10px)',
                        background: 'var(--surface2, rgba(255,255,255,0.06))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text)',
                      }}
                    >
                      <Sparkles size={17} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--text)' }}>
                        AI Assistant (Max)
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                        Voice & floating trigger
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !enableAI;
                      setEnableAI(next);
                      updateSettings({ enableAIAssistant: next });
                    }}
                    style={{
                      width: 40,
                      height: 24,
                      borderRadius: 12,
                      background: enableAI ? 'var(--text)' : 'var(--surface2, rgba(255,255,255,0.12))',
                      padding: 2,
                      border: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: enableAI ? 'flex-end' : 'flex-start',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: enableAI ? 'var(--bg)' : 'var(--text-3)',
                      }}
                    />
                  </button>
                </div>

                {/* 2. Subscriptions */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-lg, 16px)',
                    background: 'var(--surface, #141416)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md, 10px)',
                        background: 'var(--surface2, rgba(255,255,255,0.06))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text)',
                      }}
                    >
                      <RefreshCw size={17} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--text)' }}>
                        Subscriptions
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                        Recurring bills & logs
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !enableSubs;
                      setEnableSubs(next);
                      updateSettings({ enableAutopay: next });
                    }}
                    style={{
                      width: 40,
                      height: 24,
                      borderRadius: 12,
                      background: enableSubs ? 'var(--text)' : 'var(--surface2, rgba(255,255,255,0.12))',
                      padding: 2,
                      border: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: enableSubs ? 'flex-end' : 'flex-start',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: enableSubs ? 'var(--bg)' : 'var(--text-3)',
                      }}
                    />
                  </button>
                </div>

                {/* 3. Trips & Splits */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-lg, 16px)',
                    background: 'var(--surface, #141416)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md, 10px)',
                        background: 'var(--surface2, rgba(255,255,255,0.06))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text)',
                      }}
                    >
                      <Plane size={17} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--text)' }}>
                        Trips & Splits
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                        Group ledgers & splits
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !enableTrips;
                      setEnableTrips(next);
                      updateSettings({ enableSplitTrips: next });
                    }}
                    style={{
                      width: 40,
                      height: 24,
                      borderRadius: 12,
                      background: enableTrips ? 'var(--text)' : 'var(--surface2, rgba(255,255,255,0.12))',
                      padding: 2,
                      border: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: enableTrips ? 'flex-end' : 'flex-start',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: enableTrips ? 'var(--bg)' : 'var(--text-3)',
                      }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: READY & SUMMARY */}
          {step === 4 && (
            <motion.div
              key="step-ready"
              custom={slideDirection}
              initial={{ opacity: 0, x: slideDirection > 0 ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDirection > 0 ? -28 : 28 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              <div>
                <h1
                  style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    color: 'var(--text)',
                    margin: '0 0 6px',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.2,
                  }}
                >
                  You're all set
                </h1>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: 'var(--text-2)',
                    margin: 0,
                  }}
                >
                  Your personal finance ledger is configured and ready to use offline.
                </p>
              </div>

              {/* Summary Configuration Card */}
              <div
                style={{
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl, 20px)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShieldCheck size={17} style={{ color: 'var(--text-2)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                      Local SQLite Database
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 750,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full, 9999px)',
                      background: 'var(--credit-bg, rgba(52, 211, 153, 0.12))',
                      color: 'var(--credit, #34d399)',
                    }}
                  >
                    Encrypted & Private
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <WalletIcon size={17} style={{ color: 'var(--text-2)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                      Active Currency
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                    {selectedCurrency} ({sym})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <KeyRound size={17} style={{ color: 'var(--text-2)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                      App Security
                    </span>
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: enablePasscode && passcodePin.length === 4 ? 'var(--credit, #34d399)' : 'var(--text-3)' }}>
                    {enablePasscode && passcodePin.length === 4 ? 'Passcode Protected' : 'Open'}
                  </span>
                </div>

                {configuredWallets.length > 0 && configuredWallets.map(w => {
                  const num = parseFloat(walletBalances[w.id] || '0') || 0;
                  return (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {renderWalletIcon(w.icon || w.name, 18, w.color || 'var(--accent)')}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                          {w.name} Balance
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--credit, #34d399)' }}>
                        {fmtMoney(num, selectedCurrency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Navigation Bar - Clean, no dividing border lines */}
      <footer
        style={{
          padding: '12px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
          maxWidth: '520px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          gap: 12,
        }}
      >
        {/* Back Button */}
        {step > 0 ? (
          <button
            type="button"
            onClick={handlePrev}
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-full, 9999px)',
              background: 'var(--surface, #141416)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: '13.5px',
              fontWeight: 650,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>
        ) : (
          <div style={{ width: 70 }} />
        )}

        {/* Step Dots Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const isActive = idx === step;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSlideDirection(idx > step ? 1 : -1);
                  setStep(idx);
                }}
                title={`Go to step ${idx + 1}`}
                style={{
                  height: 5,
                  width: isActive ? 20 : 5,
                  borderRadius: 2.5,
                  background: isActive ? 'var(--text, #ffffff)' : 'var(--border2, rgba(255,255,255,0.2))',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              />
            );
          })}
        </div>

        {/* Next / Finish Button */}
        {isLastStep ? (
          <button
            type="button"
            onClick={() => handleComplete('dashboard')}
            style={{
              padding: '12px 24px',
              borderRadius: 'var(--radius-full, 9999px)',
              background: 'var(--text, #ffffff)',
              color: 'var(--bg, #0a0a0c)',
              border: 'none',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            }}
          >
            <span>Get Started</span>
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            style={{
              padding: '12px 24px',
              borderRadius: 'var(--radius-full, 9999px)',
              background: 'var(--text, #ffffff)',
              color: 'var(--bg, #0a0a0c)',
              border: 'none',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <span>Continue</span>
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        )}
      </footer>

      {/* Full Currency Picker Search Modal Overlay */}
      {showAllCurrencies && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAllCurrencies(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: '80vh',
              background: 'var(--surface, #141416)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl, 24px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
            }}
          >
            <div
              style={{
                padding: '18px 20px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                Select Currency
              </h2>
              <button
                type="button"
                onClick={() => setShowAllCurrencies(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '0 18px 12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'var(--surface2, rgba(255,255,255,0.06))',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md, 12px)',
                }}
              >
                <Search size={16} style={{ color: 'var(--text-3)' }} />
                <input
                  type="text"
                  placeholder="Search by code, country or name..."
                  value={currencySearch}
                  onChange={(e) => setCurrencySearch(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text)',
                    fontSize: '13.5px',
                    width: '100%',
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {filteredCurrencies.map((c) => {
                const isSelected = c.code === selectedCurrency;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelectCurrency(c.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md, 12px)',
                      background: isSelected ? 'var(--text)' : 'transparent',
                      color: isSelected ? 'var(--bg)' : 'var(--text)',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, width: 24, textAlign: 'center' }}>
                        {c.symbol}
                      </span>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700 }}>
                          {c.name} ({c.code})
                        </div>
                        <div style={{ fontSize: '11.5px', opacity: isSelected ? 0.8 : 0.6 }}>
                          {c.country}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={16} strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default IntroCarousel;
