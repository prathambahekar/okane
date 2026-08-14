import { CheckSquare, Square } from 'lucide-react';
import type { Friend, Expense, AppDB } from '../../types';
import { fmtMoney, getAvatarStyle } from '../../utils';

interface DebtSettlementWidgetProps {
  friend: Friend | undefined;
  friendBal: { owedToMe: number; owedByMe: number; net: number };
  unsettledList: Expense[];
  selectedExpenseIds: string[];
  toggleSelectExpense: (id: string) => void;
  handleSettleAllDebts: () => void;
  amount: string;
  setAmount: (val: string) => void;
  autoSettle: boolean;
  setAutoSettle: (val: boolean) => void;
  db: AppDB;
  mode: 'pay_friend' | 'receive_from_friend';
}

export function DebtSettlementWidget({
  friend,
  friendBal,
  unsettledList,
  selectedExpenseIds,
  toggleSelectExpense,
  handleSettleAllDebts,
  amount,
  setAmount,
  autoSettle,
  setAutoSettle,
  db,
  mode,
}: DebtSettlementWidgetProps) {
  const s = db.settings;
  if (!friend) return null;

  const totalOwedInThisDirection = mode === 'receive_from_friend' ? friendBal.owedToMe : friendBal.owedByMe;

  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        marginBottom: 16,
        animation: 'fadein 0.15s ease',
      }}
    >
      {/* Top Balance Summary Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: unsettledList.length > 0 ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              ...getAvatarStyle(friend.color),
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {friend.name[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {friend.name}
          </span>
        </div>

        <div>
          {friendBal.owedToMe > 0 ? (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: '#2e7d32',
                background: 'rgba(46, 125, 50, 0.15)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              Owes you {fmtMoney(friendBal.owedToMe, s.currency)}
            </span>
          ) : friendBal.owedByMe > 0 ? (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: '#d97706',
                background: 'rgba(217, 119, 6, 0.15)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              You owe {fmtMoney(friendBal.owedByMe, s.currency)}
            </span>
          ) : (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 500,
                color: 'var(--text-3)',
              }}
            >
              Balanced
            </span>
          )}
        </div>
      </div>

      {/* Unsettled Debts Selector */}
      {unsettledList.length > 0 ? (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              {mode === 'receive_from_friend' ? 'Select Debt Being Repaid:' : 'Select Invoice/Debt to Settle:'}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '2px 8px', height: 24, borderRadius: 'var(--radius)' }}
              onClick={handleSettleAllDebts}
            >
              {unsettledList.every(e => selectedExpenseIds.includes(e.id)) ? 'Deselect All' : `Settle All (${fmtMoney(totalOwedInThisDirection, s.currency)})`}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 2 }}>
            {unsettledList.map(item => {
              const isSel = selectedExpenseIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelectExpense(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: 'var(--radius)',
                    border: isSel ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: isSel ? 'var(--surface)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {isSel ? (
                      <CheckSquare size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    ) : (
                      <Square size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12.5, fontWeight: isSel ? 600 : 500, color: 'var(--text)' }}>
                        {item.description}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                        {item.date} • {item.category}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: isSel ? 'var(--accent)' : 'var(--text)', flexShrink: 0, marginLeft: 8 }}>
                    {fmtMoney(item.amount, s.currency)}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedExpenseIds.length > 0 ? (() => {
            const selectedSum = Math.round(selectedExpenseIds.reduce((acc, id) => {
              const item = db.expenses.find(ex => ex.id === id);
              return acc + (item ? Number(item.amount) || 0 : 0);
            }, 0) * 100) / 100;
            const currentAmt = Math.round((parseFloat(amount) || 0) * 100) / 100;
            const diff = Math.round((selectedSum - currentAmt) * 100) / 100;
            const isPartial = currentAmt > 0 && diff > 0.01;

            return (
              <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                {/* Segment Toggle for Full vs Partial */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Payback Amount Type:
                  </div>
                  <div className="segment-control" style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={`segment-btn ${!isPartial && currentAmt === selectedSum ? 'active' : ''}`}
                      style={{ flex: 1, textAlign: 'center', justifyContent: 'center', padding: '5px 8px', fontSize: 11.5 }}
                      onClick={() => setAmount(String(selectedSum))}
                    >
                      Full Payback ({fmtMoney(selectedSum, s.currency)})
                    </button>
                    <button
                      type="button"
                      className={`segment-btn ${isPartial ? 'active' : ''}`}
                      style={{ flex: 1, textAlign: 'center', justifyContent: 'center', padding: '5px 8px', fontSize: 11.5 }}
                      onClick={() => {
                        if (!isPartial) setAmount(String(Math.round((selectedSum / 2) * 100) / 100));
                      }}
                    >
                      Custom / Partial Payback
                    </button>
                  </div>
                </div>

                {/* Inline Custom Amount Input */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                      Amount Paid Back ({s.currency})
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      Full Owed: {fmtMoney(selectedSum, s.currency)}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder={`e.g. 20 (Full is ${selectedSum})`}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}
                  />
                </div>

                {/* Partial Payback Feedback Box */}
                {isPartial ? (
                  <div style={{ fontSize: 11.5, color: '#d97706', background: 'rgba(217, 119, 6, 0.12)', border: '1px solid rgba(217, 119, 6, 0.25)', padding: '8px 10px', borderRadius: 6, marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>⚡ Custom Partial Payback Active</div>
                    <div>
                      {mode === 'receive_from_friend' ? 'Receiving' : 'Paying'}{' '}
                      <strong>{fmtMoney(currentAmt, s.currency)}</strong> now. 
                      The remaining <strong>{fmtMoney(diff, s.currency)}</strong> debt will stay active for {friend.name}.
                    </div>
                  </div>
                ) : currentAmt >= selectedSum && selectedSum > 0 ? (
                  <div style={{ fontSize: 11.5, color: '#2e7d32', background: 'rgba(46, 125, 50, 0.12)', border: '1px solid rgba(46, 125, 50, 0.25)', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
                    ✓ Full payback of {fmtMoney(selectedSum, s.currency)} will completely clear this debt!
                  </div>
                ) : null}

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoSettle}
                    onChange={e => setAutoSettle(e.target.checked)}
                  />
                  <span>Auto-update debt ledger upon saving</span>
                </label>
              </div>
            );
          })() : null}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 4 }}>
          No active unsettled bills/debts for this friend.
        </div>
      )}
    </div>
  );
}
