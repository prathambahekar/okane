import React from 'react';
import { Users, Store } from 'lucide-react';
import CategoryIcon from '../CategoryIcon';
import { fmtMoney, friendInitial, getAvatarStyle, resolveCategoryMeta, type GroupedExpense } from '../../utils';
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
  friendsMap,
}) => {
  const isTransfer = ge.category === 'Transfer' || ge.items.some((i: Expense) => i.category === 'Transfer');
  const isIn = ge.flow === 'in' && !isTransfer;
  const rawFriends = ge.friendIds.map((fid: string) => friendsMap.get(fid)).filter((f): f is Friend => Boolean(f));
  const vendorId = ge.vendorId || ge.items.find((i: Expense) => i.vendorId)?.vendorId;
  const vendor = vendorId ? friendsMap.get(vendorId) : null;
  const friendsToShow = vendor ? rawFriends.filter(f => f.id !== vendor.id) : rawFriends;

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
      style={{ cursor: 'pointer' }}
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
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: catMeta.bg,
              border: `1px solid ${catMeta.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: catMeta.color,
            }}
          >
            <CategoryIcon category={catMeta.name} icon={catMeta.icon} size={20} style={{ color: catMeta.color }} />
          </div>

          {/* Middle Info Column */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3.5 }}>
            {/* Top Row: Title + Unified Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                className="mobile-expense-title"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 650,
                  fontSize: 13.5,
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
                fontSize: 11.5,
                color: 'var(--text-3)',
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              <span style={{ fontWeight: 500, flexShrink: 0 }}>{ge.category}</span>

              {vendor && (
                <span
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent)', flexShrink: 0 }}
                  title={`Vendor: ${vendor.name}`}
                >
                  <span style={{ color: 'var(--text-3)', marginRight: 3 }}>•</span>
                  <Store size={12} strokeWidth={2.2} />
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

          {/* Right Amount Column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 3, flexShrink: 0 }}>
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
