import { useState, useMemo } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useStore } from '../store';
import type { Friend, ViewName } from '../types';
import { friendBalance } from '../db';
import { fmtMoney, fmtDate, friendInitial } from '../utils';
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
  const [delId, setDelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
    showToast('Friend removed');
  };

  const filtered = useMemo(() => {
    return friends.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.email.toLowerCase().includes(search.toLowerCase()) ||
        f.phone.includes(search);
      if (!matchesSearch) return false;

      const bal = friendBalance(db, f.id);
      switch (statusFilter) {
        case 'owes_me': return bal.net > 0.004;
        case 'i_owe': return bal.net < -0.004;
        case 'settled': return Math.abs(bal.net) <= 0.004;
        case 'all': default: return true;
      }
    });
  }, [friends, search, statusFilter, db]);

  return (
    <div className="view-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Friends</h1>
        </div>
      </div>

      {/* Search Bar & Add Friend merged row + Status Filter Pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="search-input-wrap" style={{ flex: 1 }}>
            <SearchIcon className="search-icon" />
            <input
              className="form-input"
              placeholder="Search friends by name, email, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap', flexShrink: 0, height: 42, padding: '0 14px', gap: 6 }}
            onClick={() => setShowAdd(true)}
          >
            <AddIcon fontSize="small" /> Add Friend
          </button>
        </div>

        {friends.length > 0 && (
          <div className="tab-list" style={{ marginBottom: 0 }}>
            <button className={`tab-btn ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
              All ({friends.length})
            </button>
            <button
              className={`tab-btn ${statusFilter === 'owes_me' ? 'active' : ''}`}
              onClick={() => setStatusFilter('owes_me')}
              style={{ color: statusFilter === 'owes_me' ? 'var(--credit)' : undefined, borderBottomColor: statusFilter === 'owes_me' ? 'var(--credit)' : undefined }}
            >
              Owes You
            </button>
            <button
              className={`tab-btn ${statusFilter === 'i_owe' ? 'active' : ''}`}
              onClick={() => setStatusFilter('i_owe')}
              style={{ color: statusFilter === 'i_owe' ? 'var(--debit)' : undefined, borderBottomColor: statusFilter === 'i_owe' ? 'var(--debit)' : undefined }}
            >
              You Owe
            </button>
            <button className={`tab-btn ${statusFilter === 'settled' ? 'active' : ''}`} onClick={() => setStatusFilter('settled')}>
              Settled Up
            </button>
          </div>
        )}
      </div>

      {/* Friends Compact Expandable Cards */}
      {friends.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No friends added yet</div>
            <p>Add friends to split bills, track shared expenses, and settle up easily.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              <AddIcon fontSize="small" /> Add Friend
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '32px' }}>
            <p>No friends match the selected filter.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => { setStatusFilter('all'); setSearch(''); }}>
              Clear Filter
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(f => {
            const friendExpenses = db.expenses.filter(e => e.friendId === f.id);
            const recent3 = [...friendExpenses]
              .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
              .slice(0, 3);
            const bal = friendBalance(db, f.id);
            const unsettledCount = friendExpenses.filter(e => !e.settled && e.type !== 'personal').length;
            const isExpanded = !!expandedIds[f.id];
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;

            return (
              <div
                key={f.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
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
                    padding: '12px 14px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      className="avatar"
                      style={{ background: f.color, width: 38, height: 38, fontSize: 14, fontWeight: 700, flexShrink: 0 }}
                    >
                      {friendInitial(f.name)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                        {friendExpenses.length} expense{friendExpenses.length !== 1 ? 's' : ''}
                        {unsettledCount > 0 ? ` · ${unsettledCount} unsettled` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* Status Pill Badge */}
                    {isOwed ? (
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
                        Owes +{fmtMoney(bal.owedToMe, currency)}
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
                        You owe -{fmtMoney(bal.owedByMe, currency)}
                      </span>
                    ) : (
                      <span
                        style={{
                          background: 'var(--surface2)',
                          color: 'var(--text-3)',
                          border: '1px solid var(--border2)',
                          fontWeight: 500,
                          fontSize: 11.5,
                          padding: '3px 9px',
                          borderRadius: 99,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Settled Up ✓
                      </span>
                    )}

                    {/* Three-Dot Menu Button */}
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, f)}
                      sx={{ color: 'text.secondary', p: 0.5 }}
                    >
                      <MoreVertIcon style={{ fontSize: 18 }} />
                    </IconButton>

                    {/* Chevron */}
                    <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)', animation: 'fadein 0.18s ease' }}>
                    {/* Recent 3 Transactions */}
                    <div style={{ paddingTop: 10, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                        Recent Transactions
                      </div>
                      {recent3.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', padding: '4px 0' }}>
                          No recorded transactions with {f.name}.
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
                                <div style={{ fontWeight: 600, fontSize: 13, color: isIn ? 'var(--credit)' : 'var(--debit)' }}>
                                  {isIn ? '+' : '-'}{fmtMoney(e.amount, currency)}
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
                          style={{ fontSize: 12, padding: '5px 11px', borderRadius: 8, gap: 4 }}
                          onClick={() => setAddExpFriend(f)}
                        >
                          <AddIcon style={{ fontSize: 14 }} /> Add Expense
                        </button>
                        {unsettledCount > 0 && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{
                              fontSize: 12,
                              padding: '5px 11px',
                              borderRadius: 8,
                              gap: 4,
                              background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
                            }}
                            onClick={() => setSettleFriend(f)}
                          >
                            <HandshakeIcon style={{ fontSize: 14 }} /> Settle Up
                          </button>
                        )}
                      </div>

                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 12, padding: '5px 8px', color: 'var(--accent)', fontWeight: 600 }}
                        onClick={() => onNavigate('friend-detail', f.id)}
                      >
                        Full History ({friendExpenses.length}) →
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
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Edit Friend" primaryTypographyProps={{ fontSize: 13 }} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuFriend) setDelId(menuFriend.id);
            handleMenuClose();
          }}
          sx={{ fontSize: 13, gap: 1.5, color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary="Delete Friend" primaryTypographyProps={{ fontSize: 13, color: 'error.main' }} />
        </MenuItem>
      </Menu>

      {/* Modals */}
      {showAdd && <FriendModal onClose={() => setShowAdd(false)} />}
      {editFriend && <FriendModal friend={editFriend} onClose={() => setEditFriend(null)} />}
      {settleFriend && <SettleModal friend={settleFriend} onClose={() => setSettleFriend(null)} />}
      {addExpFriend && (
        <ExpenseModal
          expense={{ friendId: addExpFriend.id, type: 'for_friend' } as never}
          onClose={() => setAddExpFriend(null)}
        />
      )}
      {delId && (
        <ConfirmDialog
          title="Remove Friend"
          message="This will also remove all shared expenses and settlements with this friend. Are you sure?"
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}
