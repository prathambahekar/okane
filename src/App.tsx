import { useState } from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PeopleIcon from '@mui/icons-material/People';
import HandshakeIcon from '@mui/icons-material/Handshake';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import { StoreProvider, useStore } from './store';
import type { ViewName } from './types';
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

function AppInner() {
  const { db } = useStore();
  const [view, setView] = useState<ViewName>('dashboard');
  const [friendDetailId, setFriendDetailId] = useState<string>('');
  const [showAddExpense, setShowAddExpense] = useState(false);

  const navigate = (v: ViewName, arg?: string) => {
    setView(v);
    if (v === 'friend-detail' && arg) setFriendDetailId(arg);
  };

  const navItems: { id: ViewName; label: string; icon: React.ReactNode; section?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon fontSize="inherit" />, section: 'Main' },
    { id: 'expenses', label: 'Expenses', icon: <ReceiptLongIcon fontSize="inherit" /> },
    { id: 'wallets', label: 'Wallets', icon: <AccountBalanceWalletIcon fontSize="inherit" /> },
    { id: 'friends', label: 'Friends', icon: <PeopleIcon fontSize="inherit" />, section: 'Social' },
    { id: 'settlements', label: 'Settlements', icon: <HandshakeIcon fontSize="inherit" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChartIcon fontSize="inherit" />, section: 'Insights' },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon fontSize="inherit" />, section: 'System' },
  ];

  const activeView = view === 'friend-detail' ? 'friends' : view;

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

  const pendingSettlements = db.friends.filter(f =>
    db.expenses.some(e => e.friendId === f.id && !e.settled && e.type !== 'personal')
  ).length;

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
         
          <div>
            <div className="sidebar-logo-text">Okane</div>
            <div className="sidebar-logo-sub">おかね</div>
          </div>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item, i) => {
            const showSection = item.section && (i === 0 || navItems[i - 1]?.section !== item.section);
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
                      background: 'rgba(201,162,39,0.2)', color: 'var(--accent)', borderRadius: 99,
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
          <span style={{ fontSize: 16 }}>💾</span>
          <span className="nav-item-label">{db.expenses.length} records</span>
        </div>
      </nav>

      <main className="main-content">
        {renderView()}
      </main>

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
