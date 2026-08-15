import React from 'react';
import {
  Users, User, RotateCcw, Edit2, Trash2,
  ChevronDown, ChevronUp, Store
} from 'lucide-react';
import CategoryIcon, { CategoryBadge } from '../CategoryIcon';
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
  isEvenGroup: boolean;
  isFirstOfDate: boolean;
  categoryObj?: Category;
  walletObj?: Wallet;
  friendsMap: Map<string, Friend>;
  walletsMap?: Map<string, Wallet>;
  settlementObj?: Settlement | null;
}

export const ExpenseMobileCard: React.FC<Props> = React.memo(({
  ge,
  currency,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onUndo,
  groupStatus,
  isEvenGroup,
  isFirstOfDate,
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

  const cardClass = `mobile-expense-card ${isEvenGroup ? 'date-card-even' : 'date-card-odd'}${isFirstOfDate ? ' date-card-first' : ''}${isExpanded ? ' is-expanded' : ''}`;

  return (
    <div className={cardClass}>
      <div className="mobile-expense-header" onClick={() => onToggleExpand(ge.id)}>
        <div className="mobile-expense-top">
          <div className="mobile-expense-desc-wrap">
            <CategoryIcon category={ge.category} icon={categoryObj?.icon} size={15} style={{ color: categoryObj?.color ?? 'var(--accent)', flexShrink: 0 }} />
            <span className="mobile-expense-title">{ge.description}</span>
            {vendor && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '1px 6px',
                  borderRadius: 8,
                  fontSize: 9.5,
                  fontWeight: 600,
                  background: 'var(--surface2)',
                  color: 'var(--text-2)',
                  border: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title={`Vendor: ${vendor.name}`}
              >
                <Store size={10} style={{ color: 'var(--accent)' }} />
                <span>{vendor.name}</span>
              </span>
            )}
            {ge.isSplit && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 600,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                whiteSpace: 'nowrap'
              }}>
                <Users size={11} /> {ge.isSettlementGroup ? 'Settlement' : 'Split'}
              </span>
            )}
            {groupStatus.statusKey !== 'none' && groupStatus.statusLabel && (
              ge.isSettlementGroup ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 7px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 600,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  whiteSpace: 'nowrap'
                }}>
                  Settled ✓
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 7px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 600,
                  background: groupStatus.statusKey === 'settled' || groupStatus.statusKey === 'completed' || groupStatus.statusKey === 'paid'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : groupStatus.statusKey === 'partial'
                    ? 'rgba(245, 158, 11, 0.18)'
                    : 'rgba(239, 68, 68, 0.12)',
                  color: groupStatus.statusKey === 'settled' || groupStatus.statusKey === 'completed' || groupStatus.statusKey === 'paid'
                    ? '#10b981'
                    : groupStatus.statusKey === 'partial'
                    ? '#f59e0b'
                    : '#ef4444',
                  border: `1px solid ${groupStatus.statusKey === 'settled' || groupStatus.statusKey === 'completed' || groupStatus.statusKey === 'paid'
                    ? 'rgba(16, 185, 129, 0.3)'
                    : groupStatus.statusKey === 'partial'
                    ? 'rgba(245, 158, 11, 0.35)'
                    : 'rgba(239, 68, 68, 0.25)'}`,
                  whiteSpace: 'nowrap'
                }}>
                  {groupStatus.statusLabel}
                </span>
              )
            )}
          </div>
          <div className="mobile-expense-amount" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {(() => {
              if (ge.isSettlementGroup) {
                return (
                  <span style={{ color: ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)' }}>
                    {ge.flow === 'in' ? '+' : '-'}{fmtMoney(ge.totalAmount, currency)}
                  </span>
                );
              }
              if (isIn) return <span style={{ color: 'var(--credit)' }}>+{fmtMoney(ge.totalAmount, currency)}</span>;
              if (ge.isSplit) {
                return (
                  <>
                    <span style={{ color: ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)' }}>
                      {ge.flow === 'in' ? '+' : '-'}{fmtMoney(ge.totalAmount, currency)}
                    </span>
                    {ge.personalShare > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>
                        You: {fmtMoney(ge.personalShare, currency)}
                      </span>
                    )}
                  </>
                );
              }
              return <span style={{ color: ge.flow === 'out' ? 'var(--debit)' : 'var(--credit)' }}>{ge.flow === 'out' ? '-' : '+'}{fmtMoney(ge.totalAmount, currency)}</span>;
            })()}
          </div>
        </div>

        <div className="mobile-expense-meta">
          <div className="mobile-expense-meta-left">
            <span>{fmtDate(ge.date)}</span>
            <span>·</span>
            <span>{ge.category}</span>
            {ge.isSettlementGroup && (
              <>
                <span>·</span>
                <span>{ge.settlementItemCount} item{ge.settlementItemCount! > 1 ? 's' : ''}{ge.settlementDateRange ? ` (${ge.settlementDateRange})` : ''}</span>
              </>
            )}
            {friendsInGroup.map((f: Friend | undefined) => f && (
              <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span>·</span>
                <span className="avatar avatar-sm" style={{ ...getAvatarStyle(f.color), width: 15, height: 15, fontSize: 8 }}>{friendInitial(f.name, f.avatarNumber)}</span>
                {f.name}
              </span>
            ))}
          </div>
          <div className="mobile-expense-expand-btn">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mobile-expense-details">
          {(ge.isSplit || ge.items.length > 1 || ge.isSettlementGroup) && (
            <div style={{
              background: 'var(--surface2)',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 12,
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} style={{ color: 'var(--accent)' }} /> {ge.isSettlementGroup ? 'Settlement Breakdown' : (ge.isSplit ? 'Split Breakdown' : 'Breakdown')} (Total {fmtMoney(ge.totalAmount, currency)})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ge.items.filter((item: Expense) => !(item.type === 'personal' && (Number(item.amount) || 0) <= 0)).map((item: Expense, idx: number) => {
                  const itemFriend = item.friendId ? friendsMap.get(item.friendId) : null;
                  const isMine = item.type === 'personal';
                  const isVendorOwed = item.type === 'by_friend';
                  const name = itemFriend?.name ?? 'Contact';

                  let roleLabel = 'Mine (Your share)';
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
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12,
                      padding: '6px 0',
                      borderBottom: idx < ge.items.length - 1 ? '1px dashed var(--border)' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isMine ? (
                          <>
                            <User size={16} style={{ color: 'var(--text-2)' }} />
                            <div>
                              <div style={{ fontWeight: 600 }}>{roleLabel}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{statusText}</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="avatar avatar-sm" style={{ ...getAvatarStyle(itemFriend?.color), width: 22, height: 22, fontSize: 10 }}>
                              {friendInitial(itemFriend?.name ?? '?', itemFriend?.avatarNumber)}
                            </span>
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {roleLabel}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 500, color: item.settled ? 'var(--credit)' : (isVendorOwed ? '#d32f2f' : 'var(--accent)') }}>
                                {statusText}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13, marginLeft: 'auto', color: subColor }}>
                        {subSign}{fmtMoney(Number(item.amount) || 0, currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mobile-expense-detail-grid">
            <div className="mobile-expense-detail-item">
              <span className="mobile-expense-detail-label">Category</span>
              <span className="mobile-expense-detail-val">
                <CategoryBadge category={ge.category} color={categoryObj?.color} icon={categoryObj?.icon} size={13} />
              </span>
            </div>

            <div className="mobile-expense-detail-item">
              <span className="mobile-expense-detail-label">Wallet</span>
              <span className="mobile-expense-detail-val">{effectiveWalletName}</span>
            </div>

            {vendor && (
              <div className="mobile-expense-detail-item">
                <span className="mobile-expense-detail-label">Vendor / Store</span>
                <span className="mobile-expense-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Store size={12} style={{ color: 'var(--accent)' }} />
                  <span>{vendor.name}</span>
                </span>
              </div>
            )}

            <div className="mobile-expense-detail-item">
              <span className="mobile-expense-detail-label">Type</span>
              <span className="mobile-expense-detail-val">{ge.isSplit ? 'Split Expense' : typeLabel(primaryItem.type, undefined, primaryItem.category)}</span>
            </div>

            {groupStatus.statusKey !== 'none' && groupStatus.statusLabel && (
              <div className="mobile-expense-detail-item">
                <span className="mobile-expense-detail-label">Status</span>
                <span className="mobile-expense-detail-val">
                  {ge.isSettlementGroup ? (
                    <span className="badge badge-settled" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}>
                      Settled ✓
                    </span>
                  ) : (
                    <span className={`badge badge-${groupStatus.statusKey}`} style={{
                      background: groupStatus.statusKey === 'settled' || groupStatus.statusKey === 'completed' || groupStatus.statusKey === 'paid'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : groupStatus.statusKey === 'partial'
                        ? 'rgba(245, 158, 11, 0.18)'
                        : 'rgba(239, 68, 68, 0.12)',
                      color: groupStatus.statusKey === 'settled' || groupStatus.statusKey === 'completed' || groupStatus.statusKey === 'paid'
                        ? '#10b981'
                        : groupStatus.statusKey === 'partial'
                        ? '#f59e0b'
                        : '#ef4444',
                      border: `1px solid ${groupStatus.statusKey === 'settled' || groupStatus.statusKey === 'completed' || groupStatus.statusKey === 'paid'
                        ? 'rgba(16, 185, 129, 0.3)'
                        : groupStatus.statusKey === 'partial'
                        ? 'rgba(245, 158, 11, 0.35)'
                        : 'rgba(239, 68, 68, 0.25)'}`,
                      fontWeight: 600
                    }}>
                      {groupStatus.statusLabel}
                    </span>
                  )}
                </span>
              </div>
            )}

            {primaryItem.notes && (
              <div className="mobile-expense-detail-item" style={{ gridColumn: '1 / -1' }}>
                <span className="mobile-expense-detail-label">Notes</span>
                <span className="mobile-expense-detail-val" style={{ fontWeight: 400, fontStyle: 'italic' }}>{primaryItem.notes}</span>
              </div>
            )}
          </div>

          <div className="mobile-expense-actions">
            {ge.items.some((i: Expense) => i.settled || i.settlementId) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const targetItem = ge.items.find((i: Expense) => i.settlementId) || ge.items.find((i: Expense) => i.settled) || primaryItem;
                  onUndo(targetItem.settlementId || targetItem.id || ge.id);
                }}
                style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.3)' }}
              >
                <RotateCcw size={14} /> Undo Settlement
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(primaryItem)}>
              <Edit2 size={14} /> Edit
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(ge.id)}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
