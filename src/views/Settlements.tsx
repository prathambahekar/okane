import { useState, useMemo } from 'react';
import { RotateCcw, Handshake, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import { useStore } from '../store';
import type { Friend } from '../types';
import { friendBalance } from '../db';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle } from '../utils';
import SettleModal from '../components/SettleModal';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Settlements() {
  const { db, deleteSettlement, showToast } = useStore();
  const { settlements, settings: { currency } } = db;
  const [settleFriend, setSettleFriend] = useState<Friend | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const targetS = settlements.find(x => x.id === delId);
  const targetF = targetS ? db.friends.find(f => f.id === targetS.friendId) : null;
  const targetW = targetS?.walletId ? db.wallets.find(w => w.id === targetS.walletId) : null;
  const targetWName = targetW?.name || targetS?.paymentMethod || 'wallet';

  const friendsWithUnsettled = db.friends.filter(f =>
    db.expenses.some(e => e.friendId === f.id && !e.settled && e.type !== 'personal')
  );

  const sorted = useMemo(() => [...settlements].sort((a, b) => b.createdAt - a.createdAt), [settlements]);

  const dateGroupInfo = useMemo(() => {
    const groupMap: Record<string, number> = {};
    const isFirstMap: Record<string, boolean> = {};
    let currentGroup = 0;
    let prevDate: string | null = null;

    sorted.forEach((s) => {
      if (prevDate !== null && s.date !== prevDate) {
        currentGroup++;
        isFirstMap[s.id] = true;
      } else {
        isFirstMap[s.id] = prevDate === null;
      }
      groupMap[s.id] = currentGroup % 2;
      prevDate = s.date;
    });

    return { groupMap, isFirstMap };
  }, [sorted]);

  const handleDelete = (id: string) => {
    deleteSettlement(id);
    setDelId(null);
    showToast('Settlement undone. Money restored to wallet.');
  };

  return (
    <div className="view-container">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Settlements</h1>
        </div>
      </div>

      {/* Pending settlements */}
      {friendsWithUnsettled.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Handshake size={15} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Pending Settlements</h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                {friendsWithUnsettled.length}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {friendsWithUnsettled.map(f => {
              const unsettledCount = db.expenses.filter(e => e.friendId === f.id && !e.settled && e.type !== 'personal').length;
              const bal = friendBalance(db, f.id);
              const owesYou = bal.net > 0.004;
              const youOwe = bal.net < -0.004;

              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 10px',
                    background: 'var(--surface2)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <div
                      className="avatar"
                      style={{
                        ...getAvatarStyle(f.color),
                        width: 32,
                        height: 32,
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                    >
                      {friendInitial(f.name, f.avatarNumber)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.2,
                        }}
                      >
                        {f.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', overflow: 'hidden', marginTop: 2 }}>
                        {owesYou ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--credit)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <ArrowDownLeft size={11} /> {fmtMoney(bal.net, currency)}
                          </span>
                        ) : youOwe ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--debit)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <ArrowUpRight size={11} /> {fmtMoney(Math.abs(bal.net), currency)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Net 0</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-3)', opacity: 0.6 }}>•</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          {unsettledCount} unsettled
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 6,
                      gap: 4,
                      background: 'var(--accent-gradient)',
                      color: 'var(--accent-contrast, #ffffff)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      height: 28,
                    }}
                    onClick={() => setSettleFriend(f)}
                  >
                    <Handshake size={12} /> Settle
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      <div className="card" style={{ padding: 0, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} style={{ color: 'var(--text-2)' }} /> Settlement History
        </div>
        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Handshake size={36} /></div>
            <div className="empty-state-title">No settlements yet</div>
            <p>When you settle up with friends, the records will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper desktop-only">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Friend</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Wallet / Method</th>
                    <th>Expenses</th>
                    <th>Note</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(s => {
                    const friend = db.friends.find(f => f.id === s.friendId);
                    const wallet = db.wallets.find(w => w.id === s.walletId);
                    const walletName = wallet?.name || s.paymentMethod;
                    const isEvenGroup = dateGroupInfo.groupMap[s.id] === 0;
                    const isFirstOfDate = dateGroupInfo.isFirstMap[s.id];
                    const rowClass = `${isEvenGroup ? 'date-row-even' : 'date-row-odd'}${isFirstOfDate ? ' date-row-first' : ''}`;

                    return (
                      <tr key={s.id} className={rowClass}>
                        <td>
                          {friend ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="avatar avatar-sm" style={getAvatarStyle(friend.color)}>{friendInitial(friend.name, friend.avatarNumber)}</div>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{friend.name}</span>
                            </div>
                          ) : <span style={{ color: 'var(--text-3)' }}>Deleted friend</span>}
                        </td>
                        <td style={{ fontWeight: 700, fontSize: 13.5, color: s.amount >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                          {s.amount >= 0 ? '+' : '-'}{fmtMoney(Math.abs(s.amount), currency)}
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(s.date)}</td>
                        <td>
                          {wallet ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="cat-dot" style={{ background: wallet.color }} />
                              <span style={{ fontSize: 12, fontWeight: 500 }}>{wallet.name}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{walletName || '—'}</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.expenseIds.length} expense{s.expenseIds.length !== 1 ? 's' : ''}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.note || '—'}
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDelId(s.id)}
                            title="Undo settlement"
                            style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.3)', padding: '4px 10px', fontSize: 11.5, gap: 4 }}
                          >
                            <RotateCcw size={13} /> Undo
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View for Settlements */}
            <div className="mobile-expense-list mobile-only">
              {sorted.map(s => {
                const friend = db.friends.find(f => f.id === s.friendId);
                const wallet = db.wallets.find(w => w.id === s.walletId);
                const walletName = wallet?.name || s.paymentMethod;
                return (
                  <div key={s.id} className="mobile-expense-card">
                    <div className="mobile-expense-header" style={{ cursor: 'default' }}>
                      <div className="mobile-expense-top">
                        <div className="mobile-expense-desc-wrap">
                          {friend ? (
                            <div className="avatar avatar-sm" style={{ ...getAvatarStyle(friend.color), width: 24, height: 24, fontSize: 11 }}>{friendInitial(friend.name, friend.avatarNumber)}</div>
                          ) : null}
                          <span className="mobile-expense-title">{friend ? friend.name : 'Deleted friend'}</span>
                        </div>
                        <div className="mobile-expense-amount" style={{ color: s.amount >= 0 ? 'var(--credit)' : 'var(--debit)' }}>
                          {s.amount >= 0 ? '+' : '-'}{fmtMoney(Math.abs(s.amount), currency)}
                        </div>
                      </div>

                      <div className="mobile-expense-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="mobile-expense-meta-left">
                          <span>{fmtDate(s.date)}</span>
                          {walletName && <span>· {walletName}</span>}
                          <span>·</span>
                          <span>{s.expenseIds.length} expense{s.expenseIds.length !== 1 ? 's' : ''}</span>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDelId(s.id)}
                          title="Undo settlement"
                          style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.3)', padding: '3px 8px', fontSize: 11, marginLeft: 'auto' }}
                        >
                          <RotateCcw size={12} /> Undo
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
        <ConfirmDialog
          title="Undo Settlement"
          message={`Are you sure you want to undo this settlement with ${targetF?.name || 'friend'}? ${fmtMoney(Math.abs(targetS?.amount || 0), currency)} will be restored to your ${targetWName} wallet and ${targetS?.expenseIds.length || 0} expense(s) will be marked as unsettled again.`}
          confirmLabel="Undo Settlement"
          danger={false}
          onConfirm={() => handleDelete(delId)}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}

