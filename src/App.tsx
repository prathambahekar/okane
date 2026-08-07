import { useState, useMemo, useEffect } from 'react';
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
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import {
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
  TrendingUp,
  TrendingDown,
  RefreshCw,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Database,
  ChevronDown,
  Plane,
} from 'lucide-react';
import { StoreProvider, useStore } from './store';
import { useColorMode, type AccentPreset } from './theme';
import type { ViewName } from './types';
import { expenseFlow, friendBalance, totalWalletBalance, todayISO, monthKey } from './db';
import { fmtMoney } from './utils';
import Dashboard from './views/Dashboard';
import Expenses from './views/Expenses';
import Wallets from './views/Wallets';
import Friends from './views/Friends';
import FriendDetail from './views/FriendDetail';
import Settlements from './views/Settlements';
import Analytics from './views/Analytics';
import Settings from './views/Settings';
import Recurring from './views/Recurring';
import DevSQLConsole from './views/DevSQLConsole';
import SplitTrips from './views/SplitTrips';
import ExpenseModal from './components/ExpenseModal';
import type { ExpenseInitialData } from './components/ExpenseModal';
import AIAssistantModal from './components/AIAssistantModal';
import Toast from './components/Toast';
import NotificationBell from './components/NotificationBell';
import './styles.css';

const MORE_IDS: ViewName[] = ['wallets', 'settlements', 'split-trips', 'recurring', 'analytics', 'settings', 'dev-sql'];

function AppInner() {
  const { db, updateSettings } = useStore();
  const [view, setView] = useState<ViewName>('dashboard');
  const [friendDetailId, setFriendDetailId] = useState<string>('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [addExpenseInitialData, setAddExpenseInitialData] = useState<ExpenseInitialData | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { mode, setMode, toggleMode: toggleDark, accent, setAccent, customColor, setCustomColor } = useColorMode();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const sidebarCollapsed = db.settings?.sidebarCollapsed ?? (localStorage.getItem('sidebar_collapsed') === 'true');

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
  const enableAIAssistant = isDevMode && (db.settings?.enableAIAssistant ?? true);
  const enableSplitTrips = db.settings?.enableSplitTrips ?? true;

  useEffect(() => {
    if (view === 'split-trips' && !enableSplitTrips) {
      const timer = setTimeout(() => setView('dashboard'), 0);
      return () => clearTimeout(timer);
    }
  }, [view, enableSplitTrips]);

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
  const friendCredit = useMemo(() => friends.reduce((s, f) => s + Math.max(0, friendBalance(db, f.id).net), 0), [friends, db]);
  const friendDebt = useMemo(() => friends.reduce((s, f) => s + Math.max(0, -friendBalance(db, f.id).net), 0), [friends, db]);
  const totalBal = useMemo(() => totalWalletBalance(db), [db]);

  const navigate = (v: ViewName, arg?: string) => {
    setView(v);
    if (v === 'friend-detail' && arg) setFriendDetailId(arg);
    setMoreOpen(false);

    const targetView = v === 'friend-detail' ? 'friends' : v;
    const sectionTitle = sidebarNavSections.find(sec => sec.items.some(item => item.id === targetView))?.title;
    if (sectionTitle && collapsedSections[sectionTitle]) {
      setCollapsedSections(prev => {
        const next = { ...prev, [sectionTitle]: false };
        try {
          localStorage.setItem('collapsed_sections', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('collapsed_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

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

  const pendingSettlements = db.friends.filter(f =>
    db.expenses.some(e => e.friendId === f.id && !e.settled && e.type !== 'personal')
  ).length;

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
        { id: 'recurring' as ViewName, label: 'Autopay', icon: <RefreshCw size={18} />, badge: dueAutopaysCount, badgeColor: '#d32f2f', badgeBg: 'rgba(239, 83, 80, 0.15)' },
        { id: 'wallets' as ViewName, label: 'Wallets', icon: <Wallet size={18} /> },
      ]
    },
    {
      title: 'Social',
      items: [
        { id: 'friends' as ViewName, label: 'Contacts', icon: <Users size={18} /> },
        { id: 'settlements' as ViewName, label: 'Settlements', icon: <Handshake size={18} />, badge: pendingSettlements, badgeColor: 'var(--accent)', badgeBg: 'var(--accent-soft)' },
        ...(enableSplitTrips ? [{ id: 'split-trips' as ViewName, label: 'Split & Trips', icon: <Plane size={18} /> }] : []),
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
    ...(enableSplitTrips ? [{ id: 'split-trips' as ViewName, label: 'Split & Trips', icon: <Plane size={20} /> }] : []),
    { id: 'recurring', label: 'Autopay', icon: <RefreshCw size={20} /> },
    { id: 'wallets', label: 'Wallets', icon: <Wallet size={20} /> },
    { id: 'settlements', label: 'Settlements', icon: <Handshake size={20} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIconLucide size={20} /> },
    ...(enableDevSQLConsole ? [{ id: 'dev-sql' as ViewName, label: 'Dev SQL Console', icon: <Database size={20} /> }] : []),
  ];

  const activeView = view === 'friend-detail' ? 'friends' : view;
  const bottomNavValue = MORE_IDS.includes(activeView) ? 'more' : activeView;

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard onNavigate={navigate} onAddExpense={() => setShowAddExpense(true)} />;
      case 'expenses': return <Expenses />;
      case 'recurring': return <Recurring onNavigate={navigate} />;
      case 'wallets': return <Wallets />;
      case 'friends': return <Friends onNavigate={navigate} />;
      case 'friend-detail': return <FriendDetail friendId={friendDetailId} onNavigate={navigate} />;
      case 'settlements': return <Settlements />;
      case 'split-trips': return <SplitTrips />;
      case 'analytics': return <Analytics />;
      case 'settings': return <Settings onNavigate={navigate} />;
      case 'dev-sql': return <DevSQLConsole onNavigate={navigate} />;
      default: return <Dashboard onNavigate={navigate} onAddExpense={() => setShowAddExpense(true)} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Desktop sidebar */}
      {!isMobile && (
        <nav className={`sidebar floating ${sidebarCollapsed ? 'collapsed' : ''}`}>
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
                margin: '4px 0 8px',
                width: '100%',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                padding: sidebarCollapsed ? '8px 0' : '8px 12px'
              }}
              onClick={() => setShowAddExpense(true)}
              title={sidebarCollapsed ? "Add Expense" : undefined}
            >
              <Plus size={16} />
              <span className="nav-item-label">Add Expense</span>
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-footer-actions" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', gap: 6 }}>
              <NotificationBell onNavigate={navigate} placement="top-left" />
              <IconButton
                size="small"
                onClick={handleToggleDark}
                sx={{ 
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
            bgcolor: mode === 'dark' ? 'rgba(15, 15, 15, 0.82)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            borderBottom: '1px solid',
            borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            color: 'text.primary',
            boxShadow: mode === 'dark'
              ? '0 4px 20px rgba(0, 0, 0, 0.4)'
              : '0 4px 20px rgba(0, 0, 0, 0.03)',
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
          }}
        >
          <Toolbar variant="dense" sx={{ minHeight: 56, px: 1.5, gap: 1, justifyContent: 'space-between' }}>
            <Typography
              variant="h6"
              component="span"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '0.95rem', sm: '1.05rem' },
                letterSpacing: '-0.3px',
                flexShrink: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
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
               view === 'settings' ? 'Settings' : 'Dashboard'}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
              {view === 'expenses' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.2,
                    px: 0.8, py: 0.25, borderRadius: 99,
                    bgcolor: mode === 'dark' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(211, 47, 47, 0.08)',
                    color: 'error.main', fontSize: { xs: '0.68rem', sm: '0.75rem' }, fontWeight: 600
                  }}>
                    <TrendingDown size={12} /> -{fmtMoney(expOut, currency)}
                  </Box>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.2,
                    px: 0.8, py: 0.25, borderRadius: 99,
                    bgcolor: mode === 'dark' ? 'rgba(102, 187, 106, 0.15)' : 'rgba(46, 125, 50, 0.08)',
                    color: 'success.main', fontSize: { xs: '0.68rem', sm: '0.75rem' }, fontWeight: 600
                  }}>
                    <TrendingUp size={12} /> +{fmtMoney(expIn, currency)}
                  </Box>
                </Box>
              )}

              {view === 'friends' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.2,
                    px: 0.8, py: 0.25, borderRadius: 99,
                    bgcolor: mode === 'dark' ? 'rgba(102, 187, 106, 0.15)' : 'rgba(46, 125, 50, 0.08)',
                    color: 'success.main', fontSize: { xs: '0.68rem', sm: '0.75rem' }, fontWeight: 600
                  }}>
                    <TrendingUp size={12} /> +{fmtMoney(friendCredit, currency)}
                  </Box>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.2,
                    px: 0.8, py: 0.25, borderRadius: 99,
                    bgcolor: mode === 'dark' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(211, 47, 47, 0.08)',
                    color: 'error.main', fontSize: { xs: '0.68rem', sm: '0.75rem' }, fontWeight: 600
                  }}>
                    <TrendingDown size={12} /> -{fmtMoney(friendDebt, currency)}
                  </Box>
                </Box>
              )}

              {(view === 'dashboard' || view === 'wallets') && (
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', px: 1, py: 0.3, borderRadius: 99,
                  bgcolor: totalBal < 0
                    ? (mode === 'dark' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(211, 47, 47, 0.08)')
                    : 'var(--accent-soft)',
                  color: totalBal < 0 ? 'error.main' : 'primary.main',
                  fontSize: { xs: '0.75rem', sm: '0.8rem' }, fontWeight: 700
                }}>
                  {fmtMoney(totalBal, currency)}
                </Box>
              )}

              <NotificationBell onNavigate={navigate} />

              <IconButton size="small" onClick={handleToggleDark} sx={{ color: 'text.secondary', p: 0.5 }}>
                {mode === 'dark'
                  ? <Sun size={18} />
                  : <Moon size={18} />}
              </IconButton>
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
            onChange={(_, val) => {
              if (val === 'add') setShowAddExpense(true);
              else if (val === 'more') setMoreOpen(true);
              else navigate(val as ViewName);
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
                  display: 'none !important',
                },
              }}
            />
            <BottomNavigationAction label="Contacts" icon={<Users size={20} />} value="friends" />
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

      {/* More drawer */}
      <Drawer
        anchor="bottom"
        open={moreOpen && isMobile}
        onClose={() => setMoreOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}
      >
        <Box sx={{ pt: 1, pb: 3 }}>
          <Box sx={{ width: 36, height: 4, bgcolor: 'divider', borderRadius: 99, mx: 'auto', mb: 1.5 }} />
          <List disablePadding>
            {moreItems.map(item => (
              <ListItemButton
                key={item.id}
                onClick={() => navigate(item.id)}
                selected={activeView === item.id}
                sx={{ 
                  py: 1.5, 
                  px: 3,
                  transition: 'background-color 0.2s ease',
                  '& .MuiListItemIcon-root': {
                    minWidth: 44,
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease',
                  },
                  '&:hover .MuiListItemIcon-root': {
                    transform: 'scale(1.15) translateY(-1px)',
                  },
                  '&.Mui-selected .MuiListItemIcon-root': {
                    transform: 'scale(1.12)',
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 44 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 500 }} />
                {item.id === 'settlements' && pendingSettlements > 0 && (
                  <Box sx={{
                    fontSize: 11, fontWeight: 700, px: 0.75, py: 0.25,
                    bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 99,
                  }}>
                    {pendingSettlements}
                  </Box>
                )}
                {item.id === 'recurring' && dueAutopaysCount > 0 && (
                  <Box sx={{
                    fontSize: 11, fontWeight: 700, px: 0.75, py: 0.25,
                    bgcolor: 'error.main', color: '#ffffff', borderRadius: 99,
                  }}>
                    {dueAutopaysCount} due
                  </Box>
                )}
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Floating Voice Assistant Trigger */}
      {enableAIAssistant && (
        <IconButton
          onClick={() => setShowAIAssistant(true)}
          sx={{
            position: 'fixed',
            bottom: { xs: 72, sm: 24 },
            right: { xs: 16, sm: 24 },
            width: 52,
            height: 52,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: '0 6px 20px var(--accent-soft)',
            zIndex: 1000,
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
            '&:hover': {
              bgcolor: 'primary.dark',
              transform: 'scale(1.1) rotate(10deg)',
              boxShadow: '0 8px 25px var(--accent-soft)',
            },
            '&:active': {
              transform: 'scale(0.95)',
            }
          }}
          title="Ask Max Assistant"
        >
          <Sparkles size={24} />
        </IconButton>
      )}

      {showAddExpense && (
        <ExpenseModal
          initialData={addExpenseInitialData || undefined}
          onClose={() => {
            setShowAddExpense(false);
            setAddExpenseInitialData(null);
          }}
        />
      )}
      {showAIAssistant && (
        <AIAssistantModal
          open={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
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
