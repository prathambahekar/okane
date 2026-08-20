import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  SlidersHorizontal,
  X,
  RotateCcw,
} from 'lucide-react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useStore } from '../store';
import type { Friend, ContactType, ViewName } from '../types';
import { friendBalance, contactTotalSpent, contactTransactionCount, contactLastTransaction, unsettledExpensesForFriend } from '../db';
import { fmtMoney, friendInitial, getAvatarStyle, formatBillingCycleShort } from '../utils';
import { renderBrandLogo } from '../components/BrandIcons';
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
  const isDevMode = db.settings?.devMode ?? false;
  const enableAIAssistant = isDevMode && (db.settings?.enableAIAssistant ?? true);

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
  const [density, setDensity] = useState<DensityOption>('compact');
  const [showFilters, setShowFilters] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(() => {
    if (typeof document !== 'undefined') {
      return document.getElementById('floating-extra-actions-slot');
    }
    return null;
  });

  useEffect(() => {
    if (!portalTarget) {
      const interval = setInterval(() => {
        const slot = document.getElementById('floating-extra-actions-slot');
        if (slot) {
          setPortalTarget(slot);
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [portalTarget]);

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
        credit += b.owedToMe;
        debit += b.owedByMe;
      }
    });
    return { credit, debit, net: credit - debit };
  }, [friends, db]);

  const vendorAndSubSpend = useMemo(() => {
    let vendorTotal = 0;
    let subTotal = 0;
    friends.forEach(f => {
      const fType = f.type || 'friend';
      const spent = contactTotalSpent(db, f.id);
      if (fType === 'vendor') vendorTotal += spent;
      if (fType === 'subscription') subTotal += spent;
    });
    return { vendorTotal, subTotal, total: vendorTotal + subTotal };
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
    if (density !== 'compact') count++;
    if (search.trim() !== '') count++;
    return count;
  }, [statusFilter, sortBy, density, search]);

  const handleClearAll = () => {
    setStatusFilter('all');
    setSortBy('owed_desc');
    setDensity('compact');
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
        if (sortBy === 'owed_desc') return balB - balA;
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
      {/* Header Title */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1 className="page-title">Contacts</h1>
        <p className="page-subtitle desktop-only" style={{ fontSize: 13, color: 'var(--text-3)', margin: '2px 0 0' }}>
          Track shared expenses with friends, spending at vendors, and active subscriptions.
        </p>
      </div>

      {/* Clean Tab Segmented Switch & Filter Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', minWidth: 0 }}>
          {/* Contact Type Segmented Switch */}
          <div className="contact-type-switch" style={{ flex: '1 1 auto', minWidth: 0 }}>
            <button
              type="button"
              className={`type-btn ${typeFilter === 'friend' ? 'active' : ''}`}
              onClick={() => setTypeFilter('friend')}
              title="Friends"
              aria-label="Friends"
            >
              <User size={15} style={{ flexShrink: 0, color: typeFilter === 'friend' ? 'var(--accent)' : 'inherit' }} />
              <span className="type-label desktop-only">Friends</span>
              <span className="type-badge">{counts.friend}</span>
            </button>

            <button
              type="button"
              className={`type-btn ${typeFilter === 'vendor' ? 'active' : ''}`}
              onClick={() => setTypeFilter('vendor')}
              title="Vendors"
              aria-label="Vendors"
            >
              <Store size={15} style={{ flexShrink: 0, color: typeFilter === 'vendor' ? 'var(--accent)' : 'inherit' }} />
              <span className="type-label desktop-only">Vendors</span>
              <span className="type-badge">{counts.vendor}</span>
            </button>

            <button
              type="button"
              className={`type-btn ${typeFilter === 'subscription' ? 'active' : ''}`}
              onClick={() => setTypeFilter('subscription')}
              title="Subscriptions"
              aria-label="Subscriptions"
            >
              <Tv size={15} style={{ flexShrink: 0, color: typeFilter === 'subscription' ? 'var(--accent)' : 'inherit' }} />
              <span className="type-label desktop-only">Subscriptions</span>
              <span className="type-badge">{counts.subscription}</span>
            </button>
          </div>

          {/* Right Action: Filter Button */}
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              height: 38,
              padding: '0 8px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: activeFilterCount > 0 ? 'var(--accent-soft)' : 'var(--surface2)',
              color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-2)',
              border: activeFilterCount > 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            title="Filters & Sorting"
            aria-label="Open Filters"
          >
            <SlidersHorizontal size={14} style={{ color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-2)' }} />
            <span className="desktop-only">Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-contrast, #ffffff)',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '999px',
                  padding: '1px 5px',
                  lineHeight: 1.2,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Filter Chips (if any filter is applied) */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '0 2px' }}>
            {search && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Search: "{search}"
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {statusFilter !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Status: {statusLabel}
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {sortBy !== 'owed_desc' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Sort: {sortLabel}
                <button
                  type="button"
                  onClick={() => setSortBy('owed_desc')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {density !== 'compact' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border-soft, var(--accent))',
                  fontWeight: 500,
                }}
              >
                Layout: {density === 'detailed' ? 'Detailed' : 'Grid'}
                <button
                  type="button"
                  onClick={() => setDensity('compact')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    padding: 0,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearAll}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <RotateCcw size={10} />
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Contacts List / Dedicated Subscriptions View */}
      {counts[typeFilter] === 0 ? (
        <div className="card" style={{ border: '1px solid var(--border)' }}>
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            <div className="empty-state-icon" style={{ opacity: 0.65, color: 'var(--text-3)' }}>
              {typeFilter === 'vendor' ? (
                <Store size={40} />
              ) : typeFilter === 'subscription' ? (
                <Tv size={40} />
              ) : (
                <Users size={40} />
              )}
            </div>
            <div className="empty-state-title" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
              {typeFilter === 'friend'
                ? 'No friends yet'
                : typeFilter === 'vendor'
                ? 'No vendors yet'
                : 'No subscriptions yet'}
            </div>
            <p style={{ maxWidth: '340px', margin: '0 auto 20px', color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.5 }}>
              {typeFilter === 'friend'
                ? 'Add friends to track shared expenses and balances.'
                : typeFilter === 'vendor'
                ? 'Add vendors and shops to log orders and payments.'
                : 'Add subscriptions to manage renewals and recurring bills.'}
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAddDefaultType(typeFilter);
                setShowAdd(true);
              }}
            >
              <Plus size={15} />{' '}
              {typeFilter === 'friend'
                ? 'Add Friend'
                : typeFilter === 'vendor'
                ? 'Add Vendor'
                : 'Add Subscription'}
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '32px' }}>
            <p>
              No{' '}
              {typeFilter === 'friend'
                ? 'friends'
                : typeFilter === 'vendor'
                ? 'vendors'
                : 'subscriptions'}{' '}
              match your current filter or search.
            </p>
            <button className="btn btn-ghost btn-sm" onClick={handleClearAll}>
              Clear Filters
            </button>
          </div>
        </div>
      ) : density === 'grid' || typeFilter === 'subscription' ? (
        /* GRID CARDS VIEW */
        <div className="contact-grid">
          {filtered.map(f => {
            const fType: ContactType = f.type || 'friend';
            const contactExpenses = db.expenses.filter(e => e.friendId === f.id || e.vendorId === f.id);
            const totalSpent = contactTotalSpent(db, f.id);
            const txCount = contactTransactionCount(db, f.id);
            const bal = friendBalance(db, f.id);
            const unsettledCount = unsettledExpensesForFriend(db, f.id).length;
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;
            const brandLogo = renderBrandLogo(f.name, 20);

            return (
              <div
                key={f.id}
                className="contact-grid-card"
                onClick={() => onNavigate('friend-detail', f.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      className="avatar"
                      style={{
                        ...getAvatarStyle(f.color),
                        width: 38,
                        height: 38,
                        fontSize: 13.5,
                        fontWeight: 700,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 11,
                      }}
                    >
                      {fType === 'subscription' ? (brandLogo || <Tv size={18} />) : fType === 'vendor' ? <Store size={18} /> : friendInitial(f.name, f.avatarNumber)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 650, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fType === 'friend' ? `${contactExpenses.length} expense${contactExpenses.length !== 1 ? 's' : ''}` : fType === 'vendor' ? `${txCount} order${txCount !== 1 ? 's' : ''}` : (f.defaultAmount ? `${fmtMoney(f.defaultAmount, currency)}/${formatBillingCycleShort(f.billingCycle)}` : `${txCount} payments`)}
                      </div>
                    </div>
                  </div>

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpen(e, f);
                    }}
                    sx={{ color: 'text.secondary', p: 0.5 }}
                  >
                    <MoreVertical size={16} />
                  </IconButton>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    {isOwed ? (
                      <span style={{ background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)', fontWeight: 650, fontSize: 11.5, padding: '3px 9px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Owes {fmtMoney(Math.abs(bal.net), currency)}
                      </span>
                    ) : isDebt ? (
                      <span style={{ background: 'var(--debit-bg)', color: 'var(--debit)', border: '1px solid var(--debit-border)', fontWeight: 650, fontSize: 11.5, padding: '3px 9px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        You owe {fmtMoney(Math.abs(bal.net), currency)}
                      </span>
                    ) : fType === 'friend' ? (
                      <span style={{ background: 'var(--surface2)', color: 'var(--text-3)', border: '1px solid var(--border)', fontWeight: 550, fontSize: 11.5, padding: '3px 9px', borderRadius: 99 }}>
                        Settled Up ✓
                      </span>
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
                        {fmtMoney(totalSpent, currency)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {unsettledCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettleFriend(f);
                        }}
                        style={{ padding: '4px 8px', fontSize: 11.5, color: 'var(--credit)', background: 'var(--credit-bg)', border: '1px solid var(--credit-border)', gap: 4, borderRadius: 8, height: 28 }}
                        title="Settle Up"
                      >
                        <Handshake size={13} />
                        <span style={{ fontWeight: 600 }}>Settle</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddExpFriend(f);
                      }}
                      style={{ padding: '4px 8px', fontSize: 11.5, gap: 3, borderRadius: 8, height: 28, background: 'var(--surface2)', border: '1px solid var(--border)' }}
                      title="Add Expense"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : density === 'detailed' ? (
        /* DETAILED FLOATING CARDS VIEW */
        <div className="contact-cards-container density-detailed">
          {filtered.map(f => {
            const fType: ContactType = f.type || 'friend';
            const contactExpenses = db.expenses.filter(e => e.friendId === f.id || e.vendorId === f.id);
            const totalSpent = contactTotalSpent(db, f.id);
            const txCount = contactTransactionCount(db, f.id);
            const bal = friendBalance(db, f.id);
            const unsettledCount = unsettledExpensesForFriend(db, f.id).length;
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;
            const brandLogo = renderBrandLogo(f.name, 20);

            return (
              <div
                key={f.id}
                className="contact-card-item density-detailed"
                onClick={() => onNavigate('friend-detail', f.id)}
              >
                {/* Contact Avatar & Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div
                    className="avatar"
                    style={{
                      ...getAvatarStyle(f.color),
                      width: 40,
                      height: 40,
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 650, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </span>
                      {typeFilter !== fType && fType !== 'friend' && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1.5px 6px', borderRadius: 6, textTransform: 'uppercase', background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border-soft, transparent)', flexShrink: 0 }}>
                          {fType}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    <span style={{ background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)', fontWeight: 650, fontSize: 12, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      Owes {fmtMoney(Math.abs(bal.net), currency)}
                    </span>
                  ) : isDebt ? (
                    <span style={{ background: 'var(--debit-bg)', color: 'var(--debit)', border: '1px solid var(--debit-border)', fontWeight: 650, fontSize: 12, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      You owe {fmtMoney(Math.abs(bal.net), currency)}
                    </span>
                  ) : fType === 'friend' ? (
                    <span style={{ background: 'var(--surface2)', color: 'var(--text-3)', border: '1px solid var(--border)', fontWeight: 550, fontSize: 11.5, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      Settled Up ✓
                    </span>
                  ) : (
                    <span style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 650, fontSize: 12, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      {fmtMoney(totalSpent, currency)}
                    </span>
                  )}

                  {unsettledCount > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettleFriend(f);
                      }}
                      style={{ padding: '4px 8px', fontSize: 11.5, color: 'var(--credit)', background: 'var(--credit-bg)', border: '1px solid var(--credit-border)', gap: 4, borderRadius: 8, height: 30 }}
                      title="Settle Up"
                    >
                      <Handshake size={13} />
                      <span style={{ fontWeight: 600 }} className="desktop-only">Settle</span>
                    </button>
                  )}

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpen(e, f);
                    }}
                    sx={{ color: 'text.secondary', p: 0.5 }}
                  >
                    <MoreVertical size={16} />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT FLOATING CARDS VIEW */
        <div className="contact-cards-container density-compact">
          {filtered.map(f => {
            const fType: ContactType = f.type || 'friend';
            const totalSpent = contactTotalSpent(db, f.id);
            const bal = friendBalance(db, f.id);
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;
            const brandLogo = renderBrandLogo(f.name, 16);

            return (
              <div
                key={f.id}
                className="contact-card-item density-compact"
                onClick={() => onNavigate('friend-detail', f.id)}
              >
                {/* Contact Avatar & Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <div
                    className="avatar"
                    style={{
                      ...getAvatarStyle(f.color),
                      width: 32,
                      height: 32,
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 9,
                    }}
                  >
                    {fType === 'subscription' ? (brandLogo || <Tv size={15} />) : fType === 'vendor' ? <Store size={15} /> : friendInitial(f.name, f.avatarNumber)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                    {typeFilter !== fType && fType !== 'friend' && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', background: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0 }}>
                        {fType}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Badge & Quick Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {isOwed ? (
                    <span style={{ background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)', fontWeight: 650, fontSize: 11, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      Owes {fmtMoney(Math.abs(bal.net), currency)}
                    </span>
                  ) : isDebt ? (
                    <span style={{ background: 'var(--debit-bg)', color: 'var(--debit)', border: '1px solid var(--debit-border)', fontWeight: 650, fontSize: 11, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      You owe {fmtMoney(Math.abs(bal.net), currency)}
                    </span>
                  ) : fType === 'friend' ? (
                    <span style={{ background: 'var(--surface2)', color: 'var(--text-3)', border: '1px solid var(--border)', fontWeight: 500, fontSize: 11, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      Settled Up ✓
                    </span>
                  ) : (
                    <span style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 600, fontSize: 11, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      {fmtMoney(totalSpent, currency)}
                    </span>
                  )}

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpen(e, f);
                    }}
                    sx={{ color: 'text.secondary', p: 0.25 }}
                  >
                    <MoreVertical size={16} />
                  </IconButton>
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
          sx: {
            borderRadius: 2,
            minWidth: 140,
            boxShadow: 'var(--shadow)',
            bgcolor: 'background.paper',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuFriend) setEditFriend(menuFriend);
            handleMenuClose();
          }}
          sx={{ fontSize: 13, gap: 1.5 }}
        >
          <ListItemIcon><Edit2 size={16} /></ListItemIcon>
          <ListItemText primary="Edit Contact" primaryTypographyProps={{ fontSize: 13 }} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuFriend) setDelId(menuFriend.id);
            handleMenuClose();
          }}
          sx={{ fontSize: 13, gap: 1.5, color: 'error.main' }}
        >
          <ListItemIcon><Trash2 size={16} style={{ color: 'var(--debit)' }} /></ListItemIcon>
          <ListItemText primary="Delete Contact" primaryTypographyProps={{ fontSize: 13, color: 'error.main' }} />
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

      {/* Floating Add Contact Button - placed directly inside the floating action stack above search bar */}
      {portalTarget ? (
        createPortal(
          <button
            type="button"
            id="floating-add-contact-btn"
            className="floating-add-contact-btn"
            onClick={() => {
              setAddDefaultType(typeFilter);
              setShowAdd(true);
            }}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'var(--surface2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface3)';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface2)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text)';
              e.currentTarget.style.transform = 'none';
            }}
            onMouseDown={e => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            title={typeFilter === 'friend' ? 'Add Friend' : typeFilter === 'vendor' ? 'Add Vendor' : 'Add Subscription'}
            aria-label={typeFilter === 'friend' ? 'Add Friend' : typeFilter === 'vendor' ? 'Add Vendor' : 'Add Subscription'}
          >
            <Plus size={19} />
          </button>,
          portalTarget
        )
      ) : (
        <button
          type="button"
          id="floating-add-contact-btn"
          className="floating-add-contact-btn"
          onClick={() => {
            setAddDefaultType(typeFilter);
            setShowAdd(true);
          }}
          style={{
            position: 'fixed',
            bottom: enableAIAssistant
              ? 'calc(env(safe-area-inset-bottom, 0px) + 192px)'
              : 'calc(env(safe-area-inset-bottom, 0px) + 134px)',
            right: '16px',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: 'var(--surface2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 998,
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'var(--surface3)';
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'var(--surface2)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text)';
            e.currentTarget.style.transform = 'none';
          }}
          onMouseDown={e => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          title={typeFilter === 'friend' ? 'Add Friend' : typeFilter === 'vendor' ? 'Add Vendor' : 'Add Subscription'}
          aria-label={typeFilter === 'friend' ? 'Add Friend' : typeFilter === 'vendor' ? 'Add Vendor' : 'Add Subscription'}
        >
          <Plus size={19} />
        </button>
      )}

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
