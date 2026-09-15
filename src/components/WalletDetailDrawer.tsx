import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  TrendingDown,
  TrendingUp,
  X,
  RotateCcw,
  Handshake,
  Users,
  Search,
} from 'lucide-react';
import { useStore } from '../store';
import type { Wallet, Expense, Settlement } from '../types';
import { walletBalance, expenseFlow, monthKey } from '../db';
import {
  fmtMoney,
  fmtDate,
  typeLabel,
  statusLabel,
  groupExpenses,
  resolveCategoryMeta,
  cleanSettlementDescription,
  type GroupedExpense,
} from '../utils';
import { renderWalletIcon } from './WalletIconRenderer';
import ConfirmDialog from './ConfirmDialog';
import ExpenseModal from './ExpenseModal';
import { ExpenseDetailDrawer } from './ExpenseDetailDrawer';
import SettlementDetailModal from './SettlementDetailModal';
import { SmartExpenseMeta } from './expenses/SmartExpenseMeta';
import CategoryIcon from './CategoryIcon';
import { useBackButtonModal, BackPriority } from '../utils/backHandler';

interface WalletDetailDrawerProps {
  wallet: Wallet | null;
  onClose: () => void;
  zIndex?: number;
}

export default function WalletDetailDrawer({
  wallet,
  onClose,
  zIndex = 100060,
}: WalletDetailDrawerProps) {
  const { db, deleteSettlement, deleteExpense, showToast } = useStore();
  const { expenses, settings } = db;
  const currency = settings?.currency || 'INR';

  useBackButtonModal(Boolean(wallet), onClose, { priority: BackPriority.SUBVIEW });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailGe, setSelectedDetailGe] = useState<GroupedExpense | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [undoStlId, setUndoStlId] = useState<string | null>(null);

  const categoriesMap = useMemo(
    () => new Map((settings?.categories || []).map(c => [c.name, c])),
    [settings?.categories]
  );
  const friendsMap = useMemo(
    () => new Map((db.friends || []).map(f => [f.id, f])),
    [db.friends]
  );

  useEffect(() => {
    if (!wallet) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wallet, onClose]);

  const unifiedTransactions = useMemo(() => {
    if (!wallet) return [];
    const expItems = expenses
      .filter(e => e.walletId === wallet.id)
      .map(e => ({
        id: e.id,
        isSettlement: false as const,
        description: e.description,
        category: e.category,
        date: e.date,
        createdAt: e.createdAt,
        amount: Number(e.amount),
        flow: expenseFlow(e),
        statusKey:
          expenseFlow(e) === 'in'
            ? 'none'
            : e.settled
              ? 'settled'
              : e.type === 'for_friend' || e.type === 'by_friend'
                ? 'unsettled'
                : e.status || 'paid',
        typeLabelStr: typeLabel(e.type),
        rawExpense: e,
        vendorId: e.vendorId,
      }));

    const stlItems = (db.settlements || [])
      .filter(s => s.walletId === wallet.id)
      .map(s => {
        const flow = s.amount >= 0 ? 'in' : 'out';
        return {
          id: s.id,
          isSettlement: true as const,
          description: `Settlement: ${s.amount >= 0 ? 'Received' : 'Paid'}${s.note ? ` (${s.note})` : ''}`,
          category: 'Settlement',
          date: s.date,
          createdAt: s.createdAt,
          amount: Math.abs(s.amount),
          flow: flow as 'in' | 'out',
          statusKey: 'settled',
          typeLabelStr: 'Settlement',
          rawSettlement: s,
        };
      });

    const combined = [...expItems, ...stlItems];
    combined.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    return combined;
  }, [wallet, expenses, db.settlements]);

  const filteredTx = useMemo(() => {
    if (!searchQuery.trim()) return unifiedTransactions;
    const q = searchQuery.toLowerCase();
    return unifiedTransactions.filter(
      t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    );
  }, [unifiedTransactions, searchQuery]);

  const now = useMemo(() => new Date(), []);
  const thisKey = useMemo(
    () => now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'),
    [now]
  );

  const walletExpenses = useMemo(() => {
    if (!wallet) return [];
    return [...expenses.filter(e => e.walletId === wallet.id)].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [wallet, expenses]);

  const walletSettlements = useMemo(() => {
    if (!wallet) return [];
    return [...(db.settlements || []).filter(s => s.walletId === wallet.id)].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [wallet, db.settlements]);

  const walletMonthSpend = useMemo(() => {
    return (
      walletExpenses
        .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'out' && e.status !== 'unpaid')
        .reduce((s, e) => s + Number(e.amount), 0) +
      walletSettlements
        .filter(s => monthKey(s.date) === thisKey && s.amount < 0)
        .reduce((acc, s) => acc + Math.abs(s.amount), 0)
    );
  }, [walletExpenses, walletSettlements, thisKey]);

  const walletMonthIn = useMemo(() => {
    return (
      walletExpenses
        .filter(e => monthKey(e.date) === thisKey && expenseFlow(e) === 'in' && e.status !== 'unpaid')
        .reduce((s, e) => s + Number(e.amount), 0) +
      walletSettlements
        .filter(s => monthKey(s.date) === thisKey && s.amount > 0)
        .reduce((acc, s) => acc + s.amount, 0)
    );
  }, [walletExpenses, walletSettlements, thisKey]);

  if (!wallet) return null;

  const currentBal = walletBalance(db, wallet.id);

  return createPortal(
    <div
      className="modal-backdrop fade-in"
      style={{
        zIndex,
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal wallet-drawer-modal modal-dialog-panel"
        style={{ maxWidth: 480, width: '100%', borderRadius: 22 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Bottom-Sheet Handle Indicator */}
        <div className="modal-handle-bar">
          <div className="modal-handle" />
        </div>

        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px 8px',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          {/* Wallet Info & Close */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {renderWalletIcon(wallet.icon || wallet.name, 40, wallet.color)}
              </div>
              <div>
                <div
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                  }}
                >
                  {wallet.name}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: 2 }}>
                  Current Balance:{' '}
                  <strong
                    style={{
                      color: currentBal < 0 ? 'var(--debit)' : 'var(--text)',
                      fontWeight: 750,
                    }}
                  >
                    {fmtMoney(currentBal, currency)}
                  </strong>
                </div>
              </div>
            </div>

            <button
              className="btn-icon"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Monthly Stats Bar - Two balanced stat cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: '13px 16px',
                borderRadius: 16,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <TrendingDown size={13} style={{ color: 'var(--debit)' }} />
                <span>This Month Spent</span>
              </div>
              <div
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 750,
                  color: 'var(--debit)',
                  letterSpacing: '-0.2px',
                }}
              >
                -{fmtMoney(walletMonthSpend, currency)}
              </div>
            </div>

            <div
              style={{
                padding: '13px 16px',
                borderRadius: 16,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <TrendingUp size={13} style={{ color: 'var(--credit)' }} />
                <span>This Month Inflow</span>
              </div>
              <div
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 750,
                  color: 'var(--credit)',
                  letterSpacing: '-0.2px',
                }}
              >
                +{fmtMoney(walletMonthIn, currency)}
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-3)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${wallet.name} transactions...`}
              style={{
                width: '100%',
                height: 42,
                paddingLeft: 36,
                paddingRight: searchQuery ? 32 : 12,
                fontSize: '13px',
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchQuery && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-2)',
                marginTop: 8,
              }}
            >
              <span>Filtered by</span>
              <span
                style={{
                  fontWeight: 650,
                  color: 'var(--accent)',
                  backgroundColor: 'var(--accent-soft)',
                  padding: '2px 9px',
                  borderRadius: 9999,
                  border: '1px solid var(--border)',
                }}
              >
                "{searchQuery}"
              </span>
            </div>
          )}
        </div>

        {/* Transactions Content List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 16px calc(24px + env(safe-area-inset-bottom, 0px))',
            background: 'var(--surface)',
          }}
        >
          {filteredTx.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-2)' }}>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>
                {searchQuery ? 'No matching transactions found.' : 'No transactions recorded yet.'}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: 4 }}>
                {searchQuery
                  ? 'Try searching with a different term'
                  : 'Transactions associated with this wallet will appear here'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredTx.map((tx, idx) => {
                let effectiveCategory = tx.category;
                const descLower = (tx.description || '').toLowerCase();
                if (
                  descLower.includes('zepto') ||
                  descLower.includes('zeptoo') ||
                  descLower.includes('blinkit') ||
                  descLower.includes('instamart')
                ) {
                  effectiveCategory = 'Groceries';
                } else if (
                  (descLower.includes('from idbi') ||
                    descLower.startsWith('from ') ||
                    tx.flow === 'in') &&
                  !tx.isSettlement &&
                  tx.category !== 'Transfer'
                ) {
                  effectiveCategory = 'Income';
                }

                const catMeta = resolveCategoryMeta(
                  effectiveCategory,
                  categoriesMap.get(effectiveCategory),
                  tx.isSettlement,
                  categoriesMap
                );
                const isIn = tx.flow === 'in';
                const rawExpense = !tx.isSettlement ? tx.rawExpense : undefined;
                const rawSettlement = tx.isSettlement ? tx.rawSettlement : undefined;
                const isSplit = Boolean(rawExpense && rawExpense.type !== 'personal');
                const vendor = 'vendorId' in tx && tx.vendorId ? friendsMap.get(tx.vendorId) : null;
                const friend = rawExpense?.friendId ? friendsMap.get(rawExpense.friendId) : null;

                const handleRowClick = () => {
                  if (rawExpense) {
                    const rel = rawExpense.groupId
                      ? db.expenses.filter(x => x.groupId === rawExpense.groupId)
                      : [rawExpense];
                    const ge = groupExpenses(
                      rel.length > 0 ? rel : [rawExpense],
                      db.wallets,
                      db.friends
                    )[0];
                    if (ge) {
                      setSelectedDetailGe(ge);
                    }
                  } else if (rawSettlement) {
                    setSelectedSettlement(rawSettlement);
                  }
                };

                const getBadgeColors = (sKey: string) => {
                  if (sKey === 'settled' || sKey === 'paid' || sKey === 'completed') {
                    return {
                      bg: 'rgba(16, 185, 129, 0.12)',
                      color: '#10B981',
                      border: 'rgba(16, 185, 129, 0.25)',
                    };
                  }
                  if (sKey === 'unsettled' || sKey === 'unpaid' || sKey === 'overdue') {
                    return {
                      bg: 'rgba(239, 68, 68, 0.12)',
                      color: '#F87171',
                      border: 'rgba(239, 68, 68, 0.25)',
                    };
                  }
                  if (sKey === 'partial') {
                    return {
                      bg: 'rgba(245, 158, 11, 0.12)',
                      color: '#F59E0B',
                      border: 'rgba(245, 158, 11, 0.25)',
                    };
                  }
                  return {
                    bg: 'var(--surface3, rgba(255,255,255,0.06))',
                    color: 'var(--text-2)',
                    border: 'var(--border)',
                  };
                };

                return (
                  <div
                    key={`${tx.id}-${idx}`}
                    onClick={handleRowClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick();
                      }
                    }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    className="wallet-tx-item"
                  >
                    {/* Left Side: Icon + Details */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        minWidth: 0,
                        flex: '1 1 auto',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Category / Settlement Icon Tile */}
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 13,
                          backgroundColor: catMeta.bg,
                          border: `1px solid ${catMeta.border}`,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          color: catMeta.color,
                        }}
                      >
                        {tx.isSettlement ? (
                          <Handshake size={20} style={{ color: '#10B981' }} />
                        ) : (
                          <CategoryIcon
                            category={catMeta.name}
                            icon={catMeta.icon}
                            size={20}
                            style={{ color: catMeta.color }}
                          />
                        )}
                      </div>

                      {/* Info Block */}
                      <div style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                        {/* Title Line */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'nowrap',
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 650,
                              fontSize: '14px',
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {cleanSettlementDescription(tx.description)}
                          </span>
                        </div>

                        {/* Subtitle Hierarchy */}
                        <SmartExpenseMeta
                          category={!tx.isSettlement ? tx.category : undefined}
                          dateText={fmtDate(tx.date)}
                          vendor={vendor}
                          friends={friend && !vendor ? [friend] : []}
                          style={{ fontSize: '12px', marginTop: 3 }}
                        />
                      </div>
                    </div>

                    {/* Right Side: Amount + Status */}
                    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
                      <div
                        style={{
                          fontSize: '14.5px',
                          fontWeight: 750,
                          color: isIn ? 'var(--credit)' : 'var(--debit)',
                        }}
                      >
                        {isIn ? '+' : '-'}
                        {fmtMoney(tx.amount, currency)}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 6,
                          marginTop: 3,
                        }}
                      >
                        {isSplit && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '2px 7px',
                              borderRadius: 9999,
                              fontSize: '10.5px',
                              fontWeight: 650,
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              color: '#818CF8',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            <Users size={10} />
                            <span>Split</span>
                          </span>
                        )}
                        {tx.statusKey &&
                          tx.statusKey !== 'none' &&
                          statusLabel(tx.statusKey) &&
                          (() => {
                            const bCol = getBadgeColors(tx.statusKey);
                            return (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  fontSize: '10.5px',
                                  fontWeight: 650,
                                  padding: '2px 8px',
                                  borderRadius: 9999,
                                  backgroundColor: bCol.bg,
                                  color: bCol.color,
                                  border: `1px solid ${bCol.border}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {statusLabel(tx.statusKey)}
                              </span>
                            );
                          })()}
                        {tx.isSettlement && (
                          <button
                            type="button"
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              color: '#F87171',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              padding: 0,
                            }}
                            title="Undo Settlement"
                            onClick={e => {
                              e.stopPropagation();
                              setUndoStlId(tx.id);
                            }}
                          >
                            <RotateCcw size={11} strokeWidth={2.2} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sub-modals inside Wallet Drawer */}
      {selectedDetailGe && (
        <ExpenseDetailDrawer
          ge={selectedDetailGe}
          currency={currency}
          zIndex={zIndex + 20}
          onClose={() => setSelectedDetailGe(null)}
          onEdit={exp => {
            setSelectedDetailGe(null);
            setEditExp(exp);
          }}
          onDelete={id => {
            setSelectedDetailGe(null);
            deleteExpense(id);
            showToast('Expense deleted.');
          }}
        />
      )}

      {selectedSettlement && (
        <SettlementDetailModal
          settlement={selectedSettlement}
          zIndex={zIndex + 20}
          onClose={() => setSelectedSettlement(null)}
          onUndo={stlId => {
            setSelectedSettlement(null);
            deleteSettlement(stlId);
            showToast('Settlement undone. Balance restored.');
          }}
        />
      )}

      {editExp && (
        <ExpenseModal
          expense={editExp}
          zIndex={zIndex + 30}
          onClose={() => setEditExp(null)}
        />
      )}

      {undoStlId && (
        <ConfirmDialog
          title="Undo Settlement"
          message="Are you sure you want to undo this settlement? The settlement will be deleted and associated expenses marked as unsettled again."
          confirmLabel="Undo Settlement"
          zIndex={zIndex + 40}
          onConfirm={() => {
            deleteSettlement(undoStlId);
            setUndoStlId(null);
            showToast('Settlement undone. Balance restored.');
          }}
          onClose={() => setUndoStlId(null)}
        />
      )}
    </div>,
    document.body
  );
}
