import React from 'react';
import {
  Users, User, CheckCircle2, RotateCcw, Edit2, Trash2,
  ChevronDown, ChevronUp, Store, Wallet as WalletIcon
} from 'lucide-react';
import CategoryIcon from '../CategoryIcon';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, typeLabel, cleanExpenseDescription, type GroupedExpense } from '../../utils';
import type { Expense, Friend, Wallet, Category, Settlement } from '../../types';

interface Props {
  ge: GroupedExpense;
  currency: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onUndo: (id: string) => void;
  groupStatus: { statusKey: string; statusLabel: string };
  categoryObj?: Category;
  walletObj?: Wallet;
  friendsMap: Map<string, Friend>;
  walletsMap?: Map<string, Wallet>;
  settlementObj?: Settlement | null;
}

export const ExpenseTableRow: React.FC<Props> = React.memo(({
  ge,
  currency,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onUndo,
  groupStatus,
  categoryObj,
  walletObj,
  friendsMap,
  walletsMap,
  settlementObj,
}) => {
  const primaryItem = ge.items[0];

  let effectiveWalletName = walletObj?.name || settlementObj?.paymentMethod || '—';
  if (ge.category === 'Transfer') {
    if (ge.fromWalletName && ge.toWalletName) {
      effectiveWalletName = `${ge.fromWalletName} → ${ge.toWalletName}`;
    } else {
      const outItem = ge.items.find((i: Expense) => i.flow === 'out');
      const inItem = ge.items.find((i: Expense) => i.flow === 'in');
      const fromW = outItem && walletsMap ? walletsMap.get(outItem.walletId) : null;
      const toW = inItem && walletsMap ? walletsMap.get(inItem.walletId) : null;
      if (fromW || toW) {
        effectiveWalletName = `${fromW?.name || 'Wallet'} → ${toW?.name || 'Wallet'}`;
      }
    }
  }

  const isIn = ge.flow === 'in' && ge.category !== 'Transfer';
  const friendsInGroup = ge.friendIds.map((fid: string) => friendsMap.get(fid)).filter(Boolean);
  const vendorId = ge.vendorId || ge.items.find((i: Expense) => i.vendorId)?.vendorId;
  const vendor = vendorId ? friendsMap.get(vendorId) : null;

  return (
    <React.Fragment>
      <tr className="modern-tx-row">
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="tx-squircle-icon"
              style={{
                background: categoryObj?.color && categoryObj.color.startsWith('#') ? `${categoryObj.color}20` : 'var(--accent-soft)',
                color: categoryObj?.color || 'var(--accent)'
              }}
            >
              <CategoryIcon category={ge.category} icon={categoryObj?.icon} size={20} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{ge.description}</span>
                {vendor && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3.5,
                      padding: '1.5px 7px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: 'var(--surface2)',
                      color: 'var(--text-2)',
                      border: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                    title={`Vendor / Store: ${vendor.name}`}
                  >
                    <Store size={11} style={{ color: 'var(--accent)' }} />
                    <span>{vendor.name}</span>
                  </span>
                )}
                {(ge.isSplit || ge.items.length > 1 || ge.isSettlementGroup) && (
                  <button
                    type="button"
                    onClick={() => onToggleExpand(ge.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    title={isExpanded ? "Collapse breakdown" : "Expand breakdown"}
                  >
                    <Users size={11} /> {ge.isSettlementGroup ? 'Settlement' : (ge.isSplit ? 'Split' : 'Breakdown')} {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{ge.category}</span>
                {ge.isSettlementGroup && <span>• {ge.settlementItemCount} item{ge.settlementItemCount! > 1 ? 's' : ''} settled</span>}
              </div>
              {friendsInGroup.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-3)' }}>
                  {friendsInGroup.map((f: Friend | undefined) => f && (
                    <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <div className="avatar avatar-sm" style={{ ...getAvatarStyle(f.color), width: 16, height: 16, fontSize: 8 }}>{friendInitial(f.name, f.avatarNumber)}</div>
                      <span>{f.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </td>
        <td>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {(() => {
              if (ge.isSettlementGroup) {
                return (
                  <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)' }}>
                    {ge.flow === 'in' ? '+' : '-'}{fmtMoney(ge.totalAmount, currency)}
                  </span>
                );
              }
              if (isIn) return <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: 'var(--credit)' }}>+{fmtMoney(ge.totalAmount, currency)}</span>;
              if (ge.isSplit) {
                return (
                  <>
                    <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)' }}>
                      {ge.flow === 'in' ? '+' : '-'}{fmtMoney(ge.totalAmount, currency)}
                    </span>
                    {ge.personalShare > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                        Your share: {fmtMoney(ge.personalShare, currency)}
                      </span>
                    )}
                  </>
                );
              }
              return <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', color: ge.flow === 'out' ? 'var(--debit)' : 'var(--credit)' }}>{ge.flow === 'out' ? '-' : '+'}{fmtMoney(ge.totalAmount, currency)}</span>;
            })()}
          </div>
        </td>
        <td>
          <span className="tx-type-pill">
            {ge.isSettlementGroup ? (
              <CheckCircle2 size={11} style={{ color: '#10b981' }} />
            ) : ge.isSplit ? (
              <Users size={11} style={{ color: 'var(--accent)' }} />
            ) : (
              <User size={11} style={{ color: 'var(--text-3)' }} />
            )}
            <span>{ge.isSettlementGroup ? 'Settlement' : (ge.isSplit ? 'Split Expense' : typeLabel(primaryItem.type, undefined, primaryItem.category))}</span>
          </span>
        </td>
        <td>
          <span className="tx-wallet-pill">
            <WalletIcon size={11} style={{ color: 'var(--text-3)' }} />
            <span>{effectiveWalletName}</span>
          </span>
        </td>
        <td>
          {groupStatus.statusKey !== 'none' && groupStatus.statusLabel ? (
            ge.isSettlementGroup ? (
              <span className="tx-status-pill status-settled">
                <span className="status-dot" />
                <span>Settled ✓</span>
              </span>
            ) : (
              <span className={`tx-status-pill status-${groupStatus.statusKey}`}>
                <span className="status-dot" />
                <span>{groupStatus.statusLabel}</span>
              </span>
            )
          ) : (
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
          )}
        </td>
        <td style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
            {ge.items.some((i: Expense) => i.settled || i.settlementId) && (
              <button
                type="button"
                className="tx-action-btn action-undo"
                onClick={() => {
                  const targetItem = ge.items.find((i: Expense) => i.settlementId) || ge.items.find((i: Expense) => i.settled) || primaryItem;
                  onUndo(targetItem.settlementId || targetItem.id || ge.id);
                }}
                title="Undo Settlement (Restore money to wallet)"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button type="button" className="tx-action-btn" onClick={() => onEdit(primaryItem)} title="Edit">
              <Edit2 size={14} />
            </button>
            <button type="button" className="tx-action-btn action-delete" onClick={() => onDelete(ge.id)} title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (ge.isSplit || ge.items.length > 1 || ge.isSettlementGroup) && (
        <tr style={{ background: 'var(--surface2)' }}>
          <td colSpan={6} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} style={{ color: 'var(--accent)' }} /> {ge.isSettlementGroup ? 'Settlement Breakdown' : (ge.isSplit ? 'Split Breakdown' : 'Breakdown')} (Total {fmtMoney(ge.totalAmount, currency)})
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {ge.items.filter((item: Expense) => !(item.type === 'personal' && (Number(item.amount) || 0) <= 0)).map((item: Expense, idx: number) => {
                const itemFriend = item.friendId ? friendsMap.get(item.friendId) : null;
                const isMine = item.type === 'personal';
                const name = itemFriend?.name ?? 'Contact';

                let roleLabel = 'My Share';
                let statusText = item.settled ? 'Settled ✓' : 'Your Expense';
                if (ge.isSettlementGroup) {
                  const itemDesc = cleanExpenseDescription(item.description);
                  const itemDateStr = fmtDate(item.originalDate || item.date);
                  roleLabel = `${itemDesc} (${itemDateStr})`;
                  statusText = 'Settled ✓';
                } else if (item.type === 'for_friend') {
                  roleLabel = item.settled ? `${name} paid you` : `${name} owes you`;
                  statusText = item.settled ? 'Settled ✓' : 'Owes You';
                } else if (item.type === 'by_friend') {
                  roleLabel = item.settled ? `Paid to ${name}` : `Unpaid to ${name}`;
                  statusText = item.settled ? 'Settled ✓' : 'Unpaid';
                }

                const isSubDebit = item.type === 'by_friend' || item.type === 'personal';
                const subSign = isSubDebit ? '-' : '+';
                const subColor = isSubDebit ? 'var(--debit)' : 'var(--credit)';

                return (
                  <div key={item.id || idx} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius, 8px)',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    minWidth: 210,
                  }}>
                    {isMine ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User size={16} style={{ color: 'var(--text-2)' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>My Share</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{statusText}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar avatar-sm" style={{ ...getAvatarStyle(itemFriend?.color), width: 22, height: 22, fontSize: 10 }}>
                          {itemFriend ? friendInitial(itemFriend.name, itemFriend.avatarNumber) : '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{roleLabel}</div>
                          <div style={{ fontSize: 10.5, color: item.settled ? 'var(--credit)' : 'var(--text-3)' }}>{statusText}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: subColor }}>
                        {subSign}{fmtMoney(Number(item.amount) || 0, currency)}
                      </div>
                      {item.type !== 'personal' && (
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                          {item.type === 'for_friend' ? 'lent' : 'borrowed'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});
