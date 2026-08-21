import { createPortal } from 'react-dom';
import { X, Handshake, ArrowDownLeft, ArrowUpRight, RotateCcw, Calendar, Wallet as WalletIcon, FileText, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';
import type { Settlement, Expense } from '../types';
import { fmtMoney, fmtDate, friendInitial, getAvatarStyle, cleanExpenseDescription } from '../utils';
import CategoryIcon from './CategoryIcon';

interface SettlementDetailModalProps {
  settlement: Settlement;
  onClose: () => void;
  onUndo?: (id: string) => void;
}

export default function SettlementDetailModal({ settlement, onClose, onUndo }: SettlementDetailModalProps) {
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
    e => e && (expIdsSet.has(e.id) || (e.settlementId && e.settlementId === settlement?.id))
  );

  return createPortal(
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxWidth: 620 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {friend ? (
              <div className="avatar" style={getAvatarStyle(friend.color)}>
                {friendInitial(friend.name, friend.avatarNumber)}
              </div>
            ) : (
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'var(--surface3)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-3)',
                }}
              >
                <Handshake size={20} />
              </div>
            )}
            <div>
              <div className="modal-title" style={{ fontSize: 17, fontWeight: 700 }}>
                Settlement Details
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {friend ? friend.name : 'Unknown Friend'} • {fmtDate(settlement?.date || '')}
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Main Hero Card showing Who Paid Whom */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 14,
              background: isReceived ? 'var(--credit-bg)' : 'var(--debit-bg)',
              border: `1px solid ${isReceived ? 'var(--credit-border)' : 'var(--debit-border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isReceived ? 'var(--credit)' : 'var(--debit)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                {isReceived ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                {isReceived ? 'Money Received' : 'Money Paid'}
                {settlement?.remainingAmount && settlement.remainingAmount > 0 ? (
                  <span style={{ fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 4, textTransform: 'none' }}>
                    Partial Settlement
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                {isReceived
                  ? `${friend?.name || 'Friend'} paid you ${fmtMoney(absAmount, currency)}`
                  : `You paid ${friend?.name || 'Friend'} ${fmtMoney(absAmount, currency)}`}
                {settlement?.originalTotal && settlement.originalTotal > absAmount ? (
                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}> (out of {fmtMoney(settlement.originalTotal, currency)})</span>
                ) : null}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>
                {isReceived ? 'Credited to' : 'Deducted from'} <strong>{walletName}</strong> wallet
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: isReceived ? 'var(--credit)' : 'var(--debit)',
                  whiteSpace: 'nowrap',
                }}
              >
                {isReceived ? '+' : '-'}{fmtMoney(absAmount, currency)}
              </div>
              {settlement?.remainingAmount && settlement.remainingAmount > 0 ? (
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
                  {fmtMoney(settlement.remainingAmount, currency)} left
                </div>
              ) : null}
            </div>
          </div>

          {/* Partial Settlement Breakdown Banner if Custom Settlement */}
          {settlement?.originalTotal && settlement.originalTotal > absAmount ? (
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--surface2)',
                borderRadius: 10,
                border: '1px dashed var(--accent)',
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

          {/* Quick Info Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 10,
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--surface2)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Calendar size={12} /> Settlement Date
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {fmtDate(settlement?.date || '')}
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                background: 'var(--surface2)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <WalletIcon size={12} /> Payment Wallet
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {wallet && <span className="cat-dot" style={{ background: wallet.color }} />}
                {walletName}
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                background: 'var(--surface2)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <CheckCircle2 size={12} /> Expenses Included
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {settledExpenses.length} expense{settledExpenses.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Note if available */}
          {settlement?.note && (
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--surface2)',
                borderRadius: 10,
                border: '1px solid var(--border)',
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
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                {settledExpenses.length} items
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
                  gap: 10,
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
                        padding: '10px 12px',
                        background: 'var(--surface2)',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
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
                                      gap: 3.5,
                                      fontSize: 10,
                                      fontWeight: 650,
                                      padding: '1.5px 6px',
                                      borderRadius: 5,
                                      background: 'var(--surface3)',
                                      color: 'var(--text)',
                                      border: '1px solid var(--border)',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        background: getAvatarStyle(expFriend.color).background,
                                        color: '#ffffff',
                                        fontSize: 7.5,
                                        fontWeight: 700,
                                        display: 'grid',
                                        placeItems: 'center',
                                        lineHeight: 1,
                                      }}
                                    >
                                      {friendInitial(expFriend.name, expFriend.avatarNumber)}
                                    </span>
                                    <span>{expFriend.name}</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)', marginTop: 2, flexWrap: 'wrap' }}>
                            <span>{fmtDate(exp.originalDate || exp.date)}</span>
                            <span>•</span>
                            <span>{exp.category || 'General'}</span>
                            {exp.originalAmount && Math.abs(exp.originalAmount - Number(exp.amount || 0)) > 0.01 ? (
                              <>
                                <span>•</span>
                                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
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

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {onUndo ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onClose();
                onUndo(settlement.id);
              }}
              style={{
                color: 'var(--debit)',
                borderColor: 'var(--debit-border)',
                background: 'var(--debit-bg)',
                gap: 5,
              }}
            >
              <RotateCcw size={13} /> Undo Settlement
            </button>
          ) : <div />}

          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
