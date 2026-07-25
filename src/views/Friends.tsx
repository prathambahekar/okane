import { useState, useMemo } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HandshakeIcon from '@mui/icons-material/Handshake';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import { useStore } from '../store';
import type { Friend, ViewName } from '../types';
import { friendBalance } from '../db';
import { fmtMoney, friendInitial } from '../utils';
import FriendModal from '../components/FriendModal';
import SettleModal from '../components/SettleModal';
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
  const [showAdd, setShowAdd] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FriendFilterStatus>('all');

  const handleDelete = (id: string) => {
    deleteFriend(id);
    setDelId(null);
    showToast('Friend removed');
  };

  const overallCredit = useMemo(() => friends.reduce((s, f) => s + Math.max(0, friendBalance(db, f.id).net), 0), [friends, db]);
  const overallDebt = useMemo(() => friends.reduce((s, f) => s + Math.max(0, -friendBalance(db, f.id).net), 0), [friends, db]);

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Friends</h1>
          <p className="page-subtitle">{friends.length} friend{friends.length !== 1 ? 's' : ''} · Net Owed To You: {fmtMoney(overallCredit - overallDebt, currency)}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <AddIcon fontSize="small" /> Add Friend
        </button>
      </div>

      {/* Summary Stat Grid */}
      {friends.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Friends</div>
            <div className="stat-value">{friends.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Owed To You</div>
            <div className="stat-value credit">{fmtMoney(overallCredit, currency)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">You Owe</div>
            <div className="stat-value debit">{fmtMoney(overallDebt, currency)}</div>
          </div>
        </div>
      )}

      {/* Quick Status Filter Tabs */}
      {friends.length > 0 && (
        <div className="tab-list" style={{ marginBottom: 16 }}>
          <button className={`tab-btn ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
            All ({friends.length})
          </button>
          <button className={`tab-btn ${statusFilter === 'owes_me' ? 'active' : ''}`} onClick={() => setStatusFilter('owes_me')}
            style={{ color: statusFilter === 'owes_me' ? 'var(--credit)' : undefined }}>
            Owes You
          </button>
          <button className={`tab-btn ${statusFilter === 'i_owe' ? 'active' : ''}`} onClick={() => setStatusFilter('i_owe')}
            style={{ color: statusFilter === 'i_owe' ? 'var(--debit)' : undefined }}>
            You Owe
          </button>
          <button className={`tab-btn ${statusFilter === 'settled' ? 'active' : ''}`} onClick={() => setStatusFilter('settled')}>
            Settled Up
          </button>
        </div>
      )}

      {/* Search Input */}
      {friends.length > 3 && (
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <div className="search-input-wrap">
            <SearchIcon className="search-icon" />
            <input className="form-input" placeholder="Search friends by name, email, phone…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      )}

      {/* Friends Cards */}
      {friends.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No friends added yet</div>
            <p>Add friends to split bills, track shared expenses, and settle up easily.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><AddIcon fontSize="small" /> Add Friend</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '32px' }}>
            <p>No friends match the selected filter.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => { setStatusFilter('all'); setSearch(''); }}>Clear Filter</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(f => {
            const bal = friendBalance(db, f.id);
            const expCount = db.expenses.filter(e => e.friendId === f.id).length;
            const unsettledCount = db.expenses.filter(e => e.friendId === f.id && !e.settled && e.type !== 'personal').length;
            const isOwed = bal.net > 0.004;
            const isDebt = bal.net < -0.004;

            return (
              <div key={f.id} className="card" style={{ cursor: 'pointer', transition: 'all var(--transition)' }} onClick={() => onNavigate('friend-detail', f.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar avatar-lg" style={{ background: f.color }}>{friendInitial(f.name)}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{f.name}</div>
                      {f.email && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{f.email}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button className="btn-icon" style={{ padding: 5 }} onClick={() => setEditFriend(f)} title="Edit Friend"><EditIcon style={{ fontSize: 14 }} /></button>
                    <button className="btn-icon" style={{ padding: 5, color: 'var(--debit)' }} onClick={() => setDelId(f.id)} title="Delete Friend"><DeleteIcon style={{ fontSize: 14 }} /></button>
                  </div>
                </div>

                {/* Net Balance Pill */}
                <div style={{ marginBottom: 14 }}>
                  {isOwed ? (
                    <div style={{ background: 'rgba(46, 125, 50, 0.12)', padding: '8px 12px', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--credit)', fontWeight: 500 }}>Owes You</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--credit)' }}>+{fmtMoney(bal.owedToMe, currency)}</span>
                    </div>
                  ) : isDebt ? (
                    <div style={{ background: 'rgba(211, 47, 47, 0.12)', padding: '8px 12px', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--debit)', fontWeight: 500 }}>You Owe</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--debit)' }}>-{fmtMoney(bal.owedByMe, currency)}</span>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--surface2)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500, textAlign: 'center' }}>
                      Settled Up ✓
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-3)', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span>{expCount} expense{expCount !== 1 ? 's' : ''} · {unsettledCount} unsettled</span>
                  <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                    {unsettledCount > 0 && (
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 11.5, padding: '4px 10px' }}
                        onClick={() => setSettleFriend(f)}>
                        <HandshakeIcon style={{ fontSize: 13 }} /> Settle
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, padding: '4px 10px' }}
                      onClick={() => onNavigate('friend-detail', f.id)}>
                      <PersonIcon style={{ fontSize: 13 }} /> Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <FriendModal onClose={() => setShowAdd(false)} />}
      {editFriend && <FriendModal friend={editFriend} onClose={() => setEditFriend(null)} />}
      {settleFriend && <SettleModal friend={settleFriend} onClose={() => setSettleFriend(null)} />}
      {delId && (
        <ConfirmDialog title="Remove Friend"
          message="This will also remove all shared expenses and settlements with this friend. Are you sure?"
          onConfirm={() => handleDelete(delId)} onClose={() => setDelId(null)} />
      )}
    </div>
  );
}

