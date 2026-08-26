import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, User, Pencil, Trash2, X, Store, FileText, Calendar, Wallet as WalletIcon, Tag
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
  const flowColor = isDebit ? 'var(--debit)' : 'var(--credit)';

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal expense-drawer-modal"
        style={{
          maxWidth: 440,
          maxHeight: 'min(92vh, 92dvh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          overflow: 'hidden',
          animation: 'slidein 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Handle for bottom-sheet gesture visual cue */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '14px 18px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 'none',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-3)' }}>
              Transaction Details
            </span>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              color: 'var(--text-3)',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          className="modal-body"
          style={{
            padding: '4px 18px 16px',
            overflowY: 'auto',
            minHeight: 0,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Main Hero Header: Icon, Description & Prominent Amount */}
          <div
            style={{
              padding: '16px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: categoryObj?.color ? `${categoryObj.color}1c` : 'var(--surface3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: categoryColor,
                  }}
                >
                  <CategoryIcon category={ge.category} icon={categoryObj?.icon} size={22} style={{ color: categoryColor }} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', lineHeight: 1.3, wordBreak: 'break-word' }}>
                    {ge.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
                      {ge.category}
                    </span>
                    {friendsToShow.length > 0 && (
                      <>
                        <span style={{ color: 'var(--text-3)', fontSize: 10 }}>•</span>
                        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>
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
                    fontWeight: 750,
                    fontSize: 18,
                    color: flowColor,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.2,
                  }}
                >
                  {flowSign}{fmtMoney(ge.totalAmount, currency)}
                </span>
                {ge.isSplit && ge.personalShare > 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500, marginTop: 3 }}>
                    You: {fmtMoney(ge.personalShare, currency)}
                  </span>
                )}
              </div>
            </div>

            {/* Status & Quick Tags Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
              {groupStatus.statusKey !== 'none' && groupStatus.statusLabel && (
                <span
                  className={`tx-status-pill status-${groupStatus.statusKey}`}
                  style={{
                    padding: '2.5px 8px',
                    fontSize: 10.5,
                    fontWeight: 650,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {ge.isSplit && <Users size={10} />}
                  <span>{groupStatus.statusLabel}</span>
                </span>
              )}
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                  background: 'var(--surface3)',
                  border: '1px solid var(--border)',
                  padding: '2.5px 8px',
                  borderRadius: 6,
                }}
              >
                {ge.isSplit ? 'Split Transaction' : typeLabel(primaryItem.type, undefined, primaryItem.category)}
              </span>
            </div>
          </div>

          {/* Details Overview Section */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              padding: '14px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
            }}
          >
            {/* Wallet */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <WalletIcon size={11} style={{ opacity: 0.8 }} />
                Wallet
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 5 }}>
                {walletObj ? (
                  <>
                    {renderWalletIcon(walletObj.icon || walletObj.name, 13, walletObj.color)}
                    <span>{effectiveWalletName}</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-3)' }}>{effectiveWalletName}</span>
                )}
              </span>
            </div>

            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} style={{ opacity: 0.8 }} />
                Date
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                {fmtDate(ge.date)}
              </span>
            </div>

            {/* Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag size={11} style={{ opacity: 0.8 }} />
                Category
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <CategoryBadge category={ge.category} color={categoryObj?.color} icon={categoryObj?.icon} size={13} />
              </div>
            </div>

            {/* Vendor / Store if exists */}
            {vendor && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Store size={11} style={{ opacity: 0.8 }} />
                  Store / Vendor
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                  {vendor.name}
                </span>
              </div>
            )}

            {/* Notes if exists */}
            {primaryItem.notes && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={11} style={{ opacity: 0.8 }} />
                  Notes
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4, wordBreak: 'break-word', fontWeight: 500 }}>
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
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Users size={13} style={{ color: 'var(--accent)' }} />
                  <span>{ge.isSettlementGroup ? 'Settlement Breakdown' : 'Split Breakdown'}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--text-3)' }}>
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
                      <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)' }}>
                        Settled ✓
                      </span>
                    );

                    if (ge.isSettlementGroup) {
                      const itemDesc = cleanExpenseDescription(item.description);
                      const itemDateStr = fmtDate(item.originalDate || item.date);
                      primaryName = itemDesc;
                      actionSubtitle = `Date: ${itemDateStr}`;
                      statusPill = (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)' }}>
                          Settled ✓
                        </span>
                      );
                    } else if (isMine) {
                      primaryName = 'You';
                      actionSubtitle = 'Your personal share';
                      statusPill = (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--surface3)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                          Personal
                        </span>
                      );
                    } else if (item.type === 'for_friend') {
                      primaryName = name;
                      actionSubtitle = item.settled ? 'Paid their share to you' : 'Owes you their share';
                      statusPill = item.settled ? (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)' }}>
                          Settled ✓
                        </span>
                      ) : (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                          Owes You
                        </span>
                      );
                    } else if (item.type === 'by_friend') {
                      primaryName = name;
                      actionSubtitle = item.settled ? 'Paid bill' : (vendor ? 'Vendor bill' : 'You owe them');
                      statusPill = item.settled ? (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--credit-bg)', color: 'var(--credit)', border: '1px solid var(--credit-border)' }}>
                          Settled ✓
                        </span>
                      ) : (
                        <span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--debit-bg)', color: 'var(--debit)', border: '1px solid var(--debit-border)' }}>
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
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: 'var(--surface3)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                          {isMine ? (
                            <div
                              style={{
                                width: 28,
                                height: 28,
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
                              <User size={13} />
                            </div>
                          ) : (
                            <span
                              className="avatar avatar-sm"
                              style={{
                                ...getAvatarStyle(itemFriend?.color),
                                width: 28,
                                height: 28,
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {friendInitial(itemFriend?.name ?? '?', itemFriend?.avatarNumber)}
                            </span>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                            fontWeight: 700,
                            fontSize: 13.5,
                            marginLeft: 10,
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

        {/* Modal Footer with Clean Buttons */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 18px calc(12px + env(safe-area-inset-bottom, 0px))',
            background: 'var(--surface)',
            borderTop: 'none',
            display: 'flex',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              flex: 1,
              height: 42,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: 13.5,
              fontWeight: 650,
              borderRadius: 12,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
            onClick={() => {
              onClose();
              onEdit(primaryItem);
            }}
          >
            <Pencil size={15} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1,
              height: 42,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: 13.5,
              fontWeight: 650,
              borderRadius: 12,
              background: 'var(--debit-bg)',
              border: '1px solid var(--debit-border)',
              color: 'var(--debit)',
              cursor: 'pointer',
            }}
            onClick={() => {
              onClose();
              onDelete(ge.id);
            }}
          >
            <Trash2 size={15} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExpenseDetailDrawer;
