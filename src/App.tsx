import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  X,
  HelpCircle,
  Search,
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
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

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
            <IconButton
              size="small"
              onClick={toggleSidebar}
              sx={{ 
                color: 'text.secondary', 
                p: 0.8, 
                borderRadius: '10px',
                border: '1px solid var(--border)',
                bgcolor: 'var(--surface2)',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1) rotate(-4deg)',
                  bgcolor: 'action.hover',
                  borderColor: 'var(--border2)',
                },
                '&:active': {
                  transform: 'scale(0.92)',
                }
              }}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </IconButton>
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
              <IconButton
                size="small"
                onClick={handleToggleDark}
                sx={{ 
                  width: 36,
                  height: 36,
                  color: 'text.secondary',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  bgcolor: 'var(--surface2)',
                  transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.25s ease, border-color 0.2s ease',
                  '&:hover': {
                    transform: 'rotate(20deg) scale(1.1)',
                    color: 'text.primary',
                    borderColor: 'var(--border2)',
                  },
                  '&:active': {
                    transform: 'scale(0.9)',
                  }
                }}
                title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}
              >
                {mode === 'dark'
                  ? <Sun size={18} />
                  : <Moon size={18} />}
              </IconButton>
            </div>
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
          }}
        >
          <Toolbar variant="dense" sx={{ minHeight: { xs: '44px !important', sm: '56px' }, height: { xs: 44, sm: 56 }, px: 1.5, gap: 1, justifyContent: 'space-between' }}>
            {/* Left side: Back button or Branded view title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexShrink: 1 }}>
              {view === 'friend-detail' ? (
                <IconButton
                  size="small"
                  onClick={() => setView('friends')}
                  sx={{
                    color: 'text.primary',
                    bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    p: 0.8,
                    borderRadius: '10px',
                    '&:active': { transform: 'scale(0.92)' }
                  }}
                  title="Back to Contacts"
                >
                  <ArrowLeft size={18} />
                </IconButton>
              ) : (
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '10px',
                    bgcolor: 'var(--accent-soft)',
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
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
                </Box>
              )}

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h6"
                  component="span"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '0.98rem', sm: '1.05rem' },
                    letterSpacing: '-0.3px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                    lineHeight: 1.2,
                  }}
                >
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


              {view === 'analytics' && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = spendingMode === 'all' ? 'me' : 'all';
                      updateSettings({ spendingMode: nextMode });
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      borderRadius: 999,
                      background: spendingMode === 'me' ? 'var(--accent-soft)' : 'var(--surface2)',
                      color: spendingMode === 'me' ? 'var(--accent)' : 'var(--text)',
                      border: '1px solid',
                      borderColor: spendingMode === 'me' ? 'var(--accent)' : 'var(--border)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {spendingMode === 'me' ? <User size={14} style={{ color: 'var(--accent)' }} /> : <Users size={14} />}
                    <span>{spendingMode === 'me' ? 'Just Me' : 'All Expenses'}</span>
                  </button>
                </Box>
              )}

              {searchLocation === 'topbar' && (
                <IconButton
                  size="small"
                  onClick={() => setShowSearchModal(true)}
                  sx={{
                    color: 'text.primary',
                    bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    p: 0.8,
                    borderRadius: '10px',
                    transition: 'transform 0.15s ease, background-color 0.15s ease',
                    '&:hover': {
                      bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                    },
                    '&:active': { transform: 'scale(0.92)' }
                  }}
                  title="Search (Ctrl + K)"
                  aria-label="Search"
                >
                  <Search size={18} />
                </IconButton>
              )}

              <NotificationBell onNavigate={navigate} />
            </Box>
          </Toolbar>
        </AppBar>
      )}

      <main className={`main-content${isMobile ? ' mobile-layout' : ''}`}>
        <div key={view} className="view-page-animate">
          {renderView()}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            pb: 'env(safe-area-inset-bottom, 0px)',
            bgcolor: 'background.paper',
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
            showLabels
            sx={{
              height: 62,
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                padding: '6px 0',
                transition: 'color 0.25s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.72rem',
                  transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease, font-weight 0.2s ease, color 0.25s ease',
                  fontWeight: 400,
                  mt: 0.2,
                },
                '& .MuiSvgIcon-root, & svg': {
                  transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease, opacity 0.2s ease',
                },
                '&:hover .MuiSvgIcon-root, &:hover svg': {
                  transform: 'translateY(-2px) scale(1.14)',
                },
                '&.Mui-selected': {
                  color: 'primary.main',
                  '& .MuiBottomNavigationAction-label': {
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    transform: 'translateY(-1px)',
                  },
                  '& .MuiSvgIcon-root, & svg': {
                    transform: 'translateY(-3px) scale(1.18)',
                    filter: 'drop-shadow(0 3px 6px var(--accent-soft))',
                  },
                },
                '&:active .MuiSvgIcon-root, &:active svg': {
                  transform: 'scale(0.92)',
                },
              },
            }}
          >
            <BottomNavigationAction label="Dashboard" icon={<LayoutDashboard size={20} />} value="dashboard" />
            <BottomNavigationAction label="Expenses" icon={<ReceiptText size={20} />} value="expenses" />
            <BottomNavigationAction
              value="add"
              icon={
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px var(--accent-soft)',
                    transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, background-color 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-3px) scale(1.1) rotate(90deg)',
                      boxShadow: '0 6px 20px var(--accent-soft)',
                    },
                    '&:active': {
                      transform: 'scale(0.92) rotate(90deg)',
                    },
                  }}
                >
                  <Plus size={22} strokeWidth={2.5} />
                </Box>
              }
              sx={{
                '& .MuiBottomNavigationAction-label': {
                  display: 'none',
                },
              }}
            />
            <BottomNavigationAction
              label="Contacts"
              icon={
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <Users size={20} />
                  {pendingSettlements > 0 && (
                    <Box sx={{
                      position: 'absolute', top: -2, right: -4,
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: 'primary.main'
                    }} />
                  )}
                </Box>
              }
              value="friends"
            />
            <BottomNavigationAction
              label="More"
              icon={
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <MoreHorizontal size={20} />
                  {(dueAutopaysCount > 0 || pendingSettlements > 0) && (
                    <Box sx={{
                      position: 'absolute', top: -2, right: -4,
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: dueAutopaysCount > 0 ? 'error.main' : 'primary.main'
                    }} />
                  )}
                </Box>
              }
              value="more"
            />
          </BottomNavigation>
        </Paper>
      )}

      {/* More drawer sheet */}
      <Drawer
        anchor="bottom"
        open={moreOpen && isMobile}
        onClose={() => setMoreOpen(false)}
        disableAutoFocus
        disableRestoreFocus
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            p: 2.5,
            pb: 'calc(24px + env(safe-area-inset-bottom, 0px))',
            maxHeight: '85vh',
            borderTop: '1px solid var(--border)',
          }
        }}
      >
        <Box sx={{ width: 36, height: 4, bgcolor: 'divider', borderRadius: '2px', mx: 'auto', mb: 2 }} />

        {/* Header close button: hidden on mobile drawer, shown on desktop */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'flex-end', mb: 1 }}>
          <IconButton size="small" onClick={() => setMoreOpen(false)} sx={{ bgcolor: 'action.hover' }}>
            <X size={18} />
          </IconButton>
        </Box>

        {/* Quick AI Assistant Card if enabled */}
        {enableAIAssistant && (
          <Paper
            elevation={0}
            onClick={() => { setMoreOpen(false); setShowAIAssistant(true); }}
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: '10px',
              bgcolor: 'var(--accent-soft)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, filter 0.2s ease',
              '&:active': { transform: 'scale(0.98)' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '8px',
                bgcolor: 'primary.main', color: 'primary.contrastText',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px var(--accent-soft)'
              }}>
                <Sparkles size={18} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Ask Max AI Assistant
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Smart expense logging & insights
                </Typography>
              </Box>
            </Box>
            <Box sx={{
              px: 1.2, py: 0.4, borderRadius: '6px',
              bgcolor: 'primary.main', color: 'primary.contrastText',
              fontSize: '0.7rem', fontWeight: 700
            }}>
              Open
            </Box>
          </Paper>
        )}

        {/* Category Sections Grid */}
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}>
          Features & Modules
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.2, mb: 2 }}>
          {moreItems.map(item => {
            const isSelected = activeView === item.id;
            return (
              <Paper
                key={item.id}
                elevation={0}
                onClick={() => navigate(item.id)}
                sx={{
                  p: 1.5,
                  borderRadius: '10px',
                  bgcolor: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
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
                <Box sx={{ color: isSelected ? 'primary.main' : 'text.primary' }}>
                  {item.icon}
                </Box>
                <Typography variant="caption" sx={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? 'primary.main' : 'text.primary', fontSize: '0.75rem', lineHeight: 1.1 }}>
                  {item.label}
                </Typography>

                {item.id === 'settlements' && pendingSettlements > 0 && (
                  <Box sx={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 10, fontWeight: 700, px: 0.6, py: 0.1,
                    bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '4px',
                  }}>
                    {pendingSettlements}
                  </Box>
                )}

                {item.id === 'recurring' && dueAutopaysCount > 0 && (
                  <Box sx={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 10, fontWeight: 700, px: 0.6, py: 0.1,
                    bgcolor: 'error.main', color: '#ffffff', borderRadius: '4px',
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
                p: 1.5,
                borderRadius: '10px',
                bgcolor: 'var(--surface2)',
                border: '1px solid var(--border)',
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
              <Box sx={{ color: 'text.primary' }}>
                <HelpCircle size={20} />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary', fontSize: '0.75rem', lineHeight: 1.1 }}>
                User Guide
              </Typography>
            </Paper>
          )}
        </Box>

        {/* Bottom Row Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: '1px solid var(--border)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Theme: <strong>{mode === 'dark' ? 'Dark Mode' : 'Light Mode'}</strong>
          </Typography>
          <IconButton size="small" onClick={handleToggleDark} sx={{ bgcolor: 'var(--surface2)' }}>
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </Box>
      </Drawer>

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
