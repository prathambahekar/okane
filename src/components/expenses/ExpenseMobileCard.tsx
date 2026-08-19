import React from 'react';
import {
  Users, User, RotateCcw, Edit2, Trash2,
  ChevronDown, ChevronUp, Store, FileText
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

  const isTransfer = ge.category === 'Transfer' || ge.items.some((i: Expense) => i.category === 'Transfer');
  const isIn = ge.flow === 'in' && !isTransfer;
  const rawFriends = ge.friendIds.map((fid: string) => friendsMap.get(fid)).filter((f): f is Friend => Boolean(f));
  const vendorId = ge.vendorId || ge.items.find((i: Expense) => i.vendorId)?.vendorId;
  const vendor = vendorId ? friendsMap.get(vendorId) : null;
  const friendsToShow = vendor ? rawFriends.filter(f => f.id !== vendor.id) : rawFriends;

  const categoryColor = categoryObj?.color || 'var(--accent)';
  const cardClass = `mobile-expense-card ${isExpanded ? 'is-expanded' : ''}`;

  return (
    <div className={cardClass}>
      {/* Clickable Header Row */}
      <div className="mobile-expense-header" onClick={() => onToggleExpand(ge.id)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%' }}>
          {/* Category Icon Tile */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: categoryObj?.color ? `${categoryObj.color}15` : 'var(--surface2)',
              border: `1px solid ${categoryObj?.color ? `${categoryObj.color}25` : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: categoryColor,
            }}
          >
            <CategoryIcon category={ge.category} icon={categoryObj?.icon} size={20} style={{ color: categoryColor }} />
          </div>

          {/* Middle Info Column */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
            {/* Top Row: Title + Unified Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                className="mobile-expense-title"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {ge.description}
              </span>

              {groupStatus.statusKey !== 'none' && groupStatus.statusLabel ? (
                ge.isSettlementGroup ? (
                  <span className="tx-status-pill status-settled" style={{ padding: '2px 7px', fontSize: 10, flexShrink: 0 }}>
                    <span>Settled ✓</span>
                  </span>
                ) : (
                  <span
                    className={`tx-status-pill status-${groupStatus.statusKey}`}
                    style={{
                      padding: '2px 7px',
                      fontSize: 10,
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3.5,
                    }}
                  >
                    {ge.isSplit && <Users size={10} />}
                    <span>{groupStatus.statusLabel}</span>
                  </span>
                )
              ) : (
                ge.isSplit && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3.5,
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <Users size={10} />
                    <span>{ge.isSettlementGroup ? 'Settlement' : 'Split'}</span>
                  </span>
                )
              )}
            </div>

            {/* Bottom Row: Category · Contacts · Vendor (Strict 1-line) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: 'var(--text-3)',
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              <span style={{ fontWeight: 500, flexShrink: 0 }}>{ge.category}</span>

              {vendor && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-2)', flexShrink: 0 }}>
                  <span style={{ color: 'var(--text-3)', marginRight: 1 }}>•</span>
                  <Store size={11} style={{ color: 'var(--accent)' }} />
                  <span>{vendor.name}</span>
                </span>
              )}

              {friendsToShow.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: 'var(--text-3)', marginRight: 1, flexShrink: 0 }}>•</span>
                  {friendsToShow.length === 1 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span
                        className="avatar avatar-sm"
                        style={{
                          ...getAvatarStyle(friendsToShow[0].color),
                          width: 15,
                          height: 15,
                          fontSize: 8,
                          flexShrink: 0,
                        }}
                      >
                        {friendInitial(friendsToShow[0].name, friendsToShow[0].avatarNumber)}
                      </span>
                      <span style={{ color: 'var(--text-2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {friendsToShow[0].name}
                      </span>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                        {friendsToShow.slice(0, 2).map((f, idx) => (
                          <span
                            key={f.id}
                            className="avatar avatar-sm"
                            style={{
                              ...getAvatarStyle(f.color),
                              width: 15,
                              height: 15,
                              fontSize: 8,
                              marginLeft: idx > 0 ? -4 : 0,
                              border: '1.5px solid var(--surface)',
                              flexShrink: 0,
                              zIndex: 2 - idx,
                            }}
                            title={f.name}
                          >
                            {friendInitial(f.name, f.avatarNumber)}
                          </span>
                        ))}
                      </span>
                      <span style={{ color: 'var(--text-2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {friendsToShow.map(f => f.name).join(', ')}
                      </span>
                    </span>
                  )}
                </span>
              )}

              {ge.isSettlementGroup && (
                <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-3)', marginRight: 3 }}>•</span>
                  {ge.settlementItemCount} item{ge.settlementItemCount! > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Right Amount & Chevron Column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 4, flexShrink: 0 }}>
            <div className="mobile-expense-amount">
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
                    <span style={{ color: ge.flow === 'in' ? 'var(--credit)' : 'var(--debit)' }}>
                      {ge.flow === 'in' ? '+' : '-'}{fmtMoney(ge.totalAmount, currency)}
                    </span>
                  );
                }
                return (
                  <span style={{ color: ge.flow === 'out' ? 'var(--debit)' : 'var(--credit)' }}>
                    {ge.flow === 'out' ? '-' : '+'}{fmtMoney(ge.totalAmount, currency)}
                  </span>
                );
              })()}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)' }}>
              {ge.isSplit && ge.personalShare > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                  You: {fmtMoney(ge.personalShare, currency)}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details Tray */}
      {isExpanded && (
        <div className="mobile-expense-details">
          {/* Split / Settlement Breakdown Table (Only for split or settlement transactions, not transfers) */}
          {!isTransfer && (ge.isSplit || ge.isSettlementGroup || (ge.items.length > 1 && ge.friendIds.length > 0)) && (
            <div
              style={{
                background: 'var(--surface2)',
                borderRadius: 10,
                padding: '12px 14px',
                border: '1px solid var(--border)',
              }}
            >
              {/* Card Header with Title and Total Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 8,
                  marginBottom: 6,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                  }}
                >
                  <Users size={13} style={{ color: 'var(--accent)' }} />
                  <span>{ge.isSettlementGroup ? 'Settlement Breakdown' : (ge.isSplit ? 'Split Breakdown' : 'Breakdown')}</span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 650,
                    color: 'var(--text-2)',
                    background: 'var(--surface)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                  }}
                >
                  Total: {fmtMoney(ge.totalAmount, currency)}
                </span>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {ge.items
                  .filter((item: Expense) => !(item.type === 'personal' && (Number(item.amount) || 0) <= 0))
                  .map((item: Expense, idx: number, arr: Expense[]) => {
                    const itemFriend = item.friendId ? friendsMap.get(item.friendId) : null;
                    const isMine = item.type === 'personal';
                    const name = itemFriend?.name ?? 'Contact';

                    let primaryName = name;
                    let actionSubtitle = 'Split share';
                    let statusPill = (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: 'rgba(34, 197, 94, 0.12)', color: 'var(--credit)' }}>
                        Settled ✓
                      </span>
                    );

                    if (ge.isSettlementGroup) {
                      const itemDesc = cleanExpenseDescription(item.description);
                      const itemDateStr = fmtDate(item.originalDate || item.date);
                      primaryName = itemDesc;
                      actionSubtitle = `Original date: ${itemDateStr}`;
                      statusPill = (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: 'rgba(34, 197, 94, 0.12)', color: 'var(--credit)' }}>
                          Settled ✓
                        </span>
                      );
                    } else if (isMine) {
                      primaryName = 'You (Your Share)';
                      actionSubtitle = 'Your personal share';
                      statusPill = (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                          Personal
                        </span>
                      );
                    } else if (item.type === 'for_friend') {
                      primaryName = name;
                      actionSubtitle = item.settled ? 'Paid their share to you' : 'Owes you their share';
                      statusPill = item.settled ? (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: 'rgba(34, 197, 94, 0.12)', color: 'var(--credit)' }}>
                          Settled ✓
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                          Owes You
                        </span>
                      );
                    } else if (item.type === 'by_friend') {
                      primaryName = name;
                      actionSubtitle = item.settled ? 'Paid bill' : (vendor ? 'Vendor bill to pay' : 'You owe them');
                      statusPill = item.settled ? (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: 'rgba(34, 197, 94, 0.12)', color: 'var(--credit)' }}>
                          Settled ✓
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                          Unpaid
                        </span>
                      );
                    }

                    const isSubDebit = item.type === 'by_friend' || item.type === 'personal';
                    const subSign = isSubDebit ? '-' : '+';
                    const subColor = isSubDebit ? 'var(--debit)' : 'var(--credit)';

                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 2px',
                          borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          {isMine ? (
                            <div
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-3)',
                                flexShrink: 0,
                              }}
                            >
                              <User size={13} />
                            </div>
                          ) : (
                            <span
                              className="avatar avatar-sm"
                              style={{
                                ...getAvatarStyle(itemFriend?.color),
                                width: 26,
                                height: 26,
                                fontSize: 10,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {friendInitial(itemFriend?.name ?? '?', itemFriend?.avatarNumber)}
                            </span>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 650, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {primaryName}
                              </span>
                              {statusPill}
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {actionSubtitle}
                            </span>
                          </div>
                        </div>

                        <span
                          style={{
                            fontWeight: 750,
                            fontSize: 13.5,
                            marginLeft: 12,
                            color: subColor,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {subSign}{fmtMoney(Number(item.amount) || 0, currency)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="mobile-expense-detail-grid">
            {/* Full Transaction Name / Description */}
            <div
              className="mobile-expense-detail-item"
              style={{
                gridColumn: '1 / -1',
                borderBottom: '1px solid var(--border)',
                paddingBottom: 8,
                marginBottom: 2,
              }}
            >
              <span className="mobile-expense-detail-label">Full Description</span>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 650,
                  color: 'var(--text)',
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                }}
              >
                {ge.description}
              </span>
            </div>

            <div className="mobile-expense-detail-item">
              <span className="mobile-expense-detail-label">Category</span>
              <span className="mobile-expense-detail-val">
                <CategoryBadge category={ge.category} color={categoryObj?.color} icon={categoryObj?.icon} size={12} />
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
                    <span className="tx-status-pill status-settled" style={{ padding: '2px 7px', fontSize: 10 }}>
                      <span>Settled ✓</span>
                    </span>
                  ) : (
                    <span className={`tx-status-pill status-${groupStatus.statusKey}`} style={{ padding: '2px 7px', fontSize: 10 }}>
                      <span>{groupStatus.statusLabel}</span>
                    </span>
                  )}
                </span>
              </div>
            )}

            {primaryItem.notes && (
              <div
                className="mobile-expense-detail-item"
                style={{
                  gridColumn: '1 / -1',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 8,
                  marginTop: 2,
                }}
              >
                <span className="mobile-expense-detail-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={11} style={{ color: 'var(--text-3)' }} />
                  <span>Notes</span>
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text)',
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                    fontWeight: 500,
                  }}
                >
                  {primaryItem.notes}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className="mobile-expense-actions">
            {ge.items.some((i: Expense) => i.settled || i.settlementId) && (
              <button
                type="button"
                className="mobile-action-btn action-undo"
                onClick={() => {
                  const targetItem = ge.items.find((i: Expense) => i.settlementId) || ge.items.find((i: Expense) => i.settled) || primaryItem;
                  onUndo(targetItem.settlementId || targetItem.id || ge.id);
                }}
                title="Undo Settlement"
              >
                <RotateCcw size={14} />
                <span>Undo</span>
              </button>
            )}
            <button
              type="button"
              className="mobile-action-btn action-edit"
              onClick={() => onEdit(primaryItem)}
              title="Edit Expense"
            >
              <Edit2 size={14} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              className="mobile-action-btn action-delete"
              onClick={() => onDelete(ge.id)}
              title="Delete Expense"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
