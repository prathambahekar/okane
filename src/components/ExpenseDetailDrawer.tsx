import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, User, Pencil, Trash2, X, Store, FileText, Calendar, Wallet as WalletIcon, Tag, ReceiptText, ArrowUpRight, ArrowDownLeft, Repeat
} from 'lucide-react';
import CategoryIcon, { CategoryBadge } from './CategoryIcon';
import {
  fmtMoney,
  fmtDate,
  friendInitial,
  getAvatarStyle,
  typeLabel,
  cleanExpenseDescription,
  getGroupSettlementStatus,
  type GroupedExpense
} from '../utils';
import type { Expense, Friend, Wallet, Category, Settlement } from '../types';
import { renderWalletIcon } from './WalletIconRenderer';

interface ExpenseDetailDrawerProps {
  ge: GroupedExpense;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  currency: string;
  friends: Friend[];
  wallets: Wallet[];
  categories: Category[];
  settlements?: Settlement[];
}

export const ExpenseDetailDrawer: React.FC<ExpenseDetailDrawerProps> = ({
  ge,
  onClose,
  onEdit,
  onDelete,
  currency,
  friends,
  wallets,
  categories,
  settlements = [],
}) => {
  const friendsMap = useMemo(() => new Map(friends.map(f => [f.id, f])), [friends]);
  const walletsMap = useMemo(() => new Map(wallets.map(w => [w.id, w])), [wallets]);
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.name, c])), [categories]);
  const settlementsMap = useMemo(() => new Map(settlements.map(s => [s.id, s])), [settlements]);

  const primaryItem = ge.items[0] || (ge as unknown as Expense);
  const categoryObj = categoriesMap.get(ge.category);
  const walletObj = walletsMap.get(ge.walletId);
  const settlementObj = ge.settlementId ? settlementsMap.get(ge.settlementId) : null;
  const groupStatus = getGroupSettlementStatus(ge);

  let effectiveWalletName = walletObj?.name || settlementObj?.paymentMethod || '—';
  if (ge.category === 'Transfer') {
    if (ge.fromWalletName && ge.toWalletName) {
      effectiveWalletName = `${ge.fromWalletName} → ${ge.toWalletName}`;
    } else {
      const outItem = ge.items.find((i: Expense) => i.flow === 'out');
      const inItem = ge.items.find((i: Expense) => i.flow === 'in');
      const fromW = outItem ? walletsMap.get(outItem.walletId) : null;
      const toW = inItem ? walletsMap.get(inItem.walletId) : null;
      if (fromW || toW) {
        effectiveWalletName = `${fromW?.name || 'Wallet'} → ${toW?.name || 'Wallet'}`;
      }
    }
  }

  const isTransfer = ge.category === 'Transfer' || ge.items.some((i: Expense) => i.category === 'Transfer');
  const rawFriends = ge.friendIds.map((fid: string) => friendsMap.get(fid)).filter((f): f is Friend => Boolean(f));
  const vendorId = ge.vendorId || ge.items.find((i: Expense) => i.vendorId)?.vendorId;
  const vendor = vendorId ? friendsMap.get(vendorId) : null;
  const friendsToShow = vendor ? rawFriends.filter(f => f.id !== vendor.id) : rawFriends;

  const categoryColor = categoryObj?.color || 'var(--accent)';
  const isDebit = ge.flow === 'out';
  const flowSign = isDebit ? '-' : '+';

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal expense-drawer-modal"
        style={{
          maxWidth: 410,
          maxHeight: 'min(90vh, 90dvh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
          animation: 'slidein 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: 'var(--shadow-lg)',
          color: 'var(--text)',
        }}
      >
        {/* Top Handle for bottom-sheet gesture visual cue */}
        <div className="modal-handle-bar" style={{ padding: '6px 0 2px' }}>
          <div className="modal-handle" style={{ width: 32, height: 4, background: 'var(--border)', borderRadius: 99 }} />
        </div>

        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '6px 14px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 'none',
            flexShrink: 0,
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
              }}
            >
              <ReceiptText size={13} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Transaction Details
            </span>
          </div>
          <button
            type="button"
            className="compact-close-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          className="modal-body"
          style={{
            padding: '2px 12px 10px',
            overflowY: 'auto',
            minHeight: 0,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: 'var(--surface)',
          }}
        >
          {/* Main Hero Card: Icon, Title & Amount */}
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: categoryObj?.color ? `${categoryObj.color}18` : 'var(--surface3)',
                    border: `1px solid ${categoryObj?.color ? categoryObj.color + '30' : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: categoryColor,
                  }}
                >
                  <CategoryIcon category={ge.category} icon={categoryObj?.icon} size={18} style={{ color: categoryColor }} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', lineHeight: 1.2, wordBreak: 'break-word' }}>
                    {ge.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 500 }}>
                      {ge.category}
                    </span>
                    {friendsToShow.length > 0 && (
                      <>
                        <span style={{ color: 'var(--text-3)', fontSize: 9 }}>•</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 600 }}>
                          {friendsToShow.map(f => f.name).join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Amount Display */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 17.5,
                    color: isDebit ? 'var(--debit, #dc2626)' : 'var(--credit, #16a34a)',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.15,
                  }}
                >
                  {flowSign}{fmtMoney(ge.totalAmount, currency)}
                </span>
                {ge.isSplit && ge.personalShare > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500, marginTop: 2 }}>
                    You: {fmtMoney(ge.personalShare, currency)}
                  </span>
                )}
              </div>
            </div>

            {/* Badges & Status Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
              {/* Flow Pill */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 8px',
                  borderRadius: 99,
                  fontSize: 10.5,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  background: isTransfer ? 'var(--accent-soft)' : (isDebit ? 'var(--debit-bg)' : 'var(--credit-bg)'),
                  border: `1px solid ${isTransfer ? 'var(--accent-border-soft, var(--border))' : (isDebit ? 'var(--debit-border)' : 'var(--credit-border)')}`,
                  color: isTransfer ? 'var(--accent)' : (isDebit ? 'var(--debit)' : 'var(--credit)'),
                }}
              >
                {isTransfer ? <Repeat size={10} /> : (isDebit ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />)}
                <span>{isTransfer ? 'Transfer' : (isDebit ? 'Expense' : 'Income')}</span>
              </span>

              {/* Group / Settlement Status */}
              {groupStatus.statusKey !== 'none' && groupStatus.statusLabel && (
                <span
                  style={{
                    padding: '3px 8px',
                    fontSize: 10.5,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 99,
                    background: groupStatus.statusKey === 'settled' ? 'var(--credit-bg)' : 'var(--debit-bg)',
                    border: `1px solid ${groupStatus.statusKey === 'settled' ? 'var(--credit-border)' : 'var(--debit-border)'}`,
                    color: groupStatus.statusKey === 'settled' ? 'var(--credit)' : 'var(--debit)',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: groupStatus.statusKey === 'settled' ? 'var(--credit)' : 'var(--debit)' }} />
                  {ge.isSplit && <Users size={10} />}
                  <span>{groupStatus.statusLabel}</span>
                </span>
              )}

              {/* Type pill */}
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                  background: 'var(--surface3)',
                  border: '1px solid var(--border)',
                  padding: '3px 8px',
                  borderRadius: 99,
                  whiteSpace: 'nowrap',
                }}
              >
                {ge.isSplit ? 'Split Transaction' : typeLabel(primaryItem.type, undefined, primaryItem.category)}
              </span>
            </div>
          </div>

          {/* Details Grid Section */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              padding: '12px 14px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
            }}
          >
            {/* Wallet */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <WalletIcon size={11} style={{ color: 'var(--text-3)' }} />
                Wallet
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 5 }}>
                {walletObj ? (
                  <>
                    {renderWalletIcon(walletObj.icon || walletObj.name, 12, walletObj.color)}
                    <span>{effectiveWalletName}</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-2)' }}>{effectiveWalletName}</span>
                )}
              </span>
            </div>

            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} style={{ color: 'var(--text-3)' }} />
                Date
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)' }}>
                {fmtDate(ge.date)}
              </span>
            </div>

            {/* Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag size={11} style={{ color: 'var(--text-3)' }} />
                Category
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <CategoryBadge category={ge.category} color={categoryObj?.color} icon={categoryObj?.icon} size={12} />
              </div>
            </div>

            {/* Vendor / Store if exists */}
            {vendor && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Store size={11} style={{ color: 'var(--text-3)' }} />
                  Store / Vendor
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)' }}>
                  {vendor.name}
                </span>
              </div>
            )}

            {/* Notes if exists */}
            {primaryItem.notes && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={11} style={{ color: 'var(--text-3)' }} />
                  Notes
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text)',
                    lineHeight: 1.45,
                    fontWeight: 500,
                    wordBreak: 'break-word',
                  }}
                >
                  {primaryItem.notes}
                </span>
              </div>
            )}
          </div>

          {/* Split / Settlement Breakdown */}
          {!isTransfer && (ge.isSplit || ge.isSettlementGroup || (ge.items.length > 1 && ge.friendIds.length > 0)) && (
            <div
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Users size={12} style={{ color: 'var(--text-2)' }} />
                  <span>{ge.isSettlementGroup ? 'Settlement Breakdown' : 'Split Breakdown'}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface3)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 8 }}>
                  Total {fmtMoney(ge.totalAmount, currency)}
                </span>
              </div>

              {/* Participants Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ge.items
                  .filter((item: Expense) => !(item.type === 'personal' && (Number(item.amount) || 0) <= 0))
                  .map((item: Expense, idx: number) => {
                    const itemFriend = item.friendId ? friendsMap.get(item.friendId) : null;
                    const isMine = item.type === 'personal';
                    const name = itemFriend?.name ?? 'Contact';

                    let primaryName = name;
                    let actionSubtitle = 'Split share';
                    let statusPill = (
                      <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)', whiteSpace: 'nowrap' }}>
                        Settled ✓
                      </span>
                    );

                    if (ge.isSettlementGroup) {
                      const itemDesc = cleanExpenseDescription(item.description);
                      const itemDateStr = fmtDate(item.originalDate || item.date);
                      primaryName = itemDesc;
                      actionSubtitle = `Date: ${itemDateStr}`;
                      statusPill = (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)', whiteSpace: 'nowrap' }}>
                          Settled ✓
                        </span>
                      );
                    } else if (isMine) {
                      primaryName = 'You';
                      actionSubtitle = 'Your personal share';
                      statusPill = (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--surface3)', color: 'var(--text-2)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          Personal
                        </span>
                      );
                    } else if (item.type === 'for_friend') {
                      primaryName = name;
                      actionSubtitle = item.settled ? 'Paid their share to you' : 'Owes you their share';
                      statusPill = item.settled ? (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)', whiteSpace: 'nowrap' }}>
                          Settled ✓
                        </span>
                      ) : (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)', whiteSpace: 'nowrap' }}>
                          Owes You
                        </span>
                      );
                    } else if (item.type === 'by_friend') {
                      primaryName = name;
                      actionSubtitle = item.settled ? 'Paid bill' : (vendor ? 'Vendor bill' : 'You owe them');
                      statusPill = item.settled ? (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)', whiteSpace: 'nowrap' }}>
                          Settled ✓
                        </span>
                      ) : (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'var(--debit-bg)', color: 'var(--debit)', border: '1px solid var(--debit-border)', whiteSpace: 'nowrap' }}>
                          Unpaid
                        </span>
                      );
                    }

                    const isSubDebit = item.type === 'by_friend' || item.type === 'personal';
                    const subSign = isSubDebit ? '-' : '+';
                    const subColor = isSubDebit ? 'var(--debit, #dc2626)' : 'var(--credit, #16a34a)';

                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          {isMine ? (
                            <div
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-2)',
                                flexShrink: 0,
                              }}
                            >
                              <User size={12} />
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

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {primaryName}
                              </span>
                              {statusPill}
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {actionSubtitle}
                            </span>
                          </div>
                        </div>

                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            marginLeft: 8,
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
        </div>

        {/* Modal Footer with Clean Action Buttons */}
        <div
          className="modal-footer"
          style={{
            padding: '8px 12px calc(8px + env(safe-area-inset-bottom, 0px))',
            background: 'var(--surface)',
            borderTop: 'none',
            display: 'flex',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              flex: 1,
              height: 38,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 10,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => {
              onClose();
              onEdit(primaryItem);
            }}
          >
            <Pencil size={14} style={{ color: 'var(--text)' }} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1,
              height: 38,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 10,
              background: 'var(--debit-bg)',
              border: '1px solid var(--debit-border)',
              color: 'var(--debit)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => {
              onClose();
              onDelete(ge.id);
            }}
          >
            <Trash2 size={14} style={{ color: 'var(--debit)' }} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExpenseDetailDrawer;
