import React, { useState, useRef, useEffect } from 'react';
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
  MoreHorizontal,
} from 'lucide-react';
import type { RecurringRule, ViewName, Category, Friend, Wallet } from '../../types';
import { fmtMoney, fmtDate } from '../../utils';
import CategoryIcon from '../CategoryIcon';
import { MarkdownNote } from '../common/MarkdownNote';
import { renderWalletIcon } from '../WalletIconRenderer';

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

  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

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
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 15,
        background: 'var(--surface)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        opacity: isPaused ? 0.78 : 1,
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
      }}
    >
      {/* Top Main Row: Category Icon + Title & Clean Subtitle on Left, More Options on Right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        {/* Left: Category Icon + Title & Clean Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          {/* Category Icon Tile */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              backgroundColor: catColorBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `1px solid ${catColor}25`,
              color: catColor,
            }}
          >
            <CategoryIcon category={rule.category} icon={category?.icon} size={21} style={{ color: catColor }} />
          </div>

          {/* Title & Metadata Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5, minWidth: 0, flex: 1 }}>
            {/* Top Line: Title + Frequency Badge + Status Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6.5, minWidth: 0, flexWrap: 'nowrap' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 15.5,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.015em',
                }}
              >
                {rule.title}
              </span>

              {/* Frequency Badge next to title */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 7.5px',
                  borderRadius: 9999,
                  background: 'var(--surface2)',
                  color: 'var(--text-2)',
                  border: '1px solid var(--border)',
                  flexShrink: 0,
                  letterSpacing: '0.01em',
                  lineHeight: '1.3',
                }}
              >
                {getFrequencyLabel(rule)}
              </span>

              {isPaused && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-3)',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    padding: '2px 7px',
                    borderRadius: 9999,
                    fontWeight: 650,
                    flexShrink: 0,
                    letterSpacing: '0.01em',
                  }}
                >
                  On Hold
                </span>
              )}
            </div>

            {/* Subtitle: Linked Contact and/or Wallet */}
            {(linkedFriend || wallet) && (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                }}
              >
                {linkedFriend && (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--text-2)',
                      fontSize: 12.5,
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
                      <Store size={11.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    ) : linkedFriend.type === 'subscription' ? (
                      <Tv size={11.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    ) : (
                      <User size={11.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkedFriend.name}</span>
                  </button>
                )}

                {linkedFriend && wallet && <span style={{ opacity: 0.4 }}>·</span>}

                {wallet && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4.5,
                      flexShrink: 0,
                    }}
                    title={`Wallet: ${wallet.name}`}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {renderWalletIcon(wallet.icon || wallet.name, 15, wallet.color) || (
                        <WalletIcon size={12} style={{ opacity: 0.75 }} />
                      )}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {wallet.name}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top Right: More Options Menu */}
        <div style={{ flexShrink: 0, position: 'relative' }}>
          <button
            ref={buttonRef}
            type="button"
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            aria-label="More options"
            title="Options"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              background: menuOpen ? 'var(--surface2)' : 'transparent',
              border: `1px solid ${menuOpen ? 'var(--border)' : 'transparent'}`,
              color: 'var(--text-2)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <MoreHorizontal size={17} />
          </button>

          {/* More Options Dropdown Menu */}
          {menuOpen && (
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                boxShadow: '0 10px 28px -4px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06)',
                padding: 5,
                minWidth: 145,
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {/* Hold / Resume */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onTogglePause(rule);
                }}
                onMouseEnter={() => setHoveredAction('hold')}
                onMouseLeave={() => setHoveredAction(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 12px',
                  borderRadius: 9,
                  background: hoveredAction === 'hold' ? 'var(--surface2)' : 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 550,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.12s ease',
                }}
              >
                {isPaused ? <Play size={14} style={{ color: 'var(--accent)' }} /> : <Pause size={14} style={{ color: 'var(--text-3)' }} />}
                <span>{isPaused ? 'Resume' : 'Hold'}</span>
              </button>

              {/* Edit */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(rule);
                }}
                onMouseEnter={() => setHoveredAction('edit')}
                onMouseLeave={() => setHoveredAction(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 12px',
                  borderRadius: 9,
                  background: hoveredAction === 'edit' ? 'var(--surface2)' : 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 550,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.12s ease',
                }}
              >
                <Edit2 size={14} style={{ color: 'var(--text-3)' }} />
                <span>Edit</span>
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(rule);
                }}
                onMouseEnter={() => setHoveredAction('delete')}
                onMouseLeave={() => setHoveredAction(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: hoveredAction === 'delete' ? 'var(--debit-bg)' : 'transparent',
                  border: 'none',
                  color: 'var(--debit)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 'var(--fw-semibold)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.12s ease',
                }}
              >
                <Trash2 size={14} style={{ color: 'var(--debit)' }} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Row: Amount + Due Date on Left, Action Button on Right */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        {/* Bottom Left: Prominent Amount + Due Date / Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 'var(--fw-bold)',
              fontSize: 'var(--fs-xl)',
              color: 'var(--text)',
              letterSpacing: '-0.025em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.15,
            }}
          >
            {fmtMoney(rule.amount, currency)}
          </div>

          {/* Due date or log status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            {isAutopay ? (
              rule.nextDueDate ? (
                <span
                  style={{
                    fontSize: 'var(--fs-xs)',
                    fontWeight: isDueToday || isOverdue ? 'var(--fw-semibold)' : 'var(--fw-normal)',
                    color: isOverdue ? 'var(--debit)' : isDueToday ? 'var(--debit)' : 'var(--text-3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Calendar size={12} style={{ opacity: 0.8, flexShrink: 0 }} />
                  <span>Due {fmtDate(rule.nextDueDate)}</span>
                  {isDueToday && (
                    <span
                      style={{
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 'var(--fw-bold)',
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--debit-bg)',
                        color: 'var(--debit)',
                        border: '1px solid var(--debit-border)',
                      }}
                    >
                      Today
                    </span>
                  )}
                  {isOverdue && (
                    <span
                      style={{
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 'var(--fw-bold)',
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--debit-bg)',
                        color: 'var(--debit)',
                        border: '1px solid var(--debit-border)',
                      }}
                    >
                      Overdue
                    </span>
                  )}
                </span>
              ) : (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>No due date</span>
              )
            ) : rule.lastLoggedDate ? (
              <span
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4.5,
                  whiteSpace: 'nowrap',
                }}
                title={`Last logged on ${fmtDate(rule.lastLoggedDate)}`}
              >
                <Calendar size={12} style={{ opacity: 0.8, flexShrink: 0 }} />
                <span>Last: {fmtDate(rule.lastLoggedDate)}</span>
              </span>
            ) : rule.notes ? (
              <span
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-3)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontStyle: 'italic',
                }}
                title={rule.notes}
              >
                <MarkdownNote content={rule.notes} inline />
              </span>
            ) : (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                {isLoggedToday ? <span style={{ color: 'var(--credit)', fontWeight: 'var(--fw-semibold)' }}>Logged today</span> : 'Not logged today'}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Right: Clean Primary Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isAutopay ? (
            <button
              type="button"
              style={{
                height: 38,
                padding: '0 20px',
                fontSize: 'var(--fs-base)',
                fontWeight: 'var(--fw-bold)',
                borderRadius: 'var(--radius-full)',
                background: 'var(--surface2)',
                color: isPaused ? 'var(--text-3)' : 'var(--text)',
                border: '1px solid var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: isPaused ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
              onClick={() => onPay(rule)}
              disabled={isPaused}
              title="Record autopay deduction"
            >
              <CheckCircle2 size={16.5} strokeWidth={2.2} style={{ color: isPaused ? 'var(--text-3)' : 'var(--credit)' }} />
              <span>Pay</span>
            </button>
          ) : (
            <button
              type="button"
              style={{
                height: 38,
                padding: '0 20px',
                fontSize: 'var(--fs-base)',
                fontWeight: 'var(--fw-bold)',
                borderRadius: 'var(--radius-full)',
                background: isLoggedToday ? 'var(--credit-bg)' : 'var(--surface2)',
                color: isLoggedToday ? 'var(--credit)' : 'var(--text)',
                border: isLoggedToday ? '1px solid var(--credit-border)' : '1px solid var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: isPaused ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
              onClick={() => onQuickLog(rule)}
              disabled={isPaused}
              title={isLoggedToday ? 'Logged for today (tap to log again)' : "Log today's expense"}
            >
              <Zap size={16.5} strokeWidth={2.2} style={{ color: isLoggedToday ? 'var(--credit)' : 'var(--amber)' }} />
              <span>{isLoggedToday ? 'Logged' : 'Log'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutopayCard;
