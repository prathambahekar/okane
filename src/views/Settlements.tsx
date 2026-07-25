import { useState } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { useStore } from '../store';
import type { Friend } from '../types';
import { fmtMoney, fmtDate, friendInitial } from '../utils';
import SettleModal from '../components/SettleModal';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Settlements() {
  const { db, deleteSettlement, showToast } = useStore();
  const { settlements, settings: { currency } } = db;
  const [settleFriend, setSettleFriend] = useState<Friend | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const friendsWithUnsettled = db.friends.filter(f =>
    db.expenses.some(e => e.friendId === f.id && !e.settled && e.type !== 'personal')
  );

  const sorted = [...settlements].sort((a, b) => b.createdAt - a.createdAt);

  const handleDelete = (id: string) => {
    deleteSettlement(id);
    setDelId(null);
    showToast('Settlement undone');
  };

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settlements</h1>
          <p className="page-subtitle">{settlements.length} settlement{settlements.length !== 1 ? 's' : ''} recorded</p>
        </div>
      </div>

      {/* Pending settlements */}
      {friendsWithUnsettled.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Pending Settlements</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {friendsWithUnsettled.map(f => {
              const count = db.expenses.filter(e => e.friendId === f.id && !e.settled && e.type !== 'personal').length;
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div className="avatar avatar-sm" style={{ background: f.color }}>{friendInitial(f.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{count} unsettled</div>
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ fontSize: 11.5, padding: '5px 10px' }}
                    onClick={() => setSettleFriend(f)}>
                    <HandshakeIcon style={{ fontSize: 13 }} /> Settle
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>Settlement History</div>
        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤝</div>
            <div className="empty-state-title">No settlements yet</div>
            <p>When you settle up with friends, the records will appear here.</p>
          </div>
        ) : (
          <>
            <table className="data-table desktop-only">
              <thead>
                <tr>
                  <th>Friend</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Expenses</th>
                  <th>Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(s => {
                  const friend = db.friends.find(f => f.id === s.friendId);
                  return (
                    <tr key={s.id}>
                      <td>
                        {friend ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="avatar avatar-sm" style={{ background: friend.color }}>{friendInitial(friend.name)}</div>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{friend.name}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-3)' }}>Deleted friend</span>}
                      </td>
                      <td style={{ fontWeight: 500, color: s.amount >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                        {fmtMoney(Math.abs(s.amount), currency)}
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(s.date)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.expenseIds.length} expense{s.expenseIds.length !== 1 ? 's' : ''}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.note || '—'}
                      </td>
                      <td>
                        <button className="btn-icon" onClick={() => setDelId(s.id)} title="Undo settlement" style={{ color: 'var(--debit)' }}>
                          <DeleteIcon fontSize="small" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile View for Settlements */}
            <div className="mobile-expense-list mobile-only">
              {sorted.map(s => {
                const friend = db.friends.find(f => f.id === s.friendId);
                return (
                  <div key={s.id} className="mobile-expense-card">
                    <div className="mobile-expense-header" style={{ cursor: 'default' }}>
                      <div className="mobile-expense-top">
                        <div className="mobile-expense-desc-wrap">
                          {friend ? (
                            <div className="avatar avatar-sm" style={{ background: friend.color, width: 22, height: 22, fontSize: 10 }}>{friendInitial(friend.name)}</div>
                          ) : null}
                          <span className="mobile-expense-title">{friend ? friend.name : 'Deleted friend'}</span>
                        </div>
                        <div className="mobile-expense-amount" style={{ color: s.amount >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                          {fmtMoney(Math.abs(s.amount), currency)}
                        </div>
                      </div>

                      <div className="mobile-expense-meta">
                        <div className="mobile-expense-meta-left">
                          <span>{fmtDate(s.date)}</span>
                          <span>·</span>
                          <span>{s.expenseIds.length} expense{s.expenseIds.length !== 1 ? 's' : ''}</span>
                          {s.note && <span>· {s.note}</span>}
                        </div>
                        <button className="btn-icon" onClick={() => setDelId(s.id)} title="Undo settlement" style={{ color: 'var(--debit)', padding: 4, marginLeft: 'auto' }}>
                          <DeleteIcon fontSize="small" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {settleFriend && <SettleModal friend={settleFriend} onClose={() => setSettleFriend(null)} />}
      {delId && (
        <ConfirmDialog title="Undo Settlement"
          message="This will mark all associated expenses as unsettled again. Continue?"
          confirmLabel="Undo" danger={false}
          onConfirm={() => handleDelete(delId)} onClose={() => setDelId(null)} />
      )}
    </div>
  );
}
