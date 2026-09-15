import { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Handshake,
  MoreVertical,
  User,
  Users,
  Store,
  Tv,
  X,
  RotateCcw,
  Filter,
} from 'lucide-react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useStore } from '../store';
import type { Friend, ContactType, ViewName } from '../types';
import { friendBalance, contactTotalSpent, contactTransactionCount, contactLastTransaction, unsettledExpensesForFriend } from '../db';
import { fmtMoney, friendInitial, getAvatarStyle, formatBillingCycleShort } from '../utils';
import { renderBrandLogo } from '../components/BrandIcons';
import DesktopSearchBar from '../components/DesktopSearchBar';
import FriendModal from '../components/FriendModal';
import SettleModal from '../components/SettleModal';
import ExpenseModal from '../components/ExpenseModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ContactFilterBar from '../components/ContactFilterBar';
import type { FriendFilterStatus, SortOption, DensityOption } from '../components/ContactFilterBar';

interface Props {
  onNavigate: (v: ViewName, arg?: string) => void;
}

export default function Friends({ onNavigate }: Props) {
  const { db, deleteFriend, showToast } = useStore();
  const { friends, settings: { currency } } = db;

  const [editFriend, setEditFriend] = useState<Friend | null>(null);
  const [settleFriend, setSettleFriend] = useState<Friend | null>(null);
  const [addExpFriend, setAddExpFriend] = useState<Friend | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addDefaultType, setAddDefaultType] = useState<ContactType>('friend');
  const [delId, setDelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContactType>('friend');
  const [statusFilter, setStatusFilter] = useState<FriendFilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('owed_desc');
  const [userDensityOverride, setUserDensityOverride] = useState<DensityOption | null>(null);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const defaultDensity: DensityOption = isMobileScreen ? 'compact' : 'detailed';
  const density: DensityOption = userDensityOverride ?? defaultDensity;
  const setDensity = (newDensity: DensityOption) => {
    setUserDensityOverride(newDensity);
  };
  const [showFilters, setShowFilters] = useState(false);

  // Three-dot menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuFriend, setMenuFriend] = useState<Friend | null>(null);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, friend: Friend) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setMenuFriend(friend);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuFriend(null);
  };

  const handleDelete = (id: string) => {
    deleteFriend(id);
    setDelId(null);
    showToast('Contact removed');
  };

  // Overview calculations
  const friendStats = useMemo(() => {
    let credit = 0;
    let debit = 0;
    friends.forEach(f => {
      if ((f.type || 'friend') === 'friend') {
        const b = friendBalance(db, f.id);
        if (b.net > 0) {
          credit += b.net;
        } else if (b.net < 0) {
          debit += Math.abs(b.net);
        }
      }
    });
    return { credit, debit, net: credit - debit };
  }, [friends, db]);

  const vendorAndSubSpend = useMemo(() => {
    let vendorTotal = 0;
    let vendorOrdersCount = 0;
    let subTotal = 0;
    let subMonthlyRecurring = 0;

    friends.forEach(f => {
      const fType = f.type || 'friend';
      const spent = contactTotalSpent(db, f.id);
      const count = contactTransactionCount(db, f.id);

      if (fType === 'vendor') {
        vendorTotal += spent;
        vendorOrdersCount += count;
      } else if (fType === 'subscription') {
        subTotal += spent;
        const cycle = f.billingCycle || 'monthly';
        const amt = f.defaultAmount || 0;
        if (cycle === 'yearly') subMonthlyRecurring += amt / 12;
        else if (cycle === 'weekly') subMonthlyRecurring += amt * 4.33;
        else if (cycle === 'quarterly') subMonthlyRecurring += amt / 3;
        else subMonthlyRecurring += amt;
      }
    });

    return {
      vendorTotal,
      vendorOrdersCount,
      subTotal,
      subMonthlyRecurring,
      total: vendorTotal + subTotal,
    };
  }, [friends, db]);

  const counts = useMemo(() => {
    let friendCount = 0;
    let vendorCount = 0;
    let subCount = 0;
    friends.forEach(f => {
      const t = f.type || 'friend';
      if (t === 'friend') friendCount++;
      else if (t === 'vendor') vendorCount++;
      else if (t === 'subscription') subCount++;
    });
    return { all: friends.length, friend: friendCount, vendor: vendorCount, subscription: subCount };
  }, [friends]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (sortBy !== 'owed_desc') count++;
    if (userDensityOverride !== null) count++;
    if (search.trim() !== '') count++;
    return count;
  }, [statusFilter, sortBy, userDensityOverride, search]);

  // Listen for top bar filter button trigger
  useEffect(() => {
    const handleOpenFilters = () => {
      setShowFilters(true);
    };
    window.addEventListener('app-open-filters', handleOpenFilters);
    return () => window.removeEventListener('app-open-filters', handleOpenFilters);
  }, []);

  // Listen for top bar Add Contact button trigger
  useEffect(() => {
    const handleOpenAddContact = () => {
      setAddDefaultType(typeFilter);
      setShowAdd(true);
    };
    window.addEventListener('app-add-contact', handleOpenAddContact);
    return () => window.removeEventListener('app-add-contact', handleOpenAddContact);
  }, [typeFilter]);

  // Sync active filter count with top bar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app-filter-count-update', {
      detail: { view: 'friends', count: activeFilterCount }
    }));
  }, [activeFilterCount]);

  const handleClearAll = () => {
    setStatusFilter('all');
    setSortBy('owed_desc');
    setUserDensityOverride(null);
    setSearch('');
  };

  const filtered = useMemo(() => {
    const list = friends.filter(f => {
      const fType = f.type || 'friend';
      if (fType !== typeFilter) return false;

      const matchesSearch =
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        (f.category || '').toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (fType === 'friend' || fType === 'vendor') {
        const bal = friendBalance(db, f.id);
        switch (statusFilter) {
          case 'owes_me': return bal.net > 0.004;
          case 'i_owe': return bal.net < -0.004;
          case 'settled': return Math.abs(bal.net) <= 0.004;
          case 'all': default: return true;
        }
      }
      return true;
    });

    return list.sort((a, b) => {
      if ((typeFilter === 'friend' || typeFilter === 'vendor') && (sortBy === 'owed_desc' || sortBy === 'owed_asc')) {
        const balA = friendBalance(db, a.id).net;
        const balB = friendBalance(db, b.id).net;
        if (sortBy === 'owed_desc') {
          const isUnsettledA = Math.abs(balA) > 0.004;
          const isUnsettledB = Math.abs(balB) > 0.004;
          if (isUnsettledA && !isUnsettledB) return -1;
          if (!isUnsettledA && isUnsettledB) return 1;
          if (isUnsettledA && isUnsettledB) {
            if (balA > 0 && balB > 0) return balB - balA;
            if (balA < 0 && balB < 0) return Math.abs(balB) - Math.abs(balA);
            if (balA > 0 && balB < 0) return -1;
            if (balA < 0 && balB > 0) return 1;
          }
          return 0;
        }
        if (sortBy === 'owed_asc') return balA - balB;
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'expenses_count') {
        return contactTransactionCount(db, b.id) - contactTransactionCount(db, a.id);
      }
      if (sortBy === 'recent') {
        const txA = contactLastTransaction(db, a.id)?.date || '';
        const txB = contactLastTransaction(db, b.id)?.date || '';
        return txB.localeCompare(txA);
      }
      if (sortBy === 'newest') {
        return b.id.localeCompare(a.id);
      }
      return 0;
    });
  }, [friends, search, typeFilter, statusFilter, sortBy, db]);

  // Helper label for sort chip
  const sortLabel = useMemo(() => {
    switch (sortBy) {
      case 'owed_desc': return 'Highest Owed';
      case 'owed_asc': return 'You Owe Most';
      case 'name': return 'Name (A-Z)';
      case 'recent': return 'Recent Activity';
      case 'expenses_count': return 'Most Expenses';
      case 'newest': return 'Newest Added';
      default: return sortBy;
    }
  }, [sortBy]);

  // Helper label for status chip
  const statusLabel = useMemo(() => {
    switch (statusFilter) {
      case 'owes_me': return 'Owes You';
      case 'i_owe': return 'You Owe';
      case 'settled': return 'Settled Up';
      default: return '';
    }
  }, [statusFilter]);

  return (
    <div className="view-container">
      {/* Header Title & Desktop Action */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page-title">Contacts</h1>
        </div>
        <div className="desktop-search-filter-wrap desktop-only">
          <DesktopSearchBar placeholder="Search contacts, friends..." defaultTab="contacts" />
          <button
            type="button"
            id="desktop-filter-contact-btn"
            className={`btn btn-secondary ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowFilters(true)}
            title={activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : 'Filters'}
            aria-label="Filter contacts"
            style={{
              width: 40,
              height: 40,
              padding: 0,
              borderRadius: '9999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
              background: activeFilterCount > 0 ? 'var(--surface2)' : undefined,
              borderColor: activeFilterCount > 0 ? 'var(--border2)' : undefined,
              color: 'var(--text)',
            }}
          >
            <Filter size={17} strokeWidth={2} />
            {activeFilterCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  background: 'var(--text)',
                  color: 'var(--surface)',
                  fontSize: 10,
                  fontWeight: 750,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        <div className="page-header-actions desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            id="desktop-add-contact-btn"
            className="btn btn-primary desktop-only"
            onClick={() => {
              setAddDefaultType(typeFilter);
              setShowAdd(true);
            }}
          >
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      {/* Clean Tab Segmented Switch & Filter Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {/* Contact Type Segmented Switch + Filter (Takes Full Horizontal Space) */}
        <div className="contact-type-switch" style={{ width: '100%' }}>
          <button
            type="button"
            className={`type-btn ${typeFilter === 'friend' ? 'active' : ''}`}
            onClick={() => setTypeFilter('friend')}
            title="Friends"
            aria-label="Friends"
          >
            <User size={16} style={{ flexShrink: 0, color: 'inherit' }} />
            <span className="type-label">Friends</span>
          </button>

          <button
            type="button"
            className={`type-btn ${typeFilter === 'vendor' ? 'active' : ''}`}
            onClick={() => setTypeFilter('vendor')}
            title="Vendors"
            aria-label="Vendors"
          >
            <Store size={16} style={{ flexShrink: 0, color: 'inherit' }} />
            <span className="type-label">Vendors</span>
          </button>

          <button
            type="button"
            className={`type-btn ${typeFilter === 'subscription' ? 'active' : ''}`}
            onClick={() => setTypeFilter('subscription')}
            title="Subscriptions"
            aria-label="Subscriptions"
          >
            <Tv size={16} style={{ flexShrink: 0, color: 'inherit' }} />
            <span className="type-label">Subscriptions</span>
          </button>
        </div>

        {/* Active Filter Chips (Accent Themed) */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '2px 2px' }}>
            {search && (
              <span className="app-filter-chip">
                <span className="app-filter-chip-label">Search:</span>
                <span className="app-filter-chip-value">"{search}"</span>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="app-filter-chip-remove"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}

            {statusFilter !== 'all' && (
              <span className="app-filter-chip">
                <span className="app-filter-chip-label">Status:</span>
                <span className="app-filter-chip-value">{statusLabel}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="app-filter-chip-remove"
                  title="Clear status filter"
                  aria-label="Clear status filter"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}

            {sortBy !== 'owed_desc' && (
              <span className="app-filter-chip">
                <span className="app-filter-chip-label">Sort:</span>
                <span className="app-filter-chip-value">{sortLabel}</span>
                <button
                  type="button"
                  onClick={() => setSortBy('owed_desc')}
                  className="app-filter-chip-remove"
                  title="Reset sort"
                  aria-label="Reset sort"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}

            {userDensityOverride !== null && (
              <span className="app-filter-chip">
                <span className="app-filter-chip-label">Layout:</span>
                <span className="app-filter-chip-value">{density === 'detailed' ? 'Detailed' : density === 'grid' ? 'Grid' : 'Compact'}</span>
                <button
                  type="button"
                  onClick={() => setUserDensityOverride(null)}
                  className="app-filter-chip-remove"
                  title="Reset layout"
                  aria-label="Reset layout"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAll}
              className="app-filter-clear-btn"
              title="Clear all filters"
            >
              <RotateCcw size={13} strokeWidth={2.2} />
              <span>Clear all</span>
            </button>
          </div>
        )}
      </div>

      {/* Top Summary Metric Bar (Below Tab Bar) */}
      <div className="contacts-summary-bar">
        {typeFilter === 'friend' ? (
          <>
            <div className="summary-metric-card">
              <span className="metric-label">You are Owed</span>
              <span className="metric-value credit">{fmtMoney(friendStats.credit, currency)}</span>
            </div>
            <div className="summary-metric-card">
              <span className="metric-label">You Owe</span>
              <span className="metric-value debit">{fmtMoney(friendStats.debit, currency)}</span>
            </div>
            <div className="summary-metric-card">
              <span className="metric-label">Net Balance</span>
              <span className={`metric-value ${friendStats.net > 0 ? 'credit' : friendStats.net < 0 ? 'debit' : 'neutral'}`}>
                {friendStats.net > 0 ? `+${fmtMoney(friendStats.net, currency)}` : friendStats.net < 0 ? `-${fmtMoney(Math.abs(friendStats.net), currency)}` : fmtMoney(0, currency)}
              </span>
            </div>
          </>
        ) : typeFilter === 'vendor' ? (
          <>
            <div className="summary-metric-card">
              <span className="metric-label">Vendor Orders Total</span>
              <span className="metric-value">{fmtMoney(vendorAndSubSpend.vendorTotal, currency)}</span>
            </div>
            <div className="summary-metric-card">
              <span className="metric-label">Total Vendors</span>
              <span className="metric-value">{counts.vendor}</span>
            </div>
            <div className="summary-metric-card">
              <span className="metric-label">Total Orders</span>
              <span className="metric-value">{vendorAndSubSpend.vendorOrdersCount}</span>
            </div>
          </>
        ) : typeFilter === 'subscription' ? (
          <>
            <div className="summary-metric-card">
              <span className="metric-label">Subscriptions Spend</span>
              <span className="metric-value">{fmtMoney(vendorAndSubSpend.subTotal, currency)}</span>
            </div>
            <div className="summary-metric-card">
              <span className="metric-label">Est. Monthly Cost</span>
              <span className="metric-value">{fmtMoney(vendorAndSubSpend.subMonthlyRecurring, currency)}</span>
            </div>
            <div className="summary-metric-card">
              <span className="metric-label">Active Subscriptions</span>
              <span className="metric-value">{counts.subscription}</span>
            </div>
          </>
        ) : (
          <>
            <div className="summary-metric-card">
              <span className="metric-label">Vendor Orders Total</span>
              <span className="metric-value">{fmtMoney(vendorAndSubSpend.vendorTotal, currency)}</span>
            </div>
            <div className="summary-metric-card">
              <span className="metric-label">Subscriptions Spend</span>
              <span className="metric-value">{fmtMoney(vendorAndSubSpend.subTotal, currency)}</span>
            </div>
            <div className="summary-metric-card">
              <span className="metric-label">Combined Spend</span>
              <span className="metric-value">{fmtMoney(vendorAndSubSpend.total, currency)}</span>
            </div>
          </>
        )}
      </div>

      {/* Contacts List / Dedicated Subscriptions View */}
      {counts[typeFilter] === 0 ? (
        <div className="card empty-state-card">
          <div className="empty-state">
            <div className="empty-state-icon-badge">
              {typeFilter === 'vendor' ? (
                <Store size={24} strokeWidth={1.8} />
              ) : typeFilter === 'subscription' ? (
                <Tv size={24} strokeWidth={1.8} />
              ) : (
                <Users size={24} strokeWidth={1.8} />
              )}
            </div>
            <div className="empty-state-title">
              {typeFilter === 'friend'
                ? 'No friends yet'
                : typeFilter === 'vendor'
                ? 'No vendors yet'
                : 'No subscriptions yet'}
            </div>
            <p className="empty-state-desc">
              {typeFilter === 'friend'
                ? 'Add friends to track shared expenses and balances.'
                : typeFilter === 'vendor'
                ? 'Add vendors and shops to log orders and payments.'
                : 'Add subscriptions to manage renewals and recurring bills.'}
            </p>
            <button
              className="empty-state-btn"
              onClick={() => {
                setAddDefaultType(typeFilter);
                setShowAdd(true);
              }}
            >
              <Plus size={16} strokeWidth={2.2} />
              <span>
                {typeFilter === 'friend'
                  ? 'Add Friend'
                  : typeFilter === 'vendor'
                  ? 'Add Vendor'
                  : 'Add Subscription'}
              </span>
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state-card">
          <div className="empty-state" style={{ padding: '36px 20px' }}>
            <div className="empty-state-icon-badge" style={{ marginBottom: 14 }}>
              <Filter size={22} strokeWidth={1.8} />
            </div>
            <div className="empty-state-title" style={{ fontSize: '15px' }}>
              No matching {typeFilter === 'friend' ? 'friends' : typeFilter === 'vendor' ? 'vendors' : 'subscriptions'}
            </div>
            <p className="empty-state-desc" style={{ marginBottom: 16 }}>
              No {typeFilter === 'friend' ? 'friends' : typeFilter === 'vendor' ? 'vendors' : 'subscriptions'} match your current filter or search.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={handleClearAll}>
              Clear Filters
            </button>
          </div>
        </div>
      ) : density === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="contact-grid">
          {filtered.map((f, idx) => {
            const fType: ContactType = f.type || 'friend';
            const contactExpenses = db.expenses.filter(e => e.friendId === f.id || e.vendorId === f.id);
            const totalSpent = contactTotalSpent(db, f.id);
            const txCount = contactTransactionCount(db, f.id);
            const bal = friendBalance(db, f.id);
            const unsettledCount = unsettledExpensesForFriend(db, f.id).length;
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;
            const brandLogo = renderBrandLogo(f.name, 22);

            return (
              <div
                key={`${f.id}-${idx}`}
                className="contact-grid-card"
                onClick={() => onNavigate('friend-detail', f.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      className="avatar"
                      style={{
                        ...getAvatarStyle(f.color),
                        width: 42,
                        height: 42,
                        fontSize: 14,
                        fontWeight: 700,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                      }}
                    >
                      {fType === 'subscription' ? (brandLogo || <Tv size={18} />) : fType === 'vendor' ? <Store size={18} /> : friendInitial(f.name, f.avatarNumber)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)', letterSpacing: '-0.01em' }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fType === 'friend' ? (
                          <>
                            {contactExpenses.length} expense{contactExpenses.length !== 1 ? 's' : ''}
                            {unsettledCount > 0 ? (
                              <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {unsettledCount} open</span>
                            ) : ''}
                          </>
                        ) : fType === 'vendor' ? (
                          `${txCount} order${txCount !== 1 ? 's' : ''}`
                        ) : (
                          f.defaultAmount ? `${fmtMoney(f.defaultAmount, currency)}/${formatBillingCycleShort(f.billingCycle)}` : `${txCount} payments`
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="contact-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpen(e, f);
                    }}
                    title="More actions"
                    aria-label="More actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                  <div>
                    {isOwed ? (
                      <span className="contact-balance-pill credit">
                        Owes {fmtMoney(Math.abs(bal.net), currency)}
                      </span>
                    ) : isDebt ? (
                      <span className="contact-balance-pill debit">
                        You owe {fmtMoney(Math.abs(bal.net), currency)}
                      </span>
                    ) : fType === 'friend' ? (
                      <span className="contact-balance-pill settled">
                        Settled Up ✓
                      </span>
                    ) : (
                      <span className="contact-balance-pill neutral">
                        {fmtMoney(totalSpent, currency)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {unsettledCount > 0 && (
                      <button
                        type="button"
                        className="contact-settle-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettleFriend(f);
                        }}
                        title="Settle Up"
                      >
                        <Handshake size={13} />
                        <span>Settle</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : density === 'detailed' ? (
        /* DETAILED UNIFIED LIST VIEW */
        <div className="contact-cards-container density-detailed">
          {filtered.map((f, idx) => {
            const fType: ContactType = f.type || 'friend';
            const contactExpenses = db.expenses.filter(e => e.friendId === f.id || e.vendorId === f.id);
            const totalSpent = contactTotalSpent(db, f.id);
            const txCount = contactTransactionCount(db, f.id);
            const bal = friendBalance(db, f.id);
            const unsettledCount = unsettledExpensesForFriend(db, f.id).length;
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;
            const brandLogo = renderBrandLogo(f.name, 22);

            return (
              <div
                key={`${f.id}-${idx}`}
                className="contact-card-item density-detailed"
                onClick={() => onNavigate('friend-detail', f.id)}
              >
                {/* Contact Avatar & Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                  <div
                    className="avatar"
                    style={{
                      ...getAvatarStyle(f.color),
                      width: 44,
                      height: 44,
                      fontSize: 15,
                      fontWeight: 700,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                    }}
                  >
                    {fType === 'subscription' ? (brandLogo || <Tv size={20} />) : fType === 'vendor' ? <Store size={20} /> : friendInitial(f.name, f.avatarNumber)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                        {f.name}
                      </span>
                      {typeFilter !== fType && fType !== 'friend' && (
                        <span className={`app-contact-badge ${fType}`}>
                          {fType}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fType === 'friend' ? (
                        <>
                          {contactExpenses.length} expense{contactExpenses.length !== 1 ? 's' : ''}
                          {unsettledCount > 0 ? (
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {unsettledCount} unsettled</span>
                          ) : ' · all settled'}
                        </>
                      ) : fType === 'vendor' ? (
                        <>{f.category ? `${f.category} · ` : ''}{txCount} order{txCount !== 1 ? 's' : ''}</>
                      ) : (
                        <>{f.defaultAmount ? `${fmtMoney(f.defaultAmount, currency)}/${formatBillingCycleShort(f.billingCycle)}` : `${txCount} payments`}</>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badge & Quick Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {isOwed ? (
                    <span className="contact-balance-pill credit">
                      Owes {fmtMoney(Math.abs(bal.net), currency)}
                    </span>
                  ) : isDebt ? (
                    <span className="contact-balance-pill debit">
                      You owe {fmtMoney(Math.abs(bal.net), currency)}
                    </span>
                  ) : fType === 'friend' ? (
                    <span className="contact-balance-pill settled">
                      Settled Up ✓
                    </span>
                  ) : (
                    <span className="contact-balance-pill neutral">
                      {fmtMoney(totalSpent, currency)}
                    </span>
                  )}

                  {unsettledCount > 0 && (
                    <button
                      type="button"
                      className="contact-settle-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettleFriend(f);
                      }}
                      title="Settle Up"
                    >
                      <Handshake size={13} />
                      <span className="desktop-only">Settle</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="contact-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpen(e, f);
                    }}
                    title="More actions"
                    aria-label="More actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT UNIFIED LIST VIEW */
        <div className="contact-cards-container density-compact">
          {filtered.map((f, idx) => {
            const fType: ContactType = f.type || 'friend';
            const totalSpent = contactTotalSpent(db, f.id);
            const bal = friendBalance(db, f.id);
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;
            const brandLogo = renderBrandLogo(f.name, 18);

            return (
              <div
                key={`${f.id}-${idx}`}
                className="contact-card-item density-compact"
                onClick={() => onNavigate('friend-detail', f.id)}
              >
                {/* Contact Avatar & Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div
                    className="avatar"
                    style={{
                      ...getAvatarStyle(f.color),
                      width: 36,
                      height: 36,
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                    }}
                  >
                    {fType === 'subscription' ? (brandLogo || <Tv size={16} />) : fType === 'vendor' ? <Store size={16} /> : friendInitial(f.name, f.avatarNumber)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                      {f.name}
                    </span>
                    {typeFilter !== fType && fType !== 'friend' && (
                      <span className={`app-contact-badge ${fType}`}>
                        {fType}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Badge & Quick Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {isOwed ? (
                    <span className="contact-balance-pill credit">
                      Owes {fmtMoney(Math.abs(bal.net), currency)}
                    </span>
                  ) : isDebt ? (
                    <span className="contact-balance-pill debit">
                      You owe {fmtMoney(Math.abs(bal.net), currency)}
                    </span>
                  ) : fType === 'friend' ? (
                    <span className="contact-balance-pill settled">
                      Settled Up ✓
                    </span>
                  ) : (
                    <span className="contact-balance-pill neutral">
                      {fmtMoney(totalSpent, currency)}
                    </span>
                  )}

                  <button
                    type="button"
                    className="contact-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpen(e, f);
                    }}
                    title="More actions"
                    aria-label="More actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overflow Menu for Edit / Delete */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 0,
          sx: {
            borderRadius: '16px',
            minWidth: 160,
            padding: '4px',
            bgcolor: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border)',
            '& .MuiList-root': {
              padding: '2px 0',
            },
            '& .MuiMenuItem-root': {
              borderRadius: '10px',
              margin: '2px 4px',
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text)',
              gap: '10px',
              transition: 'all 0.15s ease',
              border: 'none !important',
              '&:hover': {
                bgcolor: 'var(--surface2)',
                color: 'var(--text)',
              },
              '& .MuiListItemIcon-root': {
                minWidth: 'auto',
                color: 'var(--text-2)',
              },
              '&.danger-item': {
                color: 'var(--debit, #ef4444)',
                '&:hover': {
                  bgcolor: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--debit, #ef4444)',
                },
                '& .MuiListItemIcon-root': {
                  color: 'var(--debit, #ef4444)',
                },
              },
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuFriend) setEditFriend(menuFriend);
            handleMenuClose();
          }}
        >
          <ListItemIcon><Edit2 size={15} /></ListItemIcon>
          <ListItemText primary="Edit Contact" primaryTypographyProps={{ fontSize: 13, fontWeight: 550, color: 'inherit' }} />
        </MenuItem>
        <MenuItem
          className="danger-item"
          onClick={() => {
            if (menuFriend) setDelId(menuFriend.id);
            handleMenuClose();
          }}
        >
          <ListItemIcon><Trash2 size={15} /></ListItemIcon>
          <ListItemText primary="Delete Contact" primaryTypographyProps={{ fontSize: 13, fontWeight: 550, color: 'inherit' }} />
        </MenuItem>
      </Menu>

      {/* Contact Filter & Sorting Drawer */}
      <ContactFilterBar
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        density={density}
        setDensity={setDensity}
        search={search}
        setSearch={setSearch}
        activeFilterCount={activeFilterCount}
        onClearAll={handleClearAll}
        counts={counts}
        filteredCount={filtered.length}
        friendStats={friendStats}
        vendorAndSubSpend={vendorAndSubSpend}
        currency={currency}
      />

      {/* Modals */}
      {showAdd && <FriendModal defaultType={addDefaultType} onClose={() => setShowAdd(false)} />}
      {editFriend && <FriendModal friend={editFriend} onClose={() => setEditFriend(null)} />}
      {settleFriend && <SettleModal friend={settleFriend} onClose={() => setSettleFriend(null)} />}
      {addExpFriend && (
        <ExpenseModal
          expense={{
            friendId: addExpFriend.id,
            type: addExpFriend.type === 'friend' ? 'for_friend' : 'personal',
            category: addExpFriend.category || undefined,
            description: addExpFriend.type === 'subscription' ? `${addExpFriend.name} Subscription` : addExpFriend.type === 'vendor' ? `${addExpFriend.name}` : '',
            amount: addExpFriend.defaultAmount || undefined,
          } as never}
          onClose={() => setAddExpFriend(null)}
        />
      )}
      {delId && (
        <ConfirmDialog
          title="Remove Contact"
          message="This will also remove all associated expenses and history. Are you sure?"
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}
