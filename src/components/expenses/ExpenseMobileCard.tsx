import React from 'react';
import { Users } from 'lucide-react';
import CategoryIcon from '../CategoryIcon';
import { renderWalletIcon } from '../WalletIconRenderer';
import { fmtMoney, friendInitial, getAvatarStyle, resolveCategoryMeta, cleanSettlementDescription, type GroupedExpense } from '../../utils';
import type { Expense, Friend, Wallet, Category, Settlement } from '../../types';

interface Props {
  ge: GroupedExpense;
  currency: string;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  onSelectDetail?: (ge: GroupedExpense) => void;
  onEdit?: (expense: Expense) => void;
  onDelete?: (id: string) => void;
  onUndo?: (id: string) => void;
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
  onSelectDetail,
  onToggleExpand,
  groupStatus,
  categoryObj,
  walletObj,
  friendsMap,
  walletsMap,
}) => {
  const isTransfer = ge.category === 'Transfer' || ge.items.some((i: Expense) => i.category === 'Transfer');
  const isIn = ge.flow === 'in' && !isTransfer;
  const rawFriends = ge.friendIds.map((fid: string) => friendsMap.get(fid)).filter((f): f is Friend => Boolean(f));
  const vendorId = ge.vendorId || ge.items.find((i: Expense) => i.vendorId)?.vendorId;
  const vendor = vendorId ? friendsMap.get(vendorId) : null;
  const friendsToShow = ge.isSettlementGroup ? rawFriends : (vendor ? rawFriends.filter(f => f.id !== vendor.id) : rawFriends);

  const activeWallet = walletObj || (walletsMap && (ge.walletId ? walletsMap.get(ge.walletId) : (ge.items[0]?.walletId ? walletsMap.get(ge.items[0].walletId) : undefined)));

  const catMeta = resolveCategoryMeta(ge.category, categoryObj, ge.isSettlementGroup);

  const handleClick = () => {
    if (onSelectDetail) {
      onSelectDetail(ge);
    } else if (onToggleExpand) {
      onToggleExpand(ge.id);
    }
  };

  return (
    <div
      className="mobile-expense-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer', outline: 'none' }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Clickable Header Row */}
      <div className="mobile-expense-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          {/* Category Icon Tile */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: catMeta.bg,
              border: `1px solid ${catMeta.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: catMeta.color,
            }}
          >
            <CategoryIcon category={catMeta.name} icon={catMeta.icon} size={22} style={{ color: catMeta.color }} />
          </div>

          {/* Middle Info Column */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3.5, paddingRight: 4 }}>
            {/* Top Row: Title + Unified Status Badge (for non-settlement) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                className="mobile-expense-title"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  lineHeight: 1.3,
                  fontWeight: 650,
                  fontSize: 13.5,
                  minWidth: 0,
                }}
              >
                {cleanSettlementDescription(ge.description)}
              </span>

              {!ge.isSettlementGroup && groupStatus.statusKey !== 'none' && groupStatus.statusLabel && (
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
              )}

              {!ge.isSettlementGroup && !groupStatus.statusLabel && ge.isSplit && (
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
                  <span>Split</span>
                </span>
              )}
            </div>

            {/* Bottom Row: Category · Wallet · Contacts (with avatar badge) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11.5,
                color: 'var(--text-3)',
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {!ge.isSettlementGroup && (
                <span style={{ fontWeight: 500, flexShrink: 0 }}>{ge.category}</span>
              )}

              {activeWallet && !ge.isSettlementGroup && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3.5, color: 'var(--text-2)', fontWeight: 500, flexShrink: 0 }}>
                  <span style={{ color: 'var(--text-3)', opacity: 0.6, fontSize: 8 }}>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3.5 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>
                      {renderWalletIcon(activeWallet.icon || activeWallet.name, 12, activeWallet.color)}
                    </span>
                    <span style={{ maxWidth: 75, overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeWallet.name}</span>
                  </span>
                </span>
              )}

              {friendsToShow.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(!ge.isSettlementGroup || activeWallet) && (
                    <span style={{ color: 'var(--text-3)', marginRight: 1, flexShrink: 0, fontSize: 8, opacity: 0.6 }}>•</span>
                  )}
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
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
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
                            key={`${f.id}-${idx}`}
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
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
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
            </div>
          </div>

          {/* Right Amount Column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 3, flexShrink: 0, marginLeft: 'auto' }}>
            <div className="mobile-expense-amount" style={{ fontSize: 13.5, fontWeight: 700 }}>
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

            {ge.isSplit && ge.personalShare > 0 && (
              <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 500 }}>
                You: {fmtMoney(ge.personalShare, currency)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
