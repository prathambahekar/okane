import { createPortal } from 'react-dom';
import { X, Handshake, ArrowDownLeft, ArrowUpRight, RotateCcw, Calendar, Wallet as WalletIcon, FileText, Store } from 'lucide-react';
import { useStore } from '../store';
import type { Settlement, Expense } from '../types';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, cleanExpenseDescription } from '../utils';
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

  const { db } = useStore();
  const settings = db?.settings || {};
  const currency = settings?.currency || 'INR';
  const categories = settings?.categories || [];
  const friends = db?.friends || [];
  const wallets = db?.wallets || [];
  const expenses = db?.expenses || [];

  const friend = friends.find(f => f && f.id === settlement?.friendId);
  const wallet = wallets.find(w => w && w.id === settlement?.walletId);
  const walletName = wallet?.name || settlement?.paymentMethod || 'Wallet';

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
                  color: 'var(--text)',
                }}
              >
                <Handshake size={20} />
              </div>
            )}
            <div>
              <div className="modal-title" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                Settlement Details
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
          {/* Money Paid / Received Card - Inspired by Parth Balance Card (Image 3) */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 16,
              background: isReceived ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
              border: `1px solid ${isReceived ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)'}`,
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
                  color: 'var(--text-3)',
                  marginBottom: 6,
                }}
              >
                TOTAL AMOUNT
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: isReceived ? '#10B981' : '#F87171',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.5px',
                  lineHeight: 1,
                }}
              >
                {isReceived ? '+' : '-'}{fmtMoney(absAmount, currency)}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 6, fontWeight: 500 }}>
                {isReceived ? 'Credited to' : 'Deducted from'} <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{walletName}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  color: isReceived ? '#10B981' : '#F87171',
                  background: isReceived ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  padding: '4px 11px',
                  borderRadius: 9999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  textTransform: 'uppercase',
                }}
              >
                {isReceived ? <ArrowDownLeft size={13} strokeWidth={2.5} /> : <ArrowUpRight size={13} strokeWidth={2.5} />}
                <span>{isReceived ? 'Money Received' : 'Money Paid'}</span>
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
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Amount Paid</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isReceived ? 'var(--credit)' : 'var(--debit)' }}>
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

          {/* 2-Card Quick Info Grid (Removed Expenses Included card) */}
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
                <Calendar size={12} style={{ color: 'var(--accent)' }} /> Settlement Date
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
                <WalletIcon size={12} style={{ color: 'var(--accent)' }} /> Payment Wallet
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
                {renderWalletIcon(wallet?.icon || wallet?.id || walletName, 20)}
                <span>{walletName}</span>
              </div>
            </div>
          </div>

          {/* Note if available */}
          {settlement?.note && (
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                fontSize: 12.5,
                color: 'var(--text-2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <FileText size={15} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Note: </span>
                {settlement.note}
              </div>
            </div>
          )}

          {/* Settled Expenses Breakdown */}
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Settled Expenses Breakdown</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-3)',
                  background: 'var(--surface2)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  letterSpacing: '0.01em',
                }}
              >
                {settledExpenses.length} expenses
              </span>
            </div>

            {settledExpenses.length === 0 ? (
              <div
                style={{
                  padding: '20px',
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
                  gap: 8,
                  maxHeight: 250,
                  overflowY: 'auto',
                  paddingRight: 4,
                }}
              >
                {settledExpenses.map(exp => {
                  if (!exp) return null;
                  const cat = categories.find(c => c && c.name === exp.category);
                  const isForFriend = exp.type === 'for_friend';
                  return (
                    <div
                      key={exp.id}
                      style={{
                        padding: '11px 14px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: cat?.color ? `${cat.color}18` : 'var(--accent-soft)',
                            display: 'grid',
                            placeItems: 'center',
                            color: cat?.color || 'var(--accent)',
                            flexShrink: 0,
                          }}
                        >
                          <CategoryIcon category={exp.category} size={16} />
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
                            color: isForFriend ? 'var(--credit)' : 'var(--debit)',
                          }}
                        >
                          {isForFriend ? '+' : '-'}{fmtMoney(Number(exp.amount) || 0, currency)}
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
                                color: isPartial ? 'var(--accent)' : 'var(--credit)',
                                background: isPartial ? 'var(--accent-soft)' : 'var(--credit-bg)',
                                padding: '1px 6px',
                                borderRadius: 6,
                                display: 'inline-block',
                                marginTop: 2,
                              }}
                            >
                              {isPartial ? 'Partially Settled' : 'Settled ✓'}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
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
                color: '#F87171',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.22)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.28)';
              }}
            >
              <RotateCcw size={16} strokeWidth={2.2} />
              <span>Undo Settlement</span>
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
