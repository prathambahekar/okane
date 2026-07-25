import { useState, useMemo } from 'react';
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
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PeopleIcon from '@mui/icons-material/People';
import HandshakeIcon from '@mui/icons-material/Handshake';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { StoreProvider, useStore } from './store';
import { useColorMode } from './theme';
import type { ViewName } from './types';
import { expenseFlow, friendBalance, totalWalletBalance } from './db';
import { fmtMoney } from './utils';
import Dashboard from './views/Dashboard';
import Expenses from './views/Expenses';
import Wallets from './views/Wallets';
import Friends from './views/Friends';
import FriendDetail from './views/FriendDetail';
import Settlements from './views/Settlements';
import Analytics from './views/Analytics';
import Settings from './views/Settings';
import ExpenseModal from './components/ExpenseModal';
import Toast from './components/Toast';
import './styles.css';

const MORE_IDS: ViewName[] = ['wallets', 'settlements', 'analytics', 'settings'];

function AppInner() {
  const { db } = useStore();
  const [view, setView] = useState<ViewName>('dashboard');
  const [friendDetailId, setFriendDetailId] = useState<string>('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { mode, toggleMode: toggleDark } = useColorMode();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const { expenses, friends, currency } = useMemo(() => ({
    expenses: db.expenses,
    friends: db.friends,
    currency: db.settings.currency,
  }), [db]);

  const expOut = useMemo(() => expenses.filter(e => expenseFlow(e) === 'out' && e.type === 'personal').reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const expIn = useMemo(() => expenses.filter(e => expenseFlow(e) === 'in' && e.type === 'personal').reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const friendCredit = useMemo(() => friends.reduce((s, f) => s + Math.max(0, friendBalance(db, f.id).net), 0), [friends, db]);
  const friendDebt = useMemo(() => friends.reduce((s, f) => s + Math.max(0, -friendBalance(db, f.id).net), 0), [friends, db]);
  const totalBal = useMemo(() => totalWalletBalance(db), [db]);

  const navigate = (v: ViewName, arg?: string) => {
    setView(v);
    if (v === 'friend-detail' && arg) setFriendDetailId(arg);
    setMoreOpen(false);
  };

  const sidebarNavItems: { id: ViewName; label: string; icon: React.ReactNode; section?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon fontSize="inherit" />, section: 'Main' },
    { id: 'expenses', label: 'Expenses', icon: <ReceiptLongIcon fontSize="inherit" /> },
    { id: 'wallets', label: 'Wallets', icon: <AccountBalanceWalletIcon fontSize="inherit" /> },
    { id: 'friends', label: 'Friends', icon: <PeopleIcon fontSize="inherit" />, section: 'Social' },
    { id: 'settlements', label: 'Settlements', icon: <HandshakeIcon fontSize="inherit" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChartIcon fontSize="inherit" />, section: 'Insights' },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon fontSize="inherit" />, section: 'System' },
  ];

  const moreItems: { id: ViewName; label: string; icon: React.ReactNode }[] = [
    { id: 'wallets', label: 'Wallets', icon: <AccountBalanceWalletIcon /> },
    { id: 'settlements', label: 'Settlements', icon: <HandshakeIcon /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChartIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  const activeView = view === 'friend-detail' ? 'friends' : view;
  const bottomNavValue = MORE_IDS.includes(activeView) ? 'more' : activeView;

  const pendingSettlements = db.friends.filter(f =>
    db.expenses.some(e => e.friendId === f.id && !e.settled && e.type !== 'personal')
  ).length;

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard onNavigate={navigate} onAddExpense={() => setShowAddExpense(true)} />;
      case 'expenses': return <Expenses />;
      case 'wallets': return <Wallets />;
      case 'friends': return <Friends onNavigate={navigate} />;
      case 'friend-detail': return <FriendDetail friendId={friendDetailId} onNavigate={navigate} />;
      case 'settlements': return <Settlements />;
      case 'analytics': return <Analytics />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={navigate} onAddExpense={() => setShowAddExpense(true)} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Desktop sidebar */}
      {!isMobile && (
        <nav className="sidebar">
          <div className="sidebar-logo">
            <div>
              <div className="sidebar-logo-text">Okane</div>
              <div className="sidebar-logo-sub">おかね</div>
            </div>
          </div>

          <div className="sidebar-nav">
            {sidebarNavItems.map((item, i) => {
              const showSection = item.section && (i === 0 || sidebarNavItems[i - 1]?.section !== item.section);
              return (
                <div key={item.id}>
                  {showSection && <div className="nav-section-label">{item.section}</div>}
                  <button
                    className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                    onClick={() => navigate(item.id)}
                  >
                    <span className="nav-item-icon">{item.icon}</span>
                    <span className="nav-item-label">{item.label}</span>
                    {item.id === 'settlements' && pendingSettlements > 0 && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '1px 6px',
                        background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 99,
                      }}>{pendingSettlements}</span>
                    )}
                  </button>
                </div>
              );
            })}

            <div style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" style={{ margin: '8px 0', width: '100%' }} onClick={() => setShowAddExpense(true)}>
              <AddIcon fontSize="small" />
              <span className="nav-item-label">Add Expense</span>
            </button>
          </div>

          <div className="sidebar-footer">
            <span style={{ fontSize: 16 }}>🎯</span>
            <span className="nav-item-label">{db.expenses.length} records</span>
            <IconButton
              size="small"
              onClick={toggleDark}
              sx={{ ml: 'auto', color: 'text.secondary' }}
              title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}
            >
              {mode === 'dark'
                ? <LightModeIcon sx={{ fontSize: 18 }} />
                : <DarkModeIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </div>
        </nav>
      )}

      {/* Mobile top AppBar */}
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            color: 'text.primary',
          }}
        >
          <Toolbar variant="dense" sx={{ minHeight: 52, px: 2, justifyContent: 'space-between' }}>
            <Typography variant="h6" component="span" sx={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.2px', flexShrink: 0 }}>
              {view === 'dashboard' ? 'Dashboard' :
               view === 'expenses' ? 'Expenses' :
               view === 'friends' ? 'Friends' :
               view === 'friend-detail' ? 'Friend Details' :
               view === 'wallets' ? 'Wallets' :
               view === 'analytics' ? 'Analytics' :
               view === 'settlements' ? 'Settlements' :
               view === 'settings' ? 'Settings' : 'Dashboard'}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {view === 'expenses' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mr: 0.5 }}>
                  <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'error.main', display: 'inline-flex', alignItems: 'center', gap: 0.2 }}>
                    <TrendingDownIcon sx={{ fontSize: 14 }} /> -{fmtMoney(expOut, currency)}
                  </Typography>
                  <Typography component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>·</Typography>
                  <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'success.main', display: 'inline-flex', alignItems: 'center', gap: 0.2 }}>
                    <TrendingUpIcon sx={{ fontSize: 14 }} /> +{fmtMoney(expIn, currency)}
                  </Typography>
                </Box>
              )}

              {view === 'friends' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mr: 0.5 }}>
                  <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'success.main', display: 'inline-flex', alignItems: 'center', gap: 0.2 }}>
                    <TrendingUpIcon sx={{ fontSize: 14 }} /> +{fmtMoney(friendCredit, currency)}
                  </Typography>
                  <Typography component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>·</Typography>
                  <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'error.main', display: 'inline-flex', alignItems: 'center', gap: 0.2 }}>
                    <TrendingDownIcon sx={{ fontSize: 14 }} /> -{fmtMoney(friendDebt, currency)}
                  </Typography>
                </Box>
              )}

              {(view === 'dashboard' || view === 'wallets') && (
                <Typography component="span" sx={{ fontSize: '0.82rem', fontWeight: 700, color: totalBal < 0 ? 'error.main' : 'text.primary', mr: 0.5 }}>
                  {fmtMoney(totalBal, currency)}
                </Typography>
              )}

              <IconButton size="small" color="primary" onClick={() => setShowAddExpense(true)}>
                <AddIcon />
              </IconButton>
              <IconButton size="small" onClick={toggleDark} sx={{ color: 'text.secondary' }}>
                {mode === 'dark'
                  ? <LightModeIcon sx={{ fontSize: 20 }} />
                  : <DarkModeIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
      )}

      <main className={`main-content${isMobile ? ' mobile-layout' : ''}`}>
        {renderView()}
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
              if (val === 'more') setMoreOpen(true);
              else navigate(val as ViewName);
            }}
            showLabels
            sx={{
              height: 60,
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                padding: '6px 0',
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.72rem',
                },
              },
            }}
          >
            <BottomNavigationAction label="Dashboard" icon={<DashboardIcon />} value="dashboard" />
            <BottomNavigationAction label="Expenses" icon={<ReceiptLongIcon />} value="expenses" />
            <BottomNavigationAction label="Friends" icon={<PeopleIcon />} value="friends" />
            <BottomNavigationAction label="More" icon={<MoreHorizIcon />} value="more" />
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
                sx={{ py: 1.5, px: 3 }}
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
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {showAddExpense && <ExpenseModal onClose={() => setShowAddExpense(false)} />}
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
