import React from 'react';
import {
  CheckCircle2,
  Zap,
  Trash2,
  Edit2,
  Store,
  Tv,
  User,
  Pause,
  Play,
  Calendar,
  Wallet as WalletIcon,
} from 'lucide-react';
import type { RecurringRule, ViewName, Category, Friend, Wallet } from '../../types';
import { fmtMoney, fmtDate } from '../../utils';
import CategoryIcon from '../CategoryIcon';

interface Props {
  rule: RecurringRule;
  category?: Category;
  linkedFriend?: Friend | null;
  wallet?: Wallet | null;
  currency: string;
  today: string;
  onPay: (rule: RecurringRule) => void;
  onQuickLog: (rule: RecurringRule) => void;
  onTogglePause: (rule: RecurringRule) => void;
  onEdit: (rule: RecurringRule) => void;
  onDelete: (rule: RecurringRule) => void;
  onNavigate?: (v: ViewName, arg?: string) => void;
}

export const AutopayCard: React.FC<Props> = ({
  rule,
  category,
  linkedFriend,
  wallet,
  currency,
  today,
  onPay,
  onQuickLog,
  onTogglePause,
  onEdit,
  onDelete,
  onNavigate,
}) => {
  const isAutopay = rule.kind === 'autopay';
  const isPaused = rule.status === 'paused';
  const isLoggedToday = rule.lastLoggedDate === today;
  const isDueToday = isAutopay && rule.nextDueDate === today;
  const isOverdue = isAutopay && Boolean(rule.nextDueDate && rule.nextDueDate < today);

  const catColor = category?.color || 'var(--accent)';
  const catColorBg = catColor.startsWith('#') && catColor.length === 7
    ? `${catColor}15`
    : 'rgba(59, 130, 246, 0.12)';

  const getFrequencyLabel = (r: RecurringRule) => {
    const val = r.intervalValue || 1;
    switch (r.frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return val === 1 ? 'Weekly' : `Every ${val}w`;
      case 'monthly': return 'Monthly';
      case 'custom_days':
        if (val === 14) return 'Bi-Weekly';
        return `Every ${val}d`;
      case 'custom_months':
        if (val === 1) return 'Monthly';
        if (val === 3) return 'Quarterly';
        if (val === 6) return 'Half-Yearly';
        if (val === 12) return 'Yearly';
        return `Every ${val}mo`;
      default: return 'Monthly';
    }
  };

  return (
    <div
      style={{
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'var(--surface)',
        borderRadius: 14,
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        opacity: isPaused ? 0.65 : 1,
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Top Main Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* Left: Category Icon + Title & Clean Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
          {/* Category Icon Tile */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              backgroundColor: catColorBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `1px solid ${catColor}25`,
              color: catColor,
            }}
          >
            <CategoryIcon category={rule.category} icon={category?.icon} size={19} style={{ color: catColor }} />
          </div>

          {/* Title & Metadata Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
            {/* Top Line: Title + Status Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                style={{
                  fontWeight: 650,
                  fontSize: 14,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {rule.title}
              </span>

              {isPaused && (
                <span
                  style={{
                    fontSize: 9.5,
                    color: 'var(--text-3)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    padding: '1px 5px',
                    borderRadius: 4,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  Paused
                </span>
              )}

              {isDueToday && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1.5px 6px',
                    borderRadius: 5,
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    flexShrink: 0,
                  }}
                >
                  Due today
                </span>
              )}

              {isOverdue && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1.5px 6px',
                    borderRadius: 5,
                    background: 'rgba(239, 68, 68, 0.16)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    flexShrink: 0,
                  }}
                >
                  Overdue
                </span>
              )}

              {!isAutopay && isLoggedToday && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1.5px 6px',
                    borderRadius: 5,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    flexShrink: 0,
                  }}
                >
                  Logged ✓
                </span>
              )}
            </div>

            {/* Bottom Line: Category • Frequency • Contact / Vendor (Strict 1-line) */}
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontWeight: 500, flexShrink: 0 }}>{rule.category}</span>
              <span style={{ color: 'var(--text-3)', opacity: 0.6 }}>•</span>
              <span style={{ flexShrink: 0 }}>{getFrequencyLabel(rule)}</span>

              {linkedFriend && (
                <>
                  <span style={{ color: 'var(--text-3)', opacity: 0.6 }}>•</span>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: onNavigate ? 'pointer' : 'default',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={(e) => {
                      if (onNavigate) {
                        e.stopPropagation();
                        onNavigate('friend-detail', linkedFriend.id);
                      }
                    }}
                    title={`View ${linkedFriend.name}`}
                  >
                    {linkedFriend.type === 'vendor' ? (
                      <Store size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    ) : linkedFriend.type === 'subscription' ? (
                      <Tv size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    ) : (
                      <User size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkedFriend.name}</span>
                  </button>
                </>
              )}

              {wallet && (
                <>
                  <span style={{ color: 'var(--text-3)', opacity: 0.6 }}>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }} title={`Wallet: ${wallet.name}`}>
                    <WalletIcon size={10.5} style={{ color: 'var(--text-3)' }} />
                    <span>{wallet.name}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amount & Status Subtitle */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 2, flexShrink: 0 }}>
          <div
            style={{
              fontWeight: 750,
              fontSize: 15.5,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {fmtMoney(rule.amount, currency)}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {isAutopay ? (
              rule.nextDueDate ? `Due ${fmtDate(rule.nextDueDate)}` : 'No due date'
            ) : isLoggedToday ? (
              <span style={{ color: '#10b981', fontWeight: 600 }}>Logged today</span>
            ) : (
              'Not logged today'
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Row (Zero dividing lines, modern integrated controls) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 2 }}>
        {/* Left: Last Logged Date / Note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {rule.lastLoggedDate ? (
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3.5,
                whiteSpace: 'nowrap',
              }}
              title={`Last logged on ${fmtDate(rule.lastLoggedDate)}`}
            >
              <Calendar size={11} style={{ opacity: 0.7 }} />
              <span>Last: {fmtDate(rule.lastLoggedDate)}</span>
            </span>
          ) : rule.notes ? (
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontStyle: 'italic',
              }}
              title={rule.notes}
            >
              {rule.notes}
            </span>
          ) : null}
        </div>

        {/* Right: Actions Cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {/* Main Pay/Log Action Button */}
          {isAutopay ? (
            <button
              type="button"
              style={{
                height: 29,
                padding: '0 10px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 7,
                background: 'var(--surface2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: isPaused ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => onPay(rule)}
              disabled={isPaused}
              title="Record autopay deduction"
            >
              <CheckCircle2 size={13} style={{ color: 'var(--credit)' }} />
              <span>Pay</span>
            </button>
          ) : (
            <button
              type="button"
              style={{
                height: 29,
                padding: '0 10px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 7,
                background: isLoggedToday ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface2)',
                color: isLoggedToday ? '#10b981' : 'var(--text)',
                border: isLoggedToday ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: isPaused ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => onQuickLog(rule)}
              disabled={isPaused}
              title={isLoggedToday ? 'Logged for today (tap to log again)' : "Log today's expense"}
            >
              <Zap size={13} style={{ color: isLoggedToday ? '#10b981' : '#f59e0b' }} />
              <span>{isLoggedToday ? 'Logged' : 'Log'}</span>
            </button>
          )}

          {/* Pause / Resume Button */}
          <button
            type="button"
            style={{
              width: 29,
              height: 29,
              borderRadius: 7,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: isPaused ? 'var(--accent)' : 'var(--text-3)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => onTogglePause(rule)}
            title={isPaused ? 'Resume Rule' : 'Pause Rule'}
            aria-label={isPaused ? 'Resume Rule' : 'Pause Rule'}
          >
            {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} />}
          </button>

          {/* Edit Button */}
          <button
            type="button"
            style={{
              width: 29,
              height: 29,
              borderRadius: 7,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => onEdit(rule)}
            title="Edit Rule"
            aria-label="Edit Rule"
          >
            <Edit2 size={12} />
          </button>

          {/* Delete Button */}
          <button
            type="button"
            style={{
              width: 29,
              height: 29,
              borderRadius: 7,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--debit, #ef4444)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => onDelete(rule)}
            title="Delete Rule"
            aria-label="Delete Rule"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutopayCard;
