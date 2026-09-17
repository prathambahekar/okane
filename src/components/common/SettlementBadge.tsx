import React from 'react';
import { HeartHandshake, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { GroupedExpense, Settlement } from '../../types';

interface SettlementBadgeProps {
  isForgiven?: boolean;
  flow?: 'in' | 'out';
  settlementObj?: Settlement | null;
  ge?: GroupedExpense;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export const SettlementBadge: React.FC<SettlementBadgeProps> = ({
  isForgiven: propIsForgiven,
  flow: propFlow,
  settlementObj,
  ge,
  size = 'sm',
  style,
}) => {
  const isForgiven = Boolean(
    propIsForgiven ||
    settlementObj?.isForgiven ||
    ge?.isForgiven ||
    (ge?.description && /forgiv|waiv|forgotten/i.test(ge.description))
  );

  const flow = propFlow || ge?.flow || (settlementObj ? (settlementObj.amount >= 0 ? 'in' : 'out') : 'out');
  const isSm = size === 'sm';

  if (isForgiven) {
    return (
      <span
        className="settlement-badge status-forgiven"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: isSm ? 3 : 4,
          padding: isSm ? '1.5px 7px' : '2.5px 9px',
          borderRadius: 6,
          fontSize: isSm ? 10.5 : 11.5,
          fontWeight: 650,
          backgroundColor: 'var(--amber-bg)',
          border: '1px solid var(--amber-border)',
          color: 'var(--amber)',
          lineHeight: 1.2,
          letterSpacing: '0.01em',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        <HeartHandshake size={isSm ? 11 : 12.5} strokeWidth={2.2} />
        <span>Forgotten</span>
      </span>
    );
  }

  if (flow === 'in') {
    return (
      <span
        className="settlement-badge status-received"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: isSm ? 3 : 4,
          padding: isSm ? '1.5px 7px' : '2.5px 9px',
          borderRadius: 6,
          fontSize: isSm ? 10.5 : 11.5,
          fontWeight: 650,
          backgroundColor: 'var(--credit-bg)',
          border: '1px solid var(--credit-border)',
          color: 'var(--credit)',
          lineHeight: 1.2,
          letterSpacing: '0.01em',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        <ArrowDownRight size={isSm ? 11 : 12.5} strokeWidth={2.5} />
        <span>Received</span>
      </span>
    );
  }

  return (
    <span
      className="settlement-badge status-paid"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? 3 : 4,
        padding: isSm ? '1.5px 7px' : '2.5px 9px',
        borderRadius: 6,
        fontSize: isSm ? 10.5 : 11.5,
        fontWeight: 650,
        backgroundColor: 'var(--debit-bg)',
        border: '1px solid var(--debit-border)',
        color: 'var(--debit)',
        lineHeight: 1.2,
        letterSpacing: '0.01em',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <ArrowUpRight size={isSm ? 11 : 12.5} strokeWidth={2.5} />
      <span>Paid</span>
    </span>
  );
};

export default SettlementBadge;
