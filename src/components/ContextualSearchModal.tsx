import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Search,
  X,
  ReceiptText,
  Users,
  Wallet as WalletIcon,
  Handshake,
  Compass,
  RefreshCw,
  Store,
  Tv,
  ChevronRight,
  Sparkles,
  Settings as SettingsIcon,
  Palette,
  Database,
  Tag,
  Info,
  FlaskConical,
  MessageSquarePlus,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useStore } from '../store';
import type { ViewName, Trip, Expense, Settlement, RecurringRule, Wallet } from '../types';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, groupExpenses, resolveCategoryMeta, type GroupedExpense } from '../utils';
import { friendBalance, walletBalance, DEFAULT_CATEGORIES } from '../db';
import CategoryIcon from './CategoryIcon';
import { SmartExpenseMeta } from './expenses/SmartExpenseMeta';
import { renderWalletIcon } from './WalletIconRenderer';
import { showSoftKeyboard } from '../utils/keyboard';
import { CURRENT_APP_VERSION } from '../utils/updateManager';
import { ExpenseDetailDrawer } from './ExpenseDetailDrawer';
import ExpenseModal from './ExpenseModal';
import ConfirmDialog from './ConfirmDialog';
import SettlementDetailModal from './SettlementDetailModal';
import RecurringModal from './RecurringModal';
import WalletModal from './WalletModal';

interface Props {
  open: boolean;
  onClose: () => void;
  activeView: ViewName;
  onNavigate: (view: ViewName, arg?: string) => void;
  initialQuery?: string;
  initialTab?: SearchTab;
}

export type SearchTab = 'all' | 'expenses' | 'contacts' | 'wallets' | 'settlements' | 'trips' | 'recurring' | 'settings';

interface TabItem {
  id: SearchTab;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}

const TABS: TabItem[] = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'wallets', label: 'Wallets', icon: WalletIcon },
  { id: 'settlements', label: 'Settlements', icon: Handshake },
  { id: 'trips', label: 'Trips', icon: Compass },
  { id: 'recurring', label: 'Subscriptions', icon: RefreshCw },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

interface SettingsSearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  tags: string[];
}

const SETTINGS_SEARCH_ITEMS: SettingsSearchItem[] = [
  {
    id: 'appearance',
    title: 'Appearance & Theme',
    subtitle: 'Theme, dark/light mode & accent colors',
    category: 'General',
    icon: Palette,
    tags: ['theme', 'dark', 'light', 'mode', 'color', 'accent', 'palette', 'neon violet', 'classic blue', 'emerald', 'coral', 'amber', 'rose', 'monochrome', 'appearance', 'look', 'style']
  },
  {
    id: 'preferences',
    title: 'Preferences & Currency',
    subtitle: 'Currency, default wallet & keyboard settings',
    category: 'Preferences',
    icon: Sliders,
    tags: ['currency', 'money', 'inr', 'usd', 'eur', 'gbp', 'jpy', 'cad', 'aud', 'wallet', 'default', 'status', 'paid', 'unpaid', 'preferences', 'defaults', 'symbol', 'format', 'keyboard', 'auto open keyboard', 'search', 'textbox', 'mobile keyboard']
  },
  {
    id: 'categories',
    title: 'Category & Tag Management',
    subtitle: 'Manage categories, tags & icons',
    category: 'General',
    icon: Tag,
    tags: ['categories', 'category', 'tags', 'tag', 'labels', 'label', 'color', 'icon', 'food', 'shopping', 'fuel', 'bills', 'groceries', 'travel', 'rent', 'entertainment']
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    subtitle: 'PIN lock, biometric & privacy',
    category: 'Security',
    icon: ShieldCheck,
    tags: ['security', 'privacy', 'pin', 'lock', 'biometric', 'fingerprint', 'face id', 'passcode']
  },
  {
    id: 'data-backup',
    title: 'Data Management & Backup',
    subtitle: 'Export, import, backup & reset data',
    category: 'Data',
    icon: Database,
    tags: ['data', 'export', 'import', 'backup', 'restore', 'reset', 'sql', 'dump', 'download', 'csv', 'json', 'clear', 'wipe', 'storage', 'database', 'sync']
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features',
    subtitle: 'Envelopes budget, autopay & trip splits',
    category: 'Features',
    icon: Sparkles,
    tags: ['advanced', 'envelopes', 'envelope', 'budget', 'budgeting', 'autopay', 'rules', 'trips', 'split', 'splits', 'group', 'travel', 'features']
  },
  {
    id: 'dev-mode',
    title: 'Developer Mode & SQL Console',
    subtitle: 'Developer console & query tools',
    category: 'System',
    icon: FlaskConical,
    tags: ['dev', 'developer', 'sql', 'console', 'query', 'ai', 'assistant', 'engine', 'experimental', 'database', 'tools', 'debug', 'terminal']
  },
  {
    id: 'app-info',
    title: 'App Info & Updates',
    subtitle: `Okane v${CURRENT_APP_VERSION} • Version info & changelog`,
    category: 'System',
    icon: Info,
    tags: ['version', 'update', 'updates', 'build', 'github', 'info', 'release', 'changelog', 'about', 'app info']
  },
  {
    id: 'feedback',
    title: 'Report Bug / Feature Request',
    subtitle: 'Report a bug or suggest feature ideas',
    category: 'Support',
    icon: MessageSquarePlus,
    tags: ['bug', 'feature', 'issue', 'feedback', 'github', 'report', 'request', 'suggest', 'support', 'contact']
  }
];

export default function ContextualSearchModal({ open, onClose, activeView, onNavigate, initialQuery, initialTab }: Props) {
  const { db } = useStore();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const { expenses = [], friends = [], wallets = [], settlements = [], recurringRules = [], settings } = db;
  const trips: Trip[] = useMemo(() => {
    if (db.tripHistory && db.tripHistory.length > 0) return db.tripHistory;
    if (db.activeTrip) return [db.activeTrip];
    return [];
  }, [db.tripHistory, db.activeTrip]);
  const currency = settings?.currency || 'INR';

  const friendsMap = useMemo(() => new Map(friends.map(f => [f.id, f])), [friends]);
  const walletsMap = useMemo(() => new Map(wallets.map(w => [w.id, w])), [wallets]);
  const categories = settings?.categories?.length ? settings.categories : DEFAULT_CATEGORIES;
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.name, c])), [categories]);

  const defaultTab: SearchTab = useMemo(() => {
    if (activeView === 'expenses') return 'expenses';
    if (activeView === 'friends' || activeView === 'friend-detail') return 'contacts';
    if (activeView === 'wallets') return 'wallets';
    if (activeView === 'settlements') return 'settlements';
    if (activeView === 'split-trips') return 'trips';
    if (activeView === 'recurring') return 'recurring';
    if (activeView === 'settings') return 'settings';
    return 'all';
  }, [activeView]);

  const orderedTabs = useMemo(() => {
    if (defaultTab === 'all') return TABS;
    const targetTab = TABS.find(t => t.id === defaultTab);
    if (!targetTab) return TABS;
    const otherTabs = TABS.filter(t => t.id !== defaultTab);
    return [targetTab, ...otherTabs];
  }, [defaultTab]);

  const [query, setQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [selectedTab, setSelectedTab] = useState<SearchTab | null>(null);
  const activeTab = selectedTab ?? defaultTab;
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedDetailGe, setSelectedDetailGe] = useState<GroupedExpense | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringRule | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [delExpId, setDelExpId] = useState<string | null>(null);
  const { deleteExpense, deleteSettlement, showToast } = useStore();

  const handleClose = React.useCallback(() => {
    setQuery('');
    setIsInputFocused(false);
    setSelectedTab(null);
    setSelectedDetailGe(null);
    setSelectedSettlement(null);
    setSelectedRecurring(null);
    setSelectedWallet(null);
    setEditExp(null);
    setDelExpId(null);
    onClose();
  }, [onClose]);

  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setQuery(initialQuery ?? '');
      setSelectedTab(initialTab ?? null);
    }
  }

  // Auto-focus and show soft keyboard when modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          showSoftKeyboard(inputRef.current, { placeCursorAtEnd: true, scroll: true });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  const q = query.trim().toLowerCase();

  // All grouped expenses for clean split representation
  const allGroupedExpenses = useMemo(() => {
    return groupExpenses(expenses, wallets, friends, settlements);
  }, [expenses, wallets, friends, settlements]);

  // Search Expenses
  const matchingExpenses = useMemo(() => {
    if (activeTab !== 'all' && activeTab !== 'expenses') return [];
    if (!q) {
      return allGroupedExpenses.slice(0, 12);
    }
    return allGroupedExpenses.filter(ge => {
      const descMatch = (ge.description || '').toLowerCase().includes(q);
      const catMatch = (ge.category || '').toLowerCase().includes(q);
      const amtMatch = String(ge.totalAmount).includes(q) || ge.items.some(i => String(i.amount).includes(q));
      const dateMatch = (ge.date || '').toLowerCase().includes(q);
      const notesMatch = ge.items.some(i => (i.notes || '').toLowerCase().includes(q));
      const friendMatch = ge.friendIds.some(fid => (friendsMap.get(fid)?.name || '').toLowerCase().includes(q));
      const vendorMatch = ge.vendorId ? (friendsMap.get(ge.vendorId)?.name || '').toLowerCase().includes(q) : false;
      const walletMatch = ge.walletId ? (walletsMap.get(ge.walletId)?.name || '').toLowerCase().includes(q) : false;
      const splitMatch = ge.isSplit && ('split'.includes(q) || 'share'.includes(q) || 'bill'.includes(q));

      return descMatch || catMatch || amtMatch || dateMatch || notesMatch || friendMatch || vendorMatch || walletMatch || splitMatch;
    }).slice(0, 30);
  }, [allGroupedExpenses, friendsMap, walletsMap, q, activeTab]);

  // Search Contacts (Friends, Vendors, Subscriptions)
  const matchingContacts = useMemo(() => {
    if (activeTab !== 'all' && activeTab !== 'contacts') return [];
    if (!q) {
      return friends.slice(0, 8);
    }
    return friends.filter(f => {
      const nameMatch = f.name.toLowerCase().includes(q);
      const catMatch = (f.category || '').toLowerCase().includes(q);
      const notesMatch = (f.notes || '').toLowerCase().includes(q);
      const webMatch = (f.website || '').toLowerCase().includes(q);
      return nameMatch || catMatch || notesMatch || webMatch;
    }).slice(0, 25);
  }, [friends, q, activeTab]);

  // Search Wallets
  const matchingWallets = useMemo(() => {
    if (activeTab !== 'all' && activeTab !== 'wallets') return [];
    if (!q) return wallets;
    return wallets.filter(w => {
      return w.name.toLowerCase().includes(q);
    });
  }, [wallets, q, activeTab]);

  // Search Settlements
  const matchingSettlements = useMemo(() => {
    if (activeTab !== 'all' && activeTab !== 'settlements') return [];
    if (!q) return settlements.slice(0, 8);
    return settlements.filter(s => {
      const friend = friends.find(f => f.id === s.friendId);
      const friendName = (friend?.name || '').toLowerCase();
      const friendMatch = friendName.includes(q);
      const notesMatch = (s.note || '').toLowerCase().includes(q);
      const amtMatch = String(s.amount).includes(q);
      const dateMatch = (s.date || '').toLowerCase().includes(q);
      return friendMatch || notesMatch || amtMatch || dateMatch;
    }).slice(0, 25);
  }, [settlements, friends, q, activeTab]);

  // Search Trips
  const matchingTrips = useMemo(() => {
    if (activeTab !== 'all' && activeTab !== 'trips') return [];
    if (!q) return trips.slice(0, 6);
    return trips.filter((t: Trip) => {
      const nameMatch = (t.name || '').toLowerCase().includes(q);
      const groupMatch = (t.groupName || '').toLowerCase().includes(q);
      const memberMatch = t.members ? t.members.some(m => m.name.toLowerCase().includes(q)) : false;
      return nameMatch || groupMatch || memberMatch;
    }).slice(0, 15);
  }, [trips, q, activeTab]);

  // Search Recurring Rules
  const matchingRecurring = useMemo(() => {
    if (activeTab !== 'all' && activeTab !== 'recurring') return [];
    if (!q) return recurringRules.slice(0, 6);
    return recurringRules.filter(r => {
      const titleMatch = r.title.toLowerCase().includes(q);
      const catMatch = (r.category || '').toLowerCase().includes(q);
      const freqMatch = (r.frequency || '').toLowerCase().includes(q);
      return titleMatch || catMatch || freqMatch;
    }).slice(0, 15);
  }, [recurringRules, q, activeTab]);

  // Search Settings & Preferences
  const matchingSettings = useMemo(() => {
    if (activeTab !== 'all' && activeTab !== 'settings') return [];
    if (!q) {
      return activeTab === 'settings' ? SETTINGS_SEARCH_ITEMS : SETTINGS_SEARCH_ITEMS.slice(0, 4);
    }
    return SETTINGS_SEARCH_ITEMS.filter(s => {
      const titleMatch = s.title.toLowerCase().includes(q);
      const subMatch = s.subtitle.toLowerCase().includes(q);
      const catMatch = s.category.toLowerCase().includes(q);
      const tagMatch = s.tags.some(t => t.toLowerCase().includes(q));
      return titleMatch || subMatch || catMatch || tagMatch;
    });
  }, [q, activeTab]);

  const totalResultsCount =
    matchingExpenses.length +
    matchingContacts.length +
    matchingWallets.length +
    matchingSettlements.length +
    matchingTrips.length +
    matchingRecurring.length +
    matchingSettings.length;

  if (!open) return null;

  const placeholderText =
    activeTab === 'expenses'
      ? 'Search expenses by title, category, amount...'
      : activeTab === 'contacts'
      ? 'Search friends, vendors, contacts...'
      : activeTab === 'wallets'
      ? 'Search wallet accounts...'
      : activeTab === 'settlements'
      ? 'Search settlements & notes...'
      : activeTab === 'trips'
      ? 'Search trips & split groups...'
      : activeTab === 'recurring'
      ? 'Search subscriptions & autopays...'
      : activeTab === 'settings'
      ? 'Search settings, themes, currency, backups, features...'
      : 'Search across expenses, contacts, settings...';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '0px' : '20px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadein 0.15s ease',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '620px',
          height: isMobile ? '78vh' : 'auto',
          maxHeight: isMobile ? '80vh' : '84vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--drawer-bg, var(--surface))',
          border: isMobile ? 'none' : '1px solid var(--border)',
          borderTop: isMobile ? '1px solid var(--border)' : undefined,
          borderTopLeftRadius: isMobile ? '24px' : '20px',
          borderTopRightRadius: isMobile ? '24px' : '20px',
          borderBottomLeftRadius: isMobile ? '0px' : '20px',
          borderBottomRightRadius: isMobile ? '0px' : '20px',
          boxShadow: isMobile
            ? '0 -10px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            : '0 24px 48px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px var(--border)',
          overflow: 'hidden',
          animation: isMobile
            ? 'slideup 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            : 'modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : '0px',
        }}
      >
        {/* Mobile Drawer Grab Handle */}
        {isMobile && (
          <div
            style={{
              paddingTop: '12px',
              paddingBottom: '4px',
              display: 'flex',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              cursor: 'grab',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '4px',
                borderRadius: '9999px',
                backgroundColor: 'var(--border2)',
                opacity: 0.8,
              }}
            />
          </div>
        )}

        {/* Search Input Header */}
        <div
          style={{
            padding: isMobile ? '12px 16px 8px 16px' : '18px 20px 10px 20px',
            borderBottom: 'none',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'transparent',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Inner Search Box */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'var(--surface2)',
              border: isInputFocused ? '1px solid var(--border2)' : '1px solid var(--border)',
              borderRadius: '16px',
              padding: isMobile ? '10px 14px' : '11px 16px',
              minWidth: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <Search size={19} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholderText}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '15px',
                fontWeight: 450,
                color: 'var(--text)',
                minWidth: 0,
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  if (!isMobile) {
                    inputRef.current?.focus();
                  }
                }}
                style={{
                  background: 'var(--surface3)',
                  border: 'none',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
                  flexShrink: 0,
                }}
                aria-label="Clear query"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 9999,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Context Tabs */}
        <div
          className="search-tabs-scroll"
          style={{
            padding: isMobile ? '4px 16px 12px 16px' : '4px 20px 14px 20px',
            borderBottom: 'none',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            gap: '8px',
            backgroundColor: 'transparent',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            flexShrink: 0,
          }}
        >
          {orderedTabs.map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--border2)';
                    e.currentTarget.style.backgroundColor = 'var(--surface3)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'var(--surface2)';
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: isSelected ? 700 : 500,
                  backgroundColor: isSelected ? 'var(--text)' : 'var(--surface2)',
                  color: isSelected ? 'var(--bg)' : 'var(--text-2)',
                  border: isSelected ? '1px solid transparent' : '1px solid var(--border)',
                  boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
                }}
              >
                <Icon size={14} style={{ color: isSelected ? 'var(--bg)' : 'var(--text-3)' }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '10px 16px 16px',
            paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 24px)' : '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {totalResultsCount === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-3)' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px auto',
                  color: 'var(--text-3)',
                }}
              >
                <Search size={22} />
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text)' }}>No results found</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-3)', marginTop: '4px' }}>
                {query ? (
                  <span>No matches found for &ldquo;{query}&rdquo;</span>
                ) : (
                  <span>No records available in this category</span>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Expenses Results */}
              {matchingExpenses.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '10px',
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Expenses ({matchingExpenses.length})</span>
                    {!q && <span style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.5px', opacity: 0.9 }}>Recent</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {matchingExpenses.map((ge, idx) => {
                      const isTransfer = ge.category === 'Transfer' || ge.items.some(i => i.category === 'Transfer');
                      const isIn = (ge.flow === 'in' && !isTransfer) || (ge.isSettlementGroup && ge.flow === 'in');
                      const rawFriends = ge.friendIds.map(fid => friendsMap.get(fid)).filter(Boolean) as typeof friends;
                      const vendorId = ge.vendorId || ge.items.find(i => i.vendorId)?.vendorId;
                      const vendor = vendorId ? friendsMap.get(vendorId) : null;
                      const friendsToShow = vendor ? rawFriends.filter(f => f.id !== vendor.id) : rawFriends;
                      const isSplit = ge.isSplit && !ge.isSettlementGroup;
                      const catMeta = resolveCategoryMeta(ge.category, categoriesMap.get(ge.category), ge.isSettlementGroup);

                      return (
                        <div
                          key={`${ge.id}-${idx}`}
                          onClick={() => setSelectedDetailGe(ge)}
                          role="button"
                          tabIndex={0}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedDetailGe(ge);
                            }
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                          }}
                          onMouseDown={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                            {/* Clean Category Icon Squircle */}
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '13px',
                                backgroundColor: catMeta.bg,
                                border: `1px solid ${catMeta.border}`,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                                color: catMeta.color,
                              }}
                            >
                              <CategoryIcon category={catMeta.name} icon={catMeta.icon} size={20} style={{ color: catMeta.color }} />
                            </div>

                            {/* Info */}
                            <div style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                              {/* Title line */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '14.5px',
                                    fontWeight: 650,
                                    color: 'var(--text)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {ge.description}
                                </span>
                                {isSplit && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                      backgroundColor: 'var(--accent-soft)',
                                      color: 'var(--accent)',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Users size={10} />
                                    <span>Split</span>
                                  </span>
                                )}
                              </div>

                              {/* Subtitle line */}
                              <SmartExpenseMeta
                                category={ge.category}
                                dateText={fmtDate(ge.date)}
                                vendor={vendor}
                                friends={!vendor ? friendsToShow : []}
                                style={{ fontSize: '12px', marginTop: '3px' }}
                              />
                            </div>
                          </div>

                          {/* Right Amount */}
                          <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
                            <div
                              style={{
                                fontSize: '15px',
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                color: isIn ? 'var(--credit, #22c55e)' : (ge.flow === 'out' ? 'var(--debit, #ef4444)' : 'var(--text)'),
                              }}
                            >
                              {isIn ? '+' : (ge.flow === 'out' ? '-' : '')}{fmtMoney(ge.totalAmount, currency)}
                            </div>
                            {isSplit && ge.personalShare > 0 && ge.personalShare !== ge.totalAmount && (
                              <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500, marginTop: '2px' }}>
                                You: {fmtMoney(ge.personalShare, currency)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contacts / Friends / Vendors / Subscriptions */}
              {matchingContacts.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '10px',
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Contacts & Vendors ({matchingContacts.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {matchingContacts.map(f => {
                      const bal = friendBalance(db, f.id);
                      const fType = f.type || 'friend';
                      const fColor = f.color || (fType === 'vendor' ? '#F59E0B' : fType === 'subscription' ? '#8B5CF6' : undefined);
                      const avatarStyle = getAvatarStyle(fColor || f.name);

                      return (
                        <div
                          key={f.id}
                          onClick={() => {
                            handleClose();
                            onNavigate('friend-detail', f.id);
                          }}
                          role="button"
                          tabIndex={0}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleClose();
                              onNavigate('friend-detail', f.id);
                            }
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                          }}
                          onMouseDown={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '13px',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '14px',
                                fontWeight: 700,
                                flexShrink: 0,
                                ...avatarStyle,
                              }}
                            >
                              {fType === 'vendor' ? (
                                <Store size={18} style={{ color: fColor || '#F59E0B' }} />
                              ) : fType === 'subscription' ? (
                                <Tv size={18} style={{ color: fColor || '#8B5CF6' }} />
                              ) : (
                                friendInitial(f.name, f.avatarNumber)
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '14.5px',
                                  fontWeight: 650,
                                  color: 'var(--text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {f.name}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'capitalize', marginTop: '3px' }}>
                                {fType} {f.category ? `• ${f.category}` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
                            {bal.net > 0.004 ? (
                              <span style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--credit, #22c55e)' }}>
                                Owes {fmtMoney(bal.owedToMe, currency)}
                              </span>
                            ) : bal.net < -0.004 ? (
                              <span style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--debit, #ef4444)' }}>
                                You owe {fmtMoney(bal.owedByMe, currency)}
                              </span>
                            ) : (
                              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-3)' }}>
                                Settled
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Wallets */}
              {matchingWallets.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '10px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>Wallets ({matchingWallets.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {matchingWallets.map(w => {
                      const bal = walletBalance(db, w.id);
                      return (
                        <div
                          key={w.id}
                          onClick={() => setSelectedWallet(w)}
                          role="button"
                          tabIndex={0}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedWallet(w);
                            }
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                          }}
                          onMouseDown={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: 42, height: 42, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                              {renderWalletIcon(w.icon || w.name, 40, w.color)}
                            </div>
                            <div>
                              <div style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--text)' }}>{w.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
                                {w.icon ? `${w.icon} • Wallet` : 'Wallet Account'}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '14.5px', fontWeight: 700, color: bal < 0 ? 'var(--debit, #ef4444)' : 'var(--text)' }}>
                              {fmtMoney(bal, currency)}
                            </div>
                            <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Settlements */}
              {matchingSettlements.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '10px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>Settlements ({matchingSettlements.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {matchingSettlements.map(s => {
                      const friend = friendsMap.get(s.friendId);
                      const amtVal = Number(s.amount) || 0;
                      const isReceived = amtVal >= 0;
                      const absAmount = Math.abs(amtVal);
                      const sColor = isReceived ? '#10B981' : '#F43F5E';
                      const sBg = isReceived ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)';
                      const sBorder = isReceived ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.28)';

                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedSettlement(s)}
                          role="button"
                          tabIndex={0}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedSettlement(s);
                            }
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                          }}
                          onMouseDown={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '13px',
                                backgroundColor: sBg,
                                border: `1px solid ${sBorder}`,
                                color: sColor,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Handshake size={18} style={{ color: sColor }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--text)' }}>
                                {isReceived ? 'Received from' : 'Paid to'} {friend?.name || 'Contact'}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
                                {fmtDate(s.date)} {s.paymentMethod ? `• ${s.paymentMethod}` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: sColor }}>
                              {isReceived ? '+' : '-'}{fmtMoney(absAmount, currency)}
                            </div>
                            <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trips */}
              {matchingTrips.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '10px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>Trips ({matchingTrips.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {matchingTrips.map((t: Trip) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          handleClose();
                          onNavigate('split-trips', t.id);
                        }}
                        role="button"
                        tabIndex={0}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleClose();
                            onNavigate('split-trips', t.id);
                          }
                        }}
                        onMouseEnter={ev => {
                          ev.currentTarget.style.borderColor = 'var(--border2)';
                        }}
                        onMouseLeave={ev => {
                          ev.currentTarget.style.borderColor = 'var(--border)';
                        }}
                        onMouseDown={ev => {
                          ev.currentTarget.style.borderColor = 'var(--border2)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '13px',
                              backgroundColor: 'rgba(249, 115, 22, 0.14)',
                              border: '1px solid rgba(249, 115, 22, 0.28)',
                              color: '#F97316',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Compass size={19} style={{ color: '#F97316' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--text)' }}>{t.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>{t.groupName || 'Trip Group'}</div>
                          </div>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-3)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subscriptions / Recurring */}
              {matchingRecurring.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '10px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>Recurring & Subscriptions ({matchingRecurring.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {matchingRecurring.map(r => {
                      const rCatMeta = resolveCategoryMeta(r.category || 'Other', categoriesMap.get(r.category || 'Other'), false, categoriesMap);

                      return (
                        <div
                          key={r.id}
                          onClick={() => setSelectedRecurring(r)}
                          role="button"
                          tabIndex={0}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedRecurring(r);
                            }
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                          }}
                          onMouseDown={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '13px',
                                backgroundColor: rCatMeta.bg,
                                border: `1px solid ${rCatMeta.border}`,
                                color: rCatMeta.color,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <CategoryIcon category={rCatMeta.name} icon={rCatMeta.icon} size={19} style={{ color: rCatMeta.color }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--text)' }}>{r.title}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'capitalize', marginTop: '2px' }}>
                                {r.frequency} • {r.category || 'Subscription'}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>
                              {fmtMoney(Number(r.amount), currency)}
                            </div>
                            <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Settings & Preferences */}
              {matchingSettings.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: 'var(--text-3)',
                      marginBottom: '10px',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>Settings & Preferences ({matchingSettings.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {matchingSettings.map(s => {
                      const IconComponent = s.icon;
                      const getSettingColor = (cat: string) => {
                        switch (cat) {
                          case 'General': return { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.14)', border: 'rgba(59, 130, 246, 0.28)' };
                          case 'Preferences': return { color: '#6366F1', bg: 'rgba(99, 102, 241, 0.14)', border: 'rgba(99, 102, 241, 0.28)' };
                          case 'Security': return { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.28)' };
                          case 'Data': return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.28)' };
                          case 'Features': return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.28)' };
                          case 'Support': return { color: '#EC4899', bg: 'rgba(236, 72, 153, 0.14)', border: 'rgba(236, 72, 153, 0.28)' };
                          case 'System': return { color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)', border: 'rgba(139, 92, 246, 0.28)' };
                          default: return { color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--accent-border-soft)' };
                        }
                      };
                      const setStyle = getSettingColor(s.category);

                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            handleClose();
                            onNavigate('settings', s.id);
                            window.dispatchEvent(new CustomEvent('open-setting-drawer', { detail: { id: s.id } }));
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('open-setting-drawer', { detail: { id: s.id } }));
                            }, 60);
                          }}
                          role="button"
                          tabIndex={0}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleClose();
                              onNavigate('settings', s.id);
                              window.dispatchEvent(new CustomEvent('open-setting-drawer', { detail: { id: s.id } }));
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent('open-setting-drawer', { detail: { id: s.id } }));
                              }, 60);
                            }
                          }}
                          onMouseEnter={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                          onMouseLeave={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border)';
                          }}
                          onMouseDown={ev => {
                            ev.currentTarget.style.borderColor = 'var(--border2)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '13px',
                                backgroundColor: setStyle.bg,
                                border: `1px solid ${setStyle.border}`,
                                color: setStyle.color,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <IconComponent size={19} style={{ color: setStyle.color }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--text)' }}>
                                {s.title}
                              </div>
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: 'var(--text-3)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginTop: '2px',
                                }}
                              >
                                {s.subtitle}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-3)', flexShrink: 0, marginLeft: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 500 }}>Open</span>
                            <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expense Detail Drawer */}
      {selectedDetailGe && (
        <ExpenseDetailDrawer
          ge={selectedDetailGe}
          currency={currency}
          onClose={() => setSelectedDetailGe(null)}
          onEdit={(exp) => {
            setSelectedDetailGe(null);
            setEditExp(exp);
          }}
          onDelete={(id) => {
            setSelectedDetailGe(null);
            setDelExpId(id);
          }}
        />
      )}

      {/* Settlement Detail Modal */}
      {selectedSettlement && (
        <SettlementDetailModal
          settlement={selectedSettlement}
          onClose={() => setSelectedSettlement(null)}
          onUndo={(id) => {
            deleteSettlement(id);
            showToast('Settlement undone');
            setSelectedSettlement(null);
          }}
        />
      )}

      {/* Recurring Detail Modal */}
      {selectedRecurring && (
        <RecurringModal
          rule={selectedRecurring}
          onClose={() => setSelectedRecurring(null)}
        />
      )}

      {/* Wallet Modal */}
      {selectedWallet && (
        <WalletModal
          wallet={selectedWallet}
          onClose={() => setSelectedWallet(null)}
        />
      )}

      {/* Edit Modal */}
      {editExp && (
        <ExpenseModal
          expense={editExp}
          onClose={() => setEditExp(null)}
        />
      )}

      {/* Delete Confirmation */}
      {delExpId && (
        <ConfirmDialog
          title="Delete Expense"
          message="Removes this expense and restores the amount to your wallet."
          confirmLabel="Delete"
          onConfirm={() => {
            if (delExpId) {
              deleteExpense(delExpId);
              showToast('Expense deleted');
              setDelExpId(null);
            }
          }}
          onClose={() => setDelExpId(null)}
        />
      )}
    </div>
  );
}
