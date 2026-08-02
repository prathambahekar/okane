import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Handshake, Search, ChevronDown, ChevronUp, MoreVertical, User, Users, Store, Tv, ArrowUpRight } from 'lucide-react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useStore } from '../store';
import type { Friend, ContactType, ViewName } from '../types';
import { friendBalance, contactTotalSpent, contactTransactionCount, contactLastTransaction } from '../db';
import { fmtMoney, fmtDate, friendInitial } from '../utils';
import { renderBrandLogo } from '../components/BrandIcons';
import FriendModal from '../components/FriendModal';
import SettleModal from '../components/SettleModal';
import ExpenseModal from '../components/ExpenseModal';
import ConfirmDialog from '../components/ConfirmDialog';

interface Props {
  onNavigate: (v: ViewName, arg?: string) => void;
}

type FriendFilterStatus = 'all' | 'owes_me' | 'i_owe' | 'settled';

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
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Three-dot menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuFriend, setMenuFriend] = useState<Friend | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
    return friends.filter(f => {
      const fType = f.type || 'friend';
      if (fType !== typeFilter) return false;

      const matchesSearch =
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        (f.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.phone || '').includes(search) ||
        (f.category || '').toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (fType === 'friend') {
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
  }, [friends, search, typeFilter, statusFilter, db]);

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

      {/* Unified Search Bar with merged Stat Pill & + Add button row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div className="search-input-wrap" style={{ flex: '1 1 auto', minWidth: 0 }}>
          <Search size={15} className="search-icon" />
          <input
            className="form-input"
            style={{ height: 36, fontSize: 13 }}
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
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

        {/* Secondary Status Filter Segment Bar for Friends tab */}
        {typeFilter === 'friend' && counts.friend > 0 && (
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
      ) : typeFilter === 'subscription' ? (
        /* SPECIAL DEDICATED SUBSCRIPTION GRID */
        filtered.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>No subscriptions match search</div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Add subscriptions like Netflix, Spotify, Prime Video, or ChatGPT Plus to track monthly recurring bills.</p>
            <button
              className="btn btn-primary btn-sm"
              style={{ margin: '0 auto' }}
              onClick={() => {
                setAddDefaultType('subscription');
                setShowAdd(true);
              }}
            >
              <Plus size={15} /> Add Subscription
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filtered.map(f => {
              const totalSpent = contactTotalSpent(db, f.id);
              const txCount = contactTransactionCount(db, f.id);
              const lastTx = contactLastTransaction(db, f.id);
              const brandLogo = renderBrandLogo(f.name, 24);

              return (
                <div
                  key={f.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    position: 'relative',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* Top Header Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: f.color || '#9333EA',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          flexShrink: 0,
                          boxShadow: `0 4px 10px ${f.color || '#9333EA'}33`,
                        }}
                      >
                        {brandLogo || <Tv size={22} />}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#A855F7',
                              textTransform: 'uppercase',
                              letterSpacing: '0.3px',
                            }}
                          >
                            {f.category || 'Subscription'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <IconButton
                      size="small"
                      onClick={e => handleMenuOpen(e, f)}
                      style={{ color: 'var(--text-3)', padding: 4 }}
                    >
                      <MoreVertical size={16} />
                    </IconButton>
                  </div>

                  {/* Plan Price & Details */}
                  <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Plan Price</span>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
                        {f.defaultAmount ? fmtMoney(f.defaultAmount, currency) : 'Custom'}
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>
                          /{f.billingCycle || 'mo'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--border)', fontSize: 11.5 }}>
                      <span style={{ color: 'var(--text-3)' }}>Total Paid ({txCount})</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{fmtMoney(totalSpent, currency)}</span>
                    </div>

                    {lastTx && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4, textAlign: 'right' }}>
                        Last payment: {fmtDate(lastTx.date)}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, height: 32, fontSize: 12, gap: 4 }}
                      onClick={() => setAddExpFriend(f)}
                    >
                      <Plus size={14} /> Log Payment
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ height: 32, fontSize: 12, padding: '0 10px' }}
                      onClick={() => onNavigate('friend-detail', f.id)}
                    >
                      History
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '32px' }}>
            <p>No contacts match your current filter or search.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => { setTypeFilter('friend'); setStatusFilter('all'); setSearch(''); }}>
              Clear Filters
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(f => {
            const fType: ContactType = f.type || 'friend';
            const contactExpenses = db.expenses.filter(e => e.friendId === f.id);
            const totalSpent = contactTotalSpent(db, f.id);
            const txCount = contactTransactionCount(db, f.id);
            const lastTx = contactLastTransaction(db, f.id);
            const recent3 = [...contactExpenses]
              .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
              .slice(0, 3);

            const bal = friendBalance(db, f.id);
            const unsettledCount = contactExpenses.filter(e => !e.settled && e.type !== 'personal').length;
            const isExpanded = !!expandedIds[f.id];
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;

            return (
              <div
                key={f.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  transition: 'all var(--transition)',
                  boxShadow: isExpanded ? 'var(--shadow)' : 'none',
                }}
              >
                {/* Collapsed Header */}
                <div
                  onClick={() => toggleExpand(f.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      className="avatar"
                      style={{
                        background: f.color || '#3B82F6',
                        width: 38,
                        height: 38,
                        fontSize: 14,
                        fontWeight: 700,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {fType === 'subscription' ? (renderBrandLogo(f.name, 20) || <Tv size={18} />) : fType === 'vendor' ? <Store size={18} /> : friendInitial(f.name)}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </span>
                        {/* Show Type Badge only when viewing outside dedicated type tabs */}
                        {typeFilter !== fType && fType !== 'friend' && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: 4,
                              textTransform: 'uppercase',
                              letterSpacing: '0.4px',
                              background:
                                fType === 'vendor'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : fType === 'subscription'
                                  ? 'rgba(168, 85, 247, 0.15)'
                                  : 'rgba(59, 130, 246, 0.15)',
                              color:
                                fType === 'vendor'
                                  ? '#D97706'
                                  : fType === 'subscription'
                                  ? '#9333EA'
                                  : 'var(--accent)',
                              flexShrink: 0,
                            }}
                          >
                            {fType}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fType === 'friend' ? (
                          <>
                            {contactExpenses.length} expense{contactExpenses.length !== 1 ? 's' : ''}
                            {unsettledCount > 0 ? ` · ${unsettledCount} unsettled` : ''}
                          </>
                        ) : fType === 'vendor' ? (
                          <>
                            {f.category ? `${f.category} · ` : ''}
                            {txCount} order{txCount !== 1 ? 's' : ''}
                            {lastTx ? ` · Last: ${fmtDate(lastTx.date)}` : ''}
                          </>
                        ) : (
                          <>
                            {f.defaultAmount ? `${fmtMoney(f.defaultAmount, currency)}/${f.billingCycle || 'mo'} · ` : ''}
                            {txCount} payment{txCount !== 1 ? 's' : ''}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {/* Status / Spend Pill Badge */}
                    {fType === 'friend' ? (
                      isOwed ? (
                        <span
                          style={{
                            background: 'rgba(34, 197, 94, 0.12)',
                            color: 'var(--credit)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                            fontWeight: 600,
                            fontSize: 11.5,
                            padding: '3px 9px',
                            borderRadius: 99,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Owes {fmtMoney(Math.abs(bal.net), currency)}
                        </span>
                      ) : isDebt ? (
                        <span
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: 'var(--debit)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            fontWeight: 600,
                            fontSize: 11.5,
                            padding: '3px 9px',
                            borderRadius: 99,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          You owe {fmtMoney(Math.abs(bal.net), currency)}
                        </span>
                      ) : (
                        <span
                          style={{
                            background: 'var(--surface2)',
                            color: 'var(--text-3)',
                            border: '1px solid var(--border)',
                            fontWeight: 500,
                            fontSize: 11.5,
                            padding: '3px 9px',
                            borderRadius: 99,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Settled Up ✓
                        </span>
                      )
                    ) : (
                      <span
                        style={{
                          background: 'var(--surface2)',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          fontWeight: 700,
                          fontSize: 12,
                          padding: '3px 8px',
                          borderRadius: 99,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmtMoney(totalSpent, currency)}
                      </span>
                    )}

                    {/* Three-Dot Menu Button */}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuOpen(e, f);
                      }}
                      sx={{ color: 'text.secondary', p: 0.5 }}
                    >
                      <MoreVertical size={18} />
                    </IconButton>

                    {/* Chevron */}
                    <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)', animation: 'fadein 0.18s ease' }}>
                    {/* Recent 3 Transactions */}
                    <div style={{ paddingTop: 10, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                        Recent Activity
                      </div>
                      {recent3.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', padding: '4px 0' }}>
                          No recorded transactions yet with {f.name}.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {recent3.map(e => {
                            const isIn = e.type === 'for_friend' || e.flow === 'in';
                            return (
                              <div
                                key={e.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '7px 10px',
                                  background: 'var(--surface2)',
                                  borderRadius: 8,
                                  fontSize: 12.5,
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 500 }}>{e.description}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                                    {fmtDate(e.date)} · {e.category}
                                  </div>
                                </div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: fType === 'friend' ? (isIn ? 'var(--credit)' : 'var(--debit)') : 'var(--text-1)' }}>
                                  {fType === 'friend' ? (isIn ? '+' : '-') : ''}{fmtMoney(e.amount, currency)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Primary Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 12, padding: '5px 11px', borderRadius: 6, gap: 4 }}
                          onClick={() => setAddExpFriend(f)}
                        >
                          <Plus size={14} /> {fType === 'vendor' ? 'Log Purchase' : fType === 'subscription' ? 'Log Payment' : 'Add Expense'}
                        </button>

                        {fType === 'friend' && unsettledCount > 0 && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{
                              fontSize: 12,
                              padding: '5px 11px',
                              borderRadius: 6,
                              gap: 4,
                              background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
                            }}
                            onClick={() => setSettleFriend(f)}
                          >
                            <Handshake size={14} /> Settle Up
                          </button>
                        )}
                      </div>

                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 12, padding: '5px 8px', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => onNavigate('friend-detail', f.id)}
                      >
                        <span>Full History ({contactExpenses.length})</span>
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
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
