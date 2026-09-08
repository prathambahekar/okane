import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useMediaQuery } from './hooks/useMediaQuery';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  ReceiptText,
  Wallet,
  Users,
  User,
  Handshake,
  BarChart3,
  Settings as SettingsIconLucide,
  Plus,
  MoreHorizontal,
  Moon,
  Sun,
  RefreshCw,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Database,
  ChevronDown,
  Plane,
  ArrowLeft,
  HelpCircle,
  Search,
  Filter,
} from 'lucide-react';
import { StoreProvider, useStore } from './store';
import { useColorMode, type AccentPreset } from './theme';
import type { ViewName } from './types';
import { expenseFlow, friendBalance, todayISO, monthKey } from './db';
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
import ContextualSearchModal from './components/ContextualSearchModal';
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
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isExpenseTutorial, setIsExpenseTutorial] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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

  const isSecurityLockActive = Boolean(db.settings?.enableSecurityLock ?? db.settings?.enableBiometricLock);
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
    const autoOpen = db.settings?.autoOpenKeyboard ?? true;
    if (!autoOpen) return;

    const handleInputInteraction = (e: Event) => {
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
      showSoftKeyboard(target, { placeCursorAtEnd: true, scroll: true });
    };

    document.addEventListener('focusin', handleInputInteraction, true);
    document.addEventListener('click', handleInputInteraction, true);
    return () => {
      document.removeEventListener('focusin', handleInputInteraction, true);
      document.removeEventListener('click', handleInputInteraction, true);
    };
  }, [db.settings?.autoOpenKeyboard]);

  const handleStartExpenseTutorial = () => {
    setShowGuideModal(false);
    setIsExpenseTutorial(true);
    setShowAddExpense(true);
  };
  const { mode, setMode, toggleMode: toggleDark, accent, setAccent, customColor, setCustomColor } = useColorMode();
  const isMobile = useMediaQuery('(max-width: 899.95px)');

  const sidebarCollapsed = db.settings?.sidebarCollapsed ?? (localStorage.getItem('sidebar_collapsed') === 'true');
  const floatingSidebar = db.settings?.floatingSidebar ?? (localStorage.getItem('sidebar_floating') === 'true');

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
    if (db.settings?.accent && db.settings.accent !== accent) {
      setAccent(db.settings.accent as AccentPreset);
    }
    if (db.settings?.customAccentColor && db.settings.customAccentColor !== customColor) {
      setCustomColor(db.settings.customAccentColor);
    }
  }, [db.settings?.colorMode, db.settings?.accent, db.settings?.customAccentColor, mode, accent, customColor, setMode, setAccent, setCustomColor]);

  const isDevMode = db.settings?.devMode ?? true;
  const enableDevSQLConsole = isDevMode && (db.settings?.enableDevSQLConsole ?? true);
  const enableAIAssistant = db.settings?.enableAIAssistant ?? true;
  const searchLocation = db.settings?.searchLocation ?? 'topbar';
  const enableSplitTrips = db.settings?.enableSplitTrips ?? true;
  const enableAutopay = db.settings?.enableAutopay ?? false;
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

  const spendingMode = db.settings?.spendingMode || 'all';

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

  const showFilterInTopbar = ['expenses', 'friends', 'settlements'].includes(view);

  const { expenses, friends, currency } = useMemo(() => ({
    expenses: db.expenses,
    friends: db.friends,
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
  const friendCredit = useMemo(() => friends.reduce((s, f) => (f.type || 'friend') === 'friend' ? s + Math.max(0, friendBalance(db, f.id).net) : s, 0), [friends, db]);
  const friendDebt = useMemo(() => friends.reduce((s, f) => (f.type || 'friend') === 'friend' ? s + Math.max(0, -friendBalance(db, f.id).net) : s, 0), [friends, db]);

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
        { id: 'dashboard' as ViewName, label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
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
        ...(enableSplitTrips ? [{ id: 'split-trips' as ViewName, label: 'Trips & Splits', icon: <Plane size={18} /> }] : []),
      ]
    },
    {
      title: 'Insights',
      items: [
        { id: 'analytics' as ViewName, label: 'Analytics', icon: <BarChart3 size={18} /> },
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
    ...(enableSplitTrips ? [{ id: 'split-trips' as ViewName, label: 'Trips & Splits', icon: <Plane size={20} /> }] : []),
    ...(enableAutopay ? [{ id: 'recurring' as ViewName, label: 'Autopay', icon: <RefreshCw size={20} /> }] : []),
    { id: 'wallets', label: 'Wallets', icon: <Wallet size={20} /> },
    { id: 'settlements', label: 'Settlements', icon: <Handshake size={20} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIconLucide size={20} /> },
    ...(enableDevSQLConsole ? [{ id: 'dev-sql' as ViewName, label: 'Dev SQL Console', icon: <Database size={20} /> }] : []),
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
      case 'friend-detail': return <FriendDetail friendId={friendDetailId} onNavigate={navigate} />;
      case 'recurring':
        return <Recurring onNavigate={navigate} initialArg={viewArg} onClearViewArg={clearViewArg} />;
      case 'settlements': return <Settlements initialArg={viewArg} onClearViewArg={clearViewArg} />;
      case 'split-trips': return <SplitTrips initialArg={viewArg} onClearViewArg={clearViewArg} />;
      case 'analytics': return <Analytics />;
      case 'settings':
        return (
          <Settings onNavigate={navigate} onOpenGuide={() => setShowGuideModal(true)} onStartExpenseTutorial={handleStartExpenseTutorial} initialArg={viewArg} onClearViewArg={clearViewArg} onTestLock={() => setIsAppLocked(true)} />
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
            {!sidebarCollapsed && (
              <div>
                <div className="sidebar-logo-text">Okane</div>
                <div className="sidebar-logo-sub">おかね</div>
              </div>
            )}
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface3)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
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
                      <span className="nav-section-chevron">
                        <ChevronDown size={12} />
                      </span>
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
              className="btn btn-primary btn-sm"
              style={{
                margin: sidebarCollapsed ? '8px auto 4px' : '8px 0 4px',
                width: sidebarCollapsed ? 36 : '100%',
                height: 38,
                padding: sidebarCollapsed ? 0 : '8px 12px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: sidebarCollapsed ? 0 : 6,
                flexShrink: 0,
              }}
              onClick={() => setShowAddExpense(true)}
              title={sidebarCollapsed ? "Add Expense" : undefined}
            >
              <Plus size={18} />
              <span className="nav-item-label">Add Expense</span>
            </button>
          </div>

          <div className="nav-section-divider" style={{ margin: sidebarCollapsed ? '4px 6px 4px 6px' : '4px 10px 4px 10px' }} />

          <div className="sidebar-footer">
            <div className="sidebar-footer-actions" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', gap: 6 }}>
              <NotificationBell onNavigate={navigate} placement="top-left" />
              <button
                type="button"
                onClick={handleToggleDark}
                className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-[var(--text-2)] hover:text-[var(--text)] hover:rotate-12 transition-all active:scale-90 flex items-center justify-center"
                title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}
                aria-label="Toggle color theme"
              >
                {mode === 'dark'
                  ? <Sun size={18} />
                  : <Moon size={18} />}
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Mobile top Header */}
      {isMobile && (
        <header
          className="fixed top-0 left-0 right-0 z-40 bg-[var(--bg)] text-[var(--text)] transition-colors duration-200"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="h-11 sm:h-14 px-3 flex items-center justify-between gap-2">
            {/* Left side: Back button or Branded view title */}
            <div className="flex items-center gap-2 min-w-0 flex-shrink">
              {view === 'friend-detail' ? (
                <button
                  type="button"
                  onClick={() => setView('friends')}
                  className="p-2 rounded-xl text-[var(--text)] bg-black/5 dark:bg-white/10 active:scale-95 flex items-center justify-center transition-transform"
                  title="Back to Contacts"
                >
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                  {view === 'dashboard' ? <LayoutDashboard size={18} /> :
                   view === 'expenses' ? <ReceiptText size={18} /> :
                   view === 'friends' ? <Users size={18} /> :
                   view === 'wallets' ? <Wallet size={18} /> :
                   view === 'recurring' ? <RefreshCw size={18} /> :
                   view === 'settlements' ? <Handshake size={18} /> :
                   view === 'split-trips' ? <Plane size={18} /> :
                   view === 'analytics' ? <BarChart3 size={18} /> :
                   view === 'settings' ? <SettingsIconLucide size={18} /> :
                   view === 'dev-sql' ? <Database size={18} /> :
                   <LayoutDashboard size={18} />}
                </div>
              )}

              <div className="min-w-0">
                <span className="font-bold text-sm sm:text-base tracking-tight truncate block leading-tight">
                  {view === 'dashboard' ? 'Dashboard' :
                   view === 'expenses' ? 'Expenses' :
                   view === 'friends' ? 'Contacts' :
                   view === 'friend-detail' ? 'Contact Details' :
                   view === 'wallets' ? 'Wallets' :
                   view === 'recurring' ? 'Autopay' :
                   view === 'analytics' ? 'Analytics' :
                   view === 'settlements' ? 'Settlements' :
                   view === 'split-trips' ? 'Trips & Splits' :
                   view === 'settings' ? 'Settings' :
                   view === 'dev-sql' ? 'Dev SQL' : 'Dashboard'}
                </span>
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Quick financial summaries */}
              {view === 'expenses' && (
                <div className="hidden sm:flex items-center gap-1.5 max-w-[320px] overflow-x-auto no-scrollbar">
                  <span
                    title={`-${fmtMoney(expOut, currency)}`}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-500/15 text-[var(--debit)] text-xs font-semibold whitespace-nowrap truncate max-w-[160px]"
                  >
                    -{fmtMoney(expOut, currency)}
                  </span>
                  <span
                    title={`+${fmtMoney(expIn, currency)}`}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-500/15 text-[var(--credit)] text-xs font-semibold whitespace-nowrap truncate max-w-[160px]"
                  >
                    +{fmtMoney(expIn, currency)}
                  </span>
                </div>
              )}

              {view === 'friends' && (
                <div className="hidden sm:flex items-center gap-1.5 max-w-[320px] overflow-x-auto no-scrollbar">
                  <span
                    title={`+${fmtMoney(friendCredit, currency)}`}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-500/15 text-[var(--credit)] text-xs font-semibold whitespace-nowrap truncate max-w-[160px]"
                  >
                    +{fmtMoney(friendCredit, currency)}
                  </span>
                  <span
                    title={`-${fmtMoney(friendDebt, currency)}`}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-500/15 text-[var(--debit)] text-xs font-semibold whitespace-nowrap truncate max-w-[160px]"
                  >
                    -{fmtMoney(friendDebt, currency)}
                  </span>
                </div>
              )}

              {view === 'analytics' && (
                <div className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = spendingMode === 'all' ? 'me' : 'all';
                      updateSettings({ spendingMode: nextMode });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                      spendingMode === 'me'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]'
                        : 'bg-[var(--surface2)] text-[var(--text)] border-[var(--border)]'
                    }`}
                  >
                    {spendingMode === 'me' ? <User size={14} className="text-[var(--accent)]" /> : <Users size={14} />}
                    <span>{spendingMode === 'me' ? 'Just Me' : 'All Expenses'}</span>
                  </button>
                </div>
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
                    background: topbarFilterCount > 0 ? 'var(--accent-soft)' : 'var(--surface2)',
                    border: `1px solid ${topbarFilterCount > 0 ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: topbarFilterCount > 0 ? 'var(--accent)' : 'var(--text)',
                    flexShrink: 0,
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  title={topbarFilterCount > 0 ? `${topbarFilterCount} active filters` : "Filters & Sorting"}
                  aria-label="Filters & Sorting"
                >
                  <Filter size={17} />
                  {topbarFilterCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -3,
                        right: -3,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 999,
                        background: 'var(--accent)',
                        color: 'var(--accent-contrast, #ffffff)',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        lineHeight: 1,
                        border: '1.5px solid var(--surface)',
                      }}
                    >
                      {topbarFilterCount}
                    </span>
                  )}
                </button>
              )}

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
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
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
                  <Search size={17} />
                </button>
              )}

              <NotificationBell onNavigate={navigate} />
            </div>
          </div>
        </header>
      )}

      <main className={`main-content${isMobile ? ' mobile-layout' : ''}`}>
        <div key={view} className="view-page-animate">
          {renderView()}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)] border-t border-[var(--border)] h-[62px] flex items-center justify-around px-2 shadow-lg"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all ${
              bottomNavValue === 'dashboard' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            <LayoutDashboard size={20} className={bottomNavValue === 'dashboard' ? 'scale-110 drop-shadow-sm' : ''} />
            <span className="text-[11px] mt-0.5">Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('expenses')}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all ${
              bottomNavValue === 'expenses' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            <ReceiptText size={20} className={bottomNavValue === 'expenses' ? 'scale-110 drop-shadow-sm' : ''} />
            <span className="text-[11px] mt-0.5">Expenses</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddExpense(true)}
            className="flex items-center justify-center flex-shrink-0 -mt-3 mx-1 w-11 h-11 rounded-full bg-[var(--accent)] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
            aria-label="Add expense"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            onClick={() => navigate('friends')}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all relative ${
              bottomNavValue === 'friends' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            <div className="relative inline-flex">
              <Users size={20} className={bottomNavValue === 'friends' ? 'scale-110 drop-shadow-sm' : ''} />
              {pendingSettlements > 0 && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[var(--accent)]" />
              )}
            </div>
            <span className="text-[11px] mt-0.5">Contacts</span>
          </button>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all relative ${
              bottomNavValue === 'more' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            <div className="relative inline-flex">
              <MoreHorizontal size={20} className={bottomNavValue === 'more' ? 'scale-110 drop-shadow-sm' : ''} />
              {(dueAutopaysCount > 0 || pendingSettlements > 0) && (
                <span className={`absolute -top-1 -right-1.5 w-2 h-2 rounded-full ${dueAutopaysCount > 0 ? 'bg-rose-500' : 'bg-[var(--accent)]'}`} />
              )}
            </div>
            <span className="text-[11px] mt-0.5">More</span>
          </button>
        </nav>
      )}

      {/* More drawer sheet */}
      <AnimatePresence>
        {moreOpen && isMobile && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className="w-full bg-[var(--surface)] text-[var(--text)] rounded-t-2xl border-t border-[var(--border)] p-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="w-9 h-1 bg-[var(--border2)] rounded-full mx-auto mb-4" />

              {/* Quick AI Assistant Card if enabled */}
              {enableAIAssistant && (
                <div
                  onClick={() => { setMoreOpen(false); setShowAIAssistant(true); }}
                  className="p-3 mb-4 rounded-xl bg-[var(--accent-soft)] border border-[var(--border)] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center shadow-md">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[var(--text)]">
                        Ask Max AI Assistant
                      </div>
                      <div className="text-xs text-[var(--text-2)]">
                        Smart expense logging & insights
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-[var(--accent)] text-white text-xs font-bold">
                    Open
                  </span>
                </div>
              )}

              {/* Category Sections Grid */}
              <div className="text-xs uppercase tracking-wider font-bold text-[var(--text-3)] mb-2.5">
                Features & Modules
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {moreItems.map(item => {
                  const isSelected = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.id)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center relative transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                          : 'bg-[var(--surface2)] border-[var(--border)] text-[var(--text)]'
                      }`}
                    >
                      <div>{item.icon}</div>
                      <span className={`text-xs font-medium leading-tight ${isSelected ? 'font-bold text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                        {item.label}
                      </span>

                      {item.id === 'settlements' && pendingSettlements > 0 && (
                        <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent)] text-white rounded">
                          {pendingSettlements}
                        </span>
                      )}

                      {item.id === 'recurring' && dueAutopaysCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 bg-rose-500 text-white rounded">
                          {dueAutopaysCount}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* User guide shortcut - only shown if enabled in dev mode */}
                {enableUserGuide && (
                  <button
                    type="button"
                    onClick={() => { setMoreOpen(false); setShowGuideModal(true); }}
                    className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface2)] flex flex-col items-center justify-center gap-2 text-center transition-all active:scale-95 text-[var(--text)]"
                  >
                    <HelpCircle size={20} />
                    <span className="text-xs font-medium leading-tight">
                      User Guide
                    </span>
                  </button>
                )}
              </div>

              {/* Bottom Row Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-xs text-[var(--text-3)]">
                <span>
                  Theme: <strong className="text-[var(--text)]">{mode === 'dark' ? 'Dark Mode' : 'Light Mode'}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleToggleDark}
                  className="p-2 rounded-lg bg-[var(--surface2)] text-[var(--text)] hover:bg-[var(--surface3)] transition-colors"
                  aria-label="Toggle color mode"
                >
                  {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons (Search & AI Assistant) */}
      <FloatingSearchButton
        onClick={() => setShowSearchModal(true)}
        hasAIAssistant={enableAIAssistant}
        onAIClick={() => setShowAIAssistant(true)}
        hideSearchButton={isMobile && searchLocation === 'topbar'}
      />

      {/* Contextual & Universal Search Modal */}
      <ContextualSearchModal
        open={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        activeView={view}
        onNavigate={navigate}
      />

      {showAddExpense && (
        <ExpenseModal
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
          open={showGuideModal}
          onClose={() => setShowGuideModal(false)}
          onNavigate={navigate}
          onAddExpense={() => setShowAddExpense(true)}
          onStartExpenseTutorial={handleStartExpenseTutorial}
        />
      )}
      {isAppLocked && isSecurityLockActive && (
        <SecurityLockModal
          onUnlock={handleUnlock}
          savedPin={db.settings?.securityPin || ''}
          enableBiometricLock={db.settings?.enableBiometricLock ?? true}
          autoUnlockOnFace={db.settings?.autoUnlockOnFace ?? false}
        />
      )}
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
