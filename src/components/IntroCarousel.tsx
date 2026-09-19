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
  Plus,
  Sparkles,
  RefreshCw,
  Plane,
  Lock,
  Wallet,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useStore } from '../store';
import { CURRENCIES, type CurrencyInfo } from '../db';
import { currencySymbol } from '../utils';
import { useColorMode } from '../theme';
import { renderWalletIcon } from './WalletIconRenderer';
import PinSetupDrawer from './PinSetupDrawer';

export interface IntroCarouselProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAction?: (action?: 'dashboard' | 'add-expense') => void;
}

const POPULAR_CURRENCIES: Array<{ code: string; symbol: string; name: string }> = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
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

  // Responsive Screen Mode
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Reusable Passcode Drawer Integration
  const [isPinDrawerOpen, setIsPinDrawerOpen] = useState(false);
  const [enablePasscode, setEnablePasscode] = useState(() => Boolean(db.settings?.enableSecurityLock && db.settings?.securityPin));
  const [passcodePin, setPasscodePin] = useState(() => db.settings?.securityPin || '');

  // Advanced Features
  const [enableAI, setEnableAI] = useState(() => db.settings?.enableAIAssistant ?? true);
  const [enableSubs, setEnableSubs] = useState(() => db.settings?.enableAutopay ?? true);
  const [enableTrips, setEnableTrips] = useState(() => db.settings?.enableSplitTrips ?? true);

  const touchStartXRef = useRef<number | null>(null);

  const totalSteps = 5;
  const sym = currencySymbol(selectedCurrency);

  const totalOpeningBalance = useMemo(() => {
    return Object.values(walletBalances).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  }, [walletBalances]);

  const triggerHaptic = (style: ImpactStyle = ImpactStyle.Light) => {
    try {
      if (Capacitor.isPluginAvailable('Haptics')) {
        Haptics.impact({ style });
      }
    } catch {
      // ignore
    }
  };

  const handleSelectCurrency = (code: string) => {
    triggerHaptic(ImpactStyle.Light);
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
    triggerHaptic(ImpactStyle.Light);
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
    triggerHaptic(ImpactStyle.Light);
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
    triggerHaptic(ImpactStyle.Medium);
    if (enablePasscode) {
      setEnablePasscode(false);
      setPasscodePin('');
      updateSettings({ enableSecurityLock: false, securityPin: '' });
    } else {
      setIsPinDrawerOpen(true);
    }
  };

  const handleSavePinFromDrawer = (newPin: string) => {
    setPasscodePin(newPin);
    setEnablePasscode(true);
    updateSettings({
      enableSecurityLock: true,
      securityPin: newPin,
    });
  };

  const handleComplete = useCallback((action?: 'dashboard' | 'add-expense') => {
    triggerHaptic(ImpactStyle.Medium);
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
    triggerHaptic(ImpactStyle.Light);
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
    triggerHaptic(ImpactStyle.Light);
    setStep(prev => {
      if (prev > 0) {
        setSlideDirection(-1);
        return prev - 1;
      }
      return prev;
    });
  }, []);

  // Keyboard navigation for desktop
  useEffect(() => {
    if (!isOpen || isPinDrawerOpen) return;

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
  }, [isOpen, isPinDrawerOpen, handleNext, handlePrev, handleComplete, showAllCurrencies]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (showAllCurrencies || isPinDrawerOpen || isDesktop) return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || showAllCurrencies || isPinDrawerOpen || isDesktop) return;
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

  const STEPS = [
    {
      id: 0,
      title: 'Currency',
      subtitle: 'Primary ledger unit',
      icon: (
        <span style={{ fontSize: '12px', fontWeight: 800 }}>
          {selectedCurrency ? sym : '$'}
        </span>
      ),
      badge: selectedCurrency,
    },
    {
      id: 1,
      title: 'Opening Balance',
      subtitle: 'Starting wallet funds',
      icon: <Wallet size={15} />,
      badge: totalOpeningBalance > 0 ? `${sym}${totalOpeningBalance.toLocaleString()}` : '0',
    },
    {
      id: 2,
      title: 'Theme & Security',
      subtitle: 'Appearance & privacy',
      icon: mode === 'dark' ? <Moon size={15} /> : <Sun size={15} />,
      badge: `${mode === 'dark' ? 'Dark' : 'Light'}${enablePasscode ? ' • PIN' : ''}`,
    },
    {
      id: 3,
      title: 'Productivity',
      subtitle: 'AI, Bills & Splits',
      icon: <Sparkles size={15} />,
      badge: `${[enableAI, enableSubs, enableTrips].filter(Boolean).length}/3 On`,
    },
    {
      id: 4,
      title: 'Ready',
      subtitle: 'Complete setup',
      icon: <Check size={15} strokeWidth={2.5} />,
      badge: 'All set!',
    },
  ];

  // Render Step Contents
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <motion.div
            key="step-currency"
            custom={slideDirection}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? 24 : 18 }}
          >
            <div style={{ textAlign: isDesktop ? 'left' : 'center', maxWidth: '640px' }}>
              <h1
                style={{
                  fontSize: isDesktop ? '28px' : '24px',
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: '0 0 8px',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                Choose your primary currency
              </h1>
              <p
                style={{
                  fontSize: isDesktop ? '14.5px' : '13.5px',
                  lineHeight: 1.5,
                  color: 'var(--text-2)',
                  margin: 0,
                }}
              >
                All your accounts, reports, and analytics will use this as your default base currency.
              </p>
            </div>

            {/* Popular Currencies Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(105px, 1fr))',
                gap: isDesktop ? 14 : 10,
                width: '100%',
              }}
            >
              {POPULAR_CURRENCIES.map((c) => {
                const isSelected = c.code === selectedCurrency;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelectCurrency(c.code)}
                    style={{
                      padding: isDesktop ? '16px 18px' : '12px 10px',
                      borderRadius: isDesktop ? 'var(--radius-xl, 20px)' : 'var(--radius-lg, 16px)',
                      background: isSelected ? 'var(--text, #ffffff)' : 'var(--surface, #141416)',
                      color: isSelected ? 'var(--bg, #0a0a0c)' : 'var(--text, #ffffff)',
                      border: isSelected ? '2px solid var(--text, #ffffff)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isDesktop ? 'flex-start' : 'center',
                      justifyContent: 'center',
                      gap: isDesktop ? 6 : 4,
                      position: 'relative',
                      boxShadow: isSelected ? '0 8px 24px rgba(0,0,0,0.12)' : 'var(--shadow)',
                      transition: 'all 0.18s cubic-bezier(0.2, 0, 0, 1)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--text-2)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.transform = 'translateY(0px)';
                      }
                    }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: isDesktop ? 12 : 8,
                          right: isDesktop ? 12 : 8,
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          background: 'var(--bg, #0a0a0c)',
                          color: 'var(--text, #ffffff)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                    <span style={{ fontSize: isDesktop ? '24px' : '20px', fontWeight: 800, lineHeight: 1.1 }}>
                      {c.symbol}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isDesktop ? 'flex-start' : 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800 }}>
                        {c.code}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, opacity: isSelected ? 0.85 : 0.6 }}>
                        {c.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Search All Currencies Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(ImpactStyle.Light);
                setShowAllCurrencies(true);
              }}
              style={{
                padding: '14px 20px',
                borderRadius: 'var(--radius-xl, 20px)',
                background: 'var(--surface, #141416)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'all 0.15s ease',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--text-2)';
                e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-2)';
              }}
            >
              <Search size={16} />
              <span>Search all world currencies ({CURRENCIES.length})</span>
            </button>
          </motion.div>
        );

      case 1:
        return (
          <motion.div
            key="step-balance"
            custom={slideDirection}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? 24 : 18 }}
          >
            <div style={{ textAlign: isDesktop ? 'left' : 'center', maxWidth: '640px' }}>
              <h1
                style={{
                  fontSize: isDesktop ? '28px' : '24px',
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: '0 0 8px',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                Set your initial wallet balances
              </h1>
              <p
                style={{
                  fontSize: isDesktop ? '14.5px' : '13.5px',
                  lineHeight: 1.5,
                  color: 'var(--text-2)',
                  margin: 0,
                }}
              >
                Select an account below to enter its starting balance or add quick amounts.
              </p>
            </div>

            {/* Wallet Selection & Balance Box */}
            <div
              style={{
                background: 'var(--surface, #141416)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl, 24px)',
                padding: isDesktop ? '32px 28px 28px' : '24px 18px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                width: '100%',
                boxSizing: 'border-box',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {/* Horizontal Centered Amount Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  width: '100%',
                }}
              >
                <span
                  style={{
                    fontSize: isDesktop ? '44px' : '36px',
                    fontWeight: 800,
                    color: 'var(--text-2)',
                    marginRight: 6,
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
                    fontSize: isDesktop ? '56px' : '44px',
                    fontWeight: 800,
                    color: 'var(--text)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    width: isDesktop ? '240px' : '180px',
                    maxWidth: '70%',
                    textAlign: 'left',
                    padding: 0,
                    letterSpacing: '-0.03em',
                  }}
                  autoFocus={!isDesktop}
                />
              </div>

              {/* Wallet Selector Pills */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  width: '100%',
                }}
              >
                {availableWallets.map((w) => {
                  const isSelected = w.id === selectedWalletId;
                  const val = parseFloat(walletBalances[w.id] || '0') || 0;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic(ImpactStyle.Light);
                        setSelectedWalletId(w.id);
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        background: isSelected ? 'var(--text, #ffffff)' : 'var(--surface2, rgba(255,255,255,0.06))',
                        color: isSelected ? 'var(--bg, #0a0a0c)' : 'var(--text)',
                        border: isSelected ? '1px solid transparent' : '1px solid var(--border)',
                        fontSize: '13px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {renderWalletIcon(w.icon || w.name, 22, isSelected ? 'var(--bg)' : (w.color || 'var(--text)'))}
                      </div>
                      <span>{w.name}</span>
                      {val > 0 && (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            opacity: isSelected ? 0.9 : 0.7,
                            marginLeft: 2,
                          }}
                        >
                          • {sym}{val.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {[100, 500, 1000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    triggerHaptic(ImpactStyle.Light);
                    const currentVal = parseFloat(walletBalances[selectedWalletId] || '0') || 0;
                    const nextVal = String(currentVal + amt);
                    handleSetWalletBalance(selectedWalletId, nextVal);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    background: 'var(--surface, #141416)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--text-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>{sym}{amt.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step-theme"
            custom={slideDirection}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? 22 : 16 }}
          >
            <div style={{ textAlign: isDesktop ? 'left' : 'center', maxWidth: '640px' }}>
              <h1
                style={{
                  fontSize: isDesktop ? '28px' : '24px',
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: '0 0 8px',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                Appearance & security
              </h1>
              <p
                style={{
                  fontSize: isDesktop ? '14.5px' : '13.5px',
                  lineHeight: 1.5,
                  color: 'var(--text-2)',
                  margin: 0,
                }}
              >
                Personalize the color theme and protect your financial privacy.
              </p>
            </div>

            {/* Rich Visual Theme Toggle Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {/* Dark Theme Card */}
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                style={{
                  padding: '20px 18px',
                  borderRadius: 'var(--radius-xl, 22px)',
                  background: '#121214',
                  color: '#ffffff',
                  border: mode === 'dark' ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  position: 'relative',
                  textAlign: 'left',
                  boxShadow: mode === 'dark' ? '0 12px 32px rgba(0,0,0,0.5)' : 'none',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Moon size={22} strokeWidth={2.4} color="#ffffff" />
                  </div>
                  {mode === 'dark' && (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        background: '#ffffff',
                        color: '#000000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>Dark Atmosphere</div>
                  <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: 2 }}>High-contrast dark canvas</div>
                </div>
              </button>

              {/* Light Theme Card */}
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                style={{
                  padding: '20px 18px',
                  borderRadius: 'var(--radius-xl, 22px)',
                  background: '#ffffff',
                  color: '#171717',
                  border: mode === 'light' ? '2px solid #171717' : '1px solid #e5e7eb',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  position: 'relative',
                  textAlign: 'left',
                  boxShadow: mode === 'light' ? '0 12px 32px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f4f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sun size={22} strokeWidth={2.4} color="#171717" />
                  </div>
                  {mode === 'light' && (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        background: '#171717',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#171717' }}>Light Atmosphere</div>
                  <div style={{ fontSize: '12px', color: '#71717a', marginTop: 2 }}>Clean high-contrast light layout</div>
                </div>
              </button>
            </div>

            {/* Privacy & Passcode Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {/* Privacy Mask Toggle Card */}
              <button
                type="button"
                onClick={handleTogglePrivacy}
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-xl, 20px)',
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-md, 12px)',
                      background: 'var(--surface2, rgba(255,255,255,0.06))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text)',
                      flexShrink: 0,
                    }}
                  >
                    {privacyMask ? <EyeOff size={18} /> : <Eye size={18} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 750, color: 'var(--text)' }}>
                      Mask Amounts
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      {privacyMask ? 'Balances hidden by default' : 'Balances visible openly'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    width: 42,
                    height: 25,
                    borderRadius: 13,
                    background: privacyMask ? 'var(--text)' : 'var(--surface2, rgba(255,255,255,0.12))',
                    padding: 2,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: privacyMask ? 'flex-end' : 'flex-start',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 21,
                      height: 21,
                      borderRadius: 11,
                      background: privacyMask ? 'var(--bg)' : 'var(--text-3)',
                    }}
                  />
                </div>
              </button>

              {/* Passcode Lock Toggle Card */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-xl, 20px)',
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md, 12px)',
                        background: 'var(--surface2, rgba(255,255,255,0.06))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text)',
                        flexShrink: 0,
                      }}
                    >
                      <Lock size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 750, color: 'var(--text)' }}>
                        App Passcode Lock
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                        {enablePasscode && passcodePin.length === 4
                          ? 'Protected with 4-digit PIN'
                          : 'Require 4-digit PIN code'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTogglePasscode}
                    style={{
                      width: 42,
                      height: 25,
                      borderRadius: 13,
                      background: enablePasscode && passcodePin.length === 4 ? 'var(--text)' : 'var(--surface2, rgba(255,255,255,0.12))',
                      padding: 2,
                      border: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: enablePasscode && passcodePin.length === 4 ? 'flex-end' : 'flex-start',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 21,
                        height: 21,
                        borderRadius: 11,
                        background: enablePasscode && passcodePin.length === 4 ? 'var(--bg)' : 'var(--text-3)',
                      }}
                    />
                  </button>
                </div>

                {enablePasscode && passcodePin.length === 4 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 10,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--credit, #34d399)' }}>
                      <Check size={15} strokeWidth={2.5} />
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Passcode Active</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPinDrawerOpen(true)}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        cursor: 'pointer',
                      }}
                    >
                      Change PIN
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step-advanced"
            custom={slideDirection}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? 22 : 16 }}
          >
            <div style={{ textAlign: isDesktop ? 'left' : 'center', maxWidth: '640px' }}>
              <h1
                style={{
                  fontSize: isDesktop ? '28px' : '24px',
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: '0 0 8px',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                Configure productivity modules
              </h1>
              <p
                style={{
                  fontSize: isDesktop ? '14.5px' : '13.5px',
                  lineHeight: 1.5,
                  color: 'var(--text-2)',
                  margin: 0,
                }}
              >
                Enable smart assistant features, recurring bill tracking, and group split tools.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {/* 1. AI Assistant */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 'var(--radius-xl, 20px)',
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 'var(--radius-md, 12px)',
                      background: 'var(--surface2, rgba(255,255,255,0.06))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text)',
                    }}
                  >
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: 750, color: 'var(--text)' }}>
                      AI Assistant (Max)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      Voice & smart trigger
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(ImpactStyle.Light);
                    const next = !enableAI;
                    setEnableAI(next);
                    updateSettings({ enableAIAssistant: next });
                  }}
                  style={{
                    width: 42,
                    height: 25,
                    borderRadius: 13,
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
                      width: 21,
                      height: 21,
                      borderRadius: 11,
                      background: enableAI ? 'var(--bg)' : 'var(--text-3)',
                    }}
                  />
                </button>
              </div>

              {/* 2. Subscriptions */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 'var(--radius-xl, 20px)',
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 'var(--radius-md, 12px)',
                      background: 'var(--surface2, rgba(255,255,255,0.06))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text)',
                    }}
                  >
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: 750, color: 'var(--text)' }}>
                      Subscriptions & Bills
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      Recurring bill reminders
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(ImpactStyle.Light);
                    const next = !enableSubs;
                    setEnableSubs(next);
                    updateSettings({ enableAutopay: next });
                  }}
                  style={{
                    width: 42,
                    height: 25,
                    borderRadius: 13,
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
                      width: 21,
                      height: 21,
                      borderRadius: 11,
                      background: enableSubs ? 'var(--bg)' : 'var(--text-3)',
                    }}
                  />
                </button>
              </div>

              {/* 3. Trips & Splits */}
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 'var(--radius-xl, 20px)',
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 'var(--radius-md, 12px)',
                      background: 'var(--surface2, rgba(255,255,255,0.06))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text)',
                    }}
                  >
                    <Plane size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: 750, color: 'var(--text)' }}>
                      Trips & Group Splits
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      Travel ledgers & settlements
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(ImpactStyle.Light);
                    const next = !enableTrips;
                    setEnableTrips(next);
                    updateSettings({ enableSplitTrips: next });
                  }}
                  style={{
                    width: 42,
                    height: 25,
                    borderRadius: 13,
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
                      width: 21,
                      height: 21,
                      borderRadius: 11,
                      background: enableTrips ? 'var(--bg)' : 'var(--text-3)',
                    }}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step-ready"
            custom={slideDirection}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isDesktop ? 'flex-start' : 'center',
              justifyContent: 'center',
              textAlign: isDesktop ? 'left' : 'center',
              padding: isDesktop ? '16px 0' : '24px 0',
              maxWidth: '580px',
            }}
          >
            {/* Minimal Circle Icon */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--radius-full, 9999px)',
                background: 'var(--surface2, rgba(255,255,255,0.08))',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                marginBottom: 20,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <Check size={30} strokeWidth={2.5} />
            </div>

            <h1
              style={{
                fontSize: isDesktop ? '32px' : '26px',
                fontWeight: 800,
                color: 'var(--text)',
                margin: '0 0 8px',
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
              }}
            >
              You're all set
            </h1>

            <p
              style={{
                fontSize: '14.5px',
                lineHeight: 1.5,
                color: 'var(--text-2)',
                margin: '0 0 24px',
              }}
            >
              Your personal ledger workspace is initialized with your preferences.
            </p>

            {/* Config Summary Pills */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 32,
                justifyContent: isDesktop ? 'flex-start' : 'center',
              }}
            >
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>
                Currency: {selectedCurrency} ({sym})
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>
                Theme: {mode === 'dark' ? 'Dark' : 'Light'}
              </div>
              {totalOpeningBalance > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '12.5px', fontWeight: 700, color: 'var(--credit)' }}>
                  Opening: {sym}{totalOpeningBalance.toLocaleString()}
                </div>
              )}
            </div>

            {/* Direct Open Button */}
            <button
              type="button"
              onClick={() => handleComplete('dashboard')}
              style={{
                width: isDesktop ? 'auto' : '100%',
                maxWidth: '320px',
                padding: '16px 32px',
                borderRadius: 'var(--radius-full, 9999px)',
                background: 'var(--text, #ffffff)',
                color: 'var(--bg, #0a0a0c)',
                border: 'none',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                transition: 'all 0.18s ease',
              }}
            >
              <span>Open Dashboard</span>
              <ArrowRight size={18} strokeWidth={2.5} />
            </button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return createPortal(
    <div
      className="intro-carousel-portal"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        background: isDesktop ? 'rgba(0, 0, 0, 0.75)' : 'var(--bg, #0a0a0c)',
        backdropFilter: isDesktop ? 'blur(12px)' : 'none',
        color: 'var(--text, #ffffff)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        userSelect: 'none',
        padding: isDesktop ? '24px' : 0,
      }}
    >
      {/* 💻 DESKTOP SUITE CONTAINER */}
      {isDesktop ? (
        <div
          style={{
            width: '100%',
            maxWidth: '1040px',
            height: '100%',
            maxHeight: '680px',
            background: 'var(--bg, #0a0a0c)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-2xl, 28px)',
            boxShadow: 'var(--shadow-lg), 0 24px 60px rgba(0,0,0,0.5)',
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Left Desktop Sidebar Timeline */}
          <aside
            style={{
              background: 'var(--surface, #141416)',
              borderRight: '1px solid var(--border)',
              padding: '28px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}
          >
            <div>
              {/* App Brand Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: 'var(--text)',
                    color: 'var(--bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '18px',
                    letterSpacing: '-0.03em',
                  }}
                >
                  ¥
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    Okane Setup
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Workspace Studio
                  </div>
                </div>
              </div>

              {/* Interactive Timeline List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STEPS.map((s, idx) => {
                  const isActive = idx === step;
                  const isCompleted = idx < step;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic(ImpactStyle.Light);
                        setSlideDirection(idx > step ? 1 : -1);
                        setStep(idx);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md, 12px)',
                        background: isActive
                          ? 'var(--text, #ffffff)'
                          : isCompleted
                          ? 'var(--surface2, rgba(255,255,255,0.04))'
                          : 'transparent',
                        color: isActive ? 'var(--bg, #0a0a0c)' : 'var(--text)',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: isActive
                              ? 'var(--bg, #0a0a0c)'
                              : isCompleted
                              ? 'var(--credit-bg, rgba(52,211,153,0.15))'
                              : 'var(--surface2, rgba(255,255,255,0.06))',
                            color: isActive
                              ? 'var(--text, #ffffff)'
                              : isCompleted
                              ? 'var(--credit, #34d399)'
                              : 'var(--text-3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isCompleted ? <Check size={14} strokeWidth={3} /> : s.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: isActive ? 800 : 700 }}>
                            {s.title}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              opacity: isActive ? 0.8 : 0.5,
                              color: isActive ? 'var(--bg)' : 'var(--text-2)',
                            }}
                          >
                            {s.subtitle}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 750,
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-full)',
                          background: isActive
                            ? 'rgba(0,0,0,0.12)'
                            : 'var(--surface2, rgba(255,255,255,0.08))',
                          opacity: isActive ? 1 : 0.7,
                        }}
                      >
                        {s.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop Live Config Summary Box */}
            <div
              style={{
                background: 'var(--surface2, rgba(255,255,255,0.03))',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg, 16px)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
                Configuration Active
              </div>
              <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Base Currency:</span>
                  <span style={{ color: 'var(--text)', fontWeight: 750 }}>{selectedCurrency} ({sym})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Opening Balances:</span>
                  <span style={{ color: 'var(--text)', fontWeight: 750 }}>{sym}{totalOpeningBalance.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Passcode PIN:</span>
                  <span style={{ color: enablePasscode ? 'var(--credit)' : 'var(--text-3)', fontWeight: 750 }}>
                    {enablePasscode ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Desktop Main Action Panel */}
          <main
            style={{
              padding: '32px 40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              boxSizing: 'border-box',
              overflowY: 'auto',
            }}
          >
            {/* Top Desktop Step Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', background: 'var(--surface2)', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
                  Step {step + 1} of {totalSteps}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 600 }}>
                  • Press <kbd style={{ background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', fontSize: '11px' }}>→</kbd> to continue
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleComplete('dashboard')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-3)',
                  fontSize: '13px',
                  fontWeight: 650,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.background = 'var(--surface2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-3)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Skip Setup
              </button>
            </div>

            {/* Desktop Step Body */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <AnimatePresence mode="wait" custom={slideDirection}>
                {renderStepContent()}
              </AnimatePresence>
            </div>

            {/* Desktop Bottom Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid var(--border)', marginTop: 20 }}>
              {step > 0 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{
                    padding: '12px 22px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    background: 'var(--surface, #141416)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--text-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <ChevronLeft size={16} />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}

              {isLastStep ? (
                <button
                  type="button"
                  onClick={() => handleComplete('dashboard')}
                  style={{
                    padding: '14px 28px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    background: 'var(--text, #ffffff)',
                    color: 'var(--bg, #0a0a0c)',
                    border: 'none',
                    fontSize: '14.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  }}
                >
                  <span>Get Started</span>
                  <ArrowRight size={18} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  style={{
                    padding: '14px 28px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    background: 'var(--text, #ffffff)',
                    color: 'var(--bg, #0a0a0c)',
                    border: 'none',
                    fontSize: '14.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  }}
                >
                  <span>Continue</span>
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </main>
        </div>
      ) : (
        /* 📱 MOBILE ERGONOMIC VIEW */
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Mobile Header */}
          <header
            style={{
              padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: 'var(--text-3, #71717a)',
                  textTransform: 'uppercase',
                  background: 'var(--surface2, rgba(255,255,255,0.06))',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  border: '1px solid var(--border)',
                }}
              >
                Step {step + 1} of {totalSteps}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleComplete('dashboard')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-3, #71717a)',
                fontSize: '13.5px',
                fontWeight: 650,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full, 9999px)',
              }}
            >
              Skip
            </button>
          </header>

          {/* Main Mobile Content Area */}
          <main
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              width: '100%',
              padding: '0 20px',
              boxSizing: 'border-box',
              overflowY: 'auto',
            }}
          >
            <AnimatePresence mode="wait" custom={slideDirection}>
              {renderStepContent()}
            </AnimatePresence>
          </main>

          {/* Mobile Footer Navigation Bar */}
          <footer
            style={{
              padding: '16px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
              gap: 12,
            }}
          >
            {step > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  background: 'var(--surface, #141416)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
            ) : (
              <div style={{ width: 80 }} />
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
                      triggerHaptic(ImpactStyle.Light);
                      setSlideDirection(idx > step ? 1 : -1);
                      setStep(idx);
                    }}
                    title={`Go to step ${idx + 1}`}
                    style={{
                      height: 6,
                      width: isActive ? 20 : 6,
                      borderRadius: 3,
                      background: isActive ? 'var(--text, #ffffff)' : 'var(--border2, rgba(255,255,255,0.2))',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      transition: 'all 0.22s cubic-bezier(0.2, 0, 0, 1)',
                    }}
                  />
                );
              })}
            </div>

            {isLastStep ? (
              <button
                type="button"
                onClick={() => handleComplete('dashboard')}
                style={{
                  padding: '12px 22px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  background: 'var(--text, #ffffff)',
                  color: 'var(--bg, #0a0a0c)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                }}
              >
                <span>Done</span>
                <ArrowRight size={16} strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '12px 22px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  background: 'var(--text, #ffffff)',
                  color: 'var(--bg, #0a0a0c)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>Continue</span>
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            )}
          </footer>
        </div>
      )}

      {/* Full Currency Picker Search Modal Overlay */}
      {showAllCurrencies && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(0, 0, 0, 0.75)',
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
              maxWidth: '440px',
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

      {/* Reusable App Passcode Setup Drawer */}
      <PinSetupDrawer
        key={isPinDrawerOpen ? 'open' : 'closed'}
        isOpen={isPinDrawerOpen}
        onClose={() => setIsPinDrawerOpen(false)}
        hasExistingPin={Boolean(passcodePin)}
        currentPin={passcodePin}
        onSavePin={handleSavePinFromDrawer}
      />
    </div>,
    document.body
  );
};

export default IntroCarousel;
