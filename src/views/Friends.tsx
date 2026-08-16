import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Handshake, Search, ChevronDown, ChevronUp, MoreVertical, User, Users, Store, Tv, ArrowUpDown, LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
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

interface Props {
  onNavigate: (v: ViewName, arg?: string) => void;
}

type FriendFilterStatus = 'all' | 'owes_me' | 'i_owe' | 'settled';
type SortOption = 'owed_desc' | 'owed_asc' | 'name' | 'recent' | 'expenses_count';
type DensityOption = 'compact' | 'detailed' | 'grid';

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
  const [density, setDensity] = useState<DensityOption>('compact');

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

  const [statsExpanded, setStatsExpanded] = useState(false);

  return (
    <div className="view-container">
      {/* Header Title */}
      <div className="page-header" style={{ marginBottom: 10 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>Contacts</h1>
          <p className="page-subtitle desktop-only" style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>
            Track shared expenses with friends, spending at vendors, and active subscriptions.
          </p>
        </div>
      </div>

      {/* Unified Search Bar with clear button & merged Stat Pill & + Add button row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <div className="search-input-wrap" style={{ flex: '1 1 auto', minWidth: 0, position: 'relative' }}>
          <Search size={15} className="search-icon" />
          <input
            className="form-input"
            style={{ height: 36, fontSize: 13, paddingRight: search ? 28 : 10 }}
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-3)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Merged Stat Summary Button */}
        <button
          type="button"
          onClick={() => setStatsExpanded(!statsExpanded)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            height: 36,
            padding: '0 10px',
            background: statsExpanded ? 'var(--surface2)' : 'var(--surface)',
            border: statsExpanded ? '1px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-2)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          title="Click to toggle full breakdown stats"
        >
          <User size={15} className="text-accent" style={{ flexShrink: 0 }} />
          <span className="hide-on-mobile" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--credit)' }}>+{fmtMoney(friendStats.credit, currency)}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 10 }}>/</span>
            <span style={{ color: 'var(--debit)' }}>-{fmtMoney(friendStats.debit, currency)}</span>
          </span>
          {statsExpanded ? (
            <ChevronUp size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          ) : (
            <ChevronDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          )}
        </button>

        <button
          className="btn btn-primary"
          style={{ whiteSpace: 'nowrap', flexShrink: 0, height: 36, padding: '0 10px', gap: 5, fontSize: 13, fontWeight: 600 }}
          onClick={() => {
            setAddDefaultType(typeFilter);
            setShowAdd(true);
          }}
          title="Add Contact / Vendor / Subscription"
        >
          <Plus size={16} style={{ flexShrink: 0 }} />
          <span className="hide-on-mobile">Add</span>
        </button>
      </div>

      {/* Full Stat Banners when expanded */}
      {statsExpanded && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 12, animation: 'fadein 0.15s ease' }}>
          {/* Friends Balance Banner */}
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                <User size={14} className="text-accent" />
                <span>Friends Owe Status</span>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{counts.friend} friends</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Owed to You</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--credit)' }}>
                  {fmtMoney(friendStats.credit, currency)}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>You Owe</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--debit)' }}>
                  {fmtMoney(Math.abs(friendStats.debit), currency)}
                </div>
              </div>
            </div>
          </div>

          {/* Vendors & Subscriptions Spending Banner */}
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                <Store size={14} style={{ color: '#F59E0B' }} />
                <span>Vendors & Subscriptions Spend</span>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{counts.vendor + counts.subscription} contacts</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Total Spent</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                  {fmtMoney(vendorAndSubSpend.total, currency)}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Subscriptions ({counts.subscription})</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>
                  {fmtMoney(vendorAndSubSpend.subTotal, currency)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs - Only Friends, Vendors, Subscriptions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        <div className="tab-list" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${typeFilter === 'friend' ? 'active' : ''}`} onClick={() => setTypeFilter('friend')}>
            <User size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Friends ({counts.friend})
            </span>
          </button>
          <button className={`tab-btn ${typeFilter === 'vendor' ? 'active' : ''}`} onClick={() => setTypeFilter('vendor')}>
            <Store size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Vendors ({counts.vendor})
            </span>
          </button>
          <button className={`tab-btn ${typeFilter === 'subscription' ? 'active' : ''}`} onClick={() => setTypeFilter('subscription')}>
            <Tv size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Subscriptions ({counts.subscription})
            </span>
          </button>
        </div>

        {/* Secondary Status Filter Segment Bar for Friends and Vendors tabs */}
        {(typeFilter === 'friend' || typeFilter === 'vendor') && counts[typeFilter] > 0 && (
          <div className="status-segment-bar">
            <button
              type="button"
              className={`status-segment-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`status-segment-btn owes-me ${statusFilter === 'owes_me' ? 'active' : ''}`}
              onClick={() => setStatusFilter('owes_me')}
            >
              <span className="status-dot status-dot-credit" /> Owes You
            </button>
            <button
              type="button"
              className={`status-segment-btn i-owe ${statusFilter === 'i_owe' ? 'active' : ''}`}
              onClick={() => setStatusFilter('i_owe')}
            >
              <span className="status-dot status-dot-debit" /> You Owe
            </button>
            <button
              type="button"
              className={`status-segment-btn settled ${statusFilter === 'settled' ? 'active' : ''}`}
              onClick={() => setStatusFilter('settled')}
            >
              Settled
            </button>
          </div>
        )}
      </div>

      {/* Sorting & Density Toolbar */}
      {friends.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{filtered.length} {typeFilter === 'friend' ? (filtered.length === 1 ? 'Friend' : 'Friends') : typeFilter === 'vendor' ? 'Vendors' : 'Subscriptions'}</span>
            {search && <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>(filtered)</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Sort Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface2)', padding: '2px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <ArrowUpDown size={12} style={{ color: 'var(--text-3)' }} />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '2px 0'
                }}
              >
                {(typeFilter === 'friend' || typeFilter === 'vendor') && <option value="owed_desc">Highest Owed</option>}
                {(typeFilter === 'friend' || typeFilter === 'vendor') && <option value="owed_asc">You Owe Most</option>}
                <option value="name">Name (A-Z)</option>
                <option value="recent">Recent Activity</option>
                <option value="expenses_count">Most Expenses</option>
              </select>
            </div>

            {/* Density Selector */}
            <div style={{ display: 'flex', background: 'var(--surface2)', padding: 2, borderRadius: 8, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setDensity('compact')}
                title="Compact List View"
                style={{
                  padding: '3px 6px',
                  borderRadius: 6,
                  border: 'none',
                  background: density === 'compact' ? 'var(--surface)' : 'transparent',
                  color: density === 'compact' ? 'var(--accent)' : 'var(--text-3)',
                  cursor: 'pointer',
                  boxShadow: density === 'compact' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDensity('detailed')}
                title="Detailed List View"
                style={{
                  padding: '3px 6px',
                  borderRadius: 6,
                  border: 'none',
                  background: density === 'detailed' ? 'var(--surface)' : 'transparent',
                  color: density === 'detailed' ? 'var(--accent)' : 'var(--text-3)',
                  cursor: 'pointer',
                  boxShadow: density === 'detailed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <SlidersHorizontal size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDensity('grid')}
                title="Card Grid View"
                style={{
                  padding: '3px 6px',
                  borderRadius: 6,
                  border: 'none',
                  background: density === 'grid' ? 'var(--surface)' : 'transparent',
                  color: density === 'grid' ? 'var(--accent)' : 'var(--text-3)',
                  cursor: 'pointer',
                  boxShadow: density === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts List / Dedicated Subscriptions View */}
      {friends.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={36} /></div>
            <div className="empty-state-title">No contacts added yet</div>
            <p>Add friends for splitting bills, vendors like Tiffin Aunty, or subscriptions like Netflix.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '32px' }}>
            <p>No contacts match your current filter or search.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => { setTypeFilter('friend'); setStatusFilter('all'); setSearch(''); }}>
              Clear Filters
            </button>
          </div>
        </div>
      ) : density === 'grid' || typeFilter === 'subscription' ? (
        /* GRID VIEW */
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
            const brandLogo = renderBrandLogo(f.name, 22);

            return (
              <div
                key={f.id}
                onClick={() => onNavigate('friend-detail', f.id)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
                      }}
                    >
                      {fType === 'subscription' ? (brandLogo || <Tv size={18} />) : fType === 'vendor' ? <Store size={18} /> : friendInitial(f.name, f.avatarNumber)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                        {fType === 'friend' ? `${contactExpenses.length} expenses` : fType === 'vendor' ? `${txCount} orders` : (f.defaultAmount ? `${fmtMoney(f.defaultAmount, currency)}/${formatBillingCycleShort(f.billingCycle)}` : `${txCount} payments`)}
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <div>
                    {isOwed ? (
                      <span style={{ background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)', fontWeight: 600, fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>
                        Owes {fmtMoney(Math.abs(bal.net), currency)}
                      </span>
                    ) : isDebt ? (
                      <span style={{ background: 'var(--debit-bg)', color: 'var(--debit)', border: '1px solid var(--debit-border)', fontWeight: 600, fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>
                        You owe {fmtMoney(Math.abs(bal.net), currency)}
                      </span>
                    ) : fType === 'friend' ? (
                      <span style={{ background: 'var(--surface2)', color: 'var(--text-3)', border: '1px solid var(--border)', fontWeight: 500, fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>
                        Settled Up ✓
                      </span>
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                        {fmtMoney(totalSpent, currency)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    {unsettledCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettleFriend(f);
                        }}
                        style={{ padding: '3px 7px', fontSize: 11, color: 'var(--credit)', background: 'var(--credit-bg)', border: '1px solid var(--credit-border)', gap: 3, borderRadius: 6 }}
                        title="Settle Up"
                      >
                        <Handshake size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddExpFriend(f);
                      }}
                      style={{ padding: '3px 8px', fontSize: 11, gap: 3, borderRadius: 6 }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT / DETAILED SINGLE-CARD LIST VIEW */
        <div className="contact-list-card">
          {filtered.map(f => {
            const fType: ContactType = f.type || 'friend';
            const contactExpenses = db.expenses.filter(e => e.friendId === f.id || e.vendorId === f.id);
            const totalSpent = contactTotalSpent(db, f.id);
            const txCount = contactTransactionCount(db, f.id);
            const bal = friendBalance(db, f.id);
            const unsettledCount = unsettledExpensesForFriend(db, f.id).length;
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;
            const brandLogo = renderBrandLogo(f.name, 18);

            return (
              <div
                key={f.id}
                className={`contact-row ${density === 'compact' ? 'contact-row-compact' : ''}`}
                onClick={() => onNavigate('friend-detail', f.id)}
              >
                {/* Contact Avatar & Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <div
                    className="avatar"
                    style={{
                      ...getAvatarStyle(f.color),
                      width: density === 'compact' ? 32 : 36,
                      height: density === 'compact' ? 32 : 36,
                      fontSize: density === 'compact' ? 12 : 13.5,
                      fontWeight: 700,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {fType === 'subscription' ? (brandLogo || <Tv size={16} />) : fType === 'vendor' ? <Store size={16} /> : friendInitial(f.name, f.avatarNumber)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: density === 'compact' ? 13 : 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </span>
                      {typeFilter !== fType && fType !== 'friend' && (
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', background: 'var(--surface2)', color: 'var(--accent)', flexShrink: 0 }}>
                          {fType}
                        </span>
                      )}
                    </div>

                    {density === 'detailed' && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fType === 'friend' ? (
                          <>
                            {contactExpenses.length} expense{contactExpenses.length !== 1 ? 's' : ''}
                            {unsettledCount > 0 ? ` · ${unsettledCount} unsettled` : ''}
                          </>
                        ) : fType === 'vendor' ? (
                          <>{f.category ? `${f.category} · ` : ''}{txCount} order{txCount !== 1 ? 's' : ''}</>
                        ) : (
                          <>{f.defaultAmount ? `${fmtMoney(f.defaultAmount, currency)}/${formatBillingCycleShort(f.billingCycle)}` : `${txCount} payments`}</>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Badge & Quick Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {isOwed ? (
                    <span style={{ background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)', fontWeight: 600, fontSize: 11, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      Owes {fmtMoney(Math.abs(bal.net), currency)}
                    </span>
                  ) : isDebt ? (
                    <span style={{ background: 'var(--debit-bg)', color: 'var(--debit)', border: '1px solid var(--debit-border)', fontWeight: 600, fontSize: 11, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
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

                  {/* Three-Dot Overflow Menu */}
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
