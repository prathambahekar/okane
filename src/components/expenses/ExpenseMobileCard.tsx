import React from 'react';
import { Users } from 'lucide-react';
import CategoryIcon from '../CategoryIcon';
import { fmtMoney, resolveCategoryMeta, cleanSettlementDescription, type GroupedExpense } from '../../utils';
import type { Expense, Friend, Wallet, Category, Settlement } from '../../types';
import { SmartExpenseMeta } from './SmartExpenseMeta';
import SettlementBadge from '../common/SettlementBadge';

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
  settlementObj,
}) => {
  const isTransfer = ge.category === 'Transfer' || ge.items.some((i: Expense) => i.category === 'Transfer');
  const isIn = ge.flow === 'in' && !isTransfer;
  const rawFriends = ge.friendIds.map((fid: string) => friendsMap.get(fid)).filter((f): f is Friend => Boolean(f));
  const vendorId = ge.vendorId || ge.items.find((i: Expense) => i.vendorId)?.vendorId;
  const vendor = vendorId ? friendsMap.get(vendorId) : null;
  const friendsToShow = ge.isSettlementGroup ? rawFriends : (vendor ? rawFriends.filter(f => f.id !== vendor.id) : rawFriends);

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
              borderRadius: 'var(--radius-md)',
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
                  fontWeight: 600,
                  fontSize: 'var(--fs-base)',
                  minWidth: 0,
                }}
              >
                {cleanSettlementDescription(ge.description)}
              </span>

              {ge.isSettlementGroup && (
                <SettlementBadge ge={ge} settlementObj={settlementObj} />
              )}

              {!ge.isSettlementGroup && !isTransfer && groupStatus.statusKey !== 'none' && groupStatus.statusLabel && (
                <span
                  className={`tx-status-pill status-${groupStatus.statusKey}`}
                  style={{
                    padding: '2px 7px',
                    fontSize: 'var(--fs-caption)',
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

              {!ge.isSettlementGroup && !isTransfer && !groupStatus.statusLabel && ge.isSplit && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3.5,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: 'var(--fs-caption)',
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

            {/* Bottom Row: Metadata (Contacts / Friends / Settlements) */}
            <SmartExpenseMeta
              friends={friendsToShow}
              vendor={vendor}
              isSettlementGroup={ge.isSettlementGroup}
            />
          </div>

          {/* Right Amount Column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 3, flexShrink: 0, marginLeft: 'auto' }}>
            <div className="mobile-expense-amount" style={{ fontSize: 'var(--fs-base)', fontWeight: 700 }}>
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
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500 }}>
                You: {fmtMoney(ge.personalShare, currency)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
