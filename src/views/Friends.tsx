import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HandshakeIcon from '@mui/icons-material/Handshake';
import PersonIcon from '@mui/icons-material/Person';
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

export default function Friends({ onNavigate }: Props) {
  const { db, deleteFriend, showToast } = useStore();
  const { friends, settings: { currency } } = db;
  const [editFriend, setEditFriend] = useState<Friend | null>(null);
  const [settleFriend, setSettleFriend] = useState<Friend | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = friends.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string) => {
    deleteFriend(id);
    setDelId(null);
    showToast('Friend removed');
  };

  const overallCredit = friends.reduce((s, f) => s + Math.max(0, friendBalance(db, f.id).net), 0);
  const overallDebt = friends.reduce((s, f) => s + Math.max(0, -friendBalance(db, f.id).net), 0);

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Friends</h1>
          <p className="page-subtitle">{friends.length} friend{friends.length !== 1 ? 's' : ''} · Owed to you: {fmtMoney(overallCredit, currency)}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <AddIcon fontSize="small" /> Add Friend
        </button>
      </div>

      {friends.length > 0 && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Friends</div>
            <div className="stat-value">{friends.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">You're Owed</div>
            <div className="stat-value credit">{fmtMoney(overallCredit, currency)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">You Owe</div>
            <div className="stat-value debit">{fmtMoney(overallDebt, currency)}</div>
          </div>
        </div>
      )}

      {friends.length > 3 && (
        <div className="filter-bar" style={{ marginBottom: 14 }}>
          <div className="search-input-wrap">
            <input className="form-input" placeholder="Search friends…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      )}

      {friends.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No friends yet</div>
            <p>Add friends to track shared expenses and settlements.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><AddIcon fontSize="small" /> Add Friend</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(f => {
            const bal = friendBalance(db, f.id);
            const expCount = db.expenses.filter(e => e.friendId === f.id).length;
            const unsettledCount = db.expenses.filter(e => e.friendId === f.id && !e.settled && e.type !== 'personal').length;
            return (
              <div key={f.id} className="card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('friend-detail', f.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar avatar-lg" style={{ background: f.color }}>{friendInitial(f.name)}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                      {f.email && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{f.email}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button className="btn-icon" style={{ padding: 5 }} onClick={() => setEditFriend(f)}><EditIcon style={{ fontSize: 14 }} /></button>
                    <button className="btn-icon" style={{ padding: 5, color: 'var(--debit)' }} onClick={() => setDelId(f.id)}><DeleteIcon style={{ fontSize: 14 }} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  {bal.owedToMe > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Owes you</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--credit)' }}>{fmtMoney(bal.owedToMe, currency)}</div>
                    </div>
                  )}
                  {bal.owedByMe > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>You owe</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--debit)' }}>{fmtMoney(bal.owedByMe, currency)}</div>
                    </div>
                  )}
                  {Math.abs(bal.net) < 0.005 && (
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>All settled up ✓</div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-3)', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span>{expCount} expense{expCount !== 1 ? 's' : ''} · {unsettledCount} unsettled</span>
                  {unsettledCount > 0 && (
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 11.5, padding: '4px 10px' }}
                      onClick={e => { e.stopPropagation(); setSettleFriend(f); }}>
                      <HandshakeIcon style={{ fontSize: 13 }} /> Settle
                    </button>
                  )}
                  {unsettledCount === 0 && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, padding: '4px 10px' }}
                      onClick={e => { e.stopPropagation(); onNavigate('friend-detail', f.id); }}>
                      <PersonIcon style={{ fontSize: 13 }} /> View
                    </button>
                  )}
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
