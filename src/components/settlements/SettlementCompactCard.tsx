import React from 'react';
import { HeartHandshake } from 'lucide-react';
import type { Settlement, Friend, Wallet } from '../../types';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle } from '../../utils';

interface SettlementCompactCardProps {
  settlement: Settlement;
  friend?: Friend;
  wallet?: Wallet;
  currency: string;
  onSelect: (s: Settlement) => void;
  onUndo?: (id: string) => void;
}

export const SettlementCompactCard: React.FC<SettlementCompactCardProps> = React.memo(({
  settlement,
  friend,
  currency,
  onSelect,
}) => {
  const isForgiven = Boolean(settlement.isForgiven);
  const amtVal = Number(settlement.amount) || 0;
  const isReceived = amtVal >= 0;

  return (
    <div
      className="settlement-compact-card"
      onClick={() => onSelect(settlement)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(settlement);
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
        {friend && (
          <div
            className="avatar"
            style={{
              ...getAvatarStyle(friend.color),
              width: 38,
              height: 38,
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              flexShrink: 0,
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {friendInitial(friend.name, friend.avatarNumber)}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 'var(--fs-base)',
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.3,
              }}
            >
              {friend ? friend.name : 'Deleted friend'}
            </span>
            {isForgiven && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3.5,
                  padding: '1.5px 7px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 650,
                  backgroundColor: 'var(--amber-bg)',
                  border: '1px solid var(--amber-border)',
                  color: 'var(--amber)',
                  flexShrink: 0,
                  lineHeight: 1.2,
                  letterSpacing: '0.01em',
                }}
              >
                <HeartHandshake size={11} strokeWidth={2.2} />
                <span>Forgiven</span>
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-3)',
              marginTop: 2.5,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ flexShrink: 0 }}>{fmtDate(settlement.date)}</span>
            {settlement.note && settlement.note !== 'Forgiven / Waived off' && (
              <span style={{ color: 'var(--text-3)', fontStyle: 'italic', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                "{settlement.note}"
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 'var(--fs-base)',
            color: isForgiven ? 'var(--amber)' : (isReceived ? 'var(--credit)' : 'var(--debit)'),
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {isForgiven ? `~${fmtMoney(Math.abs(amtVal), currency)}` : `${isReceived ? '+' : '-'}${fmtMoney(Math.abs(amtVal), currency)}`}
        </div>
      </div>
    </div>
  );
});

SettlementCompactCard.displayName = 'SettlementCompactCard';


