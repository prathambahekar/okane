import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import type { Friend, Expense, AppDB } from '../../types';
import { fmtMoney, getAvatarStyle } from '../../utils';
import SettleExpensePickerModal from '../SettleExpensePickerModal';

interface DebtSettlementWidgetProps {
  friend: Friend | undefined;
  friendBal: { owedToMe: number; owedByMe: number; net: number };
  unsettledList: Expense[];
  selectedExpenseIds: string[];
  toggleSelectExpense: (id: string) => void;
  handleSettleAllDebts?: () => void;
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
  amount,
  setAmount,
  autoSettle,
  setAutoSettle,
  db,
  mode,
}: DebtSettlementWidgetProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const s = db.settings;
  if (!friend) return null;

  const handleSelectAll = () => {
    unsettledList.forEach(e => {
      if (!selectedExpenseIds.includes(e.id)) {
        toggleSelectExpense(e.id);
      }
    });
  };

  const handleDeselectAll = () => {
    unsettledList.forEach(e => {
      if (selectedExpenseIds.includes(e.id)) {
        toggleSelectExpense(e.id);
      }
    });
  };

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

      {/* Unsettled Debts Tap-to-Select Selector */}
      {unsettledList.length > 0 ? (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {/* Tap-to-Select Card */}
          <div
            onClick={() => setIsPickerOpen(true)}
            style={{
              padding: '9px 11px',
              background: selectedExpenseIds.length > 0 ? 'var(--accent-soft)' : 'var(--surface)',
              border: selectedExpenseIds.length > 0 ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              transition: 'all 0.15s ease',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: 'var(--accent-contrast, #ffffff)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                <ReceiptText size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedExpenseIds.length === 0
                    ? 'Tap to Select Debts'
                    : selectedExpenseIds.length === unsettledList.length
                    ? `All ${unsettledList.length} Debts Selected`
                    : `${selectedExpenseIds.length} of ${unsettledList.length} Debts Selected`}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedExpenseIds.length > 0 ? (
                    <>
                      <span>Total: {fmtMoney(selectedExpenseIds.reduce((acc, id) => {
                        const item = db.expenses.find(ex => ex.id === id);
                        return acc + (item ? Number(item.amount) || 0 : 0);
                      }, 0), s.currency)}</span>
                      {' • '}
                      <span>{unsettledList.length} available</span>
                    </>
                  ) : (
                    `Choose from ${unsettledList.length} pending transaction${unsettledList.length !== 1 ? 's' : ''}`
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast, #ffffff)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
              }}
            >
              {selectedExpenseIds.length > 0 ? 'Edit' : '+ Select'}
            </button>
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
              <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
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

          {/* Settle Expense Drawer Picker for Debt Widget */}
          {isPickerOpen && (
            <SettleExpensePickerModal
              isOpen={isPickerOpen}
              onClose={() => setIsPickerOpen(false)}
              friend={friend}
              expenses={unsettledList}
              selectedIds={new Set(selectedExpenseIds)}
              onToggle={toggleSelectExpense}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              currency={s.currency}
              db={db}
              title={mode === 'receive_from_friend' ? 'Select Debts to Settle' : 'Select Invoices to Settle'}
            />
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 4 }}>
          No active unsettled bills/debts for this friend.
        </div>
      )}
    </div>
  );
}
