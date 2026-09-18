import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Handshake, ArrowDownLeft, ArrowUpRight, RotateCcw, Calendar, Wallet as WalletIcon, Store, HeartHandshake, ListFilter, NotebookPen, Copy, Check, ChevronDown } from 'lucide-react';
import { MarkdownNote } from './common/MarkdownNote';
import { useStore } from '../store';
import type { Settlement, Expense } from '../types';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, cleanExpenseDescription, resolveCategoryMeta } from '../utils';
import CategoryIcon from './CategoryIcon';
import { renderWalletIcon } from './WalletIconRenderer';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

interface SettlementDetailModalProps {
  settlement: Settlement;
  onClose: () => void;
  onUndo?: (id: string) => void;
  zIndex?: number;
}

export default function SettlementDetailModal({ settlement, onClose, onUndo, zIndex = 100050 }: SettlementDetailModalProps) {
  useBackButtonModal(true, onClose, { priority: BackPriority.MODAL });
  const [isNoteOpen, setIsNoteOpen] = useState(true);
  const [copiedNote, setCopiedNote] = useState(false);

  const { db } = useStore();
  const settings = db?.settings || {};
  const currency = settings?.currency || 'INR';
  const categories = settings?.categories || [];
  const friends = db?.friends || [];
  const wallets = db?.wallets || [];
  const expenses = db?.expenses || [];

  const friend = friends.find(f => f && f.id === settlement?.friendId);
  const isForgiven = Boolean(settlement?.isForgiven);
  const wallet = wallets.find(w => w && w.id === settlement?.walletId);
  const walletName = isForgiven ? 'None (Forgiven)' : (wallet?.name || settlement?.paymentMethod || 'Wallet');

  const amtVal = Number(settlement?.amount) || 0;
  const isReceived = amtVal >= 0;
  const absAmount = Math.abs(amtVal);

  // Find all expenses associated with this settlement
  const expIdsSet = new Set(Array.isArray(settlement?.expenseIds) ? settlement.expenseIds : []);
  const settledExpenses: Expense[] = expenses.filter(
    e => e && (expIdsSet.has(e.id) || (e.settlementId && e.settlementId === settlement?.id) || (e.vendorSettlementId && e.vendorSettlementId === settlement?.id))
  );

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ zIndex }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal modal-dialog-panel" style={{ maxWidth: 420, width: '100%', borderRadius: 22 }}>
        {/* Top Handle Pill */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        {/* Header - No splitting line */}
        <div className="modal-header" style={{ padding: '12px 20px 8px', borderBottom: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {friend ? (
              <div
                className="avatar"
                style={{
                  ...getAvatarStyle(friend.color || (friend.type === 'vendor' ? '#f59e0b' : 'var(--accent)')),
                  width: 36,
                  height: 36,
                  borderRadius: friend.type === 'vendor' ? 11 : '50%',
                }}
              >
                {friend.type === 'vendor' ? <Store size={18} strokeWidth={2.2} /> : friendInitial(friend.name, friend.avatarNumber)}
              </div>
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'transparent',
                  display: 'grid',
                  placeItems: 'center',
                  color: isForgiven ? 'var(--amber)' : 'var(--text)',
                }}
              >
                {isForgiven ? <HeartHandshake size={20} /> : <Handshake size={20} />}
              </div>
            )}
            <div>
              <div className="modal-title" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                {isForgiven ? 'Forgiven Settlement' : 'Settlement Details'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{friend ? friend.name : 'Unknown Friend'}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>•</span>
                <span style={{ color: 'var(--text-2)', letterSpacing: '-0.1px' }}>{fmtDate(settlement?.date || '')}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Money Paid / Received / Forgiven Card */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 16,
              background: isForgiven
                ? 'var(--amber-bg)'
                : isReceived
                ? 'rgba(16, 185, 129, 0.06)'
                : 'rgba(239, 68, 68, 0.06)',
              border: `1px solid ${
                isForgiven
                  ? 'var(--amber-border)'
                  : isReceived
                  ? 'rgba(16, 185, 129, 0.18)'
                  : 'rgba(239, 68, 68, 0.18)'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isForgiven ? 'var(--amber)' : 'var(--text-3)',
                  marginBottom: 6,
                }}
              >
                {isForgiven ? 'WAIVED OFF AMOUNT' : 'TOTAL AMOUNT'}
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: isForgiven ? 'var(--amber)' : (isReceived ? '#10B981' : '#F87171'),
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.5px',
                  lineHeight: 1,
                }}
              >
                {isForgiven ? `~${fmtMoney(absAmount, currency)}` : `${isReceived ? '+' : '-'}${fmtMoney(absAmount, currency)}`}
              </div>
              <div style={{ fontSize: 12.5, color: isForgiven ? 'var(--amber)' : 'var(--text-2)', marginTop: 6, fontWeight: 500 }}>
                {isForgiven ? (
                  <span>No wallet deduction • Balance cleared</span>
                ) : (
                  <>
                    {isReceived ? 'Credited to' : 'Deducted from'} <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{walletName}</strong>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 650,
                  letterSpacing: '0.01em',
                  color: isForgiven ? 'var(--amber)' : (isReceived ? 'var(--credit)' : 'var(--debit)'),
                  background: isForgiven ? 'var(--amber-bg)' : (isReceived ? 'var(--credit-bg)' : 'var(--debit-bg)'),
                  border: isForgiven ? '1px solid var(--amber-border)' : `1px solid ${isReceived ? 'var(--credit-border)' : 'var(--debit-border)'}`,
                  padding: '3px 10px',
                  borderRadius: 9999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {isForgiven ? (
                  <>
                    <HeartHandshake size={12} strokeWidth={2.2} />
                    <span>Forgiven</span>
                  </>
                ) : isReceived ? (
                  <>
                    <ArrowDownLeft size={12} strokeWidth={2.2} />
                    <span>Received</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={12} strokeWidth={2.2} />
                    <span>Paid</span>
                  </>
                )}
              </div>
              {settlement?.remainingAmount && settlement.remainingAmount > 0 ? (
                <span style={{ fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 7px', borderRadius: 4, fontWeight: 650 }}>
                  Partial
                </span>
              ) : null}
            </div>
          </div>

          {/* Partial Settlement Breakdown Banner if Custom Settlement */}
          {settlement?.originalTotal && settlement.originalTotal > absAmount ? (
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Original Total</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {fmtMoney(settlement.originalTotal, currency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{isForgiven ? 'Waived' : 'Amount Paid'}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isForgiven ? 'var(--amber)' : (isReceived ? 'var(--credit)' : 'var(--debit)') }}>
                  {fmtMoney(absAmount, currency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Remaining Left</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                  {fmtMoney(settlement.remainingAmount || 0, currency)}
                </div>
              </div>
            </div>
          ) : null}

          {/* 2-Card Quick Info Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 14,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                <Calendar size={12} style={{ color: isForgiven ? 'var(--amber)' : 'var(--accent)' }} /> {isForgiven ? 'Forgive Date' : 'Settlement Date'}
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.1px' }}>
                {fmtDate(settlement?.date || '')}
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 14,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                {isForgiven ? (
                  <>
                    <HeartHandshake size={12} style={{ color: 'var(--amber)' }} /> Wallet Impact
                  </>
                ) : (
                  <>
                    <WalletIcon size={12} style={{ color: 'var(--accent)' }} /> Payment Wallet
                  </>
                )}
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
                {isForgiven ? (
                  <span style={{ color: 'var(--amber)' }}>No Money Moved</span>
                ) : (
                  <>
                    {renderWalletIcon(wallet?.icon || wallet?.id || walletName, 20)}
                    <span>{walletName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Note if available */}
          {settlement?.note && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '2px 0',
              }}
            >
              <div
                onClick={() => setIsNoteOpen(!isNoteOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <NotebookPen size={13} strokeWidth={2.2} style={{ color: 'var(--text-3)' }} />
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    NOTE
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(settlement.note);
                        setCopiedNote(true);
                        setTimeout(() => setCopiedNote(false), 1800);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copiedNote ? 'var(--credit, #10b981)' : 'var(--text-3)',
                      padding: '4px',
                      borderRadius: 'var(--radius-xs, 6px)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s ease',
                    }}
                    title="Copy note"
                    aria-label="Copy note"
                  >
                    {copiedNote ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsNoteOpen(!isNoteOpen)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-3)',
                      padding: '4px',
                      borderRadius: 'var(--radius-xs, 6px)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={isNoteOpen ? 'Collapse note' : 'Expand note'}
                    aria-label={isNoteOpen ? 'Collapse note' : 'Expand note'}
                  >
                    <ChevronDown
                      size={14}
                      strokeWidth={2.2}
                      style={{
                        transform: isNoteOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  </button>
                </div>
              </div>

              <motion.div
                initial={false}
                animate={{
                  height: isNoteOpen ? 'auto' : 0,
                  opacity: isNoteOpen ? 1 : 0,
                }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ fontSize: 'var(--fs-sm, 13px)', color: 'var(--text)', lineHeight: 1.55, fontWeight: 500, paddingTop: 2 }}>
                  <MarkdownNote content={settlement.note} />
                </div>
              </motion.div>
            </div>
          )}

          {/* Settled / Forgiven Expenses Breakdown */}
          <div>
            <div
              style={{
                fontSize: 'var(--fs-base, 14px)',
                fontWeight: 650,
                color: 'var(--text)',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ListFilter size={16} strokeWidth={2.2} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
                <span>{isForgiven ? 'Forgiven Expenses Breakdown' : 'Settled Expenses Breakdown'}</span>
              </div>
              <span
                style={{
                  fontSize: 'var(--fs-xs, 12px)',
                  color: 'var(--text-2)',
                  background: 'var(--surface2, rgba(255, 255, 255, 0.05))',
                  border: '1px solid var(--border)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{settledExpenses.length}</span>
                <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>items</span>
              </span>
            </div>

            {settledExpenses.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  background: 'var(--surface2)',
                  borderRadius: 10,
                  fontSize: 12.5,
                  color: 'var(--text-3)',
                }}
              >
                No expense details found for this settlement (they may have been archived or removed).
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  maxHeight: 250,
                  overflowY: 'auto',
                  paddingRight: 4,
                }}
              >
                {settledExpenses.map(exp => {
                  if (!exp) return null;
                  const cat = categories.find(c => c && c.name === exp.category);
                  const isForFriend = exp.type === 'for_friend';
                  const catMeta = resolveCategoryMeta(exp.category, cat, false);
                  return (
                    <motion.div
                      key={exp.id}
                      className="recent-expense-row-inside-card"
                      whileHover={{ backgroundColor: 'var(--surface3)' }}
                      whileTap={{ scale: 0.982, backgroundColor: 'var(--surface3)' }}
                      transition={{ duration: 0.12, ease: 'easeOut' }}
                      style={{
                        padding: '6px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-md, 8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius-sm, 8px)',
                            backgroundColor: catMeta.bg,
                            border: `1px solid ${catMeta.border}`,
                            color: catMeta.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CategoryIcon category={catMeta.name} icon={catMeta.icon} size={18} style={{ color: catMeta.color }} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 650,
                              color: 'var(--text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cleanExpenseDescription(exp.description) || 'Expense'}
                            </span>
                            {(() => {
                              if (friend?.type !== 'vendor') return null;
                              const expFriend = (exp.friendId && exp.friendId !== friend.id) ? friends.find(f => f && f.id === exp.friendId) : null;
                              if (expFriend) {
                                return (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      fontSize: 10.5,
                                      fontWeight: 600,
                                      padding: '2px 7px',
                                      borderRadius: 9999,
                                      background: 'var(--surface3)',
                                      color: 'var(--text-2)',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: '50%',
                                        aspectRatio: '1 / 1',
                                        ...getAvatarStyle(expFriend.color || (expFriend.type === 'vendor' ? '#f59e0b' : 'var(--accent)')),
                                        fontSize: 8,
                                        fontWeight: 750,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: 1,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {expFriend.type === 'vendor' ? (
                                        <Store size={8} strokeWidth={2.2} />
                                      ) : (
                                        (expFriend.name || '?').trim().charAt(0).toUpperCase()
                                      )}
                                    </span>
                                    <span>{expFriend.name}</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginTop: 3, flexWrap: 'wrap' }}>
                            <span>{fmtDate(exp.originalDate || exp.date)}</span>
                            <span style={{ color: 'var(--text-3)', fontSize: 9 }}>•</span>
                            <span>{exp.category || 'General'}</span>
                            {exp.originalAmount && Math.abs(exp.originalAmount - Number(exp.amount || 0)) > 0.01 ? (
                              <>
                                <span style={{ color: 'var(--text-3)', fontSize: 9 }}>•</span>
                                <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 11.5 }}>
                                  og {fmtMoney(exp.originalAmount, currency)}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: isForgiven ? 'var(--amber)' : (isForFriend ? 'var(--credit)' : 'var(--debit)'),
                          }}
                        >
                          {isForgiven ? `~${fmtMoney(Number(exp.amount) || 0, currency)}` : `${isForFriend ? '+' : '-'}${fmtMoney(Number(exp.amount) || 0, currency)}`}
                        </div>
                        {(() => {
                          const isPartial = Boolean(
                            exp.originalAmount && Math.abs(exp.originalAmount - Number(exp.amount || 0)) > 0.01
                          );
                          return (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: isForgiven ? 'var(--amber)' : (isPartial ? 'var(--accent)' : 'var(--credit)'),
                                background: isForgiven ? 'var(--amber-bg)' : (isPartial ? 'var(--accent-soft)' : 'var(--credit-bg)'),
                                padding: '1px 6px',
                                borderRadius: 6,
                                display: 'inline-block',
                                marginTop: 2,
                              }}
                            >
                              {isForgiven ? 'Waived' : isPartial ? 'Partially Settled' : 'Settled ✓'}
                            </span>
                          );
                        })()}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer - No splitting lines, single pill button */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderTop: 'none',
            background: 'transparent',
          }}
        >
          {onUndo ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onUndo(settlement.id);
              }}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 9999,
                padding: '0 20px',
                fontSize: '14px',
                fontWeight: 650,
                color: isForgiven ? 'var(--amber)' : '#F87171',
                backgroundColor: isForgiven ? 'var(--amber-bg)' : 'rgba(239, 68, 68, 0.12)',
                border: isForgiven ? '1px solid var(--amber-border)' : '1px solid rgba(239, 68, 68, 0.28)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = isForgiven ? 'var(--amber-border)' : 'rgba(239, 68, 68, 0.22)';
                e.currentTarget.style.borderColor = isForgiven ? 'var(--amber)' : 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = isForgiven ? 'var(--amber-bg)' : 'rgba(239, 68, 68, 0.12)';
                e.currentTarget.style.borderColor = isForgiven ? 'var(--amber-border)' : 'rgba(239, 68, 68, 0.28)';
              }}
            >
              <RotateCcw size={16} strokeWidth={2.2} />
              <span>{isForgiven ? 'Undo Forgiveness' : 'Undo Settlement'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 9999,
                padding: '0 20px',
                fontSize: '14px',
                fontWeight: 650,
                color: 'var(--text)',
                backgroundColor: 'var(--surface2)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span>Close</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
