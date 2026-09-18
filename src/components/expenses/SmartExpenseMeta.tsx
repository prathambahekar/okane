import React, { useRef, useState, useLayoutEffect } from 'react';
import type { Friend } from '../../types';
import { friendInitial, getAvatarStyle } from '../../utils';
import { renderWalletIcon } from '../WalletIconRenderer';
import { Store } from 'lucide-react';

export interface SmartExpenseMetaProps {
  category?: string;
  wallet?: {
    name: string;
    icon?: string;
    color?: string;
  };
  friends?: Friend[];
  vendor?: Friend | null;
  dateText?: string;
  isSettlementGroup?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const SmartExpenseMeta: React.FC<SmartExpenseMetaProps> = React.memo(({
  category,
  wallet,
  friends = [],
  vendor,
  dateText,
  isSettlementGroup = false,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial width estimation to prevent flash of content
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 220;
    const w = window.innerWidth;
    if (w < 380) return 165;
    if (w < 480) return 195;
    if (w < 768) return 240;
    return 350;
  });

  // Track container width via ResizeObserver with layout effect
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setContainerWidth(prev => (Math.abs(prev - rect.width) > 3 ? rect.width : prev));
      }
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) {
            setContainerWidth(prev => (Math.abs(prev - w) > 3 ? w : prev));
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  // Filter valid friends list (excluding vendor if separate)
  const validFriends = friends.filter(Boolean);
  const hasCategory = Boolean(category && !isSettlementGroup);
  const hasWallet = Boolean(wallet && wallet.name);
  const hasFriends = validFriends.length > 0;
  const hasVendor = Boolean(vendor && vendor.name);
  const hasDate = Boolean(dateText);

  // Compile friends display name
  const friendNames = validFriends.map(f => f.name).join(', ');

  // Mathematical space calculation based on font sizes (11.5px / 12px)
  // 1. Category space
  const categoryTextWidth = hasCategory && category ? category.length * 6.8 + 2 : 0;
  const bulletWidth = 13;

  // 2. Wallet space
  const walletIconWidth = 16;
  const walletNameTextWidth = hasWallet && wallet ? wallet.name.length * 6.5 + 4 : 0;
  const walletFullWidth = walletIconWidth + walletNameTextWidth;

  // 3. Friends / Vendor space
  let friendsAvatarWidth = 0;
  if (hasFriends) {
    friendsAvatarWidth = validFriends.length === 1 ? 19 : 30;
  } else if (hasVendor) {
    friendsAvatarWidth = 19;
  }
  const friendsDesiredTextWidth = hasFriends
    ? Math.max(45, Math.min(friendNames.length * 6.5, 95))
    : (hasVendor && vendor ? Math.max(40, Math.min(vendor.name.length * 6.5, 80)) : 0);
  const friendsTotalDesired = (hasFriends || hasVendor) ? (friendsAvatarWidth + friendsDesiredTextWidth) : 0;

  // 4. Date space (if any)
  const dateWidth = hasDate && dateText ? dateText.length * 6.6 + bulletWidth : 0;

  // Space required for Stage 0 (Full: show everything)
  const fullRequired =
    dateWidth +
    (hasCategory ? categoryTextWidth + ((hasWallet || hasFriends || hasVendor) ? bulletWidth : 0) : 0) +
    (hasWallet ? walletFullWidth + ((hasFriends || hasVendor) ? bulletWidth : 0) : 0) +
    friendsTotalDesired;

  // Space required for Stage 1 (Hide Category: wallet full + friends)
  const noCatRequired =
    dateWidth +
    (hasWallet ? walletFullWidth + ((hasFriends || hasVendor) ? bulletWidth : 0) : 0) +
    friendsTotalDesired;

  // Space required for Stage 2 (Compact Wallet: wallet icon only + friends)
  const compactWalletRequired =
    dateWidth +
    (hasWallet ? walletIconWidth + ((hasFriends || hasVendor) ? bulletWidth : 0) : 0) +
    friendsTotalDesired;

  // Progressive degradation decision
  // Priority:
  // If no space:
  // 1) Start hiding category
  // 2) If still not enough space, turn wallet into icon only
  let isCategoryHidden = false;
  let isWalletCompact = false;

  // Only trigger degradation if multiple elements compete for space
  if ((hasCategory && (hasWallet || hasFriends || hasVendor)) || (hasWallet && (hasFriends || hasVendor))) {
    if (containerWidth < fullRequired) {
      // Step 1: Hide category
      isCategoryHidden = true;

      if (containerWidth < noCatRequired && hasWallet) {
        // Step 2: Turn wallet icon + text into icon only
        isWalletCompact = true;
      }
    }
  } else if (hasCategory && hasWallet && !hasFriends && !hasVendor) {
    // Edge case: Just category + wallet, but container is very narrow
    if (containerWidth < fullRequired) {
      isCategoryHidden = true;
      if (containerWidth < compactWalletRequired || containerWidth < walletFullWidth + 10) {
        isWalletCompact = true;
      }
    }
  }

  // Display mode tag for styling & debugging
  const modeTag = isWalletCompact
    ? 'compact-wallet'
    : isCategoryHidden
    ? 'no-category'
    : 'full';

  if (!hasCategory && !hasWallet && !hasFriends && !hasVendor && !hasDate) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`smart-expense-meta ${className}`}
      data-mode={modeTag}
      data-has-category={hasCategory ? 'true' : 'false'}
      data-has-wallet={hasWallet ? 'true' : 'false'}
      data-has-friends={hasFriends || hasVendor ? 'true' : 'false'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11.5,
        color: 'var(--text-3)',
        minWidth: 0,
        width: '100%',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {/* Optional Date tag (when used in transaction views) */}
      {hasDate && dateText && (
        <span
          className="meta-date-group"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
        >
          <span style={{ fontWeight: 500, color: 'var(--text-2)' }}>{dateText}</span>
          {(hasCategory || hasWallet || hasFriends || hasVendor) && (
            <span
              className="meta-bullet"
              style={{ color: 'var(--text-3)', opacity: 0.6, fontSize: 8, flexShrink: 0 }}
            >
              •
            </span>
          )}
        </span>
      )}

      {/* 1. Category Tag (Hidden first when space is constrained) */}
      {hasCategory && category && !isCategoryHidden && (
        <span
          className="meta-cat-group"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
        >
          <span
            className="meta-cat-name"
            style={{ fontWeight: 500, color: 'var(--text-3)' }}
            title={`Category: ${category}`}
          >
            {category}
          </span>
          {(hasWallet || hasFriends || hasVendor) && (
            <span
              className="meta-bullet"
              style={{ color: 'var(--text-3)', opacity: 0.6, fontSize: 8, flexShrink: 0 }}
            >
              •
            </span>
          )}
        </span>
      )}

      {/* 2. Wallet Tag (Turns into icon only when space is still constrained) */}
      {hasWallet && wallet && (
        <span
          className="meta-wallet-group"
          title={`Wallet: ${wallet.name}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3.5,
            color: 'var(--text-2)',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          <span
            className="meta-wallet-icon-box"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {renderWalletIcon(wallet.icon || wallet.name, 12, wallet.color)}
          </span>

          {!isWalletCompact && (
            <span
              className="meta-wallet-name"
              style={{
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {wallet.name}
            </span>
          )}

          {(hasFriends || hasVendor) && (
            <span
              className="meta-bullet"
              style={{
                color: 'var(--text-3)',
                opacity: 0.6,
                fontSize: 8,
                flexShrink: 0,
                marginLeft: 1,
              }}
            >
              •
            </span>
          )}
        </span>
      )}

      {/* 3. Friends Tag (Takes full remaining space, preserves avatars, truncates names gracefully) */}
      {hasFriends && (
        <span
          className="meta-friends-group"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {validFriends.length === 1 ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span
                className="avatar avatar-sm"
                style={{
                  ...getAvatarStyle(validFriends[0].color),
                  width: 15,
                  height: 15,
                  fontSize: 8,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {validFriends[0].type === 'vendor' ? (
                  <Store size={8} />
                ) : (
                  friendInitial(validFriends[0].name, validFriends[0].avatarNumber)
                )}
              </span>
              <span
                className="meta-friends-name"
                style={{
                  color: 'var(--text-2)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
                title={validFriends[0].name}
              >
                {validFriends[0].name}
              </span>
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                {validFriends.slice(0, 2).map((f, idx) => (
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
                    {f.type === 'vendor' ? (
                      <Store size={8} />
                    ) : (
                      friendInitial(f.name, f.avatarNumber)
                    )}
                  </span>
                ))}
              </span>
              <span
                className="meta-friends-name"
                style={{
                  color: 'var(--text-2)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
                title={friendNames}
              >
                {friendNames}
              </span>
            </span>
          )}
        </span>
      )}

      {/* 4. Single Vendor Tag (When no friends array, but vendor exists) */}
      {!hasFriends && hasVendor && vendor && (
        <span
          className="meta-vendor-group"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            className="avatar avatar-sm"
            style={{
              ...getAvatarStyle(vendor.color),
              width: 15,
              height: 15,
              fontSize: 8,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Store size={8} />
          </span>
          <span
            style={{
              color: 'var(--text-2)',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
            title={vendor.name}
          >
            {vendor.name}
          </span>
        </span>
      )}
    </div>
  );
});

SmartExpenseMeta.displayName = 'SmartExpenseMeta';
