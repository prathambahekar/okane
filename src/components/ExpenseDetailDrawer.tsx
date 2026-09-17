import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Users, User, Pencil, Trash2, X, Store, FileText, Wallet as WalletIcon, Tag, ArrowUpRight, ArrowDownLeft, Repeat, RotateCcw, HeartHandshake
} from 'lucide-react';
import CategoryIcon, { CategoryBadge } from './CategoryIcon';
import {
  fmtMoney,
  fmtDate,
  friendInitial,
  getAvatarStyle,
  cleanExpenseDescription,
  cleanSettlementDescription,
  getGroupSettlementStatus,
  type GroupedExpense
} from '../utils';
import type { Expense, Friend, Wallet, Category, Settlement } from '../types';
import { renderWalletIcon } from './WalletIconRenderer';
import { useStore } from '../store';
import { friendBalance } from '../db';
import { MarkdownNote } from './common/MarkdownNote';

interface ExpenseDetailDrawerProps {
  ge: GroupedExpense;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onUndo?: (id: string) => void;
  currency?: string;
  friends?: Friend[];
  wallets?: Wallet[];
  categories?: Category[];
  settlements?: Settlement[];
  zIndex?: number;
}

export const ExpenseDetailDrawer: React.FC<ExpenseDetailDrawerProps> = ({
  ge,
  onClose,
  onEdit,
  onDelete,
  onUndo,
  currency: currencyProp,
  friends: friendsProp,
  wallets: walletsProp,
  categories: categoriesProp,
  settlements: settlementsProp,
  zIndex = 1400,
}) => {
  const { db } = useStore();
  const friends = friendsProp || db.friends;
  const wallets = walletsProp || db.wallets;
  const categories = categoriesProp || db.settings.categories;
  const settlements = settlementsProp || db.settlements;
  const currency = currencyProp || db.settings.currency || 'INR';

  const friendsMap = useMemo(() => new Map((friends || []).map(f => [f.id, f])), [friends]);
  const walletsMap = useMemo(() => new Map((wallets || []).map(w => [w.id, w])), [wallets]);
  const categoriesMap = useMemo(() => new Map((categories || []).map(c => [c.name, c])), [categories]);
  const settlementsMap = useMemo(() => new Map((settlements || []).map(s => [s.id, s])), [settlements]);

  const primaryItem = ge.items[0] || (ge as unknown as Expense);
  const categoryObj = categoriesMap.get(ge.category);
  const walletObj = walletsMap.get(ge.walletId);
  const settlementObj = ge.settlementId ? settlementsMap.get(ge.settlementId) : null;
  const groupStatus = getGroupSettlementStatus(ge);

  const isUnpaid =
    groupStatus.statusKey === 'unpaid' ||
    groupStatus.statusLabel?.toLowerCase() === 'unpaid' ||
    ge.items.some((i: Expense) => i.status === 'unpaid') ||
    primaryItem.status === 'unpaid' ||
    (ge.items.some((i: Expense) => i.type === 'by_friend') && !groupStatus.isAllSettled);

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

  const showWallet = !isUnpaid && Boolean(walletObj || (effectiveWalletName && effectiveWalletName !== '—'));

  const isSettlement = ge.isSettlementGroup || ge.category === 'Settlement';
  const isTransfer = ge.category === 'Transfer' || ge.items.some((i: Expense) => i.category === 'Transfer');
  const isDebit = ge.flow === 'out';
  const flowSign = isDebit ? '-' : '+';

  const isContactVendor = (f: Friend | null | undefined): boolean => {
    if (!f) return false;
    if (f.type === 'vendor') return true;
    if (f.category?.toLowerCase() === 'vendor' || f.category?.toLowerCase() === 'store') return true;
    if (ge.vendorId === f.id || ge.items.some((i: Expense) => i.vendorId === f.id)) return true;
    return false;
  };

  const allFriendIds = Array.from(new Set([
    ...ge.friendIds,
    ...ge.items.map(i => i.friendId).filter(Boolean) as string[],
    ...(ge.settlementId ? [settlementsMap.get(ge.settlementId)?.friendId].filter(Boolean) as string[] : []),
  ]));
  const rawFriends = useMemo(() => {
    return allFriendIds.map((fid: string) => friendsMap.get(fid)).filter((f): f is Friend => Boolean(f));
  }, [allFriendIds, friendsMap]);
  
  const explicitVendorId = ge.vendorId || ge.items.find((i: Expense) => i.vendorId)?.vendorId;
  const explicitVendor = explicitVendorId ? friendsMap.get(explicitVendorId) : null;
  const detectedVendor = explicitVendor || rawFriends.find(isContactVendor) || null;

  // Filter out vendor so friends and vendor are never lumped together
  const friendsToShow = useMemo(() => {
    const list = rawFriends.filter(f => f.id !== detectedVendor?.id);
    if (list.length === 0 && isSettlement && !detectedVendor) {
      const m = ge.description.match(/^Settlement:\s*(Paid\s+to|Received\s+from)\s+(.+?)(?:\s*\((.*?)\))?$/i);
      if (m && m[2]) {
        return [{ id: 'synthetic_friend', name: m[2].trim() } as Friend];
      }
    }
    return list;
  }, [rawFriends, detectedVendor, isSettlement, ge.description]);

  interface FriendRoleInfo {
    friend: Friend;
    role: 'i_owe' | 'owes_me' | 'neutral';
    amount?: number;
    statusText: string;
    isSettled: boolean;
  }

  const categorizedFriends = useMemo(() => {
    return friendsToShow.map((friend): FriendRoleInfo => {
      const friendItems = ge.items.filter(i => i.friendId === friend.id);
      const hasByFriend = friendItems.some(i => i.type === 'by_friend');
      const hasForFriend = friendItems.some(i => i.type === 'for_friend');
      const friendItemTotal = friendItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const allItemsSettled = friendItems.length > 0 && friendItems.every(i => i.settled || i.settlementId);

      const b = friendBalance(db, friend.id);

      let role: 'i_owe' | 'owes_me' | 'neutral' = 'neutral';
      const isSettled = allItemsSettled;

      if (hasByFriend && !hasForFriend) {
        role = 'i_owe';
      } else if (hasForFriend && !hasByFriend) {
        role = 'owes_me';
      } else if (b.net < -0.01) {
        role = 'i_owe';
      } else if (b.net > 0.01) {
        role = 'owes_me';
      } else if (isSettlement) {
        role = isDebit ? 'i_owe' : 'owes_me';
      }

      let statusText = '';
      if (isSettled) {
        statusText = role === 'i_owe' ? 'Settled (Paid)' : (role === 'owes_me' ? 'Settled (Received)' : 'Settled');
      } else {
        statusText = role === 'i_owe' ? 'You owe' : (role === 'owes_me' ? 'Owes you' : 'Participant');
      }

      return {
        friend,
        role,
        amount: friendItemTotal > 0 ? friendItemTotal : undefined,
        statusText,
        isSettled,
      };
    });
  }, [friendsToShow, ge.items, isDebit, isSettlement, db]);

  const friendsIOwe = categorizedFriends.filter(cf => cf.role === 'i_owe');
  const friendsOweMe = categorizedFriends.filter(cf => cf.role === 'owes_me');
  const friendsNeutral = categorizedFriends.filter(cf => cf.role === 'neutral');

  const [selectedFriendFilter, setSelectedFriendFilter] = useState<string | null>(null);

  const handleToggleFriendFilter = (friendId: string) => {
    setSelectedFriendFilter(prev => (prev === friendId ? null : friendId));
  };

  const categoryColor = categoryObj?.color || 'var(--accent)';

  const renderFriendChip = (cf: FriendRoleInfo, themeColor: string) => {
    const { friend } = cf;
    const friendColor = friend.color || themeColor;
    const isSelected = selectedFriendFilter === friend.id;
    const isDimmed = Boolean(selectedFriendFilter && selectedFriendFilter !== friend.id);
    const badgeStyle = getAvatarStyle(friendColor);

    return (
      <button
        type="button"
        key={friend.id}
        onClick={() => handleToggleFriendFilter(friend.id)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '3px 10px 3px 3.5px',
          borderRadius: 'var(--radius-full)',
          background: isSelected ? 'var(--surface3, #242630)' : 'var(--surface, #141416)',
          border: isSelected ? `1.5px solid ${friendColor}` : '1px solid var(--border)',
          fontSize: 'var(--fs-xs)',
          fontWeight: isSelected ? 750 : 650,
          color: 'var(--text)',
          lineHeight: 1.2,
          maxWidth: '100%',
          boxShadow: isSelected
            ? `0 0 0 2px ${friendColor}33, 0 2px 8px rgba(0, 0, 0, 0.25)`
            : '0 1px 3px rgba(0, 0, 0, 0.08)',
          cursor: 'pointer',
          opacity: isDimmed ? 0.45 : 1,
          transform: isSelected ? 'scale(1.03)' : 'none',
          transition: 'all 0.15s ease',
        }}
        title={
          isSelected
            ? `Filtering breakdown by ${friend.name} (Click to clear)`
            : `Click to filter settlement breakdown by ${friend.name}`
        }
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            aspectRatio: '1 / 1',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: (friend.avatarNumber && friend.avatarNumber.length > 2) ? 8.5 : 10,
            fontWeight: 750,
            flexShrink: 0,
            ...badgeStyle,
            boxShadow: `0 1px 3px ${friendColor}22`,
            letterSpacing: '-0.3px',
            lineHeight: 1,
          }}
        >
          {friend.type === 'vendor' ? (
            <Store size={11} strokeWidth={2.2} />
          ) : (
            friendInitial(friend.name, friend.avatarNumber)
          )}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {friend.name}
        </span>
        {isSelected && (
          <X size={12} strokeWidth={2.8} style={{ color: friendColor, flexShrink: 0, marginLeft: -1 }} />
        )}
      </button>
    );
  };

  const renderCategorizedFriends = (isSideBySide = false) => {
    if (categorizedFriends.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: isSideBySide ? 8 : 11, minWidth: 0 }}>
        {/* 1. Friends the user owes ("I owe some") */}
        {friendsIOwe.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isSideBySide ? 4 : 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 750, color: 'var(--debit, #ef4444)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 3.5 }}>
                <ArrowDownLeft size={11.5} strokeWidth={2.6} />
                You Owe
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 750,
                  minWidth: 16,
                  height: 16,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  background: 'rgba(239, 68, 68, 0.16)',
                  color: 'var(--debit, #ef4444)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  lineHeight: 1,
                }}
              >
                {friendsIOwe.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1, minWidth: 0 }}>
              {friendsIOwe.map(cf => renderFriendChip(cf, 'var(--debit, #ef4444)'))}
            </div>
          </div>
        )}

        {/* 2. Friends who owe the user ("Some owe me") */}
        {friendsOweMe.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isSideBySide ? 4 : 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 750, color: 'var(--credit, #10b981)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 3.5 }}>
                <ArrowUpRight size={11.5} strokeWidth={2.6} />
                They Owe
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 750,
                  minWidth: 16,
                  height: 16,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  background: 'rgba(16, 185, 129, 0.16)',
                  color: 'var(--credit, #10b981)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  lineHeight: 1,
                }}
              >
                {friendsOweMe.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1, minWidth: 0 }}>
              {friendsOweMe.map(cf => renderFriendChip(cf, 'var(--credit, #10b981)'))}
            </div>
          </div>
        )}

        {/* 3. Neutral or general participants if any */}
        {friendsNeutral.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isSideBySide ? 4 : 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 3.5 }}>
                <Users size={11.5} />
                Participants
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 750,
                  minWidth: 16,
                  height: 16,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  background: 'var(--accent-soft)',
                  color: 'var(--text-2)',
                  border: '1px solid var(--border)',
                  lineHeight: 1,
                }}
              >
                {friendsNeutral.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1, minWidth: 0 }}>
              {friendsNeutral.map(cf => renderFriendChip(cf, 'var(--accent)'))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return createPortal(
    <div className="modal-backdrop-motion" style={{ position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: isMobileScreen ? 'flex-end' : 'center', justifyContent: 'center' }}>
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="modal-backdrop-overlay"
        style={{ position: 'fixed', inset: 0, zIndex: zIndex + 1, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
        onClick={onClose}
      />

      {/* Sheet panel / Desktop center dialog */}
      <motion.div
        initial={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        animate={isMobileScreen ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobileScreen ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: isMobileScreen ? 0.32 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="modal expense-drawer-modal modal-dialog-panel"
        style={{
          position: 'relative',
          zIndex: zIndex + 2,
          maxWidth: 420,
          width: '100%',
          maxHeight: 'min(88vh, 88dvh)',
          borderRadius: isMobileScreen ? '22px 22px 0 0' : 22,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--drawer-bg, var(--surface))',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          color: 'var(--text)',
        }}
      >
        {/* Top Drag Handle Pill */}
        <div className="modal-drag-handle" />

        {/* Drawer Header matching Image 2 reference */}
        <div
          className="modal-header"
          style={{
            padding: '10px 16px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 'none',
            flexShrink: 0,
            background: 'transparent',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            {/* Squircle Category Icon Badge */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface2)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: categoryColor,
              }}
            >
              <CategoryIcon category={ge.category} icon={categoryObj?.icon} size={22} style={{ color: categoryColor }} />
            </div>

            {/* Title and metadata */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--text)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cleanSettlementDescription(ge.description)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, color: 'var(--text-2)', fontSize: 'var(--fs-xs)' }}>
                {!isSettlement && (
                  <>
                    <span>{ge.category}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-caption)' }}>•</span>
                  </>
                )}
                <span>{fmtDate(ge.date)}</span>
              </div>
            </div>
          </div>

          {/* Close circular button */}
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          className="modal-body"
          style={{
            padding: '2px 14px 6px',
            overflowY: 'auto',
            minHeight: 0,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'transparent',
          }}
        >
          {/* Main Hero Card: Total Amount & Status Badges */}
          <div
            style={{
              padding: '14px 16px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div>
              <span className="text-caption">
                Total Amount
              </span>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 'var(--fs-xl)',
                  color: isDebit ? 'var(--debit, #ef4444)' : 'var(--credit, #10b981)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.4px',
                  marginTop: 2,
                }}
              >
                {flowSign}{fmtMoney(ge.totalAmount, currency)}
              </div>
              {ge.isSplit && ge.personalShare > 0 && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-2)', fontWeight: 500, marginTop: 2 }}>
                  Your share: {fmtMoney(ge.personalShare, currency)}
                </div>
              )}
            </div>

            {/* Badges & Status */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              {/* Flow Pill */}
              <span
                className="pill-badge"
                style={{
                  padding: '3px 9px',
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 'var(--radius-full)',
                  background: isTransfer ? 'var(--accent-soft)' : (isDebit ? 'var(--debit-bg)' : 'var(--credit-bg)'),
                  border: `1px solid ${isTransfer ? 'var(--accent-border-soft, var(--border))' : (isDebit ? 'var(--debit-border)' : 'var(--credit-border)')}`,
                  color: isTransfer ? 'var(--accent)' : (isDebit ? 'var(--debit)' : 'var(--credit)'),
                }}
              >
                {isTransfer ? <Repeat size={11} /> : (isDebit ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />)}
                <span>{isTransfer ? 'Transfer' : (isDebit ? 'Expense' : 'Income')}</span>
              </span>

              {/* Group / Settlement Status */}
              {groupStatus.statusKey !== 'none' && groupStatus.statusLabel && (() => {
                const isForgiven = ge.isForgiven || settlementObj?.isForgiven || Boolean(primaryItem?.notes && /forgiv|waiv/i.test(primaryItem.notes));
                if (isForgiven) {
                  return (
                    <span
                      className="pill-badge"
                      style={{
                        padding: '3px 9px',
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 650,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--amber-bg)',
                        border: '1px solid var(--amber-border)',
                        color: 'var(--amber)',
                      }}
                    >
                      <HeartHandshake size={11} strokeWidth={2.2} />
                      <span>Forgiven</span>
                    </span>
                  );
                }

                const isPositiveStatus =
                  groupStatus.statusKey === 'settled' ||
                  groupStatus.statusKey === 'paid' ||
                  groupStatus.statusKey === 'completed';
                const isPartial = groupStatus.statusKey === 'partial';
                const badgeBg = isPositiveStatus
                  ? 'var(--credit-bg, rgba(16, 185, 129, 0.12))'
                  : isPartial
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'var(--debit-bg, rgba(239, 68, 68, 0.12))';
                const badgeBorder = isPositiveStatus
                  ? 'var(--credit-border, rgba(16, 185, 129, 0.28))'
                  : isPartial
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'var(--debit-border, rgba(239, 68, 68, 0.25))';
                const badgeColor = isPositiveStatus
                  ? 'var(--credit, #10b981)'
                  : isPartial
                  ? '#f59e0b'
                  : 'var(--debit, #ef4444)';

                return (
                  <span
                    className="pill-badge"
                    style={{
                      padding: '3px 9px',
                      fontSize: 'var(--fs-caption)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: 'var(--radius-full)',
                      background: badgeBg,
                      border: `1px solid ${badgeBorder}`,
                      color: badgeColor,
                    }}
                  >
                    {ge.isSplit && <Users size={10} />}
                    <span>{groupStatus.statusLabel}</span>
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Details Section Card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              padding: '16px 18px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--card-radius)',
            }}
          >
            {/* Top Row: Wallet and Category (when wallet exists) OR Category and You Owe / They Owe (when wallet is hidden) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: showWallet
                  ? '1fr 1fr'
                  : (categorizedFriends.length > 0 ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr'),
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              {/* Wallet (Hidden when unpaid or without wallet) */}
              {showWallet && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4, height: 16 }}>
                    <WalletIcon size={11} style={{ color: 'var(--text-3)' }} />
                    Wallet
                  </span>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 650, color: 'var(--text)', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 6, marginTop: 1, minHeight: 28 }}>
                    {walletObj ? (
                      <>
                        {renderWalletIcon(walletObj.icon || walletObj.name, 13, walletObj.color)}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{effectiveWalletName}</span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{effectiveWalletName}</span>
                    )}
                  </span>
                </div>
              )}

              {/* Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4, height: 16 }}>
                  <Tag size={11} style={{ color: 'var(--text-3)' }} />
                  Category
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1, minHeight: 28 }}>
                  <CategoryBadge category={ge.category} color={categoryObj?.color} icon={categoryObj?.icon} size={11.5} />
                </div>
              </div>

              {/* When wallet is not there, place You Owe / They Owe on the right side */}
              {!showWallet && categorizedFriends.length > 0 && (
                <div style={{ minWidth: 0 }}>
                  {renderCategorizedFriends(true)}
                </div>
              )}
            </div>

            {/* Vendor / Store Section if detected */}
            {detectedVendor && (() => {
              const vendorColor = (detectedVendor.color && detectedVendor.color !== '#6366f1')
                ? detectedVendor.color
                : 'var(--amber, #f59e0b)';
              const vendorBadgeStyle = getAvatarStyle(vendorColor);

              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-sm)',
                        aspectRatio: '1 / 1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...vendorBadgeStyle,
                        flexShrink: 0,
                        lineHeight: 1,
                      }}
                    >
                      <Store size={15} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        Store / Vendor
                      </span>
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {detectedVendor.name}
                      </span>
                    </div>
                  </div>
                  <span
                    className="app-contact-badge vendor"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--amber-bg, rgba(245, 158, 11, 0.14))',
                      color: 'var(--amber, #fbbf24)',
                      border: '1px solid var(--amber-border, rgba(245, 158, 11, 0.28))',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    Vendor
                  </span>
                </div>
              );
            })()}

            {/* Friends Categorized: "You Owe" vs "They Owe" vs "Participants" (Rendered full-width below ONLY if wallet is present) */}
            {showWallet && categorizedFriends.length > 0 && renderCategorizedFriends(false)}

            {/* Notes if exists */}
            {primaryItem.notes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileText size={11} style={{ color: 'var(--text-3)' }} />
                  Notes
                </span>
                <MarkdownNote
                  content={primaryItem.notes}
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text)',
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                />
              </div>
            )}
          </div>

          {/* Split / Settlement Breakdown */}
          {!isTransfer && (ge.isSplit || ge.isSettlementGroup || ge.items.length > 1 || rawFriends.length > 1) && (() => {
            const allBreakdownItems = ge.items.filter((item: Expense) => !(item.type === 'personal' && (Number(item.amount) || 0) <= 0));
            const filteredBreakdownItems = selectedFriendFilter
              ? allBreakdownItems.filter((item: Expense) => item.friendId === selectedFriendFilter)
              : allBreakdownItems;
            const filteredFriendObj = selectedFriendFilter ? friendsMap.get(selectedFriendFilter) : null;
            const displayTotal = selectedFriendFilter
              ? filteredBreakdownItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0)
              : ge.totalAmount;

            return (
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Header with Filter Pill & Total */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <Users size={13} style={{ color: 'var(--text-2)' }} />
                    <span>{ge.isSettlementGroup ? 'Settlement Breakdown' : 'Split Breakdown'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selectedFriendFilter && filteredFriendObj && (
                      <button
                        type="button"
                        onClick={() => setSelectedFriendFilter(null)}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: filteredFriendObj.color || 'var(--accent)',
                          background: 'var(--surface3)',
                          border: `1px solid ${filteredFriendObj.color ? filteredFriendObj.color + '44' : 'var(--border)'}`,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                        }}
                        title="Clear contact filter"
                      >
                        <span>{filteredFriendObj.name}</span>
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    )}
                    <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 650, color: 'var(--text-2)', background: 'var(--surface3)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 'var(--radius-full)' }}>
                      Total {fmtMoney(displayTotal, currency)}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredBreakdownItems.length === 0 ? (
                    <div
                      style={{
                        padding: '18px 12px',
                        textAlign: 'center',
                        fontSize: 'var(--fs-xs)',
                        color: 'var(--text-3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.02)',
                      }}
                    >
                      <span>No breakdown items found for this contact.</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFriendFilter(null)}
                        style={{
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 650,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          cursor: 'pointer',
                        }}
                      >
                        Show all items
                      </button>
                    </div>
                  ) : (
                    filteredBreakdownItems.map((item: Expense, idx: number) => {
                      const directFriend = item.friendId ? friendsMap.get(item.friendId) : null;
                      const isDirectFriendVendor = Boolean(directFriend && directFriend.type === 'vendor');
                      const itemVendor = item.vendorId ? friendsMap.get(item.vendorId) : (isDirectFriendVendor ? directFriend : null);
                      const isVendorItem = Boolean(
                        isDirectFriendVendor || 
                        (itemVendor && itemVendor.type === 'vendor') ||
                        (detectedVendor && item.friendId === detectedVendor.id && detectedVendor.type === 'vendor')
                      );
                      const isFriendContact = Boolean(directFriend && directFriend.type !== 'vendor');
                      const isMine = item.type === 'personal' || (!directFriend && !item.vendorId);

                      // Title: show item title instead of vendor name
                      let itemTitle = cleanExpenseDescription(item.description);
                      if (!itemTitle || (detectedVendor && itemTitle.toLowerCase() === detectedVendor.name.toLowerCase())) {
                        const geClean = cleanExpenseDescription(ge.description);
                        if (geClean && (!detectedVendor || geClean.toLowerCase() !== detectedVendor.name.toLowerCase())) {
                          itemTitle = geClean;
                        } else {
                          itemTitle = ge.category && ge.category !== 'Settlement' ? ge.category : 'Expense';
                        }
                      }

                      // Status Badge: show if settled or owed or what (NO vendor badge)
                      const isItemSettled = Boolean(item.settled || isMine || ge.isSettlementGroup || ge.settlementId || item.vendorSettled);
                      const isPartial = Boolean(item.settledAmount && item.settledAmount > 0 && !item.settled);

                      let statusBadge: { label: string; color: string; bg: string; border: string };
                      if (isPartial) {
                        statusBadge = {
                          label: 'Partially Settled',
                          color: '#f59e0b',
                          bg: 'rgba(245, 158, 11, 0.12)',
                          border: 'rgba(245, 158, 11, 0.28)',
                        };
                      } else if (isItemSettled) {
                        statusBadge = {
                          label: 'Settled ✓',
                          color: '#10b981',
                          bg: 'rgba(16, 185, 129, 0.12)',
                          border: 'rgba(16, 185, 129, 0.28)',
                        };
                      } else if (item.type === 'for_friend') {
                        statusBadge = {
                          label: 'Owes You',
                          color: '#10b981',
                          bg: 'rgba(16, 185, 129, 0.12)',
                          border: 'rgba(16, 185, 129, 0.28)',
                        };
                      } else if (item.type === 'by_friend') {
                        statusBadge = {
                          label: 'You Owe',
                          color: '#ef4444',
                          bg: 'rgba(239, 68, 68, 0.12)',
                          border: 'rgba(239, 68, 68, 0.28)',
                        };
                      } else if (item.status === 'paid') {
                        statusBadge = {
                          label: 'Paid',
                          color: '#10b981',
                          bg: 'rgba(16, 185, 129, 0.12)',
                          border: 'rgba(16, 185, 129, 0.28)',
                        };
                      } else {
                        statusBadge = {
                          label: 'Unsettled',
                          color: '#ef4444',
                          bg: 'rgba(239, 68, 68, 0.12)',
                          border: 'rgba(239, 68, 68, 0.28)',
                        };
                      }

                      // Subtitle: Date taken (clean, no vendor repetition)
                      const itemDate = fmtDate(item.originalDate || item.date);

                      // Amount and sign
                      const isSubDebit = item.type === 'personal' || item.type === 'by_friend';
                      const subSign = isSubDebit ? '-' : '+';
                      const subColor = isSubDebit ? 'var(--debit, #ef4444)' : 'var(--credit, #10b981)';

                      // Vendor avatar styling synced with above icon and contacts
                      const vendorColor = itemVendor?.color || detectedVendor?.color || directFriend?.color || '#f59e0b';
                      const vendorAvatarStyle = getAvatarStyle(vendorColor);

                      return (
                        <div
                          key={`${item.id || 'item'}-${idx}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            {/* Avatar: Friend avatar (e.g. 05), Vendor store icon with synced color, or User icon */}
                            {isFriendContact && directFriend ? (
                              <span
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 'var(--radius-full)',
                                  aspectRatio: '1 / 1',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: (directFriend.avatarNumber && directFriend.avatarNumber.length > 2) ? 9 : 10.5,
                                  fontWeight: 750,
                                  flexShrink: 0,
                                  ...getAvatarStyle(directFriend.color || 'var(--accent, #10b981)'),
                                  boxShadow: `0 1px 3px ${directFriend.color ? directFriend.color + '22' : 'rgba(0,0,0,0.1)'}`,
                                  letterSpacing: '-0.3px',
                                  lineHeight: 1,
                                }}
                                title={directFriend.name}
                              >
                                {friendInitial(directFriend.name, directFriend.avatarNumber)}
                              </span>
                            ) : isVendorItem ? (
                              <span
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 'var(--radius-sm)',
                                  aspectRatio: '1 / 1',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  ...vendorAvatarStyle,
                                  boxShadow: `0 1px 3px ${vendorColor}22`,
                                  flexShrink: 0,
                                }}
                                title={itemVendor?.name || detectedVendor?.name || directFriend?.name || 'Vendor'}
                              >
                                <Store size={13} strokeWidth={2.2} />
                              </span>
                            ) : (
                              <span
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 'var(--radius-full)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--text-2, #a1a1aa)',
                                  flexShrink: 0,
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  border: '1px solid rgba(255, 255, 255, 0.06)',
                                }}
                                title="You (Personal share)"
                              >
                                <User size={13} strokeWidth={2.2} />
                              </span>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 'var(--fs-sm)',
                                    color: 'var(--text)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={itemTitle}
                                >
                                  {itemTitle}
                                </span>
                                {statusBadge && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '1px 6.5px',
                                      borderRadius: 'var(--radius-full)',
                                      color: statusBadge.color,
                                      background: statusBadge.bg,
                                      border: `1px solid ${statusBadge.border}`,
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    {statusBadge.label}
                                  </span>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--text-2, #a1a1aa)',
                                  fontWeight: 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  letterSpacing: '0.1px',
                                }}
                              >
                                {itemDate}
                              </span>
                            </div>
                          </div>

                          <span
                            style={{
                              fontWeight: 750,
                              fontSize: 13.5,
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
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Modal Footer with Clean Capsule Action Buttons */}
        <div
          className="modal-footer"
          style={{
            padding: '6px 16px calc(24px + env(safe-area-inset-bottom, 0px))',
            background: 'transparent',
            borderTop: 'none',
            display: 'flex',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {onUndo && (ge.isSettlementGroup || ge.settlementId || ge.items.some(i => i.settled || i.settlementId || i.vendorSettled)) && (
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                height: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.15s ease',
              }}
              onClick={() => {
                onClose();
                onUndo(ge.settlementId || ge.id);
              }}
            >
              <RotateCcw size={15} style={{ color: 'var(--text)' }} />
              <span>Undo</span>
            </button>
          )}
          {!ge.isSettlementGroup && (
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                height: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.15s ease',
              }}
              onClick={() => {
                onClose();
                onEdit(primaryItem);
              }}
            >
              <Pencil size={15} style={{ color: 'var(--text)' }} />
              <span>Edit</span>
            </button>
          )}
          <button
            type="button"
            className="btn"
            style={{
              flex: 1,
              height: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              borderRadius: 'var(--radius-full)',
              background: 'var(--debit-bg)',
              border: '1px solid var(--debit-border)',
              color: 'var(--debit)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.15s ease',
            }}
            onClick={() => {
              onClose();
              onDelete(ge.id);
            }}
          >
            <Trash2 size={15} style={{ color: 'var(--debit)' }} />
            <span>Delete</span>
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default ExpenseDetailDrawer;

