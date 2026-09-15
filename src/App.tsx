import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import {
  Home,
  LayoutDashboard,
  ReceiptText,
  Wallet,
  Users,
  Handshake,
  BarChart3,
  Settings as SettingsIconLucide,
  Plus,
  MoreHorizontal,
  Moon,
  Sun,
  RefreshCw,
  PanelLeft,
  Sparkles,
  Database,
  ArrowLeft,
  X,
  HelpCircle,
  Search,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { StoreProvider, useStore } from './store';
import { useColorMode } from './theme';
import type { ViewName } from './types';
import { expenseFlow, overallBalance, todayISO, monthKey } from './db';
import { fmtMoney } from './utils';
import Dashboard from './views/Dashboard';
import Expenses from './views/Expenses';
import Wallets from './views/Wallets';
import Friends from './views/Friends';
import FriendDetail from './views/FriendDetail';
import Recurring from './views/Recurring';
import Settlements from './views/Settlements';
import Analytics from './views/Analytics';
import Settings from './views/Settings';
import DevSQLConsole from './views/DevSQLConsole';
import SplitTrips from './views/SplitTrips';

import ExpenseModal from './components/ExpenseModal';
import type { ExpenseInitialData } from './components/ExpenseModal';
import AIAssistantModal from './components/AIAssistantModal';
import UserGuideModal from './components/UserGuideModal';
import Toast from './components/Toast';
import NotificationBell from './components/NotificationBell';
import FloatingSearchButton from './components/FloatingSearchButton';
import ContextualSearchModal, { type SearchTab } from './components/ContextualSearchModal';
import SecurityLockModal from './components/SecurityLockModal';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { showSoftKeyboard } from './utils/keyboard';
import { useBackButtonModal, backHandler, BackPriority } from './utils/backHandler';
import './styles.css';

const MORE_IDS: ViewName[] = ['wallets', 'settlements', 'split-trips', 'recurring', 'analytics', 'settings', 'dev-sql'];

function AppInner() {
  const { db, updateSettings, showToast } = useStore();
  const [view, setView] = useState<ViewName>('dashboard');
  const [viewArg, setViewArg] = useState<string | undefined>(undefined);
  const [friendDetailId, setFriendDetailId] = useState<string>('');
  const [viewHistory, setViewHistory] = useState<Array<{ view: ViewName; arg?: string; friendDetailId?: string }>>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [addExpenseInitialData, setAddExpenseInitialData] = useState<ExpenseInitialData | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [searchInitialTab, setSearchInitialTab] = useState<SearchTab | undefined>(undefined);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isExpenseTutorial, setIsExpenseTutorial] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  const [mobileSettingsSearchOpen, setMobileSettingsSearchOpen] = useState(false);

  useEffect(() => {
    const handleOpenSearch = (e: Event) => {
      const ce = e as CustomEvent<{ query?: string; tab?: SearchTab }>;
      if (ce.detail?.query !== undefined) {
        setSearchInitialQuery(ce.detail.query);
      }
      if (ce.detail?.tab !== undefined) {
        setSearchInitialTab(ce.detail.tab);
      }
      setShowSearchModal(true);
    };
    window.addEventListener('app-open-search', handleOpenSearch);
    return () => window.removeEventListener('app-open-search', handleOpenSearch);
  }, []);

  const handleGoBack = useCallback(() => {
    if (viewHistory.length > 0) {
      const prev = viewHistory[viewHistory.length - 1];
      setViewHistory(h => h.slice(0, -1));
      setView(prev.view);
      setViewArg(prev.arg);
      if (prev.friendDetailId) setFriendDetailId(prev.friendDetailId);
    } else {
      setView('dashboard');
      setViewArg(undefined);
    }
  }, [viewHistory]);

  // Connect native exit confirmation toast callback
  useEffect(() => {
    backHandler.setExitToastCallback((msg) => showToast(msg));
    return () => backHandler.setExitToastCallback(null);
  }, [showToast]);

  // Modal / Drawer back button handling
  useBackButtonModal(moreOpen, () => setMoreOpen(false), { priority: BackPriority.DRAWER });
  useBackButtonModal(showSearchModal, () => setShowSearchModal(false), { priority: BackPriority.MODAL });
  useBackButtonModal(showAIAssistant, () => setShowAIAssistant(false), { priority: BackPriority.MODAL });
  useBackButtonModal(showGuideModal, () => setShowGuideModal(false), { priority: BackPriority.MODAL });

  // View navigation history back handler (Android back button navigates backwards through views before exiting)
  useEffect(() => {
    if (view === 'dashboard' && viewHistory.length === 0) return;

    const unregister = backHandler.register({
      id: 'app-view-history',
      priority: BackPriority.VIEW_HISTORY,
      name: 'View History Navigation',
      action: () => {
        if (viewHistory.length > 0) {
          const prev = viewHistory[viewHistory.length - 1];
          setViewHistory(h => h.slice(0, -1));
          setView(prev.view);
          setViewArg(prev.arg);
          if (prev.friendDetailId) setFriendDetailId(prev.friendDetailId);
          return true;
        } else if (view !== 'dashboard') {
          setView('dashboard');
          setViewArg(undefined);
          return true;
        }
        return false;
      },
    });

    return () => unregister();
  }, [view, viewHistory]);

  const isSecurityLockActive = Boolean(db.settings?.enableSecurityLock && db.settings?.securityPin);
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    return isSecurityLockActive;
  });

  const lastUnlockTimeRef = useRef<number>(0);
  const backgroundTimestampRef = useRef<number>(0);

  const handleUnlock = useCallback(() => {
    lastUnlockTimeRef.current = Date.now();
    setIsAppLocked(false);
  }, []);

  // Re-lock on background app resume if setting enabled
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => void } | null = null;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      const now = Date.now();
      if (!isActive) {
        // App went to background
        backgroundTimestampRef.current = now;
      } else {
        // App resumed / gained focus
        const timeSinceUnlock = now - lastUnlockTimeRef.current;
        const timeInBackground = backgroundTimestampRef.current > 0 ? (now - backgroundTimestampRef.current) : 0;

        // Reset background timestamp
        backgroundTimestampRef.current = 0;

        // If unlocked within the last 3.5 seconds (e.g. system Biometric dialog dismissal),
        // or app was backgrounded for less than 1.2 seconds, DO NOT trigger a spurious re-lock.
        if (timeSinceUnlock < 3500 || timeInBackground < 1200) {
          return;
        }

        if (isSecurityLockActive && (db.settings?.requireBiometricOnResume ?? true)) {
          setIsAppLocked(true);
        }
      }
    }).then(h => {
      handle = h;
    }).catch(err => {
      console.warn('Failed to register appStateChange listener:', err);
    });

    return () => {
      if (handle) {
        handle.remove();
      }
    };
  }, [isSecurityLockActive, db.settings?.requireBiometricOnResume]);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto open soft keyboard when any search bar, input or textbox is selected/focused on mobile
  useEffect(() => {
    const autoOpen = db.settings?.autoOpenKeyboard ?? false;
    if (!autoOpen) return;

    let isTriggering = false;
    const handleInputInteraction = (e: Event) => {
      if (isTriggering) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isInput = target.tagName === 'INPUT';
      const isTextarea = target.tagName === 'TEXTAREA';
      const isContentEditable = target.isContentEditable;

      if (!isInput && !isTextarea && !isContentEditable) return;

      if (isInput) {
        const inputType = (target as HTMLInputElement).type?.toLowerCase();
        if (['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'range', 'color'].includes(inputType)) {
          return;
        }
      }

      // Check if target is not disabled/readonly
      if ((target as HTMLInputElement).readOnly || (target as HTMLInputElement).disabled) {
        return;
      }

      // Invoke soft keyboard manager with auto scrolling
      isTriggering = true;
      showSoftKeyboard(target, { placeCursorAtEnd: true, scroll: true });
      setTimeout(() => { isTriggering = false; }, 100);
    };

    document.addEventListener('focusin', handleInputInteraction, true);
    document.addEventListener('click', handleInputInteraction, true);
    document.addEventListener('touchstart', handleInputInteraction, { passive: true, capture: true });
    document.addEventListener('pointerdown', handleInputInteraction, { passive: true, capture: true });
    return () => {
      document.removeEventListener('focusin', handleInputInteraction, true);
      document.removeEventListener('click', handleInputInteraction, true);
      document.removeEventListener('touchstart', handleInputInteraction, true);
      document.removeEventListener('pointerdown', handleInputInteraction, true);
    };
  }, [db.settings?.autoOpenKeyboard]);

  const handleStartExpenseTutorial = () => {
    setShowGuideModal(false);
    setIsExpenseTutorial(true);
    setShowAddExpense(true);
  };
  const { mode, setMode, toggleMode: toggleDark, accent, setAccent, customColor, setCustomColor } = useColorMode();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const sidebarCollapsed = db.settings?.sidebarCollapsed ?? (localStorage.getItem('sidebar_collapsed') === 'true');
  const floatingSidebar = db.settings?.floatingSidebar ?? (localStorage.getItem('sidebar_floating') === 'true');
  const hideNavLabels = db.settings?.hideNavLabels ?? (typeof localStorage !== 'undefined' && localStorage.getItem('hide_nav_labels') !== null ? localStorage.getItem('hide_nav_labels') === 'true' : true);

  useEffect(() => {
    const shouldHide = db.settings?.hideScrollbar ?? true;
    document.documentElement.setAttribute('data-hide-scrollbars', String(shouldHide));
    if (shouldHide) {
      document.documentElement.classList.add('hide-scrollbars');
    } else {
      document.documentElement.classList.remove('hide-scrollbars');
    }
  }, [db.settings?.hideScrollbar]);

  useEffect(() => {
    if (db.settings?.colorMode && db.settings.colorMode !== mode) {
      setMode(db.settings.colorMode);
    }
    if (accent !== 'monochrome') {
      setAccent('monochrome');
    }
    if (db.settings?.accent && db.settings.accent !== 'monochrome') {
      updateSettings({ accent: 'monochrome' });
    }
    if (db.settings?.customAccentColor && db.settings.customAccentColor !== customColor) {
      setCustomColor(db.settings.customAccentColor);
    }
  }, [db.settings?.colorMode, db.settings?.accent, db.settings?.customAccentColor, mode, accent, customColor, setMode, setAccent, setCustomColor, updateSettings]);

  const isDevMode = db.settings?.devMode ?? true;
  const enableDevSQLConsole = isDevMode && (db.settings?.enableDevSQLConsole ?? true);
  const enableAIAssistant = db.settings?.enableAIAssistant ?? true;
  const searchLocation = db.settings?.searchLocation ?? 'topbar';
  const enableSplitTrips = db.settings?.enableSplitTrips ?? true;
  const enableAutopay = db.settings?.enableAutopay ?? true;
  const enableUserGuide = isDevMode && (db.settings?.enableUserGuide ?? true);

  useEffect(() => {
    if (view === 'split-trips' && !enableSplitTrips) {
      const timer = setTimeout(() => setView('dashboard'), 0);
      return () => clearTimeout(timer);
    }
  }, [view, enableSplitTrips]);

  useEffect(() => {
    if (view === 'recurring' && !enableAutopay) {
      const timer = setTimeout(() => setView('dashboard'), 0);
      return () => clearTimeout(timer);
    }
  }, [view, enableAutopay]);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    localStorage.setItem('sidebar_collapsed', String(next));
    updateSettings({ sidebarCollapsed: next });
  };

  const handleToggleDark = () => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    toggleDark();
    updateSettings({ colorMode: nextMode });
  };

  const [topbarFilterCount, setTopbarFilterCount] = useState(0);

  useEffect(() => {
    const handleCountUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ view: string; count: number }>;
      if (customEvent.detail && customEvent.detail.view === view) {
        setTopbarFilterCount(customEvent.detail.count);
      }
    };
    window.addEventListener('app-filter-count-update', handleCountUpdate);
    return () => window.removeEventListener('app-filter-count-update', handleCountUpdate);
  }, [view]);

  const showFilterInTopbar = ['expenses', 'friends', 'recurring'].includes(view);

  const { expenses, currency } = useMemo(() => ({
    expenses: db.expenses,
    currency: db.settings.currency,
  }), [db]);

  const expOut = useMemo(() => {
    const curMonth = monthKey(todayISO());
    return expenses
      .filter(e => monthKey(e.date) === curMonth && expenseFlow(e) === 'out' && e.type === 'personal')
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [expenses]);

  const expIn = useMemo(() => {
    const curMonth = monthKey(todayISO());
    return expenses
      .filter(e => monthKey(e.date) === curMonth && expenseFlow(e) === 'in' && e.type === 'personal')
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [expenses]);
  const { friendCredit, friendDebt } = useMemo(() => {
    const ob = overallBalance(db);
    return { friendCredit: ob.credit, friendDebt: ob.debit };
  }, [db]);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('collapsed_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const navigate = useCallback((v: ViewName, arg?: string) => {
    setView(prevView => {
      if (prevView !== v) {
        setViewHistory(h => [...h.slice(-15), { view: prevView, arg: viewArg, friendDetailId }]);
        setTopbarFilterCount(0);
      }
      return v;
    });
    setViewArg(arg);
    if (v === 'friend-detail' && arg) setFriendDetailId(arg);
    setMoreOpen(false);

    const targetView = v === 'friend-detail' ? 'friends' : v;
    const sectionTitle = ['Main', 'Social', 'Insights', 'System', 'Developer'].find(sec => {
      if (sec === 'Main' && ['dashboard', 'expenses', 'recurring', 'wallets'].includes(targetView)) return true;
      if (sec === 'Social' && ['friends', 'settlements', 'split-trips'].includes(targetView)) return true;
      if (sec === 'Insights' && ['analytics'].includes(targetView)) return true;
      if (sec === 'System' && ['settings'].includes(targetView)) return true;
      if (sec === 'Developer' && ['dev-sql'].includes(targetView)) return true;
      return false;
    });
    if (sectionTitle) {
      setCollapsedSections(prev => {
        if (!prev[sectionTitle]) return prev;
        const next = { ...prev, [sectionTitle]: false };
        try {
          localStorage.setItem('collapsed_sections', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  }, [viewArg, friendDetailId]);

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        localStorage.setItem('collapsed_sections', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    if (db.settings?.enableAnimations === false) {
      document.body.classList.add('no-animations');
    } else {
      document.body.classList.remove('no-animations');
    }

    if (db.settings?.performanceMode) {
      document.body.classList.add('performance-mode');
    } else {
      document.body.classList.remove('performance-mode');
    }
  }, [db.settings?.enableAnimations, db.settings?.performanceMode]);

  const pendingSettlements = useMemo(() => {
    return db.friends.filter(f =>
      db.expenses.some(e => e.friendId === f.id && !e.settled && e.type !== 'personal')
    ).length;
  }, [db.friends, db.expenses]);

  const dueAutopaysCount = useMemo(() => {
    const today = todayISO();
    return (db.recurringRules || []).filter(r => r.kind === 'autopay' && r.status === 'active' && r.nextDueDate && r.nextDueDate <= today).length;
  }, [db.recurringRules]);

  const sidebarNavSections = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard' as ViewName, label: 'Dashboard', icon: <Home size={19} /> },
        { id: 'expenses' as ViewName, label: 'Expenses', icon: <ReceiptText size={18} /> },
        ...(enableAutopay ? [{ id: 'recurring' as ViewName, label: 'Autopay', icon: <RefreshCw size={18} />, badge: dueAutopaysCount, badgeColor: '#d32f2f', badgeBg: 'rgba(239, 83, 80, 0.15)' }] : []),
        { id: 'wallets' as ViewName, label: 'Wallets', icon: <Wallet size={18} /> },
      ]
    },
    {
      title: 'Social',
      items: [
        { id: 'friends' as ViewName, label: 'Contacts', icon: <Users size={18} /> },
        { id: 'settlements' as ViewName, label: 'Settlements', icon: <Handshake size={18} />, badge: pendingSettlements, badgeColor: 'var(--accent)', badgeBg: 'var(--accent-soft)' },
        ...(enableSplitTrips ? [{ id: 'split-trips' as ViewName, label: 'Splits & Groups', icon: <Users size={18} /> }] : []),
      ]
    },
    {
      title: 'Insights',
      items: [
        { id: 'analytics' as ViewName, label: 'Statistics', icon: <BarChart3 size={18} /> },
      ]
    },
    {
      title: 'System',
      items: [
        { id: 'settings' as ViewName, label: 'Settings', icon: <SettingsIconLucide size={18} /> },
      ]
    },
    ...(enableDevSQLConsole ? [{
      title: 'Developer',
      items: [
        { id: 'dev-sql' as ViewName, label: 'Dev SQL Console', icon: <Database size={18} /> },
      ]
    }] : []),
  ];

  const moreItems: { id: ViewName; label: string; icon: React.ReactNode }[] = [
    ...(enableSplitTrips ? [{ id: 'split-trips' as ViewName, label: 'Splits & Groups', icon: <Users size={20} /> }] : []),
    ...(enableAutopay ? [{ id: 'recurring' as ViewName, label: 'Autopay', icon: <RefreshCw size={20} /> }] : []),
    { id: 'wallets', label: 'Wallets', icon: <Wallet size={20} /> },
    { id: 'settlements', label: 'Settlements', icon: <Handshake size={20} /> },
    { id: 'analytics', label: 'Statistics', icon: <BarChart3 size={20} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIconLucide size={20} /> },
    ...(enableDevSQLConsole ? [{ id: 'dev-sql' as ViewName, label: 'Dev SQL Console', icon: <Database size={18} /> }] : []),
  ];

  const activeView = view === 'friend-detail' ? 'friends' : view;
  const bottomNavValue = MORE_IDS.includes(activeView) ? 'more' : activeView;

  const clearViewArg = useCallback(() => {
    setViewArg(undefined);
  }, []);

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard onNavigate={navigate} onAddExpense={() => setShowAddExpense(true)} />;
      case 'expenses': return <Expenses initialArg={viewArg} onClearViewArg={clearViewArg} />;
      case 'wallets': return <Wallets initialArg={viewArg} onClearViewArg={clearViewArg} />;
      case 'friends': return <Friends onNavigate={navigate} />;
      case 'friend-detail':
        return (
          <>
            <Friends onNavigate={navigate} />
            <FriendDetail friendId={friendDetailId} onNavigate={navigate} />
          </>
        );
      case 'recurring':
        return <Recurring onNavigate={navigate} initialArg={viewArg} onClearViewArg={clearViewArg} />;
      case 'settlements': return <Settlements initialArg={viewArg} onClearViewArg={clearViewArg} />;
      case 'split-trips': return <SplitTrips initialArg={viewArg} onClearViewArg={clearViewArg} />;
      case 'analytics': return <Analytics onNavigate={navigate} />;
      case 'settings':
        return (
          <Settings
            onNavigate={navigate}
            onOpenGuide={() => setShowGuideModal(true)}
            onStartExpenseTutorial={handleStartExpenseTutorial}
            initialArg={viewArg}
            onClearViewArg={clearViewArg}
            onTestLock={() => setIsAppLocked(true)}
            searchQuery={settingsSearchQuery}
            onSearchChange={setSettingsSearchQuery}
            mobileSearchOpen={mobileSettingsSearchOpen}
            onToggleMobileSearch={() => setMobileSettingsSearchOpen(o => !o)}
          />
        );
      case 'dev-sql': return <DevSQLConsole onNavigate={navigate} />;
      default: return <Dashboard onNavigate={navigate} onAddExpense={() => setShowAddExpense(true)} />;
    }
  };

  return (
    <div className={`app-layout ${db.settings?.enableAnimations === false ? 'no-animations' : ''} ${db.settings?.performanceMode ? 'performance-mode' : ''}`}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <nav className={`sidebar ${floatingSidebar ? 'floating' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-logo">
            {!sidebarCollapsed ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span
                  className="sidebar-logo-text"
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: '-0.04em',
                    lineHeight: 1.1,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-sans)',
                    userSelect: 'none',
                  }}
                >
                  Okane
                </span>
              </div>
            ) : null}
            {sidebarCollapsed ? (
              <IconButton
                size="small"
                onClick={toggleSidebar}
                sx={{ 
                  width: 44,
                  height: 44,
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: 'text.primary',
                  margin: '0 auto',
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.04)',
                    bgcolor: 'rgba(255, 255, 255, 0.12)',
                  },
                  '&:active': {
                    transform: 'scale(0.95)',
                  }
                }}
                title="Expand sidebar"
              >
                <PanelLeft size={20} strokeWidth={1.9} />
              </IconButton>
            ) : (
              <IconButton
                size="small"
                onClick={toggleSidebar}
                sx={{ 
                  color: 'var(--text-3)', 
                  p: 0,
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  border: 'none',
                  bgcolor: 'transparent',
                  boxShadow: 'none',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    color: 'var(--text)',
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                  },
                  '&:active': {
                    transform: 'scale(0.95)',
                  }
                }}
                title="Collapse sidebar"
              >
                <PanelLeft size={18} />
              </IconButton>
            )}
          </div>

          <div className="sidebar-nav">
            {sidebarNavSections.map((section) => {
              const isSectionCollapsed = Boolean(collapsedSections[section.title]);
              const hasActiveItem = section.items.some(item => item.id === activeView);
              const sectionTotalBadges = section.items.reduce((sum, item) => sum + (item.badge || 0), 0);

              return (
                <div key={section.title} className="nav-section-group">
                  {!sidebarCollapsed ? (
                    <button
                      type="button"
                      className={`nav-section-header ${isSectionCollapsed ? 'collapsed' : ''} ${hasActiveItem ? 'has-active' : ''}`}
                      onClick={() => toggleSection(section.title)}
                      title={`${isSectionCollapsed ? 'Expand' : 'Collapse'} ${section.title} section`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{section.title}</span>
                        {isSectionCollapsed && sectionTotalBadges > 0 && (
                          <span className="nav-badge" style={{
                            fontSize: 9.5, fontWeight: 700, padding: '1px 5px',
                            background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 99,
                          }}>
                            {sectionTotalBadges}
                          </span>
                        )}
                      </div>
                    </button>
                  ) : (
                    <div className="nav-section-divider" title={section.title} />
                  )}

                  {(!isSectionCollapsed || sidebarCollapsed) && (
                    <div className="nav-section-items">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                          onClick={() => navigate(item.id)}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          <span className="nav-item-icon">{item.icon}</span>
                          <span className="nav-item-label">{item.label}</span>
                          {item.badge && item.badge > 0 ? (
                            <span className="nav-badge" style={{
                              marginLeft: 'auto',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: sidebarCollapsed ? '2px 5px' : '1px 6px',
                              background: item.badgeBg || 'var(--accent-soft)',
                              color: item.badgeColor || 'var(--accent)',
                              borderRadius: 99,
                            }}>
                              {item.badge}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ flex: 1 }} />
            <button
              className="btn btn-primary"
              style={{
                margin: sidebarCollapsed ? '4px auto 8px auto' : '8px 10px 4px',
                width: sidebarCollapsed ? 44 : 'calc(100% - 20px)',
                height: sidebarCollapsed ? 44 : 35,
                padding: sidebarCollapsed ? 0 : '0 14px',
                borderRadius: sidebarCollapsed ? 16 : 10,
                background: mode === 'dark' ? '#ffffff' : '#111111',
                color: mode === 'dark' ? '#000000' : '#ffffff',
                border: 'none',
                fontWeight: 650,
                fontSize: sidebarCollapsed ? 14 : 13.5,
                letterSpacing: '-0.2px',
                boxShadow: mode === 'dark' ? '0 4px 14px rgba(0, 0, 0, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: sidebarCollapsed ? 0 : 6,
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
              onClick={() => setShowAddExpense(true)}
              title={sidebarCollapsed ? "Add Expense" : undefined}
            >
              <Plus size={sidebarCollapsed ? 22 : 17} strokeWidth={2.4} style={{ color: mode === 'dark' ? '#000000' : '#ffffff' }} />
              {!sidebarCollapsed && <span style={{ fontWeight: 650 }}>Add</span>}
            </button>
          </div>

          <div className="sidebar-footer" style={{ padding: sidebarCollapsed ? '0 0 14px 0' : '10px 14px 14px', borderTop: 'none', background: 'transparent' }}>
            {!sidebarCollapsed ? (
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Theme: <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{mode === 'dark' ? 'Dark Mode' : 'Light Mode'}</strong>
                </span>
                <button
                  type="button"
                  className="sidebar-theme-btn"
                  onClick={handleToggleDark}
                  title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'} mode`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'var(--text-2)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.18s ease',
                  }}
                >
                  {mode === 'dark' ? <Moon size={16} strokeWidth={2.1} /> : <Sun size={16} strokeWidth={2.1} />}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <button
                  type="button"
                  className="sidebar-theme-btn"
                  onClick={handleToggleDark}
                  title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'} mode`}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: 'none',
                    transition: 'all 0.18s ease',
                  }}
                >
                  {mode === 'dark' ? <Moon size={19} strokeWidth={2} /> : <Sun size={19} strokeWidth={2} />}
                </button>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Mobile top AppBar */}
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: 'var(--bg)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            borderBottom: 'none',
            color: 'text.primary',
            boxShadow: 'none',
            transition: 'background-color 0.2s ease',
            pt: 'env(safe-area-inset-top, 0px)',
            pb: 0,
          }}
        >
          <Toolbar
            variant="dense"
            sx={{
              minHeight: { xs: '48px !important', sm: '52px !important' },
              height: { xs: 48, sm: 52 },
              px: { xs: 2, sm: 2.5 },
              gap: 1.25,
              justifyContent: 'space-between',
            }}
          >
            {/* Left side: Back button or Clean view title (without leading icon) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexShrink: 1 }}>
              {view === 'settings' && (
                <IconButton
                  size="small"
                  onClick={handleGoBack}
                  sx={{
                    color: 'text.primary',
                    bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    p: 0.8,
                    borderRadius: '10px',
                    mr: 0.5,
                    '&:active': { transform: 'scale(0.92)' }
                  }}
                  title={view === 'settings' ? 'Back' : 'Back to Contacts'}
                >
                  <ArrowLeft size={18} />
                </IconButton>
              )}

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h6"
                  component="span"
                  sx={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 750,
                    fontSize: { xs: '1.24rem', sm: '1.34rem' },
                    letterSpacing: '-0.4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                    lineHeight: 1.25,
                    color: 'text.primary',
                  }}
                >
                  {view === 'dashboard' ? 'Dashboard' :
                   view === 'expenses' ? 'Expenses' :
                   view === 'friends' ? 'Contacts' :
                   view === 'friend-detail' ? 'Contact Details' :
                   view === 'wallets' ? 'Wallets' :
                   view === 'recurring' ? 'Autopay' :
                   view === 'analytics' ? 'Statistics' :
                   view === 'settlements' ? 'Settlements' :
                   view === 'split-trips' ? 'Splits & Groups' :
                   view === 'settings' ? 'Settings' :
                   view === 'dev-sql' ? 'Dev SQL' : 'Dashboard'}
                </Typography>
              </Box>
            </Box>



            {/* Right side controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
              {/* Quick financial summaries */}
              {view === 'expenses' && (
                <Box sx={{
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  gap: { xs: 0.4, sm: 0.5 },
                  maxWidth: { xs: '200px', sm: '320px', md: 'none' },
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  '&::-webkit-scrollbar': { display: 'none' }
                }}>
                  <Box
                    title={`-${fmtMoney(expOut, currency)}`}
                    sx={{
                      display: 'inline-flex', alignItems: 'center',
                      px: { xs: 0.9, sm: 1.25 }, py: { xs: 0.35, sm: 0.45 }, borderRadius: 99,
                      bgcolor: mode === 'dark' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(211, 47, 47, 0.08)',
                      color: 'error.main', fontSize: { xs: '0.74rem', sm: '0.82rem' }, fontWeight: 650,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: { xs: '110px', sm: '160px', md: '220px' }, flexShrink: 1
                    }}
                  >
                    -{fmtMoney(expOut, currency)}
                  </Box>
                  <Box
                    title={`+${fmtMoney(expIn, currency)}`}
                    sx={{
                      display: 'inline-flex', alignItems: 'center',
                      px: { xs: 0.9, sm: 1.25 }, py: { xs: 0.35, sm: 0.45 }, borderRadius: 99,
                      bgcolor: mode === 'dark' ? 'rgba(102, 187, 106, 0.15)' : 'rgba(46, 125, 50, 0.08)',
                      color: 'success.main', fontSize: { xs: '0.74rem', sm: '0.82rem' }, fontWeight: 650,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: { xs: '110px', sm: '160px', md: '220px' }, flexShrink: 1
                    }}
                  >
                    +{fmtMoney(expIn, currency)}
                  </Box>
                </Box>
              )}

              {view === 'friends' && (
                <Box sx={{
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  gap: { xs: 0.4, sm: 0.5 },
                  maxWidth: { xs: '200px', sm: '320px', md: 'none' },
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  '&::-webkit-scrollbar': { display: 'none' }
                }}>
                  <Box
                    title={`+${fmtMoney(friendCredit, currency)}`}
                    sx={{
                      display: 'inline-flex', alignItems: 'center',
                      px: { xs: 0.9, sm: 1.25 }, py: { xs: 0.35, sm: 0.45 }, borderRadius: 99,
                      bgcolor: mode === 'dark' ? 'rgba(102, 187, 106, 0.15)' : 'rgba(46, 125, 50, 0.08)',
                      color: 'success.main', fontSize: { xs: '0.74rem', sm: '0.82rem' }, fontWeight: 650,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: { xs: '110px', sm: '160px', md: '220px' }, flexShrink: 1
                    }}
                  >
                    +{fmtMoney(friendCredit, currency)}
                  </Box>
                  <Box
                    title={`-${fmtMoney(friendDebt, currency)}`}
                    sx={{
                      display: 'inline-flex', alignItems: 'center',
                      px: { xs: 0.9, sm: 1.25 }, py: { xs: 0.35, sm: 0.45 }, borderRadius: 99,
                      bgcolor: mode === 'dark' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(211, 47, 47, 0.08)',
                      color: 'error.main', fontSize: { xs: '0.74rem', sm: '0.82rem' }, fontWeight: 650,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: { xs: '110px', sm: '160px', md: '220px' }, flexShrink: 1
                    }}
                  >
                    -{fmtMoney(friendDebt, currency)}
                  </Box>
                </Box>
              )}



              {view === 'friends' && (
                <button
                  type="button"
                  id="topbar-add-contact-btn"
                  className="btn-icon topbar-add-contact-btn"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('app-add-contact'));
                  }}
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'transparent',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text)',
                    flexShrink: 0,
                    transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
                  }}
                  title="Add Contact"
                  aria-label="Add Contact"
                >
                  <Plus size={18} />
                </button>
              )}

              {view === 'recurring' && (
                <button
                  type="button"
                  id="topbar-add-recurring-btn"
                  className="btn-icon topbar-add-recurring-btn desktop-hidden"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('app-add-recurring'));
                  }}
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'transparent',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text)',
                    flexShrink: 0,
                    transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
                  }}
                  title="Add Subscription / Autopay"
                  aria-label="Add Subscription / Autopay"
                >
                  <Plus size={18} />
                </button>
              )}

              {showFilterInTopbar && (
                <button
                  type="button"
                  id="topbar-filter-btn"
                  className={`btn-icon topbar-filter-btn ${topbarFilterCount > 0 ? 'active' : ''}`}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('app-open-filters', { detail: { view } }));
                  }}
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: topbarFilterCount > 0 ? 'var(--surface2)' : 'transparent',
                    border: topbarFilterCount > 0 ? '1px solid var(--border)' : '1px solid transparent',
                    boxShadow: topbarFilterCount > 0 ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text)',
                    flexShrink: 0,
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  title={topbarFilterCount > 0 ? `${topbarFilterCount} active filters` : "Filters & Sorting"}
                  aria-label="Filters & Sorting"
                >
                  <Filter size={18} />
                  {topbarFilterCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -3,
                        right: -3,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 999,
                        background: 'var(--text)',
                        color: 'var(--surface)',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        lineHeight: 1,
                        border: '1.5px solid var(--bg)',
                      }}
                    >
                      {topbarFilterCount}
                    </span>
                  )}
                </button>
              )}

              {view === 'settings' ? (
                <button
                  type="button"
                  id="topbar-settings-search-btn"
                  className={`btn-icon topbar-settings-search-btn ${mobileSettingsSearchOpen ? 'active' : ''}`}
                  onClick={() => setMobileSettingsSearchOpen(prev => !prev)}
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: mobileSettingsSearchOpen ? 'var(--surface2)' : 'transparent',
                    border: mobileSettingsSearchOpen ? '1px solid var(--border)' : '1px solid transparent',
                    boxShadow: mobileSettingsSearchOpen ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text)',
                    flexShrink: 0,
                    transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
                  }}
                  title="Search Settings"
                  aria-label="Search Settings"
                >
                  <Search size={20} />
                </button>
              ) : (
                <>
                  {searchLocation === 'topbar' && (
                    <button
                      type="button"
                      id="topbar-search-btn"
                      className="btn-icon topbar-search-btn"
                      onClick={() => setShowSearchModal(true)}
                      style={{
                        position: 'relative',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'transparent',
                        border: '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text)',
                        flexShrink: 0,
                        transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
                      }}
                      title="Search (Ctrl + K)"
                      aria-label="Search"
                    >
                      <Search size={20} />
                    </button>
                  )}

                  <NotificationBell onNavigate={navigate} />
                </>
              )}
            </Box>
          </Toolbar>
        </AppBar>
      )}

      <main className={`main-content${isMobile ? ' mobile-layout' : ''}`}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="view-page-animate"
        >
          {renderView()}
        </motion.div>
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            pb: 'env(safe-area-inset-bottom, 0px)',
            bgcolor: 'var(--bg)',
            backgroundImage: 'none',
            border: 'none',
            borderTop: 'none',
            boxShadow: 'none',
          }}
        >
          <BottomNavigation
            value={bottomNavValue}
            onChange={(_, newValue) => {
              if (newValue === 'add') {
                setShowAddExpense(true);
              } else if (newValue === 'more') {
                setMoreOpen(true);
              } else {
                navigate(newValue as ViewName);
              }
            }}
            showLabels={!hideNavLabels}
            sx={{
              height: hideNavLabels ? 56 : 66,
              bgcolor: 'var(--bg)',
              border: 'none',
              borderTop: 'none',
              boxShadow: 'none',
              px: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                flex: 1,
                padding: hideNavLabels ? '0 !important' : '6px 0 4px',
                bgcolor: 'transparent !important',
                background: 'transparent !important',
                WebkitTapHighlightColor: 'transparent !important',
                outline: 'none !important',
                border: 'none !important',
                boxShadow: 'none !important',
                userSelect: 'none',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: 'transparent !important',
                  background: 'transparent !important',
                },
                '&:active': {
                  bgcolor: 'transparent !important',
                  background: 'transparent !important',
                  transform: 'scale(0.96)',
                },
                '&:focus': {
                  outline: 'none !important',
                  bgcolor: 'transparent !important',
                  background: 'transparent !important',
                },
                '&.Mui-focusVisible': {
                  outline: 'none !important',
                  bgcolor: 'transparent !important',
                  background: 'transparent !important',
                },
                '&.Mui-selected': {
                  bgcolor: 'transparent !important',
                  background: 'transparent !important',
                },
                '& .MuiTouchRipple-root': {
                  display: 'none !important',
                },
                '& .MuiBottomNavigationAction-label': {
                  display: hideNavLabels ? 'none !important' : 'block',
                  fontSize: '11px !important',
                  fontWeight: '500 !important',
                  lineHeight: 1.2,
                  marginTop: '3px',
                  color: mode === 'dark' ? '#71717a' : '#8e8e93',
                  transition: 'color 0.15s ease, font-weight 0.15s ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  '&.Mui-selected': {
                    fontSize: '11px !important',
                    fontWeight: '700 !important',
                    color: mode === 'dark' ? '#ffffff' : '#111111',
                  },
                },
              },
            }}
          >
            <BottomNavigationAction
              disableRipple
              value="dashboard"
              label="Dashboard"
              icon={
                <Box
                  sx={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 50,
                    height: 28,
                    borderRadius: '999px',
                  }}
                >
                  {bottomNavValue === 'dashboard' && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-neutral-800 rounded-full"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 9999,
                        backgroundColor: mode === 'dark' ? '#27272a' : '#e4e4e7',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: bottomNavValue === 'dashboard' ? (mode === 'dark' ? '#ffffff' : '#111111') : (mode === 'dark' ? '#71717a' : '#8e8e93'),
                    }}
                  >
                    <LayoutDashboard size={19} />
                  </Box>
                </Box>
              }
            />
            <BottomNavigationAction
              disableRipple
              value="expenses"
              label="Expenses"
              icon={
                <Box
                  sx={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 50,
                    height: 28,
                    borderRadius: '999px',
                  }}
                >
                  {bottomNavValue === 'expenses' && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-neutral-800 rounded-full"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 9999,
                        backgroundColor: mode === 'dark' ? '#27272a' : '#e4e4e7',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: bottomNavValue === 'expenses' ? (mode === 'dark' ? '#ffffff' : '#111111') : (mode === 'dark' ? '#71717a' : '#8e8e93'),
                    }}
                  >
                    <ReceiptText size={19} />
                  </Box>
                </Box>
              }
            />
            <BottomNavigationAction
              disableRipple
              value="add"
              icon={
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    bgcolor: mode === 'dark' ? '#ffffff' : '#111111',
                    color: mode === 'dark' ? '#000000' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: mode === 'dark' ? '0 4px 14px rgba(255, 255, 255, 0.16)' : '0 4px 12px rgba(0, 0, 0, 0.14)',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                    '&:active': {
                      transform: 'scale(0.93)',
                    },
                  }}
                >
                  <Plus size={22} strokeWidth={2.6} />
                </Box>
              }
              sx={{
                '& .MuiBottomNavigationAction-label': {
                  display: 'none !important',
                },
              }}
            />
            <BottomNavigationAction
              disableRipple
              value="friends"
              label="Contacts"
              icon={
                <Box
                  sx={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 50,
                    height: 28,
                    borderRadius: '999px',
                  }}
                >
                  {bottomNavValue === 'friends' && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-neutral-800 rounded-full"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 9999,
                        backgroundColor: mode === 'dark' ? '#27272a' : '#e4e4e7',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: bottomNavValue === 'friends' ? (mode === 'dark' ? '#ffffff' : '#111111') : (mode === 'dark' ? '#71717a' : '#8e8e93'),
                    }}
                  >
                    <Users size={19} />
                  </Box>
                </Box>
              }
            />
            <BottomNavigationAction
              disableRipple
              value="more"
              label="More"
              icon={
                <Box
                  sx={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 50,
                    height: 28,
                    borderRadius: '999px',
                  }}
                >
                  {bottomNavValue === 'more' && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-neutral-800 rounded-full"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 9999,
                        backgroundColor: mode === 'dark' ? '#27272a' : '#e4e4e7',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: bottomNavValue === 'more' ? (mode === 'dark' ? '#ffffff' : '#111111') : (mode === 'dark' ? '#71717a' : '#8e8e93'),
                    }}
                  >
                    <MoreHorizontal size={19} />
                  </Box>
                </Box>
              }
            />
          </BottomNavigation>
        </Paper>
      )}

      {/* Memento Elevated Sheet / Drawer */}
      <Drawer
        anchor="bottom"
        open={moreOpen && isMobile}
        onClose={() => setMoreOpen(false)}
        disableAutoFocus
        disableRestoreFocus
        ModalProps={{
          BackdropProps: {
            sx: {
              bgcolor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }
          }
        }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            bgcolor: mode === 'dark' ? '#121212' : '#ffffff',
            backgroundImage: 'none',
            p: { xs: 3, sm: 3.5 },
            pb: 'calc(28px + env(safe-area-inset-bottom, 0px))',
            height: 'auto',
            maxHeight: '92vh',
            borderTop: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e5e7eb',
            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
          }
        }}
      >
        <Box sx={{ width: 38, height: 4, bgcolor: '#323540', borderRadius: '9999px', mx: 'auto', mb: 2.5 }} />

        {/* Header close button: hidden on mobile drawer, shown on desktop */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'flex-end', mb: 1 }}>
          <IconButton size="small" onClick={() => setMoreOpen(false)} sx={{ bgcolor: 'action.hover' }}>
            <X size={18} />
          </IconButton>
        </Box>

        {/* Quick AI Assistant Card if enabled - Perfect alignment and squircle icon tile */}
        {enableAIAssistant && (
          <Paper
            elevation={0}
            onClick={() => { setMoreOpen(false); setShowAIAssistant(true); }}
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: '16px',
              bgcolor: 'var(--surface2)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, background-color 0.2s ease',
              '&:active': { transform: 'scale(0.98)' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                color: 'text.primary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Sparkles size={20} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.88rem', lineHeight: 1.3 }}>
                  Ask Max AI Assistant
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.74rem', lineHeight: 1.2, mt: 0.2 }}>
                  Smart expense logging & insights
                </Typography>
              </Box>
            </Box>
            <Box sx={{
              width: 32,
              height: 32,
              borderRadius: '10px',
              bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ChevronRight size={18} />
            </Box>
          </Paper>
        )}

        {/* Category Sections Grid */}
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block', px: 0.5, fontSize: '0.72rem' }}>
          Features & Modules
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.2, mb: 1.5 }}>
          {moreItems.map(item => {
            const isSelected = activeView === item.id;

            return (
              <Paper
                key={item.id}
                elevation={0}
                onClick={() => navigate(item.id)}
                sx={{
                  py: 2,
                  px: 1,
                  borderRadius: '16px',
                  bgcolor: isSelected ? 'var(--surface3)' : 'var(--surface2)',
                  border: isSelected
                    ? (mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)')
                    : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  '&:active': { transform: 'scale(0.95)' }
                }}
              >
                <Box sx={{ color: isSelected ? 'text.primary' : 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: isSelected ? 750 : 500,
                    color: isSelected ? 'text.primary' : 'text.secondary',
                    fontSize: '0.78rem',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {item.label}
                </Typography>

                {item.id === 'settlements' && pendingSettlements > 0 && (
                  <Box sx={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 10, fontWeight: 700, px: 0.8, py: 0.2,
                    bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
                    color: 'text.primary',
                    border: 'none',
                    borderRadius: '9999px',
                    lineHeight: 1,
                  }}>
                    {pendingSettlements}
                  </Box>
                )}

                {item.id === 'recurring' && dueAutopaysCount > 0 && (
                  <Box sx={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 10, fontWeight: 700, px: 0.8, py: 0.2,
                    bgcolor: 'var(--debit-bg, rgba(248, 113, 113, 0.15))',
                    color: 'var(--debit, #ef4444)',
                    border: 'none',
                    borderRadius: '9999px',
                    lineHeight: 1,
                  }}>
                    {dueAutopaysCount}
                  </Box>
                )}
              </Paper>
            );
          })}

          {/* User guide shortcut - only shown if enabled in dev mode */}
          {enableUserGuide && (
            <Paper
              elevation={0}
              onClick={() => { setMoreOpen(false); setShowGuideModal(true); }}
              sx={{
                py: 2,
                px: 1,
                borderRadius: '16px',
                bgcolor: 'var(--surface2)',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:active': { transform: 'scale(0.95)' }
              }}
            >
              <Box sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HelpCircle size={20} />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.78rem', lineHeight: 1.2 }}>
                User Guide
              </Typography>
            </Paper>
          )}
        </Box>

        {/* Bottom Row Controls - Theme card aligned with surface2 cards */}
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: '12px 16px',
            borderRadius: '16px',
            bgcolor: 'var(--surface2)',
            border: 'none',
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.88rem' }}>
            Theme: <span style={{ fontWeight: 700 }}>{mode === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </Typography>
          <IconButton
            size="small"
            onClick={handleToggleDark}
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              border: 'none',
              color: 'text.primary',
              '&:hover': { bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }
            }}
          >
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </Paper>
      </Drawer>

      {/* Floating Action Buttons (Search & AI Assistant) */}
      <FloatingSearchButton
        onClick={() => setShowSearchModal(true)}
        hasAIAssistant={enableAIAssistant}
        onAIClick={() => setShowAIAssistant(true)}
        hideSearchButton={true}
      />

      {/* Contextual & Universal Search Modal */}
      <ContextualSearchModal
        open={showSearchModal}
        onClose={() => {
          setShowSearchModal(false);
          setSearchInitialQuery('');
          setSearchInitialTab(undefined);
        }}
        activeView={view}
        onNavigate={navigate}
        initialQuery={searchInitialQuery}
        initialTab={searchInitialTab}
      />

      <AnimatePresence>
        {showAddExpense && (
          <ExpenseModal
            key="expense-modal"
            initialData={addExpenseInitialData || undefined}
            isTutorialMode={isExpenseTutorial}
            onClose={() => {
              setShowAddExpense(false);
              setAddExpenseInitialData(null);
              setIsExpenseTutorial(false);
            }}
          />
        )}
        {showAIAssistant && (
          <AIAssistantModal
            key="ai-assistant-modal"
            open={showAIAssistant}
            onClose={() => setShowAIAssistant(false)}
            onOpenAddExpense={(initialData) => {
              setAddExpenseInitialData(initialData || null);
              setShowAddExpense(true);
              setShowAIAssistant(false);
            }}
          />
        )}
        {showGuideModal && (
          <UserGuideModal
            key="user-guide-modal"
            open={showGuideModal}
            onClose={() => setShowGuideModal(false)}
            onNavigate={navigate}
            onAddExpense={() => setShowAddExpense(true)}
            onStartExpenseTutorial={handleStartExpenseTutorial}
          />
        )}
        {isAppLocked && isSecurityLockActive && (
          <SecurityLockModal
            key="security-lock-modal"
            onUnlock={handleUnlock}
            savedPin={db.settings?.securityPin || ''}
            enableBiometricLock={Boolean(db.settings?.enableBiometricLock && db.settings?.securityPin)}
            autoUnlockOnFace={db.settings?.autoUnlockOnFace ?? false}
          />
        )}
      </AnimatePresence>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}
