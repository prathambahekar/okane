import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useMediaQuery } from './hooks/useMediaQuery';
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
import BottomSheet from './components/common/BottomSheet';
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
          className="fixed top-0 left-0 right-0 z-40 bg-[var(--bg)]/95 backdrop-blur-md text-[var(--text)] transition-colors duration-200"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="relative h-14 px-4 sm:px-6 flex items-center justify-between gap-2 max-w-5xl mx-auto w-full">
            {/* Left side: Back button or placeholder for symmetry */}
            <div className="flex items-center gap-2 z-10 min-w-[72px]">
              {view === 'friend-detail' ? (
                <button
                  type="button"
                  onClick={() => setView('friends')}
                  className="w-9 h-9 rounded-full text-[var(--text)] bg-[var(--surface2)] hover:bg-[var(--surface3)] border border-[var(--border)] active:scale-95 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer"
                  title="Back to Contacts"
                >
                  <ArrowLeft size={18} />
                </button>
              ) : null}
            </div>

            {/* Center: Logo & View Title horizontally centered */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-20">
              <div className="flex items-center gap-2 pointer-events-auto min-w-0 max-w-[200px] sm:max-w-xs justify-center">
                <div className="w-8 h-8 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center flex-shrink-0">
                  {view === 'dashboard' ? <LayoutDashboard size={17} /> :
                   view === 'expenses' ? <ReceiptText size={17} /> :
                   view === 'friends' ? <Users size={17} /> :
                   view === 'friend-detail' ? <User size={17} /> :
                   view === 'wallets' ? <Wallet size={17} /> :
                   view === 'recurring' ? <RefreshCw size={17} /> :
                   view === 'settlements' ? <Handshake size={17} /> :
                   view === 'split-trips' ? <Plane size={17} /> :
                   view === 'analytics' ? <BarChart3 size={17} /> :
                   view === 'settings' ? <SettingsIconLucide size={17} /> :
                   view === 'dev-sql' ? <Database size={17} /> :
                   <LayoutDashboard size={17} />}
                </div>

                <span className="font-bold text-base tracking-tight truncate block leading-tight text-[var(--text)]">
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
            <div className="flex items-center gap-2 z-10 flex-shrink-0 min-w-[72px] justify-end">
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
                <div className="hidden sm:inline-flex items-center">
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
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer active:scale-95 transition-all ${
                    topbarFilterCount > 0
                      ? 'bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--surface2)] hover:bg-[var(--surface3)] border border-[var(--border)] text-[var(--text)]'
                  }`}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('app-open-filters', { detail: { view } }));
                  }}
                  title={topbarFilterCount > 0 ? `${topbarFilterCount} active filters` : "Filters & Sorting"}
                  aria-label="Filters & Sorting"
                >
                  <Filter size={17} />
                  {topbarFilterCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center leading-none border border-[var(--surface)]">
                      {topbarFilterCount}
                    </span>
                  )}
                </button>
              )}

              {searchLocation === 'topbar' && (
                <button
                  type="button"
                  id="topbar-search-btn"
                  className="w-9 h-9 rounded-full bg-[var(--surface2)] hover:bg-[var(--surface3)] border border-[var(--border)] flex items-center justify-center text-[var(--text)] active:scale-95 transition-all flex-shrink-0 cursor-pointer"
                  onClick={() => setShowSearchModal(true)}
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
          className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg)]/95 backdrop-blur-md h-[62px] flex items-center justify-center px-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="w-full max-w-md mx-auto flex items-center justify-around">
            <button
              type="button"
              onClick={() => navigate('dashboard')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-center cursor-pointer transition-all active:scale-95 ${
                bottomNavValue === 'dashboard' ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-3)] hover:text-[var(--text)]'
              }`}
            >
              <LayoutDashboard size={20} className={bottomNavValue === 'dashboard' ? 'scale-105' : ''} />
              <span className="text-[11px] mt-0.5">Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('expenses')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-center cursor-pointer transition-all active:scale-95 ${
                bottomNavValue === 'expenses' ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-3)] hover:text-[var(--text)]'
              }`}
            >
              <ReceiptText size={20} className={bottomNavValue === 'expenses' ? 'scale-105' : ''} />
              <span className="text-[11px] mt-0.5">Expenses</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddExpense(true)}
              className="flex items-center justify-center flex-shrink-0 -mt-3.5 mx-2 w-11 h-11 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              aria-label="Add expense"
            >
              <Plus size={22} strokeWidth={2.5} />
            </button>

            <button
              type="button"
              onClick={() => navigate('friends')}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-center cursor-pointer transition-all active:scale-95 relative ${
                bottomNavValue === 'friends' ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-3)] hover:text-[var(--text)]'
              }`}
            >
              <div className="relative inline-flex">
                <Users size={20} className={bottomNavValue === 'friends' ? 'scale-105' : ''} />
                {pendingSettlements > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[var(--accent)]" />
                )}
              </div>
              <span className="text-[11px] mt-0.5">Contacts</span>
            </button>

            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-center cursor-pointer transition-all active:scale-95 relative ${
                bottomNavValue === 'more' ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-3)] hover:text-[var(--text)]'
              }`}
            >
              <div className="relative inline-flex">
                <MoreHorizontal size={20} className={bottomNavValue === 'more' ? 'scale-105' : ''} />
                {(dueAutopaysCount > 0 || pendingSettlements > 0) && (
                  <span className={`absolute -top-1 -right-1.5 w-2 h-2 rounded-full ${dueAutopaysCount > 0 ? 'bg-rose-500' : 'bg-[var(--accent)]'}`} />
                )}
              </div>
              <span className="text-[11px] mt-0.5">More</span>
            </button>
          </div>
        </nav>
      )}

      {/* More drawer sheet */}
      <BottomSheet
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More Options"
        subtitle="Features & settings"
        icon={<MoreHorizontal size={18} />}
        maxWidth="max-w-lg"
        footer={
          <div className="flex items-center justify-between text-xs text-[var(--text-3)] py-1">
            <span className="font-medium">
              Theme: <strong className="text-[var(--text)] font-semibold">{mode === 'dark' ? 'Dark Mode' : 'Light Mode'}</strong>
            </span>
            <button
              type="button"
              onClick={handleToggleDark}
              className="px-3 py-1.5 rounded-full bg-[var(--surface2)] text-[var(--text)] hover:bg-[var(--surface3)] border border-[var(--border)] transition-all active:scale-95 flex items-center gap-1.5 font-medium cursor-pointer"
              aria-label="Toggle color mode"
            >
              {mode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{mode === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {/* Quick AI Assistant Card if enabled */}
          {enableAIAssistant && (
            <div
              onClick={() => { setMoreOpen(false); setShowAIAssistant(true); }}
              className="p-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 hover:border-[var(--accent)]/60 flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-[var(--text)] truncate">
                    Ask Max AI Assistant
                  </div>
                  <div className="text-[11px] text-[var(--text-2)] truncate">
                    Smart expense logging & insights
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[var(--accent)] text-white text-[11px] font-bold shadow-xs flex-shrink-0">
                Open
              </span>
            </div>
          )}

          {/* Category Sections Grid */}
          <div className="text-[10.5px] uppercase tracking-wider font-bold text-[var(--text-3)]">
            Features & Modules
          </div>

          <div className="grid grid-cols-3 gap-2">
            {moreItems.map(item => {
              const isSelected = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(item.id);
                  }}
                  className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center relative transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] shadow-xs font-semibold'
                      : 'bg-[var(--surface2)] hover:bg-[var(--surface3)] border-[var(--border)] text-[var(--text)]'
                  }`}
                >
                  <div className="w-6 h-6 flex items-center justify-center">{item.icon}</div>
                  <span className={`text-[11px] leading-tight truncate max-w-full px-0.5 ${isSelected ? 'font-bold text-[var(--accent)]' : 'font-medium text-[var(--text)]'}`}>
                    {item.label}
                  </span>

                  {item.id === 'settlements' && pendingSettlements > 0 && (
                    <span className="absolute top-1.5 right-1.5 text-[9.5px] font-bold px-1.5 py-0.2 bg-[var(--accent)] text-white rounded-full">
                      {pendingSettlements}
                    </span>
                  )}

                  {item.id === 'recurring' && dueAutopaysCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 text-[9.5px] font-bold px-1.5 py-0.2 bg-rose-500 text-white rounded-full">
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
                className="py-3 px-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)] hover:bg-[var(--surface3)] flex flex-col items-center justify-center gap-1.5 text-center transition-all active:scale-95 text-[var(--text)] cursor-pointer"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <HelpCircle size={18} />
                </div>
                <span className="text-[11px] font-medium leading-tight truncate max-w-full px-0.5 text-[var(--text)]">
                  User Guide
                </span>
              </button>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Floating Action Buttons (Search & AI Assistant) */}
      {!moreOpen && !showAddExpense && !showAIAssistant && !showSearchModal && (
        <FloatingSearchButton
          onClick={() => setShowSearchModal(true)}
          hasAIAssistant={enableAIAssistant}
          onAIClick={() => setShowAIAssistant(true)}
          hideSearchButton={isMobile && searchLocation === 'topbar'}
        />
      )}

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
